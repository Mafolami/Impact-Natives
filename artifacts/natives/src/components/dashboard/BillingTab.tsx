// ─── BillingTab.tsx ─────────────────────────────────────────────────────────
// Billing surface for DashboardSettings' "Billing" tab. Same role pattern as
// TeamTab: an Owner sees full plan management, a Member of someone else's
// org sees a read-only summary of what their org is on, and someone with no
// org sees a short explainer.
//
// v4: renewal is now real (see renew-subscriptions) -- the "not automatic"
// disclaimer is gone. Active shows the actual renewal date. A failed
// auto-renewal shows as 'past_due': access is kept during the grace window
// (until downgrade-expired-subscriptions finally sweeps it once period_end
// passes), with a direct "Renew now" recovery action that just re-runs
// checkout. Cancel is allowed from both active and past_due.
//
// Card arrangement is intentionally NOT uniform across tiers: Free and Plus
// (8 features each) get their list split into two labeled, icon-led groups
// so a long flat checklist doesn't read as a wall of identical bullets. Pro
// and Compliance (4-5 features) instead lead with a single bold headline
// pulled from their strongest capability, then a shorter list underneath --
// different shape because they're a different kind of pitch (a short,
// confident case, not a checklist to scan).
//
// v3 (carried forward): 2x2 grid, real cancel-plan action.
// v2 (carried forward): full feature lists, distinct visual register per
// tier, silent post-checkout poll refresh (no flashing).

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { Loader2, Check, Sparkles, Search, Zap, FileCheck, ShieldCheck, type LucideIcon } from "lucide-react";

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

interface FeatureGroup {
  label: string;
  icon: LucideIcon;
  items: string[];
}

interface TierDef {
  value: Tier;
  name: string;
  priceNgn: number;
  priceUsdRef: number;
  blurb: string;
  badge?: string;
  register: "quiet" | "primary" | "accent" | "dark";
  groups?: FeatureGroup[];
  headline?: string;
  features?: string[];
}

