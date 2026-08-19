// supabase/functions/refresh-initiative-matches/index.ts
// Session-resolved wrapper around match-initiatives-to-funder, same pattern
// as refresh-partnership-matches.
//
// v23: subscription_tier gate added. AI-powered initiative matching is a
// Plus+ feature (see billing scoping notes) -- same gate, same reasoning
// as v17 of refresh-partnership-matches, applied here since this is a
// separate pipeline (match-initiatives-to-funder) that wasn't covered by
// that earlier fix. A Free-tier org now gets eligible:false before any AI
// compute happens.
//
// v22: org lookup now goes through resolve_org_owner_id() instead of
// user.id directly -- same fix, same reasoning as
// refresh-partnership-matches v16. Previously looked up organizations by
// the caller's own auth id, correct for an Owner but a guaranteed 404 for
// an active Team Member (their own id has no organizations row; their
// Owner's does). No Members exist in production yet so this hadn't
// fired, but it would have broken the moment Team invites went live.
//
// v21: flagged_visibility_hold, both directions -- mirrors v6 of
// refresh-initiative-matches-for-org exactly (self-exclusion for the
// caller's own org if held, candidate-exclusion of initiatives submitted
// by a held org from the published pool). Held-org lookup uses
// serviceClient rather than callerClient to avoid any RLS uncertainty on
// an authenticated non-admin session reading organizations.
//
// v20: CRITERIA_VERSION moved out of a local hardcoded constant into the
// `criteria_versions` table (match_type='initiative'), read once per
// request. Three files independently hardcoded this same number
// (refresh-initiative-matches, refresh-initiative-matches-for-org,
// sweep-stale-initiative-matches) and had already silently drifted apart
// once -- the sweep's copy was stuck at 3 while the other two had moved to
// 5 then 6, causing the sweep to treat every org's cache as permanently
// schema-stale. A single DB-backed source of truth makes that class of
// drift structurally impossible: change the row once, every consumer
// picks it up on its next request, no redeploy-and-hope-you-got-all-three
// required. Falls back to the last-known value (6) if the table read ever
// fails, so a transient DB hiccup degrades to "maybe one unnecessary
// rescore" rather than breaking matching outright.
//
// v19: TWO FIXES.
// (a) mandate_sectors legacy fallback was doing `[org.sector]` where
// org.sector is a JSON-stringified TEXT column (e.g. the literal string
// '["Health"]'), not a real array. Wrapping that string in an array
// produced mandate_sectors = ['["Health"]'] -- a single garbage string
// containing literal brackets and quotes, not ["Health"]. This corrupted
// sector_fit judgments for every corporate org relying on the legacy
// `sector` column instead of `mandate_sectors`. Now parsed properly via
// parseLegacySector(), which JSON.parses the column and falls back to
// treating it as a plain string only if parsing fails.
// (b) scoreInitiatives silently dropped an entire batch (up to
// BATCH_SIZE=15 initiatives) on any transient failure -- a timeout, rate
// limit, or malformed model response returned [] with no retry, degrading
// the visible match count with no recovery attempt and no signal beyond a
// server log. Now retries a failed batch once before giving up.
//
// v17: CRITERIA_VERSION bumped 4 -> 5. The csr_focus_statement fix (below,
// v15) shipped in the same v4 cache generation as the deterministic-scoring
// change (also v4) -- no version bump happened between them, so caches
// already on v4 had no way to signal whether they predated the prompt fix
// or postdated it. Confirmed live: an org whose CSR focus statement read
// "climate resilience" still showed esg_fit: no_match on a climate
// initiative, because its cache was written before the fix reached the
// actual prompt, and the v16 churn-protection fix correctly (if
// unhelpfully, here) left it untouched since nothing about its age or
// version looked stale. This bump is the only way to force everyone
// through one clean recompute under the corrected prompt.
//
// v16: minScore is no longer a cache-write filter. Previously anything
// scoring below minScore (35 corporate / 40 funder) was thrown away before
// it ever reached the cache -- a genuinely promising early-stage
// initiative that's simply light on formal diligence got the exact same
// treatment as a real mismatch: invisible. Now every scored initiative is
// cached (still capped at MAX_CACHED_MATCHES, still ranked by score).
// minScore is returned in the response as min_score so callers can group
// into "strong" vs "other" for display -- it's a label now, not a gate.
//
// v15: csr_focus_statement now included in the corporate mandate object.
//
// v14: STOP FULL-CACHE CHURN. Only initiatives NOT YET in this org's cache
// get scored. Existing cached rows are carried over byte-for-byte unless a
// genuine full recompute is warranted (cache TTL expired, criteria_version
// bumped, or cache empty).
//
// v11: PAGINATED FETCH. Fetches ALL published initiatives (capped at
// FETCH_SAFETY_CAP).

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
const MAX_CACHED_MATCHES = 30;
// Fallback only -- the real value is read from criteria_versions at
// request time. Kept in sync manually as a safety net for the rare case
// the table read fails; not the source of truth.
const CRITERIA_VERSION_FALLBACK = 6;
const BATCH_SIZE = 15;
const FETCH_SAFETY_CAP = 300;

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

