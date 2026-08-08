import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { X, FileText, PenLine, Upload, Loader2, CheckCircle2, ArrowRight, ArrowLeft } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type Path = "template" | "custom" | "upload" | null;

interface TemplateToggleOption {
  value: string | boolean;
  label?: string;
}
interface TemplateToggle {
  key: string;
  label: string;
  type: "select" | "binary";
  options: TemplateToggleOption[];
}
interface MouTemplate {
  id: string;
  name: string;
  toggles: TemplateToggle[];
}

interface OrgLite {
  id: string;
  organisation_name: string;
}

interface Props {
  myUserId: string;
  partnerUserId?: string;
  partnerOrgId?: string;
  partnerName: string;
  initiativeId: string | null;
  initiativeTitle: string;
  onClose: () => void;
}

export default function CreateMouModal({
  myUserId, partnerUserId, partnerOrgId, partnerName, initiativeId, initiativeTitle, onClose,
}: Props) {
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const [myOrg, setMyOrg] = useState<OrgLite | null>(null);
  const [partnerOrg, setPartnerOrg] = useState<OrgLite | null>(null);

  const [path, setPath] = useState<Path>(null);
  const [template, setTemplate] = useState<MouTemplate | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [toggleValues, setToggleValues] = useState<Record<string, string | boolean>>({});

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadOrgs();
  }, []);

  async function loadOrgs() {
    setLoadingOrgs(true);
    const { data: mineData } = await supabase
      .from("organizations").select("id, organisation_name").eq("user_id", myUserId).maybeSingle();
    setMyOrg(mineData ?? null);

    if (partnerOrgId) {
      const { data: theirsData } = await supabase
        .from("organizations").select("id, organisation_name").eq("id", partnerOrgId).maybeSingle();
      setPartnerOrg(theirsData ?? null);
    } else if (partnerUserId) {
      const { data: theirsData } = await supabase
        .from("organizations").select("id, organisation_name").eq("user_id", partnerUserId).maybeSingle();
      setPartnerOrg(theirsData ?? null);
    }
    setLoadingOrgs(false);
  }

  async function chooseTemplate() {
    setPath("template");
    setLoadingTemplate(true);
    setError("");
    const { data, error: fetchError } = await supabase
      .from("mou_templates")
      .select("id, name, toggles")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (fetchError) {
      setError(fetchError.message);
    } else if (data) {
      setTemplate(data as MouTemplate);
      const defaults: Record<string, string | boolean> = {};
      (data.toggles as TemplateToggle[]).forEach((t) => {
        defaults[t.key] = t.type === "binary" ? true : (t.options[0]?.value ?? "");
      });
      setToggleValues(defaults);
    } else {
      setError("No MoU template found.");
    }
    setLoadingTemplate(false);
  }

  async function saveTemplateDoc() {
    if (!myOrg || !partnerOrg) return;
    setSaving(true);
    setError("");
    const { error: insertError } = await supabase.from("mou_documents").insert({
      org_a_id: myOrg.id,
      org_b_id: partnerOrg.id,
      initiative_id: initiativeId,
      source_type: "template",
      template_id: template?.id,
      toggle_selections: toggleValues,
      field_values: {},
      status: "draft",
      created_by: myUserId,
    });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    setDone(true);
  }

  async function saveCustomDoc() {
    if (!myOrg || !partnerOrg) return;
    setSaving(true);
    setError("");
    const { error: insertError } = await supabase.from("mou_documents").insert({
      org_a_id: myOrg.id,
      org_b_id: partnerOrg.id,
      initiative_id: initiativeId,
      source_type: "custom",
      status: "draft",
      created_by: myUserId,
    });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    setDone(true);
  }

  async function saveUploadDoc() {
    if (!myOrg || !partnerOrg || !uploadFile) return;
    setSaving(true);
    setError("");
    const path = `${myUserId}/${Date.now()}-${uploadFile.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
    const { error: uploadError } = await supabase.storage
      .from("mou-documents")
      .upload(path, uploadFile);
    if (uploadError) { setSaving(false); setError(uploadError.message); return; }

    const { error: insertError } = await supabase.from("mou_documents").insert({
      org_a_id: myOrg.id,
      org_b_id: partnerOrg.id,
      initiative_id: initiativeId,
      source_type: "uploaded_pdf",
      rendered_file_path: path,
      status: "draft",
      created_by: myUserId,
    });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    setDone(true);
  }

  function renderPathPicker() {
    return (
      <div className="space-y-3">
        <p className="text-base text-black dark:text-white">
          Building an MoU with <span className="font-semibold">{partnerName}</span>
          {initiativeTitle ? <> for <span className="font-semibold">{initiativeTitle}</span></> : null}.
        </p>
        <button type="button" onClick={chooseTemplate}
          className="w-full flex items-start gap-4 p-4 rounded-xl border border-border bg-white dark:bg-card hover:border-[#2D6A4F]/50 transition-colors text-left">
          <div className="mt-0.5 p-2 rounded-lg bg-[#2D6A4F]/10 shrink-0">
            <FileText className="w-5 h-5 text-[#2D6A4F]" />
          </div>
          <div>
            <p className="text-base font-semibold text-black dark:text-white">Use a template</p>
            <p className="text-sm text-black dark:text-white mt-0.5">
              Toggle the terms that apply — agreement type, support type, duration, and reporting.
            </p>
          </div>
        </button>
        <button type="button" onClick={() => setPath("custom")}
          className="w-full flex items-start gap-4 p-4 rounded-xl border border-border bg-white dark:bg-card hover:border-[#2D6A4F]/50 transition-colors text-left">
          <div className="mt-0.5 p-2 rounded-lg bg-[#2D6A4F]/10 shrink-0">
            <PenLine className="w-5 h-5 text-[#2D6A4F]" />
          </div>
          <div>
            <p className="text-base font-semibold text-black dark:text-white">Build your own</p>
            <p className="text-sm text-black dark:text-white mt-0.5">
              Start from a blank document and write your own terms.
            </p>
          </div>
        </button>
        <button type="button" onClick={() => setPath("upload")}
          className="w-full flex items-start gap-4 p-4 rounded-xl border border-border bg-white dark:bg-card hover:border-[#2D6A4F]/50 transition-colors text-left">
          <div className="mt-0.5 p-2 rounded-lg bg-[#2D6A4F]/10 shrink-0">
            <Upload className="w-5 h-5 text-[#2D6A4F]" />
          </div>
          <div>
            <p className="text-base font-semibold text-black dark:text-white">Upload your own PDF</p>
            <p className="text-sm text-black dark:text-white mt-0.5">
              Already have a document? Upload it here — both parties will sign and upload it back.
            </p>
          </div>
        </button>
      </div>
    );
  }

  function renderTemplateStep() {
    if (loadingTemplate) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 text-[#2D6A4F] animate-spin" />
        </div>
      );
    }
    if (!template) {
      return (
        <div className="py-8 text-center space-y-2">
          <p className="text-sm text-destructive">{error || "Could not load the template."}</p>
          <button type="button" onClick={chooseTemplate} className="text-sm text-[#2D6A4F] hover:underline underline-offset-2">
            Try again
          </button>
        </div>
      );
    }
    return (
      <div className="space-y-5">
        <p className="text-sm text-black dark:text-white">
          Choose the terms that apply to this partnership. You will be able to fill in the specific details after.
        </p>
        {template.toggles.map((t) => (
          <div key={t.key}>
            <p className="text-base font-medium text-black dark:text-white mb-2">{t.label}</p>
            {t.type === "select" ? (
              <div className="flex flex-col gap-2">
                {t.options.map((opt) => (
                  <button key={String(opt.value)} type="button"
                    onClick={() => setToggleValues((prev) => ({ ...prev, [t.key]: opt.value }))}
                    className={`text-left px-4 py-3 rounded-xl border text-sm transition-colors ${
                      toggleValues[t.key] === opt.value
                        ? "border-[#2D6A4F] bg-[#2D6A4F]/8 text-black dark:text-white font-medium"
                        : "border-border text-black dark:text-white hover:border-[#2D6A4F]/40"
                    }`}>
                    {opt.label ?? String(opt.value)}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex gap-2">
                {[{ v: true, l: "Yes" }, { v: false, l: "No" }].map((opt) => (
                  <button key={String(opt.v)} type="button"
                    onClick={() => setToggleValues((prev) => ({ ...prev, [t.key]: opt.v }))}
                    className={`flex-1 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                      toggleValues[t.key] === opt.v
                        ? "border-[#2D6A4F] bg-[#2D6A4F]/8 text-black dark:text-white"
                        : "border-border text-black dark:text-white hover:border-[#2D6A4F]/40"
                    }`}>
                    {opt.l}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <button type="button" onClick={saveTemplateDoc} disabled={saving}
          className="w-full flex items-center justify-center gap-2 bg-[#2D6A4F] hover:bg-[#245c43] text-white rounded-full py-3 text-sm font-medium transition-colors disabled:opacity-60">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Create draft <ArrowRight className="w-4 h-4" /></>}
        </button>
      </div>
    );
  }

  function renderCustomStep() {
    return (
      <div className="space-y-4">
        <p className="text-sm text-black dark:text-white">
          A blank draft will be created for {partnerName}. You will be able to write and edit the full text next.
        </p>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <button type="button" onClick={saveCustomDoc} disabled={saving}
          className="w-full flex items-center justify-center gap-2 bg-[#2D6A4F] hover:bg-[#245c43] text-white rounded-full py-3 text-sm font-medium transition-colors disabled:opacity-60">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Create blank draft <ArrowRight className="w-4 h-4" /></>}
        </button>
      </div>
    );
  }

  function renderUploadStep() {
    return (
      <div className="space-y-4">
        <p className="text-sm text-black dark:text-white">
          Upload the MoU you already have. {partnerName} will be notified to review it.
        </p>
        <label className="flex items-center justify-center gap-2 cursor-pointer rounded-xl border border-dashed border-border px-4 py-6 text-sm text-black dark:text-white hover:border-[#2D6A4F]/40 transition-colors">
          <Upload className="w-4 h-4" />
          {uploadFile ? uploadFile.name : "Click to choose a PDF or Word file"}
          <input type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden" onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)} />
        </label>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <button type="button" onClick={saveUploadDoc} disabled={saving || !uploadFile}
          className="w-full flex items-center justify-center gap-2 bg-[#2D6A4F] hover:bg-[#245c43] text-white rounded-full py-3 text-sm font-medium transition-colors disabled:opacity-60">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Upload & create draft <ArrowRight className="w-4 h-4" /></>}
        </button>
      </div>
    );
  }

  function renderDone() {
    return (
      <div className="text-center py-6 space-y-3">
        <CheckCircle2 className="w-10 h-10 text-[#2D6A4F] mx-auto" />
        <p className="text-base font-semibold text-black dark:text-white">Draft saved</p>
        <p className="text-sm text-black dark:text-white max-w-xs mx-auto">
          Your MoU draft has been created. You can find it alongside this partnership to continue editing, share it with {partnerName}, and track signatures.
        </p>
        <button type="button" onClick={onClose}
          className="mt-2 px-6 py-2.5 rounded-full bg-[#2D6A4F] hover:bg-[#245c43] text-white text-sm font-medium transition-colors">
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}>
      <div className="bg-white dark:bg-card rounded-2xl border border-border w-full max-w-lg shadow-xl flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            {path && !done && (
              <button type="button" onClick={() => setPath(null)} className="text-black dark:text-white hover:text-[#2D6A4F] transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <h2 className="text-lg font-bold text-black dark:text-white">
              {done ? "Draft created" : "Create MoU"}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="text-black dark:text-white hover:text-[#2D6A4F] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-5 overflow-y-auto">
          {loadingOrgs ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 text-[#2D6A4F] animate-spin" />
            </div>
          ) : done ? renderDone()
            : path === "template" ? renderTemplateStep()
            : path === "custom" ? renderCustomStep()
            : path === "upload" ? renderUploadStep()
            : renderPathPicker()}
        </div>
      </div>
    </div>
  );
}