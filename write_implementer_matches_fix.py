#!/usr/bin/env python3
"""
Writes the corrected ImplementerMatches.tsx: adds the 45-point fit_score
floor and drops the cache-paint limit from 5 to 3, matching the fix
already deployed backend-side (refresh-partnership-matches v20).

Searches under SEARCH_ROOT for the file instead of assuming a path --
we've hit two wrong-path guesses already. If it finds more than one copy,
it lists them and stops rather than guessing which is live.
"""

import sys
from pathlib import Path

SEARCH_ROOT = Path.home() / "Downloads"  # widen to Path.home() if this doesn't find it
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
// Fix: the "paint from cache" query below had no fit_score floor and
// capped at 5, not 3, so it could show single-pair "instant AI fit"
// lookups (no score floor, triggered by directory browsing) as if they
// were real Top 3 picks -- confirmed on Borderless Impact (showed 4
// matches including 30/40/40 scores under a "Top 3" label). Matches the
// same 45-point floor and 3-item limit already deployed server-side in
// refresh-partnership-matches v20.

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
      // Paint from cache first (if any) while the network call is in
      // flight -- same pattern as FunderHome's partnership section.
      // 45-point floor matches match-orgs-for-partnership's bulk-mode
      // inclusion threshold; single-pair "instant AI fit" lookups have no
      // such floor and would otherwise show up here as if they qualified.
      const { data: cached } = await supabase
        .from("partnership_match_cache")
        .select("matched_org_id, fit_score, rationale, key_synergy, criteria, computed_at")
        .eq("org_id", orgId)
        .gte("fit_score", 45)
        .order("fit_score", { ascending: false })
        .limit(3);

      if (cached && cached.length > 0 && !cancelled) {
        const orgIds = cached.map((m: any) => m.matched_org_id);
        const { data: orgs } = await supabase
          .from("organizations")
          .select("id, organisation_name, organisation_type, country, partnership_stage, partnership_budget, partnership_sought, needs")
          .in("id", orgIds);
        const orgMap = new Map((orgs ?? []).map((o: any) => [o.id, o]));
        if (!cancelled) {
          setMatches(cached.map((m: any) => ({ ...m, org: orgMap.get(m.matched_org_id) })));
          setState("ready");
        }
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { if (!cancelled) setState(cached?.length ? "ready" : "error"); return; }

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
        if (freshMatches.length === 0) { setState(matches.length > 0 ? "ready" : "empty"); return; }

        const orgIds = freshMatches.map((m: any) => m.matched_org_id);
        const { data: orgs } = await supabase
          .from("organizations")
          .select("id, organisation_name, organisation_type, country, partnership_stage, partnership_budget, partnership_sought, needs")
          .in("id", orgIds);
        const orgMap = new Map((orgs ?? []).map((o: any) => [o.id, o]));
        if (!cancelled) {
          setMatches(freshMatches.map((m: any) => ({ ...m, org: orgMap.get(m.matched_org_id) })));
          setState("ready");
        }
      } catch {
        if (!cancelled) setState(matches.length > 0 ? "ready" : "error");
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
        print('Edit SEARCH_ROOT near the top of this script (e.g. to Path.home()) and rerun.')
        sys.exit(1)
    if len(matches) > 1:
        print(f"Found {len(matches)} copies of {TARGET_NAME}:")
        for m in matches:
            print(f"  {m}")
        print("Refusing to guess which one is live. Tell me which path, or clean up the stale copies.")
        sys.exit(1)

    file_path = matches[0]
    current = file_path.read_text()
    if current == NEW_CONTENT:
        print(f"{file_path} already matches the fix. Nothing to do.")
        return

    file_path.write_text(NEW_CONTENT)
    print(f"Wrote fixed file to: {file_path}")
    print()
    print("Next steps (yours, not this script's):")
    print(f'  cd "{file_path.parent.parent.parent.parent}"   # or wherever your repo root is')
    print("  npm run build")
    print("  # paste the build output back to me")


if __name__ == "__main__":
    main()
