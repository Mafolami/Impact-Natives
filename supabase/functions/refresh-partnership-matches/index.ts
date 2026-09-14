// supabase/functions/refresh-partnership-matches/index.ts
// Called by an authenticated user from Home. Resolves the caller's own org
// via their own session, checks profile completeness and cache freshness,
// and only calls match-orgs-for-partnership (bulk mode) when actually
// needed.
//
// v17: subscription_tier gate added. AI-powered org-to-org matching is a
// Plus+ feature (see billing scoping notes) -- Free-tier orgs now get a
// clean eligible:false response before any AI compute happens, rather than
// receiving full AI matches for free. This is the enforcement half of a
// pricing model that previously existed only in the database and the
// Billing tab's copy -- nothing actually stopped a Free-tier org from
// hitting this endpoint and getting real matches computed for them.
//
// v16: org lookup now goes through resolve_org_owner_id() instead of
// user.id directly. Previously this looked up organizations by the
// caller's own auth id, which is correct for an Owner (whose id IS the
// org's user_id) but silently 404s for an active Team Member, whose own
// id has no organizations row at all -- their Owner's does. No Members
// exist in production yet so this hadn't fired, but it would have broken
// the moment Team invites went live: a Member's login-triggered cache
// warm would 404 every time instead of refreshing their org's matches.
// resolve_org_owner_id() is the server-side mirror of the client's
// resolveOrgOwnerId() in AuthContext.tsx (Owner -> own id, active Member
// -> their Owner's id, neither -> fall back to own id).
//
// v15: flagged_visibility_hold self-exclusion. If the caller's own org is
// under a "Serious"-severity admin hold, return eligible:false rather
// than computing/returning matches -- companion to v32 of
// match-orgs-for-partnership (candidate-side exclusion) and v8 of
// refresh-partnership-matches-for-org (same self-exclusion, cron path).
//
// v14: CRITERIA_VERSION moved out of a local hardcoded constant into the
// `criteria_versions` table (match_type='partnership'), read once per
// request -- same fix, same reasoning as refresh-initiative-matches v20.
// This function's copy hadn't drifted from its two siblings yet (all three
// were still at 3), but the same structural risk existed here as on the
// initiative side, where it had already caused a real bug. Extended for
// consistency across both matching pipelines rather than waiting for this
// side to actually break first.
//
// v13: replaced the select-protected -> delete-non-protected -> insert-fresh
// sequence (3 separate DB round trips, no transaction wrapping them) with a
// single atomic RPC call (upsert_partnership_match_cache_batch) -- same fix,
// same reasoning as refresh-partnership-matches-for-org v6. That gap was a
// real, reproduced race: this on-demand path and the cron worker (or two
// overlapping on-demand calls) refreshing the same org close together could
// read the cache mid-way through the other's delete/insert and misclassify
// a still-in-flight protected row as unprotected, permanently losing a real
// single-pair score from score-partnership-fit. Reproduced live during
// verification testing. The RPC does the whole delete+upsert as one SQL
// statement with an ON CONFLICT ... WHERE clause, so there's no window for
// another call to interleave.
//
// v10: protected-row handling added. Confirmed in production: bulk mode
// scored a pair 88% that a focused single-pair compute correctly caught as
// a 30% needs/offers mismatch.
//
// funderCompleteness / corporateCompleteness: weighted, not equal-share.
// Weights chosen by reading what generate-deal-memo and generate-csr-brief
// actually lean on hardest. This MUST stay identical to the client-side
// estimates in FunderHome.tsx / CorporateHome.tsx or the two numbers will
// silently drift apart again.
//
// v18: extended to implementers/NGOs (any org_type that isn't funder,
// corporate, or consultancy). match-orgs-for-partnership itself was
// ALREADY fully type-agnostic -- its candidate query is just
// status='published' AND partnership_listed=true AND partnership_sought
// IS NOT NULL, no organisation_type filter at all, and its prompt builder
// already has a dedicated IMPLEMENTER branch for scoring implementer
// CANDIDATES. The only thing stopping an implementer from being the
// submitting_org was this wrapper's own type gate -- an artificial
// restriction bolted onto an already-generic matcher, not a real
// capability gap. implementerCompleteness() mirrors funderCompleteness/
// corporateCompleteness's weighted style, using the fields Onboarding.tsx
// actually collects for every org type (description, sector, needs,
// offers, country, mandate_sdgs) instead of funder/corporate-specific
// mandate fields that don't exist on an implementer's row. Consultancies
// stay excluded for now -- their completeness would need
// specializations/notable_engagements instead, a separate change not
// covered by this pass.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CACHE_TTL_HOURS = 12;
const COMPLETENESS_THRESHOLD = 80;
const MAX_CACHED_MATCHES = 10;
// Fallback only -- real value read from criteria_versions at request time.
const CRITERIA_VERSION_FALLBACK = 3;

