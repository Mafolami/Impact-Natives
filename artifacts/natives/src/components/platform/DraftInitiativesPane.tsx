import { useState, useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { supabase } from "@/lib/supabase";
import { Loader2, ChevronDown, ChevronUp, Trash2, Sparkles } from "lucide-react";
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
  const [publishing, setPublishing]       = useState(false);
  const [deleting, setDeleting]           = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const [detailContent, setDetailContent] = useState<string>("");
  const [generatingDesc, setGeneratingDesc] = useState(false);
  const [descError, setDescError]         = useState<string | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Generate or write a full initiative description..." }),
    ],
    onUpdate: ({ editor }) => setDetailContent(editor.getHTML()),
  });

  async function generateDescription() {
    setGeneratingDesc(true);
    setDescError(null);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${supabaseUrl}/functions/v1/generate-initiative-description`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          form: {
            title: initiative.title,
            problem,
            outcome,
            specificAsk,
            partnerships,
            stage,
            budget,
            targetBeneficiaries: targetBeneficiaries || null,
            duration,
            esg: esgAlignment,
            sectors: initiative.sectors ?? [],
            locations: initiative.locations ?? [],
            sdgTags: initiative.sdg_tags ?? [],
            targetPopulation: initiative.target_population ?? null,
            hadPriorExperience: null,
            priorExperienceDetail: null,
            impactEvidence: null,
            targetJobs: null,
            targetFemalePct: null,
            targetTimelineMonths: null,
          },
        }),
      });
      const data = await res.json();
      if (data.description) {
        editor?.commands.setContent(data.description);
        setDetailContent(data.description);
      } else {
        setDescError("Generation failed. Write the description manually below.");
      }
    } catch {
      setDescError("Could not reach the server. Try again.");
    }
    setGeneratingDesc(false);
  }

  async function handleDelete() {
    if (!confirm("Delete this draft? This cannot be undone.")) return;
    setDeleting(true);
    const { error: dbError } = await supabase
      .from("initiative_requests")
      .delete()
      .eq("id", initiative.id);
    if (dbError) {
      setError("Could not delete. Try again.");
      setDeleting(false);
      return;
    }
    onPublished(initiative.id);
  }

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
        published_at: new Date().toISOString(),
        detail_content: detailContent || null,
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
              <span className="text-[10px] text-black dark:text-white">{initiative.locations[0]}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-3">
          <button
            type="button"
            onClick={e => { e.stopPropagation(); handleDelete(); }}
            disabled={deleting}
            className="p-1.5 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            {deleting
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Trash2 className="w-3.5 h-3.5" />
            }
          </button>
          {expanded
            ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
            : <ChevronDown className="w-4 h-4 text-muted-foreground" />
          }
        </div>
      </button>

      {/* Expanded — review and edit */}
      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-border pt-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-black dark:text-white block mb-1">
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
              <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-black dark:text-white block mb-1">
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
              <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-black dark:text-white block mb-1">
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
              <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-black dark:text-white block mb-1">
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
            <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-black dark:text-white block mb-1">
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
            <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-black dark:text-white block mb-1">
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
            <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-black dark:text-white block mb-1">
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
            <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-black dark:text-white block mb-2">
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

          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-black dark:text-white block">
              Full description (optional)
            </label>
            <button
              type="button"
              onClick={generateDescription}
              disabled={generatingDesc}
              className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-[#2D6A4F]/40 text-sm text-[#2D6A4F] hover:bg-[#2D6A4F]/5 transition-colors disabled:opacity-40"
            >
              {generatingDesc
                ? <><Loader2 className="w-4 h-4 animate-spin shrink-0" />Generating description...</>
                : <><Sparkles className="w-4 h-4 shrink-0" />Generate full description</>
              }
            </button>
            {descError && <p className="text-xs text-red-600">{descError}</p>}
            {(detailContent || generatingDesc) && (
              <div>
                <div className="flex gap-1 border border-border rounded-t-lg px-2 py-1.5 bg-muted/40">
                  {[
                    { label: "B",      action: () => editor?.chain().focus().toggleBold().run(),                 active: editor?.isActive("bold"),                  style: "font-bold" },
                    { label: "I",      action: () => editor?.chain().focus().toggleItalic().run(),               active: editor?.isActive("italic"),                style: "italic" },
                    { label: "H2",     action: () => editor?.chain().focus().toggleHeading({ level: 2 }).run(), active: editor?.isActive("heading", { level: 2 }), style: "" },
                    { label: "• List", action: () => editor?.chain().focus().toggleBulletList().run(),          active: editor?.isActive("bulletList"),            style: "" },
                  ].map(btn => (
                    <button key={btn.label} type="button" onMouseDown={e => { e.preventDefault(); btn.action(); }}
                      className={`px-2 py-0.5 rounded text-xs transition-colors ${btn.style} ${btn.active ? "bg-primary text-white" : "hover:bg-muted text-muted-foreground"}`}>
                      {btn.label}
                    </button>
                  ))}
                </div>
                <div
                  className="border border-border border-t-0 rounded-b-lg min-h-[160px] bg-background focus-within:ring-1 focus-within:ring-primary/20 cursor-text"
                  onClick={() => editor?.chain().focus().run()}
                >
                  <EditorContent editor={editor}
                    className="[&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[140px] [&_.ProseMirror]:px-3 [&_.ProseMirror]:py-2 [&_.ProseMirror]:text-sm [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-5 [&_.ProseMirror_li]:mb-1 [&_.ProseMirror_h2]:font-semibold [&_.ProseMirror_h2]:text-base [&_.ProseMirror_h2]:mt-4 [&_.ProseMirror_h2]:mb-2" />
                </div>
              </div>
            )}
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
  orgOwnerId,
  onPublished,
}: {
  orgOwnerId: string;
  onPublished: () => void;
}) {
  const [drafts, setDrafts]   = useState<DraftInitiative[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("initiative_requests")
      .select("id,title,problem,outcome,specific_ask,partnerships,sectors,locations,budget,target_population,stage,duration,target_beneficiaries,esg_alignment,sdg_tags,created_at")
      .eq("user_id", orgOwnerId)
      .eq("source", "ai_generated")
      .eq("status", "draft")
      .order("created_at", { ascending: false });
    setDrafts((data as DraftInitiative[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [orgOwnerId]);

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-5 h-5 text-[#2D6A4F] animate-spin" />
    </div>
  );

  if (drafts.length === 0) return (
    <div className="rounded-2xl border border-dashed border-border p-12 text-center">
      <p className="text-foreground font-medium mb-2">No draft initiatives yet.</p>
      <p className="text-sm text-black dark:text-white max-w-sm mx-auto">
        Generate a strategy or upload one, then push pillars here to review and publish.
      </p>
    </div>
  );

  return (
    <div className="space-y-3">
      <p className="text-xs text-black dark:text-white">
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