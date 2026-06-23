import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import {
  ArrowRight, Lightbulb, Handshake, Compass, Plus,
  Users, Sprout, MessageSquare, ChevronDown, ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import CreateInitiativeModal from "@/components/platform/CreateInitiativeModal";
import { formatDistanceToNow } from "date-fns";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface InitiativeRow {
  id: string;
  title: string;
  sectors: string[];
  locations: string[];
  status: string;
  eois: number;
  created_at: string;
}

interface FeedEvent {
  id: string;
  type: "initiative" | "partnership" | "member";
  created_at: string;
  // initiative
  initiative_title?: string;
  initiative_id?: string;
  initiative_sectors?: string[];
creator_name?: string;
  creator_org?: string;
  creator_id?: string;
  // partnership
  partner_name?: string;
  partner_role?: string;
  // member
  member_name?: string;
  member_org?: string;
  member_role_title?: string;
  member_id?: string;
}

interface ActivitySnapshot {
  openConversations: number;
  pendingEOIs: number;
}

const STATUS_MAP: Record<string, { label: string; dot: string }> = {
  pending:   { label: "Pending review", dot: "#f59e0b" },
  published: { label: "Listed",         dot: "#2D6A4F" },
  rejected:  { label: "Not approved",   dot: "#ef4444" },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function timeAgo(ts: string) {
  try {
    return formatDistanceToNow(new Date(ts), { addSuffix: true });
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function DashboardHome() {
  const { user, profile } = useAuth();
  const [, navigate] = useLocation();

  // personal data
  const [myInitiatives, setMyInitiatives] = useState<InitiativeRow[]>([]);
  const [snapshot, setSnapshot]           = useState<ActivitySnapshot>({ openConversations: 0, pendingEOIs: 0 });
  const [snapshotOpen, setSnapshotOpen]   = useState(false);
  const [loadingPersonal, setLoadingPersonal] = useState(true);

  // global feed
  const [feedEvents, setFeedEvents]   = useState<FeedEvent[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(true);

  const [showCreateModal, setShowCreateModal] = useState(false);

  const hour     = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = profile?.full_name?.split(" ")[0] ?? profile?.email?.split("@")[0] ?? "there";

  // -------------------------------------------------------------------------
  // Personal data fetch
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!user) return;
    async function loadPersonal() {
      const [initRes, convRes, eoiRes] = await Promise.all([
        supabase
          .from("initiative_requests")
          .select("id,title,sectors,locations,status,eois,created_at")
          .or(`user_id.eq.${user!.id},submitter_email.eq.${user!.email}`)
          .order("created_at", { ascending: false })
          .limit(3),
        supabase
          .from("conversation_participants")
          .select("conversation_id, conversations!inner(status)")
          .eq("user_id", user!.id)
          .eq("conversations.status", "pending"),
        supabase
          .from("expressions_of_interest")
          .select("id, conversations!inner(status)")
          .eq("user_id", user!.id)
          .eq("conversations.status", "pending"),
      ]);

      if (initRes.data) setMyInitiatives(initRes.data as InitiativeRow[]);
      setSnapshot({
        openConversations: convRes.data?.length ?? 0,
        pendingEOIs:       eoiRes.data?.length  ?? 0,
      });
      setLoadingPersonal(false);
    }
    loadPersonal();
  }, [user]);

  // -------------------------------------------------------------------------
  // Global feed fetch
  // TODO: move to a get_feed_events() RPC when pagination is needed
  // -------------------------------------------------------------------------
  useEffect(() => {
    async function loadFeed() {
      const events: FeedEvent[] = [];

      // 1. Recent published initiatives
      const { data: initiatives } = await supabase
        .from("initiative_requests")
        .select("id,title,sectors,created_at,user_id")
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(10);

      if (initiatives && initiatives.length > 0) {
        const creatorIds = [...new Set(initiatives.map((i: any) => i.user_id).filter(Boolean))];
        const { data: creators } = await supabase
          .from("profiles")
          .select("id,full_name,org_name")
          .in("id", creatorIds);

        const creatorMap = Object.fromEntries((creators ?? []).map((p: any) => [p.id, p]));

        for (const ini of initiatives as any[]) {
          const creator = creatorMap[ini.user_id];
          events.push({
            id:                 `ini-${ini.id}`,
            type:               "initiative",
            created_at:         ini.created_at,
            initiative_id:      ini.id,
            initiative_title:   ini.title,
            initiative_sectors: ini.sectors,
            creator_name:       creator?.full_name ?? "A member",
            creator_org:        creator?.org_name  ?? null,
            creator_id:         ini.user_id,
          });
        }
      }

      // 2. Confirmed partnerships (public_on_feed = true)
      // TODO: wire public_on_feed checkbox into DashboardMessages confirm flow
      const { data: partnerInitiatives } = await supabase
        .from("initiative_requests")
        .select("id,title,confirmed_partners,user_id,created_at")
        .not("confirmed_partners", "eq", "[]")
        .not("confirmed_partners", "is", null)
        .eq("status", "published");

      if (partnerInitiatives) {
        for (const ini of partnerInitiatives as any[]) {
          const partners: any[] = ini.confirmed_partners ?? [];
          for (const p of partners) {
           if (!p.public_on_feed) continue;
            events.push({
              id:               `partner-${ini.id}-${p.user_id}`,
              type:             "partnership",
              created_at:       p.confirmed_at,
              initiative_id:    ini.id,
              initiative_title: ini.title,
              partner_name:     p.name,
              partner_role:     p.role,
            });
          }
        }
      }

      // 3. New members (feed_visibility != 'none')
      const { data: newMembers } = await supabase
        .from("profiles")
        .select("id,full_name,org_name,role_title,created_at,feed_visibility")
        .neq("feed_visibility", "none")
        .order("created_at", { ascending: false })
        .limit(10);

      for (const m of newMembers ?? [] as any[]) {
        events.push({
          id:               `member-${m.id}`,
          type:             "member",
          created_at:       m.created_at,
          member_id:        m.id,
          member_name:      m.full_name,
          member_org:       m.org_name,
          member_role_title: m.role_title,
        });
      }

      // Sort all events by date desc, cap at 20
      events.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setFeedEvents(events.slice(0, 20));
      setLoadingFeed(false);
    }

    loadFeed();
  }, []);

  const hasActivity = snapshot.openConversations > 0 || snapshot.pendingEOIs > 0;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <>
      <div className="space-y-10">

        {/* Welcome */}
        <div>
          <p className="text-sm text-muted-foreground mb-1">{greeting}</p>
          <h2 className="text-3xl font-bold text-foreground tracking-tight">{firstName}.</h2>
          <p className="text-muted-foreground mt-2 text-sm">
            Here's what's moving across your ecosystem.
          </p>
        </div>

        {/* Quick Actions */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
            Actions
          </h3>
          <div className="flex flex-wrap gap-3">
            <Button
              className="bg-[#2D6A4F] hover:bg-[#245c43] text-white rounded-full px-5 text-sm"
              onClick={() => setShowCreateModal(true)}
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Create Initiative
            </Button>
            <Button
              variant="outline"
              className="rounded-full px-5 text-sm"
              onClick={() => navigate("/dashboard/marketplace")}
            >
              Explore Marketplace
              <ArrowRight className="w-3.5 h-3.5 ml-2" />
            </Button>
            <Button
              variant="outline"
              className="rounded-full px-5 text-sm"
              onClick={() => navigate("/dashboard/messages")}
            >
              <MessageSquare className="w-4 h-4 mr-1.5" />
              Messages
            </Button>
          </div>
        </section>

        {/* Activity Snapshot — collapsed card */}
        {!loadingPersonal && hasActivity && (
          <section>
            <button
              onClick={() => setSnapshotOpen(o => !o)}
              className="w-full rounded-xl border border-border bg-card px-5 py-4 flex items-center justify-between hover:border-[#2D6A4F]/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                  <Lightbulb className="w-4 h-4 text-[#2D6A4F]" />
                </div>
                <span className="text-sm font-medium text-foreground">
                  {[
                    snapshot.openConversations > 0 && `${snapshot.openConversations} pending conversation${snapshot.openConversations !== 1 ? "s" : ""}`,
                    snapshot.pendingEOIs > 0        && `${snapshot.pendingEOIs} pending EOI${snapshot.pendingEOIs !== 1 ? "s" : ""}`,
                  ].filter(Boolean).join(" · ")}
                </span>
              </div>
              {snapshotOpen
                ? <ChevronUp   className="w-4 h-4 text-muted-foreground" />
                : <ChevronDown className="w-4 h-4 text-muted-foreground" />
              }
            </button>
            {snapshotOpen && (
              <div className="mt-2 rounded-xl border border-border bg-card px-5 py-4 flex flex-wrap gap-3">
                {snapshot.openConversations > 0 && (
                  <Link href="/dashboard/messages">
                    <Button variant="outline" size="sm" className="rounded-full text-xs">
                      Review conversations <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                  </Link>
                )}
                {snapshot.pendingEOIs > 0 && (
                  <Link href="/dashboard/messages">
                    <Button variant="outline" size="sm" className="rounded-full text-xs">
                      Review EOIs <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                  </Link>
                )}
              </div>
            )}
          </section>
        )}

        {/* Global Activity Feed */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
            Recent Activity
          </h3>
          {loadingFeed ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 rounded-xl border border-border bg-card animate-pulse" />
              ))}
            </div>
          ) : feedEvents.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-8 text-center">
              <Compass className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                No activity yet. Be the first to publish an initiative.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
                            {feedEvents.map(event => (
                <FeedCard key={event.id} event={event} currentUserId={user?.id} />
              ))}
            </div>
          )}
        </section>

      </div>

      <CreateInitiativeModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          setShowCreateModal(false);
          if (user) {
            supabase
              .from("initiative_requests")
              .select("id,title,sectors,locations,status,eois,created_at")
              .or(`user_id.eq.${user.id},submitter_email.eq.${user.email}`)
              .order("created_at", { ascending: false })
              .limit(3)
              .then(({ data }) => { if (data) setMyInitiatives(data as InitiativeRow[]); });
          }
        }}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Feed Card
