// ─── DashboardPartnerships.tsx ───────────────────────────────────────────────
import { useEffect, useState, useRef } from "react";
import { ORG_TYPE_FILTERS } from "@/lib/orgTypes";
import { supabase } from "@/lib/supabase";
import { Handshake, Loader2, Search, CheckCircle2, ShieldCheck, X, SlidersHorizontal, ArrowUpRight, Sparkles } from "lucide-react";
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
function sdgLabel(value: string | number): string {
  const n = typeof value === "number" ? value : parseInt(value, 10);
  if (!Number.isNaN(n) && n >= 1 && n <= SDG_NAMES.length) return SDG_NAMES[n - 1];
  return String(value);
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
    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground mb-3">
      {children}
    </p>
  );
}

// ─── Bento cell ──────────────────────────────────────────────────────────────
function BentoCell({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl p-3.5 bg-muted border border-border">
      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
      <p className={`text-sm font-bold leading-snug ${accent ? "text-[#2D6A4F]" : "text-foreground"}`}>{value}</p>
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
      <p className="text-[11px] text-muted-foreground capitalize mb-3">
        {countries.length > 0 ? countries.join(", ") : orgTypeLabel(org.organisation_type)}
      </p>

      {/* Partnership title -- full, no clamp */}
      {org.partnership_title && (
        <p className="text-xs font-semibold text-foreground leading-snug">
          {org.partnership_title}
        </p>
      )}
      {org.partnership_formed && (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full mt-1.5"
          style={{ background: "rgba(29,78,216,0.12)", color: "#1D4ED8", border: "1px solid rgba(29,78,216,0.3)" }}>
          <CheckCircle2 className="w-2.5 h-2.5" />Partnership formed
        </span>
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
    if (org && viewerOrg && org.user_id !== viewerOrg.user_id && org.id !== viewerOrg.id) {
      loadFit(org, viewerOrg);
    }

  }, [org?.id, viewerOrg?.id]);

  async function loadFit(listing: OrgRow, viewer: OrgRow) {
    setFitLoading(true);
    try {
      const { data: cached } = await supabase
        .from("partnership_match_cache")
        .select("fit_score, reasons, gaps, rationale, opening_message")
        .eq("org_id", viewer.id)
        .eq("matched_org_id", listing.id)
        .maybeSingle();

      if (cached && cached.fit_score != null) {
        setFit({ ...cached, reasons: cached.reasons ?? [], gaps: cached.gaps ?? [] } as any);
        setOpeningMsg(cached.opening_message ?? null);
        setFitLoading(false);
      }

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
      <div className="hidden lg:flex flex-col items-center justify-center h-full gap-4 text-center px-10 bg-muted/30">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-muted border border-border">
          <Handshake className="w-6 h-6 text-foreground" />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground mb-1">Select a listing</p>
          <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">Click any organisation from the list to view their full partnership profile.</p>
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
    <div ref={ref} className="flex flex-col h-full overflow-y-auto bg-background">

      {/* ── Identity block ── */}
      <div className="shrink-0 px-8 pt-7 pb-6 border-b-2 border-border"
        style={{ background: "linear-gradient(to bottom, rgba(45,106,79,0.06), transparent)" }}>
        {/* Mobile close */}
        <div className="lg:hidden flex justify-end mb-4">
          <button type="button" onClick={onClose}
            className="p-1.5 rounded-lg text-foreground hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <a href={`/dashboard/natives?user=${org.user_id}`}
                className="text-2xl font-black text-foreground hover:text-[#2D6A4F] transition-colors leading-tight tracking-tight">
                {org.organisation_name}
              </a>
              {isVerified && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                style={{ background: "rgba(6,95,70,0.12)", color: "#065F46", border: "1px solid rgba(6,95,70,0.3)" }}>
                <ShieldCheck className="w-3 h-3" />Verified
              </span>
            )}
            {fitLoading && (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full shrink-0 bg-muted text-muted-foreground border border-border">
                <Loader2 className="w-3 h-3 animate-spin" />Scoring fit...
              </span>
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
          <p className="text-sm text-muted-foreground capitalize">
              {orgTypeLabel(org.organisation_type)}
              {countries.length > 0 && ` · ${countries.join(", ")}`}
            </p>
          </div>
          <button type="button" onClick={onToggleSave}
            className="shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-full transition-all border border-border"
            style={{ color: isSaved ? "#065F46" : undefined, background: isSaved ? "rgba(6,95,70,0.1)" : "transparent" }}>
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
              <span key={s} className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-muted text-foreground border border-border">
                {s}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 divide-y divide-border">

        {/* About -- directly under header */}
        {org.description && (
          <div className="px-8 py-5 border-b border-border">
            <p className="text-[15px] text-muted-foreground leading-relaxed">{org.description}</p>
          </div>
        )}

        {/* Seeking + success */}
        {(org.partnership_sought || org.partnership_success_definition) && (
          <div className="px-8 py-6 space-y-4">
            {org.partnership_sought && (
              <div>
                <Eyebrow>Seeking</Eyebrow>
                <p className="text-[15px] text-muted-foreground leading-relaxed">{org.partnership_sought}</p>
              </div>
            )}
            {org.partnership_success_definition && (
              <div className="rounded-xl px-5 py-4 bg-muted border border-border border-l-[3px] border-l-[#2D6A4F]">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Success in 12 months</p>
                <p className="text-sm text-muted-foreground leading-relaxed italic">"{org.partnership_success_definition}"</p>
              </div>
            )}
          </div>
        )}

        {/* AI fit analysis -- own distinct section */}
        {(fit || fitLoading) && org.user_id !== viewerOrg?.user_id && (
          <div className="px-8 py-6 border-t border-b border-border"
            style={{ background: "linear-gradient(135deg, rgba(13,43,26,0.04) 0%, rgba(26,74,46,0.02) 100%)" }}>
            <div className="flex items-center gap-2 mb-4">
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

            {fitLoading && (
              <p className="text-xs text-muted-foreground">Analysing compatibility with your organisation profile...</p>
            )}

            {fit && !fitLoading && (
              <div className="space-y-4">
                <p className="text-[15px] text-muted-foreground leading-relaxed">{fit.rationale}</p>

                {fit.reasons.length > 0 && (
                  <div className="flex flex-col gap-2">
                    {fit.reasons.map((r, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: "rgba(6,95,70,0.12)" }}>
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#065F46" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                        </div>
                        <span className="text-xs text-muted-foreground leading-relaxed">{r}</span>
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
                <div key={row.label} className="flex items-start justify-between gap-6 py-2.5 border-b border-border">
                  <span className="text-xs text-muted-foreground shrink-0">{row.label}</span>
                  <span className="text-xs font-semibold text-foreground text-right capitalize">{row.value}</span>
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

        {/* DD readiness */}
        <div className="px-8 py-6">
          <div className="flex items-center justify-between mb-4">
            <Eyebrow>Due diligence readiness</Eyebrow>
            <span className="text-xs font-bold mb-3" style={{ color: score > 2 ? "#065F46" : "#92400E" }}>{score} of 5 docs ready</span>
          </div>
          <div className="h-1.5 rounded-full mb-4 overflow-hidden bg-muted">
            <div className="h-full rounded-full transition-all" style={{ width: `${(score / 5) * 100}%`, background: score > 2 ? "#2D6A4F" : "#C45C26" }} />
          </div>
          {score === 0 ? (
            <p className="text-xs text-muted-foreground">No documents confirmed ready yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {ddDocs.filter(({ key }) => org[key as keyof OrgRow] as boolean).map(({ label }) => (
                <span key={label} className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg"
                  style={{ background: "rgba(6,95,70,0.12)", color: "#065F46", border: "1px solid rgba(6,95,70,0.3)" }}>
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
                  style={{ background: "rgba(6,95,70,0.12)", color: "#065F46", border: "1px solid rgba(6,95,70,0.3)" }}>
                  {sdgLabel(sdg)}
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
                <div className="rounded-xl px-5 py-5 space-y-2 flex flex-col bg-muted border border-border">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Approach to change</p>
                  <p className="text-sm text-muted-foreground leading-relaxed flex-1">{org.partnership_theory_of_change}</p>
                </div>
              )}
              {org.partnership_prior_attempts && (
                <div className="rounded-xl px-5 py-5 space-y-2 flex flex-col bg-muted border border-border">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Previous attempts</p>
                  <p className="text-sm text-muted-foreground leading-relaxed flex-1">{org.partnership_prior_attempts}</p>
                </div>
              )}
              {org.partnership_constraints && (
                <div className="rounded-xl px-5 py-5 space-y-2 flex flex-col bg-muted border border-border">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Constraints</p>
                  <p className="text-sm text-muted-foreground leading-relaxed flex-1">{org.partnership_constraints}</p>
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
              <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${org.partnership_prior_experience ? "bg-[#2D6A4F]" : "bg-muted"}`}>
                {org.partnership_prior_experience
                  ? <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                  : <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted-foreground"><path d="M18 6L6 18M6 6l12 12"/></svg>}
              </div>
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
          <div className="px-8 py-4">
            <a href={org.website} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2D6A4F] hover:underline">
              <ArrowUpRight className="w-3.5 h-3.5" />
              {org.website.replace(/^https?:\/\//, "")}
            </a>
          </div>
        )}

        {/* CTA */}
        {org.user_id === viewerOrg?.user_id ? (
          <div className="px-8 py-4 border-t border-border">
            <span className="text-xs font-semibold text-[#2D6A4F]">Your listing</span>
          </div>
        ) : org.partnership_formed ? (
          <div className="px-8 py-6 sticky bottom-0 bg-background border-t border-border">
            <div className="flex items-center gap-2.5 px-4 py-3.5 rounded-xl"
              style={{ background: "rgba(29,78,216,0.1)", border: "1px solid rgba(29,78,216,0.3)" }}>
              <CheckCircle2 className="w-4 h-4 shrink-0 text-[#1D4ED8]" />
              <p className="text-xs font-semibold text-[#1D4ED8]">
                This organisation has formed a partnership and closed this listing.
              </p>
            </div>
          </div>
        ) : isOrg && (          
          <div className="px-8 py-6 sticky bottom-0 bg-background space-y-3 border-t border-border">
            {alreadySent ? (
              <div className="flex items-center gap-2 text-sm font-semibold text-[#065F46]">
                <CheckCircle2 className="w-4 h-4" />Interest expressed — they've been notified
              </div>
            ) : (
              <>
                {/* AI opening message draft */}
                {openingMsg && !msgEditing && (
                  <div className="rounded-xl p-4 space-y-2 bg-muted border border-border">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">AI-drafted opening message</p>
                      <button type="button" onClick={() => setMsgEditing(true)}
                        className="text-[10px] font-semibold text-muted-foreground hover:text-foreground underline underline-offset-2">
                        Edit
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{openingMsg}</p>
                  </div>
                )}
                {msgEditing && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Edit opening message</p>
                      <button type="button" onClick={() => setMsgEditing(false)}
                        className="text-[10px] font-semibold text-muted-foreground hover:text-foreground underline underline-offset-2">
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
      const deepLinked = autoOpenOrgId ? (orgsRes.data as OrgRow[]).find(o => o.id === autoOpenOrgId) : null;
      if (deepLinked) setSelectedOrg(deepLinked);
      else if (orgsRes.data.length > 0) setSelectedOrg(orgsRes.data[0] as OrgRow);
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
    console.log("expressInterest called with org.user_id:", org.user_id, "org.organisation_name:", org.organisation_name);
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
      const { data: convId } = await supabase.rpc("create_partnership_conversation", {
        p_receiver_user_id: org.user_id,
        p_sender_org_id: senderOrgId,
        p_receiver_org_id: org.id,
      });

      const convData = convId ? { id: convId as string } : null;

      if (convData?.id) {
        const { error: updateErr, data: updateData } = await supabase.from("partnership_connections")
          .update({ conversation_id: convData.id })
          .eq("sender_org_id", senderOrgId)
          .eq("receiver_org_id", org.id)
          .select();
        console.log("connection update result:", JSON.stringify({ updateErr, updateData, senderOrgId, receiverOrgId: org.id, convId: convData.id }));

        await supabase.rpc("join_conversation_and_notify", {
          p_conversation_id: convData.id,
          p_notification_type: "partnership_interest",
          p_notification_title: "New partnership interest",
          p_notification_body: `${senderOrg?.organisation_name ?? "An organisation"} expressed interest in partnering with you.`,
          p_notification_link: `/dashboard/messages?conversation=${convData.id}`,
          p_notification_metadata: { sender_org_id: senderOrgId, receiver_org_id: org.id, conversation_id: convData.id },
        });
        const customMsg = (e as any).customMessage;
        await supabase.from("messages").insert({
          conversation_id: convData.id, sender_id: user.id,
          body: customMsg || `Hi ${org.organisation_name}, I came across your partnership listing on Impact Natives and I'm interested in exploring a potential collaboration.${org.partnership_sought ? ` I see you're looking for: ${org.partnership_sought}` : ""}\n\nWould you be open to a conversation?`,
        });
      }
      setSentInterests(prev => new Set(prev).add(org.id));
    } catch (err) { console.error("Express interest error:", err); }
    finally { setSendingInterest(null); }
  }

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
              <p className="text-xs text-muted-foreground">{orgs.length === 0 ? "Be the first to list your organisation." : "Try a different search or filter."}</p>
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
                />
              ))}
            </div>

            {/* Right detail */}
            <div className={`flex-1 min-w-0 overflow-y-auto ${mobileDetailOpen ? "block" : "hidden lg:block"}`}>
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