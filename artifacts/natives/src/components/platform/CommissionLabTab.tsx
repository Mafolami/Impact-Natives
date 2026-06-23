import React, { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { HatGlasses } from "lucide-react";

const HeroSlideshow = () => {
  const images = [
    { src: "/innov10.png" },
    { src: "/innov8.png" },
    { src: "/innov9.png" },
    { src: "/innov11.png" },
  ];
  const [active, setActive] = React.useState(0);
  const activeRef = React.useRef(0);
  React.useEffect(() => {
    const timer = setInterval(() => {
      const next = (activeRef.current + 1) % images.length;
      setActive(next);
      activeRef.current = next;
    }, 8000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="hero-image-wrapper">
      <style>{`
        @keyframes slowRotate {
          from { transform: rotate(-1.5deg) scale(1); }
          to   { transform: rotate(1.5deg) scale(1.03); }
        }
        .hero-image-wrapper {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 300px;
          position: relative;
        }
        .hero-slide {
          position: absolute;
          width: 90%;
          max-width: 420px;
          pointer-events: none;
          transition: opacity 2s ease-in-out;
          animation: slowRotate 8s ease-in-out infinite alternate;
        }
        .hero-slide.active {
          opacity: 1;
          z-index: 4;
        }
        .hero-slide.inactive {
          opacity: 0;
          z-index: 3;
        }
        @media (max-width: 768px) {
          .hero-image-wrapper {
            min-height: 260px;
            width: 100%;
            margin-top: 10rem;
            align-self: stretch;
          }
          .hero-slide {
            width: 80%;
            max-width: 300px;
          }
        }
      `}</style>
      {images.map((img, i) => (
        <div
          key={img.src}
          className={`hero-slide ${i === active ? "active" : "inactive"}`}
        >
          <img src={img.src} alt="" style={{ width: "100%", height: "auto", display: "block" }} />
        </div>
      ))}
    </div>
  );
};



// ─── Pricing card ─────────────────────────────────────────────────────────────
type PricingTier = {
  label: string;
  tierKey: "starter" | "standard" | "strategic";
  badge?: string;
  accent: string;
  accentText: string;
  bestFor: string;
  outcome: string;
  includes: string[];
  price: string;
  cta: string;
  featured?: boolean;
};

function PricingCard({
  tier,
  onOpen,
  delay,
}: { tier: PricingTier; onOpen: (tier: "starter" | "standard" | "strategic") => void; delay?: number }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div >
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={!tier.featured ? "pricing-card-hover" : ""}
        style={{
          background: tier.featured
            ? "linear-gradient(160deg, #0D2018 0%, #0A1A10 60%, #071510 100%)"
            : undefined,          
          border: tier.featured
            ? "1.5px solid rgba(45,106,79,0.6)"
            : `1.5px solid ${hovered ? "rgba(45,106,79,0.35)" : "rgba(0,0,0,0.07)"}`,
          borderRadius: 20,
          padding: "2.5rem",
          display: "flex",
          flexDirection: "column" as const,
          gap: "2rem",
          position: "relative" as const,
          transition:
            "border-color 0.3s, transform 0.35s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.3s, background 0.3s",
          transform: hovered
            ? "translateY(-8px) scale(1.01)"
            : "translateY(0) scale(1)",
          boxShadow: tier.featured
            ? hovered
              ? "0 32px 64px rgba(45,106,79,0.35), 0 0 0 1px rgba(45,106,79,0.2)"
              : "0 20px 48px rgba(45,106,79,0.2), 0 0 0 1px rgba(45,106,79,0.1)"
            : hovered
              ? "0 24px 48px rgba(45,106,79,0.25), 0 0 0 1px rgba(45,106,79,0.2)"
              : "0 4px 24px rgba(0,0,0,0.06)",
        }}
      >
        {tier.badge && (
          <div
            style={{
              position: "absolute" as const,
              top: -14,
              left: "50%",
              transform: "translateX(-50%)",
              background: "linear-gradient(90deg, #1a5c3a, #2D6A4F, #3d8a6a)",
              color: "#E1F5EE",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.12em",
              padding: "5px 18px",
              borderRadius: 20,
              textTransform: "uppercase" as const,
              whiteSpace: "nowrap" as const,
              boxShadow: "0 4px 16px rgba(45,106,79,0.4)",
            }}
          >
            {tier.badge}
          </div>
        )}
        {/* Tier header */}
        <div>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              background: tier.accent,
              color: tier.accentText,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.1em",
              padding: "5px 12px",
              borderRadius: 8,
              marginBottom: 14,
              textTransform: "uppercase" as const,
              border: tier.featured
                ? "1px solid rgba(159,225,203,0.2)"
                : "1px solid rgba(45,106,79,0.15)",
            }}
          >
            {tier.label}
          </div>
          <p
            style={{
              fontSize: 16,
              color: tier.featured
                ? "rgba(225,245,238,0.6)"
                : "hsl(var(--muted-foreground))",
              lineHeight: 1.65,
              margin: 0,
            }}
          >
            {tier.bestFor}
          </p>
        </div>
        {/* Price */}
        <div
          style={{
            borderTop: `1px solid ${tier.featured ? "rgba(45,106,79,0.25)" : "hsl(var(--border))"}`,
            paddingTop: "1.75rem",
          }}
        >
<p
            style={{
              fontSize: tier.price ? 32 : 17,
              fontWeight: 700,
              color: tier.featured ? "#9FE1CB" : "#1a5c3a",
              letterSpacing: "-0.025em",
              margin: 0,
              lineHeight: 1,
            }}
          >
            {tier.price || "Scoped to your needs"}
          </p>
          <p
            style={{
              fontSize: 12,
              color: tier.featured
                ? "rgba(225,245,238,0.35)"
                : "hsl(var(--muted-foreground))",
              marginTop: 6,
              letterSpacing: "0.01em",
            }}
          >
            Coordination complexity-based
          </p>
        </div>
        {/* Outcome */}
        <div
          style={{
            background: tier.featured
              ? "rgba(45,106,79,0.12)"
              : "rgba(45,106,79,0.04)",
            border: tier.featured
              ? "1px solid rgba(45,106,79,0.2)"
              : "1px solid rgba(45,106,79,0.1)",
            borderRadius: 12,
            padding: "1rem 1.25rem",
          }}
        >
          <p
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase" as const,
              color: tier.featured
                ? "rgba(225,245,238,0.4)"
                : "hsl(var(--muted-foreground))",
              marginBottom: 6,
            }}
          >
            Outcome
          </p>
          <p
            style={{
              fontSize: 16,
              color: tier.featured ? "rgba(225,245,238,0.9)" : "hsl(var(--foreground))",
              lineHeight: 1.55,
              margin: 0,
              fontWeight: 500,
            }}
          >
            {tier.outcome}
          </p>
        </div>
        {/* Includes */}
        <div style={{ flex: 1 }}>
          <p
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase" as const,
              color: tier.featured
                ? "rgba(225,245,238,0.4)"
                : "hsl(var(--muted-foreground))",
              marginBottom: 14,
            }}
          >
            Includes
          </p>
          <div
            style={{
              display: "flex",
              flexDirection: "column" as const,
              gap: 10,
            }}
          >
            {tier.includes.map((item) => (
              <div
                key={item}
                style={{ display: "flex", alignItems: "flex-start", gap: 10 }}
              >
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: tier.featured
                      ? "rgba(45,106,79,0.3)"
                      : "rgba(45,106,79,0.08)",
                    border: "1px solid rgba(45,106,79,0.25)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    marginTop: 1,
                  }}
                >
                  <span
                    style={{
                      color: tier.featured ? "#9FE1CB" : "#2D6A4F",
                      fontSize: 10,
                      fontWeight: 700,
                    }}
                  >
                    →
                  </span>
                </div>
                <span
                  style={{
                    fontSize: 17,
                    color: tier.featured
                      ? "rgba(225,245,238,0.75)"
                      : "hsl(var(--muted-foreground))",
                    lineHeight: 1.55,
                  }}
                >
                  {item}
                </span>
              </div>
            ))}
          </div>
        </div>
        {/* CTA */}
        <button
          type="button"
          onClick={() => onOpen(tier.tierKey as "starter" | "standard" | "strategic")}
          className={tier.featured ? "btn-lab w-full" : "btn-lab-outline w-full"}
          style={!tier.featured ? {
            background: "transparent",
            color: "hsl(var(--trust))",
            border: "1.5px solid #2D6A4F",
          } : undefined}
        >
          {tier.cta}
        </button>
      </div>
    </div>
  );
}
// ─── Step flow item ───────────────────────────────────────────────────────────
function StepItem({
  num,
  title,
  body,
  delay,
  isLast,
}: {
  num: number;
  title: string;
  body: string;
  delay?: number
  isLast?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.94 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay: (delay ?? 0) / 1000 }}
      style={{ display: "flex", alignItems: "flex-start", gap: 12 }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column" as const,
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #1a5c3a, #2D6A4F)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            fontSize: 17,
            fontWeight: 800,
            color: "#E1F5EE",
            boxShadow: "0 8px 20px rgba(45,106,79,0.3)",
            position: "relative" as const,
            zIndex: 1,
          }}
        >
          {num}
        </div>
        {!isLast && (
          <div
            style={{
              width: 2,
              flex: 1,
              minHeight: 32,
              background:
                "linear-gradient(to bottom, rgba(45,106,79,0.4), rgba(45,106,79,0.05))",
              marginTop: 4,
            }}
          />
        )}
      </div>
      <div style={{ paddingTop: 10, paddingBottom: isLast ? 0 : "2rem" }}>
        <p
          style={{
            fontWeight: 700,
            fontSize: 18,
            marginBottom: 6,
            color: "hsl(var(--foreground))",
            letterSpacing: "-0.01em",
          }}
        >
          {title}
        </p>
        <p
          style={{
            fontSize: 16,
            color: "hsl(var(--muted-foreground))",
            lineHeight: 1.7,
          }}
        >
          {body}
        </p>
      </div>
    </motion.div>
  );
}
// ─── Outcome pill ─────────────────────────────────────────────────────────────
function OutcomePill({ text, delay = 0 }: { text: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.94 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay: (delay ?? 0) / 1000 }}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        background: "hsl(var(--card))",
        border: "1px solid hsl(var(--border))",
        borderRadius: "12px 12px 0 0",
        padding: "16px 20px",
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: "linear-gradient(135deg, #1a5c3a, #2D6A4F)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          boxShadow: "0 4px 12px rgba(45,106,79,0.3)",
        }}
      >
        <span style={{ color: "#E1F5EE", fontWeight: 700, fontSize: 13 }}>
          ✓
        </span>
      </div>
      <span
        style={{
          fontSize: 16,
          color: "hsl(var(--foreground))",
          lineHeight: 1.6,
          fontWeight: 500,
        }}
      >
        {text}
      </span>
    </motion.div>
  );
}
// ─── Main component ───────────────────────────────────────────────────────────
const PRICING_TIERS: PricingTier[] = [
  {
    label: "Starter Lab",
    tierKey: "starter",
    accent: "rgba(45,106,79,0.08)",
    accentText: "#1a5c3a",
    bestFor: "Focused challenges with 1–2 external partners",
    outcome: "Early coordination structure for a defined initiative",
    includes: [
      "Challenge structuring",
      "Limited stakeholder mapping",
      "1 coordination cycle (2–4 weeks)",
      "Basic facilitation + documentation",
    ],
    price: "$2,500 – $7,500",
    cta: "Start Starter Lab",
  },
  {
    label: "Standard Lab",
    tierKey: "standard",
    badge: "Most popular",
    featured: true,
    accent: "rgba(45,106,79,0.2)",
    accentText: "#9FE1CB",
    bestFor: "Multi-stakeholder initiatives requiring alignment",
    outcome: "Structured execution across organisations",
    includes: [
      "Full coordination architecture design",
      "Stakeholder identification + onboarding",
      "Multi-actor facilitation (6–10 weeks)",
      "Milestone tracking framework",
      "Outcome documentation",
    ],
    price: "",
    cta: "Discuss Scope",
  },
  {
    label: "Strategic Lab",
    tierKey: "strategic",
    accent: "rgba(45,106,79,0.08)",
    accentText: "#1a5c3a",
    bestFor: "Government, DFIs, large foundations, system-wide programs",
    outcome: "Cross-sector coordination for large-scale execution",
    includes: [
      "System-level coordination design",
      "Coalition building across sectors",
      "Extended facilitation (8–16+ weeks)",
      "Institutional alignment support",
      "Detailed outcome + ecosystem report",
    ],
    price: "",
    cta: "Let's Talk",
  },
];
const STEPS = [
  {
    title: "Submit your challenge",
    body: "Define the problem, expected outcome, stakeholders, and budget.",
  },
  {
    title: "We design the Lab structure",
    body: "We translate your challenge into a coordination framework.",
  },
  {
    title: "We bring in the right actors",
    body: "We identify and align organisations needed for execution.",
  },
  {
    title: "Structured collaboration begins",
    body: "Stakeholders operate within a guided coordination process.",
  },
  {
    title: "Outcomes are delivered and documented",
    body: "You get structured outputs and a reusable coordination model.",
  },
];
const OUTCOMES = [
  "Coordination becomes structured instead of fragmented",
  "Stakeholders move from discussion to execution",
  "Decision-making becomes clearer across organisations",
  "Delivery timelines shorten because alignment is built in",
  "Outcomes are documented and reusable",
];
const WHY_BULLETS = [
  "Timelines are critical",
  "Multiple actors must align",
  "Outcomes depend on cooperation, not individual performance",
];
export function CommissionLabTab({
  onOpen = () => {},
}: {
  onOpen?: (tier: "starter" | "standard" | "strategic") => void;
}) {
  return (
      <div
      style={{
        width: "100%",
        minHeight: "100vh",
      }}
      className="bg-background"
    >
     {/* ── SECTION 1: HERO ──────────────────────────────────────────────────── */}
     <style>{`
  @keyframes chameleonBg {
    0%   { background-position: 0% 50%; }
    25%  { background-position: 50% 100%; }
    50%  { background-position: 100% 50%; }
    75%  { background-position: 50% 0%; }
    100% { background-position: 0% 50%; }
  }
  .hero-chameleon {
    background: linear-gradient(
      135deg,
      #060f09,
      #0d1a08,
      #0a0f04,
      #1a0a04,
      #0f0602,
      #060f09
    );
    background-size: 400% 400%;
    animation: chameleonBg 10s ease infinite;
  }
  .hero-inner {
    position: relative;
    width: 100%;
    padding: 10rem clamp(1.5rem, 5vw, 6rem) 6rem;
    zIndex: 4;
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 2rem;
  }
  .hero-content-wrapper {
    flex: 1;
    min-width: 0;
  }
  @media (max-width: 768px) {
  .hero-inner {
    display: flex !important;
    flex-direction: column !important;
    padding: 3rem 1.5rem 3rem !important;
  }
  .hero-content-wrapper {
    order: 0 !important;
    width: 100% !important;
  }
  .hero-image-wrapper {
    order: 1 !important;
  }
}
`}</style>
<section
  data-reveal
  className="hero-chameleon"
  style={{
    position: "relative" as const,
    overflow: "hidden",
    width: "100vw",
    marginLeft: "calc(-50vw + 50%)",
    marginTop: "-64px",
    paddingTop: "64px",
  }}
>
  {/* Overlay */}
  <div style={{
    position: "absolute" as const,
    inset: 0,
    background: "rgba(0,0,0,0.35)",
    zIndex: 1,
    pointerEvents: "none" as const,
  }} />
  {/* Decorative orbs */}
  <div style={{
    position: "absolute" as const,
    top: "-10%",
    left: "20%",
    width: 600,
    height: 600,
    borderRadius: "50%",
    zIndex: 2,
    background: "radial-gradient(circle, rgba(194,65,12,0.25) 0%, transparent 70%)",
    pointerEvents: "none" as const,
  }} />
  <div style={{
    position: "absolute" as const,
    bottom: "-20%",
    right: "10%",
    width: 500,
    height: 500,
    zIndex: 2,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(180,83,9,0.18) 0%, transparent 70%)",
    pointerEvents: "none" as const,
  }} />

  {/* ── Main hero row ── */}
  <div className="hero-inner" style={{ position: "relative", zIndex: 4 }}>

    {/* Image — right (renders below text on mobile) */}
    {/* Text — left */}
    <div className="hero-content-wrapper">
      <div className="innovation-labs-badge" style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        borderRadius: 100,
        padding: "6px 16px 6px 10px",
        marginBottom: "2rem",
        marginLeft: 0,
      }}>
        <div style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: "#C2410C",
          boxShadow: "0 0 8px rgba(194,65,12,0.8)",
        }} />
        <p className="innovation-labs-text" style={{
          fontSize: 17,
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase" as const,
          margin: 0,
        }}>
          Innovation Labs
        </p>
      </div>
      <h1 style={{
        fontSize: "clamp(2.8rem, 6vw, 4.5rem)",
        fontWeight: 1000,
        letterSpacing: "-0.035em",
        lineHeight: 1.08,
        color: "#FFFFFF",
        margin: "0 0 1.5rem",
      }}>
        Commission an
        <br />
        Innovation Lab
      </h1>
      <p style={{
        fontSize: "clamp(1.05rem, 2.5vw, 1.25rem)",
        color: "#FFFFFF",
        lineHeight: 1.65,
        maxWidth: 560,
        margin: "0 0 0.75rem",
      }}>
        Turn a complex challenge into structured, multi-stakeholder execution.
      </p>
      <p style={{
        fontSize: 17,
        color: "#FFFFFF",
        maxWidth: 460,
        margin: "0 0 2rem",
        lineHeight: 1.7,
      }}>
        You define the problem. We design the coordination needed to solve it.
      </p>
      <div className="value-anchor-box" style={{
        display: "block",
        borderRadius: 16,
        padding: "20px 28px",
        maxWidth: 560,
        marginBottom: "2rem",
        backdropFilter: "blur(8px)",
      }}>
        <p className="value-anchor-text" style={{
          fontSize: 17,
          lineHeight: 1.75,
          margin: 0,
        }}>
          Most impact initiatives fail at execution. Innovation
          Labs remove the coordination gap between organisations, funders, and
          implementers so impact can happen seamlessly.
        </p>
      </div>
      <div style={{
        display: "flex",
        gap: 14,
        justifyContent: "flex-start",
        flexWrap: "wrap" as const,
      }}>
        <Button type="button" onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })} className="btn-lab">
          Start Lab Proposal
        </Button>
        <Button variant="outline" asChild>
          <a href="#how-it-works" className="btn-lab-outline">
            See how it works ↓
          </a>
        </Button>
      </div>
    </div>

    {/* Image — right */}
    <HeroSlideshow />

  </div>
