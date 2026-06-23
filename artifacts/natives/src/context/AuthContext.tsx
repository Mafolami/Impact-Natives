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
    sectors: string[] | null;
    org_type: string | null;
    onboarding_completed: boolean | null;
    verification_requested: boolean | null;
    user_type: string | null;
    is_verified: boolean | null;
    is_admin: boolean | null;
    investment_thesis: string | null;
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
        
      if (data) setProfile(data as Profile);
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
      } = supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchProfile(session.user.id);
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