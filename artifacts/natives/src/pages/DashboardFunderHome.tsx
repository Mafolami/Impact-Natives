import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { Sparkles, Bookmark, MessageSquare, Users, Building2, UserCheck } from "lucide-react";

// Maps a pass reason to the specific mandate field it points at.
const PASS_REASON_FIELD_MAP: Record<string, { label: string; hint: string }> = {
  "Budget mismatch": { label: "grant range", hint: "Your stated grant range may not match what initiatives are asking for." },
  "Geography mismatch": { label: "geographic focus", hint: "Initiatives outside your stated geography keep coming up as passes." },
  "Too early stage": { label: "stage preference", hint: "A number of passes suggest your stage preference could be narrowed or widened." },
  "Outside mandate": { label: "sector focus", hint: "A number of passes suggest your sector focus or investment thesis could be sharper." },
};
const PASS_INSIGHT_THRESHOLD = 3;

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

function formatMissingList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

// Merges a matched org's identity fields (organizations) with its SPECIFIC
// matched listing's own ask fields (partnership_listings). Fix, part of the
// per-listing matching rebuild: this card used to be built entirely from
// organizations.partnership_sought/stage/budget -- the legacy org-wide
// mirror that only ever reflects whichever listing was saved most recently.
// Falls back to the org row alone if matched_listing_id is missing for any
// reason, rather than throwing.
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

type PartnershipState = "loading" | "no_listing" | "listing_incomplete" | "locked_free" | "empty" | "ready";

