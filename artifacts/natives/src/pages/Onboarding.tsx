import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { COUNTRIES } from "@/lib/countries";
import { SECTOR_OPTIONS } from "@/lib/sectors";
import { Loader2, ArrowRight, SkipForward, ShieldCheck, Users, User } from "lucide-react";

const ORG_TYPE_OPTIONS = [
  { value: "ngo_non_profit",              label: "NGO / Non-Profit" },
  { value: "social_enterprise",           label: "Social Enterprise" },
  { value: "startup",                     label: "Startup" },
  { value: "technology_company",          label: "Technology Company" },
  { value: "corporation",                 label: "Corporation" },
  { value: "philanthropic_foundation",    label: "Philanthropic Foundation" },
  { value: "venture_capital",             label: "Venture Capital (VC)" },
  { value: "creative_agency_studio",      label: "Creative Agency / Studio" },
  { value: "public_sector",               label: "Public Sector" },
  { value: "research_academic",           label: "Research & Academic Institution" },
];

type UserType = "individual_creative" | "organisation";

function CountryPicker({ value, onChange, error }: {
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = search.trim()
    ? COUNTRIES.filter((c) => c.toLowerCase().includes(search.toLowerCase()))
    : COUNTRIES;

  return (
    <div className="relative mt-1">
      <Input
        value={open ? search : value}
        onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
        onFocus={() => { setSearch(""); setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className={`h-11 ${error ? "border-destructive" : ""}`}
        placeholder="Search country..."
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto rounded-lg border border-border bg-background shadow-md">
          {filtered.map((c) => (
            <button
              key={c}
              type="button"
              onMouseDown={() => {onChange(c); setSearch(""); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors ${
                value === c ? "bg-[#2D6A4F]/10 text-[#2D6A4F] font-medium" : "text-foreground"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      )}
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}

// Steps vary by user type. Step 0 (user type) is handled separately.
// Individual: name → location → bio → focus → links
// Organisation: name → location → bio → org → focus → links → verify
const INDIVIDUAL_STEPS = [
  { id: "name",     label: "Your name",          skippable: false },
  { id: "location", label: "Where you're based", skippable: false },
  { id: "bio",      label: "About you",          skippable: true  },
  { id: "focus",    label: "Your focus areas",   skippable: true  },
  { id: "links",    label: "Online presence",    skippable: true  },
];

const ORG_STEPS = [
  { id: "name",     label: "Your name",          skippable: false },
  { id: "location", label: "Where you're based", skippable: false },
  { id: "bio",      label: "About you",          skippable: true  },
  { id: "org",      label: "Your organisation",  skippable: false },
  { id: "focus",    label: "Your focus areas",   skippable: true  },
  { id: "links",    label: "Online presence",    skippable: true  },
  { id: "verify",   label: "Get verified",       skippable: true  },
];

export default function Onboarding() {
  const [, navigate]              = useLocation();
  const { user, refreshProfile }  = useAuth();

  // Step 0 = user type selection (not in STEPS array)
  const [userType, setUserType]           = useState<UserType | null>(null);
  const [step, setStep]                   = useState(-1); // -1 = user type screen
  const [saving, setSaving]               = useState(false);
  const [errors, setErrors]               = useState<Record<string, string>>({});

  // Fields
  const [fullName, setFullName]           = useState("");
  const [country, setCountry]             = useState("");
  const [bio, setBio]                     = useState("");
  const [orgName, setOrgName]             = useState("");
  const [roleTitle, setRoleTitle]         = useState("");
  const [phone, setPhone]                 = useState("");
  const [linkedinUrl, setLinkedinUrl]     = useState("");
  const [website, setWebsite]             = useState("");
  const [socialLinks, setSocialLinks]     = useState<{ label: string; url: string }[]>([]);
  const [socialLabel, setSocialLabel]     = useState("");
  const [socialUrl, setSocialUrl]         = useState("");
  const [sectors, setSectors]             = useState<string[]>([]);
  const [orgType, setOrgType]             = useState("");
  const [wantsVerify, setWantsVerify]     = useState(false);

  const steps = userType === "organisation" ? ORG_STEPS : INDIVIDUAL_STEPS;
  const currentStep = steps[step];
  const isLast = step === steps.length - 1;
  const totalSteps = steps.length;

  function toggleSector(s: string) {
    setSectors((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  }

  function getRedirectPath() {
    const stored = sessionStorage.getItem("redirectAfterAuth");
    if (stored) {
      sessionStorage.removeItem("redirectAfterAuth");
      return stored;
    }
    return "/dashboard";
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!currentStep) return true;

    if (currentStep.id === "name" && !fullName.trim()) {
      errs.fullName = "Please enter your full name.";
    }
    if (currentStep.id === "location" && !country.trim()) {
      errs.country = "Please enter your country.";
    }
    if (currentStep.id === "org") {
      if (!orgName.trim()) errs.orgName = "Organisation name is required.";
      if (!roleTitle.trim()) errs.roleTitle = "Role or title is required.";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function mandatoryFieldsSatisfied(): boolean {
    if (!fullName.trim() || !country.trim()) return false;
    if (userType === "organisation" && (!orgName.trim() || !roleTitle.trim())) return false;
    return true;
  }

  async function finish(requestVerify?: boolean) {
    if (!user) return;
    if (!mandatoryFieldsSatisfied()) return;
    setSaving(true);

    await supabase
    .from("profiles")
    .update({
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
      verification_requested: requestVerify ?? false,
      onboarding_completed:   true,
      updated_at:             new Date().toISOString(),
    })
    .eq("id", user.id);

  // Create organizations row for org users
  if (userType === "organisation" && orgName.trim()) {
    await supabase
        .from("organizations")
        .insert({
          user_id:             user.id,
          organisation_name:   orgName.trim(),
          email:               user.email ?? null,
          website:             website     || null,
          country:             country     || null,
          sector:              sectors.length > 0 ? JSON.stringify(sectors) : null,
          organisation_type:   orgType     || null,
          status:              "pending",
          verification_status: requestVerify ? "pending" : "not_requested",
          created_at:          new Date().toISOString(),
          updated_at:          new Date().toISOString(),
        });
  }
    
    await refreshProfile();
    setSaving(false);
    if (requestVerify) {
      navigate("/verify");
    } else {
      navigate(getRedirectPath());
    }
  }

  function handleNext() {
    if (!validate()) return;
        if (isLast) {
      if (currentStep.id === "verify") {

        finish(wantsVerify);
      } else {
        finish(false);
      }
      return;
    }
    setErrors({});
    setStep((s) => s + 1);
  }

  function handleSkip() {
    if (!currentStep.skippable) return;
    if (isLast) {
      finish(false);
      return;
    }
    setErrors({});
    setStep((s) => s + 1);
  }

  function selectUserType(type: UserType) {
    setUserType(type);
    setStep(0);
  }

  // ─── User type selection screen ───────────────────────────────────────────
  if (step === -1) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-md">
                  <div className="bg-card rounded-2xl border border-border shadow-sm p-8 overflow-y-auto max-h-[70vh]">
            <div className="mb-8">
              <span className="text-xs font-medium text-[#2D6A4F] uppercase tracking-wide">
                Welcome
              </span>
              <h2 className="text-xl font-semibold text-foreground mt-1">
                How are you joining?
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                This helps us tailor your experience.
              </p>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => selectUserType("individual_creative")}
                className="w-full flex items-start gap-4 p-4 rounded-xl border border-border hover:border-[#2D6A4F]/50 hover:bg-[#2D6A4F]/5 transition-all text-left group"
              >
                <div className="mt-0.5 p-2 rounded-lg bg-muted group-hover:bg-[#2D6A4F]/10 transition-colors">
                  <User className="w-5 h-5 text-[#2D6A4F]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Individual / Creative</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    You're joining as a practitioner, consultant, or freelancer.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => selectUserType("organisation")}
                className="w-full flex items-start gap-4 p-4 rounded-xl border border-border hover:border-[#2D6A4F]/50 hover:bg-[#2D6A4F]/5 transition-all text-left group"
              >
                <div className="mt-0.5 p-2 rounded-lg bg-muted group-hover:bg-[#2D6A4F]/10 transition-colors">
                  <Users className="w-5 h-5 text-[#2D6A4F]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Organisation</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    You're representing an NGO, funder, company, or institution.
                  </p>
                </div>
              </button>
            </div>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-4">
            You can update all of this later from your profile settings.
          </p>
        </div>
      </div>
    );
  }

  // ─── Main step flow ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Progress dots */}
        <div className="flex gap-2 mb-8 justify-center">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step
                  ? "w-6 bg-[#2D6A4F]"
                  : i < step
                  ? "w-3 bg-[#2D6A4F]/40"
                  : "w-3 bg-muted"
              }`}
            />
          ))}
        </div>

                <div className="bg-card rounded-2xl border border-border shadow-sm p-8 overflow-y-auto max-h-[65vh]">
          <div className="mb-6">
            <span className="text-xs font-medium text-[#2D6A4F] uppercase tracking-wide">
              Step {step + 1} of {totalSteps}
            </span>
            <h2 className="text-xl font-semibold text-foreground mt-1">
              {currentStep.label}
            </h2>
            {currentStep.skippable ? (
              <p className="text-sm text-muted-foreground mt-0.5">
                Optional — skip if you prefer not to share this now.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground mt-0.5">
                Required to complete setup.
              </p>
            )}
          </div>

          {/* Step: name */}
          {currentStep.id === "name" && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Full name</Label>
                <Input
                  value={fullName}
                  onChange={(e) => { setFullName(e.target.value); setErrors({}); }}
                  className={`mt-1 h-11 ${errors.fullName ? "border-destructive" : ""}`}
                  placeholder="e.g. Amara Osei"
                />
                {errors.fullName && (
                  <p className="text-xs text-destructive mt-1">{errors.fullName}</p>
                )}
              </div>
            </div>
          )}

          {/* Step: location */}
          {currentStep.id === "location" && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Country</Label>
                <CountryPicker
                  value={country}
                  onChange={(v) => { setCountry(v); setErrors({}); }}
                  error={errors.country}
                />
              </div>
            </div>
          )}

          {/* Step: bio */}
          {currentStep.id === "bio" && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Short bio</Label>
                <Textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="mt-1 resize-none"
                  rows={4}
                  placeholder="What do you work on? What's your focus area?"
                />
              </div>
            </div>
          )}

          {/* Step: org (organisation users only) */}
          {currentStep.id === "org" && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Organisation name</Label>
                <Input
                  value={orgName}
                  onChange={(e) => { setOrgName(e.target.value); setErrors({}); }}
                  className={`mt-1 h-11 ${errors.orgName ? "border-destructive" : ""}`}
                  placeholder="e.g. Ashoka Foundation"
                />
                {errors.orgName && (
                  <p className="text-xs text-destructive mt-1">{errors.orgName}</p>
                )}
              </div>
              <div>
                <Label className="text-sm font-medium">Role / Title</Label>
                <Input
                  value={roleTitle}
                  onChange={(e) => { setRoleTitle(e.target.value); setErrors({}); }}
                  className={`mt-1 h-11 ${errors.roleTitle ? "border-destructive" : ""}`}
                  placeholder="e.g. Programme Director"
                />
                {errors.roleTitle && (
                  <p className="text-xs text-destructive mt-1">{errors.roleTitle}</p>
                )}
              </div>
              <div>
                <Label className="text-sm font-medium">
                  Phone <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1 h-11"
                  placeholder="+234 800 000 0000"
                />
              </div>
            </div>
          )}

          {/* Step: focus */}
          {currentStep.id === "focus" && (
            <div className="space-y-5">
              {userType === "organisation" && (
                <div>
                  <Label className="text-sm font-medium">Organisation type</Label>
                  <Select value={orgType} onValueChange={setOrgType}>
                    <SelectTrigger className="mt-1 h-11">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {ORG_TYPE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label className="text-sm font-medium">Sectors you work in</Label>
                <p className="text-xs text-muted-foreground mt-0.5 mb-2">
                  Select all that apply. Used to surface relevant partners and initiatives.
                </p>
                <div className="flex flex-wrap gap-2">
                  {SECTOR_OPTIONS.map((s) => {
                    const active = sectors.includes(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => toggleSector(s)}
                        className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                          active
                            ? "bg-[#2D6A4F] border-[#2D6A4F] text-white"
                            : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                        }`}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
                {sectors.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-2">{sectors.length} selected</p>
                )}
              </div>
            </div>
          )}

          {/* Step: links */}
          {currentStep.id === "links" && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">LinkedIn URL</Label>
                <Input
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  className="mt-1 h-11"
                  placeholder="https://linkedin.com/in/yourprofile"
                  type="url"
                />
              </div>
              <div>
                <Label className="text-sm font-medium">Website or portfolio</Label>
                <Input
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  className="mt-1 h-11"
                  placeholder="https://yourwebsite.org"
                  type="url"
                />
              </div>
              <div>
                <Label className="text-sm font-medium">Social profiles</Label>
                <p className="text-xs text-muted-foreground mt-0.5 mb-2">
                  Add Instagram, X, TikTok, YouTube, Behance — any platform.
                </p>
                <div className="flex gap-2">
                  <Input
                    value={socialLabel}
                    onChange={(e) => setSocialLabel(e.target.value)}
                    className="h-10 w-28 shrink-0"
                    placeholder="e.g. Instagram"
                  />
                  <Input
                    value={socialUrl}
                    onChange={(e) => setSocialUrl(e.target.value)}
                    className="h-10 flex-1"
                    placeholder="https://instagram.com/yourhandle"
                    type="url"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!socialLabel.trim() || !socialUrl.trim()) return;
                      setSocialLinks((prev) => [...prev, { label: socialLabel.trim(), url: socialUrl.trim() }]);
                      setSocialLabel("");
                      setSocialUrl("");
                    }}
                    className="h-10 px-3 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors shrink-0"
                  >
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
                        <button
                          type="button"
                          onClick={() => setSocialLinks((prev) => prev.filter((_, idx) => idx !== i))}
                          className="ml-2 text-muted-foreground hover:text-foreground shrink-0"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step: verify (organisation users only) */}
          {currentStep.id === "verify" && (
            <div className="space-y-5">
              <div className="flex items-start gap-3 p-4 rounded-xl bg-[#2D6A4F]/6 border border-[#2D6A4F]/20">
                <ShieldCheck className="w-5 h-5 text-[#2D6A4F] mt-0.5 shrink-0" />
                <div className="text-sm text-foreground leading-relaxed space-y-2">
                  <p>
                    Verified organisations get a badge on all activity, EOIs, partnerships, and profile.
                    Priority placement in the partner directory. And when Impact Points launch, verified
                    organisations earn a credibility multiplier on completed initiatives.
                  </p>
                  <p className="text-muted-foreground">
                    Verification requires a registration document — takes less than 48 hours to review.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setWantsVerify(true)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                    wantsVerify
                      ? "border-[#2D6A4F] bg-[#2D6A4F]/8 text-[#2D6A4F]"
                      : "border-border text-foreground hover:border-[#2D6A4F]/40"
                  }`}
                >
                  <span>Yes, start verification</span>
                  {wantsVerify && (
                    <span className="text-xs bg-[#2D6A4F] text-white px-2 py-0.5 rounded-full">Selected</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setWantsVerify(false)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm transition-all ${
                    !wantsVerify
                      ? "border-border bg-muted/50 text-muted-foreground"
                      : "border-border text-muted-foreground hover:border-border/80"
                  }`}
                >
                  <span>I'll do this later</span>
                </button>
              </div>

              {wantsVerify && (
                <p className="text-xs text-muted-foreground">
                  After finishing setup, go to{" "}
                  <span className="text-foreground font-medium">Profile → Verification</span>{" "}
                  to upload your registration document.
                </p>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between mt-8">
            {currentStep.skippable ? (
              <button
                type="button"
                onClick={handleSkip}
                className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
              >
                <SkipForward className="w-3.5 h-3.5" />
                Skip
              </button>
            ) : (
              <span />
            )}

            <Button
              onClick={handleNext}
              disabled={saving}
              className="bg-[#2D6A4F] hover:bg-[#245c43] text-white px-6"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isLast && currentStep.id === "verify" && wantsVerify ? (
                "Finish & start verification"
              ) : isLast ? (
                "Finish setup"
              ) : (
                <>
                  Continue
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          You can update all of this later from your profile settings.
        </p>
      </div>
    </div>
  );
}