const TIERS: TierDef[] = [
  {
    value: "free",
    name: "Free",
    priceNgn: 0,
    priceUsdRef: 0,
    blurb: "Everything you need to get listed and start matching.",
    register: "quiet",
    groups: [
      {
        label: "Get discovered",
        icon: Search,
        items: [
          "Browse the full directory & marketplace",
          "Manual initiative & partnership listings",
          "Trust Score & verified badge",
          "Self-attested DD readiness",
        ],
      },
      {
        label: "Stay connected",
        icon: FileCheck,
        items: [
          "Reply to inbound messages",
          "Receive & sign MoUs",
          "Milestone tracking on signed MoUs",
          "Weekly & monthly digest emails",
        ],
      },
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
    groups: [
      {
        label: "AI does the work",
        icon: Sparkles,
        items: [
          "AI-parsed initiative creation from a brief",
          "AI brief quality scoring & suggestions",
          "Full AI-powered org-to-org matching",
          "Instant AI fit analysis on any org",
        ],
      },
      {
        label: "Move faster",
        icon: Zap,
        items: [
          "AI-drafted outreach messages",
          "Originate & send your own MoUs",
          "Self-view AI ESG Snapshot",
          "Everything in Free",
        ],
      },
    ],
  },
  {
    value: "pro",
    name: "Pro",
    priceNgn: 339_000,
    priceUsdRef: 249,
    blurb: "For funders and corporates evaluating partners at scale.",
    register: "accent",
    headline: "Turn any candidate into a decision-ready deal memo or CSR brief.",
    features: [
      "Everything in Plus",
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
    headline: "Unlimited ESG reporting, built to survive an audit.",
    features: [
      "Everything in Pro",
      "Strategy Builder for CSR planning",
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

  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

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

  async function cancelPlan() {
    setCanceling(true);
    setCancelError(null);
    const { data, error } = await supabase.functions.invoke("cancel-subscription", { body: {} });
    setCanceling(false);
    if (error || data?.error) {
      setCancelError(data?.error || error?.message || "Could not cancel plan.");
      return;
    }
    setCancelConfirm(false);
    await refetchOrgSilently();
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
  const isPastDue = org?.subscription_status === "past_due";
  const canCancel = isOwner && org && org.subscription_tier !== "free" && (org.subscription_status === "active" || org.subscription_status === "past_due");

  return (
    <div className="space-y-8">
      {/* ── Current plan summary ── */}
      <div className={`rounded-xl border px-6 py-5 ${isPastDue ? "border-amber-300 bg-amber-50 dark:bg-amber-950/10 dark:border-amber-800" : "border-border bg-white dark:bg-card"}`}>
        <p className="text-xs font-semibold uppercase tracking-wider text-black dark:text-white mb-3">Current plan</p>
        <div className="flex items-start justify-between flex-wrap gap-3">
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
                Renews automatically on <span className="font-medium">{fmtDate(org.subscription_current_period_end)}</span>.
              </p>
            )}

            {isPastDue && (
              <p className="text-sm text-amber-800 dark:text-amber-300 mt-1.5 max-w-md">
                We couldn't renew your plan automatically. You'll keep {currentTierInfo.name} access until <span className="font-medium">{fmtDate(org?.subscription_current_period_end ?? null)}</span> — renew now to avoid losing it.
              </p>
            )}

            {(!org || org.subscription_tier === "free") && (
              <p className="text-sm text-black dark:text-white mt-1.5">Upgrade below for AI matching, drafting, and more.</p>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {confirmingPayment && (
              <div className="flex items-center gap-2 text-xs text-[#2D6A4F] font-medium">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Confirming your payment...
              </div>
            )}
            {isPastDue && isOwner && org && (
              <button type="button"
                onClick={() => startCheckout(org.subscription_tier)}
                disabled={checkingOutTier !== null}
                className="h-9 px-4 rounded-full bg-gradient-to-b from-amber-500 to-amber-600 text-white text-sm font-semibold shadow-sm hover:shadow-md transition-all disabled:opacity-60">
                {checkingOutTier === org.subscription_tier ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Renew now"}
              </button>
            )}
          </div>
        </div>

        {!isOwner && (
          <p className="text-xs text-black dark:text-white mt-4">
            Only the organisation owner can manage billing.
          </p>
        )}

        {/* ── Cancel plan ── */}
        {canCancel && !cancelConfirm && (
          <div className="mt-4 pt-4 border-t border-border">
            <button type="button"
              onClick={() => setCancelConfirm(true)}
              className="text-xs text-red-500 hover:text-red-600 font-medium">
              Cancel plan
            </button>
          </div>
        )}
        {canCancel && cancelConfirm && (
          <div className="mt-4 pt-4 border-t border-border space-y-2">
            <p className="text-sm text-foreground font-medium">
              Cancel your {currentTierInfo.name} plan? You'll lose access to {currentTierInfo.name} features immediately.
            </p>
            {cancelError && <p className="text-xs text-red-500">{cancelError}</p>}
            <div className="flex gap-2">
              <button type="button"
                onClick={() => { setCancelConfirm(false); setCancelError(null); }}
                disabled={canceling}
                className="h-9 px-4 rounded-full border border-border text-sm font-medium hover:bg-muted transition-colors">
                Keep plan
              </button>
              <button type="button"
                onClick={cancelPlan}
                disabled={canceling}
                className="h-9 px-4 rounded-full bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors disabled:opacity-60">
                {canceling ? <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" /> : "Yes, cancel plan"}
              </button>
            </div>
          </div>
        )}
      </div>

      {checkoutError && (
        <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 px-5 py-3">
          <p className="text-xs text-red-600 dark:text-red-400">{checkoutError}</p>
        </div>
      )}

      {/* ── Plan cards ── */}
      {isOwner && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {TIERS.map((t) => {
            const isCurrent = org?.subscription_tier === t.value;
            const isComplianceLocked = t.value === "compliance" && !CORPORATE_TYPES.includes(org?.organisation_type || "");
            const isElevated = t.register === "primary";
            const isDark = t.register === "dark";

            const cardBase = "rounded-2xl flex flex-col transition-all duration-200";
            const cardStyle =
              isDark
                ? "bg-[#0E1512] border border-[#2A3B33] text-white"
                : isElevated
                ? "bg-white dark:bg-card border-2 border-[#2D6A4F] shadow-[0_12px_32px_-8px_rgba(45,106,79,0.35)]"
                : t.register === "accent"
                ? "bg-white dark:bg-card border-2 border-[#C45C26]/40"
                : "bg-white dark:bg-card border border-border";

            const accentIcon = isDark ? "text-[#D9B94A]" : isElevated ? "text-[#2D6A4F]" : "text-[#C45C26]";
            const accentChip = isDark ? "bg-[#C9A227]/20" : isElevated ? "bg-[#2D6A4F]/15" : "bg-[#C45C26]/10";

            return (
              <div key={t.value} className={`${cardBase} ${cardStyle} px-7 ${isElevated ? "py-8" : "py-7"}`}>
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

                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className={`font-bold tracking-tight mb-1 ${isElevated ? "text-2xl" : "text-xl"} ${isDark ? "text-white" : "text-foreground"}`}>
                      {t.name}
                    </p>
                    <p className={`text-sm mb-4 leading-snug max-w-sm ${isDark ? "text-white/60" : "text-black dark:text-white"}`}>
                      {t.blurb}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`font-extrabold tracking-tight leading-none ${isElevated ? "text-4xl" : "text-3xl"} ${isDark ? "text-white" : "text-foreground"}`}>
                      {t.priceNgn === 0 ? "₦0" : `₦${t.priceNgn.toLocaleString()}`}
                    </p>
                    <p className={`text-xs mt-1 ${isDark ? "text-white/50" : "text-black dark:text-white"}`}>
                      /mo{t.priceUsdRef > 0 ? ` · ≈ $${t.priceUsdRef}` : ""}
                    </p>
                  </div>
                </div>

                {/* Free/Plus: grouped, icon-led feature sections */}
                {t.groups && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-3 mb-6 flex-1">
                    {t.groups.map((g) => (
                      <div key={g.label}>
                        <div className="flex items-center gap-1.5 mb-2.5">
                          <g.icon className={`w-3.5 h-3.5 ${accentIcon}`} strokeWidth={2.5} />
                          <p className={`text-[11px] font-bold uppercase tracking-wider ${isDark ? "text-white/50" : "text-black dark:text-white"}`}>
                            {g.label}
                          </p>
                        </div>
                        <div className="space-y-2">
                          {g.items.map((f) => (
                            <div key={f} className="flex items-start gap-2">
                              <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${accentChip}`}>
                                <Check className={`w-2 h-2 ${accentIcon}`} strokeWidth={3.5} />
                              </div>
                              <p className={`text-sm leading-snug ${isDark ? "text-white/85" : "text-foreground"}`}>{f}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Pro/Compliance: bold headline callout + short list */}
                {t.headline && (
                  <div className="flex-1 mt-2 mb-6">
                    <div className={`rounded-xl px-4 py-3.5 mb-4 flex items-start gap-2.5 ${
                      isDark ? "bg-[#C9A227]/10 border border-[#C9A227]/25" : "bg-[#C45C26]/[0.06] border border-[#C45C26]/20"
                    }`}>
                      {t.value === "compliance"
                        ? <ShieldCheck className={`w-4 h-4 shrink-0 mt-0.5 ${accentIcon}`} strokeWidth={2.5} />
                        : <Zap className={`w-4 h-4 shrink-0 mt-0.5 ${accentIcon}`} strokeWidth={2.5} />}
                      <p className={`text-sm font-semibold leading-snug ${isDark ? "text-white" : "text-foreground"}`}>
                        {t.headline}
                      </p>
                    </div>
                    <div className="space-y-2">
                      {(t.features ?? []).map((f) => (
                        <div key={f} className="flex items-start gap-2">
                          <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${accentChip}`}>
                            <Check className={`w-2 h-2 ${accentIcon}`} strokeWidth={3.5} />
                          </div>
                          <p className={`text-sm leading-snug ${isDark ? "text-white/85" : "text-foreground"}`}>{f}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

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
