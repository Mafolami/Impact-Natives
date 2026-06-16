import React from "react";
import { useRef, useEffect, useState } from "react";
// ─── Intersection observer hook ───────────────────────────────────────────────
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(true); // ← change false to true
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true); },
      { threshold }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return { ref, inView };
}
// ─── Section fade-in wrapper ──────────────────────────────────────────────────
function FadeIn({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const { ref, inView } = useInView();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? "translateY(0)" : "translateY(36px)",
        transition: `opacity 0.75s cubic-bezier(0.4,0,0.2,1) ${delay}ms, transform 0.75s cubic-bezier(0.4,0,0.2,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}
// ─── Pricing card ─────────────────────────────────────────────────────────────
type PricingTier = {
  label: string;
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
}: {
  tier: PricingTier;
  onOpen: () => void;
  delay: number;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <FadeIn delay={delay}>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          background: tier.featured
            ? "linear-gradient(160deg, #0D2018 0%, #0A1A10 60%, #071510 100%)"
            : hovered
              ? "linear-gradient(160deg, #f8fffe 0%, #f0f9f5 100%)"
              : "#ffffff",
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
              ? "0 24px 48px rgba(0,0,0,0.12), 0 4px 16px rgba(45,106,79,0.08)"
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
              fontSize: 10,
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
              fontSize: 14,
              color: tier.featured
                ? "rgba(225,245,238,0.6)"
                : "rgba(40,40,40,0.6)",
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
            borderTop: `1px solid ${tier.featured ? "rgba(45,106,79,0.25)" : "rgba(0,0,0,0.06)"}`,
            paddingTop: "1.75rem",
          }}
        >
          <p
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: tier.featured ? "#9FE1CB" : "#1a5c3a",
              letterSpacing: "-0.025em",
              margin: 0,
              lineHeight: 1,
            }}
          >
            {tier.price}
          </p>
          <p
            style={{
              fontSize: 12,
              color: tier.featured
                ? "rgba(225,245,238,0.35)"
                : "rgba(40,40,40,0.45)",
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
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase" as const,
              color: tier.featured
                ? "rgba(225,245,238,0.4)"
                : "rgba(40,40,40,0.4)",
              marginBottom: 6,
            }}
          >
            Outcome
          </p>
          <p
            style={{
              fontSize: 14,
              color: tier.featured ? "rgba(225,245,238,0.9)" : "#111",
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
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase" as const,
              color: tier.featured
                ? "rgba(225,245,238,0.4)"
                : "rgba(40,40,40,0.4)",
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
                    fontSize: 13,
                    color: tier.featured
                      ? "rgba(225,245,238,0.75)"
                      : "rgba(40,40,40,0.7)",
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
          onClick={onOpen}
          style={{
            width: "100%",
            padding: "14px 24px",
            background: tier.featured
              ? "linear-gradient(90deg, #2D6A4F, #3d8a6a)"
              : "transparent",
            color: tier.featured ? "#E1F5EE" : "#1a5c3a",
            border: `1.5px solid ${tier.featured ? "rgba(159,225,203,0.3)" : "#2D6A4F"}`,
            borderRadius: 12,
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.25s cubic-bezier(0.34,1.56,0.64,1)",
            letterSpacing: "0.01em",
            boxShadow: tier.featured
              ? "0 8px 24px rgba(45,106,79,0.3)"
              : "none",
          }}
          onMouseEnter={(e) => {
            const el = e.target as HTMLButtonElement;
            if (!tier.featured) {
              el.style.background = "linear-gradient(90deg, #1a5c3a, #2D6A4F)";
              el.style.color = "#E1F5EE";
              el.style.boxShadow = "0 8px 24px rgba(45,106,79,0.25)";
              el.style.transform = "translateY(-1px)";
            } else {
              el.style.boxShadow = "0 12px 32px rgba(45,106,79,0.45)";
              el.style.transform = "translateY(-1px)";
            }
          }}
          onMouseLeave={(e) => {
            const el = e.target as HTMLButtonElement;
            if (!tier.featured) {
              el.style.background = "transparent";
              el.style.color = "#1a5c3a";
              el.style.boxShadow = "none";
            }
            el.style.transform = "translateY(0)";
            if (tier.featured)
              el.style.boxShadow = "0 8px 24px rgba(45,106,79,0.3)";
          }}
        >
          {tier.cta}
        </button>
      </div>
    </FadeIn>
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
  delay: number;
  isLast?: boolean;
}) {
  const { ref, inView } = useInView(0.1);
  return (
    <div
      ref={ref}
      style={{
        display: "flex",
        gap: "1.75rem",
        opacity: inView ? 1 : 0,
        transform: inView ? "translateX(0)" : "translateX(-28px)",
        transition: `opacity 0.6s cubic-bezier(0.4,0,0.2,1) ${delay}ms, transform 0.6s cubic-bezier(0.4,0,0.2,1) ${delay}ms`,
        position: "relative" as const,
      }}
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
            fontSize: 15,
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
            fontSize: 16,
            marginBottom: 6,
            color: "#111",
            letterSpacing: "-0.01em",
          }}
        >
          {title}
        </p>
        <p
          style={{
            fontSize: 14,
            color: "rgba(40,40,40,0.55)",
            lineHeight: 1.7,
          }}
        >
          {body}
        </p>
      </div>
    </div>
  );
}
// ─── Outcome pill ─────────────────────────────────────────────────────────────
function OutcomePill({ text, delay }: { text: string; delay: number }) {
  const { ref, inView } = useInView(0.1);
  const [hovered, setHovered] = useState(false);
  return (
    <div
      ref={ref}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView
          ? "scale(1) translateY(0)"
          : "scale(0.94) translateY(12px)",
        transition: `opacity 0.5s ease ${delay}ms, transform 0.5s ease ${delay}ms, box-shadow 0.25s, border-color 0.25s, background 0.25s`,
        display: "flex",
        alignItems: "flex-start",
        gap: 14,
        padding: "20px 24px",
        background: hovered ? "#f0f9f5" : "#ffffff",
        border: `1.5px solid ${hovered ? "rgba(45,106,79,0.3)" : "rgba(0,0,0,0.07)"}`,
        borderRadius: 16,
        boxShadow: hovered
          ? "0 12px 32px rgba(45,106,79,0.12)"
          : "0 2px 12px rgba(0,0,0,0.05)",
        cursor: "default",
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
          fontSize: 14,
          color: "#111",
          lineHeight: 1.6,
          fontWeight: 500,
        }}
      >
        {text}
      </span>
    </div>
  );
}
// ─── Main component ───────────────────────────────────────────────────────────
const PRICING_TIERS: PricingTier[] = [
  {
    label: "Starter Lab",
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
    price: "$10,000 – $35,000",
    cta: "Start Standard Lab",
  },
  {
    label: "Strategic Lab",
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
    price: "$50,000 – $150,000+",
    cta: "Commission Strategic Lab",
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
  onOpen?: () => void;
}) {
  return (
    <div
      style={{
        width: "100%",
        background: "#f8f9f7",
        minHeight: "100vh",
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      }}
    >
      {/* ── SECTION 1: HERO ──────────────────────────────────────────────────── */}
      <section
        style={{
          position: "relative" as const,
          overflow: "hidden",
          background:
            "linear-gradient(160deg, #071510 0%, #0D2018 40%, #0a1a0e 100%)",
          padding: "7rem 2rem 6rem",
          textAlign: "center",
        }}
      >
        {/* Decorative orbs */}
        <div
          style={{
            position: "absolute" as const,
            top: "-10%",
            left: "20%",
            width: 600,
            height: 600,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(45,106,79,0.15) 0%, transparent 70%)",
            pointerEvents: "none" as const,
          }}
        />
        <div
          style={{
            position: "absolute" as const,
            bottom: "-20%",
            right: "10%",
            width: 500,
            height: 500,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(45,106,79,0.1) 0%, transparent 70%)",
            pointerEvents: "none" as const,
          }}
        />
        <div
          style={{
            position: "relative" as const,
            maxWidth: 780,
            margin: "0 auto",
          }}
        >
          <FadeIn>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: "rgba(45,106,79,0.15)",
                border: "1px solid rgba(45,106,79,0.3)",
                borderRadius: 100,
                padding: "6px 16px 6px 10px",
                marginBottom: "2rem",
              }}
            >
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#4ade80",
                  boxShadow: "0 0 8px rgba(74,222,128,0.8)",
                }}
              />
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase" as const,
                  color: "rgba(159,225,203,0.9)",
                  margin: 0,
                }}
              >
                Innovation Labs
              </p>
            </div>
            <h1
              style={{
                fontSize: "clamp(2.8rem, 6vw, 4.5rem)",
                fontWeight: 800,
                letterSpacing: "-0.035em",
                lineHeight: 1.08,
                color: "#E1F5EE",
                margin: "0 auto 1.5rem",
              }}
            >
              Commission an
              <br />
              <span
                style={{
                  background:
                    "linear-gradient(90deg, #4ade80, #9FE1CB, #2D6A4F)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                Innovation Lab
              </span>
            </h1>
            <p
              style={{
                fontSize: "clamp(1.05rem, 2.5vw, 1.25rem)",
                color: "rgba(225,245,238,0.7)",
                lineHeight: 1.65,
                maxWidth: 560,
                margin: "0 auto 0.75rem",
              }}
            >
              Turn a complex challenge into structured, multi-stakeholder
              execution.
            </p>
            <p
              style={{
                fontSize: 15,
                color: "rgba(225,245,238,0.45)",
                maxWidth: 460,
                margin: "0 auto 3rem",
                lineHeight: 1.7,
              }}
            >
              You define the problem. We design the coordination needed to solve
              it.
            </p>
            {/* Value anchor */}
            <div
              style={{
                display: "inline-block",
                background: "rgba(45,106,79,0.08)",
                border: "1px solid rgba(45,106,79,0.25)",
                borderRadius: 16,
                padding: "20px 28px",
                maxWidth: 560,
                marginBottom: "3rem",
                backdropFilter: "blur(8px)",
              }}
            >
              <p
                style={{
                  fontSize: 15,
                  color: "rgba(225,245,238,0.65)",
                  lineHeight: 1.75,
                  margin: 0,
                }}
              >
                Most impact initiatives fail at execution, not intention.
                Innovation Labs remove the coordination gap between
                organisations, funders, and implementers so real work can
                happen.
              </p>
            </div>
            {/* CTAs */}
            <div
              style={{
                display: "flex",
                gap: 14,
                justifyContent: "center",
                flexWrap: "wrap" as const,
              }}
            >
              <button
                type="button"
                onClick={onOpen}
                style={{
                  background:
                    "linear-gradient(90deg, #1a5c3a, #2D6A4F, #3d8a6a)",
                  color: "#E1F5EE",
                  border: "none",
                  borderRadius: 100,
                  padding: "15px 36px",
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: "pointer",
                  letterSpacing: "0.01em",
                  transition: "all 0.25s cubic-bezier(0.34,1.56,0.64,1)",
                  boxShadow: "0 12px 32px rgba(45,106,79,0.4)",
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLButtonElement).style.boxShadow =
                    "0 20px 40px rgba(45,106,79,0.55)";
                  (e.target as HTMLButtonElement).style.transform =
                    "translateY(-2px) scale(1.02)";
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLButtonElement).style.boxShadow =
                    "0 12px 32px rgba(45,106,79,0.4)";
                  (e.target as HTMLButtonElement).style.transform =
                    "translateY(0) scale(1)";
                }}
              >
                Start Lab Proposal
              </button>
              <a
                href="#how-it-works"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  color: "rgba(225,245,238,0.8)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 100,
                  padding: "15px 36px",
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: "pointer",
                  letterSpacing: "0.01em",
                  textDecoration: "none",
                  transition: "all 0.25s",
                  backdropFilter: "blur(8px)",
                  display: "inline-block",
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLAnchorElement).style.background =
                    "rgba(255,255,255,0.1)";
                  (e.target as HTMLAnchorElement).style.borderColor =
                    "rgba(255,255,255,0.2)";
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLAnchorElement).style.background =
                    "rgba(255,255,255,0.06)";
                  (e.target as HTMLAnchorElement).style.borderColor =
                    "rgba(255,255,255,0.12)";
                }}
              >
                See how it works ↓
              </a>
            </div>
          </FadeIn>
        </div>
      </section>
      {/* ── SECTION 2: PROBLEM REFRAME ─────────────────────────────────────────── */}
      <section
        style={{ padding: "6rem 2rem", maxWidth: 900, margin: "0 auto" }}
      >
        <FadeIn>
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase" as const,
              color: "#2D6A4F",
              marginBottom: "1rem",
            }}
          >
            Why this exists
          </p>
          <h2
            style={{
              fontSize: "clamp(1.6rem, 3.5vw, 2.4rem)",
              fontWeight: 800,
              letterSpacing: "-0.025em",
              marginBottom: "2.5rem",
              color: "#111",
              maxWidth: 560,
              lineHeight: 1.2,
            }}
          >
            When execution depends on multiple organisations, things break here:
          </h2>
        </FadeIn>
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
            <FadeIn key={item} delay={i * 110}>
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 18,
                  padding: "20px 24px",
                  background: "#fff",
                  border: "1.5px solid rgba(153,60,29,0.12)",
                  borderLeft: "4px solid rgba(153,60,29,0.5)",
                  borderRadius: 14,
                  boxShadow: "0 2px 16px rgba(0,0,0,0.05)",
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: "rgba(153,60,29,0.08)",
                    border: "1.5px solid rgba(153,60,29,0.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{ color: "#993C1D", fontSize: 13, fontWeight: 700 }}
                  >
                    ✕
                  </span>
                </div>
                <span
                  style={{
                    fontSize: 15,
                    color: "#222",
                    lineHeight: 1.6,
                    fontWeight: 500,
                  }}
                >
                  {item}
                </span>
              </div>
            </FadeIn>
          ))}
        </div>
        <FadeIn delay={380}>
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
                color: "#1a5c3a",
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              Innovation Labs exist to make coordination structured, not
              accidental.
            </p>
          </div>
        </FadeIn>
      </section>
      {/* ── SECTION 3: WHAT YOU'RE BUYING ─────────────────────────────────────── */}
      <section
        style={{
          background: "linear-gradient(160deg, #071510 0%, #0D2018 100%)",
          padding: "6rem 2rem",
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
              "radial-gradient(circle, rgba(45,106,79,0.12) 0%, transparent 70%)",
            pointerEvents: "none" as const,
          }}
        />
        <div
          style={{
            maxWidth: 900,
            margin: "0 auto",
            position: "relative" as const,
          }}
        >
          <FadeIn>
            <p
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase" as const,
                color: "rgba(159,225,203,0.6)",
                marginBottom: "1rem",
              }}
            >
              Core offer
            </p>
            <h2
              style={{
                fontSize: "clamp(1.6rem, 3.5vw, 2.4rem)",
                fontWeight: 800,
                letterSpacing: "-0.025em",
                marginBottom: "1.25rem",
                color: "#E1F5EE",
                lineHeight: 1.2,
              }}
            >
              A coordination system for real-world execution
            </h2>
          </FadeIn>
          <FadeIn delay={100}>
            <p
              style={{
                fontSize: 15,
                color: "rgba(225,245,238,0.55)",
                marginBottom: "2rem",
                lineHeight: 1.75,
                maxWidth: 580,
              }}
            >
              An Innovation Lab is not a workshop or advisory engagement. It is
              a structured environment where Natives:
            </p>
          </FadeIn>
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
            ].map((item, i) => (
              <FadeIn key={item} delay={150 + i * 80}>
                <div
                  style={{
                    display: "flex",
                    gap: 14,
                    alignItems: "flex-start",
                    padding: "18px 20px",
                    background: "rgba(45,106,79,0.08)",
                    border: "1px solid rgba(45,106,79,0.2)",
                    borderRadius: 14,
                    backdropFilter: "blur(8px)",
                  }}
                >
                  <span
                    style={{
                      color: "#9FE1CB",
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
                      fontSize: 14,
                      color: "rgba(225,245,238,0.85)",
                      lineHeight: 1.6,
                    }}
                  >
                    {item}
                  </span>
                </div>
              </FadeIn>
            ))}
          </div>
          <FadeIn delay={520}>
            <div
              style={{
                display: "inline-block",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(159,225,203,0.15)",
                borderRadius: 16,
                padding: "24px 32px",
                maxWidth: 520,
                backdropFilter: "blur(12px)",
              }}
            >
              <p
                style={{
                  fontSize: 13,
                  color: "rgba(225,245,238,0.45)",
                  margin: "0 0 8px",
                }}
              >
                You are not paying for meetings.
              </p>
              <p
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: "#9FE1CB",
                  margin: 0,
                  letterSpacing: "-0.01em",
                }}
              >
                You are paying for execution to become possible.
              </p>
            </div>
          </FadeIn>
        </div>
      </section>
      {/* ── SECTION 4: HOW IT WORKS ──────────────────────────────────────────── */}
      <section
        id="how-it-works"
        style={{ padding: "6rem 2rem", maxWidth: 900, margin: "0 auto" }}
      >
        <FadeIn>
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase" as const,
              color: "#2D6A4F",
              marginBottom: "1rem",
            }}
          >
            Process
          </p>
          <h2
            style={{
              fontSize: "clamp(1.6rem, 3.5vw, 2.4rem)",
              fontWeight: 800,
              letterSpacing: "-0.025em",
              marginBottom: "3.5rem",
              color: "#111",
              lineHeight: 1.2,
            }}
          >
            From challenge to coordinated execution
          </h2>
        </FadeIn>
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
              delay={i * 120}
              isLast={i === STEPS.length - 1}
            />
          ))}
        </div>
        <FadeIn delay={720}>
          <div style={{ marginTop: "3.5rem" }}>
            <button
              type="button"
              onClick={onOpen}
              style={{
                background: "linear-gradient(90deg, #1a5c3a, #2D6A4F)",
                color: "#E1F5EE",
                border: "none",
                borderRadius: 100,
                padding: "15px 36px",
                fontSize: 15,
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
            </button>
          </div>
        </FadeIn>
      </section>
      {/* ── SECTION 5: WHAT YOU GET ───────────────────────────────────────────── */}
      <section style={{ padding: "6rem 2rem", background: "#f0f7f4" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <FadeIn>
            <p
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase" as const,
                color: "#2D6A4F",
                marginBottom: "1rem",
              }}
            >
              Outcomes
            </p>
            <h2
              style={{
                fontSize: "clamp(1.6rem, 3.5vw, 2.4rem)",
                fontWeight: 800,
                letterSpacing: "-0.025em",
                marginBottom: "2.5rem",
                color: "#111",
                lineHeight: 1.2,
              }}
            >
              What changes when you run a Lab
            </h2>
          </FadeIn>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 14,
            }}
          >
            {OUTCOMES.map((o, i) => (
              <OutcomePill key={o} text={o} delay={i * 100} />
            ))}
          </div>
        </div>
      </section>
      {/* ── SECTION 6: PRICING ────────────────────────────────────────────────── */}
      <section style={{ padding: "6rem 2rem" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <FadeIn>
            <p
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase" as const,
                color: "#2D6A4F",
                marginBottom: "1rem",
              }}
            >
              Pricing
            </p>
            <h2
              style={{
                fontSize: "clamp(1.6rem, 3.5vw, 2.4rem)",
                fontWeight: 800,
                letterSpacing: "-0.025em",
                marginBottom: "0.5rem",
                color: "#111",
              }}
            >
              Choose your Lab scope
            </h2>
            <p
              style={{
                fontSize: 15,
                color: "rgba(40,40,40,0.5)",
                marginBottom: "3.5rem",
                letterSpacing: "0.01em",
              }}
            >
              Pricing reflects coordination complexity, not hours.
            </p>
          </FadeIn>
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
                delay={i * 130}
              />
            ))}
          </div>
        </div>
      </section>
      {/* ── SECTION 7: WHY WORTH IT ───────────────────────────────────────────── */}
      <section style={{ padding: "6rem 2rem", background: "#f8f9f7" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <FadeIn>
            <p
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase" as const,
                color: "#2D6A4F",
                marginBottom: "1rem",
              }}
            >
              Why organisations commission Labs
            </p>
            <h2
              style={{
                fontSize: "clamp(1.6rem, 3.5vw, 2.4rem)",
                fontWeight: 800,
                letterSpacing: "-0.025em",
                marginBottom: "1.25rem",
                color: "#111",
                maxWidth: 560,
                lineHeight: 1.2,
              }}
            >
              Because execution failure is almost always a coordination problem.
            </h2>
            <p
              style={{
                fontSize: 15,
                color: "rgba(40,40,40,0.55)",
                marginBottom: "2rem",
                lineHeight: 1.7,
              }}
            >
              Labs are used when:
            </p>
          </FadeIn>
          <div
            style={{
              display: "flex",
              flexDirection: "column" as const,
              gap: 12,
              maxWidth: 500,
              marginBottom: "2.5rem",
            }}
          >
            {WHY_BULLETS.map((b, i) => (
              <FadeIn key={b} delay={i * 100}>
                <div
                  style={{
                    display: "flex",
                    gap: 16,
                    alignItems: "center",
                    padding: "16px 20px",
                    background: "#fff",
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
                      fontSize: 15,
                      color: "#222",
                      lineHeight: 1.6,
                      fontWeight: 500,
                    }}
                  >
                    {b}
                  </span>
                </div>
              </FadeIn>
            ))}
          </div>
          <FadeIn delay={370}>
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
                  color: "#1a5c3a",
                  margin: 0,
                  lineHeight: 1.5,
                }}
              >
                This is infrastructure for execution, not advice.
              </p>
            </div>
          </FadeIn>
        </div>
      </section>
      {/* ── SECTION 8: FINAL CTA ──────────────────────────────────────────────── */}
      <section style={{ padding: "3rem 2rem 6rem" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <FadeIn>
            <div
              style={{
                position: "relative" as const,
                background:
                  "linear-gradient(160deg, #071510 0%, #0D2018 50%, #071510 100%)",
                border: "1px solid rgba(45,106,79,0.3)",
                borderRadius: 24,
                padding: "4.5rem 3rem",
                textAlign: "center",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute" as const,
                  top: "-40%",
                  left: "-10%",
                  width: 500,
                  height: 500,
                  borderRadius: "50%",
                  background:
                    "radial-gradient(circle, rgba(45,106,79,0.15) 0%, transparent 70%)",
                  pointerEvents: "none" as const,
                }}
              />
              <div
                style={{
                  position: "absolute" as const,
                  bottom: "-40%",
                  right: "-10%",
                  width: 400,
                  height: 400,
                  borderRadius: "50%",
                  background:
                    "radial-gradient(circle, rgba(45,106,79,0.12) 0%, transparent 70%)",
                  pointerEvents: "none" as const,
                }}
              />
              <div style={{ position: "relative" as const }}>
                <h2
                  style={{
                    fontSize: "clamp(1.8rem, 4vw, 2.8rem)",
                    fontWeight: 800,
                    letterSpacing: "-0.03em",
                    color: "#E1F5EE",
                    marginBottom: "1.25rem",
                    lineHeight: 1.15,
                  }}
                >
                  Ready to turn your challenge into
                  <br />
                  <span
                    style={{
                      background: "linear-gradient(90deg, #4ade80, #9FE1CB)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                    }}
                  >
                    structured execution?
                  </span>
                </h2>
                <p
                  style={{
                    fontSize: 15,
                    color: "rgba(225,245,238,0.5)",
                    maxWidth: 440,
                    margin: "0 auto 3rem",
                    lineHeight: 1.75,
                  }}
                >
                  Submit your Lab proposal. We will assess scope and recommend
                  the right coordination structure.
                </p>
                <div
                  style={{
                    display: "flex",
                    gap: 14,
                    justifyContent: "center",
                    flexWrap: "wrap" as const,
                  }}
                >
                  <button
                    type="button"
                    onClick={onOpen}
                    style={{
                      background:
                        "linear-gradient(90deg, #1a5c3a, #2D6A4F, #3d8a6a)",
                      color: "#E1F5EE",
                      border: "none",
                      borderRadius: 100,
                      padding: "15px 36px",
                      fontSize: 15,
                      fontWeight: 700,
                      cursor: "pointer",
                      letterSpacing: "0.01em",
                      transition: "all 0.25s cubic-bezier(0.34,1.56,0.64,1)",
                      boxShadow: "0 12px 32px rgba(45,106,79,0.45)",
                    }}
                    onMouseEnter={(e) => {
                      (e.target as HTMLButtonElement).style.boxShadow =
                        "0 20px 48px rgba(45,106,79,0.6)";
                      (e.target as HTMLButtonElement).style.transform =
                        "translateY(-2px) scale(1.02)";
                    }}
                    onMouseLeave={(e) => {
                      (e.target as HTMLButtonElement).style.boxShadow =
                        "0 12px 32px rgba(45,106,79,0.45)";
                      (e.target as HTMLButtonElement).style.transform =
                        "translateY(0) scale(1)";
                    }}
                  >
                    Start Lab Proposal
                  </button>
                  <a
                    href="mailto:labs@impactnatives.com"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      color: "rgba(225,245,238,0.7)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: 100,
                      padding: "15px 36px",
                      fontSize: 15,
                      fontWeight: 600,
                      cursor: "pointer",
                      letterSpacing: "0.01em",
                      textDecoration: "none",
                      transition: "all 0.25s",
                      display: "inline-block",
                      backdropFilter: "blur(8px)",
                    }}
                    onMouseEnter={(e) => {
                      (e.target as HTMLAnchorElement).style.background =
                        "rgba(255,255,255,0.1)";
                      (e.target as HTMLAnchorElement).style.borderColor =
                        "rgba(255,255,255,0.2)";
                    }}
                    onMouseLeave={(e) => {
                      (e.target as HTMLAnchorElement).style.background =
                        "rgba(255,255,255,0.05)";
                      (e.target as HTMLAnchorElement).style.borderColor =
                        "rgba(255,255,255,0.12)";
                    }}
                  >
                    Talk to the team
                  </a>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>
    </div>
  );
}
