"use client";

import { useState, useEffect } from "react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent } from "@/components/ui/card";
import { Check, Sparkles } from "lucide-react";

// ── Pricing tiers (base prices in NGN — ALL one-time payments) ────────────
const TIERS = [
  {
    name: "JJC",
    tagline: "Just getting started",
    priceNGN: 0,
    isFree: true,
    isOneTime: true,
    features: [
      "2 pitch deck analyses",
      "2 script check sessions",
      "Basic AI feedback",
      "Community access",
      "Email support",
    ],
    cta: "Start Free",
    popular: false,
  },
  {
    name: "Intern",
    tagline: "Building your first pitch",
    priceNGN: 9000,
    isFree: false,
    isOneTime: true,
    features: [
      "10 pitch deck analyses",
      "10 script check sessions",
      "Detailed AI feedback with scores",
      "Pitch deck visual audit",
      "Script rewriting suggestions",
      "Priority email support",
    ],
    cta: "Get Intern",
    popular: false,
  },
  {
    name: "Cofounder",
    tagline: "Serious about raising",
    priceNGN: 15000,
    isFree: false,
    isOneTime: true,
    features: [
      "25 pitch deck analyses",
      "25 script check sessions",
      "5 live pitch video analyses",
      "Full pitch session (30-min video)",
      "Investor readiness scoring",
      "Anticipated Q&A preparation",
      "Priority support",
    ],
    cta: "Get Cofounder",
    popular: true,
  },
  {
    name: "Founder",
    tagline: "Ready to close the round",
    priceNGN: 30000,
    isFree: false,
    isOneTime: true,
    features: [
      "Unlimited pitch deck analyses",
      "Unlimited script check sessions",
      "Unlimited live pitch analyses",
      "5 full pitch sessions",
      "Founder coaching modules",
      "Investor research tools",
      "Cohort matching",
      "Pathway recommendations",
      "Dedicated support",
    ],
    cta: "Get Founder",
    popular: false,
  },
];

// ── Currency conversion rates (relative to NGN) ───────────────────────────
// These are approximate rates. In production, fetch from an API.
const CURRENCIES = {
  NGN: { symbol: "₦", rate: 1, name: "Naira" },
  USD: { symbol: "$", rate: 1 / 1500, name: "USD" }, // ~1500 NGN = 1 USD
  EUR: { symbol: "€", rate: 1 / 1650, name: "EUR" },
  GBP: { symbol: "£", rate: 1 / 1900, name: "GBP" },
  GHS: { symbol: "₵", rate: 1 / 120, name: "Cedis" },
  KES: { symbol: "KSh", rate: 1 / 11.5, name: "Shilling" },
  ZAR: { symbol: "R", rate: 1 / 82, name: "Rand" },
  CAD: { symbol: "C$", rate: 1 / 1100, name: "CAD" },
  AUD: { symbol: "A$", rate: 1 / 1000, name: "AUD" },
};

// Map country codes to currencies
const COUNTRY_CURRENCY: Record<string, keyof typeof CURRENCIES> = {
  NG: "NGN", // Nigeria
  US: "USD", CA: "CAD", GB: "GBP", EU: "EUR",
  DE: "EUR", FR: "EUR", ES: "EUR", IT: "EUR", NL: "EUR",
  GH: "GHS", // Ghana
  KE: "KES", // Kenya
  ZA: "ZAR", // South Africa (but geo-blocked)
  AU: "AUD",
};

function formatPrice(ngnPrice: number, currency: keyof typeof CURRENCIES): string {
  if (ngnPrice === 0) return "Free";
  const c = CURRENCIES[currency];
  const converted = Math.round(ngnPrice * c.rate);
  if (currency === "NGN") {
    return `${c.symbol}${converted.toLocaleString()}`;
  }
  // Round to nearest reasonable value for non-NGN
  if (currency === "USD" || currency === "EUR" || currency === "GBP") {
    return `${c.symbol}${converted}`;
  }
  return `${c.symbol}${converted.toLocaleString()}`;
}

export default function PricingPage() {
  const [currency, setCurrency] = useState<keyof typeof CURRENCIES>("NGN");
  const [detectedCountry, setDetectedCountry] = useState<string>("");
  const [carouselIndex, setCarouselIndex] = useState(0);

  // Trust carousel items
  const trustItems = [
    "Used by startup founders, learning institutions and Y Combinator Applicants",
    "Trusted by 500+ Entrepreneurs",
    "Powered by Cloudflare Workers AI",
    "NDPR Compliant — Built in Nigeria",
  ];

  useEffect(() => {
    // Auto-scroll carousel every 3 seconds
    const interval = setInterval(() => {
      setCarouselIndex((prev) => (prev + 1) % trustItems.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [trustItems.length]);

  useEffect(() => {
    // Detect user's country via Vercel geolocation header
    // On Vercel, x-vercel-ip-country is set automatically
    fetch("/api/health", { method: "GET" })
      .then(() => {
        // We can't read response headers from fetch due to CORS in some cases
        // So we use a dedicated endpoint approach — fall back to NGN
        // In production, middleware sets the country header and we read it here
      })
      .catch(() => {});

    // Try to detect country from the browser's timezone as a fallback
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) {
      const country = tz.split("/")[0];
      setDetectedCountry(country);
      const curr = COUNTRY_CURRENCY[country] || "NGN";
      setCurrency(curr);
    }
  }, []);

  const handleCurrencyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCurrency(e.target.value as keyof typeof CURRENCIES);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-16 max-w-6xl">
        {/* Trust carousel */}
        <div className="text-center mb-8 overflow-hidden">
          <div
            className="inline-block transition-transform duration-500 ease-in-out"
            style={{ transform: `translateY(-${carouselIndex * 2}rem)` }}
          >
            {trustItems.map((item, i) => (
              <div
                key={i}
                className="h-8 flex items-center justify-center text-sm font-medium text-muted-foreground"
              >
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-4">Simple, Transparent Pricing</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Choose the plan that fits your stage. All plans are one-time payments — no recurring charges.
          </p>
        </div>


        {/* FAQ section */}
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-semibold text-foreground mb-6 text-center">
            Frequently Asked Questions
          </h2>
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold text-foreground mb-1">
                  What does "one-time" payment mean?
                </h3>
                <p className="text-sm text-muted-foreground">
                  All paid plans (Intern, Cofounder, Founder) are one-time payments (or local equivalent). You pay
                  once and get lifetime access to all features. No recurring charges.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold text-foreground mb-1">
                  Can I change my plan later?
                </h3>
                <p className="text-sm text-muted-foreground">
                  Yes. You can upgrade or downgrade your subscription at any time. Changes take
                  effect immediately and we prorate the difference.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold text-foreground mb-1">
                  Do you offer refunds?
                </h3>
                <p className="text-sm text-muted-foreground">
                  We offer a 7-day money-back guarantee on all paid plans. If you are not satisfied,
                  contact us at Metron@Athenagentic.app for a full refund.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold text-foreground mb-1">
                  Why are prices in Naira?
                </h3>
                <p className="text-sm text-muted-foreground">
                  We are based in Nigeria and price primarily in Naira. International users can
                  view prices in their local currency using the selector above. Payment is processed
                  in your local currency via Stripe or Paystack.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Contact CTA */}
        <div className="text-center mt-12">
          <p className="text-muted-foreground mb-4">Have more questions?</p>
          <a
            href="/contact"
            className="inline-block bg-primary text-primary-foreground px-6 py-3 rounded-md font-semibold hover:bg-primary/90 transition-colors"
          >
            Contact Us
          </a>
        </div>
      </div>
      <Footer />
    </div>
  );
}
