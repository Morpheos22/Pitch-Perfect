"use client";

import { useState } from "react";
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
  MessageSquare
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

const reportData = {
  sessionName: "Live Pitch — Practice 1",
  date: "March 24, 2026 at 4:15 PM",
  recordingMode: "video",
  duration: "2 min 18 sec",
  sessionNumber: 2,
  totalSessions: 3,
  overallScore: 71,
  overallLabel: "Building confidence",
  executiveSummary: "Your delivery shows genuine enthusiasm for your subject matter. The pacing is generally good, though you tend to speed up during the technical explanation. Eye contact is strong when you're comfortable, but drops during transitions. Your gestures support your message well. Focus on maintaining steady pacing and consistent eye contact throughout.",
  strengths: [
    "Strong opening hook with confident eye contact",
    "Gestures effectively emphasize key points",
    "Clear articulation of the problem statement",
  ],
  priorityActions: [
    "Slow down during the solution explanation — you're rushing through the technical details",
    "Maintain eye contact during transitions between slides/topics",
    "Add a brief pause before your ask to create anticipation",
  ],
  vocalScores: [
    { name: "Pacing", score: 68, feedback: "Generally good pace, but speeds up noticeably during the technical section. Aim for consistent timing throughout." },
    { name: "Clarity", score: 78, feedback: "Clear articulation with good enunciation. A few words were clipped at the end of sentences." },
    { name: "Energy", score: 82, feedback: "Strong energy and enthusiasm. Your passion for the subject comes through clearly." },
    { name: "Confidence", score: 72, feedback: "Confident overall, but nervousness shows during transitions. Practice smooth transitions between sections." },
  ],
  bodyLanguageScores: [
    { name: "Eye Contact", score: 65, feedback: "Strong when directly addressing the audience, but drops during slide transitions. Practice looking at the camera when moving between topics." },
    { name: "Posture", score: 75, feedback: "Generally upright and open posture. Occasional leaning forward when excited — stay centered." },
    { name: "Gestures", score: 80, feedback: "Natural, purposeful gestures that support your message. Well done on avoiding fidgeting." },
  ],
  coachingDrills: [
    {
      name: "Mirror Drill",
      target: "Eye Contact",
      steps: [
        "Set up a mirror at eye level or use your camera as a mirror",
        "Practice your full pitch while maintaining constant eye contact with your reflection",
        "Focus especially on transitions — don't look away when moving between points",
        "Repeat 3 times daily for a week",
      ],
      why: "This builds the muscle memory needed to maintain eye contact even during transitions.",
    },
    {
      name: "Tempo Tap",
      target: "Pacing",
      steps: [
        "Set a metronome to 100 BPM (beats per minute)",
        "Practice speaking one word per beat during your technical explanation",
        "Gradually increase to your natural speaking pace while staying rhythmic",
        "Record yourself and compare before/after pacing",
      ],
      why: "This helps you internalize a steady pace and recognize when you're speeding up.",
    },
    {
      name: "Power Pause",
      target: "Confidence",
      steps: [
        "Identify 3 key moments in your pitch where you'll pause for effect",
        "Practice taking a full 2-second pause at each moment",
        "During the pause, take a breath and make deliberate eye contact",
        "Resume speaking with renewed energy after each pause",
      ],
      why: "Strategic pauses demonstrate confidence and give your audience time to absorb key points.",
    },
  ],
};

function getScoreColor(score: number) {
  if (score >= 70) return "text-secondary";
  if (score >= 40) return "text-yellow-500";
  return "text-destructive";
}

export default function LiveSessionPage() {
  const router = useRouter();
  const [notes, setNotes] = useState("");

  const handleDownload = () => toast.success("Report PDF downloaded");
  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Link copied to clipboard");
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Button variant="ghost" size="sm" onClick={() => router.push("/elevator-pitch-live/new")} className="mb-2">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <h1 className="text-2xl font-bold">{reportData.sessionName}</h1>
          <p className="text-muted-foreground">{reportData.date}</p>
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
                {reportData.recordingMode === "video" ? <Video className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
                {reportData.recordingMode === "video" ? "Video" : "Audio"}
              </Badge>
              <span className="text-sm">{reportData.duration}</span>
            </div>
            <Badge variant="secondary">Session {reportData.sessionNumber} of {reportData.totalSessions}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Overall Score */}
      <Card>
        <CardContent className="py-8 text-center">
          <div className="flex items-center justify-center gap-6">
            <div className="text-center">
              <div className={`text-6xl font-bold ${getScoreColor(reportData.overallScore)}`}>
                {reportData.overallScore}
              </div>
              <p className="text-lg font-medium mt-2">{reportData.overallLabel}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Executive Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Executive Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">{reportData.executiveSummary}</p>
        </CardContent>
      </Card>

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
            {reportData.strengths.map((strength, index) => (
              <li key={index} className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-secondary shrink-0 mt-0.5" />
                <span>{strength}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Priority Actions */}
      <Card className="border-yellow-500/30 bg-yellow-500/5">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Your Top 3 Actions Before Next Recording
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3">
            {reportData.priorityActions.map((action, index) => (
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

      {/* Vocal Delivery */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Vocal Delivery</CardTitle>
          <CardDescription>How you sound to your audience</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {reportData.vocalScores.map((item) => (
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

      {/* Body Language */}
      {reportData.recordingMode === "video" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Body Language</CardTitle>
            <CardDescription>How you present physically</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {reportData.bodyLanguageScores.map((item) => (
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

      {/* Coaching Drills */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Practice Drills for Your Next Session</CardTitle>
          <CardDescription>Targeted exercises for your weakest areas</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {reportData.coachingDrills.map((drill, index) => (
            <div key={drill.name} className="p-4 bg-muted/50 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">{drill.name}</h4>
                <Badge variant="outline">for {drill.target}</Badge>
              </div>
              <ol className="space-y-2 text-sm">
                {drill.steps.map((step, stepIndex) => (
                  <li key={stepIndex} className="flex gap-2">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs">
                      {stepIndex + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
              <p className="text-xs text-muted-foreground italic">
                <strong>Why this helps:</strong> {drill.why}
              </p>
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
