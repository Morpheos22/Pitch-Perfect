"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import {
  Presentation,
  MessageSquare,
  Video,
  TrendingUp,
  ArrowRight,
  Clock,
  FileText,
  Sparkles,
  Zap,
  AlertCircle,
} from "lucide-react";

// ── Types ──
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
  currentPeriodEnd: string | null;
}

interface UserData {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  subscription: SubscriptionData | null;
  usage: UsageData | null;
}

interface HistorySession {
  id: string;
  type: string;
  label: string;
  name: string;
  score: number | null;
  date: string;
  href: string;
  icon: typeof Presentation;
  colorClass: string;
}

interface HistoryData {
  data: {
    decks?: Array<{ id: string; fileName: string; overallScore: number | null; createdAt: string; status: string }>;
    scripts?: Array<{ id: string; fileName: string; overallScore: number | null; createdAt: string; status: string; targetAudience?: string }>;
    videos?: Array<{ id: string; duration: number; overallDeliveryScore: number | null; createdAt: string; status: string }>;
    fullSessions?: Array<{ id: string; duration: number; overallReadinessScore: number | null; createdAt: string; status: string; pitchDeck?: { id: string; fileName: string } }>;
  };
  counts: { decks: number; scripts: number; videos: number; fullSessions: number };
}

