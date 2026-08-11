export interface MouTitleOrgRef {
  id: string;
  partnership_sought?: string | null;
}

export interface MouTitleDocRef {
  initiative_id: string | null;
  connection_id?: string | null;
  org_a_id: string;
}

// Initiative-based MoUs have a real title. Connection-based MoUs almost
// never have partnership_title populated (no write path sets it), so the
// fallback is the listing owner's (org_a's) own partnership_sought text.
// Shared between MouTab.tsx and DashboardPortfolioMilestones.tsx so the
// two pages never drift on how they resolve the same document's title.
export function resolveMouDocTitle(
  doc: MouTitleDocRef,
  orgMap: Record<string, MouTitleOrgRef | undefined>,
  initiativeTitleMap: Record<string, string>
): string | null {
  if (doc.initiative_id) return initiativeTitleMap[doc.initiative_id] ?? null;
  if (doc.connection_id) return orgMap[doc.org_a_id]?.partnership_sought ?? null;
  return null;
}