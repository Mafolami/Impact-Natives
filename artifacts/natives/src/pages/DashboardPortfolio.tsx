// ─── DashboardInitiatives.tsx (Portfolio) ─────────────────────────────────────
// Two top-level tabs: Initiatives | Partnerships
// Under Initiatives: Created | Interests Expressed | Confirmed
// Under Partnerships: delegates to PartnershipTab component

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { ArrowLeft, ArrowRight, Download, Loader2, Users, UserCheck, Pencil, CheckCircle2, Check, X, LayoutList, Table2 } from "lucide-react";import { Link, useLocation } from "wouter";
import CreateInitiativeModalDashboard from "./CreateInitiativeModalDashboard";
import EditInitiativeModalDashboard from "./EditInitiativeModalDashboard";
import CreateMouModal from "./CreateMouModal";
import MouDocumentDetail from "./MouDocumentDetail";
import { useRoute } from "wouter";
import { PartnershipTab } from "./PartnershipTab";
import { PortfolioTable } from "./PortfolioTable";
import MouTab from "./MouTab";
import { normalizeArr } from "@/lib/normalizeArr";
import { OrgDetailPanel, type OrgRow } from "@/components/dashboard/OrgDetailPanel";
import { useOrgActions } from "@/hooks/useOrgActions";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConfirmedPartner {
  user_id: string;
  name: string;
  role: string;
  profile_link: string;
  confirmed_at: string;
  status?: "pending" | "confirmed" | "declined";
}

interface InitiativeRow {
  id: string;
  title: string;
  sectors: string[];
  locations: string[];
  status: string;
  eois: number;
  created_at: string;
  problem?: string;
  outcome?: string;
  specific_ask?: string | null;
  partnerships?: string[];
  esg_alignment?: boolean | null;
  budget?: string | null;
  tags?: string[];
  detail_content?: string | null;
  resource_link?: string | null;
  submitter_name?: string;
  submitter_org?: string | null;
  confirmed_partners?: ConfirmedPartner[];
  user_id?: string;
  source?: string;
}

interface OutboundEOI {
  eoi_id: string;
  initiative_id: string;
  initiative_title: string;
  partnership_type: string;
  message: string | null;
  created_at: string;
  conversation_status: string | null;
}

interface CreatorConfirmedInitiative {
  initiative_id: string;
  initiative_title: string;
  partners: {
    user_id: string;
    name: string;
    role: string;
    email: string;
    phone: string | null;
    linkedin: string | null;
    confirmed_at: string;
  }[];
}

interface ExpresserConfirmedRow {
  initiative_id: string;
  initiative_title: string;
  creator_user_id: string;
  creator_name: string;
  role: string;
  confirmed_at: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_MAP: Record<string, { label: string; dot: string; bg: string }> = {
  pending:   { label: "Pending review",     dot: "#f59e0b", bg: "rgba(180,83,9,0.12)" },
  published: { label: "Listed",             dot: "#2D6A4F", bg: "rgba(45,106,79,0.12)" },
  rejected:  { label: "Not approved",       dot: "#ef4444", bg: "rgba(239,68,68,0.12)" },
  closed:    { label: "Partner found", dot: "#6b7280", bg: "rgba(107,114,128,0.12)" },
  draft:     { label: "AI draft — needs review", dot: "#C45C26", bg: "rgba(196,92,38,0.08)" },
};

const PARTNERSHIP_OPTIONS = [
  { value: "funding",     label: "Funding" },
  { value: "technical",   label: "Technical" },
  { value: "operational", label: "Operational" },
  { value: "leadership",  label: "Leadership" },
  { value: "strategic",   label: "Strategic" },
  { value: "lead",        label: "Project Lead" },
  { value: "other",       label: "Other" },
];

const STATUS_LABEL_SHORT: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  signed_by_org_a: "Partly signed",
  signed_by_org_b: "Partly signed",
  fully_executed: "Executed",
};

function partnershipLabel(value: string) {
  return PARTNERSHIP_OPTIONS.find(o => o.value === value)?.label ?? value;
}
function rolePartnerPhrase(value: string): string {
  const label = partnershipLabel(value);
  if (/partner$/i.test(label)) return label;
  if (label === "Project Lead") return label;
  return `${label} partner`;
}

function timeAgo(dateStr: string): string {
  const diff  = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30)  return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// ─── Close Initiative Button ──────────────────────────────────────────────────

