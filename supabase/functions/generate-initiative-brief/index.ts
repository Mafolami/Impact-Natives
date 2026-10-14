// supabase/functions/generate-initiative-brief/index.ts
// v16 (14 Oct 2026): legacy JWT keys disabled after a leak. Caller client
// uses the new publishable key. No logic change.
// v14: verify_jwt on + Plus+ tier gate.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function __envKeys(name: string): Record<string, string> {
  try { return JSON.parse(Deno.env.get(name) ?? "{}"); } catch { return {}; }
}
const PUBLISHABLE_KEY = __envKeys("SUPABASE_PUBLISHABLE_KEYS")["default"] ?? Object.values(__envKeys("SUPABASE_PUBLISHABLE_KEYS"))[0] ?? "";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = PUBLISHABLE_KEY;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function checkPlusAccess(req: Request): Promise<{ ok: true } | { ok: false; status: number; body: Record<string, unknown> }> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userError } = await callerClient.auth.getUser();
  if (userError || !user) {
    return { ok: false, status: 401, body: { error: "Unauthorized" } };
  }
  const { data: ownerId } = await callerClient.rpc("resolve_org_owner_id");
  if (!ownerId) {
    return { ok: false, status: 500, body: { error: "Could not resolve organisation identity" } };
  }
  const { data: org } = await callerClient.from("organizations").select("subscription_tier").eq("user_id", ownerId).maybeSingle();
  if (org?.subscription_tier === "free") {
    return {
      ok: false, status: 403,
      body: { error: "AI brief extraction requires a Plus plan or higher.", requires_upgrade: true, required_tier: "plus" },
    };
  }
  return { ok: true };
}

const LEXICON_WATCHLIST = [
  "empower", "empowering", "empowered", "empowers",
  "innovative", "innovation-driven", "cutting-edge", "world-class",
  "state-of-the-art", "robust", "dynamic", "leverage", "synergy", "holistic",
  "foster", "stakeholders", "meaningful difference", "positive difference",
  "responsible business", "multi-faceted", "first-ever", "evidence-based",
  "best practice", "eliminate", "eradicate", "revolutionize", "disrupt",
  "unprecedented", "it is hoped that", "efforts will be made to",
];

const SOLUTION_CUE_PATTERN = /^(we (need|will|aim|plan|want)|to (equip|provide|empower|deliver|train|support|help)|our (goal|aim|plan) is)/i;

function normalizeSmartQuotes(text: string): string {
  return text.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
}

function repairMissingOpeningQuote(text: string): string {
  return text.replace(/"([a-zA-Z_]+)":\s*([^"\[\{,\s][^",\}\]]*)"/g, '"$1": "$2"');
}

