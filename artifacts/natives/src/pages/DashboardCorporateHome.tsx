// ─── DashboardCorporateHome.tsx ───────────────────────────────────────────────
// For org_type: corporate, tech_company, creative_agency_studio
// Oriented around CSR/ESG discovery, adoption pipeline, and partnership tracking
// Not investment/funding focused — no deal memos, no pass/save trays

import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { ArrowRight, Sparkles, Leaf, Building2 } from "lucide-react";

const ESG_PARTNERSHIP_TYPES = ["operational", "strategic", "lead", "other"];

export default function CorporateHome({ profile }: { profile: any }) {
  const [, navigate] = useLocation();

  const [loadingMatches, setLoadingMatches] = useState(true);
  const [aiMatching, setAiMatching]         = useState(false);
  const [matchedInitiatives, setMatchedInitiatives] = useState<any[]>([]);

  // Metrics
  const [reviewedCount, setReviewedCount]   = useState(0);
  const [sentEOIs, setSentEOIs]             = useState(0);
  const [activeConvos, setActiveConvos]     = useState(0);
  const [esgAdoptions, setEsgAdoptions]     = useState(0);
  const [totalCommitted, setTotalCommitted] = useState<string | null>(null);

  // Pipeline
  const [outboundEOIs, setOutboundEOIs] = useState<any[]>([]);
  const [orgData, setOrgData]           = useState<any>(null);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = profile?.full_name?.split(" ")[0] ?? "there";
  const orgName = profile?.org_name ?? "your organisation";

  useEffect(() => {
    if (!profile?.id) return;
    loadAll();
  }, [profile?.id]);

  async function loadAll() {
    // Org profile (for ESG frameworks, sectors, geography)
    const { data: org } = await supabase
      .from("organizations")
      .select("id, sector, country, esg_frameworks, csr_budget_range, geographic_focus, mandate_sectors, mandate_sdgs")
      .eq("user_id", profile.id)
      .maybeSingle();
    setOrgData(org);

    // EOIs sent by this user
    const { data: eoisSent } = await supabase
      .from("expressions_of_interest")
      .select("id, initiative_id, partnership_type, esg_adoption, message, created_at, conversation_id")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false });

    const eois = eoisSent ?? [];
    setSentEOIs(eois.length);
    setEsgAdoptions(eois.filter((e: any) => e.esg_adoption).length);

    // Enrich outbound EOIs with initiative titles
    if (eois.length > 0) {
      const initIds = [...new Set(eois.map((e: any) => e.initiative_id))];
      const { data: inits } = await supabase
        .from("initiative_requests")
        .select("id, title, sectors, locations, status")
        .in("id", initIds);
      const initMap = new Map((inits ?? []).map((i: any) => [i.id, i]));

      // Get conversation statuses
      const convoIds = eois.map((e: any) => e.conversation_id).filter(Boolean);
      const { data: convos } = convoIds.length > 0
        ? await supabase.from("conversations").select("id, status").in("id", convoIds)
        : { data: [] };
      const convoMap = new Map((convos ?? []).map((c: any) => [c.id, c.status]));

      setOutboundEOIs(eois.slice(0, 5).map((e: any) => ({
        ...e,
        initiative: initMap.get(e.initiative_id),
        conversation_status: e.conversation_id ? convoMap.get(e.conversation_id) : null,
      })));
    }

    // Active conversations
    const { data: myConvos } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", profile.id);
    const convoIds = (myConvos ?? []).map((c: any) => c.conversation_id);
    if (convoIds.length > 0) {
      const { data: openConvs } = await supabase
        .from("conversations")
        .select("id, funder_closed_at")
        .in("id", convoIds)
        .eq("status", "open");
      setActiveConvos((openConvs ?? []).filter((c: any) => !c.funder_closed_at).length);
    }

    // Reviewed = funder_decisions by this user (reuse same table)
    const { data: decisions } = await supabase
      .from("funder_decisions")
      .select("id")
      .eq("funder_id", profile.id);
    setReviewedCount(decisions?.length ?? 0);

    // Load ESG-aligned initiatives for AI matching
    const { data: initiatives } = await supabase
      .from("initiative_requests")
      .select("id,title,sectors,locations,status,eois,created_at,problem,outcome,budget,esg_alignment,specific_ask,stage,sdg_tags,submitter_org,user_id")
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(40);

    if (!initiatives?.length) {
      setLoadingMatches(false);
      return;
    }

    // Prioritise ESG-aligned initiatives
    const esgFirst = [...initiatives].sort((a: any, b: any) => {
      if (a.esg_alignment && !b.esg_alignment) return -1;
      if (!a.esg_alignment && b.esg_alignment) return 1;
      return 0;
    });

    // AI matching against corporate ESG mandate
    setAiMatching(true);
    const mandate = {
      org_type: profile.org_type,
      esg_frameworks: org?.esg_frameworks,
      csr_budget_range: org?.csr_budget_range,
      geographic_focus: org?.geographic_focus ?? org?.country,
      mandate_sectors: org?.mandate_sectors ?? org?.sector,
      mandate_sdgs: org?.mandate_sdgs,
      partnership_types: ESG_PARTNERSHIP_TYPES,
    };

    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/match-initiatives-to-funder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mandate, initiatives: esgFirst }),
      });
      const result = await res.json();

      if (result.data?.length) {
        const scoreMap = Object.fromEntries(
          result.data.map((r: any) => [r.id, { score: r.score, match_reason: r.match_reason }])
        );
        const ranked = esgFirst
          .filter((ini: any) => scoreMap[ini.id] && scoreMap[ini.id].score >= 35)
          .map((ini: any) => ({ ...ini, ...scoreMap[ini.id] }))
          .sort((a: any, b: any) => b.score - a.score);
        setMatchedInitiatives(ranked);
      } else {
        setMatchedInitiatives(esgFirst.filter((i: any) => i.esg_alignment));
      }
    } catch {
      setMatchedInitiatives(esgFirst.filter((i: any) => i.esg_alignment));
    }

    setAiMatching(false);
    setLoadingMatches(false);
  }

  const csrProfileComplete = !!(orgData?.esg_frameworks?.length || orgData?.csr_budget_range || orgData?.mandate_sectors?.length);

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs text-muted-foreground mb-1 uppercase tracking-widest">{greeting}</p>
          <h2 className="text-2xl font-bold text-foreground tracking-tight">{firstName}.</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {csrProfileComplete
              ? `Your CSR profile is active. Discover ESG-aligned initiatives for ${orgName}.`
              : "Complete your CSR profile to get better matched initiatives."}
          </p>
        </div>
        <button type="button" onClick={() => navigate("/dashboard/marketplace")}
          className="rounded-full h-9 px-5 bg-[#2D6A4F] hover:bg-[#245c43] text-white text-sm font-medium transition-colors">
          Browse initiatives
        </button>
      </div>

      {/* CSR profile nudge */}
      {!csrProfileComplete && (
        <div className="rounded-xl border border-dashed border-[#2D6A4F]/30 bg-[#2D6A4F]/5 px-5 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-foreground mb-1">Set your CSR mandate</p>
            <p className="text-xs text-muted-foreground">
              Add ESG frameworks, sector focus, and geography to surface the most relevant initiatives.
            </p>
          </div>
          <button type="button" onClick={() => navigate("/dashboard/profile")}
            className="shrink-0 text-xs font-semibold text-[#2D6A4F] hover:underline underline-offset-2 whitespace-nowrap">
            Complete profile →
          </button>
        </div>
      )}

      {/* Metrics strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: "Initiatives reviewed",
            value: reviewedCount,
            sub: "explored",
            onClick: () => navigate("/dashboard/marketplace"),
          },
          {
            label: "Expressions sent",
            value: sentEOIs,
            sub: "outbound",
            onClick: () => navigate("/dashboard/messages"),
          },
          {
            label: "Active conversations",
            value: activeConvos,
            sub: "open threads",
            onClick: () => navigate("/dashboard/messages"),
          },
          {
            label: "ESG/CSR adoptions",
            value: esgAdoptions,
            sub: "confirmed",
            onClick: () => navigate("/dashboard/initiatives?tab=confirmed"),
          },
        ].map(m => (
          <button key={m.label} type="button" onClick={m.onClick}
            className="text-left rounded-xl border border-border bg-card px-4 py-4 hover:border-[#2D6A4F]/40 transition-colors group">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">{m.label}</p>
            <p className="text-3xl font-bold text-foreground tracking-tight group-hover:text-[#2D6A4F] transition-colors">{m.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{m.sub}</p>
          </button>
        ))}
      </div>

      {/* AI-matched ESG initiatives */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <Leaf className="w-3.5 h-3.5 text-[#2D6A4F]" />
              ESG initiatives for you
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Matched to your CSR mandate and sector focus
            </p>
          </div>
          <button type="button" onClick={() => navigate("/dashboard/marketplace")}
            className="text-xs text-[#2D6A4F] hover:underline underline-offset-2 transition-colors">
            View all →
          </button>
        </div>

        {loadingMatches ? (
          <div className="space-y-3">
            {aiMatching && (
              <div className="flex items-center gap-2 text-xs text-[#2D6A4F] mb-2">
                <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                Matching ESG initiatives to your profile...
              </div>
            )}
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 rounded-xl border border-border bg-card animate-pulse" />
            ))}
          </div>
        ) : matchedInitiatives.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-10 text-center">
            <Leaf className="w-6 h-6 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground mb-1">No ESG initiatives matched yet.</p>
            <p className="text-xs text-muted-foreground mb-4">
              Complete your CSR profile or browse all initiatives to find the right fit.
            </p>
            <button type="button" onClick={() => navigate("/dashboard/marketplace")}
              className="text-xs text-[#2D6A4F] hover:underline underline-offset-2">
              Browse marketplace →
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {matchedInitiatives.slice(0, 8).map((ini: any) => (
              <button key={ini.id} type="button"
                onClick={() => navigate(`/dashboard/marketplace?initiative=${ini.id}`)}
                className="w-full text-left rounded-xl border border-border bg-card px-5 py-4 hover:border-[#2D6A4F]/30 transition-colors group">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="text-sm font-semibold text-foreground group-hover:text-[#2D6A4F] transition-colors truncate">
                        {ini.title}
                      </p>
                      {ini.esg_alignment && (
                        <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: "#e8f5e9", color: "#2e7d32" }}>
                          <Leaf className="w-2.5 h-2.5" /> ESG/CSR
                        </span>
                      )}
                      {ini.score && (
                        <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{
                            background: ini.score >= 70 ? "#eaf5ee" : "#f5f5f5",
                            color: ini.score >= 70 ? "#2D6A4F" : "#6b7280",
                          }}>
                          {ini.score}% match
                        </span>
                      )}
                    </div>
                    {ini.match_reason ? (
                      <p className="text-xs mt-0.5 line-clamp-1 text-[#2D6A4F]">{ini.match_reason}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{ini.problem}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      {ini.submitter_org && (
                        <span className="text-[10px] font-medium text-muted-foreground">{ini.submitter_org}</span>
                      )}
                      {ini.sectors?.slice(0, 2).map((s: string) => (
                        <span key={s} className="text-[10px] px-2 py-0.5 rounded-full border border-border text-muted-foreground">{s}</span>
                      ))}
                      {ini.locations?.slice(0, 1).map((l: string) => (
                        <span key={l} className="text-[10px] text-muted-foreground">{l}</span>
                      ))}
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-[#2D6A4F] shrink-0 mt-1 transition-colors" />
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* CSR Pipeline */}
      {outboundEOIs.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                Your CSR pipeline
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Initiatives you've expressed interest in
              </p>
            </div>
            <button type="button" onClick={() => navigate("/dashboard/messages")}
              className="text-xs text-[#2D6A4F] hover:underline underline-offset-2 transition-colors">
              View all →
            </button>
          </div>

          <div className="space-y-2">
            {outboundEOIs.map((eoi: any) => {
              const status = eoi.conversation_status;
              const statusConfig = status === "open"
                ? { label: "Active",   bg: "#eaf5ee", color: "#2D6A4F" }
                : status === "declined"
                ? { label: "Declined", bg: "#fef2f2", color: "#ef4444" }
                : status === "confirmed"
                ? { label: "Confirmed", bg: "#f0f9ff", color: "#0369a1" }
                : { label: "Pending",  bg: "#fffbeb", color: "#b45309" };

              return (
                <button key={eoi.id} type="button"
                  onClick={() => navigate(`/dashboard/marketplace?initiative=${eoi.initiative_id}`)}
                  className="w-full text-left rounded-xl border border-border bg-card px-5 py-3 hover:border-[#2D6A4F]/30 transition-colors group flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground group-hover:text-[#2D6A4F] transition-colors truncate">
                      {eoi.initiative?.title ?? "Initiative"}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {eoi.esg_adoption && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: "#e8f5e9", color: "#2e7d32" }}>
                          <Leaf className="w-2.5 h-2.5" /> ESG adoption
                        </span>
                      )}
                      {eoi.initiative?.sectors?.slice(0, 1).map((s: string) => (
                        <span key={s} className="text-[10px] text-muted-foreground">{s}</span>
                      ))}
                      {eoi.initiative?.locations?.slice(0, 1).map((l: string) => (
                        <span key={l} className="text-[10px] text-muted-foreground">{l}</span>
                      ))}
                    </div>
                  </div>
                  <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: statusConfig.bg, color: statusConfig.color }}>
                    {statusConfig.label}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

    </div>
  );
}
