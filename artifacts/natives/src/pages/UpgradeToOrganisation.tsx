// ─── UpgradeToOrganisation.tsx ─────────────────────────────────────────────────
// Allows an individual account to register an organisation without losing
// their existing profile, history, initiatives, or EOIs. Switches user_type
// from individual_creative to organisation and creates the organizations row.

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { useLocation, useSearch } from "wouter";
import { Loader2, Building2, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ORG_TYPE_FILTERS } from "@/lib/orgTypes";

// Pulled from the shared source instead of a local copy -- this file's own
// list was missing creative_agency_studio entirely. "consultancy" is
// excluded from the manual dropdown since that path is locked
// automatically in consultancy mode below, not offered as a free choice.
const ORG_TYPES = ORG_TYPE_FILTERS.filter(t => t.value !== "consultancy");

const SECTOR_OPTIONS = [
  "Health", "Education", "Agriculture & Food Systems", "Climate & Environment",
  "Energy & Clean Tech", "Water, Sanitation & Hygiene", "Financial Inclusion",
  "Gender & Inclusion", "Governance & Civic Tech", "Livelihoods & Economic Empowerment",
  "Technology & Innovation", "Arts, Culture & Creative Industries",
  "Humanitarian & Emergency Response", "Youth & Community Development",
];

