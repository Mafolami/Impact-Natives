import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import {
  Home, Handshake, Lightbulb, FlaskConical, Compass,
  MessageSquare, User, Settings, LogOut, ShieldCheck,
  ChevronLeft, ChevronRight, Globe, Sparkles,
} from "lucide-react";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { cn } from "@/lib/utils";

const ALL_NAV_ITEMS = [
  { label: "Home",         href: "/dashboard",                icon: Home,          corporateOnly: false },
  { label: "Strategy",     href: "/dashboard/strategy",       icon: Sparkles,      corporateOnly: true  },
  { label: "Portfolio",    href: "/dashboard/portfolio",      icon: Lightbulb,     corporateOnly: false },
  { label: "Marketplace",  href: "/dashboard/marketplace",    icon: Compass,       corporateOnly: false },
  { label: "Partnerships", href: "/dashboard/partnerships",   icon: Handshake,     corporateOnly: false },
  { label: "Labs",         href: "/dashboard/labs",           icon: FlaskConical,  corporateOnly: false },
  { label: "Natives",      href: "/dashboard/natives",        icon: Globe,         corporateOnly: false },
  { label: "Messages",     href: "/dashboard/messages",       icon: MessageSquare, corporateOnly: false },
  { label: "Profile",      href: "/dashboard/profile",        icon: User,          corporateOnly: false },
  { label: "Settings",     href: "/dashboard/settings",       icon: Settings,      corporateOnly: false },
];

interface SidebarProps {
  onCollapse?: (collapsed: boolean) => void;
}

