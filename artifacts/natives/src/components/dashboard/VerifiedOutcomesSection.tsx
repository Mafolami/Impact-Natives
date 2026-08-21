
import { useState, useEffect } from "react";

import { supabase } from "@/lib/supabase";

import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

interface VerifiedOutcome {

  claim_id: string;

  indicator_name: string;

  claim_text: string;

  indicator_value: string;

  status: "confirmed" | "disputed";

  confirmed_at: string | null;

  disputed_at: string | null;

  dispute_reason: string | null;

  partner_org_name: string;

  mou_document_id: string;

}

export default function VerifiedOutcomesSection({ orgId, variant = "panel" }: { orgId: string; variant?: "panel" | "page" }) {

  const [loading, setLoading] = useState(true);

  const [outcomes, setOutcomes] = useState<VerifiedOutcome[]>([]);

  useEffect(() => {

    let cancelled = false;

    setLoading(true);

    supabase.rpc("get_verified_outcomes_for_org", { p_org_id: orgId }).then(({ data }) => {

      if (!cancelled) {

        setOutcomes((data as VerifiedOutcome[]) ?? []);

        setLoading(false);

      }

    });

    return () => { cancelled = true; };

  }, [orgId]);

  // Nothing to show yet -- distinct from "still loading," but neither

  // state should push the surrounding profile layout around, so this

  // renders nothing rather than an empty-state card. A profile with no

  // verified outcomes yet shouldn't read as broken or incomplete --

  // most orgs won't have any until partnerships mature.

  if (!loading && outcomes.length === 0) return null;

  const confirmedCount = outcomes.filter((o) => o.status === "confirmed").length;

  const disputedCount = outcomes.filter((o) => o.status === "disputed").length;

  const content = (

    <>

      <div className="flex items-center justify-between mb-4">

        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-black dark:text-white">Verified outcomes</p>

        {!loading && (

          <span className="text-xs font-bold" style={{ color: confirmedCount > 0 ? "#065F46" : "#92400E" }}>

            {confirmedCount} confirmed{disputedCount > 0 ? ` · ${disputedCount} disputed` : ""}

          </span>

        )}

      </div>

      {loading ? (

        <div className="flex items-center gap-2 text-xs text-black dark:text-white">

          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading verified outcomes...

        </div>

      ) : (

        <div className="space-y-2.5">

          {outcomes.map((o) => (

            <div key={o.claim_id} className={`rounded-xl border px-4 py-3 ${

              o.status === "confirmed" ? "border-[#2D6A4F]/20 bg-[#2D6A4F]/[0.04]" : "border-red-200 bg-red-50 dark:bg-red-950/10"

            }`}>

              <div className="flex items-start justify-between gap-3">

                <div className="flex-1 min-w-0">

                  <p className="text-sm font-semibold text-foreground">{o.indicator_name}</p>

                  <p className="text-xs text-black dark:text-white mt-0.5">{o.claim_text}</p>

                  <p className="text-xs font-medium text-foreground mt-1">Result: {o.indicator_value}</p>

                  <p className="text-[11px] text-black dark:text-white mt-1.5">

                    Verified by {o.partner_org_name}

                    {o.confirmed_at && ` · ${new Date(o.confirmed_at).toLocaleDateString("en-GB")}`}

                  </p>

                  {o.status === "disputed" && o.dispute_reason && (

                    <p className="text-xs text-red-700 dark:text-red-400 mt-1.5">Disputed: {o.dispute_reason}</p>

                  )}

                </div>

                {o.status === "confirmed" ? (

                  <CheckCircle2 className="w-4 h-4 text-[#2D6A4F] shrink-0 mt-0.5" />

                ) : (

                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />

                )}

              </div>

            </div>

          ))}

        </div>

      )}

    </>

  );

  // Matches the Section wrapper used for the page variant's DD readiness

  // block, and the plain px-8 py-6 div used in the panel variant's --

  // this component doesn't own its own wrapper choice, it takes whichever

  // container convention the calling section already uses.

  if (variant === "page") {

    return <div className="rounded-xl border border-border bg-card px-5 py-4">{content}</div>;

  }

  return <div className="px-8 py-6 border-t border-border">{content}</div>;

}

