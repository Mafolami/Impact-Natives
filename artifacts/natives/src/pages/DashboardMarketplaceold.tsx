// ─── DashboardMarketplace.tsx ─────────────────────────────────────────────────
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Loader2, CheckCircle2, X, SlidersHorizontal, Search, Leaf } from "lucide-react";
import { SECTOR_OPTIONS } from "@/lib/sectors";
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "wouter";

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
}



const LOCATION_OPTIONS = [
  "Nigeria", "Kenya", "Ghana", "South Africa", "Uganda", "Tanzania",
  "West Africa", "East Africa", "Sub-Saharan Africa", "Pan-Africa", "Global",
];

const BUDGET_OPTIONS = [
  { label: "Under $50K",    value: "under_50k" },
  { label: "$50K – $200K",  value: "50k_200k" },
  { label: "$200K – $1M",   value: "200k_1m" },
  { label: "Over $1M",      value: "over_1m" },
];

const PARTNERSHIP_OPTIONS = [
  { value: "funding",     label: "Funding" },
  { value: "technical",   label: "Technical" },
  { value: "operational", label: "Operational" },
  { value: "leadership",  label: "Leadership" },
  { value: "strategic",   label: "Strategic" },
  { value: "lead",        label: "Project Lead" },
];

const PARTNERSHIP_TYPES = [
  "Co-implementer", "Funder", "Technical Partner",
  "Research Partner", "Government/Policy", "Private Sector", "Community Partner",
];

function budgetMatches(budget: string | null | undefined, filter: string): boolean {
  if (!budget) return false;
  const nums = budget.replace(/[^0-9]/g, " ").trim().split(/\s+/).map(Number).filter(Boolean);
  if (!nums.length) return false;
  const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
  if (filter === "under_50k")  return avg < 50000;
  if (filter === "50k_200k")   return avg >= 50000 && avg < 200000;
  if (filter === "200k_1m")    return avg >= 200000 && avg < 1000000;
  if (filter === "over_1m")    return avg >= 1000000;
  return false;
}

