// supabase/functions/refresh-partnership-matches/index.ts
// Called by an authenticated user from Home. Resolves the caller's own org
// via their own session (RLS-scoped — they can never touch another org's
// cache), checks profile completeness and cache freshness, and only calls
// match-orgs-for-partnership (the Groq-backed scorer) when actually needed.

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

const FUNDER_TYPES = ["philanthropic_foundation", "venture_capital"];
const CORPORATE_TYPES = ["corporation", "technology_company", "public_sector"];

// Mirrors the mandateScore calculation already used in DashboardFunderHome.tsx.
function funderCompleteness(org: any): number {
  const fields = [
    !!org.grant_range_min,
    !!org.grant_range_max,
    (org.funding_instruments?.length ?? 0) > 0,
    (org.geographic_focus?.length ?? 0) > 0,
    (org.stage_preference?.length ?? 0) > 0,
    (org.mandate_sectors?.length ?? 0) > 0,
    (org.mandate_sdgs?.length ?? 0) > 0,
  ];
  return Math.round((fields.filter(Boolean).length / fields.length) * 100);
}

// Parallel 7-field score for corporate orgs, using the same CSR/ESG fields
// match-orgs-for-partnership already reads for its corporate-type block.
function corporateCompleteness(org: any): number {
  const fields = [
    !!org.csr_focus_statement,
    !!org.csr_budget_range,
    (org.esg_frameworks?.length ?? 0) > 0,
    (org.inkind_support?.length ?? 0) > 0,
    (org.partner_type_preference?.length ?? 0) > 0,
    (org.geographic_focus?.length ?? 0) > 0,
    (org.mandate_sectors?.length ?? 0) > 0,
  ];
  return Math.round((fields.filter(Boolean).length / fields.length) * 100);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";

    // Scoped to the caller's own session — RLS means this client can only
    // ever see the caller's own organizations row, regardless of what's
    // passed in the request body. There is no org_id parameter to spoof.
    const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await callerClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const { data: org, error: orgError } = await callerClient
      .from("organizations")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (orgError || !org) {
      return new Response(JSON.stringify({ error: "No organisation profile found for this account" }), {
        status: 404, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const isFunder = FUNDER_TYPES.includes(org.organisation_type);
    const isCorporate = CORPORATE_TYPES.includes(org.organisation_type);

    if (!isFunder && !isCorporate) {
      return new Response(JSON.stringify({ eligible: false, reason: "org_type_not_supported" }), {
        status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const completeness = isFunder ? funderCompleteness(org) : corporateCompleteness(org);
    if (completeness < COMPLETENESS_THRESHOLD) {
      return new Response(JSON.stringify({ eligible: false, completeness }), {
        status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    // Check cache freshness using the caller's own scoped client — their
    // read policy already restricts this to their own org's rows.
    const { data: existingCache } = await callerClient
      .from("partnership_match_cache")
      .select("fit_score, rationale, key_synergy, matched_org_id, computed_at")
      .eq("org_id", org.id)
      .order("fit_score", { ascending: false });

    const newestComputedAt = existingCache?.[0]?.computed_at
      ? new Date(existingCache[0].computed_at).getTime()
      : 0;
    const ageHours = (Date.now() - newestComputedAt) / (1000 * 60 * 60);

    if (existingCache && existingCache.length > 0 && ageHours < CACHE_TTL_HOURS) {
      return new Response(JSON.stringify({
        eligible: true,
        completeness,
        cached: true,
        computed_at: existingCache[0].computed_at,
        matches: existingCache,
      }), {
        status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    // Cache is stale or missing — recompute via the existing AI-scored matcher.
    const matchRes = await fetch(`${SUPABASE_URL}/functions/v1/match-orgs-for-partnership`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({ submitting_org: org, user_id: user.id }),
    });

    if (!matchRes.ok) {
      const errText = await matchRes.text();
      return new Response(JSON.stringify({ error: `Matching failed: ${errText}` }), {
        status: 502, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const { matches } = await matchRes.json();
    const topMatches = (matches ?? []).slice(0, MAX_CACHED_MATCHES);

    // Writes need the service role — authenticated only has SELECT on this table.
    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    await serviceClient.from("partnership_match_cache").delete().eq("org_id", org.id);

    if (topMatches.length > 0) {
      const now = new Date().toISOString();
      const rows = topMatches.map((m: any) => ({
        org_id: org.id,
        matched_org_id: m.org_id,
        fit_score: m.fit_score,
        rationale: m.rationale,
        key_synergy: m.key_synergy ?? null,
        computed_at: now,
      }));
      const { error: insertError } = await serviceClient.from("partnership_match_cache").insert(rows);
      if (insertError) {
        return new Response(JSON.stringify({ error: `Cache write failed: ${insertError.message}` }), {
          status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        });
      }
    }

    return new Response(JSON.stringify({
      eligible: true,
      completeness,
      cached: false,
      computed_at: new Date().toISOString(),
      matches: topMatches.map((m: any) => ({
        matched_org_id: m.org_id,
        fit_score: m.fit_score,
        rationale: m.rationale,
        key_synergy: m.key_synergy ?? null,
      })),
    }), {
      status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
});
