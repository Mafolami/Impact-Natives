import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { Loader2, ShieldCheck, AlertTriangle, Users, Handshake, PartyPopper } from "lucide-react";

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

  return (
    <div className="space-y-8">
      {/* Verification — the platform's core differentiator: an
          independently-confirmed track record, not a self-reported one. */}
      <div>
        <p className="text-base font-semibold text-black dark:text-white mb-4">Verification</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl p-4 bg-[#2D6A4F]/[0.06] border border-[#2D6A4F]/20">
            <div className="flex items-center gap-1.5 mb-1">
              <ShieldCheck className="w-3.5 h-3.5 text-[#2D6A4F]" />
              <p className="text-xs text-[#2D6A4F]">Confirmed claims</p>
            </div>
            <p className="text-xl font-medium text-[#2D6A4F]">{summary.confirmed_claims}</p>
          </div>
          <div className="rounded-xl p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40">
            <div className="flex items-center gap-1.5 mb-1">
              <AlertTriangle className="w-3.5 h-3.5 text-red-600 dark:text-red-500" />
              <p className="text-xs text-red-600 dark:text-red-500">Disputed claims</p>
            </div>
            <p className="text-xl font-medium text-red-600 dark:text-red-500">
              {summary.disputed_claims}
              {disputeRate !== null && (
                <span className="text-xs font-normal ml-1.5">({disputeRate}% of submitted)</span>
              )}
            </p>
          </div>
          <div className="rounded-xl p-4 bg-white dark:bg-card border border-border">
            <div className="flex items-center gap-1.5 mb-1">
              <Users className="w-3.5 h-3.5 text-black dark:text-white" />
              <p className="text-xs text-black dark:text-white">Distinct confirming partners</p>
            </div>
            <p className="text-xl font-medium text-black dark:text-white">{summary.distinct_confirming_partners}</p>
          </div>
        </div>
      </div>

      {/* Evidence activation — this signal doesn't exist anywhere else:
          agreed indicators that were actually followed through with a
          claim, not just agreed to on paper. */}
      <div className="rounded-xl p-6 bg-white dark:bg-card border border-border">
        <div className="flex items-center justify-between mb-1">
          <p className="text-base font-semibold text-black dark:text-white">Evidence activation</p>
          {evidenceRate !== null && (
            <p className="text-xl font-medium text-black dark:text-white">{evidenceRate}%</p>
          )}
        </div>
        <p className="text-xs text-black dark:text-white opacity-60 mb-6">Agreed indicators with at least one submitted claim.</p>
        {evidenceRate !== null ? (
          <>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-[#2D6A4F] transition-all duration-500" style={{ width: `${evidenceRate}%` }} />
            </div>
            <p className="text-sm text-black dark:text-white mt-3">
              {summary.evidenced_indicators} of {summary.agreed_indicators} agreed indicator{summary.agreed_indicators !== 1 ? "s" : ""} evidenced
            </p>
          </>
        ) : (
          <p className="text-sm text-black dark:text-white">No agreed indicators yet.</p>
        )}
      </div>

      {/* Partnerships and delivery — the underlying activity that
          verification and evidence activation sit on top of. */}
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
