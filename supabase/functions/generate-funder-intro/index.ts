// supabase/functions/generate-funder-intro/index.ts
// Drafts a short intro message from an expresser to an initiative owner.
//
// v28 (14 Oct 2026): legacy JWT keys disabled after a leak. Caller client
// uses the new publishable key. No logic change.
// v26: Plus+ tier gate. v25: max_completion_tokens 1500 + reasoning_effort low.
// v21: drift detector requires no we/I pivot between name and verb.
// v20: mixed I/we register. v16-v19: structure variants, banned phrases.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function __envKeys(name: string): Record<string, string> {
  try { return JSON.parse(Deno.env.get(name) ?? "{}"); } catch { return {}; }
}
const PUBLISHABLE_KEY = __envKeys("SUPABASE_PUBLISHABLE_KEYS")["default"] ?? Object.values(__envKeys("SUPABASE_PUBLISHABLE_KEYS"))[0] ?? "";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = PUBLISHABLE_KEY;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function containsPlaceholder(text: string): boolean {
  return /\[[^\[\]]{1,40}\]/.test(text);
}

const BANNED_PATTERNS: { label: string; pattern: RegExp }[] = [
  { label: "aligns with", pattern: /\balign(?:s|ed|ing)?\s+with\b/i },
  { label: "resonates with", pattern: /\bresonat(?:es|ed|ing)?\s+with\b/i },
  { label: "speaks to our/their", pattern: /\bspeaks?\s+to\s+(?:our|their|its)\b/i },
  { label: "connects with our/their", pattern: /\bconnects?\s+with\s+(?:our|their|its)\b/i },
  { label: "leverage", pattern: /\bleverag(?:e|es|ed|ing)\b/i },
  { label: "synergy", pattern: /\bsynerg(?:y|ies|istic)\b/i },
  { label: "stakeholders", pattern: /\bstakeholders?\b/i },
  { label: "holistic", pattern: /\bholistic\b/i },
  { label: "impactful", pattern: /\bimpactful\b/i },
  { label: "foster", pattern: /\bfoster(?:s|ed|ing)?\b/i },
  { label: "drive (positive) change", pattern: /\bdrive\s+(?:positive\s+)?change\b/i },
  { label: "meaningful difference", pattern: /\bmeaningful\s+difference\b/i },
];
function findBannedPhrase(text: string): string | null {
  for (const { label, pattern } of BANNED_PATTERNS) {
    if (pattern.test(text)) return label;
  }
  return null;
}

function findThirdPersonSenderDrift(text: string, expresserName?: string | null): string | null {
  if (!expresserName) return null;
  const escaped = expresserName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const thirdPersonVerbs = /(is|was|would like|wants|hopes|reaches? out|reaching out|offers?|offering)/i;
  const noPivot = `(?:(?!\\b(?:we|I|our|us)\\b)[^.]){0,50}?`;
  const pattern = new RegExp(`${escaped}${noPivot}\\b${thirdPersonVerbs.source}\\b`, "i");
  return pattern.test(text) ? "third-person sender description" : null;
}

function findSingularOrgOfferDrift(text: string, hasPersonName: boolean, hasOrg: boolean): string | null {
  if (!hasPersonName || !hasOrg) return null;
  const pattern = /\bI(?:'d|'ll| would| will| can| could)?\s+(?:like to\s+|be happy to\s+)?(?:offer|provide|bring|deliver)\b/i;
  return pattern.test(text) ? "singular \"I offer/provide\" used for what should be an organisational (\"we\") offer" : null;
}

