// ─── PartnershipTab.tsx ───────────────────────────────────────────────────────
// Partnerships tab inside Portfolio
// Sub-tabs: Requested | Inbound | Outbound | Confirmed

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "wouter";
import {
  Loader2, Handshake, ArrowUpRight, ArrowDownLeft,
  Briefcase, CheckCircle2, X
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type PartnershipView = "requested" | "inbound" | "outbound" | "confirmed";

type MyListing = {
  id: string;
  organisation_name: string;
  partnership_sought: string | null;
  partnership_title: string | null;
  partnership_listed: boolean;
  partnership_formed: boolean;
  needs: string[];
  offers: string[];
  sdgs: number[];
  sector: string | string[];
  status: string;
};

type ConnectionRow = {
  id: string;
  sender_org_id: string;
  receiver_org_id: string;
  sender_user_id: string;
  source: "browse" | "ai_match";
  ai_rationale: string | null;
  fit_score: number | null;
  status: "pending" | "accepted" | "declined" | "formed" | "pending_confirmation";
  partnership_type: string | null;
  partnership_title: string | null;
  conversation_id: string | null;
  created_at: string;
  updated_at: string;
  sender_org?: OrgSnippet;
  receiver_org?: OrgSnippet;
  sender_profile?: { full_name: string; email: string };
  opening_message?: string | null;
};

type OrgSnippet = {
  id: string;
  organisation_name: string;
  organisation_type: string;
  country: string | string[];
  needs: string[];
  offers: string[];
  email?: string;
  website?: string;
  user_id: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const PARTNERSHIP_TYPES = [
  "Co-funder", "Implementing partner", "Research partner",
  "Technical advisor", "CSR partner", "Strategic partner", "Other",
];

const STATUS_STYLES: Record<string, { label: string; bg: string; color: string }> = {
  pending:              { label: "Pending",               bg: "rgba(180,83,9,0.12)", color: "#b45309" },
  accepted:             { label: "Accepted",              bg: "rgba(45,106,79,0.12)", color: "#2D6A4F" },
  declined:             { label: "Declined",              bg: "rgba(239,68,68,0.12)", color: "#ef4444" },
  formed:               { label: "Partnership formed",    bg: "rgba(3,105,161,0.12)", color: "#0369a1" },
  pending_confirmation: { label: "Awaiting confirmation", bg: "rgba(196,92,38,0.08)", color: "#C45C26" },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeArr(val: string | string[] | null | undefined): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === "string" && val.startsWith("{") && val.endsWith("}")) {
    const inner = val.slice(1, -1);
    const matches = inner.match(/("(?:[^"\\]|\\.)*"|[^,]+)/g) ?? [];
    return matches.map(m => m.replace(/^"|"$/g, "").trim()).filter(Boolean);
  }
  try { const p = JSON.parse(val); return Array.isArray(p) ? p : [val]; }
  catch { return [val]; }
}

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

function inferPartnershipType(offers: string[]): string {
  if (!offers || offers.length === 0) return "Strategic partner";
  const o = offers[0].toLowerCase();
  if (o.includes("fund")) return "Co-funder";
  if (o.includes("research")) return "Research partner";
  if (o.includes("field") || o.includes("execution")) return "Implementing partner";
  if (o.includes("data") || o.includes("network")) return "Technical advisor";
  return "Strategic partner";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function EmptyState({ icon: Icon, title, body }: { icon: any; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-12 text-center">
      <Icon className="w-8 h-8 text-muted-foreground/40 mx-auto mb-4" />
      <p className="text-foreground font-medium mb-2">{title}</p>
      <p className="text-sm text-muted-foreground max-w-sm mx-auto">{body}</p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PartnershipTab() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [loading, setLoading]         = useState(true);
  const [myOrgId, setMyOrgId]         = useState<string | null>(null);
  const [myListing, setMyListing]     = useState<MyListing | null>(null);
  const [inbound, setInbound]         = useState<ConnectionRow[]>([]);
  const [outbound, setOutbound]       = useState<ConnectionRow[]>([]);
  const [activeView, setActiveView] = useState<PartnershipView>(() => {
    const p = new URLSearchParams(window.location.search);
    const v = p.get("view") as PartnershipView;
    return (["requested", "inbound", "outbound", "confirmed"].includes(v)) ? v : "inbound";
  });
  const [updating, setUpdating]       = useState<string | null>(null);
  const [formingAll, setFormingAll]   = useState(false);

  // For Accept Partnership modal
  const [acceptModal, setAcceptModal] = useState<ConnectionRow | null>(null);
  const [partnershipType, setPartnershipType] = useState("");
  const [accepting, setAccepting]     = useState(false);

  useEffect(() => {
    if (user) load();
  }, [user]);

  async function load() {
    setLoading(true);

    const { data: myOrg } = await supabase
      .from("organizations")
      .select("id, organisation_name, partnership_sought, partnership_title, partnership_listed, partnership_formed, needs, offers, sdgs, sector, status")
      .eq("user_id", user!.id)
      .maybeSingle();

    if (!myOrg) { setLoading(false); return; }
    setMyOrgId(myOrg.id);
    setMyListing(myOrg as MyListing);

    const [inboundRes, outboundRes] = await Promise.all([
      supabase.from("partnership_connections").select("*, conversation_id")
        .eq("receiver_org_id", myOrg.id)
        .order("fit_score", { ascending: false, nullsFirst: false }),
      supabase.from("partnership_connections").select("*")
        .eq("sender_org_id", myOrg.id)
        .order("created_at", { ascending: false }),
    ]);

    // Collect org ids
    const senderOrgIds   = (inboundRes.data ?? []).map((r: any) => r.sender_org_id);
    const receiverOrgIds = (outboundRes.data ?? []).map((r: any) => r.receiver_org_id);
    const senderUserIds  = (inboundRes.data ?? []).map((r: any) => r.sender_user_id);

    const [orgsRes, profilesRes] = await Promise.all([
      supabase.from("organizations")
        .select("id, organisation_name, organisation_type, country, needs, offers, email, website, user_id")
        .in("id", [...new Set([...senderOrgIds, ...receiverOrgIds])]),
      supabase.from("profiles")
        .select("id, full_name, email")
        .in("id", [...new Set(senderUserIds)]),
    ]);

    const orgMap     = new Map((orgsRes.data ?? []).map((o: any) => [o.id, o]));
    const profileMap = new Map((profilesRes.data ?? []).map((p: any) => [p.id, p]));

    const inboundWithOrgs = (inboundRes.data ?? []).map((r: any) => ({
      ...r,
      sender_org:     orgMap.get(r.sender_org_id),
      sender_profile: profileMap.get(r.sender_user_id),
    }));

    const conversationIds = inboundWithOrgs
      .map((r: any) => r.conversation_id)
      .filter(Boolean);

    let messageMap = new Map<string, string>();
    if (conversationIds.length > 0) {
      const { data: messages } = await supabase
        .from("messages")
        .select("conversation_id, body")
        .in("conversation_id", conversationIds)
        .order("created_at", { ascending: true });

      (messages ?? []).forEach((m: any) => {
        if (!messageMap.has(m.conversation_id)) {
          messageMap.set(m.conversation_id, m.body);
        }
      });
    }

    setInbound(inboundWithOrgs.map((r: any) => ({
      ...r,
      opening_message: r.conversation_id ? messageMap.get(r.conversation_id) ?? null : null,
    })));

    setOutbound((outboundRes.data ?? []).map((r: any) => ({
      ...r,
      receiver_org: orgMap.get(r.receiver_org_id),
    })));

    setLoading(false);
  }

  // Accept/Decline expression of interest
  async function updateStatus(conn: ConnectionRow, status: "accepted" | "declined") {
    setUpdating(conn.id);

    await supabase.from("partnership_connections")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", conn.id);

    let newConvId: string | undefined;
    if (status === "accepted") {
      if (conn.conversation_id) {
        newConvId = conn.conversation_id;
        await supabase.rpc("accept_partnership_connection", {
          p_connection_id: conn.id,
          p_conversation_id: conn.conversation_id,
        });
      } else {
        const { data: conv } = await supabase.from("conversations").insert({
          conversation_type: "partnership",
          status: "open",
          initiative_owner_id: user!.id,
        }).select("id").single();

        newConvId = conv?.id;

        if (conv?.id) {
          await supabase.rpc("accept_partnership_connection", {
            p_connection_id: conn.id,
            p_conversation_id: conv.id,
          });
          if (conn.ai_rationale) {
            await supabase.from("messages").insert({
              conversation_id: conv.id,
              sender_id: user!.id,
              body: `Match rationale: ${conn.ai_rationale}`,
            });
          }
        }
      }

      await supabase.rpc("send_partnership_notification", {
        p_connection_id: conn.id,
        p_type: "partnership_accepted",
        p_title: "Partnership interest accepted",
        p_body: `${myListing?.organisation_name} accepted your partnership interest. A conversation has been opened in Messages.`,
        p_link: "/dashboard/messages",
      });
    } else {
      await supabase.rpc("send_partnership_notification", {
        p_connection_id: conn.id,
        p_type: "partnership_declined",
        p_title: "Partnership interest not taken forward",
        p_body: `${myListing?.organisation_name} did not take your partnership interest forward at this time.`,
        p_link: "/dashboard/messages",
      });
    }

    await load();
      setUpdating(null);
      if (status === "accepted" && newConvId) navigate(`/dashboard/messages?conversation=${newConvId}`);
  }

  // Accept Partnership — moves to Confirmed with a type
  async function acceptPartnership() {
    if (!acceptModal || !partnershipType || accepting) return;
    setAccepting(true);

    await supabase.from("partnership_connections")
      .update({
        status: "accepted",
        partnership_type: partnershipType,
        updated_at: new Date().toISOString(),
      })
      .eq("id", acceptModal.id);

    // Notify the sender
    await supabase.rpc("send_partnership_notification", {
      p_connection_id: acceptModal.id,
      p_type: "partnership_confirmed",
      p_title: "Partnership accepted",
      p_body: `${myListing?.organisation_name} has accepted the partnership as ${partnershipType}.`,
    });

    setAcceptModal(null);
    setPartnershipType("");
    setAccepting(false);
    await load();
  }

  // Mark Partnership Formed — closes entire listing
  async function markFormed() {
    
    if (!myOrgId || formingAll) return;
    setFormingAll(true);

    const { error: formedError } = await supabase.from("organizations")
      .update({ partnership_formed: true })
      .eq("id", myOrgId);

    // Snapshot partnership title onto confirmed connections before any future reset
    const formedIds = inbound
      .filter(c => c.status === "formed")
      .map(c => c.id);

    if (formedIds.length > 0 && myListing?.partnership_title) {
      await supabase.from("partnership_connections")
        .update({ partnership_title: myListing.partnership_title })
        .in("id", formedIds);
    }

    // Mark one accepted connection as formed, decline all remaining pending
    const pendingIds = inbound
      .filter(c => c.status === "pending")
      .map(c => c.id);

    if (pendingIds.length > 0) {
      await supabase.from("partnership_connections")
        .update({ status: "declined", updated_at: new Date().toISOString() })
        .in("id", pendingIds);

      // Notify all declined
      const pendingToNotify = inbound.filter(c => c.status === "pending");
      if (pendingToNotify.length > 0) {
        await Promise.all(pendingToNotify.map(c =>
          supabase.rpc("send_partnership_notification", {
            p_connection_id: c.id,
            p_type: "partnership_closed",
            p_title: "Partnership request closed",
            p_body: `${myListing?.organisation_name} has formed a partnership and closed this listing.`,
          })
        ));
      }
    }

    setFormingAll(false);
    await load();
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 text-[#2D6A4F] animate-spin" />
      </div>
    );
  }

  if (!myOrgId) {
    return (
      <EmptyState
        icon={Handshake}
        title="No organisation profile yet."
        body="Create an org profile and use Get Matched on the Partnerships page to start connecting."
      />
    );
  }

  const pendingInbound   = inbound.filter(c => c.status === "pending");
  const acceptedInbound  = inbound.filter(c => c.status === "accepted");
  const confirmedInbound = inbound.filter(c => c.status === "formed");
  const isListed         = myListing?.partnership_listed;

  const subTabs: { key: PartnershipView; label: string }[] = [
    { key: "requested", label: "Requested" },
    { key: "inbound",   label: "Inbound"   },
    { key: "outbound",  label: "Outbound"  },
    { key: "confirmed", label: "Confirmed" },
  ];

  return (
    <div className="space-y-8">
      {/* Sub-tabs — pill style */}
      <div className="flex gap-1.5 p-1 rounded-xl bg-muted w-fit overflow-x-auto">
        {subTabs.map(({ key, label}) => (
          <button key={key} type="button" onClick={() => setActiveView(key)}
            className={`h-8 px-4 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeView === key
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Requested ── */}
      {activeView === "requested" && (
        <>
          {!isListed ? (
            <EmptyState
              icon={Briefcase}
              title="You're not listed yet."
              body="Go to the Partnerships page and use Get Matched to list your organisation for discovery."
            />
          ) : (
            <div className="rounded-xl border border-border bg-card px-5 py-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-foreground">{myListing?.organisation_name}</p>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1 inline-block"
                    style={{ background: "rgba(45,106,79,0.12)", color: "#2D6A4F" }}>
                    Listed publicly
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {myListing?.partnership_formed ? (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: "rgba(3,105,161,0.12)", color: "#0369a1" }}>
                      Partnership formed
                    </span>
                  ) : (
                    <button type="button" onClick={markFormed} disabled={formingAll}
                      className="text-xs px-3 py-1.5 rounded-full border border-[#2D6A4F]/40 text-[#2D6A4F] hover:bg-[#2D6A4F]/5 disabled:opacity-40 transition-colors">
                      {formingAll ? "Closing..." : "Mark formed"}
                    </button>
                  )}
                  <button type="button"
                    onClick={async () => {
                      await supabase.from("organizations")
                        .update({ partnership_listed: false }).eq("id", myOrgId);
                      await load();
                    }}
                    className="text-xs text-muted-foreground hover:text-red-500 transition-colors border border-border rounded-full px-3 py-1.5">
                    Unlist
                  </button>
                </div>
              </div>
              {myListing?.partnership_sought && (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {myListing.partnership_sought}
                </p>
              )}
              <div className="pt-2 border-t border-border flex items-center justify-between gap-3">
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{pendingInbound.length}</span> pending ·{" "}
                  <span className="font-medium text-foreground">{acceptedInbound.length}</span> accepted
                </div>
                {(pendingInbound.length > 0 || acceptedInbound.length > 0) && (
                  <button type="button" onClick={() => setActiveView("inbound")}
                    className="text-xs text-[#2D6A4F] hover:underline underline-offset-2">
                    View inbound →
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Inbound ── */}
      {activeView === "inbound" && (
        <div className="space-y-4">
          

          {inbound.filter(c => c.status !== "declined").length === 0 ? (
            <EmptyState
              icon={ArrowDownLeft}
              title="No inbound requests yet."
              body="Once your listing is live, organisations that express interest will appear here, ranked by fit."
            />
          ) : (
            <div className="space-y-3">
              {inbound.filter(c => c.status !== "declined").map(conn => {
                const org     = conn.sender_org;
                const profile = conn.sender_profile;
                const s       = STATUS_STYLES[conn.status];
                const countries = normalizeArr(org?.country);
                const isAccepted = conn.status === "accepted" || conn.status === "formed";
                const isPending  = conn.status === "pending";
                return (
                  <div key={conn.id}
                    className="rounded-2xl border border-border bg-card px-6 py-5 space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-foreground text-sm">
                          {org?.organisation_name ?? "Unknown"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                          {org?.organisation_type?.replace(/_/g, " ")}
                          {countries.length > 0 && ` · ${countries.join(", ")}`}
                        </p>
                        {profile?.email && (
                          <a href={`mailto:${profile.email}`}
                            className="text-xs text-[#2D6A4F] hover:underline mt-0.5 inline-block">
                            {profile.email}
                          </a>
                        )}
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-1.5">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: s.bg, color: s.color }}>
                          {s.label}
                        </span>
                        {conn.fit_score !== null && (
                          <div className="text-right">
                            <div className="text-sm font-bold text-[#2D6A4F]">{conn.fit_score}</div>
                            <div className="text-[10px] text-muted-foreground">fit score</div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Source + time */}
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span>via {conn.source === "ai_match" ? "AI match" : "directory"}</span>
                      <span>·</span>
                      <span>{timeAgo(conn.created_at)}</span>
                    </div>

                    {/* Rationale */}
                    {conn.ai_rationale && (
                      <p className="text-xs text-muted-foreground leading-relaxed border-l-2 border-[#2D6A4F]/30 pl-3">
                        {conn.ai_rationale}
                      </p>
                    )}

                    {/* Needs/Offers */}
                    {(org?.needs?.length || org?.offers?.length) ? (
                      <div className="flex gap-4 text-xs">
                        {org?.needs?.length ? (
                          <div>
                            <span className="text-muted-foreground font-medium">Needs: </span>
                            <span className="text-foreground">{org.needs.slice(0, 2).join(", ")}</span>
                          </div>
                        ) : null}
                        {org?.offers?.length ? (
                          <div>
                            <span className="text-muted-foreground font-medium">Offers: </span>
                            <span className="text-foreground">{org.offers.slice(0, 2).join(", ")}</span>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {isPending && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                        Awaiting response in Messages
                      </div>
                    )}

                    {/* Accepted — conversation is open, action moves to Messages */}
                    {isAccepted && !conn.partnership_type && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#2D6A4F]" />
                        Conversation open — accept partnership from Messages
                      </div>
                    )}

                    {/* Has partnership_type — confirmed */}
                    {isAccepted && conn.partnership_type && (
                      <div className="flex items-center gap-2 pt-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#2D6A4F] shrink-0" />
                        <span className="text-xs text-[#2D6A4F] font-medium">
                          Partnership accepted as {conn.partnership_type}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Outbound ── */}
      {activeView === "outbound" && (
        <>
          {outbound.length === 0 ? (
            <EmptyState
              icon={ArrowUpRight}
              title="No outbound invitations yet."
              body="Use Get Matched or Express Interest on the Partnerships page to reach out."
            />
          ) : (
            <div className="space-y-3">
              {outbound.map(conn => {
                const org       = conn.receiver_org;
                const s         = STATUS_STYLES[conn.status];
                const countries = normalizeArr(org?.country);

                return (
                  <div key={conn.id}
                    className="rounded-2xl border border-border bg-card px-6 py-5 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-foreground text-sm">
                          {org?.organisation_name ?? "Unknown"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                          {org?.organisation_type?.replace(/_/g, " ")}
                          {countries.length > 0 && ` · ${countries.join(", ")}`}
                        </p>
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-1.5">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: s.bg, color: s.color }}>
                          {s.label}
                        </span>
                        {conn.fit_score !== null && (
                          <div className="text-right">
                            <div className="text-sm font-bold text-[#2D6A4F]">{conn.fit_score}</div>
                            <div className="text-[10px] text-muted-foreground">fit</div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span>via {conn.source === "ai_match" ? "AI match" : "directory"}</span>
                      <span>·</span>
                      <span>{timeAgo(conn.created_at)}</span>
                    </div>
                    {conn.ai_rationale && (
                      <p className="text-xs text-muted-foreground leading-relaxed border-l-2 border-[#2D6A4F]/30 pl-3">
                        {conn.ai_rationale}
                      </p>
                    )}
                    {conn.partnership_type && (
                      <div className="flex items-center gap-1.5 text-xs text-[#2D6A4F]">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        {conn.partnership_type}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── Confirmed ── */}
      {activeView === "confirmed" && (
        <>
          {confirmedInbound.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="No confirmed partnerships yet."
              body="Once the other party confirms the partnership, they'll appear here."
            />
          ) : (
            <div className="space-y-4">
              {/* Group confirmed partners by partnership_title */}
              {(() => {
                const grouped = confirmedInbound.reduce((acc, conn) => {
                  const title = conn.partnership_title ?? myListing?.partnership_title ?? "Partnership request";
                  if (!acc[title]) acc[title] = [];
                  acc[title].push(conn);
                  return acc;
                }, {} as Record<string, ConnectionRow[]>);

                return Object.entries(grouped).map(([title, conns]) => (
                  <div key={title} className="rounded-xl border border-[#2D6A4F]/20 bg-card overflow-hidden">
                    <div className="px-5 py-3 border-b border-border bg-[#2D6A4F]/5">
                      <p className="text-sm font-semibold text-[#2D6A4F]">{title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {conns.length} confirmed partner{conns.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/30">
                          {["Name", "Role", "Contact", "Confirmed"].map(h => (
                            <th key={h} className="text-left px-5 py-2.5 text-xs font-semibold text-muted-foreground">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {conns.map(conn => {
                          const org     = conn.sender_org;
                          const profile = conn.sender_profile;
                          return (
                            <tr key={conn.id}>
                              <td className="px-5 py-3">
                                <p className="text-sm font-medium text-foreground">
                                  {org?.organisation_name ?? "Unknown"}
                                </p>
                              </td>
                              <td className="px-5 py-3">
                                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                                  style={{ background: "rgba(45,106,79,0.12)", color: "#2D6A4F" }}>
                                  {conn.partnership_type}
                                </span>
                              </td>
                              <td className="px-5 py-3">
                                <div className="space-y-0.5">
                                  {profile?.email && (
                                    <a href={`mailto:${profile.email}`}
                                      className="block text-xs text-[#2D6A4F] hover:underline">
                                      {profile.email}
                                    </a>
                                  )}
                                  {org?.email && org.email !== profile?.email && (
                                    <a href={`mailto:${org.email}`}
                                      className="block text-xs text-muted-foreground hover:text-foreground">
                                      {org.email}
                                    </a>
                                  )}
                                  {org?.website && org.website !== "https://" && (
                                    <a href={org.website} target="_blank" rel="noopener noreferrer"
                                      className="block text-xs text-muted-foreground hover:text-foreground">
                                      {org.website.replace(/^https?:\/\//, "")} ↗
                                    </a>
                                  )}
                                </div>
                              </td>
                              <td className="px-5 py-3 text-xs text-muted-foreground whitespace-nowrap">
                                {timeAgo(conn.updated_at)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ));
              })()}
            </div>
          )}
        </>
      )}

      {/* ── Accept Partnership Modal ── */}
      {acceptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-background rounded-2xl border border-border w-full max-w-sm shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-foreground">Accept Partnership</h3>
              <button type="button" onClick={() => { setAcceptModal(null); setPartnershipType(""); }}>
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground">
              Confirm {acceptModal.sender_org?.organisation_name} as a partner.
              Select the partnership type — you can change it.
            </p>
            <div className="flex flex-wrap gap-2">
              {PARTNERSHIP_TYPES.map(t => (
                <button key={t} type="button" onClick={() => setPartnershipType(t)}
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
              <button type="button"
                onClick={() => { setAcceptModal(null); setPartnershipType(""); }}
                className="flex-1 h-9 rounded-full border border-border text-sm text-muted-foreground hover:text-foreground transition-colors">
                Cancel
              </button>
              <button type="button" onClick={acceptPartnership}
                disabled={!partnershipType || accepting}
                className="flex-1 h-9 rounded-full bg-[#2D6A4F] hover:bg-[#245c43] text-white text-sm font-medium disabled:opacity-40 transition-colors">
                {accepting ? "Confirming..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