function CloseInitiativeButton({ initiative, onClosed }: { initiative: InitiativeRow; onClosed: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [closing, setClosing]       = useState(false);

  async function closeInitiative() {
    setClosing(true);
    await supabase.from("initiative_requests").update({ status: "closed" }).eq("id", initiative.id);
    setClosing(false);
    setConfirming(false);
    onClosed();
  }

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)}
        className="w-full rounded-xl border border-border bg-white dark:bg-card px-5 py-3 text-sm text-black dark:text-white hover:text-[#2D6A4F] hover:border-foreground/30 transition-colors text-left">
        Found a partner? <span className="text-foreground font-medium">Close this initiative →</span>
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 px-5 py-4 space-y-3">
      <p className="text-sm text-amber-800 dark:text-amber-300 font-medium">Close this initiative?</p>
      <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
        It will stay visible in the marketplace with a "Partner found" badge. This cannot be undone.
      </p>
      <div className="flex gap-2">
        <button type="button" onClick={() => setConfirming(false)}
          className="flex-1 h-9 rounded-full border border-border text-sm text-muted-foreground hover:text-foreground transition-colors">
          Cancel
        </button>
        <button type="button" onClick={closeInitiative} disabled={closing}
          className="flex-1 h-9 rounded-full bg-[#2D6A4F] hover:bg-[#245c43] text-white text-sm font-medium disabled:opacity-40 transition-colors">
          {closing ? "Closing..." : "Yes, close it"}
        </button>
      </div>
    </div>
  );
}

// ─── Publish RFP Button ───────────────────────────────────────────────────────

