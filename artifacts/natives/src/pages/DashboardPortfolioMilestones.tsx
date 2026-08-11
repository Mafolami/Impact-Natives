import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { Loader2, Plus } from "lucide-react";
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
}

export default function DashboardPortfolioMilestones() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [loading, setLoading] = useState(true);
  const [myOrgId, setMyOrgId] = useState<string | null>(null);
  const [docs, setDocs] = useState<ExecutedDoc[]>([]);
  const [orgMap, setOrgMap] = useState<Record<string, OrgRef>>({});
  const [milestones, setMilestones] = useState<MouMilestone[]>([]);

  const [filterPartner, setFilterPartner] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const [showPicker, setShowPicker] = useState(false);
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
      .select("id, org_a_id, org_b_id")
      .or(`org_a_id.eq.${myOrg.id},org_b_id.eq.${myOrg.id}`)
      .eq("status", "fully_executed");
    setDocs((docRows as ExecutedDoc[]) ?? []);

    const orgIds = [...new Set((docRows ?? []).flatMap((d: any) => [d.org_a_id, d.org_b_id]))];
    if (orgIds.length > 0) {
      const { data: orgs } = await supabase.from("organizations").select("id, user_id, organisation_name").in("id", orgIds);
      const map: Record<string, OrgRef> = {};
      (orgs ?? []).forEach((o: any) => { map[o.id] = o; });
      setOrgMap(map);
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
      if (filterStatus !== "all" && m.status !== filterStatus) return false;
      if (filterPartner !== "all") {
        const doc = docsById[m.mou_document_id];
        if (!doc || partnerOrgIdFor(doc) !== filterPartner) return false;
      }
      return true;
    });
  }, [milestones, filterStatus, filterPartner, docsById, myOrgId]);

  const stats = useMemo(() => {
    const totalCommitted = milestones.reduce((sum, m) => sum + (m.linked_amount ?? 0), 0);
    const disbursed = milestones.filter((m) => m.status === "disbursed").reduce((sum, m) => sum + (m.linked_amount ?? 0), 0);
    const overdue = milestones.filter((m) => isMilestoneOverdue(m)).length;
    const onTrack = milestones.filter((m) => !isMilestoneOverdue(m) && m.status !== "disbursed").length;
    return { totalCommitted, disbursed, overdue, onTrack };
  }, [milestones]);

  const columns: { key: string; label: string; predicate: (m: MouMilestone) => boolean }[] = [
    { key: "pending", label: "Pending", predicate: (m) => m.status === "pending" || m.status === "revision_requested" },
    { key: "in_review", label: "In review", predicate: (m) => m.status === "in_review" },
    { key: "verified", label: "Verified", predicate: (m) => m.status === "verified" },
    { key: "disbursed", label: "Disbursed", predicate: (m) => m.status === "disbursed" },
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

  return (
    <div className="space-y-6">
      {/* Summary */}
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

      {milestones.length === 0 ? (
        <p className="text-sm text-black dark:text-white">
          No milestones yet. Add one from an executed MoU, or from here once you have at least one.
        </p>
      ) : (
        <>
          {/* Filters */}
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
            <div className="flex-1" />
            <button type="button" onClick={() => setShowPicker(true)}
              className="flex items-center gap-1.5 h-9 px-4 rounded-full bg-[#2D6A4F] hover:bg-[#245c43] text-white text-sm font-medium transition-colors">
              <Plus className="w-4 h-4" /> New milestone
            </button>
          </div>

          {/* Board */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {columns.map((col) => {
              const items = filtered.filter(col.predicate);
              return (
                <div key={col.key} className="space-y-2">
                  <p className="text-xs font-medium text-black dark:text-white">{col.label} &middot; {items.length}</p>
                  {items.map((m) => (
                    <MilestoneCard key={m.id} milestone={m} onClick={() => setSelectedMilestone(m)} />
                  ))}
                </div>
              );
            })}
          </div>
        </>
      )}

      {showPicker && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowPicker(false)}>
          <div className="bg-white dark:bg-card rounded-t-2xl sm:rounded-2xl border border-border w-full sm:max-w-sm shadow-xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}>
            <p className="text-base font-bold text-black dark:text-white">Which agreement is this for?</p>
            {docs.length === 0 ? (
              <p className="text-sm text-black dark:text-white">No executed MoUs yet -- milestones can only be added once an agreement is fully executed.</p>
            ) : (
              <select value={pickedDocId} onChange={(e) => setPickedDocId(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-border bg-transparent text-sm text-black dark:text-white">
                <option value="">Select an MoU...</option>
                {docs.map((d) => (
                  <option key={d.id} value={d.id}>
                    {orgMap[partnerOrgIdFor(d)]?.organisation_name ?? "Partner"}
                  </option>
                ))}
              </select>
            )}
            <div className="flex gap-2">
              <button type="button" onClick={() => { setShowPicker(false); setPickedDocId(""); }}
                className="flex-1 h-10 rounded-full border border-border text-sm text-black dark:text-white hover:border-foreground/30 transition-colors">
                Cancel
              </button>
              <button type="button" disabled={!pickedDocId}
                onClick={() => setShowPicker(false)}
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
