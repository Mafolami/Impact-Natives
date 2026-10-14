// supabase/functions/transition-impact-claim/index.ts
//
// v5 (14 Oct 2026): legacy JWT keys disabled after a leak. Uses the new
// publishable key (caller client) and secret key (service client). No
// logic change.
//
// v3: Sole path for impact_claims.status transitions and evidence review
// actions. No tier gate here by design. Status machine:
//   pending -> confirmed | disputed
//   confirmed -> challenged (min 14-day window)
//   challenged -> confirmed (withdraw) | disputed (after response/deadline)
// recompute_impact_score(org_id) runs after status-changing actions.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function __envKeys(name: string): Record<string, string> {
  try { return JSON.parse(Deno.env.get(name) ?? "{}"); } catch { return {}; }
}
const SECRET_KEY = __envKeys("SUPABASE_SECRET_KEYS")["default"] ?? Object.values(__envKeys("SUPABASE_SECRET_KEYS"))[0] ?? "";
const PUBLISHABLE_KEY = __envKeys("SUPABASE_PUBLISHABLE_KEYS")["default"] ?? Object.values(__envKeys("SUPABASE_PUBLISHABLE_KEYS"))[0] ?? "";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = PUBLISHABLE_KEY;
const SUPABASE_SERVICE_ROLE_KEY = SECRET_KEY;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MIN_RESPONSE_WINDOW_DAYS = 14;

