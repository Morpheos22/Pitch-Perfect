"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ModuleCard, ProgressTracker } from "@/components/founder";
import Link from "next/link";
import {
  Rocket,
  Route,
  Search,
  Users,
  UserCircle,
  Headphones,
  ArrowLeft,
  Sparkles,
  CheckCircle2,
  Target,
  Lock,
  ArrowRight,
  ShieldCheck,
  Crown,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────

type PlanType = "FREE" | "STARTER" | "PROFESSIONAL" | "ENTERPRISE" | "FOUNDER" | "JJC" | "INTERN" | "COFOUNDER";

const subModules = [
  {
    title: "Founder Readiness",
    description: "Self-assessment of your pitch readiness — deck quality, confidence, market timing, and team preparedness.",
    icon: Target,
    href: "/founder/readiness",
    color: "bg-primary/10 text-primary",
    badge: "Step 1",
    key: "FOUNDER_READINESS" as const,
  },
  {
    title: "Pathway Recommendation",
    description: "AI-recommended pathway — Grit to Gear (cohort → mentorship → certification) or AfriFlow Direct.",
    icon: Route,
    href: "/founder/pathway",
    color: "bg-emerald-500/10 text-emerald-500",
    badge: "Step 2",
    key: "PATHWAY_RECOMMENDATION" as const,
  },
  {
    title: "Investor Research",
    description: "Research potential investors matching your startup sector, stage, and geography using AI-powered web search.",
    icon: Search,
    href: "/founder/research",
    color: "bg-orange-500/10 text-orange-500",
    badge: "Step 3",
    key: "INVESTOR_RESEARCH" as const,
  },
  {
    title: "Cohort Matching",
    description: "Match with accelerator and incubator cohorts — Small Axe education, mentor alignment, certification track.",
    icon: Users,
    href: "/founder/cohort",
    color: "bg-secondary/10 text-secondary",
    badge: "Step 4",
    key: "COHORT_MATCHING" as const,
  },
  {
    title: "Network Profile",
    description: "Build your investor-facing network profile — standout summary, highlights, and AfriFlow submission readiness.",
    icon: UserCircle,
    href: "/founder/network",
    color: "bg-violet-500/10 text-violet-500",
    badge: "Step 5",
    key: "NETWORK_PROFILE" as const,
  },
  {
    title: "Pathway Narration",
    description: "TTS-narrated overview of your recommended pathway, next steps, and what to expect on your journey.",
    icon: Headphones,
    href: "/founder/narration",
    color: "bg-amber-500/10 text-amber-500",
    badge: "Step 6",
    key: "PATHWAY_NARRATION" as const,
  },
];

interface FounderHistory {
  moduleType: string;
  completedAt?: string;
  overallScore?: number;
  recommendedPathway?: string;
}

// ─── Page Component ──────────────────────────────────────────────────

export default function FounderPage() {
  const [history, setHistory] = useState<FounderHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [userPlan, setUserPlan] = useState<PlanType>("FREE");
  const [planLoading, setPlanLoading] = useState(true);

  const completedModules = new Set(
    history.filter((h) => h.completedAt).map((h) => h.moduleType)
  );
  const completedCount = completedModules.size;
  const totalModules = subModules.length;

  const hasAccess = userPlan === "ENTERPRISE" || userPlan === "FOUNDER";

  useEffect(() => {
    async function fetchPlan() {
      try {
        const res = await fetch("/api/user/sync");
        if (res.ok) {
          const data = await res.json();
          setUserPlan(data.user?.subscription?.plan || "FREE");
        }
      } catch (err) {
        console.error("Failed to fetch user plan:", err);
      } finally {
        setPlanLoading(false);
      }
    }
    fetchPlan();
  }, []);

  useEffect(() => {
    async function fetchHistory() {
      try {
        const res = await fetch("/api/coach/founder");
        if (res.ok) {
          const data = await res.json();
          setHistory(data.sessions || []);
        }
      } catch (err) {
        console.error("Failed to fetch founder history:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchHistory();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Rocket className="w-6 h-6 text-primary" />
              Pitch Founder
            </h1>
            <Badge
              variant="secondary"
              className={
                hasAccess
                  ? "bg-emerald-500/10 text-emerald-600"
                  : "bg-amber-500/10 text-amber-600"
              }
            >
              {planLoading ? "…" : hasAccess ? "Access Granted" : "Founder"}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            E5 — Conversion layer to the PitchCoach Ai Network
          </p>
        </div>
      </div>

      {/* Access Control Banner */}
      {!planLoading && !hasAccess && (
        <Card className="border-amber-500/30 bg-gradient-to-r from-amber-500/5 to-orange-500/5">
          <CardContent className="py-5">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                  <Lock className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Founder Coaching requires Founder tier</h3>
                  <p className="text-sm text-muted-foreground max-w-lg">
                    The E5 Founder Coaching module is available on the{" "}
                    <span className="font-semibold text-foreground">Founder plan (₦30,000)</span>.
                    It includes all 6 sub-modules: Readiness, Pathway, Research, Cohort, Network, and Narration.
                    Upgrade to unlock your journey into the PitchCoach Ai Network.
                  </p>
                </div>
              </div>
              <Link href="/pricing" className="shrink-0">
                <Button className="bg-amber-500 hover:bg-amber-600 text-white" size="lg">
                  Upgrade to Founder
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Access Granted Banner */}
      {!planLoading && hasAccess && (
        <Card className="border-emerald-500/30 bg-gradient-to-r from-emerald-500/5 to-teal-500/5">
          <CardContent className="py-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-6 h-6 text-emerald-500" />
              </div>
              <div>
                <h3 className="font-bold text-lg flex items-center gap-2">
                  Access Granted
                  {(userPlan === "ENTERPRISE" || userPlan === "FOUNDER") && (
                    <Badge className="bg-amber-500 text-white text-xs">
                      <Crown className="w-3 h-3 mr-1" />
                      Founder
                    </Badge>
                  )}
                </h3>
                <p className="text-sm text-muted-foreground">
                  You have full access to all 6 Founder Coaching modules. Start your journey below.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Overview Card */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold">Your Founder Journey</h2>
              </div>
              <p className="text-sm text-muted-foreground max-w-lg">
                The Pitch Founder module transforms you from a user into a candidate for the
                PitchCoach Ai Network. Complete all 6 steps to unlock your pathway to investors.
              </p>
              <div className="flex gap-2 mt-2">
                <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                  Path A: Grit to Gear
                </Badge>
                <Badge variant="outline" className="text-xs border-emerald-500/30 text-emerald-500">
                  Path B: AfriFlow Direct
                </Badge>
              </div>
            </div>
            <div className="flex flex-col items-center gap-2 min-w-[140px]">
              <div className="text-3xl font-bold">
                {loading ? "—" : `${completedCount}/${totalModules}`}
              </div>
              <Progress value={(completedCount / totalModules) * 100} className="h-2 w-32" />
              <span className="text-xs text-muted-foreground">
                {completedCount === totalModules
                  ? "All modules completed!"
                  : `${totalModules - completedCount} remaining`}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Progress Tracker */}
      <ProgressTracker
        completed={completedCount}
        total={totalModules}
        label="Module Completion"
      />

      {/* Two Pathways */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-primary/10">
                <CheckCircle2 className="w-4 h-4 text-primary" />
              </div>
              <CardTitle className="text-base">Path A: Grit to Gear</CardTitle>
            </div>
            <CardDescription className="text-xs">
              For founders seeking mentorship and structured growth
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {["Cohort", "Education", "Mentorship", "Certification", "AfriFlow"].map((step) => (
                <Badge key={step} variant="secondary" className="text-xs">
                  {step}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Discounted cohort → Small Axe education → 1-on-1 mentorship → Certification → Network
            </p>
          </CardContent>
        </Card>
        <Card className="border-emerald-500/20">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-emerald-500/10">
                <Rocket className="w-4 h-4 text-emerald-500" />
              </div>
              <CardTitle className="text-base">Path B: AfriFlow Direct</CardTitle>
            </div>
            <CardDescription className="text-xs">
              For investor-ready founders seeking immediate access
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {["Full Price", "Deck Review", "VC Access", "Immediate", "Network"].map((step) => (
                <Badge key={step} variant="secondary" className="text-xs">
                  {step}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Full price → Deck before VCs/investors → Immediate access → Network
            </p>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Sub-Modules Grid */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Founder Modules</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {subModules.map((mod) => (
            <ModuleCard
              key={mod.key}
              title={mod.title}
              description={mod.description}
              icon={mod.icon}
              href={hasAccess ? mod.href : "/pricing"}
              color={mod.color}
              badge={mod.badge}
              completed={completedModules.has(mod.key)}
            />
          ))}
        </div>
        {!hasAccess && (
          <p className="text-xs text-muted-foreground mt-3 text-center">
            Module links redirect to the pricing page. Upgrade to Founder for full access.
          </p>
        )}
      </div>

      {/* Recent Activity */}
      {!loading && history.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
          <Card>
            <CardContent className="p-0">
              <div className="divide-y max-h-96 overflow-y-auto">
                {history.map((session, i) => (
                  <div key={i} className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <CheckCircle2 className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium capitalize">
                          {session.moduleType.replace(/_/g, " ")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {session.completedAt
                            ? new Date(session.completedAt).toLocaleDateString()
                            : "In progress"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      {session.overallScore && (
                        <p className="text-sm font-medium">
                          <span
                            className={
                              session.overallScore >= 80
                                ? "text-emerald-500"
                                : session.overallScore >= 60
                                  ? "text-primary"
                                  : "text-destructive"
                            }
                          >
                            {session.overallScore}
                          </span>
                          <span className="text-muted-foreground">/100</span>
                        </p>
                      )}
                      {session.recommendedPathway && (
                        <Badge variant="outline" className="text-xs mt-1">
                          {session.recommendedPathway === "GRIT_TO_GEAR"
                            ? "Path A"
                            : "Path B"}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
