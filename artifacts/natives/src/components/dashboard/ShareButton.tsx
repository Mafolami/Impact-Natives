// ─── ShareButton.tsx ──────────────────────────────────────────────────────────
// Shared share menu: native share sheet, copy link, WhatsApp / X / LinkedIn.
// Extracted from DashboardMarketplace.tsx, where it could only share initiatives.
// Callers now pass the link and the message, so initiatives, partnership listings
// or anything else can reuse it. Pass `label` for a labelled button (icon + text)
// instead of the round icon-only trigger.
import { useState } from "react";
import { Share2, Check } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { FaWhatsapp, FaXTwitter, FaLinkedin } from "react-icons/fa6";

export function ShareButton({ url, message, size = "sm", label, fullWidth = false }: { url: string; message: string; size?: "sm" | "md"; label?: string; fullWidth?: boolean }) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const dim = size === "md" ? "h-9 w-9" : "h-8 w-8";
  const iconDim = size === "md" ? "w-4 h-4" : "w-3.5 h-3.5";
  const combined = `${message}\n${url}`;
  async function handleNativeShare(e: React.MouseEvent) {
    e.stopPropagation();
    setOpen(false);
    try { await navigator.share({ text: combined }); } catch { /* user cancelled */ }
  }
  async function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    await navigator.clipboard.writeText(combined);
    setCopied(true);
    setOpen(false);
    setTimeout(() => setCopied(false), 1800);
  }
  function openShareIntent(e: React.MouseEvent, href: string) {
    e.stopPropagation();
    window.open(href, "_blank", "noopener,noreferrer");
    setOpen(false);
  }
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(combined)}`;
  const xHref = `https://x.com/intent/tweet?text=${encodeURIComponent(message)}&url=${encodeURIComponent(url)}`;
  const linkedinHref = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
  const iconTriggerClass = `${dim} rounded-full flex items-center justify-center border transition-colors ${
    copied
      ? "border-[#2D6A4F]/30 bg-[rgba(45,106,79,0.12)] text-[#2D6A4F]"
      : "border-border text-muted-foreground hover:border-[#2D6A4F]/40 hover:text-[#2D6A4F] hover:bg-[#2D6A4F]/5 dark:hover:border-[#C45C26] dark:hover:text-[#C45C26] dark:hover:bg-[#C45C26]/10"
  }`;
  const labelTriggerClass = `${fullWidth ? "w-full justify-center " : ""}px-3.5 py-2 rounded-full flex items-center gap-1.5 border text-xs font-semibold transition-colors ${
    copied
      ? "border-[#2D6A4F]/30 bg-[rgba(45,106,79,0.12)] text-[#2D6A4F]"
      : "border-border text-black dark:text-white hover:border-[#2D6A4F]/40 hover:text-[#2D6A4F]"
  }`;
  const triggerIcon = copied ? <Check className={label ? "w-3.5 h-3.5" : iconDim} /> : <Share2 className={label ? "w-3.5 h-3.5" : iconDim} />;
  const hasNativeShare = "share" in navigator;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" onClick={e => e.stopPropagation()} title={copied ? "Link copied" : "Share"} className={label ? labelTriggerClass : iconTriggerClass}>
          {triggerIcon}
          {label && <span>{copied ? "Link copied" : label}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align={fullWidth ? "center" : "end"} className="w-auto p-1.5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-center gap-2 p-1">
          <button type="button" onClick={e => openShareIntent(e, whatsappHref)} title="Share to WhatsApp"
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted transition-colors">
            <FaWhatsapp className="w-4 h-4 shrink-0 text-[#25D366]" />
          </button>
          <button type="button" onClick={e => openShareIntent(e, xHref)} title="Share to X"
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted transition-colors">
            <FaXTwitter className="w-4 h-4 shrink-0" />
          </button>
          <button type="button" onClick={e => openShareIntent(e, linkedinHref)} title="Share to LinkedIn"
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted transition-colors">
            <FaLinkedin className="w-4 h-4 shrink-0 text-[#0A66C2]" />
          </button>
          {hasNativeShare && (
            <button type="button" onClick={handleNativeShare} title="More options"
              className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted transition-colors">
              <Share2 className="w-4 h-4 shrink-0" />
            </button>
          )}
          <button type="button" onClick={handleCopy} title={copied ? "Copied" : "Copy link"}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted transition-colors">
            {copied ? <Check className="w-4 h-4 shrink-0 text-[#2D6A4F]" /> : <Share2 className="w-4 h-4 shrink-0" />}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
