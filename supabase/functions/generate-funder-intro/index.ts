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
    const {
      expresser_name, expresser_org, expresser_description,
      expresser_sectors, expresser_offers,
      initiative_title, initiative_problem, initiative_outcome,
      initiative_sectors, esg_intent, initiative_owner_name,
    } = await req.json();

    if (!expresser_name || !initiative_title) return new Response(
      JSON.stringify({ error: "expresser_name and initiative_title are required" }),
      { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );

        const prompt = `You are a partnership coordinator writing a brief introduction message from one organisation to another on a social impact platform in Africa.

CRITICAL RULES:
- Never use placeholder text like [Name], [Organisation], [Your Name], or any bracketed text.
- Use only the actual values provided below. If a value is missing, omit that detail entirely.
- Write 2-3 sentences maximum for the body. No more.
- Plain, professional language. No marketing speak. No em dashes.
- Sound like a human practitioner, not a platform bot.
- Format the message exactly as: "Hi [recipient name]," on the first line, then a blank line, then the message body.
- The recipient name is the initiative owner org or person name provided below.

The message body should:
1. Name the expresser and briefly state what they do
2. In one sentence explain why this initiative is relevant to them
3. Signal openness to a conversation${esg_intent ? "\n4. Specifically mention interest in ESG/CSR adoption of this initiative" : ""}

Expresser name: ${expresser_name}
Expresser organisation: ${expresser_org ?? "not provided"}
Expresser description: ${expresser_description ?? "not provided"}
Expresser sectors: ${expresser_sectors?.join(", ") ?? "not specified"}
What they offer: ${expresser_offers?.join(", ") ?? "not specified"}

Initiative title: ${initiative_title}
Initiative owner (recipient): ${initiative_owner_name ?? "the team"}
Initiative problem: ${initiative_problem ?? "not provided"}
Initiative outcome: ${initiative_outcome ?? "not provided"}
Initiative sectors: ${initiative_sectors?.join(", ") ?? "not specified"}
Expresser intent: ${esg_intent ? "ESG/CSR adoption" : "General partnership interest"}

Return ONLY the formatted message. No labels, no preamble, no JSON. No placeholder text whatsoever.`;

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 200,
        temperature: 0.3,
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
    const message = groqData.choices?.[0]?.message?.content?.trim() ?? "";

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
