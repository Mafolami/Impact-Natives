import { useEffect } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";

export default function AuthCallback() {
  const [, navigate] = useLocation();

  useEffect(() => {
    async function handleCallback() {
      const searchParams = new URLSearchParams(window.location.search);
      const tokenHash = searchParams.get("token_hash");
      const type = searchParams.get("type") as any;

      const hash = window.location.hash;
      const hashParams = new URLSearchParams(hash.replace("#", "?"));
      const hashType = hashParams.get("type");

      if (hashType === "recovery") {
        navigate("/reset-password");
        return;
      }

      // Email confirmation via token_hash
      if (tokenHash && type) {
        const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
        if (error) {
          navigate("/signin");
          return;
        }
        if (data.session) {
          // Carried from signUp()'s user_metadata (see AuthContext.tsx) --
          // this is what survives the confirmation link opening in a new
          // tab, where sessionStorage from the original tab isn't visible.
          // Writing it back into this tab's sessionStorage means
          // Onboarding.tsx's existing getRedirectPath() picks it up
          // unchanged once onboarding finishes, with no change needed there.
          const pendingRedirect = (data.session.user.user_metadata as any)?.redirect_after_signup as string | undefined;
          if (pendingRedirect) sessionStorage.setItem("redirectAfterAuth", pendingRedirect);
          const { data: profile } = await supabase
            .from("profiles")
            .select("onboarding_completed")
            .eq("id", data.session.user.id)
            .single();
          navigate(profile?.onboarding_completed ? (pendingRedirect || "/dashboard") : "/onboarding");
          return;
        }
      }

      // Fallback — check existing session (Google OAuth etc.)
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const redirect = sessionStorage.getItem("redirectAfterAuth");
        if (redirect) sessionStorage.removeItem("redirectAfterAuth");
        const { data: profile } = await supabase
          .from("profiles")
          .select("onboarding_completed")
          .eq("id", session.user.id)
          .single();
        navigate(profile?.onboarding_completed ? (redirect || "/dashboard") : "/onboarding");
        return;
      }

      // No session yet — wait for auth state change
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === "PASSWORD_RECOVERY") {
          subscription.unsubscribe();
          navigate("/reset-password");
        } else if (event === "SIGNED_IN" && session) {
          subscription.unsubscribe();
          const redirect = sessionStorage.getItem("redirectAfterAuth");
          if (redirect) sessionStorage.removeItem("redirectAfterAuth");
          const { data: profile } = await supabase
            .from("profiles")
            .select("onboarding_completed")
            .eq("id", session.user.id)
            .single();
          navigate(profile?.onboarding_completed ? (redirect || "/dashboard") : "/onboarding");
        } else if (event === "SIGNED_OUT") {
          subscription.unsubscribe();
          navigate("/signin");
        }
      });

      return () => subscription.unsubscribe();
    }

    handleCallback();
  }, [navigate]);

  return (
    <div style={{ background: "#F7F5F2", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3" style={{ color: "#2D6A4F" }} />
        <p style={{ fontSize: "0.875rem", color: "#6b7280" }}>Signing you in…</p>
      </div>
    </div>
  );
}