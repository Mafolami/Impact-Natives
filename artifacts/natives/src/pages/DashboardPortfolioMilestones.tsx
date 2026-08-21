import { useState, useEffect, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { Loader2, Plus, X, Clock, Eye, CheckCircle2, PartyPopper, ChevronDown } from "lucide-react";
import {
  MouMilestone, OrgRef, isMilestoneOverdue,
} from "@/lib/milestones";
import { resolveMouDocTitle } from "@/lib/mouTitle";
import MilestoneCard from "@/components/mou/MilestoneCard";
import MilestoneCreateModal from "@/components/mou/MilestoneCreateModal";
import MilestoneDetailModal from "@/components/mou/MilestoneDetailModal";
import IndicatorsBoard from "@/components/mou/IndicatorsBoard";

interface ExecutedDoc {
  id: string;
  org_a_id: string;
  org_b_id: string;
  initiative_id: string | null;
  connection_id: string | null;
  toggle_selections: Record<string, string | boolean> | null;
}

function isBindingDoc(doc: ExecutedDoc): boolean {
  return doc.toggle_selections?.["agreement_type"] === "binding";
}

export default function DashboardPortfolioMilestones() {
  const { user, orgOwnerId } = useAuth();
  const userId = user?.id ?? null;
  const [location, navigate] = useLocation();

  const [loading, setLoading] = useState(true);
  const [myOrgId, setMyOrgId] = useState<string | null>(null);
  const [docs, setDocs] = useState<ExecutedDoc[]>([]);
  const [orgMap, setOrgMap] = useState<Record<string, OrgRef>>({});
  const [initiativeTitleMap, setInitiativeTitleMap] = useState<Record<string, string>>({});
  const [milestones, setMilestones] = useState<MouMilestone[]>([]);

  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Arriving from a specific MoU's "Milestones" card button -- ?mouId=...
  const [scopedDocId, setScopedDocId] = useState<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(location.includes("?") ? location.split("?")[1] : "");
    setScopedDocId(params.get("mouId"));
  }, [location]);

  const [showPicker, setShowPicker] = useState(false);
  // "create" opens the picker to choose which MoU a new milestone belongs
  // to; "view" opens the same picker to scope the whole board to one MoU
  // via ?mouId=, reusing the identical searchable list rather than a
  // second component.
  const [pickerMode, setPickerMode] = useState<"create" | "view">("create");
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickedDocId, setPickedDocId] = useState<string>("");
  const [selectedMilestone, setSelectedMilestone] = useState<MouMilestone | null>(null);
  // Sections with nothing outstanding (everything already disbursed)
  // default to collapsed so the page doesn't turn into a long scroll of
  // boards with no live activity. seenDocIds tracks which docs already had
  // their default applied, so a person manually re-expanding one doesn't
  // get overridden back to collapsed on the next data reload.
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const seenDocIds = useRef<Set<string>>(new Set());
  const [docView, setDocView] = useState<Record<string, "milestones" | "indicators">>({});

  useEffect(() => { load(); }, [orgOwnerId]);

  async function load() {
    if (!orgOwnerId) return;
    setLoading(true);
    const { data: myOrg } = await supabase.from("organizations").select("id").eq("user_id", orgOwnerId).maybeSingle();
    if (!myOrg) { setLoading(false); return; }
    setMyOrgId(myOrg.id);

    const { data: docRows } = await supabase
      .from("mou_documents")
      .select("id, org_a_id, org_b_id, initiative_id, connection_id, toggle_selections")
      .or(`org_a_id.eq.${myOrg.id},org_b_id.eq.${myOrg.id}`)
      .eq("status", "fully_executed");
    setDocs((docRows as ExecutedDoc[]) ?? []);

    const orgIds = [...new Set((docRows ?? []).flatMap((d: any) => [d.org_a_id, d.org_b_id]))];
    if (orgIds.length > 0) {
      const { data: orgs } = await supabase.from("organizations").select("id, user_id, organisation_name, partnership_sought").in("id", orgIds);
      const map: Record<string, OrgRef> = {};
      (orgs ?? []).forEach((o: any) => { map[o.id] = o; });
      setOrgMap(map);
    }

    const initIds = [...new Set((docRows ?? []).map((d: any) => d.initiative_id).filter((x: any): x is string => !!x))];
    if (initIds.length > 0) {
      const { data: inits } = await supabase.from("initiative_requests").select("id, title").in("id", initIds);
      const titleMap: Record<string, string> = {};
      (inits ?? []).forEach((i: any) => { titleMap[i.id] = i.title; });
      setInitiativeTitleMap(titleMap);
    }

    const docIds = (docRows ?? []).map((d: any) => d.id);
    if (docIds.length > 0) {
      const { data: msRows } = await supabase
        .from("mou_milestones")
        .select("id,mou_document_id,title,description,target_date,linked_amount,linked_currency,payer_org_id,recipient_org_id,status,created_at")
        .in("mou_document_id", docIds)
        .order("target_date", { ascending: true, nullsFirst: false });
      setMilestones((msRows as MouMilestone[]) ?? []);
    } else {
      setMilestones([]);
    }
    setLoading(false);
  }

  const docsById = useMemo(() => {
    const map: Record<string, ExecutedDoc> = {};
    docs.forEach((d) => { map[d.id] = d; });
    return map;
  }, [docs]);

  function partnerOrgIdFor(doc: ExecutedDoc): string {
    return doc.org_a_id === myOrgId ? doc.org_b_id : doc.org_a_id;
  }

  // Initiative-based docs already have a real title. Connection-based docs
  // don't -- partnership_title is essentially never populated in practice,
  // so fall back to the listing owner's (org_a's) own partnership_sought
  // text, same resolution used for the MoU picker on the MoUs page.
  function docTitle(doc: ExecutedDoc): string | null {
    return resolveMouDocTitle(doc, orgMap, initiativeTitleMap);
  }

  const pickerOptions = useMemo(() => {
    const opts = docs.map((d) => ({
      doc: d,
      partnerName: orgMap[partnerOrgIdFor(d)]?.organisation_name ?? "Partner",
      title: docTitle(d),
    }));
    opts.sort((a, b) => a.partnerName.localeCompare(b.partnerName) || (a.title ?? "").localeCompare(b.title ?? ""));
    const q = pickerSearch.trim().toLowerCase();
    if (!q) return opts;
    return opts.filter((o) => o.partnerName.toLowerCase().includes(q) || (o.title ?? "").toLowerCase().includes(q));
  }, [docs, orgMap, myOrgId, initiativeTitleMap, pickerSearch]);

  // Status is the only cross-cutting milestone-level filter now -- which
  // agreement(s) show is decided by scopedDocId below, at the section
  // level, not by mixing into this same predicate.
  const statusFiltered = useMemo(() => {
    return milestones.filter((m) => filterStatus === "all" || m.status === filterStatus);
  }, [milestones, filterStatus]);
  const docsWithAnyMilestone = useMemo(() => new Set(milestones.map((m) => m.mou_document_id)), [milestones]);

  // Tiles reflect whatever's currently in view -- the whole portfolio when
  // unscoped, just the one agreement's numbers when scoped. Uses the base
  // milestones set (not statusFiltered), since the tiles are an overview
  // independent of the status dropdown, not a live count of the filtered
  // rows below them.
  const statsMilestones = scopedDocId ? milestones.filter((m) => m.mou_document_id === scopedDocId) : milestones;
  // Amounts were being summed as bare numbers with no regard for
  // linked_currency, so a $50,000 milestone displayed as plain "50,000"
  // with the currency silently dropped. Grouping by currency and
  // formatting each group with Intl.NumberFormat fixes that, and also
  // keeps a mixed-currency portfolio honest instead of adding unlike
  // currencies together into one misleading total.
  function sumByCurrency(items: MouMilestone[], predicate?: (m: MouMilestone) => boolean): { currency: string; amount: number }[] {
    const totals = new Map<string, number>();
    for (const m of items) {
      if (predicate && !predicate(m)) continue;
      if (!m.linked_amount) continue;
      const currency = m.linked_currency || "USD";
      totals.set(currency, (totals.get(currency) ?? 0) + m.linked_amount);
    }
    return [...totals.entries()].map(([currency, amount]) => ({ currency, amount }));
  }
  function formatCurrencyTotals(totals: { currency: string; amount: number }[]): string {
    if (totals.length === 0) return "0";
    return totals.map(({ currency, amount }) => {
      try {
        return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
      } catch {
        // Unrecognized/invalid currency code -- fall back rather than crash the tile.
        return `${currency} ${amount.toLocaleString()}`;
      }
    }).join(" · ");
  }
  const stats = useMemo(() => {
    const totalCommitted = sumByCurrency(statsMilestones);
    const disbursed = sumByCurrency(statsMilestones, (m) => m.status === "disbursed");
    const overdue = statsMilestones.filter((m) => isMilestoneOverdue(m)).length;
    const onTrack = statsMilestones.filter((m) => !isMilestoneOverdue(m) && m.status !== "disbursed").length;
    return { totalCommitted, disbursed, overdue, onTrack };
  }, [statsMilestones]);

  const columns: {
    key: string; label: string; predicate: (m: MouMilestone) => boolean;
    icon: typeof Clock; border: string; headerBg: string; text: string;
  }[] = [
    {
      key: "pending", label: "Pending", predicate: (m) => m.status === "pending" || m.status === "revision_requested",
      icon: Clock, border: "border-amber-200 dark:border-amber-900/40", headerBg: "bg-amber-50 dark:bg-amber-950/20", text: "text-amber-600 dark:text-amber-500",
    },
    {
      key: "in_review", label: "In review", predicate: (m) => m.status === "in_review",
      icon: Eye, border: "border-blue-200 dark:border-blue-900/40", headerBg: "bg-blue-50 dark:bg-blue-950/20", text: "text-blue-600 dark:text-blue-400",
    },
    {
      key: "verified", label: "Verified", predicate: (m) => m.status === "verified",
      icon: CheckCircle2, border: "border-[#2D6A4F]/20", headerBg: "bg-[#2D6A4F]/[0.06]", text: "text-[#2D6A4F]",
    },
    {
      key: "disbursed", label: "Disbursed", predicate: (m) => m.status === "disbursed",
      icon: PartyPopper, border: "border-[#2D6A4F]/30", headerBg: "bg-[#2D6A4F]/10", text: "text-[#2D6A4F]",
    },
  ];

  function orgsForMilestone(m: MouMilestone): { orgA: OrgRef | null; orgB: OrgRef | null } {
    const doc = docsById[m.mou_document_id];
    if (!doc) return { orgA: null, orgB: null };
    return { orgA: orgMap[doc.org_a_id] ?? null, orgB: orgMap[doc.org_b_id] ?? null };
  }

  // One board, reused whether it's rendering the single scoped agreement,
  // the merged all-agreements view, or one section among several under a
  // partner filter -- the columns/logic never change, only which
  // milestones feed in.
  function KanbanBoard({ items }: { items: MouMilestone[] }) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {columns.map((col) => {
          const colItems = items.filter(col.predicate);
          const Icon = col.icon;
          return (
            <div key={col.key} className={`rounded-xl border ${col.border} overflow-hidden`}>
              <div className={`flex items-center gap-2 px-3 py-2.5 border-b ${col.border} ${col.headerBg}`}>
                <Icon className={`w-4 h-4 ${col.text}`} />
                <p className={`text-sm font-semibold ${col.text}`}>{col.label}</p>
                <span className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full border ${col.border} ${col.text} bg-white dark:bg-card`}>
                  {colItems.length}
                </span>
              </div>
              <div className="p-3 space-y-2 bg-white dark:bg-card min-h-[64px]">
                {colItems.length === 0 ? (
                  <p className="text-xs text-black dark:text-white">Nothing here.</p>
                ) : (
                  colItems.map((m) => (
                    <MilestoneCard key={m.id} milestone={m} onClick={() => setSelectedMilestone(m)} />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Always sectioned now -- one Kanban per agreement, grouped under its
  // partner. A partner with several agreements gets its name shown once,
  // then each agreement's title + board stacked underneath with just
  // spacing between them; the thick divider is reserved for moving to a
  // genuinely different partner, not between two agreements with the same
  // one. Scoped to one agreement, this collapses to a single group with a
  // single agreement in it -- same code path, no special case needed.
  const sectionDocs = useMemo(() => {
    const base = scopedDocId
      ? docs.filter((d) => d.id === scopedDocId)
      : docs.filter((d) => docsWithAnyMilestone.has(d.id));
    return [...base].sort((a, b) => {
      const aName = orgMap[partnerOrgIdFor(a)]?.organisation_name ?? "";
      const bName = orgMap[partnerOrgIdFor(b)]?.organisation_name ?? "";
      return aName.localeCompare(bName) || (docTitle(a) ?? "").localeCompare(docTitle(b) ?? "");
    });
  }, [docs, scopedDocId, docsWithAnyMilestone, orgMap, initiativeTitleMap, myOrgId]);

  const partnerGroups = useMemo(() => {
    const groups: { partnerId: string; partnerName: string; docs: ExecutedDoc[] }[] = [];
    for (const doc of sectionDocs) {
      const partnerId = partnerOrgIdFor(doc);
      const partnerName = orgMap[partnerId]?.organisation_name ?? "Partner";
      const last = groups[groups.length - 1];
      if (last && last.partnerId === partnerId) {
        last.docs.push(doc);
      } else {
        groups.push({ partnerId, partnerName, docs: [doc] });
      }
    }
    return groups;
  }, [sectionDocs, orgMap, myOrgId]);

  // Auto-collapse any agreement with nothing outstanding (every milestone
  // already disbursed) the first time it's seen, so a long history of
  // fully-settled agreements doesn't turn the page into dead scroll. Never
  // applied to a scoped single agreement -- if someone picked it via
  // Viewing, they want to see it, not have it hide itself.
  useEffect(() => {
    if (scopedDocId) return;
    setCollapsedIds((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const doc of sectionDocs) {
        if (seenDocIds.current.has(doc.id)) continue;
        seenDocIds.current.add(doc.id);
        const hasOutstanding = milestones.some((m) => m.mou_document_id === doc.id && m.status !== "disbursed");
        if (!hasOutstanding) { next.add(doc.id); changed = true; }
      }
      return changed ? next : prev;
    });
  }, [sectionDocs, milestones, scopedDocId]);

  function toggleCollapse(docId: string) {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId); else next.add(docId);
      return next;
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 text-[#2D6A4F] animate-spin" />
      </div>
    );
  }

  const scopedPartnerName = scopedDocId && docsById[scopedDocId]
    ? (orgMap[partnerOrgIdFor(docsById[scopedDocId])]?.organisation_name ?? "this partner")
    : null;
  // The "Viewing:" label should read as an initiative/partnership title,
  // not just a partner org name -- the org name is the fallback, not the
  // primary label, matching how the picker's own rows are titled.
  const scopedTitle = scopedDocId && docsById[scopedDocId]
    ? (docTitle(docsById[scopedDocId]) ?? scopedPartnerName)
    : null;

  const scopedDoc = scopedDocId ? docsById[scopedDocId] : null;
  // Non-binding agreements carry no financial commitment -- showing
  // "Total committed"/"Disbursed" tiles for one implies an obligation
  // that doesn't exist. Only suppress this when scoped to a single
  // agreement that's actually non-binding; the unscoped portfolio view
  // keeps all four, since it's an aggregate where binding agreements'
  // real figures still belong.
  const showFinancialTiles = !scopedDoc || isBindingDoc(scopedDoc);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <button type="button"
          onClick={() => { setPickerMode("view"); setPickedDocId(scopedDocId ?? ""); setPickerSearch(""); setShowPicker(true); }}
          className="flex items-center gap-2 h-10 px-4 rounded-lg border border-border text-sm text-black dark:text-white hover:border-[#2D6A4F]/40 transition-colors">
          <span>Viewing:</span>
          <span className="font-semibold">{scopedTitle ?? "All agreements"}</span>
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
        {scopedDocId && (
          <button type="button" onClick={() => { setScopedDocId(null); navigate("/dashboard/portfolio/milestones"); }}
            className="flex items-center gap-1 text-sm text-black dark:text-white hover:underline">
            <X className="w-3.5 h-3.5" /> View all
          </button>
        )}
      </div>

      {/* Tiles now reflect the current scope -- whole portfolio when
          unscoped, just this agreement's numbers when scoped -- so they
          stay visible in both states rather than disappearing on scope.
          When financial tiles are hidden (non-binding), the remaining two
          each span half the grid instead of shrinking into a narrow
          left-aligned block with dead space on the right. */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {showFinancialTiles && (
          <>
            <div className="rounded-xl p-4 bg-white dark:bg-card border border-border">
              <p className="text-xs text-black dark:text-white mb-1">Total committed</p>
              <p className="text-xl font-medium text-black dark:text-white">{formatCurrencyTotals(stats.totalCommitted)}</p>
            </div>
            <div className="rounded-xl p-4 bg-white dark:bg-card border border-border">
              <p className="text-xs text-black dark:text-white mb-1">Disbursed</p>
              <p className="text-xl font-medium text-black dark:text-white">{formatCurrencyTotals(stats.disbursed)}</p>
            </div>
          </>
        )}
        <div className={`rounded-xl p-4 bg-white dark:bg-card border border-border ${!showFinancialTiles ? "sm:col-span-2" : ""}`}>
          <p className="text-xs text-black dark:text-white mb-1">On track</p>
          <p className="text-xl font-medium text-black dark:text-white">{stats.onTrack}</p>
        </div>
        <div className={`rounded-xl p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 ${!showFinancialTiles ? "sm:col-span-2" : ""}`}>
          <p className="text-xs text-amber-600 dark:text-amber-500 mb-1">Overdue</p>
          <p className="text-xl font-medium text-amber-600 dark:text-amber-500">{stats.overdue}</p>
        </div>
      </div>

      {!scopedDocId && (
        <div className="flex justify-end">
          <button type="button" onClick={() => { setPickerMode("create"); setPickedDocId(""); setPickerSearch(""); setShowPicker(true); }}
            className="flex items-center gap-1.5 h-9 px-4 rounded-full bg-[#2D6A4F] hover:bg-[#245c43] text-white text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" /> New milestone
          </button>
        </div>
      )}

      {scopedDocId && (
        <div className="flex justify-end">
          <button type="button" onClick={() => setPickedDocId(scopedDocId)}
            className="flex items-center gap-1.5 h-9 px-4 rounded-full bg-[#2D6A4F] hover:bg-[#245c43] text-white text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" /> New milestone
          </button>
        </div>
      )}

      {milestones.length === 0 ? (
        <p className="text-sm text-black dark:text-white">
          No milestones yet. Use the button above to add one against an executed MoU.
        </p>
      ) : (
        <>
          {/* Status filter stays available in both states now -- it narrows
              what's in each column, distinct from which agreement(s) show,
              which scopedDocId/sectionDocs decide instead. */}
          <div className="flex flex-wrap items-center gap-2">
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
              className="h-9 px-3 rounded-lg border border-border bg-transparent text-sm text-black dark:text-white">
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="revision_requested">Revision requested</option>
              <option value="in_review">In review</option>
              <option value="verified">Verified</option>
              <option value="disbursed">Disbursed</option>
            </select>
          </div>

          {partnerGroups.length === 0 ? (
            <p className="text-sm text-black dark:text-white">No milestones for this agreement yet.</p>
          ) : (
            <div className="space-y-8">
              {partnerGroups.map((group, gi) => (
                <div key={group.partnerId}>
                  {gi > 0 && <div className="h-[3px] bg-border rounded-full mb-8" />}
                  <p className="text-base font-semibold text-black dark:text-white mb-4">{group.partnerName}</p>
                  <div className="space-y-6">
                    {group.docs.map((doc) => {
                      const title = docTitle(doc) ?? "Partnership";
                      const docItems = statusFiltered.filter((m) => m.mou_document_id === doc.id);
                      const isCollapsed = !scopedDocId && collapsedIds.has(doc.id);
                      const view = docView[doc.id] ?? "milestones";
                      return (
                        <div key={doc.id}>
                          <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                            <button type="button" onClick={() => toggleCollapse(doc.id)}
                              className="flex items-center gap-2 text-left group">
                              <ChevronDown className={`w-3.5 h-3.5 text-black dark:text-white transition-transform shrink-0 ${isCollapsed ? "-rotate-90" : ""}`} />
                              <p className="text-sm text-black dark:text-white group-hover:underline">{title}</p>
                              {isCollapsed && (
                                <span className="text-xs text-black dark:text-white">({docItems.length})</span>
                              )}
                            </button>
                            {!isCollapsed && (
                              <div className="flex items-center rounded-full border border-border p-0.5 shrink-0">
                                <button type="button" onClick={() => setDocView((prev) => ({ ...prev, [doc.id]: "milestones" }))}
                                  className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                                    view === "milestones" ? "bg-[#2D6A4F] text-white" : "text-black dark:text-white"
                                  }`}>
                                  Milestones
                                </button>
                                <button type="button" onClick={() => setDocView((prev) => ({ ...prev, [doc.id]: "indicators" }))}
                                  className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                                    view === "indicators" ? "bg-[#2D6A4F] text-white" : "text-black dark:text-white"
                                  }`}>
                                  Indicators
                                </button>
                              </div>
                            )}
                          </div>
                          {!isCollapsed && (view === "milestones" ? <KanbanBoard items={docItems} /> : <IndicatorsBoard mouDocumentId={doc.id} />)}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {showPicker && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowPicker(false)}>
          <div className="bg-white dark:bg-card rounded-t-2xl sm:rounded-2xl border border-border w-full sm:max-w-sm shadow-xl p-6 space-y-4 max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}>
            <p className="text-base font-bold text-black dark:text-white">
              {pickerMode === "view" ? "Choose which agreement to view" : "Which agreement is this for?"}
            </p>
            {docs.length === 0 ? (
              <p className="text-sm text-black dark:text-white">No executed MoUs yet -- milestones can only be added once an agreement is fully executed.</p>
            ) : (
              <>
                <input type="text" placeholder="Search by partner or title" value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-transparent text-sm text-black dark:text-white" />
                {pickerMode === "view" && (
                  // Deliberately outside the scrollable/searchable list and
                  // visually distinct (plain row, no card border) -- this
                  // is a scope-reset action, not another agreement, and
                  // styling it identically to the rows below made it read
                  // as a fourth option in the same list rather than an
                  // escape hatch from it.
                  <button type="button" onClick={() => setPickedDocId("")}
                    className={`w-full text-left px-3 py-2 border-b border-border transition-colors ${
                      pickedDocId === "" ? "text-[#2D6A4F] font-semibold" : "text-black dark:text-white hover:text-[#2D6A4F]"
                    }`}>
                    All agreements
                  </button>
                )}
                <div className="overflow-y-auto space-y-1.5 -mx-1 px-1">
                  {pickerOptions.length === 0 && (
                    <p className="text-sm text-black dark:text-white">No match.</p>
                  )}
                  {pickerOptions.map(({ doc, partnerName, title }) => (
                    <button type="button" key={doc.id} onClick={() => setPickedDocId(doc.id)}
                      className={`w-full text-left rounded-lg border px-3 py-2 transition-colors ${
                        pickedDocId === doc.id ? "border-[#2D6A4F] bg-[#2D6A4F]/[0.06]" : "border-border hover:border-[#2D6A4F]/40"
                      }`}>
                      <p className="text-sm font-medium text-black dark:text-white">{partnerName}</p>
                      <p className="text-xs text-black dark:text-white">{title ?? "Partnership"}</p>
                    </button>
                  ))}
                </div>
              </>
            )}
            <div className="flex gap-2">
              <button type="button" onClick={() => { setShowPicker(false); setPickedDocId(""); setPickerSearch(""); }}
                className="flex-1 h-10 rounded-full border border-border text-sm text-black dark:text-white hover:border-foreground/30 transition-colors">
                Cancel
              </button>
              <button type="button" disabled={pickerMode === "create" && !pickedDocId}
                onClick={() => {
                  setShowPicker(false);
                  setPickerSearch("");
                  if (pickerMode === "view") {
                    // Set scoped state directly rather than relying only on
                    // the URL round-trip -- a query-only change (same path,
                    // different ?mouId=) doesn't reliably re-fire the
                    // location-watching effect below on every setup, which
                    // was leaving the "Viewing:" label stuck on its old
                    // value even though the underlying list was scoped
                    // correctly. The navigate() call still runs too, so a
                    // refresh or direct link to the URL keeps working.
                    setScopedDocId(pickedDocId || null);
                    navigate(pickedDocId ? `/dashboard/portfolio/milestones?mouId=${pickedDocId}` : "/dashboard/portfolio/milestones");
                    setPickedDocId("");
                  }
                }}
                className="flex-1 h-10 rounded-full bg-[#2D6A4F] hover:bg-[#245c43] text-white text-sm font-medium disabled:opacity-60 transition-colors">
                {pickerMode === "view" ? (pickedDocId ? "View" : "View all") : "Continue"}
              </button>
            </div>
          </div>
        </div>
      )}

      {!showPicker && pickedDocId && userId && (
        <MilestoneCreateModal
          mouDocumentId={pickedDocId}
          orgA={orgMap[docsById[pickedDocId]?.org_a_id] ?? null}
          orgB={orgMap[docsById[pickedDocId]?.org_b_id] ?? null}
          isBinding={docsById[pickedDocId] ? isBindingDoc(docsById[pickedDocId]) : true}
          myUserId={userId}
          onClose={() => setPickedDocId("")}
          onCreated={load}
        />
      )}

      {selectedMilestone && userId && (
        <MilestoneDetailModal
          milestone={selectedMilestone}
          orgA={orgsForMilestone(selectedMilestone).orgA}
          orgB={orgsForMilestone(selectedMilestone).orgB}
          myUserId={userId}
          onClose={() => setSelectedMilestone(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}