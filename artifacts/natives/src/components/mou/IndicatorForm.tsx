import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Loader2, Sparkles, X, CheckCircle2, Pencil, Trash2 } from "lucide-react";
import { createIndicator, updateIndicator, deleteIndicator } from "@/lib/indicators";
const REFINE_CAP = 3;
// supabase-js returns data: null whenever an edge function responds with
// a non-2xx status (e.g. the 403 tier gate) -- the real JSON body only
// lives on error.context, the raw Response object. Without this, every
// gated call fell through to the generic "couldn't generate" failure
// instead of surfacing requires_upgrade.
async function readFunctionErrorBody(error: unknown): Promise<any> {
  const context = (error as any)?.context;
  if (context && typeof context.json === "function") {
    try { return await context.json(); } catch { return null; }
  }
  return null;
}
interface AddedIndicator {
  id: string;
  name: string;
  definition: string;
  baseline_value: string | null;
  target_value: string;
  measurement_window: string;
  source: string | null;
}

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
  const [addedIndicators, setAddedIndicators] = useState<AddedIndicator[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [definition, setDefinition] = useState("");
  const [baselineValue, setBaselineValue] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [measurementWindow, setMeasurementWindow] = useState("");
  const [sourceValue, setSourceValue] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

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

  function resetDraftFields() {
    setName("");
    setDefinition("");
    setBaselineValue("");
    setTargetValue("");
    setMeasurementWindow("");
    setSourceValue("");
    setEditingId(null);
    setSuggestions([]);
    setSuggestFailed(false);
    setSuggestRequiresUpgrade(false);
    setRefineCount(0);
    setRefineSuggestion(null);
    setRefineFailed(false);
    setRefineRequiresUpgrade(false);
  }

  async function suggestIndicators() {
    setSuggestLoading(true);
    setSuggestFailed(false);
    setSuggestRequiresUpgrade(false);
    try {
      const { data, error } = await supabase.functions.invoke("suggest-partnership-indicators", {
        body: { mou_document_id: mouDocumentId, initiative_id: initiativeId, connection_id: connectionId },
      });
      const body = data ?? (await readFunctionErrorBody(error));
      if (body?.suggestions) {
        setSuggestions(body.suggestions);
      } else if (body?.requires_upgrade) {
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
      const body = data ?? (await readFunctionErrorBody(error));
      if (body?.refined) {
        setRefineSuggestion(body.refined);
        setRefineCount((n) => n + 1);
      } else if (body?.requires_upgrade) {
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

  // Renamed from handleCreate -- this now appends to the running list
  // rather than closing the modal, so the person can add several
  // indicators (the M&E-recommended 3-5 per the handover) before moving
  // on, instead of being funnelled through the create flow once per
  // indicator.
  async function addIndicator() {
    if (!name.trim() || !definition.trim() || !targetValue.trim() || !measurementWindow.trim()) return;
    setAdding(true);
    setAddError(null);
    const payload = {
      name: name.trim(),
      definition: definition.trim(),
      baseline_value: baselineValue.trim() || null,
      target_value: targetValue.trim(),
      measurement_window: measurementWindow.trim(),
      source: sourceValue.trim() || null,
    };
    if (editingId) {
      const result = await updateIndicator(editingId, payload);
      setAdding(false);
      if (!result) { setAddError("Couldn't save that change. Try again."); return; }
      setAddedIndicators((prev) => prev.map((ind) => (ind.id === editingId ? {
        id: result.id, name: result.name, definition: result.definition, baseline_value: result.baseline_value,
        target_value: result.target_value, measurement_window: result.measurement_window, source: result.source,
      } : ind)));
      resetDraftFields();
      return;
    }
    const result = await createIndicator({ mou_document_id: mouDocumentId, created_by_org_id: createdByOrgId, ...payload });
    setAdding(false);
    if (!result) { setAddError("Couldn't add that indicator. Try again."); return; }
    setAddedIndicators((prev) => [...prev, {
      id: result.id, name: result.name, definition: result.definition, baseline_value: result.baseline_value,
      target_value: result.target_value, measurement_window: result.measurement_window, source: result.source,
    }]);
    resetDraftFields();
  }
  function startEditIndicator(ind: AddedIndicator) {
    setEditingId(ind.id);
    setName(ind.name);
    setDefinition(ind.definition);
    setBaselineValue(ind.baseline_value ?? "");
    setTargetValue(ind.target_value);
    setMeasurementWindow(ind.measurement_window);
    setSourceValue(ind.source ?? "");
  }
  async function removeAddedIndicator(id: string) {
    setDeletingId(id);
    setAddError(null);
    const deleted = await deleteIndicator(id);
    setDeletingId(null);
    if (!deleted) { setAddError("Couldn't remove that indicator. Try again."); return; }
    setAddedIndicators((prev) => prev.filter((ind) => ind.id !== id));
    if (editingId === id) resetDraftFields();
  }

  function handleContinue() {
    if (addedIndicators.length === 0) return;
    onCreated();
    onClose();
  }

  const canAdd = name.trim() && definition.trim() && targetValue.trim() && measurementWindow.trim();

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-card rounded-t-2xl sm:rounded-2xl border border-border w-full sm:max-w-lg shadow-xl p-6 space-y-4 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="text-base font-bold text-black dark:text-white">Add outcome indicators</p>
          <button type="button" onClick={onClose} className="p-1 rounded-full hover:bg-muted transition-colors">
            <X className="w-4 h-4 text-black dark:text-white" />
          </button>
        </div>
        <p className="text-xs text-black dark:text-white">
          At least one is required before this MoU can be sent. Add a few more now if you can -- 3 to 5 is typical.
        </p>
        <div className="h-px bg-border" />

        <button type="button" onClick={suggestIndicators} disabled={suggestLoading}
          className="w-full flex items-center justify-center gap-1.5 h-9 rounded-full border border-[#2D6A4F]/30 bg-[#2D6A4F]/5 text-sm font-medium text-[#2D6A4F] hover:bg-[#2D6A4F]/10 disabled:opacity-50 transition-colors">
          {suggestLoading
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Suggesting...</>
            : <><Sparkles className="w-3.5 h-3.5" />Suggest with AI</>}
        </button>
        {suggestRequiresUpgrade && (
          <p className="text-xs text-[#C45C26]">
            AI-suggested indicators are available on the Plus plan and above. Upgrade to use this, or fill this in manually below.
          </p>
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
          <label className="text-xs text-black dark:text-white block mb-1">Indicator name <span className="text-red-600">*</span></label>
          <input type="text" placeholder="e.g. Beneficiaries trained" value={name} onChange={(e) => setName(e.target.value)}
            className="w-full h-10 px-3 rounded-lg border border-border bg-transparent text-sm text-black dark:text-white" />
        </div>
        <div>
          <label className="text-xs text-black dark:text-white block mb-1">Definition <span className="text-red-600">*</span></label>
          <textarea placeholder="How is this measured, from whom, and on what schedule" value={definition}
            onChange={(e) => setDefinition(e.target.value)} rows={3}
            className="w-full px-3 py-2 rounded-lg border border-border bg-transparent text-sm text-black dark:text-white resize-none" />
        </div>
        <div>
          <label className="text-xs text-black dark:text-white block mb-1">Baseline value</label>
          <input type="text" placeholder="Current value before this partnership" value={baselineValue} onChange={(e) => setBaselineValue(e.target.value)}
            className="w-full h-10 px-3 rounded-lg border border-border bg-transparent text-sm text-black dark:text-white" />
        </div>
        <div>
          <label className="text-xs text-black dark:text-white block mb-1">Source</label>
          <input type="text" placeholder="e.g. Baseline survey 2026, org M&E framework" value={sourceValue} onChange={(e) => setSourceValue(e.target.value)}
            className="w-full h-10 px-3 rounded-lg border border-border bg-transparent text-sm text-black dark:text-white" />
        </div>
        <div>
          <label className="text-xs text-black dark:text-white block mb-1">Target value <span className="text-red-600">*</span></label>
          <input type="text" placeholder="What you're aiming for" value={targetValue} onChange={(e) => setTargetValue(e.target.value)}
            className="w-full h-10 px-3 rounded-lg border border-border bg-transparent text-sm text-black dark:text-white" />
        </div>
        <div>
          <label className="text-xs text-black dark:text-white block mb-1">Measurement window <span className="text-red-600">*</span></label>
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
        {refineRequiresUpgrade && <p className="text-xs text-[#C45C26]">AI refinement is available on the Plus plan and above. Upgrade to use this.</p>}
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

{addError && <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{addError}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={addIndicator} disabled={adding || !canAdd}
            className="flex-1 h-10 rounded-full border border-[#2D6A4F] text-[#2D6A4F] text-sm font-medium hover:bg-[#2D6A4F]/5 disabled:opacity-60 transition-colors">
            {adding ? "Saving..." : editingId ? "Save changes" : "Add this indicator"}
          </button>
          {editingId && (
            <button type="button" onClick={resetDraftFields}
              className="h-10 px-4 rounded-full border border-border text-sm text-black dark:text-white hover:border-foreground/30 transition-colors">
              Cancel edit
            </button>
          )}
        </div>
        {addedIndicators.length > 0 && (
          <div className="space-y-1.5">
            {addedIndicators.map((ind) => (
              <div key={ind.id} className="flex items-start gap-2 rounded-lg border border-[#2D6A4F]/20 bg-[#2D6A4F]/5 px-3 py-2">
                <CheckCircle2 className="w-4 h-4 text-[#2D6A4F] shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-black dark:text-white">{ind.name}</p>
                  <p className="text-xs text-black dark:text-white mt-0.5">
                    Target: {ind.target_value} · {ind.measurement_window}
                  </p>
                  {ind.source && <p className="text-xs text-black dark:text-white mt-0.5">Source: {ind.source}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button type="button" onClick={() => startEditIndicator(ind)}
                    aria-label="Edit" title="Edit"
                    className="p-1.5 rounded-full text-black dark:text-white hover:bg-[#2D6A4F]/10 transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" onClick={() => removeAddedIndicator(ind.id)} disabled={deletingId === ind.id}
                    aria-label="Delete" title="Delete"
                    className="p-1.5 rounded-full text-black dark:text-white hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 transition-colors disabled:opacity-50">
                    {deletingId === ind.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <button type="button" onClick={onClose}
            className="flex-1 h-10 rounded-full border border-border text-sm text-black dark:text-white hover:border-foreground/30 transition-colors">
            Cancel
          </button>
          <button type="button" onClick={handleContinue} disabled={addedIndicators.length === 0}
            title={addedIndicators.length === 0 ? "Add at least one indicator first" : undefined}
            className="flex-1 h-10 rounded-full bg-[#2D6A4F] hover:bg-[#245c43] text-white text-sm font-medium disabled:opacity-60 transition-colors">
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}