import { Check, Sparkles, Minus } from "lucide-react";

interface TierDef {
  value: "free" | "plus" | "pro" | "compliance";
  name: string;
  priceNgn: number;
  priceUsdRef: number;
  blurb: string;
  badge?: string;
  register: "quiet" | "primary" | "accent" | "dark";
  features: string[];
}

// Kept in sync manually with TIERS in src/components/dashboard/BillingTab.tsx —
// update both if pricing changes.
const TIERS: TierDef[] = [
  {
    value: "free",
    name: "Free",
    priceNgn: 0,
    priceUsdRef: 0,
    blurb: "Get listed and start matching.",
    register: "quiet",
    features: [
      "Directory & marketplace access",
      "Manual initiative listings",
      "Self-attested DD readiness",
      "Trust Score & verified badge",
      "Inbound messaging",
      "MoU receiving & signing",
      "Milestone tracking",
      "Weekly & monthly digests",
    ],
  },
  {
    value: "plus",
    name: "Plus",
    priceNgn: 80_000,
    priceUsdRef: 59,
    blurb: "Find better-fit partners with AI.",
    badge: "Most popular",
    register: "primary",
    features: [
      "Everything in Free",
      "AI-parsed initiative creation",
      "AI brief quality scoring",
      "Full AI organisation-to-organisation matching",
      "Instant AI fit analysis",
      "AI-drafted outreach messages",
      "MoU origination",
      "Self-view ESG Snapshot",
    ],
  },
  {
    value: "pro",
    name: "Pro",
    priceNgn: 339_000,
    priceUsdRef: 249,
    blurb: "Evaluate partners and opportunities with greater confidence.",
    register: "accent",
    features: [
      "Everything in Plus",
      "AI deal memo / CSR brief",
      "Evaluate candidate ESG Snapshots",
      "AI-drafted EOI outreach",
    ],
  },
  {
    value: "compliance",
    name: "Compliance",
    priceNgn: 1_090_000,
    priceUsdRef: 799,
    blurb: "Build audit-ready CSR infrastructure.",
    badge: "Corporate only",
    register: "dark",
    features: [
      "Everything in Pro",
      "Strategy Builder",
      "Unlimited ESG reports",
      "SRG1 deadline tracking",
      "Audit-ready DD export",
    ],
  },
];

const CTA_URL = "https://app.impactnatives.com/signup";

// Cumulative feature matrix derived from each tier's "Everything in X" inheritance.
// Grouped by the tier each feature was introduced at.
const FEATURE_GROUPS: { introducedAt: TierDef["value"]; items: string[] }[] = [
  {
    introducedAt: "free",
    items: [
      "Directory & marketplace access",
      "Manual initiative listings",
      "Self-attested DD readiness",
      "Trust Score & verified badge",
      "Inbound messaging",
      "MoU receiving & signing",
      "Milestone tracking",
      "Weekly & monthly digests",
    ],
  },
  {
    introducedAt: "plus",
    items: [
      "AI-parsed initiative creation",
      "AI brief quality scoring",
      "Full AI organisation-to-organisation matching",
      "Instant AI fit analysis",
      "AI-drafted outreach messages",
      "MoU origination",
      "Self-view ESG Snapshot",
    ],
  },
  {
    introducedAt: "pro",
    items: [
      "AI deal memo / CSR brief",
      "Evaluate candidate ESG Snapshots",
      "AI-drafted EOI outreach",
    ],
  },
  {
    introducedAt: "compliance",
    items: [
      "Strategy Builder",
      "Unlimited ESG reports",
      "SRG1 deadline tracking",
      "Audit-ready DD export",
    ],
  },
];

const TIER_ORDER: TierDef["value"][] = ["free", "plus", "pro", "compliance"];

function includesTier(introducedAt: TierDef["value"], col: TierDef["value"]) {
  return TIER_ORDER.indexOf(col) >= TIER_ORDER.indexOf(introducedAt);
}

