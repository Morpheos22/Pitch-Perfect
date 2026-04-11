"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  Download,
  Share2,
  ArrowRight,
  ChevronLeft,
  CheckCircle,
  AlertTriangle,
  Video,
  FileText,
  TrendingUp,
  Target,
  Brain,
  Clock,
  Calendar,
  HelpCircle,
  Award,
  BarChart3,
  Loader2,
  Dumbbell,
  Trash2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Check,
  Save
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

interface SessionData {
  id: string;
  status: string;
  createdAt: string;
  analyzedAt?: string;
  duration: number;
  investorReadinessLevel: string;
  overallReadinessScore: number;
  problemSolutionFit: number;
  marketOpportunity: number;
  businessModelViability: number;
  teamCredibility: number;
  tractionMilestones: number;
  deliveryPresence: number;
  contentScores: Record<string, number>;
  deliveryScores: Record<string, number>;
  strengths: string[];
  weaknesses: string[];
  investorConcerns: string[];
  recommendedActions: string[];
  anticipatedQuestions: Array<{ question: string; suggestedAnswer: string; difficulty: string }>;
  competitiveAnalysis?: {
    percentileVsPeers: number;
    standoutElements: string[];
    commonMistakes: string[];
  };
  transcript?: string;
  pitchDeck?: {
    id: string;
    fileName: string;
    overallScore: number;
  };
  notes?: string;
  version?: number;
  parentId?: string;
}

function getScoreColor(score: number) {
  if (score >= 70) return "text-emerald-500";
  if (score >= 40) return "text-yellow-500";
  return "text-red-500";
}

function getScoreBg(score: number) {
  if (score >= 70) return "bg-emerald-500/10";
  if (score >= 40) return "bg-yellow-500/10";
  return "bg-red-500/10";
}

function getDifficultyColor(difficulty: string) {
  switch (difficulty) {
    case "beginner": return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
    case "intermediate": return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20";
    case "advanced": return "bg-red-500/10 text-red-600 border-red-500/20";
    default: return "";
  }
}

