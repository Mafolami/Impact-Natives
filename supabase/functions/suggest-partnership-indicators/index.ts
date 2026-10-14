// supabase/functions/suggest-partnership-indicators/index.ts
//
// v4 (14 Oct 2026): legacy JWT keys disabled after a leak. Caller client
// uses the new publishable key. No logic change.
// v2: Plus+ tier gate. v1: drafts candidate indicators from listing data.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function __envKeys(name: string): Record<string, string> {
  try { return JSON.parse(Deno.env.get(name) ?? "{}"); } catch { return {}; }
}
const PUBLISHABLE_KEY = __envKeys("SUPABASE_PUBLISHABLE_KEYS")["default"] ?? Object.values(__envKeys("SUPABASE_PUBLISHABLE_KEYS"))[0] ?? "";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = PUBLISHABLE_KEY;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizeSmartQuotes(text: string): string {
  return text.replace(/[“”]/g, "\"").replace(/[‘’]/g, "'");
}

function parseSuggestionsJson(rawText: string): { name: string; definition: string; target_value: string; measurement_window: string }[] {
  let clean = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
  clean = normalizeSmartQuotes(clean);
  const arrMatch = clean.match(/\[[\s\S]*\]/);
  if (!arrMatch) throw new Error("No JSON array found in response");
  const parsed = JSON.parse(arrMatch[0]);
  if (!Array.isArray(parsed)) throw new Error("Response was not an array");
  return parsed;
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
    .from("organizations").select("subscription_tier").eq("user_id", ownerId ?? user.id).maybeSingle();
  if (!callerOrg || !["plus", "pro", "compliance"].includes(callerOrg.subscription_tier)) {
    return new Response(JSON.stringify({
      error: "AI indicator suggestions require a Plus plan or higher.",
      requires_upgrade: true, required_tier: "plus",
    }), {
      status: 403, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  try {
    const { mou_document_id, initiative_id, connection_id } = await req.json();
    if (!mou_document_id) {
      return new Response(JSON.stringify({ error: "mou_document_id is required" }), {
        status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    let sourceTitle = "";
    let sourceDescription = "";

    if (initiative_id) {
      const { data: initiative } = await callerClient
        .from("initiative_requests").select("title, problem").eq("id", initiative_id).maybeSingle();
      sourceTitle = initiative?.title ?? "";
      sourceDescription = initiative?.problem ?? "";
    } else if (connection_id) {
      const { data: connection } = await callerClient
        .from("partnership_connections").select("receiver_org_id").eq("id", connection_id).maybeSingle();
      if (connection?.receiver_org_id) {
        const { data: org } = await callerClient
          .from("organizations").select("partnership_sought, description")
          .eq("id", connection.receiver_org_id).maybeSingle();
        sourceTitle = org?.partnership_sought ?? "";
        sourceDescription = org?.description ?? "";
      }
    }

    if (!sourceTitle && !sourceDescription) {
      return new Response(JSON.stringify({ suggestions: [] }), {
        status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const prompt = `You are an M&E (monitoring & evaluation) advisor helping two partner organisations draft outcome indicators for a partnership agreement. Indicators must follow SMART criteria: Specific, Measurable, Achievable, Relevant, Time-bound. They measure OUTCOMES (what changed as a result of the partnership), not delivery milestones (what was delivered on schedule) -- those are tracked separately.

PARTNERSHIP CONTEXT:
- Title/focus: ${sourceTitle || "Not specified"}
- Description: ${sourceDescription || "Not specified"}

Draft 2-3 candidate indicators for this partnership. Each indicator needs:
- name: short indicator name (a few words)
- definition: how it's measured, from whom, and on what schedule (1-2 sentences)
- target_value: a concrete, measurable target
- measurement_window: how often or when this is measured (e.g. "quarterly", "end-of-project")

Do not invent specific numbers not implied by the context above -- if no scale is given, use a directional target (e.g. "increase from baseline") rather than a fabricated number.

Return ONLY a valid JSON array, no markdown, no backticks, no explanation text:
[{"name":"...","definition":"...","target_value":"...","measurement_window":"..."}]`;

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
          max_completion_tokens: 1200,
          temperature: 0.4,
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
        console.warn("[suggest-partnership-indicators] Groq 429, retrying", { attempt, waitMs });
        await sleep(waitMs);
        continue;
      }
      groqRes = res;
      break;
    }

    if (!groqRes || !groqRes.ok) {
      const err = groqRes ? await groqRes.text() : "no response";
      console.error("[suggest-partnership-indicators] Groq API error", err);
      return new Response(JSON.stringify({ error: `Groq API error: ${err}` }), {
        status: 502, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const groqData = await groqRes.json();
    const rawText = groqData.choices?.[0]?.message?.content ?? "";

    let suggestions;
    try {
      suggestions = parseSuggestionsJson(rawText);
    } catch {
      return new Response(JSON.stringify({ error: "Could not parse response.", raw: rawText }), {
        status: 422, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    return new Response(JSON.stringify({ suggestions }), {
      status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
});
