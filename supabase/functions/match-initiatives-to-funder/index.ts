// supabase/functions/match-initiatives-to-funder/index.ts
// Matches initiatives against a funder/corporate mandate.
//
// v21: SCORE IS NOW COMPUTED IN CODE, NOT BY THE MODEL. Previously the
// model produced both the "criteria" object (sector_fit, geography_fit,
// etc.) AND a free-form numeric "score," with only a prompt instruction
// ("the criteria ratings must be consistent with the score") holding the
// two together. Nothing enforced that consistency -- confirmed live, the
// identical initiative/mandate pair scored 78 one pass and 85 the next,
// with two entirely different match_reason strings, despite unchanged
// underlying data. The model is good at judging individual dimensions; it
// is not a reliable calculator for turning five judgments into one
// trustworthy percentage.
//
// Fix: the model now ONLY produces "criteria" (match/partial/no_match per
// dimension) and "match_reason" -- no score. The score is computed here in
// code from four weighted criteria (this file no longer asks the model
// for "dd_fit" either -- see below):
//   Funder:    sector 35 / geography 25 / budget 25 / stage 15
//   Corporate: sector 30 / esg 30 / geography 20 / support_type 20
// Credit: match = full weight, partial = half weight, no_match = zero.
// Hard caps applied AFTER the weighted sum (worst applicable cap wins):
//   - geography_fit "no_match"                    -> capped below the
//     org-type's inclusion threshold (39 funder / 34 corporate)
//   - budget_fit "no_match" (funder) or
//     support_type_fit "no_match" (corporate)      -> same cap
//   - DD readiness below 40%                       -> capped at 40
//   - DD readiness 40-59%                          -> capped at 65
//   - DD readiness 60%+                            -> no cap
//
// DD READINESS IS NO LONGER JUDGED BY THE MODEL AT ALL. It was previously
// a 5th criterion the model self-reported ("dd_fit"), sourced from a real
// number (dd_readiness_score) we already compute server-side from actual
// boolean fields -- there was never a reason to let the model estimate
// something we already know exactly. dd_fit is now derived here in code
// from the real dd_readiness_score and written directly into the returned
// criteria object, so the UI checklist and the score are guaranteed to
// agree (previously these could theoretically disagree, since one came
// from the model's own classification and the other from a separate
// prompt-level cap instruction).
//
// GEOGRAPHY OVERRIDE FOR REMOTE-FRIENDLY INITIATIVES: initiatives can now
// be marked open_to_remote_partnerships (new column, set by the submitting
// org). When true, geography_fit is forced to "match" in code regardless
// of what the model said -- an initiative that's explicitly said it can
// work with a partner/funder anywhere shouldn't be penalised for the
// funder/corporate being in a different region. The model is still told
// about this flag so match_reason doesn't awkwardly cite a geographic gap
// that isn't actually a gap.
//
// The model is asked to return one entry per initiative regardless of
// apparent fit -- there is no model-side score threshold to gate on
// anymore, so there's no reason for it to omit anything. Inclusion (score
// >= minScore) is still decided by the calling refresh functions, now
// against a trustworthy number.
//
// v20: MAX_RATE_LIMIT_RETRIES lowered 2 -> 1, MAX_BACKOFF_SECONDS lowered
// 25 -> 15 (unchanged this version).
//
// v19: retry logic broadened from "429 only" to "429 OR any 5xx".
// v18: model swapped llama-3.1-8b-instant -> openai/gpt-oss-120b.
// v14: budget_overlap_pct replaced with budget_fit (match/partial/no_match).

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VALID_STATUSES = ["match", "partial", "no_match"];
const MAX_RATE_LIMIT_RETRIES = 1;
const MAX_BACKOFF_SECONDS = 15;
const GENERIC_ERROR_BACKOFF_SECONDS = 3;

// Must match the minScore values used by refresh-initiative-matches and
// refresh-initiative-matches-for-org -- these are the "push below the
// inclusion bar" targets for a hard-fail criterion, not independent
// policy. If those callers' minScore ever changes, update here too.
const MIN_SCORE_FUNDER = 40;
const MIN_SCORE_CORPORATE = 35;