// ---------------------------------------------------------------------------
function FeedCard({ event, currentUserId }: { event: FeedEvent; currentUserId?: string }) {
  if (event.type === "initiative") {
    return (
      <Link href={`/dashboard/marketplace/${event.initiative_id}`}>
        <div className="rounded-xl border border-border bg-card px-5 py-4 hover:border-[#2D6A4F]/30 transition-colors cursor-pointer group flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
              <Lightbulb className="w-4 h-4 text-[#2D6A4F]" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                New Initiative
              </p>
              <p className="text-sm font-medium text-foreground group-hover:text-[#2D6A4F] transition-colors">
                {event.initiative_title}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {event.creator_id === currentUserId ? "You" : event.creator_name}
                {event.creator_org ? ` · ${event.creator_org}` : ""}
                {event.initiative_sectors?.length
                  ? ` · ${event.initiative_sectors.join(", ")}`
                  : ""}
                {" · "}{timeAgo(event.created_at)}
              </p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-[#2D6A4F] shrink-0 mt-1 transition-colors" />
        </div>
      </Link>
    );
  }

  if (event.type === "partnership") {
    return (
      <Link href={`/dashboard/marketplace/${event.initiative_id}`}>
        <div className="rounded-xl border border-border bg-card px-5 py-4 hover:border-[#2D6A4F]/30 transition-colors cursor-pointer group flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
              <Handshake className="w-4 h-4 text-[#C45C26]" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                Partnership Confirmed
              </p>
              <p className="text-sm font-medium text-foreground group-hover:text-[#2D6A4F] transition-colors">
                {event.partner_name} joined {event.initiative_title}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                As {event.partner_role} partner · {timeAgo(event.created_at)}
              </p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-[#2D6A4F] shrink-0 mt-1 transition-colors" />
        </div>
      </Link>
    );
  }

  if (event.type === "member") {
    return (
      <Link href={`/dashboard/natives?user=${event.member_id}`}>
        <div className="rounded-xl border border-border bg-card px-5 py-4 hover:border-[#2D6A4F]/30 transition-colors cursor-pointer group flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
              <Users className="w-4 h-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                New Member
              </p>
              <p className="text-sm font-medium text-foreground group-hover:text-[#2D6A4F] transition-colors">
                {event.member_name} joined Impact Natives
              </p>
              {(event.member_role_title || event.member_org) && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {[event.member_role_title, event.member_org].filter(Boolean).join(" · ")}
                  {" · "}{timeAgo(event.created_at)}
                </p>
              )}
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-[#2D6A4F] shrink-0 mt-1 transition-colors" />
        </div>
      </Link>
    );
  }

  return null;
}