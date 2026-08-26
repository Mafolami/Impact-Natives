// supabase/functions/downgrade-expired-subscriptions/index.ts
//
// Daily safety net: any org OR individual account whose
// subscription_current_period_end has passed but is still marked 'active'
// OR 'past_due' gets moved back to Free. Runs AFTER renew-subscriptions
// (see that function's header) -- renew-subscriptions attempts to
// re-charge accounts due within the next 24h; a successful renewal pushes
// period_end forward and removes the account from this query's window
// before it ever gets here. A failed renewal is marked 'past_due' by that
// function and deliberately NOT retried -- this sweep is what finally
// reverts a past_due account to Free once its period genuinely runs out,
// giving it a short grace window (visible in the Billing tab as "Past
// due") between a failed renewal charge and actually losing access. This
// function itself never attempts to charge anything, only revokes access
// once the paid period has genuinely lapsed.
//
// v2: sweeps both organizations and profiles (individual accounts).
// Runs as two independent passes over the same logic -- kept as two
// straight-line blocks rather than a shared helper parameterized by table
// name, since the two tables' select columns differ slightly
// (organisation_name vs full_name) and duplicating ~20 lines is cheaper to
// read correctly than a generic helper would be to verify correct.
//
// Cron-only, same convention as monthly-activity-digest / sweep-stale-*:
// checks the caller's JWT role claim rather than a literal key comparison
// (see monthly-activity-digest for why literal comparison is fragile).

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  if (!isServiceRoleRequest(req)) {
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
