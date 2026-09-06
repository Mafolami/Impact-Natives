import { useState } from "react";
import { SECTOR_OPTIONS as SECTORS } from "@/lib/sectors";
import { ORG_TYPE_OPTIONS } from "@/lib/orgTypes";
import { supabase } from "@/lib/supabase";
import { Link, useLocation } from "wouter";
import { getAuthLinkProps } from "@/lib/authLinks";
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
      description: form.description, status: "pending",
    });
    setLoading(false);
    if (error) alert(error.message);
    else setSubmitted(true);
  }

  async function goToSignUp() {
    await supabase.from("organizations").update({ verification_status: "pending" }).eq("email", form.email);
    setLocation("/signup");
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
      <p className="text-muted-foreground text-sm max-w-md">To complete verification, sign up for an account and upload your registration documents securely from your dashboard.</p>
      <div className="flex gap-3 flex-wrap justify-center">
        <Button type="button" onClick={goToSignUp}>Continue to sign up</Button>
        <Button type="button" variant="outline" onClick={onClose}>Skip for now</Button>
      </div>
    </div>
  );

  const successScreen = (
    <div className="flex flex-col items-center justify-center min-h-full gap-6 text-center px-4 py-10">
      <h2 className="text-3xl font-semibold">You're in the ecosystem.</h2>
      <p className="text-muted-foreground max-w-sm">Your profile has been submitted. The team will be in touch within 5 business days.</p>
      <div className="flex gap-3 flex-wrap justify-center">
        <a {...getAuthLinkProps("/signup")}><Button>Create account</Button></a>
        <a {...getAuthLinkProps("/login")}><Button variant="outline">Sign in</Button></a>
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