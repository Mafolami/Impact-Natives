import { supabase } from "@/lib/supabase";

export interface MouMilestone {
  id: string;
  mou_document_id: string;
  title: string;
  description: string | null;
  target_date: string | null;
  linked_amount: number | null;
  linked_currency: string | null;
  payer_org_id: string | null;
  recipient_org_id: string | null;
  status: "pending" | "in_review" | "verified" | "disbursed" | "revision_requested";
  created_at: string;
}

export interface MilestoneEvidenceRow {
  id: string;
  submitted_by: string;
  file_path: string | null;
  note: string | null;
  created_at: string;
}

export interface WorkflowComment {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
}

// Minimal shape any org object needs to satisfy for actorLabel/create --
// MouDocumentDetail's OrgFull and any future aggregate-page org type both
// already have these fields, so no import coupling is needed either way.
export interface OrgRef {
  id: string;
  user_id: string;
  organisation_name: string;
  partnership_sought?: string | null;
}

export const MILESTONE_STATUS_LABEL: Record<MouMilestone["status"], { label: string; tone: "locked" | "waiting" | "success" | "celebrate" }> = {
  pending: { label: "Pending", tone: "waiting" },
  revision_requested: { label: "Revision requested", tone: "locked" },
  in_review: { label: "In review", tone: "waiting" },
  verified: { label: "Verified", tone: "success" },
  disbursed: { label: "Disbursed", tone: "celebrate" },
};

export const MILESTONE_STATUS_PILL_STYLES: Record<string, string> = {
  locked: "bg-white dark:bg-card border-border text-black dark:text-white",
  waiting: "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40 text-amber-600 dark:text-amber-500",
  success: "bg-[#2D6A4F]/[0.06] border-[#2D6A4F]/20 text-[#2D6A4F]",
  celebrate: "bg-[#2D6A4F]/10 border-[#2D6A4F]/30 text-[#2D6A4F]",
};

export function isMilestoneOverdue(m: MouMilestone): boolean {
  return !!m.target_date && new Date(m.target_date) < new Date() && m.status !== "verified" && m.status !== "disbursed";
}

export async function fetchMilestones(mouDocumentId: string): Promise<MouMilestone[]> {
  const { data } = await supabase
    .from("mou_milestones")
    .select("id,mou_document_id,title,description,target_date,linked_amount,linked_currency,payer_org_id,recipient_org_id,status,created_at")
    .eq("mou_document_id", mouDocumentId)
    .order("target_date", { ascending: true, nullsFirst: false });
  return (data as MouMilestone[]) ?? [];
}

export async function fetchMilestone(milestoneId: string): Promise<MouMilestone | null> {
  const { data } = await supabase
    .from("mou_milestones")
    .select("id,mou_document_id,title,description,target_date,linked_amount,linked_currency,payer_org_id,recipient_org_id,status,created_at")
    .eq("id", milestoneId).maybeSingle();
  return (data as MouMilestone) ?? null;
}

export function actorLabel(userId: string, myUserId: string, orgA: OrgRef | null, orgB: OrgRef | null): string {
  if (userId === myUserId) return "You";
  if (orgA && userId === orgA.user_id) return orgA.organisation_name;
  if (orgB && userId === orgB.user_id) return orgB.organisation_name;
  return "Team member";
}
