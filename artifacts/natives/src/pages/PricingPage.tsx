import { Check } from "lucide-react";

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

function TierRow({ tier }: { tier: TierDef }) {
  const isDark = tier.register === "dark";
  const isElevated = tier.register === "primary";

  const cardStyle =
    tier.register === "dark"
      ? "bg-[#14110d] border-[#14110d] text-white"
      : tier.register === "primary"
      ? "border-primary bg-primary/5 dark:bg-primary/10"
      : tier.register === "accent"
      ? "border-[#C45C26]/40 bg-card"
      : "border-border bg-card";

  const accentChip =
    tier.register === "dark"
      ? "bg-white/10"
      : tier.register === "primary"
      ? "bg-primary/10"
      : tier.register === "accent"
      ? "bg-[#C45C26]/10"
      : "bg-muted";

  const accentIcon =
    tier.register === "dark"
      ? "text-white"
      : tier.register === "primary"
      ? "text-primary"
      : tier.register === "accent"
      ? "text-[#C45C26]"
      : "text-foreground";

  return (
    <div className={`rounded-2xl border flex flex-col md:flex-row gap-8 md:gap-10 px-8 py-8 md:py-10 ${cardStyle}`}>
      {/* Left: name, blurb, price, CTA */}
      <div className="md:w-[34%] flex flex-col shrink-0">
        {tier.badge && (
          <div
            className={`inline-flex items-center gap-1 self-start mb-3 text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${accentChip} ${isDark ? "text-white" : "text-foreground"}`}
          >
            {tier.badge}
          </div>
        )}
        <p className={`font-extrabold tracking-tight text-3xl mb-2 ${isDark ? "text-white" : "text-foreground"}`}>
          {tier.name}
        </p>
        <p className={`text-base mb-6 leading-snug ${isDark ? "text-white/60" : "text-muted-foreground"}`}>
          {tier.blurb}
        </p>
        <div className="mb-7">
          <p className={`font-extrabold tracking-tight text-5xl ${isDark ? "text-white" : "text-foreground"}`}>
            {tier.priceNgn === 0 ? "₦0" : `₦${tier.priceNgn.toLocaleString()}`}
            <span className={`text-base font-medium ml-1 ${isDark ? "text-white/50" : "text-muted-foreground"}`}>/mo</span>
          </p>
          {tier.priceNgn > 0 && (
            <p className={`text-sm mt-1 ${isDark ? "text-white/40" : "text-muted-foreground"}`}>
              ≈ ${tier.priceUsdRef} USD reference
            </p>
          )}
        </div>
        <a href={CTA_URL} target="_blank" rel="noreferrer" className="mt-auto">
          <button
            className={`w-full h-12 rounded-full text-base font-semibold transition-all duration-150 ${
              isDark
                ? "bg-white text-[#14110d] hover:bg-white/90"
                : isElevated
                ? "bg-primary text-white hover:bg-primary/90"
                : "border border-border hover:bg-muted"
            }`}
          >
            {tier.priceNgn === 0 ? "Get started free" : "Get started"}
          </button>
        </a>
      </div>

      {/* Right: features */}
      <div className="flex-1">
        <p className={`text-xs font-bold uppercase tracking-widest mb-4 ${isDark ? "text-white/50" : "text-muted-foreground"}`}>
          Features
        </p>
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3.5">
          {tier.features.map((f) => (
            <div key={f} className="flex items-start gap-2.5">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${accentChip}`}>
                <Check className={`w-3 h-3 ${accentIcon}`} strokeWidth={3} />
              </div>
              <p className={`text-base ${isDark ? "text-white/85" : "text-foreground"}`}>{f}</p>
            </div>
          ))}
        </div>
      </div>
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

      {/* ── PLANS ── */}
      <div className="max-w-screen-2xl mx-auto content-padding hp-hero py-16 md:py-24">
        <div className="flex flex-col gap-6">
          {TIERS.map((tier) => (
            <TierRow key={tier.value} tier={tier} />
          ))}
        </div>
        <p className="text-center text-base text-muted-foreground mt-10">
          Prices shown in Naira. USD figures are a reference only. Billing is processed in NGN.
        </p>
      </div>
    </div>
  );
}
