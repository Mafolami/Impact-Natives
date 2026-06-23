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
    const { title, problem, outcome, specific_ask, partnerships, sectors, budget, stage, had_prior_experience, impact_evidence } = await req.json();

    if (!title || !problem || !outcome) return new Response(
      JSON.stringify({ error: "title, problem and outcome are required" }),
      { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );

    const prompt = `You are reviewing an initiative brief submitted to a social impact partnership marketplace in Africa. Your job is to assess the quality of the brief from a funder or partner's perspective.

Initiative details:
Title: ${title}
Problem: ${problem}
Outcome: ${outcome}
Specific ask: ${specific_ask ?? "Not provided"}
Partnerships sought: ${partnerships?.join(", ") ?? "Not specified"}
Sectors: ${sectors?.join(", ") ?? "Not specified"}
Budget: ${budget ?? "Not provided"}
Stage: ${stage ?? "Not specified"}
Prior experience: ${had_prior_experience === true ? "Yes" : had_prior_experience === false ? "No" : "Not specified"}
Impact evidence: ${impact_evidence ?? "Not provided"}

Return ONLY a valid JSON object with these exact fields. No markdown, no backticks:

{
  "score": "strong" | "good" | "basic",
  "what_works": "1 sentence on the strongest element of this brief.",
  "improve": "1 specific, actionable suggestion to make this brief more compelling to funders. Be direct and concrete. Do not be vague."
}

Scoring guide:
- "strong": Clear specific problem, measurable outcome, concrete ask, budget or stage provided, prior experience noted, impact evidence included
- "good": Problem and outcome clear but ask is vague, or missing budget/stage or impact evidence
- "basic": Problem or outcome is vague, no specific ask, no impact evidence, minimal information for a funder to assess fit`;

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

    let result: Record<string, any>;
    try {
      const clean = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
      result = JSON.parse(clean);
    } catch {
      return new Response(JSON.stringify({ error: "Could not parse response.", raw: rawText }), {
        status: 422, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    return new Response(JSON.stringify({ data: result }), {
      status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
});
