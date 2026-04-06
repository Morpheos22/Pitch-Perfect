"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  Download, 
  Share2, 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle2,
  Video,
  Clock,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface ScriptLiveSession {
  id: string;
  fileName?: string;
  status?: string;
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
  duration?: number;
  createdAt?: string;
  deliveryFeedback?: string | null;
  bodyLanguageFeedback?: string | null;
  type?: string;
}

function getScoreColor(score: number) {
  if (score >= 70) return "text-secondary";
  if (score >= 40) return "text-yellow-500";
  return "text-destructive";
}

function getScoreLabel(score: number) {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Pitch Ready";
  if (score >= 55) return "Good foundation";
  if (score >= 40) return "Needs work";
  return "Critical";
}

export default function LiveScriptSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [session, setSession] = useState<ScriptLiveSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
        if (result.session) {
          setSession(result.session);
        } else if (result.data) {
          setSession(result.data);
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

  const handleCopy = () => {
    const text = session?.deliveryFeedback || "No feedback available";
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => toast.success("Report downloaded");

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

  const overallScore = session.overallDeliveryScore ?? 0;
  const sessionDate = session.createdAt
    ? new Date(session.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : "—";

  const vocalScores = [
    { name: "Pacing", score: session.paceScore },
    { name: "Clarity", score: session.clarityScore },
    { name: "Energy", score: session.energyScore },
    { name: "Confidence", score: session.confidenceScore },
  ].filter(s => s.score !== null && s.score !== undefined && s.score > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/elevator-pitch-live/new")}>
            <ArrowLeft className="w-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {session.fileName || "Script Practice Session"}
            </h1>
            <p className="text-muted-foreground">Live Script Analysis • {sessionDate}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={handleCopy}>
            {copied ? <CheckCircle2 className="w-4 h-4 text-secondary" /> : <Download className="w-4 h-4" />}
            {copied ? "Copied" : "Copy Feedback"}
          </Button>
          <Button variant="outline" className="gap-2" onClick={handleDownload}>
            <Download className="w-4 h-4" />
            Download
          </Button>
        </div>
      </div>

      {/* Score Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6 text-center"><p className="text-4xl font-bold text-secondary">{overallScore}</p><p className="text-sm text-muted-foreground">Overall Score</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><p className="text-4xl font-bold">{session.wordsPerMinute ?? "—"}</p><p className="text-sm text-muted-foreground">Words/Min</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><p className="text-4xl font-bold flex items-center justify-center gap-1"><Clock className="w-5 h-5 text-muted-foreground" />{session.duration ?? "—"}</p><p className="text-sm text-muted-foreground">Duration (s)</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><Badge variant="secondary" className="text-lg px-4 py-2 bg-secondary/10 text-secondary">{getScoreLabel(overallScore)}</Badge></CardContent></Card>
      </div>

      {/* Vocal Delivery Scores */}
      {vocalScores.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Delivery Scores</CardTitle>
            <CardDescription>Your vocal delivery breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {vocalScores.map(({ name, score }) => (
                <div key={name} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{name}</span>
                    <span className="font-medium">{score}/100</span>
                  </div>
                  <Progress value={score} className="h-2" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Feedback */}
      {session.deliveryFeedback && (
        <Card>
          <CardHeader>
            <CardTitle>AI Coach Feedback</CardTitle>
            <CardDescription>Personalized recommendations for your pitch</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="p-4 rounded-lg bg-muted/50 whitespace-pre-wrap text-sm leading-relaxed">
              {session.deliveryFeedback}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Continue to Live Recording */}
      <Card className="border-orange-500/20 bg-orange-500/5">
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center">
                <Video className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <h3 className="font-bold">Ready to Practice Delivery?</h3>
                <p className="text-sm text-muted-foreground">Continue with a live recording session for delivery coaching</p>
              </div>
            </div>
            <Button onClick={() => router.push("/elevator-pitch-live/live/new")} className="bg-orange-500 hover:bg-orange-500/90 gap-2">
              Start Recording
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
