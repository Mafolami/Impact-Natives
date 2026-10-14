// supabase/functions/refine-partnership-indicator/index.ts
//
// v5 (14 Oct 2026): legacy JWT keys disabled after a leak. Uses the new
// publishable key (caller client) and secret key (service client).
// v3: Plus+ tier gate. v2: atomic increment_draft_refine_count() RPC.
// v1: SMART check + tightened suggestion, capped at ~3 refines.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function __envKeys(name: string): Record<string, string> {
  try { return JSON.parse(Deno.env.get(name) ?? "{}"); } catch { return {}; }
}
const SECRET_KEY = __envKeys("SUPABASE_SECRET_KEYS")["default"] ?? Object.values(__envKeys("SUPABASE_SECRET_KEYS"))[0] ?? "";
const PUBLISHABLE_KEY = __envKeys("SUPABASE_PUBLISHABLE_KEYS")["default"] ?? Object.values(__envKeys("SUPABASE_PUBLISHABLE_KEYS"))[0] ?? "";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = PUBLISHABLE_KEY;
const SUPABASE_SERVICE_ROLE_KEY = SECRET_KEY;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const REFINE_CAP = 3;

function normalizeSmartQuotes(text: string): string {
  return text.replace(/[“”]/g, "\"").replace(/[‘’]/g, "'");
}

function parseRefinedJson(rawText: string): { name: string; definition: string } {
  let clean = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
  clean = normalizeSmartQuotes(clean);
  const objMatch = clean.match(/\{[\s\S]*\}/);
  if (!objMatch) throw new Error("No JSON object found in response");
  return JSON.parse(objMatch[0]);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });

  const authHeader = req.headers.get("Authorization") ?? "";
  const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userError } = await callerClient.auth.getUser();
  if (userError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
  const { data: ownerId } = await callerClient.rpc("resolve_org_owner_id");
  const { data: callerOrg } = await callerClient
    .from("organizations").select("id, subscription_tier").eq("user_id", ownerId ?? user.id).maybeSingle();
  if (!callerOrg || !["plus", "pro", "compliance"].includes(callerOrg.subscription_tier)) {
    return new Response(JSON.stringify({
      error: "AI refinement requires a Plus plan or higher.",
      requires_upgrade: true, required_tier: "plus",
    }), {
      status: 403, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  try {
    const { indicator_id, name, definition, target_value, measurement_window } = await req.json();
    if (!name || !definition) {
      return new Response(JSON.stringify({ error: "name and definition are required" }), {
        status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (indicator_id) {
      const { data: indicator } = await serviceClient
        .from("partnership_indicators").select("ai_refine_count").eq("id", indicator_id).maybeSingle();
      if (!indicator) {
        return new Response(JSON.stringify({ error: "Indicator not found" }), {
          status: 404, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        });
      }
      if (indicator.ai_refine_count >= REFINE_CAP) {
        return new Response(JSON.stringify({ error: "Refine limit reached for this indicator." }), {
          status: 429, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        });
      }
    } else {
      const today = new Date().toISOString().slice(0, 10);
      const { data: draftCount } = await serviceClient
        .from("indicator_draft_refine_counts").select("count")
        .eq("org_id", callerOrg.id).eq("refine_date", today).maybeSingle();
      if ((draftCount?.count ?? 0) >= REFINE_CAP) {
        return new Response(JSON.stringify({ error: "Daily refine limit reached. Try again tomorrow, or save the indicator first." }), {
          status: 429, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        });
      }
    }

    const prompt = `You are an M&E advisor reviewing a drafted partnership outcome indicator against SMART criteria (Specific, Measurable, Achievable, Relevant, Time-bound).

DRAFTED INDICATOR:
- Name: ${name}
- Definition: ${definition}
- Target value: ${target_value || "Not specified"}
- Measurement window: ${measurement_window || "Not specified"}

Check this against SMART criteria: Is it measurable? Is a schedule specified? Does it state a measurable objective rather than a vague direction (e.g. "improve" or "increase" with no target or timeframe)?

Suggest a tightened version. Do not invent numbers or facts not implied by the original draft -- if the original gives no scale, tighten the wording and structure without fabricating a target.

Return ONLY a valid JSON object, no markdown, no backticks, no explanation:
{"name":"<tightened name>","definition":"<tightened definition, including how measured/from whom/schedule>"}`;

    function sleep(ms: number): Promise<void> {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }

    const MAX_RATE_LIMIT_RETRIES = 1;
    let groqRes: Response | null = null;
    for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt++) {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_API_KEY}` },
        body: JSON.stringify({
          model: "openai/gpt-oss-120b",
          max_completion_tokens: 500,
          temperature: 0.3,
          top_p: 1,
          reasoning_effort: "low",
          stream: false,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (res.status === 429 && attempt < MAX_RATE_LIMIT_RETRIES) {
        const errBody = await res.text();
        const retryAfterHeader = res.headers.get("retry-after");
        const bodyMatch = errBody.match(/try again in ([\d.]+)s/i);
        const waitSeconds = retryAfterHeader ? parseFloat(retryAfterHeader) : bodyMatch ? parseFloat(bodyMatch[1]) : 5;
        const waitMs = Math.min(Math.ceil(waitSeconds * 1000) + 500, 25000);
        console.warn("[refine-partnership-indicator] Groq 429, retrying", { attempt, waitMs });
        await sleep(waitMs);
        continue;
      }
      groqRes = res;
      break;
    }

    if (!groqRes || !groqRes.ok) {
      const err = groqRes ? await groqRes.text() : "no response";
      console.error("[refine-partnership-indicator] Groq API error", err);
      return new Response(JSON.stringify({ error: `Groq API error: ${err}` }), {
        status: 502, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const groqData = await groqRes.json();
    const rawText = groqData.choices?.[0]?.message?.content ?? "";

    let refined: { name: string; definition: string };
    try {
      refined = parseRefinedJson(rawText);
    } catch {
      return new Response(JSON.stringify({ error: "Could not parse response.", raw: rawText }), {
        status: 422, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    if (indicator_id) {
      await serviceClient.rpc("increment_indicator_refine_count", { p_indicator_id: indicator_id });
    } else {
      await serviceClient.rpc("increment_draft_refine_count", { p_org_id: callerOrg.id });
    }

    return new Response(JSON.stringify({ refined }), {
      status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
});
