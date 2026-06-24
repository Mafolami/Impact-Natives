const GROQ_API_KEY         = Deno.env.get("GROQ_API_KEY") ?? "";
const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
  const prompt = `Write a brief, warm notification message for a social impact platform user in Africa.

User name: ${userName}
Their sectors of interest: ${sectors.join(", ")}
Number of new matching initiatives this week: ${matchCount}
Sample initiative titles: ${sampleTitles.slice(0, 3).join("; ")}

Write 1-2 sentences maximum. Mention their sector(s) naturally. Sound human and direct, not like a marketing email. No em dashes. No exclamation marks. No "exciting" or "amazing".

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  try {
    // Get all active users who have sectors and feed_visibility != 'none'
    const profiles = await supabaseFetch(
      "profiles?select=id,full_name,sectors&neq=feed_visibility,none&not.is.sectors,null&eq=onboarding_completed,true",
    );

    if (!Array.isArray(profiles) || profiles.length === 0) {
      return new Response(JSON.stringify({ message: "No eligible users" }), {
        status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    // Get initiatives published in the last 7 days
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const recentInitiatives = await supabaseFetch(
      `initiative_requests?select=id,title,sectors&eq=status,published&gte=created_at,${oneWeekAgo}`,
    );

    if (!Array.isArray(recentInitiatives) || recentInitiatives.length === 0) {
      return new Response(JSON.stringify({ message: "No new initiatives this week" }), {
        status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    let notificationsSent = 0;

    for (const profile of profiles) {
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

      notificationsSent++;
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
