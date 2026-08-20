import { useEffect, useState, useMemo } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { Loader2, FileText, PenLine, Upload, Plus, X, Trash2, Target, Search, ListFilter } from "lucide-react";
import CreateMouModal from "./CreateMouModal";
import MouDocumentDetail from "./MouDocumentDetail";
import { resolveMouDocTitle } from "@/lib/mouTitle";

interface MouDocRow {
  id: string;
  org_a_id: string;
  org_b_id: string;
  initiative_id: string | null;
  connection_id: string | null;
  source_type: string;
  status: string;
  updated_at: string;
  toggle_selections: Record<string, string | boolean> | null;
  field_flags: { raised_by: "org_a" | "org_b"; resolved: boolean }[] | null;
  details_completed_by_org_a: boolean;
  signature_locked_org_a: boolean;
  signature_locked_org_b: boolean;
  signed_files: Record<string, string> | null;
  org_b_finalization_confirmed: boolean;
  partnership_status_confirmed: boolean;
  details_completed_at_org_a: string | null;
  org_b_submitted_at: string | null;
  org_b_confirmed_at: string | null;
  fully_executed_at: string | null;
  partnership_status_confirmed_at: string | null;
}
interface OrgLite {
  id: string;
  organisation_name: string;
  user_id: string;
  partnership_sought?: string | null;
}
interface PartnerOption {
  orgId: string;
  userId: string;
  name: string;
  initiativeId: string | null;
  initiativeTitle: string;
  connectionId: string | null;
}

const SOURCE_META: Record<string, { label: string; icon: typeof FileText }> = {
  template: { label: "Template", icon: FileText },
  custom: { label: "Custom", icon: PenLine },
  uploaded_pdf: { label: "Uploaded", icon: Upload },
};

function computeStageCompletion(d: MouDocRow): boolean[] {
  const flags = d.field_flags ?? [];
  const hasUnresolvedOrgBFlags = flags.some((f) => !f.resolved && f.raised_by === "org_b");
  const isBindingMou = d.toggle_selections?.["agreement_type"] === "binding";
  const orgBSubmittedForReview = d.status === "pending_org_a_final_review" || d.status === "fully_executed";
  const completed: boolean[] = [];
  if (d.source_type === "template") {
    completed.push(d.details_completed_by_org_a && !hasUnresolvedOrgBFlags);
    completed.push(orgBSubmittedForReview);
  } else if (d.source_type === "uploaded_pdf") {
    completed.push(!!d.signed_files?.[d.org_a_id]);
    completed.push(!!d.signed_files?.[d.org_b_id]);
  } else {
    completed.push(d.signature_locked_org_a);
    completed.push(d.signature_locked_org_b);
  }
  if (isBindingMou) completed.push(d.org_b_finalization_confirmed);
  completed.push(d.status === "fully_executed");
  completed.push(d.partnership_status_confirmed);
  return completed;
}

function computeStages(d: MouDocRow, orgAName: string, orgBName: string): { key: string; label: string; completed: boolean }[] {
  const flags = d.field_flags ?? [];
  const hasUnresolvedOrgBFlags = flags.some((f) => !f.resolved && f.raised_by === "org_b");
  const isBindingMou = d.toggle_selections?.["agreement_type"] === "binding";
  const orgBSubmittedForReview = d.status === "pending_org_a_final_review" || d.status === "fully_executed";
  const stages: { key: string; label: string; completed: boolean }[] = [];
  if (d.source_type === "template") {
    stages.push({ key: "org_a_prepare", label: `${orgAName} fills in and signs`, completed: d.details_completed_by_org_a && !hasUnresolvedOrgBFlags });
    stages.push({ key: "org_b_review", label: `${orgBName} reviews and signs`, completed: orgBSubmittedForReview });
  } else if (d.source_type === "uploaded_pdf") {
    stages.push({ key: "org_a_sign", label: `${orgAName} uploads signed copy`, completed: !!d.signed_files?.[d.org_a_id] });
    stages.push({ key: "org_b_sign", label: `${orgBName} uploads signed copy`, completed: !!d.signed_files?.[d.org_b_id] });
  } else {
    stages.push({ key: "org_a_sign", label: `${orgAName} signs`, completed: d.signature_locked_org_a });
    stages.push({ key: "org_b_sign", label: `${orgBName} signs`, completed: d.signature_locked_org_b });
  }
  if (isBindingMou) {
    stages.push({ key: "org_b_confirm", label: `${orgBName} confirms no objection`, completed: d.org_b_finalization_confirmed });
  }
  stages.push({ key: "org_a_finalize", label: `${orgAName} finalises`, completed: d.status === "fully_executed" });
  stages.push({ key: "mark_partnership", label: "Mark partnership executed", completed: d.partnership_status_confirmed });
  return stages;
}

