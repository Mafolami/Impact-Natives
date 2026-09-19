// ─── FitGauge.tsx ─────────────────────────────────────────────────────────────
// Donut chart for a partnership fit score (0 to 100). The ring fills clockwise from the top,
// coloured by band: 70+ green, 50 to 69 amber, under 50 red. The score sits in the middle.

export function fitBandLabel(score: number): string {
  if (score >= 70) return "Strong fit";
  if (score >= 50) return "Partial fit";
  return "Low fit";
}

export function fitBandColor(score: number): string {
  return score >= 70 ? "#2D6A4F" : score >= 50 ? "#F59E0B" : "#EF4444";
}

export default function FitGauge({ score, size = 104 }: { score: number; size?: number }) {
  const s = Math.max(0, Math.min(100, Math.round(Number.isFinite(score) ? score : 0)));
  const r = 42;
  const circumference = 2 * Math.PI * r;
  const color = fitBandColor(s);
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={`Partnership fit score: ${s} percent`} className="shrink-0">
      <circle cx="50" cy="50" r={r} fill="none" stroke="#2D6A4F" strokeOpacity="0.15" strokeWidth="10" />
      <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
        strokeDasharray={circumference} strokeDashoffset={circumference * (1 - s / 100)}
        transform="rotate(-90 50 50)" data-gauge-progress="1" />
      <text x="50" y="50" textAnchor="middle" dominantBaseline="central" fontSize="26" fontWeight="800" fill={color}>
        {s}<tspan fontSize="13" fontWeight="700">%</tspan>
      </text>
    </svg>
  );
}
