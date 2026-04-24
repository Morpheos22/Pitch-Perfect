"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  MessageSquare, 
  Video, 
  ChevronRight, 
  CheckCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

const PLAN_LIMITS: Record<string, { e2: number; e3: number }> = {
  FREE: { e2: 1, e3: 0 },
  STARTER: { e2: 10, e3: 3 },
  PROFESSIONAL: { e2: 30, e3: 10 },
  ENTERPRISE: { e2: 999, e3: 999 },
};

interface HistoryItem {
  id: string;
  type: string;
  name: string;
  score: number | null;
  date: string;
  href: string;
}

export default function ElevatorPitchLiveNewPage() {
  const router = useRouter();

  const [usedE2, setUsedE2] = useState<number | null>(null);
  const [usedE3, setUsedE3] = useState<number | null>(null);
  const [limitE2, setLimitE2] = useState<number | null>(null);
  const [limitE3, setLimitE3] = useState<number | null>(null);
  const [isEnterprise, setIsEnterprise] = useState(false);
  const [recentSessions, setRecentSessions] = useState<HistoryItem[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [userRes, historyRes] = await Promise.all([
          fetch("/api/user/sync"),
          fetch("/api/history?limit=5"),
        ]);

        if (cancelled) return;

        // Parse user data
        if (userRes.ok) {
          const userJson = await userRes.json();
          if (userJson.success && userJson.user) {
            const plan = userJson.user.subscription?.plan || "FREE";
            const usage = userJson.user.usage;
            const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.FREE;
            setUsedE2(usage?.e2ScriptCoachSessions ?? 0);
            setUsedE3(usage?.e3LivePitchSessions ?? 0);
            setLimitE2(limits.e2);
            setLimitE3(limits.e3);
            setIsEnterprise(plan === "ENTERPRISE");
          }
        }

        // Parse history for recent sessions
        if (historyRes.ok) {
          const histJson = await historyRes.json();
          if (histJson.success && histJson.data) {
            const items: HistoryItem[] = [];
            const { scripts, videos } = histJson.data;

            if (scripts) {
              scripts.slice(0, 3).forEach((s: any) => {
                items.push({
                  id: s.id,
                  type: "script",
                  name: s.fileName || "Script Analysis",
                  score: s.overallScore,
                  date: s.createdAt,
                  href: `/elevator-script/session/${s.id}`,
                });
              });
            }

            if (videos) {
              videos.slice(0, 3).forEach((v: any) => {
                items.push({
                  id: v.id,
                  type: "live",
                  name: v.fileName || `Live Recording ${v.duration ? `(${Math.round(v.duration / 60)}s)` : ""}`,
                  score: v.overallDeliveryScore,
                  date: v.createdAt,
                  href: `/elevator-pitch-live/live/session/${v.id}`,
                });
              });
            }

            // Sort by date descending
            items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setRecentSessions(items.slice(0, 5));
          }
        }
      } catch {
        // Non-critical — counters will show "Loading..."
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  // Compute display values
  const scriptUsed = usedE2 ?? 0;
  const scriptTotal = limitE2 ?? 0;
  const liveUsed = usedE3 ?? 0;
  const liveTotal = limitE3 ?? 0;

  const scriptPct = scriptTotal > 0 && !isEnterprise ? (scriptUsed / scriptTotal) * 100 : 0;
  const livePct = liveTotal > 0 && !isEnterprise ? (liveUsed / liveTotal) * 100 : 0;

  const scriptRemaining = isEnterprise ? "Unlimited" : `${Math.max(0, scriptTotal - scriptUsed)} remaining`;
  const liveRemaining = isEnterprise ? "Unlimited" : `${Math.max(0, liveTotal - liveUsed)} remaining`;

  const scriptSessionLabel = isEnterprise ? `${scriptUsed}` : `${scriptUsed}/${scriptTotal}`;
  const liveSessionLabel = isEnterprise ? `${liveUsed}` : `${liveUsed}/${liveTotal}`;

  const isLoading = usedE2 === null;

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

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Live Pitch</h1>
        <p className="text-muted-foreground">Script coaching plus live delivery practice</p>
      </div>

      {/* Session Counters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-primary/20">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Script Sessions (M2)</CardTitle>
              <MessageSquare className="h-5 w-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center gap-2 py-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Loading...</span>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl font-bold">
                    {scriptSessionLabel}<span className="text-muted-foreground font-normal">
                      {isEnterprise ? "" : `/${scriptTotal}`}
                    </span>
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {scriptRemaining}
                  </span>
                </div>
                <Progress value={isEnterprise ? 0 : scriptPct} className="h-2" />
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-primary/20">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Live Recording Sessions (M3)</CardTitle>
              <Video className="h-5 w-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center gap-2 py-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Loading...</span>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl font-bold">
                    {liveSessionLabel}<span className="text-muted-foreground font-normal">
                      {isEnterprise ? "" : `/${liveTotal}`}
                    </span>
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {liveRemaining}
                  </span>
                </div>
                <Progress value={isEnterprise ? 0 : livePct} className="h-2" />
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Coaching Recommendation */}
      {!isLoading && scriptUsed === 0 && (
        <Card className="border-secondary/30 bg-secondary/5">
          <CardHeader>
            <CardTitle className="text-lg">Start with Your Script</CardTitle>
            <CardDescription>
              Before you record yourself live, sharpen what you&apos;re going to say.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Run your script through the script coach first — you&apos;ll get feedback on structure, 
              flow, and your key message. Then practise delivering a pitch you&apos;ve already refined.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Session Type Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Script Session */}
        <Card className="cursor-pointer hover:border-primary/50 transition-colors group" onClick={() => router.push("/elevator-pitch-live/script/new")}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <MessageSquare className="h-6 w-6 text-primary" />
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <CardTitle className="text-xl mt-4">Check My Script First</CardTitle>
            <CardDescription>Refine your pitch content before recording</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <Badge variant="secondary">{isLoading ? "..." : scriptRemaining} script sessions remaining</Badge>
              <Button className="bg-primary hover:bg-primary/90" onClick={(e) => { e.stopPropagation(); router.push("/elevator-pitch-live/script/new"); }}>
                Start
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Live Recording Session */}
        <Card className="cursor-pointer hover:border-primary/50 transition-colors group" onClick={() => router.push("/elevator-pitch-live/live/new")}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center">
                <Video className="h-6 w-6 text-secondary" />
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <CardTitle className="text-xl mt-4">I&apos;m Ready to Record Live</CardTitle>
            <CardDescription>Practise delivering your pitch on camera</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <Badge variant="secondary">{isLoading ? "..." : liveRemaining} live sessions remaining</Badge>
              <Button className="bg-secondary hover:bg-secondary/90" onClick={(e) => { e.stopPropagation(); router.push("/elevator-pitch-live/live/new"); }}>
                Record
              </Button>
            </div>
            {!isLoading && scriptUsed === 0 && (
              <p className="text-xs text-muted-foreground mt-3">
                Have you already refined your script? Go ahead and record.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Sessions */}
      {recentSessions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Sessions</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {recentSessions.map((session) => (
                <Link
                  key={session.id}
                  href={session.href}
                  className="flex items-center justify-between p-4 hover:bg-muted/50 cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      session.type === "script" ? "bg-primary/10" : "bg-secondary/10"
                    }`}>
                      {session.type === "script" ? (
                        <MessageSquare className="h-5 w-5 text-primary" />
                      ) : (
                        <Video className="h-5 w-5 text-secondary" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{session.name}</p>
                      <p className="text-sm text-muted-foreground capitalize">{session.type} session</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-bold text-lg">
                        {session.score != null ? session.score : <span className="text-muted-foreground">—</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDate(session.date)}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state when no recent sessions */}
      {recentSessions.length === 0 && !isLoading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No sessions yet</p>
            <p className="text-sm text-muted-foreground mb-4">Start your first coaching session</p>
          </CardContent>
        </Card>
      )}

      {/* Quick Links */}
      <div className="flex gap-4">
        <Button variant="outline" onClick={() => router.push("/history")}>
          View All Sessions
        </Button>
        <Button variant="outline" onClick={() => router.push("/dashboard")}>
          Back to Dashboard
        </Button>
      </div>
    </div>
  );
}
