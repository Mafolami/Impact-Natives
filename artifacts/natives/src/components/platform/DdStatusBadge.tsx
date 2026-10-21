// src/components/platform/DdStatusBadge.tsx
//
// Small badges for match cards: the DD status for this deal size, and the
// kinds of support an initiative is seeking. See src/lib/matchDd.ts.

import { ShieldCheck, Handshake } from "lucide-react";
import { DD_BADGES, ddBadgeTitle, supportTypesText } from "@/lib/matchDd";

export function DdStatusBadge({ status, missing }: { status?: string | null; missing?: string[] | null }) {
  const badge = status ? DD_BADGES[status] : undefined;
  if (!badge) return null; // exempt (consultancy) or not computed yet
  return (
    <span title={ddBadgeTitle(missing)}
      className="inline-flex w-fit items-center gap-1 text-[13px] font-semibold px-2 py-0.5 rounded-full cursor-help"
      style={{ background: badge.background, color: badge.color }}>
      <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
      {badge.label}
    </span>
  );
}

export function SupportTypeChip({ types }: { types: unknown }) {
  const text = supportTypesText(types);
  if (!text) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[13px] font-semibold px-2 py-0.5 rounded-full"
      style={{ background: "rgba(51,65,85,0.10)", color: "#334155" }}>
      <Handshake className="w-3.5 h-3.5 shrink-0" />
      Seeking: {text}
    </span>
  );
}
