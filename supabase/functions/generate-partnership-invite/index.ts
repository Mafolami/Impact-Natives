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
      sender_org_name, sender_contact_name, sender_description, sender_offers, sender_needs,
      partnership_title, partnership_sought, partnership_stage, partnership_duration,
      partnership_budget, partnership_decision_timeline, partnership_working_style,
      partnership_financial_transfer, partnership_team_capacity,
      receiver_org_name, receiver_description, receiver_needs, receiver_offers, receiver_partnership_sought,
      match_rationale, key_synergy, fit_score,
    } = await req.json();

    if (!sender_org_name || !receiver_org_name) {
      return new Response(JSON.stringify({ error: "sender_org_name and receiver_org_name are required" }), {
        status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const prompt = `You are helping an organisation draft a first-contact message to a potential partner they were AI-matched with on Impact Natives, a social impact partnership platform.

The sender has just filled out a detailed partnership request form. Your job is to open a conversation by summarising THEIR OWN specific ask in plain terms, then connecting it to something concrete about the receiver — not by inventing generic overlap language.

Rules:
- 3-5 sentences max. No corporate boilerplate, no "I hope this finds you well."
- Open by stating what the sender is actually looking for, using the partnership_sought, stage, budget, and timeline fields below — in the sender's own words, paraphrased naturally, not as a list.
- Then connect that to ONE concrete, specific thing about the receiver (their description, offers, needs, or their own stated partnership_sought if given) — not a vague "our respective focuses align" sentence.
- If the sectors or focus areas are genuinely different (e.g. one does agriculture, the other does mental health), do NOT pretend they're similar — instead be honest that the fit is more about shared geography, complementary capacity, or scale, and say so plainly.
- End with a specific, low-pressure question tied to the ask (e.g. asking about their capacity, timeline, or interest), not a generic "would you be open to a conversation?"
- Do not use the words: leverage, synergy, stakeholders, holistic, impactful, foster.
- Write in first person, as if ${sender_contact_name || sender_org_name} from ${sender_org_name} is writing it.
- Sign off with just the first name if a contact name is given, otherwise the org name.

Return ONLY the message text. No JSON, no markdown, no quotes around it, no preamble.

Sender organisation: ${sender_org_name}
Sender contact name: ${sender_contact_name || "Not provided"}
Sender description: ${sender_description || "Not provided"}
Sender offers: ${Array.isArray(sender_offers) ? sender_offers.join(", ") : "Not provided"}
Sender needs: ${Array.isArray(sender_needs) ? sender_needs.join(", ") : "Not provided"}

This specific partnership request:
Title: ${partnership_title || "Not provided"}
What they're looking for: ${partnership_sought || "Not provided"}
Stage of work: ${partnership_stage || "Not provided"}
Expected duration: ${partnership_duration || "Not provided"}
Budget: ${partnership_budget || "Not provided"}
Decision timeline: ${partnership_decision_timeline || "Not provided"}
Working style preference: ${partnership_working_style || "Not provided"}
Financial arrangement expected: ${partnership_financial_transfer || "Not provided"}
Team capacity available: ${partnership_team_capacity || "Not provided"}

Receiver organisation: ${receiver_org_name}
Receiver description: ${receiver_description || "Not provided"}
Receiver needs: ${Array.isArray(receiver_needs) ? receiver_needs.join(", ") : "Not provided"}
Receiver offers: ${Array.isArray(receiver_offers) ? receiver_offers.join(", ") : "Not provided"}
Receiver's own stated partnership ask (if any): ${receiver_partnership_sought || "Not provided"}

AI match rationale (for your context only, do not quote this directly): ${match_rationale || "Not provided"}
Key synergy tag (for your context only): ${key_synergy || "Not provided"}`;

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