import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import {
  Home, Handshake, Lightbulb, FlaskConical, Compass,
  MessageSquare, User, Settings, LogOut, ShieldCheck,
  ChevronLeft, ChevronRight, Globe, Sparkles, FileText, Target,
} from "lucide-react";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { cn } from "@/lib/utils";

type NavItem = { label: string; href?: string; icon: any; corporateOnly: boolean; children?: NavItem[]; groupLabel?: string };

// Three sections: Home stands alone (label: null renders no header text --
// it's the one place people return to constantly and doesn't need a
// label). Discover covers everything browsed or built. Account is
// identity/settings, last. No accent colour per section -- just a plain
// label, kept subtle with spacing rather than colour.
const NAV_SECTIONS: { label: string | null; items: NavItem[] }[] = [
  {
    label: null,
    items: [
      { label: "Home", href: "/dashboard", icon: Home, corporateOnly: false },
    ],
  },
  {
    label: "Discover",
    items: [
      { label: "Strategy", href: "/dashboard/strategy", icon: Sparkles, corporateOnly: true },
      { label: "Marketplace", href: "/dashboard/marketplace", icon: Compass, corporateOnly: false },
      { label: "Partnerships", href: "/dashboard/partnerships", icon: Handshake, corporateOnly: false },
      { label: "Exchanges", href: "/dashboard/portfolio/exchanges", icon: Lightbulb, corporateOnly: false, groupLabel: "Portfolio" },
      { label: "MoUs", href: "/dashboard/portfolio/mou", icon: FileText, corporateOnly: false, groupLabel: "Portfolio" },
      { label: "Milestones", href: "/dashboard/portfolio/milestones", icon: Target, corporateOnly: false, groupLabel: "Portfolio" },
      { label: "Messages", href: "/dashboard/messages", icon: MessageSquare, corporateOnly: false },
      { label: "Labs", href: "/dashboard/labs", icon: FlaskConical, corporateOnly: false },
      { label: "Natives", href: "/dashboard/natives", icon: Globe, corporateOnly: false },
    ],
  },
  {
    label: "Account",
    items: [
      { label: "Profile", href: "/dashboard/profile", icon: User, corporateOnly: false },
      { label: "Settings", href: "/dashboard/settings", icon: Settings, corporateOnly: false },
    ],
  },
];

interface SidebarProps {
  onCollapse?: (collapsed: boolean) => void;
}

