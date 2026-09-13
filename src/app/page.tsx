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

// ── Metron quotes (random order on hover) ─────────────────────────────────
const metronQuotes = [
  "I serve life in my own way! What there is to know — I wish to know! My knowledge is my power! Time and space is my domain!",
  "Your primitive comprehension of linear time limits you. I am already looking at the ashes of your tomorrow.",
  "I do not guess. I do not imagine. I record.",
  "Knowledge is neither a weapon for peace nor an instrument of war. It simply is.",
  "There is a final secret to the cosmos. A calculation that maps the consciousness of all sentient life. To know it is to hold the ultimate key.",
  "I am bound to no one! I am the seeker, the voyager! The universe is my laboratory! I must observe its mysteries, not fight its petty wars!",
  "To understand the universe, one must be willing to stand apart from it. Good and evil are merely viewpoints of lesser beings.",
  "Time is a circle, yes. But it is a circle that grows smaller with every epoch. Eventually, all things return to the point.",
  "Before the first word was spoken in this multiverse, the silence was absolute. I am the only one who still remembers the sound of that silence.",
];

// ── Light Beam Animation Component ────────────────────────────────────────
function HowItWorksSection() {
  const [hoveredStep, setHoveredStep] = useState<number | null>(null);
  const [beamProgress, setBeamProgress] = useState(0);
  const [isBeaming, setIsBeaming] = useState(false);
  const beamTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleStepHover = (index: number) => {
    setHoveredStep(index);
    if (index === 0 && !isBeaming) {
      setIsBeaming(true);
      setBeamProgress(0);

      // Animate beam from step 1 → step 4 → back
      const animate = () => {
        setBeamProgress((prev) => {
          if (prev < 100) {
            return prev + 2;
          }
          // Reverse animation
          if (prev === 100) {
            setTimeout(() => {
              setBeamProgress((prev2) => {
                if (prev2 > 0) return prev2 - 2;
                setIsBeaming(false);
                return 0;
              });
              if (beamTimeoutRef.current) clearTimeout(beamTimeoutRef.current);
            }, 300);
          }
          return prev;
        });
      };

      beamTimeoutRef.current = setInterval(animate, 20);
    }
  };

  const handleStepLeave = () => {
    setHoveredStep(null);
    if (beamTimeoutRef.current) {
      clearInterval(beamTimeoutRef.current);
      beamTimeoutRef.current = null;
    }
    setIsBeaming(false);
    setBeamProgress(0);
  };

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
          <div className="absolute top-8 left-0 right-0 h-1 hidden md:block pointer-events-none">
            <div
              className="h-full rounded-full transition-all duration-75 ease-linear"
              style={{
                background: isBeaming
                  ? `linear-gradient(to right, var(--primary) 0%, var(--secondary) ${beamProgress}%, transparent ${beamProgress}%)`
                  : "var(--border)",
                boxShadow: isBeaming
                  ? `0 0 20px var(--primary), 0 0 40px var(--secondary)`
                  : "none",
                width: "100%",
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
                    hoveredStep === index || (isBeaming && Math.round(beamProgress / 100 * 3) === index)
                      ? "bg-primary scale-110 shadow-lg shadow-primary/30"
                      : "bg-primary/10"
                  }`}
                >
                  <step.icon
                    className={`h-8 w-8 transition-colors duration-300 ${
                      hoveredStep === index || (isBeaming && Math.round(beamProgress / 100 * 3) === index)
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

// ── Athena Agentic Mouse-Avoiding Component ───────────────────────────────
function AthenaAgenticLink() {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const [isGlowing, setIsGlowing] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = e.clientX - centerX;
    const dy = e.clientY - centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // If mouse is close, move away
    if (dist < 120) {
      const angle = Math.atan2(dy, dx);
      const moveDist = (120 - dist) * 0.6;
      setPos({
        x: -Math.cos(angle) * moveDist,
        y: -Math.sin(angle) * moveDist,
      });
      setIsGlowing(true);
    } else {
      setPos({ x: 0, y: 0 });
      setIsGlowing(false);
    }
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setPos({ x: 0, y: 0 });
    setIsGlowing(false);
  };

  return (
    <div
      className="relative inline-block"
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ padding: "20px", margin: "-20px" }}
    >
      <span
        ref={containerRef}
        className="inline-block font-bold text-secondary transition-all duration-200 ease-out cursor-pointer select-none"
        style={{
          transform: `translate(${pos.x}px, ${pos.y}px)`,
          textShadow: isGlowing
            ? `0 0 10px var(--secondary), 0 0 20px var(--primary), 0 0 30px var(--primary), 0 0 40px var(--primary)`
            : "none",
          filter: isGlowing ? "brightness(1.5)" : "none",
        }}
      >
        Athena Agentic
      </span>
    </div>
  );
}

// ── Metron Email with Hover Quotes ────────────────────────────────────────
function MetronEmailLink() {
  const [showQuote, setShowQuote] = useState(false);
  const [currentQuote, setCurrentQuote] = useState(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = () => {
    setShowQuote(true);
    // Pick a random quote
    setCurrentQuote(Math.floor(Math.random() * metronQuotes.length));
  };

  const handleMouseLeave = () => {
    setShowQuote(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  return (
    <div className="relative inline-block">
      <a
        href="mailto:Metron@Athenagentic.app"
        className="text-sm text-muted-foreground hover:text-primary transition-colors"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        Metron@Athenagentic.app
      </a>
      {showQuote && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 p-4 max-w-md min-w-[300px] text-center pointer-events-none">
          <p
            className="italic text-sm leading-relaxed text-secondary/80 animate-in fade-in duration-500"
            style={{ fontFamily: "Georgia, serif" }}
          >
            "{metronQuotes[currentQuote]}"
          </p>
        </div>
      )}
    </div>
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
                Every product includes two full cycles — submit, get feedback, improve, submit again.
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

      {/* Custom Footer with Athena Agentic animation + Metron quotes */}
      <footer className="border-t border-border bg-muted/30">
        <div className="container mx-auto px-4 py-12">
          <div className="flex flex-col items-center justify-center gap-6 text-center">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} PitchCoach Ai. All rights reserved.
            </p>
            <div className="flex items-center gap-3">
              <span className="text-xs uppercase tracking-widest text-muted-foreground font-bold">
                Developed By
              </span>
              <AthenaAgenticLink />
            </div>
            {/* Metron email with hover quotes */}
            <div className="relative min-h-[2rem] flex items-center justify-center">
              <MetronEmailLink />
            </div>
            <div className="flex items-center gap-2 mt-2">
              <img
                src="/logo.png"
                alt="PitchCoach Ai"
                width={120}
                height={36}
                className="h-9 w-auto"
                draggable={false}
                onContextMenu={(e) => e.preventDefault()}
              />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
