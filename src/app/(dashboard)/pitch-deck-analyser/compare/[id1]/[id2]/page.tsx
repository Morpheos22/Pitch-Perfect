"use client";

import { use, useState, useEffect } from "react";
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
  Loader2,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";

interface DeckSession {
  id: string;
  fileName: string;
  status: string;
  overallScore: number | null;
  createdAt: string;
  contentAnalysis?: {
    contentScores?: Record<string, number>;
    slideScores?: Record<string, { score: number }>;
    [key: string]: unknown;
  };
  visualAudit?: {
    designScores?: Record<string, number>;
    [key: string]: unknown;
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

function extractContentScores(analysis?: Record<string, unknown>): Record<string, number> {
  if (!analysis) return {};
  // Check for contentScores directly
  if (analysis.contentScores && typeof analysis.contentScores === "object") {
    return analysis.contentScores as Record<string, number>;
  }
  // Check for slideScores (each slide has a score)
  if (analysis.slideScores && typeof analysis.slideScores === "object") {
    const slides = analysis.slideScores as Record<string, { score?: number }>;
    const result: Record<string, number> = {};
    Object.entries(slides).forEach(([key, val]) => {
      if (typeof val.score === "number") {
        result[key] = val.score;
      }
    });
    return result;
  }
  return {};
}

function extractVisualScores(visualAudit?: Record<string, unknown>): Record<string, number> {
  if (!visualAudit) return {};
  if (visualAudit.designScores && typeof visualAudit.designScores === "object") {
    return visualAudit.designScores as Record<string, number>;
  }
  // Extract any numeric score fields
  const result: Record<string, number> = {};
  Object.entries(visualAudit).forEach(([key, val]) => {
    if (typeof val === "number") {
      result[key] = val;
    }
  });
  return result;
}

function formatLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim();
}

export default function CompareDeckPage({ params }: { params: Promise<{ id1: string; id2: string }> }) {
  const { id1, id2 } = use(params);

  const [session1, setSession1] = useState<DeckSession | null>(null);
  const [session2, setSession2] = useState<DeckSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const [res1, res2] = await Promise.all([
          fetch(`/api/coach/deck?id=${encodeURIComponent(id1)}`),
          fetch(`/api/coach/deck?id=${encodeURIComponent(id2)}`),
        ]);

        if (!res1.ok || !res2.ok) {
          setError("One or both sessions not found");
          return;
        }

        const data1 = await res1.json();
        const data2 = await res2.json();

        if (!data1 || !data2) {
          setError("One or both sessions not found");
          return;
        }

        // API returns flat { id, status, analysis: { contentScores, visualScores, feedback } }
        // Map to the DeckSession interface the compare component expects
        setSession1({
          ...data1,
          overallScore: data1.analysis?.contentScores?.overall,
          contentAnalysis: data1.analysis,
          visualAudit: data1.analysis?.visualScores
              ? { designScores: data1.analysis.visualScores }
              : undefined,
        } as any);
        setSession2({
          ...data2,
          overallScore: data2.analysis?.contentScores?.overall,
          contentAnalysis: data2.analysis,
          visualAudit: data2.analysis?.visualScores
              ? { designScores: data2.analysis.visualScores }
              : undefined,
        } as any);
      } catch {
        setError("Failed to load sessions");
      } finally {
        setLoading(false);
      }
    };
    fetchSessions();
  }, [id1, id2]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="h-9 w-9 animate-pulse bg-muted rounded" />
          <div className="space-y-2">
            <div className="h-6 w-40 animate-pulse bg-muted rounded" />
            <div className="h-4 w-56 animate-pulse bg-muted rounded" />
          </div>
        </div>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (error || !session1 || !session2) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/pitch-deck-analyser/history">
            <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Presentation className="w-6 h-6 text-primary" />
              Deck Comparison
            </h1>
          </div>
        </div>
        <Card className="border-destructive/30">
          <CardContent className="py-12 text-center">
            <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-3" />
            <p className="text-muted-foreground">{error || "Sessions not found"}</p>
            <Link href="/pitch-deck-analyser/history">
              <Button className="mt-4" variant="outline">Back to History</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const overallDelta = getDelta(session1.overallScore ?? 0, session2.overallScore ?? 0);
  const contentScores1 = extractContentScores(session1.contentAnalysis);
  const contentScores2 = extractContentScores(session2.contentAnalysis);
  const visualScores1 = extractVisualScores(session1.visualAudit);
  const visualScores2 = extractVisualScores(session2.visualAudit);

  // Get all content score keys from both sessions
  const allContentKeys = Array.from(new Set([...Object.keys(contentScores1), ...Object.keys(contentScores2)]));
  const allVisualKeys = Array.from(new Set([...Object.keys(visualScores1), ...Object.keys(visualScores2)]));

  // Compute improvements and areas to focus
  const improvements: string[] = [];
  const areasToFocus: string[] = [];

  allContentKeys.forEach((key) => {
    const v1 = contentScores1[key] ?? 0;
    const v2 = contentScores2[key] ?? 0;
    if (v2 > v1 && v2 - v1 >= 3) improvements.push(`${formatLabel(key)} (+${v2 - v1})`);
    if (v2 < v1) areasToFocus.push(`${formatLabel(key)} (${v2}/100)`);
  });

  allVisualKeys.forEach((key) => {
    const v1 = visualScores1[key] ?? 0;
    const v2 = visualScores2[key] ?? 0;
    if (v2 > v1 && v2 - v1 >= 3) improvements.push(`${formatLabel(key)} (+${v2 - v1})`);
    if (v2 < v1) areasToFocus.push(`${formatLabel(key)} (${v2}/100)`);
  });

  // Find lowest scores in session 2
  const allScores2 = { ...contentScores2, ...visualScores2 };
  const lowestScores = Object.entries(allScores2)
    .sort(([, a], [, b]) => a - b)
    .slice(0, 3);

  if (areasToFocus.length === 0 && lowestScores.length > 0) {
    lowestScores.forEach(([key, score]) => {
      areasToFocus.push(`${formatLabel(key)} (lowest at ${score})`);
    });
  }

  const date1 = new Date(session1.createdAt).toLocaleDateString();
  const date2 = new Date(session2.createdAt).toLocaleDateString();

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
                <p className="font-medium">{session1.fileName}</p>
                <p className="text-xs text-muted-foreground">{date1}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-accent/10 border-accent/20">
          <CardContent className="py-4 text-center">
            <p className="text-sm text-muted-foreground mb-1">Overall Change</p>
            <div className="flex items-center justify-center gap-2">
              <span className="text-3xl font-bold">{session2.overallScore ?? "—"}</span>
              <DeltaBadge delta={overallDelta} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {(session2.overallScore ?? 0) - (session1.overallScore ?? 0)} points improvement
            </p>
          </CardContent>
        </Card>

        <Card className="bg-muted/30">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">After</p>
                <p className="font-medium">{session2.fileName}</p>
                <p className="text-xs text-muted-foreground">{date2}</p>
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
            {allContentKeys.length > 0 && (
              <div>
                <h4 className="font-medium mb-4">Content Analysis</h4>
                <div className="space-y-3">
                  {allContentKeys.map((key) => {
                    const beforeValue = contentScores1[key] ?? 0;
                    const afterValue = contentScores2[key] ?? 0;
                    const delta = getDelta(beforeValue, afterValue);

                    return (
                      <div key={key} className="grid grid-cols-[1fr,60px,80px,80px,60px] md:grid-cols-[1fr,80px,100px,100px,80px] items-center gap-2">
                        <span className="text-sm">{formatLabel(key)}</span>
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
            )}

            {/* Visual Scores */}
            {allVisualKeys.length > 0 && (
              <div className="pt-4 border-t">
                <h4 className="font-medium mb-4">Visual Audit</h4>
                <div className="space-y-3">
                  {allVisualKeys.map((key) => {
                    const beforeValue = visualScores1[key] ?? 0;
                    const afterValue = visualScores2[key] ?? 0;
                    const delta = getDelta(beforeValue, afterValue);

                    return (
                      <div key={key} className="grid grid-cols-[1fr,60px,80px,80px,60px] md:grid-cols-[1fr,80px,100px,100px,80px] items-center gap-2">
                        <span className="text-sm">{formatLabel(key)}</span>
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
            )}

            {allContentKeys.length === 0 && allVisualKeys.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                No detailed score breakdowns available for comparison.
              </p>
            )}
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
            {improvements.length > 0 ? (
              <ul className="space-y-2">
                {improvements.slice(0, 5).map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm">
                    <TrendingUp className="w-4 h-4 text-accent" />
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No significant improvements detected.</p>
            )}
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
            {areasToFocus.length > 0 ? (
              <ul className="space-y-2">
                {areasToFocus.slice(0, 5).map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Minus className="w-4 h-4" />
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">All areas improved!</p>
            )}
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
