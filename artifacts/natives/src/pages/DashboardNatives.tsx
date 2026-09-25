// ─── DashboardNatives.tsx ─────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from "react";
import { impactScoreForSort, canDisplayImpactScoreForOrg, tierForScore, displayImpactScore, IMPACT_SCORE_TIER_STYLES } from "@/lib/impactScore";
import { supabase } from "@/lib/supabase";
import { fetchLatestListingMirror, EMPTY_LISTING_MIRROR } from "@/lib/listingMirror";
import { useAuth } from "@/context/AuthContext";
import {
  Loader2, Search, Users, Sparkles, RefreshCw, Trophy, X, ExternalLink,
  Link as LinkIcon, Globe, MapPin, Layers, ChevronRight, FileText,
} from "lucide-react";
import { initials } from "@/components/ui/UserAvatar";
import { VerifiedBadge } from "@/components/ui/VerifiedBadge";
import { TrustBadge } from "@/components/ui/TrustBadge";
import { COUNTRIES } from "@/lib/countries";
import { SECTOR_OPTIONS } from "@/lib/sectors";
import { DD_ITEMS, FUNDER_DD_ITEMS, DDItemDef, DD_SENSITIVE_EVIDENCE_KEYS, DDDocument, PILLAR_INFO, computeTrustTier } from "@/lib/ddItems";
import { hasLiveRelationshipWith } from "@/lib/relationshipAccess";
import mammoth from "mammoth";
import { EsgSnapshotSection } from "@/components/dashboard/EsgSnapshotSection";

// ── Charcoal text helper ─────────────────────────────────────────────────────
// All secondary/"grey" text uses this instead of a muted-gray token.
const CHARCOAL = "text-[#1F2937]";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProfileRow {
  id: string;
  full_name: string;
  org_name?: string;
  role_title?: string;
  country?: string;
  sectors?: string[];
  bio?: string;
  avatar_url?: string;
  linkedin_url?: string;
  website?: string;
  user_type?: string;
  social_links?: { label: string; url: string }[];
  show_individual_profile?: boolean;
}

interface OrgRow {
  id: string;
  organisation_name: string;
  sector: string | string[];
  country: string | string[];
  organisation_type?: string;
  website?: string;
  verification_status: string;
  user_id: string;
  contact_name?: string;
  flagged_visibility_hold?: boolean | null;
  description?: string;
  investment_thesis?: string | null;
  stage_preference?: string[] | null;
  impact_score?: number;
  subscription_tier?: string | null;
  show_impact_score?: boolean;
  geographic_focus?: string[] | null;
  dd_financial_model?: boolean;
  dd_audited_accounts?: boolean;
  dd_governance_doc?: boolean;
  dd_esg_assessment?: boolean;
  dd_impact_framework?: boolean;
  dd_environmental_policy?: boolean;
  dd_safeguarding_policy?: boolean;
  dd_legal_registration?: boolean;
  dd_legal_compliance_declaration?: boolean;
  fdd_disbursement_track_record?: boolean;
  fdd_decision_transparency?: boolean;
  fdd_conflict_disclosure?: boolean;
  fdd_governance_doc?: boolean;
  fdd_esg_framework?: boolean;
  fdd_legal_registration?: boolean;
  dd_evidence?: Record<string, any>;
  needs?: string[];
  offers?: string[];
  sdgs?: string[];
  year_founded?: number | null;
  ai_partnership_summary?: string | null;
  logo_url?: string | null;
  total_beneficiaries_reached?: number | null;
  jobs_created?: number | null;
  female_beneficiaries_pct?: number | null;
  youth_beneficiaries_pct?: number | null;
  years_of_operation?: number | null;
  grants_received_count?: number | null;
  grants_total_value_usd?: number | null;
  grants_delivered_on_time_pct?: number | null;
  previous_funders?: string[] | null;
  third_party_evaluations?: boolean | null;
  csr_focus_statement?: string | null;
  employee_engagement_available?: boolean | null;
  cobranding_open?: boolean | null;
  inkind_support?: string[] | null;
  tech_support_available?: string[] | null;
  sandbox_ready?: boolean | null;
  sandbox_description?: string | null;
  esg_frameworks?: string[] | null;
  specializations?: string[] | null;
  notable_engagements?: string[] | null;
  affiliations?: string[] | null;
  partnership_listed?: boolean;
  partnership_title?: string | null;
  partnership_sought?: string | null;
  partnership_stage?: string | null;
  partnership_budget?: string | null;
  partnership_decision_timeline?: string | null;
  partnership_funding_status?: string | null;
  csr_budget_range?: string | null;
  impact_strategy?: string | null;
}

type EntityType = "organisation" | "individual";
type FilterTab = "all" | EntityType;
type DrawerTab = "overview" | "dueDiligence" | "initiatives" | "strategy";

