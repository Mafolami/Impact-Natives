// supabase/functions/assess-initiative-brief/index.ts
//
// v11 (14 Oct 2026): legacy JWT keys disabled after a leak. Caller client
// uses the new publishable key. Groq call switched from max_tokens to
// max_completion_tokens + reasoning_effort "low" (same fix as every other
// gpt-oss-120b function).
// v9: verify_jwt on + Plus+ tier gate.
// v8: model swapped to openai/gpt-oss-120b.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function __envKeys(name: string): Record<string, string> {
  try { return JSON.parse(Deno.env.get(name) ?? "{}"); } catch { return {}; }
}
const PUBLISHABLE_KEY = __envKeys("SUPABASE_PUBLISHABLE_KEYS")["default"] ?? Object.values(__envKeys("SUPABASE_PUBLISHABLE_KEYS"))[0] ?? "";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = PUBLISHABLE_KEY;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function checkPlusAccess(req: Request): Promise<{ ok: true } | { ok: false; status: number; body: Record<string, unknown> }> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userError } = await callerClient.auth.getUser();
  if (userError || !user) {
    return { ok: false, status: 401, body: { error: "Unauthorized" } };
  }
  const { data: ownerId } = await callerClient.rpc("resolve_org_owner_id");
  if (!ownerId) {
    return { ok: false, status: 500, body: { error: "Could not resolve organisation identity" } };
  }
  const { data: org } = await callerClient.from("organizations").select("subscription_tier").eq("user_id", ownerId).maybeSingle();
  if (org?.subscription_tier === "free") {
    return {
      ok: false, status: 403,
      body: { error: "AI brief assessment requires a Plus plan or higher.", requires_upgrade: true, required_tier: "plus" },
    };
  }
  return { ok: true };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });

  const access = await checkPlusAccess(req);
  if (!access.ok) {
    return new Response(JSON.stringify(access.body), {
      status: access.status, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  try {
    const { title, problem, outcome, specific_ask, partnerships, sectors, budget, stage, had_prior_experience, impact_evidence } = await req.json();

    if (!title || !problem || !outcome) return new Response(
      JSON.stringify({ error: "title, problem and outcome are required" }),
      { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );

    const prompt = `You are reviewing an initiative brief submitted to a social impact partnership marketplace in Africa. Your job is to assess the quality of the brief from a funder or partner's perspective.

Initiative details:
Title: ${title}
Problem: ${problem}
Outcome: ${outcome}
Specific ask: ${specific_ask ?? "Not provided"}
Partnerships sought: ${partnerships?.join(", ") ?? "Not specified"}
Sectors: ${sectors?.join(", ") ?? "Not specified"}
Budget: ${budget ?? "Not provided"}
Stage: ${stage ?? "Not specified"}
Prior experience: ${had_prior_experience === true ? "Yes" : had_prior_experience === false ? "No" : "Not specified"}
Impact evidence: ${impact_evidence ?? "Not provided"}

Return ONLY a valid JSON object with these exact fields. No markdown, no backticks:

{
  "score": "strong" | "good" | "basic",
  "what_works": "1 sentence on the strongest element of this brief.",
  "improve": "1 specific, actionable suggestion to make this brief more compelling to funders. Be direct and concrete. Do not be vague."
}

Scoring guide:
- "strong": Clear specific problem, measurable outcome, concrete ask, budget or stage provided, prior experience noted, impact evidence included
- "good": Problem and outcome clear but ask is vague, or missing budget/stage or impact evidence
- "basic": Problem or outcome is vague, no specific ask, no impact evidence, minimal information for a funder to assess fit`;

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        max_completion_tokens: 1500,
        reasoning_effort: "low",
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

    let result: Record<string, any>;
    try {
      const clean = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
      result = JSON.parse(clean);
    } catch {
      return new Response(JSON.stringify({ error: "Could not parse response.", raw: rawText }), {
        status: 422, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    return new Response(JSON.stringify({ data: result }), {
      status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
});
