// supabase/functions/generate-csr-brief/index.ts
// Generates a CSR adoption brief for corporate accounts

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") ?? "";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });

  try {
    const { initiative, csr_mandate, dd_readiness } = await req.json();

    if (!initiative) return new Response(
      JSON.stringify({ error: "initiative is required" }),
      { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );

    const prompt = `You are an experienced corporate social responsibility (CSR) analyst specialising in African impact programmes. Generate a concise CSR adoption brief for the following initiative, assessed against the corporate's CSR mandate.

INITIATIVE:
- Title: ${initiative.title}
- Problem: ${initiative.problem ?? "Not specified"}
- Expected outcome: ${initiative.outcome ?? "Not specified"}
- Target population: ${initiative.target_population ?? "Not specified"}
- Sectors: ${initiative.sectors?.join(", ") ?? "Not specified"}
- Locations: ${initiative.locations?.join(", ") ?? "Not specified"}
- Stage: ${initiative.stage ?? "Not specified"}
- Budget ask: ${initiative.budget_currency ?? "USD"} ${initiative.budget_min?.toLocaleString() ?? "?"} – ${initiative.budget_max?.toLocaleString() ?? "?"}
- Specific ask: ${initiative.specific_ask ?? "Not specified"}
- SDG alignment: ${initiative.sdg_tags?.join(", ") ?? "Not specified"}
- ESG/CSR friendly: ${initiative.esg_alignment ? "Yes" : "No"}
- Partnership types sought: ${initiative.partnerships?.join(", ") ?? "Not specified"}
- Prior experience: ${initiative.had_prior_experience ? "Yes" : "No"}
- Prior experience detail: ${initiative.prior_experience_detail ?? "Not specified"}
- Impact evidence: ${initiative.impact_evidence ?? "Not provided"}
- Target beneficiaries: ${initiative.target_beneficiaries ?? "Not specified"}
- Target jobs: ${initiative.target_jobs ?? "Not specified"}
- Female beneficiaries target: ${initiative.target_female_pct ? initiative.target_female_pct + "%" : "Not specified"}
- Target timeline: ${initiative.target_timeline_months ? initiative.target_timeline_months + " months" : "Not specified"}

CORPORATE CSR MANDATE:
- Organisation type: ${csr_mandate?.org_type ?? "Corporate"}
- ESG frameworks: ${csr_mandate?.esg_frameworks?.join(", ") ?? "Not specified"}
- CSR budget range: ${csr_mandate?.csr_budget_range ?? "Not specified"}
- Geographic focus: ${csr_mandate?.geographic_focus?.join(", ") ?? "Not specified"}
- Sector focus: ${csr_mandate?.mandate_sectors?.join(", ") ?? "Not specified"}
- SDG priorities: ${csr_mandate?.mandate_sdgs?.join(", ") ?? "Not specified"}
- Partnership type preference: ${csr_mandate?.partner_type_preference?.join(", ") ?? "Not specified"}

IMPLEMENTER DD READINESS:
- Financial model available: ${dd_readiness?.financial_model ? "Yes" : "No"}
- Audited accounts: ${dd_readiness?.audited_accounts ? "Yes" : "No"}
- Governance documentation: ${dd_readiness?.governance_doc ? "Yes" : "No"}
- ESG assessment: ${dd_readiness?.esg_assessment ? "Yes" : "No"}
- Impact measurement framework: ${dd_readiness?.impact_framework ? "Yes" : "No"}
- Overall DD readiness score: ${dd_readiness?.score ?? 0}%

Return ONLY a valid JSON object. No markdown, no backticks, no explanation text before or after the JSON.

{"match_score":<number 0-100>,"headline":"<One sentence on why this fits the corporate CSR strategy>","sdg_alignment":"<2-3 sentences on SDG mapping>","local_content":"<2-3 sentences on geographic reach and community impact>","brand_fit":"<2-3 sentences on sector and brand alignment>","esg_framework_match":"<2-3 sentences on ESG framework compliance>","partnership_options":"<2-3 sentences on what the corporate can contribute>","reputational_considerations":"<2-3 sentences on reputational opportunities and risks>","implementer_readiness":"<2-3 sentences on track record and DD readiness>","risk_flags":["<risk 1>","<risk 2>","<risk 3>"],"recommended_action":"<One of: Adopt as CSR programme, Explore further, Pass>","recommended_action_reason":"<One sentence explaining the recommendation>"}

Write like a senior CSR analyst at a multinational. Be specific — reference actual figures, locations, and ESG frameworks. Flag gaps explicitly. No summary judgement sentences at the end of sections.`;

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        max_tokens: 1500,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!groqRes.ok) {
      const err = await groqRes.text();
      return new Response(JSON.stringify({ error: `Groq API error: ${err}` }), {
        status: 502, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const groqData = await groqRes.json();
    const rawText = groqData.choices?.[0]?.message?.content ?? "";
    const stripped = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
    const jsonMatch = stripped.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return new Response(JSON.stringify({ error: "No JSON found in response.", raw: rawText }), {
        status: 422, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    let memo: Record<string, any>;
    try {
      memo = JSON.parse(jsonMatch[0]);
    } catch {
      return new Response(JSON.stringify({ error: "Could not parse response.", raw: rawText }), {
        status: 422, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    return new Response(JSON.stringify({ data: memo }), {
      status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
});
