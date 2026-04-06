"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Presentation,
  MessageSquare,
  Video,
  TrendingUp,
  Search,
  Filter,
  ChevronRight,
  Calendar,
  AlertCircle,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// ── Types ──
interface HistoryDeck {
  id: string;
  fileName: string;
  overallScore: number | null;
  status: string;
  createdAt: string;
  analyzedAt: string | null;
}

interface HistoryScript {
  id: string;
  fileName: string;
  overallScore: number | null;
  status: string;
  createdAt: string;
  analyzedAt: string | null;
  targetAudience: string | null;
}

interface HistoryVideo {
  id: string;
  thumbnailUrl: string | null;
  duration: number;
  overallDeliveryScore: number | null;
  overallBodyLanguageScore: number | null;
  status: string;
  createdAt: string;
  analyzedAt: string | null;
}

interface HistoryFullSession {
  id: string;
  thumbnailUrl: string | null;
  duration: number;
  overallReadinessScore: number | null;
  investorReadinessLevel: string | null;
  status: string;
  createdAt: string;
  analyzedAt: string | null;
  pitchDeck: { id: string; fileName: string } | null;
}

interface HistoryData {
  data: {
    decks?: HistoryDeck[];
    scripts?: HistoryScript[];
    videos?: HistoryVideo[];
    fullSessions?: HistoryFullSession[];
  };
  counts: { decks: number; scripts: number; videos: number; fullSessions: number };
}

interface UnifiedSession {
  id: string;
  name: string;
  module: string;
  moduleLabel: string;
  date: string;
  score: number | null;
  status: string;
  icon: typeof Presentation;
  href: string;
}

