// ─── DashboardPartnerships.tsx ───────────────────────────────────────────────
import { useEffect, useState } from "react";
import { ORG_TYPE_FILTERS } from "@/lib/orgTypes";
import { supabase } from "@/lib/supabase";
import { Handshake, Loader2, Search } from "lucide-react";
import { SECTOR_OPTIONS } from "@/lib/sectors";
import { FindPartnerModalDashboard } from "./FindPartnerModalDashboard";

function orgTypeLabel(value: string | null | undefined): string {
  if (!value) return "";
  return ORG_TYPE_FILTERS.find(o => o.value === value)?.label ?? value.replace(/_/g, " ");
}

interface OrgRow {
  id: string;
  organisation_name: string;
  description: string;
  sector: string | string[];
  country: string | string[];
  organisation_type: string;
  website?: string;
  email?: string;
  needs?: string[];
  offers?: string[];
  sdgs?: string[];
  verification_status: string;
  status: string;
}

// sector and country are sometimes stored as JSON strings e.g. '["Health"]'
function normalizeArr(val: string | string[] | null | undefined): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : [val];
  } catch {
    return [val];
  }
}



export default function DashboardPartnerships() {
  const [orgs, setOrgs]               = useState<OrgRow[]>([]);
  const [loading, setLoading]         = useState(true);
  const [showModal, setShowModal]     = useState(false);
  const [search, setSearch]           = useState("");
  const [sectorFilters, setSectorFilters] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters]     = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [selectedOrg, setSelectedOrg]     = useState<OrgRow | null>(null);
  const [savedOrgs, setSavedOrgs]         = useState<Set<string>>(new Set());
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    async function loadAll() {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id ?? null;
      setCurrentUserId(uid);

      const [orgsRes, savedRes] = await Promise.all([
        supabase
          .from("organizations")
          .select("id, organisation_name, description, sector, country, organisation_type, website, email, needs, offers, sdgs, verification_status, status")
          .eq("status", "published")
          .order("created_at", { ascending: false }),
        uid
          ? supabase.from("saved_organizations").select("organization_id").eq("user_id", uid)
          : Promise.resolve({ data: null }),
      ]);

      if (orgsRes.error) console.error("Orgs load error:", orgsRes.error);
      if (orgsRes.data) setOrgs(orgsRes.data as OrgRow[]);
      if (savedRes.data) setSavedOrgs(new Set(savedRes.data.map((r: { organization_id: string }) => r.organization_id)));
      setLoading(false);
    }
    loadAll();
  }, []);

  const filtered = orgs.filter((org) => {
    const sectors   = normalizeArr(org.sector);
    const countries = normalizeArr(org.country);
    const matchesSector =
      sectorFilters.size === 0 ||
      sectors.some(s => [...sectorFilters].some(f => s.toLowerCase().includes(f.toLowerCase())));
    const matchesSearch =
      !search.trim() ||
      org.organisation_name?.toLowerCase().includes(search.toLowerCase()) ||
      org.description?.toLowerCase().includes(search.toLowerCase()) ||
      countries.some(c => c.toLowerCase().includes(search.toLowerCase()));
    const matchesFavorites = !favoritesOnly || savedOrgs.has(org.id);
    return matchesSector && matchesSearch && matchesFavorites;
  });

  const activeFilterCount = sectorFilters.size + (favoritesOnly ? 1 : 0);

  async function toggleSave(orgId: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!currentUserId) return;    if (savedOrgs.has(orgId)) {
      const { error: delErr } = await supabase.from("saved_organizations").delete()
        .eq("user_id", currentUserId).eq("organization_id", orgId);
      if (delErr) return;
      setSavedOrgs(prev => { const next = new Set(prev); next.delete(orgId); return next; });
    } else {
      const { error: insErr } = await supabase.from("saved_organizations").insert({ user_id: currentUserId, organization_id: orgId });
      if (insErr) return;      setSavedOrgs(prev => new Set(prev).add(orgId));
    }
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground tracking-tight">Partnerships</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Find organisations aligned with your work.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="rounded-full h-9 px-5 bg-[#2D6A4F] hover:bg-[#245c43] text-white text-sm font-medium transition-colors"
          >
            + Get Matched
          </button>
        </div>

        {/* Search + filter */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search organisations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-9 pr-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowFilters(v => !v)}
            className={`relative h-10 px-4 rounded-lg border text-sm font-medium transition-colors flex items-center gap-2 ${
              showFilters || activeFilterCount > 0
                ? "bg-[#2D6A4F] border-[#2D6A4F] text-white"
                : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth={2} className="w-4 h-4">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
            </svg>
            Filter
            {activeFilterCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-white text-[#2D6A4F] text-[10px] font-bold flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

         {/* Filter panel */}
        {showFilters && (
          <div
            className="rounded-xl border border-border bg-card p-4 space-y-4"
            onMouseLeave={() => setShowFilters(false)}
          >            
          {/* Favorites */}
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={favoritesOnly}
                onChange={e => setFavoritesOnly(e.target.checked)}
                className="w-4 h-4 rounded border-border accent-[#2D6A4F]"
              />
              <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
                  className="w-3.5 h-3.5"
                  fill={favoritesOnly ? "#2D6A4F" : "none"}
                  stroke={favoritesOnly ? "#2D6A4F" : "currentColor"}
                  strokeWidth={2}>
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                </svg>
                Saved only
              </span>
            </label>

            <div className="border-t border-border" />

            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Sector
              </p>
              <div className="flex flex-wrap gap-1.5">
                {SECTOR_OPTIONS.map(sector => (
                  <button
                    key={sector}
                    type="button"
                    onClick={() => {
                      setSectorFilters(prev => {
                        const next = new Set(prev);
                        next.has(sector) ? next.delete(sector) : next.add(sector);
                        return next;
                      });
                    }}
                    className={`h-7 px-3 rounded-full text-xs border transition-colors ${
                      sectorFilters.has(sector)
                        ? "bg-[#2D6A4F] border-[#2D6A4F] text-white"
                        : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                    }`}
                  >
                    {sector}
                  </button>
                ))}
              </div>
            </div>

            {/* Clear */}
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={() => { setSectorFilters(new Set()); setFavoritesOnly(false); }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-5 h-5 text-[#2D6A4F] animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-12 text-center">
            <Handshake className="w-8 h-8 text-muted-foreground/40 mx-auto mb-4" />
            <p className="text-foreground font-medium mb-2">
              {orgs.length === 0 ? "No organisations listed yet." : "No results for that filter."}
            </p>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
              {orgs.length === 0
                ? "Be the first to add your organisation to the ecosystem."
                : "Try a different sector or search term."}
            </p>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="rounded-full h-9 px-5 bg-[#2D6A4F] hover:bg-[#245c43] text-white text-sm font-medium transition-colors"
            >
              Add your organisation
            </button>
          </div>
        ) : selectedOrg ? (
          <OrgDetail
            org={selectedOrg}
            isSaved={savedOrgs.has(selectedOrg.id)}
            onToggleSave={(e) => toggleSave(selectedOrg.id, e)}
            onBack={() => setSelectedOrg(null)}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {filtered.map((org) => (
              <OrgCard
                key={org.id}
                org={org}
                isSaved={savedOrgs.has(org.id)}
                onToggleSave={(e) => toggleSave(org.id, e)}
                onClick={() => setSelectedOrg(org)}
              />
            ))}
          </div>
        )}
      </div>

      <FindPartnerModalDashboard
        isOpen={showModal}
        onClose={() => setShowModal(false)}
      />
    </>
  );
}

// ─── Org detail ───────────────────────────────────────────────────────────────
function OrgDetail({
  org,
  isSaved,
  onToggleSave,
  onBack,
}: {
  org: OrgRow;
  isSaved: boolean;
  onToggleSave: (e: React.MouseEvent) => void;
  onBack: () => void;
}) {
  const isVerified = org.verification_status === "verified";
  const sectors    = normalizeArr(org.sector);
  const countries  = normalizeArr(org.country);

  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
      {/* Back + save */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth={2} className="w-4 h-4">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          Back
        </button>
        <button
          type="button"
          onClick={onToggleSave}
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border border-border hover:border-[#2D6A4F]/60 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
            className="w-4 h-4"
            fill={isSaved ? "#2D6A4F" : "none"}
            stroke={isSaved ? "#2D6A4F" : "currentColor"}
            strokeWidth={2}>
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
          {isSaved ? "Saved" : "Save"}
        </button>
      </div>

      {/* Org name + type + verified */}
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-xl font-bold text-foreground">{org.organisation_name}</h3>
          {isVerified && (
            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
              style={{ background: "#eaf5ee", color: "#2D6A4F" }}>
              ✓ Verified
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-1 capitalize">
          {orgTypeLabel(org.organisation_type)}
          {countries.length > 0 && ` · ${countries.join(", ")}`}
        </p>
      </div>

      {/* Sectors */}
      {sectors.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {sectors.map(s => (
            <span key={s} className="text-xs px-2.5 py-1 rounded-full border border-border text-muted-foreground capitalize">
              {s}
            </span>
          ))}
        </div>
      )}

      {/* Description */}
      {org.description && (
        <p className="text-sm text-muted-foreground leading-relaxed">{org.description}</p>
      )}

      {/* Needs / Offers */}
      {((org.needs && org.needs.length > 0) || (org.offers && org.offers.length > 0)) && (
        <div className="grid grid-cols-2 gap-4 text-sm">
          {org.needs && org.needs.length > 0 && (
            <div>
              <p className="font-medium text-foreground mb-1.5">Needs</p>
              <ul className="space-y-1">
                {org.needs.map(n => (
                  <li key={n} className="text-muted-foreground text-xs flex items-start gap-1.5">
                    <span className="mt-1 w-1 h-1 rounded-full bg-muted-foreground/50 shrink-0" />
                    {n}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {org.offers && org.offers.length > 0 && (
            <div>
              <p className="font-medium text-foreground mb-1.5">Offers</p>
              <ul className="space-y-1">
                {org.offers.map(o => (
                  <li key={o} className="text-muted-foreground text-xs flex items-start gap-1.5">
                    <span className="mt-1 w-1 h-1 rounded-full bg-muted-foreground/50 shrink-0" />
                    {o}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* SDGs */}
      {org.sdgs && org.sdgs.length > 0 && (
        <div>
          <p className="font-medium text-foreground text-sm mb-1.5">SDG Alignment</p>
          <div className="flex gap-1.5 flex-wrap">
            {org.sdgs.map(sdg => (
              <span key={sdg} className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: "#eaf5ee", color: "#2D6A4F" }}>
                SDG {sdg}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Contact */}
      {(org.website || org.email) && (
        <div className="pt-2 border-t border-border space-y-1.5">
          {org.website && org.website !== "https://" && (
            <a href={org.website} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-primary hover:underline">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                <circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
              </svg>
              {org.website.replace(/^https?:\/\//, "")}
            </a>
          )}
          {org.email && (
            <a href={`mailto:${org.email}`}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
              </svg>
              {org.email}
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Org card ─────────────────────────────────────────────────────────────────
function OrgCard({
  org,
  isSaved,
  onToggleSave,
  onClick,
}: {
  org: OrgRow;
  isSaved: boolean;
  onToggleSave: (e: React.MouseEvent) => void;
  onClick: () => void;
}) {
  const isVerified = org.verification_status === "verified";
  const sectors   = normalizeArr(org.sector);
  const countries = normalizeArr(org.country);

  return (
    <div
      className="rounded-xl border border-border bg-card px-5 py-4 flex flex-col gap-3 cursor-pointer hover:border-[#2D6A4F]/40 transition-colors"
      onClick={onClick}
    >
      {/* Name + verified badge */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-foreground truncate">{org.organisation_name}</p>
            {isVerified && (
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                style={{ background: "#eaf5ee", color: "#2D6A4F" }}>
                ✓ Verified
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 capitalize">
  {orgTypeLabel(org.organisation_type)}
            {countries.length > 0 && ` · ${countries.join(", ")}`}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {sectors.length > 0 && (
            <span className="text-xs px-2.5 py-1 rounded-full border border-border text-muted-foreground capitalize">
              {sectors[0]}
            </span>
          )}
          <button
            type="button"
            onClick={onToggleSave}
            className="p-1.5 rounded-full hover:bg-muted transition-colors"
            aria-label={isSaved ? "Unsave" : "Save"}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
              className="w-4 h-4 transition-colors"
              fill={isSaved ? "#2D6A4F" : "none"}
              stroke={isSaved ? "#2D6A4F" : "currentColor"}
              strokeWidth={2}>
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Description */}
      {org.description && (
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
          {org.description}
        </p>
      )}

      {/* Needs / Offers */}
      {((org.needs && org.needs.length > 0) || (org.offers && org.offers.length > 0)) && (
        <div className="flex gap-4 text-xs">
          {org.needs && org.needs.length > 0 && (
            <div>
              <span className="text-muted-foreground font-medium">Needs: </span>
              <span className="text-foreground">{org.needs.slice(0, 3).join(", ")}</span>
            </div>
          )}
          {org.offers && org.offers.length > 0 && (
            <div>
              <span className="text-muted-foreground font-medium">Offers: </span>
              <span className="text-foreground">{org.offers.slice(0, 3).join(", ")}</span>
            </div>
          )}
        </div>
      )}

      {/* SDGs */}
      {org.sdgs && org.sdgs.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {org.sdgs.map(sdg => (
            <span key={sdg} className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: "#eaf5ee", color: "#2D6A4F" }}>
              SDG {sdg}
            </span>
          ))}
        </div>
      )}

      {/* Website */}
      {org.website && org.website !== "https://" && (
        <a href={org.website} target="_blank" rel="noopener noreferrer"
          className="text-xs text-primary hover:underline truncate">
          {org.website.replace(/^https?:\/\//, "")}
        </a>
      )}
    </div>
  );
}