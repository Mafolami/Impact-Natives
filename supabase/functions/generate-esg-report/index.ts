import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// NOTE: this prompt/parsing logic is duplicated in generate-dd-export
// (generateEsgReportInline), which inlines its own copy rather than
// calling this function over HTTP -- see that file's header comment for
// why (a self-referential edge-function-to-edge-function fetch() call
// was silently failing). Supabase edge functions can't share code across
// functions via import, so if the ESG prompt, E/S/G mapping rules, or
// JSON schema ever change, both copies need the same change by hand.
// Checked both copies directly against Supabase on 2026-08-18 -- as of
// that check, the prompts are identical except for track_record?.
// vs track_record. optional chaining, which is correct in both places
// (this function receives track_record from the client and it can be
// undefined; the inlined copy constructs it itself and it's always
// defined).

function normalizeSmartQuotes(text: string): string {
  return text
    .replace(/[\u201C\u201D]/g, "\"")
    .replace(/[\u2018\u2019]/g, "'");
}

function repairMissingOpeningQuote(text: string): string {
  return text.replace(
    /("[\w_]+"\s*:\s*)([A-Za-z][^"{}\[\]]*?)(",|"\s*\})/g,
    '$1"$2$3'
  );
}

function repairMissingComma(text: string): string {
  return text.replace(/"(\s+)"([\w_]+)"(\s*):/g, '",$1"$2"$3:');
}

function parseReportJson(rawText: string): Record<string, any> {
  let clean = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
  clean = normalizeSmartQuotes(clean);
  clean = repairMissingOpeningQuote(clean);
  clean = repairMissingComma(clean);

  const jsonMatch = clean.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      // fall through to salvage below
    }
  }

  const opening = clean.indexOf("{");
  if (opening === -1) throw new Error("No JSON object found in response");
  const body = clean.slice(opening);
  const lastCompleteField = body.lastIndexOf('",');
  if (lastCompleteField === -1) throw new Error("No complete fields in response");
  const salvaged = body.slice(0, lastCompleteField + 1) + "}";
  return JSON.parse(salvaged);
}

// v6: org.sector and org.country weren't run through any cleanup before
// hitting the prompt. sector is a jsonb array column (e.g. ["Water,
// Sanitation & Hygiene", ...]) that supabase-js deserializes into a real
// JS array -- interpolating it directly via `${org.sector}` calls
// Array.prototype.toString(), which comma-joins WITHOUT a space after
// each comma ("Water, Sanitation & Hygiene,Climate" instead of "...,
// Climate"), unlike the .match() crash this caused in generate-dd-export
// (this function never calls .match() on it, so it never threw -- it
// just produced slightly malformed prompt text). country is a text
// column storing a Postgres array-literal string like "{Nigeria}",
// which would render into the prompt literally as "{Nigeria}" rather
// than "Nigeria". Same cleanTextField fix already applied in
// generate-dd-export, ported here so both copies handle these two field
// shapes the same way.
function cleanTextField(v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  if (Array.isArray(v)) return v.filter(Boolean).map((s) => String(s).trim()).join(", ");
  if (typeof v !== "string") return String(v);
  const m = v.match(/^\{(.*)\}$/);
  return m ? m[1].split(",").map((s) => s.trim()).filter(Boolean).join(", ") : v;
}

interface DdItem {
  key: string;
  label: string;
  value: boolean;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });

  // Tier gate: viewing your OWN org's ESG Snapshot requires Plus+.
  // Evaluating ANOTHER org's ESG Snapshot requires Pro+. Resolves the
  // caller's own org via their session (auth.getUser() ->
  // resolve_org_owner_id() -> organizations lookup), matching the pattern
  // in generate-deal-memo / generate-csr-brief. Self vs other is
  // determined by comparing the org_id in the request body against the
  // caller's own resolved org id -- not trusted from the client alone,
  // since org_id is just used to pick which tier list applies, and a
  // mismatch only ever makes the gate stricter (falls through to the
  // Pro+ "evaluating another org" requirement), never looser.
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
    .from("organizations").select("id, subscription_tier").eq("user_id", ownerId ?? user.id).maybeSingle();

  try {
    const { org, org_id, dd_readiness, delivery, track_record } = await req.json();

    if (!org) return new Response(
      JSON.stringify({ error: "org is required" }),
      { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );

    const isSelfView = Boolean(org_id) && Boolean(callerOrg?.id) && org_id === callerOrg.id;
    const requiredTiers = isSelfView ? ["plus", "pro", "compliance"] : ["pro", "compliance"];
    if (!callerOrg || !requiredTiers.includes(callerOrg.subscription_tier)) {
      return new Response(JSON.stringify({
        error: isSelfView
          ? "Viewing your own ESG Snapshot requires a Plus plan or higher."
          : "Evaluating another organisation's ESG Snapshot requires a Pro plan or higher.",
        requires_upgrade: true,
        required_tier: isSelfView ? "plus" : "pro",
      }), {
        status: 403, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    // dd_readiness.items is the org's own checklist (implementer's 9-item
    // set, or funder/corporate's 6-item set) -- which one depends on
    // dd_readiness.is_implementer. Scoring and the prompt below are both
    // generic over whichever list was sent, so a funder org's real
    // completion shows up here instead of always reading as 0%.
    const ddItems: DdItem[] = Array.isArray(dd_readiness?.items) ? dd_readiness.items : [];
    const isImplementer = Boolean(dd_readiness?.is_implementer);
    const ddScore = ddItems.length > 0
      ? Math.round((ddItems.filter((i) => i.value).length / ddItems.length) * 100)
      : 0;
    const checklistLine = ddItems
      .map((i) => `- ${i.label}: ${i.value ? "Yes" : "No"}`)
      .join("\n");

    const deliveryResolved = delivery?.resolved ?? 0;
    const deliveryHasData = deliveryResolved >= 1;
    const deliveryRate = deliveryHasData ? Math.round((delivery.completed / delivery.resolved) * 100) : null;

    const orgSector = cleanTextField(org.sector);
    const orgCountry = cleanTextField(org.country);

    const prompt = `You are an experienced ESG and governance analyst producing a snapshot document for a corporate or funder organisation evaluating ${org.organisation_name ?? "this organisation"} as a potential partner. This is NOT an independent audit — it is a structured summary of what the organisation has disclosed on this platform, clearly separating what is self-attested, what is self-entered historical data, and what is genuinely platform-tracked (not self-reported).

ORGANISATION: ${org.organisation_name ?? "Not specified"}
Type: ${org.organisation_type ?? "Not specified"}
Sector: ${orgSector || "Not specified"}
Country: ${orgCountry || "Not specified"}
Years of operation: ${track_record?.years_of_operation ?? "Not specified"}

DD READINESS CHECKLIST (self-attested by the organisation, NOT verified by the platform) — this is ${isImplementer ? "the implementer" : "the funder/corporate"} checklist, ${ddScore}% complete (${ddItems.filter((i) => i.value).length}/${ddItems.length} items):
${checklistLine}
  ${dd_readiness?.has_blacklisting != null ? `  - Disclosed blacklisting by a government/regulatory agency: ${dd_readiness.has_blacklisting ? "YES — flagged" : "No"}` : ""}
  ${dd_readiness?.has_pending_disputes != null ? `  - Disclosed pending legal disputes/investigations: ${dd_readiness.has_pending_disputes ? "YES — flagged" : "No"}` : ""}
  ${dd_readiness?.has_conflicts != null ? `  - Disclosed related-party conflicts: ${dd_readiness.has_conflicts ? "YES — flagged" : "No"}` : ""}
- Overall DD readiness score: ${ddScore}% — this exact number must be used verbatim anywhere referenced. Do not paraphrase into a different range.

DELIVERY (platform-tracked outcomes of actual relationships formed on this platform — NOT self-reported):
${deliveryHasData
  ? `- ${delivery.completed} of ${delivery.resolved} tracked relationships completed (${deliveryRate}% completion rate). ${delivery.stalled > 0 ? `${delivery.stalled} stalled. ` : ""}${delivery.fell_through > 0 ? `${delivery.fell_through} fell through. ` : ""}${(delivery.total - delivery.resolved) > 0 ? `${delivery.total - delivery.resolved} still in progress.` : ""}`
  : `- No completed relationship outcomes tracked on the platform yet${(delivery?.total ?? 0) > 0 ? ` (${delivery.total} active relationship(s) in progress, none resolved)` : ""}. There is not yet enough platform history to state a delivery rate — say this plainly rather than treating zero data as a negative signal or omitting it.`}

TRACK RECORD (numbers and history entered by the organisation itself — NOT verified by the platform):
- Total beneficiaries reached: ${track_record?.total_beneficiaries_reached ?? "Not provided"}
- Jobs created: ${track_record?.jobs_created ?? "Not provided"}
- Female beneficiaries: ${track_record?.female_beneficiaries_pct != null ? track_record.female_beneficiaries_pct + "%" : "Not provided"}
- Youth beneficiaries: ${track_record?.youth_beneficiaries_pct != null ? track_record.youth_beneficiaries_pct + "%" : "Not provided"}
- Grants received: ${track_record?.grants_received_count ?? "Not provided"}
- Total grant value: ${track_record?.grants_total_value_usd != null ? "USD " + Number(track_record.grants_total_value_usd).toLocaleString() : "Not provided"}
- Grants delivered on time: ${track_record?.grants_delivered_on_time_pct != null ? track_record.grants_delivered_on_time_pct + "%" : "Not provided"}
- Previous funders: ${track_record?.previous_funders?.join(", ") || "Not provided"}
- Third-party evaluations conducted: ${track_record?.third_party_evaluations ? "Yes" : "No / not disclosed"}

E/S/G MAPPING — use exactly this mapping, do not invent a different one:
- Environmental: ${isImplementer ? "based ONLY on the single \"Environmental policy\" checklist item above. This is genuinely thin data — say so plainly. Do not manufacture an environmental narrative, footprint estimate, or performance claim beyond \"a written policy is/isn't in place.\" If no policy is in place, say plainly that no environmental data is currently available rather than speculating." : "the checklist above has no dedicated environmental item for this org type. Say plainly that no environmental data is currently available for this organisation rather than speculating or borrowing from another section."}
- Social: ${isImplementer ? "safeguarding policy, beneficiary reach and demographics (female/youth %), jobs created, and the Delivery pillar (real tracked relationship outcomes) all feed this section." : "beneficiary reach and demographics (female/youth %) if provided, and the Delivery pillar (real tracked relationship outcomes) feed this section. If little or no beneficiary data is provided, say so plainly rather than padding."}
- Governance: ${isImplementer ? "financial model, audited accounts, governance documentation, legal registration, legal & compliance declaration (including any disclosed blacklisting/disputes/conflicts — these are real red flags if present and MUST be named explicitly, not softened), and third-party evaluations." : "the checklist items above (disbursement track record, decision-making transparency, conflict of interest disclosure, governance documentation, ESG framework, legal registration), including any disclosed conflicts — these are real red flags if present and MUST be named explicitly, not softened."}

STRUCTURAL HONESTY — apply before writing anything:
- Never blur the three data sources together. A sentence describing DD Readiness items must not imply platform verification. A sentence describing Delivery must not imply self-reporting. A sentence describing Track Record numbers must not imply independent audit.
- Do NOT compute or state any single overall "ESG score" — none is given to you, and none should be invented. If asked implicitly by the structure to summarise, do so in prose describing relative strength/weakness across the three pillars, never as a number.
- If a disclosed blacklisting, pending dispute, or related-party conflict is present, this MUST be named explicitly and prominently in the governance section — do not omit it, soften it into vague language, or bury it after positive framing.
- If Environmental has thin or no data, do not pad the section to sound equivalent in depth to Social or Governance — a short, honest paragraph is correct here, not a forced match in length.
- Do not invent numbers, dates, or statistics not present in the data given above, in either direction.

LANGUAGE — avoid filler and hype: do not use innovative, cutting-edge, world-class, state-of-the-art, robust, dynamic, empowering, leverage, synergy, holistic, foster, stakeholders, "meaningful difference," "positive difference," "responsible business," "proven," "evidence-based," "best practice" (without a citation), "eliminate," "eradicate," "solve," "unprecedented," or ownerless passive phrasing like "it is hoped that."

Return ONLY a valid JSON object. No markdown, no backticks, no explanation text before or after the JSON. Use only straight double quotes (") for every field — never curly or typographic quotes, never omit the opening quote of a string value, and always place a comma between every field except the last one.

{"headline":"<One sentence orienting the reader to what this snapshot shows and its overall data maturity — not a score>","environmental":"<2-3 sentences, honest about thin data if applicable>","social":"<3-4 sentences weaving safeguarding/beneficiary reach and real Delivery outcomes together>","governance":"<3-4 sentences on the org's documentation and any disclosed compliance flags, named explicitly if present>","data_gaps":["<specific gap 1>","<specific gap 2>","<specific gap 3>"],"summary":"<2-3 sentences giving the reader a fair overall read of documentation maturity across the three pillars, without inventing a score>"}

Write like an analyst handing this directly to the evaluating funder/corporate — plain, specific, no summary judgement sentences tacked onto each section, no hype.`;

    function sleep(ms: number): Promise<void> {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }

    const MAX_RATE_LIMIT_RETRIES = 1;
    let groqRes: Response | null = null;
    for (let rateLimitAttempt = 0; rateLimitAttempt <= MAX_RATE_LIMIT_RETRIES; rateLimitAttempt++) {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "openai/gpt-oss-120b",
          max_completion_tokens: 2500,
          temperature: 0.4,
          top_p: 1,
          reasoning_effort: "low",
          stream: false,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (res.status === 429 && rateLimitAttempt < MAX_RATE_LIMIT_RETRIES) {
        const errBody = await res.text();
        const retryAfterHeader = res.headers.get("retry-after");
        const bodyMatch = errBody.match(/try again in ([\d.]+)s/i);
        const waitSeconds = retryAfterHeader
          ? parseFloat(retryAfterHeader)
          : bodyMatch
          ? parseFloat(bodyMatch[1])
          : 5;
        const waitMs = Math.min(Math.ceil(waitSeconds * 1000) + 500, 25000);
        console.warn("[generate-esg-report] Groq 429 rate limit hit, retrying", { rateLimitAttempt, waitMs, body: errBody });
        await sleep(waitMs);
        continue;
      }

      groqRes = res;
      break;
    }

    if (!groqRes) {
      return new Response(JSON.stringify({ error: "Groq API request failed after rate limit retry" }), {
        status: 502, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    if (!groqRes.ok) {
      const err = await groqRes.text();
      console.error(
        `[generate-esg-report] Groq API error - status: ${groqRes.status} ${groqRes.statusText}, ` +
        `remaining-tokens: ${groqRes.headers.get("x-ratelimit-remaining-tokens")}, ` +
        `remaining-requests: ${groqRes.headers.get("x-ratelimit-remaining-requests")}, body: ${err}`
      );
      return new Response(JSON.stringify({ error: `Groq API error: ${err}` }), {
        status: 502, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const groqData = await groqRes.json();
    const rawText = groqData.choices?.[0]?.message?.content ?? "";

    let report: Record<string, any>;
    try {
      report = parseReportJson(rawText);
    } catch {
      return new Response(JSON.stringify({ error: "Could not parse response.", raw: rawText }), {
        status: 422, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    report.dd_readiness_score = ddScore;
    report.delivery_rate = deliveryRate;
    report.delivery_has_data = deliveryHasData;

    return new Response(JSON.stringify({ data: report }), {
      status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
});