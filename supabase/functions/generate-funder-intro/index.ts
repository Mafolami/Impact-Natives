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
    const {
      expresser_name,
      expresser_org,
      expresser_description,
      expresser_sectors,
      expresser_offers,
      initiative_title,
      initiative_problem,
      initiative_outcome,
      initiative_sectors,
      esg_intent,
    } = await req.json();

    if (!expresser_name || !initiative_title) return new Response(
      JSON.stringify({ error: "expresser_name and initiative_title are required" }),
      { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );

    const prompt = `You are a partnership coordinator writing a brief introduction message from one organisation to another on a social impact platform in Africa.

CRITICAL RULES:
- Never use placeholder text like [Name], [Organisation], [Your Name], or any bracketed text.
- Use only the actual values provided below. If a value is missing, omit that detail entirely.
- Write 2-3 sentences maximum.
- Plain, professional language. No marketing speak. No em dashes.
- Sound like a human practitioner, not a platform bot.

The message should:
1. Name the expresser and briefly state what they do
2. In one sentence explain why this initiative is relevant to them
3. Signal openness to a conversation${esg_intent ? "\n4. Specifically mention interest in ESG/CSR adoption of this initiative" : ""}

Expresser name: ${expresser_name}
Expresser organisation: ${expresser_org ?? "not provided — omit org reference"}
Expresser description: ${expresser_description ?? "not provided"}
Expresser sectors: ${expresser_sectors?.join(", ") ?? "not specified"}
What they offer: ${expresser_offers?.join(", ") ?? "not specified"}

Initiative title: ${initiative_title}
Initiative problem: ${initiative_problem ?? "not provided"}
Initiative outcome: ${initiative_outcome ?? "not provided"}
Initiative sectors: ${initiative_sectors?.join(", ") ?? "not specified"}
Expresser intent: ${esg_intent ? "ESG/CSR adoption of this initiative as a corporate programme" : "General partnership interest"}

Return ONLY the message text. No labels, no preamble, no JSON. No placeholder text whatsoever.`;

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 200,
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
    const message = claudeData.content?.[0]?.text?.trim() ?? "";

    return new Response(JSON.stringify({ message }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
});
