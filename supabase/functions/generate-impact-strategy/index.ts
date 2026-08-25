const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// --- Locked reference data: Telecom + FinTech, Nigeria only ---

const SECTOR_MATRIX: Record<string, { sasb_material_topics: string[]; ifrs_issb_reference: string }> = {
  technology_fintech: {
    sasb_material_topics: [
      "Data Privacy & Customer Privacy",
      "Data Security",
      "Financial Inclusion & Capacity Building",
    ],
    ifrs_issb_reference: "IFRS S1 (General Disclosures)",
  },
  telecommunications: {
    sasb_material_topics: [
      "Data Privacy",
      "Data Security",
      "Product End-of-Life Management",
      "Competitive Behaviour & Open Internet",
      "Managing Systemic Risks from Technology Disruptions",
    ],
    ifrs_issb_reference: "IFRS S1 (General Disclosures)",
  },
};

const COUNTRY_MATRIX: Record<string, Record<string, unknown>> = {
  nigeria: {
    primary_framework: "IFRS Sustainability Disclosure Standards (IFRS SDS), adopted via FRC Nigeria SRG1",
    srg1_effective_date: "2026-02-16",
    mandatory_disclosure_pies: "2028",
    sec_principles: {
      principle_1: "ESG Considerations",
      principle_2: "Collaborative Partnership and Capacity Building",
      principle_3: "Financing of priority sectors",
      principle_4: "Human rights, women's economic empowerment, job creation, financial inclusion",
      principle_5: "Reporting and Disclosures",
    },
    nccg_reference: "Part E, Principle 26 — sustainability issues for public companies",
  },
};

const AU_GOALS: Record<string, string> = {
  goal_7: "Environmentally sustainable and climate resilient economies and communities",
  goal_10: "World class infrastructure criss-crosses Africa",
  goal_18: "Engaged and empowered youth and children",
};

const REQUIRED_PILLAR_FIELDS = [
  "pillar_name",
  "corporate_input",
  "direct_output",
  "target_demographics",
  "measurable_outcome",
  "long_term_impact",
  "un_sdg_code",
  "sasb_material_topic",
  "specific_ask_draft",
  "suggested_partnerships",
] as const;

// --- Shared prompt rules ---

