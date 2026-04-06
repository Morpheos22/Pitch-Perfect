"use client";

import { useState, useEffect } from "react";
import { FounderLayout } from "@/components/founder";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Target, Loader2, CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";
import Link from "next/link";

interface ReadinessResult {
  scores: {
    deckQuality: number;
    pitchConfidence: number;
    marketTiming: number;
    teamReadiness: number;
    tractionEvidence: number;
    financialUnderstanding: number;
  };
  overallScore: number;
  recommendedPathway: string;
  pathwayConfidence: number;
  strengths: string[];
  improvements: string[];
  summary: string;
  nextSteps: string[];
}

const scoreLabels: Record<string, string> = {
  deckQuality: "Deck Quality",
  pitchConfidence: "Pitch Confidence",
  marketTiming: "Market Timing",
  teamReadiness: "Team Readiness",
  tractionEvidence: "Traction Evidence",
  financialUnderstanding: "Financial Understanding",
};

function getScoreColor(score: number) {
  if (score >= 80) return "text-emerald-500";
  if (score >= 60) return "text-primary";
  if (score >= 40) return "text-amber-500";
  return "text-destructive";
}

function getScoreBg(score: number) {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 60) return "bg-primary";
  if (score >= 40) return "bg-amber-500";
  return "bg-destructive";
}

