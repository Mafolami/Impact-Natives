import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { Sparkles, Bookmark, MessageSquare, Users, Building2 } from "lucide-react";

// Maps a pass reason to the specific mandate field it points at.
const PASS_REASON_FIELD_MAP: Record<string, { label: string; hint: string }> = {
  "Budget mismatch": { label: "grant range", hint: "Your stated grant range may not match what initiatives are asking for." },
  "Geography mismatch": { label: "geographic focus", hint: "Initiatives outside your stated geography keep coming up as passes." },
  "Too early stage": { label: "stage preference", hint: "A number of passes suggest your stage preference could be narrowed or widened." },
  "Outside mandate": { label: "sector focus", hint: "A number of passes suggest your sector focus or investment thesis could be sharper." },
};
const PASS_INSIGHT_THRESHOLD = 3;

export default function FunderHome({ profile }: { profile: any }) {
  const [, navigate] = useLocation();
  const [matchedInitiatives, setMatchedInitiatives] = useState<any[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [aiMatching, setAiMatching] = useState(false);
  const [mandateScore, setMandateScore] = useState(0);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [conversations, setConversations] = useState(0);
  const [awaitingResponse, setAwaitingResponse] = useState(0);
  const [savedCount, setSavedCount] = useState(0);
  const [passInsight, setPassInsight] = useState<{ reason: string; count: number; label: string; hint: string } | null>(null);

  // Partnership matches — secondary here, since a funder's core action is
  // funding initiatives, not partnering with peer organisations directly.
  const [partnershipMatches, setPartnershipMatches] = useState<any[]>([]);
  const [partnershipEligible, setPartnershipEligible] = useState(false);
  const [loadingPartnerships, setLoadingPartnerships] = useState(true);

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
        .select("id,grant_range_min,grant_range_max,grant_currency,funding_instruments,geographic_focus,stage_preference,mandate_sectors,mandate_sdgs")
        .eq("user_id", profile.id)
        .single();

      if (orgData) {
        setOrgId(orgData.id);
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

      // Saved initiatives
      const { data: savedInits } = await supabase
        .from("saved_initiatives")
        .select("initiative_id")
        .eq("user_id", profile.id);
      setSavedCount(savedInits?.length ?? 0);

      // Conversations + awaiting-your-response
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
        const openIds = (openConvs ?? []).filter((c: any) => !c.funder_closed_at).map((c: any) => c.id);
        setConversations(openIds.length);

        if (openIds.length > 0) {
          const { data: msgs } = await supabase
            .from("messages")
            .select("conversation_id, sender_id, created_at")
            .in("conversation_id", openIds)
            .order("created_at", { ascending: false });
          const lastSenderMap = new Map<string, string>();
          (msgs ?? []).forEach((m: any) => {
            if (!lastSenderMap.has(m.conversation_id)) lastSenderMap.set(m.conversation_id, m.sender_id);
          });
          const awaiting = openIds.filter((id: string) => {
            const lastSender = lastSenderMap.get(id);
            return lastSender && lastSender !== profile.id;
          }).length;
          setAwaitingResponse(awaiting);
        }
      }

      // Pass-reason aggregation — only surfaces when a real pattern exists
      const { data: passDecisions } = await supabase
        .from("funder_decisions")
        .select("reason")
        .eq("funder_id", profile.id)
        .eq("decision", "pass");
      const reasonCounts: Record<string, number> = {};
      (passDecisions ?? []).forEach((d: any) => {
        if (d.reason) reasonCounts[d.reason] = (reasonCounts[d.reason] ?? 0) + 1;
      });
      const candidateReasons = Object.entries(reasonCounts)
        .filter(([reason, count]) => count >= PASS_INSIGHT_THRESHOLD && PASS_REASON_FIELD_MAP[reason])
        .sort((a, b) => b[1] - a[1]);
      if (candidateReasons.length > 0) {
        const [reason, count] = candidateReasons[0];
        setPassInsight({ reason, count, ...PASS_REASON_FIELD_MAP[reason] });
      }

      // Fetch initiatives
      const { data: initiatives } = await supabase
        .from("initiative_requests")
        .select("id,title,sectors,locations,status,eois,created_at,problem,outcome,budget_min,budget_max,budget_currency,stage,sdg_tags,target_population,specific_ask,submitter_org,user_id")
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(30);

      if (!initiatives?.length) {
        setLoadingMatches(false);
        return;
      }

      // Cache-first: read persisted match scores directly so the tile
      // renders immediately and never goes blank if the background refresh
      // hits a Groq rate limit. A stale/missing cache is only ever
      // refreshed by refresh-initiative-matches below, which leaves a good
      // cache untouched on failure.
      const applyCache = (rows: { initiative_id: string; score: number; match_reason: string; criteria?: any }[]) => {
        if (!rows?.length) return false;
        const scoreMap = Object.fromEntries(rows.map(r => [r.initiative_id, r]));
        const ranked = initiatives
          .filter(ini => scoreMap[ini.id])
          .map(ini => ({ ...ini, score: scoreMap[ini.id].score, match_reason: scoreMap[ini.id].match_reason, criteria: scoreMap[ini.id].criteria }))
          .sort((a: any, b: any) => b.score - a.score);
        if (ranked.length > 0) {
          setMatchedInitiatives(ranked);
          return true;
        }
        return false;
      };

      const { data: cachedMatches } = await supabase
        .from("initiative_match_cache")
        .select("initiative_id, score, match_reason")
        .eq("org_id", orgData?.id)
        .order("score", { ascending: false });

      const hadCache = applyCache(cachedMatches ?? []);
      setLoadingMatches(false);

      setAiMatching(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const res = await fetch(`${supabaseUrl}/functions/v1/refresh-initiative-matches`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          });
          const result = await res.json();
          if (result.matches?.length) {
            applyCache(result.matches.map((m: any) => ({
              initiative_id: m.initiative_id, score: m.score, match_reason: m.match_reason, criteria: m.criteria,
            })));
          } else if (!hadCache) {
            // Never-scored, and this attempt returned nothing usable —
            // fall back to the raw unscored list rather than showing empty.
            setMatchedInitiatives(initiatives);
          }
        }
      } catch {
        if (!hadCache) setMatchedInitiatives(initiatives);
      }
      setAiMatching(false);
    }

    loadAll();
  }, [profile?.id]);

  // Partnership matches — read cache directly, background refresh only.
  // Secondary feature here, so it stays compact (max 2, single-line cards).
  useEffect(() => {
    if (!orgId) return;

    if (mandateScore < 80) {
      setPartnershipEligible(false);
      setLoadingPartnerships(false);
      return;
    }
    setPartnershipEligible(true);

    let cancelled = false;

    (async () => {
      const { data: cached } = await supabase
        .from("partnership_match_cache")
        .select("matched_org_id, fit_score, rationale, key_synergy, criteria, computed_at")
        .eq("org_id", orgId)
        .order("fit_score", { ascending: false })
        .limit(2);

      if (cached && cached.length > 0) {
        const orgIds = cached.map((m: any) => m.matched_org_id);
        const { data: orgs } = await supabase
          .from("organizations")
          .select("id, user_id, organisation_name, organisation_type, country")
          .in("id", orgIds);
        const orgMap = new Map((orgs ?? []).map((o: any) => [o.id, o]));
        if (!cancelled) {
          setPartnershipMatches(cached.map((m: any) => ({ ...m, org: orgMap.get(m.matched_org_id) })));
        }
      }
      if (!cancelled) setLoadingPartnerships(false);

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        fetch(`${supabaseUrl}/functions/v1/refresh-partnership-matches`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
        }).then(res => res.json()).then(result => {
          // The client-side score above is only a first-paint estimate.
          // The server computes completeness independently — if the two
          // formulas ever drift apart, this keeps what's on screen honest
          // rather than trusting a locally duplicated calculation forever.
          if (!cancelled && typeof result?.completeness === "number" && result.completeness !== mandateScore) {
            setMandateScore(result.completeness);
          }
        }).catch(() => {});
      }
    })();

    return () => { cancelled = true; };
  }, [orgId, mandateScore]);

  const metricTiles = [
    {
      label: "Open conversations",
      value: conversations,
      sub: "active",
      onClick: () => navigate("/dashboard/messages"),
      icon: Users,
      accent: false,
    },
    {
      label: "Awaiting your response",
      value: awaitingResponse,
      sub: awaitingResponse > 0 ? "needs a reply" : "all caught up",
      onClick: () => navigate("/dashboard/messages"),
      icon: MessageSquare,
      accent: awaitingResponse > 0,
    },
    {
      label: "Saved",
      value: savedCount,
      sub: savedCount > 0 ? "to review" : "nothing saved",
      onClick: () => navigate("/dashboard/marketplace"),
      icon: Bookmark,
      accent: false,
    },
  ];

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
              : "Your mandate is active."}
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
              {mandateScore < 80
                ? "Add sector focus, geography, and SDG priorities — 80% unlocks partnership matches too."
                : "Add sector focus, geography, and SDG priorities to improve initiative matching."}
            </p>
          </div>
          <button type="button" onClick={() => navigate("/dashboard/profile")}
            className="shrink-0 text-xs font-semibold text-[#2D6A4F] border border-[#2D6A4F]/30 rounded-full px-3 py-1.5 hover:bg-[#2D6A4F]/10 transition-colors whitespace-nowrap">
            Complete mandate
          </button>
        </div>
      )}

      {/* Pass-pattern insight — only shown when a real pattern exists */}
      {passInsight && (
        <div className="rounded-xl border border-[#C45C26]/30 bg-[#C45C26]/5 px-5 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-foreground mb-1">
              You've passed on {passInsight.count} initiatives citing "{passInsight.reason}"
            </p>
            <p className="text-xs text-muted-foreground">{passInsight.hint}</p>
          </div>
          <button type="button" onClick={() => navigate("/dashboard/profile")}
            className="shrink-0 text-xs font-semibold text-[#C45C26] border border-[#C45C26]/30 rounded-full px-3 py-1.5 hover:bg-[#C45C26]/10 transition-colors whitespace-nowrap">
            Update {passInsight.label}
          </button>
        </div>
      )}

      {/* Kanban: primary matches column, a lighter secondary partnership column,
          metrics as a rail on the right. Stacks on mobile, rail moving to the bottom. */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr_240px] gap-6">

        {/* Column 1: Initiative matches — primary */}
        <section className="lg:order-1 rounded-2xl bg-[#2D6A4F]/[0.03] border border-[#2D6A4F]/10 p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Initiatives for you
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">Top 3, AI-matched to your mandate</p>
            </div>
            <button type="button" onClick={() => navigate("/dashboard/marketplace")}
              className="text-xs font-semibold text-[#2D6A4F] border border-[#2D6A4F]/30 rounded-full px-3 py-1.5 hover:bg-[#2D6A4F]/10 transition-colors shrink-0">
              View all
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
            <div className="rounded-2xl border border-border bg-card p-8 text-center">
              <p className="text-sm font-medium text-foreground mb-1">No initiatives yet.</p>
              <p className="text-xs text-muted-foreground">Check back as organisations post their work.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {matchedInitiatives.slice(0, 3).map((ini: any) => (
                <div key={ini.id}
                  className="w-full text-left rounded-xl border border-border bg-card px-5 py-4 hover:border-[#2D6A4F]/30 transition-colors group">
                  <button type="button" onClick={() => navigate(`/dashboard/marketplace?initiative=${ini.id}`)} className="w-full text-left">
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
                      </div>
                    </div>
                  </button>

                  {ini.submitter_org && ini.user_id && (
                    <button type="button" onClick={() => navigate(`/dashboard/natives?tab=organisation&user=${ini.user_id}`)}
                      className="inline-flex items-center gap-1 text-[11px] text-[#2D6A4F] hover:underline underline-offset-2 mb-2">
                      <Building2 className="w-3 h-3" />
                      {ini.submitter_org}
                    </button>
                  )}

                  {ini.criteria ? (
                    <div className="flex flex-col gap-1 mb-2">
                      {[
                        ["sector_fit", "Sector"], ["geography_fit", "Geography"],
                        ["stage_fit", "Stage"], ["esg_fit", "ESG fit"], ["support_type_fit", "Support type"],
                      ].filter(([key]) => ini.criteria[key]).map(([key, label]) => (
                        <div key={key} className="flex items-center justify-between">
                          <span className="text-[11px] text-muted-foreground">{label}</span>
                          <span className="text-[11px] font-medium" style={{
                            color: ini.criteria[key] === "match" ? "#2D6A4F" : ini.criteria[key] === "partial" ? "#C45C26" : "#9ca3af",
                          }}>
                            {ini.criteria[key] === "match" ? "✓ match" : ini.criteria[key] === "partial" ? "● partial" : "no match"}
                          </span>
                        </div>
                      ))}
                      {typeof ini.criteria.budget_overlap_pct === "number" && (
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-muted-foreground">Budget overlap</span>
                          <span className="text-[11px] font-medium text-foreground">{ini.criteria.budget_overlap_pct}%</span>
                        </div>
                      )}
                    </div>
                  ) : ini.match_reason ? (
                    <p className="text-xs mb-2 leading-relaxed" style={{ color: "#2D6A4F" }}>
                      {ini.match_reason}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground mb-2 line-clamp-1">{ini.problem}</p>
                  )}

                  <div className="flex items-center gap-3 flex-wrap">
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
              ))}
            </div>
          )}
        </section>

        {/* Column 2: Partnership matches — secondary, compact */}
        <section className="lg:order-2 rounded-2xl bg-muted/30 border border-border p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                Potential partners
              </h3>
            </div>
          </div>

          {!partnershipEligible ? (
            <div className="rounded-xl border border-dashed border-border bg-card p-6 text-center flex flex-col items-center justify-center min-h-[220px]">
              <Building2 className="w-6 h-6 text-muted-foreground/20 mb-3" />
              <p className="text-xs font-medium text-foreground mb-1">Locked for now</p>
              <p className="text-[11px] text-muted-foreground">
                Unlocks at 80% mandate completion — you're at {mandateScore}%.
              </p>
            </div>
          ) : loadingPartnerships ? (
            <div className="space-y-2">
              {[1, 2].map(i => (
                <div key={i} className="h-16 rounded-xl border border-border bg-card animate-pulse" />
              ))}
            </div>
          ) : partnershipMatches.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-5 text-center">
              <p className="text-xs text-muted-foreground">No partnership matches yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {partnershipMatches.map((m: any) => (
                <button key={m.matched_org_id} type="button"
                  onClick={() => navigate(`/dashboard/natives?tab=organisation&user=${m.org?.user_id ?? ""}`)}
                  className="w-full text-left rounded-xl border border-border bg-card px-4 py-3 hover:border-[#2D6A4F]/30 transition-colors group">
                  <div className="flex items-center justify-between gap-3 mb-1.5">
                    <p className="text-xs font-semibold text-foreground group-hover:text-[#2D6A4F] transition-colors truncate">
                      {m.org?.organisation_name ?? "Organisation"}
                    </p>
                    <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{
                        background: m.fit_score >= 70 ? "#eaf5ee" : "#f5f5f5",
                        color: m.fit_score >= 70 ? "#2D6A4F" : "#6b7280",
                      }}>
                      {m.fit_score}%
                    </span>
                  </div>
                  {m.criteria ? (
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                      {[
                        ["sector_fit", "Sector"], ["geography_fit", "Geography"], ["need_offer_fit", "Need/offer"],
                        ["working_style_fit", "Style"], ["stage_readiness_fit", "Stage"],
                      ].map(([key, label]) => (
                        <span key={key} className="text-[10px]" style={{
                          color: m.criteria[key] === "match" ? "#2D6A4F" : m.criteria[key] === "partial" ? "#C45C26" : "#9ca3af",
                        }}>
                          {label} {m.criteria[key] === "match" ? "✓" : m.criteria[key] === "partial" ? "●" : "–"}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground truncate">{m.key_synergy ?? m.rationale}</p>
                  )}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Metrics rail */}
        <aside className="lg:order-3 order-3 grid grid-cols-3 gap-3 lg:grid-cols-1 lg:gap-3 content-start">
          {metricTiles.map(m => {
            const Icon = m.icon;
            return (
              <button key={m.label} type="button" onClick={m.onClick}
                className="w-full text-left rounded-xl border bg-card px-4 py-3 hover:border-[#2D6A4F]/40 transition-colors group flex items-center justify-between gap-3"
                style={{ borderColor: m.accent ? "#C45C26" : undefined }}>
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground truncate">{m.label}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{m.sub}</p>
                  </div>
                </div>
                <p className="text-xl font-bold text-foreground tracking-tight group-hover:text-[#2D6A4F] transition-colors shrink-0">{m.value}</p>
              </button>
            );
          })}
        </aside>
      </div>

    </div>
  );
}
