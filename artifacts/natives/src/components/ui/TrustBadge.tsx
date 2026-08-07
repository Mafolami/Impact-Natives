import { useState, useRef } from "react"
import { Award, Flag } from "lucide-react"
import type { TrustTier } from "@/lib/ddItems"

const TIER_STYLES: Record<Exclude<TrustTier, null>, { bg: string; color: string; icon: "award" | "flag" }> = {
  gold:    { bg: "rgba(196,152,38,0.14)", color: "#96721E", icon: "award" },
  silver:  { bg: "rgba(120,120,130,0.14)", color: "#5A5A66", icon: "award" },
  bronze:  { bg: "rgba(196,92,38,0.12)",  color: "#8A431A", icon: "award" },
  flagged: { bg: "rgba(220,38,38,0.10)",  color: "#B91C1C", icon: "flag" },
};

const TIER_TOOLTIPS: Record<Exclude<TrustTier, null>, string> = {
  gold: "DD Readiness is 90% or more complete, with no disclosed blacklisting or pending legal disputes. Self-attested, not independently verified.",
  silver: "DD Readiness is 60% or more complete, with no disclosed blacklisting or pending legal disputes. Self-attested, not independently verified.",
  bronze: "DD Readiness is 30% or more complete, with no disclosed blacklisting or pending legal disputes. Self-attested, not independently verified.",
  flagged: "This organisation has self-disclosed a current blacklisting by a government/regulatory agency and/or pending legal disputes, as part of their own DD Readiness declaration.",
};

export function TrustBadge({ tier, withTooltip }: { tier: TrustTier; withTooltip?: boolean }) {
  const [show, setShow] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (!tier) return null;
  const style = TIER_STYLES[tier];
  const Icon = style.icon === "flag" ? Flag : Award;
  const label = tier.charAt(0).toUpperCase() + tier.slice(1);

  function handleEnter() {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setShow(true);
  }
  function handleLeave() {
    hideTimer.current = setTimeout(() => setShow(false), 150);
  }

  return (
    <div className="relative inline-flex" onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      <span
        className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full cursor-default"
        style={{ background: style.bg, color: style.color }}>
        <Icon className="w-3 h-3" />
        {label}
      </span>
      {withTooltip && show && (
        <div className="absolute bottom-full left-0 mb-2 w-64 rounded-lg border border-border bg-popover shadow-lg px-3 py-2.5 z-50">
          <p className="text-xs font-medium text-foreground mb-1">{label} tier</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{TIER_TOOLTIPS[tier]}</p>
        </div>
      )}
    </div>
  );
}