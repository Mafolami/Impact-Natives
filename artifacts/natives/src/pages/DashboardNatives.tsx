// ─── DashboardNatives.tsx ─────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Loader2, Search, Users, Sparkles, RefreshCw } from "lucide-react";
import { UserAvatar, avatarColor, initials } from "@/components/ui/UserAvatar";
import { VerifiedBadge } from "@/components/ui/VerifiedBadge";
import { COUNTRIES } from "@/lib/countries";

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
  description?: string;
  investment_thesis?: string | null;
  stage_preference?: string[] | null;
  geographic_focus?: string[] | null;
  dd_financial_model?: boolean;
  dd_audited_accounts?: boolean;
  dd_governance_doc?: boolean;
  dd_esg_assessment?: boolean;
  dd_impact_framework?: boolean;
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

// ── Main ──────────────────────────────────────────────────────────────────────

export default function DashboardNatives() {
  const [tab, setTab] = useState<Tab>(() => {
    const params = new URLSearchParams(window.location.search);
    return (params.get("tab") as Tab) ?? "individual";
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
      <div>
        <p className="text-sm text-muted-foreground mt-1">
          Browse individuals and organisations in the ecosystem.
        </p>
      </div>

      <div className="flex gap-1 p-1 rounded-lg bg-muted w-fit">
        {(["individual", "organisation"] as const).map(t => (
          <button key={t} type="button"
            onClick={() => { setTab(t); setSearch(""); }}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === t
                ? "bg-background text-foreground shadow-sm"
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
          className="h-9 px-2 rounded-lg border border-border bg-background text-sm text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20">
          <option value="">Sector</option>
          {[
            "Health","Education","Agriculture & Food Systems","Climate & Environment",
            "Energy & Clean Tech","Water Sanitation & Hygiene","Financial Inclusion",
            "Gender & Inclusion","Governance & Civic Tech","Livelihoods & Economic Empowerment",
            "Technology & Innovation","Arts Culture & Creative Industries",
            "Humanitarian & Emergency Response","Youth & Community Development",
          ].map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <select value={countryFilter} onChange={e => setCountryFilter(e.target.value)}
          className="h-9 px-2 rounded-lg border border-border bg-background text-sm text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20">
          <option value="">Country</option>
          {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        {tab === "organisation" && (
          <select value={orgTypeFilter} onChange={e => setOrgTypeFilter(e.target.value)}
            className="h-9 px-2 rounded-lg border border-border bg-background text-sm text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20">
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

      {tab === "individual"
        ? <IndividualsPanel search={search} sectorFilter={sectorFilter} countryFilter={countryFilter} autoOpenUserId={autoOpenUserId} onAutoOpened={() => setAutoOpenUserId(null)} />
        : <OrgsPanel search={search} sectorFilter={sectorFilter} countryFilter={countryFilter} orgTypeFilter={orgTypeFilter} verifiedOnly={verifiedOnly} autoOpenUserId={autoOpenUserId} onAutoOpened={() => setAutoOpenUserId(null)} />}
    </div>
  );
}

// ── Individuals Panel ─────────────────────────────────────────────────────────

function IndividualsPanel({ search, sectorFilter, countryFilter, autoOpenUserId, onAutoOpened }: {
  search: string;
  sectorFilter: string;
  countryFilter: string;
  autoOpenUserId?: string | null;
  onAutoOpened?: () => void;
}) {
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState<ProfileRow | null>(null);

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
      const rows = data ?? [];
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
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {filtered.map(p => <ProfileCard key={p.id} profile={p} onClick={() => setSelected(p)} />)}
    </div>
  );
}

function ProfileCard({ profile, onClick }: { profile: ProfileRow; onClick: () => void }) {
  const sectors = profile.sectors ?? [];
  return (
    <div
      onClick={onClick}
      className="rounded-xl border border-border bg-card px-5 py-4 flex flex-col gap-3 cursor-pointer hover:border-[#2D6A4F]/40 transition-colors">
      <div className="flex items-start gap-3">
        <UserAvatar id={profile.id} name={profile.full_name} avatarUrl={profile.avatar_url} size="md" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground truncate">{profile.full_name}</p>
          {profile.role_title && <p className="text-xs text-muted-foreground truncate">{profile.role_title}</p>}
          {profile.user_type === "organisation" && profile.org_name && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1"
              style={{ background: "#eaf5ee", color: "#2D6A4F" }}>
              {profile.org_name}
            </span>
          )}        </div>
      </div>
      {profile.country && <p className="text-xs text-muted-foreground">{profile.country}</p>}
      {profile.bio && <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">{profile.bio}</p>}
      {sectors.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {sectors.slice(0, 3).map(s => (
            <span key={s} className="text-xs px-2.5 py-0.5 rounded-full border border-border text-muted-foreground">{s}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function ProfileDetail({ profile, onBack }: { profile: ProfileRow; onBack: () => void }) {
  const sectors = profile.sectors ?? [];
  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-5 max-w-2xl">
      <button type="button" onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
          <path d="M19 12H5M12 5l-7 7 7 7" />
        </svg>
        Back
      </button>
      <div className="flex items-start gap-4">
        <UserAvatar id={profile.id} name={profile.full_name} avatarUrl={profile.avatar_url} size="lg" />
        <div className="min-w-0">
          <h3 className="text-xl font-bold text-foreground">{profile.full_name}</h3>
          {profile.role_title && <p className="text-sm text-muted-foreground">{profile.role_title}</p>}
          {profile.user_type === "organisation" && profile.org_name && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full mt-1.5"
              style={{ background: "#eaf5ee", color: "#2D6A4F" }}>
              {profile.org_name}
            </span>
          )}          {profile.country   && <p className="text-xs text-muted-foreground mt-1">{profile.country}</p>}
        </div>
      </div>
      {sectors.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {sectors.map(s => (
            <span key={s} className="text-xs px-2.5 py-1 rounded-full border border-border text-muted-foreground">{s}</span>
          ))}
        </div>
      )}
      {profile.bio && <p className="text-sm text-muted-foreground leading-relaxed">{profile.bio}</p>}
      <div className="pt-3 border-t border-border space-y-2">
        <p className="text-sm font-medium text-foreground mb-2">Contact</p>
        {profile.linkedin_url && (
          <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
              <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/>
              <rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/>
            </svg>
            LinkedIn
          </a>
        )}
        {profile.website && (
          <a href={profile.website} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-primary hover:underline">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
              <circle cx="12" cy="12" r="10"/>
              <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
            {profile.website.replace(/^https?:\/\//, "")}
          </a>
        )}
        {profile.social_links && profile.social_links.length > 0 && (
          <div className="pt-1 space-y-1.5">
            {profile.social_links.map((s, i) => (
              <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5 shrink-0">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                </svg>
                {s.label}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Orgs Panel ────────────────────────────────────────────────────────────────

function OrgsPanel({ search, sectorFilter, countryFilter, orgTypeFilter, verifiedOnly, autoOpenUserId, onAutoOpened }: {
  search: string;
  sectorFilter: string;
  countryFilter: string;
  orgTypeFilter: string;
  verifiedOnly: boolean;
  autoOpenUserId?: string | null;
  onAutoOpened?: () => void;
}) {
  const [orgs, setOrgs]       = useState<OrgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<OrgRow | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: orgData, error } = await supabase
        .from("organizations")
        .select("id,organisation_name,sector,country,organisation_type,website,verification_status,user_id,description,needs,offers,sdgs,year_founded,ai_partnership_summary,logo_url,dd_financial_model,dd_audited_accounts,dd_governance_doc,dd_esg_assessment,dd_impact_framework,total_beneficiaries_reached,jobs_created,female_beneficiaries_pct,youth_beneficiaries_pct,years_of_operation,grants_received_count,grants_total_value_usd,grants_delivered_on_time_pct,previous_funders,third_party_evaluations,csr_focus_statement,employee_engagement_available,cobranding_open,inkind_support,tech_support_available,sandbox_ready,sandbox_description,esg_frameworks,csr_budget_range,partnership_listed,partnership_title,partnership_sought,partnership_stage,partnership_budget,partnership_decision_timeline,partnership_funding_status,investment_thesis,stage_preference,geographic_focus,impact_strategy")        .eq("status", "published")
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

      if (autoOpenUserId) {
        const match = enriched.find(o => o.user_id === autoOpenUserId);
        if (match) { setSelected(match); onAutoOpened?.(); }
      }
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
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      o.organisation_name?.toLowerCase().includes(q) ||
      sectors.some(s => s.toLowerCase().includes(q)) ||
      countries.some(c => c.toLowerCase().includes(q)) ||
      o.description?.toLowerCase().includes(q)
    );
  });

  if (loading) return <LoadingSpinner />;
  if (selected) return <NativesOrgDetail org={selected} onBack={() => setSelected(null)} />;
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
    <div className="grid gap-3 sm:grid-cols-2">
      {sorted.map(o => <NativesOrgCard key={o.id} org={o} onClick={() => setSelected(o)} />)}
    </div>
  );
}

// ── Org Card ──────────────────────────────────────────────────────────────────

function NativesOrgCard({ org, onClick }: { org: OrgRow; onClick: () => void }) {
  const isVerified = org.verification_status === "verified";
  const sectors    = normalizeArr(org.sector);
  const countries  = normalizeArr(org.country);
  const color      = avatarColor(org.id);

  return (
    <div
      onClick={onClick}
      className={`rounded-xl border bg-card px-5 py-4 flex flex-col gap-3 cursor-pointer transition-all ${
        isVerified
          ? "border-l-4 border-l-[#2D6A4F] border-t-border border-r-border border-b-border hover:shadow-sm"
          : "border-border hover:border-[#2D6A4F]/40"
      }`}>
      <div className="flex items-start gap-3">
      <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 overflow-hidden border border-border"
          style={{ background: org.logo_url ? "transparent" : color }}>
          {org.logo_url ? (
            <img src={org.logo_url} alt={org.organisation_name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-white text-sm font-bold">{initials(org.organisation_name || "?")}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-foreground truncate">{org.organisation_name}</p>
            {isVerified && <VerifiedBadge />}
          </div>
          {org.organisation_type && (
            <p className="text-xs text-muted-foreground mt-0.5 capitalize">
              {org.organisation_type.replace(/_/g, " ")}
            </p>
          )}
        </div>
      </div>

      {org.description && (
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{org.description}</p>
      )}

      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
        {sectors.length > 0   && <p><span className="font-medium text-foreground">Sector: </span>{sectors.slice(0, 2).join(", ")}{sectors.length > 2 ? ` +${sectors.length - 2}` : ""}</p>}
        {countries.length > 0 && <p><span className="font-medium text-foreground">Location: </span>{countries.join(", ")}</p>}
        {org.website && org.website !== "https://" && (
          <a href={org.website} target="_blank" rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="text-primary hover:underline truncate">
            {org.website.replace(/^https?:\/\//, "")}
          </a>
        )}
      </div>

      {/* Needs/offers preview */}
      {(org.needs?.length || org.offers?.length) ? (
        <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border">
          {org.needs?.slice(0, 2).map(n => (
            <span key={n} className="text-[10px] px-2 py-0.5 rounded-full"
              style={{ background: "#f5ede8", color: "#C45C26" }}>{n}</span>
          ))}
          {org.offers?.slice(0, 1).map(o => (
            <span key={o} className="text-[10px] px-2 py-0.5 rounded-full"
              style={{ background: "#eaf5ee", color: "#2D6A4F" }}>{o}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ── Org Detail ────────────────────────────────────────────────────────────────

function NativesOrgDetail({ org, onBack }: { org: OrgRow; onBack: () => void }) {
  const isVerified = org.verification_status === "verified";
  const sectors    = normalizeArr(org.sector);
  const countries  = normalizeArr(org.country);
  const color      = avatarColor(org.id);

  const [aiSummary, setAiSummary]         = useState<string | null>(org.ai_partnership_summary ?? null);
  const [loadingAi, setLoadingAi]         = useState(false);
  const [aiError, setAiError]             = useState(false);

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

  // Generate and cache AI partnership summary on first view
  useEffect(() => {
    if (aiSummary) return;
    generateSummary();
  }, [org.id]);

  const [orgInitiatives, setOrgInitiatives] = useState<any[]>([]);
  const [orgPartnership, setOrgPartnership] = useState<any | null>(null);

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
  }, [org.id]);

  return (
    <div className="space-y-4">
      {/* Back */}
      <button type="button" onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
          <path d="M19 12H5M12 5l-7 7 7 7" />
        </svg>
        Back
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">
      {/* Left col -- identity */}
      <div className="lg:col-span-3 rounded-2xl border border-border bg-card p-6 space-y-6">

      {/* Header */}
      <div className="flex items-start gap-4">
      <div className="w-14 h-14 rounded-full flex items-center justify-center shrink-0 overflow-hidden border border-border"
          style={{ background: org.logo_url ? "transparent" : color }}>
          {org.logo_url ? (
            <img src={org.logo_url} alt={org.organisation_name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-white text-lg font-bold">{initials(org.organisation_name || "?")}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-xl font-bold text-foreground">{org.organisation_name}</h3>
            {isVerified && <VerifiedBadge withTooltip />}
          </div>
          {org.organisation_type && (
            <p className="text-sm text-muted-foreground mt-0.5 capitalize">
              {org.organisation_type.replace(/_/g, " ")}
            </p>
          )}
          {org.year_founded && (
            <p className="text-xs text-muted-foreground mt-0.5">Est. {org.year_founded}</p>
          )}
          {org.website && org.website !== "https://" && (
            <a href={org.website} target="_blank" rel="noopener noreferrer"
              className="text-xs text-[#2D6A4F] hover:underline mt-0.5 inline-block">
              {org.website.replace(/^https?:\/\//, "")}
            </a>
          )}
        </div>
      </div>

      {/* AI Partnership Summary */}
      {(aiSummary || loadingAi) && (
        <div className="rounded-xl border border-[#2D6A4F]/20 bg-[#2D6A4F]/5 px-4 py-3">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#2D6A4F]" />
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#2D6A4F]">
                Partnership fit
              </p>
            </div>
            {!loadingAi && (
              <button type="button" onClick={() => { setAiSummary(null); generateSummary(); }}
                className="p-1 rounded hover:bg-[#2D6A4F]/10 transition-colors"
                title="Refresh partnership fit">
                <RefreshCw className="w-3 h-3 text-[#2D6A4F]" />
              </button>
            )}
          </div>
          {loadingAi ? (
            <div className="flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 text-[#2D6A4F] animate-spin shrink-0" />
              <p className="text-xs text-muted-foreground">Generating partnership summary...</p>
            </div>
          ) : (
            <p className="text-sm text-foreground leading-relaxed">{aiSummary}</p>
          )}
        </div>
      )}

      {/* Description */}
      {org.description && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">About</p>
          <p className="text-sm text-foreground leading-relaxed">{org.description}</p>
        </div>
      )}

      {(() => {
        const ddItems = [org.dd_financial_model, org.dd_audited_accounts, org.dd_governance_doc, org.dd_esg_assessment, org.dd_impact_framework];
        const ddScore = Math.round((ddItems.filter(Boolean).length / 5) * 100);
        if (ddScore === 0) return null;
        return (
          <div className="rounded-xl border border-border bg-card px-4 py-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">DD Readiness</p>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{
                  background: ddScore >= 80 ? "#eaf5ee" : ddScore >= 50 ? "#fffbeb" : "#f5f5f5",
                  color: ddScore >= 80 ? "#2D6A4F" : ddScore >= 50 ? "#f59e0b" : "#6b7280",
                }}>
                {ddScore}%
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${ddScore}%`,
                  background: ddScore >= 80 ? "#2D6A4F" : ddScore >= 50 ? "#f59e0b" : "#9ca3af",
                }} />
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {[
                { label: "Financial model", done: org.dd_financial_model },
                { label: "Audited accounts", done: org.dd_audited_accounts },
                { label: "Governance docs", done: org.dd_governance_doc },
                { label: "ESG assessment", done: org.dd_esg_assessment },
                { label: "Impact framework", done: org.dd_impact_framework },
              ].map(item => (
                <span key={item.label} className="text-[10px] px-2 py-0.5 rounded-full border"
                  style={{
                    borderColor: item.done ? "#2D6A4F40" : "#e5e7eb",
                    color: item.done ? "#2D6A4F" : "#9ca3af",
                    background: item.done ? "#eaf5ee" : "transparent",
                  }}>
                  {item.done ? "✓" : "·"} {item.label}
                </span>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Impact & Track Record */}
      {(org.total_beneficiaries_reached || org.jobs_created || org.grants_received_count || org.years_of_operation) && (
        <div className="rounded-xl border border-border bg-card px-4 py-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Impact & track record</p>
          <div className="grid grid-cols-2 gap-3">
            {org.total_beneficiaries_reached && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Beneficiaries reached</p>
                <p className="text-sm font-semibold text-foreground">{org.total_beneficiaries_reached.toLocaleString()}</p>
              </div>
            )}
            {org.jobs_created && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Jobs created</p>
                <p className="text-sm font-semibold text-foreground">{org.jobs_created.toLocaleString()}</p>
              </div>
            )}
            {org.female_beneficiaries_pct && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Female beneficiaries</p>
                <p className="text-sm font-semibold text-foreground">{org.female_beneficiaries_pct}%</p>
              </div>
            )}
            {org.youth_beneficiaries_pct && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Youth beneficiaries</p>
                <p className="text-sm font-semibold text-foreground">{org.youth_beneficiaries_pct}%</p>
              </div>
            )}
            {org.years_of_operation && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Years operating</p>
                <p className="text-sm font-semibold text-foreground">{org.years_of_operation}</p>
              </div>
            )}
            {org.grants_received_count && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Grants received</p>
                <p className="text-sm font-semibold text-foreground">{org.grants_received_count}</p>
              </div>
            )}
            {org.grants_total_value_usd && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Total grant value</p>
                <p className="text-sm font-semibold text-foreground">${org.grants_total_value_usd.toLocaleString()}</p>
              </div>
            )}
            {org.grants_delivered_on_time_pct && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Delivered on time</p>
                <p className="text-sm font-semibold text-foreground">{org.grants_delivered_on_time_pct}%</p>
              </div>
            )}
          </div>
          {org.previous_funders && org.previous_funders.length > 0 && (
            <div className="pt-2 border-t border-border">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1.5">Previous funders</p>
              <div className="flex flex-wrap gap-1.5">
                {org.previous_funders.map(f => (
                  <span key={f} className="text-xs px-2.5 py-0.5 rounded-full border border-border text-muted-foreground">{f}</span>
                ))}
              </div>
            </div>
          )}
          {org.third_party_evaluations && (
            <div className="flex items-center gap-1.5 text-xs text-[#2D6A4F] pt-1 border-t border-border">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Third-party evaluations available
            </div>
          )}
        </div>
      )}

      {(sectors.length > 0 || countries.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {sectors.length > 0 && (
            <div className="rounded-xl px-4 py-3.5"
              style={{ background: "linear-gradient(135deg, rgba(196,92,38,0.05) 0%, transparent 100%)", border: "1px solid rgba(196,92,38,0.14)" }}>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] mb-2" style={{ color: "#C45C26" }}>Sector</p>
              <div className="flex flex-wrap gap-1.5">
                {sectors.map(s => (
                  <span key={s} className="text-xs font-medium px-2.5 py-1 rounded-full"
                    style={{ background: "rgba(196,92,38,0.08)", color: "#C45C26" }}>
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
          {countries.length > 0 && (
            <div className="rounded-xl px-4 py-3.5"
              style={{ background: "linear-gradient(135deg, rgba(45,106,79,0.05) 0%, transparent 100%)", border: "1px solid rgba(45,106,79,0.14)" }}>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] mb-2" style={{ color: "#2D6A4F" }}>Location</p>
              <div className="flex flex-wrap gap-1.5">
                {countries.map(c => (
                  <span key={c} className="text-xs font-medium px-2.5 py-1 rounded-full"
                    style={{ background: "rgba(45,106,79,0.08)", color: "#2D6A4F" }}>
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {org.investment_thesis && (
        <div className="relative rounded-2xl overflow-hidden"
          style={{
            background: "linear-gradient(135deg, rgba(45,106,79,0.08) 0%, rgba(45,106,79,0.02) 100%)",
            border: "1px solid rgba(45,106,79,0.18)",
            backdropFilter: "blur(8px)",
          }}>
          <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-40"
            style={{ background: "radial-gradient(circle at top left, rgba(45,106,79,0.12), transparent 60%)" }} />
          <div className="relative px-5 py-4">
            <div className="flex items-center gap-1.5 mb-2.5">
              <Sparkles className="w-3 h-3 text-[#2D6A4F]" />
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#2D6A4F]">Investment thesis</p>
            </div>
            <p className="text-sm text-foreground leading-relaxed">{org.investment_thesis}</p>
          </div>
        </div>
      )}

      {(org.stage_preference?.length || org.geographic_focus?.length) ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {org.stage_preference && org.stage_preference.length > 0 && (
            <div className="rounded-xl px-4 py-3.5"
              style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.015) 0%, transparent 100%)", border: "1px solid rgba(0,0,0,0.06)" }}>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground mb-2.5">Stage preference</p>
              <div className="flex flex-wrap gap-1.5">
                {org.stage_preference.map(s => (
                  <span key={s} className="text-xs font-medium px-2.5 py-1 rounded-full"
                    style={{ background: "rgba(45,106,79,0.06)", color: "#2D6A4F", border: "1px solid rgba(45,106,79,0.15)" }}>
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
          {org.geographic_focus && org.geographic_focus.length > 0 && (
            <div className="rounded-xl px-4 py-3.5"
              style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.015) 0%, transparent 100%)", border: "1px solid rgba(0,0,0,0.06)" }}>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground mb-2.5">Geographic focus</p>
              <div className="flex flex-wrap gap-1.5">
                {org.geographic_focus.map(g => (
                  <span key={g} className="text-xs font-medium px-2.5 py-1 rounded-full"
                    style={{ background: "rgba(196,92,38,0.06)", color: "#C45C26", border: "1px solid rgba(196,92,38,0.15)" }}>
                    {g}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* CSR & ESG — corporates and tech companies */}
      {["corporation", "technology_company"].includes(org.organisation_type ?? "") && (
        org.csr_focus_statement || org.inkind_support?.length || org.esg_frameworks?.length || org.tech_support_available?.length
      ) && (
        <div className="space-y-3">
          {org.csr_focus_statement && (
            <div className="relative rounded-2xl overflow-hidden"
              style={{
                background: "linear-gradient(135deg, rgba(196,92,38,0.08) 0%, rgba(196,92,38,0.02) 100%)",
                border: "1px solid rgba(196,92,38,0.18)",
              }}>
              <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-40"
                style={{ background: "radial-gradient(circle at top left, rgba(196,92,38,0.12), transparent 60%)" }} />
              <div className="relative px-5 py-4">
                <div className="flex items-center gap-1.5 mb-2.5">
                  <Sparkles className="w-3 h-3 text-[#C45C26]" />
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#C45C26]">CSR & ESG focus</p>
                </div>
                <p className="text-sm text-foreground leading-relaxed">{org.csr_focus_statement}</p>
              </div>
            </div>
          )}

          {org.csr_budget_range && (
            <div className="rounded-xl px-4 py-3.5 flex items-center justify-between"
              style={{ background: "linear-gradient(135deg, rgba(196,92,38,0.04) 0%, transparent 100%)", border: "1px solid rgba(196,92,38,0.12)" }}>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: "#C45C26" }}>CSR Budget</p>
              <p className="text-sm font-bold text-foreground">{org.csr_budget_range}</p>
            </div>
          )}

          {(org.inkind_support?.length || org.esg_frameworks?.length) ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {org.inkind_support && org.inkind_support.length > 0 && (
                <div className="rounded-xl px-4 py-3.5"
                  style={{ background: "linear-gradient(135deg, rgba(196,92,38,0.05) 0%, transparent 100%)", border: "1px solid rgba(196,92,38,0.14)" }}>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] mb-2.5" style={{ color: "#C45C26" }}>What we bring</p>
                  <div className="flex flex-wrap gap-1.5">
                    {org.inkind_support.map(s => (
                      <span key={s} className="text-xs font-medium px-2.5 py-1 rounded-full"
                        style={{ background: "rgba(196,92,38,0.08)", color: "#C45C26" }}>{s}</span>
                    ))}
                  </div>
                </div>
              )}
              {org.esg_frameworks && org.esg_frameworks.length > 0 && (
                <div className="rounded-xl px-4 py-3.5"
                  style={{ background: "linear-gradient(135deg, rgba(45,106,79,0.05) 0%, transparent 100%)", border: "1px solid rgba(45,106,79,0.14)" }}>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] mb-2.5" style={{ color: "#2D6A4F" }}>ESG frameworks</p>
                  <div className="flex flex-wrap gap-1.5">
                    {org.esg_frameworks.map(f => (
                      <span key={f} className="text-xs font-medium px-2.5 py-1 rounded-full"
                        style={{ background: "rgba(45,106,79,0.08)", color: "#2D6A4F" }}>{f}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {(org.employee_engagement_available || org.cobranding_open) && (
            <div className="rounded-xl px-4 py-3.5"
              style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.015) 0%, transparent 100%)", border: "1px solid rgba(0,0,0,0.06)" }}>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground mb-2.5">Partnership preferences</p>
              <div className="flex flex-wrap gap-1.5">
                {org.employee_engagement_available && (
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full"
                    style={{ background: "rgba(45,106,79,0.06)", color: "#2D6A4F", border: "1px solid rgba(45,106,79,0.15)" }}>
                    Open to employee engagement
                  </span>
                )}
                {org.cobranding_open && (
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full"
                    style={{ background: "rgba(45,106,79,0.06)", color: "#2D6A4F", border: "1px solid rgba(45,106,79,0.15)" }}>
                    Open to co-branding
                  </span>
                )}
              </div>
            </div>
          )}

          {org.tech_support_available && org.tech_support_available.length > 0 && (
            <div className="rounded-xl px-4 py-3.5"
              style={{ background: "linear-gradient(135deg, rgba(196,92,38,0.05) 0%, transparent 100%)", border: "1px solid rgba(196,92,38,0.14)" }}>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] mb-2.5" style={{ color: "#C45C26" }}>Technology support available</p>
              <div className="flex flex-wrap gap-1.5">
                {org.tech_support_available.map(t => (
                  <span key={t} className="text-xs font-medium px-2.5 py-1 rounded-full"
                    style={{ background: "rgba(196,92,38,0.08)", color: "#C45C26" }}>{t}</span>
                ))}
              </div>
            </div>
          )}

          {org.sandbox_ready && (
            <div className="relative rounded-2xl overflow-hidden"
              style={{
                background: "linear-gradient(135deg, rgba(45,106,79,0.06) 0%, rgba(45,106,79,0.01) 100%)",
                border: "1px solid rgba(45,106,79,0.16)",
              }}>
              <div className="relative px-5 py-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <Sparkles className="w-3 h-3 text-[#2D6A4F]" />
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#2D6A4F]">Open to sandbox/beta testing</p>
                </div>
                {org.sandbox_description && (
                  <p className="text-sm text-foreground leading-relaxed">{org.sandbox_description}</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* SDGs */}
      {org.sdgs && org.sdgs.length > 0 && (
        <div className="rounded-xl px-4 py-3.5"
          style={{ background: "linear-gradient(135deg, rgba(45,106,79,0.04) 0%, transparent 100%)", border: "1px solid rgba(45,106,79,0.10)" }}>
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#2D6A4F] mb-2.5">SDG Alignment</p>
          <div className="flex flex-wrap gap-1.5">
            {org.sdgs.map(s => (
              <span key={s} className="text-xs font-bold w-7 h-7 rounded-full flex items-center justify-center"
                style={{ background: "#2D6A4F", color: "white" }}>
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Needs / Offers — paired glass cards */}
      {((org.needs && org.needs.length > 0) || (org.offers && org.offers.length > 0)) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {org.needs && org.needs.length > 0 && (
            <div className="relative rounded-xl overflow-hidden px-4 py-3.5"
              style={{ background: "linear-gradient(135deg, rgba(196,92,38,0.06) 0%, rgba(196,92,38,0.01) 100%)", border: "1px solid rgba(196,92,38,0.18)" }}>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] mb-2.5" style={{ color: "#C45C26" }}>Seeking</p>
              <div className="flex flex-wrap gap-1.5">
                {org.needs.map(n => (
                  <span key={n} className="text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: "rgba(196,92,38,0.10)", color: "#C45C26" }}>
                    {n}
                  </span>
                ))}
              </div>
            </div>
          )}
          {org.offers && org.offers.length > 0 && (
            <div className="relative rounded-xl overflow-hidden px-4 py-3.5"
              style={{ background: "linear-gradient(135deg, rgba(45,106,79,0.06) 0%, rgba(45,106,79,0.01) 100%)", border: "1px solid rgba(45,106,79,0.18)" }}>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] mb-2.5" style={{ color: "#2D6A4F" }}>Offers</p>
              <div className="flex flex-wrap gap-1.5">
                {org.offers.map(o => (
                  <span key={o} className="text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: "rgba(45,106,79,0.10)", color: "#2D6A4F" }}>
                    {o}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Contact */}
      {org.contact_name && (
        <div className="pt-3 border-t border-border">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Contact</p>
          <p className="text-sm text-foreground">{org.contact_name}</p>
        </div>
      )}
    </div>{/* end left col */}

      {/* Right col -- initiatives + partnership listing */}
      <div className="lg:col-span-2 space-y-4">

        {/* Partnership listing */}
        {orgPartnership?.title && (
          <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#2D6A4F]">Partnership listing</p>
            <p className="text-sm font-bold text-foreground leading-snug">{orgPartnership.title}</p>
            {orgPartnership.sought && (
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{orgPartnership.sought}</p>
            )}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {orgPartnership.stage && (
                <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full" style={{ background: "#eaf5ee", color: "#2D6A4F" }}>
                  {orgPartnership.stage.replace(/_/g, " ")}
                </span>
              )}
              {orgPartnership.funding_status && (
                <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full" style={{ background: "#fdf5f2", color: "#C45C26" }}>
                  {orgPartnership.funding_status.replace(/_/g, " ")}
                </span>
              )}
              {orgPartnership.budget && (
                <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
                  {orgPartnership.budget.replace(/_/g, " ")}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Initiatives */}
        {orgInitiatives.length > 0 && (
          <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Active initiatives</p>
            <div className="space-y-3">
              {orgInitiatives.map(ini => (
                <div key={ini.id} className="pb-3 border-b border-border last:border-0 last:pb-0 space-y-1.5">
                  <p className="text-xs font-semibold text-foreground leading-snug">{ini.title}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {ini.locations?.[0] && (
                      <span className="text-[10px] text-muted-foreground">{ini.locations.slice(0,2).join(", ")}</span>
                    )}
                    {ini.budget && (
                      <span className="text-[10px] text-muted-foreground">{ini.budget}</span>
                    )}
                    <span className="text-[10px] text-muted-foreground ml-auto">{ini.eois} EOI{ini.eois !== 1 ? "s" : ""}</span>
                  </div>
                  {ini.sectors?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {ini.sectors.slice(0,2).map((s: string) => (
                        <span key={s} className="text-[9px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "#fdf5f2", color: "#C45C26" }}>{s}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {orgInitiatives.length === 0 && !orgPartnership?.title && (
          <div className="rounded-2xl border border-dashed border-border p-5 text-center">
            <p className="text-xs text-muted-foreground">No active initiatives or partnership listing yet.</p>
          </div>
        )}

        {(() => {
          if (!org.impact_strategy) return null;
          let pillars: any[] = [];
          try {
            const parsed = JSON.parse(org.impact_strategy);
            pillars = parsed?.pillars ?? [];
          } catch {
            return null;
          }
          if (pillars.length === 0) return null;
          return (
            <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#2D6A4F]" />
                <p className="text-[10px] font-black uppercase tracking-widest text-[#2D6A4F]">
                  Impact strategy
                </p>
              </div>
              <div className="space-y-3">
                {pillars.map((pillar: any, i: number) => {
                  const publishedRow = orgInitiatives.find(
                    ini => ini.title === pillar.pillar_name
                  );
                  const specificAsk = publishedRow?.specific_ask ?? pillar.specific_ask_draft;
                  return (
                  <div key={i} className="pb-3 border-b border-border last:border-0 last:pb-0 space-y-1.5">
                    <p className="text-xs font-semibold text-foreground leading-snug">
                      {pillar.pillar_name}
                    </p>
                    {specificAsk && (
                      <p className="text-[10px] text-muted-foreground leading-relaxed">
                        {specificAsk}
                      </p>
                    )}
                    {pillar.un_sdg_code && (
                      <span className="inline-block text-[9px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: "#eaf5ee", color: "#2D6A4F" }}>
                        {pillar.un_sdg_code}
                      </span>
                    )}
                  </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </div>{/* end right col */}
      </div>{/* end grid */}
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
    <div className="rounded-2xl border border-border bg-card p-12 text-center">
      <div className="flex justify-center mb-4">{icon}</div>
      <p className="text-foreground font-medium mb-2">{title}</p>
      <p className="text-sm text-muted-foreground max-w-sm mx-auto">{subtitle}</p>
    </div>
  );
}
