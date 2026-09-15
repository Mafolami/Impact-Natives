#!/usr/bin/env python3
"""
Two fixes to FindPartnerModalDashboard.tsx:

1. stepComplete() case 2 now also requires partnership_budget, matching
   stage's existing mandatory treatment. Verified against production data
   first: 0 listings currently have a null stage or null budget, so this
   formalizes what's already true rather than fixing broken data. Budget
   already has an "in_kind_only" option and an "open" option, so this
   doesn't exclude in-kind-only orgs, they just have to click one of the
   options already built for them instead of skipping the field.

2. submitAndMatch() now calls match-orgs-for-partnership with
   { submitting_listing_id: savedListingId } instead of
   { submitting_org: {...orgProfile, ...form, sector: form.sectors} }.
   The submitting side was already correct (live form data, no stale
   read), but the CANDIDATE side was still running through
   match-orgs-for-partnership's legacy org-scoped branch, which reads
   organizations.partnership_sought/stage/budget directly -- the same
   stale-mirror bug already fixed on Home. savedListingId is already
   in scope at this point in the function (set just above via
   setActiveListingId), so this puts Get Matched on the same
   listing-scoped, already-correct path Home uses.
"""

import sys
from pathlib import Path

SEARCH_ROOT = Path.home() / "Downloads"
TARGET_NAME = "FindPartnerModalDashboard.tsx"

OLD_STEP_COMPLETE = "    case 2: return form.country.length>0;"
NEW_STEP_COMPLETE = "    case 2: return form.country.length>0 && form.partnership_budget.length>0;"

OLD_MATCH_CALL = '''        body:JSON.stringify({submitting_org:{...orgProfile,...form,sector:form.sectors},user_id:user.id}),'''
NEW_MATCH_CALL = '''        body:JSON.stringify({submitting_listing_id:savedListingId}),'''


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

    if OLD_STEP_COMPLETE not in content:
        print("Could not find the expected stepComplete case 2 line. File may have changed since this script was written.")
        sys.exit(1)
    if content.count(OLD_STEP_COMPLETE) > 1:
        print("Found more than one match for the stepComplete line. Refusing to guess.")
        sys.exit(1)

    if OLD_MATCH_CALL not in content:
        print("Could not find the expected match-orgs-for-partnership body line. File may have changed since this script was written.")
        sys.exit(1)
    if content.count(OLD_MATCH_CALL) > 1:
        print("Found more than one match for the match-call body line. Refusing to guess.")
        sys.exit(1)

    patched = content.replace(OLD_STEP_COMPLETE, NEW_STEP_COMPLETE).replace(OLD_MATCH_CALL, NEW_MATCH_CALL)

    if patched == content:
        print("No changes made -- file already matches the fix?")
        return

    file_path.write_text(patched)
    print(f"Patched {file_path}")
    print()
    print("Next steps:")
    print('  cd "/Users/mac/Downloads/Impact Natives/Natives"')
    print("  npm run build")


if __name__ == "__main__":
    main()
