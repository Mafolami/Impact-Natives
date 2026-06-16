// ─── DashboardInitiatives.tsx ─────────────────────────────────────────────────
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { ArrowLeft, ArrowRight, Download, Loader2, Users } from "lucide-react";
import { Link, useLocation } from "wouter";
import CreateInitiativeModalDashboard from "./CreateInitiativeModalDashboard";
import { useRoute } from "wouter";

interface ConfirmedPartner {
  user_id: string;
  name: string;
  role: string;
  profile_link: string;
  confirmed_at: string;
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
}

// Creator view: one card per initiative, multiple partners
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

// Expresser view: one row per confirmation
interface ExpresserConfirmedRow {
  initiative_id: string;
  initiative_title: string;
  creator_user_id: string;
  creator_name: string;
  role: string;
  confirmed_at: string;
}

const STATUS_MAP: Record<string, { label: string; dot: string; bg: string }> = {
  pending:   { label: "Pending review",     dot: "#f59e0b", bg: "#fffbeb" },
  published: { label: "Listed",             dot: "#2D6A4F", bg: "#eaf5ee" },
  rejected:  { label: "Not approved",       dot: "#ef4444", bg: "#fef2f2" },
  closed:    { label: "Partnership formed", dot: "#6b7280", bg: "#f3f4f6" },
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

function partnershipLabel(value: string) {
  return PARTNERSHIP_OPTIONS.find((o) => o.value === value)?.label ?? value;
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
function CloseInitiativeButton({
  initiative,
  onClosed,
}: {
  initiative: InitiativeRow;
  onClosed: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [closing, setClosing]       = useState(false);

  async function closeInitiative() {
    setClosing(true);
    await supabase
      .from("initiative_requests")
      .update({ status: "closed" })
      .eq("id", initiative.id);
    setClosing(false);
    setConfirming(false);
    onClosed();
  }

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)}
        className="w-full rounded-xl border border-border bg-card px-5 py-3 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors text-left">
        Partnership formed? <span className="text-foreground font-medium">Close this initiative →</span>
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 px-5 py-4 space-y-3">
      <p className="text-sm text-amber-800 dark:text-amber-300 font-medium">Close this initiative?</p>
      <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
        It will stay visible in the marketplace with a "Partnership formed" badge. This cannot be undone.
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

// ─── Detail View ──────────────────────────────────────────────────────────────
function InitiativeDetail({
  initiative,
  onBack,
}: {
  initiative: InitiativeRow;
  onBack: () => void;
}) {
  const s = STATUS_MAP[initiative.status] ?? { label: initiative.status, dot: "#6b7280", bg: "#f9fafb" };

  return (
    <div className="space-y-6">
      <button type="button" onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to initiatives
      </button>

      {/* Title block */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight">{initiative.title}</h2>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full"
              style={{ background: s.bg, color: s.dot }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot }} />
              {s.label}
            </span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Users className="w-3 h-3" />
              {initiative.eois} expression{initiative.eois !== 1 ? "s" : ""} of interest
            </span>
          </div>
        </div>
      </div>

      {/* Meta grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          { label: "Sectors",   value: initiative.sectors?.join(", ")   || "—" },
          { label: "Locations", value: initiative.locations?.join(", ") || "—" },
          { label: "Budget",    value: initiative.budget                || "—" },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
            <p className="text-sm font-medium text-foreground">{value}</p>
          </div>
        ))}
      </div>

      {/* Problem & Outcome */}
      {(initiative.problem || initiative.outcome) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {initiative.problem && (
            <div className="rounded-xl border border-border bg-card px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Problem</p>
              <p className="text-sm text-foreground leading-relaxed">{initiative.problem}</p>
            </div>
          )}
          {initiative.outcome && (
            <div className="rounded-xl border border-border bg-card px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Outcome</p>
              <p className="text-sm text-foreground leading-relaxed">{initiative.outcome}</p>
            </div>
          )}
        </div>
      )}

      {/* Partnerships */}
      {initiative.partnerships && initiative.partnerships.length > 0 && (
        <div className="rounded-xl border border-border bg-card px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Partnership needs</p>
          <div className="flex flex-wrap gap-2">
            {initiative.partnerships.map((p) => (
              <span key={p} className="px-3 py-1 rounded-full text-xs font-medium border border-border text-foreground capitalize">
                {p}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tags */}
      {initiative.tags && initiative.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {initiative.tags.map((t) => (
            <span key={t} className="px-3 py-1 rounded-full text-xs font-medium"
              style={{ background: "#f5ede8", color: "#C45C26" }}>
              {t}
            </span>
          ))}
        </div>
      )}

      {/* Full description */}
      {initiative.detail_content && initiative.detail_content !== "<p></p>" && (
        <div className="rounded-xl border border-border bg-card px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Full description</p>
          <div className="prose prose-sm max-w-none text-foreground"
            dangerouslySetInnerHTML={{ __html: initiative.detail_content }} />
        </div>
      )}

      {/* Resource link */}
      {initiative.resource_link && (
        <div className="rounded-xl border border-border bg-card px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Resource</p>
          <a href={initiative.resource_link} target="_blank" rel="noopener noreferrer"
            className="text-sm text-primary hover:underline break-all">
            {initiative.resource_link}
          </a>
        </div>
      )}

      {/* ESG */}
      {initiative.esg_alignment !== null && initiative.esg_alignment !== undefined && (
        <div className="rounded-xl border border-border bg-card px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">ESG alignment</p>
          <p className="text-sm text-foreground">
            {initiative.esg_alignment ? "Open to corporate ESG adoption" : "Not seeking ESG alignment"}
          </p>
        </div>
      )}

      {/* Confirmed partners */}
      {initiative.confirmed_partners && initiative.confirmed_partners.length > 0 && (
        <div className="rounded-xl border border-[#2D6A4F]/30 bg-[#eaf5ee] px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#2D6A4F] mb-3">Confirmed Partners</p>
          <div className="flex flex-col gap-2">
            {initiative.confirmed_partners.map((p) => (
              <div key={p.user_id} className="flex items-center justify-between gap-3">
                <a href={p.profile_link}
                  className="text-sm font-medium text-foreground hover:text-[#2D6A4F] transition-colors">
                  {p.name}
                </a>
                <span className="text-xs px-2.5 py-0.5 rounded-full capitalize"
                  style={{ background: "#d1fae5", color: "#065f46" }}>
                  {p.role}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Close initiative */}
      {initiative.status === "published" && (
        <CloseInitiativeButton initiative={initiative} onClosed={onBack} />
      )}

      {/* Status notes */}
      {initiative.status === "pending" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 px-5 py-4">
          <p className="text-sm text-amber-800 dark:text-amber-300 leading-relaxed">
            Your request is under review. Your initiative will be listed in the Marketplace once approved by the Natives team.
          </p>
        </div>
      )}
      {initiative.status === "rejected" && (
        <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 px-5 py-4">
          <p className="text-sm text-red-800 dark:text-red-300 leading-relaxed">
            This initiative was not approved. Reach out to the team for feedback and next steps.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Partners Tab ─────────────────────────────────────────────────────────────
function PartnersTab({ userId, userEmail }: { userId: string; userEmail?: string }) {
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

    // ── Creator: my initiatives with confirmed partners ───────────────────
    const myInitsWithPartners = allInits.filter(
      (init) =>
        init.user_id === userId &&
        Array.isArray(init.confirmed_partners) &&
        init.confirmed_partners.length > 0
    );

    if (myInitsWithPartners.length > 0) {
      const allPartnerUserIds = [
        ...new Set(
          myInitsWithPartners.flatMap((i) =>
            (i.confirmed_partners as any[]).map((p) => p.user_id)
          )
        ),
      ];
      const { data: partnerProfiles } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone, linkedin_url")
        .in("id", allPartnerUserIds);
      const profileMap = new Map((partnerProfiles ?? []).map((p: any) => [p.id, p]));

      setCreatorConfirmed(
        myInitsWithPartners.map((init) => ({
          initiative_id:    init.id,
          initiative_title: init.title,
          partners: (init.confirmed_partners as any[]).map((p) => {
            const profile = profileMap.get(p.user_id);
            return {
              user_id:      p.user_id,
              name:         p.name ?? profile?.full_name ?? "Unknown",
              role:         p.role,
              email:        profile?.email ?? "",
              phone:        profile?.phone ?? null,
              linkedin:     profile?.linkedin_url ?? null,
              confirmed_at: p.confirmed_at,
            };
          }),
        }))
      );
    } else {
      setCreatorConfirmed([]);
    }

    // ── Expresser: initiatives where I appear in confirmed_partners ───────
    const relevant = allInits.filter((init) => {
      if (init.user_id === userId) return false;
      const partners = (init.confirmed_partners as any[]) ?? [];
      return partners.some((p) => p.user_id === userId);
    });

    if (relevant.length > 0) {
      const ownerIds = [...new Set(relevant.map((i) => i.user_id).filter(Boolean))];
      const { data: ownerProfiles } = await supabase
        .from("profiles").select("id, full_name").in("id", ownerIds);
      const ownerMap = new Map((ownerProfiles ?? []).map((p: any) => [p.id, p]));

      setExpresserConfirmed(
        relevant.map((init) => {
          const partners = (init.confirmed_partners as any[]) ?? [];
          const myEntry  = partners.find((p) => p.user_id === userId);
          const owner    = ownerMap.get(init.user_id);
          return {
            initiative_id:    init.id,
            initiative_title: init.title,
            creator_user_id:  init.user_id,
            creator_name:     owner?.full_name ?? "Unknown",
            role:             myEntry?.role ?? "",
            confirmed_at:     myEntry?.confirmed_at ?? "",
          };
        })
      );
    } else {
      setExpresserConfirmed([]);
    }

    setLoading(false);
  }

  function exportCreatorPartners(card: CreatorConfirmedInitiative) {
    const rows = [
      ["Name", "Role", "Email", "Phone", "LinkedIn", "Confirmed At"],
      ...card.partners.map((p) => [
        p.name,
        partnershipLabel(p.role),
        p.email,
        p.phone ?? "",
        p.linkedin ?? "",
        new Date(p.confirmed_at).toLocaleDateString("en-GB"),
      ]),
    ];
    const csv  = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `${card.initiative_title.replace(/\s+/g, "_")}_partners.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 text-[#2D6A4F] animate-spin" />
      </div>
    );
  }

  const hasAnything = creatorConfirmed.length > 0 || expresserConfirmed.length > 0;

  if (!hasAnything) {
    return (
      <div className="rounded-2xl border border-border bg-card p-12 text-center">
        <Users className="w-8 h-8 text-muted-foreground/40 mx-auto mb-4" />
        <p className="text-foreground font-medium mb-2">No confirmed partnerships yet.</p>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          Partnerships appear here once an initiative creator confirms a partner from a conversation.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Creator section — single card, all partners */}
      {creatorConfirmed.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Partners on your initiatives
          </p>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-foreground">Confirmed partners</p>
              <button
                type="button"
                onClick={() => {
                  const rows = [
                    ["Initiative", "Name", "Role", "Email", "Phone", "LinkedIn", "Confirmed"],
                    ...creatorConfirmed.flatMap((card) =>
                      card.partners.map((p) => [
                        card.initiative_title,
                        p.name,
                        partnershipLabel(p.role),
                        p.email,
                        p.phone ?? "",
                        p.linkedin ?? "",
                        new Date(p.confirmed_at).toLocaleDateString("en-GB"),
                      ])
                    ),
                  ];
                  const csv  = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
                  const blob = new Blob([csv], { type: "text/csv" });
                  const url  = URL.createObjectURL(blob);
                  const a    = document.createElement("a");
                  a.href     = url;
                  a.download = "confirmed_partners.csv";
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="shrink-0 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-full px-3 py-1.5 transition-colors">
                <Download className="w-3 h-3" />
                Export
              </button>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted-foreground">Name</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted-foreground">Initiative</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted-foreground">Role</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted-foreground">Contact</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted-foreground">Confirmed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {creatorConfirmed.flatMap((card) =>
                  card.partners.map((p) => (
                    <tr key={`${card.initiative_id}-${p.user_id}`}>
                      <td className="px-5 py-3">
                        <Link href={`/dashboard/natives?user=${p.user_id}`}
                          className="text-sm font-medium text-foreground hover:text-[#2D6A4F] transition-colors hover:underline underline-offset-2">
                          {p.name}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-xs text-muted-foreground">{card.initiative_title}</td>
                      <td className="px-5 py-3">
                        <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                          style={{ background: "#eaf5ee", color: "#2D6A4F" }}>
                          {partnershipLabel(p.role)}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap gap-3">
                          {p.email && (
                            <a href={`mailto:${p.email}`}
                              className="text-xs text-[#2D6A4F] hover:underline underline-offset-2">
                              {p.email}
                            </a>
                          )}
                          {p.phone && (
                            <a href={`tel:${p.phone}`}
                              className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                              {p.phone}
                            </a>
                          )}
                          {p.linkedin && (
                            <a href={p.linkedin} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                              LinkedIn ↗
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {timeAgo(p.confirmed_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Expresser section — table */}
      {expresserConfirmed.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Initiatives you've been confirmed on
          </p>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-foreground">Your confirmations</p>
              <button
                type="button"
                onClick={() => {
                  const rows = [
                    ["Creator", "Initiative", "Role"],
                    ...expresserConfirmed.map((r) => [r.creator_name, r.initiative_title, partnershipLabel(r.role)]),
                  ];
                  const csv  = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
                  const blob = new Blob([csv], { type: "text/csv" });
                  const url  = URL.createObjectURL(blob);
                  const a    = document.createElement("a");
                  a.href     = url;
                  a.download = "my_confirmed_partnerships.csv";
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="shrink-0 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-full px-3 py-1.5 transition-colors">
                <Download className="w-3 h-3" />
                Export
              </button>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted-foreground">Creator</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted-foreground">Initiative</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted-foreground">Your role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {expresserConfirmed.map((row) => (
                  <tr key={`${row.initiative_id}-${row.creator_user_id}`}>
                    <td className="px-5 py-3">
                      <Link href={`/dashboard/natives?user=${row.creator_user_id}`}
                        className="text-sm font-medium text-foreground hover:text-[#2D6A4F] transition-colors hover:underline underline-offset-2">
                        {row.creator_name}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <Link href={`/dashboard/marketplace?initiative=${row.initiative_id}`}
                        className="text-sm text-muted-foreground hover:text-[#2D6A4F] transition-colors hover:underline underline-offset-2">
                        {row.initiative_title}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                        style={{ background: "#eaf5ee", color: "#2D6A4F" }}>
                        {partnershipLabel(row.role)}
                      </span>
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
  const [initiatives, setInitiatives] = useState<InitiativeRow[]>([]);
  const [loading, setLoading]         = useState(true);
  const [showModal, setShowModal]     = useState(false);
  const [selected, setSelected]       = useState<InitiativeRow | null>(null);
  const [activeTab, setActiveTab]     = useState<"all" | "pending" | "published" | "partners">("all");
  const [, params]                    = useRoute("/dashboard/initiatives/:id");
  const routeId                       = params?.id;
  const [location]                    = useLocation();

    // Handle ?tab=partners deep link from Messages
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "partners") setActiveTab("partners");
  }, []);

  async function load() {
    if (!user) return;
    const { data } = await supabase
      .from("initiative_requests")
      .select("id,title,sectors,locations,status,eois,created_at,problem,outcome,partnerships,esg_alignment,budget,tags,detail_content,resource_link,submitter_name,submitter_org,confirmed_partners,user_id")
      .or(`user_id.eq.${user.id},submitter_email.eq.${user.email}`)
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

  if (selected) {
    return <InitiativeDetail initiative={selected} onBack={() => setSelected(null)} />;
  }

  // Tabs — no "rejected" tab, rejected items stay in All
  const tabs = [
    { value: "all" as const,      label: "All",      count: initiatives.length },
    { value: "pending" as const,  label: "Pending",  count: initiatives.filter(i => i.status === "pending").length },
    { value: "published" as const,label: "Listed",   count: initiatives.filter(i => i.status === "published").length },
    { value: "partners" as const, label: "Partners", count: null },
  ].filter(t => t.value === "all" || t.value === "partners" || t.count! > 0);

  const visibleInitiatives = activeTab === "all"
    ? initiatives
    : initiatives.filter(i => i.status === activeTab);

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground tracking-tight">Initiatives</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Initiatives you've created or joined.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="rounded-full h-9 px-5 bg-[#2D6A4F] hover:bg-[#245c43] text-white text-sm font-medium transition-colors">
            + Create Initiative
          </button>
        </div>

        {/* Tabs */}
        {!loading && (
          <div className="flex gap-2 border-b border-border">
            {tabs.map(({ value, label, count }) => (
              <button
                key={value}
                type="button"
                onClick={() => setActiveTab(value)}
                className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors -mb-px ${
                  activeTab === value
                    ? "border-[#2D6A4F] text-[#2D6A4F]"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}>
                {label}
                {count !== null && (
                  <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                    activeTab === value ? "bg-[#2D6A4F]/10 text-[#2D6A4F]" : "bg-muted text-muted-foreground"
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Partners tab */}
        {activeTab === "partners" && user && (
          <PartnersTab userId={user.id} userEmail={user.email ?? undefined} />
        )}

        {/* Initiative list tabs */}
        {activeTab !== "partners" && (
          <>
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-5 h-5 text-[#2D6A4F] animate-spin" />
              </div>
            ) : initiatives.length === 0 ? (
              <div className="rounded-2xl border border-border bg-card p-12 text-center">
                <p className="text-foreground font-medium mb-2">You haven't created an initiative yet.</p>
                <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                  Create an initiative and let funders, partners, and implementers discover it.
                </p>
                <button type="button" onClick={() => setShowModal(true)}
                  className="rounded-full h-9 px-5 bg-[#2D6A4F] hover:bg-[#245c43] text-white text-sm font-medium transition-colors">
                  Create Initiative
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {visibleInitiatives.map((ini) => {
                  const s = STATUS_MAP[ini.status] ?? { label: ini.status, dot: "#6b7280", bg: "#f9fafb" };
                  return (
                    <button
                      key={ini.id}
                      type="button"
                      onClick={() => setSelected(ini)}
                      className="w-full text-left rounded-xl border border-border bg-card px-5 py-4 hover:border-[#2D6A4F]/30 transition-colors group">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: s.dot }} />
                            <span className="text-xs text-muted-foreground">{s.label}</span>
                            <span className="text-xs text-muted-foreground">·</span>
                            <span className="text-xs text-muted-foreground">
                              {ini.eois} EOI{ini.eois !== 1 ? "s" : ""}
                            </span>
                          </div>
                          <p className="font-medium text-foreground group-hover:text-[#2D6A4F] transition-colors truncate">
                            {ini.title}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {ini.sectors?.join(", ")} · {ini.locations?.slice(0, 2).join(", ")}
                          </p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-[#2D6A4F] transition-colors shrink-0 mt-1" />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      <CreateInitiativeModalDashboard
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={() => { load(); }}
      />
    </>
  );
}