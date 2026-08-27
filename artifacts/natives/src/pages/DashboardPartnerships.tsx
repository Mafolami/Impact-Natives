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
          : "hover:bg-muted/50 border-l-[3px] border-l-transparent border-b-border/60"
      }`}>

      {/* Org name + save */}
      <div className="flex items-center justify-between gap-2 mb-0.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`text-sm font-bold truncate ${selected ? "text-[#2D6A4F]" : "text-foreground"}`}>
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
        <p className="text-xs text-black dark:text-white leading-snug line-clamp-2">
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
export default function DashboardPartnerships() {
  const { user, orgOwnerId } = useAuth();
  const autoOpenOrgId = new URLSearchParams(window.location.search).get("org");
  const [orgs, setOrgs]                       = useState<OrgRow[]>([]);
  const [loading, setLoading]                 = useState(true);
  const [showModal, setShowModal]             = useState(false);
  const [search, setSearch]                   = useState("");
  const [sectorFilters, setSectorFilters]     = useState<Set<string>>(new Set());
  const [favoritesOnly, setFavoritesOnly]     = useState(false);
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
  const [selectedOrg, setSelectedOrg]         = useState<OrgRow | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [deepLinkMissing, setDeepLinkMissing] = useState(false);
  // Which listed orgs have at least one direct-connection MoU fully executed.
  // This lives on partnership_connections (per relationship), not on the
  // org row itself, so it's a separate lookup rather than a selected column.
  const [mouExecutedOrgIds, setMouExecutedOrgIds] = useState<Set<string>>(new Set());
  const { viewerOrg, viewerOrgLoading, savedOrgs, sentInterests, sendingInterest, toggleSave, expressInterest } = useOrgActions(orgOwnerId, user?.id);

  useEffect(() => { if (user) loadAll(); }, [user]);

  async function loadAll() {
    const uid = user?.id ?? null;
    const { data } = await supabase.from("organizations")
      .select("id,organisation_name,description,sector,country,organisation_type,website,email,needs,offers,sdgs,partnership_sought,partnership_title,verification_status,status,user_id,partnership_listed,partnership_formed,partnership_stage,partnership_duration,partnership_budget,partnership_decision_timeline,partnership_success_definition,partnership_funding_status,partnership_exclusivity,partnership_working_style,partnership_financial_transfer,partnership_reporting,partnership_ip_ownership,partnership_legal_type,partnership_team_capacity,partnership_contact_seniority,partnership_geo_specificity,partnership_theory_of_change,partnership_prior_attempts,partnership_constraints,partnership_dd_financial_model,partnership_dd_audited_accounts,partnership_dd_safeguarding_policy,partnership_dd_data_policy,partnership_dd_governance_doc,partnership_prior_experience,partnership_prior_experience_detail,partnership_physically_present,dd_financial_model,dd_audited_accounts,dd_governance_doc,dd_esg_assessment,dd_impact_framework,dd_environmental_policy,dd_safeguarding_policy,dd_legal_registration,dd_legal_compliance_declaration,fdd_disbursement_track_record,fdd_decision_transparency,fdd_conflict_disclosure,fdd_governance_doc,fdd_esg_framework,fdd_legal_registration")
      .eq("status", "published").eq("partnership_listed", true).order("created_at", { ascending: false });

    if (data) {
      setOrgs(data as OrgRow[]);
      const deepLinked = autoOpenOrgId ? (data as OrgRow[]).find(o => o.id === autoOpenOrgId) : null;
      if (deepLinked) {
        setSelectedOrg(deepLinked);
      } else if (autoOpenOrgId) {
        // A specific org was requested via ?org= but isn't published/partnership-listed right now.
        // Don't silently substitute a different org — flag it instead.
        setDeepLinkMissing(true);
      } else if (data.length > 0) {
        setSelectedOrg(data[0] as OrgRow);
      }

      const orgIds = (data as OrgRow[]).map(o => o.id);
      if (orgIds.length > 0) {
        const { data: executedIds } = await supabase
          .rpc("get_mou_executed_org_ids", { org_ids: orgIds });
        setMouExecutedOrgIds(new Set<string>(executedIds ?? []));
      }
    }
    setLoading(false);
  }

  const filtered = orgs.filter(org => {
    const sectors = normalizeArr(org.sector);
    const countries = normalizeArr(org.country);
    const matchesSector    = sectorFilters.size === 0 || sectors.some(s => [...sectorFilters].some(f => s.toLowerCase().includes(f.toLowerCase())));
    const matchesSearch    = !search.trim() || org.organisation_name?.toLowerCase().includes(search.toLowerCase()) || org.description?.toLowerCase().includes(search.toLowerCase()) || (org.partnership_sought ?? "").toLowerCase().includes(search.toLowerCase()) || countries.some(c => c.toLowerCase().includes(search.toLowerCase()));
    const matchesFavorites = !favoritesOnly || savedOrgs.has(org.id);
    const matchesOrgType   = orgTypeFilters.size === 0 || orgTypeFilters.has(org.organisation_type ?? "");
    const matchesStage     = stageFilters.size === 0 || stageFilters.has(org.partnership_stage ?? "");
    const matchesDDReady   = !ddReadyOnly || [
      org.partnership_dd_financial_model,
      org.partnership_dd_audited_accounts,
      org.partnership_dd_safeguarding_policy,
      org.partnership_dd_data_policy,
      org.partnership_dd_governance_doc,
    ].some(Boolean);
    return matchesSector && matchesSearch && matchesFavorites && matchesOrgType && matchesStage && matchesDDReady;
  });

  const activeFilterCount = sectorFilters.size + orgTypeFilters.size + stageFilters.size + (favoritesOnly ? 1 : 0) + (ddReadyOnly ? 1 : 0);

  return (
    <>
      <div className="flex flex-col -mx-4 sm:-mx-6" style={{ height: "100vh", maxHeight: "100vh", overflow: "hidden" }}>
        {/* Top bar */}
        <div className="shrink-0 px-5 py-3 flex items-center gap-2 bg-background border-b border-border">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input type="text" placeholder="Search listings..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-3 rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#452A1D]/25 transition-colors bg-muted border border-border" />          </div>
          <div ref={filterBarRef} className="flex items-center gap-1.5 relative">
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
                label: `More${(favoritesOnly ? 1 : 0) + (ddReadyOnly ? 1 : 0) > 0 ? ` (${(favoritesOnly ? 1 : 0) + (ddReadyOnly ? 1 : 0)})` : ""}`,
                count: (favoritesOnly ? 1 : 0) + (ddReadyOnly ? 1 : 0),
                options: [],
                selected: new Set(),
                toggle: () => {},
                clear: () => { setFavoritesOnly(false); setDdReadyOnly(false); },
              },
            ] as const).map(f => (
              <div key={f.key} className="relative">
                <button type="button"
                  onClick={() => setOpenDropdown(prev => prev === f.key ? null : f.key)}
                  className={`h-8 px-3 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-colors ${
                    f.count > 0 || openDropdown === f.key
                      ? "text-white border border-transparent"
                      : "bg-background text-foreground border border-border"
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
                  <div className="absolute top-full left-0 mt-1 z-50 rounded-xl shadow-lg border border-border bg-card min-w-[180px] p-2"
                    style={{ maxHeight: "280px", overflowY: "auto" }}>
                    {f.key === "toggles" ? (
                      <div className="space-y-1">
                        {[
                          { label: "Saved only",        checked: favoritesOnly, set: setFavoritesOnly },
                          { label: "DD docs available", checked: ddReadyOnly,   set: setDdReadyOnly   },
                        ].map(t => (
                          <label key={t.label} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-muted transition-colors">
                            <input type="checkbox" checked={t.checked} onChange={e => t.set(e.target.checked)}
                              className="w-3.5 h-3.5 rounded accent-[#2D6A4F]" />
                            <span className="text-xs text-foreground font-medium">{t.label}</span>
                          </label>
                        ))}
                        {(favoritesOnly || ddReadyOnly) && (
                          <button type="button" onClick={f.clear}
                            className="w-full text-left px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
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
                              className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-xs text-left transition-colors ${
                                on ? "bg-[#2D6A4F]/10 text-[#2D6A4F] font-semibold" : "text-foreground hover:bg-muted"
                              }`}>
                              <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                                on ? "bg-[#2D6A4F] border-[#2D6A4F]" : "border-border"
                              }`}>
                                {on && <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5"><polyline points="20 6 9 17 4 12"/></svg>}
                              </div>
                              {o.label}
                            </button>
                          );
                        })}
                        {f.count > 0 && (
                          <button type="button" onClick={f.clear}
                            className="w-full text-left px-2 py-1 mt-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors border-t border-border">
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
                onClick={() => { setSectorFilters(new Set()); setOrgTypeFilters(new Set()); setStageFilters(new Set()); setFavoritesOnly(false); setDdReadyOnly(false); }}
                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors px-1">
                Clear all
              </button>
            )}
          </div>
          <div className="flex-1" />
          {user && (
            <button type="button" onClick={() => setShowModal(true)}
              className="h-9 px-4 rounded-full text-white text-xs font-bold transition-all hover:brightness-110 active:scale-[0.98]"
              style={{ background: "linear-gradient(135deg, #3D2618 0%, #33301F 50%, #1B3328 100%)" }}>
              + Get Matched
            </button>
          )}
        </div>

        {deepLinkMissing && (
          <div className="shrink-0 px-5 py-2 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between gap-2">
            <span>The listing you followed a link to isn't currently available — it may be unpublished or no longer partnership-listed.</span>
            <button type="button" onClick={() => setDeepLinkMissing(false)} className="shrink-0 hover:opacity-70 font-medium">
              Dismiss
            </button>
          </div>
        )}

        {/* Split layout */}
        {loading ? (
          <div className="flex items-center justify-center flex-1">
            <Loader2 className="w-5 h-5 animate-spin text-[#2D6A4F]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-4 text-center px-6">
            <Handshake className="w-7 h-7 text-muted-foreground/50" />
            <div>
              <p className="text-sm font-bold text-foreground mb-1">{orgs.length === 0 ? "No listings yet" : "No results"}</p>
              <p className="text-xs text-black dark:text-white">{orgs.length === 0 ? "Be the first to list your organisation." : "Try a different search or filter."}</p>
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 overflow-hidden" style={{ flex: 1 }}>            {/* Left list */}
            <div className={`w-full lg:w-72 xl:w-80 shrink-0 overflow-y-auto border-r-2 border-border bg-muted/40 ${mobileDetailOpen ? "hidden lg:block" : "block"}`}>
              {filtered.map(org => (
                <ListCard key={org.id} org={org}
                  selected={selectedOrg?.id === org.id}
                  onClick={() => { setSelectedOrg(org); setMobileDetailOpen(true); }}
                  isSaved={savedOrgs.has(org.id)}
                  onToggleSave={e => toggleSave(org.id, e)}
                  mouExecuted={mouExecutedOrgIds.has(org.id)}
                />
              ))}
            </div>

            {/* Right detail */}
            <div className={`flex-1 min-w-0 overflow-y-auto ${mobileDetailOpen ? "block" : "hidden lg:block"}`}>
              <OrgDetailPanel
                org={selectedOrg}
                isSaved={selectedOrg ? savedOrgs.has(selectedOrg.id) : false}
                onToggleSave={e => selectedOrg && toggleSave(selectedOrg.id, e)}
                isOrg={!!user}
                alreadySent={selectedOrg ? sentInterests.has(selectedOrg.id) : false}
                sending={selectedOrg ? sendingInterest === selectedOrg.id : false}
                onExpressInterest={e => selectedOrg && expressInterest(selectedOrg, e)}
                onBack={() => setMobileDetailOpen(false)}
                viewerOrg={viewerOrg}
                viewerOrgLoading={viewerOrgLoading}                
                mouExecuted={selectedOrg ? mouExecutedOrgIds.has(selectedOrg.id) : false}
              />
            </div>
          </div>
        )}
      </div>

      <FindPartnerModalDashboard isOpen={showModal} onClose={() => { setShowModal(false); loadAll(); }} />
    </>
  );
}