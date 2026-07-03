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
  const [problem, setProblem]           = useState(initiative.problem ?? "");
  const [outcome, setOutcome]           = useState(initiative.outcome ?? "");
  const [specificAsk, setSpecificAsk]   = useState(initiative.specific_ask ?? "");
  const [partnerships, setPartnerships] = useState<string[]>(initiative.partnerships ?? []);
  const [publishing, setPublishing]     = useState(false);
  const [error, setError]               = useState<string | null>(null);

  function toggle(value: string) {
    setPartnerships(prev =>
      prev.includes(value) ? prev.filter(x => x !== value) : [...prev, value]
    );
  }

  async function publish() {
    if (!problem.trim() || !outcome.trim() || partnerships.length === 0) {
      setError("Problem, outcome and at least one partnership type are required.");
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
      .select("id,title,problem,outcome,specific_ask,partnerships,sectors,locations,budget,target_population,created_at")
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