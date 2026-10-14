// supabase/functions/daily-nudge-cron/index.ts
// v18 (14 Oct 2026): legacy anon/service_role JWT keys disabled after a leak.
// Reads the new secret API key from SUPABASE_SECRET_KEYS and accepts only calls
// carrying it (pg_cron sends it from Vault). verify_jwt is off; checked here.
//
// v16: verification_reminder_7d dropped "a credibility multiplier on
// Impact Points" -- same false claim fixed in
// verification-decision-notification v4. The real reward stays the badge
// and directory sort priority, both genuinely live.
//
// v15: LIVE. TEST_MODE flipped to false -- this now sends to real users
// and writes real notifications rows.

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

const TEST_MODE = false;
const TEST_EMAIL = "michafolami@gmail.com";

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

interface Template {
  subject: string;
  body: string;
  ctaText: string;
  ctaUrl: string;
  secondaryCtaText?: string;
  secondaryCtaUrl?: string;
}

const NO_ACTIVITY_TEMPLATES: Record<string, Record<string, Template>> = {
  implementer: {
    "60h": {
      subject: "{{org_name}}, what's next on Natives?",
      body: "Hi {{org_name}},\nYour organisation's profile is set up. The next step is to put Natives to work.\nPublishing an initiative gives potential partners something concrete to respond to. You can also browse organisations already on Natives.",
      ctaText: "Publish an initiative", ctaUrl: "/dashboard/marketplace?create=1",
      secondaryCtaText: "Browse organisations", secondaryCtaUrl: "/dashboard/natives",
    },
    "30d": {
      subject: "{{org_name}}, you haven't taken the next step yet",
      body: "Hi {{org_name}},\nIt's been a month since you completed your Natives profile, but there hasn't been any partnership activity yet.\nIf you're looking for partners, publishing an initiative gives other organisations something concrete to respond to. You can also browse organisations already on Natives.",
      ctaText: "Publish an initiative", ctaUrl: "/dashboard/marketplace?create=1",
      secondaryCtaText: "Browse organisations", secondaryCtaUrl: "/dashboard/natives",
    },
  },
  funder_corporate: {
    "60h": {
      subject: "{{org_name}}, explore organisations on Natives",
      body: "Hi {{org_name}},\nYour organisation's profile is ready.\nYou can now explore organisations on Natives and find potential partners working in areas relevant to your interests.",
      ctaText: "Browse organisations", ctaUrl: "/dashboard/natives",
    },
    "30d": {
      subject: "{{org_name}}, ready to explore Natives?",
      body: "Hi {{org_name}},\nIt's been a month since you completed your Natives profile, but you haven't taken a partnership action yet.\nWhen you're ready to explore potential partners, Natives is ready for you.",
      ctaText: "Browse organisations", ctaUrl: "/dashboard/natives",
    },
  },
};

const TEMPLATES: Record<string, Template> = {
  account_setup_incomplete_24h: {
    subject: "Finish setting up your Natives account",
    body: "Hi {{full_name}},\nYou started creating your Natives account, but haven't finished setting it up yet.\nUntil that's done, you won't be able to access your dashboard.",
    ctaText: "Finish setting up", ctaUrl: "/onboarding",
  },
  account_setup_incomplete_7d: {
    subject: "Your Natives account setup is still incomplete",
    body: "Hi {{full_name}},\nIt's been a week and your Natives account still isn't fully set up.\nYou won't be able to access your dashboard until it's finished.",
    ctaText: "Finish setting up", ctaUrl: "/onboarding",
  },
  account_setup_incomplete_30d: {
    subject: "Last reminder: finish setting up your Natives account",
    body: "Hi {{full_name}},\nIt's been a month since you started creating your Natives account, and it's still not fully set up.\nThis is our last reminder about this. We'll stop sending reminders after this one.",
    ctaText: "Finish setting up", ctaUrl: "/onboarding",
  },
  stale_partnership_request_14d: {
    subject: "{{counterpart_org_name}} is waiting for your response",
    body: "Hi {{org_name}},\n{{counterpart_org_name}} sent your organisation a partnership request on Natives 14 days ago.\nThe request is still awaiting your response.",
    ctaText: "Review the partnership request", ctaUrl: "__ROW_LINK__",
  },
  stale_partnership_request_30d: {
    subject: "{{counterpart_org_name}} is still waiting for a response",
    body: "Hi {{org_name}},\n{{counterpart_org_name}} has been waiting for a response to their partnership request for 30 days.\nIf you're interested in exploring the partnership, you can respond on Natives. If it isn't a fit, you can also close the request.",
    ctaText: "Review the partnership request", ctaUrl: "__ROW_LINK__",
  },
  unanswered_conversation_60h: {
    subject: "{{counterpart_org_name}} is waiting for your reply",
    body: "Hi {{full_name}},\n{{counterpart_org_name}} sent you a message on Natives, but the conversation hasn't received a response yet.\nIf you'd like to continue the conversation, you can reply from your Natives dashboard.",
    ctaText: "Reply to {{counterpart_org_name}}", ctaUrl: "__ROW_LINK__",
  },
  reengagement_7d: {
    subject: "Haven't seen you on Natives in a while",
    body: "Hi {{full_name}},\nYou haven't been back to Natives in a while.\nWhen you're ready, you can return to your dashboard and continue where you left off.",
    ctaText: "Return to Natives", ctaUrl: "/dashboard",
  },
  reengagement_14d: {
    subject: "Still looking for partners on Natives?",
    body: "Hi {{full_name}},\nIt's been two weeks since you last took an action on Natives.\nIf you're still looking for partners, opportunities, or organisations to work with, you can pick things up from your dashboard.",
    ctaText: "Return to Natives", ctaUrl: "/dashboard",
  },
  reengagement_30d: {
    subject: "One last check-in from Natives",
    body: "Hi {{full_name}},\nIt's been a month since you last took an action on Natives.\nWe'll stop sending these general reminders after this one. If you decide to return, your Natives account will still be there.",
    ctaText: "Return to Natives", ctaUrl: "/dashboard",
  },
  verification_reminder_7d: {
    subject: "Get verified on Natives",
    body: "Hi {{org_name}},\nYour organisation isn't verified yet.\nVerified organisations get a badge shown across the platform and priority placement in the partner directory.",
    ctaText: "Get verified", ctaUrl: "/verify",
  },
};

