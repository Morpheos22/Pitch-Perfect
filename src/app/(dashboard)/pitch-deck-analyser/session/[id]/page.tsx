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
  FileText,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

interface AnalysisData {
  id: string;
  status: string;
  fileName: string;
  createdAt: string;
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

export default function PitchDeckSessionPage() {
  const router = useRouter();
  const params = useParams();
  const [notes, setNotes] = useState("");
  const [data, setData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSessionData();
  }, [params.id]);

  const fetchSessionData = async () => {
    try {
      const response = await fetch(`/api/coach/deck?id=${params.id}`);
      
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

  const handleDownload = () => {
    toast.success("Report PDF downloaded");
  };

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

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")} className="mb-2">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Dashboard
          </Button>
          <h1 className="text-2xl font-bold">{fileName}</h1>
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

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Add Notes</CardTitle>
          <CardDescription>Personal notes for this session</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Add your notes here..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={1000}
            className="min-h-[100px]"
          />
          <p className="text-xs text-muted-foreground mt-2">{notes.length}/1000 characters</p>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-between items-center">
        <Button variant="outline" onClick={() => router.push("/history")}>
          <FileText className="h-4 w-4 mr-1" />
          View All Sessions
        </Button>
        <Button onClick={() => router.push("/pitch-deck-analyser/new")} className="bg-primary hover:bg-primary/90">
          New Analysis
          <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
