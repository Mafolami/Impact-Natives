// ─── LabRequestModalDashboard.tsx ────────────────────────────────────────────
// Dashboard-adapted version of LabRequestModal.
// Changes from public version:
// 1. Inserts user_id on submit
// 2. Step 8 (budget) replaced with two-stage tier → sub-range selector
// 3. Accepts isOpen prop so DashboardLabs controls visibility

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { SECTOR_OPTIONS } from "@/lib/sectors";
import { ORG_TYPE_OPTIONS } from "@/lib/orgTypes";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";

const LAB_PARTICIPANTS = [
  "NGO / Non-Profit", "Social Enterprise", "Startup", "Technology Company",
  "Corporation", "Philanthropic Foundation", "Venture Capital (VC)",
  "Creative Agency / Studio", "Public Sector", "Research & Academic Institution",
];
const LAB_OUTCOMES = [
  "Research", "Pilot project", "Partnership formation",
  "Policy recommendation", "Funding strategy", "Technology solution",
];
const IDEA_STAGES = [
  "Idea only", "Concept developed", "Stakeholders already identified",
  "Existing partnerships failing or fragmented",
  "Active program needing coordination support", "Other",
];

// ─── Budget tiers ─────────────────────────────────────────────────────────────
const BUDGET_TIERS = [
  {
    key: "starter",
    label: "Starter",
    range: "$2,500 – $7,500",
    description: "Early-stage scoping and facilitation",
    options: ["$2,500", "$3,000 – $4,500", "$5,000 – $7,500", "$7,500+"],
  },
  {
    key: "standard",
    label: "Standard",
    range: "$10,000 – $35,000",
    description: "Structured lab with defined outputs",
    options: ["$10,000", "$15,000 – $20,000", "$25,000 – $35,000", "$35,000+"],
  },
  {
    key: "strategic",
    label: "Strategic",
    range: "$50,000 – $150,000+",
    description: "Full-scale coordination and delivery",
    options: ["$50,000", "$75,000 – $100,000", "$100,000 – $150,000", "$150,000+"],
  },
] as const;

type BudgetTierKey = (typeof BUDGET_TIERS)[number]["key"];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getStepClass(stepIndex: number, current: number) {
  if (stepIndex === current) return "tf-active";
  if (stepIndex < current) return "tf-above";
  return "tf-below";
}

function CheckboxGroup({
  options, selected, onToggle,
}: {
  options: string[]; selected: string[]; onToggle: (val: string) => void;
}) {
  return (
    <div className="flex flex-wrap justify-center gap-2 max-w-md">
      {options.map((opt) => {
        const checked = selected.includes(opt);
        return (
          <button key={opt} type="button" onClick={() => onToggle(opt)}
            className={`px-4 py-2 rounded-full border text-sm transition-all ${
              checked
                ? "bg-foreground text-background border-foreground"
                : "bg-background text-foreground border-border hover:border-foreground/50"
            }`}>
            {opt}
          </button>
        );
      })}
    </div>
  );
}

