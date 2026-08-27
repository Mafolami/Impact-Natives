// supabase/functions/match-orgs-for-partnership/index.ts
// Matches a submitting org against organisations that have an active posted
// partnership request (partnership_listed + partnership_sought).
//
// v34: added a dedicated CONSULTANCY candidate type. Previously any org
// with organisation_type = "consultancy" fell through to the IMPLEMENTER
// branch by default (isImplementerType = !isFunderType && !isCorporateType),
// showing "Beneficiaries reached: Not provided. Due diligence readiness:
// 0/9" for every one of them -- looking uniformly unready compared to real
// implementers, since a solo consultancy structurally has none of the 9 DD
// items (audited accounts, board governance, etc. -- see the DD Readiness
// skip in DashboardProfile.tsx for is_solo_consultancy orgs). Added a
// dedicated branch reading the new specializations/notable_engagements/
// affiliations columns instead, and added those 3 columns to the candidate
// select(). Explicitly tells the model institutional DD criteria don't
// apply here, so it isn't scored as a gap.
//
// v33: flagged_visibility_hold candidates excluded from the pool. A
// "Serious"-severity flagged org (set via the admin Flagged Orgs review)
// was already withheld from the public Natives directory but still
// surfaced here as a partnership candidate to everyone else -- this is
// the candidate-side half of closing that gap (the self-exclusion half
// lives in refresh-partnership-matches / refresh-partnership-matches-for-
// org / score-partnership-fit, which decide whether a held org gets
// matches computed for itself at all). Single-pair mode (used by
// score-partnership-fit) reuses this same candidateQuery with an added
// .eq("id", target_org_id), so this filter covers that path too with no
// separate change needed there.
//
// v31: added funder/corporate DD readiness to the candidate prompt block.
// The new funder/corporate DD checklist (fdd_* columns) existed on the
// org table but was invisible to matching -- funder/corporate candidates
// only ever showed mandate fields (investment thesis, CSR focus, budget),
// same as implementers now show "Due diligence readiness: X/9", funder
// and corporate candidates now show "Due diligence readiness: X/6" from
// the same fdd_disbursement_track_record / fdd_decision_transparency /
// fdd_conflict_disclosure / fdd_governance_doc / fdd_esg_framework /
// fdd_legal_registration fields used everywhere else in the app. Added
// the 6 missing columns to the candidate select() -- none of them were
// fetched before this.
//
// v30: fixed stale implementer DD score in the candidate prompt block.
// Was hardcoded to 5 fields (dd_financial_model, dd_audited_accounts,
// dd_governance_doc, dd_esg_assessment, dd_impact_framework) and shown as
// "X/5" -- a leftover from before Environmental policy, Safeguarding
// policy, Legal registration, and Legal & compliance declaration were
// added to the implementer DD checklist (now 9 items total). This meant
// the matching model has been silently seeing an incomplete, out-of-date
// DD signal for every implementer candidate. Fixed to read and score all
// 9 current fields, matching DD_ITEMS in ddItems.ts and every other DD
// score computation in the app (DashboardProfile.tsx, DashboardNatives.tsx,
// DashboardMarketplace.tsx). Also added the 4 missing columns to the
// candidate select() -- they were never fetched at all, so the old 5-field
// score wasn't just capped low, it was working off objectively incomplete
// data. Found while scoping funder/corporate DD's downstream effects; not
// related to that work, just surfaced by the same audit.
//
// v29: formatSectorDisplay() added -- submitting_org.sector and each
// candidate's c.sector were read directly into the prompt with only an
// Array.isArray check, no JSON parsing. organizations.sector is a
// JSON-stringified TEXT column (e.g. the literal string '["Health"]'), not
// a real array, so the fallback branch put the raw string straight into
// the prompt: "Sectors: [\"Health\"]" instead of "Sectors: Health". Milder
// than the initiative-side mandate_sectors bug (refresh-initiative-matches
// v19) since this doesn't corrupt any cached data -- the model likely
// still inferred "Health" from context -- but it's the same root data
// issue and worth cleaning up on the same pass.
//
// v28-v27: see prior deploy history.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
};

