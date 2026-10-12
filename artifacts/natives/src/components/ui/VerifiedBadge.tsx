import { useState, useRef } from "react"
import { ShieldCheck } from "lucide-react"
import { IS_APP_DOMAIN } from "@/lib/authLinks"

// The Verification standard page lives on the marketing site (impactnatives.com).
// On app.impactnatives.com a relative link fell outside the app's allowed paths
// and bounced to sign-in, so link to the marketing domain explicitly there.
const STANDARD_HREF = IS_APP_DOMAIN ? "https://impactnatives.com/verification-standard" : "/verification-standard"

export function VerifiedBadge({ withTooltip, iconOnly }: { withTooltip?: boolean; iconOnly?: boolean }) {
  const [show, setShow] = useState(false)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleEnter() {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    setShow(true)
  }

  function handleLeave() {
    hideTimer.current = setTimeout(() => setShow(false), 200)
  }

  return (
    <div className="relative inline-flex" onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      {iconOnly ? (
        <span className="inline-flex items-center cursor-default" role="img" aria-label="Verified organisation" title={withTooltip ? undefined : "Verified organisation"}>
          <ShieldCheck className="w-[18px] h-[18px] text-[#2D6A4F]" strokeWidth={2.4} />
        </span>
      ) : (
        <span
          className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full cursor-default"
          style={{ background: "rgba(45,106,79,0.12)", color: "#2D6A4F" }}>
          <ShieldCheck className="w-3 h-3" />
          Verified
        </span>
      )}
      {withTooltip && show && (
        <div className="absolute bottom-full left-0 pb-2 z-50">
          <div className="w-64 rounded-lg border border-border bg-popover shadow-lg px-3 py-2.5">
            <p className="text-xs font-semibold text-[#1C1917] mb-1">Verified organisation</p>
            <p className="text-xs text-[#1C1917] leading-relaxed">
              Document-verified by the Natives team. Organisation registration credentials have been reviewed and confirmed.
            </p>
            <a href={STANDARD_HREF} target={IS_APP_DOMAIN ? "_blank" : undefined} rel="noreferrer"
              className="text-xs font-medium text-[#2D6A4F] hover:underline mt-1.5 inline-block">
              Learn more about our verification standard
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
