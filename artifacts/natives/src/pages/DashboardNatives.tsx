// ─── DashboardNatives.tsx ─────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { Loader2, Search, Users, Sparkles, RefreshCw } from "lucide-react";
import { UserAvatar, avatarColor, initials } from "@/components/ui/UserAvatar";
import { VerifiedBadge } from "@/components/ui/VerifiedBadge";
import { TrustBadge } from "@/components/ui/TrustBadge";
import { COUNTRIES } from "@/lib/countries";
import { SECTOR_OPTIONS } from "@/lib/sectors";
import { DD_ITEMS, FUNDER_DD_ITEMS, DDItemDef, DD_SENSITIVE_EVIDENCE_KEYS, DDDocument, PILLAR_INFO, computeTrustTier } from "@/lib/ddItems";
import { hasLiveRelationshipWith } from "@/lib/relationshipAccess";
import mammoth from "mammoth";
import { EsgSnapshotSection } from "@/components/dashboard/EsgSnapshotSection";

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

type Tab = "individual" | "organisation";

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
// ── Main ──────────────────────────────────────────────────────────────────────

export default function DashboardNatives() {
  const [tab, setTab] = useState<Tab>(() => {
    const params = new URLSearchParams(window.location.search);
    return (params.get("tab") as Tab) ?? "organisation";
  });
  const [search, setSearch] = useState("");
  const [sectorFilter, setSectorFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [orgTypeFilter, setOrgTypeFilter] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [autoOpenUserId, setAutoOpenUserId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("user");
  });
  const [detailOpen, setDetailOpen] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return !!params.get("user");
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const userId = params.get("user");
    if (!userId) return;
    supabase
      .from("profiles")
      .select("user_type")
      .eq("id", userId)
      .single()
      .then(({ data }) => {
        if (data?.user_type === "organisation") setTab("organisation");
      });
  }, []);

  return (
    <div className="space-y-6">
      {!detailOpen && (
        <>
          <div className="flex gap-1 p-1 rounded-xl bg-muted w-fit">
            {(["organisation", "individual"] as const).map(t => (
              <button key={t} type="button"
                onClick={() => { setTab(t); setSearch(""); }}
                className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                  tab === t
                    ? "text-white shadow-sm bg-gradient-to-br from-[#3D2618] via-[#33301F] to-[#1B3328]"
                    : "text-muted-foreground hover:text-foreground"
                }`}>
                {t === "individual" ? "Individuals" : "Organisations"}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input type="text"
                placeholder={tab === "individual" ? "Search people..." : "Search organisations..."}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="h-9 w-52 pl-9 pr-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors" />
            </div>

            <select value={sectorFilter} onChange={e => setSectorFilter(e.target.value)}
              className="h-9 px-2 rounded-lg border border-border bg-background text-sm text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-[#452A1D]/30 focus:border-[#452A1D]/50 transition-colors">
              <option value="">Sector</option>
              {SECTOR_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            <select value={countryFilter} onChange={e => setCountryFilter(e.target.value)}
              className="h-9 px-2 rounded-lg border border-border bg-background text-sm text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-[#452A1D]/30 focus:border-[#452A1D]/50 transition-colors">
              <option value="">Country</option>
              {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            {tab === "organisation" && (
              <select value={orgTypeFilter} onChange={e => setOrgTypeFilter(e.target.value)}
                className="h-9 px-2 rounded-lg border border-border bg-background text-sm text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-[#452A1D]/30 focus:border-[#452A1D]/50 transition-colors">
                <option value="">Type</option>
                <option value="ngo_non_profit">NGO / Non-Profit</option>
                <option value="social_enterprise">Social Enterprise</option>
                <option value="startup">Startup</option>
                <option value="technology_company">Technology Company</option>
                <option value="corporation">Corporation</option>
                <option value="philanthropic_foundation">Philanthropic Foundation</option>
                <option value="venture_capital">Venture Capital</option>
                <option value="public_sector">Public Sector</option>
                <option value="research_academic">Research & Academic</option>
              </select>
            )}

            {tab === "organisation" && (
              <button type="button"
                onClick={() => setVerifiedOnly(v => !v)}
                className={`h-9 px-3 rounded-lg border text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  verifiedOnly
                    ? "border-[#2D6A4F] bg-[#2D6A4F] text-white"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                Verified
              </button>
            )}

            {(sectorFilter || countryFilter || orgTypeFilter || verifiedOnly) && (
              <button type="button"
                onClick={() => { setSectorFilter(""); setCountryFilter(""); setOrgTypeFilter(""); setVerifiedOnly(false); }}
                className="h-9 px-3 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground transition-colors">
                ✕ Clear
              </button>
            )}
          </div>
        </>
      )}

      {tab === "individual"
        ? <IndividualsPanel search={search} sectorFilter={sectorFilter} countryFilter={countryFilter} autoOpenUserId={autoOpenUserId} onAutoOpened={() => setAutoOpenUserId(null)} onSelectionChange={setDetailOpen} />
        : <OrgsPanel search={search} sectorFilter={sectorFilter} countryFilter={countryFilter} orgTypeFilter={orgTypeFilter} verifiedOnly={verifiedOnly} autoOpenUserId={autoOpenUserId} onAutoOpened={() => setAutoOpenUserId(null)} onSelectionChange={setDetailOpen} />}
    </div>
  );
}

// ── Individuals Panel ─────────────────────────────────────────────────────────

function IndividualsPanel({ search, sectorFilter, countryFilter, autoOpenUserId, onAutoOpened, onSelectionChange }: {
  search: string;
  sectorFilter: string;
  countryFilter: string;
  autoOpenUserId?: string | null;
  onAutoOpened?: () => void;
  onSelectionChange?: (open: boolean) => void;
}) {
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState<ProfileRow | null>(null);

  useEffect(() => { onSelectionChange?.(!!selected); }, [selected]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("id,full_name,role_title,country,sectors,bio,avatar_url,linkedin_url,website,user_type,social_links,org_name,show_individual_profile")
        .not("full_name", "is", null)
        .or("user_type.eq.individual_creative,user_type.is.null,show_individual_profile.eq.true")
        .order("full_name", { ascending: true });
      if (error) console.error(error);
      const allRows: ProfileRow[] = data ?? [];

      // Team Members never appear as "Individuals" here -- once someone
      // represents an org (an active org_members row), their public
      // presence is through that org's own listing, not a personal one.
      // Prevents a Member unilaterally showing up "tagged with your
      // organisation" without the Owner's sign-off. org_members.user_id
      // has no FK to profiles (see TeamTab.tsx), so this is a separate
      // query, not something the .or() above can express.
      const individualIds = allRows
        .filter(p => p.user_type === "individual_creative" || !p.user_type)
        .map(p => p.id);
      let memberUserIds = new Set<string>();
      if (individualIds.length > 0) {
        const { data: memberships } = await supabase
          .from("org_members")
          .select("user_id")
          .in("user_id", individualIds)
          .eq("status", "active");
        memberUserIds = new Set((memberships ?? []).map((m: any) => m.user_id));
      }

      const rows = allRows.filter(p => !memberUserIds.has(p.id));
      setProfiles(rows);
      if (autoOpenUserId) {
        const match = rows.find(p => p.id === autoOpenUserId);
        if (match) { setSelected(match); onAutoOpened?.(); }
      }
      setLoading(false);
    }
    load();
  }, []);

  const filtered = profiles.filter(p => {
    if (sectorFilter && !p.sectors?.includes(sectorFilter)) return false;
    if (countryFilter && p.country !== countryFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.full_name?.toLowerCase().includes(q) ||
      p.role_title?.toLowerCase().includes(q) ||
      p.country?.toLowerCase().includes(q) ||
      p.bio?.toLowerCase().includes(q)
    );
  });

  if (loading) return <LoadingSpinner />;
  if (selected) return <ProfileDetail profile={selected} onBack={() => setSelected(null)} />;
  if (filtered.length === 0) return (
    <EmptyState
      icon={<Users className="w-8 h-8 text-muted-foreground/40" />}
      title={profiles.length === 0 ? "No profiles yet." : "No results."}
      subtitle={profiles.length === 0 ? "Profiles will appear here as people join." : "Try a different search term."} />
  );

  return (
    <div className="grid grid-cols-1 gap-4">
      {filtered.map(p => <ProfileCard key={p.id} profile={p} onClick={() => setSelected(p)} />)}
    </div>
  );
}

