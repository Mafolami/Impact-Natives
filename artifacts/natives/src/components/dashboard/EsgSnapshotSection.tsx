// src/components/dashboard/EsgSnapshotSection.tsx
//
// Self-contained "Generate ESG Snapshot" button + result modal + PDF export.
// Used by both DashboardNatives.tsx (viewing another org's public profile)
// and DashboardProfile.tsx (an org previewing its own snapshot). Kept in one
// place so the jsPDF precision fix, the WinAnsi text sanitizer, and the
// Bricolage Grotesque font embed never drift out of sync between the two
// call sites — all three were real bugs found and fixed the hard way once
// already; duplicating this logic risks re-introducing them in only one copy.

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { jsPDF } from "jspdf";
import { supabase } from "@/lib/supabase";
import { BRICOLAGE_GROTESQUE_BOLD_BASE64 } from "@/lib/fonts/bricolageGrotesqueBold";

export interface EsgSnapshotOrgInput {
  id: string;
  organisation_name?: string | null;
  organisation_type?: string | null;
  sector?: string | string[] | null;
  country?: string | string[] | null;
  dd_financial_model?: boolean;
  dd_audited_accounts?: boolean;
  dd_governance_doc?: boolean;
  dd_esg_assessment?: boolean;
  dd_impact_framework?: boolean;
  dd_environmental_policy?: boolean;
  dd_safeguarding_policy?: boolean;
  dd_legal_registration?: boolean;
  dd_legal_compliance_declaration?: boolean;
  dd_evidence?: Record<string, any> | null;
  total_beneficiaries_reached?: string | number | null;
  jobs_created?: string | number | null;
  female_beneficiaries_pct?: string | number | null;
  youth_beneficiaries_pct?: string | number | null;
  years_of_operation?: string | number | null;
  grants_received_count?: string | number | null;
  grants_total_value_usd?: string | number | null;
  grants_delivered_on_time_pct?: string | number | null;
  previous_funders?: string[] | null;
  third_party_evaluations?: boolean | null;
}

function toNum(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isNaN(n) ? null : n;
}

function joinIfArray(v: string | string[] | null | undefined): string | null {
  if (!v) return null;
  return Array.isArray(v) ? v.join(", ") || null : v;
}

