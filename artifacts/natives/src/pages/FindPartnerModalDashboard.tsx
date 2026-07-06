// ─── FindPartnerModalDashboard.tsx ───────────────────────────────────────────
// 6-step Get Matched flow with document upload support
// Step 0: Intent (describe or upload doc)
// Step 1: The partnership (type, stage, duration, relationship, exclusivity)
// Step 2: Where and when (location, timeline, presence, resources)
// Step 3: What you work on (sectors, needs, offers, SDGs, language, success)
// Step 4: Readiness (DD docs, working style, expectations, track record)
// Step 5: Confirm (theory of change, constraints, decision maker, list publicly)

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles, CheckCircle2, ArrowLeft, ArrowRight, ExternalLink, ShieldCheck, ChevronDown, ChevronUp, Upload, FileText, X } from "lucide-react";
import { ORG_TYPE_OPTIONS } from "@/lib/orgTypes";
import { SECTOR_OPTIONS as SECTORS } from "@/lib/sectors";

const RATE_LIMIT_ENABLED = false;

const COUNTRIES = ["Nigeria","Kenya","Ghana","South Africa","Ethiopia","Rwanda","Senegal","United Kingdom","Germany","France","Other"];
const NEEDS_OPTIONS = ["Funding","Partnership","Data","Visibility","Technical Assistance","Networks"];
const OFFERS_OPTIONS = ["Field access","Data","Networks","Execution","Funding","Research"];
const SDG_LIST = Array.from({ length: 17 }, (_, i) => i + 1);

type PrefillData = {
  country: string[]; sectors: string[]; sdgs: number[]; organisation_type: string;
  needs: string[]; offers: string[]; description: string; partnership_sought: string;
  partnership_stage: string; partnership_duration: string; partnership_geo_specificity: string;
  partnership_budget: string; partnership_decision_timeline: string; partnership_success_definition: string;
  partnership_legal_type: string[]; partnership_exclusivity: string; partnership_language: string[];
  partnership_team_capacity: string; partnership_funding_status: string;
  partnership_dd_financial_model: boolean; partnership_dd_audited_accounts: boolean;
  partnership_dd_safeguarding_policy: boolean; partnership_dd_data_policy: boolean;
  partnership_dd_governance_doc: boolean; partnership_financial_transfer: string;
  partnership_working_style: string; partnership_reporting: string[]; partnership_ip_ownership: string;
  partnership_constraints: string; partnership_prior_attempts: string;
  partnership_decision_maker_confirmed: boolean; partnership_prior_experience: boolean | null;
  partnership_prior_experience_detail: string; partnership_contact_seniority: string;
  partnership_physically_present: boolean | null; partnership_funding_status_readiness: string;
  partnership_theory_of_change: string;
};

type MatchResult = {
  org_id: string; fit_score: number; rationale: string; key_synergy: string;
  org: {
    id: string; organisation_name: string; description: string; organisation_type: string;
    country: string | string[]; sector: string | string[]; needs: string[]; offers: string[];
    sdgs: number[]; website?: string; email?: string; verification_status: string;
  };
};

const EMPTY_FORM: PrefillData = {
  country: [], sectors: [], sdgs: [], organisation_type: "", needs: [], offers: [],
  description: "", partnership_sought: "", partnership_stage: "", partnership_duration: "",
  partnership_geo_specificity: "", partnership_budget: "", partnership_decision_timeline: "",
  partnership_success_definition: "", partnership_legal_type: [], partnership_exclusivity: "",
  partnership_language: [], partnership_team_capacity: "", partnership_funding_status: "",
  partnership_dd_financial_model: false, partnership_dd_audited_accounts: false,
  partnership_dd_safeguarding_policy: false, partnership_dd_data_policy: false,
  partnership_dd_governance_doc: false, partnership_financial_transfer: "", partnership_working_style: "",
  partnership_reporting: [], partnership_ip_ownership: "", partnership_constraints: "",
  partnership_prior_attempts: "", partnership_decision_maker_confirmed: false,
  partnership_prior_experience: null, partnership_prior_experience_detail: "",
  partnership_contact_seniority: "", partnership_physically_present: null,
  partnership_funding_status_readiness: "", partnership_theory_of_change: "",
};

// ─── Step config ──────────────────────────────────────────────────────────────
const STEPS = [
  { label: "Describe",    color: "#2D6A4F", light: "#eaf5ee" },
  { label: "Partnership", color: "#C45C26", light: "#fdf5f2" },
  { label: "Where & When", color: "#2D6A4F", light: "#eaf5ee" },
  { label: "Focus",       color: "#C45C26", light: "#fdf5f2" },
  { label: "Readiness",   color: "#2D6A4F", light: "#eaf5ee" },
  { label: "Confirm",     color: "#C45C26", light: "#fdf5f2" },
];

// ─── Primitives ───────────────────────────────────────────────────────────────

