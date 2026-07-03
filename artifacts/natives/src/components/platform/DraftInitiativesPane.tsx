import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { normalizeArr } from "@/lib/normalizeArr";

const PARTNERSHIP_OPTIONS = [
  { value: "funding",     label: "Funding"      },
  { value: "technical",   label: "Technical"    },
  { value: "operational", label: "Operational"  },
  { value: "leadership",  label: "Leadership"   },
  { value: "strategic",   label: "Strategic"    },
  { value: "lead",        label: "Project Lead" },
];

interface DraftInitiative {
  id: string;
  title: string;
  problem: string;
  outcome: string;
  specific_ask: string | null;
  partnerships: string[];
  sectors: string[];
  locations: string[];
  budget: string | null;
  target_population: string | null;
  stage: string | null;
  duration: string | null;
  target_beneficiaries: number | null;
  esg_alignment: boolean;
  sdg_tags: string[] | null;
  created_at: string;
}

function DraftCard({
  initiative,
  onPublished,
}: {
  initiative: DraftInitiative;
  onPublished: (id: string) => void;
}) {
  const [expanded, setExpanded]         = useState(false);
  const [problem, setProblem]                     = useState(initiative.problem ?? "");
  const [outcome, setOutcome]                     = useState(initiative.outcome ?? "");
  const [specificAsk, setSpecificAsk]             = useState(initiative.specific_ask ?? "");
  const [partnerships, setPartnerships]           = useState<string[]>(initiative.partnerships ?? []);
  const [stage, setStage]                         = useState(initiative.stage ?? "");
  const [budget, setBudget]                       = useState(initiative.budget ?? "");
  const [targetBeneficiaries, setTargetBeneficiaries] = useState<string>(initiative.target_beneficiaries?.toString() ?? "");
  const [duration, setDuration]                   = useState(initiative.duration ?? "");
  const [esgAlignment, setEsgAlignment]           = useState(initiative.esg_alignment ?? false);
  const [publishing, setPublishing]               = useState(false);
  const [error, setError]                         = useState<string | null>(null);

  function toggle(value: string) {
    setPartnerships(prev =>
      prev.includes(value) ? prev.filter(x => x !== value) : [...prev, value]
    );
  }

  async function publish() {
    if (!problem.trim() || !outcome.trim() || !stage || !budget.trim() || partnerships.length === 0) {
      setError("Problem, outcome, stage, budget and at least one partnership type are required.");
      return;
    }
    setPublishing(true);
    setError(null);
    const { error: dbError } = await supabase
      .from("initiative_requests")
      .update({
        status: "published",
        problem,
        outcome,
        specific_ask: specificAsk,
        partnerships,
        stage,
        budget,
        target_beneficiaries: targetBeneficiaries ? parseInt(targetBeneficiaries) : null,
        duration,
        esg_alignment: esgAlignment,
        sdg_tags: initiative.sdg_tags ?? [],
      })
      .eq("id", initiative.id);
    if (dbError) {
      setError("Could not publish. Try again.");
      setPublishing(false);
      return;
    }
    onPublished(initiative.id);
    setPublishing(false);
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header — always visible */}
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{initiative.title}</p>
          <div className="flex flex-wrap gap-2 mt-1">
            {normalizeArr(initiative.sectors).slice(0, 2).map(s => (
              <span key={s} className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                style={{ background: "#f5ede8", color: "#C45C26" }}>{s}</span>
            ))}
            {initiative.locations?.[0] && (
              <span className="text-[10px] text-muted-foreground">{initiative.locations[0]}</span>
            )}
          </div>
        </div>
        {expanded
          ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0 ml-3" />
          : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 ml-3" />
        }
      </button>

      {/* Expanded — review and edit */}
      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-border pt-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground block mb-1">
                Stage
              </label>
              <select
                value={stage}
                onChange={e => setStage(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
              >
                <option value="">Select stage</option>
                <option value="concept">Concept</option>
                <option value="planning">Planning</option>
                <option value="active">Active</option>
                <option value="scaling">Scaling</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground block mb-1">
                Budget
              </label>
              <input
                value={budget}
                onChange={e => setBudget(e.target.value)}
                placeholder="e.g. ₦50M or $35,000–$70,000"
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground block mb-1">
                Target beneficiaries (optional)
              </label>
              <input
                type="number"
                value={targetBeneficiaries}
                onChange={e => setTargetBeneficiaries(e.target.value)}
                placeholder="e.g. 5000"
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground block mb-1">
                Duration (optional)
              </label>
              <select
                value={duration}
                onChange={e => setDuration(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
              >
                <option value="">Select duration</option>
                <option value="3 months">3 months</option>
                <option value="6 months">6 months</option>
                <option value="12 months">12 months</option>
                <option value="18 months">18 months</option>
                <option value="24 months">24 months</option>
                <option value="36 months">36 months</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setEsgAlignment(v => !v)}
              className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors ${
                esgAlignment ? "bg-[#2D6A4F]" : "bg-muted"
              }`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                esgAlignment ? "translate-x-4" : "translate-x-0"
              }`} />
            </button>
            <label className="text-xs text-foreground">Open to corporate ESG/CSR adoption</label>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground block mb-1">
              Problem statement
            </label>
            <textarea
              value={problem}
              onChange={e => setProblem(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground block mb-1">
              Expected outcome
            </label>
            <textarea
              value={outcome}
              onChange={e => setOutcome(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground block mb-1">
              Specific ask
            </label>
            <textarea
              value={specificAsk}
              onChange={e => setSpecificAsk(e.target.value)}
              rows={2}
              placeholder="What would a partner actually do?"
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground block mb-2">
              Partnership types needed
            </label>
            <div className="flex flex-wrap gap-2">
              {PARTNERSHIP_OPTIONS.map(opt => (
                <button key={opt.value} type="button" onClick={() => toggle(opt.value)}
                  className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                    partnerships.includes(opt.value)
                      ? "bg-[#2D6A4F] border-[#2D6A4F] text-white"
                      : "border-border text-muted-foreground hover:border-foreground/30"
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="button"
            onClick={publish}
            disabled={publishing}
            className="w-full h-10 rounded-full text-sm font-semibold text-white transition-colors disabled:opacity-40"
            style={{ backgroundColor: "#2D6A4F" }}
          >
            {publishing ? "Publishing..." : "Publish to marketplace"}
          </button>
        </div>
      )}
    </div>
  );
}

export function DraftInitiativesPane({
  userId,
  onPublished,
}: {
  userId: string;
  onPublished: () => void;
}) {
  const [drafts, setDrafts]   = useState<DraftInitiative[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("initiative_requests")
      .select("id,title,problem,outcome,specific_ask,partnerships,sectors,locations,budget,target_population,stage,duration,target_beneficiaries,esg_alignment,sdg_tags,created_at")
      .eq("user_id", userId)
      .eq("source", "ai_generated")
      .eq("status", "draft")
      .order("created_at", { ascending: false });
    setDrafts((data as DraftInitiative[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [userId]);

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-5 h-5 text-[#2D6A4F] animate-spin" />
    </div>
  );

  if (drafts.length === 0) return (
    <div className="rounded-2xl border border-dashed border-border p-12 text-center">
      <p className="text-foreground font-medium mb-2">No draft initiatives yet.</p>
      <p className="text-sm text-muted-foreground max-w-sm mx-auto">
        Generate a strategy or upload one, then push pillars here to review and publish.
      </p>
    </div>
  );

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {drafts.length} draft{drafts.length !== 1 ? "s" : ""} — review, edit, then publish to the marketplace.
      </p>
      {drafts.map(d => (
        <DraftCard
          key={d.id}
          initiative={d}
          onPublished={() => {
            setDrafts(prev => prev.filter(x => x.id !== d.id));
            onPublished();
          }}
        />
      ))}
    </div>
  );
}