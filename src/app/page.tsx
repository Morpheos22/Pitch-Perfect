"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import {
  Upload,
  Brain,
  FileText,
  TrendingUp,
  ArrowRight,
  CheckCircle,
  Presentation,
  MessageSquare,
  Video,
  BarChart3,
  Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";

// ── How It Works steps ────────────────────────────────────────────────────
const howItWorksSteps = [
  {
    icon: Upload,
    title: "Upload",
    description: "Upload your pitch deck, script, or record yourself delivering your pitch.",
  },
  {
    icon: Brain,
    title: "AI Analyses",
    description: "Our AI analyzes your content against proven frameworks and best practices.",
  },
  {
    icon: FileText,
    title: "Review Report",
    description: "Get detailed scores, feedback, and actionable recommendations.",
  },
  {
    icon: TrendingUp,
    title: "Improve",
    description: "Revise based on feedback and submit again to track your improvement.",
  },
];

// ── Products (modules text removed, icons centered) ───────────────────────
const products = [
  {
    id: "pitch-deck",
    icon: Presentation,
    name: "Pitch Deck Analyser",
    description: "Get your deck scored against the 10-slide framework with visual design audit.",
    href: "/pricing#pitch-deck",
    moduleHref: "/pitch-deck-analyser/new",
    featured: true,
  },
  {
    id: "elevator-script",
    icon: MessageSquare,
    name: "Script Check",
    description: "Submit your script for element-by-element feedback and rewrite suggestions.",
    href: "/pricing#elevator-script",
    moduleHref: "/elevator-script/new",
    featured: false,
  },
  {
    id: "elevator-live",
    icon: Video,
    name: "Live Pitch",
    description: "Script coaching plus live recording practice with delivery feedback.",
    href: "/pricing#elevator-live",
    moduleHref: "/elevator-pitch-live/new",
    featured: false,
  },
  {
    id: "pitch-live",
    icon: BarChart3,
    name: "Pitch Deck Live",
    description: "Deck analysis plus full 30-minute presentation recording and coaching.",
    href: "/pricing#pitch-live",
    moduleHref: "/coach/full/new",
    featured: false,
  },
  {
    id: "master",
    icon: Zap,
    name: "Master Pitch Analyser",
    description: "Complete coaching: deck, script, live delivery, and full presentation.",
    href: "/pricing#master",
    moduleHref: "/dashboard",
    featured: false,
  },
];

// ── Social proof (carousel items) ─────────────────────────────────────────
const socialProof = [
  "Used by startup founders, learning institutions and Y Combinator Applicants",
  "Trusted by 500+ Entrepreneurs",
  "Powered by Cloudflare Workers AI",
  "NDPR Compliant — Built in Nigeria",
];

