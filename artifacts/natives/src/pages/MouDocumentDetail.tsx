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
interface FieldFlag {
  id: string;
  field_key: string;
  note: string;
  raised_by: "org_a" | "org_b";
  resolved: boolean;
  created_at: string;
}

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
  final_document_path: string | null;
  signature_locked_org_a: boolean;
  signature_locked_org_b: boolean;
  edited_sections: { id: string; title: string; body: string }[] | null;
  details_completed_by_org_a: boolean;
  details_completed_at_org_a: string | null;
  field_flags: FieldFlag[];
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
  const [signing, setSigning] = useState(false);
  const [redrawingSignature, setRedrawingSignature] = useState(false);
  const [openFlagField, setOpenFlagField] = useState<string | null>(null);
  const [flagNote, setFlagNote] = useState("");
  const isViewerOrgA = orgA?.user_id === myUserId;
  const isViewerOrgB = orgB?.user_id === myUserId;
  useEffect(() => { load(); }, [documentId]);

  async function load(opts: { silent?: boolean } = {}) {
    if (!opts.silent) setLoading(true);
    const { data: docRow } = await supabase.from("mou_documents").select("*").eq("id", documentId).maybeSingle();
    if (!docRow) { if (!opts.silent) setLoading(false); return; }
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
    } else {
      setSignatureAUrl(null);
    }
    if (docRow.signature_org_b_path) {
      const { data } = await supabase.storage.from("mou-documents").createSignedUrl(docRow.signature_org_b_path, 3600);
      if (data?.signedUrl) setSignatureBUrl(data.signedUrl);
    } else {
      setSignatureBUrl(null);
    }
    if (!opts.silent) setLoading(false);
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
  function titleCase(text: string): string {
    return text.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  }
  const autofill = useMemo((): Record<string, string> => {
    if (!orgA || !orgB) return {};
    // organizations.country is a JSON-encoded array string for multi-select
    // country fields (e.g. '["Nigeria","United Kingdom"]'), not a real JS
    // array -- Array.isArray() on it was always false, so the raw string
    // rendered straight into the field.
    const countryOf = (c: string | string[] | null): string => {
      if (!c) return "";
      if (Array.isArray(c)) return c[0] ?? "";
      try {
        const parsed = JSON.parse(c);
        if (Array.isArray(parsed)) return parsed[0] ?? "";
      } catch {
        // not JSON -- c is already a plain country string
      }
      return c;
    };
    return {
      org_a_name: orgA.organisation_name ?? "",
      org_b_name: orgB.organisation_name ?? "",
      org_a_country: countryOf(orgA.country),
      org_b_country: countryOf(orgB.country),
      org_a_entity_type: orgA.organisation_type ? titleCase(orgA.organisation_type.replace(/_/g, " ")) : "",
      org_b_entity_type: orgB.organisation_type ? titleCase(orgB.organisation_type.replace(/_/g, " ")) : "",
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
      // "signatures" is flat placeholder text ("Signature: __ Name: __")
      // from the template -- fully superseded by the real signature block
      // (actual captured images, names, titles, dates) rendered separately.
      .filter((s): s is { id: string; title: string; body: string } => s !== null && s.id !== "signatures");
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
  // Force start_date/end_date to the front of the grid so they always land
  // in the same row as each other, regardless of where they appear in the
  // template's placeholder order.
  const orderedOtherKeys = useMemo(() => {
    const keys = [...groupedFieldKeys.otherKeys];
    const priority = ["start_date", "end_date"];
    const front = priority.filter((k) => keys.includes(k));
    const rest = keys.filter((k) => !priority.includes(k));
    return [...front, ...rest];
  }, [groupedFieldKeys.otherKeys]);
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
  // Scoped to whichever party is actually looking -- Org A is never told
  // to fill Org B's fields, and vice versa.
  const missingFieldLabels = useMemo(() => {
    if (doc?.source_type !== "template") return [];
    const myKeys = isViewerOrgA
      ? [...groupedFieldKeys.orgAKeys, ...orderedOtherKeys]
      : isViewerOrgB
      ? groupedFieldKeys.orgBKeys
      : allFieldKeys;
    return myKeys
      .filter((k) => !(fieldValues[k] || autofill[k] || "").trim())
      .map((k) => humanizeFieldLabel(k));
  }, [allFieldKeys, groupedFieldKeys, orderedOtherKeys, fieldValues, autofill, doc?.source_type, isViewerOrgA, isViewerOrgB]);
  function parseFieldDate(v: string): Date | null {
    if (!v) return null;
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  const dateValidationErrors = useMemo(() => {
    const errors: string[] = [];
    const agreementDate = parseFieldDate(resolvedValue("agreement_date"));
    const startDate = parseFieldDate(resolvedValue("start_date"));
    const endDate = parseFieldDate(resolvedValue("end_date"));
    if (startDate && endDate && startDate > endDate) errors.push("Start date cannot be later than end date.");
    if (agreementDate && startDate && agreementDate > startDate) errors.push("Agreement date cannot be later than start date.");
    if (agreementDate && endDate && agreementDate > endDate) errors.push("Agreement date cannot be later than end date.");
    return errors;
  }, [fieldValues, autofill]);
  // Base text per section: the frozen edited_sections snapshot once one
  // exists, otherwise the live template + field-value recompute. Overrides
  // layer unsaved in-progress typing on top of whichever base is active.
  const [sectionOverrides, setSectionOverrides] = useState<Record<string, string>>({});
  const [savingSections, setSavingSections] = useState(false);
  const baseSections = useMemo(() => {
    if (doc?.edited_sections) return doc.edited_sections;
    return compiledSections.map((s) => ({ id: s.id, title: s.title, body: renderCompiledText(s.body) }));
  }, [doc?.edited_sections, compiledSections, fieldValues, autofill]);
  const displaySections = useMemo(
    () => baseSections.map((s) => ({ ...s, body: sectionOverrides[s.id] ?? s.body })),
    [baseSections, sectionOverrides]
  );
  const previewLocked = !!doc?.signature_org_a_path || !!doc?.signature_org_b_path;
  function handleSectionEdit(sectionId: string, value: string) {
    setSectionOverrides((prev) => ({ ...prev, [sectionId]: value }));
  }
  async function savePreviewEdits() {
    if (!doc) return;
    setSavingSections(true);
    const snapshot = displaySections;
    await supabase.from("mou_documents").update({
      edited_sections: snapshot, updated_at: new Date().toISOString(),
    }).eq("id", doc.id);
    setDoc({ ...doc, edited_sections: snapshot } as MouDoc);
    setSectionOverrides({});
    setSavingSections(false);
  }

  function renderCompiledText(body: string): string {
    return body.replace(/\{\{(\w+)\}\}/g, (_, key) => resolvedValue(key) || `[${key}]`);
  }
  function isDescriptionField(key: string): boolean {
    return key.endsWith("_description");
  }
  function fieldDateError(key: string): string | null {
    if (key === "start_date" && dateValidationErrors.some((e) => e.includes("Start date"))) return "Cannot be later than end date.";
    if (key === "agreement_date" && dateValidationErrors.some((e) => e.includes("Agreement date"))) return "Cannot be later than start or end date.";
    return null;
  }
  function renderFieldInput(key: string, readOnly: boolean = false) {
    const manualValue = fieldValues[key];
    const value = manualValue ?? autofill[key] ?? "";
    const dateError = isDateField(key) ? fieldDateError(key) : null;
    if (readOnly) {
      return (
        <div key={key}>
          <label className="text-sm font-medium text-black dark:text-white block mb-1">
            {humanizeFieldLabel(key)}
          </label>
          <p className="text-base text-black dark:text-white bg-muted/20 rounded-lg px-3 py-2 min-h-[2.5rem] whitespace-pre-line">
            {value || "—"}
          </p>
        </div>
      );
    }
    if (isDescriptionField(key)) {
      return (
        <div key={key}>
          <label className="text-sm font-medium text-black dark:text-white block mb-1">
            {humanizeFieldLabel(key)}
          </label>
          <textarea
            value={value}
            onChange={(e) => setFieldValues((prev) => ({ ...prev, [key]: e.target.value }))}
            rows={4}
            className="w-full px-3 py-2 rounded-lg border border-border bg-white dark:bg-card text-base text-black dark:text-white leading-relaxed focus:outline-none focus:border-[#2D6A4F]/50 resize-y"
          />
        </div>
      );
    }
    return (
      <div key={key}>
        <label className="text-sm font-medium text-black dark:text-white block mb-1">
          {humanizeFieldLabel(key)}
        </label>
        <input
          type={isDateField(key) ? "date" : "text"}
          value={value}
          onChange={(e) => setFieldValues((prev) => ({ ...prev, [key]: e.target.value }))}
          className={`w-full h-10 px-3 rounded-lg border bg-white dark:bg-card text-base text-black dark:text-white focus:outline-none ${
            dateError ? "border-red-500" : "border-border focus:border-[#2D6A4F]/50"
          }`}
        />
        {dateError && <p className="text-sm text-red-600 mt-1">{dateError}</p>}
      </div>
    );
  }
  function renderFlagsForField(key: string) {
    const flags = (doc?.field_flags ?? []).filter((f) => f.field_key === key);
    return (
      <div className="mt-1 space-y-1">
        {flags.map((f) => (
          <div key={f.id} className={`text-sm rounded-md px-2 py-1 ${f.resolved ? "bg-muted/20 text-black/60 dark:text-white/60" : "bg-amber-50 text-amber-800 border border-amber-200"}`}>
            <span>{f.note}</span>
            {!f.resolved && isViewerOrgA && (
              <button type="button" onClick={() => resolveFlag(f.id)} className="ml-2 underline underline-offset-2">
                Mark resolved
              </button>
            )}
            {f.resolved && <span className="ml-2 italic">Resolved</span>}
          </div>
        ))}
        {isViewerOrgB && doc?.details_completed_by_org_a && (
          openFlagField === key ? (
            <div className="flex gap-2 items-start">
              <input value={flagNote} onChange={(e) => setFlagNote(e.target.value)}
                placeholder="What needs clarifying?"
                className="flex-1 h-9 px-2 rounded-lg border border-border bg-white dark:bg-card text-sm text-black dark:text-white focus:outline-none focus:border-[#2D6A4F]/50" />
              <button type="button" onClick={async () => { await raiseFlag(key, flagNote); setFlagNote(""); setOpenFlagField(null); }}
                className="text-sm px-3 py-1.5 rounded-full bg-[#2D6A4F] hover:bg-[#245c43] text-white font-medium">
                Send
              </button>
              <button type="button" onClick={() => { setOpenFlagField(null); setFlagNote(""); }}
                className="text-sm text-black dark:text-white hover:underline underline-offset-2">
                Cancel
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setOpenFlagField(key)}
              className="text-sm text-black dark:text-white hover:underline underline-offset-2">
              Flag this
            </button>
          )
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
  async function completeOrgADetails() {
    if (!doc || !orgB) return;
    if (missingFieldLabels.length > 0 || dateValidationErrors.length > 0) return;
    setSaving(true);
    const updates = {
      field_values: fieldValues,
      details_completed_by_org_a: true,
      details_completed_at_org_a: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await supabase.from("mou_documents").update(updates).eq("id", doc.id);
    setDoc({ ...doc, ...updates } as MouDoc);
    setSaving(false);
    await supabase.rpc("send_mou_notification", {
      p_document_id: doc.id,
      p_type: "mou_details_ready",
      p_title: "MoU details ready for your review",
      p_body: `${orgA?.organisation_name ?? "The other party"} has completed their MoU details. Review and flag anything before filling your part.`,
      p_link: `/dashboard/portfolio/mou`,
    });
  }
  async function raiseFlag(fieldKey: string, note: string) {
    if (!doc || !note.trim()) return;
    const newFlag: FieldFlag = {
      id: `${Date.now()}-${fieldKey}`,
      field_key: fieldKey,
      note: note.trim(),
      raised_by: "org_b",
      resolved: false,
      created_at: new Date().toISOString(),
    };
    const updatedFlags = [...(doc.field_flags ?? []), newFlag];
    await supabase.from("mou_documents").update({
      field_flags: updatedFlags, updated_at: new Date().toISOString(),
    }).eq("id", doc.id);
    setDoc({ ...doc, field_flags: updatedFlags } as MouDoc);
    await supabase.rpc("send_mou_notification", {
      p_document_id: doc.id,
      p_type: "mou_field_flagged",
      p_title: "A detail was flagged on your MoU",
      p_body: `${orgB?.organisation_name ?? "The other party"} flagged "${humanizeFieldLabel(fieldKey)}": ${note.trim()}`,
      p_link: `/dashboard/portfolio/mou`,
    });
  }
  async function resolveFlag(flagId: string) {
    if (!doc) return;
    const updatedFlags = (doc.field_flags ?? []).map((f) => (f.id === flagId ? { ...f, resolved: true } : f));
    await supabase.from("mou_documents").update({
      field_flags: updatedFlags, updated_at: new Date().toISOString(),
    }).eq("id", doc.id);
    setDoc({ ...doc, field_flags: updatedFlags } as MouDoc);
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

  async function confirmSignature(dataUrl: string) {
    if (!doc || !orgA || !orgB) return;
    setSigning(true);
    const myOrgId = orgA.user_id === myUserId ? orgA.id : orgB.user_id === myUserId ? orgB.id : null;
    if (!myOrgId) { setSigning(false); return; }
    const path = `signatures/${doc.id}/${myOrgId}-${Date.now()}.png`;
    const { error: uploadError } = await supabase.storage
      .from("mou-documents").upload(path, dataUrlToBlob(dataUrl));
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
    const nowFullyExecuted = otherAlreadySigned;
    updates.status = nowFullyExecuted ? "fully_executed" : (doc.status === "draft" ? "sent" : doc.status);
    await supabase.from("mou_documents").update(updates).eq("id", doc.id);
    const updatedDoc = { ...doc, ...updates } as MouDoc;
    setDoc(updatedDoc);

    const otherOrgName = isOrgA ? orgB.organisation_name : orgA.organisation_name;
    if (nowFullyExecuted) {
      // Both signatures are in -- generate the one canonical PDF now,
      // while both signature images are already loaded in this session,
      // rather than leaving it to whoever next happens to click Export.
      const pdf = buildPdf();
      if (pdf) {
        const finalPath = `final/${doc.id}/executed.pdf`;
        const pdfBlob = pdf.output("blob");
        const { error: finalUploadError } = await supabase.storage
          .from("mou-documents").upload(finalPath, pdfBlob, { upsert: true });
        if (!finalUploadError) {
          await supabase.from("mou_documents").update({ final_document_path: finalPath }).eq("id", doc.id);
          updatedDoc.final_document_path = finalPath;
          setDoc(updatedDoc);
        }
      }
      await supabase.rpc("notify_mou_fully_executed", {
        p_document_id: doc.id,
        p_title: "MoU fully executed",
        p_body: `Your MoU with ${otherOrgName} has been signed by both parties.`,
        p_link: `/dashboard/portfolio/mou`,
      });
    } else {
      await supabase.rpc("send_mou_notification", {
        p_document_id: doc.id,
        p_type: "mou_awaiting_signature",
        p_title: "MoU awaiting your signature",
        p_body: `${otherOrgName} has signed your MoU. It's ready for your signature.`,
        p_link: `/dashboard/portfolio/mou`,
      });
    }

    setSigning(false);
    setRedrawingSignature(false);
    load({ silent: true });
  }
  async function finishMySignature() {
    if (!doc || !orgA || !orgB) return;
    const myOrgId = orgA.user_id === myUserId ? orgA.id : orgB.user_id === myUserId ? orgB.id : null;
    if (!myOrgId) return;
    const isOrgA = myOrgId === doc.org_a_id;
    const mySigPath = isOrgA ? doc.signature_org_a_path : doc.signature_org_b_path;
    if (!mySigPath) return; // can't finish before signing
    const updates = isOrgA
      ? { signature_locked_org_a: true, updated_at: new Date().toISOString() }
      : { signature_locked_org_b: true, updated_at: new Date().toISOString() };
    await supabase.from("mou_documents").update(updates).eq("id", doc.id);
    setDoc({ ...doc, ...updates } as MouDoc);
  }
  async function clearMySignature() {
    if (!doc || !orgA || !orgB) return;
    const myOrgId = orgA.user_id === myUserId ? orgA.id : orgB.user_id === myUserId ? orgB.id : null;
    if (!myOrgId) return;
    const isOrgA = myOrgId === doc.org_a_id;
    // Guard the action itself, not just the button -- a locked signature
    // must be unclearable even if the UI somehow still shows the control.
    if (isOrgA ? doc.signature_locked_org_a : doc.signature_locked_org_b) return;
    const updates: Partial<MouDoc> & Record<string, any> = { updated_at: new Date().toISOString() };
    if (isOrgA) {
      updates.signature_org_a_path = null;
      updates.signed_at_org_a = null;
    } else {
      updates.signature_org_b_path = null;
      updates.signed_at_org_b = null;
    }
    // Clearing a signature means the document is no longer signed by that
    // party, so step the status back down if it had advanced past "sent".
    if (doc.status === "fully_executed") {
      updates.status = isOrgA ? "signed_by_org_b" : "signed_by_org_a";
    } else if ((doc.status === "signed_by_org_a" && isOrgA) || (doc.status === "signed_by_org_b" && !isOrgA)) {
      updates.status = "sent";
    }
    await supabase.from("mou_documents").update(updates).eq("id", doc.id);
    setDoc({ ...doc, ...updates } as MouDoc);
    if (isOrgA) setSignatureAUrl(null); else setSignatureBUrl(null);
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

  function buildPdf(): jsPDF | null {
    if (!doc || !orgA || !orgB) return null;
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
      ensureSpace(20);
      pdf.setFont("Bricolage", "bold");
      pdf.setFontSize(11);
      pdf.setTextColor(...FOREST_GREEN);
      pdf.text(text.toUpperCase(), margin, y);
      y += 18;
    }
    // Renders "- " / "* " bullet lines and "1. " numbered lines with a
    // proper hanging indent instead of every clause reading as one dense
    // wrapped paragraph. Non-list lines fall through to writeParagraph.
    function writeSectionBody(text: string) {
      const lines = text.split(/\n+/).filter((l) => l.trim().length > 0);
      const bulletRegex = /^[-*]\s+(.*)/;
      const numberRegex = /^(\d+)[.)]\s+(.*)/;
      lines.forEach((line) => {
        const bulletMatch = line.match(bulletRegex);
        const numberMatch = line.match(numberRegex);
        const lineHeight = 10.5 * 1.4;
        if (bulletMatch) {
          const indent = 14;
          const wrapped: string[] = pdf.splitTextToSize(bulletMatch[1], contentWidth - indent);
          ensureSpace(wrapped.length * lineHeight);
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(10.5);
          pdf.setTextColor(...BLACK);
          pdf.text("•", margin, y);
          wrapped.forEach((wl, i) => pdf.text(wl, margin + indent, y + i * lineHeight));
          y += wrapped.length * lineHeight + 4;
        } else if (numberMatch) {
          const indent = 18;
          const wrapped: string[] = pdf.splitTextToSize(numberMatch[2], contentWidth - indent);
          ensureSpace(wrapped.length * lineHeight);
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(10.5);
          pdf.setTextColor(...BLACK);
          pdf.text(`${numberMatch[1]}.`, margin, y);
          wrapped.forEach((wl, i) => pdf.text(wl, margin + indent, y + i * lineHeight));
          y += wrapped.length * lineHeight + 4;
        } else {
          writeParagraph(line, { gap: 8 });
        }
      });
      y += 6;
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
      displaySections.forEach((s) => {
        writeSectionHeader(s.title);
        writeSectionBody(sanitizeForPdf(s.body));
      });
    }

    // Signature block -- composites the actual captured signature images at
    // fixed coordinates, with the real signatory name/title/date printed
    // underneath instead of blank underscore lines. This only works
    // because Impact Natives controls this document's layout end to end;
    // an uploaded external PDF's layout is unknown, so that path keeps the
    // sign-externally-and-upload-back flow instead of compositing onto it.
    ensureSpace(160);
    writeSectionHeader("Signatures");
    const sigWidth = 150;
    const sigHeight = 50;
    const colGap = 40;
    const colWidth = (contentWidth - colGap) / 2;
    const blockTop = y;
    function writeSignatureColumn(
      x: number, orgName: string, sigImg: HTMLImageElement | null,
      signatoryName: string, signatoryTitle: string, signedAt: string | null
    ) {
      let cy = blockTop;
      pdf.setFont("Bricolage", "bold");
      pdf.setFontSize(10);
      pdf.setTextColor(...FOREST_GREEN);
      pdf.text(`FOR ${sanitizeForPdf(orgName).toUpperCase()}`, x, cy);
      cy += 14;
      if (sigImg) {
        pdf.addImage(sigImg, "PNG", x, cy, sigWidth, sigHeight);
      } else {
        pdf.setDrawColor(200, 200, 200);
        pdf.setLineWidth(0.5);
        pdf.line(x, cy + sigHeight - 4, x + sigWidth, cy + sigHeight - 4);
      }
      cy += sigHeight + 4;
      pdf.setDrawColor(220, 220, 220);
      pdf.setLineWidth(0.5);
      pdf.line(x, cy, x + colWidth, cy);
      cy += 14;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9.5);
      pdf.setTextColor(...BLACK);
      pdf.text(`Name: ${sanitizeForPdf(signatoryName) || "________________"}`, x, cy);
      cy += 14;
      pdf.text(`Title: ${sanitizeForPdf(signatoryTitle) || "________________"}`, x, cy);
      cy += 14;
      pdf.text(`Date: ${signedAt ? new Date(signedAt).toLocaleDateString("en-GB") : "________________"}`, x, cy);
    }
    writeSignatureColumn(margin, orgA.organisation_name, signatureAImg,
      resolvedValue("org_a_signatory_name"), resolvedValue("org_a_signatory_title"), doc.signed_at_org_a);
    writeSignatureColumn(margin + colWidth + colGap, orgB.organisation_name, signatureBImg,
      resolvedValue("org_b_signatory_name"), resolvedValue("org_b_signatory_title"), doc.signed_at_org_b);
    y = blockTop + 14 + sigHeight + 4 + 14 + 14 + 14 + 10;

    const pageCount = pdf.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(120, 120, 120);
      pdf.text("Generated via Impact Natives", margin, pageHeight - 24);
      pdf.text(`${i} / ${pageCount}`, pageWidth - margin - 24, pageHeight - 24);
    }

    return pdf;
  }
  function exportPdf() {
    const pdf = buildPdf();
    if (!pdf || !orgA || !orgB) return;
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
  const hasUnresolvedFlags = (doc.field_flags ?? []).some((f) => !f.resolved);
  const orgADetailsEditable = isViewerOrgA && (!doc.details_completed_by_org_a || hasUnresolvedFlags);
  const orgBCanFillTheirPart = doc.details_completed_by_org_a && !hasUnresolvedFlags;

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
                      {isViewerOrgA
                        ? "Complete your organisation's details and the shared agreement details below. Once submitted, we'll notify the other party to review."
                        : doc.details_completed_by_org_a
                        ? "Review the details below. Flag anything that needs clarifying before filling in your own details."
                        : `Waiting for ${orgA?.organisation_name ?? "the other party"} to complete their details.`}
                    </p>
                  </div>

                  {groupedFieldKeys.orgAKeys.length > 0 && (isViewerOrgA || doc.details_completed_by_org_a) && (
                    <div className="rounded-xl border border-border p-4 space-y-3">
                      <p className="text-sm font-semibold text-[#2D6A4F] uppercase tracking-wide">
                        {orgA?.organisation_name || "Your organisation"}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {groupedFieldKeys.orgAKeys.map((key) => (
                          <div key={key} className={isDescriptionField(key) ? "sm:col-span-2" : ""}>
                            {renderFieldInput(key, isViewerOrgB ? true : !orgADetailsEditable)}
                            {(isViewerOrgA || isViewerOrgB) && renderFlagsForField(key)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {orderedOtherKeys.length > 0 && (isViewerOrgA || doc.details_completed_by_org_a) && (
                    <div className="rounded-xl border border-border p-4 space-y-3">
                      <p className="text-sm font-semibold text-[#2D6A4F] uppercase tracking-wide">
                        Agreement details
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {orderedOtherKeys.map((key) => (
                          <div key={key} className={isDescriptionField(key) ? "sm:col-span-2" : ""}>
                            {renderFieldInput(key, isViewerOrgB ? true : !orgADetailsEditable)}
                            {(isViewerOrgA || isViewerOrgB) && renderFlagsForField(key)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {isViewerOrgA && (
                    <button type="button" onClick={completeOrgADetails}
                      disabled={saving || missingFieldLabels.length > 0 || dateValidationErrors.length > 0 || (doc.details_completed_by_org_a && !hasUnresolvedFlags)}
                      className="text-sm px-4 py-1.5 rounded-full bg-[#2D6A4F] hover:bg-[#245c43] text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed">
                      {doc.details_completed_by_org_a
                        ? (hasUnresolvedFlags ? "Resubmit after resolving flags" : "Details submitted")
                        : (saving ? "Submitting..." : `Submit details — notify ${orgB?.organisation_name ?? "partner"}`)}
                    </button>
                  )}

                  {groupedFieldKeys.orgBKeys.length > 0 && (
                    <div className="rounded-xl border border-border p-4 space-y-3">
                      <p className="text-sm font-semibold text-[#2D6A4F] uppercase tracking-wide">
                        {orgB?.organisation_name || "Partner organisation"}
                      </p>
                      {isViewerOrgA ? (
                        <p className="text-sm text-black dark:text-white">
                          {orgB?.organisation_name || "The other party"} will complete this after your details are submitted.
                        </p>
                      ) : !doc.details_completed_by_org_a ? (
                        <p className="text-sm text-black dark:text-white">
                          Available once {orgA?.organisation_name ?? "the other party"} submits their details.
                        </p>
                      ) : hasUnresolvedFlags ? (
                        <p className="text-sm text-black dark:text-white">
                          Resolve open flags above before filling in your details.
                        </p>
                      ) : (
                        <>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {groupedFieldKeys.orgBKeys.map((key) => (
                              <div key={key} className={isDescriptionField(key) ? "sm:col-span-2" : ""}>
                                {renderFieldInput(key)}
                              </div>
                            ))}
                          </div>
                          <button type="button" onClick={saveFieldValues} disabled={saving}
                            className="text-sm text-black dark:text-white hover:underline underline-offset-2 disabled:opacity-60">
                            {saving ? "Saving..." : "Save field values"}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-4 border-t border-border pt-5">
                <div>
                  <p className="text-base font-semibold text-black dark:text-white">Document preview</p>
                  <p className="text-sm text-black dark:text-white">
                    {previewLocked
                      ? "This text is locked because a signature has been added."
                      : "Edit any clause directly — erase what doesn't apply, adjust wording as needed."}
                  </p>
                </div>
                {displaySections.map((s) => (
                  <div key={s.id}>
                    <p className="text-sm font-semibold uppercase tracking-wide text-black dark:text-white mb-1">{s.title}</p>
                    {previewLocked ? (
                      <p className="text-base text-black dark:text-white leading-relaxed whitespace-pre-line">
                        {s.body}
                      </p>
                    ) : (
                      <textarea
                        value={s.body}
                        onChange={(e) => handleSectionEdit(s.id, e.target.value)}
                        rows={Math.max(3, Math.ceil(s.body.length / 80))}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-white dark:bg-card text-base text-black dark:text-white leading-relaxed focus:outline-none focus:border-[#2D6A4F]/50 resize-y"
                      />
                    )}
                  </div>
                ))}
                {!previewLocked && Object.keys(sectionOverrides).length > 0 && (
                  <button type="button" onClick={savePreviewEdits} disabled={savingSections}
                    className="text-sm text-black dark:text-white hover:underline underline-offset-2 disabled:opacity-60">
                    {savingSections ? "Saving..." : "Save document edits"}
                  </button>
                )}
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

            {missingFieldLabels.length > 0 && (doc.source_type !== "template" || !isViewerOrgB || orgBCanFillTheirPart) && (
              <div className="rounded-xl border border-border bg-muted/20 p-4">
                <p className="text-sm font-medium text-black dark:text-white mb-1">Complete these fields before sending or signing:</p>
                <p className="text-sm text-black dark:text-white">{missingFieldLabels.join(", ")}</p>
              </div>
            )}
            {dateValidationErrors.length > 0 && (
              <div className="rounded-xl border border-red-300 bg-red-50 p-4">
                <p className="text-sm font-medium text-red-800 mb-1">Fix these dates before sending or signing:</p>
                {dateValidationErrors.map((e, i) => <p key={i} className="text-sm text-red-800">{e}</p>)}
              </div>
            )}
            {doc.status === "draft" && iAmCreator && missingFieldLabels.length === 0 && dateValidationErrors.length === 0 && (
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

            {doc.status !== "draft" && doc.source_type !== "uploaded_pdf" && missingFieldLabels.length === 0 && dateValidationErrors.length === 0 &&
              (doc.source_type !== "template" || !isViewerOrgB || orgBCanFillTheirPart) && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-black dark:text-white mb-1">{orgA?.organisation_name}</p>
                    {signatureAUrl ? (
                      <div className="rounded-lg bg-white pl-4 pr-3 py-3">
                        <img src={signatureAUrl} alt="Signature" className="h-28" />
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
                      <div className="rounded-lg bg-white pl-4 pr-3 py-3">
                        <img src={signatureBUrl} alt="Signature" className="h-28" />
                        <p className="text-sm text-black dark:text-white mt-1">
                          Signed {doc.signed_at_org_b ? new Date(doc.signed_at_org_b).toLocaleDateString("en-GB") : ""}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-black dark:text-white">Not yet signed</p>
                    )}
                  </div>
                </div>

                {orgA && orgB && (orgA.user_id === myUserId || orgB.user_id === myUserId) && (() => {
                  const isOrgA = orgA.user_id === myUserId;
                  const mySigUrl = isOrgA ? signatureAUrl : signatureBUrl;
                  const myLocked = isOrgA ? doc.signature_locked_org_a : doc.signature_locked_org_b;
                  const showPad = !myLocked && (!mySigUrl || redrawingSignature);
                  if (myLocked) {
                    return (
                      <div className="border-t border-border pt-4">
                        <p className="text-sm text-black dark:text-white">
                          You have finalized your signature on this document. It can no longer be changed.
                        </p>
                      </div>
                    );
                  }
                  return (
                    <div className="border-t border-border pt-4 space-y-3">
                      {showPad ? (
                        <>
                          <div className="flex items-center justify-between">
                            <p className="text-base font-semibold text-black dark:text-white">Sign this document</p>
                            {redrawingSignature && (
                              <button type="button" onClick={() => setRedrawingSignature(false)} disabled={signing}
                                className="text-sm text-black dark:text-white hover:underline underline-offset-2 disabled:opacity-60">
                                Cancel
                              </button>
                            )}
                          </div>
                          <SignaturePad onConfirm={confirmSignature} disabled={signing} confirming={signing} />
                        </>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center gap-4">
                            <button type="button" onClick={() => setRedrawingSignature(true)}
                              className="text-sm text-black dark:text-white hover:underline underline-offset-2">
                              Change signature
                            </button>
                            <button type="button" onClick={clearMySignature}
                              className="text-sm text-black dark:text-white hover:underline underline-offset-2">
                              Clear signature
                            </button>
                          </div>
                          <button type="button" onClick={finishMySignature}
                            className="text-sm px-4 py-1.5 rounded-full bg-[#2D6A4F] hover:bg-[#245c43] text-white font-medium transition-colors">
                            Finish — lock this signature
                          </button>
                          <p className="text-sm text-black/60 dark:text-white/60">
                            Once you finish, you won't be able to change or clear your signature again.
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Export */}
          {doc.source_type !== "uploaded_pdf" && (
            <div className="space-y-2">
              {doc.final_document_path && (
                <p className="text-sm text-black dark:text-white">
                  This MoU is fully executed. Exporting now gives you the final signed copy both parties hold.
                </p>
              )}
              <button type="button" onClick={exportPdf}
                className="w-full flex items-center justify-center gap-2 border border-border rounded-full py-3 text-base font-medium text-black dark:text-white hover:border-[#2D6A4F]/50 transition-colors">
                <Download className="w-4 h-4" /> Export as PDF
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}