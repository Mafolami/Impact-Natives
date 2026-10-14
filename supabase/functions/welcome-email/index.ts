import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

// Server-to-server only (14 Oct 2026): called by the profiles webhook trigger
// with the project's secret API key. verify_jwt was already off and there was no
// check of its own, so anyone with the URL could send this email to any address.
function secretKeys(): string[] {
  try { return Object.values(JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}")) as string[]; }
  catch { return []; }
}
function isServerCall(req: Request): boolean {
  const keys = secretKeys();
  if (keys.length === 0) return false;
  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const apikey = req.headers.get("apikey") ?? "";
  return keys.includes(bearer) || keys.includes(apikey);
}

const APP_URL = "https://app.impactnatives.com";
const MARKETING_URL = "https://impactnatives.com";
const LOGO_LIGHT_URL = "https://app.impactnatives.com/logodarks.png";
const LOGO_DARK_URL = "https://lzpxlnjvegpxjuexyjdj.supabase.co/storage/v1/object/public/org-logos/6426b462-95ad-4c2c-abda-924d5cc0758c/logo.png";
const LINKEDIN_URL = "https://linkedin.com/company/impact-natives";
const TWITTER_URL = "https://twitter.com/impactnatives";
const INSTAGRAM_URL = "https://instagram.com/impactnatives";
const REPLY_TO = "michael@impactnatives.com"; // confirm this is the monitored inbox

const GREEN = "#2D6A4F";
const TERRACOTTA = "#C45C26";
const OUTER_BG = "#F7EDE7"; // light terracotta wash, light mode only -- gives the card visual separation, like the LinkedIn reference
const CARD_BG = "#FFFFFF";
const TEXT = "#111827";
const MUTED = "#6B7280";
const BORDER = "#E9D9CE"; // warm-toned border to match the terracotta wash
const BADGE_LIGHT = "#F0EFEC";

const FUNDER_TYPES = ["philanthropic_foundation", "venture_capital"];
const CORPORATE_TYPES = ["corporation", "technology_company", "public_sector"];
// Any org_type not in FUNDER_TYPES or CORPORATE_TYPES defaults to implementer
// (same allow-list convention used elsewhere: an unlisted future org_type
// falls back to the least-privileged / most-common bucket rather than breaking).

interface Step {
  title: string;
  body: string;
  cta: string;
  href: string;
}

const STEP_SETS: Record<string, Step[]> = {
  funder: [
    { title: "Complete your mandate", body: "Sector, geography, investment thesis, and grant range. These are the fields our matching engine weighs most, so filling them in directly improves who gets surfaced to you.", cta: "Complete mandate", href: `${APP_URL}/dashboard/profile` },
    { title: "Get matched", body: "Describe what you're looking for in plain language, and we'll surface implementers whose work fits your mandate.", cta: "Get matched", href: `${APP_URL}/dashboard/partnerships` },
    { title: "Browse initiatives", body: "See funding asks live on the platform right now, across sectors and countries.", cta: "Browse initiatives", href: `${APP_URL}/dashboard/marketplace` },
  ],
  corporate: [
    { title: "Complete your profile", body: "Sector focus and partnership priorities. This is what determines which initiatives and partners get matched to you.", cta: "Complete profile", href: `${APP_URL}/dashboard/profile` },
    { title: "Browse initiatives", body: "Find vetted projects aligned to your priorities. Express interest directly and open a conversation.", cta: "Browse initiatives", href: `${APP_URL}/dashboard/marketplace` },
    { title: "Get matched", body: "We'll surface implementing partners whose work fits your priorities.", cta: "Get matched", href: `${APP_URL}/dashboard/partnerships` },
  ],
  implementer: [
    { title: "Post your first initiative", body: "Describe what you're working on and what kind of support you need. Funders and partners can find you and express interest directly.", cta: "Go to marketplace", href: `${APP_URL}/dashboard/marketplace` },
    { title: "Use Get Matched", body: "Describe what you're looking for in plain language, and we'll identify suitable partners from the directory and surface your listing to potential matches.", cta: "Get matched", href: `${APP_URL}/dashboard/partnerships` },
    { title: "Complete your Impact Profile", body: "Add your track record: beneficiaries reached, grants delivered, previous funders. This feeds directly into the materials funders generate when reviewing your work.", cta: "Update profile", href: `${APP_URL}/dashboard/profile` },
  ],
  individual: [
    { title: "Complete your profile", body: "Add your sector focus, expertise, and country. The more specific your profile, the easier it is for the right organisations to find you.", cta: "Complete profile", href: `${APP_URL}/dashboard/profile` },
    { title: "Browse the marketplace", body: "Find initiatives that match your skills and interests. Express interest directly and open a conversation with the initiative lead.", cta: "Browse initiatives", href: `${APP_URL}/dashboard/marketplace` },
  ],
};

function getSegment(userType: string | undefined, orgType: string | undefined): keyof typeof STEP_SETS {
  if (userType !== "organisation") return "individual";
  if (orgType && FUNDER_TYPES.includes(orgType)) return "funder";
  if (orgType && CORPORATE_TYPES.includes(orgType)) return "corporate";
  return "implementer";
}

serve(async (req) => {
  if (!isServerCall(req)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const payload = await req.json();
  const record = payload.record;
  const old = payload.old_record;

  if (!record?.email || !record?.onboarding_completed || old?.onboarding_completed === true) {
    return new Response("skipped", { status: 200 });
  }

  const isOrg = record.user_type === "organisation";
  const firstName = record.full_name?.split(" ")[0] || "there";
  const segment = getSegment(record.user_type, record.org_type);
  const steps = STEP_SETS[segment];

  const subject = isOrg
    ? `${firstName}, your organisation is live on Natives`
    : `${firstName}, your profile is live on Natives`;

  const openingLine = isOrg
    ? "Your organisation profile is live on Natives."
    : "Your profile is live on Natives.";

  const stepRows = steps.map((step, i) => {
    const isPrimary = i === 0;
    const ctaStyle = isPrimary
      ? `display:inline-block;background:${GREEN};color:#ffffff;font-size:14px;font-weight:600;padding:11px 22px;border-radius:6px;text-decoration:none;font-family:-apple-system,sans-serif;`
      : `display:inline-block;background:transparent;color:${GREEN};font-size:14px;font-weight:600;padding:9px 18px;border-radius:6px;text-decoration:none;font-family:-apple-system,sans-serif;border:1.5px solid ${GREEN};`;
    return `
      <tr>
        <td style="padding:0 0 24px 20px;border-left:2px solid ${isPrimary ? GREEN : BORDER};">
          <p class="op-text" style="font-size:17px;font-weight:700;color:${TEXT};margin:0 0 7px;font-family:-apple-system,sans-serif;">${step.title}</p>
          <p class="op-muted" style="font-size:15px;color:${MUTED};line-height:1.7;margin:0 0 16px;font-family:-apple-system,sans-serif;">${step.body}</p>
          <a href="${step.href}" style="${ctaStyle}">${step.cta} →</a>
        </td>
      </tr>
    `;
  }).join("");

  const whatsappMsg = encodeURIComponent(`I just joined Impact Natives, a platform connecting NGOs, funders, and corporates across Africa's social impact sector. Thought you or your organisation might belong here: ${MARKETING_URL}`);
  const emailSubject = encodeURIComponent("Thought you'd want to see this");
  const emailBody = encodeURIComponent(`I just joined Impact Natives, a coordination platform for Africa's social impact sector connecting NGOs, funders, and corporates. Thought you or your organisation might belong here: ${MARKETING_URL}`);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${subject}</title>
<style>
  @media only screen and (max-width: 620px) {
    .outer-td { padding: 32px 8px !important; }
    .main-table { width: 100% !important; }
    .card-pad { padding: 40px 24px !important; }
    .share-td { display: block !important; width: 100% !important; padding: 0 0 8px 0 !important; }
    .share-btn { display: block !important; width: 100% !important; text-align: center !important; box-sizing: border-box !important; }
  }
  .logo-dark-mode { display: none; }
  @media (prefers-color-scheme: dark) {
    .op-outer-bg { background-color: #15100b !important; }
    .op-card-bg { background-color: #221a13 !important; border-color: rgba(255,255,255,0.12) !important; }
    .op-text { color: #F3F1EC !important; }
    .op-muted { color: #B8B2A6 !important; }
    .op-border td { border-color: rgba(255,255,255,0.12) !important; }
    .logo-light-mode { display: none !important; }
    .logo-dark-mode { display: inline-block !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${OUTER_BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="op-outer-bg" style="background:${OUTER_BG};">
<tr>
  <td align="center" class="outer-td" style="padding:56px 16px;">
    <table role="presentation" class="main-table op-card-bg" width="600" cellpadding="0" cellspacing="0" style="margin:0 auto;max-width:600px;background:${CARD_BG};border-radius:16px;border:1px solid ${BORDER};overflow:hidden;">

      <tr>
        <td class="card-pad" style="padding:56px 48px;">

          <!-- Logo (swaps for dark mode) -->
          <div style="text-align:center;margin-bottom:36px;">
            <img class="logo-light-mode" src="${LOGO_LIGHT_URL}" alt="Impact Natives" style="height:60px;width:auto;display:inline-block;" />
            <img class="logo-dark-mode" src="${LOGO_DARK_URL}" alt="Impact Natives" style="height:60px;width:auto;" />
          </div>

          <!-- Hero -->
          <p style="font-size:13px;font-weight:700;color:${TERRACOTTA};letter-spacing:0.14em;text-transform:uppercase;margin:0 0 14px;text-align:center;">Welcome to the ecosystem</p>
          <h1 class="op-text" style="font-size:32px;font-weight:700;color:${TEXT};margin:0 0 12px;line-height:1.25;text-align:center;">Good to have you, ${firstName}.</h1>
          <p class="op-muted" style="font-size:17px;color:${MUTED};margin:0 0 36px;line-height:1.6;text-align:center;">${openingLine}</p>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="op-border" style="margin:0 0 32px;">
            <tr><td style="border-top:1px solid ${BORDER};"></td></tr>
          </table>

          <!-- Note from Michael -->
          <p style="font-size:14px;font-weight:700;color:${GREEN};text-transform:uppercase;letter-spacing:0.1em;margin:0 0 16px;">A note from Michael</p>
          <p class="op-text" style="font-size:17px;color:${TEXT};line-height:1.75;margin:0 0 18px;">Thanks for joining Natives. You're now a Native! We're still early, and every organisation and specialist who joins helps shape what this platform becomes.</p>
          <p class="op-text" style="font-size:17px;color:${TEXT};line-height:1.75;margin:0 0 18px;">So before you get started, tell me what you're hoping to find here. A partner, an opportunity, funding, expertise, or something else.</p>
          <p class="op-text" style="font-size:17px;color:${TEXT};line-height:1.75;margin:0 0 26px;">Reply to this email and tell me. I read every message.</p>
          <p class="op-text" style="font-size:15px;color:${TEXT};font-weight:600;margin:0;">Michael</p>
          <p class="op-muted" style="font-size:14px;color:${MUTED};margin:0 0 32px;">Founder, Natives</p>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="op-border" style="margin:0 0 32px;">
            <tr><td style="border-top:1px solid ${BORDER};"></td></tr>
          </table>

          <!-- Steps -->
          <p style="font-size:14px;font-weight:700;color:${GREEN};text-transform:uppercase;letter-spacing:0.1em;margin:0 0 22px;">Get started</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${stepRows}
          </table>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="op-border" style="margin:8px 0 32px;">
            <tr><td style="border-top:1px solid ${BORDER};"></td></tr>
          </table>

          <!-- Referral -->
          <p class="op-text" style="font-size:17px;font-weight:700;color:${TEXT};margin:0 0 10px;text-align:center;">Know someone making impact?</p>
          <p class="op-muted" style="font-size:16px;color:${MUTED};margin:0 0 26px;line-height:1.65;text-align:center;">Invite a colleague or organisation that belongs on Natives.</p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 36px;width:100%;max-width:420px;">
            <tr>
              <td class="share-td" style="padding:0 6px 0 0;width:33%;">
                <a href="https://wa.me/?text=${whatsappMsg}" class="share-btn" style="display:block;background:${GREEN};color:#ffffff;font-size:14px;font-weight:700;padding:13px 8px;border-radius:6px;text-decoration:none;white-space:nowrap;text-align:center;">WhatsApp</a>
              </td>
              <td class="share-td" style="padding:0 6px;width:33%;">
                <a href="mailto:?subject=${emailSubject}&body=${emailBody}" class="share-btn" style="display:block;background:${GREEN};color:#ffffff;font-size:14px;font-weight:700;padding:13px 8px;border-radius:6px;text-decoration:none;white-space:nowrap;text-align:center;">Email colleague</a>
              </td>
              <td class="share-td" style="padding:0 0 0 6px;width:33%;">
                <a href="${APP_URL}" class="share-btn" style="display:block;background:transparent;color:${GREEN};font-size:14px;font-weight:700;padding:12px 8px;border-radius:6px;text-decoration:none;white-space:nowrap;text-align:center;border:1px solid ${GREEN};">Not right now</a>
              </td>
            </tr>
          </table>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="op-border" style="margin:0 0 28px;">
            <tr><td style="border-top:1px solid ${BORDER};"></td></tr>
          </table>

          <!-- Social icons: plain external <img>, no CSS filter, light badge behind the icon's natural black color -->
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 28px;">
            <tr>
              <td style="padding:0 6px;">
                <a href="${LINKEDIN_URL}" style="display:inline-block;background:${BADGE_LIGHT};border-radius:8px;padding:10px;text-decoration:none;">
                  <img src="https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/linkedin.svg" width="20" height="20" alt="LinkedIn" style="display:block;" />
                </a>
              </td>
              <td style="padding:0 6px;">
                <a href="${TWITTER_URL}" style="display:inline-block;background:${BADGE_LIGHT};border-radius:8px;padding:10px;text-decoration:none;">
                  <img src="https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/x.svg" width="20" height="20" alt="X" style="display:block;" />
                </a>
              </td>
              <td style="padding:0 6px;">
                <a href="${INSTAGRAM_URL}" style="display:inline-block;background:${BADGE_LIGHT};border-radius:8px;padding:10px;text-decoration:none;">
                  <img src="https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/instagram.svg" width="20" height="20" alt="Instagram" style="display:block;" />
                </a>
              </td>
            </tr>
          </table>

          <!-- Footer -->
          <p class="op-muted" style="font-size:13px;color:${MUTED};margin:0 0 10px;text-align:center;line-height:1.7;">
            You received this because you created an account on Impact Natives.
            <br/>
            <a href="${APP_URL}" style="color:${MUTED};text-decoration:underline;">Visit the platform</a>
          </p>
          <p class="op-muted" style="font-size:13px;color:${MUTED};margin:0;text-align:center;">Impact Natives &middot; Lagos, Nigeria</p>

        </td>
      </tr>

    </table>
  </td>
</tr>
</table>
</body>
</html>`;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Michael from Impact Natives <welcome@impactnatives.com>",
      to: record.email,
      reply_to: REPLY_TO,
      subject,
      html,
    }),
  });

  return new Response("ok", { status: 200 });
});
