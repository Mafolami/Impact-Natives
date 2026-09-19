// ─── DashboardPartnerships.tsx ───────────────────────────────────────────────
import { useEffect, useState, useRef } from "react";
import { ORG_TYPE_FILTERS } from "@/lib/orgTypes";
import { supabase } from "@/lib/supabase";
import { Handshake, Loader2, Search, CheckCircle2, ShieldCheck, SlidersHorizontal, Award } from "lucide-react";
import { SECTOR_OPTIONS } from "@/lib/sectors";
import { FindPartnerModalDashboard } from "./FindPartnerModalDashboard";
import { useAuth } from "@/context/AuthContext";
import { OrgDetailPanel, type OrgRow } from "@/components/dashboard/OrgDetailPanel";
import { useOrgActions } from "@/hooks/useOrgActions";

function orgTypeLabel(value: string | null | undefined): string {
  if (!value) return "";
  return ORG_TYPE_FILTERS.find(o => o.value === value)?.label ?? value.replace(/_/g, " ");
}

function normalizeArr(val: string | string[] | null | undefined): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === "string" && val.startsWith("{") && val.endsWith("}")) {
    const inner = val.slice(1, -1);
    const matches = inner.match(/("(?:[^"\\]|\\.)*"|[^,]+)/g) ?? [];
    return matches.map(m => m.replace(/^"|"$/g, "").trim()).filter(Boolean);
  }
  try { const p = JSON.parse(val); return Array.isArray(p) ? p : [val]; }
  catch { return [val]; }
}

// ─── Compact list card ────────────────────────────────────────────────────────
function ListCard({ org, selected, onClick, isSaved, onToggleSave, mouExecuted }: {
  org: OrgRow; selected: boolean; onClick: () => void;
  isSaved: boolean; onToggleSave: (e: React.MouseEvent) => void;
  mouExecuted: boolean;
}) {
  const isVerified = org.verification_status === "verified";
  const countries = normalizeArr(org.country);

  return (
    <div onClick={onClick}
      className={`relative cursor-pointer px-5 py-4 border-b transition-all group ${
        selected
          ? "bg-[#2D6A4F]/[0.08] border-l-[3px] border-l-[#2D6A4F] border-b-border"
          : "hover:bg-[#2D6A4F]/10/50 border-l-[3px] border-l-transparent border-b-border/60"
      }`}>

      {/* Org name + save */}
      <div className="flex items-center justify-between gap-2 mb-0.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`text-[15px] font-bold truncate ${selected ? "text-[#2D6A4F]" : "text-foreground"}`}>
            {org.organisation_name}
          </span>
          {isVerified && <ShieldCheck className="w-3 h-3 shrink-0 text-[#2D6A4F]" />}
        </div>
        <button type="button" onClick={e => { e.stopPropagation(); onToggleSave(e); }}
          className="shrink-0 p-1 rounded transition-opacity opacity-0 group-hover:opacity-100">
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5"
            fill={isSaved ? "#2D6A4F" : "none"} stroke={isSaved ? "#2D6A4F" : "currentColor"} strokeWidth={2}>
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
          </svg>
        </button>
      </div>

      {/* Location */}
      <p className="text-[11px] text-black dark:text-white capitalize mb-3">
        {countries.length > 0 ? countries.join(", ") : orgTypeLabel(org.organisation_type)}
      </p>

      {/* Seeking snippet -- partnership_sought is far more reliably
          populated than partnership_title, which is often null */}
      {(org.partnership_sought || normalizeArr(org.needs).length > 0) && (
        <p className="text-[13px] text-black dark:text-white leading-snug line-clamp-2">
          Seeking {org.partnership_sought || normalizeArr(org.needs).join(", ")}
        </p>
      )}

      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
        {org.partnership_formed && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: "rgba(29,78,216,0.12)", color: "#1D4ED8", border: "1px solid rgba(29,78,216,0.3)" }}>
            <CheckCircle2 className="w-2.5 h-2.5" />Partnership formed
          </span>
        )}
        {mouExecuted && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: "rgba(45,106,79,0.12)", color: "#2D6A4F", border: "1px solid rgba(45,106,79,0.3)" }}>
            <Award className="w-2.5 h-2.5" />MoU Executed
          </span>
        )}
      </div>
    </div>
  );}

// ─── Main ─────────────────────────────────────────────────────────────────────
// "Matched" = a stored fit score at or above this. Same bar as the amber band on the fit badge.
const MATCHED_MIN_SCORE = 50;

