import { supabase } from "@/lib/supabase";
export interface ImpactClaim {
  id: string;
  indicator_id: string;
  claiming_org_id: string;
  claim_text: string;
  indicator_value: string;
  evidence_type: "file" | "link";
  evidence_value: string;
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
  created_at: string;
}
const CLAIM_COLUMNS =
  "id,indicator_id,claiming_org_id,claim_text,indicator_value,evidence_type,evidence_value,status,confirmed_by_org_id,confirmed_at,challenge_reason,challenge_raised_by_org_id,challenge_raised_at,response_window_days,response_deadline,claimant_response,disputed_by_org_id,disputed_at,dispute_reason,created_at";
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
