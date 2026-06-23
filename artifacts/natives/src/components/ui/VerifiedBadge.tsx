import { useState, useRef } from "react"
import { ShieldCheck } from "lucide-react"

export function VerifiedBadge({ withTooltip }: { withTooltip?: boolean }) {
  const [show, setShow] = useState(false)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleEnter() {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    setShow(true)
  }

  function handleLeave() {
    hideTimer.current = setTimeout(() => setShow(false), 150)
  }

  return (
    <div className="relative inline-flex" onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      <span
        className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full cursor-default"
        style={{ background: "#eaf5ee", color: "#2D6A4F" }}>
        <ShieldCheck className="w-3 h-3" />
        Verified
      </span>
      {withTooltip && show && (
        <div className="absolute bottom-full left-0 mb-2 w-64 rounded-lg border border-border bg-popover shadow-lg px-3 py-2.5 z-50">
          <p className="text-xs font-medium text-foreground mb-1">What does verified mean?</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Document-verified by the Natives team. Organisation registration credentials have been reviewed and confirmed.
          </p>
          <a href="/verification-standard" className="text-xs text-[#2D6A4F] hover:underline mt-1 inline-block">
            Learn more →
          </a>
        </div>
      )}
    </div>
  )
}