function sharedPillarRules(complianceBlock: string): string {
  return `
STRICT OUTPUT RULES:
1. Output valid JSON only. No prose, no markdown, no code fences, no preamble.
2. Generate 2-3 pillars maximum. Each must represent a distinct initiative area.
3. Return a JSON object with a single key "pillars" containing the array. Nothing else.

FIELD RULES — apply to every pillar:

pillar_name
  A short, specific initiative title. Not a category label.
  Bad: "Digital Inclusion". Good: "Digital Literacy for Informal Traders in Kano".

corporate_input
  The concrete resource the company deploys. Be specific.
  Bad: "Technology infrastructure and expertise".
  Good: "₦15M CSI budget + platform API infrastructure + 3 full-time programme staff".

direct_output
  The immediate deliverable. A countable thing that gets produced or delivered.
  Bad: "Deployment of digital literacy training programs".
  Good: "500 market women trained across 3 LGAs over 6 months".

target_demographics
  Who specifically benefits. Not a broad category.
  Bad: "Underserved communities". Good: "Informal market traders aged 18-45 in Lagos and Kano".

measurable_outcome
  A specific change with a number, percentage, and timeframe.
  Bad: "Number of individuals with improved digital literacy".
  Good: "40% of 500 trainees demonstrate improved digital literacy scores within 6 months of programme completion".

long_term_impact
  The systemic change 2-5 years out. Not a restatement of the outcome.
  Bad: "Improved financial inclusion". 
  Good: "Sustained reduction in financial exclusion rates among informal traders, contributing to a measurable increase in household income and savings behaviour in target communities".

un_sdg_code
  Full SDG name only. Format: "SDG [number]: [official goal name]".
  Bad: "8". Good: "SDG 8: Decent Work and Economic Growth".

sasb_material_topic
  The primary SASB material topic this pillar addresses. Use exact topic names.

specific_ask_draft
  One sentence. What a partner would physically do. Concrete location, number, action.
  Bad: "Partner with us to establish digital skills training programs".
  Good: "Deploy mobile training units to 3 LGAs in Kano, delivering 40-hour digital literacy curricula to 500 market women over 6 months".

suggested_partnerships
  Array of 1-2 values from: "funding", "technical", "operational", "leadership", "strategic", "lead".
  Match to what the pillar actually needs — data security needs "technical", financial inclusion needs "funding" + "operational".

au_agenda_2063_goal
  You may ONLY use one of these three exact strings. Copy the text exactly as written. Do not paraphrase, do not add prefixes like "Goal 18 —", do not use Aspiration numbers, do not invent new goals.
  ALLOWED VALUES:
  - "Environmentally sustainable and climate resilient economies and communities"
  - "World class infrastructure criss-crosses Africa"
  - "Engaged and empowered youth and children"
  - null (if none of the three fit)
  Any other value is a violation of these rules.
  Goal 7 — "Environmentally sustainable and climate resilient economies and communities":
    Use for: environment, climate, clean energy, sustainable production, e-waste.
  Goal 10 — "World class infrastructure criss-crosses Africa":
    Use for: digital infrastructure, connectivity, platform access, NGO capacity building, technology deployment.
  Goal 18 — "Engaged and empowered youth and children":
    Use for: youth employment, education, financial literacy, informal sector training, digital literacy for youth, economic inclusion for women, financial inclusion for informal traders.
  When a pillar fits Goal 10 AND Goal 18, pick the one that matches the primary beneficiary.
  If beneficiaries are youth or informal traders → Goal 18.
  If the primary output is infrastructure or platform access → Goal 10.
  Data privacy consumer awareness campaigns do not map cleanly to any AU goal — set null.
  Data privacy as a consumer right maps to SDG 16: Peace, Justice and Strong Institutions — not SDG 9.
  SDG 9 is for physical and digital infrastructure deployment, not consumer rights or awareness campaigns.

compliance_note
  ${complianceBlock}
  Cite ALL applicable frameworks — primary_framework, nccg_reference, and relevant sec_principles.
  When citing SEC principles, always use the full principle name, not just the number.
  Example: "SEC Principle 4: Human rights, women's economic empowerment, job creation, financial inclusion" not "SEC Principle 4".
  Do not cite only one. Do not invent citations not in the data above.`;
}

function buildComplianceBlock(countryData: Record<string, unknown> | null): string {
  if (!countryData) {
    return `No verified compliance data exists for this country. Set compliance_note to: "Compliance mapping not yet available for this jurisdiction. Consult your legal team."`;
  }
  return `Use only this verified country compliance data: ${JSON.stringify(countryData)}`;
}

// --- System prompts ---

function buildSystemPrompt(
  sectorData: { sasb_material_topics: string[]; ifrs_issb_reference: string },
  countryData: Record<string, unknown> | null
): string {
  const complianceBlock = buildComplianceBlock(countryData);
  return `You are generating a corporate social impact strategy for Impact Natives.

The company has provided their sector, country, core assets, and CSI budget.
Your job is to generate 2-3 initiative pillars grounded in their sector's SASB material topics.

SECTOR CONSTRAINT — pillars must draw only from these SASB material topics:
${sectorData.sasb_material_topics.map(t => `- ${t}`).join("\n")}

${sharedPillarRules(complianceBlock)}`;
}

function buildUploadSystemPrompt(countryData: Record<string, unknown> | null): string {
  const complianceBlock = buildComplianceBlock(countryData);
  return `You are converting an existing corporate social impact strategy into structured initiative pillars for Impact Natives.

The company has uploaded their strategy document. You have been given extracted data from it.
Your job is to generate 2-3 initiative pillars that reflect what the strategy actually says.
Do not invent initiatives not present in the strategy content. Do not apply sector constraints — use the strategy content as your guide.

${sharedPillarRules(complianceBlock)}`;
}

