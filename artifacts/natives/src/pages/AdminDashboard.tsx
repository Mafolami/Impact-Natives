import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface StatCardProps {
  label: string;
  value: number | string;
  accent?: string;
}

function StatCard({ label, value, accent = "#2D6A4F" }: StatCardProps) {
  return (
    <div
      className="rounded-xl p-5 border border-white/10 relative overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${accent}1a 0%, #0f1a14 100%)`,
      }}
    >
      <div
        className="absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-20 blur-2xl"
        style={{ background: accent }}
      />
      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40 mb-2">
        {label}
      </p>
      <p className="text-3xl font-bold text-white">{value}</p>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <p className="text-xs font-bold uppercase tracking-widest text-white/30 mb-3">
      {title}
    </p>
  );
}

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    joinedToday: 0,
    joinedThisWeek: 0,
    joinedThisMonth: 0,
    totalInitiatives: 0,
    publishedInitiatives: 0,
    pendingInitiatives: 0,
    initiativesThisMonth: 0,
    totalOrgs: 0,
    verifiedOrgs: 0,
    pendingOrgs: 0,
    eoisThisMonth: 0,
    confirmedPartnerships: 0,
  });
  const [recentUsers, setRecentUsers] = useState<any[]>([]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [
      { count: totalUsers },
      { count: joinedToday },
      { count: joinedThisWeek },
      { count: joinedThisMonth },
      { count: totalInitiatives },
      { count: publishedInitiatives },
      { count: pendingInitiatives },
      { count: initiativesThisMonth },
      { count: totalOrgs },
      { count: verifiedOrgs },
      { count: pendingOrgs },
      { count: eoisThisMonth },
      { data: recentUsersData },
      { data: initiativesWithPartners },
    ] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", startOfToday),
      supabase.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", startOfWeek),
      supabase.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", startOfMonth),
      supabase.from("initiative_requests").select("*", { count: "exact", head: true }),
      supabase.from("initiative_requests").select("*", { count: "exact", head: true }).eq("status", "published"),
      supabase.from("initiative_requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("initiative_requests").select("*", { count: "exact", head: true }).gte("created_at", startOfMonth),
      supabase.from("organizations").select("*", { count: "exact", head: true }),
      supabase.from("organizations").select("*", { count: "exact", head: true }).eq("verification_status", "verified"),
      supabase.from("profiles").select("*", { count: "exact", head: true }).eq("verification_requested", true).eq("is_verified", false),      supabase.from("expressions_of_interest").select("*", { count: "exact", head: true }).gte("created_at", startOfMonth),
      supabase.from("profiles").select("id,full_name,email,user_type,org_name,created_at").order("created_at", { ascending: false }).limit(8),
      supabase.from("initiative_requests").select("user_id,confirmed_partners").not("confirmed_partners", "is", null),
    ]);

    let confirmedPartnerships = 0;
    (initiativesWithPartners ?? []).forEach((ini: any) => {
      const partners = ini.confirmed_partners ?? [];
      confirmedPartnerships += Array.isArray(partners) ? partners.length : 0;
    });

    setStats({
      totalUsers: totalUsers ?? 0,
      joinedToday: joinedToday ?? 0,
      joinedThisWeek: joinedThisWeek ?? 0,
      joinedThisMonth: joinedThisMonth ?? 0,
      totalInitiatives: totalInitiatives ?? 0,
      publishedInitiatives: publishedInitiatives ?? 0,
      pendingInitiatives: pendingInitiatives ?? 0,
      initiativesThisMonth: initiativesThisMonth ?? 0,
      totalOrgs: totalOrgs ?? 0,
      verifiedOrgs: verifiedOrgs ?? 0,
      pendingOrgs: pendingOrgs ?? 0,
      eoisThisMonth: eoisThisMonth ?? 0,
      confirmedPartnerships,
    });
    setRecentUsers(recentUsersData ?? []);
    setLoading(false);
  }

  return (
    <div className="min-h-screen p-8" style={{ background: "#0f1a14", color: "white" }}>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Platform Overview</h1>
          <p className="text-white/40 text-sm mt-1">Live stats across Impact Natives.</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="px-4 py-2 rounded-full text-sm border border-white/20 text-white/70 hover:border-white/40 hover:text-white transition-colors disabled:opacity-40"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* USERS */}
      <div className="mb-8">
        <SectionHeader title="Users" />
        <div className="grid grid-cols-4 gap-4">
          <StatCard label="Total Users" value={stats.totalUsers} accent="#2D6A4F" />
          <StatCard label="Joined Today" value={stats.joinedToday} accent="#C45C26" />
          <StatCard label="This Week" value={stats.joinedThisWeek} accent="#2D6A4F" />
          <StatCard label="This Month" value={stats.joinedThisMonth} accent="#C45C26" />
        </div>
      </div>

      {/* INITIATIVES */}
      <div className="mb-8">
        <SectionHeader title="Initiatives" />
        <div className="grid grid-cols-4 gap-4">
          <StatCard label="Total" value={stats.totalInitiatives} accent="#2D6A4F" />
          <StatCard label="Published" value={stats.publishedInitiatives} accent="#2D6A4F" />
          <StatCard label="Pending Review" value={stats.pendingInitiatives} accent="#C45C26" />
          <StatCard label="This Month" value={stats.initiativesThisMonth} accent="#2D6A4F" />
        </div>
      </div>

      {/* ORGANIZATIONS */}
      <div className="mb-8">
        <SectionHeader title="Organizations" />
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Total" value={stats.totalOrgs} accent="#2D6A4F" />
          <StatCard label="Verified" value={stats.verifiedOrgs} accent="#2D6A4F" />
          <StatCard label="Pending Verification" value={stats.pendingOrgs} accent="#C45C26" />
        </div>
      </div>

      {/* ACTIVITY */}
      <div className="mb-8">
        <SectionHeader title="Activity" />
        <div className="grid grid-cols-2 gap-4">
          <StatCard label="EOIs This Month" value={stats.eoisThisMonth} accent="#2D6A4F" />
          <StatCard label="Confirmed Partnerships (All-Time)" value={stats.confirmedPartnerships} accent="#C45C26" />
        </div>
      </div>

      {/* RECENT USERS */}
      <div className="rounded-xl border border-white/10 p-6" style={{ background: "linear-gradient(135deg, #2D6A4F0d 0%, #0f1a1400 100%)" }}>
        <SectionHeader title="Recently Joined" />
        <div className="space-y-2">
          {recentUsers.map((u) => (
            <div key={u.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">{u.full_name ?? "—"}</p>
                <p className="text-xs text-white/40 truncate">
                  {u.email}
                  {u.org_name && ` · ${u.org_name}`}
                </p>
              </div>
              <span className="text-xs text-white/30 shrink-0 ml-4">
                {new Date(u.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
              </span>
            </div>
          ))}
          {recentUsers.length === 0 && (
            <p className="text-white/30 text-sm">No users yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}