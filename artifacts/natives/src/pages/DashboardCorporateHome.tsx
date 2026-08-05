// ─── DashboardCorporateHome.tsx ───────────────────────────────────────────────
// For org_type: corporate, tech_company, creative_agency_studio
// Oriented around CSR/ESG discovery, adoption pipeline, and partnership tracking

import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { Sparkles, Leaf, Building2, Bookmark, MessageSquare, Users, UserCheck, Handshake } from "lucide-react";

const ESG_PARTNERSHIP_TYPES = ["operational", "strategic", "lead", "other"];

// Some array columns come back as raw Postgres array-literal strings
// (e.g. {Nigeria,Kenya,"United Kingdom"}) instead of real JS arrays,
// depending on how the row was written. Parse defensively before display.
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

// Matches the exact labels used in FindPartnerModalDashboard.tsx's listing
// form — these are real enum values (e.g. "joining_running", "50k_200k"),
// not free text, so they need the same lookup the form itself uses rather
// than generic capitalization.
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

// Maps a pass reason to the specific mandate field it points at, so the
// nudge can send the user to fix the actual thing, not just "your profile".
const PASS_REASON_FIELD_MAP: Record<string, { label: string; hint: string }> = {
  "Budget mismatch": { label: "CSR budget range", hint: "Your stated budget range may not match what initiatives are asking for." },
  "Geography mismatch": { label: "geographic focus", hint: "Initiatives outside your stated geography keep coming up as passes." },
  "Outside mandate": { label: "CSR focus", hint: "A number of passes suggest your CSR focus statement could be sharper." },
};
const PASS_INSIGHT_THRESHOLD = 3;

function formatMissingList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

