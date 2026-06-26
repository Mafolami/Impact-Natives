// ─── DashboardPartnerships.tsx ───────────────────────────────────────────────
// Only shows orgs where partnership_listed = true
// Express Interest stores a partnership_connection with source = 'browse'
// Get Matched opens FindPartnerModalDashboard

import { useEffect, useState } from "react";
import { ORG_TYPE_FILTERS } from "@/lib/orgTypes";
import { supabase } from "@/lib/supabase";
import { Handshake, Loader2, Search, CheckCircle2, ShieldCheck } from "lucide-react";
import { SECTOR_OPTIONS } from "@/lib/sectors";
import { FindPartnerModalDashboard } from "./FindPartnerModalDashboard";
import { useAuth } from "@/context/AuthContext";

function orgTypeLabel(value: string | null | undefined): string {
  if (!value) return "";
  return ORG_TYPE_FILTERS.find(o => o.value === value)?.label ?? value.replace(/_/g, " ");
}

interface OrgRow {
  id: string;
  organisation_name: string;
  description: string;
  sector: string | string[];
  country: string | string[];
  organisation_type: string;
  website?: string;
  email?: string;
  needs?: string[];
  offers?: string[];
  sdgs?: string[];
  partnership_sought?: string;
  verification_status: string;
  status: string;
  user_id: string;
  partnership_listed: boolean;
  partnership_formed?: boolean;
  partnership_title?: string;
  // Enriched fields
  partnership_stage?: string;
  partnership_duration?: string;
  partnership_budget?: string;
  partnership_decision_timeline?: string;
  partnership_success_definition?: string;
  partnership_funding_status?: string;
  partnership_exclusivity?: string;
  partnership_working_style?: string;
  partnership_financial_transfer?: string;
  partnership_reporting?: string[];
  partnership_ip_ownership?: string;
  partnership_legal_type?: string[];
  partnership_team_capacity?: string;
  partnership_contact_seniority?: string;
  partnership_geo_specificity?: string;
  partnership_theory_of_change?: string;
  partnership_prior_attempts?: string;
  partnership_constraints?: string;
  partnership_dd_financial_model?: boolean;
  partnership_dd_audited_accounts?: boolean;
  partnership_dd_safeguarding_policy?: boolean;
  partnership_dd_data_policy?: boolean;
  partnership_dd_governance_doc?: boolean;
  partnership_prior_experience?: boolean;
  partnership_prior_experience_detail?: string;
  partnership_physically_present?: boolean;
}

function normalizeArr(val: string | string[] | null | undefined): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : [val];
  } catch {
    return [val];
  }
}

