// supabase/functions/refresh-initiative-matches-for-org/index.ts
// Internal-only worker: recomputes initiative matches for exactly ONE org,
// given its org_id.
//
// v7: subscription_tier gate added, same reasoning as v23 of
// refresh-initiative-matches (the interactive sibling) and v9 of
// refresh-partnership-matches-for-org (the equivalent worker on the
// partnership side). Skipping here also means the nightly sweep never
// spends a Groq call scoring initiatives for a Free-tier org at all.
//
// v6: flagged_visibility_hold, both directions. (a) Self-exclusion: if the
// funder/corporate org this worker computes matches FOR is itself under a
// "Serious"-severity admin hold, skip entirely -- mirrors v8 of
// refresh-partnership-matches-for-org. (b) Candidate-exclusion: initiatives
// submitted by a held org are dropped from the published pool before
// scoring -- a held implementer shouldn't be recommended to funders/
// corporates as a candidate while under review, mirrors v32 of
// match-orgs-for-partnership. match-initiatives-to-funder itself never
// touches the DB (mandate/initiatives arrive as plain JSON from whichever
// caller invoked it), so both checks have to live here, not there.
//
// v5: CRITERIA_VERSION moved out of a local hardcoded constant into the
// `criteria_versions` table (match_type='initiative') -- see
// refresh-initiative-matches v20 for the full reasoning. This function's
// copy of the constant had already drifted from the other two once
// (stuck at 5 while refresh-initiative-matches moved to 6); reading from
// one shared table removes that failure mode entirely.
//
// v4: mirrors refresh-initiative-matches v19 -- mandate_sectors legacy
// fallback fix (parseLegacySector) + batch retry on transient failure.
//
// Exists so each org's matching work gets its OWN full edge-function
// execution-time budget, rather than sharing one budget across several
// orgs processed in a single invocation.
//
// v3: mirrors refresh-initiative-matches v14-v16 -- open_to_remote_partnerships
// and csr_focus_statement now flow into the mandate/initiative data used
// for scoring, and minScore is no longer a cache-write filter.
//
// v2: STOP FULL-CACHE CHURN. Only initiatives NOT YET in this org's cache
// get scored.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CACHE_TTL_HOURS = 12;
// Fallback only -- real value read from criteria_versions at request time.
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

function parseLegacySector(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((s) => typeof s === "string" && s.trim());
    if (typeof parsed === "string" && parsed.trim()) return [parsed];
    return [];
  } catch {
    return raw.trim() ? [raw.trim()] : [];
  }
}

