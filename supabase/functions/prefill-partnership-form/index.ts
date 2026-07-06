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
const ORG_TYPES = [
  "ngo_non_profit","social_enterprise","startup","research_academic",
  "philanthropic_foundation","venture_capital","corporation",
  "technology_company","public_sector","individual_creative","other",
];const STAGE_OPTIONS = ["concept","joining_running","pilot","scaling"];
const DURATION_OPTIONS = ["under_6_months","6_12_months","1_2_years","2_plus_years","ongoing"];
const BUDGET_OPTIONS = ["under_10k","10k_50k","50k_200k","over_200k","in_kind_only","open"];
const TIMELINE_OPTIONS = ["immediately","within_1_month","1_3_months","3_6_months","no_fixed_timeline"];
const LEGAL_TYPE_OPTIONS = ["formal_mou","subcontracting","co_implementation","referral","joint_venture","informal","open"];
const EXCLUSIVITY_OPTIONS = ["multiple_partners","one_dedicated_partner"];
const LANGUAGE_OPTIONS = ["English","French","Portuguese","Arabic","Swahili","Other"];
const CAPACITY_OPTIONS = ["1_part_time","1_full_time","2_5_people","5_plus_people","tbd"];
const FUNDING_STATUS_OPTIONS = ["fully_funded","partially_funded","seeking_funding","partner_brings_funding"];
const THEORY_OF_CHANGE_HINT = "One sentence describing how this organisation creates change.";
const PRIOR_ATTEMPTS_HINT = "Brief note on any previous attempts to find this type of partner, or 'No previous attempts' if none mentioned.";
const CONSTRAINTS_HINT = "Any donor, legal, or exclusivity constraints mentioned, or omit if none stated.";
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });

  try {
    const { free_text, org_profile, document_base64, document_type } = await req.json();

    if (!free_text && !document_base64) return new Response(
      JSON.stringify({ error: "free_text or document_base64 is required" }),
      { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );

    // If document provided, extract text from it first
    let effectiveFreeText = free_text ?? "";
    if (document_base64) {
      const docPrompt = `Extract the key partnership-relevant content from this document. Return a plain text summary covering: what the organisation does, what partnerships they are seeking, sectors, locations, budget, timeline, needs, and offers. Be concise and factual. Do not invent details not in the document.`;
      
      const docRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_API_KEY}` },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          max_tokens: 800,
          messages: [{ role: "user", content: document_type === "application/pdf"
            ? `${docPrompt}\n\nDocument content (base64 PDF -- extract and summarise):\n${document_base64.slice(0, 8000)}`
            : `${docPrompt}\n\nDocument content:\n${atob(document_base64).slice(0, 8000)}`
          }],
        }),
      });
      const docData = await docRes.json();
      const extracted = docData.choices?.[0]?.message?.content?.trim() ?? "";
      if (extracted) effectiveFreeText = extracted + (free_text ? `\n\nAdditional context: ${free_text}` : "");
    }

    const prompt = `You are a partnership analyst for Impact Natives, a B2B social impact platform connecting African and UK organisations.

Extract structured partnership intent from the user description below and return ONLY a valid JSON object. No markdown, no backticks, no explanation text before or after the JSON.

Allowed values:
- sectors (pick from): ${SECTOR_OPTIONS.join(", ")}
- needs (pick from): ${NEEDS_OPTIONS.join(", ")}
- offers (pick from): ${OFFERS_OPTIONS.join(", ")}
- country (pick from): ${COUNTRIES.join(", ")}
- organisation_type (pick one): ${ORG_TYPES.join(", ")}
- sdgs: integers between 1 and 17
- partnership_stage (pick one): ${STAGE_OPTIONS.join(", ")}
- partnership_duration (pick one): ${DURATION_OPTIONS.join(", ")}
- partnership_budget (pick one): ${BUDGET_OPTIONS.join(", ")}
- partnership_decision_timeline (pick one): ${TIMELINE_OPTIONS.join(", ")}
- partnership_legal_type (pick multiple): ${LEGAL_TYPE_OPTIONS.join(", ")}
- partnership_exclusivity (pick one): ${EXCLUSIVITY_OPTIONS.join(", ")}
- partnership_language (pick multiple): ${LANGUAGE_OPTIONS.join(", ")}
- partnership_team_capacity (pick one): ${CAPACITY_OPTIONS.join(", ")}
- partnership_funding_status (pick one): ${FUNDING_STATUS_OPTIONS.join(", ")}
- partnership_theory_of_change: free text, one sentence, infer from context
- partnership_prior_attempts: free text, infer from context or state "No previous attempts mentioned"
- partnership_constraints: free text, extract donor/legal constraints or omit if none

Output format (use these exact keys, derive ALL values from the user description above -- never copy example values):
{
  "country": ["Nigeria"],
  "sectors": ["Health"],
  "sdgs": [3, 10],
  "organisation_type": "ngo",
  "needs": ["Funding"],
  "offers": ["Field access"],
  "description": "Description of the organisation in 2-3 sentences.",
  "partnership_sought": "What kind of partner they want and why in 1-2 sentences.",
  "partnership_stage": "pilot",
  "partnership_duration": "6_12_months",
  "partnership_budget": "10k_50k",
  "partnership_decision_timeline": "1_3_months",
  "partnership_legal_type": ["formal_mou"],
  "partnership_exclusivity": "multiple_partners",
  "partnership_language": ["English"],
  "partnership_team_capacity": "2_5_people",
  "partnership_funding_status": "partially_funded",
  "partnership_geo_specificity": "Kano State, Nigeria",
  "partnership_success_definition": "120 rural PHCs consistently submitting accurate digital health data monthly, with a trained CHEW workforce and a co-published implementation report by month 18.",
  "partnership_theory_of_change": "INFER from description: one sentence on how this org creates change.",
  "partnership_prior_attempts": "INFER from description: note on previous attempts or plausible inference.",
  "partnership_constraints": "EXTRACT from description: donor/legal constraints, or No known constraints at this time."}

Rules:
- Only use values EXACTLY as listed in the allowed values below. Never invent new values. Pick closest match if needed.
- Keep existing org description if good; improve if weak.
- Extract partnership_sought from the user free-text.
- Infer SDGs from sectors if not stated.
- Every array needs at least one item.
- NEVER output instructions, hints, or placeholder text as field values. Every field value must be derived from the user description or org profile.
- For partnership_geo_specificity, extract the most specific location mentioned.
- partnership_success_definition: Infer from stated outcomes. Max 50 words. If not stated, write one based on the programme goal.
- partnership_theory_of_change: Infer from how the org describes their approach. e.g. "We strengthen systems through community-led delivery and government partnership." Always write one sentence based on the sector, programme description, and org type even if not explicitly stated.
- partnership_prior_attempts: Extract if mentioned. If not mentioned, write a plausible sentence based on the org type and what they are seeking, e.g. "We have explored informal partnerships but have not formalised one at this scale."
- partnership_constraints: Extract any donor restrictions, funding source limitations, or exclusivity requirements mentioned. If none mentioned, write "No known constraints at this time."

User free-text:
"${effectiveFreeText}"

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
        model: "llama-3.3-70b-versatile",
        max_tokens: 1500,
        temperature: 0.1,
        messages: [
          {
            role: "system",
            content: "You are a precise data extraction assistant. You return only valid JSON with no additional text, markdown, or explanation. You always populate every field in the output format using inference where not explicitly stated.",
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