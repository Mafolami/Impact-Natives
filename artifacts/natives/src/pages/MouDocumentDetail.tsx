import { useState, useEffect, useMemo, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { jsPDF } from "jspdf";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { BRICOLAGE_GROTESQUE_BOLD_BASE64 } from "@/lib/fonts/bricolageGrotesqueBold";
import { X, Loader2, Download, Upload, CheckCircle2, Send, ArrowLeft, PenLine, Flag, Lock, Clock, PartyPopper, Trash2, Target, Users, ClipboardList, ChevronUp, ChevronDown } from "lucide-react";
import SignaturePad from "@/components/dashboard/SignaturePad";
import IndicatorForm from "@/components/mou/IndicatorForm";
import {
  PartnershipIndicator, fetchIndicators, agreeToIndicator, rejectIndicator,
  proposeIndicatorRefinement, acceptIndicatorRefinement, dismissIndicatorRefinement, hasPendingSuggestion,
  isIndicatorAgreed, indicatorStatus, INDICATOR_AGREEMENT_LABEL, INDICATOR_AGREEMENT_PILL_STYLES,
} from "@/lib/indicators";
// ─── Types ────────────────────────────────────────────────────────────────────
interface SectionVariant { toggle_value: string | boolean | null; body: string }
interface TemplateSection { id: string; title: string; toggle_key: string | null; variants: SectionVariant[] }
interface TemplateToggleOption { value: string | boolean; label?: string }
interface TemplateToggle { key: string; label: string; type: "select" | "binary"; options: TemplateToggleOption[] }
interface MouTemplate { id: string; name: string; sections: TemplateSection[]; toggles: TemplateToggle[] }
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
  partnership_sought?: string | null;
}
interface MouDoc {
  id: string;
  org_a_id: string | null;
  org_b_id: string | null;
  initiative_id: string | null;
  connection_id: string | null;
  source_type: "template" | "custom" | "uploaded_pdf";
  template_id: string | null;
  toggle_selections: Record<string, string | boolean> | null;
  field_values: Record<string, string> | null;
  custom_content: string | null;
  rendered_file_path: string | null;
  status: "draft" | "sent" | "signed_by_org_a" | "signed_by_org_b" | "pending_org_a_final_review" | "fully_executed";
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
  org_b_finalization_confirmed: boolean;
  partnership_status_confirmed: boolean;
  partnership_status_confirmed_at: string | null;
  org_b_submitted_at: string | null;
  org_b_confirmed_at: string | null;
  fully_executed_at: string | null;
  created_by: string;
}
interface Props {
  documentId: string;
  myUserId: string;
  onClose: () => void;
}
function fieldKeysIn(text: string): string[] {
  const matches = text.match(/\{\{(\w+)\}\}/g) ?? [];
  return matches.map((m) => m.slice(2, -2));
}
const CURRENCY_OPTIONS = ["NGN", "USD", "GBP", "EUR", "KES", "GHS", "ZAR"];
const PAYMENT_SCHEDULE_OPTIONS = [
  "100% upfront, within 5 business days of signing",
  "50% upfront on signing, 50% on completion",
  "Monthly instalments for the duration of the partnership",
  "Quarterly instalments for the duration of the partnership",
  "Upon delivery of agreed milestones",
  "Annually, for the duration of the partnership",
];
const REPORTING_FREQUENCY_OPTIONS = ["Weekly", "Monthly", "Quarterly", "Bi-annually", "Annually", "Ad hoc / as needed"];
const NOTICE_DAYS_OPTIONS = ["3", "7", "14", "30", "60", "90"];
const GOVERNING_JURISDICTION_OPTIONS = ["Federal Republic of Nigeria", "Lagos State, Nigeria", "United Kingdom", "Ghana", "Kenya", "South Africa"];
export default function MouDocumentDetail({ documentId, myUserId, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [doc, setDoc] = useState<MouDoc | null>(null);
  const [template, setTemplate] = useState<MouTemplate | null>(null);
  const [orgA, setOrgA] = useState<OrgFull | null>(null);
  const [orgB, setOrgB] = useState<OrgFull | null>(null);
  const [initiative, setInitiative] = useState<{ title: string; problem: string | null } | null>(null);
  const [connectionListingOrgId, setConnectionListingOrgId] = useState<string | null>(null);
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
  const [customFieldMode, setCustomFieldMode] = useState<Record<string, boolean>>({});
  const [finalizing, setFinalizing] = useState(false);
  const [finalizeError, setFinalizeError] = useState<string | null>(null);
  const [confirmingFinalization, setConfirmingFinalization] = useState(false);
  const [confirmingPartnershipStatus, setConfirmingPartnershipStatus] = useState(false);
  const [showVoidConfirm, setShowVoidConfirm] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const [voidError, setVoidError] = useState<string | null>(null);
  const [indicators, setIndicators] = useState<PartnershipIndicator[]>([]);
  const [loadingIndicators, setLoadingIndicators] = useState(true);
  const [showIndicatorForm, setShowIndicatorForm] = useState(false);
  const [agreeingIndicatorId, setAgreeingIndicatorId] = useState<string | null>(null);
  const [uploadIndicatorError, setUploadIndicatorError] = useState<string | null>(null);
  // Action group for the org that didn't create a given indicator: Agree,
  // Suggest refinement (an inline edit -- the existing UPDATE RLS already
  // permits either participant org to edit any indicator on the document,
  // so "suggest" is really just exposing that same edit capability rather
  // than a new permission), or Reject with a reason.
  const [editingIndicatorId, setEditingIndicatorId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({ name: "", definition: "", baseline_value: "", target_value: "", measurement_window: "", source: "" });
  const [savingEdit, setSavingEdit] = useState(false);
  const [resolvingSuggestionId, setResolvingSuggestionId] = useState<string | null>(null);
  const [rejectingIndicatorId, setRejectingIndicatorId] = useState<string | null>(null);
  const [rejectReasonDraft, setRejectReasonDraft] = useState("");
  const [submittingReject, setSubmittingReject] = useState(false);
  // In-platform PDF signing (uploaded_pdf docs only). Inline signing is
  // the default UI; "upload instead" opens a confirm-and-upload modal
  // as a secondary text link, not a competing button.
  const [composingSignature, setComposingSignature] = useState(false);
  const [showUploadWarning, setShowUploadWarning] = useState(false);
  const isViewerOrgA = orgA?.user_id === myUserId;
  const isViewerOrgB = orgB?.user_id === myUserId;
  const [nearTop, setNearTop] = useState(true);
  useEffect(() => {
    function handleScroll() {
      setNearTop(window.scrollY < 240);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);
  useEffect(() => { load(); }, [documentId]);
  async function load(opts: { silent?: boolean } = {}) {
    if (!opts.silent) { setLoading(true); setNotFound(false); }
    const { data: docRow } = await supabase.from("mou_documents").select("*").eq("id", documentId).maybeSingle();
    if (!docRow) {
      // Either the row doesn't exist, or RLS silently blocked it (e.g. a
      // draft MoU URL guessed or bookmarked by the non-creating party).
      // Either way, this is a real terminal state, not "still loading" --
      // show a clear message instead of spinning forever.
      if (!opts.silent) { setLoading(false); setNotFound(true); }
      return;
    }
    setDoc(docRow as MouDoc);
    setFieldValues((docRow.field_values as Record<string, string>) ?? {});
    setCustomContent(docRow.custom_content ?? "");
    const [{ data: orgRows }, initRes, connRes] = await Promise.all([
      supabase.from("organizations").select("id, user_id, organisation_name, country, organisation_type, partnership_budget, partnership_sought")
        .in("id", [docRow.org_a_id, docRow.org_b_id]),
      docRow.initiative_id
        ? supabase.from("initiative_requests").select("title, problem").eq("id", docRow.initiative_id).maybeSingle()
        : Promise.resolve({ data: null }),
      docRow.connection_id
        ? supabase.from("partnership_connections").select("receiver_org_id").eq("id", docRow.connection_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    const a = (orgRows ?? []).find((o: any) => o.id === docRow.org_a_id) ?? null;
    const b = (orgRows ?? []).find((o: any) => o.id === docRow.org_b_id) ?? null;
    setOrgA(a);
    setOrgB(b);
    setInitiative((initRes as any)?.data ?? null);
    setConnectionListingOrgId((connRes as any)?.data?.receiver_org_id ?? null);
    if (docRow.source_type === "template" && docRow.template_id) {
      const { data: tpl } = await supabase.from("mou_templates").select("id, name, sections, toggles").eq("id", docRow.template_id).maybeSingle();
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
    setLoadingIndicators(true);
    const indicatorRows = await fetchIndicators(documentId);
    setIndicators(indicatorRows);
    setLoadingIndicators(false);
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
    const connectionListingOrg = connectionListingOrgId === orgA.id ? orgA : connectionListingOrgId === orgB.id ? orgB : null;
    return {
      org_a_name: orgA.organisation_name ?? "",
      org_b_name: orgB.organisation_name ?? "",
      org_a_country: countryOf(orgA.country),
      org_b_country: countryOf(orgB.country),
      org_a_entity_type: orgA.organisation_type ? titleCase(orgA.organisation_type.replace(/_/g, " ")) : "",
      org_b_entity_type: orgB.organisation_type ? titleCase(orgB.organisation_type.replace(/_/g, " ")) : "",
      project_name: initiative?.title || connectionListingOrg?.partnership_sought || "",
      project_description: initiative?.problem ?? "",
      financial_amount: orgA.partnership_budget ?? orgB.partnership_budget ?? "",
    };
  }, [orgA, orgB, initiative, connectionListingOrgId]);
  const compiledSections = useMemo(() => {
    if (!doc || !template) return [];
    const selections = doc.toggle_selections ?? {};
    const startVal = fieldValues["start_date"] || autofill["start_date"] || "";
    const endVal = fieldValues["end_date"] || autofill["end_date"] || "";
    const start = startVal ? new Date(startVal) : null;
    const end = endVal ? new Date(endVal) : null;
    const durationDays = start && end && !isNaN(start.getTime()) && !isNaN(end.getTime())
      ? Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
      : null;
    // Projects under a month don't have room for a recurring cadence like
    // "bi-weekly" -- for those, the reporting clause drops the periodic
    // fallback entirely rather than offering a cadence that literally
    // can't complete inside the project window.
    const shortProject = durationDays !== null && durationDays >= 0 && durationDays < 30;
    return template.sections
      .map((s) => {
        const variant = s.toggle_key
          ? s.variants.find((v) => v.toggle_value === selections[s.toggle_key!])
          : s.variants[0];
        if (!variant) return null;
        let body = variant.body;
        if (s.id === "reporting" && shortProject) {
          body = "{{org_a_name}} will provide {{org_b_name}} with an impact report covering agreed metrics within {{reporting_days}} days of project completion.";
        }
        return { id: s.id, title: s.title, body };
      })
      .filter((s): s is { id: string; title: string; body: string } => s !== null && s.id !== "signatures");
  }, [doc, template, fieldValues, autofill]);
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
  // Financial and Hybrid support types imply a real financial commitment,
  // which contradicts "non-binding" -- rather than showing both and
  // relying on disclaimer copy, the invalid options are removed from the
  // picker entirely once Agreement type is set to non-binding. Mirrors
  // the same helper in CreateMouModal.tsx.
  function visibleToggleOptions(t: TemplateToggle): TemplateToggleOption[] {
    if (t.key !== "support_type" || doc?.toggle_selections?.["agreement_type"] !== "non_binding") return t.options;
    return t.options.filter((o) => o.value !== "financial" && o.value !== "hybrid");
  }
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
    // Agreement date can be backdated (reflecting an earlier verbal
    // understanding or effective start), but can't be dated into the
    // future -- same principle as dating a physical document by hand.
    if (agreementDate) {
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (agreementDate > today) errors.push("Agreement date cannot be later than today.");
    }
    return errors;
  }, [fieldValues, autofill]);
  // Non-blocking, unlike dateValidationErrors -- a long notice period on a
  // short project is a judgment call, not something that should stop
  // someone from signing.
  const noticePeriodWarning = useMemo(() => {
    const startVal = fieldValues["start_date"] || autofill["start_date"] || "";
    const endVal = fieldValues["end_date"] || autofill["end_date"] || "";
    const noticeVal = fieldValues["notice_days"] || autofill["notice_days"] || "";
    const start = startVal ? new Date(startVal) : null;
    const end = endVal ? new Date(endVal) : null;
    const notice = parseInt(noticeVal, 10);
    if (!start || !end || isNaN(start.getTime()) || isNaN(end.getTime()) || isNaN(notice)) return null;
    const durationDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (durationDays > 0 && notice >= durationDays) {
      return `Your notice period (${notice} days) is close to or longer than the project itself (${durationDays} days) -- a shorter notice period may be more workable here.`;
    }
    return null;
  }, [fieldValues, autofill]);
  // Non-blocking, like noticePeriodWarning -- a governing jurisdiction
  // that doesn't match either party's country is often intentional
  // (a neutral third jurisdiction), so this flags rather than prevents.
  // Only fires for custom-typed values; anything picked from the preset
  // list is already a real jurisdiction and skipped.
  const jurisdictionWarning = useMemo(() => {
    const jurisdictionVal = (fieldValues["governing_jurisdiction"] || autofill["governing_jurisdiction"] || "").trim();
    if (!jurisdictionVal || GOVERNING_JURISDICTION_OPTIONS.includes(jurisdictionVal)) return null;
    const orgACountry = resolvedValue("org_a_country");
    const orgBCountry = resolvedValue("org_b_country");
    const jv = jurisdictionVal.toLowerCase();
    const matches = (country: string) => {
      if (!country) return false;
      const c = country.toLowerCase();
      return jv.includes(c) || c.includes(jv);
    };
    if (matches(orgACountry) || matches(orgBCountry)) return null;
    const partiesNote = [orgACountry, orgBCountry].filter(Boolean).join(" / ") || "either party's country";
    return `"${jurisdictionVal}" doesn't match ${partiesNote} -- double check this is the jurisdiction you intend.`;
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
  // Org B only ever gets a read-only view of the document text plus the
  // ability to flag/comment -- direct editing of clauses or free-text
  // content is Org A's job alone, independent of whether a signature has
  // locked things yet.
  const canEditDocumentContent = isViewerOrgA && !previewLocked && doc?.status !== "fully_executed";  function handleSectionEdit(sectionId: string, value: string) {
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
    if (key === "agreement_date" && dateValidationErrors.some((e) => e.includes("later than today"))) return "Cannot be later than today.";
    if (key === "agreement_date" && dateValidationErrors.some((e) => e.includes("Agreement date"))) return "Cannot be later than start or end date.";
    return null;
  }
  // Preset-options field with a free-text escape hatch. Used for
  // payment_schedule, reporting_frequency, notice_days, governing_jurisdiction.
  function renderComboField(key: string, options: string[], numeric: boolean = false) {
    const manualValue = fieldValues[key];
    const value = manualValue ?? autofill[key] ?? "";
    const valueInOptions = options.includes(value);
    const isCustom = customFieldMode[key] ?? (!!value && !valueInOptions);
    return (
      <div key={key}>
        <label className="text-sm font-medium text-black dark:text-white block mb-1">
          {humanizeFieldLabel(key)}
        </label>
        {!isCustom ? (
          <select
            value={valueInOptions ? value : ""}
            onChange={(e) => {
              if (e.target.value === "__other__") {
                setCustomFieldMode((prev) => ({ ...prev, [key]: true }));
              } else {
                setFieldValues((prev) => ({ ...prev, [key]: e.target.value }));
              }
            }}
            className="w-full h-10 px-3 rounded-lg border border-border bg-white dark:bg-card text-base text-black dark:text-white focus:outline-none focus:border-[#2D6A4F]/50"
          >
            <option value="" disabled>Select...</option>
            {options.map((o) => <option key={o} value={o}>{o}</option>)}
            <option value="__other__">Other (type your own)</option>
          </select>
        ) : (
          <div className="space-y-2">
            <input
              type={numeric ? "number" : "text"}
              value={value}
              onChange={(e) => setFieldValues((prev) => ({ ...prev, [key]: e.target.value }))}
              placeholder="Type your own..."
              className="w-full h-10 px-3 rounded-lg border border-border bg-white dark:bg-card text-base text-black dark:text-white focus:outline-none focus:border-[#2D6A4F]/50"
            />
            <button type="button"
              onClick={() => setCustomFieldMode((prev) => ({ ...prev, [key]: false }))}
              className="text-sm px-3 py-1 rounded-full border border-border text-black dark:text-white hover:border-[#2D6A4F]/50 transition-colors">
              Choose from list instead
            </button>
          </div>
        )}
      </div>
    );
  }
  // Typeable number input with +/- stepper buttons, for reporting_days.
  function renderNumberStepperField(key: string) {
    const manualValue = fieldValues[key];
    const value = manualValue ?? autofill[key] ?? "";
    function step(delta: number) {
      const current = parseInt(value, 10);
      const next = Math.max(0, (isNaN(current) ? 0 : current) + delta);
      setFieldValues((prev) => ({ ...prev, [key]: String(next) }));
    }
    return (
      <div key={key}>
        <label className="text-sm font-medium text-black dark:text-white block mb-1">
          {humanizeFieldLabel(key)}
        </label>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => step(-1)}
            className="w-9 h-10 rounded-lg border border-border text-black dark:text-white text-lg font-medium hover:border-[#2D6A4F]/50">
            −
          </button>
          <input
            type="number"
            min={0}
            value={value}
            onChange={(e) => setFieldValues((prev) => ({ ...prev, [key]: e.target.value }))}
            className="flex-1 h-10 px-3 rounded-lg border border-border bg-white dark:bg-card text-base text-black dark:text-white text-center focus:outline-none focus:border-[#2D6A4F]/50"
          />
          <button type="button" onClick={() => step(1)}
            className="w-9 h-10 rounded-lg border border-border text-black dark:text-white text-lg font-medium hover:border-[#2D6A4F]/50">
            +
          </button>
        </div>
      </div>
    );
  }
  // Numeric-only amount input paired with a currency select, combined into
  // a single stored string (e.g. "5,000 NGN") since the template only has
  // one {{financial_amount}} placeholder to substitute.
  function parseFinancialAmount(raw: string): { amount: string; currency: string } {
    const trimmed = raw.trim();
    const match = trimmed.match(/^([\d,]+(?:\.\d+)?)\s*([A-Za-z]{3})?$/);
    if (match) return { amount: match[1].replace(/,/g, ""), currency: (match[2] || "NGN").toUpperCase() };
    // No amount typed yet -- if a currency was already chosen, the stored
    // value is just the bare currency code so the select doesn't silently
    // reset to NGN while the amount box is still empty.
    const currencyOnly = trimmed.match(/^([A-Za-z]{3})$/);
    if (currencyOnly) return { amount: "", currency: currencyOnly[1].toUpperCase() };
    return { amount: "", currency: "NGN" };
  }
  function renderFinancialAmountField() {
    const key = "financial_amount";
    const manualValue = fieldValues[key];
    const rawValue = manualValue ?? autofill[key] ?? "";
    const { amount, currency } = parseFinancialAmount(rawValue);
    function update(newAmount: string, newCurrency: string) {
      const cleanAmount = newAmount.replace(/[^\d.]/g, "");
      const combined = cleanAmount ? `${Number(cleanAmount).toLocaleString()} ${newCurrency}` : newCurrency;
      setFieldValues((prev) => ({ ...prev, [key]: combined }));
    }
    return (
      <div key={key}>
        <label className="text-sm font-medium text-black dark:text-white block mb-1">
          {humanizeFieldLabel(key)}
        </label>
        <div className="flex gap-2">
          <select value={currency} onChange={(e) => update(amount, e.target.value)}
            className="w-24 h-10 px-2 rounded-lg border border-border bg-white dark:bg-card text-base text-black dark:text-white focus:outline-none focus:border-[#2D6A4F]/50">
            {CURRENCY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => update(e.target.value, currency)}
            placeholder="0"
            className="flex-1 h-10 px-3 rounded-lg border border-border bg-white dark:bg-card text-base text-black dark:text-white focus:outline-none focus:border-[#2D6A4F]/50"
          />
        </div>
      </div>
    );
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
    if (key === "financial_amount") return renderFinancialAmountField();
    if (key === "payment_schedule") return renderComboField(key, PAYMENT_SCHEDULE_OPTIONS);
    if (key === "reporting_days") return renderNumberStepperField(key);
    if (key === "reporting_frequency") return renderComboField(key, REPORTING_FREQUENCY_OPTIONS);
    if (key === "notice_days") return renderComboField(key, NOTICE_DAYS_OPTIONS, true);
    if (key === "governing_jurisdiction") return renderComboField(key, GOVERNING_JURISDICTION_OPTIONS);
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
          max={key === "agreement_date" ? new Date().toISOString().slice(0, 10) : undefined}
          onChange={(e) => setFieldValues((prev) => ({ ...prev, [key]: e.target.value }))}
          className={`w-full h-10 px-3 rounded-lg border bg-white dark:bg-card text-base text-black dark:text-white focus:outline-none ${
            dateError ? "border-red-500" : "border-border focus:border-[#2D6A4F]/50"
          }`}
        />
        {dateError && <p className="text-sm text-red-600 mt-1">{dateError}</p>}
      </div>
    );
  }
  function InfoBanner({ tone, icon: Icon, children }: { tone: "locked" | "waiting" | "success" | "celebrate"; icon: typeof Lock; children: ReactNode }) {
    const styles = {
      locked: { bg: "bg-white dark:bg-card", border: "border-border", icon: "text-black dark:text-white" },
      waiting: { bg: "bg-amber-50 dark:bg-amber-950/20", border: "border-amber-200 dark:border-amber-900/40", icon: "text-amber-600 dark:text-amber-500" },
      success: { bg: "bg-[#2D6A4F]/[0.06]", border: "border-[#2D6A4F]/20", icon: "text-[#2D6A4F]" },
      celebrate: { bg: "bg-[#2D6A4F]/10", border: "border-[#2D6A4F]/30", icon: "text-[#2D6A4F]" },
    }[tone];
    return (
      <div className={`flex items-start gap-3 rounded-xl border ${styles.border} ${styles.bg} px-4 py-3`}>
        <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${styles.icon}`} />
        <p className="text-sm text-black dark:text-white leading-relaxed">{children}</p>
      </div>
    );
  }
  // Shared module wrapper -- every major section (terms, details, preview,
  // indicators, send & sign) gets the same icon-badge + eyebrow + divider
  // treatment, so the page reads as a deliberate rhythm of distinct
  // modules instead of a flat scroll of paragraphs separated by border-t.
  // Breaks out of any parent padding to span the true viewport width,
  // regardless of how deep this component sits in the layout -- the
  // 50vw/-mx trick works independent of the actual container width,
  // unlike a fixed negative margin that would need to match it exactly.
  function SectionDivider() {
    return <div className="relative left-1/2 right-1/2 -mx-[50vw] w-screen h-2 bg-[#F4EFE3] dark:bg-black" />;
  }
  // Flat, not a bordered box -- each module is announced by a full-bleed
  // divider bar rather than a rounded card, per the page's actual visual
  // direction. Header type is deliberately large and bold: this is the
  // one place on the page whose whole job is orientation, so it should
  // read as a real heading, not a caption.
  function SectionCard({ icon: Icon, eyebrow, title, description, action, children, id }: {
    icon: typeof Lock; eyebrow: string; title: string; description?: ReactNode; action?: ReactNode; children: ReactNode; id?: string;
  }) {
    return (
      <div id={id}>
        <SectionDivider />
        <div className="pt-7 pb-1 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Icon className="w-4 h-4 text-[#C45C26]" />
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#C45C26]">{eyebrow}</p>
              </div>
              <p className="text-2xl font-extrabold text-black dark:text-white tracking-tight mt-1">{title}</p>
              {description && <p className="text-sm text-black dark:text-white mt-1.5 max-w-2xl">{description}</p>}
            </div>
            {action && <div className="shrink-0">{action}</div>}
          </div>
          <div className="space-y-4">{children}</div>
        </div>
      </div>
    );
  }
  function renderFlagsForField(key: string, opts: { canRaise: boolean; raiserRole: "org_a" | "org_b" }) {
    const flags = (doc?.field_flags ?? []).filter((f) => f.field_key === key);
    const locked = doc?.status === "fully_executed";
    return (
      <div className="mt-1 space-y-1">
        {flags.map((f) => {
          const iCanResolve = !locked && !f.resolved && ((f.raised_by === "org_b" && isViewerOrgA) || (f.raised_by === "org_a" && isViewerOrgB));          return (
            <div key={f.id} className={`text-sm rounded-md px-2 py-1 ${f.resolved ? "bg-muted/20 text-black dark:text-white" : "bg-amber-50 text-amber-800 border border-amber-200"}`}>
              <span>{f.note}</span>
              {iCanResolve && (
                <button type="button" onClick={() => resolveFlag(f.id)} className="ml-2 underline underline-offset-2">
                  Mark resolved
                </button>
              )}
              {f.resolved && <span className="ml-2 italic">Resolved</span>}
            </div>
          );
        })}
        {opts.canRaise && !locked && (
          openFlagField === key ? (
            <div className="flex gap-2 items-start">
              <input value={flagNote} onChange={(e) => setFlagNote(e.target.value)}
                placeholder="What needs clarifying?"
                className="flex-1 h-9 px-2 rounded-lg border border-border bg-white dark:bg-card text-sm text-black dark:text-white focus:outline-none focus:border-[#2D6A4F]/50" />
              <button type="button" onClick={async () => { await raiseFlag(key, flagNote, opts.raiserRole); setFlagNote(""); setOpenFlagField(null); }}
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
              aria-label="Flag this" title="Flag this"
              className="inline-flex items-center justify-center w-7 h-7 rounded-full text-black dark:text-white hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors">
              <Flag className="w-3.5 h-3.5" />
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
      field_values: { ...autofill, ...fieldValues }, updated_at: new Date().toISOString(),
    }).eq("id", doc.id);
    setSaving(false);
  }
  async function saveToggleSelection(key: string, value: string | boolean) {
    if (!doc) return;
    const updated = { ...(doc.toggle_selections ?? {}), [key]: value };
    if (key === "agreement_type" && value === "non_binding" && (updated.support_type === "financial" || updated.support_type === "hybrid")) {
      updated.support_type = "in_kind";
    }
    await supabase.from("mou_documents").update({
      toggle_selections: updated, updated_at: new Date().toISOString(),
    }).eq("id", doc.id);
    setDoc({ ...doc, toggle_selections: updated } as MouDoc);
  }
  async function completeOrgADetails() {
    if (!doc || !orgB) return;
    if (missingFieldLabels.length > 0 || dateValidationErrors.length > 0) return;
    if (!doc.signature_org_a_path) return;
    setSaving(true);
    const updates = {
      field_values: { ...autofill, ...fieldValues },
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
  async function raiseFlag(fieldKey: string, note: string, raiserRole: "org_a" | "org_b") {
    if (!doc || !note.trim()) return;
    const newFlag: FieldFlag = {
      id: `${Date.now()}-${fieldKey}`,
      field_key: fieldKey,
      note: note.trim(),
      raised_by: raiserRole,
      resolved: false,
      created_at: new Date().toISOString(),
    };
    const updatedFlags = [...(doc.field_flags ?? []), newFlag];
    // A new Org A flag means the document has changed since any earlier
    // Org B "no objection" confirmation -- that confirmation no longer
    // covers what's actually in front of Org A now, so it's invalidated
    // and Org B will need to confirm again once this flag is resolved.
    const flagUpdates: Partial<MouDoc> & Record<string, any> = {
      field_flags: updatedFlags, updated_at: new Date().toISOString(),
    };
    if (raiserRole === "org_a") flagUpdates.org_b_finalization_confirmed = false;
    await supabase.from("mou_documents").update(flagUpdates).eq("id", doc.id);
    setDoc({ ...doc, ...flagUpdates } as MouDoc);
    const raiserName = raiserRole === "org_a" ? orgA?.organisation_name : orgB?.organisation_name;
    await supabase.rpc("send_mou_notification", {
      p_document_id: doc.id,
      p_type: "mou_field_flagged",
      p_title: "A detail was flagged on your MoU",
      p_body: `${raiserName ?? "The other party"} flagged "${humanizeFieldLabel(fieldKey)}": ${note.trim()}`,
      p_link: `/dashboard/portfolio/mou`,
    });
  }
  async function resolveFlag(flagId: string) {
    if (!doc) return;
    const flag = (doc.field_flags ?? []).find((f) => f.id === flagId);
    const updatedFlags = (doc.field_flags ?? []).map((f) => (f.id === flagId ? { ...f, resolved: true } : f));
    await supabase.from("mou_documents").update({
      field_flags: updatedFlags, updated_at: new Date().toISOString(),
    }).eq("id", doc.id);
    setDoc({ ...doc, field_flags: updatedFlags } as MouDoc);
    if (flag) {
      const resolverName = flag.raised_by === "org_b" ? orgA?.organisation_name : orgB?.organisation_name;
      await supabase.rpc("send_mou_notification", {
        p_document_id: doc.id,
        p_type: "mou_flag_resolved",
        p_title: "A flagged detail was addressed",
        p_body: `${resolverName ?? "The other party"} resolved your flag on "${humanizeFieldLabel(flag.field_key)}": ${flag.note}`,
        p_link: `/dashboard/portfolio/mou`,
      });
    }
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
    if (!doc || !orgB) return;
    // Org A must have signed before the document can go to Org B -- an
    // unsigned send left Org B stuck with no way to sign their own side
    // or notify Org A to come back and sign. The DB trigger
    // (enforce_org_a_signed_before_send) is the real guarantee; this just
    // avoids a wasted round trip that would only end in a Postgres error.
    const alreadySigned = doc.source_type === "uploaded_pdf" ? !!doc.signed_files?.[doc.org_a_id ?? ""] : !!doc.signature_org_a_path;
    if (!alreadySigned) return;
    setSaving(true);
    // Same atomic-save principle as signing: whatever's currently in the
    // form must be captured here, or clicking Send right after filling
    // the form silently discards it -- this was a real data-loss bug,
    // not just a missing save.
    const updates: Record<string, any> = { status: "sent", field_values: { ...autofill, ...fieldValues }, updated_at: new Date().toISOString() };
    if (doc.source_type === "custom") updates.custom_content = customContent;
    await supabase.from("mou_documents").update(updates).eq("id", doc.id);
    setDoc({ ...doc, ...updates } as MouDoc);
    setSaving(false);
    // Org B has no visibility into this document at all until now (RLS
    // blocks it while draft), so this is the only way they'll find out
    // it exists.
    await supabase.rpc("send_mou_notification", {
      p_document_id: doc.id,
      p_type: "mou_sent",
      p_title: "New MoU to review",
      p_body: `${orgA?.organisation_name ?? "A partner"} has sent you an MoU to review.`,
      p_link: `/dashboard/portfolio/mou`,
    });
  }
  async function handleAgreeToIndicator(indicatorId: string) {
    if (!orgA || !orgB) return;
    const myOrgId = orgA.user_id === myUserId ? orgA.id : orgB.user_id === myUserId ? orgB.id : null;
    if (!myOrgId) return;
    const target = indicators.find((i) => i.id === indicatorId);
    setAgreeingIndicatorId(indicatorId);
    await agreeToIndicator(indicatorId, myOrgId);
    const refreshed = await fetchIndicators(documentId);
    setIndicators(refreshed);
    setAgreeingIndicatorId(null);
    const myName = myOrgId === orgA.id ? orgA.organisation_name : orgB.organisation_name;
    await supabase.rpc("send_mou_notification", {
      p_document_id: documentId,
      p_type: "mou_indicator_agreed",
      p_title: "Outcome indicator agreed",
      p_body: `${myName ?? "Your partner"} agreed to the indicator "${target?.name ?? "an outcome indicator"}".`,
      p_link: `/dashboard/portfolio/mou`,
    });
  }
  function myOrgIdFor(): string | null {
    return orgA?.user_id === myUserId ? orgA.id : orgB?.user_id === myUserId ? orgB.id : null;
  }
  function openEditIndicator(ind: PartnershipIndicator) {
    setRejectingIndicatorId(null);
    setEditingIndicatorId(ind.id);
    setEditDraft({
      name: ind.name, definition: ind.definition, baseline_value: ind.baseline_value ?? "",
      target_value: ind.target_value, measurement_window: ind.measurement_window, source: ind.source ?? "",
    });
  }
  function cancelEditIndicator() {
    setEditingIndicatorId(null);
  }
  // Proposes into suggested_* only -- the live indicator is untouched
  // until the other org explicitly accepts via resolveSuggestion(true).
  async function saveEditIndicator(indicatorId: string) {
    if (!editDraft.name.trim() || !editDraft.definition.trim() || !editDraft.target_value.trim() || !editDraft.measurement_window.trim()) return;
    if (!orgA || !orgB) return;
    const myOrgId = myOrgIdFor();
    if (!myOrgId) return;
    setSavingEdit(true);
    await proposeIndicatorRefinement(indicatorId, myOrgId, {
      name: editDraft.name.trim(), definition: editDraft.definition.trim(),
      baseline_value: editDraft.baseline_value.trim() || null, target_value: editDraft.target_value.trim(),
      measurement_window: editDraft.measurement_window.trim(), source: editDraft.source.trim() || null,
    });
    const refreshed = await fetchIndicators(documentId);
    setIndicators(refreshed);
    setSavingEdit(false);
    setEditingIndicatorId(null);
    const myName = myOrgId === orgA.id ? orgA.organisation_name : orgB.organisation_name;
    await supabase.rpc("send_mou_notification", {
      p_document_id: documentId,
      p_type: "mou_indicator_refinement_suggested",
      p_title: "Outcome indicator suggestion to review",
      p_body: `${myName ?? "Your partner"} suggested changes to the indicator "${editDraft.name.trim()}". Review and accept or dismiss.`,
      p_link: `/dashboard/portfolio/mou`,
    });
  }
  async function resolveSuggestion(ind: PartnershipIndicator, accept: boolean) {
    if (!orgA || !orgB) return;
    const myOrgId = myOrgIdFor();
    if (!myOrgId) return;
    setResolvingSuggestionId(ind.id);
    if (accept) {
      await acceptIndicatorRefinement(ind);
    } else {
      await dismissIndicatorRefinement(ind.id);
    }
    const refreshed = await fetchIndicators(documentId);
    setIndicators(refreshed);
    setResolvingSuggestionId(null);
    const myName = myOrgId === orgA.id ? orgA.organisation_name : orgB.organisation_name;
    await supabase.rpc("send_mou_notification", {
      p_document_id: documentId,
      p_type: accept ? "mou_indicator_refinement_accepted" : "mou_indicator_refinement_dismissed",
      p_title: accept ? "Outcome indicator suggestion accepted" : "Outcome indicator suggestion dismissed",
      p_body: accept
        ? `${myName ?? "Your partner"} accepted your suggested changes to "${ind.suggested_name ?? ind.name}".`
        : `${myName ?? "Your partner"} dismissed your suggested changes to "${ind.name}".`,
      p_link: `/dashboard/portfolio/mou`,
    });
  }
  function openReject(ind: PartnershipIndicator) {
    setEditingIndicatorId(null);
    setRejectingIndicatorId(ind.id);
    setRejectReasonDraft("");
  }
  function cancelReject() {
    setRejectingIndicatorId(null);
    setRejectReasonDraft("");
  }
  async function submitReject(indicatorId: string) {
    const myOrgId = myOrgIdFor();
    if (!myOrgId || !rejectReasonDraft.trim() || !orgA || !orgB) return;
    const target = indicators.find((i) => i.id === indicatorId);
    const reason = rejectReasonDraft.trim();
    setSubmittingReject(true);
    await rejectIndicator(indicatorId, myOrgId, reason);
    const refreshed = await fetchIndicators(documentId);
    setIndicators(refreshed);
    setSubmittingReject(false);
    setRejectingIndicatorId(null);
    setRejectReasonDraft("");
    const myName = myOrgId === orgA.id ? orgA.organisation_name : orgB.organisation_name;
    await supabase.rpc("send_mou_notification", {
      p_document_id: documentId,
      p_type: "mou_indicator_rejected",
      p_title: "Outcome indicator rejected",
      p_body: `${myName ?? "Your partner"} rejected the indicator "${target?.name ?? "an outcome indicator"}": ${reason}`,
      p_link: `/dashboard/portfolio/mou`,
    });
  }
  function dataUrlToBlob(dataUrl: string): Blob {
    const [header, base64] = dataUrl.split(",");
    const mime = header.match(/:(.*?);/)?.[1] ?? "image/png";
    const bytes = atob(base64);
    const array = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) array[i] = bytes.charCodeAt(i);
    return new Blob([array], { type: mime });
  }
  // pdf-lib's embedPng wants raw bytes, not a Blob -- same decode as
  // dataUrlToBlob above, just stopping one step earlier.
  function dataUrlToUint8Array(dataUrl: string): Uint8Array {
    const base64 = dataUrl.split(",")[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
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
    // Field edits (like a corrected dropdown selection) only live in local
    // state until an explicit Save click -- and signing triggers a reload
    // afterward that pulls field_values back from the database, silently
    // discarding anything unsaved. Persisting the current field values
    // here, atomically with the signature, closes that gap.
    const updates: Partial<MouDoc> & Record<string, any> = {
      field_values: { ...autofill, ...fieldValues },
      updated_at: new Date().toISOString(),
    };
    if (isOrgA) {
      updates.signature_org_a_path = path;
      updates.signed_at_org_a = new Date().toISOString();
    } else {
      updates.signature_org_b_path = path;
      updates.signed_at_org_b = new Date().toISOString();
    }
    // Signing no longer auto-executes the document on its own -- Org B's
    // signature only unlocks their "submit for final review" step, and
    // Org A's own later signature was always just the first-phase sign.
    // Full execution now only happens via the explicit finalizeDocument()
    // action Org A takes after reviewing Org B's submitted section.
    updates.status = doc.status === "draft" ? "sent" : doc.status;
    await supabase.from("mou_documents").update(updates).eq("id", doc.id);
    const updatedDoc = { ...doc, ...updates } as MouDoc;
    setDoc(updatedDoc);
    const myName = isOrgA ? orgA.organisation_name : orgB.organisation_name;
    const otherOrgName = isOrgA ? orgB.organisation_name : orgA.organisation_name;
    const otherAlreadySigned = isOrgA ? !!doc.signature_org_b_path : !!doc.signature_org_a_path;
    // Only tell the other party "it's ready for your signature" if they
    // actually haven't signed yet -- if they already signed (and possibly
    // locked), that copy falsely implies they need to act again.
    if (otherAlreadySigned) {
      await supabase.rpc("send_mou_notification", {
        p_document_id: doc.id,
        p_type: "mou_counterparty_signed",
        p_title: "Your MoU counterparty has signed",
        p_body: `${myName} has signed the MoU.`,
        p_link: `/dashboard/portfolio/mou`,
      });
    } else {
      await supabase.rpc("send_mou_notification", {
        p_document_id: doc.id,
        p_type: "mou_awaiting_signature",
        p_title: "MoU awaiting your signature",
        p_body: `${myName} has signed your MoU. It's ready for your signature.`,
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
    if (isOrgA) {
      const updates = { signature_locked_org_a: true, updated_at: new Date().toISOString() };
      await supabase.from("mou_documents").update(updates).eq("id", doc.id);
      setDoc({ ...doc, ...updates } as MouDoc);
      return;
    }
    // Org B: lock the signature server-side AND hand the document off to
    // Org A for final review, instead of finishing the document outright.
    const { error } = await supabase.rpc("finish_org_b_and_request_review", { p_document_id: doc.id });
    if (error) return;
    const updates = { signature_locked_org_b: true, status: "pending_org_a_final_review" as MouDoc["status"], org_b_submitted_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    setDoc({ ...doc, ...updates } as MouDoc);
    await supabase.rpc("send_mou_notification", {
      p_document_id: doc.id,
      p_type: "mou_pending_final_review",
      p_title: "MoU ready for your final review",
      p_body: `${orgB.organisation_name} has completed and signed their section. Review their details and finalize when ready.`,
      p_link: `/dashboard/portfolio/mou`,
    });
    load({ silent: true });
  }
  // Org A's terminal action -- only reachable once Org B has submitted and
  // signed, and only once every flag Org A raised on Org B's section has
  // been resolved. This is now the sole path to "fully_executed".
  async function finalizeDocument() {
    if (!doc || !orgA || !orgB) return;
    if (doc.status !== "pending_org_a_final_review") return;
    if (!doc.signed_at_org_a) { setFinalizeError("You need to sign your own section before this MoU can be fully executed."); return; }
    const stillUnresolved = (doc.field_flags ?? []).some((f) => !f.resolved && f.raised_by === "org_a");
    if (stillUnresolved) return;
    // Same principle as the signed-check above -- the DB trigger
    // (enforce_agreed_indicator_before_execution) is the real guarantee;
    // this just avoids a wasted round trip that would otherwise end in a
    // raw Postgres error. Requires actual agreement, not just existence --
    // an indicator Org A drafted alone doesn't satisfy this.
    const hasAgreedIndicator = indicators.some((i) => isIndicatorAgreed(i));
    if (!hasAgreedIndicator) {
      setFinalizeError("At least one outcome indicator, agreed by both parties, is required before this MoU can be fully executed.");
      return;
    }
    setFinalizing(true);
    setFinalizeError(null);
    const { error } = await supabase.rpc("finalize_mou_document", { p_document_id: doc.id });
    if (error) {
      setFinalizing(false);
      setFinalizeError("This MoU can't be finalized yet -- both parties need to have signed first.");
      return;
    }
    const pdf = buildPdf();
    let finalPath: string | null = null;
    if (pdf) {
      finalPath = `final/${doc.id}/executed.pdf`;
      const pdfBlob = pdf.output("blob");
      const { error: finalUploadError } = await supabase.storage
        .from("mou-documents").upload(finalPath, pdfBlob, { upsert: true });
      if (finalUploadError) finalPath = null;
      else await supabase.from("mou_documents").update({ final_document_path: finalPath }).eq("id", doc.id);
    }
    const updates: Partial<MouDoc> & Record<string, any> = { status: "fully_executed", fully_executed_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    if (finalPath) updates.final_document_path = finalPath;
    setDoc({ ...doc, ...updates } as MouDoc);
    await supabase.rpc("notify_mou_fully_executed", {
      p_document_id: doc.id,
      p_title: "MoU fully executed",
      p_body: `Your MoU with ${orgB.organisation_name} has been finalized and is now fully executed.`,
      p_link: `/dashboard/portfolio/mou`,
    });
    setFinalizing(false);
    load({ silent: true });
  }
  // Org A's deliberate follow-on step after execution -- separate from
  // finalizeDocument() by design, so writing the executed MoU back into
  // the initiative or partnership connection is never automatic. Org A
  // has to actively choose to mark it, and it can only fire once.
  async function confirmPartnershipStatus() {
    if (!doc || !orgA || !orgB) return;
    if (doc.status !== "fully_executed" || doc.partnership_status_confirmed) return;
    setConfirmingPartnershipStatus(true);
    const { error } = await supabase.rpc("confirm_partnership_status", { p_document_id: doc.id });
    setConfirmingPartnershipStatus(false);
    if (error) return;
    const updates = { partnership_status_confirmed: true, partnership_status_confirmed_at: new Date().toISOString() };
    setDoc({ ...doc, ...updates } as MouDoc);
  }
  // Org B's "no objection" gate for binding MoUs -- required before Org A
  // can finalize when agreement_type is binding, so Org A never has
  // unilateral sign-off power over a binding commitment.
  async function confirmFinalization() {
    if (!doc || !orgA || !orgB) return;
    if (doc.status !== "pending_org_a_final_review") return;
    const stillUnresolved = (doc.field_flags ?? []).some((f) => !f.resolved && f.raised_by === "org_a");
    if (stillUnresolved) return;
    setConfirmingFinalization(true);
    const { error } = await supabase.rpc("confirm_finalization", { p_document_id: doc.id });
    setConfirmingFinalization(false);
    if (error) return;
    const updates = { org_b_finalization_confirmed: true, org_b_confirmed_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    setDoc({ ...doc, ...updates } as MouDoc);
    await supabase.rpc("send_mou_notification", {
      p_document_id: doc.id,
      p_type: "mou_finalization_confirmed",
      p_title: "Counterparty confirmed — ready to finalize",
      p_body: `${orgB.organisation_name} has confirmed no objection. You can now finalize this MoU.`,
      p_link: `/dashboard/portfolio/mou`,
    });
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
  // Unified void-and-reopen action for any post-signature-lock edit --
  // covers custom_content (which previously had no lock at all), template
  // toggles, and the compiled preview text (which were already locked but
  // had no way back once frozen). Clears both signatures, unlocks both
  // parties, resets Org A's submitted-details state, and invalidates any
  // binding-MoU "no objection" confirmation -- same invalidation the flag
  // system already applies, just triggered by a bigger action. Steps
  // status back to draft so the whole flow restarts cleanly. Blocked once
  // fully executed -- that stays final.
  // Postgres RAISE EXCEPTION messages from this RPC (e.g. "cannot void a
  // fully executed MoU") are already written as plain sentences, not
  // technical jargon -- this just capitalizes and punctuates rather than
  // rewriting them, so a new server-side check added later still surfaces
  // correctly without needing a matching frontend string.
  function humanizeRpcError(message: string): string {
    const trimmed = message.trim();
    if (!trimmed) return "Something went wrong. Please try again.";
    const capitalized = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    return /[.!?]$/.test(capitalized) ? capitalized : `${capitalized}.`;
  }
  async function voidAndReopen() {
    if (!doc) return;
    setVoiding(true);
    setVoidError(null);
    const { error } = await supabase.rpc("void_and_reopen_mou", { p_document_id: doc.id });
    if (error) {
      setVoiding(false);
      // If the document turned out to already be fully executed (e.g. the
      // other party finalized it in another session and this client's
      // local state hadn't caught up yet), reload so the UI reflects
      // reality and the now-stale "Void signatures and reopen" option
      // disappears on its own.
      setVoidError(humanizeRpcError(error.message));
      load({ silent: true });
      return;
    }
    const voidingPartyName = isViewerOrgA ? orgA?.organisation_name : orgB?.organisation_name;
    await supabase.rpc("send_mou_notification", {
      p_document_id: doc.id,
      p_type: "mou_voided_reopened",
      p_title: "MoU reopened for editing",
      p_body: `${voidingPartyName ?? "The other party"} reopened this MoU for changes. Both signatures have been cleared and will need to be added again.`,
      p_link: `/dashboard/portfolio/mou`,
    });
    setVoiding(false);
    setShowVoidConfirm(false);
    setSignatureAUrl(null);
    setSignatureBUrl(null);
    load({ silent: true });
  }
  async function uploadSignedCopy(file: File) {
    if (!doc || !orgA || !orgB) return;
    setUploadIndicatorError(null);
    // Match the logged-in user to their actual org by user_id, not by
    // guessing from who created the document — the creator and uploader
    // can be different people on the same side, or either party at all.
    const myOrgId = orgA.user_id === myUserId ? orgA.id : orgB.user_id === myUserId ? orgB.id : null;
    if (!myOrgId) return;
    // If this signature would complete both sides (the other org has
    // already signed), check the same requirement finalizeDocument()
    // enforces for the template/custom path -- the DB trigger
    // (enforce_agreed_indicator_before_execution) is the real guarantee
    // regardless of path; this just avoids uploading a file only to hit
    // a raw Postgres error immediately after.
    const otherOrgId = myOrgId === doc.org_a_id ? doc.org_b_id : doc.org_a_id;
    const otherAlreadySigned = !!doc.signed_files?.[otherOrgId ?? ""];
    if (otherAlreadySigned && !indicators.some((i) => isIndicatorAgreed(i))) {
      setUploadIndicatorError("At least one outcome indicator, agreed by both parties, is required before this MoU can be fully executed.");
      return;
    }
    setUploadingSigned(true);
    const path = `signed/${doc.id}/${myUserId}-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
    const { error: uploadError } = await supabase.storage.from("mou-documents").upload(path, file);
    if (uploadError) { setUploadingSigned(false); return; }
    const updatedSignedFiles = { ...(doc.signed_files ?? {}), [myOrgId]: path };
    const bothSigned = updatedSignedFiles[doc.org_a_id ?? ""] && updatedSignedFiles[doc.org_b_id ?? ""];
    const newStatus = bothSigned ? "fully_executed" : (doc.status === "draft" ? "sent" : doc.status);
    // The row update was previously fired without checking its result --
    // if it failed (e.g. a DB constraint rejected the transition), this
    // still ran setDoc() unconditionally, showing "fully executed" in the
    // UI while the database silently kept the old status. The file is
    // already uploaded and safe at this point either way, so on failure
    // this just reloads from the database instead of trusting local state.
    const { error: updateError } = await supabase.from("mou_documents").update({
      signed_files: updatedSignedFiles, status: newStatus,
      ...(bothSigned ? { fully_executed_at: new Date().toISOString() } : {}),
      updated_at: new Date().toISOString(),
    }).eq("id", doc.id);
    if (updateError) {
      setUploadingSigned(false);
      load({ silent: true });
      return;
    }
    setDoc({ ...doc, signed_files: updatedSignedFiles, status: newStatus as MouDoc["status"] });
    setUploadingSigned(false);
  }
  // In-platform signing for uploaded_pdf documents. Appends a new final
  // page to the ORIGINAL uploaded file (not onto the other party's
  // already-signed copy -- each party's signed copy is independent, same
  // as the upload-fallback path already worked). Only offered when the
  // original upload is an actual PDF; pdf-lib can't append to a Word doc,
  // so .doc/.docx uploads fall back to the upload-only flow further down.
  async function composeAndSignPdf(dataUrl: string) {
    if (!doc || !orgA || !orgB || !uploadedFileUrl) return;
    setUploadIndicatorError(null);
    const myOrgId = orgA.user_id === myUserId ? orgA.id : orgB.user_id === myUserId ? orgB.id : null;
    if (!myOrgId) return;
    // Same check as uploadSignedCopy -- see comment there.
    const otherOrgId = myOrgId === doc.org_a_id ? doc.org_b_id : doc.org_a_id;
    const otherAlreadySigned = !!doc.signed_files?.[otherOrgId ?? ""];
    if (otherAlreadySigned && !indicators.some((i) => isIndicatorAgreed(i))) {
      setUploadIndicatorError("At least one outcome indicator, agreed by both parties, is required before this MoU can be fully executed.");
      return;
    }
    setComposingSignature(true);
    try {
      const originalBytes = await fetch(uploadedFileUrl).then((r) => r.arrayBuffer());
      const pdfDoc = await PDFDocument.load(originalBytes);
      const sigImage = await pdfDoc.embedPng(dataUrlToUint8Array(dataUrl));
      const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
      const boldFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
      const pages = pdfDoc.getPages();
      const lastPage = pages[pages.length - 1];
      const { width, height } = lastPage ? lastPage.getSize() : { width: 595.28, height: 841.89 };
      const signaturePage = pdfDoc.addPage([width, height]);
      const margin = 56;
      let y = height - margin - 40;
      const isOrgA = myOrgId === doc.org_a_id;
      const orgName = isOrgA ? orgA.organisation_name : orgB.organisation_name;
      signaturePage.drawText("Signature Page", { x: margin, y, size: 16, font: boldFont, color: rgb(0.176, 0.416, 0.31) });
      y -= 40;
      signaturePage.drawText(`For ${orgName}:`, { x: margin, y, size: 11, font: boldFont, color: rgb(0.067, 0.067, 0.067) });
      y -= 70;
      const sigDims = sigImage.scaleToFit(180, 60);
      signaturePage.drawImage(sigImage, { x: margin, y, width: sigDims.width, height: sigDims.height });
      y -= 20;
      signaturePage.drawLine({ start: { x: margin, y }, end: { x: margin + 220, y }, thickness: 0.5, color: rgb(0.067, 0.067, 0.067) });
      y -= 16;
      signaturePage.drawText(new Date().toLocaleDateString("en-GB"), { x: margin, y, size: 10, font, color: rgb(0.067, 0.067, 0.067) });
      y -= 30;
      signaturePage.drawText("Signed in-platform via Impact Natives.", { x: margin, y, size: 8, font, color: rgb(0.47, 0.47, 0.47) });
      const signedBytes = await pdfDoc.save();
      const signedBlob = new Blob([signedBytes.buffer as ArrayBuffer], { type: "application/pdf" });
      const sigPngPath = `signatures/${doc.id}/${myOrgId}-${Date.now()}.png`;
      const signedPdfPath = `signed/${doc.id}/${myUserId}-${Date.now()}-signed.pdf`;
      const { error: pngError } = await supabase.storage.from("mou-documents").upload(sigPngPath, dataUrlToBlob(dataUrl));
      if (pngError) return;
      const { error: pdfUploadError } = await supabase.storage.from("mou-documents").upload(signedPdfPath, signedBlob);
      if (pdfUploadError) return;
      const updatedSignedFiles = { ...(doc.signed_files ?? {}), [myOrgId]: signedPdfPath };
      const bothSigned = updatedSignedFiles[doc.org_a_id ?? ""] && updatedSignedFiles[doc.org_b_id ?? ""];
      const newStatus = bothSigned ? "fully_executed" : (doc.status === "draft" ? "sent" : doc.status);
      const updates: Partial<MouDoc> & Record<string, any> = {
        signed_files: updatedSignedFiles,
        status: newStatus,
        updated_at: new Date().toISOString(),
      };
      if (isOrgA) {
        updates.signature_org_a_path = sigPngPath;
        updates.signed_at_org_a = new Date().toISOString();
      } else {
        updates.signature_org_b_path = sigPngPath;
        updates.signed_at_org_b = new Date().toISOString();
      }
      await supabase.from("mou_documents").update(updates).eq("id", doc.id);
      setDoc({ ...doc, ...updates } as MouDoc);
    } finally {
      setComposingSignature(false);
    }
    load({ silent: true });
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
    const RULE_GREY: [number, number, number] = [170, 170, 170];
    // Times is the classic formal/legal document serif -- more legible and
    // appropriately formal for a signed agreement than the brand's display
    // sans (Bricolage), which stays reserved for in-app UI, not this document.
    function ensureSpace(neededHeight: number) {
      if (y + neededHeight > pageHeight - margin) { pdf.addPage(); y = margin; }
    }
    function writeParagraph(text: string, opts: { size?: number; bold?: boolean; gap?: number } = {}) {
      const size = opts.size ?? 10.5;
      pdf.setFont("times", opts.bold ? "bold" : "normal");
      pdf.setFontSize(size);
      pdf.setTextColor(...BLACK);
      const lines: string[] = pdf.splitTextToSize(text, contentWidth);
      const lineHeight = size * 1.4;
      ensureSpace(lines.length * lineHeight);
      lines.forEach((line, i) => pdf.text(line, margin, y + i * lineHeight));
      y += lines.length * lineHeight + (opts.gap ?? 14);
    }
    let sectionCounter = 0;
    function writeSectionHeader(text: string, numbered: boolean = true) {
      if (numbered) sectionCounter += 1;
      ensureSpace(20);
      pdf.setFont("times", "bold");
      pdf.setFontSize(11);
      pdf.setTextColor(...FOREST_GREEN);
      pdf.text(numbered ? `SECTION ${sectionCounter}: ${text.toUpperCase()}` : text.toUpperCase(), margin, y);
      y += 18;
    }
    function writeDivider() {
      ensureSpace(16);
      pdf.setDrawColor(...RULE_GREY);
      pdf.setLineWidth(0.75);
      pdf.line(margin, y, margin + contentWidth, y);
      y += 16;
    }
    // Bullet/numbered lines are indented inward from the body margin
    // (bullet glyph at margin+18, wrapped text at margin+36) to match
    // Word's default list-indent convention, rather than sitting flush
    // with ordinary paragraph text.
    function writeSectionBody(text: string) {
      const lines = text.split(/\n+/).filter((l) => l.trim().length > 0);
      const bulletRegex = /^[-*]\s+(.*)/;
      const numberRegex = /^(\d+)[.)]\s+(.*)/;
      const bulletX = margin + 18;
      const textX = margin + 36;
      lines.forEach((line) => {
        const bulletMatch = line.match(bulletRegex);
        const numberMatch = line.match(numberRegex);
        const lineHeight = 10.5 * 1.4;
        if (bulletMatch) {
          const wrapped: string[] = pdf.splitTextToSize(bulletMatch[1], contentWidth - (textX - margin));
          ensureSpace(wrapped.length * lineHeight);
          pdf.setFont("times", "normal");
          pdf.setFontSize(10.5);
          pdf.setTextColor(...BLACK);
          pdf.text("•", bulletX, y);
          wrapped.forEach((wl, i) => pdf.text(wl, textX, y + i * lineHeight));
          y += wrapped.length * lineHeight + 4;
        } else if (numberMatch) {
          const wrapped: string[] = pdf.splitTextToSize(numberMatch[2], contentWidth - (textX - margin));
          ensureSpace(wrapped.length * lineHeight);
          pdf.setFont("times", "normal");
          pdf.setFontSize(10.5);
          pdf.setTextColor(...BLACK);
          pdf.text(`${numberMatch[1]}.`, bulletX, y);
          wrapped.forEach((wl, i) => pdf.text(wl, textX, y + i * lineHeight));
          y += wrapped.length * lineHeight + 4;
        } else {
          writeParagraph(line, { gap: 8 });
        }
      });
      y += 6;
    }
    // Parties block: a fixed, hand-laid-out structure (numbered org blocks
    // with indented sub-fields, "AND" between them) rather than wrapped
    // paragraph text -- this level of layout control isn't something the
    // generic placeholder-substitution pipeline can produce. Skipped in
    // favour of the generic renderer if the person has hand-edited this
    // section via the document preview, so their edits are never silently
    // discarded.
    function writePartiesBlock() {
      const agreementDate = resolvedValue("agreement_date") || "[Agreement Date]";
      writeParagraph(`This Agreement is entered into on ${sanitizeForPdf(agreementDate)}, by and between:`, { gap: 16 });
      function writeParty(index: number, prefix: "a" | "b") {
        const name = resolvedValue(`org_${prefix}_name`) || `[Org ${prefix.toUpperCase()} Name]`;
        const entityType = resolvedValue(`org_${prefix}_entity_type`) || "[Entity Type]";
        const country = resolvedValue(`org_${prefix}_country`) || "[Country]";
        const address = resolvedValue(`org_${prefix}_address`) || "[Address]";
        const signatoryName = resolvedValue(`org_${prefix}_signatory_name`) || "[Signatory Name]";
        const signatoryTitle = resolvedValue(`org_${prefix}_signatory_title`) || "[Signatory Title]";
        const contact = resolvedValue(`org_${prefix}_contact`) || "[Contact]";
        const numberIndent = 18;
        const fieldIndent = 22;
        ensureSpace(16);
        pdf.setFont("times", "bold");
        pdf.setFontSize(11);
        pdf.setTextColor(...BLACK);
        pdf.text(`${index}.`, margin, y);
        pdf.text(sanitizeForPdf(name).toUpperCase(), margin + numberIndent, y);
        y += 16;
        const fields = [
          `Entity Type: A ${sanitizeForPdf(entityType)} registered in ${sanitizeForPdf(country)}.`,
          `Address: ${sanitizeForPdf(address)}`,
          `Represented by: ${sanitizeForPdf(signatoryName)}, ${sanitizeForPdf(signatoryTitle)}`,
          `Contact: ${sanitizeForPdf(contact)}`,
        ];
        pdf.setFont("times", "normal");
        pdf.setFontSize(10.5);
        fields.forEach((line) => {
          const wrapped: string[] = pdf.splitTextToSize(line, contentWidth - fieldIndent);
          const lineHeight = 10.5 * 1.4;
          ensureSpace(wrapped.length * lineHeight);
          wrapped.forEach((wl, i) => pdf.text(wl, margin + fieldIndent, y + i * lineHeight));
          y += wrapped.length * lineHeight + 2;
        });
        y += 8;
      }
      writeParty(1, "a");
      ensureSpace(24);
      pdf.setFont("times", "italic");
      pdf.setFontSize(10.5);
      pdf.setTextColor(...BLACK);
      pdf.text("AND", margin, y);
      y += 20;
      writeParty(2, "b");
      y += 4;
    }
    // Technical Annex -- Outcome Indicators. Only ever includes indicators
    // agreed (agreed_by_other_org_at) at or before the moment this PDF is
    // built. The one buildPdf() call inside finalizeDocument() runs before
    // local state has fully_executed_at set, so this naturally captures
    // exactly what's agreed as of execution. Any later re-export filters
    // against the persisted fully_executed_at instead, reproducing that
    // same frozen set even though indicators remain addable (and `indicators`
    // itself keeps growing) after execution. Same freeze-at-execution outcome
    // as edited_sections/custom_content, just derived from an existing
    // timestamp rather than a new snapshot column.
    // Live/current agreement state only -- no execution-timestamp gate.
    // final_document_path (written once, at the instant finalizeDocument()
    // calls this function) is what freezes the historical record; this
    // filter drives the LIVE export button, which should reflect the
    // present, including indicators agreed after execution.
    const annexIndicators = indicators.filter((i) => isIndicatorAgreed(i));
    function writeIndicatorAnnex() {
      if (annexIndicators.length === 0) return;
      pdf.setFont("times", "bold");
      pdf.setFontSize(13);
      pdf.setTextColor(...FOREST_GREEN);
      pdf.text("ANNEX A: OUTCOME INDICATORS", margin, y);
      y += 18;
      pdf.setFont("times", "italic");
      pdf.setFontSize(9);
      pdf.setTextColor(...BLACK);
      pdf.text("Indicators mutually agreed by both parties, referenced under this Agreement.", margin, y);
      y += 24;
      annexIndicators.forEach((ind, idx) => {
        ensureSpace(20);
        pdf.setFont("times", "bold");
        pdf.setFontSize(10.5);
        pdf.setTextColor(...BLACK);
        pdf.text(`${idx + 1}. ${sanitizeForPdf(ind.name)}`, margin, y);
        y += 15;
        const rows: [string, string][] = [
          ["Definition", ind.definition],
          ["Baseline", ind.baseline_value || "Not specified"],
          ["Target", ind.target_value],
          ["Measurement window", ind.measurement_window],
        ];
        if (ind.source) rows.push(["Source", ind.source]);
        rows.forEach(([label, value]) => {
          const lineHeight = 10.5 * 1.4;
          const wrapped: string[] = pdf.splitTextToSize(sanitizeForPdf(value), contentWidth - 130);
          ensureSpace(wrapped.length * lineHeight);
          pdf.setFont("times", "bold");
          pdf.setFontSize(10.5);
          pdf.setTextColor(...BLACK);
          pdf.text(`${label}:`, margin + 12, y);
          pdf.setFont("times", "normal");
          wrapped.forEach((wl, i) => pdf.text(wl, margin + 130, y + i * lineHeight));
          y += wrapped.length * lineHeight + 2;
        });
        y += 10;
      });
      y += 4;
    }
    // Document header -- centered, formal title block.
    pdf.setFont("times", "bold");
    pdf.setFontSize(20);
    pdf.setTextColor(...FOREST_GREEN);
    pdf.text("MEMORANDUM OF UNDERSTANDING", pageWidth / 2, y, { align: "center" });
    y += 26;
    pdf.setFont("times", "italic");
    pdf.setFontSize(11.5);
    pdf.setTextColor(...BLACK);
    pdf.text(sanitizeForPdf(`${orgA.organisation_name} and ${orgB.organisation_name}`), pageWidth / 2, y, { align: "center" });
    y += 30;
    if (doc.source_type === "custom") {
      writeParagraph(sanitizeForPdf(customContent) || "No content added yet.");
    } else {
      displaySections.forEach((s) => {
        if (s.id === "parties" && !doc.edited_sections) {
          writePartiesBlock();
          writeDivider();
        } else {
          writeSectionHeader(s.title);
          writeSectionBody(sanitizeForPdf(s.body));
        }
      });
    }
    // Signature block -- composites the actual captured signature images at
    // fixed coordinates. This only works because Impact Natives controls
    // this document's layout end to end; an uploaded external PDF's layout
    // is unknown, so that path keeps the sign-externally-and-upload-back
    // flow instead of compositing onto it.
    ensureSpace(180);
    writeDivider();
    writeSectionHeader("Signatures", false);
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
      pdf.setFont("times", "bold");
      pdf.setFontSize(10.5);
      pdf.setTextColor(...BLACK);
      pdf.text(`For ${sanitizeForPdf(orgName)}:`, x, cy);
      cy += 18;
      if (sigImg) {
        pdf.addImage(sigImg, "PNG", x, cy - 12, sigWidth, sigHeight);
        cy += sigHeight - 8;
      } else {
        pdf.setDrawColor(...BLACK);
        pdf.setLineWidth(0.5);
        pdf.line(x, cy + 20, x + colWidth, cy + 20);
        cy += 24;
      }
      pdf.setFont("times", "normal");
      pdf.setFontSize(10);
      pdf.setTextColor(...BLACK);
      const nameLine = signatoryName && signatoryTitle
        ? `${sanitizeForPdf(signatoryName)}, ${sanitizeForPdf(signatoryTitle)}`
        : "[Name], [Title]";
      pdf.text(nameLine, x, cy);
      cy += 22;
      pdf.setDrawColor(...BLACK);
      pdf.setLineWidth(0.5);
      pdf.line(x, cy, x + colWidth, cy);
      cy += 16;
      pdf.text(signedAt ? new Date(signedAt).toLocaleDateString("en-GB") : "Date", x, cy);
    }
    writeSignatureColumn(margin, orgA.organisation_name, signatureAImg,
      resolvedValue("org_a_signatory_name"), resolvedValue("org_a_signatory_title"), doc.signed_at_org_a);
    writeSignatureColumn(margin + colWidth + colGap, orgB.organisation_name, signatureBImg,
      resolvedValue("org_b_signatory_name"), resolvedValue("org_b_signatory_title"), doc.signed_at_org_b);
    y = blockTop + 18 + 24 + 22 + 16 + 10;
    // Annex sits on its own forced page, after signatures -- standard
    // schedule/appendix placement, not part of the numbered section flow.
    if (annexIndicators.length > 0) {
      pdf.addPage();
      y = margin;
      writeIndicatorAnnex();
    }
    const pageCount = pdf.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      pdf.setFont("times", "normal");
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
  if (notFound) {
    return (
      <div className="max-w-lg mx-auto py-24 px-6">
        <InfoBanner tone="locked" icon={X}>
          This MoU isn't available. It may not exist, or you may not have access to it yet.
        </InfoBanner>
        <button type="button" onClick={onClose}
          className="mt-4 flex items-center gap-1.5 text-sm text-black dark:text-white hover:underline">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
      </div>
    );
  }
  if (loading || !doc) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 text-[#2D6A4F] animate-spin" />
      </div>
    );
  }
  const aPartyDeleted = doc.org_a_id === null || doc.org_b_id === null;
  const iAmCreator = myUserId === doc.created_by;
  const hasUnresolvedOrgBFlags = (doc.field_flags ?? []).some((f) => !f.resolved && f.raised_by === "org_b");
  const hasUnresolvedOrgAFlags = (doc.field_flags ?? []).some((f) => !f.resolved && f.raised_by === "org_a");
  const orgADetailsEditable = isViewerOrgA && doc.status !== "fully_executed" && (!doc.details_completed_by_org_a || hasUnresolvedOrgBFlags);
  const orgBCanFillTheirPart = doc.details_completed_by_org_a && !hasUnresolvedOrgBFlags;
  const orgBSubmittedForReview = doc.status === "pending_org_a_final_review" || doc.status === "fully_executed";
  const orgBFieldsEditable = isViewerOrgB && doc.status !== "fully_executed" && (!orgBSubmittedForReview || hasUnresolvedOrgAFlags);
  const exportDisabledForOrgB = isViewerOrgB && doc.status === "pending_org_a_final_review";
  const isBindingMou = doc.toggle_selections?.["agreement_type"] === "binding";
  // Which field proves Org A has signed depends on source_type -- template/
  // custom docs sign via signature_org_a_path, uploaded_pdf docs sign via
  // signed_files keyed by org id. Mirrors the check the DB trigger
  // (enforce_org_a_signed_before_send) applies server-side.
  const orgAHasSigned = doc.source_type === "uploaded_pdf" ? !!doc.signed_files?.[doc.org_a_id ?? ""] : !!doc.signature_org_a_path;
  const orgBConfirmationPending = isBindingMou && !doc.org_b_finalization_confirmed;
  const orgBCanConfirmFinalization =
    isViewerOrgB && doc.status === "pending_org_a_final_review" && !hasUnresolvedOrgAFlags && orgBConfirmationPending;
  const finalizeBlockedOnOrgBConfirmation = doc.status === "pending_org_a_final_review" && !hasUnresolvedOrgAFlags && orgBConfirmationPending;
  // Toggles change the actual clause text, so once either party has signed
  // anything, changing them would silently alter what was already agreed
  // to and signed -- same reasoning as the preview-text lock.
  const togglesEditable = isViewerOrgA && doc.status !== "fully_executed" && !doc.signature_org_a_path && !doc.signature_org_b_path;  // Same underlying condition as previewLocked/togglesEditable -- once any
  // signature exists, content is frozen. Void & Reset is the only way back,
  // and it's unavailable once the document is fully executed.
  const canVoidAndReopen = previewLocked && doc.status !== "fully_executed";
  // pdf-lib can only append a page to an actual PDF -- a .doc/.docx
  // original has no such capability, so those go straight to the
  // upload-and-verify fallback with no inline option offered at all.
  const canSignUploadedPdfInline = doc.source_type === "uploaded_pdf" && !!doc.rendered_file_path?.toLowerCase().endsWith(".pdf");
  // Stage tracker -- built from the actual granular flags on the document
  // (signature locks, details_completed_by_org_a, org_b_finalization_confirmed,
  // partnership_status_confirmed) rather than the single `status` string.
  // Raw status conflates "someone signed" with "sent to the other party",
  // which is exactly what made the old header label misleading -- this
  // instead shows every real stage, what's done, and who's next.
  const orgAName = orgA?.organisation_name ?? "Org A";
  const orgBName = orgB?.organisation_name ?? "Org B";
  const stages: { key: string; label: string; completed: boolean; blocked?: string }[] = [];
  if (doc.source_type === "template") {
    stages.push({
      key: "org_a_prepare",
      label: `${orgAName} fills in details and signs`,
      completed: doc.details_completed_by_org_a && !hasUnresolvedOrgBFlags,
    });
    stages.push({
      key: "org_b_review",
      label: `${orgBName} reviews, fills in their details, and signs`,
      completed: orgBSubmittedForReview,
      blocked: !doc.details_completed_by_org_a
        ? `Waiting on ${orgAName}`
        : hasUnresolvedOrgBFlags
        ? `${orgAName} is resolving flags you raised`
        : undefined,
    });
  } else if (doc.source_type === "uploaded_pdf") {
    stages.push({ key: "org_a_sign", label: `${orgAName} uploads their signed copy`, completed: !!doc.signed_files?.[doc.org_a_id ?? ""] });
    stages.push({ key: "org_b_sign", label: `${orgBName} uploads their signed copy`, completed: !!doc.signed_files?.[doc.org_b_id ?? ""] });
  } else {
    stages.push({ key: "org_a_sign", label: `${orgAName} signs`, completed: doc.signature_locked_org_a });
    stages.push({ key: "org_b_sign", label: `${orgBName} signs`, completed: doc.signature_locked_org_b });
  }
  if (isBindingMou) {
    stages.push({
      key: "org_b_confirm",
      label: `${orgBName} confirms no objection (binding agreement)`,
      completed: doc.org_b_finalization_confirmed,
      blocked: hasUnresolvedOrgAFlags ? `Resolve ${orgAName}'s flags first` : undefined,
    });
  }
  stages.push({
    key: "org_a_finalize",
    label: `${orgAName} finalizes — fully executes the MoU`,
    completed: doc.status === "fully_executed",
    blocked: hasUnresolvedOrgAFlags
      ? `Resolve ${orgAName}'s flags first`
      : isBindingMou && !doc.org_b_finalization_confirmed
      ? `Waiting on ${orgBName}'s confirmation`
      : undefined,
  });
  stages.push({
    key: "mark_partnership",
    label: `${orgAName} marks the partnership as executed`,
    completed: doc.partnership_status_confirmed,
  });
  const currentStage = stages.find((s) => !s.completed);
  const trackerStatusText = !currentStage ? "Complete" : currentStage.blocked ?? `Next: ${currentStage.label}`;
  return (
    <div className="space-y-6">
      <button type="button" onClick={onClose}
        className="flex items-center gap-1.5 text-sm text-black dark:text-white hover:text-[#C45C26] dark:hover:text-[#C45C26] transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> Back
      </button>
      {/* Reachable at any scroll depth -- exits immediately without
          scrolling to the top link. The single chevron flips direction
          based on scroll position: near the top, it jumps down to
          Indicators; anywhere past that, it returns to the top instead
          of offering a second fixed direction to jump to. */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-2">
        <button type="button" onClick={onClose} title="Back"
          className="w-9 h-9 rounded-full bg-[#2D6A4F] hover:bg-[#245c43] text-white shadow-lg flex items-center justify-center transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
        </button>
        <button type="button"
          onClick={() => {
            if (nearTop) document.getElementById("indicators-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
            else window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          title={nearTop ? "Jump to indicators" : "Scroll to top"}
          className="w-9 h-9 rounded-full border border-border bg-white dark:bg-card text-black dark:text-white shadow-lg flex items-center justify-center hover:border-[#2D6A4F]/50 transition-colors">
          {nearTop ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        </button>
      </div>
      <h2 className="text-2xl font-bold text-foreground tracking-tight">
        MoU — {orgA?.organisation_name} & {orgB?.organisation_name}
      </h2>
      {aPartyDeleted && (
        <InfoBanner tone="locked" icon={Lock}>
          One of the organisations on this MoU has been deleted. The document is preserved for your records, but signing, sending, and export are no longer available.
        </InfoBanner>
      )}
      {/* Template: fillable fields */}
          {doc.source_type === "template" && (
            <>
              {template && template.toggles && template.toggles.length > 0 && (
                <SectionCard icon={Users} eyebrow="Agreement terms" title="Clauses & conditions"
                  description={togglesEditable
                    ? "These control which clauses appear in the document. Locked once either party signs."
                    : "Set at document creation. Locked because a signature exists on this document."}>
                  <div className="space-y-4">
                    {template.toggles.map((t) => {
                      const currentValue = doc.toggle_selections?.[t.key];
                      return (
                        <div key={t.key}>
                          <p className="text-sm font-medium text-black dark:text-white mb-2">{t.label}</p>
                          {t.type === "select" ? (
                            <select
                              value={currentValue !== undefined && currentValue !== null ? String(currentValue) : ""}
                              disabled={!togglesEditable}
                              onChange={(e) => {
                                const opt = t.options.find((o) => String(o.value) === e.target.value);
                                if (opt) saveToggleSelection(t.key, opt.value);
                              }}
                              className="w-full h-10 px-3 rounded-lg border border-border bg-white dark:bg-card text-base text-black dark:text-white focus:outline-none focus:border-[#2D6A4F]/50 disabled:cursor-not-allowed disabled:opacity-70"
                            >
                              <option value="" disabled>Select...</option>
                              {visibleToggleOptions(t).map((opt) => (
                                <option key={String(opt.value)} value={String(opt.value)}>
                                  {opt.label ?? String(opt.value)}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <select
                              value={currentValue === true ? "true" : currentValue === false ? "false" : ""}
                              disabled={!togglesEditable}
                              onChange={(e) => saveToggleSelection(t.key, e.target.value === "true")}
                              className="w-full h-10 px-3 rounded-lg border border-border bg-white dark:bg-card text-base text-black dark:text-white focus:outline-none focus:border-[#2D6A4F]/50 disabled:cursor-not-allowed disabled:opacity-70"
                            >
                              <option value="" disabled>Select...</option>
                              <option value="true">Yes</option>
                              <option value="false">No</option>
                            </select>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </SectionCard>
              )}
              {allFieldKeys.length > 0 && (
                <div className="space-y-5">
                  <div>
                    <p className="text-base font-semibold text-black dark:text-white">Fill in the details</p>
                    <p className="text-sm text-black dark:text-white">
                      {isViewerOrgA
                        ? "Complete your organisation's details and the shared agreement details below, then sign. Once you submit, we'll notify the other party to review."
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
                            {(isViewerOrgA || isViewerOrgB) && renderFlagsForField(key, { canRaise: isViewerOrgB && !!doc?.details_completed_by_org_a, raiserRole: "org_b" })}
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
                            {(isViewerOrgA || isViewerOrgB) && renderFlagsForField(key, { canRaise: isViewerOrgB && !!doc?.details_completed_by_org_a, raiserRole: "org_b" })}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {groupedFieldKeys.orgBKeys.length > 0 && (
                    <div className="rounded-xl border border-border p-4 space-y-3">
                      <p className="text-sm font-semibold text-[#2D6A4F] uppercase tracking-wide">
                        {orgB?.organisation_name || "Partner organisation"}
                      </p>
                      {isViewerOrgA && !orgBSubmittedForReview ? (
                        <p className="text-sm text-black dark:text-white">
                          {orgB?.organisation_name || "The other party"} will complete this after your details are submitted.
                        </p>
                      ) : isViewerOrgB && !doc.details_completed_by_org_a ? (
                        <p className="text-sm text-black dark:text-white">
                          Available once {orgA?.organisation_name ?? "the other party"} submits their details.
                        </p>
                      ) : isViewerOrgB && hasUnresolvedOrgBFlags ? (
                        <p className="text-sm text-black dark:text-white">
                          Resolve open flags above before filling in your details.
                        </p>
                      ) : (
                        <>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {groupedFieldKeys.orgBKeys.map((key) => (
                              <div key={key} className={isDescriptionField(key) ? "sm:col-span-2" : ""}>
                                {renderFieldInput(key, isViewerOrgA ? true : !orgBFieldsEditable)}
                                {orgBSubmittedForReview && (isViewerOrgA || isViewerOrgB) &&
                                  renderFlagsForField(key, { canRaise: isViewerOrgA && doc.status === "pending_org_a_final_review", raiserRole: "org_a" })}
                              </div>
                            ))}
                          </div>
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
                    {isViewerOrgB
                      ? `This is a read-only preview. Use the flag icon on any clause to ask ${orgA?.organisation_name ?? "the other party"} to change it.`
                      : previewLocked
                      ? "This text is locked because a signature has been added."
                      : "Edit any clause directly — erase what doesn't apply, adjust wording as needed."}
                   </p>
                </div>
                {displaySections.map((s) => (
                  <div key={s.id}>
                    <p className="text-sm font-semibold uppercase tracking-wide text-black dark:text-white mb-1">{s.title}</p>
                    {canEditDocumentContent ? (
                      <textarea
                        value={s.body}
                        onChange={(e) => handleSectionEdit(s.id, e.target.value)}
                        rows={Math.max(3, Math.ceil(s.body.length / 80))}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-white dark:bg-card text-base text-black dark:text-white leading-relaxed focus:outline-none focus:border-[#2D6A4F]/50 resize-y"
                      />
                    ) : (
                      <p className="text-base text-black dark:text-white leading-relaxed whitespace-pre-line">
                        {s.body}
                      </p>
                    )}
                    {(isViewerOrgA || isViewerOrgB) &&
                      renderFlagsForField(`section:${s.id}`, { canRaise: isViewerOrgB && doc.status !== "fully_executed", raiserRole: "org_b" })}
                  </div>
                ))}
                {canEditDocumentContent && Object.keys(sectionOverrides).length > 0 && (
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
              {isViewerOrgB ? (
                <p className="text-sm text-black dark:text-white">
                  This is a read-only preview. Use the flag icon below to ask {orgA?.organisation_name ?? "the other party"} to change anything.
                </p>
              ) : previewLocked && (
                <p className="text-sm text-black dark:text-white">
                  This text is locked because a signature has been added.
                </p>
              )}
              {canEditDocumentContent ? (
                <textarea
                  value={customContent}
                  onChange={(e) => setCustomContent(e.target.value)}
                  onBlur={saveCustomContent}
                  rows={16}
                  placeholder="Write the full text of your agreement here..."
                  className="w-full px-4 py-3 rounded-xl border border-border bg-white dark:bg-card text-base text-black dark:text-white leading-relaxed focus:outline-none focus:border-[#2D6A4F]/50 resize-y"
                />
              ) : (
                <p className="w-full px-4 py-3 rounded-xl border border-border bg-white dark:bg-card text-base text-black dark:text-white leading-relaxed whitespace-pre-line">
                  {customContent}
                </p>
              )}
              {(isViewerOrgA || isViewerOrgB) &&
                renderFlagsForField("custom_content", { canRaise: isViewerOrgB && doc.status !== "fully_executed", raiserRole: "org_b" })}
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
          {/* Outcome indicators -- required (agreed by both parties) before
              full execution, not before send. Either party can add one;
              only the party that didn't create it can mark agreement. */}
          <SectionCard id="indicators-section" icon={Target} eyebrow="Outcome indicators" title="Measurable outcomes"
            description="At least one, agreed by both parties, is required before this MoU can be fully executed."
            action={orgA && (
              <button type="button" onClick={() => setShowIndicatorForm(true)}
                className="shrink-0 text-sm font-bold px-5 py-2.5 rounded-full bg-[#2D6A4F] hover:bg-[#245c43] text-white shadow-sm transition-colors">
                Add indicator
              </button>
            )}>
            {loadingIndicators ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-4 h-4 text-[#2D6A4F] animate-spin" />
              </div>
            ) : indicators.length === 0 ? (
              <p className="text-sm text-black dark:text-white">No indicators added yet.</p>
            ) : (
              <div className="space-y-4">
                {indicators.map((ind) => {
                  const status = indicatorStatus(ind);
                  const pillMeta = INDICATOR_AGREEMENT_LABEL[status];
                  const myOrgId = myOrgIdFor();
                  const iCreatedThis = myOrgId === ind.created_by_org_id;
                  const pending = hasPendingSuggestion(ind);
                  const iProposedSuggestion = pending && myOrgId === ind.suggested_by_org_id;
                  const canAct = !iCreatedThis && status !== "agreed" && !pending;
                  const isEditing = editingIndicatorId === ind.id;
                  const isRejecting = rejectingIndicatorId === ind.id;
                  return (
                    <div key={ind.id} className="rounded-xl border border-border p-5 space-y-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1 space-y-3">
                          <div>
                            <p className="text-base font-bold text-black dark:text-white">{ind.name}</p>
                            <p className="text-sm text-black dark:text-white mt-1 leading-relaxed">{ind.definition}</p>
                          </div>
                          <div className="space-y-1.5">
                            <p className="text-sm text-black dark:text-white"><span className="font-bold">Target:</span> {ind.target_value}</p>
                            {ind.baseline_value && (
                              <p className="text-sm text-black dark:text-white"><span className="font-bold">Baseline:</span> {ind.baseline_value}</p>
                            )}
                            <p className="text-sm text-black dark:text-white"><span className="font-bold">Measurement window:</span> {ind.measurement_window}</p>
                            {ind.source && (
                              <p className="text-sm text-black dark:text-white"><span className="font-bold">Source:</span> {ind.source}</p>
                            )}
                          </div>
                        </div>
                        <span className={`shrink-0 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${INDICATOR_AGREEMENT_PILL_STYLES[pillMeta.tone]}`}>
                          {pillMeta.label}
                        </span>
                      </div>
                      {status === "rejected" && ind.rejection_reason && (
                        <p className="text-xs text-red-600 dark:text-red-500">
                          {iCreatedThis ? "The other party" : "You"} rejected this: {ind.rejection_reason}
                        </p>
                      )}
                      {pending && (
                        <div className="rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/20 p-3 space-y-2">
                          <p className="text-xs font-semibold text-amber-700 dark:text-amber-500">
                            {iProposedSuggestion ? "Your suggested changes -- waiting for review" : "Suggested changes to review"}
                          </p>
                          <div className="text-xs text-black dark:text-white space-y-1">
                            <p><span className="font-medium">Name:</span> {ind.suggested_name}</p>
                            <p><span className="font-medium">Definition:</span> {ind.suggested_definition}</p>
                            <p><span className="font-medium">Target:</span> {ind.suggested_target_value} · {ind.suggested_measurement_window}</p>
                            {ind.suggested_baseline_value && <p><span className="font-medium">Baseline:</span> {ind.suggested_baseline_value}</p>}
                            {ind.suggested_source && <p><span className="font-medium">Source:</span> {ind.suggested_source}</p>}
                          </div>
                          {!iProposedSuggestion && (
                            <div className="flex gap-2 pt-1">
                              <button type="button" onClick={() => resolveSuggestion(ind, true)} disabled={resolvingSuggestionId === ind.id}
                                className="text-sm px-4 py-1.5 rounded-full bg-[#2D6A4F] hover:bg-[#245c43] text-white font-medium disabled:opacity-60 transition-colors">
                                {resolvingSuggestionId === ind.id ? "Accepting..." : "Accept suggested changes"}
                              </button>
                              <button type="button" onClick={() => resolveSuggestion(ind, false)} disabled={resolvingSuggestionId === ind.id}
                                className="text-sm px-4 py-1.5 rounded-full border border-border text-black dark:text-white hover:border-foreground/30 transition-colors disabled:opacity-60">
                                Dismiss
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                      {canAct && !isEditing && !isRejecting && (
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <button type="button" onClick={() => handleAgreeToIndicator(ind.id)}
                            disabled={agreeingIndicatorId === ind.id}
                            className="text-sm px-4 py-1.5 rounded-full bg-[#2D6A4F] hover:bg-[#245c43] text-white font-medium disabled:opacity-60 transition-colors">
                            {agreeingIndicatorId === ind.id ? "Agreeing..." : "Agree"}
                          </button>
                          <button type="button" onClick={() => openEditIndicator(ind)}
                            className="text-sm px-4 py-1.5 rounded-full border border-border text-black dark:text-white hover:border-[#2D6A4F]/50 transition-colors">
                            Suggest refinement
                          </button>
                          <button type="button" onClick={() => openReject(ind)}
                            className="text-sm px-4 py-1.5 rounded-full border border-red-300 dark:border-red-900/50 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
                            Reject
                          </button>
                        </div>
                      )}
                      {isEditing && (
                        <div className="space-y-2 pt-2 border-t border-border">
                          <div>
                            <label className="text-xs text-black dark:text-white block mb-1">Indicator name</label>
                            <input type="text" value={editDraft.name} onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))}
                              className="w-full h-9 px-2.5 rounded-lg border border-border bg-transparent text-sm text-black dark:text-white" />
                          </div>
                          <div>
                            <label className="text-xs text-black dark:text-white block mb-1">Definition</label>
                            <textarea value={editDraft.definition} onChange={(e) => setEditDraft((d) => ({ ...d, definition: e.target.value }))} rows={2}
                              className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-transparent text-sm text-black dark:text-white resize-none" />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-xs text-black dark:text-white block mb-1">Baseline</label>
                              <input type="text" value={editDraft.baseline_value} onChange={(e) => setEditDraft((d) => ({ ...d, baseline_value: e.target.value }))}
                                className="w-full h-9 px-2.5 rounded-lg border border-border bg-transparent text-sm text-black dark:text-white" />
                            </div>
                            <div>
                              <label className="text-xs text-black dark:text-white block mb-1">Target</label>
                              <input type="text" value={editDraft.target_value} onChange={(e) => setEditDraft((d) => ({ ...d, target_value: e.target.value }))}
                                className="w-full h-9 px-2.5 rounded-lg border border-border bg-transparent text-sm text-black dark:text-white" />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-xs text-black dark:text-white block mb-1">Measurement window</label>
                              <input type="text" value={editDraft.measurement_window} onChange={(e) => setEditDraft((d) => ({ ...d, measurement_window: e.target.value }))}
                                className="w-full h-9 px-2.5 rounded-lg border border-border bg-transparent text-sm text-black dark:text-white" />
                            </div>
                            <div>
                              <label className="text-xs text-black dark:text-white block mb-1">Source</label>
                              <input type="text" value={editDraft.source} onChange={(e) => setEditDraft((d) => ({ ...d, source: e.target.value }))}
                                className="w-full h-9 px-2.5 rounded-lg border border-border bg-transparent text-sm text-black dark:text-white" />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button type="button" onClick={() => saveEditIndicator(ind.id)} disabled={savingEdit}
                              className="text-sm px-4 py-1.5 rounded-full bg-[#2D6A4F] hover:bg-[#245c43] text-white font-medium disabled:opacity-60 transition-colors">
                              {savingEdit ? "Saving..." : "Save suggested changes"}
                            </button>
                            <button type="button" onClick={cancelEditIndicator} disabled={savingEdit}
                              className="text-sm px-4 py-1.5 rounded-full border border-border text-black dark:text-white hover:border-foreground/30 transition-colors disabled:opacity-60">
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                      {isRejecting && (
                        <div className="space-y-2 pt-2 border-t border-border">
                          <label className="text-xs text-black dark:text-white block mb-1">Why are you rejecting this indicator?</label>
                          <textarea value={rejectReasonDraft} onChange={(e) => setRejectReasonDraft(e.target.value)} rows={2}
                            placeholder="Explain what needs to change"
                            className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-transparent text-sm text-black dark:text-white resize-none" />
                          <div className="flex gap-2">
                            <button type="button" onClick={() => submitReject(ind.id)} disabled={submittingReject || !rejectReasonDraft.trim()}
                              className="text-sm px-4 py-1.5 rounded-full bg-red-600 hover:bg-red-700 text-white font-medium disabled:opacity-60 transition-colors">
                              {submittingReject ? "Rejecting..." : "Confirm rejection"}
                            </button>
                            <button type="button" onClick={cancelReject} disabled={submittingReject}
                              className="text-sm px-4 py-1.5 rounded-full border border-border text-black dark:text-white hover:border-foreground/30 transition-colors disabled:opacity-60">
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
          {showIndicatorForm && orgA && (() => {
            const myOrgId = orgA.user_id === myUserId ? orgA.id : orgB?.user_id === myUserId ? orgB.id : null;
            if (!myOrgId) return null;
            return (
              <IndicatorForm
                mouDocumentId={doc.id}
                createdByOrgId={myOrgId}
                initiativeId={doc.initiative_id}
                connectionId={doc.connection_id}
                onClose={() => setShowIndicatorForm(false)}
                onCreated={async () => {
                  const before = indicators.length;
                  const refreshed = await fetchIndicators(doc.id);
                  setIndicators(refreshed);
                  const added = refreshed.length - before;
                  if (added > 0 && orgA && orgB) {
                    const actingOrgId = orgA.user_id === myUserId ? orgA.id : orgB.user_id === myUserId ? orgB.id : null;
                    const myName = actingOrgId === orgA.id ? orgA.organisation_name : orgB.organisation_name;
                    await supabase.rpc("send_mou_notification", {
                      p_document_id: doc.id,
                      p_type: "mou_indicator_added",
                      p_title: "New outcome indicator to review",
                      p_body: `${myName ?? "Your partner"} added ${added} outcome indicator${added > 1 ? "s" : ""} for you to review.`,
                      p_link: `/dashboard/portfolio/mou`,
                    });
                  }
                }}
              />
            );
          })()}

          {/* Send / sign actions */}
          <div className="space-y-3 border-t border-border pt-5">
            <p className="text-base font-semibold text-black dark:text-white">Send & sign</p>
            {isViewerOrgA && doc.status === "draft" && (
              <p className="text-sm text-black dark:text-white">
                {orgB?.organisation_name ?? "Your partner"} can't see this document until you send it.
              </p>
            )}
            {isViewerOrgA && doc.status === "draft" && !orgAHasSigned && (
              <InfoBanner tone="waiting" icon={PenLine}>
                Sign this document before sending it. {orgB?.organisation_name ?? "The other party"} can't sign their own side, and has no way to prompt you to come back and sign, once it's already been sent.
              </InfoBanner>
            )}
            {(() => {
              const canSaveProgress = doc.source_type === "template" && (orgADetailsEditable || orgBFieldsEditable);
              const canSend = isViewerOrgA && doc.status === "draft";
              if (!canSaveProgress && !canSend && !canVoidAndReopen) return null;
              return (
                <div className="flex flex-wrap items-center gap-2">
                  {canSaveProgress && (
                    <button type="button" onClick={saveFieldValues} disabled={saving}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-border text-black dark:text-white hover:border-[#2D6A4F]/50 transition-colors disabled:opacity-60 text-sm font-medium">
                      {saving ? "Saving..." : "Save progress"}
                    </button>
                  )}
                  {canSend && (
                    <button type="button" onClick={markSent}
                      disabled={saving || missingFieldLabels.length > 0 || dateValidationErrors.length > 0 || !orgAHasSigned}
                      title={!orgAHasSigned ? "Sign this document before sending it" : undefined}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#2D6A4F] hover:bg-[#245c43] text-white text-sm font-medium transition-colors disabled:opacity-60">
                      <Send className="w-4 h-4" /> {saving ? "Sending..." : `Send to ${orgB?.organisation_name ?? "partner"}`}
                    </button>
                  )}
                  {canVoidAndReopen && (
                    <button type="button" onClick={() => { setVoidError(null); setShowVoidConfirm(true); }}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-red-300 dark:border-red-900/50 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors text-sm font-medium">
                      <Trash2 className="w-4 h-4" /> Void signatures and reopen
                    </button>
                  )}
                </div>
              );
            })()}
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
            {noticePeriodWarning && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
                <p className="text-sm text-amber-800">{noticePeriodWarning}</p>
              </div>
            )}
            {jurisdictionWarning && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
                <p className="text-sm text-amber-800">{jurisdictionWarning}</p>
              </div>
            )}
            
            {doc.source_type === "uploaded_pdf" && (
              <div className="space-y-4">
                <div className="flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1.5 text-black dark:text-white">
                    {doc.signed_files?.[doc.org_a_id ?? ""] && <CheckCircle2 className="w-4 h-4" />}
                    {orgA?.organisation_name}: {doc.signed_files?.[doc.org_a_id ?? ""] ? "Signed" : "Awaiting signature"}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1.5 text-black dark:text-white">
                    {doc.signed_files?.[doc.org_b_id ?? ""] && <CheckCircle2 className="w-4 h-4" />}
                    {orgB?.organisation_name}: {doc.signed_files?.[doc.org_b_id ?? ""] ? "Signed" : "Awaiting signature"}
                  </span>
                </div>
                {uploadIndicatorError && (
                  <div className="rounded-xl border border-red-300 bg-red-50 p-4">
                    <p className="text-sm text-red-800">{uploadIndicatorError}</p>
                  </div>
                )}
                {(isViewerOrgA || isViewerOrgB) && (() => {
                  const myAlreadySigned = isViewerOrgA ? !!doc.signed_files?.[doc.org_a_id ?? ""] : !!doc.signed_files?.[doc.org_b_id ?? ""];
                  if (myAlreadySigned) {
                    return (
                      <div className="border-t border-border pt-4">
                        <p className="text-sm text-black dark:text-white">
                          You've completed your part of this document. Need to change something? Use "Void signatures and reopen" below.
                        </p>
                      </div>
                    );
                  }
                  if (!canSignUploadedPdfInline) {
                    return (
                      <div className="border-t border-border pt-4 space-y-3">
                        <p className="text-sm text-black dark:text-white">
                          This document was uploaded as a Word file, so Impact Natives can't place a signature onto it directly. Sign it outside the platform, then upload your signed copy.
                        </p>
                        <button type="button" onClick={() => setShowUploadWarning(true)}
                          className="text-sm px-4 py-1.5 rounded-full bg-[#2D6A4F] hover:bg-[#245c43] text-white font-medium transition-colors">
                          Upload your signed copy
                        </button>
                      </div>
                    );
                  }
                  return (
                    <div className="border-t border-border pt-4 space-y-3">
                      <p className="text-base font-semibold text-black dark:text-white">Sign this document</p>
                      <p className="text-sm text-black dark:text-white">
                        Your signature is appended as a new final page on the uploaded document.
                      </p>
                      <SignaturePad onConfirm={composeAndSignPdf} disabled={composingSignature} confirming={composingSignature} />
                      <button type="button" onClick={() => setShowUploadWarning(true)} disabled={composingSignature}
                        className="flex items-center gap-1.5 text-sm text-black dark:text-white hover:underline underline-offset-2 disabled:opacity-60">
                        <PenLine className="w-3.5 h-3.5" /> Sign outside the platform and upload instead
                      </button>
                    </div>
                  );
                })()}
              </div>
            )}
            {doc.source_type !== "uploaded_pdf" && missingFieldLabels.length === 0 && dateValidationErrors.length === 0 &&
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
                  const myLocked = doc.status === "fully_executed" || (isOrgA ? doc.signature_locked_org_a : doc.signature_locked_org_b);
                  const showPad = !myLocked && (!mySigUrl || redrawingSignature);
                  if (myLocked) {
                    return (
                      <div className="border-t border-border pt-4">
                        <InfoBanner tone="locked" icon={Lock}>
                          You have finalized your signature on this document. It can no longer be changed.
                        </InfoBanner>
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
                            {isOrgA ? "Finish" : `Submit for ${orgA?.organisation_name ?? "final"} review`}
                          </button>
                          <p className="text-sm text-black dark:text-white">                            
                            {isOrgA
                              ? "Once you finish, you won't be able to change or clear your signature again."
                              : `Once you submit, you won't be able to change or clear your signature again. ${orgA?.organisation_name ?? "The other party"} will do a final review before the MoU is fully executed.`}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
          {isViewerOrgA && doc.source_type === "template" && doc.signature_org_a_path && missingFieldLabels.length === 0 && dateValidationErrors.length === 0 && (
              <button type="button" onClick={completeOrgADetails}
              disabled={saving || (doc.details_completed_by_org_a && !hasUnresolvedOrgBFlags)}
              className="w-full flex items-center justify-center gap-2 bg-[#2D6A4F] hover:bg-[#245c43] text-white rounded-full py-3 text-base font-medium transition-colors disabled:opacity-60">
                {doc.details_completed_by_org_a
                  ? (hasUnresolvedOrgBFlags ? "Resubmit after resolving flags" : "Details submitted")
                  : (saving ? "Submitting..." : `Submit — notify ${orgB?.organisation_name ?? "partner"}`)}
              </button>
            )}
          {isViewerOrgA && doc.status === "pending_org_a_final_review" && (
            <div className="space-y-2">
              {!doc.signed_at_org_a && (
                <InfoBanner tone="locked" icon={PenLine}>
                  You haven't signed your own section yet. Sign above before you can fully execute this MoU.
                </InfoBanner>
              )}
              {hasUnresolvedOrgAFlags && (
                <InfoBanner tone="waiting" icon={Clock}>
                  Waiting for {orgB?.organisation_name ?? "the other party"} to resolve the flags you raised before you can finalize.
                </InfoBanner>
              )}
              {!hasUnresolvedOrgAFlags && finalizeBlockedOnOrgBConfirmation && (
                <InfoBanner tone="waiting" icon={Clock}>
                  This MoU includes binding commitments. Waiting for {orgB?.organisation_name ?? "the other party"} to confirm they have no objection before you can finalize.
                </InfoBanner>
              )}
              {finalizeError && (
                <p className="text-sm text-amber-600 dark:text-amber-500">{finalizeError}</p>
              )}
              <button type="button" onClick={finalizeDocument}
                disabled={finalizing || !doc.signed_at_org_a || hasUnresolvedOrgAFlags || finalizeBlockedOnOrgBConfirmation}
                className="w-full flex items-center justify-center gap-2 bg-[#2D6A4F] hover:bg-[#245c43] text-white rounded-full py-3 text-base font-medium transition-colors disabled:opacity-60">
                {finalizing ? "Finalizing..." : "Finish Finally — fully execute this MoU"}
              </button>
            </div>
          )}
          {orgBCanConfirmFinalization && (
            <div className="space-y-2">
              <InfoBanner tone="waiting" icon={Clock}>
                This MoU includes binding commitments. Confirm you have no objection before {orgA?.organisation_name ?? "the other party"} can finalize it.
              </InfoBanner>
              <button type="button" onClick={confirmFinalization}
                disabled={confirmingFinalization}
                className="w-full flex items-center justify-center gap-2 bg-[#2D6A4F] hover:bg-[#245c43] text-white rounded-full py-3 text-base font-medium transition-colors disabled:opacity-60">
                {confirmingFinalization ? "Confirming..." : "Confirm — no objection to finalizing"}
              </button>
            </div>
          )}
          {isViewerOrgB && doc.status === "pending_org_a_final_review" && !hasUnresolvedOrgAFlags && isBindingMou && doc.org_b_finalization_confirmed && (
            <InfoBanner tone="success" icon={CheckCircle2}>
              You've confirmed no objection. Waiting for {orgA?.organisation_name ?? "the other party"} to finalize.
            </InfoBanner>
          )}
          {isViewerOrgA && doc.status === "fully_executed" && !doc.partnership_status_confirmed && (
            <div className="space-y-2">
              <InfoBanner tone="celebrate" icon={PartyPopper}>
                This MoU is fully executed. Mark the {doc.initiative_id ? "initiative" : "partnership"} as executed so it's reflected wherever this relationship is shown.
              </InfoBanner>
              <button type="button" onClick={confirmPartnershipStatus}
                disabled={confirmingPartnershipStatus}
                className="w-full flex items-center justify-center gap-2 bg-[#2D6A4F] hover:bg-[#245c43] text-white rounded-full py-3 text-base font-medium transition-colors disabled:opacity-60">
                {confirmingPartnershipStatus ? "Marking..." : "Mark partnership as executed"}
              </button>
            </div>
          )}
          {doc.status === "fully_executed" && doc.partnership_status_confirmed && (
            <InfoBanner tone="success" icon={CheckCircle2}>
              Partnership status updated{doc.partnership_status_confirmed_at ? ` on ${new Date(doc.partnership_status_confirmed_at).toLocaleDateString("en-GB")}` : ""}.
            </InfoBanner>
          )}
          {/* Export */}
          {doc.source_type !== "uploaded_pdf" && (
            <div className="space-y-2">
              {doc.final_document_path && (
                <InfoBanner tone="celebrate" icon={PartyPopper}>
                  This MoU is fully executed. Exporting now gives you the final signed copy both parties hold.
                </InfoBanner>
              )}
              {exportDisabledForOrgB && (
                <InfoBanner tone="waiting" icon={Clock}>
                  Export will be available once {orgA?.organisation_name ?? "the other party"} finalizes the document.
                </InfoBanner>
              )}
              <button type="button" onClick={exportPdf} disabled={exportDisabledForOrgB}
                className="w-full flex items-center justify-center gap-2 border border-border rounded-full py-3 text-base font-medium text-black dark:text-white hover:border-[#2D6A4F]/50 transition-colors disabled:cursor-not-allowed disabled:opacity-60">
                <Download className="w-4 h-4" /> Export as PDF
              </button>
            </div>
          )}
      {showUploadWarning && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowUploadWarning(false)}>
          <div className="bg-white dark:bg-card rounded-2xl border border-border w-full max-w-sm shadow-xl p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <p className="text-base font-bold text-black dark:text-white">Upload a signed copy</p>
            <p className="text-sm text-black dark:text-white leading-relaxed">
              Impact Natives can't verify a signature added outside the platform the way it can for one signed here directly. An uploaded signed copy goes through manual verification, which can take up to 48 hours before this document reflects it as complete.
            </p>
            <label className="flex items-center justify-center gap-2 cursor-pointer rounded-xl border border-dashed border-border px-4 py-4 text-base text-black dark:text-white hover:border-[#2D6A4F]/40 transition-colors">
              {uploadingSigned ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploadingSigned ? "Uploading..." : "Choose your signed copy"}
              <input type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden" disabled={uploadingSigned}
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  await uploadSignedCopy(f);
                  setShowUploadWarning(false);
                }} />
            </label>
            <button type="button" onClick={() => setShowUploadWarning(false)} disabled={uploadingSigned}
              className="w-full h-10 rounded-full border border-border text-sm text-black dark:text-white hover:border-foreground/30 transition-colors disabled:opacity-60">
              Cancel
            </button>
          </div>
        </div>
      )}
      {showVoidConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowVoidConfirm(false)}>
          <div className="bg-white dark:bg-card rounded-2xl border border-border w-full max-w-sm shadow-xl p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <p className="text-base font-bold text-black dark:text-white">Reopen this MoU for editing?</p>
            <p className="text-sm text-black dark:text-white leading-relaxed">
              This clears both parties' signatures and any binding-MoU confirmation, reopens every field for editing, and notifies {(isViewerOrgA ? orgB?.organisation_name : orgA?.organisation_name) ?? "the other party"}. This cannot be undone — both sides will need to review and sign again.
            </p>
            {voidError && (
              <div className="rounded-xl border border-red-300 bg-red-50 p-3">
                <p className="text-sm text-red-800">{voidError}</p>
              </div>
            )}
            <div className="flex gap-2">
              <button type="button" onClick={() => { setShowVoidConfirm(false); setVoidError(null); }}
                className="flex-1 h-10 rounded-full border border-border text-sm text-black dark:text-white hover:border-foreground/30 transition-colors">
                Cancel
              </button>
              <button type="button" onClick={voidAndReopen} disabled={voiding}
                className="flex-1 h-10 rounded-full bg-red-600 hover:bg-red-700 text-white text-sm font-medium disabled:opacity-60 transition-colors">
                {voiding ? "Reopening..." : "Yes, reopen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}