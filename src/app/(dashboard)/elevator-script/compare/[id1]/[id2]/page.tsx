"use client";

import { useEffect, useState, use } from "react";
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
  AlertTriangle,
  Loader2,
} from "lucide-react";
import Link from "next/link";

interface ScriptSession {
  id: string;
  status: string;
  fileName?: string;
  createdAt: string;
  analysis: {
    scores: {
      hook?: number;
      problem?: number;
      solution?: number;
      credibility?: number;
      cta?: number;
      overall?: number;
    };
    metrics?: {
      wordCount?: number;
      estimatedDuration?: number;
    };
  };
}

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

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function CompareScriptPage({ params }: { params: Promise<{ id1: string; id2: string }> }) {
  const { id1, id2 } = use(params);
  const [session1, setSession1] = useState<ScriptSession | null>(null);
  const [session2, setSession2] = useState<ScriptSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSessions() {
      try {
        const [res1, res2] = await Promise.all([
          fetch(`/api/coach/script?id=${id1}`),
          fetch(`/api/coach/script?id=${id2}`),
        ]);

        if (!res1.ok || !res2.ok) {
          const errBody1 = !res1.ok ? await res1.json().catch(() => ({})) : {};
          const errBody2 = !res2.ok ? await res2.json().catch(() => ({})) : {};
          const missing = [];
          if (!res1.ok) missing.push(`Session 1: ${errBody1.error || res1.status}`);
          if (!res2.ok) missing.push(`Session 2: ${errBody2.error || res2.status}`);
          setError(missing.join(" | "));
          return;
        }

        const data1 = await res1.json();
        const data2 = await res2.json();

        if (!data1 || !data2) {
          setError("One or both sessions could not be loaded.");
          return;
        }

        setSession1(data1);
        setSession2(data2);
      } catch (err) {
        setError("Failed to load session data. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    fetchSessions();
  }, [id1, id2]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
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
          </div>
        </div>
        <Card className="border-destructive/40">
          <CardContent className="p-6 flex items-center gap-4">
            <AlertTriangle className="w-6 h-6 text-destructive shrink-0" />
            <div>
              <p className="font-medium text-destructive">Error loading comparison</p>
              <p className="text-sm text-muted-foreground mt-1">{error}</p>
            </div>
          </CardContent>
        </Card>
        <div className="flex justify-center gap-4">
          <Link href="/elevator-script/history">
            <Button variant="outline">Back to History</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!session1 || !session2) return null;

  const scores1 = session1.analysis?.scores || {};
  const scores2 = session2.analysis?.scores || {};

  const overallBefore = scores1.overall || 0;
  const overallAfter = scores2.overall || 0;
  const overallDelta = getDelta(overallBefore, overallAfter);

  const elementKeys = [
    { key: "hook", label: "Hook" },
    { key: "problem", label: "Problem" },
    { key: "solution", label: "Solution" },
    { key: "credibility", label: "Credibility" },
    { key: "cta", label: "Call to Action" },
  ];

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
              <p className="font-medium">{session1.fileName || `Session ${session1.id.slice(0, 8)}`}</p>
              <p className="text-xs text-muted-foreground">{formatDate(session1.createdAt)}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-accent/10 border-accent/20">
          <CardContent className="py-4 text-center">
            <p className="text-sm text-muted-foreground mb-1">Overall Change</p>
            <div className="flex items-center justify-center gap-2">
              <span className="text-3xl font-bold">{overallAfter}</span>
              <DeltaBadge delta={overallDelta} />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-muted/30">
          <CardContent className="py-4">
            <div>
              <p className="text-sm text-muted-foreground">After</p>
              <p className="font-medium">{session2.fileName || `Session ${session2.id.slice(0, 8)}`}</p>
              <p className="text-xs text-muted-foreground">{formatDate(session2.createdAt)}</p>
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
            {elementKeys.map(({ key, label }) => {
              const beforeValue = (scores1 as Record<string, number | undefined>)[key] || 0;
              const afterValue = (scores2 as Record<string, number | undefined>)[key] || 0;
              const delta = getDelta(beforeValue, afterValue);

              return (
                <div key={key} className="grid grid-cols-[1fr,60px,1fr,1fr,60px] items-center gap-4">
                  <span className="text-sm font-medium">{label}</span>
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
