// src/lib/portfolioData.ts
//
// Stage 2 of the Portfolio unified tracker: merges three separate data
// sources -- the user's own initiative listings, expressions_of_interest
// (initiative-side relationships, both sent and received), and
// partnership_connections (org-to-org relationships, both directions,
// plus the user's own partnership listing) -- into one normalized row
// shape a spreadsheet-style table can render directly.
//
// KNOWN LIMITATIONS (flagged, not hidden):
// 1. initiative_requests has no updated_at column, so "Mine" initiative
//    rows carry a static creation date, not a live one. Every other row
//    type's date IS live (Partnership rows via partnership_connections'
//    existing updated_at trigger from PartnershipTab.tsx; Initiative
//    Outbound/Inbound rows via conversations.updated_at, added in the
//    Aug 2026 migration).
// 2. "Support Type" pulls from two different vocabularies depending on
//    row Type -- expressions_of_interest.partnership_type uses one
//    enumeration (funding/technical/operational/...), partnership_
//    connections.partnership_type uses another (Co-funder/Implementing
//    partner/...). Both are passed through as-is rather than forced into
//    a fake unified vocabulary that would match neither source.

import { supabase } from "@/lib/supabase";

export type PortfolioRowType = "Initiative" | "Partnership";
export type PortfolioDirection = "Mine" | "Outbound" | "Inbound";

export interface PortfolioRow {
  id: string;
  title: string;
  titleHref: string | null;
  organisation: string;
  organisationHref: string | null;
  type: PortfolioRowType;
  supportType: string | null;
  direction: PortfolioDirection;
  eoiCount: number | null;
  contactEmail: string | null;
  contactPhone: string | null;
  status: string;
  date: string;
  raw:
    | { kind: "initiative_mine"; initiativeId: string }
    | { kind: "initiative_eoi"; initiativeId: string; eoiId: string; conversationId: string | null }
    | { kind: "partnership_connection"; connectionId: string; orgId: string | null }
    | { kind: "partnership_listing"; orgId: string };
}

// ── Label maps ──────────────────────────────────────────────────────────

const INITIATIVE_STATUS_MAP: Record<string, string> = {
  draft: "Draft",
  pending: "Pending review",
  published: "Listed",
  rejected: "Not approved",
  closed: "Closed",
};

// Mirrors InterestsExpressedTab's existing status derivation exactly, so
// the tracker doesn't introduce a second, inconsistent vocabulary for the
// same underlying conversation states.
function deriveEoiStatus(conversationStatus: string | null | undefined): string {
  if (conversationStatus === "confirmed") return "Partner confirmed";
  if (conversationStatus === "open") return "In conversation";
  if (conversationStatus === "declined" || conversationStatus === "rejected") return "Declined";
  return "Interest expressed";
}

const PARTNERSHIP_STATUS_MAP: Record<string, string> = {
  pending: "Pending",
  accepted: "Accepted",
  declined: "Declined",
  formed: "Partnership formed",
  pending_confirmation: "Awaiting confirmation",
};

// expressions_of_interest.partnership_type values -> display label
const EOI_SUPPORT_TYPE_LABELS: Record<string, string> = {
  funding: "Funding",
  technical: "Technical",
  operational: "Operational",
  leadership: "Leadership",
  strategic: "Strategic",
  lead: "Project Lead",
  other: "Other",
};

function normalizeArr(val: string[] | null | undefined): string[] {
  return Array.isArray(val) ? val : [];
}

// Title always uses the counterpart org's "Seeking" statement first --
// that's the substantive pitch the row is actually about. Falls through
// to an explicit connection-level title, then to their listed needs,
// then to a fixed literal so no row is ever titleless.
function resolvePartnershipTitle(
  counterpartOrg: { partnership_sought?: string | null; needs?: string[] | null } | undefined,
  explicitConnectionTitle: string | null | undefined
): string {
  if (counterpartOrg?.partnership_sought) return counterpartOrg.partnership_sought;
  if (explicitConnectionTitle) return explicitConnectionTitle;
  const needs = normalizeArr(counterpartOrg?.needs);
  if (needs.length > 0) return needs.join(", ");
  return "Partnership inquiry";
}

// ── Main fetch ──────────────────────────────────────────────────────────

