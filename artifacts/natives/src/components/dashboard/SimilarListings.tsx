// ─── SimilarListings.tsx ──────────────────────────────────────────────────────
// Up to three other published listings that share at least one sector with this one, ranked by
// shared sectors and then by country. One query for the published listings (capped at 200) and one
// for the organisations of the best eight, ranked in the browser. partnership_listings.sector is JSON and
// sector names contain commas, so filtering in the database is not reliable here.
// If onOpen is given the row calls it; otherwise the row links to the Partnerships deep link.
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { supabase } from "@/lib/supabase";

type ListingRow = { id: string; user_id: string; title: string | null; sector: unknown; country: unknown };
type OrgBits = { user_id: string; organisation_name: string; logo_url: string | null };
type Item = { listing: ListingRow; org: OrgBits; shared: string[]; countryHit: boolean };

function toArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String).map(s => s.trim()).filter(Boolean);
  if (typeof v !== "string") return [];
  const t = v.trim();
  if (!t) return [];
  if (t.startsWith("[")) {
    try { const p = JSON.parse(t); if (Array.isArray(p)) return p.map(String).map(s => s.trim()).filter(Boolean); } catch { /* fall through */ }
  }
  if (t.startsWith("{") && t.endsWith("}")) {
    return t.slice(1, -1).split(",").map(s => s.replace(/^"|"$/g, "").trim()).filter(Boolean);
  }
  return [t];
}

export default function SimilarListings({ listingId, orgUserId, sectors, countries, onOpen }: {
  listingId?: string; orgUserId: string; sectors: string[]; countries: string[]; onOpen?: (listingId: string) => void;
}) {
  const [items, setItems] = useState<Item[] | null>(null);
  const sectorKey = sectors.join("|");
  const countryKey = countries.join("|");

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    if (sectors.length === 0) { setItems([]); return; }
    (async () => {
      const { data: rows, error } = await supabase.from("partnership_listings")
        .select("id,user_id,title,sector,country")
        .eq("status", "published")
        .neq("user_id", orgUserId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (cancelled) return;
      if (error || !rows) { setItems([]); return; }
      const mineS = new Set(sectors.map(s => s.toLowerCase()));
      const mineC = new Set(countries.map(c => c.toLowerCase()));
      const ranked = (rows as ListingRow[])
        .filter(l => l.id !== listingId)
        .map(l => ({
          listing: l,
          shared: toArray(l.sector).filter(s => mineS.has(s.toLowerCase())),
          countryHit: toArray(l.country).some(c => mineC.has(c.toLowerCase())),
        }))
        .filter(x => x.shared.length > 0)
        .sort((a, b) => (b.shared.length * 2 + (b.countryHit ? 1 : 0)) - (a.shared.length * 2 + (a.countryHit ? 1 : 0)))
        .slice(0, 8);   // look up more than three, so a listing whose organisation is not published cannot leave a gap
      if (ranked.length === 0) { setItems([]); return; }
      const { data: orgs } = await supabase.from("organizations")
        .select("user_id,organisation_name,logo_url")
        .in("user_id", ranked.map(x => x.listing.user_id));
      if (cancelled) return;
      const byUser = new Map<string, OrgBits>(((orgs ?? []) as OrgBits[]).map(o => [o.user_id, o]));
      // A listing whose organisation is not published has no readable organisation row, so it drops out here.
      setItems(ranked.flatMap(x => { const org = byUser.get(x.listing.user_id); return org ? [{ ...x, org }] : []; }).slice(0, 3));
    })();
    return () => { cancelled = true; };
  }, [orgUserId, listingId, sectorKey, countryKey]);

  if (!items || items.length === 0) return null;

  const rowClass = "w-full text-left flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-[#2D6A4F]/10 transition-colors";
  return (
    <div className="border-t border-[#2D6A4F]/20 pt-6">
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-black dark:text-white mb-3">Similar listings</p>
      <ul className="space-y-1">
        {items.map(({ listing, org, shared, countryHit }) => {
          const inner = (
            <>
              {org.logo_url
                ? <img src={org.logo_url} alt="" className="w-9 h-9 rounded-lg object-contain p-0.5 shrink-0 bg-card border border-[#2D6A4F]/20" />
                : <div className="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center bg-[#2D6A4F] text-white text-sm font-black">{org.organisation_name.trim().charAt(0).toUpperCase()}</div>}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground truncate">{org.organisation_name}</p>
                {listing.title && <p className="text-xs text-foreground truncate">{listing.title}</p>}
                <p className="text-[11px] text-black dark:text-white truncate">{[...shared.slice(0, 2), ...(countryHit ? [toArray(listing.country)[0]] : [])].join(" · ")}</p>
              </div>
            </>
          );
          return (
            <li key={listing.id}>
              {onOpen
                ? <button type="button" className={rowClass} onClick={() => onOpen(listing.id)}>{inner}</button>
                : <Link href={`/dashboard/partnerships?listing=${listing.id}`} className={rowClass}>{inner}</Link>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
