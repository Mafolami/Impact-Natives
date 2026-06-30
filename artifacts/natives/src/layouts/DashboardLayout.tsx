import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import Sidebar from "@/components/dashboard/Sidebar"; 
import Topbar from "@/components/dashboard/Topbar";
import { Loader2 } from "lucide-react";

export default function DashboardLayout({ children, adminOnly }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { user, profile, loading, signOut } = useAuth();
  const [, navigate] = useLocation();
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
    if (adminOnly) {
      if (profile && !profile.is_admin) navigate("/dashboard");
      return undefined;
    }
    if (profile && !profile.onboarding_completed) {
      navigate("/onboarding");
    }
    return undefined;
  }, [user, profile, loading, navigate, adminOnly]);

  if (loading || !user || (user && !profile)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-[#2D6A4F] animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar onCollapse={setCollapsed} />
      <div className={cn(
        "flex flex-col flex-1 min-w-0 overflow-x-hidden transition-all duration-200",
        collapsed ? "ml-16" : "ml-56"
      )}>
        <Topbar sidebarCollapsed={collapsed} />
        <main className="flex-1 pt-14">
          <div className="px-12 py-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}