function getModuleColor(module: string) {
  switch (module) {
    case "deck":
      return "bg-primary/10 text-primary";
    case "script":
      return "bg-secondary/10 text-secondary";
    case "live":
      return "bg-orange-500/10 text-orange-500";
    case "full":
      return "bg-emerald-500/10 text-emerald-500";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function getScoreColor(score: number | null) {
  if (score == null) return "text-muted-foreground";
  if (score >= 70) return "text-secondary";
  if (score >= 40) return "text-yellow-500";
  return "text-destructive";
}

export default function HistoryPage() {
  const router = useRouter();
  const [historyData, setHistoryData] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async (type?: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("limit", "50");
      if (type && type !== "all") params.set("type", type);
      const res = await fetch(`/api/history?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch history");
      const json = await res.json();
      if (json.success) {
        setHistoryData(json);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Re-fetch when module filter changes
  useEffect(() => {
    if (moduleFilter === "all") {
      fetchHistory();
    } else {
      const typeMap: Record<string, string> = {
        "pitch-deck": "deck",
        "script": "script",
        "live": "video",
        "full": "full",
      };
      fetchHistory(typeMap[moduleFilter]);
    }
  }, [moduleFilter, fetchHistory]);

  // Flatten all sessions into unified list
  const sessions: UnifiedSession[] = [];

  if (historyData?.data) {
    const { decks, scripts, videos, fullSessions } = historyData.data;

    if (decks) {
      decks.forEach((d) => {
        sessions.push({
          id: d.id, name: d.fileName || "Untitled Deck", module: "pitch-deck",
          moduleLabel: "Pitch Deck Analyser", date: d.createdAt,
          score: d.overallScore, status: d.status,
          icon: Presentation, href: `/pitch-deck-analyser/session/${d.id}`,
        });
      });
    }
    if (scripts) {
      scripts.forEach((s) => {
        sessions.push({
          id: s.id, name: s.fileName || "Untitled Script", module: "script",
          moduleLabel: "Script Check", date: s.createdAt,
          score: s.overallScore, status: s.status,
          icon: MessageSquare, href: `/elevator-script/session/${s.id}`,
        });
      });
    }
    if (videos) {
      videos.forEach((v) => {
        const dur = v.duration ? `${Math.round(v.duration / 60)}s video` : "Video";
        sessions.push({
          id: v.id, name: dur, module: "live",
          moduleLabel: "Live Recording", date: v.createdAt,
          score: v.overallDeliveryScore, status: v.status,
          icon: Video, href: `/elevator-pitch-live/live/session/${v.id}`,
        });
      });
    }
    if (fullSessions) {
      fullSessions.forEach((f) => {
        sessions.push({
          id: f.id, name: f.pitchDeck?.fileName || "Full Pitch Session", module: "full",
          moduleLabel: "Full Session", date: f.createdAt,
          score: f.overallReadinessScore, status: f.status,
          icon: TrendingUp, href: `/coach/full/session/${f.id}`,
        });
      });
    }

    // Sort by date descending
    sessions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  // Client-side search filter
  const filteredSessions = sessions.filter((session) => {
    const matchesSearch = session.name.toLowerCase().includes(search.toLowerCase());
    return matchesSearch;
  });

  // Compute score stats for chart
  const chartSessions = filteredSessions.filter((s) => s.score != null);
  const maxChartBars = 10;
  const chartData = chartSessions.slice(-maxChartBars);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Session History</h1>
        <p className="text-muted-foreground">All your coaching sessions in one place</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search sessions..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={moduleFilter} onValueChange={setModuleFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by module" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modules</SelectItem>
                <SelectItem value="pitch-deck">Pitch Deck Analyser</SelectItem>
                <SelectItem value="script">Script Check</SelectItem>
                <SelectItem value="live">Live Recording</SelectItem>
                <SelectItem value="full">Full Session</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Score Progression Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Score Progression</CardTitle>
            <CardDescription>Your improvement over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between h-32 gap-2">
              {chartData.map((session, index) => {
                const score = session.score!;
                const color = score >= 70
                  ? "bg-secondary"
                  : score >= 40
                    ? "bg-yellow-500"
                    : "bg-destructive";
                return (
                  <div key={`${session.id}-${index}`} className="flex-1 flex flex-col items-center gap-2">
                    <div
                      className={`w-full rounded-t ${color}`}
                      style={{ height: `${Math.max(score, 5)}%` }}
                    />
                    <span className="text-xs text-muted-foreground">{score}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-4 text-xs text-muted-foreground">
              <span>Oldest</span>
              <span>Most Recent</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sessions Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="w-12 h-12 text-destructive mb-4" />
              <p className="text-muted-foreground">{error}</p>
              <Button variant="outline" className="mt-4" onClick={() => fetchHistory()}>
                Retry
              </Button>
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FileText className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="font-medium text-lg">No sessions yet</p>
              <p className="text-sm text-muted-foreground mb-4">
                {search || moduleFilter !== "all"
                  ? "No sessions match your filters."
                  : "Start your first coaching session to see it here."}
              </p>
              {(search || moduleFilter !== "all") && (
                <Button
                  variant="outline"
                  onClick={() => { setSearch(""); setModuleFilter("all"); }}
                >
                  Clear Filters
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Session Name</TableHead>
                  <TableHead>Module</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSessions.map((session) => (
                  <TableRow
                    key={session.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(session.href)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${getModuleColor(session.module)}`}>
                          <session.icon className="h-4 w-4" />
                        </div>
                        <span className="font-medium">{session.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{session.moduleLabel}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {new Date(session.date).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell>
                      {session.score != null ? (
                        <>
                          <span className={`font-bold ${getScoreColor(session.score)}`}>
                            {session.score}
                          </span>
                          <span className="text-muted-foreground">/100</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          session.status === "COMPLETED" ? "default" :
                          session.status === "PROCESSING" ? "secondary" :
                          "outline"
                        }
                        className="text-xs"
                      >
                        {session.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Summary counts */}
      {!loading && historyData?.counts && (
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span>Total: {historyData.counts.decks + historyData.counts.scripts + historyData.counts.videos + historyData.counts.fullSessions} sessions</span>
          <span>•</span>
          <span>Decks: {historyData.counts.decks}</span>
          <span>•</span>
          <span>Scripts: {historyData.counts.scripts}</span>
          <span>•</span>
          <span>Videos: {historyData.counts.videos}</span>
          <span>•</span>
          <span>Full Sessions: {historyData.counts.fullSessions}</span>
        </div>
      )}
    </div>
  );
}
