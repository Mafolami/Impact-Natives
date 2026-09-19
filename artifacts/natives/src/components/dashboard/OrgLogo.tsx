// ─── OrgLogo.tsx ──────────────────────────────────────────────────────────────
// The organisation logo in the profile header. It copes with the ways a logo can go missing:
//   1. The row the page built has no logo_url (a page that did not select it): it is looked up by
//      organisation id, once, and remembered for ten minutes. An organisation without a logo is
//      remembered too, so it is not asked for again.
//   2. The stored value is a bare storage path instead of a full link: it is turned into the
//      public link for the org-logos bucket.
//   3. The artwork is light (white or pale on a transparent background): it would vanish on a white
//      card, so it gets a dark green backdrop. The file is downloaded through the Supabase client
//      (signed-in users can read the org-logos bucket), which the browser lets us read, and a
//      32 pixel sample of it is measured. Reading the pixels straight from the public link would
//      need CORS headers on the file, so that is not relied on. The answer is remembered per link.
// If the image cannot load, the organisation's initial is shown in a green tile.
// Sizes: "md" for the profile header, "sm" (40px) for the cards in the listings pane. A list has
// no need to look up logos one by one (its rows already carry logo_url), so it passes lookup={false},
// and at most MAX_LOGO_DETECTIONS logos per page load are downloaded to be measured.
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const CACHE_MS = 10 * 60 * 1000;
const lookedUp = new Map<string, { url: string | null; at: number }>();
const darkByUrl = new Map<string, boolean>();
const inFlight = new Map<string, Promise<boolean | null>>();
let detectionsStarted = 0;

// A list can hold many logos. Measuring downloads each file, so only this many are measured per page load.
export const MAX_LOGO_DETECTIONS = 12;

// Tests only.
export function resetLogoState() { lookedUp.clear(); darkByUrl.clear(); inFlight.clear(); detectionsStarted = 0; }

// Mean brightness above this counts as light artwork (0 is black, 1 is white).
export const LIGHT_LOGO_THRESHOLD = 0.8;

export function normalizeLogoUrl(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  if (/^(https?:)?\/\//i.test(v) || v.startsWith("data:") || v.startsWith("blob:")) return v;
  const path = v.replace(/^\/+/, "").replace(/^org-logos\//, "");
  return supabase.storage.from("org-logos").getPublicUrl(path).data.publicUrl || null;
}

// "https://x.supabase.co/storage/v1/object/public/org-logos/<user>/logo.png" gives "<user>/logo.png".
export function storagePathFrom(url: string): string | null {
  const m = url.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/org-logos\/([^?#]+)/);
  if (!m) return null;
  try { return decodeURIComponent(m[1]); } catch { return m[1]; }
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
  return b !== null && b > LIGHT_LOGO_THRESHOLD;
}

// A same-origin blob, so the canvas is never tainted and the pixels can be read.
async function decodeToPixels(blob: Blob): Promise<ArrayLike<number> | null> {
  if (typeof document === "undefined" || typeof Image === "undefined" || typeof URL === "undefined" || !URL.createObjectURL) return null;
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("decode"));
      i.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = 32; canvas.height = 32;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, 32, 32);
    return ctx.getImageData(0, 0, 32, 32).data;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Replaceable in tests. In the app it is always decodeToPixels.
export const logoDeps = { decode: decodeToPixels };

// True: light artwork. False: not light. Null: could not tell (then the white backdrop is kept).
export function detectLightLogo(url: string): Promise<boolean | null> {
  const known = darkByUrl.get(url);
  if (known !== undefined) return Promise.resolve(known);
  const running = inFlight.get(url);
  if (running) return running;
  const path = storagePathFrom(url);
  if (!path) return Promise.resolve(null);
  if (detectionsStarted >= MAX_LOGO_DETECTIONS) return Promise.resolve(null);
  detectionsStarted++;
  const job = (async () => {
    try {
      const { data, error } = await supabase.storage.from("org-logos").download(path);
      if (error || !data) return null;
      const px = await logoDeps.decode(data);
      if (!px) return null;
      const light = logoNeedsDarkBackdrop(px);
      darkByUrl.set(url, light);
      return light;
    } catch {
      return null;
    } finally {
      inFlight.delete(url);
    }
  })();
  inFlight.set(url, job);
  return job;
}

const SIZES = {
  md: { box: "w-16 h-16 sm:w-20 sm:h-20 rounded-xl p-1.5", tile: "w-16 h-16 sm:w-20 sm:h-20 rounded-xl text-2xl sm:text-3xl" },
  sm: { box: "w-10 h-10 rounded-lg p-1", tile: "w-10 h-10 rounded-lg text-base" },
};

export default function OrgLogo({ org, size = "md", lookup = true, detect = true }: {
  org: { id: string; organisation_name: string; logo_url?: string | null };
  size?: "md" | "sm"; lookup?: boolean; detect?: boolean;
}) {
  const [src, setSrc] = useState<string | null>(() => normalizeLogoUrl(org.logo_url));
  const [failed, setFailed] = useState(false);
  const [dark, setDark] = useState<boolean>(() => { const u = normalizeLogoUrl(org.logo_url); return u ? darkByUrl.get(u) === true : false; });

  useEffect(() => {
    setFailed(false);
    const direct = normalizeLogoUrl(org.logo_url);
    setSrc(direct);
    if (direct || !lookup) return;
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
  }, [org.id, org.logo_url, lookup]);

  useEffect(() => {
    if (!src) { setDark(false); return; }
    const known = darkByUrl.get(src);
    setDark(known === true);
    if (known !== undefined || !detect) return;
    let cancelled = false;
    detectLightLogo(src).then(light => { if (!cancelled && light !== null) setDark(light); });
    return () => { cancelled = true; };
  }, [src, detect]);

  if (src && !failed) {
    return (
      <img src={src} alt="" onError={() => setFailed(true)}
        className={`${SIZES[size].box} object-contain shrink-0 border border-[#2D6A4F]/20 ${dark ? "bg-[#1B3328]" : "bg-card"}`} />
    );
  }
  return (
    <div className={`${SIZES[size].tile} shrink-0 flex items-center justify-center bg-[#2D6A4F] text-white font-black`}>
      {org.organisation_name.trim().charAt(0).toUpperCase()}
    </div>
  );
}
