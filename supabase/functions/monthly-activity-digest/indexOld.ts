const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";

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

function parseSectors(raw: any): string[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string" && raw.startsWith("[")) {
    try { return JSON.parse(raw); } catch { return []; }
  }
  if (typeof raw === "string" && raw.startsWith("{")) {
    return raw.slice(1, -1).split(",").map((s) => s.trim().replace(/^["']|["']$/g, ""));
  }
  return raw ? [raw] : [];
}

function buildDigestEmailHtml(opts: {
  headline: { name: string; sub: string };
  activityLines: string[];
  missedMatches: { title: string; reason: string; ask: string | null }[];
  partnershipFits: { title: string; reason: string; ask: string | null }[];
  ctaLink: string;
  primarySector: string;
}): string {
  const { activityLines, missedMatches, partnershipFits, ctaLink } = opts;  const activitySection = activityLines.length > 0
    ? `
      <p style="font-size: 13px; font-weight: 600; color: #888; text-transform: uppercase; letter-spacing: 0.04em; margin: 0 0 10px;">This month</p>
      ${activityLines.map((l) => `<p style="font-size: 15px; color: #222; margin: 0 0 6px;">${l}</p>`).join("")}
    `
    : `
      <p style="font-size: 13px; font-weight: 600; color: #888; text-transform: uppercase; letter-spacing: 0.04em; margin: 0 0 10px;">This month</p>
      <p style="font-size: 15px; color: #888; margin: 0;">No activity on your side.</p>
    `;

  const matchesSection = missedMatches.length > 0
    ? `
      <p style="font-size: 13px; font-weight: 600; color: #888; text-transform: uppercase; letter-spacing: 0.04em; margin: 32px 0 14px;">
        Matches you haven't responded to
      </p>
      ${missedMatches.map((m) => `
        <div style="padding: 14px 0; border-bottom: 1px solid #eee;">
          <p style="font-size: 15px; font-weight: 600; color: #0a0a0a; margin: 0 0 4px;">${m.title}</p>
          <p style="font-size: 13px; color: #666; margin: 0 0 4px;">Matched on: ${m.reason}</p>
          ${m.ask ? `<p style="font-size: 13px; color: #2D6A4F; margin: 0;">Looking for: ${m.ask}</p>` : ""}
        </div>
      `).join("")}
    `
    : "";

  const fitsSection = partnershipFits.length > 0
    ? `
      <p style="font-size: 13px; font-weight: 600; color: #888; text-transform: uppercase; letter-spacing: 0.04em; margin: 32px 0 14px;">
        Partnership requests that fit your sectors
      </p>
      ${partnershipFits.map((m) => `
        <div style="padding: 14px 0; border-bottom: 1px solid #eee;">
          <p style="font-size: 15px; font-weight: 600; color: #0a0a0a; margin: 0 0 4px;">${m.title}</p>
          <p style="font-size: 13px; color: #666; margin: 0 0 4px;">Matched on: ${m.reason}</p>
          ${m.ask ? `<p style="font-size: 13px; color: #2D6A4F; margin: 0;">Looking for: ${m.ask}</p>` : ""}
        </div>
      `).join("")}
    `
    : "";

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #ffffff; font-family: -apple-system, sans-serif;">
      <tr>
        <td align="center" style="padding: 32px 24px 0 24px; background-color: #f4f4f4;">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
            <tr>
              <td align="center" bgcolor="#06120c" style="background-color: #06120c; padding: 40px 32px; border-radius: 12px;">
                <img src="https://lzpxlnjvegpxjuexyjdj.supabase.co/storage/v1/object/public/org-logos/6426b462-95ad-4c2c-abda-924d5cc0758c/logo.png" alt="Impact Natives" style="height: 30px; margin: 0 0 8px;" />
                <p style="font-size: 12px; font-weight: 500; color: #ffffff; opacity: 0.65; letter-spacing: 0.02em; margin: 0 0 20px;">Move faster on impact.</p>
                <h1 style="font-size: 24px; font-weight: 800; color: #ffffff; margin: 0 0 6px; letter-spacing: -0.02em; line-height: 1.2;">${opts.headline.name}</h1>
                <p style="font-size: 15px; font-weight: 400; color: #ffffff; opacity: 0.85; margin: 0;">${opts.headline.sub}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding: 0 24px 32px 24px; background-color: #f4f4f4;">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="margin: 0 auto; background: #ffffff; border-radius: 0 0 12px 12px;">
            <tr>
              <td style="padding: 32px;">
                ${activitySection}
                ${matchesSection}
                ${fitsSection}
                <a href="${ctaLink}" style="display: block; text-align: center; background: #2D6A4F; color: #ffffff; font-size: 14px; font-weight: 600; line-height: 20px; padding: 14px 28px; border-radius: 8px; text-decoration: none; margin: 28px 0 12px;">Open Dashboard</a>
                <a href="https://app.impactnatives.com/dashboard/marketplace" style="display: block; text-align: center; background: transparent; color: #2D6A4F; font-size: 14px; font-weight: 600; line-height: 20px; padding: 13px 28px; border-radius: 8px; text-decoration: none; border: 1px solid #2D6A4F; margin: 0 0 40px;">Browse All Opportunities</a>
                <p style="font-size: 13px; color: #333; margin: 0 0 20px; padding-top: 24px; border-top: 1px solid #e5e5e5;">
                  Know someone or an organization making impact in the ${opts.primarySector} sector? Forward this along — they might find something here too.
                </p>
                <p style="font-size: 12px; color: #999; margin: 0 0 12px;">
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
    body: JSON.stringify({ from: "Impact Natives <notifications@impactnatives.com>", to, subject, html }),  });
  if (!res.ok) console.log("Resend error:", await res.text());
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

   const profiles = await supabaseFetch(
      `profiles?select=id,full_name,email,sectors&sectors=not.is.null`
    );
    if (!Array.isArray(profiles) || profiles.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: "No eligible users" }), {
        status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const allInitiatives = await supabaseFetch(
      `initiative_requests?select=id,title,user_id,sectors,status,created_at,confirmed_partners,specific_ask,partnerships&status=eq.published&created_at=gte.${thirtyDaysAgo}`
    );
    const initiatives = Array.isArray(allInitiatives) ? allInitiatives : [];

    const allEois = await supabaseFetch(
      `expressions_of_interest?select=id,initiative_id,user_id,created_at&created_at=gte.${thirtyDaysAgo}`
    );
    const eois = Array.isArray(allEois) ? allEois : [];

    const partnershipOrgs = await supabaseFetch(
      `organizations?select=id,organisation_name,partnership_title,partnership_sought,sector,user_id&partnership_listed=eq.true&partnership_formed=eq.false`
    );
    const orgs = Array.isArray(partnershipOrgs) ? partnershipOrgs : [];

    let sent = 0;

    for (const profile of profiles) {
      const userSectors: string[] = profile.sectors ?? [];
      if (userSectors.length === 0) continue;

      const ownInitiatives = initiatives.filter((i: any) => i.user_id === profile.id);
      const sentEois = eois.filter((e: any) => e.user_id === profile.id);
      const ownInitiativeIds = new Set(ownInitiatives.map((i: any) => i.id));
      const receivedEois = eois.filter((e: any) => ownInitiativeIds.has(e.initiative_id));

      let confirmedCount = 0;
      const confirmedNames: string[] = [];
      initiatives.forEach((ini: any) => {
        const partners = ini.confirmed_partners ?? [];
        if (ini.user_id === profile.id) {
          confirmedCount += partners.length;
          partners.forEach((p: any) => confirmedNames.push(p.name));
        } else if (partners.some((p: any) => p.user_id === profile.id)) {
          confirmedCount += 1;
        }
      });

      const actedOnIds = new Set(sentEois.map((e: any) => e.initiative_id));
      const missed = initiatives.filter((ini: any) => {
        if (ini.user_id === profile.id) return false;
        if (actedOnIds.has(ini.id)) return false;
        const iniSectors = parseSectors(ini.sectors);
        return iniSectors.some((s) => userSectors.includes(s));
      });

      const missedWithScore = missed.map((ini: any) => {
        const iniSectors = parseSectors(ini.sectors);
        const overlap = iniSectors.filter((s) => userSectors.includes(s)).length;
        return { ...ini, overlap };
      }).sort((a: any, b: any) => b.overlap - a.overlap);

      const topMatch = missedWithScore[0] ?? null;

      const hasActivity = ownInitiatives.length > 0 || sentEois.length > 0 || receivedEois.length > 0 || confirmedCount > 0;
      const hasMissed = missed.length > 0;

      if (!hasActivity && !hasMissed) continue;

      const firstName = profile.full_name?.split(" ")[0] ?? "there";
      const parts: string[] = [];
      if (ownInitiatives.length > 0) parts.push(`published ${ownInitiatives.length} initiative${ownInitiatives.length !== 1 ? "s" : ""}`);
      if (sentEois.length > 0) parts.push(`sent ${sentEois.length} expression${sentEois.length !== 1 ? "s" : ""} of interest`);
      if (receivedEois.length > 0) parts.push(`received ${receivedEois.length} expression${receivedEois.length !== 1 ? "s" : ""} of interest`);
      if (confirmedCount > 0) {
        const withNames = confirmedNames.length > 0
          ? `confirmed ${confirmedCount} partnership${confirmedCount !== 1 ? "s" : ""} (with ${confirmedNames.slice(0, 2).join(", ")}${confirmedNames.length > 2 ? ` and ${confirmedNames.length - 2} more` : ""})`
          : `confirmed ${confirmedCount} partnership${confirmedCount !== 1 ? "s" : ""}`;
        parts.push(withNames);
      }

      let body = parts.length > 0
        ? `In the last 30 days you ${parts.join(", ")}.`
        : `No activity on your side this month.`;

      if (hasMissed) {
        const titles = missedWithScore.slice(0, 3).map((m: any) => `"${m.title}"`);
        const titleList = titles.length === 1
          ? titles[0]
          : titles.length === 2
          ? `${titles[0]} and ${titles[1]}`
          : `${titles.slice(0, -1).join(", ")}, and ${titles[titles.length - 1]}`;

        body += ` ${missed.length} initiative${missed.length !== 1 ? "s" : ""} matching your sectors went by without a response from you: ${titleList}`;
        if (missed.length > 3) body += `, plus ${missed.length - 3} more`;
        body += `. These are still open, ${firstName}. Check them out.`;
      }

      const link = topMatch ? `/dashboard/marketplace?initiative=${topMatch.id}` : "/dashboard/marketplace";

      await supabaseFetch("notifications", {
        method: "POST",
        body: JSON.stringify({
          user_id: profile.id,
          type: "monthly_activity_digest",
          title: `Your activity summary — ${firstName}`,
          body,
          link,
          read: false,
        }),
      });

      const activityLines: string[] = [];
      if (ownInitiatives.length > 0) activityLines.push(`Published ${ownInitiatives.length} initiative${ownInitiatives.length !== 1 ? "s" : ""}`);
      if (sentEois.length > 0) activityLines.push(`Sent ${sentEois.length} expression${sentEois.length !== 1 ? "s" : ""} of interest`);
      if (receivedEois.length > 0) activityLines.push(`Received ${receivedEois.length} expression${receivedEois.length !== 1 ? "s" : ""} of interest`);
      if (confirmedCount > 0) {
        const names = confirmedNames.length > 0 ? ` (${confirmedNames.slice(0, 2).join(", ")}${confirmedNames.length > 2 ? ` +${confirmedNames.length - 2}` : ""})` : "";
        activityLines.push(`Confirmed ${confirmedCount} partnership${confirmedCount !== 1 ? "s" : ""}${names}`);
      }

      const PARTNERSHIP_LABELS: Record<string, string> = {
        funding: "Funding", technical: "Technical", operational: "Operational",
        leadership: "Leadership", strategic: "Strategic", lead: "Project Lead",
      };

      const missedMatches = missedWithScore.slice(0, 3).map((m: any) => {
        const iniSectors = parseSectors(m.sectors);
        const sharedSectors = iniSectors.filter((s: string) => userSectors.includes(s));
        const partnershipLabels = Array.isArray(m.partnerships)
          ? m.partnerships.map((p: string) => PARTNERSHIP_LABELS[p] ?? p).join(", ")
          : "";
        return {
          title: m.title,
          reason: sharedSectors.join(", ") || iniSectors.join(", "),
          ask: partnershipLabels || m.specific_ask || null,
        };
      });

      const partnershipFits = orgs
        .filter((org: any) => org.user_id !== profile.id)
        .map((org: any) => {
          const orgSectors = parseSectors(org.sector);
          const shared = orgSectors.filter((s: string) => userSectors.includes(s));
          return { org, shared };
        })
        .filter((x: any) => x.shared.length > 0)
        .slice(0, 3)
        .map((x: any) => ({
          title: x.org.partnership_title,
          reason: x.shared.join(", "),
          ask: x.org.partnership_sought,
        }));

        const emailSubject = `Your Month on Impact Natives`;
        const headline = { name: firstName, sub: "here's the scoop on your month" };

      const emailHtml = buildDigestEmailHtml({
        headline,
        activityLines,
        missedMatches,
        partnershipFits,
        ctaLink: `https://app.impactnatives.com${link}`,
        primarySector: userSectors[0] ?? "your sector",
      });
      await sendEmail(profile.email, emailSubject, emailHtml);
      sent++;
    }

    return new Response(JSON.stringify({ sent }), {
      status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
});