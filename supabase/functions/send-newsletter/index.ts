const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY       = Deno.env.get("RESEND_API_KEY") ?? "";
const GROQ_API_KEY         = Deno.env.get("GROQ_API_KEY") ?? "";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

async function groq(prompt: string, maxTokens = 1200): Promise<string> {
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

async function webSearch(query: string): Promise<string> {
  const BRAVE_KEY = Deno.env.get("BRAVE_SEARCH_API_KEY") ?? "";
  if (!BRAVE_KEY) return "";
  try {
    const res = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5&freshness=pm`,
      { headers: { "Accept": "application/json", "X-Subscription-Token": BRAVE_KEY } }
    );
    const data = await res.json();
    const results = (data.web?.results ?? []).slice(0, 4);
    return results.map((r: any) => `- ${r.title}: ${r.description}`).join("\n");
  } catch {
    return "";
  }
}

function monthName(date: Date): string {
  return date.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function buildEmailHtml(content: {
  opening: string;
  platformStats: { orgs: number; initiatives: number; partnerships: number };
  ecosystemNews: { headline: string; commentary: string }[];
  spotlight: { title: string; org: string; sector: string; ask: string } | null;
  regulatoryWatch: string | null;
  month: string;
}, unsubscribeUrl: string): string {
  const newsBlock = content.ecosystemNews.map(n => `
    <tr>
      <td style="padding: 0 0 16px 0;">
        <p style="font-size: 14px; font-weight: 700; color: #111827; margin: 0 0 4px;">${n.headline}</p>
        <p style="font-size: 13px; color: #555; line-height: 1.6; margin: 0;">${n.commentary}</p>
      </td>
    </tr>
  `).join("");

  const spotlightBlock = content.spotlight ? `
    <tr>
      <td style="padding: 32px 0 0 0;">
        <p style="font-size: 10px; font-weight: 700; color: #2D6A4F; text-transform: uppercase; letter-spacing: 0.08em; margin: 0 0 10px;">Opportunity spotlight</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden;">
          <tr>
            <td style="padding: 20px 24px; border-left: 4px solid #C45C26;">
              <p style="font-size: 15px; font-weight: 700; color: #111827; margin: 0 0 4px;">${content.spotlight.title}</p>
              <p style="font-size: 12px; color: #6B7280; margin: 0 0 10px;">${content.spotlight.org} &middot; ${content.spotlight.sector}</p>
              <p style="font-size: 13px; color: #374151; line-height: 1.6; margin: 0 0 14px;">${content.spotlight.ask}</p>
              <a href="https://app.impactnatives.com/dashboard/marketplace" style="font-size: 13px; font-weight: 600; color: #2D6A4F; text-decoration: none;">View initiative &rarr;</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  ` : "";

  const regulatoryBlock = content.regulatoryWatch ? `
    <tr>
      <td style="padding: 28px 0 0 0;">
        <p style="font-size: 10px; font-weight: 700; color: #6B7280; text-transform: uppercase; letter-spacing: 0.08em; margin: 0 0 8px;">Regulatory watch</p>
        <p style="font-size: 13px; color: #374151; line-height: 1.6; margin: 0; padding: 14px 16px; background: #f9fafb; border-radius: 8px; border-left: 3px solid #E5E7EB;">${content.regulatoryWatch}</p>
      </td>
    </tr>
  ` : "";

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f4f4f4; font-family: -apple-system, sans-serif;">
      <tr>
        <td align="center" style="padding: 32px 24px 0 24px;">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
            <tr>
              <td align="center" style="background-color: #06120c; padding: 40px 32px; border-radius: 12px;">
                <img src="https://lzpxlnjvegpxjuexyjdj.supabase.co/storage/v1/object/public/org-logos/6426b462-95ad-4c2c-abda-924d5cc0758c/logo.png" alt="Impact Natives" style="height: 28px; margin: 0 0 10px;" />
                <p style="font-size: 11px; font-weight: 500; color: #ffffff; opacity: 0.55; letter-spacing: 0.06em; text-transform: uppercase; margin: 0 0 16px;">The Dispatch</p>
                <h1 style="font-size: 22px; font-weight: 800; color: #ffffff; margin: 0 0 6px; letter-spacing: -0.02em; line-height: 1.2;">${content.month}</h1>
                <p style="font-size: 14px; color: #ffffff; opacity: 0.75; margin: 0;">What moved in Africa's impact economy this month.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding: 0 24px 32px 24px;">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="margin: 0 auto; background: #ffffff; border-radius: 0 0 12px 12px;">
            <tr>
              <td style="padding: 32px 32px 0 32px;">
                <p style="font-size: 15px; color: #374151; line-height: 1.75; margin: 0 0 28px;">${content.opening}</p>

                <p style="font-size: 10px; font-weight: 700; color: #2D6A4F; text-transform: uppercase; letter-spacing: 0.08em; margin: 0 0 14px;">This month on Impact Natives</p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 28px;">
                  <tr>
                    <td width="33%" style="text-align: center; padding: 14px; background: #f9fafb; border-radius: 8px;">
                      <p style="font-size: 26px; font-weight: 800; color: #2D6A4F; margin: 0 0 2px;">${content.platformStats.orgs}</p>
                      <p style="font-size: 11px; color: #6B7280; margin: 0;">new organisations</p>
                    </td>
                    <td width="4%" />
                    <td width="33%" style="text-align: center; padding: 14px; background: #f9fafb; border-radius: 8px;">
                      <p style="font-size: 26px; font-weight: 800; color: #2D6A4F; margin: 0 0 2px;">${content.platformStats.initiatives}</p>
                      <p style="font-size: 11px; color: #6B7280; margin: 0;">initiatives published</p>
                    </td>
                    <td width="4%" />
                    <td width="33%" style="text-align: center; padding: 14px; background: #f9fafb; border-radius: 8px;">
                      <p style="font-size: 26px; font-weight: 800; color: #2D6A4F; margin: 0 0 2px;">${content.platformStats.partnerships}</p>
                      <p style="font-size: 11px; color: #6B7280; margin: 0;">partnerships confirmed</p>
                    </td>
                  </tr>
                </table>

                <p style="font-size: 10px; font-weight: 700; color: #6B7280; text-transform: uppercase; letter-spacing: 0.08em; margin: 0 0 14px;">From the ecosystem</p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  ${newsBlock}
                </table>

                ${spotlightBlock}
                ${regulatoryBlock}

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 32px 0 0 0;">
                  <tr>
                    <td>
                      <a href="https://app.impactnatives.com" style="display: block; text-align: center; background: #2D6A4F; color: #ffffff; font-size: 14px; font-weight: 600; padding: 14px 28px; border-radius: 8px; text-decoration: none; margin: 0 0 12px;">Explore the platform</a>
                      <a href="https://app.impactnatives.com/dashboard/marketplace" style="display: block; text-align: center; background: transparent; color: #2D6A4F; font-size: 14px; font-weight: 600; padding: 13px 28px; border-radius: 8px; text-decoration: none; border: 1px solid #2D6A4F; margin: 0 0 40px;">Browse open initiatives</a>
                    </td>
                  </tr>
                </table>

                <p style="font-size: 12px; color: #999; margin: 0 0 10px; padding-top: 24px; border-top: 1px solid #e5e5e5;">
                  Questions? <a href="https://app.impactnatives.com/contact" style="color: #2D6A4F;">Contact us</a>
                </p>
                <p style="font-size: 11px; color: #bbb; margin: 0 0 32px;">
                  Impact Natives &middot; Lagos, Nigeria &middot;
                  <a href="${unsubscribeUrl}" style="color: #bbb;">Unsubscribe</a>
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

  try {
    const now         = new Date();
    const month       = monthName(now);
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

    const searchResults = await webSearch(
      "Africa impact investing ESG Nigeria funding news " + now.getFullYear()
    );

    const contentPrompt = `You are the editorial voice of Impact Natives, a B2B coordination platform connecting NGOs, funders, corporates, and social enterprises across Africa. Write content for the ${month} edition of The Dispatch, a monthly newsletter.

Platform data this month:
- New verified organisations joined: ${platformStats.orgs}
- New initiatives published: ${platformStats.initiatives}
- Partnerships confirmed: ${platformStats.partnerships}

Recent ecosystem news snippets (use 2-3 that are most relevant, rewrite in your own words, do not reproduce verbatim):
${searchResults || "No external search results available this month. Write from general knowledge of the African impact investing and ESG ecosystem."}

Write the following sections. Return ONLY valid JSON, no markdown, no preamble:
{
  "opening": "2-3 sentence opening paragraph. Grounded, editorial, direct. Reference the month and at least one real thing from the platform stats. Written for African impact practitioners and investors, not a generic Western audience.",
  "ecosystemNews": [
    { "headline": "short headline", "commentary": "2-3 sentences of informed commentary, written as a knowledgeable observer, not a press release" },
    { "headline": "short headline", "commentary": "2-3 sentences" }
  ],
  "regulatoryWatch": "1-2 sentence update on Nigeria or Africa regulatory context relevant to ESG, impact investing, or sustainability reporting. Only include if genuinely relevant. Return null if nothing specific."
}

Rules: No em dashes. No exclamation marks. No filler phrases. No excited language. Write like a well-informed African impact practitioner, not a marketer.`;

    const raw = await groq(contentPrompt, 1200);
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
      `newsletter_subscribers?select=email,unsubscribe_token&active=eq.true`
    );

    if (!Array.isArray(subscribers) || subscribers.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: "No active subscribers" }), {
        status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    let sent = 0;
    for (const sub of subscribers) {
      const unsubscribeUrl = `https://lzpxlnjvegpxjuexyjdj.supabase.co/functions/v1/unsubscribe-newsletter?token=${sub.unsubscribe_token}`;
      const html = buildEmailHtml({
        opening:         aiContent.opening         ?? "",
        platformStats,
        ecosystemNews:   aiContent.ecosystemNews   ?? [],
        spotlight,
        regulatoryWatch: aiContent.regulatoryWatch ?? null,
        month,
      }, unsubscribeUrl);

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "Impact Natives <notifications@impactnatives.com>",
          to: sub.email,
          subject: `The Dispatch: ${month}`,
          html,
        }),
      });

      if (res.ok) sent++;
      else {
        const err = await res.text();
        console.log(`Failed to send to ${sub.email}:`, err);
      }
    }

    return new Response(JSON.stringify({ sent, total: subscribers.length, month }), {
      status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
});