import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Loader2, Upload, Clock, CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";
import { PartnershipIndicator, isIndicatorAgreed, fetchIndicators } from "@/lib/indicators";
import { ImpactClaim, fetchClaimsForIndicators, latestClaimFor, claimStageFor, IndicatorClaimStage } from "@/lib/impactClaims";
import type { OrgRef } from "@/lib/milestones";
import ImpactClaimForm from "@/components/mou/ImpactClaimForm";
import ImpactClaimReview from "@/components/mou/ImpactClaimReview";
interface IndicatorsBoardProps {
  mouDocumentId: string;
  orgA: OrgRef | null;
  orgB: OrgRef | null;
  myUserId: string;
}
// Board columns track claim status, not agreement status -- agreement is
// resolved on the MoU document itself (Agree/Suggest refinement/Reject),
// so by the time an indicator reaches this board it's either already
// agreed, or it's a stale in-negotiation row with no actions available
// here. Unagreed indicators get a single link back to the document
// instead of their own column.
export default function IndicatorsBoard({ mouDocumentId, orgA, orgB, myUserId }: IndicatorsBoardProps) {
  const [loading, setLoading] = useState(true);
  const [indicators, setIndicators] = useState<PartnershipIndicator[]>([]);
  const [claims, setClaims] = useState<ImpactClaim[]>([]);
  const [claimFormIndicatorId, setClaimFormIndicatorId] = useState<string | null>(null);
  const [reviewingClaim, setReviewingClaim] = useState<ImpactClaim | null>(null);
  const myOrgId = orgA?.user_id === myUserId ? orgA.id : orgB?.user_id === myUserId ? orgB.id : null;
  async function loadAll() {
    setLoading(true);
    const indicatorRows = await fetchIndicators(mouDocumentId);
    setIndicators(indicatorRows);
    const agreedIds = indicatorRows.filter(isIndicatorAgreed).map((i) => i.id);
    const claimRows = await fetchClaimsForIndicators(agreedIds);
    setClaims(claimRows);
    setLoading(false);
  }
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const indicatorRows = await fetchIndicators(mouDocumentId);
      if (cancelled) return;
      setIndicators(indicatorRows);
      const agreedIds = indicatorRows.filter(isIndicatorAgreed).map((i) => i.id);
      const claimRows = await fetchClaimsForIndicators(agreedIds);
      if (cancelled) return;
      setClaims(claimRows);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [mouDocumentId]);
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 text-[#2D6A4F] animate-spin" />
      </div>
    );
  }
  if (indicators.length === 0) {
    return (
      <p className="text-xs text-black dark:text-white py-2">
        No indicators yet for this agreement.
      </p>
    );
  }
  const unagreedCount = indicators.filter((i) => !isIndicatorAgreed(i)).length;
  const agreedIndicators = indicators.filter(isIndicatorAgreed);
  const columns: { key: IndicatorClaimStage; label: string; icon: typeof Clock; border: string; headerBg: string; text: string }[] = [
    { key: "awaiting_evidence", label: "Awaiting evidence", icon: Upload, border: "border-amber-200 dark:border-amber-900/40", headerBg: "bg-amber-50 dark:bg-amber-950/20", text: "text-amber-600 dark:text-amber-500" },
    { key: "under_review", label: "Under review", icon: Clock, border: "border-border", headerBg: "bg-muted/30", text: "text-black dark:text-white" },
    { key: "verified", label: "Verified", icon: CheckCircle2, border: "border-[#2D6A4F]/20", headerBg: "bg-[#2D6A4F]/[0.06]", text: "text-[#2D6A4F]" },
    { key: "in_dispute", label: "In dispute", icon: AlertTriangle, border: "border-red-200 dark:border-red-900/40", headerBg: "bg-red-50 dark:bg-red-950/20", text: "text-red-600 dark:text-red-500" },
  ];
  return (
    <div className="space-y-3">
      {unagreedCount > 0 && (
        <Link href="/dashboard/portfolio/mou">
          <a className="flex items-center justify-between gap-2 rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 text-sm text-amber-700 dark:text-amber-500 hover:bg-amber-100 dark:hover:bg-amber-950/40 transition-colors">
            <span>{unagreedCount} indicator{unagreedCount > 1 ? "s" : ""} still need{unagreedCount === 1 ? "s" : ""} agreement -- resolve on the MoU document.</span>
            <ArrowRight className="w-3.5 h-3.5 shrink-0" />
          </a>
        </Link>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {columns.map((col) => {
          const Icon = col.icon;
          const colItems = agreedIndicators.filter((ind) => claimStageFor(latestClaimFor(ind.id, claims)) === col.key);
          return (
            <div key={col.key} className={`rounded-xl border ${col.border} overflow-hidden`}>
              <div className={`flex items-center gap-2 px-3 py-2.5 border-b ${col.border} ${col.headerBg}`}>
                <Icon className={`w-4 h-4 ${col.text}`} />
                <p className={`text-sm font-semibold ${col.text}`}>{col.label}</p>
                <span className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full border ${col.border} ${col.text} bg-white dark:bg-card`}>
                  {colItems.length}
                </span>
              </div>
              <div className="p-3 space-y-2 bg-white dark:bg-card min-h-[64px]">
                {colItems.length === 0 ? (
                  <p className="text-xs text-black dark:text-white">Nothing here.</p>
                ) : (
                  colItems.map((indicator) => {
                    const latest = latestClaimFor(indicator.id, claims);
                    const wasDisputed = latest?.status === "disputed";
                    const isClaimant = latest?.claiming_org_id === myOrgId;
                    return (
                      <div key={indicator.id} className="rounded-lg border border-border p-3 bg-white dark:bg-card space-y-2">
                        <div>
                          <p className="text-sm font-medium text-black dark:text-white">{indicator.name}</p>
                          <p className="text-xs text-black dark:text-white mt-0.5">
                            Target: {indicator.target_value} · {indicator.measurement_window}
                          </p>
                        </div>
                        {wasDisputed && (
                          <p className="text-xs text-red-600 dark:text-red-500">
                            Previous claim disputed: {latest?.dispute_reason}
                          </p>
                        )}
                        {col.key === "awaiting_evidence" && myOrgId && (
                          <button type="button" onClick={() => setClaimFormIndicatorId(indicator.id)}
                            className="text-xs font-semibold px-3 py-1.5 rounded-full bg-[#2D6A4F] hover:bg-[#245c43] text-white transition-colors">
                            {wasDisputed ? "Submit new claim" : "Submit claim"}
                          </button>
                        )}
                        {col.key === "under_review" && (
                          isClaimant ? (
                            <p className="text-xs text-black dark:text-white">Waiting for review.</p>
                          ) : (
                            <button type="button" onClick={() => latest && setReviewingClaim(latest)}
                              className="text-xs font-semibold px-3 py-1.5 rounded-full bg-[#2D6A4F] hover:bg-[#245c43] text-white transition-colors">
                              Review claim
                            </button>
                          )
                        )}
                        {(col.key === "verified" || col.key === "in_dispute") && (
                          <button type="button" onClick={() => latest && setReviewingClaim(latest)}
                            className="text-xs font-semibold px-3 py-1.5 rounded-full border border-border text-black dark:text-white hover:border-[#2D6A4F]/50 transition-colors">
                            {col.key === "verified" ? "View" : "Review"}
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
      {claimFormIndicatorId && myOrgId && (
        <ImpactClaimForm
          indicatorId={claimFormIndicatorId}
          claimingOrgId={myOrgId}
          onClose={() => setClaimFormIndicatorId(null)}
          onCreated={loadAll}
        />
      )}
      {reviewingClaim && myOrgId && (
        <ImpactClaimReview
          claim={reviewingClaim}
          viewerOrgId={myOrgId}
          orgA={orgA}
          orgB={orgB}
          myUserId={myUserId}
          onClose={() => setReviewingClaim(null)}
          onChanged={loadAll}
        />
      )}
    </div>
  );
}