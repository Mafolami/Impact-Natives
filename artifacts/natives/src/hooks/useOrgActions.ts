// ─── useOrgActions.ts ─────────────────────────────────────────────────────────
// Extracted from DashboardPartnerships.tsx's inline state/handlers so
// OrgDetailPanel can be driven from any page (Portfolio's Table view, the
// Partnerships browse page, etc.) without each caller re-implementing
// save/express-interest wiring. Logic is unchanged from the original --
// only the closures over local component state became explicit hook state.

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { OrgRow } from "@/components/dashboard/OrgDetailPanel";

const VIEWER_ORG_SELECT =
  "id,organisation_name,description,sector,country,organisation_type,needs,offers,sdgs," +
  "partnership_working_style,partnership_dd_financial_model,partnership_dd_audited_accounts," +
  "partnership_dd_safeguarding_policy,partnership_dd_data_policy,partnership_dd_governance_doc";

export function useOrgActions(userId: string | null | undefined) {
  const [viewerOrg, setViewerOrg] = useState<OrgRow | null>(null);
  const [currentUserOrgId, setCurrentUserOrgId] = useState<string | null>(null);
  const [savedOrgs, setSavedOrgs] = useState<Set<string>>(new Set());
  const [sentInterests, setSentInterests] = useState<Set<string>>(new Set());
  const [sendingInterest, setSendingInterest] = useState<string | null>(null);

  useEffect(() => {
    if (userId) load();
  }, [userId]);

  async function load() {
    const [savedRes, myOrgRes, connRes] = await Promise.all([
      supabase.from("saved_organizations").select("organization_id").eq("user_id", userId!),
      supabase.from("organizations").select(VIEWER_ORG_SELECT).eq("user_id", userId!).maybeSingle(),
      supabase.from("partnership_connections").select("receiver_org_id").eq("sender_user_id", userId!),
    ]);

    if (savedRes.data) setSavedOrgs(new Set(savedRes.data.map((r: any) => r.organization_id)));
    if (myOrgRes.data) {
      setCurrentUserOrgId(myOrgRes.data.id);
      setViewerOrg(myOrgRes.data as OrgRow);
    }
    if (connRes.data && myOrgRes.data) {
      setSentInterests(new Set(connRes.data.filter((r: any) => r.receiver_org_id !== myOrgRes.data!.id).map((r: any) => r.receiver_org_id)));
    } else if (connRes.data) {
      setSentInterests(new Set(connRes.data.map((r: any) => r.receiver_org_id)));
    }
  }

  async function toggleSave(orgId: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!userId) return;
    if (savedOrgs.has(orgId)) {
      await supabase.from("saved_organizations").delete().eq("user_id", userId).eq("organization_id", orgId);
      setSavedOrgs(prev => { const n = new Set(prev); n.delete(orgId); return n; });
    } else {
      await supabase.from("saved_organizations").insert({ user_id: userId, organization_id: orgId });
      setSavedOrgs(prev => new Set(prev).add(orgId));
    }
  }

  async function expressInterest(org: OrgRow, e: React.MouseEvent) {
    e.stopPropagation();
    if (!userId || sentInterests.has(org.id) || org.partnership_formed) return;
    let senderOrgId = currentUserOrgId;
    if (!senderOrgId) {
      const { data } = await supabase.from("organizations").select("id").eq("user_id", userId).maybeSingle();
      if (!data) { alert("You need an organisation profile to express interest."); return; }
      senderOrgId = data.id; setCurrentUserOrgId(data.id);
    }
    setSendingInterest(org.id);
    try {
      const { error } = await supabase.from("partnership_connections").insert({
        sender_org_id: senderOrgId, receiver_org_id: org.id,
        sender_user_id: userId, source: "browse", status: "pending",
      });
      if (error && !error.message.includes("unique")) throw error;
      const { data: senderOrg } = await supabase.from("organizations").select("organisation_name").eq("id", senderOrgId).single();
      const { data: convId } = await supabase.rpc("create_partnership_conversation", {
        p_receiver_user_id: org.user_id,
        p_sender_org_id: senderOrgId,
        p_receiver_org_id: org.id,
      });

      const convData = convId ? { id: convId as string } : null;

      if (convData?.id) {
        await supabase.from("partnership_connections")
          .update({ conversation_id: convData.id })
          .eq("sender_org_id", senderOrgId)
          .eq("receiver_org_id", org.id)
          .select();

        await supabase.rpc("join_conversation_and_notify", {
          p_conversation_id: convData.id,
          p_notification_type: "partnership_interest",
          p_notification_title: "New partnership interest",
          p_notification_body: `${senderOrg?.organisation_name ?? "An organisation"} expressed interest in partnering with you.`,
          p_notification_link: `/dashboard/messages?conversation=${convData.id}`,
          p_notification_metadata: { sender_org_id: senderOrgId, receiver_org_id: org.id, conversation_id: convData.id },
        });
        const customMsg = (e as any).customMessage;
        await supabase.from("messages").insert({
          conversation_id: convData.id, sender_id: userId,
          body: customMsg || `Hi ${org.organisation_name}, I came across your partnership listing on Impact Natives and I'm interested in exploring a potential collaboration.${org.partnership_sought ? ` I see you're looking for: ${org.partnership_sought}` : ""}\n\nWould you be open to a conversation?`,
        });
      }
      setSentInterests(prev => new Set(prev).add(org.id));
    } catch (err) { console.error("Express interest error:", err); }
    finally { setSendingInterest(null); }
  }

  return {
    viewerOrg,
    currentUserOrgId,
    savedOrgs,
    sentInterests,
    sendingInterest,
    toggleSave,
    expressInterest,
    reload: load,
  };
}
