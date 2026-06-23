import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { SECTOR_OPTIONS } from "@/lib/sectors";
import { ORG_TYPE_OPTIONS } from "@/lib/orgTypes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const LAB_PARTICIPANTS = [
  "NGO / Non-Profit", "Social Enterprise", "Startup", "Technology Company",
  "Corporation", "Philanthropic Foundation", "Venture Capital (VC)",
  "Creative Agency / Studio", "Public Sector", "Research & Academic Institution",
];
const LAB_OUTCOMES = ["Research", "Pilot project", "Partnership formation", "Policy recommendation", "Funding strategy", "Technology solution"];
const IDEA_STAGES = ["Idea only", "Concept developed", "Stakeholders already identified", "Existing partnerships failing or fragmented", "Active program needing coordination support", "Other"];
const BUDGET_RANGES = ["< $5k", "$5k – $25k", "$25k – $100k", "Custom"];

function getStepClass(stepIndex: number, current: number) {
  if (stepIndex === current) return "tf-active";
  if (stepIndex < current) return "tf-above";
  return "tf-below";
}

function CheckboxGroup({ options, selected, onToggle }: {
  options: string[]; selected: string[]; onToggle: (val: string) => void;
}) {
  return (
    <div className="flex flex-wrap justify-center gap-2 max-w-md">
      {options.map((opt) => {
        const checked = selected.includes(opt);
        return (
          <button key={opt} type="button" onClick={() => onToggle(opt)}
            className={`px-4 py-2 rounded-full border text-sm transition-all ${
              checked ? "bg-foreground text-background border-foreground"
                      : "bg-background text-foreground border-border hover:border-foreground/50"
            }`}
          >{opt}</button>
        );
      })}
    </div>
  );
}