const FUNDER_TYPES = ["philanthropic_foundation", "venture_capital"];
const CORPORATE_TYPES = ["corporation", "technology_company", "public_sector"];

async function getCriteriaVersion(client: any): Promise<number> {
  const { data, error } = await client
    .from("criteria_versions")
    .select("version")
    .eq("match_type", "partnership")
    .maybeSingle();
  if (error || !data) {
    console.error(`[refresh-partnership-matches] criteria_versions read failed, falling back to ${CRITERIA_VERSION_FALLBACK}: ${error?.message}`);
    return CRITERIA_VERSION_FALLBACK;
  }
  return data.version;
}

function funderCompleteness(org: any): number {
  const weightedFields: [boolean, number][] = [
    [(org.mandate_sectors?.length ?? 0) > 0, 25],
    [(org.geographic_focus?.length ?? 0) > 0, 20],
    [!!org.investment_thesis, 15],
    [(org.mandate_sdgs?.length ?? 0) > 0, 15],
    [(org.stage_preference?.length ?? 0) > 0, 10],
    [(org.funding_instruments?.length ?? 0) > 0, 10],
    [!!org.grant_range_min && !!org.grant_range_max, 5],
  ];
  return Math.round(weightedFields.reduce((sum, [done, weight]) => sum + (done ? weight : 0), 0));
}

function corporateCompleteness(org: any): number {
  const weightedFields: [boolean, number][] = [
    [!!org.csr_focus_statement, 25],
    [(org.geographic_focus?.length ?? 0) > 0, 20],
    [(org.mandate_sectors?.length ?? 0) > 0, 20],
    [(org.esg_frameworks?.length ?? 0) > 0, 15],
    [!!org.csr_budget_range, 10],
    [(org.inkind_support?.length ?? 0) > 0, 5],
    [(org.partner_type_preference?.length ?? 0) > 0, 5],
  ];
  return Math.round(weightedFields.reduce((sum, [done, weight]) => sum + (done ? weight : 0), 0));
}

// Array/JSON-string length helper -- organizations.sector is stored as a
// JSON-stringified TEXT column (see match-orgs-for-partnership's
// formatSectorDisplay, which has the same problem), not a real Postgres
// array, so a plain .length check silently passes on the string
// "[]" (length 2) and fails to detect a populated "Health" (length 8,
// but meaningless as an array length). Parses first, falls back to a
// truthy non-empty-string check.
function arrLen(raw: any): number {
  if (Array.isArray(raw)) return raw.length;
  if (typeof raw === "string" && raw.trim()) {
    try { const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed.length : (parsed ? 1 : 0); }
    catch { return raw.trim() ? 1 : 0; }
  }
  return 0;
}

