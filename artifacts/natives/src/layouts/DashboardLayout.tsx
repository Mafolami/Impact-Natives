import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import Sidebar from "@/components/dashboard/Sidebar"; 
import Topbar from "@/components/dashboard/Topbar";
import { Loader2 } from "lucide-react";

export default function DashboardLayout({ children, adminOnly }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { user, profile, loading, signOut, orgOwnerId, hasPendingInvite } = useAuth();
  const [location, navigate] = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (profile && (profile as any).is_active === false) {
      signOut().then(() => navigate("/signin?deactivated=true"));
    }
  }, [profile]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      sessionStorage.setItem("redirectAfterAuth", window.location.pathname);
      navigate("/signin");
      return undefined;
    }
    if (user && !profile && !loading) {
      const timer = setTimeout(async () => {
        const { data } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", user.id)
          .single();
        if (!data) {
          signOut();
          navigate("/signin");
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
    // A pending invite takes priority over everything else in the
    // dashboard shell -- there's nothing useful to do here (no org of
    // their own, not yet an active member of anyone else's) until they
    // accept or decline. Re-checked on every route change (location is
    // a dependency below), so this can't be bypassed by typing a
    // different dashboard URL directly.
    if (hasPendingInvite && !location.startsWith("/dashboard/settings")) {
      navigate("/dashboard/settings?tab=team");
      return undefined;
    }
    if (adminOnly) {
      if (profile && !profile.is_admin) navigate("/dashboard");
      return undefined;
    }
    // A pending invitee (hasn't accepted yet) or an active Member of
    // someone else's org (orgOwnerId resolved to someone other than
    // themself) never needs the individual/organisation onboarding flow
    // -- they're joining an existing org, not creating a profile from
    // scratch. Without this, a freshly-invited account with
    // onboarding_completed still false gets forced into /onboarding
    // before they can ever reach Settings > Team to accept.
    const isTeamJoiner = hasPendingInvite || (orgOwnerId && orgOwnerId !== user.id);
    if (profile && !profile.onboarding_completed && !isTeamJoiner) {
      navigate("/onboarding");
    }
    return undefined;
  }, [user, profile, loading, navigate, adminOnly, orgOwnerId, hasPendingInvite, location]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-[#2D6A4F] animate-spin" />
      </div>
    );
  }
  // Sidebar stays mounted once a user exists — a profile refetch or a
  // transient falsy profile no longer blanks the whole shell, only the
  // content area shows a spinner while it catches up.
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar onCollapse={setCollapsed} />
      <div className={cn(
        "flex flex-col flex-1 min-w-0 overflow-x-hidden transition-all duration-200",
        collapsed ? "ml-16" : "ml-60"
      )}>
        <Topbar sidebarCollapsed={collapsed} />
        <main className="flex-1 pt-[81px]">
          {!profile ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-5 h-5 text-[#2D6A4F] animate-spin" />
            </div>
          ) : (
            <div className="px-6 py-10">
              {children}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}