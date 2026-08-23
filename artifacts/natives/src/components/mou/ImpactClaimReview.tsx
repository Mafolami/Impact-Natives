import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Loader2, CheckCircle2, AlertTriangle, Flag, X, EyeOff, Eye } from "lucide-react";
import { OrgRef, actorLabel } from "@/lib/milestones";
import { fetchProofPoints, type ProofPoint } from "@/lib/proofPoints";
import type { ImpactClaim } from "@/lib/impactClaims";

interface EvidenceRow {
  id: string;
  proof_point_id: string | null;
  justification_text: string;
  evidence_type: "file" | "link";
  evidence_value: string;
  carried_forward: boolean;
  reviewer_dismissed: boolean;
}

const MIN_RESPONSE_WINDOW_DAYS = 14;

export default function ImpactClaimReview({
  claim, viewerOrgId, orgA, orgB, myUserId, onClose, onChanged,
}: {
  claim: ImpactClaim;
  viewerOrgId: string;
  orgA: OrgRef | null;
  orgB: OrgRef | null;
  myUserId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [loadingBundle, setLoadingBundle] = useState(true);
  const [bundleError, setBundleError] = useState<string | null>(null);
  const [proofPoints, setProofPoints] = useState<ProofPoint[]>([]);
  const [evidence, setEvidence] = useState<EvidenceRow[]>([]);
  const [dismissingId, setDismissingId] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disputeReasonPending, setDisputeReasonPending] = useState("");
  const [showDisputePendingForm, setShowDisputePendingForm] = useState(false);
  const [challengeReason, setChallengeReason] = useState("");
  const [responseWindowDays, setResponseWindowDays] = useState(String(MIN_RESPONSE_WINDOW_DAYS));
  const [showChallengeForm, setShowChallengeForm] = useState(false);
  const [claimantResponse, setClaimantResponse] = useState(claim.claimant_response ?? "");
  const [disputeReasonChallenged, setDisputeReasonChallenged] = useState("");
  const [showDisputeChallengedForm, setShowDisputeChallengedForm] = useState(false);

  const isClaimant = viewerOrgId === claim.claiming_org_id;
  const isCounterparty = !isClaimant;
  const claimantName = claim.claiming_org_id === orgA?.id ? orgA?.organisation_name : orgB?.organisation_name;
  const counterpartyName = claim.claiming_org_id === orgA?.id ? orgB?.organisation_name : orgA?.organisation_name;

  const now = new Date();
  const deadlinePassed = claim.response_deadline ? now > new Date(claim.response_deadline) : false;
  const claimantHasResponded = !!claim.claimant_response;
  // Per the confirmed challenge flow: the verifier's "proceed to disputed"
  // action only unlocks once the claimant has responded (for review) or
  // the response deadline has passed with no response.
  const canProceedToDispute = claimantHasResponded || deadlinePassed;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadingBundle(true);
      setBundleError(null);
      const [points, evRes] = await Promise.all([
        fetchProofPoints(claim.indicator_id),
        supabase.from("impact_claim_evidence").select("*").eq("claim_id", claim.id),
      ]);
      if (cancelled) return;
      if (evRes.error) {
        setBundleError("Couldn't load the claim's evidence. Try again.");
        setLoadingBundle(false);
        return;
      }
      setProofPoints(points);
      setEvidence((evRes.data ?? []) as EvidenceRow[]);
      setLoadingBundle(false);
    }
    load();
    return () => { cancelled = true; };
  }, [claim.id, claim.indicator_id]);

  function evidenceFor(proofPointId: string): EvidenceRow | undefined {
    return evidence.find((row) => row.proof_point_id === proofPointId);
  }

  const supplementaryEvidence = evidence.filter((row) => row.proof_point_id === null);

  async function toggleDismiss(evidenceId: string, dismissed: boolean) {
    setDismissingId(evidenceId);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("transition-impact-claim", {
        body: { claim_id: claim.id, action: "set_evidence_dismissal", evidence_id: evidenceId, dismissed },
      });
      if (fnError || data?.error) {
        setDismissingId(null);
        return;
      }
      setEvidence((prev) => prev.map((row) => (row.id === evidenceId ? { ...row, reviewer_dismissed: dismissed } : row)));
    } finally {
      setDismissingId(null);
    }
  }

  async function runTransition(action: string, extra: Record<string, any> = {}) {
    setBusy(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("transition-impact-claim", {
        body: { claim_id: claim.id, action, ...extra },
      });
      if (fnError || data?.error) {
        setError(data?.error ?? "Couldn't complete that action. Try again.");
        setBusy(false);
        return;
      }
      onChanged();
      onClose();
    } catch {
      setError("Couldn't complete that action. Try again.");
      setBusy(false);
    }
  }

  function confirmClaim() {
    runTransition("confirm");
  }
  function disputeFromPending() {
    if (!disputeReasonPending.trim()) return;
    runTransition("dispute", { dispute_reason: disputeReasonPending.trim() });
  }
  function submitChallenge() {
    const windowDays = parseInt(responseWindowDays, 10);
    if (!challengeReason.trim() || isNaN(windowDays) || windowDays < MIN_RESPONSE_WINDOW_DAYS) return;
    runTransition("challenge", { challenge_reason: challengeReason.trim(), response_window_days: windowDays });
  }
  function submitClaimantResponse() {
    if (!claimantResponse.trim()) return;
    runTransition("respond_to_challenge", { claimant_response: claimantResponse.trim() });
  }
  function withdrawChallenge() {
    runTransition("withdraw_challenge");
  }
  function disputeFromChallenged() {
    if (!disputeReasonChallenged.trim()) return;
    runTransition("dispute", { dispute_reason: disputeReasonChallenged.trim() });
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-card rounded-t-2xl sm:rounded-2xl border border-border w-full sm:max-w-lg shadow-xl p-6 space-y-4 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="text-base font-bold text-black dark:text-white">Impact claim</p>
          <button type="button" onClick={onClose} className="p-1 rounded-full hover:bg-muted transition-colors">
            <X className="w-4 h-4 text-black dark:text-white" />
          </button>
        </div>

        <p className="text-xs text-black dark:text-white">Claimed by {claimantName ?? "Partner"}</p>

        {loadingBundle && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-black dark:text-white" />
          </div>
        )}

        {bundleError && <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{bundleError}</p>}

        {!loadingBundle && !bundleError && (
          <div className="space-y-3">
            <p className="text-sm font-bold text-black dark:text-white">Verification checklist</p>
            {proofPoints.map((pp) => {
              const row = evidenceFor(pp.id);
              return (
                <div key={pp.id} className="rounded-lg border border-border p-3 space-y-1.5">
                  <p className="text-sm font-medium text-black dark:text-white">{pp.name}</p>
                  {pp.description && <p className="text-xs text-black dark:text-white">{pp.description}</p>}
                  {row ? (
                    <>
                      <p className="text-sm text-black dark:text-white mt-1">{row.justification_text}</p>
                      <p className="text-xs text-black dark:text-white">
                        Evidence: {row.evidence_type === "link" ? (
                          <a href={row.evidence_value} target="_blank" rel="noopener noreferrer" className="underline">{row.evidence_value}</a>
                        ) : "Uploaded file"}
                        {row.carried_forward && " (carried forward from prior submission)"}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-red-600">No evidence submitted for this proof point.</p>
                  )}
                </div>
              );
            })}

            {supplementaryEvidence.length > 0 && (
              <>
                <p className="text-sm font-bold text-black dark:text-white pt-1">Additional evidence</p>
                {supplementaryEvidence.map((row) => (
                  <div key={row.id} className={`rounded-lg border p-3 space-y-1.5 ${
                    row.reviewer_dismissed ? "border-border opacity-60" : "border-border"
                  }`}>
                    <p className="text-sm text-black dark:text-white">{row.justification_text}</p>
                    <p className="text-xs text-black dark:text-white">
                      Evidence: {row.evidence_type === "link" ? (
                        <a href={row.evidence_value} target="_blank" rel="noopener noreferrer" className="underline">{row.evidence_value}</a>
                      ) : "Uploaded file"}
                    </p>
                    {isCounterparty && (
                      <button type="button" onClick={() => toggleDismiss(row.id, !row.reviewer_dismissed)}
                        disabled={dismissingId === row.id}
                        className="flex items-center gap-1.5 text-xs font-medium text-black dark:text-white hover:opacity-70 disabled:opacity-50 transition-opacity">
                        {dismissingId === row.id ? <Loader2 className="w-3 h-3 animate-spin" /> : row.reviewer_dismissed ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        {row.reviewer_dismissed ? "Restore this item" : "Dismiss this item"}
                      </button>
                    )}
                    {!isCounterparty && row.reviewer_dismissed && (
                      <p className="text-xs text-black dark:text-white">Dismissed by {counterpartyName ?? "reviewer"}</p>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {error && <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>}

        {/* PENDING: counterparty can confirm or dispute the whole bundle (stays private -- never publicly confirmed) */}
        {claim.status === "pending" && isCounterparty && (
          <div className="space-y-2">
            <button type="button" onClick={confirmClaim} disabled={busy}
              className="w-full flex items-center justify-center gap-2 h-10 rounded-full bg-[#2D6A4F] hover:bg-[#245c43] text-white text-sm font-medium disabled:opacity-60 transition-colors">
              <CheckCircle2 className="w-4 h-4" /> Confirm this claim
            </button>
            {!showDisputePendingForm ? (
              <button type="button" onClick={() => setShowDisputePendingForm(true)} disabled={busy}
                className="w-full flex items-center justify-center gap-2 h-10 rounded-full border border-red-300 text-red-600 hover:bg-red-50 text-sm font-medium disabled:opacity-60 transition-colors">
                <AlertTriangle className="w-4 h-4" /> Dispute
              </button>
            ) : (
              <div className="space-y-2">
                <textarea placeholder="Why are you disputing this claim?" value={disputeReasonPending}
                  onChange={(e) => setDisputeReasonPending(e.target.value)} rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-transparent text-sm text-black dark:text-white resize-none" />
                <button type="button" onClick={disputeFromPending} disabled={busy || !disputeReasonPending.trim()}
                  className="w-full h-9 rounded-full bg-red-600 hover:bg-red-700 text-white text-sm font-medium disabled:opacity-60 transition-colors">
                  {busy ? "Submitting..." : "Submit dispute"}
                </button>
              </div>
            )}
          </div>
        )}
        {claim.status === "pending" && isClaimant && (
          <p className="text-sm text-black dark:text-white">Waiting for {counterpartyName ?? "your partner"} to confirm or dispute this claim.</p>
        )}

        {/* CONFIRMED: counterparty (verifier) can challenge their own prior confirmation */}
        {claim.status === "confirmed" && (
          <div className="space-y-2">
            <p className="text-sm text-[#2D6A4F] flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> Confirmed</p>
            {isCounterparty && !showChallengeForm && (
              <button type="button" onClick={() => setShowChallengeForm(true)} disabled={busy}
                className="w-full flex items-center justify-center gap-2 h-10 rounded-full border border-amber-300 text-amber-700 hover:bg-amber-50 text-sm font-medium disabled:opacity-60 transition-colors">
                <Flag className="w-4 h-4" /> Challenge this confirmation
              </button>
            )}
            {isCounterparty && showChallengeForm && (
              <div className="space-y-2">
                <textarea placeholder="Why are you challenging this?" value={challengeReason}
                  onChange={(e) => setChallengeReason(e.target.value)} rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-transparent text-sm text-black dark:text-white resize-none" />
                <div>
                  <label className="text-xs text-black dark:text-white">Response window (days, minimum {MIN_RESPONSE_WINDOW_DAYS})</label>
                  <input type="number" min={MIN_RESPONSE_WINDOW_DAYS} value={responseWindowDays}
                    onChange={(e) => setResponseWindowDays(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-transparent text-sm text-black dark:text-white" />
                </div>
                <button type="button" onClick={submitChallenge}
                  disabled={busy || !challengeReason.trim() || parseInt(responseWindowDays, 10) < MIN_RESPONSE_WINDOW_DAYS}
                  className="w-full h-9 rounded-full bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium disabled:opacity-60 transition-colors">
                  {busy ? "Submitting..." : "Submit challenge"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* CHALLENGED: claimant can respond before deadline; verifier can withdraw anytime, or proceed to dispute once claimant responded or deadline passed */}
        {claim.status === "challenged" && (
          <div className="space-y-3">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-semibold text-amber-800">Challenged</p>
              <p className="text-sm text-amber-800 mt-1">{claim.challenge_reason}</p>
              {claim.response_deadline && (
                <p className="text-xs text-amber-700 mt-1">
                  Response due by {new Date(claim.response_deadline).toLocaleDateString("en-GB")}
                  {deadlinePassed && " (passed)"}
                </p>
              )}
            </div>
            {claim.claimant_response && (
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-black dark:text-white">Claimant's response</p>
                <p className="text-sm text-black dark:text-white mt-1">{claim.claimant_response}</p>
              </div>
            )}
            {isClaimant && !deadlinePassed && (
              <div className="space-y-2">
                <textarea placeholder="Respond to this challenge..." value={claimantResponse}
                  onChange={(e) => setClaimantResponse(e.target.value)} rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-transparent text-sm text-black dark:text-white resize-none" />
                <button type="button" onClick={submitClaimantResponse} disabled={busy || !claimantResponse.trim()}
                  className="w-full h-9 rounded-full bg-[#2D6A4F] hover:bg-[#245c43] text-white text-sm font-medium disabled:opacity-60 transition-colors">
                  {busy ? "Submitting..." : "Submit response"}
                </button>
              </div>
            )}
            {isCounterparty && (
              <div className="space-y-2 border-t border-border pt-3">
                <button type="button" onClick={withdrawChallenge} disabled={busy}
                  className="w-full h-9 rounded-full border border-border text-sm text-black dark:text-white hover:border-[#2D6A4F]/40 disabled:opacity-60 transition-colors">
                  {busy ? "Withdrawing..." : "Withdraw challenge (revert to confirmed)"}
                </button>
                {!showDisputeChallengedForm ? (
                  <button type="button" onClick={() => setShowDisputeChallengedForm(true)}
                    disabled={busy || !canProceedToDispute}
                    title={!canProceedToDispute ? "Available once the claimant responds or the deadline passes" : undefined}
                    className="w-full h-9 rounded-full bg-red-600 hover:bg-red-700 text-white text-sm font-medium disabled:opacity-60 transition-colors">
                    Proceed to dispute
                  </button>
                ) : (
                  <div className="space-y-2">
                    <textarea placeholder="Reason for disputing" value={disputeReasonChallenged}
                      onChange={(e) => setDisputeReasonChallenged(e.target.value)} rows={2}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-transparent text-sm text-black dark:text-white resize-none" />
                    <button type="button" onClick={disputeFromChallenged} disabled={busy || !disputeReasonChallenged.trim()}
                      className="w-full h-9 rounded-full bg-red-600 hover:bg-red-700 text-white text-sm font-medium disabled:opacity-60 transition-colors">
                      {busy ? "Submitting..." : "Confirm dispute"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* DISPUTED: terminal display -- indicator reopens to awaiting-evidence, claimant can resubmit via ImpactClaimForm */}
        {claim.status === "disputed" && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-xs font-semibold text-red-800 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Disputed</p>
            <p className="text-sm text-red-800 mt-1">{claim.dispute_reason}</p>
          </div>
        )}

        <button type="button" onClick={onClose} disabled={busy}
          className="w-full h-10 rounded-full border border-border text-sm text-black dark:text-white hover:border-foreground/30 disabled:opacity-60 transition-colors">
          Close
        </button>
      </div>
    </div>
  );
}
