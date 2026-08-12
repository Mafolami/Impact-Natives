import { useEffect, useState, useMemo } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { Loader2, FileText, PenLine, Upload, Plus, X, ArrowRight, Trash2, Target, Search, ListFilter } from "lucide-react";
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
// Same stage order as the detail page's tracker, reduced to a boolean per
// stage rather than labels -- powers the segmented progress bar on each
// card, a compact visual echo of the full tracker without opening the doc.
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
// Full stage list, same order and logic as the detail page's tracker --
// this now lives on the list item itself rather than the document form,
// so it needs real labels (not just completion booleans) to render.
function computeStages(d: MouDocRow, orgAName: string, orgBName: string): { key: string; label: string; completed: boolean }[] {
  const flags = d.field_flags ?? [];
  const hasUnresolvedOrgBFlags = flags.some((f) => !f.resolved && f.raised_by === "org_b");
  const isBindingMou = d.toggle_selections?.["agreement_type"] === "binding";
  const orgBSubmittedForReview = d.status === "pending_org_a_final_review" || d.status === "fully_executed";
  const stages: { key: string; label: string; completed: boolean }[] = [];
  if (d.source_type === "template") {
    stages.push({ key: "org_a_prepare", label: `${orgAName} fills in details and signs`, completed: d.details_completed_by_org_a && !hasUnresolvedOrgBFlags });
    stages.push({ key: "org_b_review", label: `${orgBName} reviews, fills in their details, and signs`, completed: orgBSubmittedForReview });
  } else if (d.source_type === "uploaded_pdf") {
    stages.push({ key: "org_a_sign", label: `${orgAName} uploads their signed copy`, completed: !!d.signed_files?.[d.org_a_id] });
    stages.push({ key: "org_b_sign", label: `${orgBName} uploads their signed copy`, completed: !!d.signed_files?.[d.org_b_id] });
  } else {
    stages.push({ key: "org_a_sign", label: `${orgAName} signs`, completed: d.signature_locked_org_a });
    stages.push({ key: "org_b_sign", label: `${orgBName} signs`, completed: d.signature_locked_org_b });
  }
  if (isBindingMou) {
    stages.push({ key: "org_b_confirm", label: `${orgBName} confirms no objection (binding agreement)`, completed: d.org_b_finalization_confirmed });
  }
  stages.push({ key: "org_a_finalize", label: `${orgAName} finalizes — fully executes the MoU`, completed: d.status === "fully_executed" });
  stages.push({ key: "mark_partnership", label: `${orgAName} marks the partnership as executed`, completed: d.partnership_status_confirmed });
  return stages;
}
function nextActionLabel(d: MouDocRow, orgAName: string, orgBName: string): { text: string; done: boolean } {
  const stages = computeStages(d, orgAName, orgBName);
  const current = stages.find((s) => !s.completed);
  if (!current) return { text: "Fully executed", done: true };
  return { text: `Next: ${current.label}`, done: d.status === "fully_executed" };
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
  // null = no manual selection active, show everything subject to
  // search/status. A non-null set scopes the list to exactly those docs,
  // for picking specific MoUs to view side by side instead of scrolling.
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string> | null>(null);
  const [showSelectPicker, setShowSelectPicker] = useState(false);
  const [selectPickerSearch, setSelectPickerSearch] = useState("");
  const [tempSelectedIds, setTempSelectedIds] = useState<Set<string>>(new Set());
  const [mouTarget, setMouTarget] = useState<{
    partnerUserId?: string; partnerOrgId?: string; partnerName: string; initiativeId: string | null; initiativeTitle: string; connectionId: string | null;
  } | null>(null);
  useEffect(() => { if (userId) load(); }, [userId]);
  // Arriving from another tab's "MoU" button — e.g. ?newForOrgId=... or ?newForUserId=...
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
      .select("id, org_a_id, org_b_id, initiative_id, connection_id, source_type, status, updated_at, toggle_selections, field_flags, details_completed_by_org_a, signature_locked_org_a, signature_locked_org_b, signed_files, org_b_finalization_confirmed, partnership_status_confirmed")
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
    // Combines both partnership models on the platform — initiative-based
    // confirmed EOI partners, and direct org-to-org formed connections —
    // into one picker, rather than requiring the person to already be on
    // one of the three source pages to start an MoU.
    // Only INBOUND connections are offered here, deliberately -- the
    // listing owner (receiver on the connection) is the only one who may
    // start the MoU, same rule as "initiative creator = org_a", now
    // enforced at the database level too. An outbound connection (I
    // expressed interest in someone else's listing) can never succeed if
    // offered here, so it's excluded rather than shown and left to fail.
    const [{ data: myInits }, { data: inboundFormed }, { data: myOrgListing }] = await Promise.all([
      supabase.from("initiative_requests").select("id, title, confirmed_partners").eq("user_id", userId).not("confirmed_partners", "is", null),
      supabase.from("partnership_connections").select("id, sender_org_id, partnership_title").eq("receiver_org_id", myOrgId).eq("status", "formed"),
      supabase.from("organizations").select("partnership_sought").eq("id", myOrgId).maybeSingle(),
    ]);
    const options: PartnerOption[] = [];
    const seenOrgIds = new Set<string>();
    for (const ini of myInits ?? []) {
      // "mou_executed" is a further stage past "confirmed", not a
      // rejection -- excluding it here would hide the partner-picker
      // option the moment their MoU actually finishes executing.
      const confirmed = ((ini.confirmed_partners as any[]) ?? []).filter((p) => (p.status ?? "confirmed") === "confirmed" || p.status === "mou_executed");
      for (const p of confirmed) {
        options.push({ orgId: "", userId: p.user_id, name: p.name, initiativeId: ini.id, initiativeTitle: ini.title, connectionId: null });
      }
    }
    const connOrgIds = (inboundFormed ?? []).map((c: any) => c.sender_org_id);
    if (connOrgIds.length > 0) {
      const { data: connOrgs } = await supabase.from("organizations").select("id, organisation_name, user_id").in("id", connOrgIds);
      const connOrgMap = new Map((connOrgs ?? []).map((o: any) => [o.id, o]));
      // Since every option here is inbound (they expressed interest in ME),
      // the listing this was about is always my own -- so org_a_id is
      // always myOrgId here. Resolved through the same resolveMouDocTitle
      // helper the rest of the app uses (rather than a separate ad-hoc
      // fallback chain), so this picker can't quietly drift out of sync
      // if that resolution logic ever changes.
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
      .map((d) => ({ doc: d, partnerName: otherOrg(d)?.organisation_name ?? "Unknown organisation", title: resolveMouDocTitle(d, orgMap, initiativeTitleMap) }))
      .filter((o) => !q || o.partnerName.toLowerCase().includes(q) || (o.title ?? "").toLowerCase().includes(q))
      .sort((a, b) => a.partnerName.localeCompare(b.partnerName));
  }, [docs, orgMap, initiativeTitleMap, selectPickerSearch, myOrgId]);
  function openSelectPicker() {
    setTempSelectedIds(selectedDocIds ? new Set(selectedDocIds) : new Set());
    setSelectPickerSearch("");
    setShowSelectPicker(true);
  }
  // RLS (mou_documents delete policy) already restricts this to draft
  // documents the caller's org participates in -- the .eq("status",
  // "draft") here is just defense in depth matching the button's own
  // draft-only visibility, not the actual enforcement.
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
  // MoU detail now renders as its own full page, matching every other
  // detail view in the app, instead of as a modal floating on top of the
  // list -- so opening a document replaces this view entirely.
  if (openDocId) {
    return (
      <MouDocumentDetail documentId={openDocId} myUserId={userId} onClose={() => { setOpenDocId(null); load(); }} />
    );
  }
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <button type="button" onClick={openPicker}
          className="flex items-center gap-1.5 h-10 px-5 rounded-full text-white text-sm font-bold transition-all hover:brightness-110 active:scale-[0.98] shrink-0"
          style={{ background: "linear-gradient(135deg, #3D2618 0%, #33301F 50%, #1B3328 100%)" }}>
          <Plus className="w-4 h-4" /> New MoU
        </button>
      </div>
      <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3 sm:max-w-md">
        <div className="rounded-xl p-3.5 bg-muted border border-border">
          <p className="text-lg font-black text-foreground leading-none">{docs.length}</p>
          <p className="text-[10px] font-bold uppercase tracking-wide text-black dark:text-white mt-1.5">Total</p>
        </div>
        <div className="rounded-xl p-3.5 bg-muted border border-border">
          <p className="text-lg font-black text-[#C45C26] leading-none">
            {docs.filter((d) => d.status !== "draft" && d.status !== "fully_executed").length}
          </p>
          <p className="text-[10px] font-bold uppercase tracking-wide text-black dark:text-white mt-1.5">In progress</p>
        </div>
        <div className="rounded-xl p-3.5 bg-muted border border-border">
          <p className="text-lg font-black text-[#2D6A4F] leading-none">
            {docs.filter((d) => d.status === "fully_executed").length}
          </p>
          <p className="text-[10px] font-bold uppercase tracking-wide text-black dark:text-white mt-1.5">Fully executed</p>
        </div>
      </div>
      {docs.length === 0 ? (
        <div className="rounded-2xl border border-border bg-white dark:bg-card p-12 text-center">
          <FileText className="w-8 h-8 text-black dark:text-white mx-auto mb-4" />
          <p className="text-base font-medium text-black dark:text-white mb-2">No MoUs yet.</p>
          <p className="text-sm text-black dark:text-white max-w-sm mx-auto">
            Start one from a confirmed partnership or initiative, or create one here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="w-4 h-4 text-black dark:text-white absolute left-3 top-1/2 -translate-y-1/2" />
              <input type="text" placeholder="Search partner or title" value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 pl-9 pr-3 rounded-lg border border-border bg-transparent text-sm text-black dark:text-white" />
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="h-9 px-3 rounded-lg border border-border bg-transparent text-sm text-black dark:text-white">
              <option value="all">All statuses</option>
              <option value="draft">Draft</option>
              <option value="in_progress">In progress</option>
              <option value="fully_executed">Fully executed</option>
            </select>
            <button type="button" onClick={openSelectPicker}
              className="flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border text-sm text-black dark:text-white hover:border-[#2D6A4F]/40 transition-colors shrink-0">
              <ListFilter className="w-3.5 h-3.5" /> {selectedDocIds ? `${selectedDocIds.size} selected` : "Select MoUs"}
            </button>
            {selectedDocIds && (
              <button type="button" onClick={() => setSelectedDocIds(null)}
                className="text-xs text-black dark:text-white hover:underline shrink-0">
                Clear
              </button>
            )}
          </div>
          {filteredDocs.length === 0 && (
            <p className="text-sm text-black dark:text-white">No MoUs match your search.</p>
          )}
          {filteredDocs.map((d) => {
            const sourceMeta = SOURCE_META[d.source_type] ?? { label: d.source_type, icon: FileText };
            const SourceIcon = sourceMeta.icon;
            const title = resolveMouDocTitle(d, orgMap, initiativeTitleMap);
            const orgAName = orgMap[d.org_a_id]?.organisation_name ?? "Org A";
            const orgBName = orgMap[d.org_b_id]?.organisation_name ?? "Org B";
            const stages = computeStages(d, orgAName, orgBName);
            const meta = d.status === "draft"
              ? { label: "Draft", color: "#C45C26" }
              : (() => {
                  const { text, done } = nextActionLabel(d, orgAName, orgBName);
                  return { label: text, color: done ? "#2D6A4F" : "#C45C26" };
                })();
            return (
              <div key={d.id} role="button" tabIndex={0}
                onClick={() => setOpenDocId(d.id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpenDocId(d.id); } }}
                className="w-full text-left rounded-2xl border border-border bg-white dark:bg-card p-6 hover:border-[#2D6A4F]/50 transition-colors flex flex-col gap-5 cursor-pointer">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="mt-0.5 p-2 rounded-lg bg-[#2D6A4F]/10 shrink-0">
                      <SourceIcon className="w-4 h-4 text-[#2D6A4F]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-black dark:text-white truncate">
                        {otherOrg(d)?.organisation_name ?? "Unknown organisation"}
                      </p>
                      <p className="text-sm text-black dark:text-white mt-0.5 truncate">
                        {title || sourceMeta.label}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full"
                      style={{ background: meta.color === "#2D6A4F" ? "rgba(45,106,79,0.12)" : "rgba(196,92,38,0.12)", color: meta.color }}>
                      {meta.label}
                    </span>
                    <span className="text-xs text-black dark:text-white whitespace-nowrap">
                      {new Date(d.updated_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                    {d.status === "draft" && (
                      <button type="button"
                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(d.id); }}
                        aria-label="Delete draft MoU"
                        className="p-1 -m-1 text-black dark:text-white hover:text-red-600 dark:hover:text-red-500 transition-colors shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <ArrowRight className="w-4 h-4 text-black dark:text-white shrink-0" />
                  </div>
                </div>
                {d.status !== "draft" && (
                  <div className="pt-4 border-t border-border">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-black dark:text-white mb-3">Signing progress</p>
                    <div className="flex items-start">
                      {stages.map((s, i) => (
                        <div key={s.key} className="flex items-center flex-1 last:flex-none">
                          <div className="flex flex-col items-center text-center gap-1.5 w-32 shrink-0">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                              s.completed ? "bg-[#2D6A4F]" : "border-2 border-border bg-white dark:bg-card"
                            }`}>
                              {s.completed && (
                                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              )}
                            </div>
                            <p className={`text-[11px] leading-snug text-black dark:text-white ${s.completed ? "font-semibold" : "font-normal"}`}>
                              {s.label}
                            </p>
                          </div>
                          {i < stages.length - 1 && <div className="flex-1 h-px bg-border mt-[9px] mx-1" />}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {d.status === "fully_executed" && (
                  <button type="button"
                    onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/portfolio/milestones?mouId=${d.id}`); }}
                    className="flex items-center justify-center gap-1.5 h-9 rounded-full border border-border text-sm text-black dark:text-white hover:border-[#2D6A4F]/40 transition-colors">
                    <Target className="w-3.5 h-3.5" /> Milestones
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
      {showSelectPicker && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowSelectPicker(false)}>
          <div className="bg-white dark:bg-card rounded-t-2xl sm:rounded-2xl border border-border w-full sm:max-w-md shadow-xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="text-lg font-bold text-black dark:text-white">Choose MoUs to view</h3>
              <button type="button" onClick={() => setShowSelectPicker(false)} className="text-black dark:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-5 pt-3">
              <input type="text" placeholder="Search partner or title" value={selectPickerSearch}
                onChange={(e) => setSelectPickerSearch(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-border bg-transparent text-sm text-black dark:text-white" />
            </div>
            <div className="px-5 py-2.5 flex items-center gap-3 text-xs">
              <button type="button" onClick={() => setTempSelectedIds(new Set(selectPickerOptions.map((o) => o.doc.id)))}
                className="text-[#2D6A4F] font-semibold hover:underline">
                Select all
              </button>
              <button type="button" onClick={() => setTempSelectedIds(new Set())}
                className="text-black dark:text-white hover:underline">
                Clear
              </button>
            </div>
            <div className="px-5 pb-3 overflow-y-auto space-y-1.5">
              {selectPickerOptions.length === 0 && (
                <p className="text-sm text-black dark:text-white">No MoUs yet.</p>
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
                      <p className="text-sm font-medium text-black dark:text-white truncate">{partnerName}</p>
                      {title && <p className="text-xs text-black dark:text-white truncate">{title}</p>}
                    </div>
                  </label>
                );
              })}
            </div>
            <div className="flex gap-2 px-5 py-4 border-t border-border">
              <button type="button" onClick={() => setShowSelectPicker(false)}
                className="flex-1 h-10 rounded-full border border-border text-sm text-black dark:text-white hover:border-foreground/30 transition-colors">
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
      {showPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowPicker(false)}>
          <div className="bg-white dark:bg-card rounded-2xl border border-border w-full max-w-md shadow-xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="text-lg font-bold text-black dark:text-white">Choose a partner</h3>
              <button type="button" onClick={() => setShowPicker(false)} className="text-black dark:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-5 py-4 overflow-y-auto space-y-2">
              {loadingOptions ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 text-[#2D6A4F] animate-spin" />
                </div>
              ) : partnerOptions.length === 0 ? (
                <p className="text-sm text-black dark:text-white">
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
                    <p className="text-base font-medium text-black dark:text-white">{opt.name}</p>
                    {opt.initiativeTitle && <p className="text-sm text-black dark:text-white mt-0.5">{opt.initiativeTitle}</p>}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
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
            // Goes straight into the new (or pre-existing) draft instead of
            // dropping back to the list -- the list still gets refreshed in
            // the background so it's accurate whenever they do return to it.
            setMouTarget(null);
            setOpenDocId(documentId);
            load();
          }}
        />
      )}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setConfirmDeleteId(null)}>
          <div className="bg-white dark:bg-card rounded-2xl border border-border w-full max-w-sm shadow-xl p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <p className="text-base font-bold text-black dark:text-white">Delete this draft?</p>
            <p className="text-sm text-black dark:text-white leading-relaxed">
              This permanently deletes the draft MoU. This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setConfirmDeleteId(null)}
                className="flex-1 h-10 rounded-full border border-border text-sm text-black dark:text-white hover:border-foreground/30 transition-colors">
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
    </div>
  );
}