</section>

      {/* ── SECTION 2: PROBLEM REFRAME ─────────────────────────────────────────── */}
      <section data-reveal 
        style={{ padding: "6rem clamp(1.5rem, 5vw, 6rem)", maxWidth: 1280, margin: "0 auto" }}
      >
        <div>
          <p
            style={{
              fontSize: 17,
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase" as const,
              color: "var(--primary)",
              marginBottom: "1rem",
            }}
          >
            Why this exists
          </p>
          <h2
            style={{
              fontSize: "clamp(1.6rem, 3.5vw, 2.4rem)",
              fontWeight: 700,
              letterSpacing: "-0.025em",
              marginBottom: "2.5rem",
              color: "hsl(var(--foreground))",
              maxWidth: 560,
              lineHeight: 1.2,
            }}
          >
            When execution depends on multiple organisations, things break here:
          </h2>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column" as const,
            gap: 14,
            maxWidth: 620,
          }}
        >
          {[
            "Stakeholders are aligned in theory, disconnected in practice",
            "Ownership is unclear across organisations",
            "Coordination slows down or never fully forms",
          ].map((item, i) => (
            <div key={item} >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 18,
                  padding: "20px 24px",
                  background: "hsl(var(--card))",
                  border: "1.5px solid rgba(153,60,29,0.12)",
                  borderLeft: "4px solid hsl(var(--border))",
                  borderRadius: 14,
                  boxShadow: "0 2px 16px rgba(0,0,0,0.05)",
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: "hsl(var(--muted))",
                    border: "1.5px solid hsl(var(--border))",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{ color: "hsl(var(--muted-foreground))", fontSize: 17, fontWeight: 700 }}
                  >
                    ✕
                  </span>
                </div>
                <span
                  style={{
                    fontSize: 17,
                    color: "hsl(var(--foreground))",
                    lineHeight: 1.6,
                    fontWeight: 500,
                  }}
                >
                  {item}
                </span>
              </div>
            </div>
          ))}
        </div>
        <div >
          <div
            style={{
              marginTop: "2.5rem",
              padding: "20px 24px",
              background:
                "linear-gradient(90deg, rgba(45,106,79,0.06), rgba(45,106,79,0.02))",
              borderLeft: "4px solid #2D6A4F",
              borderRadius: "0 12px 12px 0",
              maxWidth: 560,
            }}
          >
            <p
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: "hsl(var(--trust))",
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              Innovation Labs exist to make coordination structured, not
              accidental.
            </p>
          </div>
        </div>
      </section>
     {/* ── SECTION 3: WHAT YOU'RE BUYING ─────────────────────────────────────── */}
