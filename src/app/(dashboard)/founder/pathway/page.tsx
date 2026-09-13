"use client";

import { useState, useEffect } from "react";
import { FounderLayout } from "@/components/founder";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Route,
  Loader2,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Rocket,
} from "lucide-react";
import Link from "next/link";

interface PathwayResult {
  recommendedPathway: string;
  confidence: number;
  pathAAnalysis: {
    fitScore: number;
    pros: string[];
    cons: string[];
    estimatedTimeline: string;
  };
  pathBAnalysis: {
    fitScore: number;
    pros: string[];
    cons: string[];
    estimatedTimeline: string;
  };
  keyFactors: string[];
  recommendation: string;
  immediateActions: string[];
}

export default function PathwayPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PathwayResult | null>(null);
  const [readinessData, setReadinessData] = useState<any>(null);
  const [form, setForm] = useState({
    startupName: "",
    sector: "",
    stage: "Pre-seed",
    country: "",
    overallScore: "",
    deckScore: "",
    pitchConfidence: "",
    tractionScore: "",
    goals: "Raise funding and grow my network",
    timeline: "Flexible",
    budget: "Limited",
    previousExperience: "First-time founder",
  });

  useEffect(() => {
    async function loadReadinessData() {
      try {
        let data: any = null;
        const res = await fetch("/api/coach/founder?moduleType=FOUNDER_READINESS");
        if (res.ok) {
          data = await res.json();
          const session = data.allSessions?.find((s: any) => s.status === "COMPLETED");
          if (session) {
            const detail = await fetch(`/api/coach/founder?id=${session.id}`);
            if (detail.ok) {
              const d = await detail.json();
              setReadinessData(d);
              setForm((prev) => ({
                ...prev,
                overallScore: String(d.resultData?.overallScore || ""),
                startupName: d.inputData?.startupName || prev.startupName,
                sector: d.inputData?.sector || prev.sector,
                stage: d.inputData?.stage || prev.stage,
                country: d.inputData?.country || prev.country,
              }));
            }
          }
        }
        // Also check for existing pathway result
        if (data) {
          const pathwaySession = data.allSessions?.find(
            (s: any) => s.moduleType === "PATHWAY_RECOMMENDATION" && s.status === "COMPLETED"
          );
          if (pathwaySession) {
            const detail = await fetch(`/api/coach/founder?id=${pathwaySession.id}`);
            if (detail.ok) {
              const d = await detail.json();
              setResult(d.resultData);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load readiness data:", err);
      }
    }
    loadReadinessData();
  }, []);

  const handleSubmit = async () => {
    if (!form.startupName.trim()) {
      toast.error("Please enter your startup name");
      return;
    }
    if (!readinessData) {
      toast.error("Please complete the Founder Readiness assessment first");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/coach/founder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moduleType: "PATHWAY_RECOMMENDATION",
          input: {
            ...form,
            overallScore: form.overallScore ? parseInt(form.overallScore) : null,
            deckScore: form.deckScore ? parseInt(form.deckScore) : null,
            pitchConfidence: form.pitchConfidence ? parseInt(form.pitchConfidence) : null,
            tractionScore: form.tractionScore ? parseInt(form.tractionScore) : null,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");

      setResult(data.data);
      toast.success("Pathway recommendation generated!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate recommendation");
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    const isPathA = result.recommendedPathway === "GRIT_TO_GEAR";
    return (
      <FounderLayout
        title="Pathway Recommendation"
        subtitle={`AI-recommended pathway: ${isPathA ? "Path A: Grit to Gear" : "Path B: AfriFlow Direct"}`}
      >
        {/* Recommendation Banner */}
        <Card className={`border-2 ${isPathA ? "border-primary/40 bg-primary/5" : "border-emerald-500/40 bg-emerald-500/5"}`}>
          <CardContent className="py-6">
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-xl ${isPathA ? "bg-primary/10" : "bg-emerald-500/10"}`}>
                {isPathA ? (
                  <ShieldCheck className="w-8 h-8 text-primary" />
                ) : (
                  <Rocket className="w-8 h-8 text-emerald-500" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-xl font-bold">
                    {isPathA ? "Path A: Grit to Gear" : "Path B: AfriFlow Direct"}
                  </h2>
                  <Badge variant="outline">{result.confidence}% confidence</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{result.recommendation}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Path Comparison */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Path A */}
          <Card className={isPathA ? "border-primary/30 ring-2 ring-primary/20" : ""}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  Path A: Grit to Gear
                </CardTitle>
                <Badge variant={isPathA ? "default" : "secondary"}>
                  {result.pathAAnalysis.fitScore}% fit
                </Badge>
              </div>
              <CardDescription>{result.pathAAnalysis.estimatedTimeline}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs font-medium text-emerald-500 mb-1">Pros</p>
                {result.pathAAnalysis.pros.map((p, i) => (
                  <p key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <span className="text-emerald-500 mt-0.5">+</span> {p}
                  </p>
                ))}
              </div>
              <div>
                <p className="text-xs font-medium text-destructive mb-1">Considerations</p>
                {result.pathAAnalysis.cons.map((c, i) => (
                  <p key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <span className="text-destructive mt-0.5">-</span> {c}
                  </p>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Path B */}
          <Card className={!isPathA ? "border-emerald-500/30 ring-2 ring-emerald-500/20" : ""}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Rocket className="w-4 h-4 text-emerald-500" />
                  Path B: AfriFlow Direct
                </CardTitle>
                <Badge variant={!isPathA ? "default" : "secondary"}>
                  {result.pathBAnalysis.fitScore}% fit
                </Badge>
              </div>
              <CardDescription>{result.pathBAnalysis.estimatedTimeline}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs font-medium text-emerald-500 mb-1">Pros</p>
                {result.pathBAnalysis.pros.map((p, i) => (
                  <p key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <span className="text-emerald-500 mt-0.5">+</span> {p}
                  </p>
                ))}
              </div>
              <div>
                <p className="text-xs font-medium text-destructive mb-1">Considerations</p>
                {result.pathBAnalysis.cons.map((c, i) => (
                  <p key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <span className="text-destructive mt-0.5">-</span> {c}
                  </p>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Key Factors */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Key Decision Factors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {result.keyFactors.map((factor, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {factor}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Immediate Actions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Immediate Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {result.immediateActions.map((action, i) => (
                <div key={i} className="flex items-start gap-3 p-2 rounded-lg bg-muted/50">
                  <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs flex-shrink-0">
                    {i + 1}
                  </div>
                  <span className="text-sm">{action}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between">
          <Link href="/founder/readiness">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="w-4 h-4" /> Readiness Assessment
            </Button>
          </Link>
          <Link href="/founder/research">
            <Button className="gap-2 bg-primary hover:bg-primary/90">
              Investor Research <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </FounderLayout>
    );
  }

  return (
    <FounderLayout
      title="Pathway Recommendation"
      subtitle="AI-recommended pathway based on your founder profile"
    >
      {!readinessData && (
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-amber-500 mt-0.5" />
              <div>
                <h3 className="font-medium text-sm">Complete Readiness First</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  For the most accurate pathway recommendation, complete the Founder Readiness
                  assessment first. You can still proceed, but results will be less personalized.
                </p>
                <Link href="/founder/readiness">
                  <Button variant="outline" size="sm" className="mt-2">
                    Go to Readiness Assessment
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Startup Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Startup Name *</Label>
              <Input
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
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Idea">Idea</SelectItem>
                    <SelectItem value="Pre-seed">Pre-seed</SelectItem>
                    <SelectItem value="Seed">Seed</SelectItem>
                    <SelectItem value="Series A">Series A</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Country</Label>
              <Input
                placeholder="e.g., Nigeria"
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Goals & Preferences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Goals</Label>
              <Textarea
                placeholder="e.g., Raise $500K, build partnerships"
                value={form.goals}
                onChange={(e) => setForm({ ...form, goals: e.target.value })}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Timeline</Label>
                <Select value={form.timeline} onValueChange={(v) => setForm({ ...form, timeline: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ASAP">ASAP</SelectItem>
                    <SelectItem value="1-3 months">1-3 months</SelectItem>
                    <SelectItem value="3-6 months">3-6 months</SelectItem>
                    <SelectItem value="Flexible">Flexible</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Budget</Label>
                <Select value={form.budget} onValueChange={(v) => setForm({ ...form, budget: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Limited">Limited</SelectItem>
                    <SelectItem value="Moderate">Moderate</SelectItem>
                    <SelectItem value="Flexible">Flexible</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Previous Experience</Label>
              <Select value={form.previousExperience} onValueChange={(v) => setForm({ ...form, previousExperience: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="First-time founder">First-time founder</SelectItem>
                  <SelectItem value="1-2 startups">1-2 startups</SelectItem>
                  <SelectItem value="3+ startups">3+ startups</SelectItem>
                  <SelectItem value="Corporate background">Corporate background</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button
          onClick={handleSubmit}
          disabled={!form.startupName.trim() || loading}
          className="gap-2 bg-primary hover:bg-primary/90 min-w-[220px]"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating Recommendation...
            </>
          ) : (
            <>
              <Route className="w-4 h-4" />
              Get Pathway Recommendation
            </>
          )}
        </Button>
      </div>
    </FounderLayout>
  );
}