async function scoreInitiatives(mandate: any, initiatives: any[]): Promise<any[]> {
  if (initiatives.length === 0) return [];
  const batches = chunk(initiatives, BATCH_SIZE);

  async function attemptBatch(batchInitiatives: any[], b: number, attempt: number): Promise<any[]> {
    try {
      const matchRes = await fetch(`${SUPABASE_URL}/functions/v1/match-initiatives-to-funder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mandate, initiatives: batchInitiatives }),
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

    // Owner -> own id. Active Member -> their Owner's id. Neither -> own id
    // (fallback, matches the client-side resolveOrgOwnerId() default).
    const { data: ownerId, error: ownerIdError } = await callerClient.rpc("resolve_org_owner_id");
    if (ownerIdError || !ownerId) {
      console.error(`[refresh-initiative-matches] resolve_org_owner_id failed for user ${user.id}: ${ownerIdError?.message}`);
      return new Response(JSON.stringify({ error: "Could not resolve organisation identity" }), {
        status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const { data: org, error: orgError } = await callerClient
      .from("organizations")
      .select("*")
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
    if (!isFunder && !isCorporate) {
      return new Response(JSON.stringify({ eligible: false, reason: "org_type_not_supported" }), {
        status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    if (org.flagged_visibility_hold) {
      return new Response(JSON.stringify({ eligible: false, reason: "flagged_visibility_hold" }), {
        status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    // AI-powered initiative matching is a Plus+ feature (see billing
    // scoping notes) -- same gate, same reasoning as v17 of
    // refresh-partnership-matches. Applied here too since this is a
    // separate pipeline (match-initiatives-to-funder, not
    // match-orgs-for-partnership) that wasn't covered by that earlier fix.
    if (org.subscription_tier === "free") {
      return new Response(JSON.stringify({ eligible: false, reason: "requires_upgrade", required_tier: "plus" }), {
        status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const { data: existingCache } = await callerClient
      .from("initiative_match_cache")
      .select("initiative_id, score, match_reason, criteria, criteria_version, computed_at")
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
      selectCols = "id,title,sectors,locations,status,created_at,problem,outcome,budget_min,budget_max,budget_currency,stage,sdg_tags,target_population,specific_ask,submitter_org,user_id,open_to_remote_partnerships";
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
    } else {
      minScore = 35;
      selectCols = "id,title,sectors,locations,status,created_at,problem,outcome,budget,esg_alignment,specific_ask,stage,sdg_tags,submitter_org,user_id,open_to_remote_partnerships";
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
        partnership_types: ESG_PARTNERSHIP_TYPES,
      };
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

    async function attachDD(rows: any[]): Promise<any[]> {
      const submitterIds = [...new Set(rows.map((i: any) => i.user_id).filter(Boolean))];
      if (submitterIds.length === 0) return rows;
      const { data: ddRows } = await serviceClient
        .from("organizations")
        .select("user_id, dd_financial_model, dd_audited_accounts, dd_governance_doc, dd_esg_assessment, dd_impact_framework, dd_environmental_policy, dd_safeguarding_policy, dd_legal_registration, dd_legal_compliance_declaration")
        .in("user_id", submitterIds);
      const ddMap = new Map((ddRows ?? []).map((r: any) => {
        const count = [r.dd_financial_model, r.dd_audited_accounts, r.dd_governance_doc, r.dd_esg_assessment, r.dd_impact_framework, r.dd_environmental_policy, r.dd_safeguarding_policy, r.dd_legal_registration, r.dd_legal_compliance_declaration].filter(Boolean).length;
        return [r.user_id, Math.round((count / 9) * 100)];
      }));
      return rows.map((i: any) => ({ ...i, dd_readiness_score: ddMap.get(i.user_id) ?? 0 }));
    }

    if (isFullStale) {
      initiatives = await fetchPublished(q => q);
      if (!isFunder && initiatives) {
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

      initiatives = await attachDD(initiatives);
      const allRanked = await scoreInitiatives(mandate, initiatives);
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
        .sort((a: any, b: any) => b.score - a.score)
        .slice(0, MAX_CACHED_MATCHES);

      const { error: deleteError } = await serviceClient.from("initiative_match_cache").delete().eq("org_id", org.id);
      if (deleteError) {
        console.error(`[refresh-initiative-matches] cache delete failed for org ${org.id}: ${deleteError.message}`);
      }

      if (topMatches.length > 0) {
        const now = new Date().toISOString();
        const rows = topMatches.map((r: any) => ({
          org_id: org.id, initiative_id: r.id, score: r.score, match_reason: r.match_reason,
          criteria: r.criteria ?? null, criteria_version: CRITERIA_VERSION, computed_at: now,
        }));
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
        matches: topMatches.map((r: any) => ({
          initiative_id: r.id, score: r.score, match_reason: r.match_reason, criteria: r.criteria ?? null,
        })),
      }), { status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
    }

    const cachedIds = new Set((existingCache ?? []).map(r => r.initiative_id));
    const allPublished = await fetchPublished(q => q);
    const missing = (allPublished ?? []).filter((i: any) => !cachedIds.has(i.id));

    if (missing.length === 0) {
      return new Response(JSON.stringify({
        eligible: true, cached: true, computed_at: new Date(oldestComputedAt).toISOString(), min_score: minScore, matches: existingCache,
      }), { status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
    }

    const missingWithDD = await attachDD(missing);
    const freshlyRanked = await scoreInitiatives(mandate, missingWithDD);
    const now = new Date().toISOString();
    const newRows = freshlyRanked
      .map((r: any) => ({
        org_id: org.id, initiative_id: r.id, score: r.score, match_reason: r.match_reason,
        criteria: r.criteria ?? null, criteria_version: CRITERIA_VERSION, computed_at: now,
      }));

    const merged = [...(existingCache ?? []), ...newRows]
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, MAX_CACHED_MATCHES);

    const { error: deleteError } = await serviceClient.from("initiative_match_cache").delete().eq("org_id", org.id);
    if (deleteError) {
      console.error(`[refresh-initiative-matches] incremental delete failed for org ${org.id}: ${deleteError.message}`);
    }
    if (merged.length > 0) {
      const { error: insertError } = await serviceClient.from("initiative_match_cache").insert(
        merged.map((r: any) => ({
          org_id: org.id, initiative_id: r.initiative_id, score: r.score, match_reason: r.match_reason,
          criteria: r.criteria ?? null, criteria_version: CRITERIA_VERSION, computed_at: r.computed_at,
        }))
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
      matches: merged.map((r: any) => ({
        initiative_id: r.initiative_id, score: r.score, match_reason: r.match_reason, criteria: r.criteria ?? null,
      })),
    }), { status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });

  } catch (err) {
    console.error(`[refresh-initiative-matches] Uncaught exception: ${String(err)}`);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
});
