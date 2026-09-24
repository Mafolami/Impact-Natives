// ─── DashboardMarketplace.tsx ─────────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Loader2, CheckCircle2, X, SlidersHorizontal, Search, Leaf, Zap, MessageSquare, ShieldCheck, Bookmark, ThumbsDown, RotateCcw, AlertTriangle, Check, Building2, Wallet, Handshake, FileCheck, Award, Info, Lightbulb, Users, BarChart3, Clock, Globe, LayoutGrid, MoreVertical, Download, MapPin, Calendar, Flag } from "lucide-react";
import { computeTrustTier } from "@/lib/ddItems";
import { TrustBadge } from "@/components/ui/TrustBadge";
import { useAuth } from "@/context/AuthContext";
import { FileText, Sparkles } from "lucide-react";
import { useLocation, Link } from "wouter";
import CreateInitiativeModalDashboard from "./CreateInitiativeModalDashboard";
import { ShareButton as SharedShareButton } from "@/components/dashboard/ShareButton";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
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
  submitter_is_verified?: boolean;
  submitter_dd_score?: number | null;
  submitter_trust_tier?: "gold" | "silver" | "bronze" | "flagged" | null;
  submitter_logo_url?: string | null;
  submitter_org_type?: string | null;
  submitter_name?: string | null;
  submitter_user_type?: string | null;
  specific_ask?: string | null;
  stage?: string | null;
  confirmed_partners?: { status?: string }[] | null;
}
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
const PASS_REASONS = ["Too early stage", "Outside mandate", "Budget mismatch", "Geography mismatch", "Team concerns", "Other"];
const RAG_COLORS: Record<string, { border: string; bg: string; text: string }> = {
  "Pass":                       { border: "#C4262640", bg: "rgba(196,38,38,0.08)", text: "#C42626" },
  "Request More Info":          { border: "#f59e0b40", bg: "rgba(180,83,9,0.12)", text: "#b45309" },
  "Explore further":            { border: "#f59e0b40", bg: "rgba(180,83,9,0.12)", text: "#b45309" },
  "Express Interest":           { border: "#2D6A4F40", bg: "rgba(45,106,79,0.12)", text: "#2D6A4F" },
  "Adopt as CSR programme":     { border: "#2D6A4F40", bg: "rgba(45,106,79,0.12)", text: "#2D6A4F" },
};
const DEFAULT_RAG = { border: "#e5e7eb", bg: "#f9fafb", text: "#6b7280" };
function ragFor(action?: string) {
  return (action && RAG_COLORS[action]) || DEFAULT_RAG;
}
function ragForScore(score: number, passBelow: number, positiveAbove: number) {
  if (score < passBelow) return RAG_COLORS["Pass"];
  if (score <= positiveAbove) return RAG_COLORS["Request More Info"];
  return RAG_COLORS["Express Interest"];
}
function RagIcon({ action, className }: { action?: string; className?: string }) {
  if (action === "Pass") return <ThumbsDown className={className} />;
  if (action === "Express Interest" || action === "Adopt as CSR programme") return <ShieldCheck className={className} />;
  return <AlertTriangle className={className} />;
}
function useDynamicOptions(initiatives: InitiativeRow[]) {
  const sectors = Array.from(
    new Set(initiatives.flatMap(i => i.sectors ?? []))
  ).filter(Boolean).sort();
  const locations = Array.from(
    new Set(initiatives.flatMap(i => i.locations ?? []))
  ).filter(Boolean).sort();
  return { sectors, locations };
}
const EOI_PARTNERSHIP_TYPES = [
  { value: "funding",     label: "Funding"       },
  { value: "technical",   label: "Technical"     },
  { value: "operational", label: "Operational"   },
  { value: "leadership",  label: "Leadership"    },
  { value: "strategic",   label: "Strategic"     },
  { value: "lead",        label: "Project Lead"  },
];
function eoiTypeLabel(value: string): string {
  return EOI_PARTNERSHIP_TYPES.find(o => o.value === value)?.label ?? value;
}
function rolePartnerPhrase(value: string): string {
  const label = eoiTypeLabel(value);
  if (/partner$/i.test(label)) return label;
  if (label === "Project Lead") return label;
  return `${label} partner`;
}
function combinedPartnerPhrase(types: string[], esgAdoption: boolean): string {
  const labels = types.map(eoiTypeLabel);
  let phrase = "";
  if (labels.length === 1) {
    phrase = rolePartnerPhrase(types[0]);
  } else if (labels.length > 1) {
    const rolesJoined = labels.length === 2
      ? `${labels[0]} and ${labels[1]}`
      : `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
    phrase = `${rolesJoined} partner`;
  }
  if (esgAdoption) phrase = phrase ? `${phrase} and ESG/CSR adoption` : "ESG/CSR adoption";
  return phrase;
}
// Implementer orgs (NGOs, social enterprises, etc.) fill in the 9-item
// DD_ITEMS checklist (dd_* columns). Funders and corporates fill in a
// separate 6-item FUNDER_DD_ITEMS checklist instead (fdd_* columns) --
// same classification DashboardNatives.tsx already uses to pick between
// the two. Reading only dd_* regardless of org type meant every funder or
// corporate showed 0% DD Readiness here no matter how much of their real
// checklist was actually completed, since their answers live in a
// completely different set of columns this code never looked at.
function isImplementerOrgType(orgType: string | null | undefined): boolean {
  return !["philanthropic_foundation", "venture_capital", "corporation", "technology_company", "public_sector"].includes(orgType ?? "");
}
function ddItemsFor(o: Record<string, any>): (boolean | undefined)[] {
  return isImplementerOrgType(o.organisation_type)
    ? [o.dd_financial_model, o.dd_audited_accounts, o.dd_governance_doc, o.dd_esg_assessment, o.dd_impact_framework, o.dd_environmental_policy, o.dd_safeguarding_policy, o.dd_legal_registration, o.dd_legal_compliance_declaration]
    : [o.fdd_disbursement_track_record, o.fdd_decision_transparency, o.fdd_conflict_disclosure, o.fdd_governance_doc, o.fdd_esg_framework, o.fdd_legal_registration];
}
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
// Thin wrapper: the share menu itself now lives in components/dashboard/ShareButton.tsx
// and takes a url + message. Same props as before, so every call site here is unchanged.
function ShareButton({ initiativeId, title, size = "sm" }: { initiativeId: string; title: string; size?: "sm" | "md" }) {
  return (
    <SharedShareButton
      size={size}
      url={`${window.location.origin}/dashboard/marketplace/${initiativeId}`}
      message={`Check out this initiative on Impact Natives: ${title}. Sign up to explore partnership opportunities like this one.`}
    />
  );
}
function DecisionIcons({
  saved, passed, passReason, onToggleSave, onConfirmPass, onUndoPass, size = "sm", layout = "icons",
}: {
  saved: boolean;
  passed: boolean;
  passReason?: string | null;
  onToggleSave: () => void;
  onConfirmPass: (reason: string) => void;
  onUndoPass: () => void;
  size?: "sm" | "md";
  layout?: "icons" | "rows";
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [reason, setReason] = useState("");
  const dim = size === "md" ? "h-9 w-9" : "h-8 w-8";
  const iconDim = size === "md" ? "w-4 h-4" : "w-3.5 h-3.5";

  const saveButton = (
    <button
      type="button"
      onClick={onToggleSave}
      title={saved ? "Remove from saved" : "Save"}
      className={`${dim} rounded-full flex items-center justify-center border shrink-0 transition-colors ${
        saved
          ? "border-[#2D6A4F]/30 bg-[rgba(45,106,79,0.12)] text-[#2D6A4F]"
          : "border-border text-muted-foreground hover:border-[#2D6A4F]/40 hover:text-[#2D6A4F] hover:bg-[#2D6A4F]/5 dark:hover:border-[#C45C26] dark:hover:text-[#C45C26] dark:hover:bg-[#C45C26]/10"
      }`}>
      <Bookmark className={iconDim} fill={saved ? "currentColor" : "none"} />
    </button>
  );

  const passUndoButton = (
    <button
      type="button"
      onClick={onUndoPass}
      title={passReason ? `Passed · ${passReason} — click to undo` : "Passed — click to undo"}
      className={`${dim} rounded-full flex items-center justify-center border border-border bg-muted text-muted-foreground hover:text-[#2D6A4F] hover:border-[#2D6A4F]/30 hover:bg-[rgba(45,106,79,0.12)] transition-colors shrink-0`}>
      <RotateCcw className={iconDim} />
    </button>
  );

  const pickerContent = (
    <PopoverContent align="end" className="w-72 p-4 space-y-3">
      <p className="text-[13px] font-semibold uppercase tracking-wider text-black dark:text-white">Reason for passing</p>
      <div className="flex flex-wrap gap-1.5">
        {PASS_REASONS.map(r => (
          <button key={r} type="button"
            onClick={() => setReason(r)}
            className={`px-2.5 py-1 rounded-full border text-[13px] font-medium transition-colors ${
              reason === r
                ? "bg-[#C45C26] border-[#C45C26] text-white"
                : "border-border text-muted-foreground hover:border-foreground/30"
            }`}>
            {r}
          </button>
        ))}
      </div>
      <div className="flex justify-end gap-3 pt-1">
        <button type="button" onClick={() => setPickerOpen(false)}
          className="text-[13px] text-muted-foreground hover:text-foreground transition-colors">
          Cancel
        </button>
        <button type="button" disabled={!reason}
          onClick={() => { onConfirmPass(reason); setPickerOpen(false); setReason(""); }}
          className="rounded-full h-7 px-3.5 bg-red-500 hover:bg-red-600 text-white text-[13px] font-semibold disabled:opacity-40 transition-colors">
          Confirm pass
        </button>
      </div>
    </PopoverContent>
  );

  if (layout === "rows") {
    // Save and Pass as two fully independent full-width rows, each with its
    // own icon and label -- used in the header kebab menu, where they need
    // to read (and behave) as separate actions rather than an icon pair.
    return (
      <>
        <button type="button" onClick={onToggleSave}
          className="w-full flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-[#1B4D3E]/5 transition-colors text-left">
          {saveButton}
          <span className="text-[14px] font-normal text-[#0F172A] dark:text-[#F5F5F5]">{saved ? "Saved" : "Save"}</span>
        </button>
        {passed ? (
          <button type="button" onClick={onUndoPass}
            className="w-full flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-[#1B4D3E]/5 transition-colors text-left">
            {passUndoButton}
            <span className="text-[14px] font-normal text-[#0F172A] dark:text-[#F5F5F5]">Passed{passReason ? ` · ${passReason}` : ""} — undo</span>
          </button>
        ) : (
          <Popover open={pickerOpen} onOpenChange={(o) => { setPickerOpen(o); if (!o) setReason(""); }}>
            <PopoverTrigger asChild>
              <button type="button"
                className="w-full flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-[#1B4D3E]/5 transition-colors text-left">
                <span className={`${dim} rounded-full flex items-center justify-center border border-border text-muted-foreground shrink-0`}>
                  <ThumbsDown className={iconDim} />
                </span>
                <span className="text-[14px] font-normal text-[#0F172A] dark:text-[#F5F5F5]">Pass</span>
              </button>
            </PopoverTrigger>
            {pickerContent}
          </Popover>
        )}
      </>
    );
  }

  return (
    <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
      {saveButton}
      {passed ? passUndoButton : (
        <Popover open={pickerOpen} onOpenChange={(o) => { setPickerOpen(o); if (!o) setReason(""); }}>
          <PopoverTrigger asChild>
            <button
              type="button"
              title="Pass"
              className={`${dim} rounded-full flex items-center justify-center border border-border text-muted-foreground hover:border-red-300 hover:text-red-500 hover:bg-red-50 transition-colors`}>
              <ThumbsDown className={iconDim} />
            </button>
          </PopoverTrigger>
          {pickerContent}
        </Popover>
      )}
    </div>
  );
}
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
          <p className="text-[13px] font-bold uppercase tracking-wider text-black dark:text-white">{label}</p>
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
            className="w-full h-8 pl-3 pr-3 rounded-lg text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#2D6A4F]/30 bg-muted border border-border" />
        </div>
        <div className="max-h-36 overflow-y-auto space-y-0.5 pr-1">
          {filteredLocationOptions.length === 0 && options === locationOptions && (
            <p className="text-[13px] text-black dark:text-white py-1">No results</p>
          )}
          {(options === sectorOptions ? filteredSectorOptions : filteredLocationOptions).map(o => {
            const on = selected.includes(o);
            return (
              <button key={o} type="button" onClick={() => toggle(selected, o, set)}
                className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-[13px] text-left transition-colors ${
                  on ? "bg-[rgba(45,106,79,0.12)] text-[#2D6A4F] font-semibold" : "text-foreground hover:bg-muted"
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
    <div className="p-5 space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-[15px] font-bold text-foreground">Filters</p>
        {activeCount > 0 && (
          <button type="button" onClick={onClear} className="text-[13px] font-semibold text-[#2D6A4F] hover:underline">
            Clear all ({activeCount})
          </button>
        )}
      </div>
      <DropdownFilter
        label="Sector" search={sectorSearch} setSearch={setSectorSearch}
        options={sectorOptions} selected={sectors} set={setSectors}
      />
      <div className="h-px bg-border" />
      <DropdownFilter
        label="Location" search={locationSearch} setSearch={setLocationSearch}
        options={locationOptions} selected={locations} set={setLocations}
      />
      <div className="h-px bg-border" />
      <div>
        <p className="text-[13px] font-bold uppercase tracking-wider text-black dark:text-white mb-2.5">Budget range</p>
        <div className="flex flex-wrap gap-1.5">
          {BUDGET_OPTIONS.map(b => (
            <button key={b.value} type="button" onClick={() => toggle(budgets, b.value, setBudgets)}
              className={`h-7 px-3 rounded-full text-[13px] font-medium border transition-colors ${
                budgets.includes(b.value)
                  ? "bg-[#2D6A4F] border-[#2D6A4F] text-white"
                  : "border-border text-muted-foreground hover:border-[#2D6A4F]/40 hover:text-[#2D6A4F]"
              }`}>
              {b.label}
            </button>
          ))}
        </div>
      </div>
      <div className="h-px bg-border" />
      <div>
        <p className="text-[13px] font-bold uppercase tracking-wider text-black dark:text-white mb-2.5">Partnership sought</p>
        <div className="flex flex-wrap gap-1.5">
          {PARTNERSHIP_OPTIONS.map(p => (
            <button key={p.value} type="button" onClick={() => toggle(partnerships, p.value, setPartnerships)}
              className={`h-7 px-3 rounded-full text-[13px] font-medium border transition-colors ${
                partnerships.includes(p.value)
                  ? "bg-[#2D6A4F] border-[#2D6A4F] text-white"
                  : "border-border text-muted-foreground hover:border-[#2D6A4F]/40 hover:text-[#2D6A4F]"
              }`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
function InitiativeCard({ ini, expressed, onClick, saved, onToggleSave, passed, passReason, onConfirmPass, onUndoPass }: {
  ini: InitiativeRow; expressed: boolean; onClick: () => void;
  saved: boolean; onToggleSave: (id: string, wasSaved: boolean) => void;
  passed: boolean; passReason?: string | null;
  onConfirmPass: (id: string, reason: string) => void;
  onUndoPass: (id: string) => void;
}) {
  const partnershipLabels = (ini.partnerships ?? []).slice(0, 2)
    .map(p => PARTNERSHIP_OPTIONS.find(o => o.value === p)?.label ?? p);
  const extraPartnerships = (ini.partnerships?.length ?? 0) - 2;
  return (
    <div
      role="button" tabIndex={0} onClick={onClick}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      className="h-full flex flex-col text-left rounded-2xl border border-border bg-white dark:bg-card hover:border-[#452A1D]/50 dark:hover:border-[#C45C26] hover:shadow-md transition-all duration-200 group p-5 cursor-pointer">

      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          {ini.status === "closed" && (
            <span className="text-[10px] font-medium text-black dark:text-white bg-muted px-2 py-0.5 rounded-full">
              Partnership formed
            </span>
          )}
          {(ini.confirmed_partners ?? []).some(p => p.status === "mou_executed") && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full"
              style={{ background: "rgba(45,106,79,0.12)", color: "#2D6A4F" }}>
              <Award className="w-2.5 h-2.5" />MoU
            </span>
          )}
          {expressed && ini.status !== "closed" && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#2D6A4F] bg-[rgba(45,106,79,0.12)] px-2 py-0.5 rounded-full">
              <CheckCircle2 className="w-2.5 h-2.5" />Expressed
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <ShareButton initiativeId={ini.id} title={ini.title} size="sm" />
          <DecisionIcons
            saved={saved} passed={passed} passReason={passReason}
            onToggleSave={() => onToggleSave(ini.id, saved)}
            onConfirmPass={(reason) => onConfirmPass(ini.id, reason)}
            onUndoPass={() => onUndoPass(ini.id)}
            size="sm"
          />
        </div>
      </div>

      <h3 className="text-[17px] font-bold text-foreground group-hover:text-[#2D6A4F] dark:group-hover:text-[#C45C26] transition-colors leading-snug line-clamp-2">
        {ini.title}
      </h3>

      {(ini.submitter_org || ini.submitter_name) && (
        <Link
          href={
            ini.submitter_user_type === "organisation"
              ? `/dashboard/natives?tab=organisation&user=${ini.user_id}`
              : `/dashboard/natives?tab=individual&user=${ini.user_id}`
          }
          onClick={e => e.stopPropagation()}
          className="flex items-center gap-1.5 text-[13px] font-semibold text-black dark:text-white mt-1.5 hover:underline underline-offset-2 transition-colors min-w-0">
          {ini.submitter_logo_url ? (
            <img src={ini.submitter_logo_url} alt="" className="w-8 h-8 rounded-full object-cover shrink-0 border border-border" />
          ) : (
            <Building2 className="w-3 h-3 shrink-0" />
          )}
          <span className="truncate">{ini.submitter_user_type === "organisation" ? ini.submitter_org : ini.submitter_name}</span>
          {ini.submitter_is_verified && <ShieldCheck className="w-3 h-3 shrink-0 text-[#2D6A4F]" />}
        </Link>
      )}

      {ini.problem && (
        <p className="text-[13px] text-foreground leading-relaxed mt-2 line-clamp-3">{ini.problem}</p>
      )}

      <div className="flex flex-col gap-1.5 mt-3 pt-3 border-t border-border">
        {ini.sectors && ini.sectors.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Zap className="w-3 h-3 shrink-0 text-[#C45C26]" />
            {ini.sectors.slice(0, 2).map(s => (
              <span key={s} className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                style={{ background: "rgba(196,92,38,0.12)", color: "#C45C26" }}>
                {s}
              </span>
            ))}
            {ini.sectors.length > 2 && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-black dark:text-white">
                +{ini.sectors.length - 2}
              </span>
            )}
          </div>
        )}
        {ini.esg_alignment && (
          <div className="flex items-center gap-1.5">
            <Leaf className="w-3 h-3 shrink-0 text-[#2e7d32]" />
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
              style={{ background: "rgba(46,125,50,0.12)", color: "#2e7d32" }}>
              ESG/CSR
            </span>
          </div>
        )}
        {ini.locations?.[0] && (
          <div className="flex items-center gap-1.5 text-[13px] font-medium text-indigo-700 min-w-0">
            <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s-8-4.5-8-11.8A8 8 0 0112 2a8 8 0 018 8.2c0 7.3-8 11.8-8 11.8z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            <span className="truncate">{ini.locations.slice(0, 2).join(", ")}</span>
          </div>
        )}
        {ini.budget && (
          <div className="flex items-center gap-1.5 text-[13px] font-medium text-teal-700">
            <Wallet className="w-3 h-3 shrink-0" />
            <span className="truncate">{ini.budget}</span>
          </div>
        )}
        {ini.submitter_dd_score != null && (
          <div className="flex items-center gap-1.5 text-[13px] font-medium" style={{ color: ragForScore(ini.submitter_dd_score, 40, 70).text }}>
            <FileCheck className="w-3 h-3 shrink-0" />
            DD: {ini.submitter_dd_score}%
            {ini.submitter_trust_tier && <TrustBadge tier={ini.submitter_trust_tier} />}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-border">
        <div className="flex flex-wrap gap-1 min-w-0">
          {partnershipLabels.map(label => (
            <span key={label} className="text-[10px] px-2 py-0.5 rounded-full border border-border text-black dark:text-white capitalize">
              {label}
            </span>
          ))}
          {extraPartnerships > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full border border-border text-black dark:text-white">
              +{extraPartnerships}
            </span>
          )}
        </div>
        <span className="text-[13px] font-bold text-black dark:text-white shrink-0">
          {ini.eois} EOI{ini.eois !== 1 ? "s" : ""}
        </span>
      </div>

      <button type="button" onClick={e => { e.stopPropagation(); onClick(); }}
        className="mt-3 self-center text-[13px] font-semibold text-white bg-[#2D6A4F] hover:bg-[#245c43] dark:bg-[#C45C26] dark:hover:bg-[#b34f1f] rounded-full px-4 py-2 shadow-sm hover:shadow-md transition-all">
        View Initiative
      </button>
    </div>
  );
}
export default function DashboardMarketplace() {
  const [initiatives, setInitiatives]     = useState<InitiativeRow[]>([]);
  const { sectors: dynamicSectors, locations: dynamicLocations } = useDynamicOptions(initiatives);
  const [locations, setLocations]     = useState<string[]>([]);
  const [search, setSearch]               = useState("");
  const [showFilters, setShowFilters]     = useState(false);
  const [selected, setSelected]           = useState<InitiativeRow | null>(null);
  const [expressedIds, setExpressedIds]   = useState<Set<string>>(new Set());
  const { user, profile, orgOwnerId } = useAuth();
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
  async function handleConfirmPass(id: string, reason: string) {
    if (!orgOwnerId) return;
    await supabase.from("funder_decisions").upsert({
      funder_id: orgOwnerId,
      initiative_id: id,
      decision: "pass",
      reason,
    }, { onConflict: "funder_id,initiative_id" });
    setPassedIds(prev => new Set(prev).add(id));
    setPassReasons(prev => ({ ...prev, [id]: reason }));
  }
  async function handleUndoPass(id: string) {
    if (!orgOwnerId) return;
    await supabase.from("funder_decisions").delete()
      .eq("funder_id", orgOwnerId).eq("initiative_id", id);
    setPassedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
    setPassReasons(prev => { const next = { ...prev }; delete next[id]; return next; });
  }
  const [loading, setLoading] = useState(true);
  const [startupPipeline, setStartupPipeline] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [showPassed, setShowPassed] = useState(false);
  const [passedIds, setPassedIds] = useState<Set<string>>(new Set());
  const [passReasons, setPassReasons] = useState<Record<string, string>>({});
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
    if (!orgOwnerId) return;
    Promise.all([
      supabase
        .from("funder_decisions")
        .select("initiative_id, decision, reason")
        .eq("funder_id", orgOwnerId),
      supabase.from("expressions_of_interest").select("initiative_id").eq("user_id", orgOwnerId),
    ]).then(([{ data: decisionsData }, { data: eoiData }]) => {
      const ids = new Set<string>();
      const reasons: Record<string, string> = {};
      (decisionsData ?? []).forEach((r: any) => {
        if (r.decision === "pass") {
          ids.add(r.initiative_id);
          if (r.reason) reasons[r.initiative_id] = r.reason;
        }
      });
      setPassedIds(ids);
      setPassReasons(reasons);
      if (eoiData) setExpressedIds(new Set(eoiData.map((d: any) => d.initiative_id)));
    });
  }, [orgOwnerId]);
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
      const { data } = await supabase.rpc('get_marketplace_initiatives');
      if (data && data.length > 0) {
        const enriched = (data as any[]).map(ini => {
          const hasOrg = ini.org_dd_evidence !== null;
          let score: number | null = null;
          let tier: string | null = null;
          if (hasOrg) {
            const org = {
              organisation_type: ini.org_organisation_type,
              dd_financial_model: ini.org_dd_financial_model,
              dd_audited_accounts: ini.org_dd_audited_accounts,
              dd_governance_doc: ini.org_dd_governance_doc,
              dd_esg_assessment: ini.org_dd_esg_assessment,
              dd_impact_framework: ini.org_dd_impact_framework,
              dd_environmental_policy: ini.org_dd_environmental_policy,
              dd_safeguarding_policy: ini.org_dd_safeguarding_policy,
              dd_legal_registration: ini.org_dd_legal_registration,
              dd_legal_compliance_declaration: ini.org_dd_legal_compliance_declaration,
              dd_evidence: ini.org_dd_evidence,
              fdd_disbursement_track_record: ini.org_fdd_disbursement_track_record,
              fdd_decision_transparency: ini.org_fdd_decision_transparency,
              fdd_conflict_disclosure: ini.org_fdd_conflict_disclosure,
              fdd_governance_doc: ini.org_fdd_governance_doc,
              fdd_esg_framework: ini.org_fdd_esg_framework,
              fdd_legal_registration: ini.org_fdd_legal_registration,
            };
            const items = ddItemsFor(org);
            score = Math.round((items.filter(Boolean).length / items.length) * 100);
            tier = computeTrustTier(score, org.dd_evidence).tier;
          }
          return {
            ...ini,
            submitter_is_verified: ini.profile_is_verified ?? false,
            submitter_org_type:    ini.profile_org_type ?? ini.profile_user_type ?? null,
            submitter_name:        ini.profile_full_name ?? null,
            submitter_user_type:   ini.profile_user_type ?? null,
            submitter_dd_score:    score,
            submitter_trust_tier:  tier,
            // NOTE: assumes get_marketplace_initiatives returns org_logo_url /
            // profile_avatar_url alongside the other org_*/profile_* columns
            // already read above. If the RPC uses different column names,
            // update these two keys to match.
            submitter_logo_url:    ini.org_logo_url ?? ini.profile_avatar_url ?? null,
          };
        });
        setInitiatives(enriched as InitiativeRow[]);
      }
      setLoading(false);
    }
    load();
  }, []);
  const filtered = initiatives.filter(ini => {
    if (showSaved && !savedIds.has(ini.id)) return false;
    if (showPassed && !passedIds.has(ini.id)) return false;
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
        saved={savedIds.has(selected.id)}
        passed={passedIds.has(selected.id)}
        passReason={passReasons[selected.id]}
        onToggleSave={() => handleToggleSave(selected.id, savedIds.has(selected.id))}
        onConfirmPass={(reason) => handleConfirmPass(selected.id, reason)}
        onUndoPass={() => handleUndoPass(selected.id)}
      />
    );
  }
  return (
    <div className="flex flex-col -mt-[39px] -mb-10" style={{ height: "calc(100vh - 81px)", maxHeight: "calc(100vh - 81px)", overflow: "hidden" }}>
      <div className="shrink-0 space-y-4 pb-4">
        <div className="flex items-center justify-end">
          <button type="button" onClick={() => setShowCreateModal(true)}
            className="rounded-full h-9 px-5 bg-[#2D6A4F] hover:bg-[#245c43] text-white text-[15px] font-medium transition-colors shrink-0">
            + Create Initiative
          </button>
        </div>
        {isFunder && (
          <div className="flex gap-2">
            <button type="button" onClick={toggleStartupPipeline}
              className={`h-8 px-4 rounded-full border text-[13px] font-medium transition-colors flex items-center gap-1.5 ${
                startupPipeline
                  ? "bg-[#2D6A4F] border-[#2D6A4F] text-white"
                  : "border-border text-muted-foreground hover:border-[#2D6A4F]/40 hover:text-[#2D6A4F]"
              }`}>
              <Sparkles className="w-3 h-3" />
              Startup pipeline
            </button>
            <button type="button" onClick={clearFilters}
              className="h-8 px-4 rounded-full border border-border text-[13px] text-muted-foreground hover:text-foreground transition-colors">
              All initiatives
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input type="text" placeholder="Search by title, problem, location..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full h-10 pl-9 pr-3 rounded-lg border border-border bg-background text-[15px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors" />
            {search && (
              <button type="button" onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <Popover open={showFilters} onOpenChange={setShowFilters}>
            <PopoverTrigger asChild>
              <button type="button"
                className={`h-10 px-4 rounded-lg border text-[15px] flex items-center gap-2 transition-colors shrink-0 ${
                  showFilters || activeFilterCount > 0
                    ? "border-[#2D6A4F] text-[#2D6A4F] bg-[rgba(45,106,79,0.12)]"
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
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80 p-0 max-h-[70vh] overflow-y-auto">
              <FilterPanel
                sectors={sectors} setSectors={setSectors}
                locations={locations} setLocations={setLocations}
                budgets={budgets} setBudgets={setBudgets}
                partnerships={partnerships} setPartnerships={setPartnerships}
                onClear={clearFilters} activeCount={activeFilterCount}
                sectorOptions={dynamicSectors} locationOptions={dynamicLocations}
              />
            </PopoverContent>
          </Popover>
          <button type="button" onClick={() => setShowSaved(v => !v)}
            className={`h-10 px-4 rounded-lg border text-[15px] flex items-center gap-2 transition-colors shrink-0 ${
              showSaved
                ? "border-[#2D6A4F] text-[#2D6A4F] bg-[rgba(45,106,79,0.12)]"
                : "border-border text-muted-foreground hover:border-foreground/30"
            }`}>
            <Bookmark className="w-4 h-4" fill={showSaved ? "#2D6A4F" : "none"} />
            Saved
            {savedIds.size > 0 && (
              <span className="w-4 h-4 rounded-full bg-[#2D6A4F] text-white text-[10px] flex items-center justify-center font-bold">
                {savedIds.size}
              </span>
            )}
          </button>
          <button type="button" onClick={() => setShowPassed(v => !v)}
            className={`h-10 px-4 rounded-lg border text-[15px] flex items-center gap-2 transition-colors shrink-0 ${
              showPassed
                ? "border-border text-foreground bg-muted"
                : "border-border text-muted-foreground hover:border-foreground/30"
            }`}>
            Passed
            {passedIds.size > 0 && (
              <span className="w-4 h-4 rounded-full bg-muted-foreground text-white text-[10px] flex items-center justify-center font-bold">
                {passedIds.size}
              </span>
            )}
          </button>
        </div>
        {activeFilterCount > 0 && !showFilters && (
          <div className="flex flex-wrap gap-2 items-center">
            {[
              ...sectors, ...locations,
              ...budgets.map(b => BUDGET_OPTIONS.find(o => o.value === b)?.label ?? b),
              ...partnerships.map(p => PARTNERSHIP_OPTIONS.find(o => o.value === p)?.label ?? p),
            ].map(chip => (
              <span key={chip} className="inline-flex items-center gap-1 h-7 px-3 rounded-full text-[13px] bg-[rgba(45,106,79,0.12)] text-[#2D6A4F] border border-[#2D6A4F]/20">
                {chip}
              </span>
            ))}
            <button type="button" onClick={clearFilters} className="text-[13px] text-muted-foreground hover:text-foreground underline">
              Clear all
            </button>
          </div>
        )}
        {!loading && (
          <p className="text-[13px] text-black dark:text-white">
            {filtered.length} initiative{filtered.length !== 1 ? "s" : ""}
            {showSaved ? " saved" : showPassed ? " passed" : activeFilterCount > 0 ? " matching filters" : ""}
          </p>
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto -mx-6 px-6">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-5 h-5 text-[#2D6A4F] animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-border bg-white dark:bg-card p-12 text-center">
            <p className="text-foreground font-medium mb-2">
              {initiatives.length === 0 ? "No initiatives published yet." : "No results for those filters."}
            </p>
            <p className="text-[15px] text-black dark:text-white max-w-sm mx-auto">
              {initiatives.length === 0 ? "Check back soon." : "Try adjusting your filters or search term."}
            </p>
            {activeFilterCount > 0 && (
              <button type="button" onClick={() => { clearFilters(); setSearch(""); }}
                className="mt-5 text-[15px] text-primary hover:underline">
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(ini => (
              <InitiativeCard key={ini.id} ini={ini}
                saved={savedIds.has(ini.id)}
                onToggleSave={handleToggleSave}
                passed={passedIds.has(ini.id)}
                passReason={passReasons[ini.id]}
                onConfirmPass={handleConfirmPass}
                onUndoPass={handleUndoPass}
                expressed={expressedIds.has(ini.id)}
                onClick={() => { setSelected(ini); window.scrollTo(0, 0); }} />
            ))}
          </div>
        )}
      </div>
    <CreateInitiativeModalDashboard
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {}}
      />
    </div>
  );
}
// ── Deal-room detail page: color tokens & small building blocks ────────────────
const FOREST = "#1B4D3E";
const SDG_CARD_PALETTE = ["#DC2626", "#16A34A", "#2563EB", "#D97706", "#7C3AED", "#DB2777"];

// Shared "no border, soft glow instead" card treatment used across the
// redesigned detail page in place of border-slate-200 boxes.
const CARD = "bg-white dark:bg-[#1A1A1A] border border-[#E5E7EB] dark:border-[#262626] rounded-2xl shadow-[0_1px_2px_rgba(27,77,62,0.06),0_10px_28px_-10px_rgba(27,77,62,0.16)]";
const CARD_SM = "bg-white dark:bg-[#1A1A1A] border border-[#E5E7EB] dark:border-[#262626] rounded-xl shadow-[0_1px_2px_rgba(27,77,62,0.05),0_6px_16px_-8px_rgba(27,77,62,0.14)]";

// Official UN SDG colors, keyed by goal number.
const SDG_OFFICIAL_COLORS: Record<number, string> = {
  1: "#E5243B", 2: "#DDA63A", 3: "#4C9F38", 4: "#C5192D", 5: "#FF3A21",
  6: "#26BDE2", 7: "#FCC30B", 8: "#A21942", 9: "#FD6925", 10: "#DD1367",
  11: "#FD9D24", 12: "#BF8B2E", 13: "#3F7E44", 14: "#0A97D9", 15: "#56C02B",
  16: "#00689D", 17: "#19486A",
};

// Splits an initiative's `detail_content` HTML into a map of section heading
// text -> inner HTML, keyed by each <h2>'s exact text (e.g. "Executive
// Summary"). This is a browser-only helper: assigning to a detached div's
// innerHTML lets the browser's own HTML parser normalize malformed source
// nesting (some initiatives store an <h2> wrapped inside a stray <p>, which
// the browser auto-closes per standard HTML parsing rules) before we walk
// the now-flat top-level child nodes. A regex-based split can't rely on
// that normalization and would break on the inconsistent nesting.
function splitDetailSections(html: string | null | undefined): Record<string, string> {
  if (!html || typeof document === "undefined") return {};
  const container = document.createElement("div");
  container.innerHTML = html;
  const sections: Record<string, string> = {};
  let current: string | null = null;
  let buffer: string[] = [];
  Array.from(container.childNodes).forEach(node => {
    if (node.nodeType === 1 && (node as HTMLElement).tagName === "H2") {
      if (current) sections[current] = buffer.join("");
      current = (node as HTMLElement).textContent?.trim() ?? "";
      buffer = [];
    } else if (current) {
      const el = node as HTMLElement;
      buffer.push(el.outerHTML ?? el.textContent ?? "");
    }
  });
  if (current) sections[current] = buffer.join("");
  return sections;
}

// Renders a verbatim HTML section (from splitDetailSections) with consistent
// typography. listStyle "check" gives <li> items a forest checkmark instead
// of a bullet -- used for real checklist-style sections (Expected Outcomes,
// Monitoring and Evaluation) where the source data already contains actual
// percentages and timeframes, not placeholder text.
function VerbatimSection({ html, listStyle = "plain" }: { html: string; listStyle?: "check" | "plain" }) {
  const listClasses = listStyle === "check"
    ? "[&_ul]:list-none [&_ul]:space-y-2.5 [&_li]:pl-6 [&_li]:relative [&_li]:before:content-['✓'] [&_li]:before:absolute [&_li]:before:left-0 [&_li]:before:font-bold [&_li]:before:text-[#1B4D3E]"
    : "[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-2";
  return (
    <div
      className={`text-[16px] text-[#0F172A] dark:text-[#F5F5F5] leading-relaxed [&_p]:mb-3 [&_p:last-child]:mb-0 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-[#0F172A] dark:text-[#F5F5F5] [&_h2]:mt-6 [&_h2]:mb-2 [&_h2:first-child]:mt-0 ${listClasses}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// Extracts each <li> from a parsed "SDG Alignment" section and colors it
// with the real, official UN SDG color for the goal number it starts with
// (falls back to forest green if a line doesn't start with a recognizable
// "SDG <n>" pattern).
function parseSdgListItems(html: string): { text: string; color: string }[] {
  if (typeof document === "undefined") return [];
  const container = document.createElement("div");
  container.innerHTML = html;
  return Array.from(container.querySelectorAll("li")).map(li => {
    const text = li.textContent?.trim() ?? "";
    const match = text.match(/SDG\s*(\d+)/i);
    const num = match ? parseInt(match[1], 10) : null;
    return { text, color: (num && SDG_OFFICIAL_COLORS[num]) || FOREST };
  });
}

const BURNT_ORANGE = "#D96B27";
const BURNT_ORANGE_HOVER = "#C25A1E";

const MILESTONE_STAGES: { key: string; title: string; desc: string }[] = [
  { key: "concept",  title: "Concept",  desc: "Idea defined, no funding yet" },
  { key: "planning", title: "Planning", desc: "Funded, building implementation plan" },
  { key: "active",   title: "Active",   desc: "Currently executing" },
  { key: "scaling",  title: "Scaling",  desc: "Running successfully, seeking to expand" },
];
function MilestoneTracker({ currentStage }: { currentStage?: string | null }) {
  const currentIndex = MILESTONE_STAGES.findIndex(s => s.key === currentStage);
  return (
    <div className="border-l-2 pl-6 ml-3 space-y-6" style={{ borderColor: "rgba(27,77,62,0.15)" }}>
      {MILESTONE_STAGES.map((s, i) => {
        const reached = currentIndex >= 0 && i <= currentIndex;
        const isCurrent = i === currentIndex;
        return (
          <div key={s.key} className="relative">
            <span
              className="absolute -left-[31px] top-0.5 w-4 h-4 rounded-full border-2"
              style={{
                background: reached ? FOREST : "#fff",
                borderColor: reached ? FOREST : "rgba(27,77,62,0.25)",
                boxShadow: isCurrent ? `0 0 0 3px ${FOREST}33` : "none",
              }}
            />
            <p className="text-[15px] font-bold text-[#0F172A] dark:text-[#F5F5F5]">{s.title}</p>
            <p className="text-[13px] font-normal mt-0.5 text-[#0F172A] dark:text-[#F5F5F5]">{s.desc}</p>
          </div>
        );
      })}
    </div>
  );
}

// Slide-over panel for AI-generated reports (Deal Memo, CSR Adoption Brief) --
// opens from the right over a dimmed (not blurred) backdrop, same pattern as
// the Natives drawer, so both tools feel consistent and don't push the page
// content around.
function AiSlidePanel({ open, onClose, title, icon, children }: {
  open: boolean; onClose: () => void; title: string; icon: React.ReactNode; children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (open) {
      setMounted(true);
      const raf = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
      return () => cancelAnimationFrame(raf);
    }
    if (mounted) {
      setVisible(false);
      const t = setTimeout(() => setMounted(false), 300);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!mounted) return null;
  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true">
      <div className={`absolute inset-0 transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`} onClick={onClose} style={{ background: "rgba(27,77,62,0.15)" }} />
      <div className={`absolute right-0 top-0 h-full w-full sm:w-[85%] md:w-[65%] lg:w-[520px] bg-white dark:bg-[#1A1A1A] border-l border-[#E5E7EB] dark:border-[#262626] shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out ${visible ? "translate-x-0" : "translate-x-full"}`}>
        <div className="px-6 py-4 flex items-center justify-between shrink-0" style={{ boxShadow: "0 1px 0 rgba(27,77,62,0.08)" }}>
          <p className="text-[17px] font-bold text-[#0F172A] dark:text-[#F5F5F5] flex items-center gap-2">{icon}{title}</p>
          <button type="button" onClick={onClose} className="p-1.5 rounded-full hover:bg-[#1B4D3E]/5 transition-colors">
            <X className="w-4 h-4" style={{ color: FOREST }} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {children}
        </div>
      </div>
    </div>
  );
}

// Parses percentage allocations out of a "Budget Overview" paragraph
// (e.g. "...trainer stipends (30%), platform fees (25%)...") into
// label/percentage pairs for a real bar chart. Falls back to plain prose
// rendering (in the caller) when fewer than 2 matches are found, since a
// single stray percentage isn't a reliable breakdown.
function parseBudgetItems(html: string): { label: string; pct: number }[] {
  if (typeof document === "undefined") return [];
  const container = document.createElement("div");
  container.innerHTML = html;
  const text = container.textContent ?? "";
  const items: { label: string; pct: number }[] = [];
  const re = /([A-Za-z][^,.;()]*?)\s*\((\d{1,3})%\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const label = m[1].trim().replace(/^and\s+/i, "").replace(/^,\s*/, "");
    const pct = parseInt(m[2], 10);
    if (label && pct > 0 && pct <= 100) items.push({ label, pct });
  }
  return items;
}

// Parses "Implementation Timeline" <li> items ("Phase 1 – Months 1-3:
// description") into title/description pairs for the phase stepper.
function parsePhaseItems(html: string): { title: string; desc: string }[] {
  if (typeof document === "undefined") return [];
  const container = document.createElement("div");
  container.innerHTML = html;
  return Array.from(container.querySelectorAll("li")).map(li => {
    const text = li.textContent?.trim() ?? "";
    const idx = text.indexOf(":");
    if (idx === -1) return { title: text, desc: "" };
    return { title: text.slice(0, idx).trim(), desc: text.slice(idx + 1).trim() };
  });
}

const BUDGET_BAR_COLORS = [FOREST, BURNT_ORANGE, "#3F7E44", "#0F172A", `${FOREST}99`, `${BURNT_ORANGE}99`];

function BudgetBarChart({ items }: { items: { label: string; pct: number }[] }) {
  return (
    <div className="space-y-4">
      {items.map((item, i) => (
        <div key={i}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[14px] font-normal text-[#0F172A] dark:text-[#F5F5F5] capitalize">{item.label}</span>
            <span className="text-[14px] font-bold text-[#0F172A] dark:text-[#F5F5F5]">{item.pct}%</span>
          </div>
          <div className="h-2.5 rounded-full" style={{ background: "rgba(27,77,62,0.08)" }}>
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${item.pct}%`, background: BUDGET_BAR_COLORS[i % BUDGET_BAR_COLORS.length] }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function PhaseTimeline({ items }: { items: { title: string; desc: string }[] }) {
  return (
    <div className="border-l-2 pl-6 ml-3 space-y-6" style={{ borderColor: "rgba(27,77,62,0.15)" }}>
      {items.map((p, i) => (
        <div key={i} className="relative">
          <span className="absolute -left-[31px] top-0.5 w-4 h-4 rounded-full" style={{ background: FOREST }} />
          <p className="text-[15px] font-bold text-[#0F172A] dark:text-[#F5F5F5]">{p.title}</p>
          {p.desc && <p className="text-[13px] font-normal mt-0.5 text-[#0F172A] dark:text-[#F5F5F5]">{p.desc}</p>}
        </div>
      ))}
    </div>
  );
}

function MarketplaceDetail({
  initiative, onBack, expressed, onExpressed,
  saved, passed, passReason, onToggleSave, onConfirmPass, onUndoPass,
}: {
  initiative: InitiativeRow;
  onBack: () => void;
  expressed: boolean;
  onExpressed: (id: string) => void;
  saved: boolean;
  passed: boolean;
  passReason?: string | null;
  onToggleSave: () => void;
  onConfirmPass: (reason: string) => void;
  onUndoPass: () => void;
}) {
  const { user, profile, orgOwnerId } = useAuth();
  const [, navigate] = useLocation();
  const [eoiOpen, setEoiOpen]                   = useState(false);
  const [partnershipTypes, setPartnershipTypes] = useState<string[]>([]);
  const [esgAdoption, setEsgAdoption]           = useState(false);
  const [message, setMessage]                   = useState("");
  const [aiMessageLoading, setAiMessageLoading] = useState(false);
  const [aiMessageFailed, setAiMessageFailed]   = useState(false);
  const [aiMessageRequiresUpgrade, setAiMessageRequiresUpgrade] = useState(false);
  const [submitting, setSubmitting]             = useState(false);
  const [submitted, setSubmitted]               = useState(false);
  const [eoiError, setEoiError]                 = useState<string | null>(null);
  const [alreadyExpressed, setAlreadyExpressed] = useState(expressed);
  const [questionOpen, setQuestionOpen]         = useState(false);
  const [question, setQuestion]                 = useState("");
  const [questionSubmitting, setQuestionSubmitting] = useState(false);
  const [questionSubmitted, setQuestionSubmitted]   = useState(false);
  const [detailTab, setDetailTab] = useState<"overview" | "problem" | "impact" | "budget" | "team" | "full">("overview");
  const [kebabOpen, setKebabOpen] = useState(false);
  const kebabRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!kebabOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (kebabRef.current && !kebabRef.current.contains(e.target as Node)) setKebabOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [kebabOpen]);
  const [dealSnapshotOpen, setDealSnapshotOpen] = useState(false);
  const [dealMemo, setDealMemo]                 = useState<any | null>(null);
  const [loadingMemo, setLoadingMemo]           = useState(false);
  const [memoOpen, setMemoOpen]                 = useState(false);
  const [memoRequiresUpgrade, setMemoRequiresUpgrade] = useState(false);
  const [funderMandate, setFunderMandate]       = useState<any | null>(null);
  const [csrBrief, setCsrBrief]                 = useState<any | null>(null);
  const [loadingCsr, setLoadingCsr]             = useState(false);
  const [csrOpen, setCsrOpen]                   = useState(false);
  const [csrRequiresUpgrade, setCsrRequiresUpgrade] = useState(false);
  const [csrMandate, setCsrMandate]             = useState<any | null>(null);
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
    budget_min?: number | null;
    budget_max?: number | null;
    budget_currency?: string | null;
    evaluation_report_url?: string | null;
    baseline_study_url?: string | null;
    midline_report_url?: string | null;
  } | null>(null);
  // Compares against orgOwnerId, not the literal logged-in person -- once
  // Members exist and CreateInitiativeModal/CreateInitiativeModalDashboard
  // are fixed to write initiative_requests.user_id as orgOwnerId too, a
  // Member viewing their own org's initiative still needs to see "Your
  // initiative," not "Express interest" on their own org's listing.
  const isOwnInitiative = !!orgOwnerId && initiative.user_id === orgOwnerId;
  useEffect(() => {
    if (!orgOwnerId || expressed) return;
    supabase.from("expressions_of_interest").select("id,partnership_type")
      .eq("initiative_id", initiative.id).eq("user_id", orgOwnerId).maybeSingle()
      .then(({ data }) => { if (data && data.partnership_type !== "question") setAlreadyExpressed(true); });
  }, [orgOwnerId, initiative.id]);
  const hasManuallyEditedRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!eoiOpen || partnershipTypes.length === 0 || hasManuallyEditedRef.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { generateAiMessage(); }, 700);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [eoiOpen, partnershipTypes]);
  useEffect(() => {
    supabase.from("initiative_requests")
      .select("target_population,specific_ask,stage,confirmed_assets,had_prior_experience,prior_experience_detail,start_date,duration,sdg_tags,detail_content,resource_link,co_funding_status,ai_quality_score,target_beneficiaries,target_jobs,target_female_pct,target_timeline_months,impact_evidence,budget_min,budget_max,budget_currency,evaluation_report_url,baseline_study_url,midline_report_url")
      .eq("id", initiative.id).single()
      .then(({ data }) => { if (data) setFullDetail(data); });
  }, [initiative.id]);
  const isFunder = ["philanthropic_foundation", "venture_capital"].includes(profile?.org_type ?? "");
  const isCorporate = ["corporation", "technology_company", "public_sector"].includes(profile?.org_type ?? "");
  
  useEffect(() => {
    if (!isFunder || !orgOwnerId) return;
    supabase.from("organizations")
      .select("grant_range_min,grant_range_max,grant_currency,funding_instruments,geographic_focus,stage_preference,mandate_sectors,mandate_sdgs,investment_thesis")
      .eq("user_id", orgOwnerId).single()
      .then(({ data }) => { if (data) setFunderMandate(data); });
  }, [orgOwnerId, isFunder]);
  useEffect(() => {
    if (!isCorporate || !orgOwnerId) return;
    supabase.from("organizations")
      .select("esg_frameworks,csr_budget_range,geographic_focus,mandate_sectors,mandate_sdgs,partner_type_preference")
      .eq("user_id", orgOwnerId).single()
      .then(({ data }) => { if (data) setCsrMandate({ ...data, org_type: profile?.org_type, org_name: profile?.org_name ?? null }); });
  }, [orgOwnerId, isCorporate]);
  const [initiativeOrgDd, setInitiativeOrgDd] = useState<any | null>(null);
  useEffect(() => {
    if (!initiative.user_id) return;
    supabase.from("organizations")
      .select("organisation_type,dd_financial_model,dd_audited_accounts,dd_governance_doc,dd_esg_assessment,dd_impact_framework,dd_environmental_policy,dd_safeguarding_policy,dd_legal_registration,dd_legal_compliance_declaration,dd_evidence,fdd_disbursement_track_record,fdd_decision_transparency,fdd_conflict_disclosure,fdd_governance_doc,fdd_esg_framework,fdd_legal_registration,total_beneficiaries_reached,years_of_operation,grants_received_count,grants_total_value_usd,grants_delivered_on_time_pct,previous_funders")
      .eq("user_id", initiative.user_id).single()
      .then(({ data }) => { if (data) setInitiativeOrgDd(data); });
  }, [initiative.user_id]);
  const initiativeDdItems = initiativeOrgDd ? ddItemsFor(initiativeOrgDd) : [];
  const initiativeDdScore = initiativeOrgDd
    ? Math.round((initiativeDdItems.filter(Boolean).length / initiativeDdItems.length) * 100)
    : null;
  const initiativeTrustTier = initiativeOrgDd
    ? computeTrustTier(initiativeDdScore ?? 0, initiativeOrgDd.dd_evidence).tier
    : null;
  async function submitQuestion() {
    if (!question.trim() || !user?.id || !initiative.user_id) return;
    setQuestionSubmitting(true);
    try {
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
      }
      if (conversationId) {
        await supabase.rpc("join_conversation_and_notify", {
          p_conversation_id: conversationId,
          p_notification_type: "question_received",
          p_notification_title: "A funder has a question about your initiative",
          p_notification_body: `"${question.trim().slice(0, 100)}${question.trim().length > 100 ? "..." : ""}"`,
          p_notification_link: "/dashboard/messages",
        });
        await supabase.from("conversations").update({
          status: "open",
          conversation_type: "question",
        }).eq("id", conversationId);
        await supabase.from("messages").insert({
          conversation_id: conversationId,
          sender_id: user.id,
          body: question.trim(),
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
    setAiMessageRequiresUpgrade(false);
    try {
      const { data: ep } = await supabase.from("profiles").select("full_name,org_name,user_type,sectors").eq("id", user!.id).single();
      const { data: orgRow } = await supabase.from("organizations").select("description,offers").eq("user_id", orgOwnerId ?? user!.id).maybeSingle();
      const expresserPersonName = ep?.full_name ?? null;
      const expresserOrgName = ep?.org_name ?? null;
      const { data: ownerProfile } = await supabase
        .from("profiles").select("full_name,org_name,user_type")
        .eq("id", initiative.user_id).maybeSingle();
      const ownerName = ownerProfile?.user_type === "organisation"
        ? (ownerProfile?.org_name ?? ownerProfile?.full_name)
        : ownerProfile?.full_name;
      const { data, error } = await supabase.functions.invoke("generate-funder-intro", {
        body: {
          expresser_name: expresserPersonName, expresser_org: expresserOrgName,
          expresser_description: orgRow?.description ?? null,
          expresser_sectors: ep?.sectors ?? [], expresser_offers: orgRow?.offers ?? [],
          initiative_title: initiative.title, initiative_problem: initiative.problem ?? null,
          initiative_outcome: initiative.outcome ?? null, initiative_sectors: initiative.sectors ?? [],
          esg_intent: false, initiative_owner_name: ownerName ?? null,
          partnership_types: partnershipTypes.map(eoiTypeLabel),
        },
      });
      if (!error && data?.message) {
        setMessage(data.message);
        hasManuallyEditedRef.current = false;
      } else if (data?.requires_upgrade) {
        setAiMessageRequiresUpgrade(true);
      } else if (error) {
        // supabase.functions.invoke puts non-2xx responses under `error`,
        // not `data` -- the requires_upgrade flag from the edge function's
        // 403 body lives in error.context and has to be parsed out here,
        // or the upgrade gate silently falls through to the generic
        // "AI draft failed" message instead of the correct upgrade prompt.
        let requiresUpgrade = false;
        try {
          const body = await (error as any)?.context?.json?.();
          requiresUpgrade = !!body?.requires_upgrade;
        } catch {
          // error body wasn't JSON or context unavailable -- fall through
        }
        if (requiresUpgrade) setAiMessageRequiresUpgrade(true);
        else setAiMessageFailed(true);
      } else {
        setAiMessageFailed(true);
      }
    } catch {
      setAiMessageFailed(true);
    }
    setAiMessageLoading(false);
  }
  async function generateCsrBrief() {
    setLoadingCsr(true);
    setCsrOpen(true);
    setCsrRequiresUpgrade(false);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${supabaseUrl}/functions/v1/generate-csr-brief`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          initiative: { ...initiative, ...fullDetail },
          csr_mandate: csrMandate,
          dd_readiness: initiativeOrgDd ? {
            financial_model: initiativeOrgDd.dd_financial_model,
            audited_accounts: initiativeOrgDd.dd_audited_accounts,
            governance_doc: initiativeOrgDd.dd_governance_doc,
            esg_assessment: initiativeOrgDd.dd_esg_assessment,
            impact_framework: initiativeOrgDd.dd_impact_framework,
            environmental_policy: initiativeOrgDd.dd_environmental_policy,
            safeguarding_policy: initiativeOrgDd.dd_safeguarding_policy,
            legal_registration: initiativeOrgDd.dd_legal_registration,
            legal_compliance_declaration: initiativeOrgDd.dd_legal_compliance_declaration,
            score: Math.round(
              (initiativeDdItems.filter(Boolean).length / initiativeDdItems.length) * 100
            ),
          } : null,
        }),
      });
      const result = await res.json();
      if (result.requires_upgrade) {
        setCsrRequiresUpgrade(true);
      } else if (result.data) {
        setCsrBrief(result.data);
      }
    } catch {
      // silent
    }
    setLoadingCsr(false);
  }
  async function generateDealMemo() {
    setLoadingMemo(true);
    setMemoOpen(true);
    setMemoRequiresUpgrade(false);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${supabaseUrl}/functions/v1/generate-deal-memo`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
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
            environmental_policy: initiativeOrgDd.dd_environmental_policy,
            safeguarding_policy: initiativeOrgDd.dd_safeguarding_policy,
            legal_registration: initiativeOrgDd.dd_legal_registration,
            legal_compliance_declaration: initiativeOrgDd.dd_legal_compliance_declaration,
            score: Math.round(
              (initiativeDdItems.filter(Boolean).length / initiativeDdItems.length) * 100
            ),
          } : null,
        }),
      });
      const result = await res.json();
      if (result.requires_upgrade) {
        setMemoRequiresUpgrade(true);
      } else if (result.data) {
        setDealMemo(result.data);
      }
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
  async function submitEOI() {
    if (!user || !orgOwnerId || (partnershipTypes.length === 0 && !esgAdoption)) return;
    setSubmitting(true); setEoiError(null);
    try {
      const combined = [partnershipTypes.join(", "), esgAdoption ? "ESG/CSR Adoption" : ""].filter(Boolean).join(" + ");
      const { data: eoiData, error: eoiErr } = await supabase.from("expressions_of_interest")
        .insert({ initiative_id: initiative.id, user_id: orgOwnerId, submitted_by_user_id: user.id, partnership_type: combined, message: message || null, esg_adoption: esgAdoption })
        .select("id").single();
      if (eoiErr) { setEoiError(eoiErr.code === "23505" ? "Your organisation has already expressed interest in this initiative." : eoiErr.message); return; }
      await supabase.rpc("increment_eoi_count", { p_initiative_id: initiative.id });
      const { data: convoResult, error: convoError } = await supabase.rpc("create_conversation", { p_initiative_id: initiative.id, p_owner_id: initiative.user_id ?? null });
      if (convoError || !convoResult) { setEoiError(`Failed to create conversation: ${convoError?.message ?? "unknown"}`); return; }
      const convoId = convoResult as string;
      const { data: ep } = await supabase.from("profiles").select("full_name,org_name,user_type").eq("id", user.id).single();
      const name = ep?.user_type === "organisation" && ep?.org_name ? ep.org_name : ep?.full_name ?? "Someone";
      const phrasedType = combinedPartnerPhrase(partnershipTypes, esgAdoption);
      await supabase.rpc("join_conversation_and_notify", {
        p_conversation_id: convoId,
        p_notification_type: "eoi_received",
        p_notification_title: "New expression of interest",
        p_notification_body: `${name} expressed ${phrasedType} interest in "${initiative.title}"`,
        p_notification_link: "/dashboard/messages?tab=initiative",
      });
      await Promise.all([
        supabase.from("expressions_of_interest").update({ conversation_id: convoId }).eq("id", eoiData.id),
        supabase.from("messages").insert({ conversation_id: convoId, sender_id: user.id, body: message?.trim() ? message : "I've expressed interest in this initiative." }),
      ]);
      setSubmitted(true); setAlreadyExpressed(true); onExpressed(initiative.id);
    } finally { setSubmitting(false); }
  }
  const canSubmit = partnershipTypes.length > 0 || esgAdoption;

  function downloadPdf() {
    const content = fullDetail?.detail_content ?? "";
    if (!content || content === "<p></p>") return;
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
    h2 { font-size: 13pt; font-weight: bold; margin-top: 28px; margin-bottom: 6px; color: #1B4D3E; border-bottom: 1px solid #e0e0e0; padding-bottom: 4px; }
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
  }
  const sections = useMemo(() => splitDetailSections(fullDetail?.detail_content), [fullDetail?.detail_content]);
  const sdgItems = useMemo(() => (sections["SDG Alignment"] ? parseSdgListItems(sections["SDG Alignment"]) : null), [sections]);
  return (
    <div className="max-w-[1100px] mx-auto space-y-6 relative">

      {/* Top row: back link + primary action pills */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <a href="#" onClick={e => { e.preventDefault(); onBack(); }}
          className="flex items-center gap-1.5 text-[15px] font-medium w-fit transition-colors" style={{ color: FOREST }}>
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          Back to marketplace
        </a>
        <div className="flex items-center gap-2 flex-wrap">
          {isFunder && (
            <button type="button" onClick={generateDealMemo} disabled={loadingMemo}
              className={`${CARD_SM} flex items-center gap-2 px-4 py-2 text-[13px] font-bold text-[#0F172A] dark:text-[#F5F5F5] hover:bg-[#1B4D3E]/5 transition-colors disabled:opacity-50`}>
              <FileText className="w-3.5 h-3.5" style={{ color: FOREST }} />
              Generate Deal Memo
              {loadingMemo && <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: FOREST }} />}
            </button>
          )}
          {isCorporate && (
            <button type="button" onClick={generateCsrBrief} disabled={loadingCsr}
              className={`${CARD_SM} flex items-center gap-2 px-4 py-2 text-[13px] font-bold text-[#0F172A] dark:text-[#F5F5F5] hover:bg-[#1B4D3E]/5 transition-colors disabled:opacity-50`}>
              <FileText className="w-3.5 h-3.5" style={{ color: FOREST }} />
              Generate CSR Brief
              {loadingCsr && <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: FOREST }} />}
            </button>
          )}
          {!isOwnInitiative && (
            <button type="button" onClick={() => { if (!alreadyExpressed) setEoiOpen(true); }} disabled={alreadyExpressed}
              className={`flex items-center gap-2 px-5 py-2 rounded-full text-[13px] font-bold transition-colors ${alreadyExpressed ? "cursor-not-allowed" : "text-white"}`}
              style={alreadyExpressed ? { background: "rgba(27,77,62,0.1)", color: FOREST } : { background: BURNT_ORANGE }}>
              <Zap className="w-3.5 h-3.5" />
              {alreadyExpressed ? "Interest Expressed" : "Express Interest"}
            </button>
          )}
        </div>
      </div>

      {/* Hero card -- static background image with a frosted glass overlay
          for legibility, per the reference. Path below assumes market.webp
          sits at the root of the public/ folder (served as /market.webp). */}
      <div className="relative rounded-2xl overflow-hidden" style={{ backgroundImage: "url('/market.webp')", backgroundSize: "cover", backgroundPosition: "center" }}>
        <div className="relative p-7 bg-white/90 dark:bg-black/75" style={{ backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
          <div className="flex items-start justify-between gap-4 mb-4">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight leading-snug text-[#0F172A] dark:text-white" style={{ letterSpacing: "-0.025em" }}>
              {initiative.title}
            </h1>
            <div className="relative shrink-0" ref={kebabRef}>
              <button type="button" onClick={() => setKebabOpen(v => !v)}
                className="h-10 w-10 rounded-full flex items-center justify-center hover:bg-[#1B4D3E]/10 transition-colors">
                <MoreVertical className="w-5 h-5" style={{ color: FOREST }} />
              </button>
              {kebabOpen && (
                <div className={`absolute right-0 mt-2 w-64 ${CARD} py-2 z-30`}>
                  <div className="flex items-center gap-3 px-4 py-2 mx-2 rounded-lg hover:bg-[#1B4D3E]/5 transition-colors">
                    <ShareButton initiativeId={initiative.id} title={initiative.title} size="sm" />
                    <span className="text-[14px] font-normal text-[#0F172A] dark:text-[#F5F5F5]">Share</span>
                  </div>
                  {!isOwnInitiative && (
                    <DecisionIcons saved={saved} passed={passed} passReason={passReason}
                      onToggleSave={onToggleSave} onConfirmPass={onConfirmPass} onUndoPass={onUndoPass} size="sm" layout="rows" />
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 mb-5">
            {initiative.submitter_logo_url ? (
              <img src={initiative.submitter_logo_url} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
            ) : (
              <span className="w-7 h-7 rounded-full text-white text-[11px] font-bold flex items-center justify-center shrink-0" style={{ background: FOREST }}>
                {(initiative.submitter_user_type === "organisation" ? initiative.submitter_org : initiative.submitter_name)?.slice(0, 2).toUpperCase()}
              </span>
            )}
            {(initiative.submitter_org || initiative.submitter_name) && (
              <Link
                href={
                  initiative.submitter_user_type === "organisation"
                    ? `/dashboard/natives?tab=organisation&user=${initiative.user_id}`
                    : `/dashboard/natives?tab=individual&user=${initiative.user_id}`
                }
                onClick={e => e.stopPropagation()}
                className="flex items-center gap-1.5 font-bold text-[#0F172A] dark:text-white hover:underline underline-offset-2 transition-colors">
                {initiative.submitter_user_type === "organisation" ? initiative.submitter_org : initiative.submitter_name}
                {initiative.submitter_is_verified && <ShieldCheck className="w-4 h-4 shrink-0" style={{ color: FOREST }} />}
              </Link>
            )}
          </div>

          <div className="flex items-center gap-5 flex-wrap text-[14px] font-semibold text-[#0F172A] dark:text-white">
            <span className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 shrink-0" style={{ color: FOREST }} />
              {initiative.locations?.join(", ") || "—"}
            </span>
            <span className="flex items-center gap-1.5">
              <Wallet className="w-4 h-4 shrink-0" style={{ color: FOREST }} />
              {initiative.budget || "—"}
            </span>
            <span className="flex items-center gap-1.5">
              <Handshake className="w-4 h-4 shrink-0" style={{ color: FOREST }} />
              {initiative.eois} EOI{initiative.eois !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>

      {(isFunder || isCorporate) && (() => {
        const legalEvidence = initiativeOrgDd?.dd_evidence?.legal_compliance_declaration ?? {};
        if (!legalEvidence.blacklistingDetail && !legalEvidence.pendingDisputesDetail) return null;
        return (
          <div className={`${CARD_SM} p-4`} style={{ boxShadow: "0 1px 2px rgba(220,38,38,0.08), 0 8px 20px -10px rgba(220,38,38,0.25)" }}>
            {legalEvidence.blacklistingDetail && (
              <p className="text-[13px] text-red-700"><span className="font-bold">Blacklisting disclosed:</span> {legalEvidence.blacklistingDetail}</p>
            )}
            {legalEvidence.pendingDisputesDetail && (
              <p className="text-[13px] text-red-700 mt-1"><span className="font-bold">Pending disputes disclosed:</span> {legalEvidence.pendingDisputesDetail}</p>
            )}
          </div>
        );
      })()}

      {/* Tabs + content */}
      {(() => {
        const hasOverview = !!(
          fullDetail?.target_beneficiaries || fullDetail?.target_jobs || fullDetail?.target_female_pct ||
          fullDetail?.target_timeline_months || sections["Executive Summary"] || initiative.problem ||
          fullDetail?.specific_ask || sections["SDG Alignment"] || (fullDetail?.sdg_tags && fullDetail.sdg_tags.length > 0)
        );
        const hasProblem = !!(
          sections["Problem Statement"] || initiative.problem || sections["Proposed Solution"] || initiative.outcome ||
          sections["Target Beneficiaries"] || fullDetail?.target_population
        );
        const hasImpact = !!(
          sections["Expected Outcomes and Impact"] || fullDetail?.impact_evidence || sections["Monitoring and Evaluation"]
        );
        const hasBudget = !!(
          sections["Budget Overview"] || initiative.budget || fullDetail?.budget_min ||
          sections["Implementation Timeline"] || fullDetail?.stage ||
          sections["Sustainability Plan"] || sections["Partnership Requirements"] ||
          (fullDetail?.confirmed_assets && fullDetail.confirmed_assets.length > 0) || fullDetail?.co_funding_status ||
          fullDetail?.evaluation_report_url || fullDetail?.baseline_study_url || fullDetail?.midline_report_url
        );
        const hasTeam = !!(
          sections["Team and Track Record"] ||
          (fullDetail?.had_prior_experience !== null && fullDetail?.had_prior_experience !== undefined) ||
          (initiativeOrgDd && (initiativeOrgDd.total_beneficiaries_reached || initiativeOrgDd.years_of_operation || initiativeOrgDd.grants_received_count))
        );
        const hasFull = !!(fullDetail?.detail_content && fullDetail.detail_content !== "<p></p>");

        const tabs: { key: "overview" | "problem" | "impact" | "budget" | "team" | "full"; label: string }[] = [
          ...(hasOverview ? [{ key: "overview" as const, label: "Overview" }] : []),
          ...(hasProblem ? [{ key: "problem" as const, label: "Problem & Solution" }] : []),
          ...(hasImpact ? [{ key: "impact" as const, label: "Impact" }] : []),
          ...(hasBudget ? [{ key: "budget" as const, label: "Budget & Timeline" }] : []),
          ...(hasTeam ? [{ key: "team" as const, label: "Team" }] : []),
          ...(hasFull ? [{ key: "full" as const, label: "Full Description" }] : []),
        ];
        if (tabs.length === 0) return null;
        const activeTab = tabs.some(t => t.key === detailTab) ? detailTab : tabs[0].key;

        const sdgFromSection = sdgItems;

        return (
          <div>
            {tabs.length > 1 && (
              <>
                <div className="flex flex-wrap gap-2">
                  {tabs.map(t => (
                    <button key={t.key} type="button" onClick={() => setDetailTab(t.key)}
                      className={`px-5 py-2.5 rounded-lg text-[14px] font-bold transition-colors ${
                        activeTab === t.key ? "text-white" : `${CARD_SM} text-[#0F172A] dark:text-[#F5F5F5]`
                      }`}
                      style={activeTab === t.key ? { background: FOREST } : {}}>
                      {t.label}
                    </button>
                  ))}
                </div>
                <div className="border-b-2 border-[#1B4D3E]/10 mt-5" />
              </>
            )}

            {activeTab === "overview" && (
              <div className="space-y-8 pt-6">
                {(fullDetail?.target_beneficiaries || fullDetail?.target_jobs || fullDetail?.target_female_pct || fullDetail?.target_timeline_months) && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {fullDetail.target_beneficiaries != null && (
                      <div className={`${CARD} p-6`}>
                        <p className="text-3xl font-bold text-[#0F172A] dark:text-[#F5F5F5]">{fullDetail.target_beneficiaries.toLocaleString()}</p>
                        <p className="text-xs font-bold text-[#0F172A] dark:text-[#F5F5F5] uppercase tracking-wider mt-2">Beneficiaries</p>
                      </div>
                    )}
                    {fullDetail.target_jobs != null && (
                      <div className={`${CARD} p-6`}>
                        <p className="text-3xl font-bold text-[#0F172A] dark:text-[#F5F5F5]">{fullDetail.target_jobs.toLocaleString()}</p>
                        <p className="text-xs font-bold text-[#0F172A] dark:text-[#F5F5F5] uppercase tracking-wider mt-2">Jobs Created</p>
                      </div>
                    )}
                    {fullDetail.target_female_pct != null && (
                      <div className={`${CARD} p-6`}>
                        <p className="text-3xl font-bold" style={{ color: FOREST }}>{fullDetail.target_female_pct}%</p>
                        <p className="text-xs font-bold text-[#0F172A] dark:text-[#F5F5F5] uppercase tracking-wider mt-2">Female Target</p>
                      </div>
                    )}
                    {fullDetail.target_timeline_months != null && (
                      <div className={`${CARD} p-6`}>
                        <p className="text-3xl font-bold" style={{ color: BURNT_ORANGE }}>{fullDetail.target_timeline_months} Mos</p>
                        <p className="text-xs font-bold text-[#0F172A] dark:text-[#F5F5F5] uppercase tracking-wider mt-2">Timeline</p>
                      </div>
                    )}
                  </div>
                )}

                {(sections["Executive Summary"] || initiative.problem) && (
                  <div className={`${CARD} p-8`}>
                    <div className="flex items-center gap-3 mb-4">
                      <Info className="w-5 h-5 shrink-0" style={{ color: FOREST }} />
                      <p className="text-xl font-bold text-[#0F172A] dark:text-[#F5F5F5]">Executive Summary</p>
                    </div>
                    {sections["Executive Summary"]
                      ? <VerbatimSection html={sections["Executive Summary"]} />
                      : <p className="text-[16px] text-[#0F172A] dark:text-[#F5F5F5] leading-relaxed">{initiative.problem}</p>}
                  </div>
                )}

                {fullDetail?.specific_ask && (
                  <div className={`${CARD} p-8`}>
                    <div className="flex items-center gap-3 mb-4">
                      <Zap className="w-5 h-5 shrink-0" style={{ color: FOREST }} />
                      <p className="text-xl font-bold text-[#0F172A] dark:text-[#F5F5F5]">Specific Ask</p>
                    </div>
                    <p className="text-[16px] text-[#0F172A] dark:text-[#F5F5F5] leading-relaxed">{fullDetail.specific_ask}</p>
                  </div>
                )}

                {(sdgFromSection || (fullDetail?.sdg_tags && fullDetail.sdg_tags.length > 0)) && (
                  <div className={`${CARD} p-8`}>
                    <div className="flex items-center gap-3 mb-5">
                      <Globe className="w-5 h-5 shrink-0" style={{ color: FOREST }} />
                      <p className="text-xl font-bold text-[#0F172A] dark:text-[#F5F5F5]">SDG Alignment</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                      {sdgFromSection
                        ? sdgFromSection.map((item, i) => (
                            <div key={i} className="flex items-center gap-2.5">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: item.color }} />
                              <p className="text-[15px] font-semibold text-[#0F172A] dark:text-[#F5F5F5]">{item.text}</p>
                            </div>
                          ))
                        : fullDetail!.sdg_tags!.map((s, i) => (
                            <div key={s} className="flex items-center gap-2.5">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: SDG_CARD_PALETTE[i % SDG_CARD_PALETTE.length] }} />
                              <p className="text-[15px] font-semibold text-[#0F172A] dark:text-[#F5F5F5]">{s}</p>
                            </div>
                          ))}
                    </div>
                  </div>
                )}

                {sections["Partnership Requirements"] && (
                  <div className={`${CARD} p-8`}>
                    <div className="flex items-center gap-3 mb-4">
                      <Handshake className="w-5 h-5 shrink-0" style={{ color: FOREST }} />
                      <p className="text-xl font-bold text-[#0F172A] dark:text-[#F5F5F5]">Partnership Requirements</p>
                    </div>
                    <VerbatimSection html={sections["Partnership Requirements"]} />
                  </div>
                )}
              </div>
            )}

            {activeTab === "problem" && (
              <div className="space-y-8 pt-6">
                {(sections["Problem Statement"] || initiative.problem) && (
                  <div className={`${CARD} p-8`}>
                    <div className="flex items-center gap-3 mb-4">
                      <AlertTriangle className="w-5 h-5 shrink-0" style={{ color: BURNT_ORANGE }} />
                      <p className="text-xl font-bold text-[#0F172A] dark:text-[#F5F5F5]">Problem Statement</p>
                    </div>
                    {sections["Problem Statement"]
                      ? <VerbatimSection html={sections["Problem Statement"]} />
                      : <p className="text-[16px] text-[#0F172A] dark:text-[#F5F5F5] leading-relaxed">{initiative.problem}</p>}
                  </div>
                )}
                {(sections["Proposed Solution"] || initiative.outcome) && (
                  <div className={`${CARD} p-8`}>
                    <div className="flex items-center gap-3 mb-4">
                      <Lightbulb className="w-5 h-5 shrink-0" style={{ color: BURNT_ORANGE }} />
                      <p className="text-xl font-bold text-[#0F172A] dark:text-[#F5F5F5]">Proposed Solution</p>
                    </div>
                    {sections["Proposed Solution"]
                      ? <VerbatimSection html={sections["Proposed Solution"]} />
                      : <p className="text-[16px] text-[#0F172A] dark:text-[#F5F5F5] leading-relaxed">{initiative.outcome}</p>}
                  </div>
                )}
                {(sections["Target Beneficiaries"] || fullDetail?.target_population) && (
                  <div className={`${CARD} p-8`}>
                    <div className="flex items-center gap-3 mb-4">
                      <Users className="w-5 h-5 shrink-0" style={{ color: BURNT_ORANGE }} />
                      <p className="text-xl font-bold text-[#0F172A] dark:text-[#F5F5F5]">Target Beneficiaries</p>
                    </div>
                    {sections["Target Beneficiaries"]
                      ? <VerbatimSection html={sections["Target Beneficiaries"]} />
                      : <p className="text-[16px] text-[#0F172A] dark:text-[#F5F5F5] leading-relaxed">{fullDetail!.target_population}</p>}
                  </div>
                )}
              </div>
            )}

            {activeTab === "impact" && (
              <div className="space-y-8 pt-6">
                {sections["Expected Outcomes and Impact"] && (
                  <div className={`${CARD} p-8`}>
                    <div className="flex items-center gap-3 mb-4">
                      <CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: BURNT_ORANGE }} />
                      <p className="text-xl font-bold text-[#0F172A] dark:text-[#F5F5F5]">Expected Outcomes and Impact</p>
                    </div>
                    <VerbatimSection html={sections["Expected Outcomes and Impact"]} listStyle="check" />
                  </div>
                )}
                {fullDetail?.impact_evidence && (
                  <div className={`${CARD} p-8`}>
                    <div className="flex items-center gap-3 mb-4">
                      <FileCheck className="w-5 h-5 shrink-0" style={{ color: BURNT_ORANGE }} />
                      <p className="text-xl font-bold text-[#0F172A] dark:text-[#F5F5F5]">Impact Evidence</p>
                    </div>
                    <p className="text-[16px] text-[#0F172A] dark:text-[#F5F5F5] leading-relaxed">{fullDetail.impact_evidence}</p>
                  </div>
                )}
                {sections["Monitoring and Evaluation"] && (
                  <div className={`${CARD} p-8`}>
                    <div className="flex items-center gap-3 mb-4">
                      <BarChart3 className="w-5 h-5 shrink-0" style={{ color: BURNT_ORANGE }} />
                      <p className="text-xl font-bold text-[#0F172A] dark:text-[#F5F5F5]">Monitoring and Evaluation</p>
                    </div>
                    <VerbatimSection html={sections["Monitoring and Evaluation"]} listStyle="check" />
                  </div>
                )}
              </div>
            )}

            {activeTab === "budget" && (
              <div className="space-y-8 pt-6">
                {(() => {
                  const budgetItems = sections["Budget Overview"] ? parseBudgetItems(sections["Budget Overview"]) : [];
                  const totalLabel = fullDetail?.budget_min && fullDetail?.budget_max
                    ? `${fullDetail.budget_currency ?? ""} ${fullDetail.budget_min.toLocaleString()}–${fullDetail.budget_max.toLocaleString()}`.trim()
                    : initiative.budget;
                  if (!sections["Budget Overview"] && !totalLabel) return null;
                  return (
                    <div className={`${CARD} p-8`}>
                      <div className="flex items-center justify-between flex-wrap gap-2 mb-5">
                        <div className="flex items-center gap-3">
                          <Wallet className="w-5 h-5 shrink-0" style={{ color: BURNT_ORANGE }} />
                          <p className="text-xl font-bold text-[#0F172A] dark:text-[#F5F5F5]">Budget Overview</p>
                        </div>
                        {totalLabel && <span className="text-[14px] font-bold text-[#0F172A] dark:text-[#F5F5F5]">Total: {totalLabel}</span>}
                      </div>
                      {budgetItems.length >= 2 ? (
                        <BudgetBarChart items={budgetItems} />
                      ) : sections["Budget Overview"] ? (
                        <VerbatimSection html={sections["Budget Overview"]} />
                      ) : (
                        <p className="text-[16px] text-[#0F172A] dark:text-[#F5F5F5] leading-relaxed">{totalLabel}</p>
                      )}
                    </div>
                  );
                })()}

                {(() => {
                  const phaseItems = sections["Implementation Timeline"] ? parsePhaseItems(sections["Implementation Timeline"]) : [];
                  return (
                    <div className={`${CARD} p-8`}>
                      <div className="flex items-center gap-3 mb-5">
                        <Clock className="w-5 h-5 shrink-0" style={{ color: BURNT_ORANGE }} />
                        <p className="text-xl font-bold text-[#0F172A] dark:text-[#F5F5F5]">Implementation Timeline</p>
                      </div>
                      {phaseItems.length > 0 ? <PhaseTimeline items={phaseItems} /> : <MilestoneTracker currentStage={fullDetail?.stage} />}
                    </div>
                  );
                })()}

                {sections["Sustainability Plan"] && (
                  <div className={`${CARD} p-8`}>
                    <div className="flex items-center gap-3 mb-4">
                      <Leaf className="w-5 h-5 shrink-0" style={{ color: BURNT_ORANGE }} />
                      <p className="text-xl font-bold text-[#0F172A] dark:text-[#F5F5F5]">Sustainability Plan</p>
                    </div>
                    <VerbatimSection html={sections["Sustainability Plan"]} />
                  </div>
                )}

                {fullDetail?.confirmed_assets && fullDetail.confirmed_assets.length > 0 && !fullDetail.confirmed_assets.includes("none") && (
                  <div className={`${CARD} p-8`}>
                    <p className="text-xl font-bold text-[#0F172A] dark:text-[#F5F5F5] mb-4">Already Confirmed</p>
                    <div className="flex flex-wrap gap-2">
                      {fullDetail.confirmed_assets.filter(a => a !== "none").map(a => (
                        <span key={a} className={`${CARD_SM} text-[13px] font-bold px-3 py-1.5 text-[#0F172A] dark:text-[#F5F5F5] capitalize`}>{a.replace(/_/g, " ")}</span>
                      ))}
                    </div>
                  </div>
                )}

                {fullDetail?.co_funding_status && (
                  <div className={`${CARD} p-8`}>
                    <div className="flex items-center gap-3 mb-2">
                      <Wallet className="w-5 h-5 shrink-0" style={{ color: BURNT_ORANGE }} />
                      <p className="text-xl font-bold text-[#0F172A] dark:text-[#F5F5F5]">Funding Status</p>
                    </div>
                    <p className="text-[16px] text-[#0F172A] dark:text-[#F5F5F5]">{CO_FUNDING_LABELS[fullDetail.co_funding_status] ?? fullDetail.co_funding_status}</p>
                  </div>
                )}

                {(fullDetail?.evaluation_report_url || fullDetail?.baseline_study_url || fullDetail?.midline_report_url) && (
                  <div className={`${CARD} p-8`}>
                    <div className="flex items-center gap-3 mb-4">
                      <FileText className="w-5 h-5 shrink-0" style={{ color: BURNT_ORANGE }} />
                      <p className="text-xl font-bold text-[#0F172A] dark:text-[#F5F5F5]">Documents &amp; Evidence</p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {fullDetail.evaluation_report_url && (
                        <a href={fullDetail.evaluation_report_url} target="_blank" rel="noopener noreferrer"
                          className={`${CARD_SM} inline-flex items-center gap-2 px-4 py-2.5 text-[14px] font-bold text-[#0F172A] dark:text-[#F5F5F5] hover:bg-[#1B4D3E]/5 transition-colors`}>
                          View Evaluation Report
                        </a>
                      )}
                      {fullDetail.baseline_study_url && (
                        <a href={fullDetail.baseline_study_url} target="_blank" rel="noopener noreferrer"
                          className={`${CARD_SM} inline-flex items-center gap-2 px-4 py-2.5 text-[14px] font-bold text-[#0F172A] dark:text-[#F5F5F5] hover:bg-[#1B4D3E]/5 transition-colors`}>
                          View Baseline Study
                        </a>
                      )}
                      {fullDetail.midline_report_url && (
                        <a href={fullDetail.midline_report_url} target="_blank" rel="noopener noreferrer"
                          className={`${CARD_SM} inline-flex items-center gap-2 px-4 py-2.5 text-[14px] font-bold text-[#0F172A] dark:text-[#F5F5F5] hover:bg-[#1B4D3E]/5 transition-colors`}>
                          View Midline Report
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "team" && (
              <div className="space-y-8 pt-6">
                {(sections["Team and Track Record"] || (fullDetail?.had_prior_experience !== null && fullDetail?.had_prior_experience !== undefined)) && (
                  <div className={`${CARD} p-8`}>
                    <div className="flex items-center gap-3 mb-4">
                      <ShieldCheck className="w-5 h-5 shrink-0" style={{ color: BURNT_ORANGE }} />
                      <p className="text-xl font-bold text-[#0F172A] dark:text-[#F5F5F5]">Team and Track Record</p>
                    </div>
                    {sections["Team and Track Record"] ? (
                      <VerbatimSection html={sections["Team and Track Record"]} />
                    ) : (
                      <p className="text-[16px] text-[#0F172A] dark:text-[#F5F5F5] leading-relaxed">
                        {fullDetail!.had_prior_experience ? "The team has led similar initiatives before." : "This is a first initiative of this type for the team."}
                        {fullDetail!.prior_experience_detail ? ` ${fullDetail!.prior_experience_detail}` : ""}
                      </p>
                    )}
                  </div>
                )}

                {initiativeOrgDd && (initiativeOrgDd.total_beneficiaries_reached || initiativeOrgDd.years_of_operation || initiativeOrgDd.grants_received_count) && (
                  <div className={`${CARD} p-8`}>
                    <p className="text-xl font-bold text-[#0F172A] dark:text-[#F5F5F5] mb-5">Organization Track Record</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
                      {initiativeOrgDd.total_beneficiaries_reached != null && (
                        <div><p className="text-xs font-bold text-[#0F172A] dark:text-[#F5F5F5] uppercase tracking-wider mb-1">Beneficiaries Reached</p><p className="text-[15px] font-normal text-[#0F172A] dark:text-[#F5F5F5]">{initiativeOrgDd.total_beneficiaries_reached.toLocaleString()}</p></div>
                      )}
                      {initiativeOrgDd.years_of_operation != null && (
                        <div><p className="text-xs font-bold text-[#0F172A] dark:text-[#F5F5F5] uppercase tracking-wider mb-1">Years Operating</p><p className="text-[15px] font-normal text-[#0F172A] dark:text-[#F5F5F5]">{initiativeOrgDd.years_of_operation}</p></div>
                      )}
                      {initiativeOrgDd.grants_received_count != null && (
                        <div><p className="text-xs font-bold text-[#0F172A] dark:text-[#F5F5F5] uppercase tracking-wider mb-1">Grants Received</p><p className="text-[15px] font-normal text-[#0F172A] dark:text-[#F5F5F5]">{initiativeOrgDd.grants_received_count}</p></div>
                      )}
                      {initiativeOrgDd.grants_total_value_usd != null && (
                        <div><p className="text-xs font-bold text-[#0F172A] dark:text-[#F5F5F5] uppercase tracking-wider mb-1">Total Grant Value</p><p className="text-[15px] font-normal text-[#0F172A] dark:text-[#F5F5F5]">${initiativeOrgDd.grants_total_value_usd.toLocaleString()}</p></div>
                      )}
                      {initiativeOrgDd.grants_delivered_on_time_pct != null && (
                        <div><p className="text-xs font-bold text-[#0F172A] dark:text-[#F5F5F5] uppercase tracking-wider mb-1">Delivered On Time</p><p className="text-[15px] font-normal text-[#0F172A] dark:text-[#F5F5F5]">{initiativeOrgDd.grants_delivered_on_time_pct}%</p></div>
                      )}
                    </div>
                    {initiativeOrgDd.previous_funders && initiativeOrgDd.previous_funders.length > 0 && (
                      <p className="text-[15px] text-[#0F172A] dark:text-[#F5F5F5] mt-5"><span className="font-bold">Previous funders:</span> {initiativeOrgDd.previous_funders.join(", ")}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === "full" && (
              <div className="pt-6">
                <div className={`${CARD} p-8`}>
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 shrink-0" style={{ color: BURNT_ORANGE }} />
                      <p className="text-xl font-bold text-[#0F172A] dark:text-[#F5F5F5]">Full Description</p>
                    </div>
                    <button type="button" onClick={downloadPdf}
                      className="inline-flex items-center gap-2 text-[13px] font-bold px-4 py-2.5 rounded-lg text-white transition-opacity hover:opacity-90"
                      style={{ background: FOREST }}>
                      <Download className="w-3.5 h-3.5" />
                      Download as PDF
                    </button>
                  </div>
                  {fullDetail?.detail_content && fullDetail.detail_content !== "<p></p>" ? (
                    <VerbatimSection html={fullDetail.detail_content} />
                  ) : (
                    <p className="text-[16px] text-[#0F172A] dark:text-[#F5F5F5]">No detailed description was provided for this initiative.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Floating Initiative Snapshot trigger -- takes no layout space until opened */}
      <button type="button" onClick={() => setDealSnapshotOpen(true)}
        className="fixed right-0 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 bg-white dark:bg-[#1A1A1A] border border-r-0 border-[#E5E7EB] dark:border-[#262626] rounded-l-xl px-2.5 py-4 hover:pr-4 transition-all z-20"
        style={{ writingMode: "vertical-rl" as any, boxShadow: "0 1px 2px rgba(27,77,62,0.06), -8px 4px 20px -8px rgba(27,77,62,0.18)" }}>
        <LayoutGrid className="w-4 h-4 shrink-0" style={{ color: BURNT_ORANGE, writingMode: "horizontal-tb" as any }} />
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#0F172A] dark:text-[#F5F5F5]">Initiative Snapshot</span>
      </button>

      {dealSnapshotOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setDealSnapshotOpen(false)} style={{ background: "rgba(27,77,62,0.15)" }} />
      )}
      <div className={`fixed right-0 top-0 h-full w-full sm:w-[85%] md:w-[60%] lg:w-[460px] bg-white dark:bg-[#1A1A1A] border-l border-[#E5E7EB] dark:border-[#262626] shadow-2xl flex flex-col z-50 transition-transform duration-300 ease-in-out ${dealSnapshotOpen ? "translate-x-0" : "translate-x-full"}`}>
        <div className="px-6 py-5 flex items-center justify-between shrink-0" style={{ boxShadow: "0 1px 0 rgba(27,77,62,0.08)" }}>
          <p className="text-[17px] font-bold text-[#0F172A] dark:text-[#F5F5F5] flex items-center gap-2">
            <LayoutGrid className="w-4 h-4" style={{ color: BURNT_ORANGE }} />
            Initiative Snapshot
          </p>
          <button type="button" onClick={() => setDealSnapshotOpen(false)} className="p-1.5 rounded-full hover:bg-[#1B4D3E]/5 transition-colors">
            <X className="w-4 h-4" style={{ color: FOREST }} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          <div className="grid grid-cols-2 gap-5">
            <div>
              <p className="text-xs font-bold text-[#0F172A] dark:text-[#F5F5F5] uppercase tracking-wider mb-1 flex items-center gap-1.5"><Award className="w-3.5 h-3.5" style={{ color: FOREST }} />DD Readiness</p>
              <p className="text-[15px] font-normal" style={{ color: initiativeDdScore != null ? FOREST : "#0F172A" }}>
                {initiativeDdScore != null ? `${initiativeDdScore}%${initiativeTrustTier ? ` (${initiativeTrustTier})` : ""}` : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold text-[#0F172A] dark:text-[#F5F5F5] uppercase tracking-wider mb-1 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" style={{ color: FOREST }} />Location</p>
              <p className="text-[15px] font-normal text-[#0F172A] dark:text-[#F5F5F5]">{initiative.locations?.join(", ") || "—"}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-[#0F172A] dark:text-[#F5F5F5] uppercase tracking-wider mb-1 flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5" style={{ color: FOREST }} />Budget</p>
              <p className="text-[15px] font-normal text-[#0F172A] dark:text-[#F5F5F5]">{initiative.budget || "—"}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-[#0F172A] dark:text-[#F5F5F5] uppercase tracking-wider mb-1 flex items-center gap-1.5"><Flag className="w-3.5 h-3.5" style={{ color: FOREST }} />Stage</p>
              <p className="text-[15px] font-normal text-[#0F172A] dark:text-[#F5F5F5]">{fullDetail?.stage ? (STAGE_LABELS[fullDetail.stage]?.split(" — ")[0] ?? fullDetail.stage) : "—"}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-[#0F172A] dark:text-[#F5F5F5] uppercase tracking-wider mb-1 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" style={{ color: FOREST }} />Duration</p>
              <p className="text-[15px] font-normal text-[#0F172A] dark:text-[#F5F5F5]">{fullDetail?.duration || "—"}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-[#0F172A] dark:text-[#F5F5F5] uppercase tracking-wider mb-1 flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" style={{ color: FOREST }} />Est. Start</p>
              <p className="text-[15px] font-normal text-[#0F172A] dark:text-[#F5F5F5]">{fullDetail?.start_date || "—"}</p>
            </div>
          </div>

          {initiative.partnerships && initiative.partnerships.length > 0 && (
            <div>
              <p className="text-xs font-bold text-[#0F172A] dark:text-[#F5F5F5] uppercase tracking-wider mb-2">Partnerships Sought</p>
              <div className="flex flex-wrap gap-1.5">
                {initiative.partnerships.map(p => (
                  <span key={p} className={`${CARD_SM} inline-flex items-center gap-1 text-[12px] font-normal px-2.5 py-1 text-[#0F172A] dark:text-[#F5F5F5] capitalize`}>
                    <Check className="w-3 h-3" style={{ color: FOREST }} />
                    {PARTNERSHIP_OPTIONS.find(o => o.value === p)?.label ?? p}
                  </span>
                ))}
              </div>
            </div>
          )}

          {(sdgItems || (fullDetail?.sdg_tags && fullDetail.sdg_tags.length > 0)) && (
            <div>
              <p className="text-xs font-bold text-[#0F172A] dark:text-[#F5F5F5] uppercase tracking-wider mb-2">SDG Alignment</p>
              <div className="flex flex-wrap gap-1.5">
                {sdgItems
                  ? sdgItems.map((item, i) => (
                      <span key={i} className="text-[12px] font-normal px-2.5 py-1 rounded-full" style={{ background: `${item.color}1A`, color: item.color }}>
                        {(item.text.match(/SDG\s*\d+/i)?.[0]) ?? item.text}
                      </span>
                    ))
                  : fullDetail!.sdg_tags!.map((s, i) => (
                      <span key={s} className="text-[12px] font-normal px-2.5 py-1 rounded-full" style={{ background: `${SDG_CARD_PALETTE[i % SDG_CARD_PALETTE.length]}1A`, color: SDG_CARD_PALETTE[i % SDG_CARD_PALETTE.length] }}>
                        {s}
                      </span>
                    ))}
              </div>
            </div>
          )}

          {initiative.esg_alignment && (
            <div className={`${CARD_SM} p-4`}>
              <div className="flex items-center gap-2 mb-1">
                <Leaf className="w-4 h-4 shrink-0" style={{ color: "#2e7d32" }} />
                <p className="text-[14px] font-bold text-[#0F172A] dark:text-[#F5F5F5]">Corporate ESG/CSR Anchor</p>
              </div>
              <p className="text-[13px] font-normal text-[#0F172A] dark:text-[#F5F5F5]">Open to corporate adoption as an anchor program for ESG &amp; CSR portfolios.</p>
            </div>
          )}

          {!isOwnInitiative && isFunder && !alreadyExpressed && !questionSubmitted && (
            <div className="space-y-2">
              {!questionOpen ? (
                <button type="button" onClick={() => setQuestionOpen(true)}
                  className="w-full rounded-lg py-3 text-[14px] font-bold flex items-center justify-center gap-2 transition-colors"
                  style={{ color: FOREST, background: "rgba(27,77,62,0.06)" }}>
                  <MessageSquare className="w-4 h-4" />
                  Ask a question before committing
                </button>
              ) : (
                <div className={`${CARD_SM} p-4 space-y-2`}>
                  <p className="text-[13px] font-bold text-[#0F172A] dark:text-[#F5F5F5]">Your question</p>
                  <textarea
                    value={question}
                    onChange={e => setQuestion(e.target.value)}
                    placeholder="Ask the initiative owner a specific question before expressing interest..."
                    rows={3}
                    className="w-full rounded-lg px-3 py-2.5 text-[14px] resize-none focus:outline-none"
                    style={{ background: "rgba(27,77,62,0.04)" }}
                  />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => { setQuestionOpen(false); setQuestion(""); }}
                      className="flex-1 rounded-lg py-2 text-[14px] font-semibold transition-colors" style={{ color: FOREST }}>
                      Cancel
                    </button>
                    <button type="button" onClick={submitQuestion}
                      disabled={!question.trim() || questionSubmitting}
                      className="flex-1 rounded-lg py-2 text-white text-[14px] font-bold disabled:opacity-40 transition-colors"
                      style={{ background: FOREST }}>
                      {questionSubmitting ? "Sending..." : "Send question"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          {questionSubmitted && (
            <div className="flex items-center gap-2 justify-center text-[13px] font-semibold py-1" style={{ color: FOREST }}>
              <CheckCircle2 className="w-4 h-4" />
              Question sent. The initiative lead will respond in Messages.
            </div>
          )}
        </div>
      </div>

      <AiSlidePanel open={memoOpen} onClose={() => setMemoOpen(false)} title="AI Deal Memo" icon={<Sparkles className="w-4 h-4" style={{ color: FOREST }} />}>
        {dealMemo?.match_score != null && (
          <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mb-4"
            style={{
              background: ragForScore(dealMemo.match_score, 40, 70).bg,
              color: ragForScore(dealMemo.match_score, 40, 70).text,
            }}>
            {dealMemo.match_score}% match
          </span>
        )}
        {loadingMemo ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => <div key={i} className={`h-12 ${CARD_SM} animate-pulse`} />)}
          </div>
        ) : dealMemo ? (
          <div className="space-y-4">
            <p className="text-[15px] font-medium text-[#0F172A] dark:text-[#F5F5F5] leading-relaxed">{dealMemo.headline}</p>
            {[
              { label: "Problem validity", value: dealMemo.problem_validity },
              { label: "Solution fit", value: dealMemo.solution_fit },
              { label: "Team credibility", value: dealMemo.team_credibility },
              { label: "Financial assessment", value: dealMemo.financial_assessment },
              { label: "Mandate alignment", value: dealMemo.mandate_alignment },
            ].map(section => (
              <div key={section.label} className="space-y-1">
                <p className="text-[13px] font-bold uppercase tracking-wider text-[#0F172A] dark:text-[#F5F5F5]">{section.label}</p>
                <p className="text-[15px] text-[#0F172A] dark:text-[#F5F5F5] leading-relaxed">{section.value}</p>
              </div>
            ))}
            {dealMemo.risk_flags?.length > 0 && (
              <div className="space-y-1">
                <p className="text-[13px] font-bold uppercase tracking-wider text-[#0F172A] dark:text-[#F5F5F5]">Risk flags</p>
                <ul className="space-y-1">
                  {dealMemo.risk_flags.map((flag: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-[15px] text-[#0F172A] dark:text-[#F5F5F5]">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5" style={{ background: BURNT_ORANGE }} />
                      {flag}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {dealMemo.recommended_action && (
              <div className="rounded-xl px-5 py-4 space-y-1.5"
                style={{
                  background: ragFor(dealMemo.recommended_action).bg,
                  boxShadow: `0 1px 2px rgba(0,0,0,0.04), 0 8px 20px -10px ${ragFor(dealMemo.recommended_action).text}55`,
                }}>
                <div className="flex items-center gap-2">
                  <RagIcon action={dealMemo.recommended_action} className="w-4 h-4 shrink-0" />
                  <p className="text-[15px] font-bold uppercase tracking-wide" style={{ color: ragFor(dealMemo.recommended_action).text }}>
                    Recommended: {dealMemo.recommended_action}
                  </p>
                </div>
                <p className="text-[13px] text-[#0F172A] dark:text-[#F5F5F5] pl-6">{dealMemo.recommended_action_reason}</p>
              </div>
            )}
            <button type="button" onClick={generateDealMemo} className="text-[13px] font-semibold flex items-center gap-1 transition-colors" style={{ color: FOREST }}>
              <Sparkles className="w-3 h-3" />Regenerate
            </button>
          </div>
        ) : memoRequiresUpgrade ? (
          <div className="text-center py-4">
            <p className="text-[15px] font-medium text-[#0F172A] dark:text-[#F5F5F5] mb-1">AI deal memos need an upgrade.</p>
            <p className="text-[13px] mb-3" style={{ color: FOREST }}>Upgrade to see a full AI-generated deal memo for this initiative.</p>
            <button type="button" onClick={() => navigate("/dashboard/settings?tab=billing")}
              className="text-[13px] font-bold text-white rounded-full px-4 py-1.5 transition-opacity hover:opacity-90" style={{ background: FOREST }}>
              Upgrade
            </button>
          </div>
        ) : (
          <p className="text-[15px]" style={{ color: FOREST }}>Failed to generate memo. Try again.</p>
        )}
      </AiSlidePanel>

      <AiSlidePanel open={csrOpen} onClose={() => setCsrOpen(false)} title="CSR Adoption Brief" icon={<Sparkles className="w-4 h-4" style={{ color: FOREST }} />}>
        {csrBrief?.match_score != null && (
          <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mb-4"
            style={{
              background: ragForScore(csrBrief.match_score, 50, 75).bg,
              color: ragForScore(csrBrief.match_score, 50, 75).text,
            }}>
            {csrBrief.match_score}% CSR fit
          </span>
        )}
        {loadingCsr ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => <div key={i} className={`h-12 ${CARD_SM} animate-pulse`} />)}
          </div>
        ) : csrBrief ? (
          <div className="space-y-4">
            <p className="text-[15px] font-medium text-[#0F172A] dark:text-[#F5F5F5] leading-relaxed">{csrBrief.headline}</p>
            {[
              { label: "SDG alignment", value: csrBrief.sdg_alignment },
              { label: "Local content", value: csrBrief.local_content },
              { label: "Brand fit", value: csrBrief.brand_fit },
              { label: "ESG framework match", value: csrBrief.esg_framework_match },
              { label: "Partnership options", value: csrBrief.partnership_options },
              { label: "Reputational considerations", value: csrBrief.reputational_considerations },
              { label: "Implementer readiness", value: csrBrief.implementer_readiness },
            ].map(section => (
              <div key={section.label} className="space-y-1">
                <p className="text-[13px] font-bold uppercase tracking-wider text-[#0F172A] dark:text-[#F5F5F5]">{section.label}</p>
                <p className="text-[15px] text-[#0F172A] dark:text-[#F5F5F5] leading-relaxed">{section.value}</p>
              </div>
            ))}
            {csrBrief.risk_flags?.length > 0 && (
              <div className="space-y-1">
                <p className="text-[13px] font-bold uppercase tracking-wider text-[#0F172A] dark:text-[#F5F5F5]">Risk flags</p>
                <ul className="space-y-1">
                  {csrBrief.risk_flags.map((flag: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-[15px] text-[#0F172A] dark:text-[#F5F5F5]">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5" style={{ background: BURNT_ORANGE }} />
                      {flag}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {csrBrief.recommended_action && (
              <div className="rounded-xl px-5 py-4 space-y-1.5"
                style={{
                  background: ragFor(csrBrief.recommended_action).bg,
                  boxShadow: `0 1px 2px rgba(0,0,0,0.04), 0 8px 20px -10px ${ragFor(csrBrief.recommended_action).text}55`,
                }}>
                <div className="flex items-center gap-2">
                  <RagIcon action={csrBrief.recommended_action} className="w-4 h-4 shrink-0" />
                  <p className="text-[15px] font-bold uppercase tracking-wide" style={{ color: ragFor(csrBrief.recommended_action).text }}>
                    Recommended: {csrBrief.recommended_action}
                  </p>
                </div>
                <p className="text-[13px] text-[#0F172A] dark:text-[#F5F5F5] pl-6">{csrBrief.recommended_action_reason}</p>
              </div>
            )}
            <button type="button" onClick={generateCsrBrief} className="text-[13px] font-semibold flex items-center gap-1 transition-colors" style={{ color: FOREST }}>
              <Sparkles className="w-3 h-3" />Regenerate
            </button>
          </div>
        ) : csrRequiresUpgrade ? (
          <div className="text-center py-4">
            <p className="text-[15px] font-medium text-[#0F172A] dark:text-[#F5F5F5] mb-1">AI CSR briefs need an upgrade.</p>
            <p className="text-[13px] mb-3" style={{ color: FOREST }}>Upgrade to see a full AI-generated CSR adoption brief for this initiative.</p>
            <button type="button" onClick={() => navigate("/dashboard/settings?tab=billing")}
              className="text-[13px] font-bold text-white rounded-full px-4 py-1.5 transition-opacity hover:opacity-90" style={{ background: FOREST }}>
              Upgrade
            </button>
          </div>
        ) : (
          <p className="text-[15px]" style={{ color: FOREST }}>Failed to generate brief. Try again.</p>
        )}
      </AiSlidePanel>

      {eoiOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-background rounded-2xl border border-border w-full max-w-md shadow-xl p-6 max-h-[90vh] overflow-y-auto">
            {submitted ? (
              <div className="text-center py-4">
                <CheckCircle2 className="w-10 h-10 mx-auto mb-3" style={{ color: FOREST }} />
                <p className="font-medium text-foreground">Expression submitted</p>
                <p className="text-[15px] text-black dark:text-white mt-1">The initiative lead will be notified.</p>
                {profile?.user_type === "organisation" && !profile?.is_verified && (
                  <div className="mt-4 rounded-xl border px-4 py-3 text-left" style={{ borderColor: `${FOREST}33`, background: `${FOREST}0D` }}>
                    <p className="text-[13px] font-medium" style={{ color: FOREST }}>Stand out with a verified badge</p>
                    <p className="text-[13px] text-black dark:text-white mt-0.5">Verified organisations get a trust badge on all EOIs.</p>
                    <a href="/verify" className="inline-block mt-2 text-[13px] font-medium hover:underline" style={{ color: FOREST }}>Get verified →</a>
                  </div>
                )}
                <button type="button"
                  onClick={() => { setEoiOpen(false); setSubmitted(false); setPartnershipTypes([]); setEsgAdoption(false); setMessage(""); hasManuallyEditedRef.current = false; }}
                  className="mt-5 rounded-full h-10 px-6 text-white text-[15px] font-semibold transition-colors"
                  style={{ background: FOREST }}>
                  Done
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-[17px] font-semibold text-foreground">Express Interest</h3>
                  <button type="button" onClick={() => setEoiOpen(false)} className="p-1.5 rounded-full hover:bg-muted transition-colors">
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
                <div>
                  <p className="text-[15px] font-medium text-foreground mb-2">Partnership type</p>
                  <div className="flex flex-wrap gap-2">
                    {EOI_PARTNERSHIP_TYPES.map(t => (
                      <button key={t.value} type="button"
                        onClick={() => setPartnershipTypes(prev => prev.includes(t.value) ? prev.filter(x => x !== t.value) : [...prev, t.value])}
                        className="text-[13px] px-3 py-1.5 rounded-full transition-colors"
                        style={partnershipTypes.includes(t.value)
                          ? { background: FOREST, color: "white" }
                          : { background: "rgba(27,77,62,0.06)", color: FOREST }}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
                {initiative.esg_alignment && (
                  <div>
                    <p className="text-[15px] font-medium text-foreground mb-2">ESG/CSR adoption</p>
                    <button type="button" onClick={() => setEsgAdoption(v => !v)}
                      className={`w-full flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${esgAdoption ? "border-[#2e7d32] bg-[rgba(46,125,50,0.08)]" : "border-border hover:border-[#2e7d32]/40"}`}>
                      <div className={`w-4 h-4 mt-0.5 rounded border flex items-center justify-center shrink-0 transition-colors ${esgAdoption ? "bg-[#2e7d32] border-[#2e7d32]" : "border-border"}`}>
                        {esgAdoption && <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>}
                      </div>
                      <div>
                        <p className="text-[13px] font-medium text-foreground">Adopt as ESG/CSR initiative</p>
                        <p className="text-[13px] text-black dark:text-white mt-0.5">Your organisation will adopt this as a CSR or ESG anchor programme.</p>
                      </div>
                    </button>
                  </div>
                )}
                {!canSubmit && <p className="text-[13px] text-black dark:text-white">Select at least one partnership type{initiative.esg_alignment ? " or choose ESG/CSR adoption" : ""}.</p>}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[15px] font-medium text-foreground">Message</label>
                    <button type="button" onClick={generateAiMessage} disabled={aiMessageLoading}
                      className="flex items-center gap-1.5 text-[13px] font-semibold hover:underline disabled:opacity-40 transition-opacity"
                      style={{ color: FOREST }}>
                      {aiMessageLoading
                        ? <><Loader2 className="w-3 h-3 animate-spin" />Generating...</>
                        : <><Sparkles className="w-3 h-3" />{message ? "Regenerate" : "Generate"}</>}
                    </button>
                  </div>
                  {aiMessageLoading && !message && (
                    <div className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2.5 h-28 flex items-center justify-center gap-2 text-[13px] text-black dark:text-white">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: FOREST }} />
                      Drafting your message...
                    </div>
                  )}
                  {(!aiMessageLoading || message) && (
                    <textarea value={message} onChange={e => { setMessage(e.target.value); hasManuallyEditedRef.current = true; }}
                      placeholder={
                        aiMessageRequiresUpgrade ? "AI drafting needs an upgrade. Write your message here..."
                        : aiMessageFailed ? "AI draft unavailable. Write your message here..."
                        : partnershipTypes.length === 0 ? "Select a partnership type above to generate a draft message, or write your own."
                        : "Generating message..."
                      }
                      rows={5}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-[15px] resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors" />
                  )}
                  {aiMessageRequiresUpgrade && !message && (
                    <p className="text-[13px]" style={{ color: BURNT_ORANGE }}>
                      AI-drafted outreach needs an upgrade.{" "}
                      <button type="button" onClick={() => navigate("/dashboard/settings?tab=billing")} className="underline font-medium">
                        Upgrade
                      </button>
                      {" "}or write your own message above.
                    </p>
                  )}
                  {aiMessageFailed && !message && (
                    <p className="text-[13px]" style={{ color: BURNT_ORANGE }}>AI draft failed. Write your own message above.</p>
                  )}
                </div>
                {eoiError && <p className="text-[15px] text-red-600 bg-red-50 rounded-md px-3 py-2">{eoiError}</p>}
                <button type="button" onClick={submitEOI} disabled={!canSubmit || submitting}
                  className="w-full rounded-full h-10 text-white text-[15px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  style={{ background: BURNT_ORANGE }}>
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