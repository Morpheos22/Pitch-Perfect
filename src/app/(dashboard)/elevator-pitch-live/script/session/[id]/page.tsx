"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare,
  ArrowLeft,
  Download,
  Copy,
  CheckCircle2,
  Video,
  ArrowRight,
  Clock,
} from "lucide-react";
import Link from "next/link";

const mockAnalysis = {
  sessionName: "Demo Day Script v2",
  overallScore: 82,
  wordCount: 156,
  estimatedDuration: 62,
  createdAt: "2024-01-20T14:30:00Z",
  
  elementScores: {
    hook: 75,
    problem: 90,
    solution: 85,
    proof: 80,
    theAsk: 78,
  },
  
  toneAnalysis: {
    clarity: 88,
    confidence: 82,
    conciseness: 76,
  },
  
  improvedScript: `What if your sales team could close 34% more deals without hiring anyone new?

Every 5 minutes you delay responding to a lead, your win rate drops by 400%. That's a $47 billion problem.

We built TechFlow to change that. Our AI-powered platform helps sales teams respond 10x faster, increasing win rates by 34%.

We already have 150+ customers including Salesforce and HubSpot, grown from $0 to $2M ARR in 18 months.

We're raising $3M to reach $10M ARR by year-end. I'd love to share how we're transforming sales productivity.`,
};

export default function LiveScriptSessionPage() {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(mockAnalysis.improvedScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/elevator-pitch-live/new">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <MessageSquare className="w-6 h-6 text-accent" />
              {mockAnalysis.sessionName}
            </h1>
            <p className="text-muted-foreground">Script Analysis (M2) • {new Date(mockAnalysis.createdAt).toLocaleDateString()}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={handleCopy}>
            {copied ? <CheckCircle2 className="w-4 h-4 text-accent" /> : <Copy className="w-4 h-4" />}
            {copied ? "Copied" : "Copy Script"}
          </Button>
          <Button className="gap-2 bg-accent hover:bg-accent/90">
            <Download className="w-4 h-4" />
            Download
          </Button>
        </div>
      </div>

      {/* Score Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6 text-center"><p className="text-4xl font-bold text-accent">{mockAnalysis.overallScore}</p><p className="text-sm text-muted-foreground">Overall Score</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><p className="text-4xl font-bold">{mockAnalysis.wordCount}</p><p className="text-sm text-muted-foreground">Words</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><p className="text-4xl font-bold flex items-center justify-center gap-1"><Clock className="w-5 h-5 text-muted-foreground" />{mockAnalysis.estimatedDuration}s</p><p className="text-sm text-muted-foreground">Duration</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><Badge variant="secondary" className="text-lg px-4 py-2 bg-accent/10 text-accent">Pitch Ready</Badge></CardContent></Card>
      </div>

      {/* Element Scores */}
      <Card>
        <CardHeader><CardTitle>5-Element Scoring</CardTitle><CardDescription>Your script performance breakdown</CardDescription></CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(mockAnalysis.elementScores).map(([key, score]) => (
              <div key={key} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="capitalize">{key === "theAsk" ? "The Ask" : key}</span>
                  <span className="font-medium">{score}/100</span>
                </div>
                <Progress value={score} className="h-2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Improved Script */}
      <Card>
        <CardHeader><CardTitle>AI-Improved Script</CardTitle><CardDescription>Use this version for your live recording</CardDescription></CardHeader>
        <CardContent>
          <div className="p-4 rounded-lg bg-muted/50 whitespace-pre-wrap text-sm leading-relaxed">
            {mockAnalysis.improvedScript}
          </div>
        </CardContent>
      </Card>

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
                <p className="text-sm text-muted-foreground">Continue with a live recording session (M3) for delivery coaching</p>
              </div>
            </div>
            <Link href="/elevator-pitch-live/live/new">
              <Button className="bg-orange-500 hover:bg-orange-500/90 gap-2">
                Start Recording
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
