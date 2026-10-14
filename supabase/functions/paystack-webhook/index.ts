// supabase/functions/paystack-webhook/index.ts
//
// Receives Paystack webhook events and updates subscription_* on a
// successful charge (organizations or profiles). Called by Paystack, so
// verify_jwt is off; authenticity is the HMAC-SHA512 x-paystack-signature
// check, which runs before anything else.
//
// v6 (14 Oct 2026): legacy JWT keys disabled after a leak. Uses the new
// secret API key (SUPABASE_SECRET_KEYS) for DB writes. No logic change.
// v2: entity_type/entity_id routing, legacy org_id fallback.
// Only charge.success is processed.

function __envKeys(name: string): Record<string, string> {
  try { return JSON.parse(Deno.env.get(name) ?? "{}"); } catch { return {}; }
}
const SECRET_KEY = __envKeys("SUPABASE_SECRET_KEYS")["default"] ?? Object.values(__envKeys("SUPABASE_SECRET_KEYS"))[0] ?? "";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = SECRET_KEY;
// Not `!`: a missing user-set secret should fail with a clear message.
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

  // Read the raw body FIRST -- the signature is computed over the exact raw bytes.
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
      return new Response(JSON.stringify({ received: true, processed: false }), {
        status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const data = event.data ?? {};
    const tier = data.metadata?.tier;
    const customerCode = data.customer?.customer_code ?? null;
    const authorizationCode = data.authorization?.authorization_code ?? null;

    const entityType: "organization" | "profile" =
      data.metadata?.entity_type === "profile" ? "profile" : "organization";
    const entityId = data.metadata?.entity_id ?? data.metadata?.org_id;

    if (!entityId || !tier) {
      console.error("[paystack-webhook] charge.success missing entity_id/tier in metadata", { reference: data.reference });
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
    return new Response(JSON.stringify({ received: true, processed: false, reason: "internal error" }), {
      status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
});
