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
    // Check if this is a password recovery link by inspecting the URL hash
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.replace("#", "?"));
    const type = params.get("type");

    if (type === "recovery") {
      navigate("/reset-password");
      return;
    }

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
    return () => subscription.unsubscribe();
  }, [navigate]);

  return (
    <div className="light min-h-screen flex items-center justify-center" style={{ background: "#F7F5F2" }}>
      <div className="text-center">
        <Loader2 className="w-6 h-6 text-[#2D6A4F] animate-spin mx-auto mb-3" />
        <p className="text-sm text-gray-500">Signing you in…</p>
      </div>
    </div>
  );
}