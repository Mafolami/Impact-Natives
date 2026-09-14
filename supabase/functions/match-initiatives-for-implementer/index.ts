// supabase/functions/match-initiatives-for-implementer/index.ts
// Scores initiatives against an IMPLEMENTER's own profile (peer-to-peer
// initiative discovery), as a sibling to match-initiatives-to-funder rather
// than a modification of it -- that function's scoring is funder/corporate
// specific by design (budget_fit / esg_fit / support_type_fit, weighted in
// code), and bolting a third org-type branch onto it would mean carrying
// funder-only fields (grant_range_min, csr_budget_range) into a codepath
// that has no equivalent for an implementer. match-initiatives-to-funder is
// NOT touched by this change; funder/corporate scoring behavior is
// unaffected.
//
// Reuses the five-criteria model that match-orgs-for-partnership already
// uses for org-to-org matching (sector_fit, geography_fit, need_offer_fit,
// working_style_fit, stage_readiness_fit), applied here to org-to-initiative
// instead. Chosen specifically because that model has no org-type
// assumptions baked in anywhere -- it already generalizes across funder,
// corporate, and implementer viewers without per-type weight tuning, which
// is exactly the property match-initiatives-to-funder's fixed-weight-per-
// type formula does not have. The AI produces the fit score holistically
// (see buildPrompt) rather than a hardcoded weighted sum -- same reasoning
// as match-orgs-for-partnership: a formula that has to be re-derived for
// every new viewer type doesn't scale, and the five criteria already
// double as the customer-facing "why" breakdown.
//
// DD readiness cap: mirrors match-orgs-for-partnership's applyDdCap exactly
// (below 40% -> capped at 40, 40-59% -> capped at 65, 60%+ -> no cap),
// applied to the initiative's submitting org's dd_readiness_score (already
// computed and attached by the caller, same attachDD() helper
// refresh-initiative-matches already uses for the funder/corporate path).

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
};

const VALID_CRITERIA_KEYS = ["sector_fit", "geography_fit", "need_offer_fit", "working_style_fit", "stage_readiness_fit"];
const VALID_STATUSES = ["match", "partial", "no_match"];
const BATCH_SIZE = 15;
const MAX_RATE_LIMIT_RETRIES = 1;
const MAX_BACKOFF_SECONDS = 5;
const GENERIC_ERROR_BACKOFF_SECONDS = 3;
const INCLUSION_THRESHOLD = 45; // same bar as match-orgs-for-partnership's bulk mode

function sanitizeCriteria(raw: any): Record<string, string> | null {
  if (!raw || typeof raw !== "object") return null;
  const out: Record<string, string> = {};
  for (const key of VALID_CRITERIA_KEYS) {
    out[key] = VALID_STATUSES.includes(raw[key]) ? raw[key] : "no_match";
  }
  return out;
}

function applyDdCap(fitScore: number, ddReadinessScore: number | undefined): number {
  const pct = ddReadinessScore ?? 0;
  if (pct < 40) return Math.min(fitScore, 40);
  if (pct < 60) return Math.min(fitScore, 65);
  return fitScore;
}

function formatSectorDisplay(raw: any): string {
  if (Array.isArray(raw)) return raw.filter(Boolean).join(", ");
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter(Boolean).join(", ");
      if (typeof parsed === "string" && parsed.trim()) return parsed;
    } catch {
      return raw;
    }
  }
  return "";
}

function normalizeSmartQuotes(text: string): string {
  return text.replace(/[\u201C\u201D]/g, "\"").replace(/[\u2018\u2019]/g, "'");
}

