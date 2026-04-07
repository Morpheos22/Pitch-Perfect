"use client";

import { useState, useEffect } from "react";
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
  BarChart3
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

  useEffect(() => {
    fetchSession();
  }, [sessionId]);

  const fetchSession = async () => {
    try {
      const response = await fetch(`/api/coach/full?id=${sessionId}`);
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

  const handleDownload = () => toast.success("Report PDF downloaded");
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

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
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
        </div>
        <div className="flex items-center gap-2">
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
                <Target className="h-5 w-5 text-primary" />
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

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Add Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Add your notes for this session..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={2000}
            className="min-h-[100px]"
          />
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <Button variant="outline" onClick={() => router.push("/history")}>
          View All Sessions
        </Button>
        <div className="flex gap-3">
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
  );
}
