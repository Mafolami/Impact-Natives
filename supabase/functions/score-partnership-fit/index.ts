// supabase/functions/score-partnership-fit/index.ts
// Powers the directory's "Your fit analysis" box.
//
// v17 (21 Oct 2026): admins and demo-org accounts can get a fit analysis
// on DEMO listings (the directory shows demo listings only to them, via
// RLS). Passes allow_demo_target to match-orgs-for-partnership only for
// those callers, and never caches a fit against a demo listing, so demo
// orgs can't leak into homepage match paints from the cache.
// v15 (Oct 2026): PROPORTIONAL DD. Carries dd_status / dd_missing /
// deal_bucket (judged per viewer-listing / target-listing pair) into the
// cache and the response. The primary listing is chosen by DD tier first,
// then fit_score, same as everywhere else.
// v14 (14 Oct 2026): caller must be signed in AND be the viewer org's owner,
// an active member, or an admin. Before this the function trusted the
// viewer_org_id in the request body, so anyone with the public key could
// run scoring as any paid org and read its cached fit analysis.
// v13 (14 Oct 2026): legacy JWT keys disabled after a leak. Uses the new
// secret API key (SUPABASE_SECRET_KEYS) for DB access and for the internal
// call to match-orgs-for-partnership. No logic change.
// v11: throttled fan-out (MAX_CONCURRENT_COMPUTES).
// v10: listing-scoped, scores against every open viewer listing, cached
// per (submitting_listing_id, target_listing_id).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function __envKeys(name: string): Record<string, string> {
  try { return JSON.parse(Deno.env.get(name) ?? "{}"); } catch { return {}; }
}
const SECRET_KEY = __envKeys("SUPABASE_SECRET_KEYS")["default"] ?? Object.values(__envKeys("SUPABASE_SECRET_KEYS"))[0] ?? "";
const PUBLISHABLE_KEY = __envKeys("SUPABASE_PUBLISHABLE_KEYS")["default"] ?? Object.values(__envKeys("SUPABASE_PUBLISHABLE_KEYS"))[0] ?? "";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = SECRET_KEY;
const CACHE_TTL_HOURS = 24;
const CRITERIA_VERSION_FALLBACK = 3;
const ALSO_FITS_THRESHOLD = 45;
const MAX_CONCURRENT_COMPUTES = 2;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function getCriteriaVersion(): Promise<number> {
  const { data, error } = await serviceClient
    .from("criteria_versions")
    .select("version")
    .eq("match_type", "partnership")
    .maybeSingle();
  if (error || !data) {
    console.error(`[score-partnership-fit] criteria_versions read failed, falling back to ${CRITERIA_VERSION_FALLBACK}: ${error?.message}`);
    return CRITERIA_VERSION_FALLBACK;
  }
  return data.version;
}

async function resolveOrgUserIds(org: any): Promise<string[]> {
  const { data: members } = await serviceClient
    .from("org_members")
    .select("user_id")
    .eq("org_id", org.id)
    .eq("status", "active");
  return [org.user_id, ...((members ?? []).map((m: any) => m.user_id))].filter(Boolean);
}

