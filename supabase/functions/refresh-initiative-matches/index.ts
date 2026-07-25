// supabase/functions/refresh-initiative-matches/index.ts
// Session-resolved wrapper around match-initiatives-to-funder, same pattern
// as refresh-partnership-matches.
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
// This also fixes the silent-failure UX: when literally nothing cleared
// minScore before, the frontend had nothing real to show and fell back to
// unscored initiatives dressed up as matches. Now there's always
// something real in the cache to fall back to, labeled honestly as a
// lighter fit rather than hidden or faked.
//
// v15: csr_focus_statement now included in the corporate mandate object --
// previously the org's actual CSR focus text was captured in the DB but
// never made it into the mandate passed to match-initiatives-to-funder, so
// esg_fit was being judged against a generic fallback sentence with no
// real content whenever esg_frameworks was empty. Not model conservatism,
// a data-plumbing gap.
//
// v14: STOP FULL-CACHE CHURN. Previously ANY newly published initiative
// anywhere on the platform (`newerInitiativeCount > 0`) forced a full
// wipe-and-rescore of this org's ENTIRE cached match set -- every
// initiative's score and match_reason got a brand-new, independently
// sampled LLM answer, even ones that hadn't changed at all. Score and
// match_reason are model-generated free text with no fixed formula tying
// them to the criteria object, so repeated scoring of the identical
// initiative/mandate pair produces materially different numbers and
// wording each time (confirmed live: same pair scored 78 then 85, with
// two entirely different match_reason strings, for unchanged underlying
// data). Combined with the daily cron worker
// (refresh-initiative-matches-for-org) ALSO doing an unconditional full
// rescore every time it touches an org, this meant a funder/corporate's
// already-seen initiative matches kept changing on essentially every
// visit -- not a data bug, a churn bug.
//
// Fix: only initiatives NOT YET in this org's cache get scored. Existing
// cached rows are carried over byte-for-byte (same score, same
// match_reason, same computed_at) unless a genuine full recompute is
// warranted (cache TTL expired, or criteria_version bumped, or the cache
// is empty). A newly published initiative now only adds itself to the
// list -- it no longer causes every other initiative's score to be
// silently re-rolled.
//
// Known minor gap: an initiative that was previously scored below
// minScore (and so never entered the cache) will be re-tried on every
// incremental call until the next full recompute, since "not in cache"
// can't distinguish "never scored" from "scored too low." Acceptable --
// it costs a wasted scoring call for that one initiative, not a visible
// regression, and self-corrects at the next 12h full pass.
//
// v11: PAGINATED FETCH. Previously fetched only the 15 most recently
// published initiatives before they ever reached the matching model --
// that cutoff was calibrated for llama-3.1-8b-instant's TPM ceiling and
// was never revisited after match-initiatives-to-funder moved to
// openai/gpt-oss-120b. Now fetches ALL published initiatives (capped at
// FETCH_SAFETY_CAP as a sanity ceiling).
//
// CRITERIA_VERSION bumped 2 -> 3: funder criteria's budget_overlap_pct
// (a number) replaced with budget_fit (match/partial/no_match).

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
// v5: csr_focus_statement reaching the actual prompt (in
// match-initiatives-to-funder) shipped in the same v4 cache generation as
// the deterministic-scoring change, with no version bump between them --
// so every org's cache silently kept serving pre-fix esg_fit judgments
// (protected from re-scoring by the v16 churn fix, which only forces a
// full recompute on an empty cache, 12h+ age, or a version mismatch).
// Confirmed live: an org whose CSR focus statement literally read "climate
// resilience" still showed esg_fit: no_match on a climate initiative,
// because its cache predated the fix reaching the prompt. Bumping forces
// one clean recompute for every org using the corrected prompt.
const CRITERIA_VERSION = 5;
const BATCH_SIZE = 15;
const FETCH_SAFETY_CAP = 300;

const FUNDER_TYPES = ["philanthropic_foundation", "venture_capital"];
const CORPORATE_TYPES = ["corporation", "technology_company", "public_sector"];
const ESG_PARTNERSHIP_TYPES = ["operational", "strategic", "lead", "other"];

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function scoreInitiatives(mandate: any, initiatives: any[]): Promise<any[]> {
  if (initiatives.length === 0) return [];
  const batches = chunk(initiatives, BATCH_SIZE);
  const batchResults = await Promise.all(batches.map(async (batchInitiatives, b) => {
    try {
      const matchRes = await fetch(`${SUPABASE_URL}/functions/v1/match-initiatives-to-funder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mandate, initiatives: batchInitiatives }),
      });
      if (!matchRes.ok) {
        const errText = await matchRes.text();
        console.error(`[refresh-initiative-matches] batch ${b + 1}/${batches.length} failed: ${errText}`);
        return [];
      }
      const { data: ranked } = await matchRes.json();
      return ranked ?? [];
    } catch (batchErr) {
      console.error(`[refresh-initiative-matches] batch ${b + 1}/${batches.length} threw: ${String(batchErr)}`);
      return [];
    }
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

    const orgTypeForGate = org.organisation_type;
    const isFunder = FUNDER_TYPES.includes(orgTypeForGate);
    const isCorporate = CORPORATE_TYPES.includes(orgTypeForGate);
    if (!isFunder && !isCorporate) {
      return new Response(JSON.stringify({ eligible: false, reason: "org_type_not_supported" }), {
        status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const { data: existingCache } = await callerClient
      .from("initiative_match_cache")
      .select("initiative_id, score, match_reason, criteria, criteria_version, computed_at")
      .eq("org_id", org.id)
      .order("score", { ascending: false });

    // Age is measured from the OLDEST row still in the cache, not the
    // newest -- once incremental merges start adding individually-timed
    // rows, the oldest surviving row tells us "how long since this set
    // was last fully recomputed," which is what actually governs the
    // 12h TTL. Using the newest row here would let one recent incremental
    // addition make a genuinely stale full set look fresh forever.
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
        mandate_sectors: org.mandate_sectors ?? (org.sector ? [org.sector] : []),
        mandate_sdgs: org.mandate_sdgs ?? [],
        esg_frameworks: org.esg_frameworks,
        csr_focus_statement: org.csr_focus_statement,
        csr_budget_range: org.csr_budget_range,
        partnership_types: ESG_PARTNERSHIP_TYPES,
      };
    }

    async function fetchPublished(query: (q: any) => any) {
      let q = callerClient.from("initiative_requests").select(selectCols).eq("status", "published")
        .order("created_at", { ascending: false }).limit(FETCH_SAFETY_CAP);
      q = query(q);
      const { data } = await q;
      return data;
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

    if (isFullStale) {
      // Genuine full recompute: cache empty, TTL expired, or schema
      // version bumped. Same behaviour as before this fix -- every
      // published initiative gets a fresh score.
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

      // No score filter here anymore -- every initiative that actually got
      // scored is kept, not just the ones clearing minScore. A weak-but-real
      // fit (e.g. a strong thematic match still light on formal diligence)
      // should stay visible, not vanish the same way a genuine mismatch
      // does. minScore now only labels "strong" vs "other" for the caller;
      // it no longer decides what gets remembered at all.
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

    // Incremental path: cache is still within TTL and on the current
    // schema version. Only score initiatives not already represented in
    // the cache -- everything else is returned exactly as stored.
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

    // Merge: existing rows keep their original score/reason/computed_at
    // untouched; only genuinely new initiatives are freshly scored. If
    // the merged set exceeds the cap, the lowest-scoring rows (old or
    // new) drop off -- that's a real ranking change, not churn.
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