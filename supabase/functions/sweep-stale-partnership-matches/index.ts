// supabase/functions/sweep-stale-partnership-matches/index.ts
// Cron-only backstop for partnership_match_cache. Invoked by pg_cron via
// net.http_post -- dispatch-only (one refresh-partnership-matches-for-org call
// per stale org, staggered).
//
// v5 (14 Oct 2026): legacy JWT keys disabled after a leak. Uses the new secret
// API key (SUPABASE_SECRET_KEYS), accepts only calls carrying it, and sends it
// when dispatching (dispatches used to carry no auth at all).
//
// v2: CRITERIA_VERSION read from the `criteria_versions` table.
// Only considers orgs that clear the 80% completeness gate.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const EdgeRuntime: { waitUntil: (promise: Promise<unknown>) => void };

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

const CACHE_TTL_HOURS = 12;
// Fallback only -- real value read from criteria_versions at request time.
const CRITERIA_VERSION_FALLBACK = 3;
const COMPLETENESS_THRESHOLD = 80;
const MAX_ORGS_PER_SWEEP = 4;
const DISPATCH_STAGGER_MS = 2000;

const FUNDER_TYPES = ["philanthropic_foundation", "venture_capital"];
const CORPORATE_TYPES = ["corporation", "technology_company", "public_sector"];

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getCriteriaVersion(client: any): Promise<number> {
  const { data, error } = await client
    .from("criteria_versions")
    .select("version")
    .eq("match_type", "partnership")
    .maybeSingle();
  if (error || !data) {
    console.error(`[sweep-stale-partnership-matches] criteria_versions read failed, falling back to ${CRITERIA_VERSION_FALLBACK}: ${error?.message}`);
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (!isServerCall(req)) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  try {
    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const CRITERIA_VERSION = await getCriteriaVersion(serviceClient);

    const { data: orgs } = await serviceClient
      .from("organizations")
      .select("*")
      .in("organisation_type", [...FUNDER_TYPES, ...CORPORATE_TYPES]);

    if (!orgs?.length) {
      return new Response(JSON.stringify({ dispatched: [], eligible_count: 0, stale_found: 0, stale_remaining: 0 }), {
        status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const eligibleOrgs = orgs.filter((org: any) => {
      const isFunder = FUNDER_TYPES.includes(org.organisation_type);
      const completeness = isFunder ? funderCompleteness(org) : corporateCompleteness(org);
      return completeness >= COMPLETENESS_THRESHOLD;
    });

    if (eligibleOrgs.length === 0) {
      return new Response(JSON.stringify({ dispatched: [], eligible_count: 0, stale_found: 0, stale_remaining: 0 }), {
        status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const { data: cacheRows } = await serviceClient
      .from("partnership_match_cache")
      .select("org_id, computed_at, criteria_version");
    const cacheByOrg = new Map<string, { computed_at: string; criteria_version: number }>();
    for (const row of cacheRows ?? []) {
      const existing = cacheByOrg.get(row.org_id);
      if (!existing || new Date(row.computed_at) > new Date(existing.computed_at)) {
        cacheByOrg.set(row.org_id, row);
      }
    }

    const { data: latestOrg } = await serviceClient
      .from("organizations")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const latestOrgAt = latestOrg?.created_at ? new Date(latestOrg.created_at).getTime() : 0;

    const now = Date.now();
    const staleOrgs = eligibleOrgs.filter((org: any) => {
      const cache = cacheByOrg.get(org.id);
      if (!cache) return true;
      const ageHours = (now - new Date(cache.computed_at).getTime()) / (1000 * 60 * 60);
      const isSchemaStale = cache.criteria_version !== CRITERIA_VERSION;
      const hasNewerOrg = latestOrgAt > new Date(cache.computed_at).getTime();
      return ageHours >= CACHE_TTL_HOURS || isSchemaStale || hasNewerOrg;
    });

    if (staleOrgs.length === 0) {
      return new Response(JSON.stringify({ dispatched: [], eligible_count: eligibleOrgs.length, stale_found: 0, stale_remaining: 0 }), {
        status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const toDispatch = staleOrgs.slice(0, MAX_ORGS_PER_SWEEP);
    const dispatched: string[] = [];

    async function dispatchOne(org: any) {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/refresh-partnership-matches-for-org`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SECRET_KEY}`,
            "apikey": SECRET_KEY,
          },
          body: JSON.stringify({ org_id: org.id }),
        });
        if (!res.ok) {
          const errText = await res.text();
          console.error(`[sweep-stale-partnership-matches] dispatch to org ${org.id} (${org.organisation_name}) failed: ${errText}`);
        }
      } catch (err) {
        console.error(`[sweep-stale-partnership-matches] dispatch to org ${org.id} (${org.organisation_name}) threw: ${String(err)}`);
      }
    }

    for (let i = 0; i < toDispatch.length; i++) {
      const org = toDispatch[i];
      EdgeRuntime.waitUntil(dispatchOne(org));
      dispatched.push(org.organisation_name ?? org.id);
      if (i < toDispatch.length - 1) await sleep(DISPATCH_STAGGER_MS);
    }

    return new Response(JSON.stringify({
      dispatched,
      eligible_count: eligibleOrgs.length,
      stale_found: staleOrgs.length,
      stale_remaining: Math.max(0, staleOrgs.length - toDispatch.length),
    }), { status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });

  } catch (err) {
    console.error(`[sweep-stale-partnership-matches] Uncaught exception: ${String(err)}`);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
});
