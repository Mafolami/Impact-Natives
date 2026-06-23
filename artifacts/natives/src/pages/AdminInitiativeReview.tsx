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

type TabSection = 'initiatives' | 'organizations' | 'partner_requests' | 'verification' | 'lab_requests' | 'users' | 'contact'
type InitiativeFilter = 'pending' | 'published' | 'rejected'
type OrgFilter = 'pending' | 'published' | 'rejected'

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
  const [section, setSection] = useState<TabSection>('initiatives')

  return (
    <div className="min-h-screen p-8" style={{ background: '#0f1a14', color: 'white' }}>
      <h1 className="text-2xl font-bold mb-1">Admin Review</h1>
      <p className="text-white/50 text-sm mb-6">
        Review submissions before they appear on the platform.
      </p>

      {/* Section switcher */}
      <div className="flex gap-2 mb-8 border-b border-white/10 pb-4">
                {([
          { value: 'initiatives',      label: 'Initiatives' },
          { value: 'organizations',    label: 'Get Matched' },
          { value: 'verification',     label: 'Verification' },
          { value: 'lab_requests',     label: 'Lab Requests' },
          { value: 'users',            label: 'Users' },
          { value: 'partner_requests', label: 'Partner With Natives' },
          { value: 'contact', label: 'Contact' },
        ] as const).map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setSection(value)}
            className={`px-5 py-1.5 rounded-full text-sm border transition-colors ${
              section === value
                ? 'bg-[#2D6A4F] text-white border-[#2D6A4F] font-semibold'
                : 'border-white/20 text-white/50 hover:border-white/40 hover:text-white/80'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Section description */}

      <div className="mb-6 text-sm text-white/40 border border-white/08 rounded-lg px-4 py-3 bg-white/03">
        {section === 'initiatives' && 'Initiative submissions from the marketplace. Review and approve before they go live.'}
        {section === 'organizations' && 'Organisations seeking partners through the Find a Partner flow. Review and approve to make them visible to potential matches.'}
        {section === 'partner_requests' && 'Institutional partnership requests submitted via the Partner With Natives page. These are requests to collaborate with Impact Natives directly.'}
        {section === 'verification' && 'Organisations and individuals requesting verified status. Review their documents before approving.'}
        {section === 'lab_requests' && 'Innovation Lab proposals from the Commission a Lab page. Move through stages as you engage each client.'}
        {section === 'users' && 'All registered accounts. Manage access, admin rights, and account status.'}
        {section === 'contact' && 'Messages submitted via the Contact Us form. No approval needed — for your awareness and response.'}
      </div>

      {section === 'initiatives' && <InitiativesPanel />}
      {section === 'organizations' && <OrganizationsPanel />}
      {section === 'partner_requests' && <PartnerRequestsPanel />}
      {section === 'verification' && <VerificationPanel />}
      {section === 'lab_requests' && <LabRequestsPanel />}
      {section === 'users' && <UsersPanel />}
      {section === 'contact' && <ContactSubmissionsPanel />}
    </div>
  )
}

// ─── Initiatives Panel ────────────────────────────────────────────────────────
function InitiativesPanel() {
  const [initiatives, setInitiatives] = useState<Initiative[]>([])
  const [loading, setLoading]         = useState(true)
  const [filter, setFilter]           = useState<InitiativeFilter>('pending')
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

function PartnerRequestsPanel() {
  const [requests, setRequests] = useState<PartnerRequest[]>([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState<'pending' | 'approved' | 'rejected'>('pending')
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

// ─── Organizations Panel ──────────────────────────────────────────────────────
function OrganizationsPanel() {
  const [orgs, setOrgs]       = useState<Org[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState<OrgFilter>('pending')
  const [registeredEmails, setRegisteredEmails] = useState<Set<string>>(new Set())

  useEffect(() => { fetchOrgs() }, [filter])

  async function fetchOrgs() {
    setLoading(true)
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('status', filter)
      .order('created_at', { ascending: false })
    if (error) console.error(error)
    else {
      setOrgs(data ?? [])
      const emails = (data ?? []).map(o => o.email).filter(Boolean)
      setRegisteredEmails(await getRegisteredEmails(emails))
    }
    setLoading(false)
  }

  async function updateStatus(id: string, newStatus: OrgFilter) {
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
      ) : orgs.length === 0 ? (
        <p className="text-white/40">No {filter} organisations.</p>
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
                    {filter === 'pending' && (
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
                    {filter === 'published' && (
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
                    {filter === 'rejected' && (
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
  created_at: string
  // joined from organizations
  org_description?: string | null
  org_needs?: string[] | null
  org_offers?: string[] | null
  org_sdgs?: string[] | null
  org_sectors?: string[] | null
  org_country?: string | null
}

type VerificationDoc = {
  id: string
  profile_id: string
  name: string
  document_url: string
  source_type: string
  created_at: string
}

function VerificationPanel() {
  const [profiles, setProfiles]   = useState<VerificationProfile[]>([])
  const [docs, setDocs]           = useState<Record<string, VerificationDoc[]>>({})
  const [loading, setLoading]     = useState(true)
  const [filter, setFilter]       = useState<'pending' | 'verified' | 'rejected'>('pending')

  useEffect(() => { fetchProfiles() }, [filter])

  async function fetchProfiles() {
    setLoading(true)

    let query = supabase
      .from('profiles')
      .select('id, full_name, email, org_name, role_title, org_type, user_type, verification_requested, is_verified, created_at')
      .order('created_at', { ascending: false })

    if (filter === 'pending') {
      query = query.eq('verification_requested', true).eq('is_verified', false)
    } else if (filter === 'verified') {
      query = query.eq('is_verified', true)
    } else {
      // rejected = verification_requested false and is_verified false
      // we track this by absence — show profiles where both are false and had docs submitted
      query = query.eq('verification_requested', false).eq('is_verified', false)
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
    .select("user_id,description,needs,offers,sdgs,sector,country")
    .in("user_id", userIds);
  const orgMap = new Map((orgData ?? []).map((o: any) => [o.user_id, o]));
  enriched = profileList.map(p => {
    const org = orgMap.get(p.id);
    return {
      ...p,
      org_description: org?.description ?? null,
      org_needs:       org?.needs       ?? null,
      org_offers:      org?.offers      ?? null,
      org_sdgs:        org?.sdgs        ?? null,
      org_sectors:     normalizeArr(org?.sector),
      org_country:     Array.isArray(org?.country) ? org.country[0] : org?.country ?? null,
    };
  });
}
setProfiles(enriched);

    // Fetch documents for all returned profiles in one query
    if (profileList.length > 0) {
      const ids = profileList.map((p) => p.id)
      const { data: docData, error: docError } = await supabase
        .from('verification_documents')
        .select('id, profile_id, name, document_url, source_type, created_at')
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
      .update({ is_verified: true, updated_at: new Date().toISOString() })
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

  async function reject(profileId: string) {
    const { error } = await supabase
      .from('profiles')
      .update({ verification_requested: false, updated_at: new Date().toISOString() })
      .eq('id', profileId)
    if (error) { alert(`Failed to reject: ${error.message}`); return; }

    // Clear org verification status too
    await supabase
      .from('organizations')
      .update({ verification_status: 'not_verified' })
      .eq('user_id', profileId)

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
                  {filter === 'pending' && (
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => approve(profile.id)}
                        className="px-4 py-1.5 rounded-full text-sm bg-[#2D6A4F] hover:bg-[#2D6A4F]/80 text-white transition-colors"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => reject(profile.id)}
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
                </div>

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
                        <a href={doc.document_url} target="_blank" rel="noopener noreferrer" className="ml-4 shrink-0 text-[#6fcf97] hover:underline">View →</a>
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

function LabRequestsPanel() {
  const [labs, setLabs]       = useState<LabRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState('proposal_review')
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

function UsersPanel() {
  const [users, setUsers]     = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState<'all' | 'inactive'>('all')
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