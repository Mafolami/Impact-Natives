const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") ?? "";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  try {
    const { form } = await req.json();

    const PARTNERSHIP_LABELS: Record<string, string> = {
      funding: "Funding", technical: "Technical", operational: "Operational",
      leadership: "Leadership", strategic: "Strategic", lead: "Project Lead",
    };

    const prompt = `You are writing a structured concept note in HTML for a social impact initiative in Africa. This will be published on a partnership marketplace and viewed by funders and partners.

CRITICAL RULES:
1. Return ONLY valid HTML. Start immediately with <h2>Executive Summary</h2>.
2. Use ONLY these tags: <h2> <h3> <p> <ul> <li> <strong>. Nothing else.
3. No plain text outside tags. No markdown. No code fences. No preamble.
4. Every section MUST be present. Every section MUST start with an <h2> tag.
5. Obey the word limits per section. Do not exceed them.
6. Never use placeholder text like [Name] or [Organisation]. Use actual values or omit entirely.

Sections and word limits:

<h2>Executive Summary</h2>
Max 60 words. What this does, where, and why a partner should care.

<h2>Problem Statement</h2>
Max 120 words. The challenge, its scale, and why existing responses are insufficient.

<h2>Proposed Solution</h2>
Max 150 words. The approach, methodology, and what makes it distinct.

<h2>Target Beneficiaries</h2>
Max 80 words. Who is served, numbers, demographics, geography. If target beneficiary count is provided, state it explicitly.

<h2>Expected Outcomes and Impact</h2>
<ul> of exactly 4 items. Max 20 words each. If target metrics are provided (beneficiaries, jobs, female %, timeline), reference them directly in the outcomes.

<h2>Monitoring and Evaluation</h2>
<ul> of exactly 4 items covering: key indicators, data collection methods, reporting frequency, data management.

<h2>Sustainability Plan</h2>
Max 100 words. How the initiative continues beyond initial funding. For revenue-generating entities, focus on business model viability.

<h2>Partnership Requirements</h2>
Max 100 words. Concrete description of the partner role, contribution, and time commitment.

<h2>Budget Overview</h2>
Max 80 words. Budget range and how funds will be deployed across key cost categories.

<h2>Implementation Timeline</h2>
<ul> of exactly 3-4 phases with durations and key milestones.

<h2>Team and Track Record</h2>
Max 80 words. Who leads this and relevant experience. If impact evidence is provided, reference it here to demonstrate credibility.

<h2>SDG Alignment</h2>
<ul> of the relevant SDGs and one sentence each on how this initiative contributes.

---

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
ESG: ${form.esg === true ? "Open to corporate ESG/CSR adoption" : "Not seeking ESG alignment"}
Impact evidence: ${form.impactEvidence || "Not provided"}
Target metrics:
- Target beneficiaries to reach: ${form.targetBeneficiaries || "Not specified"}
- Jobs to be created: ${form.targetJobs || "Not specified"}
- Female beneficiaries target: ${form.targetFemalePct ? form.targetFemalePct + "%" : "Not specified"}
- Target timeline: ${form.targetTimelineMonths ? form.targetTimelineMonths + " months" : "Not specified"}

Use the target metrics and impact evidence throughout the concept note where relevant — especially in Target Beneficiaries, Expected Outcomes, and Team and Track Record sections.`;

    const claudeRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        max_tokens: 4000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await claudeRes.json();
    const description = data.choices?.[0]?.message?.content?.trim() ?? "";

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
