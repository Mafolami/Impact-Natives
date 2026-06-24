import { useEffect } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";

/**
 * Handles the OAuth redirect from Google.
 * Supabase processes the URL hash/params automatically; we just
 * wait for the session then redirect appropriately.
 */
export default function AuthCallback() {
  const [, navigate] = useLocation();
  useEffect(() => {
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.replace("#", "?"));
    const type = params.get("type");

    if (type === "recovery") {
      navigate("/reset-password");
      return;
    }

    // Check for existing session immediately — token may already be processed
    async function checkSession() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const redirect = sessionStorage.getItem("redirectAfterAuth");
        if (redirect) sessionStorage.removeItem("redirectAfterAuth");
        const { data: profile } = await supabase
          .from("profiles")
          .select("onboarding_completed")
          .eq("id", session.user.id)
          .single();
        if (!profile?.onboarding_completed) {
          navigate("/onboarding");
        } else {
          navigate(redirect || "/dashboard");
        }
        return true;
      }
      return false;
    }

    checkSession().then(handled => {
      if (handled) return;

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
        if (!profile?.onboarding_completed) {
          navigate("/onboarding");
        } else {
          navigate(redirect || "/dashboard");
        }
      } else if (event === "SIGNED_OUT") {
        subscription.unsubscribe();
        navigate("/signin");
      }
    });
      // Store subscription cleanup
      return () => subscription.unsubscribe();
    });
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