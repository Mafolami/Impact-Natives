// supabase/functions/score-partnership-fit/index.ts
// v8: subscription_tier gate added, same reasoning as refresh-partnership-
// matches / refresh-partnership-matches-for-org. Reuses the existing
// server-side lookup of the viewer org's row (already fetched to check
// flagged_visibility_hold, since viewer_org arrives untrusted in the
// request body) -- just adds subscription_tier to that same select rather
// than a second round trip.
//
// v7: flagged_visibility_hold self-exclusion for the viewer. viewer_org
// arrives directly from the request body (never fetched server-side in
// this function), so it can't be trusted the way refresh-partnership-
// matches / refresh-partnership-matches-for-org trust their own DB-fetched
// org row -- an explicit lookup by id is needed here instead. Companion to
// v32 of match-orgs-for-partnership (candidate-side exclusion, which this
// function already inherits automatically since its single-pair call
// reuses that same candidateQuery) and v8/v15 of the two refresh workers
// (same self-exclusion, different call paths).
//
// v6: no longer runs its own independent scoring prompt. It's a thin proxy
// onto match-orgs-for-partnership's single-pair mode -- the same function
// and same scoring logic that powers the Home page's match cards. This is
// what guarantees the fit score for a given pair of orgs is identical
// wherever it's shown in the app; before this change, this function used a
// separate prompt/model and could (and did) produce a different number for
// the same pair than the Home cards did.
//
// Reads/writes partnership_match_cache directly (org_id = viewer, matched_org_id
// = listing) -- the same table Home's refresh-partnership-matches writes to.
// A pair already cached from Home browsing shows up here instantly; a pair
// never computed gets a live single-pair call. Cache is stale if older than
// 24h, either org's profile changed since, or the row predates CRITERIA_VERSION.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CACHE_TTL_HOURS = 24;
const CRITERIA_VERSION = 3;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });

  try {
    const { viewer_org, listing_org } = await req.json();

    if (!viewer_org?.id || !listing_org?.id) return new Response(
      JSON.stringify({ error: "viewer_org and listing_org (with id) are required" }),
      { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );

    const { data: viewerOrgRow } = await serviceClient
      .from("organizations")
      .select("flagged_visibility_hold, subscription_tier")
      .eq("id", viewer_org.id)
      .maybeSingle();

    if (viewerOrgRow?.flagged_visibility_hold) {
      return new Response(JSON.stringify({ error: "This organisation's matching is currently on hold pending review." }), {
        status: 403, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    // Instant AI fit analysis is a Plus+ feature (see billing scoping
    // notes). Same gate as the bulk-matching path, applied here too since
    // this is a separate call path a Free-tier org could otherwise hit
    // directly to get a real AI-scored fit for free.
    if (viewerOrgRow?.subscription_tier === "free") {
      return new Response(JSON.stringify({
        error: "Instant AI fit analysis requires a Plus plan or higher.",
        requires_upgrade: true, required_tier: "plus",
      }), {
        status: 403, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const { data: cached } = await serviceClient
      .from("partnership_match_cache")
      .select("fit_score, reasons, gaps, rationale, opening_message, criteria, criteria_version, computed_at")
      .eq("org_id", viewer_org.id)
      .eq("matched_org_id", listing_org.id)
      .maybeSingle();

    if (cached) {
      const computedAtMs = new Date(cached.computed_at).getTime();
      const ageHours = (Date.now() - computedAtMs) / (1000 * 60 * 60);
      const viewerUpdatedMs = viewer_org.updated_at ? new Date(viewer_org.updated_at).getTime() : 0;
      const listingUpdatedMs = listing_org.updated_at ? new Date(listing_org.updated_at).getTime() : 0;
      const eitherProfileChanged = viewerUpdatedMs > computedAtMs || listingUpdatedMs > computedAtMs;
      // A row written by Home's bulk mode has no opening_message -- that field
      // only gets filled by single-pair mode. Treat as stale so this pair
      // gets a real single-pair compute the first time it's actually viewed.
      const hasFullDetail = cached.opening_message != null;
      const isFresh = ageHours < CACHE_TTL_HOURS && !eitherProfileChanged
        && cached.criteria_version === CRITERIA_VERSION && hasFullDetail;

      if (isFresh) {
        return new Response(JSON.stringify({
          result: {
            fit_score: cached.fit_score,
            reasons: cached.reasons ?? [],
            gaps: cached.gaps ?? [],
            rationale: cached.rationale,
            opening_message: cached.opening_message,
          },
          cached: true,
        }), { status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
      }
    }

    const matchRes = await fetch(`${SUPABASE_URL}/functions/v1/match-orgs-for-partnership`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}` },
      body: JSON.stringify({ submitting_org: viewer_org, target_org_id: listing_org.id }),
    });

    if (!matchRes.ok) {
      const err = await matchRes.text();
      // Compute failed -- leave any existing cache untouched, same
      // never-clear-a-good-result principle as before.
      return new Response(JSON.stringify({ error: `Matching failed: ${err}` }), {
        status: 502, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const { matches } = await matchRes.json();
    const result = matches?.[0];

    if (!result) {
      // The listing org isn't (or no longer) an eligible candidate -- e.g. it
      // doesn't have an active posted partnership request. Nothing to score.
      return new Response(JSON.stringify({ error: "This organisation does not have an active partnership request to score against." }), {
        status: 404, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    serviceClient.from("partnership_match_cache").upsert({
      org_id: viewer_org.id,
      matched_org_id: listing_org.id,
      fit_score: result.fit_score,
      rationale: result.rationale ?? null,
      key_synergy: result.key_synergy ?? null,
      criteria: result.criteria ?? null,
      reasons: result.reasons?.length ? result.reasons : null,
      gaps: result.gaps?.length ? result.gaps : null,
      opening_message: result.opening_message ?? null,
      criteria_version: CRITERIA_VERSION,
      computed_at: new Date().toISOString(),
    }, { onConflict: "org_id,matched_org_id" }).then(({ error }) => {
      if (error) console.error("partnership_match_cache write failed:", error.message);
    });

    return new Response(JSON.stringify({
      result: {
        fit_score: result.fit_score,
        reasons: result.reasons ?? [],
        gaps: result.gaps ?? [],
        rationale: result.rationale,
        opening_message: result.opening_message,
      },
      cached: false,
    }), { status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
});
