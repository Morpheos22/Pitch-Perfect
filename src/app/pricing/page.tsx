"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { 
  Presentation, 
  MessageSquare, 
  Video, 
  Sparkles,
  ArrowRight,
  Check,
  Gift,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const products = [
  {
    id: "deck-analyser",
    icon: Presentation,
    title: "Pitch Deck Analyser",
    description: "Comprehensive deck analysis for content and visual quality",
    modules: ["M1: Content Analysis", "M1: Visual Audit"],
    price: 49,
    sessions: 2,
    features: [
      "10-slide content scoring",
      "Visual design audit",
      "Priority action items",
      "Downloadable PDF report",
      "2 analysis cycles included",
    ],
    recommended: true,
    popular: true,
    cta: "Get Started",
  },
  {
    id: "elevator-script",
    icon: MessageSquare,
    title: "Elevator Pitch Script Check",
    description: "Perfect your elevator pitch with AI-powered script analysis",
    modules: ["M2: Script Analysis"],
    price: 39,
    sessions: 2,
    features: [
      "5-element scoring",
      "AI-powered rewrites",
      "Tone analysis",
      "Word count & duration",
      "2 analysis cycles included",
    ],
    recommended: false,
    popular: false,
    cta: "Get Started",
  },
  {
    id: "elevator-live",
    icon: Video,
    title: "Elevator Pitch Live",
    description: "Practice your pitch with real-time video coaching",
    modules: ["M2: Script Analysis", "M3: Live Delivery"],
    price: 149,
    sessions: 5,
    features: [
      "Script analysis included",
      "Video recording & playback",
      "Delivery coaching",
      "Body language feedback",
      "5 practice sessions included",
    ],
    recommended: false,
    popular: false,
    cta: "Get Started",
  },
  {
    id: "pitch-deck-live",
    icon: Presentation,
    title: "Pitch Deck Live",
    description: "Full deck presentation practice with delivery coaching",
    modules: ["M1: Content Analysis", "M4: Full Session"],
    price: 199,
    sessions: 1,
    features: [
      "Complete deck analysis",
      "30-minute session recording",
      "Delivery & body language",
      "Investor readiness score",
      "Q&A preparation",
    ],
    recommended: false,
    popular: false,
    cta: "Get Started",
  },
  {
    id: "master-analyser",
    icon: Sparkles,
    title: "Master Pitch Analyser",
    description: "The complete package for pitch mastery",
    modules: ["M1: Deck Analysis", "M2: Script", "M3: Live Delivery", "M4: Full Session"],
    price: 349,
    sessions: 10,
    features: [
      "All modules included",
      "Unlimited iterations",
      "Priority support",
      "Custom coaching",
      "10 sessions included",
      "Best value for serious founders",
    ],
    recommended: false,
    popular: false,
    bestValue: true,
    cta: "Get Started",
  },
];

const featureComparison = [
  { feature: "Content Analysis", deck: true, script: true, elevator: true, deckLive: true, master: true },
  { feature: "Visual Audit", deck: true, script: false, elevator: false, deckLive: true, master: true },
  { feature: "Script Rewrites", deck: false, script: true, elevator: true, deckLive: false, master: true },
  { feature: "Video Recording", deck: false, script: false, elevator: true, deckLive: true, master: true },
  { feature: "Delivery Coaching", deck: false, script: false, elevator: true, deckLive: true, master: true },
  { feature: "Body Language Analysis", deck: false, script: false, elevator: true, deckLive: true, master: true },
  { feature: "Q&A Preparation", deck: false, script: false, elevator: false, deckLive: true, master: true },
  { feature: "PDF Report", deck: true, script: true, elevator: true, deckLive: true, master: true },
  { feature: "Priority Support", deck: false, script: false, elevator: false, deckLive: false, master: true },
];