const PLAN_LIMITS: Record<string, { e1: number; e2: number; e3: number; e4: number }> = {
  FREE: { e1: 1, e2: 1, e3: 0, e4: 0 },
  STARTER: { e1: 5, e2: 10, e3: 3, e4: 0 },
  PROFESSIONAL: { e1: 15, e2: 30, e3: 10, e4: 3 },
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

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default function DashboardPage() {
  const { user: clerkUser } = useUser();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [historyData, setHistoryData] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserData = useCallback(async () => {
    try {
      // POST first to ensure user is synced to DB (handles Clerk webhook race condition)
      await fetch("/api/user/sync", { method: "POST" }).catch((err) => {
        console.warn("[Dashboard] User sync POST failed (non-fatal):", err);
      });
      // Then GET the fresh user data
      const res = await fetch("/api/user/sync");
      if (!res.ok) throw new Error("Failed to fetch user data");
      const json = await res.json();
      if (json.success && json.user) {
        setUserData(json.user);
      }
    } catch (err: any) {
      // Non-fatal: dashboard should still render without user data
      // Don't show error card for transient sync failures
      console.warn("[Dashboard] User data fetch failed (non-fatal):", err?.message);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/history?limit=5");
      if (!res.ok) throw new Error("Failed to fetch history");
      const json = await res.json();
      if (json.success) {
        setHistoryData(json);
      }
    } catch (err: any) {
      // History fetch failure is non-critical
      console.error("History fetch error:", err);
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchUserData(), fetchHistory()]).finally(() => setLoading(false));
  }, [fetchUserData, fetchHistory]);

  // ── Derived data ──
  const plan = userData?.subscription?.plan || "FREE";
  const planLabel = formatPlanName(plan);
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.FREE;
  const usage = userData?.usage;

  const entitlements = [
    { key: "e1", label: "Deck Analyses", used: usage?.e1DeckAnalyses ?? 0, total: limits.e1 },
    { key: "e2", label: "Script Sessions", used: usage?.e2ScriptCoachSessions ?? 0, total: limits.e2 },
    { key: "e3", label: "Live Sessions", used: usage?.e3LivePitchSessions ?? 0, total: limits.e3 },
    { key: "e4", label: "Full Sessions", used: usage?.e4FullPitchSessions ?? 0, total: limits.e4 },
  ];

  const totalSessions = usage
    ? usage.e1DeckAnalyses + usage.e2ScriptCoachSessions + usage.e3LivePitchSessions + usage.e4FullPitchSessions
    : 0;

  // Build recent sessions from history API
  const recentSessions: HistorySession[] = [];
  if (historyData?.data) {
    const { decks, scripts, videos, fullSessions } = historyData.data;
    if (decks) {
      decks.slice(0, 3).forEach((d) => {
        recentSessions.push({
          id: d.id, type: "Deck Analysis", label: "Pitch Deck Analyser",
          name: d.fileName || "Untitled Deck", score: d.overallScore,
          date: d.createdAt, href: `/pitch-deck-analyser/session/${d.id}`,
          icon: Presentation, colorClass: "bg-primary/10 text-primary",
        });
      });
    }
    if (scripts) {
      scripts.slice(0, 3).forEach((s) => {
        recentSessions.push({
          id: s.id, type: "Script Coach", label: "Script Check",
          name: s.fileName || "Untitled Script", score: s.overallScore,
          date: s.createdAt, href: `/elevator-script/session/${s.id}`,
          icon: MessageSquare, colorClass: "bg-secondary/10 text-secondary",
        });
      });
    }
    if (videos) {
      videos.slice(0, 2).forEach((v) => {
        recentSessions.push({
          id: v.id, type: "Live Recording", label: "Elevator Pitch Live",
          name: `Video ${v.duration ? `${Math.round(v.duration / 60)}s` : ""}`, score: v.overallDeliveryScore,
          date: v.createdAt, href: `/elevator-pitch-live/live/session/${v.id}`,
          icon: Video, colorClass: "bg-orange-500/10 text-orange-500",
        });
      });
    }
    if (fullSessions) {
      fullSessions.slice(0, 1).forEach((f) => {
        recentSessions.push({
          id: f.id, type: "Full Session", label: "Full Pitch Session",
          name: f.pitchDeck?.fileName || "Full Pitch Session", score: f.overallReadinessScore,
          date: f.createdAt, href: `/coach/full/session/${f.id}`,
          icon: TrendingUp, colorClass: "bg-emerald-500/10 text-emerald-500",
        });
      });
    }
    // Sort by date descending, take top 5
    recentSessions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    recentSessions.splice(5);
  }

  // Compute average score from recent sessions with a score
  const scoredSessions = recentSessions.filter((s) => s.score != null);
  const avgScore = scoredSessions.length > 0
    ? Math.round(scoredSessions.reduce((sum, s) => sum + s.score!, 0) / scoredSessions.length)
    : null;

  const firstName = clerkUser?.firstName || userData?.firstName || "there";

  // ── Module cards config ──
  const modules = [
    {
      id: "m1", title: "Pitch Deck Analyser",
      description: "Upload your pitch deck for comprehensive content and visual analysis",
      icon: Presentation, href: "/pitch-deck-analyser/new",
      color: "bg-primary/10 text-primary",
      sessions: usage?.e1DeckAnalyses ?? 0, limit: limits.e1,
      status: limits.e1 > 0 ? ("active" as const) : ("upgrade" as const),
    },
    {
      id: "m2", title: "Script Check",
      description: "Perfect your elevator pitch with AI-powered script analysis",
      icon: MessageSquare, href: "/elevator-script/new",
      color: "bg-secondary/10 text-secondary",
      sessions: usage?.e2ScriptCoachSessions ?? 0, limit: limits.e2,
      status: limits.e2 > 0 ? ("active" as const) : ("upgrade" as const),
    },
    {
      id: "m3", title: "Elevator Pitch Live",
      description: "Script coaching plus live recording with delivery feedback",
      icon: Video, href: "/elevator-pitch-live/new",
      color: "bg-orange-500/10 text-orange-500",
      sessions: usage?.e3LivePitchSessions ?? 0, limit: limits.e3,
      status: limits.e3 > 0 ? ("active" as const) : ("upgrade" as const),
    },
    {
      id: "m4", title: "Full Pitch Session",
      description: "Complete 30-minute session with deck and video analysis",
      icon: TrendingUp, href: "/coach/full/new",
      color: "bg-emerald-500/10 text-emerald-500",
      sessions: usage?.e4FullPitchSessions ?? 0, limit: limits.e4,
      status: limits.e4 > 0 ? ("active" as const) : ("upgrade" as const),
    },
  ];

  // ── Loading skeleton ──
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-48 mt-2" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
        <Skeleton className="h-40 w-full rounded-xl" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Welcome back, {firstName} 👋</h1>
          <p className="text-muted-foreground">
            Ready to improve your pitch? Let&apos;s get started.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/pricing">
            <Button variant="outline" className="gap-2">
              <Sparkles className="w-4 h-4" />
              Upgrade Plan
            </Button>
          </Link>
          <Link href="/pitch-deck-analyser/new">
            <Button className="gap-2 bg-primary hover:bg-primary/90">
              <Zap className="w-4 h-4" />
              Quick Start
            </Button>
          </Link>
        </div>
      </div>

      {/* Entitlement Panel */}
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Your Entitlements</CardTitle>
            <Badge variant="secondary" className="bg-accent/10 text-accent">{planLabel}</Badge>
          </div>
          <CardDescription>Sessions remaining this billing period</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {entitlements.map((ent) => {
              const pct = ent.total > 0 ? (ent.used / ent.total) * 100 : 0;
              const remaining = Math.max(0, ent.total - ent.used);
              return (
                <div key={ent.key} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{ent.label}</span>
                    <span className="font-medium">
                      {ent.total === 999 ? `${ent.used}` : `${ent.used}/${ent.total}`}
                    </span>
                  </div>
                  <Progress value={ent.total === 999 ? 0 : pct} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    {ent.total === 999 ? "Unlimited" : `${remaining} remaining`}
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSessions || "-"}</div>
            <p className="text-xs text-muted-foreground">All modules combined</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {avgScore !== null ? (
                <><span className={avgScore >= 70 ? "text-secondary" : avgScore >= 50 ? "text-primary" : "text-destructive"}>{avgScore}</span><span className="text-muted-foreground text-sm">/100</span></>
              ) : "-"}
            </div>
            <p className="text-xs text-muted-foreground">
              {avgScore !== null ? "Across all sessions" : "No scored sessions yet"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Decks Analyzed</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{usage?.e1DeckAnalyses ?? "-"}</div>
            <p className="text-xs text-muted-foreground">
              {limits.e1 > 0 ? `${Math.max(0, limits.e1 - (usage?.e1DeckAnalyses ?? 0))} remaining` : "Not available on plan"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Practice Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-muted-foreground">Not yet tracked</p>
          </CardContent>
        </Card>
      </div>

      {/* Modules Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Coaching Modules</h2>
          <Link href="/pricing" className="text-sm text-primary hover:underline">
            View all plans
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {modules.map((module) => {
            const pct = module.limit > 0 && module.limit !== 999 ? (module.sessions / module.limit) * 100 : 0;
            return (
              <Card key={module.id} className="group hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className={`p-2.5 rounded-lg ${module.color}`}>
                      <module.icon className="w-6 h-6" />
                    </div>
                    <div className="flex items-center gap-2">
                      {module.status === "upgrade" && (
                        <Badge variant="outline" className="text-xs">Upgrade</Badge>
                      )}
                      <Badge variant="secondary">
                        {module.limit === 999 ? `${module.sessions}` : `${module.sessions}/${module.limit}`}
                      </Badge>
                    </div>
                  </div>
                  <CardTitle className="text-lg">{module.title}</CardTitle>
                  <CardDescription>{module.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex-1 mr-4">
                      <Progress value={module.limit === 999 ? 0 : pct} className="h-2" />
                    </div>
                    <Link href={module.href}>
                      <Button size="sm" className="gap-1 bg-primary hover:bg-primary/90">
                        Start <ArrowRight className="w-3 h-3" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Recent Sessions */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Recent Activity</h2>
          <Link href="/history" className="text-sm text-primary hover:underline">
            View all
          </Link>
        </div>
        <Card>
          <CardContent className="p-0">
            {recentSessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No sessions yet</p>
                <p className="text-sm text-muted-foreground mb-4">Start your first coaching session</p>
                <Link href="/pitch-deck-analyser/new">
                  <Button size="sm" className="gap-2">
                    <Zap className="w-4 h-4" />
                    Start Now
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="divide-y">
                {recentSessions.map((session) => (
                  <Link
                    key={session.id}
                    href={session.href}
                    className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${session.colorClass}`}>
                        <session.icon className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-medium">{session.name}</p>
                        <p className="text-sm text-muted-foreground">{session.type}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-medium">
                          {session.score != null ? (
                            <>
                              <span className={session.score >= 70 ? "text-secondary" : session.score >= 50 ? "text-primary" : "text-destructive"}>
                                {session.score}
                              </span>
                              <span className="text-muted-foreground">/100</span>
                            </>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </p>
                        <p className="text-sm text-muted-foreground">{formatDate(session.date)}</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Tips Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              Getting Started
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Upload your pitch deck to get a comprehensive analysis of your content,
              design, and investor readiness.
            </p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-accent/10 to-accent/5 border-accent/20">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-accent" />
              Recommended Next
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Practice your elevator pitch with the Script Coach to improve your hook.
            </p>
            <Link href="/elevator-script/new">
              <Button size="sm" variant="outline" className="gap-1">
                Start Now <ArrowRight className="w-3 h-3" />
              </Button>
            </Link>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-500/5 border-orange-500/20">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Video className="w-5 h-5 text-orange-500" />
              Practice Live
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              {limits.e3 > 0
                ? `You have ${Math.max(0, limits.e3 - (usage?.e3LivePitchSessions ?? 0))} live sessions remaining. Practice your delivery today.`
                : "Upgrade to access live pitch recording and delivery feedback."}
            </p>
            <Link href={limits.e3 > 0 ? "/elevator-pitch-live/new" : "/pricing"}>
              <Button size="sm" variant="outline" className="gap-1">
                {limits.e3 > 0 ? "Record Pitch" : "View Plans"} <ArrowRight className="w-3 h-3" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
