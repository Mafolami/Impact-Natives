// ─── OrgLogo.tsx ──────────────────────────────────────────────────────────────
// The organisation logo in the profile header. It copes with three ways a logo can go missing:
//   1. The row the page built has no logo_url (a page that did not select it): it is looked up by
//      organisation id, once, and remembered for ten minutes. An organisation without a logo is
//      remembered too, so it is not asked for again.
//   2. The stored value is a bare storage path instead of a full link: it is turned into the
//      public link for the org-logos bucket.
//   3. The artwork is light (a white logo on a transparent background): it would vanish on a white
//      card, so it gets a dark green backdrop instead. Decided by a 32 pixel sample of the image.
// If the image cannot load, the organisation's initial is shown in a green tile.
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const CACHE_MS = 10 * 60 * 1000;
const lookedUp = new Map<string, { url: string | null; at: number }>();

export function normalizeLogoUrl(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  if (/^(https?:)?\/\//i.test(v) || v.startsWith("data:") || v.startsWith("blob:")) return v;
  const path = v.replace(/^\/+/, "").replace(/^org-logos\//, "");
  return supabase.storage.from("org-logos").getPublicUrl(path).data.publicUrl || null;
}

// Mean brightness (0 to 1) of the visible pixels in an RGBA buffer. Null when nothing is visible.
export function visibleBrightness(px: ArrayLike<number>): number | null {
  let sum = 0, weight = 0;
  for (let i = 0; i + 3 < px.length; i += 4) {
    const a = px[i + 3] / 255;
    if (a < 0.13) continue;
    sum += ((0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255) * a;
    weight += a;
  }
  return weight === 0 ? null : sum / weight;
}

export function logoNeedsDarkBackdrop(px: ArrayLike<number>): boolean {
  const b = visibleBrightness(px);
  return b !== null && b > 0.85;
}

const SIZE = "w-16 h-16 sm:w-20 sm:h-20";

export default function OrgLogo({ org }: { org: { id: string; organisation_name: string; logo_url?: string | null } }) {
  const [src, setSrc] = useState<string | null>(() => normalizeLogoUrl(org.logo_url));
  const [failed, setFailed] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setFailed(false);
    setDark(false);
    const direct = normalizeLogoUrl(org.logo_url);
    setSrc(direct);
    if (direct) return;
    const hit = lookedUp.get(org.id);
    if (hit && Date.now() - hit.at < CACHE_MS) { setSrc(hit.url); return; }
    let cancelled = false;
    supabase.from("organizations").select("logo_url").eq("id", org.id).maybeSingle()
      .then(({ data }: any) => {
        const url = normalizeLogoUrl(data?.logo_url);
        lookedUp.set(org.id, { url, at: Date.now() });
        if (!cancelled) setSrc(url);
      });
    return () => { cancelled = true; };
  }, [org.id, org.logo_url]);

  useEffect(() => {
    if (!src || typeof document === "undefined" || typeof Image === "undefined") return;
    let cancelled = false;
    const probe = new Image();
    probe.crossOrigin = "anonymous";
    probe.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 32; canvas.height = 32;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(probe, 0, 0, 32, 32);
        if (!cancelled) setDark(logoNeedsDarkBackdrop(ctx.getImageData(0, 0, 32, 32).data));
      } catch { /* pixels not readable: keep the white backdrop */ }
    };
    probe.src = src;
    return () => { cancelled = true; probe.onload = null; };
  }, [src]);

  if (src && !failed) {
    return (
      <img src={src} alt="" onError={() => setFailed(true)}
        className={`${SIZE} rounded-xl object-contain p-1.5 shrink-0 border border-[#2D6A4F]/20 ${dark ? "bg-[#1B3328]" : "bg-card"}`} />
    );
  }
  return (
    <div className={`${SIZE} rounded-xl shrink-0 flex items-center justify-center bg-[#2D6A4F] text-white text-2xl sm:text-3xl font-black`}>
      {org.organisation_name.trim().charAt(0).toUpperCase()}
    </div>
  );
}
