"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Video,
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
    title: "Single Live Session",
    description: "Add one more live recording session",
    price: 29,
    features: [
      "1 additional live session",
      "Video or audio recording",
      "Delivery analysis",
      "Body language feedback",
    ],
    popular: false,
  },
  {
    id: "pack-3",
    title: "3-Session Pack",
    description: "Perfect for practice and iteration",
    price: 75,
    originalPrice: 87,
    features: [
      "3 additional live sessions",
      "Video or audio recording",
      "Delivery analysis",
      "Body language feedback",
      "Progress tracking",
      "Save 14%",
    ],
    popular: true,
  },
  {
    id: "pack-5",
    title: "5-Session Pack",
    description: "Maximum practice for demo day prep",
    price: 119,
    originalPrice: 145,
    features: [
      "5 additional live sessions",
      "Video or audio recording",
      "Full delivery analysis",
      "Priority support",
      "Progress tracking",
      "Save 18%",
    ],
    popular: false,
  },
];

export default function LiveUpgradePage() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/elevator-pitch-live/new">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Video className="w-6 h-6 text-orange-500" />
            Add Live Sessions
          </h1>
          <p className="text-muted-foreground">
            Get more practice sessions to perfect your delivery
          </p>
        </div>
      </div>

      {/* Current Status */}
      <Card className="bg-muted/30">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Zap className="w-5 h-5 text-orange-500" />
              <div>
                <p className="font-medium">Current Plan: Pro</p>
                <p className="text-sm text-muted-foreground">
                  You have 3 live sessions remaining this month
                </p>
              </div>
            </div>
            <Badge variant="secondary">3 left</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Upgrade Options */}
      <div className="grid md:grid-cols-3 gap-6">
        {upgradeOptions.map((option) => (
          <Card
            key={option.id}
            className={`relative ${
              option.popular ? "ring-2 ring-orange-500 shadow-lg" : ""
            }`}
          >
            {option.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge className="bg-orange-500 text-white">Most Popular</Badge>
              </div>
            )}
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-lg">{option.title}</CardTitle>
              <CardDescription>{option.description}</CardDescription>
            </CardHeader>
            <CardContent>
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

              <ul className="space-y-2 mb-6">
                {option.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
                    <span className="text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              <Link href="/sign-up">
                <Button
                  className={`w-full ${option.popular ? "bg-orange-500 hover:bg-orange-500/90" : ""}`}
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
      <Card className="bg-gradient-to-br from-orange-500/10 to-primary/10 border-orange-500/20">
        <CardContent className="py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-primary flex items-center justify-center">
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
