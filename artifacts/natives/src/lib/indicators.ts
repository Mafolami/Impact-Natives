import { supabase } from "@/lib/supabase";
import type { OrgRef } from "@/lib/milestones";

export interface PartnershipIndicator {
  id: string;
  mou_document_id: string;
  name: string;
  definition: string;
  baseline_value: string | null;
  target_value: string;
  measurement_window: string;
  created_by_org_id: string;
  agreed_by_other_org_id: string | null;
  agreed_by_other_org_at: string | null;
  created_at: string;
}

// Indicators don't have a status state machine like milestones do --
// agreement is a single binary flag (agreed_by_other_org_id set or not),
// so no STATUS_LABEL keyed map applies here. This pill covers that
// one distinction instead.
export const INDICATOR_AGREEMENT_LABEL: Record<"pending" | "agreed", { label: string; tone: "waiting" | "success" }> = {
  pending: { label: "Awaiting agreement", tone: "waiting" },
  agreed: { label: "Agreed", tone: "success" },
};

export const INDICATOR_AGREEMENT_PILL_STYLES: Record<string, string> = {
  waiting: "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40 text-amber-600 dark:text-amber-500",
  success: "bg-[#2D6A4F]/[0.06] border-[#2D6A4F]/20 text-[#2D6A4F]",
};

export function isIndicatorAgreed(indicator: PartnershipIndicator): boolean {
  return !!indicator.agreed_by_other_org_id;
}

export async function fetchIndicators(mouDocumentId: string): Promise<PartnershipIndicator[]> {
  const { data } = await supabase
    .from("partnership_indicators")
    .select("id,mou_document_id,name,definition,baseline_value,target_value,measurement_window,created_by_org_id,agreed_by_other_org_id,agreed_by_other_org_at,created_at")
    .eq("mou_document_id", mouDocumentId)
    .order("created_at", { ascending: true });
  return (data as PartnershipIndicator[]) ?? [];
}

export async function fetchIndicator(indicatorId: string): Promise<PartnershipIndicator | null> {
  const { data } = await supabase
    .from("partnership_indicators")
    .select("id,mou_document_id,name,definition,baseline_value,target_value,measurement_window,created_by_org_id,agreed_by_other_org_id,agreed_by_other_org_at,created_at")
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
  created_by_org_id: string;
}): Promise<PartnershipIndicator | null> {
  const { data } = await supabase
    .from("partnership_indicators")
    .insert(input)
    .select("id,mou_document_id,name,definition,baseline_value,target_value,measurement_window,created_by_org_id,agreed_by_other_org_id,agreed_by_other_org_at,created_at")
    .maybeSingle();
  return (data as PartnershipIndicator) ?? null;
}

export async function agreeToIndicator(indicatorId: string, agreeingOrgId: string): Promise<void> {
  await supabase
    .from("partnership_indicators")
    .update({ agreed_by_other_org_id: agreeingOrgId, agreed_by_other_org_at: new Date().toISOString() })
    .eq("id", indicatorId);
}
