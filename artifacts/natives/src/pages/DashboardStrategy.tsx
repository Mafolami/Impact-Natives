import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { Sparkles, Upload, Lightbulb } from "lucide-react";
import { ImpactStrategyPane } from "@/components/platform/ImpactStrategyPane";
import { UploadStrategyPane } from "@/components/platform/UploadStrategyPane";
import { DraftInitiativesPane } from "@/components/platform/DraftInitiativesPane";

type StrategyTab = "build" | "upload" | "initiatives";

export default function DashboardStrategy() {
  const { orgOwnerId } = useAuth();
  const [orgId, setOrgId]                   = useState<string | null>(null);
  const [orgCountry, setOrgCountry]         = useState<string>("");
  const [tab, setTab]                       = useState<StrategyTab>("build");

  useEffect(() => {
    if (!orgOwnerId) return;
    supabase
      .from("organizations")
      .select("id,country")
      .eq("user_id", orgOwnerId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.id) setOrgId(data.id);
        if (data?.country) {
          let countryVal = data.country;
          try {
            const parsed = JSON.parse(data.country);
            if (Array.isArray(parsed) && parsed.length > 0) {
              countryVal = parsed[0];
            }
          } catch {
            // not JSON, use raw string as-is
          }
          setOrgCountry(countryVal);
        }
      });
  }, [orgOwnerId]);

  if (!orgId) return null;

  return (
    <div className="space-y-6">
      {/* Tab switcher */}
      <div className="flex gap-1 p-1 rounded-lg bg-muted w-fit">
        {([
          { key: "build"        as const, label: "Build from scratch", icon: Sparkles  },
          { key: "upload"       as const, label: "Upload strategy",    icon: Upload    },
          { key: "initiatives"  as const, label: "Initiatives",        icon: Lightbulb },
        ]).map(({ key, label, icon: Icon }) => (
          <button key={key} type="button"
            onClick={() => setTab(key)}
            className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === key
                ? "bg-white dark:bg-card text-black dark:text-white shadow-sm"
                : "text-black dark:text-white hover:text-[#2D6A4F]"
            }`}>
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {tab === "build"       && <ImpactStrategyPane organizationId={orgId} />}
    {tab === "upload"        && <UploadStrategyPane organizationId={orgId} operatingCountry={orgCountry} />}
      {tab === "initiatives" && <DraftInitiativesPane orgOwnerId={orgOwnerId!} onPublished={() => setTab("initiatives")} />}
    </div>
  );
}