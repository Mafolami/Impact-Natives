// supabase/functions/refresh-initiative-matches-for-org/index.ts
// Internal-only worker: recomputes initiative matches for exactly ONE org,
// given its org_id. Only caller: sweep-stale-initiative-matches.
//
// v19 (Oct 2026): PROPORTIONAL DD + SUPPORT-TYPE ROUTING. Same changes as
// refresh-initiative-matches v31: attachPosterContext (poster's own
// checklist vs the initiative's own budget, documented impact), the
// partnerships column selected, corporate in-kind offers in the mandate,
// DD fields stored in the cache, ordering by DD tier then score.
// v18 (14 Oct 2026): parseLegacySector now accepts a jsonb array. sector is
// stored as jsonb, so it arrives as an array and the old string-only parser
// threw "raw.trim is not a function" for any corporate org with no
// mandate_sectors.
//
// v17 (14 Oct 2026): legacy JWT keys disabled after a leak. Uses the new
// secret API key (SUPABASE_SECRET_KEYS), rejects any call that does not carry
// it, and sends it to the scoring functions.
//
// v10: DEMO INITIATIVE EXCLUSION (is_demo_initiative = false).
// v9: DEMO ORG EXCLUSION (organizations.is_demo_org).
// v8: implementers routed to match-initiatives-for-implementer.
// v7: subscription_tier gate. v6: flagged_visibility_hold.
// v5: CRITERIA_VERSION from criteria_versions. v2: stop full-cache churn.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  DD_ORG_COLUMNS, loadMatchingConfig, loadDocKeys, loadDocumentedImpact,
  initiativeDealBucket, ddStatusFor, byTierThenScore,
} from "./dd.ts";

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
const CRITERIA_VERSION_FALLBACK = 6;
const BATCH_SIZE = 15;
const FETCH_SAFETY_CAP = 300;
const MAX_CACHED_MATCHES = 30;

const FUNDER_TYPES = ["philanthropic_foundation", "venture_capital"];
const CORPORATE_TYPES = ["corporation", "technology_company", "public_sector"];
const ESG_PARTNERSHIP_TYPES = ["operational", "strategic", "lead", "other"];

async function getCriteriaVersion(serviceClient: any): Promise<number> {
  const { data, error } = await serviceClient
    .from("criteria_versions")
    .select("version")
    .eq("match_type", "initiative")
    .maybeSingle();
  if (error || !data) {
    console.error(`[refresh-initiative-matches-for-org] criteria_versions read failed, falling back to ${CRITERIA_VERSION_FALLBACK}: ${error?.message}`);
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
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter((s) => typeof s === "string" && s.trim());
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((s) => typeof s === "string" && s.trim());
    if (typeof parsed === "string" && parsed.trim()) return [parsed];
    return [];
  } catch {
    return raw.trim() ? [raw.trim()] : [];
  }
}

