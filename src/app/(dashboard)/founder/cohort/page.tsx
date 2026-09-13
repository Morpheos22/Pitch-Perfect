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
  Users,
  Loader2,
  ArrowLeft,
  ArrowRight,
  GraduationCap,
  Award,
  UserCheck,
} from "lucide-react";
import Link from "next/link";

interface CohortResult {
  recommendedCohort: {
    name: string;
    fitScore: number;
    startDate: string;
    duration: string;
    reasons: string[];
  };
  alternativeCohorts: Array<{
    name: string;
    fitScore: number;
    reason: string;
  }>;
  mentorAlignment: string[];
  certificationTrack: string;
  preparationNeeded: string[];
  summary: string;
}

const cohortColors: Record<string, string> = {
  Discovery: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  Build: "bg-primary/10 text-primary border-primary/20",
  Growth: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  Scale: "bg-violet-500/10 text-violet-500 border-violet-500/20",
};

export default function CohortPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CohortResult | null>(null);
  const [form, setForm] = useState({
    startupName: "",
    sector: "",
    stage: "Idea",
    teamSize: "1",
    country: "",
    hasMVP: "false",
    monthlyRevenue: "",
    activeUsers: "",
    priorAccelerator: "",
    skillsNeeded: "Business strategy, fundraising",
    learningGoals: "",
    cohortFormat: "Flexible",
    timeCommitment: "Part-time",
  });

  useEffect(() => {
    async function checkHistory() {
      try {
        const res = await fetch("/api/coach/founder?moduleType=COHORT_MATCHING");
        if (res.ok) {
          const data = await res.json();
          const session = data.allSessions?.find((s: any) => s.status === "COMPLETED");
          if (session) {
            const detail = await fetch(`/api/coach/founder?id=${session.id}`);
            if (detail.ok) {
              const d = await detail.json();
              setResult(d.resultData);
            }
          }
        }
        // Pre-fill from readiness
        const readinessRes = await fetch("/api/coach/founder?moduleType=FOUNDER_READINESS");
        if (readinessRes.ok) {
          const rd = await readinessRes.json();
          const rSession = rd.allSessions?.find((s: any) => s.status === "COMPLETED");
          if (rSession) {
            const detail = await fetch(`/api/coach/founder?id=${rSession.id}`);
            if (detail.ok) {
              const d = await detail.json();
              setForm((prev) => ({
                ...prev,
                startupName: d.inputData?.startupName || prev.startupName,
                sector: d.inputData?.sector || prev.sector,
                stage: d.inputData?.stage || prev.stage,
                country: d.inputData?.country || prev.country,
              }));
            }
          }
        }
      } catch (err) {
        console.error("Failed to check cohort history:", err);
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
          moduleType: "COHORT_MATCHING",
          input: {
            ...form,
            hasMVP: form.hasMVP === "true",
            teamSize: parseInt(form.teamSize) || 1,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Matching failed");

      setResult(data.data);
      toast.success("Cohort matching complete!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to match cohorts");
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    const cohort = result.recommendedCohort;
    return (
      <FounderLayout
        title="Cohort Matching"
        subtitle={`Best match: ${cohort.name} Cohort`}
      >
        {/* Recommended Cohort */}
        <Card className={`border-2 ${cohortColors[cohort.name] || "border-primary/20"}`}>
          <CardContent className="py-6">
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-xl ${cohortColors[cohort.name]?.split(" ")[0] || "bg-primary/10"}`}>
                <GraduationCap className="w-8 h-8" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-xl font-bold">{cohort.name} Cohort</h2>
                  <Badge variant="outline" className="text-sm">{cohort.fitScore}% match</Badge>
                </div>
                <div className="flex flex-wrap gap-3 text-sm text-muted-foreground mb-3">
                  <span>📅 {cohort.startDate}</span>
                  <span>⏱ {cohort.duration}</span>
                  <span>🎯 {result.certificationTrack}</span>
                </div>
                <p className="text-sm text-muted-foreground">{result.summary}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Match Reasons */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-primary" />
                Why This Match
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {cohort.reasons.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-primary mt-0.5">✓</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Mentor Alignment */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-500" />
                Mentor Alignment
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {result.mentorAlignment.map((area, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {area}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Alternative Cohorts */}
        {result.alternativeCohorts.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Alternative Cohorts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {result.alternativeCohorts.map((alt, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${cohortColors[alt.name]?.split(" ")[0] || "bg-muted"}`}>
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{alt.name} Cohort</p>
                      <p className="text-xs text-muted-foreground">{alt.reason}</p>
                    </div>
                  </div>
                  <Badge variant="outline">{alt.fitScore}% fit</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Preparation Needed */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Preparation Needed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {result.preparationNeeded.map((item, i) => (
                <div key={i} className="flex items-start gap-3 p-2 rounded-lg bg-muted/50">
                  <div className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs flex-shrink-0">
                    {i + 1}
                  </div>
                  <span className="text-sm">{item}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-between">
          <Link href="/founder/research">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="w-4 h-4" /> Research
            </Button>
          </Link>
          <Link href="/founder/network">
            <Button className="gap-2 bg-primary hover:bg-primary/90">
              Network Profile <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </FounderLayout>
    );
  }

  return (
    <FounderLayout
      title="Cohort Matching"
      subtitle="Find the best Small Axe accelerator cohort for your startup"
    >
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Users className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <h3 className="font-medium text-sm">Small Axe Cohort Programs</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Match with the right cohort — Discovery (idea stage), Build (MVP),
                Growth (revenue), or Scale (expansion). Each includes mentor alignment
                and certification tracking.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Your Startup Profile</CardTitle>
          <CardDescription>Help us find the best cohort match</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Startup Name *</Label>
              <Input
                placeholder="e.g., MobiPay"
                value={form.startupName}
                onChange={(e) => setForm({ ...form, startupName: e.target.value })}
              />
            </div>
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
            <div className="space-y-2">
              <Label>Team Size</Label>
              <Input
                placeholder="e.g., 4"
                value={form.teamSize}
                onChange={(e) => setForm({ ...form, teamSize: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Have MVP?</Label>
              <Select value={form.hasMVP} onValueChange={(v) => setForm({ ...form, hasMVP: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Yes</SelectItem>
                  <SelectItem value="false">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Country</Label>
              <Input
                placeholder="e.g., Nigeria"
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Monthly Revenue</Label>
              <Input
                placeholder="e.g., R50K or Pre-revenue"
                value={form.monthlyRevenue}
                onChange={(e) => setForm({ ...form, monthlyRevenue: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Active Users</Label>
              <Input
                placeholder="e.g., 1,200"
                value={form.activeUsers}
                onChange={(e) => setForm({ ...form, activeUsers: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Prior Accelerator</Label>
              <Input
                placeholder="e.g., None, YC, Techstars"
                value={form.priorAccelerator}
                onChange={(e) => setForm({ ...form, priorAccelerator: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Time Commitment</Label>
              <Select value={form.timeCommitment} onValueChange={(v) => setForm({ ...form, timeCommitment: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Full-time">Full-time</SelectItem>
                  <SelectItem value="Part-time">Part-time</SelectItem>
                  <SelectItem value="Flexible">Flexible</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2 mt-4">
            <Label>Skills Needed</Label>
            <Input
              placeholder="e.g., Business strategy, fundraising, marketing"
              value={form.skillsNeeded}
              onChange={(e) => setForm({ ...form, skillsNeeded: e.target.value })}
            />
          </div>
          <div className="space-y-2 mt-4">
            <Label>Learning Goals</Label>
            <Textarea
              placeholder="What do you hope to learn from the cohort?"
              value={form.learningGoals}
              onChange={(e) => setForm({ ...form, learningGoals: e.target.value })}
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={handleSubmit}
          disabled={!form.startupName.trim() || loading}
          className="gap-2 bg-primary hover:bg-primary/90 min-w-[200px]"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Matching Cohorts...
            </>
          ) : (
            <>
              <Users className="w-4 h-4" />
              Find My Cohort
            </>
          )}
        </Button>
      </div>
    </FounderLayout>
  );
}
