const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY       = Deno.env.get("RESEND_API_KEY") ?? "";
const GROQ_API_KEY         = Deno.env.get("GROQ_API_KEY") ?? "";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUBSCRIBE_URL = "https://app.impactnatives.com/#newsletter";
const PARTNER_URL   = "https://app.impactnatives.com/partner";
const SETTINGS_URL  = "https://app.impactnatives.com/dashboard/settings?tab=notifications";
const LINKEDIN_URL  = "https://linkedin.com/company/impact-natives";
const TWITTER_URL   = "https://twitter.com/impactnatives";
const INSTAGRAM_URL = "https://instagram.com/impactnatives";

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

async function groq(prompt: string, maxTokens = 3000): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  if (data.error) {
    console.log("Groq API error:", JSON.stringify(data.error));
    return "";
  }
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

async function webSearch(query: string): Promise<{ title: string; description: string; url: string }[]> {
  const BRAVE_KEY = Deno.env.get("BRAVE_SEARCH_API_KEY") ?? "";
  if (!BRAVE_KEY) return [];
  try {
    const res = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=6&freshness=pm`,
      { headers: { "Accept": "application/json", "X-Subscription-Token": BRAVE_KEY } }
    );
    const data = await res.json();
    return (data.web?.results ?? []).slice(0, 5).map((r: any) => ({
      title: r.title ?? "",
      description: r.description ?? "",
      url: r.url ?? "",
    }));
  } catch {
    return [];
  }
}

function monthName(date: Date): string {
  return date.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function issueNumber(date: Date): string {
  const start  = new Date("2025-11-01");
  const months = (date.getFullYear() - start.getFullYear()) * 12 + (date.getMonth() - start.getMonth());
  return String(Math.max(1, months + 1)).padStart(2, "0");
}

function buildEmailHtml(content: {
  firstName: string;
  email: string;
  opening: string;
  platformStats: { orgs: number; initiatives: number; partnerships: number };
  ecosystemNews: { headline: string; commentary: string; url: string }[];
  spotlight: { title: string; org: string; sector: string; ask: string } | null;
  partnerSpotlight: { org: string; type: string; sector: string; seeking: string } | null;
  regulatoryWatch: string | null;
  grants: { title: string; description: string; deadline: string; url: string }[];
  accelerators: { title: string; description: string; deadline: string; url: string }[];
  month: string;
  issue: string;
  unsubscribeUrl: string;
}): string {

  const whatsappMsg      = encodeURIComponent(`I thought you might find this useful. Impact Natives publishes a monthly newsletter on Africa's impact economy. Subscribe here: ${SUBSCRIBE_URL}`);
  const emailSubject     = encodeURIComponent("Something worth reading from Impact Natives");
  const emailBody        = encodeURIComponent(`I came across Native Signal, Impact Natives' monthly newsletter on Africa's impact economy, and thought it might be relevant to your work. Subscribe here: ${SUBSCRIBE_URL}`);

  const newsBlock = content.ecosystemNews.length > 0
    ? content.ecosystemNews.map((n, i) => `
      <tr>
        <td style="padding: 0 0 18px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f8f9fa; border-radius: 10px; overflow: hidden;">
            <tr>
              <td style="padding: 18px 20px 14px; border-left: 3px solid ${i % 2 === 0 ? "#2D6A4F" : "#C45C26"};">
                <p style="font-size: 16px; font-weight: 700; color: #111827; margin: 0 0 9px; line-height: 1.4; font-family: Georgia, serif;">${n.headline}</p>
                <p style="font-size: 15px; color: #4B5563; line-height: 1.75; margin: 0 0 14px; font-family: -apple-system, sans-serif;">${n.commentary}</p>
                ${n.url ? `<a href="${n.url}" style="font-size: 14px; font-weight: 600; color: #2D6A4F; text-decoration: none; font-family: -apple-system, sans-serif;">Read more</a>` : ""}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `).join("")
    : `<tr><td style="padding: 0 0 20px 0;"><p style="font-size: 13px; color: #9CA3AF; font-style: italic; font-family: -apple-system, sans-serif;">Ecosystem news will appear here next issue.</p></td></tr>`;

  const spotlightBlock = (content.spotlight || content.partnerSpotlight) ? `
    <tr>
      <td style="padding: 32px 0 0 0;">
        <table role="presentation" class="spotlight-card" width="100%" cellpadding="0" cellspacing="0" style="background: #ffffff; border-radius: 12px; overflow: hidden;">
          <tr>
            <td style="padding: 28px 28px 8px;">
               <p class="spotlight-label" style="font-size: 13px; font-weight: 700; color: #2D6A4F; text-transform: uppercase; letter-spacing: 0.1em; margin: 0 0 4px; font-family: -apple-system, sans-serif;">Natives Opportunity Spotlight</p>
                    <p class="spotlight-meta" style="font-size: 13px; color: #6B7280; margin: 0 0 20px; font-family: -apple-system, sans-serif;">Curated from the Impact Natives platform</p>
            </td>
          </tr>
          ${content.spotlight ? `
          <tr>
            <td style="padding: 0 28px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top: 1px solid #e5e7eb; padding-top: 20px;">                <tr>
                  <td style="padding-top: 20px;">
                    <p class="spotlight-label" style="font-size: 11px; font-weight: 700; color: #2D6A4F; text-transform: uppercase; letter-spacing: 0.1em; margin: 0 0 10px; font-family: -apple-system, sans-serif;">Initiative</p>
                    <p style="font-size: 18px; font-weight: 800; color: #111827; margin: 0 0 5px; line-height: 1.3; font-family: Georgia, serif;">${content.spotlight.title}</p>
                    <p class="spotlight-meta" style="font-size: 12px; color: #6B7280; margin: 0 0 12px; font-family: -apple-system, sans-serif;">${content.spotlight.org} &middot; ${content.spotlight.sector}</p>
                    <p class="spotlight-body" style="font-size: 14px; color: #374151; line-height: 1.75; margin: 0 0 16px; font-family: -apple-system, sans-serif;">${content.spotlight.ask}</p>
                    <a href="https://app.impactnatives.com/dashboard/marketplace" style="display: inline-block; background: #2D6A4F; color: #ffffff; font-size: 13px; font-weight: 600; padding: 11px 22px; border-radius: 6px; text-decoration: none; font-family: -apple-system, sans-serif;">View initiative</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : ""}
          ${content.partnerSpotlight ? `
          <tr>
            <td style="padding: 0 28px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top: 1px solid #e5e7eb;">
                <tr>
                  <td style="padding-top: 20px;">
                    <p class="spotlight-label" style="font-size: 11px; font-weight: 700; color: #2D6A4F; text-transform: uppercase; letter-spacing: 0.1em; margin: 0 0 10px; font-family: -apple-system, sans-serif;">Partnership listing</p>
                    <p style="font-size: 18px; font-weight: 800; color: #111827; margin: 0 0 5px; line-height: 1.3; font-family: Georgia, serif;">${content.partnerSpotlight.org}</p>
                    <p class="spotlight-meta" style="font-size: 12px; color: #6B7280; margin: 0 0 12px; font-family: -apple-system, sans-serif; text-transform: capitalize;">${content.partnerSpotlight.type} &middot; ${content.partnerSpotlight.sector}</p>
                    <p class="spotlight-body" style="font-size: 14px; color: #374151; line-height: 1.75; margin: 0 0 6px; font-family: -apple-system, sans-serif; font-weight: 600;">${content.partnerSpotlight.org} is looking for:</p>
                    <p class="spotlight-body" style="font-size: 14px; color: #374151; line-height: 1.75; margin: 0 0 16px; font-family: -apple-system, sans-serif;">${content.partnerSpotlight.seeking}</p>
                    <a href="https://app.impactnatives.com/dashboard/partnerships" style="display: inline-block; background: #2D6A4F; color: #ffffff; font-size: 13px; font-weight: 600; padding: 11px 22px; border-radius: 6px; text-decoration: none; font-family: -apple-system, sans-serif;">View listing</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : ""}
        </table>
      </td>
    </tr>
  ` : "";

  const regulatoryBlock = content.regulatoryWatch ? `
    <tr>
      <td style="padding: 28px 0 0 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding: 18px 20px; background: #fffbeb; border-radius: 8px; border-left: 3px solid #f59e0b;">
               <p style="font-size: 13px; font-weight: 700; color: #b45309; text-transform: uppercase; letter-spacing: 0.08em; margin: 0 0 10px; font-family: -apple-system, sans-serif;">Regulatory watch</p>
              <p style="font-size: 14px; color: #374151; line-height: 1.7; margin: 0; font-family: -apple-system, sans-serif;">${content.regulatoryWatch}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  ` : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Native Signal: ${content.month}</title>
<style>
  @media (prefers-color-scheme: dark) {
    .masthead-bg { background-color: #3d1f0a !important; }
    .footer-bg   { background-color: #3d1f0a !important; }
    .spotlight-card { background-color: #1c1c1e !important; }
    .spotlight-card p { color: #e5e7eb !important; }
    .spotlight-card span { color: #e5e7eb !important; }
    .spotlight-label { color: #52b788 !important; }
    .spotlight-meta { color: #9CA3AF !important; }
    .spotlight-body { color: #d1d5db !important; }
  }
  @media only screen and (max-width: 620px) {
    .outer-td { padding: 16px 8px !important; }
    .main-table { width: 100% !important; }
    .logo-cell { display: table-cell !important; width: 32px !important; vertical-align: middle !important; }
    .brand-cell { display: table-cell !important; text-align: center !important; vertical-align: middle !important; }
    .issue-cell { display: table-cell !important; text-align: right !important; vertical-align: middle !important; width: auto !important; }
    .issue-num { display: block !important; font-size: 11px !important; color: rgba(255,255,255,0.75) !important; white-space: nowrap !important; }
    .issue-mon { display: block !important; font-size: 10px !important; color: rgba(255,255,255,0.45) !important; white-space: nowrap !important; }
    .share-td { display: block !important; width: 100% !important; padding: 0 0 8px 0 !important; }
    .share-btn { display: block !important; width: 100% !important; text-align: center !important; box-sizing: border-box !important; }
    .stat-td { display: block !important; width: 100% !important; margin-bottom: 8px !important; }
    .body-pad { padding: 24px 20px 0 20px !important; }
    .footer-pad { padding: 24px 20px 20px !important; }
    h1.masthead-title { font-size: 26px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#ECEEF0;font-family:Georgia,'Times New Roman',serif;">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ECEEF0;">
<tr>
  <td align="center" class="outer-td" style="padding:28px 16px;">
    <table role="presentation" class="main-table" width="600" cellpadding="0" cellspacing="0" style="margin:0 auto;max-width:600px;">

      <!-- MASTHEAD -->
      <tr>
        <td class="masthead-bg" style="background:#1c0f07;border-radius:14px 14px 0 0;overflow:hidden;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">

            <!-- Top bar: brand + issue -->
            <tr>
              <td style="padding:14px 28px;border-bottom:1px solid rgba(255,255,255,0.07);">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <!-- Logo -->
                    <td class="logo-cell" style="width:32px;vertical-align:middle;padding-right:10px;">
                      <img src="https://lzpxlnjvegpxjuexyjdj.supabase.co/storage/v1/object/public/org-logos/6426b462-95ad-4c2c-abda-924d5cc0758c/logo.png" alt="Impact Natives" style="height:22px;width:auto;display:block;" />
                    </td>
                    <!-- Brand name -->
                    <td class="brand-cell" style="vertical-align:middle;">
                      <p style="font-size:13px;font-weight:700;color:#ffffff;letter-spacing:0.14em;text-transform:uppercase;margin:0;font-family:-apple-system,sans-serif;">Impact Natives</p>
                    </td>
                    <!-- Issue + month stacked -->
                    <td class="issue-cell" style="vertical-align:middle;text-align:right;">
                      <span class="issue-num" style="display:block;font-size:12px;color:rgba(255,255,255,0.75);font-family:-apple-system,sans-serif;white-space:nowrap;">Issue #${content.issue}</span>
                      <span class="issue-mon" style="display:block;font-size:11px;color:rgba(255,255,255,0.45);font-family:-apple-system,sans-serif;white-space:nowrap;">${content.month}</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Hero -->
            <tr>
              <td style="padding:44px 28px 40px;">
                      <p style="font-size:13px;font-weight:700;color:#e07a3a;letter-spacing:0.16em;text-transform:uppercase;margin:0 0 16px;font-family:-apple-system,sans-serif;">Native Signal</p>
                <h1 class="masthead-title" style="font-size:36px;font-weight:900;color:#ffffff;margin:0 0 12px;line-height:1.15;letter-spacing:-0.02em;font-family:Georgia,serif;">What moved in Africa's<br>impact economy.</h1>
                <p style="font-size:15px;color:rgba(255,255,255,0.75);margin:0;font-family:-apple-system,sans-serif;line-height:1.6;">Africa's impact economy, every month.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- BODY -->
      <tr>
        <td class="body-pad" style="background:#ffffff;padding:36px 32px 0 32px;">

          <!-- Greeting -->
          <p style="font-size:17px;color:#111827;margin:0 0 18px;font-family:Georgia,serif;">Dear ${content.firstName},</p>
          <p style="font-size:15px;color:#374151;line-height:1.85;margin:0 0 32px;font-family:Georgia,serif;">${content.opening}</p>

          <!-- Divider -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 30px;">
            <tr><td style="border-top:2px solid #f3f4f6;"></td></tr>
          </table>

          <!-- Platform stats -->
          <p style="font-size:13px;font-weight:700;color:#2D6A4F;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 20px;font-family:-apple-system,sans-serif;">This month on Impact Natives</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 36px;">
            <tr>
              <td class="stat-td" width="31%" style="text-align:center;padding:20px 10px;background:#f0fdf4;border-radius:10px;">
                <p style="font-size:34px;font-weight:900;color:#2D6A4F;margin:0 0 5px;font-family:-apple-system,sans-serif;">${content.platformStats.orgs}</p>
                <p style="font-size:12px;color:#6B7280;margin:0;font-family:-apple-system,sans-serif;line-height:1.5;">new verified<br>organisations</p>
              </td>
              <td width="4%"></td>
              <td class="stat-td" width="31%" style="text-align:center;padding:20px 10px;background:#f0fdf4;border-radius:10px;">
                <p style="font-size:34px;font-weight:900;color:#2D6A4F;margin:0 0 5px;font-family:-apple-system,sans-serif;">${content.platformStats.initiatives}</p>
                <p style="font-size:12px;color:#6B7280;margin:0;font-family:-apple-system,sans-serif;line-height:1.5;">initiatives<br>published</p>
              </td>
              <td width="4%"></td>
              <td class="stat-td" width="31%" style="text-align:center;padding:20px 10px;background:#f0fdf4;border-radius:10px;">
                <p style="font-size:34px;font-weight:900;color:#2D6A4F;margin:0 0 5px;font-family:-apple-system,sans-serif;">${content.platformStats.partnerships}</p>
                <p style="font-size:12px;color:#6B7280;margin:0;font-family:-apple-system,sans-serif;line-height:1.5;">partnerships<br>confirmed</p>
              </td>
            </tr>
          </table>

          <!-- Ecosystem news -->
          <p style="font-size:13px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 20px;font-family:-apple-system,sans-serif;">From the ecosystem</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${newsBlock}
          </table>

          ${spotlightBlock}
          ${regulatoryBlock}

          <!-- Open Calls -->
          ${(content.grants.length > 0 || content.accelerators.length > 0) ? `
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:36px 0 0 0;">
            <tr>
              <td style="background:#f8f9fa;border-radius:12px;overflow:hidden;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:24px 24px 8px;">
                      <p style="font-size:13px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 4px;font-family:-apple-system,sans-serif;">Open Calls</p>
                      <p style="font-size:13px;color:#9CA3AF;margin:0 0 0;font-family:-apple-system,sans-serif;">Grants, fellowships and programmes currently accepting applications</p>
                    </td>
                  </tr>
                  ${content.grants.map((g, i) => `
                  <tr>
                    <td style="padding:${i === 0 ? "20px 24px 0" : "0 24px 0"};">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e5e7eb;">
                        <tr>
                          <td style="padding:18px 0 18px 16px;border-left:3px solid #C45C26;">
                            <p style="font-size:11px;font-weight:700;color:#C45C26;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 6px;font-family:-apple-system,sans-serif;">Grant / Funding call</p>
                            <p style="font-size:15px;font-weight:700;color:#111827;margin:0 0 4px;font-family:-apple-system,sans-serif;">${g.title}</p>
                            <p style="font-size:12px;font-weight:600;color:#b45309;margin:0 0 8px;font-family:-apple-system,sans-serif;">Deadline: ${g.deadline}</p>
                            <p style="font-size:14px;color:#374151;line-height:1.7;margin:0 0 10px;font-family:-apple-system,sans-serif;">${g.description}</p>
                            ${g.url ? `<a href="${g.url}" style="font-size:13px;font-weight:600;color:#C45C26;text-decoration:none;font-family:-apple-system,sans-serif;">View grant</a>` : ""}
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  `).join("")}
                  ${content.accelerators.map((a, i) => `
                  <tr>
                    <td style="padding:0 24px ${i === content.accelerators.length - 1 ? "24px" : "0"};">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e5e7eb;">
                        <tr>
                          <td style="padding:18px 0 18px 16px;border-left:3px solid #7c3aed;">
                            <p style="font-size:11px;font-weight:700;color:#7c3aed;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 6px;font-family:-apple-system,sans-serif;">Accelerator / Fellowship</p>
                            <p style="font-size:15px;font-weight:700;color:#111827;margin:0 0 4px;font-family:-apple-system,sans-serif;">${a.title}</p>
                            <p style="font-size:12px;font-weight:600;color:#6d28d9;margin:0 0 8px;font-family:-apple-system,sans-serif;">Deadline: ${a.deadline}</p>
                            <p style="font-size:14px;color:#374151;line-height:1.7;margin:0 0 10px;font-family:-apple-system,sans-serif;">${a.description}</p>
                            ${a.url ? `<a href="${a.url}" style="font-size:13px;font-weight:600;color:#7c3aed;text-decoration:none;font-family:-apple-system,sans-serif;">Learn more</a>` : ""}
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  `).join("")}
                </table>
              </td>
            </tr>
          </table>
          ` : ""}

          <!-- Partner CTA -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:36px 0 0 0;">
            <tr>
              <td style="padding:24px;background:#f9fafb;border-radius:10px;border:1px solid #e5e7eb;">
                <p style="font-size:15px;font-weight:700;color:#111827;margin:0 0 8px;font-family:-apple-system,sans-serif;">Interested in partnering with us?</p>
                <p style="font-size:14px;color:#6B7280;margin:0 0 16px;font-family:-apple-system,sans-serif;line-height:1.7;">If you represent an organisation looking to collaborate, list your work, or explore what Impact Natives can do for your team, we would love to hear from you.</p>
                <a href="${PARTNER_URL}" style="display:inline-block;background:#1c0f07;color:#ffffff;font-size:13px;font-weight:600;padding:11px 22px;border-radius:6px;text-decoration:none;font-family:-apple-system,sans-serif;">Get in touch</a>
              </td>
            </tr>
          </table>

          <!-- Share -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:36px 0 0 0;">
            <tr>
              <td style="padding:32px 28px;background:#fffbeb;border-radius:10px;border-left:3px solid #f59e0b;text-align:center;">
                <p style="font-size:16px;font-weight:700;color:#111827;margin:0 0 10px;font-family:-apple-system,sans-serif;">Know someone making impact?</p>
                <p style="font-size:15px;color:#374151;margin:0 0 28px;font-family:-apple-system,sans-serif;line-height:1.75;">Help grow the network. Share Native Signal with a colleague or organisation that belongs in this conversation.</p>
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;width:100%;max-width:400px;">
                  <tr>
                    <td class="share-td" style="padding:0 6px 0 0;width:33%;">
                      <a href="https://wa.me/?text=${whatsappMsg}" class="share-btn" style="display:block;background:#2D6A4F;color:#ffffff;font-size:13px;font-weight:700;padding:13px 8px;border-radius:8px;text-decoration:none;font-family:-apple-system,sans-serif;white-space:nowrap;text-align:center;">WhatsApp</a>
                    </td>
                    <td class="share-td" style="padding:0 6px;width:33%;">
                      <a href="mailto:?subject=${emailSubject}&body=${emailBody}" class="share-btn" style="display:block;background:#2D6A4F;color:#ffffff;font-size:13px;font-weight:700;padding:13px 8px;border-radius:8px;text-decoration:none;font-family:-apple-system,sans-serif;white-space:nowrap;text-align:center;">Email colleague</a>
                    </td>
                    <td class="share-td" style="padding:0 0 0 6px;width:33%;">
                      <a href="https://app.impactnatives.com" class="share-btn" style="display:block;background:transparent;color:#2D6A4F;font-size:13px;font-weight:700;padding:12px 8px;border-radius:8px;text-decoration:none;font-family:-apple-system,sans-serif;white-space:nowrap;text-align:center;border:1px solid #2D6A4F;">Not right now</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

        </td>
      </tr>

      <!-- FOOTER -->
      <tr>
        <td class="footer-bg footer-pad" style="background:#1c0f07;border-radius:0 0 14px 14px;padding:44px 40px 40px;text-align:center;">
          <!-- Social -->
          <p style="font-size:12px;font-weight:700;color:#ffffff;text-transform:uppercase;letter-spacing:0.12em;margin:0 0 16px;font-family:-apple-system,sans-serif;">Connect with us</p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 32px;">
            <tr>
              <td style="padding-right:10px;">
                <a href="${LINKEDIN_URL}" style="display:inline-block;background:rgba(255,255,255,0.12);border-radius:8px;padding:10px 12px;text-decoration:none;">
                  <img src="https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/linkedin.svg" width="20" height="20" alt="LinkedIn" style="display:block;filter:invert(1);" />
                </a>
              </td>
              <td style="padding-right:10px;">
                <a href="${TWITTER_URL}" style="display:inline-block;background:rgba(255,255,255,0.12);border-radius:8px;padding:10px 12px;text-decoration:none;">
                  <img src="https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/x.svg" width="20" height="20" alt="X" style="display:block;filter:invert(1);" />
                </a>
              </td>
              <td>
                <a href="${INSTAGRAM_URL}" style="display:inline-block;background:rgba(255,255,255,0.12);border-radius:8px;padding:10px 12px;text-decoration:none;">
                  <img src="https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/instagram.svg" width="20" height="20" alt="Instagram" style="display:block;filter:invert(1);" />
                </a>
              </td>
            </tr>
          </table>
          <!-- Divider -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
            <tr><td style="border-top:1px solid rgba(255,255,255,0.1);"></td></tr>
          </table>
          <!-- Deliverability -->
          <p style="font-size:13px;color:rgba(255,255,255,0.85);margin:0 0 16px;line-height:1.75;font-family:-apple-system,sans-serif;">
            To ensure delivery to your inbox, please add <a href="mailto:impactnews@impactnatives.com" style="color:#e07a3a;text-decoration:none;font-weight:600;">impactnews@impactnatives.com</a> to your address book.
          </p>
          <!-- Legal -->
          <p style="font-size:13px;color:rgba(255,255,255,0.65);margin:0;line-height:1.9;font-family:-apple-system,sans-serif;">
            This email was sent to <span style="color:#ffffff;font-weight:600;">${content.email}</span>. You received this because you subscribed to Native Signal from Impact Natives.
            <br>
            <a href="${content.unsubscribeUrl}" style="color:rgba(255,255,255,0.7);text-decoration:underline;">Unsubscribe</a> &middot;
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

  try {
    const now         = new Date();
    const month       = monthName(now);
    const issue       = issueNumber(now);
    const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [newOrgsRes, newInitiativesRes, newPartnershipsRes, spotlightRes, partnerSpotlightRes] = await Promise.all([
      supabaseFetch(`organizations?select=id&created_at=gte.${oneMonthAgo}&verification_status=eq.verified`),
      supabaseFetch(`initiative_requests?select=id&status=eq.published&published_at=gte.${oneMonthAgo}`),
      supabaseFetch(`partnership_connections?select=id&status=eq.formed&updated_at=gte.${oneMonthAgo}`),
      supabaseFetch(`initiative_requests?select=id,title,submitter_org,sectors,specific_ask&status=eq.published&order=published_at.desc&limit=1`),
      supabaseFetch(`organizations?select=id,organisation_name,sector,partnership_sought,organisation_type&partnership_listed=eq.true&partnership_formed=eq.false&status=eq.published&order=updated_at.desc&limit=1`),
    ]);

    const platformStats = {
      orgs:         Array.isArray(newOrgsRes)         ? newOrgsRes.length         : 0,
      initiatives:  Array.isArray(newInitiativesRes)  ? newInitiativesRes.length  : 0,
      partnerships: Array.isArray(newPartnershipsRes) ? newPartnershipsRes.length : 0,
    };

    const spotlightRow = Array.isArray(spotlightRes) && spotlightRes.length > 0 ? spotlightRes[0] : null;
    const spotlight = spotlightRow ? {
      title:  spotlightRow.title,
      org:    spotlightRow.submitter_org ?? "Impact Natives",
      sector: (spotlightRow.sectors ?? [])[0] ?? "Impact",
      ask:    spotlightRow.specific_ask ?? "View this initiative for full details.",
    } : null;

    const partnerSpotlightRow = Array.isArray(partnerSpotlightRes) && partnerSpotlightRes.length > 0 ? partnerSpotlightRes[0] : null;
    const partnerSpotlight = partnerSpotlightRow ? {
      org:    partnerSpotlightRow.organisation_name ?? "An organisation",
      type:   partnerSpotlightRow.organisation_type?.replace(/_/g, " ") ?? "organisation",
      sector: (() => {
        const raw = partnerSpotlightRow.sector ?? "";
        try {
          if (Array.isArray(raw)) return raw[0] ?? "Impact";
          if (typeof raw === "string" && raw.startsWith("[")) return JSON.parse(raw)[0] ?? "Impact";
          if (typeof raw === "string" && raw.startsWith("{")) return raw.slice(1,-1).split(",")[0].replace(/"/g,"").trim() ?? "Impact";
          return raw || "Impact";
        } catch { return "Impact"; }
      })(),
      seeking: partnerSpotlightRow.partnership_sought ?? "Open to partnership discussions.",
    } : null;

    const [searchItems, grantItems, acceleratorItems] = await Promise.all([
      webSearch(
        `(site:theafricareport.com OR site:devex.com OR site:impactalpha.com OR site:theeastafrican.co.ke OR site:dailymaverick.co.za OR site:businessday.ng OR site:avca-africa.com OR site:convergence.finance OR site:odi.org OR site:cgdev.org OR site:quartz.com/africa OR site:nairametrics.com) impact investing ESG blended finance development Africa ${now.getFullYear()}`
      ),
      webSearch(
        `Africa grant funding call RFP "open" OR "applications open" NGO social enterprise impact ${now.toLocaleDateString("en-GB", { month: "long", year: "numeric" })} deadline`
      ),
      webSearch(
        `Africa accelerator fellowship "applications open" social enterprise startup impact ${now.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}`
      ),
    ]);

    const searchSnippets = searchItems
      .map(r => `- ${r.title}: ${r.description} [URL: ${r.url}]`)
      .join("\n");
    
    const EXCLUDED_TERMS = ["lgbti", "lgbtq", "lgbt", "lesbian", "gay", "bisexual", "transgender", "queer"];
    const filteredGrantItems = grantItems.filter(r => {
      const text = `${r.title} ${r.description}`.toLowerCase();
      return !EXCLUDED_TERMS.some(term => text.includes(term));
    });
    const grantSnippets = filteredGrantItems
      .map(r => `- ${r.title}: ${r.description} [URL: ${r.url}]`)
      .join("\n");

    const filteredAcceleratorItems = acceleratorItems.filter(r => {
      const text = `${r.title} ${r.description}`.toLowerCase();
      return !EXCLUDED_TERMS.some(term => text.includes(term));
    });
    const acceleratorSnippets = filteredAcceleratorItems
      .map(r => `- ${r.title}: ${r.description} [URL: ${r.url}]`)
      .join("\n");

      const contentPrompt = `You are the editorial voice of Native Signal, the monthly newsletter of Impact Natives. Impact Natives is a live B2B coordination platform connecting NGOs, social enterprises, startups, corporates, funders, and impact investors across Africa. Users come from across the continent and beyond, including diaspora organisations and international development actors deploying capital and programmes into Africa. The platform exists because partnerships across Africa's impact sector are still formed through personal networks and chance introductions, not structured systems.

      Your readers are senior practitioners: programme directors, fund managers, CSR and ESG leads, NGO country directors, impact investors, DFI officers, and development finance professionals. They are based in Lagos, Nairobi, Accra, Johannesburg, Kigali, Dakar, Addis Ababa, and beyond. They follow The Africa Report, Devex, Impact Alpha, The East African, Daily Maverick, and BusinessDay. They have no patience for generic statements, Western-framed narratives about Africa, or content that could apply to any newsletter about any region.
      
      Write content for issue #${issue} of Native Signal, covering ${month}.
      
      Platform activity this month:
      - New verified organisations joined: ${platformStats.orgs}
      - New initiatives published: ${platformStats.initiatives}
      - Partnerships confirmed: ${platformStats.partnerships}
      
      Grounding context:
      - Active sectors in Africa's impact economy right now: climate adaptation and clean energy, agri-finance and food systems, fintech for financial inclusion, gender-lens investing, youth employment and skills, health systems strengthening, and urban infrastructure.
      - Key actors in this space: DFIs including IFC, AfDB, British International Investment, Proparco, and OPIC. Foundations including Mastercard Foundation, Mo Ibrahim Foundation, and Gates Foundation. Fund managers including Novastar, TLcom, Alitheia, and Helios. Blended finance platforms including Convergence and the Global Fund.
      - The African Union Agenda 2063 goals 7, 10, and 18 frame the continental ambition across infrastructure, governance, and financial inclusion.
      - Blended finance, development impact bonds, results-based financing, and concessional capital are the live instruments across Sub-Saharan Africa.
      - The core problem Impact Natives addresses: credible implementing organisations across Africa are invisible to the funders and corporates looking for them, because no shared infrastructure exists for structured discovery, vetting, and coordination at scale.
      - Regulatory context: only reference specific country-level regulations in the regulatoryWatch field, and only when genuinely relevant to that month's news. Do not default to Nigerian regulation every issue. Cover the continent.
      
      Mandatory geographic diversity rule: each issue must reference developments or trends from at least two distinct African regions. Do not let the content centre on one country or subregion. West Africa, East Africa, Southern Africa, the Sahel, the Horn of Africa, and North Africa are all part of the ecosystem.
      
      Recent news from web search across African impact, development finance, and ESG sources. Use ONLY items from the search results below. Do not write news items from memory or training data. If fewer than 3 results are provided, return only as many items as have real search results. Rewrite commentary in your own words but base every claim on what the search result actually says:
      ${searchSnippets || "NONE. Return an empty array for ecosystemNews."}

      Grants and RFPs. Use ONLY items from the search results below. Do not invent grants, amounts, or deadlines. If a deadline is not explicitly stated in the search snippet, write: Verify deadline before applying. Return empty array if no results:
      ${grantSnippets || "NONE. Return an empty array for grants."}

      Accelerators and fellowships. Use ONLY items from the search results below. Do not invent programmes or deadlines. Return empty array if no results:
      ${acceleratorSnippets || "NONE. Return an empty array for accelerators."}
      
      Return ONLY valid JSON, no markdown, no preamble:
      {
        "opening": "2-3 sentences. Specific, editorial, grounded. Reference the month and at least one concrete thing: a platform development, a sector shift, or a named trend in African impact investing. Never open with a vague statement about Africa or impact broadly. Write as a senior practitioner addressing peers who will immediately recognise whether you know what you are talking about.",
        "ecosystemNews": [
          {
            "headline": "Specific headline that names a geography, sector, actor, or instrument",
            "commentary": "2-3 sentences written from inside the ecosystem. Name specific countries, funds, instruments, or actors where the evidence supports it. Be direct and opinionated. A reader in Nairobi or Accra should find this immediately relevant.",
            "url": "exact URL from search results, or empty string"
          },
          {
            "headline": "Specific headline from a different African region than the first",
            "commentary": "2-3 sentences. Different geography, different sector.",
            "url": "exact URL or empty string"
          },
          {
            "headline": "Third headline",
            "commentary": "2-3 sentences.",
            "url": "exact URL from search results. You must provide a URL for every news item. If no specific URL exists for this item, use the homepage URL of the most relevant source."
          }
        ],
        "regulatoryWatch": "1-2 sentences on regulatory or policy context relevant to ESG, sustainability reporting, development finance, or impact investment in Africa. Must name a specific country, instrument, or deadline. Return null if nothing genuinely newsworthy exists this month.",
        "grants": [
          {
            "title": "Grant or RFP name and funder",
            "description": "1-2 sentences on what is being funded, who is eligible, and the approximate amount if explicitly stated in search results.",
            "deadline": "Deadline date if explicitly stated in search results, otherwise write: Verify deadline before applying",
            "url": "exact URL from search results"
          }
        ],
        "accelerators": [
          {
            "title": "Accelerator or fellowship name and host",
            "description": "1-2 sentences on the programme, who it is for, and what it offers.",
            "deadline": "Application deadline if explicitly stated, otherwise: Verify deadline before applying",
            "url": "exact URL from search results"
          }
        ]
      }

      Critical rules for grants and accelerators: Only include items found in the search results provided. Do not invent grant names, amounts, deadlines, or programme names. Every item must have a real URL from the search results. If search results are empty, return empty arrays. Flag any deadline or amount not explicitly stated in the search snippet.
      
      Absolute rules: No em dashes. No exclamation marks. No filler. No sentences beginning with 'Africa is' or 'Across Africa'. No generic development sector language. Every claim must be grounded in something real and specific. Geographic diversity is mandatory across the three news items. Do not invent company names, fund names, or specific investment figures. If a specific actor or number cannot be confirmed from the search results provided, describe the trend without naming the actor. It is better to write "climate-focused startups in Kenya are attracting DFI attention" than to name a company you cannot verify. Only name organisations, funds, or people when their names appear in the search results provided. Exclude any grants, accelerators, or funding calls that are specifically focused on LGBTQI themes or beneficiaries. Do not include them even if they appear in search results.`;

    const raw = await groq(contentPrompt, 3000);
    let aiContent: any = {};
    try {
      const clean = raw.replace(/```json|```/g, "").trim();
      aiContent = JSON.parse(clean);
    } catch (parseErr) {
      aiContent = {
        opening: `${month} brought continued movement across Africa's impact sector. Here is what happened on Impact Natives and across the ecosystem this month.`,
        ecosystemNews: [],
        regulatoryWatch: null,
        grants: [],
        accelerators: [],
      };
    }

    const subscribers = await supabaseFetch(
      `newsletter_subscribers?select=email,name,unsubscribe_token&active=eq.true`
    );

    if (!Array.isArray(subscribers) || subscribers.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: "No active subscribers" }), {
        status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    let sent = 0;
    for (const sub of subscribers) {
      const firstName      = sub.name ? sub.name.split(" ")[0] : sub.email.split("@")[0];
      const unsubscribeUrl = `https://lzpxlnjvegpxjuexyjdj.supabase.co/functions/v1/unsubscribe-newsletter?token=${sub.unsubscribe_token}`;

      const html = buildEmailHtml({
        firstName,
        email:           sub.email,
        opening:         aiContent.opening         ?? "",
        platformStats,
        ecosystemNews:   (aiContent.ecosystemNews  ?? []).map((n: any) => ({
          headline:   n.headline   ?? "",
          commentary: n.commentary ?? "",
          url:        n.url        ?? "",
        })),
        spotlight,
        partnerSpotlight,
        regulatoryWatch: aiContent.regulatoryWatch ?? null,
        grants: (aiContent.grants ?? []).map((g: any) => ({
          title:       g.title       ?? "",
          description: g.description ?? "",
          deadline:    g.deadline    ?? "Verify deadline before applying",
          url:         g.url         ?? "",
        })),
        accelerators: (aiContent.accelerators ?? []).map((a: any) => ({
          title:       a.title       ?? "",
          description: a.description ?? "",
          deadline:    a.deadline    ?? "Verify deadline before applying",
          url:         a.url         ?? "",
        })),
        month,
        issue,
        unsubscribeUrl,
      });

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "Impact Natives <impactnews@impactnatives.com>",
          to: sub.email,
          subject: `Native Signal`,
          html,
        }),
      });

      if (res.ok) sent++;
      else {
        const err = await res.text();
        console.log(`Failed to send to ${sub.email}:`, err);
      }
    }

    return new Response(JSON.stringify({ sent, total: subscribers.length, month, issue }), {
      status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
});