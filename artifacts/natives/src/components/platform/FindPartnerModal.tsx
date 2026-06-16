import { useState } from "react";
import { SECTOR_OPTIONS as SECTORS } from "@/lib/sectors";
import { ORG_TYPE_OPTIONS } from "@/lib/orgTypes";
import { supabase } from "@/lib/supabase";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldCheck } from "lucide-react";

const COUNTRIES = ["Nigeria", "Kenya", "Ghana", "South Africa", "Ethiopia", "Rwanda", "Senegal", "Other"];
const NEEDS_OPTIONS = ["Funding", "Partnership", "Data", "Visibility", "Technical Assistance", "Networks"];
const OFFERS_OPTIONS = ["Field access", "Data", "Networks", "Execution", "Funding", "Research"];
const SDG_LIST = Array.from({ length: 17 }, (_, i) => i + 1);

type EcoFormState = {
  organisation_name: string; email: string; website: string;
  country: string[]; sectors: string[]; sdgs: number[];
  organisation_type: string; needs: string[]; offers: string[];
  verification_consent: "yes" | "no" | ""; description: string;
  verification_documents: string[];
};

function getStepClass(stepIndex: number, current: number) {
  if (stepIndex === current) return "tf-active";
  if (stepIndex < current) return "tf-above";
  return "tf-below";
}

function CheckboxGroup({ options, selected, onToggle }: {
  options: string[]; selected: string[]; onToggle: (val: string) => void;
}) {
  return (
    <div className="flex flex-wrap justify-center gap-2 max-w-md">
      {options.map((opt) => {
        const checked = selected.includes(opt);
        return (
          <button key={opt} type="button" onClick={() => onToggle(opt)}
            className={`px-4 py-2 rounded-full border text-sm transition-all ${
              checked ? "bg-foreground text-background border-foreground"
                      : "bg-background text-foreground border-border hover:border-foreground/50"
            }`}
          >{opt}</button>
        );
      })}
    </div>
  );
}

