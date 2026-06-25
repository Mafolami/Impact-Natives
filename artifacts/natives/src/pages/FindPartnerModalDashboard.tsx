// ─── FindPartnerModalDashboard.tsx ───────────────────────────────────────────
// Flow:
//   0: Free-text intent → AI prefill
//   1: Review & edit prefilled fields
//   2: Submit → AI matching → show results with Reach Out option
//
// Rate limit: disabled for test period (re-enable by setting RATE_LIMIT_ENABLED = true)

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles, CheckCircle2, ArrowLeft, ExternalLink, ShieldCheck } from "lucide-react";
import { ORG_TYPE_OPTIONS } from "@/lib/orgTypes";
import { SECTOR_OPTIONS as SECTORS } from "@/lib/sectors";

const RATE_LIMIT_ENABLED = false; // flip to true post-validation

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
  // Step 2 new fields
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
  // Step 3 fields
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

function ChipGroup({
  options,
  selected,
  onToggle,
}: {
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const on = selected.includes(opt);
        return (
          <button
            key={opt} type="button" onClick={() => onToggle(opt)}
            className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
              on
                ? "bg-[#2D6A4F] border-[#2D6A4F] text-white"
                : "bg-background text-muted-foreground border-border hover:border-[#2D6A4F]/50 hover:text-foreground"
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
      {children}
    </p>
  );
}

export function FindPartnerModalDashboard({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { user } = useAuth();

  // Step: 'intent' | 'review' | 'matching' | 'results' | 'no_org' | 'rate_limited'
  const [step, setStep] = useState<"intent" | "review" | "readiness" | "matching" | "results" | "no_org" | "rate_limited" | "new_request_prompt">("intent");  const [freeText, setFreeText] = useState("");
  const [partnershipTitle, setPartnershipTitle] = useState("");
  const [prefilling, setPrefilling] = useState(false);
  const [prefillError, setPrefillError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [listPublicly, setListPublicly] = useState(true);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [sentInvites, setSentInvites] = useState<Set<string>>(new Set());
  const [sendingInvite, setSendingInvite] = useState<string | null>(null);

  const [orgProfile, setOrgProfile] = useState<any>(null);
  const [hasOrg, setHasOrg] = useState<boolean | null>(null);

  const [form, setForm] = useState<PrefillData>({
    country: [],
    sectors: [],
    sdgs: [],
    organisation_type: "",
    needs: [],
    offers: [],
    description: "",
    partnership_sought: "",
    partnership_stage: "",
    partnership_duration: "",
    partnership_geo_specificity: "",
    partnership_budget: "",
    partnership_decision_timeline: "",
    partnership_success_definition: "",
    partnership_legal_type: [],
    partnership_exclusivity: "",
    partnership_language: [],
    partnership_team_capacity: "",
    partnership_funding_status: "",
    partnership_dd_financial_model: false,
    partnership_dd_audited_accounts: false,
    partnership_dd_safeguarding_policy: false,
    partnership_dd_data_policy: false,
    partnership_dd_governance_doc: false,
    partnership_financial_transfer: "",
    partnership_working_style: "",
    partnership_reporting: [],
    partnership_ip_ownership: "",
    partnership_constraints: "",
    partnership_prior_attempts: "",
    partnership_decision_maker_confirmed: false,
    partnership_prior_experience: null,
    partnership_prior_experience_detail: "",
    partnership_contact_seniority: "",
    partnership_physically_present: null,
    partnership_funding_status_readiness: "",
    partnership_theory_of_change: "",
  });

  // Load org profile on open
  useEffect(() => {
    if (!user || !isOpen) return;
    setStep("intent");
    setFreeText("");
    setPartnershipTitle("");
    setPrefillError("");
    setMatches([]);
    setSentInvites(new Set());

    async function loadOrg() {
      setOrgProfile(null);
      const [orgRes, profileRes] = await Promise.all([
        supabase
          .from("organizations")
          .select("id, organisation_name, description, sector, country, organisation_type, needs, offers, sdgs, website, email, verification_status, partnership_listed, partnership_formed, partnership_title")
          .eq("user_id", user!.id)
          .maybeSingle(),
        supabase
          .from("profiles")
          .select("org_name")
          .eq("id", user!.id)
          .maybeSingle(),
      ]);

      const data = orgRes.data;
      // Always sync org name from profile to prevent mismatch
      if (data && profileRes.data?.org_name && data.organisation_name !== profileRes.data.org_name) {
        await supabase
          .from("organizations")
          .update({ organisation_name: profileRes.data.org_name })
          .eq("id", data.id);
        data.organisation_name = profileRes.data.org_name;
      }

      if (!data) {
        setHasOrg(false);
        setStep("no_org");
        return;
      }

      setHasOrg(true);
      setOrgProfile(data);

      // If already formed, show prompt before proceeding
      if (data.partnership_formed) {
        setStep("new_request_prompt");
        return;
      }

      // Check rate limit if enabled
      if (RATE_LIMIT_ENABLED) {
        const cutoff = new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString();
        const { data: recent } = await supabase
          .from("partnership_connections")
          .select("created_at")
          .eq("sender_user_id", user!.id)
          .gte("created_at", cutoff)
          .limit(1);
        if (recent && recent.length > 0) {
          setStep("rate_limited");
          return;
        }
      }
    }

    loadOrg();
  }, [user, isOpen]);

  if (!isOpen) return null;
  // orgProfile is reset in loadOrg on each open

  function toggle(field: keyof Pick<PrefillData, "country" | "sectors" | "needs" | "offers">, val: string) {
    setForm(p => {
      const arr = p[field] as string[];
      return { ...p, [field]: arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val] };
    });
  }

  function toggleSdg(n: number) {
    setForm(p => ({
      ...p,
      sdgs: p.sdgs.includes(n) ? p.sdgs.filter(s => s !== n) : [...p.sdgs, n],
    }));
  }

  // ── Step 0: AI prefill ──────────────────────────────────────────────────────
  async function runPrefill() {
    if (!freeText.trim() || !orgProfile) return;
    setPrefilling(true);
    setPrefillError("");

    try {
      // Strip partnership-specific fields so AI uses free_text, not old values
      const { partnership_sought, partnership_title, needs, offers, ...baseProfile } = orgProfile;
      const { data, error } = await supabase.functions.invoke("prefill-partnership-form", {
        body: { free_text: freeText, org_profile: baseProfile },
      });

      if (error || !data?.prefilled) throw new Error(error?.message ?? "Prefill failed");

      setForm(prev => ({
        ...prev,
        country:                      data.prefilled.country ?? [],
        sectors:                      data.prefilled.sectors ?? [],
        sdgs:                         data.prefilled.sdgs ?? [],
        organisation_type:            data.prefilled.organisation_type ?? "",
        needs:                        data.prefilled.needs ?? [],
        offers:                       data.prefilled.offers ?? [],
        description:                  data.prefilled.description ?? "",
        partnership_sought:           data.prefilled.partnership_sought ?? "",
        partnership_stage:            data.prefilled.partnership_stage ?? "",
        partnership_duration:         data.prefilled.partnership_duration ?? "",
        partnership_geo_specificity:  data.prefilled.partnership_geo_specificity ?? "",
        partnership_budget:           data.prefilled.partnership_budget ?? "",
        partnership_decision_timeline: data.prefilled.partnership_decision_timeline ?? "",
        partnership_success_definition: data.prefilled.partnership_success_definition ?? "",
        partnership_legal_type:       data.prefilled.partnership_legal_type ?? [],
        partnership_exclusivity:      data.prefilled.partnership_exclusivity ?? "",
        partnership_language:         data.prefilled.partnership_language ?? [],
        partnership_team_capacity:    data.prefilled.partnership_team_capacity ?? "",
        partnership_funding_status:   data.prefilled.partnership_funding_status ?? "",
      }));
      setStep("review");
    } catch (e: any) {
      setPrefillError("Something went wrong. Try again or simplify your description.");
    } finally {
      setPrefilling(false);
    }
  }

  // ── Step 1: Submit + match ──────────────────────────────────────────────────
  async function submitAndMatch() {
    if (!user || !orgProfile) return;
    setSubmitting(true);
    setStep("matching");

    try {
      // 1. Update org with partnership data
      const updatePayload: any = {
        country: form.country,
        sector: form.sectors,
        sdgs: form.sdgs,
        organisation_type: form.organisation_type,
        needs: form.needs,
        offers: form.offers,
        description: form.description,
        partnership_sought: form.partnership_sought,
        partnership_title: partnershipTitle,
        partnership_listed: listPublicly,
        // Step 2 new fields
        partnership_stage:              form.partnership_stage || null,
        partnership_duration:           form.partnership_duration || null,
        partnership_geo_specificity:    form.partnership_geo_specificity || null,
        partnership_budget:             form.partnership_budget || null,
        partnership_decision_timeline:  form.partnership_decision_timeline || null,
        partnership_success_definition: form.partnership_success_definition || null,
        partnership_legal_type:         form.partnership_legal_type.length > 0 ? form.partnership_legal_type : null,
        partnership_exclusivity:        form.partnership_exclusivity || null,
        partnership_language:           form.partnership_language.length > 0 ? form.partnership_language : null,
        partnership_team_capacity:      form.partnership_team_capacity || null,
        partnership_funding_status:     form.partnership_funding_status || null,
        // Step 3 fields
        partnership_dd_financial_model:     form.partnership_dd_financial_model,
        partnership_dd_audited_accounts:    form.partnership_dd_audited_accounts,
        partnership_dd_safeguarding_policy: form.partnership_dd_safeguarding_policy,
        partnership_dd_data_policy:         form.partnership_dd_data_policy,
        partnership_dd_governance_doc:      form.partnership_dd_governance_doc,
        partnership_financial_transfer:     form.partnership_financial_transfer || null,
        partnership_working_style:          form.partnership_working_style || null,
        partnership_reporting:              form.partnership_reporting.length > 0 ? form.partnership_reporting : null,
        partnership_ip_ownership:           form.partnership_ip_ownership || null,
        partnership_constraints:            form.partnership_constraints || null,
        partnership_prior_attempts:         form.partnership_prior_attempts || null,
        partnership_decision_maker_confirmed: form.partnership_decision_maker_confirmed,
        partnership_prior_experience:       form.partnership_prior_experience,
        partnership_prior_experience_detail: form.partnership_prior_experience_detail || null,
        partnership_contact_seniority:      form.partnership_contact_seniority || null,
        partnership_physically_present:     form.partnership_physically_present,
        partnership_theory_of_change:       form.partnership_theory_of_change || null,        ...(listPublicly ? { status: 'published' } : {}),
      };

      // Re-fetch org id at submit time in case orgProfile was stale
      console.log("submitAndMatch user.id:", user?.id, "user.email:", user?.email);
      const { data: freshOrg } = await supabase
        .from("organizations")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      console.log("freshOrg:", freshOrg);

      const orgId = freshOrg?.id ?? orgProfile?.id;

      if (!orgId) {
        console.error("No org id found at submit time");
        setStep("intent");
        setSubmitting(false);
        return;
      }

      const { error: updateError } = await supabase
        .from("organizations")
        .update(updatePayload)
        .eq("id", orgId)
        .eq("user_id", user.id);

      if (updateError) console.error("Org update error:", updateError);

      // 2. Run AI matching (regardless of listing choice)
      const { data: matchData } = await supabase.functions.invoke("match-orgs-for-partnership", {
        body: {
          submitting_org: { ...orgProfile, ...form, sector: form.sectors },
          user_id: user.id,
        },
      });

      setMatches(matchData?.matches ?? []);
      setStep("results");
    } catch (e) {
      console.error("Submit/match error:", e);
      setStep("results");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Reach out: send partnership invite ──────────────────────────────────────
  async function sendInvite(match: MatchResult) {
    if (!user || !orgProfile) return;
    setSendingInvite(match.org_id);

    try {
      // Insert partnership connection
      const { error } = await supabase.from("partnership_connections").insert({
        sender_org_id: orgProfile.id,
        receiver_org_id: match.org.id,
        sender_user_id: user.id,
        source: "ai_match",
        ai_rationale: match.rationale,
        fit_score: match.fit_score,
        status: "pending",
      });

      if (error && !error.message.includes("unique")) throw error;

      // Create a partnership conversation
      const { data: convData } = await supabase.from("conversations").insert({
        conversation_type: "partnership",
        status: "open",
      }).select("id").single();

      // Fetch receiver user_id before conversation setup
      const { data: receiverProfile } = await supabase
        .from("organizations")
        .select("user_id")
        .eq("id", match.org.id)
        .single();

      if (convData?.id) {
        // Add both parties to conversation
        await supabase.from("conversation_participants").insert([
          { conversation_id: convData.id, user_id: user.id },
          ...(receiverProfile?.user_id ? [{ conversation_id: convData.id, user_id: receiverProfile.user_id }] : []),
        ]);

        // Send opening message
        await supabase.from("messages").insert({
          conversation_id: convData.id,
          sender_id: user.id,
          body: `Hi ${match.org.organisation_name}, I'm ${orgProfile.organisation_name} and I came across your listing on Impact Natives. ${match.rationale}\n\nWould you be open to a conversation?`,
        });
      }

      if (receiverProfile?.user_id) {
        await supabase.from("notifications").insert({
          user_id: receiverProfile.user_id,
          type: "partnership_invite",
          title: "New partnership invitation",
          body: `${orgProfile.organisation_name} wants to explore a partnership with you.`,
          link: "/dashboard/initiatives?tab=partnerships",          
          metadata: {
            sender_org_id: orgProfile.id,
            sender_org_name: orgProfile.organisation_name,
            fit_score: match.fit_score,
            key_synergy: match.key_synergy,
            conversation_id: convData?.id,
          },
        });
      }

      setSentInvites(prev => new Set(prev).add(match.org_id));
    } catch (e) {
      console.error("Send invite error:", e);
    } finally {
      setSendingInvite(null);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 bg-background flex flex-col"
      style={{ animation: "slideUp 0.35s cubic-bezier(0.4,0,0.2,1) forwards" }}
    >
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          {(step === "review" || step === "readiness") && (
            <button type="button" onClick={() => setStep(step === "readiness" ? "review" : "intent")}
              className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <span className="text-sm font-medium">Get Matched</span>
        </div>
        <button type="button" onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors text-sm">
          ✕ Close
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">

        {/* New request prompt */}
        {step === "new_request_prompt" && (
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center px-6">
            <div className="w-10 h-10 rounded-full bg-[#2D6A4F]/10 flex items-center justify-center mx-auto">
              <Sparkles className="w-5 h-5 text-[#2D6A4F]" />
            </div>
            <div>
              <h2 className="text-xl font-semibold mb-2">Start a new partnership request?</h2>
              <p className="text-sm text-muted-foreground max-w-sm">
                You've recently formed a partnership. Starting a new request will replace your current listing. Your confirmed partners will be saved in your Portfolio.
              </p>
            </div>
            <div className="flex gap-3 w-full max-w-xs">
              <Button variant="outline" onClick={onClose} className="flex-1 rounded-full">
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  if (!orgProfile) return;
                  await supabase.from("organizations").update({
                    partnership_formed: false,
                    partnership_listed: false,
                    partnership_title: null,
                    partnership_sought: null,
                  }).eq("id", orgProfile.id);
                  // Re-fetch fresh org profile so AI doesn't use stale data
                  const { data: freshOrg } = await supabase
                    .from("organizations")
                    .select("id, organisation_name, description, sector, country, organisation_type, needs, offers, sdgs, website, email, verification_status, partnership_listed, partnership_formed, partnership_title")
                    .eq("id", orgProfile.id)
                    .single();
                  setOrgProfile(freshOrg);
                  setPartnershipTitle("");
                  setFreeText("");
                  setStep("intent");
                }}
                className="flex-1 rounded-full bg-[#2D6A4F] hover:bg-[#245c43] text-white"
              >
                Start fresh
              </Button>
            </div>
          </div>
        )}

        {/* No org */}
        {step === "no_org" && (
          <div className="flex flex-col items-center justify-center h-full gap-5 text-center px-6">
            <h2 className="text-2xl font-semibold">Get Matched is for organisations</h2>
            <p className="text-muted-foreground max-w-sm text-sm">
              Create an organisation profile first to access partnership matching.
            </p>
            <Button onClick={onClose}>Close</Button>
          </div>
        )}

        {/* Rate limited */}
        {step === "rate_limited" && (
          <div className="flex flex-col items-center justify-center h-full gap-5 text-center px-6">
            <h2 className="text-2xl font-semibold">Come back in 7 hours</h2>
            <p className="text-muted-foreground max-w-sm text-sm">
              You can run Get Matched once every 7 hours. This keeps your listing current and prevents duplicate matches.
            </p>
            <Button onClick={onClose}>Close</Button>
          </div>
        )}

        {/* Step 0: Intent */}
        {step === "intent" && (
          <div className="flex flex-col items-center justify-center min-h-full gap-8 px-6 py-12 max-w-lg mx-auto">
            <div className="text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-[#2D6A4F]/10 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-5 h-5 text-[#2D6A4F]" />
              </div>
              <h2 className="text-2xl font-semibold text-foreground">What are you looking for?</h2>
              <p className="text-sm text-muted-foreground">
                Give your request a title, then describe what you need. The AI will structure everything.
              </p>
            </div>

            <div className="w-full space-y-3">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                  Partnership request title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Research partner for Nigeria health programme"
                  value={partnershipTitle}
                  onChange={e => setPartnershipTitle(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                  Describe your needs
                </label>
                <Textarea
                  className="w-full min-h-[140px] text-sm resize-none"
                  placeholder="e.g. We're an NGO working on last-mile health delivery in northern Nigeria. We're looking for a UK-based research partner who can help us design impact evaluations and co-author publications. We can offer field access, community relationships, and local implementation capacity."
                  value={freeText}
                  onChange={e => setFreeText(e.target.value)}
                />
              </div>
            </div>

            {prefillError && (
              <p className="text-sm text-red-500">{prefillError}</p>
            )}

            <Button
              onClick={runPrefill}
              disabled={!freeText.trim() || !partnershipTitle.trim() || prefilling}
              className="w-full bg-[#2D6A4F] hover:bg-[#245c43] text-white rounded-full h-11"
            >
              {prefilling ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Analysing...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" /> Prefill with AI
                </span>
              )}
            </Button>
          </div>
        )}

        {/* Step 1: Review */}
        {step === "review" && (
          <div className="max-w-lg mx-auto px-6 py-8 space-y-6">
            <div className="text-center space-y-1">
              <h2 className="text-xl font-semibold">Review your details</h2>
              <p className="text-sm text-muted-foreground">
                AI has prefilled these from your description. Edit anything that needs adjusting.
              </p>
            </div>

            {/* Partnership sought */}
            <div>
              <SectionLabel>What you're looking for</SectionLabel>
              <Textarea
                className="w-full min-h-[80px] text-sm resize-none"
                value={form.partnership_sought}
                onChange={e => setForm(p => ({ ...p, partnership_sought: e.target.value }))}
                placeholder="Describe the partnership you're seeking..."
              />
            </div>

            

            {/* Sectors */}
            <div>
              <SectionLabel>Sectors</SectionLabel>
              <ChipGroup options={SECTORS} selected={form.sectors} onToggle={v => toggle("sectors", v)} />
            </div>

            {/* Countries */}
            <div>
              <SectionLabel>Where you operate</SectionLabel>
              <ChipGroup options={COUNTRIES} selected={form.country} onToggle={v => toggle("country", v)} />
            </div>

            {/* SDGs */}
            <div>
              <SectionLabel>SDG alignment</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {SDG_LIST.map(n => {
                  const on = form.sdgs.includes(n);
                  return (
                    <button key={n} type="button" onClick={() => toggleSdg(n)}
                      className={`px-2.5 py-1 rounded-full border text-xs font-medium transition-all ${
                        on
                          ? "bg-[#2D6A4F] border-[#2D6A4F] text-white"
                          : "border-border text-muted-foreground hover:border-[#2D6A4F]/50"
                      }`}>
                      SDG {n}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Needs */}
            <div>
              <SectionLabel>What you need</SectionLabel>
              <ChipGroup options={NEEDS_OPTIONS} selected={form.needs} onToggle={v => toggle("needs", v)} />
            </div>

            {/* Offers */}
            <div>
              <SectionLabel>What you offer</SectionLabel>
              <ChipGroup options={OFFERS_OPTIONS} selected={form.offers} onToggle={v => toggle("offers", v)} />
            </div>

            {/* Org type */}
            <div>
              <SectionLabel>Organisation type</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {ORG_TYPE_OPTIONS.map(t => {
                  const val = t.toLowerCase().replace(/[\s/]+/g, "_");
                  const on = form.organisation_type === val;
                  return (
                    <button key={t} type="button"
                      onClick={() => setForm(p => ({ ...p, organisation_type: on ? "" : val }))}
                      className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                        on
                          ? "bg-[#2D6A4F] border-[#2D6A4F] text-white"
                          : "border-border text-muted-foreground hover:border-[#2D6A4F]/50"
                      }`}>
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Stage of work */}
            <div>
              <SectionLabel>Stage of work</SectionLabel>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: "concept",         label: "Co-design from scratch" },
                  { value: "joining_running",  label: "Joining something running" },
                  { value: "pilot",            label: "Pilot phase" },
                  { value: "scaling",          label: "Scaling existing work" },
                ].map(opt => (
                  <button key={opt.value} type="button"
                    onClick={() => setForm(p => ({ ...p, partnership_stage: p.partnership_stage === opt.value ? "" : opt.value }))}
                    className={`text-left px-3 py-2.5 rounded-xl border text-xs transition-colors ${
                      form.partnership_stage === opt.value
                        ? "border-[#2D6A4F] bg-[#eaf5ee] text-[#2D6A4F]"
                        : "border-border text-muted-foreground hover:border-foreground/20"
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Duration */}
            <div>
              <SectionLabel>Partnership duration</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: "under_6_months", label: "Under 6 months" },
                  { value: "6_12_months",    label: "6–12 months" },
                  { value: "1_2_years",      label: "1–2 years" },
                  { value: "2_plus_years",   label: "2+ years" },
                  { value: "ongoing",        label: "Ongoing" },
                ].map(opt => (
                  <button key={opt.value} type="button"
                    onClick={() => setForm(p => ({ ...p, partnership_duration: p.partnership_duration === opt.value ? "" : opt.value }))}
                    className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                      form.partnership_duration === opt.value
                        ? "bg-[#2D6A4F] border-[#2D6A4F] text-white"
                        : "border-border text-muted-foreground hover:border-[#2D6A4F]/50"
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Geographic specificity */}
            <div>
              <SectionLabel>Specific location for this partnership</SectionLabel>
              <input type="text"
                placeholder="e.g. Kano State, Nigeria"
                value={form.partnership_geo_specificity}
                onChange={e => setForm(p => ({ ...p, partnership_geo_specificity: e.target.value }))}
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
              />
            </div>

            {/* Budget */}
            <div>
              <SectionLabel>Budget / resource commitment</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: "under_10k",   label: "Under $10K" },
                  { value: "10k_50k",     label: "$10K–$50K" },
                  { value: "50k_200k",    label: "$50K–$200K" },
                  { value: "over_200k",   label: "Over $200K" },
                  { value: "in_kind_only", label: "In-kind only" },
                  { value: "open",        label: "Open to discussion" },
                ].map(opt => (
                  <button key={opt.value} type="button"
                    onClick={() => setForm(p => ({ ...p, partnership_budget: p.partnership_budget === opt.value ? "" : opt.value }))}
                    className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                      form.partnership_budget === opt.value
                        ? "bg-[#2D6A4F] border-[#2D6A4F] text-white"
                        : "border-border text-muted-foreground hover:border-[#2D6A4F]/50"
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Decision timeline */}
            <div>
              <SectionLabel>When do you need a partner by?</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: "immediately",      label: "Immediately" },
                  { value: "within_1_month",   label: "Within 1 month" },
                  { value: "1_3_months",       label: "1–3 months" },
                  { value: "3_6_months",       label: "3–6 months" },
                  { value: "no_fixed_timeline", label: "No fixed timeline" },
                ].map(opt => (
                  <button key={opt.value} type="button"
                    onClick={() => setForm(p => ({ ...p, partnership_decision_timeline: p.partnership_decision_timeline === opt.value ? "" : opt.value }))}
                    className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                      form.partnership_decision_timeline === opt.value
                        ? "bg-[#2D6A4F] border-[#2D6A4F] text-white"
                        : "border-border text-muted-foreground hover:border-[#2D6A4F]/50"
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Partnership type / legal relationship */}
            <div>
              <SectionLabel>Type of partnership relationship</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: "formal_mou",       label: "Formal MoU" },
                  { value: "subcontracting",   label: "Service provider arrangement" },
                  { value: "co_implementation", label: "Joint delivery" },
                  { value: "referral",         label: "Referral / network" },
                  { value: "joint_venture",    label: "Joint venture" },
                  { value: "informal",         label: "Informal collaboration" },
                  { value: "open",             label: "Open to discussion" },
                ].map(opt => {
                  const on = form.partnership_legal_type.includes(opt.value);
                  return (
                    <button key={opt.value} type="button"
                      onClick={() => setForm(p => ({
                        ...p,
                        partnership_legal_type: on
                          ? p.partnership_legal_type.filter(v => v !== opt.value)
                          : [...p.partnership_legal_type, opt.value],
                      }))}
                      className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                        on
                          ? "bg-[#2D6A4F] border-[#2D6A4F] text-white"
                          : "border-border text-muted-foreground hover:border-[#2D6A4F]/50"
                      }`}>
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Exclusivity */}
            <div>
              <SectionLabel>Partner exclusivity</SectionLabel>
              <div className="flex gap-2">
                {[
                  { value: "multiple_partners",      label: "Open to multiple partners" },
                  { value: "one_dedicated_partner",  label: "Seeking one dedicated partner" },
                ].map(opt => (
                  <button key={opt.value} type="button"
                    onClick={() => setForm(p => ({ ...p, partnership_exclusivity: p.partnership_exclusivity === opt.value ? "" : opt.value }))}
                    className={`flex-1 py-2.5 rounded-xl border text-xs font-medium transition-colors text-center ${
                      form.partnership_exclusivity === opt.value
                        ? "border-[#2D6A4F] bg-[#eaf5ee] text-[#2D6A4F]"
                        : "border-border text-muted-foreground hover:border-foreground/20"
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Team capacity */}
            <div>
              <SectionLabel>Team capacity available for this partnership</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: "1_part_time",  label: "1 person part-time" },
                  { value: "1_full_time",  label: "1 person full-time" },
                  { value: "2_5_people",   label: "2–5 people" },
                  { value: "5_plus_people", label: "5+ people" },
                  { value: "tbd",          label: "To be determined" },
                ].map(opt => (
                  <button key={opt.value} type="button"
                    onClick={() => setForm(p => ({ ...p, partnership_team_capacity: p.partnership_team_capacity === opt.value ? "" : opt.value }))}
                    className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                      form.partnership_team_capacity === opt.value
                        ? "bg-[#2D6A4F] border-[#2D6A4F] text-white"
                        : "border-border text-muted-foreground hover:border-[#2D6A4F]/50"
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Physical presence */}
            <div>
              <SectionLabel>Are you physically present in the target location?</SectionLabel>
              <div className="flex gap-2">
                {[{ value: true, label: "Yes" }, { value: false, label: "No -- working remotely" }].map(opt => (
                  <button key={String(opt.value)} type="button"
                    onClick={() => setForm(p => ({ ...p, partnership_physically_present: opt.value }))}
                    className={`flex-1 py-2.5 rounded-xl border text-xs font-medium transition-colors ${
                      form.partnership_physically_present === opt.value
                        ? "border-[#2D6A4F] bg-[#eaf5ee] text-[#2D6A4F]"
                        : "border-border text-muted-foreground hover:border-foreground/20"
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Funding status */}
            <div>
              <SectionLabel>Funding status of this work</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: "fully_funded",          label: "Fully funded" },
                  { value: "partially_funded",       label: "Partially funded" },
                  { value: "seeking_funding",        label: "Seeking funding alongside partner" },
                  { value: "partner_brings_funding", label: "Partner expected to bring funding" },
                ].map(opt => (
                  <button key={opt.value} type="button"
                    onClick={() => setForm(p => ({ ...p, partnership_funding_status: p.partnership_funding_status === opt.value ? "" : opt.value }))}
                    className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                      form.partnership_funding_status === opt.value
                        ? "bg-[#2D6A4F] border-[#2D6A4F] text-white"
                        : "border-border text-muted-foreground hover:border-[#2D6A4F]/50"
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Communication language */}
            <div>
              <SectionLabel>Working language(s)</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {["English","French","Portuguese","Arabic","Swahili","Other"].map(lang => {
                  const on = form.partnership_language.includes(lang);
                  return (
                    <button key={lang} type="button"
                      onClick={() => setForm(p => ({
                        ...p,
                        partnership_language: on
                          ? p.partnership_language.filter(v => v !== lang)
                          : [...p.partnership_language, lang],
                      }))}
                      className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                        on
                          ? "bg-[#2D6A4F] border-[#2D6A4F] text-white"
                          : "border-border text-muted-foreground hover:border-[#2D6A4F]/50"
                      }`}>
                      {lang}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Success definition */}
            <div>
              <SectionLabel>What does success look like in 12 months?</SectionLabel>
              <Textarea
                className="w-full text-sm resize-none"
                placeholder="In one sentence, describe what a successful partnership would achieve in 12 months."
                value={form.partnership_success_definition}
                onChange={e => setForm(p => ({ ...p, partnership_success_definition: e.target.value }))}
              />
            </div>

            {/* Public listing toggle */}
            <div className="rounded-xl border border-border bg-card px-4 py-4 space-y-1">              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={listPublicly}
                  onChange={e => setListPublicly(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded accent-[#2D6A4F] shrink-0"
                />
                <div>
                  <p className="text-sm font-medium text-foreground">List publicly in Partnerships directory</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Other organisations can find and express interest in your listing.
                    Uncheck to run AI matching privately without being listed.
                  </p>
                </div>
              </label>
            </div>

            <Button
              onClick={() => setStep("readiness")}
              disabled={form.sectors.length === 0 || form.needs.length === 0}
              className="w-full bg-[#2D6A4F] hover:bg-[#245c43] text-white rounded-full h-11"
            >
              Continue → Partnership readiness
            </Button>
          </div>
        )}

        {/* Step 3: Partnership readiness */}
        {step === "readiness" && (
          <div className="max-w-lg mx-auto px-6 py-8 space-y-6">
            <div className="text-center space-y-1">
              <h2 className="text-xl font-semibold">Partnership readiness</h2>
              <p className="text-sm text-muted-foreground">
                Help matched partners know what to expect. This shows on your listing.
              </p>
            </div>

            {/* DD readiness */}
            <div>
              <SectionLabel>Documents you have ready</SectionLabel>
              <div className="space-y-2">
                {[
                  { key: "partnership_dd_financial_model",     label: "Financial model" },
                  { key: "partnership_dd_audited_accounts",    label: "Audited accounts" },
                  { key: "partnership_dd_safeguarding_policy", label: "Safeguarding policy" },
                  { key: "partnership_dd_data_policy",         label: "Data / GDPR policy" },
                  { key: "partnership_dd_governance_doc",      label: "Governance document" },
                ].map(({ key, label }) => (
                  <button key={key} type="button"
                    onClick={() => setForm(p => ({ ...p, [key]: !p[key as keyof PrefillData] }))}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg border text-sm transition-colors text-left ${
                      form[key as keyof PrefillData]
                        ? "border-[#2D6A4F] bg-[#eaf5ee] text-[#2D6A4F]"
                        : "border-border text-muted-foreground hover:border-foreground/20"
                    }`}>
                    <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                      form[key as keyof PrefillData] ? "bg-[#2D6A4F] border-[#2D6A4F]" : "border-border"
                    }`}>
                      {form[key as keyof PrefillData] && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      )}
                    </span>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Financial transfer */}
            <div>
              <SectionLabel>Financial transfer expectation</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: "we_pay",      label: "We provide funding or fees to partners" },
                  { value: "we_get_paid", label: "We expect compensation or a subgrant" },
                  { value: "no_transfer", label: "No financial transfer" },
                  { value: "open",        label: "Open to discussion" },
                ].map(opt => (
                  <button key={opt.value} type="button"
                    onClick={() => setForm(p => ({ ...p, partnership_financial_transfer: p.partnership_financial_transfer === opt.value ? "" : opt.value }))}
                    className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                      form.partnership_financial_transfer === opt.value
                        ? "bg-[#2D6A4F] border-[#2D6A4F] text-white"
                        : "border-border text-muted-foreground hover:border-[#2D6A4F]/50"
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Working style */}
            <div>
              <SectionLabel>Working style preference</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: "prefer_lead",    label: "We prefer to lead" },
                  { value: "equal_codesign", label: "Equal co-design" },
                  { value: "prefer_support", label: "We prefer to support" },
                  { value: "flexible",       label: "Flexible" },
                ].map(opt => (
                  <button key={opt.value} type="button"
                    onClick={() => setForm(p => ({ ...p, partnership_working_style: p.partnership_working_style === opt.value ? "" : opt.value }))}
                    className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                      form.partnership_working_style === opt.value
                        ? "bg-[#2D6A4F] border-[#2D6A4F] text-white"
                        : "border-border text-muted-foreground hover:border-[#2D6A4F]/50"
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Reporting expectations */}
            <div>
              <SectionLabel>Reporting expectations</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: "monthly",         label: "Monthly updates" },
                  { value: "quarterly",        label: "Quarterly check-ins" },
                  { value: "milestone_based",  label: "Milestone-based only" },
                  { value: "flexible",         label: "Flexible" },
                ].map(opt => {
                  const on = form.partnership_reporting.includes(opt.value);
                  return (
                    <button key={opt.value} type="button"
                      onClick={() => setForm(p => ({
                        ...p,
                        partnership_reporting: on
                          ? p.partnership_reporting.filter(v => v !== opt.value)
                          : [...p.partnership_reporting, opt.value],
                      }))}
                      className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                        on
                          ? "bg-[#2D6A4F] border-[#2D6A4F] text-white"
                          : "border-border text-muted-foreground hover:border-[#2D6A4F]/50"
                      }`}>
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* IP ownership -- conditional on org type */}
            {["research","technology_company","startup","social_enterprise"].includes(form.organisation_type) && (
              <div>
                <SectionLabel>IP and data ownership</SectionLabel>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: "open_ip",          label: "Open IP / shared ownership" },
                    { value: "our_org_retains",   label: "Our org retains ownership" },
                    { value: "negotiable",         label: "Negotiable" },
                    { value: "not_applicable",     label: "Not applicable" },
                  ].map(opt => (
                    <button key={opt.value} type="button"
                      onClick={() => setForm(p => ({ ...p, partnership_ip_ownership: p.partnership_ip_ownership === opt.value ? "" : opt.value }))}
                      className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                        form.partnership_ip_ownership === opt.value
                          ? "bg-[#2D6A4F] border-[#2D6A4F] text-white"
                          : "border-border text-muted-foreground hover:border-[#2D6A4F]/50"
                      }`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Contact seniority */}
            <div>
              <SectionLabel>Who will lead this partnership on your side?</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: "executive",          label: "Executive / Director" },
                  { value: "programme_manager",  label: "Programme Manager" },
                  { value: "technical_lead",     label: "Technical Lead" },
                  { value: "to_be_assigned",     label: "To be assigned" },
                ].map(opt => (
                  <button key={opt.value} type="button"
                    onClick={() => setForm(p => ({ ...p, partnership_contact_seniority: p.partnership_contact_seniority === opt.value ? "" : opt.value }))}
                    className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                      form.partnership_contact_seniority === opt.value
                        ? "bg-[#2D6A4F] border-[#2D6A4F] text-white"
                        : "border-border text-muted-foreground hover:border-[#2D6A4F]/50"
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Prior experience */}
            <div>
              <SectionLabel>Have you successfully completed a partnership before?</SectionLabel>
              <div className="flex gap-2">
                {[{ value: true, label: "Yes" }, { value: false, label: "No" }].map(opt => (
                  <button key={String(opt.value)} type="button"
                    onClick={() => setForm(p => ({ ...p, partnership_prior_experience: opt.value }))}
                    className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                      form.partnership_prior_experience === opt.value
                        ? "border-[#2D6A4F] bg-[#eaf5ee] text-[#2D6A4F]"
                        : "border-border text-muted-foreground hover:border-foreground/20"
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
              {form.partnership_prior_experience === true && (
                <Textarea
                  className="mt-2 w-full text-sm resize-none"
                  placeholder="Briefly describe one completed partnership -- who with, what you did, what came of it."
                  value={form.partnership_prior_experience_detail}
                  onChange={e => setForm(p => ({ ...p, partnership_prior_experience_detail: e.target.value }))}
                />
              )}
            </div>

            {/* What you tried before */}
            <div>
              <SectionLabel>Previous attempts <span className="text-muted-foreground font-normal normal-case">(optional)</span></SectionLabel>
              <Textarea
                className="w-full text-sm resize-none"
                placeholder="Have you previously sought this type of partner? What happened?"
                value={form.partnership_prior_attempts}
                onChange={e => setForm(p => ({ ...p, partnership_prior_attempts: e.target.value }))}
              />
            </div>

            {/* Constraints */}
            <div>
              <SectionLabel>Existing constraints <span className="text-muted-foreground font-normal normal-case">(optional)</span></SectionLabel>
              <Textarea
                className="w-full text-sm resize-none"
                placeholder="Any donor, legal, or exclusivity constraints partners should know about?"
                value={form.partnership_constraints}
                onChange={e => setForm(p => ({ ...p, partnership_constraints: e.target.value }))}
              />
            </div>

            {/* Theory of change */}
            <div>
              <SectionLabel>Your approach to creating change <span className="text-muted-foreground font-normal normal-case">(optional)</span></SectionLabel>
              <Textarea
                className="w-full text-sm resize-none"
                placeholder="In one sentence, describe how your organisation creates change. e.g. We build local capacity through community-led delivery."
                value={form.partnership_theory_of_change ?? ""}
                onChange={e => setForm(p => ({ ...p, partnership_theory_of_change: e.target.value }))}
              />
            </div>

            {/* Decision maker confirmation */}
            <div className="rounded-xl border border-border bg-card px-4 py-4">              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox"
                  checked={form.partnership_decision_maker_confirmed}
                  onChange={e => setForm(p => ({ ...p, partnership_decision_maker_confirmed: e.target.checked }))}
                  className="mt-0.5 w-4 h-4 rounded accent-[#2D6A4F] shrink-0"
                />
                <div>
                  <p className="text-sm font-medium text-foreground">I am authorised to enter into partnerships on behalf of my organisation</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Confirms to matched partners that this request has organisational backing.</p>
                </div>
              </label>
            </div>

            {/* List publicly toggle */}
            <div className="rounded-xl border border-border bg-card px-4 py-4 space-y-1">
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox"
                  checked={listPublicly}
                  onChange={e => setListPublicly(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded accent-[#2D6A4F] shrink-0"
                />
                <div>
                  <p className="text-sm font-medium text-foreground">List publicly in Partnerships directory</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Other organisations can find and express interest in your listing.
                  </p>
                </div>
              </label>
            </div>

            <Button
              onClick={submitAndMatch}
              disabled={submitting}
              className="w-full bg-[#2D6A4F] hover:bg-[#245c43] text-white rounded-full h-11"
            >
              {listPublicly ? "List publicly + find matches" : "Find matches privately"}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              {listPublicly
                ? "Your card will appear in the Partnerships directory immediately."
                : "Your details won't be listed publicly. The Natives team will follow up with matches."}
            </p>
          </div>
        )}

        {/* Matching in progress */}
        {step === "matching" && (
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center px-6">
            <div className="w-12 h-12 rounded-full bg-[#2D6A4F]/10 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-[#2D6A4F] animate-spin" />
            </div>
            <div>
              <h2 className="text-xl font-semibold mb-2">Finding your matches</h2>
              <p className="text-sm text-muted-foreground max-w-sm">
                Analysing needs, offers, sectors, and SDG alignment across the ecosystem...
              </p>
            </div>
          </div>
        )}

        {/* Results */}
        {step === "results" && (
          <div className="max-w-lg mx-auto px-6 py-8 space-y-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-[#2D6A4F] shrink-0" />
              <div>
                <h2 className="text-lg font-semibold">You're listed</h2>
                <p className="text-sm text-muted-foreground">
                  Your organisation now appears in the Partnerships directory.
                </p>
              </div>
            </div>

            {matches.length === 0 ? (
              <div className="rounded-xl border border-border bg-card px-5 py-6 text-center space-y-2">
                <p className="text-sm font-medium text-foreground">No matches found yet</p>
                <p className="text-sm text-muted-foreground">
                  The Natives team has been notified and will follow up with relevant organisations.
                  Check back as more organisations join.
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
                    <div key={match.org_id}
                      className="rounded-xl border border-border bg-card px-5 py-4 space-y-3">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-foreground text-sm">{match.org.organisation_name}</p>
                            {match.org.verification_status === "verified" && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                                style={{ background: "#eaf5ee", color: "#2D6A4F" }}>
                                <ShieldCheck className="w-3 h-3" />
                                Verified
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {match.org.organisation_type?.replace(/_/g, " ")}
                            {countries.length > 0 && ` · ${countries.join(", ")}`}
                          </p>
                        </div>
                        {/* Fit score */}
                        <div className="shrink-0 text-right">
                          <div className="text-lg font-bold text-[#2D6A4F]">{match.fit_score}</div>
                          <div className="text-[10px] text-muted-foreground">fit score</div>
                        </div>
                      </div>

                      {/* Key synergy */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#C45C26]">
                          Synergy
                        </span>
                        <span className="text-xs text-muted-foreground">{match.key_synergy}</span>
                      </div>

                      {/* Rationale */}
                      <p className="text-xs text-muted-foreground leading-relaxed">{match.rationale}</p>

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-1">
                        {invited ? (
                          <span className="flex items-center gap-1.5 text-xs text-[#2D6A4F] font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Invitation sent
                          </span>
                        ) : (
                          <Button
                            onClick={() => sendInvite(match)}
                            disabled={sending}
                            className="h-8 px-4 text-xs bg-[#2D6A4F] hover:bg-[#245c43] text-white rounded-full"
                          >
                            {sending ? (
                              <span className="flex items-center gap-1.5">
                                <Loader2 className="w-3 h-3 animate-spin" /> Sending...
                              </span>
                            ) : "Reach out"}
                          </Button>
                        )}
                        {match.org.website && match.org.website !== "https://" && (
                          <a href={match.org.website} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                            <ExternalLink className="w-3 h-3" />
                            Website
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <Button variant="outline" onClick={onClose} className="w-full rounded-full">
              Done
            </Button>
          </div>
        )}

      </div>
    </div>
  );
}