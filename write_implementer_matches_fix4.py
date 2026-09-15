#!/usr/bin/env python3
"""
Fix 4: adds the 6th criteria row, Budget, to ImplementerMatches.tsx's match
card. match-orgs-for-partnership v38+ now computes budget_fit deterministically
(bucket-adjacency comparison, never asked of the AI) and includes it in every
match's criteria object alongside the original five. The card was still only
rendering five rows and silently dropping budget_fit from display.
"""

import sys
from pathlib import Path

SEARCH_ROOT = Path.home() / "Downloads"
TARGET_NAME = "ImplementerMatches.tsx"

NEW_CONTENT = '''// src/components/platform/ImplementerMatches.tsx
//
// AI-matched funders/corporates for implementer (NGO/social enterprise)
// homepages. Mirrors the partnership-match section already shipping in
// DashboardFunderHome.tsx / DashboardCorporateHome.tsx -- same card layout,
// same fit-score coloring, same criteria-breakdown rows -- since
// match-orgs-for-partnership and its two wrapper functions
// (refresh-partnership-matches / refresh-partnership-matches-for-org) were
// already fully type-agnostic; implementers were only ever blocked by an
// artificial org_type gate on those two wrappers (removed in this same
// change).
//
// Unlike on a funder/corporate homepage, where this section is secondary
// to initiative matching, this IS the primary AI feature for an
// implementer -- there is no implementer-side initiative matching (an NGO
// submits initiatives, it doesn't consume them), so partnership matching
// is the whole story. Rendered at the top of the implementer branch in
// DashboardHome.tsx, above the existing metrics/getting-started content.
//
// Deliberately does NOT duplicate implementerCompleteness() client-side
// the way FunderHome/CorporateHome duplicate their own completeness
// formulas for instant first paint -- that duplication exists there so a
// number can render before the network round trip completes, but it's a
// second copy of the same weights that has to be kept in sync by hand
// (see the comment on it in refresh-partnership-matches). This component
// skips that entirely and treats the server's response as the only source
// of truth: skeleton while loading, then whatever the server actually
// says. One fewer place for the two formulas to silently drift apart.
//
// Fix 1: the "paint from cache" query had no fit_score floor and capped at
// 5, not 3, so it could show single-pair "instant AI fit" lookups as if
// they were real Top 3 picks. Matches the 45-point floor and 3-item limit
// deployed server-side in refresh-partnership-matches v20.
//
// Fix 2: the "no fresh matches" branch used to check `matches.length > 0`
// (React state) through a stale closure captured before the cache-paint
// setMatches() call updated it, so a valid cache-painted match could flip
// to "No matches yet" once the network response arrived. Fixed by tracking
// painted matches in a plain local variable instead.
//
// Fix 3: the matched org's display card was built entirely from
// organizations.partnership_sought / partnership_stage / partnership_budget
// -- the legacy, org-wide mirrored fields that only ever reflect whichever
// listing was saved most recently. Now fetches the actual matched_listing_id
// the backend returns and shows that specific listing's own sought/stage/
// budget/needs instead. organisation_name/organisation_type/country still
// come from organizations -- those are genuinely org-level.
//
// Fix 4: match-orgs-for-partnership v38+ added a sixth criterion,
// budget_fit, computed deterministically (bucket-adjacency comparison,
// never asked of the AI) alongside the original five AI-judged criteria.
// The card was still only rendering five rows and silently dropping it.
// Added as its own row, "Budget", between Need/offer and Style.

import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { Sparkles, Building2 } from "lucide-react";

const PARTNERSHIP_STAGE_LABELS: Record<string, string> = {
  concept: "Co-design from scratch",
  joining_running: "Join something running",
  pilot: "Pilot phase",
  scaling: "Scaling existing work",
};
const PARTNERSHIP_BUDGET_LABELS: Record<string, string> = {
  under_10k: "Under $10K",
  "10k_50k": "$10K–$50K",
  "50k_200k": "$50K–$200K",
  over_200k: "Over $200K",
  in_kind_only: "In-kind only",
  open: "Open to discussion",
};

function parsePgArray(val: any): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    if (val.startsWith("{") && val.endsWith("}")) {
      return val.slice(1, -1).split(",").map(s => s.trim().replace(/^"|"$/g, "")).filter(Boolean);
    }
    if (val.startsWith("[")) {
      try { const parsed = JSON.parse(val); return Array.isArray(parsed) ? parsed : [val]; }
      catch { return [val]; }
    }
    return [val];
  }
  return [];
}

// Merges a matched org's identity fields (organizations) with its
// SPECIFIC matched listing's own ask fields (partnership_listings) --
// see Fix 3 above. Falls back to the org row alone (no listing-specific
// display fields) if matched_listing_id is missing for any reason, rather
// than throwing.
function mergeOrgAndListing(org: any, listing: any | undefined) {
  if (!org) return org;
  return {
    id: org.id,
    organisation_name: org.organisation_name,
    organisation_type: org.organisation_type,
    country: org.country,
    partnership_sought: listing?.sought,
    partnership_stage: listing?.stage,
    partnership_budget: listing?.budget,
    needs: listing?.needs,
  };
}

async function fetchOrgAndListingMaps(matches: any[]) {
  const orgIds = [...new Set(matches.map((m: any) => m.matched_org_id).filter(Boolean))];
  const listingIds = [...new Set(matches.map((m: any) => m.matched_listing_id).filter(Boolean))];

  const [{ data: orgs }, { data: listings }] = await Promise.all([
    supabase.from("organizations").select("id, organisation_name, organisation_type, country").in("id", orgIds),
    listingIds.length
      ? supabase.from("partnership_listings").select("id, sought, stage, budget, needs").in("id", listingIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  return {
    orgMap: new Map((orgs ?? []).map((o: any) => [o.id, o])),
    listingMap: new Map((listings ?? []).map((l: any) => [l.id, l])),
  };
}

type MatchState = "loading" | "locked_free" | "locked_incomplete" | "empty" | "ready" | "error";

export default function ImplementerMatches({ orgId }: { orgId: string | null }) {
  const [, navigate] = useLocation();
  const [state, setState] = useState<MatchState>("loading");
  const [completeness, setCompleteness] = useState(0);
  const [matches, setMatches] = useState<any[]>([]);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;

    (async () => {
      // Tracks what we've actually painted to the screen so far, checked
      // as a plain local variable rather than React state -- state reads
      // inside this closure would be stale (captured at effect-start,
      // before any setMatches() call below has a chance to land).
      let paintedMatches: any[] = [];

      // Paint from cache first (if any) while the network call is in
      // flight -- same pattern as FunderHome's partnership section.
      // 45-point floor matches match-orgs-for-partnership's bulk-mode
      // inclusion threshold; single-pair "instant AI fit" lookups have no
      // such floor and would otherwise show up here as if they qualified.
      const { data: cached } = await supabase
        .from("partnership_match_cache")
        .select("matched_org_id, matched_listing_id, fit_score, rationale, key_synergy, criteria, computed_at")
        .eq("org_id", orgId)
        .gte("fit_score", 45)
        .order("fit_score", { ascending: false })
        .limit(3);

      if (cached && cached.length > 0 && !cancelled) {
        const { orgMap, listingMap } = await fetchOrgAndListingMaps(cached);
        if (!cancelled) {
          paintedMatches = cached.map((m: any) => ({
            ...m,
            org: mergeOrgAndListing(orgMap.get(m.matched_org_id), listingMap.get(m.matched_listing_id)),
          }));
          setMatches(paintedMatches);
          setState("ready");
        }
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { if (!cancelled) setState(paintedMatches.length > 0 ? "ready" : "error"); return; }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/refresh-partnership-matches`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
        });
        const result = await res.json();
        if (cancelled) return;

        if (typeof result?.completeness === "number") setCompleteness(result.completeness);

        if (result?.reason === "requires_upgrade") { setState("locked_free"); return; }
        if (result?.eligible === false) { setState("locked_incomplete"); return; }

        const freshMatches = result?.matches ?? [];
        if (freshMatches.length === 0) { setState(paintedMatches.length > 0 ? "ready" : "empty"); return; }

        const { orgMap, listingMap } = await fetchOrgAndListingMaps(freshMatches);
        if (!cancelled) {
          setMatches(freshMatches.map((m: any) => ({
            ...m,
            org: mergeOrgAndListing(orgMap.get(m.matched_org_id), listingMap.get(m.matched_listing_id)),
          })));
          setState("ready");
        }
      } catch {
        if (!cancelled) setState(paintedMatches.length > 0 ? "ready" : "error");
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  if (state === "error") return null; // fail quiet -- rest of the homepage still works

  return (
    <section className="rounded-2xl bg-muted/30 border border-border p-4">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h3 className="inline-flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
            style={{ background: "#C45C26", color: "#ffffff" }}>
            <Building2 className="w-3.5 h-3.5" /> Partnership matches
          </h3>
          <p className="text-[13px] text-black dark:text-white mt-1">Top 3 organisations to partner with</p>
        </div>
        {state === "ready" && matches.length > 0 && (
          <button type="button" onClick={() => navigate("/dashboard/partnerships")}
            className="text-[13px] font-semibold text-[#2D6A4F] border border-[#2D6A4F]/30 rounded-full px-3 py-1.5 hover:bg-[#2D6A4F]/10 transition-colors shrink-0">
            View all
          </button>
        )}
      </div>

      {state === "loading" ? (
        <div className="space-y-2">
          {[1, 2].map(i => <div key={i} className="h-16 rounded-xl border border-border bg-white dark:bg-card animate-pulse" />)}
        </div>
      ) : state === "locked_incomplete" ? (
        <div className="rounded-xl border border-dashed border-border bg-white dark:bg-card p-6 text-center flex flex-col items-center justify-center min-h-[220px]">
          <Building2 className="w-6 h-6 text-muted-foreground/20 mb-3" />
          <p className="text-[13px] font-medium text-black dark:text-white mb-1">Unlocks at 80% profile completion</p>
          <p className="text-[13px] text-black dark:text-white mb-3">You're at {completeness}%. Add your description, sectors, needs and offers to unlock matches.</p>
          <button type="button" onClick={() => navigate("/dashboard/profile")}
            className="text-[13px] font-semibold text-white bg-[#2D6A4F] rounded-full px-4 py-1.5 hover:bg-[#245c43] transition-colors">
            Complete profile
          </button>
        </div>
      ) : state === "locked_free" ? (
        <div className="rounded-xl border border-border bg-white dark:bg-card p-6 text-center flex flex-col items-center justify-center min-h-[220px]">
          <Sparkles className="w-6 h-6 text-[#2D6A4F]/40 mb-3" />
          <p className="text-[13px] font-medium text-black dark:text-white mb-1">AI-matched partners need an upgrade</p>
          <p className="text-[13px] text-black dark:text-white mb-3">Upgrade to Plus to see funders and corporates matched to your organisation.</p>
          <button type="button" onClick={() => navigate("/dashboard/settings?tab=billing")}
            className="text-[13px] font-semibold text-white bg-[#2D6A4F] rounded-full px-4 py-1.5 hover:bg-[#245c43] transition-colors">
            Upgrade
          </button>
        </div>
      ) : state === "empty" ? (
        <div className="rounded-xl border border-border bg-white dark:bg-card p-5 text-center">
          <p className="text-[13px] text-black dark:text-white">No matches yet. Check back soon.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {matches.map((m: any) => (
            <button key={m.matched_org_id} type="button"
              onClick={() => navigate(`/dashboard/partnerships?org=${m.org?.id ?? ""}`)}
              className="w-full text-left rounded-xl border border-border bg-white dark:bg-card px-4 py-3 hover:border-[#2D6A4F]/30 transition-colors group flex flex-col min-h-[220px]">
              <p className="text-[15px] font-semibold text-black dark:text-white group-hover:text-[#2D6A4F] transition-colors break-words mb-1">
                {m.org?.organisation_name ?? "Organisation"}
              </p>
              <p className="text-[13px] text-black dark:text-white break-words mb-2">
                Seeking {m.org?.partnership_sought || (m.org?.needs?.length ? m.org.needs.join(", ") : "a partnership")}
              </p>
              <span className="inline-flex w-fit text-[13px] font-bold px-2 py-0.5 rounded-full mb-2"
                style={{
                  background: m.fit_score >= 70 ? "rgba(45,106,79,0.12)" : m.fit_score >= 40 ? "rgba(180,83,9,0.12)" : "rgba(239,68,68,0.12)",
                  color: m.fit_score >= 70 ? "#2D6A4F" : m.fit_score >= 40 ? "#b45309" : "#ef4444",
                }}>
                {m.fit_score}% fit
              </span>
              {m.criteria ? (
                <div className="flex flex-col gap-1 mb-2">
                  {[
                    ["sector_fit", "Sector"], ["geography_fit", "Geography"], ["need_offer_fit", "Need/offer"],
                    ["budget_fit", "Budget"],
                    ["working_style_fit", "Style"], ["stage_readiness_fit", "Stage"],
                  ].map(([key, label]) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className="text-[13px] text-black dark:text-white">{label}</span>
                      <span className="text-[13px] font-medium" style={{
                        color: m.criteria[key] === "match" ? "#2D6A4F" : m.criteria[key] === "partial" ? "#F59E0B" : "#EF4444",
                      }}>
                        {m.criteria[key] === "match" ? "✓ match" : m.criteria[key] === "partial" ? "● partial" : "✕ no match"}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[15px] text-black dark:text-white mb-2">{m.key_synergy ?? m.rationale}</p>
              )}
              <div className="mt-auto pt-2 flex items-center gap-2 flex-wrap">
                {m.org?.partnership_stage && (
                  <span className="text-[13px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(45,106,79,0.12)", color: "#2D6A4F" }}>
                    {PARTNERSHIP_STAGE_LABELS[m.org.partnership_stage] ?? m.org.partnership_stage}
                  </span>
                )}
                {m.org?.partnership_budget && (
                  <span className="text-[13px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(196,92,38,0.1)", color: "#C45C26" }}>
                    {PARTNERSHIP_BUDGET_LABELS[m.org.partnership_budget] ?? m.org.partnership_budget}
                  </span>
                )}
                {parsePgArray(m.org?.country).length > 0 && (
                  <span className="text-[13px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(24,95,165,0.12)", color: "#185FA5" }}>
                    {parsePgArray(m.org?.country)[0]}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
'''


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
    current = file_path.read_text()
    if current == NEW_CONTENT:
        print(f"{file_path} already matches the fix. Nothing to do.")
        return

    file_path.write_text(NEW_CONTENT)
    print(f"Wrote fixed file to: {file_path}")
    print()
    print("Next steps:")
    print('  cd "/Users/mac/Downloads/Impact Natives/Natives"')
    print("  npm run build")


if __name__ == "__main__":
    main()
