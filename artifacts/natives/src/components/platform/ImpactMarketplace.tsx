import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Check, MapPin, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import CreateInitiativeModal from "@/components/platform/CreateInitiativeModal";
import { supabase } from "@/lib/supabase";
import { SECTOR_OPTIONS as BASE_SECTOR_OPTIONS } from "@/lib/sectors";
const SECTOR_OPTIONS = ["All Sectors", ...BASE_SECTOR_OPTIONS];
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "wouter";
import { Bookmark } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────
type PartnershipType =
  | "funding" | "technical" | "operational" | "leadership" | "strategic" | "lead";

type InitiativeStatus =
  | "Listed" | "Sponsorship Secured" | "Seeking Partners" | "Executing"
  | "Completed";

const STATUS_CONFIG: Record<InitiativeStatus, { color: string; border: string }> = {
  Listed:               { color: "#6B9E78", border: "rgba(107,158,120,0.35)" },
  "Sponsorship Secured":   { color: "#C47A3A", border: "rgba(196,122,58,0.35)" },
  "Seeking Partners":   { color: "#A8C5B0", border: "rgba(168,197,176,0.35)" },
  "Executing":            { color: "#B45C38", border: "rgba(180,92,56,0.35)" },
  "Completed":            { color: "#4A8C5C", border: "rgba(74,140,92,0.35)" },
};

const PARTNERSHIP_CONFIG: Record<PartnershipType, { color: string; border: string; label: string }> = {
  funding:     { color: "#C47A3A", border: "rgba(196,122,58,0.4)",   label: "Funding" },
  technical:   { color: "#4A8C5C", border: "rgba(74,140,92,0.4)",    label: "Technical" },
  operational: { color: "#C8965A", border: "rgba(200,150,90,0.4)",   label: "Operational" },
  leadership:  { color: "#6B9E78", border: "rgba(107,158,120,0.4)",  label: "Leadership" },
  strategic:   { color: "#B45C38", border: "rgba(180,92,56,0.4)",    label: "Strategic" },
  lead:        { color: "#5C9E72", border: "rgba(92,158,114,0.4)",   label: "Project Lead" },
};

interface Initiative {
  id: string;
  title: string;
  sectors: string[];
  locations: string[];
  status: InitiativeStatus | 'published' | 'pending' | 'rejected';
  budget: string;
  partnerships: string[];
  eois: number;
  problem: string;
  outcome: string;
  tags: string[];
  posted: string;
  submitter_name?: string;
  submitter_org?: string;
  submitter_email?: string;
  created_at?: string;
}


// ─── Open-for logic ───────────────────────────────────────────────────────────
// If Listed and budget is not $0, only funding is open — you can't build without it.
// Otherwise, use the initiative's own partnerships array.
function getOpenFor(initiative: Initiative): PartnershipType[] {
  const isZeroBudget = (initiative.budget ?? '').trim() === "$0";
  const displayStatus = initiative.status === 'published' ? 'Listed' : initiative.status;
  if (displayStatus === "Listed" && !isZeroBudget) {
    return ["funding"] as PartnershipType[];
  }
  return (initiative.partnerships ?? []) as PartnershipType[];
}

// ─── Dynamic filter options from data ────────────────────────────────────────
function useDynamicFilters(initiatives: Initiative[]) {
  const sectors   = Array.from(new Set(initiatives.flatMap((i) => i.sectors))).sort();
  const locations = Array.from(new Set(initiatives.flatMap((i) => i.locations))).sort();
  const statuses  = Array.from(new Set(initiatives.map((i) => i.status))) as InitiativeStatus[];
  const partners  = Array.from(new Set(initiatives.flatMap((i) => i.partnerships))) as PartnershipType[];
  return { sectors, locations, statuses, partners };
}