export default function PricingPage() {
  const [giftCode, setGiftCode] = useState("");

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero Section */}
      <section className="py-16 bg-gradient-to-b from-muted/50 to-background">
        <div className="container mx-auto px-4 text-center">
          <Badge variant="secondary" className="mb-4">Pricing</Badge>
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            Choose Your Coaching Path
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            From deck analysis to live coaching, find the perfect package for your pitch needs.
          </p>
        </div>
      </section>

      {/* Product Cards */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 max-w-7xl mx-auto">
            {products.map((product) => (
              <Card 
                key={product.id}
                className={`relative flex flex-col ${
                  product.popular 
                    ? "ring-2 ring-primary shadow-lg scale-105" 
                    : product.bestValue 
                    ? "ring-2 ring-accent shadow-lg" 
                    : ""
                }`}
              >
                {product.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground">Most Popular</Badge>
                  </div>
                )}
                {product.bestValue && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-accent text-accent-foreground">Best Value</Badge>
                  </div>
                )}

                <CardHeader className="text-center pb-2">
                  <div className={`w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center ${
                    product.popular 
                      ? "bg-primary text-primary-foreground" 
                      : product.bestValue 
                      ? "bg-accent text-accent-foreground" 
                      : "bg-muted"
                  }`}>
                    <product.icon className="w-7 h-7" />
                  </div>
                  <CardTitle className="text-lg">{product.title}</CardTitle>
                  <CardDescription className="text-xs">{product.description}</CardDescription>
                </CardHeader>

                <CardContent className="flex-1">
                  {/* Price */}
                  <div className="text-center mb-4">
                    <span className="text-3xl font-bold">${product.price}</span>
                    <span className="text-muted-foreground text-sm">/one-time</span>
                  </div>

                  {/* Modules */}
                  <div className="mb-4">
                    <p className="text-xs text-muted-foreground mb-2">Modules included:</p>
                    <div className="flex flex-wrap gap-1">
                      {product.modules.map((module) => (
                        <Badge key={module} variant="outline" className="text-xs">
                          {module}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Features */}
                  <ul className="space-y-2">
                    {product.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm">
                        <Check className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                        <span className="text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>

                <CardFooter>
                  <Link href="/sign-up" className="w-full">
                    <Button 
                      className={`w-full ${product.popular ? "bg-primary hover:bg-primary/90" : product.bestValue ? "bg-accent hover:bg-accent/90" : ""}`}
                    >
                      {product.cta}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Comparison Table */}
      <section className="py-12 bg-muted/30">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-8">Feature Comparison</h2>
          
          <div className="overflow-x-auto max-w-5xl mx-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="text-left py-3 px-4 font-medium">Feature</th>
                  <th className="text-center py-3 px-4 font-medium">Deck</th>
                  <th className="text-center py-3 px-4 font-medium">Script</th>
                  <th className="text-center py-3 px-4 font-medium">Live Pitch</th>
                  <th className="text-center py-3 px-4 font-medium">Deck Live</th>
                  <th className="text-center py-3 px-4 font-medium text-accent">Master</th>
                </tr>
              </thead>
              <tbody>
                {featureComparison.map((row, index) => (
                  <tr key={row.feature} className={index % 2 === 0 ? "bg-muted/50" : ""}>
                    <td className="py-3 px-4 text-sm">{row.feature}</td>
                    <td className="text-center py-3 px-4">
                      {row.deck ? <Check className="w-4 h-4 text-accent mx-auto" /> : <span className="text-muted-foreground">-</span>}
                    </td>
                    <td className="text-center py-3 px-4">
                      {row.script ? <Check className="w-4 h-4 text-accent mx-auto" /> : <span className="text-muted-foreground">-</span>}
                    </td>
                    <td className="text-center py-3 px-4">
                      {row.elevator ? <Check className="w-4 h-4 text-accent mx-auto" /> : <span className="text-muted-foreground">-</span>}
                    </td>
                    <td className="text-center py-3 px-4">
                      {row.deckLive ? <Check className="w-4 h-4 text-accent mx-auto" /> : <span className="text-muted-foreground">-</span>}
                    </td>
                    <td className="text-center py-3 px-4 bg-accent/5">
                      {row.master ? <Check className="w-4 h-4 text-accent mx-auto" /> : <span className="text-muted-foreground">-</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Gift Code Section */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <Card className="max-w-md mx-auto">
            <CardHeader className="text-center">
              <Gift className="w-10 h-10 text-primary mx-auto mb-2" />
              <CardTitle>Have a Gift Code?</CardTitle>
              <CardDescription>
                Enter your gift code to redeem free sessions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter gift code"
                  value={giftCode}
                  onChange={(e) => setGiftCode(e.target.value)}
                />
                <Button variant="outline">Apply</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* FAQ or CTA */}
      <section className="py-12 bg-muted/30">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold mb-4">Not Sure Which to Choose?</h2>
          <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
            Start with our most popular option - Pitch Deck Analyser. It&apos;s the perfect entry point to improve your pitch.
          </p>
          <Link href="/sign-up">
            <Button size="lg" className="gap-2 bg-primary hover:bg-primary/90">
              Start Free Trial
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
