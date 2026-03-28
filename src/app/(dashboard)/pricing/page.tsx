"use client";

import { useState } from "react";
import Link from "next/link";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { 
  Presentation, 
  MessageSquare, 
  Video, 
  BarChart3, 
  Zap,
  Check,
  Gift
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { toast } from "sonner";

const products = [
  {
    id: "pitch-deck",
    icon: Presentation,
    name: "Pitch Deck Analyser",
    tagline: "Product 1",
    description: "Upload your pitch deck and receive scored AI feedback against the 10-slide framework. Includes visual design audit and two full cycles.",
    modules: [
      { name: "Module 1: Pitch Deck Analysis", cycles: "2 cycles" }
    ],
    features: [
      "10-slide framework scoring",
      "Visual design audit (5 dimensions)",
      "Before-and-after comparison",
      "Downloadable PDF reports",
      "Priority action recommendations",
    ],
    price: 15,
    priceDisplay: "$15",
    featured: true,
  },
  {
    id: "elevator-script",
    icon: MessageSquare,
    name: "Elevator Pitch Script Check",
    tagline: "Product 2",
    description: "Submit your elevator pitch script via upload or paste. Get element-by-element feedback with rewrite suggestions.",
    modules: [
      { name: "Module 2: Script Coaching", cycles: "2 cycles" }
    ],
    features: [
      "5-element framework scoring",
      "Your excerpts with feedback",
      "AI rewrite suggestions",
      "Tone analysis (Clarity, Confidence, Conciseness)",
      "Word count & duration estimate",
    ],
    price: 10,
    priceDisplay: "$10",
    featured: false,
  },
  {
    id: "elevator-live",
    icon: Video,
    name: "Elevator Pitch Live",
    tagline: "Product 3",
    description: "Script coaching plus live recording practice. Record yourself delivering your pitch and get delivery feedback.",
    modules: [
      { name: "Module 2: Script Coaching", cycles: "2 sessions" },
      { name: "Module 3: Live Recording", cycles: "3 sessions" },
    ],
    features: [
      "All Script Check features",
      "Video or audio recording (max 3 min)",
      "Vocal delivery scoring",
      "Body language analysis (video mode)",
      "Personalized coaching drills",
    ],
    price: 25,
    priceDisplay: "$25",
    featured: false,
  },
  {
    id: "pitch-live",
    icon: BarChart3,
    name: "Pitch Deck Live",
    tagline: "Product 4",
    description: "Deck analysis plus full 30-minute presentation recording. Get comprehensive feedback on content and delivery.",
    modules: [
      { name: "Module 1: Deck Analysis", cycles: "2 cycles" },
      { name: "Module 4: Full Pitch", cycles: "1 session" },
    ],
    features: [
      "All Deck Analyser features",
      "30-minute presentation recording",
      "6-dimension investor readiness scoring",
      "Anticipated investor questions",
      "Competitive context analysis",
    ],
    price: 40,
    priceDisplay: "$40",
    featured: false,
  },
  {
    id: "master",
    icon: Zap,
    name: "Master Pitch Analyser",
    tagline: "Product 5",
    description: "Complete coaching: deck, script, live delivery, and full presentation. The ultimate pitch preparation package.",
    modules: [
      { name: "Module 1: Deck Analysis", cycles: "2 cycles" },
      { name: "Module 2: Script Coaching", cycles: "2 sessions" },
      { name: "Module 3: Live Recording", cycles: "3 sessions" },
      { name: "Module 4: Full Pitch", cycles: "1 session" },
    ],
    features: [
      "All features from all modules",
      "8 total coaching sessions",
      "Complete pitch transformation",
      "Priority support",
      "All future product updates",
    ],
    price: 60,
    priceDisplay: "$60",
    featured: false,
  },
];

const featureComparison = [
  { feature: "Deck Analysis", p1: true, p2: false, p3: false, p4: true, p5: true },
  { feature: "Script Coaching", p1: false, p2: true, p3: true, p4: false, p5: true },
  { feature: "Live Recording (3 min)", p1: false, p2: false, p3: true, p4: false, p5: true },
  { feature: "Full Pitch Recording (30 min)", p1: false, p2: false, p3: false, p4: true, p5: true },
  { feature: "Visual Design Audit", p1: true, p2: false, p3: false, p4: true, p5: true },
  { feature: "Body Language Analysis", p1: false, p2: false, p3: true, p4: true, p5: true },
  { feature: "PDF Reports", p1: true, p2: true, p3: true, p4: true, p5: true },
  { feature: "Session Comparison", p1: true, p2: true, p3: true, p4: true, p5: true },
];

export default function PricingPage() {
  const [giftCode, setGiftCode] = useState("");

  const handleApplyGiftCode = () => {
    if (!giftCode.trim()) {
      toast.error("Please enter a gift code");
      return;
    }
    toast.success("Gift code applied successfully!");
    setGiftCode("");
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-1">
        <section className="py-12 md:py-20">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h1 className="text-3xl md:text-4xl font-bold mb-4">
                Choose Your Coaching Package
              </h1>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Every product includes two full cycles — submit, get feedback, improve, submit again.
                One-time purchase, no recurring subscription.
              </p>
            </div>

            {/* Product Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
              {products.map((product) => (
                <Card 
                  key={product.id}
                  id={product.id}
                  className={`relative flex flex-col ${
                    product.featured 
                      ? "border-2 border-primary shadow-lg shadow-primary/10 lg:scale-105" 
                      : ""
                  }`}
                >
                  {product.featured && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                      <span className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap">
                        Recommended Start
                      </span>
                    </div>
                  )}
                  <CardHeader className={product.featured ? "pt-8" : ""}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-muted-foreground">{product.tagline}</span>
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <product.icon className="h-5 w-5 text-primary" />
                      </div>
                    </div>
                    <CardTitle className="text-xl">{product.name}</CardTitle>
                    <CardDescription className="text-sm">{product.description}</CardDescription>
                  </CardHeader>
                  
                  <CardContent className="flex-1">
                    {/* Modules */}
                    <div className="mb-4">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Included modules:</p>
                      <div className="space-y-1">
                        {product.modules.map((module) => (
                          <div 
                            key={module.name}
                            className="inline-flex items-center gap-1 text-xs bg-secondary/10 text-secondary-foreground px-2 py-1 rounded mr-1"
                          >
                            <span>{module.name}</span>
                            <span className="text-muted-foreground">({module.cycles})</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Features */}
                    <ul className="space-y-2">
                      {product.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2 text-sm">
                          <Check className="h-4 w-4 text-secondary shrink-0 mt-0.5" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                  
                  <CardFooter className="flex-col gap-3">
                    <div className="text-center w-full">
                      <span className="text-3xl font-bold">{product.priceDisplay}</span>
                      <span className="text-muted-foreground ml-1">one-time</span>
                    </div>
                    <SignedOut>
                      <Button 
                        asChild 
                        className={`w-full ${product.featured ? "bg-primary hover:bg-primary/90" : ""}`}
                        variant={product.featured ? "default" : "outline"}
                      >
                        <Link href="/sign-up">Get started</Link>
                      </Button>
                    </SignedOut>
                    <SignedIn>
                      <Button 
                        asChild 
                        className={`w-full ${product.featured ? "bg-primary hover:bg-primary/90" : ""}`}
                        variant={product.featured ? "default" : "outline"}
                      >
                        <Link href="/dashboard">Purchase</Link>
                      </Button>
                    </SignedIn>
                  </CardFooter>
                </Card>
              ))}
            </div>

            {/* Gift Code Section */}
            <div className="max-w-md mx-auto mb-16 p-6 border border-border rounded-lg bg-muted/30">
              <div className="flex items-center gap-2 mb-4">
                <Gift className="h-5 w-5 text-secondary" />
                <h3 className="font-semibold">Have a Gift Code?</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Enter your gift code to unlock free access. For influencers, students, and incubator cohorts.
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter gift code"
                  value={giftCode}
                  onChange={(e) => setGiftCode(e.target.value)}
                />
                <Button onClick={handleApplyGiftCode}>Apply</Button>
              </div>
            </div>

            {/* Feature Comparison Table */}
            <div className="overflow-x-auto">
              <h2 className="text-2xl font-bold mb-6 text-center">Feature Comparison</h2>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-medium">Feature</th>
                    {products.map((p) => (
                      <th 
                        key={p.id} 
                        className={`text-center py-3 px-4 font-medium ${p.featured ? "text-primary" : ""}`}
                      >
                        {p.tagline}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {featureComparison.map((row, index) => (
                    <tr key={row.feature} className={index % 2 === 0 ? "bg-muted/30" : ""}>
                      <td className="py-3 px-4 text-sm">{row.feature}</td>
                      {[row.p1, row.p2, row.p3, row.p4, row.p5].map((included, idx) => (
                        <td key={idx} className="text-center py-3 px-4">
                          {included ? (
                            <Check className="h-5 w-5 text-secondary mx-auto" />
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
