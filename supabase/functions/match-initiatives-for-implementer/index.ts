// supabase/functions/match-initiatives-for-implementer/index.ts
// Scores initiatives against an IMPLEMENTER's own profile (peer-to-peer
// initiative discovery), as a sibling to match-initiatives-to-funder rather
// than a modification of it.
//
// v5 (Oct 2026): PROPORTIONAL DD. The DD-readiness cap is gone. The
// callers now attach dd_status / dd_missing / deal_bucket per initiative
// (judged on the poster's checklist against the initiative's own budget);
// this function passes them through and sorts by DD tier, then score.
// Prompt: Africa-focused wording, size-neutral instruction, no DD figure,
// plus the initiative's support types and the poster's yes/no documented
// impact (partner-confirmed claims on Natives).
// v4 (14 Oct 2026): internal-only. Rejects any call that does not carry the
// secret API key (SUPABASE_SECRET_KEYS). Callers: refresh-initiative-matches
// and refresh-initiative-matches-for-org, both send it. Before this it was
// public (verify_jwt false, no check), so anyone could run Groq calls on it.
//
// v2: DETERMINISTIC SCORING, same fix as match-orgs-for-partnership v38 and
// match-initiatives-to-funder v21 before it. The AI previously produced the
// numeric fit_score itself, with only a prompt sentence asking it to keep
// the number consistent with the five criteria badges -- nothing code-
// enforced that, the same unreliable-calculator problem already proven and
// fixed twice elsewhere in this codebase.
//
// The AI now ONLY produces the five criteria badges (sector_fit,
// geography_fit, need_offer_fit, working_style_fit, stage_readiness_fit)
// plus match_reason -- no fit_score, no scoring language in the prompt.
// Score is computed here in code from five weighted criteria (no budget_fit
// here -- unlike match-orgs-for-partnership's two enum budget buckets on
// both sides, an implementer's own profile has no numeric or bucketed
// budget to compare against an initiative's ask, so there is nothing to
// gate on for budget in this matcher):
//   need_offer_fit:      50  (absorbs "complementary fit", which never had
//                              its own badge either -- same treatment as
//                              match-orgs-for-partnership's need_offer_fit)
//   sector_fit:           15
//   geography_fit:        10
//   working_style_fit:    10
//   stage_readiness_fit:  15
// credit: match = full weight, partial = half weight, no_match = zero.
//
// Hard gates: need_offer_fit or geography_fit at no_match caps the score at
// 44 -- one below the 45 inclusion threshold -- regardless of the weighted
// sum, same pattern as match-orgs-for-partnership's gates.
//
// CORRECTION from the original build: the prompt told the AI "geography
// should not count against this initiative" when open_to_remote_partnerships
// is true, but nothing in code enforced that -- it was a request to the
// AI's judgment, not a guarantee. Now forced in code: geography_fit is set
// to "match" for any open_to_remote_partnerships initiative BEFORE scoring
// and gating, so it can never trigger the geography gate and always gets
// full credit, matching match-initiatives-to-funder's real code-level
// override for the same flag.
//
// sanitizeCriteria's fallback for an unparseable/missing AI value changed
// from "no_match" to "partial" -- with hard gates now live, a parsing
// hiccup defaulting to no_match could wrongly fail a genuine match.
//
// DD readiness cap: removed in v5 (see above).

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY")!;

function __envKeys(name: string): Record<string, string> {
  try { return JSON.parse(Deno.env.get(name) ?? "{}"); } catch { return {}; }
}
const __SECRET_KEYS = Object.values(__envKeys("SUPABASE_SECRET_KEYS"));
function isServerCall(req: Request): boolean {
  if (__SECRET_KEYS.length === 0) return false;
  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const apikey = req.headers.get("apikey") ?? "";
  return __SECRET_KEYS.includes(bearer) || __SECRET_KEYS.includes(apikey);
}

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
const INCLUSION_THRESHOLD = 45;
const GATE_CAP = INCLUSION_THRESHOLD - 1;

const CRITERIA_WEIGHTS: Record<string, number> = {
  need_offer_fit: 50,
  sector_fit: 15,
  geography_fit: 10,
  working_style_fit: 10,
  stage_readiness_fit: 15,
};
const GATE_KEYS = ["need_offer_fit", "geography_fit"];

function creditFor(v: string | undefined): number {
  return v === "match" ? 1 : v === "partial" ? 0.5 : 0;
}

function computeDeterministicScore(criteria: Record<string, string>): number {
  let base = 0;
  for (const key of Object.keys(CRITERIA_WEIGHTS)) {
    base += creditFor(criteria[key]) * CRITERIA_WEIGHTS[key];
  }
  let score = Math.round(base);
  for (const gateKey of GATE_KEYS) {
    if (criteria[gateKey] === "no_match") score = Math.min(score, GATE_CAP);
  }
  return score;
}

// Fallback changed from "no_match" to "partial" -- see v2 notes above.
function sanitizeCriteria(raw: any): Record<string, string> | null {
  if (!raw || typeof raw !== "object") return null;
  const out: Record<string, string> = {};
  for (const key of VALID_CRITERIA_KEYS) {
    out[key] = VALID_STATUSES.includes(raw[key]) ? raw[key] : "partial";
  }
  return out;
}

