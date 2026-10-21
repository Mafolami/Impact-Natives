// supabase/functions/refresh-partnership-matches-for-org/index.ts
// Internal-only worker: recomputes partnership matches for exactly ONE
// org, given its org_id. Only caller: sweep-stale-partnership-matches.
//
// v19 (Oct 2026): PROPORTIONAL DD. Writes dd_status / dd_missing /
// deal_bucket from match-orgs-for-partnership into the cache. No other
// change (matches already arrive sorted by DD tier, then fit_score).
// v18 (14 Oct 2026): legacy JWT keys disabled after a leak. Uses the new
// secret API key (SUPABASE_SECRET_KEYS) and rejects any call without it.
// Before this it accepted calls from anyone (verify_jwt was off, no check).
//
// v16: LISTING-BASED COMPLETENESS GATE (per published listing, 80%).
// v12: LISTING-SCOPED, runs match-orgs-for-partnership once per listing.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function __envKeys(name: string): Record<string, string> {
  try { return JSON.parse(Deno.env.get(name) ?? "{}"); } catch { return {}; }
}
const __SECRET_KEYS = Object.values(__envKeys("SUPABASE_SECRET_KEYS"));
const SECRET_KEY = __envKeys("SUPABASE_SECRET_KEYS")["default"] ?? __SECRET_KEYS[0] ?? "";
function isServerCall(req: Request): boolean {
  if (__SECRET_KEYS.length === 0) return false;
  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const apikey = req.headers.get("apikey") ?? "";
  return __SECRET_KEYS.includes(bearer) || __SECRET_KEYS.includes(apikey);
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = SECRET_KEY;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_CACHED_MATCHES = 10;
const CACHE_TTL_HOURS = 12;
const LISTING_COMPLETENESS_THRESHOLD = 80;
const CRITERIA_VERSION_FALLBACK = 3;

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

async function attemptMatchCall(submitting_listing_id: string): Promise<{ ok: boolean; matches?: any[]; errText?: string }> {
  const matchRes = await fetch(`${SUPABASE_URL}/functions/v1/match-orgs-for-partnership`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SECRET_KEY}`, "apikey": SECRET_KEY },
    body: JSON.stringify({ submitting_listing_id }),
  });
  if (!matchRes.ok) {
    return { ok: false, errText: await matchRes.text() };
  }
  const { matches } = await matchRes.json();
  return { ok: true, matches: matches ?? [] };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (!isServerCall(req)) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
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

    if (org.flagged_visibility_hold) {
      return new Response(JSON.stringify({ org_id, skipped: "flagged_visibility_hold" }), {
        status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    if (org.subscription_tier === "free") {
      return new Response(JSON.stringify({ org_id, skipped: "requires_upgrade" }), {
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
      return new Response(JSON.stringify({ org_id, skipped: "no_published_listings" }), {
        status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const eligibleListings = allListings.filter((l: any) => listingCompleteness(l) >= LISTING_COMPLETENESS_THRESHOLD);
    if (eligibleListings.length === 0) {
      return new Response(JSON.stringify({ org_id, skipped: "listings_incomplete" }), {
        status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const listingIds = eligibleListings.map((l: any) => l.id);

    const { data: existingCache } = await serviceClient
      .from("partnership_match_cache")
      .select("criteria_version, computed_at")
      .in("submitting_listing_id", listingIds)
      .order("computed_at", { ascending: false })
      .limit(1);

    const newestComputedAt = existingCache?.[0]?.computed_at ? new Date(existingCache[0].computed_at).getTime() : 0;
    const ageHours = (Date.now() - newestComputedAt) / (1000 * 60 * 60);
    const isSchemaStale = !existingCache?.[0] || existingCache[0].criteria_version !== CRITERIA_VERSION;

    const { count: newerOrgCount } = await serviceClient
      .from("organizations").select("id", { count: "exact", head: true })
      .neq("id", org_id)
      .gt("created_at", newestComputedAt ? new Date(newestComputedAt).toISOString() : "1970-01-01");

    const isStale = !existingCache || existingCache.length === 0 || ageHours >= CACHE_TTL_HOURS || (newerOrgCount ?? 0) > 0 || isSchemaStale;

    if (!isStale) {
      return new Response(JSON.stringify({ org_id, skipped: "cache_fresh", listings: listingIds.length }), {
        status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const perListingResults = await Promise.all(listingIds.map(async (listingId: string) => {
      let matchResult = await attemptMatchCall(listingId);
      if (!matchResult.ok) {
        console.error(`[refresh-partnership-matches-for-org] listing ${listingId} match call failed, retrying once: ${matchResult.errText}`);
        matchResult = await attemptMatchCall(listingId);
      }
      if (!matchResult.ok) {
        console.error(`[refresh-partnership-matches-for-org] listing ${listingId} match call failed after retry: ${matchResult.errText}`);
        return { listingId, matches_cached: 0, error: "match call failed after retry" };
      }

      const matches = matchResult.matches ?? [];
      const topMatches = matches.slice(0, MAX_CACHED_MATCHES);
      if (topMatches.length === 0) {
        return { listingId, matches_cached: 0, note: "no results, cache untouched for this listing" };
      }

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

      const { data: rpcResult, error: rpcError } = await serviceClient.rpc(
        "upsert_partnership_listing_match_cache_batch",
        { p_submitting_listing_id: listingId, p_fresh_rows: freshRows, p_keep_ids: keepIds }
      );
      if (rpcError) {
        console.error(`[refresh-partnership-matches-for-org] cache upsert RPC failed for listing ${listingId}: ${rpcError.message}`);
        return { listingId, error: `Cache write failed: ${rpcError.message}` };
      }
      const row = Array.isArray(rpcResult) ? rpcResult[0] : rpcResult;
      return { listingId, matches_cached: row?.matches_cached ?? 0, protected_preserved: row?.protected_preserved ?? 0 };
    }));

    return new Response(JSON.stringify({ org_id, listings: perListingResults }), {
      status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });

  } catch (err) {
    console.error(`[refresh-partnership-matches-for-org] Uncaught exception: ${String(err)}`);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
});
