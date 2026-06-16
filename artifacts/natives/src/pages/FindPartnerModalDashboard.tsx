// ─── FindPartnerModalDashboard.tsx ───────────────────────────────────────────
// 9 steps (0–8):
//   0: Have you identified partners? (Yes → org list, No → skip)
//   1: Where do you operate?
//   2: Which sectors?
//   3: Which SDGs?
//   4: Organisation type?
//   5: What do you need?
//   6: What can you offer?
//   7: Tell us about your organisation
//   8: Review & submit
// Pre-filled silently: org_name, email, website
// On submit: upsert organizations + insert partner_requests

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { ORG_TYPE_OPTIONS } from "@/lib/orgTypes";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useLocation } from "wouter";

import { SECTOR_OPTIONS as SECTORS } from "@/lib/sectors";

// ─── Constants ───────────────────────────────────────────────────────────────

const COUNTRIES = [
  "Nigeria", "Kenya", "Ghana", "South Africa",
  "Ethiopia", "Rwanda", "Senegal", "Other",
];


const NEEDS_OPTIONS = [
  "Funding", "Partnership", "Data",
  "Visibility", "Technical Assistance", "Networks",
];

const OFFERS_OPTIONS = [
  "Field access", "Data", "Networks",
  "Execution", "Funding", "Research",
];

const SDG_LIST = Array.from({ length: 17 }, (_, i) => i + 1);

const TOTAL_STEPS = 9;

// ─── Types ───────────────────────────────────────────────────────────────────

type OrgRow = { id: string; organisation_name: string; isFavorite?: boolean };
type RateLimitState = { blocked: boolean; resetsAt: Date | null };

