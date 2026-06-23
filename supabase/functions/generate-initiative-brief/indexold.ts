const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

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
    const { plain_description } = await req.json();
    if (!plain_description?.trim()) return new Response(
      JSON.stringify({ error: "plain_description is required" }),
      { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );

    const prompt = `You are helping a social impact practitioner in Africa structure their initiative brief for a partnership marketplace. They have described their initiative in plain language. Extract and structure it into the fields below.

Return ONLY a valid JSON object. No markdown, no backticks, no explanation. If a field cannot be confidently inferred, return null.

{
  "title": "A clear, specific initiative title. Max 10 words. No buzzwords.",
  "problem": "The specific problem this addresses. Max 30 words. Start with the problem, not the solution.",
  "outcome": "The measurable outcome this will achieve. Max 30 words. Be specific about scale and impact.",
  "target_population": "Who the initiative directly serves. Max 20 words. Null if not mentioned.",
  "sectors": ["1-3 sectors from: Health, Education, Agriculture & Food Systems, Climate & Environment, Energy & Clean Tech, Water Sanitation & Hygiene, Financial Inclusion, Gender & Inclusion, Governance & Civic Tech, Livelihoods & Economic Empowerment, Technology & Innovation, Arts Culture & Creative Industries, Humanitarian & Emergency Response, Youth & Community Development"],
  "locations": ["All locations mentioned — countries, regions, cities, or continental scope e.g. West Africa, Pan-Africa, Nigeria, Lagos"],
  "partnerships": ["1-3 values from: funding, technical, operational, leadership, strategic, lead"],
  "sdg_tags": ["1-3 SDG names from: No Poverty, Zero Hunger, Good Health and Well-being, Quality Education, Gender Equality, Clean Water and Sanitation, Affordable and Clean Energy, Decent Work and Economic Growth, Industry Innovation and Infrastructure, Reduced Inequalities, Sustainable Cities and Communities, Responsible Consumption and Production, Climate Action, Life Below Water, Life on Land, Peace Justice and Strong Institutions, Partnerships for the Goals"],
  "specific_ask": "What specifically does the initiative need from a partner? 1-2 sentences. Be concrete.",
  "tags": ["2-4 short keyword tags"],
  "budget_min": "Minimum budget as a plain number with no currency symbol. Null if not mentioned.",
  "budget_max": "Maximum budget as a plain number with no currency symbol. Null if not mentioned.",
  "stage": "One of: concept, planning, active, scaling. Infer from context. Null if unclear.",
  "duration": "Expected project duration as a plain string, e.g. '6 months', '1 year', '18 months'. Null if not mentioned."
}

Plain language description from the user:
${plain_description}`;

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 800,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.text();
      return new Response(JSON.stringify({ error: `Claude API error: ${err}` }), {
        status: 502, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const claudeData = await claudeRes.json();
    const rawText = claudeData.content?.[0]?.text ?? "";

    let extracted: Record<string, any>;
    try {
      const clean = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
      extracted = JSON.parse(clean);
    } catch {
      return new Response(JSON.stringify({ error: "Could not parse response.", raw: rawText }), {
        status: 422, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    return new Response(JSON.stringify({ data: extracted }), {
      status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
});
