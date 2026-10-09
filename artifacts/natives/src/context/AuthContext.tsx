import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

// Sign a user out after this many ms with no mouse/keyboard/touch/scroll
// activity. 12 hours by default -- easy to change, this is the only place
// it's defined.
const INACTIVITY_LIMIT_MS = 12 * 60 * 60 * 1000;
const LAST_ACTIVITY_KEY = "lastActivityAt";

function recordActivity() {
  try { localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now())); } catch { /* ignore */ }
}

// 0 (never idle) until the first real activity timestamp exists -- a
// session that predates this feature shipping doesn't get force-logged-out
// the instant it ships; the clock only starts once there's real data.
function getIdleMs(): number {
  try {
    const stored = localStorage.getItem(LAST_ACTIVITY_KEY);
    if (!stored) return 0;
    return Date.now() - Number(stored);
  } catch {
    return 0;
  }
}

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  country: string | null;
  bio: string | null;
  org_name: string | null;
  role_title: string | null;
  phone: string | null;
  linkedin_url: string | null;
  website: string | null;
  social_links: { label: string; url: string }[] | null;
  avatar_url: string | null;
  logo_url: string | null;
  sectors: string[] | null;
  org_type: string | null;
  onboarding_completed: boolean | null;
  verification_requested: boolean | null;
  user_type: string | null;
  is_verified: boolean | null;
  // Not selected by fetchProfile (Phase D: authenticated's read grant
  // on these two is restricted; not sensitive fields the app displays).
  verification_rejection_reason?: string | null;
  verification_rejected_at?: string | null;
  // Not selected by fetchProfile (Phase D: authenticated's read grant
  // on this column is restricted to self-only; DashboardLayout.tsx uses
  // the is_admin() RPC instead of reading it from context).
  is_admin?: boolean | null;
  // The six fields below were never actual columns on `profiles`
  // (confirmed against the database -- they belong to `organizations`).
  // Always undefined in practice; marked optional to match reality.
  investment_thesis?: string | null;
  // Not selected by fetchProfile (Phase D).
  login_count?: number | null;
  registration_type?: string | null;
  registration_number?: string | null;
  tin?: string | null;
  scuml_number?: string | null;
  year_founded?: number | null;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  // Resolves once per session: an Owner's own user id, or -- if the
  // signed-in user is an active Team Member instead -- their Owner's
  // user id. Nothing that resolves "my org" should ever read user.id
  // directly again; this is what makes that safe once Team invites are
  // live, without changing behavior at all for the vast majority of
  // users who are Owners (orgOwnerId === user.id for them).
  orgOwnerId: string | null;
  // True when this user has an org_members row with status='pending' for
  // any org -- i.e. they've been invited to a team but haven't accepted
  // yet. A brand-new invited account has no organizations row of their
  // own and hasn't onboarded, so without this flag DashboardLayout's
  // onboarding gate would force them into the individual/organisation
  // onboarding flow before they can ever reach Settings > Team to accept.
  hasPendingInvite: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, redirectPath?: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshOrgOwnerId: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Am I an Owner (an organizations row exists under my own user_id), or an
// active Member of someone else's org (org_members -> organizations)?
// Falls back to the caller's own id if neither applies yet -- onboarding
// incomplete, an invite still pending, or a non-organisation account --
// so nothing downstream is ever blocked by a Team check that doesn't
// apply to them. Matches the join pattern already used by the
// is_org_member/is_member_of_owner Postgres helpers.
async function resolveOrgOwnerId(userId: string): Promise<string> {
  const { data: ownedOrg } = await supabase
    .from("organizations")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (ownedOrg) return userId;

  const { data: membership } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (membership?.org_id) {
    const { data: org } = await supabase
      .from("organizations")
      .select("user_id")
      .eq("id", membership.org_id)
      .maybeSingle();
    if (org?.user_id) return org.user_id;
  }

  return userId;
}

