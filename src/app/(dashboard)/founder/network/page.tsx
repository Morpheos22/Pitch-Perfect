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
import { toast } from "sonner";
import {
  UserCircle,
  Loader2,
  ArrowLeft,
  ArrowRight,
  Star,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

interface NetworkProfileResult {
  tagline: string;
  elevatorBio: string;
  extendedBio: string;
  highlights: string[];
  investorHooks: string[];
  riskFactors: string[];
  networkTags: string[];
  afriFlowReadiness: {
    score: number;
    ready: boolean;
    gaps: string[];
  };
  recommendedImprovements: string[];
}

export default function NetworkPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<NetworkProfileResult | null>(null);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    startupName: "",
    sector: "",
    role: "Founder & CEO",
    country: "",
    bio: "",
    keyAchievement: "",
    uniqueValueProp: "",
    priorExperience: "",
    education: "",
    skills: "",
    metrics: "",
    tractionHighlights: "",
    linkedin: "",
    twitter: "",
  });

  useEffect(() => {
    async function checkHistory() {
      try {
        const res = await fetch("/api/coach/founder?moduleType=NETWORK_PROFILE");
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
      } catch (err) {
        console.error("Failed to check network history:", err);
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
          moduleType: "NETWORK_PROFILE",
          input: form,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Profile generation failed");

      setResult(data.data);
      toast.success("Network profile generated!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate profile");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  if (result) {
    return (
      <FounderLayout
        title="Network Profile"
        subtitle="Your investor-facing profile for the PitchCoach Ai Network"
      >
        {/* AfriFlow Readiness */}
        <Card className={`border-2 ${result.afriFlowReadiness.ready ? "border-emerald-500/40 bg-emerald-500/5" : "border-amber-500/40 bg-amber-500/5"}`}>
          <CardContent className="py-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2">
                {result.afriFlowReadiness.ready ? (
                  <Star className="w-5 h-5 text-emerald-500" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                )}
                AfriFlow Readiness
              </h3>
              <Badge variant={result.afriFlowReadiness.ready ? "default" : "outline"}>
                {result.afriFlowReadiness.score}%
                {result.afriFlowReadiness.ready ? " — Ready!" : " — Almost there"}
              </Badge>
            </div>
            <Progress value={result.afriFlowReadiness.score} className="h-2 mb-3" />
            {result.afriFlowReadiness.gaps.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Gaps to address:</p>
                <div className="flex flex-wrap gap-1.5">
                  {result.afriFlowReadiness.gaps.map((gap, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">{gap}</Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tagline & Bio */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Your Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs text-muted-foreground">TAGLINE</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => handleCopy(result.tagline, "Tagline")}
                >
                  Copy
                </Button>
              </div>
              <p className="font-semibold text-lg">{result.tagline}</p>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs text-muted-foreground">ELEVATOR BIO (100 words)</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => handleCopy(result.elevatorBio, "Elevator bio")}
                >
                  Copy
                </Button>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{result.elevatorBio}</p>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs text-muted-foreground">EXTENDED BIO (250 words)</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => handleCopy(result.extendedBio, "Extended bio")}
                >
                  Copy
                </Button>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{result.extendedBio}</p>
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Highlights */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-500" />
                Highlights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {result.highlights.map((h, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-amber-500 mt-0.5">★</span>
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Investor Hooks */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                Investor Hooks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {result.investorHooks.map((hook, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-primary mt-0.5">💡</span>
                    <span>{hook}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Network Tags */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Network Tags</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {result.networkTags.map((tag, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">{tag}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Risk Factors */}
          <Card className="border-amber-500/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Risk Factors
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {result.riskFactors.map((risk, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="text-amber-500 mt-0.5">⚠</span>
                    <span>{risk}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Recommended Improvements */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recommended Improvements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {result.recommendedImprovements.map((imp, i) => (
                <div key={i} className="flex items-start gap-3 p-2 rounded-lg bg-muted/50">
                  <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs flex-shrink-0">
                    {i + 1}
                  </div>
                  <span className="text-sm">{imp}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-between">
          <Link href="/founder/cohort">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="w-4 h-4" /> Cohort
            </Button>
          </Link>
          <Link href="/founder/narration">
            <Button className="gap-2 bg-primary hover:bg-primary/90">
              Pathway Narration <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </FounderLayout>
    );
  }

  return (
    <FounderLayout
      title="Network Profile Builder"
      subtitle="Create your investor-facing profile for the PitchCoach Ai Network"
    >
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <UserCircle className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <h3 className="font-medium text-sm">What this builds</h3>
              <p className="text-xs text-muted-foreground mt-1">
                An AI-crafted investor profile including tagline, elevator bio, extended bio,
                investor hooks, network tags, and AfriFlow readiness score. Copy-ready for
                LinkedIn, pitch decks, and investor introductions.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Personal Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name</Label>
                <Input
                  placeholder="John"
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Last Name</Label>
                <Input
                  placeholder="Doe"
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Input
                placeholder="Founder & CEO"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>LinkedIn URL</Label>
                <Input
                  placeholder="linkedin.com/in/..."
                  value={form.linkedin}
                  onChange={(e) => setForm({ ...form, linkedin: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Twitter/X Handle</Label>
                <Input
                  placeholder="@handle"
                  value={form.twitter}
                  onChange={(e) => setForm({ ...form, twitter: e.target.value })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Background</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Prior Experience</Label>
              <Textarea
                placeholder="Previous roles, companies, achievements"
                value={form.priorExperience}
                onChange={(e) => setForm({ ...form, priorExperience: e.target.value })}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Education</Label>
              <Input
                placeholder="e.g., MBA, UCT"
                value={form.education}
                onChange={(e) => setForm({ ...form, education: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Key Skills</Label>
              <Input
                placeholder="e.g., Product, Sales, Engineering"
                value={form.skills}
                onChange={(e) => setForm({ ...form, skills: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Startup Info</CardTitle>
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
            <div className="space-y-2">
              <Label>Sector</Label>
              <Input
                placeholder="e.g., Fintech"
                value={form.sector}
                onChange={(e) => setForm({ ...form, sector: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Current Metrics</Label>
              <Input
                placeholder="e.g., 1K users, R50K MRR"
                value={form.metrics}
                onChange={(e) => setForm({ ...form, metrics: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Traction Highlights</Label>
              <Textarea
                placeholder="Key milestones, partnerships, growth"
                value={form.tractionHighlights}
                onChange={(e) => setForm({ ...form, tractionHighlights: e.target.value })}
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">What Makes You Unique</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Brief Bio</Label>
              <Textarea
                placeholder="A short description of who you are and what drives you"
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Key Achievement</Label>
              <Textarea
                placeholder="Your proudest moment or biggest win"
                value={form.keyAchievement}
                onChange={(e) => setForm({ ...form, keyAchievement: e.target.value })}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Unique Value Proposition</Label>
              <Textarea
                placeholder="What makes your startup different and investable?"
                value={form.uniqueValueProp}
                onChange={(e) => setForm({ ...form, uniqueValueProp: e.target.value })}
                rows={2}
              />
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
              Generating Profile...
            </>
          ) : (
            <>
              <UserCircle className="w-4 h-4" />
              Generate Network Profile
            </>
          )}
        </Button>
      </div>
    </FounderLayout>
  );
}
