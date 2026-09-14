import { supabase } from "@/lib/supabase";

export interface MouTitleOrgRef {
  id: string;
  partnership_sought?: string | null;
}

export interface MouTitleDocRef {
  initiative_id: string | null;
  connection_id?: string | null;
  org_a_id: string;
}

export interface MouTitleListingRef {
  sought?: string | null;
  title?: string | null;
}

// Initiative-based MoUs have a real title. Connection-based MoUs almost
// never have partnership_title populated (no write path sets it), so the
// fallback used to be the listing owner's (org_a's) own partnership_sought
// text -- correct when an org could only ever have one listing, but wrong
// now that an org can have several: that field only ever reflects
// whichever listing was saved most recently, not necessarily the specific
// listing this particular MoU was actually about.
//
// connectionListingMap (optional, keyed by connection_id -> the specific
// partnership_listings row via that connection's receiver_listing_id) is
// checked FIRST when present. Falls back to the old org-level behavior
// when absent, so any caller not yet updated to fetch it keeps working
// exactly as before, just with the same known imprecision as before.
//
// Shared between MouTab.tsx and DashboardPortfolioMilestones.tsx so the
// two pages never drift on how they resolve the same document's title.
export function resolveMouDocTitle(
  doc: MouTitleDocRef,
  orgMap: Record<string, MouTitleOrgRef | undefined>,
  initiativeTitleMap: Record<string, string>,
  connectionListingMap?: Record<string, MouTitleListingRef | undefined>
): string | null {
  if (doc.initiative_id) return initiativeTitleMap[doc.initiative_id] ?? null;
  if (doc.connection_id) {
    const listing = connectionListingMap?.[doc.connection_id];
    if (listing?.sought) return listing.sought;
    if (listing?.title) return listing.title;
    return orgMap[doc.org_a_id]?.partnership_sought ?? null;
  }
  return null;
} 
// Shared fetch for the connectionListingMap resolveMouDocTitle above
// accepts. Resolves connection_id -> its receiver_listing_id -> that
// specific partnership_listings row's sought/title, in one place so the
// four consumers of resolveMouDocTitle (MouTab.tsx,
// DashboardPortfolioMilestones.tsx, MouDocumentDetail.tsx,
// DashboardPortfolioTrackRecord.tsx) don't each duplicate this fetch and
// risk drifting. .filter(Boolean) on listingIds matters -- a connection
// with no receiver_listing_id (made before that column existed) must not
// end up as a literal "null" in the next query's .in("id", [...]) list,
// which would reject the entire batch (confirmed real bug elsewhere in
// this codebase from the exact same mistake).
export async function buildConnectionListingMap(
  connectionIds: string[]
): Promise<Record<string, MouTitleListingRef | undefined>> {
  const uniqueIds = [...new Set(connectionIds)].filter(Boolean);
  if (uniqueIds.length === 0) return {};

  const { data: conns } = await supabase
    .from("partnership_connections")
    .select("id, receiver_listing_id")
    .in("id", uniqueIds);

  const listingIds = [...new Set((conns ?? []).map((c: any) => c.receiver_listing_id))].filter(Boolean);
  if (listingIds.length === 0) return {};

  const { data: listings } = await supabase
    .from("partnership_listings")
    .select("id, sought, title")
    .in("id", listingIds);
  const listingById = new Map((listings ?? []).map((l: any) => [l.id, l]));

  const map: Record<string, MouTitleListingRef | undefined> = {};
  for (const c of conns ?? []) {
    if (c.receiver_listing_id) map[c.id] = listingById.get(c.receiver_listing_id);
  }
  return map;
}