const LIFECYCLE_STEPS = [
  {
    step: "Listed",
    desc: "The initiative is publicly visible and seeking attention from funders, potential partners, and supporters.",
  },
  {
    step: "Sponsorship Secured",
    desc: "Sponsor has expressed interest in initiative and funding/sponsorship agreements have been concluded.",
  },
  {
    step: "Seeking Partners",
    desc: "The initiative is actively recruiting implementation and delivery partners.",
  },
  {
    step: "Executing",
    desc: "Core stakeholders have agreed to move forward together. Activities are underway. Partners are delivering on their commitments. Outcomes, milestones, and updates are tracked and reported to stakeholders.",
  },
  {
    step: "Completed",
    desc: "The initiative has delivered its intended outcome. Impact has been recorded.",
  },
];

const HOW_STEPS = [
  {
    n: "01",
    title: "Publish an initiative",
    body: "Describe the challenge, define the outcome you want, and set the kind of support you're looking for. Publishing takes minutes.",
  },
  {
    n: "02",
    title: "Attract interest",
    body: "Funders, implementers, and experts browse the marketplace and express interest in initiatives that match their mandate or portfolio.",
  },
  {
    n: "03",
    title: "Build the right coalition",
    body: "Review expressions of interest, connect with aligned organisations, and assemble the coalition your initiative needs to move forward.",
  },
  {
    n: "04",
    title: "Move into execution",
    body: "With partners and resources in place, your initiative transitions from idea to active programme.",
  },
];

const WHY_FEATURES = [
  {
    title: "Surface ideas that deserve attention",
    body: "Important challenges often remain invisible because the people who identify them lack access to funding, networks, or implementation capacity.",
  },
  {
    title: "Bring the right people together",
    body: "Instead of searching for partners one conversation at a time, initiatives become discoverable by organisations already looking for opportunities to support.",
  },
  {
    title: "Create pathways from intention to impact",
    body: "An idea is valuable. Execution is transformative. Impact Marketplace helps bridge the gap between the two.",
  },
];

const PARTNERSHIP_TYPES = [
  {
    title: "Funding Partner",
    body: "Provide grants, sponsorship, investment, or financial support to help initiatives reach their goals.",
    accent: "#C47A3A",
  },
  {
    title: "Project Lead",
    body: "Take responsibility for coordinating and driving the initiative forward from start to completion.",
    accent: "#5C9E72",
  },
  {
    title: "Technical Partner",
    body: "Provide expertise, technology, research, or advisory support that strengthens the initiative's approach.",
    accent: "#4A8C5C",
  },
  {
    title: "Strategic Partner",
    body: "Contribute networks, influence, or institutional relationships that amplify reach and credibility.",
    accent: "#B45C38",
  },
  {
    title: "Implementation Partner",
    body: "Lead or support project delivery, turning the initiative's goals into tangible outcomes on the ground.",
    accent: "#C8965A",
  },
  {
    title: "ESG & CSR Alignment",
    body: "Organisations can adopt a listed initiative as their corporate social responsibility or ESG anchor, using it to demonstrate measurable, third-party-verified impact without building programmes from scratch.",
    accent: "#6B9E78",
    isEsg: true,
  },
];

const CREDIBILITY_ITEMS = [
  "Impact credibility",
  "Partnership reputation",
  "Implementation track record",
  "Ecosystem visibility",
  "The more value you create, the stronger your reputation becomes across the ecosystem.",
];

const METRICS = [
  { label: "Initiatives listed", value: 142 },
  { label: "Seeking partners now", value: 38 },
  { label: "Est. combined budget", value: 4, prefix: "$", suffix: ".2M" },
  { label: "Executing today", value: 19 },
];

const STATUS_FILTERS: InitiativeStatus[] = [
  "Listed",
  "Sponsorship Secured",
  "Seeking Partners",
  "Executing",
  "Completed",
];
const PARTNER_FILTERS: PartnershipType[] = [
  "funding",
  "technical",
  "operational",
  "leadership",
];

// ─── Constants ───────────────────────────────────────────────────────────────
const GREEN_GRADIENT = "linear-gradient(135deg, #0d2b1a 0%, #1a4a2e 60%, #0d2b1a 100%)";
const INITIATIVES_SECTION_ID = "marketplace-initiatives";
const SIGNUP_HREF = "/signup";

