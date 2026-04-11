"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { 
  Download, 
  Share2, 
  ArrowRight, 
  ChevronLeft, 
  TrendingUp,
  CheckCircle,
  AlertTriangle,
  FileText,
  Loader2,
  Dumbbell,
  Trash2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Check,
  Clock,
  Target,
  Save
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

interface Drill {
  title: string;
  description: string;
  targetDimension: string;
  currentScore: number;
  targetScore: number;
  difficulty: "beginner" | "intermediate" | "advanced";
  estimatedTime: string;
  steps: string[];
}

interface AnalysisData {
  id: string;
  status: string;
  fileName: string;
  createdAt: string;
  notes?: string;
  version?: number;
  parentId?: string;
  analysis?: {
    contentScores: {
      problemClarity: number;
      solutionClarity: number;
      marketOpportunity: number;
      businessModel: number;
      teamCredibility: number;
      traction: number;
      financials: number;
      askClarity: number;
      overall: number;
    };
    visualScores: {
      designConsistency: number;
      readability: number;
      visualHierarchy: number;
      colorScheme: number;
      typography: number;
    };
    feedback: {
      strengths: string[];
      weaknesses: string[];
      recommendations: string[];
    };
  };
  _dev?: string;
}

function getScoreColor(score: number) {
  if (score >= 70) return "text-secondary";
  if (score >= 40) return "text-yellow-500";
  return "text-destructive";
}

function getProgressColor(score: number) {
  if (score >= 70) return "bg-secondary";
  if (score >= 40) return "bg-yellow-500";
  return "bg-destructive";
}

function getScoreLabel(score: number) {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Strong";
  if (score >= 55) return "Good foundation";
  if (score >= 40) return "Needs work";
  return "Critical";
}

function getDifficultyColor(difficulty: string) {
  switch (difficulty) {
    case "beginner": return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
    case "intermediate": return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20";
    case "advanced": return "bg-red-500/10 text-red-600 border-red-500/20";
    default: return "";
  }
}

