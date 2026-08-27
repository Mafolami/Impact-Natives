import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "wouter";
import { Loader2, CheckCircle2, ShieldCheck, Camera, ArrowRight, Building2, Trash2, Pencil, Globe, Instagram, Twitter, Facebook, Youtube, Linkedin, ChevronDown, ChevronsDown, ChevronsUp } from "lucide-react";
import { UserAvatar } from "@/components/ui/UserAvatar";
import VerifiedOutcomesSection from "@/components/dashboard/VerifiedOutcomesSection";
import { COUNTRIES } from "@/lib/countries";
import { SECTOR_OPTIONS } from "@/lib/sectors";
import { DD_ITEMS, FUNDER_DD_ITEMS, DDItemDef, DDDocument, PILLAR_INFO } from "@/lib/ddItems";
import { EsgSnapshotSection } from "@/components/dashboard/EsgSnapshotSection";
import { ORG_TYPE_FILTERS as ORG_TYPE_OPTIONS } from "@/lib/orgTypes";

// Local ORG_TYPE_OPTIONS array removed -- it was a fourth undetected copy of
// lib/orgTypes.ts (after Onboarding.tsx, UpgradeToOrganisation.tsx, and
// FindPartnerModalDashboard.tsx's ORG_TYPES) missing "consultancy", which is
// why every solo consultancy's own profile showed "Organisation type: Not
// set" despite the value being stored correctly in the database.
// ─── Shared small components ────────────────────────────────────────────────

function CountryPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const filtered = search.trim()
    ? COUNTRIES.filter((c) => c.toLowerCase().includes(search.toLowerCase()))
    : COUNTRIES;
  return (
    <div className="relative mt-1">
      <Input
        value={open ? search : value}
        onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
        onFocus={() => { setSearch(""); setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="h-10" placeholder="Search country..." autoComplete="off" />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto rounded-lg border border-border bg-background shadow-md">
          {filtered.map((c) => (
            <button key={c} type="button"
              onMouseDown={() => { onChange(c); setSearch(""); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors ${
                value === c ? "bg-[#2D6A4F]/10 text-[#2D6A4F] font-medium" : "text-foreground"
              }`}>
              {c}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SectorChips({ selected, onChange }: { selected: string[]; onChange: (v: string[]) => void }) {
  function toggle(s: string) {
    onChange(selected.includes(s) ? selected.filter((x) => x !== s) : [...selected, s]);
  }
  return (
    <div className="flex flex-wrap gap-2 mt-1">
      {SECTOR_OPTIONS.map((s) => {
        const active = selected.includes(s);
        return (
          <button key={s} type="button" onClick={() => toggle(s)}
            className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
              active ? "bg-[#2D6A4F] border-[#2D6A4F] text-white"
                     : "border-border text-black dark:text-white hover:border-foreground/30 hover:text-foreground"
            }`}>
            {s}
          </button>
        );
      })}
    </div>
  );
}

const FUNDING_INSTRUMENTS = [
  "Grant", "Concessional loan", "Equity investment",
  "Recoverable grant", "Prize", "Technical assistance",
];

const SDG_OPTIONS = [
  "No Poverty", "Zero Hunger", "Good Health and Well-being", "Quality Education",
  "Gender Equality", "Clean Water and Sanitation", "Affordable and Clean Energy",
  "Decent Work and Economic Growth", "Industry Innovation and Infrastructure",
  "Reduced Inequalities", "Sustainable Cities and Communities",
  "Responsible Consumption and Production", "Climate Action", "Life Below Water",
  "Life on Land", "Peace Justice and Strong Institutions", "Partnerships for the Goals",
];

// Generic chip picker, same look as SectorChips but takes its own options
// list. Used for the three mandate-completeness fields (funding
// instruments, mandate sectors, mandate SDGs) that previously had no
// input control anywhere in this page.
function ChipPicker({ options, selected, onChange }: { options: string[]; selected: string[]; onChange: (v: string[]) => void }) {
  function toggle(s: string) {
    onChange(selected.includes(s) ? selected.filter((x) => x !== s) : [...selected, s]);
  }
  return (
    <div className="flex flex-wrap gap-2 mt-1">
      {options.map((s) => {
        const active = selected.includes(s);
        return (
          <button key={s} type="button" onClick={() => toggle(s)}
            className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
              active ? "bg-[#2D6A4F] border-[#2D6A4F] text-white"
                     : "border-border text-black dark:text-white hover:border-foreground/30 hover:text-foreground"
            }`}>
            {s}
          </button>
        );
      })}
    </div>
  );
}

function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="relative inline-flex group shrink-0">
      <span className="w-3.5 h-3.5 rounded-full border border-muted-foreground/50 text-foreground text-[9px] leading-[13px] font-bold inline-flex items-center justify-center cursor-default"
        aria-label="What does this mean?">
        i
      </span>
      <span className="pointer-events-none absolute left-0 bottom-full mb-1.5 w-64 rounded-lg border border-border bg-white dark:bg-card px-2.5 py-1.5 text-xs text-foreground opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-md">
        {text}
      </span>
    </span>
  );
}

function PaneHeader({ title, subtitle, info }: { title: string; subtitle?: string; info?: string }) {
  return (
    <div className="mb-1">
      <div className="flex items-center gap-1.5">
        <p className="text-xs font-semibold uppercase tracking-wider text-black dark:text-white">{title}</p>
        {info && (
          <span className="relative inline-flex group shrink-0">
            <span className="w-3.5 h-3.5 rounded-full border border-muted-foreground/50 text-foreground text-[9px] leading-[13px] font-bold inline-flex items-center justify-center cursor-default"
              aria-label="What does this mean?">
              i
            </span>
            <span className="pointer-events-none absolute left-0 bottom-full mb-1.5 w-64 rounded-lg border border-border bg-white dark:bg-card px-2.5 py-1.5 text-xs text-foreground opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-md">
              {info}
            </span>
          </span>
        )}
      </div>
      {subtitle && <p className="text-xs text-black dark:text-white mt-1">{subtitle}</p>}
    </div>
  );
}

// ─── Display-card / edit-modal pattern ──────────────────────────────────────
// Sections render their FINALIZED, saved values by default (read-only), with
// an "Edit" button that opens a modal scoped to just that section's fields.
// Editing happens only inside the modal; the page itself is never a live
// form. Selected states use a neutral checkmark, never a color fill.

async function saveOrgFields(userId: string, fields: Record<string, any>) {
  const { error } = await supabase.from("organizations")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (error) throw error;
}

async function saveProfileFields(userId: string, fields: Record<string, any>) {
  const { error } = await supabase.from("profiles")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw error;
}

// Wraps a set of SectionCards in the same full-bleed, thick-divider strip
// used throughout DashboardNatives -- NOT individually bordered boxes.
function SectionCardGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-card w-[calc(100%+3rem)] -mx-6 -mt-10 divide-y-[6px] divide-[#FAF6F0] dark:divide-black">
      {children}
    </div>
  );
}

function SectionCard({ title, titleExtra, onEdit, editable = true, children, collapsible = false, expanded = true, onToggle }: {
  title: string; titleExtra?: React.ReactNode; onEdit: () => void; editable?: boolean; children: React.ReactNode;
  collapsible?: boolean; expanded?: boolean; onToggle?: () => void;
}) {
  if (collapsible) {
    return (
      <div className="relative">
        <button type="button" onClick={onToggle} className="w-full flex items-center gap-1.5 text-left px-8 sm:px-12 py-4 pr-14 hover:bg-[#E2725B]/[0.08] transition-colors">
          <p className="text-lg font-bold text-[#111111] dark:text-[#F5F5F5]">{title}</p>
          {titleExtra}
        </button>
        {editable && expanded && (
          <button type="button" onClick={onEdit} aria-label={`Edit ${title}`}
            className="absolute right-8 sm:right-12 top-4 text-[#111111] dark:text-[#F5F5F5] hover:opacity-60 transition-opacity">
            <Pencil className="w-4 h-4" />
          </button>
        )}
        {expanded && (
          <div className="px-8 sm:px-12 pt-8 pb-4">
            <div className="space-y-9">
              {children}
            </div>
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="px-8 sm:px-12 py-4">
      <div className="flex items-center justify-between mb-4">
        <p className="text-lg font-bold text-[#111111] dark:text-[#F5F5F5]">{title}</p>
        {editable && (
          <button type="button" onClick={onEdit} aria-label={`Edit ${title}`}
            className="text-[#111111] dark:text-[#F5F5F5] hover:opacity-60 transition-opacity shrink-0">
            <Pencil className="w-4 h-4" />
          </button>
        )}
      </div>
      <div className="space-y-9">
        {children}
      </div>
    </div>
  );
}

function SectionGroupHeader({ title, expanded, onToggle }: { title: string; expanded: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} className="w-full flex items-center justify-between px-8 sm:px-12 py-4 text-left hover:bg-[#E2725B]/[0.08] transition-colors">
      <p className="text-lg font-bold text-[#111111] dark:text-[#F5F5F5]">{title}</p>
    </button>
  );
}

function DisplayField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-sm font-bold text-[#111111] dark:text-[#F5F5F5] mb-1.5">{label}</p>
      {children}
    </div>
  );
}

// Known social platforms for the Online Presence dropdown -- lets the
// display view show a real icon instead of generic text. "Other" falls
// back to a free-text label, same _custom pattern used by DD_ITEMS.
const SOCIAL_PLATFORMS: { value: string; icon: any }[] = [
  { value: "Instagram", icon: Instagram },
  { value: "X (Twitter)", icon: Twitter },
  { value: "Facebook", icon: Facebook },
  { value: "YouTube", icon: Youtube },
  { value: "LinkedIn", icon: Linkedin },
  { value: "TikTok", icon: Globe },
  { value: "Behance", icon: Globe },
  { value: "Other", icon: Globe },
];
function socialPlatformIcon(label: string) {
  return SOCIAL_PLATFORMS.find(p => p.value === label)?.icon ?? Globe;
}

function EmptyValue() {
  return <p className="text-sm text-[#111111] dark:text-[#F5F5F5] italic opacity-60">Not set yet</p>;
}

function FlatTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-sm text-[#111111] dark:text-[#F5F5F5] border border-border px-3 py-1 rounded-md">
      {children}
    </span>
  );
}

// Neutral checkbox for modals -- checked state is a checkmark inside a
// bordered square, never a color fill across the whole row.
function ModalCheckbox({ checked, onChange, label, sub }: { checked: boolean; onChange: () => void; label: string; sub?: string }) {
  return (
    <button type="button" onClick={onChange} className="w-full flex items-start gap-3 text-left py-1.5">
      <div className={`w-4 h-4 rounded border shrink-0 mt-0.5 flex items-center justify-center transition-colors ${checked ? "border-black dark:border-white" : "border-border"}`}>
        {checked && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-black dark:text-white"><polyline points="20 6 9 17 4 12" /></svg>}
      </div>
      <div>
        <p className="text-sm text-black dark:text-white">{label}</p>
        {sub && <p className="text-xs text-black dark:text-white opacity-60 mt-0.5">{sub}</p>}
      </div>
    </button>
  );
}

function EditModal({ isOpen = true, title, onClose, onSave, saving, children }: { isOpen?: boolean; title: string; onClose: () => void; onSave: () => void; saving: boolean; children: React.ReactNode }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-card rounded-2xl border border-border w-full max-w-lg p-6 space-y-5 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-black dark:text-white">{title}</h3>
        {children}
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose}
            className="flex-1 h-9 rounded-full border border-border text-sm text-black dark:text-white hover:bg-muted transition-colors">
            Cancel
          </button>
          <button type="button" onClick={onSave} disabled={saving}
            className="flex-1 h-9 rounded-full bg-black dark:bg-white text-white dark:text-black text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed">
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Pane definitions ────────────────────────────────────────────────────────

type PaneKey =
  | "basic" | "organisation" | "focus" | "presence"
  | "legal_identity"
  | "dd" | "fdd" | "track" | "mandate" | "csr" | "verification" | "impact_evidence";

interface PaneDef { key: PaneKey; label: string; }

function DeliveryStatsCard({ orgId }: { orgId: string | null }) {
  const [stats, setStats] = useState<{ completed: number; stalled: number; fell_through: number; resolved: number; total: number } | null>(null);

  useEffect(() => {
    if (!orgId) return;
    supabase.rpc("get_org_delivery_stats", { target_org_id: orgId })
      .then(({ data }) => { if (data?.[0]) setStats(data[0]); });
  }, [orgId]);

  if (!stats) return null;
  const hasEnoughData = stats.resolved >= 1;
  const rate = hasEnoughData ? Math.round((stats.completed / stats.resolved) * 100) : null;
  const inProgress = stats.total - stats.resolved;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <p className="text-xl font-bold text-[#111111] dark:text-[#F5F5F5]">Delivery</p>
          <InfoTooltip text={PILLAR_INFO.delivery} />
        </div>
        {hasEnoughData && <p className="text-xl font-bold text-black dark:text-white">{rate}%</p>}
      </div>
      <p className="text-xs text-black dark:text-white opacity-60 mb-6">Platform-tracked, not editable here.</p>
      {hasEnoughData ? (
        <>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-[#2D6A4F] transition-all duration-500" style={{ width: `${rate}%` }} />
          </div>
          <p className="text-sm text-black dark:text-white mt-3">
            {stats.completed} of {stats.resolved} relationship{stats.resolved !== 1 ? "s" : ""} completed
            {[
              stats.stalled > 0 ? `${stats.stalled} stalled` : null,
              stats.fell_through > 0 ? `${stats.fell_through} fell through` : null,
              inProgress > 0 ? `${inProgress} still in progress` : null,
            ].filter(Boolean).length > 0
              ? ` (${[
                  stats.stalled > 0 ? `${stats.stalled} stalled` : null,
                  stats.fell_through > 0 ? `${stats.fell_through} fell through` : null,
                  inProgress > 0 ? `${inProgress} still in progress` : null,
                ].filter(Boolean).join(", ")})`
              : ""}
          </p>
        </>
      ) : stats.total === 0 ? (
        <p className="text-sm text-black dark:text-white">No tracked delivery history yet.</p>
      ) : (
        <p className="text-sm text-black dark:text-white">
          {stats.total} active relationship{stats.total !== 1 ? "s" : ""}, no completed outcomes yet.
        </p>
      )}
    </div>
  );
}

function DDEvidenceModal({ item, initialAnswers, orgId, userId, onClose, onSave }: {
  item: DDItemDef; initialAnswers: Record<string, any>; orgId: string; userId: string;
  onClose: () => void; onSave: (answers: Record<string, any>) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, any>>(initialAnswers ?? {});
  const [attemptedInvalidSave, setAttemptedInvalidSave] = useState(false);
  const [documents, setDocuments] = useState<DDDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [wantsUpload, setWantsUpload] = useState(false);
  const [uploadVisibility, setUploadVisibility] = useState<DDDocument["visibility"]>("private");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!orgId) { setDocsLoading(false); return; }
    let cancelled = false;
    supabase.from("dd_evidence_documents")
      .select("id,organization_id,dd_item_key,file_path,file_name,visibility,created_at")
      .eq("organization_id", orgId)
      .eq("dd_item_key", item.key)
      .order("created_at", { ascending: false })
      .then(({ data }) => { if (!cancelled) { setDocuments(data ?? []); setDocsLoading(false); } });
    return () => { cancelled = true; };
  }, [orgId, item.key]);

  async function handleDocUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !userId || !orgId) return;
    if (file.size > 10 * 1024 * 1024) { alert("File size must be under 10 MB."); return; }
    setUploading(true);
    const filePath = `${userId}/${item.key}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from("dd-evidence-docs").upload(filePath, file);
    if (uploadError) { alert(`Upload failed: ${uploadError.message}`); setUploading(false); return; }
    const { data, error: insertError } = await supabase.from("dd_evidence_documents")
      .insert({ organization_id: orgId, dd_item_key: item.key, file_path: filePath, file_name: file.name, visibility: uploadVisibility })
      .select("id,organization_id,dd_item_key,file_path,file_name,visibility,created_at").single();
    if (insertError) { alert(`Couldn't save document record: ${insertError.message}`); setUploading(false); return; }
    setDocuments(prev => [data as DDDocument, ...prev]);
    setWantsUpload(false);
    setUploading(false);
  }

  async function handleDocView(doc: DDDocument) {
    const { data, error } = await supabase.storage.from("dd-evidence-docs").createSignedUrl(doc.file_path, 60);
    if (error || !data) { alert("Couldn't open document."); return; }
    window.open(data.signedUrl, "_blank");
  }

  async function handleDocVisibilityChange(doc: DDDocument, visibility: DDDocument["visibility"]) {
    setDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, visibility } : d));
    const { error } = await supabase.from("dd_evidence_documents").update({ visibility, updated_at: new Date().toISOString() }).eq("id", doc.id);
    if (error) alert(`Couldn't update visibility: ${error.message}`);
  }

  async function handleDocDelete(doc: DDDocument) {
    if (!confirm(`Remove "${doc.file_name}"?`)) return;
    await supabase.storage.from("dd-evidence-docs").remove([doc.file_path]);
    const { error } = await supabase.from("dd_evidence_documents").delete().eq("id", doc.id);
    if (error) { alert(`Couldn't remove document: ${error.message}`); return; }
    setDocuments(prev => prev.filter(d => d.id !== doc.id));
  }

  function setAnswer(key: string, value: any) {
    setAnswers(prev => {
      const next = { ...prev, [key]: value };
      for (const q2 of item.questions) {
        if (q2.showIf?.key === key && q2.showIf.equals !== value) {
          delete next[q2.key];
          delete next[`${q2.key}_custom`];
        }
      }
      return next;
    });
  }

  function isQuestionMissing(q: typeof item.questions[number]): boolean {
    if (q.showIf && answers[q.showIf.key] !== q.showIf.equals) return false;
    const val = answers[q.key];
    // Blacklisting/pending-disputes disclosures require 20+ characters of
    // detail when answered Yes — a real answer is required to save at all,
    // not just optional context. Scoped to these two keys specifically;
    // every other yesno+followUp question in the app keeps its normal
    // required:false behaviour untouched.
    if (q.key === "hasBlacklisting" || q.key === "hasPendingDisputes") {
      if (val !== true && val !== false) return true;
      if (val === true && q.type === "yesno" && q.followUpIfYes) {
        const detail = String(answers[q.followUpIfYes.key] ?? "").trim();
        if (detail.length < 20) return true;
      }
      return false;
    }
    if (q.required === false) return false;
    if (q.type === "yesno") {
      if (val !== true && val !== false) return true;
      if (q.followUpIfYes && q.followUpIfYes.required !== false && val === true && !answers[q.followUpIfYes.key]) return true;
      return false;
    }
    if (!val) return true;
    if (q.type === "select" && (val === "Other" || val === "Custom") && !answers[`${q.key}_custom`]) return true;
    return false;
  }

  const canSave = !item.questions.some(isQuestionMissing);

  function handleSave() {
    if (!canSave) { setAttemptedInvalidSave(true); return; }
    onSave(answers);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-card rounded-2xl border border-border w-full max-w-md p-6 space-y-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div>
          <h3 className="text-lg font-bold text-foreground">{item.label}</h3>
          <p className="text-sm text-black dark:text-white mt-0.5">{item.sub}</p>
          {item.key === "legal_compliance_declaration" && (
            <p className="text-xs text-black dark:text-white mt-2 border border-border rounded-lg px-3 py-2 bg-muted/30">
              If you disclose a blacklisting or pending dispute, funders and corporate partners considering a partnership with you will see the detail you provide — other organisations won't. Give a real, specific answer rather than a placeholder; vague or missing detail will block saving.
            </p>
          )}
        </div>
        {item.questions.map(q => {
          if (q.showIf && answers[q.showIf.key] !== q.showIf.equals) return null;
          const missing = attemptedInvalidSave && isQuestionMissing(q);
          const flagClass = missing ? "border-red-400" : "border-border";
          return (
          <div key={q.key}>
            <label className={`text-xs font-semibold uppercase tracking-wider mb-1.5 block ${missing ? "text-red-500" : "text-black dark:text-white"}`}>
              {q.label}{q.required !== false && <span className="text-red-500"> *</span>}
            </label>
            {q.type === "text" && (
              <input value={answers[q.key] ?? ""} onChange={e => setAnswer(q.key, e.target.value)}
                className={`w-full h-9 px-3 rounded-lg border bg-background text-sm text-foreground ${flagClass}`} />
            )}
            {q.type === "date" && (
              <input type="date" value={answers[q.key] ?? ""} onChange={e => setAnswer(q.key, e.target.value)}
                className={`w-full h-9 px-3 rounded-lg border bg-background text-sm text-foreground ${flagClass}`} />
            )}
            {q.type === "select" && (
              <>
                <select value={answers[q.key] ?? ""} onChange={e => setAnswer(q.key, e.target.value)}
                  className={`w-full h-9 px-3 rounded-lg border bg-background text-sm text-foreground ${flagClass}`}>
                  <option value="">Select...</option>
                  {q.options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                {(answers[q.key] === "Other" || answers[q.key] === "Custom") && (
                  <input value={answers[`${q.key}_custom`] ?? ""} onChange={e => setAnswer(`${q.key}_custom`, e.target.value)}
                    placeholder="Please specify"
                    className={`w-full h-9 px-3 mt-2 rounded-lg border bg-background text-sm text-foreground ${
                      attemptedInvalidSave && !answers[`${q.key}_custom`] ? "border-red-400" : "border-border"
                    }`} />
                )}
              </>
            )}
            {q.type === "yesno" && (
              <>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setAnswer(q.key, true)}
                    className={`flex-1 h-9 rounded-lg border text-sm font-medium transition-colors ${
                      answers[q.key] === true ? "bg-[#2D6A4F] border-[#2D6A4F] text-white" : `${flagClass} text-black dark:text-white hover:border-[#2D6A4F]`
                    }`}>
                    Yes
                  </button>
                  <button type="button" onClick={() => {
                      setAnswer(q.key, false);
                      if (q.followUpIfYes) setAnswer(q.followUpIfYes.key, "");
                    }}
                    className={`flex-1 h-9 rounded-lg border text-sm font-medium transition-colors ${
                      answers[q.key] === false ? "bg-[#2D6A4F] border-[#2D6A4F] text-white" : `${flagClass} text-black dark:text-white hover:border-[#2D6A4F]`
                    }`}>
                    No
                  </button>
                </div>
                {q.followUpIfYes && answers[q.key] === true && (
                  <>
                    <input value={answers[q.followUpIfYes.key] ?? ""} onChange={e => setAnswer(q.followUpIfYes!.key, e.target.value)}
                      placeholder={q.followUpIfYes.label}
                      className={`w-full h-9 px-3 mt-2 rounded-lg border bg-background text-sm text-foreground ${
                        attemptedInvalidSave && isQuestionMissing(q) ? "border-red-400" : "border-border"
                      }`} />
                    {(q.key === "hasBlacklisting" || q.key === "hasPendingDisputes") && String(answers[q.followUpIfYes.key] ?? "").trim().length < 20 && (
                      <p className="text-[11px] mt-1 text-red-500">
                        {String(answers[q.followUpIfYes.key] ?? "").trim().length}/20 characters minimum
                      </p>
                    )}
                  </>
                )}
              </>
            )}
          </div>
          );
        })}

        {orgId && (
          <div className="pt-3 border-t border-border space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-black dark:text-white">Supporting documents</p>

            {!docsLoading && documents.length > 0 && (
              <div className="space-y-2">
                {documents.map(doc => (
                  <div key={doc.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-border bg-muted/20">
                    <button type="button" onClick={() => handleDocView(doc)}
                      className="text-sm text-foreground hover:underline underline-offset-2 truncate text-left">
                      {doc.file_name}
                    </button>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <select value={doc.visibility} onChange={e => handleDocVisibilityChange(doc, e.target.value as DDDocument["visibility"])}
                        className="h-7 text-xs rounded-md border border-border bg-background px-1.5 text-foreground">
                        <option value="private">Private</option>
                        <option value="relationship">Connections only</option>
                        <option value="public">Public</option>
                      </select>
                      <button type="button" onClick={() => handleDocDelete(doc)} className="text-muted-foreground hover:text-red-500 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!wantsUpload ? (
              <button type="button" onClick={() => setWantsUpload(true)}
                className="text-sm text-[#2D6A4F] hover:underline underline-offset-2 font-medium">
                + Upload a supporting document
              </button>
            ) : (
              <div className="space-y-2 rounded-lg border border-dashed border-border p-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-black dark:text-white mb-1.5 block">Who can view this document?</label>
                  <div className="flex gap-1.5">
                    {([["private","Only me"],["relationship","Connections"],["public","Public"]] as const).map(([v, label]) => (
                      <button key={v} type="button" onClick={() => setUploadVisibility(v)}
                        className={`flex-1 h-8 rounded-lg border text-xs font-medium transition-colors ${
                          uploadVisibility === v ? "bg-[#2D6A4F] border-[#2D6A4F] text-white" : "border-border text-black dark:text-white hover:border-[#2D6A4F]"
                        }`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="flex items-center justify-center gap-2 h-9 rounded-lg border border-border text-sm text-black dark:text-white hover:text-foreground hover:border-foreground/30 transition-colors cursor-pointer">
                  {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Choose file"}
                  <input type="file" className="sr-only" onChange={handleDocUpload} disabled={uploading} />
                </label>
                <button type="button" onClick={() => setWantsUpload(false)} className="text-xs text-black dark:text-white hover:text-foreground">
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}

        {attemptedInvalidSave && !canSave && (
          <p className="text-xs text-red-500 font-medium">
            Fill in the required fields (marked *) before saving.
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose}
            className="flex-1 h-9 rounded-full border border-border text-sm text-black dark:text-white hover:text-foreground transition-colors">
            Cancel
          </button>
          <button type="button" onClick={handleSave}
            className="flex-1 h-9 rounded-full bg-[#2D6A4F] hover:bg-[#245c43] text-white text-sm font-medium transition-colors">
            Save &amp; check
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DashboardProfile() {
  const { user, profile, orgOwnerId, refreshProfile } = useAuth();
  const [saving, setSaving]               = useState(false);
  const [saved, setSavedState]            = useState(false);
  const [saveBlocked, setSaveBlocked]     = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [personalPhotoUploading, setPersonalPhotoUploading] = useState(false);
  const [logoUrl, setLogoUrl]             = useState<string | null>(null);

  // Org-field writes are Owner-only at the RLS layer (organizations UPDATE
  // policy is `user_id = auth.uid()`, no Member support) -- this is a
  // deliberate, existing restriction, not something being newly added
  // here. Members can view the org profile but not edit it, until Team
  // permissions get their own dedicated design pass. isOrgOwner just makes
  // the UI honest about that: hide edit affordances a Member's save would
  // silently fail against anyway, rather than showing a pencil icon that
  // doesn't work.
  const isOrgOwner = !!user && !!orgOwnerId && user.id === orgOwnerId;

  const isOrg = profile?.user_type === "organisation";
  // Already representing someone else's org as a Member -- don't offer
  // to register a second, competing org. The invite-acceptance flow is
  // the "represent an organisation" path for these accounts; this card
  // is for genuinely unaffiliated individuals only.
  const isTeamMember = !!(orgOwnerId && user && orgOwnerId !== user.id);
  const [orgType, setOrgType] = useState<string>(profile?.org_type ?? "");
  const [orgId, setOrgId] = useState<string | null>(null);
  const [isSoloConsultancy, setIsSoloConsultancy] = useState(false);
  const orgTypeNow = profile?.org_type ?? orgType ?? "";
  const isFunder = ["philanthropic_foundation", "venture_capital"].includes(orgTypeNow);
  const isCorporate = ["corporation", "technology_company", "public_sector"].includes(orgTypeNow);
  const isImplementer = isOrg && !isFunder && !isCorporate;

  // ── Active pane ──────────────────────────────────────────────────────────
  const panes: PaneDef[] = isOrg
    ? [
        { key: "basic",        label: "Contact Details" },
        { key: "organisation", label: "Organisation" },
        { key: "verification", label: "Verification" },
        { key: "impact_evidence", label: "Impact Evidence" },
      ]
    : [
        { key: "basic",    label: "Contact details" },
        { key: "focus",    label: "Focus Areas" },
        { key: "presence", label: "Online Presence" },
      ];

  const [activePane, setActivePane] = useState<PaneKey>("basic");

  // Sections folded inside the Organisation tab as an accordion instead of
  // each being its own top-level tab -- several can be open together, all
  // start collapsed.
  const [expandedOrgSections, setExpandedOrgSections] = useState<Set<string>>(new Set());
  // Accordion is exclusive by default -- opening a card closes whichever
  // was open before. Multiple can only be open together via "Expand all";
  // clicking any single card afterward collapses back down to just that
  // one.
  function toggleOrgSection(key: string) {
    setExpandedOrgSections(prev => {
      if (prev.size === 1 && prev.has(key)) return new Set();
      return new Set([key]);
    });
  }

  // ── Fixed pane-nav horizontal position ────────────────────────────────────
  // The nav is position:fixed on desktop so it stays put on scroll, but a
  // fixed element needs an explicit `left` and this component has no access
  // to the app Sidebar's collapsed/expanded width. Instead we measure a
  // spacer div that stays in normal flow right where the nav used to sit,
  // and use its real screen position as the nav's `left`.
  const paneNavSpacerRef = useRef<HTMLDivElement>(null);
  const [paneNavLeft, setPaneNavLeft] = useState<number | null>(null);
  useEffect(() => {
    function measure() {
      if (paneNavSpacerRef.current) setPaneNavLeft(paneNavSpacerRef.current.getBoundingClientRect().left);
    }
    measure();
    window.addEventListener("resize", measure);
    // Re-measure shortly after mount in case the Sidebar's collapse/expand
    // transition is still animating when this runs.
    const t = setTimeout(measure, 250);
    return () => { window.removeEventListener("resize", measure); clearTimeout(t); };
  }, []);

  // ── Legal Identity pane: display-card / edit-modal state ─────────────────
  const [editingLegalIdentityOpen, setEditingLegalIdentityOpen] = useState(false);
  const [legalIdentitySaving, setLegalIdentitySaving]           = useState(false);
  const [draftRegistrationType, setDraftRegistrationType]       = useState("");
  const [draftRegistrationNumber, setDraftRegistrationNumber]   = useState("");
  const [draftTin, setDraftTin]                                 = useState("");
  const [draftScumlNumber, setDraftScumlNumber]                 = useState("");
  const [draftYearFounded, setDraftYearFounded]                 = useState("");

  function openLegalIdentityModal() {
    setDraftRegistrationType(registrationType ?? "");
    setDraftRegistrationNumber(registrationNumber ?? "");
    setDraftTin(tin ?? "");
    setDraftScumlNumber(scumlNumber ?? "");
    setDraftYearFounded(yearFounded ? String(yearFounded) : "");
    setEditingLegalIdentityOpen(true);
  }

  async function saveLegalIdentitySection() {
    if (!user) return;
    setLegalIdentitySaving(true);
    try {
      await saveOrgFields(user.id, {
        registration_type:   draftRegistrationType.trim()   || null,
        registration_number: draftRegistrationNumber.trim() || null,
        tin:                 draftTin.trim()                || null,
        scuml_number:        draftScumlNumber.trim()        || null,
        year_founded:        draftYearFounded.trim() ? parseInt(draftYearFounded.trim(), 10) : null,
      });
      setRegistrationType(draftRegistrationType.trim() || null);
      setRegistrationNumber(draftRegistrationNumber.trim() || null);
      setTin(draftTin.trim() || null);
      setScumlNumber(draftScumlNumber.trim() || null);
      setYearFounded(draftYearFounded.trim() ? parseInt(draftYearFounded.trim(), 10) : null);
      await refreshProfile();
      setEditingLegalIdentityOpen(false);
    } catch (err: any) {
      alert(`Couldn't save: ${err.message}`);
    }
    setLegalIdentitySaving(false);
  }

  // ── Focus Areas pane: display-card / edit-modal state ────────────────────
  const [editingFocusOpen, setEditingFocusOpen] = useState(false);
  const [focusSaving, setFocusSaving]           = useState(false);
  const [draftSectors, setDraftSectors]         = useState<string[]>([]);
  function openFocusModal() {
    setDraftSectors(sectors);
    setEditingFocusOpen(true);
  }
  async function saveFocusSection() {
    if (!user) return;
    setFocusSaving(true);
    try {
      await saveProfileFields(user.id, { sectors: draftSectors.length > 0 ? draftSectors : null });
      setSectors(draftSectors);
      await refreshProfile();
      setEditingFocusOpen(false);
    } catch (err: any) {
      alert(`Couldn't save: ${err.message}`);
    }
    setFocusSaving(false);
  }

  // ── Mandate fields (funders/corporates) ──────────────────────────────────
  const [investmentThesis, setInvestmentThesis]       = useState(profile?.investment_thesis ?? "");

  // ── Impact & track record (implementers) ─────────────────────────────────
  const [totalBeneficiaries, setTotalBeneficiaries]   = useState("");
  const [jobsCreated, setJobsCreated]                 = useState("");
  const [femalePct, setFemalePct]                     = useState("");
  const [youthPct, setYouthPct]                       = useState("");
  const [yearsOfOperation, setYearsOfOperation]       = useState("");
  const [grantsCount, setGrantsCount]                 = useState("");
  const [grantsTotalValue, setGrantsTotalValue]       = useState("");
  const [grantsOnTimePct, setGrantsOnTimePct]         = useState("");
  const [previousFunders, setPreviousFunders]         = useState<string[]>([]);
  const [funderInput, setFunderInput]                 = useState("");
  const [thirdPartyEvaluations, setThirdPartyEvaluations] = useState(false);

  // ── Consultant expertise (solo consultancies -- replaces Impact & track
  // record for this org type, since beneficiaries/funders/grants don't map
  // onto individual consulting work) ────────────────────────────────────────
  const [specializations, setSpecializations]         = useState<string[]>([]);
  const [specializationInput, setSpecializationInput] = useState("");
  const [notableEngagements, setNotableEngagements]   = useState<string[]>([]);
  const [engagementInput, setEngagementInput]         = useState("");
  const [affiliations, setAffiliations]               = useState<string[]>([]);
  const [affiliationInput, setAffiliationInput]       = useState("");

  // ── DD readiness ──────────────────────────────────────────────────────────
  const [ddFinancialModel, setDdFinancialModel]       = useState(false);
  const [ddAuditedAccounts, setDdAuditedAccounts]     = useState(false);
  const [ddGovernanceDoc, setDdGovernanceDoc]         = useState(false);
  const [ddEsgAssessment, setDdEsgAssessment]         = useState(false);
  const [ddImpactFramework, setDdImpactFramework]     = useState(false);
  const [ddEnvironmentalPolicy, setDdEnvironmentalPolicy] = useState(false);
  const [ddSafeguardingPolicy, setDdSafeguardingPolicy] = useState(false);
  const [ddLegalRegistration, setDdLegalRegistration] = useState(false);
  const [ddLegalComplianceDeclaration, setDdLegalComplianceDeclaration] = useState(false);
  const [ddEvidence, setDdEvidence]                   = useState<Record<string, any>>({});
  const [ddConfirmedAt, setDdConfirmedAt]              = useState<Record<string, any>>({});
  const [ddModalKey, setDdModalKey]                   = useState<string | null>(null);

  // ── Funder/corporate DD readiness (parallel, smaller checklist) ────────────
  const [fddDisbursementTrackRecord, setFddDisbursementTrackRecord] = useState(false);
  const [fddDecisionTransparency, setFddDecisionTransparency]       = useState(false);
  const [fddConflictDisclosure, setFddConflictDisclosure]           = useState(false);
  const [fddGovernanceDoc, setFddGovernanceDoc]                     = useState(false);
  const [fddEsgFramework, setFddEsgFramework]                       = useState(false);
  const [fddLegalRegistration, setFddLegalRegistration]             = useState(false);

  async function saveDdItem(key: string, answers: Record<string, any>, setter: (v: boolean) => void, prefix: string = "dd") {
    const updatedEvidence = { ...ddEvidence, [key]: answers };
    setDdEvidence(updatedEvidence);
    // Real confirmation timestamp -- approx: false, since this is captured
    // at the exact moment the item was confirmed (unlike the migration
    // backfill, which only knew organizations.updated_at as an estimate).
    const updatedConfirmedAt = { ...ddConfirmedAt, [`${prefix}_${key}`]: { at: new Date().toISOString(), approx: false } };
    setDdConfirmedAt(updatedConfirmedAt);
    setter(true);
    setDdModalKey(null);
    if (!user) return;
    try {
      const fields: Record<string, any> = { dd_evidence: updatedEvidence, dd_confirmed_at: updatedConfirmedAt };
      fields[`${prefix}_${key}`] = true;
      await saveOrgFields(orgOwnerId!, fields);
    } catch (err: any) {
      alert(`Couldn't save: ${err.message}`);
    }
  }
  async function markDdItemIncomplete(key: string, setter: (v: boolean) => void, prefix: string = "dd") {
    if (!confirm("Mark this item as not complete? You'll need to re-verify it later.")) return;
    setter(false);
    // Drop the confirmation timestamp -- the item is no longer currently
    // attested, so a stale "confirmed on X" would be misleading on an
    // audit export until it's re-confirmed.
    const updatedConfirmedAt = { ...ddConfirmedAt };
    delete updatedConfirmedAt[`${prefix}_${key}`];
    setDdConfirmedAt(updatedConfirmedAt);
    if (!user) return;
    try {
      const fields: Record<string, any> = { dd_confirmed_at: updatedConfirmedAt };
      fields[`${prefix}_${key}`] = false;
      await saveOrgFields(orgOwnerId!, fields);
    } catch (err: any) {
      alert(`Couldn't save: ${err.message}`);
    }
  }

  // ── Track Record pane: display-card / edit-modal state ───────────────────
  const [editingTrackRecordOpen, setEditingTrackRecordOpen] = useState(false);
  const [trackRecordSaving, setTrackRecordSaving] = useState(false);
  const [draftTotalBeneficiaries, setDraftTotalBeneficiaries] = useState("");
  const [draftJobsCreated, setDraftJobsCreated] = useState("");
  const [draftFemalePct, setDraftFemalePct] = useState("");
  const [draftYouthPct, setDraftYouthPct] = useState("");
  const [draftYearsOfOperation, setDraftYearsOfOperation] = useState("");
  const [draftGrantsCount, setDraftGrantsCount] = useState("");
  const [draftGrantsTotalValue, setDraftGrantsTotalValue] = useState("");
  const [draftGrantsOnTimePct, setDraftGrantsOnTimePct] = useState("");
  const [draftPreviousFunders, setDraftPreviousFunders] = useState<string[]>([]);
  const [draftFunderInput, setDraftFunderInput] = useState("");
  const [draftThirdPartyEvaluations, setDraftThirdPartyEvaluations] = useState(false);
  function openTrackRecordModal() {
    setDraftTotalBeneficiaries(totalBeneficiaries);
    setDraftJobsCreated(jobsCreated);
    setDraftFemalePct(femalePct);
    setDraftYouthPct(youthPct);
    setDraftYearsOfOperation(yearsOfOperation);
    setDraftGrantsCount(grantsCount);
    setDraftGrantsTotalValue(grantsTotalValue);
    setDraftGrantsOnTimePct(grantsOnTimePct);
    setDraftPreviousFunders(previousFunders);
    setDraftFunderInput("");
    setDraftThirdPartyEvaluations(thirdPartyEvaluations);
    setEditingTrackRecordOpen(true);
  }
  async function saveTrackRecordSection() {
    if (!user) return;
    setTrackRecordSaving(true);
    try {
      await saveOrgFields(orgOwnerId!, {
        total_beneficiaries_reached: draftTotalBeneficiaries ? parseInt(draftTotalBeneficiaries) : null,
        jobs_created: draftJobsCreated ? parseInt(draftJobsCreated) : null,
        female_beneficiaries_pct: draftFemalePct ? parseInt(draftFemalePct) : null,
        youth_beneficiaries_pct: draftYouthPct ? parseInt(draftYouthPct) : null,
        years_of_operation: draftYearsOfOperation ? parseInt(draftYearsOfOperation) : null,
        grants_received_count: draftGrantsCount ? parseInt(draftGrantsCount) : null,
        grants_total_value_usd: draftGrantsTotalValue ? parseFloat(draftGrantsTotalValue) : null,
        grants_delivered_on_time_pct: draftGrantsOnTimePct ? parseInt(draftGrantsOnTimePct) : null,
        previous_funders: draftPreviousFunders.length > 0 ? draftPreviousFunders : null,
        third_party_evaluations: draftThirdPartyEvaluations,
      });
      setTotalBeneficiaries(draftTotalBeneficiaries);
      setJobsCreated(draftJobsCreated);
      setFemalePct(draftFemalePct);
      setYouthPct(draftYouthPct);
      setYearsOfOperation(draftYearsOfOperation);
      setGrantsCount(draftGrantsCount);
      setGrantsTotalValue(draftGrantsTotalValue);
      setGrantsOnTimePct(draftGrantsOnTimePct);
      setPreviousFunders(draftPreviousFunders);
      setThirdPartyEvaluations(draftThirdPartyEvaluations);
      await refreshProfile();
      setEditingTrackRecordOpen(false);
    } catch (err: any) {
      alert(`Couldn't save: ${err.message}`);
    }
    setTrackRecordSaving(false);
  }

  // ── Consultant expertise pane: display-card / edit-modal state ───────────
  const [editingExpertiseOpen, setEditingExpertiseOpen] = useState(false);
  const [expertiseSaving, setExpertiseSaving] = useState(false);
  const [draftSpecializations, setDraftSpecializations] = useState<string[]>([]);
  const [draftSpecializationInput, setDraftSpecializationInput] = useState("");
  const [draftNotableEngagements, setDraftNotableEngagements] = useState<string[]>([]);
  const [draftEngagementInput, setDraftEngagementInput] = useState("");
  const [draftAffiliations, setDraftAffiliations] = useState<string[]>([]);
  const [draftAffiliationInput, setDraftAffiliationInput] = useState("");
  function openExpertiseModal() {
    setDraftSpecializations(specializations);
    setDraftSpecializationInput("");
    setDraftNotableEngagements(notableEngagements);
    setDraftEngagementInput("");
    setDraftAffiliations(affiliations);
    setDraftAffiliationInput("");
    setEditingExpertiseOpen(true);
  }
  async function saveExpertiseSection() {
    if (!user) return;
    setExpertiseSaving(true);
    try {
      await saveOrgFields(orgOwnerId!, {
        specializations: draftSpecializations.length > 0 ? draftSpecializations : null,
        notable_engagements: draftNotableEngagements.length > 0 ? draftNotableEngagements : null,
        affiliations: draftAffiliations.length > 0 ? draftAffiliations : null,
      });
      setSpecializations(draftSpecializations);
      setNotableEngagements(draftNotableEngagements);
      setAffiliations(draftAffiliations);
      await refreshProfile();
      setEditingExpertiseOpen(false);
    } catch (err: any) {
      alert(`Couldn't save: ${err.message}`);
    }
    setExpertiseSaving(false);
  }

  // ── Mandate pane: display-card / edit-modal state ─────────────────────────
  const [editingMandateOpen, setEditingMandateOpen] = useState(false);
  const [mandateSaving, setMandateSaving] = useState(false);
  const [draftInvestmentThesis, setDraftInvestmentThesis] = useState("");
  const [draftGrantRangeMin, setDraftGrantRangeMin] = useState("");
  const [draftGrantRangeMax, setDraftGrantRangeMax] = useState("");
  const [draftGrantCurrency, setDraftGrantCurrency] = useState("USD");
  const draftGrantRangeInvalid = !!(draftGrantRangeMin && draftGrantRangeMax && Number(draftGrantRangeMax) < Number(draftGrantRangeMin));
  const [draftFundingInstruments, setDraftFundingInstruments] = useState<string[]>([]);
  const [draftMandateSectors, setDraftMandateSectors] = useState<string[]>([]);
  const [draftMandateSdgs, setDraftMandateSdgs] = useState<string[]>([]);
  const [draftStagePreference, setDraftStagePreference] = useState<string[]>([]);
  function openMandateModal() {
    setDraftInvestmentThesis(investmentThesis);
    setDraftGrantRangeMin(grantRangeMin);
    setDraftGrantRangeMax(grantRangeMax);
    setDraftGrantCurrency(grantCurrency);
    setDraftFundingInstruments(fundingInstruments);
    setDraftMandateSectors(mandateSectors);
    setDraftMandateSdgs(mandateSdgs);
    setDraftStagePreference(stagePreference);
    setDraftGeographicFocus(geographicFocus);
    setDraftGeographicInput("");
    setEditingMandateOpen(true);
  }
  async function saveMandateSection() {
    if (!user) return;
    if (draftGrantRangeInvalid) { alert("Max must be greater than or equal to Min."); return; }
    setMandateSaving(true);
    try {
      await saveOrgFields(orgOwnerId!, {
        investment_thesis: draftInvestmentThesis || null,
        grant_range_min: draftGrantRangeMin ? parseFloat(draftGrantRangeMin) : null,
        grant_range_max: draftGrantRangeMax ? parseFloat(draftGrantRangeMax) : null,
        grant_currency: draftGrantCurrency || null,
        funding_instruments: draftFundingInstruments.length > 0 ? draftFundingInstruments : null,
        mandate_sectors: draftMandateSectors.length > 0 ? draftMandateSectors : null,
        mandate_sdgs: draftMandateSdgs.length > 0 ? draftMandateSdgs : null,
        stage_preference: draftStagePreference.length > 0 ? draftStagePreference : null,
        geographic_focus: draftGeographicFocus.length > 0 ? draftGeographicFocus : null,
      });
      setInvestmentThesis(draftInvestmentThesis);
      setGrantRangeMin(draftGrantRangeMin);
      setGrantRangeMax(draftGrantRangeMax);
      setGrantCurrency(draftGrantCurrency);
      setFundingInstruments(draftFundingInstruments);
      setMandateSectors(draftMandateSectors);
      setMandateSdgs(draftMandateSdgs);
      setStagePreference(draftStagePreference);
      setGeographicFocus(draftGeographicFocus);
      await refreshProfile();
      setEditingMandateOpen(false);
    } catch (err: any) {
      alert(`Couldn't save: ${err.message}`);
    }
    setMandateSaving(false);
  }

  // ── Mandate / CSR shared fields ───────────────────────────────────────────
  const [grantRangeMin, setGrantRangeMin]             = useState("");
  const [grantRangeMax, setGrantRangeMax]             = useState("");
  const [grantCurrency, setGrantCurrency]             = useState("USD");
  const grantRangeInvalid = !!(grantRangeMin && grantRangeMax && Number(grantRangeMax) < Number(grantRangeMin));
  const [fundingInstruments, setFundingInstruments]   = useState<string[]>([]);
  const [mandateSectors, setMandateSectors]           = useState<string[]>([]);
  const [mandateSdgs, setMandateSdgs]                 = useState<string[]>([]);
  const [geographicFocus, setGeographicFocus]         = useState<string[]>([]);
  const [geographicInput, setGeographicInput]         = useState("");
  const [stagePreference, setStagePreference]         = useState<string[]>([]);
  const [partnerTypePreference, setPartnerTypePreference] = useState<string[]>([]);
  const [csrBudgetRange, setCsrBudgetRange]           = useState("");
  const [esgFrameworks, setEsgFrameworks]             = useState<string[]>([]);
  const [csrFocusStatement, setCsrFocusStatement]     = useState("");
  const [employeeEngagement, setEmployeeEngagement]   = useState(false);
  const [cobrandingOpen, setCobrandingOpen]           = useState(false);
  const [inkindSupport, setInkindSupport]             = useState<string[]>([]);
  const [techSupport, setTechSupport]                 = useState<string[]>([]);
  const [sandboxReady, setSandboxReady]               = useState(false);
  const [srg1PieSelfDeclared, setSrg1PieSelfDeclared]   = useState(false);
  const [srg1AnnualRevenue, setSrg1AnnualRevenue]       = useState("");
  const [srg1ReminderDismissedAt, setSrg1ReminderDismissedAt] = useState<string | null>(null);
  const [editingComplianceSection, setEditingComplianceSection] = useState(false);
  const [complianceSectionSaving, setComplianceSectionSaving]   = useState(false);
  const [draftSrg1PieSelfDeclared, setDraftSrg1PieSelfDeclared] = useState(false);
  const [draftSrg1AnnualRevenue, setDraftSrg1AnnualRevenue]     = useState("");
  const [draftSrg1RemindersOn, setDraftSrg1RemindersOn]         = useState(true);
  const [sandboxDescription, setSandboxDescription]   = useState("");

  // ── CSR & ESG pane: display-card / edit-modal state ──────────────────────
  const [editingCsrSection, setEditingCsrSection]     = useState<null | "csrEsg" | "partnership" | "tech">(null);
  const [csrSectionSaving, setCsrSectionSaving]       = useState(false);
  // Draft copies -- edits inside the modal only touch these, so Cancel
  // discards them and the page's finalized display never flickers mid-edit.
  const [draftCsrFocusStatement, setDraftCsrFocusStatement] = useState("");
  const [draftCsrBudgetRange, setDraftCsrBudgetRange] = useState("");
  const [draftEsgFrameworks, setDraftEsgFrameworks]   = useState<string[]>([]);
  const [draftInkindSupport, setDraftInkindSupport]   = useState<string[]>([]);
  const [draftEmployeeEngagement, setDraftEmployeeEngagement] = useState(false);
  const [draftCobrandingOpen, setDraftCobrandingOpen] = useState(false);
  const [draftPartnerTypePreference, setDraftPartnerTypePreference] = useState<string[]>([]);
  const [draftGeographicFocus, setDraftGeographicFocus] = useState<string[]>([]);
  const [draftGeographicInput, setDraftGeographicInput] = useState("");
  const [draftTechSupport, setDraftTechSupport]       = useState<string[]>([]);
  const [draftSandboxReady, setDraftSandboxReady]     = useState(false);
  const [draftSandboxDescription, setDraftSandboxDescription] = useState("");

  function openCsrEsgModal() {
    setDraftCsrFocusStatement(csrFocusStatement);
    setDraftCsrBudgetRange(csrBudgetRange);
    setDraftEsgFrameworks(esgFrameworks);
    setEditingCsrSection("csrEsg");
  }
  function openPartnershipModal() {
    setDraftInkindSupport(inkindSupport);
    setDraftEmployeeEngagement(employeeEngagement);
    setDraftCobrandingOpen(cobrandingOpen);
    setDraftPartnerTypePreference(partnerTypePreference);
    setDraftGeographicFocus(geographicFocus);
    setDraftGeographicInput("");
    setEditingCsrSection("partnership");
  }
  function openTechModal() {
    setDraftTechSupport(techSupport);
    setDraftSandboxReady(sandboxReady);
    setDraftSandboxDescription(sandboxDescription);
    setEditingCsrSection("tech");
  }

  async function saveCsrEsgSection() {
    if (!user) return;
    setCsrSectionSaving(true);
    try {
      await saveOrgFields(orgOwnerId!, {
        csr_focus_statement: draftCsrFocusStatement || null,
        csr_budget_range: draftCsrBudgetRange || null,
        esg_frameworks: draftEsgFrameworks.length > 0 ? draftEsgFrameworks : null,
      });
      setCsrFocusStatement(draftCsrFocusStatement);
      setCsrBudgetRange(draftCsrBudgetRange);
      setEsgFrameworks(draftEsgFrameworks);
      await refreshProfile();
      setEditingCsrSection(null);
    } catch (err: any) {
      alert(`Couldn't save: ${err.message}`);
    }
    setCsrSectionSaving(false);
  }
  async function savePartnershipSection() {
    if (!user) return;
    setCsrSectionSaving(true);
    try {
      await saveOrgFields(orgOwnerId!, {
        inkind_support: draftInkindSupport.length > 0 ? draftInkindSupport : null,
        employee_engagement_available: draftEmployeeEngagement,
        cobranding_open: draftCobrandingOpen,
        partner_type_preference: draftPartnerTypePreference.length > 0 ? draftPartnerTypePreference : null,
        geographic_focus: draftGeographicFocus.length > 0 ? draftGeographicFocus : null,
      });
      setInkindSupport(draftInkindSupport);
      setEmployeeEngagement(draftEmployeeEngagement);
      setCobrandingOpen(draftCobrandingOpen);
      setPartnerTypePreference(draftPartnerTypePreference);
      setGeographicFocus(draftGeographicFocus);
      await refreshProfile();
      setEditingCsrSection(null);
    } catch (err: any) {
      alert(`Couldn't save: ${err.message}`);
    }
    setCsrSectionSaving(false);
  }
  async function saveTechSection() {
    if (!user) return;
    setCsrSectionSaving(true);
    try {
      await saveOrgFields(orgOwnerId!, {
        tech_support_available: draftTechSupport.length > 0 ? draftTechSupport : null,
        sandbox_ready: draftSandboxReady,
        sandbox_description: draftSandboxDescription || null,
      });
      setTechSupport(draftTechSupport);
      setSandboxReady(draftSandboxReady);
      setSandboxDescription(draftSandboxDescription);
      await refreshProfile();
      setEditingCsrSection(null);
    } catch (err: any) {
      alert(`Couldn't save: ${err.message}`);
    }
    setCsrSectionSaving(false);
  }

  // ── Organisation pane: display-card / edit-modal state ───────────────────
  const [editingOrgSection, setEditingOrgSection] = useState(false);
  const [orgSectionSaving, setOrgSectionSaving]   = useState(false);
  const [draftOrgName, setDraftOrgName]           = useState("");
  const [draftOrgDescription, setDraftOrgDescription] = useState("");
  const [draftCountry, setDraftCountry]           = useState("");
  function openOrgModal() {
    setDraftOrgName(orgName);
    setDraftOrgDescription(orgDescription);
    setDraftCountry(country);
    setEditingOrgSection(true);
  }
  async function saveOrgSection() {
    if (!user) return;
    setOrgSectionSaving(true);
    try {
      await saveProfileFields(user.id, { org_name: draftOrgName || null, country: draftCountry || null });
      await saveOrgFields(orgOwnerId!, { description: draftOrgDescription || null });
      setOrgName(draftOrgName);
      setOrgDescription(draftOrgDescription);
      setCountry(draftCountry);
      await refreshProfile();
      setEditingOrgSection(false);
    } catch (err: any) {
      alert(`Couldn't save: ${err.message}`);
    }
    setOrgSectionSaving(false);
  }

  function openComplianceModal() {
    setDraftSrg1PieSelfDeclared(srg1PieSelfDeclared);
    setDraftSrg1AnnualRevenue(srg1AnnualRevenue);
    setDraftSrg1RemindersOn(!srg1ReminderDismissedAt);
    setEditingComplianceSection(true);
  }
  async function saveComplianceSection() {
    if (!orgOwnerId) return;
    setComplianceSectionSaving(true);
    try {
      const dismissedAt = draftSrg1RemindersOn ? null : new Date().toISOString();
      await saveOrgFields(orgOwnerId, {
        srg1_pie_self_declared: draftSrg1PieSelfDeclared,
        srg1_annual_revenue_ngn: draftSrg1AnnualRevenue ? Number(draftSrg1AnnualRevenue) : null,
        srg1_reminder_dismissed_at: dismissedAt,
      });
      setSrg1PieSelfDeclared(draftSrg1PieSelfDeclared);
      setSrg1AnnualRevenue(draftSrg1AnnualRevenue);
      setSrg1ReminderDismissedAt(dismissedAt);
      setEditingComplianceSection(false);
    } catch (err: any) {
      alert(`Couldn't save: ${err.message}`);
    }
    setComplianceSectionSaving(false);
  }

  

  // ── Contact Details pane (both variants): display-card / edit-modal state ──
  const [editingContactSection, setEditingContactSection] = useState(false);
  const [contactSaving, setContactSaving]     = useState(false);
  const [draftFullName, setDraftFullName]     = useState("");
  const [draftRoleTitle, setDraftRoleTitle]   = useState("");
  const [draftPhone, setDraftPhone]           = useState("");
  const [draftBio, setDraftBio]               = useState("");
  const [draftLinkedinUrl, setDraftLinkedinUrl] = useState("");

  function openIndividualContactModal() {
    setDraftFullName(fullName);
    setDraftCountry(country);
    setDraftRoleTitle(roleTitle);
    setDraftPhone(phone);
    setDraftBio(bio);
    setEditingContactSection(true);
  }
  async function saveIndividualContactSection() {
    if (!user) return;
    setContactSaving(true);
    try {
      await saveProfileFields(user.id, {
        full_name: draftFullName || null,
        country: draftCountry || null,
        role_title: draftRoleTitle || null,
        phone: draftPhone || null,
        bio: draftBio || null,
      });
      setFullName(draftFullName);
      setCountry(draftCountry);
      setRoleTitle(draftRoleTitle);
      setPhone(draftPhone);
      setBio(draftBio);
      await refreshProfile();
      setEditingContactSection(false);
    } catch (err: any) {
      alert(`Couldn't save: ${err.message}`);
    }
    setContactSaving(false);
  }

  function openOrgContactModal() {
    setDraftFullName(fullName);
    setDraftRoleTitle(roleTitle);
    setDraftPhone(phone);
    setDraftLinkedinUrl(linkedinUrl);
    setEditingContactSection(true);
  }
  async function saveOrgContactSection() {
    if (!user) return;
    setContactSaving(true);
    try {
      await saveProfileFields(user.id, {
        full_name: draftFullName || null,
        role_title: draftRoleTitle || null,
        phone: draftPhone || null,
        linkedin_url: draftLinkedinUrl || null,
      });
      setFullName(draftFullName);
      setRoleTitle(draftRoleTitle);
      setPhone(draftPhone);
      setLinkedinUrl(draftLinkedinUrl);
      await refreshProfile();
      setEditingContactSection(false);
    } catch (err: any) {
      alert(`Couldn't save: ${err.message}`);
    }
    setContactSaving(false);
  }

  // ── Online Presence pane: display-card / edit-modal state ────────────────
  const [editingPresenceOpen, setEditingPresenceOpen] = useState(false);
  const [presenceSaving, setPresenceSaving]     = useState(false);
  const [draftWebsite, setDraftWebsite]         = useState("");
  const [draftSocialLinks, setDraftSocialLinks] = useState<{ label: string; url: string }[]>([]);
  const [draftSocialLabel, setDraftSocialLabel] = useState("");
  const [draftSocialCustomLabel, setDraftSocialCustomLabel] = useState("");
  const [draftSocialUrl, setDraftSocialUrl]     = useState("");
  function openPresenceModal() {
    setDraftLinkedinUrl(linkedinUrl);
    setDraftWebsite(website);
    setDraftSocialLinks(socialLinks);
    setDraftSocialLabel("");
    setDraftSocialUrl("");
    setEditingPresenceOpen(true);
  }
  async function savePresenceSection() {
    if (!user) return;
    setPresenceSaving(true);
    try {
      await saveProfileFields(user.id, {
        linkedin_url: draftLinkedinUrl || null,
        website: draftWebsite || null,
        social_links: draftSocialLinks.length > 0 ? draftSocialLinks : null,
      });
      if (isOrg) {
        await saveOrgFields(orgOwnerId!, { website: draftWebsite || null });
      }
      setLinkedinUrl(draftLinkedinUrl);
      setWebsite(draftWebsite);
      setSocialLinks(draftSocialLinks);
      await refreshProfile();
      setEditingPresenceOpen(false);
    } catch (err: any) {
      alert(`Couldn't save: ${err.message}`);
    }
    setPresenceSaving(false);
  }

  useEffect(() => {
    if (!orgOwnerId) return;
    supabase.from("organizations")
     .select("id,logo_url,description,investment_thesis,grant_range_min,grant_range_max,grant_currency,funding_instruments,geographic_focus,stage_preference,partner_type_preference,csr_budget_range,esg_frameworks,mandate_sectors,mandate_sdgs,dd_financial_model,dd_audited_accounts,dd_governance_doc,dd_esg_assessment,dd_impact_framework,dd_environmental_policy,dd_safeguarding_policy,dd_legal_registration,dd_legal_compliance_declaration,dd_evidence,dd_confirmed_at,fdd_disbursement_track_record,fdd_decision_transparency,fdd_conflict_disclosure,fdd_governance_doc,fdd_esg_framework,fdd_legal_registration,total_beneficiaries_reached,jobs_created,female_beneficiaries_pct,youth_beneficiaries_pct,years_of_operation,grants_received_count,grants_total_value_usd,grants_delivered_on_time_pct,previous_funders,third_party_evaluations,csr_focus_statement,employee_engagement_available,cobranding_open,inkind_support,tech_support_available,sandbox_ready,sandbox_description,srg1_pie_self_declared,srg1_annual_revenue_ngn,srg1_reminder_dismissed_at,registration_type,registration_number,tin,scuml_number,year_founded,is_solo_consultancy,specializations,notable_engagements,affiliations")      .eq("user_id", orgOwnerId).maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setOrgId(data.id ?? null);
        setIsSoloConsultancy(!!data.is_solo_consultancy);
        if (data.logo_url) setLogoUrl(data.logo_url);
        if (data.description) setOrgDescription(data.description);
        if (data.registration_type) setRegistrationType(data.registration_type);
        if (data.registration_number) setRegistrationNumber(data.registration_number);
        if (data.tin) setTin(data.tin);
        if (data.scuml_number) setScumlNumber(data.scuml_number);
        if (data.year_founded) setYearFounded(data.year_founded);
        if (data.investment_thesis) setInvestmentThesis(data.investment_thesis);
        if (data.grant_range_min) setGrantRangeMin(String(data.grant_range_min));
        if (data.grant_range_max) setGrantRangeMax(String(data.grant_range_max));
        if (data.grant_currency) setGrantCurrency(data.grant_currency);
        if (data.funding_instruments) setFundingInstruments(data.funding_instruments);
        if (data.mandate_sectors) setMandateSectors(data.mandate_sectors);
        if (data.mandate_sdgs) setMandateSdgs(data.mandate_sdgs);
        if (data.geographic_focus) setGeographicFocus(data.geographic_focus);
        if (data.stage_preference) setStagePreference(data.stage_preference);
        if (data.partner_type_preference) setPartnerTypePreference(data.partner_type_preference);
        if (data.csr_budget_range) setCsrBudgetRange(data.csr_budget_range);
        if (data.esg_frameworks) setEsgFrameworks(data.esg_frameworks);
        if (data.csr_focus_statement) setCsrFocusStatement(data.csr_focus_statement);
        setEmployeeEngagement(data.employee_engagement_available ?? false);
        setCobrandingOpen(data.cobranding_open ?? false);
        if (data.inkind_support) setInkindSupport(data.inkind_support);
        if (data.tech_support_available) setTechSupport(data.tech_support_available);
        setSandboxReady(data.sandbox_ready ?? false);
        setSrg1PieSelfDeclared(data.srg1_pie_self_declared ?? false);
        setSrg1AnnualRevenue(data.srg1_annual_revenue_ngn != null ? String(data.srg1_annual_revenue_ngn) : "");
        setSrg1ReminderDismissedAt(data.srg1_reminder_dismissed_at ?? null);
        setSrg1ReminderDismissedAt(data.srg1_reminder_dismissed_at ?? null);
        if (data.sandbox_description) setSandboxDescription(data.sandbox_description);
        setDdFinancialModel(data.dd_financial_model ?? false);
        setDdAuditedAccounts(data.dd_audited_accounts ?? false);
        setDdGovernanceDoc(data.dd_governance_doc ?? false);
        setDdEsgAssessment(data.dd_esg_assessment ?? false);
        setDdImpactFramework(data.dd_impact_framework ?? false);
        setDdEnvironmentalPolicy(data.dd_environmental_policy ?? false);
        setDdSafeguardingPolicy(data.dd_safeguarding_policy ?? false);
        setDdLegalRegistration(data.dd_legal_registration ?? false);
        setDdLegalComplianceDeclaration(data.dd_legal_compliance_declaration ?? false);
        setFddDisbursementTrackRecord(data.fdd_disbursement_track_record ?? false);
        setFddDecisionTransparency(data.fdd_decision_transparency ?? false);
        setFddConflictDisclosure(data.fdd_conflict_disclosure ?? false);
        setFddGovernanceDoc(data.fdd_governance_doc ?? false);
        setFddEsgFramework(data.fdd_esg_framework ?? false);
        setFddLegalRegistration(data.fdd_legal_registration ?? false);
        setDdEvidence(data.dd_evidence ?? {});
        setDdConfirmedAt(data.dd_confirmed_at ?? {});
        if (data.total_beneficiaries_reached) setTotalBeneficiaries(String(data.total_beneficiaries_reached));
        if (data.jobs_created) setJobsCreated(String(data.jobs_created));
        if (data.female_beneficiaries_pct) setFemalePct(String(data.female_beneficiaries_pct));
        if (data.youth_beneficiaries_pct) setYouthPct(String(data.youth_beneficiaries_pct));
        if (data.years_of_operation) setYearsOfOperation(String(data.years_of_operation));
        if (data.grants_received_count) setGrantsCount(String(data.grants_received_count));
        if (data.grants_total_value_usd) setGrantsTotalValue(String(data.grants_total_value_usd));
        if (data.grants_delivered_on_time_pct) setGrantsOnTimePct(String(data.grants_delivered_on_time_pct));
        if (data.previous_funders) setPreviousFunders(data.previous_funders);
        setThirdPartyEvaluations(data.third_party_evaluations ?? false);
        if (data.specializations) setSpecializations(data.specializations);
        if (data.notable_engagements) setNotableEngagements(data.notable_engagements);
        if (data.affiliations) setAffiliations(data.affiliations);
      });
  }, [orgOwnerId]);

  async function handleLogoDelete() {
    if (!user) return;
    setLogoUploading(true);
    try {
      // Best-effort cleanup of the actual storage object — the exact
      // extension isn't tracked in state (only the resulting public URL
      // is), so list the user's folder and remove anything matching
      // "logo.*" rather than guessing the extension.
      const { data: files } = await supabase.storage.from("org-logos").list(user.id);
      const logoFiles = (files ?? []).filter(f => f.name.startsWith("logo."));
      if (logoFiles.length > 0) {
        await supabase.storage.from("org-logos").remove(logoFiles.map(f => `${user.id}/${f.name}`));
      }
    } catch (err) {
      console.error("Logo file cleanup failed (continuing to clear the DB field regardless):", err);
    }
    const { error } = await supabase.from("organizations").update({ logo_url: null }).eq("user_id", user.id);
    if (error) { alert(`Couldn't remove logo: ${error.message}`); setLogoUploading(false); return; }
    setLogoUrl(null);
    await refreshProfile();
    setLogoUploading(false);
  }
  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 2 * 1024 * 1024) { alert("File size must be under 2 MB."); return; }
    setLogoUploading(true);
    const ext = file.name.split(".").pop();
    const filePath = `${user.id}/logo.${ext}`;
    const { error: uploadError } = await supabase.storage.from("org-logos").upload(filePath, file, { upsert: true });
    if (uploadError) { alert(`Upload failed: ${uploadError.message}`); setLogoUploading(false); return; }
    const { data } = supabase.storage.from("org-logos").getPublicUrl(filePath);
    await supabase.from("organizations").update({ logo_url: data.publicUrl }).eq("user_id", user.id);
    setLogoUrl(data.publicUrl);
    await refreshProfile();
    setLogoUploading(false);
  }

  async function handlePersonalPhotoDelete() {
    if (!user) return;
    setPersonalPhotoUploading(true);
    try {
      const { data: files } = await supabase.storage.from("org-logos").list(user.id);
      const avatarFiles = (files ?? []).filter(f => f.name.startsWith("avatar."));
      if (avatarFiles.length > 0) {
        await supabase.storage.from("org-logos").remove(avatarFiles.map(f => `${user.id}/${f.name}`));
      }
    } catch (err) {
      console.error("Personal photo file cleanup failed (continuing to clear the DB field regardless):", err);
    }
    const { error } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", user.id);
    if (error) { alert(`Couldn't remove photo: ${error.message}`); setPersonalPhotoUploading(false); return; }
    await refreshProfile();
    setPersonalPhotoUploading(false);
  }
  async function handlePersonalPhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 2 * 1024 * 1024) { alert("File size must be under 2 MB."); return; }
    setPersonalPhotoUploading(true);
    const ext = file.name.split(".").pop();
    const filePath = `${user.id}/avatar.${ext}`;
    const { error: uploadError } = await supabase.storage.from("org-logos").upload(filePath, file, { upsert: true });
    if (uploadError) { alert(`Upload failed: ${uploadError.message}`); setPersonalPhotoUploading(false); return; }
    const { data } = supabase.storage.from("org-logos").getPublicUrl(filePath);
    await supabase.from("profiles").update({ avatar_url: data.publicUrl }).eq("id", user.id);
    await refreshProfile();
    setPersonalPhotoUploading(false);
  }

  async function handleAvatarDelete() {
    if (!user) return;
    setAvatarUploading(true);
    try {
      const { data: files } = await supabase.storage.from("avatars").list(user.id);
      const avatarFiles = (files ?? []).filter(f => f.name.startsWith("avatar."));
      if (avatarFiles.length > 0) {
        await supabase.storage.from("avatars").remove(avatarFiles.map(f => `${user.id}/${f.name}`));
      }
    } catch (err) {
      console.error("Avatar file cleanup failed (continuing to clear the DB field regardless):", err);
    }
    const { error } = await supabase.from("profiles").update({ avatar_url: null, updated_at: new Date().toISOString() }).eq("id", user.id);
    if (error) { alert(`Couldn't remove photo: ${error.message}`); setAvatarUploading(false); return; }
    await refreshProfile();
    setAvatarUploading(false);
  }
  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 2 * 1024 * 1024) { alert("File size must be under 2 MB."); return; }
    setAvatarUploading(true);
    const ext = file.name.split(".").pop();
    const filePath = `${user.id}/avatar.${ext}`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, file, { upsert: true });
    if (uploadError) { alert(`Upload failed: ${uploadError.message}`); setAvatarUploading(false); return; }
    const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
    await supabase.from("profiles").update({ avatar_url: data.publicUrl, updated_at: new Date().toISOString() }).eq("id", user.id);
    await refreshProfile();
    setAvatarUploading(false);
  }

  // ── Existing fields ───────────────────────────────────────────────────────
  const [fullName, setFullName]         = useState(profile?.full_name     ?? "");
  const fullNameInvalid = !fullName.trim();  const [country, setCountry]           = useState(profile?.country       ?? "");
  const [bio, setBio]                   = useState(profile?.bio           ?? "");
  const [orgDescription, setOrgDescription] = useState("");
  const [orgName, setOrgName]           = useState(profile?.org_name      ?? "");
  const [roleTitle, setRoleTitle]       = useState(profile?.role_title    ?? "");
  const [phone, setPhone]               = useState(profile?.phone         ?? "");
  const [linkedinUrl, setLinkedinUrl]   = useState(profile?.linkedin_url  ?? "");
  const [website, setWebsite]           = useState(profile?.website       ?? "");

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name     ?? "");
    setCountry(profile.country        ?? "");
    setBio(profile.bio                ?? "");
    setOrgName(profile.org_name       ?? "");
    setRoleTitle(profile.role_title   ?? "");
    setPhone(profile.phone            ?? "");
    setLinkedinUrl(profile.linkedin_url ?? "");
    setWebsite(profile.website        ?? "");
    setSectors(profile.sectors        ?? []);
    if (profile.social_links) setSocialLinks(profile.social_links);
  }, [profile?.id]);

  const [socialLinks, setSocialLinks]   = useState<{ label: string; url: string }[]>(profile?.social_links ?? []);
  const [socialLabel, setSocialLabel]   = useState("");
  const [socialUrl, setSocialUrl]       = useState("");

  useEffect(() => {
    if (profile?.social_links) setSocialLinks(profile.social_links);
  }, [profile?.social_links]);

  const [registrationType, setRegistrationType]     = useState<string | null>(null);
  const [registrationNumber, setRegistrationNumber] = useState<string | null>(null);
  const [tin, setTin]                               = useState<string | null>(null);
  const [scumlNumber, setScumlNumber]               = useState<string | null>(null);
  const [yearFounded, setYearFounded]               = useState<number | null>(null);
  const [sectors, setSectors]   = useState<string[]>(profile?.sectors  ?? []);
  

  async function handleSave() {
    if (!user) return;
    if (grantRangeInvalid || fullNameInvalid) {
      setSaveBlocked(true);
      return;
    }
    setSaveBlocked(false);
    setSaving(true);
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        full_name:   fullName    || null,
        country:     country     || null,
        bio:         bio         || null,
        org_name:    orgName     || null,
        role_title:  roleTitle   || null,
        phone:       phone       || null,
        linkedin_url: linkedinUrl || null,
        website:     website     || null,
        social_links: socialLinks.length > 0 ? socialLinks : null,
        sectors:     sectors.length > 0 ? sectors : null,
        org_type:    orgType     || null,
        updated_at:  new Date().toISOString(),
      })
      .eq("id", user.id);

    if (profileError) console.error("Profile update error:", profileError);

    if (isOrgOwner && profile?.user_type === "organisation") {
      const { error: thesisError } = await supabase
        .from("organizations")
        .update({
          investment_thesis: investmentThesis || null,
          website: website || null,
          ...(orgType ? { organisation_type: orgType } : {}),
        })
        .eq("user_id", orgOwnerId!);
      if (thesisError) console.error("Investment thesis update error:", thesisError);
    }
    const orgTypeNow = profile?.org_type ?? orgType ?? "";
    const isFunderOrCorporate = ["philanthropic_foundation", "venture_capital", "technology_company", "corporation", "public_sector"].includes(orgTypeNow);
    
    if (isOrgOwner && isFunderOrCorporate) {
      await supabase
        .from("organizations")
        .update({
          grant_range_min: grantRangeMin ? parseFloat(grantRangeMin) : null,
          grant_range_max: grantRangeMax ? parseFloat(grantRangeMax) : null,
          grant_currency: grantCurrency || null,
          funding_instruments: fundingInstruments.length > 0 ? fundingInstruments : null,
          mandate_sectors: mandateSectors.length > 0 ? mandateSectors : null,
          mandate_sdgs: mandateSdgs.length > 0 ? mandateSdgs : null,
          geographic_focus: geographicFocus.length > 0 ? geographicFocus : null,
          stage_preference: stagePreference.length > 0 ? stagePreference : null,
          partner_type_preference: partnerTypePreference.length > 0 ? partnerTypePreference : null,
          csr_budget_range: csrBudgetRange || null,
          esg_frameworks: esgFrameworks.length > 0 ? esgFrameworks : null,
          csr_focus_statement: csrFocusStatement || null,
          employee_engagement_available: employeeEngagement,
          cobranding_open: cobrandingOpen,
          inkind_support: inkindSupport.length > 0 ? inkindSupport : null,
          tech_support_available: techSupport.length > 0 ? techSupport : null,
          sandbox_ready: sandboxReady,
          sandbox_description: sandboxDescription || null,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", orgOwnerId!);
    }

    if (isOrgOwner && profile?.user_type === "organisation") {
      await supabase
        .from("organizations")
        .update({
          description: orgDescription || null,
          dd_financial_model: ddFinancialModel,
          dd_audited_accounts: ddAuditedAccounts,
          dd_governance_doc: ddGovernanceDoc,
          dd_esg_assessment: ddEsgAssessment,
          dd_impact_framework: ddImpactFramework,
          dd_environmental_policy: ddEnvironmentalPolicy,
          dd_safeguarding_policy: ddSafeguardingPolicy,
          dd_legal_registration: ddLegalRegistration,
          dd_legal_compliance_declaration: ddLegalComplianceDeclaration,
          dd_evidence: ddEvidence,
          fdd_disbursement_track_record: fddDisbursementTrackRecord,
          fdd_decision_transparency: fddDecisionTransparency,
          fdd_conflict_disclosure: fddConflictDisclosure,
          fdd_governance_doc: fddGovernanceDoc,
          fdd_esg_framework: fddEsgFramework,
          fdd_legal_registration: fddLegalRegistration,
          total_beneficiaries_reached: totalBeneficiaries ? parseInt(totalBeneficiaries) : null,
          jobs_created: jobsCreated ? parseInt(jobsCreated) : null,
          female_beneficiaries_pct: femalePct ? parseInt(femalePct) : null,
          youth_beneficiaries_pct: youthPct ? parseInt(youthPct) : null,
          years_of_operation: yearsOfOperation ? parseInt(yearsOfOperation) : null,
          grants_received_count: grantsCount ? parseInt(grantsCount) : null,
          grants_total_value_usd: grantsTotalValue ? parseFloat(grantsTotalValue) : null,
          grants_delivered_on_time_pct: grantsOnTimePct ? parseInt(grantsOnTimePct) : null,
          previous_funders: previousFunders.length > 0 ? previousFunders : null,
          third_party_evaluations: thirdPartyEvaluations,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", orgOwnerId!);
    }

    await refreshProfile();

    if (isOrgOwner && profile?.user_type === "organisation") {
      const { data } = await supabase.from("organizations")
        .select("logo_url,description,grant_range_min,grant_range_max,grant_currency,funding_instruments,geographic_focus,stage_preference,partner_type_preference,csr_budget_range,esg_frameworks,mandate_sectors,mandate_sdgs,dd_financial_model,dd_audited_accounts,dd_governance_doc,dd_esg_assessment,dd_impact_framework,dd_environmental_policy,dd_safeguarding_policy,dd_legal_registration,dd_legal_compliance_declaration,dd_evidence,fdd_disbursement_track_record,fdd_decision_transparency,fdd_conflict_disclosure,fdd_governance_doc,fdd_esg_framework,fdd_legal_registration,total_beneficiaries_reached,jobs_created,female_beneficiaries_pct,youth_beneficiaries_pct,years_of_operation,grants_received_count,grants_total_value_usd,grants_delivered_on_time_pct,previous_funders,third_party_evaluations,csr_focus_statement,employee_engagement_available,cobranding_open,inkind_support,tech_support_available,sandbox_ready,sandbox_description,srg1_pie_self_declared,srg1_annual_revenue_ngn,srg1_reminder_dismissed_at,registration_type,registration_number,tin,scuml_number,year_founded")
        .eq("user_id", orgOwnerId!).maybeSingle();
      if (data) {
        if (data.previous_funders) setPreviousFunders(data.previous_funders);
        if (data.geographic_focus) setGeographicFocus(data.geographic_focus);
        if (data.funding_instruments) setFundingInstruments(data.funding_instruments);
        if (data.mandate_sectors) setMandateSectors(data.mandate_sectors);
        if (data.mandate_sdgs) setMandateSdgs(data.mandate_sdgs);
        if (data.stage_preference) setStagePreference(data.stage_preference);
        if (data.partner_type_preference) setPartnerTypePreference(data.partner_type_preference);
        if (data.esg_frameworks) setEsgFrameworks(data.esg_frameworks);
        if (data.inkind_support) setInkindSupport(data.inkind_support);
        if (data.tech_support_available) setTechSupport(data.tech_support_available);
      }
    }

    setSaving(false);
    setSavedState(true);
    setTimeout(() => setSavedState(false), 3000);
  }

  // Profile strength is a general-purpose indicator, deliberately distinct
  // from the "mandate/CSR completeness" score shown on FunderHome/
  // CorporateHome (which is a fixed 7-field formula mirrored server-side in
  // refresh-partnership-matches and must not change here). This score
  // instead weighs the specific fields confirmed — by reading
  // generate-deal-memo, generate-csr-brief, and match-orgs-for-partnership
  // directly — to actually feed AI decisions: investment thesis (funders),
  // DD readiness (implementers, scored proportionally since deal-memo's DD
  // override depends on partial completion, not just "any box checked"),
  // and beneficiaries reached (implementers, the one track-record field
  // named in match-orgs-for-partnership's prompt). Other track-record
  // fields (grants count/value, previous funders, etc.) are collected but
  // not currently read by any AI function, so they're left out rather than
  // padding the score with fields that don't inform anything.
  const ddReadinessItems = [ddFinancialModel, ddAuditedAccounts, ddGovernanceDoc, ddEsgAssessment, ddImpactFramework, ddEnvironmentalPolicy, ddSafeguardingPolicy, ddLegalRegistration, ddLegalComplianceDeclaration];
  const fddReadinessItems = [fddDisbursementTrackRecord, fddDecisionTransparency, fddConflictDisclosure, fddGovernanceDoc, fddEsgFramework, fddLegalRegistration];
  const ddReadinessFraction = ddReadinessItems.filter(Boolean).length / ddReadinessItems.length;
  const fddReadinessFraction = fddReadinessItems.filter(Boolean).length / fddReadinessItems.length;
  const orgTypeStrengthItems: number[] = isFunder
    ? [investmentThesis ? 1 : 0, fddReadinessFraction]
    : isImplementer
    ? [ddReadinessFraction, totalBeneficiaries !== "" ? 1 : 0]
    : isCorporate
    ? [fddReadinessFraction] // corporate's other AI-consumed fields (CSR focus, budget, ESG frameworks) are already in the base 7 org items via completeness parity — fddReadinessFraction is the one genuinely new signal since the funder/corporate DD checklist was added
    : [];
  // linkedinUrl belongs to the contact person for org accounts (set only
  // on the Contact Details pane, which the Online Presence pane doesn't
  // even render for isOrg — `{!isOrg && (...)}` excludes it there). It is
  // not evidence of the ORGANISATION's own online presence, so it must not
  // count for orgs. Individuals keep it since their presence pane does show
  // LinkedIn as their own.
  // Split into two separate scored items instead of one OR-check, so a
  // single social link no longer swings the whole "online presence" share
  // at once (that combined item was worth 1/7 ≈ 14% of the base score for
  // corporate accounts specifically, since they get no extra org-type
  // items — the exact 81→95 jump reported). Each half is now ~half that.
  // Online presence is either/or again (website alone or one social link
  // alone both fully satisfy it — matching how the pane itself treats them
  // as interchangeable), but now capped at a flat 5% of the total rather
  // than sharing equal weight with every other item, which is what caused
  // one social link to swing the score by ~12-14 points.
  const orgOnlinePresence = !!website || socialLinks.length > 0;
  const individualOnlinePresence = !!website || socialLinks.length > 0 || !!linkedinUrl;
  const baseOrgItems = [!!fullName, !!orgDescription, !!country, !!orgName, sectors.length > 0, !!logoUrl].map(v => v ? 1 : 0);
  const otherItemValues: number[] = isOrg
    ? [...baseOrgItems, ...orgTypeStrengthItems]
    : [!!fullName, !!roleTitle, !!bio, !!country, sectors.length > 0, !!profile?.avatar_url].map(v => v ? 1 : 0);
  // Verification is weighted separately at a fixed 5% rather than as one
  // more equal-weight item — folding it into profileStrengthValues as a
  // plain 1-of-N entry would make it worth 12-14% depending on org type,
  // not the small nudge intended. Individuals have no verification concept
  // (the Verification pane only renders for isOrg), so they keep the
  // original straight average.
  // Fixed weight budget: online presence 5%, verification 10% (org only),
  // everything else splits whatever's left. Verification moved 5% -> 10%
  // per explicit request.
  const ONLINE_PRESENCE_WEIGHT = 5;
  const VERIFICATION_WEIGHT = isOrg ? 10 : 0;
  const otherItemsWeight = 100 - ONLINE_PRESENCE_WEIGHT - VERIFICATION_WEIGHT;
  const otherItemsPct = (otherItemValues.reduce((a, b) => a + b, 0) / otherItemValues.length) * 100;
  const strengthScore = Math.round(
    (otherItemsPct / 100) * otherItemsWeight +
    ((isOrg ? orgOnlinePresence : individualOnlinePresence) ? ONLINE_PRESENCE_WEIGHT : 0) +
    (isOrg && profile?.is_verified ? VERIFICATION_WEIGHT : 0)
  );
  const strengthLabel = strengthScore >= 80 ? "Strong" : strengthScore >= 50 ? "Good" : "Needs work";
  const strengthColor = strengthScore >= 80 ? "#2D6A4F" : strengthScore >= 50 ? "#f59e0b" : "#C45C26";

  const SaveBar = () => (
    <div className="space-y-2 pt-2">
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving || grantRangeInvalid || fullNameInvalid}
          className="text-white rounded-full px-6 disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-110 transition-all"
          style={{ background: "linear-gradient(135deg, #3D2618 0%, #33301F 50%, #1B3328 100%)" }}>
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Save changes
        </Button>
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-[#2D6A4F]">
            <CheckCircle2 className="w-4 h-4" /> Saved
          </span>
        )}
      </div>
      {fullNameInvalid && (
        <p className="text-xs text-red-500">Full name is required.</p>
      )}
      {(grantRangeInvalid || saveBlocked) && (
        <p className="text-xs text-red-500">
          Max must be greater than or equal to Min. Fix the grant/investment range in{" "}
          <button type="button" onClick={() => setActivePane("mandate")} className="underline underline-offset-2 font-medium">
            Mandate
          </button>{" "}
        </p>
      )}
    </div>
  );
  return (
    <div className="w-full relative">
      <div className="space-y-4 md:pr-[304px]">
        <div className="flex flex-col md:flex-row md:gap-6">

          {/* Spacer reserving the fixed nav's old slot in normal flow
              (desktop only) -- also what we measure to position the nav */}
          <div ref={paneNavSpacerRef} className="hidden md:block md:w-[200px] shrink-0" />

          {/* Inner left pane nav -- fixed on desktop (measured left offset,
              see paneNavLeft above), normal horizontal-scroll tab bar on
              mobile, unchanged there. */}
          <div className="md:w-[200px] shrink-0 border-x border-border bg-muted/20 md:fixed md:top-[96px] md:min-h-[calc(100vh-96px)]"
            style={paneNavLeft !== null ? { left: paneNavLeft } : undefined}>
            <div className="flex md:flex-col overflow-x-auto md:overflow-visible p-2 md:pt-[28px] gap-1 scrollbar-hide" style={{ WebkitOverflowScrolling: "touch" }}>
              {panes.map(p => (
                <button key={p.key} type="button" onClick={() => setActivePane(p.key)}
                  className={`text-left px-3 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap md:whitespace-normal transition-all shrink-0 ${
                    activePane === p.key
                      ? "text-white shadow-sm"
                      : "text-black dark:text-white hover:bg-muted"
                  }`}
                  style={activePane === p.key ? { background: "linear-gradient(135deg, #3D2618 0%, #33301F 50%, #1B3328 100%)" } : undefined}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Pane shell (content only now -- nav no longer lives inside it) ── */}
          <div className="flex-1 min-w-0 md:-mt-12 rounded-b-2xl border-x border-b border-border bg-white dark:bg-card">

            {/* Content area */}
            <div className="p-6 space-y-6 min-w-0">

              {/* ── BASIC / CONTACT DETAILS PANE ── */}
              {activePane === "basic" && !isOrg && (
                <SectionCardGroup>
                  <div className="px-8 sm:px-12 py-10">
                    <p className="text-xl font-bold text-[#111111] dark:text-[#F5F5F5] mb-6">Profile photo</p>
                    <div className="flex items-center gap-5">
                      <div className="group relative w-14 h-14">
                        <UserAvatar id={user?.id ?? ""} name={profile?.full_name} avatarUrl={profile?.avatar_url} size="lg" />
                        {profile?.avatar_url && (
                          <button type="button" onClick={handleAvatarDelete} disabled={avatarUploading}
                            className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50 z-10"
                            title="Remove photo">
                            <Trash2 className="w-4 h-4 text-white" />
                          </button>
                        )}
                        <label className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#2D6A4F] flex items-center justify-center cursor-pointer hover:bg-[#245c43] transition-colors z-10">
                          <Camera className="w-3 h-3 text-white" />
                          <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={handleAvatarUpload} />
                        </label>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">Upload a photo</p>
                        <p className="text-xs text-black dark:text-white mt-0.5">PNG, JPG or WebP. Max 2 MB.</p>
                        {avatarUploading && (
                          <p className="text-xs text-[#2D6A4F] mt-1 flex items-center gap-1">
                            <Loader2 className="w-3 h-3 animate-spin" /> Uploading...
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {!isTeamMember && (
                  <div className="px-8 sm:px-12 py-10">
                    <div className="rounded-xl border border-dashed border-[#2D6A4F]/40 bg-[#2D6A4F]/5 p-5 flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-[rgba(45,106,79,0.12)] flex items-center justify-center shrink-0">
                        <Building2 className="w-5 h-5 text-[#2D6A4F]" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-foreground">Represent an organisation?</p>
                        <p className="text-xs text-black dark:text-white mt-1 leading-relaxed">
                          Register your organisation without losing your individual profile or activity.
                        </p>
                        <Link href="/dashboard/upgrade-organisation"
                          className="inline-flex items-center gap-1.5 mt-3 text-sm font-semibold text-[#2D6A4F] hover:underline underline-offset-2">
                          Register an organisation
                        </Link>
                      </div>
                    </div>
                  </div>
                  )}

                  <SectionCard title="Contact details" onEdit={openIndividualContactModal}>
                    <DisplayField label="Full name">
                      {fullName ? <p className="text-sm text-black dark:text-white">{fullName}</p> : <EmptyValue />}
                    </DisplayField>
                    <DisplayField label="Country">
                      {country ? <p className="text-sm text-black dark:text-white">{country}</p> : <EmptyValue />}
                    </DisplayField>
                    <DisplayField label="Headline">
                      {roleTitle ? <p className="text-sm text-black dark:text-white">{roleTitle}</p> : <EmptyValue />}
                    </DisplayField>
                    <DisplayField label="Phone">
                      {phone ? <p className="text-sm text-black dark:text-white">{phone}</p> : <EmptyValue />}
                    </DisplayField>
                    <DisplayField label="Bio">
                      {bio ? <p className="text-sm text-black dark:text-white leading-relaxed">{bio}</p> : <EmptyValue />}
                    </DisplayField>
                  </SectionCard>
                </SectionCardGroup>
              )}

              {/* ── INDIVIDUAL FOCUS AREAS PANE ── */}
              {activePane === "focus" && !isOrg && (
                <SectionCardGroup>
                  <div className="pt-[88px]">
                  <SectionCard title="Focus areas" onEdit={openFocusModal}>
                    <DisplayField label="Sectors">
                      {sectors.length > 0
                        ? <div className="flex flex-wrap gap-2">{sectors.map(s => <FlatTag key={s}>{s}</FlatTag>)}</div>
                        : <EmptyValue />}
                    </DisplayField>
                  </SectionCard>
                  </div>
                </SectionCardGroup>
              )}

              {/* ── INDIVIDUAL ONLINE PRESENCE PANE ── */}
              {activePane === "presence" && !isOrg && (
                <SectionCardGroup>
                  <div className="pt-[88px]">
                  <SectionCard title="Online presence" onEdit={openPresenceModal}>
                    <DisplayField label="LinkedIn">
                      {linkedinUrl ? (
                        <a href={linkedinUrl} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm text-black dark:text-white hover:text-[#2D6A4F] transition-colors">
                          <Linkedin className="w-4 h-4 shrink-0" />
                          <span className="truncate">{linkedinUrl}</span>
                        </a>
                      ) : <EmptyValue />}
                    </DisplayField>
                    <DisplayField label="Website or portfolio">
                      {website ? (
                        <a href={website} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm text-black dark:text-white hover:text-[#2D6A4F] transition-colors">
                          <Globe className="w-4 h-4 shrink-0" />
                          <span className="truncate">{website.replace(/^https?:\/\//, "")}</span>
                        </a>
                      ) : <EmptyValue />}
                    </DisplayField>
                    <DisplayField label="Social profiles">
                      {socialLinks.length > 0
                        ? (
                          <div className="space-y-2">
                            {socialLinks.map((s, i) => {
                              const Icon = socialPlatformIcon(s.label);
                              return (
                                <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center gap-2 text-sm text-black dark:text-white hover:text-[#2D6A4F] transition-colors">
                                  <Icon className="w-4 h-4 shrink-0" />
                                  <span className="truncate">{s.url}</span>
                                </a>
                              );
                            })}
                          </div>
                        )
                        : <EmptyValue />}
                    </DisplayField>
                  </SectionCard>
                  </div>
                </SectionCardGroup>
              )}

              {editingContactSection && !isOrg && (
                <EditModal title="Edit basic info" onClose={() => setEditingContactSection(false)} onSave={saveIndividualContactSection} saving={contactSaving}>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium">Full name</Label>
                      <Input value={draftFullName} onChange={e => setDraftFullName(e.target.value)} className="mt-1 h-10" placeholder="e.g. Amara Osei" />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Country</Label>
                      <CountryPicker value={draftCountry} onChange={setDraftCountry} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium">Headline</Label>
                      <Input value={draftRoleTitle} onChange={e => setDraftRoleTitle(e.target.value.slice(0, 120))} className="mt-1 h-10" placeholder="e.g. Impact Evaluator & Filmmaker" />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Phone</Label>
                      <Input value={draftPhone} onChange={e => setDraftPhone(e.target.value)} className="mt-1 h-10" placeholder="+234 800 000 0000" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Bio</Label>
                    <Textarea value={draftBio} onChange={e => setDraftBio(e.target.value)} className="mt-1 resize-none" rows={3}
                      placeholder="What do you work on? What's your focus area?" />
                  </div>
                </EditModal>
              )}

{activePane === "basic" && isOrg && (
                <SectionCardGroup>
                  <div className="px-8 sm:px-12 py-10">
                    <div className="flex items-center gap-1.5 mb-6">
                      <p className="text-xl font-bold text-[#111111] dark:text-[#F5F5F5]">Contact</p>
                      <InfoTooltip text="Used as your organisation's contact person. If you turn on 'also appear as an individual,' this also becomes your personal profile in the Natives directory." />
                    </div>
                    {/* Unconditional now — this section always renders so the
                        pane has the same shape whether show_individual_profile
                        is on or off. Lets someone fill in a personal photo
                        ahead of time and flip the toggle on whenever they're
                        ready, rather than the section appearing/disappearing
                        and changing the pane's layout depending on that flag. */}
                    <div className="rounded-xl border border-dashed border-border p-4 space-y-3">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-semibold uppercase tracking-wider text-black dark:text-white">Your personal photo</p>
                          <InfoTooltip text='Only shown on your individual profile in the Natives directory if "also appear as an individual" is turned on.' />
                        </div>
                      </div>
                      <div className="flex items-center gap-5">
                      <div className="group relative w-14 h-14 rounded-full border border-border bg-white dark:bg-card flex items-center justify-center overflow-hidden shrink-0">
                            {profile?.avatar_url ? (
                              <img src={profile.avatar_url} alt="Personal photo" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-xl font-bold text-black dark:text-white">{(fullName || "?")[0].toUpperCase()}</span>
                            )}
                            {profile?.avatar_url && (
                              <button type="button" onClick={handlePersonalPhotoDelete} disabled={personalPhotoUploading}
                                className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                                title="Remove photo">
                                <Trash2 className="w-4 h-4 text-white" />
                              </button>
                            )}
                          </div>
                        <div>
                          <label className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border text-sm text-black dark:text-white hover:text-foreground hover:border-foreground/30 transition-colors cursor-pointer">
                            <Camera className="w-3.5 h-3.5" />
                            {profile?.avatar_url ? "Replace photo" : "Upload photo"}
                            <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={handlePersonalPhotoUpload} />
                          </label>
                          <p className="text-xs text-black dark:text-white mt-1.5">PNG, JPG or WebP. Max 2 MB.</p>
                          {personalPhotoUploading && (
                            <p className="text-xs text-[#2D6A4F] mt-1 flex items-center gap-1">
                              <Loader2 className="w-3 h-3 animate-spin" /> Uploading...
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <SectionCard editable={isOrgOwner} title="Contact Details" onEdit={openOrgContactModal}>
                    <DisplayField label="Full name">
                      {fullName ? <p className="text-sm text-black dark:text-white">{fullName}</p> : <EmptyValue />}
                    </DisplayField>
                    <DisplayField label="Role / Title">
                      {roleTitle ? <p className="text-sm text-black dark:text-white">{roleTitle}</p> : <EmptyValue />}
                    </DisplayField>
                    <DisplayField label="Email">
                      <p className="text-sm text-black dark:text-white">{user?.email ?? ""}</p>
                      <p className="text-xs text-black dark:text-white opacity-60 mt-1">Your sign-in email. Cannot be changed here.</p>
                    </DisplayField>
                    <DisplayField label="Phone">
                      {phone ? <p className="text-sm text-black dark:text-white">{phone}</p> : <EmptyValue />}
                    </DisplayField>
                    <DisplayField label="LinkedIn">
                      {linkedinUrl ? (
                        <a href={linkedinUrl} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm text-black dark:text-white hover:text-[#2D6A4F] transition-colors">
                          <Linkedin className="w-4 h-4 shrink-0" />
                          <span className="truncate">{linkedinUrl}</span>
                        </a>
                      ) : <EmptyValue />}
                    </DisplayField>
                  </SectionCard>
                </SectionCardGroup>
              )}

              {editingContactSection && isOrg && (
                <EditModal title="Edit contact person" onClose={() => setEditingContactSection(false)} onSave={saveOrgContactSection} saving={contactSaving}>
                  <div>
                    <Label className="text-sm font-medium">Full name <span className="text-destructive">*</span></Label>
                    <Input value={draftFullName} onChange={e => setDraftFullName(e.target.value)} className="mt-1 h-10" placeholder="e.g. Amara Osei" required />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Role / Title <span className="text-black dark:text-white font-normal text-xs">(optional)</span></Label>
                    <Input value={draftRoleTitle} onChange={e => setDraftRoleTitle(e.target.value)} className="mt-1 h-10" placeholder="e.g. Executive Director, Programme Manager" />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Phone <span className="text-black dark:text-white font-normal text-xs">(optional)</span></Label>
                    <Input value={draftPhone} onChange={e => setDraftPhone(e.target.value)} className="mt-1 h-10" placeholder="+234 800 000 0000" />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">LinkedIn <span className="text-black dark:text-white font-normal text-xs">(optional)</span></Label>
                    <Input value={draftLinkedinUrl} onChange={e => setDraftLinkedinUrl(e.target.value)} className="mt-1 h-10" placeholder="https://linkedin.com/in/..." type="url" />
                  </div>
                </EditModal>
              )}

              {/* ── ORGANISATION PANE ── */}
              {activePane === "organisation" && isOrg && (
                <>
                <div className="flex items-center justify-end gap-4 px-8 sm:px-12 pt-6">
                  <button type="button" onClick={() => {
                    const keys = ["legal_identity", "focus", "presence"];
                    if (isImplementer) keys.push("dd", "track");
                    if (isFunder || isCorporate) keys.push("fdd");
                    if (isFunder) keys.push("mandate");
                    if (isCorporate) {
                      keys.push("csr_esg", "csr_partnership", "csr_compliance");
                      if (profile?.org_type === "technology_company") keys.push("csr_tech");
                    }
                    setExpandedOrgSections(new Set(keys));
                  }} title="Expand all" aria-label="Expand all" className="text-[#2D6A4F] hover:opacity-70 transition-opacity">
                    <ChevronsDown className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => setExpandedOrgSections(new Set())} title="Collapse all" aria-label="Collapse all" className="text-black dark:text-white hover:opacity-70 transition-opacity">
                    <ChevronsUp className="w-4 h-4" />
                  </button>
                </div>
                <SectionCardGroup>
                  <SectionCard editable={isOrgOwner} title="Organisation Details" onEdit={openOrgModal}>
                    <div className="flex items-center gap-5">
                      <div className="group relative w-16 h-16 shrink-0">
                        <div className="w-16 h-16 rounded-xl border border-border bg-white dark:bg-card flex items-center justify-center overflow-hidden">
                          {logoUrl ? (
                            <img src={logoUrl} alt="Organisation logo" className="w-full h-full object-contain" />
                          ) : (
                            <span className="text-2xl font-bold text-black dark:text-white">{(orgName || profile?.org_name || "?")[0].toUpperCase()}</span>
                          )}
                        </div>
                        {logoUrl && (
                          <button type="button" onClick={handleLogoDelete} disabled={logoUploading}
                            className="absolute inset-0 rounded-xl bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                            title="Remove logo">
                            <Trash2 className="w-5 h-5 text-white" />
                          </button>
                        )}
                      </div>

                      <div>
                        <label className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border text-sm text-black dark:text-white hover:text-foreground hover:border-foreground/30 transition-colors cursor-pointer">
                          <Camera className="w-3.5 h-3.5" />
                          {logoUrl ? "Replace logo" : "Upload logo"}
                          <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" onChange={handleLogoUpload} />
                        </label>
                        <p className="text-xs text-black dark:text-white mt-1.5">PNG, JPG, WebP or SVG. Max 2 MB.</p>
                        {logoUploading && (
                          <p className="text-xs text-[#2D6A4F] mt-1 flex items-center gap-1">
                            <Loader2 className="w-3 h-3 animate-spin" /> Uploading...
                          </p>
                        )}
                        {logoUrl && !logoUploading && <p className="text-xs text-[#2D6A4F] mt-1">Logo saved.</p>}
                      </div>
                    </div>
                    <DisplayField label="Organisation name">
                      {orgName ? <p className="text-sm text-black dark:text-white">{orgName}</p> : <EmptyValue />}
                    </DisplayField>
                    <DisplayField label="Organisation type">
                      <p className="text-sm text-black dark:text-white">
                        {ORG_TYPE_OPTIONS.find(o => o.value === (profile?.org_type ?? orgType))?.label ?? "Not set"}
                      </p>
                      <p className="text-xs text-black dark:text-white opacity-60 mt-1">Cannot be changed. Contact support if this is incorrect.</p>
                    </DisplayField>
                    <DisplayField label="Organisation description">
                      {orgDescription ? <p className="text-sm text-black dark:text-white leading-relaxed">{orgDescription}</p> : <EmptyValue />}
                    </DisplayField>
                    <DisplayField label="Country">
                      {country ? <p className="text-sm text-black dark:text-white">{country}</p> : <EmptyValue />}
                    </DisplayField>
                  </SectionCard>

              {editingOrgSection && (
                <EditModal title="Edit organisation" onClose={() => setEditingOrgSection(false)} onSave={saveOrgSection} saving={orgSectionSaving}>
                  <div>
                    <Label className="text-sm font-medium">Organisation name</Label>
                    <Input value={draftOrgName} onChange={e => setDraftOrgName(e.target.value)} className="mt-1 h-10" placeholder="e.g. Ashoka Foundation" />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Organisation description</Label>
                    <Textarea value={draftOrgDescription} onChange={e => setDraftOrgDescription(e.target.value)} className="mt-1 resize-none" rows={4}
                      placeholder="What does your organisation do, where does it work, and who does it serve?" />
                    <p className="text-xs text-black dark:text-white opacity-60 mt-1.5">Shown on your directory profile and used by AI to match you with relevant partners.</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Country</Label>
                    <CountryPicker value={draftCountry} onChange={setDraftCountry} />
                  </div>
                </EditModal>
              )}

              {/* ── LEGAL IDENTITY PANE ── */}
              {activePane === "organisation" && (
                <SectionCard editable={isOrgOwner} title="Legal identity" onEdit={openLegalIdentityModal}
                  collapsible expanded={expandedOrgSections.has("legal_identity")} onToggle={() => toggleOrgSection("legal_identity")}>
                    <DisplayField label="Registration type">
                      {registrationType ?? <EmptyValue />}
                    </DisplayField>
                    <DisplayField label="Registration number">
                      {registrationNumber ?? <EmptyValue />}
                    </DisplayField>
                    <DisplayField label="TIN">
                      {tin ?? <EmptyValue />}
                    </DisplayField>
                    <DisplayField label="SCUML / AML registration">
                      {scumlNumber ?? <EmptyValue />}
                    </DisplayField>
                    <DisplayField label="Year founded">
                      {yearFounded ?? <EmptyValue />}
                    </DisplayField>
                </SectionCard>
              )}

              {editingLegalIdentityOpen && (
                <EditModal title="Edit legal identity" onClose={() => setEditingLegalIdentityOpen(false)} onSave={saveLegalIdentitySection} saving={legalIdentitySaving}>
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium">Registration type</Label>
                      <p className="text-xs text-black dark:text-white opacity-60 mt-0.5 mb-2">e.g. CAC, NGO, Trust, Foundation, LLC</p>
                      <input
                        type="text"
                        value={draftRegistrationType}
                        onChange={e => setDraftRegistrationType(e.target.value)}
                        placeholder="e.g. CAC (Incorporated Trustee)"
                        className="w-full border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm bg-white dark:bg-white/5 text-black dark:text-white focus:outline-none focus:ring-1 focus:ring-[#2D6A4F]"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Registration number</Label>
                      <p className="text-xs text-black dark:text-white opacity-60 mt-0.5 mb-2">Official number from your registering body</p>
                      <input
                        type="text"
                        value={draftRegistrationNumber}
                        onChange={e => setDraftRegistrationNumber(e.target.value)}
                        placeholder="e.g. RC1234567"
                        className="w-full border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm bg-white dark:bg-white/5 text-black dark:text-white focus:outline-none focus:ring-1 focus:ring-[#2D6A4F]"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Tax Identification Number (TIN)</Label>
                      <p className="text-xs text-black dark:text-white opacity-60 mt-0.5 mb-2">Issued by your national tax authority</p>
                      <input
                        type="text"
                        value={draftTin}
                        onChange={e => setDraftTin(e.target.value)}
                        placeholder="e.g. 12345678-0001"
                        className="w-full border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm bg-white dark:bg-white/5 text-black dark:text-white focus:outline-none focus:ring-1 focus:ring-[#2D6A4F]"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">SCUML / AML registration number</Label>
                      <p className="text-xs text-black dark:text-white opacity-60 mt-0.5 mb-2">Special Control Unit Against Money Laundering — required for NGOs in Nigeria</p>
                      <input
                        type="text"
                        value={draftScumlNumber}
                        onChange={e => setDraftScumlNumber(e.target.value)}
                        placeholder="e.g. SCUML/NGO/2024/00123"
                        className="w-full border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm bg-white dark:bg-white/5 text-black dark:text-white focus:outline-none focus:ring-1 focus:ring-[#2D6A4F]"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Year founded</Label>
                      <p className="text-xs text-black dark:text-white opacity-60 mt-0.5 mb-2">The year your organisation was formally established</p>
                      <input
                        type="number"
                        value={draftYearFounded}
                        onChange={e => setDraftYearFounded(e.target.value)}
                        placeholder="e.g. 2015"
                        min={1900}
                        max={new Date().getFullYear()}
                        className="w-full border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm bg-white dark:bg-white/5 text-black dark:text-white focus:outline-none focus:ring-1 focus:ring-[#2D6A4F]"
                      />
                    </div>
                  </div>
                </EditModal>
              )}

              {/* ── FOCUS AREAS PANE ── */}
              {activePane === "organisation" && (
                <SectionCard editable={isOrg ? isOrgOwner : true} title="Focus areas" onEdit={openFocusModal}
                  collapsible expanded={expandedOrgSections.has("focus")} onToggle={() => toggleOrgSection("focus")}>
                    <DisplayField label="Sectors">
                      {sectors.length > 0
                        ? <div className="flex flex-wrap gap-2">{sectors.map(s => <FlatTag key={s}>{s}</FlatTag>)}</div>
                        : <EmptyValue />}
                    </DisplayField>
                </SectionCard>
              )}

              {/* ── ONLINE PRESENCE PANE ── */}
              {activePane === "organisation" && (
                <SectionCard editable={isOrg ? isOrgOwner : true} title="Online presence" onEdit={openPresenceModal}
                  collapsible expanded={expandedOrgSections.has("presence")} onToggle={() => toggleOrgSection("presence")}>
                    {!isOrg && (
                      <DisplayField label="LinkedIn">
                        {linkedinUrl ? (
                          <a href={linkedinUrl} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm text-black dark:text-white hover:text-[#2D6A4F] transition-colors">
                            <Linkedin className="w-4 h-4 shrink-0" />
                            <span className="truncate">{linkedinUrl}</span>
                          </a>
                        ) : <EmptyValue />}
                      </DisplayField>
                    )}
                    <DisplayField label="Website or portfolio">
                      {website ? (
                        <a href={website} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm text-black dark:text-white hover:text-[#2D6A4F] transition-colors">
                          <Globe className="w-4 h-4 shrink-0" />
                          <span className="truncate">{website.replace(/^https?:\/\//, "")}</span>
                        </a>
                      ) : <EmptyValue />}
                    </DisplayField>
                    <DisplayField label="Social profiles">
                      {socialLinks.length > 0
                        ? (
                          <div className="space-y-2">
                            {socialLinks.map((s, i) => {
                              const Icon = socialPlatformIcon(s.label);
                              return (
                                <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center gap-2 text-sm text-black dark:text-white hover:text-[#2D6A4F] transition-colors">
                                  <Icon className="w-4 h-4 shrink-0" />
                                  <span className="truncate">{s.url}</span>
                                </a>
                              );
                            })}
                          </div>
                        )
                        : <EmptyValue />}
                    </DisplayField>
                </SectionCard>
              )}

              {/* ── DD READINESS PANE ── */}
              {activePane === "organisation" && isImplementer && (
                <div>
                  <SectionCard
                    title="Due diligence readiness"
                    titleExtra={<InfoTooltip text={PILLAR_INFO.ddReadiness} />}
                    onEdit={() => {}}
                    editable={false}
                    collapsible
                    expanded={expandedOrgSections.has("dd")}
                    onToggle={() => toggleOrgSection("dd")}
                  >
                    <div>
                    {isSoloConsultancy ? (
                      <p className="text-xs text-black dark:text-white opacity-60">
                        DD Readiness doesn't apply to solo consultancies — the checklist below is built for institutional-scale organisations (audited accounts, board governance, and similar). A consultancy-specific version, based on track record and prior engagements, is planned separately.
                      </p>
                    ) : (
                      <>
                    <p className="text-xs text-black dark:text-white opacity-60 mb-6">
                      Signal to funders that you are investment-ready. Checking an item asks for a few quick details, which appear as a tooltip on your profile once matched.
                    </p>
                    <div className="space-y-3">
                      {[
                        { key: "financial_model", label: "Financial model available", sub: "A current financial model or projections document", state: ddFinancialModel, set: setDdFinancialModel },
                        { key: "audited_accounts", label: "Audited accounts on file", sub: "Most recent audited financial statements", state: ddAuditedAccounts, set: setDdAuditedAccounts },
                        { key: "governance_doc", label: "Governance documentation", sub: "Board structure, org chart, or governance policy", state: ddGovernanceDoc, set: setDdGovernanceDoc },
                        { key: "esg_assessment", label: "ESG self-assessment completed", sub: "Environmental, social and governance baseline assessment", state: ddEsgAssessment, set: setDdEsgAssessment },
                        { key: "impact_framework", label: "Impact measurement framework", sub: "Theory of change, IRIS+ alignment, or outcome tracking methodology", state: ddImpactFramework, set: setDdImpactFramework },
                        { key: "environmental_policy", label: "Environmental policy", sub: "Energy, travel, and waste practices for fieldwork and operations", state: ddEnvironmentalPolicy, set: setDdEnvironmentalPolicy },
                        { key: "safeguarding_policy", label: "Safeguarding policy", sub: "Child protection / protection from sexual exploitation and abuse policy", state: ddSafeguardingPolicy, set: setDdSafeguardingPolicy },
                        { key: "legal_registration", label: "Legal registration / tax-exempt status", sub: "Registered legal entity with valid tax status", state: ddLegalRegistration, set: setDdLegalRegistration },
                        { key: "legal_compliance_declaration", label: "Legal & compliance declaration", sub: "No blacklisting, pending disputes, or undisclosed conflicts", state: ddLegalComplianceDeclaration, set: setDdLegalComplianceDeclaration },
                      ].map(item => item.state ? (
                        <div key={item.key}
                          className="w-full px-4 py-3 rounded-xl border border-black dark:border-white flex items-start gap-3">
                          <button type="button" onClick={() => setDdModalKey(item.key)}
                            className="w-4 h-4 rounded border border-black dark:border-white flex items-center justify-center shrink-0 mt-0.5"
                            title="Review or edit">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-black dark:text-white"><polyline points="20 6 9 17 4 12" /></svg>
                          </button>
                          <button type="button" onClick={() => setDdModalKey(item.key)} className="flex-1 min-w-0 text-left">
                            <p className="text-sm font-medium text-black dark:text-white">{item.label}</p>
                            <p className="text-xs text-black dark:text-white opacity-60 mt-0.5">{item.sub}</p>
                          </button>
                          <button type="button"
                            onClick={() => markDdItemIncomplete(item.key, item.set)}
                            className="text-muted-foreground hover:text-red-500 transition-colors shrink-0 mt-0.5"
                            title="Mark as not complete">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                          </button>
                        </div>
                      ) : (
                        <button key={item.key} type="button" onClick={() => setDdModalKey(item.key)}
                          className="w-full text-left px-4 py-3 rounded-xl border border-border hover:border-foreground/20 transition-colors flex items-start gap-3">
                          <div className="w-4 h-4 rounded border border-border shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-black dark:text-white">{item.label}</p>
                            <p className="text-xs text-black dark:text-white opacity-60 mt-0.5">{item.sub}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                    <div className="pt-6 border-t border-border mt-6">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-black dark:text-white">DD Readiness score</p>
                        <p className="text-xs font-bold text-black dark:text-white">
                          {Math.round((ddReadinessItems.filter(Boolean).length / ddReadinessItems.length) * 100)}%
                        </p>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-[#2D6A4F] transition-all duration-500"
                          style={{ width: `${Math.round((ddReadinessItems.filter(Boolean).length / ddReadinessItems.length) * 100)}%` }} />
                      </div>
                    </div>
                    </>
                    )}
                    </div>
                  </SectionCard>

                  {expandedOrgSections.has("dd") && orgId && !isSoloConsultancy && (
                    <EsgSnapshotSection org={{
                      id: orgId,
                      organisation_name: orgName,
                      organisation_type: orgTypeNow,
                      sector: sectors,
                      country: country,
                      dd_financial_model: ddFinancialModel,
                      dd_audited_accounts: ddAuditedAccounts,
                      dd_governance_doc: ddGovernanceDoc,
                      dd_esg_assessment: ddEsgAssessment,
                      dd_impact_framework: ddImpactFramework,
                      dd_environmental_policy: ddEnvironmentalPolicy,
                      dd_safeguarding_policy: ddSafeguardingPolicy,
                      dd_legal_registration: ddLegalRegistration,
                      dd_legal_compliance_declaration: ddLegalComplianceDeclaration,
                      dd_evidence: ddEvidence,
                      total_beneficiaries_reached: totalBeneficiaries,
                      jobs_created: jobsCreated,
                      female_beneficiaries_pct: femalePct,
                      youth_beneficiaries_pct: youthPct,
                      years_of_operation: yearsOfOperation,
                      grants_received_count: grantsCount,
                      grants_total_value_usd: grantsTotalValue,
                      grants_delivered_on_time_pct: grantsOnTimePct,
                      previous_funders: previousFunders,
                      third_party_evaluations: thirdPartyEvaluations,
                    }} />
                  )}
                </div>
              )}

              {activePane === "organisation" && (isFunder || isCorporate) && (
                <div>
                  <SectionCard
                    title="Due diligence readiness"
                    titleExtra={<InfoTooltip text={PILLAR_INFO.ddReadiness} />}
                    onEdit={() => {}}
                    editable={false}
                    collapsible
                    expanded={expandedOrgSections.has("fdd")}
                    onToggle={() => toggleOrgSection("fdd")}
                  >
                    <div>
                    <p className="text-xs text-black dark:text-white opacity-60 mb-6">
                      Signal to implementers that you are a transparent, trustworthy partner. Checking an item asks for a few quick details, which appear as a tooltip on your profile once matched.
                    </p>
                    <div className="space-y-3">
                      {[
                        { key: "disbursement_track_record", label: "Fund disbursement track record", sub: "Grants or commitments made and how reliably they were paid out", state: fddDisbursementTrackRecord, set: setFddDisbursementTrackRecord },
                        { key: "decision_transparency", label: "Decision-making transparency", sub: "How partnership/funding decisions are made and communicated", state: fddDecisionTransparency, set: setFddDecisionTransparency },
                        { key: "conflict_disclosure", label: "Conflict of interest disclosure", sub: "Related-party ties to funded organisations or board members", state: fddConflictDisclosure, set: setFddConflictDisclosure },
                        { key: "governance_doc", label: "Governance documentation", sub: "Audited accounts and board structure", state: fddGovernanceDoc, set: setFddGovernanceDoc },
                        { key: "esg_framework", label: "ESG framework followed", sub: "Framework used to assess your own funding/investment decisions", state: fddEsgFramework, set: setFddEsgFramework },
                        { key: "legal_registration", label: "Legal registration / tax-exempt status", sub: "Registration and tax status of the funding entity", state: fddLegalRegistration, set: setFddLegalRegistration },
                      ].map(item => item.state ? (
                        <div key={item.key}
                          className="w-full px-4 py-3 rounded-xl border border-black dark:border-white flex items-start gap-3">
                          <button type="button" onClick={() => setDdModalKey(item.key)}
                            className="w-4 h-4 rounded border border-black dark:border-white flex items-center justify-center shrink-0 mt-0.5"
                            title="Review or edit">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-black dark:text-white"><polyline points="20 6 9 17 4 12" /></svg>
                          </button>
                          <button type="button" onClick={() => setDdModalKey(item.key)} className="flex-1 min-w-0 text-left">
                            <p className="text-sm font-medium text-black dark:text-white">{item.label}</p>
                            <p className="text-xs text-black dark:text-white opacity-60 mt-0.5">{item.sub}</p>
                          </button>
                          <button type="button"
                            onClick={() => markDdItemIncomplete(item.key, item.set, "fdd")}
                            className="text-muted-foreground hover:text-red-500 transition-colors shrink-0 mt-0.5"
                            title="Mark as not complete">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                          </button>
                        </div>
                      ) : (
                        <button key={item.key} type="button" onClick={() => setDdModalKey(item.key)}
                          className="w-full text-left px-4 py-3 rounded-xl border border-border hover:border-foreground/20 transition-colors flex items-start gap-3">
                          <div className="w-4 h-4 rounded border border-border shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-black dark:text-white">{item.label}</p>
                            <p className="text-xs text-black dark:text-white opacity-60 mt-0.5">{item.sub}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                    <div className="pt-6 border-t border-border mt-6">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-black dark:text-white">DD Readiness score</p>
                        <p className="text-xs font-bold text-black dark:text-white">
                          {Math.round((fddReadinessItems.filter(Boolean).length / fddReadinessItems.length) * 100)}%
                        </p>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-[#2D6A4F] transition-all duration-500"
                          style={{ width: `${Math.round((fddReadinessItems.filter(Boolean).length / fddReadinessItems.length) * 100)}%` }} />
                      </div>
                    </div>
                    </div>
                  </SectionCard>
                </div>
              )}

{ddModalKey && (() => {
                // Was `FUNDER_DD_ITEMS.some(i => i.key === ddModalKey)` --
                // broken for any key that exists in BOTH checklists
                // (governance_doc, legal_registration). That check only
                // asked "does this key exist in the funder list", which is
                // true even when an implementer opened the modal, since
                // both lists share those two keys. Silently served the
                // funder's questions to implementers and wrote their
                // confirmation to fdd_* columns instead of dd_*, so the
                // implementer's own dd_governance_doc / dd_legal_registration
                // never actually got set to true. Use org type instead --
                // isImplementer is already computed above and is mutually
                // exclusive with isFunder/isCorporate, so this correctly
                // reflects which pane (dd vs fdd) opened the modal.
                const isFunderItem = !isImplementer;
                const item = isFunderItem
                  ? FUNDER_DD_ITEMS.find(i => i.key === ddModalKey)!
                  : DD_ITEMS.find(i => i.key === ddModalKey)!;
                const implementerSetterMap: Record<string, (v: boolean) => void> = {
                  financial_model: setDdFinancialModel,
                  audited_accounts: setDdAuditedAccounts,
                  governance_doc: setDdGovernanceDoc,
                  esg_assessment: setDdEsgAssessment,
                  impact_framework: setDdImpactFramework,
                  environmental_policy: setDdEnvironmentalPolicy,
                  safeguarding_policy: setDdSafeguardingPolicy,
                  legal_registration: setDdLegalRegistration,
                  legal_compliance_declaration: setDdLegalComplianceDeclaration,
                };
                const funderSetterMap: Record<string, (v: boolean) => void> = {
                  disbursement_track_record: setFddDisbursementTrackRecord,
                  decision_transparency: setFddDecisionTransparency,
                  conflict_disclosure: setFddConflictDisclosure,
                  governance_doc: setFddGovernanceDoc,
                  esg_framework: setFddEsgFramework,
                  legal_registration: setFddLegalRegistration,
                };
                const setterMap = isFunderItem ? funderSetterMap : implementerSetterMap;
                const prefix = isFunderItem ? "fdd" : "dd";
                return (
                  <DDEvidenceModal
                    item={item}
                    initialAnswers={ddEvidence[ddModalKey] ?? {}}
                    orgId={orgId ?? ""}
                    userId={user?.id ?? ""}
                    onClose={() => setDdModalKey(null)}
                    onSave={(answers) => saveDdItem(ddModalKey, answers, setterMap[ddModalKey], prefix)}
                  />
                );
              })()}

              {/* ── TRACK RECORD PANE ── */}
              {activePane === "organisation" && isImplementer && (
                <SectionCard editable={isOrgOwner} title="Impact & track record" onEdit={openTrackRecordModal}
                  collapsible expanded={expandedOrgSections.has("track")} onToggle={() => toggleOrgSection("track")}>
                    <DisplayField label="Cumulative reach">
                      {(totalBeneficiaries || jobsCreated || femalePct || youthPct || yearsOfOperation) ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
                          {totalBeneficiaries && (
                            <div>
                              <p className="text-xs text-black dark:text-white opacity-60 mb-0.5">Beneficiaries reached</p>
                              <p className="text-sm font-semibold text-black dark:text-white">{Number(totalBeneficiaries).toLocaleString()}</p>
                            </div>
                          )}
                          {jobsCreated && (
                            <div>
                              <p className="text-xs text-black dark:text-white opacity-60 mb-0.5">Jobs created</p>
                              <p className="text-sm font-semibold text-black dark:text-white">{Number(jobsCreated).toLocaleString()}</p>
                            </div>
                          )}
                          {yearsOfOperation && (
                            <div>
                              <p className="text-xs text-black dark:text-white opacity-60 mb-0.5">Years operating</p>
                              <p className="text-sm font-semibold text-black dark:text-white">{yearsOfOperation}</p>
                            </div>
                          )}
                          {femalePct && (
                            <div>
                              <p className="text-xs text-black dark:text-white opacity-60 mb-0.5">Female beneficiaries</p>
                              <p className="text-sm font-semibold text-black dark:text-white">{femalePct}%</p>
                            </div>
                          )}
                          {youthPct && (
                            <div>
                              <p className="text-xs text-black dark:text-white opacity-60 mb-0.5">Youth beneficiaries</p>
                              <p className="text-sm font-semibold text-black dark:text-white">{youthPct}%</p>
                            </div>
                          )}
                        </div>
                      ) : <EmptyValue />}
                    </DisplayField>

                    <DisplayField label="Track record">
                      {(grantsCount || grantsTotalValue || grantsOnTimePct) ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
                          {grantsCount && (
                            <div>
                              <p className="text-xs text-black dark:text-white opacity-60 mb-0.5">Grants received</p>
                              <p className="text-sm font-semibold text-black dark:text-white">{grantsCount}</p>
                            </div>
                          )}
                          {grantsTotalValue && (
                            <div>
                              <p className="text-xs text-black dark:text-white opacity-60 mb-0.5">Total grant value</p>
                              <p className="text-sm font-semibold text-black dark:text-white">${Number(grantsTotalValue).toLocaleString()}</p>
                            </div>
                          )}
                          {grantsOnTimePct && (
                            <div>
                              <p className="text-xs text-black dark:text-white opacity-60 mb-0.5">Delivered on time</p>
                              <p className="text-sm font-semibold text-black dark:text-white">{grantsOnTimePct}%</p>
                            </div>
                          )}
                        </div>
                      ) : <EmptyValue />}
                    </DisplayField>

                    <DisplayField label="Previous funders">
                      {previousFunders.length > 0
                        ? <div className="flex flex-wrap gap-2">{previousFunders.map(f => <FlatTag key={f}>{f}</FlatTag>)}</div>
                        : <EmptyValue />}
                    </DisplayField>

                    <DisplayField label="Third-party evaluations">
                      {thirdPartyEvaluations
                        ? <p className="text-sm text-black dark:text-white">✓ Independent audits, impact assessments, or evaluations conducted by external parties</p>
                        : <EmptyValue />}
                    </DisplayField>
                </SectionCard>
              )}

              {editingTrackRecordOpen && (
                <EditModal title="Edit impact & track record" onClose={() => setEditingTrackRecordOpen(false)} onSave={saveTrackRecordSection} saving={trackRecordSaving}>
                  <div>
                    <p className="text-xs font-semibold text-black dark:text-white uppercase tracking-wider mb-3">Cumulative reach</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium">Total beneficiaries reached</Label>
                        <Input value={draftTotalBeneficiaries} onChange={e => setDraftTotalBeneficiaries(e.target.value.replace(/[^0-9]/g, ""))} className="mt-1 h-10" placeholder="e.g. 12400" />
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Jobs created</Label>
                        <Input value={draftJobsCreated} onChange={e => setDraftJobsCreated(e.target.value.replace(/[^0-9]/g, ""))} className="mt-1 h-10" placeholder="e.g. 340" />
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Female beneficiaries %</Label>
                        <Input value={draftFemalePct} onChange={e => setDraftFemalePct(e.target.value.replace(/[^0-9]/g, ""))} className="mt-1 h-10" placeholder="e.g. 62" />
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Youth beneficiaries %</Label>
                        <Input value={draftYouthPct} onChange={e => setDraftYouthPct(e.target.value.replace(/[^0-9]/g, ""))} className="mt-1 h-10" placeholder="e.g. 45" />
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Years of operation</Label>
                        <Input value={draftYearsOfOperation} onChange={e => setDraftYearsOfOperation(e.target.value.replace(/[^0-9]/g, ""))} className="mt-1 h-10" placeholder="e.g. 7" />
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-border">
                    <p className="text-xs font-semibold text-black dark:text-white uppercase tracking-wider mb-3">Track record</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium">Grants/contracts received (count)</Label>
                        <Input value={draftGrantsCount} onChange={e => setDraftGrantsCount(e.target.value.replace(/[^0-9]/g, ""))} className="mt-1 h-10" placeholder="e.g. 8" />
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Total grant value (USD)</Label>
                        <Input value={draftGrantsTotalValue} onChange={e => setDraftGrantsTotalValue(e.target.value.replace(/[^0-9]/g, ""))} className="mt-1 h-10" placeholder="e.g. 2400000" />
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Delivered on time %</Label>
                        <Input value={draftGrantsOnTimePct} onChange={e => setDraftGrantsOnTimePct(e.target.value.replace(/[^0-9]/g, ""))} className="mt-1 h-10" placeholder="e.g. 90" />
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-border">
                    <Label className="text-sm font-medium">Previous funders / grant-makers</Label>
                    <p className="text-xs text-black dark:text-white opacity-60 mt-0.5 mb-2">Names only — e.g. USAID, Ford Foundation, FCDO</p>
                    <div className="flex gap-2">
                      <Input value={draftFunderInput} onChange={e => setDraftFunderInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const v = draftFunderInput.trim();
                            if (v && !draftPreviousFunders.includes(v)) setDraftPreviousFunders(p => [...p, v]);
                            setDraftFunderInput("");
                          }
                        }}
                        className="h-10 flex-1" placeholder="Type funder name and press Enter" />
                      <button type="button"
                        onClick={() => {
                          const v = draftFunderInput.trim();
                          if (v && !draftPreviousFunders.includes(v)) setDraftPreviousFunders(p => [...p, v]);
                          setDraftFunderInput("");
                        }}
                        className="h-10 px-3 rounded-lg border border-border text-sm text-black dark:text-white hover:border-foreground/30 transition-colors shrink-0">
                        Add
                      </button>
                    </div>
                    {draftPreviousFunders.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {draftPreviousFunders.map(f => (
                          <span key={f} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-border text-black dark:text-white">
                            {f}
                            <button type="button" onClick={() => setDraftPreviousFunders(p => p.filter(x => x !== f))} className="hover:opacity-70 ml-0.5">×</button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t border-border">
                    <ModalCheckbox checked={draftThirdPartyEvaluations} onChange={() => setDraftThirdPartyEvaluations(v => !v)}
                      label="Third-party evaluations available" sub="Independent audits, impact assessments, or evaluations conducted by external parties" />
                  </div>
                </EditModal>
              )}

              {/* ── MANDATE PANE (funders) ── */}
              {activePane === "organisation" && isFunder && (
                <>
                <SectionGroupHeader title="Mandate" expanded={expandedOrgSections.has("mandate")} onToggle={() => toggleOrgSection("mandate")} />
                {expandedOrgSections.has("mandate") && (
                  <>
                  <SectionCard editable={isOrgOwner} title="Investment thesis" onEdit={openMandateModal}>
                    <DisplayField label="Investment focus">
                      {investmentThesis ? <p className="text-sm text-black dark:text-white leading-relaxed">{investmentThesis}</p> : <EmptyValue />}
                    </DisplayField>
                  </SectionCard>

                  <SectionCard editable={isOrgOwner} title="Mandate criteria" onEdit={openMandateModal}>
                    <DisplayField label="Grant / investment range">
                      {(grantRangeMin || grantRangeMax) ? (
                        <p className="text-sm text-black dark:text-white">
                          {grantCurrency} {grantRangeMin ? Number(grantRangeMin).toLocaleString() : "—"} – {grantRangeMax ? Number(grantRangeMax).toLocaleString() : "—"}
                        </p>
                      ) : <EmptyValue />}
                    </DisplayField>
                    <DisplayField label="Funding instruments">
                      {fundingInstruments.length > 0
                        ? <div className="flex flex-wrap gap-2">{fundingInstruments.map(f => <FlatTag key={f}>{f}</FlatTag>)}</div>
                        : <EmptyValue />}
                    </DisplayField>
                    <DisplayField label="Sector focus">
                      {mandateSectors.length > 0
                        ? <div className="flex flex-wrap gap-2">{mandateSectors.map(s => <FlatTag key={s}>{s}</FlatTag>)}</div>
                        : <EmptyValue />}
                    </DisplayField>
                    <DisplayField label="SDG priorities">
                      {mandateSdgs.length > 0
                        ? <div className="flex flex-wrap gap-2">{mandateSdgs.map(s => <FlatTag key={s}>{s}</FlatTag>)}</div>
                        : <EmptyValue />}
                    </DisplayField>
                    <DisplayField label="Stage preference">
                      {stagePreference.length > 0
                        ? <div className="flex flex-wrap gap-2">{stagePreference.map(s => <FlatTag key={s}>{s}</FlatTag>)}</div>
                        : <EmptyValue />}
                    </DisplayField>
                    <DisplayField label="Geographic focus">
                      {geographicFocus.length > 0
                        ? <div className="flex flex-wrap gap-2">{geographicFocus.map(g => <FlatTag key={g}>{g}</FlatTag>)}</div>
                        : <EmptyValue />}
                    </DisplayField>
                  </SectionCard>
                  </>
                )}
                </>
              )}

              {editingMandateOpen && (
                <EditModal title="Edit mandate" onClose={() => setEditingMandateOpen(false)} onSave={saveMandateSection} saving={mandateSaving}>
                  <div>
                    <Label className="text-sm font-medium">Describe your investment focus</Label>
                    <Textarea value={draftInvestmentThesis} onChange={e => setDraftInvestmentThesis(e.target.value)} className="mt-1 resize-none" rows={4}
                      placeholder="e.g. We back early-stage climate adaptation initiatives in Sub-Saharan Africa, with a focus on smallholder agriculture and water security. We deploy grants of $50K–$500K and prioritise organisations with community-validated models..." />
                    <p className="text-xs text-black dark:text-white opacity-60 mt-1.5">Shown on your directory profile. Helps implementers, startups, and ecosystem actors understand your focus before reaching out. Also used by the AI to improve initiative matching.</p>
                  </div>

                  <div className="pt-4 border-t border-border">
                    <Label className="text-sm font-medium">Grant / investment range</Label>
                    <div className="flex gap-2 items-center mt-1">
                      <select value={draftGrantCurrency} onChange={e => setDraftGrantCurrency(e.target.value)}
                        className="h-10 rounded-lg border border-border bg-background px-2 text-sm w-[80px] shrink-0 focus:outline-none focus:ring-2 focus:ring-primary/20">
                        {["USD", "GBP", "EUR", "NGN", "KES", "GHS", "ZAR"].map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <Input value={draftGrantRangeMin} onChange={e => setDraftGrantRangeMin(e.target.value.replace(/[^0-9]/g, ""))} className="h-10 flex-1" placeholder="Min" />
                      <span className="text-black dark:text-white shrink-0 text-sm">–</span>
                      <Input value={draftGrantRangeMax} onChange={e => setDraftGrantRangeMax(e.target.value.replace(/[^0-9]/g, ""))}
                        className={`h-10 flex-1 ${draftGrantRangeInvalid ? "border-red-400 focus-visible:ring-red-300" : ""}`}
                        placeholder="Max" />
                    </div>
                    {draftGrantRangeInvalid && (
                      <p className="text-xs text-red-500 mt-1.5">Max must be greater than or equal to Min.</p>
                    )}
                  </div>

                  <div className="pt-4 border-t border-border">
                    <Label className="text-sm font-medium">Funding instruments</Label>
                    <div className="mt-2 space-y-1">
                      {FUNDING_INSTRUMENTS.map(f => (
                        <ModalCheckbox key={f} checked={draftFundingInstruments.includes(f)} label={f}
                          onChange={() => setDraftFundingInstruments(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f])} />
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-border">
                    <Label className="text-sm font-medium">Sector focus</Label>
                    <p className="text-xs text-black dark:text-white opacity-60 mt-0.5 mb-2">Sectors your mandate targets. Separate from the sectors shown on your public profile.</p>
                    <div className="space-y-1 max-h-56 overflow-y-auto">
                      {SECTOR_OPTIONS.map(s => (
                        <ModalCheckbox key={s} checked={draftMandateSectors.includes(s)} label={s}
                          onChange={() => setDraftMandateSectors(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])} />
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-border">
                    <Label className="text-sm font-medium">SDG priorities</Label>
                    <div className="space-y-1 max-h-56 overflow-y-auto">
                      {SDG_OPTIONS.map(s => (
                        <ModalCheckbox key={s} checked={draftMandateSdgs.includes(s)} label={s}
                          onChange={() => setDraftMandateSdgs(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])} />
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-border">
                    <Label className="text-sm font-medium">Stage preference</Label>
                    <div className="mt-2 space-y-1">
                      {["Concept / Early stage", "Pilot / Proof of concept", "Growth / Scaling", "Mature / Established", "Core / Unrestricted"].map(s => (
                        <ModalCheckbox key={s} checked={draftStagePreference.includes(s)} label={s}
                          onChange={() => setDraftStagePreference(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])} />
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-border">
                    <Label className="text-sm font-medium">Geographic focus</Label>
                    <div className="flex gap-2 mt-1">
                      <Input value={draftGeographicInput} onChange={e => setDraftGeographicInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const v = draftGeographicInput.trim();
                            if (v && !draftGeographicFocus.includes(v)) setDraftGeographicFocus(p => [...p, v]);
                            setDraftGeographicInput("");
                          }
                        }}
                        className="h-10 flex-1" placeholder="e.g. West Africa, Kenya" />
                      <button type="button"
                        onClick={() => {
                          const v = draftGeographicInput.trim();
                          if (v && !draftGeographicFocus.includes(v)) setDraftGeographicFocus(p => [...p, v]);
                          setDraftGeographicInput("");
                        }}
                        className="h-10 px-3 rounded-lg border border-border text-sm text-black dark:text-white hover:border-foreground/30 transition-colors shrink-0">
                        Add
                      </button>
                    </div>
                    {draftGeographicFocus.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {draftGeographicFocus.map(g => (
                          <span key={g} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-border text-black dark:text-white">
                            {g}
                            <button type="button" onClick={() => setDraftGeographicFocus(p => p.filter(x => x !== g))} className="hover:opacity-70 ml-0.5">×</button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </EditModal>
              )}
            
            {/* ── CSR & ESG PANE (corporates/tech/public sector) ── */}
            {activePane === "organisation" && isCorporate && (
                  <SectionCard editable={isOrgOwner} title="CSR & ESG" onEdit={openCsrEsgModal}
                    collapsible expanded={expandedOrgSections.has("csr_esg")} onToggle={() => toggleOrgSection("csr_esg")}>
                    <DisplayField label="CSR/ESG focus statement">
                      {csrFocusStatement
                        ? <p className="text-sm text-black dark:text-white leading-relaxed">{csrFocusStatement}</p>
                        : <EmptyValue />}
                    </DisplayField>

                    <DisplayField label="Annual CSR/ESG budget range">
                      {csrBudgetRange
                        ? <p className="text-sm text-black dark:text-white">{csrBudgetRange}</p>
                        : <EmptyValue />}
                    </DisplayField>

                    <DisplayField label="ESG reporting frameworks">
                      {esgFrameworks.length > 0
                        ? <div className="flex flex-wrap gap-2">{esgFrameworks.map(f => <FlatTag key={f}>{f}</FlatTag>)}</div>
                        : <EmptyValue />}
                    </DisplayField>
                  </SectionCard>
              )}

              {/* ── Partnership preferences card (display only) ── */}
              {activePane === "organisation" && isCorporate && (
                  <SectionCard editable={isOrgOwner} title="Partnership preferences" onEdit={openPartnershipModal}
                    collapsible expanded={expandedOrgSections.has("csr_partnership")} onToggle={() => toggleOrgSection("csr_partnership")}>
                    <DisplayField label="What we bring to partnerships">
                      {inkindSupport.length > 0
                        ? <div className="flex flex-wrap gap-2">{inkindSupport.map(s => <FlatTag key={s}>{s}</FlatTag>)}</div>
                        : <EmptyValue />}
                    </DisplayField>

                    <DisplayField label="Engagement options">
                        {(employeeEngagement || cobrandingOpen) ? (
                          <div className="space-y-1">
                            {employeeEngagement && <p className="text-sm text-black dark:text-white">✓ Open to employee engagement opportunities</p>}
                            {cobrandingOpen && <p className="text-sm text-black dark:text-white">✓ Open to co-branding</p>}
                          </div>
                        ) : <EmptyValue />}
                    </DisplayField>

                    <DisplayField label="Preferred partner types">
                      {partnerTypePreference.length > 0
                        ? <div className="flex flex-wrap gap-2">{partnerTypePreference.map(p => <FlatTag key={p}>{p}</FlatTag>)}</div>
                        : <EmptyValue />}
                    </DisplayField>

                    <DisplayField label="Geographic focus">
                      {geographicFocus.length > 0
                        ? <div className="flex flex-wrap gap-2">{geographicFocus.map(g => <FlatTag key={g}>{g}</FlatTag>)}</div>
                        : <EmptyValue />}
                    </DisplayField>
                  </SectionCard>
              )}

              {/* ── Technology support card (technology_company only, display only) ── */}
              {activePane === "organisation" && isCorporate && profile?.org_type === "technology_company" && (
                    <SectionCard editable={isOrgOwner} title="Technology support" onEdit={openTechModal}
                      collapsible expanded={expandedOrgSections.has("csr_tech")} onToggle={() => toggleOrgSection("csr_tech")}>
                      <DisplayField label="Tech resources we can offer">
                        {techSupport.length > 0
                          ? <div className="flex flex-wrap gap-2">{techSupport.map(t => <FlatTag key={t}>{t}</FlatTag>)}</div>
                          : <EmptyValue />}
                      </DisplayField>
                      <DisplayField label="Sandbox / beta testing">
                        {sandboxReady ? (
                          <div>
                            <p className="text-sm text-black dark:text-white">✓ Open to sandbox/beta testing partnerships</p>
                            {sandboxDescription && <p className="text-sm text-black dark:text-white mt-1.5">{sandboxDescription}</p>}
                          </div>
                        ) : <EmptyValue />}
                      </DisplayField>
                    </SectionCard>
              )}

              {/* ── SRG1 compliance self-declaration ── */}
              {activePane === "organisation" && isCorporate && (
                  <SectionCard editable={isOrgOwner} title="Compliance (SRG1)" onEdit={openComplianceModal}
                    collapsible expanded={expandedOrgSections.has("csr_compliance")} onToggle={() => toggleOrgSection("csr_compliance")}>
                    <DisplayField label="Public interest entity status">
                      {srg1PieSelfDeclared ? (
                        <p className="text-sm text-black dark:text-white">✓ Declared as a public interest entity under FRC Nigeria SRG1</p>
                      ) : <EmptyValue />}
                    </DisplayField>
                    <DisplayField label="Annual revenue (₦)">
                      {srg1AnnualRevenue ? (
                        <p className="text-sm text-black dark:text-white">{Number(srg1AnnualRevenue).toLocaleString()}</p>
                      ) : <EmptyValue />}
                    </DisplayField>
                    </SectionCard>
              )}
                </SectionCardGroup>
                </>
              )}

              {editingFocusOpen && (
                <EditModal title="Edit focus areas" onClose={() => setEditingFocusOpen(false)} onSave={saveFocusSection} saving={focusSaving}>
                  <div>
                    <Label className="text-sm font-medium">Sectors</Label>
                    <p className="text-xs text-black dark:text-white opacity-60 mt-0.5 mb-2">Used to match you with relevant initiatives and partners.</p>
                    <div className="mt-2 space-y-1">
                      {SECTOR_OPTIONS.map(s => (
                        <ModalCheckbox key={s} checked={draftSectors.includes(s)} label={s}
                          onChange={() => setDraftSectors(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])} />
                      ))}
                    </div>
                  </div>
                </EditModal>
              )}

              {editingPresenceOpen && (
                <EditModal title="Edit online presence" onClose={() => setEditingPresenceOpen(false)} onSave={savePresenceSection} saving={presenceSaving}>
                  {!isOrg && (
                    <div>
                      <Label className="text-sm font-medium">LinkedIn</Label>
                      <Input value={draftLinkedinUrl} onChange={e => setDraftLinkedinUrl(e.target.value)} className="mt-1 h-10" placeholder="https://linkedin.com/in/..." type="url" />
                    </div>
                  )}
                  <div>
                    <Label className="text-sm font-medium">Website or portfolio</Label>
                    <Input value={draftWebsite} onChange={e => setDraftWebsite(e.target.value)} className="mt-1 h-10" placeholder="https://yourwebsite.org" type="url" />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Social profiles</Label>
                    <p className="text-xs text-black dark:text-white opacity-60 mt-0.5 mb-2">Pick a platform, or choose "Other" for anything else.</p>
                    <div className="flex gap-2">
                      <select value={draftSocialLabel} onChange={(e) => setDraftSocialLabel(e.target.value)}
                        className="h-10 rounded-lg border border-border bg-background px-2 text-sm w-32 shrink-0 focus:outline-none focus:ring-2 focus:ring-primary/20">
                        <option value="">Platform</option>
                        {SOCIAL_PLATFORMS.map(p => <option key={p.value} value={p.value}>{p.value}</option>)}
                      </select>
                      <Input value={draftSocialUrl} onChange={(e) => setDraftSocialUrl(e.target.value)} className="h-10 flex-1" placeholder="https://instagram.com/yourhandle" type="url" />
                      <button type="button"
                        onClick={() => {
                          const label = draftSocialLabel === "Other" ? draftSocialCustomLabel.trim() : draftSocialLabel;
                          if (!label || !draftSocialUrl.trim()) return;
                          setDraftSocialLinks((prev) => [...prev, { label, url: draftSocialUrl.trim() }]);
                          setDraftSocialLabel(""); setDraftSocialCustomLabel(""); setDraftSocialUrl("");
                        }}
                        className="h-10 px-3 rounded-lg border border-border text-sm text-black dark:text-white hover:border-foreground/30 transition-colors shrink-0">
                        Add
                      </button>
                    </div>
                    {draftSocialLabel === "Other" && (
                      <Input value={draftSocialCustomLabel} onChange={(e) => setDraftSocialCustomLabel(e.target.value)}
                        className="h-10 mt-2" placeholder="Platform name" />
                    )}
                    {draftSocialLinks.length > 0 && (
                      <div className="mt-2 space-y-1.5">
                        {draftSocialLinks.map((s, i) => {
                          const Icon = socialPlatformIcon(s.label);
                          return (
                            <div key={i} className="flex items-center justify-between text-xs border border-border rounded-lg px-3 py-2 bg-muted/30">
                              <div className="flex items-center gap-2 min-w-0">
                                <Icon className="w-3.5 h-3.5 shrink-0 text-black dark:text-white" />
                                <span className="font-medium text-foreground shrink-0">{s.label}</span>
                                <span className="text-black dark:text-white truncate">{s.url}</span>
                              </div>
                              <button type="button" onClick={() => setDraftSocialLinks((prev) => prev.filter((_, idx) => idx !== i))}
                                className="ml-2 text-black dark:text-white hover:text-foreground shrink-0">✕</button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </EditModal>
              )}

              {/* ── SRG1 compliance edit modal ── */}
              {editingComplianceSection && (
                <EditModal title="Compliance (SRG1)" onClose={() => setEditingComplianceSection(false)} onSave={saveComplianceSection} saving={complianceSectionSaving}>
                  <div className="space-y-1">
                    <ModalCheckbox checked={draftSrg1PieSelfDeclared} onChange={() => setDraftSrg1PieSelfDeclared(v => !v)}
                      label="We are a public interest entity (PIE) under FRC Nigeria SRG1"
                      sub="Applies if your organisation meets FRC Nigeria's public interest entity criteria" />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Annual revenue (₦, optional)</Label>
                    <Input value={draftSrg1AnnualRevenue} onChange={e => setDraftSrg1AnnualRevenue(e.target.value.replace(/[^0-9]/g, ""))}
                      className="mt-1 h-10" placeholder="e.g. 35000000000" />
                    <p className="text-xs text-black dark:text-white mt-1.5 opacity-60">Orgs at or above ₦30bn annual revenue are automatically flagged as SRG1-subject, regardless of the checkbox above.</p>
                  </div>
                  {(draftSrg1PieSelfDeclared || draftSrg1AnnualRevenue) && (
                    <div className="pt-4 border-t border-border">
                      <ModalCheckbox checked={draftSrg1RemindersOn} onChange={() => setDraftSrg1RemindersOn(v => !v)}
                        label="Send me SRG1 deadline reminders"
                        sub="Monthly notification and email until the disclosure deadline" />
                    </div>
                  )}
                </EditModal>
              )}
              {/* ── CSR & ESG edit modal ── */}
              {editingCsrSection === "csrEsg" && (
                <EditModal title="CSR & ESG" onClose={() => setEditingCsrSection(null)} onSave={saveCsrEsgSection} saving={csrSectionSaving}>
                  <div>
                    <Label className="text-sm font-medium">CSR/ESG focus statement</Label>
                    <Textarea value={draftCsrFocusStatement} onChange={e => setDraftCsrFocusStatement(e.target.value)} className="mt-1 resize-none" rows={4}
                      placeholder="e.g. We prioritise climate resilience and digital inclusion programmes across West Africa, aligned with our operational footprint. We seek implementing partners with strong community reach and measurable outcomes." />
                    <p className="text-xs text-black dark:text-white mt-1.5 opacity-60">Used by AI to match your profile with relevant initiatives and implementers.</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Annual CSR/ESG budget range</Label>
                    <Input value={draftCsrBudgetRange} onChange={e => setDraftCsrBudgetRange(e.target.value)} className="mt-1 h-10" placeholder="e.g. $500K–$2M" />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">ESG reporting frameworks</Label>
                    <div className="mt-2 space-y-1">
                      {["GRI", "SASB", "UN Global Compact", "B Corp", "TCFD", "SDG Reporting"].map(f => (
                        <ModalCheckbox key={f} checked={draftEsgFrameworks.includes(f)} label={f}
                          onChange={() => setDraftEsgFrameworks(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f])} />
                      ))}
                    </div>
                  </div>
                </EditModal>
              )}

              {/* ── Partnership preferences edit modal ── */}
              {editingCsrSection === "partnership" && (
                <EditModal title="Partnership preferences" onClose={() => setEditingCsrSection(null)} onSave={savePartnershipSection} saving={csrSectionSaving}>
                  <div>
                    <Label className="text-sm font-medium">What we bring to partnerships</Label>
                    <div className="mt-2 space-y-1">
                      {["Cash funding", "In-kind technology", "Employee volunteering", "Pro-bono expertise", "Marketing & visibility", "Supply chain access", "Co-branding opportunity", "Logistics support"].map(s => (
                        <ModalCheckbox key={s} checked={draftInkindSupport.includes(s)} label={s}
                          onChange={() => setDraftInkindSupport(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])} />
                      ))}
                    </div>
                  </div>
                  <div className="pt-4 border-t border-border">
                    <Label className="text-sm font-medium">Engagement options</Label>
                    <div className="mt-2 space-y-1">
                      <ModalCheckbox checked={draftEmployeeEngagement} onChange={() => setDraftEmployeeEngagement(v => !v)}
                        label="Open to employee engagement opportunities" sub="Staff volunteering, mentoring, or pro-bono involvement" />
                      <ModalCheckbox checked={draftCobrandingOpen} onChange={() => setDraftCobrandingOpen(v => !v)}
                        label="Open to co-branding" sub="Joint communications, case studies, or public visibility" />
                    </div>
                  </div>
                  <div className="pt-4 border-t border-border">
                    <Label className="text-sm font-medium">Preferred partner types</Label>
                    <div className="mt-2 space-y-1">
                      {["Registered Charity / NGO", "Social Enterprise / CIC / B Corp", "Research Institution / Academia", "Government / Public Sector", "Individual Practitioner"].map(p => (
                        <ModalCheckbox key={p} checked={draftPartnerTypePreference.includes(p)} label={p}
                          onChange={() => setDraftPartnerTypePreference(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])} />
                      ))}
                    </div>
                  </div>
                  <div className="pt-4 border-t border-border">
                    <Label className="text-sm font-medium">Geographic focus</Label>
                    <div className="flex gap-2 mt-1">
                      <Input value={draftGeographicInput} onChange={e => setDraftGeographicInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const v = draftGeographicInput.trim();
                            if (v && !draftGeographicFocus.includes(v)) setDraftGeographicFocus(p => [...p, v]);
                            setDraftGeographicInput("");
                          }
                        }}
                        className="h-10 flex-1" placeholder="e.g. Nigeria, East Africa" />
                      <button type="button"
                        onClick={() => {
                          const v = draftGeographicInput.trim();
                          if (v && !draftGeographicFocus.includes(v)) setDraftGeographicFocus(p => [...p, v]);
                          setDraftGeographicInput("");
                        }}
                        className="h-10 px-3 rounded-lg border border-border text-sm text-black dark:text-white hover:border-foreground/30 transition-colors shrink-0">
                        Add
                      </button>
                    </div>
                    {draftGeographicFocus.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {draftGeographicFocus.map(g => (
                          <span key={g} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-border text-black dark:text-white">
                            {g}
                            <button type="button" onClick={() => setDraftGeographicFocus(p => p.filter(x => x !== g))} className="hover:opacity-70 ml-0.5">×</button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </EditModal>
              )}

              {/* ── Technology support edit modal ── */}
              {editingCsrSection === "tech" && (
                <EditModal title="Technology support" onClose={() => setEditingCsrSection(null)} onSave={saveTechSection} saving={csrSectionSaving}>
                  <div>
                    <Label className="text-sm font-medium">Tech resources we can offer</Label>
                    <div className="mt-2 space-y-1">
                      {["Cloud computing credits", "AI/ML API access", "Software licences", "Pro-bono engineering hours", "Data analytics tools", "Cybersecurity support"].map(t => (
                        <ModalCheckbox key={t} checked={draftTechSupport.includes(t)} label={t}
                          onChange={() => setDraftTechSupport(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])} />
                      ))}
                    </div>
                  </div>
                  <div className="pt-4 border-t border-border">
                    <ModalCheckbox checked={draftSandboxReady} onChange={() => setDraftSandboxReady(v => !v)}
                      label="Open to sandbox/beta testing partnerships" sub="We can act as a testing ground for technologies designed for social good" />
                    {draftSandboxReady && (
                      <Textarea value={draftSandboxDescription} onChange={e => setDraftSandboxDescription(e.target.value)} className="mt-2 resize-none" rows={2}
                        placeholder="Briefly describe what kind of technology testing you can support..." />
                    )}
                  </div>
                </EditModal>
              )}

              {/* ── IMPACT STRATEGY PANE (corporates/tech/telecom) ── */}
              

              {/* ── VERIFICATION PANE ── */}
              {activePane === "impact_evidence" && isOrg && (
                <SectionCardGroup>
                  <div className="px-8 sm:px-12 py-10">
                    <DeliveryStatsCard orgId={orgId} />
                  </div>
                  {orgId && (
                    <VerifiedOutcomesSection orgId={orgId} variant="panel" isOwnOrg canManage={isOrgOwner} />
                  )}
                </SectionCardGroup>
              )}

              {activePane === "verification" && isOrg && (
                <SectionCardGroup>
                  <div className="px-8 sm:px-12 py-10">
                    <div className="flex items-center justify-between mb-6">
                      <p className="text-xl font-bold text-[#111111] dark:text-[#F5F5F5]">Verification</p>
                      {profile?.is_verified && (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-[#2D6A4F]/10 text-[#2D6A4F]">
                          <ShieldCheck className="w-3.5 h-3.5" /> Verified
                        </span>
                      )}
                    </div>

                    {profile?.is_verified ? (
                      <p className="text-sm text-black dark:text-white">
                        Your organisation is verified. No further action is required for now. A badge appears on your profile, listings, and activity across the platform.
                      </p>
                    ) : profile?.verification_requested ? (
                      <div className="flex items-start gap-3">
                        <ShieldCheck className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-foreground">Verification pending</p>
                          <p className="text-sm text-black dark:text-white mt-0.5">Your documents are under review.</p>
                        </div>
                      </div>
                    ) : profile?.verification_rejection_reason ? (
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium text-red-600 dark:text-red-400">Verification not approved</p>
                          <p className="text-sm text-black dark:text-white mt-1">
                            {profile.verification_rejection_reason}
                          </p>
                          <p className="text-sm text-black dark:text-white mt-2">
                            Fix the issue above and resubmit — most rejections are resolved on the second try.
                          </p>
                        </div>
                        <Link href="/verify">
                          <Button className="shrink-0 rounded-full px-5 text-sm text-white hover:brightness-110 transition-all border-0"
                            style={{ background: "linear-gradient(135deg, #3D2618 0%, #33301F 50%, #1B3328 100%)" }}>
                            Fix & resubmit
                          </Button>
                        </Link>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium text-foreground">Not verified</p>
                          <p className="text-sm text-black dark:text-white mt-0.5">
                            Verified organisations get a badge on all activity, priority placement in the partner directory, and a credibility multiplier on Impact Points.
                          </p>
                        </div>
                        <Link href="/verify">
                          <Button className="shrink-0 rounded-full px-5 text-sm text-white hover:brightness-110 transition-all border-0"
                            style={{ background: "linear-gradient(135deg, #3D2618 0%, #33301F 50%, #1B3328 100%)" }}>
                            Get verified
                          </Button>
                        </Link>
                      </div>
                    )}
                  </div>
                </SectionCardGroup>
              )}

            </div>
          </div>
        </div>
      </div>

      {/* Right column — persistent across all panes, fully detached from the
          main content flow via fixed positioning so no parent overflow/flex
          quirks can drag it along with page scroll. */}
      <div className="space-y-4 md:flex md:flex-col md:min-h-[calc(100vh-120px)] md:fixed md:top-[96px] md:right-6 md:w-[280px]">

        <div className="rounded-b-2xl border-x border-b border-border bg-white dark:bg-card p-5 md:pt-[28px] space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-black dark:text-white">Profile strength</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-foreground">{strengthScore}%</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: `${strengthColor}15`, color: strengthColor }}>
                {strengthLabel}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${strengthScore}%`, background: strengthColor }} />
            </div>
          </div>
          <div className="space-y-2">
            {[
              { label: "Full name", done: !!fullName },
              ...(isOrg ? [{ label: "Organisation description", done: !!orgDescription }] : [{ label: "Headline", done: !!roleTitle }, { label: "Bio", done: !!bio }]),
              { label: "Country", done: !!country },
              ...(isOrg ? [{ label: "Organisation name", done: !!orgName }] : []),
              { label: "Sectors", done: sectors.length > 0 },
              { label: "Online presence", done: isOrg ? orgOnlinePresence : individualOnlinePresence },
              ...(isOrg ? [{ label: "Organisation logo", done: !!logoUrl }] : [{ label: "Profile photo", done: !!profile?.avatar_url }]),
              // Corporate gets nothing added here — every field
              // generate-csr-brief actually reads (focus statement, budget
              // range, ESG frameworks, geographic focus, sector focus,
              // partner type preference) is already covered by the 7 base
              // org items above via the mandate/CSR completeness parity.
              // Funder and implementer additions below are limited to the
              // specific fields confirmed, by reading generate-deal-memo and
              // match-orgs-for-partnership directly, to actually feed AI
              // decisions — not a general "more fields = better" pass.
              // fdd readiness added to both funder and corporate once the
              // funder/corporate DD checklist existed to reference — it's
              // a genuinely new signal, not covered by any base item.
              ...(isFunder ? [
                { label: "Investment thesis", done: !!investmentThesis },
                { label: `DD readiness (${Math.round(fddReadinessFraction * fddReadinessItems.length)}/${fddReadinessItems.length})`, done: fddReadinessFraction === 1, partial: fddReadinessFraction > 0 && fddReadinessFraction < 1 },
              ] : []),
              ...(isImplementer ? [
                { label: `DD readiness (${Math.round(ddReadinessFraction * ddReadinessItems.length)}/${ddReadinessItems.length})`, done: ddReadinessFraction === 1, partial: ddReadinessFraction > 0 && ddReadinessFraction < 1 },
                { label: "Beneficiaries reached", done: totalBeneficiaries !== "" },
              ] : []),
              ...(isCorporate ? [
                { label: `DD readiness (${Math.round(fddReadinessFraction * fddReadinessItems.length)}/${fddReadinessItems.length})`, done: fddReadinessFraction === 1, partial: fddReadinessFraction > 0 && fddReadinessFraction < 1 },
              ] : []),
              ...(isOrg ? [{ label: "Verified organisation", done: !!profile?.is_verified }] : []),
            ].map((item: any) => (
              <div key={item.label} className="flex items-center gap-2">
                <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 ${item.done ? "bg-[#2D6A4F]" : item.partial ? "bg-amber-400" : "bg-muted"}`}>
                  {item.done && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>}
                </div>
                <span className={`text-xs ${item.done ? "text-foreground" : "text-black dark:text-white"}`}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {isOrg && (
          <div className="rounded-2xl border border-border bg-white dark:bg-card p-5 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-black dark:text-white">Visibility</p>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full shrink-0 ${profile?.is_verified ? "bg-[#2D6A4F]" : "bg-muted-foreground/40"}`} />
              <span className="text-xs text-foreground">{profile?.is_verified ? "Verified organisation" : "Not yet verified"}</span>
            </div>
            {!profile?.is_verified && (
              profile?.verification_requested ? (
                <p className="text-xs text-black dark:text-white opacity-50 cursor-not-allowed">Verification pending review</p>
              ) : profile?.verification_rejection_reason ? (
                <a href="/verify" className="text-xs text-red-500 hover:underline underline-offset-2">Not approved — fix & resubmit</a>
              ) : (
                <a href="/verify" className="text-xs text-[#2D6A4F] hover:underline underline-offset-2">Apply for verification</a>
              )
            )}
          </div>
        )}

        <div className="rounded-2xl border border-border bg-white dark:bg-card p-5 space-y-2 md:flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-black dark:text-white mb-3">Quick links</p>
          <Link href="/dashboard/natives" className="flex items-center gap-2 text-xs text-black dark:text-white hover:text-foreground transition-colors py-1">
            <ArrowRight className="w-3 h-3 text-[#2D6A4F]" /> View your directory listing
          </Link>
          <Link href="/dashboard/settings" className="flex items-center gap-2 text-xs text-black dark:text-white hover:text-foreground transition-colors py-1">
            <ArrowRight className="w-3 h-3 text-[#2D6A4F]" /> Account settings
          </Link>
          {!isOrg && (
            <>
              <Link href="/dashboard/marketplace" className="flex items-center gap-2 text-xs text-black dark:text-white hover:text-foreground transition-colors py-1">
                <ArrowRight className="w-3 h-3 text-[#2D6A4F]" /> Browse the marketplace
              </Link>
              <Link href="/dashboard/natives?tab=organisation" className="flex items-center gap-2 text-xs text-black dark:text-white hover:text-foreground transition-colors py-1">
                <ArrowRight className="w-3 h-3 text-[#2D6A4F]" /> Browse organisations
              </Link>
            </>
          )}
          {isOrg && (
            <a href="/verification-standard" className="flex items-center gap-2 text-xs text-black dark:text-white hover:text-foreground transition-colors py-1">
              <ArrowRight className="w-3 h-3 text-[#2D6A4F]" /> Verification standards
            </a>
          )}
        </div>
      </div>
    </div>
  );
}