// ─── Filter Panel ─────────────────────────────────────────────────────────────
function FilterPanel({
  sectors, setSectors,
  locations, setLocations,
  budgets, setBudgets,
  partnerships, setPartnerships,
  onClear,
  activeCount,
}: {
  sectors: string[]; setSectors: (v: string[]) => void;
  locations: string[]; setLocations: (v: string[]) => void;
  budgets: string[]; setBudgets: (v: string[]) => void;
  partnerships: string[]; setPartnerships: (v: string[]) => void;
  onClear: () => void;
  activeCount: number;
}) {
  function toggle(arr: string[], val: string, set: (v: string[]) => void) {
    set(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);
  }
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">Filters</p>
        {activeCount > 0 && (
          <button type="button" onClick={onClear}
            className="text-xs text-primary hover:underline">
            Clear all ({activeCount})
          </button>
        )}
      </div>
      {/* Sector */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">Sector</p>
        <div className="flex flex-wrap gap-1.5">
          {SECTOR_OPTIONS.map(s => (
            <button key={s} type="button" onClick={() => toggle(sectors, s, setSectors)}
              className={`h-7 px-3 rounded-full text-xs border transition-colors ${
                sectors.includes(s)
                  ? "bg-[#2D6A4F] border-[#2D6A4F] text-white"
                  : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
              }`}>
              {s}
            </button>
          ))}
        </div>
      </div>
      {/* Location */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">Location</p>
        <div className="flex flex-wrap gap-1.5">
          {LOCATION_OPTIONS.map(l => (
            <button key={l} type="button" onClick={() => toggle(locations, l, setLocations)}
              className={`h-7 px-3 rounded-full text-xs border transition-colors ${
                locations.includes(l)
                  ? "bg-[#2D6A4F] border-[#2D6A4F] text-white"
                  : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
              }`}>
              {l}
            </button>
          ))}
        </div>
      </div>
      {/* Budget */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">Budget range</p>
        <div className="flex flex-wrap gap-1.5">
          {BUDGET_OPTIONS.map(b => (
            <button key={b.value} type="button" onClick={() => toggle(budgets, b.value, setBudgets)}
              className={`h-7 px-3 rounded-full text-xs border transition-colors ${
                budgets.includes(b.value)
                  ? "bg-[#2D6A4F] border-[#2D6A4F] text-white"
                  : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
              }`}>
              {b.label}
            </button>
          ))}
        </div>
      </div>
      {/* Partnership */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">Partnership sought</p>
        <div className="flex flex-wrap gap-1.5">
          {PARTNERSHIP_OPTIONS.map(p => (
            <button key={p.value} type="button" onClick={() => toggle(partnerships, p.value, setPartnerships)}
              className={`h-7 px-3 rounded-full text-xs border transition-colors ${
                partnerships.includes(p.value)
                  ? "bg-[#C45C26] border-[#C45C26] text-white"
                  : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
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
function InitiativeCard({
  ini,
  expressed,
  onClick,
}: {
  ini: InitiativeRow;
  expressed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-2xl border border-border bg-card hover:border-[#2D6A4F]/40 hover:shadow-sm transition-all group p-5 flex flex-col gap-3"
    >
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
          {/* ESG badge */}
          {ini.esg_alignment && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full"
              style={{ background: "#e8f5e9", color: "#2e7d32" }}>
              <Leaf className="w-2.5 h-2.5" />
              ESG/CSR
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {ini.status === "closed" && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 bg-gray-100 px-2.5 py-0.5 rounded-full">
              Partnership formed
            </span>
          )}
          {expressed && ini.status !== "closed" && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#2D6A4F] bg-[#eaf5ee] px-2.5 py-0.5 rounded-full">
              <CheckCircle2 className="w-3 h-3" />
              Expressed
            </span>
          )}
        </div>
      </div>

      {/* Title */}
      <div>
        <h3 className="font-semibold text-foreground group-hover:text-[#2D6A4F] transition-colors leading-snug">
          {ini.title}
        </h3>
        {ini.submitter_org && (
          <p className="text-xs text-muted-foreground mt-0.5">{ini.submitter_org}</p>
        )}
      </div>

      {/* Problem snippet */}
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

      {/* Partnership tags */}
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
  const [initiatives, setInitiatives] = useState<InitiativeRow[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected]       = useState<InitiativeRow | null>(null);
  const [expressedIds, setExpressedIds] = useState<Set<string>>(new Set());
  const { user } = useAuth();
  const [location] = useLocation();

  // Filter state
  const [sectors, setSectors]         = useState<string[]>([]);
  const [locations, setLocations]     = useState<string[]>([]);
  const [budgets, setBudgets]         = useState<string[]>([]);
  const [partnerships, setPartnerships] = useState<string[]>([]);

  const activeFilterCount = sectors.length + locations.length + budgets.length + partnerships.length;

  function clearFilters() {
    setSectors([]); setLocations([]); setBudgets([]); setPartnerships([]);
  }

  useEffect(() => {
    if (!user) return;
    supabase
      .from("expressions_of_interest")
      .select("initiative_id")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (data) setExpressedIds(new Set(data.map(d => d.initiative_id)));
      });
  }, [user]);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("initiative_requests")
        .select("id,title,sectors,locations,status,eois,created_at,problem,outcome,partnerships,budget,tags,submitter_org,user_id,esg_alignment")
        .in("status", ["published", "closed"])
        .order("created_at", { ascending: false });

      if (data) {
        setInitiatives(data as InitiativeRow[]);

        // Handle deep link via ?initiative=ID query param
        const params = new URLSearchParams(location.split("?")[1] ?? "");
        const deepId = params.get("initiative");
        if (deepId) {
          const match = (data as InitiativeRow[]).find(i => i.id === deepId);
          if (match) setSelected(match);
        }
      }
      setLoading(false);
    }
    load();
  }, []);

  const filtered = initiatives.filter(ini => {
    if (search.trim()) {
      const q = search.toLowerCase();
      const hit =
        ini.title?.toLowerCase().includes(q) ||
        ini.problem?.toLowerCase().includes(q) ||
        ini.locations?.some(l => l.toLowerCase().includes(q)) ||
        ini.submitter_org?.toLowerCase().includes(q);
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
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-foreground tracking-tight">Marketplace</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Published initiatives open for partnership and collaboration.
        </p>
      </div>

      {/* Search + filter toggle */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by title, problem, location..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
          />
          {search && (
            <button type="button" onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowFilters(v => !v)}
          className={`h-10 px-4 rounded-lg border text-sm flex items-center gap-2 transition-colors shrink-0 ${
            showFilters || activeFilterCount > 0
              ? "border-[#2D6A4F] text-[#2D6A4F] bg-[#eaf5ee]"
              : "border-border text-muted-foreground hover:border-foreground/30"
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filters
          {activeFilterCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-[#2D6A4F] text-white text-[10px] flex items-center justify-center font-bold">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <FilterPanel
          sectors={sectors} setSectors={setSectors}
          locations={locations} setLocations={setLocations}
          budgets={budgets} setBudgets={setBudgets}
          partnerships={partnerships} setPartnerships={setPartnerships}
          onClear={clearFilters}
          activeCount={activeFilterCount}
        />
      )}

      {/* Active filter chips */}
      {activeFilterCount > 0 && !showFilters && (
        <div className="flex flex-wrap gap-2 items-center">
          {[
            ...sectors,
            ...locations,
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

      {/* Results count */}
      {!loading && (
        <p className="text-xs text-muted-foreground">
          {filtered.length} initiative{filtered.length !== 1 ? "s" : ""}
          {activeFilterCount > 0 ? " matching filters" : ""}
        </p>
      )}

      {/* Content */}
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
            {initiatives.length === 0
              ? "Check back soon — new initiatives are added regularly."
              : "Try adjusting your filters or search term."}
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
            <InitiativeCard
              key={ini.id}
              ini={ini}
              expressed={expressedIds.has(ini.id)}
              onClick={() => setSelected(ini)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Marketplace Detail ───────────────────────────────────────────────────────
function MarketplaceDetail({
  initiative, onBack, expressed, onExpressed,
}: {
  initiative: InitiativeRow;
  onBack: () => void;
  expressed: boolean;
  onExpressed: (id: string) => void;
}) {
    const { user, profile } = useAuth();
  const [eoiOpen, setEoiOpen]           = useState(false);
  const [partnershipTypes, setPartnershipTypes] = useState<string[]>([]);
  const [esgAdoption, setEsgAdoption]   = useState(false);
  const [message, setMessage]           = useState("");
  const [submitting, setSubmitting]     = useState(false);
  const [submitted, setSubmitted]       = useState(false);
  const [eoiError, setEoiError]         = useState<string | null>(null);
  const [alreadyExpressed, setAlreadyExpressed] = useState(expressed);
  const isOwnInitiative = !!user && initiative.user_id === user.id;

  useEffect(() => {
    if (!user || expressed) return;
    supabase
      .from("expressions_of_interest")
      .select("id")
      .eq("initiative_id", initiative.id)
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => { if (data) setAlreadyExpressed(true); });
  }, [user, initiative.id]);

  async function submitEOI() {
    if (!user || (partnershipTypes.length === 0 && !esgAdoption)) return;
    setSubmitting(true);
    setEoiError(null);

    // 1 — Insert EOI
    const { data: eoiData, error: eoiErr } = await supabase
      .from("expressions_of_interest")
      .insert({
        initiative_id:    initiative.id,
        user_id:          user.id,
        partnership_type: partnershipTypes.join(", ") || (esgAdoption ? "ESG/CSR Adoption" : ""),
        message:          message || null,
        esg_adoption:     esgAdoption,
      })
      .select("id")
      .single();

    if (eoiErr) {
      setSubmitting(false);
      setEoiError(eoiErr.code === "23505"
        ? "You've already expressed interest in this initiative."
        : eoiErr.message);
      return;
    }

    // 1b — Increment EOI count
    await supabase.rpc("increment_eoi_count", { p_initiative_id: initiative.id });

    // 2 — Create conversation
    const { data: convoResult, error: convoError } = await supabase
      .rpc("create_conversation", {
        p_initiative_id: initiative.id,
        p_owner_id:      initiative.user_id ?? null,
      });

    if (convoError || !convoResult) {
      setSubmitting(false);
      setEoiError(`Failed to create conversation: ${convoError?.message ?? "unknown"}`);
      return;
    }

    const convo = { id: convoResult as string };

    // 3 — Link EOI to conversation
    await supabase
      .from("expressions_of_interest")
      .update({ conversation_id: convo.id })
      .eq("id", eoiData.id);

    // 4 — Add participants
    const participants = [{ conversation_id: convo.id, user_id: user.id }];
    if (initiative.user_id && initiative.user_id !== user.id) {
      participants.push({ conversation_id: convo.id, user_id: initiative.user_id });
    }
    await supabase.from("conversation_participants").insert(participants);

    // 5 — System message
    const typeParts = partnershipTypes.length > 0 ? partnershipTypes.join(", ") : "";
    const esgPart   = esgAdoption ? "ESG/CSR Adoption" : "";
    const combined  = [typeParts, esgPart].filter(Boolean).join(" + ");
    const systemBody = `${combined} interest expressed${message ? `: "${message}"` : "."}`;
    await supabase.from("messages").insert({
      conversation_id: convo.id,
      sender_id:       user.id,
      body:            systemBody,
    });

    // 6 — Notify initiative owner
    if (initiative.user_id && initiative.user_id !== user.id) {
      const { data: expresserProfile } = await supabase
        .from("profiles").select("full_name, org_name, user_type").eq("id", user.id).single();
      const expresserName = expresserProfile?.user_type === "organisation" && expresserProfile?.org_name
        ? expresserProfile.org_name
        : expresserProfile?.full_name ?? "Someone";
      await supabase.from("notifications").insert({
        user_id: initiative.user_id,
        type:    "eoi_received",
        title:   "New expression of interest",
        body:    `${expresserName} expressed ${combined} interest in "${initiative.title}"`,
        link:    "/dashboard/messages",
      });
    }

    setSubmitting(false);
    setSubmitted(true);
    setAlreadyExpressed(true);
    onExpressed(initiative.id);
  }

  const canSubmit = partnershipTypes.length > 0 || esgAdoption;

  return (
    <div className="space-y-6">
      <button type="button" onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
        Back to marketplace
      </button>

      {/* Header */}
      <div>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {initiative.sectors?.map(s => (
            <span key={s} className="text-xs font-medium px-2.5 py-0.5 rounded-full"
              style={{ background: "#f5ede8", color: "#C45C26" }}>
              {s}
            </span>
          ))}
          {initiative.esg_alignment && (
            <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full"
              style={{ background: "#e8f5e9", color: "#2e7d32" }}>
              <Leaf className="w-3 h-3" />
              ESG/CSR Friendly
            </span>
          )}
        </div>
        <h2 className="text-2xl font-bold text-foreground tracking-tight">{initiative.title}</h2>
        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
          {initiative.submitter_org && <span>{initiative.submitter_org}</span>}
          <span>{initiative.eois} expression{initiative.eois !== 1 ? "s" : ""} of interest</span>
          <span>{new Date(initiative.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
        </div>
      </div>

      {/* ESG adoption callout */}
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

      {/* Meta */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          { label: "Location", value: initiative.locations?.join(", ") || "—" },
          { label: "Budget",   value: initiative.budget || "—" },
          { label: "Listed",   value: new Date(initiative.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
            <p className="text-sm font-medium text-foreground">{value}</p>
          </div>
        ))}
      </div>

      {/* Problem / Outcome */}
      {(initiative.problem || initiative.outcome) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {initiative.problem && (
            <div className="rounded-xl border border-border bg-card px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Problem</p>
              <p className="text-sm text-foreground leading-relaxed">{initiative.problem}</p>
            </div>
          )}
          {initiative.outcome && (
            <div className="rounded-xl border border-border bg-card px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Outcome</p>
              <p className="text-sm text-foreground leading-relaxed">{initiative.outcome}</p>
            </div>
          )}
        </div>
      )}

      {/* Partnerships */}
      {initiative.partnerships && initiative.partnerships.length > 0 && (
        <div className="rounded-xl border border-border bg-card px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Partnerships sought</p>
          <div className="flex flex-wrap gap-2">
            {initiative.partnerships.map(p => (
              <span key={p} className="px-3 py-1 rounded-full text-xs font-medium border border-border text-foreground capitalize">
                {PARTNERSHIP_OPTIONS.find(o => o.value === p)?.label ?? p}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tags */}
      {initiative.tags && initiative.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {initiative.tags.map(t => (
            <span key={t} className="px-3 py-1 rounded-full text-xs font-medium"
              style={{ background: "#f5ede8", color: "#C45C26" }}>
              {t}
            </span>
          ))}
        </div>
      )}

      {/* EOI button */}
      {!isOwnInitiative ? (
        <button
          type="button"
          onClick={() => !alreadyExpressed && setEoiOpen(true)}
          disabled={alreadyExpressed}
          className={`w-full rounded-full h-11 text-sm font-semibold transition-colors ${
            alreadyExpressed
              ? "bg-muted text-muted-foreground cursor-not-allowed border border-border"
              : "bg-[#2D6A4F] hover:bg-[#245c43] text-white"
          }`}
        >
          {alreadyExpressed ? "Already expressed interest" : "Express Interest"}
        </button>
      ) : (
        <div className="w-full rounded-full h-11 flex items-center justify-center text-sm text-muted-foreground border border-border bg-muted">
          Your initiative
        </div>
      )}

      {/* EOI Modal */}
      {eoiOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-background rounded-2xl border border-border w-full max-w-md shadow-xl p-6 max-h-[90vh] overflow-y-auto">
            {submitted ? (
              <div className="text-center py-4">
                <CheckCircle2 className="w-10 h-10 text-[#2D6A4F] mx-auto mb-3" />
                <p className="font-medium text-foreground">Expression submitted</p>
                <p className="text-sm text-muted-foreground mt-1">
                  The initiative lead will be notified.
                </p>
                {profile?.user_type === "organisation" && !profile?.is_verified && (
                  <div className="mt-4 rounded-xl border border-[#2D6A4F]/20 bg-[#2D6A4F]/5 px-4 py-3 text-left">
                    <p className="text-xs font-medium text-[#2D6A4F]">Stand out with a verified badge</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Verified organisations get a trust badge on all EOIs, partnerships, and activity.
                    </p>
                    <a href="/verify"
                      className="inline-block mt-2 text-xs font-medium text-[#2D6A4F] hover:underline">
                      Get verified →
                    </a>
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
                  <button type="button" onClick={() => setEoiOpen(false)}
                    className="p-1.5 rounded-full hover:bg-muted transition-colors">
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>

                {/* Partnership type */}
                <div>
                  <p className="text-sm font-medium text-foreground mb-2">
                    Partnership type
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {PARTNERSHIP_TYPES.map(t => (
                      <button key={t} type="button"
                        onClick={() => setPartnershipTypes(prev =>
                          prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
                        )}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                          partnershipTypes.includes(t)
                            ? "bg-[#2D6A4F] text-white border-[#2D6A4F]"
                            : "border-border text-muted-foreground hover:border-[#2D6A4F]"
                        }`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ESG adoption — only shown when initiative has esg_alignment */}
                {initiative.esg_alignment && (
                  <div>
                    <p className="text-sm font-medium text-foreground mb-2">ESG/CSR adoption</p>
                    <button
                      type="button"
                      onClick={() => setEsgAdoption(v => !v)}
                      className={`w-full flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                        esgAdoption
                          ? "border-[#2e7d32] bg-[#f1f8f2]"
                          : "border-border hover:border-[#2e7d32]/40"
                      }`}
                    >
                      <div className={`w-4 h-4 mt-0.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                        esgAdoption ? "bg-[#2e7d32] border-[#2e7d32]" : "border-border"
                      }`}>
                        {esgAdoption && (
                          <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <path d="M20 6L9 17l-5-5"/>
                          </svg>
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-foreground">Adopt as ESG/CSR initiative</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Your organisation will adopt this as a CSR or ESG anchor programme.
                        </p>
                      </div>
                    </button>
                  </div>
                )}

                {/* Validation hint */}
                {!canSubmit && (
                  <p className="text-xs text-muted-foreground">
                    Select at least one partnership type{initiative.esg_alignment ? " or choose ESG/CSR adoption" : ""}.
                  </p>
                )}

                {/* Message */}
                <div>
                  <label className="text-sm font-medium text-foreground block mb-1.5">
                    Message <span className="text-muted-foreground font-normal text-xs">(optional)</span>
                  </label>
                  <textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder="Briefly describe how you could contribute..."
                    rows={4}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                  />
                </div>

                {eoiError && (
                  <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{eoiError}</p>
                )}

                <button type="button" onClick={submitEOI}
                  disabled={!canSubmit || submitting}
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