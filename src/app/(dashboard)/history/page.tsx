"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Presentation,
  MessageSquare,
  Video,
  TrendingUp,
  Search,
  Filter,
  ChevronRight,
  Download,
  Calendar,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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

interface SessionData {
  id: string;
  name: string;
  module: string;
  type: string;
  date: string;
  score: number | null;
  status: string;
  icon: typeof Presentation;
}

interface HistoryResponse {
  success: boolean;
  data: {
    decks?: Array<{
      id: string;
      fileName: string;
      overallScore: number | null;
      status: string;
      createdAt: string;
    }>;
    scripts?: Array<{
      id: string;
      fileName: string | null;
      overallScore: number | null;
      status: string;
      createdAt: string;
    }>;
    videos?: Array<{
      id: string;
      thumbnailUrl: string | null;
      duration: number;
      overallDeliveryScore: number | null;
      status: string;
      createdAt: string;
    }>;
    fullSessions?: Array<{
      id: string;
      thumbnailUrl: string | null;
      duration: number;
      overallReadinessScore: number | null;
      status: string;
      createdAt: string;
    }>;
  };
  counts: {
    decks: number;
    scripts: number;
    videos: number;
    fullSessions: number;
  };
}

function getScoreColor(score: number | null) {
  if (score === null) return "text-muted-foreground";
  if (score >= 70) return "text-secondary";
  if (score >= 40) return "text-yellow-500";
  return "text-destructive";
}

