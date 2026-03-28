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
  Mic,
  Play,
  MessageSquare,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface VideoSession {
  id: string;
  fileName: string;
  fileUrl: string;
  r2Key: string;
  duration: number;
  status: string;
  type: string;
  createdAt: string;
  
  // Scores
  paceScore: number;
  clarityScore: number;
  fillerWordScore: number;
  energyScore: number;
  confidenceScore: number;
  overallDeliveryScore: number;
  eyeContactScore: number;
  facialExpressionScore: number;
  gestureScore: number;
  postureScore: number;
  overallBodyLanguageScore: number;
  
  // Metrics
  wordsPerMinute: number;
  fillerWordCount: number;
  fillerWords: Record<string, number>;
  
  // Feedback
  deliveryFeedback: string;
  bodyLanguageFeedback: string;
  keyMoments: Array<{
    timestamp: string;
    description: string;
    type: 'positive' | 'improvement';
  }>;
  
  // Transcript
  transcript: string;
  analysis: object;
}

function getScoreColor(score: number) {
  if (score >= 70) return "text-secondary";
  if (score >= 40) return "text-yellow-500";
  return "text-destructive";
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default function LiveSessionPage() {
  const router = useRouter();
  const params = useParams();
  const videoId = params.id as string;
  
  const [session, setSession] = useState<VideoSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    fetchSession();
  }, [videoId]);

  const fetchSession = async () => {
    try {
      const response = await fetch(`/api/video?videoId=${videoId}`);
      const data = await response.json();
      
      if (response.ok && data.videoId) {
        // Fetch full analysis from coach/live endpoint
        const analysisRes = await fetch(`/api/coach/live?videoId=${videoId}`);
        const analysisData = await analysisRes.json();
        
        if (analysisRes.ok && analysisData.data) {
          setSession({
            id: videoId,
            fileName: '',
            fileUrl: data.downloadUrl || '',
            r2Key: '',
            duration: analysisData.data.metrics?.duration || 0,
            status: 'COMPLETED',
            type: 'LIVE',
            createdAt: new Date().toISOString(),
            paceScore: analysisData.data.deliveryScores?.pace || 0,
            clarityScore: analysisData.data.deliveryScores?.clarity || 0,
            fillerWordScore: analysisData.data.deliveryScores?.fillerWords || 0,
            energyScore: analysisData.data.deliveryScores?.energy || 0,
            confidenceScore: analysisData.data.deliveryScores?.confidence || 0,
            overallDeliveryScore: analysisData.data.overallDeliveryScore || 0,
            eyeContactScore: analysisData.data.bodyLanguageScores?.eyeContact || 0,
            facialExpressionScore: analysisData.data.bodyLanguageScores?.facialExpression || 0,
            gestureScore: analysisData.data.bodyLanguageScores?.gestures || 0,
            postureScore: analysisData.data.bodyLanguageScores?.posture || 0,
            overallBodyLanguageScore: analysisData.data.overallBodyLanguageScore || 0,
            wordsPerMinute: analysisData.data.metrics?.wordsPerMinute || 0,
            fillerWordCount: analysisData.data.metrics?.fillerWordCount || 0,
            fillerWords: analysisData.data.fillerWords || {},
            deliveryFeedback: analysisData.data.deliveryFeedback || '',
            bodyLanguageFeedback: analysisData.data.bodyLanguageFeedback || '',
            keyMoments: analysisData.data.keyMoments || [],
            transcript: analysisData.data.transcript || '',
            analysis: analysisData.data,
          });
        } else {
          // If analysis not ready, show basic info
          setSession({
            id: videoId,
            fileName: '',
            fileUrl: data.downloadUrl || '',
            r2Key: '',
            duration: 0,
            status: data.status || 'PENDING',
            type: 'LIVE',
            createdAt: new Date().toISOString(),
            paceScore: 0,
            clarityScore: 0,
            fillerWordScore: 0,
            energyScore: 0,
            confidenceScore: 0,
            overallDeliveryScore: 0,
            eyeContactScore: 0,
            facialExpressionScore: 0,
            gestureScore: 0,
            postureScore: 0,
            overallBodyLanguageScore: 0,
            wordsPerMinute: 0,
            fillerWordCount: 0,
            fillerWords: {},
            deliveryFeedback: '',
            bodyLanguageFeedback: '',
            keyMoments: [],
            transcript: '',
            analysis: {},
          });
        }
      } else {
        toast.error("Session not found");
        router.push("/elevator-pitch-live/new");
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
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold">Session not found</h2>
        <p className="text-muted-foreground mt-2">This recording session doesn't exist or has been deleted.</p>
        <Button onClick={() => router.push("/elevator-pitch-live/new")} className="mt-4">
          Record New Pitch
        </Button>
      </div>
    );
  }

  // If analysis is still processing
  if (session.status === "PENDING" || session.status === "PROCESSING") {
    return (
      <div className="max-w-md mx-auto text-center py-12">
        <Loader2 className="w-12 h-12 animate-spin text-orange-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold">Analysis In Progress</h2>
        <p className="text-muted-foreground mt-2">
          Your pitch recording is being analyzed. This typically takes 1-3 minutes.
        </p>
        <Button onClick={() => fetchSession()} variant="outline" className="mt-4">
          Check Again
        </Button>
      </div>
    );
  }

  const vocalScores = [
    { name: "Pacing", score: session.paceScore },
    { name: "Clarity", score: session.clarityScore },
    { name: "Filler Words", score: session.fillerWordScore },
    { name: "Energy", score: session.energyScore },
    { name: "Confidence", score: session.confidenceScore },
  ];

  const bodyLanguageScores = [
    { name: "Eye Contact", score: session.eyeContactScore },
    { name: "Facial Expression", score: session.facialExpressionScore },
    { name: "Gestures", score: session.gestureScore },
    { name: "Posture", score: session.postureScore },
  ];

  const overallScore = Math.round((session.overallDeliveryScore + session.overallBodyLanguageScore) / 2);

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <Button variant="ghost" size="sm" onClick={() => router.push("/elevator-pitch-live/new")} className="mb-2">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <h1 className="text-2xl font-bold">Live Pitch Analysis</h1>
          <p className="text-muted-foreground">
            {session.createdAt ? new Date(session.createdAt).toLocaleDateString() : "Recent session"}
          </p>
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
                <Video className="h-3 w-3" />
                Video
              </Badge>
              <span className="text-sm">{formatDuration(session.duration)}</span>
              <span className="text-sm">{session.wordsPerMinute} WPM</span>
            </div>
            <Badge variant="secondary">{session.fillerWordCount} filler words</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Overall Score */}
      <Card>
        <CardContent className="py-8 text-center">
          <div className="flex items-center justify-center gap-8">
            <div className="text-center">
              <div className={`text-5xl font-bold ${getScoreColor(overallScore)}`}>
                {overallScore}
              </div>
              <p className="text-lg font-medium mt-2">Overall Score</p>
            </div>
            <div className="w-px h-20 bg-border" />
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <div className={`text-2xl font-bold ${getScoreColor(session.overallDeliveryScore)}`}>
                  {session.overallDeliveryScore}
                </div>
                <p className="text-sm text-muted-foreground">Delivery</p>
              </div>
              <div>
                <div className={`text-2xl font-bold ${getScoreColor(session.overallBodyLanguageScore)}`}>
                  {session.overallBodyLanguageScore}
                </div>
                <p className="text-sm text-muted-foreground">Body Language</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delivery Feedback */}
      {session.deliveryFeedback && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Delivery Feedback</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{session.deliveryFeedback}</p>
          </CardContent>
        </Card>
      )}

      {/* Vocal Delivery Scores */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Vocal Delivery</CardTitle>
          <CardDescription>How you sound to your audience</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {vocalScores.map((item) => (
            <div key={item.name} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-medium">{item.name}</span>
                <span className={`text-xl font-bold ${getScoreColor(item.score)}`}>{item.score}</span>
              </div>
              <Progress value={item.score} className="h-2" />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Body Language Scores */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Body Language</CardTitle>
          <CardDescription>How you present physically</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {bodyLanguageScores.map((item) => (
            <div key={item.name} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-medium">{item.name}</span>
                <span className={`text-xl font-bold ${getScoreColor(item.score)}`}>{item.score}</span>
              </div>
              <Progress value={item.score} className="h-2" />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Body Language Feedback */}
      {session.bodyLanguageFeedback && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Body Language Feedback</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{session.bodyLanguageFeedback}</p>
          </CardContent>
        </Card>
      )}

      {/* Filler Words */}
      {session.fillerWords && Object.keys(session.fillerWords).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Filler Words Detected</CardTitle>
            <CardDescription>Words to reduce for clearer delivery</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {Object.entries(session.fillerWords).map(([word, count]) => (
                <Badge key={word} variant="outline" className="text-sm">
                  "{word}" × {count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Key Moments */}
      {session.keyMoments && session.keyMoments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Key Moments</CardTitle>
            <CardDescription>Notable moments in your pitch</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {session.keyMoments.map((moment, index) => (
                <div 
                  key={index}
                  className={`flex items-start gap-3 p-3 rounded-lg ${
                    moment.type === 'positive' ? 'bg-secondary/10' : 'bg-yellow-500/10'
                  }`}
                >
                  {moment.type === 'positive' ? (
                    <CheckCircle className="h-5 w-5 text-secondary shrink-0" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0" />
                  )}
                  <div>
                    <span className="text-xs font-mono text-muted-foreground">{moment.timestamp}</span>
                    <p className="text-sm">{moment.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transcript */}
      {session.transcript && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Transcript</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-4 rounded-lg bg-muted/50 max-h-96 overflow-y-auto">
              <p className="text-sm whitespace-pre-wrap">{session.transcript}</p>
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
            placeholder="Add your notes for this session..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={1000}
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
