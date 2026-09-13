"use client";

import Link from "next/link";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import {
  Check,
  X,
  Sparkles,
  Shield,
  Crown,
  Rocket,
  Gift,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Separator } from "@/components/ui/separator";
import { useState } from "react";
import { toast } from "sonner";

// ─── Plan Definitions ───────────────────────────────────────────────

type PlanId = "FREE" | "STARTER" | "PROFESSIONAL" | "ENTERPRISE";

interface PlanFeature {
  label: string;
  free: string | boolean;
  starter: string | boolean;
  pro: string | boolean;
  enterprise: string | boolean;
}

const plans = [
  {
    id: "FREE" as PlanId,
    name: "Free",
    price: 0,
    priceDisplay: "$0",
    period: "forever",
    description: "Try the platform with basic access to pitch analysis and coaching.",
    icon: Rocket,
    color: "text-muted-foreground",
    bgColor: "bg-muted/50",
    borderColor: "border-border",
    features: [
      { label: "Pitch Deck Analyses", value: "2" },
      { label: "Script Coach Sessions", value: "2" },
      { label: "Live Pitch Sessions", value: "0" },
      { label: "Full Pitch Sessions", value: "0" },
      { label: "Founder Coaching (E5)", value: false },
    ],
  },
  {
    id: "STARTER" as PlanId,
    name: "Starter",
    price: 29,
    priceDisplay: "$29",
    period: "/month",
    description: "For early-stage founders ready to iterate on their pitch.",
    icon: Shield,
    color: "text-primary",
    bgColor: "bg-primary/10",
    borderColor: "border-primary/30",
    features: [
      { label: "Pitch Deck Analyses", value: "5" },
      { label: "Script Coach Sessions", value: "10" },
      { label: "Live Pitch Sessions", value: "3" },
      { label: "Full Pitch Sessions", value: "0" },
      { label: "Founder Coaching (E5)", value: false },
    ],
  },
  {
    id: "PROFESSIONAL" as PlanId,
    name: "Professional",
    price: 79,
    priceDisplay: "$79",
    period: "/month",
    description: "The most popular plan for founders actively raising capital.",
    icon: Sparkles,
    color: "text-secondary",
    bgColor: "bg-secondary/10",
    borderColor: "border-secondary",
    popular: true,
    features: [
      { label: "Pitch Deck Analyses", value: "15" },
      { label: "Script Coach Sessions", value: "30" },
      { label: "Live Pitch Sessions", value: "10" },
      { label: "Full Pitch Sessions", value: "3" },
      { label: "Priority Support", value: true },
    ],
  },
  {
    id: "ENTERPRISE" as PlanId,
    name: "Enterprise",
    price: 400,
    priceDisplay: "$400",
    period: "one-time",
    description: "Lifetime access with inclusion in the Athena Agentic Founder and Partner Network. Hands-on support and assistance.",
    icon: Crown,
    color: "text-amber-600",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-400",
    features: [
      { label: "Pitch Deck Analyses", value: "Unlimited" },
      { label: "Script Coach Sessions", value: "Unlimited" },
      { label: "Live Pitch Sessions", value: "Unlimited" },
      { label: "Full Pitch Sessions", value: "Unlimited" },
      { label: "Founder Coaching (E5)", value: true },
      { label: "PitchCoach Ai Network Access", value: true },
      { label: "Hands-On Support & Assistance", value: true },
    ],
  },
];

// ─── Feature Comparison Table ────────────────────────────────────────

