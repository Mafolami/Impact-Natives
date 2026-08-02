// src/pages/PortfolioTable.tsx
//
// Stage 3 of the Portfolio unified tracker: the actual spreadsheet-style
// table, built on top of fetchPortfolioRows (portfolioData.ts) and the
// shared accept/decline/mark-formed/unlist actions (partnershipActions.ts).
//
// SCOPING NOTE ON ACCEPT: this table's Accept button mirrors PartnershipTab
// Inbound tab's plain accept (opens/reuses a conversation, no type chosen
// yet) -- not the separate "Accept Partnership" type-selection modal flow.
// Picking a partnership type still happens from the full Partnerships tab.
// Wiring that modal in here too would double the complexity of this file
// for a step that already has a working home.

import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { Loader2, ArrowUpDown, Search, Banknote, StickyNote } from "lucide-react";
import { fetchPortfolioRows, PortfolioRow, PortfolioRowType, PortfolioDirection, PortfolioOutcome, PortfolioTimelineStage, upsertPartnershipOutcome } from "@/lib/portfolioData";
import {
  updateConnectionStatus, markPartnershipFormed, unlistPartnership, relistPartnership,
} from "@/lib/partnershipActions";
import { FindPartnerModalDashboard } from "./FindPartnerModalDashboard";

type SortKey = "title" | "organisation" | "type" | "status" | "date";
type SortDir = "asc" | "desc";

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  "Draft":                { bg: "rgba(196,92,38,0.08)",  color: "#C45C26" },
  "Pending review":       { bg: "rgba(180,83,9,0.12)",   color: "#b45309" },
  "Listed":               { bg: "rgba(45,106,79,0.12)",  color: "#2D6A4F" },
  "Not approved":         { bg: "rgba(239,68,68,0.12)",  color: "#ef4444" },
  "Closed":               { bg: "rgba(107,114,128,0.12)",color: "#6b7280" },
  "Interest expressed":   { bg: "rgba(180,83,9,0.12)",   color: "#b45309" },
  "In conversation":      { bg: "rgba(45,106,79,0.12)",  color: "#2D6A4F" },
  "Partner confirmed":    { bg: "rgba(45,106,79,0.12)",  color: "#2D6A4F" },
  "Declined":             { bg: "rgba(239,68,68,0.12)",  color: "#ef4444" },
  "Pending":              { bg: "rgba(180,83,9,0.12)",   color: "#b45309" },
  "Accepted":             { bg: "rgba(45,106,79,0.12)",  color: "#2D6A4F" },
  "Partnership formed":   { bg: "rgba(3,105,161,0.12)",  color: "#0369a1" },
  "Awaiting confirmation":{ bg: "rgba(196,92,38,0.08)",  color: "#C45C26" },
  "Unlisted":             { bg: "rgba(107,114,128,0.12)",color: "#6b7280" },
};

const DIRECTION_STYLES: Record<PortfolioDirection, { bg: string; color: string }> = {
  Mine:     { bg: "rgba(45,106,79,0.12)", color: "#2D6A4F" },
  Outbound: { bg: "rgba(3,105,161,0.12)", color: "#0369a1" },
  Inbound:  { bg: "rgba(196,92,38,0.08)", color: "#C45C26" },
};

function StatusPill({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? { bg: "rgba(107,114,128,0.12)", color: "#6b7280" };
  return (
    <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: s.bg, color: s.color }}>
      {status}
    </span>
  );
}

const OUTCOME_STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  not_started:   { bg: "rgba(107,114,128,0.12)", color: "#6b7280", label: "Not started" },
  in_progress:   { bg: "rgba(180,83,9,0.12)",    color: "#b45309", label: "In progress" },
  completed:     { bg: "rgba(45,106,79,0.12)",   color: "#2D6A4F", label: "Completed" },
  stalled:       { bg: "rgba(196,92,38,0.12)",   color: "#C45C26", label: "Stalled" },
  fell_through:  { bg: "rgba(239,68,68,0.12)",   color: "#ef4444", label: "Fell through" },
};