function ProgressBar({ current }: { current: number }) {
  return (
    <div className="shrink-0 border-b border-border bg-background">
      <div className="flex">
        {STEPS.map((s, i) => (
          <div key={i} className="flex-1 relative">
            <div className={`h-1 transition-all duration-300`}
              style={{ background: i <= current ? s.color : "transparent", borderBottom: i > current ? "1px solid var(--border)" : "none" }} />
            <div className={`px-3 py-2.5 text-center transition-colors`}>
              <p className={`text-[10px] font-semibold uppercase tracking-wide truncate ${i === current ? "text-foreground" : i < current ? "text-muted-foreground" : "text-muted-foreground/40"}`}>
                {i < current ? "✓" : `${i + 1}`} <span className="hidden sm:inline">{s.label}</span>
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Step shell -- consistent layout for each step
function StepShell({ step, title, subtitle, children, onBack, onNext, nextLabel, nextDisabled, loading }: {
  step: number; title: string; subtitle: string; children: React.ReactNode;
  onBack?: () => void; onNext?: () => void; nextLabel?: string; nextDisabled?: boolean; loading?: boolean;
}) {
  const s = STEPS[step];
  return (
    <div className="flex flex-col h-full">
      {/* Step header */}
      <div className="shrink-0 px-10 pt-5 pb-4 border-b border-border" style={{ background: `linear-gradient(135deg, ${s.light} 0%, transparent 60%)` }}>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white" style={{ background: s.color }}>
            {step + 1}
          </div>
          <div className="h-px flex-1 opacity-20" style={{ background: s.color }} />
        </div>
        <h2 className="text-lg font-bold text-foreground mb-1">{title}</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">{subtitle}</p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-10 py-6">
        <div className="w-full space-y-7">
          {children}
        </div>
      </div>

      {/* Footer nav */}
      <div className="shrink-0 px-10 py-5 border-t border-border bg-background flex items-center justify-between gap-4">
        {onBack ? (
          <button type="button" onClick={onBack}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors px-4 py-2 rounded-xl hover:bg-muted">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        ) : <div />}
        {onNext && (
          <button type="button" onClick={onNext} disabled={nextDisabled || loading}
            className="flex items-center gap-2 px-8 py-3 rounded-full text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ background: nextDisabled ? undefined : s.color }}>
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Working...</> : <>{nextLabel ?? "Continue"} <ArrowRight className="w-4 h-4" /></>}
          </button>
        )}
      </div>
    </div>
  );
}

// Question block -- each question gets its own visual treatment
function Q({ label, hint, mark, accent, children }: { label: string; hint?: string; mark?: boolean; optional?: boolean; accent?: string; children: React.ReactNode; }) {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        {accent && <div className="w-1 h-full min-h-[20px] rounded-full shrink-0 mt-1" style={{ background: accent, opacity: 0.6 }} />}
        <div>
          <p className="text-sm font-semibold text-foreground">
            {label}
            {mark && <span className="ml-0.5 text-red-500">*</span>}
          </p>
          {hint && <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{hint}</p>}
        </div>
      </div>
      <div className="pl-4">
        {children}
      </div>
    </div>
  );
}
// Option cards -- large, visually distinct selection
function OptionCards({ options, selected, onToggle, multi, cols }: {
  options: { value: string; label: string; sub?: string }[];
  selected: string[];
  onToggle: (v: string) => void;
  multi?: boolean;
  cols?: number;
}) {
  return (
    <div className={`grid gap-2.5 ${cols === 3 ? "grid-cols-3" : cols === 2 ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2"}`}>
      {options.map(opt => {
        const on = selected.includes(opt.value);
        return (
          <button key={opt.value} type="button" onClick={() => onToggle(opt.value)}
            className={`text-left px-4 py-3.5 rounded-xl border-2 transition-all ${on ? "border-current text-foreground shadow-sm" : "border-border text-muted-foreground hover:border-current/30 hover:text-foreground"}`}
            style={on ? { borderColor: STEPS[0].color, background: STEPS[0].light } : {}}>
            <p className={`text-sm font-semibold ${on ? "text-[#2D6A4F]" : ""}`}>{opt.label}</p>
            {opt.sub && <p className="text-xs mt-0.5 opacity-70">{opt.sub}</p>}
          </button>
        );
      })}
    </div>
  );
}

// Chips -- for multi-select tags
function Chips({ options, selected, onToggle, color }: { options: { value: string; label: string }[]; selected: string[]; onToggle: (v: string) => void; color?: string; }) {
  const c = color ?? "#2D6A4F";
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => {
        const on = selected.includes(opt.value);
        return (
          <button key={opt.value} type="button" onClick={() => onToggle(opt.value)}
            className={`px-4 py-2 rounded-full border text-xs font-medium transition-all ${on ? "text-white shadow-sm" : "border-border text-muted-foreground hover:border-current/40 hover:text-foreground"}`}
            style={on ? { background: c, borderColor: c } : {}}>
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// Binary -- yes/no choice
function Binary({ value, onChange, yesLabel, noLabel, color }: { value: boolean | null; onChange: (v: boolean) => void; yesLabel?: string; noLabel?: string; color?: string; }) {
  const c = color ?? "#2D6A4F";
  return (
    <div className="grid grid-cols-2 gap-3">
      {[{ v: true, label: yesLabel ?? "Yes" }, { v: false, label: noLabel ?? "No" }].map(opt => (
        <button key={String(opt.v)} type="button" onClick={() => onChange(opt.v)}
          className={`py-3.5 rounded-xl border-2 text-sm font-semibold transition-all ${value === opt.v ? "text-white shadow-sm" : "border-border text-muted-foreground hover:border-current/30 hover:text-foreground"}`}
          style={value === opt.v ? { background: c, borderColor: c } : {}}>
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// Expandable chip list for long options
function ExpandChips({ label, options, selected, onToggle, color }: { label: string; options: string[]; selected: string[]; onToggle: (v: string) => void; color?: string; }) {
  const [open, setOpen] = useState(selected.length > 0);
  const c = color ?? "#2D6A4F";
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3.5 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors">
        <span>{label} {selected.length > 0 && <span className="ml-2 text-xs px-2 py-0.5 rounded-full text-white font-semibold" style={{ background: c }}>{selected.length}</span>}</span>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-border">
          <div className="flex flex-wrap gap-2 mt-2">
            {options.map(opt => {
              const on = selected.includes(opt);
              return (
                <button key={opt} type="button" onClick={() => onToggle(opt)}
                  className={`px-3.5 py-1.5 rounded-full border text-xs font-medium transition-all ${on ? "text-white" : "border-border text-muted-foreground hover:border-current/40"}`}
                  style={on ? { background: c, borderColor: c } : {}}>
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Check card -- for DD docs and confirmations
function CheckCard({ checked, onChange, label, sub }: { checked: boolean; onChange: (v: boolean) => void; label: string; sub?: string; }) {
  return (
    <label className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${checked ? "border-[#2D6A4F] bg-[#eaf5ee]" : "border-border hover:border-[#2D6A4F]/30 hover:bg-muted/30"}`}>
      <div className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${checked ? "bg-[#2D6A4F] border-[#2D6A4F]" : "border-border"}`}>
        {checked && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5"><polyline points="20 6 9 17 4 12"/></svg>}
      </div>
      <div className="flex-1">
        <p className={`text-sm font-semibold ${checked ? "text-[#2D6A4F]" : "text-foreground"}`}>{label}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{sub}</p>}
      </div>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="sr-only" />
    </label>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export function FindPartnerModalDashboard({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const [formStep, setFormStep] = useState(0);
  const [appState, setAppState] = useState<"form"|"matching"|"results"|"no_org"|"rate_limited"|"new_request_prompt">("form");
  const [freeText, setFreeText] = useState("");
  const [partnershipTitle, setPartnershipTitle] = useState("");
  const [prefilling, setPrefilling] = useState(false);
  const [prefillError, setPrefillError] = useState("");
  const [prefilled, setPrefilled] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [listPublicly, setListPublicly] = useState(true);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [sentInvites, setSentInvites] = useState<Set<string>>(new Set());
  const [sendingInvite, setSendingInvite] = useState<string | null>(null);
  const [orgProfile, setOrgProfile] = useState<any>(null);
  const [form, setForm] = useState<PrefillData>(EMPTY_FORM);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadMode, setUploadMode] = useState<"text"|"doc">("text");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user || !isOpen) return;
    setFormStep(0); setAppState("form"); setFreeText(""); setPartnershipTitle("");
    setPrefillError(""); setPrefilled(false); setMatches([]); setSentInvites(new Set());
    setForm(EMPTY_FORM); setUploadedFile(null); setUploadMode("text");

    async function loadOrg() {
      const [orgRes, profileRes] = await Promise.all([
        supabase.from("organizations").select("id,organisation_name,description,sector,country,organisation_type,needs,offers,sdgs,website,email,verification_status,partnership_listed,partnership_formed,partnership_title").eq("user_id", user!.id).maybeSingle(),
        supabase.from("profiles").select("org_name").eq("id", user!.id).maybeSingle(),
      ]);
      const data = orgRes.data;
      if (data && profileRes.data?.org_name && data.organisation_name !== profileRes.data.org_name) {
        await supabase.from("organizations").update({ organisation_name: profileRes.data.org_name }).eq("id", data.id);
        data.organisation_name = profileRes.data.org_name;
      }
      if (!data) { setAppState("no_org"); return; }
      setOrgProfile(data);
      if (data.partnership_formed) { setAppState("new_request_prompt"); return; }
      if (RATE_LIMIT_ENABLED) {
        const cutoff = new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString();
        const { data: recent } = await supabase.from("partnership_connections").select("created_at").eq("sender_user_id", user!.id).gte("created_at", cutoff).limit(1);
        if (recent && recent.length > 0) { setAppState("rate_limited"); return; }
      }
    }
    loadOrg();
  }, [user, isOpen]);

  if (!isOpen) return null;

  function setF<K extends keyof PrefillData>(key: K, val: PrefillData[K]) { setForm(p => ({ ...p, [key]: val })); }
  function toggleArr(key: keyof PrefillData, val: string) { setForm(p => { const arr = p[key] as string[]; return { ...p, [key]: arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val] }; }); }
  function toggleSingle(key: keyof PrefillData, val: string) { setForm(p => ({ ...p, [key]: (p[key] as string) === val ? "" : val })); }

  async function runPrefill() {
    if ((!freeText.trim() && !uploadedFile) || !orgProfile) return;
    setPrefilling(true); setPrefillError("");
    try {
      const { partnership_sought, partnership_title, needs, offers, ...baseProfile } = orgProfile;
      const body: any = { org_profile: baseProfile };

      if (uploadedFile) {
        const bytes = await uploadedFile.arrayBuffer();
        const b64 = btoa(String.fromCharCode(...new Uint8Array(bytes)));
        body.document_base64 = b64;
        body.document_type = uploadedFile.type;
        if (freeText.trim()) body.free_text = freeText;
      } else {
        body.free_text = freeText;
      }

      const { data, error } = await supabase.functions.invoke("prefill-partnership-form", { body });
  
      if (error || !data?.prefilled) throw new Error(error?.message ?? "Prefill failed");
      const p = data.prefilled;

      setForm(prev => ({
        ...prev,
        country: p.country ?? [], sectors: p.sectors ?? [], sdgs: p.sdgs ?? [],
        organisation_type: p.organisation_type ?? "", needs: p.needs ?? [], offers: p.offers ?? [],
        description: p.description ?? "", partnership_sought: p.partnership_sought ?? "",
        partnership_stage: p.partnership_stage ?? "", partnership_duration: p.partnership_duration ?? "",
        partnership_geo_specificity: p.partnership_geo_specificity ?? "", partnership_budget: p.partnership_budget ?? "",
        partnership_decision_timeline: p.partnership_decision_timeline ?? "",
        partnership_success_definition: p.partnership_success_definition ?? "",
        partnership_legal_type: p.partnership_legal_type ?? [], partnership_exclusivity: p.partnership_exclusivity ?? "",
        partnership_language: p.partnership_language ?? [], partnership_team_capacity: p.partnership_team_capacity ?? "",
        partnership_funding_status:      p.partnership_funding_status ?? "",
        partnership_theory_of_change:    p.partnership_theory_of_change ?? "",
        partnership_prior_attempts:      p.partnership_prior_attempts ?? "",
        partnership_constraints:         p.partnership_constraints ?? "",
      }));
      setPrefilled(true);
      setFormStep(1);
    } catch { setPrefillError("Something went wrong. Try again or simplify your description."); }
    finally { setPrefilling(false); }
  }

  async function submitAndMatch() {
    if (!user || !orgProfile) return;
    setSubmitting(true); setAppState("matching");
    try {
      const { data: freshOrg } = await supabase.from("organizations").select("id").eq("user_id", user.id).maybeSingle();
      const orgId = freshOrg?.id ?? orgProfile?.id;
      if (!orgId) { setAppState("form"); setSubmitting(false); return; }
      await supabase.from("organizations").update({
        country: form.country, sector: form.sectors, sdgs: form.sdgs,
        organisation_type: form.organisation_type, needs: form.needs, offers: form.offers,
        description: form.description, partnership_sought: form.partnership_sought,
        partnership_title: partnershipTitle, partnership_listed: listPublicly,
        partnership_stage: form.partnership_stage || null, partnership_duration: form.partnership_duration || null,
        partnership_geo_specificity: form.partnership_geo_specificity || null,
        partnership_budget: form.partnership_budget || null,
        partnership_decision_timeline: form.partnership_decision_timeline || null,
        partnership_success_definition: form.partnership_success_definition || null,
        partnership_legal_type: form.partnership_legal_type.length > 0 ? form.partnership_legal_type : null,
        partnership_exclusivity: form.partnership_exclusivity || null,
        partnership_language: form.partnership_language.length > 0 ? form.partnership_language : null,
        partnership_team_capacity: form.partnership_team_capacity || null,
        partnership_funding_status: form.partnership_funding_status || null,
        partnership_dd_financial_model: form.partnership_dd_financial_model,
        partnership_dd_audited_accounts: form.partnership_dd_audited_accounts,
        partnership_dd_safeguarding_policy: form.partnership_dd_safeguarding_policy,
        partnership_dd_data_policy: form.partnership_dd_data_policy,
        partnership_dd_governance_doc: form.partnership_dd_governance_doc,
        partnership_financial_transfer: form.partnership_financial_transfer || null,
        partnership_working_style: form.partnership_working_style || null,
        partnership_reporting: form.partnership_reporting.length > 0 ? form.partnership_reporting : null,
        partnership_ip_ownership: form.partnership_ip_ownership || null,
        partnership_constraints: form.partnership_constraints || null,
        partnership_prior_attempts: form.partnership_prior_attempts || null,
        partnership_decision_maker_confirmed: form.partnership_decision_maker_confirmed,
        partnership_prior_experience: form.partnership_prior_experience,
        partnership_prior_experience_detail: form.partnership_prior_experience_detail || null,
        partnership_contact_seniority: form.partnership_contact_seniority || null,
        partnership_physically_present: form.partnership_physically_present,
        partnership_theory_of_change: form.partnership_theory_of_change || null,
        ...(listPublicly ? { status: "published" } : {}),
      }).eq("id", orgId).eq("user_id", user.id);

      const { data: matchData } = await supabase.functions.invoke("match-orgs-for-partnership", {
        body: { submitting_org: { ...orgProfile, ...form, sector: form.sectors }, user_id: user.id },
      });
      setMatches(matchData?.matches ?? []);
      setAppState("results");
    } catch { setAppState("results"); }
    finally { setSubmitting(false); }
  }

  async function sendInvite(match: MatchResult) {
    if (!user || !orgProfile) return;
    setSendingInvite(match.org_id);
    try {
      const { error } = await supabase.from("partnership_connections").insert({ sender_org_id: orgProfile.id, receiver_org_id: match.org.id, sender_user_id: user.id, source: "ai_match", ai_rationale: match.rationale, fit_score: match.fit_score, status: "pending" });
      if (error && !error.message.includes("unique")) throw error;
      const { data: receiverProfile } = await supabase.from("organizations").select("user_id").eq("id", match.org.id).single();
      const { data: convData } = await supabase.from("conversations").insert({ conversation_type: "partnership", status: "open" }).select("id").single();
      if (convData?.id) {
        await supabase.from("conversation_participants").insert([{ conversation_id: convData.id, user_id: user.id }, ...(receiverProfile?.user_id ? [{ conversation_id: convData.id, user_id: receiverProfile.user_id }] : [])]);
        await supabase.from("messages").insert({ conversation_id: convData.id, sender_id: user.id, body: `Hi ${match.org.organisation_name}, I'm ${orgProfile.organisation_name} and I came across your listing on Impact Natives. ${match.rationale}\n\nWould you be open to a conversation?` });
      }
      if (receiverProfile?.user_id) {
        await supabase.from("notifications").insert({ user_id: receiverProfile.user_id, type: "partnership_invite", title: "New partnership invitation", body: `${orgProfile.organisation_name} wants to explore a partnership with you.`, link: "/dashboard/portfolio?tab=partnerships", metadata: { sender_org_id: orgProfile.id, sender_org_name: orgProfile.organisation_name, fit_score: match.fit_score, key_synergy: match.key_synergy, conversation_id: convData?.id } });
      }
      setSentInvites(prev => new Set(prev).add(match.org_id));
    } catch (e) { console.error("Send invite error:", e); }
    finally { setSendingInvite(null); }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col" style={{ animation: "slideUp 0.3s cubic-bezier(0.4,0,0.2,1) forwards" }}>
      <style>{`@keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>

      {/* Header */}
      <div className="flex items-center justify-between px-8 py-3.5 border-b border-border shrink-0 bg-background">
        <div className="flex items-center gap-3">
          {appState === "form" && formStep > 0 && (
            <button type="button" onClick={() => setFormStep(s => s - 1)} className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#2D6A4F] flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-semibold text-foreground">Get Matched</span>
            {partnershipTitle && appState === "form" && formStep > 0 && (
              <span className="text-xs text-muted-foreground truncate max-w-[200px]">— {partnershipTitle}</span>
            )}
          </div>
        </div>
        <button type="button" onClick={onClose} className="text-xs font-medium text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg hover:bg-muted transition-colors">
          Close ✕
        </button>
      </div>

      {/* Progress */}
      {appState === "form" && <ProgressBar current={formStep} />}

      {/* Body */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">

        {/* ── Utility states ── */}
        {appState === "new_request_prompt" && (
          <div className="flex flex-col items-center justify-center flex-1 gap-8 text-center px-8">
            <div className="w-16 h-16 rounded-2xl bg-[#2D6A4F]/10 flex items-center justify-center"><Sparkles className="w-8 h-8 text-[#2D6A4F]" /></div>
            <div className="max-w-md">
              <h2 className="text-2xl font-bold text-foreground mb-3">Start a new partnership request?</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">You've recently formed a partnership. Starting fresh replaces your current listing. Confirmed partners stay saved in Portfolio.</p>
            </div>
            <div className="flex gap-3 w-full max-w-xs">
              <button type="button" onClick={onClose} className="flex-1 h-11 rounded-full border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors">Cancel</button>
              <button type="button" onClick={async () => {
                if (!orgProfile) return;
                await supabase.from("organizations").update({ partnership_formed: false, partnership_listed: false, partnership_title: null, partnership_sought: null }).eq("id", orgProfile.id);
                const { data: freshOrg } = await supabase.from("organizations").select("id,organisation_name,description,sector,country,organisation_type,needs,offers,sdgs,website,email,verification_status,partnership_listed,partnership_formed,partnership_title").eq("id", orgProfile.id).single();
                setOrgProfile(freshOrg); setPartnershipTitle(""); setFreeText(""); setAppState("form"); setFormStep(0);
              }} className="flex-1 h-11 rounded-full bg-[#2D6A4F] hover:bg-[#245c43] text-white text-sm font-semibold transition-colors">Start fresh</button>
            </div>
          </div>
        )}

        {appState === "no_org" && (
          <div className="flex flex-col items-center justify-center flex-1 gap-5 text-center px-8">
            <h2 className="text-xl font-bold text-foreground">Get Matched is for organisations</h2>
            <p className="text-muted-foreground max-w-sm text-sm">Create an organisation profile first to access partnership matching.</p>
            <button type="button" onClick={onClose} className="h-10 px-6 rounded-full bg-[#2D6A4F] text-white text-sm font-semibold">Close</button>
          </div>
        )}

        {appState === "rate_limited" && (
          <div className="flex flex-col items-center justify-center flex-1 gap-5 text-center px-8">
            <h2 className="text-xl font-bold text-foreground">Come back in 7 hours</h2>
            <p className="text-muted-foreground max-w-sm text-sm">You can run Get Matched once every 7 hours to keep listings current.</p>
            <button type="button" onClick={onClose} className="h-10 px-6 rounded-full bg-[#2D6A4F] text-white text-sm font-semibold">Close</button>
          </div>
        )}

        {appState === "matching" && (
          <div className="flex flex-col items-center justify-center flex-1 gap-8 text-center px-8">
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl bg-[#2D6A4F]/10 flex items-center justify-center">
                <Loader2 className="w-9 h-9 text-[#2D6A4F] animate-spin" />
              </div>
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground mb-2">Finding your matches</h2>
              <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">Analysing needs, offers, sectors, SDG alignment, readiness signals, and working style across the ecosystem...</p>
            </div>
          </div>
        )}

        {appState === "results" && (
          <div className="flex-1 overflow-y-auto px-10 py-8">
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="flex items-center gap-4 p-5 rounded-2xl border-2 border-[#2D6A4F]/20 bg-[#eaf5ee]">
                <div className="w-10 h-10 rounded-xl bg-[#2D6A4F] flex items-center justify-center shrink-0"><CheckCircle2 className="w-5 h-5 text-white" /></div>
                <div>
                  <h2 className="text-base font-bold text-foreground">{listPublicly ? "You're listed" : "Matches found"}</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">{listPublicly ? "Your organisation now appears in the Partnerships directory." : "AI has identified potential matches based on your brief."}</p>
                </div>
              </div>

              {matches.length === 0 ? (
                <div className="rounded-2xl border-2 border-border p-10 text-center space-y-3">
                  <p className="text-base font-bold text-foreground">No matches found yet</p>
                  <p className="text-sm text-muted-foreground max-w-xs mx-auto">The Natives team has been notified and will follow up. Check back as more organisations join.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{matches.length} potential match{matches.length !== 1 ? "es" : ""} found</p>
                  {matches.map(match => {
                    const invited = sentInvites.has(match.org_id);
                    const sending = sendingInvite === match.org_id;
                    const countries = Array.isArray(match.org.country) ? match.org.country : String(match.org.country ?? "").startsWith("{") ? String(match.org.country).slice(1,-1).split(",").map((s:string) => s.replace(/"/g,"").trim()) : [match.org.country];
                    return (
                      <div key={match.org_id} className="rounded-2xl border-2 border-border overflow-hidden hover:border-[#2D6A4F]/30 transition-colors">
                        <div className="px-6 py-5 border-b border-border flex items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-bold text-foreground">{match.org.organisation_name}</p>
                              {match.org.verification_status === "verified" && (<span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#eaf5ee] text-[#2D6A4F]"><ShieldCheck className="w-3 h-3" />Verified</span>)}
                            </div>
                            <p className="text-xs text-muted-foreground capitalize">{match.org.organisation_type?.replace(/_/g, " ")}{countries.length > 0 && ` · ${countries.join(", ")}`}</p>
                          </div>
                          <div className="shrink-0 text-right">
                            <div className="text-3xl font-black text-[#2D6A4F]">{match.fit_score}</div>
                            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">fit score</div>
                          </div>
                        </div>
                        <div className="px-6 py-5 space-y-4">
                          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#fdf5f2]">
                            <span className="text-[10px] font-black uppercase tracking-widest text-[#C45C26]">Synergy</span>
                            <span className="text-xs text-muted-foreground">{match.key_synergy}</span>
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed">{match.rationale}</p>
                          <div className="flex items-center gap-3 pt-3 border-t border-border">
                            {invited ? (
                              <span className="flex items-center gap-1.5 text-sm font-semibold text-[#2D6A4F]"><CheckCircle2 className="w-4 h-4" />Invitation sent</span>
                            ) : (
                              <button type="button" onClick={() => sendInvite(match)} disabled={sending}
                                className="h-10 px-6 rounded-full bg-[#2D6A4F] hover:bg-[#245c43] text-white text-xs font-bold disabled:opacity-40 transition-colors flex items-center gap-2">
                                {sending ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Sending...</> : "Reach out"}
                              </button>
                            )}
                            {match.org.website && match.org.website !== "https://" && (
                              <a href={match.org.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto">
                                <ExternalLink className="w-3.5 h-3.5" />Website
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <button type="button" onClick={onClose} className="w-full py-3.5 rounded-full border-2 border-border text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors">Done</button>
            </div>
          </div>
        )}

        {/* ── Form steps ── */}
        {appState === "form" && (
          <>
            {/* STEP 0: Describe */}
            {formStep === 0 && (
              <StepShell step={0}
                title="What partnership are you seeking?"
                subtitle="Give your request a title and describe what you need — or upload a partnership strategy document and let AI extract the key details."
                onNext={runPrefill}
                nextLabel="Structure with AI"
                nextDisabled={(!freeText.trim() && !uploadedFile) || !partnershipTitle.trim()}
                loading={prefilling}>

                {/* Title */}
                <Q label="Partnership request title" hint="A short, specific title for this partnership listing." mark>
                  <input type="text" placeholder="e.g. Research partner for Nigeria health programme"
                    value={partnershipTitle} onChange={e => setPartnershipTitle(e.target.value)}
                    className="w-full h-12 px-4 rounded-xl border-2 border-border bg-background text-sm focus:outline-none focus:border-[#2D6A4F] transition-colors font-medium" />
                </Q>

                {/* Input mode toggle */}
                <div className="flex rounded-xl border-2 border-border overflow-hidden">
                  <button type="button" onClick={() => setUploadMode("text")}
                    className={`flex-1 py-3 text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${uploadMode === "text" ? "bg-[#2D6A4F] text-white" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}>
                    <Sparkles className="w-4 h-4" /> Describe in words
                  </button>
                  <button type="button" onClick={() => setUploadMode("doc")}
                    className={`flex-1 py-3 text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${uploadMode === "doc" ? "bg-[#2D6A4F] text-white" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}>
                    <Upload className="w-4 h-4" /> Upload a document
                  </button>
                </div>

                {uploadMode === "text" ? (
                  <Q label="Describe your partnership need"
                    hint="Include what you're working on, where, what kind of support you need, what you can offer, budget range, and timeline. The more detail, the better the AI can structure your brief." mark>
                    <textarea rows={8}
                      placeholder="e.g. We're an NGO working on last-mile health delivery in northern Nigeria. We need a UK-based research partner to help design impact evaluations and co-author publications. We can offer field access, community relationships, and local implementation capacity. Budget: £30K–£50K over 18 months starting Q3 2026..."
                      value={freeText} onChange={e => setFreeText(e.target.value)}
                      className="w-full px-4 py-3.5 rounded-xl border-2 border-border bg-background text-sm resize-none focus:outline-none focus:border-[#2D6A4F] transition-colors leading-relaxed" />
                  </Q>
                ) : (
                  <Q label="Upload your partnership strategy document"
                    hint="PDF or Word document. AI will extract partnership-relevant content — sectors, needs, offers, geography, budget, and timeline.">
                    <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" className="sr-only"
                      onChange={e => { const f = e.target.files?.[0]; if (f) setUploadedFile(f); }} />
                    {!uploadedFile ? (
                      <button type="button" onClick={() => fileRef.current?.click()}
                        className="w-full border-2 border-dashed border-border rounded-xl py-10 flex flex-col items-center gap-3 hover:border-[#2D6A4F]/50 hover:bg-[#2D6A4F]/5 transition-colors group">
                        <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center group-hover:bg-[#2D6A4F]/10 transition-colors">
                          <Upload className="w-6 h-6 text-muted-foreground group-hover:text-[#2D6A4F] transition-colors" />
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-semibold text-foreground">Click to upload</p>
                          <p className="text-xs text-muted-foreground mt-1">PDF, DOC, or DOCX — max 10MB</p>
                        </div>
                      </button>
                    ) : (
                      <div className="flex items-center gap-4 p-4 rounded-xl border-2 border-[#2D6A4F] bg-[#eaf5ee]">
                        <div className="w-10 h-10 rounded-lg bg-[#2D6A4F] flex items-center justify-center shrink-0">
                          <FileText className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{uploadedFile.name}</p>
                          <p className="text-xs text-muted-foreground">{(uploadedFile.size / 1024).toFixed(0)} KB</p>
                        </div>
                        <button type="button" onClick={() => { setUploadedFile(null); if (fileRef.current) fileRef.current.value = ""; }}
                          className="p-1.5 rounded-lg hover:bg-[#2D6A4F]/10 text-muted-foreground hover:text-foreground transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    {uploadedFile && (
                      <div className="mt-3">
                        <p className="text-xs font-medium text-muted-foreground mb-2">Add any extra context <span className="font-normal">(optional)</span></p>
                        <textarea rows={3} placeholder="Any additional details not in the document..."
                          value={freeText} onChange={e => setFreeText(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border-2 border-border bg-background text-sm resize-none focus:outline-none focus:border-[#2D6A4F] transition-colors" />
                      </div>
                    )}
                  </Q>
                )}

                {prefillError && (
                  <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3 border border-red-200">{prefillError}</p>
                )}

                {prefilled && (
                  <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[#eaf5ee] border border-[#2D6A4F]/20">
                    <CheckCircle2 className="w-4 h-4 text-[#2D6A4F] shrink-0" />
                    <p className="text-xs font-medium text-[#2D6A4F]">Brief already structured — click Continue to review the next step.</p>
                  </div>
                )}
              </StepShell>
            )}

            {/* STEP 1: The partnership */}
            {formStep === 1 && (
              <StepShell step={1}
                title="The partnership"
                subtitle="What kind of partnership are you creating? These signals help us match you with organisations whose working style and expectations align with yours."
                onBack={() => setFormStep(0)}
                onNext={() => setFormStep(2)}
                nextDisabled={!form.partnership_sought.trim() || !form.partnership_stage}>

                <Q label="What are you looking for?" hint="Be specific. What would a good partner actually do?" accent="#C45C26" mark>
                  <Textarea className="w-full text-sm resize-none rounded-xl border-2 min-h-[100px]"
                    value={form.partnership_sought} onChange={e => setF("partnership_sought", e.target.value)}
                    placeholder="e.g. A UK-based research institution with experience in health systems evaluation who can co-design our M&E framework and co-author peer-reviewed publications." />
                </Q>

                <Q label="Stage of work" hint="Where is this initiative right now?" accent="#C45C26" mark>                  
                  <OptionCards
                    options={[
                      { value: "concept", label: "Co-design from scratch", sub: "Idea defined, looking for a partner to shape it together" },
                      { value: "joining_running", label: "Join something running", sub: "Programme is active, partner plugs in" },
                      { value: "pilot", label: "Pilot phase", sub: "Testing the approach, refining before scale" },
                      { value: "scaling", label: "Scaling existing work", sub: "Proven model, expanding reach or geography" },
                    ]}
                    selected={form.partnership_stage ? [form.partnership_stage] : []}
                    onToggle={v => toggleSingle("partnership_stage", v)}
                  />
                </Q>

                <Q label="Expected duration" accent="#C45C26">
                  <Chips
                    options={[{value:"under_6_months",label:"Under 6 months"},{value:"6_12_months",label:"6–12 months"},{value:"1_2_years",label:"1–2 years"},{value:"2_plus_years",label:"2+ years"},{value:"ongoing",label:"Ongoing"}]}
                    selected={form.partnership_duration ? [form.partnership_duration] : []}
                    onToggle={v => toggleSingle("partnership_duration", v)}
                    color="#C45C26"
                  />
                </Q>

                <Q label="Type of partnership relationship" hint="Select all that apply." accent="#C45C26">
                  <Chips
                    options={[{value:"formal_mou",label:"Formal MoU"},{value:"subcontracting",label:"Service provider arrangement"},{value:"co_implementation",label:"Joint delivery"},{value:"referral",label:"Referral / network"},{value:"joint_venture",label:"Joint venture"},{value:"informal",label:"Informal collaboration"},{value:"open",label:"Open to discussion"}]}
                    selected={form.partnership_legal_type}
                    onToggle={v => toggleArr("partnership_legal_type", v)}
                    color="#C45C26"
                  />
                </Q>

                <Q label="Partner exclusivity" accent="#C45C26">
                  <Binary
                    value={form.partnership_exclusivity === "multiple_partners" ? true : form.partnership_exclusivity === "one_dedicated_partner" ? false : null}
                    onChange={v => setF("partnership_exclusivity", v ? "multiple_partners" : "one_dedicated_partner")}
                    yesLabel="Open to multiple partners"
                    noLabel="One dedicated partner"
                    color="#C45C26"
                  />
                </Q>
              </StepShell>
            )}

            {/* STEP 2: Where and when */}
            {formStep === 2 && (
              <StepShell step={2}
                title="Where and when"
                subtitle="Location specificity, timeline, and resource signals save both sides from mismatched expectations before a single message is sent."
                onBack={() => setFormStep(1)}
                onNext={() => setFormStep(3)}
                nextDisabled={form.country.length === 0}>

                <Q label="Specific location for this partnership" optional hint="Be as precise as possible — state, city, or corridor. More specific = better matches." accent="#2D6A4F">
                  <input type="text" placeholder="e.g. Kano State, Nigeria"
                    value={form.partnership_geo_specificity} onChange={e => setF("partnership_geo_specificity", e.target.value)}
                    className="w-full h-12 px-4 rounded-xl border-2 border-border bg-background text-sm focus:outline-none focus:border-[#2D6A4F] transition-colors" />
                </Q>

                <Q label="Where you operate" accent="#2D6A4F" mark>
                  <Chips options={COUNTRIES.map(c => ({ value: c, label: c }))} selected={form.country} onToggle={v => toggleArr("country", v)} />
                </Q>

                <Q label="Are you physically present in the target location?" accent="#2D6A4F">
                  <Binary value={form.partnership_physically_present} onChange={v => setF("partnership_physically_present", v)} yesLabel="Yes — on the ground" noLabel="No — working remotely" />
                </Q>

                <Q label="When do you need a partner by?" accent="#2D6A4F">
                  <OptionCards
                    options={[
                      { value: "immediately", label: "Immediately" },
                      { value: "within_1_month", label: "Within 1 month" },
                      { value: "1_3_months", label: "1–3 months" },
                      { value: "3_6_months", label: "3–6 months" },
                      { value: "no_fixed_timeline", label: "No fixed timeline" },
                    ]}
                    selected={form.partnership_decision_timeline ? [form.partnership_decision_timeline] : []}
                    onToggle={v => toggleSingle("partnership_decision_timeline", v)}
                    cols={3}
                  />
                </Q>

                <Q label="Budget / resource commitment" accent="#2D6A4F">
                  <Chips
                    options={[{value:"under_10k",label:"Under $10K"},{value:"10k_50k",label:"$10K–$50K"},{value:"50k_200k",label:"$50K–$200K"},{value:"over_200k",label:"Over $200K"},{value:"in_kind_only",label:"In-kind only"},{value:"open",label:"Open to discussion"}]}
                    selected={form.partnership_budget ? [form.partnership_budget] : []}
                    onToggle={v => toggleSingle("partnership_budget", v)}
                  />
                </Q>

                <Q label="Funding status of this work" accent="#2D6A4F">
                  <OptionCards
                    options={[
                      { value: "fully_funded", label: "Fully funded", sub: "Resources confirmed, partner executes" },
                      { value: "partially_funded", label: "Partially funded", sub: "Gap exists, partner may help close it" },
                      { value: "seeking_funding", label: "Seeking funding together", sub: "Joint fundraising with partner" },
                      { value: "partner_brings_funding", label: "Partner brings funding", sub: "We bring implementation, they fund" },
                    ]}
                    selected={form.partnership_funding_status ? [form.partnership_funding_status] : []}
                    onToggle={v => toggleSingle("partnership_funding_status", v)}
                  />
                </Q>

                <Q label="Team capacity you can dedicate" accent="#2D6A4F">
                  <Chips
                    options={[{value:"1_part_time",label:"1 person part-time"},{value:"1_full_time",label:"1 person full-time"},{value:"2_5_people",label:"2–5 people"},{value:"5_plus_people",label:"5+ people"},{value:"tbd",label:"To be determined"}]}
                    selected={form.partnership_team_capacity ? [form.partnership_team_capacity] : []}
                    onToggle={v => toggleSingle("partnership_team_capacity", v)}
                  />
                </Q>
              </StepShell>
            )}

            {/* STEP 3: Focus areas */}
            {formStep === 3 && (
              <StepShell step={3}
                title="What you work on"
                subtitle="Sectors, needs, offers, and the outcome you're aiming for. This is the core matching data — the more accurate, the better your matches."
                onBack={() => setFormStep(2)}
                onNext={() => setFormStep(4)}
                nextDisabled={form.sectors.length === 0 || form.needs.length === 0 || form.offers.length === 0 || !form.partnership_success_definition.trim()}>

                <Q label="Sectors" hint="Select all that apply to this initiative." accent="#C45C26" mark>
                  <ExpandChips label="Select sectors" options={SECTORS} selected={form.sectors} onToggle={v => toggleArr("sectors", v)} color="#C45C26" />
                </Q>

                <Q label="What you need from a partner" accent="#C45C26" mark>
                  <Chips options={NEEDS_OPTIONS.map(o => ({ value: o, label: o }))} selected={form.needs} onToggle={v => toggleArr("needs", v)} color="#C45C26" />
                </Q>

                <Q label="What you offer a partner" accent="#C45C26" mark>
                  <Chips options={OFFERS_OPTIONS.map(o => ({ value: o, label: o }))} selected={form.offers} onToggle={v => toggleArr("offers", v)} color="#C45C26" />
                </Q>

                <Q label="SDG alignment" optional accent="#C45C26">
                  <ExpandChips label="Select SDGs"
                    options={SDG_LIST.map(n => `SDG ${n}`)}
                    selected={form.sdgs.map(n => `SDG ${n}`)}
                    onToggle={v => { const n = parseInt(v.replace("SDG ","")); setForm(p => ({ ...p, sdgs: p.sdgs.includes(n) ? p.sdgs.filter(s => s !== n) : [...p.sdgs, n] })); }}
                    color="#C45C26"
                  />
                </Q>

                <Q label="Working language(s)" accent="#C45C26">
                  <Chips options={["English","French","Portuguese","Arabic","Swahili","Other"].map(l => ({ value: l, label: l }))} selected={form.partnership_language} onToggle={v => toggleArr("partnership_language", v)} color="#C45C26" />
                </Q>

                <Q label="What does success look like in 12 months?" hint="One sentence. This is the most important signal for match quality — it forces outcome clarity and tells the AI what to optimise for." accent="#C45C26" mark>
                  <Textarea className="w-full text-sm resize-none rounded-xl border-2 min-h-[80px]"
                    placeholder="e.g. A published evaluation framework co-authored with our research partner, adopted by 3 state health ministries by end of 2027."
                    value={form.partnership_success_definition}
                    onChange={e => setF("partnership_success_definition", e.target.value)} />
                </Q>

                <p className="text-xs text-muted-foreground">Select at least one sector and one need to continue.</p>
              </StepShell>
            )}

            {/* STEP 4: Readiness */}
            {formStep === 4 && (
              <StepShell step={4}
                title="Partnership readiness"
                subtitle="Serious partners do due diligence before committing. Showing what you have ready — and being honest about your working style — filters out mismatches before they waste your time."
                onBack={() => setFormStep(3)}
                onNext={() => setFormStep(5)}>

                <Q label="Documents you have ready" optional hint="Tick what you can share during due diligence. This shows on your listing." accent="#2D6A4F">
                  <div className="space-y-2.5">
                    {[
                      { key: "partnership_dd_financial_model",     label: "Financial model",       sub: "Budget projections or financial statements" },
                      { key: "partnership_dd_audited_accounts",    label: "Audited accounts",      sub: "Third-party verified financial records" },
                      { key: "partnership_dd_safeguarding_policy", label: "Safeguarding policy",   sub: "Child and vulnerable adult protection" },
                      { key: "partnership_dd_data_policy",         label: "Data / GDPR policy",    sub: "How you handle personal data" },
                      { key: "partnership_dd_governance_doc",      label: "Governance document",   sub: "Board structure, constitution, or bylaws" },
                    ].map(({ key, label, sub }) => (
                      <CheckCard key={key} checked={form[key as keyof PrefillData] as boolean} onChange={v => setForm(p => ({ ...p, [key]: v }))} label={label} sub={sub} />
                    ))}
                  </div>
                </Q>

                <Q label="Who leads this partnership on your side?" accent="#2D6A4F">
                  <OptionCards
                    options={[
                      { value: "executive",         label: "Executive / Director" },
                      { value: "programme_manager", label: "Programme Manager" },
                      { value: "technical_lead",    label: "Technical Lead" },
                      { value: "to_be_assigned",    label: "To be assigned" },
                    ]}
                    selected={form.partnership_contact_seniority ? [form.partnership_contact_seniority] : []}
                    onToggle={v => toggleSingle("partnership_contact_seniority", v)}
                  />
                </Q>

                <Q label="Financial transfer expectation" accent="#2D6A4F">
                  <OptionCards
                    options={[
                      { value: "we_pay",      label: "We provide funding or fees", sub: "We pay partners for their contribution" },
                      { value: "we_get_paid", label: "We expect compensation",     sub: "We expect a subgrant or service fee" },
                      { value: "no_transfer", label: "No financial transfer",      sub: "In-kind, voluntary, or co-equal" },
                      { value: "open",        label: "Open to discussion",         sub: "To be agreed based on partner" },
                    ]}
                    selected={form.partnership_financial_transfer ? [form.partnership_financial_transfer] : []}
                    onToggle={v => toggleSingle("partnership_financial_transfer", v)}
                  />
                </Q>

                <Q label="Working style preference" accent="#2D6A4F">
                  <OptionCards
                    options={[
                      { value: "prefer_lead",    label: "We prefer to lead",    sub: "We set direction, partner delivers" },
                      { value: "equal_codesign", label: "Equal co-design",       sub: "Shared decision-making throughout" },
                      { value: "prefer_support", label: "We prefer to support",  sub: "Partner leads, we contribute" },
                      { value: "flexible",       label: "Flexible",              sub: "Depends on the partner's strengths" },
                    ]}
                    selected={form.partnership_working_style ? [form.partnership_working_style] : []}
                    onToggle={v => toggleSingle("partnership_working_style", v)}
                  />
                </Q>

                <Q label="Reporting expectations" accent="#2D6A4F">
                  <Chips
                    options={[{value:"monthly",label:"Monthly updates"},{value:"quarterly",label:"Quarterly check-ins"},{value:"milestone_based",label:"Milestone-based only"},{value:"flexible",label:"Flexible"}]}
                    selected={form.partnership_reporting}
                    onToggle={v => toggleArr("partnership_reporting", v)}
                  />
                </Q>

                {["research","technology_company","startup","social_enterprise"].includes(form.organisation_type) && (
                  <Q label="IP and data ownership" accent="#2D6A4F">
                    <Chips
                      options={[{value:"open_ip",label:"Open IP / shared ownership"},{value:"our_org_retains",label:"Our org retains ownership"},{value:"negotiable",label:"Negotiable"},{value:"not_applicable",label:"Not applicable"}]}
                      selected={form.partnership_ip_ownership ? [form.partnership_ip_ownership] : []}
                      onToggle={v => toggleSingle("partnership_ip_ownership", v)}
                    />
                  </Q>
                )}

                <Q label="Have you successfully completed a partnership before?" accent="#2D6A4F">
                  <Binary value={form.partnership_prior_experience} onChange={v => setF("partnership_prior_experience", v)} />
                  {form.partnership_prior_experience === true && (
                    <div className="mt-3">
                      <Textarea className="w-full text-sm resize-none rounded-xl border-2"
                        placeholder="Briefly describe one completed partnership — who with, what you did, and what came of it."
                        value={form.partnership_prior_experience_detail}
                        onChange={e => setF("partnership_prior_experience_detail", e.target.value)} />
                    </div>
                  )}
                </Q>
              </StepShell>
            )}

            {/* STEP 5: Confirm */}
            {formStep === 5 && (
              <StepShell step={5}
                title="Final details"
                subtitle="A few last things before we match you — your theory of change, any constraints partners need to know, and whether to list publicly."
                onBack={() => setFormStep(4)}
                onNext={submitAndMatch}
                nextLabel={listPublicly ? "List publicly + find matches" : "Find matches privately"}
                loading={submitting}>

                <Q label="Your approach to creating change" optional hint="One sentence. Helps partners check if your theories of change are compatible — a common reason good-looking partnerships fail." accent="#C45C26">
                  <Textarea className="w-full text-sm resize-none rounded-xl border-2"
                    placeholder=""
                    value={form.partnership_theory_of_change}
                    onChange={e => setF("partnership_theory_of_change", e.target.value)} />
                </Q>

                <Q label="Previous attempts at this type of partnership" optional hint="Transparency about what you've tried builds trust and helps us match you better." accent="#C45C26">
                  <Textarea className="w-full text-sm resize-none rounded-xl border-2"
                    placeholder=""
                    value={form.partnership_prior_attempts}
                    onChange={e => setF("partnership_prior_attempts", e.target.value)} />
                </Q>

                <Q label="Existing constraints" optional hint="Donor restrictions, exclusivity agreements, or legal constraints partners should know about before reaching out." accent="#C45C26">
                  <Textarea className="w-full text-sm resize-none rounded-xl border-2"
                    placeholder=""
                    value={form.partnership_constraints}
                    onChange={e => setF("partnership_constraints", e.target.value)} />
                </Q>

                <div className="space-y-3 pt-2">
                  <CheckCard
                    checked={form.partnership_decision_maker_confirmed}
                    onChange={v => setF("partnership_decision_maker_confirmed", v)}
                    label="I am authorised to enter into partnerships on behalf of my organisation"
                    sub="Confirms to matched partners that this request has organisational backing — not just an individual exploring options."
                  />
                  <CheckCard
                    checked={listPublicly}
                    onChange={setListPublicly}
                    label="List publicly in the Partnerships directory"
                    sub="Other organisations can find and express interest in your listing. Uncheck to run AI matching privately without being listed."
                  />
                </div>

                {!listPublicly && (
                  <p className="text-xs text-muted-foreground px-1">Your details won't be listed publicly. The Natives team will follow up with matches directly.</p>
                )}
              </StepShell>
            )}
          </>
        )}
      </div>
    </div>
  );
}
