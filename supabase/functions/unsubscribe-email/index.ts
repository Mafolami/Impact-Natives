// supabase/functions/unsubscribe-email/index.ts
// v7 (14 Oct 2026): redirect to impactnatives.com/unsubscribe. The page only
// exists on the marketing domain; on app.impactnatives.com the router sends
// every non-dashboard path to /signin, so people never saw the confirmation.
// v6 (14 Oct 2026): legacy JWT keys disabled after a leak; uses the new
// secret API key. Also deployed with verify_jwt OFF: this is opened from a
// plain link in an email, which carries no Authorization header, so with
// verify_jwt on every click got a 401 JSON error instead of unsubscribing.
// user_id must now be a UUID.
//
// v4: extended for the nudge cron's notification types. Sets
// notification_preferences[type] = false.

function __envKeys(name: string): Record<string, string> {
  try { return JSON.parse(Deno.env.get(name) ?? "{}"); } catch { return {}; }
}
const SECRET_KEY = __envKeys("SUPABASE_SECRET_KEYS")["default"] ?? Object.values(__envKeys("SUPABASE_SECRET_KEYS"))[0] ?? "";

const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = SECRET_KEY;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ALLOWED_TYPES = [
  "weekly_sector_match",
  "partner_match",
  "account_setup_incomplete",
  "no_activity",
  "stale_partnership_request",
  "unanswered_conversation",
  "reengagement",
  "verification_reminder",
];

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const userId = url.searchParams.get("user_id");
  const type   = url.searchParams.get("type");

  const appUrl = "https://impactnatives.com";

  if (!userId || !UUID_RE.test(userId) || !type || !ALLOWED_TYPES.includes(type)) {
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
