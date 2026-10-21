// src/lib/matchDd.ts
//
// Proportional due diligence on match cards (Oct 2026). The matching
// functions no longer lower a fit score for missing DD. Instead each match
// carries dd_status / dd_missing, judged against the size of that deal:
//   complete           -- meets the bar for this deal size ("DD documented")
//   exempt             -- solo consultancy, DD doesn't apply (no badge)
//   tier_missing       -- has the basics, missing this size's extras
//   basics_incomplete  -- missing registration, safeguarding or declaration
// Cards show a badge and sort by this tier first, then by fit score.
// Same ranking as dd.ts in the edge functions.

export type DdStatus = "complete" | "exempt" | "tier_missing" | "basics_incomplete";

const DD_RANK: Record<string, number> = { complete: 0, exempt: 0, tier_missing: 1, basics_incomplete: 2 };

// Rows with no status yet (older cache rows) rank after known tiers.
export function ddRank(status: string | null | undefined): number {
  return status && status in DD_RANK ? DD_RANK[status] : 3;
}

export function sortByTierThenScore<T extends Record<string, any>>(rows: T[], scoreKey: string): T[] {
  return [...rows].sort((a, b) => (ddRank(a.dd_status) - ddRank(b.dd_status)) || ((b[scoreKey] ?? 0) - (a[scoreKey] ?? 0)));
}

export const DD_ITEM_SHORT_LABELS: Record<string, string> = {
  financial_model: "Financial model",
  audited_accounts: "Audited accounts",
  governance_doc: "Governance document",
  esg_assessment: "ESG self-assessment",
  impact_framework: "Impact framework",
  environmental_policy: "Environmental policy",
  safeguarding_policy: "Safeguarding policy",
  legal_registration: "Legal registration",
  legal_compliance_declaration: "Compliance declaration",
  disbursement_track_record: "Disbursement track record",
  decision_transparency: "Decision transparency",
  conflict_disclosure: "Conflict disclosure",
  esg_framework: "ESG framework",
};

export const DD_BADGES: Record<string, { label: string; color: string; background: string }> = {
  complete: { label: "DD documented", color: "#2D6A4F", background: "rgba(45,106,79,0.12)" },
  tier_missing: { label: "Some DD documents missing", color: "#b45309", background: "rgba(180,83,9,0.12)" },
  basics_incomplete: { label: "DD basics incomplete", color: "#b91c1c", background: "rgba(185,28,28,0.10)" },
};

export const DD_BADGE_NOTE = "Provided by the organisation. View documents on their profile.";

export function ddBadgeTitle(missing: string[] | null | undefined): string {
  const items = (missing ?? []).map((k) => DD_ITEM_SHORT_LABELS[k] ?? k);
  if (items.length === 0) return DD_BADGE_NOTE;
  const shown = items.slice(0, 4).join(", ") + (items.length > 4 ? ` and ${items.length - 4} more` : "");
  return `${DD_BADGE_NOTE} Missing for this deal size: ${shown}.`;
}

export const SUPPORT_TYPE_LABELS: Record<string, string> = {
  funding: "Funding",
  technical: "Technical",
  operational: "Operational",
  leadership: "Leadership",
  strategic: "Strategic",
  lead: "Lead partner",
  research: "Research",
};

export function supportTypesText(types: unknown): string {
  const list = Array.isArray(types) ? types.filter(Boolean) : [];
  return list.map((t) => SUPPORT_TYPE_LABELS[String(t)] ?? String(t)).join(", ");
}
