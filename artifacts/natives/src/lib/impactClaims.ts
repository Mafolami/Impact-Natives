import { supabase } from "@/lib/supabase";
export interface ImpactClaim {
  id: string;
  indicator_id: string;
  claiming_org_id: string;
  status: "pending" | "confirmed" | "challenged" | "disputed";
  confirmed_by_org_id: string | null;
  confirmed_at: string | null;
  challenge_reason: string | null;
  challenge_raised_by_org_id: string | null;
  challenge_raised_at: string | null;
  response_window_days: number | null;
  response_deadline: string | null;
  claimant_response: string | null;
  disputed_by_org_id: string | null;
  disputed_at: string | null;
  dispute_reason: string | null;
  prior_claim_id: string | null;
  claimed_value: string;
  created_at: string;
}
// claim_text/indicator_value/evidence_type/evidence_value were dropped
// from this table this session -- evidence now lives per proof point in
// impact_claim_evidence, fetched separately by whatever component needs
// it (ImpactClaimReview joins proof points + evidence directly). This
// row is the bundle/status-machine record only.
const CLAIM_COLUMNS =
  "id,indicator_id,claiming_org_id,status,confirmed_by_org_id,confirmed_at,challenge_reason,challenge_raised_by_org_id,challenge_raised_at,response_window_days,response_deadline,claimant_response,disputed_by_org_id,disputed_at,dispute_reason,prior_claim_id,claimed_value,created_at";
export async function fetchClaimsForIndicators(indicatorIds: string[]): Promise<ImpactClaim[]> {
  if (indicatorIds.length === 0) return [];
  const { data } = await supabase
    .from("impact_claims")
    .select(CLAIM_COLUMNS)
    .in("indicator_id", indicatorIds)
    .order("created_at", { ascending: false });
  return (data as ImpactClaim[]) ?? [];
}
// The claim that determines an indicator's current board column is
// simply the most recent one for that indicator -- claims is already
// fetched newest-first, so this is just a filter, not a re-sort.
export function latestClaimFor(indicatorId: string, claims: ImpactClaim[]): ImpactClaim | null {
  return claims.find((c) => c.indicator_id === indicatorId) ?? null;
}
// Option A: each org's claim on an indicator is tracked independently --
// two orgs can have active claims on the same indicator simultaneously,
// each reviewed only by the other bilateral party. This is the per-org
// counterpart to latestClaimFor above (which collapses to one claim per
// indicator and no longer reflects how the board works).
export function latestClaimForOrg(indicatorId: string, orgId: string, claims: ImpactClaim[]): ImpactClaim | null {
  return claims.find((c) => c.indicator_id === indicatorId && c.claiming_org_id === orgId) ?? null;
}
export type IndicatorClaimStage = "awaiting_evidence" | "under_review" | "verified" | "in_dispute";
// A disputed claim reopens the indicator rather than dead-ending it -- a
// fresh "Submit claim" becomes available again, same as if no claim had
// ever been submitted. The disputed claim itself isn't deleted; it just
// stops being the one that decides the current stage once a newer claim
// supersedes it.
export function claimStageFor(latest: ImpactClaim | null): IndicatorClaimStage {
  if (!latest || latest.status === "disputed") return "awaiting_evidence";
  if (latest.status === "pending") return "under_review";
  if (latest.status === "confirmed") return "verified";
  return "in_dispute"; // "challenged"
}