function TierCard({ t }: { t: TierDef }) {
  const isElevated = t.register === "primary";
  const isDark = t.register === "dark";

  const cardBase = "rounded-2xl flex flex-col transition-all duration-200";
  const cardStyle = isDark
    ? "bg-[#0E1512] border border-[#2A3B33] text-white"
    : isElevated
    ? "bg-white dark:bg-card border-2 border-[#2D6A4F] shadow-[0_12px_32px_-8px_rgba(45,106,79,0.35)]"
    : t.register === "accent"
    ? "bg-white dark:bg-card border-2 border-[#C45C26]/40"
    : "bg-white dark:bg-card border border-border";

  const accentIcon = isDark ? "text-[#D9B94A]" : isElevated ? "text-[#2D6A4F]" : "text-[#C45C26]";
  const accentChip = isDark ? "bg-[#C9A227]/20" : isElevated ? "bg-[#2D6A4F]/15" : "bg-[#C45C26]/10";

  return (
    <div className={`${cardBase} ${cardStyle} px-7 ${isElevated ? "py-8" : "py-7"}`}>
      {t.badge && (
        <div className={`inline-flex items-center gap-1 self-start mb-3 text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
          isElevated
            ? "bg-gradient-to-b from-[#3a8560] to-[#2D6A4F] text-white shadow-sm"
            : isDark
            ? "bg-[#C9A227]/15 text-[#D9B94A] border border-[#C9A227]/30"
            : "bg-[#C45C26]/10 text-[#C45C26]"
        }`}>
          {isElevated && <Sparkles className="w-3 h-3" />}
          {t.badge}
        </div>
      )}

      <p className={`font-bold tracking-tight mb-1 ${isElevated ? "text-2xl" : "text-xl"} ${isDark ? "text-white" : "text-foreground"}`}>
        {t.name}
      </p>
      <p className={`text-sm mb-4 leading-snug ${isDark ? "text-white/60" : "text-black dark:text-white"}`}>
        {t.blurb}
      </p>

      <div className="mb-5">
        <p className={`font-extrabold tracking-tight ${isElevated ? "text-4xl" : "text-3xl"} ${isDark ? "text-white" : "text-foreground"}`}>
          {t.priceNgn === 0 ? "₦0" : `₦${t.priceNgn.toLocaleString()}`}
          <span className={`text-sm font-medium ml-1 ${isDark ? "text-white/50" : "text-black dark:text-white"}`}>/mo</span>
        </p>
        {t.priceUsdRef > 0 && (
          <p className={`text-xs mt-1 ${isDark ? "text-white/40" : "text-black dark:text-white"}`}>≈ ${t.priceUsdRef} USD reference</p>
        )}
      </div>

      <div className="space-y-2.5 mb-6 flex-1">
        {t.features.map((f) => (
          <div key={f} className="flex items-center gap-2.5">
            <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${accentChip}`}>
              <Check className={`w-2.5 h-2.5 ${accentIcon}`} strokeWidth={3} />
            </div>
            <p className={`text-sm ${isDark ? "text-white/85" : "text-foreground"}`}>{f}</p>
          </div>
        ))}
      </div>

      <a href={CTA_URL} target="_blank" rel="noreferrer">
        <button
          type="button"
          className={`w-full h-11 rounded-full text-sm font-semibold transition-all duration-150 ${
            isDark
              ? "bg-gradient-to-b from-[#D9B94A] to-[#C9A227] text-[#0E1512] shadow-[0_4px_14px_-2px_rgba(201,162,39,0.5)] hover:shadow-[0_6px_20px_-2px_rgba(201,162,39,0.65)] hover:-translate-y-0.5 active:translate-y-0"
              : isElevated
              ? "bg-gradient-to-b from-[#3a8560] to-[#2D6A4F] text-white shadow-[0_4px_14px_-2px_rgba(45,106,79,0.5)] hover:shadow-[0_6px_20px_-2px_rgba(45,106,79,0.65)] hover:-translate-y-0.5 active:translate-y-0"
              : "bg-gradient-to-b from-[#d4713d] to-[#C45C26] text-white shadow-[0_4px_14px_-2px_rgba(196,92,38,0.4)] hover:shadow-[0_6px_20px_-2px_rgba(196,92,38,0.55)] hover:-translate-y-0.5 active:translate-y-0"
          }`}
        >
          {t.priceNgn === 0 ? "Get started free" : "Get started"}
        </button>
      </a>
    </div>
  );
}

function CompareTable() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse min-w-[720px]">
        <thead>
          <tr>
            <th className="text-left text-sm font-semibold text-foreground py-4 px-4 border-b border-border">Feature</th>
            {TIERS.map((t) => (
              <th key={t.value} className="text-center text-sm font-semibold text-foreground py-4 px-4 border-b border-border">
                {t.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {FEATURE_GROUPS.map((group) => (
            <>
              <tr key={`${group.introducedAt}-heading`}>
                <td colSpan={TIERS.length + 1} className="text-xs font-bold uppercase tracking-wider text-[#2D6A4F] pt-6 pb-2 px-4">
                  {TIERS.find((t) => t.value === group.introducedAt)?.name} features
                </td>
              </tr>
              {group.items.map((feature) => (
                <tr key={feature} className="border-b border-border">
                  <td className="text-sm text-foreground py-3 px-4">{feature}</td>
                  {TIERS.map((t) => (
                    <td key={t.value} className="text-center py-3 px-4">
                      {includesTier(group.introducedAt, t.value) ? (
                        <Check className="w-4 h-4 text-[#2D6A4F] mx-auto" strokeWidth={3} />
                      ) : (
                        <Minus className="w-4 h-4 text-foreground/20 mx-auto" strokeWidth={2} />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PricingPage() {
  return (
    <div className="w-full">
      {/* ── HERO ── */}
      <section
        className="relative w-full min-h-[40vh] flex items-center overflow-hidden"
        style={{
          width: "100vw",
          marginLeft: "calc(-50vw + 50%)",
          marginTop: "-64px",
          paddingTop: "64px",
          backgroundImage: "linear-gradient(135deg, #060f09, #0d2b1a, #0a1f13, #3d1a08, #1a0a04, #060f09)",
          backgroundSize: "300% 300%",
          animation: "fp-chameleon 18s ease infinite",
        }}
      >
        <div className="absolute inset-0 z-0 bg-gradient-to-b from-black/30 via-transparent to-black/50" />
        <div className="relative z-10 max-w-screen-2xl mx-auto content-padding hp-hero py-16 md:py-20 w-full">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 backdrop-blur-sm px-4 py-1.5 mb-8">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-sm font-semibold text-white tracking-wide">Pricing</span>
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white mb-6 max-w-3xl leading-[1.1]">
            Plans for every stage of{" "}
            <span style={{ color: "#f0e6d3" }}>partnership.</span>
          </h1>
          <p className="text-lg md:text-xl text-white/70 leading-relaxed max-w-2xl">
            Start free, then upgrade as you need deeper matching, evaluation, and compliance capabilities.
          </p>
        </div>
      </section>

      {/* ── PLANS (2x2) ── */}
      <div className="max-w-screen-2xl mx-auto content-padding hp-hero py-16 md:py-24">
        <div className="grid md:grid-cols-2 gap-6">
          {TIERS.map((t) => (
            <TierCard key={t.value} t={t} />
          ))}
        </div>

        {/* ── COMPARE ALL FEATURES ── */}
        <div className="mt-20">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground mb-8 text-center">
            Compare all features
          </h2>
          <CompareTable />
        </div>

        <p className="text-center text-sm text-black/60 dark:text-white/50 mt-10">
          Prices shown in Naira. USD figures are a reference only. Billing is processed in NGN.
        </p>
      </div>
    </div>
  );
}
