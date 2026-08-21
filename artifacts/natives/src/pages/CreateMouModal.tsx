import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { X, FileText, PenLine, Upload, Loader2, CheckCircle2, ArrowRight, ArrowLeft } from "lucide-react";
import IndicatorForm from "@/components/mou/IndicatorForm";

// ─── Types ────────────────────────────────────────────────────────────────────
type Path = "template" | "custom" | "upload" | null;
type Stage = "picker" | "path_step" | "indicators";

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
  subscription_tier?: string;
}

interface Props {
  myUserId: string;
  partnerUserId?: string;
  partnerOrgId?: string;
  partnerName: string;
  initiativeId: string | null;
  initiativeTitle: string;
  connectionId: string | null;
  onClose: () => void;
  // Navigates straight into the created (or pre-existing) draft instead of
  // showing a "Draft saved, click Done" screen the person has to dismiss.
  onOpenDocument: (documentId: string) => void;
}
export default function CreateMouModal({
  myUserId, partnerUserId, partnerOrgId, partnerName, initiativeId, initiativeTitle, connectionId, onClose, onOpenDocument,
}: Props) {
  const [, navigate] = useLocation();
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const [myOrg, setMyOrg] = useState<OrgLite | null>(null);
  const [partnerOrg, setPartnerOrg] = useState<OrgLite | null>(null);
  const [path, setPath] = useState<Path>(null);
  const [template, setTemplate] = useState<MouTemplate | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [toggleValues, setToggleValues] = useState<Record<string, string | boolean>>({});
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // New mandatory step: once any of the three creation paths succeeds,
  // the draft exists but can't be sent until it has at least one
  // indicator (enforced hard at the DB level via a trigger on
  // mou_documents -- this step is what guarantees that's already
  // satisfied by the time anyone reaches "send", rather than leaving
  // indicator-adding to some undefined later point in the flow).
  const [stage, setStage] = useState<Stage>("picker");
  const [createdDocId, setCreatedDocId] = useState<string | null>(null);
  // Only one MoU is allowed per initiative -- if one already exists,
  // creation is skipped entirely and the person is routed straight into
  // the existing document instead of hitting a duplicate-key error.
  const [checkingExisting, setCheckingExisting] = useState(true);
  const [existingDocId, setExistingDocId] = useState<string | null>(null);
  // Initiative creator = Org A by design (platform-wide rule) -- a
  // confirmed partner is never allowed to spin up the MoU themselves and
  // cast themselves as org_a. The database enforces this on insert; this
  // just gives a clear message instead of letting them hit a raw RLS
  // error after clicking through the whole picker.
  const [notInitiativeCreator, setNotInitiativeCreator] = useState(false);
  // Same rule as notInitiativeCreator, for direct partnerships: the
  // listing owner (receiver on the formed connection -- Express Interest
  // can only ever target an org that has a listing) is the only one who
  // may start the MoU. The database enforces this on insert too; this
  // just gives a clear message instead of a raw RLS error.
  const [notListingOwner, setNotListingOwner] = useState(false);
  useEffect(() => {
    init();
  }, []);
  async function init() {
    setLoadingOrgs(true);
    setCheckingExisting(true);
    const { data: mineData } = await supabase
      .from("organizations").select("id, organisation_name, subscription_tier").eq("user_id", myUserId).maybeSingle();
    setMyOrg(mineData ?? null);
    let theirs: OrgLite | null = null;
    if (partnerOrgId) {
      const { data: theirsData } = await supabase
        .from("organizations").select("id, organisation_name").eq("id", partnerOrgId).maybeSingle();
      theirs = theirsData ?? null;
    } else if (partnerUserId) {
      const { data: theirsData } = await supabase
        .from("organizations").select("id, organisation_name").eq("user_id", partnerUserId).maybeSingle();
      theirs = theirsData ?? null;
    }
    setPartnerOrg(theirs);
    setLoadingOrgs(false);
    if (initiativeId) {
      const { data: ini } = await supabase.from("initiative_requests").select("user_id").eq("id", initiativeId).maybeSingle();
      if (ini && ini.user_id !== myUserId) {
        setNotInitiativeCreator(true);
        setCheckingExisting(false);
        return;
      }
    }
    if (connectionId) {
      const { data: conn } = await supabase.from("partnership_connections").select("receiver_org_id").eq("id", connectionId).maybeSingle();
      if (conn && mineData && conn.receiver_org_id !== mineData.id) {
        setNotListingOwner(true);
        setCheckingExisting(false);
        return;
      }
    }
    // Scoped to this specific initiative + partner pairing -- an
    // initiative can have multiple confirmed partners, each entitled to
    // their own MoU, so checking initiative_id alone would wrongly block
    // the second partner from ever starting theirs. Same logic applies to
    // direct partnership connections: the same two orgs could separately
    // be matched via an initiative AND have a direct connection, and those
    // are legitimately two different MoUs, not a duplicate.
    if (initiativeId && mineData && theirs) {
      const { data } = await supabase
        .from("mou_documents").select("id")
        .eq("initiative_id", initiativeId)
        .or(`and(org_a_id.eq.${mineData.id},org_b_id.eq.${theirs.id}),and(org_a_id.eq.${theirs.id},org_b_id.eq.${mineData.id})`)
        .maybeSingle();
      setExistingDocId(data?.id ?? null);
    } else if (connectionId && mineData && theirs) {
      const { data } = await supabase
        .from("mou_documents").select("id")
        .eq("connection_id", connectionId)
        .or(`and(org_a_id.eq.${mineData.id},org_b_id.eq.${theirs.id}),and(org_a_id.eq.${theirs.id},org_b_id.eq.${mineData.id})`)
        .maybeSingle();
      setExistingDocId(data?.id ?? null);
    }
    setCheckingExisting(false);
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
    const { data: inserted, error: insertError } = await supabase.from("mou_documents").insert({
      org_a_id: myOrg.id,
      org_b_id: partnerOrg.id,
      initiative_id: initiativeId,
      connection_id: connectionId,
      source_type: "template",
      template_id: template?.id,
      toggle_selections: toggleValues,
      field_values: {},
      status: "draft",
      created_by: myUserId,
    }).select("id").single();
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    if (inserted) { setCreatedDocId(inserted.id); setStage("indicators"); }
  }
  async function saveCustomDoc() {
    if (!myOrg || !partnerOrg) return;
    setSaving(true);
    setError("");
    const { data: inserted, error: insertError } = await supabase.from("mou_documents").insert({
      org_a_id: myOrg.id,
      org_b_id: partnerOrg.id,
      initiative_id: initiativeId,
      connection_id: connectionId,
      source_type: "custom",
      status: "draft",
      created_by: myUserId,
    }).select("id").single();
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    if (inserted) { setCreatedDocId(inserted.id); setStage("indicators"); }
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

    const { data: inserted, error: insertError } = await supabase.from("mou_documents").insert({
      org_a_id: myOrg.id,
      org_b_id: partnerOrg.id,
      initiative_id: initiativeId,
      connection_id: connectionId,
      source_type: "uploaded_pdf",
      rendered_file_path: path,
      status: "draft",
      created_by: myUserId,
    }).select("id").single();
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    if (inserted) { setCreatedDocId(inserted.id); setStage("indicators"); }
  }
  function renderPathPicker() {
    if (myOrg && !["plus", "pro", "compliance"].includes(myOrg.subscription_tier ?? "")) {
      return (
        <div className="space-y-4">
          <p className="text-base text-black dark:text-white">
            Drafting an MoU with <span className="font-semibold">{partnerName}</span> needs a Plus plan or higher.
          </p>
          <button type="button" onClick={() => navigate("/dashboard/settings?tab=billing")}
            className="w-full h-10 rounded-full bg-[#2D6A4F] hover:bg-[#245c43] text-white text-sm font-semibold transition-colors">
            Upgrade
          </button>
        </div>
      );
    }
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

  // Financial and Hybrid support types imply a real financial commitment,
  // which contradicts "non-binding" -- rather than showing both and
  // relying on disclaimer copy, the invalid options are removed from the
  // picker entirely once Agreement type is set to non-binding.
  function visibleToggleOptions(t: TemplateToggle): TemplateToggleOption[] {
    if (t.key !== "support_type" || toggleValues["agreement_type"] !== "non_binding") return t.options;
    return t.options.filter((o) => o.value !== "financial" && o.value !== "hybrid");
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
                {visibleToggleOptions(t).map((opt) => (
                  <button key={String(opt.value)} type="button"
                    onClick={() => setToggleValues((prev) => {
                      const next = { ...prev, [t.key]: opt.value };
                      if (t.key === "agreement_type" && opt.value === "non_binding" && (next.support_type === "financial" || next.support_type === "hybrid")) {
                        next.support_type = "in_kind";
                      }
                      return next;
                    })}
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

  function renderNotCreator() {
    return (
      <div className="text-center py-6 space-y-3">
        <X className="w-10 h-10 text-red-600 mx-auto" />
        <p className="text-base font-semibold text-black dark:text-white">Only the initiative creator can start this MoU</p>
        <p className="text-sm text-black dark:text-white max-w-xs mx-auto">
          For {initiativeTitle || "this initiative"}, only the organisation that created it can start the MoU with a confirmed partner.
        </p>
      </div>
    );
  }

  function renderNotListingOwner() {
    return (
      <div className="text-center py-6 space-y-3">
        <X className="w-10 h-10 text-red-600 mx-auto" />
        <p className="text-base font-semibold text-black dark:text-white">Only the listing owner can start this MoU</p>
        <p className="text-sm text-black dark:text-white max-w-xs mx-auto">
          You expressed interest in {partnerName || "this organisation"}'s listing, so only {partnerName || "they"} can start the MoU here — not the other way round.
        </p>
      </div>
    );
  }

  function renderIndicatorsStep() {
    if (!myOrg || !createdDocId) return null;
    return (
      <div className="space-y-4">
        <p className="text-sm text-black dark:text-white">
          Add at least one outcome indicator before this MoU can be sent to {partnerName}. You can add more later, from either side.
        </p>
        <IndicatorForm
          mouDocumentId={createdDocId}
          createdByOrgId={myOrg.id}
          initiativeId={initiativeId}
          connectionId={connectionId}
          onClose={() => onOpenDocument(createdDocId)}
          onCreated={() => onOpenDocument(createdDocId)}
        />
      </div>
    );
  }

  function renderExisting() {    return (
      <div className="text-center py-6 space-y-3">
        <CheckCircle2 className="w-10 h-10 text-[#2D6A4F] mx-auto" />
        <p className="text-base font-semibold text-black dark:text-white">An MoU already exists</p>
        <p className="text-sm text-black dark:text-white max-w-xs mx-auto">
          {partnerName} or your team has already started an MoU for {initiativeTitle || "this partnership"}. Only one MoU can exist per partnership.
        </p>
        <button type="button" onClick={() => existingDocId && onOpenDocument(existingDocId)}
          className="mt-2 px-6 py-2.5 rounded-full bg-[#2D6A4F] hover:bg-[#245c43] text-white text-sm font-medium transition-colors">
          Open existing MoU
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
            {path && !existingDocId && !notInitiativeCreator && !notListingOwner && (
              <button type="button" onClick={() => setPath(null)} className="text-black dark:text-white hover:text-[#2D6A4F] transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <h2 className="text-lg font-bold text-black dark:text-white">
              {notInitiativeCreator || notListingOwner ? "Not available" : existingDocId ? "MoU already exists" : "Create MoU"}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="text-black dark:text-white hover:text-[#2D6A4F] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-5 overflow-y-auto">
          {loadingOrgs || checkingExisting ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 text-[#2D6A4F] animate-spin" />
            </div>
          ) : notInitiativeCreator ? renderNotCreator()
            : notListingOwner ? renderNotListingOwner()
            : existingDocId ? renderExisting()
            : stage === "indicators" ? renderIndicatorsStep()
            : path === "template" ? renderTemplateStep()
            : path === "custom" ? renderCustomStep()
            : path === "upload" ? renderUploadStep()
            : renderPathPicker()}
        </div>
      </div>
    </div>
  );
}