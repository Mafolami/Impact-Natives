import { useState, useRef, useEffect } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import { supabase } from "@/lib/supabase"
import { SECTOR_OPTIONS } from "@/lib/sectors";
import { useAuth } from "@/context/AuthContext"
import { X, Sparkles, Loader2, CheckCircle2, AlertCircle, Info, PenLine, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────
type PartnershipType = "funding" | "technical" | "operational" | "leadership" | "strategic" | "lead"
type InitiativeStage = "concept" | "planning" | "active" | "scaling"
type EntryMode = "ai" | "manual" | null

interface FormState {
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
  submitterName: string;
  submitterOrg: string;
  submitterEmail: string;
  targetBeneficiaries: string;
  targetJobs: string;
  targetFemalePct: string;
  targetTimelineMonths: string;
}

const INITIAL_STATE: FormState = {
  title: "", sectors: [], locations: [], openToRemotePartnerships: false, targetPopulation: "",
  budgetMin: "", budgetMax: "", currency: "USD",
  detailContent: "", resourceLink: "", impactEvidence: "", problem: "", outcome: "",
  tags: [], partnerships: [], sdgTags: [], specificAsk: "",
  startDate: "", duration: "", esg: null, stage: null,
  confirmedAssets: [], hadPriorExperience: null, priorExperienceDetail: "",
  submitterName: "", submitterOrg: "", submitterEmail: "",
  targetBeneficiaries: "", targetJobs: "", targetFemalePct: "", targetTimelineMonths: "",
}

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

const DURATION_OPTIONS = ["Under 6 months", "6–12 months", "1–2 years", "2–5 years", "Ongoing"]

const PARTNERSHIP_OPTIONS: { value: PartnershipType; label: string; color: string }[] = [
  { value: "funding",     label: "Funding",      color: "#C47A3A" },
  { value: "technical",   label: "Technical",    color: "#4A8C5C" },
  { value: "operational", label: "Operational",  color: "#C8965A" },
  { value: "leadership",  label: "Leadership",   color: "#6B9E78" },
  { value: "strategic",   label: "Strategic",    color: "#B45C38" },
  { value: "lead",        label: "Project Lead", color: "#5C9E72" },
]

interface BriefAssessment {
  score: "strong" | "good" | "basic"
  what_works: string
  improve: string
}

const SCORE_CONFIG = {
  strong: { label: "Strong brief",    color: "#2D6A4F", bg: "rgba(45,106,79,0.12)", icon: CheckCircle2 },
  good:   { label: "Good brief",      color: "#f59e0b", bg: "rgba(180,83,9,0.12)", icon: Info },
  basic:  { label: "Developing brief", color: "#C45C26", bg: "rgba(196,92,38,0.08)", icon: AlertCircle },
}

function wordCount(text: string): number {
  return text.trim() === "" ? 0 : text.trim().split(/\s+/).length
}

// ─── Sub-components ───────────────────────────────────────────────────────────

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

function HintText({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{children}</p>
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
          style={{ background: "rgba(196,92,38,0.12)", color: "#C45C26" }}>
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
            style={{ background: "rgba(196,92,38,0.12)", color: "#C45C26" }}>
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

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 py-3 border-b border-border last:border-0">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground leading-relaxed">{value || "—"}</span>
    </div>
  )
}

// ─── AI Description Generator ─────────────────────────────────────────────────
export function AIDescriptionGenerator({
  form, supabaseUrl, orgProfile, onGenerated,
}: {
  form: Record<string, any>
  supabaseUrl: string
  orgProfile?: Record<string, any> | null
  onGenerated: (content: string) => void
}) {
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function generate() {
    setGenerating(true); setError(null)
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/generate-initiative-description`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ form, profile: orgProfile ?? undefined }),
      })
      const data = await res.json()
      if (data.description) {
        onGenerated(data.description)
      } else {
        setError("Generation failed. You can write the description manually below.")
      }
    } catch {
      setError("Something went wrong. You can write the description manually below.")
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="space-y-2">
      <button type="button" onClick={generate} disabled={generating}
        className="w-full flex items-center gap-2 px-4 py-3 rounded-xl border border-dashed border-[#2D6A4F]/40 text-sm text-[#2D6A4F] hover:bg-[#2D6A4F]/5 transition-colors disabled:opacity-40">
        {generating
          ? <><Loader2 className="w-4 h-4 animate-spin shrink-0" />Generating description...</>
          : <><Sparkles className="w-4 h-4 shrink-0" />Generate full description from your brief</>
        }
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}

// ─── Main Modal ───────────────────────────────────────────────────────────────
export default function CreateInitiativeModalDashboard({ isOpen, onClose, onSuccess }: {
  isOpen: boolean; onClose: () => void; onSuccess?: () => void
}) {
  const { user } = useAuth()

  // mode: null = entry screen, "ai" = AI path, "manual" = manual path
  const [mode, setMode]                       = useState<EntryMode>(null)
  const [plainDescription, setPlainDescription] = useState("")
  const [extracting, setExtracting]           = useState(false)
  const [extractError, setExtractError]       = useState<string | null>(null)

  // AI path steps: 0=review, 1=description, 2=submit
  // Manual path steps: 0-5 original flow
  const [aiStep, setAiStep]                   = useState(0)
  const [manualStep, setManualStep]           = useState(0)

  const [form, setForm]                       = useState<FormState>(INITIAL_STATE)
  const [profileLoaded, setProfileLoaded]     = useState(false)
  const [orgProfile, setOrgProfile]           = useState<Record<string, any> | null>(null)
  const [submitted, setSubmitted]             = useState(false)
  const [submitting, setSubmitting]           = useState(false)
  const [error, setError]                     = useState<string | null>(null)

  const [assessment, setAssessment]           = useState<BriefAssessment | null>(null)
  const [assessingBrief, setAssessingBrief]   = useState(false)
  const [descriptionGenerated, setDescriptionGenerated] = useState(false)

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Write or generate your full initiative description here..." }),
    ],
    onUpdate: ({ editor }) => { setForm(f => ({ ...f, detailContent: editor.getHTML() })) },
  })

  useEffect(() => {
    if (!user || profileLoaded) return
    async function loadProfile() {
      const { data } = await supabase.from("profiles").select("full_name, email, org_name").eq("id", user!.id).single()
      if (data) setForm(f => ({ ...f, submitterName: data.full_name || "", submitterEmail: data.email || user!.email || "", submitterOrg: data.org_name || "" }))

      const { data: orgData } = await supabase.from("organizations")
        .select("organisation_name,description,sector,years_of_operation,total_beneficiaries_reached,jobs_created,grants_received_count,grants_total_value_usd,grants_delivered_on_time_pct,previous_funders,third_party_evaluations")
        .eq("user_id", user!.id).maybeSingle()
      if (orgData) {
        setOrgProfile(orgData)
        const evidenceParts: string[] = []
        if (orgData.total_beneficiaries_reached) evidenceParts.push(`${orgData.total_beneficiaries_reached.toLocaleString()} beneficiaries reached to date`)
        if (orgData.jobs_created) evidenceParts.push(`${orgData.jobs_created.toLocaleString()} jobs created`)
        if (orgData.grants_received_count) evidenceParts.push(`${orgData.grants_received_count} grants received${orgData.grants_delivered_on_time_pct ? ` (${orgData.grants_delivered_on_time_pct}% delivered on time)` : ""}`)
        if (orgData.third_party_evaluations) evidenceParts.push("independently evaluated by a third party")
        if (evidenceParts.length > 0) {
          setForm(f => f.impactEvidence ? f : { ...f, impactEvidence: evidenceParts.join(". ") + "." })
        }
      }

      setProfileLoaded(true)
    }
    loadProfile()
  }, [user, profileLoaded])

  if (!isOpen) return null

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
    // Reset assessment when any field changes so it reflects the updated brief
    if (assessment) setAssessment(null)
  }

  function toggle<T>(arr: T[], item: T): T[] {
    return arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item]
  }

  function toggleArr(arr: string[], val: string, setter: (v: string[]) => void) {
    setter(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val])
  }

  function handleClose() {
    onClose()
    setTimeout(() => {
      setMode(null); setPlainDescription(""); setExtracting(false); setExtractError(null)
      setAiStep(0); setManualStep(0); setForm(INITIAL_STATE); setProfileLoaded(false)
      setSubmitted(false); setError(null); setAssessment(null); setDescriptionGenerated(false)
      editor?.commands.setContent("")
    }, 300)
  }

  // ── Extract from plain description ────────────────────────────────────────
  async function extractFromDescription() {
    if (!plainDescription.trim()) return
    setExtracting(true); setExtractError(null)
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/generate-initiative-brief`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plain_description: plainDescription }),
      })
      const result = await res.json()
      if (!res.ok || result.error) { setExtractError(result.error ?? "Extraction failed. Try again or fill in manually."); return }
      const d = result.data
      setForm(f => ({
        ...f,
        title:        d.title        ?? f.title,
        problem:      d.problem      ?? f.problem,
        outcome:      d.outcome      ?? f.outcome,
        sectors:      d.sectors?.length      ? d.sectors      : f.sectors,
        locations:    d.locations?.length    ? d.locations    : f.locations,
        partnerships: d.partnerships?.length ? d.partnerships : f.partnerships,
        sdgTags:      d.sdg_tags?.length     ? d.sdg_tags     : f.sdgTags,
        specificAsk:  d.specific_ask         ?? f.specificAsk,
        tags:         d.tags?.length         ? d.tags         : f.tags,
        targetPopulation: d.target_population ?? f.targetPopulation,
        budgetMin:    d.budget_min   ? String(d.budget_min)   : f.budgetMin,
        budgetMax:    d.budget_max   ? String(d.budget_max)   : f.budgetMax,
        stage:        d.stage        ?? f.stage,
        duration:     d.duration     ?? f.duration,
        targetBeneficiaries: d.target_beneficiaries != null ? String(d.target_beneficiaries) : f.targetBeneficiaries,
        targetJobs:          d.target_jobs != null          ? String(d.target_jobs)          : f.targetJobs,
        targetFemalePct:     d.target_female_pct != null    ? String(d.target_female_pct)    : f.targetFemalePct,
        targetTimelineMonths: d.target_timeline_months != null ? String(d.target_timeline_months) : f.targetTimelineMonths,
      }))
      setMode("ai")
      setAiStep(0)
    } catch { setExtractError("Something went wrong. Try again or fill in manually.") }
    finally { setExtracting(false) }
  }

  // ── AI quality assessment ─────────────────────────────────────────────────
  async function assessBrief() {
    setAssessingBrief(true)
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/assess-initiative-brief`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title, problem: form.problem, outcome: form.outcome,
          specific_ask: form.specificAsk || null, partnerships: form.partnerships,
          sectors: form.sectors, budget: form.budgetMin || form.budgetMax
          ? `${form.currency} ${[form.budgetMin, form.budgetMax].filter(Boolean).join("–")}`
          : form.specificAsk?.match(/\$[\d,]+|\d+[kKmM]/)?.[0] ?? null,
          stage: form.stage, had_prior_experience: form.hadPriorExperience,
          impact_evidence: form.impactEvidence || null,
        }),
      })
      const result = await res.json()
      if (result.data) setAssessment(result.data as BriefAssessment)
    } catch { /* silent */ }
    finally { setAssessingBrief(false) }
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    setSubmitting(true); setError(null)
    try {
      const { error: dbError } = await supabase.from("initiative_requests").insert({
        title: form.title, sectors: form.sectors, locations: form.locations,
        open_to_remote_partnerships: form.openToRemotePartnerships,        target_population: form.targetPopulation || null,
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
        problem: form.problem, outcome: form.outcome,
        tags: form.tags, partnerships: form.partnerships,
        sdg_tags: form.sdgTags.length > 0 ? form.sdgTags : null,
        specific_ask: form.specificAsk || null,
        start_date: form.startDate || null, duration: form.duration || null,
        esg_alignment: form.esg, stage: form.stage || null,
        confirmed_assets: form.confirmedAssets,
        had_prior_experience: form.hadPriorExperience,
        prior_experience_detail: form.priorExperienceDetail || null,
        ai_quality_score: assessment?.score ?? null,
        ai_quality_rationale: assessment?.what_works ?? null,
        status: "pending", eois: 0,
        user_id: user?.id ?? null,
        submitter_name: form.submitterName,
        submitter_org: form.submitterOrg || null,
        submitter_email: form.submitterEmail,
      })
      if (dbError) throw dbError
      setSubmitted(true); onSuccess?.()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : JSON.stringify(e))
    } finally { setSubmitting(false) }
  }

  const urlValid = (url: string) => {
    if (!url) return true
    if (/\s/.test(url)) return false
    try { const u = new URL(url); return (u.protocol === 'https:' || u.protocol === 'http:') && u.hostname.includes('.') }
    catch { return false }
  }

  // ── AI path step progress ─────────────────────────────────────────────────
  const AI_STEPS = ["Review details", "Full description", "Submit"]
  // ── Manual path step progress ─────────────────────────────────────────────
  const MANUAL_STEPS = ["Basics", "Challenge", "Partnerships", "Experience", "Detail", "Review"]

  const totalBars = mode === "ai" ? 3 : mode === "manual" ? 6 : 1
  const currentBar = mode === "ai" ? aiStep : mode === "manual" ? manualStep : 0

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto"
      onClick={e => e.target === e.currentTarget && handleClose()}>
      <div className="bg-background rounded-2xl border border-border w-full max-w-lg shadow-xl flex flex-col"
        style={{ height: "min(90vh, 780px)" }}>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-border shrink-0">
          <div className="flex-1 space-y-1">
            {/* Step bar */}
            <div className="flex gap-2">
              {Array.from({ length: totalBars }).map((_, i) => (
                <div key={i} className="h-[3px] flex-1 rounded-full transition-colors duration-300"
                  style={{ background: i < currentBar ? "#2D6A4F" : i === currentBar ? "#C45C26" : "rgba(0,0,0,0.1)" }} />
              ))}
            </div>
            {mode && (
              <p className="text-xs text-muted-foreground">
                {mode === "ai" ? AI_STEPS[aiStep] : MANUAL_STEPS[manualStep]}
              </p>
            )}
          </div>
          <button type="button" onClick={handleClose}
            className="shrink-0 p-1.5 rounded-full hover:bg-muted transition-colors -mt-0.5">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Body */}
        {!submitted && (
          <div className="flex-1 overflow-y-auto px-6 py-6">

            {/* ── Entry screen ── */}
            {mode === null && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">Create an initiative</h2>
                  <p className="text-sm text-muted-foreground mt-1">How would you like to get started?</p>
                </div>

                {/* AI path */}
                <div className="rounded-xl border border-[#2D6A4F]/30 bg-[#2D6A4F]/3 p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#2D6A4F] shrink-0" />
                    <p className="text-sm font-medium text-foreground">Describe your initiative</p>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Tell us what you're trying to do in plain language. Include what problem you're solving,
                    where, who it serves, what kind of support you need, and any budget or timeline details.
                    We'll structure it into a full brief.
                  </p>
                  <textarea
                    value={plainDescription}
                    onChange={e => setPlainDescription(e.target.value)}
                    placeholder="e.g. We're running a climate resilience programme for smallholder farmers in Kano State, Nigeria. We've secured partial funding but need a technical partner with expertise in irrigation and a funding partner to close a $150K gap. The programme runs 18 months starting Q3 2025 and aims to reach 2,000 farming households..."
                    rows={5}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors" />
                  {extractError && <p className="text-xs text-red-600">{extractError}</p>}
                  <button type="button" onClick={extractFromDescription}
                    disabled={!plainDescription.trim() || extracting}
                    className="w-full rounded-full h-10 bg-[#2D6A4F] hover:bg-[#245c43] text-white text-sm font-semibold disabled:opacity-40 transition-colors flex items-center justify-center gap-2">
                    {extracting
                      ? <><Loader2 className="w-4 h-4 animate-spin" />Structuring your brief...</>
                      : <><Sparkles className="w-4 h-4" />Structure my brief</>
                    }
                  </button>
                </div>

                {/* Divider */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-border" />
                  <p className="text-xs text-muted-foreground">or</p>
                  <div className="flex-1 h-px bg-border" />
                </div>

                {/* Manual path */}
                <button type="button" onClick={() => setMode("manual")}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-border hover:border-foreground/20 transition-colors text-left">
                  <div className="flex items-center gap-2">
                    <PenLine className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-sm text-foreground">Fill in manually</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            )}

            {/* ── AI Path: Step 0 — Review all fields ── */}
            {mode === "ai" && aiStep === 0 && (
              <div className="space-y-5">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 className="w-4 h-4 text-[#2D6A4F] shrink-0" />
                    <p className="text-sm font-medium text-[#2D6A4F]">Brief structured from your description</p>
                  </div>
                  <p className="text-xs text-muted-foreground">Review every field. Edit anything that needs updating before continuing.</p>
                </div>

                {/* Title */}
                <div>
                  <FieldLabel required>Initiative title</FieldLabel>
                  <input type="text" value={form.title} onChange={e => set("title", e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors" />
                </div>

                {/* Problem */}
                <div>
                  <FieldLabel required>Problem statement</FieldLabel>
                  <textarea value={form.problem} onChange={e => set("problem", e.target.value)} rows={3}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors" />
                  <div className="flex justify-end mt-1">
                    <p className={`text-xs ${wordCount(form.problem) > 30 ? 'text-red-500 font-semibold' : 'text-muted-foreground'}`}>{wordCount(form.problem)}/30 words</p>
                  </div>
                </div>

                {/* Outcome */}
                <div>
                  <FieldLabel required>Expected outcome</FieldLabel>
                  <textarea value={form.outcome} onChange={e => set("outcome", e.target.value)} rows={3}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors" />
                  <div className="flex justify-end mt-1">
                    <p className={`text-xs ${wordCount(form.outcome) > 30 ? 'text-red-500 font-semibold' : 'text-muted-foreground'}`}>{wordCount(form.outcome)}/30 words</p>
                  </div>
                </div>

                {/* Who it serves */}
                <div>
                  <FieldLabel optional>Who does this initiative directly serve?</FieldLabel>
                  <textarea value={form.targetPopulation} onChange={e => set("targetPopulation", e.target.value)} rows={2}
                    placeholder="e.g. Women smallholder farmers in Kano State, aged 25–50"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors" />
                </div>

                {/* Sectors */}
                <div>
                  <FieldLabel required>Sectors</FieldLabel>
                  <SectorSelector selected={form.sectors} onChange={v => set("sectors", v)} />
                </div>

                {/* Locations */}
                <div>
                  <FieldLabel required>Locations</FieldLabel>
                  <TagInput tags={form.locations}
                    onAdd={v => set("locations", [...form.locations, v])}
                    onRemove={v => set("locations", form.locations.filter(x => x !== v))}
                    placeholder="Type a location and press Enter..." />
                </div>

                {/* Open to remote partnerships */}
                <div>
                  <button type="button" onClick={() => set("openToRemotePartnerships", !form.openToRemotePartnerships)}
                    className={cn("w-full text-left px-4 py-3 rounded-xl border text-sm transition-colors flex items-start gap-3",
                      form.openToRemotePartnerships ? "border-primary bg-[rgba(196,92,38,0.08)]" : "border-border hover:border-foreground/20")}>
                    <span className={cn("w-4 h-4 rounded border flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                      form.openToRemotePartnerships ? "bg-primary border-primary" : "border-border")}>
                      {form.openToRemotePartnerships && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                      )}
                    </span>
                    <span>
                      <span className="font-medium text-foreground block">Open to remote or virtual partnerships</span>
                      <span className="text-xs text-muted-foreground">Funders and partners outside these locations can still be a strong match</span>
                    </span>
                  </button>
                </div>

                {/* Partnerships */}
                <div>
                  <FieldLabel required>Partnerships sought</FieldLabel>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {PARTNERSHIP_OPTIONS.map(p => (
                      <ChipToggle key={p.value} label={p.label}
                        selected={form.partnerships.includes(p.value as PartnershipType)}
                        onToggle={() => set("partnerships", toggle(form.partnerships, p.value as PartnershipType))}
                        color={p.color} />
                    ))}
                  </div>
                </div>

                {/* Specific ask */}
                <div>
                  <FieldLabel optional>Specific ask</FieldLabel>
                  <textarea value={form.specificAsk} onChange={e => set("specificAsk", e.target.value)} rows={2}
                    placeholder="What would a partner actually do or contribute?"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors" />
                </div>

                {/* Stage */}
                <div>
                  <FieldLabel optional>Stage</FieldLabel>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    {STAGE_OPTIONS.map(opt => (
                      <button key={opt.value} type="button" onClick={() => set("stage", opt.value)}
                        className={cn("text-left px-3 py-2.5 rounded-xl border text-xs transition-colors",
                          form.stage === opt.value ? "border-primary bg-[rgba(196,92,38,0.08)]" : "border-border hover:border-foreground/20")}>
                        <p className="font-semibold">{opt.label}</p>
                        <p className="text-muted-foreground mt-0.5">{opt.sub}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Budget */}
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
                      className={cn("h-10 rounded-lg border bg-background px-3 text-sm w-full focus:outline-none focus:ring-2 focus:ring-primary/20",
                        form.budgetMin && form.budgetMax && Number(form.budgetMax.replace(/,/g, "")) < Number(form.budgetMin.replace(/,/g, ""))
                          ? "border-red-400 focus:ring-red-300" : "border-border")} />
                  </div>
                  {form.budgetMin && form.budgetMax && Number(form.budgetMax.replace(/,/g, "")) < Number(form.budgetMin.replace(/,/g, "")) && (
                    <p className="text-xs text-red-500 mt-1.5">Max must be greater than or equal to Min.</p>
                  )}
                </div>
                {/* SDG tags */}

                <div>
                  <FieldLabel optional>SDG alignment</FieldLabel>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {SDG_OPTIONS.map(s => (
                      <ChipToggle key={s} label={s}
                        selected={form.sdgTags.includes(s)}
                        onToggle={() => toggleArr(form.sdgTags, s, v => set("sdgTags", v))} />
                    ))}
                  </div>
                </div>

                {/* ESG */}
                <div>
                  <FieldLabel optional>ESG / CSR alignment</FieldLabel>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    {[
                      { value: true,  label: "Open to ESG adoption" },
                      { value: false, label: "Not seeking ESG" },
                    ].map(opt => (
                      <button key={String(opt.value)} type="button" onClick={() => set("esg", opt.value)}
                        className={cn("text-left px-3 py-2.5 rounded-xl border text-xs font-medium transition-colors",
                          form.esg === opt.value ? "border-primary bg-[rgba(196,92,38,0.08)] text-primary" : "border-border hover:border-foreground/20 text-foreground")}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Prior experience */}
                <div>
                  <FieldLabel optional>Prior experience with similar initiatives?</FieldLabel>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    {[{ value: true, label: "Yes" }, { value: false, label: "No" }].map(opt => (
                      <button key={String(opt.value)} type="button" onClick={() => set("hadPriorExperience", opt.value)}
                        className={cn("px-3 py-2.5 rounded-xl border text-xs font-semibold transition-colors",
                          form.hadPriorExperience === opt.value ? "border-primary bg-[rgba(196,92,38,0.08)] text-primary" : "border-border hover:border-foreground/20 text-foreground")}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {form.hadPriorExperience === true && (
                    <textarea value={form.priorExperienceDetail} onChange={e => set("priorExperienceDetail", e.target.value)}
                      placeholder="Briefly describe one completed initiative — scale, outcome, funder."
                      rows={3} className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors" />
                  )}
                </div>

                {/* Confirmed assets */}
                <div>
                  <FieldLabel optional>What is already confirmed?</FieldLabel>
                  <div className="space-y-2 mt-1">
                    {[
                      { value: "full_funding",    label: "Full funding secured" },
                      { value: "partial_funding", label: "Partial funding secured" },
                      { value: "government_mou",  label: "Government endorsement / MoU" },
                      { value: "community_buyin", label: "Community buy-in established" },
                      { value: "lead_team",       label: "Lead team confirmed" },
                      { value: "none",            label: "Nothing confirmed yet" },
                    ].map(opt => (
                      <button key={opt.value} type="button"
                        onClick={() => set("confirmedAssets", toggle(form.confirmedAssets, opt.value))}
                        className={`w-full text-left px-4 py-2.5 rounded-lg border text-sm transition-colors flex items-center gap-3 ${
                          form.confirmedAssets.includes(opt.value) ? "border-primary bg-[rgba(196,92,38,0.08)] text-primary" : "border-border hover:border-foreground/20 text-foreground"
                        }`}>
                        <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                          form.confirmedAssets.includes(opt.value) ? "bg-primary border-primary" : "border-border"
                        }`}>
                          {form.confirmedAssets.includes(opt.value) && (
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                          )}
                        </span>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tags */}
                <div>
                  <FieldLabel optional>Tags</FieldLabel>
                  <TagInput tags={form.tags}
                    onAdd={v => set("tags", [...form.tags, v])}
                    onRemove={v => set("tags", form.tags.filter(x => x !== v))}
                    placeholder="Add tags and press Enter..." />
                </div>

                {/* Impact evidence */}
                <div>
                  <FieldLabel optional>Impact evidence</FieldLabel>
                  <textarea value={form.impactEvidence} onChange={e => set("impactEvidence", e.target.value)}
                    rows={3} placeholder="Describe any evidence of impact so far — beneficiary numbers, outcome data, pilot results, third-party evaluations, or link to an impact report."
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors" />
                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">Funders and investors look for evidence that your approach works. Share what you have, even if it's early-stage.</p>
                </div>

                {/* Target impact metrics */}
                <div>
                  <FieldLabel optional>Target impact metrics</FieldLabel>
                  <p className="text-xs text-muted-foreground mb-3">What does success look like in numbers?</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Target beneficiaries</label>
                      <input type="text" value={form.targetBeneficiaries}
                        onChange={e => set("targetBeneficiaries", e.target.value.replace(/[^0-9]/g, ""))}
                        placeholder="e.g. 2000"
                        className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Jobs to be created</label>
                      <input type="text" value={form.targetJobs}
                        onChange={e => set("targetJobs", e.target.value.replace(/[^0-9]/g, ""))}
                        placeholder="e.g. 50"
                        className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Female beneficiaries %</label>
                      <input type="text" value={form.targetFemalePct}
                        onChange={e => set("targetFemalePct", e.target.value.replace(/[^0-9]/g, ""))}
                        placeholder="e.g. 60"
                        className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Timeline (months)</label>
                      <input type="text" value={form.targetTimelineMonths}
                        onChange={e => set("targetTimelineMonths", e.target.value.replace(/[^0-9]/g, ""))}
                        placeholder="e.g. 18"
                        className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── AI Path: Step 1 — Full description ── */}
            {mode === "ai" && aiStep === 1 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">Full initiative description</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Generate a full description from your brief, or write your own. This appears on your initiative listing.
                  </p>
                </div>

                <AIDescriptionGenerator
                  form={form}
                  supabaseUrl={supabaseUrl}
                  orgProfile={orgProfile}
                  onGenerated={content => {
                    editor?.commands.setContent(`<p>${content.split("\n\n").join("</p><p>")}</p>`)
                    setForm(f => ({ ...f, detailContent: `<p>${content.split("\n\n").join("</p><p>")}</p>` }))
                    setDescriptionGenerated(true)
                  }}
                />

                {descriptionGenerated && (
                  <div className="flex items-center gap-2 rounded-lg border border-[#2D6A4F]/20 bg-[#2D6A4F]/5 px-3 py-2">
                    <Sparkles className="w-3.5 h-3.5 text-[#2D6A4F] shrink-0" />
                    <p className="text-xs text-[#2D6A4F]">AI-generated — edit freely before submitting.</p>
                  </div>
                )}

                {/* Rich text editor */}
                <div>
                  <div className="flex gap-1 border border-border rounded-t-lg px-2 py-1.5 bg-muted/40 flex-wrap">
                    {[
                      { label: "B",      action: () => editor?.chain().focus().toggleBold().run(),                 active: editor?.isActive("bold"),                  style: "font-bold" },
                      { label: "I",      action: () => editor?.chain().focus().toggleItalic().run(),               active: editor?.isActive("italic"),                style: "italic" },
                      { label: "H2",     action: () => editor?.chain().focus().toggleHeading({ level: 2 }).run(), active: editor?.isActive("heading", { level: 2 }), style: "" },
                      { label: "• List", action: () => editor?.chain().focus().toggleBulletList().run(),          active: editor?.isActive("bulletList"),            style: "" },
                    ].map(btn => (
                      <button key={btn.label} type="button" onMouseDown={e => { e.preventDefault(); btn.action(); }}
                        className={`px-2 py-0.5 rounded text-xs transition-colors ${btn.style} ${btn.active ? 'bg-primary text-white' : 'hover:bg-muted text-muted-foreground'}`}>
                        {btn.label}
                      </button>
                    ))}
                  </div>
                  <div className="border border-border border-t-0 rounded-b-lg min-h-[200px] bg-background focus-within:ring-1 focus-within:ring-primary/20 cursor-text"
                    onClick={() => editor?.chain().focus().run()}>
                    <EditorContent editor={editor}
                      className="[&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[180px] [&_.ProseMirror]:px-3 [&_.ProseMirror]:py-2 [&_.ProseMirror]:text-sm [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-5 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-5 [&_.ProseMirror_li]:mb-1 [&_.ProseMirror_h2]:font-semibold [&_.ProseMirror_h2]:text-base [&_.ProseMirror_h2]:mt-4 [&_.ProseMirror_h2]:mb-2 [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-muted-foreground/50 [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none" />
                  </div>
                </div>

                {/* Resource link */}
                <div>
                  <FieldLabel optional>Resource link</FieldLabel>
                  <input type="url" placeholder="https://drive.google.com/... — link to your concept note or proposal"
                    value={form.resourceLink} onChange={e => set("resourceLink", e.target.value)}
                    className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors" />
                  {form.resourceLink && !urlValid(form.resourceLink) && (
                    <p className="text-xs text-red-500 mt-1">Please enter a valid address.</p>
                  )}
                  <HintText>Already have a concept note or proposal? Link it here.</HintText>
                </div>

                

                </div>
            )}

            {/* ── AI Path: Step 2 — Review & Submit ── */}
            {mode === "ai" && aiStep === 2 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">Review & submit</h2>
                  <p className="text-sm text-muted-foreground mt-1">Check everything looks right before publishing.</p>
                </div>

                {/* AI assessment */}
                {!assessment && !assessingBrief && (
                  <button type="button" onClick={assessBrief}
                    className="w-full flex items-center gap-2 px-4 py-3 rounded-xl border border-dashed border-[#2D6A4F]/40 text-sm text-[#2D6A4F] hover:bg-[#2D6A4F]/5 transition-colors">
                    <Sparkles className="w-4 h-4 shrink-0" />
                    How does this brief look to a funder?
                  </button>
                )}
                {assessingBrief && (
                  <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-border">
                    <Loader2 className="w-4 h-4 animate-spin text-[#2D6A4F]" />
                    <p className="text-sm text-muted-foreground">Assessing brief quality...</p>
                  </div>
                )}
                {assessment && (() => {
                  const cfg = SCORE_CONFIG[assessment.score]
                  const Icon = cfg.icon
                  return (
                    <div className="rounded-xl border px-4 py-4 space-y-2" style={{ borderColor: cfg.color + "40", background: cfg.bg }}>
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 shrink-0" style={{ color: cfg.color }} />
                        <p className="text-sm font-semibold" style={{ color: cfg.color }}>{cfg.label}</p>
                      </div>
                      <p className="text-xs text-foreground leading-relaxed">{assessment.what_works}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        <span className="font-medium text-foreground">To strengthen: </span>{assessment.improve}
                      </p>
                    </div>
                  )
                })()}

                <div className="rounded-xl border border-border bg-muted/30 px-4 divide-y divide-border">
                  <ReviewRow label="Title"             value={form.title} />
                  <ReviewRow label="Sectors"           value={form.sectors.join(", ")} />
                  <ReviewRow label="Locations"         value={form.locations.join(", ")} />
                  <ReviewRow label="Remote partnerships" value={form.openToRemotePartnerships ? "Open to remote/virtual" : "Location-specific only"} />
                  {form.targetPopulation && <ReviewRow label="Serves"     value={form.targetPopulation} />}                  {form.stage           && <ReviewRow label="Stage"       value={form.stage} />}
                  <ReviewRow label="Budget"            value={form.budgetMin || form.budgetMax ? `${form.currency} ${form.budgetMin} – ${form.budgetMax}` : "—"} />
                  <ReviewRow label="Problem"           value={form.problem} />
                  <ReviewRow label="Outcome"           value={form.outcome} />
                  <ReviewRow label="Partnerships"      value={form.partnerships.map(p => PARTNERSHIP_OPTIONS.find(o => o.value === p)?.label ?? p).join(", ")} />
                  {form.specificAsk    && <ReviewRow label="Specific ask" value={form.specificAsk} />}
                  <ReviewRow label="ESG alignment"     value={form.esg === true ? "Yes" : form.esg === false ? "No" : "—"} />
                  <ReviewRow label="Prior experience"  value={form.hadPriorExperience === true ? "Yes" : form.hadPriorExperience === false ? "No" : "—"} />
                  {form.priorExperienceDetail && <ReviewRow label="Prior detail" value={form.priorExperienceDetail} />}
                  {form.sdgTags.length > 0 && <ReviewRow label="SDGs"     value={form.sdgTags.join(", ")} />}
                  {form.tags.length > 0     && <ReviewRow label="Tags"     value={form.tags.join(", ")} />}
                  {form.detailContent && form.detailContent !== "<p></p>" && <ReviewRow label="Full description" value="Included ✓" />}
                  {form.resourceLink   && <ReviewRow label="Resource link" value={form.resourceLink} />}
                  {form.impactEvidence && <ReviewRow label="Impact evidence" value={form.impactEvidence} />}
                  {form.confirmedAssets.length > 0 && !form.confirmedAssets.includes("none") && (
                    <ReviewRow label="Confirmed" value={form.confirmedAssets.map(a => CONFIRMED_ASSET_OPTIONS.find(o => o.value === a)?.label ?? a).join(", ")} />
                  )}
                </div>

                <div className="rounded-xl border border-border bg-muted/20 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Submitting as</p>
                  <p className="text-sm font-medium text-foreground">{form.submitterName || "—"}</p>
                  {form.submitterOrg && <p className="text-xs text-muted-foreground">{form.submitterOrg}</p>}
                  <p className="text-xs text-muted-foreground">{form.submitterEmail}</p>
                </div>

                {error && <p className="text-sm text-destructive">{error}</p>}
              </div>
            )}

            {/* ── Manual path steps ── */}
            {mode === "manual" && (
              <ManualSteps
                step={manualStep}
                form={form}
                set={set}
                toggle={toggle}
                toggleArr={toggleArr}
                editor={editor}
                urlValid={urlValid}
                assessment={assessment}
                assessingBrief={assessingBrief}
                assessBrief={assessBrief}
                supabaseUrl={supabaseUrl}
                orgProfile={orgProfile}
              />
            )}
          </div>
        )}

        {/* Success */}
        {submitted && (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8 py-12">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mb-5" style={{ background: "rgba(45,106,79,0.12)" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2D6A4F" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2">Initiative submitted</h3>
            <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
              Your initiative is pending review and will appear in the marketplace once approved.
            </p>
            <div className="mt-6 flex flex-col items-center gap-3">
              <button type="button" onClick={() => {
                setMode(null); setPlainDescription(""); setAiStep(0); setManualStep(0)
                setForm(INITIAL_STATE); setSubmitted(false); setError(null); setAssessment(null)
                setDescriptionGenerated(false); editor?.commands.setContent("")
              }}
                className="rounded-full h-9 px-6 border border-border text-sm font-semibold text-foreground hover:bg-muted transition-colors">
                Submit another
              </button>
              <button type="button" onClick={handleClose} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Done</button>
            </div>
          </div>
        )}

        {/* Footer */}
        {!submitted && (
          <div className="flex justify-between items-center px-6 py-4 border-t border-border bg-background shrink-0">
            {/* Back button */}
            {mode === null ? (
              <span className="text-xs text-muted-foreground">Choose how to get started</span>
            ) : mode === "ai" && aiStep === 0 ? (
              <button type="button" onClick={() => setMode(null)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors">← Back</button>
            ) : mode === "ai" && aiStep > 0 ? (
              <button type="button" onClick={() => setAiStep(s => s - 1)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors">← Back</button>
            ) : mode === "manual" && manualStep === 0 ? (
              <button type="button" onClick={() => setMode(null)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors">← Back</button>
            ) : mode === "manual" && manualStep > 0 ? (
              <button type="button" onClick={() => setManualStep(s => s - 1)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors">← Back</button>
            ) : <span />}

            {/* Next / Submit button */}
            {mode === null ? (
              <span />
            ) : mode === "ai" && aiStep < 2 ? (
              <button type="button"
                onClick={() => setAiStep(s => s + 1)}
                disabled={!form.title || !form.problem || !form.outcome || form.sectors.length === 0 || form.locations.length === 0 || form.partnerships.length === 0 ||
                  Boolean(form.budgetMin && form.budgetMax && Number(form.budgetMax.replace(/,/g, "")) < Number(form.budgetMin.replace(/,/g, "")))}
                className="rounded-full h-10 px-7 bg-primary hover:bg-primary/90 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                Continue →
              </button>
            ) : mode === "ai" && aiStep === 2 ? (
              <button type="button" onClick={handleSubmit} disabled={submitting}
                className="rounded-full h-10 px-7 bg-primary hover:bg-primary/90 text-white text-sm font-semibold disabled:opacity-40 transition-colors">
                {submitting ? "Publishing..." : "Publish initiative"}
              </button>
            ) : mode === "manual" ? (
              <ManualFooterButton
                step={manualStep}
                form={form}
                urlValid={urlValid}
                onNext={() => setManualStep(s => s + 1)}
                onSubmit={handleSubmit}
                submitting={submitting}
              />
            ) : <span />}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Manual Steps Component ───────────────────────────────────────────────────
function ManualSteps({ step, form, set, toggle, toggleArr, editor, urlValid, assessment, assessingBrief, assessBrief, supabaseUrl, orgProfile }: {
  step: number
  form: FormState
  set: <K extends keyof FormState>(key: K, value: FormState[K]) => void
  toggle: <T>(arr: T[], item: T) => T[]
  toggleArr: (arr: string[], val: string, setter: (v: string[]) => void) => void
  editor: any
  urlValid: (url: string) => boolean
  assessment: BriefAssessment | null
  assessingBrief: boolean
  assessBrief: () => void
  supabaseUrl: string
  orgProfile?: Record<string, any> | null
}) {
  const STAGE_OPTIONS: { value: InitiativeStage; label: string; sub: string }[] = [
    { value: "concept",  label: "💡 Concept",  sub: "Idea defined, no funding yet" },
    { value: "planning", label: "📋 Planning", sub: "Funded, building implementation plan" },
    { value: "active",   label: "🚀 Active",   sub: "Currently executing" },
    { value: "scaling",  label: "📈 Scaling",  sub: "Running successfully, seeking to expand" },
  ]

  function FieldLabel({ children, required, optional }: { children: React.ReactNode; required?: boolean; optional?: boolean }) {
    return (
      <label className="block text-sm font-medium text-foreground mb-2">
        {children}
        {required && <span className="text-primary ml-0.5">*</span>}
        {optional && <span className="text-muted-foreground font-normal ml-1 text-xs">(optional)</span>}
      </label>
    )
  }

  function HintText({ children }: { children: React.ReactNode }) {
    return <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{children}</p>
  }

  const stepTitles = ["The basics", "Challenge & outcome", "Partnership needs", "Your experience", "Initiative detail", "Review & submit"]

  return (
    <div className="space-y-6">
      <div className="mb-7">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Step {step + 1} of 6</p>
        <h2 className="text-xl font-semibold text-foreground">{stepTitles[step]}</h2>
      </div>

      {/* Step 0 */}
      {step === 0 && (
        <div className="space-y-6">
          <div>
            <FieldLabel required>Initiative title</FieldLabel>
            <input type="text" value={form.title} onChange={e => set("title", e.target.value)}
              placeholder="e.g. Rural Last-Mile Health Delivery"
              className="w-full px-3 py-2.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors" />
          </div>
          <div>
            <FieldLabel required>Sectors</FieldLabel>
            <SectorSelector selected={form.sectors} onChange={v => set("sectors", v)} />
          </div>
          <div>
            <FieldLabel required>Location(s)</FieldLabel>
            <TagInput tags={form.locations}
              onAdd={v => set("locations", [...form.locations, v])}
              onRemove={v => set("locations", form.locations.filter(x => x !== v))}
              placeholder="Type a location and press Enter..." />
          </div>
          <div>
            <button type="button" onClick={() => set("openToRemotePartnerships", !form.openToRemotePartnerships)}
              className={cn("w-full text-left px-4 py-3 rounded-xl border text-sm transition-colors flex items-start gap-3",
                form.openToRemotePartnerships ? "border-primary bg-[rgba(196,92,38,0.08)]" : "border-border hover:border-foreground/20")}>
              <span className={cn("w-4 h-4 rounded border flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                form.openToRemotePartnerships ? "bg-primary border-primary" : "border-border")}>
                {form.openToRemotePartnerships && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                )}
              </span>
              <span>
                <span className="font-medium text-foreground block">Open to remote or virtual partnerships</span>
                <span className="text-xs text-muted-foreground">Funders and partners outside these locations can still be a strong match</span>
              </span>
            </button>
          </div>
          <div>
            <FieldLabel required>Who does this initiative directly serve?</FieldLabel>            <textarea value={form.targetPopulation} onChange={e => set("targetPopulation", e.target.value)} rows={2}
              placeholder="e.g. Women smallholder farmers in Kano State, aged 25–50"
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors" />
            <div className="flex justify-end mt-1">
              <p className={`text-xs ${wordCount(form.targetPopulation) > 30 ? 'text-red-500 font-semibold' : 'text-muted-foreground'}`}>{wordCount(form.targetPopulation)}/30 words</p>
            </div>
          </div>
        </div>
      )}

      {/* Step 1 */}
      {step === 1 && (
        <div className="space-y-6">
          <div>
            <FieldLabel required>Problem statement</FieldLabel>
            <textarea value={form.problem} onChange={e => set("problem", e.target.value)} rows={3}
              placeholder="What specific problem does this initiative address? (max 30 words)"
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors" />
            <div className="flex justify-between mt-1">
              {form.problem.length > 0 && form.problem.length < 20 && <p className="text-xs text-red-500">At least 20 characters required.</p>}
              <p className={`text-xs ml-auto ${wordCount(form.problem) > 30 ? 'text-red-500 font-semibold' : 'text-muted-foreground'}`}>{wordCount(form.problem)}/30 words</p>
            </div>
          </div>
          <div>
            <FieldLabel required>Expected outcome</FieldLabel>
            <textarea value={form.outcome} onChange={e => set("outcome", e.target.value)} rows={3}
              placeholder="What measurable outcome will this initiative achieve? (max 30 words)"
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors" />
            <div className="flex justify-between mt-1">
              {form.outcome.length > 0 && form.outcome.length < 20 && <p className="text-xs text-red-500">At least 20 characters required.</p>}
              <p className={`text-xs ml-auto ${wordCount(form.outcome) > 30 ? 'text-red-500 font-semibold' : 'text-muted-foreground'}`}>{wordCount(form.outcome)}/30 words</p>
            </div>
          </div>
          <div>
            <FieldLabel required>Stage</FieldLabel>
            <div className="space-y-2 mt-1">
              {STAGE_OPTIONS.map(opt => (
                <button key={opt.value} type="button" onClick={() => set("stage", opt.value)}
                  className={cn("w-full text-left px-4 py-3 rounded-xl border transition-colors",
                    form.stage === opt.value ? "border-primary bg-[rgba(196,92,38,0.08)]" : "border-border hover:border-foreground/20")}>
                  <p className="text-sm font-semibold">{opt.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{opt.sub}</p>
                </button>
              ))}
            </div>
          </div>
          <div>
            <FieldLabel optional>What is already confirmed?</FieldLabel>
            <div className="space-y-2 mt-1">
              {CONFIRMED_ASSET_OPTIONS.map(opt => (
                <button key={opt.value} type="button"
                  onClick={() => set("confirmedAssets", toggle(form.confirmedAssets, opt.value))}
                  className={cn("w-full text-left px-4 py-2.5 rounded-lg border text-sm transition-colors flex items-center gap-3",
                    form.confirmedAssets.includes(opt.value) ? "border-primary bg-[rgba(196,92,38,0.08)] text-primary" : "border-border hover:border-foreground/20 text-foreground")}>
                  <span className={cn("w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                    form.confirmedAssets.includes(opt.value) ? "bg-primary border-primary" : "border-border")}>
                    {form.confirmedAssets.includes(opt.value) && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                  </span>
                  {opt.label}
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
                className={cn("h-10 rounded-lg border bg-background px-3 text-sm w-full focus:outline-none focus:ring-2 focus:ring-primary/20",
                  form.budgetMin && form.budgetMax && Number(form.budgetMax.replace(/,/g, "")) < Number(form.budgetMin.replace(/,/g, ""))
                    ? "border-red-400 focus:ring-red-300" : "border-border")} />
            </div>
            {form.budgetMin && form.budgetMax && Number(form.budgetMax.replace(/,/g, "")) < Number(form.budgetMin.replace(/,/g, "")) && (
              <p className="text-xs text-red-500 mt-1.5">Max must be greater than or equal to Min.</p>
            )}
          </div>
          <div>
            <FieldLabel optional>SDG alignment</FieldLabel>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {SDG_OPTIONS.map(s => (
                <ChipToggle key={s} label={s}
                  selected={form.sdgTags.includes(s)}
                  onToggle={() => toggleArr(form.sdgTags, s, v => set("sdgTags", v))} />
              ))}
            </div>
          </div>
          <div>
            <FieldLabel optional>Tags</FieldLabel>
            <TagInput tags={form.tags}
              onAdd={v => set("tags", [...form.tags, v])}
              onRemove={v => set("tags", form.tags.filter(x => x !== v))}
              placeholder="Add tags and press Enter..." />
          </div>
        </div>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <div className="space-y-6">
          <div>
            <FieldLabel required>What kind of support are you seeking?</FieldLabel>
            <div className="flex flex-wrap gap-2 mt-2">
              {PARTNERSHIP_OPTIONS.map(p => (
                <ChipToggle key={p.value} label={p.label}
                  selected={form.partnerships.includes(p.value as PartnershipType)}
                  onToggle={() => set("partnerships", toggle(form.partnerships, p.value as PartnershipType))}
                  color={p.color} />
              ))}
            </div>
          </div>
          <div>
            <FieldLabel required>Specific ask</FieldLabel>
            <textarea value={form.specificAsk} onChange={e => set("specificAsk", e.target.value)} rows={3}
              placeholder="What would a partner actually do or contribute? e.g. 'Fund a 6-month pilot at $40,000'"
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors" />
            <div className="flex justify-end mt-1">
              <p className={`text-xs ${wordCount(form.specificAsk) > 80 ? 'text-red-500 font-semibold' : 'text-muted-foreground'}`}>{wordCount(form.specificAsk)}/80 words</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel optional>Estimated start</FieldLabel>
              <input type="month" value={form.startDate} onChange={e => set("startDate", e.target.value)}
                className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <FieldLabel optional>Duration</FieldLabel>
              <select value={form.duration} onChange={e => set("duration", e.target.value)}
                className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
                <option value="">Select...</option>
                {DURATION_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
          <div>
            <FieldLabel>ESG / CSR alignment</FieldLabel>
            <div className="space-y-2 mt-2">
              {[
                { value: true,  label: "Yes — open to corporate ESG adoption", sub: "Organisations can adopt this as their CSR or ESG anchor" },
                { value: false, label: "No — not seeking ESG alignment", sub: "" },
              ].map(opt => (
                <button key={String(opt.value)} type="button" onClick={() => set("esg", opt.value)}
                  className={cn("w-full text-left px-5 py-4 rounded-xl border transition-colors",
                    form.esg === opt.value ? "border-primary bg-[rgba(196,92,38,0.08)]" : "border-border hover:border-foreground/20")}>
                  <p className="text-sm font-semibold">{opt.label}</p>
                  {opt.sub && <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{opt.sub}</p>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 3 */}
      {step === 3 && (
        <div className="space-y-6">
          <div>
            <FieldLabel required>Have you or your team led a similar initiative before?</FieldLabel>
            <div className="space-y-2 mt-1">
              {[{ value: true, label: "Yes" }, { value: false, label: "No" }].map(opt => (
                <button key={String(opt.value)} type="button" onClick={() => set("hadPriorExperience", opt.value)}
                  className={cn("w-full text-left px-5 py-3.5 rounded-xl border text-sm font-semibold transition-colors",
                    form.hadPriorExperience === opt.value ? "border-primary bg-[rgba(196,92,38,0.08)] text-primary" : "border-border hover:border-foreground/20 text-foreground")}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          {form.hadPriorExperience === true && (
            <div>
              <FieldLabel optional>Briefly describe one initiative you or your team completed</FieldLabel>
              <textarea value={form.priorExperienceDetail} onChange={e => set("priorExperienceDetail", e.target.value)} rows={4}
                placeholder="e.g. Co-led a WASH programme across 12 communities in Plateau State, reaching 8,400 beneficiaries. Funded by UNICEF over 2 years."
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors" />
              <div className="flex justify-end mt-1">
                <p className={`text-xs ${wordCount(form.priorExperienceDetail) > 60 ? 'text-red-500 font-semibold' : 'text-muted-foreground'}`}>{wordCount(form.priorExperienceDetail)}/60 words</p>
              </div>
            </div>
          )}

          {/* Impact evidence */}
          <div>
            <FieldLabel optional>Impact evidence</FieldLabel>
            <textarea value={form.impactEvidence} onChange={e => set("impactEvidence", e.target.value)}
              rows={3} placeholder="Describe any evidence of impact so far — beneficiary numbers, outcome data, pilot results, third-party evaluations, or link to an impact report."
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors" />
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">Share what you have, even if it's early-stage.</p>
          </div>

          {/* Target impact metrics */}
          <div>
            <FieldLabel optional>Target impact metrics</FieldLabel>
            <p className="text-xs text-muted-foreground mb-3">What does success look like in numbers?</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Target beneficiaries</label>
                <input type="text" value={form.targetBeneficiaries}
                  onChange={e => set("targetBeneficiaries", e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="e.g. 2000"
                  className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Jobs to be created</label>
                <input type="text" value={form.targetJobs}
                  onChange={e => set("targetJobs", e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="e.g. 50"
                  className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Female beneficiaries %</label>
                <input type="text" value={form.targetFemalePct}
                  onChange={e => set("targetFemalePct", e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="e.g. 60"
                  className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Timeline (months)</label>
                <input type="text" value={form.targetTimelineMonths}
                  onChange={e => set("targetTimelineMonths", e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="e.g. 18"
                  className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 4 */}
      {step === 4 && (
        <div className="space-y-5">
          <AIDescriptionGenerator form={form} supabaseUrl={supabaseUrl} orgProfile={orgProfile} onGenerated={content => {
            editor?.commands.setContent(`<p>${content.split("\n\n").join("</p><p>")}</p>`)
            set("detailContent", `<p>${content.split("\n\n").join("</p><p>")}</p>`)
          }} />
          <div>
            <FieldLabel optional>Full initiative description</FieldLabel>
            <div className="flex gap-1 border border-border rounded-t-lg px-2 py-1.5 bg-muted/40 flex-wrap">
              {[
                { label: "B",      action: () => editor?.chain().focus().toggleBold().run(),                 active: editor?.isActive("bold"),                  style: "font-bold" },
                { label: "I",      action: () => editor?.chain().focus().toggleItalic().run(),               active: editor?.isActive("italic"),                style: "italic" },
                { label: "H2",     action: () => editor?.chain().focus().toggleHeading({ level: 2 }).run(), active: editor?.isActive("heading", { level: 2 }), style: "" },
                { label: "• List", action: () => editor?.chain().focus().toggleBulletList().run(),          active: editor?.isActive("bulletList"),            style: "" },
              ].map(btn => (
                <button key={btn.label} type="button" onMouseDown={e => { e.preventDefault(); btn.action(); }}
                  className={`px-2 py-0.5 rounded text-xs transition-colors ${btn.style} ${btn.active ? 'bg-primary text-white' : 'hover:bg-muted text-muted-foreground'}`}>
                  {btn.label}
                </button>
              ))}
            </div>
            <div className="border border-border border-t-0 rounded-b-lg min-h-[180px] bg-background focus-within:ring-1 focus-within:ring-primary/20 cursor-text"
              onClick={() => editor?.chain().focus().run()}>
              <EditorContent editor={editor}
                className="[&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[160px] [&_.ProseMirror]:px-3 [&_.ProseMirror]:py-2 [&_.ProseMirror]:text-sm [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-muted-foreground/50 [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none" />
            </div>
          </div>
          <div>
            <FieldLabel optional>Resource link</FieldLabel>
            <input type="url" placeholder="https://drive.google.com/..." value={form.resourceLink}
              onChange={e => set("resourceLink", e.target.value)}
              className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors" />
            {form.resourceLink && !urlValid(form.resourceLink) && <p className="text-xs text-red-500 mt-1">Please enter a valid address.</p>}
          </div>
          

          </div>
      )}

      {/* Step 5 — Review */}
      {step === 5 && (
        <div className="space-y-6">
          {!assessment && !assessingBrief && (
            <button type="button" onClick={assessBrief}
              className="w-full flex items-center gap-2 px-4 py-3 rounded-xl border border-dashed border-[#2D6A4F]/40 text-sm text-[#2D6A4F] hover:bg-[#2D6A4F]/5 transition-colors">
              <Sparkles className="w-4 h-4 shrink-0" />
              How does this brief look to a funder?
            </button>
          )}
          {assessingBrief && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-border">
              <Loader2 className="w-4 h-4 animate-spin text-[#2D6A4F]" />
              <p className="text-sm text-muted-foreground">Assessing brief quality...</p>
            </div>
          )}
          {assessment && (() => {
            const cfg = SCORE_CONFIG[assessment.score]
            const Icon = cfg.icon
            return (
              <div className="rounded-xl border px-4 py-4 space-y-2" style={{ borderColor: cfg.color + "40", background: cfg.bg }}>
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 shrink-0" style={{ color: cfg.color }} />
                  <p className="text-sm font-semibold" style={{ color: cfg.color }}>{cfg.label}</p>
                </div>
                <p className="text-xs text-foreground leading-relaxed">{assessment.what_works}</p>
                <p className="text-xs text-muted-foreground leading-relaxed"><span className="font-medium text-foreground">To strengthen: </span>{assessment.improve}</p>
              </div>
            )
          })()}
          <div className="rounded-xl border border-border bg-muted/30 px-4 divide-y divide-border">
            <ReviewRow label="Title"             value={form.title} />
            <ReviewRow label="Sectors"           value={form.sectors.join(", ")} />
            <ReviewRow label="Locations"         value={form.locations.join(", ")} />
            <ReviewRow label="Remote partnerships" value={form.openToRemotePartnerships ? "Open to remote/virtual" : "Location-specific only"} />
            {form.targetPopulation && <ReviewRow label="Serves"        value={form.targetPopulation} />}            {form.stage            && <ReviewRow label="Stage"         value={form.stage} />}
            <ReviewRow label="Budget"            value={form.budgetMin || form.budgetMax ? `${form.currency} ${form.budgetMin} – ${form.budgetMax}` : "—"} />
            <ReviewRow label="Problem"           value={form.problem} />
            <ReviewRow label="Outcome"           value={form.outcome} />
            <ReviewRow label="Partnerships"      value={form.partnerships.map(p => PARTNERSHIP_OPTIONS.find(o => o.value === p)?.label ?? p).join(", ")} />
            {form.specificAsk     && <ReviewRow label="Specific ask"   value={form.specificAsk} />}
            {form.startDate       && <ReviewRow label="Start date"     value={form.startDate} />}
            {form.duration        && <ReviewRow label="Duration"       value={form.duration} />}
            <ReviewRow label="ESG alignment"     value={form.esg === true ? "Yes" : form.esg === false ? "No" : "—"} />
            <ReviewRow label="Prior experience"  value={form.hadPriorExperience === true ? "Yes" : form.hadPriorExperience === false ? "No" : "—"} />
            {form.priorExperienceDetail && <ReviewRow label="Prior detail" value={form.priorExperienceDetail} />}
            {form.confirmedAssets.length > 0 && !form.confirmedAssets.includes("none") && (
              <ReviewRow label="Confirmed" value={form.confirmedAssets.map(a => CONFIRMED_ASSET_OPTIONS.find(o => o.value === a)?.label ?? a).join(", ")} />
            )}
            {form.sdgTags.length > 0    && <ReviewRow label="SDGs"           value={form.sdgTags.join(", ")} />}
            {form.tags.length > 0       && <ReviewRow label="Tags"           value={form.tags.join(", ")} />}
            {form.detailContent && form.detailContent !== "<p></p>" && <ReviewRow label="Full description" value="Included ✓" />}
            {form.resourceLink          && <ReviewRow label="Resource link"  value={form.resourceLink} />}
            {form.impactEvidence        && <ReviewRow label="Impact evidence" value={form.impactEvidence} />}
          </div>
          <div className="rounded-xl border border-border bg-muted/20 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Submitting as</p>
            <p className="text-sm font-medium text-foreground">{form.submitterName || "—"}</p>
            {form.submitterOrg && <p className="text-xs text-muted-foreground">{form.submitterOrg}</p>}
            <p className="text-xs text-muted-foreground">{form.submitterEmail}</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Manual Footer Button ─────────────────────────────────────────────────────
function ManualFooterButton({ step, form, urlValid, onNext, onSubmit, submitting }: {
  step: number
  form: FormState
  urlValid: (url: string) => boolean
  onNext: () => void
  onSubmit: () => void
  submitting: boolean
}) {
  const step0Valid = !!form.title && form.sectors.length > 0 && form.locations.length > 0 && form.targetPopulation.trim().length > 0
  const budgetValid = !(form.budgetMin && form.budgetMax && Number(form.budgetMax.replace(/,/g, "")) < Number(form.budgetMin.replace(/,/g, "")))
  const step1Valid = form.problem.length >= 20 && wordCount(form.problem) <= 30 && form.outcome.length >= 20 && wordCount(form.outcome) <= 30 && !!form.stage && budgetValid
  const step2Valid = form.partnerships.length > 0 && form.specificAsk.trim().length > 0
  const step3Valid = form.hadPriorExperience !== null
  const step4Valid = !(form.resourceLink && !urlValid(form.resourceLink))

  const disabled =
    (step === 0 && !step0Valid) ||
    (step === 1 && !step1Valid) ||
    (step === 2 && !step2Valid) ||
    (step === 3 && !step3Valid) ||
    (step === 4 && !step4Valid)

  if (step === 5) {
    return (
      <button type="button" onClick={onSubmit} disabled={submitting}
        className="rounded-full h-10 px-7 bg-primary hover:bg-primary/90 text-white text-sm font-semibold disabled:opacity-40 transition-colors">
        {submitting ? "Publishing..." : "Publish initiative"}
      </button>
    )
  }

  return (
    <button type="button" onClick={onNext} disabled={disabled}
      className="rounded-full h-10 px-7 bg-primary hover:bg-primary/90 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
      Continue →
    </button>
  )
}

// ─── Also need generate-initiative-description Edge Function ──────────────────
// This is called by AIDescriptionGenerator as fallback
// Deploy separately: supabase/functions/generate-initiative-description/index.ts