/** Unified shape used to render the 3-column list, regardless of underlying table. */
interface EcosystemEntity {
  entityType: EntityType;
  id: string;
  userId: string;
  name: string;
  subtitle?: string;
  description?: string;
  sectors: string[];
  countries: string[];
  verified: boolean;
  impactScore?: number;
  canShowImpactScore: boolean;
  logoUrl?: string | null;
  org?: OrgRow;
  profile?: ProfileRow;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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
const SDG_NAMES = [
  "No Poverty", "Zero Hunger", "Good Health and Well-being", "Quality Education",
  "Gender Equality", "Clean Water and Sanitation", "Affordable and Clean Energy",
  "Decent Work and Economic Growth", "Industry Innovation and Infrastructure",
  "Reduced Inequalities", "Sustainable Cities and Communities",
  "Responsible Consumption and Production", "Climate Action", "Life Below Water",
  "Life on Land", "Peace Justice and Strong Institutions", "Partnerships for the Goals",
];
function sdgLabel(value: string | number): string {
  const n = typeof value === "number" ? value : parseInt(value, 10);
  if (!Number.isNaN(n) && n >= 1 && n <= SDG_NAMES.length) return SDG_NAMES[n - 1];
  return String(value);
}
function firstSentence(text: string): string {
  const idx = text.indexOf(".");
  return idx === -1 ? text : text.slice(0, idx + 1);
}

const PARTNER_ROLE_LABELS: Record<string, string> = {
  funding: "Funding", technical: "Technical", operational: "Operational",
  leadership: "Leadership", strategic: "Strategic", lead: "Project Lead", other: "Other",
};
function partnerRolePhrase(value: string): string {
  const label = PARTNER_ROLE_LABELS[value] ?? value;
  return label === "Project Lead" ? label : `${label} partner`;
}

// Deterministic soft-color TEXT (no background/border box) for sector/country
// tags, in the spirit of the mockup's color-coded labels — but as plain
// colored text rather than a bordered "card".
const TEXT_PALETTE = [
  "text-emerald-700", "text-indigo-700", "text-blue-700", "text-amber-700",
  "text-purple-700", "text-teal-700", "text-rose-700", "text-sky-700",
];
function tagColorFor(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return TEXT_PALETTE[hash % TEXT_PALETTE.length];
}

function toOrgEntity(org: OrgRow): EcosystemEntity {
  return {
    entityType: "organisation",
    id: org.id,
    userId: org.user_id,
    name: org.organisation_name,
    subtitle: org.organisation_type ? org.organisation_type.replace(/_/g, " ") : undefined,
    description: org.description,
    sectors: normalizeArr(org.sector),
    countries: normalizeArr(org.country),
    verified: org.verification_status === "verified",
    impactScore: org.impact_score,
    canShowImpactScore: canDisplayImpactScoreForOrg(org.subscription_tier, org.show_impact_score),
    logoUrl: org.logo_url,
    org,
  };
}
function toIndividualEntity(p: ProfileRow): EcosystemEntity {
  return {
    entityType: "individual",
    id: p.id,
    userId: p.id,
    name: p.full_name,
    subtitle: p.role_title,
    description: p.bio,
    sectors: p.sectors ?? [],
    countries: p.country ? [p.country] : [],
    // NOTE: profiles has no verification concept in the current schema.
    // Wire this up to a real column if/when individuals can be verified.
    verified: false,
    canShowImpactScore: false,
    logoUrl: p.avatar_url,
    profile: p,
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function DashboardNatives() {
  const [filterTab, setFilterTab] = useState<FilterTab>(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("tab");
    return t === "organisation" || t === "individual" ? t : "all";
  });
  const [search, setSearch] = useState("");
  const [sectorFilter, setSectorFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [orgTypeFilter, setOrgTypeFilter] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sortMode, setSortMode] = useState("");

  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const [loadingProfiles, setLoadingProfiles] = useState(true);

  // Drawer entity is kept mounted through the close animation; drawerVisible
  // purely controls the transform/opacity so open + close both animate.
  const [drawerEntity, setDrawerEntity] = useState<EcosystemEntity | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);

  function openEntity(entity: EcosystemEntity) {
    setDrawerEntity(entity);
  }
  function closeDrawer() {
    setDrawerVisible(false);
    window.setTimeout(() => setDrawerEntity(null), 300);
  }
  useEffect(() => {
    if (!drawerEntity || drawerVisible) return;
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setDrawerVisible(true)));
    return () => cancelAnimationFrame(raf);
  }, [drawerEntity]); // eslint-disable-line react-hooks/exhaustive-deps

  const [autoOpenUserId, setAutoOpenUserId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("user");
  });
  const [directLoading, setDirectLoading] = useState(!!autoOpenUserId);

  // Deep link: open one entity's drawer directly without waiting on the
  // full directory load. Figures out which table it lives in first.
  useEffect(() => {
    if (!autoOpenUserId) return;
    async function loadOne() {
      const { data: profileRow } = await supabase
        .from("profiles").select("user_type").eq("id", autoOpenUserId).maybeSingle();

      if (profileRow?.user_type === "organisation") {
        setFilterTab("organisation");
        const [{ data: orgRow }, { data: contactProfile }] = await Promise.all([
          supabase.from("organizations").select(ORG_SELECT).eq("user_id", autoOpenUserId).eq("status", "published").single(),
          supabase.from("profiles").select("full_name").eq("id", autoOpenUserId).single(),
        ]);
        if (orgRow) {
          const mirrorMap = await fetchLatestListingMirror([autoOpenUserId!]);
          const full: OrgRow = { ...orgRow, ...(mirrorMap.get(autoOpenUserId!) ?? EMPTY_LISTING_MIRROR), contact_name: contactProfile?.full_name };
          openEntity(toOrgEntity(full));
        }
      } else {
        const { data: fullProfile } = await supabase
          .from("profiles")
          .select("id,full_name,role_title,country,sectors,bio,avatar_url,linkedin_url,website,user_type,social_links,org_name,show_individual_profile")
          .eq("id", autoOpenUserId)
          .not("full_name", "is", null)
          .or("user_type.eq.individual_creative,user_type.is.null,show_individual_profile.eq.true")
          .eq("is_demo_profile", false)
          .single();
        if (fullProfile) {
          const { data: membership } = await supabase
            .from("org_members").select("user_id").eq("user_id", autoOpenUserId).eq("status", "active").maybeSingle();
          if (!membership) openEntity(toIndividualEntity(fullProfile as ProfileRow));
        }
      }
      setDirectLoading(false);
    }
    loadOne();
  }, [autoOpenUserId]);

  // Full directory load.
  useEffect(() => {
    async function loadOrgs() {
      setLoadingOrgs(true);
      const { data: orgData, error } = await supabase
        .from("organizations")
        .select(ORG_SELECT)
        .eq("status", "published")
        .order("organisation_name", { ascending: true });
      if (error) { console.error(error); setLoadingOrgs(false); return; }
      if (!orgData || orgData.length === 0) { setOrgs([]); setLoadingOrgs(false); return; }

      const userIds = [...new Set(orgData.map((o: any) => o.user_id).filter(Boolean))];
      const [{ data: profileData }, mirrorMap] = await Promise.all([
        supabase.from("profiles").select("id,full_name").in("id", userIds),
        fetchLatestListingMirror(userIds),
      ]);
      const profileMap = new Map((profileData ?? []).map((p: any) => [p.id, p]));

      const enriched: OrgRow[] = orgData.map((o: any) => ({
        ...o,
        ...(mirrorMap.get(o.user_id) ?? EMPTY_LISTING_MIRROR),
        contact_name: profileMap.get(o.user_id)?.full_name,
      }));
      setOrgs(enriched);
      setLoadingOrgs(false);
    }
    async function loadProfiles() {
      setLoadingProfiles(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("id,full_name,role_title,country,sectors,bio,avatar_url,linkedin_url,website,user_type,social_links,org_name,show_individual_profile")
        .not("full_name", "is", null)
        .or("user_type.eq.individual_creative,user_type.is.null,show_individual_profile.eq.true")
        .eq("is_demo_profile", false)
        .order("full_name", { ascending: true });
      if (error) console.error(error);
      const allRows: ProfileRow[] = data ?? [];

      // Team Members never appear as "Individuals" -- their public presence
      // is through their org's listing, not a personal one.
      const individualIds = allRows.filter(p => p.user_type === "individual_creative" || !p.user_type).map(p => p.id);
      let memberUserIds = new Set<string>();
      if (individualIds.length > 0) {
        const { data: memberships } = await supabase
          .from("org_members").select("user_id").in("user_id", individualIds).eq("status", "active");
        memberUserIds = new Set((memberships ?? []).map((m: any) => m.user_id));
      }
      setProfiles(allRows.filter(p => !memberUserIds.has(p.id)));
      setLoadingProfiles(false);
    }
    loadOrgs();
    loadProfiles();
  }, []);

  // Serious-severity flagged orgs are withheld from the public directory
  // until resolved, same rule as before.
  const visibleOrgs = useMemo(() => orgs.filter(o => !o.flagged_visibility_hold), [orgs]);

  const allEntities = useMemo<EcosystemEntity[]>(
    () => [...visibleOrgs.map(toOrgEntity), ...profiles.map(toIndividualEntity)],
    [visibleOrgs, profiles]
  );

  const countAll = allEntities.length;
  const countOrg = visibleOrgs.length;
  const countIndividual = profiles.length;

  const filtered = allEntities.filter(e => {
    if (filterTab === "organisation" && e.entityType !== "organisation") return false;
    if (filterTab === "individual" && e.entityType !== "individual") return false;
    if (sectorFilter && !e.sectors.includes(sectorFilter)) return false;
    if (countryFilter && !e.countries.includes(countryFilter)) return false;
    if (orgTypeFilter && e.entityType === "organisation" && e.org?.organisation_type !== orgTypeFilter) return false;
    if (verifiedOnly && !e.verified) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const hay = [e.name, e.subtitle, e.description, ...e.sectors, ...e.countries].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortMode === "impact_score") {
      const aScore = a.entityType === "organisation" ? impactScoreForSort(a.org!.impact_score ?? 0, a.org!.subscription_tier, a.org!.show_impact_score) : -1;
      const bScore = b.entityType === "organisation" ? impactScoreForSort(b.org!.impact_score ?? 0, b.org!.subscription_tier, b.org!.show_impact_score) : -1;
      if (aScore !== bScore) return bScore - aScore;
      return a.name.localeCompare(b.name);
    }
    const aV = a.verified ? 0 : 1;
    const bV = b.verified ? 0 : 1;
    if (aV !== bV) return aV - bV;
    return a.name.localeCompare(b.name);
  });

  const loading = loadingOrgs || loadingProfiles;

  if (directLoading) return <LoadingSpinner />;

  return (
    <div className="flex flex-col -mt-10 -mb-10" style={{ height: "calc(100vh - 81px)", maxHeight: "calc(100vh - 81px)", overflow: "hidden" }}>
      <div className="shrink-0 -mx-6 px-6 pt-6 pb-4 space-y-4">
        {/* Entity Type Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-muted w-fit text-[13px] font-semibold">
        {([
          { key: "all", label: "All", count: countAll },
          { key: "organisation", label: "Organisations", count: countOrg },
          { key: "individual", label: "Individuals", count: countIndividual },
        ] as const).map(t => (
          <button key={t.key} type="button" onClick={() => setFilterTab(t.key)}
            className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
              filterTab === t.key
                ? "bg-white dark:bg-card text-foreground shadow-sm"
                : `${CHARCOAL} hover:text-foreground`
            }`}>
            <span>{t.label}</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${filterTab === t.key ? "bg-slate-200 text-charcoal" : "bg-white/60 dark:bg-black/20"}`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-card p-3 rounded-2xl border border-border flex flex-nowrap items-center gap-2 shadow-xs overflow-x-auto">
        <div className="relative flex-1 min-w-[140px] shrink">
          <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${CHARCOAL}`} />
          <input type="text" placeholder="Search organisations or individuals..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-card border border-border rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/20 focus:border-[#2D6A4F] transition-colors" />
        </div>

        <select value={sectorFilter} onChange={e => setSectorFilter(e.target.value)}
          className="h-9 px-2 rounded-xl border border-border bg-background text-[13px] font-semibold focus:outline-none shrink-0">
          <option value="">Sector</option>
          {SECTOR_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <select value={countryFilter} onChange={e => setCountryFilter(e.target.value)}
          className="h-9 px-2 rounded-xl border border-border bg-background text-[13px] font-semibold focus:outline-none shrink-0">
          <option value="">Country</option>
          {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        {filterTab !== "individual" && (
          <select value={orgTypeFilter} onChange={e => setOrgTypeFilter(e.target.value)}
            className="h-9 px-2 rounded-xl border border-border bg-background text-[13px] font-semibold focus:outline-none shrink-0">
            <option value="">Type</option>
            <option value="ngo_non_profit">NGO / Non-Profit</option>
            <option value="social_enterprise">Social Enterprise</option>
            <option value="startup">Startup</option>
            <option value="technology_company">Technology Company</option>
            <option value="corporation">Corporation</option>
            <option value="philanthropic_foundation">Philanthropic Foundation</option>
            <option value="venture_capital">Venture Capital</option>
            <option value="creative_agency_studio">Creative Agency / Studio</option>
            <option value="public_sector">Public Sector</option>
            <option value="research_academic">Research & Academic</option>
            <option value="consultancy">Consultancy</option>
          </select>
        )}

        <label className="flex items-center gap-2 h-9 px-3 rounded-xl border border-border cursor-pointer hover:bg-muted/50 transition-colors shrink-0">
          <input type="checkbox" checked={verifiedOnly} onChange={e => setVerifiedOnly(e.target.checked)}
            className="rounded border-border text-[#2D6A4F] focus:ring-0 w-3.5 h-3.5" />
          <span className="text-[13px] font-semibold flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-600">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            Verified
          </span>
        </label>

        {(sectorFilter || countryFilter || orgTypeFilter || verifiedOnly || sortMode || search) && (
          <button type="button"
            onClick={() => { setSectorFilter(""); setCountryFilter(""); setOrgTypeFilter(""); setVerifiedOnly(false); setSortMode(""); setSearch(""); }}
            className={`h-9 px-3 rounded-xl border border-border text-[13px] ${CHARCOAL} hover:text-foreground transition-colors shrink-0`}>
            ✕ Clear
          </button>
        )}
      </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto -mx-6 px-6 pb-10">
      {/* Cards feed */}
      {loading ? (
        <LoadingSpinner />
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={<Users className={`w-8 h-8 ${CHARCOAL} opacity-30`} />}
          title={allEntities.length === 0 ? "No ecosystem records yet." : "No results."}
          subtitle={allEntities.length === 0 ? "Published organisations and profiles will appear here." : "Try resetting your active filters or search terms."} />
      ) : (
        <div className="flex flex-col gap-3">
          {sorted.map(e => <EcosystemCard key={`${e.entityType}-${e.id}`} entity={e} onClick={() => openEntity(e)} />)}
        </div>
      )}
      </div>

      {/* Slide-over drawer */}
      {drawerEntity && (
        <div className="fixed inset-0 z-[200]" role="dialog" aria-modal="true">
          <div
            className={`absolute inset-0 bg-slate-900/20 transition-opacity duration-300 ${drawerVisible ? "opacity-100" : "opacity-0"}`}
            onClick={closeDrawer}
          />
          <div
            className={`absolute right-0 top-0 h-full w-full sm:w-[85%] md:w-[65%] lg:w-1/2 lg:min-w-[640px] lg:max-w-[800px] bg-white dark:bg-card border-l border-border shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out ${
              drawerVisible ? "translate-x-0" : "translate-x-full"
            }`}
          >
            {drawerEntity.entityType === "organisation"
              ? <OrgDrawerContent org={drawerEntity.org!} onClose={closeDrawer} />
              : <IndividualDrawerContent profile={drawerEntity.profile!} onClose={closeDrawer} />}
          </div>
        </div>
      )}
    </div>
  );
}

