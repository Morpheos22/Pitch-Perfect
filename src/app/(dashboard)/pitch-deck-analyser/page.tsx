"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Presentation,
  ArrowRight,
  Plus,
  History,
  BarChart3,
  CheckCircle,
  FileText,
} from "lucide-react";
import Link from "next/link";

interface RecentDeck {
  id: string;
  fileName: string;
  overallScore: number | null;
  status: string;
  createdAt: string;
}

export default function PitchDeckAnalyserPage() {
  const [recentDecks, setRecentDecks] = useState<RecentDeck[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRecent = useCallback(async () => {
    try {
      const res = await fetch("/api/history?limit=5&type=deck");
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data?.decks) {
          setRecentDecks(json.data.decks);
        }
      }
    } catch {
      // Non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecent();
  }, [fetchRecent]);

  function getScoreColor(score: number | null) {
    if (score == null) return "text-muted-foreground";
    if (score >= 70) return "text-emerald-500";
    if (score >= 50) return "text-amber-500";
    return "text-destructive";
  }

  function formatDate(dateStr: string) {
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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Presentation className="w-6 h-6 text-primary" />
          </div>
          Pitch Deck Analyser
        </h1>
        <p className="text-muted-foreground mt-1">
          Upload your pitch deck for comprehensive content and visual analysis
        </p>
      </div>

      {/* Action Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/pitch-deck-analyser/new">
          <Card className="hover:shadow-md transition-shadow cursor-pointer group border-primary/20">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <Plus className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">New Analysis</CardTitle>
                  <CardDescription>Start a fresh deck analysis</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Upload your pitch deck PDF or paste text to get detailed feedback on
                content, structure, and design.
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/pitch-deck-analyser/history">
          <Card className="hover:shadow-md transition-shadow cursor-pointer group">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted group-hover:bg-muted/80 transition-colors">
                  <History className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <CardTitle className="text-base">History</CardTitle>
                  <CardDescription>View all past analyses</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Browse your previous deck analyses, compare scores, and track your improvement.
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/pitch-deck-analyser/upgrade">
          <Card className="hover:shadow-md transition-shadow cursor-pointer group border-secondary/20">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-secondary/10 group-hover:bg-secondary/20 transition-colors">
                  <BarChart3 className="w-5 h-5 text-secondary" />
                </div>
                <div>
                  <CardTitle className="text-base">Upgrade</CardTitle>
                  <CardDescription>Get more analysis credits</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Upgrade your plan for more deck analyses and premium features.
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Info Card */}
      <Card className="border-primary/10 bg-gradient-to-r from-primary/5 to-transparent">
        <CardContent className="py-5">
          <div className="flex items-start gap-4">
            <div className="p-2 rounded-lg bg-primary/10">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold">What you get</h3>
              <div className="grid sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Content quality scoring (10-slide framework)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Visual design audit &amp; feedback</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Slide-by-slide recommendations</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Two analysis cycles per session</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Analyses */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Recent Analyses</h2>
          {recentDecks.length > 0 && (
            <Link href="/pitch-deck-analyser/history" className="text-sm text-primary hover:underline">
              View all
            </Link>
          )}
        </div>
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : recentDecks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Presentation className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No deck analyses yet</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Upload your first pitch deck to get started
                </p>
                <Link href="/pitch-deck-analyser/new">
                  <Button size="sm" className="gap-2 bg-primary hover:bg-primary/90">
                    <Plus className="w-4 h-4" />
                    New Analysis
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="divide-y">
                {recentDecks.map((deck) => (
                  <Link
                    key={deck.id}
                    href={`/pitch-deck-analyser/session/${deck.id}`}
                    className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Presentation className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{deck.fileName || "Untitled Deck"}</p>
                        <p className="text-sm text-muted-foreground">{formatDate(deck.createdAt)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className={`font-bold ${getScoreColor(deck.overallScore)}`}>
                          {deck.overallScore != null ? (
                            <><span>{deck.overallScore}</span><span className="text-muted-foreground text-sm">/100</span></>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </p>
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
    </div>
  );
}