// Sector badge — one consistent color across all cards
const SECTOR_BADGE_CLASS = "text-xs font-semibold px-2 py-0.5 rounded-full bg-[#3A7D44]/10 text-[#3A7D44] dark:bg-[#C47A3A]/10 dark:text-[#C47A3A] border border-[#3A7D44]/20 dark:border-[#C47A3A]/20";


// ─── Helpers ──────────────────────────────────────────────────────────────────
function scrollToInitiatives(initiativeId?: string | number) {
  const el = document.getElementById(
    initiativeId ? `initiative-${initiativeId}` : INITIATIVES_SECTION_ID
  );
  el?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function CreateInitiativeButton({ children = "Create Initiative", className, size, onClick }: {
  children?: React.ReactNode; className?: string; size?: "default" | "sm" | "lg" | "icon"; onClick?: () => void;
}) {
  return (
    <Button type="button" size={size} className={className} onClick={onClick}>
      {children}
    </Button>
  );
}

function BrowseInitiativesButton({ children = "Browse Initiatives", className, size, variant = "outline" }: {
  children?: React.ReactNode; className?: string;
  size?: "default" | "sm" | "lg" | "icon";
  variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive";
}) {
  return (
    <Button type="button" size={size} variant={variant} className={className}
      onClick={() => scrollToInitiatives()}>
      {children}
    </Button>
  );
}

function SectionEyebrow({ children }: { children: string }) {
  return (
    <p className="text-xl font-semibold text-primary uppercase tracking-widest mb-4">
      {children}
    </p>
  );
}

function SectionShell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("w-full max-w-7xl mx-auto content-padding", className)}>
      {children}
    </div>
  );
}

function GreenCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("w-full rounded-3xl overflow-hidden", className)}
      style={{ background: GREEN_GRADIENT }}>
      {children}
    </div>
  );
}

// ─── Multi-select chip filter ─────────────────────────────────────────────────
function MultiSelectDropdown<T extends string>({
  label,
  options,
  selected,
  onToggle,
  formatLabel,
}: {
  label: string;
  options: T[];
  selected: T[];
  onToggle: (v: T) => void;
  formatLabel?: (v: T) => string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const displayValue = selected.length === 0
    ? `All ${label}s`
    : selected.map((v) => formatLabel ? formatLabel(v) : v).join(", ");

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "w-full flex items-center justify-between gap-2 px-3 py-2 text-sm rounded-md border bg-background transition-colors text-left",
          open ? "border-primary/60 ring-1 ring-primary/20" : "border-border hover:border-primary/40"
        )}
      >
        <span className={cn("truncate", selected.length === 0 && "text-muted-foreground")}>
          {displayValue}
        </span>
        <svg className={cn("w-4 h-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[160px] rounded-md border border-border bg-popover shadow-md">
          {options.map((opt) => {
            const active = selected.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => onToggle(opt)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/60 transition-colors text-left"
              >
                <span className={cn(
                  "w-4 h-4 shrink-0 rounded border flex items-center justify-center transition-colors",
                  active ? "bg-primary border-primary" : "border-border"
                )}>
                  {active && <Check className="w-2.5 h-2.5 text-white" />}
                </span>
                {formatLabel ? formatLabel(opt) : opt}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}


// ─── Hooks ────────────────────────────────────────────────────────────────────
function useCountUp(target: number, duration = 1400) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setStarted(true); obs.disconnect(); }
    }, { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!started) return;
    let frame: number;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setCount(Math.round(eased * target));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [started, target, duration]);

  return { count, ref };
}

function StatusBadge({ status }: { status: InitiativeStatus }) {
  const s = STATUS_CONFIG[status] ?? { color: "#6B9E78", border: "rgba(107,158,120,0.35)" };
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-2.5 py-0.5"
      style={{ color: s.color, background: `${s.color}14`, border: `1px solid ${s.border}` }}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: s.color }} />
      {status}
    </span>
  );
}

