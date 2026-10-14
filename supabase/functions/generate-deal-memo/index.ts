// supabase/functions/generate-deal-memo/index.ts
//
// v21 (14 Oct 2026): legacy JWT keys disabled after a leak. Caller client
// uses the new publishable key. No logic change.
// v19: Pro+ tier gate resolved from the caller's own session.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function __envKeys(name: string): Record<string, string> {
  try { return JSON.parse(Deno.env.get(name) ?? "{}"); } catch { return {}; }
}
const PUBLISHABLE_KEY = __envKeys("SUPABASE_PUBLISHABLE_KEYS")["default"] ?? Object.values(__envKeys("SUPABASE_PUBLISHABLE_KEYS"))[0] ?? "";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = PUBLISHABLE_KEY;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizeSmartQuotes(text: string): string {
  return text
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'");
}

function repairMissingOpeningQuote(text: string): string {
  return text.replace(
    /("[\w_]+"\s*:\s*)([A-Za-z][^"{}\[\]]*?)(",|"\s*\})/g,
    '$1"$2$3'
  );
}

function repairMissingComma(text: string): string {
  return text.replace(/"(\s+)"([\w_]+)"(\s*):/g, '",$1"$2"$3:');
}

function parseMemoJson(rawText: string): Record<string, any> {
  let clean = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
  clean = normalizeSmartQuotes(clean);
  clean = repairMissingOpeningQuote(clean);
  clean = repairMissingComma(clean);

  const jsonMatch = clean.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      // fall through to salvage below
    }
  }

  const opening = clean.indexOf("{");
  if (opening === -1) throw new Error("No JSON object found in response");
  const body = clean.slice(opening);
  const lastCompleteField = body.lastIndexOf('",');
  if (lastCompleteField === -1) throw new Error("No complete fields in response");
  const salvaged = body.slice(0, lastCompleteField + 1) + "}";
  return JSON.parse(salvaged);
}

// Fixed score bands: below 40 Pass, 40-70 Request More Info, above 70 Express Interest.
function expectedActionForScore(score: number): string {
  if (score < 40) return "Pass";
  if (score <= 70) return "Request More Info";
  return "Express Interest";
}

function validateRecommendedAction(memo: Record<string, any>): string[] {
  const problems: string[] = [];
  const score = Number(memo.match_score);
  const action = memo.recommended_action;
  if (Number.isNaN(score) || typeof action !== "string") return problems;

  const expected = expectedActionForScore(score);
  if (action !== expected && !(expected === "Express Interest" && action === "Request More Info")) {
    problems.push(
      `recommended_action was "${action}" but match_score of ${score} requires "${expected}" per the fixed score bands (below 40: Pass, 40-70: Request More Info, above 70: Express Interest) — these bands are absolute except for the single DD-readiness override.`
    );
  }
  return problems;
}

function detectThesisDenial(memo: Record<string, any>, thesisWasGiven: boolean): string[] {
  const problems: string[] = [];
  if (!thesisWasGiven) return problems;
  const text = String(memo.mandate_alignment ?? "").toLowerCase();
  const denialPhrases = ["no investment thesis was provided", "thesis was not provided", "no thesis was given", "thesis not provided", "thesis was not given"];
  if (denialPhrases.some(p => text.includes(p))) {
    problems.push(`mandate_alignment denies an investment thesis was provided, but one was genuinely included in this request — direct contradiction of given data.`);
  }
  return problems;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });

  // Pro+ tier gate -- see file header note.
  const authHeader = req.headers.get("Authorization") ?? "";
  const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userError } = await callerClient.auth.getUser();
  if (userError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
  const { data: ownerId } = await callerClient.rpc("resolve_org_owner_id");
  const { data: callerOrg } = await callerClient
    .from("organizations").select("subscription_tier").eq("user_id", ownerId ?? user.id).maybeSingle();
  if (!callerOrg || !["pro", "compliance"].includes(callerOrg.subscription_tier)) {
    return new Response(JSON.stringify({
      error: "AI deal memos require a Pro plan or higher.",
      requires_upgrade: true, required_tier: "pro",
    }), {
      status: 403, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  try {
    const { initiative, mandate, dd_readiness } = await req.json();
    if (!initiative) return new Response(
      JSON.stringify({ error: "initiative is required" }),
      { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );

    const ddScore = dd_readiness?.score ?? 0;

    async function fetchExchangeRate(from: string, to: string): Promise<number | null> {
      if (!from || !to || from.toUpperCase() === to.toUpperCase()) return 1;
      try {
        const res = await fetch(`https://open.er-api.com/v6/latest/${encodeURIComponent(from.toUpperCase())}`);
        if (!res.ok) return null;
        const data = await res.json();
        const rate = data?.rates?.[to.toUpperCase()];
        return typeof rate === "number" ? rate : null;
      } catch (err) {
        console.warn("[generate-deal-memo] FX rate fetch failed", { from, to, err: String(err) });
        return null;
      }
    }

    const STAGE_TO_PREFERENCE_LABEL: Record<string, string> = {
      concept: "Concept / Early stage",
      pilot: "Pilot / Proof of concept",
      scaling: "Growth / Scaling",
      active: "Mature / Established",
    };
    function computeStageCompatibility(rawStage: string | undefined | null, stagePreferences: string[] | undefined | null): string {
      const stagePrefList = stagePreferences ?? [];
      const hasWildcard = stagePrefList.some(p => p.toLowerCase().includes("core") && p.toLowerCase().includes("unrestricted"));
      if (!rawStage) {
        return hasWildcard
          ? "MATCH — no stage was given for the initiative, but the funder's Core / Unrestricted preference covers any stage."
          : "UNDETERMINED — no stage was given for the initiative, and no wildcard funding preference is present.";
      }
      const normalized = rawStage.toLowerCase().trim();
      const mappedLabel = STAGE_TO_PREFERENCE_LABEL[normalized];
      const directMatch = mappedLabel ? stagePrefList.some(p => p.toLowerCase() === mappedLabel.toLowerCase()) : false;
      if (directMatch) {
        return `MATCH — the initiative's stage ("${rawStage}") maps to "${mappedLabel}", which IS in the funder's stated stage preferences.`;
      }
      if (hasWildcard) {
        return `MATCH — the initiative's stage ("${rawStage}") has no direct labeled equivalent in the funder's preferences, but the funder's list includes "Core / Unrestricted" (a funding TYPE covering any stage, not a specific phase), so this counts as compatible.`;
      }
      return `MISMATCH — the initiative's stage ("${rawStage}")${mappedLabel ? ` maps to "${mappedLabel}", which is` : " has no direct mapping and is"} NOT among the funder's stated stage preferences (${stagePrefList.join(", ") || "none given"}).`;
    }
    const stageCompatibility = computeStageCompatibility(initiative.stage, mandate?.stage_preference);

    const initiativeCurrency = (initiative.budget_currency ?? "USD").toUpperCase();
    const funderCurrency = (mandate?.grant_currency ?? "USD").toUpperCase();
    let convertedBudgetLine = "";
    if (initiative.budget_min != null && initiative.budget_max != null && initiativeCurrency !== funderCurrency) {
      const rate = await fetchExchangeRate(initiativeCurrency, funderCurrency);
      if (rate != null) {
        const convMin = Math.round(Number(initiative.budget_min) * rate);
        const convMax = Math.round(Number(initiative.budget_max) * rate);
        convertedBudgetLine = `- Budget ask converted to the funder's currency using a live FX rate: ${funderCurrency} ${convMin.toLocaleString()} – ${convMax.toLocaleString()}. Use THIS converted figure, not the original-currency figure above, when comparing against the funder's grant/investment range — do not attempt your own currency conversion or estimate an exchange rate.`;
      } else {
        convertedBudgetLine = `- Currency conversion unavailable: the budget ask above is in ${initiativeCurrency}, the funder's range is in ${funderCurrency}, and a live exchange rate could not be fetched. Do NOT guess or estimate a conversion yourself — state plainly in financial_assessment that the currencies differ and a reliable comparison isn't possible right now.`;
      }
    }

    const prompt = `You are an experienced impact investment analyst. Generate a concise deal memo for the following initiative, assessed against the funder's mandate.

INITIATIVE:
- Title: ${initiative.title}
- Problem: ${initiative.problem ?? "Not specified"}
- Expected outcome: ${initiative.outcome ?? "Not specified"}
- Target population: ${initiative.target_population ?? "Not specified"}
- Sectors: ${initiative.sectors?.join(", ") ?? "Not specified"}
- Locations: ${initiative.locations?.join(", ") ?? "Not specified"}
- Stage: ${initiative.stage ?? "Not specified"}
- Budget ask: ${initiative.budget_currency ?? "USD"} ${initiative.budget_min?.toLocaleString() ?? "?"} – ${initiative.budget_max?.toLocaleString() ?? "?"}
${convertedBudgetLine}
- Specific ask: ${initiative.specific_ask ?? "Not specified"}
- Prior experience: ${initiative.had_prior_experience ? "Yes" : "No"}
- Prior experience detail: ${initiative.prior_experience_detail ?? "Not specified"}
- Confirmed assets: ${initiative.confirmed_assets?.join(", ") ?? "None"}
- SDG alignment: ${initiative.sdg_tags?.join(", ") ?? "Not specified"}
- Duration: ${initiative.duration ?? "Not specified"}
- Partnership types sought: ${initiative.partnerships?.join(", ") ?? "Not specified"}
- Impact evidence: ${initiative.impact_evidence ?? "Not provided"}
- Target beneficiaries: ${initiative.target_beneficiaries ?? "Not specified"}
- Target jobs: ${initiative.target_jobs ?? "Not specified"}
- Female beneficiaries target: ${initiative.target_female_pct ? initiative.target_female_pct + "%" : "Not specified"}
- Target timeline: ${initiative.target_timeline_months ? initiative.target_timeline_months + " months" : "Not specified"}

FUNDER MANDATE:
${mandate?.investment_thesis ? `- Investment thesis: "${mandate.investment_thesis}"\n  (THIS THESIS IS PROVIDED — you must compare this specific initiative's problem/sector against it by name in mandate_alignment. Do not write that no thesis was given; one appears on the line directly above.)` : "- Investment thesis: Not specified — no thesis was given for this funder."}
- Funding instruments: ${mandate?.funding_instruments?.join(", ") ?? "Not specified"}
- Grant/investment range: ${mandate?.grant_currency ?? "USD"} ${mandate?.grant_range_min?.toLocaleString() ?? "?"} – ${mandate?.grant_range_max?.toLocaleString() ?? "?"}
- Stage preference: ${mandate?.stage_preference?.join(", ") ?? "Not specified"}
- Stage compatibility (ALREADY DETERMINED — do not recompute): ${stageCompatibility}
- Geographic focus: ${mandate?.geographic_focus?.join(", ") ?? "Pan-Africa"}
- Sector focus: ${mandate?.mandate_sectors?.join(", ") ?? "Not specified"}
- SDG priorities: ${mandate?.mandate_sdgs?.join(", ") ?? "Not specified"}

DD READINESS (organisation self-reported):
- Financial model available: ${dd_readiness?.financial_model ? "Yes" : "No"}
- Audited accounts: ${dd_readiness?.audited_accounts ? "Yes" : "No"}
- Governance documentation: ${dd_readiness?.governance_doc ? "Yes" : "No"}
- ESG assessment: ${dd_readiness?.esg_assessment ? "Yes" : "No"}
- Impact measurement framework: ${dd_readiness?.impact_framework ? "Yes" : "No"}
- Environmental policy: ${dd_readiness?.environmental_policy ? "Yes" : "No"}
- Safeguarding policy: ${dd_readiness?.safeguarding_policy ? "Yes" : "No"}
- Legal registration / tax-exempt status: ${dd_readiness?.legal_registration ? "Yes" : "No"}
- Legal & compliance declaration: ${dd_readiness?.legal_compliance_declaration ? "Yes" : "No"}
- Overall DD readiness score: ${ddScore}% — this exact number must be used verbatim anywhere the DD readiness score is stated or referenced. Do not paraphrase it into a different range.

STRUCTURAL HONESTY — apply before writing anything:
- The initiative may list multiple locations. Check each one individually against the funder's stated geographic focus rather than judging the initiative as a single yes/no match. If some locations fall within the focus and others don't, say exactly which ones do and which don't (e.g. "Nigeria and Ghana fall within the funder's Sub-Saharan Africa focus; the UK component does not") — do not describe a partially-overlapping initiative as a flat mismatch, and do not describe a partial overlap as full alignment either.
- Never claim two countries or regions are neighbouring, adjacent, or the same sub-region unless genuinely true. If unsure, do not claim it.
- STAGE MATCHING: use the "Stage compatibility" line given above exactly as stated — it has already been correctly determined by comparing the initiative's stage against the funder's preferences, including the Core/Unrestricted wildcard case. Do not re-derive or re-judge this yourself; state that predetermined result (in your own words if you like) in mandate_alignment, and never contradict it by claiming a match is a mismatch or vice versa.
- BUDGET: look at the exact "Budget ask" line given in the INITIATIVE section above. If it shows real numbers (e.g. "USD 20,000 – 50,000"), those are the actual figures — you MUST state and use them in financial_assessment, and compare them against the funder's grant/investment range. Never write "unspecified," "not specified," or "unclear" for the budget when real numbers are shown there — that phrasing is reserved ONLY for when the line literally shows "?" in place of a number (meaning no figure was ever given). Check the actual character content of that line before deciding which case applies; do not assume it is missing. If the initiative's budget and the funder's range are in different currencies, a separate line below the budget ask gives either a pre-converted figure (from a real, live exchange rate) or a note that conversion was unavailable — use that line for any cross-currency comparison. NEVER estimate, guess, or apply your own sense of an exchange rate; only use the conversion given to you or say plainly that currencies could not be compared.
- If the initiative's sector does not match the funder's stated sector focus, say so plainly.
- If the budget ask falls outside the funder's grant/investment range, say so plainly and by how much.
- A shared SDG reference is not by itself a strong fit — weigh it alongside geography, stage, sector, and DD readiness, not as a substitute for them.
- INVESTMENT THESIS: if the Investment thesis line above shows real text (not "Not specified"), mandate_alignment MUST open by naming what that thesis actually describes (its focus area, theme, or approach) and stating plainly whether this specific initiative's problem and sector genuinely fit that description. A thesis naming a specific focus (e.g. "climate adaptation") is a real constraint, not a formality — if this initiative doesn't address that focus at all, say so directly as a mismatch, even if geography/sector/SDG fields happen to line up elsewhere. NEVER write that no thesis was provided when the Investment thesis line above shows real text — that would directly contradict data given to you in this same prompt.
- SCORE BANDS — fixed, absolute, no exceptions for partial fit elsewhere: match_score below 40 → recommended_action MUST be "Pass". match_score 40 to 70 inclusive → recommended_action MUST be "Request More Info". match_score above 70 → recommended_action MUST be "Express Interest". Set match_score first, honestly, based on genuine mandate compatibility (geography, stage, sector, thesis fit — a real mismatch on any of these should score well below 40, not just below 60), then derive recommended_action mechanically from the band above. Do not pick recommended_action first and work backward to a score that justifies it.
- ONE NARROW OVERRIDE: regardless of match_score or the band above, recommended_action can NEVER be "Express Interest" when audited accounts AND a financial model are BOTH missing — cap it at "Request More Info" in that case, and name the missing documentation as the specific reason. This is the only exception to the score bands; do not invent others.
- match_score should reflect genuine compatibility, not effort to find positives. A real, total geographic, stage, or sector mismatch should cap match_score below 60 regardless of SDG alignment. A partial geographic match (some locations fit, some don't) should be scored proportionally, not treated the same as zero overlap.

CLAIM SCRUTINY — this reader is the decision-maker, not the pitch's audience. Surface concerns, never paper over them:
- If the initiative's stated outcome or specific ask is implausible given its own stated timeline, budget, or scale (e.g. major job creation claimed within a few months, or a claim to solve a systemic problem outright), do not repeat it uncritically in problem_validity, solution_fit, or mandate_alignment. Name it explicitly as a risk_flag (e.g. "Stated outcome of [X] may not be achievable within the initiative's own [Y]-month timeline") and let it lower match_score. Do not soften or quietly reword an implausible claim — flag it so the funder sees it.
- Avoid filler and hype language in your own analysis: do not use innovative, cutting-edge, world-class, state-of-the-art, robust, dynamic, empowering, leverage, synergy, holistic, foster, stakeholders, "meaningful difference," "positive difference," "responsible business," "proven," "evidence-based," "best practice" (without a citation), "eliminate," "eradicate," "solve," "unprecedented," or ownerless passive phrasing like "it is hoped that." If the initiative's own submitted text uses this kind of language, do not adopt it into your assessment uncritically — describe only what the evidence actually supports.
- Do not invent numbers, dates, or statistics not present in the data given above, in either direction — do not inflate the initiative's figures, and do not invent different figures of your own for the analysis.

Return ONLY a valid JSON object. No markdown, no backticks, no explanation. Use only straight double quotes (\") for every field — never curly or typographic quotes, never omit the opening quote of a string value, and always place a comma between every field except the last one.

{
  "match_score": <number 0-100>,
  "headline": "<One sentence summary of this opportunity for the funder>",
  "problem_validity": "<2-3 sentences assessing how real and significant the problem is>",
  "solution_fit": "<2-3 sentences on whether the approach is credible and well-defined. Ensure you reference any impact evidence provided>",
  "team_credibility": "<2-3 sentences on track record, prior experience, confirmed assets, and DD readiness score if provided>",
  "financial_assessment": "<2-3 sentences on budget reasonableness, ask clarity, co-funding status>",
  "mandate_alignment": "<2-3 sentences on how well this fits the funder's specific mandate and investment thesis. Reference the thesis directly if provided. If geography, stage, or sector do not fully match, state exactly which parts do and don't>",
  "risk_flags": ["<specific risk 1>", "<specific risk 2>", "<specific risk 3>"],
  "recommended_action": "<One of: Express Interest, Request More Info, Pass>",
  "recommended_action_reason": "<One sentence explaining the recommendation, referencing the actual DD readiness score if relevant>"
}
  Write like a senior impact investment analyst at a DFI or philanthropic foundation. 
  Be specific — reference actual figures, locations, and stages from the initiative data. 
  Flag concrete gaps explicitly, including geographic, stage, or sector mismatches — and be precise about partial versus total mismatches. 
  Do not add summary judgement sentences at the end of each section like "A credible problem" or "A solid approach" — just write the analysis.
  If key information is missing, say exactly what is missing and why it matters.`;



    function sleep(ms: number): Promise<void> {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }

    const MAX_RATE_LIMIT_RETRIES = 1;
    let groqRes: Response | null = null;
    for (let rateLimitAttempt = 0; rateLimitAttempt <= MAX_RATE_LIMIT_RETRIES; rateLimitAttempt++) {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "openai/gpt-oss-120b",
          max_completion_tokens: 3000,
          temperature: 0.4,
          top_p: 1,
          reasoning_effort: "low",
          stream: false,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (res.status === 429 && rateLimitAttempt < MAX_RATE_LIMIT_RETRIES) {
        const errBody = await res.text();
        const retryAfterHeader = res.headers.get("retry-after");
        const bodyMatch = errBody.match(/try again in ([\d.]+)s/i);
        const waitSeconds = retryAfterHeader
          ? parseFloat(retryAfterHeader)
          : bodyMatch
          ? parseFloat(bodyMatch[1])
          : 5;
        const waitMs = Math.min(Math.ceil(waitSeconds * 1000) + 500, 25000);
        console.warn("[generate-deal-memo] Groq 429 rate limit hit, retrying", { rateLimitAttempt, waitMs, body: errBody });
        await sleep(waitMs);
        continue;
      }

      groqRes = res;
      break;
    }

    if (!groqRes) {
      return new Response(JSON.stringify({ error: "Groq API request failed after rate limit retry" }), {
        status: 502, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    if (!groqRes.ok) {
      const err = await groqRes.text();
      console.error(
        `[generate-deal-memo] Groq API error - status: ${groqRes.status} ${groqRes.statusText}, ` +
        `remaining-tokens: ${groqRes.headers.get("x-ratelimit-remaining-tokens")}, ` +
        `remaining-requests: ${groqRes.headers.get("x-ratelimit-remaining-requests")}, body: ${err}`
      );
      return new Response(JSON.stringify({ error: `Groq API error: ${err}` }), {
        status: 502, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const groqData = await groqRes.json();
    const rawText = groqData.choices?.[0]?.message?.content ?? "";

    let memo: Record<string, any>;
    try {
      memo = parseMemoJson(rawText);
    } catch {
      return new Response(JSON.stringify({ error: "Could not parse response.", raw: rawText }), {
        status: 422, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const actionProblems = validateRecommendedAction(memo);
    if (actionProblems.length > 0) {
      console.warn("[generate-deal-memo] recommended_action did not match score band, correcting", {
        title: initiative?.title,
        problems: actionProblems,
        original_action: memo.recommended_action,
        match_score: memo.match_score,
      });
      memo.recommended_action = expectedActionForScore(Number(memo.match_score));
    }

    const thesisProblems = detectThesisDenial(memo, Boolean(mandate?.investment_thesis));
    if (thesisProblems.length > 0) {
      console.warn("[generate-deal-memo] mandate_alignment denied a real investment thesis", {
        title: initiative?.title,
        problems: thesisProblems,
      });
    }

    return new Response(JSON.stringify({ data: memo }), {
      status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
});
