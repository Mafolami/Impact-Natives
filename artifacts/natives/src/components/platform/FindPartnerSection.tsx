import { useState, useEffect } from "react";
import { ArrowRight, ShieldCheck, Zap, Network, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes"
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "wouter";
import { FindPartnerModal } from "@/components/platform/FindPartnerModal";
import { supabase } from "@/lib/supabase";
import { SECTOR_OPTIONS } from "@/lib/sectors";
import { ORG_TYPE_OPTIONS } from "@/lib/orgTypes";

// ─── Types ────────────────────────────────────────────────────────────────────
interface OrgRow {
  id: string;
  organisation_name: string;
  description: string;
  sector: string | string[];
  country: string | string[];
  organisation_type: string;
  website?: string;
  email?: string;
  needs?: string[];
  offers?: string[];
  sdgs?: string[];
  verification_status: string;
  status: string;
}

function normalizeArr(val: string | string[] | null | undefined): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === "string" && val.startsWith("{") && val.endsWith("}")) {
    const inner = val.slice(1, -1);
    const matches = inner.match(/("(?:[^"\\]|\\.)*"|[^,]+)/g) ?? [];
    return matches.map(m => m.replace(/^"|"$/g, "").trim()).filter(Boolean);
  }
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : [val];
  } catch {
    return [val];
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────
const VALUE_PROPS = [
  {
    icon: <ShieldCheck className="w-5 h-5" />,
    headline: "Verified partners only",
    body: "Every organisation passes through a structured trust review — legal standing, track record, sector credibility. Verified organisations are clearly identified and prioritised in matching.",
    accent: "#2D6A4F",
  },
  {
    icon: <Network className="w-5 h-5" />,
    headline: "AI-matched to your profile",
    body: "Submit a brief describing what you need. AI analyses your sector, geography, SDG focus, and stated goals to surface the organisations most likely to be the right fit — in seconds, not months.",
    accent: "#B85C38",
  },
  {
    icon: <Zap className="w-5 h-5" />,
    headline: "From match to confirmed partnership",
    body: "Every match moves through a structured lifecycle — expression of interest, conversation, and confirmed partnership — with a full record on both sides.",
    accent: "#1a4a2e",
  },
];

const COUNTRY_OPTIONS = ["Nigeria", "Kenya", "Ghana", "South Africa", "Uganda"];

// ─── Main Component ───────────────────────────────────────────────────────────
export function FindPartnerSection() {
  const [open, setOpen]               = useState(false);
  const [search, setSearch]           = useState("");
  const [sectorFilter, setSectorFilter]   = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [typeFilter, setTypeFilter]       = useState("");
  const [verifiedOnly, setVerifiedOnly]   = useState(false);
  const [sdgFilter, setSdgFilter]         = useState<number[]>([]);
  const [orgs, setOrgs]               = useState<OrgRow[]>([]);
  const [loading, setLoading]         = useState(true);

  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true) }, []);
  const [, navigate] = useLocation();

  // ── Fetch published orgs ──────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, organisation_name, description, sector, country, organisation_type, website, email, needs, offers, sdgs, verification_status, status")
        .eq("status", "published")
        .eq("partnership_listed", true)
        .order("created_at", { ascending: false });
      if (error) console.error("FindPartnerSection orgs error:", error);
      if (data) setOrgs(data as OrgRow[]);
      setLoading(false);
    }
    load();
  }, []);

  // ── Client-side filtering ─────────────────────────────────────────────────
  const filtered = orgs.filter((org) => {
    const sectors   = normalizeArr(org.sector);
    const countries = normalizeArr(org.country);

    if (verifiedOnly && org.verification_status !== "verified") return false;

    if (sectorFilter && !sectors.some(s => s.toLowerCase().includes(sectorFilter.toLowerCase()))) return false;

    if (countryFilter && !countries.some(c => c.toLowerCase().includes(countryFilter.toLowerCase()))) return false;

    if (typeFilter && !org.organisation_type?.toLowerCase().includes(typeFilter.toLowerCase())) return false;

    if (sdgFilter.length > 0) {
      const orgSdgs = (org.sdgs ?? []).map(Number);
      if (!sdgFilter.every(s => orgSdgs.includes(s))) return false;
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      const matchesName    = org.organisation_name?.toLowerCase().includes(q);
      const matchesDesc    = org.description?.toLowerCase().includes(q);
      const matchesCountry = countries.some(c => c.toLowerCase().includes(q));
      const matchesSector  = sectors.some(s => s.toLowerCase().includes(q));
      if (!matchesName && !matchesDesc && !matchesCountry && !matchesSector) return false;
    }

    return true;
  });

  return (
    <>
      {open && <FindPartnerModal onClose={() => setOpen(false)} />}
      <section
        className="mt-0 pt-0 pb-0 px-0 w-full text-neutral-900 dark:text-neutral-100"
        aria-labelledby="find-partner-heading"
      >
        <div className="w-full">

          {/* Top: headline + offer statement */}
          <div
            className="px-6 sm:px-16 pb-4 text-center border-b border-white/10"
            style={{
              width: '100vw',
              marginLeft: 'calc(-50vw + 50%)',
              marginTop: '-64px',
              paddingTop: 'calc(64px + 12rem)',
              paddingBottom: '12rem',
              background: 'linear-gradient(135deg, #0a0e14 0%, #0d1f0f 20%, #1a0e0a 40%, #0e1a2e 60%, #1a0d0a 80%, #0a1410 100%)',
              backgroundSize: '400% 400%',
              animation: 'fp-chameleon 12s ease infinite',
            }}
          >
            <p className="text-3xl font-semibold uppercase mb-3" style={{ fontFamily: "'Syne', sans-serif", color: 'rgba(247,243,237,0.5)' }}>
              Find a Partner
            </p>
            <h2
              id="find-partner-heading"
              className="text-3xl md:text-5xl font-bold py-2"
              style={{ color: '#ffffff' }}
            >
              Stop wasting months on the wrong partner.
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.75)' }} className="font-light text-1xl py-8">
              Get introduced to and match with verified organisations, funders, founders, and experts that
              fit your sector, geography, goals, and capacity. Before you spend time on cold outreach, due diligence, and failed conversations,
            </p>
            <div className="flex items-center justify-center gap-4 py-8">
              <Button
                onClick={() => setOpen(true)}
                className="px-8 py-3 text-white font-semibold rounded-3xl text-sm bg-[#B85C38] border-none hover:bg-[#a34e2e]"
              >
                Get Matched
              </Button>
              <Button
                variant="outline"
                className="px-8 py-3 font-semibold text-sm border-neutral-400 rounded-3xl dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 hover:border-[#2D6A4F] hover:text-[#2D6A4F] dark:hover:text-[#52B788]"
                onClick={() => document.getElementById("partner-directory")?.scrollIntoView({ behavior: "smooth" })}
              >
                Explore Partners
              </Button>
            </div>
          </div>

          {/* Value Props */}
          <div className="grid md:grid-cols-3 gap-0 divide-y md:divide-y-0 md:divide-x divide-neutral-300 dark:divide-white/10 px-6 sm:px-10 lg:px-16">            {VALUE_PROPS.map((vp) => (
              <div
                key={vp.headline}
                className="group relative px-8 py-12 flex flex-col gap-5 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors duration-300"
              >
                <div
                  className="absolute top-0 left-0 right-0 h-[3px] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ background: vp.accent }}
                />
                <div
                  className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: `${vp.accent}18`, border: `1px solid ${vp.accent}35`, color: vp.accent }}
                >
                  {vp.icon}
                </div>
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold tracking-wide uppercase text-neutral-900 dark:text-neutral-100">
                    {vp.headline}
                  </h3>
                  <p className="text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
                    {vp.body}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-neutral-300 dark:border-white/10" />

          {/* ── Partner Directory ── */}
          <div id="partner-directory" className="space-y-8 animate-in fade-in duration-500 py-16 px-6 sm:px-18 lg:px-24">
            <div className="flex flex-col gap-4 mb-10">
              <h1 className="text-4xl font-bold">Partner Directory</h1>
              <p className="text-muted-foreground max-w-2xl leading-relaxed">
                Verified NGOs, corporates, funders, and social enterprises actively seeking partnerships across Africa. 
                The organisations listed here have passed a structured trust review — and they are looking for exactly what you bring.
              </p>
            </div>

            {/* Filters removed for public view */}
            {/* Directory listing */}
            <div className="border border-neutral-200 dark:border-white/10 rounded-lg overflow-hidden relative">
              {loading ? (
                <div className="py-16 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-[#2D6A4F]" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-12 text-center px-6 space-y-2">
                  <p className="text-sm font-medium text-foreground">No organisations match your search.</p>
                  <p className="text-sm text-muted-foreground">Try adjusting your filters, or <a href="/signup" className="text-[#2D6A4F] hover:underline underline-offset-2 font-medium">create an account</a> to see the full directory.</p>
                </div>
              ) : (
                <div className="relative">
                  {/* Show first card clearly, blur the rest for guests */}
                  <div className="divide-y divide-neutral-200 dark:divide-white/10">
                    {filtered.slice(0, 1).map((org) => (
                      <PublicOrgCard key={org.id} org={org} />
                    ))}
                  </div>

                  {filtered.length > 1 && (
                    <div className="relative">
                      <div style={{ height: '220px' }} />

                      {/* Overlay CTA */}
                      <div
                        className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center px-6"
                        style={{
                          background: 'linear-gradient(to bottom, transparent 0%, hsl(var(--background) / 0.95) 35%)',
                        }}
                      >
                        <div className="max-w-sm">
                          <p className="text-lg font-bold text-neutral-900 mb-2">
                            Find your next partner
                          </p>
                          <p className="text-sm text-neutral-500 mb-5 leading-relaxed">
                            Create a free account to access the full directory and connect directly.
                          </p>
                          <div className="flex flex-col sm:flex-row gap-3 justify-center">
                            <Button
                              onClick={() => navigate('/signup')}                              
                              className="px-6 py-2.5 text-white font-semibold rounded-full text-sm bg-[#2D6A4F] border-none hover:bg-[#245c43]"
                            >
                              See all partners
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => navigate('/signin')}
                              className="px-6 py-2.5 font-semibold rounded-full text-sm"
                            >
                              Sign in
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-neutral-300 dark:border-white/10" />

          {/* Partnership Lifecycle */}
          <div data-reveal className="py-6 px-6 sm:px-10 lg:px-16 bg-white dark:bg-neutral-900">
            <div className="max-w-7xl mx-auto">
              <div className="w-full rounded-3xl py-24 px-10">
                <h2 className="text-5xl font-bold mb-4 text-center">Partnership Lifecycle</h2>
                <p className="text-center mb-16 max-w-3xl mx-auto text-neutral-500 dark:text-neutral-400">
                  Every Natives partnership follows a structured path from discovery to verified impact.
                </p>
                <div className="relative w-full">
                  <div
                    className="absolute top-5 left-0 right-0 h-0.5 hidden md:block"
                    style={{ background: "rgba(0,0,0,0.1)" }}
                  />
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-8 relative">
                    {[
                      { step: "Discovery",     desc: "Find verified partners" },
                      { step: "Request",       desc: "Initiate collaboration" },
                      { step: "Match",         desc: "Connect and co-develop" },
                      { step: "Execution",     desc: "Deliver together" },
                      { step: "Impact Report", desc: "Verify outcomes" },
                    ].map((item, i) => (
                      <div key={item.step} className="flex flex-col items-center text-center group">
                        <div
                          className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold mb-4 z-10 transition-all duration-300 group-hover:scale-110 text-white"
                          style={{
                            background: i === 4
                              ? "linear-gradient(135deg, #B85C38 0%, #d4784f 100%)"
                              : "linear-gradient(135deg, #0d2b1a 0%, #1a4a2e 100%)",
                            border: "2px solid rgba(255,255,255,0.2)",
                          }}
                        >
                          {i + 1}
                        </div>
                        <p className="text-sm font-semibold mb-1">{item.step}</p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">{item.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom CTA */}
          <div className="px-6 sm:px-10 lg:px-16 py-20 flex flex-col items-center justify-center gap-7 bg-neutral-100 dark:bg-black/25 border-t border-neutral-300 dark:border-white/10 text-center">
            <p className="text-lg max-w-2xl mx-auto leading-relaxed text-neutral-600 dark:text-neutral-400">
              If your organisation isn't listed, qualified partners searching for a match based on sector, geography, goals, and delivery
              capability cannot discover or evaluate you through the network. So get matched with verified partners that
              fit your goals before you waste time on the wrong ones.
            </p>
            <Button
              onClick={() => setOpen(true)}
              className="shrink-0 flex items-center gap-2 px-8 py-4 text-white rounded-3xl font-semibold text-base bg-[#B85C38] border-none hover:bg-[#a34e2e]"
            >
              Find Your Partner <ArrowRight className="w-4 h-4" />
            </Button>
          </div>

        </div>
      </section>
    </>
  );
}

// ─── Public Org Card ──────────────────────────────────────────────────────────
function PublicOrgCard({ org }: { org: OrgRow }) {
  const isVerified = org.verification_status === "verified";
  const sectors    = normalizeArr(org.sector);
  const countries  = normalizeArr(org.country);

  return (
    <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-start gap-4 hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors">
      {/* Left: name + meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <p className="font-semibold text-foreground">{org.organisation_name}</p>
          {isVerified && (
            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
              style={{ background: "#eaf5ee", color: "#2D6A4F" }}>
              <ShieldCheck className="w-3 h-3" />
              Verified
            </span>
          )}
          {sectors.length > 0 && (
            <span className="text-xs px-2.5 py-0.5 rounded-full border border-border text-muted-foreground">
              {sectors[0]}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mb-2 capitalize">
          {org.organisation_type?.replace(/_/g, " ")}
          {countries.length > 0 && ` · ${countries.join(", ")}`}
        </p>
        {org.description && (
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2 max-w-2xl">
            {org.description}
          </p>
        )}
        {/* Needs / Offers */}
        {((org.needs && org.needs.length > 0) || (org.offers && org.offers.length > 0)) && (
          <div className="flex gap-4 text-xs mt-2">
            {org.needs && org.needs.length > 0 && (
              <div>
                <span className="text-muted-foreground font-medium">Needs: </span>
                <span className="text-foreground">{org.needs.slice(0, 3).join(", ")}</span>
              </div>
            )}
            {org.offers && org.offers.length > 0 && (
              <div>
                <span className="text-muted-foreground font-medium">Offers: </span>
                <span className="text-foreground">{org.offers.slice(0, 3).join(", ")}</span>
              </div>
            )}
          </div>
        )}
      </div>
      {/* Right: website + SDGs */}
      <div className="flex flex-col items-end gap-2 shrink-0">
        {org.website && org.website !== "https://" && (
          <a href={org.website} target="_blank" rel="noopener noreferrer"
            className="text-xs text-[#2D6A4F] hover:underline">
            {org.website.replace(/^https?:\/\//, "")}
          </a>
        )}
        {org.sdgs && org.sdgs.length > 0 && (
          <div className="flex gap-1 flex-wrap justify-end">
            {org.sdgs.map(sdg => (
              <span key={sdg} className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                style={{ background: "#eaf5ee", color: "#2D6A4F" }}>
                SDG {sdg}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}