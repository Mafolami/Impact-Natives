const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  try {
    const { type, data } = await req.json();

    let prompt = "";

    if (type === "initiative") {
      prompt = `You are an admin reviewer for a social impact partnership marketplace in Africa. Assess this initiative submission in 2-3 sentences for internal triage purposes.

Cover: (1) whether the brief is clear and complete enough to publish, (2) one specific strength or gap, (3) a recommended action (approve, request more info, or reject with reason).

Be direct. No padding. Write for an admin who needs to make a quick decision.

Title: ${data.title}
Problem: ${data.problem ?? "Not provided"}
Outcome: ${data.outcome ?? "Not provided"}
Stage: ${data.stage ?? "Not specified"}
Partnerships: ${data.partnerships?.join(", ") ?? "Not specified"}
Specific ask: ${data.specific_ask ?? "Not provided"}
Budget: ${data.budget ?? "Not specified"}
Target population: ${data.target_population ?? "Not specified"}
Prior experience: ${data.had_prior_experience === true ? "Yes" : data.had_prior_experience === false ? "No" : "Not specified"}
Sectors: ${data.sectors?.join(", ") ?? "Not specified"}
Locations: ${data.locations?.join(", ") ?? "Not specified"}

Return ONLY the triage summary. No labels, no JSON, no preamble.`;
    } else if (type === "verification") {
      prompt = `You are an admin reviewer for a social impact platform in Africa. Assess this verification request in 2-3 sentences for internal triage purposes.

Cover: (1) whether the profile and documents look legitimate, (2) any red flags or missing information, (3) recommended action (approve or follow up).

Be direct. No padding. Write for an admin who needs to make a quick decision.

Name: ${data.full_name ?? "Not provided"}
Organisation: ${data.org_name ?? "Not provided"}
Role: ${data.role_title ?? "Not provided"}
Type: ${data.org_type ?? "Not specified"}
Description: ${data.description ?? "Not provided"}
Sectors: ${data.sectors?.join(", ") ?? "Not specified"}
Country: ${data.country ?? "Not specified"}
Documents submitted: ${data.doc_count ?? 0}
Document types: ${data.doc_names?.join(", ") ?? "None"}

Return ONLY the triage summary. No labels, no JSON, no preamble.`;
    } else {
      return new Response(JSON.stringify({ error: "type must be initiative or verification" }), {
        status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

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

    const result = await claudeRes.json();
    const summary = result.content?.[0]?.text?.trim() ?? "";

    return new Response(JSON.stringify({ summary }), {
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
