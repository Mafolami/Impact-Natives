import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext"; // adjust import to your actual auth hook path
import { supabase } from "@/lib/supabase"; // adjust to your actual client path

type ExecutiveSummary = {
  introduction: string;
  problem_statement: string;
  strategic_approach: string;
  impact_goals: string;
  target_beneficiaries: string;
  regulatory_alignment: string;
  budget_allocation: string;
  next_steps: string;
};

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
  specific_ask_draft: string;
  suggested_partnerships: string[];
  pushed?: boolean;
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
  const [executiveSummary, setExecutiveSummary] = useState<ExecutiveSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pushingIndex, setPushingIndex]   = useState<number | null>(null);
  const [pushError, setPushError]         = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError]   = useState<string | null>(null);
  const [chatOpen, setChatOpen]             = useState(true);
  const [chatInput, setChatInput]           = useState("");
  const [chatMessages, setChatMessages]     = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [chatLoading, setChatLoading]       = useState(false);
  const [chatError, setChatError]           = useState<string | null>(null);
  const [previousPillars, setPreviousPillars] = useState<Pillar[] | null>(null);
  const [orgName, setOrgName]             = useState<string | null>(null);

  useEffect(() => {
    loadExistingStrategy();
  }, [organizationId]);

  async function loadExistingStrategy() {
    const { data, error } = await supabase
      .from("organizations")
      .select("impact_strategy,name")
      .eq("id", organizationId)
      .single();

    if (error || !data?.impact_strategy) return;

    try {
      const parsed = JSON.parse(data.impact_strategy);
      if (parsed?.pillars) setPillars(parsed.pillars);
      if (parsed?.executive_summary) setExecutiveSummary(parsed.executive_summary);
      if (data.name) setOrgName(data.name);
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

  async function handleGenerateSummary() {
    if (!pillars) return;
    setSummaryLoading(true);
    setSummaryError(null);
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
            action: "generate_executive_summary",
            organization_id: organizationId,
            pillars,
            operating_country: form.operating_country,
            csi_budget: form.csi_budget,
            org_name: orgName ?? "Not specified",
            sector_label: form.industry_sector === "technology_fintech"
              ? "Technology / FinTech"
              : form.industry_sector === "telecommunications"
              ? "Telecommunications"
              : form.industry_sector,
          }),
        }
      );
      const json = await res.json();
      if (!res.ok) {
        setSummaryError(json.error ?? "Could not generate summary. Try again.");
        return;
      }
      setExecutiveSummary(json.executive_summary);
    } catch {
      setSummaryError("Could not reach the server. Try again.");
    } finally {
      setSummaryLoading(false);
    }
  }

  async function handleChat() {
    if (!pillars || !chatInput.trim()) return;
    const userMessage = { role: "user" as const, content: chatInput.trim() };
    const updatedMessages = [...chatMessages, userMessage];
    setChatMessages(updatedMessages);
    setChatInput("");
    setChatLoading(true);
    setChatError(null);
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
            action: "refine_strategy",
            organization_id: organizationId,
            pillars,
            messages: updatedMessages,
            operating_country: form.operating_country,
            industry_sector: form.industry_sector,
          }),
        }
      );
      const json = await res.json();
      if (!res.ok) {
        setChatError(json.message || "Something went wrong. Try again.");
        setChatMessages(prev => prev.slice(0, -1));
        return;
      }
      setChatMessages(prev => [...prev, { role: "assistant", content: json.reply }]);
      if (json.pillars) {
        setPreviousPillars(pillars);
        setPillars(json.pillars);
        if (executiveSummary) setExecutiveSummary(null);
      }
    } catch {
      setChatError("Could not reach the server. Check your connection and try again.");
      setChatMessages(prev => prev.slice(0, -1));
    } finally {
      setChatLoading(false);
    }
  }

  async function handlePushPillar(pillar: Pillar, index: number) {
    setPushingIndex(index);
    setPushError(null);

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
            action: "push_pillar",
            organization_id: organizationId,
            pillar: { ...pillar, operating_region: form.operating_country },
          }),
        }
      );

      const json = await res.json();

      if (!res.ok) {
        setPushError(json.error || "Could not push this pillar to Initiatives.");
        return;
      }

      const updatedPillars = pillars
        ? pillars.map((p, i) => (i === index ? { ...p, pushed: true } : p))
        : null;

      if (updatedPillars) {
        await supabase
          .from("organizations")
          .update({
            impact_strategy: JSON.stringify({
              pillars: updatedPillars,
              executive_summary: executiveSummary,
            }),
          })
          .eq("id", organizationId);
      }

      setPillars(updatedPillars);
    } catch {
      setPushError("Could not reach the server. Check your connection and try again.");
    } finally {
      setPushingIndex(null);
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
          <div className="flex items-center gap-4 flex-wrap">
            <button
              onClick={() => { setPillars(null); setExecutiveSummary(null); setChatOpen(false); setChatMessages([]); }}
              className="text-sm underline"
              style={{ color: "#C45C26" }}
            >
              Generate a new strategy
            </button>
            <button
              onClick={() => setChatOpen(o => !o)}
              className="text-sm underline"
              style={{ color: "#2D6A4F" }}
            >
              {chatOpen ? "Hide advisor" : "Show advisor"}
            </button>
            {previousPillars && (
              <button
                onClick={() => { setPillars(previousPillars); setPreviousPillars(null); }}
                className="text-sm underline"
                style={{ color: "#888" }}
              >
                Undo last change
              </button>
            )}
          </div>
          {!executiveSummary && (
            <div className="rounded-xl border border-dashed border-[#2D6A4F]/30 p-5 text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                Pillars confirmed. Generate your executive summary when ready.
              </p>
              {summaryError && <p className="text-xs text-red-600">{summaryError}</p>}
              <button
                type="button"
                onClick={handleGenerateSummary}
                disabled={summaryLoading}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold text-white transition-colors disabled:opacity-40"
                style={{ backgroundColor: "#2D6A4F" }}
              >
                {summaryLoading ? "Generating..." : "Generate Executive Summary"}
              </button>
            </div>
          )}

          {executiveSummary && (
            <div className="rounded-xl border border-border bg-card p-5 space-y-4 mb-2">
              <p className="text-[10px] font-black uppercase tracking-widest"
                style={{ color: "#2D6A4F" }}>Executive Summary</p>

              {([
                { key: "introduction",        label: "Introduction & Purpose"         },
                { key: "problem_statement",   label: "Problem Statement"              },
                { key: "strategic_approach",  label: "Strategic Approach"             },
                { key: "impact_goals",        label: "Impact Goals & KPIs"            },
                { key: "target_beneficiaries",label: "Target Beneficiaries"           },
                { key: "regulatory_alignment",label: "Regulatory & Framework Alignment"},
                { key: "budget_allocation",   label: "Budget & Allocation"            },
                { key: "next_steps",          label: "Implementation Roadmap"         },
              ] as { key: keyof ExecutiveSummary; label: string }[]).map(({ key, label }) =>
                executiveSummary[key] ? (
                  <div key={key}>
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground mb-1">
                      {label}
                    </p>
                    <p className="text-sm text-foreground leading-relaxed">
                      {executiveSummary[key]}
                    </p>
                  </div>
                ) : null
              )}
            </div>
          )}

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

              <div className="mt-4 pt-4 border-t" style={{ borderColor: "rgba(45,106,79,0.18)" }}>
                {pillar.pushed ? (
                  <p className="text-sm font-medium" style={{ color: "#2D6A4F" }}>
                    ✓ Sent to Initiatives — review and publish there
                  </p>
                ) : (
                  <button
                    onClick={() => handlePushPillar(pillar, i)}
                    disabled={pushingIndex === i}
                    className="text-sm font-semibold rounded px-4 py-2"
                    style={{ backgroundColor: "#2D6A4F", color: "white" }}
                  >
                    {pushingIndex === i ? "Pushing..." : "Push to Initiatives"}
                  </button>
                )}
              </div>
            </div>
          ))}
          {pushError && <p className="text-sm text-red-600">{pushError}</p>}

          {/* Strategy Advisor — below pillars */}
          <div className="rounded-2xl border border-[#2D6A4F]/20 overflow-hidden mt-2"
            style={{ background: "rgba(45,106,79,0.02)" }}>
            <div className="px-5 py-4 border-b border-[#2D6A4F]/12 flex items-center justify-between"
              style={{ background: "rgba(45,106,79,0.05)" }}>
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-[#2D6A4F]" style={{ boxShadow: "0 0 6px rgba(45,106,79,0.6)" }} />
                <p className="text-sm font-semibold text-foreground">Strategy Advisor</p>
                <span className="text-xs text-muted-foreground">— refine your pillars conversationally</span>
              </div>
              <button
                onClick={() => setChatOpen(o => !o)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {chatOpen ? "Collapse" : "Expand"}
              </button>
            </div>
            {chatOpen && (
              <>
                <div className="flex flex-col gap-4 p-5 overflow-y-auto" style={{ minHeight: "320px", maxHeight: "520px" }}>
                  {chatMessages.length === 0 && (
                    <div className="flex flex-col gap-2 mt-2">
                      <div className="flex justify-start">
                        <div className="max-w-[80%] rounded-2xl rounded-bl-sm px-4 py-3 text-sm leading-relaxed"
                          style={{ background: "rgba(45,106,79,0.1)", color: "inherit" }}>
                          Your pillars are confirmed. Tell me what you'd like to change — I'll update them and you can keep refining until they're right.
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-1 pl-1">
                        {[
                          "Make the financial inclusion pillar more specific",
                          "Replace the data security pillar with e-waste",
                          "Narrow the target demographic to youth under 25",
                        ].map(suggestion => (
                          <button
                            key={suggestion}
                            type="button"
                            onClick={() => setChatInput(suggestion)}
                            className="text-xs px-3 py-1.5 rounded-full border transition-colors hover:border-[#2D6A4F]/40 hover:text-[#2D6A4F]"
                            style={{ borderColor: "rgba(45,106,79,0.2)", color: "rgba(45,106,79,0.7)", background: "transparent" }}
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {chatMessages.map((m, i) => (
                    <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div
                        className="max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed"
                        style={{
                          background: m.role === "user" ? "#2D6A4F" : "rgba(45,106,79,0.1)",
                          color: m.role === "user" ? "#ffffff" : "inherit",
                          borderBottomRightRadius: m.role === "user" ? "4px" : undefined,
                          borderBottomLeftRadius: m.role === "assistant" ? "4px" : undefined,
                        }}
                      >
                        {m.content}
                      </div>
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="flex justify-start">
                      <div className="rounded-2xl rounded-bl-sm px-4 py-3"
                        style={{ background: "rgba(45,106,79,0.1)" }}>
                        <span className="inline-flex gap-1 items-center">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#2D6A4F] animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-[#2D6A4F] animate-bounce" style={{ animationDelay: "150ms" }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-[#2D6A4F] animate-bounce" style={{ animationDelay: "300ms" }} />
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                {chatError && (
                  <p className="text-xs text-red-600 px-5 pb-2">{chatError}</p>
                )}
                {executiveSummary && chatMessages.length > 0 && (
                  <p className="text-xs text-amber-600 px-5 pb-2">
                    Your executive summary will be cleared if pillars change. Regenerate it after you're done refining.
                  </p>
                )}
                <div className="flex gap-3 px-5 py-4 border-t border-[#2D6A4F]/12">
                  <input
                    type="text"
                    className="flex-1 rounded-full border border-border bg-background px-4 text-sm h-11 focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30 transition-all"
                    placeholder="What would you like to change?"
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleChat(); } }}
                    disabled={chatLoading}
                  />
                  <button
                    type="button"
                    onClick={handleChat}
                    disabled={chatLoading || !chatInput.trim()}
                    className="h-11 w-11 rounded-full flex items-center justify-center text-white transition-colors disabled:opacity-40 shrink-0"
                    style={{ backgroundColor: "#2D6A4F" }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}