// ─── DashboardPartnerships.tsx ───────────────────────────────────────────────
import { useEffect, useState, useRef } from "react";
import { ORG_TYPE_FILTERS } from "@/lib/orgTypes";
import { supabase } from "@/lib/supabase";
import { Handshake, Loader2, Search, CheckCircle2, ShieldCheck, X, SlidersHorizontal, ArrowUpRight } from "lucide-react";
import { SECTOR_OPTIONS } from "@/lib/sectors";
import { FindPartnerModalDashboard } from "./FindPartnerModalDashboard";
import { useAuth } from "@/context/AuthContext";

function orgTypeLabel(value: string | null | undefined): string {
  if (!value) return "";
  return ORG_TYPE_FILTERS.find(o => o.value === value)?.label ?? value.replace(/_/g, " ");
}

interface OrgRow {
  id: string; organisation_name: string; description: string;
  sector: string | string[]; country: string | string[];
  organisation_type: string; website?: string; email?: string;
  needs?: string[]; offers?: string[]; sdgs?: string[];
  partnership_sought?: string; verification_status: string;
  status: string; user_id: string; partnership_listed: boolean;
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

function ddScore(org: OrgRow): number {
  return [org.partnership_dd_financial_model, org.partnership_dd_audited_accounts,
    org.partnership_dd_safeguarding_policy, org.partnership_dd_data_policy,
    org.partnership_dd_governance_doc].filter(Boolean).length;
}

// ─── Eyebrow label ────────────────────────────────────────────────────────────
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#374151] mb-3">
      {children}
    </p>
  );
}

// ─── Bento cell ──────────────────────────────────────────────────────────────
function BentoCell({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl p-3.5" style={{ background: "#F9FAFB", border: "1px solid #E5E7EB" }}>
      <p className="text-[9px] font-black uppercase tracking-widest text-[#374151] mb-1">{label}</p>
      <p className={`text-sm font-bold leading-snug ${accent ? "text-[#2D6A4F]" : "text-[#111827]"}`}>{value}</p>
    </div>
  );
}

