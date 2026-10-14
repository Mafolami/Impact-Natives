// supabase/functions/generate-csr-brief/index.ts
//
// v24 (14 Oct 2026): legacy JWT keys disabled after a leak. Caller client
// uses the new publishable key. No logic change.
// v22: Pro+ tier gate, same pattern as generate-deal-memo v19.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function __envKeys(name: string): Record<string, string> {
  try { return JSON.parse(Deno.env.get(name) ?? "{}"); } catch { return {}; }
}
const PUBLISHABLE_KEY = __envKeys("SUPABASE_PUBLISHABLE_KEYS")["default"] ?? Object.values(__envKeys("SUPABASE_PUBLISHABLE_KEYS"))[0] ?? "";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") ?? "";
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

function parseBriefJson(rawText: string): Record<string, any> {
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

function expectedActionForScore(score: number): string {
  if (score < 50) return "Pass";
  if (score <= 75) return "Explore further";
  return "Adopt as CSR programme";
}

function validateRecommendedAction(memo: Record<string, any>): string[] {
  const problems: string[] = [];
  const score = Number(memo.match_score);
  const action = memo.recommended_action;
  if (Number.isNaN(score) || typeof action !== "string") return problems;

  const expected = expectedActionForScore(score);
  if (action !== expected) {
    problems.push(
      `recommended_action was "${action}" but match_score of ${score} requires "${expected}" per the fixed score bands (below 50: Pass, 50-75: Explore further, above 75: Adopt as CSR programme) — these bands are absolute and do not have exceptions for partial fit elsewhere.`
    );
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
      error: "AI CSR briefs require a Pro plan or higher.",
      requires_upgrade: true, required_tier: "pro",
    }), {
      status: 403, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  try {
    const { initiative, csr_mandate, dd_readiness } = await req.json();

    if (!initiative) return new Response(
      JSON.stringify({ error: "initiative is required" }),
      { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );

    const ddScore = dd_readiness?.score ?? 0;

    function humanizeOrgType(raw: string): string {
      return raw
        .replace(/_/g, " ")
        .split(" ")
        .filter(Boolean)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ");
    }
    const orgTypeLabel = csr_mandate?.org_type ? humanizeOrgType(String(csr_mandate.org_type)) : "Corporate";
    const orgName: string | null = csr_mandate?.org_name || csr_mandate?.organisation_name || null;
    const addressee = orgName ?? "your organisation";

    const prompt = `You are an experienced corporate social responsibility (CSR) advisor specialising in African impact programmes. You are writing DIRECTLY TO ${addressee} — a ${orgTypeLabel} — as their advisor, giving your verdict on whether to adopt the following initiative as their CSR programme. Write the way a real advisor writes to a client: naturally interchange between direct address ("your," "you")${orgName ? ` and their actual name ("${orgName}")` : ""} the way a person would — not by mechanically inserting "you/your" into every single sentence. Some sentences state a fact plainly with no address term at all (e.g. "Nigeria falls outside the stated geographic focus"); others speak to the reader directly. Never refer to them in the third person as "the company," "the corporation," or "the ${orgTypeLabel.toLowerCase()}" — that framing is for a report about a third party, not advice to a client.

INITIATIVE:
- Title: ${initiative.title}
- Problem: ${initiative.problem ?? "Not specified"}
- Expected outcome: ${initiative.outcome ?? "Not specified"}
- Target population: ${initiative.target_population ?? "Not specified"}
- Sectors: ${initiative.sectors?.join(", ") ?? "Not specified"}
- Locations: ${initiative.locations?.join(", ") ?? "Not specified"}
- Stage: ${initiative.stage ?? "Not specified"}
- Budget ask: ${initiative.budget_currency ?? "USD"} ${initiative.budget_min?.toLocaleString() ?? "?"} – ${initiative.budget_max?.toLocaleString() ?? "?"}
- Specific ask: ${initiative.specific_ask ?? "Not specified"}
- SDG alignment: ${initiative.sdg_tags?.join(", ") ?? "Not specified"}
- ESG/CSR friendly: ${initiative.esg_alignment ? "Yes" : "No"}
- Partnership types sought: ${initiative.partnerships?.join(", ") ?? "Not specified"}
- Prior experience: ${initiative.had_prior_experience ? "Yes" : "No"}
- Prior experience detail: ${initiative.prior_experience_detail ?? "Not specified"}
- Impact evidence: ${initiative.impact_evidence ?? "Not provided"}
- Target beneficiaries: ${initiative.target_beneficiaries ?? "Not specified"}
- Target jobs: ${initiative.target_jobs ?? "Not specified"}
- Female beneficiaries target: ${initiative.target_female_pct ? initiative.target_female_pct + "%" : "Not specified"}
- Target timeline: ${initiative.target_timeline_months ? initiative.target_timeline_months + " months" : "Not specified"}

CORPORATE CSR MANDATE:
- Organisation type: ${orgTypeLabel}
- ESG frameworks: ${csr_mandate?.esg_frameworks?.join(", ") ?? "Not specified"}
- CSR budget range: ${csr_mandate?.csr_budget_range ?? "Not specified"}
- Geographic focus: ${csr_mandate?.geographic_focus?.join(", ") ?? "Not specified"}
- Sector focus: ${csr_mandate?.mandate_sectors?.join(", ") ?? "Not specified"}
- SDG priorities: ${csr_mandate?.mandate_sdgs?.join(", ") ?? "Not specified"}
- Partnership type preference: ${csr_mandate?.partner_type_preference?.join(", ") ?? "Not specified"}

TERMINOLOGY AND VOICE — throughout EVERY field of the brief, without exception:
- Vary naturally between "you/your"${orgName ? `, the name "${orgName}"` : ""}, and plain factual statements with no address term at all — the way a real advisor's memo actually reads, not a template that inserts "your" into every sentence. E.g. mix "Your stated geographic focus is Algeria" with a plain "Nigeria falls outside that focus" in the next sentence — don't force "your" onto every clause.
- ${orgName ? `Use the name "${orgName}" sparingly — a natural place or two (e.g. the headline), not repeated constantly. Critically: never follow the name with a possessive ("${orgName}'s geographic focus," "${orgName}'s CSR criteria") — that construction reads like a report describing a third party, not advice to a client. For anything possessive (focus, mandate, criteria, budget, priorities), always say "your," never "${orgName}'s." Use the bare name only as a subject or address, never with 's attached.` : `No organisation name was given — rely on "you/your" and plain statements, and if you need a noun, use "your organisation," never a generic third-person label.`}
- Never write in the third person about the reader ("the company," "the corporation," "the technology company," "the ${orgTypeLabel.toLowerCase()}") — that framing describes them as an outside party being evaluated, when they are the one being advised.
- NEVER use "we," "our," or "us" to refer to the reader's organisation — you are their external advisor, not a member of their team. "Our priorities" or "our focus" incorrectly merges your identity with theirs. Use "your"/"you"${orgName ? ` or "${orgName}"` : ""} instead in every case (e.g. "your priorities," never "our priorities").
- This applies to every field: headline, sdg_alignment, local_content, brand_fit, esg_framework_match, partnership_options, reputational_considerations, implementer_readiness, and recommended_action_reason should all read as advice to the reader, in natural varied phrasing — never in third person, and never with "we/our/us."

IMPLEMENTER DD READINESS:
- Financial model available: ${dd_readiness?.financial_model ? "Yes" : "No"}
- Audited accounts: ${dd_readiness?.audited_accounts ? "Yes" : "No"}
- Governance documentation: ${dd_readiness?.governance_doc ? "Yes" : "No"}
- ESG assessment: ${dd_readiness?.esg_assessment ? "Yes" : "No"}
- Impact measurement framework: ${dd_readiness?.impact_framework ? "Yes" : "No"}
- Environmental policy: ${dd_readiness?.environmental_policy ? "Yes" : "No"}
- Safeguarding policy: ${dd_readiness?.safeguarding_policy ? "Yes" : "No"}
- Legal registration / tax-exempt status: ${dd_readiness?.legal_registration ? "Yes" : "No"}
- Legal & compliance declaration: ${dd_readiness?.legal_compliance_declaration ? "Yes" : "No"}
- Overall DD readiness score: ${ddScore}% — this exact number must be used verbatim anywhere the DD readiness score is stated or referenced. Do not paraphrase it into a different range (e.g. do not describe a 60% score as "below 40%").

SOURCE ATTRIBUTION — do not mix up which side of the comparison a fact came from:
- The ESG frameworks, sector focus, geographic focus, and SDG priorities listed under CORPORATE CSR MANDATE describe YOUR (the reader's) own stated preferences — they are not claims the initiative has made about itself. Never write a sentence implying the initiative "mentions," "aligns with," or "uses" a specific named framework (e.g. GRI, IRIS+, B Corp) unless that exact framework is explicitly present in the INITIATIVE data above. If the initiative itself says nothing about ESG frameworks, say plainly that it provides no framework alignment information, and evaluate esg_framework_match based only on sector/geography/SDG overlap with your mandate instead.
- Similarly, never attribute your own sector focus, geographic focus, or SDG priorities to the initiative as if the initiative claimed them.

STRUCTURAL HONESTY — apply before writing anything:
- Your stated geographic focus is ONLY the country/countries explicitly listed above under "Geographic focus" — nothing else. Never claim, imply, or hedge that any other country (including one the initiative operates in) is "within your focus," "aligned with your focus," or similar, unless that exact country appears in the "Geographic focus" list given above. You are given no information about where your organisation itself is based or operates — do not guess or infer this; judge geographic fit using ONLY the stated Geographic focus list against the initiative's stated locations.
- If the initiative's location is not in your stated geographic focus, say so plainly and directly to the reader (e.g. "this operates outside your stated geographic focus"). Never claim two countries are neighbouring, adjacent, or in the same region unless they genuinely share a border or are widely recognised as the same sub-region. If you are not certain two places are adjacent, do not claim it.
- If the initiative's sector does not match your stated sector focus, say so plainly rather than searching for a tenuous connection. If your sector focus shows "Not specified," you MUST say plainly that no sector focus was given for you, and you must NOT claim any sector overlap, match, or alignment at all — do not borrow the initiative's own listed sectors and present them as if they were your stated interests or priorities. A sector focus of "Not specified" means there is nothing to compare against, not a blank check to invent one.
- A shared SDG or ESG framework reference is not by itself a strong fit — weigh it alongside geography, sector, and DD readiness, not as a substitute for them.

SCORE BANDS — fixed, absolute, no exceptions for partial fit elsewhere:
- match_score below 50 → recommended_action MUST be "Pass".
- match_score 50 to 75 inclusive → recommended_action MUST be "Explore further".
- match_score above 75 → recommended_action MUST be "Adopt as CSR programme".
These bands are not conditional on geography, sector, DD readiness, or anything else being a strong or partial match — match_score itself is where all of that judgment belongs. Set match_score first, honestly, based on genuine compatibility (a real, total mismatch across geography, sector, and DD readiness should score well below 50, not just below 60), then derive recommended_action mechanically from the band above. Do not pick recommended_action first and work backward to a score that justifies it.

CLAIM SCRUTINY — this reader is the decision-maker, not the pitch's audience. Surface concerns, never paper over them:
- If the initiative's stated outcome or specific ask is implausible given its own stated timeline, budget, or scale (e.g. major job creation claimed within a few months, or a claim to solve a systemic problem outright), do not repeat it uncritically in local_content, brand_fit, or esg_framework_match. Name it explicitly as a risk_flag (e.g. "Stated outcome of [X] may not be achievable within the initiative's own [Y]-month timeline") and let it lower match_score. Do not soften or quietly reword an implausible claim — flag it so you're giving the reader an honest verdict, not a sales pitch.
- Avoid filler and hype language in your own analysis: do not use innovative, cutting-edge, world-class, state-of-the-art, robust, dynamic, empowering, leverage, synergy, holistic, foster, stakeholders, "meaningful difference," "positive difference," "responsible business," "proven," "evidence-based," "best practice" (without a citation), "eliminate," "eradicate," "solve," "unprecedented," or ownerless passive phrasing like "it is hoped that." If the initiative's own submitted text uses this kind of language, do not adopt it into your assessment uncritically — describe only what the evidence actually supports.
- Do not invent numbers, dates, or statistics not present in the data given above, in either direction — do not inflate the initiative's figures, and do not invent different figures of your own for the analysis.

Return ONLY a valid JSON object. No markdown, no backticks, no explanation text before or after the JSON. Use only straight double quotes (\") for every field — never curly or typographic quotes, never omit the opening quote of a string value, and always place a comma between every field except the last one.

{"match_score":<number 0-100>,"headline":"<One sentence, as an advisor would open, on why this fits (or doesn't fit) your CSR strategy>","sdg_alignment":"<2-3 sentences, natural advisor voice, on SDG mapping to your priorities>","local_content":"<2-3 sentences, natural advisor voice, on geographic reach and community impact>","brand_fit":"<2-3 sentences, natural advisor voice, on sector and brand alignment with your focus>","esg_framework_match":"<2-3 sentences, natural advisor voice, on ESG framework compliance, based only on what the initiative itself actually states>","partnership_options":"<2-3 sentences, natural advisor voice, on what you could contribute>","reputational_considerations":"<2-3 sentences, natural advisor voice, on reputational opportunities and risks for you>","implementer_readiness":"<2-3 sentences on the implementer's track record and DD readiness>","risk_flags":["<risk 1>","<risk 2>","<risk 3>"],"recommended_action":"<One of: Adopt as CSR programme, Explore further, Pass>","recommended_action_reason":"<One sentence, as an advisor would state their recommendation, explaining it>"}

Write as a senior CSR advisor speaking directly to your client — natural, varied phrasing, not a mechanical template. Be specific — reference actual figures, locations, and ESG frameworks. Flag gaps explicitly, including geographic or sector mismatches. No summary judgement sentences at the end of sections.`;

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
        console.warn("[generate-csr-brief] Groq 429 rate limit hit, retrying", { rateLimitAttempt, waitMs, body: errBody });
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
        `[generate-csr-brief] Groq API error - status: ${groqRes.status} ${groqRes.statusText}, ` +
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
      memo = parseBriefJson(rawText);
    } catch {
      return new Response(JSON.stringify({ error: "Could not parse response.", raw: rawText }), {
        status: 422, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const actionProblems = validateRecommendedAction(memo);
    if (actionProblems.length > 0) {
      console.warn("[generate-csr-brief] recommended_action did not match score band, correcting", {
        title: initiative?.title,
        problems: actionProblems,
        original_action: memo.recommended_action,
        match_score: memo.match_score,
      });
      const corrected = expectedActionForScore(Number(memo.match_score));
      memo.recommended_action = corrected;
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
