import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { PieChart, Pie, Cell, RadialBarChart, RadialBar, PolarAngleAxis } from "recharts";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { Loader2, ShieldCheck, Handshake, PartyPopper } from "lucide-react";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";

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

const CONFIRMED_COLOR = "#2D6A4F";
const DISPUTED_COLOR = "#dc2626";

// Minimal config -- ChartContainer requires one, but Cell/RadialBar fills
// below are hardcoded hex, not var(--color-x) lookups. This is the first
// real usage of the shadcn chart wrapper anywhere in the app, so kept
// deliberately simple rather than relying on the generic tooltip/legend
// config-key mapping, which needs a working build to verify against.
const verificationChartConfig: ChartConfig = {
  confirmed: { label: "Confirmed", color: CONFIRMED_COLOR },
  disputed: { label: "Disputed", color: DISPUTED_COLOR },
};
const evidenceChartConfig: ChartConfig = {
  evidenced: { label: "Evidenced", color: CONFIRMED_COLOR },
};

export default function DashboardPortfolioTrackRecord() {
  const { orgOwnerId } = useAuth();
  const [, navigate] = useLocation();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<TrackRecordSummary | null>(null);

  useEffect(() => { load(); }, [orgOwnerId]);

  async function load() {
    if (!orgOwnerId) return;
    setLoading(true);
    const { data: myOrg } = await supabase.from("organizations").select("id").eq("user_id", orgOwnerId).maybeSingle();
    if (!myOrg) { setLoading(false); return; }
    const { data } = await supabase.rpc("get_track_record_summary", { p_org_id: myOrg.id });
    setSummary((data as TrackRecordSummary[])?.[0] ?? null);
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 text-[#2D6A4F] animate-spin" />
      </div>
    );
  }

  if (!summary) {
    return <p className="text-sm text-black dark:text-white">Unable to load track record data.</p>;
  }

  const disputeRate = summary.total_submitted_claims > 0
    ? Math.round((summary.disputed_claims / summary.total_submitted_claims) * 100)
    : null;

  const evidenceRate = summary.agreed_indicators > 0
    ? Math.round((summary.evidenced_indicators / summary.agreed_indicators) * 100)
    : null;

  const verificationData = [
    { name: "Confirmed", value: summary.confirmed_claims },
    { name: "Disputed", value: summary.disputed_claims },
  ];

  return (
    <div className="space-y-8">
      {/* Verification — the platform's core differentiator: an
          independently-confirmed track record, not a self-reported one. */}
      <div>
        <p className="text-base font-semibold text-black dark:text-white mb-4">Verification</p>
        <div className="rounded-xl p-6 bg-white dark:bg-card border border-border grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
          {summary.total_submitted_claims > 0 ? (
            <div className="relative mx-auto aspect-square max-h-[200px] w-full">
              <ChartContainer config={verificationChartConfig} className="mx-auto aspect-square max-h-[200px]">
                <PieChart>
                  <Pie data={verificationData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} strokeWidth={2}>
                    <Cell fill={CONFIRMED_COLOR} />
                    <Cell fill={DISPUTED_COLOR} />
                  </Pie>
                </PieChart>
              </ChartContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <p className="text-2xl font-bold text-black dark:text-white">{disputeRate}%</p>
                <p className="text-[10px] text-black dark:text-white opacity-60">disputed</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-black dark:text-white">No claims submitted yet.</p>
          )}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: CONFIRMED_COLOR }} />
              <p className="text-sm text-black dark:text-white flex-1">Confirmed claims</p>
              <p className="text-sm font-medium text-black dark:text-white">{summary.confirmed_claims}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: DISPUTED_COLOR }} />
              <p className="text-sm text-black dark:text-white flex-1">Disputed claims</p>
              <p className="text-sm font-medium text-black dark:text-white">{summary.disputed_claims}</p>
            </div>
            <div className="flex items-center gap-2 pt-2 border-t border-border">
              <ShieldCheck className="w-3.5 h-3.5 text-black dark:text-white shrink-0" />
              <p className="text-sm text-black dark:text-white flex-1">Distinct confirming partners</p>
              <p className="text-sm font-medium text-black dark:text-white">{summary.distinct_confirming_partners}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Evidence activation — this signal doesn't exist anywhere else:
          agreed indicators that were actually followed through with a
          claim, not just agreed to on paper. */}
      <div className="rounded-xl p-6 bg-white dark:bg-card border border-border grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
        {evidenceRate !== null ? (
          <div className="relative mx-auto aspect-square max-h-[180px] w-full">
            <ChartContainer config={evidenceChartConfig} className="mx-auto aspect-square max-h-[180px]">
              <RadialBarChart
                innerRadius="72%"
                outerRadius="100%"
                barSize={14}
                data={[{ value: evidenceRate }]}
                startAngle={90}
                endAngle={-270}
              >
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                <RadialBar background dataKey="value" cornerRadius={8} fill={CONFIRMED_COLOR} />
              </RadialBarChart>
            </ChartContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <p className="text-2xl font-bold text-black dark:text-white">{evidenceRate}%</p>
              <p className="text-[10px] text-black dark:text-white opacity-60">evidenced</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-black dark:text-white">No agreed indicators yet.</p>
        )}
        <div>
          <p className="text-base font-semibold text-black dark:text-white mb-1">Evidence activation</p>
          <p className="text-xs text-black dark:text-white opacity-60 mb-3">Agreed indicators with at least one submitted claim.</p>
          {evidenceRate !== null && (
            <p className="text-sm text-black dark:text-white">
              {summary.evidenced_indicators} of {summary.agreed_indicators} agreed indicator{summary.agreed_indicators !== 1 ? "s" : ""} evidenced
            </p>
          )}
        </div>
      </div>

      {/* Partnerships and delivery — single counts, no meaningful
          composition to chart against. */}
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
    </div>
  );
}
