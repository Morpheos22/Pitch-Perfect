"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MessageSquare,
  ArrowLeft,
  Search,
  Filter,
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  FileText,
  ArrowRight,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface ScriptSession {
  id: string;
  inputType: string;
  inputText: string;
  fileName: string;
  targetAudience: string;
  pitchDuration: number;
  status: string;
  hookScore: number;
  problemScore: number;
  solutionScore: number;
  credibilityScore: number;
  ctaScore: number;
  overallScore: number;
  wordCount: number;
  estimatedDuration: number;
  createdAt: string;
  analyzedAt: string;
}

export default function ScriptHistoryPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<ScriptSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("date");

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const response = await fetch("/api/pitch-script");
      const data = await response.json();
      
      if (response.ok) {
        // API returns scripts array
        const scripts = data.scripts || [];
        
        // Get sessions with scores (completed ones)
        const completedSessions = scripts.filter((s: ScriptSession) => s.status === "COMPLETED" && s.overallScore);
        
        setSessions(completedSessions);
      } else {
        console.error("Failed to fetch sessions:", data.error);
      }
    } catch (error) {
      console.error("Failed to fetch sessions:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredSessions = sessions.filter((session) =>
    (session.fileName || session.inputText || "Script Session").toLowerCase().includes(search.toLowerCase())
  );

  const sortedSessions = [...filteredSessions].sort((a, b) => {
    if (sortBy === "date") {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    if (sortBy === "score") {
      return (b.overallScore || 0) - (a.overallScore || 0);
    }
    return 0;
  });

  // Calculate score progression
  const scoreProgression = sortedSessions
    .slice(0, 5)
    .reverse()
    .map((s, i) => ({
      date: new Date(s.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      score: s.overallScore || 0,
    }));

  const getChangeIcon = (currentScore: number, index: number) => {
    if (index === sortedSessions.length - 1) return <Minus className="w-4 h-4 text-muted-foreground" />;
    const prevScore = sortedSessions[index + 1]?.overallScore || 0;
    const change = currentScore - prevScore;
    if (change > 0) return <TrendingUp className="w-4 h-4 text-secondary" />;
    if (change < 0) return <TrendingDown className="w-4 h-4 text-destructive" />;
    return <Minus className="w-4 h-4 text-muted-foreground" />;
  };

  const getSessionName = (session: ScriptSession) => {
    return session.fileName || `Script Session — ${session.targetAudience || "General"}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-accent" />
            Script Analysis History
          </h1>
          <p className="text-muted-foreground">
            View and compare your previous script analyses
          </p>
        </div>
      </div>

      {/* Score Progression Chart */}
      {scoreProgression.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Score Progression</CardTitle>
            <CardDescription>Your script scores over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-40 flex items-end justify-between gap-4 px-4">
              {scoreProgression.map((item, index) => {
                const height = Math.max((item.score / 100) * 100, 10);
                return (
                  <div key={index} className="flex flex-col items-center gap-2 flex-1">
                    <span className="text-sm font-medium">{item.score}</span>
                    <div
                      className="w-full bg-gradient-to-t from-accent to-primary rounded-t-sm transition-all"
                      style={{ height: `${height}%`, minHeight: "20px" }}
                    />
                    <span className="text-xs text-muted-foreground">{item.date}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search sessions..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-40">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date">Date (newest)</SelectItem>
            <SelectItem value="score">Score (highest)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Session List */}
      <Card>
        <CardHeader>
          <CardTitle>Sessions</CardTitle>
          <CardDescription>
            {loading ? "Loading..." : `${sortedSessions.length} analysis sessions`}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : sortedSessions.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="font-medium">No sessions yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Analyze your first script to see your history here
              </p>
              <Link href="/elevator-script/new">
                <Button className="mt-4">Start Script Analysis</Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y">
              {sortedSessions.map((session, index) => (
                <Link
                  key={session.id}
                  href={`/elevator-script/session/${session.id}`}
                  className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                      <p className="font-medium">{getSessionName(session)}</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <Calendar className="w-3 h-3" />
                        {new Date(session.createdAt).toLocaleDateString()}
                        <Badge variant="outline" className="text-xs">
                          {session.wordCount || session.inputText?.split(/\s+/).length || 0} words
                        </Badge>
                        {session.targetAudience && (
                          <Badge variant="secondary" className="text-xs">
                            {session.targetAudience}
                          </Badge>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      {getChangeIcon(session.overallScore || 0, index)}
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold">{session.overallScore || "—"}</p>
                      <p className="text-xs text-muted-foreground">/ 100</p>
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
  );
}
