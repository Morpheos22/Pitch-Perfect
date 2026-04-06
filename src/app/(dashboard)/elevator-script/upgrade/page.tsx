"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  MessageSquare,
  ArrowLeft,
  Check,
  X,
  Sparkles,
  ArrowRight,
  PenLine,
  AudioLines,
  RefreshCcw,
  FileText,
} from "lucide-react";

// ─── Plan Comparison Data (Script Coach Specific) ────────────────────

const scriptPlanComparison = [
  {
    plan: "Free",
    price: "$0",
    features: [
      { label: "Script Sessions", value: "1" },
      { label: "5-Element Framework Scoring", value: true },
      { label: "AI Rewrite Suggestions", value: true },
      { label: "Tone Analysis (3 dimensions)", value: true },
      { label: "Word Count & Duration Estimate", value: true },
      { label: "Version Comparison", value: false },
      { label: "Multiple Target Audiences", value: false },
    ],
  },
  {
    plan: "Starter",
    price: "$29/mo",
    features: [
      { label: "Script Sessions", value: "10" },
      { label: "5-Element Framework Scoring", value: true },
      { label: "AI Rewrite Suggestions", value: true },
      { label: "Tone Analysis (3 dimensions)", value: true },
      { label: "Word Count & Duration Estimate", value: true },
      { label: "Version Comparison", value: true },
      { label: "Multiple Target Audiences", value: false },
    ],
  },
  {
    plan: "Professional",
    price: "$79/mo",
    popular: true,
    features: [
      { label: "Script Sessions", value: "30" },
      { label: "5-Element Framework Scoring", value: true },
      { label: "AI Rewrite Suggestions", value: true },
      { label: "Tone Analysis (3 dimensions)", value: true },
      { label: "Word Count & Duration Estimate", value: true },
      { label: "Version Comparison", value: true },
      { label: "Multiple Target Audiences", value: true },
    ],
  },
  {
    plan: "Enterprise",
    price: "$199/mo",
    features: [
      { label: "Script Sessions", value: "Unlimited" },
      { label: "5-Element Framework Scoring", value: true },
      { label: "AI Rewrite Suggestions", value: true },
      { label: "Tone Analysis (3 dimensions)", value: true },
      { label: "Word Count & Duration Estimate", value: true },
      { label: "Version Comparison", value: true },
      { label: "Multiple Target Audiences", value: true },
    ],
  },
];

const whatYouGet = [
  {
    icon: PenLine,
    title: "5-Element Framework Scoring",
    description:
      "Your script is scored across five critical elements: Hook, Problem, Solution, Credibility, and Call-to-Action — each with detailed feedback.",
  },
  {
    icon: Sparkles,
    title: "AI Rewrite Suggestions",
    description:
      "Get intelligent rewrite suggestions and alternative opening hooks crafted by AI to make your pitch more compelling.",
  },
  {
    icon: AudioLines,
    title: "Tone Analysis",
    description:
      "Three-dimension tone scoring — Clarity, Confidence, and Conciseness — ensures your pitch lands with impact.",
  },
  {
    icon: RefreshCcw,
    title: "Version Comparison",
    description:
      "Compare multiple script versions side by side to see how your pitch has evolved and improved across sessions.",
  },
];

export default function ScriptUpgradePage() {
  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/elevator-script">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-primary" />
            Upgrade Script Coach
          </h1>
          <p className="text-muted-foreground">
            Unlock more sessions and advanced coaching for your elevator pitch
          </p>
        </div>
      </div>

      {/* What You Get Section */}
      <div>
        <h2 className="text-lg font-semibold mb-4">What you unlock with a paid plan</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {whatYouGet.map((item) => (
            <Card key={item.title} className="border-border">
              <CardContent className="p-4 flex gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <item.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">{item.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Separator />

      {/* Plan Comparison */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Script Coach Limits by Plan</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {scriptPlanComparison.map((plan) => (
            <Card
              key={plan.plan}
              className={`relative ${
                plan.popular ? "ring-2 ring-primary shadow-lg" : ""
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground">
                    Most Popular
                  </Badge>
                </div>
              )}
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-lg">{plan.plan}</CardTitle>
                <CardDescription>
                  <span className="text-xl font-bold text-foreground">{plan.price}</span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {plan.features.map((f) => (
                    <li key={f.label} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground text-xs">{f.label}</span>
                      {typeof f.value === "boolean" ? (
                        f.value ? (
                          <Check className="h-4 w-4 text-primary shrink-0" />
                        ) : (
                          <X className="h-4 w-4 text-slate-300 shrink-0" />
                        )
                      ) : (
                        <span className="font-semibold">{f.value}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Separator />

      {/* Feature Comparison Table */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Detailed Feature Comparison</h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm bg-white">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left py-3 px-4 font-medium">Feature</th>
                {scriptPlanComparison.map((p) => (
                  <th key={p.plan} className="text-center py-3 px-4 font-medium">
                    {p.plan}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { label: "Script Sessions / month", free: "1", starter: "10", pro: "30", enterprise: "Unlimited" },
                { label: "5-Element Scoring", free: true, starter: true, pro: true, enterprise: true },
                { label: "AI Rewrite Suggestions", free: true, starter: true, pro: true, enterprise: true },
                { label: "Tone Analysis", free: true, starter: true, pro: true, enterprise: true },
                { label: "Version Comparison", free: false, starter: true, pro: true, enterprise: true },
                { label: "Multiple Target Audiences", free: false, starter: false, pro: true, enterprise: true },
                { label: "Deck Analyses (E1)", free: "1", starter: "5", pro: "15", enterprise: "Unlimited" },
                { label: "Live Pitch Sessions (E3)", free: false, starter: "3", pro: "10", enterprise: "Unlimited" },
                { label: "Full Pitch Sessions (E4)", free: false, starter: false, pro: "3", enterprise: "10" },
                { label: "Priority Support", free: false, starter: false, pro: true, enterprise: true },
              ].map((row, i) => (
                <tr key={row.label} className={i % 2 === 0 ? "" : "bg-muted/30"}>
                  <td className="py-2.5 px-4 text-muted-foreground">{row.label}</td>
                  {(["free", "starter", "pro", "enterprise"] as const).map((key) => {
                    const v = row[key];
                    return (
                      <td key={key} className="text-center py-2.5 px-4">
                        {typeof v === "boolean" ? (
                          v ? (
                            <Check className="h-4 w-4 text-primary mx-auto" />
                          ) : (
                            <X className="h-4 w-4 text-slate-300 mx-auto" />
                          )
                        ) : (
                          <span className="font-medium">{v}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CTA: Full Upgrade */}
      <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
        <CardContent className="py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Ready to upgrade?</h3>
                <p className="text-sm text-muted-foreground">
                  View all plans and unlock unlimited access to all coaching modules.
                </p>
              </div>
            </div>
            <Link href="/pricing">
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground" size="lg">
                View All Plans
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
