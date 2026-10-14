// supabase/functions/cancel-subscription/index.ts
//
// Lets a caller cancel their own paid plan (org Owner or individual).
// Must be an edge function: subscription_* columns have no UPDATE grant for
// `authenticated`. "Cancel" reverts to Free immediately and clears the
// stored authorization_code so renew-subscriptions can't re-charge.
// Allowed from 'active' and 'past_due'.
//
// v6 (14 Oct 2026): org and profile reads use the service client, scoped to
// the verified user id. subscription_status is being revoked from
// authenticated on organizations; with the caller client that read would
// fail, org would come back null, and the cancel would hit the profile
// instead of the org. A lookup error now returns 500 rather than falling
// through.
// v5 (14 Oct 2026): legacy JWT keys disabled after a leak. Uses the new
// publishable key (caller client) and secret key (service client).
// v2: individual (no org) cancellation support.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function __envKeys(name: string): Record<string, string> {
  try { return JSON.parse(Deno.env.get(name) ?? "{}"); } catch { return {}; }
}
const SECRET_KEY = __envKeys("SUPABASE_SECRET_KEYS")["default"] ?? Object.values(__envKeys("SUPABASE_SECRET_KEYS"))[0] ?? "";
const PUBLISHABLE_KEY = __envKeys("SUPABASE_PUBLISHABLE_KEYS")["default"] ?? Object.values(__envKeys("SUPABASE_PUBLISHABLE_KEYS"))[0] ?? "";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = PUBLISHABLE_KEY;
const SUPABASE_SERVICE_ROLE_KEY = SECRET_KEY;

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

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: { user }, error: userError } = await callerClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const { data: org, error: orgError } = await serviceClient
      .from("organizations")
      .select("id, subscription_tier, subscription_status")
      .eq("user_id", user.id)
      .maybeSingle();

    if (orgError) {
      console.error("[cancel-subscription] organizations lookup failed", { error: orgError.message, code: orgError.code });
      return new Response(JSON.stringify({ error: "Could not load your organisation. Please try again." }), {
        status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const tableName = org ? "organizations" : "profiles";
    let recordId: string;
    let currentTier: string;
    let currentStatus: string;

    if (org) {
      recordId = org.id;
      currentTier = org.subscription_tier;
      currentStatus = org.subscription_status;
    } else {
      const { data: profile, error: profileError } = await serviceClient
        .from("profiles")
        .select("id, subscription_tier, subscription_status")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError || !profile) {
        return new Response(JSON.stringify({ error: "No account found to cancel" }), {
          status: 404, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        });
      }

      recordId = profile.id;
      currentTier = profile.subscription_tier;
      currentStatus = profile.subscription_status;
    }

    if (currentTier === "free" || (currentStatus !== "active" && currentStatus !== "past_due")) {
      return new Response(JSON.stringify({ error: "No active paid plan to cancel" }), {
        status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const { error: updateError } = await serviceClient
      .from(tableName)
      .update({
        subscription_tier: "free",
        subscription_status: "canceled",
        subscription_authorization_code: null,
      })
      .eq("id", recordId);

    if (updateError) {
      return new Response(JSON.stringify({ error: `Could not cancel plan: ${updateError.message}` }), {
        status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
});
