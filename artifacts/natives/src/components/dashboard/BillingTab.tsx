// ─── BillingTab.tsx ─────────────────────────────────────────────────────────
// Billing surface for DashboardSettings' "Billing" tab. Same role pattern as
// TeamTab: an Owner sees full plan management, a Member of someone else's
// org sees a read-only summary of what their org is on, and someone with no
// org sees a short explainer.
//
// Pricing is fixed NGN (see paystack-initialize's PRICING_NGN_KOBO -- kept
// in sync manually, there's no shared config file for this yet). No true
// recurring billing exists: a purchase is a single Paystack transaction
// that buys 30 days, tracked via subscription_current_period_end. There is
// deliberately no "cancel" action here -- there's nothing recurring to
// cancel. An org simply reverts to Free automatically (via the
// downgrade-expired-subscriptions cron) if it isn't renewed by manually
// checking out again before the period ends.
//
// v2: full feature lists per tier (not trimmed -- this page's job is to
// make the value case, so it shouldn't undersell itself), a visually
// distinct treatment per tier (Plus elevated as the default recommendation,
// Compliance in a dark "audit-grade" register, Free deliberately quiet),
// and a real fix for the post-checkout flash: the payment-confirmation
// poll used to call the same load() that resets role to "loading" on every
// tick, so the whole tab blinked to a spinner and back up to 6 times over
// 15 seconds. It now polls silently and only ever moves forward once real
// data is in -- no visible state flicker.

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { Loader2, Check, Sparkles } from "lucide-react";

type Role = "loading" | "owner" | "member" | "none";
type Tier = "free" | "plus" | "pro" | "compliance";
type SubStatus = "inactive" | "active" | "past_due" | "canceled";

interface OrgBilling {
  id: string;
  organisation_name: string;
  organisation_type: string | null;
  subscription_tier: Tier;
  subscription_status: SubStatus;
  subscription_current_period_end: string | null;
}

const CORPORATE_TYPES = ["corporation", "technology_company", "public_sector"];

interface TierDef {
  value: Tier;
  name: string;
  priceNgn: number;
  priceUsdRef: number;
  blurb: string;
  features: string[];
  badge?: string;
  register: "quiet" | "primary" | "accent" | "dark";
}

const TIERS: TierDef[] = [
  {
    value: "free",
    name: "Free",
    priceNgn: 0,
    priceUsdRef: 0,
    blurb: "Everything you need to get listed and start matching.",
    register: "quiet",
    features: [
      "Browse the full directory & marketplace",
      "Manual initiative & partnership listings",
      "Self-attested DD readiness",
      "Trust Score & verified badge",
      "Reply to inbound messages",
      "Receive & sign MoUs",
      "Milestone tracking on signed MoUs",
      "Weekly & monthly digest emails",
    ],
  },
  {
    value: "plus",
    name: "Plus",
    priceNgn: 80_000,
    priceUsdRef: 59,
    blurb: "Let AI do the matching, drafting, and outreach for you.",
    badge: "Most popular",
    register: "primary",
    features: [
      "Everything in Free",
      "AI-parsed initiative creation from a brief",
      "AI brief quality scoring & suggestions",
      "Full AI-powered org-to-org matching",
      "Instant AI fit analysis on any org",
      "AI-drafted outreach messages",
      "Originate & send your own MoUs",
      "Self-view AI ESG Snapshot",
    ],
  },
  {
    value: "pro",
    name: "Pro",
    priceNgn: 339_000,
    priceUsdRef: 249,
    blurb: "For funders and corporates evaluating partners at scale.",
    register: "accent",
    features: [
      "Everything in Plus",
      "AI deal memo (funders) or CSR brief (corporates)",
      "Evaluate any candidate's ESG Snapshot",
      "AI-drafted EOI to initiative owners",
    ],
  },
  {
    value: "compliance",
    name: "Compliance",
    priceNgn: 1_090_000,
    priceUsdRef: 799,
    blurb: "Audit-ready CSR infrastructure for corporate teams.",
    badge: "Corporate only",
    register: "dark",
    features: [
      "Everything in Pro",
      "Strategy Builder for CSR planning",
      "Unlimited AI ESG reports",
      "SRG1 deadline tracking & reminders",
      "Audit-ready DD export",
    ],
  },
];

const STATUS_STYLES: Record<SubStatus, string> = {
  active:    "bg-[#2D6A4F]/10 text-[#2D6A4F]",
  past_due:  "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
  canceled:  "bg-muted text-muted-foreground",
  inactive:  "bg-muted text-muted-foreground",
};

