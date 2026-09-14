"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  CreditCard,
  ExternalLink,
  Zap,
  FileText,
  MessageSquare,
  Video,
  TrendingUp,
  Rocket,
  Banknote,
  Calendar,
  CheckCircle2,
  Receipt,
} from "lucide-react";
import Link from "next/link";
import { PLAN_LIMITS, formatPlanName } from "@/lib/plan-config";

interface UsageData {
  e1DeckAnalyses: number;
  e2ScriptCoachSessions: number;
  e3LivePitchSessions: number;
  e4FullPitchSessions: number;
  e5FounderSessions: number;
  zaiTokensUsed: number;
}

interface SubscriptionData {
  plan: string;
  status: string;
  paystackCustomerId?: string | null;
  paystackSubscriptionId?: string | null;
  paystackPlanCode?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripePaymentMethodId?: string | null;
  stripeCurrentPeriodEnd?: string | null;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
  creditsRemaining?: number;
  creditsUsed?: number;
  createdAt?: string;
  updatedAt?: string;
}

interface Transaction {
  id: string;
  type: string;       // SUBSCRIPTION | ONE_TIME | CREDIT_PURCHASE | REFUND
  amount: number;     // smallest currency unit (kobo, cents)
  currency: string;   // NGN, USD, etc.
  provider: string;   // PAYSTACK | STRIPE
  providerReference?: string | null;
  creditsAdded: number;
  createdAt: string;
}

interface UserData {
  subscription: SubscriptionData | null;
  usage: UsageData | null;
  transactions?: Transaction[];
}

// ── Helpers ──────────────────────────────────────────────────────────────

// Format amount from smallest currency unit to human-readable.
// Paystack charges in kobo (NGN × 100). Stripe charges in cents (USD × 100).
function formatAmount(amount: number, currency: string): string {
  const major = amount / 100;
  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: currency.toUpperCase(),
      maximumFractionDigits: 0,
    }).format(major);
  } catch {
    // Fallback if Intl currency database doesn't recognise the code
    return `${major.toFixed(0)} ${currency.toUpperCase()}`;
  }
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

// Translate provider + reference into a human-readable payment-method label.
// - Stripe = bank card (debit/credit) authenticated via 3DS
// - Paystack = could be card OR bank transfer — we surface the raw provider
//   and let the user infer from their bank statement. We can't tell from the
//   Transaction row alone which Paystack channel was used; that would require
//   a Paystack API call per transaction (deferred — see operator runbook).
function describePaymentMethod(tx: Transaction): { label: string; icon: typeof Banknote } {
  if (tx.provider === "STRIPE") {
    return { label: "Bank card (Stripe)", icon: CreditCard };
  }
  if (tx.provider === "PAYSTACK") {
    return { label: "Card or transfer (Paystack)", icon: Banknote };
  }
  return { label: tx.provider, icon: Banknote };
}

function describeTransactionType(type: string): string {
  switch (type) {
    case "SUBSCRIPTION":
      return "Subscription payment";
    case "ONE_TIME":
      return "One-time purchase";
    case "CREDIT_PURCHASE":
      return "Credit purchase";
    case "REFUND":
      return "Refund";
    default:
      return type;
  }
}

// ── Component ────────────────────────────────────────────────────────────

