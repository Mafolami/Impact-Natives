/**
 * Normalizes a value that may be a JS array, a JSON array string ["a","b"],
 * or a Postgres array literal {a,b,"c d"} into a plain string array.
 */
export function normalizeArr(val: string | string[] | null | undefined): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === "string" && val.startsWith("{") && val.endsWith("}")) {
    const inner = val.slice(1, -1);
    const matches = inner.match(/("(?:[^"\\]|\\.)*"|[^,]+)/g) ?? [];
    return matches.map(m => m.replace(/^"|"$/g, "").trim()).filter(Boolean);
  }
  try {
    const p = JSON.parse(val);
    return Array.isArray(p) ? p : [val];
  } catch {
    return [val];
  }
}