const comparisonRows: PlanFeature[] = [
  { label: "Pitch Deck Analyses (E1)", free: "2", starter: "5", pro: "15", enterprise: "Unlimited" },
  { label: "Script Coach Sessions (E2)", free: "2", starter: "10", pro: "30", enterprise: "Unlimited" },
  { label: "Live Pitch Sessions (E3)", free: false, starter: "3", pro: "10", enterprise: "Unlimited" },
  { label: "Full Pitch Sessions (E4)", free: false, starter: false, pro: "3", enterprise: "Unlimited" },
  { label: "Founder Coaching (E5)", free: false, starter: false, pro: false, enterprise: true },
  { label: "10-Slide Framework Scoring", free: true, starter: true, pro: true, enterprise: true },
  { label: "Visual Design Audit", free: true, starter: true, pro: true, enterprise: true },
  { label: "5-Element Script Scoring", free: true, starter: true, pro: true, enterprise: true },
  { label: "AI Rewrite Suggestions", free: true, starter: true, pro: true, enterprise: true },
  { label: "Video Recording & Analysis", free: false, starter: true, pro: true, enterprise: true },
  { label: "Body Language Analysis", free: false, starter: true, pro: true, enterprise: true },
  { label: "30-min Full Pitch Recording", free: false, starter: false, pro: true, enterprise: true },
  { label: "Investor Readiness Scoring", free: false, starter: false, pro: true, enterprise: true },
  { label: "Anticipated Investor Q&A", free: false, starter: false, pro: true, enterprise: true },
  { label: "PDF Report Downloads", free: true, starter: true, pro: true, enterprise: true },
  { label: "Before & After Comparison", free: false, starter: true, pro: true, enterprise: true },
  { label: "Founder Readiness Assessment", free: false, starter: false, pro: false, enterprise: true },
  { label: "Investor Research (AI-powered)", free: false, starter: false, pro: false, enterprise: true },
  { label: "Cohort Matching", free: false, starter: false, pro: false, enterprise: true },
  { label: "Network Profile Builder", free: false, starter: false, pro: false, enterprise: true },
  { label: "Priority Support", free: false, starter: false, pro: true, enterprise: true },
  { label: "Dedicated Support", free: false, starter: false, pro: false, enterprise: true },
  { label: "Custom Integrations", free: false, starter: false, pro: false, enterprise: true },
  { label: "PitchCoach Ai Network Access", free: false, starter: false, pro: false, enterprise: true },
  { label: "Hands-On Support & Assistance", free: false, starter: false, pro: false, enterprise: true },
];

// ─── Helper ──────────────────────────────────────────────────────────

function CellValue({ value }: { value: string | boolean }) {
  if (value === true) {
    return <Check className="h-5 w-5 text-secondary mx-auto" />;
  }
  if (value === false) {
    return <X className="h-5 w-5 text-muted-foreground/40 mx-auto" />;
  }
  return <span className="text-sm font-medium text-foreground">{value}</span>;
}

// ─── Page Component ──────────────────────────────────────────────────