export default function MouTab() {
  const { user } = useAuth();
  const userId = user?.id;
  const [location, navigate] = useLocation();
  const [loading, setLoading] = useState(true);
  const [myOrgId, setMyOrgId] = useState<string | null>(null);
  const [docs, setDocs] = useState<MouDocRow[]>([]);
  const [orgMap, setOrgMap] = useState<Record<string, OrgLite>>({});
  const [openDocId, setOpenDocId] = useState<string | null>(null);
  const [initiativeTitleMap, setInitiativeTitleMap] = useState<Record<string, string>>({});
  const [showPicker, setShowPicker] = useState(false);
  const [partnerOptions, setPartnerOptions] = useState<PartnerOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "in_progress" | "fully_executed">("all");
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string> | null>(null);
  const [showSelectPicker, setShowSelectPicker] = useState(false);
  const [selectPickerSearch, setSelectPickerSearch] = useState("");
  const [tempSelectedIds, setTempSelectedIds] = useState<Set<string>>(new Set());
  const [mouTarget, setMouTarget] = useState<{
    partnerUserId?: string; partnerOrgId?: string; partnerName: string; initiativeId: string | null; initiativeTitle: string; connectionId: string | null;
  } | null>(null);

  useEffect(() => { if (userId) load(); }, [userId]);

  useEffect(() => {
    const params = new URLSearchParams(location.includes("?") ? location.split("?")[1] : "");
    const newForOrgId = params.get("newForOrgId");
    const newForUserId = params.get("newForUserId");
    if (newForOrgId || newForUserId) {
      setMouTarget({
        partnerOrgId: newForOrgId ?? undefined,
        partnerUserId: newForUserId ?? undefined,
        partnerName: params.get("partnerName") ?? "Partner",
        initiativeId: params.get("initiativeId"),
        initiativeTitle: params.get("initiativeTitle") ?? "",
        connectionId: params.get("connectionId"),
      });
    }
  }, [location]);

  async function load() {
    if (!userId) return;
    setLoading(true);
    const { data: myOrg } = await supabase.from("organizations").select("id").eq("user_id", userId).maybeSingle();
    if (!myOrg) { setLoading(false); return; }
    setMyOrgId(myOrg.id);
    const { data: docRows } = await supabase
      .from("mou_documents")
      .select("id, org_a_id, org_b_id, initiative_id, connection_id, source_type, status, updated_at, toggle_selections, field_flags, details_completed_by_org_a, signature_locked_org_a, signature_locked_org_b, signed_files, org_b_finalization_confirmed, partnership_status_confirmed, details_completed_at_org_a, org_b_submitted_at, org_b_confirmed_at, fully_executed_at, partnership_status_confirmed_at")
      .or(`org_a_id.eq.${myOrg.id},org_b_id.eq.${myOrg.id}`)
      .order("updated_at", { ascending: false });
    const orgIds = [...new Set((docRows ?? []).flatMap((d) => [d.org_a_id, d.org_b_id]))];
    if (orgIds.length > 0) {
      const { data: orgs } = await supabase.from("organizations").select("id, organisation_name, user_id, partnership_sought").in("id", orgIds);
      const map: Record<string, OrgLite> = {};
      (orgs ?? []).forEach((o: any) => { map[o.id] = o; });
      setOrgMap(map);
    }
    const initIds = [...new Set((docRows ?? []).map((d) => d.initiative_id).filter((x): x is string => !!x))];
    if (initIds.length > 0) {
      const { data: inits } = await supabase.from("initiative_requests").select("id, title").in("id", initIds);
      const titleMap: Record<string, string> = {};
      (inits ?? []).forEach((i: any) => { titleMap[i.id] = i.title; });
      setInitiativeTitleMap(titleMap);
    }
    setDocs(docRows ?? []);
    setLoading(false);
  }

  async function openPicker() {
    setShowPicker(true);
    setLoadingOptions(true);
    if (!myOrgId || !userId) { setLoadingOptions(false); return; }
    const [{ data: myInits }, { data: inboundFormed }, { data: myOrgListing }] = await Promise.all([
      supabase.from("initiative_requests").select("id, title, confirmed_partners").eq("user_id", userId).not("confirmed_partners", "is", null),
      supabase.from("partnership_connections").select("id, sender_org_id, partnership_title").eq("receiver_org_id", myOrgId).eq("status", "formed"),
      supabase.from("organizations").select("partnership_sought").eq("id", myOrgId).maybeSingle(),
    ]);
    const options: PartnerOption[] = [];
    const seenOrgIds = new Set<string>();
    for (const ini of myInits ?? []) {
      const confirmed = ((ini.confirmed_partners as any[]) ?? []).filter((p) => (p.status ?? "confirmed") === "confirmed" || p.status === "mou_executed");
      for (const p of confirmed) {
        options.push({ orgId: "", userId: p.user_id, name: p.name, initiativeId: ini.id, initiativeTitle: ini.title, connectionId: null });
      }
    }
    const connOrgIds = (inboundFormed ?? []).map((c: any) => c.sender_org_id);
    if (connOrgIds.length > 0) {
      const { data: connOrgs } = await supabase.from("organizations").select("id, organisation_name, user_id").in("id", connOrgIds);
      const connOrgMap = new Map((connOrgs ?? []).map((o: any) => [o.id, o]));
      for (const c of inboundFormed ?? []) {
        const org = connOrgMap.get(c.sender_org_id);
        if (org && !seenOrgIds.has(org.id)) {
          seenOrgIds.add(org.id);
          const subtitle = resolveMouDocTitle(
            { initiative_id: null, connection_id: c.id, org_a_id: myOrgId },
            { [myOrgId]: { id: myOrgId, partnership_sought: myOrgListing?.partnership_sought ?? null } },
            {}
          ) ?? "Direct partnership";
          options.push({ orgId: org.id, userId: org.user_id, name: org.organisation_name, initiativeId: null, initiativeTitle: subtitle, connectionId: c.id });
        }
      }
    }
    setPartnerOptions(options);
    setLoadingOptions(false);
  }

  function otherOrg(doc: MouDocRow): OrgLite | undefined {
    const otherId = doc.org_a_id === myOrgId ? doc.org_b_id : doc.org_a_id;
    return orgMap[otherId];
  }

  const filteredDocs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return docs.filter((d) => {
      if (selectedDocIds && !selectedDocIds.has(d.id)) return false;
      if (statusFilter === "draft" && d.status !== "draft") return false;
      if (statusFilter === "fully_executed" && d.status !== "fully_executed") return false;
      if (statusFilter === "in_progress" && (d.status === "draft" || d.status === "fully_executed")) return false;
      if (!q) return true;
      const partnerName = otherOrg(d)?.organisation_name ?? "";
      const title = resolveMouDocTitle(d, orgMap, initiativeTitleMap) ?? "";
      return partnerName.toLowerCase().includes(q) || title.toLowerCase().includes(q);
    });
  }, [docs, searchQuery, statusFilter, selectedDocIds, orgMap, initiativeTitleMap, myOrgId]);

  const selectPickerOptions = useMemo(() => {
    const q = selectPickerSearch.trim().toLowerCase();
    return docs
      .map((d) => ({ doc: d, partnerName: otherOrg(d)?.organisation_name ?? "Deleted organisation", title: resolveMouDocTitle(d, orgMap, initiativeTitleMap) }))
      .filter((o) => !q || o.partnerName.toLowerCase().includes(q) || (o.title ?? "").toLowerCase().includes(q))
      .sort((a, b) => a.partnerName.localeCompare(b.partnerName));
  }, [docs, orgMap, initiativeTitleMap, selectPickerSearch, myOrgId]);

  function openSelectPicker() {
    setTempSelectedIds(selectedDocIds ? new Set(selectedDocIds) : new Set());
    setSelectPickerSearch("");
    setShowSelectPicker(true);
  }

  async function deleteDraft(id: string) {
    setDeletingId(id);
    const { error } = await supabase.from("mou_documents").delete().eq("id", id).eq("status", "draft");
    setDeletingId(null);
    setConfirmDeleteId(null);
    if (error) return;
    setDocs((prev) => prev.filter((d) => d.id !== id));
  }

  if (loading || !userId) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 text-[#2D6A4F] animate-spin" />
      </div>
    );
  }

  if (openDocId) {
    return (
      <MouDocumentDetail documentId={openDocId} myUserId={userId} onClose={() => { setOpenDocId(null); load(); }} />
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-0 -mx-4 sm:-mx-6">

      {/* Top bar — New MoU button */}
      <div className="flex items-center justify-end px-4 sm:px-6 pb-4">
        <button type="button" onClick={openPicker}
          className="flex items-center gap-1.5 h-10 px-5 rounded-full text-white text-sm font-bold transition-all hover:brightness-110 active:scale-[0.98] shrink-0"
          style={{ background: "linear-gradient(135deg, #3D2618 0%, #33301F 50%, #1B3328 100%)" }}>
          <Plus className="w-4 h-4" /> New MoU
        </button>
      </div>

      {/* Stat cards — original 3-column grid */}
      <div className="grid grid-cols-3 gap-3 px-4 sm:px-6 pb-5 sm:max-w-md">
        <div className="rounded-xl p-3.5 bg-muted border border-border">
          <p className="text-lg font-black text-foreground leading-none">{docs.length}</p>
          <p className="text-[10px] font-bold uppercase tracking-wide text-foreground mt-1.5">Total</p>
        </div>
        <div className="rounded-xl p-3.5 bg-muted border border-border">
          <p className="text-lg font-black text-[#C45C26] leading-none">
            {docs.filter((d) => d.status !== "draft" && d.status !== "fully_executed").length}
          </p>
          <p className="text-[10px] font-bold uppercase tracking-wide text-foreground mt-1.5">In progress</p>
        </div>
        <div className="rounded-xl p-3.5 bg-muted border border-border">
          <p className="text-lg font-black text-[#2D6A4F] leading-none">
            {docs.filter((d) => d.status === "fully_executed").length}
          </p>
          <p className="text-[10px] font-bold uppercase tracking-wide text-foreground mt-1.5">Executed</p>
        </div>
      </div>

      {/* Filters — sit beneath stat cards */}
      {docs.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-4 sm:px-6 pb-5">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input type="text" placeholder="Search partner or title" value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/20 transition-colors" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none">
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="in_progress">In progress</option>
            <option value="fully_executed">Fully executed</option>
          </select>
          <button type="button" onClick={openSelectPicker}
            className="flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border text-sm text-foreground hover:border-[#2D6A4F]/40 transition-colors shrink-0">
            <ListFilter className="w-3.5 h-3.5" />
            {selectedDocIds ? `${selectedDocIds.size} selected` : "Select MoUs"}
          </button>
          {selectedDocIds && (
            <button type="button" onClick={() => setSelectedDocIds(null)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0">
              Clear
            </button>
          )}
        </div>
      )}

      {/* Full-width top divider — cream light / black dark */}
      <div className="h-2 w-full bg-[#F5F0E8] dark:bg-black" />

      {docs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center px-4 sm:px-6">
          <FileText className="w-8 h-8 text-muted-foreground/40" />
          <div>
            <p className="text-sm font-semibold text-foreground mb-1">No MoUs yet</p>
            <p className="text-xs text-muted-foreground max-w-sm">
              Start one from a confirmed partnership or initiative, or create one here.
            </p>
          </div>
        </div>
      ) : (
        <>
          {filteredDocs.length === 0 && (
            <p className="text-sm text-muted-foreground px-4 sm:px-6 py-6">No MoUs match your search.</p>
          )}

          {filteredDocs.map((d) => {
            const sourceMeta = SOURCE_META[d.source_type] ?? { label: d.source_type, icon: FileText };
            const SourceIcon = sourceMeta.icon;
            const title = resolveMouDocTitle(d, orgMap, initiativeTitleMap);
            const orgAName = orgMap[d.org_a_id]?.organisation_name ?? "Org A";
            const orgBName = orgMap[d.org_b_id]?.organisation_name ?? "Org B";
            const stages = computeStages(d, orgAName, orgBName);
            const isDraft = d.status === "draft";
            const isExecuted = d.status === "fully_executed";
            const nextStageIndex = stages.findIndex((s) => !s.completed);
            const STAGE_H = 36;

            return (
              <div key={d.id}>
                <div
                  role="button" tabIndex={0}
                  onClick={() => setOpenDocId(d.id)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpenDocId(d.id); } }}
                  className="flex items-stretch w-full cursor-pointer hover:bg-muted/30 transition-colors">

                  {/* Left — org info, capped at 42% so tracker shifts inward */}
                  <div className="min-w-0 px-4 sm:px-6 py-9 flex flex-col justify-center gap-3" style={{ width: "42%" }}>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <div className="p-1.5 rounded-lg bg-[#2D6A4F]/10 shrink-0">
                        <SourceIcon className="w-3.5 h-3.5 text-[#2D6A4F]" />
                      </div>
                      <p className="text-[15px] font-bold text-foreground">
                        {otherOrg(d)?.organisation_name ?? "Deleted organisation"}
                      </p>
                      {isDraft ? (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border border-border text-foreground">Draft</span>
                      ) : isExecuted ? (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: "rgba(45,106,79,0.12)", color: "#2D6A4F" }}>Fully executed</span>
                      ) : (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: "rgba(196,92,38,0.10)", color: "#C45C26" }}>In progress</span>
                      )}
                    </div>

                    {/* Title wraps — no date here, date is in tracker */}
                    <p className="text-[13px] text-foreground leading-relaxed">
                      {title || sourceMeta.label}
                    </p>

                    {/* Milestones / delete — pushed well down */}
                    <div className="flex items-center gap-2 mt-5" onClick={(e) => e.stopPropagation()}>
                      {isExecuted && (
                        <button type="button"
                          onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/portfolio/milestones?mouId=${d.id}`); }}
                          className="flex items-center gap-1.5 h-9 px-5 rounded-full border border-border text-[13px] font-medium text-foreground transition-all hover:border-[#2D6A4F]/50 hover:-translate-y-px active:translate-y-0"
                          style={{ boxShadow: "0 2px 4px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)" }}>
                          <Target className="w-3.5 h-3.5" /> Milestones
                        </button>
                      )}
                      {isDraft && (
                        <button type="button"
                          onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(d.id); }}
                          aria-label="Delete draft MoU"
                          className="flex items-center gap-1.5 h-9 px-4 rounded-full border border-border text-[13px] text-muted-foreground hover:text-red-600 hover:border-red-300 transition-all"
                          style={{ boxShadow: "0 2px 4px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)" }}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Vertical separator */}
                  <div className="w-px bg-border shrink-0" />

                  {/* Right — tracker takes remaining space */}
                  <div className="flex-1 min-w-0 px-6 py-9 flex items-start">
                    {isDraft ? (
                      <p className="text-[13px] text-muted-foreground italic mt-1">
                        Open to start filling in details.
                      </p>
                    ) : (
                      <div className="flex gap-3 w-full">
                        {/* Dot + line rail */}
                        <div className="flex flex-col items-center shrink-0">
                          {stages.map((s, i) => (
                            <div key={s.key} className="flex flex-col items-center" style={{ height: STAGE_H }}>
                              <div className="flex-1 w-px"
                                style={{ background: i === 0 ? "transparent" : (stages[i-1]?.completed && s.completed ? "#2D6A4F" : "var(--border)") }} />
                              <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                                s.completed ? "bg-[#2D6A4F]" : "border-2 border-border bg-background"
                              }`} />
                              <div className="flex-1 w-px"
                                style={{ background: i === stages.length - 1 ? "transparent" : (s.completed ? "#2D6A4F" : "var(--border)") }} />
                            </div>
                          ))}
                        </div>

                        {/* Labels + status word */}
                        <div className="flex-1 min-w-0 flex flex-col">
                          {stages.map((s, i) => {
                            const isNext = i === nextStageIndex;
                            return (
                              <div key={s.key} className="flex items-center justify-between gap-3" style={{ height: STAGE_H }}>
                                <span className={`text-[12px] leading-snug ${
                                  s.completed ? "text-foreground font-medium" :
                                  isNext ? "text-foreground" : "text-muted-foreground"
                                }`}>{s.label}</span>
                                <span className={`text-[11px] font-semibold shrink-0 ${
                                  s.completed ? "text-[#2D6A4F]" :
                                  isNext ? "text-[#C45C26]" : "text-muted-foreground"
                                }`}>{s.completed ? "Done" : isNext ? "Next" : "—"}</span>
                              </div>
                            );
                          })}
                        </div>

                        {/* Date column — one per stage row, charcoal, separated by thin left border */}
                        <div className="flex flex-col shrink-0 pl-4 border-l border-border">
                          {stages.map((s) => {
                            const stageDate: string | null = s.completed ? (() => {
                              switch (s.key) {
                                case "org_a_prepare": return d.details_completed_at_org_a;
                                case "org_b_review":  return d.org_b_submitted_at;
                                case "org_b_confirm": return d.org_b_confirmed_at;
                                case "org_a_sign":    return d.updated_at; // uploaded_pdf: no per-stage ts
                                case "org_b_sign":    return d.fully_executed_at ?? d.updated_at;
                                case "org_a_finalize":return d.fully_executed_at;
                                case "mark_partnership": return d.partnership_status_confirmed_at;
                                default: return d.updated_at;
                              }
                            })() : null;
                            return (
                              <div key={s.key} className="flex items-center" style={{ height: STAGE_H }}>
                                <span className="text-[11px] text-foreground whitespace-nowrap">
                                  {stageDate
                                    ? new Date(stageDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
                                    : "—"}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 8px divider — cream light / black dark */}
                <div className="h-2 w-full bg-[#F5F0E8] dark:bg-black" />
              </div>
            );
          })}
        </>
      )}

      {/* Select MoUs picker modal */}
      {showSelectPicker && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setShowSelectPicker(false)}>
          <div className="bg-white dark:bg-card rounded-t-2xl sm:rounded-2xl border border-border w-full sm:max-w-md shadow-xl max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="text-lg font-bold text-foreground">Choose MoUs to view</h3>
              <button type="button" onClick={() => setShowSelectPicker(false)}>
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <div className="px-5 pt-3">
              <input type="text" placeholder="Search partner or title" value={selectPickerSearch}
                onChange={(e) => setSelectPickerSearch(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none" />
            </div>
            <div className="px-5 py-2.5 flex items-center gap-3 text-xs">
              <button type="button" onClick={() => setTempSelectedIds(new Set(selectPickerOptions.map((o) => o.doc.id)))}
                className="text-[#2D6A4F] font-semibold hover:underline">
                Select all
              </button>
              <button type="button" onClick={() => setTempSelectedIds(new Set())}
                className="text-muted-foreground hover:underline">
                Clear
              </button>
            </div>
            <div className="px-5 pb-3 overflow-y-auto space-y-1.5">
              {selectPickerOptions.length === 0 && (
                <p className="text-sm text-muted-foreground">No MoUs yet.</p>
              )}
              {selectPickerOptions.map(({ doc, partnerName, title }) => {
                const checked = tempSelectedIds.has(doc.id);
                return (
                  <label key={doc.id}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                      checked ? "border-[#2D6A4F] bg-[#2D6A4F]/[0.06]" : "border-border hover:border-[#2D6A4F]/40"
                    }`}>
                    <input type="checkbox" checked={checked}
                      onChange={(e) => {
                        setTempSelectedIds((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(doc.id); else next.delete(doc.id);
                          return next;
                        });
                      }}
                      className="shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{partnerName}</p>
                      {title && <p className="text-xs text-muted-foreground truncate">{title}</p>}
                    </div>
                  </label>
                );
              })}
            </div>
            <div className="flex gap-2 px-5 py-4 border-t border-border">
              <button type="button" onClick={() => setShowSelectPicker(false)}
                className="flex-1 h-10 rounded-full border border-border text-sm text-muted-foreground hover:text-foreground transition-colors">
                Cancel
              </button>
              <button type="button"
                onClick={() => {
                  setSelectedDocIds(tempSelectedIds.size > 0 ? new Set(tempSelectedIds) : null);
                  setShowSelectPicker(false);
                }}
                className="flex-1 h-10 rounded-full bg-[#2D6A4F] hover:bg-[#245c43] text-white text-sm font-medium transition-colors">
                {tempSelectedIds.size > 0 ? `Show ${tempSelectedIds.size} selected` : "Show all"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Partner picker modal */}
      {showPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setShowPicker(false)}>
          <div className="bg-white dark:bg-card rounded-2xl border border-border w-full max-w-md shadow-xl max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="text-lg font-bold text-foreground">Choose a partner</h3>
              <button type="button" onClick={() => setShowPicker(false)}>
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <div className="px-5 py-4 overflow-y-auto space-y-2">
              {loadingOptions ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 text-[#2D6A4F] animate-spin" />
                </div>
              ) : partnerOptions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No confirmed partners yet. Confirm a partnership first, then come back here.
                </p>
              ) : (
                partnerOptions.map((opt, i) => (
                  <button key={i} type="button"
                    onClick={() => {
                      setMouTarget({
                        partnerUserId: opt.userId, partnerOrgId: opt.orgId || undefined,
                        partnerName: opt.name, initiativeId: opt.initiativeId, initiativeTitle: opt.initiativeTitle,
                        connectionId: opt.connectionId,
                      });
                      setShowPicker(false);
                    }}
                    className="w-full text-left px-4 py-3 rounded-xl border border-border hover:border-[#2D6A4F]/50 transition-colors">
                    <p className="text-sm font-medium text-foreground">{opt.name}</p>
                    {opt.initiativeTitle && <p className="text-xs text-muted-foreground mt-0.5">{opt.initiativeTitle}</p>}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create MoU modal */}
      {mouTarget && (
        <CreateMouModal
          myUserId={userId}
          partnerUserId={mouTarget.partnerUserId}
          partnerOrgId={mouTarget.partnerOrgId}
          partnerName={mouTarget.partnerName}
          initiativeId={mouTarget.initiativeId}
          initiativeTitle={mouTarget.initiativeTitle}
          connectionId={mouTarget.connectionId}
          onClose={() => { setMouTarget(null); load(); }}
          onOpenDocument={(documentId) => {
            setMouTarget(null);
            setOpenDocId(documentId);
            load();
          }}
        />
      )}

      {/* Delete confirm modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setConfirmDeleteId(null)}>
          <div className="bg-white dark:bg-card rounded-2xl border border-border w-full max-w-sm shadow-xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}>
            <p className="text-base font-bold text-foreground">Delete this draft?</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              This permanently deletes the draft MoU. This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setConfirmDeleteId(null)}
                className="flex-1 h-10 rounded-full border border-border text-sm text-muted-foreground hover:text-foreground transition-colors">
                Cancel
              </button>
              <button type="button" onClick={() => deleteDraft(confirmDeleteId)} disabled={deletingId === confirmDeleteId}
                className="flex-1 h-10 rounded-full bg-red-600 hover:bg-red-700 text-white text-sm font-medium disabled:opacity-60 transition-colors">
                {deletingId === confirmDeleteId ? "Deleting..." : "Yes, delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}