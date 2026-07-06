const GROQ_API_KEY         = Deno.env.get("GROQ_API_KEY") ?? "";
const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY       = Deno.env.get("RESEND_API_KEY") ?? "";

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

async function generatePersonalisedCopy(
  userName: string,
  sectors: string[],
  matchCount: number,
  sampleTitles: string[],
): Promise<string> {
  const prompt = `Write a short, direct notification message for a social impact platform user in Africa.

User name: ${userName}
Their sectors of interest: ${sectors.join(", ")}
Number of new matching initiatives this week: ${matchCount}

Write exactly 1 sentence, maximum 20 words. State the number of matches and their sector plainly. No filler phrases like "let's take a look together" or "that could use your attention". No em dashes. No exclamation marks. No "exciting" or "amazing".

Return ONLY the message text.`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      max_tokens: 100,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() ?? `${matchCount} new initiative${matchCount !== 1 ? "s" : ""} in your sectors this week.`;
}

function buildEmailHtml(headline: { name: string; sub: string }, bodyText: string, matchTitles: string[], ctaLabel: string, ctaLink: string): string {  const bulletBlock = matchTitles.length > 0
    ? `
      <div style="margin: 0 0 28px;">
        ${matchTitles.map((t) => `
          <p style="font-size: 14px; color: #333; margin: 0 0 8px; padding-left: 16px; border-left: 2px solid #2D6A4F;">
            ${t}
          </p>
        `).join("")}
      </div>
    `
    : "";

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f4f4f4; font-family: -apple-system, sans-serif;">      <tr>
        <td align="center" style="padding: 32px 24px 0 24px; background-color: #f4f4f4;">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
            <tr>
              <td align="center" bgcolor="#06120c" style="background-color: #06120c; padding: 40px 32px; border-radius: 12px;">
                <img src="https://lzpxlnjvegpxjuexyjdj.supabase.co/storage/v1/object/public/org-logos/6426b462-95ad-4c2c-abda-924d5cc0758c/logo.png" alt="Impact Natives" style="height: 30px; margin: 0 0 8px;" />
                <p style="font-size: 12px; font-weight: 500; color: #ffffff; opacity: 0.65; letter-spacing: 0.02em; margin: 0 0 20px;">Move faster on impact.</p>
                <h1 style="font-size: 24px; font-weight: 800; color: #ffffff; margin: 0 0 6px; letter-spacing: -0.02em; line-height: 1.2;">${headline.name}</h1>
                <p style="font-size: 15px; font-weight: 400; color: #ffffff; opacity: 0.85; margin: 0;">${headline.sub}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding: 0 24px 32px 24px; background-color: #f4f4f4;">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="margin: 0 auto; background: #ffffff; border-radius: 0 0 12px 12px; padding: 32px;">
            <tr>
              <td style="padding: 32px;">
          <p style="font-size: 15px; color: #333; line-height: 1.7; margin: 0 0 20px;">${bodyText}</p>
          ${bulletBlock}
          <a href="${ctaLink}" style="display: block; text-align: center; background: #2D6A4F; color: #ffffff; font-size: 14px; font-weight: 600; line-height: 20px; padding: 14px 28px; border-radius: 8px; text-decoration: none; margin: 0 0 12px;">${ctaLabel}</a>
          <a href="https://app.impactnatives.com/dashboard/marketplace" style="display: block; text-align: center; background: transparent; color: #2D6A4F; font-size: 14px; font-weight: 600; line-height: 20px; padding: 13px 28px; border-radius: 8px; text-decoration: none; border: 1px solid #2D6A4F; margin: 0 0 40px;">Browse All Opportunities</a>
          <p style="font-size: 12px; color: #999; margin: 0 0 12px; padding-top: 24px; border-top: 1px solid #e5e5e5;">
            Questions? Visit the <a href="https://app.impactnatives.com/faq" style="color: #2D6A4F;">Help Centre</a> or <a href="https://app.impactnatives.com/contact" style="color: #2D6A4F;">contact us</a>.
          </p>
          <p style="font-size: 11px; color: #bbb; margin: 0;">Impact Natives · This message was sent to you as part of your Impact Natives membership.</p>
        </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY || !to) return;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "Impact Natives <notifications@impactnatives.com>",
      to,
      subject,
      html,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.log("Resend error:", err);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  try {
    // Get all active users who have sectors and feed_visibility != 'none'
    const profiles = await supabaseFetch(
      "profiles?select=id,full_name,email,sectors&feed_visibility=neq.none&onboarding_completed=eq.true&sectors=not.is.null",    );
    console.log("profiles result:", JSON.stringify(profiles).slice(0, 300));
    if (!Array.isArray(profiles) || profiles.length === 0) {
      console.log("Exiting early — no eligible users");
      return new Response(JSON.stringify({ message: "No eligible users" }), {
        status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    // Get initiatives published in the last 7 days
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const recentInitiatives = await supabaseFetch(
      `initiative_requests?select=id,title,sectors&status=eq.published&created_at=gte.${oneWeekAgo}`,    );

    const hasRecentInitiatives = Array.isArray(recentInitiatives) && recentInitiatives.length > 0;


    let notificationsSent = 0;

    for (const profile of hasRecentInitiatives ? profiles : []) {
      const userSectors: string[] = profile.sectors ?? [];
      if (userSectors.length === 0) continue;

      // Find initiatives matching user's sectors
      const matches = recentInitiatives.filter((ini: any) =>
        (ini.sectors ?? []).some((s: string) => userSectors.includes(s))
      );

      if (matches.length === 0) continue;

      const firstName = profile.full_name?.split(" ")[0] ?? "there";
      const sampleTitles = matches.slice(0, 3).map((m: any) => m.title);

      // Generate AI-personalised copy
      const body = await generatePersonalisedCopy(firstName, userSectors, matches.length, sampleTitles);

      // Insert notification
      await supabaseFetch("notifications", {
        method: "POST",
        body: JSON.stringify({
          user_id: profile.id,
          type:    "weekly_sector_match",
          title:   `${matches.length} new initiative${matches.length !== 1 ? "s" : ""} in your sectors`,
          body,
          link:    "/dashboard/marketplace",
          read:    false,
        }),
      });

      const weeklyMatchCount = matches.length;
      const headline = { name: firstName, sub: "something new landed in your sectors" };      
      const emailHtml = buildEmailHtml(
        headline,
        body,
        sampleTitles,
        "View matches",
        "https://app.impactnatives.com/dashboard/marketplace"
      );
      const emailSubject = `Opportunity Alert — ${weeklyMatchCount} Recommended Match${weeklyMatchCount !== 1 ? "es" : ""}`;
      await sendEmail(profile.email, emailSubject, emailHtml);
      notificationsSent++;
    }

    // ── New verified org notifications ─────────────────────────────────────
    // Notify corporates and funders when a new verified org joins in their sectors

    const INVESTOR_ORG_TYPES = [
      "corporation", "technology_company", "public_sector",
      "philanthropic_foundation", "venture_capital",
    ];

    console.log("Reached new verified org block");
    const newVerifiedOrgs = await supabaseFetch(
      `organizations?select=id,organisation_name,sector,user_id,verification_status&verification_status=eq.verified&updated_at=gte.${oneWeekAgo}`    );

    if (Array.isArray(newVerifiedOrgs) && newVerifiedOrgs.length > 0) {
      // Get all corporate/funder profiles with sectors
      const allProfiles = await supabaseFetch(
        `profiles?select=id,full_name,sectors,org_type`
      );
      console.log("allProfiles raw:", JSON.stringify(allProfiles).slice(0, 500));
      const investorProfiles = Array.isArray(allProfiles)
        ? allProfiles.filter((p: any) =>
            INVESTOR_ORG_TYPES.includes(p.org_type) &&
            Array.isArray(p.sectors) && p.sectors.length > 0
          )
        : [];
      console.log("investorProfiles count:", investorProfiles.length);

      if (Array.isArray(investorProfiles)) {
        for (const profile of investorProfiles) {
          const userSectors: string[] = profile.sectors ?? [];
          if (userSectors.length === 0) continue;

          // Normalize and match sectors
          const matchingOrgs = newVerifiedOrgs.filter((org: any) => {
            const raw = org.sector ?? "";
            let orgSectors: string[] = [];
            try {
              if (Array.isArray(raw)) {
                orgSectors = raw;
              } else if (typeof raw === "string" && raw.startsWith("[")) {
                orgSectors = JSON.parse(raw);
              } else if (typeof raw === "string" && raw.startsWith("{")) {
                orgSectors = raw.slice(1, -1).split(",").map((s: string) =>
                  s.trim().replace(/^[\s"']+|[\s"']+$/g, "")
                );
              } else if (raw) {
                orgSectors = [raw];
              }
            } catch {
              orgSectors = [];
            }
            console.log("parsed orgSectors:", JSON.stringify(orgSectors), "vs userSectors:", JSON.stringify(userSectors));
            return orgSectors.some((s: string) => userSectors.includes(s));
          });

          if (matchingOrgs.length === 0) continue;

          const orgNames = matchingOrgs.slice(0, 2).map((o: any) => o.organisation_name).join(", ");
          const extra = matchingOrgs.length > 2 ? ` and ${matchingOrgs.length - 2} more` : "";

          const insertResult = await supabaseFetch("notifications", {
            method: "POST",
            body: JSON.stringify({
              user_id: profile.id,
              type:    "new_verified_org",
              title:   `${matchingOrgs.length} new verified org${matchingOrgs.length !== 1 ? "s" : ""} in your sectors`,
              body:    `${orgNames}${extra} joined and verified this week in sectors you work in.`,
              link:    "/dashboard/natives?tab=organisation",
              read:    false,
            }),
          });
          console.log("insert result:", JSON.stringify(insertResult));

          notificationsSent++;
        }
      }
    }

    return new Response(JSON.stringify({ sent: notificationsSent }), {
      status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
});
