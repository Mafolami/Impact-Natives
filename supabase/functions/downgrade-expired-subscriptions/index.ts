// supabase/functions/downgrade-expired-subscriptions/index.ts
//
// Daily safety net: any org OR individual account whose
// subscription_current_period_end has passed but is still marked 'active'
// OR 'past_due' gets moved back to Free. Runs AFTER renew-subscriptions.
// Never charges anything, only revokes access once the paid period lapses.
//
// v6 (14 Oct 2026): legacy JWT keys disabled after a leak. Uses the new
// secret API key (SUPABASE_SECRET_KEYS); cron-only check now compares the
// caller's key against it instead of reading a JWT role claim.
// v2: sweeps both organizations and profiles.

function __envKeys(name: string): Record<string, string> {
  try { return JSON.parse(Deno.env.get(name) ?? "{}"); } catch { return {}; }
}
const __SECRET_KEYS = Object.values(__envKeys("SUPABASE_SECRET_KEYS"));
const SECRET_KEY = __envKeys("SUPABASE_SECRET_KEYS")["default"] ?? __SECRET_KEYS[0] ?? "";
function isServerCall(req: Request): boolean {
  if (__SECRET_KEYS.length === 0) return false;
  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const apikey = req.headers.get("apikey") ?? "";
  return __SECRET_KEYS.includes(bearer) || __SECRET_KEYS.includes(apikey);
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = SECRET_KEY;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  if (!isServerCall(req)) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  try {
    const nowIso = new Date().toISOString();

    // --- Organizations ---
    const orgRes = await fetch(
      `${SUPABASE_URL}/rest/v1/organizations?subscription_status=in.(active,past_due)&subscription_current_period_end=lt.${nowIso}&select=id,organisation_name,subscription_tier`,
      {
        headers: {
          "apikey": SUPABASE_SERVICE_ROLE_KEY,
          "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      },
    );
    const expiredOrgs = await orgRes.json();

    let orgDowngradedCount = 0;
    if (Array.isArray(expiredOrgs) && expiredOrgs.length > 0) {
      const idsCsv = expiredOrgs.map((o: any) => o.id).join(",");

      const updateRes = await fetch(
        `${SUPABASE_URL}/rest/v1/organizations?id=in.(${idsCsv})`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            "Prefer": "return=representation",
          },
          body: JSON.stringify({
            subscription_tier: "free",
            subscription_status: "canceled",
            subscription_authorization_code: null,
          }),
        },
      );

      if (!updateRes.ok) {
        const errText = await updateRes.text();
        console.error("[downgrade-expired-subscriptions] organizations update failed", errText);
        return new Response(JSON.stringify({ error: "Organizations update failed", details: errText }), {
          status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        });
      }

      console.log("[downgrade-expired-subscriptions] downgraded orgs", expiredOrgs.map((o: any) => o.organisation_name));
      orgDowngradedCount = expiredOrgs.length;
    }

    // --- Individual accounts (profiles) ---
    const profileRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?subscription_status=in.(active,past_due)&subscription_current_period_end=lt.${nowIso}&select=id,full_name,subscription_tier`,
      {
        headers: {
          "apikey": SUPABASE_SERVICE_ROLE_KEY,
          "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      },
    );
    const expiredProfiles = await profileRes.json();

    let profileDowngradedCount = 0;
    if (Array.isArray(expiredProfiles) && expiredProfiles.length > 0) {
      const idsCsv = expiredProfiles.map((p: any) => p.id).join(",");

      const updateRes = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?id=in.(${idsCsv})`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            "Prefer": "return=representation",
          },
          body: JSON.stringify({
            subscription_tier: "free",
            subscription_status: "canceled",
            subscription_authorization_code: null,
          }),
        },
      );

      if (!updateRes.ok) {
        const errText = await updateRes.text();
        console.error("[downgrade-expired-subscriptions] profiles update failed", errText);
        return new Response(JSON.stringify({ error: "Profiles update failed", details: errText }), {
          status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        });
      }

      console.log("[downgrade-expired-subscriptions] downgraded profiles", expiredProfiles.map((p: any) => p.full_name));
      profileDowngradedCount = expiredProfiles.length;
    }

    return new Response(JSON.stringify({ downgraded: orgDowngradedCount + profileDowngradedCount, organizations: orgDowngradedCount, profiles: profileDowngradedCount }), {
      status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
});
