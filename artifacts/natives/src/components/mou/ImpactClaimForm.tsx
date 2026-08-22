
import { useState } from "react";

import { supabase } from "@/lib/supabase";

import { Loader2, Upload, Link as LinkIcon, X } from "lucide-react";

// Bucket name is a placeholder pending the storage-bucket decision --

// see flag in chat. Swap once that's settled; nothing else in this file

// depends on which bucket is chosen.

const EVIDENCE_BUCKET = "impact-evidence";

export default function ImpactClaimForm({

  indicatorId, claimingOrgId, onClose, onCreated,

}: {

  indicatorId: string;

  claimingOrgId: string;

  onClose: () => void;

  onCreated: () => void;

}) {

  const [claimText, setClaimText] = useState("");

  const [indicatorValue, setIndicatorValue] = useState("");

  const [evidenceType, setEvidenceType] = useState<"file" | "link">("file");

  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);

  const [evidenceLink, setEvidenceLink] = useState("");

  const [uploading, setUploading] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {

    if (!claimText.trim() || !indicatorValue.trim()) return;

    if (evidenceType === "file" && !evidenceFile) return;

    if (evidenceType === "link" && !evidenceLink.trim()) return;

    setSubmitting(true);

    setError(null);

    let evidenceValue: string;

    if (evidenceType === "file") {

      setUploading(true);

      const path = `evidence/${indicatorId}/${claimingOrgId}-${Date.now()}-${evidenceFile!.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;

      const { error: uploadError } = await supabase.storage.from(EVIDENCE_BUCKET).upload(path, evidenceFile!);

      setUploading(false);

      if (uploadError) {

        setError("Couldn't upload evidence file. Try again.");

        setSubmitting(false);

        return;

      }

      evidenceValue = path;

    } else {

      evidenceValue = evidenceLink.trim();

    }

    const { error: insertError } = await supabase.from("impact_claims").insert({

      indicator_id: indicatorId,

      claiming_org_id: claimingOrgId,

      claim_text: claimText.trim(),

      indicator_value: indicatorValue.trim(),

      evidence_type: evidenceType,

      evidence_value: evidenceValue,

    });

    setSubmitting(false);

    if (insertError) {

      setError("Couldn't submit the claim. Try again.");

      return;

    }

    onCreated();

    onClose();

  }

  const canSubmit = claimText.trim() && indicatorValue.trim() &&

    ((evidenceType === "file" && evidenceFile) || (evidenceType === "link" && evidenceLink.trim()));

  return (

    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>

      <div className="bg-white dark:bg-card rounded-t-2xl sm:rounded-2xl border border-border w-full sm:max-w-sm shadow-xl p-6 space-y-4"

        onClick={(e) => e.stopPropagation()}>

        <div className="flex items-center justify-between">

          <p className="text-base font-bold text-black dark:text-white">Submit impact claim</p>

          <button type="button" onClick={onClose} className="p-1 rounded-full hover:bg-muted transition-colors">

            <X className="w-4 h-4 text-black dark:text-white" />

          </button>

        </div>

        <textarea placeholder="What are you claiming?" value={claimText} onChange={(e) => setClaimText(e.target.value)}

          rows={3} className="w-full px-3 py-2 rounded-lg border border-border bg-transparent text-sm text-black dark:text-white resize-none" />

        <input type="text" placeholder="Indicator value (the measured result)" value={indicatorValue}

          onChange={(e) => setIndicatorValue(e.target.value)}

          className="w-full h-10 px-3 rounded-lg border border-border bg-transparent text-sm text-black dark:text-white" />

        <div>

          <p className="text-xs text-black dark:text-white mb-1.5">Evidence</p>

          <div className="flex items-center rounded-full border border-border p-0.5 w-fit mb-2">

            <button type="button" onClick={() => setEvidenceType("file")}

              className={`flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-full transition-colors ${

                evidenceType === "file" ? "bg-[#2D6A4F] text-white" : "text-black dark:text-white"

              }`}>

              <Upload className="w-3 h-3" /> File

            </button>

            <button type="button" onClick={() => setEvidenceType("link")}

              className={`flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-full transition-colors ${

                evidenceType === "link" ? "bg-[#2D6A4F] text-white" : "text-black dark:text-white"

              }`}>

              <LinkIcon className="w-3 h-3" /> Link

            </button>

          </div>

          {evidenceType === "file" ? (

            <label className="flex items-center justify-center gap-2 cursor-pointer rounded-xl border border-dashed border-border px-4 py-4 text-sm text-black dark:text-white hover:border-[#2D6A4F]/40 transition-colors">

              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}

              {evidenceFile ? evidenceFile.name : "Choose evidence file"}

              <input type="file" className="hidden" disabled={uploading}

                onChange={(e) => setEvidenceFile(e.target.files?.[0] ?? null)} />

            </label>

          ) : (

            <input type="url" placeholder="https://..." value={evidenceLink} onChange={(e) => setEvidenceLink(e.target.value)}

              className="w-full h-10 px-3 rounded-lg border border-border bg-transparent text-sm text-black dark:text-white" />

          )}

        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>}

        <div className="flex gap-2">

          <button type="button" onClick={onClose}

            className="flex-1 h-10 rounded-full border border-border text-sm text-black dark:text-white hover:border-foreground/30 transition-colors">

            Cancel

          </button>

          <button type="button" onClick={handleSubmit} disabled={submitting || !canSubmit}

            className="flex-1 h-10 rounded-full bg-[#2D6A4F] hover:bg-[#245c43] text-white text-sm font-medium disabled:opacity-60 transition-colors">

            {submitting ? "Submitting..." : "Submit claim"}

          </button>

        </div>

      </div>

    </div>

  );

}