export function LabRequestModal({ onClose, initialTier }: { 
  onClose: () => void;
  initialTier?: "starter" | "standard" | "strategic";
}){
  const { profile } = useAuth();
  const isIndividual = profile?.user_type === "individual_creative";
  const [emailError, setEmailError] = useState("");
const [form, setForm] = useState({
    organisation_name: "",
    organisation_type: "",
    contact_name: "",
    email: "",
    problem: "",
    why_it_matters: "",
    geography: "",
    sector: "",
    budget_range: initialTier === "starter" ? "$2,500 – $7,500" 
      : initialTier === "standard" ? "$10,000 – $35,000"
      : initialTier === "strategic" ? "$50,000 – $150,000+"
      : "",
  });
  const [participants, setParticipants] = useState<string[]>([]);
  const [outcomes, setOutcomes] = useState<string[]>([]);
  const [stages, setStages] = useState<string[]>([]);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const totalSteps = 8;

  function update(field: string, value: string) {
    setForm((p) => ({ ...p, [field]: value }));
  }
  function nextStep() { if (step < totalSteps - 1) setStep((p) => p + 1); }
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
      expected_outcomes: outcomes,
      idea_stages: stages,
      status: "proposal_review",
    });
    setLoading(false);
    if (error) alert(error.message);
    else setSubmitted(true);
  }

  const steps = [
    // paste your 8 existing steps here exactly as they were
    {
      key: 0,
      content: (
        <>
          <p className="text-sm text-muted-foreground">1 of {totalSteps}</p>
          <h2 className="text-3xl font-semibold text-center">About your organisation</h2>
          <div className="flex flex-col gap-3 w-full max-w-md">
            {!isIndividual && (
              <Input placeholder="Organisation name" value={form.organisation_name}
                onChange={(e) => update("organisation_name", e.target.value)} />
            )}
            <Select onValueChange={(v) => update("organisation_type", v)} value={form.organisation_type}>
              <SelectTrigger><SelectValue placeholder="Organisation type" /></SelectTrigger>
              <SelectContent className="max-h-60 overflow-y-auto">
                  {ORG_TYPE_OPTIONS.map((t) => (
                    <SelectItem key={t} value={t.toLowerCase().replace(/[\s/]+/g, "_")}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input placeholder="Your name" value={form.contact_name}
              onChange={(e) => update("contact_name", e.target.value)} />
            <Input type="email" placeholder="Your email" value={form.email}
              onChange={(e) => { update("email", e.target.value); setEmailError(""); }} />
            {emailError && <p className="text-red-500 text-xs">{emailError}</p>}
          </div>
          <Button type="button" onClick={() => {
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
              setEmailError("Please enter a valid email address.");
              return;
            }
            setEmailError("");
            nextStep();
          }}
            disabled={(!isIndividual && !form.organisation_name.trim()) || (!isIndividual && !form.organisation_type) || !form.contact_name.trim() || !form.email.trim()}>
            Next →
          </Button>
        </>
      ),
    },
    {
      key: 1,
      content: (
        <>
          <p className="text-sm text-muted-foreground">2 of {totalSteps}</p>
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
    {
      key: 2,
      content: (
        <>
          <p className="text-sm text-muted-foreground">3 of {totalSteps}</p>
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
    {
      key: 3,
      content: (
        <>
          <p className="text-sm text-muted-foreground">4 of {totalSteps}</p>
          <h2 className="text-3xl font-semibold text-center">Which sector?</h2>
          <div className="flex flex-wrap justify-center gap-2 max-w-md">
            {SECTOR_OPTIONS.map((s) => (
              <button key={s} type="button"
                onClick={() => update("sector", s.toLowerCase())}
                className={`px-4 py-2 rounded-full border text-sm transition-all ${
                  form.sector === s.toLowerCase()
                    ? "bg-foreground text-background border-foreground"
                    : "bg-background text-foreground border-border hover:border-foreground/50"
                }`}
              >{s}</button>
            ))}
          </div>
          <Button type="button" onClick={nextStep} disabled={!form.sector}>Next →</Button>
        </>
      ),
    },
    {
      key: 4,
      content: (
        <>
          <p className="text-sm text-muted-foreground">5 of {totalSteps}</p>
          <h2 className="text-3xl font-semibold text-center">Who should be in the room?</h2>
          <p className="text-sm text-muted-foreground">Select all that apply</p>
          <CheckboxGroup options={LAB_PARTICIPANTS} selected={participants}
            onToggle={(v) => toggleArr(participants, setParticipants, v)} />
          <Button type="button" onClick={nextStep} disabled={participants.length === 0}>Next →</Button>
        </>
      ),
    },
    {
      key: 5,
      content: (
        <>
          <p className="text-sm text-muted-foreground">6 of {totalSteps}</p>
          <h2 className="text-3xl font-semibold text-center">What should come out of it?</h2>
          <p className="text-sm text-muted-foreground">Select all that apply</p>
          <CheckboxGroup options={LAB_OUTCOMES} selected={outcomes}
            onToggle={(v) => toggleArr(outcomes, setOutcomes, v)} />
          <Button type="button" onClick={nextStep} disabled={outcomes.length === 0}>Next →</Button>
        </>
      ),
    },
    {
      key: 6,
      content: (
        <>
          <p className="text-sm text-muted-foreground">7 of {totalSteps}</p>
          <h2 className="text-3xl font-semibold text-center">What stage is your idea in?</h2>
          <p className="text-sm text-muted-foreground">Select all that apply</p>
          <CheckboxGroup options={IDEA_STAGES} selected={stages}
            onToggle={(v) => toggleArr(stages, setStages, v)} />
          <Button type="button" onClick={nextStep} disabled={outcomes.length === 0}>Next →</Button>
        </>
      ),
    },
    {
      key: 7,
      content: (
        <>
          <p className="text-sm text-muted-foreground">8 of {totalSteps}</p>
          <h2 className="text-3xl font-semibold text-center">What level of investment is realistic for structuring and coordinating this work?</h2>
          <div className="flex flex-wrap justify-center gap-2 max-w-md">
            {BUDGET_RANGES.map((b) => (
              <button key={b} type="button"
                onClick={() => update("budget_range", b)}
                className={`px-4 py-2 rounded-full border text-sm transition-all ${
                  form.budget_range === b
                    ? "bg-foreground text-background border-foreground"
                    : "bg-background text-foreground border-border hover:border-foreground/50"
                }`}
              >{b}</button>
            ))}
          </div>
          <Button type="submit" disabled={loading || !form.budget_range}>
            {loading ? "Submitting..." : "Submit lab request"}
          </Button>
        </>
      ),
    },
    // (the key: 0 through key: 7 objects) — nothing changes inside them
  ];

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col"
      style={{ animation: "slideUp 0.35s cubic-bezier(0.4,0,0.2,1) forwards" }}>
      <style>{`
        @keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .tf-step { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1.5rem; padding: 2rem 2rem 5rem 2rem; transition: transform 0.45s cubic-bezier(0.4,0,0.2,1), opacity 0.45s; overflow-y: auto; }
        .tf-active { transform: translateY(0); opacity: 1; }
        .tf-above  { transform: translateY(-100%); opacity: 0; pointer-events: none; }
        .tf-below  { transform: translateY(100%);  opacity: 0; pointer-events: none; }
      `}</style>
      <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
  <div className="flex items-center gap-3">
    <span className="text-sm font-medium">Commission an Innovation Lab</span>
    {initialTier && (
      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-foreground text-background capitalize">
        {initialTier} Lab
      </span>
    )}
  </div>
        <button type="button" onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors text-sm">✕ Close</button>
      </div>
      <div className="h-0.5 bg-muted shrink-0">
        <div className="h-full bg-foreground transition-all duration-300"
          style={{ width: `${((step + 1) / totalSteps) * 100}%` }} />
      </div>
      {submitted ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-5 text-center px-6">
          <div className="w-12 h-12 rounded-full bg-[#2D6A4F]/10 flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2D6A4F" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 className="text-3xl font-semibold">Lab request received.</h2>
          <p className="text-muted-foreground max-w-sm">
            The Natives team will review your proposal and reach out soon.
          </p>
          {!profile && (
            <div className="mt-2 p-4 rounded-xl border border-border bg-muted/40 max-w-sm w-full">
              <p className="text-sm font-medium mb-1">Track your request</p>
              <p className="text-xs text-muted-foreground mb-3">
                Create an account to follow your lab request status and receive updates directly on the platform.
              </p>
              <div className="flex gap-2 justify-center">
                <a href="/signup">
                  <Button size="sm" className="bg-[#2D6A4F] hover:bg-[#245c43] text-white">
                    Create account
                  </Button>
                </a>
                <a href="/signin">
                  <Button size="sm" variant="outline">Sign in</Button>
                </a>
              </div>
            </div>
          )}
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="relative flex-1 overflow-hidden"
          onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}>
          {steps.map(({ key, content }) => (
            <div key={key} className={`tf-step ${getStepClass(key, step)}`}>{content}</div>
          ))}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4">
            {step > 0 && (
              <button type="button" onClick={prevStep}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors">↑ Back</button>
            )}
            <span className="text-xs text-muted-foreground">{step + 1} / {totalSteps}</span>
          </div>
        </form>
      )}
    </div>
  );
}