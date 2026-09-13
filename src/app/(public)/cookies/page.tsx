"use client";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent } from "@/components/ui/card";
import { Cookie, Settings, BarChart, Shield, Clock } from "lucide-react";

const cookieTypes = [
  {
    icon: Shield,
    title: "Essential Cookies",
    description:
      "Required for the website to function properly. These cookies enable core functionality such as security, authentication, and account access.",
    examples: ["Authentication tokens", "Session management", "Security preferences"],
    canDisable: false,
  },
  {
    icon: Settings,
    title: "Functional Cookies",
    description:
      "Enable enhanced functionality and personalization, such as remembering your preferences and settings.",
    examples: ["Theme preferences", "Language settings", "Feature toggles"],
    canDisable: true,
  },
  {
    icon: BarChart,
    title: "Analytics Cookies",
    description:
      "Help us understand how visitors interact with our website by collecting and reporting information anonymously.",
    examples: ["Page views", "User journey tracking", "Error logging"],
    canDisable: true,
  },
];

const cookiesTable = [
  {
    name: "__session",
    provider: "Clerk",
    purpose: "Authentication session token",
    type: "Essential",
    expiry: "Session",
  },
  {
    name: "__clerk_db_jwt",
    provider: "Clerk",
    purpose: "JWT token for authentication",
    type: "Essential",
    expiry: "1 year",
  },
  {
    name: "theme",
    provider: "PitchCoach Ai",
    purpose: "Stores theme preference (light/dark)",
    type: "Functional",
    expiry: "1 year",
  },
  {
    name: "_ga",
    provider: "Google Analytics",
    purpose: "Distinguishes unique users",
    type: "Analytics",
    expiry: "2 years",
  },
  {
    name: "_ga_*",
    provider: "Google Analytics",
    purpose: "Maintains session state",
    type: "Analytics",
    expiry: "2 years",
  },
];

