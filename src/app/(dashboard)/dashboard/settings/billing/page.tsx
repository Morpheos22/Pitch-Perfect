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
} from "lucide-react";
import Link from "next/link";

interface UsageData {
  e1DeckAnalyses: number;
  e2ScriptCoachSessions: number;
  e3LivePitchSessions: number;
  e4FullPitchSessions: number;
  zaiTokensUsed: number;
}

interface SubscriptionData {
  plan: string;
  status: string;
  creditsRemaining: number;
  creditsUsed: number;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
}

interface UserData {
  subscription: SubscriptionData | null;
  usage: UsageData | null;
}

const PLAN_LIMITS: Record<string, { e1: number; e2: number; e3: number; e4: number }> = {
  FREE: { e1: 1, e2: 1, e3: 0, e4: 0 },
  STARTER: { e1: 5, e2: 10, e3: 5, e4: 1 },
  PROFESSIONAL: { e1: 20, e2: 30, e3: 15, e4: 5 },
  ENTERPRISE: { e1: 999, e2: 999, e3: 999, e4: 999 },
};

function formatPlanName(plan: string): string {
  const names: Record<string, string> = {
    FREE: "Free",
    STARTER: "Starter",
    PROFESSIONAL: "Professional",
    ENTERPRISE: "Enterprise",
  };
  return names[plan] || plan;
}

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

  const totalCredits = (userData?.subscription?.creditsUsed ?? 0) + (userData?.subscription?.creditsRemaining ?? 0);
  const creditsUsed = userData?.subscription?.creditsUsed ?? 0;
  const creditsRemaining = userData?.subscription?.creditsRemaining ?? 0;

  const billingModules = [
    { key: "e1", label: "E1 — Pitch Deck Analyser", icon: FileText, used: usage?.e1DeckAnalyses ?? 0, limit: limits.e1 },
    { key: "e2", label: "E2 — Script Check", icon: MessageSquare, used: usage?.e2ScriptCoachSessions ?? 0, limit: limits.e2 },
    { key: "e3", label: "E3 — Live Pitch", icon: Video, used: usage?.e3LivePitchSessions ?? 0, limit: limits.e3 },
    { key: "e4", label: "E4 — Full Pitch Session", icon: TrendingUp, used: usage?.e4FullPitchSessions ?? 0, limit: limits.e4 },
  ];

  const periodEnd = userData?.subscription?.currentPeriodEnd
    ? new Date(userData.subscription.currentPeriodEnd).toLocaleDateString()
    : null;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Billing</h1>
          <p className="text-muted-foreground">Manage your subscription and usage</p>
        </div>
        <Link href="/pricing">
          <Button className="gap-2">
            <Zap className="w-4 h-4" />
            Upgrade Plan
          </Button>
        </Link>
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
              {periodEnd && (
                <p className="text-sm text-muted-foreground">
                  Current period ends: {periodEnd}
                </p>
              )}
              {plan === "FREE" && (
                <p className="text-sm text-muted-foreground">
                  You are on the free plan. Upgrade to unlock more sessions and features.
                </p>
              )}
            </>
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

      {/* Upgrade CTA */}
      {plan !== "ENTERPRISE" && (
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
