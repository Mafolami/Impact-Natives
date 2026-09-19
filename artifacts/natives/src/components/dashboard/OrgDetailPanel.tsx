// ─── OrgDetailPanel.tsx ───────────────────────────────────────────────────────
// Extracted from DashboardPartnerships.tsx so the same full partnership-listing
// detail view can render inline (in-state) from anywhere -- originally only
// DashboardPartnerships.tsx's own split-pane layout could show it. Portfolio's
// Table view now renders this directly for Mine/Outbound/Inbound partnership
// rows, matching how InitiativeDetail already renders in-state for initiatives.
//
// variant="panel" (default): unchanged split-pane look -- full-height scroll
// box, own background, gradient header strip. Used by DashboardPartnerships.tsx
// where this sits beside a ListCard column.
// variant="page": flat page content matching InitiativeDetail exactly -- no
// outer box, no internal scroll, no gradient header, and each content section
// becomes its own small card (rounded-xl border bg-card) instead of one
// continuous divided panel. Used by DashboardPortfolio.tsx's in-state view.
//
// Fit analysis (loadFit) rewritten for score-partnership-fit v10:
// - Sends { viewer_org_id, target_listing_id } instead of whole org objects.
//   target_listing_id comes from org.listing_id -- already present on every
//   row DashboardPartnerships.tsx builds. If it's ever missing (a caller that
//   hasn't been updated to pass it), the fit box just doesn't render, same
//   as when viewerOrg was missing before.
// - The backend now scores the target against EVERY one of the viewer's own
//   open listings, not one guessed one, and returns the best as `primary`
//   plus any others that also cleared the bar as `also_fits`. Clicking an
//   "Also fits" line reads that specific pair straight from
//   partnership_match_cache -- no second AI call, since v10 caches every
//   qualifying result, not just the winner.
// - `no_published_listing` fails quiet (no listing to compare against) --
//   same fail-quiet convention as before when nothing was eligible to score.

import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { supabase } from "@/lib/supabase";
import { Loader2, ShieldCheck, Sparkles, CheckCircle2, ArrowUpRight, ArrowLeft, Award, Layers, Clock, Wallet, CalendarDays, Coins, Lock, MapPin, Users, User, Compass, Banknote, FileText, ClipboardList, Scale, Building2, Target } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ORG_TYPE_FILTERS } from "@/lib/orgTypes";
import VerifiedOutcomesSection from "@/components/dashboard/VerifiedOutcomesSection";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OrgRow {
  id: string; organisation_name: string; description: string;
  sector: string | string[]; country: string | string[];
  organisation_type: string; website?: string; email?: string;
  needs?: string[]; offers?: string[]; sdgs?: string[];
  partnership_sought?: string; verification_status: string;
  status: string; user_id: string; partnership_listed: boolean;
  // The specific published listing this row represents, when the caller has
  // one (DashboardPartnerships.tsx's merged rows always do). Drives which
  // listing gets sent to score-partnership-fit as the comparison target.
  listing_id?: string;
  partnership_formed?: boolean; partnership_title?: string;
  partnership_stage?: string; partnership_duration?: string;
  partnership_budget?: string; partnership_decision_timeline?: string;
  partnership_success_definition?: string; partnership_funding_status?: string;
  partnership_exclusivity?: string; partnership_working_style?: string;
  partnership_financial_transfer?: string; partnership_reporting?: string[];
  partnership_ip_ownership?: string; partnership_legal_type?: string[];
  partnership_team_capacity?: string; partnership_contact_seniority?: string;
  partnership_geo_specificity?: string; partnership_theory_of_change?: string;
  partnership_prior_attempts?: string; partnership_constraints?: string;
  partnership_dd_financial_model?: boolean; partnership_dd_audited_accounts?: boolean;
  partnership_dd_safeguarding_policy?: boolean; partnership_dd_data_policy?: boolean;
  partnership_dd_governance_doc?: boolean; partnership_prior_experience?: boolean;
  partnership_prior_experience_detail?: string; partnership_physically_present?: boolean;
  dd_financial_model?: boolean; dd_audited_accounts?: boolean; dd_governance_doc?: boolean;
  dd_esg_assessment?: boolean; dd_impact_framework?: boolean; dd_environmental_policy?: boolean;
  dd_safeguarding_policy?: boolean; dd_legal_registration?: boolean; dd_legal_compliance_declaration?: boolean;
  fdd_disbursement_track_record?: boolean; fdd_decision_transparency?: boolean;
  fdd_conflict_disclosure?: boolean; fdd_governance_doc?: boolean; fdd_esg_framework?: boolean;
  fdd_legal_registration?: boolean;
  specializations?: string[]; notable_engagements?: string[]; affiliations?: string[];
  subscription_tier?: string;
}

export type FitResult = {
  listing_id: string;
  listing_title: string;
  fit_score: number;
  reasons: string[];
  gaps: string[];
  rationale: string;
  opening_message: string;
  key_synergy?: string | null;
  criteria?: any;
};

