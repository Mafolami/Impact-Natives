import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { COUNTRIES } from "@/lib/countries";
import { SECTOR_OPTIONS } from "@/lib/sectors";
import { ORG_TYPE_FILTERS as ORG_TYPE_OPTIONS } from "@/lib/orgTypes";
import {
  Loader2, ArrowRight, ArrowLeft, SkipForward, ShieldCheck,
  Users, User, Upload, CheckCircle2, X, PenLine,
} from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────

const SDG_OPTIONS = [
  "No Poverty", "Zero Hunger", "Good Health and Well-being", "Quality Education",
  "Gender Equality", "Clean Water and Sanitation", "Affordable and Clean Energy",
  "Decent Work and Economic Growth", "Industry Innovation and Infrastructure",
  "Reduced Inequalities", "Sustainable Cities and Communities",
  "Responsible Consumption and Production", "Climate Action", "Life Below Water",
  "Life on Land", "Peace Justice and Strong Institutions", "Partnerships for the Goals",
];

const STAGE_OPTIONS = [
  { value: "concept",  label: "Concept",  sub: "Idea defined, no funding yet" },
  { value: "planning", label: "Planning", sub: "Funded, building implementation plan" },
  { value: "active",   label: "Active",   sub: "Currently executing" },
  { value: "scaling",  label: "Scaling",  sub: "Running successfully, seeking to expand" },
];

const TEAM_SIZE_OPTIONS = [
  { value: "solo", label: "Solo founder" },
  { value: "2-5",  label: "2–5 people" },
  { value: "6-20", label: "6–20 people" },
  { value: "20+",  label: "20+ people" },
];

const INVESTMENT_STAGE_OPTIONS = [
  "Pre-Seed", "Seed", "Bridge", "Series A", "Series B", "Beyond Series B",
];

const BUSINESS_MODEL_OPTIONS = [
  { value: "Grant-funded",      label: "Grant-funded" },
  { value: "Revenue-generating", label: "Revenue-generating" },
  { value: "Hybrid",            label: "Hybrid (grants + revenue)" },
  { value: "Pre-revenue",       label: "Pre-revenue" },
];

const RUNWAY_OPTIONS = [
  { value: "Less than 6 months", label: "Less than 6 months" },
  { value: "6-12 months",        label: "6–12 months" },
  { value: "12-24 months",       label: "12–24 months" },
  { value: "24+ months",         label: "24+ months" },
  { value: "Not applicable",     label: "Not applicable" },
];

const FUNDING_INSTRUMENTS = [
  "Grant", "Concessional loan", "Equity investment",
  "Recoverable grant", "Prize", "Technical assistance",
];

const ESG_FRAMEWORKS = ["GRI", "SASB", "UN Global Compact", "B Corp", "TCFD", "SDG Reporting"];

const RESEARCH_METHODS = [
  "RCT", "Mixed methods", "Participatory research",
  "Systematic review", "Case study", "Survey-based", "Ethnographic",
];

// ── Types ─────────────────────────────────────────────────────────────────────

type UserType = "individual_creative" | "organisation";
type OrgTrack = "implementer" | "funder" | "corporate" | "research";

