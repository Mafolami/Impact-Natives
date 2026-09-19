// ─── DiscoverNativesCard.tsx ──────────────────────────────────────────────────
// Green to terracotta call-to-action at the foot of the profile sidebar. Shows how many
// verified organisations are on Natives and links to the Natives directory.
// The count is one small head-only query, cached in memory for ten minutes.
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { supabase } from "@/lib/supabase";

const CACHE_MS = 10 * 60 * 1000;
let cached: { n: number; at: number } | null = null;
const fresh = () => (cached && Date.now() - cached.at < CACHE_MS ? cached.n : null);

export default function DiscoverNativesCard() {
  const [count, setCount] = useState<number | null>(fresh());

  useEffect(() => {
    const known = fresh();
    if (known !== null) { setCount(known); return; }
    let cancelled = false;
    supabase.from("organizations")
      .select("id", { count: "exact", head: true })
      .eq("status", "published")
      .eq("verification_status", "verified")
      .then(({ count: n, error }: any) => {
        if (cancelled || error || typeof n !== "number") return;
        cached = { n, at: Date.now() };
        setCount(n);
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <Link href="/dashboard/natives"
      className="block rounded-xl px-5 py-5 text-white transition-all hover:brightness-110 active:scale-[0.99]"
      style={{ background: "linear-gradient(135deg, #1B3328 0%, #2D6A4F 45%, #C45C26 100%)" }}>
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-white">Discover organisations</p>
      <p className="mt-2 text-lg font-bold leading-snug text-white">
        {count && count > 0 ? `Explore ${count}+ verified partners on Natives` : "Explore verified partners on Natives"}
      </p>
      <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-white">
        Open Natives
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </span>
    </Link>
  );
}
