// src/components/platform/InitiativeMatchesForImplementer.tsx
//
// Peer-to-peer initiative matches for implementer homepages -- an NGO/
// social enterprise's own profile scored against OTHER orgs' posted
// initiatives (initiative_requests), via refresh-initiative-matches and
// the new match-initiatives-for-implementer engine (see that function's
// header for why this needed its own scorer rather than reusing
// match-initiatives-to-funder).
//
// Sibling to ImplementerMatches.tsx (partnership matches), NOT a
// replacement -- the two score against different candidate pools and
// answer different questions:
//   ImplementerMatches:            org-to-org, "who's broadly looking
//                                   for a partner like me"
//   InitiativeMatchesForImplementer: org-to-project, "which specific
//                                   initiative out there could use what
//                                   I offer, right now"
// Same loading/locked/empty/ready state machine and card visuals as
// ImplementerMatches, adapted to initiative_requests fields
// (title/problem/specific_ask) instead of organizations fields
// (organisation_name/partnership_sought).

import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { Sparkles, FileText } from "lucide-react";

type MatchState = "loading" | "locked_free" | "empty" | "ready" | "error";

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
        .limit(5);

      if (cached && cached.length > 0 && !cancelled) {
        const initiativeIds = cached.map((m: any) => m.initiative_id);
        const { data: initiatives } = await supabase
          .from("initiative_requests")
          .select("id, title, problem, specific_ask, sectors, locations, stage")
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

        const freshMatches = result?.matches ?? [];
        if (freshMatches.length === 0) { setState(matches.length > 0 ? "ready" : "empty"); return; }

        const initiativeIds = freshMatches.map((m: any) => m.initiative_id);
        const { data: initiatives } = await supabase
          .from("initiative_requests")
          .select("id, title, problem, specific_ask, sectors, locations, stage")
          .in("id", initiativeIds);
        const iniMap = new Map((initiatives ?? []).map((i: any) => [i.id, i]));
        if (!cancelled) {
          setMatches(
            freshMatches
              .slice(0, 5)
              .map((m: any) => ({ ...m, initiative: iniMap.get(m.initiative_id) }))
          );
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
            <Sparkles className="w-3 h-3" /> AI-matched initiatives
          </h3>
          <p className="text-[13px] text-black dark:text-white mt-1">Initiatives matched to your profile</p>
        </div>
        {state === "ready" && matches.length > 0 && (
          <button type="button" onClick={() => navigate("/dashboard/marketplace")}
            className="text-[13px] font-semibold text-[#2D6A4F] border border-[#2D6A4F]/30 rounded-full px-3 py-1.5 hover:bg-[#2D6A4F]/10 transition-colors shrink-0">
            View all
          </button>
        )}
      </div>

      {state === "loading" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[1, 2].map(i => <div key={i} className="h-[150px] rounded-xl border border-border bg-white dark:bg-card animate-pulse" />)}
        </div>
      ) : state === "locked_free" ? (
        <div className="rounded-xl border border-border bg-white dark:bg-card p-6 text-center flex flex-col items-center justify-center min-h-[150px]">
          <Sparkles className="w-6 h-6 text-[#2D6A4F]/40 mb-3" />
          <p className="text-[13px] font-medium text-black dark:text-white mb-1">AI-matched initiatives need an upgrade</p>
          <p className="text-[13px] text-black dark:text-white mb-3">Upgrade to Plus to see initiatives matched to what you offer.</p>
          <button type="button" onClick={() => navigate("/dashboard/settings?tab=billing")}
            className="text-[13px] font-semibold text-white bg-[#2D6A4F] rounded-full px-4 py-1.5 hover:bg-[#245c43] transition-colors">
            Upgrade
          </button>
        </div>
      ) : state === "empty" ? (
        <div className="rounded-xl border border-border bg-white dark:bg-card p-5 text-center">
          <p className="text-[13px] text-black dark:text-white">No initiative matches yet. Check back soon.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {matches.map((m: any) => (
            <button key={m.initiative_id} type="button"
              onClick={() => navigate(`/dashboard/marketplace?initiative=${m.initiative?.id ?? ""}`)}
              className="w-full text-left rounded-xl border border-border bg-white dark:bg-card px-4 py-3 hover:border-[#2D6A4F]/30 transition-colors group flex flex-col min-h-[150px]">
              <div className="flex items-center gap-1.5 mb-1">
                <FileText className="w-3.5 h-3.5 text-[#2D6A4F]/50 shrink-0" />
                <p className="text-[15px] font-semibold text-black dark:text-white group-hover:text-[#2D6A4F] transition-colors break-words">
                  {m.initiative?.title ?? "Initiative"}
                </p>
              </div>
              <p className="text-[13px] text-black dark:text-white break-words mb-2">
                {m.initiative?.specific_ask || m.initiative?.problem || "No description provided."}
              </p>
              <span className="inline-flex w-fit text-[13px] font-bold px-2 py-0.5 rounded-full mb-2"
                style={{
                  background: m.score >= 70 ? "rgba(45,106,79,0.12)" : m.score >= 40 ? "rgba(180,83,9,0.12)" : "rgba(239,68,68,0.12)",
                  color: m.score >= 70 ? "#2D6A4F" : m.score >= 40 ? "#b45309" : "#ef4444",
                }}>
                {m.score}% fit
              </span>
              <p className="text-[13px] text-black dark:text-white mb-2">{m.match_reason}</p>
              <div className="mt-auto pt-2 flex items-center gap-2 flex-wrap">
                {m.initiative?.stage && (
                  <span className="text-[13px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(45,106,79,0.12)", color: "#2D6A4F" }}>
                    {m.initiative.stage}
                  </span>
                )}
                {Array.isArray(m.initiative?.locations) && m.initiative.locations.length > 0 && (
                  <span className="text-[13px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(24,95,165,0.12)", color: "#185FA5" }}>
                    {m.initiative.locations[0]}
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