async function computeOne(listingId: string, targetListingId: string, allowDemoTarget: boolean): Promise<any | null> {
  const matchRes = await fetch(`${SUPABASE_URL}/functions/v1/match-orgs-for-partnership`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`, "apikey": SUPABASE_SERVICE_KEY },
    body: JSON.stringify({ submitting_listing_id: listingId, target_listing_id: targetListingId, allow_demo_target: allowDemoTarget }),
  });
  if (!matchRes.ok) {
    console.error(`[score-partnership-fit] match call failed for listing ${listingId}: ${await matchRes.text()}`);
    return null;
  }
  const { matches } = await matchRes.json();
  return matches?.[0] ?? null;
}

// Same ranking as dd.ts in the matching functions. Unknown status ranks last.
const DD_RANK: Record<string, number> = { complete: 0, exempt: 0, tier_missing: 1, basics_incomplete: 2 };
function ddRank(status: string | null | undefined): number {
  return status && status in DD_RANK ? DD_RANK[status] : 2;
}

async function runWithConcurrencyLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const idx = cursor++;
      await fn(items[idx]);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const callerClient = createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await callerClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const { viewer_org_id, target_listing_id } = await req.json();
    if (!viewer_org_id || !target_listing_id) {
      return new Response(JSON.stringify({ error: "viewer_org_id and target_listing_id are required" }), {
        status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const CRITERIA_VERSION = await getCriteriaVersion();

    const { data: viewerOrg, error: viewerOrgErr } = await serviceClient
      .from("organizations")
      .select("id, user_id, flagged_visibility_hold, subscription_tier, is_demo_org")
      .eq("id", viewer_org_id)
      .maybeSingle();
    if (viewerOrgErr || !viewerOrg) {
      return new Response(JSON.stringify({ error: "Viewer organisation not found" }), {
        status: 404, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const orgUserIds = await resolveOrgUserIds(viewerOrg);
    const { data: callerProfile } = await serviceClient
      .from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
    const callerIsAdmin = !!callerProfile?.is_admin;
    // Demo listings are only visible to admins and demo accounts, so only
    // they may have one scored.
    const allowDemoTarget = callerIsAdmin || !!viewerOrg.is_demo_org;
    if (!orgUserIds.includes(user.id)) {
      if (!callerIsAdmin) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        });
      }
    }

    if (viewerOrg.flagged_visibility_hold) {
      return new Response(JSON.stringify({ eligible: false, reason: "flagged_visibility_hold" }), {
        status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }
    if (viewerOrg.subscription_tier === "free") {
      return new Response(JSON.stringify({ eligible: false, reason: "requires_upgrade", required_tier: "plus" }), {
        status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const { data: viewerListings, error: listingsErr } = await serviceClient
      .from("partnership_listings")
      .select("id, title")
      .in("user_id", orgUserIds)
      .eq("status", "published");
    if (listingsErr) throw listingsErr;

    if (!viewerListings || viewerListings.length === 0) {
      return new Response(JSON.stringify({ eligible: true, reason: "no_published_listing" }), {
        status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const listingIds = viewerListings.map((l: any) => l.id);
    const { data: existingRows } = await serviceClient
      .from("partnership_match_cache")
      .select("submitting_listing_id, matched_org_id, fit_score, rationale, key_synergy, criteria, reasons, gaps, opening_message, criteria_version, computed_at, dd_status, dd_missing, deal_bucket")
      .in("submitting_listing_id", listingIds)
      .eq("matched_listing_id", target_listing_id);

    const cacheByListingId = new Map<string, any>((existingRows ?? []).map((r: any) => [r.submitting_listing_id, r]));
    const now = Date.now();

    const results: { listingId: string; listingTitle: string; fitScore: number; rationale: string; keySynergy: string | null; criteria: any; reasons: string[]; gaps: string[]; openingMessage: string | null; ddStatus: string | null; ddMissing: string[]; dealBucket: string | null }[] = [];

    const needsCompute: any[] = [];
    for (const listing of viewerListings) {
      const cached = cacheByListingId.get(listing.id);
      const ageHours = cached ? (now - new Date(cached.computed_at).getTime()) / (1000 * 60 * 60) : Infinity;
      const isFresh = !!cached && ageHours < CACHE_TTL_HOURS
        && cached.criteria_version === CRITERIA_VERSION
        && cached.opening_message != null;

      if (isFresh) {
        results.push({
          listingId: listing.id, listingTitle: listing.title,
          fitScore: cached.fit_score, rationale: cached.rationale, keySynergy: cached.key_synergy,
          criteria: cached.criteria, reasons: cached.reasons ?? [], gaps: cached.gaps ?? [],
          openingMessage: cached.opening_message,
          ddStatus: cached.dd_status ?? null, ddMissing: cached.dd_missing ?? [], dealBucket: cached.deal_bucket ?? null,
        });
        continue;
      }
      needsCompute.push(listing);
    }

    await runWithConcurrencyLimit(needsCompute, MAX_CONCURRENT_COMPUTES, async (listing: any) => {
      const m = await computeOne(listing.id, target_listing_id, allowDemoTarget);
      if (!m) return;

      results.push({
        listingId: listing.id, listingTitle: listing.title,
        fitScore: m.fit_score, rationale: m.rationale, keySynergy: m.key_synergy ?? null,
        criteria: m.criteria ?? null, reasons: m.reasons ?? [], gaps: m.gaps ?? [],
        openingMessage: m.opening_message ?? null,
        ddStatus: m.dd_status ?? null, ddMissing: m.dd_missing ?? [], dealBucket: m.deal_bucket ?? null,
      });

      // Never cache a fit against a demo listing (keeps demo orgs out of
      // homepage match paints, which read this cache).
      if (m.matched_is_demo) return;
      serviceClient.from("partnership_match_cache").upsert({
        org_id: viewerOrg.id,
        matched_org_id: m.matched_org_id,
        submitting_listing_id: listing.id,
        matched_listing_id: target_listing_id,
        fit_score: m.fit_score,
        rationale: m.rationale ?? null,
        key_synergy: m.key_synergy ?? null,
        criteria: m.criteria ?? null,
        reasons: m.reasons?.length ? m.reasons : null,
        gaps: m.gaps?.length ? m.gaps : null,
        opening_message: m.opening_message ?? null,
        criteria_version: CRITERIA_VERSION,
        computed_at: new Date().toISOString(),
        dd_status: m.dd_status ?? null,
        dd_missing: m.dd_missing ?? [],
        deal_bucket: m.deal_bucket ?? null,
      }, { onConflict: "submitting_listing_id,matched_listing_id" }).then(({ error }) => {
        if (error) console.error("[score-partnership-fit] cache write failed:", error.message);
      });
    });

    if (results.length === 0) {
      return new Response(JSON.stringify({ error: "This listing is not an eligible candidate to score against." }), {
        status: 404, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    results.sort((a, b) => (ddRank(a.ddStatus) - ddRank(b.ddStatus)) || (b.fitScore - a.fitScore));
    const [primary, ...rest] = results;
    const alsoFits = rest.filter(r => r.fitScore >= ALSO_FITS_THRESHOLD)
      .map(r => ({ listing_id: r.listingId, listing_title: r.listingTitle, fit_score: r.fitScore, dd_status: r.ddStatus }));

    return new Response(JSON.stringify({
      eligible: true,
      primary: {
        listing_id: primary.listingId, listing_title: primary.listingTitle,
        fit_score: primary.fitScore, rationale: primary.rationale, key_synergy: primary.keySynergy,
        criteria: primary.criteria, reasons: primary.reasons, gaps: primary.gaps,
        opening_message: primary.openingMessage,
        dd_status: primary.ddStatus, dd_missing: primary.ddMissing, deal_bucket: primary.dealBucket,
      },
      also_fits: alsoFits,
    }), { status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });

  } catch (err) {
    console.error(`[score-partnership-fit] Uncaught exception: ${String(err)}`);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
});