// --- Validation ---

function validatePillars(pillars: Record<string, unknown>[]): { valid: boolean; errors?: string[] } {
  const errors: string[] = [];
  const VALID_PARTNERSHIP_VALUES = ["funding", "technical", "operational", "leadership", "strategic", "lead"];

  if (pillars.length === 0 || pillars.length > 3) {
    errors.push(`Expected 1-3 pillars, got ${pillars.length}`);
  }

  pillars.forEach((p, i) => {
    REQUIRED_PILLAR_FIELDS.forEach((field) => {
      if (field === "suggested_partnerships") {
        const val = p[field];
        if (!Array.isArray(val) || val.length === 0 || !val.every((v) => VALID_PARTNERSHIP_VALUES.includes(v as string))) {
          errors.push(`Pillar ${i}: invalid "suggested_partnerships" — must be a non-empty array from the allowed list`);
        }
      } else if (!p[field] || typeof p[field] !== "string") {
        errors.push(`Pillar ${i}: missing or invalid field "${field}"`);
      }
    });
  });

  return { valid: errors.length === 0, errors: errors.length ? errors : undefined };
}

// --- Groq call with retry ---

async function callGroqWithRetry(
  systemPrompt: string,
  userPrompt: string
): Promise<Record<string, unknown>[] | null> {
  let messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        max_tokens: 4000,
        response_format: { type: "json_object" },
        messages,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Groq API error: ${err}`);
    }

    const data = await res.json();
    const rawText = data.choices?.[0]?.message?.content ?? "";
    const parsed = safeParsePillars(rawText);
    if (parsed) return parsed;

    messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
      { role: "assistant", content: rawText },
      {
        role: "user",
        content: 'Your last response was not valid JSON matching the required shape. Return only a JSON object with a "pillars" array, no prose, no markdown.',
      },
    ];
  }

  return null;
}

function safeParsePillars(rawText: string): Record<string, unknown>[] | null {
  try {
    const clean = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(clean);
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed.pillars)) return parsed.pillars;
    return null;
  } catch {
    return null;
  }
}

// --- RFP generation ---

function generateRFP(pillar: Record<string, unknown>, country: string, csiBudget?: string) {
  return {
    required_competency: pillar.sasb_material_topic as string,
    target_demographics: pillar.target_demographics as string,
    operating_region: country,
    target_metric: pillar.measurable_outcome as string,
    source_pillar: pillar.pillar_name as string,
    specific_ask_draft: pillar.specific_ask_draft as string,
    suggested_partnerships: pillar.suggested_partnerships as string[],
    csi_budget: csiBudget ?? null,
  };
}

// --- Database helpers ---

async function insertRFPAsDraft(
  rfp: {
    required_competency: string;
    sector: string;
    target_demographics: string;
    operating_region: string;
    target_metric: string;
    source_pillar: string;
    specific_ask_draft: string;
    suggested_partnerships: string[];
    csi_budget?: string | null;
  },
  organizationId: string
): Promise<{ id: string } | { error: string }> {
  const orgRes = await fetch(
    `${SUPABASE_URL}/rest/v1/organizations?id=eq.${organizationId}&select=name,user_id`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    }
  );
  const orgData = await orgRes.json();
  const org = orgData[0];
  if (!org) return { error: "Organization not found" };

  const profileRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${org.user_id}&select=full_name,email`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    }
  );
  const profileData = await profileRes.json();
  const profile = profileData[0] ?? {};

  const problemDraft = `Addressing ${rfp.required_competency.toLowerCase()} gaps for ${rfp.target_demographics.toLowerCase()} in ${rfp.operating_region}.`;

  const res = await fetch(`${SUPABASE_URL}/rest/v1/initiative_requests`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      title: rfp.source_pillar,
      sectors: [(rfp as any).sector ?? "Technology & Innovation"],
      locations: rfp.operating_region ? [rfp.operating_region] : [],
      target_population: rfp.target_demographics,
      budget: rfp.csi_budget ?? null,
      problem: problemDraft,
      outcome: rfp.target_metric,
      specific_ask: rfp.specific_ask_draft,
      partnerships: rfp.suggested_partnerships,
      status: "draft",
      source: "ai_generated",
      eois: 0,
      user_id: org.user_id,
      submitter_name: profile.full_name ?? "Unknown",
      submitter_org: org.name ?? "",
      submitter_email: profile.email ?? "",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return { error: err };
  }

  const data = await res.json();
  return { id: data[0].id };
}