type AlsoFit = { listing_id: string; listing_title: string; fit_score: number };

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function normalizeArr(val: string | string[] | null | undefined): string[] {
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
export function sdgLabel(value: string | number): string {
  const n = typeof value === "number" ? value : parseInt(value, 10);
  if (!Number.isNaN(n) && n >= 1 && n <= SDG_NAMES.length) return SDG_NAMES[n - 1];
  return String(value);
}

function orgTypeLabel(value: string | null | undefined): string {
  if (!value) return "";
  return ORG_TYPE_FILTERS.find(o => o.value === value)?.label ?? value.replace(/_/g, " ");
}

const FUNDER_TYPES = ["philanthropic_foundation", "venture_capital"];

export function isConsultancyOrg(org: OrgRow): boolean {
  return org.organisation_type === "consultancy";
}

const IMPLEMENTER_DD_DOCS: { key: keyof OrgRow; label: string }[] = [
  { key: "dd_financial_model",              label: "Financial model" },
  { key: "dd_audited_accounts",             label: "Audited accounts" },
  { key: "dd_governance_doc",               label: "Governance doc" },
  { key: "dd_esg_assessment",               label: "ESG assessment" },
  { key: "dd_impact_framework",             label: "Impact framework" },
  { key: "dd_environmental_policy",         label: "Environmental policy" },
  { key: "dd_safeguarding_policy",          label: "Safeguarding policy" },
  { key: "dd_legal_registration",           label: "Legal registration" },
  { key: "dd_legal_compliance_declaration", label: "Legal compliance declaration" },
];

const FUNDER_DD_DOCS: { key: keyof OrgRow; label: string }[] = [
  { key: "fdd_disbursement_track_record", label: "Disbursement track record" },
  { key: "fdd_decision_transparency",     label: "Decision transparency" },
  { key: "fdd_conflict_disclosure",       label: "Conflict disclosure" },
  { key: "fdd_governance_doc",            label: "Governance doc" },
  { key: "fdd_esg_framework",             label: "ESG framework" },
  { key: "fdd_legal_registration",        label: "Legal registration" },
];

export function ddDocsFor(org: OrgRow): { key: keyof OrgRow; label: string }[] {
  return FUNDER_TYPES.includes(org.organisation_type) ? FUNDER_DD_DOCS : IMPLEMENTER_DD_DOCS;
}

export function ddScore(org: OrgRow): number {
  return ddDocsFor(org).filter(({ key }) => !!org[key]).length;
}

const STAGE_LABELS: Record<string, string> = {
  concept: "Co-designing", joining_running: "Joining active work",
  pilot: "Pilot phase", scaling: "Scaling",
};
const DURATION_LABELS: Record<string, string> = {
  under_6_months: "Under 6 months", "6_12_months": "6–12 months",
  "1_2_years": "1–2 years", "2_plus_years": "2+ years", ongoing: "Ongoing",
};
const BUDGET_LABELS: Record<string, string> = {
  under_10k: "Under $10K", "10k_50k": "$10K–$50K",
  "50k_200k": "$50K–$200K", over_200k: "Over $200K",
  in_kind_only: "In-kind only", open: "Open to discuss",
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
const WORKING_STYLE_LABELS: Record<string, string> = {
  prefer_lead: "We prefer to lead", equal_codesign: "Equal co-design",
  prefer_support: "We prefer to support", flexible: "Flexible",
};
const FINANCIAL_TRANSFER_LABELS: Record<string, string> = {
  we_pay: "We provide funding", we_get_paid: "We expect compensation",
  no_transfer: "No financial transfer", open: "Open to discuss",
};
const LEGAL_TYPE_LABELS: Record<string, string> = {
  formal_mou: "Formal MoU", subcontracting: "Service provider",
  co_implementation: "Joint delivery", referral: "Referral / network",
  joint_venture: "Joint venture", informal: "Informal", open: "Open",
};

// ─── Small sub-components ──────────────────────────────────────────────────────

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-black dark:text-white mb-3">
      {children}
    </p>
  );
}

function BentoCell({ label, value, accent, capitalize, icon: Icon }: { label: string; value: string; accent?: boolean; capitalize?: boolean; icon?: LucideIcon }) {
  return (
    <div className="rounded-xl p-3.5 bg-card border border-border">
      <div className="flex items-center gap-1.5 mb-1">
        {Icon && <Icon className="w-3 h-3 shrink-0 text-[#2D6A4F]" />}
        <p className="text-[9px] font-black uppercase tracking-widest text-black dark:text-white">{label}</p>
      </div>
      <p className={`text-sm font-bold leading-snug ${accent ? "text-[#2D6A4F]" : "text-foreground"}${capitalize ? " capitalize" : ""}`}>{value}</p>
    </div>
  );
}

// Shared by both the "page" and "panel" variants -- the field list itself
// (and its data-shaping logic) is identical; only the last row's border
// differs (page sections are individual cards so the last row drops its
// border, panel rows sit in one continuous divided flow) -- preserved via
// the variant prop rather than papered over.
// Shared by both variants -- confirmed byte-identical content. score,
// ddDocs, and ddTotal are computed once above the page/panel branch
// point, so they're passed in rather than recomputed here.
// Shared by both variants -- the <button> itself is byte-identical; only
// whether it's wrapped in an extra mobile-only div (panel) differs, and
// that wrapping stays in each variant's own code.
// Shared by both variants -- confirmed byte-identical content across all
// 4 footer states. Each variant keeps its own outer wrapper (page: none
// or a plain rounded card; panel: a sticky-bottom-bar div) and its own
// viewerOrgLoading/user_id/partnership_formed/isOrg branching.
function LoadingIndicator() {
  return <span className="text-xs font-semibold text-black dark:text-white">Loading...</span>;
}

function OwnListingBanner() {
  return (
    <div className="flex items-center gap-2.5 px-4 py-3.5 rounded-xl bg-muted border border-border">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-foreground shrink-0"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
      <p className="text-xs font-black text-foreground">This is your listing</p>
    </div>
  );
}

function PartnershipFormedBanner() {
  return (
    <div className="flex items-center gap-2.5 px-5 py-4 rounded-xl"
      style={{ background: "rgba(29,78,216,0.1)", border: "1px solid rgba(29,78,216,0.3)" }}>
      <CheckCircle2 className="w-4 h-4 shrink-0 text-[#1D4ED8]" />
      <p className="text-xs font-semibold text-[#1D4ED8]">
        This organisation has formed a partnership and closed this listing.
      </p>
    </div>
  );
}