export default function UpgradeToOrganisation() {
  const { user, profile, refreshProfile } = useAuth();
  const [, navigate] = useLocation();
  const search = useSearch();
  const isConsultancyMode = new URLSearchParams(search).get("type") === "consultancy";

  const [orgName, setOrgName]         = useState(
    isConsultancyMode ? `${profile?.full_name ?? ""} Consulting`.trim() : (profile?.org_name ?? "")
  );
  const [orgType, setOrgType]         = useState(isConsultancyMode ? "consultancy" : "");
  const [country, setCountry]         = useState(profile?.country ?? "");
  const [website, setWebsite]         = useState(profile?.website ?? "");
  const [sectors, setSectors]         = useState<string[]>(profile?.sectors ?? []);
  const [description, setDescription] = useState("");

  const [saving, setSaving]   = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  function toggleSector(s: string) {
    setSectors(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  }

  const canSubmit = orgName.trim() && orgType && country.trim() && sectors.length > 0;

  async function handleSubmit() {
    if (!user || !canSubmit) return;
    setSaving(true);
    setError(null);

    try {
      // 1. Create the organizations row
      const { error: orgInsertError } = await supabase.from("organizations").insert({
        user_id:            user.id,
        organisation_name:  orgName.trim(),
        email:              user.email ?? null,
        website:            website || null,
        country:            country || null,
        sector:             sectors.length > 0 ? JSON.stringify(sectors) : null,
        organisation_type:  orgType,
        is_solo_consultancy: orgType === "consultancy",
        description:        description || null,
        status:             "published",
        verification_status: "not_requested",
        created_at:          new Date().toISOString(),
        updated_at:          new Date().toISOString(),
      });

      if (orgInsertError) {
        setError(orgInsertError.message);
        setSaving(false);
        return;
      }

      // 2. Switch the profile to organisation type and sync org_type
      const { error: profileUpdateError } = await supabase.from("profiles").update({
        user_type:   "organisation",
        org_name:    orgName.trim(),
        org_type:    orgType,
        country:     country || null,
        website:     website || null,
        sectors:     sectors.length > 0 ? sectors : null,
        // Consultancy conversions collapse to a single profile -- the
        // individual identity becomes the org, not a second listing
        // alongside it. The general org-upgrade path keeps both, since
        // that person's individual identity is genuinely separate from
        // the institution they're also registering.
        show_individual_profile: !isConsultancyMode,
        updated_at:  new Date().toISOString(),
      }).eq("id", user.id);

      if (profileUpdateError) {
        setError(profileUpdateError.message);
        setSaving(false);
        return;
      }

      await refreshProfile();
      setSuccess(true);
      setSaving(false);
    } catch (err) {
      setError(String(err));
      setSaving(false);
    }
  }

  if (success) {
    return (
      <div className="max-w-lg mx-auto py-16 px-6 text-center">
        <div className="w-14 h-14 rounded-full bg-[#eaf5ee] flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 className="w-7 h-7 text-[#2D6A4F]" />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">Organisation registered</h2>
        <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
          {isConsultancyMode
            ? `${orgName} is now live on Impact Natives. Your activity, connections, and history carry over. Going forward, this is how you'll appear on the platform.`
            : `${orgName} is now live on Impact Natives. Your individual profile is still visible in the Natives directory, tagged with your new organisation. You can manage both from your dashboard.`}
        </p>
        <Button onClick={() => navigate("/dashboard/profile")}
          className="bg-[#2D6A4F] hover:bg-[#245c43] text-white rounded-full px-6 h-10">
          Go to your profile
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto py-10 px-6 space-y-6">
      <button type="button" onClick={() => navigate("/dashboard/profile")}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to profile
      </button>

      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-[#eaf5ee] flex items-center justify-center shrink-0">
          <Building2 className="w-5 h-5 text-[#2D6A4F]" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">
            {isConsultancyMode ? "Register your consultancy" : "Register an organisation"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
            {isConsultancyMode
              ? "MoUs, milestones, and track record all require an organisation profile. Setting one up here takes a couple of minutes and doesn't require registering a separate legal entity."
              : "You'll keep your individual profile, activity, and connections. Your account simply gains an organisation alongside it."}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
        <div>
          <Label className="text-sm font-medium">
            Organisation name <span className="text-destructive">*</span>
          </Label>
          <Input value={orgName} onChange={e => setOrgName(e.target.value)}
            className="mt-1 h-10" placeholder="e.g. Splux" />
        </div>

        {isConsultancyMode ? (
          <div>
            <Label className="text-sm font-medium">Organisation type</Label>
            <div className="mt-1 h-10 px-3 rounded-lg border border-border bg-muted flex items-center text-sm text-muted-foreground">
              Consultancy
            </div>
          </div>
        ) : (
          <div>
            <Label className="text-sm font-medium">
              Organisation type <span className="text-destructive">*</span>
            </Label>
            <select value={orgType} onChange={e => setOrgType(e.target.value)}
              className="mt-1 w-full h-10 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
              <option value="">Select type</option>
              {ORG_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        )}

        <div>
          <Label className="text-sm font-medium">
            Country <span className="text-destructive">*</span>
          </Label>
          <Input value={country} onChange={e => setCountry(e.target.value)}
            className="mt-1 h-10" placeholder="e.g. Nigeria" />
        </div>

        <div>
          <Label className="text-sm font-medium">
            Website <span className="text-muted-foreground font-normal text-xs">(optional)</span>
          </Label>
          <Input value={website} onChange={e => setWebsite(e.target.value)}
            className="mt-1 h-10" placeholder="https://" type="url" />
        </div>

        <div>
          <Label className="text-sm font-medium">
            Sectors <span className="text-destructive">*</span>
          </Label>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {SECTOR_OPTIONS.map(s => (
              <button key={s} type="button" onClick={() => toggleSector(s)}
                className={`h-7 px-3 rounded-full text-xs font-medium border transition-colors ${
                  sectors.includes(s)
                    ? "bg-[#2D6A4F] border-[#2D6A4F] text-white"
                    : "border-border text-muted-foreground hover:border-[#2D6A4F]/40"
                }`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label className="text-sm font-medium">
            Description <span className="text-muted-foreground font-normal text-xs">(optional)</span>
          </Label>
          <Textarea value={description} onChange={e => setDescription(e.target.value)}
            className="mt-1" rows={4} placeholder="What does your organisation do?" />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>
        )}

        <Button type="button" onClick={handleSubmit} disabled={!canSubmit || saving}
          className="w-full h-11 bg-[#2D6A4F] hover:bg-[#245c43] text-white rounded-full font-semibold disabled:opacity-40">
          {saving
            ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Registering...</>
            : "Register organisation"}
        </Button>
      </div>
    </div>
  );
}
