"use client";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent } from "@/components/ui/card";
import { Check, Sparkles } from "lucide-react";

const TIERS = [
  {
    name: "JJC",
    tagline: "Just getting started",
    price: "Free",
    features: ["2 pitch deck analyses", "2 script check sessions", "Basic AI feedback", "Community access", "Email support"],
    cta: "Start Free",
    href: "/sign-up",
  },
  {
    name: "Intern",
    tagline: "Building your first pitch",
    price: "₦9,000",
    features: ["10 pitch deck analyses", "10 script check sessions", "Detailed AI feedback with scores", "Pitch deck visual audit", "Script rewriting suggestions", "Priority email support"],
    cta: "Get Intern",
    href: "https://buy.stripe.com/7sYfZa5mC7KzcCdfekfbq01",
  },
  {
    name: "Cofounder",
    tagline: "Serious about raising",
    price: "₦15,000",
    features: ["25 pitch deck analyses", "25 script check sessions", "5 live pitch video analyses", "Full pitch session (30-min video)", "Investor readiness scoring", "Anticipated Q&A preparation", "Priority support"],
    cta: "Get Cofounder",
    href: "https://buy.stripe.com/8x2aEQeXcd4Tau58PWfbq02",
    popular: true,
  },
  {
    name: "Founder",
    tagline: "Ready to close the round",
    price: "₦30,000",
    features: ["Unlimited pitch deck analyses", "Unlimited script check sessions", "Unlimited live pitch analyses", "5 full pitch sessions", "Founder coaching modules", "Investor research tools", "Cohort matching", "Pathway recommendations", "Dedicated support"],
    cta: "Get Founder",
    href: "https://buy.stripe.com/28E6oAdT8c0P45H4zGfbq03",
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto max-w-6xl px-4 py-16">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h1 className="mb-4 text-4xl font-bold text-foreground">Simple, Transparent Pricing</h1>
          <p className="text-xl text-muted-foreground">Choose the plan that fits your stage. All plans are one-time payments — no recurring charges.</p>
        </div>

        <div className="mb-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {TIERS.map((tier) => (
            <Card key={tier.name} className={tier.popular ? "relative border-2 border-primary" : ""}>
              {tier.popular && (
                <div className="absolute -top-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                  <Sparkles className="h-3 w-3" /> Most Popular
                </div>
              )}
              <CardContent className="flex h-full flex-col p-6">
                <h2 className="mb-1 text-xl font-bold text-foreground">{tier.name}</h2>
                <p className="mb-4 text-sm text-muted-foreground">{tier.tagline}</p>
                <div className="mb-4"><span className="text-3xl font-bold text-foreground">{tier.price}</span>{tier.price !== "Free" && <span className="ml-1 text-sm text-muted-foreground">one-time</span>}</div>
                <ul className="mb-6 flex-1 space-y-2">
                  {tier.features.map((feature) => <li key={feature} className="flex items-start gap-2 text-sm"><Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" /><span className="text-muted-foreground">{feature}</span></li>)}
                </ul>
                <a href={tier.href} className={`block w-full rounded-md py-2.5 text-center font-semibold transition-colors ${tier.popular ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-muted text-foreground hover:bg-muted/80"}`}>{tier.cta}</a>
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="mx-auto mb-12 max-w-3xl rounded-lg border border-border bg-muted/30 p-4 text-center text-sm text-muted-foreground">
          Prices are shown in Nigerian naira. Stripe checkout processes payment in NGN at the current exchange rate for international customers.
        </p>

        <section className="mx-auto max-w-3xl">
          <h2 className="mb-6 text-center text-2xl font-semibold text-foreground">Frequently Asked Questions</h2>
          <div className="space-y-4">
            <Card><CardContent className="p-4"><h3 className="mb-1 font-semibold text-foreground">What does “one-time” payment mean?</h3><p className="text-sm text-muted-foreground">All paid plans are one-time payments. You pay once and get lifetime access to the features included in that plan. There are no recurring charges.</p></CardContent></Card>
            <Card><CardContent className="p-4"><h3 className="mb-1 font-semibold text-foreground">Can I change my plan later?</h3><p className="text-sm text-muted-foreground">Since all plans are one-time payments, you can purchase an upgrade to a higher tier at any time to unlock additional pitch evaluations and features.</p></CardContent></Card>
            <Card><CardContent className="p-4"><h3 className="mb-1 font-semibold text-foreground">Do you offer refunds?</h3><p className="text-sm text-muted-foreground">We offer a 7-day money-back guarantee on all paid plans. If you are not satisfied, contact us at Metron@Athenagentic.app for a full refund.</p></CardContent></Card>
            <Card><CardContent className="p-4"><h3 className="mb-1 font-semibold text-foreground">Why are prices in Naira?</h3><p className="text-sm text-muted-foreground">We are based in Nigeria and price primarily in Naira. Stripe checkout processes payment securely in NGN at the current exchange rate for international customers.</p></CardContent></Card>
          </div>
        </section>

        <div className="mt-12 text-center"><p className="mb-4 text-muted-foreground">Have more questions?</p><a href="/contact" className="inline-block rounded-md bg-primary px-6 py-3 font-semibold text-primary-foreground transition-colors hover:bg-primary/90">Contact Us</a></div>
      </main>
      <Footer />
    </div>
  );
}
