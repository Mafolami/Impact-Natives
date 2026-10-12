import { IS_APP_DOMAIN } from "@/lib/authLinks";

// How Impact Natives may share a published initiative or partnership listing
// outside the platform (social media, newsletter, direct introductions).
// Stored as sharing_preference on initiative_requests / partnership_listings.
// Rows created anywhere without a choice default to "ask_first" in the database.
export type SharingPref = "named" | "anonymous" | "ask_first" | "none";

export const SHARING_OPTIONS: { value: SharingPref; label: string; sub: string }[] = [
  { value: "anonymous", label: "Share it without naming us", sub: "We remove your organisation's name, logo, contact details and anything else that would identify you." },
  { value: "named",     label: "Share it and name us",       sub: "We credit your organisation when we share it." },
  { value: "ask_first", label: "Ask me first",               sub: "We contact you before sharing it anywhere." },
  { value: "none",      label: "Don't share it",             sub: "It stays on Natives only." },
];

const TERMS_HREF = (IS_APP_DOMAIN ? "https://www.impactnatives.com" : "") + "/legal/terms#content-you-post";

export function SharingPreference({ value, onChange, what = "initiative" }: {
  value: SharingPref; onChange: (v: SharingPref) => void; what?: string;
}) {
  return (
    <div>
      <p className="text-[16.5px] font-semibold text-[#1C1917]">Sharing outside Natives</p>
      <p className="text-[14.5px] leading-relaxed text-[#1C1917] mt-1.5 mb-4">
        To help your {what} reach the right partners, we may share it on social media, in our newsletter,
        or directly with funders and partners we think fit. Choose how. You can change this later.{" "}
        <a href={TERMS_HREF} target="_blank" rel="noopener noreferrer"
          className="font-medium text-[#2D6A4F] underline underline-offset-2 hover:text-[#245c43]">Terms</a>
      </p>
      <div role="radiogroup" aria-label="Sharing outside Natives" className="grid gap-2 sm:grid-cols-2">
        {SHARING_OPTIONS.map(o => {
          const on = value === o.value;
          return (
            <button key={o.value} type="button" role="radio" aria-checked={on} onClick={() => onChange(o.value)}
              className={`text-left rounded-xl px-4 py-3.5 bg-white transition-colors ${
                on ? "border-2 border-[#1C1917]" : "border border-[#1C1917]/15 hover:border-[#1C1917]/35"}`}>
              <span className="flex items-start gap-3">
                <span className={`mt-[3px] w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                  on ? "border-[#2D6A4F]" : "border-[#1C1917]/30"}`}>
                  {on && <span className="w-2 h-2 rounded-full bg-[#2D6A4F]" />}
                </span>
                <span>
                  <span className={`block text-[15px] text-[#1C1917] ${on ? "font-semibold" : "font-medium"}`}>{o.label}</span>
                  <span className="block text-[13.5px] leading-snug text-[#1C1917] mt-0.5">{o.sub}</span>
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
