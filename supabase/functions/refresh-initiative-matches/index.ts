// supabase/functions/refresh-initiative-matches/index.ts
// Session-resolved wrapper around match-initiatives-to-funder, same pattern
// as refresh-partnership-matches.
//
// v31 (Oct 2026): PROPORTIONAL DD + SUPPORT-TYPE ROUTING.
// - attachDD replaced by attachPosterContext: each initiative gets
//   dd_status / dd_missing / deal_bucket judged on the POSTER's own
//   checklist (fdd for funder/corporate posters -- fixes the bug where
//   they were scored on the 9 implementer items and always capped; exempt
//   for consultancies; 9 items + uploaded documents otherwise) against the
//   initiative's own budget (NGN converted at matching_config's rate).
//   Plus documented_impact (partner-confirmed claims on Natives).
// - partnerships (support sought) and the budget fields are now selected
//   in every branch; the corporate mandate now carries its in-kind offers.
// - Cache rows store the DD fields; ordering is DD tier, then score.
// - NOT changed: this function still includes demo initiatives/orgs while
//   the for-org worker excludes them. Left as is on purpose (15 of 17
//   published initiatives are demo); a product decision, not part of this
//   build.
// v30 (14 Oct 2026): legacy JWT keys disabled after a leak. Uses the new
// publishable key (caller client) and secret key (service client), and now
// sends the secret key to the scoring functions. No logic change.
// v26: explicit ORG_SELECT_COLUMNS (column-level grants).
// v25: parseLegacySector handles jsonb arrays.
// v24: implementers routed to match-initiatives-for-implementer.
// v23: subscription_tier gate. v22: resolve_org_owner_id().
// v21: flagged_visibility_hold. v20: CRITERIA_VERSION from table.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  DD_ORG_COLUMNS, loadMatchingConfig, loadDocKeys, loadDocumentedImpact,
  initiativeDealBucket, ddStatusFor, byTierThenScore,
} from "./dd.ts";

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
const MAX_CACHED_MATCHES = 30;
const CRITERIA_VERSION_FALLBACK = 6;
const BATCH_SIZE = 15;
const FETCH_SAFETY_CAP = 300;

const FUNDER_TYPES = ["philanthropic_foundation", "venture_capital"];
const CORPORATE_TYPES = ["corporation", "technology_company", "public_sector"];
const ESG_PARTNERSHIP_TYPES = ["operational", "strategic", "lead", "other"];

const ORG_SELECT_COLUMNS = "id, user_id, organisation_name, organisation_type, description, sector, country, needs, offers, flagged_visibility_hold, subscription_tier, investment_thesis, grant_range_min, grant_range_max, grant_currency, funding_instruments, geographic_focus, stage_preference, mandate_sectors, mandate_sdgs, esg_frameworks, csr_focus_statement, csr_budget_range, inkind_support, tech_support_available, employee_engagement_available";

async function getCriteriaVersion(serviceClient: any): Promise<number> {
  const { data, error } = await serviceClient
    .from("criteria_versions")
    .select("version")
    .eq("match_type", "initiative")
    .maybeSingle();
  if (error || !data) {
    console.error(`[refresh-initiative-matches] criteria_versions read failed, falling back to ${CRITERIA_VERSION_FALLBACK}: ${error?.message}`);
    return CRITERIA_VERSION_FALLBACK;
  }
  return data.version;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function parseLegacySector(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((s) => typeof s === "string" && s.trim());
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((s) => typeof s === "string" && s.trim());
    if (typeof parsed === "string" && parsed.trim()) return [parsed];
    return [];
  } catch {
    return raw.trim() ? [raw.trim()] : [];
  }
}

