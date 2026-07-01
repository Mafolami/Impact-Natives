// supabase/functions/generate-impact-strategy/index.ts

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
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
] as const;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST")
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });

  try {
    const { organization_id, industry_sector, operating_country, core_assets, csi_budget } = await req.json();

    if (!organization_id || !industry_sector) {
      return new Response(
        JSON.stringify({ error: "organization_id and industry_sector are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    // Sector gate
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
    const userPrompt = `Industry sector: ${industry_sector}
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

    const rfps = pillars.map((p: Record<string, string>) => generateRFP(p, operating_country));

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

function buildSystemPrompt(
  sectorData: { sasb_material_topics: string[]; ifrs_issb_reference: string },
  countryData: Record<string, unknown> | null
): string {
  const complianceBlock = countryData
    ? `Use only this country compliance data. Do not invent citations: ${JSON.stringify(countryData)}`
    : `No verified compliance data exists for this country. Set "compliance_note" on every pillar to "Compliance mapping not yet available for this country." Do not invent regulatory citations.`;

  return `You are generating a corporate social impact strategy for Impact Natives.

STRICT RULES:
1. Output valid JSON only. No prose, no markdown, no code fences, no preamble.
2. Pillars must draw only from these SASB material topics: ${sectorData.sasb_material_topics.join(", ")}.
3. ${complianceBlock}
4. Only assign an au_agenda_2063_goal if it clearly matches one of these: ${JSON.stringify(AU_GOALS)}. Otherwise set it to null. Do not guess.
5. Generate 2-3 pillars maximum.
6. Each pillar must be a JSON object with exactly these fields: pillar_name, corporate_input, direct_output, target_demographics, measurable_outcome, long_term_impact, un_sdg_code, sasb_material_topic, au_agenda_2063_goal, compliance_note.

Return a JSON object with a single key "pillars", containing the array. Nothing else.`;
}

async function callGroqWithRetry(
  systemPrompt: string,
  userPrompt: string
): Promise<Record<string, string>[] | null> {
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
        model: "llama-3.3-70b-versatile",
        max_tokens: 2000,
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
        content:
          'Your last response was not valid JSON matching the required shape. Return only a JSON object with a "pillars" array, no prose, no markdown.',
      },
    ];
  }

  return null;
}

function safeParsePillars(rawText: string): Record<string, string>[] | null {
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

function validatePillars(pillars: Record<string, string>[]): { valid: boolean; errors?: string[] } {
  const errors: string[] = [];

  if (pillars.length === 0 || pillars.length > 3) {
    errors.push(`Expected 1-3 pillars, got ${pillars.length}`);
  }

  pillars.forEach((p, i) => {
    REQUIRED_PILLAR_FIELDS.forEach((field) => {
      if (!p[field] || typeof p[field] !== "string") {
        errors.push(`Pillar ${i}: missing or invalid field "${field}"`);
      }
    });
  });

  return { valid: errors.length === 0, errors: errors.length ? errors : undefined };
}

function generateRFP(pillar: Record<string, string>, country: string) {
  return {
    required_competency: pillar.sasb_material_topic,
    target_demographics: pillar.target_demographics,
    operating_region: country,
    target_metric: pillar.measurable_outcome,
    source_pillar: pillar.pillar_name,
  };
}

async function saveStrategy(
  organizationId: string,
  pillars: Record<string, string>[],
  rfps: Record<string, string>[]
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
      body: JSON.stringify({ impact_strategy: JSON.stringify({ pillars, rfps }) }),
    }
  );

  if (!res.ok) return await res.text();
  return null;
}