export default function DashboardPartnerships() {
  const { user } = useAuth();
  const [orgs, setOrgs]               = useState<OrgRow[]>([]);
  const [loading, setLoading]         = useState(true);
  const [showModal, setShowModal]     = useState(false);
  const [search, setSearch]           = useState("");
  const [sectorFilters, setSectorFilters] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters]     = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [selectedOrg, setSelectedOrg]     = useState<OrgRow | null>(null);
  const [savedOrgs, setSavedOrgs]         = useState<Set<string>>(new Set());
  const [currentUserOrgId, setCurrentUserOrgId] = useState<string | null>(null);
  const [sentInterests, setSentInterests]  = useState<Set<string>>(new Set());
  const [sendingInterest, setSendingInterest] = useState<string | null>(null);

  useEffect(() => {
    if (user) loadAll();
  }, [user]);

  async function loadAll() {
    const uid = user?.id ?? null;
    console.log("loadAll uid:", uid, "expected:", "8a5d138a-216f-496f-aebc-7d0f76bb9fd2", "match:", uid === "8a5d138a-216f-496f-aebc-7d0f76bb9fd2");

    const [orgsRes, savedRes, myOrgRes, existingConnectionsRes] = await Promise.all([
      supabase
        .from("organizations")
       .select("id, organisation_name, description, sector, country, organisation_type, website, email, needs, offers, sdgs, partnership_sought, partnership_title, verification_status, status, user_id, partnership_listed, partnership_formed, partnership_stage, partnership_duration, partnership_budget, partnership_decision_timeline, partnership_success_definition, partnership_funding_status, partnership_exclusivity, partnership_working_style, partnership_financial_transfer, partnership_reporting, partnership_ip_ownership, partnership_legal_type, partnership_team_capacity, partnership_contact_seniority, partnership_geo_specificity, partnership_theory_of_change, partnership_prior_attempts, partnership_constraints, partnership_dd_financial_model, partnership_dd_audited_accounts, partnership_dd_safeguarding_policy, partnership_dd_data_policy, partnership_dd_governance_doc, partnership_prior_experience, partnership_prior_experience_detail, partnership_physically_present")
       .eq("status", "published")
       .eq("partnership_listed", true)
        .order("created_at", { ascending: false }),

      uid
        ? supabase.from("saved_organizations").select("organization_id").eq("user_id", uid)
        : Promise.resolve({ data: null }),

      uid
        ? supabase.from("organizations").select("id").eq("user_id", uid).maybeSingle()
        : Promise.resolve({ data: null }),

      uid
        ? supabase.from("partnership_connections").select("receiver_org_id").eq("sender_user_id", uid)
        : Promise.resolve({ data: null }),
    ]);

    if (orgsRes.data) setOrgs(orgsRes.data as OrgRow[]);
    if (savedRes.data) setSavedOrgs(new Set(savedRes.data.map((r: any) => r.organization_id)));
   console.log("myOrgRes data:", myOrgRes.data);
    if (myOrgRes.data) setCurrentUserOrgId(myOrgRes.data.id);
    console.log("isOrg will be:", !!myOrgRes.data?.id);
    if (existingConnectionsRes.data && myOrgRes.data) {
      setSentInterests(new Set(
        existingConnectionsRes.data
          .filter((r: any) => r.receiver_org_id !== myOrgRes.data!.id)
          .map((r: any) => r.receiver_org_id)
      ));
    } else if (existingConnectionsRes.data) {
      setSentInterests(new Set(existingConnectionsRes.data.map((r: any) => r.receiver_org_id)));
    }
    setLoading(false);
  }

  const filtered = orgs.filter((org) => {
    // Don't show the user's own org
    if (user && org.user_id === user.id) return false;

    const sectors   = normalizeArr(org.sector);
    const countries = normalizeArr(org.country);
    const matchesSector =
      sectorFilters.size === 0 ||
      sectors.some(s => [...sectorFilters].some(f => s.toLowerCase().includes(f.toLowerCase())));
    const matchesSearch =
      !search.trim() ||
      org.organisation_name?.toLowerCase().includes(search.toLowerCase()) ||
      org.description?.toLowerCase().includes(search.toLowerCase()) ||
      (org.partnership_sought ?? "").toLowerCase().includes(search.toLowerCase()) ||
      countries.some(c => c.toLowerCase().includes(search.toLowerCase()));
    const matchesFavorites = !favoritesOnly || savedOrgs.has(org.id);
    return matchesSector && matchesSearch && matchesFavorites;
  });

  const activeFilterCount = sectorFilters.size + (favoritesOnly ? 1 : 0);

  async function toggleSave(orgId: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!user) return;
    if (savedOrgs.has(orgId)) {
      await supabase.from("saved_organizations").delete()
        .eq("user_id", user.id).eq("organization_id", orgId);
      setSavedOrgs(prev => { const next = new Set(prev); next.delete(orgId); return next; });
    } else {
      await supabase.from("saved_organizations").insert({ user_id: user.id, organization_id: orgId });
      setSavedOrgs(prev => new Set(prev).add(orgId));
    }
  }

  async function expressInterest(org: OrgRow, e: React.MouseEvent) {
    e.stopPropagation();
    if (!user) return;
    if (sentInterests.has(org.id)) return;
    if (org.partnership_formed) return;

    let senderOrgId = currentUserOrgId;
    if (!senderOrgId) {
      const { data } = await supabase
        .from("organizations")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!data) {
        alert("You need an organisation profile to express interest. Complete your profile first.");
        return;
      }
      senderOrgId = data.id;
      setCurrentUserOrgId(data.id);
    }

    setSendingInterest(org.id);

    try {
      // Insert partnership connection
      const { error } = await supabase.from("partnership_connections").insert({
        sender_org_id: senderOrgId,
        receiver_org_id: org.id,
        sender_user_id: user.id,
        source: "browse",
        status: "pending",
      });

      if (error && !error.message.includes("unique")) throw error;

      // Get sender org name for notification
      const { data: senderOrg } = await supabase
        .from("organizations")
        .select("organisation_name")
        .eq("id", senderOrgId)
        .single();

      await supabase.from("notifications").insert({
        user_id: org.user_id,
        type: "partnership_interest",
        title: "New partnership interest",
        body: `${senderOrg?.organisation_name ?? "An organisation"} expressed interest in partnering with you.`,
        link: "/dashboard/initiatives?tab=partnerships",
        metadata: {
          sender_org_id: senderOrgId,
          receiver_org_id: org.id,
        },
      });

      setSentInterests(prev => new Set(prev).add(org.id));
    } catch (e) {
      console.error("Express interest error:", e);
    } finally {
      setSendingInterest(null);
    }
  }

  const isOrg = !!user;

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground mt-1">
              Organisations actively seeking partnerships.
            </p>
          </div>
          {user && (
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="rounded-full h-9 px-5 bg-[#2D6A4F] hover:bg-[#245c43] text-white text-sm font-medium transition-colors"
            >
              + Get Matched
            </button>
          )}
        </div>

        {/* Search + filter */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search organisations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-9 pr-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowFilters(v => !v)}
            className={`relative h-10 px-4 rounded-lg border text-sm font-medium transition-colors flex items-center gap-2 ${
              showFilters || activeFilterCount > 0
                ? "bg-[#2D6A4F] border-[#2D6A4F] text-white"
                : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth={2} className="w-4 h-4">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
            </svg>
            Filter
            {activeFilterCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-white text-[#2D6A4F] text-[10px] font-bold flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div
            className="rounded-xl border border-border bg-card p-4 space-y-4"
            onMouseLeave={() => setShowFilters(false)}
          >
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={favoritesOnly}
                onChange={e => setFavoritesOnly(e.target.checked)}
                className="w-4 h-4 rounded border-border accent-[#2D6A4F]"
              />
              <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
                  className="w-3.5 h-3.5"
                  fill={favoritesOnly ? "#2D6A4F" : "none"}
                  stroke={favoritesOnly ? "#2D6A4F" : "currentColor"}
                  strokeWidth={2}>
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                </svg>
                Saved only
              </span>
            </label>

            <div className="border-t border-border" />

            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Sector</p>
              <div className="flex flex-wrap gap-1.5">
                {SECTOR_OPTIONS.map(sector => (
                  <button
                    key={sector} type="button"
                    onClick={() => {
                      setSectorFilters(prev => {
                        const next = new Set(prev);
                        next.has(sector) ? next.delete(sector) : next.add(sector);
                        return next;
                      });
                    }}
                    className={`h-7 px-3 rounded-full text-xs border transition-colors ${
                      sectorFilters.has(sector)
                        ? "bg-[#2D6A4F] border-[#2D6A4F] text-white"
                        : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                    }`}
                  >
                    {sector}
                  </button>
                ))}
              </div>
            </div>

            {activeFilterCount > 0 && (
              <button type="button"
                onClick={() => { setSectorFilters(new Set()); setFavoritesOnly(false); }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                Clear all filters
              </button>
            )}
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-5 h-5 text-[#2D6A4F] animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-12 text-center">
            <Handshake className="w-8 h-8 text-muted-foreground/40 mx-auto mb-4" />
            <p className="text-foreground font-medium mb-2">
              {orgs.length === 0 ? "No organisations listed yet." : "No results for that filter."}
            </p>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
              {orgs.length === 0
                ? "Be the first to list your organisation for partnership discovery."
                : "Try a different sector or search term."}
            </p>

          </div>
        ) : selectedOrg ? (
          <OrgDetail
            org={selectedOrg}
            isSaved={savedOrgs.has(selectedOrg.id)}
            onToggleSave={(e) => toggleSave(selectedOrg.id, e)}
            onBack={() => setSelectedOrg(null)}
            isOrg={isOrg}
            alreadySent={sentInterests.has(selectedOrg.id)}
            sending={sendingInterest === selectedOrg.id}
            onExpressInterest={(e) => expressInterest(selectedOrg, e)}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {filtered.map((org) => (
              <OrgCard
                key={org.id}
                org={org}
                isSaved={savedOrgs.has(org.id)}
                onToggleSave={(e) => toggleSave(org.id, e)}
                onClick={() => setSelectedOrg(org)}
                isOrg={isOrg}
                alreadySent={sentInterests.has(org.id)}
                sending={sendingInterest === org.id}
                onExpressInterest={(e) => expressInterest(org, e)}
              />
            ))}
          </div>
        )}
      </div>

      <FindPartnerModalDashboard
        isOpen={showModal}
        onClose={() => { setShowModal(false); loadAll(); }}
      />
    </>
  );
}

// ─── Org Detail ───────────────────────────────────────────────────────────────
function OrgDetail({
  org, isSaved, onToggleSave, onBack,
  isOrg, alreadySent, sending, onExpressInterest,
}: {
  org: OrgRow; isSaved: boolean; onToggleSave: (e: React.MouseEvent) => void;
  onBack: () => void; isOrg: boolean; alreadySent: boolean;
  sending: boolean; onExpressInterest: (e: React.MouseEvent) => void;
}) {
  const isVerified = org.verification_status === "verified";
  const sectors = normalizeArr(org.sector);
  const countries = normalizeArr(org.country);
  const score = ddScore(org);
  const fundingStatus = org.partnership_funding_status ?? "";
  const statusStyle = FUNDING_STATUS_COLORS[fundingStatus] ?? { color: "#2D6A4F", bg: "#eaf5ee" };

  function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <div className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</p>
        {children}
      </div>
    );
  }

  function DetailRow({ label, value }: { label: string; value: string }) {
    return (
      <div className="flex items-start justify-between gap-4">
        <span className="text-sm text-muted-foreground shrink-0">{label}</span>
        <span className="text-sm font-semibold text-foreground text-right">{value}</span>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Status stripe */}
      <div className="h-1.5 w-full" style={{ background: statusStyle.color }} />

      <div className="p-6 space-y-6">
        {/* Nav */}
        <div className="flex items-center justify-between">
          <button type="button" onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth={2} className="w-4 h-4">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
            Back
          </button>
          <button type="button" onClick={onToggleSave}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border border-border hover:border-[#2D6A4F]/60 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-3.5 h-3.5"
              fill={isSaved ? "#2D6A4F" : "none"} stroke={isSaved ? "#2D6A4F" : "currentColor"} strokeWidth={2}>
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
            {isSaved ? "Saved" : "Save"}
          </button>
        </div>

        {/* Identity */}
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <a
              href={`/dashboard/natives?user=${org.user_id}`}
              className="text-xl font-black text-foreground hover:text-[#2D6A4F] transition-colors hover:underline underline-offset-2"
            >
              {org.organisation_name}
            </a>
            {isVerified && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: "#eaf5ee", color: "#2D6A4F" }}>
                <ShieldCheck className="w-3 h-3" />Verified
              </span>
            )}
          </div>
          <p className="text-base text-muted-foreground capitalize">
            {orgTypeLabel(org.organisation_type)}
            {countries.length > 0 && ` · ${countries.join(", ")}`}
          </p>
          {sectors.length > 0 && (
            <div className="flex gap-1.5 flex-wrap mt-2">
              {sectors.map(s => (
                <span key={s} className="text-xs px-2.5 py-1 rounded-full border border-border text-muted-foreground">{s}</span>
              ))}
            </div>
          )}
        </div>

        {/* Partnership title + sought */}
        {(org.partnership_title || org.partnership_sought) && (
          <div className="rounded-2xl p-5 space-y-3" style={{ background: `${statusStyle.color}08`, border: `1.5px solid ${statusStyle.color}30` }}>
            {org.partnership_title && (
              <p className="text-base font-black text-foreground">{org.partnership_title}</p>
            )}
            {org.partnership_sought && (
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest mb-1.5" style={{ color: statusStyle.color }}>Seeking</p>
                <p className="text-base text-foreground leading-relaxed">{org.partnership_sought}</p>              </div>
            )}
            {org.partnership_success_definition && (
              <div className="pt-2 border-t" style={{ borderColor: `${statusStyle.color}20` }}>
                <p className="text-[10px] font-black uppercase tracking-widest mb-1.5 text-muted-foreground/60">Success definition</p>
                <p className="text-sm text-muted-foreground leading-relaxed italic">"{org.partnership_success_definition}"</p>
              </div>
            )}
          </div>
        )}

        {/* About */}
        {org.description && (
          <DetailSection title="About">
            <p className="text-base text-muted-foreground leading-relaxed">{org.description}</p>
          </DetailSection>
        )}

        {/* Partnership signals */}
        <DetailSection title="Partnership details">
          <div className="rounded-xl border border-border divide-y divide-border">
            {org.partnership_stage && <div className="px-4 py-2.5"><DetailRow label="Stage" value={STAGE_LABELS[org.partnership_stage] ?? org.partnership_stage} /></div>}
            {org.partnership_duration && <div className="px-4 py-2.5"><DetailRow label="Duration" value={DURATION_LABELS[org.partnership_duration] ?? org.partnership_duration} /></div>}
            {org.partnership_budget && <div className="px-4 py-2.5"><DetailRow label="Budget" value={BUDGET_LABELS[org.partnership_budget] ?? org.partnership_budget} /></div>}
            {org.partnership_decision_timeline && <div className="px-4 py-2.5"><DetailRow label="Timeline" value={TIMELINE_LABELS[org.partnership_decision_timeline] ?? org.partnership_decision_timeline} /></div>}
            {org.partnership_funding_status && <div className="px-4 py-2.5"><DetailRow label="Funding status" value={FUNDING_STATUS_LABELS[org.partnership_funding_status] ?? org.partnership_funding_status} /></div>}
            {org.partnership_exclusivity && <div className="px-4 py-2.5"><DetailRow label="Exclusivity" value={org.partnership_exclusivity === "one_dedicated_partner" ? "One dedicated partner" : "Open to multiple partners"} /></div>}
            {org.partnership_physically_present !== null && org.partnership_physically_present !== undefined && (
              <div className="px-4 py-2.5"><DetailRow label="On the ground" value={org.partnership_physically_present ? "Yes" : "No — remote"} /></div>
            )}
            {org.partnership_geo_specificity && <div className="px-4 py-2.5"><DetailRow label="Location focus" value={org.partnership_geo_specificity} /></div>}
            {org.partnership_team_capacity && <div className="px-4 py-2.5"><DetailRow label="Team capacity" value={org.partnership_team_capacity.replace(/_/g, " ").replace(/(\d)\s+(\d)/g, "$1–$2")} /></div>}            {org.partnership_contact_seniority && <div className="px-4 py-2.5"><DetailRow label="Lead contact" value={org.partnership_contact_seniority.replace(/_/g, " ")} /></div>}
          </div>
        </DetailSection>

        {/* Expectations */}
        {(org.partnership_working_style || org.partnership_financial_transfer || (org.partnership_reporting && org.partnership_reporting.length > 0) || org.partnership_ip_ownership || (org.partnership_legal_type && org.partnership_legal_type.length > 0)) && (
          <DetailSection title="Working expectations">
            <div className="rounded-xl border border-border divide-y divide-border">
              {org.partnership_working_style && <div className="px-4 py-2.5"><DetailRow label="Working style" value={WORKING_STYLE_LABELS[org.partnership_working_style] ?? org.partnership_working_style} /></div>}
              {org.partnership_financial_transfer && <div className="px-4 py-2.5"><DetailRow label="Financial arrangement" value={FINANCIAL_TRANSFER_LABELS[org.partnership_financial_transfer] ?? org.partnership_financial_transfer} /></div>}
              {org.partnership_reporting && org.partnership_reporting.length > 0 && (
                <div className="px-4 py-2.5"><DetailRow label="Reporting" value={org.partnership_reporting.map(r => r.replace(/_/g, " ")).join(", ")} /></div>
              )}
              {org.partnership_ip_ownership && <div className="px-4 py-2.5"><DetailRow label="IP ownership" value={org.partnership_ip_ownership.replace(/_/g, " ")} /></div>}
              {org.partnership_legal_type && org.partnership_legal_type.length > 0 && (
                <div className="px-4 py-2.5"><DetailRow label="Partnership type" value={org.partnership_legal_type.map(t => ({
                  formal_mou: "Formal MoU", subcontracting: "Service provider arrangement",
                  co_implementation: "Joint delivery", referral: "Referral / network",
                  joint_venture: "Joint venture", informal: "Informal collaboration", open: "Open to discussion",
                }[t] ?? t)).join(", ")} /></div>
              )}
            </div>
          </DetailSection>
        )}

        {/* Needs + offers */}
        {((org.needs && org.needs.length > 0) || (org.offers && org.offers.length > 0)) && (
          <DetailSection title="Exchange">
            <div className="space-y-4">
              {org.needs && org.needs.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-foreground mb-2">Needs</p>
                  <div className="flex flex-wrap gap-2">
                    {org.needs.map(n => (
                      <span key={n} className="text-xs px-3 py-1.5 rounded-full border border-border text-muted-foreground font-medium">{n}</span>
                    ))}
                  </div>
                </div>
              )}
              {org.offers && org.offers.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-foreground mb-2">Offers</p>
                  <div className="flex flex-wrap gap-2">
                    {org.offers.map(o => (
                      <span key={o} className="text-xs px-3 py-1.5 rounded-full font-semibold" style={{ background: "#eaf5ee", color: "#2D6A4F" }}>{o}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </DetailSection>
        )}

        {/* DD readiness */}
        <DetailSection title="Due diligence readiness">
          <div className="flex items-center gap-3 mb-3">
            <DDDots score={score} />
          </div>
         <div className="flex flex-wrap gap-2">
            {[
              { key: "partnership_dd_financial_model", label: "Financial model" },
              { key: "partnership_dd_audited_accounts", label: "Audited accounts" },
              { key: "partnership_dd_safeguarding_policy", label: "Safeguarding policy" },
              { key: "partnership_dd_data_policy", label: "Data / GDPR policy" },
              { key: "partnership_dd_governance_doc", label: "Governance document" },
            ].map(({ key, label }) => {
              const has = org[key as keyof OrgRow] as boolean;
              return (
                <span key={key} className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${has ? "text-[#2D6A4F]" : "text-muted-foreground/50 line-through"}`}
                  style={{ background: has ? "#eaf5ee" : "transparent", border: has ? "none" : "1px solid var(--border)" }}>
                  {has && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                  {label}
                </span>
              );
            })}
          </div>
        </DetailSection>

        {/* SDGs */}
        {org.sdgs && org.sdgs.length > 0 && (
          <DetailSection title="SDG alignment">
            <div className="flex gap-1.5 flex-wrap">
              {org.sdgs.map(sdg => (
                <span key={sdg} className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                  style={{ background: "#eaf5ee", color: "#2D6A4F" }}>SDG {sdg}</span>
              ))}
            </div>
          </DetailSection>
        )}

        {/* Context */}
        {(org.partnership_theory_of_change || org.partnership_prior_attempts || org.partnership_constraints) && (
          <DetailSection title="Context">
            <div className="space-y-3">
              {org.partnership_theory_of_change && (
                <div className="space-y-1">
                  <p className="text-xs font-bold text-foreground">Approach to change</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{org.partnership_theory_of_change}</p>
                </div>
              )}
              {(org.partnership_theory_of_change && (org.partnership_prior_attempts || org.partnership_constraints)) && <div className="h-px bg-border" />}
              {org.partnership_prior_attempts && (
                <div className="space-y-1">
                  <p className="text-xs font-bold text-foreground">Previous attempts</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{org.partnership_prior_attempts}</p>
                </div>
              )}
              {(org.partnership_prior_attempts && org.partnership_constraints) && <div className="h-px bg-border" />}
              {org.partnership_constraints && (
                <div className="space-y-1">
                  <p className="text-xs font-bold text-foreground">Constraints</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{org.partnership_constraints}</p>
                </div>
              )}
            </div>
          </DetailSection>
        )}

        {/* Prior experience */}
        {org.partnership_prior_experience !== null && org.partnership_prior_experience !== undefined && (
          <DetailSection title="Track record">
            <div className="rounded-xl border border-border px-4 py-3 space-y-2">
              <DetailRow label="Completed a partnership before" value={org.partnership_prior_experience ? "Yes" : "No"} />
              {org.partnership_prior_experience && org.partnership_prior_experience_detail && (
                <p className="text-xs text-muted-foreground leading-relaxed pt-1 border-t border-border">{org.partnership_prior_experience_detail}</p>
              )}
            </div>
          </DetailSection>
        )}

        {/* CTA */}
        {isOrg && !org.partnership_formed && (
          <div className="pt-2 border-t border-border">
            {alreadySent ? (
              <div className="flex items-center gap-2 text-sm font-semibold text-[#2D6A4F]">
                <CheckCircle2 className="w-4 h-4" />Interest expressed — they've been notified
              </div>
            ) : (
              <button type="button" onClick={onExpressInterest} disabled={sending}
                className="w-full h-11 rounded-full bg-[#2D6A4F] hover:bg-[#245c43] text-white text-sm font-bold disabled:opacity-40 transition-colors">
                {sending ? "Sending..." : "Express interest"}
              </button>
            )}
          </div>
        )}

        {/* Website */}
        {org.website && org.website !== "https://" && (
          <a href={org.website} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-primary hover:underline">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
              <circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
            {org.website.replace(/^https?:\/\//, "")}
          </a>
        )}
      </div>
    </div>
  );
}