export default function FunderHome({ profile }: { profile: any }) {
  const [, navigate] = useLocation();
  const [matchedInitiatives, setMatchedInitiatives] = useState<any[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [initiativeMinScore, setInitiativeMinScore] = useState(40);
  const [matchingUnavailable, setMatchingUnavailable] = useState(false);
  // True when the server's eligible:false came from the Plus-tier gate
  // specifically, not from a genuine "nothing scored yet" state -- these
  // need different messaging: one says upgrade, the other says wait.
  const [initiativesRequireUpgrade, setInitiativesRequireUpgrade] = useState(false);
  const [aiMatching, setAiMatching] = useState(false);
  const [mandateScore, setMandateScore] = useState(0);
  const [missingMandateFields, setMissingMandateFields] = useState<string[]>([]);
  const [matchProgress, setMatchProgress] = useState(0);  const [orgId, setOrgId] = useState<string | null>(null);
  const [conversations, setConversations] = useState(0);
  const [awaitingResponse, setAwaitingResponse] = useState(0);
  const [savedCount, setSavedCount] = useState(0);
  const [expressedCount, setExpressedCount] = useState(0);
  const [passInsight, setPassInsight] = useState<{ reason: string; count: number; label: string; hint: string } | null>(null);

  // Partnership matches — secondary here, since a funder's core action is
  // funding initiatives, not partnering with peer organisations directly.
  //
  // Fix, per-listing matching rebuild: this section used to gate entirely
  // on a CLIENT-SIDE, org-profile-based completeness score (mandateScore
  // < 80) computed from investment_thesis/geographic_focus/etc -- the
  // exact formula that was deliberately REMOVED from the backend
  // (refresh-partnership-matches) when eligibility moved to a per-listing
  // basis. That local pre-gate never got updated to match, so a funder
  // with a mostly-empty org profile but a fully complete, published
  // listing was told "locked" and the real, correct backend was never
  // even asked. Now calls refresh-partnership-matches unconditionally and
  // trusts its own eligible/reason/completeness response -- the same
  // pattern ImplementerMatches.tsx already uses correctly. `completeness`
  // in that response is now LISTING completeness, not org completeness --
  // it is a genuinely different number from mandateScore and must never
  // be written into mandateScore (the old code did exactly that, which
  // would have corrupted the unrelated mandate-completion banner above).
  const [partnershipMatches, setPartnershipMatches] = useState<any[]>([]);
  const [partnershipState, setPartnershipState] = useState<PartnershipState>("loading");
  const [partnershipListingCompleteness, setPartnershipListingCompleteness] = useState(0);
  const [loadingPartnerships, setLoadingPartnerships] = useState(true);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = profile?.full_name?.split(" ")[0] ?? "there";
  function sleep(ms: number) { return new Promise(resolve => setTimeout(resolve, ms)); }

  useEffect(() => {
    if (!profile?.id) return;

    async function loadAll() {
      // Mandate completion
      const { data: orgData } = await supabase
        .from("organizations")
        .select("id,grant_range_min,grant_range_max,grant_currency,funding_instruments,geographic_focus,stage_preference,mandate_sectors,mandate_sdgs,investment_thesis")
        .eq("user_id", profile.id)
        .single();
      if (orgData) {
        setOrgId(orgData.id);
        // Weighted, not equal-share — must stay identical to
        // funderCompleteness() in refresh-initiative-matches (initiative
        // matching only -- partnership matching's eligibility gate moved
        // to a per-listing formula and no longer uses this at all) so the
        // % never drifts between the client estimate and the server's
        // source of truth for initiative matching. Sector focus and
        // geography carry the most weight since generate-deal-memo leans
        // on them hardest; investment thesis is weighted high enough that
        // its absence alone meaningfully dents this score.
        const weightedFields: [string, boolean, number][] = [
          ["sector focus", (orgData.mandate_sectors?.length ?? 0) > 0, 25],
          ["geographic focus", (orgData.geographic_focus?.length ?? 0) > 0, 20],
          ["investment thesis", !!orgData.investment_thesis, 15],
          ["SDG priorities", (orgData.mandate_sdgs?.length ?? 0) > 0, 15],
          ["stage preference", (orgData.stage_preference?.length ?? 0) > 0, 10],
          ["funding instruments", (orgData.funding_instruments?.length ?? 0) > 0, 10],
          ["grant range", !!orgData.grant_range_min && !!orgData.grant_range_max, 5],
        ];
        setMandateScore(Math.round(weightedFields.reduce((sum, [, done, weight]) => sum + (done ? weight : 0), 0)));
        setMissingMandateFields(
          weightedFields.filter(([, done]) => !done).sort((a, b) => b[2] - a[2]).map(([label]) => label)
        );
      }

      // Saved initiatives
      const { data: savedInits } = await supabase
        .from("saved_initiatives")
        .select("initiative_id")
        .eq("user_id", profile.id);
      setSavedCount(savedInits?.length ?? 0);

      // Outbound EOIs sent -- count only, feeds the "Interest expressed"
      // tile linking to Portfolio's Interests Expressed tab. Previously
      // nothing on this page surfaced this at all.
      const { count: eoiCount } = await supabase
        .from("expressions_of_interest")
        .select("id", { count: "exact", head: true })
        .eq("user_id", profile.id);
      setExpressedCount(eoiCount ?? 0);

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
          setMatchingUnavailable(false);
          return true;
        }
        return false;
      };

      const { data: cachedMatches } = await supabase
        .from("initiative_match_cache")
        .select("initiative_id, score, match_reason, criteria")
        .eq("org_id", orgData?.id)
        .order("score", { ascending: false });

        const hadCache = applyCache(cachedMatches ?? []);
      setLoadingMatches(false);

      // Isolated so it can run either awaited-with-loading-UI (nothing to
      // show yet) or fire-and-forget in the background (something's
      // already on screen). Never throws — every failure path resolves to
      // { gotMatches: false } rather than rejecting.
      async function performRefresh(): Promise<{ succeeded: boolean }> {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) return { succeeded: false };
          const res = await fetch(`${supabaseUrl}/functions/v1/refresh-initiative-matches`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          });
          const result = await res.json();
          setInitiativesRequireUpgrade(result.reason === "requires_upgrade");
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
        // Stale-while-revalidate: there's already something on screen, so
        // the refresh (which internally no-ops unless the cache is
        // genuinely stale) runs quietly in the background. If fresher
        // results land while the person's still looking, they swap in;
        // if not, nothing changes. Either way, no loading state, no wait.
        performRefresh();
      } else {
        // Nothing to show yet — this is the one case that still needs a
        // blocking wait, since there's no fallback content to display.
        setAiMatching(true);
        setMatchProgress(4);
        const progressInterval = setInterval(() => {
          setMatchProgress(p => (p >= 92 ? p : p + Math.max(0.5, (92 - p) * 0.08)));
        }, 300);
        const { succeeded } = await performRefresh();
        if (!succeeded) {
          setMatchingUnavailable(true);
        }
        clearInterval(progressInterval);
        setMatchProgress(100);
        await sleep(400);
        setAiMatching(false);
      }
    }

    loadAll();
  }, [profile?.id]);

  // Partnership matches — read cache directly, background refresh only.
  // Secondary feature here, so it stays compact (max 2, single-line cards).
  //
  // Fix, per-listing matching rebuild: no more client-side mandateScore
  // pre-gate (see the comment on partnershipState above). Runs as soon as
  // orgId is known, every time -- refresh-partnership-matches itself
  // decides eligibility now, based on the org's published listings, not
  // this component's own stale copy of a formula that no longer applies
  // here.
  useEffect(() => {
    if (!orgId) return;

    let cancelled = false;

    (async () => {
      setLoadingPartnerships(true);

      // 45-point floor matches match-orgs-for-partnership's bulk-mode
      // inclusion threshold. submitting_listing_id filter keeps
      // score-partnership-fit's separate, unfiltered single-pair rows
      // (directory listing clicks) out of this paint entirely -- without
      // it, a stale or off-topic instant-fit result could flash here
      // exactly as it did on the implementer homepage.
      const { data: cached } = await supabase
        .from("partnership_match_cache")
        .select("matched_org_id, matched_listing_id, fit_score, rationale, key_synergy, criteria, computed_at")
        .eq("org_id", orgId)
        .not("submitting_listing_id", "is", null)
        .gte("fit_score", 45)
        .order("fit_score", { ascending: false })
        .limit(2);

      let paintedMatches: any[] = [];
      if (cached && cached.length > 0) {
        const { orgMap, listingMap } = await fetchOrgAndListingMaps(cached);
        if (!cancelled) {
          paintedMatches = cached.map((m: any) => ({
            ...m,
            org: mergeOrgAndListing(orgMap.get(m.matched_org_id), listingMap.get(m.matched_listing_id)),
          }));
          setPartnershipMatches(paintedMatches);
          setPartnershipState("ready");
        }
      }
      if (!cancelled) setLoadingPartnerships(false);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        if (!cancelled && paintedMatches.length === 0) setPartnershipState("empty");
        return;
      }

      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/refresh-partnership-matches`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
        });
        const result = await res.json();
        if (cancelled) return;

        if (result?.reason === "requires_upgrade") { setPartnershipState("locked_free"); return; }
        if (result?.eligible === false) { setPartnershipState(paintedMatches.length > 0 ? "ready" : "empty"); return; }
        if (result?.reason === "no_published_listing") { setPartnershipState("no_listing"); return; }
        if (result?.reason === "listings_incomplete") {
          setPartnershipListingCompleteness(typeof result.completeness === "number" ? result.completeness : 0);
          setPartnershipState("listing_incomplete");
          return;
        }

        const freshMatches = result?.matches ?? [];
        if (freshMatches.length === 0) { setPartnershipState(paintedMatches.length > 0 ? "ready" : "empty"); return; }

        const { orgMap, listingMap } = await fetchOrgAndListingMaps(freshMatches);
        if (!cancelled) {
          setPartnershipMatches(freshMatches.map((m: any) => ({
            ...m,
            org: mergeOrgAndListing(orgMap.get(m.matched_org_id), listingMap.get(m.matched_listing_id)),
          })));
          setPartnershipState("ready");
        }
      } catch {
        if (!cancelled) setPartnershipState(paintedMatches.length > 0 ? "ready" : "empty");
      }
    })();

    return () => { cancelled = true; };
  }, [orgId]);

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
    {
      label: "Interest expressed",
      value: expressedCount,
      sub: expressedCount > 0 ? "track status" : "none sent yet",
      onClick: () => navigate("/dashboard/portfolio?tab=expressed"),
      icon: UserCheck,
      accent: false,
    },
  ];

  return (
    <div className="flex flex-col -mt-10 -mb-10" style={{ height: "calc(100vh - 81px)", maxHeight: "calc(100vh - 81px)", overflow: "hidden" }}>
      <div className="flex-1 min-h-0 overflow-y-auto -mx-6 px-6 pt-6 pb-10 space-y-8">

        {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[13px] text-black dark:text-white mb-1 uppercase tracking-widest">{greeting}</p>
          <h2 className="text-[25px] font-bold text-black dark:text-white tracking-tight">{firstName}.</h2>
          <p className="text-[15px] text-black dark:text-white mt-1">
            {mandateScore < 60
              ? "Complete your mandate to get better matched initiatives."
              : "Your mandate is active."}
          </p>
        </div>
        <button type="button" onClick={() => navigate("/dashboard/marketplace")}
          className="rounded-full h-9 px-5 bg-[#2D6A4F] hover:bg-[#245c43] text-white text-[15px] font-medium transition-colors">
          Browse all initiatives
        </button>
      </div>

      {/* Metrics strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {metricTiles.map(m => {
          const Icon = m.icon;
          return (
            <button key={m.label} type="button" onClick={m.onClick}
              className="text-center rounded-xl border bg-white dark:bg-card px-4 py-3 hover:border-[#2D6A4F]/40 transition-colors group flex flex-col items-center"
              style={{ borderColor: m.accent ? "#C45C26" : undefined }}>
              <div className="flex items-center justify-center gap-1.5 mb-1.5">
                <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <p className="text-[11px] font-bold uppercase tracking-widest text-black dark:text-white leading-snug text-center">{m.label}</p>
              </div>
              <p className="text-[21px] font-bold text-black dark:text-white tracking-tight group-hover:text-[#2D6A4F] transition-colors">{m.value}</p>
              <p className="text-[13px] text-black dark:text-white leading-snug mt-0.5 text-center">{m.sub}</p>
            </button>
          );
        })}
      </div>

      {/* Mandate completion */}
      {mandateScore < 100 && (
        <div className="rounded-xl border border-dashed border-[#2D6A4F]/30 bg-[#2D6A4F]/5 px-5 py-4 flex items-center justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <p className="text-[15px] font-semibold text-foreground">Mandate {mandateScore}% complete</p>
              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden max-w-[120px]">
                <div className="h-full rounded-full bg-[#2D6A4F] transition-all duration-500"
                  style={{ width: `${mandateScore}%` }} />
              </div>
            </div>
            <p className="text-[13px] text-black dark:text-white">
              {missingMandateFields.length > 0
                ? `Add ${formatMissingList(missingMandateFields)}. This helps sharpen your initiative matches.`
                : ""}
            </p>
          </div>
          <button type="button" onClick={() => navigate("/dashboard/profile")}
            className="shrink-0 text-[13px] font-semibold text-[#2D6A4F] border border-[#2D6A4F]/30 rounded-full px-3 py-1.5 hover:bg-[#2D6A4F]/10 transition-colors whitespace-nowrap">
            Complete mandate
          </button>
        </div>
      )}

      {/* Pass-pattern insight — only shown when a real pattern exists */}
      {passInsight && (
        <div className="rounded-xl border border-[#C45C26]/30 bg-[#C45C26]/5 px-5 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-[15px] font-semibold text-foreground mb-1">
              You've passed on {passInsight.count} initiatives citing "{passInsight.reason}"
            </p>
            <p className="text-[13px] text-black dark:text-white">{passInsight.hint}</p>
          </div>
          <button type="button" onClick={() => navigate("/dashboard/profile")}
            className="shrink-0 text-[13px] font-semibold text-[#C45C26] border border-[#C45C26]/30 rounded-full px-3 py-1.5 hover:bg-[#C45C26]/10 transition-colors whitespace-nowrap">
            Update {passInsight.label}
          </button>
        </div>
      )}

      {/* Kanban: primary matches column, a lighter secondary partnership
          column. Metrics live in the strip above now. Stacks on mobile. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Column 1: Initiative matches — primary */}
        <section className="lg:order-1 rounded-2xl bg-[#2D6A4F]/[0.03] border border-[#2D6A4F]/10 p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="inline-flex text-[13px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
                style={{ background: "#2D6A4F", color: "#ffffff" }}>
                Initiatives for you
              </h3>
              <p className="text-[13px] text-black dark:text-white mt-0.5">Top initiatives, matched to your mandate</p>
            </div>
            <button type="button" onClick={() => navigate("/dashboard/marketplace")}
              className="text-[13px] font-semibold text-[#2D6A4F] border border-[#2D6A4F]/30 rounded-full px-3 py-1.5 hover:bg-[#2D6A4F]/10 transition-colors shrink-0">
              View all
            </button>
          </div>

          {(loadingMatches || aiMatching) ? (
            <div className="space-y-3">
              <div className="space-y-1.5 mb-2">
                <div className="flex items-center justify-between text-[13px] text-[#2D6A4F]">
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
                <div key={i} className="h-24 rounded-xl border border-border bg-white dark:bg-card animate-pulse" />
              ))}
            </div>
          ) : initiativesRequireUpgrade ? (
            <div className="rounded-2xl border border-border bg-white dark:bg-card p-8 text-center">
              <p className="text-[15px] font-medium text-black dark:text-white mb-1">AI-matched initiatives need an upgrade.</p>
              <p className="text-[13px] text-black dark:text-white mb-3">Upgrade to see initiatives matched to your mandate.</p>
              <button type="button" onClick={() => navigate("/dashboard/settings?tab=billing")}
                className="text-[13px] font-semibold text-white bg-[#2D6A4F] rounded-full px-4 py-1.5 hover:bg-[#245c43] transition-colors">
                Upgrade
              </button>
            </div>
          ) : matchingUnavailable && matchedInitiatives.length === 0 ? (
            <div className="rounded-2xl border border-border bg-white dark:bg-card p-8 text-center">
              <p className="text-[15px] font-medium text-black dark:text-white mb-1">Still finding your matches.</p>
              <p className="text-[13px] text-black dark:text-white">Matching is refreshing right now. Check back shortly.</p>
            </div>
          ) : matchedInitiatives.length === 0 ? (
            <div className="rounded-2xl border border-border bg-white dark:bg-card p-8 text-center">
              <p className="text-[15px] font-medium text-black dark:text-white mb-1">No initiatives yet.</p>
              <p className="text-[13px] text-black dark:text-white">Check back as organisations post their work.</p>
            </div>
          ) : (() => {
            const strongMatches = matchedInitiatives.filter((i: any) => (i.score ?? 0) >= initiativeMinScore);
            const otherMatches = matchedInitiatives.filter((i: any) => (i.score ?? 0) < initiativeMinScore);
            const showList = strongMatches.length > 0 ? strongMatches : otherMatches;
            return (
            <div className="space-y-3">
              {strongMatches.length === 0 && otherMatches.length > 0 && (
                <p className="text-[13px] text-black dark:text-white mb-1">
                  No strong matches right now. A few others worth a look:
                </p>
              )}
              {showList.slice(0, 3).map((ini: any) => (
                <div key={ini.id}
                  className="w-full text-left rounded-xl border border-border bg-white dark:bg-card px-5 py-4 hover:border-[#2D6A4F]/30 transition-colors group flex flex-col min-h-[220px]">
                  <button type="button" onClick={() => navigate(`/dashboard/marketplace?initiative=${ini.id}`)} className="w-full text-left">
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <p className="text-[15px] font-semibold text-black dark:text-white group-hover:text-[#2D6A4F] transition-colors break-words">
                        {ini.title}
                      </p>
                      {typeof ini.score === "number" && (
                        <span className="shrink-0 text-[13px] font-bold px-2 py-0.5 rounded-full"
                          style={{
                            background: ini.score >= 70 ? "rgba(45,106,79,0.12)" : ini.score >= 40 ? "rgba(180,83,9,0.12)" : "rgba(239,68,68,0.12)",
                            color: ini.score >= 70 ? "#2D6A4F" : ini.score >= 40 ? "#b45309" : "#ef4444",
                          }}>
                          {ini.score}% criteria match
                        </span>
                      )}
                    </div>
                  </button>

                  {ini.submitter_org && ini.user_id && (
                    <button type="button" onClick={() => navigate(`/dashboard/natives?tab=organisation&user=${ini.user_id}`)}
                      className="inline-flex items-center gap-1 text-[13px] text-[#2D6A4F] hover:underline underline-offset-2 mb-2 w-fit">
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
                          <span className="text-[13px] text-black dark:text-white">{label}</span>
                          <span className="text-[13px] font-medium" style={{
                            color: ini.criteria[key] === "match" ? "#2D6A4F" : ini.criteria[key] === "partial" ? "#F59E0B" : "#EF4444",
                          }}>
                            {ini.criteria[key] === "match" ? "✓ match" : ini.criteria[key] === "partial" ? "● partial" : "✕ no match"}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : ini.match_reason ? (
                    <p className="text-[13px] mb-2 leading-relaxed" style={{ color: "#2D6A4F" }}>
                      {ini.match_reason}
                    </p>
                  ) : (
                    <p className="text-[13px] text-black dark:text-white mb-2 line-clamp-1">{ini.problem}</p>
                  )}

                  <div className="mt-auto pt-2 flex items-center gap-2 flex-wrap">
                    {ini.stage && (
                      <span className="text-[13px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                        style={{ background: "rgba(45,106,79,0.12)", color: "#2D6A4F" }}>
                        {ini.stage}
                      </span>
                    )}
                    {ini.budget_min && ini.budget_max ? (
                      <span className="text-[13px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: "rgba(196,92,38,0.1)", color: "#C45C26" }}>
                        {ini.budget_currency} {Number(ini.budget_min).toLocaleString()} – {Number(ini.budget_max).toLocaleString()}
                      </span>
                    ) : ini.budget_min ? (
                      <span className="text-[13px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: "rgba(196,92,38,0.1)", color: "#C45C26" }}>
                        {ini.budget_currency} {Number(ini.budget_min).toLocaleString()}+
                      </span>
                    ) : null}
                    {ini.locations?.slice(0, 1).map((l: string) => (
                      <span key={l} className="text-[13px] font-semibold px-2 py-0.5 rounded-full"
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

        {/* Column 2: Partnership matches — secondary, compact */}
        <section className="lg:order-2 rounded-2xl bg-muted/30 border border-border p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="inline-flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
                style={{ background: "#C45C26", color: "#ffffff" }}>
                <Building2 className="w-3.5 h-3.5" />
                Potential partners
              </h3>
            </div>
            <button type="button" onClick={() => navigate("/dashboard/partnerships")}
              className="text-[13px] font-semibold text-[#2D6A4F] border border-[#2D6A4F]/30 rounded-full px-3 py-1.5 hover:bg-[#2D6A4F]/10 transition-colors shrink-0">
              View all
            </button>
          </div>

          {partnershipState === "no_listing" ? (
            <div className="rounded-xl border border-dashed border-border bg-white dark:bg-card p-6 text-center flex flex-col items-center justify-center min-h-[220px]">
              <Building2 className="w-6 h-6 text-muted-foreground/20 mb-3" />
              <p className="text-[13px] font-medium text-black dark:text-white mb-1">Publish a partnership listing to get matched</p>
              <p className="text-[13px] text-black dark:text-white mb-3">
                AI matching compares your specific ask to other organisations — you'll need at least one published listing first.
              </p>
              <button type="button" onClick={() => navigate("/dashboard/partnerships")}
                className="text-[13px] font-semibold text-white bg-[#2D6A4F] rounded-full px-4 py-1.5 hover:bg-[#245c43] transition-colors">
                Get Matched
              </button>
            </div>
          ) : partnershipState === "listing_incomplete" ? (
            <div className="rounded-xl border border-dashed border-border bg-white dark:bg-card p-6 text-center flex flex-col items-center justify-center min-h-[220px]">
              <Building2 className="w-6 h-6 text-muted-foreground/20 mb-3" />
              <p className="text-[13px] font-medium text-black dark:text-white mb-1">Your listing needs a bit more detail</p>
              <p className="text-[13px] text-black dark:text-white mb-3">
                You're at {partnershipListingCompleteness}%. Add what you're seeking, your budget, sector, stage, and country to unlock matches.
              </p>
              <button type="button" onClick={() => navigate("/dashboard/partnerships")}
                className="text-[13px] font-semibold text-white bg-[#2D6A4F] rounded-full px-4 py-1.5 hover:bg-[#245c43] transition-colors">
                Complete listing
              </button>
            </div>
          ) : partnershipState === "locked_free" ? (
            <div className="rounded-xl border border-border bg-white dark:bg-card p-6 text-center flex flex-col items-center justify-center min-h-[220px]">
              <Building2 className="w-6 h-6 text-muted-foreground/20 mb-3" />
              <p className="text-[13px] font-medium text-black dark:text-white mb-1">AI-matched partners need an upgrade.</p>
              <p className="text-[13px] text-black dark:text-white mb-3">Upgrade to see organisations matched to your profile.</p>
              <button type="button" onClick={() => navigate("/dashboard/settings?tab=billing")}
                className="text-[13px] font-semibold text-white bg-[#2D6A4F] rounded-full px-4 py-1.5 hover:bg-[#245c43] transition-colors">
                Upgrade
              </button>
            </div>
          ) : loadingPartnerships ? (
            <div className="space-y-2">
              {[1, 2].map(i => (
                <div key={i} className="h-16 rounded-xl border border-border bg-white dark:bg-card animate-pulse" />
              ))}
            </div>
          ) : partnershipMatches.length === 0 ? (
            <div className="rounded-xl border border-border bg-white dark:bg-card p-5 text-center">
              <p className="text-[13px] text-black dark:text-white">No partnership matches yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {partnershipMatches.map((m: any) => (
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
                        ["budget_fit", "Budget"], ["working_style_fit", "Style"], ["stage_readiness_fit", "Stage"],
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
      </div>

      </div>
    </div>
  );
}