<style>{`
  @keyframes chameleonSectionBg {
    0%   { background-position: 0% 50%; }
    25%  { background-position: 50% 100%; }
    50%  { background-position: 100% 50%; }
    75%  { background-position: 50% 0%; }
    100% { background-position: 0% 50%; }
  }
  .section3-bg {
    background: linear-gradient(
      135deg,
      #1A0800,
      #7C2D12,
      #7C2D12,
      #92400E,
      #1A4D2E,
      #0D3B2E,
      #3D1608
    );
    background-size: 400% 400%;
    animation: chameleonSectionBg 10s ease infinite;
  }
`}</style>

<section
  data-reveal
  className="section3-bg"
  style={{
    padding: "6rem clamp(1.5rem, 5vw, 6rem)",
    position: "relative" as const,
    overflow: "hidden",
  }}
>
  <div
    style={{
      position: "absolute" as const,
      top: "-30%",
      right: "-10%",
      width: 600,
      height: 600,
      borderRadius: "50%",
      background:
        "radial-gradient(circle, rgba(194,65,12,0.2) 0%, transparent 70%)",
      pointerEvents: "none" as const,
    }}
  />
  <div
    style={{
      maxWidth: 1280,
      margin: "0 auto",
      position: "relative" as const,
    }}
  >
    <div>
      <p
        style={{
          fontSize: 17,
          fontWeight: 700,
          letterSpacing: "0.14em",
          textTransform: "uppercase" as const,
          color: "rgba(254,215,170,0.75)",
          marginBottom: "1rem",
        }}
      >
        Core offer
      </p>
      <h2
        style={{
          fontSize: "clamp(1.6rem, 3.5vw, 2.4rem)",
          fontWeight: 700,
          letterSpacing: "-0.025em",
          marginBottom: "1.25rem",
          color: "#FFF7ED",
          lineHeight: 1.2,
        }}
      >
        A coordination system for real-world execution
      </h2>
    </div>
    <div>
      <p
        style={{
          fontSize: 17,
          color: "rgba(255,247,237,0.6)",
          marginBottom: "2rem",
          lineHeight: 1.75,
          maxWidth: 580,
        }}
      >
        An Innovation Lab is not a workshop or advisory engagement. It is a
        structured environment where Natives:
      </p>
    </div>

    {/* Feature cards — solid static amber-orange */}
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        gap: 14,
        marginBottom: "3rem",
      }}
    >
      {[
        "Designs the coordination architecture",
        "Brings the right stakeholders together",
        "Defines how work moves between actors",
        "Ensures progress is tracked toward an agreed outcome",
      ].map((item) => (
        <div key={item}>
          <div
            style={{
              display: "flex",
              gap: 14,
              alignItems: "flex-start",
              padding: "18px 20px",
              background: "#FFFFFF",
              border: "1px solid rgba(0,0,0,0.08)",
              borderRadius: 14,
            }}
          >
            <span
              style={{
                color: "#111111",
                fontSize: 16,
                flexShrink: 0,
                marginTop: 1,
                fontWeight: 700,
              }}
            >
              →
            </span>
            <span
              style={{
                fontSize: 16,
                color: "#374151",
                lineHeight: 1.6,
                fontWeight: 600,
              }}
            >
              {item}
            </span>
          </div>
        </div>
      ))}
      </div>

    {/* Quote card — centered */}
    <div style={{ display: "flex", justifyContent: "center" }}>
      <div
        style={{
          background: "rgb(255, 250, 250)",
          border: "1px solid rgba(251,146,60,0.25)",
          borderRadius: 16,
          padding: "24px 32px",
          maxWidth: 520,
          width: "100%",
          backdropFilter: "blur(12px)",
          textAlign: "center" as const,
        }}
      >
        <p
          style={{
            fontSize: 20,
            color: "rgba(98, 39, 0, 0.5)",
            margin: "0 0 8px",
          }}
        >
          You are not paying for meetings.
        </p>
        <p
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: "#374151",
            margin: 0,
            letterSpacing: "-0.01em",
          }}
        >
          You are paying for execution to become possible.
        </p>
      </div>
    </div>
  </div>