export async function fetchPortfolioRows(userId: string): Promise<PortfolioRow[]> {
  const rows: PortfolioRow[] = [];

  const { data: myOrg } = await supabase
    .from("organizations")
    .select("id, organisation_name, partnership_sought, partnership_title, partnership_listed, partnership_formed, needs, email, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  const myOrgName = myOrg?.organisation_name ?? "You";
  const myProfileHref = "/dashboard/profile";

  // ── 1. My own initiative listings ──────────────────────────────────────
  const { data: myInitiatives } = await supabase
    .from("initiative_requests")
    .select("id, title, status, eois, created_at")
    .eq("user_id", userId)
    .not("status", "eq", "draft");

  for (const ini of myInitiatives ?? []) {
    rows.push({
      id: `ini-mine-${ini.id}`,
      title: ini.title,
      titleHref: `/dashboard/portfolio/${ini.id}`,
      organisation: myOrgName,
      organisationHref: myProfileHref,
      type: "Initiative",
      supportType: null,
      direction: "Mine",
      eoiCount: ini.eois ?? 0,
      contactEmail: null,
      contactPhone: null,
      status: INITIATIVE_STATUS_MAP[ini.status] ?? ini.status,
      date: ini.created_at,
      raw: { kind: "initiative_mine", initiativeId: ini.id },
    });
  }

  // ── 2. Outbound EOIs -- interest I expressed in others' initiatives ────
  const { data: myEois } = await supabase
    .from("expressions_of_interest")
    .select("id, initiative_id, partnership_type, created_at, conversation_id")
    .eq("user_id", userId);

  if (myEois?.length) {
    const initIds = [...new Set(myEois.map(e => e.initiative_id))];
    const { data: inits } = await supabase
      .from("initiative_requests")
      .select("id, title, user_id")
      .in("id", initIds);
    const initMap = new Map((inits ?? []).map(i => [i.id, i]));

    const ownerUserIds = [...new Set((inits ?? []).map(i => i.user_id).filter(Boolean))];
    const { data: ownerOrgs } = ownerUserIds.length
      ? await supabase.from("organizations").select("id, user_id, organisation_name, email").in("user_id", ownerUserIds)
      : { data: [] };
    const ownerOrgMap = new Map((ownerOrgs ?? []).map(o => [o.user_id, o]));

    const convIds = myEois.map(e => e.conversation_id).filter((v): v is string => Boolean(v));
    const { data: convs } = convIds.length
      ? await supabase.from("conversations").select("id, status, updated_at").in("id", convIds)
      : { data: [] };
    const convMap = new Map((convs ?? []).map(c => [c.id, c]));

    for (const eoi of myEois) {
      const ini = initMap.get(eoi.initiative_id);
      const ownerOrg = ini ? ownerOrgMap.get(ini.user_id) : undefined;
      const conv = eoi.conversation_id ? convMap.get(eoi.conversation_id) : undefined;
      const status = deriveEoiStatus(conv?.status);
      rows.push({
        id: `ini-eoi-out-${eoi.id}`,
        title: ini?.title ?? "Initiative",
        titleHref: ini ? `/dashboard/marketplace?initiative=${ini.id}` : null,
        organisation: ownerOrg?.organisation_name ?? "Unknown",
        organisationHref: ini ? `/dashboard/natives?tab=organisation&user=${ini.user_id}` : null,
        type: "Initiative",
        supportType: eoi.partnership_type ? (EOI_SUPPORT_TYPE_LABELS[eoi.partnership_type] ?? eoi.partnership_type) : null,
        direction: "Outbound",
        eoiCount: null,
        contactEmail: status === "Partner confirmed" ? ownerOrg?.email ?? null : null,
        contactPhone: null,
        status,
        date: conv?.updated_at ?? eoi.created_at,
        raw: { kind: "initiative_eoi", initiativeId: eoi.initiative_id, eoiId: eoi.id, conversationId: eoi.conversation_id },
      });
    }
  }

  // ── 3. Inbound EOIs -- others' interest in MY initiatives ──────────────
  if (myInitiatives?.length) {
    const myInitIds = myInitiatives.map(i => i.id);
    const { data: inboundEois } = await supabase
      .from("expressions_of_interest")
      .select("id, initiative_id, user_id, partnership_type, created_at, conversation_id")
      .in("initiative_id", myInitIds);

    if (inboundEois?.length) {
      const expresserUserIds = [...new Set(inboundEois.map(e => e.user_id))];
      const { data: expresserOrgs } = await supabase
        .from("organizations")
        .select("id, user_id, organisation_name, email")
        .in("user_id", expresserUserIds);
      const expresserOrgMap = new Map((expresserOrgs ?? []).map(o => [o.user_id, o]));

      const { data: expresserProfiles } = await supabase
        .from("profiles")
        .select("id, email, phone")
        .in("id", expresserUserIds);
      const expresserProfileMap = new Map((expresserProfiles ?? []).map(p => [p.id, p]));

      const initMap = new Map(myInitiatives.map(i => [i.id, i]));

      const convIds2 = inboundEois.map(e => e.conversation_id).filter((v): v is string => Boolean(v));
      const { data: convs2 } = convIds2.length
        ? await supabase.from("conversations").select("id, status, updated_at").in("id", convIds2)
        : { data: [] };
      const convMap2 = new Map((convs2 ?? []).map(c => [c.id, c]));

      for (const eoi of inboundEois) {
        const ini = initMap.get(eoi.initiative_id);
        const org = expresserOrgMap.get(eoi.user_id);
        const profile = expresserProfileMap.get(eoi.user_id);
        const conv = eoi.conversation_id ? convMap2.get(eoi.conversation_id) : undefined;
        const status = deriveEoiStatus(conv?.status);
        rows.push({
          id: `ini-eoi-in-${eoi.id}`,
          title: ini?.title ?? "Initiative",
          titleHref: ini ? `/dashboard/portfolio/${ini.id}` : null,
          organisation: org?.organisation_name ?? "Unknown",
          organisationHref: `/dashboard/natives?tab=organisation&user=${eoi.user_id}`,
          type: "Initiative",
          supportType: eoi.partnership_type ? (EOI_SUPPORT_TYPE_LABELS[eoi.partnership_type] ?? eoi.partnership_type) : null,
          direction: "Inbound",
          eoiCount: null,
          contactEmail: status === "Partner confirmed" ? (profile?.email ?? org?.email ?? null) : null,
          contactPhone: status === "Partner confirmed" ? (profile?.phone ?? null) : null,
          status,
          date: conv?.updated_at ?? eoi.created_at,
          raw: { kind: "initiative_eoi", initiativeId: eoi.initiative_id, eoiId: eoi.id, conversationId: eoi.conversation_id },
        });
      }
    }
  }

  // ── 4. Partnership connections, both directions ─────────────────────────
  if (myOrg?.id) {
    const [{ data: sent }, { data: received }] = await Promise.all([
      supabase.from("partnership_connections")
        .select("id, receiver_org_id, status, partnership_type, partnership_title, created_at, updated_at")
        .eq("sender_org_id", myOrg.id),
      supabase.from("partnership_connections")
        .select("id, sender_org_id, status, partnership_type, partnership_title, created_at, updated_at")
        .eq("receiver_org_id", myOrg.id),
    ]);

    const counterpartIds = [
      ...(sent ?? []).map((c: any) => c.receiver_org_id),
      ...(received ?? []).map((c: any) => c.sender_org_id),
    ];
    const { data: counterpartOrgs } = counterpartIds.length
      ? await supabase.from("organizations")
          .select("id, organisation_name, partnership_sought, needs, email")
          .in("id", [...new Set(counterpartIds)])
      : { data: [] };
    const counterpartMap = new Map((counterpartOrgs ?? []).map(o => [o.id, o]));

    for (const conn of sent ?? []) {
      const counterpart = counterpartMap.get(conn.receiver_org_id);
      const status = PARTNERSHIP_STATUS_MAP[conn.status] ?? conn.status;
      rows.push({
        id: `partner-out-${conn.id}`,
        title: resolvePartnershipTitle(counterpart, conn.partnership_title),
        titleHref: counterpart ? `/dashboard/partnerships?org=${counterpart.id}` : null,
        organisation: counterpart?.organisation_name ?? "Unknown",
        organisationHref: counterpart ? `/dashboard/partnerships?org=${counterpart.id}` : null,
        type: "Partnership",
        supportType: conn.partnership_type ?? null,
        direction: "Outbound",
        eoiCount: null,
        contactEmail: status === "Partnership formed" ? counterpart?.email ?? null : null,
        contactPhone: null,
        status,
        date: conn.updated_at,
        raw: { kind: "partnership_connection", connectionId: conn.id, orgId: counterpart?.id ?? null },
      });
    }

    for (const conn of received ?? []) {
      const counterpart = counterpartMap.get(conn.sender_org_id);
      const status = PARTNERSHIP_STATUS_MAP[conn.status] ?? conn.status;
      rows.push({
        id: `partner-in-${conn.id}`,
        title: resolvePartnershipTitle(counterpart, conn.partnership_title),
        titleHref: counterpart ? `/dashboard/partnerships?org=${counterpart.id}` : null,
        organisation: counterpart?.organisation_name ?? "Unknown",
        organisationHref: counterpart ? `/dashboard/partnerships?org=${counterpart.id}` : null,
        type: "Partnership",
        supportType: conn.partnership_type ?? null,
        direction: "Inbound",
        eoiCount: null,
        contactEmail: status === "Partnership formed" ? counterpart?.email ?? null : null,
        contactPhone: null,
        status,
        date: conn.updated_at,
        raw: { kind: "partnership_connection", connectionId: conn.id, orgId: counterpart?.id ?? null },
      });
    }

    // ── 5. My own partnership listing ("Mine") ─────────────────────────────
    if (myOrg.partnership_listed || myOrg.partnership_sought) {
      const pendingInboundCount = (received ?? []).filter((c: any) => c.status === "pending").length;
      rows.push({
        id: `partner-mine-${myOrg.id}`,
        title: resolvePartnershipTitle(myOrg, myOrg.partnership_title),
        titleHref: "/dashboard/portfolio?tab=partnerships&view=requested",
        organisation: myOrgName,
        organisationHref: myProfileHref,
        type: "Partnership",
        supportType: null,
        direction: "Mine",
        eoiCount: pendingInboundCount,
        contactEmail: null,
        contactPhone: null,
        status: myOrg.partnership_formed ? "Partnership formed" : myOrg.partnership_listed ? "Listed" : "Unlisted",
        date: myOrg.updated_at,
        raw: { kind: "partnership_listing", orgId: myOrg.id },
      });
    }
  }

  return rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}