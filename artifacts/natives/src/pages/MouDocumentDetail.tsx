import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { jsPDF } from "jspdf";
import { BRICOLAGE_GROTESQUE_BOLD_BASE64 } from "@/lib/fonts/bricolageGrotesqueBold";
import { X, Loader2, Download, Upload, CheckCircle2, Send, Circle, ArrowLeft, Check } from "lucide-react";
import SignaturePad from "@/components/dashboard/SignaturePad";

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
  pending_org_a_final_review: { label: "Awaiting final review", color: "#C45C26" },
  fully_executed: { label: "Fully executed", color: "#2D6A4F" },
};

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
  const [customFieldMode, setCustomFieldMode] = useState<Record<string, boolean>>({});
  const [finalizing, setFinalizing] = useState(false);
  const [confirmingFinalization, setConfirmingFinalization] = useState(false);
  const [confirmingPartnershipStatus, setConfirmingPartnershipStatus] = useState(false);
  const [showVoidConfirm, setShowVoidConfirm] = useState(false);
  const [voiding, setVoiding] = useState(false);
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
          onChange={(e) => setFieldValues((prev) => ({ ...prev, [key]: e.target.value }))}
          className={`w-full h-10 px-3 rounded-lg border bg-white dark:bg-card text-base text-black dark:text-white focus:outline-none ${
            dateError ? "border-red-500" : "border-border focus:border-[#2D6A4F]/50"
          }`}
        />
        {dateError && <p className="text-sm text-red-600 mt-1">{dateError}</p>}
      </div>
    );
  }
  function renderFlagsForField(key: string, opts: { canRaise: boolean; raiserRole: "org_a" | "org_b" }) {
    const flags = (doc?.field_flags ?? []).filter((f) => f.field_key === key);
    return (
      <div className="mt-1 space-y-1">
        {flags.map((f) => {
          const iCanResolve = !f.resolved && ((f.raised_by === "org_b" && isViewerOrgA) || (f.raised_by === "org_a" && isViewerOrgB));
          return (
            <div key={f.id} className={`text-sm rounded-md px-2 py-1 ${f.resolved ? "bg-muted/20 text-black/60 dark:text-white/60" : "bg-amber-50 text-amber-800 border border-amber-200"}`}>
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
        {opts.canRaise && (
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
    // Field edits (like a corrected dropdown selection) only live in local
    // state until an explicit Save click -- and signing triggers a reload
    // afterward that pulls field_values back from the database, silently
    // discarding anything unsaved. Persisting the current field values
    // here, atomically with the signature, closes that gap.
    const updates: Partial<MouDoc> & Record<string, any> = {
      field_values: fieldValues,
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
    const updates = { signature_locked_org_b: true, status: "pending_org_a_final_review" as MouDoc["status"], updated_at: new Date().toISOString() };
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
    const stillUnresolved = (doc.field_flags ?? []).some((f) => !f.resolved && f.raised_by === "org_a");
    if (stillUnresolved) return;
    setFinalizing(true);
    const { error } = await supabase.rpc("finalize_mou_document", { p_document_id: doc.id });
    if (error) { setFinalizing(false); return; }
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
    const updates: Partial<MouDoc> & Record<string, any> = { status: "fully_executed", updated_at: new Date().toISOString() };
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
    const updates = { org_b_finalization_confirmed: true, updated_at: new Date().toISOString() };
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
  async function voidAndReopen() {
    if (!doc) return;
    setVoiding(true);
    const { error } = await supabase.rpc("void_and_reopen_mou", { p_document_id: doc.id });
    if (error) { setVoiding(false); return; }
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

  if (loading || !doc) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 text-[#2D6A4F] animate-spin" />
      </div>
    );
  }

  const iAmCreator = myUserId === doc.created_by;
  const hasUnresolvedOrgBFlags = (doc.field_flags ?? []).some((f) => !f.resolved && f.raised_by === "org_b");
  const hasUnresolvedOrgAFlags = (doc.field_flags ?? []).some((f) => !f.resolved && f.raised_by === "org_a");
  const orgADetailsEditable = isViewerOrgA && (!doc.details_completed_by_org_a || hasUnresolvedOrgBFlags);
  const orgBCanFillTheirPart = doc.details_completed_by_org_a && !hasUnresolvedOrgBFlags;
  const orgBSubmittedForReview = doc.status === "pending_org_a_final_review" || doc.status === "fully_executed";
  const orgBFieldsEditable = isViewerOrgB && (!orgBSubmittedForReview || hasUnresolvedOrgAFlags);
  const exportDisabledForOrgB = isViewerOrgB && doc.status === "pending_org_a_final_review";
  const isBindingMou = doc.toggle_selections?.["agreement_type"] === "binding";
  const orgBConfirmationPending = isBindingMou && !doc.org_b_finalization_confirmed;
  const orgBCanConfirmFinalization =
    isViewerOrgB && doc.status === "pending_org_a_final_review" && !hasUnresolvedOrgAFlags && orgBConfirmationPending;
  const finalizeBlockedOnOrgBConfirmation = doc.status === "pending_org_a_final_review" && !hasUnresolvedOrgAFlags && orgBConfirmationPending;
  // Toggles change the actual clause text, so once either party has signed
  // anything, changing them would silently alter what was already agreed
  // to and signed -- same reasoning as the preview-text lock.
  const togglesEditable = isViewerOrgA && !doc.signature_org_a_path && !doc.signature_org_b_path;
  // Same underlying condition as previewLocked/togglesEditable -- once any
  // signature exists, content is frozen. Void & Reset is the only way back,
  // and it's unavailable once the document is fully executed.
  const canVoidAndReopen = previewLocked && doc.status !== "fully_executed";

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
    stages.push({ key: "org_a_sign", label: `${orgAName} uploads their signed copy`, completed: !!doc.signed_files?.[doc.org_a_id] });
    stages.push({ key: "org_b_sign", label: `${orgBName} uploads their signed copy`, completed: !!doc.signed_files?.[doc.org_b_id] });
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
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-[#C45C26] transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> Back
      </button>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight">
            MoU — {orgA?.organisation_name} & {orgB?.organisation_name}
          </h2>
          <span className="inline-flex items-center gap-1.5 mt-2 text-sm font-medium text-black dark:text-white">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: !currentStage ? "#2D6A4F" : "#C45C26" }} />
            {trackerStatusText}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
        <div className="space-y-6 min-w-0">
          {/* Template: fillable fields */}
          {doc.source_type === "template" && (
            <>
              {template && template.toggles && template.toggles.length > 0 && (
                <div className="space-y-3">
                  <div>
                    <p className="text-base font-semibold text-black dark:text-white">Agreement terms</p>
                    <p className="text-sm text-black dark:text-white">
                      {togglesEditable
                        ? "These control which clauses appear in the document. Locked once either party signs."
                        : "Set at document creation. Locked because a signature exists on this document."}
                    </p>
                    {canVoidAndReopen && (
                      <button type="button" onClick={() => setShowVoidConfirm(true)}
                        className="text-sm text-red-600 hover:underline underline-offset-2">
                        Need to change these? Void signatures and reopen
                      </button>
                    )}
                  </div>
                  <div className="rounded-xl border border-border p-4 space-y-4">
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
                </div>
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

                  {isViewerOrgA && orgADetailsEditable && (
                    <button type="button" onClick={saveFieldValues} disabled={saving}
                      className="text-sm text-black dark:text-white hover:underline underline-offset-2 disabled:opacity-60">
                      {saving ? "Saving..." : "Save progress"}
                    </button>
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
                          {orgBFieldsEditable && (
                            <button type="button" onClick={saveFieldValues} disabled={saving}
                              className="text-sm text-black dark:text-white hover:underline underline-offset-2 disabled:opacity-60">
                              {saving ? "Saving..." : "Save field values"}
                            </button>
                          )}
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
                  {canVoidAndReopen && (
                    <button type="button" onClick={() => setShowVoidConfirm(true)}
                      className="text-sm text-red-600 hover:underline underline-offset-2">
                      Need to change this? Void signatures and reopen
                    </button>
                  )}
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
              {previewLocked && (
                <p className="text-sm text-black dark:text-white">
                  This text is locked because a signature has been added.
                </p>
              )}
              {previewLocked ? (
                <p className="w-full px-4 py-3 rounded-xl border border-border bg-white dark:bg-card text-base text-black dark:text-white leading-relaxed whitespace-pre-line">
                  {customContent}
                </p>
              ) : (
                <textarea
                  value={customContent}
                  onChange={(e) => setCustomContent(e.target.value)}
                  onBlur={saveCustomContent}
                  rows={16}
                  placeholder="Write the full text of your agreement here..."
                  className="w-full px-4 py-3 rounded-xl border border-border bg-white dark:bg-card text-base text-black dark:text-white leading-relaxed focus:outline-none focus:border-[#2D6A4F]/50 resize-y"
                />
              )}
              {canVoidAndReopen && (
                <button type="button" onClick={() => setShowVoidConfirm(true)}
                  className="text-sm text-red-600 hover:underline underline-offset-2">
                  Need to change this? Void signatures and reopen
                </button>
              )}
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
                            {isOrgA ? "Finish" : `Submit for ${orgA?.organisation_name ?? "final"} review`}
                          </button>
                          <p className="text-sm text-black/60 dark:text-white/60">
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
              {hasUnresolvedOrgAFlags && (
                <p className="text-sm text-black dark:text-white">
                  Waiting for {orgB?.organisation_name ?? "the other party"} to resolve the flags you raised before you can finalize.
                </p>
              )}
              {!hasUnresolvedOrgAFlags && finalizeBlockedOnOrgBConfirmation && (
                <p className="text-sm text-black dark:text-white">
                  This MoU includes binding commitments. Waiting for {orgB?.organisation_name ?? "the other party"} to confirm they have no objection before you can finalize.
                </p>
              )}
              <button type="button" onClick={finalizeDocument}
                disabled={finalizing || hasUnresolvedOrgAFlags || finalizeBlockedOnOrgBConfirmation}
                className="w-full flex items-center justify-center gap-2 bg-[#2D6A4F] hover:bg-[#245c43] text-white rounded-full py-3 text-base font-medium transition-colors disabled:opacity-60">
                {finalizing ? "Finalizing..." : "Finish Finally — fully execute this MoU"}
              </button>
            </div>
          )}
          {orgBCanConfirmFinalization && (
            <div className="space-y-2">
              <p className="text-sm text-black dark:text-white">
                This MoU includes binding commitments. Confirm you have no objection before {orgA?.organisation_name ?? "the other party"} can finalize it.
              </p>
              <button type="button" onClick={confirmFinalization}
                disabled={confirmingFinalization}
                className="w-full flex items-center justify-center gap-2 bg-[#2D6A4F] hover:bg-[#245c43] text-white rounded-full py-3 text-base font-medium transition-colors disabled:opacity-60">
                {confirmingFinalization ? "Confirming..." : "Confirm — no objection to finalizing"}
              </button>
            </div>
          )}
          {isViewerOrgB && doc.status === "pending_org_a_final_review" && !hasUnresolvedOrgAFlags && isBindingMou && doc.org_b_finalization_confirmed && (
            <p className="text-sm text-black dark:text-white">
              You've confirmed no objection. Waiting for {orgA?.organisation_name ?? "the other party"} to finalize.
            </p>
          )}
          {isViewerOrgA && doc.status === "fully_executed" && !doc.partnership_status_confirmed && (
            <div className="space-y-2">
              <p className="text-sm text-black dark:text-white">
                This MoU is fully executed. Mark the {doc.initiative_id ? "initiative" : "partnership"} as executed so it's reflected wherever this relationship is shown.
              </p>
              <button type="button" onClick={confirmPartnershipStatus}
                disabled={confirmingPartnershipStatus}
                className="w-full flex items-center justify-center gap-2 bg-[#2D6A4F] hover:bg-[#245c43] text-white rounded-full py-3 text-base font-medium transition-colors disabled:opacity-60">
                {confirmingPartnershipStatus ? "Marking..." : "Mark partnership as executed"}
              </button>
            </div>
          )}
          {doc.status === "fully_executed" && doc.partnership_status_confirmed && (
            <p className="text-sm text-black dark:text-white">
              Partnership status updated{doc.partnership_status_confirmed_at ? ` on ${new Date(doc.partnership_status_confirmed_at).toLocaleDateString("en-GB")}` : ""}.
            </p>
          )}
          {/* Export */}
          {doc.source_type !== "uploaded_pdf" && (
            <div className="space-y-2">
              {doc.final_document_path && (
                <p className="text-sm text-black dark:text-white">
                  This MoU is fully executed. Exporting now gives you the final signed copy both parties hold.
                </p>
              )}
              {exportDisabledForOrgB && (
                <p className="text-sm text-black dark:text-white">
                  Export will be available once {orgA?.organisation_name ?? "the other party"} finalizes the document.
                </p>
              )}
              <button type="button" onClick={exportPdf} disabled={exportDisabledForOrgB}
                className="w-full flex items-center justify-center gap-2 border border-border rounded-full py-3 text-base font-medium text-black dark:text-white hover:border-[#2D6A4F]/50 transition-colors disabled:cursor-not-allowed disabled:opacity-60">
                <Download className="w-4 h-4" /> Export as PDF
              </button>
            </div>
          )}
        </div>
        <div className="lg:sticky lg:top-6 rounded-2xl border border-border bg-white dark:bg-card p-5 space-y-4">
          <p className="text-sm font-bold text-black dark:text-white">Signing progress</p>
          <div className="relative">
            {stages.map((s, i) => {
              const isCurrent = currentStage?.key === s.key;
              return (
                <div key={s.key} className="relative flex gap-3 pb-6 last:pb-0">
                  {i < stages.length - 1 && (
                    <span className="absolute left-[9px] top-5 bottom-0 w-px bg-border" />
                  )}
                  <div className="relative z-10 shrink-0 mt-0.5">
                    {s.completed ? (
                      <div className="w-5 h-5 rounded-full bg-[#2D6A4F] flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    ) : isCurrent ? (
                      <div className="w-5 h-5 rounded-full border-2 border-[#C45C26] bg-white dark:bg-card" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-border bg-white dark:bg-card" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className={`text-sm leading-snug ${
                      s.completed ? "text-black dark:text-white" : isCurrent ? "text-black dark:text-white font-semibold" : "text-black/40 dark:text-white/40"
                    }`}>
                      {s.label}
                    </p>
                    {isCurrent && s.blocked && (
                      <p className="text-xs text-[#C45C26] mt-1">{s.blocked}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {showVoidConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowVoidConfirm(false)}>
          <div className="bg-white dark:bg-card rounded-2xl border border-border w-full max-w-sm shadow-xl p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <p className="text-base font-bold text-black dark:text-white">Reopen this MoU for editing?</p>
            <p className="text-sm text-black dark:text-white leading-relaxed">
              This clears both parties' signatures and any binding-MoU confirmation, reopens every field for editing, and notifies {(isViewerOrgA ? orgB?.organisation_name : orgA?.organisation_name) ?? "the other party"}. This cannot be undone — both sides will need to review and sign again.
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowVoidConfirm(false)}
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