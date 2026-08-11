import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { Loader2, Plus, X, Clock, Eye, CheckCircle2, PartyPopper } from "lucide-react";
import {
  MouMilestone, OrgRef, isMilestoneOverdue,
} from "@/lib/milestones";
import MilestoneCard from "@/components/mou/MilestoneCard";
import MilestoneCreateModal from "@/components/mou/MilestoneCreateModal";
import MilestoneDetailModal from "@/components/mou/MilestoneDetailModal";

interface ExecutedDoc {
  id: string;
  org_a_id: string;
  org_b_id: string;
  initiative_id: string | null;
  connection_id: string | null;
}

export default function DashboardPortfolioMilestones() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [location, navigate] = useLocation();

  const [loading, setLoading] = useState(true);
  const [myOrgId, setMyOrgId] = useState<string | null>(null);
  const [docs, setDocs] = useState<ExecutedDoc[]>([]);
  const [orgMap, setOrgMap] = useState<Record<string, OrgRef>>({});
  const [initiativeTitleMap, setInitiativeTitleMap] = useState<Record<string, string>>({});
  const [milestones, setMilestones] = useState<MouMilestone[]>([]);

  const [filterPartner, setFilterPartner] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Arriving from a specific MoU's "Milestones" card button -- ?mouId=...
  const [scopedDocId, setScopedDocId] = useState<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(location.includes("?") ? location.split("?")[1] : "");
    setScopedDocId(params.get("mouId"));
  }, [location]);

  const [showPicker, setShowPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickedDocId, setPickedDocId] = useState<string>("");
  const [selectedMilestone, setSelectedMilestone] = useState<MouMilestone | null>(null);

  useEffect(() => { load(); }, [userId]);

  async function load() {
    if (!userId) return;
    setLoading(true);
    const { data: myOrg } = await supabase.from("organizations").select("id").eq("user_id", userId).maybeSingle();
    if (!myOrg) { setLoading(false); return; }
    setMyOrgId(myOrg.id);

    const { data: docRows } = await supabase
      .from("mou_documents")
      .select("id, org_a_id, org_b_id, initiative_id, connection_id")
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
    if (doc.initiative_id) return initiativeTitleMap[doc.initiative_id] ?? null;
    if (doc.connection_id) return orgMap[doc.org_a_id]?.partnership_sought ?? null;
    return null;
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

  const partnerOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts: { id: string; name: string }[] = [];
    docs.forEach((d) => {
      const pid = partnerOrgIdFor(d);
      if (!seen.has(pid)) {
        seen.add(pid);
        opts.push({ id: pid, name: orgMap[pid]?.organisation_name ?? "Partner" });
      }
    });
    return opts;
  }, [docs, orgMap, myOrgId]);

  const filtered = useMemo(() => {
    return milestones.filter((m) => {
      if (scopedDocId) return m.mou_document_id === scopedDocId;
      if (filterStatus !== "all" && m.status !== filterStatus) return false;
      if (filterPartner !== "all") {
        const doc = docsById[m.mou_document_id];
        if (!doc || partnerOrgIdFor(doc) !== filterPartner) return false;
      }
      return true;
    });
  }, [milestones, filterStatus, filterPartner, docsById, myOrgId, scopedDocId]);

  const stats = useMemo(() => {
    const totalCommitted = milestones.reduce((sum, m) => sum + (m.linked_amount ?? 0), 0);
    const disbursed = milestones.filter((m) => m.status === "disbursed").reduce((sum, m) => sum + (m.linked_amount ?? 0), 0);
    const overdue = milestones.filter((m) => isMilestoneOverdue(m)).length;
    const onTrack = milestones.filter((m) => !isMilestoneOverdue(m) && m.status !== "disbursed").length;
    return { totalCommitted, disbursed, overdue, onTrack };
  }, [milestones]);

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

  return (
    <div className="space-y-6">
      {scopedDocId && (
        <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
          <p className="text-sm text-black dark:text-white">
            Viewing milestones for <span className="font-medium">{scopedPartnerName}</span>
          </p>
          <button type="button" onClick={() => navigate("/dashboard/portfolio/milestones")}
            className="flex items-center gap-1 text-sm text-black dark:text-white hover:underline">
            <X className="w-3.5 h-3.5" /> View all
          </button>
        </div>
      )}

      {/* Summary -- only meaningful across the whole portfolio, not one agreement */}
      {!scopedDocId && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl p-4 bg-white dark:bg-card border border-border">
            <p className="text-xs text-black dark:text-white mb-1">Total committed</p>
            <p className="text-xl font-medium text-black dark:text-white">{stats.totalCommitted.toLocaleString()}</p>
          </div>
          <div className="rounded-xl p-4 bg-white dark:bg-card border border-border">
            <p className="text-xs text-black dark:text-white mb-1">Disbursed</p>
            <p className="text-xl font-medium text-black dark:text-white">{stats.disbursed.toLocaleString()}</p>
          </div>
          <div className="rounded-xl p-4 bg-white dark:bg-card border border-border">
            <p className="text-xs text-black dark:text-white mb-1">On track</p>
            <p className="text-xl font-medium text-black dark:text-white">{stats.onTrack}</p>
          </div>
          <div className="rounded-xl p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40">
            <p className="text-xs text-amber-600 dark:text-amber-500 mb-1">Overdue</p>
            <p className="text-xl font-medium text-amber-600 dark:text-amber-500">{stats.overdue}</p>
          </div>
        </div>
      )}

      {!scopedDocId && (
        <div className="flex justify-end">
          <button type="button" onClick={() => setShowPicker(true)}
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
          {/* Filters -- pointless on an empty list, and redundant once scoped to one MoU */}
          {!scopedDocId && (
            <div className="flex flex-wrap items-center gap-2">
              <select value={filterPartner} onChange={(e) => setFilterPartner(e.target.value)}
                className="h-9 px-3 rounded-lg border border-border bg-transparent text-sm text-black dark:text-white">
                <option value="all">All partners</option>
                {partnerOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
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
          )}

          {/* Scoped view: a flat list is enough for one agreement's milestones */}
          {scopedDocId ? (
            <div className="space-y-2">
              {filtered.map((m) => (
                <MilestoneCard key={m.id} milestone={m} onClick={() => setSelectedMilestone(m)} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {columns.map((col) => {
                const items = filtered.filter(col.predicate);
                const Icon = col.icon;
                return (
                  <div key={col.key} className={`rounded-xl border ${col.border} overflow-hidden`}>
                    <div className={`flex items-center gap-2 px-3 py-2.5 border-b ${col.border} ${col.headerBg}`}>
                      <Icon className={`w-4 h-4 ${col.text}`} />
                      <p className={`text-sm font-semibold ${col.text}`}>{col.label}</p>
                      <span className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full border ${col.border} ${col.text} bg-white dark:bg-card`}>
                        {items.length}
                      </span>
                    </div>
                    <div className="p-3 space-y-2 bg-white dark:bg-card min-h-[64px]">
                      {items.length === 0 ? (
                        <p className="text-xs text-black dark:text-white">Nothing here.</p>
                      ) : (
                        items.map((m) => (
                          <MilestoneCard key={m.id} milestone={m} onClick={() => setSelectedMilestone(m)} />
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {showPicker && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowPicker(false)}>
          <div className="bg-white dark:bg-card rounded-t-2xl sm:rounded-2xl border border-border w-full sm:max-w-sm shadow-xl p-6 space-y-4 max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}>
            <p className="text-base font-bold text-black dark:text-white">Which agreement is this for?</p>
            {docs.length === 0 ? (
              <p className="text-sm text-black dark:text-white">No executed MoUs yet -- milestones can only be added once an agreement is fully executed.</p>
            ) : (
              <>
                <input type="text" placeholder="Search by partner or title" value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-transparent text-sm text-black dark:text-white" />
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
              <button type="button" disabled={!pickedDocId}
                onClick={() => { setShowPicker(false); setPickerSearch(""); }}
                className="flex-1 h-10 rounded-full bg-[#2D6A4F] hover:bg-[#245c43] text-white text-sm font-medium disabled:opacity-60 transition-colors">
                Continue
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
