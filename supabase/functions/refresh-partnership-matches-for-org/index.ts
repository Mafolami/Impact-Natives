
// supabase/functions/refresh-partnership-matches-for-org/index.ts
// Internal-only worker: recomputes partnership matches for exactly ONE
// org, given its org_id.
//
// v10: architecture parity fix. Unlike its interactive sibling
// (refresh-partnership-matches) and both initiative-side workers
// (refresh-initiative-matches / refresh-initiative-matches-for-org),
// this cron path had no staleness check at all -- every monthly/nightly
// sweep run did a full recompute for every eligible org unconditionally,
// even if that org's cache was computed an hour ago and nothing about
// its profile or the candidate pool had changed. Ported the same
// isStale logic refresh-partnership-matches already uses: cache empty,
// schema version behind CRITERIA_VERSION, cache older than
// CACHE_TTL_HOURS, or a new org has joined since the last compute (so
// newcomers actually get considered as candidates instead of waiting up
// to CACHE_TTL_HOURS to first appear). Skipping when fresh means the
// sweep no longer spends a Groq call recomputing something that hasn't
// gone stale -- same cost-avoidance reasoning as the subscription_tier
// gate added in v9.
//
// Also added a single retry on a failed match-orgs-for-partnership call
// before giving up -- previously one failed call just left the cache
// untouched and moved on, no second attempt, mirroring the retry
// initiative-side batches already get.
//
// This does NOT add incremental (partial) scoring the way the
// initiative-side workers do -- match-orgs-for-partnership's bulk mode
// always scores its own full candidate pool internally rather than
// accepting a specific candidate-id list, so there's no way to ask it
// for "just the new ones" without changing its own candidate-selection
// logic. A stale run here is therefore still a full recompute, just a
// gated one. Left match-orgs-for-partnership itself untouched -- this
// parity fix is scoped to this worker only.
//
// v9: subscription_tier gate added, same reasoning as v17 of
// refresh-partnership-matches (the interactive sibling). Skipping here
// also means the nightly sweep never spends a Groq call computing AI
// matches for a Free-tier org in the first place -- this isn't just a UI
// gate, it removes the AI cost for orgs who shouldn't be getting the
// feature at all.
//
// v8: flagged_visibility_hold self-exclusion. If the org this worker is
// computing matches FOR is itself under a "Serious"-severity admin hold,
// skip -- a held org shouldn't receive fresh partnership matches while
// under review. Companion to v32 of match-orgs-for-partnership, which
// excludes held orgs from OTHER orgs' candidate pools; this is the other
// half (self-exclusion) of that same fix.
//
// v7: CRITERIA_VERSION moved out of a local hardcoded constant into the
// `criteria_versions` table (match_type='partnership') -- see
// refresh-initiative-matches v20 and refresh-partnership-matches v14 for
// the full reasoning. Extended here for consistency with the sibling
// on-demand path and the sweep, so all three partnership-matching
// functions read from one shared source of truth the same way the
// initiative-side ones now do.
//
// v6: replaced the select-protected -> delete-non-protected -> insert-fresh
// sequence (3 separate DB round trips, no transaction wrapping them) with
// a single atomic RPC call (upsert_partnership_match_cache_batch). That gap
// between steps was a real, reproduced race: a concurrent refresh for the
// same org (e.g. the nightly sweep overlapping an on-demand refresh) could
// read the cache mid-way through another refresh's delete/insert and
// misclassify a still-in-flight protected row as unprotected, permanently
// losing a real single-pair score from score-partnership-fit. Reproduced
// live during verification testing. The new RPC does the whole delete+
// upsert as one SQL statement with an ON CONFLICT ... WHERE clause, so
// Postgres guarantees there's no window for another call to interleave --
// a protected row is either left completely alone or it isn't, with
// nothing in between.
//
// v5: (superseded by v6's atomic fix, same underlying goal) made the cache
// write crash-safe against insert failures by only ever deleting
// non-protected rows up front.
//
// v3: fixed the Authorization header omission on the call to
// match-orgs-for-partnership (verify_jwt: true there rejected every call
// from this worker with a 401, which this worker then silently swallowed
// and returned 200 anyway -- so the nightly sweep reported success while
// doing zero real work). Now passes the same `Authorization: Bearer
// <service role key>` header that the working on-demand path
// (refresh-partnership-matches) already uses for this same call.
//
// v2: protected-row concept introduced -- a row with opening_message set
// was computed by a real single-pair click-through (score-partnership-fit),
// bulk mode never writes that field, so protected rows must survive every
// future bulk refresh untouched.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const COMPLETENESS_THRESHOLD = 80;
const MAX_CACHED_MATCHES = 10;
// Same TTL as the interactive sibling (refresh-partnership-matches), so a
// cron-refreshed cache and a click-refreshed cache go stale on the same
// schedule from the user's point of view.
const CACHE_TTL_HOURS = 12;
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
    console.error(`[refresh-partnership-matches-for-org] criteria_versions read failed, falling back to ${CRITERIA_VERSION_FALLBACK}: ${error?.message}`);
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

