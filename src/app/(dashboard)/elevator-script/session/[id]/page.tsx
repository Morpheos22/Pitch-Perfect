"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { 
  Download, 
  Share2, 
  ArrowRight, 
  ChevronLeft, 
  TrendingUp,
  CheckCircle,
  AlertTriangle,
  Quote,
  Type,
  Clock,
  Mic,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

interface ScriptData {
  id: string;
  status: string;
  inputType: string;
  fileName?: string;
  createdAt: string;
  targetAudience?: string;
  analysis?: {
    scores: {
      hook: number;
      problem: number;
      solution: number;
      credibility: number;
      cta: number;
      overall: number;
    };
    metrics: {
      wordCount: number;
      estimatedDuration: number;
    };
    improvements: {
      hook: string[];
      problem: string[];
      solution: string[];
      credibility: string[];
      cta: string[];
    };
    rewrittenScript: string;
    alternativeHooks: string[];
  };
}

function getScoreColor(score: number) {
  if (score >= 70) return "text-secondary";
  if (score >= 40) return "text-yellow-500";
  return "text-destructive";
}

function getScoreLabel(score: number) {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Strong";
  if (score >= 55) return "Good foundation";
  if (score >= 40) return "Needs work";
  return "Critical";
}

export default function ElevatorScriptSessionPage() {
  const router = useRouter();
  const params = useParams();
  const [notes, setNotes] = useState("");
  const [data, setData] = useState<ScriptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSessionData();
  }, [params.id]);

  const fetchSessionData = async () => {
    try {
      const response = await fetch(`/api/coach/script?id=${params.id}`);
      
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

  const handleDownload = () => toast.success("Report PDF downloaded");
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
        <Button onClick={() => router.push("/elevator-script/new")}>
          Start New Analysis
        </Button>
      </div>
    );
  }

  const { analysis, inputType, fileName, createdAt } = data;
  const date = new Date(createdAt).toLocaleDateString('en-US', { 
    month: 'long', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit'
  });

  const elementScores = [
    { name: "Hook", score: analysis.scores.hook, improvements: analysis.improvements.hook },
    { name: "Problem", score: analysis.scores.problem, improvements: analysis.improvements.problem },
    { name: "Solution", score: analysis.scores.solution, improvements: analysis.improvements.solution },
    { name: "Credibility", score: analysis.scores.credibility, improvements: analysis.improvements.credibility },
    { name: "Call to Action", score: analysis.scores.cta, improvements: analysis.improvements.cta },
  ];

  const durationStatus = analysis.metrics.estimatedDuration <= 90 ? "within target" : "too long";

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")} className="mb-2">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Dashboard
          </Button>
          <h1 className="text-2xl font-bold">{fileName || "Script Analysis"}</h1>
          <p className="text-muted-foreground">{date}</p>
        </div>
        <div className="flex items-center gap-2">
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

      {/* Stats Bar */}
      <Card className="border-primary/20">
        <CardContent className="py-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Type className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{analysis.metrics.wordCount} words</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">~{analysis.metrics.estimatedDuration}s spoken</span>
                <Badge variant={durationStatus === "within target" ? "secondary" : "outline"}>
                  {durationStatus}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Mic className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{inputType}</span>
              </div>
            </div>
            <Badge variant="secondary">Analysis Complete</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Overall Score */}
      <Card>
        <CardContent className="py-8 text-center">
          <div className="flex items-center justify-center gap-6">
            <div className="text-center">
              <div className={`text-6xl font-bold ${getScoreColor(analysis.scores.overall)}`}>
                {analysis.scores.overall}
              </div>
              <p className="text-lg font-medium mt-2">{getScoreLabel(analysis.scores.overall)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rewritten Script */}
      <Card className="border-secondary/30 bg-secondary/5">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-secondary" />
            AI-Optimized Version
          </CardTitle>
          <CardDescription>Our suggested rewrite incorporating all improvements</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap">{analysis.rewrittenScript}</p>
        </CardContent>
      </Card>

      {/* Alternative Hooks */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Alternative Opening Hooks</CardTitle>
          <CardDescription>Try these attention-grabbing alternatives</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {analysis.alternativeHooks.map((hook, index) => (
              <div key={index} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-medium">
                  {index + 1}
                </span>
                <p className="italic">{hook}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Element Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">5-Element Breakdown</CardTitle>
          <CardDescription>Element-by-element analysis with improvements</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {elementScores.map((element) => (
            <div key={element.name} className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold">{element.name}</span>
                <span className={`text-2xl font-bold ${getScoreColor(element.score)}`}>{element.score}</span>
              </div>
              <Progress value={element.score} className="h-2" />
              <div className="space-y-1">
                {element.improvements.map((improvement, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-sm">
                    <TrendingUp className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{improvement}</span>
                  </div>
                ))}
              </div>
              <Separator />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Add Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Add your notes here..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={1000}
            className="min-h-[100px]"
          />
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-between items-center">
        <Button variant="outline" onClick={() => router.push("/elevator-script/history")}>
          View All Sessions
        </Button>
        <Button onClick={() => router.push("/elevator-script/new")} className="bg-primary hover:bg-primary/90">
          New Analysis
          <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
