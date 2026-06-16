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
import { Loader2, CheckCircle2, ShieldCheck, Camera } from "lucide-react";
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
const [saving, setSaving]           = useState(false);
  const [saved, setSavedState]        = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);

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
  const [orgName, setOrgName]           = useState(profile?.org_name      ?? "");
  const [roleTitle, setRoleTitle]       = useState(profile?.role_title    ?? "");
  const [phone, setPhone]               = useState(profile?.phone         ?? "");
  const [linkedinUrl, setLinkedinUrl]   = useState(profile?.linkedin_url  ?? "");
  const [website, setWebsite]           = useState(profile?.website       ?? "");
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
        updated_at:  new Date().toISOString(),
      })
      .eq("id", user.id);
    await refreshProfile();
    setSaving(false);
    setSavedState(true);
    setTimeout(() => setSavedState(false), 3000);
  }

  return (
    <div className="max-w-2xl space-y-8">
<div>
        <h2 className="text-2xl font-bold text-foreground tracking-tight">Profile</h2>
        <p className="text-sm text-muted-foreground mt-1">
          How you appear to partners and organisations across Natives.
        </p>
      </div>

      {/* Avatar upload */}
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

      {/* Basic info */}
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
        <div>
          <Label className="text-sm font-medium">Bio</Label>
          <Textarea value={bio} onChange={e => setBio(e.target.value)}
            className="mt-1 resize-none" rows={3}
            placeholder="What do you work on? What's your focus area?" />
        </div>
      </div>

      {/* Organisation */}
      <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Organisation
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-sm font-medium">Organisation name</Label>
            <Input value={orgName} onChange={e => setOrgName(e.target.value)}
              className="mt-1 h-10" placeholder="e.g. Ashoka Foundation" />
          </div>
          <div>
            <Label className="text-sm font-medium">Role / Title</Label>
            <Input value={roleTitle} onChange={e => setRoleTitle(e.target.value)}
              className="mt-1 h-10" placeholder="e.g. Programme Director" />
          </div>
        </div>
        <div>
          <Label className="text-sm font-medium">Organisation type</Label>
          <Select value={orgType} onValueChange={setOrgType}>
            <SelectTrigger className="mt-1 h-10">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {ORG_TYPE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-sm font-medium">Phone</Label>
          <Input value={phone} onChange={e => setPhone(e.target.value)}
            className="mt-1 h-10" placeholder="+234 800 000 0000" />
        </div>
      </div>

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
          <div>
            <Label className="text-sm font-medium">LinkedIn</Label>
            <Input value={linkedinUrl} onChange={e => setLinkedinUrl(e.target.value)}
              className="mt-1 h-10" placeholder="https://linkedin.com/in/..." type="url" />
          </div>
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
  );
}