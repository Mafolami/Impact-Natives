import sanitizeHtml from "npm:sanitize-html@2.13.0";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") ?? "";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GAPS_DELIMITER = "===GAPS===";
const MAX_RATE_LIMIT_RETRIES = 2;
const MAX_BACKOFF_SECONDS = 15;
const GENERIC_ERROR_BACKOFF_SECONDS = 3;

const LEXICON_WATCHLIST = [
  "empower", "empowering", "empowered", "empowers",
  "innovative", "innovation-driven", "cutting-edge", "world-class",
  "state-of-the-art", "robust", "dynamic", "leverage", "synergy", "holistic",
  "foster", "stakeholders", "meaningful difference", "positive difference",
  "responsible business", "multi-faceted", "first-ever", "evidence-based",
  "best practice", "eliminate", "eradicate", "revolutionize", "disrupt",
  "unprecedented", "it is hoped that", "efforts will be made to",
];

const REQUIRED_SECTIONS = [
  "Executive Summary",
  "Problem Statement",
  "Proposed Solution",
  "Target Beneficiaries",
  "Expected Outcomes and Impact",
  "Monitoring and Evaluation",
  "Sustainability Plan",
  "Partnership Requirements",
  "Budget Overview",
  "Implementation Timeline",
  "Team and Track Record",
  "SDG Alignment",
] as const;

const LIST_COUNT_RULES: Record<string, { min: number; max: number }> = {
  "Expected Outcomes and Impact": { min: 4, max: 4 },
  "Monitoring and Evaluation": { min: 4, max: 4 },
  "Implementation Timeline": { min: 3, max: 4 },
};

function scanLexiconViolations(text: string): string[] {
  const lower = text.toLowerCase();
  return LEXICON_WATCHLIST.filter(term => lower.includes(term));
}

// Deterministic, zero-cost swaps for the most common offenders. Applied
// before any LLM call -- most lexicon violations are fixed by this alone.
const LEXICON_SUBSTITUTIONS: Record<string, string> = {
  "empowering": "enabling", "empowered": "enabled", "empowers": "enables", "empower": "enable",
  "innovative": "new", "innovation-driven": "new-approach", "cutting-edge": "advanced",
  "world-class": "high-standard", "state-of-the-art": "current", "robust": "strong",
  "dynamic": "adaptive", "leverage": "use", "synergy": "combined effect", "holistic": "comprehensive",
  "foster": "support", "multi-faceted": "wide-ranging", "first-ever": "first",
  "evidence-based": "data-informed", "eliminate": "reduce", "eradicate": "reduce",
  "revolutionize": "transform", "disrupt": "change", "unprecedented": "notable",
};

function applyLexiconSubstitutions(text: string): string {
  let out = text;
  for (const [term, replacement] of Object.entries(LEXICON_SUBSTITUTIONS)) {
    const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    out = out.replace(re, (match) =>
      match[0] === match[0].toUpperCase() ? replacement[0].toUpperCase() + replacement.slice(1) : replacement
    );
  }
  return out;
}

// For terms with no safe direct swap (phrases like "stakeholders",
// "meaningful difference"), patch just the containing sentence/list item
// with a small ~150-token call instead of regenerating the whole document.
async function patchLexiconSentence(text: string, term: string): Promise<string> {
  const blockRe = /<(p|li)>((?:(?!<\/\1>).)*)<\/\1>/gis;
  let match: RegExpExecArray | null;
  let target: { tag: string; inner: string; full: string } | null = null;
  while ((match = blockRe.exec(text)) !== null) {
    if (match[2].toLowerCase().includes(term.toLowerCase())) {
      target = { tag: match[1], inner: match[2], full: match[0] };
      break;
    }
  }
  if (!target) return text;

  const patchPrompt = `Rewrite this single sentence or list item so it no longer contains the word or phrase "${term}", keeping the exact same meaning, facts, and numbers, and roughly the same length. Return ONLY the replacement text, no tags, no preamble:\n\n${target.inner}`;

  try {
    const patched = await callGroq(patchPrompt, undefined, 150);
    if (!patched || patched.toLowerCase().includes(term.toLowerCase())) return text;
    return text.replace(target.full, `<${target.tag}>${patched.trim()}</${target.tag}>`);
  } catch (err) {
    console.warn("Lexicon patch call failed", { term, err: String(err) });
    return text;
  }
}

const KNOWN_EXAMPLE_PHRASES = [
  "80% of trained founders secure climate tech employment within 6 months",
  "active climate tech ventures among the cohort grow by 25%",
  "founders reporting improved climate tech competency reach 90%",
  "40% of participating smallholder farmers increase crop yields",
];

