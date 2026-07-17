import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { ArrowRight, Sparkles } from "lucide-react";

export default function FunderHome({ profile }: { profile: any }) {
  const [, navigate] = useLocation();
  const [matchedInitiatives, setMatchedInitiatives] = useState<any[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [aiMatching, setAiMatching] = useState(false);
  const [mandateScore, setMandateScore] = useState(0);
  const [marketplaceCount, setMarketplaceCount] = useState(0);
  const [conversations, setConversations] = useState(0);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = profile?.full_name?.split(" ")[0] ?? "there";

  useEffect(() => {
    if (!profile?.id) return;

    async function loadAll() {
      // Mandate completion
      const { data: orgData } = await supabase
        .from("organizations")
        .select("grant_range_min,grant_range_max,grant_currency,funding_instruments,geographic_focus,stage_preference,mandate_sectors,mandate_sdgs")
        .eq("user_id", profile.id)
        .single();

      if (orgData) {
        const filled = [
          !!orgData.grant_range_min,
          !!orgData.grant_range_max,
          orgData.funding_instruments?.length > 0,
          orgData.geographic_focus?.length > 0,
          orgData.stage_preference?.length > 0,
          orgData.mandate_sectors?.length > 0,
          orgData.mandate_sdgs?.length > 0,
        ];
        setMandateScore(Math.round((filled.filter(Boolean).length / filled.length) * 100));
      }

      // Marketplace count
      const { data: mktData } = await supabase
        .from("initiative_requests")
        .select("id")
        .eq("status", "published");
      setMarketplaceCount(mktData?.length ?? 0);

      // Conversations
      const { data: convData } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", profile.id);
      const convIds = (convData ?? []).map((r: any) => r.conversation_id).filter(Boolean);
      if (convIds.length > 0) {
        const { data: openConvs } = await supabase
          .from("conversations")
          .select("id, conversation_type, funder_closed_at")
          .in("id", convIds)
          .eq("status", "open");
        const activeConvs = (openConvs ?? []).filter((c: any) => !c.funder_closed_at);
        setConversations(activeConvs.length);
      }

      // Fetch initiatives
      const { data: initiatives } = await supabase
        .from("initiative_requests")
        .select("id,title,sectors,locations,status,eois,created_at,problem,outcome,budget_min,budget_max,budget_currency,stage,sdg_tags,target_population,specific_ask")
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(30);

      if (!initiatives?.length) {
        setLoadingMatches(false);
        return;
      }

      // AI matching
      setAiMatching(true);
      const mandate = {
        org_type: profile.org_type,
        investment_thesis: profile.investment_thesis,
        grant_range_min: orgData?.grant_range_min,
        grant_range_max: orgData?.grant_range_max,
        grant_currency: orgData?.grant_currency,
        funding_instruments: orgData?.funding_instruments,
        geographic_focus: orgData?.geographic_focus,
        stage_preference: orgData?.stage_preference,
        mandate_sectors: orgData?.mandate_sectors,
        mandate_sdgs: orgData?.mandate_sdgs,
      };

      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/match-initiatives-to-funder`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mandate, initiatives }),
        });
        const result = await res.json();

        if (result.data?.length) {
          const scoreMap = Object.fromEntries(
            result.data.map((r: any) => [r.id, { score: r.score, match_reason: r.match_reason }])
          );
          const ranked = initiatives
            .filter(ini => scoreMap[ini.id] && scoreMap[ini.id].score >= 40)
            .map(ini => ({ ...ini, ...scoreMap[ini.id] }))
            .sort((a: any, b: any) => b.score - a.score);
          setMatchedInitiatives(ranked);
        } else {
          setMatchedInitiatives(initiatives);
        }
      } catch {
        setMatchedInitiatives(initiatives);
      }

      setAiMatching(false);
      setLoadingMatches(false);
    }

    loadAll();
  }, [profile?.id]);

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs text-muted-foreground mb-1 uppercase tracking-widest">{greeting}</p>
          <h2 className="text-2xl font-bold text-foreground tracking-tight">{firstName}.</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {mandateScore < 60
              ? "Complete your mandate to get better matched initiatives."
              : `Your mandate is active. ${marketplaceCount} initiatives in the marketplace.`}
          </p>
        </div>
        <button type="button" onClick={() => navigate("/dashboard/marketplace")}
          className="rounded-full h-9 px-5 bg-[#2D6A4F] hover:bg-[#245c43] text-white text-sm font-medium transition-colors">
          Browse all initiatives
        </button>
      </div>

      {/* Mandate completion */}
      {mandateScore < 100 && (
        <div className="rounded-xl border border-dashed border-[#2D6A4F]/30 bg-[#2D6A4F]/5 px-5 py-4 flex items-center justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <p className="text-sm font-semibold text-foreground">Mandate {mandateScore}% complete</p>
              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden max-w-[120px]">
                <div className="h-full rounded-full bg-[#2D6A4F] transition-all duration-500"
                  style={{ width: `${mandateScore}%` }} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Add sector focus, geography, and SDG priorities to improve initiative matching.
            </p>
          </div>
          <button type="button" onClick={() => navigate("/dashboard/profile")}
            className="shrink-0 text-xs font-semibold text-[#2D6A4F] hover:underline underline-offset-2 whitespace-nowrap">
            Complete mandate →
          </button>
        </div>
      )}

      {/* Pipeline metrics */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Open conversations", value: conversations, sub: "active", onClick: () => navigate("/dashboard/messages") },
          { label: "In marketplace", value: marketplaceCount, sub: "initiatives", onClick: () => navigate("/dashboard/marketplace") },
          { label: "Verified orgs", value: "→", sub: "browse directory", onClick: () => navigate("/dashboard/natives") },
        ].map(m => (
          <button key={m.label} type="button" onClick={m.onClick}
            className="text-left rounded-xl border border-border bg-card px-4 py-4 hover:border-[#2D6A4F]/40 transition-colors group card-interactive">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">{m.label}</p>
            <p className="text-3xl font-bold text-foreground tracking-tight group-hover:text-[#2D6A4F] transition-colors">{m.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{m.sub}</p>
          </button>
        ))}
      </div>

      {/* Matched initiatives */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Initiatives for you
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              AI-matched to your mandate
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
                Matching initiatives to your mandate...
              </div>
            )}
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 rounded-xl border border-border bg-card animate-pulse" />
            ))}
          </div>
        ) : matchedInitiatives.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-10 text-center">
            <p className="text-sm font-medium text-foreground mb-1">No initiatives yet.</p>
            <p className="text-xs text-muted-foreground">Check back as organisations post their work.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {matchedInitiatives.slice(0, 8).map((ini: any) => (
              <button key={ini.id} type="button"
                onClick={() => navigate(`/dashboard/marketplace?initiative=${ini.id}`)}
                className="w-full text-left rounded-xl border border-border bg-card px-5 py-4 hover:border-[#2D6A4F]/30 transition-colors group card-interactive">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-foreground group-hover:text-[#2D6A4F] transition-colors truncate">
                        {ini.title}
                      </p>
                      {ini.score && (
                        <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{
                            background: ini.score >= 70 ? "#eaf5ee" : "#f5f5f5",
                            color: ini.score >= 70 ? "#2D6A4F" : "#6b7280",
                          }}>
                          {ini.score}% relevant
                        </span>
                      )}
                    </div>
                    {ini.match_reason ? (
                      <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "#2D6A4F" }}>
                        {ini.match_reason}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{ini.problem}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      {ini.stage && (
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {ini.stage}
                        </span>
                      )}
                      {ini.budget_min && ini.budget_max ? (
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {ini.budget_currency} {Number(ini.budget_min).toLocaleString()} – {Number(ini.budget_max).toLocaleString()}
                        </span>
                      ) : ini.budget_min ? (
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {ini.budget_currency} {Number(ini.budget_min).toLocaleString()}+
                        </span>
                      ) : null}
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

    </div>
  );
}