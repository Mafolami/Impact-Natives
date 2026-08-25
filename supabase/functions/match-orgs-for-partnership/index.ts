// supabase/functions/match-orgs-for-partnership/index.ts
// Matches a submitting org against all partnership-listed orgs
// Returns 3-5 ranked matches with rationale + fit score

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });

  try {
    const { submitting_org, user_id } = await req.json();

    if (!submitting_org) return new Response(
      JSON.stringify({ error: "submitting_org is required" }),
      { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Fetch all published orgs with either a real profile or a listed partnership request,
    // including type-specific mandate/CSR/track-record fields for richer matching
    const { data: rawCandidates, error } = await supabase
      .from("organizations")
      .select("id, organisation_name, description, sector, country, organisation_type, needs, offers, sdgs, website, email, verification_status, partnership_listed, partnership_sought, partnership_stage, partnership_duration, partnership_budget, partnership_decision_timeline, partnership_working_style, partnership_financial_transfer, partnership_team_capacity, partnership_success_definition, investment_thesis, grant_range_min, grant_range_max, grant_currency, stage_preference, geographic_focus, csr_focus_statement, csr_budget_range, esg_frameworks, inkind_support, partner_type_preference, employee_engagement_available, cobranding_open, tech_support_available, sandbox_ready, sandbox_description, dd_financial_model, dd_audited_accounts, dd_governance_doc, dd_esg_assessment, dd_impact_framework, total_beneficiaries_reached, jobs_created, years_of_operation, grants_received_count, grants_total_value_usd, grants_delivered_on_time_pct, previous_funders, third_party_evaluations")
      .eq("status", "published")
      .neq("id", submitting_org.id);
    if (error) throw error;

    // Exclude orgs with neither a substantive profile nor a listed partnership request,
    // and exclude obvious placeholder/test data (e.g. lorem ipsum, too short to be real)
    function looksLikePlaceholder(text: string | null | undefined): boolean {
      if (!text) return false;
      const t = text.toLowerCase().trim();
      const placeholderPatterns = [
        "lorem ipsum",
        "test test",
        "asdf",
        "qwerty",
        "xxxxx",
        "placeholder",
        "n/a",
        "sample text",
        "dummy text",
        "todo",
      ];
      return placeholderPatterns.some(p => t.includes(p));
    }

    const candidates = (rawCandidates ?? []).filter((c: any) => {
      if (looksLikePlaceholder(c.description)) return false;
      const hasProfile = !!(c.description || (c.needs?.length) || (c.offers?.length) || (c.sdgs?.length));
      const hasListedPartnership = c.partnership_listed && !!c.partnership_sought;
      return hasProfile || hasListedPartnership;
    });

    if (!candidates || candidates.length === 0) {
      return new Response(JSON.stringify({ matches: [] }), {
        status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const prompt = `You are a partnership matching analyst for Impact Natives, a social impact platform focused on UK-Africa collaborations.
Your job: rank candidate organisations by REAL, LOGICAL fit with the submitting organisation's specific new partnership request below — not by superficial similarity like shared continent or generic sector adjacency.

Each candidate may have (a) a general profile (description, needs, offers, sector, SDGs), (b) their own listed partnership request (what THEY are seeking — their partnership_sought, stage, budget, working style, etc.), or both. Use whichever source is actually populated for that candidate. If a candidate only has a listed partnership request and a sparse/empty profile, base their score and rationale entirely on how their own request correlates with the submitter's request. Do not invent profile details that aren't given.

Scoring criteria (total 100):
- Logical correlation between what the submitter needs and what this candidate can concretely provide, based on their type-specific data (funder mandate, CSR focus, or implementer track record/offers) above: 45 points
- Complementary needs/offers, not duplicated focus: 20 points
- Practical compatibility — budget/grant range, timeline, stage, working style, geographic focus if both have stated these: 20 points
- Sector or SDG relevance to the submitter's specific request: 15 points (this alone is never enough to justify a strong match — shared sector or SDG tags without genuine capability or need alignment should not push a score above 50)

Be honest and specific in the rationale: name the exact detail that creates the fit (e.g. a specific listed need, a specific offer, a specific stated partnership ask) rather than vague language like "aligns with" or "could support." If the correlation is weak, score it low — do not inflate scores for organisations that merely operate in the same country or broad sector.

Watch specifically for this failure pattern: describing two organisations as similar because they share an abstract theme (e.g. both "community-based," both "rural," both "scale their work," both "impact-focused") when their actual needs, offers, and sectors have no real overlap. This kind of language sounds like a fit but is not one — a mental health NGO and a livestock farming project are NOT a match just because both work in rural communities. If you catch yourself writing a rationale that could apply to almost any two organisations regardless of what they actually do, the real fit_score is below 45, and the candidate should be excluded.

CRITICAL — organisational type compatibility: before scoring, check whether this candidate's organisation_type is structurally capable of providing what the sender is actually asking for. NGOs and non-profits generally operate on restricted grant funding and typically cannot provide direct financial capital, investment, or discretionary funding to another organisation's project — even a mission-aligned one — because they don't hold that kind of capital. If the sender is seeking financial backing/investment/funding, only score highly (and only if other criteria also genuinely fit) candidates whose organisation_type is capable of providing that: venture capital, philanthropic foundation, corporation, or an organisation that explicitly states funding/grant-making as an offer in their profile. An NGO whose only real connection is thematic (rural, community-based, social impact) but has no financial capacity to give and no technical expertise in the sender's actual sector should score well below 45, regardless of how compelling the thematic language sounds. The same logic applies to technical expertise: do not claim a candidate can provide technical support in a domain (e.g. livestock farming, veterinary practices, agricultural technology) unless their profile, needs, or offers actually state relevant expertise in that domain.

Work through the scoring criteria internally to arrive at your fit_score, but the "rationale" field must contain ONLY natural, customer-facing prose describing the fit — 1-2 sentences. NEVER include your scoring breakdown, point allocations, or phrases like "points are awarded for" in the rationale. The rationale is shown directly to a real person deciding whether to reach out; it must read like a human wrote it, not like a scoring worksheet.

If a candidate's description, needs, and offers are all empty, missing, incoherent, or nonsensical (garbled text, keyboard-mashing, contradictory or illogical statements that don't describe a real organisation), you MUST score them below 45 regardless of country, sector, or SDG overlap. Shared geography or sector alone is never sufficient for a real match — there must be genuine, coherent substance in their profile or their own partnership request to justify a score of 45 or above. A short but clear, coherent description (even one sentence) is acceptable and should be judged on its actual content, not penalized for brevity alone.

Return ONLY a valid JSON object. No markdown, no backticks, no explanation, no comments (// or /* */), no duplicate keys, no placeholder values. If you are uncertain about a candidate, simply exclude them from the matches array rather than including a partial or uncertain entry. Every object in the matches array must have exactly these four keys: org_id, fit_score, rationale, key_synergy. Include every candidate with fit_score >= 45, no maximum. Order by fit_score descending.

{
  "matches": [
    {
      "org_id": "<uuid>",
      "fit_score": <integer 0-100>,
      "rationale": "<2-3 sentence explanation specific to both orgs' stated needs and offers>",
      "key_synergy": "<one short phrase, e.g. Field access + Funding gap>"
    }
  ]
}

Submitting organisation:
Name: ${submitting_org.organisation_name}
Type: ${submitting_org.organisation_type}
Description: ${submitting_org.description || "Not provided"}
Sectors: ${Array.isArray(submitting_org.sector) ? submitting_org.sector.join(", ") : submitting_org.sector || "Not provided"}
Countries: ${Array.isArray(submitting_org.country) ? submitting_org.country.join(", ") : submitting_org.country || "Not provided"}
Needs: ${Array.isArray(submitting_org.needs) ? submitting_org.needs.join(", ") : "Not provided"}
Offers: ${Array.isArray(submitting_org.offers) ? submitting_org.offers.join(", ") : "Not provided"}
SDGs: ${Array.isArray(submitting_org.sdgs) ? submitting_org.sdgs.join(", ") : "Not provided"}
Partnership sought: ${submitting_org.partnership_sought || "Not specified"}

Candidate organisations:
${candidates.map((c: any) => {
  const FUNDER_TYPES = ["philanthropic_foundation", "venture_capital"];
  const CORPORATE_TYPES = ["corporation", "technology_company", "public_sector"];
  const isFunderType = FUNDER_TYPES.includes(c.organisation_type);
  const isCorporateType = CORPORATE_TYPES.includes(c.organisation_type);
  const isImplementerType = !isFunderType && !isCorporateType;

  let typeSpecificBlock = "";

  if (isFunderType) {
    typeSpecificBlock = `This candidate is a FUNDER (${c.organisation_type}). Funder-specific data:
  Investment thesis: ${c.investment_thesis || "Not provided"}
  Grant/investment range: ${c.grant_range_min || c.grant_range_max ? `${c.grant_range_min ?? "?"} - ${c.grant_range_max ?? "?"} ${c.grant_currency || ""}` : "Not provided"}
  Stage preference: ${Array.isArray(c.stage_preference) && c.stage_preference.length ? c.stage_preference.join(", ") : "Not provided"}
  Geographic focus: ${Array.isArray(c.geographic_focus) && c.geographic_focus.length ? c.geographic_focus.join(", ") : "Not provided"}
  IMPORTANT: this candidate can only meaningfully fund/invest if the sender's ask fits their stated grant range, stage preference, and geographic focus above. A funder with no stated thesis or range provided should not be assumed capable of funding — score accordingly.`;
  } else if (isCorporateType) {
    typeSpecificBlock = `This candidate is a CORPORATE/CSR partner (${c.organisation_type}). CSR-specific data:
  CSR/ESG focus statement: ${c.csr_focus_statement || "Not provided"}
  CSR/ESG budget range: ${c.csr_budget_range || "Not provided"}
  ESG frameworks: ${Array.isArray(c.esg_frameworks) && c.esg_frameworks.length ? c.esg_frameworks.join(", ") : "Not provided"}
  What they can bring to a partnership: ${Array.isArray(c.inkind_support) && c.inkind_support.length ? c.inkind_support.join(", ") : "Not provided"}
  Preferred partner types: ${Array.isArray(c.partner_type_preference) && c.partner_type_preference.length ? c.partner_type_preference.join(", ") : "Not provided"}
  Geographic focus: ${Array.isArray(c.geographic_focus) && c.geographic_focus.length ? c.geographic_focus.join(", ") : "Not provided"}
  Open to employee engagement: ${c.employee_engagement_available ? "Yes" : "Not stated"}
  Open to co-branding: ${c.cobranding_open ? "Yes" : "Not stated"}
  ${c.organisation_type === "technology_company" ? `Tech resources offered: ${Array.isArray(c.tech_support_available) && c.tech_support_available.length ? c.tech_support_available.join(", ") : "Not provided"}
  Sandbox/beta testing available: ${c.sandbox_ready ? `Yes — ${c.sandbox_description || "no description given"}` : "Not stated"}` : ""}
  IMPORTANT: this candidate can only meaningfully partner if the sender's ask fits their stated CSR focus, budget, and what they've indicated they can bring. A corporate with no stated CSR focus or budget provided should not be assumed capable of funding or in-kind support — score accordingly.`;
  } else if (isImplementerType) {
    const ddScore = [c.dd_financial_model, c.dd_audited_accounts, c.dd_governance_doc, c.dd_esg_assessment, c.dd_impact_framework].filter(Boolean).length;
    typeSpecificBlock = `This candidate is an IMPLEMENTER (${c.organisation_type}). Track record and readiness data:
  Beneficiaries reached: ${c.total_beneficiaries_reached ?? "Not provided"}
  Jobs created: ${c.jobs_created ?? "Not provided"}
  Years of operation: ${c.years_of_operation ?? "Not provided"}
  Grants/contracts received: ${c.grants_received_count ?? "Not provided"}${c.grants_total_value_usd ? ` totaling $${c.grants_total_value_usd}` : ""}
  Delivered on time: ${c.grants_delivered_on_time_pct != null ? `${c.grants_delivered_on_time_pct}%` : "Not provided"}
  Previous funders: ${Array.isArray(c.previous_funders) && c.previous_funders.length ? c.previous_funders.join(", ") : "Not provided"}
  Third-party evaluations available: ${c.third_party_evaluations ? "Yes" : "Not stated"}
  Due diligence readiness: ${ddScore}/5 items complete`;
  }

  return `---
ID: ${c.id}
Name: ${c.organisation_name}
Type: ${c.organisation_type}
Description: ${c.description || "N/A"}
Sectors: ${Array.isArray(c.sector) ? c.sector.join(", ") : c.sector || "N/A"}
Countries: ${Array.isArray(c.country) ? c.country.join(", ") : c.country || "N/A"}
Needs: ${Array.isArray(c.needs) ? c.needs.join(", ") : "N/A"}
Offers: ${Array.isArray(c.offers) ? c.offers.join(", ") : "N/A"}
SDGs: ${Array.isArray(c.sdgs) ? c.sdgs.join(", ") : "N/A"}
${typeSpecificBlock}
${c.partnership_listed && c.partnership_sought ? `This candidate has ALSO listed their own partnership request:
  What they're seeking: ${c.partnership_sought}
  Stage: ${c.partnership_stage || "N/A"}
  Duration: ${c.partnership_duration || "N/A"}
  Budget: ${c.partnership_budget || "N/A"}
  Decision timeline: ${c.partnership_decision_timeline || "N/A"}
  Working style: ${c.partnership_working_style || "N/A"}
  Financial arrangement: ${c.partnership_financial_transfer || "N/A"}
  Team capacity: ${c.partnership_team_capacity || "N/A"}
  Success definition: ${c.partnership_success_definition || "N/A"}` : "This candidate has not listed their own partnership request — base fit only on their general profile above."}`;
}).join("\n")}`;

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        max_tokens: 2000,
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

    let parsed: any;
    try {
      const clean = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
      parsed = JSON.parse(clean);
    } catch {
      return new Response(JSON.stringify({ error: "Could not parse response.", raw: rawText }), {
        status: 422, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    // Enrich matches with org details for the UI, deduplicating by org_id
    // (the model occasionally returns the same org twice, e.g. once for
    // general profile fit and once for their own listed partnership request)
    const seenOrgIds = new Set<string>();
    const matches = (parsed.matches ?? [])
      .map((m: any) => {
        const org = candidates.find((c: any) => c.id === m.org_id);
        return { ...m, org };
      })
      .filter((m: any) => {
        if (!m.org) return false;
        if (typeof m.fit_score !== "number" || m.fit_score < 45) return false;
        if (seenOrgIds.has(m.org_id)) return false;
        seenOrgIds.add(m.org_id);
        return true;
      });

    return new Response(JSON.stringify({ matches }), {
      status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
});