const SAMPLE_ROW = {
  full_name: "Sam Ogundele", org_name: "Sample Foundation", counterpart_org_name: "Partner Org",
  link: "/dashboard/marketplace?create=1", user_id: "preview", org_type_category: "implementer",
};

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
  if (!res.ok) console.log("[daily-nudge-cron] Resend error:", await res.text());
}

function fillPlaceholders(text: string, row: any): string {
  return text
    .replaceAll("{{full_name}}", row.full_name || "there")
    .replaceAll("{{org_name}}", row.org_name || "Your organisation")
    .replaceAll("{{counterpart_org_name}}", row.counterpart_org_name || "They");
}

function buildEmailHtml(opts: {
  bodyLines: string[];
  ctaText: string; ctaUrl: string;
  secondaryCtaText?: string; secondaryCtaUrl?: string;
  unsubscribeUrl: string;
  recipientEmail: string;
  testBanner?: string;
}): string {
  const paragraphs = opts.bodyLines
    .map(line => `<p style="font-size: 17px; color: #374151; line-height: 1.75; margin: 0 0 14px; font-family: ${BODY_FONT};">${line}</p>`)
    .join("");
  const secondary = opts.secondaryCtaText
    ? `<p style="margin: 14px 0 0;"><a href="${opts.secondaryCtaUrl}" style="color: ${GREEN}; font-size: 15px; font-family: ${BODY_FONT}; text-decoration: underline;">${opts.secondaryCtaText}</a></p>`
    : "";
  const testBanner = opts.testBanner
    ? `<tr><td style="background:#fef3c7; padding:10px 32px; font-size:12px; color:#92400e; font-weight:600; font-family: -apple-system, sans-serif;">${opts.testBanner}</td></tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&family=Bricolage+Grotesque:wght@500;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#ECEEF0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ECEEF0;">
  ${testBanner}
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
            ${secondary}
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
              <a href="${opts.unsubscribeUrl}" style="color:rgba(255,255,255,0.7);text-decoration:underline;">Unsubscribe</a> &middot;
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

function buildForRow(notif_type: string, row: any) {
  let template: Template | undefined;
  if (notif_type === "no_activity_60h" || notif_type === "no_activity_30d") {
    const stage = notif_type === "no_activity_60h" ? "60h" : "30d";
    const category = row.org_type_category === "funder_corporate" ? "funder_corporate" : "implementer";
    template = NO_ACTIVITY_TEMPLATES[category][stage];
  } else {
    template = TEMPLATES[notif_type];
  }
  if (!template) return null;
  const subject = fillPlaceholders(template.subject, row);
  const bodyLines = template.body.split("\n").map(l => fillPlaceholders(l, row));
  const ctaText = fillPlaceholders(template.ctaText, row);
  const ctaUrl = APP_URL + (template.ctaUrl === "__ROW_LINK__" ? (row.link ?? "/dashboard") : template.ctaUrl);
  const secondaryCtaUrl = template.secondaryCtaUrl ? APP_URL + template.secondaryCtaUrl : undefined;
  return { subject, bodyLines, ctaText, ctaUrl, secondaryCtaText: template.secondaryCtaText, secondaryCtaUrl };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  if (!isServerCall(req)) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  let previewType: string | null = null;
  let previewCategory: string | null = null;
  try {
    const body = await req.json();
    if (body?.preview && typeof body.preview === "string") previewType = body.preview;
    if (body?.org_type_category && typeof body.org_type_category === "string") previewCategory = body.org_type_category;
  } catch { /* no body / non-JSON body -- normal invocation */ }

  try {
    if (previewType) {
      const sampleRow = { ...SAMPLE_ROW, org_type_category: previewCategory ?? "implementer" };
      const built = buildForRow(previewType, sampleRow);
      if (!built) {
        return new Response(JSON.stringify({ error: `No template for "${previewType}"` }), {
          status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        });
      }
      const html = buildEmailHtml({
        bodyLines: built.bodyLines, ctaText: built.ctaText, ctaUrl: built.ctaUrl,
        secondaryCtaText: built.secondaryCtaText, secondaryCtaUrl: built.secondaryCtaUrl,
        unsubscribeUrl: `${SUPABASE_URL}/functions/v1/unsubscribe-email?user_id=preview&type=${previewType.split("_").slice(0, -1).join("_")}`,
        recipientEmail: "sample@example.org",
        testBanner: `PREVIEW — ${previewType}${previewCategory ? " (" + previewCategory + ")" : ""} — sample data, not a real candidate`,
      });
      await sendEmail(TEST_EMAIL, `[PREVIEW] ${built.subject}`, html);
      return new Response(JSON.stringify({ previewed: previewType, category: previewCategory, sent_to: TEST_EMAIL }), {
        status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const candidates = await supabaseFetch("rpc/compute_daily_nudges", { method: "POST", body: "{}" });

    if (!Array.isArray(candidates) || candidates.length === 0) {
      return new Response(JSON.stringify({ sent: 0, test_mode: TEST_MODE, message: "No candidates today", raw: candidates }), {
        status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const userIds = [...new Set(candidates.map((c: any) => c.user_id))];
    const profiles = await supabaseFetch(`profiles?select=id,email&id=in.(${userIds.join(",")})`);
    const emailByUserId = new Map<string, string>(
      Array.isArray(profiles) ? profiles.map((p: any) => [p.id, p.email]) : []
    );

    let sent = 0;
    const skippedNoTemplate: string[] = [];
    const skippedNoEmail: string[] = [];

    for (const row of candidates) {
      const built = buildForRow(row.notif_type, row);
      if (!built) { skippedNoTemplate.push(row.notif_type); continue; }

      const realEmail = emailByUserId.get(row.user_id);
      if (!realEmail) { skippedNoEmail.push(row.user_id); continue; }

      const unsubscribeUrl = `${SUPABASE_URL}/functions/v1/unsubscribe-email?user_id=${row.user_id}&type=${row.job_key}`;

      const html = buildEmailHtml({
        bodyLines: built.bodyLines, ctaText: built.ctaText, ctaUrl: built.ctaUrl,
        secondaryCtaText: built.secondaryCtaText, secondaryCtaUrl: built.secondaryCtaUrl,
        unsubscribeUrl, recipientEmail: realEmail,
        testBanner: TEST_MODE
          ? `TEST MODE — real recipient would be: ${row.full_name || row.org_name || row.user_id} (${realEmail}) — job: ${row.notif_type}${row.org_type_category ? " [" + row.org_type_category + "]" : ""}`
          : undefined,
      });

      if (TEST_MODE) {
        await sendEmail(TEST_EMAIL, `[TEST → ${row.org_name || row.full_name || row.user_id}] ${built.subject}`, html);
        sent++;
        continue;
      }

      await supabaseFetch("notifications", {
        method: "POST",
        body: JSON.stringify({
          user_id: row.user_id,
          type: row.notif_type,
          title: built.subject,
          body: built.bodyLines.join(" "),
          link: built.ctaUrl.replace(APP_URL, ""),
          read: false,
          metadata: { category: "nudge", ref_id: row.ref_id },
        }),
      });

      await sendEmail(realEmail, built.subject, html);
      sent++;
    }

    return new Response(JSON.stringify({
      sent, test_mode: TEST_MODE, total_candidates: candidates.length,
      skipped_no_template: skippedNoTemplate, skipped_no_email: skippedNoEmail,
    }), { status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });

  } catch (err) {
    console.error(`[daily-nudge-cron] Uncaught exception: ${String(err)}`);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
});
