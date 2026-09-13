"use client";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, Lock, Eye, Database, Bell, Users } from "lucide-react";

const highlights = [
  {
    icon: Shield,
    title: "NDPR Compliant",
    description:
      "We comply with the Nigeria Data Protection Regulation (NDPR) 2023 and the NDPR Implementation Framework. Your data is handled in accordance with Nigerian data protection law.",
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
      "We only collect the data we need to provide our coaching services. Nothing more, nothing less.",
  },
  {
    icon: Bell,
    title: "Your Rights",
    description:
      "You have the right to access, correct, delete, or export your data at any time. Contact us and we will respond within 72 hours.",
  },
  {
    icon: Users,
    title: "No Third-Party Selling",
    description:
      "We never sell your personal data to third parties. We only share data with service providers who help us operate the platform.",
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <h1 className="text-4xl font-bold text-foreground mb-4">Privacy Policy</h1>
        <p className="text-muted-foreground mb-8">Last updated: September 2026</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {highlights.map((item) => (
            <Card key={item.title}>
              <CardContent className="p-6">
                <item.icon className="w-8 h-8 text-primary mb-3" />
                <h3 className="font-semibold text-foreground mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="prose prose-lg max-w-none space-y-6 text-muted-foreground">
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">1. Introduction</h2>
            <p>
              We at PitchCoach Ai (operated by Athena Agentic) take your privacy seriously. This
              Privacy Policy explains how we collect, use, disclose, and safeguard your information
              when you use our platform. We are committed to full compliance with the Nigeria Data
              Protection Regulation (NDPR) 2023, the NDPR Implementation Framework, and other
              applicable data protection laws.
            </p>
            <p>
              By accessing or using PitchCoach Ai, you agree to the practices described in this
              policy. If you do not agree with our practices, please do not use the platform.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">2. Information We Collect</h2>
            <p>We collect the following types of information:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong>Account Information:</strong> Your name, email address, and credentials when you register.</li>
              <li><strong>Profile Information:</strong> Your role, organization, country, and use case preferences collected during onboarding.</li>
              <li><strong>Content You Upload:</strong> Pitch decks, scripts, and videos you submit for AI coaching analysis.</li>
              <li><strong>Usage Data:</strong> How you interact with the platform — pages visited, features used, session duration.</li>
              <li><strong>Technical Data:</strong> IP address, device type, browser information — used for security and fraud prevention.</li>
              <li><strong>Payment Information:</strong> Transaction records processed securely through Stripe. We do not store full card numbers.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">3. How We Use Your Information</h2>
            <p>We use your information to:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Provide AI-powered pitch coaching and analysis services</li>
              <li>Authenticate your account and manage your subscription</li>
              <li>Communicate with you about your account, updates, and support</li>
              <li>Improve our services, AI models, and user experience</li>
              <li>Detect, prevent, and respond to fraud, security incidents, and abuse</li>
              <li>Comply with our legal obligations under Nigerian law</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">4. Legal Basis for Processing (NDPR)</h2>
            <p>
              Under the NDPR, we process your personal data based on one or more of the following
              lawful bases:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong>Consent:</strong> You have given us consent to process your data for specific purposes.</li>
              <li><strong>Contract Performance:</strong> Processing is necessary to provide the coaching services you requested.</li>
              <li><strong>Legal Obligation:</strong> We are required to process data to comply with Nigerian law.</li>
              <li><strong>Legitimate Interest:</strong> We process data for fraud prevention, security, and platform improvement.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">5. Data Storage and Security</h2>
            <p>
              We store your data on secure cloud infrastructure. Our primary database is hosted in
              the European Union (Supabase), and file storage is on Cloudflare R2. All data is
              encrypted in transit (TLS 1.3) and at rest.
            </p>
            <p>
              We implement industry-standard security measures including: firewalls, access
              controls, regular security audits, and automated threat detection. However, no method
              of transmission over the Internet is 100% secure, and we cannot guarantee absolute
              security.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">6. Data Sharing</h2>
            <p>We do not sell your personal data. We share data only with:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong>Service Providers:</strong> Clerk (authentication), Supabase (database), Cloudflare (storage and AI), Stripe (payments).</li>
              <li><strong>Legal Authorities:</strong> When required by Nigerian law or to protect our rights and safety.</li>
              <li><strong>Business Transfers:</strong> In the event of a merger or acquisition, we will notify you before transferring your data.</li>
            </ul>
            <p>
              All service providers are bound by data processing agreements that comply with the NDPR.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">7. Your Rights Under NDPR</h2>
            <p>You have the following rights regarding your personal data:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong>Right of Access:</strong> Request a copy of the personal data we hold about you.</li>
              <li><strong>Right to Rectification:</strong> Request correction of inaccurate or incomplete data.</li>
              <li><strong>Right to Erasure:</strong> Request deletion of your personal data ("right to be forgotten").</li>
              <li><strong>Right to Data Portability:</strong> Receive your data in a structured, machine-readable format.</li>
              <li><strong>Right to Object:</strong> Object to processing based on legitimate interest.</li>
              <li><strong>Right to Withdraw Consent:</strong> Withdraw consent at any time without affecting prior processing.</li>
            </ul>
            <p>
              To exercise any of these rights, contact us at Metron@Athenagentic.app. We will
              respond within 72 hours as required by the NDPR.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">8. Data Retention</h2>
            <p>
              We retain your personal data only as long as necessary to fulfill the purposes
              outlined in this policy, unless a longer retention period is required by law. When you
              delete your account, we remove your data from active systems within 30 days, though
              some data may remain in encrypted backups for up to 90 days.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">9. Cookies</h2>
            <p>
              We use cookies and similar technologies to operate the platform, remember your
              preferences, and analyze usage. See our Cookie Policy for details on what cookies we
              use and how to control them.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">10. International Transfers</h2>
            <p>
              Your data may be transferred to and processed in countries outside Nigeria, including
              the European Union and the United States. We ensure such transfers comply with the
              NDPR by using service providers that implement adequate data protection measures,
              including Standard Contractual Clauses.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">11. Children's Privacy</h2>
            <p>
              Our platform is not directed to individuals under 18. We do not knowingly collect
              personal information from children. If you believe we have collected data from a
              minor, please contact us immediately and we will delete it.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">12. Data Protection Officer</h2>
            <p>
              For data protection inquiries, or to file a complaint about how we handle your
              personal data, contact our Data Protection Officer at Metron@Athenagentic.app. You
              also have the right to lodge a complaint with the Nigeria Data Protection Commission
              (NDPC) if you believe we have violated your rights under the NDPR.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">13. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any
              material changes by posting the updated policy on this page and, where appropriate,
              sending you an email notification. The "Last updated" date at the top of this page
              indicates when the policy was last revised.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">14. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy or our data practices, we are
              here to help. Contact us at:
            </p>
            <div className="bg-muted p-4 rounded-lg mt-2">
              <p className="font-semibold text-foreground">PitchCoach Ai (Athena Agentic)</p>
              <p className="text-muted-foreground">Location: Abuja, Nigeria</p>
              <p className="text-muted-foreground">Email: Metron@Athenagentic.app</p>
            </div>
          </section>
        </div>
      </div>
      <Footer />
    </div>
  );
}
