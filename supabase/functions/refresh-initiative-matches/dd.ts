// dd.ts -- proportional due diligence + support-type helpers.
// One copy of this file ships inside each matching function. Keep the
// copies identical (source of truth: build/shared/dd.ts).
//
// Oct 2026 rules (agreed with Michael):
// - The DD bar is set by the size of the DEAL, never the size of the org.
//   Partnerships: larger of the two listings' budget buckets. "open" takes
//   the other side's bucket; both open/unknown -> open_bucket (50k_200k).
//   in_kind_only counts as a named bucket (under_10k).
//   Initiatives: the initiative's own budget (NGN converted at the stored
//   rate, top of the range).
// - Mandatory at every size: legal registration, safeguarding policy,
//   legal compliance declaration. Items in doc_required only count when an
//   uploaded file exists in dd_evidence_documents under the same key.
// - DD never caps the fit score. It produces a status used for labels and
//   for ranking (complete/exempt first, then tier_missing, then
//   basics_incomplete; fit score orders within each tier).
// - Consultancies are exempt. Funders/corporates keep the 6-item fdd set.

export const FUNDER_TYPES = ["philanthropic_foundation", "venture_capital"];
export const CORPORATE_TYPES = ["corporation", "technology_company", "public_sector"];

export const DD_ITEM_KEYS = [
  "financial_model", "audited_accounts", "governance_doc", "esg_assessment",
  "impact_framework", "environmental_policy", "safeguarding_policy",
  "legal_registration", "legal_compliance_declaration",
];
export const FDD_ITEM_KEYS = [
  "disbursement_track_record", "decision_transparency", "conflict_disclosure",
  "governance_doc", "esg_framework", "legal_registration",
];
export const DD_ORG_COLUMNS = [
  ...DD_ITEM_KEYS.map((k) => `dd_${k}`),
  ...FDD_ITEM_KEYS.map((k) => `fdd_${k}`),
].join(", ");

export const BUDGET_ORDER = ["under_10k", "10k_50k", "50k_200k", "over_200k"];

export type DdStatus = "complete" | "exempt" | "tier_missing" | "basics_incomplete";
export const DD_RANK: Record<string, number> = {
  complete: 0, exempt: 0, tier_missing: 1, basics_incomplete: 2,
};
export function ddRank(status: string | null | undefined): number {
  return status && status in DD_RANK ? DD_RANK[status] : 2;
}

export interface DdTier { extras: string[]; pct_rule: boolean; pct_complete?: number }
export interface DdPolicy {
  mandatory: string[];
  doc_required: string[];
  open_bucket: string;
  in_kind_bucket: string;
  unknown_bucket: string;
  tiers: Record<string, DdTier>;
  fdd_pct_complete: number;
  fdd_pct_partial: number;
}

export const DEFAULT_DD_POLICY: DdPolicy = {
  mandatory: ["legal_registration", "safeguarding_policy", "legal_compliance_declaration"],
  doc_required: ["legal_registration", "safeguarding_policy", "governance_doc", "audited_accounts"],
  open_bucket: "50k_200k",
  in_kind_bucket: "under_10k",
  unknown_bucket: "50k_200k",
  tiers: {
    under_10k: { extras: [], pct_rule: false },
    "10k_50k": { extras: ["governance_doc"], pct_rule: false },
    "50k_200k": { extras: [], pct_rule: true, pct_complete: 60 },
    over_200k: { extras: [], pct_rule: true, pct_complete: 60 },
  },
  fdd_pct_complete: 60,
  fdd_pct_partial: 40,
};
export const DEFAULT_NGN_PER_USD = 1330;

export interface MatchingConfig { policy: DdPolicy; ngnPerUsd: number }

export async function loadMatchingConfig(client: any): Promise<MatchingConfig> {
  const { data, error } = await client
    .from("matching_config")
    .select("key, value")
    .in("key", ["dd_policy", "fx_ngn_per_usd"]);
  if (error) console.error(`[dd] matching_config read failed, using defaults: ${error.message}`);
  const byKey = new Map<string, any>((data ?? []).map((r: any) => [r.key, r.value]));
  const policy = { ...DEFAULT_DD_POLICY, ...(byKey.get("dd_policy") ?? {}) } as DdPolicy;
  const rate = Number(byKey.get("fx_ngn_per_usd")?.rate);
  return { policy, ngnPerUsd: rate > 0 ? rate : DEFAULT_NGN_PER_USD };
}

// ---------- Deal size ----------

function namedBucket(raw: string | null | undefined, policy: DdPolicy): string | null {
  if (!raw) return null;
  if (raw === "in_kind_only") return policy.in_kind_bucket;
  if (BUDGET_ORDER.includes(raw)) return raw;
  return null; // "open" or anything unrecognised
}

