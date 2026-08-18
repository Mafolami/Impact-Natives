// supabase/functions/generate-admin-triage/index.ts
//
// v9: admin auth gate added. This function was deployed with
// verify_jwt: false and had no auth check of any kind inside the body --
// any anonymous caller, logged in or not, could hit it directly and burn
// Anthropic API calls on the site's own key. It's meant to be an internal
// admin tool (initiative/verification triage), not a public endpoint.
// Fixed by resolving the caller's session and requiring is_admin() --
// the same SECURITY DEFINER helper already used by the "Admin can read
// all organizations" / "Admin can update any organization" RLS policies
// on `organizations`, so this now enforces the same admin boundary the
// rest of the app already relies on, rather than inventing a new one.
// Deployed with verify_jwt: true so an unauthenticated request is
// rejected at the platform edge before it ever reaches this code.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });

  // Admin auth gate -- see file header note.
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
  const { data: isAdmin, error: isAdminError } = await callerClient.rpc("is_admin");
  if (isAdminError || !isAdmin) {
    return new Response(JSON.stringify({ error: "Admin access required" }), {
      status: 403, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  try {
    const { type, data } = await req.json();

    let prompt = "";

    if (type === "initiative") {
      prompt = `You are an admin reviewer for a social impact partnership marketplace in Africa. Assess this initiative submission in 2-3 sentences for internal triage purposes.

Cover: (1) whether the brief is clear and complete enough to publish, (2) one specific strength or gap, (3) a recommended action (approve, request more info, or reject with reason).

Be direct. No padding. Write for an admin who needs to make a quick decision.

Title: ${data.title}
Problem: ${data.problem ?? "Not provided"}
Outcome: ${data.outcome ?? "Not provided"}
Stage: ${data.stage ?? "Not specified"}
Partnerships: ${data.partnerships?.join(", ") ?? "Not specified"}
Specific ask: ${data.specific_ask ?? "Not provided"}
Budget: ${data.budget ?? "Not specified"}
Target population: ${data.target_population ?? "Not specified"}
Prior experience: ${data.had_prior_experience === true ? "Yes" : data.had_prior_experience === false ? "No" : "Not specified"}
Sectors: ${data.sectors?.join(", ") ?? "Not specified"}
Locations: ${data.locations?.join(", ") ?? "Not specified"}

Return ONLY the triage summary. No labels, no JSON, no preamble.`;
    } else if (type === "verification") {
      prompt = `You are an admin reviewer for a social impact platform in Africa. Assess this verification request in 2-3 sentences for internal triage purposes.

Cover: (1) whether the profile and documents look legitimate, (2) any red flags or missing information, (3) recommended action (approve or follow up).

Be direct. No padding. Write for an admin who needs to make a quick decision.

Name: ${data.full_name ?? "Not provided"}
Organisation: ${data.org_name ?? "Not provided"}
Role: ${data.role_title ?? "Not provided"}
Type: ${data.org_type ?? "Not specified"}
Description: ${data.description ?? "Not provided"}
Sectors: ${data.sectors?.join(", ") ?? "Not specified"}
Country: ${data.country ?? "Not specified"}
Documents submitted: ${data.doc_count ?? 0}
Document types: ${data.doc_names?.join(", ") ?? "None"}

Return ONLY the triage summary. No labels, no JSON, no preamble.`;
    } else {
      return new Response(JSON.stringify({ error: "type must be initiative or verification" }), {
        status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 200,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const result = await claudeRes.json();
    const summary = result.content?.[0]?.text?.trim() ?? "";

    return new Response(JSON.stringify({ summary }), {
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