const STRUCTURE_VARIANTS = [
  `Sentence 1 must be ONLY the initiative's specific detail (its problem, outcome, or ask), stated as a plain fact with no mention of the sender at all. Sentence 2 introduces the sender and their specific offer. Sentence 3 is the next step.`,
  `Sentence 1 must be a direct question addressed to the recipient about the initiative (e.g. asking about their timeline, current capacity, or a specific need) -- do not mention the sender in this sentence at all. Sentence 2 introduces the sender and their specific offer as a possible answer to that question. Sentence 3 (if needed) is the next step.`,
  `Use exactly four short, separate sentences, each doing ONE job only, in this order: (1) who the sender is, (2) what the sender's organisation concretely does, (3) what specific offer/role they bring, stated as its own sentence with no reference to the initiative yet, (4) the initiative's specific detail plus the next step combined. Do not combine any of these four jobs into the same sentence.`,
  `Sentence 1 must state the sender's specific ask or proposed next step FIRST, before anything else (e.g. "I'd like to explore whether we could provide technical support for X" as the opening line). Only after that, in later sentences, introduce who the sender is and name the initiative's specific detail.`,
  `Sentence 1 introduces the sender by name/org only, nothing else. Sentence 2 must open with the initiative's specific detail as its very first words (not the sender), then state the sender's offer in the same sentence. Sentence 3 is the next step.`,
];
function pickStructure(): string {
  return STRUCTURE_VARIANTS[Math.floor(Math.random() * STRUCTURE_VARIANTS.length)];
}

