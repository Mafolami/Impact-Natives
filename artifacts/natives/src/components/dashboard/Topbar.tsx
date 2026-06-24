import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { Bell, X, Check } from "lucide-react";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard":               "Home",
  "/dashboard/partnerships":  "Partnerships",
  "/dashboard/initiatives":   "Initiatives", 
  "/dashboard/labs":          "Labs",
  "/dashboard/marketplace":   "Marketplace",
  "/dashboard/natives":       "Natives",
  "/dashboard/messages":      "Messages",
  "/dashboard/profile":       "Profile",
  "/dashboard/settings":      "Settings",
};

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
}

function timeAgo(dateStr: string): string {
  const diff  = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7)   return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

interface TopbarProps {
  sidebarCollapsed?: boolean;
}

export default function Topbar({ sidebarCollapsed }: TopbarProps) {
  const [location, navigate] = useLocation();
  const { profile, user }    = useAuth();
  const title                = PAGE_TITLES[location] ?? "Dashboard";

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [panelOpen, setPanelOpen]         = useState(false);
  const panelRef                          = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    if (!user) return;
    loadNotifications();

    // Real-time
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        setNotifications((prev) => [payload.new as Notification, ...prev]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Close panel on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setPanelOpen(false);
      }
    }
    if (panelOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [panelOpen]);

  async function loadNotifications() {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("id, type, title, body, link, read, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);
    setNotifications(data ?? []);
  }

  async function markAllRead() {
    if (!user) return;
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  async function markRead(id: string) {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
  }

  function handleNotificationClick(n: Notification) {
    markRead(n.id);
    if (n.link) navigate(n.link);
    setPanelOpen(false);
  }

  return (
    <header
      className={cn(
        "fixed top-0 right-0 h-18 bg-background border-b border-border flex items-center justify-between px-6 py-3 z-30 transition-all duration-200",
        sidebarCollapsed ? "left-16" : "left-56"
      )}
    >
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse" style={{ background: "#C45C26" }} />
        <h1 style={{
          fontSize: "15px",
          fontWeight: 700,
          letterSpacing: "0.14em",
          textTransform: "uppercase" as const,
          color: "#C45C26",
        }}>
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-3">
        

        {/* Notifications bell */}
        <div className="relative" ref={panelRef}>
          <button
            type="button"
            onClick={() => setPanelOpen((v) => !v)}
            className="relative p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[#E8622A] text-white text-[9px] font-bold flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {/* Slide-in panel */}
          {panelOpen && (
            <div className="absolute right-0 top-10 w-80 max-h-[70vh] bg-background border border-border rounded-xl shadow-lg flex flex-col overflow-hidden z-50">
              {/* Panel header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
                <span className="text-sm font-semibold text-foreground">
                  Notifications {unreadCount > 0 && <span className="text-[#E8622A]">({unreadCount})</span>}
                </span>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={markAllRead}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                    >
                      <Check className="w-3 h-3" />
                      Mark all read
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setPanelOpen(false)}
                    className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Notification list */}
              <div className="overflow-y-auto flex-1">
                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <p className="text-sm text-muted-foreground">No notifications yet.</p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => handleNotificationClick(n)}
                      className={cn(
                        "w-full text-left px-4 py-3 border-b border-border/50 hover:bg-muted/50 transition-colors",
                        !n.read && "bg-[#eaf5ee]/50"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn(
                          "text-xs leading-relaxed",
                          n.read ? "text-muted-foreground" : "text-foreground font-medium"
                        )}>
                          {n.title}
                        </p>
                        {!n.read && (
                          <span className="w-2 h-2 rounded-full bg-[#2D6A4F] shrink-0 mt-1" />
                        )}
                      </div>
                      {n.body && (
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">
                          {n.body}
                        </p>
                      )}
                      <p className="text-[10px] text-muted-foreground/60 mt-1">{timeAgo(n.created_at)}</p>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <Link href="/dashboard/profile">
          <div className="cursor-pointer">
            <UserAvatar
              id={user?.id ?? ""}
              name={profile?.user_type === "organisation" ? (profile?.org_name || profile?.full_name) : profile?.full_name}
              avatarUrl={profile?.user_type === "organisation" ? undefined : profile?.avatar_url}
              size="sm"
            />
          </div>
        </Link>
      </div>
    </header>
  );
}