// ── Light Beam Animation Component ────────────────────────────────────────
function HowItWorksSection() {
  const [hoveredStep, setHoveredStep] = useState<number | null>(null);
  const [beamProgress, setBeamProgress] = useState(0);
  const [beamDirection, setBeamDirection] = useState<"forward" | "backward">("forward");
  const [isBeaming, setIsBeaming] = useState(false);
  const animationRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isBeaming) return;

    // Fast animation: 20ms intervals, 2% per step = ~1 second forward + ~1 second back
    animationRef.current = setInterval(() => {
      setBeamProgress((prev) => {
        if (beamDirection === "forward") {
          if (prev >= 100) {
            // Reached step 4, pause briefly then reverse
            setBeamDirection("backward");
            return 100;
          }
          return prev + 2;
        } else {
          if (prev <= 0) {
            // Back to step 1, stop
            setIsBeaming(false);
            setBeamDirection("forward");
            return 0;
          }
          return prev - 2;
        }
      });
    }, 20);

    return () => {
      if (animationRef.current) {
        clearInterval(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [isBeaming, beamDirection]);

  const handleStepHover = (index: number) => {
    setHoveredStep(index);
    if (index === 0 && !isBeaming) {
      setIsBeaming(true);
      setBeamProgress(0);
      setBeamDirection("forward");
    }
  };

  const handleStepLeave = () => {
    setHoveredStep(null);
    if (animationRef.current) {
      clearInterval(animationRef.current);
      animationRef.current = null;
    }
    setIsBeaming(false);
    setBeamProgress(0);
    setBeamDirection("forward");
  };

  // Calculate which step the beam is currently highlighting
  const activeStep = isBeaming ? Math.min(3, Math.floor(beamProgress / 25)) : -1;

  return (
    <section id="how-it-works" className="py-20 md:py-32">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">How It Works</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Four simple steps to transform your pitch from good to great.
          </p>
        </div>

        <div
          className="relative grid grid-cols-1 md:grid-cols-4 gap-8"
          onMouseLeave={handleStepLeave}
        >
          {/* Light beam track */}
          <div className="absolute top-8 left-[12.5%] right-[12.5%] h-0.5 hidden md:block pointer-events-none">
            <div
              className="h-full rounded-full transition-all duration-100 ease-linear"
              style={{
                background: isBeaming
                  ? `linear-gradient(to right, var(--primary) 0%, var(--secondary) ${beamProgress}%, var(--border) ${beamProgress}%)`
                  : "var(--border)",
                boxShadow: isBeaming
                  ? `0 0 12px var(--primary), 0 0 24px var(--secondary)`
                  : "none",
              }}
            />
          </div>

          {howItWorksSteps.map((step, index) => (
            <div
              key={step.title}
              className="relative"
              onMouseEnter={() => handleStepHover(index)}
            >
              <div className="flex flex-col items-center text-center">
                <div
                  className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-all duration-300 ${
                    hoveredStep === index || activeStep === index
                      ? "bg-primary scale-110 shadow-lg shadow-primary/30"
                      : "bg-primary/10"
                  }`}
                >
                  <step.icon
                    className={`h-8 w-8 transition-colors duration-300 ${
                      hoveredStep === index || activeStep === index
                        ? "text-primary-foreground"
                        : "text-primary"
                    }`}
                  />
                </div>
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-xs font-bold text-secondary bg-background px-2">
                  Step {index + 1}
                </span>
                <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Trust Carousel (horizontal scroll) ────────────────────────────────────
function TrustCarousel() {
  const [scrollPos, setScrollPos] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setScrollPos((prev) => {
        const next = prev + 1;
        // Reset after full scroll
        if (containerRef.current) {
          const maxScroll = containerRef.current.scrollWidth - containerRef.current.clientWidth;
          if (next > maxScroll) return 0;
        }
        return next;
      });
    }, 30);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="border-y border-border bg-muted/30 overflow-hidden">
      <div
        ref={containerRef}
        className="py-6 overflow-hidden"
      >
        <div
          className="flex gap-12 whitespace-nowrap transition-transform duration-75 ease-linear"
          style={{ transform: `translateX(-${scrollPos}px)` }}
        >
          {[...socialProof, ...socialProof, ...socialProof].map((item, i) => (
            <div
              key={i}
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground"
            >
              <CheckCircle className="h-4 w-4 text-secondary flex-shrink-0" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-secondary/5" />
          <div className="container mx-auto px-4 py-20 md:py-32 relative">
            <div className="max-w-4xl mx-auto text-center">
              <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
                Master Your Pitch with{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">
                  AI Coaching
                </span>
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
                Get expert-level feedback on your pitch deck, script, and delivery.
                Track your improvement with before-and-after analysis.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <SignedOut>
                  <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                    <Link href="/sign-up">
                      Get started free
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="lg">
                    <Link href="#how-it-works">See how it works</Link>
                  </Button>
                </SignedOut>
                <SignedIn>
                  <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                    <Link href="/dashboard">
                      Go to Dashboard
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </SignedIn>
              </div>
            </div>
          </div>
        </section>

        {/* Trust Carousel */}
        <TrustCarousel />

        {/* How It Works (with light beam animation) */}
        <HowItWorksSection />

        {/* Products — Choose Your Coaching Journey */}
        <section id="products" className="py-20 md:py-32 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Choose Your Coaching Journey</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Select the coaching module that fits your needs — from pitch deck analysis to full founder coaching.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map((product) => (
                <Card
                  key={product.id}
                  className={`relative flex flex-col ${
                    product.featured
                      ? "border-2 border-primary shadow-lg shadow-primary/10"
                      : ""
                  }`}
                >
                  {product.featured && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                        Recommended Start
                      </span>
                    </div>
                  )}
                  <CardHeader className="items-center text-center">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 mx-auto">
                      <product.icon className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle>{product.name}</CardTitle>
                    <CardDescription>{product.description}</CardDescription>
                  </CardHeader>
                  <CardFooter className="flex-1 items-center justify-center">
                    <SignedOut>
                      <Button
                        asChild
                        className={`w-full ${product.featured ? "bg-primary hover:bg-primary/90" : ""}`}
                        variant={product.featured ? "default" : "outline"}
                      >
                        <Link href="/sign-up">
                          Get Started
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    </SignedOut>
                    <SignedIn>
                      <Button
                        asChild
                        className={`w-full ${product.featured ? "bg-primary hover:bg-primary/90" : ""}`}
                        variant={product.featured ? "default" : "outline"}
                      >
                        <Link href={product.href}>
                          View Details
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    </SignedIn>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 md:py-32">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Ready to Perfect Your Pitch?
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                Join thousands of founders who have improved their pitch with AI-powered coaching.
              </p>
              <SignedOut>
                <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  <Link href="/sign-up">
                    Get started now
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </SignedOut>
              <SignedIn>
                <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  <Link href="/dashboard">
                    Go to Dashboard
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </SignedIn>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
