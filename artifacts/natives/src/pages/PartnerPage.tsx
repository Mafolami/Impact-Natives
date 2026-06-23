import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { COUNTRIES } from "@/lib/countries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ── Constants ─────────────────────────────────────────────────────────────────

const ORG_TYPE_OPTIONS = [
  "NGO / Non-Profit", "Social Enterprise", "Startup", "Technology Company",
  "Corporation", "Philanthropic Foundation", "Venture Capital (VC)",
  "Creative Agency / Studio", "Public Sector", "Research & Academic Institution",
];
const PARTNERSHIP_TYPES = [
  {
    value: "strategic",
    label: "Strategic Partnership",
    desc: "Long-term alignment on shared ecosystem goals and joint initiatives",
    color: "pwn-card-amber",
  },
  {
    value: "ecosystem",
    label: "Ecosystem Partnership",
    desc: "Collaboration to strengthen the broader impact infrastructure in Africa",
    color: "pwn-card-green",
  },
  {
    value: "research",
    label: "Research Partnership",
    desc: "Joint knowledge production, data sharing, or evidence-building",
    color: "pwn-card-blue",
  },
  {
    value: "corporate",
    label: "Corporate Partnership",
    desc: "Private sector engagement on impact programmes and ESG initiatives",
    color: "pwn-card-terracotta",
  },
  {
    value: "funding",
    label: "Funding Partnership",
    desc: "Philanthropic or investment collaboration to resource ecosystem work",
    color: "pwn-card-violet",
  },
  {
    value: "technology",
    label: "Technology Partnership",
    desc: "Co-building or integrating digital tools for the impact sector",
    color: "pwn-card-teal",
  },
];

const WHAT_WE_OFFER = [
  {
    num: "01",
    title: "Ecosystem Access",
    body: "Direct connections to verified implementers, funders, and changemakers across Africa's social impact sector.",
    accent: "#E8622A",
  },
  {
    num: "02",
    title: "Co-Design Capacity",
    body: "Our team works alongside you to shape programmes, research, and initiatives from concept to deployment.",
    accent: "#2D6A4F",
  },
  {
    num: "03",
    title: "Platform Infrastructure",
    body: "Leverage the Natives platform's coordination tools, partner matching, and lab facilitation built for Africa.",
    accent: "#1B4FD8",
  },
  {
    num: "04",
    title: "Credibility & Trust",
    body: "Association with a trusted, independent convener whose legitimacy spans civil society, government, and the private sector.",
    accent: "#7C3AED",
  },
];

