import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldCheck, Loader2, CheckCircle2, ArrowRight } from "lucide-react";

export default function VerifyOrganisation() {
  const { user, profile, refreshProfile } = useAuth();
  const [, navigate] = useLocation();

  const [uploadedFiles, setUploadedFiles]   = useState<File[]>([]);
  const [docLink, setDocLink]               = useState("");
  const [docName, setDocName]               = useState("");
  const [docLinks, setDocLinks]             = useState<string[]>([]);
  const [submitting, setSubmitting]         = useState(false);
  const [submitted, setSubmitted]           = useState(false);
  const [linkError, setLinkError]           = useState("");

  const hasDocuments = uploadedFiles.length > 0 || docLinks.length > 0;

  function handleFileAdd(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files || []);
    const existingSize = uploadedFiles.reduce((sum, f) => sum + f.size, 0);
    const newSize = selected.reduce((sum, f) => sum + f.size, 0);
    if (existingSize + newSize > 5 * 1024 * 1024) {
      alert("Total file size would exceed 5 MB.");
      return;
    }
    setUploadedFiles((prev) => [...prev, ...selected]);
    e.target.value = "";
  }

  function handleAddLink() {
    setLinkError("");
    if (!docLink.trim() || !docName.trim()) {
      setLinkError("Both a URL and a document name are required.");
      return;
    }
    try {
      new URL(docLink.trim());
    } catch {
      setLinkError("Please enter a valid URL including https://");
      return;
    }
    setDocLinks((prev) => [
      ...prev,
      JSON.stringify({ name: docName.trim(), file_url: docLink.trim(), source_type: "link" }),
    ]);
    setDocLink("");
    setDocName("");
  }

  async function handleSubmit() {
    if (!user || !profile) return;
    if (!hasDocuments) return;

    setSubmitting(true);
    const rows: any[] = [];

    // Upload files to Supabase Storage
    for (const f of uploadedFiles) {
      const safeName = f.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = `${user.id}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from("verification-docs")
        .upload(filePath, f);
      if (uploadError) {
        alert(`Upload failed for ${f.name}: ${uploadError.message}`);
        setSubmitting(false);
        return;
      }
      rows.push({
        profile_id:    user.id,
        name:          f.name,
        document_url:  null,
        file_path:     filePath,
        document_type: f.type,
        source_type:   "upload",
      });
    }

    // Add pasted links
    for (const l of docLinks) {
      const parsed = JSON.parse(l);
      rows.push({
        profile_id:    user.id,
        name:          parsed.name,
        document_url:  parsed.file_url,
        file_path:     null,
        document_type: "url",
        source_type:   "link",
      });
    }

    // Insert documents
    const { error: insertError } = await supabase
      .from("verification_documents")
      .insert(rows);

    if (insertError) {
      alert(`Failed to save documents: ${insertError.message}`);
      setSubmitting(false);
      return;
    }

    // Mark verification as requested and onboarding complete on profile
    await supabase
      .from("profiles")
      .update({
        verification_requested: true,
        onboarding_completed: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    await refreshProfile();
    setSubmitting(false);
    setSubmitted(true);
  }

  // ─── Success screen ────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-md text-center space-y-5">
          <div className="flex justify-center">
            <div className="p-4 rounded-full bg-[#2D6A4F]/10">
              <CheckCircle2 className="w-10 h-10 text-[#2D6A4F]" />
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-foreground">Documents submitted</h2>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
              The team will review your submission within 48 hours. You'll be notified once verified.
            </p>
          </div>
          <Button
            onClick={() => navigate("/dashboard")}
            className="bg-[#2D6A4F] hover:bg-[#245c43] text-white px-6"
          >
            Go to dashboard
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    );
  }

  // ─── Upload screen ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg space-y-6">

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="p-3 rounded-full bg-[#2D6A4F]/10">
              <ShieldCheck className="w-8 h-8 text-[#2D6A4F]" />
            </div>
          </div>
          <h1 className="text-2xl font-semibold text-foreground">Verify your organisation</h1>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Upload your registration document or paste a link. Takes less than 48 hours to review.
          </p>
        </div>

        <div className="bg-card rounded-2xl border border-border shadow-sm p-6 space-y-6">

          {/* File upload */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">Upload files</p>
              <span className="text-xs text-muted-foreground">Max 5 MB total</span>
            </div>
            <label className="flex items-center justify-center gap-2 cursor-pointer rounded-xl border border-dashed border-border px-4 py-4 text-sm text-muted-foreground hover:border-[#2D6A4F]/40 hover:text-foreground transition-colors">
              <span>+ Add file</span>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                className="sr-only"
                multiple
                onChange={handleFileAdd}
              />
            </label>
            {uploadedFiles.length > 0 && (
              <div className="space-y-2">
                {uploadedFiles.map((f, i) => (
                  <div key={i} className="flex items-center justify-between text-xs border border-border rounded-lg px-3 py-2 bg-muted/30">
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="font-medium text-foreground truncate">{f.name}</span>
                      <span className="text-muted-foreground">{(f.size / 1024).toFixed(0)} KB</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setUploadedFiles((prev) => prev.filter((_, idx) => idx !== i))}
                      className="text-muted-foreground hover:text-foreground ml-3 shrink-0"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="flex-1 border-t border-border" />
            OR
            <div className="flex-1 border-t border-border" />
          </div>

          {/* Link input */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">Paste a link</p>
            <Input
              placeholder="https://docs.example.com/registration"
              value={docLink}
              onChange={(e) => { setDocLink(e.target.value); setLinkError(""); }}
              className="h-10"
            />
            <Input
              placeholder="Document name (e.g. CAC Registration Certificate)"
              value={docName}
              onChange={(e) => { setDocName(e.target.value); setLinkError(""); }}
              className="h-10"
            />
            {linkError && (
              <p className="text-xs text-destructive">{linkError}</p>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddLink}
            >
              Add link →
            </Button>
          </div>

          {/* Added links */}
          {docLinks.length > 0 && (
            <div className="space-y-2 border-t border-border pt-4">
              <p className="text-sm font-medium text-foreground">Added links</p>
              {docLinks.map((l, i) => {
                const parsed = JSON.parse(l);
                return (
                  <div key={i} className="flex items-center justify-between text-xs border border-border rounded-lg px-3 py-2 bg-muted/30">
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="font-medium text-foreground truncate">{parsed.name}</span>
                      <span className="text-muted-foreground truncate">{parsed.file_url}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDocLinks((prev) => prev.filter((_, idx) => idx !== i))}
                      className="text-muted-foreground hover:text-foreground ml-3 shrink-0"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip for now
          </button>
          <Button
            onClick={handleSubmit}
            disabled={!hasDocuments || submitting}
            className="bg-[#2D6A4F] hover:bg-[#245c43] text-white px-6"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                Submit for review
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Accepted formats: PDF, DOC, DOCX, PNG, JPG. Max 5 MB total.
        </p>
      </div>
    </div>
  );
}
