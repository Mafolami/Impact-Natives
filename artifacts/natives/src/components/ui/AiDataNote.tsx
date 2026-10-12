import type { ReactNode } from "react";
import { IS_APP_DOMAIN } from "@/lib/authLinks";

// Shown wherever text or a document is sent to the AI provider. Links to the
// "How We Use AI" section of the Privacy Policy, which lives on the marketing
// site, so the app domain links there explicitly. Opens in a new tab so a
// half-filled form is not lost.
const PRIVACY_AI_HREF = (IS_APP_DOMAIN ? "https://www.impactnatives.com" : "") + "/legal/privacy#how-we-use-ai";

export function AiDataNote({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={`text-[13px] leading-relaxed text-[#1C1917] ${className}`}>
      {children}{" "}
      <a href={PRIVACY_AI_HREF} target="_blank" rel="noopener noreferrer"
        className="font-medium text-[#2D6A4F] underline underline-offset-2 hover:text-[#245c43]">
        How we handle your data
      </a>
    </p>
  );
}