const VALID_CRITERIA_KEYS = ["sector_fit", "geography_fit", "need_offer_fit", "working_style_fit", "stage_readiness_fit"];
const VALID_STATUSES = ["match", "partial", "no_match"];
const BATCH_SIZE = 15;
const FETCH_SAFETY_CAP = 300;
const MAX_RATE_LIMIT_RETRIES = 1;
const MAX_BACKOFF_SECONDS = 15;
const GENERIC_ERROR_BACKOFF_SECONDS = 3;

function sanitizeCriteria(raw: any): Record<string, string> | null {
  if (!raw || typeof raw !== "object") return null;
  const out: Record<string, string> = {};
  for (const key of VALID_CRITERIA_KEYS) {
    out[key] = VALID_STATUSES.includes(raw[key]) ? raw[key] : "no_match";
  }
  return out;
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
  return text
    .replace(/[\u201C\u201D]/g, "\"")
    .replace(/[\u2018\u2019]/g, "'");
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
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`,
      },
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
    console.error(
      `[match-orgs-for-partnership] ${logLabel} Groq API error (attempt ${attempt + 1}/${MAX_RATE_LIMIT_RETRIES + 1}) - status: ${groqRes.status} ${groqRes.statusText}, ` +
      `remaining-tokens: ${groqRes.headers.get("x-ratelimit-remaining-tokens")}, retry-after: ${groqRes.headers.get("retry-after")}, body: ${errBody}`
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

function looksLikePlaceholder(text: string | null | undefined): boolean {
  if (!text) return false;
  const t = text.toLowerCase().trim();
  return ["lorem ipsum", "test test", "asdf", "qwerty", "xxxxx", "placeholder", "n/a", "sample text", "dummy text", "todo"]
    .some(p => t.includes(p));
}

function buildPrompt(submitting_org: any, candidatesSubset: any[], singlePairMode: boolean): string {
  const extraFieldsInstructions = singlePairMode
    ? `\n\nALSO produce these fields, only needed for this single-candidate detail view:
- reasons: 2-4 short strings, each under 12 words, starting with a positive signal, naming a specific concrete overlap (not generic language)
- gaps: 0-3 short strings, each under 15 words, only real gaps — not invented ones
- opening_message: 3-4 sentences, personalised, warm but professional, addressed to the candidate by name, mentioning their specific stated request and what the submitter concretely brings, closing with an open question. No hedging.`
    : "";

  const extraKeysInSchema = singlePairMode
    ? `,
      "reasons": ["Specific reason one", "Specific reason two"],
      "gaps": ["Specific gap, if any"],
      "opening_message": "Hi [Name], ..."`
    : "";

  return `You are a partnership matching analyst for Impact Natives, a social impact platform focused on UK-Africa collaborations.
Your job: rank candidate organisations by REAL, LOGICAL fit with the submitting organisation's specific new partnership request below — not by superficial similarity like shared continent or generic sector adjacency.

Every candidate below has an ACTIVE, POSTED partnership request — that request (what they are seeking, their stage, budget, timeline, working style) is the PRIMARY thing you are matching against. Their general profile (description, needs, offers, sector, SDGs, and type-specific mandate/CSR/track-record data) is supporting context that helps you judge whether they're a credible, capable match — it is not a substitute for their actual stated request, and it never overrides what they've explicitly said they're seeking right now.

Scoring criteria (total 100):
- Logical correlation between what the submitter needs and what this candidate has explicitly stated they are seeking/offering in their own posted request: 45 points
- Complementary needs/offers, not duplicated focus: 20 points
- Practical compatibility — budget/grant range, timeline, stage, working style, geographic focus, using the candidate's own stated request fields: 20 points
- Sector or SDG relevance to the submitter's specific request: 15 points (this alone is never enough to justify a strong match — shared sector or SDG tags without genuine capability or need alignment should not push a score above 50)

Be honest and specific in the rationale: name the exact detail from their POSTED REQUEST that creates the fit rather than vague language like "aligns with" or "could support." If the correlation is weak, score it low — do not inflate scores for organisations that merely operate in the same country or broad sector.

Watch specifically for this failure pattern: describing two organisations as similar because they share an abstract theme (e.g. both "community-based," both "rural," both "scale their work," both "impact-focused") when their actual needs, offers, and sectors have no real overlap. If you catch yourself writing a rationale that could apply to almost any two organisations regardless of what they actually do, the real fit_score is below 45${singlePairMode ? "" : ", and the candidate should be excluded"}.

CRITICAL — organisational type compatibility: before scoring, check whether this candidate's organisation_type is structurally capable of providing what the sender is actually asking for. NGOs and non-profits generally operate on restricted grant funding and typically cannot provide direct financial capital, investment, or discretionary funding to another organisation's project — even a mission-aligned one — because they don't hold that kind of capital. If the sender is seeking financial backing/investment/funding, only score highly candidates whose organisation_type is capable of providing that. Do not claim a candidate can provide technical support in a domain unless their posted request or profile actually states relevant expertise in that domain.

Work through the scoring criteria internally to arrive at your fit_score, but the "rationale" field must contain ONLY natural, customer-facing prose — exactly 1-2 sentences, no more than 30 words total. NEVER include scoring breakdown or point allocations. NEVER hedge with phrases like "requires further examination" or "compatibility is unclear" — state the fit plainly or score it low.

If a candidate's posted request is incoherent or nonsensical, you MUST score them below 45 regardless of country, sector, or SDG overlap.

Every candidate must get its OWN distinct fit_score reflecting its OWN specific mix of matching and failing criteria — do not default to a single common value across multiple candidates.

ALSO produce a "criteria" object rating five specific dimensions individually, each as exactly "match", "partial", or "no_match":
- sector_fit, geography_fit, need_offer_fit, working_style_fit, stage_readiness_fit
These five ratings must be consistent with the fit_score — do not rate several "match" and then produce a low fit_score, or vice versa.${extraFieldsInstructions}

Use only straight double quotes (\") for all JSON strings — never curly or typographic quotes.

Do all your reasoning silently. Output EXACTLY ONE entry per candidate org_id — never output the same org twice, never show a correction as a second entry, never include a // comment or any text outside the JSON object.

Return ONLY a valid JSON object. No markdown, no backticks, no explanation, no comments, no duplicate keys, no placeholder values.${singlePairMode ? "" : " If you are uncertain about a candidate, simply exclude them from the matches array. Include every candidate with fit_score >= 45, no maximum."} Every object in the matches array must have exactly these keys: org_id, fit_score, rationale, key_synergy, criteria${singlePairMode ? ", reasons, gaps, opening_message" : ""}. Order by fit_score descending.

{
  "matches": [
    {
      "org_id": "<uuid>",
      "fit_score": <integer 0-100>,
      "rationale": "<1-2 short sentences, max 30 words>",
      "key_synergy": "<one short phrase>",
      "criteria": { "sector_fit": "match", "geography_fit": "partial", "need_offer_fit": "match", "working_style_fit": "partial", "stage_readiness_fit": "match" }${extraKeysInSchema}
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
Partnership sought: ${submitting_org.partnership_sought || "Not specified"}

Candidate organisations (each has an active posted partnership request — lead with it):
${candidatesSubset.map((c: any) => {
  const FUNDER_TYPES = ["philanthropic_foundation", "venture_capital"];
  const CORPORATE_TYPES = ["corporation", "technology_company", "public_sector"];
  const isFunderType = FUNDER_TYPES.includes(c.organisation_type);
  const isCorporateType = CORPORATE_TYPES.includes(c.organisation_type);
  const isConsultancyType = c.organisation_type === "consultancy";
  const isImplementerType = !isFunderType && !isCorporateType && !isConsultancyType;

  let typeSpecificBlock = "";
  const fddItems = [c.fdd_disbursement_track_record, c.fdd_decision_transparency, c.fdd_conflict_disclosure, c.fdd_governance_doc, c.fdd_esg_framework, c.fdd_legal_registration];
  const fddScore = fddItems.filter(Boolean).length;

  if (isFunderType) {
    typeSpecificBlock = `This candidate is a FUNDER (${c.organisation_type}). Investment thesis: ${c.investment_thesis || "Not provided"}. Grant/investment range: ${c.grant_range_min || c.grant_range_max ? `${c.grant_range_min ?? "?"} - ${c.grant_range_max ?? "?"} ${c.grant_currency || ""}` : "Not provided"}. Stage preference: ${Array.isArray(c.stage_preference) && c.stage_preference.length ? c.stage_preference.join(", ") : "Not provided"}. Due diligence readiness: ${fddScore}/${fddItems.length}.`;
  } else if (isCorporateType) {
    typeSpecificBlock = `This candidate is a CORPORATE/CSR partner (${c.organisation_type}). CSR focus: ${c.csr_focus_statement || "Not provided"}. Budget range: ${c.csr_budget_range || "Not provided"}. Can bring: ${Array.isArray(c.inkind_support) && c.inkind_support.length ? c.inkind_support.join(", ") : "Not provided"}. Due diligence readiness: ${fddScore}/${fddItems.length}.`;
  } else if (isConsultancyType) {
    typeSpecificBlock = `This candidate is a CONSULTANCY (${c.organisation_type}) -- an independent/solo practitioner, not an institution. Specializations: ${Array.isArray(c.specializations) && c.specializations.length ? c.specializations.join(", ") : "Not provided"}. Notable engagements: ${Array.isArray(c.notable_engagements) && c.notable_engagements.length ? c.notable_engagements.join("; ") : "Not provided"}. Affiliations: ${Array.isArray(c.affiliations) && c.affiliations.length ? c.affiliations.join(", ") : "Not provided"}. Institutional due-diligence criteria (audited accounts, board governance) structurally do not apply to a solo consultancy -- do not treat their absence as a gap or penalize this candidate for lacking them.`;
  } else if (isImplementerType) {
    const ddItems = [c.dd_financial_model, c.dd_audited_accounts, c.dd_governance_doc, c.dd_esg_assessment, c.dd_impact_framework, c.dd_environmental_policy, c.dd_safeguarding_policy, c.dd_legal_registration, c.dd_legal_compliance_declaration];
    const ddScore = ddItems.filter(Boolean).length;
    typeSpecificBlock = `This candidate is an IMPLEMENTER (${c.organisation_type}). Beneficiaries reached: ${c.total_beneficiaries_reached ?? "Not provided"}. Due diligence readiness: ${ddScore}/${ddItems.length}.`;
  }

  return `---
ID: ${c.id}
Name: ${c.organisation_name}
Type: ${c.organisation_type}

THEIR POSTED PARTNERSHIP REQUEST (primary matching content):
  What they're seeking: ${c.partnership_sought}
  Stage: ${c.partnership_stage || "N/A"} | Duration: ${c.partnership_duration || "N/A"} | Budget: ${c.partnership_budget || "N/A"}
  Decision timeline: ${c.partnership_decision_timeline || "N/A"} | Working style: ${c.partnership_working_style || "N/A"}
  Financial arrangement: ${c.partnership_financial_transfer || "N/A"} | Team capacity: ${c.partnership_team_capacity || "N/A"}
  Success definition: ${c.partnership_success_definition || "N/A"}

Supporting profile context:
Description: ${c.description || "N/A"}
Sectors: ${formatSectorDisplay(c.sector) || "N/A"}
Countries: ${Array.isArray(c.country) ? c.country.join(", ") : c.country || "N/A"}
Needs: ${Array.isArray(c.needs) ? c.needs.join(", ") : "N/A"}
Offers: ${Array.isArray(c.offers) ? c.offers.join(", ") : "N/A"}
${typeSpecificBlock}`;
}).join("\n")}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });

  try {
    const { submitting_org, user_id, target_org_id } = await req.json();
    const singlePairMode = !!target_org_id;

    if (!submitting_org) return new Response(
      JSON.stringify({ error: "submitting_org is required" }),
      { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    let candidateQuery = supabase
      .from("organizations")
      .select("id, organisation_name, description, sector, country, organisation_type, needs, offers, sdgs, website, email, verification_status, partnership_listed, partnership_sought, partnership_stage, partnership_duration, partnership_budget, partnership_decision_timeline, partnership_working_style, partnership_financial_transfer, partnership_team_capacity, partnership_success_definition, investment_thesis, grant_range_min, grant_range_max, grant_currency, stage_preference, geographic_focus, csr_focus_statement, csr_budget_range, esg_frameworks, inkind_support, partner_type_preference, employee_engagement_available, cobranding_open, tech_support_available, sandbox_ready, sandbox_description, dd_financial_model, dd_audited_accounts, dd_governance_doc, dd_esg_assessment, dd_impact_framework, dd_environmental_policy, dd_safeguarding_policy, dd_legal_registration, dd_legal_compliance_declaration, fdd_disbursement_track_record, fdd_decision_transparency, fdd_conflict_disclosure, fdd_governance_doc, fdd_esg_framework, fdd_legal_registration, total_beneficiaries_reached, jobs_created, years_of_operation, grants_received_count, grants_total_value_usd, grants_delivered_on_time_pct, previous_funders, third_party_evaluations, specializations, notable_engagements, affiliations")
      .eq("status", "published")
      .eq("partnership_listed", true)
      .eq("flagged_visibility_hold", false)
      .not("partnership_sought", "is", null)
      .neq("id", submitting_org.id)
      .limit(FETCH_SAFETY_CAP);

    if (singlePairMode) candidateQuery = candidateQuery.eq("id", target_org_id);

    const { data: rawCandidates, error } = await candidateQuery;
    if (error) throw error;

    const candidates = (rawCandidates ?? []).filter((c: any) => {
      if (!c.partnership_sought || !c.partnership_sought.trim()) return false;
      if (looksLikePlaceholder(c.partnership_sought)) return false;
      return true;
    });

    if (!candidates || candidates.length === 0) {
      return new Response(JSON.stringify({ matches: [] }), {
        status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const byOrgId = new Map<string, any>();

    if (singlePairMode) {
      const prompt = buildPrompt(submitting_org, candidates, true);
      const result = await callGroqWithBackoff(prompt, 900, "single-pair");
      if (!result.ok) {
        return new Response(JSON.stringify({ error: `Groq API error: ${result.errorBody}` }), {
          status: 502, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        });
      }
      let parsed: any;
      try {
        parsed = parseMatchesJson(result.rawText ?? "");
      } catch {
        return new Response(JSON.stringify({ error: "Could not parse response.", raw: result.rawText }), {
          status: 422, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        });
      }
      for (const m of (parsed.matches ?? [])) {
        if (!m || typeof m.fit_score !== "number") continue;
        const org = candidates.find((c: any) => c.id === m.org_id);
        if (!org) continue;
        byOrgId.set(m.org_id, {
          ...m, org,
          criteria: sanitizeCriteria(m.criteria),
          reasons: Array.isArray(m.reasons) ? m.reasons : [],
          gaps: Array.isArray(m.gaps) ? m.gaps : [],
          opening_message: typeof m.opening_message === "string" ? m.opening_message : null,
        });
      }
    } else {
      const batches = chunk(candidates, BATCH_SIZE);
      const batchResults = await Promise.all(batches.map(async (batchCandidates, b) => {
        const prompt = buildPrompt(submitting_org, batchCandidates, false);
        const result = await callGroqWithBackoff(prompt, 2500, `batch ${b + 1}/${batches.length}`);
        if (!result.ok) {
          console.error(`[match-orgs-for-partnership] batch ${b + 1}/${batches.length} failed: ${result.errorBody}`);
          return [];
        }
        try {
          const parsed = parseMatchesJson(result.rawText ?? "");
          return parsed.matches ?? [];
        } catch {
          console.error(`[match-orgs-for-partnership] batch ${b + 1}/${batches.length} unparseable`);
          return [];
        }
      }));

      for (const m of batchResults.flat()) {
        if (!m || typeof m.fit_score !== "number") continue;
        if (m.fit_score < 45) continue;
        const org = candidates.find((c: any) => c.id === m.org_id);
        if (!org) continue;
        byOrgId.set(m.org_id, {
          ...m, org,
          criteria: sanitizeCriteria(m.criteria),
          reasons: [],
          gaps: [],
          opening_message: null,
        });
      }
    }

    const matches = Array.from(byOrgId.values()).sort((a, b) => b.fit_score - a.fit_score);

    return new Response(JSON.stringify({ matches }), {
      status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
});
