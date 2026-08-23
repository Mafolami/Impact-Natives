import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Loader2, CheckCircle2, AlertTriangle, Eye, EyeOff } from "lucide-react";
import { canDisplayImpactScore, displayImpactScore, tierForScore, IMPACT_SCORE_TIER_STYLES } from "@/lib/impactScore";

interface VerifiedOutcome {
  claim_id: string;
  indicator_name: string;
  claimed_value: string;
  target_value: string;
  status: "confirmed" | "disputed";
  confirmed_at: string | null;
  disputed_at: string | null;
  dispute_reason: string | null;
  partner_org_name: string;
  mou_document_id: string;
}

interface OrgScoreRow {
  impact_score: number;
  subscription_tier: string | null;
  show_impact_score: boolean;
}

// isOwnOrg drives everything about the score block: the org viewing its
// own profile always sees its real score regardless of tier (that's the
// upgrade motivator for Free orgs) and gets a toggle (Plus+) or an
// upgrade prompt (Free) in place of it. Anyone else only sees the score
// if it's both tier-eligible AND the org has chosen to show it --
// respects the org's own choice, not just the platform's tier gate.
export default function VerifiedOutcomesSection({
  orgId, variant = "panel", isOwnOrg = false, canManage = isOwnOrg,
}: { orgId: string; variant?: "panel" | "page"; isOwnOrg?: boolean; canManage?: boolean }) {
  const [loading, setLoading] = useState(true);
  const [outcomes, setOutcomes] = useState<VerifiedOutcome[]>([]);
  const [scoreRow, setScoreRow] = useState<OrgScoreRow | null>(null);
  const [savingToggle, setSavingToggle] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      supabase.rpc("get_verified_outcomes_for_org", { p_org_id: orgId }),
      supabase.from("organizations").select("impact_score, subscription_tier, show_impact_score").eq("id", orgId).single(),
    ]).then(([outcomesRes, orgRes]) => {
      if (cancelled) return;
      setOutcomes((outcomesRes.data as VerifiedOutcome[]) ?? []);
      setScoreRow((orgRes.data as OrgScoreRow) ?? null);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [orgId]);

  async function toggleShowScore() {
    if (!scoreRow) return;
    const next = !scoreRow.show_impact_score;
    setSavingToggle(true);
    const { error } = await supabase.from("organizations").update({ show_impact_score: next }).eq("id", orgId);
    setSavingToggle(false);
    if (!error) setScoreRow((prev) => (prev ? { ...prev, show_impact_score: next } : prev));
  }

  const isEligibleTier = canDisplayImpactScore(scoreRow?.subscription_tier);
  const scoreVisibleToViewer = isOwnOrg || (isEligibleTier && !!scoreRow?.show_impact_score);

  // Nothing to show yet -- distinct from "still loading," but neither
  // state should push the surrounding profile layout around, so this
  // renders nothing rather than an empty-state card. A profile with no
  // verified outcomes yet shouldn't read as broken or incomplete --
  // most orgs won't have any until partnerships mature. The score block
  // is exempt from this early-return when it's the org's own view,
  // since an own-profile Free-tier org should still see the upgrade
  // prompt even with zero outcomes yet.
  if (!loading && outcomes.length === 0 && !isOwnOrg) return null;

  const confirmedCount = outcomes.filter((o) => o.status === "confirmed").length;
  const disputedCount = outcomes.filter((o) => o.status === "disputed").length;

  const shouldRenderScoreBlock = !!scoreRow && (isOwnOrg || scoreVisibleToViewer);

  const scoreBlock = shouldRenderScoreBlock && scoreRow && (
    <div className="rounded-xl border border-border px-4 py-3 mb-3">
      {isOwnOrg ? (
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-black dark:text-white">
              Your Impact Score: {displayImpactScore(scoreRow.impact_score)}
              <span className={`ml-2 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-full border ${IMPACT_SCORE_TIER_STYLES[tierForScore(scoreRow.impact_score)].border} ${IMPACT_SCORE_TIER_STYLES[tierForScore(scoreRow.impact_score)].bg} ${IMPACT_SCORE_TIER_STYLES[tierForScore(scoreRow.impact_score)].text}`}>
                {IMPACT_SCORE_TIER_STYLES[tierForScore(scoreRow.impact_score)].label}
              </span>
            </p>
            <p className="text-[11px] text-black dark:text-white mt-1">
              {isEligibleTier
                ? "Reflects confirmed outcomes, partner diversity, and dispute history."
                : canManage
                  ? "Upgrade to Plus to show this on your public profile and in Natives."
                  : "Ask your organisation's owner to upgrade to Plus to make this public."}
            </p>
          </div>
          {isEligibleTier && canManage && (
            <button type="button" onClick={toggleShowScore} disabled={savingToggle}
              className={`shrink-0 flex items-center gap-1.5 h-8 px-3 rounded-full border text-xs font-medium transition-colors disabled:opacity-50 ${
                scoreRow.show_impact_score ? "border-[#2D6A4F] bg-[#2D6A4F] text-white" : "border-border text-black dark:text-white"
              }`}>
              {savingToggle ? <Loader2 className="w-3 h-3 animate-spin" /> : scoreRow.show_impact_score ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              {scoreRow.show_impact_score ? "Public" : "Private"}
            </button>
          )}
        </div>
      ) : (
        scoreVisibleToViewer && (
          <p className="text-xs font-bold text-black dark:text-white">
            Impact Score: {displayImpactScore(scoreRow.impact_score)}
            <span className={`ml-2 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-full border ${IMPACT_SCORE_TIER_STYLES[tierForScore(scoreRow.impact_score)].border} ${IMPACT_SCORE_TIER_STYLES[tierForScore(scoreRow.impact_score)].bg} ${IMPACT_SCORE_TIER_STYLES[tierForScore(scoreRow.impact_score)].text}`}>
              {IMPACT_SCORE_TIER_STYLES[tierForScore(scoreRow.impact_score)].label}
            </span>
          </p>
        )
      )}
    </div>
  );

  const content = (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-black dark:text-white">Verified outcomes</p>
        {!loading && outcomes.length > 0 && (
          <span className="text-xs font-bold" style={{ color: confirmedCount > 0 ? "#065F46" : "#92400E" }}>
            {confirmedCount} confirmed{disputedCount > 0 ? ` · ${disputedCount} disputed` : ""}
          </span>
        )}
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-black dark:text-white">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading verified outcomes...
        </div>
      ) : (
        <>
          {scoreBlock}
          {outcomes.length > 0 && (
            <div className="space-y-2.5">
              {outcomes.map((o) => (
                <div key={o.claim_id} className={`rounded-xl border px-4 py-3 ${
                  o.status === "confirmed" ? "border-[#2D6A4F]/20 bg-[#2D6A4F]/[0.04]" : "border-red-200 bg-red-50 dark:bg-red-950/10"
                }`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{o.indicator_name}</p>
                      <p className="text-xs font-medium text-foreground mt-1">Result: {o.claimed_value} (target: {o.target_value})</p>
                      <p className="text-[11px] text-black dark:text-white mt-1.5">
                        Verified by {o.partner_org_name}
                        {o.confirmed_at && ` · ${new Date(o.confirmed_at).toLocaleDateString("en-GB")}`}
                      </p>
                      {o.status === "disputed" && o.dispute_reason && (
                        <p className="text-xs text-red-700 dark:text-red-400 mt-1.5">Disputed: {o.dispute_reason}</p>
                      )}
                    </div>
                    {o.status === "confirmed" ? (
                      <CheckCircle2 className="w-4 h-4 text-[#2D6A4F] shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );

  // Matches the Section wrapper used for the page variant's DD readiness
  // block, and the plain px-8 py-6 div used in the panel variant's --
  // this component doesn't own its own wrapper choice, it takes whichever
  // container convention the calling section already uses.
  if (variant === "page") {
    return <div className="rounded-xl border border-border bg-card px-5 py-4">{content}</div>;
  }
  return <div className="px-8 py-6 border-t border-border">{content}</div>;
}