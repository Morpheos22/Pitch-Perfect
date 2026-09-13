"use client";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent } from "@/components/ui/card";
import { Target, Rocket, Heart, Zap, Users, TrendingUp } from "lucide-react";

const values = [
  {
    icon: Target,
    title: "Precision Coaching",
    description:
      "We believe every founder deserves access to world-class pitch coaching, not just those with connections to elite accelerators.",
  },
  {
    icon: Rocket,
    title: "Founder-First",
    description:
      "We built PitchCoach Ai for founders, by founders. Every feature is designed to help you raise capital and tell your story better.",
  },
  {
    icon: Heart,
    title: "Accessible to All",
    description:
      "We offer pricing in Naira with global currency conversion, so founders in Nigeria and across Africa can access coaching at fair rates.",
  },
  {
    icon: Zap,
    title: "AI-Powered",
    description:
      "We use Cloudflare Workers AI (Llama models) to deliver instant, data-driven feedback on your pitch — available 24/7.",
  },
  {
    icon: Users,
    title: "Community-Driven",
    description:
      "We are building a community of founders who support each other. Our platform connects you with peers and potential cofounders.",
  },
  {
    icon: TrendingUp,
    title: "Measurable Growth",
    description:
      "We track your progress with scores and metrics, so you can see exactly how your pitch improves over time.",
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <h1 className="text-4xl font-bold text-foreground mb-4">About PitchCoach Ai</h1>
        <p className="text-xl text-muted-foreground mb-8">
          AI-powered pitch coaching for founders, by founders.
        </p>

        <div className="prose prose-lg max-w-none space-y-6 text-muted-foreground mb-12">
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">Our Story</h2>
            <p>
              PitchCoach Ai was born from a simple observation: most founders struggle to
              articulate their vision clearly, yet access to professional pitch coaching is
              expensive and limited to those in elite startup ecosystems. We wanted to change that.
            </p>
            <p>
              Built by Athena Agentic in Lagos, Nigeria, PitchCoach Ai uses cutting-edge AI to
              deliver instant, actionable feedback on pitch decks, scripts, and live delivery.
              Whether you are preparing for a seed round, a demo day, or your first investor
              meeting, we help you put your best foot forward.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">Our Mission</h2>
            <p>
              We are on a mission to democratize access to world-class pitch coaching for founders
              across Nigeria, Africa, and the world. We believe that a great pitch should not
              depend on your connections or your budget — it should depend on the quality of your
              idea and your ability to communicate it.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">What We Offer</h2>
            <p>
              PitchCoach Ai provides five core coaching modules, each powered by AI:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong>Pitch Deck Analyser:</strong> Upload your deck and get instant feedback on content, design, and investor readiness.</li>
              <li><strong>Script Check:</strong> Refine your elevator pitch with AI-powered script analysis and rewriting.</li>
              <li><strong>Live Pitch:</strong> Record a short video and get feedback on delivery, pace, body language, and more.</li>
              <li><strong>Full Pitch Session:</strong> Submit a 30-minute video + deck for comprehensive investor readiness analysis.</li>
              <li><strong>Founder Coaching:</strong> Get personalized coaching on founder readiness, pathway recommendations, and investor research.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">Our Technology</h2>
            <p>
              We use Cloudflare Workers AI — powered by Meta's Llama models — to analyze your
              content. Our AI provides detailed, structured feedback across multiple dimensions,
              including content clarity, visual design, delivery effectiveness, and investor
              readiness. All processing is done securely, and your data is never shared with third
              parties.
            </p>
          </section>
        </div>

        <h2 className="text-2xl font-semibold text-foreground mb-6">Our Values</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {values.map((item) => (
            <Card key={item.title}>
              <CardContent className="p-6">
                <item.icon className="w-8 h-8 text-primary mb-3" />
                <h3 className="font-semibold text-foreground mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="bg-muted p-6 rounded-lg">
          <h2 className="text-2xl font-semibold text-foreground mb-3">Contact Us</h2>
          <p className="text-muted-foreground mb-2">
            We would love to hear from you. Whether you have feedback, questions, or partnership
            ideas, reach out to us:
          </p>
          <div className="space-y-1">
            <p className="text-foreground font-semibold">PitchCoach Ai (Athena Agentic)</p>
            <p className="text-muted-foreground">Location: Lagos, Nigeria</p>
            <p className="text-muted-foreground">Email: Metron@Athenagentic.app</p>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
