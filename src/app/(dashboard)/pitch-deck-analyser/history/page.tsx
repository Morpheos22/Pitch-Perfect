"use client";

import { useState } from "react";
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
} from "lucide-react";
import Link from "next/link";

const mockSessions = [
  {
    id: "1",
    name: "Series A Deck v2.3",
    score: 78,
    previousScore: 72,
    change: 6,
    date: "2024-01-20T14:30:00Z",
    status: "completed",
    cycle: 1,
  },
  {
    id: "2",
    name: "Series A Deck v2.2",
    score: 72,
    previousScore: 68,
    change: 4,
    date: "2024-01-15T10:00:00Z",
    status: "completed",
    cycle: 1,
  },
  {
    id: "3",
    name: "Series A Deck v2.1",
    score: 68,
    previousScore: null,
    change: null,
    date: "2024-01-10T09:15:00Z",
    status: "completed",
    cycle: 1,
  },
  {
    id: "4",
    name: "Seed Deck Final",
    score: 85,
    previousScore: 80,
    change: 5,
    date: "2023-12-05T16:45:00Z",
    status: "completed",
    cycle: 2,
  },
  {
    id: "5",
    name: "Seed Deck v3",
    score: 80,
    previousScore: 75,
    change: 5,
    date: "2023-12-01T11:30:00Z",
    status: "completed",
    cycle: 1,
  },
];

const scoreProgression = [
  { date: "Dec 1", score: 75 },
  { date: "Dec 5", score: 80 },
  { date: "Jan 10", score: 68 },
  { date: "Jan 15", score: 72 },
  { date: "Jan 20", score: 78 },
];

export default function DeckHistoryPage() {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("date");
  const [selectedSessions, setSelectedSessions] = useState<string[]>([]);

  const filteredSessions = mockSessions.filter((session) =>
    session.name.toLowerCase().includes(search.toLowerCase())
  );

  const sortedSessions = [...filteredSessions].sort((a, b) => {
    if (sortBy === "date") {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    }
    if (sortBy === "score") {
      return b.score - a.score;
    }
    return 0;
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
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Sessions</CardTitle>
              <CardDescription>{sortedSessions.length} analysis sessions</CardDescription>
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
            {sortedSessions.map((session) => (
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
                    <p className="font-medium">{session.name}</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <Calendar className="w-3 h-3" />
                      {new Date(session.date).toLocaleDateString()}
                      <Badge variant="outline" className="text-xs">Cycle {session.cycle}</Badge>
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
                    <p className="text-xl font-bold">{session.score}</p>
                    <p className="text-xs text-muted-foreground">/ 100</p>
                  </div>
                  <Link href={`/pitch-deck-analyser/session/${session.id}`}>
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

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {sortedSessions.length} of {mockSessions.length} sessions
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" disabled>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" disabled>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