async function saveStrategy(
  organizationId: string,
  pillars: Record<string, unknown>[],
  rfps: Record<string, unknown>[]
): Promise<string | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/organizations?id=eq.${organizationId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        impact_strategy: JSON.stringify({ pillars, rfps }),
      }),
    }
  );

  if (!res.ok) return await res.text();
  return null;
}

// --- Action handlers ---

async function handlePushPillar(body: any): Promise<Response> {
  const { organization_id, pillar } = body;

  if (!organization_id || !pillar) {
    return new Response(
      JSON.stringify({ error: "organization_id and pillar are required" }),
      { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );
  }

  const requiredFields = ["sasb_material_topic", "target_demographics", "measurable_outcome", "pillar_name", "specific_ask_draft", "suggested_partnerships"];
  const missing = requiredFields.filter((f) => !pillar[f]);
  if (missing.length > 0) {
    return new Response(
      JSON.stringify({ error: `Pillar missing required fields: ${missing.join(", ")}` }),
      { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );
  }

  // Map SASB material topics to real platform sectors — do not use SASB topic as sector directly
  const SASB_TO_SECTOR: Record<string, string> = {
    "Data Privacy & Customer Privacy": "Technology & Innovation",
    "Data Security": "Technology & Innovation",
    "Financial Inclusion & Capacity Building": "Financial Inclusion",
    "Data Privacy": "Technology & Innovation",
    "Product End-of-Life Management": "Climate & Environment",
    "Competitive Behaviour & Open Internet": "Governance & Civic Tech",
    "Managing Systemic Risks from Technology Disruptions": "Technology & Innovation",
  };
  const mappedSector = SASB_TO_SECTOR[pillar.sasb_material_topic as string] ?? "Technology & Innovation";

  const rfp = {
    required_competency: pillar.sasb_material_topic,
    sector: mappedSector,
    target_demographics: pillar.target_demographics,
    operating_region: pillar.operating_region ?? "",
    target_metric: pillar.measurable_outcome,
    source_pillar: pillar.pillar_name,
    specific_ask_draft: pillar.specific_ask_draft,
    suggested_partnerships: pillar.suggested_partnerships,
    csi_budget: pillar.csi_budget ?? null,
  };

  const result = await insertRFPAsDraft({ ...rfp, sector: mappedSector }, organization_id);

  if ("error" in result) {
    return new Response(JSON.stringify({ error: result.error }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  return new Response(JSON.stringify({ id: result.id }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

async function handleGenerateExecutiveSummary(body: any): Promise<Response> {
  const { organization_id, pillars, operating_country, csi_budget, org_name, sector_label } = body;

  if (!pillars || !Array.isArray(pillars) || pillars.length === 0) {
    return new Response(
      JSON.stringify({ error: "pillars are required to generate an executive summary" }),
      { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );
  }

  const countryKey = String(operating_country || "").toLowerCase();
  const countryData = COUNTRY_MATRIX[countryKey] ?? null;
  const complianceBlock = buildComplianceBlock(countryData);

  const pillarSummaries = pillars.map((p: any, i: number) => `
Pillar ${i + 1}: ${p.pillar_name}
- Corporate input: ${p.corporate_input}
- Direct output: ${p.direct_output}
- Target demographics: ${p.target_demographics}
- Measurable outcome: ${p.measurable_outcome}
- Long-term impact: ${p.long_term_impact}
- SDG: ${p.un_sdg_code}
- AU Agenda 2063: ${p.au_agenda_2063_goal ?? "Not applicable"}
- SASB topic: ${p.sasb_material_topic}
- Specific ask: ${p.specific_ask_draft}
`).join("\n");

  const prebuiltImpactGoals = pillars.map((p: any) =>
    `${p.measurable_outcome}`
  ).join(" ");

  const prebuiltStrategicApproach = pillars.map((p: any) =>
    `${p.pillar_name}: ${p.direct_output}`
  ).join(". ");

  const systemPrompt = `You are writing an executive summary for a corporate social impact strategy document. The pillars have already been confirmed by the company. Use only the data provided — do not invent numbers, frameworks, or citations.

Write in clear, direct, professional prose. Avoid buzzwords, hype, and generic statements. Every sentence must be specific to this company and these pillars.

Do not use the word "foster" or "real". Do not use "whether...or" constructions. Do not use "multi-faceted", "holistic", "leverage", "synergy", "impactful", "positive difference", "responsible business", or "stakeholders".

Do not invent specific details not in the pillar data — no invented hours, percentages, or counts. Use only numbers explicitly stated in the pillar summaries provided.

Do not invent SASB material topics. Use only the sasb_material_topic values from the pillar data.

CRITICAL: The pillar data below contains the ONLY numbers you are allowed to use. Every percentage, count, and timeframe in your response must match exactly what is stated in the pillar summaries. Do not round, adjust, combine, or invent any numbers. If a pillar says "30% of 200 trainees within 3 months", the summary must say exactly "30% of 200 trainees within 3 months" — not "30% improvement among 300 trainees" or any other variation. Copy the numbers verbatim.

Return a JSON object with exactly these 8 keys. Each value is a string of 2-3 sentences maximum:

introduction — Who the company is, what sector, and the primary objective of this strategy. Use EXACTLY the sector label provided in the user prompt. Do not infer or rephrase the sector name. If the label says "Technology / FinTech", use "Technology / FinTech" — not "finance", not "fintech", not "technology".

problem_statement — The specific challenges these pillars address. Ground this in the SASB material topics of the pillars. Explain why these issues matter to this sector specifically.

strategic_approach — What the company is actually doing across the three pillars. Reference the specific interventions, not generic ESG language.

impact_goals — Copy the measurable_outcome from each pillar verbatim, joined into 2-3 sentences. Do not paraphrase, round, or adjust any number, percentage, or timeframe. The reader will check these against the pillar outputs — any discrepancy is a factual error.

target_beneficiaries — Who benefits and where. Use the exact demographics and locations from the pillar data.

regulatory_alignment — Which frameworks this strategy aligns with. You MUST reference ALL of the following from the compliance data: the primary_framework, the nccg_reference, and at least two named SEC principles. Also reference the SDGs and AU Agenda 2063 goals from the pillars. Do not add frameworks not in the provided data. Do not omit the SEC principles or NCCG.

budget_allocation — State the total CSI budget only. Do not invent a per-pillar split. Do not divide the total by the number of pillars. If no split was provided, say the total budget will be allocated across pillars based on implementation plans. Do not invent any numbers not explicitly provided.

next_steps — Implementation steps, governance requirements, and reporting timeline. Reference SRG1's 2028 mandatory disclosure deadline for Public Interest Entities specifically.

${complianceBlock}`;

  const userPrompt = `Generate an executive summary for this corporate social impact strategy.

Company: ${org_name ?? "Not specified"}
Sector: ${sector_label ?? "Not specified"}
Operating country: ${operating_country ?? "Not specified"}
CSI budget: ${csi_budget ?? "Not specified"}

Confirmed pillars:
${pillarSummaries}

LOCKED VALUES — copy these exactly into the relevant fields, do not paraphrase or modify:

impact_goals (use this text verbatim, only add connecting words between sentences):
${prebuiltImpactGoals}

strategic_approach (use these facts, do not invent additional specifics):
${prebuiltStrategicApproach}`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "openai/gpt-oss-120b",
      max_tokens: 2000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return new Response(JSON.stringify({ error: `Groq API error: ${err}` }), {
      status: 502,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  const data = await res.json();
  const rawText = data.choices?.[0]?.message?.content ?? "";

  let summary: Record<string, string> | null = null;
  try {
    const clean = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
    summary = JSON.parse(clean);
  } catch {
    return new Response(
      JSON.stringify({ error: "Could not parse executive summary. Try again." }),
      { status: 502, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );
  }

  const saveRes = await fetch(
    `${SUPABASE_URL}/rest/v1/organizations?id=eq.${organization_id}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        impact_strategy: JSON.stringify({ pillars, executive_summary: summary }),
      }),
    }
  );

  if (!saveRes.ok) {
    return new Response(
      JSON.stringify({ error: "Generated but could not save summary." }),
      { status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );
  }

  return new Response(JSON.stringify({ executive_summary: summary }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

async function handleConvertUploadedStrategy(body: any): Promise<Response> {
  const { organization_id, parsed_strategy, operating_country } = body;

  if (!organization_id || !parsed_strategy) {
    return new Response(
      JSON.stringify({ error: "organization_id and parsed_strategy are required" }),
      { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );
  }

  const countryKey = String(operating_country || "").toLowerCase();
  const countryData = COUNTRY_MATRIX[countryKey] ?? null;
  const systemPrompt = buildUploadSystemPrompt(countryData);

  const userPrompt = `Convert this corporate strategy into initiative pillars.

Organisation: ${parsed_strategy.organisation_name ?? "Not specified"}
CSR focus: ${parsed_strategy.description ?? "Not specified"}
Budget range: ${parsed_strategy.csr_budget_range ?? "Not specified"}
ESG frameworks: ${parsed_strategy.esg_frameworks?.join(", ") ?? "Not specified"}
SDGs committed to: ${parsed_strategy.sdg_tags?.join(", ") ?? "Not specified"}
Geographic focus: ${parsed_strategy.geographic_focus?.join(", ") ?? "Not specified"}
Operating country: ${operating_country ?? "Not specified"}`;

  const pillars = await callGroqWithRetry(systemPrompt, userPrompt);

  if (!pillars) {
    return new Response(
      JSON.stringify({ error: "generation_failed", message: "Could not generate pillars from this strategy. Try again." }),
      { status: 502, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );
  }

  const validation = validatePillars(pillars);
  if (!validation.valid) {
    return new Response(
      JSON.stringify({ error: "schema_validation_failed", details: validation.errors }),
      { status: 502, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );
  }

  const saveError = await saveStrategy(organization_id, pillars, []);
  if (saveError) {
    return new Response(
      JSON.stringify({ error: "save_failed", message: saveError }),
      { status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );
  }

  return new Response(JSON.stringify({ pillars }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

async function handleRefineStrategy(body: any): Promise<Response> {
  const { organization_id, pillars, messages, operating_country, industry_sector } = body;

  if (!organization_id || !pillars || !messages?.length) {
    return new Response(
      JSON.stringify({ error: "organization_id, pillars, and messages are required" }),
      { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );
  }

  const countryKey = String(operating_country || "").toLowerCase();
  const countryData = COUNTRY_MATRIX[countryKey] ?? null;
  const sectorData = SECTOR_MATRIX[industry_sector] ?? null;
  const complianceBlock = buildComplianceBlock(countryData);

  const systemPrompt = `You are a strategy advisor helping a corporate refine their social impact pillars on Impact Natives. You are having a thoughtful, substantive conversation with the user.

The current pillars are provided in the first user message. As the conversation continues, follow these rules precisely:

RULE 1 — USER REQUESTS A CHANGE:
If the user explicitly asks you to change something, apply it immediately. Set "pillars" to the full updated array and "proposal" to null. In "reply", explain in 3-5 sentences: what you changed, why you made the specific choices you did, any trade-offs or compliance implications, and what they might want to consider next.

RULE 2 — YOU WANT TO SUGGEST AN ADDITIONAL CHANGE:
If you notice something that could be improved beyond what the user asked, do NOT apply it. Instead set "pillars" to null and "proposal" to a JSON object describing the suggestion. The user must confirm before you touch the pillars.

RULE 3 — USER CONFIRMS A PROPOSAL:
If the last assistant message contained a proposal and the user says yes/confirmed/go ahead or similar, apply the proposed changes. Set "pillars" to the updated array and "proposal" to null. Explain what was applied in "reply".

RULE 4 — QUESTIONS OR CLARIFICATIONS:
If the user asks a question or the instruction is ambiguous, set "pillars" to null, "proposal" to null, and answer fully in "reply".

The "proposal" object when present must have:
- "summary": 2-3 sentences describing exactly what would change and why
- "changes": array of objects, each with "pillar_name" (string) and "what_changes" (string describing the specific field changes in plain English)
- "proposed_pillars": the full pillars array with the proposed changes applied — this is what gets applied if the user confirms

${sectorData ? `SECTOR CONSTRAINT — pillars must still draw only from these SASB material topics:\n${sectorData.sasb_material_topics.map((t: string) => `- ${t}`).join("\n")}` : ""}

${sharedPillarRules(complianceBlock)}

STRICT OUTPUT RULES — NEVER VIOLATE:
1. Return ONLY a valid JSON object. No prose, no markdown, no text outside the JSON.
2. The JSON must have EXACTLY three keys: "reply", "pillars", "proposal".
3. "reply" is always a string.
4. "pillars" is either the full updated pillars array OR null. Never omit it.
5. "proposal" is either an object with keys "summary", "changes", "proposed_pillars" OR null. Never omit it.
6. NEVER describe a proposal inside "reply". If you want to suggest a change the user did not explicitly request, you MUST put it in "proposal" and set "pillars" to null.
7. If you write anything like "I suggest", "Here's a proposal", "we could", "consider" inside "reply", that is a violation — move it to "proposal" instead.

Example of a valid proposal response:
{"reply":"I noticed the current pillars don't cover environmental sustainability. I've prepared a proposal below for your review.","pillars":null,"proposal":{"summary":"Adding a tree-planting pillar targeting schools in Lagos to address SDG 15 and AU Agenda 2063 Goal 7.","changes":[{"pillar_name":"Urban Reforestation in Schools","what_changes":"New pillar added: 500 trees planted across 20 Lagos schools, targeting students aged 10-15, measurable outcome of 30% green coverage increase within 12 months."}],"proposed_pillars":[...]}}`;

  // Only inject pillar context on the first turn.
  // On subsequent turns the model already has it from conversation history.
  const isFirstTurn = messages.length === 1;

  const groqMessages = [
    { role: "system", content: systemPrompt },
    ...(isFirstTurn
      ? [
          {
            role: "user",
            content: `Current pillars:\n${JSON.stringify(pillars, null, 2)}\n\nConversation starts now. First instruction: ${messages[0].content}`,
          },
        ]
      : [
          {
            role: "user",
            content: `Current pillars (compact):\n${JSON.stringify(pillars.map((p: any) => ({ name: p.pillar_name, demographics: p.target_demographics, outcome: p.measurable_outcome })))}\n\nConversation starts now.`,
          },
          { role: "assistant", content: JSON.stringify({ reply: "Got it. What would you like to change?", pillars: null, proposal: null }) },
          ...messages.map((m: { role: string; content: string }) => ({
            role: m.role,
            content: m.content,
          })),
        ]
    ),
  ];

  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        max_tokens: 3000,
        response_format: { type: "json_object" },
        messages: groqMessages,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Groq API error:", err);
      return new Response(JSON.stringify({ error: `Groq API error: ${err}`, detail: err }), {
        status: 502,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const data = await res.json();
    const rawText = data.choices?.[0]?.message?.content ?? "";

    let parsed: { reply: string; pillars: any[] | null; proposal: any | null } | null = null;
    try {
      const clean = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
      parsed = JSON.parse(clean);
    } catch {
      continue;
    }

    if (!parsed?.reply) continue;

    if (parsed.pillars) {
      const validation = validatePillars(parsed.pillars);
      if (!validation.valid) {
        groqMessages.push(
          { role: "assistant", content: rawText },
          { role: "user", content: `The pillars you returned failed validation: ${validation.errors?.join(", ")}. Fix and return the corrected JSON.` }
        );
        continue;
      }
      const saveError = await saveStrategy(organization_id, parsed.pillars, []);
      if (saveError) {
        return new Response(JSON.stringify({ error: "save_failed", message: saveError }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        });
      }
    }

    // Validate proposed_pillars inside proposal if present
    if (parsed.proposal?.proposed_pillars) {
      const validation = validatePillars(parsed.proposal.proposed_pillars);
      if (!validation.valid) {
        parsed.proposal.proposed_pillars = null;
      }
    }

    return new Response(JSON.stringify({
      reply: parsed.reply,
      pillars: parsed.pillars ?? null,
      proposal: parsed.proposal ?? null,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  return new Response(
    JSON.stringify({ error: "refinement_failed", message: "Could not refine the strategy. Try again." }),
    { status: 502, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
  );
}

// --- Main handler ---

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST")
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });

  try {
    const body = await req.json();

    if (body.action === "push_pillar") {
      return handlePushPillar(body);
    }

    if (body.action === "convert_uploaded_strategy") {
      return handleConvertUploadedStrategy(body);
    }

    if (body.action === "refine_strategy") {
      return handleRefineStrategy(body);
    }

    if (body.action === "generate_executive_summary") {
      return handleGenerateExecutiveSummary(body);
    }

    const { organization_id, industry_sector, operating_country, core_assets, csi_budget } = body;

    if (!organization_id || !industry_sector) {
      return new Response(
        JSON.stringify({ error: "organization_id and industry_sector are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    const sectorData = SECTOR_MATRIX[industry_sector];
    if (!sectorData) {
      return new Response(
        JSON.stringify({
          error: "unsupported_sector",
          message: "Strategy Builder currently supports Technology/FinTech and Telecommunications only.",
        }),
        { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    const countryKey = String(operating_country || "").toLowerCase();
    const countryData = COUNTRY_MATRIX[countryKey] ?? null;
    const systemPrompt = buildSystemPrompt(sectorData, countryData);

    const SECTOR_LABELS: Record<string, string> = {
      technology_fintech: "Technology / FinTech",
      telecommunications: "Telecommunications",
    };

    const userPrompt = `Industry sector: ${SECTOR_LABELS[industry_sector] ?? industry_sector}
Operating country: ${operating_country}
Core competencies/assets: ${core_assets}
CSI budget or target: ${csi_budget}`;

    const pillars = await callGroqWithRetry(systemPrompt, userPrompt);

    if (!pillars) {
      return new Response(
        JSON.stringify({ error: "generation_failed", message: "Could not generate a valid strategy after retry." }),
        { status: 502, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    const validation = validatePillars(pillars);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: "schema_validation_failed", details: validation.errors }),
        { status: 502, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    const rfps = pillars.map((p: Record<string, unknown>) => generateRFP(p, operating_country, csi_budget));

    const saveError = await saveStrategy(organization_id, pillars, rfps);
    if (saveError) {
      return new Response(JSON.stringify({ error: "save_failed", message: saveError }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    return new Response(JSON.stringify({ pillars, rfps }), {
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