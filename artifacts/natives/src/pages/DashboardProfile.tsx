import { useState, useEffect } from "react";
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
import { Link } from "wouter";
import { Loader2, CheckCircle2, ShieldCheck, Camera, ArrowRight } from "lucide-react";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { COUNTRIES } from "@/lib/countries";
import { SECTOR_OPTIONS } from "@/lib/sectors";

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

function CountryPicker({ value, onChange }: {
  value: string;
  onChange: (v: string) => void;
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
        className="h-10"
        placeholder="Search country..."
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto rounded-lg border border-border bg-background shadow-md">
          {filtered.map((c) => (
            <button
              key={c}
              type="button"
              onMouseDown={() => { onChange(c); setSearch(""); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors ${
                value === c ? "bg-[#2D6A4F]/10 text-[#2D6A4F] font-medium" : "text-foreground"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SectorChips({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  function toggle(s: string) {
    onChange(
      selected.includes(s) ? selected.filter((x) => x !== s) : [...selected, s]
    );
  }
  return (
    <div className="flex flex-wrap gap-2 mt-1">
      {SECTOR_OPTIONS.map((s) => {
        const active = selected.includes(s);
        return (
          <button
            key={s}
            type="button"
            onClick={() => toggle(s)}
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
  );
}

export default function DashboardProfile() {
  const { user, profile, refreshProfile } = useAuth();
  const [saving, setSaving]               = useState(false);
  const [saved, setSavedState]            = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoUrl, setLogoUrl]             = useState<string | null>(null);

  // Mandate fields (funders/corporates)
  const [investmentThesis, setInvestmentThesis]       = useState(profile?.investment_thesis ?? "");

  // Impact & track record (implementers)
  const [totalBeneficiaries, setTotalBeneficiaries]   = useState("");
  const [jobsCreated, setJobsCreated]                 = useState("");
  const [femalePct, setFemalePct]                     = useState("");
  const [youthPct, setYouthPct]                       = useState("");
  const [yearsOfOperation, setYearsOfOperation]       = useState("");
  const [grantsCount, setGrantsCount]                 = useState("");
  const [grantsTotalValue, setGrantsTotalValue]       = useState("");
  const [grantsOnTimePct, setGrantsOnTimePct]         = useState("");
  const [previousFunders, setPreviousFunders]         = useState<string[]>([]);
  const [funderInput, setFunderInput]                 = useState("");
  const [thirdPartyEvaluations, setThirdPartyEvaluations] = useState(false);

  // DD readiness
  const [ddFinancialModel, setDdFinancialModel]       = useState(false);
  const [ddAuditedAccounts, setDdAuditedAccounts]     = useState(false);
  const [ddGovernanceDoc, setDdGovernanceDoc]         = useState(false);
  const [ddEsgAssessment, setDdEsgAssessment]         = useState(false);
  const [ddImpactFramework, setDdImpactFramework]     = useState(false);  const [grantRangeMin, setGrantRangeMin]             = useState("");
  const [grantRangeMax, setGrantRangeMax]             = useState("");
  const [grantCurrency, setGrantCurrency]             = useState("USD");
  const [fundingInstruments, setFundingInstruments]   = useState<string[]>([]);
  const [geographicFocus, setGeographicFocus]         = useState<string[]>([]);
  const [geographicInput, setGeographicInput]         = useState("");
  const [stagePreference, setStagePreference]         = useState<string[]>([]);
  const [partnerTypePreference, setPartnerTypePreference] = useState<string[]>([]);
  const [csrBudgetRange, setCsrBudgetRange]           = useState("");
  const [esgFrameworks, setEsgFrameworks]             = useState<string[]>([]);
  
  useEffect(() => {
    if (!user) return;
    supabase.from("organizations")
      .select("logo_url,description,grant_range_min,grant_range_max,grant_currency,funding_instruments,geographic_focus,stage_preference,partner_type_preference,csr_budget_range,esg_frameworks,dd_financial_model,dd_audited_accounts,dd_governance_doc,dd_esg_assessment,dd_impact_framework,total_beneficiaries_reached,jobs_created,female_beneficiaries_pct,youth_beneficiaries_pct,years_of_operation,grants_received_count,grants_total_value_usd,grants_delivered_on_time_pct,previous_funders,third_party_evaluations")
      .eq("user_id", user.id).maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        if (data.logo_url) setLogoUrl(data.logo_url);
        if (data.description) setOrgDescription(data.description);
        if (data.grant_range_min) setGrantRangeMin(String(data.grant_range_min));
        if (data.grant_range_max) setGrantRangeMax(String(data.grant_range_max));
        if (data.grant_currency) setGrantCurrency(data.grant_currency);
        if (data.funding_instruments) setFundingInstruments(data.funding_instruments);
        if (data.geographic_focus) setGeographicFocus(data.geographic_focus);
        if (data.stage_preference) setStagePreference(data.stage_preference);
        if (data.partner_type_preference) setPartnerTypePreference(data.partner_type_preference);
        if (data.csr_budget_range) setCsrBudgetRange(data.csr_budget_range);
        if (data.esg_frameworks) setEsgFrameworks(data.esg_frameworks);
        setDdFinancialModel(data.dd_financial_model ?? false);
        setDdAuditedAccounts(data.dd_audited_accounts ?? false);
        setDdGovernanceDoc(data.dd_governance_doc ?? false);
        setDdEsgAssessment(data.dd_esg_assessment ?? false);
        setDdImpactFramework(data.dd_impact_framework ?? false);
        if (data.total_beneficiaries_reached) setTotalBeneficiaries(String(data.total_beneficiaries_reached));
        if (data.jobs_created) setJobsCreated(String(data.jobs_created));
        if (data.female_beneficiaries_pct) setFemalePct(String(data.female_beneficiaries_pct));
        if (data.youth_beneficiaries_pct) setYouthPct(String(data.youth_beneficiaries_pct));
        if (data.years_of_operation) setYearsOfOperation(String(data.years_of_operation));
        if (data.grants_received_count) setGrantsCount(String(data.grants_received_count));
        if (data.grants_total_value_usd) setGrantsTotalValue(String(data.grants_total_value_usd));
        if (data.grants_delivered_on_time_pct) setGrantsOnTimePct(String(data.grants_delivered_on_time_pct));
        if (data.previous_funders) setPreviousFunders(data.previous_funders);
        setThirdPartyEvaluations(data.third_party_evaluations ?? false);
      });  }, [user]);
  
  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 2 * 1024 * 1024) { alert("File size must be under 2 MB."); return; }
    setLogoUploading(true);
    const ext = file.name.split(".").pop();
    const filePath = `${user.id}/logo.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("org-logos")
      .upload(filePath, file, { upsert: true });
    if (uploadError) { alert(`Upload failed: ${uploadError.message}`); setLogoUploading(false); return; }
    const { data } = supabase.storage.from("org-logos").getPublicUrl(filePath);
    await supabase.from("organizations").update({ logo_url: data.publicUrl }).eq("user_id", user.id);
    await supabase.from("profiles").update({ avatar_url: data.publicUrl }).eq("id", user.id);
    setLogoUrl(data.publicUrl);
    await refreshProfile();
    setLogoUploading(false);
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 2 * 1024 * 1024) {
      alert("File size must be under 2 MB.");
      return;
    }
    setAvatarUploading(true);
    const ext = file.name.split(".").pop();
    const filePath = `${user.id}/avatar.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, { upsert: true });
    if (uploadError) {
      alert(`Upload failed: ${uploadError.message}`);
      setAvatarUploading(false);
      return;
    }
    const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
    await supabase
      .from("profiles")
      .update({ avatar_url: data.publicUrl, updated_at: new Date().toISOString() })
      .eq("id", user.id);
    await refreshProfile();
    setAvatarUploading(false);
  }

  // Existing fields
  const [fullName, setFullName]         = useState(profile?.full_name     ?? "");
  const [country, setCountry]           = useState(profile?.country       ?? "");
  const [bio, setBio]                   = useState(profile?.bio           ?? "");
  const [orgDescription, setOrgDescription] = useState("");
  const [orgName, setOrgName]           = useState(profile?.org_name      ?? "");
  const [roleTitle, setRoleTitle]       = useState(profile?.role_title    ?? "");
  const [phone, setPhone]               = useState(profile?.phone         ?? "");
  const [linkedinUrl, setLinkedinUrl]   = useState(profile?.linkedin_url  ?? "");
  const [website, setWebsite]           = useState(profile?.website       ?? "");

  // Sync state when profile loads or refreshes
  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name     ?? "");
    setCountry(profile.country        ?? "");
    setBio(profile.bio                ?? "");
    setOrgName(profile.org_name       ?? "");
    setRoleTitle(profile.role_title   ?? "");
    setPhone(profile.phone            ?? "");
    setLinkedinUrl(profile.linkedin_url ?? "");
    setWebsite(profile.website        ?? "");
    setSectors(profile.sectors        ?? []);
    if (profile.social_links) setSocialLinks(profile.social_links);
  }, [profile?.id]);
const [socialLinks, setSocialLinks]   = useState<{ label: string; url: string }[]>(profile?.social_links ?? []);
  const [socialLabel, setSocialLabel]   = useState("");
  const [socialUrl, setSocialUrl]       = useState("");

  useEffect(() => {
    if (profile?.social_links) setSocialLinks(profile.social_links);
  }, [profile?.social_links]);

  // New fields
  const [sectors, setSectors]   = useState<string[]>(profile?.sectors  ?? []);
  const [orgType, setOrgType]   = useState<string>(profile?.org_type   ?? "");

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    await supabase
      .from("profiles")
      .update({
        full_name:   fullName    || null,
        country:     country     || null,
        bio:         bio         || null,
        org_name:    orgName     || null,
        role_title:  roleTitle   || null,
        phone:       phone       || null,
        linkedin_url: linkedinUrl || null,
        website:     website     || null,
        social_links: socialLinks.length > 0 ? socialLinks : null,
        sectors:     sectors.length > 0 ? sectors : null,
        org_type:    orgType     || null,
        ...(profile?.user_type === "organisation" ? { investment_thesis: investmentThesis || null } : {}),
        updated_at:  new Date().toISOString(),
      })
      .eq("id", user.id);

    // Save mandate fields for funders/corporates
    const isFunderOrCorporate = ["philanthropic_foundation", "venture_capital", "corporation", "technology_company", "public_sector"].includes(profile?.org_type ?? "");
    if (isFunderOrCorporate) {
      await supabase
        .from("organizations")
        .update({
          grant_range_min: grantRangeMin ? parseFloat(grantRangeMin) : null,
          grant_range_max: grantRangeMax ? parseFloat(grantRangeMax) : null,
          grant_currency: grantCurrency || null,
          funding_instruments: fundingInstruments.length > 0 ? fundingInstruments : null,
          geographic_focus: geographicFocus.length > 0 ? geographicFocus : null,
          stage_preference: stagePreference.length > 0 ? stagePreference : null,
          partner_type_preference: partnerTypePreference.length > 0 ? partnerTypePreference : null,
          csr_budget_range: csrBudgetRange || null,
          esg_frameworks: esgFrameworks.length > 0 ? esgFrameworks : null,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);
    }

    // DD readiness + impact data — save for all org users
    if (profile?.user_type === "organisation") {
      await supabase
        .from("organizations")
        .update({
          description: orgDescription || null,
          dd_financial_model: ddFinancialModel,
          dd_audited_accounts: ddAuditedAccounts,
          dd_governance_doc: ddGovernanceDoc,
          dd_esg_assessment: ddEsgAssessment,
          dd_impact_framework: ddImpactFramework,
          total_beneficiaries_reached: totalBeneficiaries ? parseInt(totalBeneficiaries) : null,
          jobs_created: jobsCreated ? parseInt(jobsCreated) : null,
          female_beneficiaries_pct: femalePct ? parseInt(femalePct) : null,
          youth_beneficiaries_pct: youthPct ? parseInt(youthPct) : null,
          years_of_operation: yearsOfOperation ? parseInt(yearsOfOperation) : null,
          grants_received_count: grantsCount ? parseInt(grantsCount) : null,
          grants_total_value_usd: grantsTotalValue ? parseFloat(grantsTotalValue) : null,
          grants_delivered_on_time_pct: grantsOnTimePct ? parseInt(grantsOnTimePct) : null,
          previous_funders: previousFunders.length > 0 ? previousFunders : null,
          third_party_evaluations: thirdPartyEvaluations,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);
    }

    await refreshProfile();
    setSaving(false);
    setSavedState(true);
    setTimeout(() => setSavedState(false), 3000);
  }

  const profileStrength = profile?.user_type === "organisation"
    ? [!!fullName, !!orgDescription, !!country, !!orgName, sectors.length > 0, !!linkedinUrl || !!website, !!logoUrl]
    : [!!fullName, !!roleTitle, !!bio, !!country, sectors.length > 0, !!linkedinUrl || !!website, !!profile?.avatar_url];
  const strengthScore = Math.round((profileStrength.filter(Boolean).length / profileStrength.length) * 100);
  const strengthLabel = strengthScore >= 80 ? "Strong" : strengthScore >= 50 ? "Good" : "Needs work";
  const strengthColor = strengthScore >= 80 ? "#2D6A4F" : strengthScore >= 50 ? "#f59e0b" : "#C45C26";

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: "2rem", alignItems: "start", width: "100%", position: "relative" }}>
     <div className="space-y-8">
      <div>
        <p className="text-sm text-muted-foreground mt-1">
          How you appear to partners and organisations across Natives.
        </p>
      </div>

      {/* Avatar upload — individuals only */}
      {profile?.user_type !== "organisation" && (
        <div className="rounded-2xl border border-border bg-card p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
            Profile photo
          </p>
          <div className="flex items-center gap-5">
            <div className="relative w-14 h-14">
              <UserAvatar
                id={user?.id ?? ""}
                name={profile?.full_name}
                avatarUrl={profile?.avatar_url}
                size="lg"
              />
              <label className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#2D6A4F] flex items-center justify-center cursor-pointer hover:bg-[#245c43] transition-colors z-10">
                <Camera className="w-3 h-3 text-white" />
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  onChange={handleAvatarUpload}
                />
              </label>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Upload a photo</p>
              <p className="text-xs text-muted-foreground mt-0.5">PNG, JPG or WebP. Max 2 MB.</p>
              {avatarUploading && (
                <p className="text-xs text-[#2D6A4F] mt-1 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Uploading...
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Org logo — org users only, shown at top */}
      {profile?.user_type === "organisation" && (
        <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Organisation logo
          </p>
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-xl border border-border bg-muted flex items-center justify-center overflow-hidden shrink-0">
              {logoUrl ? (
                <img src={logoUrl} alt="Organisation logo" className="w-full h-full object-contain" />
              ) : (
                <span className="text-2xl font-bold text-muted-foreground">
                  {(orgName || profile?.org_name || "?")[0].toUpperCase()}
                </span>
              )}
            </div>
            <div>
              <label className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors cursor-pointer">
                <Camera className="w-3.5 h-3.5" />
                {logoUrl ? "Replace logo" : "Upload logo"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="sr-only"
                  onChange={handleLogoUpload}
                />
              </label>
              <p className="text-xs text-muted-foreground mt-1.5">PNG, JPG, WebP or SVG. Max 2 MB.</p>
              {logoUploading && (
                <p className="text-xs text-[#2D6A4F] mt-1 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Uploading...
                </p>
              )}
              {logoUrl && !logoUploading && (
                <p className="text-xs text-[#2D6A4F] mt-1">Logo saved.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Basic info — individuals only */}
      {profile?.user_type !== "organisation" && (
        <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Basic info
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">Full name</Label>
              <Input value={fullName} onChange={e => setFullName(e.target.value)}
                className="mt-1 h-10" placeholder="e.g. Amara Osei" />
            </div>
            <div>
              <Label className="text-sm font-medium">Country</Label>
              <CountryPicker value={country} onChange={setCountry} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">Headline</Label>
              <Input value={roleTitle} onChange={e => setRoleTitle(e.target.value.slice(0, 120))}
                className="mt-1 h-10" placeholder="e.g. Impact Evaluator & Filmmaker" />
            </div>
            <div>
              <Label className="text-sm font-medium">Phone</Label>
              <Input value={phone} onChange={e => setPhone(e.target.value)}
                className="mt-1 h-10" placeholder="+234 800 000 0000" />
            </div>
          </div>
          <div>
            <Label className="text-sm font-medium">Bio</Label>
            <Textarea value={bio} onChange={e => setBio(e.target.value)}
              className="mt-1 resize-none" rows={3}
              placeholder="What do you work on? What's your focus area?" />
          </div>
        </div>
      )}

      {/* Organisation — org users only */}
      {profile?.user_type === "organisation" && (
      <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Organisation
        </p>
        <div>
          <Label className="text-sm font-medium">Organisation name</Label>
          <Input value={orgName} onChange={e => setOrgName(e.target.value)}
            className="mt-1 h-10" placeholder="e.g. Ashoka Foundation" />
        </div>
        <div>
          <Label className="text-sm font-medium">Organisation type</Label>
          <div className="mt-1 h-10 px-3 rounded-lg border border-border bg-muted/30 flex items-center">
            <span className="text-sm text-muted-foreground">
              {ORG_TYPE_OPTIONS.find(o => o.value === (profile?.org_type ?? orgType))?.label ?? "Not set"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Organisation type cannot be changed. Contact support if this is incorrect.
          </p>
        </div>
        {profile?.user_type === "organisation" && (
          <div>
            <Label className="text-sm font-medium">Organisation description</Label>
            <Textarea value={orgDescription} onChange={e => setOrgDescription(e.target.value)}
              className="mt-1 resize-none" rows={4}
              placeholder="What does your organisation do, where does it work, and who does it serve?" />
            <p className="text-xs text-muted-foreground mt-1.5">
              Shown on your directory profile and used by AI to match you with relevant partners.
            </p>
          </div>
        )}
        {profile?.user_type === "organisation" && (
          <div>
            <Label className="text-sm font-medium">Country</Label>
            <CountryPicker value={country} onChange={setCountry} />
          </div>
        )}
      </div>
      )}

      {/* Focus areas */}
      <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Focus areas
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Used to match you with relevant initiatives and partners.
          </p>
        </div>
        <div>
          <Label className="text-sm font-medium">Sectors</Label>
          <SectorChips selected={sectors} onChange={setSectors} />
          {sectors.length > 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              {sectors.length} selected
            </p>
          )}
        </div>
      </div>

      {/* Online presence */}
      <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Online presence
        </p>
        <div className="grid grid-cols-2 gap-4">
          {profile?.user_type !== "organisation" && (
            <div>
              <Label className="text-sm font-medium">LinkedIn</Label>
              <Input value={linkedinUrl} onChange={e => setLinkedinUrl(e.target.value)}
                className="mt-1 h-10" placeholder="https://linkedin.com/in/..." type="url" />
            </div>
          )}
          <div>
            <Label className="text-sm font-medium">Website or portfolio</Label>
            <Input value={website} onChange={e => setWebsite(e.target.value)}
              className="mt-1 h-10" placeholder="https://yourwebsite.org" type="url" />
          </div>
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

      {/* DD Readiness — implementers only */}
      {!["philanthropic_foundation", "venture_capital", "corporation", "technology_company", "public_sector"].includes(profile?.org_type ?? "") && profile?.user_type === "organisation" && (
        <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Due diligence readiness
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Signal to funders that you are investment-ready. Checked items appear as a readiness score on your profile.
            </p>
          </div>
          <div className="space-y-3">
            {[
              { label: "Financial model available", sub: "A current financial model or projections document", state: ddFinancialModel, set: setDdFinancialModel },
              { label: "Audited accounts on file", sub: "Most recent audited financial statements", state: ddAuditedAccounts, set: setDdAuditedAccounts },
              { label: "Governance documentation", sub: "Board structure, org chart, or governance policy", state: ddGovernanceDoc, set: setDdGovernanceDoc },
              { label: "ESG self-assessment completed", sub: "Environmental, social and governance baseline assessment", state: ddEsgAssessment, set: setDdEsgAssessment },
              { label: "Impact measurement framework", sub: "Theory of change, IRIS+ alignment, or outcome tracking methodology", state: ddImpactFramework, set: setDdImpactFramework },
            ].map(item => (
              <button key={item.label} type="button"
                onClick={() => item.set(!item.state)}
                className={`w-full text-left px-4 py-3 rounded-xl border transition-colors flex items-start gap-3 ${
                  item.state ? "border-[#2D6A4F] bg-[#eaf5ee]" : "border-border hover:border-foreground/20"
                }`}>
                <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                  item.state ? "bg-[#2D6A4F] border-[#2D6A4F]" : "border-border"
                }`}>
                  {item.state && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${item.state ? "text-[#2D6A4F]" : "text-foreground"}`}>
                    {item.label}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.sub}</p>
                </div>
              </button>
            ))}
          </div>
          <div className="pt-2 border-t border-border">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground">DD Readiness score</p>
              <p className="text-xs font-bold text-foreground">
                {Math.round(([ddFinancialModel, ddAuditedAccounts, ddGovernanceDoc, ddEsgAssessment, ddImpactFramework].filter(Boolean).length / 5) * 100)}%
              </p>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-[#2D6A4F] transition-all duration-500"
                style={{ width: `${Math.round(([ddFinancialModel, ddAuditedAccounts, ddGovernanceDoc, ddEsgAssessment, ddImpactFramework].filter(Boolean).length / 5) * 100)}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* Impact & Track Record — implementers only */}
      {!["philanthropic_foundation", "venture_capital", "corporation", "technology_company", "public_sector"].includes(profile?.org_type ?? "") && profile?.user_type === "organisation" && (
        <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Impact & track record
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Help funders and corporates quickly understand your reach and credibility. All fields optional.
            </p>
          </div>

          {/* Cumulative reach */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Cumulative reach</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Total beneficiaries reached</Label>
                <Input value={totalBeneficiaries} onChange={e => setTotalBeneficiaries(e.target.value.replace(/[^0-9]/g, ""))}
                  className="mt-1 h-10" placeholder="e.g. 12400" />
              </div>
              <div>
                <Label className="text-sm font-medium">Jobs created</Label>
                <Input value={jobsCreated} onChange={e => setJobsCreated(e.target.value.replace(/[^0-9]/g, ""))}
                  className="mt-1 h-10" placeholder="e.g. 340" />
              </div>
              <div>
                <Label className="text-sm font-medium">Female beneficiaries %</Label>
                <Input value={femalePct} onChange={e => setFemalePct(e.target.value.replace(/[^0-9]/g, ""))}
                  className="mt-1 h-10" placeholder="e.g. 62" />
              </div>
              <div>
                <Label className="text-sm font-medium">Youth beneficiaries %</Label>
                <Input value={youthPct} onChange={e => setYouthPct(e.target.value.replace(/[^0-9]/g, ""))}
                  className="mt-1 h-10" placeholder="e.g. 45" />
              </div>
              <div>
                <Label className="text-sm font-medium">Years of operation</Label>
                <Input value={yearsOfOperation} onChange={e => setYearsOfOperation(e.target.value.replace(/[^0-9]/g, ""))}
                  className="mt-1 h-10" placeholder="e.g. 7" />
              </div>
            </div>
          </div>

          {/* Track record */}
          <div className="pt-4 border-t border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Track record</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Grants/contracts received (count)</Label>
                <Input value={grantsCount} onChange={e => setGrantsCount(e.target.value.replace(/[^0-9]/g, ""))}
                  className="mt-1 h-10" placeholder="e.g. 8" />
              </div>
              <div>
                <Label className="text-sm font-medium">Total grant value (USD)</Label>
                <Input value={grantsTotalValue} onChange={e => setGrantsTotalValue(e.target.value.replace(/[^0-9]/g, ""))}
                  className="mt-1 h-10" placeholder="e.g. 2400000" />
              </div>
              <div>
                <Label className="text-sm font-medium">Delivered on time %</Label>
                <Input value={grantsOnTimePct} onChange={e => setGrantsOnTimePct(e.target.value.replace(/[^0-9]/g, ""))}
                  className="mt-1 h-10" placeholder="e.g. 90" />
              </div>
            </div>
          </div>

          {/* Previous funders */}
          <div className="pt-4 border-t border-border">
            <Label className="text-sm font-medium">Previous funders / grant-makers</Label>
            <p className="text-xs text-muted-foreground mt-0.5 mb-2">Names only — e.g. USAID, Ford Foundation, FCDO</p>
            <div className="flex gap-2">
              <Input value={funderInput} onChange={e => setFunderInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const v = funderInput.trim();
                    if (v && !previousFunders.includes(v)) setPreviousFunders(p => [...p, v]);
                    setFunderInput("");
                  }
                }}
                className="h-10 flex-1" placeholder="Type funder name and press Enter" />
              <button type="button"
                onClick={() => {
                  const v = funderInput.trim();
                  if (v && !previousFunders.includes(v)) setPreviousFunders(p => [...p, v]);
                  setFunderInput("");
                }}
                className="h-10 px-3 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors shrink-0">
                Add
              </button>
            </div>
            {previousFunders.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {previousFunders.map(f => (
                  <span key={f} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-border text-muted-foreground">
                    {f}
                    <button type="button" onClick={() => setPreviousFunders(p => p.filter(x => x !== f))}
                      className="hover:opacity-70 ml-0.5">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Third-party evaluations */}
          <div className="pt-4 border-t border-border">
            <button type="button"
              onClick={() => setThirdPartyEvaluations(v => !v)}
              className={`w-full text-left px-4 py-3 rounded-xl border transition-colors flex items-start gap-3 ${
                thirdPartyEvaluations ? "border-[#2D6A4F] bg-[#eaf5ee]" : "border-border hover:border-foreground/20"
              }`}>
              <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                thirdPartyEvaluations ? "bg-[#2D6A4F] border-[#2D6A4F]" : "border-border"
              }`}>
                {thirdPartyEvaluations && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
              <div>
                <p className={`text-sm font-medium ${thirdPartyEvaluations ? "text-[#2D6A4F]" : "text-foreground"}`}>
                  Third-party evaluations available
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Independent audits, impact assessments, or evaluations conducted by external parties
                </p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Investment thesis — funders/corporates only */}
      {profile?.user_type === "organisation" && ["philanthropic_foundation", "venture_capital", "corporation", "technology_company", "public_sector"].includes(profile?.org_type ?? "") && (
        <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Investment thesis
          </p>
          <div>
            <Label className="text-sm font-medium">Describe your investment focus</Label>
            <Textarea
              value={investmentThesis}
              onChange={e => setInvestmentThesis(e.target.value)}
              className="mt-1 resize-none" rows={4}
              placeholder="e.g. We back early-stage climate adaptation initiatives in Sub-Saharan Africa, with a focus on smallholder agriculture and water security. We deploy grants of $50K–$500K and prioritise organisations with community-validated models..." />
            <p className="text-xs text-muted-foreground mt-1.5">Shown on your directory profile. Helps implementers, startups, and ecosystem actors understand your focus before reaching out. Also used by the AI to improve initiative matching.</p>
          </div>

          {/* Mandate fields */}
          <div className="pt-4 border-t border-border space-y-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mandate criteria</p>
            <p className="text-xs text-muted-foreground">Used for AI matching. Not shown publicly.</p>

            {/* Grant range */}
            {["philanthropic_foundation", "venture_capital"].includes(profile?.org_type ?? "") && (
              <div>
                <Label className="text-sm font-medium">Grant / investment range</Label>
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
            )}

            {/* Stage preference */}
            {["philanthropic_foundation", "venture_capital"].includes(profile?.org_type ?? "") && (
              <div>
                <Label className="text-sm font-medium">Stage preference</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {["Concept / Early stage", "Pilot / Proof of concept", "Growth / Scaling", "Mature / Established", "Core / Unrestricted"].map(s => (
                    <button key={s} type="button"
                      onClick={() => setStagePreference(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])}
                      className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${stagePreference.includes(s) ? "bg-[#2D6A4F] border-[#2D6A4F] text-white" : "border-border text-muted-foreground hover:border-foreground/30"}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Geographic focus */}
            <div>
              <Label className="text-sm font-medium">Geographic focus</Label>
              <div className="flex gap-2 mt-1">
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
                <div className="flex flex-wrap gap-1.5 mt-2">
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

            {/* CSR budget — corporates only */}
            {["corporation", "technology_company", "public_sector"].includes(profile?.org_type ?? "") && (
              <div>
                <Label className="text-sm font-medium">Annual CSR/ESG budget range</Label>
                <Input value={csrBudgetRange} onChange={e => setCsrBudgetRange(e.target.value)}
                  className="mt-1 h-10" placeholder="e.g. $500K–$2M" />
              </div>
            )}

            {/* Partner type preference — corporates only */}
            {["corporation", "technology_company", "public_sector"].includes(profile?.org_type ?? "") && (
              <div>
                <Label className="text-sm font-medium">Preferred partner types</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {["Registered Charity / NGO", "Social Enterprise / CIC / B Corp", "Research Institution / Academia", "Government / Public Sector", "Individual Practitioner"].map(p => (
                    <button key={p} type="button"
                      onClick={() => setPartnerTypePreference(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])}
                      className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${partnerTypePreference.includes(p) ? "bg-[#2D6A4F] border-[#2D6A4F] text-white" : "border-border text-muted-foreground hover:border-foreground/30"}`}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Contact details — org users only, shown last */}
      {profile?.user_type === "organisation" && (
        <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Contact details
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Shown to partners and funders who want to reach out directly.
            </p>
          </div>
          <div>
            <Label className="text-sm font-medium">
              Full name <span className="text-destructive">*</span>
            </Label>
            <Input value={fullName} onChange={e => setFullName(e.target.value)}
              className="mt-1 h-10" placeholder="e.g. Amara Osei" required />
          </div>
          <div>
            <Label className="text-sm font-medium">
              Role / Title <span className="text-muted-foreground font-normal text-xs">(optional)</span>
            </Label>
            <Input value={roleTitle} onChange={e => setRoleTitle(e.target.value)}
              className="mt-1 h-10" placeholder="e.g. Executive Director, Programme Manager" />
          </div>
          <div>
            <Label className="text-sm font-medium">Email</Label>
            <Input
              value={user?.email ?? ""}
              className="mt-1 h-10 opacity-60 cursor-not-allowed"
              readOnly
            />
            <p className="text-xs text-muted-foreground mt-1">Your sign-in email. Cannot be changed here.</p>
          </div>
          <div>
            <Label className="text-sm font-medium">
              Phone <span className="text-muted-foreground font-normal text-xs">(optional)</span>
            </Label>
            <Input value={phone} onChange={e => setPhone(e.target.value)}
              className="mt-1 h-10" placeholder="+234 800 000 0000" />
          </div>
          <div>
            <Label className="text-sm font-medium">
              LinkedIn <span className="text-muted-foreground font-normal text-xs">(optional)</span>
            </Label>
            <Input value={linkedinUrl} onChange={e => setLinkedinUrl(e.target.value)}
              className="mt-1 h-10" placeholder="https://linkedin.com/in/..." type="url" />
          </div>
        </div>
      )}

      {/* Verification — org users only */}
      {profile?.user_type === "organisation" && (
        <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Verification
            </p>
            {profile?.is_verified && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-[#2D6A4F]/10 text-[#2D6A4F]">
                <ShieldCheck className="w-3.5 h-3.5" />
                Verified
              </span>
            )}
          </div>

          {profile?.is_verified ? (
            <p className="text-sm text-muted-foreground">
              Your organisation is verified. No further action is required for now. A badge appears on your profile, listings, and activity across the platform.
            </p>
          ) : profile?.verification_requested ? (
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">Verification pending</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Your documents are under review. This takes less than 48 hours.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-foreground">Not verified</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Verified organisations get a badge on all activity, priority placement in the partner directory, and a credibility multiplier on Impact Points.
                </p>
              </div>
              <Link href="/verify">
                <Button variant="outline" className="shrink-0 rounded-full px-5 text-sm border-[#2D6A4F] text-[#2D6A4F] hover:bg-[#2D6A4F]/5">
                  Get verified
                </Button>
              </Link>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving}
          className="bg-[#2D6A4F] hover:bg-[#245c43] text-white rounded-full px-6">
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Save changes
        </Button>
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-[#2D6A4F]">
            <CheckCircle2 className="w-4 h-4" /> Saved
          </span>
        )}
      </div>
    </div>

    {/* Right column */}
    <div className="space-y-4" style={{top: "9.5rem" }}>

      {/* Profile strength */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Profile strength</p>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold text-foreground">{strengthScore}%</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: `${strengthColor}15`, color: strengthColor }}>
              {strengthLabel}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${strengthScore}%`, background: strengthColor }} />
          </div>
        </div>
        <div className="space-y-2">
          {[
            { label: "Full name", done: !!fullName },
            ...(profile?.user_type === "organisation"
              ? [{ label: "Organisation description", done: !!orgDescription }]
              : [
                  { label: "Headline", done: !!roleTitle },
                  { label: "Bio", done: !!bio },
                ]),
            { label: "Country", done: !!country },
            ...(profile?.user_type === "organisation"
              ? [{ label: "Organisation name", done: !!orgName }]
              : []),
            { label: "Sectors", done: sectors.length > 0 },
            { label: "Online presence", done: !!linkedinUrl || !!website },
            ...(profile?.user_type === "organisation"
              ? [{ label: "Organisation logo", done: !!logoUrl }]
              : [{ label: "Profile photo", done: !!profile?.avatar_url }]),
          ].map(item => (
            <div key={item.label} className="flex items-center gap-2">
              <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 ${item.done ? "bg-[#2D6A4F]" : "bg-muted"}`}>
                {item.done && (
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
              <span className={`text-xs ${item.done ? "text-foreground" : "text-muted-foreground"}`}>
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Visibility — org users only */}
      {profile?.user_type === "organisation" && (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Visibility</p>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full shrink-0 ${profile?.is_verified ? "bg-[#2D6A4F]" : "bg-muted-foreground/40"}`} />
            <span className="text-xs text-foreground">
              {profile?.is_verified ? "Verified organisation" : "Not yet verified"}
            </span>
          </div>
          {!profile?.is_verified && (
            profile?.verification_requested ? (
              <p className="text-xs text-muted-foreground opacity-50 cursor-not-allowed">
                Verification pending review
              </p>
            ) : (
              <a href="/verify" className="text-xs text-[#2D6A4F] hover:underline underline-offset-2">
                Apply for verification →
              </a>
            )
          )}
        </div>
      )}

      

      {/* Quick links */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Quick links</p>
        <a href="/dashboard/natives" className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-1">
          <ArrowRight className="w-3 h-3 text-[#2D6A4F]" />
          View your directory listing
        </a>
        <a href="/dashboard/settings" className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-1">
          <ArrowRight className="w-3 h-3 text-[#2D6A4F]" />
          Account settings
        </a>
        {profile?.user_type !== "organisation" && (
          <>
            <a href="/dashboard/marketplace" className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-1">
              <ArrowRight className="w-3 h-3 text-[#2D6A4F]" />
              Browse the marketplace
            </a>
            <a href="/dashboard/natives?tab=organisation" className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-1">
              <ArrowRight className="w-3 h-3 text-[#2D6A4F]" />
              Browse organisations
            </a>
          </>
        )}
        {profile?.user_type === "organisation" && (
          <a href="/verification-standard" className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-1">
            <ArrowRight className="w-3 h-3 text-[#2D6A4F]" />
            Verification standards
          </a>
        )}
      </div>

    </div>
    </div>
  );
}