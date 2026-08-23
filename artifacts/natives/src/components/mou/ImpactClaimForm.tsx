import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Loader2, Upload, Link as LinkIcon, X, Plus, Trash2 } from "lucide-react";
import { fetchProofPoints, type ProofPoint } from "@/lib/proofPoints";

// Bucket was finalized and built in the original Impact Verification
// handover session -- this is not a placeholder.
const EVIDENCE_BUCKET = "impact-evidence";

interface PriorEvidenceRow {
  proof_point_id: string | null;
  justification_text: string;
  evidence_type: "file" | "link";
  evidence_value: string;
}

interface ProofPointDraft {
  mode: "unchanged" | "update" | null; // null only meaningful when isResubmission is true
  justification: string;
  evidenceType: "file" | "link";
  evidenceFile: File | null;
  evidenceLink: string;
}

interface SupplementaryDraft {
  tempId: string;
  justification: string;
  evidenceType: "file" | "link";
  evidenceFile: File | null;
  evidenceLink: string;
}

function slugifyFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
}

export default function ImpactClaimForm({
  indicatorId, claimingOrgId, onClose, onCreated,
}: {
  indicatorId: string;
  claimingOrgId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [proofPoints, setProofPoints] = useState<ProofPoint[]>([]);
  const [priorClaimId, setPriorClaimId] = useState<string | null>(null);
  const [priorEvidence, setPriorEvidence] = useState<PriorEvidenceRow[]>([]);
  const [proofPointDrafts, setProofPointDrafts] = useState<Record<string, ProofPointDraft>>({});
  const [supplementary, setSupplementary] = useState<SupplementaryDraft[]>([]);
  const [supplementaryDraft, setSupplementaryDraft] = useState<{
    justification: string; evidenceType: "file" | "link"; evidenceFile: File | null; evidenceLink: string;
  }>({ justification: "", evidenceType: "file", evidenceFile: null, evidenceLink: "" });
  const [claimedValue, setClaimedValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isResubmission = !!priorClaimId;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError(null);

      const points = await fetchProofPoints(indicatorId);

      // A disputed claim reopens the indicator to awaiting-evidence --
      // the latest disputed claim on this indicator (by either org,
      // since claiming is open to either party) becomes the prior claim
      // this submission supersedes. Resubmission carries an explicit
      // per-proof-point unchanged/update choice, never a silent default.
      // Scoped to this org specifically -- "claiming open to either org"
      // governs who may submit a claim on this indicator at all, not who
      // may resubmit in response to a specific dispute. A dispute is
      // directed at the claimant's evidence; only that claimant has
      // standing to fix it. A different org opening this form gets a
      // fresh submission, never someone else's carry-forward.
      const { data: priorRows } = await supabase
        .from("impact_claims")
        .select("id")
        .eq("indicator_id", indicatorId)
        .eq("claiming_org_id", claimingOrgId)
        .eq("status", "disputed")
        .order("created_at", { ascending: false })
        .limit(1);

      if (cancelled) return;

      const prior = priorRows?.[0] ?? null;
      let priorEv: PriorEvidenceRow[] = [];
      if (prior) {
        const { data: evRows } = await supabase
          .from("impact_claim_evidence")
          .select("proof_point_id, justification_text, evidence_type, evidence_value")
          .eq("claim_id", prior.id);
        priorEv = (evRows ?? []) as PriorEvidenceRow[];
      }

      if (cancelled) return;

      setProofPoints(points);
      setPriorClaimId(prior?.id ?? null);
      setPriorEvidence(priorEv);
      setProofPointDrafts(
        Object.fromEntries(
          points.map((pp) => [pp.id, {
            mode: prior ? null : "update",
            justification: "",
            evidenceType: "file" as const,
            evidenceFile: null,
            evidenceLink: "",
          }])
        )
      );
      setLoading(false);
    }
    load().catch(() => { if (!cancelled) { setLoadError("Couldn't load the verification checklist. Try again."); setLoading(false); } });
    return () => { cancelled = true; };
  }, [indicatorId]);

  function updateDraft(proofPointId: string, patch: Partial<ProofPointDraft>) {
    setProofPointDrafts((prev) => ({ ...prev, [proofPointId]: { ...prev[proofPointId], ...patch } }));
  }

  function addSupplementary() {
    if (!supplementaryDraft.justification.trim()) return;
    if (supplementaryDraft.evidenceType === "file" && !supplementaryDraft.evidenceFile) return;
    if (supplementaryDraft.evidenceType === "link" && !supplementaryDraft.evidenceLink.trim()) return;
    setSupplementary((prev) => [...prev, { tempId: crypto.randomUUID(), ...supplementaryDraft }]);
    setSupplementaryDraft({ justification: "", evidenceType: "file", evidenceFile: null, evidenceLink: "" });
  }

  function removeSupplementary(tempId: string) {
    setSupplementary((prev) => prev.filter((s) => s.tempId !== tempId));
  }

  function priorEvidenceFor(proofPointId: string): PriorEvidenceRow | undefined {
    return priorEvidence.find((row) => row.proof_point_id === proofPointId);
  }

  const canSubmit =
    !loading &&
    !!claimedValue.trim() &&
    proofPoints.every((pp) => {
      const draft = proofPointDrafts[pp.id];
      if (!draft) return false;
      if (isResubmission) {
        if (draft.mode === null) return false;
        if (draft.mode === "unchanged") return true;
      }
      if (!draft.justification.trim()) return false;
      return draft.evidenceType === "file" ? !!draft.evidenceFile : !!draft.evidenceLink.trim();
    });

  async function uploadFile(file: File, proofPointId: string | null): Promise<string | null> {
    const path = `evidence/${indicatorId}/${claimingOrgId}-${Date.now()}-${proofPointId ?? "supplementary"}-${slugifyFileName(file.name)}`;
    const { error: uploadError } = await supabase.storage.from(EVIDENCE_BUCKET).upload(path, file);
    if (uploadError) return null;
    return path;
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);

    const { data: claim, error: claimError } = await supabase
      .from("impact_claims")
      .insert({
        indicator_id: indicatorId,
        claiming_org_id: claimingOrgId,
        status: "pending",
        prior_claim_id: priorClaimId,
        claimed_value: claimedValue.trim(),
      })
      .select()
      .single();

    if (claimError || !claim) {
      setSubmitting(false);
      setError("Couldn't submit the claim. Try again.");
      return;
    }

    const evidenceRows: {
      claim_id: string;
      proof_point_id: string | null;
      justification_text: string;
      evidence_type: "file" | "link";
      evidence_value: string;
      carried_forward: boolean;
    }[] = [];

    for (const pp of proofPoints) {
      const draft = proofPointDrafts[pp.id];
      if (isResubmission && draft.mode === "unchanged") {
        const prior = priorEvidenceFor(pp.id);
        if (!prior) {
          setSubmitting(false);
          setError("Couldn't carry forward prior evidence for one of the proof points. Try updating it instead.");
          return;
        }
        evidenceRows.push({
          claim_id: claim.id,
          proof_point_id: pp.id,
          justification_text: prior.justification_text,
          evidence_type: prior.evidence_type,
          evidence_value: prior.evidence_value,
          carried_forward: true,
        });
        continue;
      }

      let evidenceValue: string;
      if (draft.evidenceType === "file") {
        const uploaded = await uploadFile(draft.evidenceFile!, pp.id);
        if (!uploaded) {
          setSubmitting(false);
          setError("Couldn't upload evidence for one of the proof points. Try again.");
          return;
        }
        evidenceValue = uploaded;
      } else {
        evidenceValue = draft.evidenceLink.trim();
      }
      evidenceRows.push({
        claim_id: claim.id,
        proof_point_id: pp.id,
        justification_text: draft.justification.trim(),
        evidence_type: draft.evidenceType,
        evidence_value: evidenceValue,
        carried_forward: false,
      });
    }

    for (const supp of supplementary) {
      let evidenceValue: string;
      if (supp.evidenceType === "file") {
        const uploaded = await uploadFile(supp.evidenceFile!, null);
        if (!uploaded) {
          setSubmitting(false);
          setError("Couldn't upload one of the supplementary evidence files. Try again.");
          return;
        }
        evidenceValue = uploaded;
      } else {
        evidenceValue = supp.evidenceLink.trim();
      }
      evidenceRows.push({
        claim_id: claim.id,
        proof_point_id: null,
        justification_text: supp.justification.trim(),
        evidence_type: supp.evidenceType,
        evidence_value: evidenceValue,
        carried_forward: false,
      });
    }

    const { error: evidenceError } = await supabase.from("impact_claim_evidence").insert(evidenceRows);
    setSubmitting(false);
    if (evidenceError) {
      setError("The claim was created but evidence couldn't be saved. Contact support before resubmitting.");
      return;
    }
    onCreated();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-card rounded-t-2xl sm:rounded-2xl border border-border w-full sm:max-w-lg shadow-xl p-6 space-y-4 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="text-base font-bold text-black dark:text-white">
            {isResubmission ? "Resubmit impact claim" : "Submit impact claim"}
          </p>
          <button type="button" onClick={onClose} className="p-1 rounded-full hover:bg-muted transition-colors">
            <X className="w-4 h-4 text-black dark:text-white" />
          </button>
        </div>

        {isResubmission && (
          <p className="text-xs text-black dark:text-white bg-[#C45C26]/10 border border-[#C45C26]/20 rounded-lg px-3 py-2">
            This indicator's prior claim was disputed. For each proof point, choose whether your evidence is unchanged or needs updating -- every one needs an explicit answer.
          </p>
        )}

        {!loading && (
          <div>
            <label className="text-xs text-black dark:text-white block mb-1">Claimed value <span className="text-red-600">*</span></label>
            <input type="text" placeholder="e.g. 450 beneficiaries trained" value={claimedValue}
              onChange={(e) => setClaimedValue(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-border bg-transparent text-sm text-black dark:text-white" />
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-black dark:text-white" />
          </div>
        )}

        {loadError && <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{loadError}</p>}

        {!loading && !loadError && (
          <>
            <div className="space-y-3">
              <p className="text-sm font-bold text-black dark:text-white">Verification checklist</p>
              {proofPoints.map((pp) => {
                const draft = proofPointDrafts[pp.id];
                const prior = priorEvidenceFor(pp.id);
                const showFields = !isResubmission || draft.mode === "update";
                return (
                  <div key={pp.id} className="rounded-lg border border-border px-3 py-2.5 space-y-2">
                    <div>
                      <p className="text-sm font-medium text-black dark:text-white">{pp.name}</p>
                      {pp.description && <p className="text-xs text-black dark:text-white mt-0.5">{pp.description}</p>}
                    </div>

                    {isResubmission && (
                      <div className="flex gap-2">
                        <button type="button" onClick={() => updateDraft(pp.id, { mode: "unchanged" })}
                          disabled={!prior}
                          title={!prior ? "No prior evidence found for this proof point" : undefined}
                          className={`flex-1 h-8 rounded-full border text-xs font-medium transition-colors disabled:opacity-40 ${
                            draft.mode === "unchanged" ? "bg-[#2D6A4F] text-white border-[#2D6A4F]" : "border-border text-black dark:text-white"
                          }`}>
                          Unchanged from prior
                        </button>
                        <button type="button" onClick={() => updateDraft(pp.id, { mode: "update" })}
                          className={`flex-1 h-8 rounded-full border text-xs font-medium transition-colors ${
                            draft.mode === "update" ? "bg-[#2D6A4F] text-white border-[#2D6A4F]" : "border-border text-black dark:text-white"
                          }`}>
                          Update
                        </button>
                      </div>
                    )}

                    {isResubmission && draft.mode === "unchanged" && prior && (
                      <p className="text-xs text-black dark:text-white bg-muted rounded-md px-2 py-1.5">
                        Carrying forward: {prior.justification_text}
                      </p>
                    )}

                    {showFields && (
                      <>
                        <textarea placeholder="Justification -- how does this evidence satisfy the proof point?"
                          value={draft.justification} onChange={(e) => updateDraft(pp.id, { justification: e.target.value })}
                          rows={2} className="w-full px-3 py-2 rounded-lg border border-border bg-transparent text-sm text-black dark:text-white resize-none" />
                        <div className="flex items-center rounded-full border border-border p-0.5 w-fit">
                          <button type="button" onClick={() => updateDraft(pp.id, { evidenceType: "file" })}
                            className={`flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                              draft.evidenceType === "file" ? "bg-[#2D6A4F] text-white" : "text-black dark:text-white"
                            }`}>
                            <Upload className="w-3 h-3" /> File
                          </button>
                          <button type="button" onClick={() => updateDraft(pp.id, { evidenceType: "link" })}
                            className={`flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                              draft.evidenceType === "link" ? "bg-[#2D6A4F] text-white" : "text-black dark:text-white"
                            }`}>
                            <LinkIcon className="w-3 h-3" /> Link
                          </button>
                        </div>
                        {draft.evidenceType === "file" ? (
                          <label className="flex items-center justify-center gap-2 cursor-pointer rounded-xl border border-dashed border-border px-4 py-3 text-sm text-black dark:text-white hover:border-[#2D6A4F]/40 transition-colors">
                            <Upload className="w-4 h-4" />
                            {draft.evidenceFile ? draft.evidenceFile.name : "Choose evidence file"}
                            <input type="file" className="hidden"
                              onChange={(e) => updateDraft(pp.id, { evidenceFile: e.target.files?.[0] ?? null })} />
                          </label>
                        ) : (
                          <input type="url" placeholder="https://..." value={draft.evidenceLink}
                            onChange={(e) => updateDraft(pp.id, { evidenceLink: e.target.value })}
                            className="w-full h-10 px-3 rounded-lg border border-border bg-transparent text-sm text-black dark:text-white" />
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-2">
              <div>
                <p className="text-sm font-bold text-black dark:text-white">Additional evidence</p>
                <p className="text-xs text-black dark:text-white mt-0.5">
                  Optional -- context beyond the checklist. The reviewer can accept or dismiss each item without it affecting the rest of your claim.
                </p>
              </div>
              {supplementary.map((s) => (
                <div key={s.tempId} className="flex items-start gap-2 rounded-lg border border-border px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-black dark:text-white">{s.justification}</p>
                    <p className="text-xs text-black dark:text-white mt-0.5">
                      {s.evidenceType === "file" ? s.evidenceFile?.name : s.evidenceLink}
                    </p>
                  </div>
                  <button type="button" onClick={() => removeSupplementary(s.tempId)}
                    aria-label="Remove" title="Remove"
                    className="p-1.5 rounded-full text-black dark:text-white hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 transition-colors shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <textarea placeholder="Justification for this additional item" value={supplementaryDraft.justification}
                onChange={(e) => setSupplementaryDraft((prev) => ({ ...prev, justification: e.target.value }))}
                rows={2} className="w-full px-3 py-2 rounded-lg border border-border bg-transparent text-sm text-black dark:text-white resize-none" />
              <div className="flex items-center rounded-full border border-border p-0.5 w-fit">
                <button type="button" onClick={() => setSupplementaryDraft((prev) => ({ ...prev, evidenceType: "file" }))}
                  className={`flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                    supplementaryDraft.evidenceType === "file" ? "bg-[#2D6A4F] text-white" : "text-black dark:text-white"
                  }`}>
                  <Upload className="w-3 h-3" /> File
                </button>
                <button type="button" onClick={() => setSupplementaryDraft((prev) => ({ ...prev, evidenceType: "link" }))}
                  className={`flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                    supplementaryDraft.evidenceType === "link" ? "bg-[#2D6A4F] text-white" : "text-black dark:text-white"
                  }`}>
                  <LinkIcon className="w-3 h-3" /> Link
                </button>
              </div>
              {supplementaryDraft.evidenceType === "file" ? (
                <label className="flex items-center justify-center gap-2 cursor-pointer rounded-xl border border-dashed border-border px-4 py-3 text-sm text-black dark:text-white hover:border-[#2D6A4F]/40 transition-colors">
                  <Upload className="w-4 h-4" />
                  {supplementaryDraft.evidenceFile ? supplementaryDraft.evidenceFile.name : "Choose evidence file"}
                  <input type="file" className="hidden"
                    onChange={(e) => setSupplementaryDraft((prev) => ({ ...prev, evidenceFile: e.target.files?.[0] ?? null }))} />
                </label>
              ) : (
                <input type="url" placeholder="https://..." value={supplementaryDraft.evidenceLink}
                  onChange={(e) => setSupplementaryDraft((prev) => ({ ...prev, evidenceLink: e.target.value }))}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-transparent text-sm text-black dark:text-white" />
              )}
              <button type="button" onClick={addSupplementary}
                className="w-full flex items-center justify-center gap-1.5 h-8 rounded-full border border-[#2D6A4F]/30 text-xs font-medium text-[#2D6A4F] hover:bg-[#2D6A4F]/5 transition-colors">
                <Plus className="w-3.5 h-3.5" /> Add additional item
              </button>
            </div>
          </>
        )}

        {error && <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>}

        <div className="flex gap-2">
          <button type="button" onClick={onClose}
            className="flex-1 h-10 rounded-full border border-border text-sm text-black dark:text-white hover:border-foreground/30 transition-colors">
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} disabled={submitting || !canSubmit}
            className="flex-1 h-10 rounded-full bg-[#2D6A4F] hover:bg-[#245c43] text-white text-sm font-medium disabled:opacity-60 transition-colors">
            {submitting ? "Submitting..." : isResubmission ? "Resubmit claim" : "Submit claim"}
          </button>
        </div>
      </div>
    </div>
  );
}
