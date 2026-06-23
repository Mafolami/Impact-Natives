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
    const { mandate, initiatives } = await req.json();

    if (!mandate || !initiatives?.length) return new Response(
      JSON.stringify({ error: "mandate and initiatives are required" }),
      { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );

    const prompt = `You are an impact investment analyst helping a funder identify the best initiatives to fund from a marketplace.

Funder mandate:
${mandate.investment_thesis ? `- Investment thesis: "${mandate.investment_thesis}"` : ""}
- Organisation type: ${mandate.org_type ?? "Not specified"}
- Funding instruments: ${mandate.funding_instruments?.join(", ") ?? "Not specified"}
- Grant/investment range: ${mandate.grant_currency ?? "USD"} ${mandate.grant_range_min?.toLocaleString() ?? "?"} – ${mandate.grant_range_max?.toLocaleString() ?? "?"}
- Stage preference: ${mandate.stage_preference?.join(", ") ?? "Not specified"}
- Geographic focus: ${mandate.geographic_focus?.join(", ") ?? "Pan-Africa"}
- Sector focus: ${mandate.mandate_sectors?.join(", ") ?? "Not specified"}
- SDG priorities: ${mandate?.mandate_sdgs?.join(", ") ?? "Not specified"}
- Investment thesis: ${mandate?.investment_thesis ?? "Not specified"}

Initiatives to assess (each has an id, title, problem, sectors, locations, stage, budget_min, budget_max, budget_currency, sdg_tags):
${JSON.stringify(initiatives, null, 2)}

For each initiative, assign a match score from 0-100 and write a single sentence explaining why it matches or doesn't match the funder's mandate. Be specific — reference actual mandate criteria like sector, stage, budget range, or geography.

Return ONLY a valid JSON array. No markdown, no backticks, no explanation. Format:
[
  {
    "id": "initiative_id",
    "score": 85,
    "match_reason": "One sentence explaining the match"
  }
]

Order by score descending. Only include initiatives with score >= 40.
Never use placeholder text like "The actual match_reason is the same as before" or similar. Every match_reason must be a genuine, specific sentence about why this initiative does or does not match the funder's mandate. If the match is weak, explain specifically what is missing or misaligned.
`;

    let groqRes: Response | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
      });
      if (groqRes.ok) break;
      await new Promise(r => setTimeout(r, 1000));
    }

    if (!groqRes || !groqRes.ok) {
      const err = await groqRes?.text() ?? "Unknown error";
      return new Response(JSON.stringify({ error: `Groq API error: ${err}` }), {
        status: 502, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const groqData = await groqRes.json();
    const rawText = groqData.choices?.[0]?.message?.content ?? "";

    let ranked: any[];
    try {
      const clean = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
      ranked = JSON.parse(clean);
    } catch {
      return new Response(JSON.stringify({ error: "Could not parse response.", raw: rawText }), {
        status: 422, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    return new Response(JSON.stringify({ data: ranked }), {
      status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
});