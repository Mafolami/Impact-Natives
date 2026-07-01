import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext"; // adjust import to your actual auth hook path
import { supabase } from "@/lib/supabase"; // adjust to your actual client path

type Pillar = {
  pillar_name: string;
  corporate_input: string;
  direct_output: string;
  target_demographics: string;
  measurable_outcome: string;
  long_term_impact: string;
  un_sdg_code: string;
  sasb_material_topic: string;
  au_agenda_2063_goal: string | null;
  compliance_note: string;
};

type FormState = {
  industry_sector: string;
  operating_country: string;
  core_assets: string;
  csi_budget: string;
};

const SUPPORTED_SECTORS = [
  { value: "technology_fintech", label: "Technology / FinTech" },
  { value: "telecommunications", label: "Telecommunications" },
];

export function ImpactStrategyPane({ organizationId }: { organizationId: string }) {
  const [form, setForm] = useState<FormState>({
    industry_sector: "",
    operating_country: "",
    core_assets: "",
    csi_budget: "",
  });
  const [pillars, setPillars] = useState<Pillar[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadExistingStrategy();
  }, [organizationId]);

  async function loadExistingStrategy() {
    const { data, error } = await supabase
      .from("organizations")
      .select("impact_strategy")
      .eq("id", organizationId)
      .single();

    if (error || !data?.impact_strategy) return;

    try {
      const parsed = JSON.parse(data.impact_strategy);
      if (parsed?.pillars) setPillars(parsed.pillars);
    } catch {
      // stored value is malformed — skip, treat as no strategy yet
    }
  }

  async function handleGenerate() {
    if (!form.industry_sector || !form.operating_country) {
      setError("Sector and operating country are required.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-impact-strategy`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            organization_id: organizationId,
            ...form,
          }),
        }
      );

      const json = await res.json();

      if (!res.ok) {
        setError(json.message || "Strategy generation failed. Try again.");
        return;
      }

      setPillars(json.pillars);
    } catch (err) {
      setError("Could not reach the strategy generator. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {!pillars && (
        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-[0.12em]">
              Industry Sector
            </label>
            <select
              className="w-full mt-1 rounded border p-2"
              value={form.industry_sector}
              onChange={(e) => setForm({ ...form, industry_sector: e.target.value })}
            >
              <option value="">Select sector</option>
              {SUPPORTED_SECTORS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              Strategy Builder currently supports Technology/FinTech and Telecommunications only.
              Other sectors are on the roadmap.
            </p>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-[0.12em]">
              Operating Country
            </label>
            <input
              className="w-full mt-1 rounded border p-2"
              placeholder="e.g. Nigeria"
              value={form.operating_country}
              onChange={(e) => setForm({ ...form, operating_country: e.target.value })}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Regulatory compliance mapping is currently verified for Nigeria only. Other
              countries will still generate a strategy, flagged as compliance-pending.
            </p>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-[0.12em]">
              Core Competencies / Assets
            </label>
            <textarea
              className="w-full mt-1 rounded border p-2"
              placeholder="e.g. Cell towers, mobile money infrastructure, employee volunteer hours"
              value={form.core_assets}
              onChange={(e) => setForm({ ...form, core_assets: e.target.value })}
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-[0.12em]">
              CSI Budget or Target
            </label>
            <input
              className="w-full mt-1 rounded border p-2"
              placeholder="e.g. ₦50M or 2% of PBT"
              value={form.csi_budget}
              onChange={(e) => setForm({ ...form, csi_budget: e.target.value })}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="rounded px-4 py-2 font-semibold"
            style={{ backgroundColor: "#2D6A4F", color: "white" }}
          >
            {loading ? "Generating strategy..." : "Generate Strategy"}
          </button>
        </div>
      )}

      {pillars && (
        <div className="space-y-4">
          <button
            onClick={() => setPillars(null)}
            className="text-sm underline"
            style={{ color: "#C45C26" }}
          >
            Generate a new strategy
          </button>

          {pillars.map((pillar, i) => (
            <div
              key={i}
              className="rounded-lg p-4"
              style={{
                background: "linear-gradient(135deg, rgba(45,106,79,0.08) 0%, rgba(45,106,79,0.02) 100%)",
                border: "1px solid rgba(45,106,79,0.18)",
              }}
            >
              <h3 className="font-bold text-lg mb-2">{pillar.pillar_name}</h3>
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-[0.12em]">Input</dt>
                  <dd>{pillar.corporate_input}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-[0.12em]">Output</dt>
                  <dd>{pillar.direct_output}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-[0.12em]">Outcome</dt>
                  <dd>{pillar.measurable_outcome}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-[0.12em]">
                    SDG Alignment
                  </dt>
                  <dd>{pillar.un_sdg_code}</dd>
                </div>
                {pillar.au_agenda_2063_goal && (
                  <div>
                    <dt className="text-[10px] font-bold uppercase tracking-[0.12em]">
                      AU Agenda 2063
                    </dt>
                    <dd>{pillar.au_agenda_2063_goal}</dd>
                  </div>
                )}
                {pillar.compliance_note && (
                  <p className="text-xs italic text-muted-foreground">{pillar.compliance_note}</p>
                )}
              </dl>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}