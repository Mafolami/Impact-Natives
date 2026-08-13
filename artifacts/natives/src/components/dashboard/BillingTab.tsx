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

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Loader2, Check, ExternalLink } from "lucide-react";

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

const TIERS: { value: Tier; name: string; priceNgn: number; priceUsdRef: number; blurb: string; features: string[] }[] = [
  {
    value: "free",
    name: "Free",
    priceNgn: 0,
    priceUsdRef: 0,
    blurb: "Get listed and start matching.",
    features: [
      "Browse the directory and marketplace",
      "Manual initiative and partnership listings",
      "Self-attested DD readiness",
      "Trust Score badge",
    ],
  },
  {
    value: "plus",
    name: "Plus",
    priceNgn: 80_000,
    priceUsdRef: 59,
    blurb: "AI-assisted matching and outreach.",
    features: [
      "AI-parsed initiative creation",
      "Full AI matching and reasoning",
      "AI-drafted outreach messages",
      "Originate MoUs",
    ],
  },
  {
    value: "pro",
    name: "Pro",
    priceNgn: 339_000,
    priceUsdRef: 249,
    blurb: "For funders and corporates evaluating partners.",
    features: [
      "Everything in Plus",
      "Deal memo / CSR brief generation",
      "Evaluate any candidate's ESG Snapshot",
      "AI-drafted EOI to initiative owners",
    ],
  },
  {
    value: "compliance",
    name: "Compliance",
    priceNgn: 1_090_000,
    priceUsdRef: 799,
    blurb: "Corporate organisations only.",
    features: [
      "Everything in Pro",
      "Strategy Builder",
      "Unlimited ESG reports",
      "SRG1 deadline tracking + audit-ready DD export",
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

export function BillingTab() {
  const { user, orgOwnerId } = useAuth();
  const [role, setRole] = useState<Role>("loading");
  const [org, setOrg] = useState<OrgBilling | null>(null);
  const [checkingOutTier, setCheckingOutTier] = useState<Tier | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const pollAttempts = useRef(0);

  useEffect(() => {
    if (user?.id) load();
  }, [user?.id, orgOwnerId]);

  async function load() {
    if (!user) return;
    setRole("loading");

    const { data: ownedOrg } = await supabase
      .from("organizations")
      .select("id, organisation_name, organisation_type, subscription_tier, subscription_status, subscription_current_period_end")
      .eq("user_id", user.id)
      .maybeSingle();

    if (ownedOrg) {
      setOrg(ownedOrg as OrgBilling);
      setRole("owner");
      return;
    }

    if (orgOwnerId && orgOwnerId !== user.id) {
      const { data: ownerOrg } = await supabase
        .from("organizations")
        .select("id, organisation_name, organisation_type, subscription_tier, subscription_status, subscription_current_period_end")
        .eq("user_id", orgOwnerId)
        .maybeSingle();
      if (ownerOrg) {
        setOrg(ownerOrg as OrgBilling);
        setRole("member");
        return;
      }
    }

    setRole("none");
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.get("reference")) return;

    setConfirmingPayment(true);
    pollAttempts.current = 0;

    const interval = setInterval(async () => {
      pollAttempts.current += 1;
      await load();
      if (pollAttempts.current >= 6) {
        clearInterval(interval);
        setConfirmingPayment(false);
      }
    }, 2500);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (confirmingPayment && org?.subscription_status === "active") {
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
    <div className="space-y-6">
      {/* ── Current plan summary ── */}
      <div className="rounded-xl border border-border bg-white dark:bg-card px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-black dark:text-white mb-3">Current plan</p>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-lg font-semibold text-foreground">{currentTierInfo.name}</p>
              {org && org.subscription_tier !== "free" && (
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_STYLES[org.subscription_status]}`}>
                  {STATUS_LABELS[org.subscription_status]}
                </span>
              )}
            </div>
            {org && org.subscription_tier !== "free" && org.subscription_status === "active" && (
              <p className="text-xs text-black dark:text-white mt-1">
                Renews by {fmtDate(org.subscription_current_period_end)} — renewal isn't automatic yet, so check out again before this date to keep access.
              </p>
            )}
            {(!org || org.subscription_tier === "free") && (
              <p className="text-xs text-black dark:text-white mt-1">Upgrade below for AI matching, drafting, and more.</p>
            )}
          </div>
          {confirmingPayment && (
            <div className="flex items-center gap-2 text-xs text-[#2D6A4F]">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {TIERS.map((t) => {
            const isCurrent = org?.subscription_tier === t.value;
            const isComplianceLocked = t.value === "compliance" && !CORPORATE_TYPES.includes(org?.organisation_type || "");
            return (
              <div key={t.value}
                className={`rounded-xl border px-5 py-4 flex flex-col ${
                  isCurrent ? "border-[#2D6A4F] bg-[#2D6A4F]/5" : "border-border bg-white dark:bg-card"
                }`}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold text-foreground">{t.name}</p>
                  {isCurrent && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-[#2D6A4F]/10 text-[#2D6A4F]">
                      Current
                    </span>
                  )}
                </div>
                <p className="text-xs text-black dark:text-white mb-3">{t.blurb}</p>
                <p className="text-xl font-semibold text-foreground mb-1">
                  {t.priceNgn === 0 ? "₦0" : `₦${t.priceNgn.toLocaleString()}`}
                  <span className="text-xs font-normal text-black dark:text-white">/mo</span>
                </p>
                {t.priceUsdRef > 0 && (
                  <p className="text-xs text-black dark:text-white mb-3">≈ ${t.priceUsdRef} USD reference</p>
                )}
                <div className="space-y-1.5 mb-4 flex-1">
                  {t.features.map((f) => (
                    <div key={f} className="flex items-start gap-1.5">
                      <Check className="w-3.5 h-3.5 text-[#2D6A4F] shrink-0 mt-0.5" />
                      <p className="text-xs text-black dark:text-white">{f}</p>
                    </div>
                  ))}
                </div>
                {t.value === "free" ? (
                  <p className="text-xs text-black dark:text-white text-center py-2">
                    {isCurrent ? "You're on Free" : "Included by default"}
                  </p>
                ) : isComplianceLocked ? (
                  <Button type="button" disabled
                    className="rounded-full h-9 text-sm w-full">
                    Corporate organisations only
                  </Button>
                ) : isCurrent ? (
                  <Button type="button" disabled
                    className="rounded-full h-9 text-sm w-full">
                    Current plan
                  </Button>
                ) : (
                  <Button type="button"
                    onClick={() => startCheckout(t.value)}
                    disabled={checkingOutTier !== null}
                    className="bg-[#2D6A4F] hover:bg-[#245c43] text-white rounded-full h-9 text-sm w-full">
                    {checkingOutTier === t.value
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <>{org && TIERS.findIndex(x => x.value === t.value) > TIERS.findIndex(x => x.value === org.subscription_tier) ? "Upgrade" : "Switch"} <ExternalLink className="w-3 h-3 ml-1.5" /></>}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
