// supabase/functions/match-orgs-for-partnership/index.ts
// Matches a submitting org/listing against organisations that have an
// active posted partnership request.
//
// v48 (Oct 2026): PROPORTIONAL DD. The DD-readiness cap is gone: DD no
// longer lowers fit_score. Each match instead gets dd_status
// (complete / exempt / tier_missing / basics_incomplete), dd_missing and
// deal_bucket, judged per pair from the larger of the two listings' budget
// buckets (rules and thresholds in matching_config.dd_policy, logic in
// dd.ts). Results sort by DD tier, then fit_score. Prompt: Africa-focused
// wording, no DD counts or beneficiary numbers shown to the AI, a
// size-neutral instruction, and a yes/no "documented impact" signal from
// partner-confirmed impact claims.
// v47 (14 Oct 2026): browser calls are now checked. Server calls (secret key:
// sweeps, refresh wrappers, score-partnership-fit) are unchanged. A browser
// call (FindPartnerModalDashboard) must be signed in, use listing mode, be
// the owner or an active member of the org that owns the submitting listing,
// and that org must be on a paid tier. Before this anyone with the public key
// could run matching for any listing or any made-up submitting_org, and the
// Plus gate existed only in the browser.
// v46 (14 Oct 2026): legacy JWT keys disabled after a leak. Reads the new
// secret API key (SUPABASE_SECRET_KEYS) instead of SUPABASE_SERVICE_ROLE_KEY.
// No logic change. verify_jwt stays on: the gateway accepts a user session
// or the secret key.
//
// v44: DEMO ORG EXCLUSION (.eq("is_demo_org", false) on candidate queries).
// v41: EMAIL LEAK FIX (legacy org-scoped mode no longer selects email).
// v40: budget_fit rescue via grant_range (USD only).
// v38: DETERMINISTIC SCORING. AI only rates five criteria; score computed
// here from weights need_offer 35, budget 15, sector 15, geography 10,
// working_style 10, stage_readiness 15; gates on need_offer/budget/geography
// cap at 44; DD-readiness cap applied after.
// v36: dual-mode (listing-scoped + legacy org-scoped). Full history in git.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  loadMatchingConfig, loadDocKeys, loadDocumentedImpact, partnershipDealBucket,
  ddStatusFor, byTierThenScore,
} from "./dd.ts";

function __envKeys(name: string): Record<string, string> {
  try { return JSON.parse(Deno.env.get(name) ?? "{}"); } catch { return {}; }
}
const __SECRET_KEYS = Object.values(__envKeys("SUPABASE_SECRET_KEYS"));
const SECRET_KEY = __envKeys("SUPABASE_SECRET_KEYS")["default"] ?? __SECRET_KEYS[0] ?? "";
const PUBLISHABLE_KEY = __envKeys("SUPABASE_PUBLISHABLE_KEYS")["default"] ?? Object.values(__envKeys("SUPABASE_PUBLISHABLE_KEYS"))[0] ?? "";
function isServerCall(req: Request): boolean {
  if (__SECRET_KEYS.length === 0) return false;
  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const apikey = req.headers.get("apikey") ?? "";
  return __SECRET_KEYS.includes(bearer) || __SECRET_KEYS.includes(apikey);
}
const PAID_TIERS = ["plus", "pro", "compliance"];

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = SECRET_KEY;

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

const ORG_PROFILE_COLUMNS = "id, organisation_name, description, sector, country, organisation_type, needs, offers, sdgs, website, email, verification_status, user_id, flagged_visibility_hold, investment_thesis, grant_range_min, grant_range_max, grant_currency, stage_preference, geographic_focus, csr_focus_statement, csr_budget_range, esg_frameworks, inkind_support, partner_type_preference, employee_engagement_available, cobranding_open, tech_support_available, sandbox_ready, sandbox_description, dd_financial_model, dd_audited_accounts, dd_governance_doc, dd_esg_assessment, dd_impact_framework, dd_environmental_policy, dd_safeguarding_policy, dd_legal_registration, dd_legal_compliance_declaration, fdd_disbursement_track_record, fdd_decision_transparency, fdd_conflict_disclosure, fdd_governance_doc, fdd_esg_framework, fdd_legal_registration, total_beneficiaries_reached, jobs_created, years_of_operation, grants_received_count, grants_total_value_usd, grants_delivered_on_time_pct, previous_funders, third_party_evaluations, specializations, notable_engagements, affiliations";

