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

// Forest-green family for Free/Plus/Pro; Compliance keeps its dark register untouched.
const PALETTE: Record<TierDef["register"], {
  bg: string; text: string; textDim: string; chip: string; icon: string; button: string; buttonText: string;
}> = {
  quiet: {
    bg: "#EAF7F0",
    text: "#0D2B1A",
    textDim: "#0D2B1ACC",
    chip: "#2D6A4F1F",
    icon: "#2D6A4F",
    button: "#14110d",
    buttonText: "#ffffff",
  },
  primary: {
    bg: "#2D6A4F",
    text: "#ffffff",
    textDim: "#ffffffB3",
    chip: "#ffffff26",
    icon: "#ffffff",
    button: "#ffffff",
    buttonText: "#2D6A4F",
  },
  accent: {
    bg: "#173C2C",
    text: "#ffffff",
    textDim: "#ffffffB3",
    chip: "#ffffff26",
    icon: "#ffffff",
    button: "#ffffff",
    buttonText: "#173C2C",
  },
  dark: {
    bg: "#14110d",
    text: "#ffffff",
    textDim: "#ffffffB3",
    chip: "#ffffff1A",
    icon: "#ffffff",
    button: "#ffffff",
    buttonText: "#14110d",
  },
};

function TierBlock({ tier }: { tier: TierDef }) {
  const p = PALETTE[tier.register];

  return (
    <div className="grid md:grid-cols-[minmax(280px,32%)_1fr] gap-6 items-stretch">
      {/* Left: standalone info card */}
      <div
        className="rounded-2xl flex flex-col px-8 py-9"
        style={{ background: p.bg, border: `1px solid ${p.bg}`, boxShadow: "0 12px 32px -12px rgba(0,0,0,0.22)" }}
      >
        {tier.badge && (
          <div
            className="inline-flex items-center gap-1 self-start mb-4 text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full"
            style={{ background: p.chip, color: p.text }}
          >
            {tier.badge}
          </div>
        )}
        <p className="font-extrabold tracking-tight text-3xl mb-3" style={{ color: p.text }}>
          {tier.name}
        </p>
        <p className="text-base mb-8 leading-relaxed" style={{ color: p.textDim }}>
          {tier.blurb}
        </p>
        <div className="mt-auto">
          <p className="font-extrabold tracking-tight text-5xl mb-1" style={{ color: p.text }}>
            {`₦${tier.priceNgn.toLocaleString()}`}
            <span className="text-base font-medium ml-1" style={{ color: p.textDim }}>/mo</span>
          </p>
          {tier.priceNgn > 0 ? (
            <p className="text-sm mb-6" style={{ color: p.textDim }}>
              ≈ ${tier.priceUsdRef} USD reference
            </p>
          ) : (
            <div className="mb-6" />
          )}
          <a href={CTA_URL} target="_blank" rel="noreferrer">
            <button
              className="w-full h-12 rounded-full text-base font-semibold transition-opacity duration-150 hover:opacity-90"
              style={{ background: p.button, color: p.buttonText }}
            >
              {tier.priceNgn === 0 ? "Get started free" : "Get started"}
            </button>
          </a>
        </div>
      </div>

      {/* Right: standalone features card */}
      <div
        className="rounded-2xl px-8 py-9"
        style={{ background: p.bg, border: `1px solid ${p.bg}`, boxShadow: "0 12px 32px -12px rgba(0,0,0,0.22)" }}
      >
        <p className="text-xs font-bold uppercase tracking-widest mb-5" style={{ color: p.textDim }}>
          Features
        </p>
        <div className="flex flex-col gap-4">
          {tier.features.map((f) => (
            <div key={f} className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: p.chip }}>
                <Check className="w-3 h-3" style={{ color: p.icon }} strokeWidth={3} />
              </div>
              <p className="text-base" style={{ color: p.text }}>{f}</p>
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
        <div className="flex flex-col gap-8">
          {TIERS.map((tier) => (
            <TierBlock key={tier.value} tier={tier} />
          ))}
        </div>
        <p className="text-center text-base mt-10" style={{ color: "#00000099" }}>
          Prices shown in Naira. USD figures are a reference only. Billing is processed in NGN.
        </p>
      </div>
    </div>
  );
}
