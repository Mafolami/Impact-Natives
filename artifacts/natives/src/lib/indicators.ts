import { supabase } from "@/lib/supabase";
import type { OrgRef } from "@/lib/milestones";
const INDICATOR_COLUMNS =
  "id,mou_document_id,name,definition,baseline_value,target_value,measurement_window,source,created_by_org_id,agreed_by_other_org_id,agreed_by_other_org_at,rejected_by_org_id,rejected_by_org_at,rejection_reason,suggested_by_org_id,suggested_at,suggested_name,suggested_definition,suggested_baseline_value,suggested_target_value,suggested_measurement_window,suggested_source,created_at";
export interface PartnershipIndicator {
  id: string;
  mou_document_id: string;
  name: string;
  definition: string;
  baseline_value: string | null;
  target_value: string;
  measurement_window: string;
  source: string | null;
  created_by_org_id: string;
  agreed_by_other_org_id: string | null;
  agreed_by_other_org_at: string | null;
  rejected_by_org_id: string | null;
  rejected_by_org_at: string | null;
  rejection_reason: string | null;
  suggested_by_org_id: string | null;
  suggested_at: string | null;
  suggested_name: string | null;
  suggested_definition: string | null;
  suggested_baseline_value: string | null;
  suggested_target_value: string | null;
  suggested_measurement_window: string | null;
  suggested_source: string | null;
  created_at: string;
}
// Three real states now: pending, agreed, rejected -- agreed and rejected
// are mutually exclusive at the application layer (agreeing clears any
// prior rejection, rejecting clears any prior agreement), not via a DB
// constraint, since re-proposing after rejection is a normal flow.
export const INDICATOR_AGREEMENT_LABEL: Record<"pending" | "agreed" | "rejected", { label: string; tone: "waiting" | "success" | "danger" }> = {
  pending: { label: "Awaiting agreement", tone: "waiting" },
  agreed: { label: "Agreed", tone: "success" },
  rejected: { label: "Rejected", tone: "danger" },
};
export const INDICATOR_AGREEMENT_PILL_STYLES: Record<string, string> = {
  waiting: "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40 text-amber-600 dark:text-amber-500",
  success: "bg-[#2D6A4F]/[0.06] border-[#2D6A4F]/20 text-[#2D6A4F]",
  danger: "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-500",
};
export function isIndicatorAgreed(indicator: PartnershipIndicator): boolean {
  return !!indicator.agreed_by_other_org_id;
}
export function isIndicatorRejected(indicator: PartnershipIndicator): boolean {
  return !!indicator.rejected_by_org_id && !indicator.agreed_by_other_org_id;
}
export function indicatorStatus(indicator: PartnershipIndicator): "pending" | "agreed" | "rejected" {
  if (isIndicatorAgreed(indicator)) return "agreed";
  if (isIndicatorRejected(indicator)) return "rejected";
  return "pending";
}
export async function fetchIndicatorsForDocuments(mouDocumentIds: string[]): Promise<PartnershipIndicator[]> {
  if (mouDocumentIds.length === 0) return [];
  const { data } = await supabase
    .from("partnership_indicators")
    .select(INDICATOR_COLUMNS)
    .in("mou_document_id", mouDocumentIds)
    .order("created_at", { ascending: true });
  return (data as PartnershipIndicator[]) ?? [];
}
export async function fetchIndicators(mouDocumentId: string): Promise<PartnershipIndicator[]> {
  const { data } = await supabase
    .from("partnership_indicators")
    .select(INDICATOR_COLUMNS)
    .eq("mou_document_id", mouDocumentId)
    .order("created_at", { ascending: true });
  return (data as PartnershipIndicator[]) ?? [];
}
export async function fetchIndicator(indicatorId: string): Promise<PartnershipIndicator | null> {
  const { data } = await supabase
    .from("partnership_indicators")
    .select(INDICATOR_COLUMNS)
    .eq("id", indicatorId)
    .maybeSingle();
  return (data as PartnershipIndicator) ?? null;
}
export async function createIndicator(input: {
  mou_document_id: string;
  name: string;
  definition: string;
  baseline_value: string | null;
  target_value: string;
  measurement_window: string;
  source: string | null;
  created_by_org_id: string;
}): Promise<PartnershipIndicator | null> {
  const { data } = await supabase
    .from("partnership_indicators")
    .insert(input)
    .select(INDICATOR_COLUMNS)
    .maybeSingle();
  return (data as PartnershipIndicator) ?? null;
}
// Scoped to indicators the caller created and that aren't yet agreed --
// mirrors the DELETE RLS policy exactly, so this either succeeds cleanly
// or the update simply won't apply (RLS silently returns zero rows rather
// than erroring), which fetchIndicator/fetchIndicators will reflect on
// the next read.
export async function updateIndicator(indicatorId: string, patch: {
  name: string;
  definition: string;
  baseline_value: string | null;
  target_value: string;
  measurement_window: string;
  source: string | null;
}): Promise<PartnershipIndicator | null> {
  const { data } = await supabase
    .from("partnership_indicators")
    .update(patch)
    .eq("id", indicatorId)
    .select(INDICATOR_COLUMNS)
    .maybeSingle();
  return (data as PartnershipIndicator) ?? null;
}
// RLS-scoped: only the creating org, only before the other party has
// agreed. Returns whether a row was actually deleted (RLS blocks
// silently rather than erroring, so an empty result here means the
// deletion didn't apply, not that it threw).
export async function deleteIndicator(indicatorId: string): Promise<boolean> {
  const { data } = await supabase
    .from("partnership_indicators")
    .delete()
    .eq("id", indicatorId)
    .select("id");
  return !!data && data.length > 0;
}
export function hasPendingSuggestion(indicator: PartnershipIndicator): boolean {
  return !!indicator.suggested_by_org_id;
}
// Writes into the suggested_* holding columns only -- the live name/
// definition/baseline_value/target_value/measurement_window/source are
// untouched until the reviewing org explicitly accepts.
export async function proposeIndicatorRefinement(indicatorId: string, proposingOrgId: string, patch: {
  name: string;
  definition: string;
  baseline_value: string | null;
  target_value: string;
  measurement_window: string;
  source: string | null;
}): Promise<void> {
  await supabase
    .from("partnership_indicators")
    .update({
      suggested_by_org_id: proposingOrgId,
      suggested_at: new Date().toISOString(),
      suggested_name: patch.name,
      suggested_definition: patch.definition,
      suggested_baseline_value: patch.baseline_value,
      suggested_target_value: patch.target_value,
      suggested_measurement_window: patch.measurement_window,
      suggested_source: patch.source,
    })
    .eq("id", indicatorId);
}
// Copies suggested_* into the live fields and clears the holding columns.
// Also clears any prior agreement/rejection -- an accepted refinement is
// a real change to what the indicator says, so a previously agreed
// version no longer applies and needs fresh agreement.
export async function acceptIndicatorRefinement(indicator: PartnershipIndicator): Promise<void> {
  await supabase
    .from("partnership_indicators")
    .update({
      name: indicator.suggested_name ?? indicator.name,
      definition: indicator.suggested_definition ?? indicator.definition,
      baseline_value: indicator.suggested_baseline_value,
      target_value: indicator.suggested_target_value ?? indicator.target_value,
      measurement_window: indicator.suggested_measurement_window ?? indicator.measurement_window,
      source: indicator.suggested_source,
      suggested_by_org_id: null,
      suggested_at: null,
      suggested_name: null,
      suggested_definition: null,
      suggested_baseline_value: null,
      suggested_target_value: null,
      suggested_measurement_window: null,
      suggested_source: null,
      agreed_by_other_org_id: null,
      agreed_by_other_org_at: null,
      rejected_by_org_id: null,
      rejected_by_org_at: null,
      rejection_reason: null,
    })
    .eq("id", indicator.id);
}
export async function dismissIndicatorRefinement(indicatorId: string): Promise<void> {
  await supabase
    .from("partnership_indicators")
    .update({
      suggested_by_org_id: null,
      suggested_at: null,
      suggested_name: null,
      suggested_definition: null,
      suggested_baseline_value: null,
      suggested_target_value: null,
      suggested_measurement_window: null,
      suggested_source: null,
    })
    .eq("id", indicatorId);
}
export async function agreeToIndicator(indicatorId: string, agreeingOrgId: string): Promise<void> {
  await supabase
    .from("partnership_indicators")
    .update({
      agreed_by_other_org_id: agreeingOrgId,
      agreed_by_other_org_at: new Date().toISOString(),
      rejected_by_org_id: null,
      rejected_by_org_at: null,
      rejection_reason: null,
    })
    .eq("id", indicatorId);
}
export async function rejectIndicator(indicatorId: string, rejectingOrgId: string, reason: string): Promise<void> {
  await supabase
    .from("partnership_indicators")
    .update({
      rejected_by_org_id: rejectingOrgId,
      rejected_by_org_at: new Date().toISOString(),
      rejection_reason: reason,
      agreed_by_other_org_id: null,
      agreed_by_other_org_at: null,
    })
    .eq("id", indicatorId);
}