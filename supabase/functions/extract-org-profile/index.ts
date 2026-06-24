const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") ?? "";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PROMPTS: Record<string, string> = {
  implementer: `You are extracting structured data from an organisational document for a social impact coordination platform in Africa. The document may be a concept note, annual report, organisational profile, or startup pitch deck.

Extract the following fields from the document. Return ONLY a valid JSON object with no markdown, no backticks, no explanation. If a field cannot be found, return null for that field.

{
  "organisation_name": "string or null",
  "description": "2-3 sentence summary of what the organisation does, where it works, and who it serves. Write in plain, direct language. No marketing speak.",
  "country": "primary country of operation or null",
  "sectors": ["array of sectors from this list only: Health, Education, Agriculture & Food Systems, Climate & Environment, Energy & Clean Tech, Water Sanitation & Hygiene, Financial Inclusion, Gender & Inclusion, Governance & Civic Tech, Livelihoods & Economic Empowerment, Technology & Innovation, Arts Culture & Creative Industries, Humanitarian & Emergency Response, Youth & Community Development"],
  "organisation_type": "one of: ngo_non_profit, social_enterprise, startup, technology_company, corporation, philanthropic_foundation, venture_capital, creative_agency_studio, public_sector, research_academic or null",
  "needs": ["array of 2-5 short strings describing what this organisation is seeking. e.g. Funding partner, Technical expertise in M&E, Pilot implementation sites"],
  "offers": ["array of 2-5 short strings describing what this organisation provides. e.g. Community mobilisation, Programme management, Data collection"],
  "sdg_tags": ["array of relevant SDG names from: No Poverty, Zero Hunger, Good Health and Well-being, Quality Education, Gender Equality, Clean Water and Sanitation, Affordable and Clean Energy, Decent Work and Economic Growth, Industry Innovation and Infrastructure, Reduced Inequalities, Sustainable Cities and Communities, Responsible Consumption and Production, Climate Action, Life Below Water, Life on Land, Peace Justice and Strong Institutions, Partnerships for the Goals"],
  "stage": "one of: concept, planning, active, scaling or null",
  "team_size": "one of: solo, 2-5, 6-20, 20+ or null",
  "year_founded": "integer year or null",
  "role_title": "the role or title of the person likely submitting this. e.g. Executive Director, Founder, Programme Manager or null",
  "investment_stage": "if this is a startup pitch deck, one of: Pre-Seed, Seed, Bridge, Series A, Series B, Beyond Series B or null",
  "business_model": "if this is a startup pitch deck, one of: Grant-funded, Revenue-generating, Hybrid, Pre-revenue or null. For NGOs default to Grant-funded if funding is mentioned.",
  "runway": "if this is a startup pitch deck and runway is mentioned, one of: Less than 6 months, 6-12 months, 12-24 months, 24+ months or null",
  "funding_ask": "if this is a startup pitch deck and a funding ask is mentioned, a single sentence describing how much they are raising and for what purpose or null"
}`,

  funder: `You are extracting structured data from a funding guidelines or investment thesis document for a social impact coordination platform in Africa.

Extract the following fields. Return ONLY a valid JSON object with no markdown, no backticks, no explanation. If a field cannot be found, return null.

{
  "organisation_name": "string or null",
  "description": "2-3 sentence summary of what this funder funds, where, and at what scale. Plain language.",
  "country": "country where the funder is headquartered or null",
  "sectors": ["array of sectors they fund from: Health, Education, Agriculture & Food Systems, Climate & Environment, Energy & Clean Tech, Water Sanitation & Hygiene, Financial Inclusion, Gender & Inclusion, Governance & Civic Tech, Livelihoods & Economic Empowerment, Technology & Innovation, Arts Culture & Creative Industries, Humanitarian & Emergency Response, Youth & Community Development"],
  "organisation_type": "one of: philanthropic_foundation, venture_capital, corporation, public_sector or null",
  "needs": ["array of 2-4 strings describing what they look for in partners. e.g. Verified NGO with 3 plus years track record, Initiatives with clear theory of change"],
  "offers": ["array of 2-4 strings describing what they provide. e.g. Grants up to $500K, Technical assistance, Co-funding facilitation"],
  "sdg_tags": ["relevant SDGs they fund"],
  "grant_range_min": "minimum grant or investment amount as integer or null",
  "grant_range_max": "maximum grant or investment amount as integer or null",
  "grant_currency": "currency code e.g. USD, GBP, EUR or null",
  "funding_instruments": ["array from: Grant, Concessional loan, Equity investment, Recoverable grant, Prize, Technical assistance"],
  "geographic_focus": ["array of countries or regions they fund"],
  "role_title": "likely role of the person submitting. e.g. Programme Officer, Investment Manager or null"
}`,

  corporate: `You are extracting structured data from a corporate sustainability or CSR report for a social impact coordination platform in Africa.

Extract the following fields. Return ONLY a valid JSON object with no markdown, no backticks, no explanation. If a field cannot be found, return null.

{
  "organisation_name": "string or null",
  "description": "2-3 sentence summary of the company's ESG or CSR focus and what kinds of partnerships they pursue.",
  "country": "headquarters country or null",
  "sectors": ["sectors relevant to their CSR focus from the standard list"],
  "organisation_type": "one of: corporation, technology_company, creative_agency_studio or null",
  "needs": ["what they are looking for. e.g. NGO implementation partners, ESG-aligned initiatives, Community programme leads"],
  "offers": ["what they provide. e.g. CSR funding, Employee volunteering, In-kind technology support"],
  "sdg_tags": ["SDGs they report against or commit to"],
  "csr_budget_range": "approximate annual CSR budget as string or null. e.g. $500K-$2M",
  "esg_frameworks": ["reporting frameworks they use. e.g. GRI, SASB, UN Global Compact, B Corp"],
  "geographic_focus": ["countries or regions where they operate CSR programmes"],
  "role_title": "likely role. e.g. Head of Sustainability, CSR Manager or null"
}`,

  research: `You are extracting structured data from a research institution profile or capability statement for a social impact coordination platform in Africa.

Extract the following fields. Return ONLY a valid JSON object with no markdown, no backticks, no explanation. If a field cannot be found, return null.

{
  "organisation_name": "string or null",
  "description": "2-3 sentence summary of the institution's research focus and what they contribute to partnerships.",
  "country": "country of the institution or null",
  "sectors": ["research sectors from the standard list"],
  "organisation_type": "research_academic or public_sector or null",
  "needs": ["what they are seeking. e.g. Implementation partners for field research, Funded research opportunities, Access to programme data"],
  "offers": ["what they provide. e.g. Impact evaluation, Survey design, Policy analysis, Data visualisation"],
  "sdg_tags": ["relevant SDGs"],
  "research_methods": ["methodologies they use. e.g. RCT, Mixed methods, Participatory research, Systematic review"],
  "role_title": "likely role. e.g. Research Director, Principal Investigator or null"
}`
};