export default function Sidebar({ onCollapse }: SidebarProps) {
  const [location] = useLocation();
  const { profile, signOut } = useAuth();
  console.log("Sidebar profile:", profile?.user_type, profile?.org_name, profile?.full_name);
  const [collapsed, setCollapsed] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);

  const isCorporate = ["corporation", "technology_company", "public_sector"].includes(profile?.org_type ?? "");
  const NAV_ITEMS = ALL_NAV_ITEMS.filter(item => !item.corporateOnly || isCorporate);

  useEffect(() => {
    if (!profile) return;

    async function fetchUnread() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Pending EOIs on my initiatives
      const { data: myInits } = await supabase
        .from("initiative_requests")
        .select("id")
        .eq("user_id", user.id);
      const myInitIds = (myInits ?? []).map((i: any) => i.id);

      let pendingEoiCount = 0;
      if (myInitIds.length > 0) {
        const { data: eois } = await supabase
          .from("expressions_of_interest")
          .select("conversation_id")
          .in("initiative_id", myInitIds)
          .neq("user_id", user.id);
        const convoIds = (eois ?? []).map((e: any) => e.conversation_id).filter(Boolean);
        if (convoIds.length > 0) {
          const { data: pendingConvos } = await supabase
            .from("conversations")
            .select("id")
            .in("id", convoIds)
            .eq("status", "pending");
          pendingEoiCount = (pendingConvos ?? []).length;
        }
      }

    // Also count question conversations with unread messages
      if (myInitIds.length > 0) {
        const { data: questionConvos } = await supabase
          .from("conversations")
          .select("id")
          .in("initiative_id", myInitIds)
          .eq("conversation_type", "question")
          .eq("status", "open");
        const questionConvoIds = (questionConvos ?? []).map((c: any) => c.id);
        if (questionConvoIds.length > 0) {
          const { data: unreadMsgs } = await supabase
            .from("messages")
            .select("id")
            .in("conversation_id", questionConvoIds)
            .neq("sender_id", user.id)
            .is("read_at", null);
          pendingEoiCount += (unreadMsgs ?? []).length > 0 ? (unreadMsgs ?? []).length : 0;
        }
      }

      // Also count unread messages in open conversations where last msg is not from me
      const { data: myConvos } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", user.id);
      const myConvoIds = (myConvos ?? []).map((c: any) => c.conversation_id).filter(Boolean);
      if (myConvoIds.length > 0) {
        const { data: openConvos } = await supabase
          .from("conversations")
          .select("id")
          .in("id", myConvoIds)
          .eq("status", "open")
          .is("funder_closed_at", null);
        const openConvoIds = (openConvos ?? []).map((c: any) => c.id);
        if (openConvoIds.length > 0) {
          const { data: unreadMsgs } = await supabase
            .from("messages")
            .select("id")
            .in("conversation_id", openConvoIds)
            .neq("sender_id", user.id)
            .is("read_at", null);
          pendingEoiCount += (unreadMsgs ?? []).length;
        }
      }

      setUnreadMessages(pendingEoiCount);
    }

    fetchUnread();

    const interval = setInterval(fetchUnread, 30000);

    // Real-time: new EOI or message triggers immediate recount
    const channel = supabase
      .channel("sidebar-unread")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "expressions_of_interest" }, fetchUnread)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, fetchUnread)
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [profile]);

  // Clear badge when user visits messages
  useEffect(() => {
    if (location === "/dashboard/messages" || location.startsWith("/dashboard/messages")) {
      setUnreadMessages(0);
    }
  }, [location]);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    onCollapse?.(next);
  }

  function isActive(href: string) {
    if (href === "/dashboard") return location === "/dashboard";
    return location.startsWith(href);
  }

  return (
    <aside
    className={cn(
      "fixed left-0 top-0 h-screen flex flex-col z-40 transition-all duration-200 border-r bg-card border-border",
      collapsed ? "w-16" : "w-56"
    )}
    >
      {/* Brand + toggle */}
      <div className="px-3 py-5 shrink-0 flex items-center justify-between">
        {!collapsed && (
          <img src="/logo.png" alt="Impact Natives" className="h-10 w-auto" />
        )}
        <button
          onClick={toggle}
          className="ml-auto p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map(({ label, href, icon: Icon, corporateOnly: _ }) => {
            const isMessages = href === "/dashboard/messages";
            const showBadge  = isMessages && unreadMessages > 0;
            return (
              <li key={href}>
                <Link href={href}>
                  <span
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer w-full",
                      collapsed && "justify-center px-2",
                      isActive(href)
                        ? "bg-[#C45C26]/10 text-[#C45C26]"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                    title={collapsed ? label : undefined}
                  >
                                        <span className="relative">
                      <Icon className="w-4 h-4 shrink-0" />
                      {showBadge && collapsed && (
                        <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500" />
                      )}
                    </span>
                    {!collapsed && (
                      <>
                        <span className="flex-1">{label}</span>
                        {showBadge && (
                                                    <span className="text-[10px] font-bold rounded-full min-w-[1rem] h-4 px-1 flex items-center justify-center" style={{ background: "#ef4444", color: "#ffffff" }}>
                            {unreadMessages > 9 ? "9+" : unreadMessages}
                          </span>
                        )}
                      </>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Bottom */}
      <div className="border-t border-border px-3 py-4 shrink-0 space-y-3">
                {!collapsed && (
          <div className="flex items-center gap-2">
            <UserAvatar
              id={profile?.id ?? ""}
              name={profile?.user_type === "organisation" ? (profile?.org_name || profile?.full_name) : profile?.full_name}
              avatarUrl={profile?.user_type === "organisation" ? profile?.logo_url : profile?.avatar_url}
              size="sm"
            />
                <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">
                {profile?.user_type === "organisation"
                  ? (profile?.org_name || "Your Organisation")
                  : (profile?.full_name || "Your Account")}
              </p>
              <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                {profile?.user_type === "organisation"
                  ? (profile?.org_type
                      ? profile.org_type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())
                      : "Organisation")
                  : "Individual"}
              </p>
            </div>
          </div>
        )}

        {collapsed && (
          <div className="flex justify-center">
            <UserAvatar
              id={profile?.id ?? ""}
              name={profile?.user_type === "organisation" ? (profile?.org_name || profile?.full_name) : profile?.full_name}
              avatarUrl={profile?.user_type === "organisation" ? profile?.logo_url : profile?.avatar_url}
              size="sm"
            />
          </div>
        )}
{!collapsed && profile?.user_type === "organisation" && (
        <div className="flex items-center gap-1.5">
          <ShieldCheck className={cn(
            "w-3.5 h-3.5",
            profile?.is_verified ? "text-[#2D6A4F]" : "text-muted-foreground"
          )} />
          <span className={cn(
            "text-[10px]",
            profile?.is_verified ? "text-[#2D6A4F] font-medium" : "text-muted-foreground"
          )}>
            {profile?.is_verified ? "Verified" : "Unverified"}
          </span>
        </div>
      )}

        <button
          type="button"
          onClick={signOut}
          className={cn(
            "flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full",
            collapsed && "justify-center"
          )}
          title={collapsed ? "Sign out" : undefined}
        >
          <LogOut className="w-3.5 h-3.5" />
          {!collapsed && "Sign out"}
        </button>
      </div>
    </aside>
  );
}