function scanExampleCopying(text: string): string[] {
  const lower = text.toLowerCase();
  return KNOWN_EXAMPLE_PHRASES.filter(phrase => lower.includes(phrase.toLowerCase()));
}

function stripCodeFences(text: string): string {
  let out = text.trim();
  if (out.startsWith("```")) {
    out = out.replace(/^```(?:html)?\s*/i, "").replace(/```\s*$/i, "").trim();
  }
  return out;
}

function sanitizeDescription(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ["h2", "h3", "p", "ul", "li", "strong"],
    allowedAttributes: {},
    disallowedTagsMode: "discard",
    exclusiveFilter: (frame) => frame.tag === "script" || frame.tag === "style",
  }).trim();
}

function sectionChunk(description: string, headings: string[], target: string): string {
  const start = description.indexOf(`<h2>${target}</h2>`);
  if (start === -1) return "";
  const idx = headings.indexOf(target);
  const nextHeading = headings[idx + 1];
  const end = nextHeading ? description.indexOf(`<h2>${nextHeading}</h2>`, start) : description.length;
  return description.slice(start, end);
}

function validateStructure(description: string): string[] {
  const problems: string[] = [];

  if (!/^<h2>/i.test(description)) problems.push("does not start with <h2>");
  if (/\[[A-Za-z][A-Za-z\s]{1,40}\]/.test(description)) problems.push("placeholder bracket text detected");

  const foundHeadings = [...description.matchAll(/<h2>(.*?)<\/h2>/gi)].map(m => m[1].trim());
  for (const section of REQUIRED_SECTIONS) {
    if (!foundHeadings.includes(section)) problems.push(`missing section: ${section}`);
  }
  if (foundHeadings.length !== REQUIRED_SECTIONS.length) {
    problems.push(`expected ${REQUIRED_SECTIONS.length} <h2> sections, found ${foundHeadings.length}`);
  }

  for (const [section, rule] of Object.entries(LIST_COUNT_RULES)) {
    const chunk = sectionChunk(description, foundHeadings, section);
    if (!chunk) continue;
    const liCount = (chunk.match(/<li>/gi) || []).length;
    if (liCount < rule.min || liCount > rule.max) {
      problems.push(`${section}: expected ${rule.min === rule.max ? rule.min : `${rule.min}-${rule.max}`} <li> items, found ${liCount}`);
    }
  }

  const lexiconHits = scanLexiconViolations(description);
  if (lexiconHits.length > 0) {
    problems.push(`banned words used despite the absolute ban: ${lexiconHits.join(", ")} — rephrase the underlying meaning without these words`);
  }

  const outcomesChunk = sectionChunk(description, foundHeadings, "Expected Outcomes and Impact");
  if (outcomesChunk && /\bwill\b/i.test(outcomesChunk)) {
    problems.push(`"Expected Outcomes and Impact" uses future tense ("will") — outcomes must be phrased in the present tense as a standing target statement, not a promise`);
  }
  if (outcomesChunk && !/\d/.test(outcomesChunk)) {
    problems.push(`"Expected Outcomes and Impact" contains no numbers or percentages at all — every outcome must be quantified (who, how much, by when)`);
  }
  const copiedPhrases = scanExampleCopying(description);
  if (copiedPhrases.length > 0) {
    problems.push(`Reused example phrasing verbatim instead of writing original content: ${copiedPhrases.join("; ")} — write entirely new sentences specific to this initiative`);
  }

  if (!/>\s*$/.test(description.trim())) {
    problems.push("output ends with trailing plain text outside HTML tags — likely leaked gaps content or commentary after the note");
  }

  return problems;
}

function extractHeadings(description: string): string[] {
  return [...description.matchAll(/<h2>(.*?)<\/h2>/gi)].map(m => m[1].trim());
}

