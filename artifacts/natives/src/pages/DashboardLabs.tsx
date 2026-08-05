// ─── DashboardLabs.tsx ────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { ArrowLeft, FlaskConical, Loader2 } from "lucide-react";
import { LabRequestModalDashboard } from "./LabRequestModalDashboard";

interface LabRow {
  id: string;
  organisation_name: string;
  organisation_type: string;
  contact_name: string;
  email: string;
  problem: string;
  why_it_matters: string;
  sector: string;
  geography: string;
  desired_participants: string[];
  expected_outcomes: string[];
  idea_stages: string[];
  budget_range: string;
  budget_tier: string;
  status: string;
  created_at: string;
}

const STATUS_MAP: Record<string, { label: string; dot: string; bg: string; description: string }> = {
  proposal_review: {
    label: "Under review",
    dot: "#f59e0b",
    bg: "#fffbeb",
    description: "Your lab proposal has been received. The Impact Natives team will review it and reach out within 5 business days.",
  },
  approved: {
    label: "Approved",
    dot: "#2D6A4F",
    bg: "#eaf5ee",
    description: "Your lab has been approved. The team will be in touch to begin scoping and coordination.",
  },
  rejected: {
    label: "Not approved",
    dot: "#ef4444",
    bg: "#fef2f2",
    description: "Your proposal was not taken forward at this time. Reach out to hello@impactnatives.com for feedback.",
  },
  in_progress: {
    label: "In progress",
    dot: "#3b82f6",
    bg: "#eff6ff",
    description: "Your lab is actively being coordinated. The team will keep you updated on progress.",
  },
  completed: {
    label: "Completed",
    dot: "#6b7280",
    bg: "#f3f4f6",
    description: "This lab has been completed.",
  },
};

const STATUS_STEPS = ["proposal_review", "approved", "in_progress", "completed"];

function timeAgo(dateStr: string): string {
  const diff  = Date.now() - new Date(dateStr).getTime();
  const days  = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30)  return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// ─── Detail View ──────────────────────────────────────────────────────────────
