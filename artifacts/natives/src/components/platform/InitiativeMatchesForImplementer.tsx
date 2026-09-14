// src/components/platform/InitiativeMatchesForImplementer.tsx
//
// Peer-to-peer initiative matches for implementer homepages -- an NGO/
// social enterprise's own profile scored against OTHER orgs' posted
// initiatives (initiative_requests), via refresh-initiative-matches and
// the match-initiatives-for-implementer engine.
//
// v2: card markup rebuilt to match DashboardFunderHome.tsx's initiative
// cards exactly (full-width stacked divs, not a 2-column grid -- a single
// match was leaving an awkward empty half of the row; inline score badge
// next to the title instead of below it; a criteria match/partial/no_match
// checklist instead of a prose match_reason paragraph; a submitter-org
// link with a building icon, same as FunderHome). Previously this had its
// own bespoke layout that didn't visually match the funder/corporate
// experience at all -- same underlying data, inconsistent presentation.
//
// Sibling to ImplementerMatches.tsx (partnership matches), NOT a
// replacement -- different candidate pools:
//   ImplementerMatches:            org-to-org, "who's broadly looking
//                                   for a partner like me"
//   InitiativeMatchesForImplementer: org-to-project, "which specific
//                                   initiative out there could use what
//                                   I offer, right now"

import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { Sparkles, FileText, Building2 } from "lucide-react";

type MatchState = "loading" | "locked_free" | "empty" | "ready" | "error";

const CRITERIA_ROWS: [string, string][] = [
  ["sector_fit", "Sector"],
  ["geography_fit", "Geography"],
  ["need_offer_fit", "Need/offer"],
  ["working_style_fit", "Working style"],
  ["stage_readiness_fit", "Stage readiness"],
];

