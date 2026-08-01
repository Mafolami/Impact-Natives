// ─── EditInitiativeModalDashboard.tsx ──────────────────────────────────────────
import { useState, useRef, useEffect } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import { supabase } from "@/lib/supabase"
import { SECTOR_OPTIONS } from "@/lib/sectors"
import { X, Loader2, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/context/AuthContext"
import { AIDescriptionGenerator } from "./CreateInitiativeModalDashboard"

type PartnershipType = "funding" | "technical" | "operational" | "leadership" | "strategic" | "lead"
type InitiativeStage = "concept" | "planning" | "active" | "scaling"

interface EditFormState {
  title: string
  sectors: string[]
  locations: string[]
  openToRemotePartnerships: boolean
  targetPopulation: string
  budgetMin: string
  budgetMax: string
  currency: string
  detailContent: string
  resourceLink: string
  impactEvidence: string
  problem: string
  outcome: string
  tags: string[]
  partnerships: PartnershipType[]
  sdgTags: string[]
  specificAsk: string
  startDate: string
  duration: string
  esg: boolean | null
  stage: InitiativeStage | null
  confirmedAssets: string[]
  hadPriorExperience: boolean | null
  priorExperienceDetail: string
  targetBeneficiaries: string
  targetJobs: string
  targetFemalePct: string
  targetTimelineMonths: string
}

// Fields where a change materially affects what a funder/partner already
// committed to when they expressed interest — changing any of these on an
// initiative with active EOIs triggers a notification + edited_since_review
// flag. Everything NOT in this list (remote-partnerships toggle, resource
// link, tags, full description, etc.) is treated as cosmetic/supporting and
// can be edited freely with no notification.
const SUBSTANTIVE_FIELDS: { key: keyof EditFormState; label: string }[] = [
  { key: "title", label: "Title" },
  { key: "problem", label: "Problem statement" },
  { key: "outcome", label: "Expected outcome" },
  { key: "sectors", label: "Sectors" },
  { key: "locations", label: "Locations" },
  { key: "budgetMin", label: "Budget (min)" },
  { key: "budgetMax", label: "Budget (max)" },
  { key: "currency", label: "Currency" },
  { key: "specificAsk", label: "Specific ask" },
  { key: "partnerships", label: "Partnerships sought" },
  { key: "stage", label: "Stage" },
  { key: "targetBeneficiaries", label: "Target beneficiaries" },
  { key: "targetJobs", label: "Target jobs" },
  { key: "targetFemalePct", label: "Female beneficiaries target" },
  { key: "targetTimelineMonths", label: "Timeline" },
  { key: "esg", label: "ESG/CSR alignment" },
]

const SDG_OPTIONS = [
  "No Poverty", "Zero Hunger", "Good Health and Well-being", "Quality Education",
  "Gender Equality", "Clean Water and Sanitation", "Affordable and Clean Energy",
  "Decent Work and Economic Growth", "Industry Innovation and Infrastructure",
  "Reduced Inequalities", "Sustainable Cities and Communities",
  "Responsible Consumption and Production", "Climate Action", "Life Below Water",
  "Life on Land", "Peace Justice and Strong Institutions", "Partnerships for the Goals",
]

const CURRENCIES = [
  { code: "USD" }, { code: "GBP" }, { code: "EUR" }, { code: "NGN" },
  { code: "KES" }, { code: "GHS" }, { code: "ZAR" }, { code: "CAD" }, { code: "AUD" },
]

const STAGE_OPTIONS: { value: InitiativeStage; label: string; sub: string }[] = [
  { value: "concept",  label: "Concept",  sub: "Idea defined, no funding yet" },
  { value: "planning", label: "Planning", sub: "Funded, building implementation plan" },
  { value: "active",   label: "Active",   sub: "Currently executing" },
  { value: "scaling",  label: "Scaling",  sub: "Running successfully, seeking to expand" },
]

const CONFIRMED_ASSET_OPTIONS = [
  { value: "full_funding",    label: "Full funding secured" },
  { value: "partial_funding", label: "Partial funding secured" },
  { value: "government_mou",  label: "Government endorsement / MoU" },
  { value: "community_buyin", label: "Community buy-in established" },
  { value: "lead_team",       label: "Lead team confirmed" },
  { value: "none",            label: "Nothing confirmed yet" },
]

const PARTNERSHIP_OPTIONS: { value: PartnershipType; label: string; color: string }[] = [
  { value: "funding",     label: "Funding",      color: "#C47A3A" },
  { value: "technical",   label: "Technical",    color: "#4A8C5C" },
  { value: "operational", label: "Operational",  color: "#C8965A" },
  { value: "leadership",  label: "Leadership",   color: "#6B9E78" },
  { value: "strategic",   label: "Strategic",    color: "#B45C38" },
  { value: "lead",        label: "Project Lead", color: "#5C9E72" },
]

function wordCount(text: string): number {
  return text.trim() === "" ? 0 : text.trim().split(/\s+/).length
}

function FieldLabel({ children, required, optional }: {
  children: React.ReactNode; required?: boolean; optional?: boolean
}) {
  return (
    <label className="block text-sm font-medium text-foreground mb-2">
      {children}
      {required && <span className="text-primary ml-0.5">*</span>}
      {optional && <span className="text-muted-foreground font-normal ml-1 text-xs">(optional)</span>}
    </label>
  )
}

function TagInput({ tags, onAdd, onRemove, placeholder }: {
  tags: string[]; onAdd: (v: string) => void; onRemove: (v: string) => void; placeholder: string
}) {
  const [input, setInput] = useState("")
  function commit() {
    const v = input.trim().replace(/,$/, "")
    if (v && !tags.includes(v)) onAdd(v)
    setInput("")
  }
  return (
    <div className="flex flex-wrap gap-1.5 px-3 py-2.5 min-h-[48px] items-center border border-border rounded-lg cursor-text focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-colors"
      onClick={e => (e.currentTarget.querySelector("input") as HTMLInputElement)?.focus()}>
      {tags.map(t => (
        <span key={t} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
          style={{ background: "#f5ede8", color: "#C45C26" }}>
          {t}
          <button type="button" onClick={() => onRemove(t)} className="leading-none hover:opacity-70 ml-0.5">×</button>
        </span>
      ))}
      <input value={input} onChange={e => setInput(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter" || e.key === ",") { e.preventDefault(); commit() }
          if (e.key === "Backspace" && !input && tags.length) onRemove(tags[tags.length - 1])
        }}
        onBlur={commit}
        placeholder={tags.length === 0 ? placeholder : ""}
        className="flex-1 min-w-[140px] bg-transparent border-none outline-none text-sm placeholder:text-muted-foreground/50" />
    </div>
  )
}

function SectorSelector({ selected, onChange }: { selected: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])
  function toggle(s: string) {
    onChange(selected.includes(s) ? selected.filter(x => x !== s) : [...selected, s])
  }
  return (
    <div ref={ref} className="relative">
      <div className="min-h-[48px] flex flex-wrap gap-1.5 items-center border border-border rounded-lg px-3 py-2 bg-background cursor-pointer focus-within:ring-2 focus-within:ring-primary/20 transition-colors"
        onClick={() => setOpen(o => !o)}>
        {selected.length === 0 && <span className="text-sm text-muted-foreground/50">Select sectors...</span>}
        {selected.map(s => (
          <span key={s} className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full"
            style={{ background: "#f5ede8", color: "#C45C26" }}>
            {s}
            <button type="button" onClick={e => { e.stopPropagation(); toggle(s) }} className="leading-none hover:opacity-70 ml-0.5">×</button>
          </span>
        ))}
        <svg className={`w-4 h-4 text-muted-foreground ml-auto shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-popover shadow-lg max-h-64 overflow-y-auto">
          {SECTOR_OPTIONS.map(s => (
            <button key={s} type="button" onClick={() => toggle(s)}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-muted/60 transition-colors text-left">
              <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${selected.includes(s) ? 'bg-primary border-primary' : 'border-border'}`}>
                {selected.includes(s) && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
              </span>
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ChipToggle({ label, selected, onToggle, color }: {
  label: string; selected: boolean; onToggle: () => void; color?: string
}) {
  return (
    <button type="button" onClick={onToggle}
      className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
        selected ? "text-white" : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
      }`}
      style={selected ? { background: color ?? "#2D6A4F", borderColor: color ?? "#2D6A4F" } : {}}>
      {label}
    </button>
  )
}

function toggleArrVal<T>(arr: T[], item: T): T[] {
  return arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item]
}

// Builds a human-readable diff between the loaded snapshot and the current
// form state, restricted to SUBSTANTIVE_FIELDS. Array/primitive comparison
// via JSON.stringify is sufficient here — these are all short, order-stable
// arrays (sectors/partnerships selected via checkbox UI, not free reordering).
function diffSubstantiveFields(original: EditFormState, current: EditFormState): string[] {
  return SUBSTANTIVE_FIELDS
    .filter(({ key }) => JSON.stringify(original[key]) !== JSON.stringify(current[key]))
    .map(({ label }) => label)
}

export default function EditInitiativeModalDashboard({ isOpen, initiativeId, onClose, onSaved }: {
  isOpen: boolean
  initiativeId: string | null
  onClose: () => void
  onSaved?: () => void
}) {
  const { user } = useAuth()
  const [loading, setLoading]     = useState(true)
  const [form, setForm]           = useState<EditFormState | null>(null)
  const [original, setOriginal]   = useState<EditFormState | null>(null)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [saved, setSaved]         = useState(false)
  const [notifiedCount, setNotifiedCount] = useState(0)
  const [orgProfile, setOrgProfile] = useState<Record<string, any> | null>(null)
  const [descriptionRegenerated, setDescriptionRegenerated] = useState(false)

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string

  const editor = useEditor({
    extensions: [StarterKit, Placeholder.configure({ placeholder: "Full initiative description..." })],
    onUpdate: ({ editor }) => { setForm(f => f ? { ...f, detailContent: editor.getHTML() } : f) },
  })

  useEffect(() => {
    if (!isOpen || !user) return
    supabase.from("organizations")
      .select("organisation_name,description,sector,years_of_operation,total_beneficiaries_reached,jobs_created,grants_received_count,grants_total_value_usd,grants_delivered_on_time_pct,previous_funders,third_party_evaluations")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setOrgProfile(data ?? null))
  }, [isOpen, user])

  useEffect(() => {
    if (!isOpen || !initiativeId) return
    setLoading(true)
    setSaved(false)
    setError(null)
    setDescriptionRegenerated(false)
    supabase.from("initiative_requests")
      .select("title,sectors,locations,open_to_remote_partnerships,target_population,budget_min,budget_max,budget_currency,detail_content,resource_link,impact_evidence,problem,outcome,tags,partnerships,sdg_tags,specific_ask,start_date,duration,esg_alignment,stage,confirmed_assets,had_prior_experience,prior_experience_detail,target_beneficiaries,target_jobs,target_female_pct,target_timeline_months")
      .eq("id", initiativeId)
      .single()
      .then(({ data, error: fetchError }) => {
        if (fetchError || !data) { setError("Could not load this initiative."); setLoading(false); return }
        const loaded: EditFormState = {
          title: data.title ?? "",
          sectors: data.sectors ?? [],
          locations: data.locations ?? [],
          openToRemotePartnerships: data.open_to_remote_partnerships ?? false,
          targetPopulation: data.target_population ?? "",
          budgetMin: data.budget_min != null ? String(data.budget_min) : "",
          budgetMax: data.budget_max != null ? String(data.budget_max) : "",
          currency: data.budget_currency ?? "USD",
          detailContent: data.detail_content ?? "",
          resourceLink: data.resource_link ?? "",
          impactEvidence: data.impact_evidence ?? "",
          problem: data.problem ?? "",
          outcome: data.outcome ?? "",
          tags: data.tags ?? [],
          partnerships: data.partnerships ?? [],
          sdgTags: data.sdg_tags ?? [],
          specificAsk: data.specific_ask ?? "",
          startDate: data.start_date ?? "",
          duration: data.duration ?? "",
          esg: data.esg_alignment ?? null,
          stage: data.stage ?? null,
          confirmedAssets: data.confirmed_assets ?? [],
          hadPriorExperience: data.had_prior_experience ?? null,
          priorExperienceDetail: data.prior_experience_detail ?? "",
          targetBeneficiaries: data.target_beneficiaries != null ? String(data.target_beneficiaries) : "",
          targetJobs: data.target_jobs != null ? String(data.target_jobs) : "",
          targetFemalePct: data.target_female_pct != null ? String(data.target_female_pct) : "",
          targetTimelineMonths: data.target_timeline_months != null ? String(data.target_timeline_months) : "",
        }
        setForm(loaded)
        setOriginal(loaded)
        editor?.commands.setContent(loaded.detailContent || "")
        setLoading(false)
      })
  }, [isOpen, initiativeId])

  if (!isOpen) return null

  function set<K extends keyof EditFormState>(key: K, value: EditFormState[K]) {
    setForm(f => f ? { ...f, [key]: value } : f)
  }

  function handleClose() {
    onClose()
    setTimeout(() => { setForm(null); setOriginal(null); setError(null); setSaved(false); setNotifiedCount(0) }, 300)
  }

  async function handleSave() {
    if (!form || !original || !initiativeId) return
    setSaving(true); setError(null)
    try {
      const changedSubstantive = diffSubstantiveFields(original, form)
      const isSubstantiveEdit = changedSubstantive.length > 0

      const { error: updateError } = await supabase.from("initiative_requests").update({
        title: form.title,
        sectors: form.sectors,
        locations: form.locations,
        open_to_remote_partnerships: form.openToRemotePartnerships,
        target_population: form.targetPopulation || null,
        budget: form.budgetMin || form.budgetMax ? `${form.currency} ${form.budgetMin}–${form.budgetMax}` : null,
        budget_min: form.budgetMin ? parseFloat(form.budgetMin.replace(/,/g, "")) : null,
        budget_max: form.budgetMax ? parseFloat(form.budgetMax.replace(/,/g, "")) : null,
        budget_currency: form.currency,
        detail_content: form.detailContent || null,
        resource_link: form.resourceLink || null,
        impact_evidence: form.impactEvidence || null,
        target_beneficiaries: form.targetBeneficiaries ? parseInt(form.targetBeneficiaries) : null,
        target_jobs: form.targetJobs ? parseInt(form.targetJobs) : null,
        target_female_pct: form.targetFemalePct ? parseInt(form.targetFemalePct) : null,
        target_timeline_months: form.targetTimelineMonths ? parseInt(form.targetTimelineMonths) : null,
        problem: form.problem,
        outcome: form.outcome,
        tags: form.tags,
        partnerships: form.partnerships,
        sdg_tags: form.sdgTags.length > 0 ? form.sdgTags : null,
        specific_ask: form.specificAsk || null,
        start_date: form.startDate || null,
        duration: form.duration || null,
        esg_alignment: form.esg,
        stage: form.stage || null,
        confirmed_assets: form.confirmedAssets,
        had_prior_experience: form.hadPriorExperience,
        prior_experience_detail: form.priorExperienceDetail || null,
        // Never touch `status` here — an edit to a live listing stays live.
        // Re-review is a separate decision, not an automatic side effect of
        // editing; that's what edited_since_review is for.
        ...(isSubstantiveEdit
          ? { edited_since_review: true, last_edited_at: new Date().toISOString(), last_edited_fields: changedSubstantive }
          : {}),
      }).eq("id", initiativeId)

      if (updateError) throw updateError

      // Notify anyone who expressed interest under the OLD terms, so a
      // funder who committed based on a stated ask/budget/timeline isn't
      // left finding out it changed on their own. Conversations marked
      // "declined" are excluded — that relationship has already ended, an
      // edit notification there would be noise, not signal.
      if (isSubstantiveEdit) {
        const { data: eois } = await supabase
          .from("expressions_of_interest")
          .select("user_id, conversation_id")
          .eq("initiative_id", initiativeId)

        if (eois && eois.length > 0) {
          const convoIds = eois.map(e => e.conversation_id).filter(Boolean)
          const { data: convos } = convoIds.length > 0
            ? await supabase.from("conversations").select("id, status").in("id", convoIds)
            : { data: [] as { id: string; status: string }[] }
          const declinedConvoIds = new Set((convos ?? []).filter(c => c.status === "declined").map(c => c.id))

          const recipientIds = [...new Set(
            eois
              .filter(e => !e.conversation_id || !declinedConvoIds.has(e.conversation_id))
              .map(e => e.user_id)
          )]

          if (recipientIds.length > 0) {
            const notifRows = recipientIds.map(uid => ({
              user_id: uid,
              type: "initiative_edited",
              title: `"${form.title}" was updated`,
              body: `The initiative you expressed interest in changed: ${changedSubstantive.join(", ")}.`,
              link: `/dashboard/marketplace?initiative=${initiativeId}`,
              read: false,
              metadata: { initiative_id: initiativeId, changed_fields: changedSubstantive },
            }))
            await supabase.from("notifications").insert(notifRows)
            setNotifiedCount(recipientIds.length)
          }
        }
      }

      setSaved(true)
      onSaved?.()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : JSON.stringify(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto"
      onClick={e => e.target === e.currentTarget && handleClose()}>
      <div className="bg-background rounded-2xl border border-border w-full max-w-lg shadow-xl flex flex-col" style={{ height: "min(90vh, 780px)" }}>

        <div className="flex items-center justify-between gap-4 px-6 pt-5 pb-4 border-b border-border shrink-0">
          <h2 className="text-lg font-semibold text-foreground">Edit initiative</h2>
          <button type="button" onClick={handleClose} className="shrink-0 p-1.5 rounded-full hover:bg-muted transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {loading || !form ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 text-[#2D6A4F] animate-spin" /></div>
          ) : saved ? (
            <div className="flex flex-col items-center justify-center text-center py-12 gap-3">
              <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "#eaf5ee" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2D6A4F" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
              </div>
              <h3 className="text-lg font-semibold">Changes saved</h3>
              {notifiedCount > 0 && (
                <p className="text-sm text-muted-foreground max-w-xs">
                  {notifiedCount} organisation{notifiedCount !== 1 ? "s" : ""} with an active interest in this initiative {notifiedCount !== 1 ? "have" : "has"} been notified of what changed.
                </p>
              )}
              <button type="button" onClick={handleClose} className="mt-2 rounded-full h-9 px-6 border border-border text-sm font-semibold hover:bg-muted transition-colors">Done</button>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <FieldLabel required>Initiative title</FieldLabel>
                <input type="text" value={form.title} onChange={e => set("title", e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors" />
              </div>

              <div>
                <FieldLabel required>Problem statement</FieldLabel>
                <textarea value={form.problem} onChange={e => set("problem", e.target.value)} rows={3}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors" />
                <p className={`text-xs mt-1 text-right ${wordCount(form.problem) > 30 ? 'text-red-500 font-semibold' : 'text-muted-foreground'}`}>{wordCount(form.problem)}/30 words</p>
              </div>

              <div>
                <FieldLabel required>Expected outcome</FieldLabel>
                <textarea value={form.outcome} onChange={e => set("outcome", e.target.value)} rows={3}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors" />
                <p className={`text-xs mt-1 text-right ${wordCount(form.outcome) > 30 ? 'text-red-500 font-semibold' : 'text-muted-foreground'}`}>{wordCount(form.outcome)}/30 words</p>
              </div>

              <div>
                <FieldLabel optional>Who does this initiative directly serve?</FieldLabel>
                <textarea value={form.targetPopulation} onChange={e => set("targetPopulation", e.target.value)} rows={2}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors" />
              </div>

              <div>
                <FieldLabel required>Sectors</FieldLabel>
                <SectorSelector selected={form.sectors} onChange={v => set("sectors", v)} />
              </div>

              <div>
                <FieldLabel required>Locations</FieldLabel>
                <TagInput tags={form.locations}
                  onAdd={v => set("locations", [...form.locations, v])}
                  onRemove={v => set("locations", form.locations.filter(x => x !== v))}
                  placeholder="Type a location and press Enter..." />
              </div>

              <div>
                <button type="button" onClick={() => set("openToRemotePartnerships", !form.openToRemotePartnerships)}
                  className={cn("w-full text-left px-4 py-3 rounded-xl border text-sm transition-colors flex items-start gap-3",
                    form.openToRemotePartnerships ? "border-primary bg-[#fdf5f2]" : "border-border hover:border-foreground/20")}>
                  <span className={cn("w-4 h-4 rounded border flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                    form.openToRemotePartnerships ? "bg-primary border-primary" : "border-border")}>
                    {form.openToRemotePartnerships && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                  </span>
                  <span>
                    <span className="font-medium text-foreground block">Open to remote or virtual partnerships</span>
                    <span className="text-xs text-muted-foreground">Funders and partners outside these locations can still be a strong match</span>
                  </span>
                </button>
              </div>

              <div>
                <FieldLabel required>Partnerships sought</FieldLabel>
                <div className="flex flex-wrap gap-2 mt-1">
                  {PARTNERSHIP_OPTIONS.map(p => (
                    <ChipToggle key={p.value} label={p.label}
                      selected={form.partnerships.includes(p.value)}
                      onToggle={() => set("partnerships", toggleArrVal(form.partnerships, p.value))}
                      color={p.color} />
                  ))}
                </div>
              </div>

              <div>
                <FieldLabel optional>Specific ask</FieldLabel>
                <textarea value={form.specificAsk} onChange={e => set("specificAsk", e.target.value)} rows={2}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors" />
              </div>

              <div>
                <FieldLabel optional>Stage</FieldLabel>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {STAGE_OPTIONS.map(opt => (
                    <button key={opt.value} type="button" onClick={() => set("stage", opt.value)}
                      className={cn("text-left px-3 py-2.5 rounded-xl border text-xs transition-colors",
                        form.stage === opt.value ? "border-primary bg-[#fdf5f2]" : "border-border hover:border-foreground/20")}>
                      <p className="font-semibold">{opt.label}</p>
                      <p className="text-muted-foreground mt-0.5">{opt.sub}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <FieldLabel optional>Budget range</FieldLabel>
                <div className="flex gap-2 items-center">
                  <select value={form.currency} onChange={e => set("currency", e.target.value)}
                    className="h-10 rounded-lg border border-border bg-background px-2 text-sm w-[80px] shrink-0 focus:outline-none focus:ring-2 focus:ring-primary/20">
                    {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
                  </select>
                  <input type="text" placeholder="Min" value={form.budgetMin}
                    onChange={e => set("budgetMin", e.target.value.replace(/[^0-9.,]/g, ""))}
                    className="h-10 rounded-lg border border-border bg-background px-3 text-sm w-full focus:outline-none focus:ring-2 focus:ring-primary/20" />
                  <span className="text-muted-foreground shrink-0 text-sm">–</span>
                  <input type="text" placeholder="Max" value={form.budgetMax}
                    onChange={e => set("budgetMax", e.target.value.replace(/[^0-9.,]/g, ""))}
                    className="h-10 rounded-lg border border-border bg-background px-3 text-sm w-full focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
              </div>

              <div>
                <FieldLabel optional>SDG alignment</FieldLabel>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {SDG_OPTIONS.map(s => (
                    <ChipToggle key={s} label={s} selected={form.sdgTags.includes(s)}
                      onToggle={() => set("sdgTags", toggleArrVal(form.sdgTags, s))} />
                  ))}
                </div>
              </div>

              <div>
                <FieldLabel optional>ESG / CSR alignment</FieldLabel>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {[{ value: true, label: "Open to ESG adoption" }, { value: false, label: "Not seeking ESG" }].map(opt => (
                    <button key={String(opt.value)} type="button" onClick={() => set("esg", opt.value)}
                      className={cn("text-left px-3 py-2.5 rounded-xl border text-xs font-medium transition-colors",
                        form.esg === opt.value ? "border-primary bg-[#fdf5f2] text-primary" : "border-border hover:border-foreground/20 text-foreground")}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <FieldLabel optional>Prior experience with similar initiatives?</FieldLabel>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {[{ value: true, label: "Yes" }, { value: false, label: "No" }].map(opt => (
                    <button key={String(opt.value)} type="button" onClick={() => set("hadPriorExperience", opt.value)}
                      className={cn("px-3 py-2.5 rounded-xl border text-xs font-semibold transition-colors",
                        form.hadPriorExperience === opt.value ? "border-primary bg-[#fdf5f2] text-primary" : "border-border hover:border-foreground/20 text-foreground")}>
                      {opt.label}
                    </button>
                  ))}
                </div>
                {form.hadPriorExperience === true && (
                  <textarea value={form.priorExperienceDetail} onChange={e => set("priorExperienceDetail", e.target.value)}
                    rows={3} className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors" />
                )}
              </div>

              <div>
                <FieldLabel optional>What is already confirmed?</FieldLabel>
                <div className="space-y-2 mt-1">
                  {CONFIRMED_ASSET_OPTIONS.map(opt => (
                    <button key={opt.value} type="button" onClick={() => set("confirmedAssets", toggleArrVal(form.confirmedAssets, opt.value))}
                      className={`w-full text-left px-4 py-2.5 rounded-lg border text-sm transition-colors flex items-center gap-3 ${
                        form.confirmedAssets.includes(opt.value) ? "border-primary bg-[#fdf5f2] text-primary" : "border-border hover:border-foreground/20 text-foreground"
                      }`}>
                      <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                        form.confirmedAssets.includes(opt.value) ? "bg-primary border-primary" : "border-border"
                      }`}>
                        {form.confirmedAssets.includes(opt.value) && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                      </span>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <FieldLabel optional>Tags</FieldLabel>
                <TagInput tags={form.tags} onAdd={v => set("tags", [...form.tags, v])} onRemove={v => set("tags", form.tags.filter(x => x !== v))} placeholder="Add tags and press Enter..." />
              </div>

              <div>
                <FieldLabel optional>Impact evidence</FieldLabel>
                <textarea value={form.impactEvidence} onChange={e => set("impactEvidence", e.target.value)} rows={3}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors" />
              </div>

              <div>
                <FieldLabel optional>Target impact metrics</FieldLabel>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Target beneficiaries</label>
                    <input type="text" value={form.targetBeneficiaries} onChange={e => set("targetBeneficiaries", e.target.value.replace(/[^0-9]/g, ""))}
                      className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Jobs to be created</label>
                    <input type="text" value={form.targetJobs} onChange={e => set("targetJobs", e.target.value.replace(/[^0-9]/g, ""))}
                      className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Female beneficiaries %</label>
                    <input type="text" value={form.targetFemalePct} onChange={e => set("targetFemalePct", e.target.value.replace(/[^0-9]/g, ""))}
                      className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Timeline (months)</label>
                    <input type="text" value={form.targetTimelineMonths} onChange={e => set("targetTimelineMonths", e.target.value.replace(/[^0-9]/g, ""))}
                      className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                  </div>
                </div>
              </div>

              <div>
                <FieldLabel optional>Full initiative description</FieldLabel>
                <AIDescriptionGenerator
                  form={form}
                  supabaseUrl={supabaseUrl}
                  orgProfile={orgProfile}
                  onGenerated={content => {
                    const html = `<p>${content.split("\n\n").join("</p><p>")}</p>`
                    editor?.commands.setContent(html)
                    set("detailContent", html)
                    setDescriptionRegenerated(true)
                  }}
                />
                {descriptionRegenerated && (
                  <div className="flex items-center gap-2 rounded-lg border border-[#2D6A4F]/20 bg-[#2D6A4F]/5 px-3 py-2 mt-2">
                    <Sparkles className="w-3.5 h-3.5 text-[#2D6A4F] shrink-0" />
                    <p className="text-xs text-[#2D6A4F]">AI-generated — edit freely before saving.</p>
                  </div>
                )}
                {form.detailContent && form.detailContent !== "<p></p>" && !descriptionRegenerated && (
                  <p className="text-xs text-muted-foreground mt-2">This initiative already has a description — generating will replace it.</p>
                )}
                <div className="flex gap-1 border border-border rounded-t-lg px-2 py-1.5 bg-muted/40 flex-wrap mt-2">                  {[
                    { label: "B", action: () => editor?.chain().focus().toggleBold().run(), active: editor?.isActive("bold"), style: "font-bold" },
                    { label: "I", action: () => editor?.chain().focus().toggleItalic().run(), active: editor?.isActive("italic"), style: "italic" },
                    { label: "H2", action: () => editor?.chain().focus().toggleHeading({ level: 2 }).run(), active: editor?.isActive("heading", { level: 2 }), style: "" },
                    { label: "• List", action: () => editor?.chain().focus().toggleBulletList().run(), active: editor?.isActive("bulletList"), style: "" },
                  ].map(btn => (
                    <button key={btn.label} type="button" onMouseDown={e => { e.preventDefault(); btn.action(); }}
                      className={`px-2 py-0.5 rounded text-xs transition-colors ${btn.style} ${btn.active ? 'bg-primary text-white' : 'hover:bg-muted text-muted-foreground'}`}>
                      {btn.label}
                    </button>
                  ))}
                </div>
                <div className="border border-border border-t-0 rounded-b-lg min-h-[160px] bg-background focus-within:ring-1 focus-within:ring-primary/20 cursor-text"
                  onClick={() => editor?.chain().focus().run()}>
                  <EditorContent editor={editor}
                    className="[&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[140px] [&_.ProseMirror]:px-3 [&_.ProseMirror]:py-2 [&_.ProseMirror]:text-sm [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-5 [&_.ProseMirror_h2]:font-semibold [&_.ProseMirror_h2]:text-base [&_.ProseMirror_h2]:mt-4 [&_.ProseMirror_h2]:mb-2" />
                </div>
              </div>

              <div>
                <FieldLabel optional>Resource link</FieldLabel>
                <input type="url" value={form.resourceLink} onChange={e => set("resourceLink", e.target.value)}
                  className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors" />
              </div>

              {(() => {
                const changed = original ? diffSubstantiveFields(original, form) : []
                if (changed.length === 0) return null
                return (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 px-4 py-3">
                    <p className="text-xs font-medium text-amber-800 dark:text-amber-300 mb-1">
                      This changes: {changed.join(", ")}
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      Anyone with an active interest in this initiative will be notified of this change when you save.
                    </p>
                  </div>
                )
              })()}

              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          )}
        </div>

        {!loading && form && !saved && (
          <div className="flex justify-between items-center px-6 py-4 border-t border-border bg-background shrink-0">
            <button type="button" onClick={handleClose} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
            <button type="button" onClick={handleSave} disabled={saving || !form.title || !form.problem || !form.outcome}
              className="rounded-full h-10 px-7 bg-primary hover:bg-primary/90 text-white text-sm font-semibold disabled:opacity-40 transition-colors">
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}