function buildMandate(org: any, isFunder: boolean, isCorporate: boolean): any {
  if (isFunder) {
    return {
      org_type: org.organisation_type,
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
  }
  if (isCorporate) {
    return {
      org_type: org.organisation_type,
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
  }
  // Implementer: no synthetic mandate -- match-initiatives-for-implementer
  // takes the org's own profile directly.
  return org;
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

    const isFunder = FUNDER_TYPES.includes(org.organisation_type);
    const isCorporate = CORPORATE_TYPES.includes(org.organisation_type);
    const isImplementer = !isFunder && !isCorporate;

    if (org.flagged_visibility_hold) {
      return new Response(JSON.stringify({ org_id, error: "flagged_visibility_hold" }), {
        status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    if (org.subscription_tier === "free") {
      return new Response(JSON.stringify({ org_id, skipped: "requires_upgrade" }), {
        status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const mandate = buildMandate(org, isFunder, isCorporate);

    const { data: existingCache } = await serviceClient
      .from("initiative_match_cache")
      .select("initiative_id, score, match_reason, criteria, criteria_version, computed_at, dd_status, dd_missing, deal_bucket")
      .eq("org_id", org_id);

    const computedTimestamps = (existingCache ?? []).map(r => new Date(r.computed_at).getTime());
    const oldestComputedAt = computedTimestamps.length > 0 ? Math.min(...computedTimestamps) : 0;
    const ageHours = (Date.now() - oldestComputedAt) / (1000 * 60 * 60);
    const isSchemaStale = !existingCache?.length || existingCache.some(r => r.criteria_version !== CRITERIA_VERSION);
    const isEmpty = !existingCache || existingCache.length === 0;
    const isFullStale = isEmpty || ageHours >= CACHE_TTL_HOURS || isSchemaStale;

    const selectCols = "id,title,sectors,locations,status,created_at,problem,outcome,budget_min,budget_max,budget_currency,budget,stage,sdg_tags,target_population,specific_ask,esg_alignment,submitter_org,user_id,open_to_remote_partnerships,partnerships";

    const { data: allPublishedRaw } = await serviceClient
      .from("initiative_requests")
      .select(selectCols)
      .eq("status", "published")
      .eq("is_demo_initiative", false)
      .neq("user_id", org.user_id)
      .order("created_at", { ascending: false })
      .limit(FETCH_SAFETY_CAP);

    const { data: heldOrgs } = await serviceClient
      .from("organizations")
      .select("user_id")
      .eq("flagged_visibility_hold", true);
    const heldUserIds = new Set((heldOrgs ?? []).map((o: any) => o.user_id));

    const { data: demoOrgs } = await serviceClient
      .from("organizations")
      .select("user_id")
      .eq("is_demo_org", true);
    const demoUserIds = new Set((demoOrgs ?? []).map((o: any) => o.user_id));

    const allPublished = (allPublishedRaw ?? []).filter((i: any) => !heldUserIds.has(i.user_id) && !demoUserIds.has(i.user_id));

    if (!allPublished.length) {
      return new Response(JSON.stringify({ org_id, matches_cached: 0 }), {
        status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    // Proportional DD for each initiative: the poster's own checklist
    // judged against the initiative's own budget, plus the size-neutral
    // documented-impact flag. Same logic as refresh-initiative-matches.
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
        org_id, initiative_id: r.initiative_id ?? r.id, score: r.score, match_reason: r.match_reason,
        criteria: r.criteria ?? null, criteria_version: CRITERIA_VERSION, computed_at: computedAt,
        dd_status: r.dd_status ?? null, dd_missing: r.dd_missing ?? [], deal_bucket: r.deal_bucket ?? null,
      };
    }

    const scoringEndpoint = isImplementer ? "match-initiatives-for-implementer" : "match-initiatives-to-funder";
    const scoringBodyKey = isImplementer ? "submitting_org" : "mandate";

    async function attemptBatch(batchInitiatives: any[], b: number, totalBatches: number, attempt: number): Promise<any[]> {
      try {
        const matchRes = await fetch(`${SUPABASE_URL}/functions/v1/${scoringEndpoint}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SECRET_KEY}`,
            "apikey": SECRET_KEY,
          },
          body: JSON.stringify({ [scoringBodyKey]: mandate, initiatives: batchInitiatives }),
        });
        if (!matchRes.ok) {
          const errText = await matchRes.text();
          console.error(`[refresh-initiative-matches-for-org] org ${org_id} batch ${b + 1}/${totalBatches} attempt ${attempt} failed: ${errText}`);
          return [];
        }
        const { data: ranked } = await matchRes.json();
        return ranked ?? [];
      } catch (batchErr) {
        console.error(`[refresh-initiative-matches-for-org] org ${org_id} batch ${b + 1}/${totalBatches} attempt ${attempt} threw: ${String(batchErr)}`);
        return [];
      }
    }

    async function scoreInitiatives(initiativesToScore: any[]): Promise<any[]> {
      if (initiativesToScore.length === 0) return [];
      const batches = chunk(initiativesToScore, BATCH_SIZE);
      const batchResults = await Promise.all(batches.map(async (batchInitiatives, b) => {
        const first = await attemptBatch(batchInitiatives, b, batches.length, 1);
        if (first.length > 0) return first;
        console.error(`[refresh-initiative-matches-for-org] org ${org_id} batch ${b + 1}/${batches.length} retrying once after empty result`);
        return attemptBatch(batchInitiatives, b, batches.length, 2);
      }));
      return batchResults.flat();
    }

    if (isFullStale) {
      const initiativesWithDD = await attachPosterContext(allPublished);
      const allRanked = await scoreInitiatives(initiativesWithDD);

      if (allRanked.length === 0) {
        console.error(`[refresh-initiative-matches-for-org] org ${org_id} produced no ranked results, leaving existing cache untouched`);
        return new Response(JSON.stringify({ org_id, matches_cached: 0, note: "no results, cache untouched" }), {
          status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        });
      }

      const topMatches = allRanked
        .sort(byTierThenScore("score"))
        .slice(0, MAX_CACHED_MATCHES);

      const { error: deleteError } = await serviceClient.from("initiative_match_cache").delete().eq("org_id", org_id);
      if (deleteError) {
        console.error(`[refresh-initiative-matches-for-org] cache delete failed for org ${org_id}: ${deleteError.message}`);
      }

      if (topMatches.length > 0) {
        const nowIso = new Date().toISOString();
        const rows = topMatches.map((r: any) => cacheRow(r, nowIso));
        const { error: insertError } = await serviceClient.from("initiative_match_cache").insert(rows);
        if (insertError) {
          console.error(`[refresh-initiative-matches-for-org] cache insert failed for org ${org_id}: ${insertError.message}`);
          return new Response(JSON.stringify({ error: `Cache write failed: ${insertError.message}` }), {
            status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
          });
        }
      }

      return new Response(JSON.stringify({ org_id, matches_cached: topMatches.length }), {
        status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const cachedIds = new Set((existingCache ?? []).map(r => r.initiative_id));
    const missing = allPublished.filter((i: any) => !cachedIds.has(i.id));

    if (missing.length === 0) {
      return new Response(JSON.stringify({ org_id, matches_cached: existingCache?.length ?? 0, note: "no new initiatives, cache untouched" }), {
        status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const missingWithDD = await attachPosterContext(missing);
    const freshlyRanked = await scoreInitiatives(missingWithDD);
    const nowIso = new Date().toISOString();
    const newRows = freshlyRanked.map((r: any) => cacheRow(r, nowIso));

    const merged = [...(existingCache ?? []), ...newRows]
      .sort(byTierThenScore("score"))
      .slice(0, MAX_CACHED_MATCHES);

    const { error: deleteError } = await serviceClient.from("initiative_match_cache").delete().eq("org_id", org_id);
    if (deleteError) {
      console.error(`[refresh-initiative-matches-for-org] incremental delete failed for org ${org_id}: ${deleteError.message}`);
    }
    if (merged.length > 0) {
      const { error: insertError } = await serviceClient.from("initiative_match_cache").insert(
        merged.map((r: any) => cacheRow(r, r.computed_at))
      );
      if (insertError) {
        console.error(`[refresh-initiative-matches-for-org] incremental insert failed for org ${org_id}: ${insertError.message}`);
        return new Response(JSON.stringify({ error: `Cache write failed: ${insertError.message}` }), {
          status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        });
      }
    }

    return new Response(JSON.stringify({ org_id, matches_cached: merged.length }), {
      status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });

  } catch (err) {
    console.error(`[refresh-initiative-matches-for-org] Uncaught exception: ${String(err)}`);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
});
