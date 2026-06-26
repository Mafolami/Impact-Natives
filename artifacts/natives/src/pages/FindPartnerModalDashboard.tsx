// ─── FindPartnerModalDashboard.tsx ───────────────────────────────────────────
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles, CheckCircle2, ArrowLeft, ExternalLink, ShieldCheck, ChevronDown, ChevronUp } from "lucide-react";
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

function StepProgress({ current }: { current: number }) {
  const steps = [
    { label: "Describe", sub: "Tell us what you need" },
    { label: "Details",  sub: "Review AI-structured brief" },
    { label: "Readiness", sub: "Partnership expectations" },
  ];
  return (
    <div className="grid grid-cols-3 border-b border-border shrink-0">
      {steps.map((s, i) => (
        <div key={i} className={`px-6 py-4 transition-colors ${i === current ? "bg-[#2D6A4F]/5 border-b-2 border-[#2D6A4F]" : "border-b-2 border-transparent"}`}>
          <div className="flex items-center gap-2.5">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 transition-all ${i < current ? "bg-[#2D6A4F] text-white" : i === current ? "bg-[#C45C26] text-white" : "bg-muted text-muted-foreground"}`}>
              {i < current ? "✓" : i + 1}
            </div>
            <div className="min-w-0">
              <p className={`text-xs font-semibold truncate ${i === current ? "text-foreground" : "text-muted-foreground"}`}>{s.label}</p>
              <p className="text-[10px] text-muted-foreground truncate hidden sm:block">{s.sub}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Chips({ options, selected, onToggle }: { options: { value: string; label: string }[]; selected: string[]; onToggle: (v: string) => void; }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => {
        const on = selected.includes(opt.value);
        return (
          <button key={opt.value} type="button" onClick={() => onToggle(opt.value)}
            className={`px-4 py-2 rounded-full border text-xs font-medium transition-all ${on ? "bg-[#2D6A4F] border-[#2D6A4F] text-white shadow-sm" : "bg-background text-muted-foreground border-border hover:border-[#2D6A4F]/60 hover:text-[#2D6A4F] hover:bg-[#2D6A4F]/5"}`}>
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function YesNo({ value, onChange, yesLabel, noLabel }: { value: boolean | null; onChange: (v: boolean) => void; yesLabel?: string; noLabel?: string; }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {[{ v: true, label: yesLabel ?? "Yes" }, { v: false, label: noLabel ?? "No" }].map(opt => (
        <button key={String(opt.v)} type="button" onClick={() => onChange(opt.v)}
          className={`py-3 rounded-xl border text-sm font-medium transition-all ${value === opt.v ? "border-[#2D6A4F] bg-[#eaf5ee] text-[#2D6A4F] shadow-sm" : "border-border text-muted-foreground hover:border-[#2D6A4F]/40 hover:bg-[#2D6A4F]/5"}`}>
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function ExpandableChips({ label, options, selected, onToggle }: { label: string; options: string[]; selected: string[]; onToggle: (v: string) => void; }) {
  const [open, setOpen] = useState(selected.length > 0);
  return (
    <div>
      <button type="button" onClick={() => setOpen(v => !v)}
        className="flex items-center justify-between w-full py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors">
        <span>{label} {selected.length > 0 && <span className="normal-case font-normal text-[#2D6A4F]">— {selected.length} selected</span>}</span>
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>
      {open && (
        <div className="flex flex-wrap gap-2 mt-3">
          {options.map(opt => {
            const on = selected.includes(opt);
            return (
              <button key={opt} type="button" onClick={() => onToggle(opt)}
                className={`px-4 py-2 rounded-full border text-xs font-medium transition-all ${on ? "bg-[#2D6A4F] border-[#2D6A4F] text-white" : "bg-background text-muted-foreground border-border hover:border-[#2D6A4F]/60 hover:text-[#2D6A4F]"}`}>
                {opt}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CheckRow({ checked, onChange, label, sub }: { checked: boolean; onChange: (v: boolean) => void; label: string; sub?: string; }) {
  return (
    <label className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${checked ? "border-[#2D6A4F] bg-[#eaf5ee]" : "border-border hover:border-[#2D6A4F]/40 hover:bg-muted/30"}`}>
      <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${checked ? "bg-[#2D6A4F] border-[#2D6A4F]" : "border-border"}`}>
        {checked && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
      </div>
      <div>
        <p className={`text-sm font-medium ${checked ? "text-[#2D6A4F]" : "text-foreground"}`}>{label}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="sr-only" />
    </label>
  );
}

function SectionCard({ letter, title, hint, accentColor, children }: { letter: string; title: string; hint: string; accentColor: string; children: React.ReactNode; }) {
  const bg = accentColor === "green" ? "#2D6A4F08" : "#C45C2608";
  return (
    <div className="bg-white dark:bg-card rounded-2xl border border-border overflow-hidden">
      <div className="px-8 py-5 border-b border-border flex items-center gap-4" style={{ background: `linear-gradient(to right, ${bg}, transparent)` }}>
        <span className="text-3xl font-bold font-mono" style={{ color: accentColor === "green" ? "#2D6A4F20" : "#C45C2620" }}>{letter}</span>
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>
        </div>
      </div>
      <div className="divide-y divide-border">{children}</div>
    </div>
  );
}

function FieldBlock({ label, hint, optional, children }: { label: string; hint?: string; optional?: boolean; children: React.ReactNode; }) {
  return (
    <div className="px-8 py-6 space-y-3">
      <div>
        <p className="text-sm font-medium text-foreground">
          {label}
          {optional && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(optional)</span>}
        </p>
        {hint && <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

export function FindPartnerModalDashboard({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const [step, setStep] = useState<"intent"|"review"|"readiness"|"matching"|"results"|"no_org"|"rate_limited"|"new_request_prompt">("intent");
  const [freeText, setFreeText] = useState("");
  const [partnershipTitle, setPartnershipTitle] = useState("");
  const [prefilling, setPrefilling] = useState(false);
  const [prefillError, setPrefillError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [listPublicly, setListPublicly] = useState(true);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [sentInvites, setSentInvites] = useState<Set<string>>(new Set());
  const [sendingInvite, setSendingInvite] = useState<string | null>(null);
  const [orgProfile, setOrgProfile] = useState<any>(null);
  const [form, setForm] = useState<PrefillData>(EMPTY_FORM);

  useEffect(() => {
    if (!user || !isOpen) return;
    setStep("intent"); setFreeText(""); setPartnershipTitle(""); setPrefillError("");
    setMatches([]); setSentInvites(new Set()); setForm(EMPTY_FORM);
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
      if (!data) { setStep("no_org"); return; }
      setOrgProfile(data);
      if (data.partnership_formed) { setStep("new_request_prompt"); return; }
      if (RATE_LIMIT_ENABLED) {
        const cutoff = new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString();
        const { data: recent } = await supabase.from("partnership_connections").select("created_at").eq("sender_user_id", user!.id).gte("created_at", cutoff).limit(1);
        if (recent && recent.length > 0) { setStep("rate_limited"); return; }
      }
    }
    loadOrg();
  }, [user, isOpen]);

  if (!isOpen) return null;

  function setF<K extends keyof PrefillData>(key: K, val: PrefillData[K]) { setForm(p => ({ ...p, [key]: val })); }
  function toggleArr(key: keyof PrefillData, val: string) { setForm(p => { const arr = p[key] as string[]; return { ...p, [key]: arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val] }; }); }
  function toggleSingle(key: keyof PrefillData, val: string) { setForm(p => ({ ...p, [key]: (p[key] as string) === val ? "" : val })); }

  async function runPrefill() {
    if (!freeText.trim() || !orgProfile) return;
    setPrefilling(true); setPrefillError("");
    try {
      const { partnership_sought, partnership_title, needs, offers, ...baseProfile } = orgProfile;
      const { data, error } = await supabase.functions.invoke("prefill-partnership-form", { body: { free_text: freeText, org_profile: baseProfile } });
      if (error || !data?.prefilled) throw new Error(error?.message ?? "Prefill failed");
      const p = data.prefilled;
      setForm(prev => ({ ...prev, country: p.country ?? [], sectors: p.sectors ?? [], sdgs: p.sdgs ?? [], organisation_type: p.organisation_type ?? "", needs: p.needs ?? [], offers: p.offers ?? [], description: p.description ?? "", partnership_sought: p.partnership_sought ?? "", partnership_stage: p.partnership_stage ?? "", partnership_duration: p.partnership_duration ?? "", partnership_geo_specificity: p.partnership_geo_specificity ?? "", partnership_budget: p.partnership_budget ?? "", partnership_decision_timeline: p.partnership_decision_timeline ?? "", partnership_success_definition: p.partnership_success_definition ?? "", partnership_legal_type: p.partnership_legal_type ?? [], partnership_exclusivity: p.partnership_exclusivity ?? "", partnership_language: p.partnership_language ?? [], partnership_team_capacity: p.partnership_team_capacity ?? "", partnership_funding_status: p.partnership_funding_status ?? "" }));
      setStep("review");
    } catch { setPrefillError("Something went wrong. Try again or simplify your description."); }
    finally { setPrefilling(false); }
  }

  async function submitAndMatch() {
    if (!user || !orgProfile) return;
    setSubmitting(true); setStep("matching");
    try {
      const { data: freshOrg } = await supabase.from("organizations").select("id").eq("user_id", user.id).maybeSingle();
      const orgId = freshOrg?.id ?? orgProfile?.id;
      if (!orgId) { setStep("intent"); setSubmitting(false); return; }
      await supabase.from("organizations").update({
        country: form.country, sector: form.sectors, sdgs: form.sdgs, organisation_type: form.organisation_type, needs: form.needs, offers: form.offers, description: form.description, partnership_sought: form.partnership_sought, partnership_title: partnershipTitle, partnership_listed: listPublicly,
        partnership_stage: form.partnership_stage || null, partnership_duration: form.partnership_duration || null, partnership_geo_specificity: form.partnership_geo_specificity || null, partnership_budget: form.partnership_budget || null, partnership_decision_timeline: form.partnership_decision_timeline || null, partnership_success_definition: form.partnership_success_definition || null, partnership_legal_type: form.partnership_legal_type.length > 0 ? form.partnership_legal_type : null, partnership_exclusivity: form.partnership_exclusivity || null, partnership_language: form.partnership_language.length > 0 ? form.partnership_language : null, partnership_team_capacity: form.partnership_team_capacity || null, partnership_funding_status: form.partnership_funding_status || null,
        partnership_dd_financial_model: form.partnership_dd_financial_model, partnership_dd_audited_accounts: form.partnership_dd_audited_accounts, partnership_dd_safeguarding_policy: form.partnership_dd_safeguarding_policy, partnership_dd_data_policy: form.partnership_dd_data_policy, partnership_dd_governance_doc: form.partnership_dd_governance_doc, partnership_financial_transfer: form.partnership_financial_transfer || null, partnership_working_style: form.partnership_working_style || null, partnership_reporting: form.partnership_reporting.length > 0 ? form.partnership_reporting : null, partnership_ip_ownership: form.partnership_ip_ownership || null, partnership_constraints: form.partnership_constraints || null, partnership_prior_attempts: form.partnership_prior_attempts || null, partnership_decision_maker_confirmed: form.partnership_decision_maker_confirmed, partnership_prior_experience: form.partnership_prior_experience, partnership_prior_experience_detail: form.partnership_prior_experience_detail || null, partnership_contact_seniority: form.partnership_contact_seniority || null, partnership_physically_present: form.partnership_physically_present, partnership_theory_of_change: form.partnership_theory_of_change || null,
        ...(listPublicly ? { status: "published" } : {}),
      }).eq("id", orgId).eq("user_id", user.id);
      const { data: matchData } = await supabase.functions.invoke("match-orgs-for-partnership", { body: { submitting_org: { ...orgProfile, ...form, sector: form.sectors }, user_id: user.id } });
      setMatches(matchData?.matches ?? []); setStep("results");
    } catch { setStep("results"); }
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
        await supabase.from("notifications").insert({ user_id: receiverProfile.user_id, type: "partnership_invite", title: "New partnership invitation", body: `${orgProfile.organisation_name} wants to explore a partnership with you.`, link: "/dashboard/initiatives?tab=partnerships", metadata: { sender_org_id: orgProfile.id, sender_org_name: orgProfile.organisation_name, fit_score: match.fit_score, key_synergy: match.key_synergy, conversation_id: convData?.id } });
      }
      setSentInvites(prev => new Set(prev).add(match.org_id));
    } catch (e) { console.error("Send invite error:", e); }
    finally { setSendingInvite(null); }
  }

  const stepIndex = step === "intent" ? 0 : step === "review" ? 1 : step === "readiness" ? 2 : -1;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col" style={{ animation: "slideUp 0.3s cubic-bezier(0.4,0,0.2,1) forwards" }}>
      <style>{`@keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>

      {/* Header */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-border shrink-0 bg-background">
        <div className="flex items-center gap-3">
          {(step === "review" || step === "readiness") && (
            <button type="button" onClick={() => setStep(step === "readiness" ? "review" : "intent")} className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#2D6A4F] flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-semibold text-foreground">Get Matched</span>
          </div>
        </div>
        <button type="button" onClick={onClose} className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-muted border border-transparent hover:border-border">
          Close ✕
        </button>
      </div>

      {stepIndex >= 0 && <StepProgress current={stepIndex} />}

      <div className="flex-1 overflow-y-auto" style={{ background: "var(--background)" }}>

        {/* Utility screens */}
        {step === "new_request_prompt" && (
          <div className="flex flex-col items-center justify-center h-full gap-8 text-center px-8">
            <div className="w-16 h-16 rounded-2xl bg-[#2D6A4F]/10 flex items-center justify-center"><Sparkles className="w-8 h-8 text-[#2D6A4F]" /></div>
            <div className="max-w-md">
              <h2 className="text-2xl font-semibold text-foreground mb-3">Start a new partnership request?</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">You've recently formed a partnership. Starting fresh will replace your current listing. Confirmed partners stay saved in your Portfolio.</p>
            </div>
            <div className="flex gap-3 w-full max-w-xs">
              <Button variant="outline" onClick={onClose} className="flex-1 rounded-full h-11">Cancel</Button>
              <Button onClick={async () => {
                if (!orgProfile) return;
                await supabase.from("organizations").update({ partnership_formed: false, partnership_listed: false, partnership_title: null, partnership_sought: null }).eq("id", orgProfile.id);
                const { data: freshOrg } = await supabase.from("organizations").select("id,organisation_name,description,sector,country,organisation_type,needs,offers,sdgs,website,email,verification_status,partnership_listed,partnership_formed,partnership_title").eq("id", orgProfile.id).single();
                setOrgProfile(freshOrg); setPartnershipTitle(""); setFreeText(""); setStep("intent");
              }} className="flex-1 rounded-full h-11 bg-[#2D6A4F] hover:bg-[#245c43] text-white">Start fresh</Button>
            </div>
          </div>
        )}

        {step === "no_org" && (
          <div className="flex flex-col items-center justify-center h-full gap-5 text-center px-8">
            <h2 className="text-xl font-semibold text-foreground">Get Matched is for organisations</h2>
            <p className="text-muted-foreground max-w-sm text-sm">Create an organisation profile first to access partnership matching.</p>
            <Button onClick={onClose} className="rounded-full h-10 px-6">Close</Button>
          </div>
        )}

        {step === "rate_limited" && (
          <div className="flex flex-col items-center justify-center h-full gap-5 text-center px-8">
            <h2 className="text-xl font-semibold text-foreground">Come back in 7 hours</h2>
            <p className="text-muted-foreground max-w-sm text-sm">You can run Get Matched once every 7 hours to keep listings current and prevent duplicate matches.</p>
            <Button onClick={onClose} className="rounded-full h-10 px-6">Close</Button>
          </div>
        )}

        {/* Step 0: Intent - split layout */}
        {step === "intent" && (
          <div className="min-h-full grid lg:grid-cols-2">
            <div className="bg-[#2D6A4F] px-10 py-14 flex flex-col justify-between">
              <div>
                <p className="text-[#a8d5b8] text-xs font-semibold uppercase tracking-widest mb-6">Step 1 of 3</p>
                <h2 className="text-3xl font-bold text-white leading-tight mb-4">What partnership<br />are you seeking?</h2>
                <p className="text-[#c8e6d4] text-sm leading-relaxed mb-8">Describe your need in plain language. Include what you're working on, where, what kind of support you need, and what you can offer. AI will structure this into a full partnership brief.</p>
                <div className="space-y-4">
                  {["Your sectors and geography","The type of partner you need","What you bring to the table","Timeline and resource expectations"].map((tip, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full border border-[#a8d5b8]/40 flex items-center justify-center shrink-0 mt-0.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#a8d5b8]" />
                      </div>
                      <p className="text-[#c8e6d4] text-sm leading-relaxed">{tip}</p>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-[#a8d5b8] text-xs mt-10">The more detail you give, the better your matches will be.</p>
            </div>

            <div className="bg-white dark:bg-card px-10 py-10 flex flex-col gap-6">
              <div className="space-y-5 flex-1">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">Partnership title</label>
                  <input type="text" placeholder="e.g. Research partner for Nigeria health programme" value={partnershipTitle} onChange={e => setPartnershipTitle(e.target.value)}
                    className="w-full h-12 px-4 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/20 focus:border-[#2D6A4F] transition-colors" />
                </div>
                <div className="space-y-2 flex-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">Describe what you need</label>
                  <textarea rows={10} placeholder="e.g. We're an NGO working on last-mile health delivery in northern Nigeria. We need a UK-based research partner to help design impact evaluations and co-author publications. We can offer field access, community relationships, and local implementation capacity. Timeline is 18 months starting Q3..."
                    value={freeText} onChange={e => setFreeText(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/20 focus:border-[#2D6A4F] transition-colors" />
                </div>
                {prefillError && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{prefillError}</p>}
              </div>
              <button type="button" onClick={runPrefill} disabled={!freeText.trim() || !partnershipTitle.trim() || prefilling}
                className="w-full h-12 rounded-full bg-[#2D6A4F] hover:bg-[#245c43] text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
                {prefilling ? <><Loader2 className="w-4 h-4 animate-spin" /> Structuring your brief...</> : <><Sparkles className="w-4 h-4" /> Structure with AI</>}
              </button>
            </div>
          </div>
        )}

        {/* Step 1: Review */}
        {step === "review" && (
          <div className="max-w-3xl mx-auto px-8 py-10 space-y-6">
            <div className="bg-white dark:bg-card rounded-2xl border border-[#2D6A4F]/20 px-6 py-5 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-[#2D6A4F] shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-[#2D6A4F]">Brief structured from your description</p>
                <p className="text-xs text-muted-foreground mt-0.5">Review every field. Edit anything that needs adjusting before continuing.</p>
              </div>
            </div>

            <SectionCard letter="A" title="Partnership intent" hint="What you're seeking and how you want to work together" accentColor="green">
              <FieldBlock label="What you're looking for">
                <Textarea className="w-full text-sm resize-none rounded-xl min-h-[80px]" value={form.partnership_sought} onChange={e => setF("partnership_sought", e.target.value)} placeholder="Describe the partnership you're seeking..." />
              </FieldBlock>
              <FieldBlock label="Stage of work">
                <div className="grid grid-cols-2 gap-2">
                  {[{value:"concept",label:"Co-design from scratch"},{value:"joining_running",label:"Joining something running"},{value:"pilot",label:"Pilot phase"},{value:"scaling",label:"Scaling existing work"}].map(opt => (
                    <button key={opt.value} type="button" onClick={() => toggleSingle("partnership_stage", opt.value)}
                      className={`text-left px-4 py-3 rounded-xl border text-sm transition-all ${form.partnership_stage === opt.value ? "border-[#2D6A4F] bg-[#eaf5ee] text-[#2D6A4F]" : "border-border text-muted-foreground hover:border-[#2D6A4F]/40 hover:bg-[#2D6A4F]/5"}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </FieldBlock>
              <FieldBlock label="Expected duration">
                <Chips options={[{value:"under_6_months",label:"Under 6 months"},{value:"6_12_months",label:"6–12 months"},{value:"1_2_years",label:"1–2 years"},{value:"2_plus_years",label:"2+ years"},{value:"ongoing",label:"Ongoing"}]} selected={form.partnership_duration ? [form.partnership_duration] : []} onToggle={v => toggleSingle("partnership_duration", v)} />
              </FieldBlock>
              <FieldBlock label="Type of partnership relationship">
                <Chips options={[{value:"formal_mou",label:"Formal MoU"},{value:"subcontracting",label:"Service provider arrangement"},{value:"co_implementation",label:"Joint delivery"},{value:"referral",label:"Referral / network"},{value:"joint_venture",label:"Joint venture"},{value:"informal",label:"Informal collaboration"},{value:"open",label:"Open to discussion"}]} selected={form.partnership_legal_type} onToggle={v => toggleArr("partnership_legal_type", v)} />
              </FieldBlock>
              <FieldBlock label="Partner exclusivity">
                <YesNo value={form.partnership_exclusivity === "multiple_partners" ? true : form.partnership_exclusivity === "one_dedicated_partner" ? false : null} onChange={v => setF("partnership_exclusivity", v ? "multiple_partners" : "one_dedicated_partner")} yesLabel="Open to multiple partners" noLabel="One dedicated partner" />
              </FieldBlock>
            </SectionCard>

            <SectionCard letter="B" title="Where and when" hint="Location, timeline, and physical presence" accentColor="terracotta">
              <FieldBlock label="Specific location for this partnership" optional>
                <input type="text" placeholder="e.g. Kano State, Nigeria" value={form.partnership_geo_specificity} onChange={e => setF("partnership_geo_specificity", e.target.value)} className="w-full h-11 px-4 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/20 focus:border-[#2D6A4F] transition-colors" />
              </FieldBlock>
              <FieldBlock label="Where you operate">
                <Chips options={COUNTRIES.map(c => ({ value: c, label: c }))} selected={form.country} onToggle={v => toggleArr("country", v)} />
              </FieldBlock>
              <FieldBlock label="When do you need a partner by?">
                <Chips options={[{value:"immediately",label:"Immediately"},{value:"within_1_month",label:"Within 1 month"},{value:"1_3_months",label:"1–3 months"},{value:"3_6_months",label:"3–6 months"},{value:"no_fixed_timeline",label:"No fixed timeline"}]} selected={form.partnership_decision_timeline ? [form.partnership_decision_timeline] : []} onToggle={v => toggleSingle("partnership_decision_timeline", v)} />
              </FieldBlock>
              <FieldBlock label="Are you physically present in the target location?">
                <YesNo value={form.partnership_physically_present} onChange={v => setF("partnership_physically_present", v)} yesLabel="Yes — on the ground" noLabel="No — working remotely" />
              </FieldBlock>
            </SectionCard>

            <SectionCard letter="C" title="Resources" hint="Budget, funding status, and team capacity" accentColor="green">
              <FieldBlock label="Budget / resource commitment">
                <Chips options={[{value:"under_10k",label:"Under $10K"},{value:"10k_50k",label:"$10K–$50K"},{value:"50k_200k",label:"$50K–$200K"},{value:"over_200k",label:"Over $200K"},{value:"in_kind_only",label:"In-kind only"},{value:"open",label:"Open to discussion"}]} selected={form.partnership_budget ? [form.partnership_budget] : []} onToggle={v => toggleSingle("partnership_budget", v)} />
              </FieldBlock>
              <FieldBlock label="Funding status of this work">
                <Chips options={[{value:"fully_funded",label:"Fully funded"},{value:"partially_funded",label:"Partially funded"},{value:"seeking_funding",label:"Seeking funding alongside partner"},{value:"partner_brings_funding",label:"Partner expected to bring funding"}]} selected={form.partnership_funding_status ? [form.partnership_funding_status] : []} onToggle={v => toggleSingle("partnership_funding_status", v)} />
              </FieldBlock>
              <FieldBlock label="Team capacity for this partnership">
                <Chips options={[{value:"1_part_time",label:"1 person part-time"},{value:"1_full_time",label:"1 person full-time"},{value:"2_5_people",label:"2–5 people"},{value:"5_plus_people",label:"5+ people"},{value:"tbd",label:"To be determined"}]} selected={form.partnership_team_capacity ? [form.partnership_team_capacity] : []} onToggle={v => toggleSingle("partnership_team_capacity", v)} />
              </FieldBlock>
            </SectionCard>

            <SectionCard letter="D" title="Focus areas" hint="Sectors, needs, offers, and alignment" accentColor="terracotta">
              <div className="px-8 py-6">
                <ExpandableChips label="Sectors" options={SECTORS} selected={form.sectors} onToggle={v => toggleArr("sectors", v)} />
              </div>
              <FieldBlock label="What you need">
                <Chips options={NEEDS_OPTIONS.map(o => ({ value: o, label: o }))} selected={form.needs} onToggle={v => toggleArr("needs", v)} />
              </FieldBlock>
              <FieldBlock label="What you offer">
                <Chips options={OFFERS_OPTIONS.map(o => ({ value: o, label: o }))} selected={form.offers} onToggle={v => toggleArr("offers", v)} />
              </FieldBlock>
              <div className="px-8 py-6">
                <ExpandableChips label="SDG alignment (optional)" options={SDG_LIST.map(n => `SDG ${n}`)} selected={form.sdgs.map(n => `SDG ${n}`)} onToggle={v => { const n = parseInt(v.replace("SDG ","")); setForm(p => ({ ...p, sdgs: p.sdgs.includes(n) ? p.sdgs.filter(s => s !== n) : [...p.sdgs, n] })); }} />
              </div>
              <FieldBlock label="Working language(s)">
                <Chips options={["English","French","Portuguese","Arabic","Swahili","Other"].map(l => ({ value: l, label: l }))} selected={form.partnership_language} onToggle={v => toggleArr("partnership_language", v)} />
              </FieldBlock>
            </SectionCard>

            <SectionCard letter="E" title="Your organisation" hint="Type and success definition" accentColor="green">
              <FieldBlock label="Organisation type">
                <div className="flex flex-wrap gap-2">
                  {ORG_TYPE_OPTIONS.map(t => { const val = t.toLowerCase().replace(/[\s/]+/g, "_"); const on = form.organisation_type === val; return (<button key={t} type="button" onClick={() => setF("organisation_type", on ? "" : val)} className={`px-4 py-2 rounded-full border text-xs font-medium transition-all ${on ? "bg-[#2D6A4F] border-[#2D6A4F] text-white" : "bg-background text-muted-foreground border-border hover:border-[#2D6A4F]/60 hover:text-[#2D6A4F]"}`}>{t}</button>); })}
                </div>
              </FieldBlock>
              <FieldBlock label="What does success look like in 12 months?" hint="One sentence. This is the most important signal for match quality.">
                <Textarea className="w-full text-sm resize-none rounded-xl" placeholder="e.g. A published evaluation framework co-authored with our research partner, adopted by 3 state health ministries." value={form.partnership_success_definition} onChange={e => setF("partnership_success_definition", e.target.value)} />
              </FieldBlock>
            </SectionCard>

            <button type="button" onClick={() => setStep("readiness")} disabled={form.sectors.length === 0 || form.needs.length === 0}
              className="w-full py-4 rounded-full bg-[#2D6A4F] hover:bg-[#245c43] text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
              Continue to Partnership Readiness →
            </button>
            <p className="text-xs text-muted-foreground text-center pb-6">Select at least one sector and one need to continue.</p>
          </div>
        )}

        {/* Step 2: Readiness */}
        {step === "readiness" && (
          <div className="max-w-3xl mx-auto px-8 py-10 space-y-6">
            <div className="bg-white dark:bg-card rounded-2xl border border-border px-6 py-5">
              <h2 className="text-base font-semibold text-foreground mb-1">Partnership readiness</h2>
              <p className="text-sm text-muted-foreground">Help matched partners know what to expect before they reach out. Everything here shows on your listing.</p>
            </div>

            <SectionCard letter="1" title="What you bring" hint="Documents ready, who leads, and your track record" accentColor="green">
              <FieldBlock label="Documents you have ready" optional hint="Tick what you can share with a potential partner during due diligence.">
                <div className="space-y-2">
                  {[{key:"partnership_dd_financial_model",label:"Financial model",sub:"Budget projections or financial statements"},{key:"partnership_dd_audited_accounts",label:"Audited accounts",sub:"Third-party verified financial records"},{key:"partnership_dd_safeguarding_policy",label:"Safeguarding policy",sub:"Child and vulnerable adult protection"},{key:"partnership_dd_data_policy",label:"Data / GDPR policy",sub:"How you handle personal data"},{key:"partnership_dd_governance_doc",label:"Governance document",sub:"Board structure, constitution, or bylaws"}].map(({ key, label, sub }) => (
                    <CheckRow key={key} checked={form[key as keyof PrefillData] as boolean} onChange={v => setForm(p => ({ ...p, [key]: v }))} label={label} sub={sub} />
                  ))}
                </div>
              </FieldBlock>
              <FieldBlock label="Who leads this partnership on your side?">
                <Chips options={[{value:"executive",label:"Executive / Director"},{value:"programme_manager",label:"Programme Manager"},{value:"technical_lead",label:"Technical Lead"},{value:"to_be_assigned",label:"To be assigned"}]} selected={form.partnership_contact_seniority ? [form.partnership_contact_seniority] : []} onToggle={v => toggleSingle("partnership_contact_seniority", v)} />
              </FieldBlock>
              <FieldBlock label="Have you successfully completed a partnership before?">
                <YesNo value={form.partnership_prior_experience} onChange={v => setF("partnership_prior_experience", v)} />
                {form.partnership_prior_experience === true && (
                  <div className="mt-3">
                    <Textarea className="w-full text-sm resize-none rounded-xl" placeholder="Briefly describe one completed partnership — who with, what you did, and what came of it." value={form.partnership_prior_experience_detail} onChange={e => setF("partnership_prior_experience_detail", e.target.value)} />
                  </div>
                )}
              </FieldBlock>
            </SectionCard>

            <SectionCard letter="2" title="Expectations" hint="Financial arrangements and how you like to work" accentColor="terracotta">
              <FieldBlock label="Financial transfer expectation">
                <Chips options={[{value:"we_pay",label:"We provide funding or fees to partners"},{value:"we_get_paid",label:"We expect compensation or a subgrant"},{value:"no_transfer",label:"No financial transfer"},{value:"open",label:"Open to discussion"}]} selected={form.partnership_financial_transfer ? [form.partnership_financial_transfer] : []} onToggle={v => toggleSingle("partnership_financial_transfer", v)} />
              </FieldBlock>
              <FieldBlock label="Working style preference">
                <Chips options={[{value:"prefer_lead",label:"We prefer to lead"},{value:"equal_codesign",label:"Equal co-design"},{value:"prefer_support",label:"We prefer to support"},{value:"flexible",label:"Flexible"}]} selected={form.partnership_working_style ? [form.partnership_working_style] : []} onToggle={v => toggleSingle("partnership_working_style", v)} />
              </FieldBlock>
              <FieldBlock label="Reporting expectations">
                <Chips options={[{value:"monthly",label:"Monthly updates"},{value:"quarterly",label:"Quarterly check-ins"},{value:"milestone_based",label:"Milestone-based only"},{value:"flexible",label:"Flexible"}]} selected={form.partnership_reporting} onToggle={v => toggleArr("partnership_reporting", v)} />
              </FieldBlock>
              {["research","technology_company","startup","social_enterprise"].includes(form.organisation_type) && (
                <FieldBlock label="IP and data ownership">
                  <Chips options={[{value:"open_ip",label:"Open IP / shared ownership"},{value:"our_org_retains",label:"Our org retains ownership"},{value:"negotiable",label:"Negotiable"},{value:"not_applicable",label:"Not applicable"}]} selected={form.partnership_ip_ownership ? [form.partnership_ip_ownership] : []} onToggle={v => toggleSingle("partnership_ip_ownership", v)} />
                </FieldBlock>
              )}
            </SectionCard>

            <SectionCard letter="3" title="Context" hint="Your approach to change and any constraints" accentColor="green">
              <FieldBlock label="Your approach to creating change" optional hint="One sentence. Helps partners understand if your theories of change are compatible.">
                <Textarea className="w-full text-sm resize-none rounded-xl" placeholder="e.g. We build local capacity through community-led delivery and evidence-based advocacy." value={form.partnership_theory_of_change} onChange={e => setF("partnership_theory_of_change", e.target.value)} />
              </FieldBlock>
              <FieldBlock label="Previous attempts at this type of partnership" optional>
                <Textarea className="w-full text-sm resize-none rounded-xl" placeholder="Have you previously sought this type of partner? What happened?" value={form.partnership_prior_attempts} onChange={e => setF("partnership_prior_attempts", e.target.value)} />
              </FieldBlock>
              <FieldBlock label="Existing constraints" optional>
                <Textarea className="w-full text-sm resize-none rounded-xl" placeholder="Any donor, legal, or exclusivity constraints partners should know about?" value={form.partnership_constraints} onChange={e => setF("partnership_constraints", e.target.value)} />
              </FieldBlock>
            </SectionCard>

            <SectionCard letter="4" title="Before you submit" hint="Confirm your authority and listing preference" accentColor="terracotta">
              <div className="px-8 py-6 space-y-3">
                <CheckRow checked={form.partnership_decision_maker_confirmed} onChange={v => setF("partnership_decision_maker_confirmed", v)} label="I am authorised to enter into partnerships on behalf of my organisation" sub="Confirms to matched partners that this request has organisational backing." />
                <CheckRow checked={listPublicly} onChange={setListPublicly} label="List publicly in the Partnerships directory" sub="Other organisations can find and express interest in your listing. Uncheck to run AI matching privately without being listed." />
              </div>
            </SectionCard>

            <button type="button" onClick={submitAndMatch} disabled={submitting}
              className="w-full py-4 rounded-full bg-[#2D6A4F] hover:bg-[#245c43] text-white text-sm font-semibold disabled:opacity-40 transition-colors flex items-center justify-center gap-2">
              {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</> : listPublicly ? "List publicly + find matches" : "Find matches privately"}
            </button>
            <p className="text-xs text-muted-foreground text-center pb-6">{listPublicly ? "Your card will appear in the Partnerships directory immediately." : "Your details won't be listed publicly. The Natives team will follow up with matches."}</p>
          </div>
        )}

        {/* Matching */}
        {step === "matching" && (
          <div className="flex flex-col items-center justify-center h-full gap-8 text-center px-8">
            <div className="w-16 h-16 rounded-2xl bg-[#2D6A4F]/10 flex items-center justify-center"><Loader2 className="w-8 h-8 text-[#2D6A4F] animate-spin" /></div>
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-2">Finding your matches</h2>
              <p className="text-sm text-muted-foreground max-w-sm">Analysing needs, offers, sectors, SDG alignment, readiness, and working style across the ecosystem...</p>
            </div>
          </div>
        )}

        {/* Results */}
        {step === "results" && (
          <div className="max-w-3xl mx-auto px-8 py-10 space-y-6">
            <div className="flex items-center gap-4 bg-white dark:bg-card rounded-2xl border border-[#2D6A4F]/20 px-6 py-5">
              <div className="w-10 h-10 rounded-xl bg-[#eaf5ee] flex items-center justify-center shrink-0"><CheckCircle2 className="w-5 h-5 text-[#2D6A4F]" /></div>
              <div>
                <h2 className="text-base font-semibold text-foreground">{listPublicly ? "You're listed" : "Matches found"}</h2>
                <p className="text-sm text-muted-foreground">{listPublicly ? "Your organisation now appears in the Partnerships directory." : "AI has identified potential matches based on your brief."}</p>
              </div>
            </div>
            {matches.length === 0 ? (
              <div className="bg-white dark:bg-card rounded-2xl border border-border px-6 py-10 text-center space-y-3">
                <p className="text-sm font-semibold text-foreground">No matches found yet</p>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">The Natives team has been notified and will follow up. Check back as more organisations join.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{matches.length} potential match{matches.length !== 1 ? "es" : ""} found</p>
                {matches.map(match => {
                  const invited = sentInvites.has(match.org_id);
                  const sending = sendingInvite === match.org_id;
                  const countries = Array.isArray(match.org.country) ? match.org.country : [match.org.country];
                  return (
                    <div key={match.org_id} className="bg-white dark:bg-card rounded-2xl border border-border overflow-hidden">
                      <div className="px-6 py-5 border-b border-border flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-semibold text-foreground">{match.org.organisation_name}</p>
                            {match.org.verification_status === "verified" && (<span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "#eaf5ee", color: "#2D6A4F" }}><ShieldCheck className="w-3 h-3" />Verified</span>)}
                          </div>
                          <p className="text-xs text-muted-foreground capitalize">{match.org.organisation_type?.replace(/_/g, " ")}{countries.length > 0 && ` · ${countries.join(", ")}`}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-2xl font-bold text-[#2D6A4F]">{match.fit_score}</div>
                          <div className="text-[10px] text-muted-foreground">fit score</div>
                        </div>
                      </div>
                      <div className="px-6 py-5 space-y-3">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: "#fdf5f2" }}>
                          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#C45C26" }}>Synergy</span>
                          <span className="text-xs text-muted-foreground">{match.key_synergy}</span>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">{match.rationale}</p>
                        <div className="flex items-center gap-3 pt-2 border-t border-border">
                          {invited ? (<span className="flex items-center gap-1.5 text-sm text-[#2D6A4F] font-medium"><CheckCircle2 className="w-4 h-4" />Invitation sent</span>) : (
                            <button type="button" onClick={() => sendInvite(match)} disabled={sending}
                              className="h-9 px-5 rounded-full bg-[#2D6A4F] hover:bg-[#245c43] text-white text-xs font-semibold disabled:opacity-40 transition-colors flex items-center gap-1.5">
                              {sending ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Sending...</> : "Reach out"}
                            </button>
                          )}
                          {match.org.website && match.org.website !== "https://" && (<a href={match.org.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto"><ExternalLink className="w-3.5 h-3.5" />Website</a>)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <button type="button" onClick={onClose} className="w-full py-3 rounded-full border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors">Done</button>
          </div>
        )}
      </div>
    </div>
  );
}