export default function DashboardPartnerships() {
  const { user, orgOwnerId } = useAuth();
  const autoOpenOrgId = new URLSearchParams(window.location.search).get("org");
  const autoOpenListingId = new URLSearchParams(window.location.search).get("listing");
  const [orgs, setOrgs]                       = useState<(OrgRow & { listing_id: string })[]>([]);
  const [loading, setLoading]                 = useState(true);
  const [showModal, setShowModal]             = useState(false);
  const [search, setSearch]                   = useState("");
  const [sectorFilters, setSectorFilters]     = useState<Set<string>>(new Set());
  const [listView, setListView]           = useState<"all" | "matched" | "saved">("all");
  const [matchedListingIds, setMatchedListingIds]     = useState<Set<string>>(new Set());
  const [matchedLegacyOrgIds, setMatchedLegacyOrgIds] = useState<Set<string>>(new Set());
  const [orgTypeFilters, setOrgTypeFilters]   = useState<Set<string>>(new Set());
  const [stageFilters, setStageFilters]       = useState<Set<string>>(new Set());
  const [ddReadyOnly, setDdReadyOnly]         = useState(false);
  const [openDropdown, setOpenDropdown]       = useState<string | null>(null);
  const filterBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (filterBarRef.current && !filterBarRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  const [selectedOrg, setSelectedOrg]         = useState<(OrgRow & { listing_id: string }) | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [deepLinkMissing, setDeepLinkMissing] = useState(false);
  // Which listed orgs have at least one direct-connection MoU fully executed.
  // This lives on partnership_connections (per relationship), not on the
  // org row itself, so it's a separate lookup rather than a selected column.
  // Renamed from mouExecutedOrgIds -- now tracks which specific LISTING
  // has an executed MoU, not which org. An org-level check made the
  // badge show on every one of an org's listing cards once ANY one of
  // them had an executed MoU, which is wrong now that one org can have
  // several distinct listings.
  const [mouExecutedListingIds, setMouExecutedListingIds] = useState<Set<string>>(new Set());
  const { viewerOrg, viewerOrgLoading, savedOrgs, sentInterests, sendingInterest, toggleSave, expressInterest } = useOrgActions(orgOwnerId, user?.id);

  useEffect(() => { if (user) loadAll(); }, [user]);

  // Stored matches for the viewer's org. partnership_match_cache is only readable on paid tiers
  // (row-level security), so free-tier viewers skip the query and get a locked Matched tab.
  // Listing-level rows carry matched_listing_id. Older org-level rows carry only matched_org_id.
  useEffect(() => {
    setMatchedListingIds(new Set());
    setMatchedLegacyOrgIds(new Set());
    if (!viewerOrg?.id || viewerOrg.subscription_tier === "free") return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.from("partnership_match_cache")
        .select("matched_listing_id, matched_org_id, fit_score")
        .eq("org_id", viewerOrg.id)
        .gte("fit_score", MATCHED_MIN_SCORE);
      if (cancelled || error || !data) return;
      const listingIds = new Set<string>();
      const legacyOrgIds = new Set<string>();
      for (const r of data as any[]) {
        if (r.matched_listing_id) listingIds.add(r.matched_listing_id);
        else if (r.matched_org_id) legacyOrgIds.add(r.matched_org_id);
      }
      setMatchedListingIds(listingIds);
      setMatchedLegacyOrgIds(legacyOrgIds);
    })();
    return () => { cancelled = true; };
  }, [viewerOrg?.id, viewerOrg?.subscription_tier]);

  async function loadAll() {
    const { data: listingsData } = await supabase.from("partnership_listings")
      .select("*").eq("status", "published").order("created_at", { ascending: false });

    if (!listingsData || listingsData.length === 0) { setOrgs([]); setLoading(false); return; }

    const userIds = [...new Set(listingsData.map(l => l.user_id))];
    const { data: orgsData } = await supabase.from("organizations")
      .select("id,user_id,organisation_name,description,organisation_type,website,email,verification_status,status,partnership_formed,dd_financial_model,dd_audited_accounts,dd_governance_doc,dd_esg_assessment,dd_impact_framework,dd_environmental_policy,dd_safeguarding_policy,dd_legal_registration,dd_legal_compliance_declaration,fdd_disbursement_track_record,fdd_decision_transparency,fdd_conflict_disclosure,fdd_governance_doc,fdd_esg_framework,fdd_legal_registration,specializations,notable_engagements,affiliations,logo_url,grant_range_min,grant_range_max,grant_currency,investment_thesis,stage_preference,funding_instruments,geographic_focus,csr_focus_statement,csr_budget_range,inkind_support")
      .in("user_id", userIds);

    const orgByUserId = new Map((orgsData ?? []).map((o: any) => [o.user_id, o]));

    // Merge: .id is the ORG's real id (unchanged meaning everywhere it's
    // already used); listing_id is the new, listing-specific identity
    // used for React keys, selection, and expressInterest's new param.
    const merged: (OrgRow & { listing_id: string })[] = listingsData
      .map((l: any) => {
        const org = orgByUserId.get(l.user_id);
        if (!org || org.status !== "published") return null;
        return {
          ...org,
          listing_id: l.id,
          partnership_listed: true,
          sector: l.sector, country: l.country, needs: l.needs, offers: l.offers, sdgs: l.sdgs,
          partnership_sought: l.sought, partnership_title: l.title,
          partnership_stage: l.stage, partnership_duration: l.duration, partnership_budget: l.budget,
          partnership_decision_timeline: l.decision_timeline, partnership_success_definition: l.success_definition,
          partnership_funding_status: l.funding_status, partnership_exclusivity: l.exclusivity,
          partnership_working_style: l.working_style, partnership_financial_transfer: l.financial_transfer,
          partnership_reporting: l.reporting, partnership_ip_ownership: l.ip_ownership,
          partnership_legal_type: l.legal_type, partnership_team_capacity: l.team_capacity,
          partnership_contact_seniority: l.contact_seniority, partnership_geo_specificity: l.geo_specificity,
          partnership_theory_of_change: l.theory_of_change, partnership_prior_attempts: l.prior_attempts,
          partnership_constraints: l.constraints_note, partnership_prior_experience: l.prior_experience,
          partnership_prior_experience_detail: l.prior_experience_detail, partnership_physically_present: l.physically_present,
          partnership_language: l.language,
        } as OrgRow & { listing_id: string };
      })
      .filter((r): r is OrgRow & { listing_id: string } => r !== null);

    setOrgs(merged);
    const deepLinked = (autoOpenListingId ? merged.find(o => o.listing_id === autoOpenListingId) : null)
      ?? (autoOpenOrgId ? merged.find(o => o.id === autoOpenOrgId) : null);
    if (deepLinked) {
      setSelectedOrg(deepLinked);
    } else if (autoOpenOrgId) {
      // A specific org was requested via ?org= but isn't published/partnership-listed right now.
      // Don't silently substitute a different org — flag it instead.
      setDeepLinkMissing(true);
    } else if (merged.length > 0) {
      setSelectedOrg(merged[0]);
    }

    const orgIds = [...new Set(merged.map(o => o.id))];
    if (orgIds.length > 0) {
      const { data: executedIds } = await supabase
        .rpc("get_mou_executed_listing_ids", { org_ids: orgIds });
      setMouExecutedListingIds(new Set<string>(executedIds ?? []));
    }
    setLoading(false);
  }

  const baseFiltered = orgs.filter(org => {
    const sectors = normalizeArr(org.sector);
    const countries = normalizeArr(org.country);
    const matchesSector    = sectorFilters.size === 0 || sectors.some(s => [...sectorFilters].some(f => s.toLowerCase().includes(f.toLowerCase())));
    const matchesSearch    = !search.trim() || org.organisation_name?.toLowerCase().includes(search.toLowerCase()) || org.description?.toLowerCase().includes(search.toLowerCase()) || (org.partnership_sought ?? "").toLowerCase().includes(search.toLowerCase()) || countries.some(c => c.toLowerCase().includes(search.toLowerCase()));
    const matchesOrgType   = orgTypeFilters.size === 0 || orgTypeFilters.has(org.organisation_type ?? "");
    const matchesStage     = stageFilters.size === 0 || stageFilters.has(org.partnership_stage ?? "");
    const matchesDDReady   = !ddReadyOnly || [
      org.partnership_dd_financial_model,
      org.partnership_dd_audited_accounts,
      org.partnership_dd_safeguarding_policy,
      org.partnership_dd_data_policy,
      org.partnership_dd_governance_doc,
    ].some(Boolean);
    return matchesSector && matchesSearch && matchesOrgType && matchesStage && matchesDDReady;
  });

  // All / Matched / Saved sit on top of the other filters, so each count is what that tab would show.
  const isMatched = (o: OrgRow & { listing_id: string }) => matchedListingIds.has(o.listing_id) || matchedLegacyOrgIds.has(o.id);
  const isSavedOrg = (o: OrgRow & { listing_id: string }) => savedOrgs.has(o.id);
  const matchedCount = baseFiltered.filter(isMatched).length;
  const savedCount = baseFiltered.filter(isSavedOrg).length;
  const filtered = listView === "matched" ? baseFiltered.filter(isMatched)
    : listView === "saved" ? baseFiltered.filter(isSavedOrg)
    : baseFiltered;
  const views: { key: "all" | "matched" | "saved"; label: string; count: number; locked?: boolean }[] = [
    { key: "all", label: "All", count: baseFiltered.length },
    ...(viewerOrg ? [{ key: "matched" as const, label: "Matched", count: matchedCount, locked: viewerOrg.subscription_tier === "free" }] : []),
    { key: "saved", label: "Saved", count: savedCount },
  ];
  const emptyCopy = orgs.length === 0
    ? { title: "No listings yet", body: "Be the first to list your organisation." }
    : baseFiltered.length > 0 && listView === "matched"
      ? { title: "No matches yet", body: "Matches appear here once your organisation has been scored against listings." }
    : baseFiltered.length > 0 && listView === "saved"
      ? { title: "Nothing saved yet", body: "Save a listing to see it here." }
    : { title: "No results", body: "Try a different search or filter." };

  const activeFilterCount = sectorFilters.size + orgTypeFilters.size + stageFilters.size + (listView !== "all" ? 1 : 0) + (ddReadyOnly ? 1 : 0);

  return (
    <>
      <div className="flex flex-col lg:grid lg:grid-cols-[18rem_minmax(0,1fr)] xl:grid-cols-[20rem_minmax(0,1fr)] lg:grid-rows-[auto_auto_auto_minmax(0,1fr)] -mx-4 sm:-mx-6" style={{ height: "100vh", maxHeight: "100vh", overflow: "hidden" }}>
        {/* Top bar */}
        <div className="shrink-0 px-5 py-3 flex flex-wrap items-center gap-2 bg-background border-b border-[#2D6A4F]/20 lg:flex-col lg:items-stretch lg:flex-nowrap lg:px-3 lg:border-r-2 lg:col-start-1 lg:row-start-2">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-black dark:text-white" />
            <input type="text" placeholder="Search listings..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-3 rounded-lg text-[13px] text-foreground placeholder:text-[#2D6A4F]/70 focus:outline-none focus:ring-2 focus:ring-[#452A1D]/25 transition-colors bg-card border border-[#2D6A4F]/20" />          </div>
          <div ref={filterBarRef} className="flex flex-wrap items-center gap-1.5 relative">
            {([
              {
                key: "sector",
                label: "Sector",
                count: sectorFilters.size,
                options: SECTOR_OPTIONS.map(s => ({ value: s, label: s })),
                selected: sectorFilters,
                toggle: (v: string) => setSectorFilters(prev => { const n = new Set(prev); n.has(v) ? n.delete(v) : n.add(v); return n; }),
                clear: () => setSectorFilters(new Set()),
              },
              {
                key: "orgtype",
                label: "Org type",
                count: orgTypeFilters.size,
                options: [
                  { value: "ngo_non_profit",          label: "NGO / Non-profit" },
                  { value: "social_enterprise",       label: "Social enterprise" },
                  { value: "startup",                 label: "Startup" },
                  { value: "technology_company",      label: "Tech company" },
                  { value: "venture_capital",         label: "Venture capital" },
                  { value: "corporation",             label: "Corporation" },
                  { value: "philanthropic_foundation",label: "Foundation" },
                  { value: "public_sector",           label: "Public sector" },
                  { value: "creative_agency_studio",  label: "Creative Agency / Studio" },
                  { value: "research_academic",       label: "Research & Academic Institution" },
                  { value: "consultancy",             label: "Consultancy" },
                ],
                selected: orgTypeFilters,
                toggle: (v: string) => setOrgTypeFilters(prev => { const n = new Set(prev); n.has(v) ? n.delete(v) : n.add(v); return n; }),
                clear: () => setOrgTypeFilters(new Set()),
              },
              {
                key: "stage",
                label: "Stage",
                count: stageFilters.size,
                options: [
                  { value: "pilot",           label: "Pilot" },
                  { value: "joining_running", label: "Joining existing" },
                  { value: "scaling",         label: "Scaling" },
                ],
                selected: stageFilters,
                toggle: (v: string) => setStageFilters(prev => { const n = new Set(prev); n.has(v) ? n.delete(v) : n.add(v); return n; }),
                clear: () => setStageFilters(new Set()),
              },
              {
                key: "toggles",
                label: `More${ddReadyOnly ? " (1)" : ""}`,
                count: ddReadyOnly ? 1 : 0,
                options: [],
                selected: new Set(),
                toggle: () => {},
                clear: () => { setDdReadyOnly(false); },
              },
            ] as const).map(f => (
              <div key={f.key} className="relative">
                <button type="button"
                  onClick={() => setOpenDropdown(prev => prev === f.key ? null : f.key)}
                  className={`h-8 px-3 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-colors ${
                    f.count > 0 || openDropdown === f.key
                      ? "text-white border border-transparent"
                      : "bg-background text-foreground border border-[#2D6A4F]/20"
                  }`}
                  style={f.count > 0 || openDropdown === f.key
                    ? { background: "linear-gradient(135deg, #3D2618 0%, #33301F 50%, #1B3328 100%)" }
                    : undefined}>
                  {f.label}
                  {f.count > 0 && (
                    <span className="w-4 h-4 rounded-full bg-white text-[#111827] text-[9px] font-black flex items-center justify-center">
                      {f.count}
                    </span>
                  )}
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>
                {openDropdown === f.key && (
                  <div className="absolute top-full left-0 mt-1 z-50 rounded-xl shadow-lg border border-[#2D6A4F]/20 bg-card min-w-[180px] p-2"
                    style={{ maxHeight: "280px", overflowY: "auto" }}>
                    {f.key === "toggles" ? (
                      <div className="space-y-1">
                        {[
                          { label: "DD docs available", checked: ddReadyOnly,   set: setDdReadyOnly   },
                        ].map(t => (
                          <label key={t.label} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-[#2D6A4F]/10 transition-colors">
                            <input type="checkbox" checked={t.checked} onChange={e => t.set(e.target.checked)}
                              className="w-3.5 h-3.5 rounded accent-[#2D6A4F]" />
                            <span className="text-[13px] text-foreground font-medium">{t.label}</span>
                          </label>
                        ))}
                        {ddReadyOnly && (
                          <button type="button" onClick={f.clear}
                            className="w-full text-left px-2 py-1 text-[10px] text-black dark:text-white hover:text-foreground transition-colors">
                            Clear
                          </button>
                        )}
                      </div>
                    ) : (
                      <>
                        {f.options.map(o => {
                          const on = f.selected.has(o.value);
                          return (
                            <button key={o.value} type="button"
                              onClick={() => f.toggle(o.value)}
                              className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-[13px] text-left transition-colors ${
                                on ? "bg-[#2D6A4F]/10 text-[#2D6A4F] font-semibold" : "text-foreground hover:bg-[#2D6A4F]/10"
                              }`}>
                              <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                                on ? "bg-[#2D6A4F] border-[#2D6A4F]" : "border-[#2D6A4F]/20"
                              }`}>
                                {on && <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5"><polyline points="20 6 9 17 4 12"/></svg>}
                              </div>
                              {o.label}
                            </button>
                          );
                        })}
                        {f.count > 0 && (
                          <button type="button" onClick={f.clear}
                            className="w-full text-left px-2 py-1 mt-1 text-[10px] text-black dark:text-white hover:text-foreground transition-colors border-t border-[#2D6A4F]/20">
                            Clear ({f.count})
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
            {activeFilterCount > 0 && (
              <button type="button"
                onClick={() => { setSectorFilters(new Set()); setOrgTypeFilters(new Set()); setStageFilters(new Set()); setListView("all"); setDdReadyOnly(false); }}
                className="text-[11px] text-black dark:text-white hover:text-foreground transition-colors px-1">
                Clear all
              </button>
            )}
          </div>
          <div className="flex-1 lg:hidden" />
          {user && (
            <button type="button" onClick={() => setShowModal(true)}
              className="h-9 px-4 rounded-full text-white text-[13px] font-bold transition-all hover:brightness-110 active:scale-[0.98] shrink-0 whitespace-nowrap lg:w-full"
              style={{ background: "linear-gradient(135deg, #3D2618 0%, #33301F 50%, #1B3328 100%)" }}>
              + Get Matched
            </button>
          )}
        </div>

        {deepLinkMissing && (
          <div className="shrink-0 px-5 py-2 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-900 text-[13px] text-amber-800 dark:text-amber-300 flex items-center justify-between gap-2 lg:col-span-2 lg:row-start-1">
            <span>The listing you followed a link to isn't currently available — it may be unpublished or no longer partnership-listed.</span>
            <button type="button" onClick={() => setDeepLinkMissing(false)} className="shrink-0 hover:opacity-70 font-medium">
              Dismiss
            </button>
          </div>
        )}

        {!loading && orgs.length > 0 && (
          <div className={`shrink-0 border-b border-[#2D6A4F]/20 bg-background lg:col-start-1 lg:row-start-3 ${mobileDetailOpen ? "hidden lg:flex" : "flex"}`}>
            <div className="w-full lg:w-72 xl:w-80 shrink-0 lg:border-r-2 border-[#2D6A4F]/20 px-3 py-2 flex items-center gap-1.5">
              {views.map(v => {
                const on = listView === v.key;
                const cls = `h-8 px-3 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-colors ${
                  on ? "text-white border border-transparent" : "bg-background text-foreground border border-[#2D6A4F]/20"}`;
                if (v.locked) {
                  return (
                    <a key={v.key} href="/dashboard/settings?tab=billing" title="AI matching is a Plus feature" className={cls}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                      </svg>
                      {v.label}
                    </a>
                  );
                }
                return (
                  <button key={v.key} type="button" aria-pressed={on} onClick={() => setListView(v.key)} className={cls}
                    style={on ? { background: "linear-gradient(135deg, #3D2618 0%, #33301F 50%, #1B3328 100%)" } : undefined}>
                    {v.label}
                    <span className="font-black">{v.count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Split layout */}
        {loading ? (
          <div className="flex items-center justify-center flex-1 lg:col-span-2 lg:row-start-4">
            <Loader2 className="w-5 h-5 animate-spin text-[#2D6A4F]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-4 text-center px-6 lg:col-span-2 lg:row-start-4">
            <Handshake className="w-7 h-7 text-[#2D6A4F]/50" />
            <div>
              <p className="text-[15px] font-bold text-foreground mb-1">{emptyCopy.title}</p>
              <p className="text-[13px] text-black dark:text-white">{emptyCopy.body}</p>
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 overflow-hidden lg:contents" style={{ flex: 1 }}>            {/* Left list */}
            <div className={`w-full lg:w-auto shrink-0 overflow-y-auto min-h-0 lg:col-start-1 lg:row-start-4 border-r-2 border-[#2D6A4F]/20 bg-[#2D6A4F]/[0.04] ${mobileDetailOpen ? "hidden lg:block" : "block"}`}>
              {filtered.map((org: any) => (
                <ListCard key={org.listing_id} org={org}
                  selected={selectedOrg?.listing_id === org.listing_id}
                  onClick={() => { setSelectedOrg(org); setMobileDetailOpen(true); }}
                  isSaved={savedOrgs.has(org.id)}
                  onToggleSave={e => toggleSave(org.id, e)}
                  mouExecuted={mouExecutedListingIds.has(org.listing_id)}
                />
              ))}
            </div>

            {/* Right detail */}
            <div className={`flex-1 min-w-0 min-h-0 overflow-y-auto lg:col-start-2 lg:row-start-2 lg:row-span-3 ${mobileDetailOpen ? "block" : "hidden lg:block"}`}>
              <OrgDetailPanel
                org={selectedOrg}
                isSaved={selectedOrg ? savedOrgs.has(selectedOrg.id) : false}
                onToggleSave={e => selectedOrg && toggleSave(selectedOrg.id, e)}
                isOrg={!!user}
                alreadySent={selectedOrg ? sentInterests.has(selectedOrg.id) : false}
                sending={selectedOrg ? sendingInterest === selectedOrg.id : false}
                onExpressInterest={e => selectedOrg && expressInterest(selectedOrg, e, selectedOrg.listing_id)}
                onBack={() => setMobileDetailOpen(false)}
                backLabel="Back to listings"
                viewerOrg={viewerOrg}
                viewerOrgLoading={viewerOrgLoading}                
                mouExecuted={selectedOrg ? mouExecutedListingIds.has(selectedOrg.listing_id) : false}
                onOpenListing={id => {
                  const next = orgs.find(o => o.listing_id === id);
                  if (next) { setSelectedOrg(next); setMobileDetailOpen(true); }
                  else window.location.assign(`/dashboard/partnerships?listing=${id}`);
                }}
              />
            </div>
          </div>
        )}
      </div>

      <FindPartnerModalDashboard isOpen={showModal} onClose={() => { setShowModal(false); loadAll(); }} />
    </>
  );
}