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

  const [registrationType, setRegistrationType]     = useState<"RC" | "BN" | "IT" | "">("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [tin, setTin]                                = useState("");
  const [isDnfbpSector, setIsDnfbpSector]            = useState<boolean | null>(null);
  const [scumlNumber, setScumlNumber]                = useState("");
  const [regError, setRegError]                      = useState("");
  const [regNumberFieldError, setRegNumberFieldError] = useState("");
  const [tinFieldError, setTinFieldError]             = useState("");
  const [scumlFieldError, setScumlFieldError]         = useState("");

  // CAC registry numbers vary in digit count across registration eras (4–10 digits
  // seen in practice), so this checks "numeric only" rather than a fixed length.
  function validateRegistrationNumber(type: "RC" | "BN" | "IT" | "", value: string): string {
    if (!value.trim()) return "";
    const stripped = value.trim().toUpperCase().replace(new RegExp(`^${type}[\\s-]*`), "").replace(/[\s-]/g, "");
    if (!/^\d{2,10}$/.test(stripped)) {
      return `Enter numbers only (e.g. ${type}1234567) — no letters or symbols.`;
    }
    return "";
  }

  // TIN is strictly numeric, 10 to 15 digits.
  function validateTin(value: string): string {
    if (!value.trim()) return "";
    const v = value.trim();
    if (!/^\d{10,15}$/.test(v)) {
      return "TIN must be digits only, 10 to 15 digits long.";
    }
    return "";
  }

  // SCUML certificate number: "SC" followed by 9 digits (e.g. SC123456789).
  function validateScuml(value: string): string {
    if (!value.trim()) return "";
    const stripped = value.trim().toUpperCase().replace(/[\s-]/g, "");
    if (!/^SC\d{9}$/.test(stripped)) {
      return "SCUML number should be SC followed by 9 digits (e.g. SC123456789).";
    }
    return "";
  }

  // SCUML is mandatory for IT (NGOs are DNFIs under the Money Laundering
  // Prohibition Act), conditional for RC/BN based on the DNFBP follow-up.
  const scumlRequired = registrationType === "IT" || (registrationType !== "" && isDnfbpSector === true);

  const hasDocuments = uploadedFiles.length > 0 || docLinks.length > 0;
  const hasRegistrationInfo =
    registrationType !== "" &&
    registrationNumber.trim() !== "" &&
    tin.trim() !== "" &&
    (!scumlRequired || scumlNumber.trim() !== "") &&
    !validateRegistrationNumber(registrationType, registrationNumber) &&
    !validateTin(tin) &&
    (!scumlRequired || !validateScuml(scumlNumber));

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
    if (!hasDocuments || !hasRegistrationInfo) return;

    setRegError("");
    setSubmitting(true);

    // Save structured registration data to the org record before touching documents,
    // so a document-upload failure never leaves the numbers unsaved.
    const { error: regUpdateError } = await supabase
      .from("organizations")
      .update({
        registration_type: registrationType,
        registration_number: registrationNumber.trim(),
        tin: tin.trim(),
        is_dnfbp_sector: registrationType === "IT" ? null : isDnfbpSector,
        scuml_number: scumlRequired ? scumlNumber.trim() : null,
      })
      .eq("user_id", user.id);

    if (regUpdateError) {
      setRegError(`Failed to save registration details: ${regUpdateError.message}`);
      setSubmitting(false);
      return;
    }

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
            <h2 className="text-[25.5px] font-semibold text-black">Documents submitted</h2>
            <p className="text-[15.5px] text-black mt-2 max-w-sm mx-auto">
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
          <h1 className="text-[25.5px] font-semibold text-black">Verify your organisation</h1>
          <p className="text-[15.5px] text-black max-w-sm mx-auto">
            Enter your registration details and upload supporting documents. Takes less than 48 hours to review.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-border shadow-sm p-6 space-y-6">

          {/* Registration details */}
          <div className="space-y-3">
            <p className="text-[15.5px] font-medium text-black">Registration type</p>
            <div className="flex gap-2">
              {([
                { value: "RC", label: "Company (RC)" },
                { value: "BN", label: "Business Name (BN)" },
                { value: "IT", label: "Incorporated Trustees (IT)" },
              ] as const).map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => { setRegistrationType(value); setIsDnfbpSector(null); }}
                  className={`flex-1 text-[13.5px] px-3 py-2 rounded-lg border transition-colors ${
                    registrationType === value
                      ? "bg-[#2D6A4F] border-[#2D6A4F] text-white"
                      : "border-border text-black hover:border-[#2D6A4F]/40"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {registrationType !== "" && (
              <>
                <Input
                  placeholder={registrationType === "IT" ? "IT Number" : `${registrationType} Number`}
                  value={registrationNumber}
                  onChange={(e) => { setRegistrationNumber(e.target.value); setRegError(""); setRegNumberFieldError(""); }}
                  onBlur={() => setRegNumberFieldError(validateRegistrationNumber(registrationType, registrationNumber))}
                  className="h-10"
                />
                {regNumberFieldError && <p className="text-[13.5px] text-destructive">{regNumberFieldError}</p>}
                <Input
                  placeholder="TIN (10–15 digits)"
                  value={tin}
                  onChange={(e) => { setTin(e.target.value); setRegError(""); setTinFieldError(""); }}
                  onBlur={() => setTinFieldError(validateTin(tin))}
                  className="h-10"
                />
                {tinFieldError && <p className="text-[13.5px] text-destructive">{tinFieldError}</p>}
              </>
            )}

            {/* SCUML: mandatory for IT (NGOs are legally required to register as
                DNFIs). Conditional for RC/BN via a DNFBP-sector follow-up. */}
            {registrationType === "IT" && (
              <div className="space-y-2">
                <p className="text-[13.5px] text-black">
                  NGOs are required under Nigerian law to register with SCUML. This is mandatory.
                </p>
                <Input
                  placeholder="SCUML Number (e.g. SC123456789)"
                  value={scumlNumber}
                  onChange={(e) => { setScumlNumber(e.target.value); setRegError(""); setScumlFieldError(""); }}
                  onBlur={() => setScumlFieldError(validateScuml(scumlNumber))}
                  className="h-10"
                />
                {scumlFieldError && <p className="text-[13.5px] text-destructive">{scumlFieldError}</p>}
              </div>
            )}

            {(registrationType === "RC" || registrationType === "BN") && (
              <div className="space-y-2">
                <p className="text-[13.5px] text-black">
                  Does your organisation operate in a regulated sector (real estate, consulting, legal services, dealers in precious goods, etc.)?
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsDnfbpSector(true)}
                    className={`flex-1 text-[13.5px] px-3 py-2 rounded-lg border transition-colors ${
                      isDnfbpSector === true
                        ? "bg-[#2D6A4F] border-[#2D6A4F] text-white"
                        : "border-border text-black hover:border-[#2D6A4F]/40"
                    }`}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsDnfbpSector(false)}
                    className={`flex-1 text-[13.5px] px-3 py-2 rounded-lg border transition-colors ${
                      isDnfbpSector === false
                        ? "bg-[#2D6A4F] border-[#2D6A4F] text-white"
                        : "border-border text-black hover:border-[#2D6A4F]/40"
                    }`}
                  >
                    No
                  </button>
                </div>
                {isDnfbpSector === true && (
                  <>
                    <Input
                      placeholder="SCUML Number (e.g. SC123456789)"
                      value={scumlNumber}
                      onChange={(e) => { setScumlNumber(e.target.value); setRegError(""); setScumlFieldError(""); }}
                      onBlur={() => setScumlFieldError(validateScuml(scumlNumber))}
                      className="h-10"
                    />
                    {scumlFieldError && <p className="text-[13.5px] text-destructive">{scumlFieldError}</p>}
                  </>
                )}
              </div>
            )}

            {regError && <p className="text-xs text-destructive">{regError}</p>}
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 text-[13.5px] text-black">
            <div className="flex-1 border-t border-border" />
            Supporting document
            <div className="flex-1 border-t border-border" />
          </div>

          {/* File upload */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[15.5px] font-medium text-black">Upload files</p>
              <span className="text-[13.5px] text-black">Max 5 MB total</span>
            </div>
            <label className="flex items-center justify-center gap-2 cursor-pointer rounded-xl border border-dashed border-border px-4 py-4 text-[15.5px] text-black hover:border-[#2D6A4F]/40 hover:text-black transition-colors">
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
                  <div key={i} className="flex items-center justify-between text-[13.5px] border border-border rounded-lg px-3 py-2 bg-white">
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="font-medium text-black truncate">{f.name}</span>
                      <span className="text-black">{(f.size / 1024).toFixed(0)} KB</span>
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
            <p className="text-[15.5px] font-medium text-black">Paste a link</p>
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
              <p className="text-[15.5px] font-medium text-black">Added links</p>
              {docLinks.map((l, i) => {
                const parsed = JSON.parse(l);
                return (
                  <div key={i} className="flex items-center justify-between text-[13.5px] border border-border rounded-lg px-3 py-2 bg-white">
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="font-medium text-black truncate">{parsed.name}</span>
                      <span className="text-black truncate">{parsed.file_url}</span>
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
            disabled={!hasDocuments || !hasRegistrationInfo || submitting}
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

        <p className="text-center text-[13.5px] text-black">
          Accepted formats: PDF, DOC, DOCX, PNG, JPG. Max 5 MB total.
        </p>
      </div>
    </div>
  );
}
