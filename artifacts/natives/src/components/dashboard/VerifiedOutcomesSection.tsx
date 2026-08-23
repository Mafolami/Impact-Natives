import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Loader2, CheckCircle2, AlertTriangle, Eye, EyeOff, Trophy } from "lucide-react";
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [outcomes, setOutcomes] = useState<VerifiedOutcome[]>([]);
  const [scoreRow, setScoreRow] = useState<OrgScoreRow | null>(null);
  const [savingToggle, setSavingToggle] = useState(false);
  const [noteVisible, setNoteVisible] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    Promise.all([
      supabase.rpc("get_verified_outcomes_for_org", { p_org_id: orgId }),
      supabase.from("organizations").select("impact_score, subscription_tier, show_impact_score").eq("id", orgId).single(),
    ]).then(([outcomesRes, orgRes]) => {
      if (cancelled) return;
      if (outcomesRes.error || orgRes.error) {
        setLoadError("Couldn't load verified outcomes. Try refreshing.");
        setLoading(false);
        return;
      }
      setOutcomes((outcomesRes.data as VerifiedOutcome[]) ?? []);
      setScoreRow((orgRes.data as OrgScoreRow) ?? null);
      setLoading(false);
    }).catch(() => {
      if (cancelled) return;
      setLoadError("Couldn't load verified outcomes. Try refreshing.");
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [orgId]);

  async function toggleShowScore() {
    if (!scoreRow) return;
    const next = !scoreRow.show_impact_score;
    setSavingToggle(true);
    setToggleError(null);
    const { error } = await supabase.from("organizations").update({ show_impact_score: next }).eq("id", orgId);
    setSavingToggle(false);
    if (error) {
      setToggleError("Couldn't update. Try again.");
      return;
    }
    setScoreRow((prev) => (prev ? { ...prev, show_impact_score: next } : prev));
  }

  // The toggle always looks and reads the same -- Public/Private, Eye
  // icon -- regardless of tier or permission. What changes is only what
  // clicking it DOES: an Owner on an eligible tier performs the real
  // write; everyone else gets an inline note explaining why, revealed
  // on click. Showing a different button (lock icon, "Upgrade" label)
  // for the ineligible case made the control itself look broken rather
  // than informative -- a consistent toggle that explains itself on
  // click reads better than a control that changes shape.
  function handleToggleClick() {
    if (isEligibleTier && canManage) {
      toggleShowScore();
      return;
    }
    setNoteVisible((v) => !v);
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

  const tier = scoreRow ? tierForScore(scoreRow.impact_score) : null;
  const tierStyles = tier ? IMPACT_SCORE_TIER_STYLES[tier] : null;

  const scoreBlock = shouldRenderScoreBlock && scoreRow && tierStyles && (
    <div className="space-y-1 mb-6">
      {isOwnOrg ? (
        <>
          <p className="text-xl font-bold text-[#111111] dark:text-[#F5F5F5]">
            Your Impact Score: {displayImpactScore(scoreRow.impact_score)}
          </p>
          <p className="text-sm font-medium text-black dark:text-white flex items-center gap-1.5">
            Tier: <span title={tierStyles.label}><Trophy className={`w-4 h-4 ${tierStyles.text}`} /></span>
          </p>
          <p className="text-xs text-black dark:text-white opacity-60">
            Reflects confirmed outcomes, partner diversity, and dispute history.
          </p>
          {noteVisible && (
            <p className="text-xs text-red-600 mt-1">
              {!isEligibleTier
                ? canManage
                  ? "Upgrade to Plus to show this on your public profile and in Natives."
                  : "Ask your organisation's owner to upgrade to Plus to make this public."
                : "Only the organisation owner can change this."}
            </p>
          )}
          {toggleError && <p className="text-xs text-red-600 mt-1">{toggleError}</p>}
        </>
      ) : (
        scoreVisibleToViewer && (
          <>
            <p className="text-xl font-bold text-[#111111] dark:text-[#F5F5F5]">
              Impact Score: {displayImpactScore(scoreRow.impact_score)}
            </p>
            <p className="text-sm font-medium text-black dark:text-white flex items-center gap-1.5">
              Tier: <span title={tierStyles.label}><Trophy className={`w-4 h-4 ${tierStyles.text}`} /></span>
            </p>
          </>
        )
      )}
    </div>
  );

  const toggleButton = isOwnOrg && shouldRenderScoreBlock && scoreRow && (
    <button type="button" onClick={handleToggleClick} disabled={savingToggle}
      className={`shrink-0 flex items-center gap-1.5 h-8 px-3 rounded-full border text-xs font-medium transition-colors disabled:opacity-50 ${
        isEligibleTier && scoreRow.show_impact_score
          ? "border-[#2D6A4F] bg-[#2D6A4F] text-white hover:bg-[#245c43]"
          : "border-border text-black dark:text-white hover:border-foreground/30"
      }`}>
      {savingToggle
        ? <Loader2 className="w-3 h-3 animate-spin" />
        : scoreRow.show_impact_score ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
      {scoreRow.show_impact_score ? "Public" : "Private"}
    </button>
  );

  const content = (
    <>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xl font-bold text-[#111111] dark:text-[#F5F5F5]">Verified outcomes</p>
        <div className="flex items-center gap-3">
          {!loading && outcomes.length > 0 && (
            <p className="text-xl font-bold text-[#111111] dark:text-[#F5F5F5]">
              {confirmedCount} confirmed{disputedCount > 0 ? ` · ${disputedCount} disputed` : ""}
            </p>
          )}
          {!loading && toggleButton}
        </div>
      </div>
      <p className="text-xs text-black dark:text-white opacity-60 mb-6">Platform-verified, not self-reported.</p>
      {loadError && <p className="text-sm text-red-600">{loadError}</p>}
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-black dark:text-white">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading verified outcomes...
        </div>
      ) : (
        <>
          {scoreBlock}
          {outcomes.length === 0 ? (
            <p className="text-sm text-black dark:text-white">No verified outcomes yet.</p>
          ) : (
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

  // Matches DeliveryStatsCard's own wrapper exactly (px-8 sm:px-12 py-10,
  // no self-imposed border) so the two sections align as one column
  // inside the shared SectionCardGroup -- the border between them comes
  // from SectionCardGroup's own divide-y, not from this component
  // adding a second border-t on top of it.
  if (variant === "page") {
    return <div className="rounded-xl border border-border bg-card px-5 py-4">{content}</div>;
  }
  return <div className="px-8 sm:px-12 py-10">{content}</div>;
}