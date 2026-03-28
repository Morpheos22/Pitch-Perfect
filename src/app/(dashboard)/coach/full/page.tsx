"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  ArrowLeft,
  Presentation,
  Video,
  MessageSquare,
} from "lucide-react";
import Link from "next/link";

const products = [
  {
    title: "Pitch Deck Analyser",
    description: "Comprehensive deck analysis for content and visual quality",
    icon: Presentation,
    href: "/pitch-deck-analyser/new",
    color: "text-primary",
  },
  {
    title: "Elevator Script",
    description: "Perfect your elevator pitch with AI-powered script analysis",
    icon: MessageSquare,
    href: "/elevator-script/new",
    color: "text-accent",
  },
  {
    title: "Live Pitch Coach",
    description: "Record a 3-minute pitch for delivery and body language feedback",
    icon: Video,
    href: "/elevator-pitch-live/new",
    color: "text-orange-500",
  },
];

export default function CoachFullPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-emerald-500" />
            Full Pitch Session
          </h1>
          <p className="text-muted-foreground">
            Complete 30-minute session with deck and video analysis (M4)
          </p>
        </div>
      </div>

      {/* Coming Soon */}
      <Card className="border-emerald-500/20 bg-emerald-500/5">
        <CardContent className="py-12 text-center">
          <Badge variant="secondary" className="mb-4">Coming Soon</Badge>
          <h2 className="text-2xl font-bold mb-2">Full Pitch Session</h2>
          <p className="text-muted-foreground max-w-md mx-auto mb-6">
            The complete 30-minute deep dive combining deck analysis and video 
            for full investor readiness assessment is coming soon.
          </p>
          <div className="flex justify-center gap-4">
            <Link href="/pitch-deck-analyser/new">
              <Button variant="outline">Start with Deck Analysis</Button>
            </Link>
            <Link href="/elevator-pitch-live/new">
              <Button className="bg-emerald-500 hover:bg-emerald-500/90">
                Start with Live Pitch
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Available Products */}
      <div className="grid md:grid-cols-3 gap-4">
        {products.map((product) => (
          <Link key={product.title} href={product.href}>
            <Card className="hover:shadow-md transition-shadow h-full">
              <CardContent className="py-6">
                <product.icon className={`w-8 h-8 ${product.color} mb-4`} />
                <h3 className="font-semibold mb-1">{product.title}</h3>
                <p className="text-sm text-muted-foreground">{product.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
