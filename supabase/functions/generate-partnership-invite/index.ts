// supabase/functions/generate-partnership-invite/index.ts
// Generates a personalized partnership outreach message for the AI-match "Reach Out" flow
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY")!;
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });

  try {
    const {
      sender_org_name, sender_contact_name, sender_description, sender_offers,
      receiver_org_name, receiver_needs, receiver_offers,
      match_rationale, key_synergy, fit_score,
    } = await req.json();

    if (!sender_org_name || !receiver_org_name) {
      return new Response(JSON.stringify({ error: "sender_org_name and receiver_org_name are required" }), {
        status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const prompt = `You are helping an organisation draft a short, warm, specific first message to a potential partner they were AI-matched with on Impact Natives, a social impact partnership platform.

Write a first-contact outreach message. Rules:
- 3-5 sentences max. No corporate boilerplate, no "I hope this finds you well."
- Reference the SPECIFIC synergy between the two organisations, not generic partnership language.
- Mention one concrete detail about what each side offers or needs, drawn from the data given.
- End with a genuine, low-pressure question inviting a conversation.
- Do not use the words: leverage, synergy (as a word, even though it's the concept), stakeholders, holistic, impactful.
- Write in first person, as if ${sender_contact_name || sender_org_name} from ${sender_org_name} is writing it.
- Sign off with just the first name if a contact name is given, otherwise the org name.

Return ONLY the message text. No JSON, no markdown, no quotes around it, no preamble.

Sender organisation: ${sender_org_name}
Sender description: ${sender_description || "Not provided"}
Sender offers: ${Array.isArray(sender_offers) ? sender_offers.join(", ") : "Not provided"}

Receiver organisation: ${receiver_org_name}
Receiver needs: ${Array.isArray(receiver_needs) ? receiver_needs.join(", ") : "Not provided"}
Receiver offers: ${Array.isArray(receiver_offers) ? receiver_offers.join(", ") : "Not provided"}

Match rationale: ${match_rationale || "Not provided"}
Key synergy: ${key_synergy || "Not provided"}
Fit score: ${fit_score ?? "Not provided"}`;

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        max_tokens: 400,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!groqRes.ok) {
      const err = await groqRes.text();
      return new Response(JSON.stringify({ error: `Groq API error: ${err}` }), {
        status: 502, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const groqData = await groqRes.json();
    const message = groqData.choices?.[0]?.message?.content?.trim() ?? "";

    if (!message) {
      return new Response(JSON.stringify({ error: "Empty response from model" }), {
        status: 422, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    return new Response(JSON.stringify({ message }), {
      status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
});