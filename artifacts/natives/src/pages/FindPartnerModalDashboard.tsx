// ─── FindPartnerModalDashboard.tsx ───────────────────────────────────────────
// Flow:
//   0: Free-text intent → AI prefill
//   1: Review & edit prefilled fields (grouped into cards)
//   2: Partnership readiness + list publicly toggle
//   → matching → results

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles, CheckCircle2, ArrowLeft, ExternalLink, ShieldCheck, ChevronDown, ChevronUp } from "lucide-react";
import { ORG_TYPE_OPTIONS } from "@/lib/orgTypes";
import { SECTOR_OPTIONS as SECTORS } from "@/lib/sectors";

const RATE_LIMIT_ENABLED = false;

const COUNTRIES = [
  "Nigeria", "Kenya", "Ghana", "South Africa", "Ethiopia",
  "Rwanda", "Senegal", "United Kingdom", "Germany", "France", "Other",
];
const NEEDS_OPTIONS = ["Funding", "Partnership", "Data", "Visibility", "Technical Assistance", "Networks"];
const OFFERS_OPTIONS = ["Field access", "Data", "Networks", "Execution", "Funding", "Research"];
const SDG_LIST = Array.from({ length: 17 }, (_, i) => i + 1);

type PrefillData = {
  country: string[];
  sectors: string[];
  sdgs: number[];
  organisation_type: string;
  needs: string[];
  offers: string[];
  description: string;
  partnership_sought: string;
  partnership_stage: string;
  partnership_duration: string;
  partnership_geo_specificity: string;
  partnership_budget: string;
  partnership_decision_timeline: string;
  partnership_success_definition: string;
  partnership_legal_type: string[];
  partnership_exclusivity: string;
  partnership_language: string[];
  partnership_team_capacity: string;
  partnership_funding_status: string;
  partnership_dd_financial_model: boolean;
  partnership_dd_audited_accounts: boolean;
  partnership_dd_safeguarding_policy: boolean;
  partnership_dd_data_policy: boolean;
  partnership_dd_governance_doc: boolean;
  partnership_financial_transfer: string;
  partnership_working_style: string;
  partnership_reporting: string[];
  partnership_ip_ownership: string;
  partnership_constraints: string;
  partnership_prior_attempts: string;
  partnership_decision_maker_confirmed: boolean;
  partnership_prior_experience: boolean | null;
  partnership_prior_experience_detail: string;
  partnership_contact_seniority: string;
  partnership_physically_present: boolean | null;
  partnership_funding_status_readiness: string;
  partnership_theory_of_change: string;
};

type MatchResult = {
  org_id: string;
  fit_score: number;
  rationale: string;
  key_synergy: string;
  org: {
    id: string;
    organisation_name: string;
    description: string;
    organisation_type: string;
    country: string | string[];
    sector: string | string[];
    needs: string[];
    offers: string[];
    sdgs: number[];
    website?: string;
    email?: string;
    verification_status: string;
  };
};

// ─── Shared primitives ────────────────────────────────────────────────────────