// ─── Two-stage budget step ────────────────────────────────────────────────────
function BudgetStep({
  selectedTier, selectedRange,
  onTierSelect, onRangeSelect,
}: {
  selectedTier: BudgetTierKey | "";
  selectedRange: string;
  onTierSelect: (tier: BudgetTierKey) => void;
  onRangeSelect: (range: string) => void;
}) {
  const activeTier = BUDGET_TIERS.find((t) => t.key === selectedTier);

  return (
    <div className="flex flex-col items-center gap-5 w-full max-w-md">
      {/* Tier cards */}
      <div className="grid grid-cols-3 gap-3 w-full">
        {BUDGET_TIERS.map((tier) => {
          const isActive = selectedTier === tier.key;
          return (
            <button
              key={tier.key}
              type="button"
              onClick={() => {
                onTierSelect(tier.key);
                onRangeSelect(""); // reset sub-selection when tier changes
              }}
              className={`flex flex-col items-center text-center px-3 py-4 rounded-xl border transition-all ${
                isActive
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-background text-foreground hover:border-foreground/40"
              }`}
            >
              <span className="text-sm font-semibold">{tier.label}</span>
              <span className={`text-xs mt-1 leading-tight ${isActive ? "text-background/70" : "text-muted-foreground"}`}>
                {tier.range}
              </span>
            </button>
          );
        })}
      </div>

      {/* Sub-range options — appear once a tier is selected */}
      {activeTier && (
        <div className="w-full space-y-2">
          <p className="text-xs text-muted-foreground text-center">
            {activeTier.description} — select a specific range:
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {activeTier.options.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => onRangeSelect(opt)}
                className={`px-4 py-2 rounded-full border text-sm transition-all ${
                  selectedRange === opt
                    ? "bg-foreground text-background border-foreground"
                    : "bg-background text-foreground border-border hover:border-foreground/50"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────
export function LabRequestModalDashboard({
  isOpen, onClose, onSuccess, initialTier,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialTier?: "starter" | "standard" | "strategic";
}) {
    const { user, profile, orgOwnerId } = useAuth();
  const isIndividual = profile?.user_type === "individual_creative";
  const [emailError, setEmailError] = useState("");
  const [form, setForm] = useState({
    organisation_name: profile?.org_name ?? "",
    organisation_type: profile?.org_type ?? "",
    contact_name: profile?.full_name ?? "",
    email: profile?.email ?? "",
    problem: "",
    why_it_matters: "",
    geography: "",
    sector: "",
    budget_range: "",
    budget_tier: initialTier ?? "",
  });

  useEffect(() => {
    if (initialTier) {
      setForm(f => ({ ...f, budget_tier: initialTier }));
    }
  }, [initialTier]);

  const [participants, setParticipants]   = useState<string[]>([]);
  const [outcomes, setOutcomes]           = useState<string[]>([]);
  const [stages, setStages]               = useState<string[]>([]);
const [step, setStep]                   = useState(1);
  const [loading, setLoading]             = useState(false);
  const [submitted, setSubmitted]         = useState(false);

const totalSteps = 8;
const displayTotal = totalSteps;
  const displayStep = step;

  if (!isOpen) return null;
  if (profile === null) return null;

  function update(field: string, value: string) {
    setForm((p) => ({ ...p, [field]: value }));
  }

  function nextStep() { if (step < totalSteps) setStep((p) => p + 1); }
  function prevStep() { if (step > 0) setStep((p) => p - 1); }

  function toggleArr(arr: string[], setArr: (v: string[]) => void, val: string) {
    setArr(arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from("lab_requests").insert({
      ...form,
      desired_participants: participants,
      expected_outcomes:    outcomes,
      idea_stages:          stages,
      status:               "proposal_review",
      user_id:              orgOwnerId ?? user?.id ?? null,
    });
    setLoading(false);
    if (error) alert(error.message);
        else {
      setSubmitted(true);
    }
  }

  const steps = [
    // Step 2 — Problem
    {
      key: 1,
      content: (
        <>
          <h2 className="text-3xl font-semibold text-center">What problem are you trying to solve?</h2>
          <Textarea className="max-w-md w-full min-h-[160px]"
            placeholder="Describe the challenge in detail..."
            value={form.problem}
            onChange={(e) => update("problem", e.target.value)}
            autoFocus={step === 1} />
          <Button type="button" onClick={nextStep} disabled={!form.problem.trim()}>Next →</Button>
        </>
      ),
    },

    // Step 3 — Context & geography
    {
      key: 2,
      content: (
        <>
          <h2 className="text-3xl font-semibold text-center">Context & geography</h2>
          <div className="flex flex-col gap-3 w-full max-w-md">
            <Textarea className="min-h-[100px]"
              placeholder="Who is affected? What happens if this is not solved in the next 6–12 months?"
              value={form.why_it_matters}
              onChange={(e) => update("why_it_matters", e.target.value)}
              autoFocus={step === 2} />
            <Input placeholder="Geography (e.g. Northern Nigeria)"
              value={form.geography}
              onChange={(e) => update("geography", e.target.value)} />
          </div>
          <Button type="button" onClick={nextStep} disabled={!form.geography.trim()}>Next →</Button>
        </>
      ),
    },

    // Step 4 — Sector
    {
      key: 3,
      content: (
        <>
          <h2 className="text-3xl font-semibold text-center">Which sector?</h2>
          <div className="flex flex-wrap justify-center gap-2 max-w-2xl">
            {SECTOR_OPTIONS.map((s) => (
              <button key={s} type="button"
                onClick={() => update("sector", s.toLowerCase())}
                className={`px-4 py-2 rounded-full border text-sm transition-all ${
                  form.sector === s.toLowerCase()
                    ? "bg-foreground text-background border-foreground"
                    : "bg-background text-foreground border-border hover:border-foreground/50"
                }`}>
                {s}
              </button>
            ))}
          </div>
          <Button type="button" onClick={nextStep} disabled={!form.sector}>Next →</Button>
        </>
      ),
    },

    // Step 5 — Participants
    {
      key: 4,
      content: (
        <>
          <h2 className="text-3xl font-semibold text-center">Who should be in the room?</h2>
          <p className="text-sm text-muted-foreground">Select all that apply</p>
          <CheckboxGroup options={LAB_PARTICIPANTS} selected={participants}
            onToggle={(v) => toggleArr(participants, setParticipants, v)} />
          <Button type="button" onClick={nextStep} disabled={participants.length === 0}>Next →</Button>
        </>
      ),
    },

    // Step 6 — Outcomes
    {
      key: 5,
      content: (
        <>
          <h2 className="text-3xl font-semibold text-center">What should come out of it?</h2>
          <p className="text-sm text-muted-foreground">Select all that apply</p>
          <CheckboxGroup options={LAB_OUTCOMES} selected={outcomes}
            onToggle={(v) => toggleArr(outcomes, setOutcomes, v)} />
          <Button type="button" onClick={nextStep} disabled={outcomes.length === 0}>Next →</Button>
        </>
      ),
    },

    // Step 7 — Idea stage
    {
      key: 6,
      content: (
        <>
          <h2 className="text-3xl font-semibold text-center">What stage is your idea in?</h2>
          <p className="text-sm text-muted-foreground">Select all that apply</p>
          <CheckboxGroup options={IDEA_STAGES} selected={stages}
            onToggle={(v) => toggleArr(stages, setStages, v)} />
          <Button type="button" onClick={nextStep} disabled={stages.length === 0}>Next →</Button>
        </>
      ),
    },

    // Step 8 — Budget (two-stage)
    {
      key: 7,
      content: (
        <>
          <h2 className="text-3xl font-semibold text-center">
            What level of investment is realistic?
          </h2>
          <BudgetStep
            selectedTier={form.budget_tier as BudgetTierKey | ""}
            selectedRange={form.budget_range}
            onTierSelect={(tier) => update("budget_tier", tier)}
            onRangeSelect={(range) => update("budget_range", range)}
          />
          <Button
            type="submit"
            disabled={loading || !form.budget_tier || !form.budget_range}
          >
            {loading ? "Submitting..." : "Submit lab request"}
          </Button>
        </>
      ),
    },
  ];

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
        .tf-step {
          position: absolute; inset: 0;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          gap: 1.5rem; padding: 3rem 2rem 6rem 2rem;
          transition: transform 0.45s cubic-bezier(0.4,0,0.2,1), opacity 0.45s;
          overflow-y: auto;
        }
        .tf-active { transform: translateY(0);     opacity: 1; }
        .tf-above  { transform: translateY(-100%); opacity: 0; pointer-events: none; }
        .tf-below  { transform: translateY(100%);  opacity: 0; pointer-events: none; }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
  <div className="flex items-center gap-3">
    <span className="text-sm font-medium">Commission an Innovation Lab</span>
    {form.budget_tier && (
      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-foreground text-background capitalize">
        {form.budget_tier} Lab
      </span>
    )}
  </div>
  <button type="button" onClick={onClose}
    className="text-muted-foreground hover:text-foreground transition-colors text-sm">
    ✕ Close
  </button>
</div>

      {/* Progress bar */}
      <div className="h-0.5 bg-muted shrink-0">
        <div className="h-full bg-foreground transition-all duration-300"
          style={{ width: `${(displayStep / displayTotal) * 100}%` }} />
      </div>

      {submitted ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-5 text-center px-6">
          <h2 className="text-3xl font-semibold">Lab request received.</h2>
          <p className="text-muted-foreground max-w-sm">
            The Natives team will review your proposal and reach out within 5 business days.
          </p>
          <Button onClick={() => { onSuccess?.(); onClose(); }}>Close</Button>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="relative flex-1 overflow-hidden"
          onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
        >
          {steps.map(({ key, content }) => (
            <div key={key} className={`tf-step ${getStepClass(key, step)}`}>
              {content}
            </div>
          ))}

          {/* Back / step counter */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4">
            {step > 0 && (
              <button type="button" onClick={prevStep}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                ↑ Back
              </button>
            )}
                        <span className="text-xs text-muted-foreground">
              {step} / {totalSteps}
            </span>
          </div>
        </form>
      )}
    </div>
  );
}
