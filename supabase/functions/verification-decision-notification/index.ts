// supabase/functions/verification-decision-notification/index.ts
// v6 (14 Oct 2026): legacy JWT keys disabled after a leak. Uses the new
// publishable key (admin check) and secret key (service reads). Server
// callers are recognised by the secret key instead of a JWT role claim.
// v4: dropped the false "credibility multiplier" claim from approved copy.
// v3: approved copy lists the real benefits (badge, priority placement).

function __envKeys(name: string): Record<string, string> {
  try { return JSON.parse(Deno.env.get(name) ?? "{}"); } catch { return {}; }
}
const __SECRET_KEYS = Object.values(__envKeys("SUPABASE_SECRET_KEYS"));
const SECRET_KEY = __envKeys("SUPABASE_SECRET_KEYS")["default"] ?? __SECRET_KEYS[0] ?? "";
const PUBLISHABLE_KEY = __envKeys("SUPABASE_PUBLISHABLE_KEYS")["default"] ?? Object.values(__envKeys("SUPABASE_PUBLISHABLE_KEYS"))[0] ?? "";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = PUBLISHABLE_KEY;
const SUPABASE_SERVICE_KEY = SECRET_KEY;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GREEN = "#2D6A4F";
const APP_URL = "https://app.impactnatives.com";
const LOGO_URL = "https://lzpxlnjvegpxjuexyjdj.supabase.co/storage/v1/render/image/public/org-logos/6426b462-95ad-4c2c-abda-924d5cc0758c/logo.png?height=220&resize=contain&quality=80";
const LINKEDIN_URL = "https://linkedin.com/company/impact-natives";
const TWITTER_URL   = "https://twitter.com/impactnatives";
const INSTAGRAM_URL = "https://instagram.com/impactnatives";
const SETTINGS_URL  = "https://app.impactnatives.com/dashboard/settings?tab=notifications";
const BODY_FONT = "'Poppins', -apple-system, sans-serif";
const WORDMARK_FONT = `'Bricolage Grotesque', ${BODY_FONT}`;

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
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({ from: "Impact Natives <notifications@impactnatives.com>", to, subject, html }),
  });
  if (!res.ok) console.log("[verification-decision-notification] Resend error:", await res.text());
}

function isServiceRoleRequest(authHeader: string): boolean {
  if (__SECRET_KEYS.length === 0) return false;
  const token = authHeader.replace(/^Bearer\s+/i, "");
  return __SECRET_KEYS.includes(token);
}

async function callerIsAdmin(authHeader: string): Promise<boolean> {
  if (!authHeader) return false;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/is_admin`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": authHeader,
    },
    body: "{}",
  });
  if (!res.ok) return false;
  const result = await res.json();
  return result === true;
}

function fillPlaceholders(text: string, vars: Record<string, string>): string {
  let out = text;
  for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{{${k}}}`, v);
  return out;
}

