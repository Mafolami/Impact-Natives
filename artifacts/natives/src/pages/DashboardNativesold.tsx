// ─── DashboardNatives.tsx ────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Loader2, Search, Users } from "lucide-react";
import { UserAvatar, avatarColor, initials } from "@/components/ui/UserAvatar";

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
  social_links?: { label: string; url: string }[];
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
}

type Tab = "individual" | "organisation";

function normalizeArr(val: string | string[] | null | undefined): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  try { const p = JSON.parse(val); return Array.isArray(p) ? p : [val]; }
  catch { return [val]; }
}

export default function DashboardNatives() {
    const [tab, setTab] = useState<Tab>("individual");

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
  const [search, setSearch] = useState("");
  const [autoOpenUserId, setAutoOpenUserId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("user");
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground tracking-tight">Natives</h2>
        <p className="text-sm text-muted-foreground mt-1">Browse individuals and organisations in the ecosystem.</p>
      </div>

      <div className="flex gap-1 p-1 rounded-lg bg-muted w-fit">
        {(["individual", "organisation"] as const).map((t) => (
          <button key={t} type="button" onClick={() => { setTab(t); setSearch(""); }}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === t ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}>
            {t === "individual" ? "Individuals" : "Organisations"}
          </button>
        ))}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input type="text"
          placeholder={tab === "individual" ? "Search people..." : "Search organisations..."}
          value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full h-10 pl-9 pr-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors" />
      </div>

            {tab === "individual"
        ? <IndividualsPanel search={search} autoOpenUserId={autoOpenUserId} onAutoOpened={() => setAutoOpenUserId(null)} />
        : <OrgsPanel search={search} autoOpenUserId={autoOpenUserId} onAutoOpened={() => setAutoOpenUserId(null)} />}
    </div>
  );
}

// ─── Individuals Panel ────────────────────────────────────────────────────────

function IndividualsPanel({ search, autoOpenUserId, onAutoOpened }: {
  search: string;
  autoOpenUserId?: string | null;
  onAutoOpened?: () => void;
}) {
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ProfileRow | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, org_name, role_title, country, sectors, bio, avatar_url, linkedin_url, website, user_type, social_links")
        .not("full_name", "is", null)
        .or("user_type.eq.individual_creative,user_type.is.null")
        .order("full_name", { ascending: true });
      if (error) console.error(error);
      const rows = data ?? [];
      setProfiles(rows);

      // Auto-open profile if user param was passed
      if (autoOpenUserId) {
        const match = rows.find((p) => p.id === autoOpenUserId);
        if (match) {
          setSelected(match);
          onAutoOpened?.();
        }
      }

      setLoading(false);
    }
    load();
  }, []);

  const filtered = profiles.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.full_name?.toLowerCase().includes(q) ||
      p.org_name?.toLowerCase().includes(q) ||
      p.role_title?.toLowerCase().includes(q) ||
      p.country?.toLowerCase().includes(q) ||
      p.bio?.toLowerCase().includes(q)
    );
  });

  if (loading) return <LoadingSpinner />;
  if (selected) return <ProfileDetail profile={selected} onBack={() => setSelected(null)} />;
  if (filtered.length === 0) return (
    <EmptyState icon={<Users className="w-8 h-8 text-muted-foreground/40" />}
      title={profiles.length === 0 ? "No profiles yet." : "No results."}
      subtitle={profiles.length === 0 ? "Profiles will appear here as people join." : "Try a different search term."} />
  );

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {filtered.map((p) => <ProfileCard key={p.id} profile={p} onClick={() => setSelected(p)} />)}
    </div>
  );
}