function ProfileCard({ profile, onClick }: { profile: ProfileRow; onClick: () => void }) {
  const sectors = profile.sectors ?? [];
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-4 bg-white dark:bg-card border border-border rounded-2xl p-5 cursor-pointer transition-all duration-200 hover:shadow-md">
      <UserAvatar id={profile.id} name={profile.full_name} avatarUrl={profile.avatar_url} size="md" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-base font-bold text-[#111111] dark:text-[#F5F5F5] truncate">{profile.full_name}</p>
          {profile.org_name && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: "#eaf5ee", color: "#2D6A4F" }}>
              {profile.org_name}
            </span>
          )}
        </div>
        {profile.role_title && <p className="text-sm text-[#111111] dark:text-[#F5F5F5] truncate">{profile.role_title}</p>}
        {profile.country && <p className="text-xs text-[#111111] dark:text-[#F5F5F5] mt-0.5">{profile.country}</p>}
        {profile.bio && <p className="text-sm text-[#111111] dark:text-[#F5F5F5] leading-relaxed line-clamp-2 mt-1">{firstSentence(profile.bio)}</p>}
        {sectors.length > 0 && (
          <div className="flex gap-1.5 flex-wrap mt-2">
            {sectors.slice(0, 3).map(s => (
              <span key={s} className="text-xs px-2.5 py-0.5 rounded-md border border-border text-[#111111] dark:text-[#F5F5F5]">{s}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ProfileDetail({ profile, onBack }: { profile: ProfileRow; onBack: () => void }) {
  const sectors = profile.sectors ?? [];
  const hasContact = !!(profile.linkedin_url || (profile.website && profile.website !== "https://") || (profile.social_links && profile.social_links.length > 0));

  return (
    <div className="space-y-6 w-full">
      <button type="button" onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-[#111111] dark:text-[#F5F5F5] hover:opacity-70 transition-opacity">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
          <path d="M19 12H5M12 5l-7 7 7 7" />
        </svg>
        Back
      </button>

      <div className="bg-white dark:bg-card w-[calc(100%+3rem)] -mx-6 divide-y-[6px] divide-[#FAF6F0] dark:divide-black">

        <div className="px-8 sm:px-12 py-10">
          <div className="flex items-start gap-5">
            <UserAvatar id={profile.id} name={profile.full_name} avatarUrl={profile.avatar_url} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="text-2xl sm:text-[32px] font-bold text-[#111111] dark:text-[#F5F5F5] tracking-tight">{profile.full_name}</h3>
                {profile.org_name && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: "#eaf5ee", color: "#2D6A4F" }}>
                    {profile.org_name}
                  </span>
                )}
              </div>
              {profile.role_title && <p className="text-sm text-[#111111] dark:text-[#F5F5F5] mt-2">{profile.role_title}</p>}
              {profile.country && <p className="text-sm text-[#111111] dark:text-[#F5F5F5] mt-1">{profile.country}</p>}
            </div>
          </div>
        </div>

        {(profile.bio || sectors.length > 0) && (
          <div className="px-8 sm:px-12 py-10">
            <p className="text-xl font-bold text-[#111111] dark:text-[#F5F5F5] mb-6">About</p>
            <div className="space-y-9">
              {profile.bio && (
                <p className="text-base text-[#111111] dark:text-[#F5F5F5] leading-relaxed">{profile.bio}</p>
              )}
              {sectors.length > 0 && (
                <div>
                  <p className="text-sm font-bold text-[#111111] dark:text-[#F5F5F5] mb-1.5">Sector</p>
                  <p className="text-sm text-[#111111] dark:text-[#F5F5F5]">{sectors.join(", ")}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {hasContact && (
          <div className="px-8 sm:px-12 py-10">
            <p className="text-xl font-bold text-[#111111] dark:text-[#F5F5F5] mb-6">Contact</p>
            <div className="space-y-3">
              {profile.linkedin_url && (
                <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-[#111111] dark:text-[#F5F5F5] hover:text-[#2D6A4F] transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/>
                    <rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/>
                  </svg>
                  LinkedIn
                </a>
              )}
              {profile.website && profile.website !== "https://" && (
                <a href={profile.website} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-[#2D6A4F] hover:underline">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1 4-10z"/>
                  </svg>
                  {profile.website.replace(/^https?:\/\//, "")}
                </a>
              )}
              {profile.social_links?.map((s, i) => (
                <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-[#111111] dark:text-[#F5F5F5] hover:text-[#2D6A4F] transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 shrink-0">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                  </svg>
                  {s.label}
                </a>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ── Orgs Panel ────────────────────────────────────────────────────────────────

function OrgsPanel({ search, sectorFilter, countryFilter, orgTypeFilter, verifiedOnly, autoOpenUserId, onAutoOpened, onSelectionChange }: {
  search: string;
  sectorFilter: string;
  countryFilter: string;
  orgTypeFilter: string;
  verifiedOnly: boolean;
  autoOpenUserId?: string | null;
  onAutoOpened?: () => void;
  onSelectionChange?: (open: boolean) => void;
}) {
  const [orgs, setOrgs]       = useState<OrgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [directLoading, setDirectLoading] = useState(!!autoOpenUserId);
  const [selected, setSelected] = useState<OrgRow | null>(null);

  useEffect(() => {
    // While the direct single-org fetch (below) is still in flight, the
    // parent's detailOpen is already correctly seeded true from the URL —
    // don't let this effect's initial "selected is still null" state
    // stomp it back to false and flash the tab pill before the fetch
    // resolves.
    if (directLoading) return;
    onSelectionChange?.(!!selected);
  }, [selected, directLoading]);

  // Deep link into a single org (e.g. clicking an org name elsewhere in
  // the app): fetch just that one row instead of waiting on the full
  // published-orgs directory load below, which pulls every org and every
  // DD field for the whole marketplace just to find one match.
  useEffect(() => {
    if (!autoOpenUserId) return;
    async function loadOne() {
      const [{ data: orgRow }, { data: profileRow }] = await Promise.all([
        supabase
          .from("organizations")
          .select("id,organisation_name,sector,country,organisation_type,website,verification_status,user_id,description,needs,offers,sdgs,year_founded,ai_partnership_summary,logo_url,dd_financial_model,dd_audited_accounts,dd_governance_doc,dd_esg_assessment,dd_impact_framework,dd_environmental_policy,dd_safeguarding_policy,dd_legal_registration,dd_legal_compliance_declaration,dd_evidence,fdd_disbursement_track_record,fdd_decision_transparency,fdd_conflict_disclosure,fdd_governance_doc,fdd_esg_framework,fdd_legal_registration,total_beneficiaries_reached,jobs_created,female_beneficiaries_pct,youth_beneficiaries_pct,years_of_operation,grants_received_count,grants_total_value_usd,grants_delivered_on_time_pct,previous_funders,third_party_evaluations,csr_focus_statement,employee_engagement_available,cobranding_open,inkind_support,tech_support_available,sandbox_ready,sandbox_description,esg_frameworks,csr_budget_range,partnership_listed,partnership_title,partnership_sought,partnership_stage,partnership_budget,partnership_decision_timeline,partnership_funding_status,investment_thesis,stage_preference,geographic_focus,impact_strategy,flagged_visibility_hold")
          .eq("user_id", autoOpenUserId)
          .eq("status", "published")
          .single(),
        supabase.from("profiles").select("full_name").eq("id", autoOpenUserId).single(),
      ]);
      if (orgRow) {
        setSelected({ ...orgRow, contact_name: profileRow?.full_name } as OrgRow);
        onAutoOpened?.();
      }
      setDirectLoading(false);
    }
    loadOne();
  }, [autoOpenUserId]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: orgData, error } = await supabase
        .from("organizations")
        .select("id,organisation_name,sector,country,organisation_type,website,verification_status,user_id,description,needs,offers,sdgs,year_founded,ai_partnership_summary,logo_url,dd_financial_model,dd_audited_accounts,dd_governance_doc,dd_esg_assessment,dd_impact_framework,dd_environmental_policy,dd_safeguarding_policy,dd_legal_registration,dd_legal_compliance_declaration,dd_evidence,fdd_disbursement_track_record,fdd_decision_transparency,fdd_conflict_disclosure,fdd_governance_doc,fdd_esg_framework,fdd_legal_registration,total_beneficiaries_reached,jobs_created,female_beneficiaries_pct,youth_beneficiaries_pct,years_of_operation,grants_received_count,grants_total_value_usd,grants_delivered_on_time_pct,previous_funders,third_party_evaluations,csr_focus_statement,employee_engagement_available,cobranding_open,inkind_support,tech_support_available,sandbox_ready,sandbox_description,esg_frameworks,csr_budget_range,partnership_listed,partnership_title,partnership_sought,partnership_stage,partnership_budget,partnership_decision_timeline,partnership_funding_status,investment_thesis,stage_preference,geographic_focus,impact_strategy,flagged_visibility_hold")        
        .eq("status", "published")
        .order("organisation_name", { ascending: true });

      if (error) { console.error(error); setLoading(false); return; }
      if (!orgData || orgData.length === 0) { setLoading(false); return; }

      const userIds = [...new Set(orgData.map(o => o.user_id).filter(Boolean))];
      const { data: profileData } = await supabase
        .from("profiles").select("id,full_name").in("id", userIds);
      const profileMap = new Map((profileData ?? []).map(p => [p.id, p]));

      const enriched: OrgRow[] = orgData.map(o => ({
        ...o,
        contact_name: profileMap.get(o.user_id)?.full_name,      }));

      setOrgs(enriched);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = orgs.filter(o => {
    const sectors   = normalizeArr(o.sector);
    const countries = normalizeArr(o.country);
    if (sectorFilter && !sectors.includes(sectorFilter)) return false;
    if (countryFilter && !countries.includes(countryFilter)) return false;
    if (orgTypeFilter && o.organisation_type !== orgTypeFilter) return false;
    if (verifiedOnly && o.verification_status !== "verified") return false;
    // Serious-severity flagged orgs are withheld from the public directory
    // until resolved — set via admin's Flagged Orgs review, not automatic.
    if (o.flagged_visibility_hold) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      o.organisation_name?.toLowerCase().includes(q) ||
      sectors.some(s => s.toLowerCase().includes(q)) ||
      countries.some(c => c.toLowerCase().includes(q)) ||
      o.description?.toLowerCase().includes(q)
    );
  });

  if (directLoading) return <LoadingSpinner />;
  if (selected) return <NativesOrgDetail org={selected} onBack={() => setSelected(null)} />;
  if (loading) return <LoadingSpinner />;
  if (filtered.length === 0) return (
    <EmptyState
      icon={<Users className="w-8 h-8 text-muted-foreground/40" />}
      title={orgs.length === 0 ? "No organisations yet." : "No results."}
      subtitle={orgs.length === 0 ? "Published organisations will appear here." : "Try a different search term."} />
  );

  // Verified orgs first
  const sorted = [...filtered].sort((a, b) => {
    const aV = a.verification_status === "verified" ? 0 : 1;
    const bV = b.verification_status === "verified" ? 0 : 1;
    return aV - bV;
  });

  return (
    <div className="grid grid-cols-1 gap-4">
      {sorted.map(o => <NativesOrgCard key={o.id} org={o} onClick={() => setSelected(o)} />)}
    </div>
  );
}

// ── Org Card ──────────────────────────────────────────────────────────────────

function NativesOrgCard({ org, onClick }: { org: OrgRow; onClick: () => void }) {
  const isVerified = org.verification_status === "verified";
  const sectors    = normalizeArr(org.sector);
  const countries  = normalizeArr(org.country);

  return (
    <div onClick={onClick} className="cursor-pointer">

      {/* Mobile: compact row, same pattern as the individual card */}
      <div className="sm:hidden flex items-center gap-4 bg-white dark:bg-card border border-border rounded-2xl p-5 transition-all duration-200 hover:shadow-md">
        <div className="w-14 h-14 rounded-full shrink-0 flex items-center justify-center overflow-hidden bg-white dark:bg-card">
          {org.logo_url ? (
            <img src={org.logo_url} alt={org.organisation_name} className="w-full h-full object-contain p-1.5" />
          ) : (
            <span className="text-[#6B7280] dark:text-[#D1D5DB] text-base font-bold">{initials(org.organisation_name || "?")}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-base font-bold text-[#111111] dark:text-[#F5F5F5] truncate">{org.organisation_name}</p>
            {isVerified && <VerifiedBadge />}
          </div>
          {org.organisation_type && (
            <p className="text-sm text-[#111111] dark:text-[#F5F5F5] capitalize truncate">{org.organisation_type.replace(/_/g, " ")}</p>
          )}
          {countries.length > 0 && <p className="text-xs text-[#111111] dark:text-[#F5F5F5] mt-0.5">{countries.join(", ")}</p>}
        </div>
      </div>

      {/* Desktop / tablet: full card with large logo panel */}
      <div className="hidden sm:flex bg-white dark:bg-card border border-border rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-md">
        <div className="w-56 shrink-0 flex items-center justify-center overflow-hidden bg-white dark:bg-card">
          {org.logo_url ? (
            <img src={org.logo_url} alt={org.organisation_name} className="max-w-[55%] max-h-[55%] object-contain" />
          ) : (
            <div className="w-24 h-24 rounded-full bg-[#F3F4F6] dark:bg-white/10 flex items-center justify-center">
              <span className="text-[#6B7280] dark:text-[#D1D5DB] text-2xl font-bold">{initials(org.organisation_name || "?")}</span>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 p-7 flex flex-col gap-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xl font-bold text-[#111111] dark:text-[#F5F5F5] truncate">{org.organisation_name}</p>
            {isVerified && <VerifiedBadge />}
          </div>
          {org.organisation_type && (
            <p className="text-sm text-[#111111] dark:text-[#F5F5F5] capitalize">{org.organisation_type.replace(/_/g, " ")}</p>
          )}
          {org.description && (
            <p className="text-sm text-[#111111] dark:text-[#F5F5F5] leading-relaxed line-clamp-3">{firstSentence(org.description)}</p>
          )}
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-[#111111] dark:text-[#F5F5F5]">
            {sectors.length > 0 && (
              <p><span className="font-semibold">Sector: </span>{sectors.slice(0, 2).join(", ")}{sectors.length > 2 ? ` +${sectors.length - 2}` : ""}</p>
            )}
            {countries.length > 0 && (
              <p><span className="font-semibold">Location: </span>{countries.join(", ")}</p>
            )}
          </div>
          {(org.needs?.length || org.offers?.length) ? (
            <div className="flex flex-wrap gap-2 pt-1">
              {org.needs?.slice(0, 2).map(n => (
                <span key={n} className="text-xs font-medium px-2.5 py-1 rounded-md" style={{ color: "#993C1D", background: "#FAECE7" }}>{n}</span>
              ))}
              {org.offers?.slice(0, 1).map(o => (
                <span key={o} className="text-xs font-medium px-2.5 py-1 rounded-md" style={{ color: "#0F6E56", background: "#E1F5EE" }}>{o}</span>
              ))}
            </div>
          ) : null}
        </div>
      </div>

    </div>
  );
}

// ── DD evidence viewer (read-only, for visitors to another org's profile) ──

function DDEvidenceViewModal({ item, evidence, documents, canSeeSensitive, canSeeDisclosureDetail, onClose }: {
  item: DDItemDef; evidence: Record<string, any>; documents: DDDocument[]; canSeeSensitive: boolean; canSeeDisclosureDetail: boolean; onClose: () => void;
}) {
  const [openingDocId, setOpeningDocId] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; fileName: string } | null>(null);
  const [docxHtml, setDocxHtml] = useState<string | null>(null);
  const [docxLoading, setDocxLoading] = useState(false);
  const [docxError, setDocxError] = useState(false);

  useEffect(() => {
    if (!preview) { setDocxHtml(null); return; }
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
  }, [preview]);

  async function handleView(doc: DDDocument) {
    setOpeningDocId(doc.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-dd-document-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}` },
        body: JSON.stringify({ documentId: doc.id }),
      });
      const result = await res.json();
      if (result.url) setPreview({ url: result.url, fileName: doc.file_name });
      else alert("Couldn't open document.");
    } catch {
      alert("Couldn't open document.");
    }
    setOpeningDocId(null);
  }

  if (preview) {
    const ext = preview.fileName.split(".").pop()?.toLowerCase() ?? "";
    const isImage = ["png", "jpg", "jpeg", "webp", "gif"].includes(ext);
    const isPdf = ext === "pdf";
    const isDocx = ext === "docx";
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setPreview(null)}>
        <div className="bg-white dark:bg-card rounded-2xl border border-border w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border shrink-0">
            <button type="button" onClick={() => setPreview(null)}
              className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                <path d="M19 12H5M12 5l-7 7 7 7" />
              </svg>
              Back
            </button>
            <p className="text-sm font-medium text-foreground truncate flex-1 text-center">{preview.fileName}</p>
            <a href={preview.url} download={preview.fileName}
              className="text-sm text-[#2D6A4F] hover:underline underline-offset-2 shrink-0">
              Download
            </a>
          </div>
          <div className="flex-1 overflow-auto bg-muted/20 flex items-start justify-center min-h-[50vh]">
            {isImage ? (
              <img src={preview.url} alt={preview.fileName} className="max-w-full max-h-[85vh] object-contain" />
            ) : isPdf ? (
              <iframe src={preview.url} title={preview.fileName} className="w-full h-[75vh] border-0" />
            ) : isDocx ? (
              docxLoading ? (
                <div className="p-8 flex items-center gap-2 text-sm text-black dark:text-white">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading preview...
                </div>
              ) : docxError || !docxHtml ? (
                <div className="p-8 text-center space-y-2">
                  <p className="text-sm text-black dark:text-white">Couldn't render a preview for this file.</p>
                  <a href={preview.url} download={preview.fileName}
                    className="text-sm text-[#2D6A4F] hover:underline underline-offset-2 font-medium">
                    Download {preview.fileName}
                  </a>
                </div>
              ) : (
                <div className="w-full h-full overflow-auto bg-white p-6 sm:p-10">
                  <div
                    className="max-w-2xl mx-auto text-sm text-neutral-900 leading-relaxed [&_p]:mb-3 [&_h1]:text-xl [&_h1]:font-bold [&_h2]:text-lg [&_h2]:font-bold [&_table]:border-collapse [&_td]:border [&_td]:border-neutral-300 [&_td]:px-2 [&_td]:py-1"
                    dangerouslySetInnerHTML={{ __html: docxHtml }}
                  />
                </div>
              )
            ) : (
              <div className="p-8 text-center space-y-2">
                <p className="text-sm text-black dark:text-white">Preview isn't available for this file type.</p>
                <a href={preview.url} download={preview.fileName}
                  className="text-sm text-[#2D6A4F] hover:underline underline-offset-2 font-medium">
                  Download {preview.fileName}
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-card rounded-2xl border border-border w-full max-w-sm p-6 space-y-3" onClick={e => e.stopPropagation()}>
        <div>
          <h3 className="text-lg font-bold text-foreground">{item.label}</h3>
          <p className="text-sm text-black dark:text-white mt-0.5">{item.sub}</p>
        </div>
        <div className="space-y-3">
          {item.questions.map(q => {
            const isSensitive = DD_SENSITIVE_EVIDENCE_KEYS.has(q.key);
            if (isSensitive && !canSeeSensitive) {
              return (
                <div key={q.key}>
                  <p className="text-xs font-semibold uppercase tracking-wider text-black dark:text-white">{q.label}</p>
                  <p className="text-sm text-black dark:text-white italic mt-0.5">Visible once you're in an active conversation</p>
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
            // Disclosure detail (blacklisting/pending-dispute text) is gated to
            // funder/corporate viewers + self-view, same rule as the inline
            // summary on the profile overview — deliberately independent of
            // canSeeSensitive/DD_SENSITIVE_EVIDENCE_KEYS, which governs a
            // different field (registrationNumber) under a different rule
            // (active-conversation gating) that this must not disturb.
            const isDisclosureDetailKey = q.key === "hasBlacklisting" || q.key === "hasPendingDisputes";
            const withholdDisclosureDetail = isDisclosureDetailKey && !canSeeDisclosureDetail;
            return (
              <div key={q.key}>
                <p className="text-xs font-semibold uppercase tracking-wider text-black dark:text-white">{q.label}</p>
                <p className="text-sm text-foreground mt-0.5">{display}</p>
                {followUp && !withholdDisclosureDetail && (
                  <p className="text-sm text-black dark:text-white mt-1 italic">{followUp}</p>
                )}
              </div>
            );
          })}
        </div>
        {documents.length > 0 && (
          <div className="pt-3 border-t border-border space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-black dark:text-white">Supporting documents</p>
            {documents.map(doc => (
              <button key={doc.id} type="button" onClick={() => handleView(doc)} disabled={openingDocId === doc.id}
                className="w-full flex items-center justify-between gap-2 text-left text-sm text-foreground hover:underline underline-offset-2 disabled:opacity-50">
                <span className="truncate">{doc.file_name}</span>
                {openingDocId === doc.id && <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />}
              </button>
            ))}
          </div>
        )}
        <button type="button" onClick={onClose}
          className="w-full h-9 rounded-full border border-border text-sm text-muted-foreground hover:text-foreground transition-colors">
          Close
        </button>
      </div>
    </div>
  );
}

function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="relative inline-flex group shrink-0">
      <span className="w-3.5 h-3.5 rounded-full border border-muted-foreground/50 text-foreground text-[9px] leading-[13px] font-bold inline-flex items-center justify-center cursor-default"
        aria-label="What does this mean?">
        i
      </span>
      <span className="pointer-events-none absolute left-0 bottom-full mb-1.5 w-56 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-foreground opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-md">
        {text}
      </span>
    </span>
  );
}

// ── Org Detail ────────────────────────────────────────────────────────────────

function NativesOrgDetail({ org, onBack }: { org: OrgRow; onBack: () => void }) {
  const { user, profile } = useAuth();
  const isVerified = org.verification_status === "verified";
  // Disclosure detail (blacklisting/dispute text) is gated by the VIEWER's own
  // track, not the org being viewed — funders/corporates get the explanation,
  // everyone else sees the badge only. The org always sees its own detail.
  const viewerIsFunder = ["philanthropic_foundation", "venture_capital"].includes(profile?.org_type ?? "");
  const viewerIsCorporate = ["corporation", "technology_company", "public_sector"].includes(profile?.org_type ?? "");
  const isOwnProfile = !!user?.id && user.id === org.user_id;
  const canSeeDisclosureDetail = isOwnProfile || viewerIsFunder || viewerIsCorporate;
  const legalEvidence = org.dd_evidence?.legal_compliance_declaration ?? {};
  const sectors    = normalizeArr(org.sector);
  const countries  = normalizeArr(org.country);
  const color      = avatarColor(org.id);

  const [aiSummary, setAiSummary]         = useState<string | null>(org.ai_partnership_summary ?? null);
  const [loadingAi, setLoadingAi]         = useState(false);
  const [aiError, setAiError]             = useState(false);
  const [ddViewingKey, setDdViewingKey]   = useState<string | null>(null);
  const [canSeeSensitive, setCanSeeSensitive] = useState(false);
  const [docsByItem, setDocsByItem]       = useState<Record<string, DDDocument[]>>({});
  const [deliveryStats, setDeliveryStats] = useState<{ completed: number; stalled: number; fell_through: number; resolved: number; total: number } | null>(null);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [org.id]);

  useEffect(() => {
    if (!user || user.id === org.user_id) { setCanSeeSensitive(true); return; }
    supabase.from("organizations").select("id").eq("user_id", user.id).maybeSingle()
      .then(({ data: myOrg }) => {
        hasLiveRelationshipWith({
          viewerUserId: user.id,
          viewerOrgId: myOrg?.id ?? null,
          targetUserId: org.user_id,
          targetOrgId: org.id,
        }).then(setCanSeeSensitive);
      });
  }, [user, org.user_id, org.id]);

  useEffect(() => {
    supabase.from("dd_evidence_documents")
      .select("id,organization_id,dd_item_key,file_path,file_name,visibility,created_at")
      .eq("organization_id", org.id)
      .then(({ data }) => {
        const grouped: Record<string, DDDocument[]> = {};
        (data ?? []).forEach((doc: DDDocument) => {
          grouped[doc.dd_item_key] = [...(grouped[doc.dd_item_key] ?? []), doc];
        });
        setDocsByItem(grouped);
      });
  }, [org.id]);

  async function generateSummary() {
    if (!org.description && !org.needs?.length && !org.offers?.length) return;
    setLoadingAi(true);
    setAiError(false);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-partnership-summary`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organisation_name: org.organisation_name,
            description:       org.description,
            sectors:           normalizeArr(org.sector),
            needs:             org.needs,
            offers:            org.offers,
            sdgs:              org.sdgs,
            organisation_type: org.organisation_type,
            country:           normalizeArr(org.country)[0] ?? null,
          }),
        }
      );
      const result = await res.json();
      if (result.summary) {
        setAiSummary(result.summary);
        await supabase.from("organizations").update({ ai_partnership_summary: result.summary }).eq("id", org.id);
      } else {
        setAiError(true);
      }
    } catch {
      setAiError(true);
    }
    setLoadingAi(false);
  }

  useEffect(() => {
    if (aiSummary) return;
    generateSummary();
  }, [org.id]);

  const [orgInitiatives, setOrgInitiatives] = useState<any[]>([]);
  const [orgPartnership, setOrgPartnership] = useState<any | null>(null);
  const [reputationPartners, setReputationPartners] = useState<any[]>([]);

  useEffect(() => {
    supabase.from("initiative_requests")
      .select("id,title,sectors,locations,budget,eois,status,co_funding_status,specific_ask")
      .eq("user_id", org.user_id)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(3)
      .then(({ data }) => setOrgInitiatives(data ?? []));

    if (org.partnership_listed) {
      setOrgPartnership({
        title: org.partnership_title,
        sought: org.partnership_sought,
        stage: org.partnership_stage,
        budget: org.partnership_budget,
        timeline: org.partnership_decision_timeline,
        funding_status: org.partnership_funding_status,
      });
    }

    supabase.from("initiative_requests")
      .select("id,title,user_id,confirmed_partners")
      .not("confirmed_partners", "eq", "[]")
      .then(({ data }) => {
        if (!data) return;
        const results: any[] = [];
        data.forEach((ini: any) => {
          const partners = ((ini.confirmed_partners ?? []) as any[]).filter((p: any) => (p.status ?? "confirmed") === "confirmed");
          if (ini.user_id === org.user_id) {
            partners.forEach((p: any) => {
              results.push({ initiative_title: ini.title, partner_name: p.name, role: p.role, as: "owner" });
            });
          } else {
            const asPartner = partners.find((p: any) => p.user_id === org.user_id);
            if (asPartner) {
              results.push({ initiative_title: ini.title, partner_name: null, role: asPartner.role, as: "partner" });
            }
          }
        });
        setReputationPartners(results);
      });
  }, [org.id]);

  useEffect(() => {
    supabase.rpc("get_org_delivery_stats", { target_org_id: org.id })
      .then(({ data }) => { if (data?.[0]) setDeliveryStats(data[0]); });
  }, [org.id]);

  

  const ddItemsArr = [org.dd_financial_model, org.dd_audited_accounts, org.dd_governance_doc, org.dd_esg_assessment, org.dd_impact_framework, org.dd_environmental_policy, org.dd_safeguarding_policy, org.dd_legal_registration, org.dd_legal_compliance_declaration];
  const ddScore = Math.round((ddItemsArr.filter(Boolean).length / ddItemsArr.length) * 100);
  const ddStateMap: Record<string, boolean | undefined> = {
    financial_model: org.dd_financial_model,
    audited_accounts: org.dd_audited_accounts,
    governance_doc: org.dd_governance_doc,
    esg_assessment: org.dd_esg_assessment,
    impact_framework: org.dd_impact_framework,
    environmental_policy: org.dd_environmental_policy,
    safeguarding_policy: org.dd_safeguarding_policy,
    legal_registration: org.dd_legal_registration,
    legal_compliance_declaration: org.dd_legal_compliance_declaration,
  };

  const fddItemsArr = [org.fdd_disbursement_track_record, org.fdd_decision_transparency, org.fdd_conflict_disclosure, org.fdd_governance_doc, org.fdd_esg_framework, org.fdd_legal_registration];
  const fddScore = Math.round((fddItemsArr.filter(Boolean).length / fddItemsArr.length) * 100);
  const fddStateMap: Record<string, boolean | undefined> = {
    disbursement_track_record: org.fdd_disbursement_track_record,
    decision_transparency: org.fdd_decision_transparency,
    conflict_disclosure: org.fdd_conflict_disclosure,
    governance_doc: org.fdd_governance_doc,
    esg_framework: org.fdd_esg_framework,
    legal_registration: org.fdd_legal_registration,
  };

  const hasTrackRecord = !!(org.total_beneficiaries_reached || org.jobs_created || org.grants_received_count || org.years_of_operation);
  const hasDelivery = !!(deliveryStats && deliveryStats.resolved >= 1);
  const deliveryRate = hasDelivery ? Math.round((deliveryStats!.completed / deliveryStats!.resolved) * 100) : null;
  const deliveryInProgress = deliveryStats ? deliveryStats.total - deliveryStats.resolved : 0;

  const isImplementerOrg = !["philanthropic_foundation", "venture_capital", "corporation", "technology_company", "public_sector"].includes(org.organisation_type ?? "");
  const showCsrEsg = ["corporation", "technology_company"].includes(org.organisation_type ?? "") &&
    !!(org.csr_focus_statement || org.inkind_support?.length || org.esg_frameworks?.length || org.tech_support_available?.length);

  let impactPillars: any[] = [];
  if (org.impact_strategy) {
    try { impactPillars = JSON.parse(org.impact_strategy)?.pillars ?? []; } catch {}
  }

  return (
    <div className="space-y-6 w-full">
      <button type="button" onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-[#111111] dark:text-[#F5F5F5] hover:opacity-70 transition-opacity">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
          <path d="M19 12H5M12 5l-7 7 7 7" />
        </svg>
        Back
      </button>

      <div className="bg-white dark:bg-card w-[calc(100%+3rem)] -mx-6 divide-y-[6px] divide-[#FAF6F0] dark:divide-black">

        <div className="px-8 sm:px-12 py-10">
          <div className="flex items-start gap-5">
            <div className="w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-full flex items-center justify-center shrink-0 overflow-hidden border border-border"
              style={{ background: org.logo_url ? "transparent" : color }}>
              {org.logo_url ? (
                <img src={org.logo_url} alt={org.organisation_name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-white text-xl font-bold">{initials(org.organisation_name || "?")}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="text-2xl sm:text-[32px] font-bold text-[#111111] dark:text-[#F5F5F5] tracking-tight">{org.organisation_name}</h3>
                {isVerified && <VerifiedBadge withTooltip />}
              </div>
              <p className="text-sm text-[#111111] dark:text-[#F5F5F5] mt-2">
                {org.organisation_type && <span className="capitalize">{org.organisation_type.replace(/_/g, " ")}</span>}
                {org.organisation_type && countries.length > 0 && " · "}
                {countries.join(", ")}
                {org.year_founded && ` · Est. ${org.year_founded}`}
              </p>
              {org.website && org.website !== "https://" && (
                <a href={org.website} target="_blank" rel="noopener noreferrer"
                  className="text-sm text-[#2D6A4F] hover:underline mt-1 inline-block">
                  {org.website.replace(/^https?:\/\//, "")}
                </a>
              )}
            </div>
          </div>
        </div>

        {(aiSummary || loadingAi) && (
          <div className="px-8 sm:px-12 py-10">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[#2D6A4F]" />
                <p className="text-xl font-bold text-[#111111] dark:text-[#F5F5F5]">Partnership fit</p>
              </div>
              {!loadingAi && (
                <button type="button" onClick={() => { setAiSummary(null); generateSummary(); }}
                  className="p-1 rounded hover:opacity-70 transition-opacity" title="Refresh partnership fit">
                  <RefreshCw className="w-3.5 h-3.5 text-[#111111] dark:text-[#F5F5F5]" />
                </button>
              )}
            </div>
            {loadingAi ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 text-[#2D6A4F] animate-spin shrink-0" />
                <p className="text-sm text-[#111111] dark:text-[#F5F5F5]">Generating partnership summary...</p>
              </div>
            ) : (
              <p className="text-base text-[#111111] dark:text-[#F5F5F5] leading-relaxed">{aiSummary}</p>
            )}
          </div>
        )}

        <div className="px-8 sm:px-12 py-10">
          <p className="text-xl font-bold text-[#111111] dark:text-[#F5F5F5] mb-6">About</p>

          <div className="space-y-9">
            {org.description && (
              <p className="text-base text-[#111111] dark:text-[#F5F5F5] leading-relaxed">{org.description}</p>
            )}

            {ddScore > 0 && (
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-bold text-[#111111] dark:text-[#F5F5F5]">DD readiness</p>
                  <InfoTooltip text={PILLAR_INFO.ddReadiness} />
                  <TrustBadge tier={computeTrustTier(ddScore, org.dd_evidence).tier} withTooltip />
                  <span className="text-sm font-bold text-[#111111] dark:text-[#F5F5F5] ml-auto">{ddScore}%</span>
                </div>
                <div className="h-[3px] bg-muted rounded-full mt-2.5">
                  <div className="h-full rounded-full bg-[#2D6A4F] transition-all duration-500" style={{ width: `${ddScore}%` }} />
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {DD_ITEMS.map(item => {
                    const done = ddStateMap[item.key];
                    const hasEvidence = done && org.dd_evidence?.[item.key];
                    return (
                      <button key={item.key} type="button"
                        disabled={!hasEvidence}
                        onClick={() => hasEvidence && setDdViewingKey(item.key)}
                        className="text-[11px] px-2.5 py-1 rounded-md border transition-colors"
                        style={{
                          borderColor: done ? "#2D6A4F40" : "#E5E7EB",
                          color: done ? "#2D6A4F" : "#9ca3af",
                          background: done ? "#eaf5ee" : "transparent",
                          cursor: hasEvidence ? "pointer" : "default",
                        }}>
                        {done ? "✓" : "·"} {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {fddScore > 0 && (
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-bold text-[#111111] dark:text-[#F5F5F5]">DD readiness</p>
                  <InfoTooltip text={PILLAR_INFO.ddReadiness} />
                  <TrustBadge tier={computeTrustTier(fddScore, org.dd_evidence).tier} withTooltip />
                  <span className="text-sm font-bold text-[#111111] dark:text-[#F5F5F5] ml-auto">{fddScore}%</span>
                </div>
                <div className="h-[3px] bg-muted rounded-full mt-2.5">
                  <div className="h-full rounded-full bg-[#2D6A4F] transition-all duration-500" style={{ width: `${fddScore}%` }} />
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {FUNDER_DD_ITEMS.map(item => {
                    const done = fddStateMap[item.key];
                    const hasEvidence = done && org.dd_evidence?.[item.key];
                    return (
                      <button key={item.key} type="button"
                        disabled={!hasEvidence}
                        onClick={() => hasEvidence && setDdViewingKey(item.key)}
                        className="text-[11px] px-2.5 py-1 rounded-md border transition-colors"
                        style={{
                          borderColor: done ? "#2D6A4F40" : "#E5E7EB",
                          color: done ? "#2D6A4F" : "#9ca3af",
                          background: done ? "#eaf5ee" : "transparent",
                          cursor: hasEvidence ? "pointer" : "default",
                        }}>
                        {done ? "✓" : "·"} {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {hasTrackRecord && (
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-bold text-[#111111] dark:text-[#F5F5F5]">Track record</p>
                  <InfoTooltip text={PILLAR_INFO.trackRecord} />
                </div>
                <p className="text-xs text-[#111111] dark:text-[#F5F5F5] mt-1 mb-3">Self-reported reach and history</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
                  {org.total_beneficiaries_reached && (
                    <div>
                      <p className="text-xs text-[#111111] dark:text-[#F5F5F5] mb-0.5">Beneficiaries reached</p>
                      <p className="text-sm font-semibold text-[#111111] dark:text-[#F5F5F5]">{org.total_beneficiaries_reached.toLocaleString()}</p>
                    </div>
                  )}
                  {org.jobs_created && (
                    <div>
                      <p className="text-xs text-[#111111] dark:text-[#F5F5F5] mb-0.5">Jobs created</p>
                      <p className="text-sm font-semibold text-[#111111] dark:text-[#F5F5F5]">{org.jobs_created.toLocaleString()}</p>
                    </div>
                  )}
                  {org.years_of_operation && (
                    <div>
                      <p className="text-xs text-[#111111] dark:text-[#F5F5F5] mb-0.5">Years operating</p>
                      <p className="text-sm font-semibold text-[#111111] dark:text-[#F5F5F5]">{org.years_of_operation}</p>
                    </div>
                  )}
                  {org.female_beneficiaries_pct && (
                    <div>
                      <p className="text-xs text-[#111111] dark:text-[#F5F5F5] mb-0.5">Female beneficiaries</p>
                      <p className="text-sm font-semibold text-[#111111] dark:text-[#F5F5F5]">{org.female_beneficiaries_pct}%</p>
                    </div>
                  )}
                  {org.youth_beneficiaries_pct && (
                    <div>
                      <p className="text-xs text-[#111111] dark:text-[#F5F5F5] mb-0.5">Youth beneficiaries</p>
                      <p className="text-sm font-semibold text-[#111111] dark:text-[#F5F5F5]">{org.youth_beneficiaries_pct}%</p>
                    </div>
                  )}
                  {org.grants_received_count && (
                    <div>
                      <p className="text-xs text-[#111111] dark:text-[#F5F5F5] mb-0.5">Grants received</p>
                      <p className="text-sm font-semibold text-[#111111] dark:text-[#F5F5F5]">{org.grants_received_count}</p>
                    </div>
                  )}
                  {org.grants_total_value_usd && (
                    <div>
                      <p className="text-xs text-[#111111] dark:text-[#F5F5F5] mb-0.5">Total grant value</p>
                      <p className="text-sm font-semibold text-[#111111] dark:text-[#F5F5F5]">${org.grants_total_value_usd.toLocaleString()}</p>
                    </div>
                  )}
                  {org.grants_delivered_on_time_pct && (
                    <div>
                      <p className="text-xs text-[#111111] dark:text-[#F5F5F5] mb-0.5">Delivered on time</p>
                      <p className="text-sm font-semibold text-[#111111] dark:text-[#F5F5F5]">{org.grants_delivered_on_time_pct}%</p>
                    </div>
                  )}
                </div>
                {org.previous_funders && org.previous_funders.length > 0 && (
                  <p className="text-sm text-[#111111] dark:text-[#F5F5F5] mt-4"><span className="font-semibold">Previous funders: </span>{org.previous_funders.join(", ")}</p>
                )}
                {org.third_party_evaluations && (
                  <div className="flex items-center gap-1.5 text-sm text-[#2D6A4F] mt-3">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    Third-party evaluations available
                  </div>
                )}
              </div>
            )}

            {sectors.length > 0 && (
              <div>
                <p className="text-sm font-bold text-[#111111] dark:text-[#F5F5F5] mb-1.5">Sector</p>
                <p className="text-sm text-[#111111] dark:text-[#F5F5F5]">{sectors.join(", ")}</p>
              </div>
            )}

            {countries.length > 0 && (
              <div>
                <p className="text-sm font-bold text-[#111111] dark:text-[#F5F5F5] mb-1.5">Location</p>
                <p className="text-sm text-[#111111] dark:text-[#F5F5F5]">{countries.join(", ")}</p>
              </div>
            )}

            {((org.needs && org.needs.length > 0) || (org.offers && org.offers.length > 0)) && (
              <div>
                <p className="text-sm font-bold text-[#111111] dark:text-[#F5F5F5] mb-2">Seeking and offers</p>
                <div className="flex flex-wrap gap-2">
                  {org.needs?.map(n => (
                    <span key={n} className="text-sm font-medium px-3 py-1 rounded-md" style={{ color: "#993C1D", background: "#FAECE7" }}>{n}</span>
                  ))}
                  {org.offers?.map(o => (
                    <span key={o} className="text-sm font-medium px-3 py-1 rounded-md" style={{ color: "#0F6E56", background: "#E1F5EE" }}>{o}</span>
                  ))}
                </div>
              </div>
            )}

            {org.stage_preference && org.stage_preference.length > 0 && (
              <div>
                <p className="text-sm font-bold text-[#111111] dark:text-[#F5F5F5] mb-1.5">Stage preference</p>
                <p className="text-sm text-[#111111] dark:text-[#F5F5F5]">{org.stage_preference.join(", ")}</p>
              </div>
            )}

            {org.geographic_focus && org.geographic_focus.length > 0 && (
              <div>
                <p className="text-sm font-bold text-[#111111] dark:text-[#F5F5F5] mb-1.5">Geographic focus</p>
                <p className="text-sm text-[#111111] dark:text-[#F5F5F5]">{org.geographic_focus.join(", ")}</p>
              </div>
            )}

            {org.investment_thesis && (
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Sparkles className="w-3 h-3 text-[#2D6A4F]" />
                  <p className="text-sm font-bold text-[#111111] dark:text-[#F5F5F5]">Investment thesis</p>
                </div>
                <p className="text-base text-[#111111] dark:text-[#F5F5F5] leading-relaxed">{org.investment_thesis}</p>
              </div>
            )}

            {showCsrEsg && (
              <>
                {org.csr_focus_statement && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Sparkles className="w-3 h-3 text-[#C45C26]" />
                      <p className="text-sm font-bold text-[#111111] dark:text-[#F5F5F5]">CSR and ESG focus</p>
                    </div>
                    <p className="text-base text-[#111111] dark:text-[#F5F5F5] leading-relaxed">{org.csr_focus_statement}</p>
                  </div>
                )}
                {org.csr_budget_range && (
                  <div>
                    <p className="text-sm font-bold text-[#111111] dark:text-[#F5F5F5] mb-1.5">CSR budget</p>
                    <p className="text-sm text-[#111111] dark:text-[#F5F5F5]">{org.csr_budget_range}</p>
                  </div>
                )}
                {org.inkind_support && org.inkind_support.length > 0 && (
                  <div>
                    <p className="text-sm font-bold text-[#111111] dark:text-[#F5F5F5] mb-2">What we bring</p>
                    <div className="flex flex-wrap gap-2">
                      {org.inkind_support.map(s => (
                        <span key={s} className="text-sm text-[#111111] dark:text-[#F5F5F5] border border-border px-3 py-1 rounded-md">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
                {org.esg_frameworks && org.esg_frameworks.length > 0 && (
                  <div>
                    <p className="text-sm font-bold text-[#111111] dark:text-[#F5F5F5] mb-2">ESG frameworks</p>
                    <div className="flex flex-wrap gap-2">
                      {org.esg_frameworks.map(f => (
                        <span key={f} className="text-sm text-[#111111] dark:text-[#F5F5F5] border border-border px-3 py-1 rounded-md">{f}</span>
                      ))}
                    </div>
                  </div>
                )}
                {(org.employee_engagement_available || org.cobranding_open) && (
                  <div>
                    <p className="text-sm font-bold text-[#111111] dark:text-[#F5F5F5] mb-1.5">Partnership preferences</p>
                    <p className="text-sm text-[#111111] dark:text-[#F5F5F5]">
                      {[org.employee_engagement_available ? "Open to employee engagement" : null, org.cobranding_open ? "Open to co-branding" : null].filter(Boolean).join(", ")}
                    </p>
                  </div>
                )}
                {org.tech_support_available && org.tech_support_available.length > 0 && (
                  <div>
                    <p className="text-sm font-bold text-[#111111] dark:text-[#F5F5F5] mb-2">Technology support available</p>
                    <div className="flex flex-wrap gap-2">
                      {org.tech_support_available.map(t => (
                        <span key={t} className="text-sm text-[#111111] dark:text-[#F5F5F5] border border-border px-3 py-1 rounded-md">{t}</span>
                      ))}
                    </div>
                  </div>
                )}
                {org.sandbox_ready && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Sparkles className="w-3 h-3 text-[#2D6A4F]" />
                      <p className="text-sm font-bold text-[#111111] dark:text-[#F5F5F5]">Open to sandbox or beta testing</p>
                    </div>
                    {org.sandbox_description && <p className="text-base text-[#111111] dark:text-[#F5F5F5] leading-relaxed">{org.sandbox_description}</p>}
                  </div>
                )}
              </>
            )}

            {org.sdgs && org.sdgs.length > 0 && (
              <div>
                <p className="text-sm font-bold text-[#111111] dark:text-[#F5F5F5] mb-2">SDG alignment</p>
                <div className="flex flex-wrap gap-2">
                  {org.sdgs.map(s => (
                    <span key={s} className="text-sm font-medium px-3 py-1 rounded-md" style={{ background: "#2D6A4F", color: "white" }}>
                      {sdgLabel(s)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {ddViewingKey && (() => {
          const item = DD_ITEMS.find(i => i.key === ddViewingKey) ?? FUNDER_DD_ITEMS.find(i => i.key === ddViewingKey);
          if (!item) return null;
          return (
            <DDEvidenceViewModal
              item={item}
              evidence={org.dd_evidence?.[ddViewingKey] ?? {}}
              documents={docsByItem[ddViewingKey] ?? []}
              canSeeSensitive={canSeeSensitive}
              canSeeDisclosureDetail={canSeeDisclosureDetail}
              onClose={() => setDdViewingKey(null)}
            />
          );
        })()}

        {deliveryStats && (
          <div className="px-8 sm:px-12 py-10">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <p className="text-xl font-bold text-[#111111] dark:text-[#F5F5F5]">Delivery</p>
                <InfoTooltip text={PILLAR_INFO.delivery} />
              </div>
              {hasDelivery && <p className="text-xl font-bold text-[#111111] dark:text-[#F5F5F5]">{deliveryRate}%</p>}
            </div>
            <p className="text-xs text-[#111111] dark:text-[#F5F5F5] mb-3">From outcomes tracked on this platform</p>
            {hasDelivery ? (
              <>
              <div className="flex gap-1">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className={`h-2 flex-1 rounded-sm ${i < Math.round((deliveryRate ?? 0) / 10) ? "bg-[#2D6A4F]" : "bg-muted"}`} />
                ))}
              </div>
              <p className="text-sm text-[#111111] dark:text-[#F5F5F5] mt-3">
                  {deliveryStats.completed} of {deliveryStats.resolved} relationship{deliveryStats.resolved !== 1 ? "s" : ""} completed
                  {[
                    deliveryStats.stalled > 0 ? `${deliveryStats.stalled} stalled` : null,
                    deliveryStats.fell_through > 0 ? `${deliveryStats.fell_through} fell through` : null,
                    deliveryInProgress > 0 ? `${deliveryInProgress} still in progress` : null,
                  ].filter(Boolean).length > 0
                    ? ` (${[
                        deliveryStats.stalled > 0 ? `${deliveryStats.stalled} stalled` : null,
                        deliveryStats.fell_through > 0 ? `${deliveryStats.fell_through} fell through` : null,
                        deliveryInProgress > 0 ? `${deliveryInProgress} still in progress` : null,
                      ].filter(Boolean).join(", ")})`
                    : ""}
                </p>
              </>
            ) : (
              <p className="text-sm text-[#111111] dark:text-[#F5F5F5]">
                {deliveryStats.total === 0
                  ? "No tracked delivery history yet."
                  : `${deliveryStats.total} active relationship${deliveryStats.total !== 1 ? "s" : ""}, no completed outcomes yet.`}
              </p>
            )}
          </div>
        )}

        {isImplementerOrg && <EsgSnapshotSection org={org} />}

        {orgPartnership?.title && (
          <div className="px-8 sm:px-12 py-10">
            <p className="text-xl font-bold text-[#111111] dark:text-[#F5F5F5] mb-6">Partnership listing</p>
            <p className="text-base font-semibold text-[#111111] dark:text-[#F5F5F5] leading-snug">{orgPartnership.title}</p>
            {orgPartnership.sought && <p className="text-sm text-[#111111] dark:text-[#F5F5F5] leading-relaxed mt-2">{orgPartnership.sought}</p>}
            <p className="text-sm text-[#111111] dark:text-[#F5F5F5] mt-3">
              {[
                orgPartnership.stage?.replace(/_/g, " "),
                orgPartnership.funding_status?.replace(/_/g, " "),
                orgPartnership.budget?.replace(/_/g, "–"),
              ].filter(Boolean).join(" · ")}
            </p>
          </div>
        )}

        {orgInitiatives.length > 0 && (
          <div className="px-8 sm:px-12 py-10">
            <p className="text-xl font-bold text-[#111111] dark:text-[#F5F5F5] mb-6">Active initiatives</p>
            <div className="space-y-5">
              {orgInitiatives.map(ini => (
                <div key={ini.id} className="pb-5 border-b border-border last:border-0 last:pb-0 space-y-1.5">
                  <p className="text-base font-semibold text-[#111111] dark:text-[#F5F5F5] leading-snug">{ini.title}</p>
                  <p className="text-sm text-[#111111] dark:text-[#F5F5F5]">
                    {[ini.locations?.slice(0,2).join(", "), ini.budget].filter(Boolean).join(" · ")}
                    {ini.eois ? ` · ${ini.eois} EOI${ini.eois !== 1 ? "s" : ""}` : ""}
                  </p>
                  {ini.sectors?.length > 0 && <p className="text-sm text-[#111111] dark:text-[#F5F5F5]">{ini.sectors.slice(0,2).join(", ")}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {impactPillars.length > 0 && (
          <div className="px-8 sm:px-12 py-10">
            <div className="flex items-center gap-1.5 mb-6">
              <Sparkles className="w-4 h-4 text-[#2D6A4F]" />
              <p className="text-xl font-bold text-[#111111] dark:text-[#F5F5F5]">Impact strategy</p>
            </div>
            <div className="space-y-5">
              {impactPillars.map((pillar: any, i: number) => {
                const publishedRow = orgInitiatives.find(ini => ini.title === pillar.pillar_name);
                const specificAsk = publishedRow?.specific_ask ?? pillar.specific_ask_draft;
                return (
                  <div key={i} className="pb-5 border-b border-border last:border-0 last:pb-0 space-y-1.5">
                    <p className="text-base font-semibold text-[#111111] dark:text-[#F5F5F5] leading-snug">{pillar.pillar_name}</p>
                    {specificAsk && <p className="text-sm text-[#111111] dark:text-[#F5F5F5] leading-relaxed">{specificAsk}</p>}
                    {pillar.un_sdg_code && <p className="text-xs text-[#111111] dark:text-[#F5F5F5]">{pillar.un_sdg_code}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {reputationPartners.length > 0 && (
          <div className="px-8 sm:px-12 py-10">
            <p className="text-xl font-bold text-[#111111] dark:text-[#F5F5F5] mb-6">Confirmed partnerships</p>
            <div className="space-y-2">
              {reputationPartners.slice(0, 5).map((p, i) => (
                <p key={i} className="text-sm text-[#111111] dark:text-[#F5F5F5]">
                  {p.as === "owner"
                    ? `Partnered with ${p.partner_name} as ${partnerRolePhrase(p.role)} on "${p.initiative_title}"`
                    : `Confirmed as ${partnerRolePhrase(p.role)} on "${p.initiative_title}"`}
                </p>
              ))}
            </div>
          </div>
        )}

        {orgInitiatives.length === 0 && !orgPartnership?.title && (
          <div className="px-8 sm:px-12 py-10">
            <p className="text-sm text-[#111111] dark:text-[#F5F5F5]">No active initiatives or partnership listing yet.</p>
          </div>
        )}

        {org.contact_name && (
          <div className="px-8 sm:px-12 py-10">
            <p className="text-xl font-bold text-[#111111] dark:text-[#F5F5F5] mb-6">Contact</p>
            <p className="text-sm text-[#111111] dark:text-[#F5F5F5]">{org.contact_name}</p>
          </div>
        )}

      </div>
    </div>
  );
}

// ── Verified Badge with optional tooltip ──────────────────────────────────────



// ── Shared UI ─────────────────────────────────────────────────────────────────

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-5 h-5 text-[#2D6A4F] animate-spin" />
    </div>
  );
}

function EmptyState({ icon, title, subtitle }: {
  icon: React.ReactNode; title: string; subtitle: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-white dark:bg-card p-12 text-center">
      <div className="flex justify-center mb-4">{icon}</div>
      <p className="text-foreground font-medium mb-2">{title}</p>
      <p className="text-sm text-black dark:text-white max-w-sm mx-auto">{subtitle}</p>
    </div>
  );
}