const ORG_SELECT = "id,organisation_name,sector,country,organisation_type,website,verification_status,user_id,description,needs,offers,sdgs,year_founded,ai_partnership_summary,logo_url,dd_financial_model,dd_audited_accounts,dd_governance_doc,dd_esg_assessment,dd_impact_framework,dd_environmental_policy,dd_safeguarding_policy,dd_legal_registration,dd_legal_compliance_declaration,dd_evidence,fdd_disbursement_track_record,fdd_decision_transparency,fdd_conflict_disclosure,fdd_governance_doc,fdd_esg_framework,fdd_legal_registration,total_beneficiaries_reached,jobs_created,female_beneficiaries_pct,youth_beneficiaries_pct,years_of_operation,grants_received_count,grants_total_value_usd,grants_delivered_on_time_pct,previous_funders,third_party_evaluations,csr_focus_statement,employee_engagement_available,cobranding_open,inkind_support,tech_support_available,sandbox_ready,sandbox_description,esg_frameworks,csr_budget_range,specializations,notable_engagements,affiliations,investment_thesis,stage_preference,geographic_focus,impact_strategy,flagged_visibility_hold,impact_score,subscription_tier,show_impact_score";

// ── 3-column list card ───────────────────────────────────────────────────────

function EcosystemCard({ entity, onClick }: { entity: EcosystemEntity; onClick: () => void }) {
  const isOrg = entity.entityType === "organisation";
  const primarySector = entity.sectors[0];
  const primaryCountry = entity.countries[0];
  const sectorColor = primarySector ? tagColorFor(primarySector) : null;
  const countryColor = primaryCountry ? tagColorFor(primaryCountry) : null;

  return (
    <div onClick={onClick}
      className="bg-white dark:bg-card p-5 sm:p-6 rounded-2xl border border-border hover:border-[#2D6A4F] hover:bg-slate-50/60 dark:hover:bg-white/5 hover:shadow-md cursor-pointer transition-all group">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-center">

        {/* Column 1: Identity & summary */}
        <div className="lg:col-span-6 flex items-start gap-4 min-w-0">
          {/* Avatar: no fill background, just a border. Shows the real logo/photo when present. */}
          <div className={`w-12 h-12 shrink-0 flex items-center justify-center text-sm font-bold border shadow-xs overflow-hidden ${
            isOrg ? "rounded-xl border-slate-200" : "rounded-full border-slate-200"
          } ${CHARCOAL}`}>
            {entity.logoUrl ? (
              <img src={entity.logoUrl} alt={entity.name} className="w-full h-full object-contain" />
            ) : initials(entity.name)}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[15px] font-bold text-foreground group-hover:text-[#2D6A4F] transition-colors truncate">{entity.name}</h3>
              {entity.verified && <VerifiedBadge />}
              {isOrg && entity.canShowImpactScore && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-1.5 py-0.5 rounded-full border border-amber-200 bg-amber-50 text-amber-800">
                  <Trophy className="w-3 h-3" /> {displayImpactScore(entity.impactScore ?? 0)}
                </span>
              )}
            </div>
            {entity.subtitle && <p className={`text-[13px] font-semibold ${CHARCOAL} mt-0.5 capitalize truncate`}>{entity.subtitle}</p>}
            {entity.description && <p className="text-[13px] text-foreground mt-1.5 line-clamp-2 leading-relaxed">{firstSentence(entity.description)}</p>}
          </div>
        </div>

        {/* Column 2: Sector — plain colored text, no card/box styling */}
        <div className="lg:col-span-3 min-w-0 border-t lg:border-t-0 lg:border-l border-border pt-3 lg:pt-0 lg:pl-6">
          <span className={`block text-[10px] font-bold ${CHARCOAL} uppercase tracking-wider mb-1.5`}>Sector</span>
          {primarySector ? (
            <span className={`inline-flex items-center text-[13px] font-bold ${sectorColor}`}>
              <Layers className="w-3 h-3 mr-1.5" />
              <span className="truncate">{primarySector}{entity.sectors.length > 1 ? ` +${entity.sectors.length - 1}` : ""}</span>
            </span>
          ) : <span className={`text-[12px] ${CHARCOAL}`}>—</span>}
        </div>

        {/* Column 3: Country — plain colored text, no card/box styling + arrow */}
        <div className="lg:col-span-3 min-w-0 flex items-center justify-between border-t lg:border-t-0 lg:border-l border-border pt-3 lg:pt-0 lg:pl-6">
          <div>
            <span className={`block text-[10px] font-bold ${CHARCOAL} uppercase tracking-wider mb-1.5`}>Country</span>
            {primaryCountry ? (
              <span className={`inline-flex items-center text-[13px] font-bold ${countryColor}`}>
                <MapPin className="w-3 h-3 mr-1.5" />
                <span className="truncate">{primaryCountry}{entity.countries.length > 1 ? ` +${entity.countries.length - 1}` : ""}</span>
              </span>
            ) : <span className={`text-[12px] ${CHARCOAL}`}>—</span>}
          </div>
          <div className={`w-8 h-8 rounded-full bg-white dark:bg-card group-hover:bg-[#2D6A4F] group-hover:text-white ${CHARCOAL} flex items-center justify-center transition-all border border-border shrink-0 ml-3 shadow-xs`}>
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Drawer chrome (header + footer shared shape) ─────────────────────────────

function DrawerHeader({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const fullPageUrl = `${window.location.pathname}?user=${userId}`;

  function copyLink() {
    navigator.clipboard.writeText(`${window.location.origin}${fullPageUrl}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="px-8 py-4 border-b border-border flex items-center justify-between bg-white dark:bg-card shrink-0">
      <button type="button" onClick={onClose}
        className={`flex items-center gap-1.5 text-sm font-medium ${CHARCOAL} hover:bg-slate-100 dark:hover:bg-white/5 p-2 -ml-2 rounded-lg transition`}>
        <X className="w-4 h-4" /> Close
      </button>
      <div className="flex items-center gap-2">
        <a href={fullPageUrl} target="_blank" rel="noopener noreferrer" title="Open in full page"
          className={`p-2 rounded-lg bg-white dark:bg-card hover:bg-slate-50 dark:hover:bg-white/5 ${CHARCOAL} transition-colors text-sm border border-border`}>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
        <button type="button" onClick={copyLink} title="Copy Link"
          className={`px-3 py-1.5 rounded-lg bg-white dark:bg-card hover:bg-slate-50 dark:hover:bg-white/5 ${CHARCOAL} transition-colors text-sm border border-border flex items-center gap-1.5`}>
          <LinkIcon className="w-3.5 h-3.5" /> {copied ? "Copied!" : "Copy Link"}
        </button>

      </div>
    </div>
  );
}

function DrawerTabs({ tabs, active, onChange }: { tabs: { key: DrawerTab; label: string }[]; active: DrawerTab; onChange: (t: DrawerTab) => void }) {
  return (
    <div className="sticky top-0 z-10 bg-white dark:bg-card border-b border-border flex gap-8 text-sm px-8">
      {tabs.map(t => (
        <button key={t.key} type="button" onClick={() => onChange(t.key)}
          className={`py-3 border-b-2 transition-all ${
            active === t.key ? "border-emerald-600 text-slate-900 font-semibold" : `border-transparent font-medium ${CHARCOAL} hover:text-foreground`
          }`}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ── Individual drawer content ────────────────────────────────────────────────

function EntityHeroAvatar({ name, imageUrl, size }: { name: string; imageUrl?: string | null; size: number }) {
  return (
    <div
      className="rounded-full flex items-center justify-center shrink-0 overflow-hidden border border-slate-200 shadow-sm font-bold"
      style={{ width: size, height: size, fontSize: size * 0.32 }}
    >
      {imageUrl ? (
        <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
      ) : (
        <span className={CHARCOAL}>{initials(name)}</span>
      )}
    </div>
  );
}

function IndividualDrawerContent({ profile, onClose }: { profile: ProfileRow; onClose: () => void }) {
  const sectors = profile.sectors ?? [];
  const hasContact = !!(profile.linkedin_url || (profile.website && profile.website !== "https://") || (profile.social_links && profile.social_links.length > 0));

  return (
    <>
      <DrawerHeader userId={profile.id} onClose={onClose} />
      <div className="flex-1 overflow-y-auto">
        <div className="px-8 pt-10 pb-6 flex items-start gap-5 border-b border-slate-100 relative z-20">
          <EntityHeroAvatar name={profile.full_name} imageUrl={profile.avatar_url} size={64} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="text-xl font-bold text-slate-900 tracking-tight">{profile.full_name}</h3>
              {profile.org_name && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "#eaf5ee", color: "#2D6A4F" }}>
                  {profile.org_name}
                </span>
              )}
            </div>
            {(profile.role_title || profile.country) && (
              <p className={`text-sm font-medium ${CHARCOAL} mt-1`}>
                {profile.role_title}{profile.role_title && profile.country ? " · " : ""}{profile.country}
              </p>
            )}
          </div>
        </div>

        {(profile.bio || sectors.length > 0) && (
          <div className="px-8 py-6 space-y-6 border-b border-border">
            <p className="text-[17px] font-bold text-foreground">About</p>
            {profile.bio && <p className="text-[15px] text-foreground leading-relaxed">{profile.bio}</p>}
            {sectors.length > 0 && (
              <div>
                <p className={`text-[13px] font-bold ${CHARCOAL} mb-1.5`}>Sector</p>
                <p className="text-[14px] text-foreground">{sectors.join(", ")}</p>
              </div>
            )}
          </div>
        )}

        {hasContact && (
          <div className="px-8 py-6 space-y-3">
            <p className="text-[17px] font-bold text-foreground mb-2">Contact</p>
            {profile.linkedin_url && (
              <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-[14px] text-foreground hover:text-[#2D6A4F] transition-colors">
                <LinkIcon className="w-3.5 h-3.5" /> LinkedIn
              </a>
            )}
            {profile.website && profile.website !== "https://" && (
              <a href={profile.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-[14px] text-[#2D6A4F] hover:underline">
                <Globe className="w-3.5 h-3.5" /> {profile.website.replace(/^https?:\/\//, "")}
              </a>
            )}
            {profile.social_links?.map((s, i) => (
              <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-[14px] text-foreground hover:text-[#2D6A4F] transition-colors">
                <LinkIcon className="w-3.5 h-3.5 shrink-0" /> {s.label}
              </a>
            ))}
          </div>
        )}
      </div>

      {/* No primary CTA here — Natives has no direct messaging today. A future
          option: link to Partnership Listings, the Marketplace/initiatives,
          or a "Get matched" flow. Wire in whichever fits once decided. */}
      {profile.linkedin_url && (
        <div className="px-8 py-4 border-t border-border bg-white dark:bg-card flex items-center justify-end shrink-0">
          <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer"
            className="bg-white dark:bg-card hover:bg-slate-50 dark:hover:bg-white/5 text-slate-800 font-medium text-sm py-2.5 px-5 rounded-xl transition flex items-center justify-center gap-2 border border-slate-300">
            <LinkIcon className="w-4 h-4" /> LinkedIn
          </a>
        </div>
      )}
    </>
  );
}

// ── Org drawer content ────────────────────────────────────────────────────────

function ImpactScoreBadge({ score }: { score: number }) {
  const tier = tierForScore(score);
  const styles = IMPACT_SCORE_TIER_STYLES[tier];
  return (
    <span className={`inline-flex items-center gap-1 text-[13px] font-bold px-2 py-0.5 rounded-full border ${styles.border} ${styles.bg} ${styles.text}`} title={styles.label}>
      <Trophy className="w-3 h-3" /> {displayImpactScore(score)}
    </span>
  );
}

// Dependency-free donut chart for the Delivery breakdown — no charting
// library assumed, since the project's available packages aren't known here.
function DeliveryDonutChart({ rate, completed, resolved, stalled, fellThrough, inProgress }: {
  rate: number; completed: number; resolved: number; stalled: number; fellThrough: number; inProgress: number;
}) {
  const size = 128;
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  const segments = [
    { value: completed, color: "#2D6A4F" },
    { value: stalled, color: "#D97706" },
    { value: fellThrough, color: "#DC2626" },
  ].filter(s => s.value > 0);

  let offset = 0;

  return (
    <div className="flex items-center gap-6">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#E2E8F0" strokeWidth={stroke} />
          {segments.map((s, i) => {
            const len = resolved > 0 ? circumference * (s.value / resolved) : 0;
            const dashOffset = -offset;
            offset += len;
            return (
              <circle key={i} cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={s.color} strokeWidth={stroke}
                strokeDasharray={`${len} ${circumference - len}`} strokeDashoffset={dashOffset} />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-slate-900">{rate}%</span>
          <span className="text-[10px] font-medium text-slate-500">completed</span>
        </div>
      </div>
      <div className="space-y-1.5 text-xs">
        <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-[#2D6A4F] shrink-0" /><span className="text-slate-700">{completed} completed</span></div>
        {stalled > 0 && <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-amber-600 shrink-0" /><span className="text-slate-700">{stalled} stalled</span></div>}
        {fellThrough > 0 && <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-red-600 shrink-0" /><span className="text-slate-700">{fellThrough} fell through</span></div>}
        {inProgress > 0 && <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-slate-300 shrink-0" /><span className="text-slate-700">{inProgress} in progress</span></div>}
      </div>
    </div>
  );
}

function InfoTooltip({ text }: { text: string }) {  return (
    <span className="relative inline-flex group shrink-0">
      <span className={`w-3.5 h-3.5 rounded-full border border-slate-400 ${CHARCOAL} text-[9px] leading-[13px] font-bold inline-flex items-center justify-center cursor-default`} aria-label="What does this mean?">i</span>
      <span className="pointer-events-none absolute left-0 bottom-full mb-1.5 w-56 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[13px] text-foreground opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-md">{text}</span>
    </span>
  );
}

// Organisational Metadata grid: label/value rows with a divider between each,
// used for the compact attribute list in the Overview tab.
function MetadataRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-1.5 sm:gap-6 py-4 border-b border-slate-100 last:border-b-0">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <div className="text-sm font-medium text-slate-900">{children}</div>
    </div>
  );
}
function MetaBadge({ tone, children }: { tone: "indigo" | "emerald"; children: React.ReactNode }) {
  const toneClasses = tone === "indigo" ? "bg-indigo-50 text-indigo-800 border-indigo-200" : "bg-emerald-50 text-emerald-800 border-emerald-200";
  return <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${toneClasses}`}>{children}</span>;
}
function TagPill({ children }: { children: React.ReactNode }) {
  return <span className="inline-block bg-white border border-slate-200 px-2.5 py-1 rounded-md text-xs font-medium text-slate-800 shadow-sm">{children}</span>;
}

// Fetches a signed URL for a DD evidence document. Shared by the Q&A modal's
// document list and the inline document rows on the DD Readiness checklist.
async function fetchDdDocumentUrl(doc: DDDocument): Promise<{ url: string; fileName: string } | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-dd-document-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}` },
      body: JSON.stringify({ documentId: doc.id }),
    });
    const result = await res.json();
    return result.url ? { url: result.url, fileName: doc.file_name } : null;
  } catch {
    return null;
  }
}

function DocumentPreviewModal({ preview, onClose }: { preview: { url: string; fileName: string }; onClose: () => void }) {
  const [docxHtml, setDocxHtml] = useState<string | null>(null);
  const [docxLoading, setDocxLoading] = useState(false);
  const [docxError, setDocxError] = useState(false);

  useEffect(() => {
    const ext = preview.fileName.split(".").pop()?.toLowerCase() ?? "";
    if (ext !== "docx") return;
    setDocxLoading(true);
    setDocxError(false);
    fetch(preview.url)
      .then(res => res.arrayBuffer())
      .then(buffer => mammoth.convertToHtml({ arrayBuffer: buffer }))
      .then(result => setDocxHtml(result.value))
      .catch(() => setDocxError(true))
      .finally(() => setDocxLoading(false));
  }, [preview.url, preview.fileName]);

  const ext = preview.fileName.split(".").pop()?.toLowerCase() ?? "";
  const isImage = ["png", "jpg", "jpeg", "webp", "gif"].includes(ext);
  const isPdf = ext === "pdf";
  const isDocx = ext === "docx";

  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-card rounded-2xl border border-border w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border shrink-0">
          <button type="button" onClick={onClose} className={`text-[15px] ${CHARCOAL} hover:text-foreground flex items-center gap-1.5 shrink-0`}>
            ← Back
          </button>
          <p className="text-[15px] font-medium text-foreground truncate flex-1 text-center">{preview.fileName}</p>
          <a href={preview.url} download={preview.fileName} className="text-[15px] text-[#2D6A4F] hover:underline underline-offset-2 shrink-0">Download</a>
        </div>
        <div className="flex-1 overflow-auto bg-muted/20 flex items-start justify-center min-h-[50vh]">
          {isImage ? (
            <img src={preview.url} alt={preview.fileName} className="max-w-full max-h-[85vh] object-contain" />
          ) : isPdf ? (
            <iframe src={preview.url} title={preview.fileName} className="w-full h-[75vh] border-0" />
          ) : isDocx ? (
            docxLoading ? (
              <div className={`p-8 flex items-center gap-2 text-[15px] ${CHARCOAL}`}><Loader2 className="w-4 h-4 animate-spin" /> Loading preview...</div>
            ) : docxError || !docxHtml ? (
              <div className="p-8 text-center space-y-2">
                <p className={`text-[15px] ${CHARCOAL}`}>Couldn't render a preview for this file.</p>
                <a href={preview.url} download={preview.fileName} className="text-[15px] text-[#2D6A4F] hover:underline underline-offset-2 font-medium">Download {preview.fileName}</a>
              </div>
            ) : (
              <div className="w-full h-full overflow-auto bg-white p-6 sm:p-10">
                <div className="max-w-2xl mx-auto text-[15px] text-neutral-900 leading-relaxed [&_p]:mb-3 [&_h1]:text-[21px] [&_h1]:font-bold [&_h2]:text-[19px] [&_h2]:font-bold [&_table]:border-collapse [&_td]:border [&_td]:border-neutral-300 [&_td]:px-2 [&_td]:py-1" dangerouslySetInnerHTML={{ __html: docxHtml }} />
              </div>
            )
          ) : (
            <div className="p-8 text-center space-y-2">
              <p className={`text-[15px] ${CHARCOAL}`}>Preview isn't available for this file type.</p>
              <a href={preview.url} download={preview.fileName} className="text-[15px] text-[#2D6A4F] hover:underline underline-offset-2 font-medium">Download {preview.fileName}</a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// DD Readiness checklist card: status + inline attached-document rows, per
// the compliance-review layout. "Documented" / "Self-reported" / "Not
// provided" is derived from real data (a done flag plus whether files were
// actually uploaded) rather than a fabricated verification claim, since
// none of this is verified by Impact Natives.
function DDChecklistCard({ item, done, documents, hasDetails, onViewDetails, onViewDocument, viewingDocId }: {
  item: DDItemDef; done: boolean | undefined; documents: DDDocument[]; hasDetails: boolean;
  onViewDetails: () => void; onViewDocument: (doc: DDDocument) => void; viewingDocId: string | null;
}) {
  const hasDocs = documents.length > 0;
  const status = done ? (hasDocs ? "Documented" : "Self-reported") : "Not provided";
  const statusColor = done ? (hasDocs ? "text-emerald-700" : "text-amber-700") : "text-slate-400";
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <span className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${done ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"}`}>
            {done ? "✓" : "·"}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900">{item.label}</p>
            <p className={`text-xs font-medium mt-0.5 ${statusColor}`}>{status}</p>
          </div>
        </div>
        {hasDetails && (
          <button type="button" onClick={onViewDetails} className="text-xs font-medium text-[#2D6A4F] hover:underline shrink-0">
            View details
          </button>
        )}
      </div>
      {hasDocs && (
        <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
          {documents.map(doc => (
            <div key={doc.id} className="flex items-center justify-between gap-2 bg-slate-50/70 border border-slate-100 rounded-lg p-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="text-xs text-slate-700 truncate">{doc.file_name}</span>
              </div>
              <button type="button" onClick={() => onViewDocument(doc)} disabled={viewingDocId === doc.id}
                className="text-xs font-medium text-[#2D6A4F] hover:underline shrink-0 flex items-center gap-1 disabled:opacity-50">
                {viewingDocId === doc.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <ExternalLink className="w-3 h-3" />} View
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DDEvidenceViewModal({ item, evidence, documents, canSeeSensitive, canSeeDisclosureDetail, onViewDocument, viewingDocId, onClose }: {
  item: DDItemDef; evidence: Record<string, any>; documents: DDDocument[]; canSeeSensitive: boolean; canSeeDisclosureDetail: boolean;
  onViewDocument: (doc: DDDocument) => void; viewingDocId: string | null; onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-card rounded-2xl border border-border w-full max-w-sm p-6 space-y-3" onClick={e => e.stopPropagation()}>
        <div>
          <h3 className="text-[19px] font-bold text-foreground">{item.label}</h3>
          <p className={`text-[15px] ${CHARCOAL} mt-0.5`}>{item.sub}</p>
        </div>
        <div className="space-y-3">
          {item.questions.map(q => {
            const isSensitive = DD_SENSITIVE_EVIDENCE_KEYS.has(q.key);
            if (isSensitive && !canSeeSensitive) {
              return (
                <div key={q.key}>
                  <p className={`text-[13px] font-semibold uppercase tracking-wider ${CHARCOAL}`}>{q.label}</p>
                  <p className={`text-[15px] ${CHARCOAL} italic mt-0.5`}>Visible once you're in an active conversation</p>
                </div>
              );
            }
            const raw = evidence[q.key];
            const display = raw === true ? "Yes" : raw === false ? "No"
              : (raw === "Other" || raw === "Custom") ? (evidence[`${q.key}_custom`] || raw)
              : q.type === "date" && raw ? new Date(raw).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
              : raw;
            if (!display) return null;
            const followUp = q.type === "yesno" && q.followUpIfYes && raw === true ? evidence[q.followUpIfYes.key] : null;
            const isDisclosureDetailKey = q.key === "hasBlacklisting" || q.key === "hasPendingDisputes";
            const withholdDisclosureDetail = isDisclosureDetailKey && !canSeeDisclosureDetail;
            return (
              <div key={q.key}>
                <p className={`text-[13px] font-semibold uppercase tracking-wider ${CHARCOAL}`}>{q.label}</p>
                <p className="text-[15px] text-foreground mt-0.5">{display}</p>
                {followUp && !withholdDisclosureDetail && <p className={`text-[15px] ${CHARCOAL} mt-1 italic`}>{followUp}</p>}
              </div>
            );
          })}
        </div>
        {documents.length > 0 && (
          <div className="pt-3 border-t border-border space-y-1.5">
            <p className={`text-[13px] font-semibold uppercase tracking-wider ${CHARCOAL}`}>Supporting documents</p>
            {documents.map(doc => (
              <button key={doc.id} type="button" onClick={() => onViewDocument(doc)} disabled={viewingDocId === doc.id}
                className="w-full flex items-center justify-between gap-2 text-left text-[15px] text-foreground hover:underline underline-offset-2 disabled:opacity-50">
                <span className="truncate">{doc.file_name}</span>
                {viewingDocId === doc.id && <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />}
              </button>
            ))}
          </div>
        )}
        <button type="button" onClick={onClose} className={`w-full h-9 rounded-full border border-border text-[15px] ${CHARCOAL} hover:text-foreground transition-colors`}>Close</button>
      </div>
    </div>
  );
}

function OrgDrawerContent({ org, onClose }: { org: OrgRow; onClose: () => void }) {
  const { user, profile } = useAuth();
  const isVerified = org.verification_status === "verified";
  const viewerIsFunder = ["philanthropic_foundation", "venture_capital"].includes(profile?.org_type ?? "");
  const viewerIsCorporate = ["corporation", "technology_company", "public_sector"].includes(profile?.org_type ?? "");
  const isOwnProfile = !!user?.id && user.id === org.user_id;
  const canSeeDisclosureDetail = isOwnProfile || viewerIsFunder || viewerIsCorporate;

  const [viewerTier, setViewerTier] = useState<string | null>(null);
  const [exportState, setExportState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportDownloadUrl, setExportDownloadUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!user || isOwnProfile || !(viewerIsFunder || viewerIsCorporate)) return;
    supabase.from("organizations").select("subscription_tier").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setViewerTier(data?.subscription_tier ?? null));
  }, [user, isOwnProfile, viewerIsFunder, viewerIsCorporate]);

  async function handleExportDD() {
    setExportState("loading");
    setExportError(null);
    setExportDownloadUrl(null);
    const { data, error } = await supabase.functions.invoke("generate-dd-export", { body: { subject_org_id: org.id } });
    if (error || data?.error) {
      setExportState("error");
      setExportError(data?.error ?? error?.message ?? "Export failed");
      return;
    }
    setExportDownloadUrl(data.data.download_url);
    setExportState("done");
  }

  const sectors = normalizeArr(org.sector);
  const countries = normalizeArr(org.country);

  const [activeTab, setActiveTab] = useState<DrawerTab>("overview");
  const [aiSummary, setAiSummary] = useState<string | null>(org.ai_partnership_summary ?? null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [ddViewingKey, setDdViewingKey] = useState<string | null>(null);
  const [canSeeSensitive, setCanSeeSensitive] = useState(false);
  const [docsByItem, setDocsByItem] = useState<Record<string, DDDocument[]>>({});
  const [previewDoc, setPreviewDoc] = useState<{ url: string; fileName: string } | null>(null);
  const [viewingDocId, setViewingDocId] = useState<string | null>(null);

  async function handleViewDocument(doc: DDDocument) {
    setViewingDocId(doc.id);
    const result = await fetchDdDocumentUrl(doc);
    if (result) setPreviewDoc(result);
    else alert("Couldn't open document.");
    setViewingDocId(null);
  }
  const [deliveryStats, setDeliveryStats] = useState<{ completed: number; stalled: number; fell_through: number; resolved: number; total: number } | null>(null);

  useEffect(() => {
    if (!user || user.id === org.user_id) { setCanSeeSensitive(true); return; }
    supabase.from("organizations").select("id").eq("user_id", user.id).maybeSingle()
      .then(({ data: myOrg }) => {
        hasLiveRelationshipWith({ viewerUserId: user.id, viewerOrgId: myOrg?.id ?? null, targetUserId: org.user_id, targetOrgId: org.id }).then(setCanSeeSensitive);
      });
  }, [user, org.user_id, org.id]);

  useEffect(() => {
    supabase.from("dd_evidence_documents")
      .select("id,organization_id,dd_item_key,file_path,file_name,visibility,created_at")
      .eq("organization_id", org.id)
      .then(({ data }) => {
        const grouped: Record<string, DDDocument[]> = {};
        (data ?? []).forEach((doc: DDDocument) => { grouped[doc.dd_item_key] = [...(grouped[doc.dd_item_key] ?? []), doc]; });
        setDocsByItem(grouped);
      });
  }, [org.id]);

  async function generateSummary() {
    if (!org.description && !org.needs?.length && !org.offers?.length) return;
    setLoadingAi(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-partnership-summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organisation_name: org.organisation_name, description: org.description, sectors: normalizeArr(org.sector),
          needs: org.needs, offers: org.offers, sdgs: org.sdgs, organisation_type: org.organisation_type,
          country: normalizeArr(org.country)[0] ?? null,
        }),
      });
      const result = await res.json();
      if (result.summary) {
        setAiSummary(result.summary);
        await supabase.from("organizations").update({ ai_partnership_summary: result.summary }).eq("id", org.id);
      }
    } catch {}
    setLoadingAi(false);
  }
  useEffect(() => { if (!aiSummary) generateSummary(); }, [org.id]);

  const [orgInitiatives, setOrgInitiatives] = useState<any[]>([]);
  const [orgPartnership, setOrgPartnership] = useState<any | null>(null);
  const [reputationPartners, setReputationPartners] = useState<any[]>([]);

  useEffect(() => {
    supabase.from("initiative_requests")
      .select("id,title,sectors,locations,budget,eois,status,co_funding_status,specific_ask")
      .eq("user_id", org.user_id).eq("status", "published").order("created_at", { ascending: false }).limit(3)
      .then(({ data }) => setOrgInitiatives(data ?? []));

    if (org.partnership_listed) {
      setOrgPartnership({
        title: org.partnership_title, sought: org.partnership_sought, stage: org.partnership_stage,
        budget: org.partnership_budget, timeline: org.partnership_decision_timeline, funding_status: org.partnership_funding_status,
      });
    }

    supabase.from("initiative_requests").select("id,title,user_id,confirmed_partners").not("confirmed_partners", "eq", "[]")
      .then(({ data }) => {
        if (!data) return;
        const results: any[] = [];
        data.forEach((ini: any) => {
          const partners = ((ini.confirmed_partners ?? []) as any[]).filter((p: any) => (p.status ?? "confirmed") === "confirmed");
          if (ini.user_id === org.user_id) {
            partners.forEach((p: any) => results.push({ initiative_title: ini.title, partner_name: p.name, role: p.role, as: "owner" }));
          } else {
            const asPartner = partners.find((p: any) => p.user_id === org.user_id);
            if (asPartner) results.push({ initiative_title: ini.title, partner_name: null, role: asPartner.role, as: "partner" });
          }
        });
        setReputationPartners(results);
      });
  }, [org.id]);

  useEffect(() => {
    supabase.rpc("get_org_delivery_stats", { target_org_id: org.id }).then(({ data }) => { if (data?.[0]) setDeliveryStats(data[0]); });
  }, [org.id]);

  const ddItemsArr = [org.dd_financial_model, org.dd_audited_accounts, org.dd_governance_doc, org.dd_esg_assessment, org.dd_impact_framework, org.dd_environmental_policy, org.dd_safeguarding_policy, org.dd_legal_registration, org.dd_legal_compliance_declaration];
  const ddScore = Math.round((ddItemsArr.filter(Boolean).length / ddItemsArr.length) * 100);
  const ddStateMap: Record<string, boolean | undefined> = {
    financial_model: org.dd_financial_model, audited_accounts: org.dd_audited_accounts, governance_doc: org.dd_governance_doc,
    esg_assessment: org.dd_esg_assessment, impact_framework: org.dd_impact_framework, environmental_policy: org.dd_environmental_policy,
    safeguarding_policy: org.dd_safeguarding_policy, legal_registration: org.dd_legal_registration, legal_compliance_declaration: org.dd_legal_compliance_declaration,
  };

  const fddItemsArr = [org.fdd_disbursement_track_record, org.fdd_decision_transparency, org.fdd_conflict_disclosure, org.fdd_governance_doc, org.fdd_esg_framework, org.fdd_legal_registration];
  const fddScore = Math.round((fddItemsArr.filter(Boolean).length / fddItemsArr.length) * 100);
  const fddStateMap: Record<string, boolean | undefined> = {
    disbursement_track_record: org.fdd_disbursement_track_record, decision_transparency: org.fdd_decision_transparency,
    conflict_disclosure: org.fdd_conflict_disclosure, governance_doc: org.fdd_governance_doc, esg_framework: org.fdd_esg_framework, legal_registration: org.fdd_legal_registration,
  };

  const hasTrackRecord = !!(org.total_beneficiaries_reached || org.jobs_created || org.grants_received_count || org.years_of_operation);
  const hasDelivery = !!(deliveryStats && deliveryStats.resolved >= 1);
  const deliveryRate = hasDelivery ? Math.round((deliveryStats!.completed / deliveryStats!.resolved) * 100) : null;
  const deliveryInProgress = deliveryStats ? deliveryStats.total - deliveryStats.resolved : 0;

  const isImplementerOrg = !["philanthropic_foundation", "venture_capital", "corporation", "technology_company", "public_sector"].includes(org.organisation_type ?? "");
  const showCsrEsg = ["corporation", "technology_company"].includes(org.organisation_type ?? "") &&
    !!(org.csr_focus_statement || org.inkind_support?.length || org.esg_frameworks?.length || org.tech_support_available?.length);
  const isConsultancyOrg = org.organisation_type === "consultancy";
  const hasConsultancyExpertise = isConsultancyOrg && !!(org.specializations?.length || org.notable_engagements?.length || org.affiliations?.length);

  let impactPillars: any[] = [];
  if (org.impact_strategy) { try { impactPillars = JSON.parse(org.impact_strategy)?.pillars ?? []; } catch {} }

  return (
    <>
      <DrawerHeader userId={org.user_id} onClose={onClose} />
      <div className="overflow-y-auto flex-1">
        {/* Hero */}
        <div className="px-8 pt-10 pb-6 flex items-start gap-5 border-b border-slate-100 relative z-20">
          <EntityHeroAvatar name={org.organisation_name || "?"} imageUrl={org.logo_url} size={64} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="text-xl font-bold text-slate-900 tracking-tight">{org.organisation_name}</h3>
              {isVerified && <VerifiedBadge withTooltip />}
              {canDisplayImpactScoreForOrg(org.subscription_tier, org.show_impact_score) && <ImpactScoreBadge score={org.impact_score ?? 0} />}
            </div>
            <p className={`text-sm font-medium ${CHARCOAL} mt-1`}>
              {org.organisation_type && <span className="capitalize">{org.organisation_type.replace(/_/g, " ")}</span>}
              {org.organisation_type && countries.length > 0 && " · "}
              {countries.join(", ")}
              {org.year_founded && ` · Est. ${org.year_founded}`}
            </p>
            {org.website && org.website !== "https://" && (
              <a href={org.website} target="_blank" rel="noopener noreferrer" className="text-xs text-slate-600 hover:text-emerald-700 underline underline-offset-2 mt-1 inline-flex items-center gap-1">
                <Globe className="w-3.5 h-3.5" /> {org.website.replace(/^https?:\/\//, "")}
              </a>
            )}
          </div>
        </div>

        {/* Partnership Fit banner */}
        {(aiSummary || loadingAi) && (
          <div className="mx-8 mt-6 p-5 rounded-2xl bg-white border border-slate-200 shadow-lg shadow-slate-900/10 space-y-2">
            <div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${CHARCOAL}`}>
              <Sparkles className={`w-4 h-4 ${CHARCOAL}`} /> <span>Partnership Fit</span>
              {!loadingAi && (
                <button type="button" onClick={() => { setAiSummary(null); generateSummary(); }} className="ml-auto p-1 rounded hover:opacity-70 transition-opacity" title="Refresh">
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {loadingAi ? (
              <div className="flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" /><p className={`text-sm ${CHARCOAL}`}>Generating partnership summary...</p></div>
            ) : (
              <p className={`text-sm ${CHARCOAL} leading-relaxed`}>{aiSummary}</p>
            )}
          </div>
        )}

        <div className="pt-6">
          <DrawerTabs
            active={activeTab}
            onChange={setActiveTab}
            tabs={[
              { key: "overview", label: "Overview" },
              { key: "dueDiligence", label: "Due Diligence Readiness" },
              { key: "initiatives", label: "Active Initiatives" },
              { key: "strategy", label: "Impact Strategy" },
            ]}
          />
        </div>

        {/* Overview */}
        {activeTab === "overview" && (
          <div className="px-8 py-6 space-y-8">
            {org.description && <p className="text-sm text-slate-800 leading-relaxed">{org.description}</p>}

            {hasTrackRecord && (
              <div>
                <div className="flex items-center gap-1.5"><p className="text-sm font-semibold text-slate-900">Track record</p><InfoTooltip text={PILLAR_INFO.trackRecord} /></div>
                <p className={`text-[13px] ${CHARCOAL} mt-1 mb-3`}>Self-reported reach and history</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
                  {org.total_beneficiaries_reached && <div><p className={`text-xs font-medium uppercase ${CHARCOAL} mb-0.5`}>Beneficiaries reached</p><p className="text-sm font-semibold text-slate-900">{org.total_beneficiaries_reached.toLocaleString()}</p></div>}
                  {org.jobs_created && <div><p className={`text-xs font-medium uppercase ${CHARCOAL} mb-0.5`}>Jobs created</p><p className="text-sm font-semibold text-slate-900">{org.jobs_created.toLocaleString()}</p></div>}
                  {org.years_of_operation && <div><p className={`text-xs font-medium uppercase ${CHARCOAL} mb-0.5`}>Years operating</p><p className="text-sm font-semibold text-slate-900">{org.years_of_operation}</p></div>}
                  {org.female_beneficiaries_pct && <div><p className={`text-xs font-medium uppercase ${CHARCOAL} mb-0.5`}>Female beneficiaries</p><p className="text-sm font-semibold text-slate-900">{org.female_beneficiaries_pct}%</p></div>}
                  {org.youth_beneficiaries_pct && <div><p className={`text-xs font-medium uppercase ${CHARCOAL} mb-0.5`}>Youth beneficiaries</p><p className="text-sm font-semibold text-slate-900">{org.youth_beneficiaries_pct}%</p></div>}
                  {org.grants_received_count && <div><p className={`text-xs font-medium uppercase ${CHARCOAL} mb-0.5`}>Grants received</p><p className="text-sm font-semibold text-slate-900">{org.grants_received_count}</p></div>}
                  {org.grants_total_value_usd && <div><p className={`text-xs font-medium uppercase ${CHARCOAL} mb-0.5`}>Total grant value</p><p className="text-sm font-semibold text-slate-900">${org.grants_total_value_usd.toLocaleString()}</p></div>}
                  {org.grants_delivered_on_time_pct && <div><p className={`text-xs font-medium uppercase ${CHARCOAL} mb-0.5`}>Delivered on time</p><p className="text-sm font-semibold text-slate-900">{org.grants_delivered_on_time_pct}%</p></div>}
                </div>
                {org.previous_funders && org.previous_funders.length > 0 && <p className="text-sm text-slate-800 mt-4"><span className="font-semibold">Previous funders: </span>{org.previous_funders.join(", ")}</p>}
                {org.third_party_evaluations && (
                  <div className="flex items-center gap-1.5 text-sm text-[#2D6A4F] mt-3">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                    Third-party evaluations available
                  </div>
                )}
              </div>
            )}

            {hasConsultancyExpertise && (
              <div>
                <p className="text-sm font-semibold text-slate-900 mb-1.5">Consultant expertise</p>
                {org.specializations && org.specializations.length > 0 && (
                  <div className="mb-3"><p className={`text-xs font-medium uppercase ${CHARCOAL} mb-1.5`}>Specializations</p>
                    <div className="flex flex-wrap gap-2">{org.specializations.map(s => <span key={s} className="text-sm font-medium px-3 py-1 rounded-md" style={{ color: "#0F6E56", background: "#E1F5EE" }}>{s}</span>)}</div>
                  </div>
                )}
                {org.notable_engagements && org.notable_engagements.length > 0 && (
                  <div className="mb-3"><p className={`text-xs font-medium uppercase ${CHARCOAL} mb-1.5`}>Notable engagements</p>
                    <ul className="text-sm text-slate-800 space-y-1 list-disc list-inside">{org.notable_engagements.map(e => <li key={e}>{e}</li>)}</ul>
                  </div>
                )}
                {org.affiliations && org.affiliations.length > 0 && <p className="text-sm text-slate-800"><span className="font-semibold">Affiliations: </span>{org.affiliations.join(", ")}</p>}
              </div>
            )}

            {org.investment_thesis && (
              <div><div className="flex items-center gap-1.5 mb-1.5"><Sparkles className="w-3 h-3 text-[#2D6A4F]" /><p className="text-sm font-semibold text-slate-900">Investment thesis</p></div>
                <p className="text-sm text-slate-800 leading-relaxed">{org.investment_thesis}</p>
              </div>
            )}

            {/* Organisational Metadata */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Organisational Metadata</p>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                {sectors.length > 0 && (
                  <MetadataRow label="Sector">
                    <div className="flex flex-wrap gap-1.5">{sectors.map(s => <MetaBadge key={s} tone="indigo">{s}</MetaBadge>)}</div>
                  </MetadataRow>
                )}
                {countries.length > 0 && (
                  <MetadataRow label="Location">
                    <div className="flex flex-wrap gap-1.5">{countries.map(c => <MetaBadge key={c} tone="emerald">{c}</MetaBadge>)}</div>
                  </MetadataRow>
                )}
                {((org.needs && org.needs.length > 0) || (org.offers && org.offers.length > 0)) && (
                  <MetadataRow label="Seeking & Offers">
                    {[...(org.needs ?? []), ...(org.offers ?? [])].join(" · ")}
                  </MetadataRow>
                )}
                {org.stage_preference && org.stage_preference.length > 0 && (
                  <MetadataRow label="Stage Preference">{org.stage_preference.join(", ")}</MetadataRow>
                )}
                {org.geographic_focus && org.geographic_focus.length > 0 && (
                  <MetadataRow label="Geographic Focus">{org.geographic_focus.join(", ")}</MetadataRow>
                )}
                {showCsrEsg && org.csr_focus_statement && (
                  <MetadataRow label="CSR & ESG Focus">{org.csr_focus_statement}</MetadataRow>
                )}
                {showCsrEsg && org.csr_budget_range && (
                  <MetadataRow label="CSR Budget">{org.csr_budget_range}</MetadataRow>
                )}
                {showCsrEsg && ((org.inkind_support && org.inkind_support.length > 0) || (org.esg_frameworks && org.esg_frameworks.length > 0)) && (
                  <MetadataRow label="What We Bring">
                    <div className="space-y-2">
                      {org.inkind_support && org.inkind_support.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">{org.inkind_support.map(s => <TagPill key={s}>{s}</TagPill>)}</div>
                      )}
                      {org.esg_frameworks && org.esg_frameworks.length > 0 && (
                        <div className="flex items-center flex-wrap gap-1.5">
                          <span className="text-xs text-slate-500 mr-0.5">Frameworks:</span>
                          {org.esg_frameworks.map(f => <TagPill key={f}>{f}</TagPill>)}
                        </div>
                      )}
                    </div>
                  </MetadataRow>
                )}
                {showCsrEsg && (org.employee_engagement_available || org.cobranding_open) && (
                  <MetadataRow label="Partnership Preferences">
                    <div className="space-y-1">
                      {org.employee_engagement_available && <p>Open to employee engagement</p>}
                      {org.cobranding_open && <p>Open to co-branding</p>}
                    </div>
                  </MetadataRow>
                )}
                {showCsrEsg && ((org.tech_support_available && org.tech_support_available.length > 0) || org.sandbox_ready) && (
                  <MetadataRow label="Technology Support Available">
                    <div className="flex flex-wrap gap-1.5">
                      {org.tech_support_available?.map(t => <TagPill key={t}>{t}</TagPill>)}
                      {org.sandbox_ready && <TagPill>Open to sandbox or beta testing</TagPill>}
                    </div>
                  </MetadataRow>
                )}
                {org.contact_name && <MetadataRow label="Contact">{org.contact_name}</MetadataRow>}
              </div>
              {showCsrEsg && org.sandbox_ready && org.sandbox_description && (
                <p className="text-sm text-slate-800 leading-relaxed mt-3">{org.sandbox_description}</p>
              )}
            </div>

            {isImplementerOrg && <EsgSnapshotSection org={org} />}
          </div>
        )}

        {/* Due Diligence Readiness */}
        {activeTab === "dueDiligence" && (
          <div className="px-8 py-6 space-y-8">
            {ddScore > 0 && (
              <div>
                <div className="bg-white border border-slate-200 rounded-xl p-5 mb-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Due Diligence Readiness Scorecard</p>
                  <div className="flex items-center gap-3 flex-wrap">
                    <TrustBadge tier={computeTrustTier(ddScore, org.dd_evidence).tier} withTooltip />
                    <span className="text-sm font-semibold text-slate-900">Score: {ddScore}%</span>
                  </div>
                  <div className="h-[3px] bg-slate-200 rounded-full mt-3">
                    <div className="h-full rounded-full bg-[#2D6A4F] transition-all duration-500" style={{ width: `${ddScore}%` }} />
                  </div>
                  <div className="flex items-start gap-1.5 mt-3">
                    <InfoTooltip text={PILLAR_INFO.ddReadiness} />
                    <p className="text-xs text-slate-500 leading-relaxed">What the organisation has confirmed about itself directly. Not verified by Impact Natives.</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {DD_ITEMS.map(item => {
                    const done = ddStateMap[item.key];
                    const hasDetails = !!(done && org.dd_evidence?.[item.key]);
                    return (
                      <DDChecklistCard key={item.key} item={item} done={done} documents={docsByItem[item.key] ?? []}
                        hasDetails={hasDetails} onViewDetails={() => setDdViewingKey(item.key)}
                        onViewDocument={handleViewDocument} viewingDocId={viewingDocId} />
                    );
                  })}
                </div>

                {!isOwnProfile && (viewerIsFunder || viewerIsCorporate) && (
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    {viewerTier !== "compliance" ? (
                      <p className="text-[13px] text-slate-500">Audit-ready DD export is a Compliance plan feature.</p>
                    ) : ddScore < 70 ? (
                      <p className="text-[13px] text-slate-500">DD export requires at least 70% readiness (currently {ddScore}%).</p>
                    ) : exportState === "done" && exportDownloadUrl ? (
                      <a href={exportDownloadUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[15px] font-medium text-[#2D6A4F] hover:underline">Download DD export (PDF)</a>
                    ) : (
                      <div>
                        <button type="button" onClick={handleExportDD} disabled={exportState === "loading"}
                          className="text-[15px] font-medium px-3.5 py-2 rounded-lg text-white transition-opacity disabled:opacity-60" style={{ background: "#2D6A4F" }}>
                          {exportState === "loading" ? "Generating export…" : "Export audit-ready DD (PDF)"}
                        </button>
                        {exportState === "error" && exportError && <p className="text-[13px] text-red-600 dark:text-red-400 mt-2">{exportError}</p>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {fddScore > 0 && (
              <div>
                <div className="bg-white border border-slate-200 rounded-xl p-5 mb-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Due Diligence Readiness Scorecard</p>
                  <div className="flex items-center gap-3 flex-wrap">
                    <TrustBadge tier={computeTrustTier(fddScore, org.dd_evidence).tier} withTooltip />
                    <span className="text-sm font-semibold text-slate-900">Score: {fddScore}%</span>
                  </div>
                  <div className="h-[3px] bg-slate-200 rounded-full mt-3">
                    <div className="h-full rounded-full bg-[#2D6A4F] transition-all duration-500" style={{ width: `${fddScore}%` }} />
                  </div>
                  <div className="flex items-start gap-1.5 mt-3">
                    <InfoTooltip text={PILLAR_INFO.ddReadiness} />
                    <p className="text-xs text-slate-500 leading-relaxed">What the organisation has confirmed about itself directly. Not verified by Impact Natives.</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {FUNDER_DD_ITEMS.map(item => {
                    const done = fddStateMap[item.key];
                    const hasDetails = !!(done && org.dd_evidence?.[item.key]);
                    return (
                      <DDChecklistCard key={item.key} item={item} done={done} documents={docsByItem[item.key] ?? []}
                        hasDetails={hasDetails} onViewDetails={() => setDdViewingKey(item.key)}
                        onViewDocument={handleViewDocument} viewingDocId={viewingDocId} />
                    );
                  })}
                </div>
              </div>
            )}

            {ddScore === 0 && fddScore === 0 && (
              <p className={`text-sm ${CHARCOAL}`}>No due diligence information published yet.</p>
            )}
          </div>
        )}

        {/* Active Initiatives */}
        {activeTab === "initiatives" && (
          <div className="px-8 py-6 space-y-8">
            {orgPartnership?.title && (
              <div>
                <p className="text-[17px] font-bold text-foreground mb-4">Partnership listing</p>
                <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm hover:border-slate-300 transition">
                  <p className="text-sm font-bold text-slate-900">{orgPartnership.title}</p>
                  {orgPartnership.sought && <p className="text-xs text-slate-700 leading-relaxed mt-1">{orgPartnership.sought}</p>}
                  <p className="text-xs text-slate-700 mt-2">
                    {[orgPartnership.stage?.replace(/_/g, " "), orgPartnership.funding_status?.replace(/_/g, " "), orgPartnership.budget?.replace(/_/g, "–")].filter(Boolean).join(" · ")}
                  </p>
                </div>
              </div>
            )}

            {orgInitiatives.length > 0 ? (
              <div>
                <p className="text-[17px] font-bold text-foreground mb-4">Active initiatives</p>
                <div className="space-y-4">
                  {orgInitiatives.map(ini => (
                    <div key={ini.id} className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm hover:border-slate-300 transition">
                      <p className="text-sm font-bold text-slate-900">{ini.title}</p>
                      <p className="text-xs font-medium text-slate-700 mt-1">
                        {[ini.locations?.slice(0, 2).join(", "), ini.budget].filter(Boolean).join(" · ")}
                        {ini.eois ? ` · ${ini.eois} EOI${ini.eois !== 1 ? "s" : ""}` : ""}
                      </p>
                      {ini.sectors?.length > 0 && <span className="inline-block mt-2 text-xs font-medium px-2.5 py-1 rounded-md bg-slate-100 text-slate-800">{ini.sectors.slice(0, 2).join(", ")}</span>}
                    </div>
                  ))}
                </div>
              </div>
            ) : !orgPartnership?.title && <p className={`text-sm ${CHARCOAL}`}>No active initiatives or partnership listing yet.</p>}

            {deliveryStats && (
              <div>
                <div className="flex items-center gap-1.5 mb-1"><p className="text-[17px] font-bold text-foreground">Delivery</p><InfoTooltip text={PILLAR_INFO.delivery} /></div>
                <p className={`text-[13px] ${CHARCOAL} mb-3`}>From outcomes tracked on this platform</p>
                {hasDelivery ? (
                  <>
                    <DeliveryDonutChart
                      rate={deliveryRate ?? 0}
                      completed={deliveryStats.completed}
                      resolved={deliveryStats.resolved}
                      stalled={deliveryStats.stalled}
                      fellThrough={deliveryStats.fell_through}
                      inProgress={deliveryInProgress}
                    />
                    <p className="text-sm text-slate-800 mt-4">
                      {deliveryStats.completed} of {deliveryStats.resolved} relationship{deliveryStats.resolved !== 1 ? "s" : ""} completed
                      {[deliveryStats.stalled > 0 ? `${deliveryStats.stalled} stalled` : null, deliveryStats.fell_through > 0 ? `${deliveryStats.fell_through} fell through` : null, deliveryInProgress > 0 ? `${deliveryInProgress} still in progress` : null].filter(Boolean).length > 0
                        ? ` (${[deliveryStats.stalled > 0 ? `${deliveryStats.stalled} stalled` : null, deliveryStats.fell_through > 0 ? `${deliveryStats.fell_through} fell through` : null, deliveryInProgress > 0 ? `${deliveryInProgress} still in progress` : null].filter(Boolean).join(", ")})`
                        : ""}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-slate-800">{deliveryStats.total === 0 ? "No tracked delivery history yet." : `${deliveryStats.total} active relationship${deliveryStats.total !== 1 ? "s" : ""}, no completed outcomes yet.`}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Impact Strategy */}
        {activeTab === "strategy" && (
          <div className="px-8 py-6 space-y-8">
            {impactPillars.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-4"><Sparkles className="w-4 h-4 text-[#2D6A4F]" /><p className="text-[17px] font-bold text-foreground">Proposed deployments</p></div>
                <div className="space-y-4">
                  {impactPillars.map((pillar: any, i: number) => {
                    const publishedRow = orgInitiatives.find(ini => ini.title === pillar.pillar_name);
                    const specificAsk = publishedRow?.specific_ask ?? pillar.specific_ask_draft;
                    return (
                      <div key={i} className="bg-white border border-slate-200 rounded-lg p-4">
                        <p className="text-sm font-bold text-slate-900">{pillar.pillar_name}</p>
                        {specificAsk && <p className="text-xs leading-relaxed text-slate-700 mt-1">{specificAsk}</p>}
                        {pillar.un_sdg_code && (
                          <span className="inline-block mt-2 text-xs font-medium px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">{pillar.un_sdg_code}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {org.sdgs && org.sdgs.length > 0 && (
              <div>
                <p className="text-[17px] font-bold text-foreground mb-4">SDG alignment</p>
                <div className="flex flex-wrap gap-2">{org.sdgs.map(s => <span key={s} className="text-sm font-medium px-3 py-1 rounded-md" style={{ background: "#2D6A4F", color: "white" }}>{sdgLabel(s)}</span>)}</div>
              </div>
            )}

            {reputationPartners.length > 0 && (
              <div>
                <p className="text-[17px] font-bold text-foreground mb-4">Confirmed partnerships</p>
                <div className="space-y-2">
                  {reputationPartners.slice(0, 5).map((p, i) => (
                    <p key={i} className="text-sm text-slate-800">
                      {p.as === "owner" ? `Partnered with ${p.partner_name} as ${partnerRolePhrase(p.role)} on "${p.initiative_title}"` : `Confirmed as ${partnerRolePhrase(p.role)} on "${p.initiative_title}"`}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {impactPillars.length === 0 && !(org.sdgs && org.sdgs.length > 0) && reputationPartners.length === 0 && (
              <p className={`text-sm ${CHARCOAL}`}>No impact strategy published yet.</p>
            )}
          </div>
        )}
      </div>

      {ddViewingKey && (() => {
        const item = DD_ITEMS.find(i => i.key === ddViewingKey) ?? FUNDER_DD_ITEMS.find(i => i.key === ddViewingKey);
        if (!item) return null;
        return (
          <DDEvidenceViewModal item={item} evidence={org.dd_evidence?.[ddViewingKey] ?? {}} documents={docsByItem[ddViewingKey] ?? []}
            canSeeSensitive={canSeeSensitive} canSeeDisclosureDetail={canSeeDisclosureDetail}
            onViewDocument={handleViewDocument} viewingDocId={viewingDocId} onClose={() => setDdViewingKey(null)} />
        );
      })()}

      {previewDoc && <DocumentPreviewModal preview={previewDoc} onClose={() => setPreviewDoc(null)} />}

      {/* No primary CTA here — Natives has no direct messaging today. Once
          decided, this is where a link to Partnership Listings, the
          Marketplace/initiatives, or a "Get matched" flow would go. */}
      {org.website && org.website !== "https://" && (
        <div className="px-8 py-4 border-t border-border bg-white dark:bg-card flex items-center justify-end shrink-0">
          <a href={org.website} target="_blank" rel="noopener noreferrer"
            className="bg-white dark:bg-card hover:bg-slate-50 dark:hover:bg-white/5 text-slate-800 font-medium text-sm py-2.5 px-5 rounded-xl transition flex items-center justify-center gap-2 border border-slate-300">
            <Globe className="w-4 h-4" /> Visit Website
          </a>
        </div>
      )}
    </>
  );
}

// ── Shared UI ─────────────────────────────────────────────────────────────────

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-5 h-5 text-[#2D6A4F] animate-spin" />
    </div>
  );
}

function EmptyState({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="rounded-2xl border border-border bg-white dark:bg-card p-12 text-center">
      <div className="flex justify-center mb-4">{icon}</div>
      <p className="text-foreground font-medium mb-2">{title}</p>
      <p className={`text-[15px] ${CHARCOAL} max-w-sm mx-auto`}>{subtitle}</p>
    </div>
  );
}