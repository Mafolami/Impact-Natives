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
import { Loader2, ShieldCheck, Sparkles, CheckCircle2, ArrowUpRight, ArrowLeft, Award, Layers, Clock, Wallet, CalendarDays, Coins, Lock, MapPin, Users, User, Compass, Banknote, FileText, ClipboardList, Scale, Building2, Target, Languages } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ORG_TYPE_FILTERS } from "@/lib/orgTypes";
import VerifiedOutcomesSection from "@/components/dashboard/VerifiedOutcomesSection";
import OrgDocumentsList from "@/components/dashboard/OrgDocumentsList";
import { ShareButton } from "@/components/dashboard/ShareButton";
import OrgLogo from "@/components/dashboard/OrgLogo";
import FitGauge, { fitBandLabel } from "@/components/dashboard/FitGauge";
import SimilarListings from "@/components/dashboard/SimilarListings";
import DiscoverNativesCard from "@/components/dashboard/DiscoverNativesCard";

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
  logo_url?: string | null;
  grant_range_min?: number | string | null; grant_range_max?: number | string | null; grant_currency?: string | null;
  investment_thesis?: string | null; stage_preference?: string[] | null; funding_instruments?: string[] | null;
  geographic_focus?: string[] | null; csr_focus_statement?: string | null; csr_budget_range?: string | null;
  inkind_support?: string[] | null;
  partnership_language?: string[] | null;
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
    <p className="text-[13px] font-black uppercase tracking-[0.1em] text-black dark:text-white mb-3.5">
      {children}
    </p>
  );
}

