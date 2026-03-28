"use client";

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

const howItWorksSteps = [
  {
    icon: Upload,
    title: "Upload",
    description: "Upload your pitch deck, script, or record yourself delivering your pitch.",
    step: 1,
  },
  {
    icon: Brain,
    title: "AI Analyses",
    description: "Our AI analyzes your content against proven frameworks and best practices.",
    step: 2,
  },
  {
    icon: FileText,
    title: "Review Report",
    description: "Get detailed scores, feedback, and actionable recommendations.",
    step: 3,
  },
  {
    icon: TrendingUp,
    title: "Improve",
    description: "Revise based on feedback and submit again to track your improvement.",
    step: 4,
  },
];

const products = [
  {
    id: "pitch-deck",
    icon: Presentation,
    name: "Pitch Deck Analyser",
    description: "Get your deck scored against the 10-slide framework with visual design audit.",
    modules: ["M1: Deck Analysis × 2 cycles"],
    price: "From $15",
    featured: true,
    href: "/pricing#pitch-deck",
  },
  {
    id: "elevator-script",
    icon: MessageSquare,
    name: "Elevator Pitch Script Check",
    description: "Submit your script for element-by-element feedback and rewrite suggestions.",
    modules: ["M2: Script Coaching × 2 cycles"],
    price: "From $10",
    featured: false,
    href: "/pricing#elevator-script",
  },
  {
    id: "elevator-live",
    icon: Video,
    name: "Elevator Pitch Live",
    description: "Script coaching plus live recording practice with delivery feedback.",
    modules: ["M2: Script × 2", "M3: Live Recording × 3"],
    price: "From $25",
    featured: false,
    href: "/pricing#elevator-live",
  },
  {
    id: "pitch-live",
    icon: BarChart3,
    name: "Pitch Deck Live",
    description: "Deck analysis plus full 30-minute presentation recording and coaching.",
    modules: ["M1: Deck × 2", "M4: Full Pitch × 1"],
    price: "From $40",
    featured: false,
    href: "/pricing#pitch-live",
  },
  {
    id: "master",
    icon: Zap,
    name: "Master Pitch Analyser",
    description: "Complete coaching: deck, script, live delivery, and full presentation.",
    modules: ["All modules included"],
    price: "From $60",
    featured: false,
    href: "/pricing#master",
  },
];

const socialProof = [
  "Used by founders from Y Combinator, Techstars & 500 Startups",
  "Trusted by 1000+ entrepreneurs worldwide",
  "Average score improvement of 23 points after 2 cycles",
];

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#4ECDC4]/10 via-background to-[#FF6B6B]/5" />
          <div className="container mx-auto px-4 py-20 md:py-32 relative">
            <div className="max-w-4xl mx-auto text-center">
              <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 font-heading">
                Master Your Pitch with{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#4ECDC4] to-[#3AB8B0]">
                  AI Coaching
                </span>
              </h1>
              <p className="text-lg md:text-xl text-[#718096] mb-8 max-w-2xl mx-auto">
                Get expert-level feedback on your pitch deck, script, and delivery. 
                Track your improvement with before-and-after analysis.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <SignedOut>
                  <Button asChild size="lg" className="bg-[#FF6B6B] hover:bg-[#E85555] text-white">
                    <Link href="/sign-up">
                      Get started free
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="lg" className="border-[#4ECDC4] text-[#2D3748] hover:bg-[#4ECDC4]/10">
                    <Link href="#how-it-works">See how it works</Link>
                  </Button>
                </SignedOut>
                <SignedIn>
                  <Button asChild size="lg" className="bg-[#FF6B6B] hover:bg-[#E85555] text-white">
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

        {/* Social Proof */}
        <section className="border-y border-[#E2E8F0] bg-[#F7FAFA]">
          <div className="container mx-auto px-4 py-6">
            <div className="flex flex-wrap justify-center gap-6 md:gap-12 text-sm text-[#718096]">
              {socialProof.map((proof, index) => (
                <div key={index} className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-[#4ECDC4]" />
                  <span>{proof}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="py-20 md:py-32">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 font-heading text-[#2D3748]">How It Works</h2>
              <p className="text-[#718096] max-w-2xl mx-auto">
                Four simple steps to transform your pitch from good to great.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              {howItWorksSteps.map((step, index) => (
                <div key={step.title} className="relative">
                  <div className="flex flex-col items-center text-center">
                    <div className="w-16 h-16 rounded-2xl bg-[#4ECDC4]/10 flex items-center justify-center mb-4">
                      <step.icon className="h-8 w-8 text-[#4ECDC4]" />
                    </div>
                    <div className="absolute top-8 left-1/2 w-full h-0.5 bg-[#E2E8F0] -translate-y-1/2 -z-10 hidden md:block last:hidden" 
                         style={{ left: index === 3 ? 'auto' : '50%', width: index === 3 ? '0' : '100%' }} />
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-xs font-bold text-white bg-[#FF6B6B] px-2.5 py-1 rounded-full">
                      {step.step}
                    </span>
                    <h3 className="text-xl font-semibold mb-2 text-[#2D3748] font-heading">{step.title}</h3>
                    <p className="text-sm text-[#718096]">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Products */}
        <section id="products" className="py-20 md:py-32 bg-[#F7FAFA]">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 font-heading text-[#2D3748]">Choose Your Coaching Journey</h2>
              <p className="text-[#718096] max-w-2xl mx-auto">
                Every product includes two full cycles — submit, get feedback, improve, submit again.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map((product) => (
                <Card 
                  key={product.id}
                  className={`relative flex flex-col ${
                    product.featured 
                      ? "border-2 border-[#4ECDC4] shadow-lg shadow-[#4ECDC4]/10" 
                      : "border border-[#E2E8F0]"
                  }`}
                >
                  {product.featured && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-[#4ECDC4] text-[#2D3748] text-xs font-semibold px-3 py-1 rounded-full">
                        Recommended Start
                      </span>
                    </div>
                  )}
                  <CardHeader>
                    <div className="w-12 h-12 rounded-xl bg-[#4ECDC4]/10 flex items-center justify-center mb-4">
                      <product.icon className="h-6 w-6 text-[#4ECDC4]" />
                    </div>
                    <CardTitle className="text-[#2D3748] font-heading">{product.name}</CardTitle>
                    <CardDescription className="text-[#718096]">{product.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <div className="space-y-2">
                      {product.modules.map((module) => (
                        <div key={module} className="flex items-center gap-2 text-sm">
                          <CheckCircle className="h-4 w-4 text-[#4ECDC4]" />
                          <span className="text-[#2D3748]">{module}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button 
                      asChild 
                      className={`w-full ${product.featured ? "bg-[#FF6B6B] hover:bg-[#E85555] text-white" : "bg-transparent border border-[#FF6B6B] text-[#FF6B6B] hover:bg-[#FF6B6B]/10"}`}
                      variant={product.featured ? "default" : "outline"}
                    >
                      <Link href={product.href}>
                        {product.price}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
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
              <h2 className="text-3xl md:text-4xl font-bold mb-4 font-heading text-[#2D3748]">
                Ready to Perfect Your Pitch?
              </h2>
              <p className="text-lg text-[#718096] mb-8">
                Join thousands of founders who have improved their pitch with AI-powered coaching.
              </p>
              <SignedOut>
                <Button asChild size="lg" className="bg-[#FF6B6B] hover:bg-[#E85555] text-white">
                  <Link href="/sign-up">
                    Get started now
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </SignedOut>
              <SignedIn>
                <Button asChild size="lg" className="bg-[#FF6B6B] hover:bg-[#E85555] text-white">
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
