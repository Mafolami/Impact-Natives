// supabase/functions/prefill-partnership-form/index.ts
// v19: max_tokens -> max_completion_tokens + reasoning_effort: low

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") ?? "";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SECTOR_OPTIONS = ["Health","Agriculture","Climate","Energy","Fintech","Education","Governance","Gender","Tech","Water & Sanitation","Humanitarian","Livelihoods","Research","Arts & Culture","Other"];
const NEEDS_OPTIONS = ["Funding","Technical assistance","Research capacity","Field access","Networks and convening","Data and evidence","Policy influence","Communications","Legal and compliance","Other"];
const OFFERS_OPTIONS = ["Funding","Field access","Local implementation","Data and evidence","Research capacity","Networks","Technical expertise","Communications","Policy influence","Other"];
const COUNTRIES = ["Nigeria","Kenya","Ghana","South Africa","Ethiopia","Rwanda","Senegal","Uganda","Tanzania","Zambia","Zimbabwe","Malawi","Mozambique","Cameroon","Cote d'Ivoire","Mali","Burkina Faso","Niger","Liberia","Sierra Leone","Gambia","Guinea","Togo","Benin","Egypt","Morocco","Tunisia","Algeria","Sudan","South Sudan","Somalia","DR Congo","Congo","Angola","Namibia","Botswana","Eswatini","Lesotho","Jordan","Lebanon","Palestine","Yemen","Bangladesh","India","Pakistan","Nepal","Indonesia","Philippines","United Kingdom","Germany","France","Netherlands","Switzerland","Sweden","Norway","United States","Canada","Brazil","Global","Other"];
const ORG_TYPES = ["ngo_non_profit","social_enterprise","startup","research_institution","philanthropic_foundation","venture_capital","corporation","technology_company","public_sector","other"];
const STAGE_OPTIONS = ["concept","joining_running","pilot","scaling"];
const DURATION_OPTIONS = ["under_6_months","6_12_months","1_2_years","2_plus_years","ongoing"];
const BUDGET_OPTIONS = ["under_10k","10k_50k","50k_200k","over_200k","in_kind_only","open"];
const TIMELINE_OPTIONS = ["immediately","within_1_month","1_3_months","3_6_months","no_fixed_timeline"];
const LEGAL_TYPE_OPTIONS = ["formal_mou","subcontracting","co_implementation","referral","joint_venture","informal","open"];
const EXCLUSIVITY_OPTIONS = ["multiple_partners","one_dedicated_partner"];
const LANGUAGE_OPTIONS = ["English","French","Portuguese","Arabic","Swahili","Other"];
const CAPACITY_OPTIONS = ["1_part_time","1_full_time","2_5_people","5_plus_people","tbd"];
const FUNDING_STATUS_OPTIONS = ["fully_funded","partially_funded","seeking_funding","partner_brings_funding"];

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

    let effectiveFreeText = free_text ?? "";
    if (document_base64) {
      const docRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_API_KEY}` },
        body: JSON.stringify({
          model: "openai/gpt-oss-120b",
          max_completion_tokens: 800,
          reasoning_effort: "low",
          messages: [{ role: "user", content: `Extract the key partnership-relevant content from this document. Return a plain text summary covering: what the organisation does, what partnerships they are seeking, sectors, locations, budget, timeline, needs, and offers. Be concise and factual. Do not invent details not in the document.\n\nDocument content:\n${document_type === "application/pdf" ? document_base64.slice(0, 8000) : atob(document_base64).slice(0, 8000)}` }],
        }),
      });
      const docData = await docRes.json();
      const extracted = docData.choices?.[0]?.message?.content?.trim() ?? "";
      if (extracted) effectiveFreeText = extracted + (free_text ? `\n\nAdditional context: ${free_text}` : "");
    }

    const prompt = `You are a partnership analyst for Impact Natives, a B2B social impact platform connecting African and global organisations.