function buildEmailHtml(opts: {
  bodyLines: string[];
  ctaText: string; ctaUrl: string;
  recipientEmail: string;
}): string {
  const paragraphs = opts.bodyLines
    .map(line => `<p style="font-size: 17px; color: #374151; line-height: 1.75; margin: 0 0 14px; font-family: ${BODY_FONT};">${line}</p>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&family=Bricolage+Grotesque:wght@500;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#ECEEF0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ECEEF0;">
  <tr>
    <td align="center" style="padding:28px 16px;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="margin:0 auto;max-width:560px;">

        <tr>
          <td align="center" style="padding:0 0 24px;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
              <tr>
                <td style="vertical-align:middle;padding-right:12px;">
                  <img src="${LOGO_URL}" alt="Impact Natives" style="height:88px;width:auto;display:block;" />
                </td>
                <td style="vertical-align:middle;">
                  <p style="font-size:16px;font-weight:700;color:#1c0f07;margin:0;font-family:${WORDMARK_FONT};">Impact Natives</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="background:#ffffff;border-radius:14px 14px 0 0;padding:28px 32px 36px;">
            ${paragraphs}
            <p style="margin: 20px 0 0;">
              <a href="${opts.ctaUrl}" style="display:inline-block; background:${GREEN}; color:#ffffff; font-size:15px; font-weight:600; padding:11px 22px; border-radius:9999px; text-decoration:none; font-family:${BODY_FONT};">${opts.ctaText}</a>
            </p>
          </td>
        </tr>

        <tr>
          <td style="background:#1c0f07;border-radius:0 0 14px 14px;padding:36px 32px 32px;text-align:center;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
              <tr>
                <td style="padding-right:10px;">
                  <a href="${LINKEDIN_URL}" style="display:inline-block;background:rgba(255,255,255,0.12);border-radius:8px;padding:10px 12px;text-decoration:none;">
                    <img src="https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/linkedin.svg" width="18" height="18" alt="LinkedIn" style="display:block;filter:invert(1);" />
                  </a>
                </td>
                <td style="padding-right:10px;">
                  <a href="${TWITTER_URL}" style="display:inline-block;background:rgba(255,255,255,0.12);border-radius:8px;padding:10px 12px;text-decoration:none;">
                    <img src="https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/x.svg" width="18" height="18" alt="X" style="display:block;filter:invert(1);" />
                  </a>
                </td>
                <td>
                  <a href="${INSTAGRAM_URL}" style="display:inline-block;background:rgba(255,255,255,0.12);border-radius:8px;padding:10px 12px;text-decoration:none;">
                    <img src="https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/instagram.svg" width="18" height="18" alt="Instagram" style="display:block;filter:invert(1);" />
                  </a>
                </td>
              </tr>
            </table>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;"><tr><td style="border-top:1px solid rgba(255,255,255,0.1);"></td></tr></table>
            <p style="font-size:13px;color:rgba(255,255,255,0.85);margin:0 0 14px;line-height:1.7;font-family:${BODY_FONT};">
              To ensure delivery to your inbox, please add <a href="mailto:notifications@impactnatives.com" style="color:#e07a3a;text-decoration:none;font-weight:600;">notifications@impactnatives.com</a> to your address book.
            </p>
            <p style="font-size:13px;color:rgba(255,255,255,0.65);margin:0;line-height:1.8;font-family:${BODY_FONT};">
              This email was sent to <span style="color:#ffffff;font-weight:600;">${opts.recipientEmail}</span> because you have an account on Impact Natives.
              <br>
              <a href="${SETTINGS_URL}" style="color:rgba(255,255,255,0.7);text-decoration:underline;">Manage preferences</a>
              <br><br>Impact Natives &middot; Lagos, Nigeria
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  const authHeader = req.headers.get("Authorization") ?? "";
  const authorized = isServiceRoleRequest(authHeader) || await callerIsAdmin(authHeader);
  if (!authorized) {
    return new Response(JSON.stringify({ error: "Forbidden -- admin only" }), {
      status: 403, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  try {
    const { user_id, decision, reason } = await req.json();
    if (!user_id || (decision !== "approved" && decision !== "rejected")) {
      return new Response(JSON.stringify({ error: "user_id and decision ('approved'|'rejected') are required" }), {
        status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }
    if (decision === "rejected" && !reason) {
      return new Response(JSON.stringify({ error: "reason is required when decision is 'rejected'" }), {
        status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const profiles = await supabaseFetch(`profiles?select=full_name,email&id=eq.${user_id}`);
    const profile = Array.isArray(profiles) ? profiles[0] : null;
    if (!profile?.email) {
      return new Response(JSON.stringify({ error: "Profile or email not found" }), {
        status: 404, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }
    const orgs = await supabaseFetch(`organizations?select=organisation_name&user_id=eq.${user_id}`);
    const orgName = Array.isArray(orgs) && orgs[0]?.organisation_name ? orgs[0].organisation_name : profile.full_name;

    let subject: string, bodyLines: string[], ctaText: string, ctaUrl: string;

    if (decision === "approved") {
      subject = "You're verified on Natives";
      bodyLines = [
        fillPlaceholders("Hi {{org_name}},", { org_name: orgName }),
        "Your organisation is now verified.",
        "You now have a badge shown across the platform and priority placement in the partner directory.",
      ];
      ctaText = "View your profile";
      ctaUrl = `${APP_URL}/dashboard/natives`;
    } else {
      subject = "Your verification wasn't approved";
      bodyLines = [
        fillPlaceholders("Hi {{org_name}},", { org_name: orgName }),
        fillPlaceholders("Your verification request wasn't approved. Reason: {{reason}}", { reason }),
        "Fix the issue above and resubmit -- most rejections are resolved on the second try.",
      ];
      ctaText = "Fix & resubmit";
      ctaUrl = `${APP_URL}/verify`;
    }

    const html = buildEmailHtml({ bodyLines, ctaText, ctaUrl, recipientEmail: profile.email });
    await sendEmail(profile.email, subject, html);

    return new Response(JSON.stringify({ sent: true, decision, to: profile.email }), {
      status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });

  } catch (err) {
    console.error(`[verification-decision-notification] Uncaught exception: ${String(err)}`);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
});
