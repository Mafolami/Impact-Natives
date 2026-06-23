const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });

  try {
    const { initiative, mandate, dd_readiness } = await req.json();
    if (!initiative) return new Response(
      JSON.stringify({ error: "initiative is required" }),
      { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );

    const prompt = `You are an experienced impact investment analyst. Generate a concise deal memo for the following initiative, assessed against the funder's mandate.

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
- Prior experience: ${initiative.had_prior_experience ? "Yes" : "No"}
- Prior experience detail: ${initiative.prior_experience_detail ?? "Not specified"}
- Confirmed assets: ${initiative.confirmed_assets?.join(", ") ?? "None"}
- SDG alignment: ${initiative.sdg_tags?.join(", ") ?? "Not specified"}
- Duration: ${initiative.duration ?? "Not specified"}
- Partnership types sought: ${initiative.partnerships?.join(", ") ?? "Not specified"}
- Impact evidence: ${initiative.impact_evidence ?? "Not provided"}
- Target beneficiaries: ${initiative.target_beneficiaries ?? "Not specified"}
- Target jobs: ${initiative.target_jobs ?? "Not specified"}
- Female beneficiaries target: ${initiative.target_female_pct ? initiative.target_female_pct + "%" : "Not specified"}
- Target timeline: ${initiative.target_timeline_months ? initiative.target_timeline_months + " months" : "Not specified"}

FUNDER MANDATE:
${mandate?.investment_thesis ? `- Investment thesis: "${mandate.investment_thesis}"` : ""}
- Funding instruments: ${mandate?.funding_instruments?.join(", ") ?? "Not specified"}
- Grant/investment range: ${mandate?.grant_currency ?? "USD"} ${mandate?.grant_range_min?.toLocaleString() ?? "?"} – ${mandate?.grant_range_max?.toLocaleString() ?? "?"}
- Stage preference: ${mandate?.stage_preference?.join(", ") ?? "Not specified"}
- Geographic focus: ${mandate?.geographic_focus?.join(", ") ?? "Pan-Africa"}
- Sector focus: ${mandate?.mandate_sectors?.join(", ") ?? "Not specified"}
- SDG priorities: ${mandate?.mandate_sdgs?.join(", ") ?? "Not specified"}
- Investment thesis: ${mandate?.investment_thesis ?? "Not specified"}

DD READINESS (organisation self-reported):
- Financial model available: ${dd_readiness?.financial_model ? "Yes" : "No"}
- Audited accounts: ${dd_readiness?.audited_accounts ? "Yes" : "No"}
- Governance documentation: ${dd_readiness?.governance_doc ? "Yes" : "No"}
- ESG assessment: ${dd_readiness?.esg_assessment ? "Yes" : "No"}
- Impact measurement framework: ${dd_readiness?.impact_framework ? "Yes" : "No"}
- Overall DD readiness score: ${dd_readiness?.score ?? 0}%

Return ONLY a valid JSON object. No markdown, no backticks, no explanation.

{
  "match_score": <number 0-100>,
  "headline": "<One sentence summary of this opportunity for the funder>",
  "problem_validity": "<2-3 sentences assessing how real and significant the problem is>",
  "solution_fit": "<2-3 sentences on whether the approach is credible and well-defined. Ensure you reference any impact evidence provided>",
  "team_credibility": "<2-3 sentences on track record, prior experience, confirmed assets, and DD readiness score if provided>",
  "financial_assessment": "<2-3 sentences on budget reasonableness, ask clarity, co-funding status>",
  "mandate_alignment": "<2-3 sentences on how well this fits the funder's specific mandate and investment thesis. Reference the thesis directly if provided>",
  "risk_flags": ["<specific risk 1>", "<specific risk 2>", "<specific risk 3>"],
  "recommended_action": "<One of: Express Interest, Request More Info, Pass>",
  "recommended_action_reason": "<One sentence explaining the recommendation>"
}
  Write like a senior impact investment analyst at a DFI or philanthropic foundation. 
  Be specific — reference actual figures, locations, and stages from the initiative data. 
  Flag concrete gaps explicitly. 
  Do not add summary judgement sentences at the end of each section like "A credible problem" or "A solid approach" — just write the analysis.
  If key information is missing, say exactly what is missing and why it matters.`;



    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
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

    let memo: Record<string, any>;
    try {
      const clean = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
      memo = JSON.parse(clean);
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