Extract structured partnership intent from the user description below and return ONLY a valid JSON object. No markdown, no backticks, no explanation text before or after the JSON.

Allowed values:
- sectors: ${SECTOR_OPTIONS.join(", ")}
- needs: ${NEEDS_OPTIONS.join(", ")}
- offers: ${OFFERS_OPTIONS.join(", ")}
- country: ${COUNTRIES.join(", ")}
- organisation_type (pick one): ${ORG_TYPES.join(", ")}
- sdgs: integers 1-17
- partnership_stage (pick one): ${STAGE_OPTIONS.join(", ")}
- partnership_duration (pick one): ${DURATION_OPTIONS.join(", ")}
- partnership_budget (pick one): ${BUDGET_OPTIONS.join(", ")}
- partnership_decision_timeline (pick one): ${TIMELINE_OPTIONS.join(", ")}
- partnership_legal_type (pick multiple): ${LEGAL_TYPE_OPTIONS.join(", ")}
- partnership_exclusivity (pick one): ${EXCLUSIVITY_OPTIONS.join(", ")}
- partnership_language (pick multiple): ${LANGUAGE_OPTIONS.join(", ")}
- partnership_team_capacity (pick one): ${CAPACITY_OPTIONS.join(", ")}
- partnership_funding_status (pick one): ${FUNDING_STATUS_OPTIONS.join(", ")}

Return this exact JSON shape:
{"country":[],"sectors":[],"sdgs":[],"organisation_type":"","needs":[],"offers":[],"description":"","partnership_sought":"","partnership_stage":"","partnership_duration":"","partnership_budget":"","partnership_decision_timeline":"","partnership_legal_type":[],"partnership_exclusivity":"","partnership_language":[],"partnership_team_capacity":"","partnership_funding_status":"","partnership_geo_specificity":"","partnership_success_definition":"","partnership_theory_of_change":"","partnership_prior_attempts":"","partnership_constraints":""}

Rules:
- Only use values from the allowed lists above.
- Every array must have at least one item.
- Infer SDGs from sectors if not stated.
- partnership_theory_of_change: one sentence on how this org creates change.
- partnership_prior_attempts: extract if mentioned, otherwise write a brief plausible inference.
- partnership_constraints: extract donor/legal constraints, or write "No known constraints at this time."

User description: "${effectiveFreeText}"

Org profile context:
- Name: ${org_profile?.organisation_name || "Not provided"}
- Description: ${org_profile?.description || "Not provided"}
- Sector: ${Array.isArray(org_profile?.sector) ? org_profile.sector.join(", ") : org_profile?.sector || "Not provided"}
- Country: ${Array.isArray(org_profile?.country) ? org_profile.country.join(", ") : org_profile?.country || "Not provided"}
- Org type: ${org_profile?.organisation_type || "Not provided"}

Prioritise the user description. Return JSON only.`;

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_API_KEY}` },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        max_completion_tokens: 1500,
        reasoning_effort: "low",
        messages: [
          { role: "system", content: "Return only valid JSON matching the exact shape requested. No markdown, no backticks, no explanation." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return new Response(JSON.stringify({ error: `Groq API error: ${err}` }), {
        status: 502, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const data = await res.json();
    const rawText = data.choices?.[0]?.message?.content ?? "";

    if (!rawText) {
      return new Response(JSON.stringify({ error: "Model returned empty response.", debug: data }), {
        status: 422, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const stripped = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
    const jsonMatch = stripped.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return new Response(JSON.stringify({ error: "No JSON found in response.", raw: rawText }), {
        status: 422, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    let parsed;
    try { parsed = JSON.parse(jsonMatch[0]); }
    catch { return new Response(JSON.stringify({ error: "Could not parse JSON.", raw: rawText }), {
      status: 422, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    }); }

    return new Response(JSON.stringify({ prefilled: parsed }), {
      status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
});