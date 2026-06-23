import { useEffect, useState } from "react"
import { Link } from "wouter"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/context/AuthContext"
import { formatDistanceToNow } from "date-fns"
import {
  Lightbulb, Handshake, Users, ArrowRight,
  Rss, Settings2
} from "lucide-react"

// ── Types ─────────────────────────────────────────────────────────────────────
interface FeedEvent {
  id: string
  type: "initiative" | "partnership" | "member"
  created_at: string
  initiative_title?: string
  initiative_id?: string
  initiative_sectors?: string[]
  creator_name?: string
  creator_org?: string
  creator_id?: string
  partner_name?: string
  partner_role?: string
  member_name?: string
  member_org?: string
  member_role_title?: string
  member_id?: string
}

function timeAgo(ts: string) {
  try { return formatDistanceToNow(new Date(ts), { addSuffix: true }) }
  catch { return "" }
}

// ── Feed Card ─────────────────────────────────────────────────────────────────
function FeedCard({ event, currentUserId }: { event: FeedEvent; currentUserId?: string }) {
  if (event.type === "initiative") {
    return (
      <Link href={`/dashboard/marketplace/${event.initiative_id}`}>
        <div className="group flex items-start gap-4 px-5 py-4 rounded-2xl border border-border bg-card hover:border-[#2D6A4F]/40 hover:bg-card/80 transition-all cursor-pointer">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
            style={{ background: "rgba(45,106,79,0.12)" }}>
            <Lightbulb className="w-4 h-4 text-[#2D6A4F]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#2D6A4F]">New Initiative</span>
              <span className="text-[10px] text-muted-foreground">{timeAgo(event.created_at)}</span>
            </div>
            <p className="text-sm font-semibold text-foreground group-hover:text-[#2D6A4F] transition-colors leading-snug">
              {event.initiative_title}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {event.creator_id === currentUserId ? "You" : event.creator_name}
              {event.creator_org ? ` · ${event.creator_org}` : ""}
            </p>
            {event.initiative_sectors && event.initiative_sectors.length > 0 && (
              <div className="flex gap-1.5 flex-wrap mt-2">
                {event.initiative_sectors.slice(0, 2).map(s => (
                  <span key={s} className="text-[10px] px-2 py-0.5 rounded-full border border-border text-muted-foreground">
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-[#2D6A4F] shrink-0 mt-1 transition-colors" />
        </div>
      </Link>
    )
  }

  if (event.type === "partnership") {
    return (
      <Link href={`/dashboard/marketplace/${event.initiative_id}`}>
        <div className="group flex items-start gap-4 px-5 py-4 rounded-2xl border border-border bg-card hover:border-[#C45C26]/40 hover:bg-card/80 transition-all cursor-pointer">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
            style={{ background: "rgba(196,92,38,0.10)" }}>
            <Handshake className="w-4 h-4 text-[#C45C26]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#C45C26]">Partnership</span>
              <span className="text-[10px] text-muted-foreground">{timeAgo(event.created_at)}</span>
            </div>
            <p className="text-sm font-semibold text-foreground group-hover:text-[#C45C26] transition-colors leading-snug">
              {event.partner_name} joined as {event.partner_role} partner
            </p>
            <p className="text-xs text-muted-foreground mt-1">{event.initiative_title}</p>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-[#C45C26] shrink-0 mt-1 transition-colors" />
        </div>
      </Link>
    )
  }

  if (event.type === "member") {
    return (
      <Link href={`/dashboard/natives?user=${event.member_id}`}>
        <div className="group flex items-start gap-4 px-5 py-4 rounded-2xl border border-border bg-card hover:border-border/80 hover:bg-card/80 transition-all cursor-pointer">
          <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0 mt-0.5">
            <Users className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">New Member</span>
              <span className="text-[10px] text-muted-foreground">{timeAgo(event.created_at)}</span>
            </div>
            <p className="text-sm font-semibold text-foreground group-hover:text-foreground/80 transition-colors leading-snug">
              {event.member_name} joined Impact Natives
            </p>
            {(event.member_role_title || event.member_org) && (
              <p className="text-xs text-muted-foreground mt-1">
                {[event.member_role_title, event.member_org].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
        </div>
      </Link>
    )
  }

  return null
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function DashboardFeed() {
  const { user, profile } = useAuth()
  const [events, setEvents] = useState<FeedEvent[]>([])
  const [loading, setLoading] = useState(true)

  const userSectors: string[] = (profile as any)?.sectors ?? []
  const isPersonalised = userSectors.length > 0

  useEffect(() => {
    if (profile === undefined) return
    async function load() {
      setLoading(true)
      const allEvents: FeedEvent[] = []

      // 1. Initiatives
      const { data: initiatives } = await supabase
        .from("initiative_requests")
        .select("id,title,sectors,created_at,user_id")
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(30)

      if (initiatives && initiatives.length > 0) {
        const relevant = isPersonalised
          ? (initiatives as any[]).filter(ini =>
              (ini.sectors ?? []).some((s: string) => userSectors.includes(s))
            )
          : initiatives as any[]
        const toShow = relevant.length > 0 ? relevant : initiatives as any[]
        const creatorIds = [...new Set(toShow.map((i: any) => i.user_id).filter(Boolean))]
        const { data: creators } = await supabase
          .from("profiles")
          .select("id,full_name,org_name")
          .in("id", creatorIds)
        const creatorMap = Object.fromEntries((creators ?? []).map((p: any) => [p.id, p]))
        for (const ini of toShow.slice(0, 15)) {
          const creator = creatorMap[ini.user_id]
          allEvents.push({
            id: `ini-${ini.id}`,
            type: "initiative",
            created_at: ini.created_at,
            initiative_id: ini.id,
            initiative_title: ini.title,
            initiative_sectors: ini.sectors,
            creator_name: creator?.full_name ?? "A member",
            creator_org: creator?.org_name ?? null,
            creator_id: ini.user_id,
          })
        }
      }

      // 2. Partnerships
      const { data: partnerInitiatives } = await supabase
        .from("initiative_requests")
        .select("id,title,confirmed_partners,created_at")
        .not("confirmed_partners", "eq", "[]")
        .not("confirmed_partners", "is", null)
        .eq("status", "published")

      if (partnerInitiatives) {
        for (const ini of partnerInitiatives as any[]) {
          for (const p of (ini.confirmed_partners ?? [])) {
            if (!p.public_on_feed) continue
            allEvents.push({
              id: `partner-${ini.id}-${p.user_id}`,
              type: "partnership",
              created_at: p.confirmed_at,
              initiative_id: ini.id,
              initiative_title: ini.title,
              partner_name: p.name,
              partner_role: p.role,
            })
          }
        }
      }

      // 3. Members
      const { data: newMembers } = await supabase
        .from("profiles")
        .select("id,full_name,org_name,role_title,created_at,feed_visibility")
        .neq("feed_visibility", "none")
        .order("created_at", { ascending: false })
        .limit(15)

      for (const m of newMembers ?? [] as any[]) {
        allEvents.push({
          id: `member-${m.id}`,
          type: "member",
          created_at: m.created_at,
          member_id: m.id,
          member_name: m.full_name,
          member_org: m.org_name,
          member_role_title: m.role_title,
        })
      }

      allEvents.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      setEvents(allEvents.slice(0, 30))
      setLoading(false)
    }
    load()
  }, [profile])

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Rss className="w-4 h-4 text-[#2D6A4F]" />
            <h2 className="text-xl font-bold text-foreground tracking-tight">Feed</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            {isPersonalised
              ? "Activity across your sectors and the wider ecosystem."
              : "Everything happening across Impact Natives."}
          </p>
        </div>
        <Link href="/dashboard/profile">
          <button type="button"
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors border border-border rounded-full px-3 py-1.5">
            <Settings2 className="w-3 h-3" />
            Personalise
          </button>
        </Link>
      </div>

      {/* Sector prompt */}
      {!isPersonalised && (
        <div className="rounded-xl border border-dashed border-[#2D6A4F]/30 bg-[#2D6A4F]/5 px-4 py-3 flex items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Set your sectors to get a personalised feed filtered to what matters to you.
          </p>
          <Link href="/dashboard/profile">
            <button type="button"
              className="shrink-0 text-xs font-semibold text-[#2D6A4F] hover:underline underline-offset-2 whitespace-nowrap">
              Set sectors →
            </button>
          </Link>
        </div>
      )}

      {/* Feed */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-20 rounded-2xl border border-border bg-card animate-pulse" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <Rss className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground mb-1">Nothing here yet.</p>
          <p className="text-xs text-muted-foreground">
            As organisations post initiatives and confirm partnerships, they'll appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map(event => (
            <FeedCard key={event.id} event={event} currentUserId={user?.id} />
          ))}
        </div>
      )}

    </div>
  )
}