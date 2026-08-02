// src/lib/relationshipAccess.ts
//
// Stage 3 of the DD readiness evidence build: a single shared check for
// "does the current viewer have a live relationship with this org" --
// used to gate sensitive DD evidence fields (registration number, TIN)
// on the public profile. "Live" is deliberately earlier than the bar used
// for Contact info elsewhere on the platform (which waits for Confirmed/
// Formed) -- per direct instruction, this reveals once a conversation is
// actually open or a partnership has been accepted, not just requested.

import { supabase } from "@/lib/supabase";

export async function hasLiveRelationshipWith(params: {
  viewerUserId: string;
  viewerOrgId: string | null;
  targetUserId: string;
  targetOrgId: string | null;
}): Promise<boolean> {
  // Same person viewing their own profile always sees everything.
  if (params.viewerUserId === params.targetUserId) return true;

  // ── Check 1: initiative-side -- an open conversation with both parties ──
  const { data: viewerConvos } = await supabase
    .from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", params.viewerUserId);
  const viewerConvoIds = (viewerConvos ?? []).map(c => c.conversation_id);

  if (viewerConvoIds.length > 0) {
    const { data: sharedConvos } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", params.targetUserId)
      .in("conversation_id", viewerConvoIds);
    const sharedIds = (sharedConvos ?? []).map(c => c.conversation_id);

    if (sharedIds.length > 0) {
      const { data: openConvo } = await supabase
        .from("conversations")
        .select("id")
        .in("id", sharedIds)
        .eq("status", "open")
        .limit(1);
      if (openConvo && openConvo.length > 0) return true;
    }
  }

  // ── Check 2: partnership-side -- an accepted connection, either direction ──
  if (params.viewerOrgId && params.targetOrgId) {
    const { data: acceptedConn } = await supabase
      .from("partnership_connections")
      .select("id")
      .or(
        `and(sender_org_id.eq.${params.viewerOrgId},receiver_org_id.eq.${params.targetOrgId}),` +
        `and(sender_org_id.eq.${params.targetOrgId},receiver_org_id.eq.${params.viewerOrgId})`
      )
      .eq("status", "accepted")
      .limit(1);
    if (acceptedConn && acceptedConn.length > 0) return true;
  }

  return false;
}