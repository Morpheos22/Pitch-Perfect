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
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";

interface ScriptSession {
  id: string;
  fileName: string;
  overallScore: number | null;
  createdAt: string;
  status: string;
  targetAudience?: string;
}

export default function ScriptHistoryPage() {
  const [sessions, setSessions] = useState<ScriptSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("date");

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch("/api/history?type=script&limit=50");
        if (!res.ok) throw new Error("Failed to fetch history");
        const json = await res.json();
        if (json.success && json.data?.scripts) {
          setSessions(json.data.scripts);
        }
      } catch {
        setError("Failed to load history");
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  const getScoreChange = (index: number, sorted: ScriptSession[]): number | null => {
    if (index >= sorted.length - 1) return null;
    const current = sorted[index].overallScore;
    const previous = sorted[index + 1].overallScore;
    if (current === null || previous === null) return null;
    return current - previous;
  };

  const filteredSessions = sessions.filter((session) =>
    session.fileName.toLowerCase().includes(search.toLowerCase())
  );

  const sortedSessions = [...filteredSessions].sort((a, b) => {
    if (sortBy === "date") {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    if (sortBy === "score") {
      return (b.overallScore ?? 0) - (a.overallScore ?? 0);
    }
    return 0;
  });

  // Score progression chart (last 10 scored sessions, oldest first)
  const scoredSessions = [...sessions]
    .filter((s) => s.overallScore !== null)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .slice(-10);

  const scoreProgression = scoredSessions.map((s) => ({
    date: new Date(s.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    score: s.overallScore!,
  }));

  const getChangeIcon = (change: number | null) => {
    if (change === null) return <Minus className="w-4 h-4 text-muted-foreground" />;
    if (change > 0) return <TrendingUp className="w-4 h-4 text-accent" />;
    if (change < 0) return <TrendingDown className="w-4 h-4 text-destructive" />;
    return <Minus className="w-4 h-4 text-muted-foreground" />;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="h-9 w-9 animate-pulse bg-muted rounded" />
          <div className="space-y-2">
            <div className="h-6 w-48 animate-pulse bg-muted rounded" />
            <div className="h-4 w-64 animate-pulse bg-muted rounded" />
          </div>
        </div>
        <div className="h-48 animate-pulse bg-muted rounded-lg" />
        <div className="h-96 animate-pulse bg-muted rounded-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <MessageSquare className="w-6 h-6 text-accent" />
              Script Analysis History
            </h1>
          </div>
        </div>
        <Card className="border-destructive/30">
          <CardContent className="py-12 text-center">
            <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-3" />
            <p className="text-muted-foreground">{error}</p>
            <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

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
      {scoreProgression.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Score Progression</CardTitle>
            <CardDescription>Your script scores over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-40 flex items-end justify-between gap-4 px-4">
              {scoreProgression.map((item, index) => {
                const height = (item.score / 100) * 100;
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
          <CardDescription>{sortedSessions.length} analysis sessions</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {sortedSessions.length === 0 ? (
            <div className="py-12 text-center">
              <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">
                {sessions.length === 0 ? "No script analyses yet" : "No sessions match your search"}
              </p>
              {sessions.length === 0 && (
                <Link href="/elevator-script/new">
                  <Button className="mt-4" size="sm">Start Your First Analysis</Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="divide-y max-h-[600px] overflow-y-auto">
              {sortedSessions.map((session, index) => {
                const change = getScoreChange(index, sortedSessions);
                return (
                  <Link
                    key={session.id}
                    href={`/elevator-script/session/${session.id}`}
                    className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-accent" />
                      </div>
                      <div>
                        <p className="font-medium">{session.fileName}</p>
                        <p className="text-sm text-muted-foreground flex items-center gap-2">
                          <Calendar className="w-3 h-3" />
                          {new Date(session.createdAt).toLocaleDateString()}
                          {session.targetAudience && (
                            <Badge variant="outline" className="text-xs">{session.targetAudience}</Badge>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        {getChangeIcon(change)}
                        {change !== null && (
                          <span className={`text-sm ${change > 0 ? "text-accent" : change < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                            {change > 0 ? "+" : ""}{change}
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold">{session.overallScore ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">/ 100</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
