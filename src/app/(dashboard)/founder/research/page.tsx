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
  Search,
  Loader2,
  ExternalLink,
  ArrowLeft,
  ArrowRight,
  Globe,
  Building2,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";

interface InvestorResult {
  investors: Array<{
    name: string;
    type: string;
    focusAreas: string[];
    stageFit: string;
    geography: string;
    dealSize: string;
    notablePortfolio: string[];
    outreachTip: string;
  }>;
  marketInsights: string[];
  outreachStrategy: {
    recommendedOrder: string[];
    warmIntroductionTips: string[];
    commonMistakes: string[];
  };
  overallAssessment: string;
}

export default function ResearchPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<InvestorResult | null>(null);
  const [form, setForm] = useState({
    startupName: "",
    sector: "",
    stage: "Pre-seed",
    country: "",
    targetRaise: "",
    traction: "",
  });

  useEffect(() => {
    async function checkHistory() {
      try {
        const res = await fetch("/api/coach/founder?moduleType=INVESTOR_RESEARCH");
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
        // Pre-fill from readiness data
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
        console.error("Failed to check research history:", err);
      }
    }
    checkHistory();
  }, []);

  const handleSubmit = async () => {
    if (!form.startupName.trim() || !form.sector.trim()) {
      toast.error("Please enter your startup name and sector");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/coach/founder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moduleType: "INVESTOR_RESEARCH",
          input: form,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Research failed");

      setResult(data.data);
      toast.success("Investor research complete!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to research investors");
    } finally {
      setLoading(false);
    }
  };

  function getStageFitColor(fit: string) {
    switch (fit) {
      case "Strong": return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
      case "Good": return "bg-primary/10 text-primary border-primary/20";
      case "Moderate": return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      default: return "bg-muted text-muted-foreground border-border";
    }
  }

  if (result) {
    return (
      <FounderLayout
        title="Investor Research"
        subtitle="AI-powered investor landscape research with web search"
      >
        {/* Market Insights */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="w-4 h-4 text-primary" />
              Market Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">{result.overallAssessment}</p>
            <div className="flex flex-wrap gap-2">
              {result.marketInsights.map((insight, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {insight}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Investors List */}
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Matching Investors ({result.investors.length})
          </h2>
          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {result.investors.map((investor, i) => (
              <Card key={i}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-sm">{investor.name}</h3>
                        <Badge variant="secondary" className="text-xs">{investor.type}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {investor.focusAreas.map((area, j) => (
                          <Badge key={j} variant="outline" className="text-xs">{area}</Badge>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-muted-foreground">
                        <div>
                          <span className="font-medium text-foreground">Geography: </span>
                          {investor.geography}
                        </div>
                        <div>
                          <span className="font-medium text-foreground">Deal Size: </span>
                          {investor.dealSize}
                        </div>
                        <div>
                          <span className="font-medium text-foreground">Stage Fit: </span>
                          <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium border ${getStageFitColor(investor.stageFit)}`}>
                            {investor.stageFit}
                          </span>
                        </div>
                        {investor.notablePortfolio.length > 0 && (
                          <div>
                            <span className="font-medium text-foreground">Portfolio: </span>
                            {investor.notablePortfolio.slice(0, 3).join(", ")}
                          </div>
                        )}
                      </div>
                      {investor.outreachTip && (
                        <p className="text-xs text-muted-foreground mt-2 bg-muted/50 rounded p-2">
                          <span className="font-medium">Outreach tip:</span> {investor.outreachTip}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Outreach Strategy */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Recommended Order
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {result.outreachStrategy.recommendedOrder.map((name, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                    <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs flex-shrink-0">
                      {i + 1}
                    </div>
                    <span className="text-sm">{name}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Warm Introductions & Tips</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs font-medium text-emerald-500 mb-1">Introduction Tips</p>
                {result.outreachStrategy.warmIntroductionTips.map((tip, i) => (
                  <p key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <span className="text-emerald-500 mt-0.5">+</span> {tip}
                  </p>
                ))}
              </div>
              <div>
                <p className="text-xs font-medium text-destructive mb-1">Common Mistakes</p>
                {result.outreachStrategy.commonMistakes.map((mistake, i) => (
                  <p key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <span className="text-destructive mt-0.5">-</span> {mistake}
                  </p>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Navigation */}
        <div className="flex justify-between">
          <Link href="/founder/pathway">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="w-4 h-4" /> Pathway
            </Button>
          </Link>
          <Link href="/founder/cohort">
            <Button className="gap-2 bg-primary hover:bg-primary/90">
              Cohort Matching <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </FounderLayout>
    );
  }

  return (
    <FounderLayout
      title="Investor Research"
      subtitle="Find the right investors for your startup using AI-powered web search"
    >
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Search className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <h3 className="font-medium text-sm">AI-Powered Research</h3>
              <p className="text-xs text-muted-foreground mt-1">
                We use web search to find real, current investor data for your sector and stage.
                Results include investor profiles, focus areas, deal sizes, and outreach tips.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Research Parameters</CardTitle>
          <CardDescription>Tell us about your startup to find matching investors</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
              <Label>Sector *</Label>
              <Input
                placeholder="e.g., Fintech, Healthtech, Agritech"
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
                  <SelectItem value="Series B+">Series B+</SelectItem>
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
              <Label>Target Raise</Label>
              <Input
                placeholder="e.g., $500K, R5M"
                value={form.targetRaise}
                onChange={(e) => setForm({ ...form, targetRaise: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Current Traction</Label>
              <Input
                placeholder="e.g., 1K users, R50K MRR"
                value={form.traction}
                onChange={(e) => setForm({ ...form, traction: e.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={handleSubmit}
          disabled={!form.startupName.trim() || !form.sector.trim() || loading}
          className="gap-2 bg-primary hover:bg-primary/90 min-w-[220px]"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Researching Investors...
            </>
          ) : (
            <>
              <Search className="w-4 h-4" />
              Research Investors
            </>
          )}
        </Button>
      </div>
    </FounderLayout>
  );
}
