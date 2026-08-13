// ─── TeamTab.tsx ────────────────────────────────────────────────────────────
// Team management surface for DashboardSettings' "Team" tab. Three distinct
// views depending on the signed-in person's relationship to org_members:
//   - Owner (an organizations row exists under their own user_id): roster,
//     invite form, revoke.
//   - Pending invitee (a row in org_members with their user_id and
//     status='pending', for any org): accept/decline cards.
//   - Active Member of someone else's org: read-only info card, no controls
//     -- matches the DashboardProfile Owner-only editing precedent.
//   - None of the above: a short explainer, no org context to show yet.
//
// org_members.user_id has no FK to profiles (a freshly-invited person may
// not have a profiles row at all until they finish signup), so roster
// entries are built by merging two separate queries client-side rather than
// a PostgREST embed -- same pattern as useOrgActions.ts's saved/org merge.

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { Button } from "@/components/ui/button";
import { Loader2, UserPlus, X, Check } from "lucide-react";

type Role = "loading" | "owner" | "pending" | "member" | "none";

interface RosterRow {
  id: string;
  user_id: string;
  seat_label: string;
  status: "pending" | "active" | "revoked";
  invited_email: string;
  created_at: string;
  accepted_at: string | null;
  profile: { full_name: string | null; email: string | null; avatar_url: string | null } | null;
}

interface PendingInvite {
  id: string;
  org_id: string;
  seat_label: string;
  invited_email: string;
  created_at: string;
  org_name: string;
  org_logo: string | null;
}

interface MemberInfo {
  org_name: string;
  org_logo: string | null;
  seat_label: string;
  accepted_at: string | null;
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const STATUS_STYLES: Record<string, string> = {
  active:  "bg-[#2D6A4F]/10 text-[#2D6A4F]",
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
  revoked: "bg-muted text-muted-foreground",
};

export function TeamTab() {
  const { user, orgOwnerId, refreshOrgOwnerId } = useAuth();
  const [role, setRole] = useState<Role>("loading");

  // Owner state
  const [ownedOrgId, setOwnedOrgId] = useState<string | null>(null);
  const [roster, setRoster] = useState<RosterRow[]>([]);

  // Pending-invitee state
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);

  // Member state
  const [memberInfo, setMemberInfo] = useState<MemberInfo | null>(null);

  const [actingOn, setActingOn] = useState<string | null>(null);

  useEffect(() => {
    if (user?.id) load();
  }, [user?.id, orgOwnerId]);

  async function load() {
    if (!user) return;
    setRole("loading");

    const { data: ownedOrg } = await supabase
      .from("organizations")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (ownedOrg) {
      setOwnedOrgId(ownedOrg.id);
      await loadRoster(ownedOrg.id);
      setRole("owner");
      return;
    }

    const { data: pending } = await supabase
      .from("org_members")
      .select("id, org_id, seat_label, invited_email, created_at")
      .eq("user_id", user.id)
      .eq("status", "pending");

    if (pending && pending.length > 0) {
      const orgIds = pending.map((p: any) => p.org_id);
      const { data: orgs } = await supabase
        .from("organizations")
        .select("id, organisation_name, logo_url")
        .in("id", orgIds);
      const orgById = new Map((orgs ?? []).map((o: any) => [o.id, o]));
      setPendingInvites(pending.map((p: any) => ({
        id: p.id,
        org_id: p.org_id,
        seat_label: p.seat_label,
        invited_email: p.invited_email,
        created_at: p.created_at,
        org_name: orgById.get(p.org_id)?.organisation_name ?? "An organisation",
        org_logo: orgById.get(p.org_id)?.logo_url ?? null,
      })));
      setRole("pending");
      return;
    }

    if (orgOwnerId && orgOwnerId !== user.id) {
      const { data: ownerOrg } = await supabase
        .from("organizations")
        .select("id, organisation_name, logo_url")
        .eq("user_id", orgOwnerId)
        .maybeSingle();
      if (ownerOrg) {
        const { data: myRow } = await supabase
          .from("org_members")
          .select("seat_label, accepted_at")
          .eq("org_id", ownerOrg.id)
          .eq("user_id", user.id)
          .maybeSingle();
        setMemberInfo({
          org_name: ownerOrg.organisation_name,
          org_logo: ownerOrg.logo_url,
          seat_label: myRow?.seat_label ?? "Associate",
          accepted_at: myRow?.accepted_at ?? null,
        });
        setRole("member");
        return;
      }
    }

    setRole("none");
  }

