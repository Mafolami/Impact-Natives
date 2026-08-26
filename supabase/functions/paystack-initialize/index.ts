// supabase/functions/paystack-initialize/index.ts
//
// Starts a Paystack checkout for the caller to move onto a paid tier. Works
// for both org accounts and individual accounts (no org) -- see v2 note
// below. Deliberately built against Paystack's Initialize Transaction API
// rather than the Plan/Subscription API -- no Plan objects need to exist in
// the Paystack dashboard for this to work. Pricing is a fixed NGN list here,
// not a live USD conversion (see pricing discussion -- naira moved ~₦174
// against the dollar over the past year, a live-converted checkout price
// would drift daily). Revisit PRICING_NGN if/when the underlying USD prices
// change or the naira moves enough to matter.
//
// v2: individual (non-org) checkout support. Individuals can buy plus/pro
// only -- compliance stays corporate-only, since Strategy Builder's data
// model (SECTOR_MATRIX/COUNTRY_MATRIX in generate-impact-strategy) only
// covers corporate use cases and there's no org-type concept for an
// individual to gate against anyway. Metadata now carries a generic
// entity_type/entity_id pair instead of a hardcoded org_id, so
// paystack-webhook can route the resulting charge.success to either
// organizations or profiles. org_id is also still sent for backward
// compatibility with any existing tooling/analytics reading that key.
//
// Recurring billing is NOT handled by this function. This only starts a
// single transaction; paystack-webhook records subscription_current_period_end
// as +30 days on success. Renewal today means the caller re-runs this flow
// before that date, or (once built) an auto-renewal cron re-charges the
// stored subscription_authorization_code. No auto-renewal cron exists yet.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
// See paystack-webhook for why this isn't a `!` non-null assertion -- a
// missing user-set secret should fail with a clear message, not crash the
// module at boot.
const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY") ?? "";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Fixed NGN price list, amounts in kobo (Paystack's base unit -- 1 NGN = 100 kobo).
// Keep in sync with the USD figures in the pricing doc if those ever change.
const PRICING_NGN_KOBO: Record<string, number> = {
  plus: 8_000_000,       // ₦80,000
  pro: 33_900_000,       // ₦339,000
  compliance: 109_000_000, // ₦1,090,000
};

const VALID_TIERS = Object.keys(PRICING_NGN_KOBO);
// Tiers an individual (non-org) account may purchase -- compliance excluded,
// see file header note.
const INDIVIDUAL_VALID_TIERS = ["plus", "pro"];

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

    const { data: { user }, error: userError } = await callerClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const body = await req.json().catch(() => ({}));
    const tier = typeof body.tier === "string" ? body.tier.toLowerCase() : "";

    if (!PAYSTACK_SECRET_KEY) {
      console.error("[paystack-initialize] PAYSTACK_SECRET_KEY is not set as an Edge Function secret");
      return new Response(JSON.stringify({ error: "Server misconfigured: PAYSTACK_SECRET_KEY not set" }), {
        status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    if (!VALID_TIERS.includes(tier)) {
      return new Response(JSON.stringify({ error: `tier must be one of: ${VALID_TIERS.join(", ")}` }), {
        status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    // Compliance is corporate-only at checkout -- see billing scoping notes.
    // Strategy Builder's data model (SECTOR_MATRIX / COUNTRY_MATRIX) only
    // covers corporate use cases; a non-corporate org buying Compliance
    // would just hit unsupported_sector errors on the feature it's paying for.
    const { data: org, error: orgError } = await callerClient
      .from("organizations")
      .select("id, organisation_name, organisation_type, email")
      .eq("user_id", user.id)
      .maybeSingle();

    let entityType: "organization" | "profile";
    let entityId: string;
    let checkoutEmail: string;
    let displayName: string;

    if (org) {
      const CORPORATE_TYPES = ["corporation", "technology_company", "public_sector"];
      if (tier === "compliance" && !CORPORATE_TYPES.includes(org.organisation_type)) {
        return new Response(JSON.stringify({ error: "Compliance is only available to corporate organisations" }), {
          status: 403, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        });
      }
      entityType = "organization";
      entityId = org.id;
      checkoutEmail = org.email || user.email;
      displayName = org.organisation_name;
    } else {
      // No org -- individual checkout. Compliance is never available here,
      // regardless of what VALID_TIERS allows generally.
      if (!INDIVIDUAL_VALID_TIERS.includes(tier)) {
        return new Response(JSON.stringify({ error: `Individual accounts can purchase: ${INDIVIDUAL_VALID_TIERS.join(", ")}` }), {
          status: 403, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        });
      }

      const { data: profile, error: profileError } = await callerClient
        .from("profiles")
        .select("id, full_name, email")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError || !profile) {
        return new Response(JSON.stringify({ error: "No profile found for this account" }), {
          status: 404, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        });
      }

      entityType = "profile";
      entityId = profile.id;
      checkoutEmail = profile.email || user.email;
      displayName = profile.full_name || profile.email || "Impact Natives user";
    }

    const amountKobo = PRICING_NGN_KOBO[tier];

    const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${PAYSTACK_SECRET_KEY}`,
      },
      body: JSON.stringify({
        email: checkoutEmail,
        amount: amountKobo,
        currency: "NGN",
        metadata: {
          entity_type: entityType,
          entity_id: entityId,
          // Kept for backward compatibility with any existing tooling that
          // reads org_id directly -- null for individual checkouts.
          org_id: entityType === "organization" ? entityId : null,
          tier,
          organisation_name: displayName,
        },
        callback_url: "https://app.impactnatives.com/dashboard/settings?tab=billing",
      }),
    });

    if (!paystackRes.ok) {
      const errText = await paystackRes.text();
      return new Response(JSON.stringify({ error: `Paystack initialize failed: ${errText}` }), {
        status: 502, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const paystackData = await paystackRes.json();

    return new Response(JSON.stringify({
      authorization_url: paystackData.data?.authorization_url,
      access_code: paystackData.data?.access_code,
      reference: paystackData.data?.reference,
    }), {
      status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
});