export default function PitchDeckSessionPage() {
  const router = useRouter();
  const params = useParams();
  const [notes, setNotes] = useState("");
  const [data, setData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Notes persistence
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const notesTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasUnsavedChanges = useRef(false);

  // Coaching drills
  const [drills, setDrills] = useState<Drill[]>([]);
  const [drillsLoading, setDrillsLoading] = useState(false);
  const [expandedDrills, setExpandedDrills] = useState<Set<number>>(new Set());

  // Iterate
  const [iterating, setIterating] = useState(false);

  // Delete
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchSessionData();
  }, [params.id]);

  // Load notes from session data when it arrives
  useEffect(() => {
    if (data?.notes) {
      setNotes(data.notes);
    }
  }, [data]);

  // beforeunload handler for unsaved notes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges.current) {
        e.preventDefault();
        e.returnValue = "You have unsaved changes. Are you sure you want to leave?";
        return e.returnValue;
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  const fetchSessionData = async () => {
    try {
      const response = await fetch(`/api/coach/deck?id=${encodeURIComponent(String(params.id))}`);
      
      if (!response.ok) {
        if (response.status === 401) {
          router.push("/sign-in");
          return;
        }
        if (response.status === 404) {
          setError("Session not found");
          return;
        }
        throw new Error("Failed to fetch session");
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error("Fetch error:", err);
      setError(err instanceof Error ? err.message : "Failed to load session");
    } finally {
      setLoading(false);
    }
  };

  // Notes auto-save with debounce
  const handleNotesChange = useCallback((value: string) => {
    setNotes(value);
    setNotesSaved(false);
    hasUnsavedChanges.current = true;

    if (notesTimeoutRef.current) {
      clearTimeout(notesTimeoutRef.current);
    }

    notesTimeoutRef.current = setTimeout(async () => {
      if (!data?.id) return;
      setNotesSaving(true);
      try {
        const res = await fetch("/api/coach/deck", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: data.id, notes: value }),
        });
        if (res.ok) {
          setNotesSaved(true);
          hasUnsavedChanges.current = false;
          setTimeout(() => setNotesSaved(false), 3000);
        }
      } catch {
        // silently fail — user can retry
      } finally {
        setNotesSaving(false);
      }
    }, 1500);
  }, [data?.id]);

  // Fetch coaching drills
  const handleFetchDrills = async () => {
    if (drills.length > 0) return; // already loaded
    setDrillsLoading(true);
    try {
      const res = await fetch("/api/coach/drills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: params.id, moduleType: "e1" }),
      });
      if (res.ok) {
        const result = await res.json();
        if (result.drills) {
          setDrills(result.drills);
        }
      }
    } catch {
      toast.error("Failed to load coaching drills");
    } finally {
      setDrillsLoading(false);
    }
  };

  // Iterate & Improve
  const handleIterate = async () => {
    setIterating(true);
    try {
      const res = await fetch("/api/coach/deck/iterate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: params.id }),
      });
      if (res.ok) {
        const result = await res.json();
        toast.success("New version created! Comparing with previous analysis...");
        router.push(`/pitch-deck-analyser/session/${encodeURIComponent(result.id)}`);
      } else {
        toast.error("Failed to create new version");
      }
    } catch {
      toast.error("Failed to iterate analysis");
    } finally {
      setIterating(false);
    }
  };

  // Delete session
  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this session? This action cannot be undone.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/coach/deck?id=${encodeURIComponent(String(params.id))}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Session deleted");
        router.push("/pitch-deck-analyser/history");
      } else {
        toast.error("Failed to delete session");
      }
    } catch {
      toast.error("Failed to delete session");
    } finally {
      setDeleting(false);
    }
  };

  // PDF download via print
  const handleDownload = () => {
    window.print();
  };

  // Share: copy session link to clipboard
  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Link copied to clipboard");
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading session...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto text-center py-20">
        <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">Error Loading Session</h2>
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button onClick={() => router.push("/dashboard")}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  if (!data || !data.analysis) {
    return (
      <div className="max-w-4xl mx-auto text-center py-20">
        <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">Analysis Not Available</h2>
        <p className="text-muted-foreground mb-4">This session is still being processed or failed to analyze.</p>
        <Button onClick={() => router.push("/pitch-deck-analyser/new")}>
          Start New Analysis
        </Button>
      </div>
    );
  }

  const { analysis, fileName, createdAt } = data;
  const overallScore = analysis.contentScores.overall;
  const date = new Date(createdAt).toLocaleDateString('en-US', { 
    month: 'long', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit'
  });

  const contentItems = [
    { name: "Problem Clarity", score: analysis.contentScores.problemClarity },
    { name: "Solution Clarity", score: analysis.contentScores.solutionClarity },
    { name: "Market Opportunity", score: analysis.contentScores.marketOpportunity },
    { name: "Business Model", score: analysis.contentScores.businessModel },
    { name: "Team Credibility", score: analysis.contentScores.teamCredibility },
    { name: "Traction", score: analysis.contentScores.traction },
    { name: "Financials", score: analysis.contentScores.financials },
    { name: "Ask Clarity", score: analysis.contentScores.askClarity },
  ];

  const visualItems = [
    { name: "Design Consistency", score: analysis.visualScores.designConsistency },
    { name: "Readability", score: analysis.visualScores.readability },
    { name: "Visual Hierarchy", score: analysis.visualScores.visualHierarchy },
    { name: "Color Scheme", score: analysis.visualScores.colorScheme },
    { name: "Typography", score: analysis.visualScores.typography },
  ];

  const toggleDrill = (index: number) => {
    setExpandedDrills(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  return (
    <>
      {/* Print styles */}
      <style jsx global>{`
        @media print {
          nav, button, .no-print, footer, header, aside { display: none !important; }
          .print-only { display: block !important; }
          body { background: white; }
          .max-w-4xl { max-width: 100% !important; }
          * { color-adjust: exact; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      {/* Print-only report header */}
      <div className="print-only hidden mb-8">
        <h1 className="text-2xl font-bold">Pitch Deck Analysis Report</h1>
        <p className="text-muted-foreground">{fileName} — {date}</p>
        <p className="text-lg mt-2">Overall Score: {overallScore}/100 — {getScoreLabel(overallScore)}</p>
      </div>

      <div className="max-w-4xl mx-auto space-y-6 pb-8">
        {/* Header */}
        <div className="flex items-start justify-between no-print">
          <div>
            <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")} className="mb-2">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back to Dashboard
            </Button>
            <h1 className="text-2xl font-bold">{fileName}</h1>
            <p className="text-muted-foreground">{date}</p>
            {data.version !== undefined && (
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline">v{data.version}</Badge>
                {data.parentId && (
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs text-muted-foreground"
                    onClick={() => router.push(`/pitch-deck-analyser/session/${encodeURIComponent(String(data.parentId))}`)}
                  >
                    ← Previous version
                  </Button>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleDelete} disabled={deleting}>
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleShare}>
              <Share2 className="h-4 w-4 mr-1" />
              Share
            </Button>
            <Button size="sm" onClick={handleDownload} className="bg-primary hover:bg-primary/90">
              <Download className="h-4 w-4 mr-1" />
              Download PDF
            </Button>
          </div>
        </div>

        {/* Overall Score */}
        <Card className="border-primary/20">
          <CardContent className="py-8 text-center">
            <Badge variant="secondary" className="mb-4">Analysis Complete</Badge>
            <div className="flex items-center justify-center gap-6">
              <div className="text-center">
                <div className={`text-6xl font-bold ${getScoreColor(overallScore)}`}>
                  {overallScore}
                </div>
                <p className="text-lg font-medium mt-2">{getScoreLabel(overallScore)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Executive Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">AI Analysis Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Your pitch deck has been analyzed across 8 content dimensions and 5 visual design criteria.
              The overall score of {overallScore}/100 indicates {overallScore >= 70 ? "a strong foundation for investor presentations" : "areas that need improvement before investor meetings"}.
            </p>
          </CardContent>
        </Card>

        {/* Priority Recommendations */}
        <Card className="border-secondary/30 bg-secondary/5">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-secondary" />
              Top Recommendations
            </CardTitle>
            <CardDescription>Focus on these for maximum improvement</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3">
              {analysis.feedback.recommendations.slice(0, 3).map((rec, index) => (
                <li key={index} className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </span>
                  <span>{rec}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        {/* Content Analysis */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Content Analysis</CardTitle>
            <CardDescription>8-dimension content scoring</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {contentItems.map((item) => (
              <div key={item.name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{item.name}</span>
                  <span className={`font-bold ${getScoreColor(item.score)}`}>{item.score}/100</span>
                </div>
                <Progress value={item.score} className="h-2" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Visual Design Audit */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Visual Design Audit</CardTitle>
            <CardDescription>5 dimensions of visual presentation</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {visualItems.map((item) => (
              <div key={item.name} className="flex items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium">{item.name}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{getScoreLabel(item.score)}</Badge>
                      <span className={`font-bold ${getScoreColor(item.score)}`}>{item.score}</span>
                    </div>
                  </div>
                  <Progress value={item.score} className="h-1.5" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Strengths & Weaknesses */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-secondary" />
                Strengths
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {analysis.feedback.strengths.map((strength, index) => (
                  <li key={index} className="flex gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-secondary shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{strength}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Areas to Improve
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {analysis.feedback.weaknesses.map((weakness, index) => (
                  <li key={index} className="flex gap-2 text-sm">
                    <TrendingUp className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{weakness}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Coaching Drills */}
        <Card className="no-print">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Dumbbell className="h-5 w-5 text-primary" />
                  Coaching Drills
                </CardTitle>
                <CardDescription>Personalized exercises to improve your pitch</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleFetchDrills}
                disabled={drillsLoading}
              >
                {drillsLoading ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : drills.length > 0 ? (
                  <RefreshCw className="h-4 w-4 mr-1" />
                ) : (
                  <Target className="h-4 w-4 mr-1" />
                )}
                {drills.length > 0 ? "Refresh Drills" : "Get Coaching Drills"}
              </Button>
            </div>
          </CardHeader>
          {drills.length > 0 && (
            <CardContent className="space-y-3">
              {drills.map((drill, index) => (
                <div
                  key={index}
                  className="border rounded-lg p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => toggleDrill(index)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold">{drill.title}</h4>
                        <Badge variant="outline" className="text-xs">{drill.targetDimension}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{drill.description}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className={`text-sm font-medium ${getScoreColor(drill.currentScore)}`}>
                          {drill.currentScore}
                        </span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <span className={`text-sm font-bold ${getScoreColor(drill.targetScore)}`}>
                          {drill.targetScore}
                        </span>
                        <Badge variant="outline" className={`text-xs ${getDifficultyColor(drill.difficulty)}`}>
                          {drill.difficulty}
                        </Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {drill.estimatedTime}
                        </span>
                      </div>
                    </div>
                    {expandedDrills.has(index) ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                  </div>
                  {expandedDrills.has(index) && drill.steps.length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-sm font-medium mb-2">Steps to complete:</p>
                      <ol className="space-y-2">
                        {drill.steps.map((step, stepIndex) => (
                          <li key={stepIndex} className="flex items-start gap-2 text-sm">
                            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium mt-0.5">
                              {stepIndex + 1}
                            </span>
                            <span className="text-muted-foreground">{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          )}
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Add Notes</CardTitle>
              <div className="flex items-center gap-1 text-xs text-muted-foreground no-print">
                {notesSaving && (
                  <span className="flex items-center gap-1 text-primary">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Saving...
                  </span>
                )}
                {notesSaved && !notesSaving && (
                  <span className="flex items-center gap-1 text-emerald-500">
                    <Check className="h-3 w-3" />
                    Saved ✓
                  </span>
                )}
                {!notesSaving && !notesSaved && hasUnsavedChanges.current && (
                  <span className="flex items-center gap-1 text-yellow-500">
                    <Save className="h-3 w-3" />
                    Unsaved
                  </span>
                )}
              </div>
            </div>
            <CardDescription>Personal notes for this session</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Add your notes here..."
              value={notes}
              onChange={(e) => handleNotesChange(e.target.value)}
              maxLength={2000}
              className="min-h-[100px]"
            />
            <p className="text-xs text-muted-foreground mt-2">{notes.length}/2000 characters</p>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 no-print">
          <Button variant="outline" onClick={() => router.push("/pitch-deck-analyser/history")}>
            <FileText className="h-4 w-4 mr-1" />
            View All Sessions
          </Button>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleIterate}
              disabled={iterating}
            >
              {iterating ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-1" />
              )}
              Iterate &amp; Improve
            </Button>
            <Button onClick={() => router.push("/pitch-deck-analyser/new")} className="bg-primary hover:bg-primary/90">
              New Analysis
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