function OutcomePill({ status }: { status: string }) {
  const s = OUTCOME_STATUS_STYLES[status] ?? OUTCOME_STATUS_STYLES.not_started;
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

function DirectionPill({ direction }: { direction: PortfolioDirection }) {
  const s = DIRECTION_STYLES[direction];
  return (
    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: s.bg, color: s.color }}>
      {direction}
    </span>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getDate();
  const month = d.toLocaleDateString("en-GB", { month: "short" });
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

// Outcome tracking only applies once a relationship has actually formed --
// a confirmed initiative partnership, or a formed org-to-org connection.
function isOutcomeEligible(row: PortfolioRow): boolean {
  return (
    (row.raw.kind === "initiative_eoi" && row.status === "Partner confirmed") ||
    (row.raw.kind === "partnership_connection" && row.status === "Partnership formed")
  );
}

const CURRENCIES = ["USD", "GBP", "EUR", "NGN", "KES", "GHS", "ZAR"];

function formatDuration(fromISO: string, toISO: string): string {
  const ms = new Date(toISO).getTime() - new Date(fromISO).getTime();
  const days = Math.floor(ms / 86400000);
  if (days >= 1) return `${days}d`;
  const hours = Math.floor(ms / 3600000);
  if (hours >= 1) return `${hours}h`;
  const mins = Math.floor(ms / 60000);
  return `${Math.max(mins, 0)}m`;
}

function TimelineModal({ row, onClose }: { row: PortfolioRow; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl border border-border w-full max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div>
          <h3 className="text-lg font-bold text-foreground">Timeline</h3>
          <p className="text-sm text-muted-foreground mt-0.5">{row.title} — {row.organisation}</p>
        </div>
        <div>
          {row.timeline.map((stage, i) => {
            const prev = row.timeline[i - 1];
            const isLast = i === row.timeline.length - 1;
            return (
              <div key={stage.label} className="flex items-start gap-3 relative pb-5 last:pb-0">
                {!isLast && <div className="absolute left-[6px] top-4 bottom-0 w-px bg-border" />}
                <div className="w-3.5 h-3.5 rounded-full bg-[#2D6A4F] shrink-0 mt-1 relative z-10 border-2 border-card" />
                <div className="flex-1 min-w-0 -mt-0.5">
                  <p className="text-sm font-medium text-foreground">{stage.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(stage.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    {prev && (
                      <span className="text-muted-foreground/70"> · {formatDuration(prev.date, stage.date)} after {prev.label.toLowerCase()}</span>
                    )}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
        <button type="button" onClick={onClose}
          className="w-full h-9 rounded-full border border-border text-sm text-muted-foreground hover:text-foreground transition-colors">
          Close
        </button>
      </div>
    </div>
  );
}

function OutcomeEditor({ row, currentUserId, onClose, onSaved }: {
  row: PortfolioRow; currentUserId: string; onClose: () => void; onSaved: () => void;
}) {
  const existing = row.outcome;
  const [status, setStatus] = useState<PortfolioOutcome["status"]>(existing?.status ?? "not_started");
  const [fundingDisbursed, setFundingDisbursed] = useState(existing?.funding_disbursed ?? false);
  const [fundingAmount, setFundingAmount] = useState(existing?.funding_amount?.toString() ?? "");
  const [fundingCurrency, setFundingCurrency] = useState(existing?.funding_currency ?? "USD");
  const [startedAt, setStartedAt] = useState(existing?.started_at ?? "");
  const [completedAt, setCompletedAt] = useState(existing?.completed_at ?? "");
  const [stalledAt, setStalledAt] = useState(existing?.stalled_at ?? "");
  const [fellThroughAt, setFellThroughAt] = useState(existing?.fell_through_at ?? "");
  const [everStarted, setEverStarted] = useState<boolean | null>(() => {
    if (!existing) return null;
    if (existing.status === "stalled" || existing.status === "fell_through") {
      return existing.started_at ? true : false;
    }
    return true;
  });
  const [summary, setSummary] = useState(existing?.outcome_summary ?? "");
  const [saving, setSaving] = useState(false);

  const isInitiative = row.type === "Initiative";

  const isStalledOrFell = status === "stalled" || status === "fell_through";

  const canSave = (() => {
    if (status === "not_started") return true;
    if (status === "in_progress") return !!startedAt;
    if (status === "completed") return !!startedAt && !!completedAt;
    if (isStalledOrFell) {
      if (everStarted === null) return false;
      const stageDate = status === "stalled" ? stalledAt : fellThroughAt;
      return everStarted ? (!!startedAt && !!stageDate) : !!stageDate;
    }
    return true;
  })();

  async function save() {
    if (!canSave) return;
    setSaving(true);
    const effectiveStartedAt = isStalledOrFell
      ? (everStarted ? (startedAt || null) : null)
      : (status === "in_progress" || status === "completed") ? (startedAt || null) : null;
    const effectiveCompletedAt = status === "completed" ? (completedAt || null) : null;
    const effectiveStalledAt = status === "stalled" ? (stalledAt || null) : null;
    const effectiveFellThroughAt = status === "fell_through" ? (fellThroughAt || null) : null;

    if (row.raw.kind === "initiative_eoi") {
      await upsertPartnershipOutcome({
        existingId: existing?.id ?? null,
        relationshipType: "initiative_partner",
        initiativeId: row.raw.initiativeId,
        partnerUserId: row.raw.partnerUserId,
        status,
        fundingDisbursed: isInitiative ? fundingDisbursed : null,
        fundingAmount: isInitiative && fundingDisbursed && fundingAmount ? Number(fundingAmount) : null,
        fundingCurrency: isInitiative && fundingDisbursed ? fundingCurrency : null,
        startedAt: effectiveStartedAt,
        completedAt: effectiveCompletedAt,
        stalledAt: effectiveStalledAt,
        fellThroughAt: effectiveFellThroughAt,
        outcomeSummary: summary || null,
        reportedByUserId: currentUserId,
      });
    } else if (row.raw.kind === "partnership_connection") {
      await upsertPartnershipOutcome({
        existingId: existing?.id ?? null,
        relationshipType: "org_partnership",
        connectionId: row.raw.connectionId,
        status,
        fundingDisbursed: null,
        fundingAmount: null,
        fundingCurrency: null,
        startedAt: effectiveStartedAt,
        completedAt: effectiveCompletedAt,
        stalledAt: effectiveStalledAt,
        fellThroughAt: effectiveFellThroughAt,
        outcomeSummary: summary || null,
        reportedByUserId: currentUserId,
      });
    }
    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl border border-border w-full max-w-md p-6 space-y-5" onClick={e => e.stopPropagation()}>
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="text-lg font-bold text-foreground">Update outcome</h3>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{
                background: isInitiative ? "rgba(45,106,79,0.12)" : "rgba(3,105,161,0.12)",
                color: isInitiative ? "#2D6A4F" : "#0369a1",
              }}>
              {isInitiative ? "Initiative partner" : "Org partnership"}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{row.title} — {row.organisation}</p>
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Status</label>
          <select value={status} onChange={e => setStatus(e.target.value as PortfolioOutcome["status"])}
            className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground">
            <option value="not_started">Not started</option>
            <option value="in_progress">In progress</option>
            <option value="completed">Completed</option>
            <option value="stalled">Stalled</option>
            <option value="fell_through">Fell through</option>
          </select>
        </div>

        {/* Dates are shaped entirely by which status is selected -- no
            generic Started/Completed pair shown regardless of relevance. */}
        {status === "in_progress" && (
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Started</label>
            <input type="date" value={startedAt} onChange={e => setStartedAt(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground" />
          </div>
        )}

        {status === "completed" && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Started</label>
              <input type="date" value={startedAt} onChange={e => setStartedAt(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground" />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Completed</label>
              <input type="date" value={completedAt} onChange={e => setCompletedAt(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground" />
            </div>
          </div>
        )}

        {isStalledOrFell && (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                Did this ever start?
              </label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setEverStarted(true)}
                  className={`flex-1 h-9 rounded-lg border text-sm font-medium transition-colors ${
                    everStarted === true ? "bg-[#2D6A4F] border-[#2D6A4F] text-white" : "border-border text-muted-foreground hover:border-[#2D6A4F]"
                  }`}>
                  Yes
                </button>
                <button type="button" onClick={() => setEverStarted(false)}
                  className={`flex-1 h-9 rounded-lg border text-sm font-medium transition-colors ${
                    everStarted === false ? "bg-[#2D6A4F] border-[#2D6A4F] text-white" : "border-border text-muted-foreground hover:border-[#2D6A4F]"
                  }`}>
                  No
                </button>
              </div>
            </div>

            {everStarted === true && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Started</label>
                  <input type="date" value={startedAt} onChange={e => setStartedAt(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground" />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                    {status === "stalled" ? "Stalled" : "Fell through"}
                  </label>
                  <input type="date" value={status === "stalled" ? stalledAt : fellThroughAt}
                    onChange={e => status === "stalled" ? setStalledAt(e.target.value) : setFellThroughAt(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground" />
                </div>
              </div>
            )}

            {everStarted === false && (
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                  {status === "stalled" ? "Stalled" : "Fell through"}
                </label>
                <input type="date" value={status === "stalled" ? stalledAt : fellThroughAt}
                  onChange={e => status === "stalled" ? setStalledAt(e.target.value) : setFellThroughAt(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground" />
              </div>
            )}
          </div>
        )}

        {/* Funding is its own distinct section -- only for initiative
            partnerships, since org-to-org partnerships don't disburse
            capital the same way. Given its own card rather than a
            checkbox buried in the general flow, since it's a materially
            different kind of update from status/dates. */}
        {isInitiative && (
          <div className="rounded-xl border border-[#2D6A4F]/25 bg-[#2D6A4F]/5 p-4 space-y-3">
            <label className="flex items-center gap-2 text-sm font-semibold text-foreground cursor-pointer">
              <input type="checkbox" checked={fundingDisbursed} onChange={e => setFundingDisbursed(e.target.checked)}
                className="accent-[#2D6A4F]" />
              Funding disbursed
            </label>
            {fundingDisbursed && (
              <div className="flex gap-2">
                <input type="number" value={fundingAmount} onChange={e => setFundingAmount(e.target.value)}
                  placeholder="Amount"
                  className="flex-1 h-9 px-3 rounded-lg border border-[#2D6A4F]/25 bg-card text-sm text-foreground" />
                <select value={fundingCurrency} onChange={e => setFundingCurrency(e.target.value)}
                  className="w-24 h-9 px-2 rounded-lg border border-[#2D6A4F]/25 bg-card text-sm text-foreground">
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}
          </div>
        )}

        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">What happened</label>
          <textarea value={summary} onChange={e => setSummary(e.target.value)} rows={3}
            placeholder="What was delivered, or what's blocking progress..."
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground resize-none" />
        </div>

        {!canSave && (
          <p className="text-xs text-[#C45C26] -mt-2">
            {isStalledOrFell && everStarted === null
              ? "Answer \"Did this ever start?\" before saving."
              : "Fill in the required date(s) before saving."}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose}
            className="flex-1 h-9 rounded-full border border-border text-sm text-muted-foreground hover:text-foreground transition-colors">
            Cancel
          </button>
          <button type="button" onClick={save} disabled={saving || !canSave}
            className="flex-1 h-9 rounded-full bg-[#2D6A4F] hover:bg-[#245c43] text-white text-sm font-medium disabled:opacity-40 transition-colors">
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function PortfolioTable({ onOpenOwnListing }: { onOpenOwnListing?: () => void }) {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [rows, setRows] = useState<PortfolioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | PortfolioRowType>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [editingListing, setEditingListing] = useState(false);
  const [outcomeEditingRow, setOutcomeEditingRow] = useState<PortfolioRow | null>(null);
  const [timelineRow, setTimelineRow] = useState<PortfolioRow | null>(null);

  async function load(showLoader = true) {
    if (!user) return;
    if (showLoader) setLoading(true);
    const data = await fetchPortfolioRows(user.id);
    setRows(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, [user]);

  const statusOptions = useMemo(() => {
    const set = new Set(rows.map(r => r.status));
    return ["all", ...Array.from(set)];
  }, [rows]);

  const filteredSorted = useMemo(() => {
    let out = rows;
    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter(r => r.title.toLowerCase().includes(q) || r.organisation.toLowerCase().includes(q));
    }
    if (typeFilter !== "all") out = out.filter(r => r.type === typeFilter);
    if (statusFilter !== "all") out = out.filter(r => r.status === statusFilter);

    const dir = sortDir === "asc" ? 1 : -1;
    return [...out].sort((a, b) => {
      switch (sortKey) {
        case "title":        return a.title.localeCompare(b.title) * dir;
        case "organisation": return a.organisation.localeCompare(b.organisation) * dir;
        case "type":         return a.type.localeCompare(b.type) * dir;
        case "status":       return a.status.localeCompare(b.status) * dir;
        case "date":         return (new Date(a.date).getTime() - new Date(b.date).getTime()) * dir;
        default:              return 0;
      }
    });
  }, [rows, search, typeFilter, statusFilter, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  async function handleAccept(row: PortfolioRow) {
    if (row.raw.kind !== "partnership_connection" || !user) return;
    setActioningId(row.id);
    const { data: myOrg } = await supabase.from("organizations")
      .select("id, organisation_name").eq("user_id", user.id).maybeSingle();
    const { data: conn } = await supabase.from("partnership_connections")
      .select("id, conversation_id, ai_rationale").eq("id", row.raw.connectionId).single();
    if (!conn) { setActioningId(null); return; }
    const { conversationId } = await updateConnectionStatus(conn, "accepted", {
      userId: user.id, myOrgName: myOrg?.organisation_name ?? "",
    });
    await load(false);
    setActioningId(null);
    if (conversationId) navigate(`/dashboard/messages?conversation=${conversationId}`);
  }

  async function handleDecline(row: PortfolioRow) {
    if (row.raw.kind !== "partnership_connection" || !user) return;
    setActioningId(row.id);
    const { data: myOrg } = await supabase.from("organizations")
      .select("id, organisation_name").eq("user_id", user.id).maybeSingle();
    const { data: conn } = await supabase.from("partnership_connections")
      .select("id, conversation_id, ai_rationale").eq("id", row.raw.connectionId).single();
    if (!conn) { setActioningId(null); return; }
    await updateConnectionStatus(conn, "declined", {
      userId: user.id, myOrgName: myOrg?.organisation_name ?? "",
    });
    await load(false);
    setActioningId(null);
  }

  async function handleUnlist(row: PortfolioRow) {
    if (row.raw.kind !== "partnership_listing") return;
    setActioningId(row.id);
    await unlistPartnership(row.raw.orgId);
    await load(false);
    setActioningId(null);
  }

  async function handleRelist(row: PortfolioRow) {
    if (row.raw.kind !== "partnership_listing") return;
    setActioningId(row.id);
    await relistPartnership(row.raw.orgId);
    await load(false);
    setActioningId(null);
  }

  async function handleMarkFormed(row: PortfolioRow) {
    if (row.raw.kind !== "partnership_listing" || !user) return;
    setActioningId(row.id);
    const { data: myOrg } = await supabase.from("organizations")
      .select("id, organisation_name, partnership_title").eq("user_id", user.id).maybeSingle();
    const { data: inbound } = await supabase.from("partnership_connections")
      .select("id, status").eq("receiver_org_id", row.raw.orgId);
    await markPartnershipFormed(
      row.raw.orgId, inbound ?? [], myOrg?.organisation_name ?? "", myOrg?.partnership_title ?? null
    );
    await load(false);
    setActioningId(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 text-[#2D6A4F] animate-spin" />
      </div>
    );
  }

  const SortHeader = ({ label, sortK }: { label: string; sortK: SortKey }) => (
    <button type="button" onClick={() => toggleSort(sortK)}
      className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap">
      {label}
      <ArrowUpDown className={`w-3 h-3 ${sortKey === sortK ? "text-[#2D6A4F]" : "opacity-40"}`} />
    </button>
  );

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter by title or organisation..."
            className="w-full h-9 pl-8 pr-3 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
          />
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as any)}
          className="h-9 px-3 rounded-lg border border-border bg-card text-sm text-foreground">
          <option value="all">All types</option>
          <option value="Initiative">Initiative</option>
          <option value="Partnership">Partnership</option>
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="h-9 px-3 rounded-lg border border-border bg-card text-sm text-foreground">
          {statusOptions.map(s => (
            <option key={s} value={s}>{s === "all" ? "All statuses" : s}</option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground ml-auto whitespace-nowrap">
          {filteredSorted.length} of {rows.length}
        </span>
      </div>

      {/* Table */}
      {filteredSorted.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center">
          <p className="text-foreground font-medium mb-1">No matching rows.</p>
          <p className="text-sm text-muted-foreground">Try clearing filters.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-x-auto">
          <table className="w-full text-sm min-w-[960px]">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3"><SortHeader label="Title" sortK="title" /></th>
                <th className="text-left px-4 py-3"><SortHeader label="Organisation" sortK="organisation" /></th>
                <th className="text-left px-4 py-3"><SortHeader label="Type" sortK="type" /></th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">Support Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">Direction</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap"># EOIs</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">Contact</th>
                <th className="text-left px-4 py-3"><SortHeader label="Status" sortK="status" /></th>
                <th className="text-left px-4 py-3"><SortHeader label="Date" sortK="date" /></th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredSorted.map(row => (
                <tr key={row.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 max-w-[260px]">
                    {row.raw.kind === "partnership_listing" ? (
                      <button type="button" onClick={() => onOpenOwnListing?.()}
                        className="text-sm font-medium text-foreground hover:text-[#2D6A4F] transition-colors line-clamp-2 text-left">
                        {row.title}
                      </button>
                    ) : row.titleHref ? (
                      <Link href={row.titleHref}
                        className="text-sm font-medium text-foreground hover:text-[#2D6A4F] transition-colors line-clamp-2">
                        {row.title}
                      </Link>
                    ) : (
                      <span className="text-sm text-foreground line-clamp-2">{row.title}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {row.raw.kind === "partnership_listing" ? (
                      <button type="button" onClick={() => onOpenOwnListing?.()}
                        className="text-sm text-muted-foreground hover:text-[#2D6A4F] transition-colors text-left">
                        {row.organisation}
                      </button>
                    ) : row.organisationHref ? (
                      <Link href={row.organisationHref}
                        className="text-sm text-muted-foreground hover:text-[#2D6A4F] transition-colors">
                        {row.organisation}
                      </Link>
                    ) : (
                      <span className="text-sm text-muted-foreground">{row.organisation}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground whitespace-nowrap">{row.type}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{row.supportType ?? "—"}</td>
                  <td className="px-4 py-3"><DirectionPill direction={row.direction} /></td>
                  <td className="px-4 py-3 text-sm text-foreground">{row.eoiCount ?? "—"}</td>
                  <td className="px-4 py-3">
                    {row.contactEmail ? (
                      <a href={`mailto:${row.contactEmail}`} className="text-xs text-[#2D6A4F] hover:underline whitespace-nowrap">
                        {row.contactEmail}
                      </a>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1 items-start">
                      <div className="flex items-center gap-1.5">
                        <StatusPill status={row.status} />
                        {row.outcome?.funding_disbursed && (
                          <span className="relative inline-flex group/fund">
                            <Banknote className="w-3.5 h-3.5 text-[#2D6A4F]" />
                            <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 hidden group-hover/fund:block whitespace-nowrap text-[11px] font-medium bg-foreground text-background px-2.5 py-1 rounded-md z-20">
                              {row.outcome.funding_currency} {row.outcome.funding_amount?.toLocaleString() ?? "—"} disbursed
                            </span>
                          </span>
                        )}
                      </div>
                      {isOutcomeEligible(row) && (
                        <div className="flex items-center gap-1">
                          <OutcomePill status={row.outcome?.status ?? "not_started"} />
                          {row.outcome?.outcome_summary && (
                            <span className="relative inline-flex group/note">
                              <StickyNote className="w-3.5 h-3.5 text-muted-foreground" />
                              <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 hidden group-hover/note:block whitespace-pre-wrap text-[11px] font-medium bg-foreground text-background px-2.5 py-1.5 rounded-md z-20 w-48 leading-snug">
                                {row.outcome.outcome_summary}
                              </span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap">
                    <button type="button" onClick={() => setTimelineRow(row)}
                      className="text-muted-foreground hover:text-[#2D6A4F] underline decoration-dotted underline-offset-2 transition-colors">
                      {formatDate(row.date)}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1.5 items-start">
                    {row.raw.kind === "partnership_connection" && row.status === "Pending" && row.direction === "Inbound" && (
                      <div className="flex gap-1.5">
                        <button type="button" disabled={actioningId === row.id} onClick={() => handleAccept(row)}
                          className="text-xs px-2.5 py-1 rounded-full bg-[#2D6A4F] hover:bg-[#245c43] text-white disabled:opacity-40 transition-colors whitespace-nowrap">
                          Accept
                        </button>
                        <button type="button" disabled={actioningId === row.id} onClick={() => handleDecline(row)}
                          className="text-xs px-2.5 py-1 rounded-full border border-border text-muted-foreground hover:text-red-500 disabled:opacity-40 transition-colors whitespace-nowrap">
                          Decline
                        </button>
                      </div>
                    )}
                    {row.raw.kind === "partnership_listing" && row.status === "Unlisted" && (
                      <div className="flex gap-1.5">
                        <button type="button" disabled={actioningId === row.id} onClick={() => handleRelist(row)}
                          className="text-xs px-2.5 py-1 rounded-full border border-[#2D6A4F]/40 text-[#2D6A4F] hover:bg-[#2D6A4F]/5 disabled:opacity-40 transition-colors whitespace-nowrap">
                          Relist
                        </button>
                        <button type="button" disabled={actioningId === row.id} onClick={() => setEditingListing(true)}
                          className="text-xs px-2.5 py-1 rounded-full border border-border text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors whitespace-nowrap">
                          Edit
                        </button>
                      </div>
                    )}
                    {row.raw.kind === "partnership_listing" && row.status !== "Unlisted" && (
                      <div className="flex gap-1.5">
                        {row.status !== "Partnership formed" && (
                          <button type="button" disabled={actioningId === row.id} onClick={() => handleMarkFormed(row)}
                            className="text-xs px-2.5 py-1 rounded-full border border-[#2D6A4F]/40 text-[#2D6A4F] hover:bg-[#2D6A4F]/5 disabled:opacity-40 transition-colors whitespace-nowrap">
                            Mark formed
                          </button>
                        )}
                        <button type="button" disabled={actioningId === row.id} onClick={() => setEditingListing(true)}
                          className="text-xs px-2.5 py-1 rounded-full border border-border text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors whitespace-nowrap">
                          Edit
                        </button>
                        <button type="button" disabled={actioningId === row.id} onClick={() => handleUnlist(row)}
                          className="text-xs px-2.5 py-1 rounded-full border border-border text-muted-foreground hover:text-red-500 disabled:opacity-40 transition-colors whitespace-nowrap">
                          Unlist
                        </button>
                      </div>
                    )}
                    {isOutcomeEligible(row) && (
                      <button type="button" onClick={() => setOutcomeEditingRow(row)}
                        className="text-xs px-2.5 py-1 rounded-full border border-border text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap">
                        Update outcome
                      </button>
                    )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <FindPartnerModalDashboard
        isOpen={editingListing}
        onClose={() => { setEditingListing(false); load(false); }}
      />

      {outcomeEditingRow && user && (
        <OutcomeEditor
          row={outcomeEditingRow}
          currentUserId={user.id}
          onClose={() => setOutcomeEditingRow(null)}
          onSaved={() => { setOutcomeEditingRow(null); load(false); }}
        />
      )}

      {timelineRow && (
        <TimelineModal row={timelineRow} onClose={() => setTimelineRow(null)} />
      )}
    </div>
  );
}