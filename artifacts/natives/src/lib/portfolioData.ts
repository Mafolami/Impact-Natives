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

export interface PortfolioOutcome {
  id: string;
  status: "not_started" | "in_progress" | "completed" | "stalled" | "fell_through";
  funding_disbursed: boolean | null;
  funding_amount: number | null;
  funding_currency: string | null;
  started_at: string | null;
  completed_at: string | null;
  stalled_at: string | null;
  fell_through_at: string | null;
  outcome_summary: string | null;
}

export interface PortfolioTimelineStage {
  label: string;
  date: string;
}

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
  outcome: PortfolioOutcome | null;
  timeline: PortfolioTimelineStage[];
  raw:
    | { kind: "initiative_mine"; initiativeId: string }
    // partnerUserId: org identity (organizations.user_id) -- used only for
    // MoU creation (newForUserId), Inbound-gated in mouHrefFor. Do not use
    // for outcome-tracking or confirmed_partners matching.
    // partnerActorUserId: the real conversation participant on the
    // expressing side -- used for the outcome-tracking join key and
    // mouExecutedFor, consistently on both directions so the same
    // underlying relationship resolves to the same partnership_outcomes
    // row regardless of which side is viewing/recording it. Null when the
    // real submitter isn't known (legacy EOI rows predating
    // submitted_by_user_id).
    | { kind: "initiative_eoi"; initiativeId: string; eoiId: string; conversationId: string | null; partnerUserId: string; partnerActorUserId: string | null }
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
function mouExecutedFor(confirmedPartners: any[] | null | undefined, userId: string): boolean {
  return (confirmedPartners ?? []).some((p: any) => p.user_id === userId && p.status === "mou_executed");
}

function deriveEoiStatus(conversationStatus: string | null | undefined): string {  if (conversationStatus === "confirmed") return "Partner confirmed";
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

const OUTCOME_STAGE_LABELS: Record<string, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Completed",
  stalled: "Stalled",
  fell_through: "Fell through",
};

function buildConnectionTimeline(conn: {
  created_at: string;
  accepted_at?: string | null;
  formed_at?: string | null;
  declined_at?: string | null;
}): PortfolioTimelineStage[] {
  const stages: PortfolioTimelineStage[] = [{ label: "Created", date: conn.created_at }];
  if (conn.accepted_at) stages.push({ label: "Accepted", date: conn.accepted_at });
  if (conn.formed_at) stages.push({ label: "Formed", date: conn.formed_at });
  if (conn.declined_at) stages.push({ label: "Declined", date: conn.declined_at });
  return stages;
}

// ── Main fetch ──────────────────────────────────────────────────────────

// ── Outcome upsert ──────────────────────────────────────────────────────

export interface PortfolioOutcomeHistoryEntry {
  id: string;
  status: string;
  outcome_summary: string | null;
  recorded_at: string;
}

export async function upsertPartnershipOutcome(params: {
  existingId: string | null;
  relationshipType: "initiative_partner" | "org_partnership";
  initiativeId?: string | null;
  partnerUserId?: string | null;
  connectionId?: string | null;
  status: PortfolioOutcome["status"];
  fundingDisbursed: boolean | null;
  fundingAmount: number | null;
  fundingCurrency: string | null;
  startedAt: string | null;
  completedAt: string | null;
  stalledAt: string | null;
  fellThroughAt: string | null;
  outcomeSummary: string | null;
  reportedByUserId: string;
}): Promise<void> {
  const payload = {
    relationship_type: params.relationshipType,
    initiative_id: params.initiativeId ?? null,
    partner_user_id: params.partnerUserId ?? null,
    connection_id: params.connectionId ?? null,
    status: params.status,
    funding_disbursed: params.fundingDisbursed,
    funding_amount: params.fundingAmount,
    funding_currency: params.fundingCurrency,
    started_at: params.startedAt,
    completed_at: params.completedAt,
    stalled_at: params.stalledAt,
    fell_through_at: params.fellThroughAt,
    outcome_summary: params.outcomeSummary,
    reported_by_user_id: params.reportedByUserId,
  };

  let outcomeId = params.existingId;

  if (params.existingId) {
    await supabase.from("partnership_outcomes").update(payload).eq("id", params.existingId);
  } else {
    const { data } = await supabase.from("partnership_outcomes").insert(payload).select("id").single();
    outcomeId = data?.id ?? null;
  }

  // Every save -- not just the first -- writes a new history entry, so
  // the note trail accumulates one Status/Date/What-happened record per
  // update instead of the current-state row silently overwriting itself.
  if (outcomeId) {
    await supabase.from("partnership_outcome_history").insert({
      outcome_id: outcomeId,
      status: params.status,
      outcome_summary: params.outcomeSummary,
      reported_by_user_id: params.reportedByUserId,
    });
  }
}