export default function PricingPage() {
  const [giftCode, setGiftCode] = useState("");

  const handleApplyGiftCode = () => {
    if (!giftCode.trim()) {
      toast.error("Please enter a gift code");
      return;
    }
    if (giftCode.trim().toLowerCase() === "small axe") {
      toast.success("Gift code applied! 20% discount unlocked.");
    } else {
      toast.error("Invalid gift code. Please check and try again.");
      return;
    }
    setGiftCode("");
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-16 md:py-24">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <Badge variant="secondary" className="mb-4">
                Simple, transparent pricing
              </Badge>
              <h1 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">
                Choose Your Plan
              </h1>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                From free exploration to unlimited coaching — pick the plan that matches
                where you are in your fundraising journey. Upgrade or downgrade anytime.
              </p>
            </div>

            {/* Plan Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-20 max-w-7xl mx-auto">
              {plans.map((plan) => (
                <Card
                  key={plan.id}
                  className={`relative flex flex-col ${
                    plan.popular
                      ? `border-2 ${plan.borderColor} shadow-xl shadow-secondary/10 xl:scale-105`
                      : `border ${plan.borderColor}`
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                      <Badge className="bg-secondary text-secondary-foreground text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap shadow-sm">
                        Most Popular
                      </Badge>
                    </div>
                  )}

                  <CardHeader className={plan.popular ? "pt-8" : ""}>
                    <div className="flex items-center justify-between mb-2">
                      <div className={`w-10 h-10 rounded-lg ${plan.bgColor} flex items-center justify-center`}>
                        <plan.icon className={`h-5 w-5 ${plan.color}`} />
                      </div>
                    </div>
                    <CardTitle className="text-xl text-foreground">
                      {plan.name}
                    </CardTitle>
                    <CardDescription className="text-sm text-muted-foreground">
                      {plan.description}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="flex-1">
                    <div className="text-center mb-6">
                      <span className="text-4xl font-bold text-foreground">
                        {plan.priceDisplay}
                      </span>
                      <span className="text-muted-foreground ml-1">{plan.period}</span>
                    </div>

                    <Separator className="mb-6" />

                    <ul className="space-y-3">
                      {plan.features.map((f) => (
                        <li key={f.label} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{f.label}</span>
                          {typeof f.value === "boolean" ? (
                            f.value ? (
                              <Check className="h-4 w-4 text-secondary shrink-0" />
                            ) : (
                              <X className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                            )
                          ) : (
                            <span className="font-semibold text-foreground">{f.value}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </CardContent>

                  <CardFooter>
                    <SignedOut>
                      <Button
                        asChild
                        className={`w-full ${
                          plan.popular
                            ? "bg-secondary hover:bg-secondary/90 text-secondary-foreground"
                            : "bg-primary hover:bg-primary/90 text-primary-foreground"
                        }`}
                        size="lg"
                      >
                        <Link href="/sign-up">Get Started</Link>
                      </Button>
                    </SignedOut>
                    <SignedIn>
                      <Button
                        asChild
                        className={`w-full ${
                          plan.popular
                            ? "bg-secondary hover:bg-secondary/90 text-secondary-foreground"
                            : "bg-primary hover:bg-primary/90 text-primary-foreground"
                        }`}
                        size="lg"
                      >
                        <Link href="/dashboard">Upgrade</Link>
                      </Button>
                    </SignedIn>
                  </CardFooter>
                </Card>
              ))}
            </div>

            {/* Gift Code Section */}
            <div className="max-w-md mx-auto mb-20 p-6 border border-border rounded-lg bg-muted/30">
              <div className="flex items-center gap-2 mb-4">
                <Gift className="h-5 w-5 text-destructive" />
                <h3 className="font-semibold text-foreground">
                  Have a Gift Code?
                </h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Enter your gift code to unlock a discount. For influencers, students,
                and incubator cohorts.
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter gift code"
                  value={giftCode}
                  onChange={(e) => setGiftCode(e.target.value)}
                  className="border-border"
                  onKeyDown={(e) => e.key === "Enter" && handleApplyGiftCode()}
                />
                <Button
                  className="bg-secondary hover:bg-secondary/90 text-secondary-foreground"
                  onClick={handleApplyGiftCode}
                >
                  Apply
                </Button>
              </div>
            </div>

            {/* Feature Comparison Table */}
            <div className="max-w-7xl mx-auto mb-20">
              <h2 className="text-2xl md:text-3xl font-bold mb-2 text-center text-foreground">
                Full Feature Comparison
              </h2>
              <p className="text-muted-foreground text-center mb-10">
                See exactly what&apos;s included in every plan
              </p>

              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full bg-card">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left py-4 px-4 font-semibold text-foreground text-sm min-w-[200px]">
                        Feature
                      </th>
                      {plans.map((p) => (
                        <th
                          key={p.id}
                          className={`text-center py-4 px-4 font-semibold text-sm min-w-[120px] ${
                            p.popular ? "text-secondary" : "text-foreground"
                          }`}
                        >
                          {p.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonRows.map((row, index) => (
                      <tr
                        key={row.label}
                        className={
                          index % 2 === 0 ? "bg-card" : "bg-muted/20"
                        }
                      >
                        <td className="py-3 px-4 text-sm text-muted-foreground">
                          {row.label}
                        </td>
                        <td className="text-center py-3 px-4">
                          <CellValue value={row.free} />
                        </td>
                        <td className="text-center py-3 px-4">
                          <CellValue value={row.starter} />
                        </td>
                        <td className="text-center py-3 px-4 bg-secondary/5">
                          <CellValue value={row.pro} />
                        </td>
                        <td className="text-center py-3 px-4">
                          <CellValue value={row.enterprise} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Payment Provider Badges */}
            <div className="max-w-2xl mx-auto text-center mb-16">
              <p className="text-sm text-muted-foreground mb-4">
                Secure payments powered by regional leaders
              </p>
              <div className="flex flex-wrap items-center justify-center gap-6">
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted/30 border border-border">
                  <div className="w-8 h-8 rounded bg-[#0BA345] flex items-center justify-center">
                    <span className="text-white text-xs font-bold">PS</span>
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-semibold text-foreground">Paystack</p>
                    <p className="text-[10px] text-muted-foreground">Africa</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted/30 border border-border">
                  <div className="w-8 h-8 rounded bg-[#635BFF] flex items-center justify-center">
                    <span className="text-white text-xs font-bold">S</span>
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-semibold text-foreground">Stripe</p>
                    <p className="text-[10px] text-muted-foreground">International</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
