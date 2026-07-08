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

async function groq(prompt: string, maxTokens = 1400): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
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
  regulatoryWatch: string | null;
  month: string;
  issue: string;
  unsubscribeUrl: string;
}): string {

  const whatsappMsg      = encodeURIComponent(`I thought you might find this useful. Impact Natives publishes a monthly newsletter on Africa's impact economy. Subscribe here: ${SUBSCRIBE_URL}`);
  const emailSubject     = encodeURIComponent("Something worth reading from Impact Natives");
  const emailBody        = encodeURIComponent(`I came across The Native, Impact Natives' monthly newsletter on Africa's impact economy, and thought it might be relevant to your work. Subscribe here: ${SUBSCRIBE_URL}`);

  const newsBlock = content.ecosystemNews.length > 0
    ? content.ecosystemNews.map((n, i) => `
      <tr>
        <td style="padding: 0 0 18px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f8f9fa; border-radius: 10px; overflow: hidden;">
            <tr>
              <td style="padding: 18px 20px 14px; border-left: 3px solid ${i % 2 === 0 ? "#2D6A4F" : "#C45C26"};">
                <p style="font-size: 14px; font-weight: 700; color: #111827; margin: 0 0 7px; line-height: 1.4; font-family: Georgia, serif;">${n.headline}</p>
                <p style="font-size: 13px; color: #4B5563; line-height: 1.7; margin: 0 0 12px; font-family: -apple-system, sans-serif;">${n.commentary}</p>
                ${n.url ? `<a href="${n.url}" style="font-size: 12px; font-weight: 600; color: #2D6A4F; text-decoration: none; font-family: -apple-system, sans-serif;">Read more &rarr;</a>` : ""}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `).join("")
    : `<tr><td style="padding: 0 0 20px 0;"><p style="font-size: 13px; color: #9CA3AF; font-style: italic; font-family: -apple-system, sans-serif;">Ecosystem news will appear here next issue.</p></td></tr>`;

  const spotlightBlock = content.spotlight ? `
    <tr>
      <td style="padding: 32px 0 0 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #0f1a14; border-radius: 12px; overflow: hidden;">
          <tr>
            <td style="padding: 26px 28px;">
              <p style="font-size: 10px; font-weight: 700; color: #52b788; text-transform: uppercase; letter-spacing: 0.1em; margin: 0 0 12px; font-family: -apple-system, sans-serif;">Opportunity spotlight</p>
              <p style="font-size: 18px; font-weight: 800; color: #ffffff; margin: 0 0 6px; line-height: 1.3; font-family: Georgia, serif;">${content.spotlight.title}</p>
              <p style="font-size: 12px; color: #9CA3AF; margin: 0 0 12px; font-family: -apple-system, sans-serif;">${content.spotlight.org} &middot; ${content.spotlight.sector}</p>
              <p style="font-size: 14px; color: #D1FAE5; line-height: 1.7; margin: 0 0 18px; font-family: -apple-system, sans-serif;">${content.spotlight.ask}</p>
              <a href="https://app.impactnatives.com/dashboard/marketplace" style="display: inline-block; background: #2D6A4F; color: #ffffff; font-size: 13px; font-weight: 600; padding: 11px 22px; border-radius: 6px; text-decoration: none; font-family: -apple-system, sans-serif;">View initiative &rarr;</a>
            </td>
          </tr>
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
              <p style="font-size: 10px; font-weight: 700; color: #b45309; text-transform: uppercase; letter-spacing: 0.08em; margin: 0 0 7px; font-family: -apple-system, sans-serif;">Regulatory watch</p>
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
  @media only screen and (max-width: 620px) {
    .outer-td { padding: 16px 8px !important; }
    .main-table { width: 100% !important; }
    .masthead-top td { display: block !important; width: 100% !important; text-align: left !important; }
    .issue-line { text-align: left !important; margin-top: 4px !important; }
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
        <td style="background:#1c0f07;border-radius:14px 14px 0 0;overflow:hidden;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">

            <!-- Top bar: brand + issue -->
            <tr>
              <td style="padding:14px 28px;border-bottom:1px solid rgba(255,255,255,0.07);">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="masthead-top">
                  <tr>
                    <td>
                      <p style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.45);letter-spacing:0.14em;text-transform:uppercase;margin:0;font-family:-apple-system,sans-serif;">Impact Natives</p>
                    </td>
                    <td align="right" class="issue-line">
                      <p style="font-size:11px;color:rgba(255,255,255,0.3);margin:0;font-family:-apple-system,sans-serif;white-space:nowrap;">Issue #${content.issue} &middot; ${content.month}</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Hero -->
            <tr>
              <td style="padding:44px 28px 40px;">
                <p style="font-size:11px;font-weight:700;color:#e07a3a;letter-spacing:0.16em;text-transform:uppercase;margin:0 0 16px;font-family:-apple-system,sans-serif;">Native Signal</p>
                <h1 class="masthead-title" style="font-size:32px;font-weight:900;color:#ffffff;margin:0 0 12px;line-height:1.15;letter-spacing:-0.02em;font-family:Georgia,serif;">What moved in Africa's<br>impact economy.</h1>
                <p style="font-size:14px;color:rgba(255,255,255,0.45);margin:0;font-family:-apple-system,sans-serif;line-height:1.6;">Africa's impact economy, every month.</p>
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
          <p style="font-size:10px;font-weight:700;color:#2D6A4F;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 16px;font-family:-apple-system,sans-serif;">This month on Impact Natives</p>
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
          <p style="font-size:10px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 16px;font-family:-apple-system,sans-serif;">From the ecosystem</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${newsBlock}
          </table>

          ${spotlightBlock}
          ${regulatoryBlock}

          <!-- Partner CTA -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:36px 0 0 0;">
            <tr>
              <td style="padding:24px;background:#f9fafb;border-radius:10px;border:1px solid #e5e7eb;">
                <p style="font-size:15px;font-weight:700;color:#111827;margin:0 0 8px;font-family:-apple-system,sans-serif;">Interested in partnering with us?</p>
                <p style="font-size:14px;color:#6B7280;margin:0 0 16px;font-family:-apple-system,sans-serif;line-height:1.7;">If you represent an organisation looking to collaborate, list your work, or explore what Impact Natives can do for your team, we would love to hear from you.</p>
                <a href="${PARTNER_URL}" style="display:inline-block;background:#1c0f07;color:#ffffff;font-size:13px;font-weight:600;padding:11px 22px;border-radius:6px;text-decoration:none;font-family:-apple-system,sans-serif;">Get in touch &rarr;</a>
              </td>
            </tr>
          </table>

          <!-- Share -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 0 0;">
            <tr>
              <td style="padding:24px;background:#f0fdf4;border-radius:10px;text-align:center;">
                <p style="font-size:15px;font-weight:700;color:#111827;margin:0 0 8px;font-family:-apple-system,sans-serif;">Know someone making impact?</p>
                <p style="font-size:14px;color:#6B7280;margin:0 0 20px;font-family:-apple-system,sans-serif;line-height:1.7;">Help grow the network. Share The Native with a colleague or organisation that belongs in this conversation.</p>
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;width:100%;max-width:420px;">
                  <tr>
                    <td class="share-td" style="padding:0 5px 0 0;width:33%;">
                      <a href="https://wa.me/?text=${whatsappMsg}" class="share-btn" style="display:block;background:#25D366;color:#ffffff;font-size:12px;font-weight:700;padding:11px 8px;border-radius:6px;text-decoration:none;font-family:-apple-system,sans-serif;white-space:nowrap;text-align:center;">WhatsApp</a>
                    </td>
                    <td class="share-td" style="padding:0 5px;width:33%;">
                      <a href="mailto:?subject=${emailSubject}&body=${emailBody}" class="share-btn" style="display:block;background:#1c0f07;color:#ffffff;font-size:12px;font-weight:700;padding:11px 8px;border-radius:6px;text-decoration:none;font-family:-apple-system,sans-serif;white-space:nowrap;text-align:center;">Email colleague</a>
                    </td>
                    <td class="share-td" style="padding:0 0 0 5px;width:33%;">
                      <a href="${PARTNER_URL}" class="share-btn" style="display:block;background:transparent;color:#2D6A4F;font-size:12px;font-weight:700;padding:10px 8px;border-radius:6px;text-decoration:none;font-family:-apple-system,sans-serif;white-space:nowrap;text-align:center;border:1px solid #2D6A4F;">Not right now</a>
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
        <td class="footer-pad" style="background:#1c0f07;border-radius:0 0 14px 14px;padding:32px 32px 28px;">

          <!-- Social -->
          <p style="font-size:10px;font-weight:700;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.1em;margin:0 0 12px;font-family:-apple-system,sans-serif;">Connect with us</p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
            <tr>
              <td style="padding-right:8px;">
                <a href="${LINKEDIN_URL}" style="display:inline-block;background:rgba(255,255,255,0.1);border-radius:6px;padding:9px 14px;text-decoration:none;">
                  <span style="font-size:12px;font-weight:600;color:#ffffff;font-family:-apple-system,sans-serif;">in LinkedIn</span>
                </a>
              </td>
              <td style="padding-right:8px;">
                <a href="${TWITTER_URL}" style="display:inline-block;background:rgba(255,255,255,0.1);border-radius:6px;padding:9px 14px;text-decoration:none;">
                  <span style="font-size:12px;font-weight:600;color:#ffffff;font-family:-apple-system,sans-serif;">X</span>
                </a>
              </td>
              <td>
                <a href="${INSTAGRAM_URL}" style="display:inline-block;background:rgba(255,255,255,0.1);border-radius:6px;padding:9px 14px;text-decoration:none;">
                  <span style="font-size:12px;font-weight:600;color:#ffffff;font-family:-apple-system,sans-serif;">Instagram</span>
                </a>
              </td>
            </tr>
          </table>

          <!-- Divider -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
            <tr><td style="border-top:1px solid rgba(255,255,255,0.08);"></td></tr>
          </table>

          <!-- Deliverability -->
          <p style="font-size:12px;color:rgba(255,255,255,0.45);margin:0 0 14px;line-height:1.7;font-family:-apple-system,sans-serif;">
            To ensure delivery to your inbox, please add <a href="mailto:impactnews@impactnatives.com" style="color:#e07a3a;text-decoration:none;">impactnews@impactnatives.com</a> to your address book.
          </p>

          <!-- Legal -->
          <p style="font-size:12px;color:rgba(255,255,255,0.3);margin:0;line-height:1.8;font-family:-apple-system,sans-serif;">
            This email was sent to <span style="color:rgba(255,255,255,0.5);">${content.email}</span>.  You received this because you subscribed to Native Signal from Impact Natives.
            <br>
            <a href="${content.unsubscribeUrl}" style="color:rgba(255,255,255,0.4);text-decoration:underline;">Unsubscribe</a> &middot;
            <a href="${SETTINGS_URL}" style="color:rgba(255,255,255,0.4);text-decoration:underline;">Manage preferences</a>
            <br>Impact Natives &middot; Lagos, Nigeria
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

    const [newOrgsRes, newInitiativesRes, newPartnershipsRes, spotlightRes] = await Promise.all([
      supabaseFetch(`organizations?select=id&created_at=gte.${oneMonthAgo}&verification_status=eq.verified`),
      supabaseFetch(`initiative_requests?select=id&status=eq.published&published_at=gte.${oneMonthAgo}`),
      supabaseFetch(`partnership_connections?select=id&status=eq.formed&updated_at=gte.${oneMonthAgo}`),
      supabaseFetch(`initiative_requests?select=id,title,submitter_org,sectors,specific_ask&status=eq.published&order=published_at.desc&limit=1`),
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

    const searchItems = await webSearch(
      "Africa impact investing ESG Nigeria funding ecosystem news " + now.getFullYear()
    );

    const searchSnippets = searchItems
      .map(r => `- ${r.title}: ${r.description} [URL: ${r.url}]`)
      .join("\n");

    const contentPrompt = `You are the editorial voice of Impact Natives, a B2B coordination platform connecting NGOs, funders, corporates, and social enterprises across Africa. Write content for issue #${issue} of The Native, the Impact Natives monthly newsletter, covering ${month}.

Platform data this month:
- New verified organisations joined: ${platformStats.orgs}
- New initiatives published: ${platformStats.initiatives}
- Partnerships confirmed: ${platformStats.partnerships}

Recent ecosystem news from web search (use 2-3 most relevant items, rewrite commentary in your own words, do not reproduce verbatim, keep the URL exactly as provided):
${searchSnippets || "No search results available. Write from general knowledge of African impact investing, ESG, and development finance trends."}

Return ONLY valid JSON, no markdown, no preamble:
{
  "opening": "2-3 sentence opening. Grounded, editorial, direct. Reference the month and at least one platform stat or ecosystem development. Written for experienced African impact practitioners who have no patience for vague language.",
  "ecosystemNews": [
    { "headline": "Short specific headline", "commentary": "2-3 sentences of informed, opinionated commentary written as a knowledgeable insider.", "url": "exact URL from search results or empty string if none" },
    { "headline": "Short specific headline", "commentary": "2-3 sentences.", "url": "exact URL or empty string" },
    { "headline": "Short specific headline", "commentary": "2-3 sentences.", "url": "exact URL or empty string" }
  ],
  "regulatoryWatch": "1-2 sentences on Nigerian or African regulatory context relevant to ESG or impact investing. Reference specific instruments where possible. Return null if nothing genuinely relevant."
}

Rules: No em dashes. No exclamation marks. No filler. Write like a practitioner who reads BusinessDay, ThisDay, and FT Africa.`;

    const raw = await groq(contentPrompt, 1400);
    let aiContent: any = {};
    try {
      const clean = raw.replace(/```json|```/g, "").trim();
      aiContent = JSON.parse(clean);
    } catch {
      aiContent = {
        opening: `${month} brought continued movement across Africa's impact sector. Here is what happened on Impact Natives and across the ecosystem this month.`,
        ecosystemNews: [],
        regulatoryWatch: null,
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
          headline:  n.headline  ?? "",
          commentary: n.commentary ?? "",
          url:       n.url       ?? "",
        })),
        spotlight,
        regulatoryWatch: aiContent.regulatoryWatch ?? null,
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
          subject: `The Native: ${month}`,
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