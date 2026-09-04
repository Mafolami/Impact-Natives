import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis } from "recharts";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { Loader2, Handshake, PartyPopper, ShieldCheck, AlertTriangle, Users, ChevronDown } from "lucide-react";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { resolveMouDocTitle } from "@/lib/mouTitle";
import { PartnershipIndicator, isIndicatorAgreed, fetchIndicatorsForDocuments } from "@/lib/indicators";
import { ImpactClaim, fetchClaimsForIndicators } from "@/lib/impactClaims";

interface ExecutedDoc {
  id: string;
  org_a_id: string;
  org_b_id: string;
  initiative_id: string | null;
  connection_id: string | null;
  toggle_selections: Record<string, string | boolean> | null;
  fully_executed_at: string | null;
}

interface OrgRef {
  id: string;
  user_id: string;
  organisation_name: string;
  partnership_sought?: string | null;
}

interface MilestoneRow {
  id: string;
  mou_document_id: string;
  status: string;
}

const CONFIRMED_COLOR = "#2D6A4F";
const DISPUTED_COLOR = "#dc2626";

const claimsChartConfig: ChartConfig = {
  confirmed: { label: "Confirmed", color: CONFIRMED_COLOR },
  disputed: { label: "Disputed", color: DISPUTED_COLOR },
};
const evidenceChartConfig: ChartConfig = {
  evidenced: { label: "Evidenced", color: CONFIRMED_COLOR },
  remaining: { label: "Remaining", color: "hsl(var(--muted))" },
};

