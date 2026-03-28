"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
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
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

const modules = [
  {
    id: "m1",
    title: "Pitch Deck Analyser",
    description: "Upload your pitch deck for comprehensive content and visual analysis",
    icon: Presentation,
    href: "/pitch-deck-analyser/new",
    color: "bg-primary/10 text-primary",
    sessions: 3,
    limit: 5,
    status: "active" as const,
  },
  {
    id: "m2",
    title: "Script Check",
    description: "Perfect your elevator pitch with AI-powered script analysis",
    icon: MessageSquare,
    href: "/elevator-script/new",
    color: "bg-secondary/10 text-secondary",
    sessions: 12,
    limit: 20,
    status: "active" as const,
  },
  {
    id: "m3",
    title: "Elevator Pitch Live",
    description: "Script coaching plus live recording with delivery feedback",
    icon: Video,
    href: "/elevator-pitch-live/new",
    color: "bg-orange-500/10 text-orange-500",
    sessions: 2,
    limit: 5,
    status: "active" as const,
  },
  {
    id: "m4",
    title: "Full Pitch Session",
    description: "Complete 30-minute session with deck and video analysis",
    icon: TrendingUp,
    href: "/pricing",
    color: "bg-emerald-500/10 text-emerald-500",
    sessions: 0,
    limit: 2,
    status: "upgrade" as const,
  },
];

const recentSessions = [
  {
    id: "1",
    type: "Deck Analysis",
    name: "Series A Deck v2.3",
    score: 78,
    date: "2 hours ago",
    status: "completed" as const,
  },
  {
    id: "2",
    type: "Script Coach",
    name: "Elevator Pitch - TechCrunch",
    score: 85,
    date: "Yesterday",
    status: "completed" as const,
  },
  {
    id: "3",
    type: "Live Pitch",
    name: "Demo Day Practice",
    score: 72,
    date: "3 days ago",
    status: "completed" as const,
  },
];

const entitlements = {
  m1: { used: 3, total: 5, label: "Deck Analyses" },
  m2: { used: 12, total: 20, label: "Script Sessions" },
  m3: { used: 2, total: 5, label: "Live Sessions" },
  m4: { used: 0, total: 2, label: "Full Sessions" },
};

export default function DashboardPage() {
  const { user } = useUser();
  const firstName = user?.firstName || "there";

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
          <Link href="/coach/deck">
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
            <Badge variant="secondary" className="bg-accent/10 text-accent">Pro Plan</Badge>
          </div>
          <CardDescription>Sessions remaining this billing period</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(entitlements).map(([key, ent]) => (
              <div key={key} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{ent.label}</span>
                  <span className="font-medium">{ent.used}/{ent.total}</span>
                </div>
                <Progress 
                  value={(ent.used / ent.total) * 100} 
                  className="h-2"
                />
                <p className="text-xs text-muted-foreground">
                  {ent.total - ent.used} remaining
                </p>
              </div>
            ))}
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
            <div className="text-2xl font-bold">17</div>
            <p className="text-xs text-muted-foreground">+5 this month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">76<span className="text-muted-foreground text-sm">/100</span></div>
            <p className="text-xs text-accent">+8% improvement</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Decks Analyzed</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3</div>
            <p className="text-xs text-muted-foreground">2 remaining this month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Practice Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">4.2h</div>
            <p className="text-xs text-muted-foreground">This month</p>
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
          {modules.map((module) => (
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
                      {module.sessions}/{module.limit}
                    </Badge>
                  </div>
                </div>
                <CardTitle className="text-lg">{module.title}</CardTitle>
                <CardDescription>{module.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex-1 mr-4">
                    <Progress 
                      value={(module.sessions / module.limit) * 100} 
                      className="h-2" 
                    />
                  </div>
                  <Link href={module.href}>
                    <Button size="sm" className="gap-1 bg-primary hover:bg-primary/90">
                      Start <ArrowRight className="w-3 h-3" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
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
                <Link href="/coach/deck">
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
                    href={`/coach/deck/session/${session.id}`}
                    className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{session.name}</p>
                        <p className="text-sm text-muted-foreground">{session.type}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-medium">
                          <span className={session.score >= 80 ? "text-accent" : session.score >= 60 ? "text-primary" : "text-destructive"}>
                            {session.score}
                          </span>
                          <span className="text-muted-foreground">/100</span>
                        </p>
                        <p className="text-sm text-muted-foreground">{session.date}</p>
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

      {/* Quick Links */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              Quick Tips
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Focus on your deck&apos;s traction slide - it&apos;s your lowest scoring area. 
              Add concrete metrics like MRR or user growth.
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
            <Link href="/coach/script">
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
              You have 3 live sessions remaining. Practice your delivery today.
            </p>
            <Link href="/coach/live">
              <Button size="sm" variant="outline" className="gap-1">
                Record Pitch <ArrowRight className="w-3 h-3" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