export default function CookiesPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-secondary/5" />
          <div className="container mx-auto px-4 py-20 md:py-32 relative">
            <div className="max-w-4xl mx-auto text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <Cookie className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
                Cookie{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">
                  Policy
                </span>
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
                This policy explains how we use cookies and similar technologies
                on PitchCoach Ai.
              </p>
              <p className="text-sm text-muted-foreground mt-4">
                Last updated: January 2025
              </p>
            </div>
          </div>
        </section>

        {/* What are Cookies */}
        <section className="py-20 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold mb-4">What Are Cookies?</h2>
              <p className="text-muted-foreground mb-4">
                Cookies are small text files that are stored on your device when
                you visit a website. They are widely used to make websites work
                more efficiently and provide information to website owners.
              </p>
              <p className="text-muted-foreground">
                Cookies can be "persistent" or "session" cookies. Persistent
                cookies remain on your device for a set period or until you
                delete them. Session cookies are deleted when you close your web
                browser.
              </p>
            </div>
          </div>
        </section>

        {/* Cookie Types */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold mb-6">Types of Cookies We Use</h2>
              <div className="space-y-6">
                {cookieTypes.map((type) => (
                  <Card key={type.title} className="border-border">
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                          <type.icon className="h-6 w-6 text-primary" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-lg">{type.title}</h3>
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full ${
                                type.canDisable
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-green-100 text-green-700"
                              }`}
                            >
                              {type.canDisable ? "Optional" : "Required"}
                            </span>
                          </div>
                          <p className="text-muted-foreground mb-3">
                            {type.description}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {type.examples.map((example) => (
                              <span
                                key={example}
                                className="text-xs bg-muted px-2 py-1 rounded"
                              >
                                {example}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Cookies Table */}
        <section className="py-20 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold mb-6">Cookies We Set</h2>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse bg-background rounded-lg overflow-hidden">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left py-3 px-4 font-semibold">
                        Cookie Name
                      </th>
                      <th className="text-left py-3 px-4 font-semibold">
                        Provider
                      </th>
                      <th className="text-left py-3 px-4 font-semibold">
                        Purpose
                      </th>
                      <th className="text-left py-3 px-4 font-semibold">Type</th>
                      <th className="text-left py-3 px-4 font-semibold">
                        Expiry
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {cookiesTable.map((cookie) => (
                      <tr key={cookie.name} className="border-b border-border">
                        <td className="py-3 px-4 font-mono text-sm">
                          {cookie.name}
                        </td>
                        <td className="py-3 px-4">{cookie.provider}</td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {cookie.purpose}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              cookie.type === "Essential"
                                ? "bg-green-100 text-green-700"
                                : cookie.type === "Functional"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-purple-100 text-purple-700"
                            }`}
                          >
                            {cookie.type}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {cookie.expiry}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* Third-Party Cookies */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto prose prose-lg max-w-none">
              <h2 className="text-2xl font-bold mb-4">Third-Party Cookies</h2>
              <p className="text-muted-foreground mb-4">
                We use services from third-party providers that may set their own
                cookies on your device:
              </p>
              <ul className="space-y-3 text-muted-foreground">
                <li>
                  <strong>Clerk:</strong> For user authentication and session
                  management. Visit{" "}
                  <a
                    href="https://clerk.com/privacy"
                    className="text-primary hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    clerk.com/privacy
                  </a>{" "}
                  for more information.
                </li>
                <li>
                  <strong>Google Analytics:</strong> For website analytics and
                  usage tracking. Visit{" "}
                  <a
                    href="https://policies.google.com/privacy"
                    className="text-primary hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    policies.google.com/privacy
                  </a>{" "}
                  for more information.
                </li>
                <li>
                  <strong>Stripe:</strong> For payment processing. Visit{" "}
                  <a
                    href="https://stripe.com/privacy"
                    className="text-primary hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    stripe.com/privacy
                  </a>{" "}
                  for more information.
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Managing Cookies */}
        <section className="py-20 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold mb-6">Managing Cookies</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="border-border">
                  <CardContent className="pt-6">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                      <Settings className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="font-semibold mb-2">Browser Settings</h3>
                    <p className="text-sm text-muted-foreground">
                      Most browsers allow you to manage cookie settings. You can
                      set your browser to refuse cookies or delete certain
                      cookies. Check your browser's help section for
                      instructions.
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-border">
                  <CardContent className="pt-6">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                      <Shield className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="font-semibold mb-2">Impact of Disabling</h3>
                    <p className="text-sm text-muted-foreground">
                      Disabling essential cookies may prevent our website from
                      functioning properly. You may not be able to log in or use
                      certain features.
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="mt-8 p-6 bg-background rounded-lg border border-border">
                <h3 className="font-semibold mb-4">
                  How to Manage Cookies in Popular Browsers
                </h3>
                <ul className="space-y-2 text-muted-foreground">
                  <li>
                    <strong>Chrome:</strong> Settings → Privacy and Security →
                    Cookies and other site data
                  </li>
                  <li>
                    <strong>Firefox:</strong> Settings → Privacy & Security →
                    Cookies and Site Data
                  </li>
                  <li>
                    <strong>Safari:</strong> Preferences → Privacy → Manage
                    Website Data
                  </li>
                  <li>
                    <strong>Edge:</strong> Settings → Cookies and site
                    permissions → Cookies and site data
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Updates */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-start gap-4 p-6 bg-muted/30 rounded-lg">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Updates to This Policy</h3>
                  <p className="text-muted-foreground">
                    We may update this Cookie Policy from time to time. Any
                    changes will be posted on this page with an updated revision
                    date. We encourage you to review this policy periodically.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Contact */}
        <section className="py-20 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-2xl font-bold mb-4">Questions?</h2>
              <p className="text-muted-foreground mb-6">
                If you have any questions about our use of cookies, please
                contact us:
              </p>
              <div className="inline-block p-6 bg-background rounded-lg border border-border text-left">
                <p className="font-semibold">Athena Agentic</p>
                <p className="text-muted-foreground mt-2">
                  Email:{" "}
                  <a
                    href="mailto:hello@athena agentic.co.za"
                    className="text-primary hover:underline"
                  >
                    hello@athena agentic.co.za
                  </a>
                </p>
                <p className="text-muted-foreground">
                  Phone:{" "}
                  <a
                    href="tel:+27774404475"
                    className="text-primary hover:underline"
                  >
                    +27 77 440 4475
                  </a>
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
