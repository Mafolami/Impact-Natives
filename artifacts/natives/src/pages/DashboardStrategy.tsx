import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { Sparkles, Upload } from "lucide-react";
import { ImpactStrategyPane } from "@/components/platform/ImpactStrategyPane";
import { UploadStrategyPane } from "@/components/platform/UploadStrategyPane";

type StrategyTab = "build" | "upload";

export default function DashboardStrategy() {
  const { user, profile } = useAuth();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [tab, setTab] = useState<StrategyTab>("build");

  useEffect(() => {
    if (!user) return;
    supabase
      .from("organizations")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => { if (data?.id) setOrgId(data.id); });
  }, [user]);

  if (!orgId) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Impact Strategy</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Build or upload your social impact strategy, then push pillars to the marketplace as partner requests.
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 rounded-lg bg-muted w-fit">
        {([
          { key: "build" as const,  label: "Build from scratch", icon: Sparkles },
          { key: "upload" as const, label: "Upload strategy",    icon: Upload   },
        ]).map(({ key, label, icon: Icon }) => (
          <button key={key} type="button"
            onClick={() => setTab(key)}
            className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}>
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {tab === "build" && <ImpactStrategyPane organizationId={orgId} />}
      {tab === "upload" && <UploadStrategyPane organizationId={orgId} operatingCountry={profile?.country ?? ""} />}
    </div>
  );
}