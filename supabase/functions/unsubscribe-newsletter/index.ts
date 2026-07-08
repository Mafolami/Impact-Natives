const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req: Request) => {
  const url    = new URL(req.url);
  const token  = url.searchParams.get("token");
  const appUrl = "https://app.impactnatives.com";

  if (!token) {
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