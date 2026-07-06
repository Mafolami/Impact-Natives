// supabase/functions/score-partnership-fit/index.ts
// Real-time fit scoring between a viewer org and a listing org
// Returns: fit_score (0-100), reasons (string[]), gaps (string[]), rationale (string), opening_message (string)

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
    const { viewer_org, listing_org } = await req.json();

    if (!viewer_org || !listing_org) return new Response(
      JSON.stringify({ error: "viewer_org and listing_org are required" }),
      { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );

    const prompt = `You are a senior partnership analyst at Impact Natives, a B2B social impact platform connecting African and UK organisations.

You are scoring the fit between two organisations for a potential partnership.

VIEWER ORG (the organisation browsing the listing):
- Name: ${viewer_org.organisation_name}
- Type: ${viewer_org.organisation_type}
- Description: ${viewer_org.description}
- Sectors: ${Array.isArray(viewer_org.sector) ? viewer_org.sector.join(", ") : viewer_org.sector}
- Countries: ${Array.isArray(viewer_org.country) ? viewer_org.country.join(", ") : viewer_org.country}
- Needs: ${Array.isArray(viewer_org.needs) ? viewer_org.needs.join(", ") : viewer_org.needs}
- Offers: ${Array.isArray(viewer_org.offers) ? viewer_org.offers.join(", ") : viewer_org.offers}
- SDGs: ${Array.isArray(viewer_org.sdgs) ? viewer_org.sdgs.join(", ") : viewer_org.sdgs}
- Working style: ${viewer_org.partnership_working_style ?? "Not specified"}
- DD readiness score: ${[viewer_org.partnership_dd_financial_model, viewer_org.partnership_dd_audited_accounts, viewer_org.partnership_dd_safeguarding_policy, viewer_org.partnership_dd_data_policy, viewer_org.partnership_dd_governance_doc].filter(Boolean).length} of 5

LISTING ORG (the organisation being viewed):
- Name: ${listing_org.organisation_name}
- Type: ${listing_org.organisation_type}
- Description: ${listing_org.description}
- Sectors: ${Array.isArray(listing_org.sector) ? listing_org.sector.join(", ") : listing_org.sector}
- Countries: ${Array.isArray(listing_org.country) ? listing_org.country.join(", ") : listing_org.country}
- Seeking: ${listing_org.partnership_sought}
- Needs: ${Array.isArray(listing_org.needs) ? listing_org.needs.join(", ") : listing_org.needs}
- Offers: ${Array.isArray(listing_org.offers) ? listing_org.offers.join(", ") : listing_org.offers}
- Stage: ${listing_org.partnership_stage ?? "Not specified"}
- Budget: ${listing_org.partnership_budget ?? "Not specified"}
- Timeline: ${listing_org.partnership_decision_timeline ?? "Not specified"}
- Funding status: ${listing_org.partnership_funding_status ?? "Not specified"}
- Working style: ${listing_org.partnership_working_style ?? "Not specified"}
- Exclusivity: ${listing_org.partnership_exclusivity ?? "Not specified"}
- Location focus: ${listing_org.partnership_geo_specificity ?? "Not specified"}
- Success definition: ${listing_org.partnership_success_definition ?? "Not specified"}
- Theory of change: ${listing_org.partnership_theory_of_change ?? "Not specified"}
- DD docs required: implied by their listing

Score the fit on these dimensions (weight in brackets):
1. Sector alignment [25%] -- do they work in the same or complementary sectors?
2. Geography match [20%] -- do their operating countries overlap or complement?
3. Need-offer reciprocity [25%] -- does what viewer offers match what listing needs, and vice versa?
4. Working style compatibility [15%] -- are their working styles compatible?
5. Stage and timeline readiness [15%] -- is the viewer ready to engage at this stage and timeline?

Return ONLY valid JSON, no markdown, no explanation:
{
  "fit_score": 82,
  "reasons": [
    "Both organisations work in health systems in Nigeria",
    "Your field access and execution capacity directly matches what they need",
    "Your working style aligns with their co-design preference"
  ],
  "gaps": [
    "They are seeking a partner within 1 month — confirm your availability",
    "They prefer joint delivery — clarify your capacity to co-lead"
  ],
  "rationale": "Strong fit. [2 sentences max explaining the core match and the single most important gap or risk.]",
  "opening_message": "Hi ${listing_org.organisation_name}, I came across your listing on Impact Natives and I think there's a strong case for collaboration. [2-3 sentences specific to both orgs — mention the listing org's specific need, reference what the viewer org brings, and one concrete reason why this makes sense. Close with an open question.]"
}

Rules:
- fit_score must be an integer between 0 and 100
- reasons: 2-4 short strings, each under 12 words, starting with a positive signal
- gaps: 0-3 short strings, each under 15 words, only real gaps — not invented ones
- rationale: exactly 2 sentences, plain English, no jargon
- opening_message: 3-4 sentences, personalised, warm but professional, specific to both orgs
- Never invent facts not present in the profiles
- Return JSON only`;

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 800,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: "You are a precise partnership analyst. Return only valid JSON with no markdown, no backticks, no explanation.",
          },
          { role: "user", content: prompt },
        ],
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
      return new Response(JSON.stringify({ error: "No JSON in response", raw: rawText }), {
        status: 422, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    let parsed;
    try { parsed = JSON.parse(jsonMatch[0]); }
    catch {
      return new Response(JSON.stringify({ error: "Could not parse JSON", raw: rawText }), {
        status: 422, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    return new Response(JSON.stringify({ result: parsed }), {
      status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
});