export default function Sidebar({ onCollapse }: SidebarProps) {
  const [location] = useLocation();
  const { profile, signOut, orgOwnerId } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
 
const isCorporate = ["corporation", "technology_company", "public_sector"].includes(profile?.org_type ?? "");
  const visibleSections = NAV_SECTIONS
    .map(section => ({ ...section, items: section.items.filter(item => !item.corporateOnly || isCorporate) }))
    .filter(section => section.items.length > 0);

  useEffect(() => {
    if (!profile || !orgOwnerId) return;

    async function fetchUnread() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !orgOwnerId) return;

      // Pending EOIs on my initiatives
      const { data: myInits } = await supabase
        .from("initiative_requests")
        .select("id")
        .eq("user_id", orgOwnerId);
      const myInitIds = (myInits ?? []).map((i: any) => i.id);

      let pendingEoiCount = 0;
      if (myInitIds.length > 0) {
        const { data: eois } = await supabase
          .from("expressions_of_interest")
          .select("conversation_id")
          .in("initiative_id", myInitIds)
          .neq("user_id", orgOwnerId);
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
  }, [profile, orgOwnerId]);

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
      "fixed left-0 top-0 h-screen flex flex-col z-40 transition-all duration-200 border-r border-sidebar-border bg-sidebar",
      collapsed ? "w-16" : "w-72"
    )}
    >
      
      {/* Brand + toggle — solid, same treatment as the footer, so the logo
          sits on a flat dark ground instead of competing with the
          gradient/texture behind the nav items. */}
      <div className="px-3 py-5 shrink-0 flex items-center justify-between bg-sidebar border-b border-sidebar-border">
        {!collapsed && (
          <img src="/logo.png" alt="Impact Natives" className="h-10 w-auto" />
        )}
        <button
          onClick={toggle}
          className="ml-auto p-1 rounded-md text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Nav */}
      <style>{`
        .sidebar-nav-scroll::-webkit-scrollbar { width: 3px; }
        .sidebar-nav-scroll::-webkit-scrollbar-track { background: transparent; }
        .sidebar-nav-scroll::-webkit-scrollbar-thumb {
          background: hsl(var(--sidebar-foreground) / 0.25);
          border-radius: 999px;
        }
        .sidebar-nav-scroll { scrollbar-width: thin; scrollbar-color: hsl(var(--sidebar-foreground) / 0.25) transparent; }
      `}</style>
      <nav className="sidebar-nav-scroll flex-1 overflow-y-auto py-4 pl-4 pr-1">
        {visibleSections.map((section, sectionIndex) => (
          <div key={section.label ?? "home"} className={sectionIndex > 0 ? "mt-5" : ""}>
            {section.label && !collapsed && (
              <p className="px-3 mb-2 text-[10.5px] font-bold uppercase tracking-wider text-sidebar-foreground/60">
                {section.label}
              </p>
            )}
            <ul className="space-y-1.5">
            {section.items.map((item, itemIndex) => {
                const { label, href, icon: Icon, groupLabel } = item;
                const isMessages = href === "/dashboard/messages";
                const showBadge  = isMessages && unreadMessages > 0;
                const isFirstInGroup = !!groupLabel && section.items[itemIndex - 1]?.groupLabel !== groupLabel;
                return (
                  <li key={href}>
                    {groupLabel && isFirstInGroup && !collapsed && (
                      <p className="px-3 mt-3 mb-1 text-[10.5px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                        {groupLabel}
                      </p>
                    )}
                    <Link href={href!}>
                      <span
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-[12px] font-medium transition-colors cursor-pointer w-full",
                          collapsed && "justify-center px-2",
                          isActive(href!)
                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                            : "text-sidebar-foreground hover:bg-sidebar-accent"
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
          </div>
        ))}
      </nav>

      {/* Bottom — deliberately a solid, darker tone distinct from the nav's
          gradient, so it reads as its own footer zone rather than a
          continuation of the scrollable nav area above it. */}
      <div className="border-t border-sidebar-border px-3 py-3 shrink-0 space-y-2 bg-sidebar">                
      {!collapsed && (
          <div className="flex items-center gap-2">
            <UserAvatar
              id={profile?.id ?? ""}
              name={profile?.user_type === "organisation" ? (profile?.org_name || profile?.full_name) : profile?.full_name}
              avatarUrl={profile?.user_type === "organisation" ? profile?.logo_url : profile?.avatar_url}
              size="sm"
            />
                <div className="min-w-0">
              <p className="flex items-center gap-1 text-[10px] font-semibold text-sidebar-foreground truncate">
                {profile?.user_type === "organisation" && profile?.is_verified && (
                  <ShieldCheck className="w-3 h-3 text-[#6FCF9E] shrink-0" />
                )}
                <span className="truncate">
                  {profile?.user_type === "organisation"
                    ? (profile?.org_name || "Your Organisation")
                    : (profile?.full_name || "Your Account")}
                </span>
              </p>
              <p className="text-[11px] text-sidebar-foreground/60 truncate mt-0.5">
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


        {!collapsed && (
          <a
            href="https://www.impactnatives.com/legal/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="block text-[11px] text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors"
          >
            Privacy Policy
          </a>
        )}

        <button
          type="button"
          onClick={signOut}
          className={cn(
            "flex items-center gap-2 text-[11px] text-sidebar-foreground hover:opacity-70 transition-opacity w-full",
            collapsed && "justify-center"
          )}
          title={collapsed ? "Sign out" : undefined}
        >
          <LogOut className="w-3.5 h-3.5 text-sidebar-foreground" />
          {!collapsed && "Sign out"}
        </button>
      </div>
    </aside>
  );
}