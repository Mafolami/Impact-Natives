// supabase/functions/paystack-initialize/index.ts
//
// Starts a Paystack checkout for the caller to move onto a paid tier (org or
// individual). Uses Paystack's Initialize Transaction API with a fixed NGN
// price list (not live USD conversion).
//
// v7 (14 Oct 2026): org/profile lookups now use the server key, filtered by
// the verified user id. The caller-scoped select asked for organizations.email,
// which authenticated users have no column grant on, so the query errored, org
// came back null, and every org owner was treated as an individual (Compliance
// refused with the wrong message; Plus/Pro would have been billed to the
// profile instead of the org). A lookup error now returns 500 instead of
// silently falling through to the individual branch.
// v6 (14 Oct 2026): legacy JWT keys disabled after a leak. Caller-scoped
// client now uses the new publishable key. No logic change.
// v2: individual checkout support (plus/pro only; compliance corporate-only).
// Renewal is handled by renew-subscriptions.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function __envKeys(name: string): Record<string, string> {
  try { return JSON.parse(Deno.env.get(name) ?? "{}"); } catch { return {}; }
}
const PUBLISHABLE_KEY = __envKeys("SUPABASE_PUBLISHABLE_KEYS")["default"] ?? Object.values(__envKeys("SUPABASE_PUBLISHABLE_KEYS"))[0] ?? "";
const SECRET_KEY = __envKeys("SUPABASE_SECRET_KEYS")["default"] ?? Object.values(__envKeys("SUPABASE_SECRET_KEYS"))[0] ?? "";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = PUBLISHABLE_KEY;
const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY") ?? "";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Fixed NGN price list, amounts in kobo (1 NGN = 100 kobo).
const PRICING_NGN_KOBO: Record<string, number> = {
  plus: 8_000_000,       // ₦80,000
  pro: 33_900_000,       // ₦339,000
  compliance: 109_000_000, // ₦1,090,000
};

const VALID_TIERS = Object.keys(PRICING_NGN_KOBO);
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

    // Server-side reads, always scoped to the verified user.id above.
    const svc = createClient(SUPABASE_URL, SECRET_KEY);

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

    const { data: org, error: orgError } = await svc
      .from("organizations")
      .select("id, organisation_name, organisation_type, email")
      .eq("user_id", user.id)
      .maybeSingle();

    if (orgError) {
      console.error("[paystack-initialize] organizations lookup failed", { error: orgError.message, code: orgError.code });
      return new Response(JSON.stringify({ error: "Could not load your organisation. Please try again." }), {
        status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

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
      if (!INDIVIDUAL_VALID_TIERS.includes(tier)) {
        return new Response(JSON.stringify({ error: `Individual accounts can purchase: ${INDIVIDUAL_VALID_TIERS.join(", ")}` }), {
          status: 403, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        });
      }

      const { data: profile, error: profileError } = await svc
        .from("profiles")
        .select("id, full_name, email")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError || !profile) {
        if (profileError) console.error("[paystack-initialize] profiles lookup failed", { error: profileError.message, code: profileError.code });
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
