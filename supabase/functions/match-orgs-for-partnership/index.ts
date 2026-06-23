// supabase/functions/match-orgs-for-partnership/index.ts
// Matches a submitting org against all partnership-listed orgs
// Returns 3-5 ranked matches with rationale + fit score
// Also sends admin notification email

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
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

    // Fetch all partnership-listed orgs (excluding the submitter)
    const { data: candidates, error } = await supabase
      .from("organizations")
      .select("id, organisation_name, description, sector, country, organisation_type, needs, offers, sdgs, partnership_sought, website, email, verification_status")
      .eq("partnership_listed", true)
      .eq("status", "published")
      .neq("id", submitting_org.id);

    if (error) throw error;

    if (!candidates || candidates.length === 0) {
      await notifyAdmin(submitting_org, []);
      return new Response(JSON.stringify({ matches: [] }), {
        status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const prompt = `You are a partnership matching analyst for Impact Natives, a social impact platform focused on UK-Africa collaborations.

Your job: rank candidate organisations by partnership fit with the submitting organisation.

Scoring criteria (total 100):
- Complementary needs/offers (not duplicating the same thing): 35 points
- Sector alignment: 25 points
- SDG alignment: 20 points
- Geographic fit (UK-Africa bridge is a bonus): 10 points
- Stage/scale compatibility: 10 points

Return ONLY a valid JSON object. No markdown, no backticks, no explanation. Max 5 matches, min 1. Only include orgs with fit_score >= 45. Order by fit_score descending.

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
${candidates.map((c: any) => `---
ID: ${c.id}
Name: ${c.organisation_name}
Type: ${c.organisation_type}
Description: ${c.description || "N/A"}
Sectors: ${Array.isArray(c.sector) ? c.sector.join(", ") : c.sector || "N/A"}
Countries: ${Array.isArray(c.country) ? c.country.join(", ") : c.country || "N/A"}
Needs: ${Array.isArray(c.needs) ? c.needs.join(", ") : "N/A"}
Offers: ${Array.isArray(c.offers) ? c.offers.join(", ") : "N/A"}
SDGs: ${Array.isArray(c.sdgs) ? c.sdgs.join(", ") : "N/A"}
Partnership sought: ${c.partnership_sought || "N/A"}`).join("\n")}`;

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
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

    // Enrich matches with org details for the UI
    const matches = (parsed.matches ?? []).map((m: any) => {
      const org = candidates.find((c: any) => c.id === m.org_id);
      return { ...m, org };
    }).filter((m: any) => m.org);

    // Notify admin (non-fatal)
    await notifyAdmin(submitting_org, matches);

    return new Response(JSON.stringify({ matches }), {
      status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
});

async function notifyAdmin(submitting_org: any, matches: any[]) {
  try {
    const matchSummary = matches.length > 0
      ? matches.map((m: any) => `- ${m.org?.organisation_name} (score: ${m.fit_score}) — ${m.key_synergy}`).join("\n")
      : "No matches found on platform yet. Manual follow-up needed.";

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Impact Natives <noreply@impactnatives.com>",
        to: ["michafolami@gmail.com"],
        subject: `New partnership listing: ${submitting_org.organisation_name}`,
        text: `A new organisation has listed for partnership discovery.

Organisation: ${submitting_org.organisation_name}
Type: ${submitting_org.organisation_type}
Sectors: ${Array.isArray(submitting_org.sector) ? submitting_org.sector.join(", ") : submitting_org.sector}
Countries: ${Array.isArray(submitting_org.country) ? submitting_org.country.join(", ") : submitting_org.country}
Partnership sought: ${submitting_org.partnership_sought || "Not specified"}

AI matches found:
${matchSummary}

${matches.length === 0 ? "ACTION NEEDED: No current matches. Consider reaching out manually to facilitate." : "Platform has surfaced matches automatically."}

Review at: https://app.impactnatives.com/dashboard/admin`,
      }),
    });
  } catch (e) {
    console.error("Admin notify failed:", e);
  }
}