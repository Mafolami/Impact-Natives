const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ALLOWED_TYPES = ["weekly_sector_match", "partner_match"];

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const userId = url.searchParams.get("user_id");
  const type   = url.searchParams.get("type");

  const appUrl = "https://app.impactnatives.com";

  if (!userId || !type || !ALLOWED_TYPES.includes(type)) {
    return Response.redirect(`${appUrl}/unsubscribe?status=invalid`, 302);
  }

  // Fetch current preferences
  const profileRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?select=notification_preferences&id=eq.${userId}`,
    {
      headers: {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    }
  );
  const profiles = await profileRes.json();
  const current = profiles?.[0]?.notification_preferences ?? {};

  const updated = { ...current, [type]: false };

  await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
        "Prefer": "return=minimal",
      },
      body: JSON.stringify({ notification_preferences: updated }),
    }
  );

  return Response.redirect(`${appUrl}/unsubscribe?status=success&type=${type}`, 302);
});