async function attemptMatchCall(org: any): Promise<{ ok: boolean; matches?: any[]; errText?: string }> {
  const matchRes = await fetch(`${SUPABASE_URL}/functions/v1/match-orgs-for-partnership`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}` },
    body: JSON.stringify({ submitting_org: org, user_id: org.user_id }),
  });
  if (!matchRes.ok) {
    return { ok: false, errText: await matchRes.text() };
  }
  const { matches } = await matchRes.json();
  return { ok: true, matches: matches ?? [] };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });

  try {
    const { org_id } = await req.json();
    if (!org_id) {
      return new Response(JSON.stringify({ error: "org_id is required" }), {
        status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const CRITERIA_VERSION = await getCriteriaVersion(serviceClient);

    const { data: org, error: orgError } = await serviceClient
      .from("organizations").select("*").eq("id", org_id).maybeSingle();

    if (orgError || !org) {
      return new Response(JSON.stringify({ error: "Org not found" }), {
        status: 404, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const isFunder = FUNDER_TYPES.includes(org.organisation_type);
    const isCorporate = CORPORATE_TYPES.includes(org.organisation_type);
    if (!isFunder && !isCorporate) {
      return new Response(JSON.stringify({ org_id, skipped: "org_type_not_supported" }), {
        status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    if (org.flagged_visibility_hold) {
      return new Response(JSON.stringify({ org_id, skipped: "flagged_visibility_hold" }), {
        status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    // AI-powered org-to-org matching is a Plus+ feature (see billing
    // scoping notes). Skip before any AI compute -- this is the cron path,
    // so this also means Free-tier orgs never cost a Groq call here at all.
    if (org.subscription_tier === "free") {
      return new Response(JSON.stringify({ org_id, skipped: "requires_upgrade" }), {
        status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const completeness = isFunder ? funderCompleteness(org) : corporateCompleteness(org);
    if (completeness < COMPLETENESS_THRESHOLD) {
      return new Response(JSON.stringify({ org_id, skipped: "below_completeness_threshold", completeness }), {
        status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    // Staleness gate -- mirrors refresh-partnership-matches (the
    // interactive sibling). Previously absent here entirely: every sweep
    // run recomputed unconditionally regardless of how fresh the existing
    // cache already was.
    const { data: existingCache } = await serviceClient
      .from("partnership_match_cache")
      .select("fit_score, rationale, key_synergy, matched_org_id, criteria, criteria_version, computed_at")
      .eq("org_id", org_id)
      .order("fit_score", { ascending: false });

    const computedTimestamps = (existingCache ?? []).map(r => new Date(r.computed_at).getTime());
    const newestComputedAt = computedTimestamps.length > 0 ? Math.max(...computedTimestamps) : 0;
    const ageHours = (Date.now() - newestComputedAt) / (1000 * 60 * 60);
    const isSchemaStale = !existingCache?.length || existingCache.some(r => r.criteria_version !== CRITERIA_VERSION);

    const { count: newerOrgCount } = await serviceClient
      .from("organizations").select("id", { count: "exact", head: true })
      .neq("id", org_id)
      .gt("created_at", newestComputedAt ? new Date(newestComputedAt).toISOString() : "1970-01-01");

    const isStale = !existingCache || existingCache.length === 0 || ageHours >= CACHE_TTL_HOURS || (newerOrgCount ?? 0) > 0 || isSchemaStale;

    if (!isStale) {
      return new Response(JSON.stringify({
        org_id, skipped: "cache_fresh", matches_cached: existingCache.length,
      }), { status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
    }

    let matchResult = await attemptMatchCall(org);
    if (!matchResult.ok) {
      console.error(`[refresh-partnership-matches-for-org] org ${org_id} match call failed, retrying once: ${matchResult.errText}`);
      matchResult = await attemptMatchCall(org);
    }

    if (!matchResult.ok) {
      console.error(`[refresh-partnership-matches-for-org] org ${org_id} match call failed after retry: ${matchResult.errText}`);
      return new Response(JSON.stringify({ org_id, error: "match call failed after retry, cache untouched" }), {
        status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const matches = matchResult.matches ?? [];
    const topMatches = matches.slice(0, MAX_CACHED_MATCHES);

    if (matches.length === 0) {
      console.error(`[refresh-partnership-matches-for-org] org ${org_id} produced no matches this run, leaving existing cache untouched`);
      return new Response(JSON.stringify({ org_id, matches_cached: 0, note: "no results, cache untouched" }), {
        status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

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
      { p_org_id: org_id, p_fresh_rows: freshRows, p_keep_ids: keepIds }
    );

    if (rpcError) {
      console.error(`[refresh-partnership-matches-for-org] cache upsert RPC failed for org ${org_id}: ${rpcError.message}`);
      return new Response(JSON.stringify({ error: `Cache write failed: ${rpcError.message}` }), {
        status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const row = Array.isArray(rpcResult) ? rpcResult[0] : rpcResult;
    return new Response(JSON.stringify({
      org_id,
      matches_cached: row?.matches_cached ?? 0,
      protected_preserved: row?.protected_preserved ?? 0,
    }), {
      status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });

  } catch (err) {
    console.error(`[refresh-partnership-matches-for-org] Uncaught exception: ${String(err)}`);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
});

