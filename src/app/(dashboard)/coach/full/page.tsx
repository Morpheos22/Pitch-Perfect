"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  ArrowRight,
  Video,
  FileText,
  Target,
  Brain,
  Clock,
  Users,
  CheckCircle
} from "lucide-react";
import Link from "next/link";

const features = [
  {
    icon: Video,
    title: "Video Analysis",
    description: "Full delivery and body language assessment",
  },
  {
    icon: FileText,
    title: "Deck Review",
    description: "Content quality and visual design scoring",
  },
  {
    icon: Target,
    title: "6-Dimension Scoring",
    description: "Investor readiness across key criteria",
  },
  {
    icon: Brain,
    title: "Q&A Preparation",
    description: "Anticipated questions with suggested answers",
  },
];

const readinessLevels = [
  { level: "NOT_READY", range: "0-40", color: "bg-red-500" },
  { level: "NEEDS_WORK", range: "41-60", color: "bg-yellow-500" },
  { level: "INVESTOR_READY", range: "61-80", color: "bg-blue-500" },
  { level: "HIGHLY_PREPARED", range: "81-100", color: "bg-emerald-500" },
];

export default function CoachFullPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-emerald-500" />
          Full Pitch Session
        </h1>
        <p className="text-muted-foreground">
          Comprehensive 30-minute investor pitch analysis (E4)
        </p>
      </div>

      {/* Main Card */}
      <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-transparent">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                Complete Investor Readiness Assessment
                <Badge className="bg-emerald-500">Most Comprehensive</Badge>
              </CardTitle>
              <CardDescription className="mt-2">
                Upload your full pitch recording (up to 30 minutes) for a deep-dive analysis
                combining video delivery assessment with pitch deck content review.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Features Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {features.map((feature) => (
              <div key={feature.title} className="text-center p-4 rounded-lg bg-muted/50">
                <feature.icon className="w-8 h-8 mx-auto text-emerald-500 mb-2" />
                <p className="font-medium text-sm">{feature.title}</p>
                <p className="text-xs text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>

          {/* Readiness Levels */}
          <div className="mb-6">
            <p className="text-sm font-medium mb-3">Investor Readiness Levels</p>
            <div className="flex flex-wrap gap-2">
              {readinessLevels.map((rl) => (
                <div key={rl.level} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50">
                  <div className={`w-2 h-2 rounded-full ${rl.color}`} />
                  <span className="text-xs font-medium">{rl.level.replace("_", " ")}</span>
                  <span className="text-xs text-muted-foreground">({rl.range})</span>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <Link href="/coach/full/new">
            <Button className="w-full bg-emerald-500 hover:bg-emerald-500/90 h-12 text-lg">
              Start Full Pitch Analysis
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* How It Works */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">How It Works</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <span className="text-emerald-500 font-bold">1</span>
              </div>
              <h3 className="font-medium">Upload Your Pitch</h3>
              <p className="text-sm text-muted-foreground">
                Record and upload your full pitch video (up to 30 minutes). 
                Optionally include your pitch deck for combined analysis.
              </p>
            </div>
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <span className="text-emerald-500 font-bold">2</span>
              </div>
              <h3 className="font-medium">AI Analysis</h3>
              <p className="text-sm text-muted-foreground">
                Our GLM-4V-Plus AI analyzes your video for delivery, body language, 
                and content while evaluating your deck's investor readiness.
              </p>
            </div>
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <span className="text-emerald-500 font-bold">3</span>
              </div>
              <h3 className="font-medium">Get Actionable Insights</h3>
              <p className="text-sm text-muted-foreground">
                Receive a comprehensive report with scores, feedback, anticipated 
                questions, and specific recommendations to improve.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* What's Included */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Video className="w-5 h-5 text-emerald-500" />
              Video Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              "Pace and clarity assessment",
              "Confidence and energy evaluation",
              "Eye contact and body language scoring",
              "Filler word detection and counting",
              "Key moment identification",
              "Full transcript generation",
            ].map((item) => (
              <div key={item} className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                <span>{item}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Deck + Content Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              "Problem-solution fit evaluation",
              "Market opportunity assessment",
              "Business model viability scoring",
              "Team credibility review",
              "Traction evidence analysis",
              "Competitive context insights",
            ].map((item) => (
              <div key={item} className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-primary" />
                <span>{item}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <Card className="bg-muted/30">
        <CardContent className="py-4">
          <p className="text-sm text-muted-foreground mb-3">Looking for something else?</p>
          <div className="flex flex-wrap gap-2">
            <Link href="/pitch-deck-analyser/new">
              <Button variant="outline" size="sm">
                <FileText className="w-4 h-4 mr-1" />
                Deck Analyzer (E1)
              </Button>
            </Link>
            <Link href="/elevator-script/new">
              <Button variant="outline" size="sm">
                Script Coach (E2)
              </Button>
            </Link>
            <Link href="/elevator-pitch-live/new">
              <Button variant="outline" size="sm">
                <Video className="w-4 h-4 mr-1" />
                Live Pitch (E3)
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