async function scoreInitiatives(mandateOrOrg: any, initiatives: any[], engine: "funder" | "implementer" = "funder"): Promise<any[]> {
  if (initiatives.length === 0) return [];
  const batches = chunk(initiatives, BATCH_SIZE);
  const endpoint = engine === "implementer" ? "match-initiatives-for-implementer" : "match-initiatives-to-funder";
  const bodyKey = engine === "implementer" ? "submitting_org" : "mandate";

  async function attemptBatch(batchInitiatives: any[], b: number, attempt: number): Promise<any[]> {
    try {
      const matchRes = await fetch(`${SUPABASE_URL}/functions/v1/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SECRET_KEY}`, "apikey": SECRET_KEY },
        body: JSON.stringify({ [bodyKey]: mandateOrOrg, initiatives: batchInitiatives }),
      });
      if (!matchRes.ok) {
        const errText = await matchRes.text();
        console.error(`[refresh-initiative-matches] batch ${b + 1}/${batches.length} attempt ${attempt} failed: ${errText}`);
        return [];
      }
      const { data: ranked } = await matchRes.json();
      return ranked ?? [];
    } catch (batchErr) {
      console.error(`[refresh-initiative-matches] batch ${b + 1}/${batches.length} attempt ${attempt} threw: ${String(batchErr)}`);
      return [];
    }
  }

  const batchResults = await Promise.all(batches.map(async (batchInitiatives, b) => {
    const first = await attemptBatch(batchInitiatives, b, 1);
    if (first.length > 0) return first;
    console.error(`[refresh-initiative-matches] batch ${b + 1}/${batches.length} retrying once after empty result`);
    return attemptBatch(batchInitiatives, b, 2);
  }));
  return batchResults.flat();
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
      console.error(`[refresh-initiative-matches] resolve_org_owner_id failed for user ${user.id}: ${ownerIdError?.message}`);
      return new Response(JSON.stringify({ error: "Could not resolve organisation identity" }), {
        status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const { data: org, error: orgError } = await callerClient
      .from("organizations")
      .select(ORG_SELECT_COLUMNS)
      .eq("user_id", ownerId)
      .maybeSingle();

    if (orgError || !org) {
      return new Response(JSON.stringify({ error: "No organisation profile found for this account" }), {
        status: 404, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const orgTypeForGate = org.organisation_type;
    const isFunder = FUNDER_TYPES.includes(orgTypeForGate);
    const isCorporate = CORPORATE_TYPES.includes(orgTypeForGate);
    const isImplementer = !isFunder && !isCorporate;

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

    const { data: existingCache } = await callerClient
      .from("initiative_match_cache")
      .select("initiative_id, score, match_reason, criteria, criteria_version, computed_at, dd_status, dd_missing, deal_bucket")
      .eq("org_id", org.id)
      .order("score", { ascending: false });

    const computedTimestamps = (existingCache ?? []).map(r => new Date(r.computed_at).getTime());
    const oldestComputedAt = computedTimestamps.length > 0 ? Math.min(...computedTimestamps) : 0;
    const ageHours = (Date.now() - oldestComputedAt) / (1000 * 60 * 60);
    const isSchemaStale = !existingCache?.length || existingCache.some(r => r.criteria_version !== CRITERIA_VERSION);
    const isEmpty = !existingCache || existingCache.length === 0;
    const isFullStale = isEmpty || ageHours >= CACHE_TTL_HOURS || isSchemaStale;

    let initiatives: any[] | null = null;
    let mandate: any;
    let minScore: number;
    let selectCols: string;

    if (isFunder) {
      minScore = 40;
      selectCols = "id,title,sectors,locations,status,created_at,problem,outcome,budget,budget_min,budget_max,budget_currency,stage,sdg_tags,target_population,specific_ask,submitter_org,user_id,open_to_remote_partnerships,partnerships";
      mandate = {
        org_type: orgTypeForGate,
        investment_thesis: org.investment_thesis,
        grant_range_min: org.grant_range_min,
        grant_range_max: org.grant_range_max,
        grant_currency: org.grant_currency,
        funding_instruments: org.funding_instruments,
        geographic_focus: org.geographic_focus,
        stage_preference: org.stage_preference,
        mandate_sectors: org.mandate_sectors,
        mandate_sdgs: org.mandate_sdgs,
      };
    } else if (isCorporate) {
      minScore = 35;
      selectCols = "id,title,sectors,locations,status,created_at,problem,outcome,budget,budget_min,budget_max,budget_currency,esg_alignment,specific_ask,stage,sdg_tags,submitter_org,user_id,open_to_remote_partnerships,partnerships";
      mandate = {
        org_type: orgTypeForGate,
        investment_thesis: org.esg_frameworks?.length
          ? `ESG-aligned corporate seeking implementation partners across: ${org.esg_frameworks.join(", ")}`
          : "Corporate seeking ESG and CSR implementation partners",
        funding_instruments: ["partnership", "csr_funding"],
        grant_currency: "NGN",
        grant_range_min: null,
        grant_range_max: null,
        stage_preference: ["pilot", "growth", "scale"],
        geographic_focus: org.geographic_focus ?? (org.country ? [org.country] : ["Nigeria"]),
        mandate_sectors: org.mandate_sectors ?? parseLegacySector(org.sector),
        mandate_sdgs: org.mandate_sdgs ?? [],
        esg_frameworks: org.esg_frameworks,
        csr_focus_statement: org.csr_focus_statement,
        csr_budget_range: org.csr_budget_range,
        inkind_support: org.inkind_support ?? [],
        tech_support_available: org.tech_support_available ?? false,
        employee_engagement_available: org.employee_engagement_available ?? false,
        partnership_types: ESG_PARTNERSHIP_TYPES,
      };
    } else {
      minScore = 45;
      selectCols = "id,title,sectors,locations,status,created_at,problem,outcome,budget,budget_min,budget_max,budget_currency,specific_ask,stage,sdg_tags,target_population,submitter_org,user_id,open_to_remote_partnerships,partnerships";
      mandate = org;
    }

    const { data: heldOrgs } = await serviceClient
      .from("organizations")
      .select("user_id")
      .eq("flagged_visibility_hold", true);
    const heldUserIds = new Set((heldOrgs ?? []).map((o: any) => o.user_id));

    async function fetchPublished(query: (q: any) => any) {
      let q = callerClient.from("initiative_requests").select(selectCols).eq("status", "published")
        .neq("user_id", ownerId)
        .order("created_at", { ascending: false }).limit(FETCH_SAFETY_CAP);
      q = query(q);
      const { data } = await q;
      return (data ?? []).filter((i: any) => !heldUserIds.has(i.user_id));
    }

    // Proportional DD for each initiative: the poster's own checklist
    // judged against the initiative's own budget, plus the size-neutral
    // documented-impact flag.
    const { policy: ddPolicy, ngnPerUsd } = await loadMatchingConfig(serviceClient);

    async function attachPosterContext(rows: any[]): Promise<any[]> {
      const submitterIds = [...new Set(rows.map((i: any) => i.user_id).filter(Boolean))];
      const { data: posterOrgs } = submitterIds.length
        ? await serviceClient
          .from("organizations")
          .select(`id, user_id, organisation_type, ${DD_ORG_COLUMNS}`)
          .in("user_id", submitterIds)
        : { data: [] };
      const orgByUserId = new Map<string, any>((posterOrgs ?? []).map((o: any) => [o.user_id, o]));
      const posterOrgIds = (posterOrgs ?? []).map((o: any) => o.id);
      const [docKeysByOrg, documentedImpactOrgs] = await Promise.all([
        loadDocKeys(serviceClient, posterOrgIds),
        loadDocumentedImpact(serviceClient, posterOrgIds),
      ]);
      return rows.map((i: any) => {
        const poster = orgByUserId.get(i.user_id);
        const dealBucket = initiativeDealBucket(i, ddPolicy, ngnPerUsd);
        const dd = ddStatusFor(poster ?? {}, (poster && docKeysByOrg.get(poster.id)) ?? new Set(), dealBucket, ddPolicy);
        return {
          ...i,
          dd_status: dd.status, dd_missing: dd.missing, deal_bucket: dealBucket,
          documented_impact: !!poster && documentedImpactOrgs.has(poster.id),
        };
      });
    }

    function cacheRow(r: any, computedAt: string) {
      return {
        org_id: org.id, initiative_id: r.initiative_id ?? r.id, score: r.score, match_reason: r.match_reason,
        criteria: r.criteria ?? null, criteria_version: CRITERIA_VERSION, computed_at: computedAt,
        dd_status: r.dd_status ?? null, dd_missing: r.dd_missing ?? [], deal_bucket: r.deal_bucket ?? null,
      };
    }
    function responseRow(r: any) {
      return {
        initiative_id: r.initiative_id ?? r.id, score: r.score, match_reason: r.match_reason, criteria: r.criteria ?? null,
        dd_status: r.dd_status ?? null, dd_missing: r.dd_missing ?? [], deal_bucket: r.deal_bucket ?? null,
      };
    }

    if (isFullStale) {
      initiatives = await fetchPublished(q => q);
      if (isCorporate && initiatives) {
        initiatives = [...initiatives].sort((a: any, b: any) => {
          if (a.esg_alignment && !b.esg_alignment) return -1;
          if (!a.esg_alignment && b.esg_alignment) return 1;
          return 0;
        });
      }

      if (!initiatives?.length) {
        return new Response(JSON.stringify({ eligible: true, cached: false, computed_at: new Date().toISOString(), min_score: minScore, matches: [] }), {
          status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        });
      }

      initiatives = await attachPosterContext(initiatives);
      const allRanked = await scoreInitiatives(mandate, initiatives, isImplementer ? "implementer" : "funder");
      const anyBatchSucceeded = allRanked.length > 0;

      if (!anyBatchSucceeded) {
        return new Response(JSON.stringify({
          error: "Matching failed on all batches", eligible: true,
          cached: existingCache && existingCache.length > 0,
          min_score: minScore,
          matches: existingCache ?? [],
        }), { status: 502, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
      }

      const topMatches = allRanked
        .sort(byTierThenScore("score"))
        .slice(0, MAX_CACHED_MATCHES);

      const { error: deleteError } = await serviceClient.from("initiative_match_cache").delete().eq("org_id", org.id);
      if (deleteError) {
        console.error(`[refresh-initiative-matches] cache delete failed for org ${org.id}: ${deleteError.message}`);
      }

      if (topMatches.length > 0) {
        const now = new Date().toISOString();
        const rows = topMatches.map((r: any) => cacheRow(r, now));
        const { error: insertError } = await serviceClient.from("initiative_match_cache").insert(rows);
        if (insertError) {
          console.error(`[refresh-initiative-matches] cache insert failed for org ${org.id}: ${insertError.message}`);
          return new Response(JSON.stringify({ error: `Cache write failed: ${insertError.message}` }), {
            status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
          });
        }
      }

      return new Response(JSON.stringify({
        eligible: true, cached: false, computed_at: new Date().toISOString(), min_score: minScore,
        matches: topMatches.map(responseRow),
      }), { status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
    }

    const cachedIds = new Set((existingCache ?? []).map(r => r.initiative_id));
    const allPublished = await fetchPublished(q => q);
    const missing = (allPublished ?? []).filter((i: any) => !cachedIds.has(i.id));

    if (missing.length === 0) {
      return new Response(JSON.stringify({
        eligible: true, cached: true, computed_at: new Date(oldestComputedAt).toISOString(), min_score: minScore,
        matches: [...(existingCache ?? [])].sort(byTierThenScore("score")),
      }), { status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
    }

    const missingWithDD = await attachPosterContext(missing);
    const freshlyRanked = await scoreInitiatives(mandate, missingWithDD, isImplementer ? "implementer" : "funder");
    const now = new Date().toISOString();
    const newRows = freshlyRanked.map((r: any) => cacheRow(r, now));

    const merged = [...(existingCache ?? []), ...newRows]
      .sort(byTierThenScore("score"))
      .slice(0, MAX_CACHED_MATCHES);

    const { error: deleteError } = await serviceClient.from("initiative_match_cache").delete().eq("org_id", org.id);
    if (deleteError) {
      console.error(`[refresh-initiative-matches] incremental delete failed for org ${org.id}: ${deleteError.message}`);
    }
    if (merged.length > 0) {
      const { error: insertError } = await serviceClient.from("initiative_match_cache").insert(
        merged.map((r: any) => cacheRow(r, r.computed_at))
      );
      if (insertError) {
        console.error(`[refresh-initiative-matches] incremental insert failed for org ${org.id}: ${insertError.message}`);
        return new Response(JSON.stringify({ error: `Cache write failed: ${insertError.message}` }), {
          status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        });
      }
    }

    return new Response(JSON.stringify({
      eligible: true, cached: false, computed_at: now, min_score: minScore,
      matches: merged.map(responseRow),
    }), { status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });

  } catch (err) {
    console.error(`[refresh-initiative-matches] Uncaught exception: ${String(err)}`);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
});