export function largerBucket(a: string, b: string): string {
  return BUDGET_ORDER.indexOf(a) >= BUDGET_ORDER.indexOf(b) ? a : b;
}

/** Partnership deal bucket from the two listings' budget values. */
export function partnershipDealBucket(a: string | null | undefined, b: string | null | undefined, policy: DdPolicy): string {
  const named = [namedBucket(a, policy), namedBucket(b, policy)].filter(Boolean) as string[];
  if (named.length === 2) return largerBucket(named[0], named[1]);
  if (named.length === 1) return named[0];
  return policy.open_bucket;
}

export function usdToBucket(usd: number, policy: DdPolicy): string {
  if (!(usd > 0)) return policy.in_kind_bucket;
  if (usd < 10_000) return "under_10k";
  if (usd <= 50_000) return "10k_50k";
  if (usd <= 200_000) return "50k_200k";
  return "over_200k";
}

function toUsd(amount: number, currency: string | null | undefined, ngnPerUsd: number): number | null {
  const c = (currency ?? "USD").toUpperCase();
  if (c === "USD") return amount;
  if (c === "NGN") return amount / ngnPerUsd;
  return null;
}

/** Pull the largest amount out of free-text budgets like "₦80M – ₦120M" or "$250,000". */
export function parseBudgetText(text: string, fallbackCurrency: string | null | undefined): { amount: number; currency: string } | null {
  const t = text.trim();
  if (!t) return null;
  const currency = /₦|\bNGN\b|#|naira/i.test(t) ? "NGN" : /\$|\bUSD\b/i.test(t) ? "USD" : (fallbackCurrency ?? "USD");
  const re = /(\d[\d,]*(?:\.\d+)?)\s*(k|m|bn|b)?\b/gi;
  let best: number | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t)) !== null) {
    let n = parseFloat(m[1].replace(/,/g, ""));
    if (isNaN(n)) continue;
    const suffix = (m[2] ?? "").toLowerCase();
    if (suffix === "k") n *= 1_000;
    else if (suffix === "m") n *= 1_000_000;
    else if (suffix === "b" || suffix === "bn") n *= 1_000_000_000;
    if (best === null || n > best) best = n;
  }
  return best === null ? null : { amount: best, currency };
}

/** Initiative deal bucket from its own budget fields. */
export function initiativeDealBucket(ini: any, policy: DdPolicy, ngnPerUsd: number): string {
  const min = ini.budget_min != null ? Number(ini.budget_min) : null;
  const max = ini.budget_max != null ? Number(ini.budget_max) : null;
  if (min != null || max != null) {
    const top = Math.max(min ?? 0, max ?? 0);
    if (top <= 0) return policy.in_kind_bucket;
    const usd = toUsd(top, ini.budget_currency, ngnPerUsd);
    return usd == null ? policy.unknown_bucket : usdToBucket(usd, policy);
  }
  if (typeof ini.budget === "string" && ini.budget.trim()) {
    if (/in[\s-]?kind|free pilot|\$\s?0\b/i.test(ini.budget)) return policy.in_kind_bucket;
    const parsed = parseBudgetText(ini.budget, ini.budget_currency);
    if (parsed) {
      const usd = toUsd(parsed.amount, parsed.currency, ngnPerUsd);
      if (usd != null) return usdToBucket(usd, policy);
    }
  }
  return policy.unknown_bucket;
}

// ---------- DD status ----------

export interface DdResult { status: DdStatus; missing: string[]; checklist: "dd" | "fdd" | "none" }

/** docKeys: dd_item_key values this org has at least one uploaded file for. */
export function ddStatusFor(org: any, docKeys: Set<string>, bucket: string, policy: DdPolicy): DdResult {
  const type = org?.organisation_type;
  if (type === "consultancy") return { status: "exempt", missing: [], checklist: "none" };

  if (FUNDER_TYPES.includes(type) || CORPORATE_TYPES.includes(type)) {
    const missing = FDD_ITEM_KEYS.filter((k) => !org[`fdd_${k}`]);
    const pct = Math.round(((FDD_ITEM_KEYS.length - missing.length) / FDD_ITEM_KEYS.length) * 100);
    const status: DdStatus = pct >= policy.fdd_pct_complete ? "complete"
      : pct >= policy.fdd_pct_partial ? "tier_missing" : "basics_incomplete";
    return { status, missing, checklist: "fdd" };
  }

  const has = (k: string) => !!org?.[`dd_${k}`] && (!policy.doc_required.includes(k) || docKeys.has(k));

  const missingMandatory = policy.mandatory.filter((k) => !has(k));
  if (missingMandatory.length > 0) return { status: "basics_incomplete", missing: missingMandatory, checklist: "dd" };

  const tier = policy.tiers[bucket] ?? policy.tiers[policy.unknown_bucket];
  if (tier?.pct_rule) {
    const missing = DD_ITEM_KEYS.filter((k) => !has(k));
    const pct = Math.round(((DD_ITEM_KEYS.length - missing.length) / DD_ITEM_KEYS.length) * 100);
    if (pct < (tier.pct_complete ?? 60)) return { status: "tier_missing", missing, checklist: "dd" };
    return { status: "complete", missing, checklist: "dd" };
  }
  const missingExtras = (tier?.extras ?? []).filter((k) => !has(k));
  if (missingExtras.length > 0) return { status: "tier_missing", missing: missingExtras, checklist: "dd" };
  return { status: "complete", missing: [], checklist: "dd" };
}

