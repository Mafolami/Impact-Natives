// Display gate is separate from the earning gate: submission already
// requires Plus (RLS on impact_claims_insert), but the score itself
// only displays while the org is CURRENTLY on Plus+ -- an org that
// earned a high score then downgraded stops showing it, even though
// the underlying computed value stays stored (recompute_impact_score
// keeps running regardless of tier, since it's cheap and the org may
// resubscribe). This mirrors the IMDb Pro pattern explicitly: the
// number exists, visibility doesn't.
const SCORE_VISIBLE_TIERS = ["plus", "pro", "compliance"];

export function canDisplayImpactScore(subscriptionTier: string | null | undefined): boolean {
  return !!subscriptionTier && SCORE_VISIBLE_TIERS.includes(subscriptionTier);
}

// For third-party viewers specifically (Natives card, Natives detail
// header, sort) -- combines the tier gate with the org's own visibility
// choice. canDisplayImpactScore alone only checks tier; it's still used
// on its own inside VerifiedOutcomesSection, where it's deliberately
// combined with isOwnOrg (the org always sees its own real score) --
// but every OTHER caller showing a score to someone who isn't the org
// itself needs both checks together, and every one of those call sites
// was missing the show_impact_score half until this fix.
export function canDisplayImpactScoreForOrg(
  subscriptionTier: string | null | undefined,
  showImpactScore: boolean | null | undefined
): boolean {
  return canDisplayImpactScore(subscriptionTier) && !!showImpactScore;
}

// Floors negative raw scores at 0 for display -- an org with more
// disputes than confirmations can have a negative stored value, but a
// visible negative number reads as broken, not as "low trust." Sorting
// should still use the raw value (see impactScoreForSort) so heavily-
// disputed orgs don't all collapse to an indistinguishable 0.
export function displayImpactScore(rawScore: number): number {
  return Math.max(rawScore, 0);
}

// Provisional bands -- there's no real claim data yet to calibrate
// against. Revisit once actual usage accumulates.
export type ImpactScoreTier = "bronze" | "silver" | "gold" | "platinum";

export function tierForScore(rawScore: number): ImpactScoreTier {
  const score = displayImpactScore(rawScore);
  if (score >= 30) return "platinum";
  if (score >= 15) return "gold";
  if (score >= 5) return "silver";
  return "bronze";
}

export const IMPACT_SCORE_TIER_STYLES: Record<ImpactScoreTier, { label: string; border: string; bg: string; text: string }> = {
  bronze:   { label: "Bronze",   border: "border-amber-800/30",  bg: "bg-amber-50 dark:bg-amber-950/20",   text: "text-amber-800 dark:text-amber-500" },
  silver:   { label: "Silver",   border: "border-indigo-400/30", bg: "bg-indigo-50 dark:bg-indigo-950/20", text: "text-indigo-600 dark:text-indigo-400" },
  gold:     { label: "Gold",     border: "border-amber-500/30",  bg: "bg-amber-50 dark:bg-amber-950/20",   text: "text-amber-600 dark:text-amber-400" },
  platinum: { label: "Platinum", border: "border-purple-500/30", bg: "bg-purple-50 dark:bg-purple-950/20", text: "text-purple-600 dark:text-purple-400" },
};

// Used for sorting the Natives directory by score: orgs whose score
// isn't currently displayable (below Plus, or downgraded) are pushed
// to the back rather than sorted by an invisible number -- otherwise
// a downgraded org with a historically high score could rank first
// with no visible reason why, which reads as broken.
export function impactScoreForSort(
  rawScore: number,
  subscriptionTier: string | null | undefined,
  showImpactScore: boolean | null | undefined
): number {
  return canDisplayImpactScoreForOrg(subscriptionTier, showImpactScore) ? displayImpactScore(rawScore) : -1;
}