function FieldCard({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function FieldRow({ label, optional, children }: { label: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-foreground">
        {label}
        {optional && <span className="text-muted-foreground font-normal ml-1">(optional)</span>}
      </p>
      {children}
    </div>
  );
}

function ChipSet({ options, selected, onToggle, single }: {
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (v: string) => void;
  single?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => {
        const on = selected.includes(opt.value);
        return (
          <button key={opt.value} type="button" onClick={() => onToggle(opt.value)}
            className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
              on
                ? "bg-[#2D6A4F] border-[#2D6A4F] text-white"
                : "bg-background text-muted-foreground border-border hover:border-[#2D6A4F]/50 hover:text-foreground"
            }`}>
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function BinaryChoice({ value, onChange, yes, no }: {
  value: boolean | null;
  onChange: (v: boolean) => void;
  yes?: string;
  no?: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {[{ v: true, label: yes ?? "Yes" }, { v: false, label: no ?? "No" }].map(opt => (
        <button key={String(opt.v)} type="button" onClick={() => onChange(opt.v)}
          className={`py-2.5 rounded-xl border text-xs font-medium transition-colors text-center ${
            value === opt.v
              ? "border-[#2D6A4F] bg-[#eaf5ee] text-[#2D6A4F]"
              : "border-border text-muted-foreground hover:border-foreground/20"
          }`}>
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function ProgressBar({ step }: { step: number }) {
  const steps = ["Describe", "Details", "Readiness"];
  return (
    <div className="px-6 pt-4 pb-3 border-b border-border shrink-0">
      <div className="flex items-center gap-2">
        {steps.map((label, i) => (
          <div key={i} className="flex items-center gap-2 flex-1">
            <div className="flex items-center gap-1.5">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-colors ${
                i < step ? "bg-[#2D6A4F] text-white" :
                i === step ? "bg-[#C45C26] text-white" :
                "bg-muted text-muted-foreground"
              }`}>
                {i < step ? "✓" : i + 1}
              </div>
              <span className={`text-xs font-medium hidden sm:block ${
                i === step ? "text-foreground" : "text-muted-foreground"
              }`}>{label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-px transition-colors ${i < step ? "bg-[#2D6A4F]" : "bg-border"}`} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Collapsible section for long chip lists ──────────────────────────────────
function CollapsibleChips({ label, options, selected, onToggle }: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
}) {
  const [open, setOpen] = useState(selected.length > 0);
  return (
    <div className="space-y-2">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="flex items-center justify-between w-full text-xs font-medium text-foreground">
        <span>{label} {selected.length > 0 && <span className="text-[#2D6A4F]">({selected.length})</span>}</span>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
      </button>
      {open && (
        <div className="flex flex-wrap gap-2">
          {options.map(opt => {
            const on = selected.includes(opt);
            return (
              <button key={opt} type="button" onClick={() => onToggle(opt)}
                className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                  on ? "bg-[#2D6A4F] border-[#2D6A4F] text-white" : "bg-background text-muted-foreground border-border hover:border-[#2D6A4F]/50"
                }`}>
                {opt}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export function FindPartnerModalDashboard({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { user } = useAuth();

  const [step, setStep] = useState<"intent" | "review" | "readiness" | "matching" | "results" | "no_org" | "rate_limited" | "new_request_prompt">("intent");
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

  const EMPTY_FORM: PrefillData = {
    country: [], sectors: [], sdgs: [], organisation_type: "",
    needs: [], offers: [], description: "", partnership_sought: "",
    partnership_stage: "", partnership_duration: "", partnership_geo_specificity: "",
    partnership_budget: "", partnership_decision_timeline: "", partnership_success_definition: "",
    partnership_legal_type: [], partnership_exclusivity: "", partnership_language: [],
    partnership_team_capacity: "", partnership_funding_status: "",
    partnership_dd_financial_model: false, partnership_dd_audited_accounts: false,
    partnership_dd_safeguarding_policy: false, partnership_dd_data_policy: false,
    partnership_dd_governance_doc: false, partnership_financial_transfer: "",
    partnership_working_style: "", partnership_reporting: [], partnership_ip_ownership: "",
    partnership_constraints: "", partnership_prior_attempts: "",
    partnership_decision_maker_confirmed: false, partnership_prior_experience: null,
    partnership_prior_experience_detail: "", partnership_contact_seniority: "",
    partnership_physically_present: null, partnership_funding_status_readiness: "",
    partnership_theory_of_change: "",
  };

  const [form, setForm] = useState<PrefillData>(EMPTY_FORM);

  useEffect(() => {
    if (!user || !isOpen) return;
    setStep("intent"); setFreeText(""); setPartnershipTitle(""); setPrefillError("");
    setMatches([]); setSentInvites(new Set());

    async function loadOrg() {
      setOrgProfile(null);
      const [orgRes, profileRes] = await Promise.all([
        supabase.from("organizations")
          .select("id, organisation_name, description, sector, country, organisation_type, needs, offers, sdgs, website, email, verification_status, partnership_listed, partnership_formed, partnership_title")
          .eq("user_id", user!.id).maybeSingle(),
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

  function setF<K extends keyof PrefillData>(key: K, val: PrefillData[K]) {
    setForm(p => ({ ...p, [key]: val }));
  }

  function toggleArr(key: keyof PrefillData, val: string) {
    setForm(p => {
      const arr = p[key] as string[];
      return { ...p, [key]: arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val] };
    });
  }

  function toggleSingle(key: keyof PrefillData, val: string) {
    setForm(p => ({ ...p, [key]: (p[key] as string) === val ? "" : val }));
  }

  async function runPrefill() {
    if (!freeText.trim() || !orgProfile) return;
    setPrefilling(true); setPrefillError("");
    try {
      const { partnership_sought, partnership_title, needs, offers, ...baseProfile } = orgProfile;
      const { data, error } = await supabase.functions.invoke("prefill-partnership-form", {
        body: { free_text: freeText, org_profile: baseProfile },
      });
      if (error || !data?.prefilled) throw new Error(error?.message ?? "Prefill failed");
      const p = data.prefilled;
      setForm(prev => ({
        ...prev,
        country: p.country ?? [],
        sectors: p.sectors ?? [],
        sdgs: p.sdgs ?? [],
        organisation_type: p.organisation_type ?? "",
        needs: p.needs ?? [],
        offers: p.offers ?? [],
        description: p.description ?? "",
        partnership_sought: p.partnership_sought ?? "",
        partnership_stage: p.partnership_stage ?? "",
        partnership_duration: p.partnership_duration ?? "",
        partnership_geo_specificity: p.partnership_geo_specificity ?? "",
        partnership_budget: p.partnership_budget ?? "",
        partnership_decision_timeline: p.partnership_decision_timeline ?? "",
        partnership_success_definition: p.partnership_success_definition ?? "",
        partnership_legal_type: p.partnership_legal_type ?? [],
        partnership_exclusivity: p.partnership_exclusivity ?? "",
        partnership_language: p.partnership_language ?? [],
        partnership_team_capacity: p.partnership_team_capacity ?? "",
        partnership_funding_status: p.partnership_funding_status ?? "",
      }));
      setStep("review");
    } catch {
      setPrefillError("Something went wrong. Try again or simplify your description.");
    } finally {
      setPrefilling(false);
    }
  }

  async function submitAndMatch() {
    if (!user || !orgProfile) return;
    setSubmitting(true); setStep("matching");
    try {
      const { data: freshOrg } = await supabase.from("organizations").select("id").eq("user_id", user.id).maybeSingle();
      const orgId = freshOrg?.id ?? orgProfile?.id;
      if (!orgId) { setStep("intent"); setSubmitting(false); return; }

      await supabase.from("organizations").update({
        country: form.country, sector: form.sectors, sdgs: form.sdgs,
        organisation_type: form.organisation_type, needs: form.needs, offers: form.offers,
        description: form.description, partnership_sought: form.partnership_sought,
        partnership_title: partnershipTitle, partnership_listed: listPublicly,
        partnership_stage: form.partnership_stage || null,
        partnership_duration: form.partnership_duration || null,
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
      setStep("results");
    } catch {
      setStep("results");
    } finally {
      setSubmitting(false);
    }
  }

  async function sendInvite(match: MatchResult) {
    if (!user || !orgProfile) return;
    setSendingInvite(match.org_id);
    try {
      const { error } = await supabase.from("partnership_connections").insert({
        sender_org_id: orgProfile.id, receiver_org_id: match.org.id,
        sender_user_id: user.id, source: "ai_match",
        ai_rationale: match.rationale, fit_score: match.fit_score, status: "pending",
      });
      if (error && !error.message.includes("unique")) throw error;

      const { data: receiverProfile } = await supabase.from("organizations").select("user_id").eq("id", match.org.id).single();

      const { data: convData } = await supabase.from("conversations").insert({
        conversation_type: "partnership", status: "open",
      }).select("id").single();

      if (convData?.id) {
        await supabase.from("conversation_participants").insert([
          { conversation_id: convData.id, user_id: user.id },
          ...(receiverProfile?.user_id ? [{ conversation_id: convData.id, user_id: receiverProfile.user_id }] : []),
        ]);
        await supabase.from("messages").insert({
          conversation_id: convData.id, sender_id: user.id,
          body: `Hi ${match.org.organisation_name}, I'm ${orgProfile.organisation_name} and I came across your listing on Impact Natives. ${match.rationale}\n\nWould you be open to a conversation?`,
        });
      }

      if (receiverProfile?.user_id) {
        await supabase.from("notifications").insert({
          user_id: receiverProfile.user_id, type: "partnership_invite",
          title: "New partnership invitation",
          body: `${orgProfile.organisation_name} wants to explore a partnership with you.`,
          link: "/dashboard/initiatives?tab=partnerships",
          metadata: { sender_org_id: orgProfile.id, sender_org_name: orgProfile.organisation_name, fit_score: match.fit_score, key_synergy: match.key_synergy, conversation_id: convData?.id },
        });
      }
      setSentInvites(prev => new Set(prev).add(match.org_id));
    } catch (e) {
      console.error("Send invite error:", e);
    } finally {
      setSendingInvite(null);
    }
  }

  const stepIndex = step === "intent" ? 0 : step === "review" ? 1 : step === "readiness" ? 2 : -1;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col"
      style={{ animation: "slideUp 0.3s cubic-bezier(0.4,0,0.2,1) forwards" }}>
      <style>{`@keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          {(step === "review" || step === "readiness") && (
            <button type="button" onClick={() => setStep(step === "readiness" ? "review" : "intent")}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <span className="text-sm font-semibold text-foreground">Get Matched</span>
        </div>
        <button type="button" onClick={onClose}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-muted">
          Close
        </button>
      </div>

      {/* Progress bar -- only on form steps */}
      {stepIndex >= 0 && <ProgressBar step={stepIndex} />}

      {/* Body */}
      <div className="flex-1 overflow-y-auto">

        {/* ── New request prompt ── */}
        {step === "new_request_prompt" && (
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center px-6 max-w-sm mx-auto">
            <div className="w-12 h-12 rounded-full bg-[#2D6A4F]/10 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-[#2D6A4F]" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-2">Start a new partnership request?</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                You've recently formed a partnership. Starting fresh will replace your current listing. Confirmed partners stay saved in your Portfolio.
              </p>
            </div>
            <div className="flex gap-3 w-full">
              <Button variant="outline" onClick={onClose} className="flex-1 rounded-full">Cancel</Button>
              <Button onClick={async () => {
                if (!orgProfile) return;
                await supabase.from("organizations").update({ partnership_formed: false, partnership_listed: false, partnership_title: null, partnership_sought: null }).eq("id", orgProfile.id);
                const { data: freshOrg } = await supabase.from("organizations").select("id, organisation_name, description, sector, country, organisation_type, needs, offers, sdgs, website, email, verification_status, partnership_listed, partnership_formed, partnership_title").eq("id", orgProfile.id).single();
                setOrgProfile(freshOrg); setPartnershipTitle(""); setFreeText(""); setStep("intent");
              }} className="flex-1 rounded-full bg-[#2D6A4F] hover:bg-[#245c43] text-white">
                Start fresh
              </Button>
            </div>
          </div>
        )}

        {/* ── No org ── */}
        {step === "no_org" && (
          <div className="flex flex-col items-center justify-center h-full gap-5 text-center px-6">
            <h2 className="text-xl font-semibold text-foreground">Get Matched is for organisations</h2>
            <p className="text-muted-foreground max-w-sm text-sm">Create an organisation profile first to access partnership matching.</p>
            <Button onClick={onClose} className="rounded-full">Close</Button>
          </div>
        )}

        {/* ── Rate limited ── */}
        {step === "rate_limited" && (
          <div className="flex flex-col items-center justify-center h-full gap-5 text-center px-6">
            <h2 className="text-xl font-semibold text-foreground">Come back in 7 hours</h2>
            <p className="text-muted-foreground max-w-sm text-sm">You can run Get Matched once every 7 hours to keep listings current and prevent duplicate matches.</p>
            <Button onClick={onClose} className="rounded-full">Close</Button>
          </div>
        )}

        {/* ── Step 0: Intent ── */}
        {step === "intent" && (
          <div className="flex flex-col min-h-full px-6 py-10 max-w-lg mx-auto">
            <div className="text-center mb-8">
              <div className="w-12 h-12 rounded-full bg-[#2D6A4F]/10 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-6 h-6 text-[#2D6A4F]" />
              </div>
              <h2 className="text-2xl font-semibold text-foreground mb-2">What are you looking for?</h2>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                Give your request a title, then describe what you need in plain language. AI will structure everything.
              </p>
            </div>

            <div className="space-y-4 flex-1">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                  Partnership request title
                </label>
                <input type="text"
                  placeholder="e.g. Research partner for Nigeria health programme"
                  value={partnershipTitle}
                  onChange={e => setPartnershipTitle(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/20 focus:border-[#2D6A4F] transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                  Describe your needs
                </label>
                <Textarea
                  className="w-full min-h-[160px] text-sm resize-none rounded-xl"
                  placeholder="e.g. We're an NGO working on last-mile health delivery in northern Nigeria. We need a UK-based research partner to help design impact evaluations and co-author publications. We can offer field access, community relationships, and local implementation capacity..."
                  value={freeText}
                  onChange={e => setFreeText(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">The more detail you give, the better the AI can structure your listing and find matches.</p>
              </div>

              {prefillError && (
                <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/20 rounded-lg px-3 py-2">{prefillError}</p>
              )}
            </div>

            <div className="pt-6">
              <Button onClick={runPrefill}
                disabled={!freeText.trim() || !partnershipTitle.trim() || prefilling}
                className="w-full bg-[#2D6A4F] hover:bg-[#245c43] text-white rounded-full h-12 text-sm font-semibold">
                {prefilling
                  ? <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Analysing your description...</span>
                  : <span className="flex items-center gap-2"><Sparkles className="w-4 h-4" /> Structure with AI</span>
                }
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 1: Review ── */}
        {step === "review" && (
          <div className="max-w-lg mx-auto px-6 py-6 space-y-4">
            <div className="mb-2">
              <h2 className="text-lg font-semibold text-foreground">Review your details</h2>
              <p className="text-sm text-muted-foreground mt-0.5">AI has prefilled these from your description. Edit anything that needs adjusting.</p>
            </div>

            {/* Card 1: About this partnership */}
            <FieldCard title="About this partnership" hint="What you're seeking and how you want to work together">
              <FieldRow label="What you're looking for">
                <Textarea className="w-full text-sm resize-none rounded-xl min-h-[80px]"
                  value={form.partnership_sought}
                  onChange={e => setF("partnership_sought", e.target.value)}
                  placeholder="Describe the partnership you're seeking..." />
              </FieldRow>

              <FieldRow label="Stage of work">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: "concept",        label: "Co-design from scratch" },
                    { value: "joining_running", label: "Joining something running" },
                    { value: "pilot",           label: "Pilot phase" },
                    { value: "scaling",         label: "Scaling existing work" },
                  ].map(opt => (
                    <button key={opt.value} type="button"
                      onClick={() => toggleSingle("partnership_stage", opt.value)}
                      className={`text-left px-3 py-2.5 rounded-xl border text-xs transition-colors ${
                        form.partnership_stage === opt.value
                          ? "border-[#2D6A4F] bg-[#eaf5ee] text-[#2D6A4F]"
                          : "border-border text-muted-foreground hover:border-foreground/20"
                      }`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </FieldRow>

              <FieldRow label="Duration">
                <ChipSet
                  options={[
                    { value: "under_6_months", label: "Under 6 months" },
                    { value: "6_12_months",    label: "6–12 months" },
                    { value: "1_2_years",      label: "1–2 years" },
                    { value: "2_plus_years",   label: "2+ years" },
                    { value: "ongoing",        label: "Ongoing" },
                  ]}
                  selected={form.partnership_duration ? [form.partnership_duration] : []}
                  onToggle={v => toggleSingle("partnership_duration", v)}
                />
              </FieldRow>

              <FieldRow label="Type of partnership relationship">
                <ChipSet
                  options={[
                    { value: "formal_mou",        label: "Formal MoU" },
                    { value: "subcontracting",    label: "Service provider arrangement" },
                    { value: "co_implementation", label: "Joint delivery" },
                    { value: "referral",          label: "Referral / network" },
                    { value: "joint_venture",     label: "Joint venture" },
                    { value: "informal",          label: "Informal collaboration" },
                    { value: "open",              label: "Open to discussion" },
                  ]}
                  selected={form.partnership_legal_type}
                  onToggle={v => toggleArr("partnership_legal_type", v)}
                />
              </FieldRow>

              <FieldRow label="Partner exclusivity">
                <BinaryChoice
                  value={form.partnership_exclusivity === "multiple_partners" ? true : form.partnership_exclusivity === "one_dedicated_partner" ? false : null}
                  onChange={v => setF("partnership_exclusivity", v ? "multiple_partners" : "one_dedicated_partner")}
                  yes="Open to multiple partners"
                  no="One dedicated partner"
                />
              </FieldRow>
            </FieldCard>

            {/* Card 2: Where and when */}
            <FieldCard title="Where and when" hint="Location, timeline, and presence">
              <FieldRow label="Specific location for this partnership" optional>
                <input type="text"
                  placeholder="e.g. Kano State, Nigeria"
                  value={form.partnership_geo_specificity}
                  onChange={e => setF("partnership_geo_specificity", e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/20 focus:border-[#2D6A4F] transition-colors"
                />
              </FieldRow>

              <FieldRow label="Where you operate">
                <ChipSet options={COUNTRIES.map(c => ({ value: c, label: c }))} selected={form.country} onToggle={v => toggleArr("country", v)} />
              </FieldRow>

              <FieldRow label="When do you need a partner by?">
                <ChipSet
                  options={[
                    { value: "immediately",       label: "Immediately" },
                    { value: "within_1_month",    label: "Within 1 month" },
                    { value: "1_3_months",        label: "1–3 months" },
                    { value: "3_6_months",        label: "3–6 months" },
                    { value: "no_fixed_timeline", label: "No fixed timeline" },
                  ]}
                  selected={form.partnership_decision_timeline ? [form.partnership_decision_timeline] : []}
                  onToggle={v => toggleSingle("partnership_decision_timeline", v)}
                />
              </FieldRow>

              <FieldRow label="Are you physically present in the target location?">
                <BinaryChoice
                  value={form.partnership_physically_present}
                  onChange={v => setF("partnership_physically_present", v)}
                  yes="Yes — on the ground"
                  no="No — working remotely"
                />
              </FieldRow>
            </FieldCard>

            {/* Card 3: Resources */}
            <FieldCard title="Resources" hint="Budget, funding status, and team capacity">
              <FieldRow label="Budget / resource commitment">
                <ChipSet
                  options={[
                    { value: "under_10k",          label: "Under $10K" },
                    { value: "10k_50k",            label: "$10K–$50K" },
                    { value: "50k_200k",           label: "$50K–$200K" },
                    { value: "over_200k",          label: "Over $200K" },
                    { value: "in_kind_only",        label: "In-kind only" },
                    { value: "open",               label: "Open to discussion" },
                  ]}
                  selected={form.partnership_budget ? [form.partnership_budget] : []}
                  onToggle={v => toggleSingle("partnership_budget", v)}
                />
              </FieldRow>

              <FieldRow label="Funding status of this work">
                <ChipSet
                  options={[
                    { value: "fully_funded",           label: "Fully funded" },
                    { value: "partially_funded",        label: "Partially funded" },
                    { value: "seeking_funding",         label: "Seeking funding alongside partner" },
                    { value: "partner_brings_funding",  label: "Partner expected to bring funding" },
                  ]}
                  selected={form.partnership_funding_status ? [form.partnership_funding_status] : []}
                  onToggle={v => toggleSingle("partnership_funding_status", v)}
                />
              </FieldRow>

              <FieldRow label="Team capacity for this partnership">
                <ChipSet
                  options={[
                    { value: "1_part_time",   label: "1 person part-time" },
                    { value: "1_full_time",   label: "1 person full-time" },
                    { value: "2_5_people",    label: "2–5 people" },
                    { value: "5_plus_people", label: "5+ people" },
                    { value: "tbd",           label: "To be determined" },
                  ]}
                  selected={form.partnership_team_capacity ? [form.partnership_team_capacity] : []}
                  onToggle={v => toggleSingle("partnership_team_capacity", v)}
                />
              </FieldRow>
            </FieldCard>

            {/* Card 4: Focus areas */}
            <FieldCard title="Focus areas" hint="Sectors, needs, offers, and SDG alignment">
              <FieldRow label="Sectors">
                <CollapsibleChips label="Select sectors" options={SECTORS} selected={form.sectors} onToggle={v => toggleArr("sectors", v)} />
              </FieldRow>

              <FieldRow label="What you need">
                <ChipSet options={NEEDS_OPTIONS.map(o => ({ value: o, label: o }))} selected={form.needs} onToggle={v => toggleArr("needs", v)} />
              </FieldRow>

              <FieldRow label="What you offer">
                <ChipSet options={OFFERS_OPTIONS.map(o => ({ value: o, label: o }))} selected={form.offers} onToggle={v => toggleArr("offers", v)} />
              </FieldRow>

              <FieldRow label="SDG alignment" optional>
                <CollapsibleChips
                  label="Select SDGs"
                  options={SDG_LIST.map(n => `SDG ${n}`)}
                  selected={form.sdgs.map(n => `SDG ${n}`)}
                  onToggle={v => {
                    const n = parseInt(v.replace("SDG ", ""));
                    setForm(p => ({ ...p, sdgs: p.sdgs.includes(n) ? p.sdgs.filter(s => s !== n) : [...p.sdgs, n] }));
                  }}
                />
              </FieldRow>

              <FieldRow label="Working language(s)">
                <ChipSet
                  options={["English","French","Portuguese","Arabic","Swahili","Other"].map(l => ({ value: l, label: l }))}
                  selected={form.partnership_language}
                  onToggle={v => toggleArr("partnership_language", v)}
                />
              </FieldRow>
            </FieldCard>

            {/* Card 5: Your organisation */}
            <FieldCard title="Your organisation" hint="Type and how you describe what you do">
              <FieldRow label="Organisation type">
                <div className="flex flex-wrap gap-2">
                  {ORG_TYPE_OPTIONS.map(t => {
                    const val = t.toLowerCase().replace(/[\s/]+/g, "_");
                    const on = form.organisation_type === val;
                    return (
                      <button key={t} type="button"
                        onClick={() => setF("organisation_type", on ? "" : val)}
                        className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                          on ? "bg-[#2D6A4F] border-[#2D6A4F] text-white" : "bg-background text-muted-foreground border-border hover:border-[#2D6A4F]/50"
                        }`}>
                        {t}
                      </button>
                    );
                  })}
                </div>
              </FieldRow>
            </FieldCard>

            {/* Card 6: Success */}
            <FieldCard title="Success definition" hint="What a good outcome looks like">
              <FieldRow label="What does success look like in 12 months?">
                <Textarea className="w-full text-sm resize-none rounded-xl"
                  placeholder="In one sentence, describe what a successful partnership would achieve in 12 months."
                  value={form.partnership_success_definition}
                  onChange={e => setF("partnership_success_definition", e.target.value)} />
              </FieldRow>
            </FieldCard>

            <Button
              onClick={() => setStep("readiness")}
              disabled={form.sectors.length === 0 || form.needs.length === 0}
              className="w-full bg-[#2D6A4F] hover:bg-[#245c43] text-white rounded-full h-12 text-sm font-semibold">
              Continue to Partnership Readiness →
            </Button>
            <p className="text-xs text-muted-foreground text-center pb-4">Select at least one sector and one need to continue.</p>
          </div>
        )}

        {/* ── Step 2: Readiness ── */}
        {step === "readiness" && (
          <div className="max-w-lg mx-auto px-6 py-6 space-y-4">
            <div className="mb-2">
              <h2 className="text-lg font-semibold text-foreground">Partnership readiness</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Help matched partners know what to expect. This shows on your listing.</p>
            </div>

            {/* Card 1: What you bring */}
            <FieldCard title="What you bring" hint="Documents ready and who leads this">
              <FieldRow label="Documents you have ready" optional>
                <div className="space-y-2">
                  {[
                    { key: "partnership_dd_financial_model",     label: "Financial model" },
                    { key: "partnership_dd_audited_accounts",    label: "Audited accounts" },
                    { key: "partnership_dd_safeguarding_policy", label: "Safeguarding policy" },
                    { key: "partnership_dd_data_policy",         label: "Data / GDPR policy" },
                    { key: "partnership_dd_governance_doc",      label: "Governance document" },
                  ].map(({ key, label }) => {
                    const checked = form[key as keyof PrefillData] as boolean;
                    return (
                      <button key={key} type="button"
                        onClick={() => setForm(p => ({ ...p, [key]: !p[key as keyof PrefillData] }))}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border text-sm transition-colors text-left ${
                          checked ? "border-[#2D6A4F] bg-[#eaf5ee] text-[#2D6A4F]" : "border-border text-muted-foreground hover:border-foreground/20"
                        }`}>
                        <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${checked ? "bg-[#2D6A4F] border-[#2D6A4F]" : "border-border"}`}>
                          {checked && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                        </span>
                        {label}
                      </button>
                    );
                  })}
                </div>
              </FieldRow>

              <FieldRow label="Who leads this partnership on your side?">
                <ChipSet
                  options={[
                    { value: "executive",         label: "Executive / Director" },
                    { value: "programme_manager", label: "Programme Manager" },
                    { value: "technical_lead",    label: "Technical Lead" },
                    { value: "to_be_assigned",    label: "To be assigned" },
                  ]}
                  selected={form.partnership_contact_seniority ? [form.partnership_contact_seniority] : []}
                  onToggle={v => toggleSingle("partnership_contact_seniority", v)}
                />
              </FieldRow>
            </FieldCard>

            {/* Card 2: Expectations */}
            <FieldCard title="Expectations" hint="Financial arrangements and how you like to work">
              <FieldRow label="Financial transfer expectation">
                <ChipSet
                  options={[
                    { value: "we_pay",      label: "We provide funding or fees to partners" },
                    { value: "we_get_paid", label: "We expect compensation or a subgrant" },
                    { value: "no_transfer", label: "No financial transfer" },
                    { value: "open",        label: "Open to discussion" },
                  ]}
                  selected={form.partnership_financial_transfer ? [form.partnership_financial_transfer] : []}
                  onToggle={v => toggleSingle("partnership_financial_transfer", v)}
                />
              </FieldRow>

              <FieldRow label="Working style preference">
                <ChipSet
                  options={[
                    { value: "prefer_lead",    label: "We prefer to lead" },
                    { value: "equal_codesign", label: "Equal co-design" },
                    { value: "prefer_support", label: "We prefer to support" },
                    { value: "flexible",       label: "Flexible" },
                  ]}
                  selected={form.partnership_working_style ? [form.partnership_working_style] : []}
                  onToggle={v => toggleSingle("partnership_working_style", v)}
                />
              </FieldRow>

              <FieldRow label="Reporting expectations">
                <ChipSet
                  options={[
                    { value: "monthly",        label: "Monthly updates" },
                    { value: "quarterly",      label: "Quarterly check-ins" },
                    { value: "milestone_based", label: "Milestone-based only" },
                    { value: "flexible",       label: "Flexible" },
                  ]}
                  selected={form.partnership_reporting}
                  onToggle={v => toggleArr("partnership_reporting", v)}
                />
              </FieldRow>

              {["research","technology_company","startup","social_enterprise"].includes(form.organisation_type) && (
                <FieldRow label="IP and data ownership">
                  <ChipSet
                    options={[
                      { value: "open_ip",         label: "Open IP / shared ownership" },
                      { value: "our_org_retains",  label: "Our org retains ownership" },
                      { value: "negotiable",        label: "Negotiable" },
                      { value: "not_applicable",    label: "Not applicable" },
                    ]}
                    selected={form.partnership_ip_ownership ? [form.partnership_ip_ownership] : []}
                    onToggle={v => toggleSingle("partnership_ip_ownership", v)}
                  />
                </FieldRow>
              )}
            </FieldCard>

            {/* Card 3: Context */}
            <FieldCard title="Context" hint="Your track record and any constraints">
              <FieldRow label="Have you successfully completed a partnership before?">
                <BinaryChoice value={form.partnership_prior_experience} onChange={v => setF("partnership_prior_experience", v)} />
              </FieldRow>

              {form.partnership_prior_experience === true && (
                <FieldRow label="Briefly describe one completed partnership">
                  <Textarea className="w-full text-sm resize-none rounded-xl"
                    placeholder="Who with, what you did, and what came of it."
                    value={form.partnership_prior_experience_detail}
                    onChange={e => setF("partnership_prior_experience_detail", e.target.value)} />
                </FieldRow>
              )}

              <FieldRow label="Your approach to creating change" optional>
                <Textarea className="w-full text-sm resize-none rounded-xl"
                  placeholder="In one sentence, describe how your organisation creates change. e.g. We build local capacity through community-led delivery."
                  value={form.partnership_theory_of_change}
                  onChange={e => setF("partnership_theory_of_change", e.target.value)} />
              </FieldRow>

              <FieldRow label="Previous attempts at this type of partnership" optional>
                <Textarea className="w-full text-sm resize-none rounded-xl"
                  placeholder="Have you previously sought this type of partner? What happened?"
                  value={form.partnership_prior_attempts}
                  onChange={e => setF("partnership_prior_attempts", e.target.value)} />
              </FieldRow>

              <FieldRow label="Existing constraints" optional>
                <Textarea className="w-full text-sm resize-none rounded-xl"
                  placeholder="Any donor, legal, or exclusivity constraints partners should know about?"
                  value={form.partnership_constraints}
                  onChange={e => setF("partnership_constraints", e.target.value)} />
              </FieldRow>
            </FieldCard>

            {/* Card 4: Confirmation + listing */}
            <FieldCard title="Before you submit" hint="Confirm your authority and listing preference">
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox"
                  checked={form.partnership_decision_maker_confirmed}
                  onChange={e => setF("partnership_decision_maker_confirmed", e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded accent-[#2D6A4F] shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">I am authorised to enter into partnerships on behalf of my organisation</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Confirms to matched partners that this request has organisational backing.</p>
                </div>
              </label>

              <div className="h-px bg-border" />

              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox"
                  checked={listPublicly}
                  onChange={e => setListPublicly(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded accent-[#2D6A4F] shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">List publicly in Partnerships directory</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Other organisations can find and express interest in your listing. Uncheck to run AI matching privately without being listed.
                  </p>
                </div>
              </label>
            </FieldCard>

            <Button onClick={submitAndMatch} disabled={submitting}
              className="w-full bg-[#2D6A4F] hover:bg-[#245c43] text-white rounded-full h-12 text-sm font-semibold">
              {listPublicly ? "List publicly + find matches" : "Find matches privately"}
            </Button>
            <p className="text-xs text-muted-foreground text-center pb-4">
              {listPublicly
                ? "Your card will appear in the Partnerships directory immediately."
                : "Your details won't be listed publicly. The Natives team will follow up with matches."}
            </p>
          </div>
        )}

        {/* ── Matching ── */}
        {step === "matching" && (
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center px-6">
            <div className="w-14 h-14 rounded-full bg-[#2D6A4F]/10 flex items-center justify-center">
              <Loader2 className="w-7 h-7 text-[#2D6A4F] animate-spin" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-2">Finding your matches</h2>
              <p className="text-sm text-muted-foreground max-w-sm">
                Analysing needs, offers, sectors, SDG alignment, and readiness signals across the ecosystem...
              </p>
            </div>
          </div>
        )}

        {/* ── Results ── */}
        {step === "results" && (
          <div className="max-w-lg mx-auto px-6 py-8 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#eaf5ee] flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5 text-[#2D6A4F]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  {listPublicly ? "You're listed" : "Matches found"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {listPublicly
                    ? "Your organisation now appears in the Partnerships directory."
                    : "AI has identified potential matches based on your brief."}
                </p>
              </div>
            </div>

            {matches.length === 0 ? (
              <div className="rounded-2xl border border-border bg-card px-5 py-8 text-center space-y-2">
                <p className="text-sm font-medium text-foreground">No matches found yet</p>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                  The Natives team has been notified and will follow up. Check back as more organisations join.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {matches.length} potential match{matches.length !== 1 ? "es" : ""} found
                </p>
                {matches.map(match => {
                  const invited = sentInvites.has(match.org_id);
                  const sending = sendingInvite === match.org_id;
                  const countries = Array.isArray(match.org.country) ? match.org.country : [match.org.country];
                  return (
                    <div key={match.org_id} className="rounded-2xl border border-border bg-card px-5 py-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-foreground text-sm">{match.org.organisation_name}</p>
                            {match.org.verification_status === "verified" && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                                style={{ background: "#eaf5ee", color: "#2D6A4F" }}>
                                <ShieldCheck className="w-3 h-3" />Verified
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                            {match.org.organisation_type?.replace(/_/g, " ")}
                            {countries.length > 0 && ` · ${countries.join(", ")}`}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-lg font-bold text-[#2D6A4F]">{match.fit_score}</div>
                          <div className="text-[10px] text-muted-foreground">fit score</div>
                        </div>
                      </div>

                      <div className="rounded-lg bg-[#2D6A4F]/5 px-3 py-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#C45C26]">Synergy · </span>
                        <span className="text-xs text-muted-foreground">{match.key_synergy}</span>
                      </div>

                      <p className="text-xs text-muted-foreground leading-relaxed">{match.rationale}</p>

                      <div className="flex items-center gap-2 pt-1 border-t border-border">
                        {invited ? (
                          <span className="flex items-center gap-1.5 text-xs text-[#2D6A4F] font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />Invitation sent
                          </span>
                        ) : (
                          <Button onClick={() => sendInvite(match)} disabled={sending}
                            className="h-8 px-4 text-xs bg-[#2D6A4F] hover:bg-[#245c43] text-white rounded-full">
                            {sending ? <span className="flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" />Sending...</span> : "Reach out"}
                          </Button>
                        )}
                        {match.org.website && match.org.website !== "https://" && (
                          <a href={match.org.website} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto">
                            <ExternalLink className="w-3 h-3" />Website
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <Button variant="outline" onClick={onClose} className="w-full rounded-full">Done</Button>
          </div>
        )}
      </div>
    </div>
  );
}