function MetricCard({ label, value, prefix, suffix, delay = 0 }: {
  label: string; value: number; prefix?: string; suffix?: string; delay?: number;
}) {
  const { count, ref } = useCountUp(value, 1400 + delay);
  const display = prefix ? `${prefix}${count}${suffix ?? ""}` : `${count}${suffix ?? ""}`;
  return (
    <Card ref={ref} className="hover:border-primary/40 transition-colors">
      <CardContent className="pt-6">
        <p className="text-3xl md:text-4xl font-bold tracking-tight text-foreground tabular-nums">{display}</p>
        <p className="text-sm text-muted-foreground mt-2">{label}</p>
      </CardContent>
    </Card>
  );
}

// ─── Initiative Card ──────────────────────────────────────────────────────────
function InitiativeCard({ initiative }: { initiative: Initiative }) {
  const { user } = useAuth()
  const [, navigate] = useLocation()
  const [saved, setSaved] = useState(false)
  const [savingToggle, setSavingToggle] = useState(false)

  useEffect(() => {
    if (!user) return
    supabase
      .from("saved_initiatives")
      .select("id")
      .eq("user_id", user.id)
      .eq("initiative_id", initiative.id)
      .maybeSingle()
      .then(({ data }) => setSaved(!!data))
  }, [user, initiative.id])

  async function toggleSave(e: React.MouseEvent) {
    e.preventDefault()
    if (!user) return
    setSavingToggle(true)
    if (saved) {
      await supabase.from("saved_initiatives").delete()
        .eq("user_id", user.id).eq("initiative_id", initiative.id)
      setSaved(false)
    } else {
      await supabase.from("saved_initiatives").insert({ user_id: user.id, initiative_id: initiative.id })
      setSaved(true)
    }
    setSavingToggle(false)
  }

  function handleView() {
    if (!user) {
      sessionStorage.setItem("redirectAfterAuth", `/initiatives/${initiative.id}`)
      navigate(`/signin?redirect=/initiatives/${initiative.id}`)
      return
    }
    navigate(`/initiatives/${initiative.id}`)
  }

  function handleExpressInterest() {
    if (!user) {
      sessionStorage.setItem("redirectAfterAuth", `/initiatives/${initiative.id}`)
      navigate(`/signin?redirect=/initiatives/${initiative.id}`)
      return
    }
    navigate(`/initiatives/${initiative.id}`)
  }

  const displayStatus = initiative.status === 'published'
    ? 'Listed'
    : initiative.status as InitiativeStatus;
  const status = STATUS_CONFIG[displayStatus] ?? {
    color: "#6B9E78",
    border: "rgba(107,158,120,0.35)"
  };
  const isFunded = displayStatus !== "Listed";
  const openFor = getOpenFor(initiative);

  return (
    <Card
      id={`initiative-${initiative.id}`}
      className="flex flex-col hover:border-primary/50 transition-colors overflow-hidden group scroll-mt-28"
    >
      <div className="h-1" style={{ background: status.color }} />
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap gap-1 mb-3">
              {initiative.sectors.map((s) => (
                <span key={s} className={SECTOR_BADGE_CLASS}>{s}</span>
              ))}
            </div>
            <CardTitle className="text-lg leading-snug">{initiative.title}</CardTitle>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {user && (
              <button
                type="button"
                onClick={toggleSave}
                disabled={savingToggle}
                className="p-1.5 rounded-full hover:bg-muted transition-colors"
                title={saved ? "Remove from saved" : "Save initiative"}
              >
                <Bookmark
                  className="w-4 h-4 transition-colors"
                  style={{ color: saved ? "#2D6A4F" : undefined }}
                  fill={saved ? "#2D6A4F" : "none"}
                />
              </button>
            )}
            <StatusBadge status={displayStatus} />
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col flex-1 gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Problem</p>
          <p className="text-sm text-muted-foreground leading-relaxed">{initiative.problem}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Expected Outcome</p>
          <p className="text-sm text-muted-foreground leading-relaxed">{initiative.outcome}</p>
        </div>
        <div className={cn("grid gap-3 rounded-lg bg-muted/60 p-3 text-sm", isFunded ? "grid-cols-1" : "grid-cols-2")}>
          {!isFunded && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Budget</p>
              <p className="font-semibold">{initiative.budget}</p>
            </div>
          )}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Location</p>
            <div className="flex flex-wrap gap-1 mt-0.5">
              {initiative.locations.map((loc) => (
                <span key={loc} className="inline-flex items-center gap-0.5 text-xs font-medium">
                  <MapPin className="w-3 h-3 shrink-0" />{loc}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Open for</p>
          <div className="flex flex-wrap gap-1.5">
            {openFor.map((p) => (
              <span key={p} className="text-xs font-semibold rounded-full px-2.5 py-0.5"
                style={{ color: PARTNERSHIP_CONFIG[p as PartnershipType]?.color, border: `1px solid ${PARTNERSHIP_CONFIG[p as PartnershipType]?.border}` }}>
                {PARTNERSHIP_CONFIG[p as PartnershipType]?.label}
              </span>
            ))}
          </div>
        </div>
        <div className="mt-auto pt-2 flex gap-2">
          <Button type="button" variant="outline" className="flex-1 rounded-full" onClick={handleView}>
            View
          </Button>
          <Button type="button" className="flex-[2] rounded-full bg-primary hover:bg-primary/90 text-white" onClick={handleExpressInterest}>
            Express Interest
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Sections ────────────────────────────────────────────────────────────────
function HeroSection({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <section
      data-reveal
      className="relative w-full min-h-[95vh] flex items-start overflow-hidden"
      style={{ width: '100vw', marginLeft: 'calc(-50vw + 50%)', marginTop: '-64px', paddingTop: '64px' }}
    >
      <div className="absolute inset-0 z-0">
        <img
          src="/hero.png"
          alt=""
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/25 to-black/55" />
      </div>
      <SectionShell className="relative z-10 py-24 md:py-32">
      <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 backdrop-blur-sm px-4 py-1.5 mb-8">
        <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
        <span className="text-sm font-semibold text-white tracking-wide">
          Impact Marketplace
        </span>
      </div>
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white mb-6 max-w-3xl leading-[1.1]">
          Turn your impact idea{" "}
          <span className="text-primary">
          into a real initiative.
          </span>
        </h1>
        <div className="value-anchor-box rounded-2xl p-6 max-w-xl mb-8 shadow-lg">
          <p className="value-anchor-text text-lg leading-relaxed">
            One executed idea can start a movement. Share a challenge worth solving. Define
            the outcome you want to see. Let the ecosystem help bring it to life.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4">
        <CreateInitiativeButton
            size="lg"
            className="rounded-full h-12 px-10 bg-primary hover:bg-primary/90 text-white font-semibold"
            onClick={onCreateClick}
          />
          <BrowseInitiativesButton
            size="lg"
            className="rounded-full h-12 px-10 border-white/30 text-white hover:bg-white/10 font-semibold bg-transparent"
          />
        </div>
      </SectionShell>
    </section>
  );
}

function HowItWorksSection() {
  return (
    <section data-reveal className="py-24 w-full border-b border-border">
      <SectionShell>
        <SectionEyebrow>How it works</SectionEyebrow>
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-12 max-w-xl">
          From idea to initiative in four steps
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {HOW_STEPS.map((s) => (
            <Card key={s.n} className="hover:border-primary/40 transition-colors">
              <CardContent className="pt-6">
                <p className="text-4xl font-black text-primary/20 mb-4">{s.n}</p>
                <h3 className="font-bold text-lg mb-3">{s.title}</h3>
                <p className="text-muted-foreground leading-relaxed text-sm">
                  {s.body}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </SectionShell>
    </section>
  );
}

function WhySection() {
  return (
    <section data-reveal className="py-24 w-full bg-muted/30 border-y border-border">
      <SectionShell>
        <SectionEyebrow>Why this exists</SectionEyebrow>
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-12 max-w-2xl">
          Ideas are everywhere. Implementation is rare.
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          {WHY_FEATURES.map((f) => (
            <Card
              key={f.title}
              className="hover:border-primary/50 transition-colors group"
            >
              <CardContent className="pt-6">
                <div className="w-11 h-11 rounded-full bg-primary flex items-center justify-center text-white font-bold mb-5 group-hover:scale-105 transition-transform">
                  ◈
                </div>
                <h3 className="font-bold text-lg mb-3">{f.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{f.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </SectionShell>
    </section>
  );
}

function LifecycleStepItem({
  num,
  title,
  body,
  delay = 0,
  isLast,
}: {
  num: number;
  title: string;
  body: string;
  delay?: number;
  isLast?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.45, delay: delay / 1000, ease: [0.22, 1, 0.36, 1] }}
      className="group flex items-start gap-4"
    >
      <div className="flex flex-col items-center shrink-0">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: delay / 1000 + 0.05, type: "spring", stiffness: 260, damping: 18 }}
          className="w-12 h-12 rounded-full flex items-center justify-center text-base font-extrabold text-[#E1F5EE] relative z-10 transition-transform duration-300 group-hover:scale-110"
          style={{
            background: "linear-gradient(135deg, #1a5c3a, #2D6A4F)",
            boxShadow: "0 8px 24px rgba(45,106,79,0.35)",
          }}
        >
          {num}
        </motion.div>
        {!isLast && (
          <motion.div
            initial={{ scaleY: 0 }}
            whileInView={{ scaleY: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: delay / 1000 + 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="w-0.5 flex-1 min-h-10 mt-1.5 origin-top"
            style={{
              background:
                "linear-gradient(to bottom, rgba(45,106,79,0.45), rgba(45,106,79,0.06))",
            }}
          />
        )}
      </div>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, delay: delay / 1000 + 0.1 }}
        className={cn(
          "flex-1 rounded-2xl border border-transparent px-4 py-3 -ml-1 transition-colors duration-300",
          "group-hover:border-border group-hover:bg-card/80 group-hover:shadow-sm",
          !isLast && "pb-6"
        )}
      >
        <p className="font-bold text-lg mb-2 text-foreground tracking-tight group-hover:text-trust transition-colors">
          {title}
        </p>
        <p className="text-base text-muted-foreground leading-relaxed">{body}</p>
      </motion.div>
    </motion.div>
  );
}

function LifecycleSection() {
  return (
    <section className="py-24 w-full bg-muted/30 border-y border-border overflow-hidden">
      <SectionShell>
        <div className="grid lg:grid-cols-[minmax(0,340px)_1fr] gap-12 lg:gap-20 items-start">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="lg:sticky lg:top-32"
          >
            <SectionEyebrow>Process</SectionEyebrow>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground leading-tight mb-5">
              From listed to completed
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Every initiative follows a structured path from discovery to verified
              impact, visible to partners at every stage.
            </p>
          </motion.div>

          <div className="flex flex-col max-w-2xl">
            {LIFECYCLE_STEPS.map((s, i) => (
              <LifecycleStepItem
                key={s.step}
                num={i + 1}
                title={s.step}
                body={s.desc}
                delay={i * 80}
                isLast={i === LIFECYCLE_STEPS.length - 1}
              />
            ))}
          </div>
        </div>
      </SectionShell>
    </section>
  );
}

{/*function DashboardSection() {
  return (
    <section
      data-reveal
      className="py-24 w-full border-b border-border bg-card"
    >
      <SectionShell>
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2 h-2 rounded-full bg-trust animate-pulse" />
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Live operations dashboard
          </p>
        </div>
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-10">
          Marketplace activity at a glance
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {METRICS.map((m, i) => (
            <MetricCard key={m.label} {...m} delay={i * 80} />
          ))}
        </div>
        <div className="grid lg:grid-cols-2 gap-4">
          {INITIATIVES.slice(0, 4).map((ini) => (
            <InitiativeListRow key={ini.id} initiative={ini} />
          ))}
        </div>
      </SectionShell>
    </section>
  );
}*/}

function PartnershipSection() {
  return (
    <section data-reveal className="py-6 w-full" style={{ background: "#f9f6f3" }}>
      <SectionShell>
        <GreenCard className="py-16 md:py-20 px-6 md:px-12">
          <p
            className="text-l font-semibold uppercase tracking-widest mb-4"
            style={{ color: "#B85C38" }}
          >
            Partnership types
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-10 max-w-xl">
            Every initiative needs a different kind of support
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {PARTNERSHIP_TYPES.map((pt) => (
              <div
                key={pt.title}
                className={cn(
                  "rounded-2xl p-6 border transition-colors hover:border-white/30",
                  pt.isEsg && "border-dashed"
                )}
                style={{
                  background: pt.isEsg
                    ? "rgba(107,158,120,0.1)"
                    : "rgba(255,255,255,0.05)",
                  borderColor: "rgba(255,255,255,0.12)",
                }}
              >

                <div className="flex items-center gap-2 mb-3">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ background: pt.accent }}
                  />
                  <h3 className="font-bold text-white">{pt.title}</h3>
                </div>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: "rgba(255,255,255,0.65)" }}
                >
                  {pt.body}
                </p>
              </div>
            ))}
          </div>
        </GreenCard>
      </SectionShell>
    </section>
  );
}

// ─── Featured Initiatives Section ────────────────────────────────────────────
function FeaturedInitiativesSection({ onCreateClick }: { onCreateClick: () => void }) {
  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    async function fetchInitiatives() {
      const { data, error } = await supabase
        .from('initiative_requests')
        .select('*')
        .eq('status', 'published')
        .order('created_at', { ascending: false });
      if (error) console.error('Failed to fetch initiatives:', error);
      else setInitiatives(data ?? []);
      setLoadingData(false);
    }
    fetchInitiatives();
  }, []);

  const { sectors, locations, statuses, partners } = useDynamicFilters(initiatives);

  const [selectedSectors,   setSelectedSectors]   = useState<string[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedStatuses,  setSelectedStatuses]  = useState<InitiativeStatus[]>([]);
  const [selectedPartners,  setSelectedPartners]  = useState<PartnershipType[]>([]);
  const [search, setSearch] = useState("");

  function toggle<T>(list: T[], item: T): T[] {
    return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
  }

  const filtered = initiatives.filter((ini) => {
    if (selectedSectors.length   && !selectedSectors.some((s)  => ini.sectors.includes(s)))    return false;
    if (selectedLocations.length && !selectedLocations.some((l) => ini.locations.includes(l)))  return false;
    if (selectedStatuses.length  && !selectedStatuses.includes(ini.status as InitiativeStatus))  return false;
    if (selectedPartners.length  && !selectedPartners.some((p)  => getOpenFor(ini).includes(p))) return false;
    if (search && !ini.title.toLowerCase().includes(search.toLowerCase()))                       return false;
    return true;
  });

  const hasFilters =
    selectedSectors.length > 0 || selectedLocations.length > 0 ||
    selectedStatuses.length > 0 || selectedPartners.length > 0 || search !== "";

  function clearAll() {
    setSelectedSectors([]);
    setSelectedLocations([]);
    setSelectedStatuses([]);
    setSelectedPartners([]);
    setSearch("");
  }

  return (
    <section id={INITIATIVES_SECTION_ID} data-reveal className="py-24 w-full scroll-mt-24">
      <SectionShell>
        <SectionEyebrow>Active initiatives</SectionEyebrow>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            Initiatives open for partnership
          </h2>
          <CreateInitiativeButton className="rounded-full bg-primary hover:bg-primary/90 text-white shrink-0" onClick={onCreateClick}>
            + Create Initiative
          </CreateInitiativeButton>
        </div>

        <Card className="mb-10">
          <CardContent className="pt-6">
            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
              {/* Search */}
              <div className="relative lg:col-span-1">
                {!search && (
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                )}
                <Input
                  type="search"
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-3"
                />
              </div>

              <MultiSelectDropdown
                label="Sector"
                options={sectors}
                selected={selectedSectors}
                onToggle={(v) => setSelectedSectors(toggle(selectedSectors, v))}
              />
              <MultiSelectDropdown
                label="Location"
                options={locations}
                selected={selectedLocations}
                onToggle={(v) => setSelectedLocations(toggle(selectedLocations, v))}
              />
              <MultiSelectDropdown
                label="Statu"
                options={statuses}
                selected={selectedStatuses}
                onToggle={(v) => setSelectedStatuses(toggle(selectedStatuses, v))}
              />
              <MultiSelectDropdown
                label="Partnership"
                options={partners}
                selected={selectedPartners}
                onToggle={(v) => setSelectedPartners(toggle(selectedPartners, v))}
                formatLabel={(v) => PARTNERSHIP_CONFIG[v].label}
              />
            </div>

            {hasFilters && (
              <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border">
                <span className="text-sm text-muted-foreground">
                {filtered.length} of {initiatives.length} initiatives match
                </span>
                <button type="button" onClick={clearAll}
                  className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                  <X className="w-3.5 h-3.5" /> Clear all
                </button>
              </div>
            )}
          </CardContent>
        </Card>

        {loadingData ? (
          <div className="text-center py-16 text-muted-foreground">Loading initiatives...</div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {filtered.map((ini) => (
              <InitiativeCard key={ini.id} initiative={ini} />
            ))}
          </div>
        )}

        {!loadingData && filtered.length === 0 && (
          <div className="text-center py-16">
            <p className="text-4xl mb-4">🌱</p>
            <h3 className="text-xl font-bold mb-2">No initiatives match your filters</h3>
            <p className="text-muted-foreground mb-6">Try adjusting your filters or be the first to publish.</p>
            <CreateInitiativeButton className="rounded-full bg-primary hover:bg-primary/90 text-white" onClick={onCreateClick} />
          </div>
        )}
      </SectionShell>
    </section>
  );
}

function CredibilitySection() {
  return (
    <section
      data-reveal
      className="py-24 w-full bg-muted/30 border-y border-border"
    >
      <SectionShell>
        <div className="grid md:grid-cols-2 gap-16 items-center">
          <div>
            <SectionEyebrow>Reputation</SectionEyebrow>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6">
              Every completed initiative builds your record
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Every completed initiative contributes to the credibility of the
              organisations and individuals involved.
            </p>
          </div>
          <ul className="space-y-4">
            {CREDIBILITY_ITEMS.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-trust flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="w-3.5 h-3.5 text-white" />
                </span>
                <span className="text-foreground leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </SectionShell>
    </section>
  );
}

function FinalCTASection({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <section
      data-reveal
      className="py-24 w-full bg-card border-t border-border text-center"
    >
      <SectionShell>
        <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4 max-w-3xl mx-auto">
          Some of the best ideas are still waiting{" "}
          <span className="text-primary">for the right people.</span>
        </h2>
        <p className="text-xl font-medium text-foreground/80 mb-4">
          Be the one who helps bring them to life.
        </p>
        <p className="text-lg text-muted-foreground mb-10 max-w-xl mx-auto leading-relaxed">
          Publish an initiative, discover opportunities, or help bring an
          important idea to life.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
        <CreateInitiativeButton
            size="lg"
            className="h-12 px-8 rounded-full bg-primary hover:bg-primary/90 text-white font-semibold"
            onClick={onCreateClick}
          />
          <BrowseInitiativesButton
            size="lg"
            className="h-12 px-8 rounded-full font-semibold"
          >
            Explore Marketplace
          </BrowseInitiativesButton>
        </div>
      </SectionShell>
    </section>
  );
}

// ─── Root ────────────────────────────────────────────────────────────────────
export function ImpactMarketplace() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="flex flex-col w-full font-sans">
      <CreateInitiativeModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
      <HeroSection onCreateClick={() => setModalOpen(true)} />
      <WhySection />
      <FeaturedInitiativesSection onCreateClick={() => setModalOpen(true)} />
      <HowItWorksSection />
      <LifecycleSection />
      <CredibilitySection />
      {/*<DashboardSection /> */}
      <PartnershipSection />
      <FinalCTASection onCreateClick={() => setModalOpen(true)} />
    </div>
  );
}

export default ImpactMarketplace;
