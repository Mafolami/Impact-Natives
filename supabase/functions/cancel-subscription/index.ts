// supabase/functions/cancel-subscription/index.ts
//
// Lets a caller cancel their own paid plan -- an org Owner, or an
// individual (no org) account. Must run as an edge function rather than a
// direct client-side update -- organizations' AND profiles' subscription_*
// columns deliberately have no UPDATE grant for the `authenticated` role
// (see the security fix locking down profiles.subscription_* and the
// pre-existing equivalent on organizations -- both specifically to stop a
// caller self-granting a paid tier through the same call path used for
// ordinary profile/org edits). A direct client update here would just get
// a 42501 permission denied, correctly.
//
// There's no true recurring Paystack Subscription/Plan object to cancel --
// renewal works by re-charging the stored card authorization directly (see
// renew-subscriptions), not through Paystack's own subscription mechanism.
// So "cancel" here means: revert to Free immediately, forfeiting the
// remainder of the paid period, rather than waiting for the natural
// downgrade-expired-subscriptions cron at period end. The stored
// authorization_code is cleared too, so renew-subscriptions can never
// re-charge a canceled account on its next daily run. Allowed from both
// 'active' and 'past_due' -- a past_due account (failed auto-renewal, still
// has paid-tier access during its grace window) should be able to cancel
// just as easily as an active one, not be stuck waiting for the grace
// window to run out on its own.
//
// v2: individual (no org) cancellation support. Checks for an org first
// (unchanged org behaviour), falls back to the caller's own profile row
// if none exists.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

    // Caller must be the Owner -- resolved by their own user_id, same
    // convention as invite-team-member and paystack-initialize.
    const { data: org, error: orgError } = await callerClient
      .from("organizations")
      .select("id, subscription_tier, subscription_status")
      .eq("user_id", user.id)
      .maybeSingle();

    const tableName = org ? "organizations" : "profiles";
    let recordId: string;
    let currentTier: string;
    let currentStatus: string;

    if (org) {
      recordId = org.id;
      currentTier = org.subscription_tier;
      currentStatus = org.subscription_status;
    } else {
      const { data: profile, error: profileError } = await callerClient
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
