"use client";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Scale, AlertTriangle, RefreshCw, Ban } from "lucide-react";

const highlights = [
  {
    icon: FileText,
    title: "Service Agreement",
    description:
      "These terms govern your use of Pitch Perfect, our AI-powered pitch coaching platform.",
  },
  {
    icon: Scale,
    title: "Fair Use",
    description:
      "We expect users to use our services responsibly and in accordance with these terms.",
  },
  {
    icon: AlertTriangle,
    title: "Limitations",
    description:
      "AI coaching is a tool to assist you, not a guarantee of investment success.",
  },
  {
    icon: RefreshCw,
    title: "Updates",
    description:
      "We may update these terms from time to time. Continued use constitutes acceptance.",
  },
];

const serviceTiers = [
  {
    name: "Pitch Deck Analyser",
    code: "M1",
    description: "Deck analysis with 2 improvement cycles",
  },
  {
    name: "Elevator Script Check",
    code: "M2",
    description: "Script coaching with 2 improvement cycles",
  },
  {
    name: "Elevator Pitch Live",
    code: "M3",
    description: "Script coaching plus live recording practice (3 sessions)",
  },
  {
    name: "Pitch Deck Live",
    code: "M4",
    description: "Deck analysis plus full 30-minute presentation recording",
  },
];

