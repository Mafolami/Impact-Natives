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
// Logic (loadFit, the CTA states, save/interest wiring) is unchanged from the
// original DetailPanel -- only layout/container classes vary by variant.

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Loader2, ShieldCheck, Sparkles, CheckCircle2, ArrowUpRight, ArrowLeft } from "lucide-react";
import { ORG_TYPE_FILTERS } from "@/lib/orgTypes";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OrgRow {
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

export type FitResult = {
  fit_score: number;
  reasons: string[];
  gaps: string[];
  rationale: string;
  opening_message: string;
};

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

export function ddScore(org: OrgRow): number {
  return [org.partnership_dd_financial_model, org.partnership_dd_audited_accounts,
    org.partnership_dd_safeguarding_policy, org.partnership_dd_data_policy,
    org.partnership_dd_governance_doc].filter(Boolean).length;
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

function BentoCell({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl p-3.5 bg-muted border border-border">
      <p className="text-[9px] font-black uppercase tracking-widest text-black dark:text-white mb-1">{label}</p>
      <p className={`text-sm font-bold leading-snug ${accent ? "text-[#2D6A4F]" : "text-foreground"}`}>{value}</p>
    </div>
  );
}

// Wraps a content section: in "page" mode each section becomes its own card,
// matching InitiativeDetail's Sectors/Locations/Budget card treatment exactly
// (rounded-xl border bg-card, px-5 py-4).
function Section({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-border bg-card px-5 py-4 ${className}`}>{children}</div>;
}

// ─── Main panel ─────────────────────────────────────────────────────────────────

export function OrgDetailPanel({ org, isSaved, onToggleSave, isOrg, alreadySent, sending, onExpressInterest, onBack, backLabel, viewerOrg, variant = "panel" }: {
  org: OrgRow | null; isSaved: boolean; onToggleSave: (e: React.MouseEvent) => void;
  isOrg: boolean; alreadySent: boolean; sending: boolean;
  onExpressInterest: (e: React.MouseEvent) => void; onBack: () => void;
  backLabel?: string;
  viewerOrg: OrgRow | null;
  variant?: "panel" | "page";
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

  const ddDocs = [
    { key: "partnership_dd_financial_model",     label: "Financial model" },
    { key: "partnership_dd_audited_accounts",    label: "Audited accounts" },
    { key: "partnership_dd_safeguarding_policy", label: "Safeguarding policy" },
    { key: "partnership_dd_data_policy",         label: "Data policy" },
    { key: "partnership_dd_governance_doc",      label: "Governance doc" },
  ];

  // ── Page variant: flat content matching InitiativeDetail exactly ──
  if (variant === "page") {
    return (
      <div className="space-y-6">
        {backLabel && (
          <button type="button" onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-[#C45C26] transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> {backLabel}
          </button>
        )}

        {/* Identity -- no card, no gradient, sits directly on the page like InitiativeDetail's title block */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <a href={`/dashboard/natives?tab=organisation&user=${org.user_id}`}
                className="text-2xl font-bold text-foreground hover:text-[#C45C26] transition-colors tracking-tight">
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
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="text-xs text-black dark:text-white capitalize">
                {orgTypeLabel(org.organisation_type)}
                {countries.length > 0 && ` · ${countries.join(", ")}`}
              </span>
            </div>
            {sectors.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {sectors.map(s => (
                  <span key={s} className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-muted text-foreground border border-border">
                    {s}
                  </span>
                ))}
              </div>
            )}
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
            {org.partnership_success_definition && (
              <div className="rounded-xl px-5 py-4 bg-muted border border-border border-l-[3px] border-l-[#2D6A4F]">
                <p className="text-[10px] font-black uppercase tracking-widest text-black dark:text-white mb-2">Success in 12 months</p>
                <p className="text-sm text-foreground leading-relaxed italic">"{org.partnership_success_definition}"</p>
              </div>
            )}
          </div>
        )}

        {(fit || fitLoading) && org.user_id !== viewerOrg?.user_id && (
          <div className="rounded-xl border border-border bg-card px-5 py-4"
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
              <p className="text-xs text-black dark:text-white">Analysing compatibility with your organisation profile...</p>
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
              </div>
            )}
          </div>
        )}

        {(org.partnership_stage || org.partnership_duration || org.partnership_budget || org.partnership_decision_timeline || org.partnership_funding_status || org.partnership_exclusivity) && (
          <Section>
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
          </Section>
        )}

        {(org.partnership_working_style || org.partnership_financial_transfer || (org.partnership_legal_type && org.partnership_legal_type.length > 0) || (org.partnership_reporting && org.partnership_reporting.length > 0) || org.partnership_ip_ownership) && (
          <Section>
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
                <div key={row.label} className="flex items-start justify-between gap-6 py-2.5 border-b border-border last:border-b-0">
                  <span className="text-xs text-black dark:text-white shrink-0">{row.label}</span>
                  <span className="text-xs font-semibold text-foreground text-right capitalize">{row.value}</span>
                </div>
              ))}
            </div>
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
          <div className="flex items-center justify-between mb-4">
            <Eyebrow>Due diligence readiness</Eyebrow>
            <span className="text-xs font-bold mb-3" style={{ color: score > 2 ? "#065F46" : "#92400E" }}>{score} of 5 docs ready</span>
          </div>
          <div className="h-1.5 rounded-full mb-4 overflow-hidden bg-muted">
            <div className="h-full rounded-full transition-all" style={{ width: `${(score / 5) * 100}%`, background: score > 2 ? "#2D6A4F" : "#C45C26" }} />
          </div>
          {score === 0 ? (
            <p className="text-xs text-black dark:text-white">No documents confirmed ready yet.</p>
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
        </Section>

        {org.sdgs && org.sdgs.length > 0 && (
          <Section>
            <Eyebrow>SDG alignment</Eyebrow>
            <div className="flex flex-wrap gap-1.5">
              {org.sdgs.map(sdg => (
                <span key={sdg} className="text-xs font-bold px-3 py-1.5 rounded-lg"
                  style={{ background: "rgba(6,95,70,0.12)", color: "#065F46", border: "1px solid rgba(6,95,70,0.3)" }}>
                  {sdgLabel(sdg)}
                </span>
              ))}
            </div>
          </Section>
        )}

        {(org.partnership_theory_of_change || org.partnership_prior_attempts || org.partnership_constraints) && (
          <Section>
            <Eyebrow>Context</Eyebrow>
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
          </Section>
        )}

        {org.partnership_prior_experience !== null && org.partnership_prior_experience !== undefined && (
          <Section>
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
                  <p className="text-sm text-foreground leading-relaxed mt-1">{org.partnership_prior_experience_detail}</p>
                )}
              </div>
            </div>
          </Section>
        )}

        {org.website && org.website !== "https://" && (
          <a href={org.website} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2D6A4F] hover:underline">
            <ArrowUpRight className="w-3.5 h-3.5" />
            {org.website.replace(/^https?:\/\//, "")}
          </a>
        )}

        {org.user_id === viewerOrg?.user_id ? (
          <div className="rounded-xl border border-border bg-card px-5 py-4">
            <span className="text-xs font-semibold text-[#2D6A4F]">Your listing</span>
          </div>
        ) : org.partnership_formed ? (
          <div className="flex items-center gap-2.5 px-5 py-4 rounded-xl"
            style={{ background: "rgba(29,78,216,0.1)", border: "1px solid rgba(29,78,216,0.3)" }}>
            <CheckCircle2 className="w-4 h-4 shrink-0 text-[#1D4ED8]" />
            <p className="text-xs font-semibold text-[#1D4ED8]">
              This organisation has formed a partnership and closed this listing.
            </p>
          </div>
        ) : isOrg && (
          <div className="rounded-xl border border-border bg-card px-5 py-4 space-y-3">
            {alreadySent ? (
              <div className="flex items-center gap-2 text-sm font-semibold text-[#065F46]">
                <CheckCircle2 className="w-4 h-4" />Interest expressed — they've been notified
              </div>
            ) : (
              <>
                {openingMsg && !msgEditing && (
                  <div className="rounded-xl p-4 space-y-2 bg-muted border border-border">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-black uppercase tracking-widest text-black dark:text-white">AI-drafted opening message</p>
                      <button type="button" onClick={() => setMsgEditing(true)}
                        className="text-[10px] font-semibold text-muted-foreground hover:text-foreground underline underline-offset-2">
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
    );
  }

  // ── Panel variant: unchanged split-pane look ──
  return (
    <div ref={ref} className="flex flex-col h-full overflow-y-auto bg-background">

      {/* ── Identity block ── */}
      <div className="shrink-0 px-8 pt-7 pb-6 border-b-2 border-border"
        style={{ background: "linear-gradient(to bottom, rgba(45,106,79,0.06), transparent)" }}>
        {backLabel && (
          <div className="flex justify-between mb-4">
            <button type="button" onClick={onBack}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-[#C45C26] transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" /> {backLabel}
            </button>
          </div>
        )}

        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <a href={`/dashboard/natives?tab=organisation&user=${org.user_id}`}
                className="text-2xl font-black text-foreground hover:text-[#C45C26] transition-colors leading-tight tracking-tight">
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
          <p className="text-sm text-black dark:text-white capitalize">
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
            {org.partnership_success_definition && (
              <div className="rounded-xl px-5 py-4 bg-muted border border-border border-l-[3px] border-l-[#2D6A4F]">
                <p className="text-[10px] font-black uppercase tracking-widest text-black dark:text-white mb-2">Success in 12 months</p>
                <p className="text-sm text-foreground leading-relaxed italic">"{org.partnership_success_definition}"</p>
              </div>
            )}          </div>
        )}

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
              <p className="text-xs text-black dark:text-white">Analysing compatibility with your organisation profile...</p>
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
              </div>
            )}
          </div>
        )}

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
                  <span className="text-xs text-black dark:text-white shrink-0">{row.label}</span>
                  <span className="text-xs font-semibold text-foreground text-right capitalize">{row.value}</span>
                </div>
              ))}
            </div>
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
          <div className="flex items-center justify-between mb-4">
            <Eyebrow>Due diligence readiness</Eyebrow>
            <span className="text-xs font-bold mb-3" style={{ color: score > 2 ? "#065F46" : "#92400E" }}>{score} of 5 docs ready</span>
          </div>
          <div className="h-1.5 rounded-full mb-4 overflow-hidden bg-muted">
            <div className="h-full rounded-full transition-all" style={{ width: `${(score / 5) * 100}%`, background: score > 2 ? "#2D6A4F" : "#C45C26" }} />
          </div>
          {score === 0 ? (
            <p className="text-xs text-black dark:text-white">No documents confirmed ready yet.</p>
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

        {(org.partnership_theory_of_change || org.partnership_prior_attempts || org.partnership_constraints) && (
          <div className="px-8 py-6">
            <Eyebrow>Context</Eyebrow>
            <div className="grid grid-cols-3 gap-3">
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
          </div>
        )}

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
                  <p className="text-sm text-foreground leading-relaxed mt-1">{org.partnership_prior_experience_detail}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {org.website && org.website !== "https://" && (
          <div className="px-8 py-4">
            <a href={org.website} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2D6A4F] hover:underline">
              <ArrowUpRight className="w-3.5 h-3.5" />
              {org.website.replace(/^https?:\/\//, "")}
            </a>
          </div>
        )}

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
                {openingMsg && !msgEditing && (
                  <div className="rounded-xl p-4 space-y-2 bg-muted border border-border">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-black uppercase tracking-widest text-black dark:text-white">AI-drafted opening message</p>
                      <button type="button" onClick={() => setMsgEditing(true)}
                        className="text-[10px] font-semibold text-muted-foreground hover:text-foreground underline underline-offset-2">
                        Edit
                      </button>
                    </div>
                    <p className="text-xs text-foreground leading-relaxed">{openingMsg}</p>                  </div>
                )}
                {msgEditing && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-black uppercase tracking-widest text-black dark:text-white">Edit opening message</p>
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