function validateGivenFiguresPreserved(description: string, form: Record<string, any>): string[] {
  const problems: string[] = [];
  const headings = extractHeadings(description);
  const relevantSections = ["Target Beneficiaries", "Expected Outcomes and Impact", "Implementation Timeline"];
  const scopedChunks = relevantSections.map(s => sectionChunk(description, headings, s)).join("\n");
  const searchText = scopedChunks.trim() ? scopedChunks : description;
  const normalizedSearchText = searchText.replace(/,/g, "");

  const numericChecks: Array<{ value: unknown; label: string }> = [
    { value: form.targetBeneficiaries, label: "target beneficiaries" },
    { value: form.targetJobs, label: "target jobs/ventures" },
    { value: form.targetTimelineMonths, label: "target timeline (months)" },
  ];

  for (const { value, label } of numericChecks) {
    if (value == null || value === "") continue;
    const asString = String(value).replace(/,/g, "");
    if (!normalizedSearchText.includes(asString)) {
      problems.push(
        `The settled ${label} value is ${asString} (already decided by the earlier parsing step), but this exact number is missing from where it should appear (Target Beneficiaries / Expected Outcomes and Impact / Implementation Timeline) — it must be used as-is (commas for readability are fine, e.g. "5,000", but the digits must match), not replaced with a re-inferred or profile-derived number. Fix by using exactly ${asString} in those sections.`
      );
    }
  }

  if (form.targetFemalePct != null && form.targetFemalePct !== "") {
    const pct = String(form.targetFemalePct).replace(/,/g, "");
    const pctPattern = new RegExp(`${pct}\\s*%`);
    if (!pctPattern.test(normalizedSearchText)) {
      problems.push(
        `The settled female beneficiaries target is ${pct}% (already decided by the earlier parsing step), but this exact figure is missing from where it should appear. Fix by using exactly ${pct}% in those sections.`
      );
    }
  }

  return problems;
}

function validateBudgetPreserved(description: string, form: Record<string, any>): string[] {
  const problems: string[] = [];
  const min = form.budgetMin;
  const max = form.budgetMax;
  if ((min == null || min === "") && (max == null || max === "")) return problems;

  const headings = extractHeadings(description);
  const budgetChunk = sectionChunk(description, headings, "Budget Overview");
  const searchText = (budgetChunk.trim() ? budgetChunk : description).replace(/,/g, "");

  const missing: string[] = [];
  if (min != null && min !== "") {
    const minStr = String(min).replace(/,/g, "");
    if (!searchText.includes(minStr)) missing.push(`minimum ${minStr}`);
  }
  if (max != null && max !== "") {
    const maxStr = String(max).replace(/,/g, "");
    if (!searchText.includes(maxStr)) missing.push(`maximum ${maxStr}`);
  }

  if (missing.length > 0) {
    problems.push(
      `The settled budget range is ${min ?? "?"}–${max ?? "?"} (already decided, not a range to collapse into a single figure) — Budget Overview is missing the ${missing.join(" and ")}. State the range as given (e.g. "USD ${min}–${max}"), not a single midpoint number, and build the deployment breakdown around that range.`
    );
  }

  return problems;
}