function jsonResponse(body: Record<string, any>, status: number) {
  return new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userError } = await callerClient.auth.getUser();
  if (userError || !user) return jsonResponse({ error: "Unauthorized" }, 401);

  const { data: ownerId } = await callerClient.rpc("resolve_org_owner_id");
  const { data: callerOrg } = await callerClient
    .from("organizations").select("id").eq("user_id", ownerId ?? user.id).maybeSingle();
  if (!callerOrg) return jsonResponse({ error: "No organisation found for this account" }, 403);
  const callerOrgId: string = callerOrg.id;

  try {
    const body = await req.json();
    const { claim_id, action } = body;
    if (!claim_id || !action) return jsonResponse({ error: "claim_id and action are required" }, 400);

    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: claim } = await serviceClient
      .from("impact_claims")
      .select("id, indicator_id, claiming_org_id, status, confirmed_at, challenge_raised_by_org_id, response_deadline, claimant_response")
      .eq("id", claim_id).maybeSingle();
    if (!claim) return jsonResponse({ error: "Claim not found" }, 404);

    const { data: indicator } = await serviceClient
      .from("partnership_indicators").select("mou_document_id").eq("id", claim.indicator_id).maybeSingle();
    if (!indicator) return jsonResponse({ error: "Indicator not found" }, 404);

    const { data: mouDoc } = await serviceClient
      .from("mou_documents").select("org_a_id, org_b_id").eq("id", indicator.mou_document_id).maybeSingle();
    if (!mouDoc) return jsonResponse({ error: "Agreement not found" }, 404);

    const isParticipant = callerOrgId === mouDoc.org_a_id || callerOrgId === mouDoc.org_b_id;
    if (!isParticipant) return jsonResponse({ error: "Not a participant on this agreement" }, 403);

    const isClaimant = callerOrgId === claim.claiming_org_id;
    const isCounterparty = !isClaimant;

    const now = new Date();
    const nowIso = now.toISOString();

    async function writeHistory(status: string, reason: string | null) {
      await serviceClient.from("impact_claim_status_history").insert({
        claim_id, status, changed_by_org_id: callerOrgId, reason,
      });
    }

    async function recomputeScore() {
      const { error } = await serviceClient.rpc("recompute_impact_score", { p_org_id: claim.claiming_org_id });
      if (error) console.error("recompute_impact_score failed for org", claim.claiming_org_id, error);
    }

    if (action === "set_evidence_dismissal") {
      const { evidence_id, dismissed } = body;
      if (!evidence_id || typeof dismissed !== "boolean") {
        return jsonResponse({ error: "evidence_id and dismissed (boolean) are required" }, 400);
      }
      if (!isCounterparty) return jsonResponse({ error: "Only the counterparty can dismiss evidence" }, 403);

      const { data: evidenceRow } = await serviceClient
        .from("impact_claim_evidence")
        .select("id, claim_id, proof_point_id")
        .eq("id", evidence_id).maybeSingle();
      if (!evidenceRow) return jsonResponse({ error: "Evidence item not found" }, 404);
      if (evidenceRow.claim_id !== claim_id) {
        return jsonResponse({ error: "Evidence item does not belong to this claim" }, 400);
      }
      if (evidenceRow.proof_point_id !== null) {
        return jsonResponse({ error: "Only supplementary evidence items can be dismissed" }, 400);
      }

      const { error } = await serviceClient
        .from("impact_claim_evidence")
        .update({ reviewer_dismissed: dismissed })
        .eq("id", evidence_id);
      if (error) return jsonResponse({ error: "Could not update evidence" }, 500);
      return jsonResponse({ status: "ok", evidence_id, dismissed }, 200);
    }

    if (action === "confirm") {
      if (claim.status !== "pending") return jsonResponse({ error: "Claim is not pending" }, 409);
      if (!isCounterparty) return jsonResponse({ error: "Only the counterparty can confirm a claim" }, 403);
      const { error } = await serviceClient.from("impact_claims").update({
        status: "confirmed", confirmed_by_org_id: callerOrgId, confirmed_at: nowIso, updated_at: nowIso,
      }).eq("id", claim_id);
      if (error) return jsonResponse({ error: "Could not confirm claim" }, 500);
      await writeHistory("confirmed", null);
      await recomputeScore();
      return jsonResponse({ status: "confirmed" }, 200);
    }

    if (action === "dispute") {
      const { dispute_reason } = body;
      if (!dispute_reason || !String(dispute_reason).trim()) {
        return jsonResponse({ error: "dispute_reason is required" }, 400);
      }
      if (!isCounterparty) return jsonResponse({ error: "Only the counterparty can dispute a claim" }, 403);

      if (claim.status === "pending") {
        const { error } = await serviceClient.from("impact_claims").update({
          status: "disputed", disputed_by_org_id: callerOrgId, disputed_at: nowIso,
          dispute_reason: String(dispute_reason).trim(), updated_at: nowIso,
        }).eq("id", claim_id);
        if (error) return jsonResponse({ error: "Could not dispute claim" }, 500);
        await writeHistory("disputed", String(dispute_reason).trim());
        await recomputeScore();
        return jsonResponse({ status: "disputed" }, 200);
      }

      if (claim.status === "challenged") {
        if (claim.challenge_raised_by_org_id !== callerOrgId) {
          return jsonResponse({ error: "Only the org that raised the challenge can proceed to dispute" }, 403);
        }
        const deadlinePassed = claim.response_deadline ? now > new Date(claim.response_deadline) : false;
        const claimantResponded = !!claim.claimant_response;
        if (!claimantResponded && !deadlinePassed) {
          return jsonResponse({ error: "Cannot dispute yet -- waiting for claimant response or deadline" }, 409);
        }
        const { error } = await serviceClient.from("impact_claims").update({
          status: "disputed", disputed_by_org_id: callerOrgId, disputed_at: nowIso,
          dispute_reason: String(dispute_reason).trim(), updated_at: nowIso,
        }).eq("id", claim_id);
        if (error) return jsonResponse({ error: "Could not dispute claim" }, 500);
        await writeHistory("disputed", String(dispute_reason).trim());
        await recomputeScore();
        return jsonResponse({ status: "disputed" }, 200);
      }

      return jsonResponse({ error: "Claim must be pending or challenged to dispute" }, 409);
    }

    if (action === "challenge") {
      const { challenge_reason, response_window_days } = body;
      if (claim.status !== "confirmed") return jsonResponse({ error: "Claim is not confirmed" }, 409);
      if (!isCounterparty) return jsonResponse({ error: "Only the counterparty can challenge a confirmation" }, 403);
      if (!challenge_reason || !String(challenge_reason).trim()) {
        return jsonResponse({ error: "challenge_reason is required" }, 400);
      }
      const windowDays = parseInt(response_window_days, 10);
      if (isNaN(windowDays) || windowDays < MIN_RESPONSE_WINDOW_DAYS) {
        return jsonResponse({ error: `response_window_days must be at least ${MIN_RESPONSE_WINDOW_DAYS}` }, 400);
      }
      const deadline = new Date(now.getTime() + windowDays * 24 * 60 * 60 * 1000).toISOString();
      const { error } = await serviceClient.from("impact_claims").update({
        status: "challenged", challenge_reason: String(challenge_reason).trim(),
        challenge_raised_by_org_id: callerOrgId, challenge_raised_at: nowIso,
        response_window_days: windowDays, response_deadline: deadline,
        claimant_response: null, updated_at: nowIso,
      }).eq("id", claim_id);
      if (error) return jsonResponse({ error: "Could not challenge claim" }, 500);
      await writeHistory("challenged", String(challenge_reason).trim());
      await recomputeScore();
      return jsonResponse({ status: "challenged", response_deadline: deadline }, 200);
    }

    if (action === "respond_to_challenge") {
      const { claimant_response } = body;
      if (claim.status !== "challenged") return jsonResponse({ error: "Claim is not currently challenged" }, 409);
      if (!isClaimant) return jsonResponse({ error: "Only the claimant can respond to a challenge" }, 403);
      if (!claimant_response || !String(claimant_response).trim()) {
        return jsonResponse({ error: "claimant_response is required" }, 400);
      }
      const deadlinePassed = claim.response_deadline ? now > new Date(claim.response_deadline) : false;
      if (deadlinePassed) return jsonResponse({ error: "Response deadline has passed" }, 409);
      const { error } = await serviceClient.from("impact_claims").update({
        claimant_response: String(claimant_response).trim(), updated_at: nowIso,
      }).eq("id", claim_id);
      if (error) return jsonResponse({ error: "Could not submit response" }, 500);
      await writeHistory("challenged", `Claimant responded: ${String(claimant_response).trim()}`);
      return jsonResponse({ status: "challenged" }, 200);
    }

    if (action === "withdraw_challenge") {
      if (claim.status !== "challenged") return jsonResponse({ error: "Claim is not currently challenged" }, 409);
      if (claim.challenge_raised_by_org_id !== callerOrgId) {
        return jsonResponse({ error: "Only the org that raised the challenge can withdraw it" }, 403);
      }
      const { error } = await serviceClient.from("impact_claims").update({
        status: "confirmed", updated_at: nowIso,
      }).eq("id", claim_id);
      if (error) return jsonResponse({ error: "Could not withdraw challenge" }, 500);
      await writeHistory("confirmed", "Challenge withdrawn");
      await recomputeScore();
      return jsonResponse({ status: "confirmed" }, 200);
    }

    return jsonResponse({ error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
});