function formatReadinessLevel(level: string): string {
  return level?.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()) || "Unknown";
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default function FullPitchSessionPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params.id as string;
  
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState("");

  // Notes persistence
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const notesTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasUnsavedChanges = useRef(false);

  // Coaching drills
  const [drills, setDrills] = useState<Drill[]>([]);
  const [drillsLoading, setDrillsLoading] = useState(false);
  const [expandedDrills, setExpandedDrills] = useState<Set<number>>(new Set());

  // Iterate & Improve
  const [iterating, setIterating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchSession();
  }, [sessionId]);

  // Load notes from session data when it arrives
  useEffect(() => {
    if (session?.notes) {
      setNotes(session.notes);
    }
  }, [session]);

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

  const fetchSession = async () => {
    try {
      const response = await fetch(`/api/coach/full?id=${encodeURIComponent(sessionId)}`);
      const data = await response.json();
      
      if (response.ok && data.id) {
        setSession(data);
      } else {
        toast.error("Session not found");
        router.push("/coach/full");
      }
    } catch (error) {
      console.error("Failed to fetch session:", error);
      toast.error("Failed to load session");
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
      if (!session?.id) return;
      setNotesSaving(true);
      try {
        const res = await fetch("/api/coach/full", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: session.id, notes: value }),
        });
        if (res.ok) {
          setNotesSaved(true);
          hasUnsavedChanges.current = false;
          setTimeout(() => setNotesSaved(false), 3000);
        }
      } catch {
        // silently fail
      } finally {
        setNotesSaving(false);
      }
    }, 1500);
  }, [session?.id]);

  // Fetch coaching drills
  const handleFetchDrills = async () => {
    if (drills.length > 0) return;
    setDrillsLoading(true);
    try {
      const res = await fetch("/api/coach/drills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sessionId, moduleType: "e4" }),
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

  // Iterate: call the full iterate API to re-analyze with previous context
  const handleIterate = async () => {
    setIterating(true);
    try {
      const res = await fetch("/api/coach/full/iterate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: sessionId }),
      });
      if (res.ok) {
        const result = await res.json();
        toast.success("New version created! Comparing with previous analysis...");
        router.push(`/coach/full/session/${encodeURIComponent(result.id)}`);
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
      const res = await fetch(`/api/coach/full?id=${encodeURIComponent(sessionId)}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Session deleted");
        router.push("/coach/full");
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

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Link copied to clipboard");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold">Session not found</h2>
        <p className="text-muted-foreground mt-2">This analysis session doesn't exist or has been deleted.</p>
        <Button onClick={() => router.push("/coach/full")} className="mt-4">
          Start New Analysis
        </Button>
      </div>
    );
  }

  const dimensions = [
    { name: "Problem-Solution Fit", score: session.problemSolutionFit, description: "Solution addresses real problem" },
    { name: "Market Opportunity", score: session.marketOpportunity, description: "Attractive market size" },
    { name: "Business Model", score: session.businessModelViability, description: "Clear path to revenue" },
    { name: "Team Credibility", score: session.teamCredibility, description: "Can execute the vision" },
    { name: "Traction & Milestones", score: session.tractionMilestones, description: "Evidence of progress" },
    { name: "Delivery & Presence", score: session.deliveryPresence, description: "Confident presentation" },
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
          .max-w-5xl { max-width: 100% !important; }
          * { color-adjust: exact; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      {/* Print-only report header */}
      <div className="print-only hidden mb-8">
        <h1 className="text-2xl font-bold">Full Pitch Analysis Report</h1>
        <p className="text-muted-foreground">
          {new Date(session.createdAt).toLocaleDateString()} · Duration: {formatDuration(session.duration)}
        </p>
        <p className="text-lg mt-2">
          Overall Readiness: {session.overallReadinessScore}/100 — {formatReadinessLevel(session.investorReadinessLevel)}
        </p>
      </div>

      <div className="max-w-5xl mx-auto space-y-6 pb-8">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4 no-print">
          <div>
            <Button variant="ghost" size="sm" onClick={() => router.push("/coach/full")} className="mb-2">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-emerald-500" />
              Full Pitch Analysis
            </h1>
            <p className="text-muted-foreground flex items-center gap-4 mt-1">
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {new Date(session.createdAt).toLocaleDateString()}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {formatDuration(session.duration)}
              </span>
            </p>
            {session.version !== undefined && (
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline">v{session.version}</Badge>
                {session.parentId && (
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs text-muted-foreground"
                    onClick={() => router.push(`/coach/full/session/${encodeURIComponent(String(session.parentId))}`)}
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
            <Button size="sm" onClick={handleDownload} className="bg-emerald-500 hover:bg-emerald-500/90">
              <Download className="h-4 w-4 mr-1" />
              Download PDF
            </Button>
          </div>
        </div>

        {/* Overall Score */}
        <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-transparent">
          <CardContent className="py-8">
            <div className="flex flex-col md:flex-row items-center justify-center gap-8">
              <div className="text-center">
                <div className={`text-7xl font-bold ${getScoreColor(session.overallReadinessScore)}`}>
                  {session.overallReadinessScore}
                </div>
                <p className="text-lg font-medium mt-2">/ 100</p>
              </div>
              <div className="w-px h-20 bg-border hidden md:block" />
              <div className="text-center md:text-left">
                <Badge 
                  className={`text-lg px-4 py-2 ${
                    session.investorReadinessLevel === "HIGHLY_PREPARED" ? "bg-emerald-500" :
                    session.investorReadinessLevel === "INVESTOR_READY" ? "bg-blue-500" :
                    session.investorReadinessLevel === "NEEDS_WORK" ? "bg-yellow-500" : "bg-red-500"
                  }`}
                >
                  {formatReadinessLevel(session.investorReadinessLevel)}
                </Badge>
                <p className="text-muted-foreground mt-2">
                  {session.investorReadinessLevel === "HIGHLY_PREPARED" 
                    ? "Exceptional pitch that stands out from the crowd"
                    : session.investorReadinessLevel === "INVESTOR_READY"
                    ? "Ready for investor conversations"
                    : session.investorReadinessLevel === "NEEDS_WORK"
                    ? "Promising but has gaps to address"
                    : "Significant work needed before investor meetings"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 6-Dimension Scores */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="w-5 h-5 text-emerald-500" />
              6-Dimension Investor Readiness
            </CardTitle>
            <CardDescription>Your pitch evaluated across key investor criteria</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {dimensions.map((dim) => (
                <div key={dim.name} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">{dim.name}</span>
                      <p className="text-xs text-muted-foreground">{dim.description}</p>
                    </div>
                    <span className={`text-xl font-bold ${getScoreColor(dim.score)}`}>
                      {dim.score}
                    </span>
                  </div>
                  <Progress value={dim.score} className="h-2" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="strengths" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="strengths">Strengths</TabsTrigger>
            <TabsTrigger value="weaknesses">Gaps</TabsTrigger>
            <TabsTrigger value="qa">Q&A Prep</TabsTrigger>
            <TabsTrigger value="detailed">Detailed</TabsTrigger>
          </TabsList>

          {/* Strengths Tab */}
          <TabsContent value="strengths" className="space-y-4 mt-4">
            <Card className="border-emerald-500/20 bg-emerald-500/5">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-emerald-500" />
                  Key Strengths
                </CardTitle>
                <CardDescription>What's working well in your pitch</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {session.strengths?.map((strength, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{strength}</span>
                    </li>
                  )) || (
                    <li className="text-muted-foreground">No strengths recorded</li>
                  )}
                </ul>
              </CardContent>
            </Card>

            <Card className="border-yellow-500/20 bg-yellow-500/5">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  Areas to Improve
                </CardTitle>
                <CardDescription>Gaps to address before investor meetings</CardDescription>
              </CardHeader>
              <CardContent>
                <ol className="space-y-3">
                  {session.weaknesses?.map((weakness, index) => (
                    <li key={index} className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow-500 text-yellow-950 flex items-center justify-center text-sm font-medium">
                        {index + 1}
                      </span>
                      <span>{weakness}</span>
                    </li>
                  )) || (
                    <li className="text-muted-foreground">No weaknesses recorded</li>
                  )}
                </ol>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Weaknesses/Gaps Tab */}
          <TabsContent value="weaknesses" className="space-y-4 mt-4">
            <Card className="border-red-500/20 bg-red-500/5">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  Investor Concerns
                </CardTitle>
                <CardDescription>Questions investors will likely raise</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {session.investorConcerns?.map((concern, index) => (
                    <li key={index} className="flex items-start gap-3 p-3 rounded-lg bg-red-500/10">
                      <HelpCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                      <span>{concern}</span>
                    </li>
                  )) || (
                    <li className="text-muted-foreground">No concerns recorded</li>
                  )}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="h-5 h-5 text-primary" />
                  Recommended Actions
                </CardTitle>
                <CardDescription>Priority steps to improve investor readiness</CardDescription>
              </CardHeader>
              <CardContent>
                <ol className="space-y-3">
                  {session.recommendedActions?.map((action, index) => (
                    <li key={index} className="flex gap-3 p-3 rounded-lg bg-muted/50">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-medium">
                        {index + 1}
                      </span>
                      <span>{action}</span>
                    </li>
                  )) || (
                    <li className="text-muted-foreground">No actions recorded</li>
                  )}
                </ol>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Q&A Prep Tab */}
          <TabsContent value="qa" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Brain className="h-5 w-5 text-primary" />
                  Anticipated Investor Questions
                </CardTitle>
                <CardDescription>Be prepared with these likely questions and suggested answers</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {session.anticipatedQuestions?.map((qa, index) => (
                  <div key={index} className="p-4 rounded-lg bg-muted/50 space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <p className="font-medium">{qa.question}</p>
                      <Badge 
                        variant={
                          qa.difficulty === "hard" ? "destructive" :
                          qa.difficulty === "medium" ? "default" : "secondary"
                        }
                      >
                        {qa.difficulty}
                      </Badge>
                    </div>
                    <div className="p-3 rounded bg-emerald-500/10 border border-emerald-500/20">
                      <p className="text-sm"><strong>Suggested Answer:</strong> {qa.suggestedAnswer}</p>
                    </div>
                  </div>
                )) || (
                  <p className="text-muted-foreground">No Q&A preparation available</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Detailed Tab */}
          <TabsContent value="detailed" className="space-y-4 mt-4">
            {/* Content Scores */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart3 className="h-5 h-5 text-primary" />
                  Content Breakdown
                </CardTitle>
                <CardDescription>Detailed analysis of your pitch content</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {session.contentScores && Object.entries(session.contentScores).map(([key, score]) => (
                  <div key={key} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                      <span className={getScoreColor(score)}>{score}</span>
                    </div>
                    <Progress value={score} className="h-1.5" />
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Delivery Scores */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Video className="h-5 w-5 text-emerald-500" />
                  Delivery Breakdown
                </CardTitle>
                <CardDescription>How you presented your pitch</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {session.deliveryScores && Object.entries(session.deliveryScores).map(([key, score]) => (
                  <div key={key} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                      <span className={getScoreColor(score)}>{score}</span>
                    </div>
                    <Progress value={score} className="h-1.5" />
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Competitive Analysis */}
            {session.competitiveAnalysis && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Award className="h-5 w-5 text-primary" />
                    Competitive Context
                  </CardTitle>
                  <CardDescription>How your pitch compares to peer startups</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <p className="text-4xl font-bold text-primary">{session.competitiveAnalysis.percentileVsPeers}th</p>
                    <p className="text-sm text-muted-foreground">percentile vs. peer pitches</p>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-sm mb-2 text-emerald-500">Standout Elements</h4>
                    <ul className="space-y-1">
                      {session.competitiveAnalysis.standoutElements?.map((el, i) => (
                        <li key={i} className="text-sm flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-emerald-500" />
                          {el}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-medium text-sm mb-2 text-yellow-500">Common Mistakes to Avoid</h4>
                    <ul className="space-y-1">
                      {session.competitiveAnalysis.commonMistakes?.map((m, i) => (
                        <li key={i} className="text-sm flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-yellow-500" />
                          {m}
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Transcript */}
            {session.transcript && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Full Transcript</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="p-4 rounded-lg bg-muted/50 max-h-96 overflow-y-auto">
                    <p className="text-sm whitespace-pre-wrap">{session.transcript}</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Coaching Drills */}
        <Card className="no-print">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Dumbbell className="h-5 w-5 text-emerald-500" />
                  Coaching Drills
                </CardTitle>
                <CardDescription>Personalized exercises to improve your investor readiness</CardDescription>
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
                            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center text-xs font-medium mt-0.5">
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
              placeholder="Add your notes for this session..."
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
          <Button variant="outline" onClick={() => router.push("/coach/full")}>
            View All Sessions
          </Button>
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleIterate} disabled={iterating}>
              {iterating ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-1" />
              )}
              Iterate &amp; Improve
            </Button>
            <Button variant="outline" onClick={() => router.push("/pitch-deck-analyser/new")}>
              <FileText className="h-4 w-4 mr-1" />
              Deck Only
            </Button>
            <Button onClick={() => router.push("/coach/full/new")} className="bg-emerald-500 hover:bg-emerald-500/90">
              New Full Session
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
