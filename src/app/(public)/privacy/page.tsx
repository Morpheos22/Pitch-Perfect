"use client";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, Lock, Eye, Database, Bell, Users } from "lucide-react";

const highlights = [
  {
    icon: Shield,
    title: "Data Protection",
    description:
      "We employ industry-standard security measures to protect your personal information from unauthorized access, alteration, or disclosure.",
  },
  {
    icon: Lock,
    title: "Secure Storage",
    description:
      "Your data is encrypted both in transit and at rest using advanced encryption protocols. We never store sensitive payment information on our servers.",
  },
  {
    icon: Eye,
    title: "Transparency",
    description:
      "We believe in being clear about how we collect, use, and share your information. This policy explains everything you need to know.",
  },
  {
    icon: Database,
    title: "Minimal Data Collection",
    description:
      "We only collect information that's necessary to provide our services. We don't sell your data to third parties.",
  },
];

const dataTypes = [
  {
    category: "Account Information",
    items: [
      "Name and email address",
      "Password (encrypted and hashed)",
      "Profile information you choose to provide",
    ],
  },
  {
    category: "Usage Data",
    items: [
      "Pitch deck files and scripts you upload",
      "Video recordings for live coaching sessions",
      "Analysis results and feedback generated",
      "Usage patterns and feature interactions",
    ],
  },
  {
    category: "Technical Data",
    items: [
      "Browser type and version",
      "Device information",
      "IP address (anonymized)",
      "Cookies and similar technologies",
    ],
  },
  {
    category: "Payment Information",
    items: [
      "Billing address",
      "Payment processor tokens (not actual card numbers)",
      "Transaction history",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-secondary/5" />
          <div className="container mx-auto px-4 py-20 md:py-32 relative">
            <div className="max-w-4xl mx-auto text-center">
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
                Privacy{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">
                  Policy
                </span>
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
                Your privacy matters to us. This policy explains how AutomagiKal
                collects, uses, and protects your personal information.
              </p>
              <p className="text-sm text-muted-foreground mt-4">
                Last updated: January 2025
              </p>
            </div>
          </div>
        </section>

        {/* Highlights Section */}
        <section className="py-20 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {highlights.map((item) => (
                <Card key={item.title} className="border-border">
                  <CardContent className="pt-6 text-center">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                      <item.icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="font-semibold mb-2">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {item.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Main Content */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto prose prose-lg max-w-none">
              {/* Introduction */}
              <div className="mb-12">
                <h2 className="text-2xl font-bold mb-4">Introduction</h2>
                <p className="text-muted-foreground">
                  Roshwyle (Pty) Ltd, trading as AutomagiKal ("we," "our," or
                  "us"), is committed to protecting your privacy. This Privacy
                  Policy explains how we collect, use, disclose, and safeguard
                  your information when you use our Pitch Perfect platform and
                  related services (collectively, the "Services").
                </p>
                <p className="text-muted-foreground mt-4">
                  This Privacy Policy is drafted in compliance with the
                  Protection of Personal Information Act 4 of 2013 ("POPIA") of
                  the Republic of South Africa. We act as the Responsible Party
                  for the processing of your personal information as described
                  herein.
                </p>
                <p className="text-muted-foreground mt-4">
                  Please read this privacy policy carefully. If you do not agree
                  with the terms of this privacy policy, please do not access the
                  site and/or Services.
                </p>
              </div>

              {/* Information We Collect */}
              <div className="mb-12">
                <h2 className="text-2xl font-bold mb-4">Information We Collect</h2>
                <p className="text-muted-foreground mb-6">
                  We collect information that you provide directly to us,
                  information we obtain automatically when you use our Services,
                  and information from third-party sources.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {dataTypes.map((type) => (
                    <Card key={type.category} className="border-border">
                      <CardContent className="pt-6">
                        <h3 className="font-semibold mb-3">{type.category}</h3>
                        <ul className="space-y-2">
                          {type.items.map((item) => (
                            <li
                              key={item}
                              className="text-sm text-muted-foreground flex items-start gap-2"
                            >
                              <span className="text-primary mt-1">•</span>
                              {item}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* How We Use Information */}
              <div className="mb-12">
                <h2 className="text-2xl font-bold mb-4">
                  How We Use Your Information
                </h2>
                <p className="text-muted-foreground mb-4">
                  We use the information we collect for various purposes,
                  including:
                </p>
                <ul className="space-y-3 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold mt-1">1.</span>
                    <span>
                      <strong>Providing Services:</strong> To provide, maintain,
                      and improve our pitch coaching services, including AI
                      analysis of your pitch decks, scripts, and video recordings.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold mt-1">2.</span>
                    <span>
                      <strong>Account Management:</strong> To create and manage
                      your account, authenticate your identity, and communicate
                      with you about your account.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold mt-1">3.</span>
                    <span>
                      <strong>Communication:</strong> To send you technical
                      notices, updates, security alerts, and support messages.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold mt-1">4.</span>
                    <span>
                      <strong>Improvement:</strong> To monitor and analyze trends,
                      usage, and activities in connection with our Services to
                      improve user experience.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold mt-1">5.</span>
                    <span>
                      <strong>AI Training:</strong> To improve our AI models and
                      algorithms for better pitch analysis and coaching
                      recommendations. Your data may be used in anonymized or
                      aggregated form for this purpose.
                    </span>
                  </li>
                </ul>
              </div>

              {/* Data Sharing */}
              <div className="mb-12">
                <h2 className="text-2xl font-bold mb-4">
                  How We Share Your Information
                </h2>
                <p className="text-muted-foreground mb-4">
                  We may share your information in the following situations:
                </p>
                <ul className="space-y-3 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold mt-1">•</span>
                    <span>
                      <strong>Service Providers:</strong> We share information
                      with third-party vendors who perform services on our behalf,
                      such as cloud hosting (Zoho), payment processing
                      (Stripe), and authentication services (Clerk).
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold mt-1">•</span>
                    <span>
                      <strong>AI Processing:</strong> Your pitch content is
                      processed by our AI partners (Z.ai) to generate analysis and
                      feedback. These partners are bound by confidentiality
                      obligations and process data in accordance with applicable
                      data protection laws.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold mt-1">•</span>
                    <span>
                      <strong>CRM &amp; Billing (Zoho):</strong> We use Zoho
                      CRM and Zoho Billing to manage customer relationships,
                      subscription records, and invoicing. Your name, email, and
                      subscription details may be stored in Zoho&apos;s systems
                      which are hosted on servers that comply with international
                      data protection standards.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold mt-1">•</span>
                    <span>
                      <strong>Legal Requirements:</strong> We may disclose
                      information if required by law or in response to valid
                      requests by public authorities.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold mt-1">•</span>
                    <span>
                      <strong>Business Transfers:</strong> In connection with a
                      merger, acquisition, or sale of assets, your information
                      may be transferred as a business asset.
                    </span>
                  </li>
                </ul>
                <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    <strong>We do not sell your personal information</strong> to
                    third parties for their marketing purposes.
                  </p>
                </div>
              </div>

              {/* Data Retention */}
              <div className="mb-12">
                <h2 className="text-2xl font-bold mb-4">Data Retention</h2>
                <p className="text-muted-foreground">
                  We retain your personal information for as long as your account
                  is active or as needed to provide you services. We will retain
                  and use your information as necessary to comply with our legal
                  obligations, resolve disputes, and enforce our agreements.
                </p>
                <p className="text-muted-foreground mt-4">
                  <strong>Specific retention periods:</strong>
                </p>
                <ul className="mt-3 space-y-2 text-muted-foreground">
                  <li>
                    • Account data: Retained while your account is active
                  </li>
                  <li>
                    • Pitch analysis data: Retained for 12 months after last
                    activity
                  </li>
                  <li>
                    • Video recordings: Deleted after 90 days unless you choose
                    to save them
                  </li>
                  <li>• Payment records: Retained for 7 years (legal requirement)</li>
                </ul>
              </div>

              {/* Your Rights */}
              <div className="mb-12">
                <h2 className="text-2xl font-bold mb-4">Your Rights</h2>
                <p className="text-muted-foreground mb-4">
                  In terms of POPIA and applicable data protection laws, you have
                  the following rights regarding your personal information. Where
                  applicable, we will respond to requests within 30 days as
                  required by law:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <h4 className="font-semibold mb-2">Access</h4>
                    <p className="text-sm text-muted-foreground">
                      Request a copy of the personal information we hold about
                      you.
                    </p>
                  </div>
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <h4 className="font-semibold mb-2">Correction</h4>
                    <p className="text-sm text-muted-foreground">
                      Request correction of inaccurate or incomplete data.
                    </p>
                  </div>
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <h4 className="font-semibold mb-2">Deletion</h4>
                    <p className="text-sm text-muted-foreground">
                      Request deletion of your personal information.
                    </p>
                  </div>
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <h4 className="font-semibold mb-2">Portability</h4>
                    <p className="text-sm text-muted-foreground">
                      Receive your data in a structured, machine-readable format.
                    </p>
                  </div>
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <h4 className="font-semibold mb-2">Objection</h4>
                    <p className="text-sm text-muted-foreground">
                      Object to processing of your personal information.
                    </p>
                  </div>
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <h4 className="font-semibold mb-2">Withdrawal</h4>
                    <p className="text-sm text-muted-foreground">
                      Withdraw consent where processing is based on consent.
                    </p>
                  </div>
                </div>
                <p className="text-muted-foreground mt-6">
                  To exercise these rights, please contact us at{" "}
                  <a
                    href="mailto:hello@automagikal.co.za"
                    className="text-primary hover:underline"
                  >
                    hello@automagikal.co.za
                  </a>
                  .
                </p>
              </div>

              {/* Security */}
              <div className="mb-12">
                <h2 className="text-2xl font-bold mb-4">Security</h2>
                <p className="text-muted-foreground">
                  We implement appropriate technical and organizational measures
                  to protect your personal information, including:
                </p>
                <ul className="mt-3 space-y-2 text-muted-foreground">
                  <li>• Encryption of data in transit (TLS/SSL)</li>
                  <li>• Encryption of data at rest (AES-256)</li>
                  <li>• Secure authentication with Clerk</li>
                  <li>• Regular security assessments and updates</li>
                  <li>• Access controls and monitoring</li>
                </ul>
                <p className="text-muted-foreground mt-4">
                  However, no method of transmission over the Internet or
                  electronic storage is 100% secure. While we strive to use
                  commercially acceptable means to protect your personal
                  information, we cannot guarantee its absolute security.
                </p>
              </div>

              {/* Contact */}
              <div className="mb-12">
                <h2 className="text-2xl font-bold mb-4">Contact Us</h2>
                <p className="text-muted-foreground">
                  If you have questions or concerns about this Privacy Policy,
                  please contact us:
                </p>
                <div className="mt-4 p-6 bg-muted/30 rounded-lg">
                  <p className="font-semibold">AutomagiKal (Roshwyle (Pty) Ltd)</p>
                  <p className="text-muted-foreground mt-2">
                    Email:{" "}
                    <a
                      href="mailto:hello@automagikal.co.za"
                      className="text-primary hover:underline"
                    >
                      hello@automagikal.co.za
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
                  <p className="text-muted-foreground">Location: South Africa</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