function BentoCell({ label, value, accent, capitalize, icon: Icon }: { label: string; value: string; accent?: boolean; capitalize?: boolean; icon?: LucideIcon }) {
  return (
    <div className="rounded-xl p-3.5 bg-card border border-[#2D6A4F]/20">
      <div className="flex items-center gap-1.5 mb-1">
        {Icon && <Icon className="w-3 h-3 shrink-0 text-[#2D6A4F]" />}
        <p className="text-[10px] font-black uppercase tracking-widest text-black dark:text-white">{label}</p>
      </div>
      <p data-accent={accent ? "true" : undefined} className={`text-sm font-bold leading-snug text-foreground${capitalize ? " capitalize" : ""}`}>{value}</p>
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
function LoadingIndicator() {
  return <span className="text-xs font-semibold text-black dark:text-white">Loading...</span>;
}

function OwnListingBanner() {
  return (
    <div className="flex items-center gap-2.5 px-4 py-3.5 rounded-xl bg-card border border-[#2D6A4F]/20">
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
        <div className="rounded-xl p-4 space-y-2 bg-card border border-[#2D6A4F]/20">
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
            className="w-full px-3 py-2.5 rounded-xl text-xs text-foreground resize-none focus:outline-none bg-card border border-[#2D6A4F]/20" />
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

function BackButton({ onBack, backLabel, onDark = false }: { onBack: () => void; backLabel: string; onDark?: boolean }) {
  return (
    <button type="button" onClick={onBack}
      className={`flex items-center gap-1.5 text-sm transition-colors ${onDark ? "text-white hover:text-[#F5B183]" : "text-black dark:text-white hover:text-[#C45C26]"}`}>
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
  // Sits on the dark header image, so everything here is white.
  const nameClass = variant === "page"
    ? "text-2xl font-bold text-white hover:text-[#F5B183] transition-colors tracking-tight"
    : "text-2xl font-black text-white hover:text-[#F5B183] transition-colors leading-tight tracking-tight";
  const chip = { background: "rgba(255,255,255,0.16)", color: "#FFFFFF", border: "1px solid rgba(255,255,255,0.45)" };
  const fitEdge = fit ? (fit.fit_score >= 70 ? "#4ADE80" : fit.fit_score >= 50 ? "#FBBF24" : "#F87171") : "#FFFFFF";
  return (
    <div className="flex items-center gap-2 flex-wrap mb-1">
      <Link href={`/dashboard/natives?tab=organisation&user=${org.user_id}`} className={nameClass}>
        {org.organisation_name}
      </Link>
      {isVerified && (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0" style={chip}>
          <ShieldCheck className="w-3 h-3" />Verified
        </span>
      )}
      {mouExecuted && (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0" style={chip}>
          <Award className="w-3 h-3" />MoU Executed
        </span>
      )}
      {fitLoading && (
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full shrink-0 bg-white/15 text-white border border-white/45">
          <Loader2 className="w-3 h-3 animate-spin" />Scoring fit...
        </span>
      )}
      {fitLocked && (
        <Link href="/dashboard/settings?tab=billing"
          className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full shrink-0 bg-white/15 text-white border border-white/45 hover:bg-white/25 transition-colors">
          <Sparkles className="w-3 h-3" />AI fit score {"\u2014"} upgrade
        </Link>
      )}
      {fit && !fitLoading && (
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full shrink-0"
          style={{ background: "rgba(255,255,255,0.16)", color: "#FFFFFF", border: `1px solid ${fitEdge}` }}>
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
  // Sits on the dark header image, so it is white.
  return (
    <button type="button" onClick={onToggleSave}
      className="shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-full transition-all border border-white/45 text-white hover:bg-white/15"
      style={isSaved ? { background: "rgba(255,255,255,0.22)", borderColor: "rgba(255,255,255,0.7)" } : undefined}>
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5"
        fill={isSaved ? "#FFFFFF" : "none"} stroke="currentColor" strokeWidth={2}>
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
      </svg>
      {isSaved ? "Saved" : "Save"}
    </button>
  );
}

// Shared by both variants -- confirmed byte-identical rendering. Each
// variant keeps its own choice of where to place it and what margin to
// give it, since the position in the tree genuinely differs.
function SectorTags({ sectors, onDark = false }: { sectors: string[]; onDark?: boolean }) {
  const chip = onDark
    ? "text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-white/15 text-white border border-white/40"
    : "text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-card text-foreground border border-[#2D6A4F]/20";
  return (
    <div className="flex flex-wrap gap-1.5">
      {sectors.map(s => (
        <span key={s} className={chip}>
          {s}
        </span>
      ))}
    </div>
  );
}

// Share link for one specific listing. The Partnerships page opens the listing with this id.
function listingShareUrl(org: OrgRow): string {
  return `${window.location.origin}/dashboard/partnerships?listing=${org.listing_id}`;
}

function listingShareMessage(org: OrgRow): string {
  const what = org.partnership_title?.trim() || `a partnership from ${org.organisation_name}`;
  return `Check out this partnership opportunity on Impact Natives: ${what}. Sign up to explore more opportunities like this one.`;
}

// Brand-green band behind the identity block. One definition so both variants match.
const IDENTITY_BAND = "linear-gradient(to bottom, rgba(45,106,79,0.06), transparent)";

// Header card background: the partnership image from /public, shown as it is. The dark colour behind it is a fallback
// for a missing file, so the white text stays readable either way. The sidebar card keeps IDENTITY_BAND.
const HEADER_STYLE = {
  backgroundColor: "#0F1F17",
  backgroundImage: "url(/partnership.webp)",
  backgroundSize: "cover",
  backgroundPosition: "center",
} as const;

// Shared by both variants. Each variant supplies its own outer wrapper (page: a
// bordered band card; panel: the full-width band strip with the mobile back button).
// The variant prop only sets the type/countries text size, as before.
function IdentityHeader({ org, variant, countries, sectors, isVerified, mouExecuted, fitLoading, fitLocked, fit, isSaved, onToggleSave, hideSectorsOnXl = false, showShare = true }: {
  org: OrgRow; variant: "page" | "panel"; countries: string[]; sectors: string[];
  isVerified: boolean; mouExecuted: boolean; fitLoading: boolean; fitLocked: boolean; fit: FitResult | null;
  isSaved: boolean; onToggleSave: (e: React.MouseEvent) => void; hideSectorsOnXl?: boolean; showShare?: boolean;
}) {
  return (
    <>
      <div className="flex items-start gap-4 sm:gap-5">
        <OrgLogo key={org.id} org={org} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <IdentityNameRow org={org} variant={variant} isVerified={isVerified} mouExecuted={mouExecuted} fitLoading={fitLoading} fitLocked={fitLocked} fit={fit} />
              <p className={`${variant === "page" ? "text-xs" : "text-sm"} text-white capitalize`}>
                {orgTypeAndCountriesLabel(org, countries)}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {showShare && org.listing_id && !org.partnership_formed && (
                <ShareButton label="Share" tone="dark" url={listingShareUrl(org)} message={listingShareMessage(org)} />
              )}
              <SaveButton isSaved={isSaved} onToggleSave={onToggleSave} />
            </div>
          </div>
          {sectors.length > 0 && (
            <div className={`mt-4${hideSectorsOnXl ? " xl:hidden" : ""}`}>
              <SectorTags sectors={sectors} onDark />
            </div>
          )}
        </div>
      </div>
    </>
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
              <span key={s} className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-card text-foreground border border-[#2D6A4F]/20">{s}</span>
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
function ContextGrid({ org, fields = ["theory", "attempts", "constraints"] }: { org: OrgRow; fields?: ("theory" | "attempts" | "constraints")[] }) {
  const present = [
    fields.includes("theory") && !!org.partnership_theory_of_change,
    fields.includes("attempts") && !!org.partnership_prior_attempts,
    fields.includes("constraints") && !!org.partnership_constraints,
  ].filter(Boolean).length;
  const cols = present >= 3 ? "sm:grid-cols-3" : present === 2 ? "sm:grid-cols-2" : "";
  return (
    <div className={`grid grid-cols-1 gap-3 ${cols}`}>
      {fields.includes("theory") && org.partnership_theory_of_change && (
        <div className="rounded-xl px-5 py-5 space-y-2 flex flex-col bg-card border border-[#2D6A4F]/20">
          <p className="text-[12px] font-black uppercase tracking-widest text-black dark:text-white">Approach to change</p>
          <p className="text-sm text-foreground leading-relaxed flex-1">{org.partnership_theory_of_change}</p>
        </div>
      )}
      {fields.includes("attempts") && org.partnership_prior_attempts && (
        <div className="rounded-xl px-5 py-5 space-y-2 flex flex-col bg-card border border-[#2D6A4F]/20">
          <p className="text-[12px] font-black uppercase tracking-widest text-black dark:text-white">Previous attempts</p>
          <p className="text-sm text-foreground leading-relaxed flex-1">{org.partnership_prior_attempts}</p>
        </div>
      )}
      {fields.includes("constraints") && org.partnership_constraints && (
        <div className="rounded-xl px-5 py-5 space-y-2 flex flex-col bg-card border border-[#2D6A4F]/20">
          <p className="text-[12px] font-black uppercase tracking-widest text-black dark:text-white">Constraints</p>
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
      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${org.partnership_prior_experience ? "bg-[#2D6A4F]" : "bg-card border border-[#2D6A4F]/30"}`}>
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
        <p className="text-[13px] font-black uppercase tracking-widest text-[#2D6A4F]">Success in 12 months</p>
      </div>
      <p className="text-base font-semibold text-foreground leading-relaxed">"{org.partnership_success_definition}"</p>
    </div>
  );
}

// Shared by both variants. SDGs are metadata, not a selling point, so they
// render as one small tag row with an inline label, no card and no section header.
function SdgTagRow({ org }: { org: OrgRow }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] font-black uppercase tracking-widest text-black dark:text-white mr-1">SDGs</span>
      {org.sdgs!.map(sdg => (
        <span key={sdg} className="text-[11px] font-semibold px-2 py-0.5 rounded-md text-foreground border border-[#2D6A4F]/40">
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
      <div className="h-1.5 rounded-full mb-4 overflow-hidden bg-[#2D6A4F]/15">
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
  return !!(org.partnership_stage || org.partnership_duration || org.partnership_budget || org.partnership_decision_timeline || org.partnership_funding_status || org.partnership_exclusivity || org.partnership_geo_specificity || org.partnership_team_capacity || org.partnership_contact_seniority || org.partnership_language?.length);
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
      {org.partnership_language && org.partnership_language.length > 0 && <BentoCell label="Languages" icon={Languages} value={org.partnership_language.join(" · ")} />}
    </div>
  );
}

// Wraps a content section: in "page" mode each section becomes its own card,
// matching InitiativeDetail's Sectors/Locations/Budget card treatment exactly
// (rounded-xl border bg-card, px-5 py-4).
function Section({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-[#2D6A4F]/20 bg-card px-5 py-4 ${className}`}>{children}</div>;
}

// "Also fits" footnote -- shown inside the existing fit-analysis box, not as
// a separate card, since it's the same fit story, just noting there's more
// of it. Clicking swaps the whole box to that listing's own analysis via a
// plain cache read (no AI call -- v10 caches every qualifying result).
function AlsoFitsFootnote({ items, onSelect }: { items: AlsoFit[]; onSelect: (item: AlsoFit) => void }) {
  if (items.length === 0) return null;
  return (
    <div className="pt-3 mt-1 border-t border-[#2D6A4F]/15 space-y-1.5">
      {items.map(af => (
        <button key={af.listing_id} type="button" onClick={() => onSelect(af)}
          className="block text-xs text-black dark:text-white hover:text-[#2D6A4F] transition-colors underline underline-offset-2 text-left">
          Also a fit: {af.listing_title} ({af.fit_score}%)
        </button>
      ))}
    </div>
  );
}

// Shared by both variants (and the page rail in the next step). The wrapper
// differs per variant; the content inside is identical, so it lives here once.
function FitAnalysisContent({ fit, fitLoading, fitLocked, alsoFits, onSelectAlsoFit, compact = false }: {
  fit: FitResult | null; fitLoading: boolean; fitLocked: boolean;
  alsoFits: AlsoFit[]; onSelectAlsoFit: (item: AlsoFit) => void; compact?: boolean;
}) {
  return (
    <>
      {!compact && (<>
      <div className="flex items-center gap-2 mb-1">
        <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 bg-[#2D6A4F]">
          <Sparkles className="w-3.5 h-3.5 text-white" />
        </div>
        <p className="text-xs font-black uppercase tracking-widest text-[#2D6A4F]">Your fit analysis</p>
        {fitLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#2D6A4F] ml-auto" />}
        {fit && !fitLoading && (
          <div className="ml-auto flex items-center gap-2">
            <div className="h-1.5 w-24 rounded-full overflow-hidden bg-[#2D6A4F]/15">
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

      </>)}

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

          <AlsoFitsFootnote items={alsoFits} onSelect={onSelectAlsoFit} />
        </div>
      )}
    </>
  );
}

// ─── Main panel ─────────────────────────────────────────────────────────────────

// ─── Profile tabs ─────────────────────────────────────────────────────────────
// Both variants render the same tabs and the same tab content, defined once here.
// Each field lives on exactly one tab. The page variant's rail (Express interest, fit,
// key focus areas, what they bring, looking for) sits outside the tabs and stays visible.

type ProfileTab = "overview" | "impact" | "partnerships" | "funding" | "documents";

const PROFILE_TAB_LABELS: Record<ProfileTab, string> = {
  overview: "Overview", impact: "Impact", partnerships: "Partnerships", funding: "Funding", documents: "Documents",
};

function hasPartnershipsTab(org: OrgRow): boolean {
  return hasWorkingExpectations(org)
    || !!(org.partnership_prior_attempts || org.partnership_constraints)
    || (org.partnership_prior_experience !== null && org.partnership_prior_experience !== undefined);
}

// Overview and Impact always show. Impact holds Verified outcomes, which load their own
// data, so this file cannot tell in advance whether that tab will be empty.
// Documents holds due diligence readiness, which does not apply to solo consultancies.
function visibleTabs(org: OrgRow): ProfileTab[] {
  const tabs: ProfileTab[] = ["overview", "impact"];
  if (hasPartnershipsTab(org)) tabs.push("partnerships");
  if (hasFundingTab(org)) tabs.push("funding");
  if (!isConsultancyOrg(org)) tabs.push("documents");
  return tabs;
}

function ProfileTabs({ tabs, active, onChange, variant }: {
  tabs: ProfileTab[]; active: ProfileTab; onChange: (t: ProfileTab) => void; variant: "page" | "panel";
}) {
  const wrap = variant === "panel"
    ? "sticky top-0 z-10 bg-background px-8 flex flex-wrap gap-x-6 border-b border-[#2D6A4F]/20"
    : "flex flex-wrap gap-x-6 border-b border-[#2D6A4F]/20";
  return (
    <div role="tablist" className={wrap}>
      {tabs.map(t => (
        <button key={t} type="button" role="tab" aria-selected={active === t} onClick={() => onChange(t)}
          className={`shrink-0 py-3 text-sm border-b-2 -mb-px transition-colors ${
            active === t
              ? "font-bold text-[#2D6A4F] border-[#2D6A4F]"
              : "font-medium text-black dark:text-white border-transparent hover:border-[#2D6A4F]/50"
          }`}>
          {PROFILE_TAB_LABELS[t]}
        </button>
      ))}
    </div>
  );
}

// One block of a tab. page: a card, or bare when inline. panel: a padded strip row.
function TabBlock({ variant, inline = false, className = "", children }: {
  variant: "page" | "panel"; inline?: boolean; className?: string; children: React.ReactNode;
}) {
  if (variant === "page") return inline ? <>{children}</> : <Section className={className}>{children}</Section>;
  return <div className={`px-8 ${inline ? "py-4" : "py-6"} ${className}`}>{children}</div>;
}

function SeekingAndSuccess({ org, variant }: { org: OrgRow; variant: "page" | "panel" }) {
  if (!org.partnership_sought && !org.partnership_success_definition) return null;
  const seeking = org.partnership_sought && (
    <>
      <Eyebrow>Seeking</Eyebrow>
      <p className="text-[15px] text-foreground leading-relaxed">{org.partnership_sought}</p>
    </>
  );
  const success = org.partnership_success_definition ? <SuccessOutcomeCard org={org} /> : null;
  if (variant === "page") {
    return (
      <div className="space-y-3">
        {seeking && <Section>{seeking}</Section>}
        {success}
      </div>
    );
  }
  return (
    <div className="px-8 py-6 space-y-4">
      {seeking && <div>{seeking}</div>}
      {success}
    </div>
  );
}

// Panel only. On the page variant these two live in the rail.
function PanelNeedsOffers({ org }: { org: OrgRow }) {
  if (!((org.needs && org.needs.length > 0) || (org.offers && org.offers.length > 0))) return null;
  return (
    <div className="px-8 py-6 space-y-5">
      {org.needs && org.needs.length > 0 && (
        <div>
          <Eyebrow>Looking for in a partner</Eyebrow>
          <div className="flex flex-wrap gap-2">
            {org.needs.map(n => (
              <span key={n} className="text-sm font-semibold px-4 py-2 rounded-lg text-foreground bg-card border border-[#2D6A4F]/20">{n}</span>
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
  );
}

// ─── Funding tab ──────────────────────────────────────────────────────────────
// Mandate fields that already exist on the organization record and feed the matching
// engine. Shown for funders and corporates only. Values are stored as readable labels.

const CORPORATE_TYPES = ["corporation"];

function isFunderOrg(org: OrgRow): boolean { return FUNDER_TYPES.includes(org.organisation_type); }
function isCorporateOrg(org: OrgRow): boolean { return CORPORATE_TYPES.includes(org.organisation_type); }

function listOf(v: string[] | null | undefined): string[] {
  return Array.isArray(v) ? v.filter(x => typeof x === "string" && x.trim() !== "") : [];
}

// One figure when min and max match (both stored rows so far do), a range otherwise.
// Shown in the stored currency. There is no currency conversion anywhere in the codebase.
function formatGrantRange(org: OrgRow): string | null {
  const toNum = (v: number | string | null | undefined) => (v === null || v === undefined || v === "" ? null : Number(v));
  const min = toNum(org.grant_range_min);
  const max = toNum(org.grant_range_max);
  const ok = (n: number | null): n is number => n !== null && Number.isFinite(n) && n > 0;
  const cur = org.grant_currency?.trim() ?? "";
  const f = (n: number) => `${cur ? cur + " " : ""}${n.toLocaleString("en-US")}`;
  if (ok(min) && ok(max)) return min === max ? f(min) : `${f(min)} to ${f(max)}`;
  if (ok(max)) return `Up to ${f(max)}`;
  if (ok(min)) return `From ${f(min)}`;
  return null;
}

function hasFundingTab(org: OrgRow): boolean {
  if (isFunderOrg(org)) {
    return !!(formatGrantRange(org) || org.investment_thesis?.trim() || listOf(org.stage_preference).length
      || listOf(org.funding_instruments).length || listOf(org.geographic_focus).length);
  }
  if (isCorporateOrg(org)) {
    return !!(org.csr_focus_statement?.trim() || org.csr_budget_range?.trim() || listOf(org.inkind_support).length
      || listOf(org.geographic_focus).length);
  }
  return false;
}

function FundingTabContent({ org, variant }: { org: OrgRow; variant: "page" | "panel" }) {
  const funder = isFunderOrg(org);
  const statement = (funder ? org.investment_thesis : org.csr_focus_statement)?.trim();
  const grant = funder ? formatGrantRange(org) : null;
  const instruments = funder ? listOf(org.funding_instruments) : [];
  const stages = funder ? listOf(org.stage_preference) : [];
  const where = listOf(org.geographic_focus);
  const csrBudget = !funder ? org.csr_budget_range?.trim() : "";
  const inkind = !funder ? listOf(org.inkind_support) : [];
  const hasFacts = !!(grant || instruments.length || stages.length || where.length || csrBudget);
  return (
    <div className={variant === "page" ? "space-y-6" : ""}>
      {statement && (
        <TabBlock variant={variant}>
          <Eyebrow>{funder ? "Investment thesis" : "CSR focus"}</Eyebrow>
          <p className="text-[15px] text-foreground leading-relaxed">{statement}</p>
        </TabBlock>
      )}
      {hasFacts && (
        <TabBlock variant={variant}>
          <Eyebrow>Funding mandate</Eyebrow>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {grant && <BentoCell label="Grant size" icon={Banknote} value={grant} accent />}
            {csrBudget && <BentoCell label="CSR budget" icon={Wallet} value={csrBudget} accent />}
            {instruments.length > 0 && <BentoCell label="Instruments" icon={Coins} value={instruments.join(" \u00b7 ")} />}
            {stages.length > 0 && <BentoCell label="Stage preference" icon={Layers} value={stages.join(" \u00b7 ")} />}
            {where.length > 0 && <BentoCell label="Where they fund" icon={MapPin} value={where.join(", ")} />}
          </div>
        </TabBlock>
      )}
      {inkind.length > 0 && (
        <TabBlock variant={variant}>
          <Eyebrow>In-kind support</Eyebrow>
          <SectorTags sectors={inkind} />
        </TabBlock>
      )}
    </div>
  );
}

function ProfileTabPanels({ org, variant, tab, viewerOrgId, dd, overviewAfterSuccess, overviewAfterSignals }: {
  org: OrgRow; variant: "page" | "panel"; tab: ProfileTab; viewerOrgId?: string;
  dd: { score: number; total: number; docs: { key: keyof OrgRow; label: string }[] };
  overviewAfterSuccess?: React.ReactNode; overviewAfterSignals?: React.ReactNode;
}) {
  const body = variant === "page" ? "space-y-6" : "";

  if (tab === "impact") {
    return (
      <div className={body}>
        {org.partnership_theory_of_change && (
          <TabBlock variant={variant}><ContextGrid org={org} fields={["theory"]} /></TabBlock>
        )}
        <VerifiedOutcomesSection orgId={org.id} variant={variant} isOwnOrg={viewerOrgId === org.id} hideToggle />
      </div>
    );
  }

  if (tab === "partnerships") {
    return (
      <div className={body}>
        {hasWorkingExpectations(org) && (
          <TabBlock variant={variant}>
            <Eyebrow>Working expectations</Eyebrow>
            <WorkingExpectationsList org={org} />
          </TabBlock>
        )}
        {(org.partnership_prior_attempts || org.partnership_constraints) && (
          <TabBlock variant={variant}><ContextGrid org={org} fields={["attempts", "constraints"]} /></TabBlock>
        )}
        {org.partnership_prior_experience !== null && org.partnership_prior_experience !== undefined && (
          <TabBlock variant={variant}>
            <Eyebrow>Track record</Eyebrow>
            <TrackRecordContent org={org} />
          </TabBlock>
        )}
      </div>
    );
  }

  if (tab === "funding") return <FundingTabContent org={org} variant={variant} />;

  if (tab === "documents") {
    return (
      <div className={body}>
        <TabBlock variant={variant}>
          <DueDiligenceReadiness org={org} score={dd.score} ddTotal={dd.total} ddDocs={dd.docs} />
        </TabBlock>
        <TabBlock variant={variant}>
          <Eyebrow>Supporting documents</Eyebrow>
          <OrgDocumentsList orgId={org.id} isOwnOrg={viewerOrgId === org.id} labels={dd.docs} />
        </TabBlock>
      </div>
    );
  }

  return (
    <div className={body}>
      {(org.partnership_title?.trim() || org.description) && (
        <TabBlock variant={variant}>
          {org.partnership_title?.trim() && (
            <p className={`text-lg font-bold text-foreground leading-snug ${org.description ? "mb-3" : ""}`}>{org.partnership_title.trim()}</p>
          )}
          {org.description && <p className="text-[15px] text-foreground leading-relaxed">{org.description}</p>}
        </TabBlock>
      )}
      <SeekingAndSuccess org={org} variant={variant} />
      {overviewAfterSuccess}
      {hasPartnershipSignals(org) && (
        <TabBlock variant={variant}>
          <Eyebrow>Partnership signals</Eyebrow>
          <PartnershipSignalsGrid org={org} />
        </TabBlock>
      )}
      {overviewAfterSignals}
      {isConsultancyOrg(org) && !!(org.specializations?.length || org.notable_engagements?.length || org.affiliations?.length) && (
        <TabBlock variant={variant}><ConsultantExpertiseContent org={org} /></TabBlock>
      )}
      {org.sdgs && org.sdgs.length > 0 && (
        <TabBlock variant={variant} inline><SdgTagRow org={org} /></TabBlock>
      )}
      {org.website && org.website !== "https://" && (
        <TabBlock variant={variant} inline><WebsiteLink org={org} /></TabBlock>
      )}
    </div>
  );
}

// ─── Decision rail ────────────────────────────────────────────────────────────
// The right-hand sidebar. One light green card holds the fit chart, Express interest and
// Share listing. Below it, separate cards: Key focus areas, What they bring, Looking for,
// Similar listings, and the Natives discovery card. The full-page variant always uses it
// (stacked below the content on narrow screens). The Partnerships panel uses it from
// RAIL_MIN_WIDTH up and keeps its in-flow layout below that.

const RAIL_MIN_WIDTH = 1440;

function useMinWidth(px: number): boolean {
  const query = `(min-width: ${px}px)`;
  const supported = typeof window !== "undefined" && typeof window.matchMedia === "function";
  const [matches, setMatches] = useState<boolean>(() => supported && window.matchMedia(query).matches);
  useEffect(() => {
    if (!supported) return;
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query, supported]);
  return matches;
}

// One row per item, each with the section's icon. No chips, borders or fills.
function RailList({ title, icon: Icon, items }: { title: string; icon: LucideIcon; items: string[] }) {
  return (
    <div>
      <Eyebrow>{title}</Eyebrow>
      <ul className="space-y-2.5">
        {items.map(item => (
          <li key={item} className="flex items-start gap-2.5 text-sm text-foreground leading-snug">
            <Icon className="w-4 h-4 mt-0.5 shrink-0 text-[#2D6A4F]" aria-hidden="true" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function OrgDecisionRail({ org, sectors, countries, viewerOrg, viewerOrgLoading, isOrg, alreadySent, sending, onExpressInterest,
  openingMsg, setOpeningMsg, msgEditing, setMsgEditing, fit, fitLoading, fitLocked, fitNoListing, alsoFits, onSelectAlsoFit, onOpenListing }: {
  org: OrgRow; sectors: string[]; countries: string[]; viewerOrg: OrgRow | null; viewerOrgLoading: boolean; isOrg: boolean;
  alreadySent: boolean; sending: boolean; onExpressInterest: (e: React.MouseEvent) => void;
  openingMsg: string | null; setOpeningMsg: (v: string) => void; msgEditing: boolean; setMsgEditing: (v: boolean) => void;
  fit: FitResult | null; fitLoading: boolean; fitLocked: boolean; fitNoListing: boolean;
  alsoFits: AlsoFit[]; onSelectAlsoFit: (item: AlsoFit) => void; onOpenListing?: (listingId: string) => void;
}) {
  const [analysisOpen, setAnalysisOpen] = useState(false);
  useEffect(() => { setAnalysisOpen(false); }, [org.id]);

  const own = org.user_id === viewerOrg?.user_id;
  const closed = !!org.partnership_formed;
  const canShare = !!org.listing_id && !closed;
  const showFit = !own && (!!fit || fitLoading || fitLocked || fitNoListing);
  const offers = org.offers ?? [];
  const needs = org.needs ?? [];

  return (
    <>
      {/* The whole sidebar is one card, the same look as the listing header card. */}
      <div className="rounded-xl border border-[#2D6A4F]/20 px-5 py-5 space-y-6" style={{ background: IDENTITY_BAND }}>
        {/* Partnership fit, Express interest and Share listing share one border. */}
        <div className="rounded-xl border border-[#2D6A4F]/30 bg-[#2D6A4F]/[0.07] px-5 py-5 space-y-5">
          {viewerOrgLoading ? (
            <LoadingIndicator />
          ) : own ? (
            <OwnListingBanner />
          ) : (
            <>
              {showFit && (
                <div>
                  <Eyebrow>Partnership fit</Eyebrow>
                  {fitLoading && (
                    <div className="flex items-center gap-2 text-xs text-black dark:text-white">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#2D6A4F]" />Scoring fit...
                    </div>
                  )}
                  {fit && !fitLoading && (
                    <div className="flex items-center gap-4">
                      <FitGauge score={fit.fit_score} />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-foreground">{fitBandLabel(fit.fit_score)}</p>
                        {fit.listing_title && (
                          <p className="text-[11px] text-black dark:text-white mt-0.5">Based on your "{fit.listing_title}" listing</p>
                        )}
                        <button type="button" onClick={() => setAnalysisOpen(v => !v)} aria-expanded={analysisOpen}
                          className="mt-2 text-xs font-semibold text-[#2D6A4F] hover:underline underline-offset-2">
                          {analysisOpen ? "Hide analysis" : "View analysis"}
                        </button>
                      </div>
                    </div>
                  )}
                  {fit && !fitLoading && analysisOpen && (
                    <div className="mt-4">
                      <FitAnalysisContent compact fit={fit} fitLoading={fitLoading} fitLocked={fitLocked} alsoFits={alsoFits} onSelectAlsoFit={onSelectAlsoFit} />
                    </div>
                  )}
                  {fitLocked && !fit && !fitLoading && (
                    <p className="text-xs text-black dark:text-white leading-relaxed">
                      AI fit scoring is a Plus feature.{" "}
                      <Link href="/dashboard/settings?tab=billing" className="text-[#2D6A4F] font-medium hover:underline">Upgrade to unlock</Link>.
                    </p>
                  )}
                  {fitNoListing && !fit && !fitLoading && (
                    <p className="text-sm text-foreground leading-relaxed">Publish a partnership listing to see how well you fit with this organisation.</p>
                  )}
                </div>
              )}
              {closed ? (
                <PartnershipFormedBanner />
              ) : isOrg ? (
                <div className="space-y-3">
                  <ExpressInterestPanel alreadySent={alreadySent} openingMsg={openingMsg} setOpeningMsg={setOpeningMsg}
                    msgEditing={msgEditing} setMsgEditing={setMsgEditing} sending={sending} onExpressInterest={onExpressInterest} />
                </div>
              ) : null}
            </>
          )}
          {canShare && (
            <ShareButton label="Share listing" fullWidth url={listingShareUrl(org)} message={listingShareMessage(org)} />
          )}
        </div>

        {sectors.length > 0 && <RailList title="Key focus areas" icon={Target} items={sectors} />}
        {offers.length > 0 && <RailList title="What they bring" icon={CheckCircle2} items={offers} />}
        {needs.length > 0 && <RailList title="Looking for" icon={Compass} items={needs} />}

        {/* Similar listings draws the one divider in the sidebar, above itself, and renders nothing when there are none. */}
        <SimilarListings listingId={org.listing_id} orgUserId={org.user_id} sectors={sectors} countries={countries} onOpen={onOpenListing} />
      </div>

      <DiscoverNativesCard />
    </>
  );
}

export function OrgDetailPanel({ org, isSaved, onToggleSave, isOrg, alreadySent, sending, onExpressInterest, onBack, backLabel, viewerOrg, viewerOrgLoading, variant = "panel", mouExecuted = false, onOpenListing }: {
  org: OrgRow | null; isSaved: boolean; onToggleSave: (e: React.MouseEvent) => void;
  isOrg: boolean; alreadySent: boolean; sending: boolean;
  onExpressInterest: (e: React.MouseEvent) => void; onBack: () => void;
  backLabel?: string;
  viewerOrg: OrgRow | null;
  viewerOrgLoading: boolean;
  variant?: "panel" | "page";
  mouExecuted?: boolean;
  onOpenListing?: (listingId: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<FitResult | null>(null);
  const [fitLoading, setFitLoading] = useState(false);
  const [fitLocked, setFitLocked] = useState(false);
  const [fitNoListing, setFitNoListing] = useState(false);
  const [alsoFits, setAlsoFits] = useState<AlsoFit[]>([]);
  const [openingMsg, setOpeningMsg] = useState<string | null>(null);
  const [msgEditing, setMsgEditing] = useState(false);
  const [tab, setTab] = useState<ProfileTab>("overview");
  const wide = useMinWidth(RAIL_MIN_WIDTH);

  useEffect(() => {
    if (org && ref.current) ref.current.scrollTop = 0;
    setFit(null);
    setFitLocked(false);
    setFitNoListing(false);
    setAlsoFits([]);
    setOpeningMsg(null);
    setMsgEditing(false);
    setTab("overview");
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
      if (data?.reason === "no_published_listing") { setFitNoListing(true); return; } // viewer has no published listing to compare with
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
      <div className="hidden lg:flex flex-col items-center justify-center h-full gap-4 text-center px-10 bg-[#2D6A4F]/[0.04]">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-card border border-[#2D6A4F]/20">
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
  const tabs = visibleTabs(org);
  const activeTab: ProfileTab = tabs.includes(tab) ? tab : "overview";
  const railProps = {
    org, sectors, countries, viewerOrg, viewerOrgLoading, isOrg, alreadySent, sending, onExpressInterest,
    openingMsg, setOpeningMsg, msgEditing, setMsgEditing, fit, fitLoading, fitLocked, fitNoListing, alsoFits,
    onSelectAlsoFit: swapToAlsoFit, onOpenListing,
  };

  // ── Page variant: flat content matching InitiativeDetail exactly ──
  if (variant === "page") {
    return (
      <div className="space-y-6">
        {backLabel && <BackButton onBack={onBack} backLabel={backLabel} />}

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
          <div className="space-y-6 min-w-0">
            {/* Identity -- brand-green band card, shared IdentityHeader */}
            <div className="rounded-xl border border-[#2D6A4F]/20 px-8 py-6 min-h-[150px] flex flex-col justify-center" style={HEADER_STYLE}>
              <IdentityHeader org={org} variant="page" countries={countries} sectors={sectors} showShare={false} isVerified={isVerified} mouExecuted={mouExecuted}
                fitLoading={fitLoading} fitLocked={fitLocked} fit={fit} isSaved={isSaved} onToggleSave={onToggleSave} />
            </div>

            <ProfileTabs tabs={tabs} active={activeTab} onChange={setTab} variant="page" />
            <ProfileTabPanels org={org} variant="page" tab={activeTab} viewerOrgId={viewerOrg?.id}
              dd={{ score, total: ddTotal, docs: ddDocs }} />
          </div>
          <aside className="space-y-4 min-w-0">
            <OrgDecisionRail {...railProps} />
          </aside>
        </div>
      </div>
    );
  }

  // ── Panel variant: the Partnerships split pane ──
  const panelHeader = (
    <IdentityHeader org={org} variant="panel" countries={countries} sectors={sectors} isVerified={isVerified} mouExecuted={mouExecuted}
      fitLoading={fitLoading} fitLocked={fitLocked} fit={fit} isSaved={isSaved} onToggleSave={onToggleSave} showShare={!wide} />
  );

  // Wide: the header card sits in the main column and the sidebar runs from the very top beside it.
  if (wide) {
    return (
      <div ref={ref} className="h-full overflow-y-auto bg-background">
        <div className="grid grid-cols-[minmax(0,1fr)_340px] gap-6 pr-6 py-6 items-start">
          <div className="min-w-0">
            <div className="ml-8 mb-6 rounded-xl border border-[#2D6A4F]/20 px-8 py-6 min-h-[150px] flex flex-col justify-center" style={HEADER_STYLE}>
              {panelHeader}
            </div>
            <ProfileTabs tabs={tabs} active={activeTab} onChange={setTab} variant="panel" />
            <ProfileTabPanels org={org} variant="panel" tab={activeTab} viewerOrgId={viewerOrg?.id}
              dd={{ score, total: ddTotal, docs: ddDocs }} />
          </div>
          <aside className="min-w-0">
            <OrgDecisionRail {...railProps} />
          </aside>
        </div>
      </div>
    );
  }

  return (
    <div ref={ref} className="flex flex-col h-full overflow-y-auto bg-background">
      <div className="shrink-0 px-8 pt-6 pb-6 min-h-[130px] flex flex-col justify-center" style={HEADER_STYLE}>
        {backLabel && (
          <div className="flex justify-between mb-4 lg:hidden">
            <BackButton onBack={onBack} backLabel={backLabel} onDark />
          </div>
        )}
        {panelHeader}
      </div>

      <div className="flex-1">
        <ProfileTabs tabs={tabs} active={activeTab} onChange={setTab} variant="panel" />
        <ProfileTabPanels org={org} variant="panel" tab={activeTab} viewerOrgId={viewerOrg?.id}
          dd={{ score, total: ddTotal, docs: ddDocs }}
          overviewAfterSuccess={(fit || fitLoading) && org.user_id !== viewerOrg?.user_id ? (
            <div className="px-8 py-6"
              style={{ background: "linear-gradient(135deg, rgba(13,43,26,0.04) 0%, rgba(26,74,46,0.02) 100%)" }}>
              <FitAnalysisContent fit={fit} fitLoading={fitLoading} fitLocked={fitLocked} alsoFits={alsoFits} onSelectAlsoFit={swapToAlsoFit} />
            </div>
          ) : null}
          overviewAfterSignals={<PanelNeedsOffers org={org} />} />

        {viewerOrgLoading ? (
          <div className="px-8 py-4">
            <LoadingIndicator />
          </div>
        ) : org.user_id === viewerOrg?.user_id ? (
          <div className="px-8 py-6 sticky bottom-0 bg-background">
            <OwnListingBanner />
          </div>
        ) : org.partnership_formed ? (
          <div className="px-8 py-6 sticky bottom-0 bg-background">
            <PartnershipFormedBanner />
          </div>
        ) : isOrg && (
          <div className="px-8 py-6 sticky bottom-0 bg-background space-y-3">
            <ExpressInterestPanel alreadySent={alreadySent} openingMsg={openingMsg} setOpeningMsg={setOpeningMsg}
              msgEditing={msgEditing} setMsgEditing={setMsgEditing} sending={sending} onExpressInterest={onExpressInterest} />
          </div>
        )}
      </div>
    </div>
  );
}
