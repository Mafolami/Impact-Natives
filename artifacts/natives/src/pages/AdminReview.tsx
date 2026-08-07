import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────
type Initiative = {
  id: string
  title: string
  submitter_name: string
  submitter_org: string
  submitter_email: string
  sectors: string[]
  locations: string[]
  budget: string
  problem: string
  outcome: string
  status: string
  created_at: string
  stage?: string | null
  target_population?: string | null
  specific_ask?: string | null
  had_prior_experience?: boolean | null
  partnerships?: string[] | null
  ai_quality_score?: string | null
}

type Org = {
  id: string
  user_id: string | null
  organisation_name: string
  description: string
  sector: string | string[]
  country: string | string[]
  organisation_type: string
  website: string
  email: string
  needs: string[]
  offers: string[]
  sdgs: string[]
  verification_status: string
  verification_consent: string
  status: string
  created_at: string
}

type TabSection = 'overview' | 'initiatives' | 'organizations' | 'partner_requests' | 'verification' | 'flagged_orgs' | 'lab_requests' | 'users' | 'contact'
type InitiativeFilter = 'pending' | 'published' | 'rejected'
type OrgView = 'pending' | 'published' | 'rejected' | 'match_results'

// ─── Nav ─────────────────────────────────────────────────────────────────────
const NAV_SECTIONS: { value: TabSection; label: string }[] = [
  { value: 'overview',         label: 'Overview' },
  { value: 'initiatives',      label: 'Initiatives' },
  { value: 'organizations',    label: 'Get Matched' },
  { value: 'verification',     label: 'Verification' },
  { value: 'flagged_orgs',     label: 'Flagged Orgs' },
  { value: 'lab_requests',     label: 'Lab Requests' },
  { value: 'users',            label: 'Users' },
  { value: 'partner_requests', label: 'Partner With Natives' },
  { value: 'contact',          label: 'Contact' },
]

const SECTION_DESCRIPTIONS: Record<TabSection, string> = {
  overview: 'Live stats across Impact Natives. Click any number to jump straight to it.',
  initiatives: 'Initiative submissions from the marketplace. Review and approve before they go live.',
  organizations: 'Organisations seeking partners through the Find a Partner flow, plus the AI match results computed for them.',
  partner_requests: 'Institutional partnership requests submitted via the Partner With Natives page. These are requests to collaborate with Impact Natives directly.',
  verification: 'Organisations and individuals requesting verified status. Review their documents before approving.',
  flagged_orgs: 'Organisations that disclosed a blacklisting or pending legal dispute in their DD checklist. Review for severity, record context, and decide on directory visibility.',
  lab_requests: 'Innovation Lab proposals from the Commission a Lab page. Move through stages as you engage each client.',
  users: 'All registered accounts. Manage access, admin rights, and account status.',
  contact: 'Messages submitted via the Contact Us form. No approval needed — for your awareness and response.',
}

// A stat card can navigate into a section, optionally with a starting filter.
type NavTarget = { section: TabSection; filter?: string } | null

// ─── Helpers ─────────────────────────────────────────────────────────────────
function normalizeArr(val: string | string[] | null | undefined): string[] {
  if (!val) return []
  if (Array.isArray(val)) return val
  try { const p = JSON.parse(val); return Array.isArray(p) ? p : [val] }
  catch { return [val] }
}

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

async function getRegisteredEmails(emails: string[]): Promise<Set<string>> {
  if (emails.length === 0) return new Set()
  const { data } = await supabase
    .from('profiles')
    .select('email')
    .in('email', emails)
  return new Set((data ?? []).map(p => p.email?.toLowerCase()))
}

function RegistrationTag({ email, registeredEmails }: { email: string; registeredEmails: Set<string> }) {
  const isRegistered = registeredEmails.has(email?.toLowerCase())
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
      isRegistered
        ? 'bg-[#2D6A4F]/20 text-[#6fcf97] border-[#2D6A4F]/30'
        : 'bg-white/5 text-white/40 border-white/10'
    }`}>
      {isRegistered ? 'Registered' : 'Guest'}
    </span>
  )
}

// ─── Admin Triage Summary ─────────────────────────────────────────────────────
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

function AdminTriageSummary({ type, data }: { type: "initiative" | "verification"; data: Record<string, any> }) {
  const [summary, setSummary]   = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);
  const [expanded, setExpanded] = useState(false);

  async function generate() {
    if (summary) { setExpanded(e => !e); return; }
    setLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-admin-triage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, data }),
      });
      const result = await res.json();
      if (result.summary) { setSummary(result.summary); setExpanded(true); }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }

  return (
    <div className="mt-2">
      <button type="button" onClick={generate}
        className="flex items-center gap-1.5 text-xs text-[#6fcf97]/70 hover:text-[#6fcf97] transition-colors">
        {loading ? (
          <><span className="animate-spin">⟳</span> Generating AI triage...</>
        ) : (
          <><span>✦</span> {summary ? (expanded ? "Hide AI triage" : "Show AI triage") : "AI triage summary"}</>
        )}
      </button>
      {expanded && summary && (
        <div className="mt-2 text-xs text-white/60 leading-relaxed border border-[#2D6A4F]/20 bg-[#2D6A4F]/5 rounded-lg px-3 py-2.5">
          {summary}
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function AdminReview() {
  const [section, setSection] = useState<TabSection>('overview')
  const [navTarget, setNavTarget] = useState<NavTarget>(null)
  const [railCounts, setRailCounts] = useState<Record<string, number>>({})

  function goTo(target: NavTarget) {
    if (!target) return
    setNavTarget(target)
    setSection(target.section)
  }

  function selectSection(value: TabSection) {
    setNavTarget(null)
    setSection(value)
  }

  useEffect(() => { loadRailCounts() }, [section])

  async function loadRailCounts() {
    const [
      { count: pendingInitiatives },
      { count: pendingOrgs },
      { count: pendingVerification },
      { count: pendingLabs },
      { count: pendingPartnerReqs },
    ] = await Promise.all([
      supabase.from('initiative_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('organizations').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('verification_requested', true).eq('is_verified', false),
      supabase.from('lab_requests').select('*', { count: 'exact', head: true }).eq('status', 'proposal_review'),
      supabase.from('partner_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    ])
    setRailCounts({
      initiatives: pendingInitiatives ?? 0,
      organizations: pendingOrgs ?? 0,
      verification: pendingVerification ?? 0,
      lab_requests: pendingLabs ?? 0,
      partner_requests: pendingPartnerReqs ?? 0,
    })
  }

  return (
    <div className="min-h-screen flex" style={{ background: '#0f1a14', color: 'white' }}>

      {/* Rail */}
      <nav className="w-60 shrink-0 border-r border-white/10 p-5 flex flex-col gap-1">
        <h1 className="text-lg font-bold mb-0.5">Admin</h1>
        <p className="text-white/40 text-xs mb-5">Review and manage the platform.</p>
        {NAV_SECTIONS.map(({ value, label }) => {
          const count = railCounts[value]
          const active = section === value
          return (
            <button
              key={value}
              onClick={() => selectSection(value)}
              className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors text-left ${
                active
                  ? 'bg-[#2D6A4F] text-white font-semibold'
                  : 'text-white/60 hover:bg-white/5 hover:text-white/90'
              }`}
            >
              <span>{label}</span>
              {!!count && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ml-2 ${
                  active ? 'bg-white/20' : 'bg-[#c1440e]/80 text-white'
                }`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* Content */}
      <div className="flex-1 p-8 overflow-auto">
        <div className="mb-6 text-sm text-white/40 border border-white/08 rounded-lg px-4 py-3 bg-white/03">
          {SECTION_DESCRIPTIONS[section]}
        </div>

        {section === 'overview' && <OverviewPanel onNavigate={(s, f) => goTo({ section: s, filter: f })} />}
        {section === 'initiatives' && (
          <InitiativesPanel initialFilter={navTarget?.section === 'initiatives' ? (navTarget.filter as InitiativeFilter) : undefined} />
        )}
        {section === 'organizations' && (
          <OrganizationsPanel initialView={navTarget?.section === 'organizations' ? (navTarget.filter as OrgView) : undefined} />
        )}
        {section === 'partner_requests' && (
          <PartnerRequestsPanel initialFilter={navTarget?.section === 'partner_requests' ? (navTarget.filter as any) : undefined} />
        )}
        {section === 'verification' && (
          <VerificationPanel initialFilter={navTarget?.section === 'verification' ? (navTarget.filter as any) : undefined} />
        )}
        {section === 'flagged_orgs' && <FlaggedOrgsPanel />}
        {section === 'lab_requests' && (
          <LabRequestsPanel initialFilter={navTarget?.section === 'lab_requests' ? (navTarget.filter as string) : undefined} />
        )}
        {section === 'users' && (
          <UsersPanel initialFilter={navTarget?.section === 'users' ? (navTarget.filter as any) : undefined} />
        )}
        {section === 'contact' && <ContactSubmissionsPanel />}
      </div>
    </div>
  )
}

// ─── Overview Panel (folded in from AdminDashboard.tsx) ───────────────────────
interface StatCardProps {
  label: string
  value: number | string
  accent?: string
  onClick?: () => void
}

function StatCard({ label, value, accent = "#2D6A4F", onClick }: StatCardProps) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`rounded-xl p-5 border border-white/10 relative overflow-hidden text-left w-full ${
        onClick ? 'hover:border-white/25 transition-colors cursor-pointer' : ''
      }`}
      style={{ background: `linear-gradient(135deg, ${accent}1a 0%, #0f1a14 100%)` }}
    >
      <div
        className="absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-20 blur-2xl"
        style={{ background: accent }}
      />
      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40 mb-2">
        {label}
      </p>
      <p className="text-3xl font-bold text-white">{value}</p>
    </Tag>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <p className="text-xs font-bold uppercase tracking-widest text-white/30 mb-3">
      {title}
    </p>
  )
}

