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

export function useOrgActions(orgOwnerId: string | null | undefined, actorUserId: string | null | undefined) {
  const [viewerOrg, setViewerOrg] = useState<OrgRow | null>(null);
  const [viewerOrgLoading, setViewerOrgLoading] = useState(true);
  const [currentUserOrgId, setCurrentUserOrgId] = useState<string | null>(null);
  const [savedOrgs, setSavedOrgs] = useState<Set<string>>(new Set());
  const [sentInterests, setSentInterests] = useState<Set<string>>(new Set());
  const [sendingInterest, setSendingInterest] = useState<string | null>(null);

  useEffect(() => {
    if (orgOwnerId) load();
  }, [orgOwnerId, actorUserId]);

  async function load() {
    // saved_organizations is personal-per-person (same as saved_initiatives),
    // so it's keyed by actorUserId. organizations lookup is the acting org's
    // identity, keyed by orgOwnerId. sentInterests dedup stays scoped to
    // sender_user_id (actorUserId) -- unchanged design, just fixed to read
    // the correct identity instead of the org lookup's identity.
    const [savedRes, myOrgRes, connRes] = await Promise.all([
      supabase.from("saved_organizations").select("organization_id").eq("user_id", actorUserId!),
      supabase.from("organizations").select(VIEWER_ORG_SELECT).eq("user_id", orgOwnerId!).maybeSingle(),
      supabase.from("partnership_connections").select("receiver_org_id").eq("sender_user_id", actorUserId!),
    ]);

    // The supabase client isn't bound to generated Database types (see
    // lib/supabase.ts), so a non-literal select string like
    // VIEWER_ORG_SELECT resolves to postgrest-js's GenericStringError
    // fallback instead of a real row shape. Cast once through unknown
    // (TS's own suggested escape hatch) right here, so every access
    // below works off one correctly-typed value instead of each site
    // needing its own unsafe cast.
    const myOrg = myOrgRes.data as unknown as OrgRow | null;

    if (savedRes.data) setSavedOrgs(new Set(savedRes.data.map((r: any) => r.organization_id)));
    if (myOrg) {
      setCurrentUserOrgId(myOrg.id);
      setViewerOrg(myOrg);
    }
    if (connRes.data) {
      const myOrgId = myOrg?.id;
      setSentInterests(new Set(connRes.data.filter((r: any) => r.receiver_org_id !== myOrgId).map((r: any) => r.receiver_org_id)));
    }
    setViewerOrgLoading(false);
  }
  async function toggleSave(orgId: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!actorUserId) return;
    if (savedOrgs.has(orgId)) {
      await supabase.from("saved_organizations").delete().eq("user_id", actorUserId).eq("organization_id", orgId);
      setSavedOrgs(prev => { const n = new Set(prev); n.delete(orgId); return n; });
    } else {
      await supabase.from("saved_organizations").insert({ user_id: actorUserId, organization_id: orgId });
      setSavedOrgs(prev => new Set(prev).add(orgId));
    }
  }

  async function expressInterest(org: OrgRow, e: React.MouseEvent) {
    e.stopPropagation();
    if (!orgOwnerId || !actorUserId || sentInterests.has(org.id) || org.partnership_formed) return;
    let senderOrgId = currentUserOrgId;
    if (!senderOrgId) {
      const { data } = await supabase.from("organizations").select("id").eq("user_id", orgOwnerId).maybeSingle();
      if (!data) { alert("You need an organisation profile to express interest."); return; }
      senderOrgId = data.id; setCurrentUserOrgId(data.id);
    }
    if (senderOrgId === org.id) return;
    setSendingInterest(org.id);
    try {
      // sender_user_id is real-person authorship (who actually clicked
      // this), not org identity -- stays actorUserId even though the
      // connection itself is between sender_org_id and receiver_org_id.
      const { error } = await supabase.from("partnership_connections").insert({        sender_org_id: senderOrgId, receiver_org_id: org.id,
        sender_user_id: actorUserId, source: "browse", status: "pending",
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
          conversation_id: convData.id, sender_id: actorUserId,
          body: customMsg || `Hi ${org.organisation_name}, I came across your partnership listing on Impact Natives and I'm interested in exploring a potential collaboration.${org.partnership_sought ? ` I see you're looking for: ${org.partnership_sought}` : ""}\n\nWould you be open to a conversation?`,
        });
      }
      setSentInterests(prev => new Set(prev).add(org.id));
    } catch (err) { console.error("Express interest error:", err); }
    finally { setSendingInterest(null); }
  }

  return {
    viewerOrg,
    viewerOrgLoading,
    currentUserOrgId,
    savedOrgs,
    sentInterests,
    sendingInterest,
    toggleSave,
    expressInterest,
    reload: load,
  };
}