type FormState = {
  organisation_name: string;
  email: string;
  website: string;
  country: string[];
  sectors: string[];
  sdgs: number[];
  organisation_type: string;
  needs: string[];
  offers: string[];
  description: string;
  has_identified_partners: boolean | null;
  selected_partners: string[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function stepClass(index: number, current: number) {
  if (index === current) return "tf-active";
  if (index < current)  return "tf-above";
  return "tf-below";
}

function CheckboxGroup({
  options, selected, onToggle,
}: {
  options: string[]; selected: string[]; onToggle: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap justify-center gap-2 max-w-md">
      {options.map((opt) => {
        const on = selected.includes(opt);
        return (
          <button
            key={opt} type="button" onClick={() => onToggle(opt)}
            className={`px-4 py-2 rounded-full border text-sm transition-all ${
              on
                ? "bg-foreground text-background border-foreground"
                : "bg-background text-foreground border-border hover:border-foreground/50"
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function FindPartnerModalDashboard({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [, navigate] = useLocation()

  const [profileLoading, setProfileLoading] = useState(true);
  const [step, setStep]       = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

    const [rateLimit, setRateLimit]         = useState<RateLimitState>({ blocked: false, resetsAt: null });
  const [publishedOrgs, setPublishedOrgs] = useState<OrgRow[]>([]);
  const [verificationStatus, setVerificationStatus] = useState<string | null>(null);
  const [hasOrg, setHasOrg]               = useState<boolean | null>(null);

  const [form, setForm] = useState<FormState>({
    organisation_name: "",
    email: "",
    website: "",
    country: [],
    sectors: [],
    sdgs: [],
    organisation_type: "",
    needs: [],
    offers: [],
    description: "",
    has_identified_partners: null,
    selected_partners: [],
  });

  // ─── Load on open ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user || !isOpen) return;

    async function init() {
      setProfileLoading(true);

      const [profileRes, rateRes, orgsRes, favRes, orgRow] = await Promise.all([
        supabase
          .from("profiles")
          .select("org_name, email, website")
          .eq("id", user!.id)
          .single(),

        supabase
          .from("partner_requests")
          .select("created_at")
          .eq("user_id", user!.id)
          .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .order("created_at", { ascending: true }),

        supabase
          .from("organizations")
          .select("id, organisation_name")
          .eq("status", "published"),

        supabase
          .from("favorites")
          .select("organization_id")
          .eq("user_id", user!.id),

        supabase
          .from("organizations")
          .select("verification_status")
          .eq("user_id", user!.id)
          .maybeSingle(),
      ]);

      if (profileRes.data) {
        setForm((p) => ({
          ...p,
          organisation_name: profileRes.data.org_name || "",
          email:             profileRes.data.email    || user!.email || "",
          website:           profileRes.data.website  || "",
        }));
      }

      const submissions = rateRes.data ?? [];
      if (submissions.length >= 3) {
        const oldest   = new Date(submissions[0].created_at);
        const resetsAt = new Date(oldest.getTime() + 24 * 60 * 60 * 1000);
        setRateLimit({ blocked: true, resetsAt });
      }

      const favoriteIds = new Set((favRes.data ?? []).map((f) => f.organization_id));
      const orgs: OrgRow[] = (orgsRes.data ?? []).map((o) => ({
        ...o,
        isFavorite: favoriteIds.has(o.id),
      }));
      orgs.sort((a, b) => Number(b.isFavorite) - Number(a.isFavorite));
      setPublishedOrgs(orgs);

            if (orgRow.data) {
        setVerificationStatus(orgRow.data.verification_status);
        setHasOrg(true);
      } else {
        setHasOrg(false);
      }

      setProfileLoading(false);
    }

    init();
  }, [user, isOpen]);

  if (!isOpen) return null;

  // ─── Helpers ───────────────────────────────────────────────────────────────

  function toggle(field: "country" | "sectors" | "needs" | "offers", value: string) {
    setForm((p) => {
      const has = p[field].includes(value);
      return { ...p, [field]: has ? p[field].filter((v) => v !== value) : [...p[field], value] };
    });
  }

  function toggleSdg(n: number) {
    setForm((p) => ({
      ...p,
      sdgs: p.sdgs.includes(n) ? p.sdgs.filter((s) => s !== n) : [...p.sdgs, n],
    }));
  }

  function togglePartner(id: string) {
    setForm((p) => {
      const has = p.selected_partners.includes(id);
      return {
        ...p,
        selected_partners: has
          ? p.selected_partners.filter((x) => x !== id)
          : [...p.selected_partners, id],
      };
    });
  }

  function next() { setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1)); }
  function prev() { setStep((s) => Math.max(s - 1, 0)); }

  // ─── Submit ────────────────────────────────────────────────────────────────

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

        // Only upsert organizations if no existing published/pending row
    const { data: existingOrg } = await supabase
      .from("organizations")
      .select("id, status")
      .eq("user_id", user.id)
      .maybeSingle();

    const proposedData = {
      organisation_name:      form.organisation_name,
      email:                  form.email,
      website:                form.website,
      country:                form.country,
      sector:                 form.sectors,
      sdgs:                   form.sdgs,
      organisation_type:      form.organisation_type,
      needs:                  form.needs,
      offers:                 form.offers,
      description:            form.description,
    };

    if (!existingOrg) {
      // First time — create the org row
      const { error: orgError } = await supabase.from("organizations").insert({
        ...proposedData,
        verification_consent:   "no",
        verification_status:    "not_requested",
        verification_documents: [],
        status:                 "pending",
        user_id:                user.id,
      });

      if (orgError) {
        setLoading(false);
        alert(orgError.message);
        return;
      }
    }
    // If org already exists, proposed changes go to partner_requests only
    // Admin will apply them on approval

    const { error: prError } = await supabase.from("partner_requests").insert({
      user_id:                 user.id,
      contact_name:            form.organisation_name,
      organisation_name:       form.organisation_name,
      email:                   form.email,
      has_identified_partners: form.has_identified_partners ?? false,
      selected_partners:       form.selected_partners,
      partner_sectors:         form.sectors,
      status:                  "pending",
      proposed_data:           proposedData,
    });

    setLoading(false);
    if (prError) {
      console.error('partner_requests insert error:', prError);
      alert(prError.message);
    } else {

      setSubmitted(true);
    }
  }

  // ─── Steps ─────────────────────────────────────────────────────────────────
  // key must match the step index (0–8) exactly — this is what drives animation

  const steps = [

    // ── 0: Have you identified partners? ─────────────────────────────────────
    {
      key: 0,
      content: (
        <div className="flex flex-col items-center gap-6 w-full max-w-md">
          <p className="text-sm text-muted-foreground">1 of {TOTAL_STEPS}</p>
          <h2 className="text-3xl font-semibold text-center">
            Have you identified potential partners?
          </h2>
          <p className="text-sm text-muted-foreground text-center">
            We'll help surface relevant organisations either way.
          </p>

          <div className="flex gap-4">
            {(["Yes", "No"] as const).map((opt) => {
              const val    = opt === "Yes";
              const active = form.has_identified_partners === val;
              return (
                <button
                  key={opt} type="button"
                  onClick={() => {
                    setForm((p) => ({ ...p, has_identified_partners: val }));
                    if (!val) setTimeout(() => next(), 300);
                  }}
                  className={`px-8 py-3 rounded-full border text-sm transition-all ${
                    active
                      ? "bg-foreground text-background border-foreground"
                      : "bg-background text-foreground border-border hover:border-foreground/50"
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>

          {form.has_identified_partners === true && (
            <div className="w-full flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                Select the organisations you have in mind:
              </p>
              <div className="flex flex-col gap-0.5 max-h-52 overflow-y-auto border border-border rounded-xl p-3">
                {publishedOrgs.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2 text-center">
                    No published organisations yet.
                  </p>
                ) : (
                  publishedOrgs.map((org) => {
                    const checked = form.selected_partners.includes(org.id);
                    return (
                      <label
                        key={org.id}
                        className="flex items-center gap-3 py-2 cursor-pointer hover:bg-muted/40 rounded-lg px-2"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => togglePartner(org.id)}
                          className="accent-foreground"
                        />
                        <span className="text-sm text-foreground">
                          {org.organisation_name}
                          {org.isFavorite && (
                            <span className="ml-2 text-xs text-amber-500">★</span>
                          )}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
              <Button type="button" onClick={next}>
                Next →
              </Button>
            </div>
          )}
        </div>
      ),
    },

    // ── 1: Where do you operate? ──────────────────────────────────────────────
    {
      key: 1,
      content: (
        <div className="flex flex-col items-center gap-6 w-full max-w-md">
          <p className="text-sm text-muted-foreground">2 of {TOTAL_STEPS}</p>
          <h2 className="text-3xl font-semibold text-center">Where do you operate?</h2>
          <p className="text-sm text-muted-foreground">Select all that apply</p>
          <CheckboxGroup
            options={COUNTRIES}
            selected={form.country}
            onToggle={(v) => toggle("country", v)}
          />
          <Button type="button" onClick={next} disabled={form.country.length === 0}>
            Next →
          </Button>
        </div>
      ),
    },

    // ── 2: Which sectors? ─────────────────────────────────────────────────────
    {
      key: 2,
      content: (
        <div className="flex flex-col items-center gap-6 w-full max-w-md">
          <p className="text-sm text-muted-foreground">3 of {TOTAL_STEPS}</p>
          <h2 className="text-3xl font-semibold text-center">Which sectors?</h2>
          <p className="text-sm text-muted-foreground">Select all that apply</p>
          <CheckboxGroup
            options={SECTORS}
            selected={form.sectors}
            onToggle={(v) => toggle("sectors", v)}
          />
          <Button type="button" onClick={next} disabled={form.sectors.length === 0}>
            Next →
          </Button>
        </div>
      ),
    },

    // ── 3: SDGs ───────────────────────────────────────────────────────────────
    {
      key: 3,
      content: (
        <div className="flex flex-col items-center gap-6 w-full max-w-md">
          <p className="text-sm text-muted-foreground">4 of {TOTAL_STEPS}</p>
          <h2 className="text-3xl font-semibold text-center">
            Which SDGs does your work address?
          </h2>
          <p className="text-sm text-muted-foreground">Select all that apply</p>
          <div className="flex flex-wrap justify-center gap-2 max-w-lg">
            {SDG_LIST.map((n) => {
              const on = form.sdgs.includes(n);
              return (
                <button
                  key={n} type="button" onClick={() => toggleSdg(n)}
                  className={`px-3 py-1.5 rounded-full border text-sm transition-all ${
                    on
                      ? "bg-foreground text-background border-foreground"
                      : "bg-background text-foreground border-border hover:border-foreground/50"
                  }`}
                >
                  SDG {n}
                </button>
              );
            })}
          </div>
          <Button type="button" onClick={next} disabled={form.sdgs.length === 0}>
            Next →
          </Button>
        </div>
      ),
    },

    // ── 4: Org type ───────────────────────────────────────────────────────────
    {
      key: 4,
      content: (
        <div className="flex flex-col items-center gap-6 w-full max-w-md">
          <p className="text-sm text-muted-foreground">5 of {TOTAL_STEPS}</p>
          <h2 className="text-3xl font-semibold text-center">Organisation type?</h2>
          <div className="w-full">
            <Select
              onValueChange={(val) =>
                setForm((p) => ({ ...p, organisation_type: val }))
              }
              value={form.organisation_type}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {ORG_TYPE_OPTIONS.map((t) => (
                  <SelectItem
                    key={t}
                    value={t.toLowerCase().replace(/[\s/]+/g, "_")}
                  >
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="button" onClick={next} disabled={!form.organisation_type}>
            Next →
          </Button>
        </div>
      ),
    },

    // ── 5: Needs ──────────────────────────────────────────────────────────────
    {
      key: 5,
      content: (
        <div className="flex flex-col items-center gap-6 w-full max-w-md">
          <p className="text-sm text-muted-foreground">6 of {TOTAL_STEPS}</p>
          <h2 className="text-3xl font-semibold text-center">What do you need?</h2>
          <p className="text-sm text-muted-foreground">Select all that apply</p>
          <CheckboxGroup
            options={NEEDS_OPTIONS}
            selected={form.needs}
            onToggle={(v) => toggle("needs", v)}
          />
          <Button type="button" onClick={next} disabled={form.needs.length === 0}>
            Next →
          </Button>
        </div>
      ),
    },

    // ── 6: Offers ─────────────────────────────────────────────────────────────
    {
      key: 6,
      content: (
        <div className="flex flex-col items-center gap-6 w-full max-w-md">
          <p className="text-sm text-muted-foreground">7 of {TOTAL_STEPS}</p>
          <h2 className="text-3xl font-semibold text-center">What can you offer?</h2>
          <p className="text-sm text-muted-foreground">Select all that apply</p>
          <CheckboxGroup
            options={OFFERS_OPTIONS}
            selected={form.offers}
            onToggle={(v) => toggle("offers", v)}
          />
          <Button type="button" onClick={next} disabled={form.offers.length === 0}>
            Next →
          </Button>
        </div>
      ),
    },

    // ── 7: Description ────────────────────────────────────────────────────────
    {
      key: 7,
      content: (
        <div className="flex flex-col items-center gap-6 w-full max-w-md">
          <p className="text-sm text-muted-foreground">8 of {TOTAL_STEPS}</p>
          <h2 className="text-3xl font-semibold text-center">
            Tell us about your organisation
          </h2>
          <p className="text-sm text-muted-foreground text-center">
            A short description of what you do and why you want to find a partner.
          </p>
          <Textarea
            className="w-full min-h-[120px]"
            placeholder="We are..."
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          />
          <Button type="button" onClick={next} disabled={!form.description.trim()}>
            Next →
          </Button>
        </div>
      ),
    },

    // ── 8: Review & submit ────────────────────────────────────────────────────
    {
      key: 8,
      content: (
        <div className="flex flex-col items-center gap-4 w-full max-w-md h-full">
          <p className="text-sm text-muted-foreground">9 of {TOTAL_STEPS}</p>
          <h2 className="text-3xl font-semibold text-center">Review & submit</h2>

          {/* Scrollable review card */}
          <div className="w-full overflow-y-auto rounded-xl border border-border bg-card px-4 divide-y divide-border text-sm"
            style={{ maxHeight: "38vh" }}>
            {[
              { label: "Organisation", value: form.organisation_name || "—" },
              { label: "Countries",    value: form.country.join(", ") || "—" },
              { label: "Sectors",      value: form.sectors.join(", ") || "—" },
              { label: "SDGs",         value: form.sdgs.map((n) => `SDG ${n}`).join(", ") || "—" },
              { label: "Type",         value: form.organisation_type?.replace(/_/g, " ") || "—" },
              { label: "Needs",        value: form.needs.join(", ") || "—" },
              { label: "Offers",       value: form.offers.join(", ") || "—" },
              {
                label: "Partners identified",
                value: form.has_identified_partners ? "Yes" : "No",
              },
              ...(form.selected_partners.length > 0
                ? [{
                    label: "Selected partners",
                    value: form.selected_partners
                      .map((id) => publishedOrgs.find((o) => o.id === id)?.organisation_name ?? id)
                      .join(", "),
                  }]
                : []),
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between gap-4 py-2.5">
                <span className="text-muted-foreground shrink-0">{label}</span>
                <span className="text-foreground text-right">{value}</span>
              </div>
            ))}
          </div>

          {/* Warning + button — spaced well clear of Back arrow */}
          <div className="w-full flex flex-col gap-3 mt-2 mb-20">
            {verificationStatus && verificationStatus !== "verified" && (
              <div className="rounded-xl border border-yellow-400/40 bg-yellow-400/10 px-4 py-3 text-sm text-yellow-700 dark:text-yellow-300">
                Your organisation is not yet verified. You can still submit, but
                verified profiles get priority in matching.
              </div>
            )}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Submitting...
                </span>
              ) : (
                "Add to ecosystem"
              )}
            </Button>
          </div>
        </div>
      ),
    },
  ];

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-50 bg-background flex flex-col"
      style={{ animation: "slideUp 0.35s cubic-bezier(0.4,0,0.2,1) forwards" }}
    >
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        .tf-step {
          position: absolute; inset: 0;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          gap: 0; padding: 2rem;
          transition: transform 0.45s cubic-bezier(0.4,0,0.2,1), opacity 0.45s;
          overflow-y: auto;
        }
        .tf-active { transform: translateY(0);     opacity: 1; }
        .tf-above  { transform: translateY(-100%); opacity: 0; pointer-events: none; }
        .tf-below  { transform: translateY(100%);  opacity: 0; pointer-events: none; }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
        <span className="text-sm font-medium">Get Matched</span>
        <button
          type="button" onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors text-sm"
        >
          ✕ Close
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-0.5 bg-muted shrink-0">
        <div
          className="h-full bg-foreground transition-all duration-300"
          style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }}
        />
      </div>

      {/* Body */}
      {profileLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-[#2D6A4F] animate-spin" />
        </div>

            ) : hasOrg === false ? (
              <div className="flex flex-col items-center justify-center flex-1 gap-5 text-center px-6">
              <h2 className="text-2xl font-semibold">Get Matched is for organisations</h2>
              <p className="text-muted-foreground max-w-sm">
                Get Matched connects verified organisations with the right partners.
                If you represent an organisation, create an org account to access this feature.
              </p>
              <div className="flex gap-3">
                <Button variant="outline" onClick={onClose}>Close</Button>
                <Button onClick={() => { onClose(); navigate("/signup"); }}>
                  Create an org account
                </Button>
              </div>
            </div>
      ) : rateLimit.blocked ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-5 text-center px-6">
          <h2 className="text-2xl font-semibold">You've reached the daily limit</h2>
          <p className="text-muted-foreground max-w-sm">
            You can submit up to 3 match requests every 24 hours. Try again after{" "}
            {rateLimit.resetsAt?.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
            .
          </p>
          <Button onClick={onClose}>Close</Button>
        </div>

      ) : submitted ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-5 text-center px-6">
          <h2 className="text-3xl font-semibold">You're in the ecosystem.</h2>
          <p className="text-muted-foreground max-w-sm">
            Your organisation profile has been submitted. The team will review it
            within 5 business days.
          </p>
          <Button onClick={onClose}>Close</Button>
        </div>

      ) : (
        <form
          onSubmit={submit}
          className="relative flex-1 overflow-hidden"
          onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
        >
          {steps.map(({ key, content }) => (
            <div key={key} className={`tf-step ${stepClass(key, step)}`}>
              {content}
            </div>
          ))}

          {/* Back navigation — fixed to bottom, clear of submit button */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 z-10">
            {step > 0 && (
              <button
                type="button" onClick={prev}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                ↑ Back
              </button>
            )}
            <span className="text-xs text-muted-foreground">
              {step + 1} / {TOTAL_STEPS}
            </span>
          </div>
        </form>
      )}
    </div>
  );
}