export async function fetchOutcomeHistory(outcomeId: string): Promise<PortfolioOutcomeHistoryEntry[]> {
  const { data } = await supabase
    .from("partnership_outcome_history")
    .select("id, status, outcome_summary, recorded_at")
    .eq("outcome_id", outcomeId)
    .order("recorded_at", { ascending: false });
  return data ?? [];
}

// orgOwnerId drives every org-scoped lookup (organizations, initiative_requests,
// expressions_of_interest -- the latter stores orgOwnerId as its user_id since
// EOI is org-level, one per org). actorUserId is the real signed-in person,
// needed only where the join key is a real person rather than an org: matching
// into confirmed_partners[].user_id (set from conversation.other_user_id when
// a partner is proposed in DashboardMessages.tsx, not an org id) and the
// corresponding partnership_outcomes.partner_user_id join.
export async function fetchPortfolioRows(orgOwnerId: string, actorUserId: string): Promise<PortfolioRow[]> {
  const rows: PortfolioRow[] = [];

  // myOrg, myInitiatives, and myEois are independent of each other -- each
  // only needs orgOwnerId, not any other query's result -- so they now run
  // concurrently instead of strictly sequentially. This was the main cause
  // of slow loads: several genuinely independent query chains were running
  // one after another with no real data dependency forcing that order.
  const [{ data: myOrg }, { data: myInitiatives }, { data: myEois }] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, organisation_name, partnership_sought, partnership_title, partnership_listed, partnership_formed, needs, email, updated_at")
      .eq("user_id", orgOwnerId)
      .maybeSingle(),
    supabase
      .from("initiative_requests")
      .select("id, title, status, eois, created_at, confirmed_partners")
      .eq("user_id", orgOwnerId)
      .not("status", "eq", "draft"),
    supabase
      .from("expressions_of_interest")
      .select("id, initiative_id, partnership_type, created_at, conversation_id")
      .eq("user_id", orgOwnerId),
  ]);

  const myOrgName = myOrg?.organisation_name ?? "You";
  const myProfileHref = `/dashboard/natives?tab=organisation&user=${orgOwnerId}`;

  // ── 1. My own initiative listings ──────────────────────────────────────
  for (const ini of myInitiatives ?? []) {
    rows.push({
      id: `ini-mine-${ini.id}`,
      title: ini.title,
      titleHref: `/dashboard/portfolio/exchanges/${ini.id}`,
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
      outcome: null,
      timeline: [{ label: "Created", date: ini.created_at }],
      raw: { kind: "initiative_mine", initiativeId: ini.id },
    });
  }

  // The three blocks below each depend on exactly one of the three fetches
  // above (myEois / myInitiatives / myOrg) but not on each other, so they
  // now run concurrently as well. Internal logic within each block is
  // unchanged -- only the top-level control flow moved from sequential
  // awaits to concurrent closures.

  // ── 2. Outbound EOIs -- interest I expressed in others' initiatives ────
  async function loadOutboundEoiDetail() {
    if (!myEois?.length) return;
    const initIds = [...new Set(myEois.map(e => e.initiative_id))];
    const { data: inits } = await supabase
      .from("initiative_requests")
      .select("id, title, user_id, confirmed_partners")
      .in("id", initIds);    const initMap = new Map((inits ?? []).map(i => [i.id, i]));

    const ownerUserIds = [...new Set((inits ?? []).map(i => i.user_id).filter(Boolean))];
    const { data: ownerOrgs } = ownerUserIds.length
      ? await supabase.from("organizations").select("id, user_id, organisation_name, email").in("user_id", ownerUserIds)
      : { data: [] };
    const ownerOrgMap = new Map((ownerOrgs ?? []).map(o => [o.user_id, o]));

    const convIds = myEois.map(e => e.conversation_id).filter((v): v is string => Boolean(v));
    const { data: convs } = convIds.length
      ? await supabase.from("conversations").select("id, status, updated_at, opened_at, confirmed_at").in("id", convIds)
      : { data: [] };
    const convMap = new Map((convs ?? []).map(c => [c.id, c]));

    for (const eoi of myEois) {
      const ini = initMap.get(eoi.initiative_id);
      const ownerOrg = ini ? ownerOrgMap.get(ini.user_id) : undefined;
      const conv = eoi.conversation_id ? convMap.get(eoi.conversation_id) : undefined;
      const status = mouExecutedFor(ini?.confirmed_partners, actorUserId) ? "MoU Executed" : deriveEoiStatus(conv?.status);
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
        contactEmail: (status === "Partner confirmed" || status === "MoU Executed") ? ownerOrg?.email ?? null : null,
        contactPhone: null,
        status,
        date: conv?.updated_at ?? eoi.created_at,
        outcome: null,
        timeline: [
          { label: "Interest expressed", date: eoi.created_at },
          ...(conv?.opened_at ? [{ label: "In conversation", date: conv.opened_at }] : []),
          ...(conv?.confirmed_at ? [{ label: "Confirmed", date: conv.confirmed_at }] : []),
        ],
        raw: { kind: "initiative_eoi", initiativeId: eoi.initiative_id, eoiId: eoi.id, conversationId: eoi.conversation_id, partnerUserId: ini?.user_id ?? actorUserId, partnerActorUserId: actorUserId },
      });
    }
  }

  // ── 3. Inbound EOIs -- others' interest in MY initiatives ──────────────
  async function loadInboundEois() {
    if (!myInitiatives?.length) return;
    const myInitIds = myInitiatives.map(i => i.id);
    const { data: inboundEois } = await supabase
      .from("expressions_of_interest")
      .select("id, initiative_id, user_id, submitted_by_user_id, partnership_type, created_at, conversation_id")
      .in("initiative_id", myInitIds);

    if (!inboundEois?.length) return;

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
      ? await supabase.from("conversations").select("id, status, updated_at, opened_at, confirmed_at").in("id", convIds2)
      : { data: [] };
    const convMap2 = new Map((convs2 ?? []).map(c => [c.id, c]));

    for (const eoi of inboundEois) {
      const ini = initMap.get(eoi.initiative_id);
      const org = expresserOrgMap.get(eoi.user_id);
      const profile = expresserProfileMap.get(eoi.user_id);
      const conv = eoi.conversation_id ? convMap2.get(eoi.conversation_id) : undefined;
      const status = mouExecutedFor(ini?.confirmed_partners, eoi.submitted_by_user_id ?? eoi.user_id) ? "MoU Executed" : deriveEoiStatus(conv?.status);
      rows.push({
        id: `ini-eoi-in-${eoi.id}`,
        title: ini?.title ?? "Initiative",
        titleHref: ini ? `/dashboard/portfolio/exchanges/${ini.id}` : null,
        organisation: org?.organisation_name ?? "Unknown",
        organisationHref: `/dashboard/natives?tab=organisation&user=${eoi.user_id}`,
        type: "Initiative",
        supportType: eoi.partnership_type ? (EOI_SUPPORT_TYPE_LABELS[eoi.partnership_type] ?? eoi.partnership_type) : null,
        direction: "Inbound",
        eoiCount: null,
        contactEmail: (status === "Partner confirmed" || status === "MoU Executed") ? (profile?.email ?? org?.email ?? null) : null,
        contactPhone: (status === "Partner confirmed" || status === "MoU Executed") ? (profile?.phone ?? null) : null,
        status,
        date: conv?.updated_at ?? eoi.created_at,
        outcome: null,
        timeline: [
          { label: "Interest expressed", date: eoi.created_at },
          ...(conv?.opened_at ? [{ label: "In conversation", date: conv.opened_at }] : []),
          ...(conv?.confirmed_at ? [{ label: "Confirmed", date: conv.confirmed_at }] : []),
        ],
        raw: { kind: "initiative_eoi", initiativeId: eoi.initiative_id, eoiId: eoi.id, conversationId: eoi.conversation_id, partnerUserId: eoi.user_id, partnerActorUserId: eoi.submitted_by_user_id ?? null },
      });
    }
  }

  // ── 4. Partnership connections, both directions, + 5. my own listing ───
  async function loadPartnershipConnections() {
    if (!myOrg?.id) return;
    const [{ data: sent }, { data: received }] = await Promise.all([
      supabase.from("partnership_connections")
        .select("id, receiver_org_id, status, partnership_type, partnership_title, created_at, updated_at, accepted_at, formed_at, declined_at, mou_executed_at")
        .eq("sender_org_id", myOrg.id),
      supabase.from("partnership_connections")
        .select("id, sender_org_id, status, partnership_type, partnership_title, created_at, updated_at, accepted_at, formed_at, declined_at, mou_executed_at")
        .eq("receiver_org_id", myOrg.id),
    ]);

    const counterpartIds = [
      ...(sent ?? []).map((c: any) => c.receiver_org_id),
      ...(received ?? []).map((c: any) => c.sender_org_id),
    ];
    const { data: counterpartOrgs } = counterpartIds.length
      ? await supabase.from("organizations")
          .select("id, user_id, organisation_name, partnership_sought, needs, email")
          .in("id", [...new Set(counterpartIds)])
      : { data: [] };
    const counterpartMap = new Map((counterpartOrgs ?? []).map(o => [o.id, o]));

    for (const conn of sent ?? []) {
      const counterpart = counterpartMap.get(conn.receiver_org_id);
      const status = conn.mou_executed_at ? "MoU Executed" : (PARTNERSHIP_STATUS_MAP[conn.status] ?? conn.status);
      rows.push({
        id: `partner-out-${conn.id}`,
        title: resolvePartnershipTitle(counterpart, conn.partnership_title),
        titleHref: counterpart ? `/dashboard/portfolio/exchanges/partner/${counterpart.id}` : null,
        organisation: counterpart?.organisation_name ?? "Unknown",
        organisationHref: counterpart?.user_id ? `/dashboard/natives?tab=organisation&user=${counterpart.user_id}` : null,
        type: "Partnership",
        supportType: conn.partnership_type ?? null,
        direction: "Outbound",
        eoiCount: null,
        contactEmail: (status === "Partnership formed" || status === "MoU Executed") ? counterpart?.email ?? null : null,
        contactPhone: null,
        status,
        date: conn.updated_at,
        outcome: null,
        timeline: buildConnectionTimeline(conn),
        raw: { kind: "partnership_connection", connectionId: conn.id, orgId: counterpart?.id ?? null },
      });
    }

    for (const conn of received ?? []) {
      const counterpart = counterpartMap.get(conn.sender_org_id);
      const status = conn.mou_executed_at ? "MoU Executed" : (PARTNERSHIP_STATUS_MAP[conn.status] ?? conn.status);
      const title = myOrg.partnership_sought
        ? resolvePartnershipTitle(myOrg, myOrg.partnership_title)
        : resolvePartnershipTitle(counterpart, conn.partnership_title);
      rows.push({
        id: `partner-in-${conn.id}`,
        title,
        titleHref: counterpart ? `/dashboard/portfolio/exchanges/partner/${counterpart.id}` : null,
        organisation: counterpart?.organisation_name ?? "Unknown",
        organisationHref: counterpart?.user_id ? `/dashboard/natives?tab=organisation&user=${counterpart.user_id}` : null,
        type: "Partnership",
        supportType: conn.partnership_type ?? null,
        direction: "Inbound",
        eoiCount: null,
        contactEmail: (status === "Partnership formed" || status === "MoU Executed") ? counterpart?.email ?? null : null,
        contactPhone: null,
        status,
        date: conn.updated_at,
        outcome: null,
        timeline: buildConnectionTimeline(conn),
        raw: { kind: "partnership_connection", connectionId: conn.id, orgId: counterpart?.id ?? null },
      });
    }

    // ── 5. My own partnership listing ("Mine") ─────────────────────────────
    if (myOrg.partnership_listed || myOrg.partnership_sought) {
      const pendingInboundCount = (received ?? []).filter((c: any) => c.status === "pending").length;
      rows.push({
        id: `partner-mine-${myOrg.id}`,
        title: resolvePartnershipTitle(myOrg, myOrg.partnership_title),
        titleHref: `/dashboard/portfolio/exchanges/partner/${myOrg.id}`,
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
        outcome: null,
        timeline: [{ label: "Listed", date: myOrg.updated_at }],
        raw: { kind: "partnership_listing", orgId: myOrg.id },
      });
    }
  }

  await Promise.all([loadOutboundEoiDetail(), loadInboundEois(), loadPartnershipConnections()]);

  // ── 6. Attach outcome tracking to confirmed/formed relationships only ──
  const initiativeOutcomeKeys = rows.filter(
    r => r.raw.kind === "initiative_eoi" && r.status === "Partner confirmed"
  ) as (PortfolioRow & { raw: { kind: "initiative_eoi"; initiativeId: string; partnerActorUserId: string | null } })[];
  const connectionOutcomeRows = rows.filter(
    r => r.raw.kind === "partnership_connection" && r.status === "Partnership formed"
  ) as (PortfolioRow & { raw: { kind: "partnership_connection"; connectionId: string } })[];

  if (initiativeOutcomeKeys.length > 0 || connectionOutcomeRows.length > 0) {
    const initIds = [...new Set(initiativeOutcomeKeys.map(r => r.raw.initiativeId))];
    const connIds = [...new Set(connectionOutcomeRows.map(r => r.raw.connectionId))];

    const [{ data: initOutcomes }, { data: connOutcomes }] = await Promise.all([
      initIds.length
        ? supabase.from("partnership_outcomes")
            .select("id, initiative_id, partner_user_id, status, funding_disbursed, funding_amount, funding_currency, started_at, completed_at, stalled_at, fell_through_at, outcome_summary, updated_at")
            .eq("relationship_type", "initiative_partner")
            .in("initiative_id", initIds)
        : Promise.resolve({ data: [] }),
      connIds.length
        ? supabase.from("partnership_outcomes")
            .select("id, connection_id, status, funding_disbursed, funding_amount, funding_currency, started_at, completed_at, stalled_at, fell_through_at, outcome_summary, updated_at")
            .eq("relationship_type", "org_partnership")
            .in("connection_id", connIds)
        : Promise.resolve({ data: [] }),
    ]);

    const initOutcomeMap = new Map(
      (initOutcomes ?? []).map((o: any) => [`${o.initiative_id}:${o.partner_user_id}`, o])
    );
    const connOutcomeMap = new Map((connOutcomes ?? []).map((o: any) => [o.connection_id, o]));

    for (const row of initiativeOutcomeKeys) {
      if (!row.raw.partnerActorUserId) continue;
      const key = `${row.raw.initiativeId}:${row.raw.partnerActorUserId}`;
      const outcome = initOutcomeMap.get(key) ?? null;
      row.outcome = outcome;
      if (outcome?.updated_at) {
        if (new Date(outcome.updated_at) > new Date(row.date)) row.date = outcome.updated_at;
        row.timeline = [...row.timeline, { label: `Outcome: ${OUTCOME_STAGE_LABELS[outcome.status] ?? outcome.status}`, date: outcome.updated_at }];
      }
    }
    for (const row of connectionOutcomeRows) {
      const outcome = connOutcomeMap.get(row.raw.connectionId) ?? null;
      row.outcome = outcome;
      if (outcome?.updated_at) {
        if (new Date(outcome.updated_at) > new Date(row.date)) row.date = outcome.updated_at;
        row.timeline = [...row.timeline, { label: `Outcome: ${OUTCOME_STAGE_LABELS[outcome.status] ?? outcome.status}`, date: outcome.updated_at }];
      }
    }
  }

  return rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}