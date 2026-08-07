import {
    createContext,
    useContext,
    useEffect,
    useState,
    ReactNode,
  } from "react";
  import { User, Session } from "@supabase/supabase-js";
  import { supabase } from "@/lib/supabase";
  
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
    verification_rejection_reason: string | null;
    verification_rejected_at: string | null;
    is_admin: boolean | null;
    investment_thesis: string | null;
    login_count: number | null;
    created_at: string;
    updated_at: string;
  }
  
  interface AuthContextType {
    user: User | null;
    session: Session | null;
    profile: Profile | null;
    loading: boolean;
    signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
    signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
    signInWithGoogle: () => Promise<{ error: Error | null }>;
    signOut: () => Promise<void>;
    refreshProfile: () => Promise<void>;
  }
  
  const AuthContext = createContext<AuthContextType | undefined>(undefined);
  
  export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);
  
    async function fetchProfile(userId: string) {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
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
  
    async function refreshProfile() {
      if (user) await fetchProfile(user.id);
    }
  
    useEffect(() => {
      supabase.auth.getSession().then(async ({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) await fetchProfile(session.user.id);
        setLoading(false);
      });
  
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchProfile(session.user.id);
          // Only a real sign-in should count — SIGNED_IN fires once per
          // actual login action, unlike INITIAL_SESSION/TOKEN_REFRESHED
          // which fire on every page load or silent token renewal.
          if (event === "SIGNED_IN") {
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
        }
      });
  
      return () => subscription.unsubscribe();
    }, []);
  
async function signIn(email: string, password: string) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error };
      if (data.user && !data.user.email_confirmed_at) {
        await supabase.auth.signOut();
        return { error: new Error("Please confirm your email before signing in. Check your inbox for a confirmation link.") };
      }
      return { error: null };
    }
  
    async function signUp(email: string, password: string) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
                    emailRedirectTo: `${window.location.origin}/auth/callback`,
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
          loading,
          signIn,
          signUp,
          signInWithGoogle,
          signOut,
          refreshProfile,
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