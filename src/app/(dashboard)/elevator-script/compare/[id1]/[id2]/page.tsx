"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare,
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import Link from "next/link";

const mockComparison = {
  session1: {
    id: "1",
    name: "Elevator Pitch - Investor Meeting",
    date: "2024-01-18",
    score: 75,
    elementScores: {
      hook: 68,
      problem: 85,
      solution: 78,
      proof: 72,
      theAsk: 70,
    },
  },
  session2: {
    id: "2",
    name: "Elevator Pitch - TechCrunch",
    date: "2024-01-20",
    score: 82,
    elementScores: {
      hook: 75,
      problem: 90,
      solution: 85,
      proof: 80,
      theAsk: 78,
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

export default function CompareScriptPage({ params }: { params: Promise<{ id1: string; id2: string }> }) {
  const { session1, session2 } = mockComparison;
  const overallDelta = getDelta(session1.score, session2.score);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/elevator-script/history">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-accent" />
            Script Comparison
          </h1>
          <p className="text-muted-foreground">
            Side-by-side comparison of your script analyses
          </p>
        </div>
      </div>

      {/* Session Headers */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="bg-muted/30">
          <CardContent className="py-4">
            <div>
              <p className="text-sm text-muted-foreground">Before</p>
              <p className="font-medium">{session1.name}</p>
              <p className="text-xs text-muted-foreground">{session1.date}</p>
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
          </CardContent>
        </Card>
        
        <Card className="bg-muted/30">
          <CardContent className="py-4">
            <div>
              <p className="text-sm text-muted-foreground">After</p>
              <p className="font-medium">{session2.name}</p>
              <p className="text-xs text-muted-foreground">{session2.date}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Element Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Element Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(session1.elementScores).map(([key, beforeValue]) => {
              const afterValue = session2.elementScores[key as keyof typeof session2.elementScores];
              const delta = getDelta(beforeValue, afterValue);
              const elementName = key === "theAsk" ? "The Ask" : key.charAt(0).toUpperCase() + key.slice(1);
              
              return (
                <div key={key} className="grid grid-cols-[1fr,60px,1fr,1fr,60px] items-center gap-4">
                  <span className="text-sm font-medium">{elementName}</span>
                  <span className="text-sm text-muted-foreground text-right">{beforeValue}</span>
                  <Progress value={beforeValue} className="h-2" />
                  <Progress value={afterValue} className="h-2 bg-accent/20" />
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{afterValue}</span>
                    <DeltaBadge delta={delta} />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-center gap-4">
        <Link href="/elevator-script/history">
          <Button variant="outline">Back to History</Button>
        </Link>
        <Link href="/elevator-script/new">
          <Button className="bg-accent hover:bg-accent/90">
            Run New Analysis
          </Button>
        </Link>
      </div>
    </div>
  );
}
