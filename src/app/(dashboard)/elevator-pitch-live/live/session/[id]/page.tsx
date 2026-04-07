"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  Download, 
  Share2, 
  ArrowRight, 
  ChevronLeft, 
  CheckCircle,
  AlertTriangle,
  Video,
  Mic,
  MessageSquare,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface LiveSession {
  id: string;
  fileName?: string;
  duration?: number;
  createdAt?: string;
  overallDeliveryScore?: number | null;
  overallBodyLanguageScore?: number | null;
  paceScore?: number | null;
  clarityScore?: number | null;
  fillerWordScore?: number | null;
  energyScore?: number | null;
  confidenceScore?: number | null;
  eyeContactScore?: number | null;
  facialExpressionScore?: number | null;
  gestureScore?: number | null;
  postureScore?: number | null;
  wordsPerMinute?: number | null;
  fillerWordCount?: number | null;
  fillerWords?: string[] | null;
  deliveryFeedback?: string | null;
  bodyLanguageFeedback?: string | null;
  keyMoments?: Array<{ timestamp: number; type: string; description: string }> | null;
  transcript?: string | null;
  status?: string;
  type?: string;
}

function getScoreColor(score: number) {
  if (score >= 70) return "text-secondary";
  if (score >= 40) return "text-yellow-500";
  return "text-destructive";
}

function getScoreLabel(score: number) {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Strong";
  if (score >= 55) return "Building confidence";
  if (score >= 40) return "Needs work";
  return "Getting started";
}

