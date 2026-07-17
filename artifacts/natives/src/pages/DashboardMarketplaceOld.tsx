// ─── DashboardMarketplace.tsx ─────────────────────────────────────────────────
import { useEffect, useState } from "react";
import { VerifiedBadge } from "@/components/ui/VerifiedBadge";
import { supabase } from "@/lib/supabase";
import { Loader2, CheckCircle2, X, SlidersHorizontal, Search, Leaf, Zap, MessageSquare, ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { FileText, Sparkles } from "lucide-react";
import { useLocation } from "wouter";
import CreateInitiativeModalDashboard from "./CreateInitiativeModalDashboard";

interface InitiativeRow {
  id: string;
  title: string;
  sectors: string[];
  locations: string[];
  status: string;
  eois: number;
  created_at: string;
  problem?: string;
  outcome?: string;
  partnerships?: string[];
  budget?: string | null;
  tags?: string[];
  submitter_org?: string | null;
  user_id?: string | null;
  esg_alignment?: boolean | null;
  // new fields
  submitter_is_verified?: boolean;
  submitter_org_type?: string | null;
  submitter_name?: string | null;
  submitter_user_type?: string | null;
  specific_ask?: string | null;
  stage?: string | null;
}

// REPLACE WITH:
// Location options derived dynamically from loaded initiatives (see useDynamicOptions below)

const BUDGET_OPTIONS = [
  { label: "Under $50K",   value: "under_50k" },
  { label: "$50K – $200K", value: "50k_200k"  },
  { label: "$200K – $1M",  value: "200k_1m"   },
  { label: "Over $1M",     value: "over_1m"   },
];

const PARTNERSHIP_OPTIONS = [
  { value: "funding",     label: "Funding"      },
  { value: "technical",   label: "Technical"    },
  { value: "operational", label: "Operational"  },
  { value: "leadership",  label: "Leadership"   },
  { value: "strategic",   label: "Strategic"    },
  { value: "lead",        label: "Project Lead" },
];

function useDynamicOptions(initiatives: InitiativeRow[]) {
  const sectors = Array.from(
    new Set(initiatives.flatMap(i => i.sectors ?? []))
  ).filter(Boolean).sort();

  const locations = Array.from(
    new Set(initiatives.flatMap(i => i.locations ?? []))
  ).filter(Boolean).sort();

  return { sectors, locations };
}

// EOI partnership types now aligned with initiative vocabulary
const EOI_PARTNERSHIP_TYPES = [
  { value: "funding",     label: "Funding"       },
  { value: "technical",   label: "Technical"     },
  { value: "operational", label: "Operational"   },
  { value: "leadership",  label: "Leadership"    },
  { value: "strategic",   label: "Strategic"     },
  { value: "lead",        label: "Project Lead"  },
];

function budgetMatches(budget: string | null | undefined, filter: string): boolean {
  if (!budget) return false;
  const nums = budget.replace(/[^0-9]/g, " ").trim().split(/\s+/).map(Number).filter(Boolean);
  if (!nums.length) return false;
  const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
  if (filter === "under_50k") return avg < 50000;
  if (filter === "50k_200k")  return avg >= 50000 && avg < 200000;
  if (filter === "200k_1m")   return avg >= 200000 && avg < 1000000;
  if (filter === "over_1m")   return avg >= 1000000;
  return false;
}

// ─── Filter Panel ─────────────────────────────────────────────────────────────
function FilterPanel({
  sectors, setSectors, locations, setLocations,
  budgets, setBudgets, partnerships, setPartnerships,
  onClear, activeCount, sectorOptions, locationOptions,
}: {
  sectors: string[]; setSectors: (v: string[]) => void;
  locations: string[]; setLocations: (v: string[]) => void;
  budgets: string[]; setBudgets: (v: string[]) => void;
  partnerships: string[]; setPartnerships: (v: string[]) => void;
  onClear: () => void; activeCount: number;
  sectorOptions: string[]; locationOptions: string[];
}) {
  function toggle(arr: string[], val: string, set: (v: string[]) => void) {
    set(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);
  }
  const [sectorSearch, setSectorSearch] = useState("");
  const [locationSearch, setLocationSearch] = useState("");

  const filteredSectorOptions = sectorOptions.filter(o =>
    o.toLowerCase().includes(sectorSearch.toLowerCase())
  );
  const filteredLocationOptions = locationOptions.filter(o =>
    o.toLowerCase().includes(locationSearch.toLowerCase())
  );

  function DropdownFilter({ label, search, setSearch, options, selected, set }: {
    label: string; search: string; setSearch: (v: string) => void;
    options: string[]; selected: string[]; set: (v: string[]) => void;
  }) {
    return (
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold uppercase tracking-wider text-[#374151]">{label}</p>
          {selected.length > 0 && (
            <button type="button" onClick={() => set([])}
              className="text-[10px] text-[#2D6A4F] hover:underline">
              Clear ({selected.length})
            </button>
          )}
        </div>
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {selected.map(s => (
              <span key={s} className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full text-white"
                style={{ background: "#2D6A4F" }}>
                {s}
                <button type="button" onClick={() => toggle(selected, s, set)}
                  className="hover:opacity-70 transition-opacity">
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="relative mb-2">
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder={`Search ${label.toLowerCase()}...`}
            className="w-full h-8 pl-3 pr-3 rounded-lg text-xs text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-1 focus:ring-[#2D6A4F]/30"
            style={{ background: "#F9FAFB", border: "1px solid #E5E7EB" }} />
        </div>
        <div className="max-h-36 overflow-y-auto space-y-0.5 pr-1">
          {filteredLocationOptions.length === 0 && options === locationOptions && (
            <p className="text-xs text-[#6B7280] py-1">No results</p>
          )}
          {(options === sectorOptions ? filteredSectorOptions : filteredLocationOptions).map(o => {
            const on = selected.includes(o);
            return (
              <button key={o} type="button" onClick={() => toggle(selected, o, set)}
                className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-xs text-left transition-colors ${
                  on ? "bg-[#eaf5ee] text-[#2D6A4F] font-semibold" : "text-[#374151] hover:bg-[#F3F4F6]"
                }`}>
                <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                  on ? "bg-[#2D6A4F] border-[#2D6A4F]" : "border-[#D1D5DB]"
                }`}>
                  {on && <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5"><polyline points="20 6 9 17 4 12"/></svg>}
                </div>
                {o}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-[#111827]">Filters</p>
        {activeCount > 0 && (
          <button type="button" onClick={onClear} className="text-xs font-semibold text-[#2D6A4F] hover:underline">
            Clear all ({activeCount})
          </button>
        )}
      </div>

      <DropdownFilter
        label="Sector" search={sectorSearch} setSearch={setSectorSearch}
        options={sectorOptions} selected={sectors} set={setSectors}
      />

      <div className="h-px bg-[#F3F4F6]" />

      <DropdownFilter
        label="Location" search={locationSearch} setSearch={setLocationSearch}
        options={locationOptions} selected={locations} set={setLocations}
      />

      <div className="h-px bg-[#F3F4F6]" />

      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-[#374151] mb-2.5">Budget range</p>
        <div className="flex flex-wrap gap-1.5">
          {BUDGET_OPTIONS.map(b => (
            <button key={b.value} type="button" onClick={() => toggle(budgets, b.value, setBudgets)}
              className={`h-7 px-3 rounded-full text-xs font-medium border transition-colors ${
                budgets.includes(b.value)
                  ? "bg-[#2D6A4F] border-[#2D6A4F] text-white"
                  : "border-[#E5E7EB] text-[#374151] hover:border-[#2D6A4F]/40 hover:text-[#2D6A4F]"
              }`}>
              {b.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-px bg-[#F3F4F6]" />

      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-[#374151] mb-2.5">Partnership sought</p>
        <div className="flex flex-wrap gap-1.5">
          {PARTNERSHIP_OPTIONS.map(p => (
            <button key={p.value} type="button" onClick={() => toggle(partnerships, p.value, setPartnerships)}
              className={`h-7 px-3 rounded-full text-xs font-medium border transition-colors ${
                partnerships.includes(p.value)
                  ? "bg-[#2D6A4F] border-[#2D6A4F] text-white"
                  : "border-[#E5E7EB] text-[#374151] hover:border-[#2D6A4F]/40 hover:text-[#2D6A4F]"
              }`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Initiative Card ──────────────────────────────────────────────────────────
function InitiativeCard({ ini, expressed, onClick, saved, onToggleSave }: {
  ini: InitiativeRow; expressed: boolean; onClick: () => void;
  saved: boolean; onToggleSave: (id: string, wasSaved: boolean) => void;
}) {
  return (
    <button type="button" onClick={onClick}
      className="w-full text-left rounded-2xl border border-border bg-card hover:border-[#2D6A4F]/40 hover:shadow-sm transition-all group p-5 flex flex-col gap-3">
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {ini.sectors?.slice(0, 2).map(s => (
            <span key={s} className="text-[11px] font-medium px-2.5 py-0.5 rounded-full"
              style={{ background: "#f5ede8", color: "#C45C26" }}>
              {s}
            </span>
          ))}
          {(ini.sectors?.length ?? 0) > 2 && (
            <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground">
              +{(ini.sectors?.length ?? 0) - 2}
            </span>
          )}
          {ini.esg_alignment && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full"
              style={{ background: "#e8f5e9", color: "#2e7d32" }}>
              <Leaf className="w-2.5 h-2.5" />ESG/CSR
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onToggleSave(ini.id, saved); }}
            className="p-1 rounded hover:bg-muted transition-colors"
            title={saved ? "Remove from saved" : "Save initiative"}>
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"
              fill={saved ? "#2D6A4F" : "none"} stroke={saved ? "#2D6A4F" : "currentColor"}
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>
            </svg>
          </button>
          {ini.submitter_is_verified && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full"
              style={{ background: "#eaf5ee", color: "#2D6A4F" }}>
              <VerifiedBadge />
            </span>
          )}
          {ini.status === "closed" && (
            <span className="text-[11px] font-medium text-gray-500 bg-gray-100 px-2.5 py-0.5 rounded-full">
              Partnership formed
            </span>
          )}
          {expressed && ini.status !== "closed" && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#2D6A4F] bg-[#eaf5ee] px-2.5 py-0.5 rounded-full">
              <CheckCircle2 className="w-3 h-3" />Expressed
            </span>
          )}
        </div>
      </div>

      {/* Title */}
      <div>
        <h3 className="font-semibold text-foreground group-hover:text-[#2D6A4F] transition-colors leading-snug">
          {ini.title}
        </h3>
        {(ini.submitter_org || ini.submitter_name) && (
          <a
            href={
              ini.submitter_user_type === "organisation"
                ? `/dashboard/natives?tab=organisation&user=${ini.user_id}`
                : `/dashboard/natives?tab=individual&user=${ini.user_id}`
            }
            onClick={e => e.stopPropagation()}
            className="text-xs text-muted-foreground mt-0.5 hover:text-[#2D6A4F] hover:underline underline-offset-2 transition-colors inline-block">            
            {ini.submitter_user_type === "organisation" ? ini.submitter_org : ini.submitter_name}
          </a>
        )}
      </div>

      {ini.problem && (
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{ini.problem}</p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-auto pt-1 border-t border-border">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {ini.locations?.[0] && (
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s-8-4.5-8-11.8A8 8 0 0112 2a8 8 0 018 8.2c0 7.3-8 11.8-8 11.8z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              {ini.locations.slice(0, 2).join(", ")}
            </span>
          )}
          {ini.budget && <span>{ini.budget}</span>}
        </div>
        <span className="text-xs text-muted-foreground">
          {ini.eois} EOI{ini.eois !== 1 ? "s" : ""}
        </span>
      </div>

      {ini.partnerships && ini.partnerships.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {ini.partnerships.slice(0, 3).map(p => (
            <span key={p} className="text-[11px] px-2 py-0.5 rounded-full border border-border text-muted-foreground capitalize">
              {PARTNERSHIP_OPTIONS.find(o => o.value === p)?.label ?? p}
            </span>
          ))}
          {(ini.partnerships?.length ?? 0) > 3 && (
            <span className="text-[11px] px-2 py-0.5 rounded-full border border-border text-muted-foreground">
              +{(ini.partnerships?.length ?? 0) - 3} more
            </span>
          )}
        </div>
      )}
    </button>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function DashboardMarketplace() {
  const [initiatives, setInitiatives]     = useState<InitiativeRow[]>([]);
  const { sectors: dynamicSectors, locations: dynamicLocations } = useDynamicOptions(initiatives);
  const [locations, setLocations]     = useState<string[]>([]);
  const [search, setSearch]               = useState("");
  const [showFilters, setShowFilters]     = useState(false);
  const [selected, setSelected]           = useState<InitiativeRow | null>(null);
  const [expressedIds, setExpressedIds]   = useState<Set<string>>(new Set());
  const { user, profile } = useAuth();
  const isFunder = ["philanthropic_foundation", "venture_capital"].includes(profile?.org_type ?? "");
  const isCorporate = ["corporation", "technology_company", "public_sector"].includes(profile?.org_type ?? "");
  const [location] = useLocation();

  const [sectors, setSectors]         = useState<string[]>([]);
  const [budgets, setBudgets]         = useState<string[]>([]);  const [partnerships, setPartnerships] = useState<string[]>([]);

  const activeFilterCount = sectors.length + locations.length + budgets.length + partnerships.length;

  function clearFilters() { setSectors([]); setLocations([]); setBudgets([]); setPartnerships([]); setStartupPipeline(false); }

  async function handleToggleSave(id: string, wasSaved: boolean) {
    if (!user?.id) return;
    if (wasSaved) {
      await supabase.from("saved_initiatives").delete()
        .eq("user_id", user.id).eq("initiative_id", id);
      setSavedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
    } else {
      await supabase.from("saved_initiatives").insert({ user_id: user.id, initiative_id: id });
      setSavedIds(prev => new Set(prev).add(id));
    }
  }

  const [loading, setLoading] = useState(true);
  const [startupPipeline, setStartupPipeline] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from("saved_initiatives")
      .select("initiative_id")
      .eq("user_id", user.id)
      .then(({ data }) => {
        setSavedIds(new Set((data ?? []).map((r: any) => r.initiative_id)));
      });
  }, [user?.id]);

  function toggleStartupPipeline() {
    setStartupPipeline(v => !v);
  }

  useEffect(() => {
    if (!user) return;
    supabase.from("expressions_of_interest").select("initiative_id").eq("user_id", user.id)
      .then(({ data }) => { if (data) setExpressedIds(new Set(data.map(d => d.initiative_id))); });
  }, [user]);

  // Handle deep link separately from data load
  useEffect(() => {
    if (!initiatives.length) return;
    const params = new URLSearchParams(window.location.search);
    const deepId = params.get("initiative");
    if (deepId) {
      const match = initiatives.find(i => i.id === deepId);
      if (match) setSelected(match as InitiativeRow);
    }
  }, [initiatives.length]);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("initiative_requests")
        .select("id,title,sectors,locations,status,eois,created_at,problem,outcome,partnerships,budget,tags,submitter_org,user_id,esg_alignment,specific_ask,stage")
        .in("status", ["published", "closed"])
        .order("created_at", { ascending: false });

      if (data && data.length > 0) {
        // Fetch verification status for submitters
        const userIds = [...new Set((data as any[]).map(i => i.user_id).filter(Boolean))];
        const { data: profiles } = await supabase
          .from("profiles").select("id,is_verified,org_type,full_name,user_type").in("id", userIds);
        const verifiedMap  = new Map((profiles ?? []).map((p: any) => [p.id, p.is_verified]));
       const orgTypeMap   = new Map((profiles ?? []).map((p: any) => [p.id, p.org_type ?? p.user_type]));        const nameMap      = new Map((profiles ?? []).map((p: any) => [p.id, p.full_name]));
        const userTypeMap  = new Map((profiles ?? []).map((p: any) => [p.id, p.user_type]));

        const enriched = (data as any[]).map(ini => ({
          ...ini,
          submitter_is_verified: verifiedMap.get(ini.user_id) ?? false,
          submitter_org_type:    orgTypeMap.get(ini.user_id) ?? null,
          submitter_name:        nameMap.get(ini.user_id) ?? null,
          submitter_user_type:   userTypeMap.get(ini.user_id) ?? null,
        }));

        setInitiatives(enriched as InitiativeRow[]);
      }
      setLoading(false);
    }
    load();
  }, []);

  const filtered = initiatives.filter(ini => {
    if (showSaved && !savedIds.has(ini.id)) return false;
    if (startupPipeline) {
      const isStartupType = ["startup", "social_enterprise", "technology_company"].includes(ini.submitter_org_type ?? "");
      const isEarlyStage = ["concept", "pilot"].includes(ini.stage ?? "");
      const isSeeking = ["seeking_co_funding", "partially_funded"].includes((ini as any).co_funding_status ?? "");
      if (!isStartupType || (!isEarlyStage && !isSeeking)) return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      const hit = ini.title?.toLowerCase().includes(q) || ini.problem?.toLowerCase().includes(q) ||
        ini.locations?.some(l => l.toLowerCase().includes(q)) || ini.submitter_org?.toLowerCase().includes(q);
      if (!hit) return false;
    }
    if (sectors.length > 0 && !sectors.some(s => ini.sectors?.some(x => x.toLowerCase().includes(s.toLowerCase())))) return false;
    if (locations.length > 0 && !locations.some(l => ini.locations?.some(x => x.toLowerCase().includes(l.toLowerCase())))) return false;
    if (budgets.length > 0 && !budgets.some(b => budgetMatches(ini.budget, b))) return false;
    if (partnerships.length > 0 && !partnerships.some(p => ini.partnerships?.includes(p))) return false;
    return true;
  });

  if (selected) {
    return (
      <MarketplaceDetail
        initiative={selected}
        expressed={expressedIds.has(selected.id)}
        onBack={() => setSelected(null)}
        onExpressed={(id) => {
          setExpressedIds(prev => new Set([...prev, id]));
          setSelected(prev => prev ? { ...prev, eois: (prev.eois ?? 0) + 1 } : prev);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Published initiatives open for partnership and collaboration.</p>
        <button type="button" onClick={() => setShowCreateModal(true)}
          className="rounded-full h-9 px-5 bg-[#2D6A4F] hover:bg-[#245c43] text-white text-sm font-medium transition-colors shrink-0">
          + Create Initiative
        </button>
      </div>

      {isFunder && (
        <div className="flex gap-2">
          <button type="button" onClick={toggleStartupPipeline}
            className={`h-8 px-4 rounded-full border text-xs font-medium transition-colors flex items-center gap-1.5 ${
              startupPipeline
                ? "bg-[#2D6A4F] border-[#2D6A4F] text-white"
                : "border-border text-muted-foreground hover:border-[#2D6A4F]/40 hover:text-[#2D6A4F]"
            }`}>
            <Sparkles className="w-3 h-3" />
            Startup pipeline
          </button>
          <button type="button" onClick={clearFilters}
            className="h-8 px-4 rounded-full border border-border text-xs text-muted-foreground hover:text-foreground transition-colors">
            All initiatives
          </button>
        </div>
      )}

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder="Search by title, problem, location..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors" />
          {search && (
            <button type="button" onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <button type="button" onClick={() => setShowFilters(v => !v)}
          className={`h-10 px-4 rounded-lg border text-sm flex items-center gap-2 transition-colors shrink-0 ${
            showFilters || activeFilterCount > 0
              ? "border-[#2D6A4F] text-[#2D6A4F] bg-[#eaf5ee]"
              : "border-border text-muted-foreground hover:border-foreground/30"
          }`}>
          <SlidersHorizontal className="w-4 h-4" />
          Filters
          {activeFilterCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-[#2D6A4F] text-white text-[10px] flex items-center justify-center font-bold">
              {activeFilterCount}
            </span>
          )}
        </button>
        <button type="button" onClick={() => setShowSaved(v => !v)}
          className={`h-10 px-4 rounded-lg border text-sm flex items-center gap-2 transition-colors shrink-0 ${
            showSaved
              ? "border-[#2D6A4F] text-[#2D6A4F] bg-[#eaf5ee]"
              : "border-border text-muted-foreground hover:border-foreground/30"
          }`}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill={showSaved ? "#2D6A4F" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>
          Saved
          {savedIds.size > 0 && (
            <span className="w-4 h-4 rounded-full bg-[#2D6A4F] text-white text-[10px] flex items-center justify-center font-bold">
              {savedIds.size}
            </span>
          )}
        </button>
      </div>

      {showFilters && (
        <FilterPanel
          sectors={sectors} setSectors={setSectors}
          locations={locations} setLocations={setLocations}
          budgets={budgets} setBudgets={setBudgets}
          partnerships={partnerships} setPartnerships={setPartnerships}
          onClear={clearFilters} activeCount={activeFilterCount}
          sectorOptions={dynamicSectors} locationOptions={dynamicLocations}
        />
      )}

      {activeFilterCount > 0 && !showFilters && (
        <div className="flex flex-wrap gap-2 items-center">
          {[
            ...sectors, ...locations,
            ...budgets.map(b => BUDGET_OPTIONS.find(o => o.value === b)?.label ?? b),
            ...partnerships.map(p => PARTNERSHIP_OPTIONS.find(o => o.value === p)?.label ?? p),
          ].map(chip => (
            <span key={chip} className="inline-flex items-center gap-1 h-7 px-3 rounded-full text-xs bg-[#eaf5ee] text-[#2D6A4F] border border-[#2D6A4F]/20">
              {chip}
            </span>
          ))}
          <button type="button" onClick={clearFilters} className="text-xs text-muted-foreground hover:text-foreground underline">
            Clear all
          </button>
        </div>
      )}

      {!loading && (
        <p className="text-xs text-muted-foreground">
          {filtered.length} initiative{filtered.length !== 1 ? "s" : ""}
          {showSaved ? " saved" : activeFilterCount > 0 ? " matching filters" : ""}
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-5 h-5 text-[#2D6A4F] animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center">
          <p className="text-foreground font-medium mb-2">
            {initiatives.length === 0 ? "No initiatives published yet." : "No results for those filters."}
          </p>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            {initiatives.length === 0 ? "Check back soon." : "Try adjusting your filters or search term."}
          </p>
          {activeFilterCount > 0 && (
            <button type="button" onClick={() => { clearFilters(); setSearch(""); }}
              className="mt-5 text-sm text-primary hover:underline">
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filtered.map(ini => (
            <InitiativeCard key={ini.id} ini={ini}
              saved={savedIds.has(ini.id)}
              onToggleSave={handleToggleSave}
              expressed={expressedIds.has(ini.id)}
              onClick={() => setSelected(ini)} />
          ))}
        </div>
      )}
    <CreateInitiativeModalDashboard
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {}}
      />
    </div>
  );
}


// ─── Marketplace Detail — Premium full view ─────────────────────────────────
// Drop this in to replace the existing MarketplaceDetail function in DashboardMarketplace.tsx

function MarketplaceDetail({ initiative, onBack, expressed, onExpressed }: {
  initiative: InitiativeRow;
  onBack: () => void;
  expressed: boolean;
  onExpressed: (id: string) => void;
}) {
  const { user, profile } = useAuth();
  const [eoiOpen, setEoiOpen]                   = useState(false);
  const [partnershipTypes, setPartnershipTypes] = useState<string[]>([]);
  const [esgAdoption, setEsgAdoption]           = useState(false);
  const [message, setMessage]                   = useState("");
  const [aiMessageLoading, setAiMessageLoading] = useState(false);
  const [aiMessageFailed, setAiMessageFailed]   = useState(false);
  const [submitting, setSubmitting]             = useState(false);
  const [submitted, setSubmitted]               = useState(false);
  const [eoiError, setEoiError]                 = useState<string | null>(null);
  const [alreadyExpressed, setAlreadyExpressed] = useState(expressed);
  const [quickSubmitting, setQuickSubmitting]   = useState(false);
  const [quickSubmitted, setQuickSubmitted]     = useState(false);
 const [quickEsgIntent, setQuickEsgIntent]     = useState(false);
  const [questionOpen, setQuestionOpen]         = useState(false);
  const [question, setQuestion]                 = useState("");
  const [questionSubmitting, setQuestionSubmitting] = useState(false);
  const [questionSubmitted, setQuestionSubmitted]   = useState(false);  const [dealMemo, setDealMemo]                 = useState<any | null>(null);
  const [loadingMemo, setLoadingMemo]           = useState(false);
  const [memoOpen, setMemoOpen]                 = useState(false);
  const [funderMandate, setFunderMandate]       = useState<any | null>(null);
  const [csrBrief, setCsrBrief]                 = useState<any | null>(null);
  const [loadingCsr, setLoadingCsr]             = useState(false);
  const [csrOpen, setCsrOpen]                   = useState(false);
  const [csrMandate, setCsrMandate]             = useState<any | null>(null);
  const [passOpen, setPassOpen]                 = useState(false);
  const [passReason, setPassReason]             = useState("");
  const [passed, setPassed]                     = useState(false);
  const [saved, setSavedMemo]                   = useState(false);

  // Full detail fields fetched separately
  const [fullDetail, setFullDetail] = useState<{
    target_population?: string | null;
    specific_ask?: string | null;
    stage?: string | null;
    confirmed_assets?: string[] | null;
    had_prior_experience?: boolean | null;
    prior_experience_detail?: string | null;
    start_date?: string | null;
    duration?: string | null;
    sdg_tags?: string[] | null;
    detail_content?: string | null;
    resource_link?: string | null;
    co_funding_status?: string | null;
    ai_quality_score?: string | null;
    target_beneficiaries?: number | null;
    target_jobs?: number | null;
    target_female_pct?: number | null;
    target_timeline_months?: number | null;
    impact_evidence?: string | null;
  } | null>(null);

  const isOwnInitiative = !!user && initiative.user_id === user.id;

  useEffect(() => {
    if (!user || expressed) return;
    supabase.from("expressions_of_interest").select("id,partnership_type")
      .eq("initiative_id", initiative.id).eq("user_id", user.id).maybeSingle()
      .then(({ data }) => { if (data && data.partnership_type !== "question") setAlreadyExpressed(true); });
  }, [user, initiative.id]);

  // Fetch full detail fields
  useEffect(() => {
    supabase.from("initiative_requests")
      .select("target_population,specific_ask,stage,confirmed_assets,had_prior_experience,prior_experience_detail,start_date,duration,sdg_tags,detail_content,resource_link,co_funding_status,ai_quality_score,target_beneficiaries,target_jobs,target_female_pct,target_timeline_months,impact_evidence")
      .eq("id", initiative.id).single()
      .then(({ data }) => { if (data) setFullDetail(data); });
  }, [initiative.id]);

  // Load funder mandate if user is a funder
  const isFunder = ["philanthropic_foundation", "venture_capital"].includes(profile?.org_type ?? "");
  const isCorporate = ["corporation", "technology_company", "public_sector"].includes(profile?.org_type ?? "");
  
  useEffect(() => {
    if (!isFunder || !user?.id) return;
    supabase.from("organizations")
      .select("grant_range_min,grant_range_max,grant_currency,funding_instruments,geographic_focus,stage_preference,mandate_sectors,mandate_sdgs")
      .eq("user_id", user.id).single()
      .then(({ data }) => { if (data) setFunderMandate(data); });
  }, [user?.id, isFunder]);

  useEffect(() => {
    if (!isCorporate || !user?.id) return;
    supabase.from("organizations")
      .select("esg_frameworks,csr_budget_range,geographic_focus,mandate_sectors,mandate_sdgs,partner_type_preference,org_type")
      .eq("user_id", user.id).single()
      .then(({ data }) => { if (data) setCsrMandate({ ...data, org_type: profile?.org_type }); });
  }, [user?.id, isCorporate]);

  const [initiativeOrgDd, setInitiativeOrgDd] = useState<any | null>(null);

  useEffect(() => {
    if (!initiative.user_id) return;
    supabase.from("organizations")
      .select("dd_financial_model,dd_audited_accounts,dd_governance_doc,dd_esg_assessment,dd_impact_framework")
      .eq("user_id", initiative.user_id).single()
      .then(({ data }) => { if (data) setInitiativeOrgDd(data); });
  }, [initiative.user_id]);

  async function submitQuestion() {
    if (!question.trim() || !user?.id || !initiative.user_id) return;
    setQuestionSubmitting(true);
    try {
      // Check for existing question conversation
      const { data: existing } = await supabase
        .from("conversations")
        .select("id")
        .eq("initiative_id", initiative.id)
        .eq("conversation_type", "question")
        .eq("initiative_owner_id", initiative.user_id)
        .in("id", (await supabase
          .from("conversation_participants")
          .select("conversation_id")
          .eq("user_id", user.id)
          .then(r => (r.data ?? []).map((p: any) => p.conversation_id))
        ))
        .maybeSingle();

      let conversationId = existing?.id;

      if (!conversationId) {
        const { data: newConvoId } = await supabase.rpc("create_conversation", {
          p_initiative_id: initiative.id,
          p_owner_id: initiative.user_id,
        });
        conversationId = newConvoId;
        if (conversationId) {
          await supabase.from("conversation_participants").insert([
            { conversation_id: conversationId, user_id: user.id },
            { conversation_id: conversationId, user_id: initiative.user_id },
          ]);
          await supabase.from("conversations").update({
            status: "open",
            conversation_type: "question",
          }).eq("id", conversationId);
        }
      }

      if (conversationId) {
        await supabase.from("messages").insert({
          conversation_id: conversationId,
          sender_id: user.id,
          body: question.trim(),
        });
        await supabase.from("notifications").insert({
          user_id: initiative.user_id,
          type: "question_received",
          title: "A funder has a question about your initiative",
          body: `"${question.trim().slice(0, 100)}${question.trim().length > 100 ? "..." : ""}"`,
          link: "/dashboard/messages",
        });
      }
      setQuestionSubmitted(true);
      setQuestionOpen(false);
    } catch {
      // silent
    }
    setQuestionSubmitting(false);
  }
      

  async function generateAiMessage() {
    setAiMessageLoading(true);
    setAiMessageFailed(false);
    try {
      const { data: ep } = await supabase.from("profiles").select("full_name,org_name,user_type,sectors").eq("id", user!.id).single();
      const { data: orgRow } = await supabase.from("organizations").select("description,offers").eq("user_id", user!.id).maybeSingle();
      const expresserName = ep?.user_type === "organisation" && ep?.org_name ? ep.org_name : ep?.full_name ?? "Us";
      const { data: ownerProfile } = await supabase
        .from("profiles").select("full_name,org_name,user_type")
        .eq("id", initiative.user_id).maybeSingle();
      const ownerName = ownerProfile?.user_type === "organisation"
        ? (ownerProfile?.org_name ?? ownerProfile?.full_name)
        : ownerProfile?.full_name;

      const { data, error } = await supabase.functions.invoke("generate-funder-intro", {
        body: {
          expresser_name: expresserName, expresser_org: ep?.org_name ?? null,
          expresser_description: orgRow?.description ?? null,
          expresser_sectors: ep?.sectors ?? [], expresser_offers: orgRow?.offers ?? [],
          initiative_title: initiative.title, initiative_problem: initiative.problem ?? null,
          initiative_outcome: initiative.outcome ?? null, initiative_sectors: initiative.sectors ?? [],
          esg_intent: false, initiative_owner_name: ownerName ?? null,
        },
      });
      if (!error && data?.message) {
        setMessage(data.message);
      } else {
        setAiMessageFailed(true);
      }
    } catch {
      setAiMessageFailed(true);
    }
    setAiMessageLoading(false);
  }

  async function saveFunderDecision(decision: "pass" | "save" | "interest", reason?: string) {
    if (!user?.id) return;
    await supabase.from("funder_decisions").upsert({
      funder_id: user.id,
      initiative_id: initiative.id,
      decision,
      reason: reason ?? null,
    }, { onConflict: "funder_id,initiative_id" });
  }

  async function generateCsrBrief() {
    setLoadingCsr(true);
    setCsrOpen(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const res = await fetch(`${supabaseUrl}/functions/v1/generate-csr-brief`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initiative: { ...initiative, ...fullDetail },
          csr_mandate: csrMandate,
          dd_readiness: initiativeOrgDd ? {
            financial_model: initiativeOrgDd.dd_financial_model,
            audited_accounts: initiativeOrgDd.dd_audited_accounts,
            governance_doc: initiativeOrgDd.dd_governance_doc,
            esg_assessment: initiativeOrgDd.dd_esg_assessment,
            impact_framework: initiativeOrgDd.dd_impact_framework,
            score: Math.round(
              ([initiativeOrgDd.dd_financial_model, initiativeOrgDd.dd_audited_accounts, initiativeOrgDd.dd_governance_doc, initiativeOrgDd.dd_esg_assessment, initiativeOrgDd.dd_impact_framework].filter(Boolean).length / 5) * 100
            ),
          } : null,
        }),
      });
      const result = await res.json();
      if (result.data) setCsrBrief(result.data);
    } catch {
      // silent
    }
    setLoadingCsr(false);
  }

  async function generateDealMemo() {
    setLoadingMemo(true);
    setMemoOpen(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const res = await fetch(`${supabaseUrl}/functions/v1/generate-deal-memo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initiative: {
            ...initiative,
            ...fullDetail,
          },
          mandate: funderMandate,
          dd_readiness: initiativeOrgDd ? {
            financial_model: initiativeOrgDd.dd_financial_model,
            audited_accounts: initiativeOrgDd.dd_audited_accounts,
            governance_doc: initiativeOrgDd.dd_governance_doc,
            esg_assessment: initiativeOrgDd.dd_esg_assessment,
            impact_framework: initiativeOrgDd.dd_impact_framework,
            score: Math.round(
              ([initiativeOrgDd.dd_financial_model, initiativeOrgDd.dd_audited_accounts, initiativeOrgDd.dd_governance_doc, initiativeOrgDd.dd_esg_assessment, initiativeOrgDd.dd_impact_framework].filter(Boolean).length / 5) * 100
            ),
          } : null,
        }),
      });
      const result = await res.json();
      if (result.data) setDealMemo(result.data);
    } catch {
      // silent
    }
    setLoadingMemo(false);
  }

  const STAGE_LABELS: Record<string, string> = {    concept: "Concept — idea defined, no funding yet",
    planning: "Planning — funded, building implementation plan",
    active: "Active — currently executing",
    scaling: "Scaling — running successfully, seeking to expand",
  };

  const CO_FUNDING_LABELS: Record<string, string> = {
    seeking_sole_funder:  "Seeking a sole funder",
    open_to_coalition:    "Open to co-funding coalition",
    co_funder_confirmed:  "Co-funder already confirmed",
    fully_funded:         "Fully funded",
    seeking_co_funding:   "Seeking co-funding",
    partially_funded:     "Partially funded",
    seeking_funding:      "Seeking funding",
  };

  const QUALITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    strong: { label: "Strong brief",    color: "#2D6A4F", bg: "#eaf5ee" },
    good:   { label: "Good brief",      color: "#f59e0b", bg: "#fffbeb" },
    basic:  { label: "Developing brief", color: "#C45C26", bg: "#fdf5f2" },
  };

  // ── Transaction-safe EOI submit ────────────────────────────────────────────
  async function submitEOI() {
    if (!user || (partnershipTypes.length === 0 && !esgAdoption)) return;
    setSubmitting(true); setEoiError(null);
    try {
      const combined = [partnershipTypes.join(", "), esgAdoption ? "ESG/CSR Adoption" : ""].filter(Boolean).join(" + ");
      const { data: eoiData, error: eoiErr } = await supabase.from("expressions_of_interest")
        .insert({ initiative_id: initiative.id, user_id: user.id, partnership_type: combined, message: message || null, esg_adoption: esgAdoption })
        .select("id").single();
      if (eoiErr) { setEoiError(eoiErr.code === "23505" ? "You've already expressed interest in this initiative." : eoiErr.message); return; }
      await supabase.rpc("increment_eoi_count", { p_initiative_id: initiative.id });
      const { data: convoResult, error: convoError } = await supabase.rpc("create_conversation", { p_initiative_id: initiative.id, p_owner_id: initiative.user_id ?? null });
      if (convoError || !convoResult) { setEoiError(`Failed to create conversation: ${convoError?.message ?? "unknown"}`); return; }
      const convoId = convoResult as string;
      await Promise.all([
        supabase.from("expressions_of_interest").update({ conversation_id: convoId }).eq("id", eoiData.id),
        supabase.from("conversation_participants").insert([
          { conversation_id: convoId, user_id: user.id },
          ...(initiative.user_id && initiative.user_id !== user.id ? [{ conversation_id: convoId, user_id: initiative.user_id }] : []),
        ]),
        supabase.from("messages").insert({ conversation_id: convoId, sender_id: user.id, body: `${combined} interest expressed${message ? `: "${message}"` : "."}` }),
      ]);
      if (initiative.user_id && initiative.user_id !== user.id) {
        const { data: ep } = await supabase.from("profiles").select("full_name,org_name,user_type").eq("id", user.id).single();
        const name = ep?.user_type === "organisation" && ep?.org_name ? ep.org_name : ep?.full_name ?? "Someone";
        await supabase.from("notifications").insert({ user_id: initiative.user_id, type: "eoi_received", title: "New expression of interest", body: `${name} expressed ${combined} interest in "${initiative.title}"`, link: "/dashboard/messages" });
      }
      setSubmitted(true); setAlreadyExpressed(true); onExpressed(initiative.id);
    } finally { setSubmitting(false); }
  }

  // ── One-click interest ─────────────────────────────────────────────────────
  async function submitQuickInterest() {
    if (!user || alreadyExpressed || quickSubmitting) return;
    setQuickSubmitting(true);
    try {
      const { data: ep } = await supabase.from("profiles").select("full_name,org_name,user_type,sectors").eq("id", user.id).single();
      const { data: orgRow } = await supabase.from("organizations").select("description,offers").eq("user_id", user.id).maybeSingle();
      const { data: ownerProfile } = await supabase.from("profiles").select("full_name,org_name,user_type").eq("id", initiative.user_id).maybeSingle();
      const expresserName = ep?.user_type === "organisation" && ep?.org_name ? ep.org_name : ep?.full_name ?? "Someone";
      const ownerName = ownerProfile?.user_type === "organisation" && ownerProfile?.org_name ? ownerProfile.org_name : ownerProfile?.full_name ?? null;      let aiMessage = "";
      try {
        const aiRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-funder-intro`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ expresser_name: expresserName, expresser_org: ep?.org_name ?? null, expresser_description: orgRow?.description ?? null, expresser_sectors: ep?.sectors ?? [], expresser_offers: orgRow?.offers ?? [], initiative_title: initiative.title, initiative_problem: initiative.problem ?? null, initiative_outcome: initiative.outcome ?? null, initiative_sectors: initiative.sectors ?? [], esg_intent: quickEsgIntent }),
        });
        const aiData = await aiRes.json();
        if (aiData.message) aiMessage = aiData.message;
      } catch { /* silent */ }
      const { data: eoiData, error: eoiErr } = await supabase.from("expressions_of_interest")
        .insert({ initiative_id: initiative.id, user_id: user.id, partnership_type: "interest", message: aiMessage || null, esg_adoption: quickEsgIntent })
        .select("id").single();
      if (eoiErr && eoiErr.code !== "23505") { setQuickSubmitting(false); return; }
      if (!eoiErr && eoiData) {
        await supabase.rpc("increment_eoi_count", { p_initiative_id: initiative.id });
        const { data: convoResult } = await supabase.rpc("create_conversation", { p_initiative_id: initiative.id, p_owner_id: initiative.user_id ?? null });
        if (convoResult) {
          const convoId = convoResult as string;
          await Promise.all([
            supabase.from("expressions_of_interest").update({ conversation_id: convoId }).eq("id", eoiData.id),
            supabase.from("conversation_participants").insert([
              { conversation_id: convoId, user_id: user.id },
              ...(initiative.user_id && initiative.user_id !== user.id ? [{ conversation_id: convoId, user_id: initiative.user_id }] : []),
            ]),
            supabase.from("messages").insert({ conversation_id: convoId, sender_id: user.id, body: aiMessage || `Hi${ownerName ? ` ${ownerName}` : ""}, I'm ${expresserName}${ep?.org_name && ep.user_type === "organisation" ? ` from ${ep.org_name}` : ""}. I came across "${initiative.title}" on Impact Natives and I'm interested in exploring a partnership. Happy to connect and share more about what we do.` }),          ]);
          if (initiative.user_id && initiative.user_id !== user.id) {
            await supabase.from("notifications").insert({ user_id: initiative.user_id, type: "eoi_received", title: "New expression of interest", body: `${expresserName} expressed interest in "${initiative.title}"`, link: "/dashboard/messages" });
          }
        }
      }
      setQuickSubmitted(true); setAlreadyExpressed(true); onExpressed(initiative.id);
    } finally { setQuickSubmitting(false); }
  }

  const canSubmit = partnershipTypes.length > 0 || esgAdoption;
  const qualityCfg = fullDetail?.ai_quality_score ? QUALITY_CONFIG[fullDetail.ai_quality_score] : null;

  return (
    <div className="space-y-8">
      {/* Back + Deal Memo */}
      <div className="flex items-center justify-between">
        <button type="button" onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Back to marketplace
        </button>
        {isFunder && (
          <button type="button" onClick={generateDealMemo}
            disabled={loadingMemo}
            className="flex items-center gap-2 px-4 py-2 rounded-full border border-[#2D6A4F]/30 bg-[#2D6A4F]/5 text-sm font-medium text-[#2D6A4F] hover:bg-[#2D6A4F]/10 transition-colors disabled:opacity-50">
            {loadingMemo
              ? <><Sparkles className="w-3.5 h-3.5 animate-pulse" />Generating memo...</>
              : <><FileText className="w-3.5 h-3.5" />Generate deal memo</>
            }
          </button>
        )}
        {isCorporate && (
          <button type="button" onClick={generateCsrBrief}
            disabled={loadingCsr}
            className="flex items-center gap-2 px-4 py-2 rounded-full border border-[#2D6A4F]/30 bg-[#2D6A4F]/5 text-sm font-medium text-[#2D6A4F] hover:bg-[#2D6A4F]/10 transition-colors disabled:opacity-50">
            {loadingCsr
              ? <><Sparkles className="w-3.5 h-3.5 animate-pulse" />Generating brief...</>
              : <><FileText className="w-3.5 h-3.5" />CSR adoption brief</>
            }
          </button>
        )}
      </div>

      {/* Deal Memo Panel */}
      {memoOpen && (
        <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#2D6A4F]" />
              <p className="text-sm font-semibold text-foreground">AI Deal Memo</p>
              {dealMemo?.match_score && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{
                    background: dealMemo.match_score >= 70 ? "#eaf5ee" : "#f5f5f5",
                    color: dealMemo.match_score >= 70 ? "#2D6A4F" : "#6b7280",
                  }}>
                  {dealMemo.match_score}% match
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {dealMemo && (
                <button type="button" onClick={generateDealMemo}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Regenerate
                </button>
              )}
              <button type="button" onClick={() => setMemoOpen(false)}
                className="p-1 rounded-full hover:bg-muted transition-colors">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </div>

          {loadingMemo ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : dealMemo ? (
            <div className="space-y-4">
              {/* Headline */}
              <p className="text-sm font-medium text-foreground leading-relaxed">{dealMemo.headline}</p>

              {/* Sections */}
              {[
                { label: "Problem validity", value: dealMemo.problem_validity },
                { label: "Solution fit", value: dealMemo.solution_fit },
                { label: "Team credibility", value: dealMemo.team_credibility },
                { label: "Financial assessment", value: dealMemo.financial_assessment },
                { label: "Mandate alignment", value: dealMemo.mandate_alignment },
              ].map(section => (
                <div key={section.label} className="space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{section.label}</p>
                  <p className="text-sm text-foreground leading-relaxed">{section.value}</p>
                </div>
              ))}

              {/* Risk flags */}
              {dealMemo.risk_flags?.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Risk flags</p>
                  <ul className="space-y-1">
                    {dealMemo.risk_flags.map((flag: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#C45C26] shrink-0 mt-1.5" />
                        {flag}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recommended action */}
              {dealMemo.recommended_action && (
                <div className="rounded-xl border px-4 py-3 space-y-1"
                  style={{
                    borderColor: dealMemo.recommended_action === "Express Interest" ? "#2D6A4F40" : "#C45C2640",
                    background: dealMemo.recommended_action === "Express Interest" ? "#eaf5ee" : "#fdf5f2",
                  }}>
                  <p className="text-xs font-semibold uppercase tracking-wider"
                    style={{ color: dealMemo.recommended_action === "Express Interest" ? "#2D6A4F" : "#C45C26" }}>
                    Recommended: {dealMemo.recommended_action}
                  </p>
                  <p className="text-xs text-muted-foreground">{dealMemo.recommended_action_reason}</p>
                </div>
              )}

              {/* Action buttons */}
              {!passed && !isOwnInitiative ? (
                <div className="pt-2 border-t border-border space-y-3">
                  <div className="flex gap-2 flex-wrap">
                    {/* Ask a question */}
                  {!questionSubmitted && (
                    <button type="button"
                      onClick={() => { setMemoOpen(false); setQuestionOpen(true); }}
                      className="flex-1 rounded-full h-9 border border-[#2D6A4F]/30 text-sm text-[#2D6A4F] hover:bg-[#2D6A4F]/5 transition-colors flex items-center justify-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5" />
                      Ask a question
                    </button>
                  )}

                  {/* Express Interest */}
                  {!alreadyExpressed && !submitted && (
                    <button type="button"
                      onClick={() => { setMemoOpen(false); setEoiOpen(true); saveFunderDecision("interest"); }}
                      className="flex-1 rounded-full h-9 bg-[#2D6A4F] hover:bg-[#245c43] text-white text-sm font-semibold transition-colors">
                      Express Interest
                    </button>
                  )}
                    {(alreadyExpressed || submitted) && (
                      <div className="flex-1 rounded-full h-9 flex items-center justify-center text-sm font-semibold text-[#2D6A4F] bg-[#eaf5ee]">
                        Interest expressed ✓
                      </div>
                    )}

                    {/* Save */}
                    <button type="button"
                      onClick={() => { setSavedMemo(true); saveFunderDecision("save"); }}                      className={`rounded-full h-9 px-4 border text-sm font-medium transition-colors ${
                        saved
                          ? "border-[#2D6A4F] text-[#2D6A4F] bg-[#eaf5ee]"
                          : "border-border text-muted-foreground hover:border-[#2D6A4F]/40"
                      }`}>
                      {saved ? "Saved ✓" : "Save"}
                    </button>

                    {/* Pass */}
                    {!passOpen && (
                      <button type="button"
                        onClick={() => setPassOpen(true)}
                        className="rounded-full h-9 px-4 border border-border text-sm text-muted-foreground hover:border-red-300 hover:text-red-500 transition-colors">
                        Pass
                      </button>
                    )}
                  </div>

                  {/* Pass reason */}
                  {passOpen && (
                    <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Reason for passing</p>
                      <div className="flex flex-wrap gap-2">
                        {["Too early stage", "Outside mandate", "Budget mismatch", "Geography mismatch", "Team concerns", "Other"].map(reason => (
                          <button key={reason} type="button"
                            onClick={() => setPassReason(reason)}
                            className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
                              passReason === reason
                                ? "bg-[#C45C26] border-[#C45C26] text-white"
                                : "border-border text-muted-foreground hover:border-foreground/30"
                            }`}>
                            {reason}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setPassOpen(false)}
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                          Cancel
                        </button>
                        <button type="button"
                          disabled={!passReason}
                          onClick={() => { setPassed(true); setPassOpen(false); saveFunderDecision("pass", passReason); }}
                          className="ml-auto rounded-full h-8 px-4 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold disabled:opacity-40 transition-colors">
                          Confirm pass
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (!isOwnInitiative && (
                <div className="pt-2 border-t border-border flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Passed · <span className="text-foreground">{passReason}</span>
                  </p>
                  <button type="button"
                    onClick={() => { setPassed(false); setPassReason(""); }}
                    className="text-xs text-[#2D6A4F] hover:underline underline-offset-2">
                    Undo
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Failed to generate memo. Try again.</p>
          )}
        </div>
      )}

      {/* CSR Brief Panel */}
      {csrOpen && (
        <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#2D6A4F]" />
              <p className="text-sm font-semibold text-foreground">CSR Adoption Brief</p>
              {csrBrief?.match_score && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{
                    background: csrBrief.match_score >= 70 ? "#eaf5ee" : "#f5f5f5",
                    color: csrBrief.match_score >= 70 ? "#2D6A4F" : "#6b7280",
                  }}>
                  {csrBrief.match_score}% CSR fit
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {csrBrief && (
                <button type="button" onClick={generateCsrBrief}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />Regenerate
                </button>
              )}
              <button type="button" onClick={() => setCsrOpen(false)}
                className="p-1 rounded-full hover:bg-muted transition-colors">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </div>

          {loadingCsr ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : csrBrief ? (
            <div className="space-y-4">
              <p className="text-sm font-medium text-foreground leading-relaxed">{csrBrief.headline}</p>

              {[
                { label: "SDG alignment",               value: csrBrief.sdg_alignment },
                { label: "Local content",               value: csrBrief.local_content },
                { label: "Brand fit",                   value: csrBrief.brand_fit },
                { label: "ESG framework match",         value: csrBrief.esg_framework_match },
                { label: "Partnership options",         value: csrBrief.partnership_options },
                { label: "Reputational considerations", value: csrBrief.reputational_considerations },
                { label: "Implementer readiness",       value: csrBrief.implementer_readiness },
              ].map(section => (
                <div key={section.label} className="space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{section.label}</p>
                  <p className="text-sm text-foreground leading-relaxed">{section.value}</p>
                </div>
              ))}

              {csrBrief.risk_flags?.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Risk flags</p>
                  <ul className="space-y-1">
                    {csrBrief.risk_flags.map((flag: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#C45C26] shrink-0 mt-1.5" />
                        {flag}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {csrBrief.recommended_action && (
                <div className="rounded-xl border px-4 py-3 space-y-1"
                  style={{
                    borderColor: csrBrief.recommended_action === "Adopt as CSR programme" ? "#2D6A4F40" : "#C45C2640",
                    background: csrBrief.recommended_action === "Adopt as CSR programme" ? "#eaf5ee" : "#fdf5f2",
                  }}>
                  <p className="text-xs font-semibold uppercase tracking-wider"
                    style={{ color: csrBrief.recommended_action === "Adopt as CSR programme" ? "#2D6A4F" : "#C45C26" }}>
                    Recommended: {csrBrief.recommended_action}
                  </p>
                  <p className="text-xs text-muted-foreground">{csrBrief.recommended_action_reason}</p>
                </div>
              )}

              {!isOwnInitiative && !alreadyExpressed && !quickSubmitted && (
                <div className="pt-2 border-t border-border">
                  <button type="button"
                    onClick={() => { setCsrOpen(false); setEoiOpen(true); }}
                    className="w-full rounded-full h-9 bg-[#2D6A4F] hover:bg-[#245c43] text-white text-sm font-semibold transition-colors">
                    Express Interest
                  </button>
                </div>
              )}
              {(alreadyExpressed || quickSubmitted) && (
                <div className="pt-2 border-t border-border flex items-center justify-center gap-2 text-sm text-[#2D6A4F]">
                  <CheckCircle2 className="w-4 h-4" />
                  Interest expressed
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Failed to generate brief. Try again.</p>
          )}
        </div>
      )}

      {/* ── Hero block ── */}

      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        {/* Sector tags + ESG + verified */}
        <div className="flex flex-wrap gap-1.5">
          {initiative.sectors?.map(s => (
            <span key={s} className="text-xs font-medium px-2.5 py-0.5 rounded-full"
              style={{ background: "#f5ede8", color: "#C45C26" }}>{s}</span>
          ))}
          {initiative.esg_alignment && (
            <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full"
              style={{ background: "#e8f5e9", color: "#2e7d32" }}>
              <Leaf className="w-3 h-3" />ESG/CSR Friendly
            </span>
          )}
          {initiative.submitter_is_verified && (
            <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full"
              style={{ background: "#eaf5ee", color: "#2D6A4F" }}>
              <VerifiedBadge />            </span>
          )}
          {qualityCfg && (
            <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full"
              style={{ background: qualityCfg.bg, color: qualityCfg.color }}>
              {qualityCfg.label}
            </span>
          )}
        </div>

        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight leading-snug">{initiative.title}</h2>
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
            {(initiative.submitter_org || initiative.submitter_name) && (
              <a
                href={
                  initiative.submitter_user_type === "organisation"
                    ? `/dashboard/natives?tab=organisation&user=${initiative.user_id}`
                    : `/dashboard/natives?tab=individual&user=${initiative.user_id}`
                }
                onClick={e => e.stopPropagation()}
                className="font-medium text-foreground/70 hover:text-[#2D6A4F] hover:underline underline-offset-2 transition-colors">
                {initiative.submitter_user_type === "organisation"
                  ? initiative.submitter_org
                  : initiative.submitter_name}
              </a>
            )}
            <span>{initiative.eois} expression{initiative.eois !== 1 ? "s" : ""} of interest</span>
            <span>{new Date(initiative.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
          </div>
        </div>

        {/* Meta grid */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: "Location", value: initiative.locations?.join(", ") || "—" },
            { label: "Budget",   value: initiative.budget || "—" },
            { label: "Stage",    value: fullDetail?.stage ? STAGE_LABELS[fullDetail.stage]?.split(" — ")[0] ?? fullDetail.stage : "—" },
            { label: "Duration", value: fullDetail?.duration || "—" },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl border border-border bg-background px-3 py-2.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">{label}</p>
              <p className="text-sm font-medium text-foreground">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Problem & Outcome ── */}
      {(initiative.problem || initiative.outcome) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {initiative.problem && (
            <div className="rounded-xl border border-border bg-card px-5 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Problem</p>
              <p className="text-sm text-foreground leading-relaxed">{initiative.problem}</p>
            </div>
          )}
          {initiative.outcome && (
            <div className="rounded-xl border border-border bg-card px-5 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Expected Outcome</p>
              <p className="text-sm text-foreground leading-relaxed">{initiative.outcome}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Target population ── */}
      {fullDetail?.target_population && (
        <div className="rounded-xl border border-border bg-card px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Who this serves</p>
          <p className="text-sm text-foreground leading-relaxed">{fullDetail.target_population}</p>
        </div>
      )}

      {/* ── Target impact metrics ── */}
      {(fullDetail?.target_beneficiaries || fullDetail?.target_jobs || fullDetail?.target_female_pct || fullDetail?.target_timeline_months) && (
        <div className="rounded-xl border border-border bg-card px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Target impact metrics</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {fullDetail.target_beneficiaries && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Beneficiaries</p>
                <p className="text-sm font-semibold text-foreground">{fullDetail.target_beneficiaries.toLocaleString()}</p>
              </div>
            )}
            {fullDetail.target_jobs && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Jobs</p>
                <p className="text-sm font-semibold text-foreground">{fullDetail.target_jobs.toLocaleString()}</p>
              </div>
            )}
            {fullDetail.target_female_pct && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Female %</p>
                <p className="text-sm font-semibold text-foreground">{fullDetail.target_female_pct}%</p>
              </div>
            )}
            {fullDetail.target_timeline_months && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Timeline</p>
                <p className="text-sm font-semibold text-foreground">{fullDetail.target_timeline_months} months</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Impact evidence ── */}
      {fullDetail?.impact_evidence && (
        <div className="rounded-xl border border-border bg-card px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Impact evidence</p>
          <p className="text-sm text-foreground leading-relaxed">{fullDetail.impact_evidence}</p>
        </div>
      )}

      {/* ── Specific ask ── */}
      {fullDetail?.specific_ask && (
        <div className="rounded-xl border border-[#2D6A4F]/20 bg-[#2D6A4F]/5 px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#2D6A4F] mb-2">Specific ask</p>
          <p className="text-sm text-foreground leading-relaxed">{fullDetail.specific_ask}</p>
        </div>
      )}

      {/* ── Partnerships sought ── */}
      {initiative.partnerships && initiative.partnerships.length > 0 && (
        <div className="rounded-xl border border-border bg-card px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Partnerships sought</p>
          <div className="flex flex-wrap gap-2">
            {initiative.partnerships.map(p => (
              <span key={p} className="px-3 py-1 rounded-full text-xs font-medium border border-border text-foreground capitalize">
                {PARTNERSHIP_OPTIONS.find(o => o.value === p)?.label ?? p}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Stage & confirmed assets ── */}
      {(fullDetail?.stage || fullDetail?.confirmed_assets?.length) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {fullDetail?.stage && (
            <div className="rounded-xl border border-border bg-card px-5 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Current stage</p>
              <p className="text-sm text-foreground">{STAGE_LABELS[fullDetail.stage] ?? fullDetail.stage}</p>
            </div>
          )}
          {fullDetail?.confirmed_assets && fullDetail.confirmed_assets.length > 0 && !fullDetail.confirmed_assets.includes("none") && (
            <div className="rounded-xl border border-border bg-card px-5 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Already confirmed</p>
              <div className="flex flex-wrap gap-1.5">
                {fullDetail.confirmed_assets.filter(a => a !== "none").map(a => (
                  <span key={a} className="text-xs px-2.5 py-0.5 rounded-full border border-border text-muted-foreground capitalize">
                    {a.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Timeline ── */}
      {(fullDetail?.start_date || fullDetail?.duration) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {fullDetail.start_date && (
            <div className="rounded-xl border border-border bg-card px-5 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Estimated start</p>
              <p className="text-sm text-foreground">{fullDetail.start_date}</p>
            </div>
          )}
          {fullDetail.duration && (
            <div className="rounded-xl border border-border bg-card px-5 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Duration</p>
              <p className="text-sm text-foreground">{fullDetail.duration}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Co-funding status ── */}
      {fullDetail?.co_funding_status && (
        <div className="rounded-xl border border-border bg-card px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Funding status</p>
          <p className="text-sm text-foreground">{CO_FUNDING_LABELS[fullDetail.co_funding_status] ?? fullDetail.co_funding_status}</p>
        </div>
      )}

      {/* ── Prior experience ── */}
      {fullDetail?.had_prior_experience !== null && fullDetail?.had_prior_experience !== undefined && (
        <div className="rounded-xl border border-border bg-card px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Track record</p>
          <p className="text-sm text-foreground mb-2">
            {fullDetail.had_prior_experience ? "The team has led similar initiatives before." : "This is a first initiative of this type for the team."}
          </p>
          {fullDetail.prior_experience_detail && (
            <p className="text-sm text-muted-foreground leading-relaxed italic">"{fullDetail.prior_experience_detail}"</p>
          )}
        </div>
      )}

      {/* ── SDG alignment ── */}
      {fullDetail?.sdg_tags && fullDetail.sdg_tags.length > 0 && (
        <div className="rounded-xl border border-border bg-card px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">SDG Alignment</p>
          <div className="flex flex-wrap gap-1.5">
            {fullDetail.sdg_tags.map(s => (
              <span key={s} className="text-xs px-2.5 py-0.5 rounded-full font-medium"
                style={{ background: "#eaf5ee", color: "#2D6A4F" }}>{s}</span>
            ))}
          </div>
        </div>
      )}

      {/* ── Full description ── */}
      {fullDetail?.detail_content && fullDetail.detail_content !== "<p></p>" && (
        <div className="rounded-xl border border-border bg-card px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Full initiative description
            </p>
            <button
              type="button"
              onClick={() => {
  const content = fullDetail.detail_content ?? "";
  const orgName = initiative.submitter_org ?? "";
  const date = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${initiative.title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Georgia, serif; font-size: 11pt; line-height: 1.7; color: #111; padding: 48px 64px; max-width: 800px; margin: 0 auto; }
    h1 { font-size: 20pt; font-weight: bold; margin-bottom: 4px; }
    .meta { font-size: 9pt; color: #555; margin-bottom: 32px; padding-bottom: 12px; border-bottom: 1px solid #ccc; }
    h2 { font-size: 13pt; font-weight: bold; margin-top: 28px; margin-bottom: 6px; color: #2D6A4F; border-bottom: 1px solid #e0e0e0; padding-bottom: 4px; }
    h3 { font-size: 11pt; font-weight: bold; margin-top: 16px; margin-bottom: 4px; }
    p { margin-bottom: 10px; }
    ul { padding-left: 20px; margin-bottom: 10px; }
    li { margin-bottom: 4px; }
    .footer { margin-top: 48px; padding-top: 12px; border-top: 1px solid #ccc; font-size: 8pt; color: #999; }
    @media print { @page { margin: 20mm; size: A4; } }
  </style>
</head>
<body>
  <h1>${initiative.title}</h1>
  <div class="meta">${orgName ? orgName + " · " : ""}${initiative.locations?.join(", ") ?? ""}${initiative.budget ? " · Budget: " + initiative.budget : ""} · Impact Natives</div>
  ${content}
  <div class="footer">Impact Natives · app.impactnatives.com · Downloaded ${date}</div>
  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`);
  win.document.close();
}}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#2D6A4F] hover:underline underline-offset-2 transition-colors"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Download as PDF
            </button>
          </div>
          <div className="concept-note-prose max-w-none"
            dangerouslySetInnerHTML={{ __html: fullDetail.detail_content }} />
        </div>
      )}

      {/* Hidden print container — only visible when printing */}
      {fullDetail?.detail_content && fullDetail.detail_content !== "<p></p>" && (
        <div id="concept-note-print" style={{ display: "none" }}>
          <h1>{initiative.title}</h1>
          <div className="cn-meta">
            {initiative.submitter_org && <span>{initiative.submitter_org} · </span>}
            {initiative.locations?.join(", ")}
            {initiative.budget ? ` · Budget: ${initiative.budget}` : ""}
            {" · "}Generated by Impact Natives
          </div>
          <div dangerouslySetInnerHTML={{ __html: fullDetail.detail_content }} />
          <div className="cn-footer">
            Impact Natives · app.impactnatives.com · Downloaded {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
          </div>
        </div>
      )}

      {/* ── Resource link ── */}
      {fullDetail?.resource_link && (
        <div className="rounded-xl border border-border bg-card px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Resource</p>
          <a href={fullDetail.resource_link} target="_blank" rel="noopener noreferrer"
            className="text-sm text-primary hover:underline break-all">
            {fullDetail.resource_link.replace(/^https?:\/\//, "")}
          </a>
        </div>
      )}

      {/* ── ESG callout ── */}
      {initiative.esg_alignment && (
        <div className="rounded-xl border px-5 py-4 flex items-start gap-3"
          style={{ borderColor: "#a5d6a7", background: "#f1f8f2" }}>
          <Leaf className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#2e7d32" }} />
          <div>
            <p className="text-sm font-medium" style={{ color: "#1b5e20" }}>Open to corporate ESG/CSR adoption</p>
            <p className="text-xs mt-0.5" style={{ color: "#388e3c" }}>
              Organisations can adopt this initiative as their CSR or ESG anchor programme.
            </p>
          </div>
        </div>
      )}

      {/* ── Tags ── */}
      {initiative.tags && initiative.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {initiative.tags.map(t => (
            <span key={t} className="px-3 py-1 rounded-full text-xs font-medium"
              style={{ background: "#f5ede8", color: "#C45C26" }}>{t}</span>
          ))}
        </div>
      )}

      {/* ── Action buttons ── */}
      {!isOwnInitiative && (
        <div className="space-y-3 pt-2">

          {/* Ask a question — funders only */}
          {isFunder && !alreadyExpressed && !quickSubmitted && !questionSubmitted && (
            <div className="space-y-2">
              {!questionOpen ? (
                <button type="button"
                  onClick={() => setQuestionOpen(true)}
                  className="w-full rounded-full h-10 border border-[#2D6A4F]/30 text-sm text-[#2D6A4F] hover:bg-[#2D6A4F]/5 transition-colors flex items-center justify-center gap-2">
                  <MessageSquare className="w-3.5 h-3.5" />
                  Ask a question before committing
                </button>
              ) : (
                <div className="rounded-xl border border-border bg-card p-4 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your question</p>
                  <textarea
                    value={question}
                    onChange={e => setQuestion(e.target.value)}
                    placeholder="Ask the initiative owner a specific question before expressing interest..."
                    rows={3}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                  />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => { setQuestionOpen(false); setQuestion(""); }}
                      className="flex-1 rounded-full h-9 border border-border text-sm text-muted-foreground hover:text-foreground transition-colors">
                      Cancel
                    </button>
                    <button type="button" onClick={submitQuestion}
                      disabled={!question.trim() || questionSubmitting}
                      className="flex-1 rounded-full h-9 bg-[#2D6A4F] hover:bg-[#245c43] text-white text-sm font-semibold disabled:opacity-40 transition-colors">
                      {questionSubmitting ? "Sending..." : "Send question"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {questionSubmitted && (
            <div className="flex items-center gap-2 justify-center text-xs text-[#2D6A4F] py-1">
              <CheckCircle2 className="w-4 h-4" />
              Question sent. The initiative lead will respond in Messages.
            </div>
          )}

          


          <button type="button"
            onClick={() => { if (!alreadyExpressed && !quickSubmitted) { setEoiOpen(true); generateAiMessage(); } }}
            disabled={alreadyExpressed || quickSubmitted}
            className={`w-full rounded-full h-11 text-sm font-semibold transition-colors ${
              alreadyExpressed || quickSubmitted
                ? "bg-muted text-muted-foreground cursor-not-allowed border border-border"
                : "bg-[#2D6A4F] hover:bg-[#245c43] text-white"
            }`}>
            {alreadyExpressed || quickSubmitted ? "Interest expressed" : "Express interest"}
          </button>

          {quickSubmitted && (
            <div className="flex items-center gap-2 justify-center text-xs text-[#2D6A4F]">
              <CheckCircle2 className="w-4 h-4" />
              Introduction sent. The initiative lead will be in touch.
            </div>
          )}
        </div>
      )}

      {isOwnInitiative && (
        <div className="w-full rounded-full h-11 flex items-center justify-center text-sm text-muted-foreground border border-border bg-muted">
          Your initiative
        </div>
      )}

      {/* Full EOI Modal */}
      {eoiOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-background rounded-2xl border border-border w-full max-w-md shadow-xl p-6 max-h-[90vh] overflow-y-auto">
            {submitted ? (
              <div className="text-center py-4">
                <CheckCircle2 className="w-10 h-10 text-[#2D6A4F] mx-auto mb-3" />
                <p className="font-medium text-foreground">Expression submitted</p>
                <p className="text-sm text-muted-foreground mt-1">The initiative lead will be notified.</p>
                {profile?.user_type === "organisation" && !profile?.is_verified && (
                  <div className="mt-4 rounded-xl border border-[#2D6A4F]/20 bg-[#2D6A4F]/5 px-4 py-3 text-left">
                    <p className="text-xs font-medium text-[#2D6A4F]">Stand out with a verified badge</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Verified organisations get a trust badge on all EOIs.</p>
                    <a href="/verify" className="inline-block mt-2 text-xs font-medium text-[#2D6A4F] hover:underline">Get verified →</a>
                  </div>
                )}
                <button type="button"
                  onClick={() => { setEoiOpen(false); setSubmitted(false); setPartnershipTypes([]); setEsgAdoption(false); setMessage(""); }}
                  className="mt-5 rounded-full h-10 px-6 bg-[#2D6A4F] hover:bg-[#245c43] text-white text-sm font-semibold transition-colors">
                  Done
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-foreground">Express Interest</h3>
                  <button type="button" onClick={() => setEoiOpen(false)} className="p-1.5 rounded-full hover:bg-muted transition-colors">
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground mb-2">Partnership type</p>
                  <div className="flex flex-wrap gap-2">
                    {EOI_PARTNERSHIP_TYPES.map(t => (
                      <button key={t.value} type="button"
                        onClick={() => setPartnershipTypes(prev => prev.includes(t.value) ? prev.filter(x => x !== t.value) : [...prev, t.value])}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                          partnershipTypes.includes(t.value) ? "bg-[#2D6A4F] text-white border-[#2D6A4F]" : "border-border text-muted-foreground hover:border-[#2D6A4F]"
                        }`}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
                {initiative.esg_alignment && (
                  <div>
                    <p className="text-sm font-medium text-foreground mb-2">ESG/CSR adoption</p>
                    <button type="button" onClick={() => setEsgAdoption(v => !v)}
                      className={`w-full flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${esgAdoption ? "border-[#2e7d32] bg-[#f1f8f2]" : "border-border hover:border-[#2e7d32]/40"}`}>
                      <div className={`w-4 h-4 mt-0.5 rounded border flex items-center justify-center shrink-0 transition-colors ${esgAdoption ? "bg-[#2e7d32] border-[#2e7d32]" : "border-border"}`}>
                        {esgAdoption && <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-foreground">Adopt as ESG/CSR initiative</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Your organisation will adopt this as a CSR or ESG anchor programme.</p>
                      </div>
                    </button>
                  </div>
                )}
                {!canSubmit && <p className="text-xs text-muted-foreground">Select at least one partnership type{initiative.esg_alignment ? " or choose ESG/CSR adoption" : ""}.</p>}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-foreground">Message</label>
                    <button type="button" onClick={generateAiMessage} disabled={aiMessageLoading}
                      className="flex items-center gap-1.5 text-xs font-semibold text-[#2D6A4F] hover:underline disabled:opacity-40 transition-opacity">
                      {aiMessageLoading
                        ? <><Loader2 className="w-3 h-3 animate-spin" />Generating...</>
                        : <><Sparkles className="w-3 h-3" />Regenerate</>}
                    </button>
                  </div>
                  {aiMessageLoading && !message && (
                    <div className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2.5 h-28 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#2D6A4F]" />
                      Drafting your message...
                    </div>
                  )}
                  {(!aiMessageLoading || message) && (
                    <textarea value={message} onChange={e => setMessage(e.target.value)}
                      placeholder={aiMessageFailed ? "AI draft unavailable — write your message here..." : "Generating message..."}
                      rows={5}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors" />
                  )}
                  {aiMessageFailed && !message && (
                    <p className="text-xs text-[#C45C26]">AI draft failed — write your own message above.</p>
                  )}
                </div>
                {eoiError && <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{eoiError}</p>}
                <button type="button" onClick={submitEOI} disabled={!canSubmit || submitting}
                  className="w-full rounded-full h-10 bg-[#2D6A4F] hover:bg-[#245c43] text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Submit Expression of Interest
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
