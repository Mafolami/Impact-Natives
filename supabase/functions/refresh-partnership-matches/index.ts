// supabase/functions/refresh-partnership-matches/index.ts
// Called by an authenticated user from Home. Resolves the caller's own org
// via their own session, checks eligibility and cache freshness, and only
// calls match-orgs-for-partnership (bulk mode) when actually needed.
//
// v27 (Oct 2026): PROPORTIONAL DD. Carries dd_status / dd_missing /
// deal_bucket from match-orgs-for-partnership into the cache and the
// response. Blending and ordering are now by DD tier first (complete/exempt,
// then tier_missing, then basics_incomplete), fit_score within each tier.
// v26 (14 Oct 2026): legacy JWT keys disabled after a leak. Uses the new
// publishable key (caller client) and secret key (service client and the
// internal match-orgs-for-partnership call). No logic change.
// v24: explicit column list on the org lookup (column-level grants).
// v23: listing-based completeness gate (weights mirror match scoring).
// v21-v22: listing-scoped matching, blended by best score per org.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function __envKeys(name: string): Record<string, string> {
  try { return JSON.parse(Deno.env.get(name) ?? "{}"); } catch { return {}; }
}
const SECRET_KEY = __envKeys("SUPABASE_SECRET_KEYS")["default"] ?? Object.values(__envKeys("SUPABASE_SECRET_KEYS"))[0] ?? "";
const PUBLISHABLE_KEY = __envKeys("SUPABASE_PUBLISHABLE_KEYS")["default"] ?? Object.values(__envKeys("SUPABASE_PUBLISHABLE_KEYS"))[0] ?? "";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = PUBLISHABLE_KEY;
const SUPABASE_SERVICE_KEY = SECRET_KEY;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CACHE_TTL_HOURS = 12;
const LISTING_COMPLETENESS_THRESHOLD = 80;
const MAX_CACHED_MATCHES = 10;
const CRITERIA_VERSION_FALLBACK = 3;
const MATCH_THRESHOLD = 45;
const HOME_DISPLAY_LIMIT = 3;

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

function arrLen(raw: any): number {
  if (Array.isArray(raw)) return raw.length;
  if (typeof raw === "string" && raw.trim()) {
    try { const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed.length : (parsed ? 1 : 0); }
    catch { return raw.trim() ? 1 : 0; }
  }
  return 0;
}

function listingCompleteness(listing: any): number {
  const weightedFields: [boolean, number][] = [
    [!!listing.sought && listing.sought.trim().length > 0, 35],
    [!!listing.budget, 15],
    [arrLen(listing.sector) > 0, 15],
    [!!listing.stage, 15],
    [!!listing.country, 10],
    [!!listing.working_style, 10],
  ];
  return Math.round(weightedFields.reduce((sum, [done, weight]) => sum + (done ? weight : 0), 0));
}

async function resolveOrgUserIds(supabase: any, org: any): Promise<string[]> {
  const { data: members } = await supabase
    .from("org_members")
    .select("user_id")
    .eq("org_id", org.id)
    .eq("status", "active");
  return [org.user_id, ...((members ?? []).map((m: any) => m.user_id))].filter(Boolean);
}

// Same ranking as dd.ts in the matching functions. Unknown status ranks last.
const DD_RANK: Record<string, number> = { complete: 0, exempt: 0, tier_missing: 1, basics_incomplete: 2 };
function ddRank(status: string | null | undefined): number {
  return status && status in DD_RANK ? DD_RANK[status] : 2;
}
function tierThenScore(a: any, b: any): number {
  return (ddRank(a.dd_status) - ddRank(b.dd_status)) || (b.fit_score - a.fit_score);
}

function blendByOrg(rows: any[]): any[] {
  const bestByOrg = new Map<string, any>();
  for (const r of rows) {
    const existing = bestByOrg.get(r.matched_org_id);
    if (!existing || tierThenScore(r, existing) < 0) bestByOrg.set(r.matched_org_id, r);
  }
  return Array.from(bestByOrg.values()).sort(tierThenScore);
}

