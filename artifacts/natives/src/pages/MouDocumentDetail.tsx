import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { jsPDF } from "jspdf";
import { BRICOLAGE_GROTESQUE_BOLD_BASE64 } from "@/lib/fonts/bricolageGrotesqueBold";
import { X, Loader2, Download, Upload, CheckCircle2, Send } from "lucide-react";
import SignaturePad from "@/components/dashboard/SignaturePad";

// ─── Types ────────────────────────────────────────────────────────────────────
interface SectionVariant { toggle_value: string | boolean | null; body: string }
interface TemplateSection { id: string; title: string; toggle_key: string | null; variants: SectionVariant[] }
interface MouTemplate { id: string; name: string; sections: TemplateSection[] }

interface OrgFull {
  id: string;
  user_id: string;
  organisation_name: string;
  country: string | string[] | null;
  organisation_type: string | null;
  partnership_budget?: string | null;
}

interface MouDoc {
  id: string;
  org_a_id: string;
  org_b_id: string;
  initiative_id: string | null;
  source_type: "template" | "custom" | "uploaded_pdf";
  template_id: string | null;
  toggle_selections: Record<string, string | boolean> | null;
  field_values: Record<string, string> | null;
  custom_content: string | null;
  rendered_file_path: string | null;
  status: "draft" | "sent" | "signed_by_org_a" | "signed_by_org_b" | "fully_executed";
  signed_files: Record<string, string> | null;
  signature_org_a_path: string | null;
  signature_org_b_path: string | null;
  signed_at_org_a: string | null;
  signed_at_org_b: string | null;
  created_by: string;
}

interface Props {
  documentId: string;
  myUserId: string;
  onClose: () => void;
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  draft: { label: "Draft", color: "#C45C26" },
  sent: { label: "Sent — awaiting signatures", color: "#C45C26" },
  signed_by_org_a: { label: "Signed by one party", color: "#2D6A4F" },
  signed_by_org_b: { label: "Signed by one party", color: "#2D6A4F" },
  fully_executed: { label: "Fully executed", color: "#2D6A4F" },
};

function fieldKeysIn(text: string): string[] {
  const matches = text.match(/\{\{(\w+)\}\}/g) ?? [];
  return matches.map((m) => m.slice(2, -2));
}