export default function DashboardPortfolioTrackRecord() {
  const { orgOwnerId } = useAuth();
  const [, navigate] = useLocation();
  const [loading, setLoading] = useState(true);
  const [myOrgId, setMyOrgId] = useState<string | null>(null);
  const [docs, setDocs] = useState<ExecutedDoc[]>([]);
  const [orgMap, setOrgMap] = useState<Record<string, OrgRef>>({});
  const [initiativeTitleMap, setInitiativeTitleMap] = useState<Record<string, string>>({});
  const [allIndicators, setAllIndicators] = useState<PartnershipIndicator[]>([]);
  const [allClaims, setAllClaims] = useState<ImpactClaim[]>([]);
  const [milestones, setMilestones] = useState<MilestoneRow[]>([]);

  // Three independent filter dimensions, AND-combined -- default is
  // everything across the org, matching how the rest of the platform
  // treats an empty filter as "no scope applied" rather than "nothing."
  const [filterDocId, setFilterDocId] = useState("");
  const [filterIndicatorId, setFilterIndicatorId] = useState("");
  const [filterMonth, setFilterMonth] = useState("");

  useEffect(() => { load(); }, [orgOwnerId]);

  async function load() {
    if (!orgOwnerId) return;
    setLoading(true);
    const { data: myOrg } = await supabase.from("organizations").select("id").eq("user_id", orgOwnerId).maybeSingle();
    if (!myOrg) { setLoading(false); return; }
    setMyOrgId(myOrg.id);

    const { data: docRows } = await supabase
      .from("mou_documents")
      .select("id, org_a_id, org_b_id, initiative_id, connection_id, toggle_selections, fully_executed_at")
      .or(`org_a_id.eq.${myOrg.id},org_b_id.eq.${myOrg.id}`)
      .eq("status", "fully_executed");
    const docList = (docRows as ExecutedDoc[]) ?? [];
    setDocs(docList);

    const orgIds = [...new Set(docList.flatMap((d) => [d.org_a_id, d.org_b_id]))];
    if (orgIds.length > 0) {
      const { data: orgs } = await supabase.from("organizations").select("id, user_id, organisation_name, partnership_sought").in("id", orgIds);
      const map: Record<string, OrgRef> = {};
      (orgs ?? []).forEach((o: any) => { map[o.id] = o; });
      setOrgMap(map);
    }

    const initIds = [...new Set(docList.map((d) => d.initiative_id).filter((x): x is string => !!x))];
    if (initIds.length > 0) {
      const { data: inits } = await supabase.from("initiative_requests").select("id, title").in("id", initIds);
      const titleMap: Record<string, string> = {};
      (inits ?? []).forEach((i: any) => { titleMap[i.id] = i.title; });
      setInitiativeTitleMap(titleMap);
    }

    const docIds = docList.map((d) => d.id);
    const indicatorRows = docIds.length > 0 ? await fetchIndicatorsForDocuments(docIds) : [];
    setAllIndicators(indicatorRows);

    const agreedIds = indicatorRows.filter(isIndicatorAgreed).map((i) => i.id);
    const claimRows = agreedIds.length > 0 ? await fetchClaimsForIndicators(agreedIds) : [];
    setAllClaims(claimRows);

    if (docIds.length > 0) {
      const { data: msRows } = await supabase
        .from("mou_milestones")
        .select("id, mou_document_id, status")
        .in("mou_document_id", docIds);
      setMilestones((msRows as MilestoneRow[]) ?? []);
    } else {
      setMilestones([]);
    }

    setLoading(false);
  }

  function partnerOrgIdFor(doc: ExecutedDoc): string {
    return doc.org_a_id === myOrgId ? doc.org_b_id : doc.org_a_id;
  }

  const agreementOptions = useMemo(() => {
    return docs
      .map((d) => ({ id: d.id, label: `${orgMap[partnerOrgIdFor(d)]?.organisation_name ?? "Partner"} — ${resolveMouDocTitle(d, orgMap, initiativeTitleMap) ?? "Partnership"}` }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [docs, orgMap, initiativeTitleMap, myOrgId]);

  // Indicator options narrow to the selected agreement, if one is picked
  // -- otherwise every agreed indicator across the org.
  const indicatorOptions = useMemo(() => {
    return allIndicators
      .filter(isIndicatorAgreed)
      .filter((ind) => !filterDocId || ind.mou_document_id === filterDocId)
      .map((ind) => ({ id: ind.id, label: ind.name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [allIndicators, filterDocId]);

  const monthOptions = useMemo(() => {
    const months = new Set<string>();
    docs.forEach((d) => { if (d.fully_executed_at) months.add(d.fully_executed_at.slice(0, 7)); });
    return [...months].sort().reverse().map((m) => ({
      value: m,
      label: new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "long", timeZone: "UTC" }),
    }));
  }, [docs]);

  function docMatchesMonth(doc: ExecutedDoc | undefined): boolean {
    if (!filterMonth) return true;
    if (!doc?.fully_executed_at) return false;
    return doc.fully_executed_at.slice(0, 7) === filterMonth;
  }

  const filteredDocs = useMemo(() => {
    return docs.filter((d) => (!filterDocId || d.id === filterDocId) && docMatchesMonth(d));
  }, [docs, filterDocId, filterMonth]);
  const filteredDocIds = useMemo(() => new Set(filteredDocs.map((d) => d.id)), [filteredDocs]);

  const filteredIndicators = useMemo(() => {
    return allIndicators.filter(isIndicatorAgreed).filter((ind) =>
      filteredDocIds.has(ind.mou_document_id) &&
      (!filterIndicatorId || ind.id === filterIndicatorId)
    );
  }, [allIndicators, filteredDocIds, filterIndicatorId]);
  const filteredIndicatorIds = useMemo(() => new Set(filteredIndicators.map((i) => i.id)), [filteredIndicators]);

  const myClaims = useMemo(() => {
    return allClaims.filter((c) => c.claiming_org_id === myOrgId && filteredIndicatorIds.has(c.indicator_id));
  }, [allClaims, myOrgId, filteredIndicatorIds]);

  const confirmedClaims = myClaims.filter((c) => c.status === "confirmed");
  const disputedClaims = myClaims.filter((c) => c.status === "disputed");
  const distinctConfirmingPartners = new Set(confirmedClaims.map((c) => c.confirmed_by_org_id).filter(Boolean)).size;
  const evidencedIndicators = filteredIndicators.filter((ind) => myClaims.some((c) => c.indicator_id === ind.id)).length;
  const verifiedMilestones = milestones.filter((m) => filteredDocIds.has(m.mou_document_id) && m.status === "verified").length;

  const totalSubmitted = confirmedClaims.length + disputedClaims.length;
  const disputeRate = totalSubmitted > 0 ? Math.round((disputedClaims.length / totalSubmitted) * 100) : null;
  const evidenceRate = filteredIndicators.length > 0 ? Math.round((evidencedIndicators / filteredIndicators.length) * 100) : null;

  const claimsData = [
    { name: "Confirmed", value: confirmedClaims.length },
    { name: "Disputed", value: disputedClaims.length },
  ];
  const evidenceBarData = [{
    name: "evidence",
    evidenced: evidencedIndicators,
    remaining: Math.max(filteredIndicators.length - evidencedIndicators, 0),
  }];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 text-[#2D6A4F] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Filters -- default view is everything across the org; each
          dimension narrows independently and combines with the others. */}
      <div className="flex flex-wrap items-center gap-3">
        <FilterSelect label="Agreement" value={filterDocId} onChange={setFilterDocId}
          options={agreementOptions.map((o) => ({ value: o.id, label: o.label }))} allLabel="All agreements" />
        <FilterSelect label="Indicator" value={filterIndicatorId} onChange={setFilterIndicatorId}
          options={indicatorOptions.map((o) => ({ value: o.id, label: o.label }))} allLabel="All indicators" />
        <FilterSelect label="Signed" value={filterMonth} onChange={setFilterMonth}
          options={monthOptions} allLabel="Any month" />
      </div>

      {/* Small cards -- plain counts, no chart mixed in. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatTile icon={Handshake} label="Executed MoUs" value={filteredDocs.length} />
        <StatTile icon={PartyPopper} label="Verified milestones" value={verifiedMilestones} />
        <StatTile icon={ShieldCheck} label="Confirmed claims" value={confirmedClaims.length} tone="confirmed" />
        <StatTile icon={AlertTriangle} label="Disputed claims" value={disputedClaims.length} tone="disputed" />
        <StatTile icon={Users} label="Confirming partners" value={distinctConfirmingPartners} />
      </div>

      {/* Charts -- two different questions, two different chart shapes.
          Claims composition is a genuine two-category split, well suited
          to a donut. Evidence activation is a single coverage percentage,
          which reads badly as a near-empty ring at low values, so it's a
          horizontal bar instead. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl p-6 bg-white dark:bg-card border border-border">
          <p className="text-[17px] font-semibold text-black dark:text-white mb-1">Claims composition</p>
          <p className="text-[13px] text-black dark:text-white opacity-60 mb-5">Confirmed vs. disputed, among claims you submitted.</p>
          {totalSubmitted > 0 ? (
            <div className="flex items-center gap-6">
              <div className="relative w-[140px] h-[140px] shrink-0">
                <ChartContainer config={claimsChartConfig} className="w-full h-full aspect-square">
                  <PieChart>
                    <Pie data={claimsData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={68} strokeWidth={2}>
                      <Cell fill={CONFIRMED_COLOR} />
                      <Cell fill={DISPUTED_COLOR} />
                    </Pie>
                  </PieChart>
                </ChartContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <p className="text-[21px] font-bold text-black dark:text-white">{disputeRate}%</p>
                  <p className="text-[9px] text-black dark:text-white opacity-60">disputed</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: CONFIRMED_COLOR }} />
                  <p className="text-[15px] text-black dark:text-white">Confirmed ({confirmedClaims.length})</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: DISPUTED_COLOR }} />
                  <p className="text-[15px] text-black dark:text-white">Disputed ({disputedClaims.length})</p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-[15px] text-black dark:text-white">No claims submitted yet.</p>
          )}
          <p className="text-[10px] text-black dark:text-white opacity-60 mt-5 pt-3 border-t border-border">
            Source: claims you submitted, within the current filter.
          </p>
        </div>

        <div className="rounded-xl p-6 bg-white dark:bg-card border border-border">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[17px] font-semibold text-black dark:text-white">Evidence activation</p>
            {evidenceRate !== null && <p className="text-[21px] font-medium text-black dark:text-white">{evidenceRate}%</p>}
          </div>
          <p className="text-[13px] text-black dark:text-white opacity-60 mb-5">Agreed indicators with at least one submitted claim.</p>
          {evidenceRate !== null ? (
            <>
              <ChartContainer config={evidenceChartConfig} className="w-full h-12 aspect-auto">
                <BarChart layout="vertical" data={evidenceBarData} barSize={22}>
                  <XAxis type="number" hide domain={[0, Math.max(filteredIndicators.length, 1)]} />
                  <YAxis type="category" dataKey="name" hide />
                  <Bar dataKey="evidenced" stackId="a" fill={CONFIRMED_COLOR} radius={[6, 0, 0, 6]} />
                  <Bar dataKey="remaining" stackId="a" fill="hsl(var(--muted))" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ChartContainer>
              <p className="text-[15px] text-black dark:text-white mt-3">
                {evidencedIndicators} of {filteredIndicators.length} agreed indicator{filteredIndicators.length !== 1 ? "s" : ""} evidenced
              </p>
            </>
          ) : (
            <p className="text-[15px] text-black dark:text-white">No agreed indicators in this filter.</p>
          )}
          <p className="text-[10px] text-black dark:text-white opacity-60 mt-4 pt-3 border-t border-border">
            Source: submitted claims against agreed indicators, within the current filter.
          </p>
        </div>
      </div>

      <button type="button" onClick={() => navigate("/dashboard/portfolio/milestones")}
        className="text-[13px] text-[#2D6A4F] hover:underline">
        View milestones →
      </button>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options, allLabel }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; allLabel: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-[15px] text-black dark:text-white">{label}:</label>
      <div className="relative">
        <select value={value} onChange={(e) => onChange(e.target.value)}
          className="h-9 pl-3 pr-8 rounded-lg border border-border bg-transparent text-[15px] text-black dark:text-white appearance-none">
          <option value="">{allLabel}</option>
          {options.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
        <ChevronDown className="w-3.5 h-3.5 text-black dark:text-white absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>
    </div>
  );
}

function StatTile({ icon: Icon, label, value, tone }: {
  icon: typeof Handshake; label: string; value: number; tone?: "confirmed" | "disputed";
}) {
  const toneClasses = tone === "confirmed"
    ? "bg-[#2D6A4F]/[0.06] border-[#2D6A4F]/20 text-[#2D6A4F]"
    : tone === "disputed"
    ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-500"
    : "bg-white dark:bg-card border-border text-black dark:text-white";
  return (
    <div className={`rounded-xl p-4 border ${toneClasses}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-3.5 h-3.5" />
        <p className="text-[13px]">{label}</p>
      </div>
      <p className="text-[21px] font-medium">{value}</p>
    </div>
  );
}