function buildMandate(org: any, isFunder: boolean): any {
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
    partnership_types: ESG_PARTNERSHIP_TYPES,
  };
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
      return new Response(JSON.stringify({ error: "org_type_not_supported" }), {
        status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    if (org.flagged_visibility_hold) {
      return new Response(JSON.stringify({ org_id, error: "flagged_visibility_hold" }), {
        status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    // AI-powered initiative matching is a Plus+ feature (see billing
    // scoping notes). Skip before any AI compute -- this is the cron path,
    // so this also means Free-tier orgs never cost a Groq call here at all.
    if (org.subscription_tier === "free") {
      return new Response(JSON.stringify({ org_id, skipped: "requires_upgrade" }), {
        status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const mandate = buildMandate(org, isFunder);

    const { data: existingCache } = await serviceClient
      .from("initiative_match_cache")
      .select("initiative_id, score, match_reason, criteria, criteria_version, computed_at")
      .eq("org_id", org_id);

    const computedTimestamps = (existingCache ?? []).map(r => new Date(r.computed_at).getTime());
    const oldestComputedAt = computedTimestamps.length > 0 ? Math.min(...computedTimestamps) : 0;
    const ageHours = (Date.now() - oldestComputedAt) / (1000 * 60 * 60);
    const isSchemaStale = !existingCache?.length || existingCache.some(r => r.criteria_version !== CRITERIA_VERSION);
    const isEmpty = !existingCache || existingCache.length === 0;
    const isFullStale = isEmpty || ageHours >= CACHE_TTL_HOURS || isSchemaStale;

    const selectCols = "id,title,sectors,locations,status,created_at,problem,outcome,budget_min,budget_max,budget_currency,budget,stage,sdg_tags,target_population,specific_ask,esg_alignment,submitter_org,user_id,open_to_remote_partnerships";

    const { data: allPublishedRaw } = await serviceClient
      .from("initiative_requests")
      .select(selectCols)
      .eq("status", "published")
      .neq("user_id", org.user_id)   // ← add this
      .order("created_at", { ascending: false })
      .limit(FETCH_SAFETY_CAP);

    const { data: heldOrgs } = await serviceClient
      .from("organizations")
      .select("user_id")
      .eq("flagged_visibility_hold", true);
    const heldUserIds = new Set((heldOrgs ?? []).map((o: any) => o.user_id));
    const allPublished = (allPublishedRaw ?? []).filter((i: any) => !heldUserIds.has(i.user_id));

    if (!allPublished.length) {
      return new Response(JSON.stringify({ org_id, matches_cached: 0 }), {
        status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    async function attachDD(rows: any[]): Promise<any[]> {
      const submitterIds = [...new Set(rows.map((i: any) => i.user_id).filter(Boolean))];
      if (submitterIds.length === 0) return rows;
      const { data: ddRows } = await serviceClient
        .from("organizations")
        .select("user_id, dd_financial_model, dd_audited_accounts, dd_governance_doc, dd_esg_assessment, dd_impact_framework")
        .in("user_id", submitterIds);
      const ddMap = new Map((ddRows ?? []).map((r: any) => {
        const count = [r.dd_financial_model, r.dd_audited_accounts, r.dd_governance_doc, r.dd_esg_assessment, r.dd_impact_framework].filter(Boolean).length;
        return [r.user_id, Math.round((count / 5) * 100)];
      }));
      return rows.map((i: any) => ({ ...i, dd_readiness_score: ddMap.get(i.user_id) ?? 0 }));
    }

    async function attemptBatch(batchInitiatives: any[], b: number, totalBatches: number, attempt: number): Promise<any[]> {
      try {
        const matchRes = await fetch(`${SUPABASE_URL}/functions/v1/match-initiatives-to-funder`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mandate, initiatives: batchInitiatives }),
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
      const initiativesWithDD = await attachDD(allPublished);
      const allRanked = await scoreInitiatives(initiativesWithDD);

      if (allRanked.length === 0) {
        console.error(`[refresh-initiative-matches-for-org] org ${org_id} produced no ranked results, leaving existing cache untouched`);
        return new Response(JSON.stringify({ org_id, matches_cached: 0, note: "no results, cache untouched" }), {
          status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        });
      }

      const topMatches = allRanked
        .sort((a: any, b: any) => b.score - a.score)
        .slice(0, MAX_CACHED_MATCHES);

      const { error: deleteError } = await serviceClient.from("initiative_match_cache").delete().eq("org_id", org_id);
      if (deleteError) {
        console.error(`[refresh-initiative-matches-for-org] cache delete failed for org ${org_id}: ${deleteError.message}`);
      }

      if (topMatches.length > 0) {
        const nowIso = new Date().toISOString();
        const rows = topMatches.map((r: any) => ({
          org_id, initiative_id: r.id, score: r.score, match_reason: r.match_reason,
          criteria: r.criteria ?? null, criteria_version: CRITERIA_VERSION, computed_at: nowIso,
        }));
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

    const missingWithDD = await attachDD(missing);
    const freshlyRanked = await scoreInitiatives(missingWithDD);
    const nowIso = new Date().toISOString();
    const newRows = freshlyRanked
      .map((r: any) => ({
        org_id, initiative_id: r.id, score: r.score, match_reason: r.match_reason,
        criteria: r.criteria ?? null, criteria_version: CRITERIA_VERSION, computed_at: nowIso,
      }));

    const merged = [...(existingCache ?? []), ...newRows]
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, MAX_CACHED_MATCHES);

    const { error: deleteError } = await serviceClient.from("initiative_match_cache").delete().eq("org_id", org_id);
    if (deleteError) {
      console.error(`[refresh-initiative-matches-for-org] incremental delete failed for org ${org_id}: ${deleteError.message}`);
    }
    if (merged.length > 0) {
      const { error: insertError } = await serviceClient.from("initiative_match_cache").insert(
        merged.map((r: any) => ({
          org_id, initiative_id: r.initiative_id, score: r.score, match_reason: r.match_reason,
          criteria: r.criteria ?? null, criteria_version: CRITERIA_VERSION, computed_at: r.computed_at,
        }))
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
