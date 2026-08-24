import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { BarChart, Bar, XAxis, YAxis } from "recharts";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { Loader2, Handshake, PartyPopper, ChevronDown } from "lucide-react";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { resolveMouDocTitle } from "@/lib/mouTitle";

interface TrackRecordSummary {
  confirmed_claims: number;
  disputed_claims: number;
  total_submitted_claims: number;
  distinct_confirming_partners: number;
  agreed_indicators: number;
  evidenced_indicators: number;
  executed_mous: number;
  verified_milestones: number;
}

interface ExecutedDoc {
  id: string;
  org_a_id: string;
  org_b_id: string;
  initiative_id: string | null;
  connection_id: string | null;
  toggle_selections: Record<string, string | boolean> | null;
}

interface OrgRef {
  id: string;
  user_id: string;
  organisation_name: string;
  partnership_sought?: string | null;
}

const EVIDENCED_COLOR = "#2D6A4F";

// Minimal config -- ChartContainer requires one; the actual fills below
// are hardcoded hex/CSS-var, not looked up through config.
const evidenceChartConfig: ChartConfig = {
  evidenced: { label: "Evidenced", color: EVIDENCED_COLOR },
  remaining: { label: "Remaining", color: "hsl(var(--muted))" },
};

export default function DashboardPortfolioTrackRecord() {
  const { orgOwnerId } = useAuth();
  const [, navigate] = useLocation();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<TrackRecordSummary | null>(null);
  const [myOrgId, setMyOrgId] = useState<string | null>(null);
  const [docs, setDocs] = useState<ExecutedDoc[]>([]);
  const [orgMap, setOrgMap] = useState<Record<string, OrgRef>>({});
  const [initiativeTitleMap, setInitiativeTitleMap] = useState<Record<string, string>>({});
  const [scopedDocId, setScopedDocId] = useState<string>("");

  useEffect(() => { loadAgreements(); }, [orgOwnerId]);
  useEffect(() => { loadSummary(); }, [myOrgId, scopedDocId]);

  async function loadAgreements() {
    if (!orgOwnerId) return;
    const { data: myOrg } = await supabase.from("organizations").select("id").eq("user_id", orgOwnerId).maybeSingle();
    if (!myOrg) { setLoading(false); return; }
    setMyOrgId(myOrg.id);

    const { data: docRows } = await supabase
      .from("mou_documents")
      .select("id, org_a_id, org_b_id, initiative_id, connection_id, toggle_selections")
      .or(`org_a_id.eq.${myOrg.id},org_b_id.eq.${myOrg.id}`)
      .eq("status", "fully_executed");
    setDocs((docRows as ExecutedDoc[]) ?? []);

    const orgIds = [...new Set((docRows ?? []).flatMap((d: any) => [d.org_a_id, d.org_b_id]))];
    if (orgIds.length > 0) {
      const { data: orgs } = await supabase.from("organizations").select("id, user_id, organisation_name, partnership_sought").in("id", orgIds);
      const map: Record<string, OrgRef> = {};
      (orgs ?? []).forEach((o: any) => { map[o.id] = o; });
      setOrgMap(map);
    }

    const initIds = [...new Set((docRows ?? []).map((d: any) => d.initiative_id).filter((x: any): x is string => !!x))];
    if (initIds.length > 0) {
      const { data: inits } = await supabase.from("initiative_requests").select("id, title").in("id", initIds);
      const titleMap: Record<string, string> = {};
      (inits ?? []).forEach((i: any) => { titleMap[i.id] = i.title; });
      setInitiativeTitleMap(titleMap);
    }
  }

  async function loadSummary() {
    if (!myOrgId) return;
    setLoading(true);
    const { data } = await supabase.rpc("get_track_record_summary", {
      p_org_id: myOrgId,
      p_mou_document_id: scopedDocId || null,
    });
    setSummary((data as TrackRecordSummary[])?.[0] ?? null);
    setLoading(false);
  }

  function partnerOrgIdFor(doc: ExecutedDoc): string {
    return doc.org_a_id === myOrgId ? doc.org_b_id : doc.org_a_id;
  }

  const agreementOptions = useMemo(() => {
    return docs
      .map((d) => ({
        id: d.id,
        label: `${orgMap[partnerOrgIdFor(d)]?.organisation_name ?? "Partner"} — ${resolveMouDocTitle(d, orgMap, initiativeTitleMap) ?? "Partnership"}`,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [docs, orgMap, initiativeTitleMap, myOrgId]);

  if (loading && !summary) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 text-[#2D6A4F] animate-spin" />
      </div>
    );
  }

  if (!summary) {
    return <p className="text-sm text-black dark:text-white">Unable to load track record data.</p>;
  }

  const evidenceRate = summary.agreed_indicators > 0
    ? Math.round((summary.evidenced_indicators / summary.agreed_indicators) * 100)
    : null;

  const evidenceBarData = [{
    name: "evidence",
    evidenced: summary.evidenced_indicators,
    remaining: Math.max(summary.agreed_indicators - summary.evidenced_indicators, 0),
  }];

  return (
    <div className="space-y-8">
      {/* Filter -- scopes every figure on the page to one agreement, same
          pattern as the "Viewing:" picker on the Milestones page. */}
      <div className="flex items-center gap-2">
        <label htmlFor="track-record-scope" className="text-sm text-black dark:text-white">Viewing:</label>
        <div className="relative">
          <select
            id="track-record-scope"
            value={scopedDocId}
            onChange={(e) => setScopedDocId(e.target.value)}
            className="h-10 pl-3 pr-8 rounded-lg border border-border bg-transparent text-sm text-black dark:text-white appearance-none"
          >
            <option value="">All agreements</option>
            {agreementOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>{opt.label}</option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-black dark:text-white absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* Cards -- single counts with nothing to chart against. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl p-6 bg-white dark:bg-card border border-border">
          <div className="flex items-center gap-1.5 mb-1">
            <Handshake className="w-4 h-4 text-black dark:text-white" />
            <p className="text-base font-semibold text-black dark:text-white">Executed MoUs</p>
          </div>
          <p className="text-xl font-medium text-black dark:text-white mt-2">{summary.executed_mous}</p>
        </div>
        <div className="rounded-xl p-6 bg-white dark:bg-card border border-border">
          <div className="flex items-center gap-1.5 mb-1">
            <PartyPopper className="w-4 h-4 text-black dark:text-white" />
            <p className="text-base font-semibold text-black dark:text-white">Verified milestones</p>
          </div>
          <p className="text-xl font-medium text-black dark:text-white mt-2">{summary.verified_milestones}</p>
          <button type="button" onClick={() => navigate("/dashboard/portfolio/milestones")}
            className="text-xs text-[#2D6A4F] hover:underline mt-2">
            View milestones →
          </button>
        </div>
      </div>

      {/* Charts -- grid set up for two columns so a second chart-worthy
          metric can sit alongside this one later without restructuring. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl p-6 bg-white dark:bg-card border border-border">
          <div className="flex items-center justify-between mb-1">
            <p className="text-base font-semibold text-black dark:text-white">Evidence activation</p>
            {evidenceRate !== null && (
              <p className="text-xl font-medium text-black dark:text-white">{evidenceRate}%</p>
            )}
          </div>
          <p className="text-xs text-black dark:text-white opacity-60 mb-5">Agreed indicators with at least one submitted claim.</p>
          {evidenceRate !== null ? (
            <>
              <ChartContainer config={evidenceChartConfig} className="w-full h-12 aspect-auto">
                <BarChart layout="vertical" data={evidenceBarData} barSize={22}>
                  <XAxis type="number" hide domain={[0, Math.max(summary.agreed_indicators, 1)]} />
                  <YAxis type="category" dataKey="name" hide />
                  <Bar dataKey="evidenced" stackId="a" fill={EVIDENCED_COLOR} radius={[6, 0, 0, 6]} />
                  <Bar dataKey="remaining" stackId="a" fill="hsl(var(--muted))" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ChartContainer>
              <p className="text-sm text-black dark:text-white mt-3">
                {summary.evidenced_indicators} of {summary.agreed_indicators} agreed indicator{summary.agreed_indicators !== 1 ? "s" : ""} evidenced
              </p>
            </>
          ) : (
            <p className="text-sm text-black dark:text-white">No agreed indicators yet.</p>
          )}
          <p className="text-[10px] text-black dark:text-white opacity-60 mt-4 pt-3 border-t border-border">
            Source: submitted claims against agreed indicators on executed MoUs.
          </p>
        </div>
      </div>
    </div>
  );
}