async function callGroq(prompt: string): Promise<{ ok: boolean; message?: string; errBody?: string }> {
  const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "openai/gpt-oss-120b",
      max_completion_tokens: 1500,
      reasoning_effort: "low",
      temperature: 0.6,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!groqRes.ok) {
    const err = await groqRes.text();
    console.error(
      `[generate-funder-intro] Groq API error - status: ${groqRes.status} ${groqRes.statusText}, ` +
      `remaining-tokens: ${groqRes.headers.get("x-ratelimit-remaining-tokens")}, ` +
      `remaining-requests: ${groqRes.headers.get("x-ratelimit-remaining-requests")}, body: ${err}`
    );
    return { ok: false, errBody: err };
  }
  const groqData = await groqRes.json();
  return { ok: true, message: groqData.choices?.[0]?.message?.content?.trim() ?? "" };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });

  // Plus+ tier gate -- see file header note.
  const authHeader = req.headers.get("Authorization") ?? "";
  const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userError } = await callerClient.auth.getUser();
  if (userError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
  const { data: ownerId } = await callerClient.rpc("resolve_org_owner_id");
  const { data: callerOrg } = await callerClient
    .from("organizations").select("subscription_tier").eq("user_id", ownerId ?? user.id).maybeSingle();
  if (!callerOrg || !["plus", "pro", "compliance"].includes(callerOrg.subscription_tier)) {
    return new Response(JSON.stringify({
      error: "AI-drafted outreach requires a Plus plan or higher.",
      requires_upgrade: true, required_tier: "plus",
    }), {
      status: 403, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  try {
    const {
      expresser_name, expresser_org, expresser_description,
      expresser_sectors, expresser_offers,
      initiative_title, initiative_problem, initiative_outcome,
      initiative_sectors, esg_intent, initiative_owner_name,
      partnership_types,
    } = await req.json();

    if (!initiative_title || (!expresser_name && !expresser_org)) return new Response(
      JSON.stringify({ error: "initiative_title and at least one of expresser_name or expresser_org are required" }),
      { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );

    const hasPersonName = !!expresser_name;
    const hasOrg = !!expresser_org;

    const introInstruction = hasPersonName
      ? `Write as ${expresser_name}${hasOrg ? `, who works with ${expresser_org}` : ""}, in a MIXED register a real person would actually use: use "I" for personal statements (introducing yourself, your role, personally proposing to schedule a call or follow up), but use "we"/"our" for anything describing what ${hasOrg ? expresser_org : "your organisation"} itself does, offers, or provides -- ${hasOrg ? `you personally do not "offer" ${expresser_org}'s services in your own singular voice; ${expresser_org} offers them, and you speak on its behalf when describing them` : "describe organisational capacity in the plural even when introducing yourself by name"}. Example of the correct mix: "I'm Jane from Acme Corp. We provide funding and mentorship, and I'd like to schedule a call." Example of what's WRONG: "I'm Jane from Acme Corp and I'd like to offer funding and mentorship" (offering funding/mentorship is Acme's capacity, not Jane's personal act -- wrong to say "I offer" here). Never describe ${expresser_name} in the third person anywhere (do not write "${expresser_name} is reaching out", "${expresser_name} would like to", "${expresser_name}, who works with ${hasOrg ? expresser_org : "the organisation"}, is offering...").`
      : hasOrg
      ? `No individual contact name was provided. Write in the first person plural as the organisation itself ("We're reaching out from ${expresser_org}", "We work on...", "We'd like to..."). Never invent a person's name, and never use the organisation name as if it were a person's name (do not write anything like "I am ${expresser_org}").`
      : `No name or organisation was provided. Write in a generic first-person-plural voice ("We") without inventing any name.`;

    const hasRecipientName = !!initiative_owner_name;
    const greetingInstruction = hasRecipientName
      ? `Greet using exactly this name: "Hi ${initiative_owner_name},"`
      : `No recipient name was given. Use exactly "Hi there," as the greeting. Never invent, guess, or substitute any organisation or platform name for the greeting -- do not address the message to "Impact Natives" or any other name not explicitly given below.`;

    const hasPartnershipTypes = Array.isArray(partnership_types) && partnership_types.length > 0;
    const partnershipTypeInstruction = hasPartnershipTypes
      ? `The sender has specifically selected the following role(s) they are offering to play for this initiative: ${partnership_types.join(", ")}. This is an organisational capacity${hasPersonName && hasOrg ? " -- describe it in the organisation's plural voice (\"we can offer...\", \"we're able to provide...\"), never as the individual's personal singular offer (\"I offer...\")" : ""}. Make clear what this means in concrete terms (e.g. if "Funding", they are offering money; if "Technical", technical expertise or support; if "Operational", hands-on delivery help; if "Leadership" or "Project Lead", taking a driving role) -- phrase this naturally, never as a bare list of category labels.`
      : `No partnership type was selected. Do not invent or assume one -- keep the offer general.`;

    const structureInstruction = pickStructure();

    function buildPrompt(correctionNote?: string): string {
      return `You are helping ${expresser_name ?? expresser_org ?? "the sender"} personally write a brief, specific first-contact message to another organisation on a social impact platform in Africa. Write the message AS the sender, in their own voice -- not as a third party describing or summarising the sender.
${correctionNote ? `\n${correctionNote}\n` : ""}
STRUCTURE FOR THIS MESSAGE (follow exactly, sentence by sentence -- this is assigned per-message and differs every time it is called):
${structureInstruction}

CRITICAL RULES:
- The message must be written in the first person throughout, as the sender speaking directly to the recipient. Never refer to the sender by name in the third person anywhere (no "X is offering", "X would like to", "X, who works with Y, is reaching out").
- ${hasPersonName && hasOrg ? `Mix singular and plural correctly: "I" for personal statements, "we"/"our" for anything that is really the organisation's capacity or offer (see the detailed instruction below for examples).` : `Use a single consistent voice as instructed below.`}
- Format exactly as: the greeting on its own first line, then a blank line, then the message body. Example shape: "Hi [name],\\n\\n[body]" -- always include the blank line between the greeting and the body.
- Never use placeholder text like [Name], [Organisation], [Your Name], or any bracketed text.
- Use only the actual values provided below. If a value is missing, omit that detail entirely -- never invent one.
- Write 2-4 sentences total for the body (follow whatever sentence count the structure above specifies). No more.
- Plain, direct, professional language. No marketing speak, no mission-statement language, no em dashes.
- Do not use these words or phrases anywhere: leverage, synergy, stakeholders, holistic, impactful, foster, drive positive change, drive change, meaningful difference.
- Do NOT use any "our work/focus/mission [aligns with / resonates with / speaks to / connects with]" construction anywhere, in any tense or form.
- Do NOT use "since", "given that", "given", "as you're", or any other causal-transition word to link the sender's offer to the initiative detail, unless the structure instruction above explicitly calls for a causal link.
- The message must sound like it was written about this specific initiative -- not a template that could be sent to any initiative on the platform unchanged.
- ${greetingInstruction}

Content that must appear somewhere in the message, placed according to the structure instruction above (not in the order listed here):
- ${introInstruction} State concretely what the sender's organisation actually does, using their description or what they offer below -- a specific activity or service, not an aspirational statement.
- ${partnershipTypeInstruction}
- ONE specific, concrete detail from the initiative below (its actual problem, outcome, or specific ask -- not just its sector tags).
- A specific, low-pressure next step tied to the sender's offer and selected partnership role -- not a generic "happy to discuss potential partnership opportunities."${esg_intent ? "\n- Specifically mention interest in ESG/CSR adoption of this initiative." : ""}

Expresser name (individual contact, if any): ${expresser_name ?? "not provided -- see instruction above, do not substitute the organisation name here"}
Expresser organisation: ${expresser_org ?? "not provided"}
Expresser description: ${expresser_description ?? "not provided"}
Expresser sectors: ${expresser_sectors?.join(", ") ?? "not specified"}
What they offer: ${expresser_offers?.join(", ") ?? "not specified"}
Partnership type(s) selected by sender: ${hasPartnershipTypes ? partnership_types.join(", ") : "not specified"}

Initiative title: ${initiative_title}
Initiative owner (recipient): ${initiative_owner_name ?? "not provided -- see greeting instruction above"}
Initiative problem: ${initiative_problem ?? "not provided"}
Initiative outcome: ${initiative_outcome ?? "not provided"}
Initiative sectors: ${initiative_sectors?.join(", ") ?? "not specified"}
Expresser intent: ${esg_intent ? "ESG/CSR adoption" : "General partnership interest"}

Return ONLY the formatted message. No labels, no preamble, no JSON. No placeholder text whatsoever.`;
    }

    let message = "";
    let attempt = await callGroq(buildPrompt());
    if (!attempt.ok) {
      return new Response(JSON.stringify({ error: `Groq API error: ${attempt.errBody}` }), {
        status: 502, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }
    message = attempt.message ?? "";

    let banned = message ? findBannedPhrase(message) : null;
    let thirdPerson = message ? findThirdPersonSenderDrift(message, expresser_name) : null;
    let singularOrgOffer = message ? findSingularOrgOfferDrift(message, hasPersonName, hasOrg) : null;
    if (banned || thirdPerson || singularOrgOffer) {
      const problems = [
        banned && `the banned phrase pattern "${banned}"`,
        thirdPerson && `describing ${expresser_name} in the third person instead of writing as them`,
        singularOrgOffer && singularOrgOffer,
      ].filter(Boolean).join(" and ");
      console.error(`[generate-funder-intro] Issue detected (${problems}), retrying once: ${message}`);
      const retryNote = `IMPORTANT CORRECTION: your previous attempt at this exact message had a problem: ${problems}. Fix this specifically this time.${thirdPerson ? ` Write entirely in the first person as ${expresser_name}, never naming them in a sentence like "X is/would like to/offers...".` : ""}${singularOrgOffer ? ` Use "we"/"our" for anything describing what ${expresser_org} offers or provides, not "I offer"/"I provide" -- that offer belongs to the organisation, not the individual speaking personally.` : ""}${banned ? ` Do not use "${banned}" or any close variant of it.` : ""}`;
      attempt = await callGroq(buildPrompt(retryNote));
      if (attempt.ok && attempt.message) {
        message = attempt.message;
        banned = findBannedPhrase(message);
        thirdPerson = findThirdPersonSenderDrift(message, expresser_name);
        singularOrgOffer = findSingularOrgOfferDrift(message, hasPersonName, hasOrg);
      }
    }

    if (!message) {
      return new Response(JSON.stringify({ error: "Empty response from model." }), {
        status: 422, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    if (containsPlaceholder(message)) {
      console.error(`[generate-funder-intro] Placeholder text detected in generated message: ${message}`);
      return new Response(JSON.stringify({ error: "Generated message contained placeholder text.", raw: message }), {
        status: 422, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    if (banned || thirdPerson || singularOrgOffer) {
      const problems = [banned && `banned phrase "${banned}"`, thirdPerson && "third-person sender drift", singularOrgOffer && singularOrgOffer].filter(Boolean).join(" and ");
      console.error(`[generate-funder-intro] Issue persisted after retry (${problems}): ${message}`);
      return new Response(JSON.stringify({ error: `Generated message still had an issue after retry: ${problems}.`, raw: message }), {
        status: 422, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    return new Response(JSON.stringify({ message }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
});
