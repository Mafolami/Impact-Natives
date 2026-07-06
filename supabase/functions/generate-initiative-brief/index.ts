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
    const { plain_description } = await req.json();
    if (!plain_description?.trim()) return new Response(
      JSON.stringify({ error: "plain_description is required" }),
      { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );

    const prompt = `You are helping a social impact practitioner in Africa structure their initiative brief for a partnership marketplace. Extract and structure the plain language description below into the JSON fields.

Return ONLY a valid JSON object. No markdown, no backticks, no explanation. If a field cannot be confidently inferred, return null.

{
  "title": "A clear, specific initiative title. Max 10 words. No buzzwords.",
  "problem": "The specific problem this addresses. Max 30 words. Start with the problem, not the solution.",
  "outcome": "The measurable outcome this will achieve. Max 30 words. Be specific about scale and impact.",
  "target_population": "Who the initiative directly serves. Max 20 words. Null if not mentioned.",
  "sectors": ["1-3 sectors from EXACTLY: Health, Education, Agriculture & Food Systems, Climate & Environment, Energy & Clean Tech, Water, Sanitation & Hygiene, Financial Inclusion, Gender & Inclusion, Governance & Civic Tech, Livelihoods & Economic Empowerment, Technology & Innovation, Arts, Culture & Creative Industries, Humanitarian & Emergency Response, Youth & Community Development. Copy the exact spelling and punctuation given, including commas."],
  "locations": ["All locations mentioned — countries, regions, cities e.g. Nigeria, Kano State, West Africa, Pan-Africa. Extract every place name mentioned."],
  "partnerships": ["1-3 values from: funding, technical, operational, leadership, strategic, lead"],
  "sdg_tags": ["1-3 SDG names from: No Poverty, Zero Hunger, Good Health and Well-being, Quality Education, Gender Equality, Clean Water and Sanitation, Affordable and Clean Energy, Decent Work and Economic Growth, Industry Innovation and Infrastructure, Reduced Inequalities, Sustainable Cities and Communities, Responsible Consumption and Production, Climate Action, Life Below Water, Life on Land, Peace Justice and Strong Institutions, Partnerships for the Goals"],
  "specific_ask": "What specifically does the initiative need from a partner? 1-2 sentences. Be concrete.",
  "tags": ["2-4 short keyword tags"],
  "budget_min": "Minimum budget as a plain number with no currency symbol or commas. Example: 50000. Null if not mentioned.",
  "budget_max": "Maximum budget as a plain number with no currency symbol or commas. Example: 150000. Null if not mentioned.",
  "stage": "One of exactly: concept, planning, active, scaling. Infer from context. Null if unclear.",
  "duration": "One of exactly: Under 6 months, 6-12 months, 1-2 years, 2-5 years, Ongoing. Infer from any timeline mentioned. Null if unclear."
}

Plain language description:
${plain_description}`;

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