function sanitizeCriteria(raw: any, isFunder: boolean): Record<string, string> | null {
  if (!raw || typeof raw !== "object") return null;
  // dd_fit deliberately excluded here -- it's derived from the real
  // dd_readiness_score in code, never asked of the model.
  const keys = isFunder
    ? ["sector_fit", "geography_fit", "stage_fit", "budget_fit"]
    : ["sector_fit", "geography_fit", "esg_fit", "support_type_fit"];
  const out: Record<string, string> = {};
  for (const key of keys) {
    out[key] = VALID_STATUSES.includes(raw[key]) ? raw[key] : "no_match";
  }
  return out;
}

// DD readiness is a real, already-computed percentage (0-100) -- no model
// judgment involved, so this is a plain threshold, not a criterion.
function ddBucket(ddReadinessScore: number | undefined): "match" | "partial" | "no_match" {
  const s = ddReadinessScore ?? 0;
  if (s >= 60) return "match";
  if (s >= 40) return "partial";
  return "no_match";
}

function computeScore(criteria: Record<string, string>, isFunder: boolean): number {
  const credit = (v: string | undefined) => v === "match" ? 1 : v === "partial" ? 0.5 : 0;

  const base = isFunder
    ? credit(criteria.sector_fit) * 35
    + credit(criteria.geography_fit) * 25
    + credit(criteria.budget_fit) * 25
    + credit(criteria.stage_fit) * 15
    : credit(criteria.sector_fit) * 30
    + credit(criteria.esg_fit) * 30
    + credit(criteria.geography_fit) * 20
    + credit(criteria.support_type_fit) * 20;

  const rounded = Math.round(base);
  const minScore = isFunder ? MIN_SCORE_FUNDER : MIN_SCORE_CORPORATE;

  const caps: number[] = [];
  if (criteria.geography_fit === "no_match") caps.push(minScore - 1);
  if (isFunder && criteria.budget_fit === "no_match") caps.push(minScore - 1);
  if (!isFunder && criteria.support_type_fit === "no_match") caps.push(minScore - 1);
  if (criteria.dd_fit === "no_match") caps.push(40);
  else if (criteria.dd_fit === "partial") caps.push(65);

  return caps.length > 0 ? Math.min(rounded, ...caps) : rounded;
}

function normalizeSmartQuotes(text: string): string {
  return text
    .replace(/[\u201C\u201D]/g, "\"")
    .replace(/[\u2018\u2019]/g, "'");
}

function parseRankedJson(rawText: string): any[] {
  let clean = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
  clean = normalizeSmartQuotes(clean);
  clean = clean.replace(/\/\/[^\n]*/g, "");
  clean = clean.replace(/}\s*{/g, "},{");

  function dedupeById(arr: any[]): any[] {
    const byId = new Map<string, any>();
    for (const item of arr) {
      if (item && typeof item.id === "string") byId.set(item.id, item);
    }
    return Array.from(byId.values());
  }

  try {
    return dedupeById(JSON.parse(clean));
  } catch {
    const lastCompleteObjEnd = clean.lastIndexOf("}");
    if (lastCompleteObjEnd === -1) throw new Error("No complete objects in response");
    const salvaged = clean.slice(0, lastCompleteObjEnd + 1) + "]";
    return dedupeById(JSON.parse(salvaged));
  }
}

function truncate(text: string | null | undefined, maxChars: number): string {
  if (!text) return "Not provided";
  return text.length > maxChars ? text.slice(0, maxChars).trim() + "\u2026" : text;
}

function extractRetrySeconds(status: number, headerValue: string | null, bodyText: string): number {
  if (status === 429) {
    if (headerValue) {
      const parsed = parseFloat(headerValue);
      if (!isNaN(parsed)) return Math.min(parsed, MAX_BACKOFF_SECONDS);
    }
    const match = bodyText.match(/try again in ([\d.]+)s/i);
    if (match) return Math.min(parseFloat(match[1]), MAX_BACKOFF_SECONDS);
    return MAX_BACKOFF_SECONDS;
  }
  return GENERIC_ERROR_BACKOFF_SECONDS;
}

