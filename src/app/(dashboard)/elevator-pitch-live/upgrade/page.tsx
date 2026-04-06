"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Video,
  ArrowLeft,
  Check,
  X,
  Sparkles,
  ArrowRight,
  Mic,
  Users,
  Gauge,
  Repeat,
} from "lucide-react";

// ─── Plan Comparison Data (Live Pitch Specific) ──────────────────────

const livePlanComparison = [
  {
    plan: "Free",
    price: "$0",
    features: [
      { label: "Live Pitch Sessions", value: "0" },
      { label: "Video Recording (max 3 min)", value: false },
      { label: "Vocal Delivery Scoring", value: false },
      { label: "Body Language Analysis", value: false },
      { label: "Personalised Coaching Drills", value: false },
      { label: "Progress Tracking", value: false },
    ],
  },
  {
    plan: "Starter",
    price: "$29/mo",
    features: [
      { label: "Live Pitch Sessions", value: "3" },
      { label: "Video Recording (max 3 min)", value: true },
      { label: "Vocal Delivery Scoring", value: true },
      { label: "Body Language Analysis", value: true },
      { label: "Personalised Coaching Drills", value: false },
      { label: "Progress Tracking", value: false },
    ],
  },
  {
    plan: "Professional",
    price: "$79/mo",
    popular: true,
    features: [
      { label: "Live Pitch Sessions", value: "10" },
      { label: "Video Recording (max 3 min)", value: true },
      { label: "Vocal Delivery Scoring", value: true },
      { label: "Body Language Analysis", value: true },
      { label: "Personalised Coaching Drills", value: true },
      { label: "Progress Tracking", value: true },
    ],
  },
  {
    plan: "Enterprise",
    price: "$199/mo",
    features: [
      { label: "Live Pitch Sessions", value: "Unlimited" },
      { label: "Video Recording (max 3 min)", value: true },
      { label: "Vocal Delivery Scoring", value: true },
      { label: "Body Language Analysis", value: true },
      { label: "Personalised Coaching Drills", value: true },
      { label: "Progress Tracking", value: true },
    ],
  },
];

const whatYouGet = [
  {
    icon: Mic,
    title: "Video or Audio Recording",
    description:
      "Record yourself delivering your elevator pitch (up to 3 minutes). Choose video mode for full body language analysis, or audio-only for focused vocal coaching.",
  },
  {
    icon: Gauge,
    title: "Vocal Delivery Scoring",
    description:
      "AI scores your delivery across 5 dimensions: speaking pace, clarity, filler word usage, energy, and perceived confidence — with specific improvement suggestions.",
  },
  {
    icon: Users,
    title: "Body Language Analysis",
    description:
      "In video mode, AI evaluates eye contact, facial expressions, gestures, and posture — the non-verbal signals that can make or break a pitch.",
  },
  {
    icon: Repeat,
    title: "Personalised Coaching Drills",
    description:
      "Get targeted exercises based on your weak areas. If you use too many filler words, you get drills for that. If your energy is low, you get energy exercises.",
  },
];

export default function LiveUpgradePage() {
  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/elevator-pitch-live">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Video className="w-6 h-6 text-primary" />
            Upgrade Live Pitch
          </h1>
          <p className="text-muted-foreground">
            Unlock live recording sessions and delivery coaching
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
        <h2 className="text-lg font-semibold mb-4">Live Pitch Limits by Plan</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {livePlanComparison.map((plan) => (
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
                {livePlanComparison.map((p) => (
                  <th key={p.plan} className="text-center py-3 px-4 font-medium">
                    {p.plan}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { label: "Live Pitch Sessions / month", free: "0", starter: "3", pro: "10", enterprise: "Unlimited" },
                { label: "Video/Audio Recording (3 min)", free: false, starter: true, pro: true, enterprise: true },
                { label: "Vocal Delivery Scoring", free: false, starter: true, pro: true, enterprise: true },
                { label: "Body Language Analysis", free: false, starter: true, pro: true, enterprise: true },
                { label: "Personalised Coaching Drills", free: false, starter: false, pro: true, enterprise: true },
                { label: "Progress Tracking", free: false, starter: false, pro: true, enterprise: true },
                { label: "Script Coach Sessions (E2)", free: "1", starter: "10", pro: "30", enterprise: "Unlimited" },
                { label: "Deck Analyses (E1)", free: "1", starter: "5", pro: "15", enterprise: "Unlimited" },
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