export default function CorporateHome({ profile }: { profile: any }) {
  const [, navigate] = useLocation();

  const [loadingMatches, setLoadingMatches] = useState(true);
  const [aiMatching, setAiMatching]         = useState(false);
 const [matchedInitiatives, setMatchedInitiatives] = useState<any[]>([]);
  // Server-authoritative threshold for a "strong" match -- defaults to the
  // known corporate value, overridden the moment a live refresh response
  // includes min_score, so it's never hand-kept-in-sync with the backend.
  const [initiativeMinScore, setInitiativeMinScore] = useState(35);
  // True only when matching genuinely produced nothing at all (API error) --
  // distinct from "matching succeeded and found zero strong matches," which
  // still has real, weaker data worth showing.
  const [matchingUnavailable, setMatchingUnavailable] = useState(false);

  // Metrics
  const [savedCount, setSavedCount]         = useState(0);
  const [matchProgress, setMatchProgress]   = useState(0);
  const [awaitingResponse, setAwaitingResponse] = useState(0);
  const [activeConvos, setActiveConvos]     = useState(0);
  const [esgAdoptions, setEsgAdoptions]     = useState(0);
  const [expressedCount, setExpressedCount] = useState(0);
  const [confirmedPartnershipsCount, setConfirmedPartnershipsCount] = useState(0);
  const [passInsight, setPassInsight]       = useState<{ reason: string; count: number; label: string; hint: string } | null>(null);

  // Pipeline
  const [outboundEOIs, setOutboundEOIs] = useState<any[]>([]);
  const [orgData, setOrgData]           = useState<any>(null);

  // Partnership matches
  const [partnershipMatches, setPartnershipMatches] = useState<any[]>([]);
  const [partnershipEligible, setPartnershipEligible] = useState(false);
  const [loadingPartnerships, setLoadingPartnerships] = useState(true);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = profile?.full_name?.split(" ")[0] ?? "there";
  const orgName = profile?.org_name ?? "your organisation";
  function sleep(ms: number) { return new Promise(resolve => setTimeout(resolve, ms)); }

  useEffect(() => {
    if (!profile?.id) return;
    loadAll();
  }, [profile?.id]);

  async function loadAll() {
    // Org profile (for ESG frameworks, sectors, geography, and the completeness score)
    const { data: org } = await supabase
      .from("organizations")
      .select("id, sector, country, esg_frameworks, csr_budget_range, csr_focus_statement, inkind_support, partner_type_preference, geographic_focus, mandate_sectors, mandate_sdgs")
      .eq("user_id", profile.id)
      .maybeSingle();
    setOrgData(org);

    // Confirmed org-to-org partnerships -- real count, distinct from the
    // ESG-adoption-flagged EOIs below. Nothing on this page surfaced this
    // before.
    if (org?.id) {
      const { count: formedCount } = await supabase
        .from("partnership_connections")
        .select("id", { count: "exact", head: true })
        .or(`sender_org_id.eq.${org.id},receiver_org_id.eq.${org.id}`)
        .eq("status", "formed");
      setConfirmedPartnershipsCount(formedCount ?? 0);
    }

    // EOIs sent by this user
    const { data: eoisSent } = await supabase
      .from("expressions_of_interest")
      .select("id, initiative_id, partnership_type, esg_adoption, message, created_at, conversation_id")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false });

    const eois = eoisSent ?? [];
    setEsgAdoptions(eois.filter((e: any) => e.esg_adoption).length);
    setExpressedCount(eois.length);

    // Enrich outbound EOIs with initiative titles
    if (eois.length > 0) {
      const initIds = [...new Set(eois.map((e: any) => e.initiative_id))];
      const { data: inits } = await supabase
        .from("initiative_requests")
        .select("id, title, sectors, locations, status")
        .in("id", initIds);
      const initMap = new Map((inits ?? []).map((i: any) => [i.id, i]));

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

    // Active conversations + awaiting-your-response (last message from the
    // other party, conversation still open — distinct from a raw unread count)
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
      const openIds = (openConvs ?? []).filter((c: any) => !c.funder_closed_at).map((c: any) => c.id);
      setActiveConvos(openIds.length);

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

    // Saved — combines saved_initiatives and saved_organizations, since both
    // exist as separate features. Not a decision queue, just a "revisit" count.
    const [{ data: savedInits }, { data: savedOrgs }] = await Promise.all([
      supabase.from("saved_initiatives").select("initiative_id").eq("user_id", profile.id),
      supabase.from("saved_organizations").select("organization_id").eq("user_id", profile.id),
    ]);
    setSavedCount((savedInits?.length ?? 0) + (savedOrgs?.length ?? 0));

    // Pass-reason aggregation — only surfaces when a real pattern exists and
    // maps to something the person can actually go fix.
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

    // Load ESG-aligned initiatives for AI matching
    const { data: initiatives } = await supabase
      .from("initiative_requests")
      .select("id,title,sectors,locations,status,eois,created_at,problem,outcome,budget,esg_alignment,specific_ask,stage,sdg_tags,submitter_org,user_id")
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(15);

    if (!initiatives?.length) {
      setLoadingMatches(false);
    } else {
      // Prioritise ESG-aligned initiatives
      const esgFirst = [...initiatives].sort((a: any, b: any) => {
        if (a.esg_alignment && !b.esg_alignment) return -1;
        if (!a.esg_alignment && b.esg_alignment) return 1;
        return 0;
      });

      // Cache-first: read persisted match scores directly so the tile
      // renders immediately and never goes blank if the background refresh
      // hits a Groq rate limit. A stale/missing cache is only ever
      // refreshed by refresh-initiative-matches below, which leaves a good
      // cache untouched on failure.
      const applyCache = (rows: { initiative_id: string; score: number; match_reason: string; criteria?: any }[]) => {
        if (!rows?.length) return false;
        const scoreMap = Object.fromEntries(rows.map(r => [r.initiative_id, r]));
        const ranked = esgFirst
          .filter((ini: any) => scoreMap[ini.id])
          .map((ini: any) => ({ ...ini, score: scoreMap[ini.id].score, match_reason: scoreMap[ini.id].match_reason, criteria: scoreMap[ini.id].criteria }))
          .sort((a: any, b: any) => b.score - a.score);
        if (ranked.length > 0) {
          setMatchedInitiatives(ranked);
          setMatchingUnavailable(false);
          return true;
        }
        return false;
      };

      const { data: cachedMatches } = await supabase
        .from("initiative_match_cache")
        .select("initiative_id, score, match_reason, criteria")
        .eq("org_id", org?.id)
        .order("score", { ascending: false });

        const hadCache = applyCache(cachedMatches ?? []);
      setLoadingMatches(false);

      // "succeeded" means the call itself worked, whether or not it found
      // anything -- unlike the old gotMatches, which conflated "the API
      // failed" with "the API worked and found nothing" and drove the same
      // silent raw-initiative fallback for both.
      async function performRefresh(): Promise<{ succeeded: boolean }> {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) return { succeeded: false };
          const res = await fetch(`${supabaseUrl}/functions/v1/refresh-initiative-matches`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          });
          const result = await res.json();
          if (result.error) return { succeeded: false };
          if (typeof result.min_score === "number") setInitiativeMinScore(result.min_score);
          setMatchingUnavailable(false);
          if (result.matches?.length) {
            applyCache(result.matches.map((m: any) => ({
              initiative_id: m.initiative_id, score: m.score, match_reason: m.match_reason, criteria: m.criteria,
            })));
          }
          return { succeeded: true };
        } catch {
          return { succeeded: false };
        }
      }

      if (hadCache) {
        performRefresh();
      } else {
        setAiMatching(true);
        setMatchProgress(4);
        const progressInterval = setInterval(() => {
          setMatchProgress(p => (p >= 92 ? p : p + Math.max(0.5, (92 - p) * 0.08)));
        }, 300);
        const { succeeded } = await performRefresh();
        if (!succeeded) {
          // No real scored data exists -- say so plainly instead of
          // showing unscored initiatives dressed up as matches.
          setMatchingUnavailable(true);
        }
        clearInterval(progressInterval);
        setMatchProgress(100);
        await sleep(400);
        setAiMatching(false);
      }
    }
  }

  // First-paint estimate only. The refresh-partnership-matches edge
  // function computes this same 7-field formula independently server-side —
  // rather than trusting two separately-maintained copies to never drift
  // (the exact bug pattern that caused the org_type mismatch earlier),
  // completenessOverride gets set from the server's answer once it responds,
  // and displayedCompleteness prefers that over the local estimate.
  // Weighted, not equal-share — must stay identical to
  // corporateCompleteness() in refresh-partnership-matches. Focus statement
  // carries the most weight (generate-csr-brief's recommendation pivots on
  // it), geography and sector tied next since both have dedicated
  // anti-fabrication rules in that prompt, then a taper for supporting
  // fields with no equivalent guardrail built around them.
  const csrWeightedFields: [string, boolean, number][] = [
    ["a CSR/ESG focus statement", !!orgData?.csr_focus_statement, 25],
    ["geographic focus", (orgData?.geographic_focus?.length ?? 0) > 0, 20],
    ["sector focus", (orgData?.mandate_sectors?.length ?? 0) > 0, 20],
    ["ESG reporting frameworks", (orgData?.esg_frameworks?.length ?? 0) > 0, 15],
    ["your CSR/ESG budget range", !!orgData?.csr_budget_range, 10],
    ["what you can bring to a partnership", (orgData?.inkind_support?.length ?? 0) > 0, 5],
    ["preferred partner types", (orgData?.partner_type_preference?.length ?? 0) > 0, 5],
  ];
  const csrCompleteness = Math.round(csrWeightedFields.reduce((sum, [, done, weight]) => sum + (done ? weight : 0), 0));
  const missingCsrFields = csrWeightedFields.filter(([, done]) => !done).sort((a, b) => b[2] - a[2]).map(([label]) => label);
  const [completenessOverride, setCompletenessOverride] = useState<number | null>(null);
  const displayedCompleteness = completenessOverride ?? csrCompleteness;

  // Partnership matches — read the cache directly (fast), and fire a
  // background refresh (not awaited) to keep it warm for next visit. Only
  // runs once the org clears the 80% completeness bar.
  useEffect(() => {
    if (!orgData?.id) return;

    if (csrCompleteness < 80) {
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
        .eq("org_id", orgData.id)
        .order("fit_score", { ascending: false })
        .limit(3);

      if (cached && cached.length > 0) {
        const orgIds = cached.map((m: any) => m.matched_org_id);
        const { data: orgs } = await supabase
          .from("organizations")
          .select("id, user_id, organisation_name, organisation_type, country, partnership_stage, partnership_budget, partnership_sought, needs")
          .in("id", orgIds);
        const orgMap = new Map((orgs ?? []).map((o: any) => [o.id, o]));
        if (!cancelled) {
          setPartnershipMatches(cached.map((m: any) => ({ ...m, org: orgMap.get(m.matched_org_id) })));
        }
      }
      if (!cancelled) setLoadingPartnerships(false);

      // Background refresh, fire-and-forget for the match data — but still
      // read completeness back from the response, so the server's answer
      // (single source of truth) can correct the client-side estimate.
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        fetch(`${supabaseUrl}/functions/v1/refresh-partnership-matches`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
        }).then(res => res.json()).then(result => {
          if (!cancelled && typeof result?.completeness === "number") {
            setCompletenessOverride(result.completeness);
          }
        }).catch(() => {});
      }
    })();

    return () => { cancelled = true; };
  }, [orgData?.id, csrCompleteness]);

  const metricTiles = [
    {
      label: "Saved",
      value: savedCount,
      sub: savedCount > 0 ? "to review" : "nothing saved",
      onClick: () => navigate("/dashboard/marketplace"),
      icon: Bookmark,
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
      label: "Active conversations",
      value: activeConvos,
      sub: "open threads",
      onClick: () => navigate("/dashboard/messages"),
      icon: Users,
      accent: false,
    },
    {
      label: "ESG/CSR adoptions",
      value: esgAdoptions,
      sub: "flagged as ESG",
      onClick: () => navigate("/dashboard/portfolio?tab=expressed"),
      icon: Leaf,
      accent: false,
    },
    {
      label: "Interest expressed",
      value: expressedCount,
      sub: expressedCount > 0 ? "track status" : "none sent yet",
      onClick: () => navigate("/dashboard/portfolio?tab=expressed"),
      icon: UserCheck,
      accent: false,
    },
    {
      label: "Confirmed partnerships",
      value: confirmedPartnershipsCount,
      sub: confirmedPartnershipsCount > 0 ? "formed" : "none yet",
      onClick: () => navigate("/dashboard/portfolio?tab=partnerships"),
      icon: Handshake,
      accent: false,
    },
  ];

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs text-muted-foreground mb-1 uppercase tracking-widest">{greeting}</p>
          <h2 className="text-2xl font-bold text-black dark:text-white tracking-tight">{firstName}.</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {displayedCompleteness >= 60
              ? `Your profile is active. Discover potential initiatives and partnerships for ${orgName}.`
              : "Complete your profile to get better matched initiatives."}
          </p>
        </div>
        <button type="button" onClick={() => navigate("/dashboard/marketplace")}
          className="rounded-full h-9 px-5 bg-[#2D6A4F] hover:bg-[#245c43] text-white text-sm font-medium transition-colors">
          Browse initiatives
        </button>
      </div>

      {/* Metrics strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {metricTiles.map(m => {
          const Icon = m.icon;
          return (
            <button key={m.label} type="button" onClick={m.onClick}
              className="text-center rounded-xl border bg-white dark:bg-card px-4 py-3 hover:border-[#2D6A4F]/40 transition-colors group flex flex-col items-center"
              style={{ borderColor: m.accent ? "#C45C26" : undefined }}>
              <div className="flex items-center justify-center gap-1.5 mb-1.5">
                <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground leading-snug text-center">{m.label}</p>
              </div>
              <p className="text-xl font-bold text-black dark:text-white tracking-tight group-hover:text-[#2D6A4F] transition-colors">{m.value}</p>
              <p className="text-xs text-muted-foreground leading-snug mt-0.5 text-center">{m.sub}</p>
            </button>
          );
        })}
      </div>

      {/* CSR profile nudge */}
      {displayedCompleteness < 100 && (
        <div className="rounded-xl border border-dashed border-[#2D6A4F]/30 bg-[#2D6A4F]/5 px-5 py-4 flex items-center justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <p className="text-sm font-semibold text-foreground">CSR profile {displayedCompleteness}% complete</p>
              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden max-w-[120px]">
                <div className="h-full rounded-full bg-[#2D6A4F] transition-all duration-500"
                  style={{ width: `${displayedCompleteness}%` }} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {missingCsrFields.length > 0
                ? `Add ${formatMissingList(missingCsrFields)}${displayedCompleteness < 80 ? " — 80% unlocks partnership matches too." : "."}`
                : ""}
            </p>
          </div>
          <button type="button" onClick={() => navigate("/dashboard/profile")}
            className="shrink-0 text-xs font-semibold text-[#2D6A4F] border border-[#2D6A4F]/30 rounded-full px-3 py-1.5 hover:bg-[#2D6A4F]/10 transition-colors whitespace-nowrap">
            Complete profile
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

      {/* Kanban: matches in two columns. Metrics live in the strip above
          now. Stacks to a single column on mobile. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Column 1: Initiative matches */}
        <section className="lg:order-1 rounded-2xl bg-[#2D6A4F]/[0.03] border border-[#2D6A4F]/10 p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
                style={{ background: "#2D6A4F", color: "#ffffff" }}>
                <Leaf className="w-3.5 h-3.5" />
                Initiative matches
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">Top 3, matched to your mandate</p>
            </div>
            <button type="button" onClick={() => navigate("/dashboard/marketplace")}
              className="text-xs font-semibold text-[#2D6A4F] border border-[#2D6A4F]/30 rounded-full px-3 py-1.5 hover:bg-[#2D6A4F]/10 transition-colors shrink-0">
              View all
            </button>
          </div>

          {(loadingMatches || aiMatching) ? (
            <div className="space-y-3">
              <div className="space-y-1.5 mb-2">
                <div className="flex items-center justify-between text-xs text-[#2D6A4F]">
                  <span className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                    Finding your best matches
                  </span>
                  <span className="font-semibold tabular-nums">{Math.round(matchProgress)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-[#2D6A4F] transition-all duration-300 ease-out" style={{ width: `${matchProgress}%` }} />
                </div>
              </div>
              {[1, 2, 3].map(i => (
                <div key={i} className="h-32 rounded-xl border border-border bg-white dark:bg-card animate-pulse" />
              ))}
            </div>
          ) : matchingUnavailable && matchedInitiatives.length === 0 ? (
            <div className="rounded-xl border border-border bg-white dark:bg-card p-8 text-center min-h-[280px] flex flex-col items-center justify-center">
              <Leaf className="w-6 h-6 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-medium text-black dark:text-white mb-1">Still finding your matches.</p>
              <p className="text-xs text-muted-foreground mb-4">
                Matching is refreshing right now. Check back shortly.
              </p>
            </div>
          ) : matchedInitiatives.length === 0 ? (
            <div className="rounded-xl border border-border bg-white dark:bg-card p-8 text-center min-h-[280px] flex flex-col items-center justify-center">
              <Leaf className="w-6 h-6 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-medium text-black dark:text-white mb-1">No ESG initiatives matched yet.</p>
              <p className="text-xs text-muted-foreground mb-4">
                Complete your CSR profile or browse all initiatives to find the right fit.
              </p>
              <button type="button" onClick={() => navigate("/dashboard/marketplace")}
                className="text-xs font-semibold text-[#2D6A4F] border border-[#2D6A4F]/30 rounded-full px-3 py-1.5 hover:bg-[#2D6A4F]/10 transition-colors">
                Browse marketplace
              </button>
            </div>
          ) : (() => {
            const strongMatches = matchedInitiatives.filter((i: any) => (i.score ?? 0) >= initiativeMinScore);
            const otherMatches = matchedInitiatives.filter((i: any) => (i.score ?? 0) < initiativeMinScore);
            const showList = strongMatches.length > 0 ? strongMatches : otherMatches;
            return (
            <div className="space-y-3">
              {strongMatches.length === 0 && otherMatches.length > 0 && (
                <p className="text-xs text-muted-foreground mb-1">
                  No strong matches right now. A few others worth a look:
                </p>
              )}
              {showList.slice(0, 3).map((ini: any) => (
                <div key={ini.id}
                  className="w-full text-left rounded-xl border border-border bg-white dark:bg-card px-5 py-4 hover:border-[#2D6A4F]/30 transition-colors group flex flex-col min-h-[220px]">
                  <button type="button" onClick={() => navigate(`/dashboard/marketplace?initiative=${ini.id}`)} className="w-full text-left">
                    <div className="flex items-start justify-between gap-3 mb-1 flex-wrap">
                      <p className="text-sm font-semibold text-black dark:text-white group-hover:text-[#2D6A4F] transition-colors break-words">
                        {ini.title}
                      </p>
                      <div className="flex items-center gap-2 shrink-0">
                        {ini.esg_alignment && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                            style={{ background: "rgba(46,125,50,0.12)", color: "#2e7d32" }}>
                            <Leaf className="w-3 h-3" /> ESG/CSR
                          </span>
                        )}
                        {typeof ini.score === "number" && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                            style={{
                              background: ini.score >= 70 ? "rgba(45,106,79,0.12)" : ini.score >= 40 ? "rgba(180,83,9,0.12)" : "rgba(239,68,68,0.12)",
                              color: ini.score >= 70 ? "#2D6A4F" : ini.score >= 40 ? "#b45309" : "#ef4444",
                            }}>
                            {ini.score}% criteria match
                          </span>
                        )}
                      </div>
                    </div>
                  </button>

                  {ini.submitter_org && ini.user_id && (
                    <button type="button" onClick={() => navigate(`/dashboard/natives?tab=organisation&user=${ini.user_id}`)}
                      className="inline-flex items-center gap-1 text-xs text-[#2D6A4F] hover:underline underline-offset-2 mb-2 w-fit">
                      <Building2 className="w-3.5 h-3.5" />
                      {ini.submitter_org}
                    </button>
                  )}

                  {ini.criteria ? (
                    <div className="flex flex-col gap-1 mb-2">
                      {[
                        ["sector_fit", "Sector"], ["geography_fit", "Geography"], ["stage_fit", "Stage"],
                        ["budget_fit", "Budget"], ["dd_fit", "DD readiness"], ["esg_fit", "ESG fit"], ["support_type_fit", "Support type"],
                      ].filter(([key]) => ini.criteria[key]).map(([key, label]) => (
                        <div key={key} className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">{label}</span>
                          <span className="text-xs font-medium" style={{
                            color: ini.criteria[key] === "match" ? "#2D6A4F" : ini.criteria[key] === "partial" ? "#F59E0B" : "#EF4444",
                          }}>
                            {ini.criteria[key] === "match" ? "✓ match" : ini.criteria[key] === "partial" ? "● partial" : "✕ no match"}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : ini.match_reason ? (
                    <p className="text-xs mb-2 leading-relaxed text-[#2D6A4F]">{ini.match_reason}</p>
                  ) : (
                    <p className="text-xs text-black dark:text-white mb-2 line-clamp-1">{ini.problem}</p>
                  )}

                  <div className="mt-auto pt-2 flex items-center gap-2 flex-wrap">
                    {ini.stage && (
                      <span className="text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                        style={{ background: "rgba(45,106,79,0.12)", color: "#2D6A4F" }}>
                        {ini.stage}
                      </span>
                    )}
                    {ini.budget && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: "rgba(196,92,38,0.1)", color: "#C45C26" }}>
                        {ini.budget}
                      </span>
                    )}
                    {ini.locations?.slice(0, 1).map((l: string) => (
                      <span key={l} className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: "rgba(24,95,165,0.12)", color: "#185FA5" }}>
                        {l}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              </div>
              );
            })()}
          </section>

          {/* Column 2: Partnership matches */}
        <section className="lg:order-2 rounded-2xl bg-[#C45C26]/[0.03] border border-[#C45C26]/10 p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
                style={{ background: "#C45C26", color: "#ffffff" }}>
                <Building2 className="w-3.5 h-3.5" />
                Partnership matches
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">Top 3 organisations to partner with</p>
            </div>
            <button type="button" onClick={() => navigate("/dashboard/partnerships")}
              className="text-xs font-semibold text-[#2D6A4F] border border-[#2D6A4F]/30 rounded-full px-3 py-1.5 hover:bg-[#2D6A4F]/10 transition-colors shrink-0">
              View all
            </button>
          </div>

          {!partnershipEligible ? (
            <div className="rounded-2xl border border-dashed border-border bg-white dark:bg-card p-8 text-center flex flex-col items-center justify-center min-h-[300px]">
              <Building2 className="w-8 h-8 text-muted-foreground/20 mb-4" />
              <p className="text-sm font-medium text-black dark:text-white mb-1">Partnership matches are locked</p>
              <p className="text-xs text-muted-foreground max-w-[220px] mb-4">
                Unlocks once your CSR profile hits 80% — you're at {displayedCompleteness}%.
              </p>
              <button type="button" onClick={() => navigate("/dashboard/profile")}
                className="text-xs font-semibold text-[#2D6A4F] border border-[#2D6A4F]/30 rounded-full px-3 py-1.5 hover:bg-[#2D6A4F]/10 transition-colors">
                Complete profile
              </button>
            </div>
          ) : loadingPartnerships ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-24 rounded-xl border border-border bg-white dark:bg-card animate-pulse" />
              ))}
            </div>
          ) : partnershipMatches.length === 0 ? (
            <div className="rounded-2xl border border-border bg-white dark:bg-card p-8 text-center">
              <Building2 className="w-6 h-6 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-medium text-black dark:text-white mb-1">No partnership matches yet.</p>
              <p className="text-xs text-muted-foreground">Check back soon — this refreshes automatically.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {partnershipMatches.map((m: any) => (
                <button key={m.matched_org_id} type="button"
                  onClick={() => navigate(`/dashboard/partnerships?org=${m.org?.id ?? ""}`)}
                  className="w-full text-left rounded-xl border border-border bg-white dark:bg-card px-5 py-4 hover:border-[#2D6A4F]/30 transition-colors group flex flex-col min-h-[220px]">
                  <p className="text-sm font-semibold text-black dark:text-white group-hover:text-[#2D6A4F] transition-colors break-words mb-1">
                    {m.org?.organisation_name ?? "Organisation"}
                  </p>
                  <p className="text-xs text-muted-foreground break-words mb-2">
                    Seeking {m.org?.partnership_sought || (m.org?.needs?.length ? m.org.needs.join(", ") : "a partnership")}
                  </p>
                  <span className="inline-flex w-fit text-xs font-bold px-2 py-0.5 rounded-full mb-2"
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
                        ["working_style_fit", "Working style"], ["stage_readiness_fit", "Stage readiness"],
                      ].map(([key, label]) => (
                        <div key={key} className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">{label}</span>
                          <span className="text-xs font-medium" style={{
                            color: m.criteria[key] === "match" ? "#2D6A4F" : m.criteria[key] === "partial" ? "#F59E0B" : "#EF4444",
                          }}>
                            {m.criteria[key] === "match" ? "✓ match" : m.criteria[key] === "partial" ? "● partial" : "✕ no match"}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs mb-2 leading-relaxed text-[#2D6A4F]">{m.rationale}</p>
                  )}
                  <div className="mt-auto pt-2 flex items-center gap-2 flex-wrap">
                    {m.org?.partnership_stage && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: "rgba(45,106,79,0.12)", color: "#2D6A4F" }}>
                        {PARTNERSHIP_STAGE_LABELS[m.org.partnership_stage] ?? m.org.partnership_stage}
                      </span>
                    )}
                    {m.org?.partnership_budget && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: "rgba(196,92,38,0.1)", color: "#C45C26" }}>
                        {PARTNERSHIP_BUDGET_LABELS[m.org.partnership_budget] ?? m.org.partnership_budget}
                      </span>
                    )}
                    {parsePgArray(m.org?.country).length > 0 && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
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
      </div>

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
              className="text-xs font-semibold text-[#2D6A4F] border border-[#2D6A4F]/30 rounded-full px-3 py-1.5 hover:bg-[#2D6A4F]/10 transition-colors">
              View all
            </button>
          </div>

          <div className="space-y-2">
            {outboundEOIs.map((eoi: any) => {
              const status = eoi.conversation_status;
              const statusConfig = status === "open"
                ? { label: "Active",   bg: "rgba(45,106,79,0.12)", color: "#2D6A4F" }
                : status === "declined"
                ? { label: "Declined", bg: "rgba(239,68,68,0.12)", color: "#ef4444" }
                : status === "confirmed"
                ? { label: "Confirmed", bg: "rgba(3,105,161,0.12)", color: "#0369a1" }
                : { label: "Pending",  bg: "rgba(180,83,9,0.12)", color: "#b45309" };

              return (
                <button key={eoi.id} type="button"
                  onClick={() => navigate(`/dashboard/marketplace?initiative=${eoi.initiative_id}`)}
                  className="w-full text-left rounded-xl border border-border bg-white dark:bg-card px-5 py-3 hover:border-[#2D6A4F]/30 transition-colors group flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-black dark:text-white group-hover:text-[#2D6A4F] transition-colors truncate">
                      {eoi.initiative?.title ?? "Initiative"}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {eoi.esg_adoption && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: "rgba(46,125,50,0.12)", color: "#2e7d32" }}>
                          <Leaf className="w-2.5 h-2.5" /> ESG adoption
                        </span>
                      )}
                      {eoi.initiative?.sectors?.slice(0, 1).map((s: string) => (
                        <span key={s} className="text-xs text-muted-foreground">{s}</span>
                      ))}
                      {eoi.initiative?.locations?.slice(0, 1).map((l: string) => (
                        <span key={l} className="text-xs text-muted-foreground">{l}</span>
                      ))}
                    </div>
                  </div>
                  <span className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full"
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