function LabDetail({ lab, onBack }: { lab: LabRow; onBack: () => void }) {
  const s = STATUS_MAP[lab.status] ?? { label: lab.status, dot: "#6b7280", bg: "#f3f4f6", description: "" };
  const currentStepIndex = STATUS_STEPS.indexOf(lab.status);

  return (
    <div className="space-y-6">
      <button type="button" onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Labs
      </button>

      {/* Status banner */}
      <div className="rounded-xl px-5 py-4 space-y-1" style={{ background: s.bg }}>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.dot }} />
          <p className="text-sm font-semibold" style={{ color: s.dot }}>{s.label}</p>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{s.description}</p>
      </div>

      {/* Progress tracker — only for non-rejected */}
      {lab.status !== "rejected" && (
        <div className="rounded-xl border border-border bg-card px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Progress</p>
          <div className="flex items-center gap-0">
            {STATUS_STEPS.map((step, i) => {
              const stepS = STATUS_MAP[step];
              const isDone    = i < currentStepIndex;
              const isCurrent = i === currentStepIndex;
              return (
                <div key={step} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center gap-1.5">
                    <div className={`w-3 h-3 rounded-full border-2 transition-colors ${
                      isDone    ? "bg-[#2D6A4F] border-[#2D6A4F]" :
                      isCurrent ? "bg-white border-[#2D6A4F]" :
                                  "bg-white border-border"
                    }`} />
                    <p className={`text-[10px] font-medium text-center w-16 leading-tight ${
                      isCurrent ? "text-[#2D6A4F]" : isDone ? "text-muted-foreground" : "text-muted-foreground/50"
                    }`}>
                      {stepS.label}
                    </p>
                  </div>
                  {i < STATUS_STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 mb-5 mx-1 ${i < currentStepIndex ? "bg-[#2D6A4F]" : "bg-border"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Submission details */}
      <div className="rounded-xl border border-border bg-card divide-y divide-border">
        <div className="px-5 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Submission details</p>
        </div>

        {[
          { label: "Problem",          value: lab.problem },
          { label: "Why it matters",   value: lab.why_it_matters },
          { label: "Geography",        value: lab.geography },
          { label: "Sector",           value: lab.sector },
          { label: "Budget",           value: [lab.budget_tier, lab.budget_range].filter(Boolean).join(" — ") },
        ].filter(r => r.value).map(({ label, value }) => (
          <div key={label} className="px-5 py-3">
            <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
            <p className="text-sm text-foreground leading-relaxed capitalize">{value}</p>
          </div>
        ))}

        {lab.desired_participants?.length > 0 && (
          <div className="px-5 py-3">
            <p className="text-xs text-muted-foreground mb-2">Who should be in the room</p>
            <div className="flex flex-wrap gap-1.5">
              {lab.desired_participants.map((p) => (
                <span key={p} className="text-xs px-2.5 py-1 rounded-full border border-border text-foreground">{p}</span>
              ))}
            </div>
          </div>
        )}

        {lab.expected_outcomes?.length > 0 && (
          <div className="px-5 py-3">
            <p className="text-xs text-muted-foreground mb-2">Expected outcomes</p>
            <div className="flex flex-wrap gap-1.5">
              {lab.expected_outcomes.map((o) => (
                <span key={o} className="text-xs px-2.5 py-1 rounded-full border border-border text-foreground">{o}</span>
              ))}
            </div>
          </div>
        )}

        {lab.idea_stages?.length > 0 && (
          <div className="px-5 py-3">
            <p className="text-xs text-muted-foreground mb-2">Idea stage</p>
            <div className="flex flex-wrap gap-1.5">
              {lab.idea_stages.map((s) => (
                <span key={s} className="text-xs px-2.5 py-1 rounded-full border border-border text-foreground">{s}</span>
              ))}
            </div>
          </div>
        )}

        <div className="px-5 py-3">
          <p className="text-xs text-muted-foreground mb-0.5">Submitted</p>
          <p className="text-sm text-foreground">{new Date(lab.created_at).toLocaleDateString("en-GB", {
            day: "numeric", month: "long", year: "numeric"
          })}</p>
        </div>
      </div>

      {/* Contact */}
      <div className="rounded-xl border border-border bg-muted/20 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Submitted by</p>
        <p className="text-sm font-medium text-foreground">{lab.contact_name || "—"}</p>
        {lab.organisation_name && <p className="text-xs text-muted-foreground">{lab.organisation_name}</p>}
        <p className="text-xs text-muted-foreground">{lab.email}</p>
      </div>

      {/* Help */}
      <p className="text-xs text-muted-foreground text-center">
        Questions? Reach out at{" "}
        <a href="mailto:hello@impactnatives.com" className="text-[#2D6A4F] hover:underline underline-offset-2">
          hello@impactnatives.com
        </a>
      </p>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function DashboardLabs() {
  const { user } = useAuth();
  const [labs, setLabs]         = useState<LabRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected] = useState<LabRow | null>(null);

  async function load() {
    if (!user) return;
    const { data } = await supabase
      .from("lab_requests")
      .select("id, organisation_name, organisation_type, contact_name, email, problem, why_it_matters, sector, geography, desired_participants, expected_outcomes, idea_stages, budget_range, budget_tier, status, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (data) setLabs(data as LabRow[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, [user]);

  if (selected) {
    return <LabDetail lab={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-end">
          <button type="button" onClick={() => setShowModal(true)}
            className="rounded-full h-9 px-5 bg-[#2D6A4F] hover:bg-[#245c43] text-white text-sm font-medium transition-colors">
            + Commission a Lab
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-5 h-5 text-[#2D6A4F] animate-spin" />
          </div>
        ) : labs.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-12 text-center">
            <FlaskConical className="w-8 h-8 text-muted-foreground/40 mx-auto mb-4" />
            <p className="text-foreground font-medium mb-2">No Labs yet.</p>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
              Commission a Lab to bring together experts, organisations, and resources around a specific challenge.
            </p>
            <button type="button" onClick={() => setShowModal(true)}
              className="rounded-full h-9 px-5 bg-[#2D6A4F] hover:bg-[#245c43] text-white text-sm font-medium transition-colors">
              Commission a Lab
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {labs.map((lab) => {
              const s = STATUS_MAP[lab.status] ?? { label: lab.status, dot: "#6b7280", bg: "#f3f4f6" };
              return (
                <button key={lab.id} type="button" onClick={() => setSelected(lab)}
                  className="w-full text-left rounded-xl border border-border bg-card px-5 py-4 hover:border-[#2D6A4F]/30 transition-colors group">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: s.dot }} />
                        <span className="text-xs text-muted-foreground">{s.label}</span>
                        {lab.budget_range && (
                          <>
                            <span className="text-xs text-muted-foreground">·</span>
                            <span className="text-xs text-muted-foreground">{lab.budget_range}</span>
                          </>
                        )}
                      </div>
                      <p className="font-medium text-foreground group-hover:text-[#2D6A4F] transition-colors truncate">
                        {lab.problem ? lab.problem.slice(0, 80) + (lab.problem.length > 80 ? "..." : "") : "Lab request"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 capitalize">
                        {lab.sector} · {lab.geography}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0 mt-1">{timeAgo(lab.created_at)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <LabRequestModalDashboard
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={() => { setShowModal(false); load(); }}
      />
    </>
  );
}