function ExpressInterestPanel({ alreadySent, openingMsg, setOpeningMsg, msgEditing, setMsgEditing, sending, onExpressInterest }: {
  alreadySent: boolean; openingMsg: string | null; setOpeningMsg: (v: string) => void;
  msgEditing: boolean; setMsgEditing: (v: boolean) => void;
  sending: boolean; onExpressInterest: (e: React.MouseEvent) => void;
}) {
  if (alreadySent) {
    return (
      <div className="flex items-center gap-2 text-sm font-semibold text-[#065F46]">
        <CheckCircle2 className="w-4 h-4" />Interest expressed — they've been notified
      </div>
    );
  }
  return (
    <>
      {openingMsg && !msgEditing && (
        <div className="rounded-xl p-4 space-y-2 bg-muted border border-border">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-widest text-black dark:text-white">AI-drafted opening message</p>
            <button type="button" onClick={() => setMsgEditing(true)}
              className="text-[10px] font-semibold text-black dark:text-white hover:text-foreground underline underline-offset-2">
              Edit
            </button>
          </div>
          <p className="text-xs text-foreground leading-relaxed">{openingMsg}</p>
        </div>
      )}
      {msgEditing && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-widest text-black dark:text-white">Edit opening message</p>
            <button type="button" onClick={() => setMsgEditing(false)}
              className="text-[10px] font-semibold text-black dark:text-white hover:text-foreground underline underline-offset-2">
              Done
            </button>
          </div>
          <textarea rows={4} value={openingMsg ?? ""}
            onChange={e => setOpeningMsg(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl text-xs text-foreground resize-none focus:outline-none bg-muted border border-border" />
        </div>
      )}
      <button type="button"
        onClick={e => {
          if (openingMsg) {
            (e as any).customMessage = openingMsg;
          }
          onExpressInterest(e);
        }}
        disabled={sending}
        className="w-full h-11 rounded-full text-white text-sm font-bold disabled:opacity-40 transition-all hover:brightness-110 active:scale-[0.98]"
        style={{ background: "linear-gradient(135deg, #3D2618 0%, #33301F 50%, #1B3328 100%)" }}>
        {sending ? "Sending..." : "Express interest"}
      </button>
    </>
  );
}

function BackButton({ onBack, backLabel }: { onBack: () => void; backLabel: string }) {
  return (
    <button type="button" onClick={onBack}
      className="flex items-center gap-1.5 text-sm text-black dark:text-white hover:text-[#C45C26] transition-colors">
      <ArrowLeft className="w-3.5 h-3.5" /> {backLabel}
    </button>
  );
}

// Shared by both variants -- the outer row div is byte-identical
// ("flex items-center gap-2 flex-wrap mb-1"), so the whole row (name
// link + all 5 badges) is one component. The name link's className is
// the one real difference between variants (font weight/leading),
// handled via the variant prop -- same pattern as WorkingExpectationsList.
function IdentityNameRow({ org, variant, isVerified, mouExecuted, fitLoading, fitLocked, fit }: {
  org: OrgRow; variant: "page" | "panel";
  isVerified: boolean; mouExecuted: boolean; fitLoading: boolean; fitLocked: boolean; fit: FitResult | null;
}) {
  const nameClass = variant === "page"
    ? "text-2xl font-bold text-foreground hover:text-[#C45C26] transition-colors tracking-tight"
    : "text-2xl font-black text-foreground hover:text-[#C45C26] transition-colors leading-tight tracking-tight";
  return (
    <div className="flex items-center gap-2 flex-wrap mb-1">
      <Link href={`/dashboard/natives?tab=organisation&user=${org.user_id}`} className={nameClass}>
        {org.organisation_name}
      </Link>
      {isVerified && (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
          style={{ background: "rgba(6,95,70,0.12)", color: "#065F46", border: "1px solid rgba(6,95,70,0.3)" }}>
          <ShieldCheck className="w-3 h-3" />Verified
        </span>
      )}
      {mouExecuted && (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
          style={{ background: "rgba(45,106,79,0.12)", color: "#2D6A4F", border: "1px solid rgba(45,106,79,0.3)" }}>
          <Award className="w-3 h-3" />MoU Executed
        </span>
      )}
      {fitLoading && (
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full shrink-0 bg-muted text-black dark:text-white border border-border">
          <Loader2 className="w-3 h-3 animate-spin" />Scoring fit...
        </span>
      )}
      {fitLocked && (
        <Link href="/dashboard/settings?tab=billing"
          className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full shrink-0 bg-muted text-black dark:text-white border border-border hover:border-[#2D6A4F]/40 hover:text-[#2D6A4F] transition-colors">
          <Sparkles className="w-3 h-3" />AI fit score — upgrade
        </Link>
      )}
      {fit && !fitLoading && (
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full shrink-0"
          style={{
            background: fit.fit_score >= 70 ? "rgba(6,95,70,0.12)" : fit.fit_score >= 50 ? "rgba(146,64,14,0.12)" : "rgba(153,27,27,0.12)",
            color: fit.fit_score >= 70 ? "#065F46" : fit.fit_score >= 50 ? "#92400E" : "#991B1B",
            border: `1px solid ${fit.fit_score >= 70 ? "rgba(6,95,70,0.3)" : fit.fit_score >= 50 ? "rgba(146,64,14,0.3)" : "rgba(153,27,27,0.3)"}`,
          }}>
          {fit.fit_score}% fit
        </span>
      )}
    </div>
  );
}

// Shared by both variants -- plain text content, not a component, since
// the wrapping element itself (span vs p, different classes) genuinely
// differs and stays with each variant.
function orgTypeAndCountriesLabel(org: OrgRow, countries: string[]): string {
  return `${orgTypeLabel(org.organisation_type)}${countries.length > 0 ? ` · ${countries.join(", ")}` : ""}`;
}

// Shared by both variants -- confirmed byte-identical content.
function SaveButton({ isSaved, onToggleSave }: { isSaved: boolean; onToggleSave: (e: React.MouseEvent) => void }) {
  return (
    <button type="button" onClick={onToggleSave}
      className="shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-full transition-all border border-border"
      style={{ color: isSaved ? "#065F46" : undefined, background: isSaved ? "rgba(6,95,70,0.1)" : "transparent" }}>
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5"
        fill={isSaved ? "#065F46" : "none"} stroke="currentColor" strokeWidth={2}>
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
      </svg>
      {isSaved ? "Saved" : "Save"}
    </button>
  );
}

// Shared by both variants -- confirmed byte-identical rendering. Each
// variant keeps its own choice of where to place it and what margin to
// give it, since the position in the tree genuinely differs.
function SectorTags({ sectors }: { sectors: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {sectors.map(s => (
        <span key={s} className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-muted text-foreground border border-border">
          {s}
        </span>
      ))}
    </div>
  );
}

function ConsultantExpertiseContent({ org }: { org: OrgRow }) {
  return (
    <>
      <Eyebrow>Consultant expertise</Eyebrow>
      {org.specializations && org.specializations.length > 0 && (
        <div className="mt-3">
          <p className="text-xs text-black dark:text-white mb-1.5">Specializations</p>
          <div className="flex flex-wrap gap-2">
            {org.specializations.map(s => (
              <span key={s} className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-muted text-foreground border border-border">{s}</span>
            ))}
          </div>
        </div>
      )}
      {org.notable_engagements && org.notable_engagements.length > 0 && (
        <div className="mt-3">
          <p className="text-xs text-black dark:text-white mb-1.5">Notable engagements</p>
          <ul className="text-sm text-foreground space-y-1 list-disc list-inside">
            {org.notable_engagements.map(e => <li key={e}>{e}</li>)}
          </ul>
        </div>
      )}
      {org.affiliations && org.affiliations.length > 0 && (
        <p className="text-sm text-foreground mt-3"><span className="font-semibold">Affiliations: </span>{org.affiliations.join(", ")}</p>
      )}
    </>
  );
}

// Shared by both variants -- confirmed byte-identical content.
function ContextGrid({ org }: { org: OrgRow }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {org.partnership_theory_of_change && (
        <div className="rounded-xl px-5 py-5 space-y-2 flex flex-col bg-muted border border-border">
          <p className="text-[10px] font-black uppercase tracking-widest text-black dark:text-white">Approach to change</p>
          <p className="text-sm text-foreground leading-relaxed flex-1">{org.partnership_theory_of_change}</p>
        </div>
      )}
      {org.partnership_prior_attempts && (
        <div className="rounded-xl px-5 py-5 space-y-2 flex flex-col bg-muted border border-border">
          <p className="text-[10px] font-black uppercase tracking-widest text-black dark:text-white">Previous attempts</p>
          <p className="text-sm text-foreground leading-relaxed flex-1">{org.partnership_prior_attempts}</p>
        </div>
      )}
      {org.partnership_constraints && (
        <div className="rounded-xl px-5 py-5 space-y-2 flex flex-col bg-muted border border-border">
          <p className="text-[10px] font-black uppercase tracking-widest text-black dark:text-white">Constraints</p>
          <p className="text-sm text-foreground leading-relaxed flex-1">{org.partnership_constraints}</p>
        </div>
      )}
    </div>
  );
}

// Shared by both variants -- confirmed byte-identical content.
function TrackRecordContent({ org }: { org: OrgRow }) {
  return (
    <div className="flex items-start gap-3">
      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${org.partnership_prior_experience ? "bg-[#2D6A4F]" : "bg-muted"}`}>
        {org.partnership_prior_experience
          ? <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
          : <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-black dark:text-white"><path d="M18 6L6 18M6 6l12 12"/></svg>}
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">
          {org.partnership_prior_experience ? "Has completed a partnership before" : "No prior completed partnerships"}
        </p>
        {org.partnership_prior_experience && org.partnership_prior_experience_detail && (
          <p className="text-sm text-foreground leading-relaxed mt-1">{org.partnership_prior_experience_detail}</p>
        )}
      </div>
    </div>
  );
}

// Shared by both variants -- confirmed byte-identical content.
function WebsiteLink({ org }: { org: OrgRow }) {
  return (
    <a href={org.website!} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2D6A4F] hover:underline">
      <ArrowUpRight className="w-3.5 h-3.5" />
      {org.website!.replace(/^https?:\/\//, "")}
    </a>
  );
}

// Shared by both variants. The org's own 12-month success statement, given
// visual weight as an outcome card instead of sitting as one more grey box.
function SuccessOutcomeCard({ org }: { org: OrgRow }) {
  return (
    <div className="rounded-xl px-5 py-5 border border-[#2D6A4F]/30"
      style={{ background: "linear-gradient(135deg, rgba(45,106,79,0.08) 0%, rgba(45,106,79,0.02) 100%)" }}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 bg-[#2D6A4F]">
          <Target className="w-3.5 h-3.5 text-white" />
        </div>
        <p className="text-[10px] font-black uppercase tracking-widest text-[#2D6A4F]">Success in 12 months</p>
      </div>
      <p className="text-base font-semibold text-foreground leading-relaxed">"{org.partnership_success_definition}"</p>
    </div>
  );
}

function SdgAlignmentGrid({ org }: { org: OrgRow }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {org.sdgs!.map(sdg => (
        <span key={sdg} className="text-xs font-bold px-3 py-1.5 rounded-lg"
          style={{ background: "rgba(6,95,70,0.12)", color: "#065F46", border: "1px solid rgba(6,95,70,0.3)" }}>
          {sdgLabel(sdg)}
        </span>
      ))}
    </div>
  );
}

function DueDiligenceReadiness({ org, score, ddTotal, ddDocs }: { org: OrgRow; score: number; ddTotal: number; ddDocs: { key: keyof OrgRow; label: string }[] }) {
  if (isConsultancyOrg(org)) {
    return (
      <>
        <Eyebrow>Due diligence readiness</Eyebrow>
        <p className="text-xs text-black dark:text-white mt-2">
          Institutional due diligence (audited accounts, board governance) doesn't apply to solo consultancies.
        </p>
      </>
    );
  }
  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <Eyebrow>Due diligence readiness</Eyebrow>
        <span className="text-xs font-bold mb-3" style={{ color: score > ddTotal / 2 ? "#065F46" : "#92400E" }}>{score} of {ddTotal} docs ready</span>
      </div>
      <div className="h-1.5 rounded-full mb-4 overflow-hidden bg-muted">
        <div className="h-full rounded-full transition-all" style={{ width: `${(score / ddTotal) * 100}%`, background: score > ddTotal / 2 ? "#2D6A4F" : "#C45C26" }} />
      </div>
      {score === 0 ? (
        <p className="text-xs text-black dark:text-white">No documents confirmed ready yet.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {ddDocs.filter(({ key }) => !!org[key]).map(({ label }) => (
            <span key={label} className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg"
              style={{ background: "rgba(6,95,70,0.12)", color: "#065F46", border: "1px solid rgba(6,95,70,0.3)" }}>
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
              {label}
            </span>
          ))}
        </div>
      )}
    </>
  );
}

// Section guards -- one definition per section so page and panel can't drift.
// Cover every field the grids can render (the old inline guards skipped geo,
// team capacity, lead contact and physical presence).
function hasPartnershipSignals(org: OrgRow): boolean {
  return !!(org.partnership_stage || org.partnership_duration || org.partnership_budget || org.partnership_decision_timeline || org.partnership_funding_status || org.partnership_exclusivity || org.partnership_geo_specificity || org.partnership_team_capacity || org.partnership_contact_seniority);
}

function hasWorkingExpectations(org: OrgRow): boolean {
  return !!(org.partnership_working_style || org.partnership_financial_transfer || org.partnership_legal_type?.length || org.partnership_reporting?.length || org.partnership_ip_ownership || (org.partnership_physically_present !== null && org.partnership_physically_present !== undefined));
}

const WORKING_EXPECTATION_ICONS: Record<string, LucideIcon> = {
  "Working style": Compass,
  "Financial arrangement": Banknote,
  "Partnership type": FileText,
  "Reporting": ClipboardList,
  "IP ownership": Scale,
  "Physical presence": Building2,
};

function WorkingExpectationsList({ org }: { org: OrgRow }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
      {[
        org.partnership_working_style     && { label: "Working style",       value: WORKING_STYLE_LABELS[org.partnership_working_style] ?? org.partnership_working_style },
        org.partnership_financial_transfer && { label: "Financial arrangement", value: FINANCIAL_TRANSFER_LABELS[org.partnership_financial_transfer] ?? org.partnership_financial_transfer },
        org.partnership_legal_type?.length && { label: "Partnership type",   value: org.partnership_legal_type!.map(t => LEGAL_TYPE_LABELS[t] ?? t).join(", ") },
        org.partnership_reporting?.length  && { label: "Reporting",          value: org.partnership_reporting!.map(r => r.replace(/_/g, " ")).join(", ") },
        org.partnership_ip_ownership      && { label: "IP ownership",        value: org.partnership_ip_ownership.replace(/_/g, " ") },
        org.partnership_physically_present !== null && org.partnership_physically_present !== undefined && { label: "Physical presence", value: org.partnership_physically_present ? "On the ground" : "Remote" },
      ].filter(Boolean).map((row: any) => (
        <BentoCell key={row.label} label={row.label} value={row.value} icon={WORKING_EXPECTATION_ICONS[row.label]} capitalize />
      ))}
    </div>
  );
}

function PartnershipSignalsGrid({ org }: { org: OrgRow }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
      {org.partnership_stage && <BentoCell label="Stage" icon={Layers} value={STAGE_LABELS[org.partnership_stage] ?? org.partnership_stage} accent />}
      {org.partnership_duration && <BentoCell label="Duration" icon={Clock} value={DURATION_LABELS[org.partnership_duration] ?? org.partnership_duration} />}
      {org.partnership_budget && <BentoCell label="Budget" icon={Wallet} value={BUDGET_LABELS[org.partnership_budget] ?? org.partnership_budget} />}
      {org.partnership_decision_timeline && <BentoCell label="Timeline" icon={CalendarDays} value={TIMELINE_LABELS[org.partnership_decision_timeline] ?? org.partnership_decision_timeline} />}
      {org.partnership_funding_status && <BentoCell label="Funding status" icon={Coins} value={FUNDING_STATUS_LABELS[org.partnership_funding_status] ?? org.partnership_funding_status} />}
      {org.partnership_exclusivity && <BentoCell label="Exclusivity" icon={Lock} value={org.partnership_exclusivity === "one_dedicated_partner" ? "One partner only" : "Open to multiple"} />}
      {org.partnership_geo_specificity && <BentoCell label="Location focus" icon={MapPin} value={org.partnership_geo_specificity} />}
      {org.partnership_team_capacity && <BentoCell label="Team capacity" icon={Users} value={org.partnership_team_capacity.replace(/_/g, " ").replace(/(\d) (\d)/g, "$1–$2")} />}
      {org.partnership_contact_seniority && <BentoCell label="Lead contact" icon={User} value={org.partnership_contact_seniority.replace(/_/g, " ")} />}
    </div>
  );
}

// Wraps a content section: in "page" mode each section becomes its own card,
// matching InitiativeDetail's Sectors/Locations/Budget card treatment exactly
// (rounded-xl border bg-card, px-5 py-4).
function Section({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-border bg-card px-5 py-4 ${className}`}>{children}</div>;
}

// "Also fits" footnote -- shown inside the existing fit-analysis box, not as
// a separate card, since it's the same fit story, just noting there's more
// of it. Clicking swaps the whole box to that listing's own analysis via a
// plain cache read (no AI call -- v10 caches every qualifying result).
function AlsoFitsFootnote({ items, onSelect }: { items: AlsoFit[]; onSelect: (item: AlsoFit) => void }) {
  if (items.length === 0) return null;
  return (
    <div className="pt-3 mt-1 border-t border-border/60 space-y-1.5">
      {items.map(af => (
        <button key={af.listing_id} type="button" onClick={() => onSelect(af)}
          className="block text-xs text-black dark:text-white hover:text-[#2D6A4F] transition-colors underline underline-offset-2 text-left">
          Also a fit: {af.listing_title} ({af.fit_score}%)
        </button>
      ))}
    </div>
  );
}

// ─── Main panel ─────────────────────────────────────────────────────────────────

export function OrgDetailPanel({ org, isSaved, onToggleSave, isOrg, alreadySent, sending, onExpressInterest, onBack, backLabel, viewerOrg, viewerOrgLoading, variant = "panel", mouExecuted = false }: {
  org: OrgRow | null; isSaved: boolean; onToggleSave: (e: React.MouseEvent) => void;
  isOrg: boolean; alreadySent: boolean; sending: boolean;
  onExpressInterest: (e: React.MouseEvent) => void; onBack: () => void;
  backLabel?: string;
  viewerOrg: OrgRow | null;
  viewerOrgLoading: boolean;
  variant?: "panel" | "page";
  mouExecuted?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<FitResult | null>(null);
  const [fitLoading, setFitLoading] = useState(false);
  const [fitLocked, setFitLocked] = useState(false);
  const [alsoFits, setAlsoFits] = useState<AlsoFit[]>([]);
  const [openingMsg, setOpeningMsg] = useState<string | null>(null);
  const [msgEditing, setMsgEditing] = useState(false);

  useEffect(() => {
    if (org && ref.current) ref.current.scrollTop = 0;
    setFit(null);
    setFitLocked(false);
    setAlsoFits([]);
    setOpeningMsg(null);
    setMsgEditing(false);
    if (org && viewerOrg && org.user_id !== viewerOrg.user_id && org.id !== viewerOrg.id) {
      loadFit(org, viewerOrg);
    }

  }, [org?.id, viewerOrg?.id]);

  async function loadFit(listing: OrgRow, viewer: OrgRow) {
    // Free-tier viewers never get a real score from this endpoint --
    // score-partnership-fit itself already gates on subscription_tier and
    // returns eligible:false/requires_upgrade, but calling it anyway just
    // to get told no means burning a network round trip AND showing a
    // loading spinner for a feature the viewer can't use. Check first;
    // skip the call and the spinner entirely.
    if (viewer.subscription_tier === "free") {
      setFitLocked(true);
      return;
    }

    // No specific listing to compare against -- fails quiet, same
    // convention as before when the viewer org itself was missing.
    if (!listing.listing_id) return;

    setFitLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("score-partnership-fit", {
        body: { viewer_org_id: viewer.id, target_listing_id: listing.listing_id },
      });
      if (error) { console.error("Fit score error:", error); return; }
      if (data?.reason === "requires_upgrade") { setFitLocked(true); return; }
      if (data?.reason === "no_published_listing") return; // fail quiet -- viewer has no listing to compare with
      if (data?.eligible && data?.primary) {
        setFit(data.primary);
        setAlsoFits(data.also_fits ?? []);
        setOpeningMsg(data.primary.opening_message ?? null);
      }
    } catch (e) {
      console.error("Fit score error:", e);
    } finally {
      setFitLoading(false);
    }
  }

  // Swaps the displayed fit to a listing named in "Also fits" -- reads the
  // already-cached pair directly, no AI call. The listing being swapped
  // away from goes back into the also-fits list so it isn't lost.
  async function swapToAlsoFit(target: AlsoFit) {
    if (!org?.listing_id) return;
    const { data } = await supabase
      .from("partnership_match_cache")
      .select("matched_org_id, fit_score, rationale, key_synergy, criteria, reasons, gaps, opening_message")
      .eq("submitting_listing_id", target.listing_id)
      .eq("matched_listing_id", org.listing_id)
      .maybeSingle();
    if (!data) return;

    setAlsoFits(prev => {
      const rest = prev.filter(x => x.listing_id !== target.listing_id);
      if (fit) rest.push({ listing_id: fit.listing_id, listing_title: fit.listing_title, fit_score: fit.fit_score });
      return rest.sort((a, b) => b.fit_score - a.fit_score);
    });
    setFit({
      listing_id: target.listing_id,
      listing_title: target.listing_title,
      fit_score: data.fit_score,
      rationale: data.rationale,
      key_synergy: data.key_synergy ?? null,
      criteria: data.criteria ?? null,
      reasons: data.reasons ?? [],
      gaps: data.gaps ?? [],
      opening_message: data.opening_message,
    });
    setOpeningMsg(data.opening_message ?? null);
    setMsgEditing(false);
  }
  if (!org) {
    return (
      <div className="hidden lg:flex flex-col items-center justify-center h-full gap-4 text-center px-10 bg-muted/30">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-muted border border-border">
          <Sparkles className="w-6 h-6 text-foreground" />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground mb-1">Select a listing</p>
          <p className="text-xs text-black dark:text-white max-w-xs leading-relaxed">Click any organisation from the list to view their full partnership profile.</p>
        </div>
      </div>
    );
  }

  const isVerified = org.verification_status === "verified";
  const sectors = normalizeArr(org.sector);
  const countries = normalizeArr(org.country);
  const score = ddScore(org);
  const ddDocs = ddDocsFor(org);
  const ddTotal = ddDocs.length;

  // ── Page variant: flat content matching InitiativeDetail exactly ──
  if (variant === "page") {
    return (
      <div className="space-y-6">
        {backLabel && <BackButton onBack={onBack} backLabel={backLabel} />}

        {/* Identity -- no card, no gradient, sits directly on the page like InitiativeDetail's title block */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <IdentityNameRow org={org} variant="page" isVerified={isVerified} mouExecuted={mouExecuted} fitLoading={fitLoading} fitLocked={fitLocked} fit={fit} />
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="text-xs text-black dark:text-white capitalize">
                {orgTypeAndCountriesLabel(org, countries)}
              </span>
            </div>
            {sectors.length > 0 && (
              <div className="mt-3">
                <SectorTags sectors={sectors} />
              </div>
            )}
          </div>
          <SaveButton isSaved={isSaved} onToggleSave={onToggleSave} />
        </div>

        {org.description && (
          <Section>
            <p className="text-[15px] text-foreground leading-relaxed">{org.description}</p>
          </Section>
        )}

        {(org.partnership_sought || org.partnership_success_definition) && (
          <div className="space-y-3">
            {org.partnership_sought && (
              <Section>
                <Eyebrow>Seeking</Eyebrow>
                <p className="text-[15px] text-foreground leading-relaxed">{org.partnership_sought}</p>
              </Section>
            )}
            {org.partnership_success_definition && <SuccessOutcomeCard org={org} />}
          </div>
        )}

        {(fit || fitLoading) && org.user_id !== viewerOrg?.user_id && (
          <div className="rounded-xl border border-border bg-card px-5 py-4"
            style={{ background: "linear-gradient(135deg, rgba(13,43,26,0.04) 0%, rgba(26,74,46,0.02) 100%)" }}>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 bg-[#2D6A4F]">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
              <p className="text-xs font-black uppercase tracking-widest text-[#2D6A4F]">Your fit analysis</p>
              {fitLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#2D6A4F] ml-auto" />}
              {fit && !fitLoading && (
                <div className="ml-auto flex items-center gap-2">
                  <div className="h-1.5 w-24 rounded-full overflow-hidden bg-muted">
                    <div className="h-full rounded-full transition-all" style={{
                      width: `${fit.fit_score}%`,
                      background: fit.fit_score >= 70 ? "#2D6A4F" : fit.fit_score >= 50 ? "#F59E0B" : "#EF4444"
                    }} />
                  </div>
                  <span className="text-sm font-black" style={{
                    color: fit.fit_score >= 70 ? "#065F46" : fit.fit_score >= 50 ? "#92400E" : "#991B1B"
                  }}>{fit.fit_score}%</span>
                </div>
              )}
            </div>
            {fit && !fitLoading && fit.listing_title && (
              <p className="text-[11px] text-black dark:text-white mb-3">Based on your "{fit.listing_title}" listing</p>
            )}

            {fitLoading && (
              <p className="text-xs text-black dark:text-white mt-3">Analysing compatibility with your organisation profile...</p>
            )}
            {fitLocked && (
              <p className="text-xs text-black dark:text-white mt-3">
                AI fit scoring is a Plus feature.{" "}
                <Link href="/dashboard/settings?tab=billing" className="text-[#2D6A4F] font-medium hover:underline">Upgrade to unlock</Link>.
              </p>
            )}

            {fit && !fitLoading && (
              <div className="space-y-4">
                <p className="text-[15px] text-foreground leading-relaxed">{fit.rationale}</p>

                {fit.reasons.length > 0 && (
                  <div className="flex flex-col gap-2">
                    {fit.reasons.map((r, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: "rgba(6,95,70,0.12)" }}>
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#065F46" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                        </div>
                        <span className="text-xs text-foreground leading-relaxed">{r}</span>
                      </div>
                    ))}
                  </div>
                )}

                {fit.gaps.length > 0 && (
                  <div className="rounded-xl px-4 py-3.5 space-y-2"
                    style={{ background: "rgba(146,64,14,0.08)", border: "1px solid rgba(146,64,14,0.3)" }}>
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#92400E]">Gaps to address before reaching out</p>
                    <div className="flex flex-col gap-1.5">
                      {fit.gaps.map((g, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="mt-1 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "#F59E0B" }} />
                          <p className="text-xs text-[#92400E] leading-relaxed">{g}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <AlsoFitsFootnote items={alsoFits} onSelect={swapToAlsoFit} />
              </div>
            )}
          </div>
        )}

        {hasPartnershipSignals(org) && (
          <Section>
            <Eyebrow>Partnership signals</Eyebrow>
            <PartnershipSignalsGrid org={org} />
          </Section>
        )}

        {hasWorkingExpectations(org) && (
          <Section>
            <Eyebrow>Working expectations</Eyebrow>
            <WorkingExpectationsList org={org} />
          </Section>
        )}

        {((org.needs && org.needs.length > 0) || (org.offers && org.offers.length > 0)) && (
          <Section className="space-y-5">
            {org.needs && org.needs.length > 0 && (
              <div>
                <Eyebrow>Looking for in a partner</Eyebrow>
                <div className="flex flex-wrap gap-2">
                  {org.needs.map(n => (
                    <span key={n} className="text-sm font-semibold px-4 py-2 rounded-lg text-foreground bg-muted border border-border">{n}</span>
                  ))}
                </div>
              </div>
            )}
            {org.offers && org.offers.length > 0 && (
              <div>
                <Eyebrow>What they bring</Eyebrow>
                <div className="flex flex-wrap gap-2">
                  {org.offers.map(o => (
                    <span key={o} className="text-sm font-bold px-4 py-2 rounded-lg"
                      style={{ background: "rgba(6,95,70,0.12)", color: "#065F46", border: "1px solid rgba(6,95,70,0.3)" }}>{o}</span>
                  ))}
                </div>
              </div>
            )}
          </Section>
        )}

        <Section>
          <DueDiligenceReadiness org={org} score={score} ddTotal={ddTotal} ddDocs={ddDocs} />
        </Section>
              {isConsultancyOrg(org) && !!(org.specializations?.length || org.notable_engagements?.length || org.affiliations?.length) && (
                <Section>
                  <ConsultantExpertiseContent org={org} />
                </Section>
              )}
              <VerifiedOutcomesSection orgId={org.id} variant="page" isOwnOrg={viewerOrg?.id === org.id} />
              {org.sdgs && org.sdgs.length > 0 && (
                <Section>
                  <Eyebrow>SDG alignment</Eyebrow>
                  <SdgAlignmentGrid org={org} />
                </Section>
              )}

        {(org.partnership_theory_of_change || org.partnership_prior_attempts || org.partnership_constraints) && (
          <Section>
            <Eyebrow>Context</Eyebrow>
            <ContextGrid org={org} />
          </Section>
        )}

        {org.partnership_prior_experience !== null && org.partnership_prior_experience !== undefined && (
          <Section>
            <Eyebrow>Track record</Eyebrow>
            <TrackRecordContent org={org} />
          </Section>
        )}

        {org.website && org.website !== "https://" && (
          <WebsiteLink org={org} />
        )}

        {viewerOrgLoading ? (
          <div className="rounded-xl border border-border bg-card px-5 py-4">
            <LoadingIndicator />
          </div>
        ) : org.user_id === viewerOrg?.user_id ? (
          <OwnListingBanner />
        ) : org.partnership_formed ? (
          <PartnershipFormedBanner />
        ) : isOrg && (
          <div className="rounded-xl border border-border bg-card px-5 py-4 space-y-3">
            <ExpressInterestPanel alreadySent={alreadySent} openingMsg={openingMsg} setOpeningMsg={setOpeningMsg}
              msgEditing={msgEditing} setMsgEditing={setMsgEditing} sending={sending} onExpressInterest={onExpressInterest} />
          </div>
        )}
      </div>
    );
  }

  // ── Panel variant: unchanged split-pane look ──
  return (
    <div ref={ref} className="flex flex-col h-full overflow-y-auto bg-background">

      {/* ── Identity block ── */}
      <div className="shrink-0 px-8 pt-7 pb-6 border-b-2 border-border"
        style={{ background: "linear-gradient(to bottom, rgba(45,106,79,0.06), transparent)" }}>
        {backLabel && (
          <div className="flex justify-between mb-4 lg:hidden">
            <BackButton onBack={onBack} backLabel={backLabel} />
          </div>
        )}

        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1 min-w-0">
            <IdentityNameRow org={org} variant="panel" isVerified={isVerified} mouExecuted={mouExecuted} fitLoading={fitLoading} fitLocked={fitLocked} fit={fit} />
            <p className="text-sm text-black dark:text-white capitalize">
              {orgTypeAndCountriesLabel(org, countries)}
            </p>
          </div>
          <SaveButton isSaved={isSaved} onToggleSave={onToggleSave} />
        </div>

        {sectors.length > 0 && <SectorTags sectors={sectors} />}
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 divide-y divide-border">

        {org.description && (
          <div className="px-8 py-5 border-b border-border">
            <p className="text-[15px] text-foreground leading-relaxed">{org.description}</p>
          </div>
        )}

        {(org.partnership_sought || org.partnership_success_definition) && (
          <div className="px-8 py-6 space-y-4">
            {org.partnership_sought && (
              <div>
                <Eyebrow>Seeking</Eyebrow>
                <p className="text-[15px] text-foreground leading-relaxed">{org.partnership_sought}</p>
              </div>
            )}
            {org.partnership_success_definition && <SuccessOutcomeCard org={org} />}
          </div>
        )}

        {(fit || fitLoading) && org.user_id !== viewerOrg?.user_id && (
          <div className="px-8 py-6 border-t border-b border-border"
            style={{ background: "linear-gradient(135deg, rgba(13,43,26,0.04) 0%, rgba(26,74,46,0.02) 100%)" }}>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 bg-[#2D6A4F]">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
              <p className="text-xs font-black uppercase tracking-widest text-[#2D6A4F]">Your fit analysis</p>
              {fitLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#2D6A4F] ml-auto" />}
              {fit && !fitLoading && (
                <div className="ml-auto flex items-center gap-2">
                  <div className="h-1.5 w-24 rounded-full overflow-hidden bg-muted">
                    <div className="h-full rounded-full transition-all" style={{
                      width: `${fit.fit_score}%`,
                      background: fit.fit_score >= 70 ? "#2D6A4F" : fit.fit_score >= 50 ? "#F59E0B" : "#EF4444"
                    }} />
                  </div>
                  <span className="text-sm font-black" style={{
                    color: fit.fit_score >= 70 ? "#065F46" : fit.fit_score >= 50 ? "#92400E" : "#991B1B"
                  }}>{fit.fit_score}%</span>
                </div>
              )}
            </div>
            {fit && !fitLoading && fit.listing_title && (
              <p className="text-[11px] text-black dark:text-white mb-3">Based on your "{fit.listing_title}" listing</p>
            )}

            {fitLoading && (
              <p className="text-xs text-black dark:text-white mt-3">Analysing compatibility with your organisation profile...</p>
            )}
            {fitLocked && (
              <p className="text-xs text-black dark:text-white mt-3">
                AI fit scoring is a Plus feature.{" "}
                <Link href="/dashboard/settings?tab=billing" className="text-[#2D6A4F] font-medium hover:underline">Upgrade to unlock</Link>.
              </p>
            )}

            {fit && !fitLoading && (
              <div className="space-y-4">
                <p className="text-[15px] text-foreground leading-relaxed">{fit.rationale}</p>

                {fit.reasons.length > 0 && (
                  <div className="flex flex-col gap-2">
                    {fit.reasons.map((r, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: "rgba(6,95,70,0.12)" }}>
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#065F46" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                        </div>
                        <span className="text-xs text-foreground leading-relaxed">{r}</span>
                      </div>
                    ))}
                  </div>
                )}

                {fit.gaps.length > 0 && (
                  <div className="rounded-xl px-4 py-3.5 space-y-2"
                    style={{ background: "rgba(146,64,14,0.08)", border: "1px solid rgba(146,64,14,0.3)" }}>
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#92400E]">Gaps to address before reaching out</p>
                    <div className="flex flex-col gap-1.5">
                      {fit.gaps.map((g, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="mt-1 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "#F59E0B" }} />
                          <p className="text-xs text-[#92400E] leading-relaxed">{g}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <AlsoFitsFootnote items={alsoFits} onSelect={swapToAlsoFit} />
              </div>
            )}
          </div>
        )}

        {hasPartnershipSignals(org) && (
          <div className="px-8 py-6">
            <Eyebrow>Partnership signals</Eyebrow>
            <PartnershipSignalsGrid org={org} />
          </div>
        )}

        {hasWorkingExpectations(org) && (
          <div className="px-8 py-6">
            <Eyebrow>Working expectations</Eyebrow>
            <WorkingExpectationsList org={org} />
          </div>
        )}

        {((org.needs && org.needs.length > 0) || (org.offers && org.offers.length > 0)) && (
          <div className="px-8 py-6 space-y-5">
            {org.needs && org.needs.length > 0 && (
              <div>
                <Eyebrow>Looking for in a partner</Eyebrow>
                <div className="flex flex-wrap gap-2">
                  {org.needs.map(n => (
                    <span key={n} className="text-sm font-semibold px-4 py-2 rounded-lg text-foreground bg-muted border border-border">{n}</span>
                  ))}
                </div>
              </div>
            )}
            {org.offers && org.offers.length > 0 && (
              <div>
                <Eyebrow>What they bring</Eyebrow>
                <div className="flex flex-wrap gap-2">
                  {org.offers.map(o => (
                    <span key={o} className="text-sm font-bold px-4 py-2 rounded-lg"
                      style={{ background: "rgba(6,95,70,0.12)", color: "#065F46", border: "1px solid rgba(6,95,70,0.3)" }}>{o}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="px-8 py-6">
          <DueDiligenceReadiness org={org} score={score} ddTotal={ddTotal} ddDocs={ddDocs} />
        </div>
          
          {isConsultancyOrg(org) && !!(org.specializations?.length || org.notable_engagements?.length || org.affiliations?.length) && (
            <div className="mt-6">
              <ConsultantExpertiseContent org={org} />
            </div>
          )}
          <VerifiedOutcomesSection orgId={org.id} variant="panel" isOwnOrg={viewerOrg?.id === org.id} />
            
        {org.sdgs && org.sdgs.length > 0 && (
          <div className="px-8 py-6">
            <Eyebrow>SDG alignment</Eyebrow>
            <SdgAlignmentGrid org={org} />
          </div>
        )}

        {(org.partnership_theory_of_change || org.partnership_prior_attempts || org.partnership_constraints) && (
          <div className="px-8 py-6">
            <Eyebrow>Context</Eyebrow>
            <ContextGrid org={org} />
          </div>
        )}

        {org.partnership_prior_experience !== null && org.partnership_prior_experience !== undefined && (
          <div className="px-8 py-6">
            <Eyebrow>Track record</Eyebrow>
            <TrackRecordContent org={org} />
          </div>
        )}

        {org.website && org.website !== "https://" && (
          <div className="px-8 py-4">
            <WebsiteLink org={org} />
          </div>
        )}

        {viewerOrgLoading ? (
          <div className="px-8 py-4 border-t border-border">
            <LoadingIndicator />
          </div>
        ) : org.user_id === viewerOrg?.user_id ? (
          <div className="px-8 py-6 sticky bottom-0 bg-background border-t border-border">
            <OwnListingBanner />
          </div>
        ) : org.partnership_formed ? (
          <div className="px-8 py-6 sticky bottom-0 bg-background border-t border-border">
            <PartnershipFormedBanner />
          </div>
        ) : isOrg && (
          <div className="px-8 py-6 sticky bottom-0 bg-background space-y-3 border-t border-border">
            <ExpressInterestPanel alreadySent={alreadySent} openingMsg={openingMsg} setOpeningMsg={setOpeningMsg}
              msgEditing={msgEditing} setMsgEditing={setMsgEditing} sending={sending} onExpressInterest={onExpressInterest} />
          </div>
        )}
      </div>
    </div>
  );
}