async function checkPendingInvite(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("org_members")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "pending")
    .limit(1)
    .maybeSingle();
  return !!data;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [orgOwnerId, setOrgOwnerId] = useState<string | null>(null);
  const [hasPendingInvite, setHasPendingInvite] = useState(false);
  const [loading, setLoading] = useState(true);

  async function fetchProfile(userId: string) {
    // Explicit column list, not "*" -- Postgres requires SELECT privilege
    // on every column of a table to satisfy a wildcard select, and the
    // six sensitive columns intentionally excluded here have their
    // authenticated grant restricted (Phase D). None of them are read
    // from the profile context anywhere in the app.
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, country, bio, org_name, role_title, phone, linkedin_url, website, avatar_url, created_at, updated_at, sectors, org_type, feed_visibility, onboarding_completed, verification_requested, user_type, is_verified, social_links, is_active, notification_preferences, show_individual_profile, subscription_tier, subscription_status, subscription_provider, subscription_current_period_end")
      .eq("id", userId)
      .single();
    if (!data) return;
    let logoUrl: string | null = null;
    if (data.user_type === "organisation") {
      const { data: org } = await supabase
        .from("organizations")
        .select("logo_url")
        .eq("user_id", userId)
        .maybeSingle();
      logoUrl = org?.logo_url ?? null;
    }
    setProfile({ ...data, logo_url: logoUrl } as Profile);
  }

  async function fetchOrgOwnerId(userId: string) {
    const [resolved, pending] = await Promise.all([
      resolveOrgOwnerId(userId),
      checkPendingInvite(userId),
    ]);
    setOrgOwnerId(resolved);
    setHasPendingInvite(pending);
  }

  async function refreshProfile() {
    if (user) await fetchProfile(user.id);
  }

  async function refreshOrgOwnerId() {
    if (user) await fetchOrgOwnerId(user.id);
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        // Run concurrently -- orgOwnerId is independent of profile, no
        // reason to make the initial load wait on both sequentially.
        await Promise.all([
          fetchProfile(session.user.id),
          fetchOrgOwnerId(session.user.id),
        ]);
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
        fetchOrgOwnerId(session.user.id);
        // Only a real sign-in should count — SIGNED_IN fires once per
        // actual login action, unlike INITIAL_SESSION/TOKEN_REFRESHED
        // which fire on every page load or silent token renewal.
        if (event === "SIGNED_IN") {
          // Seeds the inactivity clock (see the effect below) for a
          // genuinely fresh login -- deliberately NOT done on every
          // TOKEN_REFRESHED, which fires silently in the background on a
          // timer regardless of whether the person is actually at the
          // keyboard. Seeding here only on a real sign-in means a tab left
          // completely untouched still gets timed out even though Supabase
          // keeps refreshing its token underneath.
          recordActivity();
          supabase.rpc("increment_login_count").then(({ data: isFirstLoginToday, error }) => {
            if (error) {
              console.error("increment_login_count failed:", error);
              return;
            }
            // First login today — warm the match caches in the background.
            // Both endpoints gate on org type internally, so it's safe to
            // fire both regardless of what kind of org this is; the
            // irrelevant one just returns eligible: false quickly.
            if (isFirstLoginToday && session.access_token) {
              const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
              const authHeaders = {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
              };
              fetch(`${supabaseUrl}/functions/v1/refresh-partnership-matches`, {
                method: "POST",
                headers: authHeaders,
              }).catch(() => {});
              fetch(`${supabaseUrl}/functions/v1/refresh-initiative-matches`, {
                method: "POST",
                headers: authHeaders,
              }).catch(() => {});
            }
          });
        }
      } else {
        setProfile(null);
        setOrgOwnerId(null);
        setHasPendingInvite(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── Automatic sign-out after a long stretch of inactivity ──────────────
  // "Inactivity" means no mouse/keyboard/touch/scroll, not merely "the tab
  // is open" -- Supabase's own silent token refresh happens on a timer
  // regardless of whether anyone's there, so it's deliberately NOT treated
  // as activity (see the SIGNED_IN handler above).
  //
  // The timestamp lives in localStorage, not a plain in-memory timer, so
  // this survives the realistic case: someone closes their laptop lid
  // overnight. A suspended tab's JS timers don't reliably fire while
  // asleep, but the moment the tab wakes (visibilitychange/focus), this
  // checks the real elapsed time against the stored timestamp and signs
  // out immediately if it's been too long -- it doesn't depend on a timer
  // having survived the sleep. localStorage is also shared across tabs on
  // the same origin, so activity in one tab keeps every open tab alive,
  // and going idle signs all of them out together.
  useEffect(() => {
    if (!user) return undefined;

    const ACTIVITY_EVENTS = ["mousedown", "keydown", "scroll", "touchstart"] as const;
    // Throttled so a continuous scroll/keypress doesn't hammer localStorage.
    let throttled = false;
    function onActivity() {
      if (throttled) return;
      throttled = true;
      recordActivity();
      setTimeout(() => { throttled = false; }, 30_000);
    }
    ACTIVITY_EVENTS.forEach(evt => window.addEventListener(evt, onActivity, { passive: true }));

    function checkIdle() {
      if (getIdleMs() > INACTIVITY_LIMIT_MS) signOut();
    }
    document.addEventListener("visibilitychange", checkIdle);
    window.addEventListener("focus", checkIdle);
    const interval = setInterval(checkIdle, 5 * 60 * 1000);
    // Also check right away -- catches a session that was already stale
    // the moment this effect first attaches (e.g. a reload after the tab
    // was asleep for days).
    checkIdle();

    return () => {
      ACTIVITY_EVENTS.forEach(evt => window.removeEventListener(evt, onActivity));
      document.removeEventListener("visibilitychange", checkIdle);
      window.removeEventListener("focus", checkIdle);
      clearInterval(interval);
    };
  }, [user?.id]);

  async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error };
    if (data.user && !data.user.email_confirmed_at) {
      await supabase.auth.signOut();
      return { error: new Error("Please confirm your email before signing in. Check your inbox for a confirmation link.") };
    }
    return { error: null };
  }

  async function signUp(email: string, password: string, redirectPath?: string) {
    // redirectPath is the page a logged-out visitor was trying to reach
    // (e.g. /dashboard/marketplace/:id) before being bounced to sign up.
    // sessionStorage can't carry it across the new tab the confirmation
    // email opens in, so it rides as user_metadata on the signup instead --
    // that's attached to the auth.users row immediately and comes back on
    // the session AuthCallback.tsx gets after verifyOtp succeeds, same tab
    // or not. Omitted entirely (not even an empty value) when there's
    // nothing to carry, so an ordinary signup is unaffected.
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        ...(redirectPath ? { data: { redirect_after_signup: redirectPath } } : {}),
      },
    });
    return { error };
  }

  async function signInWithGoogle() {
    const redirectTo = `${window.location.origin}/auth/callback`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    return { error };
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        orgOwnerId,
        hasPendingInvite,
        loading,
        signIn,
        signUp,
        signInWithGoogle,
        signOut,
        refreshProfile,
        refreshOrgOwnerId,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}