function scanFabricatedTeamSpecifics(description: string): string[] {
  const problems: string[] = [];
  const headings = extractHeadings(description);
  const teamChunk = sectionChunk(description, headings, "Team and Track Record");
  if (!teamChunk) return problems;

  const yearsExperiencePattern = /\b\d+\s+years?\s+(of\s+)?(relevant\s+|prior\s+)?experience\b/i;
  if (yearsExperiencePattern.test(teamChunk)) {
    problems.push(
      `Team and Track Record states a specific number of years of experience for a role (e.g. "eight years"), but no individual team member data exists anywhere in the founder's input or the organisation profile — this reads as a fabricated specific credential, not a generic description. Describe experience qualitatively instead (e.g. "the programme lead brings substantial experience coordinating multi-country initiatives"), with no invented number.`
    );
  }

  const headcountPattern = /\b(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+(senior\s+|junior\s+)?(analysts?|managers?|officers?|coordinators?|specialists?|engineers?|researchers?|technicians?)\b/i;
  if (headcountPattern.test(teamChunk)) {
    problems.push(
      `Team and Track Record specifies an exact headcount of a named role-type (e.g. "two senior analysts"), but no team roster exists anywhere in the founder's input or the organisation profile — this reads as a fabricated specific detail, not a generic team description. Describe the team qualitatively (e.g. "a small analytical team") without inventing specific headcounts.`
    );
  }

  return problems;
}

function scanUngroundedDeliveryClaims(description: string, profile: Record<string, any> | undefined): string[] {
  const problems: string[] = [];
  const headings = extractHeadings(description);
  const teamChunk = sectionChunk(description, headings, "Team and Track Record");
  if (!teamChunk) return problems;

  const deliveryClaimPattern = /\bhas\s+(previously\s+|successfully\s+)?delivered\b|\btrack\s+record\s+of\s+delivering\b|\bdemonstrat(?:ed|ing)\s+capacity\s+to\b|\bsuccessfully\s+implemented\b/i;
  if (!deliveryClaimPattern.test(teamChunk)) return problems;

  const hasRealTrackRecord = Boolean(
    profile?.description ||
    profile?.previous_funders?.length ||
    profile?.grants_received_count != null ||
    profile?.third_party_evaluations
  );

  if (!hasRealTrackRecord) {
    problems.push(
      `Team and Track Record makes a specific delivery claim (e.g. "has previously delivered X across multiple countries"), but the organisation profile has no real track-record data on file (no description, funders, grants, or evaluations) to support it — a bare sector tag alone is not sufficient grounding for a specific delivery narrative. Remove the claim, or rephrase without asserting specific past deliveries.`
    );
  }

  return problems;
}

function scanUngroundedSectorClaims(description: string, profile: Record<string, any> | undefined): string[] {
  const problems: string[] = [];
  const headings = extractHeadings(description);
  const teamChunk = sectionChunk(description, headings, "Team and Track Record");
  if (!teamChunk) return problems;

  const namedIndividualPattern = /(?:lead|director|manager|officer|coordinator|founder)\s*[–\-—:]\s*[A-Z][a-z]+\s+[A-Z][a-z]+/;
  if (namedIndividualPattern.test(teamChunk)) {
    problems.push(
      `Team and Track Record names a specific individual (a person's full name) — this section must never name a person, regardless of whether profile data was given. Rewrite this generically (e.g. "the programme lead brings relevant experience") without any person's name.`
    );
  }

  const hasRealProfileData = Boolean(
    profile &&
    Object.keys(profile).length > 0 &&
    (profile.organisation_name || profile.description || profile.sector ||
     profile.years_of_operation != null || profile.total_beneficiaries_reached != null ||
     profile.jobs_created != null || profile.grants_received_count != null ||
     profile.previous_funders?.length)
  );

  if (!hasRealProfileData) {
    const namedOrgPattern = /\b(?:for|at|with)\s+([A-Z][a-zA-Z]{2,})\b/g;
    const orgMatches = [...teamChunk.matchAll(namedOrgPattern)].map(m => m[1]);
    const knownSafeWords = new Set(["Kenya", "Nigeria", "Ghana", "Africa", "SDG"]);
    const suspiciousOrgs = orgMatches.filter(w => !knownSafeWords.has(w));
    if (suspiciousOrgs.length > 0) {
      problems.push(
        `Team and Track Record names a specific prior employer or organisation (e.g. "${suspiciousOrgs[0]}"), but NO profile data was given at all — this is a fabricated credential. Remove the named organisation and describe experience generically instead.`
      );
    }
  } else if (profile?.organisation_name) {
    const ownName = String(profile.organisation_name);
    const namedOrgPattern = /\b(?:for|at|with)\s+([A-Z][a-zA-Z]{2,}(?:\s+[A-Z][a-zA-Z]{2,})?)\b/g;
    const orgMatches = [...teamChunk.matchAll(namedOrgPattern)].map(m => m[1]);
    const knownSafeWords = new Set(["Kenya", "Nigeria", "Ghana", "Africa", "SDG", ownName]);
    const priorFunders: string[] = Array.isArray(profile.previous_funders) ? profile.previous_funders : [];
    const suspiciousOrgs = orgMatches.filter(w => !knownSafeWords.has(w) && !priorFunders.includes(w));
    if (suspiciousOrgs.length > 0) {
      problems.push(
        `Team and Track Record names "${suspiciousOrgs[0]}", which is neither the submitting organisation's own name nor a listed previous funder — this may be a fabricated third-party credential. Only reference the organisation's own real name or its actual listed funders/partners.`
      );
    }
  }

  return problems;
}

function validateTimelineWithinDuration(description: string, form: Record<string, any>): string[] {
  const problems: string[] = [];
  const durationMonths = form.targetTimelineMonths ? Number(form.targetTimelineMonths) : null;
  if (!durationMonths || Number.isNaN(durationMonths)) return problems;

  const headings = extractHeadings(description);
  const timelineChunk = sectionChunk(description, headings, "Implementation Timeline");
  if (!timelineChunk) return problems;

  const monthMatches = [...timelineChunk.matchAll(/months?\s*(\d+)(?:\s*[-–—‑]\s*(\d+))?/gi)];
  const monthNumbers = monthMatches
    .flatMap(m => [m[1] ? parseInt(m[1], 10) : null, m[2] ? parseInt(m[2], 10) : null])
    .filter((n): n is number => n != null);
  const maxMonth = monthNumbers.length ? Math.max(...monthNumbers) : 0;

  if (maxMonth > durationMonths) {
    problems.push(
      `Implementation Timeline references Month ${maxMonth}, which exceeds the settled duration of ${durationMonths} months. The Implementation Timeline itself must never exceed the settled duration — the Partnership Requirements exception does not apply here. If you want to mention post-program monitoring or reporting, describe it in prose as happening after program completion, without assigning it a new numbered phase beyond Month ${durationMonths}.`
    );
  }

  return problems;
}

function buildBudgetLine(form: Record<string, unknown>): string {
  const min = form.budgetMin as string | number | null | undefined;
  const max = form.budgetMax as string | number | null | undefined;
  const currency = (form.currency as string) ?? "";
  if (min != null && max != null) return `${currency} ${min}–${max}`;
  if (min != null) return `${currency} ${min} (minimum only, no maximum specified)`;
  if (max != null) return `${currency} up to ${max}`;
  return "Not given by founder — infer a plausible range for this sector, geography, and stage";
}

function buildProfileContext(profile: Record<string, any> | undefined): string {
  if (!profile || Object.keys(profile).length === 0) {
    return "No organisation track record on file for this submitter. Infer a plausible, generic team composition for the Team and Track Record section rather than inventing specific named credentials.";
  }

  const lines: string[] = [];
  if (profile.organisation_name) lines.push(`Organisation: ${profile.organisation_name}`);
  if (profile.description) lines.push(`Organisation description: ${profile.description}`);
  if (Array.isArray(profile.sector) ? profile.sector.length : profile.sector) {
    const sectorText = Array.isArray(profile.sector) ? profile.sector.join(", ") : profile.sector;
    lines.push(`Sector: ${sectorText}`);
  }
  if (profile.years_of_operation != null) lines.push(`Years of operation: ${profile.years_of_operation}`);
  if (profile.total_beneficiaries_reached != null) lines.push(`Total beneficiaries reached to date: ${profile.total_beneficiaries_reached}`);
  if (profile.jobs_created != null) lines.push(`Jobs created to date: ${profile.jobs_created}`);
  if (profile.grants_received_count != null) lines.push(`Grants received: ${profile.grants_received_count}`);
  if (profile.grants_total_value_usd != null) lines.push(`Total grant value received (USD): ${profile.grants_total_value_usd}`);
  if (profile.grants_delivered_on_time_pct != null) lines.push(`Grants delivered on time: ${profile.grants_delivered_on_time_pct}%`);
  if (profile.previous_funders?.length) lines.push(`Previous funders: ${profile.previous_funders.join(", ")}`);
  if (profile.third_party_evaluations != null) lines.push(`Independently evaluated: ${profile.third_party_evaluations ? "Yes" : "No"}`);

  if (lines.length === 0) {
    return "No organisation track record on file for this submitter. Infer a plausible, generic team composition for the Team and Track Record section rather than inventing specific named credentials.";
  }

  return `This is REAL, database-verified information about the submitting organisation's PAST, CUMULATIVE track record — it describes what the organisation has done historically, across all its work to date. It is NOT this initiative's own targets. Use it directly and accurately in the Team and Track Record section (and elsewhere if relevant) — do not embellish beyond it, and do not invent additional named individuals, credentials, or achievements not listed here. A single sector tag alone does NOT justify a specific delivery claim (e.g. "has delivered X sector solutions across Y countries") — only make such a claim if the description, funders, grants, or evaluations fields above actually support it. Do not let any number here (e.g. total beneficiaries reached to date, jobs created to date) replace or blend with the separate "Target metrics" figures given later for THIS initiative — those are a different, forward-looking set of numbers and always take precedence for this initiative's own sections:\n${lines.join("\n")}`;
}

function buildPrompt(form: Record<string, any>, profile: Record<string, any> | undefined): string {
  const PARTNERSHIP_LABELS: Record<string, string> = {
    funding: "Funding", technical: "Technical", operational: "Operational",
    leadership: "Leadership", strategic: "Strategic", lead: "Project Lead",
  };

  return `You are a senior grant writer and M&E specialist. The founder gave only a few short inputs — help them think and decide faster with a confident, decisive, expert-authored DRAFT they'll review before publishing, not a hedged fact-only summary. Funders and partners will read this.

FORMAT: Return ONLY HTML using exactly <h2> <h3> <p> <ul> <li> <strong> — no markdown, code fences, or preamble. All 12 sections below appear exactly once, in order, with the exact heading text shown. No bracket placeholders like [Name] — write real, specific content, inferred if needed. When writing any percentage, use a plain number immediately followed by "%" with no space (e.g. "65%"), never a space or non-breaking space before the percent sign.

CONTENT RULES:
- Never hedge. If a figure, timeframe, or budget wasn't given, infer a plausible SMART one confidently — never "to be confirmed/determined/established."
- PRECEDENCE, absolute: (1) every figure in the Target metrics block below, AND the Budget range, is already SETTLED — whether the founder typed it directly or the earlier parsing step reasoned it out to fit the initiative's direction, it is final by the time it reaches you. Use it exactly, everywhere it applies (Executive Summary, Target Beneficiaries, Expected Outcomes and Impact, Budget Overview, Implementation Timeline). Never re-infer it, never replace it, and never blend it with the organisation profile's historical totals (those describe the org's past, not this initiative). If a budget MIN and MAX are both given, Budget Overview must state BOTH figures as the range (e.g. "USD 80,000–150,000") — never collapse a range into one single midpoint or rounded figure; the range itself, not an average of it, is the settled fact. (2) Only for details with no Target metrics entry (or no budget) at all may the organisation profile inform an inference. (3) Only where neither gives anything, infer your own plausible SMART figure.
- Duration exception, narrow: ONLY in Partnership Requirements may a partner's commitment run slightly longer than the founder's stated duration (partner engagement sometimes continues past the pilot's end) — the initiative's OWN duration everywhere else (Executive Summary, Implementation Timeline, Expected Outcomes and Impact, Target metrics) must exactly match the founder-given timeline when one was given. Implementation Timeline in particular must never add a phase numbered beyond that duration (e.g. no "post-program monitoring" phase with its own Month range past the end) — if monitoring continues afterward, say so in prose without giving it a numbered phase.
- Team and Track Record must NEVER name an individual person, and must NEVER state a specific number of years of experience or a specific headcount for any role (e.g. never "eight years," never "two senior analysts") — the organisation profile never contains individual staff tenure or headcount data, so any such number is fabricated, not inferred. Describe roles and capability qualitatively instead (e.g. "the programme lead brings substantial experience coordinating multi-country initiatives," "a small dedicated analytical team"). If real profile data is given, use it accurately for the ORGANISATION's own track record (its real name, history, achievements, funders) — don't invent additions, don't name any other organisation not listed as a real funder/partner, and don't assert a specific delivery claim ("has delivered X across Y countries") unless the profile's actual description, funders, grants, or evaluations genuinely support it — a bare sector tag alone is never enough grounding for that. If no profile data is given, describe a plausible but FULLY GENERIC team (roles, qualitative capability, no numbers) without naming any specific prior employer, credential, sector history, or delivery claim that wasn't actually provided.
- Problem Statement and Proposed Solution must be SMART: a real number, tied to the timeframe — never generic aspirational language.

EXPECTED OUTCOMES AND IMPACT — stricter standard, this section only:
4 items, present tense only (never "will," never past tense like "trained/launched/increased" — still a concept, nothing has happened yet). Outcomes only, never outputs: a headcount ("50 trained," "40 launched") is an output — put it in Monitoring & Evaluation or the Timeline instead. Every item states WHO changes + HOW MUCH (a number/%) + BY WHEN — a bare verb like "capacity increases" with nothing attached isn't measurable. State the resulting change, not the activity ("training provided to X" is wrong; "X% of trained founders secure employment within 6 months" is right).
Pattern: [%/number] of [subgroup] [present-tense verb] [result] within [timeframe].
Style reference only, unrelated sector so you can't copy it — translate the structure, not the words: "40% of participating smallholder farmers increase crop yields by at least 20% within one growing season." Write 4 fully original sentences for this initiative's actual sectors and population.

LANGUAGE — absolute, no exceptions, even if the founder's own text uses these words; rephrase the meaning instead: empower(ing/ed/s), innovative, cutting-edge, world-class, state-of-the-art, robust, dynamic, leverage, synergy, holistic, foster, stakeholders, meaningful/positive difference, responsible business, multi-faceted, first-ever, evidence-based, best practice (uncited), eliminate, eradicate, revolutionize, disrupt, unprecedented, "it is hoped that," "efforts will be made to," "whether...or." Before you finish, reread every sentence you wrote and confirm none of these words appear — if one slipped in, rewrite that sentence, don't just delete the word.

SECTIONS (word limit in parentheses):
<h2>Executive Summary</h2> (60w) — what/where/why a partner should care, SMART.
<h2>Problem Statement</h2> (120w) — the specific gap, with a number. Don't restate the summary.
<h2>Proposed Solution</h2> (150w) — approach + what's distinct.
<h2>Target Beneficiaries</h2> (80w) — numbers, demographics, geography; infer if not given.
<h2>Expected Outcomes and Impact</h2> — 4 items, see stricter standard above.
<h2>Monitoring and Evaluation</h2> — 4 items: indicators, collection method, reporting frequency, data management — your own specific proposal.
<h2>Sustainability Plan</h2> (100w) — your own proposal for continuation beyond funding; revenue model if applicable.
<h2>Partnership Requirements</h2> (100w) — role, contribution, time commitment.
<h2>Budget Overview</h2> (80w) — state the full given range exactly (both min and max), then a deployment breakdown; infer a range only if none was given.
<h2>Implementation Timeline</h2> — 3-4 phases with durations/milestones, your own proposal.
<h2>Team and Track Record</h2> (80w) — leader + qualitative experience, no invented numbers; use real profile data below if given, else infer a plausible generic team.
<h2>SDG Alignment</h2> — only SDGs directly supported by the input, one line each, framed as contribution not attribution.

---

Submitter organisation profile context:
${buildProfileContext(profile)}

---

Initiative details:
Title: ${form.title}
Problem: ${form.problem}
Outcome: ${form.outcome}
Who it serves: ${form.targetPopulation || "Not given — infer"}
Sectors: ${form.sectors?.join(", ") || "Not specified"}
Locations: ${form.locations?.join(", ") || "Not specified"}
Stage: ${form.stage || "Not specified"}
Partnerships sought: ${form.partnerships?.map((p: string) => PARTNERSHIP_LABELS[p] ?? p).join(", ") || "Not specified"}
Specific ask: ${form.specificAsk || "Not given — infer"}
Prior experience: ${form.hadPriorExperience === true ? "Yes" : form.hadPriorExperience === false ? "No" : "Not specified"}
${form.priorExperienceDetail ? `Prior experience detail: ${form.priorExperienceDetail}` : ""}
Budget: ${buildBudgetLine(form)}
Duration: ${form.duration || "Not given — infer a standard duration for this type of programme"}
SDGs: ${form.sdgTags?.join(", ") || "Not specified"}
ESG: ${form.esg === true ? "Open to corporate ESG/CSR adoption" : "Not seeking ESG alignment"}
Impact evidence: ${form.impactEvidence || "Not provided"}
Target metrics:
- Target beneficiaries to reach: ${form.targetBeneficiaries || "Not given — infer"}
- Jobs to be created: ${form.targetJobs || "Not given — infer if relevant to this initiative"}
- Female beneficiaries target: ${form.targetFemalePct ? form.targetFemalePct + "%" : "Not given — infer a reasonable target"}
- Target timeline: ${form.targetTimelineMonths ? form.targetTimelineMonths + " months" : "Not given — infer"}

---

AFTER the full HTML concept note, output the exact line ${GAPS_DELIMITER} on its own line, then a short PLAIN TEXT (no HTML tags) list of every figure, timeframe, or detail you INFERRED rather than were given directly — so the founder knows exactly what to verify or correct before publishing. This section is private and will not be shown to funders. Keep it brief. If nothing was inferred, write "No inferences made — all figures came from founder input." after the delimiter.`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractRetrySeconds(status: number, headerValue: string | null, bodyText: string): number {
  if (status === 429) {
    if (headerValue) {
      const parsed = parseFloat(headerValue);
      if (!isNaN(parsed)) return Math.min(parsed, MAX_BACKOFF_SECONDS);
    }
    const match = bodyText.match(/try again in ([\d.]+)s/i);
    if (match) return Math.min(parseFloat(match[1]), MAX_BACKOFF_SECONDS);
    return MAX_BACKOFF_SECONDS;
  }
  return GENERIC_ERROR_BACKOFF_SECONDS;
}

class GroqCallError extends Error {
  status?: number;
  body?: string;
  constructor(message: string, status?: number, body?: string) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function callGroq(prompt: string, repairNote?: string, maxTokens = 4500): Promise<string> {
  const messages = repairNote
    ? [
        { role: "user", content: prompt },
        {
          role: "user",
          content: `Your previous response had these problems: ${repairNote}. Regenerate the FULL concept note from scratch, fixing these issues, and follow ALL rules exactly — especially the absolute language ban (rephrase, never just substitute a synonym that's also banned) and the 12-section structure.`,
        },
      ]
    : [{ role: "user", content: prompt }];

  let lastStatus: number | undefined;
  let lastBody: string | undefined;

  for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt++) {
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        max_completion_tokens: maxTokens,
        temperature: 0.4,
        top_p: 1,
        reasoning_effort: "low",
        stream: false,
        messages,
      }),
    });

    if (groqRes.ok) {
      const data = await groqRes.json();
      return data.choices?.[0]?.message?.content?.trim() ?? "";
    }

    const errBody = await groqRes.text();
    lastStatus = groqRes.status;
    lastBody = errBody;
    console.error("Groq API error", {
      attempt: attempt + 1,
      totalAttempts: MAX_RATE_LIMIT_RETRIES + 1,
      status: groqRes.status,
      remainingTokens: groqRes.headers.get("x-ratelimit-remaining-tokens"),
      remainingRequests: groqRes.headers.get("x-ratelimit-remaining-requests"),
      retryAfter: groqRes.headers.get("retry-after"),
      body: errBody,
    });

    const isRetryable = groqRes.status === 429 || groqRes.status >= 500;
    if (isRetryable && attempt < MAX_RATE_LIMIT_RETRIES) {
      const waitSeconds = extractRetrySeconds(groqRes.status, groqRes.headers.get("retry-after"), errBody);
      await sleep(waitSeconds * 1000);
      continue;
    }

    throw new GroqCallError(`Groq API request failed with status ${groqRes.status}`, groqRes.status, errBody);
  }

  throw new GroqCallError("Groq API request failed after retries", lastStatus, lastBody);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  try {
    const { form, profile } = await req.json();
    const prompt = buildPrompt(form, profile);

    let description = "";
    let gaps = "";
    let lastProblems: string[] = [];
    let lastRawOutput = "";
    const MAX_ATTEMPTS = 3;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      let raw: string;
      try {
        raw = stripCodeFences(await callGroq(prompt, attempt === 0 ? undefined : lastProblems.join("; ")));
      } catch (err) {
        console.error("Groq call failed", { attempt, err: String(err) });
        const groqErr = err instanceof GroqCallError ? err : null;
        return new Response(JSON.stringify({
          error: "Groq API request failed",
          groq_status: groqErr?.status ?? null,
          groq_error_body: groqErr?.body ? groqErr.body.slice(0, 1000) : null,
        }), {
          status: 502, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        });
      }

      if (!raw) {
        lastProblems = ["empty response from model"];
        console.warn("Groq returned empty content", { attempt });
        continue;
      }

      const delimMatch = raw.match(/={2,}\s*GAPS\s*={2,}/i);
      const candidateDescription = (delimMatch ? raw.slice(0, delimMatch.index) : raw).trim();
      const candidateGaps = delimMatch ? raw.slice((delimMatch.index ?? 0) + delimMatch[0].length).trim() : "";

      if (!candidateDescription) {
        lastProblems = ["empty description after splitting on gaps delimiter"];
        console.warn("Empty description after split", { attempt, preview: raw.slice(0, 200) });
        continue;
      }

      const problems = [
        ...validateStructure(candidateDescription),
        ...validateGivenFiguresPreserved(candidateDescription, form),
        ...validateBudgetPreserved(candidateDescription, form),
        ...scanUngroundedSectorClaims(candidateDescription, profile),
        ...scanUngroundedDeliveryClaims(candidateDescription, profile),
        ...scanFabricatedTeamSpecifics(candidateDescription),
        ...validateTimelineWithinDuration(candidateDescription, form),
      ];
      if (problems.length > 0) {
        const lexiconProblem = problems.find(p => p.startsWith("banned words used"));
        if (lexiconProblem && problems.length === 1) {
          let patched = applyLexiconSubstitutions(candidateDescription);
          for (const term of scanLexiconViolations(patched)) {
            patched = await patchLexiconSentence(patched, term);
          }
          const patchedProblems = [
            ...validateStructure(patched),
            ...validateGivenFiguresPreserved(patched, form),
            ...validateBudgetPreserved(patched, form),
            ...scanUngroundedSectorClaims(patched, profile),
            ...scanUngroundedDeliveryClaims(patched, profile),
            ...scanFabricatedTeamSpecifics(patched),
            ...validateTimelineWithinDuration(patched, form),
          ];
          if (patchedProblems.length === 0) {
            description = sanitizeDescription(patched);
            gaps = candidateGaps;
            break;
          }
          lastProblems = patchedProblems;
          lastRawOutput = patched;
          console.warn("Lexicon patch attempt still failed validation", { attempt, patchedProblems });
          continue;
        }

        lastProblems = problems;
        lastRawOutput = candidateDescription;
        console.warn("Validation failed", { attempt, title: form?.title, problems, rawOutput: candidateDescription });
        continue;
      }

      description = sanitizeDescription(candidateDescription);
      gaps = candidateGaps;
      break;
    }

    if (!description) {
      console.error("All attempts failed validation", { title: form?.title, lastProblems });
      return new Response(JSON.stringify({
        error: "Malformed output from model",
        details: lastProblems,
        raw_output_preview: lastRawOutput.slice(0, 3000),
      }), {
        status: 422, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    if (gaps) {
      console.log("generate-initiative-description inferred figures", { title: form?.title, gaps });
    }

    return new Response(JSON.stringify({ description, gaps }), {
      status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  } catch (err) {
    console.error("Unhandled error in generate-initiative-description", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
});