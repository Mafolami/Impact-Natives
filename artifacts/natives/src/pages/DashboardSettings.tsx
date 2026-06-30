import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { supabase } from "@/lib/supabase";
import { Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type SettingsTab = "account" | "privacy" | "notifications" | "danger";

interface NotificationPrefs {
  new_eoi: boolean;
  eoi_accepted: boolean;
  eoi_declined: boolean;
  partner_confirmed: boolean;
  new_message: boolean;
}

const NOTIFICATION_LABELS: { key: keyof NotificationPrefs; label: string; sub: string }[] = [
  { key: "new_eoi",           label: "New expression of interest", sub: "Someone expresses interest in your initiative" },
  { key: "eoi_accepted",      label: "EOI accepted",               sub: "Your expression of interest is accepted" },
  { key: "eoi_declined",      label: "EOI declined",               sub: "Your expression of interest is not taken forward" },
  { key: "partner_confirmed", label: "Partner confirmed",          sub: "You are confirmed as a partner on an initiative" },
  { key: "new_message",       label: "New message",                sub: "Someone sends you a message in a conversation" },
];

export default function DashboardSettings() {
  const { user, profile, signOut } = useAuth();
  const [tab, setTab] = useState<SettingsTab>("account");

  // ── Password ──────────────────────────────────────────────────────────────
  const [pwSending, setPwSending]   = useState(false);
  const [pwSent, setPwSent]         = useState(false);
  const [pwError, setPwError]       = useState<string | null>(null);

  async function sendPasswordReset() {
    if (!user?.email) return;
    setPwSending(true);
    setPwError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    });
    setPwSending(false);
    if (error) setPwError(error.message);
    else setPwSent(true);
  }

  // ── Privacy ───────────────────────────────────────────────────────────────
  const [feedVisibility, setFeedVisibility]   = useState<"none" | "public">("none");
  const [allowMessages, setAllowMessages]     = useState(true);
  const [showIndividualProfile, setShowIndividualProfile] = useState(false);
  const [privacySaving, setPrivacySaving]     = useState(false);
  const [privacySaved, setPrivacySaved]       = useState(false);

  useEffect(() => {
    if (!profile) return;
    setFeedVisibility((profile as any).feed_visibility === "public" ? "public" : "none");
    setAllowMessages((profile as any).allow_messages !== false);
    setShowIndividualProfile((profile as any).show_individual_profile === true);
  }, [profile]);

  async function savePrivacy() {
    if (!user) return;
    setPrivacySaving(true);
    setPrivacySaved(false);
    await supabase.from("profiles").update({
      feed_visibility: feedVisibility,
      show_individual_profile: showIndividualProfile,
    }).eq("id", user.id);
    setPrivacySaving(false);
    setPrivacySaved(true);
    setTimeout(() => setPrivacySaved(false), 3000);
  }

  // ── Notifications ─────────────────────────────────────────────────────────
  const [notifPrefs, setNotifPrefs]     = useState<NotificationPrefs>({
    new_eoi: true, eoi_accepted: true, eoi_declined: true,
    partner_confirmed: true, new_message: true,
  });
  const [notifSaving, setNotifSaving]   = useState(false);
  const [notifSaved, setNotifSaved]     = useState(false);

  useEffect(() => {
    if (!profile) return;
    const prefs = (profile as any).notification_preferences;
    if (prefs) setNotifPrefs({ ...notifPrefs, ...prefs });
  }, [profile]);

  async function saveNotifications() {
    if (!user) return;
    setNotifSaving(true);
    setNotifSaved(false);
    await supabase.from("profiles").update({
      notification_preferences: notifPrefs,
    }).eq("id", user.id);
    setNotifSaving(false);
    setNotifSaved(true);
    setTimeout(() => setNotifSaved(false), 3000);
  }

  // ── Deactivate ────────────────────────────────────────────────────────────
  const [deactivateConfirm, setDeactivateConfirm] = useState(false);
  const [deactivating, setDeactivating]           = useState(false);

  async function deactivateAccount() {
    if (!user) return;
    setDeactivating(true);
    await supabase.from("profiles").update({ is_active: false }).eq("id", user.id);
    await signOut();
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput]     = useState("");
  const [deleting, setDeleting]           = useState(false);
  const [deleteError, setDeleteError]     = useState<string | null>(null);

  async function deleteAccount() {
    if (!user) return;
    setDeleting(true);
    setDeleteError(null);
    const { error } = await supabase.rpc("delete_own_account");
    if (error) {
      setDeleteError(error.message);
      setDeleting(false);
    } else {
      await signOut();
    }
  }

  const TABS: { value: SettingsTab; label: string }[] = [
    { value: "account",       label: "Account" },
    { value: "privacy",       label: "Privacy" },
    { value: "notifications", label: "Notifications" },
    { value: "danger",        label: "Danger zone" },
  ];

  const tabHelp: Record<string, { title: string; items: string[] }> = {
    account: {
      title: "Account tips",
      items: [
        "Your email address cannot be changed once set.",
        "Use a strong password and enable 2FA if available.",
        "Sign out of shared devices after each session.",
      ],
    },
    privacy: {
      title: "Privacy tips",
      items: [
        "Setting your profile to Private hides you from the ecosystem feed.",
        "Your initiatives remain visible in the marketplace regardless of this setting.",
        "You can change this at any time.",
      ],
    },
    notifications: {
      title: "Notification tips",
      items: [
        "EOI notifications alert you when someone expresses interest in your initiative.",
        "Partnership notifications fire when a conversation is confirmed.",
        "Weekly digest summarises ecosystem activity in your sectors.",
      ],
    },
    danger: {
      title: "Before you proceed",
      items: [
        "Deactivation hides your profile but preserves your data.",
        "Deletion is permanent and cannot be undone.",
        "Contact the team if you need help recovering your account.",
      ],
    },
  };

  const currentHelp = tabHelp[tab];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: "2rem", alignItems: "start", width: "100%", position: "relative" }}>
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground mt-1">Manage your account and preferences.</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border overflow-x-auto scrollbar-hide">
        {TABS.map(({ value, label }) => (
          <button key={value} type="button" onClick={() => setTab(value)}
            className={`pb-3 px-3 shrink-0 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === value
                ? "border-[#2D6A4F] text-[#2D6A4F]"
                : "border-transparent text-muted-foreground hover:text-foreground"
            } ${value === "danger" ? "ml-auto text-red-500 hover:text-red-600 border-transparent" : ""}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Account ── */}
      {tab === "account" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card divide-y divide-border">
            <div className="px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Account information</p>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Full name</p>
                  <p className="text-sm font-medium text-foreground">{profile?.full_name || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Email</p>
                  <p className="text-sm font-medium text-foreground">{user?.email}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Email cannot be changed.</p>
                </div>
              </div>
            </div>

            <div className="px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Password</p>
              {pwSent ? (
                <p className="text-sm text-[#2D6A4F]">Reset link sent — check your email.</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    We'll send a password reset link to <span className="text-foreground">{user?.email}</span>.
                  </p>
                  {pwError && <p className="text-xs text-red-500">{pwError}</p>}
                  <Button type="button" variant="outline"
                    className="rounded-full px-5 text-sm h-9"
                    onClick={sendPasswordReset}
                    disabled={pwSending}>
                    {pwSending ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />Sending...</> : "Send reset link"}
                  </Button>
                </div>
              )}
            </div>

            <div className="px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Profile</p>
              <p className="text-sm text-muted-foreground">
                To update your photo, bio, or org details,{" "}
                <a href="/dashboard/profile" className="text-[#2D6A4F] hover:underline underline-offset-2">
                  visit your profile page
                </a>.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card divide-y divide-border">
            <div className="px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Appearance</p>
                <p className="text-xs text-muted-foreground mt-0.5">Switch between light and dark mode</p>
              </div>
              <ThemeToggle />
            </div>
            <div className="px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Session</p>
              <Button type="button" variant="outline"
                className="rounded-full px-5 text-sm h-9"
                onClick={signOut}>
                Sign out
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Privacy ── */}
      {tab === "privacy" && (
        <div className="rounded-xl border border-border bg-card divide-y divide-border">
          <div className="px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Visibility</p>
            <div className="space-y-3">
              {[
                { value: "public", label: "Public", sub: "Your activity appears on the Impact Natives feed" },
                { value: "none",   label: "Private", sub: "Your activity is not shown on the feed" },
              ].map((opt) => (
                <button key={opt.value} type="button"
                  onClick={() => setFeedVisibility(opt.value as "public" | "none")}
                  className={`w-full text-left px-4 py-3.5 rounded-xl border transition-colors ${
                    feedVisibility === opt.value
                      ? "border-[#2D6A4F] bg-[#f0f9f4]"
                      : "border-border hover:border-foreground/20"
                  }`}>
                  <p className="text-sm font-medium text-foreground">{opt.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{opt.sub}</p>
                </button>
              ))}
            </div>
          </div>

          {profile?.user_type === "organisation" && (
            <div className="px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Individual profile</p>
              <button type="button"
                onClick={() => setShowIndividualProfile(v => !v)}
                className={`w-full flex items-start gap-3 text-left px-4 py-3.5 rounded-xl border transition-colors ${
                  showIndividualProfile
                    ? "border-[#2D6A4F] bg-[#f0f9f4]"
                    : "border-border hover:border-foreground/20"
                }`}>
                <div className={`w-4 h-4 mt-0.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                  showIndividualProfile ? "bg-[#2D6A4F] border-[#2D6A4F]" : "border-border"
                }`}>
                  {showIndividualProfile && <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Also show me as an individual</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Your personal profile will also appear in the Natives directory under Individuals, tagged with your organisation.</p>
                </div>
              </button>
            </div>
          )}

          <div className="px-5 py-4 flex justify-end">
            <Button type="button" onClick={savePrivacy} disabled={privacySaving}
              className="bg-[#2D6A4F] hover:bg-[#245c43] text-white rounded-full px-6 h-9 text-sm">
              {privacySaving
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />Saving...</>
                : privacySaved ? "Saved ✓" : "Save changes"}
            </Button>
          </div>
        </div>
      )}

      {/* ── Notifications ── */}
      {tab === "notifications" && (
        <div className="rounded-xl border border-border bg-card divide-y divide-border">
          <div className="px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">In-app notifications</p>
            <div className="space-y-4">
              {NOTIFICATION_LABELS.map(({ key, label, sub }) => (
                <div key={key} className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">{label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
                  </div>
                  <button type="button"
                    onClick={() => setNotifPrefs((p) => ({ ...p, [key]: !p[key] }))}
                    className={`relative shrink-0 w-10 h-6 rounded-full transition-colors ${notifPrefs[key] ? "bg-[#2D6A4F]" : "bg-muted"}`}>
                    <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                      notifPrefs[key] ? "translate-x-5" : "translate-x-1"
                    }`} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="px-5 py-4 flex justify-end">
            <Button type="button" onClick={saveNotifications} disabled={notifSaving}
              className="bg-[#2D6A4F] hover:bg-[#245c43] text-white rounded-full px-6 h-9 text-sm">
              {notifSaving
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />Saving...</>
                : notifSaved ? "Saved ✓" : "Save changes"}
            </Button>
          </div>
        </div>
      )}

      {/* ── Danger Zone ── */}
      {tab === "danger" && (
        <div className="space-y-4">

          {/* Deactivate */}
                    <div className="rounded-xl border border-amber-500 bg-white dark:bg-background px-5 py-4 space-y-3">
            <div>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Deactivate account</p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 leading-relaxed">
                Your profile will be hidden and you won't be able to sign in. Reactivation requires contacting the Impact Natives team.
              </p>
            </div>
            {!deactivateConfirm ? (
              <Button type="button" variant="outline"
                onClick={() => setDeactivateConfirm(true)}
                className="rounded-full px-5 h-9 text-sm border-amber-300 text-amber-800 hover:bg-amber-100">
                Deactivate account
              </Button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-amber-800 font-medium">Are you sure? This cannot be undone without contacting us.</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setDeactivateConfirm(false)}
                    style={{ flex: 1, height: "36px", borderRadius: "9999px", border: "1px solid #92400e", color: "#92400e", background: "transparent", fontSize: "14px", cursor: "pointer" }}>
                    Cancel
                  </button>
                  <button type="button" onClick={deactivateAccount} disabled={deactivating}
                    style={{ flex: 1, height: "36px", borderRadius: "9999px", background: "#b45309", color: "white", fontSize: "14px", fontWeight: 500, cursor: "pointer", opacity: deactivating ? 0.5 : 1 }}>
                    {deactivating ? "..." : "Yes, deactivate"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Delete */}
          <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 px-5 py-4 space-y-3">
            <div>
              <p className="text-sm font-semibold text-red-700 dark:text-red-400">Delete account</p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-1 leading-relaxed">
                Permanently deletes your account, profile, initiatives, and all associated data. This cannot be undone.
              </p>
            </div>
            {!deleteConfirm ? (
              <Button type="button" variant="outline"
                onClick={() => setDeleteConfirm(true)}
                className="rounded-full px-5 h-9 text-sm border-red-300 text-red-600 hover:bg-red-100">
                Delete account
              </Button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-red-700 font-medium">
                  Type <span className="font-bold">DELETE</span> to confirm.
                </p>
                <input
                  type="text"
                  value={deleteInput}
                  onChange={(e) => setDeleteInput(e.target.value)}
                  placeholder="DELETE"
                  className="w-full h-10 rounded-lg border border-red-300 bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
                />
                {deleteError && <p className="text-xs text-red-500">{deleteError}</p>}
                <div className="flex gap-2">
                  <button type="button" onClick={() => { setDeleteConfirm(false); setDeleteInput(""); setDeleteError(null); }}
                    style={{ flex: 1, height: "36px", borderRadius: "9999px", border: "1px solid #b91c1c", color: "#b91c1c", background: "transparent", fontSize: "14px", cursor: "pointer" }}>
                    Cancel
                  </button>
                  <button type="button" onClick={deleteAccount} disabled={deleteInput !== "DELETE" || deleting}
                    style={{ flex: 1, height: "36px", borderRadius: "9999px", background: "#dc2626", color: "white", fontSize: "14px", fontWeight: 500, cursor: "pointer", opacity: (deleteInput !== "DELETE" || deleting) ? 0.4 : 1 }}>
                    {deleting ? "..." : "Delete permanently"}
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      )}
    </div>

    {/* Right column */}
    <div className="space-y-4" style={{top: "10rem" }}>
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {currentHelp.title}
        </p>
        <div className="space-y-3">
          {currentHelp.items.map((item, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2D6A4F] shrink-0 mt-1.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">{item}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Quick links</p>
        <a href="/dashboard/profile" className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-1">
          <span className="w-1 h-1 rounded-full bg-[#C45C26] shrink-0" />
          Edit your profile
        </a>
        {profile?.user_type === "organisation" && (
          <a href="/verification-standard" className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-1">
            <ArrowRight className="w-3 h-3 text-[#2D6A4F]" />
            Verification standards
          </a>
        )}
        {profile?.user_type !== "organisation" && (
          <>
            <a href="/dashboard/marketplace" className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-1">
              <ArrowRight className="w-3 h-3 text-[#2D6A4F]" />
              Browse the marketplace
            </a>
            <a href="/dashboard/natives?tab=organisation" className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-1">
              <ArrowRight className="w-3 h-3 text-[#2D6A4F]" />
              Browse organisations
            </a>
          </>
        )}
        <a href="/dashboard/natives" className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-1">
          <span className="w-1 h-1 rounded-full bg-[#C45C26] shrink-0" />
          View directory
        </a>
      </div>
    </div>
    </div>
  );
}