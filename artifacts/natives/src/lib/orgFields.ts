import { supabase } from "@/lib/supabase";

// Single write path for organizations-table field updates -- extracted
// from DashboardProfile.tsx so other screens (the partnership-listing
// editor's DD checklist) persist the same way instead of each keeping
// their own separate .update() call.
export async function saveOrgFields(userId: string, fields: Record<string, any>): Promise<void> {
  const { error } = await supabase.from("organizations")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (error) throw error;
}