async function attemptMatchCall(submitting_listing_id: string): Promise<{ ok: boolean; matches?: any[]; errText?: string }> {
  const matchRes = await fetch(`${SUPABASE_URL}/functions/v1/match-orgs-for-partnership`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`, "apikey": SUPABASE_SERVICE_KEY },
    body: JSON.stringify({ submitting_listing_id }),
  });
  if (!matchRes.ok) return { ok: false, errText: await matchRes.text() };
  const { matches } = await matchRes.json();
  return { ok: true, matches: matches ?? [] };
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

    const { data: ownerId, error: ownerIdError } = await callerClient.rpc("resolve_org_owner_id");
    if (ownerIdError || !ownerId) {
      console.error(`[refresh-partnership-matches] resolve_org_owner_id failed for user ${user.id}: ${ownerIdError?.message}`);
      return new Response(JSON.stringify({ error: "Could not resolve organisation identity" }), {
        status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const { data: org, error: orgError } = await callerClient
      .from("organizations").select("id, user_id, flagged_visibility_hold, subscription_tier").eq("user_id", ownerId).maybeSingle();

    if (orgError || !org) {
      return new Response(JSON.stringify({ error: "No organisation profile found for this account" }), {
        status: 404, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    if (org.flagged_visibility_hold) {
      return new Response(JSON.stringify({ eligible: false, reason: "flagged_visibility_hold" }), {
        status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    if (org.subscription_tier === "free") {
      return new Response(JSON.stringify({ eligible: false, reason: "requires_upgrade", required_tier: "plus" }), {
        status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const orgUserIds = await resolveOrgUserIds(serviceClient, org);
    const { data: allListings, error: listingsErr } = await serviceClient
      .from("partnership_listings")
      .select("id, sought, budget, sector, stage, country, working_style")
      .in("user_id", orgUserIds)
      .eq("status", "published");
    if (listingsErr) throw listingsErr;

    if (!allListings || allListings.length === 0) {
      return new Response(JSON.stringify({ eligible: true, completeness: 0, reason: "no_published_listing", matches: [] }), {
        status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const scoredListings = allListings.map((l: any) => ({ ...l, _completeness: listingCompleteness(l) }));
    const bestCompleteness = Math.max(...scoredListings.map((l: any) => l._completeness));
    const eligibleListings = scoredListings.filter((l: any) => l._completeness >= LISTING_COMPLETENESS_THRESHOLD);

    if (eligibleListings.length === 0) {
      return new Response(JSON.stringify({ eligible: true, completeness: bestCompleteness, reason: "listings_incomplete", matches: [] }), {
        status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const listingIds = eligibleListings.map((l: any) => l.id);

    const { data: existingCache } = await callerClient
      .from("partnership_match_cache")
      .select("fit_score, rationale, key_synergy, matched_org_id, matched_listing_id, criteria, criteria_version, computed_at, dd_status, dd_missing, deal_bucket")
      .in("submitting_listing_id", listingIds)
      .gte("fit_score", MATCH_THRESHOLD)
      .order("fit_score", { ascending: false });

    const computedTimestamps = (existingCache ?? []).map((r: any) => new Date(r.computed_at).getTime());
    const newestComputedAt = computedTimestamps.length > 0 ? Math.max(...computedTimestamps) : 0;
    const ageHours = (Date.now() - newestComputedAt) / (1000 * 60 * 60);
    const isSchemaStale = !existingCache?.length || existingCache.some((r: any) => r.criteria_version !== CRITERIA_VERSION);

    const { count: newerOrgCount } = await callerClient
      .from("organizations").select("id", { count: "exact", head: true })
      .neq("id", org.id)
      .gt("created_at", newestComputedAt ? new Date(newestComputedAt).toISOString() : "1970-01-01");

    const isStale = !existingCache || existingCache.length === 0 || ageHours >= CACHE_TTL_HOURS || (newerOrgCount ?? 0) > 0 || isSchemaStale;

    if (!isStale) {
      return new Response(JSON.stringify({
        eligible: true, completeness: bestCompleteness, cached: true,
        matches: blendByOrg(existingCache).slice(0, HOME_DISPLAY_LIMIT),
      }), { status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
    }

    const perListingResults = await Promise.all(listingIds.map(async (listingId: string) => {
      let matchResult = await attemptMatchCall(listingId);
      if (!matchResult.ok) matchResult = await attemptMatchCall(listingId);
      if (!matchResult.ok) {
        console.error(`[refresh-partnership-matches] listing ${listingId} match call failed after retry: ${matchResult.errText}`);
        return { listingId, matches: [] as any[] };
      }
      return { listingId, matches: matchResult.matches ?? [] };
    }));

    const allFreshRows: any[] = [];
    for (const { listingId, matches } of perListingResults) {
      const topMatches = matches.slice(0, MAX_CACHED_MATCHES);
      if (topMatches.length === 0) continue;

      const freshRows = topMatches.map((m: any) => ({
        org_id: org.id,
        matched_org_id: m.matched_org_id,
        matched_listing_id: m.matched_listing_id,
        fit_score: m.fit_score,
        rationale: m.rationale,
        key_synergy: m.key_synergy ?? null,
        criteria: m.criteria ?? null,
        criteria_version: CRITERIA_VERSION,
        dd_status: m.dd_status ?? null,
        dd_missing: m.dd_missing ?? [],
        deal_bucket: m.deal_bucket ?? null,
      }));
      const keepIds = freshRows.map((r: any) => r.matched_listing_id);

      const { error: rpcError } = await serviceClient.rpc(
        "upsert_partnership_listing_match_cache_batch",
        { p_submitting_listing_id: listingId, p_fresh_rows: freshRows, p_keep_ids: keepIds }
      );
      if (rpcError) console.error(`[refresh-partnership-matches] cache upsert RPC failed for listing ${listingId}: ${rpcError.message}`);

      allFreshRows.push(...freshRows);
    }

    return new Response(JSON.stringify({
      eligible: true, completeness: bestCompleteness, cached: false,
      matches: blendByOrg(allFreshRows).slice(0, HOME_DISPLAY_LIMIT).map((r: any) => ({
        matched_org_id: r.matched_org_id, matched_listing_id: r.matched_listing_id, fit_score: r.fit_score,
        rationale: r.rationale, key_synergy: r.key_synergy ?? null, criteria: r.criteria ?? null,
        dd_status: r.dd_status ?? null, dd_missing: r.dd_missing ?? [], deal_bucket: r.deal_bucket ?? null,
      })),
    }), { status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
});
