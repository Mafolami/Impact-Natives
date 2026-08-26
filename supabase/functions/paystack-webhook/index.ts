// supabase/functions/paystack-webhook/index.ts
//
// Receives Paystack webhook events and updates subscription_* on a
// successful charge -- on organizations for an org checkout, or on profiles
// for an individual checkout. This endpoint is called by Paystack, not by a
// logged-in user or the service-role cron pattern used elsewhere -- so it
// can't use verify_jwt (Paystack doesn't send a Supabase-issued JWT) and
// can't use the role-claim check pattern from monthly-activity-digest either.
// Instead, authenticity is verified the way Paystack's own docs specify:
// HMAC-SHA512 of the raw request body, keyed with the Paystack secret key,
// compared against the x-paystack-signature header. This function is
// deployed with verify_jwt: false for exactly this reason -- the signature
// check IS the auth, and it must run before anything else.
//
// v2: reads the entity_type/entity_id pair paystack-initialize v2 now sends
// in metadata, and routes the update to organizations or profiles
// accordingly. Falls back to the legacy org_id-only shape (treating it as
// an organization update) if entity_type/entity_id are absent, so any
// transaction initialized before this deploy still resolves correctly.
//
// Only charge.success is handled. Other event types (chargeback, refund,
// etc.) are acknowledged with 200 but not processed -- add handling here
// if/when those matter.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Deliberately NOT using `!` here -- unlike the two above (always present,
// platform-injected), this one depends on a human having set it as an Edge
// Function secret. If it's missing, reading it with a non-null assertion
// throws at module load and crashes the whole function before Deno.serve
// even registers -- every request then gets a generic, unhelpful 500 with
// no logs and no indication why. Checking explicitly inside the handler
// instead means a missing secret fails with a clear message.
const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY") ?? "";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUBSCRIPTION_PERIOD_DAYS = 30;

async function hmacSha512Hex(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });

  if (!PAYSTACK_SECRET_KEY) {
    console.error("[paystack-webhook] PAYSTACK_SECRET_KEY is not set as an Edge Function secret");
    return new Response(JSON.stringify({ error: "Server misconfigured: PAYSTACK_SECRET_KEY not set" }), {
      status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  // Read the raw body FIRST -- the signature is computed over the exact raw
  // bytes Paystack sent. Parsing to JSON and re-stringifying can silently
  // change whitespace/key order and break the signature check.
  const rawBody = await req.text();

  const signatureHeader = req.headers.get("x-paystack-signature") ?? "";
  const expectedSignature = await hmacSha512Hex(PAYSTACK_SECRET_KEY, rawBody);

  if (signatureHeader !== expectedSignature) {
    console.error("[paystack-webhook] signature mismatch -- request rejected");
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 401, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: "Malformed JSON body" }), {
      status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  try {
    if (event.event !== "charge.success") {
      // Acknowledge everything else so Paystack doesn't retry, but don't
      // process it -- see file header note.
      return new Response(JSON.stringify({ received: true, processed: false }), {
        status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const data = event.data ?? {};
    const tier = data.metadata?.tier;
    const customerCode = data.customer?.customer_code ?? null;
    const authorizationCode = data.authorization?.authorization_code ?? null;

    // v2 metadata shape: entity_type/entity_id. Falls back to the legacy
    // org_id-only shape (pre-v2 paystack-initialize) by treating it as an
    // organization update, so an in-flight transaction started before this
    // deploy still resolves correctly.
    const entityType: "organization" | "profile" =
      data.metadata?.entity_type === "profile" ? "profile" : "organization";
    const entityId = data.metadata?.entity_id ?? data.metadata?.org_id;

    if (!entityId || !tier) {
      console.error("[paystack-webhook] charge.success missing entity_id/tier in metadata", { reference: data.reference });
      // Still 200 -- this is a Paystack-side retry situation if we 4xx/5xx,
      // and a malformed metadata payload won't fix itself on retry.
      return new Response(JSON.stringify({ received: true, processed: false, reason: "missing metadata" }), {
        status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const periodEnd = new Date(Date.now() + SUBSCRIPTION_PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const tableName = entityType === "profile" ? "profiles" : "organizations";

    const updateResult = await supabaseFetch(`${tableName}?id=eq.${entityId}`, {
      method: "PATCH",
      body: JSON.stringify({
        subscription_tier: tier,
        subscription_status: "active",
        subscription_provider: "paystack",
        subscription_customer_id: customerCode,
        subscription_current_period_end: periodEnd,
        subscription_authorization_code: authorizationCode,
      }),
    });

    if (updateResult?.code || updateResult?.error) {
      console.error("[paystack-webhook] update failed", { tableName, entityId, updateResult });
      return new Response(JSON.stringify({ received: true, processed: false, reason: "db update failed" }), {
        status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    return new Response(JSON.stringify({ received: true, processed: true }), {
      status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });

  } catch (err) {
    console.error("[paystack-webhook] uncaught error", String(err));
    // 200 here too -- an uncaught exception on our end shouldn't cause
    // Paystack to hammer this endpoint with retries for a charge that
    // already succeeded on their side.
    return new Response(JSON.stringify({ received: true, processed: false, reason: "internal error" }), {
      status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
});