function getModuleColor(module: string) {
  switch (module) {
    case "pitch-deck":
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

function getModuleIcon(module: string) {
  switch (module) {
    case "pitch-deck":
      return Presentation;
    case "script":
      return MessageSquare;
    case "live":
      return Video;
    case "full":
      return TrendingUp;
    default:
      return Presentation;
  }
}

export default function HistoryPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState({
    decks: 0,
    scripts: 0,
    videos: 0,
    fullSessions: 0,
  });

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/history");
        const data: HistoryResponse = await response.json();

        if (!data.success) {
          throw new Error("Failed to fetch history");
        }

        // Transform data into unified session format
        const allSessions: SessionData[] = [];

        // Add deck sessions
        if (data.data.decks) {
          data.data.decks.forEach((deck) => {
            allSessions.push({
              id: deck.id,
              name: deck.fileName,
              module: "pitch-deck",
              type: "Pitch Deck Analyser",
              date: deck.createdAt,
              score: deck.overallScore,
              status: deck.status,
              icon: Presentation,
            });
          });
        }

        // Add script sessions
        if (data.data.scripts) {
          data.data.scripts.forEach((script) => {
            allSessions.push({
              id: script.id,
              name: script.fileName || "Script Session",
              module: "script",
              type: "Script Check",
              date: script.createdAt,
              score: script.overallScore,
              status: script.status,
              icon: MessageSquare,
            });
          });
        }

        // Add video sessions
        if (data.data.videos) {
          data.data.videos.forEach((video) => {
            allSessions.push({
              id: video.id,
              name: `Live Recording (${Math.floor(video.duration / 60)}:${String(video.duration % 60).padStart(2, "0")})`,
              module: "live",
              type: "Live Recording",
              date: video.createdAt,
              score: video.overallDeliveryScore,
              status: video.status,
              icon: Video,
            });
          });
        }

        // Add full sessions
        if (data.data.fullSessions) {
          data.data.fullSessions.forEach((session) => {
            allSessions.push({
              id: session.id,
              name: `Full Pitch Session (${Math.floor(session.duration / 60)}:${String(session.duration % 60).padStart(2, "0")})`,
              module: "full",
              type: "Full Session",
              date: session.createdAt,
              score: session.overallReadinessScore,
              status: session.status,
              icon: TrendingUp,
            });
          });
        }

        // Sort by date (newest first)
        allSessions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        setSessions(allSessions);
        setCounts(data.counts);
        setError(null);
      } catch (err) {
        console.error("Failed to fetch history:", err);
        setError("Failed to load session history. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);

  const filteredSessions = sessions.filter((session) => {
    const matchesSearch = session.name.toLowerCase().includes(search.toLowerCase());
    const matchesModule = moduleFilter === "all" || session.module === moduleFilter;
    return matchesSearch && matchesModule;
  });

  const scoredSessions = filteredSessions.filter(s => s.score !== null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Session History</h1>
        <p className="text-muted-foreground">All your coaching sessions in one place</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Presentation className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">Deck Analyses</span>
            </div>
            <p className="text-2xl font-bold mt-1">{counts.decks}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-secondary" />
              <span className="text-sm text-muted-foreground">Script Sessions</span>
            </div>
            <p className="text-2xl font-bold mt-1">{counts.scripts}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Video className="h-4 w-4 text-orange-500" />
              <span className="text-sm text-muted-foreground">Live Recordings</span>
            </div>
            <p className="text-2xl font-bold mt-1">{counts.videos}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              <span className="text-sm text-muted-foreground">Full Sessions</span>
            </div>
            <p className="text-2xl font-bold mt-1">{counts.fullSessions}</p>
          </CardContent>
        </Card>
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
      {scoredSessions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Score Progression</CardTitle>
            <CardDescription>Your improvement over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between h-32 gap-2">
              {[...scoredSessions].reverse().slice(-10).map((session, index) => (
                <div key={session.id} className="flex-1 flex flex-col items-center gap-2">
                  <div
                    className={`w-full rounded-t ${
                      (session.score || 0) >= 70
                        ? "bg-secondary"
                        : (session.score || 0) >= 40
                        ? "bg-yellow-500"
                        : "bg-destructive"
                    }`}
                    style={{ height: `${session.score || 0}%` }}
                  />
                  <span className="text-xs text-muted-foreground">{session.score}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-4 text-xs text-muted-foreground">
              <span>Oldest</span>
              <span>Most Recent</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {loading && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Loading your sessions...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {error && !loading && (
        <Card className="border-destructive">
          <CardContent className="py-8">
            <p className="text-destructive text-center">{error}</p>
            <div className="flex justify-center mt-4">
              <Button onClick={() => window.location.reload()}>Retry</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!loading && !error && sessions.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center gap-4 text-center">
              <TrendingUp className="h-12 w-12 text-muted-foreground" />
              <div>
                <h3 className="font-semibold">No sessions yet</h3>
                <p className="text-muted-foreground text-sm mt-1">
                  Start a coaching session to see your progress here
                </p>
              </div>
              <Button onClick={() => router.push("/dashboard")}>Go to Dashboard</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sessions Table */}
      {!loading && !error && sessions.length > 0 && (
        <Card>
          <CardContent className="p-0">
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
                {filteredSessions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No sessions found matching your filters
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSessions.map((session) => {
                    const IconComponent = getModuleIcon(session.module);
                    return (
                      <TableRow
                        key={session.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => {
                          const routes: Record<string, string> = {
                            "pitch-deck": "/pitch-deck-analyser/session",
                            "script": "/elevator-script/session",
                            "live": "/elevator-pitch-live/session",
                            "full": "/full-session/session",
                          };
                          router.push(`${routes[session.module]}/${session.id}`);
                        }}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${getModuleColor(session.module)}`}>
                              <IconComponent className="h-4 w-4" />
                            </div>
                            <span className="font-medium">{session.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{session.type}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {new Date(session.date).toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`font-bold ${getScoreColor(session.score)}`}>
                            {session.score !== null ? session.score : "—"}
                          </span>
                          {session.score !== null && (
                            <span className="text-muted-foreground">/100</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={session.status === "COMPLETED" ? "default" : "secondary"}>
                            {session.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Download className="h-4 w-4" />
                            </Button>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Compare Sessions */}
      {filteredSessions.length >= 2 && (
        <Card className="border-primary/20">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Compare Sessions</p>
                <p className="text-sm text-muted-foreground">See your improvement between two sessions</p>
              </div>
              <Button variant="outline">
                Select Sessions
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