function PublishRFPButton({ initiative, onPublished }: { initiative: InitiativeRow; onPublished: () => void }) {
  const [editing, setEditing]         = useState(false);
  const [problem, setProblem]         = useState(initiative.problem ?? "");
  const [outcome, setOutcome]         = useState(initiative.outcome ?? "");
  const [specificAsk, setSpecificAsk] = useState(initiative.specific_ask ?? "");
  const [partnerships, setPartnerships] = useState<string[]>(initiative.partnerships ?? []);
  const [publishing, setPublishing]   = useState(false);

  function toggle(value: string) {
    setPartnerships(prev => prev.includes(value) ? prev.filter(x => x !== value) : [...prev, value]);
  }

  async function publish() {
    setPublishing(true);
    await supabase.from("initiative_requests").update({
      status: "published",
      published_at: new Date().toISOString(),
      problem,
      outcome,
      specific_ask: specificAsk,
      partnerships,
    }).eq("id", initiative.id);
    setPublishing(false);
    setEditing(false);
    onPublished();
  }

  if (!editing) {
    return (
      <button type="button" onClick={() => setEditing(true)}
        className="w-full rounded-xl border border-[#C45C26]/40 bg-[rgba(196,92,38,0.08)] px-5 py-3 text-sm text-left hover:border-[#C45C26]/70 transition-colors">
        <span className="text-foreground font-medium">Review and publish this AI-generated RFP →</span>
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-[#C45C26]/40 bg-[rgba(196,92,38,0.08)] px-5 py-4 space-y-4">
      <p className="text-sm font-medium text-foreground">Review before publishing</p>

      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-black dark:text-white mb-2 block">
          Problem statement
        </label>
        <textarea
          value={problem}
          onChange={e => setProblem(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
        />
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-black dark:text-white mb-2 block">
          Expected outcome
        </label>
        <textarea
          value={outcome}
          onChange={e => setOutcome(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
        />
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-black dark:text-white mb-2 block">
          Specific ask
        </label>
        <textarea
          value={specificAsk}
          onChange={e => setSpecificAsk(e.target.value)}
          rows={2}
          placeholder="What would a partner actually do?"
          className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
        />
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-black dark:text-white mb-2 block">
          Partnership types needed
        </label>
        <div className="flex flex-wrap gap-2">
          {PARTNERSHIP_OPTIONS.map(opt => (
            <button key={opt.value} type="button" onClick={() => toggle(opt.value)}
              className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                partnerships.includes(opt.value)
                  ? "bg-[#2D6A4F] border-[#2D6A4F] text-white"
                  : "border-border text-muted-foreground hover:border-foreground/30"
              }`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={() => setEditing(false)}
          className="flex-1 h-9 rounded-full border border-border text-sm text-muted-foreground hover:text-foreground transition-colors">
          Cancel
        </button>
        <button type="button" onClick={publish} disabled={publishing || !problem.trim() || !outcome.trim() || partnerships.length === 0}
          className="flex-1 h-9 rounded-full bg-[#2D6A4F] hover:bg-[#245c43] text-white text-sm font-medium disabled:opacity-40 transition-colors">
          {publishing ? "Publishing..." : "Publish to marketplace"}
        </button>
      </div>
    </div>
  );
}

// ─── Initiative Detail ────────────────────────────────────────────────────────

function InitiativeDetail({ initiative, onBack, onRequestEdit }: { initiative: InitiativeRow; onBack: () => void; onRequestEdit: (id: string) => void }) {
  const s = STATUS_MAP[initiative.status] ?? { label: initiative.status, dot: "#6b7280", bg: "rgba(107,114,128,0.08)" };
  const [passData, setPassData] = useState<{ count: number; reasons: Record<string, number> } | null>(null);  useEffect(() => {
    supabase.from("funder_decisions").select("decision, reason")
      .eq("initiative_id", initiative.id).eq("decision", "pass")
      .then(({ data }) => {
        if (data && data.length > 0) {
          const reasons: Record<string, number> = {};
          data.forEach((d: any) => { if (d.reason) reasons[d.reason] = (reasons[d.reason] ?? 0) + 1; });
          setPassData({ count: data.length, reasons });
        }
      });
  }, [initiative.id]);

  return (
    <div className="space-y-6">
      <button type="button" onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-[#C45C26] transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to portfolio
      </button>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight">{initiative.title}</h2>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full"
              style={{ background: s.bg, color: s.dot }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot }} />
              {s.label}
            </span>
            <span className="text-xs text-black dark:text-white flex items-center gap-1">
              <Users className="w-3 h-3" />
              {initiative.eois} expression{initiative.eois !== 1 ? "s" : ""} of interest
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          { label: "Sectors",   value: normalizeArr(initiative.sectors).join(", ") || "—" },          
          { label: "Locations", value: initiative.locations?.join(", ") || "—" },
          { label: "Budget",    value: initiative.budget                || "—" },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-border bg-white dark:bg-card px-4 py-3">
            <p className="text-xs text-black dark:text-white mb-0.5">{label}</p>
            <p className="text-sm font-medium text-foreground">{value}</p>
          </div>
        ))}
      </div>

      {passData && passData.count > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 px-4 py-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
            Funder feedback — {passData.count} funder{passData.count !== 1 ? "s" : ""} passed
          </p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(passData.reasons).sort((a, b) => b[1] - a[1]).map(([reason, count]) => (
              <span key={reason} className="text-xs px-2.5 py-1 rounded-full border border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-400">
                {reason} ({count})
              </span>
            ))}
          </div>
          <p className="text-xs text-amber-600 dark:text-amber-500">
            Use this to strengthen your brief before your next outreach.
          </p>
        </div>
      )}

      {(initiative.problem || initiative.outcome) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {initiative.problem && (
            <div className="rounded-xl border border-border bg-white dark:bg-card px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-black dark:text-white mb-2">Problem</p>
              <p className="text-[15px] text-foreground leading-relaxed">{initiative.problem}</p>
            </div>
          )}
          {initiative.outcome && (
            <div className="rounded-xl border border-border bg-white dark:bg-card px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-black dark:text-white mb-2">Outcome</p>
              <p className="text-[15px] text-foreground leading-relaxed">{initiative.outcome}</p>
            </div>
          )}
        </div>
      )}

      {initiative.tags && initiative.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {initiative.tags.map(t => (
            <span key={t} className="px-3 py-1 rounded-full text-xs font-medium"
              style={{ background: "rgba(196,92,38,0.12)", color: "#C45C26" }}>{t}</span>
          ))}
        </div>
      )}

      {initiative.detail_content && initiative.detail_content !== "<p></p>" && (
        <div className="rounded-xl border border-border bg-white dark:bg-card px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-black dark:text-white mb-3">Full description</p>
          <div className="prose prose-sm dark:prose-invert max-w-none text-foreground"
            dangerouslySetInnerHTML={{ __html: initiative.detail_content }} />
        </div>
      )}

      {initiative.confirmed_partners && initiative.confirmed_partners.filter(p => (p.status ?? "confirmed") === "confirmed").length > 0 && (
        <div className="rounded-xl border border-[#2D6A4F]/30 bg-[rgba(45,106,79,0.12)] px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#2D6A4F] mb-3">Confirmed Partners</p>
          <div className="flex flex-col gap-2">
            {initiative.confirmed_partners.filter(p => (p.status ?? "confirmed") === "confirmed").map(p => (
              <div key={p.user_id} className="flex items-center justify-between gap-3">
                <a href={p.profile_link} className="text-sm font-medium text-foreground hover:text-[#2D6A4F] transition-colors">{p.name}</a>
                <span className="text-xs px-2.5 py-0.5 rounded-full capitalize" style={{ background: "rgba(6,95,70,0.12)", color: "#065f46" }}>{p.role}</span>
              </div>
            ))}
          </div>
        </div>
      )}

{initiative.status !== "closed" && (
        <button type="button" onClick={() => onRequestEdit(initiative.id)}
          className="w-full rounded-xl border border-border bg-white dark:bg-card px-5 py-3 text-sm text-black dark:text-white hover:text-[#2D6A4F] hover:border-foreground/30 transition-colors text-left">
          Need to update something? <span className="text-foreground font-medium">Edit this initiative →</span>
        </button>
      )}

      {initiative.status === "published" && (
        <CloseInitiativeButton initiative={initiative} onClosed={onBack} />
      )}

      {initiative.status === "draft" && initiative.source === "ai_generated" && (
        <PublishRFPButton initiative={initiative} onPublished={onBack} />
      )}

      {initiative.status === "pending" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 px-5 py-4">
          <p className="text-sm text-amber-800 dark:text-amber-300 leading-relaxed">
            Your request is under review. It will be listed in the Marketplace once approved.
          </p>
        </div>
      )}
      {initiative.status === "rejected" && (
        <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 px-5 py-4">
          <p className="text-sm text-red-800 dark:text-red-300 leading-relaxed">
            This initiative was not approved. Reach out to the team for feedback.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Interests Expressed Tab ──────────────────────────────────────────────────

function InterestsExpressedTab({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(true);
  const [eois, setEois]       = useState<OutboundEOI[]>([]);

  useEffect(() => {
    async function load() {
      const { data: sentEois } = await supabase
        .from("expressions_of_interest")
        .select("id, initiative_id, partnership_type, message, created_at, conversation_id")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (!sentEois || sentEois.length === 0) { setLoading(false); return; }

      const convoIds = sentEois.map((e: any) => e.conversation_id).filter(Boolean);
      const initIds  = [...new Set(sentEois.map((e: any) => e.initiative_id))];

      const [convoRes, initRes] = await Promise.all([
        convoIds.length > 0
          ? supabase.from("conversations").select("id, status").in("id", convoIds)
          : Promise.resolve({ data: [] }),
        supabase.from("initiative_requests").select("id, title").in("id", initIds),
      ]);

      const convoMap = new Map((convoRes.data ?? []).map((c: any) => [c.id, c.status]));
      const initMap  = new Map((initRes.data ?? []).map((i: any) => [i.id, i.title]));

      setEois(sentEois.map((e: any) => ({
        eoi_id:             e.id,
        initiative_id:      e.initiative_id,
        initiative_title:   initMap.get(e.initiative_id) ?? "Initiative",
        partnership_type:   e.partnership_type,
        message:            e.message,
        created_at:         e.created_at,
        conversation_status: e.conversation_id ? (convoMap.get(e.conversation_id) ?? null) : null,
      })));
      setLoading(false);
    }
    load();
  }, [userId]);

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-5 h-5 text-[#2D6A4F] animate-spin" />
    </div>
  );

  if (eois.length === 0) return (
    <div className="rounded-2xl border border-border bg-white dark:bg-card p-12 text-center">
      <UserCheck className="w-8 h-8 text-muted-foreground/40 mx-auto mb-4" />
      <p className="text-foreground font-medium mb-2">No interests expressed yet.</p>
      <p className="text-sm text-black dark:text-white max-w-sm mx-auto">
        When you express interest in initiatives on the Marketplace, they appear here.
      </p>
    </div>
  );

  return (
    <div className="space-y-3">
      {eois.map(eoi => {
        const status = eoi.conversation_status;
        const statusConfig = status === "confirmed"
          ? { label: "Partner confirmed", bg: "rgba(45,106,79,0.12)", color: "#2D6A4F" }
          : status === "open"
          ? { label: "In conversation", bg: "rgba(45,106,79,0.12)", color: "#2D6A4F" }
          : (status === "declined" || status === "rejected")
          ? { label: "Declined", bg: "rgba(239,68,68,0.12)", color: "#ef4444" }
          : { label: "Pending",  bg: "rgba(180,83,9,0.12)", color: "#f59e0b" };
        return (
          <div key={eoi.eoi_id} className="rounded-xl border border-border bg-white dark:bg-card px-5 py-4 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Link href={`/dashboard/marketplace?initiative=${eoi.initiative_id}`}
                  className="text-sm font-medium text-foreground hover:text-[#2D6A4F] transition-colors hover:underline underline-offset-2">
                  {eoi.initiative_title}
                </Link>
              </div>
              <span className="text-xs text-black dark:text-white shrink-0">{timeAgo(eoi.created_at)}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                style={{ background: "rgba(196,92,38,0.12)", color: "#C45C26" }}>
                {rolePartnerPhrase(eoi.partnership_type)}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                style={{ background: statusConfig.bg, color: statusConfig.color }}>
                {statusConfig.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Confirmed Partners Tab (unchanged logic) ─────────────────────────────────

function ConfirmedPartnersTab({ userId }: { userId: string }) {
  const [loading, setLoading]                       = useState(true);
  const [creatorConfirmed, setCreatorConfirmed]     = useState<CreatorConfirmedInitiative[]>([]);
  const [expresserConfirmed, setExpresserConfirmed] = useState<ExpresserConfirmedRow[]>([]);
  useEffect(() => { loadPartners(); }, [userId]);

  async function loadPartners() {
    setLoading(true);
    const { data: allInits } = await supabase
      .from("initiative_requests")
      .select("id, title, confirmed_partners, user_id")
      .not("confirmed_partners", "is", null);

    if (!allInits) { setLoading(false); return; }

    const myInitsWithConfirmed = allInits
      .filter((init: any) => init.user_id === userId && Array.isArray(init.confirmed_partners))
      .map((init: any) => ({
        ...init,
        confirmed_partners: (init.confirmed_partners as any[]).filter((p: any) => (p.status ?? "confirmed") === "confirmed"),
      }))
      .filter((init: any) => init.confirmed_partners.length > 0);
    if (myInitsWithConfirmed.length > 0) {
      const allPartnerUserIds = [...new Set(myInitsWithConfirmed.flatMap((i: any) => (i.confirmed_partners as any[]).map((p: any) => p.user_id)))];
      const { data: partnerProfiles } = await supabase.from("profiles").select("id, full_name, email, phone, linkedin_url").in("id", allPartnerUserIds);
      const profileMap = new Map((partnerProfiles ?? []).map((p: any) => [p.id, p]));
      setCreatorConfirmed(myInitsWithConfirmed.map((init: any) => ({
        initiative_id:    init.id,
        initiative_title: init.title,
        partners: (init.confirmed_partners as any[]).map((p: any) => {
          const profile = profileMap.get(p.user_id);
          return { user_id: p.user_id, name: p.name ?? profile?.full_name ?? "Unknown", role: p.role, email: profile?.email ?? "", phone: profile?.phone ?? null, linkedin: profile?.linkedin_url ?? null, confirmed_at: p.confirmed_at };
        }),
      })));
    } else {
      setCreatorConfirmed([]);
    }

    const relevant = allInits.filter((init: any) => {
      if (init.user_id === userId) return false;
      return ((init.confirmed_partners as any[]) ?? []).some((p: any) => p.user_id === userId && (p.status ?? "confirmed") === "confirmed");
    });
    if (relevant.length > 0) {
      const ownerIds = [...new Set(relevant.map((i: any) => i.user_id).filter(Boolean))];
      const { data: ownerProfiles } = await supabase.from("profiles").select("id, full_name").in("id", ownerIds);
      const ownerMap = new Map((ownerProfiles ?? []).map((p: any) => [p.id, p]));
      setExpresserConfirmed(relevant.map((init: any) => {
        const partners = (init.confirmed_partners as any[]) ?? [];
        const myEntry  = partners.find((p: any) => p.user_id === userId && (p.status ?? "confirmed") === "confirmed");
        const owner    = ownerMap.get(init.user_id);
        return { initiative_id: init.id, initiative_title: init.title, creator_user_id: init.user_id, creator_name: owner?.full_name ?? "Unknown", role: myEntry?.role ?? "", confirmed_at: myEntry?.confirmed_at ?? "" };
      }));
    } else {
      setExpresserConfirmed([]);
    }

    setLoading(false);
  }

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-5 h-5 text-[#2D6A4F] animate-spin" />
    </div>
  );

  if (creatorConfirmed.length === 0 && expresserConfirmed.length === 0) return (
    <div className="rounded-2xl border border-border bg-white dark:bg-card p-12 text-center">
      <Users className="w-8 h-8 text-muted-foreground/40 mx-auto mb-4" />
      <p className="text-foreground font-medium mb-2">No confirmed partnerships yet.</p>
      <p className="text-sm text-black dark:text-white max-w-sm mx-auto">
        Partnerships appear here once an initiative creator confirms a partner from a conversation.
      </p>
    </div>
  );

  return (
    <div className="space-y-6">
      {creatorConfirmed.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-black dark:text-white">Partners on your initiatives</p>
          <div className="rounded-xl border border-border bg-white dark:bg-card overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-foreground">Confirmed partners</p>
              <button type="button" onClick={() => {
                const rows = [["Initiative","Name","Role","Email","Phone","LinkedIn","Confirmed"],...creatorConfirmed.flatMap(card => card.partners.map(p => [card.initiative_title,p.name,partnershipLabel(p.role),p.email,p.phone??"",p.linkedin??"",new Date(p.confirmed_at).toLocaleDateString("en-GB")]))];
                const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
                const blob = new Blob([csv],{type:"text/csv"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="confirmed_partners.csv";a.click();URL.revokeObjectURL(url);
              }} className="shrink-0 flex items-center gap-1.5 text-xs text-black dark:text-white hover:text-[#2D6A4F] border border-border rounded-full px-3 py-1.5 transition-colors">
                <Download className="w-3 h-3" /> Export
              </button>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {["Name","Initiative","Role","Contact","Confirmed",""].map(h => (
                    <th key={h} className="text-left px-5 py-2.5 text-xs font-semibold text-black dark:text-white">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {creatorConfirmed.flatMap(card => card.partners.map(p => (
                  <tr key={`${card.initiative_id}-${p.user_id}`}>
                    <td className="px-5 py-3">
                      <Link href={`/dashboard/natives?user=${p.user_id}`} className="text-sm font-medium text-foreground hover:text-[#2D6A4F] transition-colors hover:underline underline-offset-2">{p.name}</Link>
                    </td>
                    <td className="px-5 py-3 text-xs text-black dark:text-white">{card.initiative_title}</td>
                    <td className="px-5 py-3">
                      <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{background:"rgba(45,106,79,0.12)",color:"#2D6A4F"}}>{partnershipLabel(p.role)}</span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-3">
                        {p.email && <a href={`mailto:${p.email}`} className="text-xs text-[#2D6A4F] hover:underline underline-offset-2">{p.email}</a>}
                        {p.phone && <a href={`tel:${p.phone}`} className="text-xs text-black dark:text-white hover:text-[#2D6A4F] transition-colors">{p.phone}</a>}
                        {p.linkedin && <a href={p.linkedin} target="_blank" rel="noopener noreferrer" className="text-xs text-black dark:text-white hover:text-[#2D6A4F] transition-colors">LinkedIn ↗</a>}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-xs text-black dark:text-white whitespace-nowrap">{timeAgo(p.confirmed_at)}</td>
                    <td className="px-5 py-3">
                      <Link href={`/dashboard/portfolio?tab=mou&newForUserId=${p.user_id}&partnerName=${encodeURIComponent(p.name)}&initiativeId=${card.initiative_id}&initiativeTitle=${encodeURIComponent(card.initiative_title)}`}
                        className="text-sm text-black dark:text-white hover:underline underline-offset-2 whitespace-nowrap">
                        MoU
                      </Link>
                    </td>
                  </tr>
                )))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {expresserConfirmed.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-black dark:text-white">Initiatives you've been confirmed on</p>
          <div className="rounded-xl border border-border bg-white dark:bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {["Creator","Initiative","Your role",""].map(h => (
                    <th key={h} className="text-left px-5 py-2.5 text-xs font-semibold text-black dark:text-white">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {expresserConfirmed.map(row => (
                  <tr key={`${row.initiative_id}-${row.creator_user_id}`}>
                    <td className="px-5 py-3">
                      <Link href={`/dashboard/natives?user=${row.creator_user_id}`} className="text-sm font-medium text-foreground hover:text-[#2D6A4F] transition-colors hover:underline underline-offset-2">{row.creator_name}</Link>
                    </td>
                    <td className="px-5 py-3">
                      <Link href={`/dashboard/marketplace?initiative=${row.initiative_id}`} className="text-sm text-foreground hover:text-[#2D6A4F] transition-colors hover:underline underline-offset-2">{row.initiative_title}</Link>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{background:"rgba(45,106,79,0.12)",color:"#2D6A4F"}}>{partnershipLabel(row.role)}</span>
                    </td>
                    <td className="px-5 py-3">
                      <Link href={`/dashboard/portfolio?tab=mou&newForUserId=${row.creator_user_id}&partnerName=${encodeURIComponent(row.creator_name)}&initiativeId=${row.initiative_id}&initiativeTitle=${encodeURIComponent(row.initiative_title)}`}
                        className="text-sm text-black dark:text-white hover:underline underline-offset-2 whitespace-nowrap">
                        MoU
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function DashboardInitiatives() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [initiatives, setInitiatives] = useState<InitiativeRow[]>([]);
  const [loading, setLoading]         = useState(true);
  const [showModal, setShowModal]     = useState(false);
  const [selected, setSelected]       = useState<InitiativeRow | null>(null);

  // Top-level tabs
  const [topTab, setTopTab] = useState<"initiatives" | "partnerships" | "mou">("initiatives");
  // Initiative sub-tabs
  const [initSubTab, setInitSubTab] = useState<"created" | "expressed" | "confirmed">("created");
  // Tabs vs unified spreadsheet-table view. Uses "mode" as the query param
  // name specifically to avoid colliding with PartnershipTab's own "view"
  // param (?view=requested/inbound/outbound/confirmed).
  const [viewMode, setViewMode] = useState<"tabs" | "table">("table");

  const [, params] = useRoute("/dashboard/portfolio/:id");
  const routeId = params?.id;

  const [, partnerParams] = useRoute("/dashboard/portfolio/partner/:orgId");
  const partnerOrgId = partnerParams?.orgId;
  const [selectedPartnerOrg, setSelectedPartnerOrg] = useState<OrgRow | null>(null);
  const { viewerOrg, savedOrgs, sentInterests, sendingInterest, toggleSave, expressInterest } = useOrgActions(user?.id);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [closeSavingId, setCloseSavingId] = useState<string | null>(null);

  async function closeFromCard(id: string) {
    setCloseSavingId(id);
    await supabase.from("initiative_requests").update({ status: "closed" }).eq("id", id);
    setCloseSavingId(null);
    setClosingId(null);
    load();
  }

  // Navigates to your own partnership listing. Deliberately does NOT rely
  // Handle deep links
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("tab") === "partners") { setTopTab("initiatives"); setInitSubTab("confirmed"); setViewMode("tabs"); }
    if (p.get("tab") === "expressed") { setTopTab("initiatives"); setInitSubTab("expressed"); setViewMode("tabs"); }
    if (p.get("tab") === "partnerships") { setTopTab("partnerships"); setViewMode("tabs"); }
    if (p.get("tab") === "mou") { setTopTab("mou"); setViewMode("tabs"); }
    if (p.get("mode") === "table") setViewMode("table");
  }, []);

  async function load() {
    if (!user) return;
    const { data, error } = await supabase
        .from("initiative_requests")
        .select("id,title,sectors,locations,status,eois,created_at,problem,outcome,partnerships,esg_alignment,budget,tags,detail_content,resource_link,submitter_name,submitter_org,confirmed_partners,user_id,source")
        .eq("user_id", user.id)
        .not("status", "eq", "draft")
        .order("created_at", { ascending: false });
    if (data) setInitiatives(data as InitiativeRow[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, [user]);

  useEffect(() => {
    if (!routeId || initiatives.length === 0) return;
    const match = initiatives.find(i => i.id === routeId);
    if (match) setSelected(match);
  }, [routeId, initiatives]);

  useEffect(() => {
    if (!partnerOrgId) { setSelectedPartnerOrg(null); return; }
    supabase.from("organizations")
      .select("id,organisation_name,description,sector,country,organisation_type,website,email,needs,offers,sdgs,partnership_sought,partnership_title,verification_status,status,user_id,partnership_listed,partnership_formed,partnership_stage,partnership_duration,partnership_budget,partnership_decision_timeline,partnership_success_definition,partnership_funding_status,partnership_exclusivity,partnership_working_style,partnership_financial_transfer,partnership_reporting,partnership_ip_ownership,partnership_legal_type,partnership_team_capacity,partnership_contact_seniority,partnership_geo_specificity,partnership_theory_of_change,partnership_prior_attempts,partnership_constraints,partnership_dd_financial_model,partnership_dd_audited_accounts,partnership_dd_safeguarding_policy,partnership_dd_data_policy,partnership_dd_governance_doc,partnership_prior_experience,partnership_prior_experience_detail,partnership_physically_present")
      .eq("id", partnerOrgId)
      .maybeSingle()
      .then(({ data }) => { if (data) setSelectedPartnerOrg(data as OrgRow); });
  }, [partnerOrgId]);

  if (selectedPartnerOrg) {
    return (
      <OrgDetailPanel
        org={selectedPartnerOrg}
        isSaved={savedOrgs.has(selectedPartnerOrg.id)}
        onToggleSave={e => toggleSave(selectedPartnerOrg.id, e)}
        isOrg={!!user}
        alreadySent={sentInterests.has(selectedPartnerOrg.id)}
        sending={sendingInterest === selectedPartnerOrg.id}
        onExpressInterest={e => expressInterest(selectedPartnerOrg, e)}
        onBack={() => navigate("/dashboard/portfolio")}
        backLabel="Back to portfolio"
        viewerOrg={viewerOrg}
        variant="page"
      />
    );
  }

  if (selected) {
    return (
      <>
        <InitiativeDetail initiative={selected} onBack={() => setSelected(null)} onRequestEdit={id => setEditingId(id)} />
        <EditInitiativeModalDashboard
          isOpen={!!editingId}
          initiativeId={editingId}
          onClose={() => setEditingId(null)}
          onSaved={() => { setEditingId(null); setSelected(null); load(); }}
        />
      </>
    );
  }

  const initSubTabs = [
    { value: "created"   as const, label: "Created" },
    { value: "expressed" as const, label: "Interests Expressed" },
    { value: "confirmed" as const, label: "Confirmed" },
  ];

  return (
    <>
      <div className="space-y-8">
        {/* Page header */}
        <div className="flex items-center justify-end gap-4 pb-2">
          <div className="flex items-center gap-2 shrink-0">
            {/* Table / Tabs view toggle */}
            <div className="flex gap-1 p-1 rounded-xl bg-muted">
              <button type="button" onClick={() => setViewMode("table")} title="Table view"
                className={`h-9 px-3 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 ${
                  viewMode === "table"
                    ? "bg-white dark:bg-card text-black dark:text-white shadow-sm"
                    : "text-black dark:text-white hover:text-[#2D6A4F]"
                }`}>
                <Table2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Table</span>
              </button>
              <button type="button" onClick={() => setViewMode("tabs")} title="Tabs view"
                className={`h-9 px-3 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 ${
                  viewMode === "tabs"
                    ? "bg-white dark:bg-card text-black dark:text-white shadow-sm"
                    : "text-black dark:text-white hover:text-[#2D6A4F]"
                }`}>
                <LayoutList className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Tabs</span>
              </button>
            </div>
            </div>
        </div>

        {viewMode === "table" ? (
           <PortfolioTable />
        ) : (
          <>
        {/* Top-level tabs — segmented control */}
        <div className="flex gap-1 p-1 rounded-xl bg-muted w-fit">
          {[
            { key: "initiatives"  as const, label: "Initiatives" },
            { key: "partnerships" as const, label: "Partnerships" },
            { key: "mou"          as const, label: "MoU" },
          ].map(({ key, label }) => (
            <button key={key} type="button" onClick={() => setTopTab(key)}
              className={`h-9 px-6 rounded-lg text-sm font-semibold transition-all ${
                topTab === key
                  ? "bg-white dark:bg-card text-black dark:text-white shadow-sm"
                  : "text-black dark:text-white hover:text-[#2D6A4F]"
              }`}>
              {label}
            </button>
          ))}
        </div>
        {/* ── Initiatives tab ── */}
        {topTab === "initiatives" && (
          <div className="space-y-8">
            {/* Initiative sub-tabs — pill style, visually distinct from top tabs */}
            <div className="flex gap-1.5 p-1 rounded-xl bg-muted w-fit">
              {initSubTabs.map(({ value, label}) => (
                <button key={value} type="button" onClick={() => setInitSubTab(value)}
                  className={`h-8 px-4 rounded-lg text-xs font-semibold transition-all ${
                    initSubTab === value
                      ? "bg-white dark:bg-card text-black dark:text-white shadow-sm"
                      : "text-black dark:text-white hover:text-[#2D6A4F]"
                  }`}>
                    {label}
                </button>
              ))}
            </div>

            {/* Created */}
            {initSubTab === "created" && (
              <>
                {loading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-5 h-5 text-[#2D6A4F] animate-spin" />
                  </div>
                ) : initiatives.length === 0 ? (
                  <div className="rounded-2xl border border-border bg-white dark:bg-card p-12 text-center">
                    <p className="text-foreground font-medium mb-2">No initiatives yet.</p>
                    <p className="text-sm text-black dark:text-white mb-6 max-w-sm mx-auto">
                      Create an initiative and let funders, partners, and implementers discover it.
                    </p>
                    <button type="button" onClick={() => setShowModal(true)}
                      className="rounded-full h-9 px-5 bg-[#2D6A4F] hover:bg-[#245c43] text-white text-sm font-medium transition-colors">
                      + New Initiative
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {initiatives.map(ini => {
                      const s = STATUS_MAP[ini.status] ?? { label: ini.status, dot: "#6b7280", bg: "rgba(107,114,128,0.08)" };
                      const isConfirmingClose = closingId === ini.id;
                      return (
                        <div key={ini.id}
                          className="w-full rounded-2xl border border-border bg-white dark:bg-card px-6 py-5 hover:border-[#2D6A4F]/40 hover:shadow-md transition-all duration-200 group">
                          <button type="button" onClick={() => setSelected(ini)} className="w-full text-left">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0 space-y-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-0.5 rounded-full"
                                    style={{ background: s.bg, color: s.dot }}>
                                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: s.dot }} />
                                    {s.label}
                                  </span>
                                  <span className="text-xs text-black dark:text-white">
                                    {ini.eois} EOI{ini.eois !== 1 ? "s" : ""}
                                  </span>
                                </div>
                                <p className="font-semibold text-foreground group-hover:text-[#2D6A4F] transition-colors leading-snug">
                                  {ini.title}
                                </p>
                                <p className="text-[13px] text-black dark:text-white">
                                  {normalizeArr(ini.sectors).slice(0, 2).join(", ")}
                                  {normalizeArr(ini.locations).length > 0 && (
                                    <> · {normalizeArr(ini.locations).slice(0, 2).join(", ")}</>
                                  )}
                                </p>
                              </div>
                              <div className="flex items-center gap-1 shrink-0 mt-1" onClick={e => e.stopPropagation()}>
                                {isConfirmingClose ? (
                                  <>
                                    <button type="button" title="Confirm: close this initiative"
                                      disabled={closeSavingId === ini.id}
                                      onClick={() => closeFromCard(ini.id)}
                                      className="p-1.5 rounded-full hover:bg-[rgba(45,106,79,0.12)] text-[#2D6A4F] transition-colors disabled:opacity-40">
                                      {closeSavingId === ini.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                    </button>
                                    <button type="button" title="Cancel"
                                      onClick={() => setClosingId(null)}
                                      className="p-1.5 rounded-full hover:bg-muted text-muted-foreground transition-colors">
                                      <X className="w-4 h-4" />
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    {ini.status !== "closed" && (
                                      <button type="button" title="Edit initiative"
                                        onClick={() => setEditingId(ini.id)}
                                        className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                                        <Pencil className="w-4 h-4" />
                                      </button>
                                    )}
                                    {ini.status === "published" && (
                                      <button type="button" title="Close initiative — found a partner"
                                        onClick={() => setClosingId(ini.id)}
                                        className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                                        <CheckCircle2 className="w-4 h-4" />
                                      </button>
                                    )}
                                    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-[#2D6A4F] transition-colors ml-1" />
                                  </>
                                )}
                              </div>
                            </div>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* Interests Expressed */}
            {initSubTab === "expressed" && user && (
              <InterestsExpressedTab userId={user.id} />
            )}

            {/* Confirmed */}
            {initSubTab === "confirmed" && user && (
              <ConfirmedPartnersTab userId={user.id} />
            )}
          </div>
        )}

        {/* ── Partnerships tab ── */}
        {topTab === "partnerships" && (
          <PartnershipTab />
        )}

        {/* ── MoU tab ── */}
        {topTab === "mou" && user && (
          <MouTab userId={user.id} />
        )}
          </>
        )}
      </div>

      <CreateInitiativeModalDashboard
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={() => { load(); }}
      />
      <EditInitiativeModalDashboard
        isOpen={!!editingId}
        initiativeId={editingId}
        onClose={() => setEditingId(null)}
        onSaved={() => { setEditingId(null); load(); }}
      />
    </>
  );
}