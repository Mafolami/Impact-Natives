// supabase/functions/renew-subscriptions/index.ts
//
// Daily cron: attempts to renew any org OR individual account whose
// subscription_current_period_end falls within the next 24 hours, by
// re-charging the card authorization captured on their original checkout
// (paystack-webhook stores subscription_authorization_code on every
// successful charge.success). Uses Paystack's /transaction/charge_authorization
// endpoint, which charges a previously-authorized card without the
// customer re-entering details.
//
// Only attempts once per due window: a successful charge pushes
// subscription_current_period_end forward, which removes the account from
// this query's window immediately. A failed charge sets subscription_status
// to 'past_due' rather than retrying -- 'past_due' accounts are excluded
// from this query's `status = 'active'` filter, so they are NOT retried
// automatically. They keep paid-tier access while past_due (same as
// active, no separate gate exists for it), visibly flagged in the Billing
// tab, until downgrade-expired-subscriptions eventually reverts them to
// Free once period_end actually passes -- that function's status filter
// was extended to include 'past_due' alongside 'active' for exactly this
// reason.
//
// PRICING_NGN_KOBO is kept in sync manually with paystack-initialize -- see
// that function's header for the same caveat. No shared config file exists
// between the two yet.
//
// v2: sweeps both organizations and profiles (individual accounts). Two
// straight-line passes over the same logic, same reasoning as
// downgrade-expired-subscriptions v2 -- the two tables' select columns
// differ slightly (organisation_name vs full_name), and duplicating the
// loop is cheaper to verify correct than a generic table-parameterized
// helper. Individual accounts can only ever be on plus/pro (see
// paystack-initialize v2), so a compliance-tier profile is not a real case
// this needs to handle, but PRICING_NGN_KOBO's compliance entry is
// harmless dead weight for that path either way.
//
// Cron-only: same JWT role-claim check as monthly-activity-digest and
// downgrade-expired-subscriptions.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY") ?? "";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RENEWAL_WINDOW_HOURS = 24;
const SUBSCRIPTION_PERIOD_DAYS = 30;

const PRICING_NGN_KOBO: Record<string, number> = {
  plus: 8_000_000,        // ₦80,000
  pro: 33_900_000,        // ₦339,000
  compliance: 109_000_000, // ₦1,090,000
};

function isServiceRoleRequest(req: Request): boolean {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const payloadSegment = token.split(".")[1];
  if (!payloadSegment) return false;
  try {
    const base64 = payloadSegment.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = JSON.parse(atob(base64));
    return decoded?.role === "service_role";
  } catch {
    return false;
  }
}

async function supabaseFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Prefer": "return=representation",
      ...(options.headers ?? {}),
    },
  });
  return res.json();
}

async function renewOne(record: { id: string; email: string; subscription_tier: string; subscription_authorization_code: string; displayName: string }, tableName: "organizations" | "profiles"): Promise<"renewed" | "failed"> {
  const amountKobo = PRICING_NGN_KOBO[record.subscription_tier];
  if (!amountKobo || !record.email || !record.subscription_authorization_code) {
    console.error(`[renew-subscriptions] skipping ${tableName} record, missing required field`, { id: record.id, tier: record.subscription_tier });
    return "failed";
  }

  try {
    const chargeRes = await fetch("https://api.paystack.co/transaction/charge_authorization", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${PAYSTACK_SECRET_KEY}`,
      },
      body: JSON.stringify({
        authorization_code: record.subscription_authorization_code,
        email: record.email,
        amount: amountKobo,
        currency: "NGN",
        metadata: { entity_type: tableName === "organizations" ? "organization" : "profile", entity_id: record.id, tier: record.subscription_tier, renewal: true },
      }),
    });

    const chargeData = await chargeRes.json();
    const chargeSucceeded = chargeRes.ok && chargeData?.data?.status === "success";

    if (chargeSucceeded) {
      const newPeriodEnd = new Date(Date.now() + SUBSCRIPTION_PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString();
      const newAuthCode = chargeData.data?.authorization?.authorization_code ?? record.subscription_authorization_code;

      await supabaseFetch(`${tableName}?id=eq.${record.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          subscription_status: "active",
          subscription_current_period_end: newPeriodEnd,
          subscription_authorization_code: newAuthCode,
        }),
      });
      return "renewed";
    } else {
      console.error("[renew-subscriptions] charge failed", {
        tableName, id: record.id, displayName: record.displayName,
        gateway_response: chargeData?.data?.gateway_response ?? chargeData?.message,
      });
      await supabaseFetch(`${tableName}?id=eq.${record.id}`, {
        method: "PATCH",
        body: JSON.stringify({ subscription_status: "past_due" }),
      });
      return "failed";
    }
  } catch (err) {
    console.error("[renew-subscriptions] charge_authorization request threw", { tableName, id: record.id, err: String(err) });
    await supabaseFetch(`${tableName}?id=eq.${record.id}`, {
      method: "PATCH",
      body: JSON.stringify({ subscription_status: "past_due" }),
    });
    return "failed";
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  if (!isServiceRoleRequest(req)) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  if (!PAYSTACK_SECRET_KEY) {
    console.error("[renew-subscriptions] PAYSTACK_SECRET_KEY is not set as an Edge Function secret");
    return new Response(JSON.stringify({ error: "Server misconfigured: PAYSTACK_SECRET_KEY not set" }), {
      status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  try {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + RENEWAL_WINDOW_HOURS * 60 * 60 * 1000).toISOString();

    const dueOrgs = await supabaseFetch(
      `organizations?select=id,organisation_name,email,subscription_tier,subscription_authorization_code` +
      `&subscription_status=eq.active` +
      `&subscription_tier=neq.free` +
      `&subscription_authorization_code=not.is.null` +
      `&subscription_current_period_end=lte.${windowEnd}` +
      `&subscription_current_period_end=gt.${now.toISOString()}`
    );

    const dueProfiles = await supabaseFetch(
      `profiles?select=id,full_name,email,subscription_tier,subscription_authorization_code` +
      `&subscription_status=eq.active` +
      `&subscription_tier=neq.free` +
      `&subscription_authorization_code=not.is.null` +
      `&subscription_current_period_end=lte.${windowEnd}` +
      `&subscription_current_period_end=gt.${now.toISOString()}`
    );

    const orgList = Array.isArray(dueOrgs) ? dueOrgs : [];
    const profileList = Array.isArray(dueProfiles) ? dueProfiles : [];

    let renewed = 0;
    let failed = 0;

    for (const org of orgList) {
      const result = await renewOne({ ...org, displayName: org.organisation_name }, "organizations");
      if (result === "renewed") renewed++; else failed++;
    }

    for (const profile of profileList) {
      const result = await renewOne({ ...profile, displayName: profile.full_name }, "profiles");
      if (result === "renewed") renewed++; else failed++;
    }

    return new Response(JSON.stringify({ attempted: orgList.length + profileList.length, renewed, failed, organizations: orgList.length, profiles: profileList.length }), {
      status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
});
