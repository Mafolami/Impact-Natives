import { useEffect, useState, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import {
  ArrowRight, Plus, MessageSquare, CheckCircle2, Circle, Sparkles,
} from "lucide-react";
import FunderHome from "./DashboardFunderHome";
import CorporateHome from "./DashboardCorporateHome";
import { Button } from "@/components/ui/button";
import CreateInitiativeModal from "@/components/platform/CreateInitiativeModal";

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------
function useCountUp(target: number, duration = 600): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (target === 0) { setCount(0); return; }
    let start: number | null = null;
    const step = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setCount(Math.round(eased * target));
      if (p < 1) requestAnimationFrame(step);
      else setCount(target);
    };
    requestAnimationFrame(step);
  }, [target, duration]);
  return count;
}

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

interface ActivitySnapshot {
  openConversations: number;
  pendingEOIs: number;
  openEnquiries: number;
  unreadMessages: number;
}

const STATUS_MAP: Record<string, { label: string; dot: string }> = {
  pending:   { label: "Pending review", dot: "#f59e0b" },
  published: { label: "Listed",         dot: "#2D6A4F" },
  rejected:  { label: "Not approved",   dot: "#ef4444" },
};

// ---------------------------------------------------------------------------
// Metric Card
// ---------------------------------------------------------------------------
function MetricCard({ label, value, sub, onClick, accent, showSkeleton }: {
  label: string;
  value: number | string;
  sub: string;
  onClick: () => void;
  accent: boolean;
  showSkeleton?: boolean;
}) {
  const numeric = typeof value === "number" ? value : 0;
  const animated = useCountUp(numeric);
  const isLoading = value === "—" && showSkeleton;

  return (
    <button type="button" onClick={onClick}
      className="text-left rounded-xl border bg-card px-4 py-4 hover:border-[#2D6A4F]/40 transition-colors group card-interactive"
      style={{ borderColor: accent ? "#C45C26" : undefined }}>
      <p className="text-xs font-bold uppercase tracking-widest text-black mb-2">{label}</p>
      {isLoading ? (
        <div className="skeleton h-9 w-12 mb-1" />
      ) : (
        <p className="text-3xl font-bold text-foreground tracking-tight group-hover:text-[#2D6A4F] transition-colors">
          {animated}
        </p>
      )}
      {isLoading ? (
        <div className="skeleton h-3 w-20 mt-2" />
      ) : (
        <p className="text-xs text-black mt-1">{sub}</p>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Getting Started Checklist
// Shown only on a genuine first login — see isDormant below for what
// replaces this from the second login onward if there's still no activity.
// ---------------------------------------------------------------------------
function GettingStarted({
  userType,
  isVerified,
  onCreateInitiative,
  profile,
}: {
  userType?: string;
  isVerified?: boolean;
  onCreateInitiative: () => void;
  profile?: any;
}) {
  const [location, navigate] = useLocation();
  const isOrg = userType === "organisation";

  const tasks = [
    {
      id: "initiative",
      label: "Post your first initiative",
      sub: "Let funders and partners discover what you're working on.",
      action: onCreateInitiative,
      actionLabel: "Create initiative",
      done: false,
    },
    {
      id: "marketplace",
      label: "Explore the marketplace",
      sub: "Browse initiatives from organisations across Africa.",
      action: () => navigate("/dashboard/marketplace"),
      actionLabel: "Browse now",
      done: false,
    },
    ...(isOrg && !isVerified ? [{
      id: "verify",
      label: "Get verified",
      sub: profile?.verification_requested
        ? "Your documents are under review. We'll notify you once confirmed."
        : "A verified badge builds trust with funders and partners.",
      action: () => navigate("/verify"),
      actionLabel: "Start verification",
      done: profile?.verification_requested ?? false,
    }] : []),
    {
      id: "natives",
      label: "Explore the directory",
      sub: "Find organisations and individuals in the ecosystem.",
      action: () => navigate("/dashboard/natives"),
      actionLabel: "Browse directory",
      done: false,
    },
  ];

  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-widest text-black mb-4">
        Get started
      </h3>
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {tasks.map((task, i) => (
          <div key={task.id}
            className={`flex items-start gap-4 px-5 py-4 ${
              i < tasks.length - 1 ? "border-b border-border" : ""
            }`}>
            <div className="mt-0.5 shrink-0">
              {task.done
                ? <CheckCircle2 className="w-5 h-5 text-[#2D6A4F]" />
                : <Circle className="w-5 h-5 text-muted-foreground/30" />
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${task.done ? "text-muted-foreground line-through" : "text-foreground"}`}>
                {task.label}
              </p>
              <p className="text-xs text-black mt-0.5">{task.sub}</p>            </div>
            {!task.done && (
              <button type="button" onClick={task.action}
                className="shrink-0 text-xs font-medium text-[#2D6A4F] hover:underline underline-offset-2 transition-colors whitespace-nowrap">
                {task.actionLabel} →
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Missed matches — shown to dormant users (2nd+ login, still zero activity)
// instead of the Getting Started checklist. Reuses the same sector-overlap
// approach already built for the monthly-activity-digest email, just live
// and interactive instead of monthly and static.
// ---------------------------------------------------------------------------
function MissedMatchesForYou({ userSectors }: { userSectors: string[] }) {
  const [location, navigate] = useLocation();
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState<any[]>([]);

  useEffect(() => {
    if (!userSectors || userSectors.length === 0) { setLoading(false); return; }

    supabase
      .from("initiative_requests")
      .select("id,title,problem,sectors,locations,specific_ask")
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        const scored = (data ?? [])
          .map((ini: any) => {
            const shared = (ini.sectors ?? []).filter((s: string) => userSectors.includes(s));
            return { ...ini, overlap: shared.length, sharedSectors: shared };
          })
          .filter((ini: any) => ini.overlap > 0)
          .sort((a: any, b: any) => b.overlap - a.overlap)
          .slice(0, 3);
        setMatches(scored);
        setLoading(false);
      });
  }, [userSectors]);

  if (!userSectors || userSectors.length === 0) return null;
  if (!loading && matches.length === 0) return null;

  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-widest text-black mb-1">
        A few things in your sectors
      </h3>
      <p className="text-xs text-black mb-4">
        Matched to {userSectors.slice(0, 2).join(", ")}{userSectors.length > 2 ? ` and ${userSectors.length - 2} more` : ""}
      </p>
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="h-20 rounded-xl border border-border bg-card animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {matches.map((ini: any) => (
            <button key={ini.id} type="button"
              onClick={() => navigate(`/dashboard/marketplace?initiative=${ini.id}`)}
              className="w-full text-left rounded-xl border border-border bg-card px-5 py-3.5 hover:border-[#2D6A4F]/30 transition-colors group flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground group-hover:text-[#2D6A4F] transition-colors truncate">
                  {ini.title}
                </p>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  {ini.sharedSectors.slice(0, 2).map((s: string) => (
                    <span key={s} className="text-xs px-2 py-0.5 rounded-full border border-border text-black">{s}</span>
                  ))}
                </div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-[#2D6A4F] shrink-0 transition-colors" />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// My Initiatives — mini list shown on Dashboard Home
// ---------------------------------------------------------------------------
function MyInitiativesMini({ initiatives }: { initiatives: InitiativeRow[] }) {
  const [location, navigate] = useLocation();
  if (initiatives.length === 0) return null;

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-black">
          Your initiatives
        </h3>
        <button type="button" onClick={() => navigate("/dashboard/portfolio")}
          className="text-xs text-[#2D6A4F] hover:underline underline-offset-2 transition-colors">
          View all →
        </button>
      </div>
      <div className="space-y-2">
        {initiatives.map(ini => {
          const s = STATUS_MAP[ini.status] ?? { label: ini.status, dot: "#6b7280" };
          return (
            <button key={ini.id} type="button"
              onClick={() => navigate("/dashboard/portfolio")}
              className="w-full text-left rounded-xl border border-border bg-card px-5 py-3.5 hover:border-[#2D6A4F]/30 transition-colors group flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: s.dot }} />
                  <span className="text-xs text-black">{s.label}</span>
                  <span className="text-xs text-black">·</span>
                  <span className="text-xs text-black">{ini.eois} EOI{ini.eois !== 1 ? "s" : ""}</span>
                </div>
                <p className="text-sm font-medium text-foreground group-hover:text-[#2D6A4F] transition-colors truncate">
                  {ini.title}
                </p>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-[#2D6A4F] shrink-0 transition-colors" />
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function DashboardHome() {
  const { user, profile } = useAuth();
  const [location, navigate] = useLocation();

  const [myInitiatives, setMyInitiatives]         = useState<InitiativeRow[]>([]);
  const [snapshot, setSnapshot] = useState<ActivitySnapshot>({ openConversations: 0, pendingEOIs: 0, openEnquiries: 0, unreadMessages: 0 });
  const [loadingPersonal, setLoadingPersonal]     = useState(true);
  const [showSkeleton, setShowSkeleton]           = useState(false);

  const [showCreateModal, setShowCreateModal]     = useState(false);
  const [allMyInits, setAllMyInits]               = useState<{id: string; status: string}[]>([]);

  const hour      = new Date().getHours();
  const greeting  = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = profile?.full_name?.split(" ")[0] ?? profile?.email?.split("@")[0] ?? "there";

  // ── Dynamic status subtitle ───────────────────────────────────────────────
  function getStatusLine(): string {
    if (snapshot.openConversations > 0 || snapshot.pendingEOIs > 0) {
      const parts = [
        snapshot.openConversations > 0 && `${snapshot.openConversations} pending conversation${snapshot.openConversations !== 1 ? "s" : ""}`,
        snapshot.pendingEOIs > 0       && `${snapshot.pendingEOIs} pending EOI${snapshot.pendingEOIs !== 1 ? "s" : ""}`,
      ].filter(Boolean);
      return `You have ${parts.join(" and ")}.`;
    }
    if (myInitiatives.length === 0 && !loadingPersonal) {
      return "Start by posting your first initiative.";
    }
    if (profile?.user_type === "organisation" && !profile?.is_verified && myInitiatives.length > 0) {
      return profile?.verification_requested
        ? "Your verification is under review. We'll notify you once confirmed."
        : "Complete verification to build trust with funders.";
    }
    if (myInitiatives.length > 0) {
      const listed = myInitiatives.filter(i => i.status === "published").length;
      return listed > 0
        ? `${listed} initiative${listed !== 1 ? "s" : ""} live in the marketplace.`
        : "Your initiatives are under review.";
    }
    return "Here's what's moving across your ecosystem.";
  }

  // ── Is new user (no initiatives, no messages) ─────────────────────────────
  const isNewUser = !loadingPersonal
    && myInitiatives.length === 0
    && snapshot.openConversations === 0
    && snapshot.pendingEOIs === 0
    && snapshot.openEnquiries === 0;

  // Dormant: zero activity, but this isn't their first time here. Getting
  // Started only makes sense once — after that, a static checklist with
  // nothing else ever showing isn't a real re-engagement path.
  const isDormant = isNewUser && (profile?.login_count ?? 0) >= 2;

  // ── Personal data fetch ───────────────────────────────────────────────────
  const loadPersonal = useCallback(async () => {
    if (!user?.id) return;
    const [initRes, allInitRes, convRes, eoiRes] = await Promise.all([
      supabase
        .from("initiative_requests")
        .select("id,title,sectors,locations,status,eois,created_at")
        .or(`user_id.eq.${user.id},submitter_email.eq.${user.email}`)
        .order("created_at", { ascending: false })
        .limit(3),
      supabase
        .from("initiative_requests")
        .select("id,status")
        .or(`user_id.eq.${user.id},submitter_email.eq.${user.email}`),
      supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", user.id),
      supabase
        .from("initiative_requests")
        .select("id")
        .or(`user_id.eq.${user.id},submitter_email.eq.${user.email}`),
    ]);

    if (initRes.data) setMyInitiatives(initRes.data as InitiativeRow[]);
    const allInits = allInitRes.data ?? [];
    const convIds = (convRes.data ?? []).map((r: any) => r.conversation_id).filter(Boolean);
    const myInitiativeIds = (eoiRes.data ?? []).map((r: any) => r.id).filter(Boolean);

    let eoiConvIds: string[] = [];
    if (myInitiativeIds.length > 0) {
      const { data: eoiData } = await supabase
        .from("expressions_of_interest")
        .select("conversation_id")
        .in("initiative_id", myInitiativeIds);
      eoiConvIds = (eoiData ?? []).map((r: any) => r.conversation_id).filter(Boolean);
    }

    const allConvIds = [...new Set([...convIds, ...eoiConvIds])];
    let openConversations = 0;
    let pendingEOIs = 0;
    let openEnquiries = 0;

    if (allConvIds.length > 0) {
      const { data: convStatuses } = await supabase
        .from("conversations")
        .select("id, status, conversation_type")
        .in("id", allConvIds);
      const statusMap = Object.fromEntries((convStatuses ?? []).map((c: any) => [c.id, c.status]));
      const typeMap = Object.fromEntries((convStatuses ?? []).map((c: any) => [c.id, c.conversation_type]));
      openConversations = convIds.filter((id: string) => statusMap[id] === "open" && typeMap[id] !== "question").length;
      const questionConvIds = convIds.filter((id: string) => statusMap[id] === "open" && typeMap[id] === "question");
      if (questionConvIds.length > 0) {
        const { data: lastMsgs } = await supabase
          .from("messages")
          .select("conversation_id, sender_id, read_at")
          .in("conversation_id", questionConvIds)
          .order("created_at", { ascending: false });
        const lastMsgMap = new Map<string, string>();
        (lastMsgs ?? []).forEach((m: any) => {
          if (!lastMsgMap.has(m.conversation_id)) lastMsgMap.set(m.conversation_id, m.sender_id);
        });
        openEnquiries = questionConvIds.filter(id => {
          const lastMsg = (lastMsgs ?? []).find((m: any) => m.conversation_id === id);
          return lastMsg && lastMsg.sender_id !== user.id && !lastMsg.read_at;
        }).length;
      }
      pendingEOIs = eoiConvIds.filter((id: string) => statusMap[id] === "pending").length;
    }

    // Unread messages — mirrors Sidebar.tsx's fetchUnread logic, but only the
    // two message-specific sub-blocks (question-conversation unread +
    // open-conversation unread). The sidebar badge also folds in pending-EOI
    // conversations, which would double-count against the separate Pending
    // EOIs tile here if copied wholesale.
    let unreadMessages = 0;
    const questionConvIdsForUnread = convIds.length > 0
      ? (await supabase
          .from("conversations")
          .select("id")
          .in("id", convIds)
          .eq("conversation_type", "question")
          .eq("status", "open")).data?.map((c: any) => c.id) ?? []
      : [];
    if (questionConvIdsForUnread.length > 0) {
      const { data: unreadQ } = await supabase
        .from("messages")
        .select("id")
        .in("conversation_id", questionConvIdsForUnread)
        .neq("sender_id", user.id)
        .is("read_at", null);
      unreadMessages += unreadQ?.length ?? 0;
    }
    if (convIds.length > 0) {
      const { data: openConvsForUnread } = await supabase
        .from("conversations")
        .select("id")
        .in("id", convIds)
        .eq("status", "open")
        .is("funder_closed_at", null);
      const openConvIdsForUnread = (openConvsForUnread ?? []).map((c: any) => c.id);
      if (openConvIdsForUnread.length > 0) {
        const { data: unreadOpen } = await supabase
          .from("messages")
          .select("id")
          .in("conversation_id", openConvIdsForUnread)
          .neq("sender_id", user.id)
          .is("read_at", null);
        unreadMessages += unreadOpen?.length ?? 0;
      }
    }

    setSnapshot({ openConversations, pendingEOIs, openEnquiries, unreadMessages });
    setAllMyInits(allInits);
    setLoadingPersonal(false);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const skeletonTimer = setTimeout(() => setShowSkeleton(true), 300);
    loadPersonal().then(() => {
      clearTimeout(skeletonTimer);
      setShowSkeleton(false);
    });
    return () => clearTimeout(skeletonTimer);
  }, [loadPersonal, location]);

  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === "visible") {
        loadPersonal();
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [loadPersonal]);

  const hasActivity = snapshot.openConversations > 0 || snapshot.pendingEOIs > 0 || snapshot.openEnquiries > 0;  const experience = (() => {
    const t = profile?.org_type;
    if (!t) return "implementer";
    if (["philanthropic_foundation", "venture_capital"].includes(t)) return "funder";
    if (["corporation", "technology_company", "public_sector"].includes(t)) return "corporate";
    return "implementer";
  })();

  // ── Render ─────────────────────────────────────────────────────────────────
  if (experience === "funder") return <FunderHome profile={profile} />;
  if (experience === "corporate") return <CorporateHome profile={profile} />;

  return (
    <>
      <div className="space-y-10">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs text-black mb-1 uppercase tracking-widest">{greeting}</p>
            <h2 className="text-2xl font-bold text-foreground tracking-tight">{firstName}.</h2>
            {!loadingPersonal && (
              <p className="text-black mt-1 text-sm">{getStatusLine()}</p>
            )}
          </div>
          
        </div>

        {/* Metrics strip — 3 tiles; dropped the platform-wide "In Marketplace"
            count, which had no connection to the user's own activity */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <MetricCard
            label="My Initiatives"
            value={loadingPersonal ? "—" : allMyInits.length}
            sub={allMyInits.filter(i => i.status === "published").length > 0
              ? `${allMyInits.filter(i => i.status === "published").length} live`
              : "none live yet"}
            onClick={() => navigate("/dashboard/portfolio")}
            accent={false}
            showSkeleton={showSkeleton}
          />
          <MetricCard
            label="Pending EOIs"
            value={loadingPersonal ? "—" : snapshot.pendingEOIs}
            sub={snapshot.pendingEOIs > 0 ? "needs your review" : "all clear"}
            onClick={() => navigate("/dashboard/messages")}
            accent={snapshot.pendingEOIs > 0}
            showSkeleton={showSkeleton}
          />
          <MetricCard
            label="Messages"
            value={loadingPersonal ? "—" : snapshot.unreadMessages}
            sub={snapshot.unreadMessages > 0 ? "unread" : "all caught up"}
            onClick={() => navigate("/dashboard/messages")}
            accent={snapshot.unreadMessages > 0}
            showSkeleton={showSkeleton}
          />
        </div>

        {/* Getting Started — first login only */}
        {!loadingPersonal && isNewUser && !isDormant && (
          <GettingStarted
            userType={profile?.user_type ?? undefined}
            isVerified={profile?.is_verified ?? undefined}
            onCreateInitiative={() => setShowCreateModal(true)}
            profile={profile}
          />
        )}

        {/* Dormant — 2nd+ login, still zero activity: live matches instead
            of a static checklist with nothing else to show */}
        {!loadingPersonal && isDormant && (
          <MissedMatchesForYou userSectors={profile?.sectors ?? []} />
        )}

        {/* My Initiatives — returning users with activity */}
        {!loadingPersonal && !isNewUser && myInitiatives.length > 0 && (
          <MyInitiativesMini initiatives={myInitiatives} />
        )}

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
