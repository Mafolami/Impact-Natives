// supabase/functions/generate-partnership-summary/index.ts
//
// v11 (14 Oct 2026): caller must be signed in. Before this the function was
// fully public (verify_jwt off, no check), so anyone could run Groq calls
// on our account. Only caller is DashboardNatives, a signed-in page.
//
// v9: TOKEN PARAMETER FIX. This function still used the legacy max_tokens
// parameter (200) with no reasoning_effort set, unlike every other AI-
// calling function in this codebase (which use max_completion_tokens +
// reasoning_effort: "low"). For a reasoning model like openai/gpt-oss-120b,
// internal reasoning tokens draw from the SAME total budget as the visible
// output -- with reasoning_effort left at its default (not "low") and only
// 200 tokens total, how much was left over for the actual 2-3 sentence
// summary varied unpredictably call to call, producing summaries truncated
// at wildly different points (sometimes mid-first-sentence, sometimes two
// sentences in) depending on how much the model reasoned internally before
// writing anything visible. This is the same class of bug already fixed
// elsewhere in this codebase (see match-orgs-for-partnership's
// callGroqWithBackoff) -- this function just hadn't been migrated to that
// convention yet.
//
// Fix: max_tokens -> max_completion_tokens (the correct parameter Groq
// expects), reasoning_effort: "low" added (keeps reasoning minimal so it
// doesn't eat the budget meant for the visible summary), and the budget
// raised from 200 to 500 for comfortable headroom on top of that.
//
// v8: model swapped llama-3.1-8b-instant -> openai/gpt-oss-120b. Groq
// deprecated and fully decommissioned llama-3.1-8b-instant (announced
// 2026-06-17); every real call was failing with model_not_found.
// openai/gpt-oss-120b is Groq's recommended replacement and is already
// the model used by every other AI-calling edge function in this
// codebase.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function __envKeys(name: string): Record<string, string> {
  try { return JSON.parse(Deno.env.get(name) ?? "{}"); } catch { return {}; }
}
const PUBLISHABLE_KEY = __envKeys("SUPABASE_PUBLISHABLE_KEYS")["default"] ?? Object.values(__envKeys("SUPABASE_PUBLISHABLE_KEYS"))[0] ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") ?? "";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

  const callerClient = createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: { user }, error: userError } = await callerClient.auth.getUser();
  if (userError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  try {
    const { organisation_name, description, sectors, needs, offers, sdgs, organisation_type, country } = await req.json();

    if (!organisation_name) {
      return new Response(
        JSON.stringify({ error: "organisation_name is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    const prompt = `You are a partnership coordinator at a social impact coordination platform focused on Africa.

Given the following organisation profile, write a 2-3 sentence partnership summary that explains:
1. What kind of partner this organisation would be most valuable to
2. What they are most likely to contribute to a collaboration
3. What they are seeking in return

Write in plain, direct language. No marketing speak. No bullet points. No headers. Just 2-3 flowing sentences that a funder or partner could read in 10 seconds and immediately understand the partnership value.

Organisation name: ${organisation_name}
Country: ${country ?? "Not specified"}
Type: ${organisation_type ?? "Not specified"}
Description: ${description ?? "Not provided"}
Sectors: ${sectors?.join(", ") ?? "Not specified"}
SDGs: ${sdgs?.join(", ") ?? "Not specified"}
What they need: ${needs?.join(", ") ?? "Not specified"}
What they offer: ${offers?.join(", ") ?? "Not specified"}

Return ONLY the partnership summary text. No labels, no preamble, no explanation.`;

    const claudeRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        max_completion_tokens: 500,
        reasoning_effort: "low",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.text();
      return new Response(
        JSON.stringify({ error: `Groq API error: ${err}` }),
        { status: 502, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    const claudeData = await claudeRes.json();
    const finishReason = claudeData.choices?.[0]?.finish_reason;
    if (finishReason === "length") {
      console.error(`[generate-partnership-summary] response truncated by max_completion_tokens -- finish_reason: length`);
    }
    const summary = claudeData.choices?.[0]?.message?.content?.trim() ?? "";

    return new Response(JSON.stringify({ summary }), {
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
