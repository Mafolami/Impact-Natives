// ─── DashboardPartnerships.tsx ───────────────────────────────────────────────
// Split-screen layout: card list left, detail panel right
// Premium partnership directory experience

import { useEffect, useState, useRef } from "react";
import { ORG_TYPE_FILTERS } from "@/lib/orgTypes";
import { supabase } from "@/lib/supabase";
import { Handshake, Loader2, Search, CheckCircle2, ShieldCheck, X, SlidersHorizontal } from "lucide-react";
import { SECTOR_OPTIONS } from "@/lib/sectors";
import { FindPartnerModalDashboard } from "./FindPartnerModalDashboard";
import { useAuth } from "@/context/AuthContext";

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
  partnership_sought?: string;
  verification_status: string;
  status: string;
  user_id: string;
  partnership_listed: boolean;
  partnership_formed?: boolean;
  partnership_title?: string;
  partnership_stage?: string;
  partnership_duration?: string;
  partnership_budget?: string;
  partnership_decision_timeline?: string;
  partnership_success_definition?: string;
  partnership_funding_status?: string;
  partnership_exclusivity?: string;
  partnership_working_style?: string;
  partnership_financial_transfer?: string;
  partnership_reporting?: string[];
  partnership_ip_ownership?: string;
  partnership_legal_type?: string[];
  partnership_team_capacity?: string;
  partnership_contact_seniority?: string;
  partnership_geo_specificity?: string;
  partnership_theory_of_change?: string;
  partnership_prior_attempts?: string;
  partnership_constraints?: string;
  partnership_dd_financial_model?: boolean;
  partnership_dd_audited_accounts?: boolean;
  partnership_dd_safeguarding_policy?: boolean;
  partnership_dd_data_policy?: boolean;
  partnership_dd_governance_doc?: boolean;
  partnership_prior_experience?: boolean;
  partnership_prior_experience_detail?: string;
  partnership_physically_present?: boolean;
}

function normalizeArr(val: string | string[] | null | undefined): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  try { const p = JSON.parse(val); return Array.isArray(p) ? p : [val]; }
  catch { return [val]; }
}

const STAGE_LABELS: Record<string, string> = {
  concept: "Co-designing", joining_running: "Joining active work",
  pilot: "Pilot phase", scaling: "Scaling",
};
const DURATION_LABELS: Record<string, string> = {
  under_6_months: "Under 6 mo", "6_12_months": "6–12 mo",
  "1_2_years": "1–2 years", "2_plus_years": "2+ years", ongoing: "Ongoing",
};
const BUDGET_LABELS: Record<string, string> = {
  under_10k: "Under $10K", "10k_50k": "$10K–$50K",
  "50k_200k": "$50K–$200K", over_200k: "Over $200K",
  in_kind_only: "In-kind", open: "Open",
};
const TIMELINE_LABELS: Record<string, string> = {
  immediately: "Immediately", within_1_month: "Within 1 month",
  "1_3_months": "1–3 months", "3_6_months": "3–6 months",
  no_fixed_timeline: "No fixed timeline",
};
const FUNDING_STATUS_LABELS: Record<string, string> = {
  fully_funded: "Fully funded", partially_funded: "Partially funded",
  seeking_funding: "Seeking co-funding", partner_brings_funding: "Partner brings funding",
};
const FUNDING_STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  fully_funded:           { color: "#2D6A4F", bg: "#eaf5ee" },
  partially_funded:       { color: "#C45C26", bg: "#fdf5f2" },
  seeking_funding:        { color: "#C45C26", bg: "#fdf5f2" },
  partner_brings_funding: { color: "#7B5EA7", bg: "#f3f0fa" },
};
const WORKING_STYLE_LABELS: Record<string, string> = {
  prefer_lead: "Prefers to lead", equal_codesign: "Equal co-design",
  prefer_support: "Prefers to support", flexible: "Flexible",
};
const FINANCIAL_TRANSFER_LABELS: Record<string, string> = {
  we_pay: "Provides funding to partners", we_get_paid: "Expects compensation",
  no_transfer: "No financial transfer", open: "Open to discussion",
};
const LEGAL_TYPE_LABELS: Record<string, string> = {
  formal_mou: "Formal MoU", subcontracting: "Service provider",
  co_implementation: "Joint delivery", referral: "Referral",
  joint_venture: "Joint venture", informal: "Informal", open: "Open",
};

