"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Presentation,
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Minus,
  FileText,
} from "lucide-react";
import Link from "next/link";

const mockComparison = {
  session1: {
    id: "1",
    name: "Series A Deck v2.2",
    date: "2024-01-15",
    score: 72,
    contentScores: {
      title: 80,
      problem: 78,
      solution: 72,
      underlyingMagic: 68,
      businessModel: 65,
      goToMarket: 70,
      competitive: 62,
      team: 88,
      financials: 60,
      theAsk: 75,
    },
    visualScores: {
      density: 70,
      color: 78,
      typography: 75,
      dataViz: 65,
      brandConsistency: 82,
    },
  },
  session2: {
    id: "2",
    name: "Series A Deck v2.3",
    date: "2024-01-20",
    score: 78,
    contentScores: {
      title: 85,
      problem: 82,
      solution: 78,
      underlyingMagic: 72,
      businessModel: 70,
      goToMarket: 75,
      competitive: 68,
      team: 90,
      financials: 65,
      theAsk: 80,
    },
    visualScores: {
      density: 75,
      color: 82,
      typography: 78,
      dataViz: 70,
      brandConsistency: 85,
    },
  },
};

function getDelta(before: number, after: number) {
  const delta = after - before;
  if (delta > 0) return { value: delta, type: "increase" as const };
  if (delta < 0) return { value: delta, type: "decrease" as const };
  return { value: 0, type: "neutral" as const };
}

function DeltaBadge({ delta }: { delta: ReturnType<typeof getDelta> }) {
  if (delta.type === "neutral") {
    return (
      <Badge variant="outline" className="gap-1">
        <Minus className="w-3 h-3" />
        0
      </Badge>
    );
  }
  
  return (
    <Badge
      variant="outline"
      className={`gap-1 ${
        delta.type === "increase"
          ? "bg-accent/10 text-accent border-accent/20"
          : "bg-destructive/10 text-destructive border-destructive/20"
      }`}
    >
      {delta.type === "increase" ? (
        <TrendingUp className="w-3 h-3" />
      ) : (
        <TrendingDown className="w-3 h-3" />
      )}
      {delta.type === "increase" ? "+" : ""}
      {delta.value}
    </Badge>
  );
}

export default function CompareDeckPage({ params }: { params: Promise<{ id1: string; id2: string }> }) {
  const { session1, session2 } = mockComparison;
  const overallDelta = getDelta(session1.score, session2.score);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/pitch-deck-analyser/history">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Presentation className="w-6 h-6 text-primary" />
            Deck Comparison
          </h1>
          <p className="text-muted-foreground">
            Side-by-side comparison of your deck analyses
          </p>
        </div>
      </div>

      {/* Session Headers */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="bg-muted/30">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Before</p>
                <p className="font-medium">{session1.name}</p>
                <p className="text-xs text-muted-foreground">{session1.date}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-accent/10 border-accent/20">
          <CardContent className="py-4 text-center">
            <p className="text-sm text-muted-foreground mb-1">Overall Change</p>
            <div className="flex items-center justify-center gap-2">
              <span className="text-3xl font-bold">{session2.score}</span>
              <DeltaBadge delta={overallDelta} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {session2.score - session1.score} points improvement
            </p>
          </CardContent>
        </Card>
        
        <Card className="bg-muted/30">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">After</p>
                <p className="font-medium">{session2.name}</p>
                <p className="text-xs text-muted-foreground">{session2.date}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Score Comparison Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Score Comparison</CardTitle>
          <CardDescription>Side-by-side view of all scores</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Content Scores */}
            <div>
              <h4 className="font-medium mb-4">Content Analysis</h4>
              <div className="space-y-3">
                {Object.entries(session1.contentScores).map(([key, beforeValue]) => {
                  const afterValue = session2.contentScores[key as keyof typeof session2.contentScores];
                  const delta = getDelta(beforeValue, afterValue);
                  
                  return (
                    <div key={key} className="grid grid-cols-[1fr,60px,80px,80px,60px] md:grid-cols-[1fr,80px,100px,100px,80px] items-center gap-2">
                      <span className="text-sm capitalize">{key.replace(/([A-Z])/g, " $1").trim()}</span>
                      <span className="text-sm text-muted-foreground text-right">{beforeValue}</span>
                      <div className="flex-1">
                        <Progress value={beforeValue} className="h-2" />
                      </div>
                      <div className="flex-1">
                        <Progress value={afterValue} className="h-2 bg-primary/20" />
                      </div>
                      <span className="text-sm text-right">{afterValue}</span>
                      <div className="w-16 flex justify-end">
                        <DeltaBadge delta={delta} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Visual Scores */}
            <div className="pt-4 border-t">
              <h4 className="font-medium mb-4">Visual Audit</h4>
              <div className="space-y-3">
                {Object.entries(session1.visualScores).map(([key, beforeValue]) => {
                  const afterValue = session2.visualScores[key as keyof typeof session2.visualScores];
                  const delta = getDelta(beforeValue, afterValue);
                  
                  return (
                    <div key={key} className="grid grid-cols-[1fr,60px,80px,80px,60px] md:grid-cols-[1fr,80px,100px,100px,80px] items-center gap-2">
                      <span className="text-sm capitalize">{key.replace(/([A-Z])/g, " $1").trim()}</span>
                      <span className="text-sm text-muted-foreground text-right">{beforeValue}</span>
                      <div className="flex-1">
                        <Progress value={beforeValue} className="h-2" />
                      </div>
                      <div className="flex-1">
                        <Progress value={afterValue} className="h-2 bg-primary/20" />
                      </div>
                      <span className="text-sm text-right">{afterValue}</span>
                      <div className="w-16 flex justify-end">
                        <DeltaBadge delta={delta} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Improvement Summary */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="bg-accent/5 border-accent/20">
          <CardHeader>
            <CardTitle className="text-accent flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Biggest Improvements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {["Problem Statement (+4)", "Go-to-Market (+5)", "Competitive (+6)"].map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm">
                  <TrendingUp className="w-4 h-4 text-accent" />
                  {item}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Minus className="w-5 h-5 text-muted-foreground" />
              Areas to Focus
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {["Financials (still lowest at 65)", "Competitive Landscape (needs more work)", "Data Visualization (consider charts)"].map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Minus className="w-4 h-4" />
                  {item}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex justify-center gap-4">
        <Link href="/pitch-deck-analyser/history">
          <Button variant="outline">Back to History</Button>
        </Link>
        <Link href="/pitch-deck-analyser/new">
          <Button className="gap-2 bg-primary hover:bg-primary/90">
            Run New Analysis
          </Button>
        </Link>
      </div>
    </div>
  );
}
