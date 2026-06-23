// supabase/functions/prefill-partnership-form/index.ts

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") ?? "";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SECTOR_OPTIONS = [
  "Health","Agriculture","Climate","Energy","Fintech","Education",
  "Governance","Gender","Tech","Water & Sanitation","Humanitarian",
  "Livelihoods","Research","Arts & Culture","Other",
];
const NEEDS_OPTIONS = ["Funding","Partnership","Data","Visibility","Technical Assistance","Networks"];
const OFFERS_OPTIONS = ["Field access","Data","Networks","Execution","Funding","Research"];
const COUNTRIES = ["Nigeria","Kenya","Ghana","South Africa","Ethiopia","Rwanda","Senegal","United Kingdom","Germany","France","Other"];
const ORG_TYPES = ["ngo","social_enterprise","corporate","funder","research","government","individual","other"];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });

  try {
    const { free_text, org_profile } = await req.json();

    if (!free_text) return new Response(
      JSON.stringify({ error: "free_text is required" }),
      { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );

    const prompt = `You are a partnership analyst for Impact Natives, a B2B social impact platform connecting African and UK organisations.

Extract structured partnership intent from the user description below and return ONLY a valid JSON object. No markdown, no backticks, no explanation text before or after the JSON.

Allowed values:
- sectors (pick from): ${SECTOR_OPTIONS.join(", ")}
- needs (pick from): ${NEEDS_OPTIONS.join(", ")}
- offers (pick from): ${OFFERS_OPTIONS.join(", ")}
- country (pick from): ${COUNTRIES.join(", ")}
- organisation_type (pick one): ${ORG_TYPES.join(", ")}
- sdgs: integers between 1 and 17

Output format (copy this structure exactly, replace values only):
{"country":["Nigeria"],"sectors":["Health"],"sdgs":[3,10],"organisation_type":"ngo","needs":["Funding"],"offers":["Field access"],"description":"Description of the organisation in 2-3 sentences.","partnership_sought":"What kind of partner they want and why in 1-2 sentences."}

Rules:
- Only use values from the allowed lists. Pick closest match if needed.
- Keep existing org description if good; improve if weak.
- Extract partnership_sought from the user free-text.
- Infer SDGs from sectors if not stated.
- Every array needs at least one item.

User free-text:
"${free_text}"

Existing org profile:
- Name: ${org_profile?.organisation_name || "Not provided"}
- Description: ${org_profile?.description || "Not provided"}
- Sector: ${Array.isArray(org_profile?.sector) ? org_profile.sector.join(", ") : org_profile?.sector || "Not provided"}
- Country: ${Array.isArray(org_profile?.country) ? org_profile.country.join(", ") : org_profile?.country || "Not provided"}
- Org type: ${org_profile?.organisation_type || "Not provided"}
- Needs: ${Array.isArray(org_profile?.needs) ? org_profile.needs.join(", ") : "Not provided"}
- Offers: ${Array.isArray(org_profile?.offers) ? org_profile.offers.join(", ") : "Not provided"}
- SDGs: ${Array.isArray(org_profile?.sdgs) ? org_profile.sdgs.join(", ") : "Not provided"}

Prioritise the user free-text over the existing profile. Return JSON only.`;

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        max_tokens: 1000,
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

    // Strip any markdown fences and grab first JSON object
    const stripped = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
    const jsonMatch = stripped.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return new Response(JSON.stringify({ error: "No JSON found in response.", raw: rawText }), {
        status: 422, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return new Response(JSON.stringify({ error: "Could not parse JSON.", raw: rawText }), {
        status: 422, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    return new Response(JSON.stringify({ prefilled: parsed }), {
      status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
});