function OverviewPanel({ onNavigate }: { onNavigate: (section: TabSection, filter?: string) => void }) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    joinedToday: 0,
    joinedThisWeek: 0,
    joinedThisMonth: 0,
    totalInitiatives: 0,
    publishedInitiatives: 0,
    pendingInitiatives: 0,
    draftInitiatives: 0,
    initiativesThisMonth: 0,
    totalOrgs: 0,
    verifiedOrgs: 0,
    pendingOrgs: 0,
    pendingVerificationProfiles: 0,
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
      { count: draftInitiatives },
      { count: initiativesThisMonth },
      { count: totalOrgs },
      { count: verifiedOrgs },
      { count: pendingOrgsCount },
      { count: pendingVerificationProfiles },
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
      supabase.from("initiative_requests").select("*", { count: "exact", head: true }).eq("status", "draft"),
      supabase.from("initiative_requests").select("*", { count: "exact", head: true }).gte("created_at", startOfMonth),
      supabase.from("organizations").select("*", { count: "exact", head: true }),
      supabase.from("organizations").select("*", { count: "exact", head: true }).eq("verification_status", "verified"),
      supabase.from("organizations").select("*", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("profiles").select("*", { count: "exact", head: true }).eq("verification_requested", true).eq("is_verified", false),
      supabase.from("expressions_of_interest").select("*", { count: "exact", head: true }).gte("created_at", startOfMonth),
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
      draftInitiatives: draftInitiatives ?? 0,
      initiativesThisMonth: initiativesThisMonth ?? 0,
      totalOrgs: totalOrgs ?? 0,
      verifiedOrgs: verifiedOrgs ?? 0,
      pendingOrgs: pendingOrgsCount ?? 0,
      pendingVerificationProfiles: pendingVerificationProfiles ?? 0,
      eoisThisMonth: eoisThisMonth ?? 0,
      confirmedPartnerships,
    });
    setRecentUsers(recentUsersData ?? []);
    setLoading(false);
  }

  return (
    <div>
      <div className="flex items-center justify-end mb-6 -mt-2">
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
          <StatCard label="Total Users" value={stats.totalUsers} accent="#2D6A4F" onClick={() => onNavigate('users')} />
          <StatCard label="Joined Today" value={stats.joinedToday} accent="#C45C26" onClick={() => onNavigate('users')} />
          <StatCard label="This Week" value={stats.joinedThisWeek} accent="#2D6A4F" onClick={() => onNavigate('users')} />
          <StatCard label="This Month" value={stats.joinedThisMonth} accent="#C45C26" onClick={() => onNavigate('users')} />
        </div>
      </div>

      {/* INITIATIVES */}
      <div className="mb-8">
        <SectionHeader title="Initiatives" />
        <div className="grid grid-cols-5 gap-4">
          <StatCard label="Total" value={stats.totalInitiatives} accent="#2D6A4F" onClick={() => onNavigate('initiatives', 'pending')} />
          <StatCard label="Published" value={stats.publishedInitiatives} accent="#2D6A4F" onClick={() => onNavigate('initiatives', 'published')} />
          <StatCard label="Pending Review" value={stats.pendingInitiatives} accent="#C45C26" onClick={() => onNavigate('initiatives', 'pending')} />
          {/* Drafts has no dedicated filter tab in Initiatives yet — shown for
              visibility only, not wired to a destination that doesn't exist. */}
          <StatCard label="Drafts" value={stats.draftInitiatives} accent="#C45C26" />
          <StatCard label="This Month" value={stats.initiativesThisMonth} accent="#2D6A4F" onClick={() => onNavigate('initiatives', 'pending')} />
        </div>
      </div>

      {/* ORGANIZATIONS */}
      <div className="mb-8">
        <SectionHeader title="Organizations" />
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Total" value={stats.totalOrgs} accent="#2D6A4F" onClick={() => onNavigate('organizations', 'published')} />
          <StatCard label="Verified" value={stats.verifiedOrgs} accent="#2D6A4F" onClick={() => onNavigate('organizations', 'published')} />
          <StatCard label="Pending Approval" value={stats.pendingOrgs} accent="#C45C26" onClick={() => onNavigate('organizations', 'pending')} />
        </div>
      </div>

      {/* VERIFICATION — split out from Organizations; this queries profiles,
          not organizations, and belongs with its own section. */}
      <div className="mb-8">
        <SectionHeader title="Verification" />
        <div className="grid grid-cols-3 gap-4">
          <StatCard
            label="Pending Verification"
            value={stats.pendingVerificationProfiles}
            accent="#C45C26"
            onClick={() => onNavigate('verification', 'pending')}
          />
        </div>
      </div>

      {/* ACTIVITY — no dedicated admin panel exists for EOIs or confirmed
          partnerships directly, so these stay informational, not clickable. */}
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

// ─── Initiatives Panel ────────────────────────────────────────────────────────
function InitiativesPanel({ initialFilter }: { initialFilter?: InitiativeFilter }) {
  const [initiatives, setInitiatives] = useState<Initiative[]>([])
  const [loading, setLoading]         = useState(true)
  const [filter, setFilter]           = useState<InitiativeFilter>(initialFilter ?? 'pending')
  const [registeredEmails, setRegisteredEmails] = useState<Set<string>>(new Set())

  useEffect(() => { fetchInitiatives() }, [filter])

  async function fetchInitiatives() {
    setLoading(true)
    const { data, error } = await supabase
      .from('initiative_requests')
      .select('*')
      .eq('status', filter)
      .order('created_at', { ascending: false })
    if (error) console.error(error)
    else {
      setInitiatives(data ?? [])
      const emails = (data ?? []).map(i => i.submitter_email).filter(Boolean)
      setRegisteredEmails(await getRegisteredEmails(emails))
    }
    setLoading(false)
  }

  async function updateStatus(id: string, newStatus: InitiativeFilter) {
    const { data, error } = await supabase
      .from('initiative_requests')
      .update({ status: newStatus })
      .eq('id', id)
      .select()
    
    if (error) alert(`Failed to update: ${error.message}`)
    else setInitiatives(prev => prev.filter(i => i.id !== id))
  }

  async function deleteInitiative(id: string) {
    if (!confirm('Permanently delete this initiative? This cannot be undone.')) return
    const { error } = await supabase
      .from('initiative_requests')
      .delete()
      .eq('id', id)
    if (error) alert(`Failed to delete: ${error.message}`)
    else setInitiatives(prev => prev.filter(i => i.id !== id))
  }

  return (
    <div>
      {/* Filter tabs */}
      <div className="flex gap-2 mb-6">
        {([
          { value: 'pending',   label: 'Pending' },
          { value: 'published', label: 'Approved' },
          { value: 'rejected',  label: 'Rejected' },
        ] as const).map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={`px-4 py-1.5 rounded-full text-sm border transition-colors ${
              filter === value
                ? 'bg-[#c1440e] border-[#c1440e] text-white'
                : 'border-white/20 text-white/50 hover:border-white/40'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-white/40">Loading...</p>
      ) : initiatives.length === 0 ? (
        <p className="text-white/40">No {filter} initiatives.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {initiatives.map(initiative => (
            <div key={initiative.id} className="border border-white/10 rounded-xl p-6 bg-white/5">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-lg font-semibold">{initiative.title}</h2>
                  <p className="text-white/50 text-sm mt-0.5">
                    {initiative.submitter_name}
                    {initiative.submitter_org && ` · ${initiative.submitter_org}`}
                    {` · ${initiative.submitter_email}`}
                  </p>
                  
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-white/40 text-xs">Submitted {fmt(initiative.created_at)}</p>
                    <RegistrationTag email={initiative.submitter_email} registeredEmails={registeredEmails} />
                  </div>
                  
                </div>
                <div className="flex gap-2 shrink-0">
                  {filter === 'pending' && (
                    <>
                      <button onClick={() => updateStatus(initiative.id, 'published')}
                        className="px-4 py-1.5 rounded-full text-sm bg-[#2D6A4F] hover:bg-[#2D6A4F]/80 text-white transition-colors">
                        Approve
                      </button>
                      <button onClick={() => updateStatus(initiative.id, 'rejected')}
                        className="px-4 py-1.5 rounded-full text-sm border border-red-500/40 text-red-400 hover:bg-red-500/10 transition-colors">
                        Reject
                      </button>
                    </>
                  )}
                  {filter === 'published' && (
                    <>
                      <button onClick={() => updateStatus(initiative.id, 'pending')}
                        className="px-4 py-1.5 rounded-full text-sm border border-white/20 text-white/60 hover:border-white/40 transition-colors">
                        Move to Pending
                      </button>
                      <button onClick={() => updateStatus(initiative.id, 'rejected')}
                        className="px-4 py-1.5 rounded-full text-sm border border-red-500/40 text-red-400 hover:bg-red-500/10 transition-colors">
                        Reject
                      </button>
                    </>
                  )}
                  {filter === 'rejected' && (
                    <button onClick={() => updateStatus(initiative.id, 'published')}
                      className="px-4 py-1.5 rounded-full text-sm bg-[#2D6A4F] hover:bg-[#2D6A4F]/80 text-white transition-colors">
                      Restore
                    </button>
                  )}
                  <button onClick={() => deleteInitiative(initiative.id)}
                    className="px-4 py-1.5 rounded-full text-sm border border-red-500/40 text-red-400 hover:bg-red-500/10 transition-colors">
                    Delete
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                <div>
                  <p className="text-white/40 text-xs uppercase tracking-wide mb-1">Problem</p>
                  <p className="text-white/80 line-clamp-3">{initiative.problem}</p>
                </div>
                <div>
                  <p className="text-white/40 text-xs uppercase tracking-wide mb-1">Outcome</p>
                  <p className="text-white/80 line-clamp-3">{initiative.outcome}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-4 text-xs text-white/50 mb-3">
  {initiative.budget && <span>Budget: {initiative.budget}</span>}
  {initiative.sectors?.length > 0 && <span>Sectors: {initiative.sectors.join(', ')}</span>}
  {initiative.locations?.length > 0 && <span>Locations: {initiative.locations.join(', ')}</span>}
  {initiative.stage && <span>Stage: {initiative.stage}</span>}
  {initiative.target_population && <span>Serves: {initiative.target_population}</span>}
  {initiative.had_prior_experience !== null && initiative.had_prior_experience !== undefined && (
    <span>Prior experience: {initiative.had_prior_experience ? "Yes" : "No"}</span>
  )}
  {initiative.ai_quality_score && (
    <span className={`px-2 py-0.5 rounded-full border text-[10px] font-medium ${
      initiative.ai_quality_score === "strong" ? "bg-[#2D6A4F]/20 text-[#6fcf97] border-[#2D6A4F]/30" :
      initiative.ai_quality_score === "good"   ? "bg-amber-500/20 text-amber-300 border-amber-500/30" :
                                                  "bg-white/10 text-white/50 border-white/20"
    }`}>
      {initiative.ai_quality_score} brief
    </span>
  )}
</div>
{initiative.specific_ask && (
  <div className="mb-3">
    <p className="text-white/40 text-xs uppercase tracking-wide mb-1">Specific ask</p>
    <p className="text-white/70 text-sm leading-relaxed">{initiative.specific_ask}</p>
  </div>
)}
<AdminTriageSummary
  type="initiative"
  data={{
    title: initiative.title,
    problem: initiative.problem,
    outcome: initiative.outcome,
    stage: initiative.stage,
    partnerships: initiative.partnerships,
    specific_ask: initiative.specific_ask,
    budget: initiative.budget,
    target_population: initiative.target_population,
    had_prior_experience: initiative.had_prior_experience,
    sectors: initiative.sectors,
    locations: initiative.locations,
  }}
/>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Partner Requests Panel ───────────────────────────────────────────────────
type PartnerRequest = {
  id: string
  organisation_name: string
  contact_name: string
  email: string
  status: string
  created_at: string
  user_id: string | null
  has_identified_partners: boolean
  selected_partners: string[]
  partner_sectors: string[]
  proposed_data: Record<string, any> | null
}

function PartnerRequestsPanel({ initialFilter }: { initialFilter?: 'pending' | 'approved' | 'rejected' }) {
  const [requests, setRequests] = useState<PartnerRequest[]>([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState<'pending' | 'approved' | 'rejected'>(initialFilter ?? 'pending')
  const [registeredEmails, setRegisteredEmails] = useState<Set<string>>(new Set())

  useEffect(() => { fetchRequests() }, [filter])

  async function fetchRequests() {
    setLoading(true)
    const { data, error } = await supabase
      .from('partner_requests')
      .select('*')
      .eq('status', filter)
      .order('created_at', { ascending: false })
    if (error) console.error(error)
    else {
      setRequests(data ?? [])
      const emails = (data ?? []).map(r => r.email).filter(Boolean)
      setRegisteredEmails(await getRegisteredEmails(emails))
    }
    setLoading(false)
  }

async function approve(req: PartnerRequest) {
    // Step 1: get user_id from the request
    const { data: prRow, error: prFetchError } = await supabase
      .from('partner_requests')
      .select('user_id')
      .eq('id', req.id)
      .single()

    if (prFetchError || !prRow?.user_id) {
      alert('Could not find user for this request.')
      return
    }

    const userId = prRow.user_id

    // Step 2: build org update — apply proposed_data if present, else just publish
    const orgUpdate: Record<string, any> = { status: 'published' }

    if (req.proposed_data) {
      const pd = req.proposed_data
      if (pd.organisation_name) orgUpdate.organisation_name = pd.organisation_name
      if (pd.country)           orgUpdate.country           = pd.country
      if (pd.sector)            orgUpdate.sector            = pd.sector
      if (pd.needs)             orgUpdate.needs             = pd.needs
      if (pd.offers)            orgUpdate.offers            = pd.offers
      if (pd.description)       orgUpdate.description       = pd.description
      if (pd.organisation_type) orgUpdate.organisation_type = pd.organisation_type
      if (pd.website)           orgUpdate.website           = pd.website
    }

    const { error: orgError } = await supabase
      .from('organizations')
      .update(orgUpdate)
      .eq('user_id', userId)

    if (orgError) {
      alert(`Failed to update org: ${orgError.message}`)
      return
    }

    // Step 3: mark request approved
    const { error: prError } = await supabase
      .from('partner_requests')
      .update({ status: 'approved' })
      .eq('id', req.id)

    if (prError) alert(`Failed to approve request: ${prError.message}`)
    else setRequests(prev => prev.filter(r => r.id !== req.id))
  }

  async function reject(id: string) {
    const { error } = await supabase
      .from('partner_requests')
      .update({ status: 'rejected' })
      .eq('id', id)
    if (error) alert(`Failed to reject: ${error.message}`)
    else setRequests(prev => prev.filter(r => r.id !== id))
  }

  async function deleteRequest(id: string) {
    if (!confirm('Permanently delete this request? This cannot be undone.')) return
    const { error } = await supabase
      .from('partner_requests')
      .delete()
      .eq('id', id)
    if (error) alert(`Failed to delete: ${error.message}`)
    else setRequests(prev => prev.filter(r => r.id !== id))
  }

  return (
    <div>
      <div className="flex gap-2 mb-6">
        {(['pending', 'approved', 'rejected'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm border transition-colors capitalize ${
              filter === f
                ? 'bg-[#c1440e] border-[#c1440e] text-white'
                : 'border-white/20 text-white/50 hover:border-white/40'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-white/40">Loading...</p>
      ) : requests.length === 0 ? (
        <p className="text-white/40">No {filter} match requests.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {requests.map((req) => (
            <div key={req.id} className="border border-white/10 rounded-xl p-6 bg-white/5">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <h2 className="text-lg font-semibold">{req.organisation_name}</h2>
                  <p className="text-white/50 text-sm mt-0.5">
                    {req.contact_name} · {req.email}
                  </p>
                                    <div className="flex items-center gap-2 mt-1">
                    <p className="text-white/40 text-xs">Submitted {fmt(req.created_at)}</p>
                    <RegistrationTag email={req.email} registeredEmails={registeredEmails} />
                  </div>
                </div>
                                <div className="flex gap-2 shrink-0">
                  {filter === 'pending' && (
                    <>
                      <button
                        onClick={() => approve(req)}
                        className="px-4 py-1.5 rounded-full text-sm bg-[#2D6A4F] hover:bg-[#2D6A4F]/80 text-white transition-colors"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => reject(req.id)}
                        className="px-4 py-1.5 rounded-full text-sm border border-red-500/40 text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        Reject
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => deleteRequest(req.id)}
                    className="px-4 py-1.5 rounded-full text-sm border border-red-500/40 text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                {req.partner_sectors?.length > 0 && (
                  <div>
                    <p className="text-white/40 text-xs uppercase tracking-wide mb-1">Sectors</p>
                    <p className="text-white/80">{req.partner_sectors.join(', ')}</p>
                  </div>
                )}
                <div>
                  <p className="text-white/40 text-xs uppercase tracking-wide mb-1">
                    Identified partners?
                  </p>
                  <p className="text-white/80">
                    {req.has_identified_partners ? 'Yes' : 'No'}
                    {req.selected_partners?.length > 0 &&
                      ` (${req.selected_partners.length} selected)`}
                  </p>
                </div>
              </div>

              {req.proposed_data && (
                <div className="mt-3 border border-white/10 rounded-lg p-3 bg-white/3">
                  <p className="text-white/40 text-xs uppercase tracking-wide mb-2">
                    Proposed updates
                  </p>
                  <div className="flex flex-col gap-1 text-xs text-white/60">
                    {req.proposed_data.description && (
                      <p className="line-clamp-2">{req.proposed_data.description}</p>
                    )}
                    {req.proposed_data.needs?.length > 0 && (
                      <p>Needs: {req.proposed_data.needs.join(', ')}</p>
                    )}
                    {req.proposed_data.offers?.length > 0 && (
                      <p>Offers: {req.proposed_data.offers.join(', ')}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Match Results Panel — new, reads partnership_match_cache ─────────────────
type MatchRun = {
  org_id: string
  orgName: string
  computed_at: string
  matches: { matched_org_id: string; matchedOrgName: string; fit_score: number; rationale: string; key_synergy: string | null }[]
}

function MatchResultsPanel() {
  const [loading, setLoading] = useState(true)
  const [runs, setRuns] = useState<MatchRun[]>([])

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('partnership_match_cache')
      .select('org_id, matched_org_id, fit_score, rationale, key_synergy, computed_at')
      .order('computed_at', { ascending: false })
      .order('fit_score', { ascending: false })

    if (error || !data || data.length === 0) {
      setRuns([])
      setLoading(false)
      return
    }

    const orgIds = [...new Set(data.flatMap((d: any) => [d.org_id, d.matched_org_id]))]
    const { data: orgs } = await supabase.from('organizations').select('id, organisation_name').in('id', orgIds)
    const orgMap = new Map((orgs ?? []).map((o: any) => [o.id, o.organisation_name]))

    const grouped = new Map<string, MatchRun>()
    data.forEach((row: any) => {
      const key = `${row.org_id}__${row.computed_at}`
      if (!grouped.has(key)) {
        grouped.set(key, {
          org_id: row.org_id,
          orgName: orgMap.get(row.org_id) ?? 'Unknown organisation',
          computed_at: row.computed_at,
          matches: [],
        })
      }
      grouped.get(key)!.matches.push({
        matched_org_id: row.matched_org_id,
        matchedOrgName: orgMap.get(row.matched_org_id) ?? 'Unknown organisation',
        fit_score: row.fit_score,
        rationale: row.rationale,
        key_synergy: row.key_synergy,
      })
    })

    const runsArr = Array.from(grouped.values())
      .sort((a, b) => new Date(b.computed_at).getTime() - new Date(a.computed_at).getTime())
    setRuns(runsArr)
    setLoading(false)
  }

  return (
    <div>
      {loading ? (
        <p className="text-white/40">Loading...</p>
      ) : runs.length === 0 ? (
        <p className="text-white/40">No match runs yet. These populate automatically as eligible orgs visit their dashboard.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {runs.map(run => (
            <div key={`${run.org_id}-${run.computed_at}`} className="border border-white/10 rounded-xl p-6 bg-white/5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">{run.orgName}</h2>
                <span className="text-xs text-white/40">{fmt(run.computed_at)}</span>
              </div>
              <div className="space-y-2">
                {run.matches.map(m => (
                  <div key={m.matched_org_id} className="flex items-center justify-between gap-4 text-sm border border-white/10 rounded-lg px-3 py-2.5 bg-white/3">
                    <div className="min-w-0">
                      <p className="text-white/80 font-medium truncate">{m.matchedOrgName}</p>
                      <p className="text-white/50 text-xs mt-0.5 line-clamp-2">{m.rationale}</p>
                      {m.key_synergy && <p className="text-white/30 text-[11px] mt-0.5">{m.key_synergy}</p>}
                    </div>
                    <span className="text-[#6fcf97] text-xs font-semibold shrink-0">{m.fit_score}%</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Organizations Panel ──────────────────────────────────────────────────────
function OrganizationsPanel({ initialView }: { initialView?: OrgView }) {
  const [orgs, setOrgs]       = useState<Org[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView]       = useState<OrgView>(initialView ?? 'pending')
  const [registeredEmails, setRegisteredEmails] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (view === 'match_results') return
    fetchOrgs()
  }, [view])

  async function fetchOrgs() {
    setLoading(true)
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('status', view)
      .order('created_at', { ascending: false })
    if (error) console.error(error)
    else {
      setOrgs(data ?? [])
      const emails = (data ?? []).map(o => o.email).filter(Boolean)
      setRegisteredEmails(await getRegisteredEmails(emails))
    }
    setLoading(false)
  }

  async function updateStatus(id: string, newStatus: OrgView) {
    const { error } = await supabase
      .from('organizations')
      .update({ status: newStatus })
      .eq('id', id)
    if (error) alert(`Failed to update: ${error.message}`)
    else setOrgs(prev => prev.filter(o => o.id !== id))
  }

  async function deleteOrg(id: string) {
    if (!confirm('Permanently delete this organisation? This cannot be undone.')) return
    const { error } = await supabase
      .from('organizations')
      .delete()
      .eq('id', id)
    if (error) alert(`Failed to delete: ${error.message}`)
    else setOrgs(prev => prev.filter(o => o.id !== id))
  }

  return (
    <div>
      {/* Sub-tabs */}
      <div className="flex gap-2 mb-6">
        {([
          { value: 'pending',       label: 'Pending' },
          { value: 'published',     label: 'Approved' },
          { value: 'rejected',      label: 'Rejected' },
          { value: 'match_results', label: 'Match Results' },
        ] as const).map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setView(value)}
            className={`px-4 py-1.5 rounded-full text-sm border transition-colors ${
              view === value
                ? 'bg-[#c1440e] border-[#c1440e] text-white'
                : 'border-white/20 text-white/50 hover:border-white/40'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {view === 'match_results' ? (
        <MatchResultsPanel />
      ) : loading ? (
        <p className="text-white/40">Loading...</p>
      ) : orgs.length === 0 ? (
        <p className="text-white/40">No {view} organisations.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {orgs.map(org => {
            const sectors  = normalizeArr(org.sector)
            const countries = normalizeArr(org.country)
            return (
              <div key={org.id} className="border border-white/10 rounded-xl p-6 bg-white/5">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <h2 className="text-lg font-semibold">{org.organisation_name}</h2>
                    <p className="text-white/50 text-sm mt-0.5">
                      {org.organisation_type?.replace(/_/g, ' ')}
                      {countries.length > 0 && ` · ${countries.join(', ')}`}
                      {org.email && ` · ${org.email}`}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-white/40 text-xs">Submitted {fmt(org.created_at)}</p>
                      <RegistrationTag email={org.email} registeredEmails={registeredEmails} />
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {view === 'pending' && (
                      <>
                        <button onClick={() => updateStatus(org.id, 'published')}
                          className="px-4 py-1.5 rounded-full text-sm bg-[#2D6A4F] hover:bg-[#2D6A4F]/80 text-white transition-colors">
                          Approve
                        </button>
                        <button onClick={() => updateStatus(org.id, 'rejected')}
                          className="px-4 py-1.5 rounded-full text-sm border border-red-500/40 text-red-400 hover:bg-red-500/10 transition-colors">
                          Reject
                        </button>
                      </>
                    )}
                    {view === 'published' && (
                      <>
                        <button onClick={() => updateStatus(org.id, 'pending')}
                          className="px-4 py-1.5 rounded-full text-sm border border-white/20 text-white/60 hover:border-white/40 transition-colors">
                          Move to Pending
                        </button>
                        <button onClick={() => updateStatus(org.id, 'rejected')}
                          className="px-4 py-1.5 rounded-full text-sm border border-red-500/40 text-red-400 hover:bg-red-500/10 transition-colors">
                          Reject
                        </button>
                      </>
                    )}
                    {view === 'rejected' && (
                      <button onClick={() => updateStatus(org.id, 'published')}
                        className="px-4 py-1.5 rounded-full text-sm bg-[#2D6A4F] hover:bg-[#2D6A4F]/80 text-white transition-colors">
                        Restore
                      </button>
                    )}
                    <button onClick={() => deleteOrg(org.id)}
                      className="px-4 py-1.5 rounded-full text-sm border border-red-500/40 text-red-400 hover:bg-red-500/10 transition-colors">
                      Delete
                    </button>
                  </div>
                </div>

                {/* Description */}
                {org.description && (
                  <p className="text-white/70 text-sm mb-4 leading-relaxed line-clamp-3">
                    {org.description}
                  </p>
                )}

                {/* Meta grid */}
                <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                  {sectors.length > 0 && (
                    <div>
                      <p className="text-white/40 text-xs uppercase tracking-wide mb-1">Sectors</p>
                      <p className="text-white/80">{sectors.join(', ')}</p>
                    </div>
                  )}
                  {(org.needs?.length > 0 || org.offers?.length > 0) && (
                    <div>
                      <p className="text-white/40 text-xs uppercase tracking-wide mb-1">Needs / Offers</p>
                      <p className="text-white/80 text-xs">
                        {org.needs?.length > 0 && `Needs: ${org.needs.join(', ')}`}
                        {org.needs?.length > 0 && org.offers?.length > 0 && ' · '}
                        {org.offers?.length > 0 && `Offers: ${org.offers.join(', ')}`}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-4 text-xs text-white/50">
                  {org.website && org.website !== 'https://' && (
                    <a href={org.website} target="_blank" rel="noopener noreferrer"
                      className="text-[#6fcf97] hover:underline">
                      {org.website.replace(/^https?:\/\//, '')}
                    </a>
                  )}
                  {org.sdgs?.length > 0 && <span>SDGs: {org.sdgs.join(', ')}</span>}
                  {org.verification_consent && (
                    <span>Verification consent: {org.verification_consent}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Verification Panel ───────────────────────────────────────────────────────
type VerificationProfile = {
  id: string
  full_name: string | null
  email: string | null
  org_name: string | null
  role_title: string | null
  org_type: string | null
  user_type: string | null
  verification_requested: boolean
  is_verified: boolean
  verification_rejection_reason: string | null
  verification_rejected_at: string | null
  created_at: string
  // joined from organizations
  org_description?: string | null
  org_needs?: string[] | null
  org_offers?: string[] | null
  org_sdgs?: string[] | null
  org_sectors?: string[] | null
  org_country?: string | null
  org_registration_type?: string | null
  org_registration_number?: string | null
  org_tin?: string | null
  org_scuml_number?: string | null
  org_is_dnfbp_sector?: boolean | null
}

type VerificationDoc = {
  id: string
  profile_id: string
  name: string
  document_url: string | null
  file_path: string | null
  source_type: string
  created_at: string
}

function VerificationPanel({ initialFilter }: { initialFilter?: 'pending' | 'verified' | 'rejected' }) {
  const [profiles, setProfiles]   = useState<VerificationProfile[]>([])
  const [docs, setDocs]           = useState<Record<string, VerificationDoc[]>>({})
  const [loading, setLoading]     = useState(true)
  const [filter, setFilter]       = useState<'pending' | 'verified' | 'rejected'>(initialFilter ?? 'pending')
  const [rejectingId, setRejectingId]   = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  useEffect(() => { fetchProfiles() }, [filter])

  async function viewDocument(doc: VerificationDoc) {
    if (doc.source_type !== 'upload' || !doc.file_path) {
      if (doc.document_url) window.open(doc.document_url, '_blank', 'noopener,noreferrer')
      return
    }
    const { data, error } = await supabase.storage
      .from('verification-docs')
      .createSignedUrl(doc.file_path, 60)
    if (error || !data?.signedUrl) {
      alert('Could not open document. Please try again.')
      return
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  async function fetchProfiles() {
    setLoading(true)

    let query = supabase
      .from('profiles')
      .select('id, full_name, email, org_name, role_title, org_type, user_type, verification_requested, is_verified, verification_rejection_reason, verification_rejected_at, created_at')
      .order('created_at', { ascending: false })

    if (filter === 'pending') {
      query = query.eq('verification_requested', true).eq('is_verified', false)
    } else if (filter === 'verified') {
      query = query.eq('is_verified', true)
    } else {
      // Rejected specifically means a reason was recorded — distinct from a
      // profile that simply never applied, which also has both booleans false
      // but no reason. Filtering on the reason fixes a pre-existing bug where
      // never-applied profiles used to appear in the Rejected tab.
      query = query.eq('is_verified', false).not('verification_rejection_reason', 'is', null)
    }

    const { data, error } = await query
    if (error) console.error(error)
    const profileList = data ?? []
    // Fetch org data for all profiles
let enriched = profileList as VerificationProfile[];
if (profileList.length > 0) {
  const userIds = profileList.map(p => p.id);
  const { data: orgData } = await supabase
    .from("organizations")
    .select("user_id,description,needs,offers,sdgs,sector,country,registration_type,registration_number,tin,scuml_number,is_dnfbp_sector")
    .in("user_id", userIds);
  const orgMap = new Map((orgData ?? []).map((o: any) => [o.user_id, o]));
  enriched = profileList.map(p => {
    const org = orgMap.get(p.id);
    return {
      ...p,
      org_description:          org?.description ?? null,
      org_needs:                org?.needs       ?? null,
      org_offers:                org?.offers      ?? null,
      org_sdgs:                  org?.sdgs        ?? null,
      org_sectors:                normalizeArr(org?.sector),
      org_country:                Array.isArray(org?.country) ? org.country[0] : org?.country ?? null,
      org_registration_type:      org?.registration_type ?? null,
      org_registration_number:    org?.registration_number ?? null,
      org_tin:                    org?.tin ?? null,
      org_scuml_number:           org?.scuml_number ?? null,
      org_is_dnfbp_sector:        org?.is_dnfbp_sector ?? null,
    };
  });
}
setProfiles(enriched);

    // Fetch documents for all returned profiles in one query
    if (profileList.length > 0) {
      const ids = profileList.map((p) => p.id)
      const { data: docData, error: docError } = await supabase
        .from('verification_documents')
        .select('id, profile_id, name, document_url, file_path, source_type, created_at')
        .in('profile_id', ids)
      if (docError) console.error(docError)
      // Group docs by profile_id
      const grouped: Record<string, VerificationDoc[]> = {}
      for (const doc of docData ?? []) {
        if (!grouped[doc.profile_id]) grouped[doc.profile_id] = []
        grouped[doc.profile_id].push(doc)
      }
      setDocs(grouped)
    } else {
      setDocs({})
    }

    setLoading(false)
  }

  async function approve(profileId: string) {
    const { error } = await supabase
      .from('profiles')
      .update({
        is_verified: true,
        verification_rejection_reason: null,
        verification_rejected_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profileId)
    if (error) { alert(`Failed to approve profile: ${error.message}`); return; }
  
    const { error: orgError } = await supabase
      .from('organizations')
      .update({ verification_status: 'verified', status: 'published' })
      .eq('user_id', profileId)
  
    if (orgError) {
      alert(`Failed to update org: ${orgError.message}`)
    }
  
    await supabase.from('notifications').insert({
      user_id: profileId,
      type:    'verification_approved',
      title:   'Your organisation is now verified',
      body:    'Your verification has been reviewed and approved. Your profile now shows a verified badge across the platform.',
      link:    '/dashboard/natives',
    })
  
    setProfiles((prev) => prev.filter((p) => p.id !== profileId))
  }

  async function reject(profileId: string, reason: string) {
    if (!reason.trim()) { alert('Please provide a reason before rejecting.'); return; }

    const { error } = await supabase
      .from('profiles')
      .update({
        verification_requested: false,
        verification_rejection_reason: reason.trim(),
        verification_rejected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', profileId)
    if (error) { alert(`Failed to reject: ${error.message}`); return; }

    // Clear org verification status too
    await supabase
      .from('organizations')
      .update({ verification_status: 'not_verified' })
      .eq('user_id', profileId)

    await supabase.from('notifications').insert({
      user_id: profileId,
      type:    'verification_rejected',
      title:   'Verification not approved',
      body:    `Your verification request wasn't approved. Reason: ${reason.trim()}`,
      link:    '/verify',
    })

    setRejectingId(null)
    setRejectReason('')
    setProfiles((prev) => prev.filter((p) => p.id !== profileId))
  }

  return (
    <div>
      <div className="flex gap-2 mb-6">
        {([
          { value: 'pending',  label: 'Pending' },
          { value: 'verified', label: 'Verified' },
          { value: 'rejected', label: 'Rejected' },
        ] as const).map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={`px-4 py-1.5 rounded-full text-sm border transition-colors ${
              filter === value
                ? 'bg-[#c1440e] border-[#c1440e] text-white'
                : 'border-white/20 text-white/50 hover:border-white/40'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-white/40">Loading...</p>
      ) : profiles.length === 0 ? (
        <p className="text-white/40">No {filter} verification requests.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {profiles.map((profile) => {
            const profileDocs = docs[profile.id] ?? []
            return (
              <div key={profile.id} className="border border-white/10 rounded-xl p-6 bg-white/5">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <h2 className="text-lg font-semibold">
                      {profile.full_name ?? 'Unnamed'}
                    </h2>
                    <p className="text-white/50 text-sm mt-0.5">
                      {profile.org_name && `${profile.org_name}`}
                      {profile.role_title && ` · ${profile.role_title}`}
                      {profile.email && ` · ${profile.email}`}
                    </p>
                    <p className="text-white/40 text-xs mt-1">
                      {profile.org_type?.replace(/_/g, ' ')}
                      {profile.user_type && ` · ${profile.user_type.replace(/_/g, ' ')}`}
                      {' · Submitted '}{fmt(profile.created_at)}
                    </p>
                  </div>
                  {filter === 'pending' && rejectingId !== profile.id && (
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => approve(profile.id)}
                        className="px-4 py-1.5 rounded-full text-sm bg-[#2D6A4F] hover:bg-[#2D6A4F]/80 text-white transition-colors"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => { setRejectingId(profile.id); setRejectReason('') }}
                        className="px-4 py-1.5 rounded-full text-sm border border-red-500/40 text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                  {filter === 'verified' && (
                    <span className="text-xs px-3 py-1 rounded-full bg-[#2D6A4F]/30 text-[#6fcf97] border border-[#2D6A4F]/40">
                      Verified
                    </span>
                  )}
                  {filter === 'rejected' && profile.verification_rejection_reason && (
                    <span className="text-xs px-3 py-1 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                      Rejected
                    </span>
                  )}
                </div>

                {filter === 'pending' && rejectingId === profile.id && (
                  <div className="mt-3 border border-red-500/30 rounded-lg p-3 bg-red-500/5 space-y-2">
                    <p className="text-xs text-white/60">
                      Reason for rejection — this is shown to the org so they know what to fix.
                    </p>
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      rows={2}
                      autoFocus
                      placeholder="e.g. The uploaded document doesn't match the registration number provided."
                      className="w-full text-sm rounded-lg border border-white/10 bg-white/5 text-white px-3 py-2 focus:outline-none focus:border-red-500/40"
                    />
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => { setRejectingId(null); setRejectReason('') }}
                        className="px-3 py-1.5 rounded-full text-xs border border-white/20 text-white/60 hover:border-white/40 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => reject(profile.id, rejectReason)}
                        className="px-3 py-1.5 rounded-full text-xs bg-red-500/80 hover:bg-red-500 text-white transition-colors"
                      >
                        Confirm rejection
                      </button>
                    </div>
                  </div>
                )}

                {/* Statutory registration — cross-check against CAC's public search
                    portal (search.cac.gov.ng) before approving. No live API call yet;
                    this is manual verification with structured numbers instead of a
                    blind document. */}
                {profile.org_registration_type && (
                  <div className="mb-4 grid grid-cols-2 gap-3 text-xs border border-white/10 rounded-lg p-3 bg-white/3">
                    <div>
                      <p className="text-white/40 uppercase tracking-wide mb-1">Registration type</p>
                      <p className="text-white/80">
                        {profile.org_registration_type === "RC" && "Company (RC)"}
                        {profile.org_registration_type === "BN" && "Business Name (BN)"}
                        {profile.org_registration_type === "IT" && "Incorporated Trustees (IT)"}
                      </p>
                    </div>
                    <div>
                      <p className="text-white/40 uppercase tracking-wide mb-1">Registration number</p>
                      <p className="text-white/80">{profile.org_registration_number ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-white/40 uppercase tracking-wide mb-1">TIN</p>
                      <p className="text-white/80">{profile.org_tin ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-white/40 uppercase tracking-wide mb-1">SCUML number</p>
                      <p className="text-white/80">
                        {profile.org_scuml_number ?? (
                          profile.org_registration_type === "IT"
                            ? "Missing — mandatory for NGOs"
                            : "Not provided"
                        )}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <a
                        href={`https://search.cac.gov.ng/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#6fcf97] hover:underline"
                      >
                        Cross-check on CAC public search →
                      </a>
                    </div>
                  </div>
                )}

                {/* Org profile data */}
                {(profile.org_description || profile.org_needs?.length || profile.org_offers?.length || profile.org_sdgs?.length) && (
                  <div className="mb-4 grid grid-cols-2 gap-3 text-xs">
                    {profile.org_description && (
                      <div className="col-span-2">
                        <p className="text-white/40 uppercase tracking-wide mb-1">Organisation description</p>
                        <p className="text-white/70 leading-relaxed line-clamp-3">{profile.org_description}</p>
                      </div>
                    )}
                    {profile.org_needs?.length ? (
                      <div>
                        <p className="text-white/40 uppercase tracking-wide mb-1">Needs</p>
                        <p className="text-white/70">{profile.org_needs.join(", ")}</p>
                      </div>
                    ) : null}
                    {profile.org_offers?.length ? (
                      <div>
                        <p className="text-white/40 uppercase tracking-wide mb-1">Offers</p>
                        <p className="text-white/70">{profile.org_offers.join(", ")}</p>
                      </div>
                    ) : null}
                    {profile.org_sdgs?.length ? (
                      <div className="col-span-2">
                        <p className="text-white/40 uppercase tracking-wide mb-1">SDGs</p>
                        <p className="text-white/70">{profile.org_sdgs.join(", ")}</p>
                      </div>
                    ) : null}
                  </div>
                )}

                <AdminTriageSummary
                  type="verification"
                  data={{
                    full_name:   profile.full_name,
                    org_name:    profile.org_name,
                    role_title:  profile.role_title,
                    org_type:    profile.org_type,
                    description: profile.org_description,
                    sectors:     profile.org_sectors,
                    country:     profile.org_country,
                    doc_count:   profileDocs.length,
                    doc_names:   profileDocs.map(d => d.name),
                  }}
                />

                {filter === 'rejected' && profile.verification_rejection_reason && (
                  <div className="mb-4 border border-red-500/20 rounded-lg p-3 bg-red-500/5">
                    <p className="text-white/40 text-xs uppercase tracking-wide mb-1">Rejection reason</p>
                    <p className="text-white/80 text-sm leading-relaxed">{profile.verification_rejection_reason}</p>
                    {profile.verification_rejected_at && (
                      <p className="text-white/30 text-xs mt-1">Rejected {fmt(profile.verification_rejected_at)}</p>
                    )}
                  </div>
                )}

                {/* Documents */}
                {profileDocs.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-white/40 text-xs uppercase tracking-wide mb-2">Documents</p>
                    {profileDocs.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between text-xs border border-white/10 rounded-lg px-3 py-2 bg-white/3">
                                                <div className="flex flex-col gap-0.5 min-w-0">
                          <span className="font-medium text-white/80 truncate">{doc.name}</span>
                          <span className="text-white/40">{doc.source_type === 'upload' ? 'Uploaded file' : 'Pasted link'}</span>
                        </div>
                        <button type="button" onClick={() => viewDocument(doc)} className="ml-4 shrink-0 text-[#6fcf97] hover:underline">View →</button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-white/30 text-xs">No documents submitted.</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}


// ─── Flagged Orgs Panel ───────────────────────────────────────────────────────
type FlaggedOrg = {
  id: string
  organisation_name: string
  email: string | null
  user_id: string | null
  created_at: string
  dd_evidence: Record<string, any> | null
  flagged_review_status: string
  flagged_review_notes: string | null
  flagged_reviewed_at: string | null
  flagged_review_due: string | null
  flagged_visibility_hold: boolean
}

const SEVERITY_OPTIONS = [
  { value: 'unreviewed', label: 'Unreviewed',      accent: 'border-white/20 text-white/50' },
  { value: 'minor',      label: 'Minor — keep visible', accent: 'border-amber-500/40 text-amber-400' },
  { value: 'serious',    label: 'Serious — hold visibility', accent: 'border-red-500/40 text-red-400' },
  { value: 'cleared',    label: 'Cleared — resolved', accent: 'border-[#2D6A4F]/40 text-[#6fcf97]' },
] as const

function FlaggedOrgsPanel() {
  const [orgs, setOrgs]       = useState<FlaggedOrg[]>([])
  const [loading, setLoading] = useState(true)
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({})
  const [dueDraft, setDueDraft]     = useState<Record<string, string>>({})

  useEffect(() => { fetchFlagged() }, [])

  async function fetchFlagged() {
    setLoading(true)
    // Mirrors computeTrustTier's flag trigger exactly (ddItems.ts) — a red flag
    // is hasBlacklisting OR hasPendingDisputes in the legal_compliance_declaration
    // DD item. Kept as a direct read of the same jsonb rather than a separate
    // stored flag, so this list can never drift from what the Trust Badge shows.
    const { data, error } = await supabase
      .from('organizations')
      .select('id, organisation_name, email, user_id, created_at, dd_evidence, flagged_review_status, flagged_review_notes, flagged_reviewed_at, flagged_review_due, flagged_visibility_hold')
      .or('dd_evidence->legal_compliance_declaration->>hasBlacklisting.eq.true,dd_evidence->legal_compliance_declaration->>hasPendingDisputes.eq.true')
      .order('created_at', { ascending: false })

    if (error) { console.error(error); setOrgs([]); setLoading(false); return }
    setOrgs(data ?? [])
    setLoading(false)
  }

  async function saveReview(org: FlaggedOrg, status: string) {
    const notes = notesDraft[org.id] ?? org.flagged_review_notes ?? ''
    const due   = dueDraft[org.id] ?? (org.flagged_review_due ? org.flagged_review_due.slice(0, 10) : '')

    const { error } = await supabase
      .from('organizations')
      .update({
        flagged_review_status: status,
        flagged_review_notes: notes.trim() || null,
        flagged_reviewed_at: new Date().toISOString(),
        flagged_review_due: due ? new Date(due).toISOString() : null,
        flagged_visibility_hold: status === 'serious',
      })
      .eq('id', org.id)

    if (error) { alert(`Failed to save: ${error.message}`); return }
    await fetchFlagged()
  }

  function daysUntil(dateStr: string | null): number | null {
    if (!dateStr) return null
    return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  }

  return (
    <div>
      {loading ? (
        <p className="text-white/40">Loading...</p>
      ) : orgs.length === 0 ? (
        <p className="text-white/40">No organisations currently flagged. This list mirrors the Trust Badge's flag trigger — blacklisting or pending disputes disclosed in the DD checklist.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {orgs.map((org) => {
            const legal = org.dd_evidence?.legal_compliance_declaration ?? {}
            const due = daysUntil(org.flagged_review_due)
            return (
              <div key={org.id} className="border border-red-500/20 rounded-xl p-6 bg-white/5">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <h2 className="text-lg font-semibold">{org.organisation_name}</h2>
                    <p className="text-white/50 text-sm mt-0.5">{org.email}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {due !== null && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${due < 0 ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-white/5 text-white/40 border-white/10'}`}>
                        {due < 0 ? `Re-review overdue by ${Math.abs(due)}d` : `Re-review in ${due}d`}
                      </span>
                    )}
                    {org.flagged_visibility_hold && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                        Withheld from directory
                      </span>
                    )}
                  </div>
                </div>

                {/* What was actually disclosed */}
                <div className="grid grid-cols-2 gap-3 text-xs mb-4 border border-white/10 rounded-lg p-3 bg-white/3">
                  {legal.hasBlacklisting && (
                    <div>
                      <p className="text-white/40 uppercase tracking-wide mb-1">Blacklisting disclosed</p>
                      <p className="text-white/80">{legal.blacklistingDetail || 'No further detail provided.'}</p>
                    </div>
                  )}
                  {legal.hasPendingDisputes && (
                    <div>
                      <p className="text-white/40 uppercase tracking-wide mb-1">Pending disputes disclosed</p>
                      <p className="text-white/80">{legal.pendingDisputesDetail || 'No further detail provided.'}</p>
                    </div>
                  )}
                </div>

                {/* Current status */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs text-white/40">Status:</span>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full border ${SEVERITY_OPTIONS.find(s => s.value === org.flagged_review_status)?.accent ?? 'border-white/20 text-white/50'}`}>
                    {SEVERITY_OPTIONS.find(s => s.value === org.flagged_review_status)?.label ?? 'Unreviewed'}
                  </span>
                  {org.flagged_reviewed_at && (
                    <span className="text-xs text-white/30">Reviewed {fmt(org.flagged_reviewed_at)}</span>
                  )}
                </div>

                {/* Review notes */}
                <div className="mb-3">
                  <p className="text-white/40 text-xs uppercase tracking-wide mb-1">Review notes — document what you learned when you reached out</p>
                  <textarea
                    value={notesDraft[org.id] ?? org.flagged_review_notes ?? ''}
                    onChange={(e) => setNotesDraft((prev) => ({ ...prev, [org.id]: e.target.value }))}
                    rows={2}
                    placeholder="e.g. Called the org — the dispute is a settled vendor invoice disagreement, no ongoing risk."
                    className="w-full text-sm rounded-lg border border-white/10 bg-white/5 text-white px-3 py-2 focus:outline-none focus:border-white/30"
                  />
                </div>

                {/* Re-review due date */}
                <div className="mb-4">
                  <p className="text-white/40 text-xs uppercase tracking-wide mb-1">Re-review due</p>
                  <input
                    type="date"
                    value={dueDraft[org.id] ?? (org.flagged_review_due ? org.flagged_review_due.slice(0, 10) : '')}
                    onChange={(e) => setDueDraft((prev) => ({ ...prev, [org.id]: e.target.value }))}
                    className="text-sm rounded-lg border border-white/10 bg-white/5 text-white px-3 py-1.5 focus:outline-none focus:border-white/30"
                  />
                </div>

                {/* Severity actions */}
                <div className="flex flex-wrap gap-2">
                  {SEVERITY_OPTIONS.filter(s => s.value !== 'unreviewed').map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => saveReview(org, opt.value)}
                      className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${opt.accent} hover:bg-white/5`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ContactSubmissionsPanel() {
  const [submissions, setSubmissions] = useState<ContactSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [registeredEmails, setRegisteredEmails] = useState<Set<string>>(new Set())

  useEffect(() => { fetchSubmissions() }, [])

  async function fetchSubmissions() {
    setLoading(true)
    const { data, error } = await supabase
      .from('contact_submissions')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) console.error(error)
    else {
      setSubmissions(data ?? [])
      const emails = (data ?? []).map(s => s.email).filter(Boolean)
      setRegisteredEmails(await getRegisteredEmails(emails))
    }
    setLoading(false)
  }

  async function deleteSubmission(id: string) {
    if (!confirm('Delete this submission?')) return
    const { error } = await supabase.from('contact_submissions').delete().eq('id', id)
    if (error) alert(`Failed: ${error.message}`)
    else setSubmissions(prev => prev.filter(s => s.id !== id))
  }

  return (
    <div>
      {loading ? (
        <p className="text-white/40">Loading...</p>
      ) : submissions.length === 0 ? (
        <p className="text-white/40">No contact submissions.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {submissions.map((s) => (
            <div key={s.id} className="border border-white/10 rounded-xl p-6 bg-white/5">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <h2 className="text-lg font-semibold">{s.first_name} {s.last_name}</h2>
                  <p className="text-white/50 text-sm mt-0.5">{s.email}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-white/40 text-xs">Submitted {fmt(s.created_at)}</p>
                    <RegistrationTag email={s.email} registeredEmails={registeredEmails} />
                  </div>
                </div>
                <button onClick={() => deleteSubmission(s.id)}
                  className="px-3 py-1.5 rounded-full text-xs border border-red-500/40 text-red-400 hover:bg-red-500/10 transition-colors shrink-0">
                  Delete
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                <div>
                  <p className="text-white/40 text-xs uppercase tracking-wide mb-1">Reason</p>
                  <p className="text-white/80 capitalize">{s.reason}</p>
                </div>
              </div>
              <div>
                <p className="text-white/40 text-xs uppercase tracking-wide mb-1">Message</p>
                <p className="text-white/70 text-sm leading-relaxed">{s.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Lab Requests Panel ───────────────────────────────────────────────────────
type LabRequest = {
  id: string
  user_id: string | null
  contact_name: string
  email: string
  organisation_name: string
  organisation_type: string
  problem: string
  why_it_matters: string
  geography: string
  sector: string
  desired_participants: string[]
  expected_outcomes: string[]
  idea_stages: string[]
  budget_tier: string
  budget_range: string
  status: string
  created_at: string
}

type ContactSubmission = {
  id: string
  first_name: string
  last_name: string
  email: string
  reason: string
  message: string
  created_at: string
}

const LAB_STATUS_OPTIONS = [
  { value: 'proposal_review', label: 'Under review' },
  { value: 'approved',        label: 'Approved' },
  { value: 'rejected',        label: 'Not approved' },
  { value: 'in_progress',     label: 'In progress' },
  { value: 'completed',       label: 'Completed' },
]

function LabRequestsPanel({ initialFilter }: { initialFilter?: string }) {
  const [labs, setLabs]       = useState<LabRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState(initialFilter ?? 'proposal_review')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [registeredEmails, setRegisteredEmails] = useState<Set<string>>(new Set())

  useEffect(() => { fetchLabs() }, [filter])

  async function fetchLabs() {
    setLoading(true)
    const { data, error } = await supabase
      .from('lab_requests')
      .select('*')
      .eq('status', filter)
      .order('created_at', { ascending: false })
    if (error) console.error(error)
    else {
      setLabs(data ?? [])
      const emails = (data ?? []).map(l => l.email).filter(Boolean)
      setRegisteredEmails(await getRegisteredEmails(emails))
    }
    setLoading(false)
  }

  async function updateStatus(id: string, newStatus: string) {
    const { data: labData } = await supabase
      .from('lab_requests')
      .select('user_id, problem')
      .eq('id', id)
      .single()

    const { error } = await supabase
      .from('lab_requests')
      .update({ status: newStatus })
      .eq('id', id)

    if (error) {
      alert(`Failed to update: ${error.message}`)
      return
    }

    if (labData?.user_id) {
      const statusLabels: Record<string, string> = {
        approved:    'Your lab proposal has been approved.',
        rejected:    'Your lab proposal was not taken forward.',
        in_progress: 'Your Innovation Lab is now in progress.',
        completed:   'Your Innovation Lab has been completed.',
      }
      const body = statusLabels[newStatus]
      if (body) {
        await supabase.from('notifications').insert({
          user_id: labData.user_id,
          type:    'lab_status_update',
          title:   'Lab request update',
          body,
          link:    '/dashboard/labs',
        })
      }
    }

    setLabs(prev => prev.filter(l => l.id !== id))
  }

  async function deleteLab(id: string) {
    if (!confirm('Permanently delete this lab request?')) return
    const { error } = await supabase
      .from('lab_requests')
      .delete()
      .eq('id', id)
    if (error) alert(`Failed to delete: ${error.message}`)
    else setLabs(prev => prev.filter(l => l.id !== id))
  }

  return (
    <div>
      <div className="flex gap-2 mb-6 flex-wrap">
        {LAB_STATUS_OPTIONS.map(({ value, label }) => (
          <button key={value} onClick={() => setFilter(value)}
            className={`px-4 py-1.5 rounded-full text-sm border transition-colors ${
              filter === value
                ? 'bg-[#c1440e] border-[#c1440e] text-white'
                : 'border-white/20 text-white/50 hover:border-white/40'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-white/40">Loading...</p>
      ) : labs.length === 0 ? (
        <p className="text-white/40">No lab requests with this status.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {labs.map((lab) => (
            <div key={lab.id} className="border border-white/10 rounded-xl p-6 bg-white/5">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <h2 className="text-lg font-semibold line-clamp-2">
                    {lab.problem || "Lab request"}
                  </h2>
                  <p className="text-white/50 text-sm mt-0.5">
                    {lab.contact_name}
                    {lab.organisation_name && ` · ${lab.organisation_name}`}
                    {` · ${lab.email}`}
                  </p>
                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <p className="text-white/40 text-xs">{lab.sector} · {lab.geography} · Submitted {fmt(lab.created_at)}</p>
                    <RegistrationTag email={lab.email} registeredEmails={registeredEmails} />
                  </div>
                </div>
                <div className="flex gap-2 shrink-0 flex-wrap justify-end">
                  {LAB_STATUS_OPTIONS.filter(o => o.value !== filter).map(({ value, label }) => (
                    <button key={value} onClick={() => updateStatus(lab.id, value)}
                      className="px-3 py-1.5 rounded-full text-xs border border-white/20 text-white/60 hover:border-white/40 transition-colors">
                      → {label}
                    </button>
                  ))}
                  <button onClick={() => deleteLab(lab.id)}
                    className="px-3 py-1.5 rounded-full text-xs border border-red-500/40 text-red-400 hover:bg-red-500/10 transition-colors">
                    Delete
                  </button>
                </div>
              </div>

              {/* Budget */}
              {(lab.budget_tier || lab.budget_range) && (
                <p className="text-white/50 text-xs mb-3">
                  Budget: {[lab.budget_tier, lab.budget_range].filter(Boolean).join(' — ')}
                </p>
              )}

              {/* Expand toggle */}
              <button type="button"
                onClick={() => setExpanded(expanded === lab.id ? null : lab.id)}
                className="text-xs text-white/40 hover:text-white/70 transition-colors">
                {expanded === lab.id ? '▲ Hide details' : '▼ Show full submission'}
              </button>

              {expanded === lab.id && (
                <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
                  {lab.why_it_matters && (
                    <div>
                      <p className="text-white/40 text-xs uppercase tracking-wide mb-1">Why it matters</p>
                      <p className="text-white/70 text-sm leading-relaxed">{lab.why_it_matters}</p>
                    </div>
                  )}
                  {lab.desired_participants?.length > 0 && (
                    <div>
                      <p className="text-white/40 text-xs uppercase tracking-wide mb-1">Who should be in the room</p>
                      <p className="text-white/70 text-sm">{lab.desired_participants.join(', ')}</p>
                    </div>
                  )}
                  {lab.expected_outcomes?.length > 0 && (
                    <div>
                      <p className="text-white/40 text-xs uppercase tracking-wide mb-1">Expected outcomes</p>
                      <p className="text-white/70 text-sm">{lab.expected_outcomes.join(', ')}</p>
                    </div>
                  )}
                  {lab.idea_stages?.length > 0 && (
                    <div>
                      <p className="text-white/40 text-xs uppercase tracking-wide mb-1">Idea stage</p>
                      <p className="text-white/70 text-sm">{lab.idea_stages.join(', ')}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Users Panel ──────────────────────────────────────────────────────────────
type UserRow = {
  id: string
  full_name: string | null
  email: string | null
  user_type: string | null
  org_name: string | null
  country: string | null
  is_verified: boolean
  is_admin: boolean
  is_active: boolean
  onboarding_completed: boolean
  created_at: string
}

function UsersPanel({ initialFilter }: { initialFilter?: 'all' | 'inactive' }) {
  const [users, setUsers]     = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState<'all' | 'inactive'>(initialFilter ?? 'all')
  const [search, setSearch]   = useState('')

  useEffect(() => { fetchUsers() }, [filter])

  async function fetchUsers() {
    setLoading(true)
    let query = supabase
      .from('profiles')
      .select('id, full_name, email, user_type, org_name, country, is_verified, is_admin, is_active, onboarding_completed, created_at')
      .order('created_at', { ascending: false })

    if (filter === 'inactive') query = query.eq('is_active', false)

    const { data, error } = await query
    if (error) console.error(error)
    else setUsers(data ?? [])
    setLoading(false)
  }

  async function toggleActive(user: UserRow) {
    const newVal = !user.is_active
    if (!newVal && !confirm(`Deactivate ${user.full_name ?? user.email}? They will be signed out and unable to log in.`)) return
    const { error } = await supabase
      .from('profiles')
      .update({ is_active: newVal })
      .eq('id', user.id)
    if (error) alert(`Failed: ${error.message}`)
    else setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_active: newVal } : u))
  }

  async function toggleAdmin(user: UserRow) {
    const newVal = !user.is_admin
    if (!confirm(`${newVal ? 'Grant' : 'Remove'} admin access for ${user.full_name ?? user.email}?`)) return
    const { error } = await supabase
      .from('profiles')
      .update({ is_admin: newVal })
      .eq('id', user.id)
    if (error) alert(`Failed: ${error.message}`)
    else setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_admin: newVal } : u))
  }

  async function deleteUser(user: UserRow) {
    if (!confirm(`Permanently delete ${user.full_name ?? user.email}? This cannot be undone.`)) return
    const { error } = await supabase.rpc('delete_user_by_id', { target_user_id: user.id })
    if (error) alert(`Failed: ${error.message}`)
    else setUsers(prev => prev.filter(u => u.id !== user.id))
  }

  const filtered = users.filter(u => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      u.full_name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.org_name?.toLowerCase().includes(q)
    )
  })

  return (
    <div>
      <div className="flex gap-3 mb-6 items-center">
        <div className="flex gap-2">
          {([
            { value: 'all',      label: 'All users' },
            { value: 'inactive', label: 'Deactivated' },
          ] as const).map(({ value, label }) => (
            <button key={value} onClick={() => setFilter(value)}
              className={`px-4 py-1.5 rounded-full text-sm border transition-colors ${
                filter === value
                  ? 'bg-[#c1440e] border-[#c1440e] text-white'
                  : 'border-white/20 text-white/50 hover:border-white/40'
              }`}>
              {label}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search by name, email, org..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="ml-auto bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 w-64"
        />
      </div>

      {loading ? (
        <p className="text-white/40">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="text-white/40">No users found.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((user) => (
            <div key={user.id} className={`border rounded-xl px-5 py-4 flex items-center justify-between gap-4 ${
              !user.is_active ? 'border-red-500/20 bg-red-500/5' : 'border-white/10 bg-white/5'
            }`}>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-white">{user.full_name ?? '—'}</p>
                  {user.is_admin && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#2D6A4F]/40 text-[#6fcf97] border border-[#2D6A4F]/30">
                      Admin
                    </span>
                  )}
                  {user.is_verified && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/20">
                      Verified
                    </span>
                  )}
                  {!user.is_active && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/20">
                      Deactivated
                    </span>
                  )}
                </div>
                <p className="text-xs text-white/50 mt-0.5">
                  {user.email}
                  {user.org_name && ` · ${user.org_name}`}
                  {user.country && ` · ${user.country}`}
                </p>
                <p className="text-xs text-white/30 mt-0.5">
                  {user.user_type?.replace(/_/g, ' ')} · Joined {fmt(user.created_at)}
                </p>
              </div>
              <div className="flex gap-2 shrink-0 flex-wrap justify-end">
                <button onClick={() => toggleActive(user)}
                  className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                    user.is_active
                      ? 'border-amber-500/40 text-amber-400 hover:bg-amber-500/10'
                      : 'border-[#2D6A4F]/40 text-[#6fcf97] hover:bg-[#2D6A4F]/10'
                  }`}>
                  {user.is_active ? 'Deactivate' : 'Reactivate'}
                </button>
                <button onClick={() => toggleAdmin(user)}
                  className="px-3 py-1.5 rounded-full text-xs border border-white/20 text-white/50 hover:border-white/40 transition-colors">
                  {user.is_admin ? 'Remove admin' : 'Make admin'}
                </button>
                <button onClick={() => deleteUser(user)}
                  className="px-3 py-1.5 rounded-full text-xs border border-red-500/40 text-red-400 hover:bg-red-500/10 transition-colors">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
