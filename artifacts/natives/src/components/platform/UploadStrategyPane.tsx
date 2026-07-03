import { useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Upload, Loader2, CheckCircle2, X, Sparkles } from "lucide-react";

type ExecutiveSummary = {
  introduction: string;
  problem_statement: string;
  strategic_approach: string;
  impact_goals: string;
  target_beneficiaries: string;
  regulatory_alignment: string;
  budget_allocation: string;
  next_steps: string;
};

type Pillar = {
  pillar_name: string;
  corporate_input: string;
  direct_output: string;
  target_demographics: string;
  measurable_outcome: string;
  long_term_impact: string;
  un_sdg_code: string;
  sasb_material_topic: string;
  au_agenda_2063_goal: string | null;
  compliance_note: string;
  specific_ask_draft: string;
  suggested_partnerships: string[];
  pushed?: boolean;
};

type ParsedStrategy = {
  organisation_name?: string | null;
  description?: string | null;
  csr_budget_range?: string | null;
  esg_frameworks?: string[] | null;
  geographic_focus?: string[] | null;
  sdg_tags?: string[] | null;
};

export function UploadStrategyPane({
  organizationId,
  operatingCountry,
}: {
  organizationId: string;
  operatingCountry: string;
}) {
  const [uploading, setUploading]     = useState(false);
  const [converting, setConverting]   = useState(false);
  const [fileName, setFileName]       = useState<string | null>(null);
  const [error, setError]             = useState<string | null>(null);
  const [parsed, setParsed]           = useState<ParsedStrategy | null>(null);
  const [pillars, setPillars]               = useState<Pillar[] | null>(null);
  const [executiveSummary, setExecutiveSummary] = useState<ExecutiveSummary | null>(null);
  const [pushingIndex, setPushingIndex]     = useState<number | null>(null);
  const [pushError, setPushError]           = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);
    setFileName(file.name);
    setParsed(null);
    setPillars(null);

    const allowed = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (!allowed.includes(file.type)) {
      setError("Only PDF and DOCX files are supported.");
      setFileName(null);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("File must be under 10MB.");
      setFileName(null);
      return;
    }

    setUploading(true);
    try {
      const buffer = await file.arrayBuffer();
      const bytes  = new Uint8Array(buffer);
      let binary   = "";
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-org-profile`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ file_base64: base64, file_type: file.type, track: "corporate" }),
        }
      );
      const result = await res.json();
      if (!res.ok || result.error) {
        setError(result.error ?? "Could not extract data from this document. Try a DOCX file.");
        setUploading(false);
        return;
      }
      setParsed(result.data);
    } catch {
      setError("Something went wrong. Check your connection and try again.");
    }
    setUploading(false);
  }

  async function handleConvert() {
    if (!parsed) return;
    setConverting(true);
    setError(null);

    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-impact-strategy`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            action: "convert_uploaded_strategy",
            organization_id: organizationId,
            parsed_strategy: parsed,
            operating_country: operatingCountry,
          }),
        }
      );
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not convert strategy. Try again.");
        return;
      }
      setPillars(json.pillars);
      if (json.executive_summary) setExecutiveSummary(json.executive_summary);
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    }
    setConverting(false);
  }

  async function handlePushPillar(pillar: Pillar, index: number) {
    setPushingIndex(index);
    setPushError(null);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-impact-strategy`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            action: "push_pillar",
            organization_id: organizationId,
            pillar: { ...pillar, operating_region: operatingCountry },
          }),
        }
      );
      const json = await res.json();
      if (!res.ok) {
        setPushError(json.error ?? "Could not push this pillar.");
        return;
      }
      const updatedPillars = pillars
        ? pillars.map((p, i) => (i === index ? { ...p, pushed: true } : p))
        : null;
      if (updatedPillars) {
        await supabase
          .from("organizations")
          .update({ impact_strategy: JSON.stringify({ pillars: updatedPillars }) })
          .eq("id", organizationId);
      }
      setPillars(updatedPillars);
    } catch {
      setPushError("Could not reach the server. Try again.");
    }
    setPushingIndex(null);
  }

  return (
    <div className="space-y-6">
      {!parsed && (
        <>
          <p className="text-sm text-muted-foreground">
            Upload your existing sustainability or CSR strategy document. AI will extract the key initiatives and convert them into partner-ready listings.
          </p>
          <p className="text-xs text-muted-foreground">
            For best results, upload a DOCX file. PDF extraction is limited to text-based PDFs only. Documents are truncated at 8,000 characters — long documents may lose content from later pages.
          </p>

          <div
            className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-colors cursor-pointer ${
              uploading
                ? "border-[#2D6A4F]/40 bg-[#2D6A4F]/5"
                : "border-border hover:border-[#2D6A4F]/40 hover:bg-muted/30"
            }`}
            onClick={() => !uploading && fileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          >
            <input
              ref={fileRef} type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
            {uploading ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-[#2D6A4F] animate-spin" />
                <p className="text-sm text-muted-foreground">Reading your document...</p>
                <p className="text-xs text-muted-foreground">This takes 10–20 seconds</p>
              </div>
            ) : fileName ? (
              <div className="flex flex-col items-center gap-2">
                <CheckCircle2 className="w-8 h-8 text-[#2D6A4F]" />
                <p className="text-sm font-medium text-foreground">{fileName}</p>
                <button type="button"
                  onClick={e => { e.stopPropagation(); setFileName(null); setError(null); }}
                  className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2">
                  Remove
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <Upload className="w-8 h-8 text-muted-foreground/40" />
                <div>
                  <p className="text-sm font-medium text-foreground">Drop your file here or click to browse</p>
                  <p className="text-xs text-muted-foreground mt-1">PDF or DOCX · Up to 10MB</p>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
              <X className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 leading-relaxed">{error}</p>
            </div>
          )}
        </>
      )}

      {parsed && !pillars && (
        <div className="space-y-4">
          <div className="flex items-start gap-2 rounded-lg border border-[#2D6A4F]/20 bg-[#2D6A4F]/5 px-4 py-3">
            <CheckCircle2 className="w-4 h-4 text-[#2D6A4F] shrink-0 mt-0.5" />
            <p className="text-xs text-[#2D6A4F] leading-relaxed">
              Document parsed. Review what was extracted before converting to initiatives.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            {parsed.organisation_name && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Organisation</p>
                <p className="text-sm text-foreground mt-0.5">{parsed.organisation_name}</p>
              </div>
            )}
            {parsed.description && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">CSR focus</p>
                <p className="text-sm text-foreground mt-0.5 leading-relaxed">{parsed.description}</p>
              </div>
            )}
            {parsed.csr_budget_range && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Budget range</p>
                <p className="text-sm text-foreground mt-0.5">{parsed.csr_budget_range}</p>
              </div>
            )}
            {parsed.esg_frameworks && parsed.esg_frameworks.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">ESG frameworks</p>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {parsed.esg_frameworks.map(f => (
                    <span key={f} className="text-xs px-2.5 py-0.5 rounded-full"
                      style={{ background: "rgba(45,106,79,0.08)", color: "#2D6A4F" }}>{f}</span>
                  ))}
                </div>
              </div>
            )}
            {parsed.sdg_tags && parsed.sdg_tags.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">SDGs</p>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {parsed.sdg_tags.map(s => (
                    <span key={s} className="text-xs px-2.5 py-0.5 rounded-full"
                      style={{ background: "rgba(45,106,79,0.08)", color: "#2D6A4F" }}>{s}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="p-4 rounded-xl border border-amber-200 bg-amber-50">
            <p className="text-xs text-amber-800 leading-relaxed">
              The AI will now generate initiative pillars from this strategy. Each pillar can be pushed individually to Initiatives for review and publishing.
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
              <X className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 leading-relaxed">{error}</p>
            </div>
          )}

          <div className="flex gap-3">
            <button type="button"
              onClick={() => { setParsed(null); setFileName(null); }}
              className="flex-1 h-10 rounded-full border border-border text-sm text-muted-foreground hover:text-foreground transition-colors">
              Upload different document
            </button>
            <button type="button"
              onClick={handleConvert}
              disabled={converting}
              className="flex-1 h-10 rounded-full text-sm font-semibold text-white transition-colors flex items-center justify-center gap-2"
              style={{ backgroundColor: "#2D6A4F" }}>
              {converting
                ? <><Loader2 className="w-4 h-4 animate-spin" />Converting...</>
                : <><Sparkles className="w-4 h-4" />Convert to initiatives</>
              }
            </button>
          </div>
        </div>
      )}

      {pillars && (
        <div className="space-y-4">
          <button type="button"
            onClick={() => { setPillars(null); setParsed(null); setFileName(null); setExecutiveSummary(null); }}
            className="text-sm underline"
            style={{ color: "#C45C26" }}>
            Upload a different document
          </button>

          {executiveSummary && (
            <div className="rounded-xl border border-border bg-card p-5 space-y-4 mb-2">
              <p className="text-[10px] font-black uppercase tracking-widest"
                style={{ color: "#2D6A4F" }}>Executive Summary</p>

              {([
                { key: "introduction",        label: "Introduction & Purpose"          },
                { key: "problem_statement",   label: "Problem Statement"               },
                { key: "strategic_approach",  label: "Strategic Approach"              },
                { key: "impact_goals",        label: "Impact Goals & KPIs"             },
                { key: "target_beneficiaries",label: "Target Beneficiaries"            },
                { key: "regulatory_alignment",label: "Regulatory & Framework Alignment" },
                { key: "budget_allocation",   label: "Budget & Allocation"             },
                { key: "next_steps",          label: "Implementation Roadmap"          },
              ] as { key: keyof ExecutiveSummary; label: string }[]).map(({ key, label }) =>
                executiveSummary[key] ? (
                  <div key={key}>
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground mb-1">
                      {label}
                    </p>
                    <p className="text-sm text-foreground leading-relaxed">
                      {executiveSummary[key]}
                    </p>
                  </div>
                ) : null
              )}
            </div>
          )}

          {pillars.map((pillar, i) => (
            <div key={i} className="rounded-lg p-4"
              style={{
                background: "linear-gradient(135deg, rgba(45,106,79,0.08) 0%, rgba(45,106,79,0.02) 100%)",
                border: "1px solid rgba(45,106,79,0.18)",
              }}>
              <h3 className="font-bold text-lg mb-2">{pillar.pillar_name}</h3>
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-[0.12em]">Outcome</dt>
                  <dd>{pillar.measurable_outcome}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-[0.12em]">Specific ask</dt>
                  <dd>{pillar.specific_ask_draft}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-[0.12em]">SDG</dt>
                  <dd>{pillar.un_sdg_code}</dd>
                </div>
                {pillar.au_agenda_2063_goal && (
                  <div>
                    <dt className="text-[10px] font-bold uppercase tracking-[0.12em]">AU Agenda 2063</dt>
                    <dd>{pillar.au_agenda_2063_goal}</dd>
                  </div>
                )}
                {pillar.compliance_note && (
                  <p className="text-xs italic text-muted-foreground">{pillar.compliance_note}</p>
                )}
              </dl>

              <div className="mt-4 pt-4 border-t" style={{ borderColor: "rgba(45,106,79,0.18)" }}>
                {pillar.pushed ? (
                  <p className="text-sm font-medium" style={{ color: "#2D6A4F" }}>
                    ✓ Sent to Initiatives — review and publish there
                  </p>
                ) : (
                  <button type="button"
                    onClick={() => handlePushPillar(pillar, i)}
                    disabled={pushingIndex === i}
                    className="text-sm font-semibold rounded px-4 py-2"
                    style={{ backgroundColor: "#2D6A4F", color: "white" }}>
                    {pushingIndex === i ? "Pushing..." : "Push to Initiatives"}
                  </button>
                )}
              </div>
            </div>
          ))}
          {pushError && <p className="text-sm text-red-600">{pushError}</p>}
        </div>
      )}
    </div>
  );
}