// Fields actually collected at onboarding for every org type (see
// Onboarding.tsx's organizations insert), not funder/corporate-only
// mandate fields -- an implementer never has grant_range_min or
// csr_focus_statement, so scoring against those would cap every
// implementer below the eligibility threshold regardless of how complete
// their real profile is.
function implementerCompleteness(org: any): number {
  const weightedFields: [boolean, number][] = [
    [!!org.description, 25],
    [arrLen(org.sector) > 0, 20],
    [(org.needs?.length ?? 0) > 0, 20],
    [(org.offers?.length ?? 0) > 0, 15],
    [!!org.country, 10],
    [(org.mandate_sdgs?.length ?? 0) > 0, 10],
  ];
  return Math.round(weightedFields.reduce((sum, [done, weight]) => sum + (done ? weight : 0), 0));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const CRITERIA_VERSION = await getCriteriaVersion(serviceClient);

    const { data: { user }, error: userError } = await callerClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    // Owner -> own id. Active Member -> their Owner's id. Neither -> own id
    // (fallback, matches the client-side resolveOrgOwnerId() default).
    const { data: ownerId, error: ownerIdError } = await callerClient.rpc("resolve_org_owner_id");
    if (ownerIdError || !ownerId) {
      console.error(`[refresh-partnership-matches] resolve_org_owner_id failed for user ${user.id}: ${ownerIdError?.message}`);
      return new Response(JSON.stringify({ error: "Could not resolve organisation identity" }), {
        status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const { data: org, error: orgError } = await callerClient
      .from("organizations").select("*").eq("user_id", ownerId).maybeSingle();

    if (orgError || !org) {
      return new Response(JSON.stringify({ error: "No organisation profile found for this account" }), {
        status: 404, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const isFunder = FUNDER_TYPES.includes(org.organisation_type);
    const isCorporate = CORPORATE_TYPES.includes(org.organisation_type);
    const isConsultancy = org.organisation_type === "consultancy";
    // Implementer = anything else (NGOs, social enterprises, startups, etc.)
    const isImplementer = !isFunder && !isCorporate && !isConsultancy;

    if (org.flagged_visibility_hold) {
      return new Response(JSON.stringify({ eligible: false, reason: "flagged_visibility_hold" }), {
        status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    // AI-powered org-to-org matching is a Plus+ feature (see billing
    // scoping notes). Gate here, before any AI compute or cache read --
    // this endpoint is callable directly by anyone with a session, so
    // hiding the UI trigger alone wouldn't actually enforce the tier.
    if (org.subscription_tier === "free") {
      return new Response(JSON.stringify({ eligible: false, reason: "requires_upgrade", required_tier: "plus" }), {
        status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const completeness = isFunder ? funderCompleteness(org) : isCorporate ? corporateCompleteness(org) : implementerCompleteness(org);
    if (completeness < COMPLETENESS_THRESHOLD) {
      return new Response(JSON.stringify({ eligible: false, completeness }), {
        status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const { data: existingCache } = await callerClient
      .from("partnership_match_cache")
      .select("fit_score, rationale, key_synergy, matched_org_id, criteria, criteria_version, computed_at")
      .eq("org_id", org.id)
      .order("fit_score", { ascending: false });

    const newestComputedAt = existingCache?.[0]?.computed_at ? new Date(existingCache[0].computed_at).getTime() : 0;
    const ageHours = (Date.now() - newestComputedAt) / (1000 * 60 * 60);
    const isSchemaStale = !existingCache?.[0] || existingCache[0].criteria_version !== CRITERIA_VERSION;

    const { count: newerOrgCount } = await callerClient
      .from("organizations").select("id", { count: "exact", head: true })
      .neq("id", org.id)
      .gt("created_at", newestComputedAt ? new Date(newestComputedAt).toISOString() : "1970-01-01");

    const isStale = !existingCache || existingCache.length === 0 || ageHours >= CACHE_TTL_HOURS || (newerOrgCount ?? 0) > 0 || isSchemaStale;

    if (!isStale) {
      return new Response(JSON.stringify({
        eligible: true, completeness, cached: true,
        computed_at: existingCache[0].computed_at, matches: existingCache,
      }), { status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
    }

    const matchRes = await fetch(`${SUPABASE_URL}/functions/v1/match-orgs-for-partnership`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}` },
      body: JSON.stringify({ submitting_org: org, user_id: ownerId }),
    });

    if (!matchRes.ok) {
      const errText = await matchRes.text();
      return new Response(JSON.stringify({
        error: `Matching failed: ${errText}`, eligible: true, completeness,
        cached: existingCache && existingCache.length > 0,
        computed_at: existingCache?.[0]?.computed_at ?? null, matches: existingCache ?? [],
      }), { status: 502, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
    }

    const { matches } = await matchRes.json();
    const topMatches = (matches ?? []).slice(0, MAX_CACHED_MATCHES);

    const freshRows = topMatches.map((m: any) => ({
      matched_org_id: m.org_id,
      fit_score: m.fit_score,
      rationale: m.rationale,
      key_synergy: m.key_synergy ?? null,
      criteria: m.criteria ?? null,
      criteria_version: CRITERIA_VERSION,
    }));
    const keepIds = freshRows.map(r => r.matched_org_id);

    const { data: rpcResult, error: rpcError } = await serviceClient.rpc(
      "upsert_partnership_match_cache_batch",
      { p_org_id: org.id, p_fresh_rows: freshRows, p_keep_ids: keepIds }
    );

    if (rpcError) {
      return new Response(JSON.stringify({ error: `Cache write failed: ${rpcError.message}` }), {
        status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    return new Response(JSON.stringify({
      eligible: true, completeness, cached: false, computed_at: new Date().toISOString(),
      matches: freshRows.map((r: any) => ({
        matched_org_id: r.matched_org_id, fit_score: r.fit_score, rationale: r.rationale,
        key_synergy: r.key_synergy ?? null, criteria: r.criteria ?? null,
      })),
    }), { status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
});
