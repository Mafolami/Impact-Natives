// ─── DashboardMessages.tsx ────────────────────────────────────────────────────
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { Loader2, Send, ArrowLeft, Clock, CheckCircle2, UserCheck, ExternalLink, ShieldCheck, Handshake, Lightbulb, HelpCircle } from "lucide-react";
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
  initiative_owner_name: string;
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
  partnerStatus: "confirmed" | "active" | "closed" | "pending";
  conversation_type?: string | null;
  funder_closed_at?: string | null;
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
  { value: "interest",    label: "Interest" },
];

function partnershipLabel(value: string) {
  return PARTNERSHIP_OPTIONS.find(o => o.value === value)?.label ?? value;
}
function rolePartnerPhrase(value: string): string {
  const label = partnershipLabel(value);
  if (/partner$/i.test(label)) return label;
  if (label === "Project Lead") return label;
  return `${label} partner`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function DashboardMessages() {
 const { user, profile, orgOwnerId } = useAuth();
  const isFunder = ["philanthropic_foundation", "venture_capital"].includes(profile?.org_type ?? "");
  const [pendingEOIs, setPendingEOIs]     = useState<PendingEOI[]>([]);
  const [outboundEOIs, setOutboundEOIs]   = useState<OutboundEOI[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading]             = useState(true);
  const [activeConvo, setActiveConvo]     = useState<Conversation | null>(null);
  const [activeTab, setActiveTab]         = useState<"partnership" | "initiative">("partnership");
  useEffect(() => {
    if (!user || !orgOwnerId) return;
    loadAll();
  }, [user, orgOwnerId]);

  // Extra re-trigger for same-route notification clicks (see Topbar.tsx) --
  // without this, a component already sitting on this page never notices
  // the URL's ?conversation= changed, since Wouter doesn't remount it.
  const [deepLinkTrigger, setDeepLinkTrigger] = useState(0);
  useEffect(() => {
    function handler() { setDeepLinkTrigger(t => t + 1); }
    window.addEventListener("open-conversation", handler);
    return () => window.removeEventListener("open-conversation", handler);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const convId = params.get("conversation");
    const tabParam = params.get("tab");
    if (!convId) {
      // Some notifications (a new EOI on your initiative) should land on a
      // tab so the person can decide what to do next, not jump straight
      // into an open conversation before they've accepted or declined it.
      if (tabParam === "partnership" || tabParam === "initiative") setActiveTab(tabParam);
      return;
    }
    const match = conversations.find(c => c.id === convId);
    if (match) {
      setActiveConvo(match);
      setActiveTab(match.conversation_type === "partnership" ? "partnership" : "initiative");
      return;
    }
    // Not in the currently loaded list -- likely a conversation created
    // just now, while already sitting on this page (list won't include it
    // until the next full refresh). Fetch it directly instead of waiting.
    if (!user) return;
    supabase.from("conversations")
      .select("id, initiative_id, status, initiative_owner_id, conversation_type, funder_closed_at")
      .eq("id", convId).maybeSingle()
      .then(async ({ data: convo }) => {
        if (!convo) return;
        const { data: participants } = await supabase
          .rpc("get_conversation_participants", { p_conversation_ids: [convo.id] });
        const otherId = (participants ?? []).find((p: any) => p.user_id !== user.id)?.user_id ?? "";
        const { data: otherProfile } = otherId
          ? await supabase.from("profiles").select("full_name").eq("id", otherId).maybeSingle()
          : { data: null };
        const { data: initData } = convo.initiative_id
          ? await supabase.from("initiative_requests").select("title").eq("id", convo.initiative_id).maybeSingle()
          : { data: null };
        const built: Conversation = {
          id: convo.id,
          initiative_id: convo.initiative_id,
          initiative_title: initData?.title ?? "Conversation",
          initiative_owner_id: convo.initiative_owner_id ?? null,
          other_user_id: otherId,
          other_user_name: otherProfile?.full_name ?? "Unknown",
          last_message: "",
          last_message_at: "",
          unread: false,
          status: convo.status ?? "open",
          partnerStatus: (convo.status === "rejected" || convo.status === "closed") ? "closed"
            : convo.status === "pending_acceptance" ? "pending" : "active",
          conversation_type: convo.conversation_type ?? "eoi",
          funder_closed_at: convo.funder_closed_at ?? null,
        };
        setActiveConvo(built);
        setActiveTab(built.conversation_type === "partnership" ? "partnership" : "initiative");
      });
  }, [conversations.length, deepLinkTrigger, user]);

  async function loadPendingEOIs(): Promise<void> {
    if (!user || !orgOwnerId) return;
    const { data: myInitiatives } = await supabase
      .from("initiative_requests")
      .select("id, title")
      .eq("user_id", orgOwnerId);
    const myInitiativeIds = (myInitiatives ?? []).map((i: any) => i.id);
    const initiativeTitleMap = new Map((myInitiatives ?? []).map((i: any) => [i.id, i.title]));
    let pendingList: PendingEOI[] = [];
    if (myInitiativeIds.length > 0) {
      const { data: eoiData } = await supabase
        .from("expressions_of_interest")
        .select("id, initiative_id, user_id, partnership_type, message, created_at, conversation_id, esg_adoption")
        .in("initiative_id", myInitiativeIds)
        .neq("user_id", orgOwnerId);
      if (eoiData && eoiData.length > 0) {
        const convoIds = eoiData.map((e: any) => e.conversation_id).filter(Boolean);
        const { data: convoData } = await supabase
          .from("conversations").select("id, status").in("id", convoIds);
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
          const expresserName = p?.user_type === "organisation" && p?.org_name ? p.org_name : p?.full_name ?? "Someone";
          return {
            eoi_id:             e.id,
            conversation_id:    e.conversation_id,
            initiative_id:      e.initiative_id,
            initiative_title:   initiativeTitleMap.get(e.initiative_id) ?? "Initiative",
            expresser_id:       e.user_id,
            expresser_name:     expresserName,
            expresser_verified: p?.is_verified ?? false,
            partnership_type:   e.partnership_type,
            message:            e.message,
            created_at:         e.created_at,
            esg_adoption:       e.esg_adoption ?? false,
          };
        });
      }
    }
    setPendingEOIs(pendingList);
  }

  async function loadOutboundEOIs(): Promise<void> {
    if (!user || !orgOwnerId) return;
    const { data: sentEois } = await supabase
      .from("expressions_of_interest")
      .select("id, initiative_id, partnership_type, message, created_at, conversation_id")
      .eq("user_id", orgOwnerId)
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
      const ownerIds = [...new Set((initData ?? []).map((i: any) => i.user_id).filter(Boolean))];
      const { data: ownerOrgs } = ownerIds.length > 0 ? await supabase
        .from("organizations").select("user_id, organisation_name").in("user_id", ownerIds) : { data: [] };
      const ownerNameMap = new Map((ownerOrgs ?? []).map((o: any) => [o.user_id, o.organisation_name]));
      setOutboundEOIs(sentEois.map((e: any) => ({
        eoi_id:                e.id,
        conversation_id:       e.conversation_id,
        initiative_id:         e.initiative_id,
        initiative_title:      initTitleMap.get(e.initiative_id) ?? "Initiative",
        partnership_type:      e.partnership_type,
        message:               e.message,
        created_at:            e.created_at,
        conversation_status:   e.conversation_id ? (sentConvoStatusMap.get(e.conversation_id) ?? null) : null,
        initiative_owner_id:   initOwnerMap.get(e.initiative_id) ?? null,
        initiative_owner_name: ownerNameMap.get(initOwnerMap.get(e.initiative_id)) ?? "Recipient",
      })));
    } else {
      setOutboundEOIs([]);
    }
  }

  async function loadConversationsList(): Promise<Conversation[]> {
    if (!user) return [];
    const { data: myConvos } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", user.id);
    const myConvoIds = (myConvos ?? []).map((c: any) => c.conversation_id);
    if (myConvoIds.length === 0) {
      setConversations([]);
      return [];
    }
    const { data: convoData } = await supabase
    .from("conversations")
    .select("id, initiative_id, status, initiative_owner_id, conversation_type, funder_closed_at")
    .in("id", myConvoIds)
    .in("status", ["open", "rejected", "pending_acceptance", "confirmed"])
    .or("initiative_id.not.is.null,conversation_type.eq.partnership");
    if (!convoData || convoData.length === 0) {
      setConversations([]);
      return [];
    }
    const initIds = [...new Set(convoData.map((c: any) => c.initiative_id).filter(Boolean))];
    const { data: inits } = initIds.length > 0 ? await supabase
      .from("initiative_requests").select("id, title").in("id", initIds) : { data: [] };
    const initTitleMap = new Map((inits ?? []).map((i: any) => [i.id, i.title]));
    const { data: allParticipants } = await supabase
      .rpc("get_conversation_participants", { p_conversation_ids: convoData.map((c: any) => c.id) });
    const otherUserIds = [...new Set(
      (allParticipants ?? []).filter((p: any) => p.user_id !== user.id).map((p: any) => p.user_id)
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
    const partnershipOwnerIds = convoData
      .filter((c: any) => c.conversation_type === "partnership" && c.initiative_owner_id)
      .map((c: any) => c.initiative_owner_id);
    const partnershipTitleMap = new Map<string, string>();
    if (partnershipOwnerIds.length > 0) {
      const { data: partnerOrgs } = await supabase
        .from("organizations")
        .select("user_id, partnership_title")
        .in("user_id", [...new Set(partnershipOwnerIds)]);
      (partnerOrgs ?? []).forEach((o: any) => {
        if (o.partnership_title) partnershipTitleMap.set(o.user_id, o.partnership_title);
      });
    }
    const convos = convoData.map((c: any) => {
      const otherId = participantMap.get(c.id) ?? "";
      const lastMsg = lastMsgMap.get(c.id);
      return {
        id:                  c.id,
        initiative_id:       c.initiative_id,
        initiative_title:    initTitleMap.get(c.initiative_id) ?? (c.conversation_type === "partnership" ? (partnershipTitleMap.get(c.initiative_owner_id) ?? "Partnership conversation") : "Initiative"),
        initiative_owner_id: c.initiative_owner_id ?? null,
        other_user_id:       otherId,
        other_user_name:     otherProfileMap.get(otherId) ?? "Unknown",
        last_message:        lastMsg?.body ?? "",
        last_message_at:     lastMsg?.created_at ?? c.created_at ?? "",
        unread:              lastMsg && lastMsg.sender_id !== user.id && !lastMsg.read_at,
        status:              c.status ?? "pending_acceptance",
        conversation_type:   c.conversation_type ?? "eoi",
        funder_closed_at:    c.funder_closed_at ?? null,
      };
    });
    const baseConvos: Conversation[] = convos.map(c => ({
      ...c,
      partnerStatus: (c.status === "rejected" || c.status === "closed") ? "closed" : c.status === "pending_acceptance" ? "pending" : "active",
    } as Conversation));
    baseConvos.sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
    setConversations(baseConvos);
    const uniqueInitIds = [...new Set(baseConvos.map(c => c.initiative_id).filter(Boolean))];
    if (uniqueInitIds.length > 0) {
      supabase.from("initiative_requests").select("id, confirmed_partners").in("id", uniqueInitIds)
          .then(({ data: confirmedData }) => {
            const confirmedMap = new Map((confirmedData ?? []).map((i: any) => [i.id, i.confirmed_partners ?? []]));
            setConversations(prev => prev.map(c => {
              const partners = confirmedMap.get(c.initiative_id) ?? [];
              // A row existing in confirmed_partners is no longer enough --
              // since the propose/confirm/decline flow, an entry is written
              // the moment a proposal is sent, with status "pending". Only
              // a real "confirmed" status means an actual confirmed partner.
              const isConfirmed = partners.some((p: any) =>
                (p.user_id === c.other_user_id || p.user_id === user!.id) && (p.status ?? "confirmed") === "confirmed"
              );
              return isConfirmed ? { ...c, partnerStatus: "confirmed" } : c;
            }));
          });
    }
    return baseConvos;
  }

  // The three loads above are fully independent of each other -- running
  // them sequentially meant the conversation list (the one thing a
  // deep-linked notification actually needs) sat waiting behind two
  // unrelated EOI queries before it could even start. Concurrent now.
  async function loadAll(showLoader = true): Promise<Conversation[]> {
    if (!user) return [];
    if (showLoader) setLoading(true);
    const [, , conversationsResult] = await Promise.all([
      loadPendingEOIs(),
      loadOutboundEOIs(),
      loadConversationsList(),
    ]);
    setLoading(false);
    return conversationsResult;
  }

  // Opens the conversation. This is not a partnership decision, just
  // moving from "someone wants to talk" to "we're talking" -- no
  // notification fires here. The real, meaningful notifications happen
  // later, at Propose Partner and at Confirm/Decline.
  async function acceptEOI(eoi: PendingEOI) {
    await supabase.from("conversations").update({ status: "open", opened_at: new Date().toISOString() }).eq("id", eoi.conversation_id);
    setPendingEOIs(prev => prev.filter(e => e.eoi_id !== eoi.eoi_id));
    setActiveTab("initiative");
    setActiveConvo({
      id:                  eoi.conversation_id,
      initiative_id:       eoi.initiative_id,
      initiative_title:    eoi.initiative_title,
      initiative_owner_id: user!.id,
      other_user_id:       eoi.expresser_id,
      other_user_name:     eoi.expresser_name,
      last_message:        eoi.message ?? "",
      last_message_at:     eoi.created_at,
      unread:              false,
      status:              "open",
      partnerStatus:       "active",
      conversation_type:   "eoi",
      funder_closed_at:    null,
    });
    loadAll(false);
  }

  async function declineEOI(eoi: PendingEOI) {
    await supabase.from("conversations").update({ status: "declined" }).eq("id", eoi.conversation_id);
    await supabase.rpc("send_conversation_notification", {
      p_conversation_id: eoi.conversation_id,
      p_target_user_id: eoi.expresser_id,
      p_type: "eoi_declined",
      p_title: "Expression of interest not accepted",
      p_body: `Your interest in "${eoi.initiative_title}" was not taken forward.`,
      p_link: "/dashboard/portfolio?tab=expressed",
    });
    setPendingEOIs(prev => prev.filter(e => e.eoi_id !== eoi.eoi_id));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-5 h-5 text-[#2D6A4F] animate-spin" />
      </div>
    );
  }

  const pendingOutbound = outboundEOIs.filter(
    e => !["open", "rejected", "closed", "declined"].includes(e.conversation_status ?? "")
  );

  if (activeConvo) {
    return (
      <ChatThread
        conversation={activeConvo}
        currentUserId={user!.id}
        orgOwnerId={orgOwnerId}
        onBack={() => { setActiveConvo(null); loadAll(); }}
        onUpdate={(id, changes) => {
          setConversations(prev => prev.map(c => {
            if (c.id !== id) return c;
            const updated = { ...c, ...changes };
            if (changes.status) {
              updated.partnerStatus = (updated.status === "rejected" || updated.status === "closed") ? "closed"
                : updated.status === "pending_acceptance" ? "pending"
                : updated.status === "confirmed" ? "confirmed"
                : "active";
            }
            return updated;
          }));
          setActiveConvo(prev => prev?.id === id ? { ...prev, ...changes } : prev);        }}
        isFunder={["philanthropic_foundation", "venture_capital"].includes(profile?.org_type ?? "")}
      />
    );
  }

  const partnershipVisible = conversations.filter(c => c.conversation_type === "partnership" && (isFunder ? !c.funder_closed_at : true));
  const partnershipArchived = conversations.filter(c => c.conversation_type === "partnership" && !!c.funder_closed_at);
  const initiativeActive = conversations.filter(c => c.conversation_type !== "question" && c.conversation_type !== "partnership" && (isFunder ? !c.funder_closed_at : true));
  const initiativeEnquiries = conversations.filter(c => c.conversation_type === "question" && !c.funder_closed_at);
  const initiativeArchived = conversations.filter(c => c.conversation_type !== "partnership" && !!c.funder_closed_at);
  const partnershipCount = partnershipVisible.length;
  const initiativeCount = pendingEOIs.length + initiativeEnquiries.length + initiativeActive.length + pendingOutbound.length;
  const hasAnything = pendingEOIs.length > 0 || conversations.length > 0 || pendingOutbound.length > 0;

  const STATUS_STYLES: Record<string, { label: string; bg: string; color: string }> = {
    confirmed: { label: "Confirmed", bg: "rgba(45,106,79,0.12)", color: "#2D6A4F" },
    closed:    { label: "Closed",    bg: "rgba(239,68,68,0.12)", color: "#ef4444" },
    active:    { label: "Active",    bg: "rgba(180,83,9,0.12)", color: "#b45309" },
    pending:   { label: "Pending",   bg: "rgba(107,114,128,0.12)", color: "#6b7280" },
    accepted:  { label: "Accepted",  bg: "rgba(45,106,79,0.12)", color: "#2D6A4F" },
    declined:  { label: "Declined",  bg: "rgba(239,68,68,0.12)", color: "#ef4444" },
  };

  // Flat divider row (no card border). Color lives in the avatar fill and
  // the status pill, not in any border. Message preview restored — that
  // was a real feature, not incidental. No timestamp — status only.
  function Row({ onClick, avatarLabel, avatarColor, title, subtitle, preview, statusKey, last }: {
    onClick?: () => void; avatarLabel: string; avatarColor: string; title: string;
    subtitle?: React.ReactNode; preview?: string; statusKey?: string; last?: boolean;
  }) {
    const Tag = onClick ? "button" : "div";
    const status = statusKey ? STATUS_STYLES[statusKey] : null;
    return (
      <Tag type={onClick ? "button" : undefined} onClick={onClick}
        className={`w-full text-left flex items-start gap-3 px-4 py-3 min-w-0 ${!last ? "border-b border-border" : ""} ${onClick ? "hover:bg-muted/40 transition-colors" : ""}`}>
        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-white text-xs font-semibold" style={{ background: avatarColor }}>
          {avatarLabel}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-black dark:text-white truncate">{title}</p>
          {subtitle && <p className="text-xs text-black dark:text-white mt-0.5 truncate">{subtitle}</p>}
          {preview && <p className="text-xs text-black dark:text-white mt-1 line-clamp-1">{preview}</p>}
        </div>
        {status && (
          <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 mt-0.5"
            style={{ background: status.bg, color: status.color }}>
            {status.label}
          </span>
        )}
      </Tag>
    );
  }

  const PARTNERSHIP_COLOR = "#C45C26";
  const INITIATIVE_COLOR = "#2D6A4F";
  const ENQUIRY_COLOR = "#185FA5";

  return (
    <div className="space-y-6 min-w-0 overflow-hidden">
      {!hasAnything ? (
        <div className="rounded-2xl border border-border bg-white dark:bg-card p-12 text-center">
          <Clock className="w-8 h-8 text-muted-foreground/40 mx-auto mb-4" />
          <p className="text-black dark:text-white font-medium mb-2">No messages yet.</p>
          <p className="text-sm text-black dark:text-white mb-6 max-w-sm mx-auto">
            When you or others express interest in initiatives and partnerships, conversations will appear here.
          </p>
          <Link href="/dashboard/marketplace">
            <Button className="bg-[#2D6A4F] hover:bg-[#245c43] text-white rounded-full px-5">
              Browse Marketplace
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Tab switcher — Partnership first. Active tab takes its own
              brand color rather than a flat neutral fill. */}
          <div className="flex gap-2">
            <button type="button" onClick={() => setActiveTab("partnership")}
              className={`flex-1 h-11 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-colors text-white ${
                activeTab === "partnership" ? "" : "!bg-muted !text-foreground hover:!bg-muted/70"
              }`}
              style={activeTab === "partnership" ? { background: PARTNERSHIP_COLOR } : undefined}>
              <Handshake className="w-4 h-4" />
              Partnership conversations
              {partnershipCount > 0 && (
                <span className={`text-[10px] font-semibold rounded-full px-1.5 py-0.5 ${activeTab === "partnership" ? "bg-white/25 text-white" : "bg-foreground/10 text-foreground"}`}>
                  {partnershipCount}
                </span>
              )}
            </button>
            <button type="button" onClick={() => setActiveTab("initiative")}
              className={`flex-1 h-11 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-colors text-white ${
                activeTab === "initiative" ? "" : "!bg-muted !text-foreground hover:!bg-muted/70"
              }`}
              style={activeTab === "initiative" ? { background: INITIATIVE_COLOR } : undefined}>
              <Lightbulb className="w-4 h-4" />
              Initiative conversations
              {initiativeCount > 0 && (
                <span className={`text-[10px] font-semibold rounded-full px-1.5 py-0.5 ${activeTab === "initiative" ? "bg-white/25 text-white" : "bg-foreground/10 text-foreground"}`}>
                  {initiativeCount}
                </span>
              )}
            </button>
          </div>

          {/* ── PARTNERSHIP TAB ── */}
          {activeTab === "partnership" && (
            <div className="space-y-6">
              {partnershipVisible.length > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-semibold uppercase tracking-widest text-black dark:text-white">Conversations — {partnershipVisible.length}</h3>
                    <Link href="/dashboard/portfolio?tab=partners"
                      className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-black dark:text-white hover:underline underline-offset-2">
                      Confirmed partnerships
                      <ExternalLink className="w-2.5 h-2.5" />
                    </Link>
                  </div>
                  <div className="rounded-2xl border border-border bg-white dark:bg-card overflow-hidden">
                    {partnershipVisible.map((convo, i) => (
                      <Row key={convo.id} last={i === partnershipVisible.length - 1}
                        onClick={() => setActiveConvo(convo)}
                        avatarColor={PARTNERSHIP_COLOR}
                        avatarLabel={((convo.other_user_name ?? "?")[0]).toUpperCase()}
                        title={convo.other_user_name ?? "Unknown"}
                        subtitle={convo.initiative_title}
                        preview={convo.last_message}
                        statusKey={convo.partnerStatus} />
                    ))}
                  </div>
                </section>
              )}
              {partnershipArchived.length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-black dark:text-white mb-2">Archived — {partnershipArchived.length}</h3>
                  <div className="rounded-2xl border border-border bg-white dark:bg-card overflow-hidden opacity-60">
                    {partnershipArchived.map((convo, i) => (
                      <Row key={convo.id} last={i === partnershipArchived.length - 1}
                        onClick={() => setActiveConvo(convo)}
                        avatarColor={PARTNERSHIP_COLOR}
                        avatarLabel={((convo.other_user_name ?? "?")[0]).toUpperCase()}
                        title={convo.other_user_name ?? "Unknown"}
                        subtitle={convo.initiative_title} />
                    ))}
                  </div>
                </section>
              )}
              {partnershipVisible.length === 0 && partnershipArchived.length === 0 && (
                <div className="rounded-2xl border border-border bg-white dark:bg-card p-10 text-center">
                  <Handshake className="w-6 h-6 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-sm text-black dark:text-white">No partnership conversations yet.</p>
                </div>
              )}
            </div>
          )}

          {/* ── INITIATIVE TAB ── */}
          {activeTab === "initiative" && (
            <div className="space-y-6">
              {pendingEOIs.length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-black dark:text-white mb-2">
                    Awaiting review — {pendingEOIs.length}
                  </h3>
                  <div className="space-y-2">
                    {pendingEOIs.map(eoi => (
                      <div key={eoi.eoi_id}
                        className="rounded-xl border border-border bg-white dark:bg-card px-5 py-4 flex items-start gap-4">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: "rgba(45,106,79,0.12)" }}>
                          <CheckCircle2 className="w-4 h-4" style={{ color: INITIATIVE_COLOR }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-0.5 flex-wrap">
                            <div className="flex items-center gap-2 min-w-0 flex-wrap">
                              <p className="text-sm font-medium text-black dark:text-white">
                                {eoi.expresser_name} expressed {eoi.partnership_type ? rolePartnerPhrase(eoi.partnership_type) : ""} interest
                              </p>
                              {eoi.expresser_verified && (
                                <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-medium text-black dark:text-white">
                                  <ShieldCheck className="w-3 h-3" />
                                  Verified
                                </span>
                              )}
                              {eoi.expresser_id && (
                                <Link href={`/dashboard/natives?user=${eoi.expresser_id}&tab=organisations`}
                                  className="text-[10px] text-black dark:text-white hover:text-[#2D6A4F] transition-colors shrink-0 underline underline-offset-2">
                                  View profile
                                </Link>
                              )}
                            </div>
                            <span className="text-[11px] text-black dark:text-white shrink-0">{timeAgo(eoi.created_at)}</span>
                          </div>
                          <p className="text-xs text-black dark:text-white mb-1">
                            <span className="text-foreground/70">{eoi.initiative_title}</span>
                          </p>
                          {eoi.esg_adoption && (
                            <div className="flex items-center gap-1.5 flex-wrap mt-1 text-xs text-black dark:text-white">
                              <span>ESG/CSR adoption</span>
                            </div>
                          )}
                          {eoi.message && (
                            <p className="text-xs text-black dark:text-white mt-2 leading-relaxed break-words">
                              {eoi.message}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col gap-2 shrink-0">
                          <button type="button" onClick={() => acceptEOI(eoi)}
                            className="px-3 py-1.5 rounded-full text-xs bg-[#2D6A4F] hover:bg-[#245c43] text-white transition-colors font-medium">
                            Open conversation
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

              {initiativeEnquiries.length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-black dark:text-white mb-2">Enquiries — {initiativeEnquiries.length}</h3>
                  <div className="rounded-2xl border border-border bg-white dark:bg-card overflow-hidden">
                    {initiativeEnquiries.map((convo, i) => (
                      <Row key={convo.id} last={i === initiativeEnquiries.length - 1}
                        onClick={() => setActiveConvo(convo)}
                        avatarColor={ENQUIRY_COLOR}
                        avatarLabel="?"
                        title={convo.initiative_title}
                        subtitle={convo.other_user_name}
                        preview={convo.last_message} />
                    ))}
                  </div>
                </section>
              )}

              {initiativeActive.length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-black dark:text-white mb-2">Conversations — {initiativeActive.length}</h3>
                  <div className="rounded-2xl border border-border bg-white dark:bg-card overflow-hidden">
                    {initiativeActive.map((convo, i) => (
                      <Row key={convo.id} last={i === initiativeActive.length - 1}
                        onClick={() => setActiveConvo(convo)}
                        avatarColor={INITIATIVE_COLOR}
                        avatarLabel={((convo.other_user_name ?? "?")[0]).toUpperCase()}
                        title={convo.other_user_name ?? "Unknown"}
                        subtitle={`Re: ${convo.initiative_title}`}
                        preview={convo.last_message}
                        statusKey={convo.partnerStatus} />
                    ))}
                  </div>
                </section>
              )}

              {pendingOutbound.length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-black dark:text-white mb-2">Sent ({pendingOutbound.length})</h3>
                  <div className="rounded-2xl border border-border bg-white dark:bg-card overflow-hidden">
                    {pendingOutbound.map((eoi, i) => (
                      <Row key={eoi.eoi_id} last={i === pendingOutbound.length - 1}
                        avatarColor={INITIATIVE_COLOR}
                        avatarLabel={((eoi.initiative_owner_name ?? "?")[0]).toUpperCase()}
                        title={eoi.initiative_title}
                        subtitle={eoi.partnership_type ? (
                          <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full"
                            style={{ background: "rgba(196,92,38,0.12)", color: "#C45C26" }}>
                            {rolePartnerPhrase(eoi.partnership_type)}
                          </span>
                        ) : undefined}
                        preview={eoi.message ?? undefined}
                        statusKey={
                          eoi.conversation_status === "confirmed" ? "confirmed"
                          : eoi.conversation_status === "open" ? "accepted"
                          : (eoi.conversation_status === "declined" || eoi.conversation_status === "rejected") ? "declined"
                          : "pending"
                        } />
                    ))}
                  </div>
                </section>
              )}

              {isFunder && initiativeArchived.length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-black dark:text-white mb-2">Archived — {initiativeArchived.length}</h3>
                  <div className="rounded-2xl border border-border bg-white dark:bg-card overflow-hidden opacity-60">
                    {initiativeArchived.map((convo, i) => (
                      <Row key={convo.id} last={i === initiativeArchived.length - 1}
                        onClick={() => setActiveConvo(convo)}
                        avatarColor={INITIATIVE_COLOR}
                        avatarLabel={((convo.other_user_name ?? "?")[0]).toUpperCase()}
                        title={convo.other_user_name ?? "Unknown"}
                        subtitle={`Re: ${convo.initiative_title}`} />
                    ))}
                  </div>
                </section>
              )}

              {pendingEOIs.length === 0 && initiativeEnquiries.length === 0 && initiativeActive.length === 0 && pendingOutbound.length === 0 && (
                <div className="rounded-2xl border border-border bg-white dark:bg-card p-10 text-center">
                  <Lightbulb className="w-6 h-6 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-sm text-black dark:text-white">No initiative conversations yet.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PartnershipConfirmButton({ conversation, currentUserId, partnershipResolved }: {
  conversation: Conversation;
  currentUserId: string;
  partnershipResolved: "confirmed" | "declined" | null;
}) {
  const [open, setOpen]             = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [partnershipType, setType]  = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]             = useState<"accepted" | "rejected" | "pending_confirmation" | null>(null);

  useEffect(() => {
    if (partnershipResolved === "confirmed") setDone("accepted");
    if (partnershipResolved === "declined") setDone("rejected");
  }, [partnershipResolved]);

  useEffect(() => {
    // Check current connection status on mount. other_user_id defaults to
    // "" (not null) when the participant lookup in DashboardMessages hasn't
    // resolved yet -- querying with an empty string sends a malformed UUID
    // filter to Postgres and 400s (22P02), so skip until it's a real id.
    if (conversation.other_user_id) {
      supabase.from("partnership_connections")
        .select("status, partnership_type")
        .eq("sender_user_id", conversation.other_user_id)
        .eq("conversation_id", conversation.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.status === "pending_confirmation") setDone("pending_confirmation");
          if (data?.status === "formed") setDone("accepted");
          if (data?.status === "declined") setDone("rejected");
        });
    }
    // Also check conversation status directly
    supabase.from("conversations")
      .select("status")
      .eq("id", conversation.id)
      .single()
      .then(({ data }) => {
        if (data?.status === "rejected") setDone("rejected");
      });
  }, [conversation.id, conversation.other_user_id]);

  const PARTNERSHIP_TYPES = [
    "Co-funder", "Implementing partner", "Research partner",
    "Technical advisor", "CSR partner", "Strategic partner", "Other",
  ];

  async function sendConfirmationRequest() {
    if (!partnershipType || submitting) return;
    setSubmitting(true);

    // Update connection with proposed partnership type + pending confirmation status
    const { data: conn } = await supabase
      .from("partnership_connections")
      .select("id")
      .in("status", ["pending", "accepted"])
      .eq("sender_user_id", conversation.other_user_id)
      .eq("conversation_id", conversation.id)
      .maybeSingle();

    if (conn) {
      await supabase.from("partnership_connections")
        .update({ partnership_type: partnershipType, status: "pending_confirmation" })
        .eq("id", conn.id);
    }

    // Send confirmation prompt to the other party
    await supabase.rpc("send_conversation_notification", {
      p_conversation_id: conversation.id,
      p_target_user_id: conversation.other_user_id,
      p_type: "partnership_confirmation_requested",
      p_title: "Partnership confirmation requested",
      p_body: `${conversation.initiative_title}: you've been proposed as ${partnershipType}. Go to Messages to confirm or decline.`,
      p_link: `/dashboard/messages?conversation=${conversation.id}`,
    });

    // Message removed — confirmation handled by real-time popup

    setDone("pending_confirmation");
    setSubmitting(false);
    setOpen(false);
  }

  async function rejectPartnership() {
    if (submitting) return;
    setSubmitting(true);
    await supabase.from("conversations")
      .update({ status: "rejected" })
      .eq("id", conversation.id);
    await supabase.from("partnership_connections")
      .update({ status: "declined", updated_at: new Date().toISOString(), declined_at: new Date().toISOString() })
      .eq("conversation_id", conversation.id);
    await supabase.rpc("send_conversation_notification", {
      p_conversation_id: conversation.id,
      p_target_user_id: conversation.other_user_id,
      p_type: "partnership_rejected",
      p_title: "Partnership interest not taken forward",
      p_body: `Your partnership interest was not taken forward.`,
      p_link: "/dashboard/messages",
    });
    setDone("rejected");
    setSubmitting(false);
    setRejectOpen(false);
  }

  if (done === "pending_confirmation") {
    return (
      <span className="text-xs px-3 py-1.5 rounded-full font-medium shrink-0"
        style={{ background: "rgba(180,83,9,0.12)", color: "#b45309" }}>
        Awaiting their confirmation
      </span>
    );
  }

  if (done === "accepted") {
    return (
      <span className="text-xs px-3 py-1.5 rounded-full font-medium shrink-0"
        style={{ background: "rgba(45,106,79,0.12)", color: "#2D6A4F" }}>
        ✓ Partnership intent confirmed
      </span>
    );
  }

  if (done === "rejected") {
    return (
      <span className="text-xs px-3 py-1.5 rounded-full font-medium shrink-0"
        style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444" }}>
        Partnership declined
      </span>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2 shrink-0">
        <button type="button" onClick={() => setOpen(true)}
          className="text-xs px-3 py-1.5 rounded-full border border-[#2D6A4F] text-[#2D6A4F] hover:bg-[rgba(45,106,79,0.12)] transition-colors font-medium flex items-center gap-1.5">
          <UserCheck className="w-3.5 h-3.5" />
          Accept Partnership
        </button>
        <button type="button" onClick={() => setRejectOpen(true)}
          className="text-xs px-3 py-1.5 rounded-full border border-red-400/40 text-red-500 hover:bg-red-50 transition-colors font-medium">
          Reject
        </button>
      </div>

      {/* Accept modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-background rounded-2xl border border-border w-full max-w-sm shadow-xl p-6 space-y-4">
            <h3 className="text-base font-semibold text-foreground">Accept Partnership</h3>
            <p className="text-sm text-black dark:text-white">
              Select the role for <span className="font-medium text-foreground">{conversation.other_user_name}</span>.
              They'll be asked to confirm.
            </p>
            <div className="flex flex-wrap gap-2">
              {PARTNERSHIP_TYPES.map(t => (
                <button key={t} type="button" onClick={() => setType(t)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    partnershipType === t
                      ? "bg-[#2D6A4F] text-white border-[#2D6A4F]"
                      : "border-border text-muted-foreground hover:border-[#2D6A4F]"
                  }`}>
                  {t}
                </button>
              ))}
            </div>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => { setOpen(false); setType(""); }}
                className="flex-1 h-9 rounded-full border border-border text-sm text-muted-foreground hover:text-foreground transition-colors">
                Cancel
              </button>
              <button type="button" onClick={sendConfirmationRequest}
                disabled={!partnershipType || submitting}
                className="flex-1 h-9 rounded-full bg-[#2D6A4F] hover:bg-[#245c43] text-white text-sm font-medium disabled:opacity-40 transition-colors">
                {submitting ? "Sending..." : "Send for confirmation"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject modal */}
      {rejectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-background rounded-2xl border border-border w-full max-w-sm shadow-xl p-6 space-y-4">
            <h3 className="text-base font-semibold text-foreground">Reject Partnership</h3>
            <p className="text-sm text-black dark:text-white">
              This will notify {conversation.other_user_name} that you're not taking the partnership forward, and close this conversation.
            </p>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setRejectOpen(false)}
                className="flex-1 h-9 rounded-full border border-border text-sm text-muted-foreground hover:text-foreground transition-colors">
                Cancel
              </button>
              <button type="button" onClick={rejectPartnership} disabled={submitting}
                className="flex-1 h-9 rounded-full bg-red-500 hover:bg-red-600 text-white text-sm font-medium disabled:opacity-40 transition-colors">
                {submitting ? "Rejecting..." : "Confirm rejection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Chat Thread ──────────────────────────────────────────────────────────────

function ChatThread({ conversation, currentUserId, orgOwnerId, onBack, onUpdate, isFunder }: {
  conversation: Conversation;
  currentUserId: string;
  orgOwnerId: string | null | undefined;
  onBack: () => void;
  onUpdate?: (id: string, changes: Partial<Conversation>) => void;
  isFunder?: boolean;
}) {
  const [messages, setMessages]         = useState<Message[]>([]);
  const [loading, setLoading]           = useState(true);
  const [body, setBody]                 = useState("");
  const [sending, setSending]           = useState(false);
  const [confirmOpen, setConfirmOpen]   = useState(false);
  const [confirmRole, setConfirmRole]   = useState("");
  const [confirming, setConfirming]     = useState(false);
  const [publicOnFeed, setPublicOnFeed] = useState(false);
  const [confirmedRole, setConfirmedRole] = useState<string | null>(null);
  const [proposedRole, setProposedRole]   = useState<string | null>(null);
  const [declinedRole, setDeclinedRole]   = useState<string | null>(null);
  const [respondingToProposal, setRespondingToProposal] = useState(false);
  const [rejecting, setRejecting]       = useState(false);
  const [otherUserType, setOtherUserType] = useState<string | null>(null);
  const [isRejected, setIsRejected]     = useState(conversation.status === "rejected");
  const bottomRef                       = useRef<HTMLDivElement>(null);
  const textareaRef                     = useRef<HTMLTextAreaElement>(null);

  // conversation.initiative_owner_id is set from the initiative's own
  // user_id at creation time (create_conversation RPC), which is
  // orgOwnerId, not the real person who happens to be viewing this thread
  // -- compare against orgOwnerId, not currentUserId, or a Member never
  // reads as the owner of their own org's initiative conversations.
  const isOwner = !!orgOwnerId && conversation.initiative_owner_id === orgOwnerId;
  const [convStatus, setConvStatus] = useState(conversation.status);
  const [funderClosed, setFunderClosed] = useState(!!conversation.funder_closed_at);

  // Listen for funder_closed_at changes in real-time
  useEffect(() => {
    let channel = supabase
      .channel(`convo-status-${conversation.id}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "conversations",
        filter: `id=eq.${conversation.id}`,
      }, payload => {
        const updated = payload.new as any;
        setFunderClosed(!!updated.funder_closed_at);
        if (updated.status === "rejected") setIsRejected(true);
        if (updated.status === "confirmed") setConvStatus("confirmed");
        if (updated.status === "open") {
          setConvStatus("open");
          onUpdate?.(conversation.id, { status: "open" });
        }
      })
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "partnership_connections",
        filter: `sender_user_id=eq.${currentUserId}`,
      }, payload => {
        const updated = payload.new as any;
        if (updated.conversation_id !== conversation.id) return;
        if (updated.status === "pending_confirmation" && updated.sender_user_id === currentUserId) {
          setPendingConfirmation({ id: updated.id, partnership_type: updated.partnership_type });
        }
        if (updated.status === "formed" || updated.status === "declined") {
          setPendingConfirmation(null);
          setPartnershipResolved(updated.status === "formed" ? "confirmed" : "declined");
        }
      });
    // Only meaningful for initiative-based conversations. A null
    // initiative_id would build an invalid filter string, so this is
    // skipped for org-to-org partnership conversations.
    if (conversation.initiative_id) {
      channel = channel.on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "initiative_requests",
        filter: `id=eq.${conversation.initiative_id}`,
      }, payload => {
        const updated = payload.new as any;
        const partners = (updated.confirmed_partners as any[]) ?? [];
        const match = partners.find(p => p.user_id === conversation.other_user_id || p.user_id === currentUserId);
        const status = match?.status ?? (match ? "confirmed" : null);
        if (status === "confirmed") { setConfirmedRole(match.role); setProposedRole(null); setDeclinedRole(null); }
        if (status === "declined")  { setDeclinedRole(match.role); setProposedRole(null); }
        if (status === "pending")   { setProposedRole(match.role); }
      });
    }
    channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversation.id]);

  async function closeConversation() {
    const now = new Date().toISOString();
    await supabase.from("conversations")
      .update({ funder_closed_at: now })
      .eq("id", conversation.id);
    setFunderClosed(true);
    onUpdate?.(conversation.id, { funder_closed_at: now });
  }

  async function reopenConversation() {
    if (conversation.conversation_type === "partnership") {
      await supabase.from("conversations")
        .update({ status: "open" })
        .eq("id", conversation.id);
      setIsRejected(false);
      setConvStatus("open");
      setPartnershipResolved(null);
      onUpdate?.(conversation.id, { status: "open" });
    } else {
      await supabase.from("conversations")
        .update({ funder_closed_at: null })
        .eq("id", conversation.id);
      setFunderClosed(false);
      onUpdate?.(conversation.id, { funder_closed_at: null });
    }
  }

  useEffect(() => {
    loadMessages();
    checkIfConfirmed();

    const channel = supabase
      .channel(`chat-thread-${conversation.id}-${Date.now()}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, payload => {
        if ((payload.new as any).conversation_id !== conversation.id) return;
        const msg = payload.new as any;
        if (msg.sender_id === currentUserId) {
          setMessages(prev => prev.map(m =>
            m.id.startsWith("optimistic-") && m.body === msg.body
              ? { ...m, id: msg.id, created_at: msg.created_at }
              : m
          ));
          return;
        }
        setMessages(prev => [...prev, {
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
    if (!conversation.initiative_id) return;
    const { data } = await supabase
      .from("initiative_requests").select("confirmed_partners")
      .eq("id", conversation.initiative_id).single();
    if (data?.confirmed_partners) {
      const partners = data.confirmed_partners as any[];
      const match = partners.find(p => p.user_id === conversation.other_user_id || p.user_id === currentUserId);
      const status = match?.status ?? (match ? "confirmed" : null);
      if (status === "confirmed") setConfirmedRole(match.role);
      if (status === "pending")   setProposedRole(match.role);
      if (status === "declined")  setDeclinedRole(match.role);
    }
  }

  async function loadMessages() {
    setLoading(true);
    const { data } = await supabase
      .from("messages").select("id, sender_id, body, created_at, read_at")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true });

    const { data: participants } = await supabase
      .rpc("get_conversation_participants", { p_conversation_ids: [conversation.id] });

    const otherIds = (participants ?? []).map((p: any) => p.user_id).filter((id: string) => id !== currentUserId);
    const { data: profiles } = await supabase
      .from("profiles").select("id, full_name, user_type").in("id", otherIds);
    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p.full_name]));
    const otherProfile = (profiles ?? []).find((p: any) => p.id === conversation.other_user_id);
    if (otherProfile) setOtherUserType((otherProfile as any).user_type ?? null);

    setMessages((data ?? []).map((m: any) => ({
      id:          m.id,
      sender_id:   m.sender_id,
      sender_name: m.sender_id === currentUserId ? "You" : (profileMap.get(m.sender_id) ?? "Them"),
      body:        m.body,
      created_at:  m.created_at,
      read_at:     m.read_at,
    })));

    const unreadIds = (data ?? []).filter((m: any) => m.sender_id !== currentUserId && !m.read_at).map((m: any) => m.id);
    if (unreadIds.length > 0) {
      await supabase.from("messages").update({ read_at: new Date().toISOString() }).in("id", unreadIds);
    }
    setLoading(false);
  }

  async function sendMessage() {
    if (funderClosed) return;
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
    setMessages(prev => [...prev, optimistic]);

    await supabase.from("messages").insert({
      conversation_id: conversation.id,
      sender_id:       currentUserId,
      body:            text,
    });
    setSending(false);
  }

  // Proposes a role. The other party must actively confirm or decline
  // below before this counts anywhere as a real partnership (Portfolio,
  // Natives reputation, initiative detail). Mirrors the org-to-org
  // partnership flow, which already works this way.
  async function proposePartner() {
    if (!confirmRole || confirming || !conversation.initiative_id) return;
    setConfirming(true);
    const { data: myProfile } = await supabase
      .from("profiles").select("user_type, org_name, full_name").eq("id", currentUserId).single();
    const myDisplayName = myProfile?.user_type === "organisation" && myProfile?.org_name
      ? myProfile.org_name : myProfile?.full_name ?? "Someone";
    const { data: otherProfile } = await supabase
      .from("profiles").select("user_type, org_name, full_name").eq("id", conversation.other_user_id).single();
    const otherDisplayName = otherProfile?.user_type === "organisation" && otherProfile?.org_name
      ? otherProfile.org_name : otherProfile?.full_name ?? conversation.other_user_name;
    const { data: iniData } = await supabase
      .from("initiative_requests").select("confirmed_partners, title").eq("id", conversation.initiative_id).single();
    const existing = (iniData?.confirmed_partners as any[]) ?? [];
    const proposalEntry = {
      user_id:        conversation.other_user_id,
      name:           otherDisplayName,
      role:           confirmRole,
      profile_link:   `/dashboard/natives?user=${conversation.other_user_id}`,
      proposed_at:    new Date().toISOString(),
      confirmed_at:   null,
      public_on_feed: publicOnFeed,
      status:         "pending",
    };
    const alreadyThere = existing.find(p => p.user_id === conversation.other_user_id);
    const updatedList = alreadyThere
      ? existing.map(p => p.user_id === conversation.other_user_id ? proposalEntry : p)
      : [...existing, proposalEntry];
    await supabase.from("initiative_requests")
      .update({ confirmed_partners: updatedList }).eq("id", conversation.initiative_id);
    const initiativeTitle = iniData?.title ?? "your initiative";
    await supabase.rpc("send_conversation_notification", {
      p_conversation_id: conversation.id,
      p_target_user_id: conversation.other_user_id,
      p_type: "partner_proposed",
      p_title: "You've been proposed as a partner",
      p_body: `${myDisplayName} proposed you as ${rolePartnerPhrase(confirmRole)} on "${initiativeTitle}". Go to Messages to confirm or decline.`,
      p_link: `/dashboard/messages?conversation=${conversation.id}`,
    });
    setProposedRole(confirmRole);
    setConfirmOpen(false);
    setConfirming(false);
  }
  // Only this step writes a real confirmed partnership: both sides have
  // now actively agreed.
  async function confirmProposedPartner() {
    if (!conversation.initiative_id || respondingToProposal) return;
    setRespondingToProposal(true);
    // Direct table update won't work: update_initiatives RLS only allows
    // the initiative owner to write this row, and the confirming party is
    // the proposed partner, not the owner. This RPC runs as SECURITY
    // DEFINER and only ever touches the caller's own entry.
    const { data: updatedPartners, error } = await supabase.rpc("respond_to_partner_proposal", {
      p_initiative_id: conversation.initiative_id,
      p_status: "confirmed",
    });
    if (error) {
      console.error("Confirm partner proposal failed:", error.message);
      setRespondingToProposal(false);
      return;
    }
    const myEntry = (updatedPartners as any[] ?? []).find(p => p.user_id === currentUserId);
    const { data: iniData } = await supabase
      .from("initiative_requests").select("title").eq("id", conversation.initiative_id).single();
    await supabase.from("conversations").update({ status: "confirmed", confirmed_at: new Date().toISOString() }).eq("id", conversation.id);
    const initiativeTitle = iniData?.title ?? "your initiative";
    await supabase.rpc("send_conversation_notification", {
      p_conversation_id: conversation.id,
      p_target_user_id: conversation.other_user_id,
      p_type: "partner_confirmed",
      p_title: "Partnership confirmed",
      p_body: `${conversation.other_user_name} confirmed the partnership as ${rolePartnerPhrase(myEntry?.role ?? confirmRole)} on "${initiativeTitle}".`,
      p_link: "/dashboard/portfolio?tab=partners",
    });
    setConfirmedRole(myEntry?.role ?? confirmRole);
    setProposedRole(null);
    setConvStatus("confirmed");
    onUpdate?.(conversation.id, { status: "confirmed" });
    setRespondingToProposal(false);
  }
  async function declineProposedPartner() {
    if (!conversation.initiative_id || respondingToProposal) return;
    setRespondingToProposal(true);
    const { error } = await supabase.rpc("respond_to_partner_proposal", {
      p_initiative_id: conversation.initiative_id,
      p_status: "declined",
    });
    if (error) {
      console.error("Decline partner proposal failed:", error.message);
      setRespondingToProposal(false);
      return;
    }
    const { data: iniData } = await supabase
      .from("initiative_requests").select("title").eq("id", conversation.initiative_id).single();
    await supabase.from("conversations").update({ status: "rejected" }).eq("id", conversation.id);
    setIsRejected(true);
    const initiativeTitle = iniData?.title ?? "your initiative";
    await supabase.rpc("send_conversation_notification", {
      p_conversation_id: conversation.id,
      p_target_user_id: conversation.other_user_id,
      p_type: "partner_declined",
      p_title: "Partnership proposal declined",
      p_body: `${conversation.other_user_name} declined the partner proposal on "${initiativeTitle}".`,
      p_link: "/dashboard/messages",
    });
    setDeclinedRole("declined");
    setProposedRole(null);
    onUpdate?.(conversation.id, { status: "rejected" });
    setRespondingToProposal(false);
  }

  async function rejectConversation() {
    if (rejecting) return;
    setRejecting(true);
    await supabase.from("conversations").update({ status: "rejected" }).eq("id", conversation.id);
    await supabase.rpc("send_conversation_notification", {
      p_conversation_id: conversation.id,
      p_target_user_id: conversation.other_user_id,
      p_type: "conversation_closed",
      p_title: "Conversation closed",
      p_body: `The conversation about "${conversation.initiative_title}" has been closed.`,
      p_link: "/dashboard/messages",
    });
    setIsRejected(true);
    setRejecting(false);
  }

  const [initiativePartnerships, setInitiativePartnerships] = useState<string[]>([]);
  useEffect(() => {
    if (!conversation.initiative_id) return;
    supabase.from("initiative_requests").select("partnerships").eq("id", conversation.initiative_id).single()
      .then(({ data }) => { if (data?.partnerships) setInitiativePartnerships([...data.partnerships, "other"]); });
  }, [conversation.initiative_id]);

  const [pendingConfirmation, setPendingConfirmation] = useState<{ id: string; partnership_type: string } | null>(null);
  const [confirmingPartnership, setConfirmingPartnership] = useState(false);
  const [partnershipResolved, setPartnershipResolved] = useState<"confirmed" | "declined" | null>(null);
  const [myOrgId, setMyOrgId] = useState<string | null>(null);

  useEffect(() => {
    if (conversation.conversation_type !== "partnership") return;
    // Fetch own org ID for lister-side listener
    supabase.from("organizations").select("id").eq("user_id", orgOwnerId!).maybeSingle()
      .then(({ data }) => { if (data) setMyOrgId(data.id); });
    // Check existing pending confirmation for expresser
    supabase.from("partnership_connections")
      .select("id, partnership_type")
      .eq("status", "pending_confirmation")
      .eq("sender_user_id", currentUserId)
      .eq("conversation_id", conversation.id)
      .maybeSingle()
      .then(({ data }) => { if (data) setPendingConfirmation(data); });
    // Check if already resolved, sender side (expresser). Receiver side is
    // checked in a separate effect below, gated on myOrgId actually being
    // loaded -- doing it here raced the org-id fetch above and sent
    // PostgREST a filter string containing "receiver_org_id.eq.null",
    // which fails to cast and 400s on every partnership thread load.
    supabase.from("partnership_connections")
      .select("status")
      .eq("sender_user_id", currentUserId)
      .eq("conversation_id", conversation.id)
      .in("status", ["formed", "declined"])
      .maybeSingle()
      .then(({ data }) => {
        if (data?.status === "formed") setPartnershipResolved("confirmed");
        if (data?.status === "declined") setPartnershipResolved("declined");
      });
  }, [conversation.id, currentUserId]);

  // Receiver side (lister) resolution check -- only runs once myOrgId is
  // actually known, so it never sends a null org id to Postgres.
  useEffect(() => {
    if (conversation.conversation_type !== "partnership" || !myOrgId) return;
    supabase.from("partnership_connections")
      .select("status")
      .eq("receiver_org_id", myOrgId)
      .eq("conversation_id", conversation.id)
      .in("status", ["formed", "declined"])
      .maybeSingle()
      .then(({ data }) => {
        if (data?.status === "formed") setPartnershipResolved("confirmed");
        if (data?.status === "declined") setPartnershipResolved("declined");
      });
  }, [myOrgId, conversation.id]);

  // Lister-side real-time listener — fires when expresser confirms or declines
  useEffect(() => {
    if (!myOrgId || conversation.conversation_type !== "partnership") return;
    const channel = supabase
      .channel(`partnership-lister-${conversation.id}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "partnership_connections",
        filter: `receiver_org_id=eq.${myOrgId}`,
      }, payload => {
        const updated = payload.new as any;
        if (updated.conversation_id !== conversation.id) return;
        if (updated.status === "formed") setPartnershipResolved("confirmed");
        if (updated.status === "declined") setPartnershipResolved("declined");
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [myOrgId, conversation.id]);

  async function confirmPartnershipFromOtherSide() {
    if (!pendingConfirmation || confirmingPartnership) return;
    setConfirmingPartnership(true);
    await supabase.from("partnership_connections")
      .update({ status: "formed", updated_at: new Date().toISOString(), formed_at: new Date().toISOString() })
      .eq("id", pendingConfirmation.id);
    // Distinct status from "rejected": a successful confirm and an
    // outright decline are different outcomes and must not share one
    // status value, or the Messages list can't tell them apart either.
    await supabase.from("conversations")
      .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
      .eq("id", conversation.id);
    await supabase.rpc("send_conversation_notification", {
      p_conversation_id: conversation.id,
      p_target_user_id: conversation.other_user_id,
      p_type: "partnership_confirmed",
      p_title: "Partnership intent confirmed",
      p_body: `${conversation.other_user_name} confirmed the partnership intent as ${pendingConfirmation.partnership_type}.`,
      p_link: "/dashboard/portfolio?tab=partnerships&view=confirmed",
    });
    setPartnershipResolved("confirmed");
    onUpdate?.(conversation.id, { status: "confirmed" });
    setConfirmingPartnership(false);
  }

  async function declinePartnershipFromOtherSide() {
    if (!pendingConfirmation || confirmingPartnership) return;
    setConfirmingPartnership(true);

    await supabase.from("partnership_connections")
      .update({ status: "declined", declined_at: new Date().toISOString() })
      .eq("id", pendingConfirmation.id);

    await supabase.from("conversations")
      .update({ status: "rejected" })
      .eq("id", conversation.id);

    await supabase.rpc("send_conversation_notification", {
      p_conversation_id: conversation.id,
      p_target_user_id: conversation.other_user_id,
      p_type: "partnership_declined_by_expresser",
      p_title: "Partnership declined",
      p_body: `${conversation.other_user_name} declined the partnership.`,
      p_link: "/dashboard/messages",
    });

    setPartnershipResolved("declined");
    setIsRejected(true);
    onUpdate?.(conversation.id, { status: "rejected" });
    setConfirmingPartnership(false);
  }

  return (
    <div className="flex flex-col overflow-hidden w-full" style={{ height: "calc(100vh - 10rem)" }}>
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <button type="button" onClick={onBack}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-black dark:text-white truncate">{conversation.other_user_name}</p>
            <p className="text-xs text-black dark:text-white truncate">Re: {conversation.initiative_title}</p>
          </div>
        </div>

        {isOwner && conversation.conversation_type === "partnership" && (
          <PartnershipConfirmButton conversation={conversation} currentUserId={currentUserId} partnershipResolved={partnershipResolved} />
        )}
        {isOwner && conversation.conversation_type !== "question" && conversation.conversation_type !== "partnership" && (
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {confirmedRole ? (
              <span className="text-xs px-3 py-1.5 rounded-full font-medium"
                style={{ background: "rgba(45,106,79,0.12)", color: "#2D6A4F" }}>
                ✓ Confirmed as {rolePartnerPhrase(confirmedRole)}
              </span>
            ) : proposedRole ? (
              <span className="text-xs px-3 py-1.5 rounded-full font-medium"
                style={{ background: "rgba(180,83,9,0.12)", color: "#b45309" }}>
                Awaiting their confirmation
              </span>
            ) : declinedRole ? (
              <span className="text-xs px-3 py-1.5 rounded-full font-medium"
                style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444" }}>
                Proposal declined
              </span>
            ) : isRejected ? (
              <span className="text-xs px-3 py-1.5 rounded-full font-medium"
                style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444" }}>
                Conversation closed
              </span>
            ) : (
              <>
                <button type="button" onClick={() => setConfirmOpen(true)}
                  className="text-xs px-3 py-1.5 rounded-full border border-[#2D6A4F] text-[#2D6A4F] hover:bg-[rgba(45,106,79,0.12)] transition-colors font-medium flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5" />
                  Propose partner
                </button>
                <button type="button" onClick={rejectConversation} disabled={rejecting}
                  className="text-xs px-3 py-1.5 rounded-full border border-red-400/40 text-red-500 hover:bg-red-50 transition-colors font-medium disabled:opacity-40">
                  {rejecting ? "Closing..." : "Reject & close"}
                </button>
              </>
            )}
          </div>
        )}

        {!isOwner && !isFunder && conversation.conversation_type !== "question" && conversation.conversation_type !== "partnership" && (confirmedRole || proposedRole || declinedRole) && (
          <span className="text-xs px-3 py-1.5 rounded-full font-medium shrink-0" style={
            confirmedRole ? { background: "rgba(45,106,79,0.12)", color: "#2D6A4F" }
            : proposedRole ? { background: "rgba(180,83,9,0.12)", color: "#b45309" }
            : { background: "rgba(239,68,68,0.12)", color: "#ef4444" }
          }>
            {confirmedRole ? `✓ Confirmed as ${rolePartnerPhrase(confirmedRole)}`
              : proposedRole ? "Respond to their proposal below"
              : "You declined this proposal"}
          </span>
        )}
        {!isOwner && isFunder && (
          isRejected ? (
            <span className="text-xs px-3 py-1.5 rounded-full font-medium shrink-0"
              style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444" }}>
              This conversation was closed
            </span>
          ) : confirmedRole ? (
            <span className="text-xs px-3 py-1.5 rounded-full font-medium shrink-0"
              style={{ background: "rgba(45,106,79,0.12)", color: "#2D6A4F" }}>
              ✓ You're confirmed as {rolePartnerPhrase(confirmedRole)}
            </span>
          ) : proposedRole ? (
            <span className="text-xs px-3 py-1.5 rounded-full font-medium shrink-0"
              style={{ background: "rgba(180,83,9,0.12)", color: "#b45309" }}>
              Respond to their proposal below
            </span>
          ) : funderClosed ? (
            <button type="button" onClick={reopenConversation}
              className="text-xs px-3 py-1.5 rounded-full border border-[#2D6A4F]/30 text-[#2D6A4F] hover:bg-[#2D6A4F]/5 transition-colors shrink-0">
              Reopen
            </button>
          ) : (
            <button type="button" onClick={closeConversation}
              className="text-xs px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:border-red-300 hover:text-red-500 transition-colors shrink-0">
              Close
            </button>
          )
        )}
      </div>

      {/* Confirm modal */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-background rounded-2xl border border-border w-full max-w-sm shadow-xl p-6 space-y-4">
            <h3 className="text-base font-semibold text-foreground">
              Propose {conversation.other_user_name} as partner
            </h3>
            <p className="text-sm text-black dark:text-white">Select the role they'll play in this initiative. They'll be asked to confirm before it counts as a partnership.</p>
            <div className="flex flex-wrap gap-2">
              {initiativePartnerships.map(p => (
                <button key={p} type="button" onClick={() => setConfirmRole(p)}
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
              <input type="checkbox" checked={publicOnFeed} onChange={e => setPublicOnFeed(e.target.checked)}
                className="mt-0.5 accent-[#2D6A4F]" />
              <span className="text-xs text-black dark:text-white leading-relaxed">
                Show this partnership on the activity feed
              </span>
            </label>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => { setConfirmOpen(false); setConfirmRole(""); setPublicOnFeed(false); }}
                className="flex-1 h-9 rounded-full border border-border text-sm text-muted-foreground hover:text-foreground transition-colors">
                Cancel
              </button>
              <button type="button" onClick={proposePartner} disabled={!confirmRole || confirming}
                className="flex-1 h-9 rounded-full bg-[#2D6A4F] hover:bg-[#245c43] text-white text-sm font-medium disabled:opacity-40 transition-colors">
                {confirming ? "Sending..." : "Send proposal"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-3 pr-1 min-w-0">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-4 h-4 text-[#2D6A4F] animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-sm text-black dark:text-white text-center py-10">No messages yet. Say hello.</p>
        ) : (
          messages.map(msg => {
            const isMe = msg.sender_id === currentUserId;
            return (
              <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[72%] min-w-0 rounded-2xl px-4 py-2.5 text-sm ${
                    isMe
                      ? "bg-[#2D6A4F] text-white rounded-br-sm"
                      : "bg-muted text-foreground rounded-bl-sm"
                  }`}
                    style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}>
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

     {/* Partner proposal prompt for the responder on initiative-based conversations */}
      {conversation.conversation_type !== "partnership" && !isOwner && proposedRole && (
        <div className="mx-0 mb-3 rounded-xl border border-[#2D6A4F]/20 bg-[#2D6A4F]/5 px-4 py-3 space-y-2">
          <p className="text-sm font-medium text-foreground">
          Partner proposal: <span className="text-[#2D6A4F]">{rolePartnerPhrase(proposedRole)}</span> on "{conversation.initiative_title}"
          </p>
          <p className="text-xs text-black dark:text-white">Do you confirm this partnership?</p>
          <div className="flex gap-2">
            <button type="button" onClick={confirmProposedPartner} disabled={respondingToProposal}
              className="flex-1 h-9 rounded-full bg-[#2D6A4F] hover:bg-[#245c43] text-white text-xs font-medium disabled:opacity-40 transition-colors">
              {respondingToProposal ? "..." : "Confirm partnership"}
            </button>
            <button type="button" onClick={declineProposedPartner} disabled={respondingToProposal}
              className="flex-1 h-9 rounded-full border border-red-400/40 text-red-500 hover:bg-red-50 text-xs font-medium disabled:opacity-40 transition-colors">
              Decline
            </button>
          </div>
        </div>
      )}
      {/* Partnership confirmation prompt for expresser */}
      {conversation.conversation_type === "partnership" && pendingConfirmation && !partnershipResolved && !isOwner && (
        <div className="mx-0 mb-3 rounded-xl border border-[#2D6A4F]/20 bg-[#2D6A4F]/5 px-4 py-3 space-y-2">
          <p className="text-sm font-medium text-foreground">
            Partnership proposed: <span className="text-[#2D6A4F]">{pendingConfirmation.partnership_type}</span>
          </p>
          <p className="text-xs text-black dark:text-white">Do you confirm this partnership?</p>
          <div className="flex gap-2">
            <button type="button" onClick={confirmPartnershipFromOtherSide} disabled={confirmingPartnership}
              className="flex-1 h-9 rounded-full bg-[#2D6A4F] hover:bg-[#245c43] text-white text-xs font-medium disabled:opacity-40 transition-colors">
              {confirmingPartnership ? "..." : "Confirm partnership"}
            </button>
            <button type="button" onClick={declinePartnershipFromOtherSide} disabled={confirmingPartnership}
              className="flex-1 h-9 rounded-full border border-red-400/40 text-red-500 hover:bg-red-50 text-xs font-medium disabled:opacity-40 transition-colors">
              Decline
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      {conversation.conversation_type !== "partnership" && (confirmedRole || declinedRole) ? (
        <div className="pt-4 border-t border-border">
          <p className="text-xs text-black dark:text-white text-center py-2">
            {confirmedRole
              ? "Partnership confirmed. This is a first step, not a finished deal. Conversation closed."
              : "Partnership proposal declined. Conversation closed."}
          </p>
        </div>
      ) : conversation.conversation_type === "partnership" && partnershipResolved ? (
        <div className="pt-4 border-t border-border">
          <p className="text-xs text-black dark:text-white text-center py-2">
            {partnershipResolved === "confirmed"
              ? "Partnership intent confirmed by both sides. This is a first step, not a finished deal. Conversation closed."
              : "Partnership declined. Conversation closed."}
          </p>
        </div>
      ) : convStatus === "pending_acceptance" && isOwner ? (
        <div className="pt-4 border-t border-border space-y-2">
          <p className="text-xs text-black dark:text-white text-center">
         {conversation.other_user_name} wants to connect. Open the conversation to start chatting, or decline.
       </p>
          <div className="flex gap-2">
            <button type="button"
              onClick={async () => {
                await supabase.from("conversations")
                  .update({ status: "open", opened_at: new Date().toISOString() })
                  .eq("id", conversation.id);
                await supabase.rpc("send_conversation_notification", {
                  p_conversation_id: conversation.id,
                  p_target_user_id: conversation.other_user_id,
                  p_type: "partnership_accepted",
                  p_title: "Conversation opened",
                  p_body: `${conversation.initiative_title}: your message was accepted. You can now chat.`,
                  p_link: `/dashboard/messages?conversation=${conversation.id}`,
                });
                setConvStatus("open");
                onUpdate?.(conversation.id, { status: "open" });
              }}
              className="flex-1 h-9 rounded-full bg-[#2D6A4F] hover:bg-[#245c43] text-white text-xs font-semibold transition-colors">
              Open conversation
            </button>
            <button type="button"
              onClick={async () => {
                await supabase.from("conversations")
                  .update({ status: "rejected" })
                  .eq("id", conversation.id);
                setConvStatus("rejected");
                onUpdate?.(conversation.id, { status: "rejected" });
              }}
              className="flex-1 h-9 rounded-full border border-red-300 text-red-500 hover:bg-red-50 text-xs font-semibold transition-colors">
              Decline
            </button>
          </div>
        </div>

      ) : convStatus === "pending_acceptance" && !isOwner ? (
        <div className="pt-4 border-t border-border">
          <p className="text-xs text-black dark:text-white text-center py-2">
         Waiting for {conversation.other_user_name} to open this conversation.
       </p>
        </div>
      ) : isRejected ? (
        <div className="pt-4 border-t border-border space-y-2">
          <p className="text-xs text-black dark:text-white text-center py-2">This conversation has been closed.</p>
          {isOwner && conversation.conversation_type === "partnership" && (
            <button type="button" onClick={reopenConversation}
              className="w-full h-9 rounded-full border border-[#2D6A4F]/30 text-[#2D6A4F] text-xs font-semibold hover:bg-[#2D6A4F]/5 transition-colors">
              Reopen conversation
            </button>
          )}
        </div>
      ) : funderClosed ? (
        <div className="pt-4 border-t border-border flex items-center justify-between gap-3">
          <p className="text-xs text-black dark:text-white">
         {isFunder ? "This conversation is archived. Reopen to send messages." : "The funder has paused this conversation."}
       </p>
          {isFunder && (
            <button type="button" onClick={reopenConversation}
              className="shrink-0 text-xs font-semibold text-[#2D6A4F] hover:underline underline-offset-2 whitespace-nowrap">
              Reopen →
            </button>
          )}
        </div>
      ) : (
        <div className="pt-4 border-t border-border flex gap-2 min-w-0">
          <textarea
            ref={textareaRef}
            value={body}
            onChange={e => setBody(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
            }}
            placeholder="Type a message... (Shift+Enter for new line)"
            rows={1}
            className="flex-1 min-w-0 px-4 py-2.5 rounded-2xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors resize-none"
            style={{ minHeight: "40px", maxHeight: "120px" }}
          />
          <button type="button" onClick={sendMessage} disabled={!body.trim() || sending}
            className="w-10 h-10 rounded-full bg-[#2D6A4F] hover:bg-[#245c43] text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      )}
    </div>
  );
}