export default function BillingPage() {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserData = useCallback(async () => {
    try {
      const res = await fetch("/api/user/sync");
      if (!res.ok) return;
      const json = await res.json();
      if (json.success && json.user) {
        setUserData({
          subscription: json.user.subscription,
          usage: json.user.usage,
          transactions: json.user.transactions ?? [],
        });
      }
    } catch {
      // Non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  const plan = userData?.subscription?.plan || "FREE";
  const planLabel = formatPlanName(plan);
  const planStatus = userData?.subscription?.status || "INCOMPLETE";
  const usage = userData?.usage;
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.FREE;

  // Founder / ENTERPRISE users are top-tier — no Upgrade CTAs anywhere.
  const isTopTier = plan === "FOUNDER" || plan === "ENTERPRISE";

  const totalCredits =
    (userData?.subscription?.creditsUsed ?? 0) +
    (userData?.subscription?.creditsRemaining ?? 0);
  const creditsUsed = userData?.subscription?.creditsUsed ?? 0;
  const creditsRemaining = userData?.subscription?.creditsRemaining ?? 0;

  const billingModules = [
    { key: "e1", label: "E1 — Pitch Deck Analyser", icon: FileText, used: usage?.e1DeckAnalyses ?? 0, limit: limits.e1 },
    { key: "e2", label: "E2 — Script Check", icon: MessageSquare, used: usage?.e2ScriptCoachSessions ?? 0, limit: limits.e2 },
    { key: "e3", label: "E3 — Live Pitch", icon: Video, used: usage?.e3LivePitchSessions ?? 0, limit: limits.e3 },
    { key: "e4", label: "E4 — Full Pitch Session", icon: TrendingUp, used: usage?.e4FullPitchSessions ?? 0, limit: limits.e4 },
    { key: "e5", label: "E5 — Founder Coaching", icon: Rocket, used: usage?.e5FounderSessions ?? 0, limit: limits.e5 },
  ];

  const periodStart = userData?.subscription?.currentPeriodStart;
  const periodEnd = userData?.subscription?.currentPeriodEnd;
  const subscriptionCreated = userData?.subscription?.createdAt;

  // Detect the active payment provider from whichever fields are populated.
  const activeProvider =
    userData?.subscription?.stripeSubscriptionId ? "STRIPE"
    : userData?.subscription?.paystackSubscriptionId ? "PAYSTACK"
    : null;
  const activeProviderLabel =
    activeProvider === "STRIPE" ? "Stripe (bank card)"
    : activeProvider === "PAYSTACK" ? "Paystack (card or transfer)"
    : "No active subscription";

  const transactions = userData?.transactions ?? [];

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Billing</h1>
          <p className="text-muted-foreground">Manage your subscription and usage</p>
        </div>
        {/* "Upgrade Plan" is hidden for Founder-tier users — there's nothing
            above Founder. They see their plan badge instead. */}
        {!isTopTier && (
          <Link href="/pricing">
            <Button className="gap-2">
              <Zap className="w-4 h-4" />
              Upgrade Plan
            </Button>
          </Link>
        )}
        {isTopTier && (
          <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 px-3 py-1.5">
            <Crown className="w-3 h-3 mr-1" />
            {planLabel} · Top tier
          </Badge>
        )}
      </div>

      {/* Current Plan */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Current Plan
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="bg-accent/10 text-accent text-lg px-3 py-1">
                  {planLabel}
                </Badge>
                <Badge variant={planStatus === "ACTIVE" ? "default" : "outline"} className="text-xs">
                  {planStatus}
                </Badge>
              </div>

              {/* Subscription timeline */}
              <div className="rounded-lg border bg-muted/30 p-4 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Subscribed since
                  </span>
                  <span className="font-medium">{formatDate(subscriptionCreated)}</span>
                </div>
                {periodStart && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Current period start</span>
                    <span className="font-medium">{formatDate(periodStart)}</span>
                  </div>
                )}
                {periodEnd && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Current period end</span>
                    <span className="font-medium">{formatDate(periodEnd)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    Payment method
                  </span>
                  <span className="font-medium">{activeProviderLabel}</span>
                </div>
                {userData?.subscription?.cancelAtPeriodEnd && (
                  <div className="mt-2 rounded-md bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300">
                    Subscription is set to cancel at the end of the current period.
                  </div>
                )}
              </div>

              {plan === "FREE" && (
                <p className="text-sm text-muted-foreground">
                  You are on the free plan. Upgrade to unlock more sessions and features.
                </p>
              )}
              {isTopTier && (
                <p className="text-sm text-muted-foreground">
                  You&apos;re on the highest tier — {planLabel}. All modules are unlocked.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Payment History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            Payment History
          </CardTitle>
          <CardDescription>
            Your past purchases and subscription payments
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8">
              <Receipt className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
              <p className="text-sm text-muted-foreground">
                No payments yet. Your transactions will appear here once you make a purchase.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx) => {
                const method = describePaymentMethod(tx);
                const isRefund = tx.type === "REFUND";
                return (
                  <div
                    key={tx.id}
                    className="rounded-lg border p-3 space-y-2 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                          isRefund
                            ? "bg-amber-500/10 text-amber-600"
                            : "bg-emerald-500/10 text-emerald-600"
                        }`}>
                          {isRefund ? <Banknote className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                        </div>
                        <div>
                          <p className="font-medium text-sm">
                            {describeTransactionType(tx.type)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDateTime(tx.createdAt)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold text-sm ${
                          isRefund ? "text-amber-600" : "text-foreground"
                        }`}>
                          {isRefund ? "−" : ""}{formatAmount(tx.amount, tx.currency)}
                        </p>
                        {tx.creditsAdded > 0 && (
                          <p className="text-xs text-muted-foreground">
                            +{tx.creditsAdded} credits
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1 border-t">
                      <method.icon className="w-3.5 h-3.5" />
                      <span>{method.label}</span>
                      {tx.providerReference && (
                        <>
                          <span>·</span>
                          <span className="font-mono truncate">
                            Ref: {tx.providerReference.slice(0, 16)}
                            {tx.providerReference.length > 16 ? "…" : ""}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Credits */}
      {totalCredits > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Credits</CardTitle>
            <CardDescription>Pay-per-use credits remaining</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Credits Used</span>
                <span className="font-medium">{creditsUsed} / {totalCredits}</span>
              </div>
              <Progress value={(creditsUsed / totalCredits) * 100} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {creditsRemaining} credits remaining
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Usage Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Usage Breakdown</CardTitle>
          <CardDescription>Sessions used this billing period by module</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-2 w-full" />
                </div>
              ))}
            </div>
          ) : (
            billingModules.map((mod) => {
              const pct = mod.limit > 0 && mod.limit !== 999 ? (mod.used / mod.limit) * 100 : 0;
              const remaining = Math.max(0, mod.limit - mod.used);
              return (
                <div key={mod.key} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <mod.icon className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium flex-1">{mod.label}</span>
                    <span className="text-sm text-muted-foreground">
                      {mod.limit === 999 ? `${mod.used} used` : `${mod.used}/${mod.limit}`}
                    </span>
                  </div>
                  <Progress value={mod.limit === 999 ? 0 : pct} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    {mod.limit === 999 ? "Unlimited" : mod.limit === 0 ? "Not available on this plan" : `${remaining} remaining`}
                  </p>
                  {mod.key !== "e4" && <Separator />}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* AI Tokens */}
      {usage && usage.zaiTokensUsed > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">AI Token Usage</CardTitle>
            <CardDescription>Tokens consumed by the AI engine</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{usage.zaiTokensUsed.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground">tokens used across all modules</p>
          </CardContent>
        </Card>
      )}

      {/* Upgrade CTA — hidden for Founder / ENTERPRISE */}
      {!isTopTier && plan !== "ENTERPRISE" && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <p className="font-medium">Need more sessions?</p>
                <p className="text-sm text-muted-foreground">
                  Upgrade your plan to increase limits and unlock premium features.
                </p>
              </div>
              <Link href="/pricing">
                <Button className="gap-2 whitespace-nowrap">
                  View Plans <ExternalLink className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Local Crown icon (so we don't have to add another lucide import) ──────
// Re-using the Crown glyph from lucide-react via a tiny inline wrapper
// keeps the bundle small and avoids a separate dependency.
function Crown({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm0 2h14v2H5v-2z" />
    </svg>
  );
}