export function EsgSnapshotSection({ org }: { org: EsgSnapshotOrgInput }) {
  const [deliveryStats, setDeliveryStats] = useState<{ completed: number; stalled: number; fell_through: number; resolved: number; total: number } | null>(null);
  const [esgReport, setEsgReport] = useState<Record<string, any> | null>(null);
  const [esgReportLoading, setEsgReportLoading] = useState(false);
  const [esgReportError, setEsgReportError] = useState(false);

  useEffect(() => {
    setEsgReport(null);
    setEsgReportLoading(false);
    setEsgReportError(false);
  }, [org.id]);

  useEffect(() => {
    if (!org.id) return;
    supabase.rpc("get_org_delivery_stats", { target_org_id: org.id })
      .then(({ data }) => { if (data?.[0]) setDeliveryStats(data[0]); });
  }, [org.id]);

  async function generateEsgReport() {
    setEsgReportLoading(true);
    setEsgReportError(false);
    try {
      const legalEvidence = org.dd_evidence?.legal_compliance_declaration ?? {};
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-esg-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}` },
        body: JSON.stringify({
          org: {
            organisation_name: org.organisation_name,
            organisation_type: org.organisation_type,
            sector: joinIfArray(org.sector),
            country: joinIfArray(org.country),
          },
          dd_readiness: {
            financial_model: org.dd_financial_model,
            audited_accounts: org.dd_audited_accounts,
            governance_doc: org.dd_governance_doc,
            esg_assessment: org.dd_esg_assessment,
            impact_framework: org.dd_impact_framework,
            environmental_policy: org.dd_environmental_policy,
            safeguarding_policy: org.dd_safeguarding_policy,
            legal_registration: org.dd_legal_registration,
            legal_compliance_declaration: org.dd_legal_compliance_declaration,
            has_blacklisting: legalEvidence.hasBlacklisting ?? null,
            has_pending_disputes: legalEvidence.hasPendingDisputes ?? null,
            has_conflicts: legalEvidence.conflictsToDisclose ?? null,
          },
          delivery: deliveryStats,
          track_record: {
            total_beneficiaries_reached: toNum(org.total_beneficiaries_reached),
            jobs_created: toNum(org.jobs_created),
            female_beneficiaries_pct: toNum(org.female_beneficiaries_pct),
            youth_beneficiaries_pct: toNum(org.youth_beneficiaries_pct),
            years_of_operation: toNum(org.years_of_operation),
            grants_received_count: toNum(org.grants_received_count),
            grants_total_value_usd: toNum(org.grants_total_value_usd),
            grants_delivered_on_time_pct: toNum(org.grants_delivered_on_time_pct),
            previous_funders: org.previous_funders,
            third_party_evaluations: org.third_party_evaluations,
          },
        }),
      });
      const result = await res.json();
      if (result.data) setEsgReport(result.data);
      else setEsgReportError(true);
    } catch {
      setEsgReportError(true);
    }
    setEsgReportLoading(false);
  }

  function sanitizeForPdf(text: string | null | undefined): string {
    if (!text) return "";
    return text
      .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
      .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
      .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015]/g, "-")
      .replace(/\u2026/g, "...")
      .replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, " ")
      .replace(/[^\x00-\x7E]/g, "");
  }

  function downloadEsgReportPdf() {
    if (!esgReport) return;
    const doc = new jsPDF({ unit: "pt", format: "a4", floatPrecision: 2 });
    doc.addFileToVFS("BricolageGrotesque-Bold.ttf", BRICOLAGE_GROTESQUE_BOLD_BASE64);
    doc.addFont("BricolageGrotesque-Bold.ttf", "Bricolage", "bold");
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 48;
    const contentWidth = pageWidth - margin * 2;
    let y = margin;

    const FOREST_GREEN: [number, number, number] = [45, 106, 79];
    const BLACK: [number, number, number] = [17, 17, 17];
    const GREY: [number, number, number] = [90, 90, 90];

    function ensureSpace(neededHeight: number) {
      if (y + neededHeight > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
    }

    function writeParagraph(text: string, opts: { size?: number; color?: [number, number, number]; bold?: boolean; gap?: number; italic?: boolean } = {}) {
      const size = opts.size ?? 10.5;
      const color = opts.color ?? BLACK;
      doc.setFont("helvetica", opts.bold ? "bold" : opts.italic ? "italic" : "normal");
      doc.setFontSize(size);
      doc.setTextColor(...color);
      const lines: string[] = doc.splitTextToSize(text, contentWidth);
      const lineHeight = size * 1.35;
      ensureSpace(lines.length * lineHeight);
      lines.forEach((line, i) => {
        doc.text(line, margin, y + i * lineHeight);
      });
      y += lines.length * lineHeight + (opts.gap ?? 8);
    }

    function writeSectionHeader(text: string) {
      ensureSpace(24);
      doc.setFont("Bricolage", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...FOREST_GREEN);
      doc.text(text.toUpperCase(), margin, y);
      y += 6;
      doc.setDrawColor(...FOREST_GREEN);
      doc.setLineWidth(0.75);
      doc.line(margin, y, margin + 36, y);
      y += 14;
    }

    doc.setFont("Bricolage", "bold");
    doc.setFontSize(18);
    doc.setTextColor(...FOREST_GREEN);
    doc.text("ESG Snapshot", margin, y);
    y += 22;

    const safeOrgName = sanitizeForPdf(org.organisation_name ?? undefined) || "Organisation";
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.setTextColor(...BLACK);
    doc.text(safeOrgName, margin, y);
    y += 16;

    const generatedAt = new Date().toLocaleString("en-GB", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(...GREY);
    doc.text(`Generated on ${generatedAt} via Impact Natives`, margin, y);
    y += 20;

    const disclaimerText = sanitizeForPdf(`This snapshot summarises what ${safeOrgName} has disclosed on Impact Natives. It is not an independent audit or third-party verification. DD Readiness ${esgReport.dd_readiness_score}% complete. ${esgReport.delivery_has_data ? `Delivery: ${esgReport.delivery_rate}% of tracked relationships completed.` : "No completed delivery outcomes tracked yet."} Figures reflect this organisation's profile as of the generation date above and may change.`);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const disclaimerLines = doc.splitTextToSize(disclaimerText, contentWidth - 20);
    const disclaimerHeight = disclaimerLines.length * 12.5 + 16;
    ensureSpace(disclaimerHeight);
    doc.setFillColor(245, 240, 232);
    doc.roundedRect(margin, y, contentWidth, disclaimerHeight, 4, 4, "F");
    doc.setTextColor(...GREY);
    const disclaimerLineHeight = 12.5;
    disclaimerLines.forEach((line: string, i: number) => {
      doc.text(line, margin + 10, y + 16 + i * disclaimerLineHeight);
    });
    y += disclaimerHeight + 22;

    writeSectionHeader("Environmental");
    writeParagraph(sanitizeForPdf(esgReport.environmental) || "Not provided.", { gap: 18 });

    writeSectionHeader("Social");
    writeParagraph(sanitizeForPdf(esgReport.social) || "Not provided.", { gap: 18 });

    writeSectionHeader("Governance");
    writeParagraph(sanitizeForPdf(esgReport.governance) || "Not provided.", { gap: 18 });

    if (esgReport.data_gaps?.length > 0) {
      writeSectionHeader("Data gaps");
      esgReport.data_gaps.forEach((gap: string) => {
        writeParagraph(`•  ${sanitizeForPdf(gap)}`, { gap: 4, size: 10 });
      });
      y += 10;
    }

    writeSectionHeader("Summary");
    writeParagraph(sanitizeForPdf(esgReport.summary), { gap: 8 });

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7.5);
      doc.setTextColor(...GREY);
      doc.text("Impact Natives — self-disclosed data, not an independent audit", margin, pageHeight - 24);
      doc.text(`${i} / ${pageCount}`, pageWidth - margin - 24, pageHeight - 24);
    }

    const safeName = (org.organisation_name ?? "organisation").replace(/[^a-z0-9]+/gi, "_").toLowerCase();
    doc.save(`esg-snapshot-${safeName}.pdf`);
  }

  return (
    <>
      <div className="px-8 sm:px-12 py-10">
        <p className="text-xl font-bold text-[#111111] dark:text-[#F5F5F5] mb-3">ESG Snapshot</p>
        <button type="button" onClick={generateEsgReport} disabled={esgReportLoading}
          className="px-3.5 h-8 rounded-lg border border-border/70 text-xs font-medium text-black/70 dark:text-white/70 hover:border-[#2D6A4F] hover:text-black dark:hover:text-white transition-colors disabled:opacity-50 inline-flex items-center gap-1.5">
          {esgReportLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
          {esgReportLoading ? "Generating..." : "Generate snapshot"}
        </button>
        {esgReportError && (
          <p className="text-sm text-red-500 mt-2">Couldn't generate the snapshot. Try again.</p>
        )}
      </div>

      {esgReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEsgReport(null)}>
          <div className="bg-white dark:bg-card rounded-2xl border border-border w-full max-w-lg p-6 space-y-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div>
              <h3 className="text-lg font-bold text-black dark:text-white">ESG Snapshot</h3>
              <p className="text-sm text-black dark:text-white mt-1">{esgReport.headline}</p>
            </div>
            <p className="text-xs text-black dark:text-white opacity-70">
              A summary of what {org.organisation_name} has disclosed on this platform — not an independent audit. DD Readiness {esgReport.dd_readiness_score}% complete. {esgReport.delivery_has_data ? `Delivery: ${esgReport.delivery_rate}% of tracked relationships completed.` : "No completed delivery outcomes tracked yet."}
            </p>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-black dark:text-white mb-1">Environmental</p>
              <p className="text-sm text-black dark:text-white leading-relaxed">{esgReport.environmental}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-black dark:text-white mb-1">Social</p>
              <p className="text-sm text-black dark:text-white leading-relaxed">{esgReport.social}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-black dark:text-white mb-1">Governance</p>
              <p className="text-sm text-black dark:text-white leading-relaxed">{esgReport.governance}</p>
            </div>
            {esgReport.data_gaps?.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-black dark:text-white mb-1">Data gaps</p>
                <ul className="text-sm text-black dark:text-white leading-relaxed list-disc pl-4 space-y-0.5">
                  {esgReport.data_gaps.map((g: string, i: number) => <li key={i}>{g}</li>)}
                </ul>
              </div>
            )}
            <div className="pt-3 border-t border-border">
              <p className="text-sm text-black dark:text-white leading-relaxed">{esgReport.summary}</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={downloadEsgReportPdf}
                className="flex-1 h-9 rounded-full bg-[#2D6A4F] text-white text-sm font-medium hover:opacity-90 transition-opacity">
                Download PDF
              </button>
              <button type="button" onClick={() => setEsgReport(null)}
                className="flex-1 h-9 rounded-full border border-border text-sm text-muted-foreground hover:text-foreground transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}