const STAGE_LABELS: Record<string, string> = {
  concept: "Co-designing", joining_running: "Joining active work",
  pilot: "Pilot phase", scaling: "Scaling",
};
const DURATION_LABELS: Record<string, string> = {
  under_6_months: "Under 6 mo", "6_12_months": "6–12 mo",
  "1_2_years": "1–2 years", "2_plus_years": "2+ years", ongoing: "Ongoing",
};
const BUDGET_LABELS: Record<string, string> = {
  under_10k: "Under $10K", "10k_50k": "$10K–$50K",
  "50k_200k": "$50K–$200K", over_200k: "Over $200K",
  in_kind_only: "In-kind", open: "Open to discuss",
};
const TIMELINE_LABELS: Record<string, string> = {
  immediately: "Immediately", within_1_month: "Within 1 month",
  "1_3_months": "1–3 months", "3_6_months": "3–6 months",
  no_fixed_timeline: "No fixed timeline",
};
const FUNDING_STATUS_LABELS: Record<string, string> = {
  fully_funded: "Fully funded", partially_funded: "Partially funded",
  seeking_funding: "Seeking co-funding", partner_brings_funding: "Partner brings funding",
};
const FUNDING_STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  fully_funded:           { color: "#2D6A4F", bg: "#eaf5ee" },
  partially_funded:       { color: "#C45C26", bg: "#fdf5f2" },
  seeking_funding:        { color: "#C45C26", bg: "#fdf5f2" },
  partner_brings_funding: { color: "#7B5EA7", bg: "#f3f0fa" },
};
const WORKING_STYLE_LABELS: Record<string, string> = {
  prefer_lead: "Prefers to lead", equal_codesign: "Equal co-design",
  prefer_support: "Prefers to support", flexible: "Flexible",
};
const FINANCIAL_TRANSFER_LABELS: Record<string, string> = {
  we_pay: "Provides funding to partners", we_get_paid: "Expects compensation/subgrant",
  no_transfer: "No financial transfer", open: "Open to discussion",
};

