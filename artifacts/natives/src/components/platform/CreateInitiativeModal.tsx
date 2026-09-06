import { useState, useRef, useEffect } from "react"
import { getAuthLinkProps } from "@/lib/authLinks";
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import { supabase } from "@/lib/supabase";
import { SECTOR_OPTIONS } from "@/lib/sectors";
import { useAuth } from "@/context/AuthContext";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
// ─── Types ────────────────────────────────────────────────────────────────────
type PartnershipType =
  | "funding" | "technical" | "operational" | "leadership" | "strategic" | "lead";
interface FormState {
  title: string;
  sectors: string[];
  locations: string[];
  openToRemotePartnerships: boolean;
  budgetMin: string;
  budgetMax: string;
  currency: string;
  detailContent: string;
  resourceLink: string;
  problem: string;
  outcome: string;
  tags: string[];
  partnerships: PartnershipType[];
  esg: boolean | null;
  submitterName: string;
  submitterOrg: string;
  submitterEmail: string;
}
const INITIAL_STATE: FormState = {
  title: "",
  sectors: [],
  locations: [],
  openToRemotePartnerships: false,
  budgetMin: "",
  budgetMax: "",
  currency: "USD",
  detailContent: "",
  resourceLink: "",
  problem: "",
  outcome: "",
  tags: [],
  partnerships: [],
  esg: null,
  submitterName: "",
  submitterOrg: "",
  submitterEmail: "",
};
const CURRENCIES = [
  { code: "USD", symbol: "$",   label: "USD — US Dollar" },
  { code: "GBP", symbol: "£",   label: "GBP — British Pound" },
  { code: "EUR", symbol: "€",   label: "EUR — Euro" },
  { code: "NGN", symbol: "₦",   label: "NGN — Nigerian Naira" },
  { code: "KES", symbol: "KSh", label: "KES — Kenyan Shilling" },
  { code: "GHS", symbol: "GH₵", label: "GHS — Ghanaian Cedi" },
  { code: "ZAR", symbol: "R",   label: "ZAR — South African Rand" },
  { code: "CAD", symbol: "CA$", label: "CAD — Canadian Dollar" },
  { code: "AUD", symbol: "A$",  label: "AUD — Australian Dollar" },
]
function wordCount(text: string): number {
  return text.trim() === "" ? 0 : text.trim().split(/\s+/).length
}
const PARTNERSHIP_OPTIONS: { value: PartnershipType; label: string; color: string }[] = [
  { value: "funding",     label: "Funding",      color: "#C47A3A" },
  { value: "technical",   label: "Technical",    color: "#4A8C5C" },
  { value: "operational", label: "Operational",  color: "#C8965A" },
  { value: "leadership",  label: "Leadership",   color: "#6B9E78" },
  { value: "strategic",   label: "Strategic",    color: "#B45C38" },
  { value: "lead",        label: "Project Lead", color: "#5C9E72" },
];
// ─── Sector Selector ──────────────────────────────────────────────────────────
function SectorSelector({ selected, onChange }: { selected: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false)
  const [customInput, setCustomInput] = useState("")
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
  function addCustom() {
    const v = customInput.trim()
    if (v && !selected.includes(v)) onChange([...selected, v])
    setCustomInput("")
  }
  return (
    <div>
      <FieldLabel required>Sectors</FieldLabel>
      <div ref={ref} className="relative">
        <div
          className="min-h-[48px] flex flex-wrap gap-1.5 items-center border border-border rounded-lg px-3 py-2 bg-background cursor-pointer focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-colors"
          onClick={() => setOpen(o => !o)}
        >
          {selected.length === 0 && (
            <span className="text-sm text-muted-foreground/50">Select sectors...</span>
          )}
          {selected.map((s) => (
            <span key={s} className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full"
              style={{ background: "#f5ede8", color: "#C45C26" }}>
              {s}
              <button type="button" onClick={(e) => { e.stopPropagation(); toggle(s) }}
                className="leading-none hover:opacity-70 ml-0.5">×</button>
            </span>
          ))}
          <svg className={`w-4 h-4 text-muted-foreground ml-auto shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
        </div>
        {open && (
          <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-popover shadow-lg">
            {SECTOR_OPTIONS.map(s => (
              <button key={s} type="button" onClick={() => toggle(s)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-muted/60 transition-colors text-left">
                <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                  selected.includes(s) ? 'bg-primary border-primary' : 'border-border'
                }`}>
                  {selected.includes(s) && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                </span>
                {s}
              </button>
            ))}
            <div className="border-t border-border px-3 py-2 flex gap-2">
              <input
                type="text"
                value={customInput}
                onChange={e => setCustomInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom() } }}
                placeholder="Add custom sector..."
                className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground/50"
                onClick={e => e.stopPropagation()}
              />
              <button type="button" onClick={addCustom}
                className="text-xs font-semibold text-primary hover:opacity-70 shrink-0">
                Add
              </button>
            </div>
          </div>
        )}
      </div>
      <HintText>Select from list or add your own.</HintText>
    </div>
  )
}
// ─── Sub-components ───────────────────────────────────────────────────────────
// 5-segment step bar
function StepBar({ current }: { current: number }) {
  return (
    <div className="flex gap-1.5">
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="h-[3px] flex-1 rounded-full transition-colors duration-300"
          style={{
            background:
              i < current ? "#2D6A4F" : i === current ? "#C45C26" : "rgba(0,0,0,0.1)",
          }}
        />
      ))}
    </div>
  );
}
function FieldLabel({
  children,
  required,
  optional,
}: {
  children: React.ReactNode;
  required?: boolean;
  optional?: boolean;
}) {
  return (
    <label className="block text-sm font-medium text-foreground mb-2">
      {children}
      {required && <span className="text-primary ml-0.5">*</span>}
      {optional && (
        <span className="text-muted-foreground font-normal ml-1 text-xs">(optional)</span>
      )}
    </label>
  );
}
function HintText({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{children}</p>
  );
}
function TagInput({
  tags,
  onAdd,
  onRemove,
  placeholder,
}: {
  tags: string[];
  onAdd: (v: string) => void;
  onRemove: (v: string) => void;
  placeholder: string;
}) {
  const [input, setInput] = useState("");
  function commit() {
    const v = input.trim().replace(/,$/, "");
    if (v && !tags.includes(v)) onAdd(v);
    setInput("");
  }
  return (
    <div
      className="flex flex-wrap gap-1.5 px-3 py-2.5 min-h-[48px] items-center border border-border rounded-lg cursor-text focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-colors"
      onClick={(e) =>
        (e.currentTarget.querySelector("input") as HTMLInputElement)?.focus()
      }
    >
      {tags.map((t) => (
        <span
          key={t}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
          style={{ background: "#f5ede8", color: "#C45C26" }}
        >
          {t}
          <button
            type="button"
            onClick={() => onRemove(t)}
            className="leading-none hover:opacity-70 ml-0.5"
            aria-label={`Remove ${t}`}
          >
            ×
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commit();
          }
          if (e.key === "Backspace" && !input && tags.length) {
            onRemove(tags[tags.length - 1]);
          }
        }}
        onBlur={commit}
        placeholder={tags.length === 0 ? placeholder : ""}
        className="flex-1 min-w-[140px] bg-transparent border-none outline-none text-sm placeholder:text-muted-foreground/50"
      />
    </div>
  );
}
function ChipGroup<T extends string>({
  options,
  selected,
  onToggle,
  getLabel,
  getDot,
}: {
  options: T[];
  selected: T[];
  onToggle: (v: T) => void;
  getLabel?: (v: T) => string;
  getDot?: (v: T) => string;
}) {
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {options.map((v) => {
        const isSelected = selected.includes(v);
        return (
          <button
            key={v}
            type="button"
            onClick={() => onToggle(v)}
            className={cn(
              "inline-flex items-center gap-1.5 px-4 py-2 rounded-full border text-sm font-medium transition-all",
              isSelected
                ? "border-primary bg-[#f5ede8] text-primary"
                : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
            )}
          >
            {isSelected && getDot && (
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: getDot(v) }}
              />
            )}
            {getLabel ? getLabel(v) : v}
          </button>
        );
      })}
    </div>
  );
}
function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 py-3 border-b border-border last:border-0">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="text-sm text-foreground leading-relaxed">{value || "—"}</span>
    </div>
  );
}
// ─── Step header labels ───────────────────────────────────────────────────────
const STEP_TITLES = [
  "The basics",
  "Challenge & outcome",
  "Partnership needs",
  "Initiative detail",
  "Review & publish",
];
function StepHeader({ step }: { step: number }) {
  return (
    <div className="mb-7">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
        Step {step + 1} of 5
      </p>
      <h2 className="text-xl font-semibold text-foreground">{STEP_TITLES[step]}</h2>
    </div>
  );
}
function StepFooter({
  onBack,
  onNext,
  nextLabel = "Continue →",
  nextDisabled = false,
  submitting = false,
}: {
  onBack?: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  submitting?: boolean;
}) {
  return (
    <div className="flex justify-between items-center px-6 py-4 border-t border-border bg-background shrink-0">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back
        </button>
      ) : (
        <span className="text-xs text-muted-foreground">Fields marked * are required</span>
      )}
      <button
        type="button"
        onClick={onNext}
        disabled={nextDisabled || submitting}
        className="rounded-full h-10 px-7 bg-primary hover:bg-primary/90 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {submitting ? "Publishing..." : nextLabel}
      </button>
    </div>
  );
}
// ─── Main Modal ───────────────────────────────────────────────────────────────
export default function CreateInitiativeModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (data: FormState) => void;
}) {
  // orgOwnerId is null for anonymous visitors (this modal supports
  // logged-out submission, per the success screen's "sign in to track
  // your submission" copy) and resolves normally for signed-in Owners or
  // Members. Assumes this component is mounted under <AuthProvider> --
  // true for any route that needs sign-in state visible, which a public
  // marketing page does (e.g. showing "Sign in" vs a dashboard link).
  const { orgOwnerId } = useAuth();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Write your full initiative description here..." }),
    ],
    onUpdate: ({ editor }) => {
      setForm(f => ({ ...f, detailContent: editor.getHTML() }))
    },
  })
  if (!isOpen) return null;
  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }
  function toggle<T>(arr: T[], item: T): T[] {
    return arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
  }
  function handleClose() {
    onClose();
    setTimeout(() => {
      setStep(0);
      setForm(INITIAL_STATE);
      setSubmitted(false);
      setError(null);
    }, 300);
  }
  async function handleSubmit() {
    if (!form.submitterName.trim() || !form.submitterEmail.trim()) {
      setError("Please fill in your name and email.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { error: dbError } = await supabase
        .from("initiative_requests")
        .insert({
          title:           form.title,
          sectors:         form.sectors,
          locations:       form.locations,
          open_to_remote_partnerships: form.openToRemotePartnerships,
          budget:          form.budgetMin || form.budgetMax
            ? `${form.currency} ${form.budgetMin}–${form.budgetMax}`
            : null,
          detail_content:  form.detailContent || null,
          resource_link:   form.resourceLink  || null,
          problem:         form.problem,
          outcome:         form.outcome,
          tags:            form.tags,
          partnerships:    form.partnerships,
          esg_alignment:   form.esg,
          status:          "pending",
          eois:            0,
          // Org-level, not the literal creator -- same fix applied to
          // CreateInitiativeModalDashboard.tsx. orgOwnerId is null for an
          // anonymous submitter (unchanged behavior), resolves to the
          // Owner's id for a signed-in Member, or their own id for an
          // Owner or individual account.
          user_id:         orgOwnerId ?? null,
          submitter_name:  form.submitterName,
          submitter_org:   form.submitterOrg || null,
          submitter_email: form.submitterEmail,
        });
      if (dbError) throw dbError;
      setSubmitted(true);
      onSuccess?.(form);
    } catch (e: unknown) {
      console.error("Submit error:", e);
      setError(e instanceof Error ? e.message : JSON.stringify(e));
    } finally {
      setSubmitting(false);
    }
  }
  // ── Validation ──────────────────────────────────────────────────────────────
  const step0Valid = !!form.title && form.sectors.length > 0 && form.locations.length > 0;
  const budgetMaxLtMin =
    !!(form.budgetMin && form.budgetMax &&
    Number(form.budgetMax.replace(/,/g, '')) < Number(form.budgetMin.replace(/,/g, '')));
  const step1Valid =
    form.problem.length >= 20 && wordCount(form.problem) <= 30 &&
    form.outcome.length >= 20 && wordCount(form.outcome) <= 30 &&
    !budgetMaxLtMin;
  const step2Valid = form.partnerships.length > 0;
  const urlValid = (url: string) => {
    if (!url) return true;
    if (/\s/.test(url)) return false;
    try {
      const u = new URL(url);
      return (u.protocol === 'https:' || u.protocol === 'http:') && u.hostname.includes('.');
    } catch { return false; }
  };
  const step3Valid = !(form.resourceLink && !urlValid(form.resourceLink));
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.submitterEmail.trim());
  const step4Valid = !!form.submitterName.trim() && emailValid;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto"
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div
        className="bg-background rounded-2xl border border-border w-full max-w-lg shadow-xl flex flex-col"
        style={{ height: "min(90vh, 740px)" }}
      >
        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-border shrink-0">
          <div className="flex-1">
            <StepBar current={step} />
          </div>
          <button type="button" onClick={handleClose}
            className="shrink-0 p-1.5 rounded-full hover:bg-muted transition-colors -mt-0.5" aria-label="Close">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        {/* ── Body ── */}
        {!submitted && (
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {/* ── Step 0: Basics ── */}
            {step === 0 && (
              <div className="space-y-6">
                <StepHeader step={0} />
                <div>
                  <FieldLabel required>Initiative title</FieldLabel>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => set("title", e.target.value)}
                    placeholder="e.g. Rural Last-Mile Health Delivery"
                    className="w-full px-3 py-2.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                  />
                </div>
                <SectorSelector
                  selected={form.sectors}
                  onChange={(sectors) => setForm(f => ({ ...f, sectors }))}
                />
                <div>
                  <FieldLabel required>Location(s)</FieldLabel>
                  <TagInput
                    tags={form.locations}
                    onAdd={(v) => set("locations", [...form.locations, v])}
                    onRemove={(v) => set("locations", form.locations.filter((x) => x !== v))}
                    placeholder="Type a location and press Enter..."
                  />
                  <HintText>e.g. Lagos, West Africa, East Africa, Sub-Saharan Africa</HintText>
                </div>
                <div>
                  <button type="button" onClick={() => set("openToRemotePartnerships", !form.openToRemotePartnerships)}
                    className={cn("w-full text-left px-4 py-3 rounded-xl border text-sm transition-colors flex items-start gap-3",
                      form.openToRemotePartnerships ? "border-primary bg-[#fdf5f2]" : "border-border hover:border-foreground/20")}>
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
              </div>
            )}
            {/* ── Step 1: Challenge & Outcome ── */}
            {step === 1 && (
              <div className="space-y-6">
                <StepHeader step={1} />
                <div>
                  <FieldLabel required>Problem statement</FieldLabel>
                  <textarea
                    placeholder="What specific problem does this initiative address? (max 30 words)"
                    value={form.problem}
                    onChange={e => setForm(f => ({ ...f, problem: e.target.value }))}
                    rows={3}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                  />
                  <div className="flex justify-between mt-1">
                    {form.problem.length > 0 && form.problem.length < 20 && (
                      <p className="text-xs text-red-500">At least 20 characters required.</p>
                    )}
                    <p className={`text-xs ml-auto ${wordCount(form.problem) > 30 ? 'text-red-500 font-semibold' : 'text-muted-foreground'}`}>
                      {wordCount(form.problem)}/30 words
                    </p>
                  </div>
                </div>
                <div>
                  <FieldLabel required>Expected outcome</FieldLabel>
                  <textarea
                    placeholder="What measurable outcome will this initiative achieve? (max 30 words)"
                    value={form.outcome}
                    onChange={e => setForm(f => ({ ...f, outcome: e.target.value }))}
                    rows={3}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                  />
                  <div className="flex justify-between mt-1">
                    {form.outcome.length > 0 && form.outcome.length < 20 && (
                      <p className="text-xs text-red-500">At least 20 characters required.</p>
                    )}
                    <p className={`text-xs ml-auto ${wordCount(form.outcome) > 30 ? 'text-red-500 font-semibold' : 'text-muted-foreground'}`}>
                      {wordCount(form.outcome)}/30 words
                    </p>
                  </div>
                </div>
                <div>
                  <FieldLabel optional>Budget range</FieldLabel>
                  <div className="flex gap-2 items-center">
                    <select
                      value={form.currency}
                      onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                      className="h-10 rounded-lg border border-border bg-background px-2 text-sm w-[90px] shrink-0 focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      {CURRENCIES.map(c => (
                        <option key={c.code} value={c.code}>{c.code}</option>
                      ))}
                    </select>
                    <input
                      type="text" inputMode="decimal" placeholder="Min"
                      value={form.budgetMin}
                      onChange={e => setForm(f => ({ ...f, budgetMin: e.target.value.replace(/[^0-9.,]/g, '') }))}
                      className="h-10 rounded-lg border border-border bg-background px-3 text-sm w-full focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <span className="text-muted-foreground shrink-0 text-sm">–</span>
                    <input
                      type="text" inputMode="decimal" placeholder="Max"
                      value={form.budgetMax}
                      onChange={e => setForm(f => ({ ...f, budgetMax: e.target.value.replace(/[^0-9.,]/g, '') }))}
                      className="h-10 rounded-lg border border-border bg-background px-3 text-sm w-full focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  {budgetMaxLtMin && (
                    <p className="text-xs text-red-500 mt-1">Max must be greater than or equal to min.</p>
                  )}
                  <HintText>Numbers only. Leave blank if not yet defined.</HintText>
                </div>
                <div>
                  <FieldLabel optional>Tags</FieldLabel>
                  <TagInput
                    tags={form.tags}
                    onAdd={(v) => set("tags", [...form.tags, v])}
                    onRemove={(v) => set("tags", form.tags.filter((x) => x !== v))}
                    placeholder="Add tags and press Enter..."
                  />
                  <HintText>Short keywords that help people find this initiative</HintText>
                </div>
              </div>
            )}
            {/* ── Step 2: Partnerships ── */}
            {step === 2 && (
              <div className="space-y-7">
                <StepHeader step={2} />
                <div>
                  <FieldLabel required>What kind of support are you seeking?</FieldLabel>
                  <ChipGroup
                    options={PARTNERSHIP_OPTIONS.map((p) => p.value)}
                    selected={form.partnerships}
                    onToggle={(v) => set("partnerships", toggle(form.partnerships, v as PartnershipType))}
                    getLabel={(v) => PARTNERSHIP_OPTIONS.find((p) => p.value === v)?.label ?? v}
                    getDot={(v) => PARTNERSHIP_OPTIONS.find((p) => p.value === v)?.color ?? "#C45C26"}
                  />
                  <HintText>Select all that apply. You can update this as the initiative evolves.</HintText>
                </div>
                <div>
                  <FieldLabel>ESG / CSR alignment</FieldLabel>
                  <div className="space-y-3 mt-3">
                    {[
                      { value: true,  label: "Yes — open to corporate ESG adoption", sub: "Organisations can adopt this as their CSR or ESG anchor" },
                      { value: false, label: "No — not seeking ESG alignment",        sub: "" },
                    ].map((opt) => (
                      <button key={String(opt.value)} type="button" onClick={() => set("esg", opt.value)}
                        className={cn(
                          "w-full text-left px-5 py-4 rounded-xl border transition-colors",
                          form.esg === opt.value ? "border-primary bg-[#fdf5f2]" : "border-border hover:border-foreground/20"
                        )}>
                        <p className="text-sm font-semibold">{opt.label}</p>
                        {opt.sub && <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{opt.sub}</p>}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {/* ── Step 3: Full Detail (optional) ── */}
            {step === 3 && (
              <div className="space-y-6">
                <StepHeader step={3} />
                <div>
                  <FieldLabel optional>Full initiative description</FieldLabel>
                  <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                    Share your concept note, proposal, or pitch. This is only visible to logged-in users.
                    Include background, methodology, team, and timeline if available.
                  </p>
                  {/* Toolbar */}
                  <div className="flex gap-1 border border-border rounded-t-lg px-2 py-1.5 bg-muted/40 flex-wrap">
                    {[
                      { label: "B",      action: () => editor?.chain().focus().toggleBold().run(),                    active: editor?.isActive("bold"),                    style: "font-bold"      },
                      { label: "I",      action: () => editor?.chain().focus().toggleItalic().run(),                  active: editor?.isActive("italic"),                  style: "italic"         },
                      { label: "S",      action: () => editor?.chain().focus().toggleStrike().run(),                  active: editor?.isActive("strike"),                  style: "line-through"   },
                      { label: "H2",     action: () => editor?.chain().focus().toggleHeading({ level: 2 }).run(),     active: editor?.isActive("heading", { level: 2 }),   style: ""               },
                      { label: "H3",     action: () => editor?.chain().focus().toggleHeading({ level: 3 }).run(),     active: editor?.isActive("heading", { level: 3 }),   style: ""               },
                      { label: "• List", action: () => editor?.chain().focus().toggleBulletList().run(),              active: editor?.isActive("bulletList"),              style: ""               },
                      { label: "1. List",action: () => editor?.chain().focus().toggleOrderedList().run(),             active: editor?.isActive("orderedList"),             style: ""               },
                    ].map(btn => (
                      <button key={btn.label} type="button" onClick={btn.action}
                        className={`px-2 py-0.5 rounded text-xs transition-colors ${btn.style} ${
                          btn.active ? 'bg-primary text-white' : 'hover:bg-muted text-muted-foreground'
                        }`}>
                        {btn.label}
                      </button>
                    ))}
                  </div>
                  <div
                    className="border border-border border-t-0 rounded-b-lg min-h-[180px] bg-background focus-within:ring-1 focus-within:ring-primary/20 cursor-text"
                    style={{ lineHeight: '1.6' }}
                    onClick={() => editor?.chain().focus().run()}
                  >
                    <EditorContent
                      editor={editor}
                      className="[&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[160px] [&_.ProseMirror]:px-3 [&_.ProseMirror]:py-2 [&_.ProseMirror]:text-sm [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-muted-foreground/50 [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none"
                    />
                  </div>
                </div>
                <div>
                  <FieldLabel optional>Resource link</FieldLabel>
                  <input
                    type="url"
                    placeholder="https://drive.google.com/... or any public document link"
                    value={form.resourceLink}
                    onChange={e => setForm(f => ({ ...f, resourceLink: e.target.value }))}
                    className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                  />
                  {form.resourceLink && !urlValid(form.resourceLink) && (
                    <p className="text-xs text-red-500 mt-1">Please enter a valid address.</p>
                  )}
                  <HintText>Link to a pitch deck, concept note, or proposal (Google Drive, Dropbox, Notion, etc.)</HintText>
                </div>
              </div>
            )}
            {/* ── Step 4: Review & Submit ── */}
            {step === 4 && (
              <div className="space-y-6">
                <StepHeader step={4} />
                {/* Summary */}
                <div className="rounded-xl border border-border bg-muted/30 px-4 divide-y divide-border">
                  <ReviewRow label="Title"    value={form.title} />
                  <ReviewRow label="Sectors"  value={form.sectors.join(", ")} />
                  <ReviewRow label="Locations" value={form.locations.join(", ")} />
                  <ReviewRow label="Remote partnerships" value={form.openToRemotePartnerships ? "Open to remote/virtual" : "Location-specific only"} />
                  <ReviewRow
                    label="Budget"
                    value={form.budgetMin || form.budgetMax
                      ? `${form.currency} ${form.budgetMin} – ${form.budgetMax}`
                      : "—"}
                  />
                  <ReviewRow label="Problem"  value={form.problem} />
                  <ReviewRow label="Outcome"  value={form.outcome} />
                  <ReviewRow
                    label="Partnerships"
                    value={form.partnerships
                      .map((p) => PARTNERSHIP_OPTIONS.find((o) => o.value === p)?.label ?? p)
                      .join(", ")}
                  />
                  <ReviewRow label="ESG alignment" value={form.esg === true ? "Yes" : form.esg === false ? "No" : "—"} />
                  {form.tags.length > 0 && <ReviewRow label="Tags" value={form.tags.join(", ")} />}
                  {form.resourceLink && <ReviewRow label="Resource link" value={form.resourceLink} />}
                  {form.detailContent && form.detailContent !== "<p></p>" && (
                    <ReviewRow label="Full description" value="Included ✓" />
                  )}
                </div>
                {/* Submitter details */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                    Your details
                  </p>
                  <div className="space-y-4">
                    <div>
                      <FieldLabel required>Full name</FieldLabel>
                      <input
                        type="text"
                        value={form.submitterName}
                        onChange={(e) => set("submitterName", e.target.value)}
                        placeholder="Full name"
                        className="w-full px-3 py-2.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                      />
                    </div>
                    <div>
                      <FieldLabel optional>Organisation</FieldLabel>
                      <input
                        type="text"
                        value={form.submitterOrg}
                        onChange={(e) => set("submitterOrg", e.target.value)}
                        placeholder="Organisation or initiative owner"
                        className="w-full px-3 py-2.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                      />
                    </div>
                    <div>
                      <FieldLabel required>Email</FieldLabel>
                      <input
                        type="email"
                        value={form.submitterEmail}
                        onChange={(e) => set("submitterEmail", e.target.value)}
                        placeholder="you@example.com"
                        className="w-full px-3 py-2.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                      />
                      {form.submitterEmail.length > 0 && !emailValid && (
                        <p className="text-xs text-red-500 mt-1">Please enter a valid email address.</p>
                      )}
                    </div>
                  </div>
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
              </div>
            )}
          </div>
        )}
        {/* ── Success ── */}
        {submitted && (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8 py-12">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mb-5" style={{ background: "#eaf5ee" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2D6A4F" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2">Initiative submitted</h3>
            <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
              Your initiative has been received. It will appear in the marketplace once reviewed.
              We'll contact you via email with next steps.
            </p>
            <div className="mt-6 w-full max-w-xs rounded-xl border border-border bg-muted/40 px-5 py-4 text-left">
              <p className="text-sm font-semibold mb-1">Track your initiative</p>
              <p className="text-xs text-muted-foreground mb-3">
                Sign in or create an account to track your submission and express interest in others.
              </p>
              <div className="flex gap-2">
                <a {...getAuthLinkProps("/signin")} className="flex-1 text-center rounded-full h-8 px-4 bg-primary hover:bg-primary/90 text-white text-xs font-semibold transition-colors flex items-center justify-center">
                  Sign in
                </a>
                <a {...getAuthLinkProps("/signup")} className="flex-1 text-center rounded-full h-8 px-4 border border-primary text-primary hover:bg-primary/5 text-xs font-semibold transition-colors flex items-center justify-center">
                  Create account
                </a>
              </div>
            </div>
            <div className="mt-4 flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setStep(0);
                  setForm(INITIAL_STATE);
                  setSubmitted(false);
                  setError(null);
                }}
                className="rounded-full h-9 px-6 border border-border text-sm font-semibold text-foreground hover:bg-muted transition-colors"
              >
                Submit another initiative
              </button>
              <button type="button" onClick={handleClose} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Done
              </button>
            </div>
          </div>
        )}
        {/* ── Footer ── */}
        {!submitted && step === 0 && (
          <StepFooter onNext={() => setStep(1)} nextDisabled={!step0Valid} />
        )}
        {!submitted && step === 1 && (
          <StepFooter onBack={() => setStep(0)} onNext={() => setStep(2)} nextDisabled={!step1Valid} />
        )}
        {!submitted && step === 2 && (
          <StepFooter onBack={() => setStep(1)} onNext={() => setStep(3)} nextDisabled={!step2Valid} />
        )}
        {!submitted && step === 3 && (
          <StepFooter onBack={() => setStep(2)} onNext={() => setStep(4)} nextLabel="Review →" nextDisabled={!step3Valid} />
        )}
        {!submitted && step === 4 && (
          <StepFooter
            onBack={() => setStep(3)}
            onNext={handleSubmit}
            nextLabel="Publish initiative"
            nextDisabled={!step4Valid}
            submitting={submitting}
          />
        )}
      </div>
    </div>
  );
}