const STATUS_LABELS: Record<SubStatus, string> = {
  active: "Active", past_due: "Past due", canceled: "Canceled", inactive: "Inactive",
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const ORG_SELECT = "id, organisation_name, organisation_type, subscription_tier, subscription_status, subscription_current_period_end";

export function BillingTab() {
  const { user, orgOwnerId } = useAuth();
  const [role, setRole] = useState<Role>("loading");
  const [org, setOrg] = useState<OrgBilling | null>(null);
  const [checkingOutTier, setCheckingOutTier] = useState<Tier | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const pollAttempts = useRef(0);
  const pollInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  async function loadWithRoleTransition() {
    if (!user) return;
    setRole("loading");
    const resolved = await resolveOrg();
    setOrg(resolved.org);
    setRole(resolved.role);
  }

  async function refetchOrgSilently() {
    if (!user) return;
    const resolved = await resolveOrg();
    setOrg(resolved.org);
  }

  async function resolveOrg(): Promise<{ org: OrgBilling | null; role: Role }> {
    if (!user) return { org: null, role: "none" };

    const { data: ownedOrg } = await supabase
      .from("organizations").select(ORG_SELECT).eq("user_id", user.id).maybeSingle();
    if (ownedOrg) return { org: ownedOrg as OrgBilling, role: "owner" };

    if (orgOwnerId && orgOwnerId !== user.id) {
      const { data: ownerOrg } = await supabase
        .from("organizations").select(ORG_SELECT).eq("user_id", orgOwnerId).maybeSingle();
      if (ownerOrg) return { org: ownerOrg as OrgBilling, role: "member" };
    }

    return { org: null, role: "none" };
  }

  useEffect(() => {
    if (user?.id) loadWithRoleTransition();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, orgOwnerId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.get("reference")) return;

    setConfirmingPayment(true);
    pollAttempts.current = 0;
    pollInterval.current = setInterval(async () => {
      pollAttempts.current += 1;
      await refetchOrgSilently();
      if (pollAttempts.current >= 6 && pollInterval.current) {
        clearInterval(pollInterval.current);
        setConfirmingPayment(false);
      }
    }, 2500);

    return () => { if (pollInterval.current) clearInterval(pollInterval.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (confirmingPayment && org?.subscription_status === "active") {
      if (pollInterval.current) clearInterval(pollInterval.current);
      setConfirmingPayment(false);
      const url = new URL(window.location.href);
      url.searchParams.delete("reference");
      url.searchParams.delete("trxref");
      window.history.replaceState({}, "", url.toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org?.subscription_status]);

  async function startCheckout(tier: Tier) {
    if (tier === "free") return;
    setCheckoutError(null);
    setCheckingOutTier(tier);
    const { data, error } = await supabase.functions.invoke("paystack-initialize", {
      body: { tier },
    });
    setCheckingOutTier(null);
    if (error || data?.error) {
      setCheckoutError(data?.error || error?.message || "Could not start checkout.");
      return;
    }
    if (data?.authorization_url) {
      window.location.href = data.authorization_url;
    }
  }

  if (role === "loading") {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  if (role === "none") {
    return (
      <div className="rounded-xl border border-border bg-white dark:bg-card px-5 py-8 text-center">
        <p className="text-sm text-black dark:text-white">
          Billing is available once you have an organisation profile set up.
        </p>
      </div>
    );
  }

  const currentTierInfo = TIERS.find(t => t.value === org?.subscription_tier) ?? TIERS[0];
  const isOwner = role === "owner";

  return (
    <div className="space-y-8">
      {/* ── Current plan summary ── */}
      <div className="rounded-xl border border-border bg-white dark:bg-card px-6 py-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-black dark:text-white mb-3">Current plan</p>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <p className="text-2xl font-bold text-foreground tracking-tight">{currentTierInfo.name}</p>
              {org && org.subscription_tier !== "free" && (
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_STYLES[org.subscription_status]}`}>
                  {STATUS_LABELS[org.subscription_status]}
                </span>
              )}
            </div>
            {org && org.subscription_tier !== "free" && org.subscription_status === "active" && (
              <p className="text-sm text-black dark:text-white mt-1.5">
                Renews by <span className="font-medium">{fmtDate(org.subscription_current_period_end)}</span> — renewal isn't automatic yet, so check out again before this date to keep access.
              </p>
            )}
            {(!org || org.subscription_tier === "free") && (
              <p className="text-sm text-black dark:text-white mt-1.5">Upgrade below for AI matching, drafting, and more.</p>
            )}
          </div>
          {confirmingPayment && (
            <div className="flex items-center gap-2 text-xs text-[#2D6A4F] font-medium">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Confirming your payment...
            </div>
          )}
        </div>
        {!isOwner && (
          <p className="text-xs text-black dark:text-white mt-4">
            Only the organisation owner can manage billing.
          </p>
        )}
      </div>

      {checkoutError && (
        <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 px-5 py-3">
          <p className="text-xs text-red-600 dark:text-red-400">{checkoutError}</p>
        </div>
      )}

      {/* ── Plan cards ── */}
      {isOwner && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 items-start">
          {TIERS.map((t) => {
            const isCurrent = org?.subscription_tier === t.value;
            const isComplianceLocked = t.value === "compliance" && !CORPORATE_TYPES.includes(org?.organisation_type || "");
            const isElevated = t.register === "primary";
            const isDark = t.register === "dark";

            const cardBase = "rounded-2xl flex flex-col transition-all duration-200";
            const cardStyle =
              isDark
                ? "bg-[#0E1512] border border-[#2A3B33] text-white lg:-translate-y-0"
                : isElevated
                ? "bg-white dark:bg-card border-2 border-[#2D6A4F] shadow-[0_12px_32px_-8px_rgba(45,106,79,0.35)] lg:-translate-y-3"
                : t.register === "accent"
                ? "bg-white dark:bg-card border-2 border-[#C45C26]/40"
                : "bg-white dark:bg-card border border-border";

            return (
              <div key={t.value} className={`${cardBase} ${cardStyle} px-6 ${isElevated ? "py-8" : "py-6"}`}>
                {t.badge && (
                  <div className={`inline-flex items-center gap-1 self-start mb-3 text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
                    isElevated
                      ? "bg-gradient-to-b from-[#3a8560] to-[#2D6A4F] text-white shadow-sm"
                      : isDark
                      ? "bg-[#C9A227]/15 text-[#D9B94A] border border-[#C9A227]/30"
                      : "bg-[#C45C26]/10 text-[#C45C26]"
                  }`}>
                    {isElevated && <Sparkles className="w-3 h-3" />}
                    {t.badge}
                  </div>
                )}

                <p className={`font-bold tracking-tight mb-1 ${isElevated ? "text-2xl" : "text-xl"} ${isDark ? "text-white" : "text-foreground"}`}>
                  {t.name}
                </p>
                <p className={`text-sm mb-4 leading-snug ${isDark ? "text-white/60" : "text-black dark:text-white"}`}>
                  {t.blurb}
                </p>

                <div className="mb-5">
                  <p className={`font-extrabold tracking-tight ${isElevated ? "text-4xl" : "text-3xl"} ${isDark ? "text-white" : "text-foreground"}`}>
                    {t.priceNgn === 0 ? "₦0" : `₦${t.priceNgn.toLocaleString()}`}
                    <span className={`text-sm font-medium ml-1 ${isDark ? "text-white/50" : "text-black dark:text-white"}`}>/mo</span>
                  </p>
                  {t.priceUsdRef > 0 && (
                    <p className={`text-xs mt-1 ${isDark ? "text-white/40" : "text-black dark:text-white"}`}>≈ ${t.priceUsdRef} USD reference</p>
                  )}
                </div>

                <div className="space-y-2.5 mb-6 flex-1">
                  {t.features.map((f) => (
                    <div key={f} className="flex items-start gap-2">
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                        isDark ? "bg-[#C9A227]/20" : isElevated ? "bg-[#2D6A4F]/15" : "bg-[#C45C26]/10"
                      }`}>
                        <Check className={`w-2.5 h-2.5 ${isDark ? "text-[#D9B94A]" : isElevated ? "text-[#2D6A4F]" : "text-[#C45C26]"}`} strokeWidth={3} />
                      </div>
                      <p className={`text-sm leading-snug ${isDark ? "text-white/85" : "text-foreground"}`}>{f}</p>
                    </div>
                  ))}
                </div>

                {t.value === "free" ? (
                  <div className="text-center py-2.5 text-sm font-medium text-black dark:text-white border border-dashed border-border rounded-full">
                    {isCurrent ? "You're on Free" : "Included by default"}
                  </div>
                ) : isComplianceLocked ? (
                  <button type="button" disabled
                    className="w-full h-11 rounded-full text-sm font-semibold bg-white/5 text-white/40 border border-white/10 cursor-not-allowed">
                    Corporate organisations only
                  </button>
                ) : isCurrent ? (
                  <div className={`w-full h-11 rounded-full text-sm font-semibold flex items-center justify-center gap-1.5 ${
                    isDark ? "bg-white/10 text-white" : "bg-[#2D6A4F]/10 text-[#2D6A4F]"
                  }`}>
                    <Check className="w-4 h-4" /> Current plan
                  </div>
                ) : (
                  <button type="button"
                    onClick={() => startCheckout(t.value)}
                    disabled={checkingOutTier !== null}
                    className={`w-full h-11 rounded-full text-sm font-semibold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${
                      isDark
                        ? "bg-gradient-to-b from-[#D9B94A] to-[#C9A227] text-[#0E1512] shadow-[0_4px_14px_-2px_rgba(201,162,39,0.5)] hover:shadow-[0_6px_20px_-2px_rgba(201,162,39,0.65)] hover:-translate-y-0.5 active:translate-y-0"
                        : isElevated
                        ? "bg-gradient-to-b from-[#3a8560] to-[#2D6A4F] text-white shadow-[0_4px_14px_-2px_rgba(45,106,79,0.5)] hover:shadow-[0_6px_20px_-2px_rgba(45,106,79,0.65)] hover:-translate-y-0.5 active:translate-y-0"
                        : "bg-gradient-to-b from-[#d4713d] to-[#C45C26] text-white shadow-[0_4px_14px_-2px_rgba(196,92,38,0.4)] hover:shadow-[0_6px_20px_-2px_rgba(196,92,38,0.55)] hover:-translate-y-0.5 active:translate-y-0"
                    }`}>
                    {checkingOutTier === t.value
                      ? <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                      : (org && TIERS.findIndex(x => x.value === t.value) > TIERS.findIndex(x => x.value === org.subscription_tier) ? `Upgrade to ${t.name}` : `Switch to ${t.name}`)}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