/** Map org id -> set of dd_item_key values that have an uploaded file. */
export async function loadDocKeys(client: any, orgIds: string[]): Promise<Map<string, Set<string>>> {
  const ids = [...new Set(orgIds.filter(Boolean))];
  const out = new Map<string, Set<string>>();
  if (ids.length === 0) return out;
  const { data, error } = await client
    .from("dd_evidence_documents")
    .select("organization_id, dd_item_key")
    .in("organization_id", ids);
  if (error) console.error(`[dd] dd_evidence_documents read failed: ${error.message}`);
  for (const r of data ?? []) {
    if (!out.has(r.organization_id)) out.set(r.organization_id, new Set());
    out.get(r.organization_id)!.add(String(r.dd_item_key).replace(/^f?dd_/, ""));
  }
  return out;
}

/** Org ids with at least one impact claim a partner confirmed on Natives. */
export async function loadDocumentedImpact(client: any, orgIds: string[]): Promise<Set<string>> {
  const ids = [...new Set(orgIds.filter(Boolean))];
  if (ids.length === 0) return new Set();
  const { data, error } = await client
    .from("impact_claims")
    .select("claiming_org_id")
    .eq("status", "confirmed")
    .in("claiming_org_id", ids);
  if (error) console.error(`[dd] impact_claims read failed: ${error.message}`);
  return new Set((data ?? []).map((r: any) => r.claiming_org_id));
}

/** Sort: DD tier first, then fit score. */
export function byTierThenScore(scoreKey: string) {
  return (a: any, b: any) => (ddRank(a.dd_status) - ddRank(b.dd_status)) || ((b[scoreKey] ?? 0) - (a[scoreKey] ?? 0));
}

// ---------- Support type ----------

export const SUPPORT_TYPES = ["funding", "technical", "operational", "leadership", "strategic", "lead", "research"];

function classifyOffer(text: string): string[] {
  const t = text.toLowerCase();
  const out: string[] = [];
  if (/cash|fund|grant|prize|award|donat|equity|debt|loan|invest|guarantee|blended|csr budget/.test(t)) out.push("funding");
  if (/techn|expert|skill|pro[\s-]?bono|advis|consult|training|capacity|assistance|digital|software|data/.test(t)) out.push("technical");
  if (/mentor|leadership|board|coaching|executive/.test(t)) out.push("leadership");
  if (/volunteer|employee|equipment|space|venue|supply|logistic|product|operation|distribution|in[\s-]?kind/.test(t)) out.push("operational");
  if (/market|visib|brand|co-?brand|network|advoca|media|introduc|strategic|partnership/.test(t)) out.push("strategic");
  if (/research|evaluat|study/.test(t)) out.push("research");
  return out;
}

/** What a funder can provide, from its funding_instruments. Funders fund by default. */
export function funderOfferTypes(mandate: any): Set<string> {
  const out = new Set<string>();
  for (const i of (Array.isArray(mandate?.funding_instruments) ? mandate.funding_instruments : [])) {
    for (const t of classifyOffer(String(i))) out.add(t);
  }
  out.add("funding");
  return out;
}

/** What a corporate can provide, from its in-kind list, flags and CSR budget. Empty set = unknown. */
export function corporateOfferTypes(mandate: any): Set<string> {
  const out = new Set<string>();
  for (const i of (Array.isArray(mandate?.inkind_support) ? mandate.inkind_support : [])) {
    for (const t of classifyOffer(String(i))) out.add(t);
  }
  if (mandate?.tech_support_available) out.add("technical");
  if (mandate?.employee_engagement_available) out.add("operational");
  if (mandate?.csr_budget_range) out.add("funding");
  return out;
}

/** match = overlap; partial = no overlap. null = not enough data to say. Never no_match. */
export function supportTypeFit(asks: unknown, offers: Set<string>): "match" | "partial" | null {
  const a = (Array.isArray(asks) ? asks : []).map((x) => String(x).toLowerCase());
  if (a.length === 0 || offers.size === 0) return null;
  return a.some((x) => offers.has(x)) ? "match" : "partial";
}

export function supportTypesLabel(asks: unknown): string {
  const a = Array.isArray(asks) ? asks.filter(Boolean) : [];
  return a.length ? a.join(", ") : "Not specified";
}
