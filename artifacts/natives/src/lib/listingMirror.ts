import { supabase } from "@/lib/supabase";

// The org-level organizations.partnership_sought/title/stage/budget/
// decision_timeline/funding_status/listed columns are a legacy mirror of
// whichever listing was most recently saved in partnership_listings. The
// mirror write only succeeds for the org OWNER -- organizations' UPDATE
// RLS has no team-member clause, so it silently writes zero rows for
// anyone else, leaving these columns stale the moment a team member
// edits or creates a listing. This helper reads the real, current data
// straight from partnership_listings instead, so callers don't depend
// on that mirror at all.
//
// If an org has more than one published listing, this returns whichever
// was most recently UPDATED (not just created) -- see the updated_at
// column + trigger added to partnership_listings alongside this fix.

export interface ListingMirrorFields {
  partnership_listed: boolean;
  partnership_title: string | null;
  partnership_sought: string | null;
  partnership_stage: string | null;
  partnership_budget: string | null;
  partnership_decision_timeline: string | null;
  partnership_funding_status: string | null;
}

export const EMPTY_LISTING_MIRROR: ListingMirrorFields = {
  partnership_listed: false,
  partnership_title: null,
  partnership_sought: null,
  partnership_stage: null,
  partnership_budget: null,
  partnership_decision_timeline: null,
  partnership_funding_status: null,
};

/**
 * Fetches, for each given user_id (an org's owner id), that org's most
 * recently updated published listing, shaped with the same field names
 * the legacy organizations.partnership_* mirror used -- so callers can
 * spread the result over an org row without touching any downstream
 * rendering code.
 */
export async function fetchLatestListingMirror(
  userIds: string[]
): Promise<Map<string, ListingMirrorFields>> {
  const map = new Map<string, ListingMirrorFields>();
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return map;

  const { data, error } = await supabase
    .from("partnership_listings")
    .select("user_id,title,sought,stage,budget,decision_timeline,funding_status,updated_at")
    .in("user_id", ids)
    .eq("status", "published")
    .order("updated_at", { ascending: false });

  if (error || !data) return map;

  for (const row of data) {
    // Rows arrive sorted updated_at desc, so the first one seen per
    // user_id is that org's most recently updated published listing --
    // skip any further rows for a user_id already recorded.
    if (map.has(row.user_id)) continue;
    map.set(row.user_id, {
      partnership_listed: true,
      partnership_title: row.title ?? null,
      partnership_sought: row.sought ?? null,
      partnership_stage: row.stage ?? null,
      partnership_budget: row.budget ?? null,
      partnership_decision_timeline: row.decision_timeline ?? null,
      partnership_funding_status: row.funding_status ?? null,
    });
  }

  return map;
}