function repairMissingComma(text: string): string {
  return text.replace(/"(\s+)"([a-zA-Z_]+)":/g, '",$1"$2":');
}

function salvageTruncated(text: string): string | null {
  if (text.includes("}")) return null;
  const lastGoodField = text.lastIndexOf('",');
  if (lastGoodField === -1) return null;
  return text.slice(0, lastGoodField + 1) + "}";
}

function tryParse(rawText: string): Record<string, any> | null {
  const stripped = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();

  try { return JSON.parse(stripped); } catch {}

  let repaired = normalizeSmartQuotes(stripped);
  try { return JSON.parse(repaired); } catch {}

  repaired = repairMissingComma(repairMissingOpeningQuote(repaired));
  try { return JSON.parse(repaired); } catch {}

  const salvaged = salvageTruncated(repaired);
  if (salvaged) {
    try { return JSON.parse(salvaged); } catch {}
  }

  return null;
}

function scanLexicon(text: string): string[] {
  const lower = text.toLowerCase();
  return LEXICON_WATCHLIST.filter(term => lower.includes(term));
}

function validateContent(extracted: Record<string, any>): string[] {
  const problems: string[] = [];

  const combinedText = [extracted.title, extracted.problem, extracted.outcome, extracted.specific_ask]
    .filter(Boolean).join(" ");
  const lexiconHits = scanLexicon(combinedText);
  if (lexiconHits.length > 0) {
    problems.push(`banned words used: ${lexiconHits.join(", ")} — rephrase without them, in title/problem/outcome/specific_ask`);
  }

  if (typeof extracted.problem === "string" && SOLUTION_CUE_PATTERN.test(extracted.problem.trim())) {
    problems.push(`"problem" field describes a solution/action ("${extracted.problem}") instead of the gap or issue that exists — rewrite it to state what is wrong or missing, not what will be done about it`);
  }

  return problems;
}

function buildPrompt(plain_description: string): string {
  return `You are helping a social impact practitioner in Africa structure their initiative brief for a partnership marketplace. Extract and structure the plain language description below into the JSON fields.

Return ONLY a valid JSON object. No markdown, no backticks, no explanation. If a field cannot be confidently inferred, return null — except target_beneficiaries, target_jobs, target_female_pct, and target_timeline_months, which should be inferred (see their field descriptions below) rather than left null.

CRITICAL — problem vs. outcome framing, this is the most common mistake to avoid:
- "problem" must describe the GAP or ISSUE that currently exists — what is wrong, missing, or failing right now. It is NOT a description of what the initiative will do about it. Never phrase it as "We need to...", "We will...", "To provide/equip/empower/train...", or any other call-to-action structure. State the deficit itself (e.g. "Young people in X lack access to Y, resulting in Z" — not "We need to give young people access to Y").
- "outcome" must be SMART: Specific, Measurable (a real number or percentage), Achievable, Relevant, Time-bound. Never use a vague, unmeasurable verb as the outcome's main action (e.g. "empower," "support," "help," "foster") — state the concrete, countable result instead (e.g. not "Empower 50 founders" but "50 founders complete training and launch a climate tech venture within 6 months").

LANGUAGE — absolute ban, no exceptions, even if the founder's own text uses these words. Rephrase the underlying meaning without them, anywhere in the output: empower / empowering / empowered / empowers, innovative, cutting-edge, world-class, state-of-the-art, robust, dynamic, leverage, synergy, holistic, foster, stakeholders, "meaningful difference," "positive difference," "responsible business," "multi-faceted," "first-ever," "evidence-based," "best practice" (uncited), "eliminate," "eradicate," "revolutionize," "disrupt," "unprecedented," "it is hoped that," "efforts will be made to."

{
  "title": "A clear, specific initiative title. Max 10 words. No buzzwords.",
  "problem": "The gap or issue that exists, not the solution. Max 30 words. See framing rule above.",
  "outcome": "SMART outcome — specific, measurable, time-bound. Max 30 words. See framing rule above.",
  "target_population": "Who the initiative directly serves. Max 20 words. Null if not mentioned.",
  "sectors": ["1-3 sectors from EXACTLY: Health, Education, Agriculture & Food Systems, Climate & Environment, Energy & Clean Tech, Water, Sanitation & Hygiene, Financial Inclusion, Gender & Inclusion, Governance & Civic Tech, Livelihoods & Economic Empowerment, Technology & Innovation, Arts, Culture & Creative Industries, Humanitarian & Emergency Response, Youth & Community Development. Copy the exact spelling and punctuation given, including commas."],
  "locations": ["All locations mentioned — countries, regions, cities e.g. Nigeria, Kano State, West Africa, Pan-Africa. Extract every place name mentioned."],
  "partnerships": ["1-3 values from: funding, technical, operational, leadership, strategic, lead"],
  "sdg_tags": ["1-3 SDG names from: No Poverty, Zero Hunger, Good Health and Well-being, Quality Education, Gender Equality, Clean Water and Sanitation, Affordable and Clean Energy, Decent Work and Economic Growth, Industry Innovation and Infrastructure, Reduced Inequalities, Sustainable Cities and Communities, Responsible Consumption and Production, Climate Action, Life Below Water, Life on Land, Peace Justice and Strong Institutions, Partnerships for the Goals"],
  "specific_ask": "What specifically does the initiative need from a partner? 1-2 sentences. Be concrete.",
  "tags": ["2-4 short keyword tags"],
  "budget_min": "Minimum budget as a plain number with no currency symbol or commas. Example: 50000. Null if not mentioned.",
  "budget_max": "Maximum budget as a plain number with no currency symbol or commas. Example: 150000. Null if not mentioned.",
  "stage": "One of exactly: concept, planning, active, scaling. Infer from context. Null if unclear.",
  "duration": "One of exactly: Under 6 months, 6-12 months, 1-2 years, 2-5 years, Ongoing. Infer from any timeline mentioned. Null if unclear.",
  "target_beneficiaries": "A plain integer, no commas. Must be consistent with whatever number appears in your own 'outcome' field above — if the outcome states 50 founders, this must be 50, not a different invented number. Infer a plausible SMART figure if the founder gave no number at all.",
  "target_jobs": "A plain integer, no commas, only if job creation is relevant to this initiative. Null if not relevant.",
  "target_female_pct": "A plain integer 0-100. Infer a reasonable inclusion target for this sector and geography if not given.",
  "target_timeline_months": "A plain integer. Must match the duration given or inferred above (e.g. if duration is '6-12 months', use a value in that range, consistent with the 'outcome' field's own timeframe if it states one)."
}

Plain language description:
${plain_description}`;
}

async function callGroq(prompt: string, repairNote?: string): Promise<string> {
  const messages = repairNote
    ? [
        { role: "user", content: prompt },
        {
          role: "user",
          content: `Your previous response had these problems: ${repairNote}. Regenerate the FULL JSON object from scratch, fixing these issues. Follow the problem-vs-outcome framing rule and the absolute language ban exactly.`,
        },
      ]
    : [{ role: "user", content: prompt }];

  const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "openai/gpt-oss-120b",
      max_completion_tokens: 2000,
      temperature: 0.3,
      top_p: 1,
      reasoning_effort: "medium",
      stream: false,
      messages,
    }),
  });

  if (!groqRes.ok) {
    const errBody = await groqRes.text();
    console.error("Groq API error", {
      status: groqRes.status,
      remainingTokens: groqRes.headers.get("x-ratelimit-remaining-tokens"),
      remainingRequests: groqRes.headers.get("x-ratelimit-remaining-requests"),
      body: errBody,
    });
    throw new Error(`Groq API error: ${errBody}`);
  }

  const data = await groqRes.json();
  return data.choices?.[0]?.message?.content ?? "";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });

  const access = await checkPlusAccess(req);
  if (!access.ok) {
    return new Response(JSON.stringify(access.body), {
      status: access.status, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  try {
    const { plain_description } = await req.json();
    if (!plain_description?.trim()) return new Response(
      JSON.stringify({ error: "plain_description is required" }),
      { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );

    const prompt = buildPrompt(plain_description);
    let extracted: Record<string, any> | null = null;
    let lastProblems: string[] = [];
    const MAX_ATTEMPTS = 2;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      let rawText: string;
      try {
        rawText = await callGroq(prompt, attempt === 0 ? undefined : lastProblems.join("; "));
      } catch (err) {
        console.error("Groq call failed", { attempt, err: String(err) });
        return new Response(JSON.stringify({ error: "Groq API request failed" }), {
          status: 502, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        });
      }

      if (!rawText.trim()) {
        lastProblems = ["empty response from model"];
        console.warn("Groq returned empty content", { attempt });
        continue;
      }

      const parsed = tryParse(rawText);
      if (!parsed) {
        lastProblems = ["could not parse JSON after all repair attempts"];
        console.warn("Parse failed", { attempt, raw: rawText.slice(0, 300) });
        continue;
      }

      const problems = validateContent(parsed);
      if (problems.length > 0) {
        lastProblems = problems;
        console.warn("Content validation failed", { attempt, problems });
        continue;
      }

      extracted = parsed;
      break;
    }

    if (!extracted) {
      console.error("All attempts failed", { lastProblems });
      return new Response(JSON.stringify({ error: "Could not produce a valid brief.", details: lastProblems }), {
        status: 422, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    return new Response(JSON.stringify({ data: extracted }), {
      status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  } catch (err) {
    console.error("Unhandled error in generate-initiative-brief", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
});
