// supabase/functions/unsubscribe-newsletter/index.ts
// v7 (14 Oct 2026): redirect to impactnatives.com/unsubscribe. The page only
// exists on the marketing domain; on app.impactnatives.com the router sends
// every non-dashboard path to /signin, so people never saw the confirmation.
// v6 (14 Oct 2026): legacy JWT keys disabled after a leak; uses the new
// secret API key. Token must be URL-safe characters only. No other change.

function __envKeys(name: string): Record<string, string> {
  try { return JSON.parse(Deno.env.get(name) ?? "{}"); } catch { return {}; }
}
const SECRET_KEY = __envKeys("SUPABASE_SECRET_KEYS")["default"] ?? Object.values(__envKeys("SUPABASE_SECRET_KEYS"))[0] ?? "";

const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = SECRET_KEY;

Deno.serve(async (req: Request) => {
  const url    = new URL(req.url);
  const token  = url.searchParams.get("token");
  const appUrl = "https://impactnatives.com";

  if (!token || !/^[A-Za-z0-9_-]+$/.test(token)) {
    return Response.redirect(`${appUrl}/unsubscribe?status=invalid&type=newsletter`, 302);
  }

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/newsletter_subscribers?unsubscribe_token=eq.${token}&select=id,email,active`,
    {
      headers: {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    }
  );
  const rows = await res.json();

  if (!Array.isArray(rows) || rows.length === 0) {
    return Response.redirect(`${appUrl}/unsubscribe?status=invalid&type=newsletter`, 302);
  }

  const subscriber = rows[0];

  if (!subscriber.active) {
    return Response.redirect(`${appUrl}/unsubscribe?status=success&type=newsletter`, 302);
  }

  await fetch(
    `${SUPABASE_URL}/rest/v1/newsletter_subscribers?id=eq.${subscriber.id}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
        "Prefer": "return=minimal",
      },
      body: JSON.stringify({ active: false }),
    }
  );

  return Response.redirect(`${appUrl}/unsubscribe?status=success&type=newsletter`, 302);
});