export default function InitiativeMatchesForImplementer({ orgId }: { orgId: string | null }) {
  const [, navigate] = useLocation();
  const [state, setState] = useState<MatchState>("loading");
  const [matches, setMatches] = useState<any[]>([]);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;

    (async () => {
      const { data: cached } = await supabase
        .from("initiative_match_cache")
        .select("initiative_id, score, match_reason, criteria, computed_at")
        .eq("org_id", orgId)
        .order("score", { ascending: false })
        .limit(3);

      if (cached && cached.length > 0 && !cancelled) {
        const initiativeIds = cached.map((m: any) => m.initiative_id);
        const { data: initiatives } = await supabase
          .from("initiative_requests")
          .select("id, title, problem, specific_ask, sectors, locations, stage, submitter_org, user_id")
          .in("id", initiativeIds);
        const iniMap = new Map((initiatives ?? []).map((i: any) => [i.id, i]));
        if (!cancelled) {
          setMatches(cached.map((m: any) => ({ ...m, initiative: iniMap.get(m.initiative_id) })));
          setState("ready");
        }
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { if (!cancelled) setState(cached?.length ? "ready" : "error"); return; }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/refresh-initiative-matches`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
        });
        const result = await res.json();
        if (cancelled) return;

        if (result?.reason === "requires_upgrade") { setState("locked_free"); return; }
        if (result?.eligible === false) { setState(matches.length > 0 ? "ready" : "error"); return; }

        const freshMatches = (result?.matches ?? []).slice(0, 3);
        if (freshMatches.length === 0) { setState(matches.length > 0 ? "ready" : "empty"); return; }

        const initiativeIds = freshMatches.map((m: any) => m.initiative_id);
        const { data: initiatives } = await supabase
          .from("initiative_requests")
          .select("id, title, problem, specific_ask, sectors, locations, stage, submitter_org, user_id")
          .in("id", initiativeIds);
        const iniMap = new Map((initiatives ?? []).map((i: any) => [i.id, i]));
        if (!cancelled) {
          setMatches(freshMatches.map((m: any) => ({ ...m, initiative: iniMap.get(m.initiative_id) })));
          setState("ready");
        }
      } catch {
        if (!cancelled) setState(matches.length > 0 ? "ready" : "error");
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  if (state === "error") return null;

  return (
    <section className="rounded-2xl bg-[#2D6A4F]/[0.03] border border-[#2D6A4F]/10 p-4">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h3 className="inline-flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
            style={{ background: "#2D6A4F", color: "#ffffff" }}>
            <Sparkles className="w-3 h-3" /> Initiative matches
          </h3>
          <p className="text-[13px] text-black dark:text-white mt-1">Top 3, matched to your profile</p>
        </div>
        {state === "ready" && matches.length > 0 && (
          <button type="button" onClick={() => navigate("/dashboard/marketplace")}
            className="text-[13px] font-semibold text-[#2D6A4F] border border-[#2D6A4F]/30 rounded-full px-3 py-1.5 hover:bg-[#2D6A4F]/10 transition-colors shrink-0">
            View all
          </button>
        )}
      </div>

      {state === "loading" ? (
        <div className="space-y-3">
          {[1, 2].map(i => <div key={i} className="h-[180px] rounded-xl border border-border bg-white dark:bg-card animate-pulse" />)}
        </div>
      ) : state === "locked_free" ? (
        <div className="rounded-2xl border border-border bg-white dark:bg-card p-8 text-center">
          <p className="text-[15px] font-medium text-black dark:text-white mb-1">AI-matched initiatives need an upgrade.</p>
          <p className="text-[13px] text-black dark:text-white mb-3">Upgrade to see initiatives matched to your profile.</p>
          <button type="button" onClick={() => navigate("/dashboard/settings?tab=billing")}
            className="text-[13px] font-semibold text-white bg-[#2D6A4F] rounded-full px-4 py-1.5 hover:bg-[#245c43] transition-colors">
            Upgrade
          </button>
        </div>
      ) : state === "empty" ? (
        <div className="rounded-2xl border border-border bg-white dark:bg-card p-8 text-center">
          <p className="text-[15px] font-medium text-black dark:text-white mb-1">No initiatives yet.</p>
          <p className="text-[13px] text-black dark:text-white">Check back as organisations post their work.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {matches.map((m: any) => (
            <div key={m.initiative_id}
              className="w-full text-left rounded-xl border border-border bg-white dark:bg-card px-5 py-4 hover:border-[#2D6A4F]/30 transition-colors group flex flex-col min-h-[180px]">
              <button type="button" onClick={() => navigate(`/dashboard/marketplace?initiative=${m.initiative?.id ?? ""}`)} className="w-full text-left">
                <div className="flex items-start justify-between gap-3 mb-1">
                  <p className="text-[15px] font-semibold text-black dark:text-white group-hover:text-[#2D6A4F] transition-colors break-words flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-[#2D6A4F]/50 shrink-0" />
                    {m.initiative?.title ?? "Initiative"}
                  </p>
                  <span className="shrink-0 text-[13px] font-bold px-2 py-0.5 rounded-full"
                    style={{
                      background: m.score >= 70 ? "rgba(45,106,79,0.12)" : m.score >= 40 ? "rgba(180,83,9,0.12)" : "rgba(239,68,68,0.12)",
                      color: m.score >= 70 ? "#2D6A4F" : m.score >= 40 ? "#b45309" : "#ef4444",
                    }}>
                    {m.score}% criteria match
                  </span>
                </div>
              </button>

              {m.initiative?.submitter_org && m.initiative?.user_id && (
                <button type="button" onClick={() => navigate(`/dashboard/natives?tab=organisation&user=${m.initiative.user_id}`)}
                  className="inline-flex items-center gap-1 text-[13px] text-[#2D6A4F] hover:underline underline-offset-2 mb-2 w-fit">
                  <Building2 className="w-3.5 h-3.5" />
                  {m.initiative.submitter_org}
                </button>
              )}

              {m.criteria ? (
                <div className="flex flex-col gap-1 mb-2">
                  {CRITERIA_ROWS.map(([key, label]) => (
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
                <p className="text-[13px] text-black dark:text-white mb-2 line-clamp-1">{m.initiative?.problem}</p>
              )}

              <div className="mt-auto pt-2 flex items-center gap-2 flex-wrap">
                {m.initiative?.stage && (
                  <span className="text-[13px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(45,106,79,0.12)", color: "#2D6A4F" }}>
                    {m.initiative.stage}
                  </span>
                )}
                {Array.isArray(m.initiative?.locations) && m.initiative.locations.slice(0, 1).map((l: string) => (
                  <span key={l} className="text-[13px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(24,95,165,0.12)", color: "#185FA5" }}>
                    {l}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
