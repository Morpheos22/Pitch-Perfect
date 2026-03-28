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
  Presentation,
  ArrowLeft,
  Search,
  Filter,
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  FileText,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import Link from "next/link";

interface DeckSession {
  id: string;
  fileName: string;
  overallScore: number | null;
  status: string;
  createdAt: string;
  analyzedAt: string | null;
}

interface DeckHistoryResponse {
  success: boolean;
  data: {
    decks?: DeckSession[];
  };
  counts: {
    decks: number;
  };
  pagination: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export default function DeckHistoryPage() {
  const [sessions, setSessions] = useState<DeckSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("date");
  const [selectedSessions, setSelectedSessions] = useState<string[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const limit = 10;

  useEffect(() => {
    const fetchDeckHistory = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/history?type=deck&limit=${limit}&offset=${offset}`);
        const data: DeckHistoryResponse = await response.json();

        if (!data.success) {
          throw new Error("Failed to fetch deck history");
        }

        setSessions(data.data.decks || []);
        setTotalCount(data.counts.decks);
        setHasMore(data.pagination.hasMore);
        setError(null);
      } catch (err) {
        console.error("Failed to fetch deck history:", err);
        setError("Failed to load deck history. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchDeckHistory();
  }, [offset]);

  const filteredSessions = sessions.filter((session) =>
    session.fileName.toLowerCase().includes(search.toLowerCase())
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

  // Calculate score changes
  const sessionsWithChanges = sortedSessions.map((session, index) => {
    const previousSession = sortedSessions[index + 1];
    const previousScore = previousSession?.overallScore;
    const change = previousScore !== null && previousScore !== undefined && session.overallScore !== null
      ? session.overallScore - previousScore
      : null;
    return { ...session, previousScore, change };
  });

  const toggleSelection = (id: string) => {
    setSelectedSessions((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const getChangeIcon = (change: number | null) => {
    if (change === null) return <Minus className="w-4 h-4 text-muted-foreground" />;
    if (change > 0) return <TrendingUp className="w-4 h-4 text-accent" />;
    if (change < 0) return <TrendingDown className="w-4 h-4 text-destructive" />;
    return <Minus className="w-4 h-4 text-muted-foreground" />;
  };

  // Prepare chart data
  const scoreProgression = [...sessionsWithChanges]
    .reverse()
    .filter(s => s.overallScore !== null)
    .slice(-5)
    .map(s => ({
      date: new Date(s.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      score: s.overallScore || 0
    }));

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
            <Presentation className="w-6 h-6 text-primary" />
            Deck Analysis History
          </h1>
          <p className="text-muted-foreground">
            View and compare your previous deck analyses
          </p>
        </div>
      </div>

      {/* Score Progression Chart */}
      {scoreProgression.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Score Progression</CardTitle>
            <CardDescription>Your deck scores over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-40 flex items-end justify-between gap-4 px-4">
              {scoreProgression.map((item, index) => {
                const height = (item.score / 100) * 100;
                return (
                  <div key={index} className="flex flex-col items-center gap-2 flex-1">
                    <span className="text-sm font-medium">{item.score}</span>
                    <div
                      className="w-full bg-gradient-to-t from-primary to-accent rounded-t-sm transition-all"
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

      {/* Loading State */}
      {loading && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Loading your deck analyses...</p>
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
              <Presentation className="h-12 w-12 text-muted-foreground" />
              <div>
                <h3 className="font-semibold">No deck analyses yet</h3>
                <p className="text-muted-foreground text-sm mt-1">
                  Upload your first pitch deck to get started
                </p>
              </div>
              <Link href="/pitch-deck-analyser">
                <Button>Analyze a Deck</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Session List */}
      {!loading && !error && sessions.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Sessions</CardTitle>
                <CardDescription>{totalCount} analysis session{totalCount !== 1 ? 's' : ''}</CardDescription>
              </div>
              {selectedSessions.length === 2 && (
                <Link href={`/pitch-deck-analyser/compare/${selectedSessions[0]}/${selectedSessions[1]}`}>
                  <Button size="sm" className="gap-2">
                    Compare Selected
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {sessionsWithChanges.map((session) => (
                <div
                  key={session.id}
                  className={`flex items-center justify-between p-4 hover:bg-muted/50 transition-colors cursor-pointer ${
                    selectedSessions.includes(session.id) ? "bg-primary/5" : ""
                  }`}
                  onClick={() => toggleSelection(session.id)}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                        selectedSessions.includes(session.id)
                          ? "border-primary bg-primary"
                          : "border-muted-foreground/30"
                      }`}
                    >
                      {selectedSessions.includes(session.id) && (
                        <svg className="w-3 h-3 text-primary-foreground" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{session.fileName}</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <Calendar className="w-3 h-3" />
                        {new Date(session.createdAt).toLocaleDateString()}
                        <Badge variant="outline" className="text-xs">
                          {session.status}
                        </Badge>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      {getChangeIcon(session.change)}
                      {session.change !== null && (
                        <span className={`text-sm ${session.change > 0 ? "text-accent" : session.change < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                          {session.change > 0 ? "+" : ""}{session.change}
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold">
                        {session.overallScore !== null ? session.overallScore : "—"}
                      </p>
                      {session.overallScore !== null && (
                        <p className="text-xs text-muted-foreground">/ 100</p>
                      )}
                    </div>
                    <Link href={`/pitch-deck-analyser/session/${session.id}`} onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon">
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {!loading && !error && sessions.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {sessions.length} of {totalCount} sessions
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - limit))}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              disabled={!hasMore}
              onClick={() => setOffset(offset + limit)}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
