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
import { Loader2, ArrowUpDown, Search } from "lucide-react";
import { fetchPortfolioRows, PortfolioRow, PortfolioRowType, PortfolioDirection } from "@/lib/portfolioData";
import {
  updateConnectionStatus, markPartnershipFormed, unlistPartnership,
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

function DirectionPill({ direction }: { direction: PortfolioDirection }) {
  const s = DIRECTION_STYLES[direction];
  return (
    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: s.bg, color: s.color }}>
      {direction}
    </span>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 1) return "Today";
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function PortfolioTable() {
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

  async function load() {
    if (!user) return;
    setLoading(true);
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
    await load();
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
    await load();
    setActioningId(null);
  }

  async function handleUnlist(row: PortfolioRow) {
    if (row.raw.kind !== "partnership_listing") return;
    setActioningId(row.id);
    await unlistPartnership(row.raw.orgId);
    await load();
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
    await load();
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
                    {row.titleHref ? (
                      <Link href={row.titleHref}
                        className="text-sm font-medium text-foreground hover:text-[#2D6A4F] transition-colors line-clamp-2">
                        {row.title}
                      </Link>
                    ) : (
                      <span className="text-sm text-foreground line-clamp-2">{row.title}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {row.organisationHref ? (
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
                  <td className="px-4 py-3"><StatusPill status={row.status} /></td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{timeAgo(row.date)}</td>
                  <td className="px-4 py-3">
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
                    {row.raw.kind === "partnership_listing" && (
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <FindPartnerModalDashboard
        isOpen={editingListing}
        onClose={() => { setEditingListing(false); load(); }}
      />
    </div>
  );
}