function parseMatchesJson(rawText: string): any {
  let clean = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
  clean = normalizeSmartQuotes(clean);
  clean = clean.replace(/\/\/[^\n]*/g, "").replace(/}\s*{/g, "},{");
  try {
    return JSON.parse(clean);
  } catch {
    const lastCompleteObjEnd = clean.lastIndexOf("}");
    if (lastCompleteObjEnd === -1) throw new Error("No complete objects in response");
    const salvaged = clean.slice(0, lastCompleteObjEnd + 1) + "]}";
    return JSON.parse(salvaged);
  }
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function looksLikePlaceholder(text: string | null | undefined): boolean {
  if (!text) return false;
  const t = text.toLowerCase().trim();
  return ["lorem ipsum", "test test", "asdf", "qwerty", "xxxxx", "placeholder", "n/a", "sample text", "dummy text", "todo"]
    .some(p => t.includes(p));
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

async function callGroqWithBackoff(prompt: string, maxTokens: number, logLabel: string): Promise<{ ok: boolean; rawText?: string; errorBody?: string }> {
  for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt++) {
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_API_KEY}` },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        max_completion_tokens: maxTokens,
        reasoning_effort: "low",
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (groqRes.ok) {
      const groqData = await groqRes.json();
      return { ok: true, rawText: groqData.choices?.[0]?.message?.content ?? "" };
    }
    const errBody = await groqRes.text();
    console.error(`[match-initiatives-for-implementer] ${logLabel} Groq API error (attempt ${attempt + 1}/${MAX_RATE_LIMIT_RETRIES + 1}) - status: ${groqRes.status}, body: ${errBody}`);
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

function buildPrompt(submitting_org: any, initiativesSubset: any[]): string {
  return `You are a partnership matching analyst for Impact Natives, a social impact platform focused on UK-Africa collaborations.
Your job: rank the initiatives below by REAL, LOGICAL fit with the submitting organisation's own profile -- this is peer-to-peer discovery, not funding evaluation. The submitting org is looking for initiatives it could genuinely contribute to (technical support, co-implementation, shared learning, complementary programming), not necessarily fund.

Scoring criteria (total 100):
- Logical correlation between what the submitting org offers/needs and what the initiative is actually asking for (specific_ask, problem, outcome): 45 points
- Complementary fit -- the submitting org brings something the initiative doesn't already have, not duplicated focus: 20 points
- Practical compatibility -- geography, stage, working style, using the initiative's own stated fields: 20 points
- Sector or SDG relevance to the initiative's actual work: 15 points (this alone is never enough to justify a strong match -- shared sector or SDG tags without genuine complementary capability should not push a score above 50)

Be honest and specific in the rationale: name the exact detail from the initiative's stated need or the submitting org's stated offer that creates the fit, rather than vague language like "aligns with" or "could support." If the correlation is weak, score it low -- do not inflate scores for organisations that merely operate in the same country or broad sector.

Watch specifically for this failure pattern: describing an initiative and the submitting org as similar because they share an abstract theme (e.g. both "community-based," both "youth-focused," both "impact-driven") when their actual needs, offers, and specific asks have no real overlap. If you catch yourself writing a rationale that could apply to almost any pairing, the real fit_score is below 45 and the initiative should be excluded.

Work through the scoring criteria internally to arrive at your fit_score, but the "match_reason" field must contain ONLY natural, customer-facing prose -- exactly 1-2 sentences, no more than 30 words total. NEVER include scoring breakdown or point allocations. NEVER hedge with phrases like "requires further examination" -- state the fit plainly or score it low.

If an initiative's stated ask is incoherent or nonsensical, you MUST score it below 45 regardless of sector or SDG overlap.

Every initiative must get its OWN distinct fit_score reflecting its OWN specific mix of matching and failing criteria -- do not default to a single common value across multiple initiatives.

ALSO produce a "criteria" object rating five specific dimensions individually, each as exactly "match", "partial", or "no_match":
- sector_fit, geography_fit, need_offer_fit, working_style_fit, stage_readiness_fit
These five ratings must be consistent with the fit_score -- do not rate several "match" and then produce a low fit_score, or vice versa.

Use only straight double quotes (") for all JSON strings -- never curly or typographic quotes.

Do all your reasoning silently. Output EXACTLY ONE entry per initiative id -- never output the same id twice, never show a correction as a second entry, never include a // comment or any text outside the JSON object.

Return ONLY a valid JSON object. No markdown, no backticks, no explanation, no comments, no duplicate keys, no placeholder values. If you are uncertain about an initiative, simply exclude it from the matches array. Include every initiative with fit_score >= 45, no maximum. Every object in the matches array must have exactly these keys: id, fit_score, match_reason, criteria. Order by fit_score descending.

{
  "matches": [
    {
      "id": "<initiative id>",
      "fit_score": <integer 0-100>,
      "match_reason": "<1-2 short sentences, max 30 words>",
      "criteria": { "sector_fit": "match", "geography_fit": "partial", "need_offer_fit": "match", "working_style_fit": "partial", "stage_readiness_fit": "match" }
    }
  ]
}

Submitting organisation:
Name: ${submitting_org.organisation_name}
Type: ${submitting_org.organisation_type}
Description: ${submitting_org.description || "Not provided"}
Sectors: ${formatSectorDisplay(submitting_org.sector) || "Not provided"}
Countries: ${Array.isArray(submitting_org.country) ? submitting_org.country.join(", ") : submitting_org.country || "Not provided"}
Needs: ${Array.isArray(submitting_org.needs) ? submitting_org.needs.join(", ") : "Not provided"}
Offers: ${Array.isArray(submitting_org.offers) ? submitting_org.offers.join(", ") : "Not provided"}
SDGs: ${Array.isArray(submitting_org.mandate_sdgs) && submitting_org.mandate_sdgs.length > 0 ? submitting_org.mandate_sdgs.join(", ") : "Not provided"}

Initiatives to assess:
${initiativesSubset.map((ini: any) => `---
ID: ${ini.id}
Title: ${ini.title}
Problem: ${ini.problem || "Not provided"}
Outcome: ${ini.outcome || "Not provided"}
Specific ask: ${ini.specific_ask || "Not provided"}
Sectors: ${Array.isArray(ini.sectors) ? ini.sectors.join(", ") : ini.sectors || "Not provided"}
Locations: ${Array.isArray(ini.locations) ? ini.locations.join(", ") : ini.locations || "Not provided"}
Open to remote/virtual partnerships: ${ini.open_to_remote_partnerships ? "Yes -- geography should not count against this initiative" : "No"}
Stage: ${ini.stage || "Not provided"}
SDG tags: ${Array.isArray(ini.sdg_tags) ? ini.sdg_tags.join(", ") : "Not provided"}
Target population: ${ini.target_population || "Not provided"}
Due diligence readiness (submitting org, not scored -- context only): ${ini.dd_readiness_score ?? 0}%`).join("\n")}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });

  try {
    const { submitting_org, initiatives } = await req.json();
    if (!submitting_org) return new Response(JSON.stringify({ error: "submitting_org is required" }), {
      status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
    if (!initiatives?.length) return new Response(JSON.stringify({ matches: [] }), {
      status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });

    const candidates = initiatives.filter((ini: any) => {
      if (!ini.specific_ask && !ini.problem) return false;
      if (looksLikePlaceholder(ini.specific_ask) && looksLikePlaceholder(ini.problem)) return false;
      return true;
    });

    if (candidates.length === 0) {
      return new Response(JSON.stringify({ matches: [] }), {
        status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const byId = new Map<string, any>();
    const batches = chunk(candidates, BATCH_SIZE);

    const batchResults = await Promise.all(batches.map(async (batchCandidates, b) => {
      const prompt = buildPrompt(submitting_org, batchCandidates);
      const result = await callGroqWithBackoff(prompt, 2500, `batch ${b + 1}/${batches.length}`);
      if (!result.ok) {
        console.error(`[match-initiatives-for-implementer] batch ${b + 1}/${batches.length} failed: ${result.errorBody}`);
        return [];
      }
      try {
        const parsed = parseMatchesJson(result.rawText ?? "");
        return parsed.matches ?? [];
      } catch {
        console.error(`[match-initiatives-for-implementer] batch ${b + 1}/${batches.length} unparseable`);
        return [];
      }
    }));

    for (const m of batchResults.flat()) {
      if (!m || typeof m.fit_score !== "number") continue;
      const ini = candidates.find((c: any) => c.id === m.id);
      if (!ini) continue;
      const cappedScore = applyDdCap(m.fit_score, ini.dd_readiness_score);
      if (cappedScore < INCLUSION_THRESHOLD) continue;
      byId.set(m.id, {
        id: m.id,
        score: cappedScore,
        match_reason: m.match_reason,
        criteria: sanitizeCriteria(m.criteria),
      });
    }

    const matches = Array.from(byId.values()).sort((a, b) => b.score - a.score);
    return new Response(JSON.stringify({ data: matches }), {
      status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });

  } catch (err) {
    console.error(`[match-initiatives-for-implementer] Uncaught exception: ${String(err)}`);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
});
