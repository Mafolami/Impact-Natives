import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Loader2, Sparkles, X } from "lucide-react";
import { createIndicator } from "@/lib/indicators";

const REFINE_CAP = 3;

export default function IndicatorForm({
  mouDocumentId, createdByOrgId, initiativeId, connectionId, onClose, onCreated,
}: {
  mouDocumentId: string;
  createdByOrgId: string;
  initiativeId: string | null;
  connectionId: string | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [definition, setDefinition] = useState("");
  const [baselineValue, setBaselineValue] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [measurementWindow, setMeasurementWindow] = useState("");

  const [creating, setCreating] = useState(false);

  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestFailed, setSuggestFailed] = useState(false);
  const [suggestRequiresUpgrade, setSuggestRequiresUpgrade] = useState(false);
  const [suggestions, setSuggestions] = useState
    <{ name: string; definition: string; target_value: string; measurement_window: string }[]
  >([]);

  const [refineLoading, setRefineLoading] = useState(false);
  const [refineFailed, setRefineFailed] = useState(false);
  const [refineRequiresUpgrade, setRefineRequiresUpgrade] = useState(false);
  const [refineCount, setRefineCount] = useState(0);
  const [refineSuggestion, setRefineSuggestion] = useState<{ name: string; definition: string } | null>(null);

  async function suggestIndicators() {
    setSuggestLoading(true);
    setSuggestFailed(false);
    setSuggestRequiresUpgrade(false);
    try {
      const { data, error } = await supabase.functions.invoke("suggest-partnership-indicators", {
        body: { mou_document_id: mouDocumentId, initiative_id: initiativeId, connection_id: connectionId },
      });
      if (!error && data?.suggestions) {
        setSuggestions(data.suggestions);
      } else if (data?.requires_upgrade) {
        setSuggestRequiresUpgrade(true);
      } else {
        setSuggestFailed(true);
      }
    } catch {
      setSuggestFailed(true);
    }
    setSuggestLoading(false);
  }

  function applySuggestion(s: { name: string; definition: string; target_value: string; measurement_window: string }) {
    setName(s.name);
    setDefinition(s.definition);
    setTargetValue(s.target_value);
    setMeasurementWindow(s.measurement_window);
    setSuggestions([]);
  }

  async function refineIndicator() {
    if (refineCount >= REFINE_CAP) return;
    setRefineLoading(true);
    setRefineFailed(false);
    setRefineRequiresUpgrade(false);
    try {
      const { data, error } = await supabase.functions.invoke("refine-partnership-indicator", {
        body: { name, definition, target_value: targetValue, measurement_window: measurementWindow },
      });
      if (!error && data?.refined) {
        setRefineSuggestion(data.refined);
        setRefineCount((n) => n + 1);
      } else if (data?.requires_upgrade) {
        setRefineRequiresUpgrade(true);
      } else {
        setRefineFailed(true);
      }
    } catch {
      setRefineFailed(true);
    }
    setRefineLoading(false);
  }

  function acceptRefinement() {
    if (!refineSuggestion) return;
    setName(refineSuggestion.name);
    setDefinition(refineSuggestion.definition);
    setRefineSuggestion(null);
  }

  async function handleCreate() {
    if (!name.trim() || !definition.trim() || !targetValue.trim() || !measurementWindow.trim()) return;
    setCreating(true);
    const result = await createIndicator({
      mou_document_id: mouDocumentId,
      name: name.trim(),
      definition: definition.trim(),
      baseline_value: baselineValue.trim() || null,
      target_value: targetValue.trim(),
      measurement_window: measurementWindow.trim(),
      created_by_org_id: createdByOrgId,
    });
    setCreating(false);
    if (!result) return;
    onCreated();
    onClose();
  }

  const canCreate = name.trim() && definition.trim() && targetValue.trim() && measurementWindow.trim();

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-card rounded-t-2xl sm:rounded-2xl border border-border w-full sm:max-w-sm shadow-xl p-6 space-y-4 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="text-base font-bold text-black dark:text-white">New indicator</p>
          <button type="button" onClick={onClose} className="p-1 rounded-full hover:bg-muted transition-colors">
            <X className="w-4 h-4 text-black dark:text-white" />
          </button>
        </div>

        <button type="button" onClick={suggestIndicators} disabled={suggestLoading}
          className="w-full flex items-center justify-center gap-1.5 h-9 rounded-full border border-[#2D6A4F]/30 bg-[#2D6A4F]/5 text-sm font-medium text-[#2D6A4F] hover:bg-[#2D6A4F]/10 disabled:opacity-50 transition-colors">
          {suggestLoading
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Suggesting...</>
            : <><Sparkles className="w-3.5 h-3.5" />Suggest with AI</>}
        </button>
        {suggestRequiresUpgrade && (
          <p className="text-xs text-[#C45C26]">AI suggestions need an upgrade. You can still fill this in manually.</p>
        )}
        {suggestFailed && (
          <p className="text-xs text-[#C45C26]">Couldn't generate suggestions. Try again or fill this in manually.</p>
        )}
        {suggestions.length > 0 && (
          <div className="space-y-1.5">
            {suggestions.map((s, i) => (
              <button type="button" key={i} onClick={() => applySuggestion(s)}
                className="w-full text-left rounded-lg border border-border px-3 py-2 hover:border-[#2D6A4F]/40 transition-colors">
                <p className="text-sm font-medium text-black dark:text-white">{s.name}</p>
                <p className="text-xs text-black dark:text-white mt-0.5">{s.definition}</p>
              </button>
            ))}
          </div>
        )}

        <div>
          <label className="text-xs text-black dark:text-white block mb-1">Indicator name</label>
          <input type="text" placeholder="e.g. Beneficiaries trained" value={name} onChange={(e) => setName(e.target.value)}
            className="w-full h-10 px-3 rounded-lg border border-border bg-transparent text-sm text-black dark:text-white" />
        </div>
        <div>
          <label className="text-xs text-black dark:text-white block mb-1">Definition</label>
          <textarea placeholder="How is this measured, from whom, and on what schedule" value={definition}
            onChange={(e) => setDefinition(e.target.value)} rows={3}
            className="w-full px-3 py-2 rounded-lg border border-border bg-transparent text-sm text-black dark:text-white resize-none" />
        </div>
        <div>
          <label className="text-xs text-black dark:text-white block mb-1">Baseline value (optional)</label>
          <input type="text" placeholder="Current value before this partnership" value={baselineValue} onChange={(e) => setBaselineValue(e.target.value)}
            className="w-full h-10 px-3 rounded-lg border border-border bg-transparent text-sm text-black dark:text-white" />
        </div>
        <div>
          <label className="text-xs text-black dark:text-white block mb-1">Target value</label>
          <input type="text" placeholder="What you're aiming for" value={targetValue} onChange={(e) => setTargetValue(e.target.value)}
            className="w-full h-10 px-3 rounded-lg border border-border bg-transparent text-sm text-black dark:text-white" />
        </div>
        <div>
          <label className="text-xs text-black dark:text-white block mb-1">Measurement window</label>
          <input type="text" placeholder="e.g. quarterly, end-of-project" value={measurementWindow}
            onChange={(e) => setMeasurementWindow(e.target.value)}
            className="w-full h-10 px-3 rounded-lg border border-border bg-transparent text-sm text-black dark:text-white" />
        </div>

        {name.trim() && definition.trim() && (
          <button type="button" onClick={refineIndicator} disabled={refineLoading || refineCount >= REFINE_CAP}
            className="w-full flex items-center justify-center gap-1.5 h-8 rounded-full border border-border text-xs font-medium text-black dark:text-white hover:border-[#2D6A4F]/40 disabled:opacity-50 transition-colors">
            {refineLoading
              ? <><Loader2 className="w-3 h-3 animate-spin" />Refining...</>
              : refineCount >= REFINE_CAP
                ? "Refine limit reached"
                : <><Sparkles className="w-3 h-3" />Refine with AI ({REFINE_CAP - refineCount} left)</>}
          </button>
        )}
        {refineRequiresUpgrade && <p className="text-xs text-[#C45C26]">Refining needs an upgrade.</p>}
        {refineFailed && <p className="text-xs text-[#C45C26]">Couldn't refine. Try again.</p>}
        {refineSuggestion && (
          <div className="rounded-lg border border-[#2D6A4F]/20 bg-[#2D6A4F]/5 px-3 py-2 space-y-2">
            <p className="text-xs font-semibold text-[#2D6A4F]">Suggested tightened version</p>
            <p className="text-sm font-medium text-black dark:text-white">{refineSuggestion.name}</p>
            <p className="text-xs text-black dark:text-white">{refineSuggestion.definition}</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setRefineSuggestion(null)}
                className="flex-1 h-8 rounded-full border border-border text-xs text-black dark:text-white hover:border-foreground/30 transition-colors">
                Dismiss
              </button>
              <button type="button" onClick={acceptRefinement}
                className="flex-1 h-8 rounded-full bg-[#2D6A4F] hover:bg-[#245c43] text-white text-xs font-medium transition-colors">
                Accept
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button type="button" onClick={onClose}
            className="flex-1 h-10 rounded-full border border-border text-sm text-black dark:text-white hover:border-foreground/30 transition-colors">
            Cancel
          </button>
          <button type="button" onClick={handleCreate} disabled={creating || !canCreate}
            className="flex-1 h-10 rounded-full bg-[#2D6A4F] hover:bg-[#245c43] text-white text-sm font-medium disabled:opacity-60 transition-colors">
            {creating ? "Adding..." : "Add indicator"}
          </button>
        </div>
      </div>
    </div>
  );
}