interface ExtractedProfile {
  organisation_name?: string | null;
  description?: string | null;
  country?: string | null;
  sectors?: string[] | null;
  organisation_type?: string | null;
  needs?: string[] | null;
  offers?: string[] | null;
  sdg_tags?: string[] | null;
  stage?: string | null;
  team_size?: string | null;
  year_founded?: number | null;
  role_title?: string | null;
  investment_stage?: string | null;
  business_model?: string | null;
  runway?: string | null;
  funding_ask?: string | null;
  grant_range_min?: number | null;
  grant_range_max?: number | null;
  grant_currency?: string | null;
  funding_instruments?: string[] | null;
  geographic_focus?: string[] | null;
  csr_budget_range?: string | null;
  esg_frameworks?: string[] | null;
  research_methods?: string[] | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function trackFromOrgType(orgType: string): OrgTrack {
  if (["philanthropic_foundation", "venture_capital"].includes(orgType)) return "funder";
  if (["corporation", "technology_company", "creative_agency_studio"].includes(orgType)) return "corporate";
  if (["research_academic", "public_sector"].includes(orgType)) return "research";
  return "implementer";
}

function wordCount(text: string): number {
  return text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CountryPicker({ value, onChange, error }: {
  value: string; onChange: (v: string) => void; error?: string;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const filtered = search.trim()
    ? COUNTRIES.filter(c => c.toLowerCase().includes(search.toLowerCase()))
    : COUNTRIES;
  return (
    <div className="relative mt-1">
      <Input
        value={open ? search : value}
        onChange={e => { setSearch(e.target.value); setOpen(true); }}
        onFocus={() => { setSearch(""); setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className={`h-11 ${error ? "border-destructive" : ""}`}
        placeholder="Search country..."
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto rounded-lg border border-border bg-background shadow-md">
          {filtered.map(c => (
            <button key={c} type="button"
              onMouseDown={() => { onChange(c); setSearch(""); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors ${
                value === c ? "bg-[#2D6A4F]/10 text-[#2D6A4F] font-medium" : "text-foreground"
              }`}>
              {c}
            </button>
          ))}
        </div>
      )}
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}

function ChipToggle({ label, selected, onToggle }: {
  label: string; selected: boolean; onToggle: () => void;
}) {
  return (
    <button type="button" onClick={onToggle}
      className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
        selected
          ? "bg-[#2D6A4F] border-[#2D6A4F] text-white"
          : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
      }`}>
      {label}
    </button>
  );
}

function ProgressDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex gap-2 mb-8 justify-center">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={`h-1.5 rounded-full transition-all ${
          i === current ? "w-6 bg-[#2D6A4F]" : i < current ? "w-3 bg-[#2D6A4F]/40" : "w-3 bg-muted"
        }`} />
      ))}
    </div>
  );
}

function StepLabel({ step, total, label, optional }: {
  step: number; total: number; label: string; optional?: boolean;
}) {
  return (
    <div className="mb-6">
      <span className="text-xs font-medium text-[#2D6A4F] uppercase tracking-wide">
        Step {step} of {total}
      </span>
      <h2 className="text-xl font-semibold text-foreground mt-1">{label}</h2>
      {optional && (
        <p className="text-sm text-muted-foreground mt-0.5">
          Optional — skip if you prefer not to share this now.
        </p>
      )}
    </div>
  );
}

// ── Document Upload Step ──────────────────────────────────────────────────────

function DocumentUploadStep({ track, onExtracted, onSkipToManual }: {
  track: OrgTrack;
  onExtracted: (data: ExtractedProfile) => void;
  onSkipToManual: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const TRACK_LABELS: Record<OrgTrack, string> = {
    implementer: "pitch deck, concept note, annual report, or organisational profile",
    funder:      "funding guidelines, call for proposals, or investment thesis",
    corporate:   "sustainability report, CSR report, or partnership brief",
    research:    "research profile, capability statement, or institutional brief",
  };

  async function handleFile(file: File) {
    setError(null);
    setFileName(file.name);
    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (!allowedTypes.includes(file.type)) {
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
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-org-profile`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ file_base64: base64, file_type: file.type, track }),
        }
      );
      const result = await res.json();
      if (!res.ok || result.error) {
        setError(result.error ?? "Extraction failed. Try again or fill in manually.");
        setUploading(false);
        return;
      }
      onExtracted(result.data);
    } catch {
      setError("Something went wrong. Try again or fill in manually.");
    }
    setUploading(false);
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground leading-relaxed">
        Upload your{" "}
        <span className="text-foreground font-medium">{TRACK_LABELS[track]}</span>{" "}
        and we'll extract your details automatically. You'll review everything before continuing.
      </p>

      <div
        className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-colors cursor-pointer ${
          uploading
            ? "border-[#2D6A4F]/40 bg-[#2D6A4F]/3"
            : "border-border hover:border-[#2D6A4F]/40 hover:bg-muted/30"
        }`}
        onClick={() => !uploading && fileRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
      >
        <input ref={fileRef} type="file"
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
              className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2">
              Remove
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <Upload className="w-8 h-8 text-muted-foreground/40" />
            <div>
              <p className="text-sm font-medium text-foreground">Drop your file here or click to browse</p>
              <p className="text-xs text-muted-foreground mt-1">For best results, upload a DOCX file. PDF support is limited. · Up to 10MB</p>
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

      <div className="pt-2 border-t border-border">
        <button type="button" onClick={onSkipToManual}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <PenLine className="w-3.5 h-3.5" />
          Fill in manually instead
        </button>
      </div>
    </div>
  );
}

// ── AI Confirm Step ───────────────────────────────────────────────────────────

function ConfirmExtractedStep({
  orgName, setOrgName,
  description, setDescription,
  country, setCountry,
  roleTitle, setRoleTitle,
  orgType, setOrgType,
  errors,
}: {
  orgName: string; setOrgName: (v: string) => void;
  description: string; setDescription: (v: string) => void;
  country: string; setCountry: (v: string) => void;
  roleTitle: string; setRoleTitle: (v: string) => void;
  orgType: string; setOrgType: (v: string) => void;
  errors: Record<string, string>;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-2 rounded-lg border border-[#2D6A4F]/20 bg-[#2D6A4F]/5 px-4 py-3">
        <CheckCircle2 className="w-4 h-4 text-[#2D6A4F] shrink-0 mt-0.5" />
        <p className="text-xs text-[#2D6A4F] leading-relaxed">
          We extracted these details from your document. Review and correct anything that needs updating.
        </p>
      </div>
      <div className="space-y-4">
        <div>
          <Label className="text-sm font-medium">Organisation name</Label>
          <Input value={orgName} onChange={e => setOrgName(e.target.value)}
            className={`mt-1 h-11 ${errors.orgName ? "border-destructive" : ""}`}
            placeholder="Organisation name" />
          {errors.orgName && <p className="text-xs text-destructive mt-1">{errors.orgName}</p>}
        </div>
        <div>
          <Label className="text-sm font-medium">Your role / title</Label>
          <Input value={roleTitle} onChange={e => setRoleTitle(e.target.value)}
            className="mt-1 h-11" placeholder="e.g. Executive Director, Founder" />
        </div>
        <div>
          <Label className="text-sm font-medium">Country</Label>
          <CountryPicker value={country} onChange={setCountry} error={errors.country} />
        </div>
        <div>
          <Label className="text-sm font-medium">Organisation type</Label>
          <select value={orgType} onChange={e => setOrgType(e.target.value)}
            className="mt-1 w-full h-11 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
            <option value="">Select type...</option>
            {ORG_TYPE_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <Label className="text-sm font-medium">Description</Label>
          <Textarea value={description} onChange={e => setDescription(e.target.value)}
            className="mt-1 resize-none" rows={4}
            placeholder="What does your organisation do, where, and who does it serve?" />
          <div className="flex justify-end mt-1">
            <p className={`text-xs ${wordCount(description) > 60 ? "text-red-500 font-semibold" : "text-muted-foreground"}`}>
              {wordCount(description)}/60 words
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function Onboarding() {
  const [, navigate] = useLocation();
  const { user, refreshProfile } = useAuth();

  const [userType, setUserType] = useState<UserType | null>(null);
  const [step, setStep] = useState(-1);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [manualMode, setManualMode] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedProfile | null>(null);
  const [extractionDone, setExtractionDone] = useState(false);

  // Shared fields
  const [fullName, setFullName] = useState("");
  const [country, setCountry] = useState("");
  const [bio, setBio] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [phone, setPhone] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [website, setWebsite] = useState("");
  const [socialLinks, setSocialLinks] = useState<{ label: string; url: string }[]>([]);
  const [socialLabel, setSocialLabel] = useState("");
  const [socialUrl, setSocialUrl] = useState("");
  const [sectors, setSectors] = useState<string[]>([]);
  const [sdgTags, setSdgTags] = useState<string[]>([]);
  const [wantsVerify, setWantsVerify] = useState(false);

  // Org fields
  const [orgName, setOrgName] = useState("");
  const [orgType, setOrgType] = useState("");
  const [description, setDescription] = useState("");
  const [needs, setNeeds] = useState<string[]>([]);
  const [offers, setOffers] = useState<string[]>([]);
  const [needsInput, setNeedsInput] = useState("");
  const [offersInput, setOffersInput] = useState("");

  // Implementer fields
  const [stage, setStage] = useState("");
  const [teamSize, setTeamSize] = useState("");
  const [yearFounded, setYearFounded] = useState("");

  // Startup-specific fields
  const [investmentStage, setInvestmentStage] = useState("");
  const [businessModel, setBusinessModel] = useState("");
  const [runway, setRunway] = useState("");
  const [fundingAsk, setFundingAsk] = useState("");

  // Funder fields
  const [grantRangeMin, setGrantRangeMin] = useState("");
  const [grantRangeMax, setGrantRangeMax] = useState("");
  const [grantCurrency, setGrantCurrency] = useState("USD");
  const [fundingInstruments, setFundingInstruments] = useState<string[]>([]);
  const [geographicFocus, setGeographicFocus] = useState<string[]>([]);
  const [geographicInput, setGeographicInput] = useState("");

  // Corporate fields
  const [csrBudgetRange, setCsrBudgetRange] = useState("");
  const [esgFrameworks, setEsgFrameworks] = useState<string[]>([]);
  const [stagePreference, setStagePreference] = useState<string[]>([]);
  const [partnerTypePreference, setPartnerTypePreference] = useState<string[]>([]);

  // Research fields
  const [researchMethods, setResearchMethods] = useState<string[]>([]);

  const orgTrack: OrgTrack = orgType ? trackFromOrgType(orgType) : "implementer";
  const isStartup = orgType === "startup";

  // ── Step definitions ─────────────────────────────────────────────────────

  const INDIVIDUAL_STEPS = [
    { id: "name",     label: "Your name",          skippable: false },
    { id: "location", label: "Where you're based", skippable: false },
    { id: "bio",      label: "About you",          skippable: true  },
    { id: "focus",    label: "Your focus areas",   skippable: true  },
    { id: "links",    label: "Online presence",    skippable: true  },
  ];

  const ORG_STEPS_UPLOAD = [
    { id: "name",       label: "Your name",            skippable: false },
    { id: "upload",     label: "Quick start",          skippable: false },
    { id: "confirm",    label: "Confirm your details", skippable: false },
    { id: "focus",      label: "Focus areas",          skippable: true  },
    { id: "needs",      label: "Needs & offers",       skippable: true  },
    { id: "trackExtra", label: "Additional details",   skippable: true  },
    { id: "links",      label: "Online presence",      skippable: true  },
    { id: "verify",     label: "Get verified",         skippable: true  },
  ];

  const ORG_STEPS_MANUAL = [
    { id: "name",        label: "Your name",             skippable: false },
    { id: "location",    label: "Where you're based",    skippable: false },
    { id: "org",         label: "Your organisation",     skippable: false },
    { id: "description", label: "Organisation profile",  skippable: false },
    { id: "focus",       label: "Focus areas",           skippable: true  },
    { id: "needs",       label: "Needs & offers",        skippable: true  },
    { id: "trackExtra",  label: "Additional details",    skippable: true  },
    { id: "links",       label: "Online presence",       skippable: true  },
    { id: "verify",      label: "Get verified",          skippable: true  },
  ];

  const steps = userType === "individual_creative"
    ? INDIVIDUAL_STEPS
    : manualMode ? ORG_STEPS_MANUAL : ORG_STEPS_UPLOAD;

  const currentStep = steps[step];
  const isLast = step === steps.length - 1;
  const totalSteps = steps.length;

  // ── Helpers ──────────────────────────────────────────────────────────────

  function toggleArr(arr: string[], val: string, set: (v: string[]) => void) {
    set(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);
  }

  function getRedirectPath() {
    const stored = sessionStorage.getItem("redirectAfterAuth");
    if (stored) { sessionStorage.removeItem("redirectAfterAuth"); return stored; }
    return "/dashboard";
  }

  function applyExtracted(data: ExtractedProfile) {
    setExtracted(data);
    setExtractionDone(true);
    if (data.organisation_name) setOrgName(data.organisation_name);
    if (data.description)       setDescription(data.description);
    if (data.country)           setCountry(data.country);
    if (data.role_title)        setRoleTitle(data.role_title);
    if (data.organisation_type) setOrgType(data.organisation_type);
    if (data.sectors?.length)   setSectors(data.sectors);
    if (data.sdg_tags?.length)  setSdgTags(data.sdg_tags);
    if (data.needs?.length)     setNeeds(data.needs);
    if (data.offers?.length)    setOffers(data.offers);
    if (data.stage)             setStage(data.stage);
    if (data.team_size)         setTeamSize(data.team_size);
    if (data.year_founded)      setYearFounded(String(data.year_founded));
    if (data.investment_stage)  setInvestmentStage(data.investment_stage);
    if (data.business_model)    setBusinessModel(data.business_model);
    if (data.runway)            setRunway(data.runway);
    if (data.funding_ask)       setFundingAsk(data.funding_ask);
    if (data.grant_range_min)   setGrantRangeMin(String(data.grant_range_min));
    if (data.grant_range_max)   setGrantRangeMax(String(data.grant_range_max));
    if (data.grant_currency)    setGrantCurrency(data.grant_currency);
    if (data.funding_instruments?.length) setFundingInstruments(data.funding_instruments);
    if (data.geographic_focus?.length)    setGeographicFocus(data.geographic_focus);
    if (data.csr_budget_range)  setCsrBudgetRange(data.csr_budget_range);
    if (data.esg_frameworks?.length)      setEsgFrameworks(data.esg_frameworks);
    if (data.research_methods?.length)    setResearchMethods(data.research_methods);
  }

  // ── Validation ───────────────────────────────────────────────────────────

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!currentStep) return true;
    if (currentStep.id === "name"     && !fullName.trim()) errs.fullName    = "Please enter your full name.";
    if (currentStep.id === "location" && !country.trim())  errs.country     = "Please select your country.";
    if (currentStep.id === "org") {
      if (!orgName.trim())   errs.orgName   = "Organisation name is required.";
      if (!roleTitle.trim()) errs.roleTitle = "Role or title is required.";
    }
    if (currentStep.id === "confirm") {
      if (!orgName.trim())  errs.orgName  = "Please confirm your organisation name.";
      if (!country.trim())  errs.country  = "Please confirm your country.";
    }
    if (currentStep.id === "description" && !description.trim()) {
      errs.description = "Please add a description.";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function mandatoryFieldsSatisfied(): boolean {
    if (!fullName.trim()) return false;
    if (userType === "organisation" && (!orgName.trim() || !country.trim())) return false;
    if (userType === "individual_creative" && !country.trim()) return false;
    return true;
  }

  // ── Finish ───────────────────────────────────────────────────────────────

  async function finish(requestVerify?: boolean) {
    if (!mandatoryFieldsSatisfied()) return;
    setSaving(true);

    let userId = user?.id;
    let userEmail = user?.email;
    if (!userId) {
      const { data: sessionData } = await supabase.auth.getSession();
      userId = sessionData?.session?.user?.id;
      userEmail = sessionData?.session?.user?.email;
    }
    if (!userId) { setSaving(false); return; }

    await supabase.from("profiles").update({
      user_type:              userType,
      full_name:              fullName    || null,
      country:                country     || null,
      bio:                    bio         || null,
      org_name:               orgName     || null,
      role_title:             roleTitle   || null,
      phone:                  phone       || null,
      linkedin_url:           linkedinUrl || null,
      website:                website     || null,
      social_links:           socialLinks.length > 0 ? socialLinks : null,
      sectors:                sectors.length > 0 ? sectors : null,
      org_type:               orgType     || null,
      feed_visibility:        "public",
      verification_requested: requestVerify ?? false,
      onboarding_completed:   true,
      updated_at:             new Date().toISOString(),
    }).eq("id", userId);

    if (userType === "organisation" && orgName.trim()) {
      await supabase.from("organizations").insert({
        user_id:           userId,
        organisation_name: orgName.trim(),
        email:             userEmail ?? null,
        website:           website      || null,
        country:           country      || null,
        sector:            sectors.length > 0 ? JSON.stringify(sectors) : null,
        organisation_type: orgType      || null,
        description:       description  || null,
        needs:             needs.length > 0 ? needs : null,
        offers:            offers.length > 0 ? offers : null,
        sdgs:              sdgTags.length > 0 ? sdgTags : null,
        year_founded:      yearFounded ? parseInt(yearFounded) : null,
        investment_stage:  investmentStage || null,
        business_model:    businessModel   || null,
        runway:            runway           || null,
        funding_ask:       fundingAsk       || null,
        grant_range_min:   grantRangeMin ? parseFloat(grantRangeMin) : null,
        grant_range_max:   grantRangeMax ? parseFloat(grantRangeMax) : null,
        grant_currency:    grantCurrency || null,
        funding_instruments: fundingInstruments.length > 0 ? fundingInstruments : null,
        geographic_focus:  geographicFocus.length > 0 ? geographicFocus : null,
        csr_budget_range:  csrBudgetRange || null,
        esg_frameworks:    esgFrameworks.length > 0 ? esgFrameworks : null,
        mandate_sectors:   sectors.length > 0 ? sectors : null,
        mandate_sdgs:      sdgTags.length > 0 ? sdgTags : null,
        stage_preference:  stagePreference.length > 0 ? stagePreference : null,
        partner_type_preference: partnerTypePreference.length > 0 ? partnerTypePreference : null,
        status:            "pending",
        verification_status: requestVerify ? "pending" : "not_requested",
        created_at:        new Date().toISOString(),
        updated_at:        new Date().toISOString(),
      });
    }

    await refreshProfile();
    setSaving(false);
    navigate(requestVerify ? "/verify" : getRedirectPath());
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  function handleNext() {
    if (!validate()) return;
    if (isLast) {
      finish(currentStep.id === "verify" ? wantsVerify : false);
      return;
    }
    setErrors({});
    setStep(s => s + 1);
  }

  function handleSkip() {
    if (!currentStep?.skippable) return;
    if (isLast) { finish(false); return; }
    setErrors({});
    setStep(s => s + 1);
  }

  function handleBack() {
    if (step > 0) { setErrors({}); setStep(s => s - 1); }
  }

  function selectUserType(type: UserType) {
    setUserType(type);
    setStep(0);
  }

  // ── User type screen ──────────────────────────────────────────────────────

  if (step === -1) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="bg-card rounded-2xl border border-border shadow-sm p-8">
            <div className="mb-8">
              <span className="text-xs font-medium text-[#2D6A4F] uppercase tracking-wide">Welcome</span>
              <h2 className="text-xl font-semibold text-foreground mt-1">How are you joining?</h2>
              <p className="text-sm text-muted-foreground mt-1">This helps us tailor your experience.</p>
            </div>
            <div className="space-y-3">
              {[
                {
                  type: "individual_creative" as UserType,
                  icon: <User className="w-5 h-5 text-[#2D6A4F]" />,
                  label: "Individual / Creative",
                  sub: "Joining as a practitioner, consultant, or freelancer.",
                },
                {
                  type: "organisation" as UserType,
                  icon: <Users className="w-5 h-5 text-[#2D6A4F]" />,
                  label: "Organisation",
                  sub: "Representing an NGO, funder, company, or institution.",
                },
              ].map(opt => (
                <button key={opt.type} type="button" onClick={() => selectUserType(opt.type)}
                  className="w-full flex items-start gap-4 p-4 rounded-xl border border-border hover:border-[#2D6A4F]/50 hover:bg-[#2D6A4F]/5 transition-all text-left group">
                  <div className="mt-0.5 p-2 rounded-lg bg-muted group-hover:bg-[#2D6A4F]/10 transition-colors">
                    {opt.icon}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{opt.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{opt.sub}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
          <p className="text-center text-xs text-muted-foreground mt-4">
            You can update all of this later from your profile settings.
          </p>
        </div>
      </div>
    );
  }

  // ── Main step flow ────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        <ProgressDots total={totalSteps} current={step} />

        <div className="bg-card rounded-2xl border border-border shadow-sm p-8 overflow-y-auto max-h-[72vh]">
          <StepLabel
            step={step + 1}
            total={totalSteps}
            label={currentStep.label}
            optional={currentStep.skippable}
          />

          {/* name */}
          {currentStep.id === "name" && (
            <div>
              <Label className="text-sm font-medium">Full name</Label>
              <Input value={fullName}
                onChange={e => { setFullName(e.target.value); setErrors({}); }}
                className={`mt-1 h-11 ${errors.fullName ? "border-destructive" : ""}`}
                placeholder="e.g. Amara Osei" />
              {errors.fullName && <p className="text-xs text-destructive mt-1">{errors.fullName}</p>}
            </div>
          )}

          {/* location */}
          {currentStep.id === "location" && (
            <div>
              <Label className="text-sm font-medium">Country</Label>
              <CountryPicker value={country} onChange={v => { setCountry(v); setErrors({}); }} error={errors.country} />
            </div>
          )}

          {/* bio */}
          {currentStep.id === "bio" && (
            <div>
              <Label className="text-sm font-medium">Short bio</Label>
              <Textarea value={bio} onChange={e => setBio(e.target.value)}
                className="mt-1 resize-none" rows={4}
                placeholder="What do you work on? What's your focus area?" />
            </div>
          )}

          {/* upload */}
          {currentStep.id === "upload" && (
            <DocumentUploadStep
              track={orgTrack}
              onExtracted={data => { applyExtracted(data); setStep(s => s + 1); }}
              onSkipToManual={() => { setManualMode(true); setStep(0); }}
            />
          )}

          {/* confirm */}
          {currentStep.id === "confirm" && (
            <ConfirmExtractedStep
              orgName={orgName} setOrgName={setOrgName}
              description={description} setDescription={setDescription}
              country={country} setCountry={setCountry}
              roleTitle={roleTitle} setRoleTitle={setRoleTitle}
              orgType={orgType} setOrgType={setOrgType}
              errors={errors}
            />
          )}

          {/* org (manual) */}
          {currentStep.id === "org" && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Organisation name</Label>
                <Input value={orgName} onChange={e => { setOrgName(e.target.value); setErrors({}); }}
                  className={`mt-1 h-11 ${errors.orgName ? "border-destructive" : ""}`}
                  placeholder="e.g. Ashoka Foundation" />
                {errors.orgName && <p className="text-xs text-destructive mt-1">{errors.orgName}</p>}
              </div>
              <div>
                <Label className="text-sm font-medium">Role / Title</Label>
                <Input value={roleTitle} onChange={e => { setRoleTitle(e.target.value); setErrors({}); }}
                  className={`mt-1 h-11 ${errors.roleTitle ? "border-destructive" : ""}`}
                  placeholder="e.g. Programme Director" />
                {errors.roleTitle && <p className="text-xs text-destructive mt-1">{errors.roleTitle}</p>}
              </div>
              <div>
                <Label className="text-sm font-medium">Organisation type</Label>
                <select value={orgType} onChange={e => setOrgType(e.target.value)}
                  className="mt-1 w-full h-11 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
                  <option value="">Select type...</option>
                  {ORG_TYPE_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-sm font-medium">
                  Phone <span className="text-muted-foreground font-normal text-xs">(optional)</span>
                </Label>
                <Input value={phone} onChange={e => setPhone(e.target.value)}
                  className="mt-1 h-11" placeholder="+234 800 000 0000" />
              </div>
            </div>
          )}

          {/* description (manual) */}
          {currentStep.id === "description" && (
            <div>
              <Label className="text-sm font-medium">Organisation description</Label>
              <p className="text-xs text-muted-foreground mt-0.5 mb-2">
                What does your organisation do, where does it work, and who does it serve?
              </p>
              <Textarea value={description}
                onChange={e => { setDescription(e.target.value); setErrors({}); }}
                className={`mt-1 resize-none ${errors.description ? "border-destructive" : ""}`}
                rows={5}
                placeholder="e.g. We run community-led WASH programmes across three states in northern Nigeria, serving rural households without access to safe water and sanitation." />
              <div className="flex justify-between mt-1">
                {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
                <p className={`text-xs ml-auto ${wordCount(description) > 60 ? "text-red-500 font-semibold" : "text-muted-foreground"}`}>
                  {wordCount(description)}/60 words
                </p>
              </div>
            </div>
          )}

          {/* focus — sectors + SDGs (all user types) */}
          {currentStep.id === "focus" && (
            <div className="space-y-6">
              <div>
                <Label className="text-sm font-medium">Sectors you work in</Label>
                <p className="text-xs text-muted-foreground mt-0.5 mb-3">
                  {extractionDone && sectors.length > 0
                    ? "Pre-selected from your document. Adjust as needed."
                    : "Select all that apply."}
                </p>
                <div className="flex flex-wrap gap-2">
                  {SECTOR_OPTIONS.map(s => (
                    <ChipToggle key={s} label={s}
                      selected={sectors.includes(s)}
                      onToggle={() => toggleArr(sectors, s, setSectors)} />
                  ))}
                </div>
                {sectors.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-2">{sectors.length} selected</p>
                )}
              </div>

              <div>
                <Label className="text-sm font-medium">
                  SDG alignment{" "}
                  <span className="text-muted-foreground font-normal text-xs">(optional)</span>
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5 mb-3">
                  {extractionDone && sdgTags.length > 0
                    ? "Suggested from your document. Confirm or adjust."
                    : "Which Sustainable Development Goals does your work contribute to?"}
                </p>
                <div className="flex flex-wrap gap-2">
                  {SDG_OPTIONS.map(s => (
                    <ChipToggle key={s} label={s}
                      selected={sdgTags.includes(s)}
                      onToggle={() => toggleArr(sdgTags, s, setSdgTags)} />
                  ))}
                </div>
                {sdgTags.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-2">{sdgTags.length} selected</p>
                )}
              </div>
            </div>
          )}

          {/* needs & offers */}
          {currentStep.id === "needs" && (
            <div className="space-y-6">
              {/* Needs */}
              <div>
                <Label className="text-sm font-medium">What are you seeking?</Label>
                <p className="text-xs text-muted-foreground mt-0.5 mb-2">
                  Short tags describing what kind of support or partners you need.
                </p>
                <div className="flex gap-2 mb-2">
                  <Input value={needsInput} onChange={e => setNeedsInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        const v = needsInput.trim();
                        if (v && !needs.includes(v)) setNeeds(p => [...p, v]);
                        setNeedsInput("");
                      }
                    }}
                    className="h-10 flex-1" placeholder="e.g. Funding partner, M&E support" />
                  <button type="button"
                    onClick={() => {
                      const v = needsInput.trim();
                      if (v && !needs.includes(v)) setNeeds(p => [...p, v]);
                      setNeedsInput("");
                    }}
                    className="h-10 px-3 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors shrink-0">
                    Add
                  </button>
                </div>
                {needs.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {needs.map(n => (
                      <span key={n} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full"
                        style={{ background: "#f5ede8", color: "#C45C26" }}>
                        {n}
                        <button type="button" onClick={() => setNeeds(p => p.filter(x => x !== n))}
                          className="hover:opacity-70 ml-0.5">×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Offers */}
              <div>
                <Label className="text-sm font-medium">What do you offer?</Label>
                <p className="text-xs text-muted-foreground mt-0.5 mb-2">
                  Short tags describing what you bring to partnerships.
                </p>
                <div className="flex gap-2 mb-2">
                  <Input value={offersInput} onChange={e => setOffersInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        const v = offersInput.trim();
                        if (v && !offers.includes(v)) setOffers(p => [...p, v]);
                        setOffersInput("");
                      }
                    }}
                    className="h-10 flex-1" placeholder="e.g. Community mobilisation, Data collection" />
                  <button type="button"
                    onClick={() => {
                      const v = offersInput.trim();
                      if (v && !offers.includes(v)) setOffers(p => [...p, v]);
                      setOffersInput("");
                    }}
                    className="h-10 px-3 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors shrink-0">
                    Add
                  </button>
                </div>
                {offers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {offers.map(o => (
                      <span key={o} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full"
                        style={{ background: "#eaf5ee", color: "#2D6A4F" }}>
                        {o}
                        <button type="button" onClick={() => setOffers(p => p.filter(x => x !== o))}
                          className="hover:opacity-70 ml-0.5">×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* trackExtra */}
          {currentStep.id === "trackExtra" && (
            <div className="space-y-5">

              {/* IMPLEMENTER */}
              {orgTrack === "implementer" && (
                <>
                  <div>
                    <Label className="text-sm font-medium">Where is your organisation right now?</Label>
                    <div className="space-y-2 mt-2">
                      {STAGE_OPTIONS.map(opt => (
                        <button key={opt.value} type="button" onClick={() => setStage(opt.value)}
                          className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                            stage === opt.value ? "border-primary bg-[#fdf5f2]" : "border-border hover:border-foreground/20"
                          }`}>
                          <p className="text-sm font-semibold">{opt.label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{opt.sub}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium">Team size</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {TEAM_SIZE_OPTIONS.map(opt => (
                        <ChipToggle key={opt.value} label={opt.label}
                          selected={teamSize === opt.value}
                          onToggle={() => setTeamSize(opt.value)} />
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium">
                      Year founded <span className="text-muted-foreground font-normal text-xs">(optional)</span>
                    </Label>
                    <Input value={yearFounded}
                      onChange={e => setYearFounded(e.target.value.replace(/\D/g, ""))}
                      className="mt-1 h-11" placeholder="e.g. 2018" maxLength={4} />
                  </div>

                  {/* Startup-specific additions */}
                  {isStartup && (
                    <>
                      <div className="pt-2 border-t border-border">
                        <Label className="text-sm font-medium">Investment stage</Label>
                        <p className="text-xs text-muted-foreground mt-0.5 mb-2">
                          Where are you in your fundraising journey?
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {INVESTMENT_STAGE_OPTIONS.map(opt => (
                            <ChipToggle key={opt} label={opt}
                              selected={investmentStage === opt}
                              onToggle={() => setInvestmentStage(opt)} />
                          ))}
                        </div>
                      </div>

                      <div>
                        <Label className="text-sm font-medium">Business model</Label>
                        <div className="space-y-2 mt-2">
                          {BUSINESS_MODEL_OPTIONS.map(opt => (
                            <button key={opt.value} type="button"
                              onClick={() => setBusinessModel(opt.value)}
                              className={`w-full text-left px-4 py-2.5 rounded-xl border text-sm transition-colors ${
                                businessModel === opt.value
                                  ? "border-primary bg-[#fdf5f2] text-primary font-medium"
                                  : "border-border hover:border-foreground/20 text-foreground"
                              }`}>
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <Label className="text-sm font-medium">
                          Current runway <span className="text-muted-foreground font-normal text-xs">(optional)</span>
                        </Label>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {RUNWAY_OPTIONS.map(opt => (
                            <ChipToggle key={opt.value} label={opt.label}
                              selected={runway === opt.value}
                              onToggle={() => setRunway(opt.value)} />
                          ))}
                        </div>
                      </div>

                      <div>
                        <Label className="text-sm font-medium">
                          Funding ask <span className="text-muted-foreground font-normal text-xs">(optional)</span>
                        </Label>
                        <Input value={fundingAsk} onChange={e => setFundingAsk(e.target.value)}
                          className="mt-1 h-11"
                          placeholder="e.g. Raising $500K seed round for product and market expansion" />
                      </div>
                    </>
                  )}
                </>
              )}

              {/* FUNDER */}
              {orgTrack === "funder" && (
                <>
                  <div>
                    <Label className="text-sm font-medium">Grant or investment range</Label>
                    <div className="flex gap-2 items-center mt-1">
                      <select value={grantCurrency} onChange={e => setGrantCurrency(e.target.value)}
                        className="h-10 rounded-lg border border-border bg-background px-2 text-sm w-[80px] shrink-0 focus:outline-none focus:ring-2 focus:ring-primary/20">
                        {["USD", "GBP", "EUR", "NGN", "KES", "GHS", "ZAR"].map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                      <Input value={grantRangeMin}
                        onChange={e => setGrantRangeMin(e.target.value.replace(/[^0-9]/g, ""))}
                        className="h-10 flex-1" placeholder="Min" />
                      <span className="text-muted-foreground shrink-0 text-sm">–</span>
                      <Input value={grantRangeMax}
                        onChange={e => setGrantRangeMax(e.target.value.replace(/[^0-9]/g, ""))}
                        className="h-10 flex-1" placeholder="Max" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Funding instruments</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {FUNDING_INSTRUMENTS.map(f => (
                        <ChipToggle key={f} label={f}
                          selected={fundingInstruments.includes(f)}
                          onToggle={() => toggleArr(fundingInstruments, f, setFundingInstruments)} />
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Stage preference</Label>
                    <p className="text-xs text-muted-foreground mt-0.5 mb-2">What stage of initiative do you typically fund?</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {["Concept / Early stage", "Pilot / Proof of concept", "Growth / Scaling", "Mature / Established", "Core / Unrestricted"].map(s => (
                        <ChipToggle key={s} label={s}
                          selected={stagePreference.includes(s)}
                          onToggle={() => {
                            setStagePreference(prev =>
                              prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
                            );
                          }} />
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Geographic focus</Label>
                    <div className="flex gap-2 mb-2 mt-1">
                      <Input value={geographicInput} onChange={e => setGeographicInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const v = geographicInput.trim();
                            if (v && !geographicFocus.includes(v)) setGeographicFocus(p => [...p, v]);
                            setGeographicInput("");
                          }
                        }}
                        className="h-10 flex-1" placeholder="e.g. West Africa, Kenya" />
                      <button type="button"
                        onClick={() => {
                          const v = geographicInput.trim();
                          if (v && !geographicFocus.includes(v)) setGeographicFocus(p => [...p, v]);
                          setGeographicInput("");
                        }}
                        className="h-10 px-3 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors shrink-0">
                        Add
                      </button>
                    </div>
                    {geographicFocus.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {geographicFocus.map(g => (
                          <span key={g} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-border text-muted-foreground">
                            {g}
                            <button type="button" onClick={() => setGeographicFocus(p => p.filter(x => x !== g))}
                              className="hover:opacity-70 ml-0.5">×</button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* CORPORATE */}
              {orgTrack === "corporate" && (
                <>
                  <div>
                    <Label className="text-sm font-medium">
                      Annual CSR/ESG budget range <span className="text-muted-foreground font-normal text-xs">(optional)</span>
                    </Label>
                    <Input value={csrBudgetRange} onChange={e => setCsrBudgetRange(e.target.value)}
                      className="mt-1 h-11" placeholder="e.g. $500K–$2M" />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">ESG reporting frameworks</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {ESG_FRAMEWORKS.map(f => (
                        <ChipToggle key={f} label={f}
                          selected={esgFrameworks.includes(f)}
                          onToggle={() => toggleArr(esgFrameworks, f, setEsgFrameworks)} />
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Preferred partner types</Label>
                    <p className="text-xs text-muted-foreground mt-0.5 mb-2">What kinds of organisations do you typically partner with?</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {[
                        "Registered Charity / NGO",
                        "Social Enterprise / CIC / B Corp",
                        "Research Institution / Academia",
                        "Government / Public Sector",
                        "Individual Practitioner",
                      ].map(p => (
                        <ChipToggle key={p} label={p}
                          selected={partnerTypePreference.includes(p)}
                          onToggle={() => {
                            setPartnerTypePreference(prev =>
                              prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
                            );
                          }} />
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Geographic focus</Label>
                    <div className="flex gap-2 mb-2 mt-1">
                      <Input value={geographicInput} onChange={e => setGeographicInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const v = geographicInput.trim();
                            if (v && !geographicFocus.includes(v)) setGeographicFocus(p => [...p, v]);
                            setGeographicInput("");
                          }
                        }}
                        className="h-10 flex-1" placeholder="e.g. Nigeria, East Africa" />
                      <button type="button"
                        onClick={() => {
                          const v = geographicInput.trim();
                          if (v && !geographicFocus.includes(v)) setGeographicFocus(p => [...p, v]);
                          setGeographicInput("");
                        }}
                        className="h-10 px-3 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors shrink-0">
                        Add
                      </button>
                    </div>
                    {geographicFocus.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {geographicFocus.map(g => (
                          <span key={g} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-border text-muted-foreground">
                            {g}
                            <button type="button" onClick={() => setGeographicFocus(p => p.filter(x => x !== g))}
                              className="hover:opacity-70 ml-0.5">×</button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* RESEARCH */}
              {orgTrack === "research" && (
                <div>
                  <Label className="text-sm font-medium">Research methodologies</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {RESEARCH_METHODS.map(m => (
                      <ChipToggle key={m} label={m}
                        selected={researchMethods.includes(m)}
                        onToggle={() => toggleArr(researchMethods, m, setResearchMethods)} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* links */}
          {currentStep.id === "links" && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">LinkedIn URL</Label>
                <Input value={linkedinUrl} onChange={e => setLinkedinUrl(e.target.value)}
                  className="mt-1 h-11" placeholder="https://linkedin.com/in/yourprofile" type="url" />
              </div>
              <div>
                <Label className="text-sm font-medium">Website</Label>
                <Input value={website} onChange={e => setWebsite(e.target.value)}
                  className="mt-1 h-11" placeholder="https://yourwebsite.org" type="url" />
              </div>
              <div>
                <Label className="text-sm font-medium">Social profiles</Label>
                <p className="text-xs text-muted-foreground mt-0.5 mb-2">
                  Add Instagram, X, TikTok, YouTube, Behance — any platform.
                </p>
                <div className="flex gap-2">
                  <Input value={socialLabel} onChange={e => setSocialLabel(e.target.value)}
                    className="h-10 w-28 shrink-0" placeholder="e.g. Instagram" />
                  <Input value={socialUrl} onChange={e => setSocialUrl(e.target.value)}
                    className="h-10 flex-1" placeholder="https://instagram.com/handle" type="url" />
                  <button type="button"
                    onClick={() => {
                      if (!socialLabel.trim() || !socialUrl.trim()) return;
                      setSocialLinks(p => [...p, { label: socialLabel.trim(), url: socialUrl.trim() }]);
                      setSocialLabel(""); setSocialUrl("");
                    }}
                    className="h-10 px-3 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors shrink-0">
                    Add
                  </button>
                </div>
                {socialLinks.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {socialLinks.map((s, i) => (
                      <div key={i} className="flex items-center justify-between text-xs border border-border rounded-lg px-3 py-2 bg-muted/30">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-medium text-foreground shrink-0">{s.label}</span>
                          <span className="text-muted-foreground truncate">{s.url}</span>
                        </div>
                        <button type="button"
                          onClick={() => setSocialLinks(p => p.filter((_, idx) => idx !== i))}
                          className="ml-2 text-muted-foreground hover:text-foreground shrink-0">✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* verify */}
          {currentStep.id === "verify" && (
            <div className="space-y-5">
              <div className="flex items-start gap-3 p-4 rounded-xl bg-[#2D6A4F]/6 border border-[#2D6A4F]/20">
                <ShieldCheck className="w-5 h-5 text-[#2D6A4F] mt-0.5 shrink-0" />
                <div className="text-sm text-foreground leading-relaxed space-y-2">
                  <p>
                    Verified organisations get a badge on all activity, EOIs, partnerships, and profile.
                    Priority placement in the partner directory.
                  </p>
                  <p className="text-muted-foreground">
                    Verification requires a registration document — reviewed within 48 hours.
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                {[
                  { val: true,  label: "Yes, start verification" },
                  { val: false, label: "I'll do this later" },
                ].map(opt => (
                  <button key={String(opt.val)} type="button" onClick={() => setWantsVerify(opt.val)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                      wantsVerify === opt.val
                        ? "border-[#2D6A4F] bg-[#2D6A4F]/8 text-[#2D6A4F]"
                        : "border-border text-foreground hover:border-[#2D6A4F]/40"
                    }`}>
                    <span>{opt.label}</span>
                    {wantsVerify === opt.val && (
                      <span className="text-xs bg-[#2D6A4F] text-white px-2 py-0.5 rounded-full">Selected</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          {currentStep.id !== "upload" && (
            <div className="flex items-center justify-between mt-8">
              <div className="flex items-center gap-4">
                {step > 0 && (
                  <button type="button" onClick={handleBack}
                    className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors">
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Back
                  </button>
                )}
                {currentStep.skippable && (
                  <button type="button" onClick={handleSkip}
                    className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors">
                    <SkipForward className="w-3.5 h-3.5" />
                    Skip
                  </button>
                )}
              </div>
              <Button onClick={handleNext} disabled={saving}
                className="bg-[#2D6A4F] hover:bg-[#245c43] text-white px-6">
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isLast && currentStep.id === "verify" && wantsVerify ? (
                  "Finish & start verification"
                ) : isLast ? (
                  "Finish setup"
                ) : (
                  <>Continue <ArrowRight className="w-4 h-4 ml-2" /></>
                )}
              </Button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          You can update all of this later from your profile settings.
        </p>
      </div>
    </div>
  );
}