export function FindPartnerModal({ onClose }: { onClose: () => void }) {
  const [, setLocation] = useLocation();
  const [form, setForm] = useState<EcoFormState>({
    organisation_name: "", email: "", website: "",
    country: [], sectors: [], sdgs: [], organisation_type: "",
    needs: [], offers: [], verification_consent: "", description: "",
    verification_documents: [],
  });
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [verificationDone, setVerificationDone] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [docName, setDocName] = useState("");
  const [docLink, setDocLink] = useState("");
  const [docLinks, setDocLinks] = useState<string[]>([]);
  const totalSteps = 11;

  function update(field: keyof EcoFormState, value: string) {
    setForm((p) => ({ ...p, [field]: value }));
  }
  function toggleList(field: "country" | "sectors" | "needs" | "offers", value: string) {
    setForm((p) => {
      const exists = p[field].includes(value);
      return { ...p, [field]: exists ? p[field].filter((v) => v !== value) : [...p[field], value] };
    });
  }
  function toggleSdg(n: number) {
    setForm((p) => ({ ...p, sdgs: p.sdgs.includes(n) ? p.sdgs.filter((s) => s !== n) : [...p.sdgs, n] }));
  }
  function nextStep() { if (step < totalSteps - 1) setStep((p) => p + 1); }
  function prevStep() { if (step > 0) setStep((p) => p - 1); }
  function validateEmail(email: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from("organizations").insert({
      organisation_name: form.organisation_name, email: form.email, website: form.website,
      country: form.country, sector: form.sectors, sdgs: form.sdgs,
      organisation_type: form.organisation_type, needs: form.needs, offers: form.offers,
      verification_consent: form.verification_consent,
      verification_status: form.verification_consent === "yes" ? "pending" : "not_requested",
      verification_documents: docLinks, description: form.description, status: "pending",
    });
    setLoading(false);
    if (error) alert(error.message);
    else setSubmitted(true);
  }

  async function submitVerificationDocs() {
    if (docLinks.length === 0 && uploadedFiles.length === 0) return;
    const rows: any[] = [];
    for (const f of uploadedFiles) {
      const safeName = f.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = `${form.email}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from("verification-docs").upload(filePath, f);
      if (uploadError) return alert(uploadError.message);
      const { data } = supabase.storage.from("verification-docs").getPublicUrl(filePath);
      rows.push({ organization_id: null, name: f.name, document_url: data.publicUrl, file_path: filePath, document_type: f.type, source_type: "upload" });
    }
    for (const l of docLinks) {
      const parsed = JSON.parse(l);
      rows.push({ organization_id: null, name: parsed.name, document_url: parsed.file_url, file_path: null, document_type: "url", source_type: "link" });
    }
    if (rows.length > 0) await supabase.from("verification_documents").insert(rows);
    await supabase.from("organizations").update({ verification_status: "in_review" }).eq("email", form.email);
    setVerificationDone(true);
  }

  const steps = [
    { key: 0, content: (<><p className="text-sm text-muted-foreground">1 of {totalSteps}</p><h2 className="text-3xl font-semibold text-center">What's your organisation name?</h2><Input className="max-w-md w-full" placeholder="Impact Natives" value={form.organisation_name} onChange={(e) => update("organisation_name", e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); nextStep(); } }} autoFocus={step === 0} /><Button type="button" onClick={nextStep} disabled={!form.organisation_name.trim()}>Next →</Button></>) },
    { key: 1, content: (<><p className="text-sm text-muted-foreground">2 of {totalSteps}</p><h2 className="text-3xl font-semibold text-center">Your email address?</h2><Input className="max-w-md w-full" type="email" placeholder="hello@organisation.org" value={form.email} onChange={(e) => update("email", e.target.value)} autoFocus={step === 1} />{emailError && <p className="text-red-500 text-sm">{emailError}</p>}<Button type="button" onClick={() => { if (!validateEmail(form.email)) { setEmailError("Please enter a valid email address"); return; } setEmailError(""); nextStep(); }} disabled={!form.email.trim()}>Next →</Button></>) },
    { key: 2, content: (<><p className="text-sm text-muted-foreground">3 of {totalSteps}</p><h2 className="text-3xl font-semibold text-center">Website <span className="text-muted-foreground text-xl font-normal">(optional)</span></h2><Input className="max-w-md w-full" placeholder="https://yoursite.org" value={form.website} onChange={(e) => update("website", e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); nextStep(); } }} autoFocus={step === 2} /><Button type="button" onClick={nextStep}>Next →</Button></>) },
    { key: 3, content: (<><p className="text-sm text-muted-foreground">4 of {totalSteps}</p><h2 className="text-3xl font-semibold text-center">Where do you operate?</h2><p className="text-sm text-muted-foreground">Select all that apply</p><CheckboxGroup options={COUNTRIES} selected={form.country} onToggle={(v) => toggleList("country", v)} /><Button type="button" onClick={nextStep} disabled={form.country.length === 0}>Next →</Button></>) },
    { key: 4, content: (<><p className="text-sm text-muted-foreground">5 of {totalSteps}</p><h2 className="text-3xl font-semibold text-center">Which sectors?</h2><p className="text-sm text-muted-foreground">Select all that apply</p><CheckboxGroup options={SECTORS} selected={form.sectors} onToggle={(v) => toggleList("sectors", v)} /><Button type="button" onClick={nextStep} disabled={form.sectors.length === 0}>Next →</Button></>) },
    { key: 5, content: (<><p className="text-sm text-muted-foreground">6 of {totalSteps}</p><h2 className="text-3xl font-semibold text-center">Which SDGs does your work address?</h2><p className="text-sm text-muted-foreground">Select all that apply</p><div className="flex flex-wrap justify-center gap-2 max-w-lg">{SDG_LIST.map((n) => { const checked = form.sdgs.includes(n); return (<button key={n} type="button" onClick={() => toggleSdg(n)} className={`px-3 py-1.5 rounded-full border text-sm transition-all ${checked ? "bg-foreground text-background border-foreground" : "bg-background text-foreground border-border hover:border-foreground/50"}`}>SDG {n}</button>); })}</div><Button type="button" onClick={nextStep} disabled={form.sdgs.length === 0}>Next →</Button></>) },
    { key: 6, content: (<><p className="text-sm text-muted-foreground">7 of {totalSteps}</p><h2 className="text-3xl font-semibold text-center">Organisation type?</h2><div className="w-full max-w-md"><Select onValueChange={(val) => update("organisation_type", val)} value={form.organisation_type}><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger><SelectContent>{ORG_TYPE_OPTIONS.map((t) => (<SelectItem key={t} value={t.toLowerCase().replace(/[\s/]+/g, "_")}>{t}</SelectItem>))}</SelectContent></Select></div><Button type="button" onClick={nextStep} disabled={!form.organisation_type}>Next →</Button></>) },
    { key: 7, content: (<><p className="text-sm text-muted-foreground">8 of {totalSteps}</p><h2 className="text-3xl font-semibold text-center">What do you need?</h2><p className="text-sm text-muted-foreground">Select all that apply</p><CheckboxGroup options={NEEDS_OPTIONS} selected={form.needs} onToggle={(v) => toggleList("needs", v)} /><Button type="button" onClick={nextStep} disabled={form.needs.length === 0}>Next →</Button></>) },
    { key: 8, content: (<><p className="text-sm text-muted-foreground">9 of {totalSteps}</p><h2 className="text-3xl font-semibold text-center">What can you offer?</h2><p className="text-sm text-muted-foreground">Select all that apply</p><CheckboxGroup options={OFFERS_OPTIONS} selected={form.offers} onToggle={(v) => toggleList("offers", v)} /><Button type="button" onClick={nextStep} disabled={form.offers.length === 0}>Next →</Button></>) },
    { key: 9, content: (<><p className="text-sm text-muted-foreground">10 of {totalSteps}</p><div className="max-w-lg text-center space-y-3"><ShieldCheck className="w-10 h-10 mx-auto text-[#2D6A4F]" /><h2 className="text-3xl font-semibold">Would you like to be reviewed for verification?</h2><p className="text-sm text-muted-foreground leading-relaxed">Verified organisations receive a trust badge, access to gated features, and improved visibility in ecosystem matching.</p></div><div className="flex gap-4 justify-center"><Button type="button" onClick={() => setForm((p) => ({ ...p, verification_consent: "yes" }))} variant={form.verification_consent === "yes" ? "default" : "outline"}>Yes, apply for verification</Button><Button type="button" onClick={() => setForm((p) => ({ ...p, verification_consent: "no" }))} variant={form.verification_consent === "no" ? "default" : "outline"}>Not right now</Button></div><Button type="button" onClick={nextStep} disabled={!form.verification_consent}>Next →</Button></>) },
    { key: 10, content: (<><p className="text-sm text-muted-foreground">11 of {totalSteps}</p><h2 className="text-3xl font-semibold text-center">Tell us about your organisation</h2><p className="text-sm text-muted-foreground max-w-md text-center">A short description of what you do and why you want to find a partner</p><Textarea className="max-w-md w-full min-h-[120px]" placeholder="We are..." value={form.description} onChange={(e) => update("description", e.target.value)} autoFocus={step === 10} /><Button type="submit" disabled={loading || !form.description.trim()}>{loading ? "Submitting..." : "Submit"}</Button></>) },
  ];

  const verificationScreen = (
    <div className="flex flex-col items-center gap-6 text-center px-4 max-w-lg mx-auto py-10 overflow-y-auto w-full">
      <ShieldCheck className="w-12 h-12 text-[#2D6A4F]" />
      <h2 className="text-2xl font-semibold">Your submission has been received.</h2>
      <p className="text-muted-foreground text-sm max-w-md">Upload documents or paste links to your registration materials.</p>
      <div className="w-full space-y-6 text-left">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Upload files</label>
            <span className="text-xs text-muted-foreground">Max 5 MB total</span>
          </div>
          <label className="flex items-center gap-3 cursor-pointer rounded-md border border-dashed border-border px-4 py-3 text-sm text-muted-foreground hover:border-foreground/40 transition-colors">
            <span>+ Add file</span>
            <input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" className="sr-only" multiple
              onChange={(e) => {
                const selected = Array.from(e.target.files || []);
                const existingSize = uploadedFiles.reduce((sum, f) => sum + f.size, 0);
                const newSize = selected.reduce((sum, f) => sum + f.size, 0);
                if (existingSize + newSize > 5 * 1024 * 1024) { alert("Total file size would exceed 5 MB."); return; }
                setUploadedFiles((prev) => [...prev, ...selected]);
                e.target.value = "";
              }} />
          </label>
          {uploadedFiles.length > 0 && (
            <div className="space-y-1.5">
              {uploadedFiles.map((f, i) => (
                <div key={i} className="flex items-center justify-between text-xs border border-border rounded-md px-3 py-2 bg-muted/30">
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="font-medium text-foreground truncate">{f.name}</span>
                    <span className="text-muted-foreground">{(f.size / 1024).toFixed(0)} KB</span>
                  </div>
                  <button type="button" onClick={() => setUploadedFiles((prev) => prev.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-foreground ml-3 shrink-0">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <div className="flex-1 border-t border-border" />OR<div className="flex-1 border-t border-border" />
        </div>
        <div className="space-y-3">
          <label className="text-sm font-medium">Paste a link</label>
          <Input placeholder="https://docs.example.com/registration" value={docLink} onChange={(e) => setDocLink(e.target.value)} />
          <Input placeholder="Document name (e.g. CAC Registration Certificate)" value={docName} onChange={(e) => setDocName(e.target.value)} />
          <Button type="button" variant="outline" size="sm" onClick={() => {
            if (!docLink.trim() || !docName.trim()) return;
            try { new URL(docLink.trim()); } catch { alert("Please enter a valid URL including https://"); return; }
            setDocLinks((prev) => [...prev, JSON.stringify({ name: docName, source_type: "link", file_url: docLink.trim(), file_type: "url" })]);
            setDocLink(""); setDocName("");
          }}>Add link →</Button>
        </div>
        {docLinks.length > 0 && (
          <div className="space-y-2 border-t border-border pt-4">
            <p className="text-sm font-medium">Added</p>
            {docLinks.map((l, i) => {
              const parsed = JSON.parse(l);
              return (
                <div key={i} className="flex items-center justify-between text-xs border border-border rounded-md px-3 py-2 bg-muted/30">
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="font-medium text-foreground truncate">{parsed.name}</span>
                    <span className="text-muted-foreground truncate">{parsed.source_type === "upload" ? "Uploaded file" : parsed.file_url}</span>
                  </div>
                  <button type="button" onClick={() => setDocLinks((prev) => prev.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-foreground ml-3 shrink-0">✕</button>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div className="flex gap-3 flex-wrap justify-center">
        <Button type="button" onClick={submitVerificationDocs} disabled={docLinks.length === 0 && uploadedFiles.length === 0}>Submit for review</Button>
        <Button type="button" variant="outline" onClick={onClose}>Skip for now</Button>
      </div>
    </div>
  );

  const successScreen = (
    <div className="flex flex-col items-center justify-center min-h-full gap-6 text-center px-4 py-10">
      <h2 className="text-3xl font-semibold">You're in the ecosystem.</h2>
      <p className="text-muted-foreground max-w-sm">Your profile has been submitted. The team will be in touch within 5 business days.</p>
      <div className="flex gap-3 flex-wrap justify-center">
        <Link href="/signup"><Button>Create account</Button></Link>
        <Link href="/login"><Button variant="outline">Sign in</Button></Link>
        <Button variant="outline" onClick={onClose}>Close</Button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col"
      style={{ animation: "slideUp 0.35s cubic-bezier(0.4,0,0.2,1) forwards" }}>
      <style>{`
        @keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .tf-step { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1.5rem; padding: 2rem; transition: transform 0.45s cubic-bezier(0.4,0,0.2,1), opacity 0.45s; }
        .tf-active { transform: translateY(0); opacity: 1; }
        .tf-above  { transform: translateY(-100%); opacity: 0; pointer-events: none; }
        .tf-below  { transform: translateY(100%);  opacity: 0; pointer-events: none; }
      `}</style>
      <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
        <span className="text-sm font-medium">Find a Partner</span>
        <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors text-sm">✕ Close</button>
      </div>
      <div className="h-0.5 bg-muted shrink-0">
        <div className="h-full bg-foreground transition-all duration-300" style={{ width: `${((step + 1) / totalSteps) * 100}%` }} />
      </div>
      {submitted ? (
        <div className="flex-1 overflow-y-auto">
          {form.verification_consent === "yes" && !verificationDone ? verificationScreen : successScreen}
        </div>
      ) : (
        <form onSubmit={submit} className="relative flex-1 overflow-hidden" onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}>
          {steps.map(({ key, content }) => (
            <div key={key} className={`tf-step ${getStepClass(key, step)}`}>{content}</div>
          ))}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4">
            {step > 0 && <button type="button" onClick={prevStep} className="text-sm text-muted-foreground hover:text-foreground transition-colors">↑ Back</button>}
            <span className="text-xs text-muted-foreground">{step + 1} / {totalSteps}</span>
          </div>
        </form>
      )}
    </div>
  );
}