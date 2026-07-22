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

type NavItem = { label: string; href: string; icon: any; corporateOnly: boolean };

// Grouped by actual usage pattern, not alphabetically: Home stands alone as
// the entry point (label: null renders no header text); Discover is
// browsing what others listed; My Work is things this account builds or
// manages; Connect is the relationship layer; Account is profile/settings,
// last.
const NAV_SECTIONS: { label: string | null; accent?: string; items: NavItem[] }[] = [
  {
    label: null,
    items: [
      { label: "Home", href: "/dashboard", icon: Home, corporateOnly: false },
    ],
  },
  {
    label: "Discover",
    accent: "#185FA5",
    items: [
      { label: "Marketplace", href: "/dashboard/marketplace", icon: Compass, corporateOnly: false },
      { label: "Natives", href: "/dashboard/natives", icon: Globe, corporateOnly: false },
    ],
  },
  {
    label: "My Work",
    accent: "#C45C26",
    items: [
      { label: "Strategy", href: "/dashboard/strategy", icon: Sparkles, corporateOnly: true },
      { label: "Portfolio", href: "/dashboard/portfolio", icon: Lightbulb, corporateOnly: false },
      { label: "Labs", href: "/dashboard/labs", icon: FlaskConical, corporateOnly: false },
    ],
  },
  {
    label: "Connect",
    accent: "#2D6A4F",
    items: [
      { label: "Partnerships", href: "/dashboard/partnerships", icon: Handshake, corporateOnly: false },
      { label: "Messages", href: "/dashboard/messages", icon: MessageSquare, corporateOnly: false },
    ],
  },
  {
    label: "Account",
    accent: "#6B4C8A",
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
  const { profile, signOut } = useAuth();
  console.log("Sidebar profile:", profile?.user_type, profile?.org_name, profile?.full_name);
  const [collapsed, setCollapsed] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);

  const isCorporate = ["corporation", "technology_company", "public_sector"].includes(profile?.org_type ?? "");
  const visibleSections = NAV_SECTIONS
    .map(section => ({ ...section, items: section.items.filter(item => !item.corporateOnly || isCorporate) }))
    .filter(section => section.items.length > 0);

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
      "fixed left-0 top-0 h-screen flex flex-col z-40 transition-all duration-200 border-r border-border relative",
      "bg-gradient-to-b from-[#C1633B] via-[#A84A2C] to-[#7A331C]",
      "dark:from-[#3A2418] dark:via-[#2A1810] dark:to-[#1A0F0A]",
      collapsed ? "w-16" : "w-56"
    )}
    >
      {/* Grain texture overlay — sits behind all real content since it's
          the first child painted in this stacking context. Colour-neutral
          SVG noise with mix-blend so it reads correctly over both the
          light and dark gradients without any theme-detection logic. */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[1.00] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />
      {/* Brand + toggle */}
      <div className="px-3 py-5 shrink-0 flex items-center justify-between">
        {!collapsed && (
          <img src="/logo.png" alt="Impact Natives" className="h-10 w-auto" />
        )}
        <button
          onClick={toggle}
          className="ml-auto p-1 rounded-md text-black hover:bg-muted transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Nav */}
      <style>{`
        .sidebar-nav-scroll::-webkit-scrollbar { width: 5px; }
        .sidebar-nav-scroll::-webkit-scrollbar-track { background: transparent; }
        .sidebar-nav-scroll::-webkit-scrollbar-thumb {
          background: rgba(0,0,0,0.18);
          border-radius: 999px;
          border: 1px solid transparent;
          background-clip: padding-box;
        }
        .sidebar-nav-scroll { scrollbar-width: thin; scrollbar-color: rgba(0,0,0,0.18) transparent; }
      `}</style>
      <nav className="sidebar-nav-scroll flex-1 overflow-y-auto py-4 px-2 pr-1">
        {visibleSections.map((section, sectionIndex) => (
          <div key={section.label ?? "home"} className={sectionIndex > 0 ? "mt-3 pt-3 border-t border-border" : ""}>
            {section.label && !collapsed && (
              <p
                className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5"
                style={{ color: section.accent }}
              >
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: section.accent }} />
                {section.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {section.items.map(({ label, href, icon: Icon }) => {
                const isMessages = href === "/dashboard/messages";
                const showBadge  = isMessages && unreadMessages > 0;
                return (
                  <li key={href}>
                    <Link href={href}>
                      <span
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors cursor-pointer w-full",
                          collapsed && "justify-center px-2",
                          isActive(href)
                            ? "bg-[#C45C26]/10 text-[#C45C26]"
                            : "text-black hover:bg-muted"
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
              <p className="text-[10px] font-semibold text-foreground truncate">
                {profile?.user_type === "organisation"
                  ? (profile?.org_name || "Your Organisation")
                  : (profile?.full_name || "Your Account")}
              </p>
              <p className="text-[11px] text-black truncate mt-0.5">
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
            profile?.is_verified ? "text-[#2D6A4F]" : "text-black"
          )} />
          <span className={cn(
            "text-[11px]",
            profile?.is_verified ? "text-[#2D6A4F] font-medium" : "text-black"
          )}>
            {profile?.is_verified ? "Verified" : "Unverified"}
          </span>
        </div>
      )}

        {!collapsed && (
          <a
            href="https://www.impactnatives.com/legal/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="block text-[11px] text-black hover:underline underline-offset-2 transition-colors"
          >
            Privacy Policy
          </a>
        )}

        <button
          type="button"
          onClick={signOut}
          className={cn(
            "flex items-center gap-2 text-[11px] text-black hover:opacity-70 transition-opacity w-full",
            collapsed && "justify-center"
          )}
          title={collapsed ? "Sign out" : undefined}
        >
          <LogOut className="w-3.5 h-3.5 text-black" />
          {!collapsed && "Sign out"}
        </button>
      </div>
    </aside>
  );
}