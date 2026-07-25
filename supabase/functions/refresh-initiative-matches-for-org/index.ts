// supabase/functions/refresh-initiative-matches-for-org/index.ts
// Internal-only worker: recomputes initiative matches for exactly ONE org,
// given its org_id. Not exposed to any client, no per-request auth check
// beyond being invoked server-side -- same pattern as match-initiatives-to-
// funder (verify_jwt: false, trusted because it's only ever called from
// other server-side functions, never from the browser).
//
// Exists so each org's matching work gets its OWN full edge-function
// execution-time budget (150s free tier / 400s paid), rather than sharing
// one budget across several orgs processed in a single invocation -- which
// is exactly what caused sweep-stale-initiative-matches to hit a 504 after
// 150.7 seconds when it tried to loop through multiple orgs itself.
// sweep-stale-initiative-matches now just identifies which orgs are stale
// and dispatches one call to this function per org via
// EdgeRuntime.waitUntil(), without waiting for each one to finish before
// moving to the next.
//
// v3: mirrors refresh-initiative-matches v14-v16 -- open_to_remote_partnerships
// and csr_focus_statement now flow into the mandate/initiative data used
// for scoring, and minScore is no longer a cache-write filter (every
// scored initiative is kept, ranked by score; the frontend decides what
// counts as a "strong" match for display).
//
// v2: STOP FULL-CACHE CHURN. This worker previously rescored EVERY
// published initiative from scratch on every call, unconditionally --
// meaning the daily 3am cron guaranteed a brand-new, independently
// sampled score and match_reason for every initiative a funder/corporate
// had already been shown, every single day, even when nothing about
// either side had changed. Same root cause as refresh-initiative-matches
// v14 (score/match_reason are free-text LLM output with no fixed formula
// tying them to the criteria object, so identical input can legitimately
// score 78 one day and 85 the next with completely different wording).
// Now mirrors that fix: only initiatives not already in this org's cache
// get scored; existing rows carry over untouched unless the cache is
// empty, past the 12h TTL, or on an old criteria_version.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CACHE_TTL_HOURS = 12;
// v5: see refresh-initiative-matches v17 -- csr_focus_statement reaching
// the prompt shipped without a version bump, so caches written under v4
// could be pre- or post-fix with no way to tell them apart. Bumping forces
// one clean recompute using the corrected prompt.
const CRITERIA_VERSION = 5;
const BATCH_SIZE = 15;
const FETCH_SAFETY_CAP = 300;
const MAX_CACHED_MATCHES = 30;

const FUNDER_TYPES = ["philanthropic_foundation", "venture_capital"];
const CORPORATE_TYPES = ["corporation", "technology_company", "public_sector"];
const ESG_PARTNERSHIP_TYPES = ["operational", "strategic", "lead", "other"];

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
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
    mandate_sectors: org.mandate_sectors ?? (org.sector ? [org.sector] : []),
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

    const { data: allPublished } = await serviceClient
      .from("initiative_requests")
      .select(selectCols)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(FETCH_SAFETY_CAP);

    if (!allPublished?.length) {
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

    async function scoreInitiatives(initiativesToScore: any[]): Promise<any[]> {
      if (initiativesToScore.length === 0) return [];
      const batches = chunk(initiativesToScore, BATCH_SIZE);
      const batchResults = await Promise.all(batches.map(async (batchInitiatives, b) => {
        try {
          const matchRes = await fetch(`${SUPABASE_URL}/functions/v1/match-initiatives-to-funder`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mandate, initiatives: batchInitiatives }),
          });
          if (!matchRes.ok) {
            const errText = await matchRes.text();
            console.error(`[refresh-initiative-matches-for-org] org ${org_id} batch ${b + 1}/${batches.length} failed: ${errText}`);
            return [];
          }
          const { data: ranked } = await matchRes.json();
          return ranked ?? [];
        } catch (batchErr) {
          console.error(`[refresh-initiative-matches-for-org] org ${org_id} batch ${b + 1}/${batches.length} threw: ${String(batchErr)}`);
          return [];
        }
      }));
      return batchResults.flat();
    }

    if (isFullStale) {
      // Genuine full recompute -- cache empty, TTL expired, or schema
      // version bumped. Same behaviour as before this fix.
      const initiativesWithDD = await attachDD(allPublished);
      const allRanked = await scoreInitiatives(initiativesWithDD);

      if (allRanked.length === 0) {
        console.error(`[refresh-initiative-matches-for-org] org ${org_id} produced no ranked results, leaving existing cache untouched`);
        return new Response(JSON.stringify({ org_id, matches_cached: 0, note: "no results, cache untouched" }), {
          status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        });
      }

      // No score filter -- mirrors refresh-initiative-matches v16. Every
      // scored initiative is kept; minScore is a display label the
      // frontend applies, not a reason to discard a weak-but-real result.
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

    // Incremental path: only score initiatives not already in the cache.
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