async function extractDocxText(buffer: Uint8Array): Promise<string> {
  const { BlobReader, TextWriter, ZipReader } = await import(
    "https://deno.land/x/zipjs@v2.7.52/index.js"
  );
  const blob = new Blob([buffer]);
  const reader = new ZipReader(new BlobReader(blob));
  const entries = await reader.getEntries();
  const docEntry = entries.find((e: any) => e.filename === "word/document.xml");
  if (!docEntry) {
    await reader.close();
    throw new Error("Not a valid DOCX file");
  }
  const writer = new TextWriter();
  const xml = await docEntry.getData!(writer);
  await reader.close();
  const text = xml
    .replace(/<w:p[ >]/g, "\n<w:p>")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text;
}

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
    const { file_base64, file_type, track } = await req.json();

    if (!file_base64 || !file_type || !track) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: file_base64, file_type, track" }),
        { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    const prompt = PROMPTS[track];
    if (!prompt) {
      return new Response(
        JSON.stringify({ error: `Unknown track: ${track}. Must be one of: implementer, funder, corporate, research` }),
        { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    const binaryStr = atob(file_base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    let docText = "";

    if (file_type === "application/pdf") {
      // Extract text from PDF by reading the raw bytes for text content
      const pdfString = new TextDecoder("latin1").decode(bytes);
      const textMatches = pdfString.match(/\(([^)]{3,})\)/g) ?? [];
      docText = textMatches
        .map(m => m.slice(1, -1))
        .filter(t => /[a-zA-Z]{2,}/.test(t))
        .join(" ")
        .replace(/\\n/g, "\n")
        .replace(/\\t/g, " ")
        .trim();

      if (!docText || docText.length < 50) {
        return new Response(
          JSON.stringify({ error: "Could not extract readable text from this PDF. Try uploading a DOCX instead." }),
          { status: 422, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
        );
      }
    } else {
      docText = await extractDocxText(bytes);
      if (!docText || docText.length < 50) {
        return new Response(
          JSON.stringify({ error: "Could not extract readable text from this document. Try a PDF instead." }),
          { status: 422, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
        );
      }
    }

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        max_tokens: 1500,
        messages: [
          {
            role: "user",
            content: `${prompt}\n\nDocument content:\n\n${docText.slice(0, 8000)}`,
          },
        ],
      }),
    });

    if (!groqRes.ok) {
      const err = await groqRes.text();
      return new Response(
        JSON.stringify({ error: `Groq API error: ${err}` }),
        { status: 502, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    const groqData = await groqRes.json();
    const rawText = groqData.choices?.[0]?.message?.content ?? "";

    let extracted: Record<string, any>;
    try {
      const clean = rawText
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();
      extracted = JSON.parse(clean);
    } catch {
      return new Response(
        JSON.stringify({
          error: "Could not parse structured data from document. The document may be too short or unstructured.",
          raw: rawText,
        }),
        { status: 422, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    return new Response(JSON.stringify({ data: extracted }), {
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