function ddScore(org: OrgRow): number {
  return [org.partnership_dd_financial_model, org.partnership_dd_audited_accounts,
    org.partnership_dd_safeguarding_policy, org.partnership_dd_data_policy,
    org.partnership_dd_governance_doc].filter(Boolean).length;
}

// ─── Compact list card ────────────────────────────────────────────────────────
function ListCard({ org, selected, onClick, isSaved, onToggleSave }: {
  org: OrgRow; selected: boolean; onClick: () => void;
  isSaved: boolean; onToggleSave: (e: React.MouseEvent) => void;
}) {
  const isVerified = org.verification_status === "verified";
  const countries = normalizeArr(org.country);
  const fundingStatus = org.partnership_funding_status ?? "";
  const statusStyle = FUNDING_STATUS_COLORS[fundingStatus] ?? { color: "#2D6A4F", bg: "#eaf5ee" };
  const score = ddScore(org);

  return (
    <div onClick={onClick} className={`relative cursor-pointer px-4 py-4 border-b border-border transition-all group ${selected ? "bg-[#2D6A4F]/5 border-l-2 border-l-[#2D6A4F]" : "hover:bg-muted/40 border-l-2 border-l-transparent"}`}>
      {/* Top row */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-sm font-bold truncate ${selected ? "text-[#2D6A4F]" : "text-foreground"}`}>
              {org.organisation_name}
            </span>
            {isVerified && <ShieldCheck className="w-3 h-3 shrink-0 text-[#2D6A4F]" />}
          </div>
          <p className="text-[11px] text-muted-foreground capitalize truncate">
            {orgTypeLabel(org.organisation_type)}{countries.length > 0 && ` · ${countries[0]}`}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {fundingStatus && (
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0"
              style={{ background: statusStyle.bg, color: statusStyle.color }}>
              {FUNDING_STATUS_LABELS[fundingStatus]?.split(" ")[0] ?? ""}
            </span>
          )}
          <button type="button" onClick={e => { e.stopPropagation(); onToggleSave(e); }}
            className="p-1 rounded-full hover:bg-muted transition-colors opacity-0 group-hover:opacity-100">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-3.5 h-3.5"
              fill={isSaved ? "#2D6A4F" : "none"} stroke={isSaved ? "#2D6A4F" : "currentColor"} strokeWidth={2}>
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Partnership title */}
      {org.partnership_title && (
        <p className="text-xs font-semibold text-foreground mb-1 leading-snug line-clamp-1">{org.partnership_title}</p>
      )}

      {/* Seeking snippet */}
      {org.partnership_sought && (
        <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2 mb-2">{org.partnership_sought}</p>
      )}

      {/* Signal row */}
      <div className="flex items-center gap-2 flex-wrap">
        {org.partnership_stage && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "#eaf5ee", color: "#2D6A4F" }}>
            {STAGE_LABELS[org.partnership_stage] ?? org.partnership_stage}
          </span>
        )}
        {org.partnership_budget && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "#fdf5f2", color: "#C45C26" }}>
            {BUDGET_LABELS[org.partnership_budget] ?? org.partnership_budget}
          </span>
        )}
        {score > 0 && (
          <span className="text-[10px] text-muted-foreground ml-auto">DD {score}/5</span>
        )}
      </div>
    </div>
  );
}

// ─── Detail panel ─────────────────────────────────────────────────────────────
function DetailPanel({ org, isSaved, onToggleSave, isOrg, alreadySent, sending, onExpressInterest, onClose }: {
  org: OrgRow | null; isSaved: boolean; onToggleSave: (e: React.MouseEvent) => void;
  isOrg: boolean; alreadySent: boolean; sending: boolean;
  onExpressInterest: (e: React.MouseEvent) => void; onClose: () => void;
}) {
  const detailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (org && detailRef.current) detailRef.current.scrollTop = 0;
  }, [org?.id]);

  if (!org) {
    return (
      <div className="hidden lg:flex flex-col items-center justify-center h-full gap-4 text-center px-8">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
          <Handshake className="w-7 h-7 text-muted-foreground/40" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground mb-1">Select a listing</p>
          <p className="text-xs text-muted-foreground max-w-xs">Click any organisation from the list to view their full partnership profile.</p>
        </div>
      </div>
    );
  }

  const isVerified = org.verification_status === "verified";
  const sectors = normalizeArr(org.sector);
  const countries = normalizeArr(org.country);
  const score = ddScore(org);
  const fundingStatus = org.partnership_funding_status ?? "";
  const statusStyle = FUNDING_STATUS_COLORS[fundingStatus] ?? { color: "#2D6A4F", bg: "#eaf5ee" };

  const signals = [
    org.partnership_stage     && { label: "Stage",    value: STAGE_LABELS[org.partnership_stage] ?? org.partnership_stage,         color: "#2D6A4F", bg: "#eaf5ee" },
    org.partnership_duration  && { label: "Duration",  value: DURATION_LABELS[org.partnership_duration] ?? org.partnership_duration, color: "#7B5EA7", bg: "#f3f0fa" },
    org.partnership_budget    && { label: "Budget",    value: BUDGET_LABELS[org.partnership_budget] ?? org.partnership_budget,       color: "#C45C26", bg: "#fdf5f2" },
    org.partnership_decision_timeline && { label: "Timeline", value: TIMELINE_LABELS[org.partnership_decision_timeline] ?? org.partnership_decision_timeline, color: "#0369a1", bg: "#f0f9ff" },
  ].filter(Boolean) as { label: string; value: string; color: string; bg: string }[];

  const ddDocs = [
    { key: "partnership_dd_financial_model",     label: "Financial model" },
    { key: "partnership_dd_audited_accounts",    label: "Audited accounts" },
    { key: "partnership_dd_safeguarding_policy", label: "Safeguarding policy" },
    { key: "partnership_dd_data_policy",         label: "Data policy" },
    { key: "partnership_dd_governance_doc",      label: "Governance doc" },
  ];

  const detailRows = [
    org.partnership_funding_status    && { label: "Funding status",       value: FUNDING_STATUS_LABELS[org.partnership_funding_status] ?? org.partnership_funding_status },
    org.partnership_working_style     && { label: "Working style",        value: WORKING_STYLE_LABELS[org.partnership_working_style] ?? org.partnership_working_style },
    org.partnership_financial_transfer && { label: "Financial",           value: FINANCIAL_TRANSFER_LABELS[org.partnership_financial_transfer] ?? org.partnership_financial_transfer },
    org.partnership_geo_specificity   && { label: "Location focus",       value: org.partnership_geo_specificity },
    org.partnership_team_capacity     && { label: "Team capacity",        value: org.partnership_team_capacity.replace(/_/g, " ").replace(/(\d) (\d)/g, "$1–$2") },
    org.partnership_contact_seniority && { label: "Lead contact",         value: org.partnership_contact_seniority.replace(/_/g, " ") },
    org.partnership_physically_present !== null && org.partnership_physically_present !== undefined && { label: "On the ground", value: org.partnership_physically_present ? "Yes" : "Remote" },
    org.partnership_legal_type?.length && { label: "Partnership type",    value: org.partnership_legal_type!.map(t => LEGAL_TYPE_LABELS[t] ?? t).join(", ") },
    org.partnership_reporting?.length  && { label: "Reporting",           value: org.partnership_reporting!.map(r => r.replace(/_/g, " ")).join(", ") },
    org.partnership_ip_ownership      && { label: "IP ownership",         value: org.partnership_ip_ownership.replace(/_/g, " ") },
    org.partnership_exclusivity       && { label: "Exclusivity",          value: org.partnership_exclusivity === "one_dedicated_partner" ? "One partner only" : "Multiple partners" },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <div ref={detailRef} className="flex flex-col h-full overflow-y-auto">

      {/* ── Dark header ── */}
      <div className="shrink-0 px-7 pt-6 pb-6 relative" style={{ background: "linear-gradient(135deg, #0d2b1a 0%, #1a4a2e 100%)" }}>
        {/* Close on mobile */}
        <button type="button" onClick={onClose}
          className="lg:hidden absolute top-4 right-4 p-1.5 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors">
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <a href={`/dashboard/natives?user=${org.user_id}`}
                className="text-xl font-black text-white hover:text-[#86efac] transition-colors leading-tight">
                {org.organisation_name}
              </a>
              {isVerified && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                  style={{ background: "rgba(134,239,172,0.15)", color: "#86efac" }}>
                  <ShieldCheck className="w-3 h-3" />Verified
                </span>
              )}
            </div>
            <p className="text-sm text-white/50 capitalize">
              {orgTypeLabel(org.organisation_type)}
              {countries.length > 0 && ` · ${countries.join(", ")}`}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {fundingStatus && (
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                style={{ background: statusStyle.bg, color: statusStyle.color }}>
                {FUNDING_STATUS_LABELS[fundingStatus] ?? fundingStatus}
              </span>
            )}
            <button type="button" onClick={onToggleSave}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors"
              style={{ background: "rgba(255,255,255,0.1)", color: isSaved ? "#86efac" : "rgba(255,255,255,0.6)" }}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-3.5 h-3.5"
                fill={isSaved ? "#86efac" : "none"} stroke={isSaved ? "#86efac" : "currentColor"} strokeWidth={2}>
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
              {isSaved ? "Saved" : "Save"}
            </button>
          </div>
        </div>

        {sectors.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {sectors.map(s => (
              <span key={s} className="text-[10px] font-semibold px-2.5 py-1 rounded-full"
                style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)" }}>
                {s}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Content sections ── */}
      <div className="flex-1 divide-y divide-border">

        {/* Partnership request */}
        {(org.partnership_title || org.partnership_sought || org.partnership_success_definition) && (
          <div className="px-7 py-6 space-y-4" style={{ background: `${statusStyle.color}06` }}>
            {org.partnership_title && (
              <h3 className="text-base font-black text-foreground leading-snug">{org.partnership_title}</h3>
            )}
            {org.partnership_sought && (
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest mb-1.5" style={{ color: statusStyle.color }}>Seeking</p>
                <p className="text-sm text-foreground leading-relaxed">{org.partnership_sought}</p>
              </div>
            )}
            {org.partnership_success_definition && (
              <div className="rounded-xl px-4 py-3" style={{ background: `${statusStyle.color}10`, borderLeft: `3px solid ${statusStyle.color}` }}>
                <p className="text-[10px] font-black uppercase tracking-widest mb-1.5 text-muted-foreground">Success in 12 months</p>
                <p className="text-sm text-foreground leading-relaxed italic">"{org.partnership_success_definition}"</p>
              </div>
            )}
          </div>
        )}

        {/* Signal pills */}
        {signals.length > 0 && (
          <div className="px-7 py-5">
            <div className="flex flex-wrap gap-2">
              {signals.map(s => (
                <div key={s.label} className="flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-semibold"
                  style={{ background: s.bg, color: s.color }}>
                  <span className="font-black uppercase tracking-widest text-[9px] opacity-60">{s.label}</span>
                  <span>{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* About */}
        {org.description && (
          <div className="px-7 py-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">About</p>
            <p className="text-sm text-foreground leading-relaxed">{org.description}</p>
          </div>
        )}

        {/* Details grid */}
        {detailRows.length > 0 && (
          <div className="px-7 py-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4">Partnership details</p>
            <div className="grid sm:grid-cols-2 gap-x-8 gap-y-0 divide-y divide-border/50 sm:divide-y-0">
              {detailRows.map((row, i) => (
                <div key={row.label} className={`flex items-start justify-between gap-4 py-2.5 ${i < detailRows.length - 1 ? "border-b border-border/40 sm:border-0" : ""}`}>
                  <span className="text-xs text-muted-foreground shrink-0">{row.label}</span>
                  <span className="text-xs font-semibold text-foreground text-right capitalize">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Exchange */}
        {((org.needs && org.needs.length > 0) || (org.offers && org.offers.length > 0)) && (
          <div className="px-7 py-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4">Exchange</p>
            <div className="grid grid-cols-2 gap-6">
              {org.needs && org.needs.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-2.5">Needs</p>
                  <div className="flex flex-wrap gap-1.5">
                    {org.needs.map(n => (
                      <span key={n} className="text-xs font-medium px-3 py-1.5 rounded-full border border-border text-muted-foreground">{n}</span>
                    ))}
                  </div>
                </div>
              )}
              {org.offers && org.offers.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-2.5">Offers</p>
                  <div className="flex flex-wrap gap-1.5">
                    {org.offers.map(o => (
                      <span key={o} className="text-xs font-bold px-3 py-1.5 rounded-full"
                        style={{ background: "#eaf5ee", color: "#2D6A4F" }}>{o}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* DD readiness */}
        <div className="px-7 py-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Due diligence readiness</p>
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="w-7 h-1.5 rounded-full"
                    style={{ background: i < score ? "#2D6A4F" : "var(--border)" }} />
                ))}
              </div>
              <span className="text-xs font-bold" style={{ color: score > 2 ? "#2D6A4F" : "#C45C26" }}>{score}/5</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {ddDocs.map(({ key, label }) => {
              const has = org[key as keyof OrgRow] as boolean;
              return (
                <span key={key} className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full"
                  style={has
                    ? { background: "#eaf5ee", color: "#2D6A4F" }
                    : { background: "transparent", color: "var(--muted-foreground)", opacity: 0.4, textDecoration: "line-through", border: "1px solid var(--border)" }}>
                  {has && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                  {label}
                </span>
              );
            })}
          </div>
        </div>

        {/* SDGs */}
        {org.sdgs && org.sdgs.length > 0 && (
          <div className="px-7 py-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">SDG alignment</p>
            <div className="flex flex-wrap gap-1.5">
              {org.sdgs.map(sdg => (
                <span key={sdg} className="text-xs font-bold px-3 py-1.5 rounded-full"
                  style={{ background: "#eaf5ee", color: "#2D6A4F" }}>SDG {sdg}</span>
              ))}
            </div>
          </div>
        )}

        {/* Context */}
        {(org.partnership_theory_of_change || org.partnership_prior_attempts || org.partnership_constraints) && (
          <div className="px-7 py-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4">Context</p>
            <div className="space-y-4">
              {org.partnership_theory_of_change && (
                <div>
                  <p className="text-xs font-bold text-foreground mb-1">Approach to change</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{org.partnership_theory_of_change}</p>
                </div>
              )}
              {org.partnership_prior_attempts && (
                <div>
                  <p className="text-xs font-bold text-foreground mb-1">Previous attempts</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{org.partnership_prior_attempts}</p>
                </div>
              )}
              {org.partnership_constraints && (
                <div>
                  <p className="text-xs font-bold text-foreground mb-1">Constraints</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{org.partnership_constraints}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Track record */}
        {org.partnership_prior_experience !== null && org.partnership_prior_experience !== undefined && (
          <div className="px-7 py-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">Track record</p>
            <div className="flex items-start gap-2.5">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${org.partnership_prior_experience ? "bg-[#2D6A4F]" : "bg-muted"}`}>
                {org.partnership_prior_experience
                  ? <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                  : <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12"/></svg>}
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {org.partnership_prior_experience ? "Has completed a partnership before" : "No prior completed partnerships"}
                </p>
                {org.partnership_prior_experience && org.partnership_prior_experience_detail && (
                  <p className="text-sm text-muted-foreground leading-relaxed mt-1">{org.partnership_prior_experience_detail}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Website */}
        {org.website && org.website !== "https://" && (
          <div className="px-7 py-4">
            <a href={org.website} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-primary hover:underline">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                <circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
              </svg>
              {org.website.replace(/^https?:\/\//, "")}
            </a>
          </div>
        )}

        {/* CTA */}
        {isOrg && !org.partnership_formed && (
          <div className="px-7 py-5 bg-background sticky bottom-0 border-t border-border">
            {alreadySent ? (
              <div className="flex items-center gap-2 text-sm font-semibold text-[#2D6A4F]">
                <CheckCircle2 className="w-4 h-4" />Interest expressed — they've been notified
              </div>
            ) : (
              <button type="button" onClick={onExpressInterest} disabled={sending}
                className="w-full h-11 rounded-full text-white text-sm font-bold disabled:opacity-40 transition-all hover:opacity-90 active:scale-[0.98]"
                style={{ background: "linear-gradient(135deg, #2D6A4F, #3d8f6a)" }}>
                {sending ? "Sending..." : "Express interest"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function DashboardPartnerships() {
  const { user } = useAuth();
  const [orgs, setOrgs]                     = useState<OrgRow[]>([]);
  const [loading, setLoading]               = useState(true);
  const [showModal, setShowModal]           = useState(false);
  const [search, setSearch]                 = useState("");
  const [sectorFilters, setSectorFilters]   = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters]       = useState(false);
  const [favoritesOnly, setFavoritesOnly]   = useState(false);
  const [selectedOrg, setSelectedOrg]       = useState<OrgRow | null>(null);
  const [savedOrgs, setSavedOrgs]           = useState<Set<string>>(new Set());
  const [currentUserOrgId, setCurrentUserOrgId] = useState<string | null>(null);
  const [sentInterests, setSentInterests]   = useState<Set<string>>(new Set());
  const [sendingInterest, setSendingInterest] = useState<string | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  useEffect(() => {
    if (user) loadAll();
  }, [user]);

  async function loadAll() {
    const uid = user?.id ?? null;
    const [orgsRes, savedRes, myOrgRes, existingConnectionsRes] = await Promise.all([
      supabase.from("organizations")
        .select("id, organisation_name, description, sector, country, organisation_type, website, email, needs, offers, sdgs, partnership_sought, partnership_title, verification_status, status, user_id, partnership_listed, partnership_formed, partnership_stage, partnership_duration, partnership_budget, partnership_decision_timeline, partnership_success_definition, partnership_funding_status, partnership_exclusivity, partnership_working_style, partnership_financial_transfer, partnership_reporting, partnership_ip_ownership, partnership_legal_type, partnership_team_capacity, partnership_contact_seniority, partnership_geo_specificity, partnership_theory_of_change, partnership_prior_attempts, partnership_constraints, partnership_dd_financial_model, partnership_dd_audited_accounts, partnership_dd_safeguarding_policy, partnership_dd_data_policy, partnership_dd_governance_doc, partnership_prior_experience, partnership_prior_experience_detail, partnership_physically_present")
        .eq("status", "published")
        .eq("partnership_listed", true)
        .order("created_at", { ascending: false }),
      uid ? supabase.from("saved_organizations").select("organization_id").eq("user_id", uid) : Promise.resolve({ data: null }),
      uid ? supabase.from("organizations").select("id").eq("user_id", uid).maybeSingle() : Promise.resolve({ data: null }),
      uid ? supabase.from("partnership_connections").select("receiver_org_id").eq("sender_user_id", uid) : Promise.resolve({ data: null }),
    ]);

    if (orgsRes.data) {
      setOrgs(orgsRes.data as OrgRow[]);
      if (orgsRes.data.length > 0 && !selectedOrg) setSelectedOrg(orgsRes.data[0] as OrgRow);
    }
    if (savedRes.data) setSavedOrgs(new Set(savedRes.data.map((r: any) => r.organization_id)));
    if (myOrgRes.data) setCurrentUserOrgId(myOrgRes.data.id);
    if (existingConnectionsRes.data && myOrgRes.data) {
      setSentInterests(new Set(existingConnectionsRes.data.filter((r: any) => r.receiver_org_id !== myOrgRes.data!.id).map((r: any) => r.receiver_org_id)));
    } else if (existingConnectionsRes.data) {
      setSentInterests(new Set(existingConnectionsRes.data.map((r: any) => r.receiver_org_id)));
    }
    setLoading(false);
  }

  const filtered = orgs.filter((org) => {
    if (user && org.user_id === user.id) return false;
    const sectors   = normalizeArr(org.sector);
    const countries = normalizeArr(org.country);
    const matchesSector   = sectorFilters.size === 0 || sectors.some(s => [...sectorFilters].some(f => s.toLowerCase().includes(f.toLowerCase())));
    const matchesSearch   = !search.trim() || org.organisation_name?.toLowerCase().includes(search.toLowerCase()) || org.description?.toLowerCase().includes(search.toLowerCase()) || (org.partnership_sought ?? "").toLowerCase().includes(search.toLowerCase()) || countries.some(c => c.toLowerCase().includes(search.toLowerCase()));
    const matchesFavorites = !favoritesOnly || savedOrgs.has(org.id);
    return matchesSector && matchesSearch && matchesFavorites;
  });

  async function toggleSave(orgId: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!user) return;
    if (savedOrgs.has(orgId)) {
      await supabase.from("saved_organizations").delete().eq("user_id", user.id).eq("organization_id", orgId);
      setSavedOrgs(prev => { const next = new Set(prev); next.delete(orgId); return next; });
    } else {
      await supabase.from("saved_organizations").insert({ user_id: user.id, organization_id: orgId });
      setSavedOrgs(prev => new Set(prev).add(orgId));
    }
  }

  async function expressInterest(org: OrgRow, e: React.MouseEvent) {
    e.stopPropagation();
    if (!user || sentInterests.has(org.id) || org.partnership_formed) return;
    let senderOrgId = currentUserOrgId;
    if (!senderOrgId) {
      const { data } = await supabase.from("organizations").select("id").eq("user_id", user.id).maybeSingle();
      if (!data) { alert("You need an organisation profile to express interest."); return; }
      senderOrgId = data.id;
      setCurrentUserOrgId(data.id);
    }
    setSendingInterest(org.id);
    try {
      const { error } = await supabase.from("partnership_connections").insert({
        sender_org_id: senderOrgId, receiver_org_id: org.id,
        sender_user_id: user.id, source: "browse", status: "pending",
      });
      if (error && !error.message.includes("unique")) throw error;

      // Create conversation
      const { data: convData } = await supabase.from("conversations").insert({
        conversation_type: "partnership", status: "open",
      }).select("id").single();

      if (convData?.id) {
        const { data: senderOrg } = await supabase.from("organizations").select("organisation_name").eq("id", senderOrgId).single();
        await supabase.from("conversation_participants").insert([
          { conversation_id: convData.id, user_id: user.id },
          { conversation_id: convData.id, user_id: org.user_id },
        ]);
        await supabase.from("messages").insert({
          conversation_id: convData.id, sender_id: user.id,
          body: `Hi ${org.organisation_name}, I came across your partnership listing on Impact Natives and I'm interested in exploring a potential collaboration. ${org.partnership_sought ? `I see you're looking for: ${org.partnership_sought}` : ""}\n\nWould you be open to a conversation?`,
        });
        await supabase.from("notifications").insert({
          user_id: org.user_id, type: "partnership_interest",
          title: "New partnership interest",
          body: `${senderOrg?.organisation_name ?? "An organisation"} expressed interest in partnering with you.`,
          link: "/dashboard/initiatives?tab=partnerships",
          metadata: { sender_org_id: senderOrgId, receiver_org_id: org.id, conversation_id: convData.id },
        });
      }
      setSentInterests(prev => new Set(prev).add(org.id));
    } catch (e) {
      console.error("Express interest error:", e);
    } finally {
      setSendingInterest(null);
    }
  }

  const activeFilterCount = sectorFilters.size + (favoritesOnly ? 1 : 0);

  return (
    <>
      <div className="flex flex-col h-full min-h-0 -mx-4 sm:-mx-6">

        {/* ── Top bar ── */}
        <div className="shrink-0 px-4 sm:px-6 py-3 border-b border-border flex items-center gap-2 bg-background">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input type="text" placeholder="Search..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full h-8 pl-8 pr-3 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary transition-colors" />
          </div>
          <button type="button" onClick={() => setShowFilters(v => !v)}
            className={`relative h-8 px-3 rounded-lg border text-xs font-medium transition-colors flex items-center gap-1.5 ${showFilters || activeFilterCount > 0 ? "bg-[#2D6A4F] border-[#2D6A4F] text-white" : "border-border text-muted-foreground hover:border-foreground/30"}`}>
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filter
            {activeFilterCount > 0 && <span className="w-4 h-4 rounded-full bg-white text-[#2D6A4F] text-[10px] font-bold flex items-center justify-center">{activeFilterCount}</span>}
          </button>
          <div className="flex-1" />
          {user && (
            <button type="button" onClick={() => setShowModal(true)}
              className="h-8 px-4 rounded-full bg-[#2D6A4F] hover:bg-[#245c43] text-white text-xs font-semibold transition-colors shrink-0">
              + Get Matched
            </button>
          )}
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="shrink-0 px-4 sm:px-6 py-3 border-b border-border bg-muted/30 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={favoritesOnly} onChange={e => setFavoritesOnly(e.target.checked)} className="w-3.5 h-3.5 rounded accent-[#2D6A4F]" />
              <span className="text-xs font-medium text-foreground">Saved only</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {SECTOR_OPTIONS.map(sector => (
                <button key={sector} type="button"
                  onClick={() => setSectorFilters(prev => { const next = new Set(prev); next.has(sector) ? next.delete(sector) : next.add(sector); return next; })}
                  className={`h-6 px-2.5 rounded-full text-[10px] font-semibold border transition-colors ${sectorFilters.has(sector) ? "bg-[#2D6A4F] border-[#2D6A4F] text-white" : "border-border text-muted-foreground hover:border-foreground/30"}`}>
                  {sector}
                </button>
              ))}
            </div>
            {activeFilterCount > 0 && (
              <button type="button" onClick={() => { setSectorFilters(new Set()); setFavoritesOnly(false); }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                Clear all
              </button>
            )}
          </div>
        )}

        {/* ── Split layout ── */}
        {loading ? (
          <div className="flex items-center justify-center flex-1">
            <Loader2 className="w-5 h-5 text-[#2D6A4F] animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-4 text-center px-6">
            <Handshake className="w-8 h-8 text-muted-foreground/40" />
            <div>
              <p className="text-sm font-semibold text-foreground mb-1">{orgs.length === 0 ? "No listings yet" : "No results"}</p>
              <p className="text-xs text-muted-foreground">{orgs.length === 0 ? "Be the first to list your organisation." : "Try a different search or filter."}</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* Left: card list */}
            <div className={`w-full lg:w-80 xl:w-96 shrink-0 border-r border-border overflow-y-auto ${mobileDetailOpen ? "hidden lg:block" : "block"}`}>
              <div className="px-4 py-2.5 border-b border-border bg-muted/20">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{filtered.length} listing{filtered.length !== 1 ? "s" : ""}</p>
              </div>
              {filtered.map(org => (
                <ListCard key={org.id} org={org}
                  selected={selectedOrg?.id === org.id}
                  onClick={() => { setSelectedOrg(org); setMobileDetailOpen(true); }}
                  isSaved={savedOrgs.has(org.id)}
                  onToggleSave={e => toggleSave(org.id, e)}
                />
              ))}
            </div>

            {/* Right: detail panel */}
            <div className={`flex-1 min-w-0 overflow-hidden ${mobileDetailOpen ? "block" : "hidden lg:block"}`}>
              <DetailPanel
                org={selectedOrg}
                isSaved={selectedOrg ? savedOrgs.has(selectedOrg.id) : false}
                onToggleSave={e => selectedOrg && toggleSave(selectedOrg.id, e)}
                isOrg={!!user}
                alreadySent={selectedOrg ? sentInterests.has(selectedOrg.id) : false}
                sending={selectedOrg ? sendingInterest === selectedOrg.id : false}
                onExpressInterest={e => selectedOrg && expressInterest(selectedOrg, e)}
                onClose={() => setMobileDetailOpen(false)}
              />
            </div>
          </div>
        )}
      </div>

      <FindPartnerModalDashboard isOpen={showModal} onClose={() => { setShowModal(false); loadAll(); }} />
    </>
  );
}