#!/usr/bin/env python3
"""
Fix 5: ImplementerMatches.tsx's own "paint from cache while loading" query
only filtered by org_id and fit_score >= 45. It never filtered by
submitting_listing_id, so it could grab any row scoring above 45 regardless
of source, including stale, unfiltered rows written by score-partnership-fit
(the directory's per-listing fit check, which still uses the org-level
mirror and has its own separate, larger problem not fixed here). The
backend (refresh-partnership-matches) already correctly filters to
submitting_listing_id in (this org's published listings) -- this brings
the frontend's own cache-paint query in line with that, so it can never
show something the backend itself would have excluded.

This does not fix score-partnership-fit. It only stops the Homepage's
own display query from being broader than what's actually correct.
"""

import sys
from pathlib import Path

SEARCH_ROOT = Path.home() / "Downloads"
TARGET_NAME = "ImplementerMatches.tsx"

OLD_QUERY = '''      const { data: cached } = await supabase
        .from("partnership_match_cache")
        .select("matched_org_id, matched_listing_id, fit_score, rationale, key_synergy, criteria, computed_at")
        .eq("org_id", orgId)
        .gte("fit_score", 45)
        .order("fit_score", { ascending: false })
        .limit(3);'''

NEW_QUERY = '''      // Fix 5: added .not("submitting_listing_id", "is", null) -- without
      // it, this query could grab any row above 45 regardless of source,
      // including stale rows written by score-partnership-fit's own,
      // separate, unfiltered path (directory listing clicks). The backend
      // (refresh-partnership-matches) already restricts its real results
      // to rows with a real submitting_listing_id; this brings the local
      // cache-paint query in line with that same restriction.
      const { data: cached } = await supabase
        .from("partnership_match_cache")
        .select("matched_org_id, matched_listing_id, fit_score, rationale, key_synergy, criteria, computed_at")
        .eq("org_id", orgId)
        .not("submitting_listing_id", "is", null)
        .gte("fit_score", 45)
        .order("fit_score", { ascending: false })
        .limit(3);'''


def main():
    matches = list(SEARCH_ROOT.rglob(TARGET_NAME))
    if not matches:
        print(f"No file named {TARGET_NAME} found under {SEARCH_ROOT}.")
        sys.exit(1)
    if len(matches) > 1:
        print(f"Found {len(matches)} copies of {TARGET_NAME}:")
        for m in matches:
            print(f"  {m}")
        print("Refusing to guess which one is live.")
        sys.exit(1)

    file_path = matches[0]
    content = file_path.read_text()

    if OLD_QUERY not in content:
        print("Could not find the expected query block. File may have changed since this script was written.")
        sys.exit(1)
    if content.count(OLD_QUERY) > 1:
        print("Found more than one match. Refusing to guess.")
        sys.exit(1)

    patched = content.replace(OLD_QUERY, NEW_QUERY)
    file_path.write_text(patched)
    print(f"Patched {file_path}")
    print()
    print("Next steps:")
    print('  cd "/Users/mac/Downloads/Impact Natives/Natives"')
    print("  npm run build")


if __name__ == "__main__":
    main()
