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
} from "lucide-react";
import Link from "next/link";

const mockSessions = [
  {
    id: "1",
    name: "Elevator Pitch - TechCrunch",
    score: 82,
    previousScore: 75,
    change: 7,
    date: "2024-01-20T14:30:00Z",
    wordCount: 156,
    status: "completed",
  },
  {
    id: "2",
    name: "Elevator Pitch - Investor Meeting",
    score: 75,
    previousScore: 68,
    change: 7,
    date: "2024-01-18T10:00:00Z",
    wordCount: 142,
    status: "completed",
  },
  {
    id: "3",
    name: "Elevator Pitch - Demo Day",
    score: 68,
    previousScore: null,
    change: null,
    date: "2024-01-15T09:15:00Z",
    wordCount: 180,
    status: "completed",
  },
];

const scoreProgression = [
  { date: "Jan 15", score: 68 },
  { date: "Jan 18", score: 75 },
  { date: "Jan 20", score: 82 },
];

export default function ScriptHistoryPage() {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("date");

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
            <MessageSquare className="w-6 h-6 text-accent" />
            Script Analysis History
          </h1>
          <p className="text-muted-foreground">
            View and compare your previous script analyses
          </p>
        </div>
      </div>

      {/* Score Progression Chart */}
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
          <div className="divide-y">
            {sortedSessions.map((session) => (
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
                    <p className="font-medium">{session.name}</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <Calendar className="w-3 h-3" />
                      {new Date(session.date).toLocaleDateString()}
                      <Badge variant="outline" className="text-xs">{session.wordCount} words</Badge>
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
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