export default function TermsPage() {
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
                Terms of{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">
                  Service
                </span>
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
                Please read these terms carefully before using Pitch Perfect. By
                using our services, you agree to be bound by these terms.
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
              {/* Agreement */}
              <div className="mb-12">
                <h2 className="text-2xl font-bold mb-4">Agreement to Terms</h2>
                <p className="text-muted-foreground">
                  These Terms of Service ("Terms") constitute a legally binding
                  agreement between you ("User," "you," or "your") and Roshwyle
                  (Pty) Ltd, trading as AutomagiKal ("Company," "we," "us," or
                  "our"), concerning your access to and use of the Pitch Perfect
                  platform and related services.
                </p>
                <p className="text-muted-foreground mt-4">
                  By accessing or using the Services, you agree to be bound by
                  these Terms. If you disagree with any part of these Terms, you
                  may not access the Services.
                </p>
              </div>

              {/* Services */}
              <div className="mb-12">
                <h2 className="text-2xl font-bold mb-4">Our Services</h2>
                <p className="text-muted-foreground mb-6">
                  Pitch Perfect is an AI-powered pitch coaching platform that
                  provides the following services:
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-4 font-semibold">
                          Service
                        </th>
                        <th className="text-left py-3 px-4 font-semibold">
                          Module
                        </th>
                        <th className="text-left py-3 px-4 font-semibold">
                          Description
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {serviceTiers.map((tier) => (
                        <tr
                          key={tier.code}
                          className="border-b border-border"
                        >
                          <td className="py-3 px-4">{tier.name}</td>
                          <td className="py-3 px-4 text-primary font-medium">
                            {tier.code}
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">
                            {tier.description}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* User Accounts */}
              <div className="mb-12">
                <h2 className="text-2xl font-bold mb-4">User Accounts</h2>
                <p className="text-muted-foreground mb-4">
                  To use certain features of the Services, you must register for
                  an account. When you register:
                </p>
                <ul className="space-y-3 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold mt-1">1.</span>
                    <span>
                      You must provide accurate, current, and complete
                      information during registration.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold mt-1">2.</span>
                    <span>
                      You are responsible for maintaining the confidentiality of
                      your account credentials.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold mt-1">3.</span>
                    <span>
                      You are responsible for all activities that occur under
                      your account.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold mt-1">4.</span>
                    <span>
                      You must notify us immediately upon discovering any
                      unauthorized use of your account.
                    </span>
                  </li>
                </ul>
              </div>

              {/* Acceptable Use */}
              <div className="mb-12">
                <h2 className="text-2xl font-bold mb-4">Acceptable Use Policy</h2>
                <p className="text-muted-foreground mb-4">
                  You agree not to use the Services:
                </p>
                <ul className="space-y-2 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <Ban className="h-4 w-4 text-red-500 mt-1 shrink-0" />
                    <span>
                      For any unlawful purpose or in violation of any laws
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Ban className="h-4 w-4 text-red-500 mt-1 shrink-0" />
                    <span>
                      To upload content that infringes on intellectual property
                      rights of others
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Ban className="h-4 w-4 text-red-500 mt-1 shrink-0" />
                    <span>
                      To distribute malware, spam, or other harmful content
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Ban className="h-4 w-4 text-red-500 mt-1 shrink-0" />
                    <span>
                      To attempt to reverse engineer or extract our AI models or
                      algorithms
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Ban className="h-4 w-4 text-red-500 mt-1 shrink-0" />
                    <span>
                      To overload or disrupt our servers or infrastructure
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Ban className="h-4 w-4 text-red-500 mt-1 shrink-0" />
                    <span>
                      To share your account credentials with others
                    </span>
                  </li>
                </ul>
              </div>

              {/* Payment Terms */}
              <div className="mb-12">
                <h2 className="text-2xl font-bold mb-4">
                  Payment & Subscription Terms
                </h2>
                <p className="text-muted-foreground mb-4">
                  By purchasing our services, you agree to the following payment
                  terms:
                </p>
                <div className="space-y-4">
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <h4 className="font-semibold mb-2">Pricing</h4>
                    <p className="text-sm text-muted-foreground">
                      Prices for our services are displayed on our pricing page
                      and may be updated from time to time. All prices are in USD
                      unless otherwise specified.
                    </p>
                  </div>
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <h4 className="font-semibold mb-2">Payment Processing</h4>
                    <p className="text-sm text-muted-foreground">
                      Payments are processed securely through Stripe. We do not
                      store your complete payment card information on our
                      servers.
                    </p>
                  </div>
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <h4 className="font-semibold mb-2">Usage Credits</h4>
                    <p className="text-sm text-muted-foreground">
                      Purchased analysis cycles are valid for 12 months from the
                      date of purchase. Unused credits do not carry over after
                      expiration.
                    </p>
                  </div>
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <h4 className="font-semibold mb-2">Refunds</h4>
                    <p className="text-sm text-muted-foreground">
                      Due to the nature of our AI-powered services, we generally
                      do not offer refunds for completed analyses. If you
                      experience technical issues, please contact our support
                      team.
                    </p>
                  </div>
                </div>
              </div>

              {/* AI Disclaimer */}
              <div className="mb-12">
                <h2 className="text-2xl font-bold mb-4">
                  AI Analysis Disclaimer
                </h2>
                <div className="p-6 bg-amber-50 border border-amber-200 rounded-lg">
                  <h4 className="font-semibold text-amber-800 mb-2">
                    Important Notice
                  </h4>
                  <p className="text-amber-700 text-sm">
                    The AI-powered analysis and coaching provided by Pitch Perfect
                    is intended to assist you in improving your pitch materials.
                    It does not constitute professional investment advice,
                    legal advice, or a guarantee of funding success. The quality
                    of analysis depends on the quality of materials you provide.
                    Always seek professional advice for critical business
                    decisions.
                  </p>
                </div>
              </div>

              {/* Intellectual Property */}
              <div className="mb-12">
                <h2 className="text-2xl font-bold mb-4">Intellectual Property</h2>
                <p className="text-muted-foreground mb-4">
                  <strong>Your Content:</strong> You retain ownership of all
                  content you upload to the Services, including pitch decks,
                  scripts, and video recordings. By using our Services, you grant
                  us a limited license to process this content for the purpose of
                  providing the AI analysis.
                </p>
                <p className="text-muted-foreground mb-4">
                  <strong>Our Platform:</strong> The Pitch Perfect platform,
                  including our AI models, algorithms, interface designs, and all
                  related intellectual property, belongs to AutomagiKal and is
                  protected by copyright, trademark, and other laws.
                </p>
                <p className="text-muted-foreground">
                  <strong>Analysis Results:</strong> The AI-generated analysis,
                  feedback, and recommendations provided to you are for your
                  personal use. You may not resell, redistribute, or use these
                  outputs to create competing services.
                </p>
              </div>

              {/* Limitation of Liability */}
              <div className="mb-12">
                <h2 className="text-2xl font-bold mb-4">
                  Limitation of Liability
                </h2>
                <p className="text-muted-foreground mb-4">
                  To the maximum extent permitted by law:
                </p>
                <ul className="space-y-2 text-muted-foreground">
                  <li>
                    • The Services are provided "as is" without warranties of any
                    kind, either express or implied.
                  </li>
                  <li>
                    • We do not warrant that the Services will be uninterrupted,
                    error-free, or secure.
                  </li>
                  <li>
                    • We are not liable for any indirect, incidental, special,
                    consequential, or punitive damages.
                  </li>
                  <li>
                    • Our total liability shall not exceed the amount you paid
                    for the Services in the 12 months preceding the claim.
                  </li>
                </ul>
              </div>

              {/* Termination */}
              <div className="mb-12">
                <h2 className="text-2xl font-bold mb-4">Termination</h2>
                <p className="text-muted-foreground mb-4">
                  We may terminate or suspend your account and access to the
                  Services immediately, without prior notice, for any reason,
                  including breach of these Terms.
                </p>
                <p className="text-muted-foreground">
                  Upon termination, your right to use the Services will
                  immediately cease. We may delete your account and associated
                  data following termination, subject to our data retention
                  policy.
                </p>
              </div>

              {/* Governing Law */}
              <div className="mb-12">
                <h2 className="text-2xl font-bold mb-4">Governing Law</h2>
                <p className="text-muted-foreground">
                  These Terms shall be governed by and construed in accordance
                  with the laws of the Republic of South Africa, including the
                  Protection of Personal Information Act 4 of 2013 (POPIA), the
                  Consumer Protection Act 68 of 2008 (CPA), and the Electronic
                  Communications and Transactions Act 25 of 2002 (ECTA), without
                  regard to conflict of law provisions. Any disputes arising
                  from these Terms shall be resolved in the courts of South
                  Africa.
                </p>
              </div>

              {/* Changes */}
              <div className="mb-12">
                <h2 className="text-2xl font-bold mb-4">Changes to Terms</h2>
                <p className="text-muted-foreground">
                  We reserve the right to modify these Terms at any time. We will
                  notify users of any material changes by posting the updated
                  Terms on this page and updating the "Last updated" date. Your
                  continued use of the Services after any changes constitutes
                  acceptance of the new Terms.
                </p>
              </div>

              {/* Contact */}
              <div className="mb-12">
                <h2 className="text-2xl font-bold mb-4">Contact Us</h2>
                <p className="text-muted-foreground">
                  If you have any questions about these Terms, please contact us:
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
