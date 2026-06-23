const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  try {
    const { form } = await req.json();

    const PARTNERSHIP_LABELS: Record<string, string> = {
      funding: "Funding", technical: "Technical", operational: "Operational",
      leadership: "Leadership", strategic: "Strategic", lead: "Project Lead",
    };

    const prompt = `You are writing a structured concept note in HTML format for a social impact initiative in Africa. This will be published on a partnership marketplace and viewed by funders and partners.

CRITICAL: You must return valid HTML only. Start immediately with <h2>Executive Summary</h2>. Use only these tags: <h2> <h3> <p> <ul> <li> <strong>. No plain text sections. No markdown. No code fences. Every section heading must be an <h2> tag.

Write all 12 sections below. For any missing information, make a reasonable inference from context.

<h2>Executive Summary</h2>
2-3 sentences. What this does, where, and why a partner should care.

<h2>Problem Statement</h2>
The challenge, its scale, and why existing responses are insufficient. 2-3 paragraphs.

<h2>Proposed Solution</h2>
The approach, methodology, and what makes it distinct. 2-3 paragraphs.

<h2>Target Beneficiaries</h2>
Who is served, numbers, demographics, geography.

<h2>Expected Outcomes and Impact</h2>
<ul> of 4-5 specific measurable outcomes.

<h2>Monitoring and Evaluation</h2>
<ul> covering: key performance indicators, data collection methods, reporting frequency, data management approach.

<h2>Sustainability Plan</h2>
How the initiative continues beyond initial funding. Revenue model, community ownership, or institutional anchoring.

<h2>Partnership Requirements</h2>
Concrete description of the partner role, contribution, and time commitment.

<h2>Budget Overview</h2>
Budget range and how funds will be deployed across key cost categories.

<h2>Implementation Timeline</h2>
<ul> of phases with durations and key milestones.

<h2>Team and Track Record</h2>
Who leads this and what relevant experience they bring.

<h2>SDG Alignment</h2>
Which SDGs this contributes to and how.

Initiative details:
Title: ${form.title}
Problem: ${form.problem}
Outcome: ${form.outcome}
Who it serves: ${form.targetPopulation || "Not specified"}
Sectors: ${form.sectors?.join(", ") || "Not specified"}
Locations: ${form.locations?.join(", ") || "Not specified"}
Stage: ${form.stage || "Not specified"}
Partnerships sought: ${form.partnerships?.map((p: string) => PARTNERSHIP_LABELS[p] ?? p).join(", ") || "Not specified"}
Specific ask: ${form.specificAsk || "Not specified"}
Prior experience: ${form.hadPriorExperience === true ? "Yes" : form.hadPriorExperience === false ? "No" : "Not specified"}
${form.priorExperienceDetail ? `Prior experience detail: ${form.priorExperienceDetail}` : ""}
Budget: ${form.budgetMin || form.budgetMax ? `${form.currency} ${form.budgetMin}–${form.budgetMax}` : "Not specified"}
Duration: ${form.duration || "Not specified"}
SDGs: ${form.sdgTags?.join(", ") || "Not specified"}
ESG: ${form.esg === true ? "Open to corporate ESG/CSR adoption" : "Not seeking ESG alignment"}`;

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await claudeRes.json();
    const description = data.content?.[0]?.text?.trim() ?? "";

    return new Response(JSON.stringify({ description }), {
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
