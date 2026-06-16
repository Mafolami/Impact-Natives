// ─── DashboardMessages.tsx ────────────────────────────────────────────────────
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { Loader2, Send, ArrowLeft, Clock, CheckCircle2, UserCheck, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PendingEOI {
  eoi_id: string;
  conversation_id: string;
  initiative_id: string;
  initiative_title: string;
  expresser_id: string;
  expresser_name: string;
  expresser_verified: boolean;
  partnership_type: string;
  message: string | null;
  created_at: string;
  esg_adoption: boolean;
}

interface OutboundEOI {
  eoi_id: string;
  conversation_id: string | null;
  initiative_id: string;
  initiative_title: string;
  partnership_type: string;
  message: string | null;
  created_at: string;
  conversation_status: string | null;
  initiative_owner_id: string | null;
}

interface Conversation {
  id: string;
  initiative_id: string;
  initiative_title: string;
  initiative_owner_id: string | null;
  other_user_id: string;
  other_user_name: string;
  other_user_type?: string;
  last_message: string;
  last_message_at: string;
  unread: boolean;
  status: string;
  partnerStatus: "confirmed" | "active" | "closed";
}

interface Message {
  id: string;
  sender_id: string;
  sender_name: string;
  body: string;
  created_at: string;
  read_at: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff  = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30)  return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

const PARTNERSHIP_OPTIONS = [
  { value: "funding",     label: "Funding" },
  { value: "technical",   label: "Technical" },
  { value: "operational", label: "Operational" },
  { value: "leadership",  label: "Leadership" },
  { value: "strategic",   label: "Strategic" },
  { value: "lead",        label: "Project Lead" },
  { value: "other",       label: "Other" },
];

function partnershipLabel(value: string) {
  return PARTNERSHIP_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function DashboardMessages() {
  const { user } = useAuth();
  const [pendingEOIs, setPendingEOIs]     = useState<PendingEOI[]>([]);
  const [outboundEOIs, setOutboundEOIs]   = useState<OutboundEOI[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading]             = useState(true);
  const [activeConvo, setActiveConvo]     = useState<Conversation | null>(null);

  useEffect(() => {
    if (!user) return;
    loadAll();
  }, [user]);

  async function loadAll() {
    if (!user) return;
    setLoading(true);

    // ── Inbound: pending EOIs on my initiatives ──────────────────────────────
    const { data: myInitiatives } = await supabase
      .from("initiative_requests")
      .select("id, title")
      .eq("user_id", user.id);

    const myInitiativeIds = (myInitiatives ?? []).map((i: any) => i.id);
    const initiativeTitleMap = new Map((myInitiatives ?? []).map((i: any) => [i.id, i.title]));

    let pendingList: PendingEOI[] = [];

    if (myInitiativeIds.length > 0) {
      const { data: eoiData } = await supabase
        .from("expressions_of_interest")
        .select("id, initiative_id, user_id, partnership_type, message, created_at, conversation_id, esg_adoption")
        .in("initiative_id", myInitiativeIds)
        .neq("user_id", user.id);

      if (eoiData && eoiData.length > 0) {
        const convoIds = eoiData.map((e: any) => e.conversation_id).filter(Boolean);
        const { data: convoData } = await supabase
          .from("conversations")
          .select("id, status")
          .in("id", convoIds);
        const convoStatusMap = new Map((convoData ?? []).map((c: any) => [c.id, c.status]));

        const pendingEois = eoiData.filter((e: any) =>
          e.conversation_id && convoStatusMap.get(e.conversation_id) === "pending"
        );

const expresserIds = [...new Set(pendingEois.map((e: any) => e.user_id))];
                const { data: profiles } = await supabase
          .from("profiles").select("id, full_name, org_name, user_type, is_verified").in("id", expresserIds);
        const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

        pendingList = pendingEois.map((e: any) => {
          const p = profileMap.get(e.user_id);
          const expresserName = p?.user_type === "organisation" && p?.org_name
            ? p.org_name
            : p?.full_name ?? "Someone";
          return ({
          eoi_id:            e.id,
          conversation_id:   e.conversation_id,
          initiative_id:     e.initiative_id,
          initiative_title:  initiativeTitleMap.get(e.initiative_id) ?? "Initiative",
          expresser_id:      e.user_id,
          expresser_name:    expresserName,
          expresser_verified: p?.is_verified ?? false,
          partnership_type:  e.partnership_type,
          message:           e.message,
          created_at:        e.created_at,
          esg_adoption:      e.esg_adoption ?? false,
        });});
      }
    }

    setPendingEOIs(pendingList);

    // ── Outbound: EOIs I've sent ─────────────────────────────────────────────
    const { data: sentEois } = await supabase
      .from("expressions_of_interest")
      .select("id, initiative_id, partnership_type, message, created_at, conversation_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (sentEois && sentEois.length > 0) {
      const sentConvoIds = sentEois.map((e: any) => e.conversation_id).filter(Boolean);
      const { data: sentConvoData } = await supabase
        .from("conversations").select("id, status").in("id", sentConvoIds);
      const sentConvoStatusMap = new Map((sentConvoData ?? []).map((c: any) => [c.id, c.status]));

      const initIds = [...new Set(sentEois.map((e: any) => e.initiative_id))];
const { data: initData } = await supabase
        .from("initiative_requests").select("id, title, user_id").in("id", initIds);
      const initTitleMap = new Map((initData ?? []).map((i: any) => [i.id, i.title]));
      const initOwnerMap = new Map((initData ?? []).map((i: any) => [i.id, i.user_id]));

      setOutboundEOIs(sentEois.map((e: any) => ({
        eoi_id:              e.id,
        conversation_id:     e.conversation_id,
        initiative_id:       e.initiative_id,
        initiative_title:    initTitleMap.get(e.initiative_id) ?? "Initiative",
        partnership_type:    e.partnership_type,
        message:             e.message,
        created_at:          e.created_at,
        conversation_status: e.conversation_id ? (sentConvoStatusMap.get(e.conversation_id) ?? null) : null,
        initiative_owner_id: initOwnerMap.get(e.initiative_id) ?? null,
      })));
    } else {
      setOutboundEOIs([]);
    }

    // ── Open conversations ───────────────────────────────────────────────────
    const { data: myConvos } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", user.id);

    const myConvoIds = (myConvos ?? []).map((c: any) => c.conversation_id);

    if (myConvoIds.length > 0) {
      const { data: convoData } = await supabase
        .from("conversations")
        .select("id, initiative_id, status, initiative_owner_id")
        .in("id", myConvoIds)
        .in("status", ["open", "rejected"]);

      if (convoData && convoData.length > 0) {
        const initIds = [...new Set(convoData.map((c: any) => c.initiative_id).filter(Boolean))];
        const { data: inits } = await supabase
          .from("initiative_requests").select("id, title").in("id", initIds);
        const initTitleMap = new Map((inits ?? []).map((i: any) => [i.id, i.title]));

        const { data: allParticipants } = await supabase
          .rpc("get_conversation_participants", {
            p_conversation_ids: convoData.map((c: any) => c.id)
          });

        const otherUserIds = [...new Set(
          (allParticipants ?? [])
            .filter((p: any) => p.user_id !== user.id)
            .map((p: any) => p.user_id)
        )];

        const { data: otherProfiles } = await supabase
          .from("profiles").select("id, full_name").in("id", otherUserIds);
        const otherProfileMap = new Map((otherProfiles ?? []).map((p: any) => [p.id, p.full_name]));

        const { data: lastMessages } = await supabase
          .from("messages")
          .select("conversation_id, body, created_at, read_at, sender_id")
          .in("conversation_id", convoData.map((c: any) => c.id))
          .order("created_at", { ascending: false });

        const lastMsgMap = new Map<string, any>();
        (lastMessages ?? []).forEach((m: any) => {
          if (!lastMsgMap.has(m.conversation_id)) lastMsgMap.set(m.conversation_id, m);
        });

        const participantMap = new Map<string, string>();
        (allParticipants ?? []).forEach((p: any) => {
          if (p.user_id !== user.id) participantMap.set(p.conversation_id, p.user_id);
        });

        const convos = convoData.map((c: any) => {
          const otherId = participantMap.get(c.id) ?? "";
          const lastMsg = lastMsgMap.get(c.id);
          return {
            id:                  c.id,
            initiative_id:       c.initiative_id,
            initiative_title:    initTitleMap.get(c.initiative_id) ?? "Initiative",
            initiative_owner_id: c.initiative_owner_id ?? null,
            other_user_id:       otherId,
            other_user_name:     otherProfileMap.get(otherId) ?? "Unknown",
            last_message:        lastMsg?.body ?? "",
            last_message_at:     lastMsg?.created_at ?? c.created_at ?? "",
            unread:              lastMsg && lastMsg.sender_id !== user.id && !lastMsg.read_at,
            status:              c.status ?? "open",
          };
        });

        const baseConvos: Conversation[] = convos.map((c) => ({
          ...c,
          partnerStatus: (c.status === "rejected" || c.status === "closed") ? "closed" : "active",
        } as Conversation));

        baseConvos.sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
        setConversations(baseConvos);

        // Enrich with confirmed status in background
        const uniqueInitIds = [...new Set(baseConvos.map((c) => c.initiative_id).filter(Boolean))];
        if (uniqueInitIds.length > 0) {
          supabase
            .from("initiative_requests")
            .select("id, confirmed_partners")
            .in("id", uniqueInitIds)
            .then(({ data: confirmedData }) => {
              const confirmedMap = new Map((confirmedData ?? []).map((i: any) => [i.id, i.confirmed_partners ?? []]));
              setConversations((prev) => prev.map((c) => {
                const partners = confirmedMap.get(c.initiative_id) ?? [];
                const isConfirmed = partners.some((p: any) =>
                  p.user_id === c.other_user_id || p.user_id === user!.id
                );
                return isConfirmed ? { ...c, partnerStatus: "confirmed" } : c;
              }));
            });
        }
      } else {
        setConversations([]);
      }
    } else {
      setConversations([]);
    }

    setLoading(false);
  }

  async function acceptEOI(eoi: PendingEOI) {
    await supabase.from("conversations").update({ status: "open" }).eq("id", eoi.conversation_id);
        await supabase.from("notifications").insert({
      user_id: eoi.expresser_id,
      type:    "eoi_accepted",
      title:   "Expression of interest accepted",
      body:    `Your ${partnershipLabel(eoi.partnership_type)} Partnership interest in "${eoi.initiative_title}" was accepted. A chat has been opened.`,
      link:    "/dashboard/messages",
    });
    setPendingEOIs((prev) => prev.filter((e) => e.eoi_id !== eoi.eoi_id));
    loadAll();
  }

  async function declineEOI(eoi: PendingEOI) {
    await supabase.from("conversations").update({ status: "declined" }).eq("id", eoi.conversation_id);
    await supabase.from("notifications").insert({
      user_id: eoi.expresser_id,
      type:    "eoi_declined",
      title:   "Expression of interest not accepted",
      body:    `Your ${eoi.partnership_type} interest in "${eoi.initiative_title}" was not taken forward.`,
      link:    "/dashboard/messages",
    });
    setPendingEOIs((prev) => prev.filter((e) => e.eoi_id !== eoi.eoi_id));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-5 h-5 text-[#2D6A4F] animate-spin" />
      </div>
    );
  }

  const pendingOutbound = outboundEOIs.filter(
    (e) => !["open", "rejected", "closed"].includes(e.conversation_status ?? "")
  );

  if (activeConvo) {
    return (
      <ChatThread
        conversation={activeConvo}
        currentUserId={user!.id}
        onBack={() => { setActiveConvo(null); loadAll(); }}
      />
    );
  }

  const hasAnything = pendingEOIs.length > 0 || conversations.length > 0 || pendingOutbound.length > 0;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-foreground tracking-tight">Messages</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Expressions of interest and active conversations.
        </p>
      </div>

      {!hasAnything ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center">
          <Clock className="w-8 h-8 text-muted-foreground/40 mx-auto mb-4" />
          <p className="text-foreground font-medium mb-2">No messages yet.</p>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
            When you or others express interest in initiatives, conversations will appear here.
          </p>
          <Link href="/dashboard/marketplace">
            <Button className="bg-[#2D6A4F] hover:bg-[#245c43] text-white rounded-full px-5">
              Browse Marketplace
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-8">

          {/* 1 — Awaiting review */}
          {pendingEOIs.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                Awaiting review — {pendingEOIs.length}
              </h3>
              <div className="space-y-2">
                {pendingEOIs.map((eoi) => (
                  <div key={eoi.eoi_id}
                    className="rounded-xl border border-border bg-card px-5 py-4 flex items-start gap-4">
                    <div className="w-8 h-8 rounded-lg bg-[#eaf5ee] flex items-center justify-center shrink-0 mt-0.5">
                      <CheckCircle2 className="w-4 h-4 text-[#2D6A4F]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {eoi.expresser_name} expressed interest
                            </p>
                            {eoi.expresser_verified && (
                              <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full"
                                style={{ background: "#eaf5ee", color: "#2D6A4F" }}>
                                ✓ Verified
                              </span>
                            )}
                          </div>
                          {eoi.expresser_id && (
                            <Link
                              href={`/dashboard/natives?user=${eoi.expresser_id}&tab=organisations`}
                              className="text-[10px] text-muted-foreground hover:text-[#2D6A4F] transition-colors shrink-0 underline underline-offset-2">
                              View profile
                            </Link>
                          )}
                        </div>
                        <span className="text-[11px] text-muted-foreground shrink-0">{timeAgo(eoi.created_at)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mb-1">
                        <span className="text-foreground/70">{eoi.initiative_title}</span>
                      </p>
                                            <div className="flex items-center gap-1.5 flex-wrap mt-1">
                        {eoi.partnership_type && (
                          <span className="inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                            style={{ background: "#f5ede8", color: "#C45C26" }}>
                            {eoi.partnership_type}
                          </span>
                        )}
                        {eoi.esg_adoption && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                            style={{ background: "#e8f5e9", color: "#2e7d32" }}>
                            ESG/CSR Adoption
                          </span>
                        )}
                      </div>
                      {eoi.message && (
                        <p className="text-xs text-muted-foreground mt-2 leading-relaxed line-clamp-2">
                          "{eoi.message}"
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                      <button type="button" onClick={() => acceptEOI(eoi)}
                        className="px-3 py-1.5 rounded-full text-xs bg-[#2D6A4F] hover:bg-[#245c43] text-white transition-colors font-medium">
                        Accept
                      </button>
                      <button type="button" onClick={() => declineEOI(eoi)}
                        className="px-3 py-1.5 rounded-full text-xs border border-red-400/40 text-red-500 hover:bg-red-50 transition-colors">
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 2 — Active conversations */}
          {conversations.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Conversations
                </h3>
                <Link href="/dashboard/initiatives?tab=partners"
                  className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-[#2D6A4F] hover:underline underline-offset-2">
                  Confirmed partnerships
                  <ExternalLink className="w-2.5 h-2.5" />
                </Link>
              </div>
              <div className="space-y-2">
                {conversations.map((convo) => (
                  <button key={convo.id} type="button" onClick={() => setActiveConvo(convo)}
                    className="w-full text-left rounded-xl border border-border bg-card px-5 py-4 flex items-start gap-4 hover:border-[#2D6A4F]/40 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-[#2D6A4F] flex items-center justify-center shrink-0 mt-0.5 text-white text-xs font-bold">
                      {((convo.other_user_name ?? "?")[0]).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <p className={`text-sm font-medium truncate ${convo.unread ? "text-foreground" : "text-foreground/80"}`}>
                            {convo.other_user_name ?? "Unknown"}
                          </p>
                          {convo.other_user_id && (
                            <Link href={`/dashboard/natives?user=${convo.other_user_id}&tab=organisations`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-[10px] text-muted-foreground hover:text-[#2D6A4F] transition-colors shrink-0 underline underline-offset-2">
                              View profile
                            </Link>
                          )}
                        </div>
                        <span className="text-[11px] text-muted-foreground shrink-0">{timeAgo(convo.last_message_at)}</span>
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-xs text-muted-foreground truncate">Re: {convo.initiative_title}</p>
                        {convo.partnerStatus === "confirmed" && (
                          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                            style={{ background: "#eaf5ee", color: "#2D6A4F" }}>Confirmed</span>
                        )}
                        {convo.partnerStatus === "closed" && (
                          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                            style={{ background: "#fef2f2", color: "#ef4444" }}>Closed</span>
                        )}
                        {convo.partnerStatus === "active" && (
                          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                            style={{ background: "#fffbeb", color: "#f59e0b" }}>Active</span>
                        )}
                      </div>
                      <p className={`text-xs truncate ${convo.unread ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                        {convo.last_message}
                      </p>
                    </div>
                    {convo.unread && <div className="w-2 h-2 rounded-full bg-[#2D6A4F] shrink-0 mt-2" />}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* 3 — Sent (pending only) */}
          {pendingOutbound.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                Sent
              </h3>
              <div className="space-y-2">
                {pendingOutbound.map((eoi) => {
                  const status = eoi.conversation_status;
                  const statusConfig = status === "open"
                    ? { label: "Accepted", bg: "#eaf5ee", color: "#2D6A4F" }
                    : status === "declined"
                    ? { label: "Declined", bg: "#fef2f2", color: "#ef4444" }
                    : { label: "Pending", bg: "#fffbeb", color: "#f59e0b" };

                  return (
                    <div key={eoi.eoi_id}
                      className="rounded-xl border border-border bg-card px-5 py-4 flex items-start gap-4">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                        style={{ background: statusConfig.bg }}>
                        <UserCheck className="w-4 h-4" style={{ color: statusConfig.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {eoi.initiative_title}
                            </p>
                            {eoi.initiative_owner_id && (
                              <Link href={`/dashboard/natives?user=${eoi.initiative_owner_id}&tab=organisations`}
                                className="text-[10px] text-muted-foreground hover:text-[#2D6A4F] transition-colors shrink-0 underline underline-offset-2">
                                View profile
                              </Link>
                            )}
                          </div>
                          <span className="text-[11px] text-muted-foreground shrink-0">{timeAgo(eoi.created_at)}</span>
                        </div>
                        <span className="inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full mr-2"
                          style={{ background: "#f5ede8", color: "#C45C26" }}>
                          {eoi.partnership_type}
                        </span>
                        <span className="inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                          style={{ background: statusConfig.bg, color: statusConfig.color }}>
                          {statusConfig.label}
                        </span>
                        {eoi.message && (
                          <p className="text-xs text-muted-foreground mt-2 leading-relaxed line-clamp-2">
                            "{eoi.message}"
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

        </div>
      )}
    </div>
  );
}

// ─── Chat Thread ──────────────────────────────────────────────────────────────

function ChatThread({
  conversation,
  currentUserId,
  onBack,
}: {
  conversation: Conversation;
  currentUserId: string;
  onBack: () => void;
}) {
  const [messages, setMessages]           = useState<Message[]>([]);
  const [loading, setLoading]             = useState(true);
  const [body, setBody]                   = useState("");
  const [sending, setSending]             = useState(false);
  const [confirmOpen, setConfirmOpen]     = useState(false);
  const [confirmRole, setConfirmRole]     = useState("");
  const [confirming, setConfirming]       = useState(false);
  const [publicOnFeed, setPublicOnFeed]   = useState(false);
  const [confirmedRole, setConfirmedRole] = useState<string | null>(null);
    const [rejecting, setRejecting]         = useState(false);
  const [otherUserType, setOtherUserType] = useState<string | null>(null);
  const [isRejected, setIsRejected]       = useState(conversation.status === "rejected");
  const bottomRef                         = useRef<HTMLDivElement>(null);

  const isOwner = conversation.initiative_owner_id === currentUserId;

  useEffect(() => {
    loadMessages();
    checkIfConfirmed();

    const channel = supabase
      .channel(`chat-thread-${conversation.id}-${Date.now()}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "messages",
      }, (payload) => {
        if ((payload.new as any).conversation_id !== conversation.id) return;
        const msg = payload.new as any;
        if (msg.sender_id === currentUserId) {
          setMessages((prev) => prev.map((m) =>
            m.id.startsWith("optimistic-") && m.body === msg.body
              ? { ...m, id: msg.id, created_at: msg.created_at }
              : m
          ));
          return;
        }
        setMessages((prev) => [...prev, {
          id:          msg.id,
          sender_id:   msg.sender_id,
          sender_name: conversation.other_user_name,
          body:        msg.body,
          created_at:  msg.created_at,
          read_at:     msg.read_at,
        }]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversation.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function checkIfConfirmed() {
    const { data } = await supabase
      .from("initiative_requests")
      .select("confirmed_partners")
      .eq("id", conversation.initiative_id)
      .single();

    if (data?.confirmed_partners) {
      const partners = data.confirmed_partners as any[];
      const match = partners.find((p) =>
        p.user_id === conversation.other_user_id || p.user_id === currentUserId
      );
      if (match) setConfirmedRole(match.role);
    }
  }

  async function loadMessages() {
    
    setLoading(true);

    const { data } = await supabase
      .from("messages")
      .select("id, sender_id, body, created_at, read_at")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true });

    const { data: participants } = await supabase
      .rpc("get_conversation_participants", { p_conversation_ids: [conversation.id] });

    const otherIds = (participants ?? [])
      .map((p: any) => p.user_id)
      .filter((id: string) => id !== currentUserId);
    

    const { data: profiles } = await supabase
      .from("profiles").select("id, full_name, user_type").in("id", otherIds);
    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p.full_name]));
    const otherProfile = (profiles ?? []).find((p: any) => p.id === conversation.other_user_id);
    if (otherProfile) {
      setOtherUserType((otherProfile as any).user_type ?? null);
  
    }

    setMessages((data ?? []).map((m: any) => ({
      id:          m.id,
      sender_id:   m.sender_id,
      sender_name: m.sender_id === currentUserId ? "You" : (profileMap.get(m.sender_id) ?? "Them"),
      body:        m.body,
      created_at:  m.created_at,
      read_at:     m.read_at,
    })));

    const unreadIds = (data ?? [])
      .filter((m: any) => m.sender_id !== currentUserId && !m.read_at)
      .map((m: any) => m.id);
    if (unreadIds.length > 0) {
      await supabase.from("messages").update({ read_at: new Date().toISOString() }).in("id", unreadIds);
    }

    setLoading(false);
  }

  async function sendMessage() {
    if (!body.trim() || sending) return;
    const text = body.trim();
    setBody("");
    setSending(true);

    const optimistic: Message = {
      id:          `optimistic-${Date.now()}`,
      sender_id:   currentUserId,
      sender_name: "You",
      body:        text,
      created_at:  new Date().toISOString(),
      read_at:     null,
    };
    setMessages((prev) => [...prev, optimistic]);

    await supabase.from("messages").insert({
      conversation_id: conversation.id,
      sender_id:       currentUserId,
      body:            text,
    });

    setSending(false);
  }

  async function confirmPartner() {
    if (!confirmRole || confirming) return;
    setConfirming(true);

    const { data: otherProfile } = await supabase
      .from("profiles")
      .select("user_type, org_name, full_name")
      .eq("id", conversation.other_user_id)
      .single();

    const displayName = otherProfile?.user_type === "organisation" && otherProfile?.org_name
      ? otherProfile.org_name
      : otherProfile?.full_name ?? conversation.other_user_name;

    const { data: iniData } = await supabase
      .from("initiative_requests")
      .select("confirmed_partners, title")
      .eq("id", conversation.initiative_id)
      .single();

    const existing = (iniData?.confirmed_partners as any[]) ?? [];
    const alreadyConfirmed = existing.find((p) => p.user_id === conversation.other_user_id);

    if (!alreadyConfirmed) {
      const newEntry = {
        user_id:       conversation.other_user_id,
        name:          displayName,
        role:          confirmRole,
        profile_link:  `/dashboard/natives?user=${conversation.other_user_id}`,
        confirmed_at:  new Date().toISOString(),
        public_on_feed: publicOnFeed,
      };
      await supabase
        .from("initiative_requests")
        .update({ confirmed_partners: [...existing, newEntry] })
        .eq("id", conversation.initiative_id);
    } else {
const updated = existing.map((p) =>
        p.user_id === conversation.other_user_id ? { ...p, role: confirmRole, public_on_feed: publicOnFeed } : p
      );
      await supabase
        .from("initiative_requests")
        .update({ confirmed_partners: updated })
        .eq("id", conversation.initiative_id);
    }

await supabase.from("notifications").insert({
      user_id: conversation.other_user_id,
      type:    "partner_confirmed",
      title:   "You've been confirmed as a partner",
      body:    `You were confirmed as ${partnershipLabel(confirmRole)} Partner on "${iniData?.title ?? "an initiative"}".`,
      link:    "/dashboard/initiatives?tab=partners",
    });

    setConfirmedRole(confirmRole);
    setConfirmOpen(false);
    setConfirming(false);
  }

  async function rejectConversation() {
    if (rejecting) return;
    setRejecting(true);
    await supabase
      .from("conversations")
      .update({ status: "rejected" })
      .eq("id", conversation.id);
    await supabase.from("notifications").insert({
      user_id: conversation.other_user_id,
      type:    "conversation_closed",
      title:   "Conversation closed",
      body:    `The conversation about "${conversation.initiative_title}" has been closed.`,
      link:    "/dashboard/messages",
    });
    setIsRejected(true);
    setRejecting(false);
  }

  const [initiativePartnerships, setInitiativePartnerships] = useState<string[]>([]);
  useEffect(() => {
    supabase
      .from("initiative_requests")
      .select("partnerships")
      .eq("id", conversation.initiative_id)
      .single()
      .then(({ data }) => {
        if (data?.partnerships) setInitiativePartnerships([...data.partnerships, "other"]);
      });
  }, [conversation.initiative_id]);

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)]">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border mb-4">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onBack}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <p className="text-sm font-semibold text-foreground">{conversation.other_user_name}</p>
            <p className="text-xs text-muted-foreground">Re: {conversation.initiative_title}</p>
          </div>
        </div>

        {/* Owner actions */}
        {isOwner && (
          <div className="flex items-center gap-2">
            {confirmedRole ? (
              <span className="text-xs px-3 py-1.5 rounded-full font-medium"
                style={{ background: "#eaf5ee", color: "#2D6A4F" }}>
                ✓ Confirmed as {partnershipLabel(confirmedRole)}
              </span>
            ) : isRejected ? (
              <span className="text-xs px-3 py-1.5 rounded-full font-medium"
                style={{ background: "#fef2f2", color: "#ef4444" }}>
                Conversation closed
              </span>
            ) : (
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setConfirmOpen(true)}
                  className="text-xs px-3 py-1.5 rounded-full border border-[#2D6A4F] text-[#2D6A4F] hover:bg-[#eaf5ee] transition-colors font-medium flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5" />
                  Confirm partner
                </button>
                <button type="button" onClick={rejectConversation} disabled={rejecting}
                  className="text-xs px-3 py-1.5 rounded-full border border-red-400/40 text-red-500 hover:bg-red-50 transition-colors font-medium disabled:opacity-40">
                  {rejecting ? "Closing..." : "Reject & close"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Non-owner status */}
        {!isOwner && (
          isRejected ? (
            <span className="text-xs px-3 py-1.5 rounded-full font-medium"
              style={{ background: "#fef2f2", color: "#ef4444" }}>
              This conversation was closed
            </span>
          ) : confirmedRole ? (
            <span className="text-xs px-3 py-1.5 rounded-full font-medium"
              style={{ background: "#eaf5ee", color: "#2D6A4F" }}>
              ✓ You're confirmed as {partnershipLabel(confirmedRole)}
            </span>
          ) : null
        )}
      </div>

      {/* Confirm modal */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-background rounded-2xl border border-border w-full max-w-sm shadow-xl p-6 space-y-4">
            <h3 className="text-base font-semibold text-foreground">
              Confirm {conversation.other_user_name} as partner
            </h3>
            <p className="text-sm text-muted-foreground">
              Select the role they'll play in this initiative.
            </p>
            <div className="flex flex-wrap gap-2">
              {initiativePartnerships.map((p) => (
                <button key={p} type="button"
                  onClick={() => setConfirmRole(p)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    confirmRole === p
                      ? "bg-[#2D6A4F] text-white border-[#2D6A4F]"
                      : "border-border text-muted-foreground hover:border-[#2D6A4F]"
                  }`}>
                  {partnershipLabel(p)}
                </button>
              ))}
            </div>
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={publicOnFeed}
                onChange={(e) => setPublicOnFeed(e.target.checked)}
                className="mt-0.5 accent-[#2D6A4F]"
              />
              <span className="text-xs text-muted-foreground leading-relaxed">
                Show this partnership on the Impact Natives activity feed
              </span>
            </label>
            <div className="flex gap-2 pt-2">
                            <button type="button" onClick={() => { setConfirmOpen(false); setConfirmRole(""); setPublicOnFeed(false); }}
                className="flex-1 h-9 rounded-full border border-border text-sm text-muted-foreground hover:text-foreground transition-colors">
                Cancel
              </button>
              <button type="button" onClick={confirmPartner}
                disabled={!confirmRole || confirming}
                className="flex-1 h-9 rounded-full bg-[#2D6A4F] hover:bg-[#245c43] text-white text-sm font-medium disabled:opacity-40 transition-colors">
                {confirming ? "Confirming..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-4 h-4 text-[#2D6A4F] animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">No messages yet. Say hello.</p>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_id === currentUserId;
            return (
              <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[72%] rounded-2xl px-4 py-2.5 text-sm ${
                  isMe
                    ? "bg-[#2D6A4F] text-white rounded-br-sm"
                    : "bg-muted text-foreground rounded-bl-sm"
                }`}>
                  <p className="leading-relaxed whitespace-pre-wrap">{msg.body}</p>
                  <p className={`text-[10px] mt-1 ${isMe ? "text-white/60" : "text-muted-foreground"}`}>
                    {timeAgo(msg.created_at)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {isRejected ? (
        <div className="pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground text-center py-2">
            This conversation has been closed.
          </p>
        </div>
      ) : (
        <div className="pt-4 border-t border-border flex gap-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
            }}
            placeholder="Type a message... (Shift+Enter for new line)"
            rows={1}
            className="flex-1 px-4 py-2.5 rounded-2xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors resize-none"
            style={{ minHeight: "40px", maxHeight: "120px" }}
          />
          <button type="button" onClick={sendMessage} disabled={!body.trim() || sending}
            className="w-10 h-10 rounded-full bg-[#2D6A4F] hover:bg-[#245c43] text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      )}
    </div>
  );
}