function formatDuration(seconds?: number | null): string {
  if (!seconds) return "—";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins} min ${secs} sec`;
}

export default function LiveSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [session, setSession] = useState<LiveSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await fetch(`/api/coach/live?id=${id}`);
        if (!res.ok) {
          if (res.status === 401) { router.push("/sign-in"); return; }
          if (res.status === 404) { setError("Session not found"); return; }
          throw new Error("Failed to fetch session");
        }
        const result = await res.json();
        if (result.id) {
          setSession(result);
        } else {
          setError("Session not found");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load session");
      } finally {
        setLoading(false);
      }
    };
    fetchSession();
  }, [id, router]);

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

  if (error || !session) {
    return (
      <div className="max-w-4xl mx-auto text-center py-20">
        <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">Error Loading Session</h2>
        <p className="text-muted-foreground mb-4">{error || "Session not found"}</p>
        <Button onClick={() => router.push("/elevator-pitch-live/new")}>
          Back to Elevator Live
        </Button>
      </div>
    );
  }

  const isVideo = session.type?.toUpperCase() !== "AUDIO";
  const overallScore = session.overallDeliveryScore ?? 0;
  const sessionDate = session.createdAt
    ? new Date(session.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
    : "—";

  const vocalScores = [
    { name: "Pacing", score: session.paceScore ?? 0, feedback: session.paceScore ? (session.paceScore >= 70 ? "Good pace throughout." : "Try to maintain a more consistent pace.") : "Not available" },
    { name: "Clarity", score: session.clarityScore ?? 0, feedback: session.clarityScore ? (session.clarityScore >= 70 ? "Clear articulation." : "Focus on clearer pronunciation.") : "Not available" },
    { name: "Energy", score: session.energyScore ?? 0, feedback: session.energyScore ? (session.energyScore >= 70 ? "Strong enthusiasm." : "Bring more energy to your delivery.") : "Not available" },
    { name: "Confidence", score: session.confidenceScore ?? 0, feedback: session.confidenceScore ? (session.confidenceScore >= 70 ? "Appears confident." : "Practice to build confidence.") : "Not available" },
  ].filter(s => s.score > 0);

  const bodyLanguageScores = [
    { name: "Eye Contact", score: session.eyeContactScore ?? 0, feedback: session.eyeContactScore ? (session.eyeContactScore >= 70 ? "Good eye contact." : "Try to maintain more consistent eye contact.") : "Not available" },
    { name: "Posture", score: session.postureScore ?? 0, feedback: session.postureScore ? (session.postureScore >= 70 ? "Good posture." : "Stand taller and maintain an open posture.") : "Not available" },
    { name: "Gestures", score: session.gestureScore ?? 0, feedback: session.gestureScore ? (session.gestureScore >= 70 ? "Natural gestures." : "Add more purposeful gestures.") : "Not available" },
  ].filter(s => s.score > 0);

  const strengths: string[] = [];
  const priorityActions: string[] = [];

  if (session.deliveryFeedback) {
    strengths.push(session.deliveryFeedback);
  }
  if (session.bodyLanguageFeedback) {
    if (session.bodyLanguageFeedback !== session.deliveryFeedback) {
      strengths.push(session.bodyLanguageFeedback);
    }
  }
  if (session.fillerWordCount && session.fillerWordCount > 0) {
    priorityActions.push(`Reduce filler words — detected ${session.fillerWordCount} filler words${session.fillerWords?.length ? `: ${session.fillerWords.slice(0, 5).join(", ")}` : ""}`);
  }
  if (session.wordsPerMinute && session.wordsPerMinute > 160) {
    priorityActions.push(`Slow down — you spoke at ${session.wordsPerMinute} words per minute (target: 120-150)`);
  }

  if (strengths.length === 0) {
    strengths.push("Analysis data available in your session report");
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Button variant="ghost" size="sm" onClick={() => router.push("/elevator-pitch-live/new")} className="mb-2">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <h1 className="text-2xl font-bold">{session.fileName || "Live Pitch Session"}</h1>
          <p className="text-muted-foreground">{sessionDate}</p>
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
              <Badge variant="secondary" className="flex items-center gap-1">
                {isVideo ? <Video className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
                {isVideo ? "Video" : "Audio"}
              </Badge>
              <span className="text-sm">{formatDuration(session.duration)}</span>
              {session.wordsPerMinute && (
                <span className="text-sm">{session.wordsPerMinute} WPM</span>
              )}
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
              <div className={`text-6xl font-bold ${getScoreColor(overallScore)}`}>
                {overallScore}
              </div>
              <p className="text-lg font-medium mt-2">{getScoreLabel(overallScore)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Executive Summary */}
      {session.deliveryFeedback && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Executive Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{session.deliveryFeedback}</p>
          </CardContent>
        </Card>
      )}

      {/* Strengths */}
      <Card className="border-secondary/30 bg-secondary/5">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-secondary" />
            What Is Working
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {strengths.map((strength, index) => (
              <li key={index} className="flex items-start gap-2">
                <CheckCircle className="h-4 h-4 text-secondary shrink-0 mt-0.5" />
                <span>{strength}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Priority Actions */}
      {priorityActions.length > 0 && (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 h-5 text-yellow-500" />
              Your Top Actions Before Next Recording
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3">
              {priorityActions.slice(0, 3).map((action, index) => (
                <li key={index} className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow-500 text-yellow-950 flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </span>
                  <span>{action}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      {/* Vocal Delivery */}
      {vocalScores.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Vocal Delivery</CardTitle>
            <CardDescription>How you sound to your audience</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {vocalScores.map((item) => (
              <div key={item.name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{item.name}</span>
                  <span className={`text-xl font-bold ${getScoreColor(item.score)}`}>{item.score}</span>
                </div>
                <Progress value={item.score} className="h-2" />
                <p className="text-sm text-muted-foreground">{item.feedback}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Body Language */}
      {isVideo && bodyLanguageScores.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Body Language</CardTitle>
            <CardDescription>How you present physically</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {bodyLanguageScores.map((item) => (
              <div key={item.name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{item.name}</span>
                  <span className={`text-xl font-bold ${getScoreColor(item.score)}`}>{item.score}</span>
                </div>
                <Progress value={item.score} className="h-2" />
                <p className="text-sm text-muted-foreground">{item.feedback}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Key Moments */}
      {session.keyMoments && session.keyMoments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Key Moments</CardTitle>
            <CardDescription>Notable moments during your pitch</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {session.keyMoments.map((moment, index) => (
                <div key={index} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                  <Badge variant="outline" className="shrink-0 mt-0.5">{moment.timestamp}s</Badge>
                  <div>
                    <p className="font-medium text-sm capitalize">{moment.type.replace(/_/g, " ")}</p>
                    <p className="text-sm text-muted-foreground">{moment.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <Button variant="outline" onClick={() => router.push("/elevator-pitch-live/new")}>
          View All Sessions
        </Button>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => router.push("/elevator-pitch-live/script/new")}>
            <MessageSquare className="h-4 w-4 mr-1" />
            Script Session
          </Button>
          <Button onClick={() => router.push("/elevator-pitch-live/live/new")} className="bg-primary hover:bg-primary/90">
            Record Another
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