const CRITERIA_WEIGHTS: Record<string, number> = {
  need_offer_fit: 35,
  budget_fit: 15,
  sector_fit: 15,
  geography_fit: 10,
  working_style_fit: 10,
  stage_readiness_fit: 15,
};
const GATE_KEYS = ["need_offer_fit", "budget_fit", "geography_fit"];
const INCLUSION_THRESHOLD = 45;
const GATE_CAP = INCLUSION_THRESHOLD - 1;

const BUDGET_ORDER = ["under_10k", "10k_50k", "50k_200k", "over_200k"];

const BUCKET_BOUNDS_USD: Record<string, [number, number]> = {
  under_10k: [0, 10_000],
  "10k_50k": [10_000, 50_000],
  "50k_200k": [50_000, 200_000],
  over_200k: [200_000, Infinity],
};

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

function computeBudgetFitFromBuckets(a: string | null | undefined, b: string | null | undefined): string {
  if (!a || !b) return "partial";
  if (a === "open" || b === "open") return "match";
  if (a === "in_kind_only" && b === "in_kind_only") return "match";
  if (a === "in_kind_only" || b === "in_kind_only") return "no_match";
  const ia = BUDGET_ORDER.indexOf(a);
  const ib = BUDGET_ORDER.indexOf(b);
  if (ia === -1 || ib === -1) return "partial";
  const diff = Math.abs(ia - ib);
  if (diff === 0) return "match";
  if (diff === 1) return "partial";
  return "no_match";
}

function rangesOverlap(aMin: number, aMax: number, bMin: number, bMax: number): boolean {
  return aMin <= bMax && bMin <= aMax;
}

function rescueBudgetFitWithGrantRange(
  grantMin: number | null | undefined,
  grantMax: number | null | undefined,
  grantCurrency: string | null | undefined,
  otherBucket: string | null | undefined
): boolean {
  if (grantCurrency && grantCurrency !== "USD") return false;
  if (grantMin == null && grantMax == null) return false;
  if (!otherBucket || !(otherBucket in BUCKET_BOUNDS_USD)) return false;
  const [oMin, oMax] = BUCKET_BOUNDS_USD[otherBucket];
  const gMin = grantMin ?? 0;
  const gMax = grantMax ?? Infinity;
  return rangesOverlap(gMin, gMax, oMin, oMax);
}

function computeBudgetFit(
  a: string | null | undefined, b: string | null | undefined,
  aGrantMin?: number | null, aGrantMax?: number | null, aGrantCurrency?: string | null,
  bGrantMin?: number | null, bGrantMax?: number | null, bGrantCurrency?: string | null,
): string {
  const bucketResult = computeBudgetFitFromBuckets(a, b);
  if (bucketResult !== "no_match") return bucketResult;

  if (rescueBudgetFitWithGrantRange(aGrantMin, aGrantMax, aGrantCurrency, b)) return "match";
  if (rescueBudgetFitWithGrantRange(bGrantMin, bGrantMax, bGrantCurrency, a)) return "match";

  return "no_match";
}

function sanitizeCriteria(raw: any): Record<string, string> | null {
  if (!raw || typeof raw !== "object") return null;
  const out: Record<string, string> = {};
  for (const key of VALID_CRITERIA_KEYS) {
    out[key] = VALID_STATUSES.includes(raw[key]) ? raw[key] : "partial";
  }
  return out;
}

