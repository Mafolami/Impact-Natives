import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") ?? "";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const READINESS_THRESHOLD_PCT = 70;

const NON_IMPLEMENTER_TYPES = ["philanthropic_foundation", "venture_capital", "corporation", "technology_company", "public_sector"];
function isImplementerOrgType(orgType: string | null | undefined): boolean {
  return !NON_IMPLEMENTER_TYPES.includes(orgType ?? "");
}

const DD_ITEMS: { key: string; label: string }[] = [
  { key: "financial_model", label: "Financial model available" },
  { key: "audited_accounts", label: "Audited accounts available" },
  { key: "governance_doc", label: "Governance documentation" },
  { key: "esg_assessment", label: "ESG assessment completed" },
  { key: "impact_framework", label: "Impact measurement framework" },
  { key: "environmental_policy", label: "Environmental policy" },
  { key: "safeguarding_policy", label: "Safeguarding policy" },
  { key: "legal_registration", label: "Legal registration confirmed" },
  { key: "legal_compliance_declaration", label: "Legal & compliance declaration" },
];
const FUNDER_DD_ITEMS: { key: string; label: string }[] = [
  { key: "disbursement_track_record", label: "Disbursement track record" },
  { key: "decision_transparency", label: "Decision-making transparency" },
  { key: "conflict_disclosure", label: "Conflict of interest disclosure" },
  { key: "governance_doc", label: "Governance documentation" },
  { key: "esg_framework", label: "ESG framework" },
  { key: "legal_registration", label: "Legal registration confirmed" },
];

function computeTrustTier(ddScore: number, ddEvidence: Record<string, any> | null | undefined) {
  const legal = ddEvidence?.legal_compliance_declaration ?? {};
  const conflictDisclosure = ddEvidence?.conflict_disclosure ?? {};
  const hasRedFlag =
    Boolean(legal.hasBlacklisting) ||
    Boolean(legal.hasPendingDisputes) ||
    Boolean(legal.conflictsToDisclose) ||
    Boolean(conflictDisclosure.hasConflicts);
  if (hasRedFlag) return { tier: "flagged", label: "Flagged", hasRedFlag: true };
  if (ddScore >= 90) return { tier: "gold", label: "Gold", hasRedFlag: false };
  if (ddScore >= 60) return { tier: "silver", label: "Silver", hasRedFlag: false };
  if (ddScore >= 30) return { tier: "bronze", label: "Bronze", hasRedFlag: false };
  return { tier: null, label: "Unrated", hasRedFlag: false };
}

function redFlagSentences(ddEvidence: Record<string, any> | null | undefined): string[] {
  const legal = ddEvidence?.legal_compliance_declaration ?? {};
  const conflict = ddEvidence?.conflict_disclosure ?? {};
  const flags: string[] = [];
  if (legal.hasBlacklisting) flags.push("The organisation has disclosed a blacklisting by a government or regulatory agency.");
  if (legal.hasPendingDisputes) flags.push("The organisation has disclosed pending legal disputes or investigations.");
  if (legal.conflictsToDisclose) flags.push("The organisation has disclosed related-party conflicts under its legal & compliance declaration.");
  if (conflict.hasConflicts) flags.push("The organisation has disclosed conflicts of interest under its conflict disclosure item.");
  return flags;
}