function ProfileCard({ profile, onClick }: { profile: ProfileRow; onClick: () => void }) {
  const sectors = profile.sectors ?? [];
  return (
    <div className="rounded-xl border border-border bg-card px-5 py-4 flex flex-col gap-3 cursor-pointer hover:border-[#2D6A4F]/40 transition-colors" onClick={onClick}>
      <div className="flex items-start gap-3">
        <UserAvatar
          id={profile.id}
          name={profile.full_name}
          avatarUrl={profile.avatar_url}
          size="md"
        />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground truncate">{profile.full_name}</p>
          {profile.role_title && <p className="text-xs text-muted-foreground truncate">{profile.role_title}</p>}
          {profile.org_name && <p className="text-xs text-muted-foreground truncate">{profile.org_name}</p>}
        </div>
      </div>
      {profile.country && <p className="text-xs text-muted-foreground">{profile.country}</p>}
      {profile.bio && <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">{profile.bio}</p>}
      {sectors.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {sectors.slice(0, 3).map((s) => (
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
      <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
          <path d="M19 12H5M12 5l-7 7 7 7" />
        </svg>
        Back
      </button>

      <div className="flex items-start gap-4">
        <UserAvatar
          id={profile.id}
          name={profile.full_name}
          avatarUrl={profile.avatar_url}
          size="lg"
        />
        <div className="min-w-0">
          <h3 className="text-xl font-bold text-foreground">{profile.full_name}</h3>
          {profile.role_title && <p className="text-sm text-muted-foreground">{profile.role_title}</p>}
          {profile.org_name && <p className="text-sm text-muted-foreground">{profile.org_name}</p>}
          {profile.country && <p className="text-xs text-muted-foreground mt-1">{profile.country}</p>}
        </div>
      </div>

      {sectors.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {sectors.map((s) => <span key={s} className="text-xs px-2.5 py-1 rounded-full border border-border text-muted-foreground">{s}</span>)}
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

// ─── Orgs Panel ───────────────────────────────────────────────────────────────

function OrgsPanel({ search, autoOpenUserId, onAutoOpened }: {
  search: string;
  autoOpenUserId?: string | null;
  onAutoOpened?: () => void;
}) {
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<OrgRow | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: orgData, error } = await supabase
        .from("organizations")
        .select("id, organisation_name, sector, country, organisation_type, website, verification_status, user_id")
        .eq("status", "published")
        .order("organisation_name", { ascending: true });

      if (error) { console.error(error); setLoading(false); return; }
      if (!orgData || orgData.length === 0) { setLoading(false); return; }

      const userIds = [...new Set(orgData.map((o) => o.user_id).filter(Boolean))];
      const { data: profileData } = await supabase
        .from("profiles").select("id, full_name").in("id", userIds);

      const profileMap = new Map((profileData ?? []).map((p) => [p.id, p]));
      const enriched: OrgRow[] = orgData.map((o) => ({
        ...o,
        contact_name: profileMap.get(o.user_id)?.full_name,
      }));

      setOrgs(enriched);

      if (autoOpenUserId) {
        const match = enriched.find((o) => o.user_id === autoOpenUserId);
        if (match) {
          setSelected(match);
          onAutoOpened?.();
        }
      }

      setLoading(false);
    }
    load();
  }, []);

  const filtered = orgs.filter((o) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const sectors = normalizeArr(o.sector);
    const countries = normalizeArr(o.country);
    return (
      o.organisation_name?.toLowerCase().includes(q) ||
      sectors.some((s) => s.toLowerCase().includes(q)) ||
      countries.some((c) => c.toLowerCase().includes(q))
    );
  });

  if (loading) return <LoadingSpinner />;
  if (selected) return <NativesOrgDetail org={selected} onBack={() => setSelected(null)} />;
  if (filtered.length === 0) return (
    <EmptyState icon={<Users className="w-8 h-8 text-muted-foreground/40" />}
      title={orgs.length === 0 ? "No organisations yet." : "No results."}
      subtitle={orgs.length === 0 ? "Published organisations will appear here." : "Try a different search term."} />
  );

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {filtered.map((o) => <NativesOrgCard key={o.id} org={o} onClick={() => setSelected(o)} />)}
    </div>
  );
}

function NativesOrgCard({ org, onClick }: { org: OrgRow; onClick: () => void }) {
  const isVerified = org.verification_status === "verified";
  const sectors = normalizeArr(org.sector);
  const countries = normalizeArr(org.country);
  const color = avatarColor(org.id);

  return (
    <div className="rounded-xl border border-border bg-card px-5 py-4 flex flex-col gap-3 cursor-pointer hover:border-[#2D6A4F]/40 transition-colors" onClick={onClick}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-white text-sm font-bold" style={{ background: color }}>
          {initials(org.organisation_name || "?")}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-foreground truncate">{org.organisation_name}</p>
            {isVerified && (
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: "#eaf5ee", color: "#2D6A4F" }}>
                ✓ Verified
              </span>
            )}
          </div>
          {org.organisation_type && (
            <p className="text-xs text-muted-foreground mt-0.5 capitalize">{org.organisation_type.replace(/_/g, " ")}</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
        {sectors.length > 0 && <p><span className="font-medium text-foreground">Sector: </span>{sectors.join(", ")}</p>}
        {countries.length > 0 && <p><span className="font-medium text-foreground">Location: </span>{countries.join(", ")}</p>}
        {org.website && org.website !== "https://" && (
          <a href={org.website} target="_blank" rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-primary hover:underline truncate">
            {org.website.replace(/^https?:\/\//, "")}
          </a>
        )}
      </div>
    </div>
  );
}

function NativesOrgDetail({ org, onBack }: { org: OrgRow; onBack: () => void }) {
  const isVerified = org.verification_status === "verified";
  const sectors = normalizeArr(org.sector);
  const countries = normalizeArr(org.country);
  const color = avatarColor(org.id);

  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-5 max-w-2xl">
      <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
          <path d="M19 12H5M12 5l-7 7 7 7" />
        </svg>
        Back
      </button>

      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-full flex items-center justify-center shrink-0 text-white text-lg font-bold" style={{ background: color }}>
          {initials(org.organisation_name || "?")}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-xl font-bold text-foreground">{org.organisation_name}</h3>
            {isVerified && (
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: "#eaf5ee", color: "#2D6A4F" }}>
                ✓ Verified
              </span>
            )}
          </div>
          {org.organisation_type && (
            <p className="text-sm text-muted-foreground mt-0.5 capitalize">{org.organisation_type.replace(/_/g, " ")}</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 text-sm">
        {sectors.length > 0 && (
          <div className="flex gap-2">
            <span className="text-muted-foreground w-20 shrink-0">Sector</span>
            <span className="text-foreground">{sectors.join(", ")}</span>
          </div>
        )}
        {countries.length > 0 && (
          <div className="flex gap-2">
            <span className="text-muted-foreground w-20 shrink-0">Location</span>
            <span className="text-foreground">{countries.join(", ")}</span>
          </div>
        )}
        {org.website && org.website !== "https://" && (
          <div className="flex gap-2">
            <span className="text-muted-foreground w-20 shrink-0">Website</span>
            <a href={org.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">
              {org.website.replace(/^https?:\/\//, "")}
            </a>
          </div>
        )}
      </div>

      {org.contact_name && (
        <div className="pt-3 border-t border-border">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Contact</p>
          <p className="text-sm text-foreground">{org.contact_name}</p>
        </div>
      )}
    </div>
  );
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-5 h-5 text-[#2D6A4F] animate-spin" />
    </div>
  );
}

function EmptyState({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-12 text-center">
      <div className="flex justify-center mb-4">{icon}</div>
      <p className="text-foreground font-medium mb-2">{title}</p>
      <p className="text-sm text-muted-foreground max-w-sm mx-auto">{subtitle}</p>
    </div>
  );
}