import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import {
  Home, Handshake, Lightbulb, FlaskConical, Compass,
  MessageSquare, User, Settings, LogOut, ShieldCheck,
  ChevronLeft, ChevronRight, ChevronDown, Globe, Sparkles, FileText,
} from "lucide-react";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { cn } from "@/lib/utils";

type NavItem = { label: string; href?: string; icon: any; corporateOnly: boolean; children?: NavItem[] };

// Three sections: Home stands alone (label: null renders no header text --
// it's the one place people return to constantly and doesn't need a
// label). Work covers everything browsed or built. Account is
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
    label: "Work",
    items: [
      { label: "Strategy", href: "/dashboard/strategy", icon: Sparkles, corporateOnly: true },
      { label: "Marketplace", href: "/dashboard/marketplace", icon: Compass, corporateOnly: false },
      { label: "Partnerships", href: "/dashboard/partnerships", icon: Handshake, corporateOnly: false },
      {
        label: "Portfolio", icon: Lightbulb, corporateOnly: false,
        children: [
          { label: "Exchanges", href: "/dashboard/portfolio/exchanges", icon: Lightbulb, corporateOnly: false },
          { label: "MoUs",      href: "/dashboard/portfolio/mou",       icon: FileText,  corporateOnly: false },
        ],
      },
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
  const { profile, signOut } = useAuth();
  console.log("Sidebar profile:", profile?.user_type, profile?.org_name, profile?.full_name);
  const [collapsed, setCollapsed] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());

  useEffect(() => {
    setExpandedParents((prev) => {
      const next = new Set(prev);
      for (const section of NAV_SECTIONS) {
        for (const item of section.items) {
          if (item.children?.some((c) => c.href && location.startsWith(c.href))) {
            next.add(item.label);
          }
        }
      }
      return next;
    });
  }, [location]);
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
      "fixed left-0 top-0 h-screen flex flex-col z-40 transition-all duration-200 border-r border-border",
      "bg-gradient-to-b from-[#6B4432] via-[#452A1D] to-[#2A1A11]",
      "dark:from-[#2E1D14] dark:via-[#1F140D] dark:to-[#120B07]",
      collapsed ? "w-16" : "w-72"
    )}
    >
      {/* Grain texture overlay — sits behind all real content since it's
          the first child painted in this stacking context. Colour-neutral
          SVG noise with mix-blend so it reads correctly over both the
          light and dark gradients without any theme-detection logic. */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.12] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />
      {/* Brand + toggle — solid, same treatment as the footer, so the logo
          sits on a flat dark ground instead of competing with the
          gradient/texture behind the nav items. */}
      <div className="px-3 py-5 shrink-0 flex items-center justify-between bg-[#180E08] border-b border-black/20">
        {!collapsed && (
          <img src="/logo.png" alt="Impact Natives" className="h-10 w-auto" />
        )}
        <button
          onClick={toggle}
          className="ml-auto p-1 rounded-md text-[#F2E6D8] hover:bg-white/10 transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Nav */}
      <style>{`
        .sidebar-nav-scroll::-webkit-scrollbar { width: 3px; }
        .sidebar-nav-scroll::-webkit-scrollbar-track { background: transparent; }
        .sidebar-nav-scroll::-webkit-scrollbar-thumb {
          background: rgba(242,230,216,0.25);
          border-radius: 999px;
        }
        .sidebar-nav-scroll { scrollbar-width: thin; scrollbar-color: rgba(242,230,216,0.25) transparent; }
      `}</style>
      <nav className="sidebar-nav-scroll flex-1 overflow-y-auto py-4 px-2 pr-1">
        {visibleSections.map((section, sectionIndex) => (
          <div key={section.label ?? "home"} className={sectionIndex > 0 ? "mt-4" : ""}>
            {section.label && !collapsed && (
              <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#F2E6D8]">
                {section.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const { label, href, icon: Icon, children } = item;
                const isMessages = href === "/dashboard/messages";
                const showBadge  = isMessages && unreadMessages > 0;

                if (children) {
                  const isExpanded = expandedParents.has(label);
                  const anyChildActive = children.some((c) => c.href && isActive(c.href));
                  return (
                    <li key={label}>
                      <button type="button"
                        onClick={() => {
                          if (collapsed) { setCollapsed(false); onCollapse?.(false); }
                          setExpandedParents((prev) => {
                            const next = new Set(prev);
                            if (next.has(label)) next.delete(label); else next.add(label);
                            return next;
                          });
                        }}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors cursor-pointer w-full text-left",
                          collapsed && "justify-center px-2",
                          anyChildActive ? "text-[#F2E6D8]" : "text-[#F2E6D8] hover:bg-white/10"
                        )}
                        title={collapsed ? label : undefined}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        {!collapsed && (
                          <>
                            <span className="flex-1">{label}</span>
                            <ChevronDown className={cn("w-3.5 h-3.5 transition-transform shrink-0", isExpanded && "rotate-180")} />
                          </>
                        )}
                      </button>
                      {!collapsed && isExpanded && (
                        <ul className="mt-0.5 ml-4 pl-3 border-l border-white/10 space-y-0.5">
                          {children.map((child) => (
                            <li key={child.href}>
                              <Link href={child.href!}>
                                <span className={cn(
                                  "flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors cursor-pointer w-full",
                                  isActive(child.href!)
                                    ? "bg-[#F2E6D8] text-[#452A1D]"
                                    : "text-[#F2E6D8] hover:bg-white/10"
                                )}>
                                  <child.icon className="w-3.5 h-3.5 shrink-0" />
                                  <span className="flex-1">{child.label}</span>
                                </span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                }

                return (
                  <li key={href}>
                    <Link href={href!}>
                      <span
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors cursor-pointer w-full",
                          collapsed && "justify-center px-2",
                          isActive(href!)
                            ? "bg-[#F2E6D8] text-[#452A1D]"
                            : "text-[#F2E6D8] hover:bg-white/10"
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
      <div className="border-t border-black/20 px-3 py-4 shrink-0 space-y-3 bg-[#180E08]">                
      {!collapsed && (
          <div className="flex items-center gap-2">
            <UserAvatar
              id={profile?.id ?? ""}
              name={profile?.user_type === "organisation" ? (profile?.org_name || profile?.full_name) : profile?.full_name}
              avatarUrl={profile?.user_type === "organisation" ? profile?.logo_url : profile?.avatar_url}
              size="sm"
            />
                <div className="min-w-0">
              <p className="text-[10px] font-semibold text-[#F2E6D8] truncate">                
                {profile?.user_type === "organisation"
                  ? (profile?.org_name || "Your Organisation")
                  : (profile?.full_name || "Your Account")}
              </p>
              <p className="text-[11px] text-[#F2E6D8]/60 truncate mt-0.5">
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
            profile?.is_verified ? "text-[#6FCF9E]" : "text-[#F2E6D8]/60"
          )} />
          <span className={cn(
            "text-[11px]",
            profile?.is_verified ? "text-[#6FCF9E] font-medium" : "text-[#F2E6D8]/60"
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
            className="block text-[11px] text-[#F2E6D8]/60 hover:text-[#F2E6D8] transition-colors"
          >
            Privacy Policy
          </a>
        )}

        <button
          type="button"
          onClick={signOut}
          className={cn(
            "flex items-center gap-2 text-[11px] text-[#F2E6D8] hover:opacity-70 transition-opacity w-full",
            collapsed && "justify-center"
          )}
          title={collapsed ? "Sign out" : undefined}
        >
          <LogOut className="w-3.5 h-3.5 text-[#F2E6D8]" />
          {!collapsed && "Sign out"}
        </button>
      </div>
    </aside>
  );
}