function sha256Hex(bytes: Uint8Array): Promise<string> {
  return crypto.subtle.digest("SHA-256", bytes).then((buf) =>
    Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("")
  );
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "Not confirmed";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function wrapLines(str: string, size: number, f: any, maxWidth: number): string[] {
  str = sanitizeForPdf(str);
  const words = str.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  function breakLongWord(word: string): string {
    let chunk = "";
    for (const ch of word) {
      const candidate = chunk + ch;
      if (chunk && f.widthOfTextAtSize(candidate, size) > maxWidth) {
        lines.push(chunk);
        chunk = ch;
      } else {
        chunk = candidate;
      }
    }
    return chunk;
  }
  for (const word of words) {
    if (f.widthOfTextAtSize(word, size) > maxWidth) {
      if (current) { lines.push(current); current = ""; }
      current = breakLongWord(word);
      continue;
    }
    const candidate = current ? `${current} ${word}` : word;
    if (current && f.widthOfTextAtSize(candidate, size) > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// pdf-lib's standard fonts use WinAnsiEncoding, which doesn't cover all
// Unicode punctuation (e.g. U+2011 non-breaking hyphen) that an LLM or a
// user can produce. Normalize known cases, then strip anything still
// outside Latin-1 as a last resort.
function sanitizeForPdf(input: unknown): string {
  let s = String(input ?? "");
  s = s
    .replace(/[\u2010\u2011\u2012\u2015\u2212]/g, "-")
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/\u00AD/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/\uFEFF/g, "");
  s = s.replace(/[^\x00-\xFF]/g, "-");
  return s;
}

function titleCaseOrgType(v: string | null | undefined): string {
  if (!v) return "Not provided";
  return v.split("_").map((w) => (w.toLowerCase() === "ngo" ? "NGO" : w.charAt(0).toUpperCase() + w.slice(1))).join(" ");
}

// Some org fields (e.g. country) are text columns storing a Postgres
// array-literal string like "{Nigeria}"; others (e.g. sector) are jsonb
// columns that supabase-js already deserializes into a real JS array like
// ["Water, Sanitation & Hygiene", ...]. The original version only handled
// the string case -- calling .match() on an actual array threw
// "TypeError: v.match is not a function" and killed ESG generation
// (confirmed live via console.error on a real export against Sahel Youth
// Foundation, whose sector column is a genuine array). Handle both.
function cleanTextField(v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  if (Array.isArray(v)) return v.filter(Boolean).map((s) => String(s).trim()).join(", ");
  if (typeof v !== "string") return String(v);
  const m = v.match(/^\{(.*)\}$/);
  return m ? m[1].split(",").map((s) => s.trim()).filter(Boolean).join(", ") : v;
}

function humanizeKey(key: string): string {
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  const lower = spaced.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

const EVIDENCE_DETAIL_SKIP_KEYS = new Set(["notes"]);

const CONDITIONAL_EVIDENCE_KEYS: Record<string, { governingKey: string; equals: any }> = {
  areasCovered: { governingKey: "hasWrittenPolicy", equals: true },
  totalCommitted: { governingKey: "hasCommitments", equals: true },
  onTimePct: { governingKey: "hasCommitments", equals: true },
  decisionProcess: { governingKey: "hasStatedTimeline", equals: true },
  frameworkName: { governingKey: "usesFramework", equals: true },
};

function evidenceDetailLine(itemKey: string, ddEvidence: Record<string, any> | null | undefined): string | null {
  if (itemKey === "legal_compliance_declaration" || itemKey === "conflict_disclosure") return null;
  const evidence = ddEvidence?.[itemKey];
  if (!evidence || typeof evidence !== "object") return null;
  const parts: string[] = [];
  for (const [k, v] of Object.entries(evidence)) {
    if (EVIDENCE_DETAIL_SKIP_KEYS.has(k)) continue;
    const gate = CONDITIONAL_EVIDENCE_KEYS[k];
    if (gate && evidence[gate.governingKey] !== gate.equals) continue;
    if (v === null || v === undefined || v === "") continue;
    if (typeof v === "boolean") { parts.push(`${humanizeKey(k)}: ${v ? "Yes" : "No"}`); continue; }
    parts.push(`${humanizeKey(k)}: ${String(v)}`);
  }
  return parts.length > 0 ? parts.join("; ") : null;
}

const MOU_STATUS_LABELS: Record<string, string> = {
  fully_executed: "Fully executed",
  pending_org_a_final_review: "Pending final review",
  sent: "Sent, awaiting signature",
  draft: "Draft",
  void: "Void",
};

function computeRiskExposure(readinessScore: number, redFlags: string[]): { label: string; detail: string } {
  if (redFlags.length > 0) {
    return { label: "Elevated", detail: "One or more disclosed compliance flags place this organisation in the Elevated indicator tier regardless of DD Readiness score." };
  }
  if (readinessScore >= 85) {
    return { label: "Low", detail: "No disclosed compliance flags and a high rate of DD Readiness completion." };
  }
  return { label: "Standard", detail: "No disclosed compliance flags; DD Readiness completion is above the export threshold but not yet comprehensive." };
}

// ---------------------------------------------------------------------------
// ESG report generation, inlined from generate-esg-report (v5).
//
// v16 called out to /functions/v1/generate-esg-report over HTTP using
// fetch(). That self-referential edge-function-to-edge-function call never
// reached the target function at all -- confirmed via query_logs: zero
// invocations of generate-esg-report correlate with any dd-export run, and
// the gap between the get_org_delivery_stats RPC and the next step
// (dd_export_requests insert) was ~38ms, far too fast for an LLM call to
// have happened. The fetch was failing (or being blocked) before it ever
// left the sandbox, and the bare `catch { esgReport = null; }` swallowed
// whatever the actual error was, so this went undiagnosed across sessions.
//
// Fix: generate the ESG report in-process instead of hopping back out over
// HTTP to another function. Same prompt, same parsing, same tier logic
// (the compliance-tier gate already enforced earlier in this function is a
// superset of generate-esg-report's own gate, so no separate check is
// needed here). Errors are now logged with console.error so a future
// failure (e.g. Groq key/rate-limit issues) is visible in function_logs
// instead of silently producing "ESG assessment could not be generated."
// ---------------------------------------------------------------------------

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

interface DdItemForEsg {
  key: string;
  label: string;
  value: boolean;
}

interface EsgGenInput {
  org: { organisation_name: string | null; organisation_type: string | null; sector: string; country: string };
  dd_readiness: {
    is_implementer: boolean;
    items: DdItemForEsg[];
    has_blacklisting: boolean | null;
    has_pending_disputes: boolean | null;
    has_conflicts: boolean | null;
  };
  delivery: { completed: number; resolved: number; stalled: number; fell_through: number; total: number } | null;
  track_record: {
    total_beneficiaries_reached: number | null;
    jobs_created: number | null;
    female_beneficiaries_pct: number | null;
    youth_beneficiaries_pct: number | null;
    years_of_operation: number | null;
    grants_received_count: number | null;
    grants_total_value_usd: number | null;
    grants_delivered_on_time_pct: number | null;
    previous_funders: string[] | null;
    third_party_evaluations: boolean | null;
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateEsgReportInline(input: EsgGenInput): Promise<Record<string, any> | null> {
  const { org, dd_readiness, delivery, track_record } = input;
  const ddItems = dd_readiness.items;
  const isImplementer = dd_readiness.is_implementer;
  const ddScore = ddItems.length > 0
    ? Math.round((ddItems.filter((i) => i.value).length / ddItems.length) * 100)
    : 0;
  const checklistLine = ddItems.map((i) => `- ${i.label}: ${i.value ? "Yes" : "No"}`).join("\n");

  const deliveryResolved = delivery?.resolved ?? 0;
  const deliveryHasData = deliveryResolved >= 1;
  const deliveryRate = deliveryHasData && delivery ? Math.round((delivery.completed / delivery.resolved) * 100) : null;

  const prompt = `You are an experienced ESG and governance analyst producing a snapshot document for a corporate or funder organisation evaluating ${org.organisation_name ?? "this organisation"} as a potential partner. This is NOT an independent audit — it is a structured summary of what the organisation has disclosed on this platform, clearly separating what is self-attested, what is self-entered historical data, and what is genuinely platform-tracked (not self-reported).

ORGANISATION: ${org.organisation_name ?? "Not specified"}
Type: ${org.organisation_type ?? "Not specified"}
Sector: ${org.sector ?? "Not specified"}
Country: ${org.country ?? "Not specified"}
Years of operation: ${track_record?.years_of_operation ?? "Not specified"}

DD READINESS CHECKLIST (self-attested by the organisation, NOT verified by the platform) — this is ${isImplementer ? "the implementer" : "the funder/corporate"} checklist, ${ddScore}% complete (${ddItems.filter((i) => i.value).length}/${ddItems.length} items):
${checklistLine}
  ${dd_readiness.has_blacklisting != null ? `  - Disclosed blacklisting by a government/regulatory agency: ${dd_readiness.has_blacklisting ? "YES — flagged" : "No"}` : ""}
  ${dd_readiness.has_pending_disputes != null ? `  - Disclosed pending legal disputes/investigations: ${dd_readiness.has_pending_disputes ? "YES — flagged" : "No"}` : ""}
  ${dd_readiness.has_conflicts != null ? `  - Disclosed related-party conflicts: ${dd_readiness.has_conflicts ? "YES — flagged" : "No"}` : ""}
- Overall DD readiness score: ${ddScore}% — this exact number must be used verbatim anywhere referenced. Do not paraphrase into a different range.

DELIVERY (platform-tracked outcomes of actual relationships formed on this platform — NOT self-reported):
${deliveryHasData && delivery
    ? `- ${delivery.completed} of ${delivery.resolved} tracked relationships completed (${deliveryRate}% completion rate). ${delivery.stalled > 0 ? `${delivery.stalled} stalled. ` : ""}${delivery.fell_through > 0 ? `${delivery.fell_through} fell through. ` : ""}${(delivery.total - delivery.resolved) > 0 ? `${delivery.total - delivery.resolved} still in progress.` : ""}`
    : `- No completed relationship outcomes tracked on the platform yet${(delivery?.total ?? 0) > 0 ? ` (${delivery?.total} active relationship(s) in progress, none resolved)` : ""}. There is not yet enough platform history to state a delivery rate — say this plainly rather than treating zero data as a negative signal or omitting it.`}

TRACK RECORD (numbers and history entered by the organisation itself — NOT verified by the platform):
- Total beneficiaries reached: ${track_record.total_beneficiaries_reached ?? "Not provided"}
- Jobs created: ${track_record.jobs_created ?? "Not provided"}
- Female beneficiaries: ${track_record.female_beneficiaries_pct != null ? track_record.female_beneficiaries_pct + "%" : "Not provided"}
- Youth beneficiaries: ${track_record.youth_beneficiaries_pct != null ? track_record.youth_beneficiaries_pct + "%" : "Not provided"}
- Grants received: ${track_record.grants_received_count ?? "Not provided"}
- Total grant value: ${track_record.grants_total_value_usd != null ? "USD " + Number(track_record.grants_total_value_usd).toLocaleString() : "Not provided"}
- Grants delivered on time: ${track_record.grants_delivered_on_time_pct != null ? track_record.grants_delivered_on_time_pct + "%" : "Not provided"}
- Previous funders: ${track_record.previous_funders?.join(", ") || "Not provided"}
- Third-party evaluations conducted: ${track_record.third_party_evaluations ? "Yes" : "No / not disclosed"}

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
      console.warn("[generate-dd-export/esg] Groq 429 rate limit hit, retrying", { rateLimitAttempt, waitMs, body: errBody });
      await sleep(waitMs);
      continue;
    }

    groqRes = res;
    break;
  }

  if (!groqRes) {
    console.error("[generate-dd-export/esg] Groq API request failed after rate limit retry");
    return null;
  }

  if (!groqRes.ok) {
    const err = await groqRes.text();
    console.error(
      `[generate-dd-export/esg] Groq API error - status: ${groqRes.status} ${groqRes.statusText}, ` +
      `remaining-tokens: ${groqRes.headers.get("x-ratelimit-remaining-tokens")}, ` +
      `remaining-requests: ${groqRes.headers.get("x-ratelimit-remaining-requests")}, body: ${err}`
    );
    return null;
  }

  const groqData = await groqRes.json();
  const rawText = groqData.choices?.[0]?.message?.content ?? "";

  try {
    return parseReportJson(rawText);
  } catch (parseErr) {
    console.error("[generate-dd-export/esg] Could not parse Groq response as JSON", { error: String(parseErr), raw: rawText });
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

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
  const { data: exporterOrg } = await callerClient
    .from("organizations")
    .select("id, organisation_name, organisation_type, subscription_tier")
    .eq("user_id", ownerId ?? user.id)
    .maybeSingle();

  if (!exporterOrg || exporterOrg.subscription_tier !== "compliance") {
    return new Response(JSON.stringify({
      error: "An audit-ready DD export requires a Compliance plan.",
      requires_upgrade: true,
      required_tier: "compliance",
    }), { status: 403, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
  }

  let body: { subject_org_id?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
  const subjectOrgId = body.subject_org_id;
  if (!subjectOrgId) {
    return new Response(JSON.stringify({ error: "subject_org_id is required" }), {
      status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  const svc = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: subjectOrg, error: subjectErr } = await svc
    .from("organizations")
    .select("id, organisation_name, organisation_type, sector, country, registration_type, registration_number, tin, scuml_number, year_founded, verification_status, srg1_pie_self_declared, created_at, " +
      "dd_financial_model, dd_audited_accounts, dd_governance_doc, dd_esg_assessment, dd_impact_framework, dd_environmental_policy, dd_safeguarding_policy, dd_legal_registration, dd_legal_compliance_declaration, " +
      "fdd_disbursement_track_record, fdd_decision_transparency, fdd_conflict_disclosure, fdd_governance_doc, fdd_esg_framework, fdd_legal_registration, " +
      "dd_evidence, dd_confirmed_at, " +
      "total_beneficiaries_reached, jobs_created, female_beneficiaries_pct, youth_beneficiaries_pct, years_of_operation, grants_received_count, grants_total_value_usd, grants_delivered_on_time_pct, previous_funders, third_party_evaluations")
    .eq("id", subjectOrgId)
    .maybeSingle();

  if (subjectErr || !subjectOrg) {
    return new Response(JSON.stringify({ error: "Subject organisation not found" }), {
      status: 404, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  const { data: mou, error: mouErr } = await svc
    .from("mou_documents")
    .select("status, updated_at, created_at")
    .or(`and(org_a_id.eq.${exporterOrg.id},org_b_id.eq.${subjectOrgId}),and(org_a_id.eq.${subjectOrgId},org_b_id.eq.${exporterOrg.id})`)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (mouErr) console.error("[generate-dd-export] mou_documents lookup failed", { error: mouErr.message, code: mouErr.code });

  const implementer = isImplementerOrgType(subjectOrg.organisation_type);
  const items = implementer ? DD_ITEMS : FUNDER_DD_ITEMS;
  const prefix = implementer ? "dd" : "fdd";
  const confirmedAt: Record<string, { at: string; approx: boolean }> = subjectOrg.dd_confirmed_at ?? {};

  const rows = items.map((item, i) => {
    const fieldName = `${prefix}_${item.key}`;
    const value = Boolean((subjectOrg as Record<string, any>)[fieldName]);
    const confirmation = confirmedAt[fieldName];
    return {
      label: item.label,
      key: item.key,
      confirmed: value,
      confirmedAt: confirmation?.at ?? null,
      approx: confirmation?.approx ?? false,
      ref: `${prefix.toUpperCase()}-${String(i + 1).padStart(2, "0")}`,
      detail: value ? evidenceDetailLine(item.key, subjectOrg.dd_evidence) : null,
    };
  });

  const confirmedCount = rows.filter((r) => r.confirmed).length;
  const readinessScore = items.length > 0 ? Math.round((confirmedCount / items.length) * 100) : 0;

  if (readinessScore < READINESS_THRESHOLD_PCT) {
    return new Response(JSON.stringify({
      error: `This organisation's DD Readiness (${readinessScore}%) is below the ${READINESS_THRESHOLD_PCT}% threshold required for an audit-ready export.`,
      readiness_score: readinessScore,
      threshold: READINESS_THRESHOLD_PCT,
    }), { status: 403, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
  }

  // Still computed and stored for other consumers of the snapshot, but no
  // longer rendered as a Gold/Silver/Bronze badge in the customer PDF -- a
  // tier badge reads as third-party certification, which this export isn't.
  const trustTier = computeTrustTier(readinessScore, subjectOrg.dd_evidence);
  const redFlags = redFlagSentences(subjectOrg.dd_evidence);
  const riskExposure = computeRiskExposure(readinessScore, redFlags);

  let esgReport: Record<string, any> | null = null;
  try {
    const { data: deliveryRows } = await svc.rpc("get_org_delivery_stats", { target_org_id: subjectOrgId });
    const delivery = deliveryRows?.[0] ?? null;
    const legalEvidence = implementer
      ? (subjectOrg.dd_evidence?.legal_compliance_declaration ?? {})
      : (subjectOrg.dd_evidence?.conflict_disclosure ?? {});
    esgReport = await generateEsgReportInline({
      org: {
        organisation_name: subjectOrg.organisation_name,
        organisation_type: subjectOrg.organisation_type,
        sector: cleanTextField(subjectOrg.sector),
        country: cleanTextField(subjectOrg.country),
      },
      dd_readiness: {
        is_implementer: implementer,
        items: rows.map((r) => ({ key: r.key, label: r.label, value: r.confirmed })),
        has_blacklisting: implementer ? (legalEvidence.hasBlacklisting ?? null) : null,
        has_pending_disputes: implementer ? (legalEvidence.hasPendingDisputes ?? null) : null,
        has_conflicts: (implementer ? legalEvidence.conflictsToDisclose : legalEvidence.hasConflicts) ?? null,
      },
      delivery,
      track_record: {
        total_beneficiaries_reached: subjectOrg.total_beneficiaries_reached,
        jobs_created: subjectOrg.jobs_created,
        female_beneficiaries_pct: subjectOrg.female_beneficiaries_pct,
        youth_beneficiaries_pct: subjectOrg.youth_beneficiaries_pct,
        years_of_operation: subjectOrg.years_of_operation,
        grants_received_count: subjectOrg.grants_received_count,
        grants_total_value_usd: subjectOrg.grants_total_value_usd,
        grants_delivered_on_time_pct: subjectOrg.grants_delivered_on_time_pct,
        previous_funders: subjectOrg.previous_funders,
        third_party_evaluations: subjectOrg.third_party_evaluations,
      },
    });
  } catch (esgErr) {
    console.error("[generate-dd-export] ESG generation threw", { error: String(esgErr) });
    esgReport = null;
  }

  const confirmedDates = Object.values(confirmedAt).map((c) => c?.at).filter(Boolean) as string[];
  const firstConfirmed = confirmedDates.length > 0 ? confirmedDates.reduce((a, b) => (a < b ? a : b)) : null;
  const lastConfirmed = confirmedDates.length > 0 ? confirmedDates.reduce((a, b) => (a > b ? a : b)) : null;
  const timelineEntries: { label: string; date: string }[] = [
    { label: "Organisation joined the platform", date: fmtDate(subjectOrg.created_at) },
  ];
  if (firstConfirmed) timelineEntries.push({ label: "First DD item confirmed", date: fmtDate(firstConfirmed) });
  if (lastConfirmed && lastConfirmed !== firstConfirmed) timelineEntries.push({ label: "Most recent DD item confirmed", date: fmtDate(lastConfirmed) });
  if (mou) {
    timelineEntries.push({ label: "MoU created", date: fmtDate(mou.created_at) });
    if (mou.updated_at && mou.updated_at !== mou.created_at) {
      timelineEntries.push({ label: `MoU status: ${MOU_STATUS_LABELS[mou.status] ?? mou.status}`, date: fmtDate(mou.updated_at) });
    }
  }

  const legalRegRow = rows.find((r) => r.key === "legal_registration");
  const exceptions: string[] = [];
  if (!esgReport) exceptions.push("ESG assessment unavailable for this export. See Section 06.");
  if (legalRegRow?.confirmed && !subjectOrg.registration_number) {
    exceptions.push(`Legal registration (${legalRegRow.ref}) is self-attested via the DD checklist and has not passed Impact Natives' formal verification review. See Section 01.`);
  }
  if (redFlags.length > 0) exceptions.push("One or more compliance flags disclosed. See Section 04.");

  const overallStatusLabel = readinessScore === 100 ? "COMPLETE" : readinessScore >= 85 ? "SUBSTANTIALLY COMPLETE" : "IN PROGRESS";

  const { data: exportRow, error: insertErr } = await svc
    .from("dd_export_requests")
    .insert({
      exporter_org_id: exporterOrg.id,
      exporter_user_id: user.id,
      subject_org_id: subjectOrgId,
      dd_readiness_pct_snapshot: readinessScore,
      trust_tier_snapshot: trustTier.tier,
    })
    .select("id")
    .single();

  if (insertErr || !exportRow) {
    return new Response(JSON.stringify({ error: `Could not create export record: ${insertErr?.message}` }), {
      status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
  const exportId = exportRow.id;

  try {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const fontItalic = await pdf.embedFont(StandardFonts.HelveticaOblique);
    const PAGE_W = 595.28, PAGE_H = 841.89;
    const MARGIN = 50;
    const TOP_MARGIN = 74;
    const BOTTOM_LIMIT = 58;
    const CONTENT_W = PAGE_W - MARGIN * 2;
    let page = pdf.addPage([PAGE_W, PAGE_H]);
    let y = PAGE_H - TOP_MARGIN;

    const white = rgb(1, 1, 1);
    const ink = rgb(0.13, 0.14, 0.15);
    const inkSoft = rgb(0.42, 0.44, 0.46);
    const green = rgb(0.09, 0.29, 0.20);
    const greenTint = rgb(0.937, 0.961, 0.945);
    const red = rgb(0.70, 0.16, 0.16);
    const redTint = rgb(0.98, 0.93, 0.93);
    const amber = rgb(0.60, 0.42, 0.05);
    const amberTint = rgb(0.995, 0.972, 0.906);
    const border = rgb(0.84, 0.85, 0.86);
    const borderSoft = rgb(0.90, 0.905, 0.91);
    const panel = rgb(0.973, 0.973, 0.969);
    const rowAlt = rgb(0.976, 0.976, 0.972);
    const neutralBg = rgb(0.898, 0.918, 0.945);
    const neutralFg = rgb(0.27, 0.34, 0.44);
    const mutedBg = rgb(0.925, 0.925, 0.925);
    const mutedFg = rgb(0.44, 0.44, 0.44);

    function newPage() {
      page = pdf.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - TOP_MARGIN;
    }
    function ensureSpace(need: number) {
      if (y - need < BOTTOM_LIMIT) newPage();
    }
    function forcePageBreak() {
      newPage();
    }

    // Block-level: measures the whole paragraph and moves it as one unit, so
    // a two-line footnote can never leave its last line orphaned on the next
    // page the way per-line pagination did.
    function textBlock(str: string, opts: { size?: number; bold?: boolean; italic?: boolean; color?: any; gap?: number; lead?: number; x?: number; width?: number } = {}) {
      const size = opts.size ?? 10;
      const f = opts.italic ? fontItalic : opts.bold ? fontBold : font;
      const w = opts.width ?? CONTENT_W;
      const x = opts.x ?? MARGIN;
      const lead = opts.lead ?? size + 3.5;
      const lines = wrapLines(str, size, f, w);
      ensureSpace(lines.length * lead);
      for (const line of lines) {
        page.drawText(line, { x, y, size, font: f, color: opts.color ?? ink });
        y -= lead;
      }
      y -= opts.gap ?? 0;
    }

    // Kicker sits 19pt above the title baseline; at 17pt the title ascender
    // is ~12.2pt, leaving real clearance instead of the collision the 18/15
    // pairing produced.
    function sectionHeading(num: string, title: string) {
      ensureSpace(58);
      page.drawText(`SECTION ${num}`, { x: MARGIN, y, size: 8, font: fontBold, color: green });
      y -= 19;
      page.drawText(title, { x: MARGIN, y, size: 17, font: fontBold, color: ink });
      y -= 22;
    }

    const PILL_H = 15;
    function pillWidth(label: string): number {
      return fontBold.widthOfTextAtSize(label, 8.5) + 14;
    }
    // baselineY is the text baseline of the row the pill belongs to, so pills
    // optically align with adjacent plain text on the same line.
    function drawPill(x: number, baselineY: number, label: string, kind: "confirmed" | "neutral" | "muted" | "attention" | "flag") {
      const size = 8.5;
      const w = pillWidth(label);
      const rectY = baselineY - 4;
      let bg: any, fg: any;
      if (kind === "confirmed") { bg = green; fg = white; }
      else if (kind === "neutral") { bg = neutralBg; fg = neutralFg; }
      else if (kind === "attention") { bg = amberTint; fg = amber; }
      else if (kind === "flag") { bg = redTint; fg = red; }
      else { bg = mutedBg; fg = mutedFg; }
      page.drawRectangle({ x, y: rectY, width: w, height: PILL_H, color: bg });
      page.drawText(label, { x: x + 7, y: rectY + 4.5, size, font: fontBold, color: fg });
    }

    function drawKeyValueTable(kvRows: { label: string; value: string }[], labelColW = 178, valSize = 10) {
      const valW = CONTENT_W - labelColW - 22;
      const lead = 13.5;
      const heights = kvRows.map(({ value }) => Math.max(wrapLines(value, valSize, font, valW).length, 1) * lead + 7);
      const tH = heights.reduce((a, b) => a + b, 0);
      ensureSpace(tH + 6);
      const top = y;
      kvRows.forEach(({ label, value }, i) => {
        const rh = heights[i];
        const rTop = top - heights.slice(0, i).reduce((a, b) => a + b, 0);
        if (i % 2 === 1) page.drawRectangle({ x: MARGIN, y: rTop - rh, width: CONTENT_W, height: rh, color: rowAlt });
        page.drawText(label, { x: MARGIN + 12, y: rTop - 15.5, size: valSize, font: fontBold, color: ink });
        wrapLines(value, valSize, font, valW).forEach((line, li) =>
          page.drawText(line, { x: MARGIN + labelColW, y: rTop - 15.5 - li * lead, size: valSize, font, color: ink }));
        if (i > 0) page.drawLine({ start: { x: MARGIN, y: rTop }, end: { x: MARGIN + CONTENT_W, y: rTop }, thickness: 0.5, color: borderSoft });
      });
      page.drawLine({ start: { x: MARGIN + labelColW - 12, y: top }, end: { x: MARGIN + labelColW - 12, y: top - tH }, thickness: 0.5, color: borderSoft });
      page.drawRectangle({ x: MARGIN, y: top - tH, width: CONTENT_W, height: tH, borderColor: border, borderWidth: 1 });
      y = top - tH;
    }

    // ============================================================
    // PAGE 1 - Cover + Executive DD Summary
    // ============================================================
    page.drawText("IMPACT NATIVES · COMPLIANCE SUITE", { x: MARGIN, y, size: 21, font: fontBold, color: green });
    y -= 24;
    page.drawText("Audit-Ready Due Diligence Report", { x: MARGIN, y, size: 11.5, font: fontBold, color: ink });
    y -= 32;

    const verifiedLabel = subjectOrg.verification_status === "verified" ? " (Verified)" : "";
    const pairedEntityRows: [string, string, string, string][] = [
      ["Corporate Entity", `${exporterOrg.organisation_name}`,
       "Export Date", new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })],
      ["Target Organisation", `${subjectOrg.organisation_name}`,
       subjectOrg.organisation_type === "corporation" ? "SRG1 Reporting Status" : "Verification Status",
       subjectOrg.organisation_type === "corporation"
         ? (subjectOrg.srg1_pie_self_declared ? "Self-declared PIE" : "Not self-declared")
         : (subjectOrg.verification_status === "verified" ? "Verified" : "Not verified")],
    ];
    const singleEntityRows: [string, string][] = [
      ["Process Reference ID", exportId],
      ["MoU Status", mou ? (MOU_STATUS_LABELS[mou.status] ?? mou.status) : "No MoU on record"],
    ];
    const pairW = CONTENT_W / 2;
    const eFont = 10, eLead = 13;
    const allEntityLabels = [...pairedEntityRows.flatMap(([l1, , l2]) => [l1, l2]), ...singleEntityRows.map(([l]) => l)];
    const labelColW = Math.max(...allEntityLabels.map((l) => fontBold.widthOfTextAtSize(l, eFont))) + 26;
    const eValW = pairW - labelColW - 8;
    const pairedH = pairedEntityRows.map(([, v1, , v2]) =>
      Math.max(wrapLines(v1, eFont, font, eValW).length, wrapLines(v2, eFont, font, eValW).length, 1) * eLead + 15);
    const singleValW = CONTENT_W - labelColW - 12;
    const singleH = singleEntityRows.map(([, v]) => Math.max(wrapLines(v, eFont, font, singleValW).length, 1) * eLead + 15);
    const entityH = pairedH.reduce((a, b) => a + b, 0) + singleH.reduce((a, b) => a + b, 0);
    ensureSpace(entityH + 8);
    const eTop = y;
    page.drawRectangle({ x: MARGIN, y: eTop - entityH, width: CONTENT_W, height: entityH, color: panel });
    let eY = eTop;
    pairedEntityRows.forEach(([l1, v1, l2, v2], i) => {
      const rh = pairedH[i];
      page.drawText(l1, { x: MARGIN + 12, y: eY - 16, size: eFont, font: fontBold, color: ink });
      wrapLines(v1, eFont, font, eValW).forEach((line, li) => page.drawText(line, { x: MARGIN + labelColW, y: eY - 16 - li * eLead, size: eFont, font, color: ink }));
      page.drawText(l2, { x: MARGIN + pairW + 12, y: eY - 16, size: eFont, font: fontBold, color: ink });
      wrapLines(v2, eFont, font, eValW).forEach((line, li) => page.drawText(line, { x: MARGIN + pairW + labelColW, y: eY - 16 - li * eLead, size: eFont, font, color: ink }));
      if (i > 0) page.drawLine({ start: { x: MARGIN, y: eY }, end: { x: MARGIN + CONTENT_W, y: eY }, thickness: 0.5, color: borderSoft });
      page.drawLine({ start: { x: MARGIN + pairW, y: eY }, end: { x: MARGIN + pairW, y: eY - rh }, thickness: 0.5, color: borderSoft });
      eY -= rh;
    });
    singleEntityRows.forEach(([label, val], i) => {
      const rh = singleH[i];
      page.drawText(label, { x: MARGIN + 12, y: eY - 16, size: eFont, font: fontBold, color: ink });
      wrapLines(val, eFont, font, singleValW).forEach((line, li) => page.drawText(line, { x: MARGIN + labelColW, y: eY - 16 - li * eLead, size: eFont, font, color: ink }));
      page.drawLine({ start: { x: MARGIN, y: eY }, end: { x: MARGIN + CONTENT_W, y: eY }, thickness: 0.5, color: borderSoft });
      eY -= rh;
    });
    page.drawLine({ start: { x: MARGIN + labelColW - 12, y: eTop }, end: { x: MARGIN + labelColW - 12, y: eTop - entityH }, thickness: 0.5, color: borderSoft });
    page.drawRectangle({ x: MARGIN, y: eTop - entityH, width: CONTENT_W, height: entityH, borderColor: border, borderWidth: 1 });
    y = eTop - entityH - 30;

    page.drawText("EXECUTIVE DD SUMMARY", { x: MARGIN, y, size: 8, font: fontBold, color: green });
    y -= 19;
    page.drawText("Overview", { x: MARGIN, y, size: 17, font: fontBold, color: ink });
    y -= 22;

    const execRows: { label: string; pill: string; kind: "confirmed" | "neutral" | "muted" | "attention" | "flag" }[] = [
      { label: "DD Readiness", pill: `${readinessScore}% Complete`, kind: readinessScore === 100 ? "confirmed" : "attention" },
      { label: "Compliance Dimensions", pill: `${confirmedCount} of ${items.length} Self-Attested`, kind: confirmedCount === items.length ? "confirmed" : "attention" },
      { label: "Compliance Flags", pill: redFlags.length > 0 ? `${redFlags.length} Disclosed` : "None Disclosed", kind: redFlags.length > 0 ? "flag" : "confirmed" },
      { label: "Disclosure-Based Risk Indicator", pill: riskExposure.label, kind: riskExposure.label === "Elevated" ? "flag" : riskExposure.label === "Low" ? "confirmed" : "attention" },
      { label: "ESG Assessment", pill: esgReport ? "Included" : "Not Available", kind: esgReport ? "confirmed" : "attention" },
      { label: "Information Basis", pill: "Self-Reported", kind: "neutral" },
    ];
    const execLabelColW = Math.max(...execRows.map((r) => fontBold.widthOfTextAtSize(r.label, 10))) + 34;
    const execRowH = 27;
    const execH = execRowH * execRows.length;
    ensureSpace(execH + 6);
    const execTop = y;
    execRows.forEach((r, i) => {
      const rTop = execTop - i * execRowH;
      if (i % 2 === 1) page.drawRectangle({ x: MARGIN, y: rTop - execRowH, width: CONTENT_W, height: execRowH, color: rowAlt });
      page.drawText(r.label, { x: MARGIN + 12, y: rTop - 17.5, size: 10, font: fontBold, color: ink });
      drawPill(MARGIN + execLabelColW, rTop - 17.5, r.pill, r.kind);
      if (i > 0) page.drawLine({ start: { x: MARGIN, y: rTop }, end: { x: MARGIN + CONTENT_W, y: rTop }, thickness: 0.5, color: borderSoft });
    });
    page.drawLine({ start: { x: MARGIN + execLabelColW - 14, y: execTop }, end: { x: MARGIN + execLabelColW - 14, y: execTop - execH }, thickness: 0.5, color: borderSoft });
    page.drawRectangle({ x: MARGIN, y: execTop - execH, width: CONTENT_W, height: execH, borderColor: border, borderWidth: 1 });
    y = execTop - execH - 26;

    // Overall status card: fixed left column with a divider, both sides
    // vertically centred against a shared card height.
    const statusLeftW = 232;
    const statusDetail = `${confirmedCount} of ${items.length} due diligence readiness dimensions self-attested at the time of export. ${redFlags.length > 0 ? `${redFlags.length} compliance flag${redFlags.length !== 1 ? "s" : ""} disclosed.` : "No compliance flags disclosed."}`;
    const statusLines = wrapLines(statusDetail, 9, font, CONTENT_W - statusLeftW - 24);
    const statusH = Math.max(statusLines.length * 12.5 + 30, 60);
    ensureSpace(statusH + 6);
    const sTop = y;
    page.drawRectangle({ x: MARGIN, y: sTop - statusH, width: CONTENT_W, height: statusH, color: greenTint, borderColor: green, borderWidth: 1 });
    page.drawLine({ start: { x: MARGIN + statusLeftW, y: sTop - 10 }, end: { x: MARGIN + statusLeftW, y: sTop - statusH + 10 }, thickness: 0.5, color: green });
    page.drawText("OVERALL DD STATUS", { x: MARGIN + 16, y: sTop - statusH / 2 + 4, size: 8, font: fontBold, color: green });
    page.drawText(overallStatusLabel, { x: MARGIN + 16, y: sTop - statusH / 2 - 14, size: 16, font: fontBold, color: green });
    const statusBlockTop = sTop - (statusH - statusLines.length * 12.5) / 2 - 8;
    statusLines.forEach((line, li) => page.drawText(line, { x: MARGIN + statusLeftW + 18, y: statusBlockTop - li * 12.5, size: 9, font, color: ink }));
    y = sTop - statusH - 26;

    const noticeText = "This report is a point-in-time export of information submitted by the target organisation. Unless explicitly stated otherwise, information is self-reported and has not been independently verified by Impact Natives. The report reflects the status recorded at the time of generation and does not automatically incorporate later changes to the organisation's profile.";
    const noticeLines = wrapLines(noticeText, 9, fontItalic, CONTENT_W - 32);
    const noticeH = noticeLines.length * 12.5 + 34;
    ensureSpace(noticeH + 6);
    const nTop = y;
    page.drawRectangle({ x: MARGIN, y: nTop - noticeH, width: CONTENT_W, height: noticeH, color: panel, borderColor: border, borderWidth: 0.75 });
    page.drawText("IMPORTANT SCOPE NOTICE", { x: MARGIN + 16, y: nTop - 18, size: 8, font: fontBold, color: ink });
    noticeLines.forEach((line, li) => page.drawText(line, { x: MARGIN + 16, y: nTop - 34 - li * 12.5, size: 9, font: fontItalic, color: ink }));
    y = nTop - noticeH;

    // ============================================================
    // PAGE 2 - Organisation Profile + DD Readiness
    // ============================================================
    forcePageBreak();

    // For each legal identity field, prefer the org profile value (entered
    // via the Legal Identity section). If that's missing, fall back to the
    // equivalent field from dd_evidence.legal_registration (entered via the
    // DD checklist modal) and append "(Self-Attested)" to signal the source.
    // If neither exists, show "Not provided".
    const ddLegal = subjectOrg.dd_evidence?.legal_registration ?? {};
    function profileOrDd(profileVal: string | null | undefined, ddVal: string | null | undefined): string {
      const p = cleanTextField(profileVal);
      if (p) return p;
      const d = cleanTextField(ddVal);
      if (d) return `${d} (Self-Attested)`;
      return "Not provided";
    }

    sectionHeading("01", "Governance & Legal");
    const sec01Rows: { label: string; value: string }[] = [
      { label: "Organisation Type", value: titleCaseOrgType(subjectOrg.organisation_type) },
      { label: "Country", value: profileOrDd(subjectOrg.country, ddLegal.country) },
      { label: "Registration Type / Registering Body", value: profileOrDd(subjectOrg.registration_type, ddLegal.registeringBody) },
      { label: "Registration Number", value: profileOrDd(subjectOrg.registration_number, ddLegal.registrationNumber) },
      { label: "TIN", value: cleanTextField(subjectOrg.tin) || "Not provided" },
      { label: "SCUML / AML Registration", value: cleanTextField(subjectOrg.scuml_number) || "Not provided" },
      { label: "Year Founded", value: subjectOrg.year_founded ? String(subjectOrg.year_founded) : "Not provided" },
    ];
    drawKeyValueTable(sec01Rows, 222);
    y -= 48;

    sectionHeading("02", "DD Readiness");
    textBlock("\"Self-Attested\" means the organisation answered this item -- the answer itself may be Yes or No. See the detail line under each item for what was actually disclosed.", { size: 8, italic: true, color: inkSoft, lead: 11, gap: 10 });

    const colDim = 216, colStatus = 120, colConfirmed = 92;
    const ddLead = 12, ddPad = 12, detailLead = 11;
    function drawDdTableHeader() {
      ensureSpace(26 + 4);
      page.drawRectangle({ x: MARGIN, y: y - 26, width: CONTENT_W, height: 26, color: green });
      let cx = MARGIN + 12;
      page.drawText("Compliance Dimension", { x: cx, y: y - 17, size: 10, font: fontBold, color: white }); cx += colDim;
      page.drawText("Status", { x: cx, y: y - 17, size: 10, font: fontBold, color: white }); cx += colStatus;
      page.drawText("Confirmed", { x: cx, y: y - 17, size: 10, font: fontBold, color: white }); cx += colConfirmed;
      page.drawText("Ref", { x: cx, y: y - 17, size: 10, font: fontBold, color: white });
      y -= 26;
    }
    drawDdTableHeader();
    rows.forEach((row, i) => {
      const confirmedText = row.confirmed ? `${fmtDate(row.confirmedAt)}${row.approx ? "*" : ""}` : "Not confirmed";
      const labelLines = wrapLines(row.label, 9.5, font, colDim - 18);
      const confLines = wrapLines(confirmedText, 9, font, colConfirmed - 12);
      const detailParts = row.detail ? row.detail.split("; ") : [];
      // Detail bullets are drawn at x: MARGIN + 24 and must stay within
      // the Compliance Dimension column (colDim wide) to avoid bleeding
      // into the Status/Self-Attested pill column to their right.
      const detailLineSets = detailParts.map((p) => wrapLines(p, 8.5, fontItalic, colDim - 20));
      const detailLinesTotal = detailLineSets.reduce((a, s) => a + s.length, 0);
      const topH = Math.max(labelLines.length, confLines.length, 1) * ddLead + ddPad;
      const detailH = detailLinesTotal > 0 ? detailLinesTotal * detailLead + 6 : 0;
      const rh = topH + detailH;
      if (y - rh < BOTTOM_LIMIT) { newPage(); drawDdTableHeader(); }
      const rTop = y;
      if (i % 2 === 1) page.drawRectangle({ x: MARGIN, y: rTop - rh, width: CONTENT_W, height: rh, color: rowAlt });
      let cx = MARGIN + 12;
      labelLines.forEach((line, li) => page.drawText(line, { x: cx, y: rTop - 16 - li * ddLead, size: 9.5, font, color: ink }));
      cx += colDim;
      drawPill(cx, rTop - 16, row.confirmed ? "Self-Attested" : "Not Attested", row.confirmed ? "confirmed" : "muted");
      cx += colStatus;
      confLines.forEach((line, li) => page.drawText(line, { x: cx, y: rTop - 16 - li * ddLead, size: 9, font, color: ink }));
      cx += colConfirmed;
      page.drawText(row.ref, { x: cx, y: rTop - 16, size: 8.5, font, color: inkSoft });
      if (detailLineSets.length > 0) {
        let dy = rTop - topH - 2;
        detailLineSets.forEach((set) => {
          set.forEach((line, li) => {
            page.drawText(`${li === 0 ? "•  " : "   "}${line}`, { x: MARGIN + 24, y: dy, size: 8.5, font: fontItalic, color: inkSoft });
            dy -= detailLead;
          });
        });
      }
      if (i > 0) page.drawLine({ start: { x: MARGIN, y: rTop }, end: { x: MARGIN + CONTENT_W, y: rTop }, thickness: 0.5, color: borderSoft });
      y -= rh;
    });
    page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + CONTENT_W, y }, thickness: 0.75, color: border });
    y -= 12;
    textBlock("* Baseline estimate carried over from before per-item confirmation timestamps were tracked: the item was true at that point, exact original date unknown.", { size: 8, italic: true, color: inkSoft, lead: 11 });

    // DD Standing panel -- moved here from its former position after
    // Relationship Activity (old Section 06). Now sits immediately after
    // the checklist table so the score and status are read in context,
    // not separated from the evidence that produces them.
    y -= 20;
    sectionHeading("03", "DD Standing");
    const standLeftW = 150;
    const standH = 82;
    ensureSpace(standH + 6);
    const stTop = y;
    page.drawRectangle({ x: MARGIN, y: stTop - standH, width: CONTENT_W, height: standH, color: panel, borderColor: border, borderWidth: 1 });
    page.drawLine({ start: { x: MARGIN + standLeftW, y: stTop - 11 }, end: { x: MARGIN + standLeftW, y: stTop - standH + 11 }, thickness: 0.5, color: border });
    page.drawText("DD READINESS", { x: MARGIN + 18, y: stTop - standH / 2 + 6, size: 8, font: fontBold, color: green });
    page.drawText(`${readinessScore}%`, { x: MARGIN + 18, y: stTop - standH / 2 - 17, size: 24, font: fontBold, color: green });
    // Stand lines are wrapped manually since the panel has fixed height --
    // we can't grow the box, so we need to know line count up front to
    // centre the text block. First line wraps at the right-column width.
    const standRightW = CONTENT_W - standLeftW - 32;
    const standLine1Wrapped = wrapLines(
      `Status: ${overallStatusLabel} · ${confirmedCount} of ${items.length} ${implementer ? "implementer" : "funder / corporate"} checklist dimensions self-attested.`,
      9.5, fontBold, standRightW
    );
    const standLine2 = redFlags.length > 0 ? "Compliance flags disclosed. See Section 04." : "No compliance flags disclosed.";
    const standAllLines = [...standLine1Wrapped, standLine2];
    const standTotalH = standAllLines.length * 13.5;
    const standBlockTop = stTop - (standH - standTotalH) / 2 - 2;
    let sly = standBlockTop;
    standLine1Wrapped.forEach((line) => {
      page.drawText(line, { x: MARGIN + standLeftW + 20, y: sly, size: 9.5, font: fontBold, color: ink });
      sly -= 13.5;
    });
    page.drawText(standLine2, { x: MARGIN + standLeftW + 20, y: sly, size: 9.5, font, color: ink });
    y = stTop - standH - 12;
    textBlock("This figure represents completion of the defined DD readiness checklist. It is not a credit score, risk rating, certification, or independent verification of the organisation.", { size: 8.5, italic: true, color: inkSoft, lead: 11.5, gap: 26 });

    // Sections 04 and 05 flow on the same page as 03 if there's enough
    // space for both section headings plus meaningful content (~200pt).
    // If not, start a new page.
    ensureSpace(200);

    sectionHeading("04", "Compliance Flags");
    if (redFlags.length > 0) {
      for (const flag of redFlags) textBlock(flag, { size: 10, color: red, gap: 7 });
      y -= 4;
    } else {
      textBlock("No compliance flags have been disclosed by the organisation.", { size: 10, gap: 7 });
      textBlock("This indicates that no compliance issues were disclosed through the information available for this export. It does not constitute confirmation that no undisclosed issues exist.", { size: 8.5, italic: true, color: inkSoft, lead: 11.5 });
    }
    y -= 26;

    sectionHeading("05", "Disclosure-Based Risk Indicator");
    textBlock("Basis: DD readiness score and disclosed compliance flags only. This indicator is not a comprehensive assessment of credit, financial, operational, legal, or organisational risk.", { size: 9, italic: true, color: inkSoft, lead: 12, gap: 12 });
    const riskColors: Record<string, any> = { Elevated: red, Standard: amber, Low: green };
    const riskTints: Record<string, any> = { Elevated: redTint, Standard: amberTint, Low: greenTint };
    const riskColor = riskColors[riskExposure.label] ?? ink;
    const riskTint = riskTints[riskExposure.label] ?? panel;
    const riskLeftW = 124;
    const riskLines = wrapLines(riskExposure.detail, 9.5, font, CONTENT_W - riskLeftW - 32);
    const riskH = Math.max(riskLines.length * 13 + 26, 52);
    ensureSpace(riskH + 6);
    const rTop2 = y;
    page.drawRectangle({ x: MARGIN, y: rTop2 - riskH, width: CONTENT_W, height: riskH, color: riskTint, borderColor: riskColor, borderWidth: 1 });
    page.drawLine({ start: { x: MARGIN + riskLeftW, y: rTop2 - 9 }, end: { x: MARGIN + riskLeftW, y: rTop2 - riskH + 9 }, thickness: 0.5, color: riskColor });
    const riskLabel = riskExposure.label.toUpperCase();
    const riskLabelW = fontBold.widthOfTextAtSize(riskLabel, 14);
    page.drawText(riskLabel, { x: MARGIN + (riskLeftW - riskLabelW) / 2, y: rTop2 - riskH / 2 - 5, size: 14, font: fontBold, color: riskColor });
    const riskBlockTop = rTop2 - (riskH - riskLines.length * 13) / 2 - 9;
    riskLines.forEach((line, li) => page.drawText(line, { x: MARGIN + riskLeftW + 18, y: riskBlockTop - li * 13, size: 9.5, font, color: ink }));
    y = rTop2 - riskH - 30;

    if (exceptions.length > 0) {
      const excLineSets = exceptions.map((e) => wrapLines(e, 9.5, font, CONTENT_W - 46));
      const excBodyH = excLineSets.reduce((a, s) => a + s.length * 13 + 7, 0);
      const excH = excBodyH + 42;
      ensureSpace(excH + 6);
      const xTop = y;
      page.drawRectangle({ x: MARGIN, y: xTop - excH, width: CONTENT_W, height: excH, color: amberTint, borderColor: amber, borderWidth: 1 });
      page.drawText("EXCEPTIONS · ITEMS REQUIRING ATTENTION", { x: MARGIN + 16, y: xTop - 19, size: 8, font: fontBold, color: amber });
      let xY = xTop - 38;
      excLineSets.forEach((set) => {
        page.drawText("•", { x: MARGIN + 16, y: xY, size: 9.5, font: fontBold, color: amber });
        set.forEach((line, li) => page.drawText(line, { x: MARGIN + 30, y: xY - li * 13, size: 9.5, font, color: ink }));
        xY -= set.length * 13 + 7;
      });
      y = xTop - excH - 30;
    }

    // ============================================================
    // PAGE 4 - ESG Assessment
    // ============================================================
    forcePageBreak();

    sectionHeading("06", "ESG Assessment");
    if (esgReport) {
      textBlock("Basis: self-reported organisational inputs. Not independently verified by Impact Natives.", { size: 9, italic: true, color: inkSoft, gap: 14 });
      if (esgReport.headline) textBlock(String(esgReport.headline), { size: 10, bold: true, gap: 12 });
      textBlock("Environmental", { size: 10.5, bold: true, gap: 3 });
      textBlock(String(esgReport.environmental ?? "Not provided."), { size: 9.5, gap: 12 });
      textBlock("Social", { size: 10.5, bold: true, gap: 3 });
      textBlock(String(esgReport.social ?? "Not provided."), { size: 9.5, gap: 12 });
      textBlock("Governance", { size: 10.5, bold: true, gap: 3 });
      textBlock(String(esgReport.governance ?? "Not provided."), { size: 9.5, gap: 12 });
      if (Array.isArray(esgReport.data_gaps) && esgReport.data_gaps.length > 0) {
        textBlock("Data gaps", { size: 10.5, bold: true, gap: 3 });
        for (const gap of esgReport.data_gaps) textBlock(`•  ${String(gap)}`, { size: 9.5, gap: 3 });
        y -= 9;
      }
      textBlock("Summary", { size: 10.5, bold: true, gap: 3 });
      textBlock(String(esgReport.summary ?? ""), { size: 9.5, gap: 10 });
    } else {
      ensureSpace(76);
      y -= 6;
      drawPill(MARGIN, y, "STATUS: NOT AVAILABLE IN THIS EXPORT", "attention");
      y -= 30;
      textBlock("An ESG assessment could not be generated at the time of export. The assessment is therefore excluded from this report. This should not be interpreted as a negative finding, nor as confirmation that no ESG information exists for the organisation.", { size: 9.5, gap: 9 });
      textBlock("Basis: self-reported organisational inputs.", { size: 8.5, italic: true, color: inkSoft });
    }
    y -= 30;

    forcePageBreak();
    sectionHeading("07", "Document Integrity & Verification");
    drawKeyValueTable([
      { label: "Process Reference ID", value: exportId },
      { label: "Integrity Verification", value: "SHA-256 checksum computed at generation and stored in Impact Natives' compliance records under this reference ID. Compare the checksum against that record to confirm this file has not been altered since generation." },
    ], 160, 9.5);
    y -= 30;

    const clsLines = [
      { t: "Impact Natives Compliance Suite · Audit-Ready Due Diligence Export", s: 9.5, b: true, c: ink },
      { t: "Information basis: Self-reported organisational information unless explicitly stated otherwise.", s: 8.5, b: false, c: ink },
      { t: "Assessment basis: DD readiness completion and disclosed compliance information.", s: 8.5, b: false, c: ink },
      { t: `Export date: ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`, s: 8.5, b: false, c: ink },
      { t: `Process reference: ${exportId}`, s: 8.5, b: false, c: ink },
    ];
    const clsImportant = wrapLines("Important: this report is a point-in-time due diligence record. It does not constitute an independent audit, legal opinion, financial audit, credit assessment, or comprehensive risk assessment.", 8.5, fontItalic, CONTENT_W - 36);
    const clsH = 30 + clsLines.length * 13.5 + 8 + clsImportant.length * 11.5 + 16;
    ensureSpace(clsH + 6);
    const cTop = y;
    page.drawRectangle({ x: MARGIN, y: cTop - clsH, width: CONTENT_W, height: clsH, color: panel, borderColor: border, borderWidth: 1 });
    page.drawText("REPORT CLASSIFICATION", { x: MARGIN + 18, y: cTop - 20, size: 8, font: fontBold, color: green });
    let cY = cTop - 38;
    clsLines.forEach((l) => { page.drawText(l.t, { x: MARGIN + 18, y: cY, size: l.s, font: l.b ? fontBold : font, color: l.c }); cY -= 13.5; });
    cY -= 6;
    clsImportant.forEach((line) => { page.drawText(line, { x: MARGIN + 18, y: cY, size: 8.5, font: fontItalic, color: inkSoft }); cY -= 11.5; });
    y = cTop - clsH;

    const pdfBytes = await pdf.save();
    const pdfHash = await sha256Hex(pdfBytes);
    const pdfPath = `${exportId}/report.pdf`;

    const { error: uploadErr } = await svc.storage.from("dd-exports").upload(pdfPath, pdfBytes, {
      contentType: "application/pdf",
      upsert: false,
    });
    if (uploadErr) throw new Error(`PDF upload failed: ${uploadErr.message}`);

    const { data: signedUrlData } = await svc.storage.from("dd-exports").createSignedUrl(pdfPath, 60 * 60);

    await svc.from("dd_export_requests").update({
      status: "complete",
      pdf_file_path: pdfPath,
      pdf_hash: pdfHash,
      completed_at: new Date().toISOString(),
    }).eq("id", exportId);

    const { data: subjectOwner } = await svc.from("organizations").select("user_id").eq("id", subjectOrgId).maybeSingle();
    if (subjectOwner?.user_id) {
      await svc.from("notifications").insert({
        user_id: subjectOwner.user_id,
        type: "dd_export",
        title: "Your DD file was exported",
        body: `${exporterOrg.organisation_name} exported an audit-ready DD file for your organisation.`,
        metadata: { export_id: exportId, exporter_org_id: exporterOrg.id, exporter_org_name: exporterOrg.organisation_name },
      });
    }
    const { error: activityLogErr } = await svc.from("org_activity_log").insert({
      org_id: subjectOrgId,
      actor_id: user.id,
      verb: "dd_export_generated",
      target_table: "dd_export_requests",
      target_id: exportId,
      detail: `DD file exported by ${exporterOrg.organisation_name}`,
    });
    if (activityLogErr) console.error("[generate-dd-export] org_activity_log insert failed", { error: activityLogErr.message, code: activityLogErr.code });

    return new Response(JSON.stringify({
      data: {
        export_id: exportId,
        readiness_score: readinessScore,
        trust_tier: trustTier.tier,
        pdf_hash: pdfHash,
        download_url: signedUrlData?.signedUrl ?? null,
      },
    }), { status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });

  } catch (err) {
    await svc.from("dd_export_requests").update({
      status: "failed",
      error_message: String(err),
    }).eq("id", exportId);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
});