export default function ReadinessPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReadinessResult | null>(null);
  const [form, setForm] = useState({
    startupName: "",
    sector: "",
    stage: "Pre-seed",
    foundedDate: "",
    teamSize: "",
    country: "",
    hasDeck: "true",
    deckScore: "",
    hasPracticed: "false",
    pitchConfidence: "5",
    monthlyRevenue: "",
    activeUsers: "",
    partnerships: "",
    priorFundraising: "",
    targetRaise: "",
    biggestStrength: "",
    biggestChallenge: "",
  });

  useEffect(() => {
    async function checkHistory() {
      try {
        const res = await fetch("/api/coach/founder?moduleType=FOUNDER_READINESS");
        if (res.ok) {
          const data = await res.json();
          const session = data.allSessions?.find(
            (s: any) => s.status === "COMPLETED"
          );
          if (session) {
            const detail = await fetch(`/api/coach/founder?id=${session.id}`);
            if (detail.ok) {
              const detailData = await detail.json();
              setResult(detailData.resultData);
            }
          }
        }
      } catch (err) {
        console.error("Failed to check readiness history:", err);
      }
    }
    checkHistory();
  }, []);

  const handleSubmit = async () => {
    if (!form.startupName.trim()) {
      toast.error("Please enter your startup name");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/coach/founder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moduleType: "FOUNDER_READINESS",
          input: {
            ...form,
            hasDeck: form.hasDeck === "true",
            hasPracticed: form.hasPracticed === "true",
            pitchConfidence: parseInt(form.pitchConfidence) || 5,
            deckScore: form.deckScore ? parseInt(form.deckScore) : null,
            teamSize: form.teamSize ? parseInt(form.teamSize) : null,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");

      setResult(data.data);
      toast.success("Readiness assessment complete!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to assess readiness");
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <FounderLayout
        title="Founder Readiness"
        subtitle="Your investor readiness assessment results"
      >
        {/* Overall Score */}
        <Card className="border-primary/20">
          <CardContent className="py-6">
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="relative flex items-center justify-center w-28 h-28">
                <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
                  <circle
                    cx="50" cy="50" r="42" fill="none"
                    stroke={result.overallScore >= 66 ? "hsl(var(--primary))" : "hsl(var(--amber-500))"}
                    strokeWidth="8"
                    strokeDasharray={`${(result.overallScore / 100) * 264} 264`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold">{result.overallScore}</span>
                  <span className="text-xs text-muted-foreground">/100</span>
                </div>
              </div>
              <div className="flex-1 text-center md:text-left">
                <h2 className="text-xl font-semibold mb-1">Overall Readiness</h2>
                <p className="text-sm text-muted-foreground mb-3">{result.summary}</p>
                <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                  <Badge variant={result.recommendedPathway === "AFRIFLOW_DIRECT" ? "default" : "secondary"}>
                    {result.recommendedPathway === "GRIT_TO_GEAR" ? "Path A: Grit to Gear" : "Path B: AfriFlow Direct"}
                  </Badge>
                  <Badge variant="outline">{result.pathwayConfidence}% confidence</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Dimension Scores */}
        <div className="grid md:grid-cols-2 gap-4">
          {Object.entries(result.scores).map(([key, value]) => (
            <Card key={key}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{scoreLabels[key] || key}</span>
                  <span className={`text-sm font-bold ${getScoreColor(value)}`}>{value}</span>
                </div>
                <Progress value={value} className="h-2" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Strengths & Improvements */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="border-emerald-500/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Strengths
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {result.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-emerald-500 mt-0.5">•</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card className="border-amber-500/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                Areas to Improve
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {result.improvements.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-amber-500 mt-0.5">•</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Next Steps */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recommended Next Steps</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {result.nextSteps.map((step, i) => (
                <div key={i} className="flex items-start gap-3 p-2 rounded-lg bg-muted/50">
                  <div className={`w-6 h-6 rounded-full ${getScoreBg(80)} text-white flex items-center justify-center text-xs flex-shrink-0`}>
                    {i + 1}
                  </div>
                  <span className="text-sm">{step}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between">
          <Button variant="outline" onClick={() => setResult(null)}>
            Re-assess
          </Button>
          <Link href="/founder/pathway">
            <Button className="gap-2 bg-primary hover:bg-primary/90">
              View Pathway Recommendation <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </FounderLayout>
    );
  }

  return (
    <FounderLayout
      title="Founder Readiness Assessment"
      subtitle="Evaluate your investor readiness across 6 dimensions"
    >
      {/* Info Card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Target className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <h3 className="font-medium text-sm">What we assess</h3>
              <p className="text-xs text-muted-foreground mt-1">
                We evaluate your deck quality, pitch confidence, market timing, team readiness,
                traction evidence, and financial understanding to recommend the best pathway
                into the Automagikal Network.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Form */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Startup Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Startup Information</CardTitle>
            <CardDescription>Tell us about your venture</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="startupName">Startup Name *</Label>
              <Input
                id="startupName"
                placeholder="e.g., MobiPay"
                value={form.startupName}
                onChange={(e) => setForm({ ...form, startupName: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Sector</Label>
                <Input
                  placeholder="e.g., Fintech"
                  value={form.sector}
                  onChange={(e) => setForm({ ...form, sector: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Stage</Label>
                <Select value={form.stage} onValueChange={(v) => setForm({ ...form, stage: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Idea">Idea</SelectItem>
                    <SelectItem value="Pre-seed">Pre-seed</SelectItem>
                    <SelectItem value="Seed">Seed</SelectItem>
                    <SelectItem value="Series A">Series A</SelectItem>
                    <SelectItem value="Growth">Growth</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Team Size</Label>
                <Input
                  placeholder="e.g., 4"
                  value={form.teamSize}
                  onChange={(e) => setForm({ ...form, teamSize: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Country</Label>
                <Input
                  placeholder="e.g., South Africa"
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Founded Date</Label>
              <Input
                type="month"
                value={form.foundedDate}
                onChange={(e) => setForm({ ...form, foundedDate: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Pitch Readiness */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Pitch Readiness</CardTitle>
            <CardDescription>Your current pitch preparation level</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Have a Pitch Deck?</Label>
              <Select value={form.hasDeck} onValueChange={(v) => setForm({ ...form, hasDeck: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Yes, I have one</SelectItem>
                  <SelectItem value="false">Not yet</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.hasDeck === "true" && (
              <div className="space-y-2">
                <Label>Deck Score (if analyzed)</Label>
                <Input
                  placeholder="e.g., 75"
                  value={form.deckScore}
                  onChange={(e) => setForm({ ...form, deckScore: e.target.value })}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>Have you practiced pitching?</Label>
              <Select value={form.hasPracticed} onValueChange={(v) => setForm({ ...form, hasPracticed: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Yes, multiple times</SelectItem>
                  <SelectItem value="false">Not yet</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Pitch Confidence (1-10)</Label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={form.pitchConfidence}
                  onChange={(e) => setForm({ ...form, pitchConfidence: e.target.value })}
                  className="flex-1"
                />
                <Badge variant="secondary">{form.pitchConfidence}/10</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Traction & Funding */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Traction & Funding</CardTitle>
            <CardDescription>Your business progress</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Monthly Revenue</Label>
              <Input
                placeholder="e.g., R50,000 or Pre-revenue"
                value={form.monthlyRevenue}
                onChange={(e) => setForm({ ...form, monthlyRevenue: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Active Users / Customers</Label>
              <Input
                placeholder="e.g., 1,200"
                value={form.activeUsers}
                onChange={(e) => setForm({ ...form, activeUsers: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Key Partnerships</Label>
              <Input
                placeholder="e.g., Standard Bank, MTN"
                value={form.partnerships}
                onChange={(e) => setForm({ ...form, partnerships: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <PriorFundraising
                  value={form.priorFundraising}
                  onChange={(v) => setForm({ ...form, priorFundraising: v })}
                />
              </div>
              <div className="space-y-2">
                <Label>Target Raise</Label>
                <Input
                  placeholder="e.g., $500K"
                  value={form.targetRaise}
                  onChange={(e) => setForm({ ...form, targetRaise: e.target.value })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Self Assessment */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Self Assessment</CardTitle>
            <CardDescription>Reflect on your biggest strengths and challenges</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Biggest Strength</Label>
              <Textarea
                placeholder="What makes your startup stand out?"
                value={form.biggestStrength}
                onChange={(e) => setForm({ ...form, biggestStrength: e.target.value })}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Biggest Challenge</Label>
              <Textarea
                placeholder="What is your biggest obstacle right now?"
                value={form.biggestChallenge}
                onChange={(e) => setForm({ ...form, biggestChallenge: e.target.value })}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Submit */}
      <div className="flex justify-end">
        <Button
          onClick={handleSubmit}
          disabled={!form.startupName.trim() || loading}
          className="gap-2 bg-primary hover:bg-primary/90 min-w-[200px]"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Assessing Readiness...
            </>
          ) : (
            <>
              <Target className="w-4 h-4" />
              Assess Readiness
            </>
          )}
        </Button>
      </div>
    </FounderLayout>
  );
}

function PriorFundraising({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <Label>Prior Fundraising</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="None">None</SelectItem>
          <SelectItem value="Friends & Family">Friends & Family</SelectItem>
          <SelectItem value="Grant">Grant</SelectItem>
          <SelectItem value="Pre-seed Round">Pre-seed Round</SelectItem>
          <SelectItem value="Seed Round">Seed Round</SelectItem>
          <SelectItem value="Series A+">Series A+</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
