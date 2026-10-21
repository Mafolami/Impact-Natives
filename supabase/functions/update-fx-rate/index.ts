// supabase/functions/update-fx-rate/index.ts
// Internal-only. Refreshes the Naira-per-dollar rate used to size NGN
// initiative budgets for proportional due diligence.
//
// v1 (Oct 2026). Called once a day by pg_cron (update-fx-rate-job).
// Source: ExchangeRate-API (official CBN/interbank mid-market rate, free
// plan, one call a day). Key in the EXCHANGERATE_API_KEY secret.
//
// Safety: the stored rate only changes when the new value is a sane number
// and has moved less than MAX_DAILY_MOVE_PCT from the stored one. Anything
// else keeps the last good rate and records last_error, so a bad API day
// never breaks matching. A manual override (source "manual_override")
// is never replaced automatically.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function __envKeys(name: string): Record<string, string> {
  try { return JSON.parse(Deno.env.get(name) ?? "{}"); } catch { return {}; }
}
const __SECRET_KEYS = Object.values(__envKeys("SUPABASE_SECRET_KEYS"));
const SECRET_KEY = __envKeys("SUPABASE_SECRET_KEYS")["default"] ?? __SECRET_KEYS[0] ?? "";
function isServerCall(req: Request): boolean {
  if (__SECRET_KEYS.length === 0) return false;
  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const apikey = req.headers.get("apikey") ?? "";
  return __SECRET_KEYS.includes(bearer) || __SECRET_KEYS.includes(apikey);
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const FX_API_KEY = Deno.env.get("EXCHANGERATE_API_KEY") ?? "";

const MIN_SANE_RATE = 100;
const MAX_SANE_RATE = 100_000;
const MAX_DAILY_MOVE_PCT = 15;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (!isServerCall(req)) return json({ error: "Forbidden" }, 403);

  const supabase = createClient(SUPABASE_URL, SECRET_KEY);
  const { data: row } = await supabase
    .from("matching_config").select("value").eq("key", "fx_ngn_per_usd").maybeSingle();
  const current = row?.value ?? {};
  const currentRate = Number(current.rate) > 0 ? Number(current.rate) : null;

  async function keepWithError(message: string, extra: Record<string, unknown> = {}) {
    console.error(`[update-fx-rate] ${message}`);
    await supabase.from("matching_config").upsert({
      key: "fx_ngn_per_usd",
      value: { ...current, last_error: message, last_attempt_at: new Date().toISOString(), ...extra },
      updated_at: new Date().toISOString(),
    });
    return json({ updated: false, rate: currentRate, error: message });
  }

  if (current.source === "manual_override") {
    return json({ updated: false, rate: currentRate, note: "manual override in place, not replaced" });
  }
  if (!FX_API_KEY) return keepWithError("EXCHANGERATE_API_KEY secret is not set");

  let fetched: number;
  try {
    const res = await fetch(`https://v6.exchangerate-api.com/v6/${FX_API_KEY}/pair/USD/NGN`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body?.result !== "success") {
      return keepWithError(`API call failed: HTTP ${res.status} ${body?.["error-type"] ?? ""}`.trim());
    }
    fetched = Number(body.conversion_rate);
  } catch (err) {
    return keepWithError(`API call threw: ${String(err)}`);
  }

  if (!(fetched >= MIN_SANE_RATE && fetched <= MAX_SANE_RATE)) {
    return keepWithError(`Rejected implausible rate ${fetched}`);
  }
  if (currentRate) {
    const movePct = Math.abs(fetched - currentRate) / currentRate * 100;
    if (movePct > MAX_DAILY_MOVE_PCT) {
      return keepWithError(`Rejected ${fetched}: moved ${movePct.toFixed(1)}% from ${currentRate} (limit ${MAX_DAILY_MOVE_PCT}%). Set it by hand if the move is genuine.`, { rejected_rate: fetched });
    }
  }

  const value = {
    rate: Math.round(fetched * 100) / 100,
    source: "exchangerate-api",
    fetched_at: new Date().toISOString(),
    last_error: null,
  };
  const { error } = await supabase.from("matching_config").upsert({
    key: "fx_ngn_per_usd", value, updated_at: new Date().toISOString(),
  });
  if (error) return json({ updated: false, error: error.message }, 500);
  return json({ updated: true, previous: currentRate, rate: value.rate });
});