</section>


      {/* ── SECTION 4: HOW IT WORKS ──────────────────────────────────────────── */}
      <section data-reveal 
        id="how-it-works"
        style={{ padding: "6rem clamp(1.5rem, 5vw, 6rem)", maxWidth: 1280, margin: "0 auto" }}
      >
        <div>
          <p
            style={{
              fontSize: 17,
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase" as const,
              color: "var(--primary)",
              marginBottom: "1rem",
            }}
          >
            Process
          </p>
          <h2
            style={{
              fontSize: "clamp(1.6rem, 3.5vw, 2.4rem)",
              fontWeight: 700,
              letterSpacing: "-0.025em",
              marginBottom: "3.5rem",
              color: "hsl(var(--foreground))",
              lineHeight: 1.2,
            }}
          >
            From challenge to coordinated execution
          </h2>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column" as const,
            maxWidth: 600,
          }}
        >
          {STEPS.map((step, i) => (
            <StepItem
              key={step.title}
              num={i + 1}
              title={step.title}
              body={step.body}
              
              isLast={i === STEPS.length - 1}
            />
          ))}
        </div>
        <div >
          <div style={{ marginTop: "3.5rem" }}>
            {/*<button
              type="button"
              onClick={() => onOpen(tier.tierKey as "starter" | "standard" | "strategic")}
              style={{
                background: "linear-gradient(90deg, #1a5c3a, #2D6A4F)",
                color: "#E1F5EE",
                border: "none",
                borderRadius: 100,
                padding: "15px 36px",
                fontSize: 17,
                fontWeight: 700,
                cursor: "pointer",
                letterSpacing: "0.01em",
                transition: "all 0.25s cubic-bezier(0.34,1.56,0.64,1)",
                boxShadow: "0 12px 32px rgba(45,106,79,0.3)",
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLButtonElement).style.boxShadow =
                  "0 20px 40px rgba(45,106,79,0.45)";
                (e.target as HTMLButtonElement).style.transform =
                  "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLButtonElement).style.boxShadow =
                  "0 12px 32px rgba(45,106,79,0.3)";
                (e.target as HTMLButtonElement).style.transform =
                  "translateY(0)";
              }}
            >
              Start Lab Proposal
            </button>*/}
          </div>
        </div>
      </section>

      {/* ── SECTION 5: WHAT YOU GET ───────────────────────────────────────────── */}
      <section
          data-reveal
          style={{
            padding: "6rem clamp(1.5rem, 5vw, 6rem)",
            background: `
              linear-gradient(135deg, hsl(var(--primary)/0.45) 0%, hsl(24 80% 50% / 0.08) 100%),
              hsl(var(--muted)/0.4)
            `,
            borderRadius: "12px 12px 0 0",
          }}
        >
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div>
            <p
              style={{
                fontSize: 17,
                fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase" as const,
                color: "var(--primary)",
                marginBottom: "1rem",
              }}
            >
              Outcomes
            </p>
            <h2
              style={{
                fontSize: "clamp(1.6rem, 3.5vw, 2.4rem)",
                fontWeight: 700,
                letterSpacing: "-0.025em",
                marginBottom: "2.5rem",
                color: "hsl(var(--foreground))",
                lineHeight: 1.2,
              }}
            >
              What changes when you run a Lab
            </h2>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 14,
            }}
          >
            {OUTCOMES.map((o, i) => (
              <OutcomePill key={o} text={o}  />
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 6: PRICING ────────────────────────────────────────────────── */}
            <section id="pricing" data-reveal style={{ padding: "6rem clamp(1.5rem, 5vw, 6rem)" }} className="bg-muted/30">
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div>
            <p
              style={{
                fontSize: 17,
                fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase" as const,
                color: "var(--primary)",
                marginBottom: "1rem",
              }}
            >
              Pricing
            </p>
            <h2
              style={{
                fontSize: "clamp(1.6rem, 3.5vw, 2.4rem)",
                fontWeight: 700,
                letterSpacing: "-0.025em",
                marginBottom: "0.5rem",
                color: "hsl(var(--foreground))",
              }}
            >
              Choose your Lab scope
            </h2>
            <p
              style={{
                fontSize: 17,
                color: "hsl(var(--muted-foreground))",
                marginBottom: "3.5rem",
                letterSpacing: "0.01em",
              }}
            >
              Pricing reflects coordination complexity, not hours.
            </p>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: 24,
              alignItems: "start",
            }}
          >
                        {PRICING_TIERS.map((tier, i) => (
              <PricingCard
                key={tier.label}
                tier={tier}
                onOpen={onOpen}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 7: WHY WORTH IT ───────────────────────────────────────────── */}
      <section data-reveal style={{ padding: "6rem clamp(1.5rem, 5vw, 6rem)" }} className="bg-muted/30">
  <div
    style={{
      maxWidth: 1280,
      margin: "0 auto",
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "4rem",
      alignItems: "center",
    }}
  >
    {/* Left: text content */}
    <div>
      <p
        style={{
          fontSize: 17,
          fontWeight: 700,
          letterSpacing: "0.14em",
          textTransform: "uppercase" as const,
          color: "var(--primary)",
          marginBottom: "1rem",
        }}
      >
        Why organisations commission Labs
      </p>
      <h2
        style={{
          fontSize: "clamp(1.6rem, 3.5vw, 2.4rem)",
          fontWeight: 700,
          letterSpacing: "-0.025em",
          marginBottom: "1.25rem",
          color: "hsl(var(--foreground))",
          maxWidth: 560,
          lineHeight: 1.2,
        }}
      >
        Because execution failure is almost always a coordination problem.
      </h2>
      <p
        style={{
          fontSize: 17,
          color: "hsl(var(--muted-foreground))",
          marginBottom: "2rem",
          lineHeight: 1.7,
        }}
      >
        Labs are used when:
      </p>

      <div
        style={{
          display: "flex",
          flexDirection: "column" as const,
          gap: 12,
          marginBottom: "2.5rem",
        }}
      >
        {WHY_BULLETS.map((b) => (
          <div key={b}>
            <div
              style={{
                display: "flex",
                gap: 16,
                alignItems: "center",
                padding: "16px 20px",
                background: "hsl(var(--card))",
                border: "1.5px solid rgba(0,0,0,0.07)",
                borderRadius: 12,
                boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #1a5c3a, #2D6A4F)",
                  flexShrink: 0,
                  boxShadow: "0 2px 8px rgba(45,106,79,0.4)",
                }}
              />
              <span
                style={{
                  fontSize: 17,
                  color: "hsl(var(--foreground))",
                  lineHeight: 1.6,
                  fontWeight: 500,
                }}
              >
                {b}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          padding: "20px 24px",
          background:
            "linear-gradient(90deg, rgba(45,106,79,0.06), rgba(45,106,79,0.01))",
          borderLeft: "4px solid #2D6A4F",
          borderRadius: "0 12px 12px 0",
          maxWidth: 480,
        }}
      >
        <p
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: "hsl(var(--trust))",
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          This is infrastructure for execution, not advice.
        </p>
      </div>
    </div>

    {/* Right: image */}
    <div
      style={{
        borderRadius: 16,
        overflow: "hidden",
        height: "100%",
        minHeight: 480,
      }}
    >
      <img
        src="/labss.png"
        alt="Ecosystem Lab session"
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "center",
          display: "block",
        }}
      />
    </div>
  </div>
</section>

      {/* ── SECTION 8: FINAL CTA ──────────────────────────────────────────────── */}
<section
  data-reveal
  style={{
    padding: "6rem clamp(1.5rem, 5vw, 6rem)",
    background: "linear-gradient(160deg,rgb(6, 35, 5) 0%,rgb(42, 28, 2) 40%,rgb(1, 38, 10) 100%)",
    borderRadius: "12px 12px 0 0",
    position: "relative" as const,
    overflow: "hidden",
  }}
>
  {/* Orbs */}
  <div style={{
    position: "absolute" as const,
    top: "-40%", left: "-10%",
    width: 500, height: 500,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(45,106,79,0.15) 0%, transparent 70%)",
    pointerEvents: "none" as const,
  }} />
  <div style={{
    position: "absolute" as const,
    bottom: "-40%", right: "-10%",
    width: 400, height: 400,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(74,222,128,0.10) 0%, transparent 70%)",
    pointerEvents: "none" as const,
  }} />

  <div style={{
    maxWidth: 1280,
    margin: "0 auto",
    position: "relative" as const,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    textAlign: "center" as const,
    gap: "3rem",
  }}>
    {/* Heading block */}
    <div>
      <h2 style={{
        fontSize: "clamp(1.8rem, 4vw, 2.8rem)",
        fontWeight: 700,
        letterSpacing: "-0.03em",
        color: "#E1F5EE",
        marginBottom: "1.25rem",
        lineHeight: 1.15,
      }}>
        Ready to turn your challenge into
        <br />
        <span style={{
          background: "linear-gradient(90deg, #4ade80, #86efac, #9FE1CB)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}>
          structured execution?
        </span>
      </h2>
      <p style={{
        fontSize: 17,
        color: "rgba(225,245,238,0.5)",
        maxWidth: 440,
        margin: "0 auto",
        lineHeight: 1.75,
      }}>
        Submit your Lab proposal. We will assess scope and recommend
        the right coordination structure.
      </p>
    </div>

    {/* Cards row */}
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
      gap: 14,
      width: "100%",
      maxWidth: 860,
    }}>
      
    </div>

    {/* Buttons */}
    <div style={{
      display: "flex",
      gap: 14,
      flexWrap: "wrap" as const,
      justifyContent: "center",
    }}>
      <button
        type="button"
        onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
        style={{
          background: "linear-gradient(90deg, #1a5c3a, #2D6A4F, #4ade80)",
          color: "#E1F5EE",
          border: "none",
          borderRadius: 100,
          padding: "15px 36px",
          fontSize: 17,
          fontWeight: 700,
          cursor: "pointer",
          letterSpacing: "0.01em",
          transition: "all 0.25s cubic-bezier(0.34,1.56,0.64,1)",
          boxShadow: "0 12px 32px rgba(45,106,79,0.45)",
        }}
        onMouseEnter={(e) => {
          (e.target as HTMLButtonElement).style.boxShadow = "0 20px 48px rgba(45,106,79,0.6)";
          (e.target as HTMLButtonElement).style.transform = "translateY(-2px) scale(1.02)";
        }}
        onMouseLeave={(e) => {
          (e.target as HTMLButtonElement).style.boxShadow = "0 12px 32px rgba(45,106,79,0.45)";
          (e.target as HTMLButtonElement).style.transform = "translateY(0) scale(1)";
        }}
      >
        Start Lab Proposal
      </button>
    </div>
    </div>
    </section>
  </div>
 );
}
