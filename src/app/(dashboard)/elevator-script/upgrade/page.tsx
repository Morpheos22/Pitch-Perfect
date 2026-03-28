"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare,
  ArrowLeft,
  Check,
  Sparkles,
  Zap,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";

const upgradeOptions = [
  {
    id: "single",
    title: "Single Script Analysis",
    description: "Add one more script analysis to your plan",
    price: 15,
    features: [
      "1 additional script analysis",
      "5-element scoring",
      "AI rewrites",
      "Tone analysis",
    ],
    popular: false,
  },
  {
    id: "pack-5",
    title: "5-Script Pack",
    description: "Perfect for iterating on multiple versions",
    price: 59,
    originalPrice: 75,
    features: [
      "5 additional script analyses",
      "5-element scoring",
      "AI rewrites",
      "Tone analysis",
      "Version comparison",
      "Save 21%",
    ],
    popular: true,
  },
  {
    id: "pack-10",
    title: "10-Script Pack",
    description: "Maximum iterations for serious pitch prep",
    price: 99,
    originalPrice: 150,
    features: [
      "10 additional script analyses",
      "5-element scoring",
      "AI rewrites",
      "Tone analysis",
      "Version comparison",
      "Priority support",
      "Save 34%",
    ],
    popular: false,
  },
];

export default function ScriptUpgradePage() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/elevator-script/session/demo">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-accent" />
            Add Script Analyses
          </h1>
          <p className="text-muted-foreground">
            Get more iterations to perfect your elevator pitch
          </p>
        </div>
      </div>

      {/* Current Status */}
      <Card className="bg-muted/30">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Zap className="w-5 h-5 text-accent" />
              <div>
                <p className="font-medium">Current Plan: Pro</p>
                <p className="text-sm text-muted-foreground">
                  You have 2 script analyses remaining this month
                </p>
              </div>
            </div>
            <Badge variant="secondary">2 left</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Upgrade Options */}
      <div className="grid md:grid-cols-3 gap-6">
        {upgradeOptions.map((option) => (
          <Card
            key={option.id}
            className={`relative ${
              option.popular ? "ring-2 ring-accent shadow-lg" : ""
            }`}
          >
            {option.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge className="bg-accent text-accent-foreground">Most Popular</Badge>
              </div>
            )}
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-lg">{option.title}</CardTitle>
              <CardDescription>{option.description}</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Price */}
              <div className="text-center mb-4">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-3xl font-bold">${option.price}</span>
                  {option.originalPrice && (
                    <span className="text-lg text-muted-foreground line-through">
                      ${option.originalPrice}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">one-time purchase</p>
              </div>

              {/* Features */}
              <ul className="space-y-2 mb-6">
                {option.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                    <span className="text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <Link href="/sign-up">
                <Button
                  className={`w-full ${option.popular ? "bg-accent hover:bg-accent/90" : ""}`}
                  variant={option.popular ? "default" : "outline"}
                >
                  Get {option.title}
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Alternative: Full Upgrade */}
      <Card className="bg-gradient-to-br from-accent/10 to-primary/10 border-accent/20">
        <CardContent className="py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-accent to-primary flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Upgrade to Master Pitch Analyser</h3>
                <p className="text-sm text-muted-foreground">
                  Get unlimited access to all modules
                </p>
              </div>
            </div>
            <div className="text-center md:text-right">
              <p className="text-2xl font-bold">$349</p>
              <p className="text-xs text-muted-foreground">one-time</p>
              <Link href="/pricing">
                <Button className="mt-2 bg-primary hover:bg-primary/90" size="sm">
                  Learn More
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