const WHO_WE_PARTNER = [
  { title: "Funders & Donors", body: "Philanthropies, impact investors, and bilateral funders looking to resource ecosystem-level work in Africa.", dot: "#E8622A" },
  { title: "Corporations", body: "Private sector organisations integrating impact, ESG, or development programming into their Africa strategies.", dot: "#2D6A4F" },
  { title: "Multilaterals & INGOs", body: "International organisations seeking credible local convening and coordination infrastructure.", dot: "#1B4FD8" },
  { title: "Research Institutions", body: "Universities and think tanks building evidence on what works in African development contexts.", dot: "#7C3AED" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function getStepClass(stepIndex: number, current: number) {
  if (stepIndex === current) return "tf-active";
  if (stepIndex < current) return "tf-above";
  return "tf-below";
}

// ── PartnerWithUsModal ────────────────────────────────────────────────────────
function PartnerWithUsModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({
    contact_name: "",
    organisation_name: "",
    job_title: "",
    email: "",
    organisation_type: "",
    city: "",
    country: "",
    partnership_type: "",
    message: "",
  });
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [emailError, setEmailError] = useState("");
  const totalSteps = 6;

  function update(field: string, value: string) {
    setForm((p) => ({ ...p, [field]: value }));
  }
  function nextStep() {
    if (step < totalSteps - 1) setStep((p) => p + 1);
  }
  function prevStep() {
    if (step > 0) setStep((p) => p - 1);
  }
  function validateOrgEmail(email: string) {
    const personal = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com"];
    const domain = email.split("@")[1]?.toLowerCase();
    if (!domain || personal.includes(domain)) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from("partner_requests").insert({
      contact_name: form.contact_name,
      organisation_name: form.organisation_name,
      job_title: form.job_title,
      email: form.email,
      organisation_type: form.organisation_type,
      location: `${form.city}, ${form.country}`,
      partnership_type: form.partnership_type,
      message: form.message,
      status: "pending",
    });
    setLoading(false);
    if (error) alert(error.message);
    else setSubmitted(true);
  }

  const steps = [
    {
      key: 0,
      content: (
        <>
          <p className="text-sm text-muted-foreground">1 of {totalSteps}</p>
          <h2 className="text-3xl font-semibold text-center">Who are you?</h2>
          <div className="flex flex-col gap-3 w-full max-w-md">
            <Input placeholder="Full name" value={form.contact_name}
              onChange={(e) => update("contact_name", e.target.value)} autoFocus={step === 0} />
            <Input placeholder="Job title" value={form.job_title}
              onChange={(e) => update("job_title", e.target.value)} />
          </div>
          <Button type="button" onClick={nextStep}
            disabled={!form.contact_name.trim() || !form.job_title.trim()}>Next →</Button>
        </>
      ),
    },
    {
      key: 1,
      content: (
        <>
          <p className="text-sm text-muted-foreground">2 of {totalSteps}</p>
          <h2 className="text-3xl font-semibold text-center">Your organisation?</h2>
          <div className="flex flex-col gap-3 w-full max-w-md">
            <Input placeholder="Organisation name" value={form.organisation_name}
              onChange={(e) => update("organisation_name", e.target.value)} autoFocus={step === 1} />
            <Select onValueChange={(v) => update("organisation_type", v)} value={form.organisation_type}>
              <SelectTrigger><SelectValue placeholder="Organisation type" /></SelectTrigger>
              <SelectContent>
                {ORG_TYPE_OPTIONS.map((t) => (
                  <SelectItem key={t} value={t.toLowerCase().replace(/[\s/]+/g, "_")}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="button" onClick={nextStep}
            disabled={!form.organisation_name.trim() || !form.organisation_type}>Next →</Button>
        </>
      ),
    },
    {
      key: 2,
      content: (
        <>
          <p className="text-sm text-muted-foreground">3 of {totalSteps}</p>
          <h2 className="text-3xl font-semibold text-center">Organisation email?</h2>
          <p className="text-sm text-muted-foreground">No Gmail, Yahoo, or personal addresses.</p>
          <Input className="max-w-md w-full" type="email" placeholder="partnerships@organisation.org"
            value={form.email}
            onChange={(e) => { update("email", e.target.value); setEmailError(""); }}
            autoFocus={step === 2} />
          {emailError && <p className="text-red-500 text-sm">{emailError}</p>}
          <Button type="button" onClick={() => {
            if (!validateOrgEmail(form.email)) {
              setEmailError("Please use an organisational email address."); return;
            }
            setEmailError(""); nextStep();
          }} disabled={!form.email.trim()}>Next →</Button>
        </>
      ),
    },
    {
      key: 3,
      content: (
        <>
          <p className="text-sm text-muted-foreground">4 of {totalSteps}</p>
          <h2 className="text-3xl font-semibold text-center">Where are you based?</h2>
          <div className="flex flex-col gap-3 w-full max-w-md">
            <Input placeholder="City" value={form.city}
              onChange={(e) => update("city", e.target.value)} autoFocus={step === 3} />
                        <Select onValueChange={(v) => update("country", v)} value={form.country}>
              <SelectTrigger><SelectValue placeholder="Country" /></SelectTrigger>
              <SelectContent position="popper" side="bottom" className="max-h-60 overflow-y-auto">
                {COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button type="button" onClick={nextStep}
            disabled={!form.city.trim() || !form.country}>Next →</Button>
        </>
      ),
    },
    {
      key: 4,
      content: (
        <>
          <p className="text-sm text-muted-foreground">5 of {totalSteps}</p>
          <h2 className="text-3xl font-semibold text-center">What kind of partnership?</h2>
          <div className="flex flex-col gap-2 w-full max-w-md">
            {PARTNERSHIP_TYPES.map((p) => (
              <button key={p.value} type="button"
                onClick={() => update("partnership_type", p.value)}
                className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-all ${
                  form.partnership_type === p.value
                    ? "bg-foreground text-background border-foreground"
                    : "border-border hover:border-foreground/40"
                }`}>
                <span className="font-medium">{p.label}</span>
                <span className={`block text-xs mt-0.5 ${form.partnership_type === p.value ? "opacity-70" : "text-muted-foreground"}`}>
                  {p.desc}
                </span>
              </button>
            ))}
          </div>
          <Button type="button" onClick={nextStep} disabled={!form.partnership_type}>Next →</Button>
        </>
      ),
    },
    {
      key: 5,
      content: (
        <>
          <p className="text-sm text-muted-foreground">6 of {totalSteps}</p>
          <h2 className="text-3xl font-semibold text-center">Tell us what you have in mind.</h2>
          <Textarea className="max-w-md w-full min-h-[140px]"
            placeholder="Describe your vision for this partnership..."
            value={form.message}
            onChange={(e) => update("message", e.target.value)}
            autoFocus={step === 5} />
          <Button type="submit" disabled={loading || !form.message.trim()}>
            {loading ? "Sending..." : "Send request"}
          </Button>
        </>
      ),
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col"
      style={{ animation: "slideUp 0.35s cubic-bezier(0.4,0,0.2,1) forwards" }}>
      <style>{`
        @keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .tf-step { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1.5rem; padding: 2rem; transition: transform 0.45s cubic-bezier(0.4,0,0.2,1), opacity 0.45s; }
        .tf-active { transform: translateY(0); opacity: 1; }
        .tf-above  { transform: translateY(-100%); opacity: 0; pointer-events: none; }
        .tf-below  { transform: translateY(100%);  opacity: 0; pointer-events: none; }
      `}</style>
      <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
        <span className="text-sm font-medium">Partner With Natives</span>
        <button type="button" onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors text-sm">✕ Close</button>
      </div>
      <div className="h-0.5 bg-muted shrink-0">
        <div className="h-full bg-foreground transition-all duration-300"
          style={{ width: `${((step + 1) / totalSteps) * 100}%` }} />
      </div>
      {submitted ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-5 text-center px-6">
          <h2 className="text-3xl font-semibold">Request received.</h2>
          <p className="text-muted-foreground max-w-sm">
            The Impact Natives team will review your request and be in touch.
          </p>
          <Button onClick={onClose}>Close</Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="relative flex-1 overflow-hidden"
          onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}>
          {steps.map(({ key, content }) => (
            <div key={key} className={`tf-step ${getStepClass(key, step)}`}>{content}</div>
          ))}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4">
            {step > 0 && (
              <button type="button" onClick={prevStep}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors">↑ Back</button>
            )}
            <span className="text-xs text-muted-foreground">{step + 1} / {totalSteps}</span>
          </div>
        </form>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PartnerWithNativesPage() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      {modalOpen && <PartnerWithUsModal onClose={() => setModalOpen(false)} />}

      <style>{`
        /* ── Animations ── */
        @keyframes pwnFadeUp {
          from { opacity: 0; transform: translateY(22px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pwnSlideRight {
          from { opacity: 0; transform: translateX(-16px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .pwn-f1 { animation: pwnFadeUp 0.65s cubic-bezier(0.22,1,0.36,1) 0.05s both; }
        .pwn-f2 { animation: pwnFadeUp 0.65s cubic-bezier(0.22,1,0.36,1) 0.15s both; }
        .pwn-f3 { animation: pwnFadeUp 0.65s cubic-bezier(0.22,1,0.36,1) 0.25s both; }
        .pwn-f4 { animation: pwnFadeUp 0.65s cubic-bezier(0.22,1,0.36,1) 0.35s both; }
        .pwn-f5 { animation: pwnFadeUp 0.65s cubic-bezier(0.22,1,0.36,1) 0.45s both; }

        /* ── Hero band ── */
        .pwn-hero-band {
          background: linear-gradient(135deg, #0f1f0f 0%, #1a2e1a 40%, #0d1a2e 100%);
          position: relative;
          overflow: hidden;
        }
        .pwn-hero-band::before {
          content: '';
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse 60% 50% at 80% 50%, rgba(45,106,79,0.18) 0%, transparent 70%),
            radial-gradient(ellipse 40% 60% at 10% 80%, rgba(232,98,42,0.12) 0%, transparent 65%);
          pointer-events: none;
        }
        .pwn-hero-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(255,255,255,0.07);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 100px;
          padding: 4px 14px;
          color: rgba(255,255,255,0.6);
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }
        .pwn-hero-eyebrow::before {
          content: '';
          width: 6px; height: 6px;
          border-radius: 50%;
          background: #4ade80;
          box-shadow: 0 0 6px #4ade80;
          flex-shrink: 0;
        }
        .pwn-hero-headline {
          color: #fff;
          line-height: 1.02;
          letter-spacing: -0.03em;
        }
        .pwn-hero-headline em {
          font-style: normal;
          color: #E8622A;
        }
        .pwn-hero-sub {
          color: rgba(255,255,255,0.55);
          max-width: 540px;
          line-height: 1.7;
        }
        .pwn-hero-cta {
          background: #E8622A !important;
          color: #fff !important;
          border: none !important;
          padding: 0 2rem !important;
          height: 48px !important;
          border-radius: 10px !important;
          font-weight: 600 !important;
          letter-spacing: 0.01em !important;
          transition: background 0.2s, transform 0.15s !important;
        }
        .pwn-hero-cta:hover { background: #cf5220 !important; transform: translateY(-1px) !important; }
        .pwn-hero-cta:active { transform: translateY(0) !important; }
        .pwn-hero-ghost {
          background: transparent !important;
          color: rgba(255,255,255,0.7) !important;
          border: 1px solid rgba(255,255,255,0.2) !important;
          padding: 0 1.5rem !important;
          height: 48px !important;
          border-radius: 10px !important;
          transition: border-color 0.2s, color 0.2s !important;
        }
        .pwn-hero-ghost:hover {
          border-color: rgba(255,255,255,0.45) !important;
          color: #fff !important;
        }
        /* Stat chips in hero */
        .pwn-stat-chip {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          padding: 14px 22px;
          text-align: center;
        }
        .pwn-stat-num { color: #fff; font-weight: 700; letter-spacing: -0.02em; }
        .pwn-stat-label { color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.1em; margin-top: 2px; }

        /* ── Section labels ── */
        .pwn-section-label {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          text-transform: uppercase;
          letter-spacing: 0.15em;
          color: hsl(var(--muted-foreground));
          margin-bottom: 1.5rem;
        }
        .pwn-section-label::before {
          content: '';
          display: block;
          width: 24px; height: 2px;
          background: #E8622A;
          border-radius: 2px;
          flex-shrink: 0;
        }

        /* ── Offer cards ── */
        .pwn-offer-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1.5px;
          background: hsl(var(--border));
          border: 1.5px solid hsl(var(--border));
          border-radius: 18px;
          overflow: hidden;
        }
        @media (max-width: 640px) {
          .pwn-offer-grid { grid-template-columns: 1fr; }
        }
        .pwn-offer-cell {
          background: hsl(var(--background));
          padding: 2.5rem 2rem;
          position: relative;
          transition: background 0.2s;
        }
        .pwn-offer-cell:hover { background: hsl(var(--muted) / 0.4); }
        .pwn-offer-num {
          font-weight: 800;
          letter-spacing: -0.04em;
          line-height: 1;
          margin-bottom: 1.25rem;
          opacity: 0.18;
        }
        .pwn-offer-accent-bar {
          position: absolute;
          top: 0; left: 0;
          width: 3px; height: 100%;
        }

        /* ── Partnership type cards ── */
        .pwn-type-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;
        }
        @media (max-width: 900px) { .pwn-type-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 560px) { .pwn-type-grid { grid-template-columns: 1fr; } }

        .pwn-card-amber  { --card-accent: #D97706; --card-bg: #FEF3C7; --card-bg-dark: #292009; }
        .pwn-card-green  { --card-accent: #2D6A4F; --card-bg: #D1FAE5; --card-bg-dark: #0a1f14; }
        .pwn-card-blue   { --card-accent: #1B4FD8; --card-bg: #DBEAFE; --card-bg-dark: #0a1226; }
        .pwn-card-terracotta { --card-accent: #E8622A; --card-bg: #FFEDD5; --card-bg-dark: #261208; }
        .pwn-card-violet { --card-accent: #7C3AED; --card-bg: #EDE9FE; --card-bg-dark: #1a0d2e; }
        .pwn-card-teal   { --card-accent: #0D9488; --card-bg: #CCFBF1; --card-bg-dark: #062420; }

        .pwn-type-card {
          border-radius: 16px;
          padding: 1.75rem 1.5rem;
          border: 1.5px solid hsl(var(--border));
          background: hsl(var(--background));
          position: relative;
          overflow: hidden;
          transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
        }
        .pwn-type-card:hover {
          transform: translateY(-3px);
          border-color: var(--card-accent);
          box-shadow: 0 8px 28px -8px color-mix(in srgb, var(--card-accent) 30%, transparent);
        }
        .pwn-type-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 3px;
          background: var(--card-accent);
          border-radius: 16px 16px 0 0;
        }
        .pwn-type-badge {
          display: inline-block;
          padding: 3px 10px;
          border-radius: 100px;
          background: var(--card-bg);
          color: var(--card-accent);
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin-bottom: 1rem;
          border: 1px solid color-mix(in srgb, var(--card-accent) 25%, transparent);
        }
        @media (prefers-color-scheme: dark) {
          .pwn-type-badge { background: var(--card-bg-dark); }
        }
        .dark .pwn-type-badge { background: var(--card-bg-dark); }

        /* ── Who we partner with ── */
        .pwn-who-item {
          display: flex;
          gap: 1rem;
          align-items: flex-start;
          padding: 1.5rem;
          border-radius: 14px;
          border: 1.5px solid hsl(var(--border));
          background: hsl(var(--background));
          transition: border-color 0.2s, background 0.2s;
        }
        .pwn-who-item:hover {
          background: hsl(var(--muted) / 0.3);
          border-color: hsl(var(--foreground) / 0.15);
        }
        .pwn-who-dot {
          width: 10px; height: 10px;
          border-radius: 50%;
          flex-shrink: 0;
          margin-top: 5px;
        }

        /* ── CTA block ── */
        .pwn-cta-block {
          background: linear-gradient(135deg, #0f1f0f 0%, #1a2e1a 50%, #0d1a2e 100%);
          border-radius: 24px;
          padding: 4rem 3rem;
          position: relative;
          overflow: hidden;
        }
        .pwn-cta-block::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse 55% 70% at 90% 50%, rgba(232,98,42,0.15) 0%, transparent 65%);
          pointer-events: none;
        }
        .pwn-cta-headline { color: #fff; letter-spacing: -0.02em; }
        .pwn-cta-sub { color: rgba(255,255,255,0.5); max-width: 480px; line-height: 1.7; }
        .pwn-cta-note { color: rgba(255,255,255,0.35); }

        /* ── Section spacing ── */
        .pwn-section { padding-top: 5rem; padding-bottom: 5rem; }
        .pwn-divider {
          border: none;
          border-top: 1px solid hsl(var(--border) / 0.6);
          margin: 0;
        }
      `}</style>

      {/* ══ HERO ══════════════════════════════════════════════════════════════ */}
      <section className="pwn-hero-band">
        <div className="w-full max-w-screen-2xl mx-auto content-padding hp-hero py-20 md:py-28">          <div className="pwn-f1 mb-6">
            <span className="pwn-hero-eyebrow text-xs font-semibold">
              About · Partnerships
            </span>
          </div>

          <h1 className="pwn-f2 pwn-hero-headline text-5xl md:text-7xl font-bold mb-6">
            Partner<br />With <em>Natives.</em>
          </h1>

          <p className="pwn-f3 pwn-hero-sub text-base md:text-lg mb-10">
            Join us in building the connective tissue; the strategic alliances, research collaborations,
            funded initiatives, and technology partnerships that compound over time for Africa's
            social impact ecosystem.
          </p>

          <div className="pwn-f4 flex flex-wrap items-center gap-3 mb-16">
            <Button className="pwn-hero-cta" onClick={() => setModalOpen(true)}>
              Request a Partnership →
            </Button>
            <Button className="pwn-hero-ghost" variant="ghost" onClick={() => document.getElementById('modalities')?.scrollIntoView({ behavior: 'smooth' })}>
              Explore modalities ↓
            </Button>
          </div>
        </div>
      </section>

      <div className="w-full max-w-screen-2xl mx-auto content-padding hp-hero">
        {/* ══ WHAT WE OFFER ════════════════════════════════════════════════════ */}
        <section className="pwn-section">
          <p className="pwn-section-label text-xs font-semibold">What we bring</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-10 max-w-xl leading-tight">
            Four pillars every partnership is built on.
          </h2>
          <div className="pwn-offer-grid">
            {WHAT_WE_OFFER.map((item) => (
              <div key={item.num} className="pwn-offer-cell">
                <div className="pwn-offer-accent-bar" style={{ background: item.accent }} />
                <div className="pwn-offer-num text-5xl" style={{ color: item.accent }}>
                  {item.num}
                </div>
                <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        <hr className="pwn-divider" />

        {/* ══ PARTNERSHIP TYPES ════════════════════════════════════════════════ */}
                <section id="modalities" className="pwn-section">
          <p className="pwn-section-label text-xs font-semibold">Partnership modalities</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-10 max-w-xl leading-tight">
            Six ways to build something together.
          </h2>
          <div className="pwn-type-grid">
            {PARTNERSHIP_TYPES.map((p) => (
              <div key={p.value} className={`pwn-type-card ${p.color}`}>
                <span className="pwn-type-badge text-[10px]">{p.value}</span>
                <h3 className="text-base font-semibold mb-2">{p.label}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <hr className="pwn-divider" />

        {/* ══ WHO WE PARTNER WITH ══════════════════════════════════════════════ */}
        <section className="pwn-section">
          <p className="pwn-section-label text-xs font-semibold">Who we work with</p>
          <div className="grid md:grid-cols-2 gap-12 items-start">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-5 leading-tight">
                Built for organisations that take the long view.
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-5">
              We partner with a select number of organisations each year — funders, corporates, multilaterals, and research institutions committed to systemic change in Africa's impact sector.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                We are not a vendor. We are a co-architect. If you want a partner that will
                challenge your thinking, expand your reach, and deliver results — let's talk.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              {WHO_WE_PARTNER.map((item) => (
                <div key={item.title} className="pwn-who-item">
                  <span className="pwn-who-dot" style={{ background: item.dot }} />
                  <div>
                    <h4 className="text-sm font-semibold mb-1">{item.title}</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

      </div>

      {/* ══ CTA BAND ═════════════════════════════════════════════════════════ */}
      <div className="w-full max-w-screen-2xl mx-auto content-padding hp-hero pb-20">        
        <div className="pwn-cta-block">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8 relative z-10">
            <div>
              <h2 className="pwn-cta-headline text-3xl md:text-4xl font-bold mb-4 leading-tight">
                Ready to build something<br />that lasts?
              </h2>
              <p className="pwn-cta-sub text-base">
                Submit a partnership request. Our team reviews every submission and responds
                with clarity — a conversation or an honest explanation if it's not the right fit.
              </p>
            </div>
            <div className="shrink-0 flex flex-col gap-3 items-start md:items-end">
              <Button className="pwn-hero-cta" onClick={() => setModalOpen(true)}>
                Request a Partnership →
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}