  async function loadRoster(orgId: string) {
    const { data: rows } = await supabase
      .from("org_members")
      .select("id, user_id, seat_label, status, invited_email, created_at, accepted_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });

    if (!rows || rows.length === 0) { setRoster([]); return; }

    const userIds = rows.map((r: any) => r.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email, avatar_url")
      .in("id", userIds);
    const profileById = new Map((profiles ?? []).map((p: any) => [p.id, p]));

    setRoster(rows.map((r: any) => ({ ...r, profile: profileById.get(r.user_id) ?? null })));
  }

  // ── Owner: invite ──────────────────────────────────────────────────────
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSeat, setInviteSeat] = useState("Associate");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  async function sendInvite() {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteError(null);
    const { data, error } = await supabase.functions.invoke("invite-team-member", {
      body: { invited_email: inviteEmail.trim(), seat_label: inviteSeat.trim() || "Associate" },
    });
    setInviting(false);
    if (error || data?.error) {
      setInviteError(data?.error || error?.message || "Could not send invite.");
      return;
    }
    setInviteEmail("");
    setInviteSeat("Associate");
    if (ownedOrgId) await loadRoster(ownedOrgId);
  }

  // ── Owner: revoke ──────────────────────────────────────────────────────
  async function revokeMember(row: RosterRow) {
    setActingOn(row.id);
    await supabase.from("org_members").update({ status: "revoked" }).eq("id", row.id);
    if (ownedOrgId) await loadRoster(ownedOrgId);
    setActingOn(null);
  }

  // ── Invitee: accept / decline ────────────────────────────────────────────
  async function respondToInvite(invite: PendingInvite, accept: boolean) {
    setActingOn(invite.id);
    await supabase.from("org_members")
      .update(accept
        ? { status: "active", accepted_at: new Date().toISOString() }
        : { status: "revoked" })
      .eq("id", invite.id);
    await refreshOrgOwnerId();
    await load();
    setActingOn(null);
  }

  if (role === "loading") {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  // ── Pending invitee view ───────────────────────────────────────────────
  if (role === "pending") {
    return (
      <div className="space-y-4">
        {pendingInvites.map((inv) => (
          <div key={inv.id} className="rounded-xl border border-border bg-white dark:bg-card px-5 py-4 space-y-3">
            <div className="flex items-center gap-3">
              <UserAvatar id={inv.org_id} name={inv.org_name} avatarUrl={inv.org_logo} size="md" />
              <div>
                <p className="text-sm font-medium text-foreground">{inv.org_name} invited you to join their team</p>
                <p className="text-xs text-black dark:text-white mt-0.5">
                  As {inv.seat_label} · Invited {fmtDate(inv.created_at)}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="button"
                onClick={() => respondToInvite(inv, true)}
                disabled={actingOn === inv.id}
                className="bg-[#2D6A4F] hover:bg-[#245c43] text-white rounded-full px-5 h-9 text-sm">
                {actingOn === inv.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Check className="w-3.5 h-3.5 mr-1" />Accept</>}
              </Button>
              <Button type="button" variant="outline"
                onClick={() => respondToInvite(inv, false)}
                disabled={actingOn === inv.id}
                className="rounded-full px-5 h-9 text-sm">
                <X className="w-3.5 h-3.5 mr-1" />Decline
              </Button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ── Active Member of someone else's org — read-only ─────────────────────
  if (role === "member" && memberInfo) {
    return (
      <div className="rounded-xl border border-border bg-white dark:bg-card px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-black dark:text-white mb-3">Your team</p>
        <div className="flex items-center gap-3">
          <UserAvatar id={memberInfo.org_name} name={memberInfo.org_name} avatarUrl={memberInfo.org_logo} size="md" />
          <div>
            <p className="text-sm font-medium text-foreground">{memberInfo.org_name}</p>
            <p className="text-xs text-black dark:text-white mt-0.5">
              {memberInfo.seat_label} · Joined {fmtDate(memberInfo.accepted_at)}
            </p>
          </div>
        </div>
        <p className="text-xs text-black dark:text-white mt-4">
          Only the organisation owner can manage team membership.
        </p>
      </div>
    );
  }

  // ── No org context ───────────────────────────────────────────────────────
  if (role === "none") {
    return (
      <div className="rounded-xl border border-border bg-white dark:bg-card px-5 py-8 text-center">
        <p className="text-sm text-black dark:text-white">
          Team management is available once you have an organisation profile set up.
        </p>
      </div>
    );
  }

  // ── Owner view ────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-white dark:bg-card divide-y divide-border">
        <div className="px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-black dark:text-white mb-3">Invite a team member</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="email@example.com"
              className="flex-1 h-10 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/20"
            />
            <input
              type="text"
              value={inviteSeat}
              onChange={(e) => setInviteSeat(e.target.value)}
              placeholder="Role (e.g. Associate)"
              className="sm:w-44 h-10 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/20"
            />
            <Button type="button" onClick={sendInvite} disabled={inviting || !inviteEmail.trim()}
              className="bg-[#2D6A4F] hover:bg-[#245c43] text-white rounded-full px-5 h-10 text-sm shrink-0">
              {inviting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><UserPlus className="w-3.5 h-3.5 mr-1.5" />Invite</>}
            </Button>
          </div>
          {inviteError && <p className="text-xs text-red-500 mt-2">{inviteError}</p>}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-white dark:bg-card divide-y divide-border">
        <div className="px-5 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-black dark:text-white">
            Team ({roster.filter(r => r.status !== "revoked").length})
          </p>
        </div>
        {roster.length === 0 && (
          <div className="px-5 py-6 text-center text-sm text-black dark:text-white">
            No team members yet. Invite someone above.
          </div>
        )}
        {roster.filter(r => r.status !== "revoked").map((row) => (
          <div key={row.id} className="px-5 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <UserAvatar id={row.user_id} name={row.profile?.full_name || row.invited_email} avatarUrl={row.profile?.avatar_url} size="md" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {row.profile?.full_name || row.invited_email}
                </p>
                <p className="text-xs text-black dark:text-white mt-0.5 truncate">
                  {row.seat_label} · {row.profile?.email || row.invited_email}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_STYLES[row.status]}`}>
                {row.status === "pending" ? "Pending" : "Active"}
              </span>
              <button type="button"
                onClick={() => revokeMember(row)}
                disabled={actingOn === row.id}
                className="text-xs text-red-500 hover:text-red-600 font-medium">
                {actingOn === row.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : row.status === "pending" ? "Cancel" : "Remove"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
