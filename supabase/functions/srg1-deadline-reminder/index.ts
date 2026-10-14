// supabase/functions/srg1-deadline-reminder/index.ts
// Cron-only, monthly. Notifies orgs flagged as SRG1-subject (self-declared
// PIE, or annual revenue >= NGN 30bn) of the upcoming FRC Nigeria SRG1
// mandatory disclosure deadline.
//
// *** SRG1_DEADLINE_YEAR below is the only part confirmed with reasonable
// confidence (mandatory PIE disclosure by 2028, effective window from Feb
// 2026). The exact month/day was never verified against the actual FRC
// Nigeria publication, so messaging intentionally says "by 2028" rather
// than fabricating a specific date. ***
//
// v4 (14 Oct 2026): legacy JWT keys disabled after a leak. Uses the new
// secret API key (SUPABASE_SECRET_KEYS); cron-only check now compares the
// caller's key against it instead of reading a JWT role claim.
// v2: dismissal suppression (DISMISS_SUPPRESS_DAYS).

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
const SUPABASE_SERVICE_KEY = SECRET_KEY;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// UNVERIFIED precise date -- see file header. Year only, confirmed with FRC Nigeria still pending.
const SRG1_DEADLINE_YEAR = 2028;
const DISMISS_SUPPRESS_DAYS = 25;

async function supabaseFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_SERVICE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
      "Prefer": "return=representation",
      ...(options.headers ?? {}),
    },
  });
  return res.json();
}

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY || !to) return;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({ from: "Impact Natives <notifications@impactnatives.com>", to, subject, html }),
  });
  if (!res.ok) console.log("[srg1-deadline-reminder] Resend error:", await res.text());
}

function buildReminderEmailHtml(orgName: string): string {
  const GREEN = "#2D6A4F";
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #ffffff; font-family: -apple-system, sans-serif;">
      <tr>
        <td align="center" style="padding: 32px 24px; background-color: #f4f4f4;">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="margin: 0 auto; background: #ffffff; border-radius: 12px;">
            <tr>
              <td style="padding: 32px;">
                <p style="font-size: 12px; font-weight: 600; color: ${GREEN}; text-transform: uppercase; letter-spacing: 0.06em; margin: 0 0 12px;">SRG1 compliance reminder</p>
                <h1 style="font-size: 20px; font-weight: 700; color: #111827; margin: 0 0 16px;">${orgName}, your SRG1 disclosure deadline is approaching</h1>
                <p style="font-size: 14px; color: #374151; line-height: 1.6; margin: 0 0 16px;">
                  Your organisation is flagged as a Public Interest Entity under FRC Nigeria's SRG1 sustainability reporting requirements.
                  Mandatory disclosure is due by <strong>${SRG1_DEADLINE_YEAR}</strong>.
                </p>
                <p style="font-size: 13px; color: #6b7280; line-height: 1.6; margin: 0;">
                  This is an automated reminder based on your self-declared compliance status in your Impact Natives profile. Please confirm the exact requirements and deadline directly with FRC Nigeria.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  // Server-only: loops over every SRG1-flagged org and sends
  // notifications + emails. Must never be reachable with the publishable key.
  if (!isServerCall(req)) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  try {
    const flaggedOrgs = await supabaseFetch(
      `organizations?select=id,user_id,organisation_name,srg1_reminder_dismissed_at&or=(srg1_pie_self_declared.eq.true,srg1_annual_revenue_ngn.gte.30000000000)`
    );

    if (!Array.isArray(flaggedOrgs) || flaggedOrgs.length === 0) {
      return new Response(JSON.stringify({ notified: 0, skipped_dismissed: 0, message: "No SRG1-subject orgs" }), {
        status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const now = Date.now();
    const suppressMs = DISMISS_SUPPRESS_DAYS * 24 * 60 * 60 * 1000;
    const dueOrgs = flaggedOrgs.filter((org: any) => {
      if (!org.srg1_reminder_dismissed_at) return true;
      const dismissedAt = new Date(org.srg1_reminder_dismissed_at).getTime();
      return (now - dismissedAt) >= suppressMs;
    });
    const skippedDismissed = flaggedOrgs.length - dueOrgs.length;

    if (dueOrgs.length === 0) {
      return new Response(JSON.stringify({ notified: 0, skipped_dismissed: skippedDismissed }), {
        status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const userIds = dueOrgs.map((o: any) => o.user_id).filter(Boolean);
    const profiles = await supabaseFetch(`profiles?select=id,email&id=in.(${userIds.join(",")})`);
    const emailByUserId = new Map<string, string>(
      Array.isArray(profiles) ? profiles.map((p: any) => [p.id, p.email]) : []
    );

    let notified = 0;
    for (const org of dueOrgs) {
      const email = emailByUserId.get(org.user_id);
      const orgName = org.organisation_name ?? "Your organisation";

      await supabaseFetch("notifications", {
        method: "POST",
        body: JSON.stringify({
          user_id: org.user_id,
          type: "srg1_deadline_reminder",
          title: "SRG1 compliance deadline approaching",
          body: `${orgName} is flagged as SRG1-subject. Mandatory disclosure is due by ${SRG1_DEADLINE_YEAR}.`,
          link: "/dashboard/profile",
          read: false,
        }),
      });

      if (email) {
        await sendEmail(
          email,
          "SRG1 compliance deadline reminder",
          buildReminderEmailHtml(orgName)
        );
      }
      notified++;
    }

    return new Response(JSON.stringify({ notified, skipped_dismissed: skippedDismissed }), {
      status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  } catch (err) {
    console.error(`[srg1-deadline-reminder] Uncaught exception: ${String(err)}`);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
});
