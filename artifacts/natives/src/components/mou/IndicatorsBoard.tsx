
import { useState, useEffect } from "react";

import { Loader2, Clock, CheckCircle2 } from "lucide-react";

import { PartnershipIndicator, isIndicatorAgreed, fetchIndicators } from "@/lib/indicators";

interface IndicatorsBoardProps {

  mouDocumentId: string;

}

// Mirrors KanbanBoard's visual pattern (rounded-xl border columns, header

// with icon + count pill, white/dark-card body) but with two columns

// instead of four -- indicators have a binary agreement state, not a

// multi-stage status like milestones.

export default function IndicatorsBoard({ mouDocumentId }: IndicatorsBoardProps) {

  const [loading, setLoading] = useState(true);

  const [indicators, setIndicators] = useState<PartnershipIndicator[]>([]);

  useEffect(() => {

    let cancelled = false;

    setLoading(true);

    fetchIndicators(mouDocumentId).then((rows) => {

      if (!cancelled) {

        setIndicators(rows);

        setLoading(false);

      }

    });

    return () => { cancelled = true; };

  }, [mouDocumentId]);

  const columns = [

    {

      key: "pending", label: "Awaiting agreement", predicate: (i: PartnershipIndicator) => !isIndicatorAgreed(i),

      icon: Clock, border: "border-amber-200 dark:border-amber-900/40", headerBg: "bg-amber-50 dark:bg-amber-950/20", text: "text-amber-600 dark:text-amber-500",

    },

    {

      key: "agreed", label: "Agreed", predicate: (i: PartnershipIndicator) => isIndicatorAgreed(i),

      icon: CheckCircle2, border: "border-[#2D6A4F]/20", headerBg: "bg-[#2D6A4F]/[0.06]", text: "text-[#2D6A4F]",

    },

  ];

  if (loading) {

    return (

      <div className="flex items-center justify-center py-8">

        <Loader2 className="w-5 h-5 text-[#2D6A4F] animate-spin" />

      </div>

    );

  }

  if (indicators.length === 0) {

    return (

      <p className="text-xs text-black dark:text-white py-2">

        No indicators yet for this agreement.

      </p>

    );

  }

  return (

    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

      {columns.map((col) => {

        const colItems = indicators.filter(col.predicate);

        const Icon = col.icon;

        return (

          <div key={col.key} className={`rounded-xl border ${col.border} overflow-hidden`}>

            <div className={`flex items-center gap-2 px-3 py-2.5 border-b ${col.border} ${col.headerBg}`}>

              <Icon className={`w-4 h-4 ${col.text}`} />

              <p className={`text-sm font-semibold ${col.text}`}>{col.label}</p>

              <span className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full border ${col.border} ${col.text} bg-white dark:bg-card`}>

                {colItems.length}

              </span>

            </div>

            <div className="p-3 space-y-2 bg-white dark:bg-card min-h-[64px]">

              {colItems.length === 0 ? (

                <p className="text-xs text-black dark:text-white">Nothing here.</p>

              ) : (

                colItems.map((indicator) => (

                  <div key={indicator.id} className="rounded-lg border border-border p-3 bg-white dark:bg-card">

                    <p className="text-sm font-medium text-black dark:text-white">{indicator.name}</p>

                    <p className="text-xs text-black dark:text-white mt-0.5">

                      Target: {indicator.target_value} · {indicator.measurement_window}

                    </p>

                  </div>

                ))

              )}

            </div>

          </div>

        );

      })}

    </div>

  );

}