async function callGroqWithBackoff(prompt: string): Promise<{ ok: boolean; rawText?: string; errorBody?: string }> {
  for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt++) {
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        max_completion_tokens: 4000,
        reasoning_effort: "low",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (groqRes.ok) {
      const groqData = await groqRes.json();
      return { ok: true, rawText: groqData.choices?.[0]?.message?.content ?? "" };
    }

    const errBody = await groqRes.text();
    console.error(
      `[match-initiatives-to-funder] Groq API error (attempt ${attempt + 1}/${MAX_RATE_LIMIT_RETRIES + 1}) - status: ${groqRes.status} ${groqRes.statusText}, ` +
      `remaining-tokens: ${groqRes.headers.get("x-ratelimit-remaining-tokens")}, ` +
      `remaining-requests: ${groqRes.headers.get("x-ratelimit-remaining-requests")}, ` +
      `reset-tokens: ${groqRes.headers.get("x-ratelimit-reset-tokens")}, ` +
      `retry-after: ${groqRes.headers.get("retry-after")}, body: ${errBody}`
    );

    const isRetryable = groqRes.status === 429 || groqRes.status >= 500;
    if (isRetryable && attempt < MAX_RATE_LIMIT_RETRIES) {
      const waitSeconds = extractRetrySeconds(groqRes.status, groqRes.headers.get("retry-after"), errBody);
      await new Promise(resolve => setTimeout(resolve, waitSeconds * 1000));
      continue;
    }

    return { ok: false, errorBody: errBody };
  }
  return { ok: false, errorBody: "Exhausted retries" };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });

  try {
    const { mandate, initiatives } = await req.json();

    if (!mandate || !initiatives?.length) return new Response(
      JSON.stringify({ error: "mandate and initiatives are required" }),
      { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );

    const FUNDER_TYPES = ["philanthropic_foundation", "venture_capital"];
    const isFunder = FUNDER_TYPES.includes(mandate.org_type);

    function looksLikePlaceholder(text: string | null | undefined): boolean {
      if (!text) return false;
      const t = text.toLowerCase().trim();
      return ["lorem ipsum", "test test", "asdf", "qwerty", "xxxxx", "placeholder", "n/a", "sample text", "dummy text", "todo"]
        .some(p => t.includes(p));
    }

    const grantMin = mandate.grant_range_min ?? null;
    const grantMax = mandate.grant_range_max ?? null;

    const initiativesById = new Map(initiatives.map((ini: any) => [ini.id, ini]));

    const initiativeBlocks = initiatives
      .filter((ini: any) => !looksLikePlaceholder(ini.problem) && !looksLikePlaceholder(ini.title))
      .map((ini: any) => `---
ID: ${ini.id}
Title: ${ini.title}
Problem: ${truncate(ini.problem, 160)}
Outcome: ${truncate(ini.outcome, 120)}
Sectors: ${Array.isArray(ini.sectors) ? ini.sectors.join(", ") : ini.sectors || "Not provided"}
Locations: ${Array.isArray(ini.locations) ? ini.locations.join(", ") : ini.locations || "Not provided"}
Open to remote/virtual partnerships: ${ini.open_to_remote_partnerships ? "Yes -- geography should not count against this initiative" : "No"}
Stage: ${ini.stage || "Not provided"}
Budget: ${ini.budget_min || ini.budget_max ? `${ini.budget_min ?? "?"} - ${ini.budget_max ?? "?"} ${ini.budget_currency || ""}` : (ini.budget || "Not provided")}
SDG tags: ${Array.isArray(ini.sdg_tags) ? ini.sdg_tags.join(", ") : "Not provided"}
Target population: ${truncate(ini.target_population, 80)}`)
      .join("\n");

    const criteriaInstructions = isFunder
      ? `Produce a "criteria" object with these fields, each exactly "match", "partial", or "no_match" — never a percentage, never a score:
- sector_fit: does the initiative's sector genuinely overlap the mandate's sector focus?
- geography_fit: does the initiative's location overlap the mandate's geographic focus? If the initiative is marked open to remote/virtual partnerships, this must be "match" regardless of location.
- stage_fit: is the initiative's stage in the mandate's stated stage preference?
- budget_fit: does the initiative's budget range fall within the mandate's grant/investment range? "match" if fully within, "partial" if it overlaps but extends beyond the range, "no_match" if entirely outside.
Format: "criteria": { "sector_fit": "match", "geography_fit": "partial", "stage_fit": "match", "budget_fit": "match" }`
      : `Produce a "criteria" object with these fields, each exactly "match", "partial", or "no_match":
- sector_fit: does the initiative's sector genuinely overlap the mandate's sector focus?
- geography_fit: does the initiative's location overlap the mandate's geographic focus? If the initiative is marked open to remote/virtual partnerships, this must be "match" regardless of location.
- esg_fit: does the initiative's theme align with the mandate's CSR/ESG focus statement (the primary signal) or its named ESG frameworks? A thematic match to the focus statement counts even if no framework is listed.
- support_type_fit: does what the initiative is asking for match the type of support the mandate offers (funding, in-kind, technical)?
Format: "criteria": { "sector_fit": "match", "geography_fit": "partial", "esg_fit": "match", "support_type_fit": "no_match" }`;

    const prompt = `You are an impact investment analyst helping a funder identify the best initiatives to fund from a marketplace.

Funder mandate:
${mandate.investment_thesis ? `- Investment thesis: "${truncate(mandate.investment_thesis, 200)}"` : "- Investment thesis: Not specified"}
- Organisation type: ${mandate.org_type ?? "Not specified"}
- Funding instruments: ${mandate.funding_instruments?.join(", ") || "Not specified"}
- Grant/investment range: ${mandate.grant_currency ?? "USD"} ${grantMin?.toLocaleString() ?? "?"} – ${grantMax?.toLocaleString() ?? "?"}
- Stage preference: ${mandate.stage_preference?.join(", ") || "Not specified"}
- Geographic focus: ${mandate.geographic_focus?.join(", ") || "Pan-Africa"}
- Sector focus: ${mandate.mandate_sectors?.join(", ") || "Not specified"}
- SDG priorities: ${mandate.mandate_sdgs?.join(", ") || "Not specified"}
${!isFunder ? `- CSR/ESG focus: ${mandate.csr_focus_statement ? `"${truncate(mandate.csr_focus_statement, 200)}"` : "Not specified"}
- ESG frameworks: ${mandate.esg_frameworks?.join(", ") || "Not specified"}
- CSR budget range: ${mandate.csr_budget_range || "Not specified"}` : ""}

Initiatives to assess:
${initiativeBlocks}

Judge each criterion on its own evidence — do not let a strong result on one field soften your honest read of another. A blank mandate field is not evidence of compatibility; rate conservatively when key fields are missing.

AVOID GENERIC REASONING: no language that could apply to any initiative (e.g. "aligns with impact focus"). Name a specific, concrete overlap — sector, budget fit, stage match, or a named SDG — in match_reason, or say plainly what's missing.

No hedging ("could potentially," "may be worth considering") — state the fit plainly.

Keep each match_reason under 20 words, one clause, no compound sentences.

${criteriaInstructions}

Do all your reasoning silently. Output EXACTLY ONE entry per initiative ID — every initiative listed above, regardless of how strong or weak the fit looks. Never omit one, never output the same ID twice, never show a correction or revision as a second entry, never include a // comment or any text outside the JSON array.

Use only straight double quotes (\") for all JSON strings — never curly or typographic quotes.

Return ONLY a valid JSON array, no markdown, no backticks, no explanation, no comments, no duplicate ids, and no "score" field — scoring is handled separately:
[
  { "id": "initiative_id", "match_reason": "Short, specific reason.", "criteria": { ... as specified above ... } }
]`;

    const groqResult = await callGroqWithBackoff(prompt);

    if (!groqResult.ok) {
      return new Response(JSON.stringify({ error: `Groq API error: ${groqResult.errorBody}` }), {
        status: 502, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    let ranked: any[];
    try {
      ranked = parseRankedJson(groqResult.rawText ?? "");
    } catch {
      return new Response(JSON.stringify({ error: "Could not parse response.", raw: groqResult.rawText }), {
        status: 422, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    // Attach dd_fit (from the real dd_readiness_score, never the model),
    // apply the remote-friendly geography override, then compute the
    // score deterministically. Entries whose criteria genuinely couldn't
    // be parsed are dropped rather than scored on invented no_match
    // values -- there's no reliable basis to score them at all.
    const scored = ranked
      .map(r => {
        const criteria = sanitizeCriteria(r.criteria, isFunder);
        if (!criteria) {
          console.error(`[match-initiatives-to-funder] dropping id ${r.id}: criteria unparseable`);
          return null;
        }
        const ini: any = initiativesById.get(r.id);
        criteria.dd_fit = ddBucket(ini?.dd_readiness_score);
        if (ini?.open_to_remote_partnerships) criteria.geography_fit = "match";
        const score = computeScore(criteria, isFunder);
        return { id: r.id, match_reason: r.match_reason, criteria, score };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    return new Response(JSON.stringify({ data: scored }), {
      status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });

  } catch (err) {
    console.error(`[match-initiatives-to-funder] Uncaught exception: ${String(err)}`);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
});