// Same ranking as dd.ts in the refresh functions. Unknown status ranks last.
const DD_RANK: Record<string, number> = { complete: 0, exempt: 0, tier_missing: 1, basics_incomplete: 2 };
function ddRank(status: string | null | undefined): number {
  return status && status in DD_RANK ? DD_RANK[status] : 2;
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
  return text.replace(/[“”]/g, "\"").replace(/[‘’]/g, "'");
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
  return `You are a partnership matching analyst for Impact Natives, a coordination platform for Africa's social impact sector.
Your job: judge the initiatives below against the submitting organisation's own profile -- this is peer-to-peer discovery, not funding evaluation. The submitting org is looking for initiatives it could genuinely contribute to (technical support, co-implementation, shared learning, complementary programming), not necessarily fund. You do NOT compute a numeric score -- that is calculated separately from the ratings you provide below. Your job is ONLY to rate each of five dimensions honestly.

Judge fit on the ask, never on organisation size, age, reach or polish. A small organisation's precise, well-matched initiative is a better fit than a large one's vague or mismatched initiative. Due diligence and compliance are assessed separately in code -- do not let them influence any rating. Each initiative lists the kinds of support it is seeking; use that, do not guess it.

The single most important judgment is need_offer_fit: is there a REAL, LOGICAL correlation between what the submitting org offers/needs and what the initiative is actually asking for (specific_ask, problem, outcome), AND does the submitting org bring something genuinely complementary that the initiative doesn't already have, not duplicated focus. This should dominate your overall impression far more than sector or geography overlap alone.

Be honest and specific: name the exact detail from the initiative's stated need or the submitting org's stated offer that creates or breaks the fit, rather than vague language like "aligns with" or "could support." If the correlation is weak, rate need_offer_fit low -- do not rate it "match" for organisations that merely operate in the same country or broad sector.

Watch specifically for this failure pattern: describing an initiative and the submitting org as similar because they share an abstract theme (e.g. both "community-based," both "youth-focused," both "impact-driven") when their actual needs, offers, and specific asks have no real overlap. If you catch yourself writing a rationale that could apply to almost any pairing, need_offer_fit should be "no_match", not "partial" or "match".

If an initiative's stated ask is incoherent or nonsensical, rate need_offer_fit "no_match" regardless of sector or SDG overlap.

Produce a "criteria" object rating five specific dimensions individually, each as exactly "match", "partial", or "no_match":
- sector_fit: does the initiative's sector genuinely overlap the submitting org's?
- geography_fit: does the initiative's location overlap the submitting org's? (Note: if an initiative is marked open to remote/virtual partnerships, geography is forced to "match" in code regardless of what you say here -- rate it honestly anyway so match_reason doesn't awkwardly cite a gap that isn't real, but don't let a geography mismatch drag down your read of the other dimensions for a remote-friendly initiative.)
- need_offer_fit: as described above -- the dominant judgment.
- working_style_fit: are stated working-style/collaboration preferences compatible?
- stage_readiness_fit: is the initiative's own stated stage a workable match for what the submitting org can realistically contribute right now?
Do not rate several dimensions "match" while your match_reason describes a weak or superficial pairing, or vice versa -- the ratings and match_reason must tell the same story.

The "match_reason" field must contain ONLY natural, customer-facing prose -- exactly 1-2 sentences, no more than 30 words total. NEVER include scoring breakdown or point allocations. NEVER hedge with phrases like "requires further examination" -- state the fit plainly, in either direction.

Use only straight double quotes (\") for all JSON strings -- never curly or typographic quotes.

Do all your reasoning silently. Output EXACTLY ONE entry per initiative id -- every initiative listed below, regardless of how strong or weak the fit looks -- never output the same id twice, never show a correction as a second entry, never include a // comment or any text outside the JSON object.

Return ONLY a valid JSON object. No markdown, no backticks, no explanation, no comments, no duplicate keys, no placeholder values. Every object in the matches array must have exactly these keys: id, match_reason, criteria. No fit_score field -- it is not your job to produce one.

{
  "matches": [
    {
      "id": "<initiative id>",
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
Support sought: ${Array.isArray(ini.partnerships) && ini.partnerships.length ? ini.partnerships.join(", ") : "Not specified"}
Sectors: ${Array.isArray(ini.sectors) ? ini.sectors.join(", ") : ini.sectors || "Not provided"}
Locations: ${Array.isArray(ini.locations) ? ini.locations.join(", ") : ini.locations || "Not provided"}
Open to remote/virtual partnerships: ${ini.open_to_remote_partnerships ? "Yes" : "No"}
Stage: ${ini.stage || "Not provided"}
SDG tags: ${Array.isArray(ini.sdg_tags) ? ini.sdg_tags.join(", ") : "Not provided"}
Target population: ${ini.target_population || "Not provided"}
Posting organisation's documented impact on Natives (partner-confirmed): ${ini.documented_impact ? "Yes" : "No (not a gap, just no confirmed record yet)"}`).join("\n")}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (!isServerCall(req)) return new Response(JSON.stringify({ error: "Forbidden" }), {
    status: 403, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
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
      if (!m || !m.criteria) continue;
      const ini = candidates.find((c: any) => c.id === m.id);
      if (!ini) continue;
      const aiCriteria = sanitizeCriteria(m.criteria);
      if (!aiCriteria) continue;
      // Code-level override: an initiative that says it's open to remote
      // partnerships gets geography forced to "match" here, not left to the
      // AI's discretion (see v2 notes -- the old prompt-only version of this
      // was never actually enforced).
      const fullCriteria = ini.open_to_remote_partnerships
        ? { ...aiCriteria, geography_fit: "match" }
        : aiCriteria;
      const score = computeDeterministicScore(fullCriteria);
      if (score < INCLUSION_THRESHOLD) continue;
      byId.set(m.id, {
        id: m.id,
        score,
        match_reason: m.match_reason,
        criteria: fullCriteria,
        dd_status: ini.dd_status ?? null,
        dd_missing: ini.dd_missing ?? [],
        deal_bucket: ini.deal_bucket ?? null,
      });
    }

    // DD tier first, then score.
    const matches = Array.from(byId.values()).sort((a, b) => (ddRank(a.dd_status) - ddRank(b.dd_status)) || (b.score - a.score));
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