// ─── Compact list card ────────────────────────────────────────────────────────
function ListCard({ org, selected, onClick, isSaved, onToggleSave }: {
  org: OrgRow; selected: boolean; onClick: () => void;
  isSaved: boolean; onToggleSave: (e: React.MouseEvent) => void;
}) {
  const isVerified = org.verification_status === "verified";
  const countries = normalizeArr(org.country);
  const score = ddScore(org);

  return (
    <div onClick={onClick}
      className={`relative cursor-pointer px-5 py-4 border-b transition-all group ${
        selected
          ? "bg-[#F0F9F4] border-l-[3px] border-l-[#2D6A4F] border-b-[#E5E7EB]"
          : "hover:bg-[#FAFAFA] border-l-[3px] border-l-transparent border-b-[#F3F4F6]"
      }`}>

      {/* Org name + save */}
      <div className="flex items-center justify-between gap-2 mb-0.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`text-sm font-bold truncate ${selected ? "text-[#2D6A4F]" : "text-[#111827]"}`}>
            {org.organisation_name}
          </span>
          {isVerified && <ShieldCheck className="w-3 h-3 shrink-0 text-[#2D6A4F]" />}
        </div>
        <button type="button" onClick={e => { e.stopPropagation(); onToggleSave(e); }}
          className="shrink-0 p-1 rounded transition-opacity opacity-0 group-hover:opacity-100">
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5"
            fill={isSaved ? "#2D6A4F" : "none"} stroke={isSaved ? "#2D6A4F" : "#9CA3AF"} strokeWidth={2}>
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
          </svg>
        </button>
      </div>

      {/* Location */}
      <p className="text-[11px] text-[#374151] capitalize mb-3">
        {countries.length > 0 ? countries.join(", ") : orgTypeLabel(org.organisation_type)}
      </p>

      {/* Partnership title -- full, no clamp */}
      {org.partnership_title && (
        <p className="text-xs font-semibold text-[#374151] leading-snug">
          {org.partnership_title}
        </p>
      )}
    </div>
  );}

// ─── Detail panel ─────────────────────────────────────────────────────────────
type FitResult = {
  fit_score: number;
  reasons: string[];
  gaps: string[];
  rationale: string;
  opening_message: string;
};

function DetailPanel({ org, isSaved, onToggleSave, isOrg, alreadySent, sending, onExpressInterest, onClose, viewerOrg }: {
  org: OrgRow | null; isSaved: boolean; onToggleSave: (e: React.MouseEvent) => void;
  isOrg: boolean; alreadySent: boolean; sending: boolean;
  onExpressInterest: (e: React.MouseEvent) => void; onClose: () => void;
  viewerOrg: OrgRow | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<FitResult | null>(null);
  const [fitLoading, setFitLoading] = useState(false);
  const [openingMsg, setOpeningMsg] = useState<string | null>(null);
  const [msgEditing, setMsgEditing] = useState(false);

  useEffect(() => {
    if (org && ref.current) ref.current.scrollTop = 0;
    setFit(null);
    setOpeningMsg(null);
    setMsgEditing(false);
    if (org && viewerOrg && org.user_id !== viewerOrg.user_id) {
      scoreFit(org, viewerOrg);
    }
  }, [org?.id, viewerOrg?.id]);

  async function scoreFit(listing: OrgRow, viewer: OrgRow) {
    setFitLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("score-partnership-fit", {
        body: { viewer_org: viewer, listing_org: listing },
      });
      if (!error && data?.result) {
        setFit(data.result);
        setOpeningMsg(data.result.opening_message ?? null);
      }
    } catch (e) {
      console.error("Fit score error:", e);
    } finally {
      setFitLoading(false);
    }
  }
  if (!org) {
    return (
      <div className="hidden lg:flex flex-col items-center justify-center h-full gap-4 text-center px-10"
        style={{ background: "#FAFAFA" }}>
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "#F3F4F6", border: "1px solid #E5E7EB" }}>
          <Handshake className="w-6 h-6 text-[#374151]" />
        </div>
        <div>
          <p className="text-sm font-bold text-[#111827] mb-1">Select a listing</p>
          <p className="text-xs text-[#374151] max-w-xs leading-relaxed">Click any organisation from the list to view their full partnership profile.</p>
        </div>
      </div>
    );
  }

  const isVerified = org.verification_status === "verified";
  const sectors = normalizeArr(org.sector);
  const countries = normalizeArr(org.country);
  const score = ddScore(org);
  const fundingStatus = org.partnership_funding_status ?? "";

  const ddDocs = [
    { key: "partnership_dd_financial_model",     label: "Financial model" },
    { key: "partnership_dd_audited_accounts",    label: "Audited accounts" },
    { key: "partnership_dd_safeguarding_policy", label: "Safeguarding policy" },
    { key: "partnership_dd_data_policy",         label: "Data policy" },
    { key: "partnership_dd_governance_doc",      label: "Governance doc" },
  ];

  return (
    <div ref={ref} className="flex flex-col h-full overflow-y-auto" style={{ background: "#FFFFFF" }}>

      {/* ── Identity block ── */}
      <div className="shrink-0 px-8 pt-7 pb-6" style={{ borderBottom: "1px solid #F3F4F6" }}>
        {/* Mobile close */}
        <div className="lg:hidden flex justify-end mb-4">
          <button type="button" onClick={onClose}
            className="p-1.5 rounded-lg text-[#374151] hover:bg-[#F3F4F6] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <a href={`/dashboard/natives?user=${org.user_id}`}
                className="text-2xl font-black text-[#111827] hover:text-[#2D6A4F] transition-colors leading-tight">
                {org.organisation_name}
              </a>
              {isVerified && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                style={{ background: "#ECFDF5", color: "#065F46", border: "1px solid #A7F3D0" }}>
                <ShieldCheck className="w-3 h-3" />Verified
              </span>
            )}
            {fitLoading && (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full shrink-0"
                style={{ background: "#F3F4F6", color: "#6B7280", border: "1px solid #E5E7EB" }}>
                <Loader2 className="w-3 h-3 animate-spin" />Scoring fit...
              </span>
            )}
            {fit && !fitLoading && (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full shrink-0"
                style={{
                  background: fit.fit_score >= 70 ? "#ECFDF5" : fit.fit_score >= 50 ? "#FFF7ED" : "#FEF2F2",
                  color: fit.fit_score >= 70 ? "#065F46" : fit.fit_score >= 50 ? "#92400E" : "#991B1B",
                  border: `1px solid ${fit.fit_score >= 70 ? "#A7F3D0" : fit.fit_score >= 50 ? "#FDE68A" : "#FECACA"}`,
                }}>
                {fit.fit_score}% fit
              </span>
            )}
          </div>
          <p className="text-sm text-[#374151] capitalize">
              {orgTypeLabel(org.organisation_type)}
              {countries.length > 0 && ` · ${countries.join(", ")}`}
            </p>
          </div>
          <button type="button" onClick={onToggleSave}
            className="shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-full transition-all"
            style={{ border: "1px solid #E5E7EB", color: isSaved ? "#065F46" : "#6B7280", background: isSaved ? "#ECFDF5" : "transparent" }}>
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5"
              fill={isSaved ? "#065F46" : "none"} stroke="currentColor" strokeWidth={2}>
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
            </svg>
            {isSaved ? "Saved" : "Save"}
          </button>
        </div>

        {/* Sectors */}
        {sectors.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {sectors.map(s => (
              <span key={s} className="text-[11px] font-semibold px-2.5 py-1 rounded-lg"
                style={{ background: "#F3F4F6", color: "#374151", border: "1px solid #E5E7EB" }}>
                {s}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 divide-y" style={{ borderColor: "#F3F4F6" }}>

        {/* About -- directly under header */}
        {org.description && (
          <div className="px-8 py-5" style={{ borderBottom: "1px solid #F3F4F6" }}>
            <p className="text-sm text-[#374151] leading-relaxed">{org.description}</p>
          </div>
        )}

        {/* Seeking + success */}
        {(org.partnership_sought || org.partnership_success_definition) && (
          <div className="px-8 py-6 space-y-4">
            {org.partnership_sought && (
              <div>
                <Eyebrow>Seeking</Eyebrow>
                <p className="text-sm text-[#374151] leading-relaxed">{org.partnership_sought}</p>
              </div>
            )}
            {org.partnership_success_definition && (
              <div className="rounded-xl px-5 py-4" style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderLeft: "3px solid #2D6A4F" }}>
                <p className="text-[10px] font-black uppercase tracking-widest text-[#6B7280] mb-2">Success in 12 months</p>
                <p className="text-sm text-[#374151] leading-relaxed italic">"{org.partnership_success_definition}"</p>
              </div>
            )}

            {/* AI fit rationale */}
            {fit && !fitLoading && (
              <div className="space-y-3 pt-2">
                <p className="text-sm text-[#374151] leading-relaxed">{fit.rationale}</p>
                {fit.reasons.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    {fit.reasons.map((r, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="mt-1 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "#2D6A4F" }} />
                        <span className="text-xs text-[#374151]">{r}</span>
                      </div>
                    ))}
                  </div>
                )}
                {/* Gap alert */}
                {fit.gaps.length > 0 && (
                  <div className="rounded-xl px-4 py-3 space-y-1.5"
                    style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderLeft: "3px solid #F59E0B" }}>
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#92400E]">Gaps to address</p>
                    {fit.gaps.map((g, i) => (
                      <p key={i} className="text-xs text-[#92400E] leading-relaxed">{g}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Bento signal grid */}
        {(org.partnership_stage || org.partnership_duration || org.partnership_budget || org.partnership_decision_timeline || org.partnership_funding_status || org.partnership_exclusivity) && (
          <div className="px-8 py-6">
            <Eyebrow>Partnership signals</Eyebrow>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {org.partnership_stage && <BentoCell label="Stage" value={STAGE_LABELS[org.partnership_stage] ?? org.partnership_stage} accent />}
              {org.partnership_duration && <BentoCell label="Duration" value={DURATION_LABELS[org.partnership_duration] ?? org.partnership_duration} />}
              {org.partnership_budget && <BentoCell label="Budget" value={BUDGET_LABELS[org.partnership_budget] ?? org.partnership_budget} />}
              {org.partnership_decision_timeline && <BentoCell label="Timeline" value={TIMELINE_LABELS[org.partnership_decision_timeline] ?? org.partnership_decision_timeline} />}
              {org.partnership_funding_status && <BentoCell label="Funding status" value={FUNDING_STATUS_LABELS[org.partnership_funding_status] ?? org.partnership_funding_status} />}
              {org.partnership_exclusivity && <BentoCell label="Exclusivity" value={org.partnership_exclusivity === "one_dedicated_partner" ? "One partner only" : "Open to multiple"} />}
              {org.partnership_geo_specificity && <BentoCell label="Location focus" value={org.partnership_geo_specificity} />}
              {org.partnership_team_capacity && <BentoCell label="Team capacity" value={org.partnership_team_capacity.replace(/_/g, " ").replace(/(\d) (\d)/g, "$1–$2")} />}
              {org.partnership_contact_seniority && <BentoCell label="Lead contact" value={org.partnership_contact_seniority.replace(/_/g, " ")} />}
            </div>
          </div>
        )}

        

        {/* Working style */}
        {(org.partnership_working_style || org.partnership_financial_transfer || (org.partnership_legal_type && org.partnership_legal_type.length > 0) || (org.partnership_reporting && org.partnership_reporting.length > 0) || org.partnership_ip_ownership) && (
          <div className="px-8 py-6">
            <Eyebrow>Working expectations</Eyebrow>
            <div className="space-y-3">
              {[
                org.partnership_working_style     && { label: "Working style",       value: WORKING_STYLE_LABELS[org.partnership_working_style] ?? org.partnership_working_style },
                org.partnership_financial_transfer && { label: "Financial arrangement", value: FINANCIAL_TRANSFER_LABELS[org.partnership_financial_transfer] ?? org.partnership_financial_transfer },
                org.partnership_legal_type?.length && { label: "Partnership type",   value: org.partnership_legal_type!.map(t => LEGAL_TYPE_LABELS[t] ?? t).join(", ") },
                org.partnership_reporting?.length  && { label: "Reporting",          value: org.partnership_reporting!.map(r => r.replace(/_/g, " ")).join(", ") },
                org.partnership_ip_ownership      && { label: "IP ownership",        value: org.partnership_ip_ownership.replace(/_/g, " ") },
                org.partnership_physically_present !== null && org.partnership_physically_present !== undefined && { label: "Physical presence", value: org.partnership_physically_present ? "On the ground" : "Remote" },
              ].filter(Boolean).map((row: any) => (
                <div key={row.label} className="flex items-start justify-between gap-6 py-2.5"
                  style={{ borderBottom: "1px solid #F3F4F6" }}>
                  <span className="text-xs text-[#374151] shrink-0">{row.label}</span>
                  <span className="text-xs font-semibold text-[#111827] text-right capitalize">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Exchange */}
        {((org.needs && org.needs.length > 0) || (org.offers && org.offers.length > 0)) && (
          <div className="px-8 py-6 space-y-5">
            {org.needs && org.needs.length > 0 && (
              <div>
                <Eyebrow>Looking for in a partner</Eyebrow>
                <div className="flex flex-wrap gap-2">
                  {org.needs.map(n => (
                    <span key={n} className="text-sm font-semibold px-4 py-2 rounded-lg text-[#374151]"
                      style={{ background: "#F9FAFB", border: "1px solid #E5E7EB" }}>{n}</span>
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
                      style={{ background: "#ECFDF5", color: "#065F46", border: "1px solid #A7F3D0" }}>{o}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* DD readiness */}
        <div className="px-8 py-6">
          <div className="flex items-center justify-between mb-4">
            <Eyebrow>Due diligence readiness</Eyebrow>
            <span className="text-xs font-bold mb-3" style={{ color: score > 2 ? "#065F46" : "#92400E" }}>{score} of 5 docs ready</span>
          </div>
          {/* Progress bar */}
          <div className="h-1.5 rounded-full mb-4 overflow-hidden" style={{ background: "#F3F4F6" }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${(score / 5) * 100}%`, background: score > 2 ? "#2D6A4F" : "#C45C26" }} />
          </div>
          {score === 0 ? (
            <p className="text-xs text-[#374151]">No documents confirmed ready yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {ddDocs.filter(({ key }) => org[key as keyof OrgRow] as boolean).map(({ label }) => (
                <span key={label} className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg"
                  style={{ background: "#ECFDF5", color: "#065F46", border: "1px solid #A7F3D0" }}>
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                  {label}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* SDGs */}
        {org.sdgs && org.sdgs.length > 0 && (
          <div className="px-8 py-6">
            <Eyebrow>SDG alignment</Eyebrow>
            <div className="flex flex-wrap gap-1.5">
              {org.sdgs.map(sdg => (
                <span key={sdg} className="text-xs font-bold px-3 py-1.5 rounded-lg"
                  style={{ background: "#ECFDF5", color: "#065F46", border: "1px solid #A7F3D0" }}>
                  SDG {sdg}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Context */}
        {(org.partnership_theory_of_change || org.partnership_prior_attempts || org.partnership_constraints) && (
          <div className="px-8 py-6">
            <Eyebrow>Context</Eyebrow>
            <div className="grid grid-cols-3 gap-3">
              {org.partnership_theory_of_change && (
                <div className="rounded-xl px-5 py-5 space-y-2 flex flex-col"
                  style={{ background: "#F9FAFB", border: "1px solid #E5E7EB" }}>
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#6B7280]">Approach to change</p>
                  <p className="text-sm text-[#374151] leading-relaxed flex-1">{org.partnership_theory_of_change}</p>
                </div>
              )}
              {org.partnership_prior_attempts && (
                <div className="rounded-xl px-5 py-5 space-y-2 flex flex-col"
                  style={{ background: "#F9FAFB", border: "1px solid #E5E7EB" }}>
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#6B7280]">Previous attempts</p>
                  <p className="text-sm text-[#374151] leading-relaxed flex-1">{org.partnership_prior_attempts}</p>
                </div>
              )}
              {org.partnership_constraints && (
                <div className="rounded-xl px-5 py-5 space-y-2 flex flex-col"
                  style={{ background: "#F9FAFB", border: "1px solid #E5E7EB" }}>
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#6B7280]">Constraints</p>
                  <p className="text-sm text-[#374151] leading-relaxed flex-1">{org.partnership_constraints}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Track record */}
        {org.partnership_prior_experience !== null && org.partnership_prior_experience !== undefined && (
          <div className="px-8 py-6">
            <Eyebrow>Track record</Eyebrow>
            <div className="flex items-start gap-3">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${org.partnership_prior_experience ? "bg-[#2D6A4F]" : "bg-[#F3F4F6]"}`}>
                {org.partnership_prior_experience
                  ? <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                  : <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12"/></svg>}
              </div>
              <div>
                <p className="text-sm font-semibold text-[#111827]">
                  {org.partnership_prior_experience ? "Has completed a partnership before" : "No prior completed partnerships"}
                </p>
                {org.partnership_prior_experience && org.partnership_prior_experience_detail && (
                  <p className="text-sm text-[#374151] leading-relaxed mt-1">{org.partnership_prior_experience_detail}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Website */}
        {org.website && org.website !== "https://" && (
          <div className="px-8 py-4">
            <a href={org.website} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2D6A4F] hover:underline">
              <ArrowUpRight className="w-3.5 h-3.5" />
              {org.website.replace(/^https?:\/\//, "")}
            </a>
          </div>
        )}

        {/* CTA */}
        {isOrg && !org.partnership_formed && (
          <div className="px-8 py-6 sticky bottom-0 bg-white space-y-3" style={{ borderTop: "1px solid #F3F4F6" }}>
            {alreadySent ? (
              <div className="flex items-center gap-2 text-sm font-semibold text-[#065F46]">
                <CheckCircle2 className="w-4 h-4" />Interest expressed — they've been notified
              </div>
            ) : (
              <>
                {/* AI opening message draft */}
                {openingMsg && !msgEditing && (
                  <div className="rounded-xl p-4 space-y-2" style={{ background: "#F9FAFB", border: "1px solid #E5E7EB" }}>
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-black uppercase tracking-widest text-[#6B7280]">AI-drafted opening message</p>
                      <button type="button" onClick={() => setMsgEditing(true)}
                        className="text-[10px] font-semibold text-[#374151] hover:text-[#111827] underline underline-offset-2">
                        Edit
                      </button>
                    </div>
                    <p className="text-xs text-[#374151] leading-relaxed">{openingMsg}</p>
                  </div>
                )}
                {msgEditing && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-black uppercase tracking-widest text-[#6B7280]">Edit opening message</p>
                      <button type="button" onClick={() => setMsgEditing(false)}
                        className="text-[10px] font-semibold text-[#374151] hover:text-[#111827] underline underline-offset-2">
                        Done
                      </button>
                    </div>
                    <textarea rows={4} value={openingMsg ?? ""}
                      onChange={e => setOpeningMsg(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl text-xs text-[#374151] resize-none focus:outline-none"
                      style={{ background: "#F9FAFB", border: "1px solid #E5E7EB" }} />
                  </div>
                )}
                <button type="button"
                  onClick={e => {
                    if (openingMsg) {
                      // Pass edited message to parent
                      (e as any).customMessage = openingMsg;
                    }
                    onExpressInterest(e);
                  }}
                  disabled={sending}
                  className="w-full h-11 rounded-full text-white text-sm font-bold disabled:opacity-40 transition-all hover:opacity-90 active:scale-[0.98]"
                  style={{ background: "#111827" }}>
                  {sending ? "Sending..." : fitLoading ? "Express interest" : `Express interest${fit ? ` · ${fit.fit_score}% fit` : ""}`}
                </button>
              </>
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
  const [orgs, setOrgs]                       = useState<OrgRow[]>([]);
  const [loading, setLoading]                 = useState(true);
  const [showModal, setShowModal]             = useState(false);
  const [search, setSearch]                   = useState("");
  const [sectorFilters, setSectorFilters]     = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters]         = useState(false);
  const [favoritesOnly, setFavoritesOnly]     = useState(false);
  const [selectedOrg, setSelectedOrg]         = useState<OrgRow | null>(null);
  const [savedOrgs, setSavedOrgs]             = useState<Set<string>>(new Set());
  const [currentUserOrgId, setCurrentUserOrgId] = useState<string | null>(null);
  const [viewerOrg, setViewerOrg] = useState<OrgRow | null>(null);  const [sentInterests, setSentInterests]     = useState<Set<string>>(new Set());
  const [sendingInterest, setSendingInterest] = useState<string | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  useEffect(() => { if (user) loadAll(); }, [user]);

  async function loadAll() {
    const uid = user?.id ?? null;
    const [orgsRes, savedRes, myOrgRes, connRes] = await Promise.all([
      supabase.from("organizations")
        .select("id,organisation_name,description,sector,country,organisation_type,website,email,needs,offers,sdgs,partnership_sought,partnership_title,verification_status,status,user_id,partnership_listed,partnership_formed,partnership_stage,partnership_duration,partnership_budget,partnership_decision_timeline,partnership_success_definition,partnership_funding_status,partnership_exclusivity,partnership_working_style,partnership_financial_transfer,partnership_reporting,partnership_ip_ownership,partnership_legal_type,partnership_team_capacity,partnership_contact_seniority,partnership_geo_specificity,partnership_theory_of_change,partnership_prior_attempts,partnership_constraints,partnership_dd_financial_model,partnership_dd_audited_accounts,partnership_dd_safeguarding_policy,partnership_dd_data_policy,partnership_dd_governance_doc,partnership_prior_experience,partnership_prior_experience_detail,partnership_physically_present")
        .eq("status", "published").eq("partnership_listed", true).order("created_at", { ascending: false }),
      uid ? supabase.from("saved_organizations").select("organization_id").eq("user_id", uid) : Promise.resolve({ data: null }),
      uid ? supabase.from("organizations").select("id,organisation_name,description,sector,country,organisation_type,needs,offers,sdgs,partnership_working_style,partnership_dd_financial_model,partnership_dd_audited_accounts,partnership_dd_safeguarding_policy,partnership_dd_data_policy,partnership_dd_governance_doc").eq("user_id", uid).maybeSingle() : Promise.resolve({ data: null }),      uid ? supabase.from("partnership_connections").select("receiver_org_id").eq("sender_user_id", uid) : Promise.resolve({ data: null }),
    ]);

    if (orgsRes.data) {
      setOrgs(orgsRes.data as OrgRow[]);
      if (orgsRes.data.length > 0) setSelectedOrg(orgsRes.data[0] as OrgRow);
    }
    if (savedRes.data) setSavedOrgs(new Set(savedRes.data.map((r: any) => r.organization_id)));
    if (myOrgRes.data) {
      setCurrentUserOrgId(myOrgRes.data.id);
      setViewerOrg(myOrgRes.data as OrgRow);
    }
    if (connRes.data && myOrgRes.data) {
      setSentInterests(new Set(connRes.data.filter((r: any) => r.receiver_org_id !== myOrgRes.data!.id).map((r: any) => r.receiver_org_id)));
    } else if (connRes.data) {
      setSentInterests(new Set(connRes.data.map((r: any) => r.receiver_org_id)));
    }
    setLoading(false);
  }

  const filtered = orgs.filter(org => {
    if (user && org.user_id === user.id) return false;
    const sectors = normalizeArr(org.sector);
    const countries = normalizeArr(org.country);
    const matchesSector    = sectorFilters.size === 0 || sectors.some(s => [...sectorFilters].some(f => s.toLowerCase().includes(f.toLowerCase())));
    const matchesSearch    = !search.trim() || org.organisation_name?.toLowerCase().includes(search.toLowerCase()) || org.description?.toLowerCase().includes(search.toLowerCase()) || (org.partnership_sought ?? "").toLowerCase().includes(search.toLowerCase()) || countries.some(c => c.toLowerCase().includes(search.toLowerCase()));
    const matchesFavorites = !favoritesOnly || savedOrgs.has(org.id);
    return matchesSector && matchesSearch && matchesFavorites;
  });

  async function toggleSave(orgId: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!user) return;
    if (savedOrgs.has(orgId)) {
      await supabase.from("saved_organizations").delete().eq("user_id", user.id).eq("organization_id", orgId);
      setSavedOrgs(prev => { const n = new Set(prev); n.delete(orgId); return n; });
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
      senderOrgId = data.id; setCurrentUserOrgId(data.id);
    }
    setSendingInterest(org.id);
    try {
      const { error } = await supabase.from("partnership_connections").insert({
        sender_org_id: senderOrgId, receiver_org_id: org.id,
        sender_user_id: user.id, source: "browse", status: "pending",
      });
      if (error && !error.message.includes("unique")) throw error;
      const { data: senderOrg } = await supabase.from("organizations").select("organisation_name").eq("id", senderOrgId).single();
      const { data: convData } = await supabase.from("conversations").insert({ conversation_type: "partnership", status: "open" }).select("id").single();
      if (convData?.id) {
        await supabase.from("conversation_participants").insert([
          { conversation_id: convData.id, user_id: user.id },
          { conversation_id: convData.id, user_id: org.user_id },
        ]);
        const customMsg = (e as any).customMessage;
        await supabase.from("messages").insert({
          conversation_id: convData.id, sender_id: user.id,
          body: customMsg || `Hi ${org.organisation_name}, I came across your partnership listing on Impact Natives and I'm interested in exploring a potential collaboration.${org.partnership_sought ? ` I see you're looking for: ${org.partnership_sought}` : ""}\n\nWould you be open to a conversation?`,
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
    } catch (err) { console.error("Express interest error:", err); }
    finally { setSendingInterest(null); }
  }

  const activeFilterCount = sectorFilters.size + (favoritesOnly ? 1 : 0);

  return (
    <>
      <div className="flex flex-col h-full min-h-0 -mx-4 sm:-mx-6">

        {/* Top bar */}
        <div className="shrink-0 px-5 py-3 flex items-center gap-2" style={{ background: "#FFFFFF", borderBottom: "1px solid #F3F4F6" }}>
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#374151]" />
            <input type="text" placeholder="Search listings..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-3 rounded-lg text-xs text-[#111827] placeholder:text-[#374151] focus:outline-none transition-colors"
              style={{ background: "#F9FAFB", border: "1px solid #E5E7EB" }} />
          </div>
          <button type="button" onClick={() => setShowFilters(v => !v)}
            className="h-9 px-3.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
            style={showFilters || activeFilterCount > 0
              ? { background: "#111827", color: "#FFFFFF", border: "1px solid #111827" }
              : { background: "#FFFFFF", color: "#374151", border: "1px solid #E5E7EB" }}>
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filter
            {activeFilterCount > 0 && <span className="w-4 h-4 rounded-full bg-white text-[#111827] text-[9px] font-black flex items-center justify-center">{activeFilterCount}</span>}
          </button>
          <div className="flex-1" />
          {user && (
            <button type="button" onClick={() => setShowModal(true)}
              className="h-9 px-4 rounded-full text-white text-xs font-bold transition-all hover:opacity-90"
              style={{ background: "#2D6A4F" }}>
              + Get Matched
            </button>
          )}
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="shrink-0 px-5 py-4 space-y-3" style={{ background: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={favoritesOnly} onChange={e => setFavoritesOnly(e.target.checked)} className="w-3.5 h-3.5 rounded accent-[#2D6A4F]" />
              <span className="text-xs font-semibold text-[#374151]">Saved only</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {SECTOR_OPTIONS.map(sector => (
                <button key={sector} type="button"
                  onClick={() => setSectorFilters(prev => { const n = new Set(prev); n.has(sector) ? n.delete(sector) : n.add(sector); return n; })}
                  className="h-6 px-2.5 rounded-md text-[10px] font-semibold transition-colors"
                  style={sectorFilters.has(sector)
                    ? { background: "#111827", color: "#FFFFFF", border: "1px solid #111827" }
                    : { background: "#FFFFFF", color: "#6B7280", border: "1px solid #E5E7EB" }}>
                  {sector}
                </button>
              ))}
            </div>
            {activeFilterCount > 0 && (
              <button type="button" onClick={() => { setSectorFilters(new Set()); setFavoritesOnly(false); }}
                className="text-xs text-[#374151] hover:text-[#111827] transition-colors">
                Clear all
              </button>
            )}
          </div>
        )}

        {/* Split layout */}
        {loading ? (
          <div className="flex items-center justify-center flex-1">
            <Loader2 className="w-5 h-5 animate-spin text-[#2D6A4F]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-4 text-center px-6">
            <Handshake className="w-7 h-7 text-[#D1D5DB]" />
            <div>
              <p className="text-sm font-bold text-[#111827] mb-1">{orgs.length === 0 ? "No listings yet" : "No results"}</p>
              <p className="text-xs text-[#374151]">{orgs.length === 0 ? "Be the first to list your organisation." : "Try a different search or filter."}</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* Left list */}
            <div className={`w-full lg:w-72 xl:w-80 shrink-0 overflow-y-auto ${mobileDetailOpen ? "hidden lg:block" : "block"}`}
              style={{ borderRight: "1px solid #F3F4F6", background: "#FAFAFA" }}>
              {filtered.map(org => (
                <ListCard key={org.id} org={org}
                  selected={selectedOrg?.id === org.id}
                  onClick={() => { setSelectedOrg(org); setMobileDetailOpen(true); }}
                  isSaved={savedOrgs.has(org.id)}
                  onToggleSave={e => toggleSave(org.id, e)}
                />
              ))}
            </div>

            {/* Right detail */}
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
                viewerOrg={viewerOrg}
              />
            </div>
          </div>
        )}
      </div>

      <FindPartnerModalDashboard isOpen={showModal} onClose={() => { setShowModal(false); loadAll(); }} />
    </>
  );
}