export default function MouDocumentDetail({ documentId, myUserId, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [doc, setDoc] = useState<MouDoc | null>(null);
  const [template, setTemplate] = useState<MouTemplate | null>(null);
  const [orgA, setOrgA] = useState<OrgFull | null>(null);
  const [orgB, setOrgB] = useState<OrgFull | null>(null);
  const [initiative, setInitiative] = useState<{ title: string; problem: string | null } | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [customContent, setCustomContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingSigned, setUploadingSigned] = useState(false);
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string | null>(null);
  const [signatureAUrl, setSignatureAUrl] = useState<string | null>(null);
  const [signatureBUrl, setSignatureBUrl] = useState<string | null>(null);
  const [signatureAImg, setSignatureAImg] = useState<HTMLImageElement | null>(null);
  const [signatureBImg, setSignatureBImg] = useState<HTMLImageElement | null>(null);
  const [capturedSignature, setCapturedSignature] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);

  useEffect(() => { load(); }, [documentId]);

  async function load() {
    setLoading(true);
    const { data: docRow } = await supabase.from("mou_documents").select("*").eq("id", documentId).maybeSingle();
    if (!docRow) { setLoading(false); return; }
    setDoc(docRow as MouDoc);
    setFieldValues((docRow.field_values as Record<string, string>) ?? {});
    setCustomContent(docRow.custom_content ?? "");

    const [{ data: orgRows }, initRes] = await Promise.all([
      supabase.from("organizations").select("id, user_id, organisation_name, country, organisation_type, partnership_budget")
        .in("id", [docRow.org_a_id, docRow.org_b_id]),
      docRow.initiative_id
        ? supabase.from("initiative_requests").select("title, problem").eq("id", docRow.initiative_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    const a = (orgRows ?? []).find((o: any) => o.id === docRow.org_a_id) ?? null;
    const b = (orgRows ?? []).find((o: any) => o.id === docRow.org_b_id) ?? null;
    setOrgA(a);
    setOrgB(b);
    setInitiative((initRes as any)?.data ?? null);

    if (docRow.source_type === "template" && docRow.template_id) {
      const { data: tpl } = await supabase.from("mou_templates").select("id, name, sections").eq("id", docRow.template_id).maybeSingle();
      setTemplate(tpl as MouTemplate);
    }

    if (docRow.source_type === "uploaded_pdf" && docRow.rendered_file_path) {
      const { data: signedUrlData } = await supabase.storage.from("mou-documents").createSignedUrl(docRow.rendered_file_path, 3600);
      setUploadedFileUrl(signedUrlData?.signedUrl ?? null);
    }

    if (docRow.signature_org_a_path) {
      const { data } = await supabase.storage.from("mou-documents").createSignedUrl(docRow.signature_org_a_path, 3600);
      if (data?.signedUrl) setSignatureAUrl(data.signedUrl);
    }
    if (docRow.signature_org_b_path) {
      const { data } = await supabase.storage.from("mou-documents").createSignedUrl(docRow.signature_org_b_path, 3600);
      if (data?.signedUrl) setSignatureBUrl(data.signedUrl);
    }

    setLoading(false);
  }

  // Preload signature images as actual <img> elements ahead of time so
  // exportPdf() can composite them synchronously via doc.addImage() --
  // jsPDF needs a loaded image, not just a URL string.
  useEffect(() => {
    if (signatureAUrl) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => setSignatureAImg(img);
      img.src = signatureAUrl;
    }
  }, [signatureAUrl]);
  useEffect(() => {
    if (signatureBUrl) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => setSignatureBImg(img);
      img.src = signatureBUrl;
    }
  }, [signatureBUrl]);

  // Known field_keys mapped to real platform data — anything not in this map
  // stays blank for manual entry rather than guessed at.
  const autofill = useMemo((): Record<string, string> => {
    if (!orgA || !orgB) return {};
    const countryOf = (c: string | string[] | null) => Array.isArray(c) ? c[0] ?? "" : c ?? "";
    return {
      org_a_name: orgA.organisation_name ?? "",
      org_b_name: orgB.organisation_name ?? "",
      org_a_country: countryOf(orgA.country),
      org_b_country: countryOf(orgB.country),
      org_a_entity_type: orgA.organisation_type?.replace(/_/g, " ") ?? "",
      org_b_entity_type: orgB.organisation_type?.replace(/_/g, " ") ?? "",
      project_name: initiative?.title ?? "",
      project_description: initiative?.problem ?? "",
      financial_amount: orgA.partnership_budget ?? orgB.partnership_budget ?? "",
    };
  }, [orgA, orgB, initiative]);

  const compiledSections = useMemo(() => {
    if (!doc || !template) return [];
    const selections = doc.toggle_selections ?? {};
    return template.sections
      .map((s) => {
        const variant = s.toggle_key
          ? s.variants.find((v) => v.toggle_value === selections[s.toggle_key!])
          : s.variants[0];
        return variant ? { id: s.id, title: s.title, body: variant.body } : null;
      })
      .filter((s): s is { id: string; title: string; body: string } => s !== null);
  }, [doc, template]);

  const allFieldKeys = useMemo(() => {
    const keys = new Set<string>();
    compiledSections.forEach((s) => fieldKeysIn(s.body).forEach((k) => keys.add(k)));
    return Array.from(keys);
  }, [compiledSections]);
  // Group fields by party so the form reads as three sections instead of
  // one flat list, and strip the org_a_/org_b_ prefix from the in-section
  // label -- the section header already names the party.
  const groupedFieldKeys = useMemo(() => {
    const orgAKeys: string[] = [];
    const orgBKeys: string[] = [];
    const otherKeys: string[] = [];
    allFieldKeys.forEach((key) => {
      if (key.startsWith("org_a_")) orgAKeys.push(key);
      else if (key.startsWith("org_b_")) orgBKeys.push(key);
      else otherKeys.push(key);
    });
    return { orgAKeys, orgBKeys, otherKeys };
  }, [allFieldKeys]);
  function humanizeFieldLabel(key: string): string {
    const stripped = key.replace(/^org_[ab]_/, "");
    const words = stripped.replace(/_/g, " ");
    return words.charAt(0).toUpperCase() + words.slice(1);
  }
  function isDateField(key: string): boolean {
    return key.endsWith("_date");
  }
  function resolvedValue(key: string): string {
    return fieldValues[key] || autofill[key] || "";
  }

  function renderCompiledText(body: string): string {
    return body.replace(/\{\{(\w+)\}\}/g, (_, key) => resolvedValue(key) || `[${key}]`);
  }
  function renderFieldInput(key: string) {
    const manualValue = fieldValues[key];
    const isPrefilled = !manualValue && !!autofill[key];
    const value = manualValue ?? autofill[key] ?? "";
    return (
      <div key={key}>
        <label className="text-sm font-medium text-black dark:text-white block mb-1">
          {humanizeFieldLabel(key)}
        </label>
        <input
          type={isDateField(key) ? "date" : "text"}
          value={value}
          onChange={(e) => setFieldValues((prev) => ({ ...prev, [key]: e.target.value }))}
          className="w-full h-10 px-3 rounded-lg border border-border bg-white dark:bg-card text-base text-black dark:text-white focus:outline-none focus:border-[#2D6A4F]/50"
        />
        {isPrefilled && (
          <p className="text-sm text-black/60 dark:text-white/60 mt-1">Prefilled from profile — check it's correct</p>
        )}
      </div>
    );
  }

  

  async function saveFieldValues() {
    if (!doc) return;
    setSaving(true);
    await supabase.from("mou_documents").update({
      field_values: fieldValues, updated_at: new Date().toISOString(),
    }).eq("id", doc.id);
    setSaving(false);
  }

  async function saveCustomContent() {
    if (!doc) return;
    setSaving(true);
    await supabase.from("mou_documents").update({
      custom_content: customContent, updated_at: new Date().toISOString(),
    }).eq("id", doc.id);
    setSaving(false);
  }

  async function markSent() {
    if (!doc) return;
    setSaving(true);
    await supabase.from("mou_documents").update({ status: "sent", updated_at: new Date().toISOString() }).eq("id", doc.id);
    setDoc({ ...doc, status: "sent" });
    setSaving(false);
  }

  function dataUrlToBlob(dataUrl: string): Blob {
    const [header, base64] = dataUrl.split(",");
    const mime = header.match(/:(.*?);/)?.[1] ?? "image/png";
    const bytes = atob(base64);
    const array = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) array[i] = bytes.charCodeAt(i);
    return new Blob([array], { type: mime });
  }

  async function confirmSignature() {
    if (!doc || !orgA || !orgB || !capturedSignature) return;
    setSigning(true);
    const myOrgId = orgA.user_id === myUserId ? orgA.id : orgB.user_id === myUserId ? orgB.id : null;
    if (!myOrgId) { setSigning(false); return; }

    const path = `signatures/${doc.id}/${myOrgId}-${Date.now()}.png`;
    const { error: uploadError } = await supabase.storage
      .from("mou-documents").upload(path, dataUrlToBlob(capturedSignature));
    if (uploadError) { setSigning(false); return; }

    const isOrgA = myOrgId === doc.org_a_id;
    const updates: Partial<MouDoc> & Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (isOrgA) {
      updates.signature_org_a_path = path;
      updates.signed_at_org_a = new Date().toISOString();
    } else {
      updates.signature_org_b_path = path;
      updates.signed_at_org_b = new Date().toISOString();
    }
    const otherAlreadySigned = isOrgA ? !!doc.signature_org_b_path : !!doc.signature_org_a_path;
    updates.status = otherAlreadySigned ? "fully_executed" : (doc.status === "draft" ? "sent" : doc.status);

    await supabase.from("mou_documents").update(updates).eq("id", doc.id);
    setDoc({ ...doc, ...updates } as MouDoc);
    setCapturedSignature(null);
    setSigning(false);
    load();
  }

  async function uploadSignedCopy(file: File) {
    if (!doc || !orgA || !orgB) return;
    setUploadingSigned(true);
    // Match the logged-in user to their actual org by user_id, not by
    // guessing from who created the document — the creator and uploader
    // can be different people on the same side, or either party at all.
    const myOrgId = orgA.user_id === myUserId ? orgA.id : orgB.user_id === myUserId ? orgB.id : null;
    if (!myOrgId) { setUploadingSigned(false); return; }
    const path = `signed/${doc.id}/${myUserId}-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
    const { error: uploadError } = await supabase.storage.from("mou-documents").upload(path, file);
    if (uploadError) { setUploadingSigned(false); return; }

    const updatedSignedFiles = { ...(doc.signed_files ?? {}), [myOrgId]: path };
    const bothSigned = updatedSignedFiles[doc.org_a_id] && updatedSignedFiles[doc.org_b_id];
    const newStatus = bothSigned ? "fully_executed" : (doc.status === "draft" ? "sent" : doc.status);

    await supabase.from("mou_documents").update({
      signed_files: updatedSignedFiles, status: newStatus, updated_at: new Date().toISOString(),
    }).eq("id", doc.id);
    setDoc({ ...doc, signed_files: updatedSignedFiles, status: newStatus as MouDoc["status"] });
    setUploadingSigned(false);
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

  function exportPdf() {
    if (!doc || !orgA || !orgB) return;
    const pdf = new jsPDF({ unit: "pt", format: "a4", floatPrecision: 2 });
    pdf.addFileToVFS("BricolageGrotesque-Bold.ttf", BRICOLAGE_GROTESQUE_BOLD_BASE64);
    pdf.addFont("BricolageGrotesque-Bold.ttf", "Bricolage", "bold");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 48;
    const contentWidth = pageWidth - margin * 2;
    let y = margin;

    const FOREST_GREEN: [number, number, number] = [45, 106, 79];
    const BLACK: [number, number, number] = [17, 17, 17];

    function ensureSpace(neededHeight: number) {
      if (y + neededHeight > pageHeight - margin) { pdf.addPage(); y = margin; }
    }

    function writeParagraph(text: string, opts: { size?: number; bold?: boolean; gap?: number } = {}) {
      const size = opts.size ?? 10.5;
      pdf.setFont("helvetica", opts.bold ? "bold" : "normal");
      pdf.setFontSize(size);
      pdf.setTextColor(...BLACK);
      const lines: string[] = pdf.splitTextToSize(text, contentWidth);
      const lineHeight = size * 1.4;
      ensureSpace(lines.length * lineHeight);
      lines.forEach((line, i) => pdf.text(line, margin, y + i * lineHeight));
      y += lines.length * lineHeight + (opts.gap ?? 14);
    }

    function writeSectionHeader(text: string) {
      ensureSpace(24);
      pdf.setFont("Bricolage", "bold");
      pdf.setFontSize(11);
      pdf.setTextColor(...FOREST_GREEN);
      pdf.text(text.toUpperCase(), margin, y);
      y += 6;
      pdf.setDrawColor(...FOREST_GREEN);
      pdf.setLineWidth(0.75);
      pdf.line(margin, y, margin + 36, y);
      y += 14;
    }

    pdf.setFont("Bricolage", "bold");
    pdf.setFontSize(18);
    pdf.setTextColor(...FOREST_GREEN);
    pdf.text("Memorandum of Understanding", margin, y);
    y += 24;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);
    pdf.setTextColor(...BLACK);
    pdf.text(sanitizeForPdf(`${orgA.organisation_name} & ${orgB.organisation_name}`), margin, y);
    y += 24;

    if (doc.source_type === "custom") {
      writeParagraph(sanitizeForPdf(customContent) || "No content added yet.");
    } else {
      compiledSections.forEach((s) => {
        writeSectionHeader(s.title);
        writeParagraph(sanitizeForPdf(renderCompiledText(s.body)));
      });
    }

    // Signature block — composites the actual captured signature images at
    // fixed coordinates. This only works because Impact Natives controls
    // this document's layout end to end; an uploaded external PDF's layout
    // is unknown, so that path keeps the sign-externally-and-upload-back
    // flow instead of attempting to composite onto it.
    ensureSpace(120);
    writeSectionHeader("Signatures");
    const sigWidth = 140;
    const sigHeight = 45;
    const colGap = 40;
    const colWidth = (contentWidth - colGap) / 2;
    const sigY = y;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(...BLACK);
    pdf.text(sanitizeForPdf(orgA.organisation_name), margin, sigY);
    pdf.text(sanitizeForPdf(orgB.organisation_name), margin + colWidth + colGap, sigY);

    if (signatureAImg) {
      pdf.addImage(signatureAImg, "PNG", margin, sigY + 8, sigWidth, sigHeight);
    } else {
      pdf.setDrawColor(...BLACK);
      pdf.line(margin, sigY + 8 + sigHeight, margin + sigWidth, sigY + 8 + sigHeight);
    }
    if (signatureBImg) {
      pdf.addImage(signatureBImg, "PNG", margin + colWidth + colGap, sigY + 8, sigWidth, sigHeight);
    } else {
      pdf.setDrawColor(...BLACK);
      pdf.line(margin + colWidth + colGap, sigY + 8 + sigHeight, margin + colWidth + colGap + sigWidth, sigY + 8 + sigHeight);
    }
    y = sigY + 8 + sigHeight + 14;

    pdf.setFontSize(8.5);
    pdf.text(doc.signed_at_org_a ? `Signed ${new Date(doc.signed_at_org_a).toLocaleDateString("en-GB")}` : "Not yet signed", margin, y);
    pdf.text(doc.signed_at_org_b ? `Signed ${new Date(doc.signed_at_org_b).toLocaleDateString("en-GB")}` : "Not yet signed", margin + colWidth + colGap, y);
    y += 20;

    const pageCount = pdf.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(120, 120, 120);
      pdf.text("Generated via Impact Natives — review before signing", margin, pageHeight - 24);
      pdf.text(`${i} / ${pageCount}`, pageWidth - margin - 24, pageHeight - 24);
    }

    pdf.save(`MoU-${sanitizeForPdf(orgA.organisation_name)}-${sanitizeForPdf(orgB.organisation_name)}.pdf`);
  }

  if (loading || !doc) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <Loader2 className="w-6 h-6 text-[#2D6A4F] animate-spin" />
      </div>
    );
  }

  const statusInfo = STATUS_LABEL[doc.status];
  const iAmCreator = myUserId === doc.created_by;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/50 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}>
      <div className="bg-white dark:bg-card rounded-2xl border border-border w-full max-w-2xl shadow-xl flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}>

        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-lg font-bold text-black dark:text-white">
              MoU — {orgA?.organisation_name} & {orgB?.organisation_name}
            </h2>
            <span className="inline-flex items-center gap-1.5 mt-1 text-sm font-medium text-black dark:text-white">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusInfo.color }} />
              {statusInfo.label}
            </span>
          </div>
          <button type="button" onClick={onClose} className="text-black dark:text-white hover:text-[#2D6A4F] transition-colors shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 sm:px-6 py-5 overflow-y-auto space-y-6">

          {/* Template: fillable fields */}
          {doc.source_type === "template" && (
            <>
              {allFieldKeys.length > 0 && (
                <div className="space-y-5">
                  <div>
                    <p className="text-base font-semibold text-black dark:text-white">Fill in the details</p>
                    <p className="text-sm text-black dark:text-white">
                      Some fields are pre-filled from your profiles. Review and complete the rest.
                    </p>
                  </div>
                  {groupedFieldKeys.orgAKeys.length > 0 && (
                    <div className="rounded-xl border border-border p-4 space-y-3">
                      <p className="text-sm font-semibold text-[#2D6A4F] uppercase tracking-wide">
                        {orgA?.organisation_name || "Your organisation"}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {groupedFieldKeys.orgAKeys.map((key) => renderFieldInput(key))}
                      </div>
                    </div>
                  )}
                  {groupedFieldKeys.orgBKeys.length > 0 && (
                    <div className="rounded-xl border border-border p-4 space-y-3">
                      <p className="text-sm font-semibold text-[#2D6A4F] uppercase tracking-wide">
                        {orgB?.organisation_name || "Partner organisation"}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {groupedFieldKeys.orgBKeys.map((key) => renderFieldInput(key))}
                      </div>
                    </div>
                  )}
                  {groupedFieldKeys.otherKeys.length > 0 && (
                    <div className="rounded-xl border border-border p-4 space-y-3">
                      <p className="text-sm font-semibold text-[#2D6A4F] uppercase tracking-wide">
                        Agreement details
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {groupedFieldKeys.otherKeys.map((key) => renderFieldInput(key))}
                      </div>
                    </div>
                  )}
                  <button type="button" onClick={saveFieldValues} disabled={saving}
                    className="text-sm text-black dark:text-white hover:underline underline-offset-2 disabled:opacity-60">
                    {saving ? "Saving..." : "Save field values"}
                  </button>
                </div>
              )}

              <div className="space-y-4 border-t border-border pt-5">
                <p className="text-base font-semibold text-black dark:text-white">Document preview</p>
                {compiledSections.map((s) => (
                  <div key={s.id}>
                    <p className="text-sm font-semibold uppercase tracking-wide text-black dark:text-white mb-1">{s.title}</p>
                    <p className="text-base text-black dark:text-white leading-relaxed whitespace-pre-line">
                      {renderCompiledText(s.body)}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Custom: free text editor */}
          {doc.source_type === "custom" && (
            <div className="space-y-3">
              <p className="text-base font-semibold text-black dark:text-white">Document text</p>
              <textarea
                value={customContent}
                onChange={(e) => setCustomContent(e.target.value)}
                onBlur={saveCustomContent}
                rows={16}
                placeholder="Write the full text of your agreement here..."
                className="w-full px-4 py-3 rounded-xl border border-border bg-white dark:bg-card text-base text-black dark:text-white leading-relaxed focus:outline-none focus:border-[#2D6A4F]/50 resize-y"
              />
              {saving && <p className="text-sm text-black dark:text-white">Saving...</p>}
            </div>
          )}

          {/* Uploaded PDF */}
          {doc.source_type === "uploaded_pdf" && (
            <div className="space-y-3">
              <p className="text-base font-semibold text-black dark:text-white">Uploaded document</p>
              {uploadedFileUrl ? (
                <a href={uploadedFileUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-black dark:text-white hover:underline underline-offset-2 text-base">
                  <Download className="w-4 h-4" /> View original document
                </a>
              ) : (
                <p className="text-sm text-black dark:text-white">Could not load the document link.</p>
              )}
            </div>
          )}

          {/* Send / sign actions */}
          <div className="space-y-3 border-t border-border pt-5">
            <p className="text-base font-semibold text-black dark:text-white">Send & sign</p>

            {doc.status === "draft" && iAmCreator && (
              <button type="button" onClick={markSent} disabled={saving}
                className="w-full flex items-center justify-center gap-2 bg-[#2D6A4F] hover:bg-[#245c43] text-white rounded-full py-3 text-base font-medium transition-colors disabled:opacity-60">
                <Send className="w-4 h-4" /> Mark as sent
              </button>
            )}

            {doc.status !== "draft" && doc.source_type === "uploaded_pdf" && (
              <div className="space-y-2">
                <p className="text-sm text-black dark:text-white">
                  This document was uploaded, so Impact Natives cannot place a signature onto it directly — sign it outside the platform, then upload each signed copy here.
                </p>
                <label className="flex items-center justify-center gap-2 cursor-pointer rounded-xl border border-dashed border-border px-4 py-4 text-base text-black dark:text-white hover:border-[#2D6A4F]/40 transition-colors">
                  {uploadingSigned ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  Upload your signed copy
                  <input type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    className="hidden" disabled={uploadingSigned}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadSignedCopy(f); }} />
                </label>
                <div className="flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1.5 text-black dark:text-white">
                    {doc.signed_files?.[doc.org_a_id] && <CheckCircle2 className="w-4 h-4" />}
                    {orgA?.organisation_name}: {doc.signed_files?.[doc.org_a_id] ? "Signed copy uploaded" : "Awaiting upload"}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1.5 text-black dark:text-white">
                    {doc.signed_files?.[doc.org_b_id] && <CheckCircle2 className="w-4 h-4" />}
                    {orgB?.organisation_name}: {doc.signed_files?.[doc.org_b_id] ? "Signed copy uploaded" : "Awaiting upload"}
                  </span>
                </div>
              </div>
            )}

            {doc.status !== "draft" && doc.source_type !== "uploaded_pdf" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-black dark:text-white mb-1">{orgA?.organisation_name}</p>
                    {signatureAUrl ? (
                      <div className="border border-border rounded-lg p-2 bg-white">
                        <img src={signatureAUrl} alt="Signature" className="h-14" />
                        <p className="text-sm text-black dark:text-white mt-1">
                          Signed {doc.signed_at_org_a ? new Date(doc.signed_at_org_a).toLocaleDateString("en-GB") : ""}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-black dark:text-white">Not yet signed</p>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-black dark:text-white mb-1">{orgB?.organisation_name}</p>
                    {signatureBUrl ? (
                      <div className="border border-border rounded-lg p-2 bg-white">
                        <img src={signatureBUrl} alt="Signature" className="h-14" />
                        <p className="text-sm text-black dark:text-white mt-1">
                          Signed {doc.signed_at_org_b ? new Date(doc.signed_at_org_b).toLocaleDateString("en-GB") : ""}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-black dark:text-white">Not yet signed</p>
                    )}
                  </div>
                </div>

                {orgA && orgB && (orgA.user_id === myUserId ? !signatureAUrl : orgB.user_id === myUserId ? !signatureBUrl : false) && (
                  <div className="border-t border-border pt-4 space-y-3">
                    <p className="text-base font-semibold text-black dark:text-white">Sign this document</p>
                    <SignaturePad onCapture={setCapturedSignature} disabled={signing} />
                    {capturedSignature && (
                      <button type="button" onClick={confirmSignature} disabled={signing}
                        className="w-full flex items-center justify-center gap-2 bg-[#2D6A4F] hover:bg-[#245c43] text-white rounded-full py-3 text-base font-medium transition-colors disabled:opacity-60">
                        {signing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm signature"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Export */}
          {doc.source_type !== "uploaded_pdf" && (
            <button type="button" onClick={exportPdf}
              className="w-full flex items-center justify-center gap-2 border border-border rounded-full py-3 text-base font-medium text-black dark:text-white hover:border-[#2D6A4F]/50 transition-colors">
              <Download className="w-4 h-4" /> Export as PDF
            </button>
          )}
        </div>
      </div>
    </div>
  );
}