// Org id behind a candidate: listing mode keeps it in _orgId, legacy
// org-scoped mode uses the org row's own id.
function orgIdOf(c: any): string {
  return c._orgId ?? c.id;
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
    ? `\n\nALSO produce these fields, only needed for this single-candidate detail view:\n- reasons: 2-4 short strings, each under 12 words, starting with a positive signal, naming a specific concrete overlap (not generic language)\n- gaps: 0-3 short strings, each under 15 words, only real gaps -- not invented ones\n- opening_message: 3-4 sentences, personalised, warm but professional, addressed to the candidate by name, mentioning their specific stated request and what the submitter concretely brings, closing with an open question. No hedging.`
    : "";

  const extraKeysInSchema = singlePairMode
    ? `,\n      "reasons": ["Specific reason one", "Specific reason two"],\n      "gaps": ["Specific gap, if any"],\n      "opening_message": "Hi [Name], ..."`
    : "";

  return `You are a partnership matching analyst for Impact Natives, a coordination platform for Africa's social impact sector.
Your job: judge candidate organisations against the submitting organisation's specific new partnership request below -- not by superficial similarity like shared continent or generic sector adjacency. You do NOT compute a numeric score -- that is calculated separately from the ratings you provide below. Your job is ONLY to rate each of five dimensions honestly.

Judge fit on the ask, never on organisation size, age, reach or polish. A small organisation with a precise, well-matched ask is a better fit than a large one with a vague or mismatched ask. Due diligence and compliance are assessed separately in code -- do not let them influence any rating.

Every candidate below has an ACTIVE, POSTED partnership request -- that request (what they are seeking, their stage, budget, timeline, working style) is the PRIMARY thing you are judging against. Their general profile (description, needs, offers, sector, SDGs, and type-specific mandate/CSR/track-record data) is supporting context that helps you judge whether they're a credible, capable match -- it is not a substitute for their actual stated request, and it never overrides what they've explicitly said they're seeking right now.

The single most important judgment is need_offer_fit: is there a REAL, LOGICAL correlation between what the submitter needs and what this candidate has explicitly stated they are seeking/offering in their own posted request, AND does the submitter bring something genuinely complementary rather than duplicating what the candidate already has. This should dominate your overall impression of the pair far more than sector or geography overlap alone.

Be honest and specific: name the exact detail from their POSTED REQUEST that creates or breaks the fit, rather than vague language like "aligns with" or "could support." If the correlation is weak, rate need_offer_fit low -- do not rate it "match" for organisations that merely operate in the same country or broad sector.

Watch specifically for this failure pattern: describing two organisations as similar because they share an abstract theme (e.g. both "community-based," both "rural," both "scale their work," both "impact-focused") when their actual needs, offers, and sectors have no real overlap. If you catch yourself writing a rationale that could apply to almost any two organisations regardless of what they actually do, need_offer_fit should be "no_match", not "partial" or "match" -- sector or SDG overlap alone never justifies rating need_offer_fit favourably.

CRITICAL -- organisational type compatibility: before rating need_offer_fit, check whether this candidate's organisation_type is structurally capable of providing what the sender is actually asking for. NGOs and non-profits generally operate on restricted grant funding and typically cannot provide direct financial capital, investment, or discretionary funding to another organisation's project -- even a mission-aligned one -- because they don't hold that kind of capital. If the sender is seeking financial backing/investment/funding, only rate need_offer_fit favourably for candidates whose organisation_type is capable of providing that. Do not claim a candidate can provide technical support in a domain unless their posted request or profile actually states relevant expertise in that domain.

The "rationale" field must contain ONLY natural, customer-facing prose -- exactly 1-2 sentences, no more than 30 words total. NEVER include scoring breakdown or point allocations. NEVER hedge with phrases like "requires further examination" or "compatibility is unclear" -- state the fit plainly, in either direction.

If a candidate's posted request is incoherent or nonsensical, rate need_offer_fit "no_match" regardless of country, sector, or SDG overlap.

Produce a "criteria" object rating five specific dimensions individually, each as exactly "match", "partial", or "no_match":
- sector_fit: does the candidate's stated sector genuinely overlap the submitter's?
- geography_fit: does the candidate's stated country/location overlap the submitter's, in a way that matters for this specific ask (some asks are workable remotely -- use the stated location and working-style context to judge, don't assume physical presence is always required)?
- need_offer_fit: as described above -- the dominant judgment.
- working_style_fit: are their stated working-style preferences (lead vs. support, decision speed, formality) compatible?
- stage_readiness_fit: is the candidate's own stated stage (concept, pilot, scaling, etc.) a workable match for what the submitter's ask needs right now? This is about the ASK's timing, not the candidate's organisational maturity or compliance readiness -- those are assessed separately.
Do not rate several dimensions "match" while your rationale describes a weak or superficial pairing, or vice versa -- the ratings and the rationale must tell the same story.${extraFieldsInstructions}

Use only straight double quotes (\") for all JSON strings -- never curly or typographic quotes.

Do all your reasoning silently. Output EXACTLY ONE entry per candidate org_id -- every candidate listed below, regardless of how strong or weak the fit looks -- never output the same org twice, never show a correction as a second entry, never include a // comment or any text outside the JSON object.

Return ONLY a valid JSON object. No markdown, no backticks, no explanation, no comments, no duplicate keys, no placeholder values. Every object in the matches array must have exactly these keys: org_id, rationale, key_synergy, criteria${singlePairMode ? ", reasons, gaps, opening_message" : ""}. No fit_score field -- it is not your job to produce one.

{
  "matches": [
    {
      "org_id": "<uuid>",
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

Candidate organisations (each has an active posted partnership request -- lead with it):
${candidatesSubset.map((c: any) => {
  const FUNDER_TYPES = ["philanthropic_foundation", "venture_capital"];
  const CORPORATE_TYPES = ["corporation", "technology_company", "public_sector"];
  const isFunderType = FUNDER_TYPES.includes(c.organisation_type);
  const isCorporateType = CORPORATE_TYPES.includes(c.organisation_type);
  const isConsultancyType = c.organisation_type === "consultancy";
  const isImplementerType = !isFunderType && !isCorporateType && !isConsultancyType;

  let typeSpecificBlock = "";

  if (isFunderType) {
    typeSpecificBlock = `This candidate is a FUNDER (${c.organisation_type}). Investment thesis: ${c.investment_thesis || "Not provided"}. Grant/investment range: ${c.grant_range_min || c.grant_range_max ? `${c.grant_range_min ?? "?"} - ${c.grant_range_max ?? "?"} ${c.grant_currency || ""}` : "Not provided"}. Stage preference: ${Array.isArray(c.stage_preference) && c.stage_preference.length ? c.stage_preference.join(", ") : "Not provided"}.`;
  } else if (isCorporateType) {
    typeSpecificBlock = `This candidate is a CORPORATE/CSR partner (${c.organisation_type}). CSR focus: ${c.csr_focus_statement || "Not provided"}. Budget range: ${c.csr_budget_range || "Not provided"}. Can bring: ${Array.isArray(c.inkind_support) && c.inkind_support.length ? c.inkind_support.join(", ") : "Not provided"}.`;
  } else if (isConsultancyType) {
    typeSpecificBlock = `This candidate is a CONSULTANCY (${c.organisation_type}) -- an independent/solo practitioner, not an institution. Specializations: ${Array.isArray(c.specializations) && c.specializations.length ? c.specializations.join(", ") : "Not provided"}. Notable engagements: ${Array.isArray(c.notable_engagements) && c.notable_engagements.length ? c.notable_engagements.join("; ") : "Not provided"}. Affiliations: ${Array.isArray(c.affiliations) && c.affiliations.length ? c.affiliations.join(", ") : "Not provided"}.`;
  } else if (isImplementerType) {
    typeSpecificBlock = `This candidate is an IMPLEMENTER (${c.organisation_type}).`;
  }
  // Size-neutral evidence signal: yes only when a partner confirmed at least
  // one impact claim on Natives. "No" is not a gap -- many good orgs are new.
  typeSpecificBlock += ` Documented impact on Natives (partner-confirmed): ${c._documentedImpact ? "Yes" : "No (not a gap, just no confirmed record yet)"}.`;

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

function buildProfileFromListing(listing: any, org: any) {
  return {
    ...org,
    id: listing.id,
    _orgId: org.id,
    _listingId: listing.id,
    sector: listing.sector,
    country: listing.country,
    needs: listing.needs,
    offers: listing.offers,
    mandate_sdgs: listing.sdgs,
    partnership_sought: listing.sought,
    partnership_stage: listing.stage,
    partnership_duration: listing.duration,
    partnership_budget: listing.budget,
    partnership_decision_timeline: listing.decision_timeline,
    partnership_working_style: listing.working_style,
    partnership_financial_transfer: listing.financial_transfer,
    partnership_team_capacity: listing.team_capacity,
    partnership_success_definition: listing.success_definition,
  };
}

async function resolveOrgUserIds(supabase: any, org: any): Promise<string[]> {
  const { data: members } = await supabase
    .from("org_members")
    .select("user_id")
    .eq("org_id", org.id)
    .eq("status", "active");
  return [org.user_id, ...((members ?? []).map((m: any) => m.user_id))].filter(Boolean);
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });

  try {
    const body = await req.json();
    const listingMode = !!body.submitting_listing_id;
    const singlePairMode = listingMode ? !!body.target_listing_id : !!body.target_org_id;

    // Browser calls: signed-in user, listing mode only. Ownership and tier
    // are checked once the submitting listing's org is loaded below.
    let browserCallerId: string | null = null;
    if (!isServerCall(req)) {
      if (!listingMode) return jsonResponse({ error: "Forbidden" }, 403);
      const callerClient = createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
        global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
      });
      const { data: { user }, error: userError } = await callerClient.auth.getUser();
      if (userError || !user) return jsonResponse({ error: "Unauthorized" }, 401);
      browserCallerId = user.id;
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    let submittingProfile: any;
    let candidates: any[];

    if (listingMode) {
      const { submitting_listing_id, target_listing_id } = body;

      const { data: submittingListing, error: listingErr } = await supabase
        .from("partnership_listings").select("*").eq("id", submitting_listing_id).maybeSingle();
      if (listingErr || !submittingListing) return new Response(
        JSON.stringify({ error: "submitting listing not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );

      const { data: submittingOrg, error: orgErr } = await supabase
        .from("organizations").select(ORG_PROFILE_COLUMNS).eq("user_id", submittingListing.user_id).maybeSingle();
      if (orgErr || !submittingOrg) return new Response(
        JSON.stringify({ error: "submitting org not found for this listing" }),
        { status: 404, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );

      submittingProfile = buildProfileFromListing(submittingListing, submittingOrg);

      const excludeUserIds = await resolveOrgUserIds(supabase, submittingOrg);

      if (browserCallerId) {
        if (!excludeUserIds.includes(browserCallerId)) return jsonResponse({ error: "Forbidden" }, 403);
        const { data: tierRow } = await supabase
          .from("organizations").select("subscription_tier").eq("id", submittingOrg.id).maybeSingle();
        if (!tierRow || !PAID_TIERS.includes(tierRow.subscription_tier)) {
          return jsonResponse({ error: "AI partner matching requires a Plus plan or higher.", requires_upgrade: true, required_tier: "plus" }, 403);
        }
      }

      let candidateListingQuery = supabase
        .from("partnership_listings")
        .select("id, user_id, sought, stage, duration, budget, decision_timeline, working_style, financial_transfer, team_capacity, success_definition, sector, needs, offers, country, sdgs")
        .eq("status", "published")
        .not("sought", "is", null)
        .limit(FETCH_SAFETY_CAP);

      if (singlePairMode) candidateListingQuery = candidateListingQuery.eq("id", target_listing_id);

      const { data: rawListings, error: candErr } = await candidateListingQuery;
      if (candErr) throw candErr;

      const eligibleListings = (rawListings ?? []).filter((l: any) =>
        !excludeUserIds.includes(l.user_id) &&
        l.sought && l.sought.trim() &&
        !looksLikePlaceholder(l.sought)
      );

      if (eligibleListings.length === 0) {
        return new Response(JSON.stringify({ matches: [] }), {
          status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        });
      }

      const candidateUserIds = [...new Set(eligibleListings.map((l: any) => l.user_id))];
      const { data: candidateOrgs, error: candOrgErr } = await supabase
        .from("organizations")
        .select(ORG_PROFILE_COLUMNS)
        .in("user_id", candidateUserIds)
        .eq("flagged_visibility_hold", false)
        .eq("is_demo_org", false);
      if (candOrgErr) throw candOrgErr;

      const orgByUserId = new Map((candidateOrgs ?? []).map((o: any) => [o.user_id, o]));

      candidates = eligibleListings
        .map((l: any) => {
          const org = orgByUserId.get(l.user_id);
          if (!org) return null;
          return buildProfileFromListing(l, org);
        })
        .filter(Boolean);

    } else {
      const { submitting_org, target_org_id } = body;
      if (!submitting_org) return new Response(
        JSON.stringify({ error: "submitting_org is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
      submittingProfile = submitting_org;

      let candidateQuery = supabase
        .from("organizations")
        .select("id, organisation_name, description, sector, country, organisation_type, needs, offers, sdgs, website, verification_status, partnership_listed, partnership_sought, partnership_stage, partnership_duration, partnership_budget, partnership_decision_timeline, partnership_working_style, partnership_financial_transfer, partnership_team_capacity, partnership_success_definition, investment_thesis, grant_range_min, grant_range_max, grant_currency, stage_preference, geographic_focus, csr_focus_statement, csr_budget_range, esg_frameworks, inkind_support, partner_type_preference, employee_engagement_available, cobranding_open, tech_support_available, sandbox_ready, sandbox_description, dd_financial_model, dd_audited_accounts, dd_governance_doc, dd_esg_assessment, dd_impact_framework, dd_environmental_policy, dd_safeguarding_policy, dd_legal_registration, dd_legal_compliance_declaration, fdd_disbursement_track_record, fdd_decision_transparency, fdd_conflict_disclosure, fdd_governance_doc, fdd_esg_framework, fdd_legal_registration, total_beneficiaries_reached, jobs_created, years_of_operation, grants_received_count, grants_total_value_usd, grants_delivered_on_time_pct, previous_funders, third_party_evaluations, specializations, notable_engagements, affiliations")
        .eq("status", "published")
        .eq("partnership_listed", true)
        .eq("flagged_visibility_hold", false)
        .eq("is_demo_org", false)
        .not("partnership_sought", "is", null)
        .neq("id", submitting_org.id)
        .limit(FETCH_SAFETY_CAP);

      if (singlePairMode) candidateQuery = candidateQuery.eq("id", target_org_id);

      const { data: rawCandidates, error } = await candidateQuery;
      if (error) throw error;

      candidates = (rawCandidates ?? []).filter((c: any) => {
        if (!c.partnership_sought || !c.partnership_sought.trim()) return false;
        if (looksLikePlaceholder(c.partnership_sought)) return false;
        return true;
      });
    }

    if (!candidates || candidates.length === 0) {
      return new Response(JSON.stringify({ matches: [] }), {
        status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    // Proportional DD inputs: policy + uploaded-document keys per candidate
    // org, and the size-neutral documented-impact flag for the prompt.
    const { policy: ddPolicy } = await loadMatchingConfig(supabase);
    const candidateOrgIds = candidates.map(orgIdOf);
    const [docKeysByOrg, documentedImpactOrgs] = await Promise.all([
      loadDocKeys(supabase, candidateOrgIds),
      loadDocumentedImpact(supabase, candidateOrgIds),
    ]);
    for (const c of candidates) c._documentedImpact = documentedImpactOrgs.has(orgIdOf(c));

    function ddFieldsFor(c: any) {
      const dealBucket = partnershipDealBucket(submittingProfile.partnership_budget, c.partnership_budget, ddPolicy);
      const dd = ddStatusFor(c, docKeysByOrg.get(orgIdOf(c)) ?? new Set(), dealBucket, ddPolicy);
      return { dd_status: dd.status, dd_missing: dd.missing, deal_bucket: dealBucket };
    }

    const byId = new Map<string, any>();

    if (singlePairMode) {
      const prompt = buildPrompt(submittingProfile, candidates, true);
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
        if (!m || !m.criteria) continue;
        const c = candidates.find((cand: any) => cand.id === m.org_id);
        if (!c) continue;
        const aiCriteria = sanitizeCriteria(m.criteria);
        if (!aiCriteria) continue;
        const budgetFit = computeBudgetFit(
          submittingProfile.partnership_budget, c.partnership_budget,
          submittingProfile.grant_range_min, submittingProfile.grant_range_max, submittingProfile.grant_currency,
          c.grant_range_min, c.grant_range_max, c.grant_currency,
        );
        const fullCriteria = { ...aiCriteria, budget_fit: budgetFit };
        const finalScore = computeDeterministicScore(fullCriteria);
        const base = {
          fit_score: finalScore,
          rationale: m.rationale,
          key_synergy: m.key_synergy,
          criteria: fullCriteria,
          reasons: Array.isArray(m.reasons) ? m.reasons : [],
          gaps: Array.isArray(m.gaps) ? m.gaps : [],
          opening_message: typeof m.opening_message === "string" ? m.opening_message : null,
          ...ddFieldsFor(c),
        };
        byId.set(m.org_id, listingMode
          ? { ...base, matched_listing_id: c._listingId, matched_org_id: c._orgId }
          : { ...base, org_id: c.id, org: c });
      }
    } else {
      const batches = chunk(candidates, BATCH_SIZE);
      const batchResults = await Promise.all(batches.map(async (batchCandidates, b) => {
        const prompt = buildPrompt(submittingProfile, batchCandidates, false);
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
        if (!m || !m.criteria) continue;
        const c = candidates.find((cand: any) => cand.id === m.org_id);
        if (!c) continue;
        const aiCriteria = sanitizeCriteria(m.criteria);
        if (!aiCriteria) continue;
        const budgetFit = computeBudgetFit(
          submittingProfile.partnership_budget, c.partnership_budget,
          submittingProfile.grant_range_min, submittingProfile.grant_range_max, submittingProfile.grant_currency,
          c.grant_range_min, c.grant_range_max, c.grant_currency,
        );
        const fullCriteria = { ...aiCriteria, budget_fit: budgetFit };
        const finalScore = computeDeterministicScore(fullCriteria);
        if (finalScore < INCLUSION_THRESHOLD) continue;
        const base = {
          fit_score: finalScore,
          rationale: m.rationale,
          key_synergy: m.key_synergy ?? null,
          criteria: fullCriteria,
          reasons: [],
          gaps: [],
          opening_message: null,
          ...ddFieldsFor(c),
        };
        byId.set(m.org_id, listingMode
          ? { ...base, matched_listing_id: c._listingId, matched_org_id: c._orgId }
          : { ...base, org_id: c.id, org: c });
      }
    }

    // DD tier first (complete/exempt, then tier_missing, then
    // basics_incomplete), fit_score within each tier.
    const matches = Array.from(byId.values()).sort(byTierThenScore("fit_score"));

    return new Response(JSON.stringify({ matches }), {
      status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
});
