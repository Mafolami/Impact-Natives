const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  try {
    const { organisation_name, description, sectors, needs, offers, sdgs, organisation_type, country } = await req.json();

    if (!organisation_name) {
      return new Response(
        JSON.stringify({ error: "organisation_name is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    const prompt = `You are a partnership coordinator at a social impact coordination platform focused on Africa.

Given the following organisation profile, write a 2-3 sentence partnership summary that explains:
1. What kind of partner this organisation would be most valuable to
2. What they are most likely to contribute to a collaboration
3. What they are seeking in return

Write in plain, direct language. No marketing speak. No bullet points. No headers. Just 2-3 flowing sentences that a funder or partner could read in 10 seconds and immediately understand the partnership value.

Organisation name: ${organisation_name}
Country: ${country ?? "Not specified"}
Type: ${organisation_type ?? "Not specified"}
Description: ${description ?? "Not provided"}
Sectors: ${sectors?.join(", ") ?? "Not specified"}
SDGs: ${sdgs?.join(", ") ?? "Not specified"}
What they need: ${needs?.join(", ") ?? "Not specified"}
What they offer: ${offers?.join(", ") ?? "Not specified"}

Return ONLY the partnership summary text. No labels, no preamble, no explanation.`;

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
      return new Response(
        JSON.stringify({ error: `Claude API error: ${err}` }),
        { status: 502, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    const claudeData = await claudeRes.json();
    const summary = claudeData.content?.[0]?.text?.trim() ?? "";

    return new Response(JSON.stringify({ summary }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });

  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );
  }
});