function ddScore(org: OrgRow): number {
  return [
    org.partnership_dd_financial_model,
    org.partnership_dd_audited_accounts,
    org.partnership_dd_safeguarding_policy,
    org.partnership_dd_data_policy,
    org.partnership_dd_governance_doc,
  ].filter(Boolean).length;
}

function SignalPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">{label}</span>
      <span className="text-xs font-semibold text-foreground">{value}</span>
    </div>
  );
}

function DDDots({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">DD ready</span>
      <div className="flex gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={`w-2 h-2 rounded-full transition-colors ${i < score ? "bg-[#2D6A4F]" : "bg-border"}`} />
        ))}
      </div>
      <span className="text-[10px] text-muted-foreground">{score}/5</span>
    </div>
  );
}

// ─── Org Card ─────────────────────────────────────────────────────────────────
function OrgCard({
  org, isSaved, onToggleSave, onClick,
  isOrg, alreadySent, sending, onExpressInterest,
}: {
  org: OrgRow; isSaved: boolean; onToggleSave: (e: React.MouseEvent) => void;
  onClick: () => void; isOrg: boolean; alreadySent: boolean;
  sending: boolean; onExpressInterest: (e: React.MouseEvent) => void;
}) {
  const isVerified = org.verification_status === "verified";
  const sectors = normalizeArr(org.sector);
  const countries = normalizeArr(org.country);
  const score = ddScore(org);
  const fundingStatus = org.partnership_funding_status ?? "";
  const statusStyle = FUNDING_STATUS_COLORS[fundingStatus] ?? { color: "#2D6A4F", bg: "#eaf5ee" };

  const signals = [
    org.partnership_stage && { label: "Stage", value: STAGE_LABELS[org.partnership_stage] ?? org.partnership_stage },
    org.partnership_duration && { label: "Duration", value: DURATION_LABELS[org.partnership_duration] ?? org.partnership_duration },
    org.partnership_budget && { label: "Budget", value: BUDGET_LABELS[org.partnership_budget] ?? org.partnership_budget },
    org.partnership_decision_timeline && { label: "Timeline", value: TIMELINE_LABELS[org.partnership_decision_timeline] ?? org.partnership_decision_timeline },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <div
      onClick={onClick}
      className="group relative rounded-2xl border border-border bg-card overflow-hidden cursor-pointer transition-all duration-200 hover:border-[#2D6A4F]/40 hover:shadow-md flex flex-col"
    >
      {/* Funding status top stripe */}
      <div className="h-1 w-full shrink-0" style={{ background: statusStyle.color, opacity: 0.7 }} />

      <div className="flex flex-col gap-4 p-5 flex-1">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <a
                href={`/dashboard/natives?user=${org.user_id}`}
                onClick={e => e.stopPropagation()}
                className="font-bold text-foreground hover:text-[#2D6A4F] transition-colors truncate hover:underline underline-offset-2"
              >
                {org.organisation_name}
              </a>
              {isVerified && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                  style={{ background: "#eaf5ee", color: "#2D6A4F" }}>
                  <ShieldCheck className="w-3 h-3" />Verified
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground capitalize">
              {orgTypeLabel(org.organisation_type)}
              {countries.length > 0 && ` · ${countries.join(", ")}`}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {sectors[0] && (
              <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full border border-border text-muted-foreground">
                {sectors[0]}
              </span>
            )}
            <button type="button" onClick={e => { e.stopPropagation(); onToggleSave(e); }}
              className="p-1.5 rounded-full hover:bg-muted transition-colors" aria-label={isSaved ? "Unsave" : "Save"}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4"
                fill={isSaved ? "#2D6A4F" : "none"} stroke={isSaved ? "#2D6A4F" : "currentColor"} strokeWidth={2}>
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Partnership title */}
        {org.partnership_title && (
          <p className="text-sm font-bold text-foreground leading-snug -mb-1">{org.partnership_title}</p>
        )}

        {/* What they're looking for */}
        {org.partnership_sought && (
          <div className="rounded-xl px-3.5 py-3" style={{ background: `${statusStyle.color}0d`, borderLeft: `3px solid ${statusStyle.color}` }}>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: statusStyle.color }}>Seeking</p>
            <p className="text-xs text-foreground leading-relaxed line-clamp-2">{org.partnership_sought}</p>
          </div>
        )}

        {/* Signal pills */}
        {signals.length > 0 && (
          <div className="grid grid-cols-2 gap-3 py-3 px-3.5 rounded-xl bg-muted/40">
            {signals.map(s => <SignalPill key={s.label} label={s.label} value={s.value} />)}
          </div>
        )}

        {/* Success definition */}
        {org.partnership_success_definition && (
          <p className="text-xs text-muted-foreground leading-relaxed italic line-clamp-2 border-l-2 border-border pl-3">
            "{org.partnership_success_definition}"
          </p>
        )}

        {/* Footer row */}
        <div className="flex items-center justify-between gap-3 mt-auto pt-1">
          <DDDots score={score} />
          {fundingStatus && (
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full"
              style={{ background: statusStyle.bg, color: statusStyle.color }}>
              {FUNDING_STATUS_LABELS[fundingStatus] ?? fundingStatus}
            </span>
          )}
        </div>

        {/* Express interest */}
        {isOrg && !org.partnership_formed && (
          <div onClick={e => e.stopPropagation()} className="border-t border-border pt-3">
            {alreadySent ? (
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#2D6A4F]">
                <CheckCircle2 className="w-3.5 h-3.5" />Interest expressed
              </div>
            ) : (
              <button type="button" onClick={onExpressInterest} disabled={sending}
                className="w-full h-9 rounded-full border-2 border-[#2D6A4F] text-[#2D6A4F] text-xs font-bold hover:bg-[#2D6A4F] hover:text-white disabled:opacity-40 transition-all">
                {sending ? "Sending..." : "Express interest"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}