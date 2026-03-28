"use client";

import { useRouter } from "next/navigation";
import { 
  MessageSquare, 
  Video, 
  ChevronRight, 
  CheckCircle,
  Presentation,
  TrendingUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

const recentSessions = [
  { id: "1", type: "script", name: "Investor Pitch v1", score: 74, date: "Today" },
  { id: "2", type: "live", name: "Practice Round 1", score: 68, date: "Yesterday" },
];

export default function ElevatorPitchLiveNewPage() {
  const router = useRouter();

  // Mock counters
  const scriptSessions = { used: 1, total: 2 };
  const liveSessions = { used: 1, total: 3 };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Elevator Pitch Live</h1>
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
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl font-bold">
                {scriptSessions.used}<span className="text-muted-foreground font-normal">/{scriptSessions.total}</span>
              </span>
              <span className="text-sm text-muted-foreground">
                {scriptSessions.total - scriptSessions.used} remaining
              </span>
            </div>
            <Progress value={(scriptSessions.used / scriptSessions.total) * 100} className="h-2" />
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
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl font-bold">
                {liveSessions.used}<span className="text-muted-foreground font-normal">/{liveSessions.total}</span>
              </span>
              <span className="text-sm text-muted-foreground">
                {liveSessions.total - liveSessions.used} remaining
              </span>
            </div>
            <Progress value={(liveSessions.used / liveSessions.total) * 100} className="h-2" />
          </CardContent>
        </Card>
      </div>

      {/* Coaching Recommendation */}
      {scriptSessions.used === 0 && (
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
              <Badge variant="secondary">{scriptSessions.total - scriptSessions.used} script sessions remaining</Badge>
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
              <Badge variant="secondary">{liveSessions.total - liveSessions.used} live sessions remaining</Badge>
              <Button className="bg-secondary hover:bg-secondary/90" onClick={(e) => { e.stopPropagation(); router.push("/elevator-pitch-live/live/new"); }}>
                Record
              </Button>
            </div>
            {scriptSessions.used === 0 && (
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
                <div
                  key={session.id}
                  className="flex items-center justify-between p-4 hover:bg-muted/50 cursor-pointer"
                  onClick={() => router.push(`/elevator-pitch-live/${session.type}/session/${session.id}`)}
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
                      <p className="font-bold text-lg">{session.score}</p>
                      <p className="text-xs text-muted-foreground">{session.date}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
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
