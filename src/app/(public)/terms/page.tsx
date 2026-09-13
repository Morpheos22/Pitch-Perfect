"use client";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <h1 className="text-4xl font-bold text-foreground mb-4">Terms of Service</h1>
        <p className="text-muted-foreground mb-8">Last updated: September 2026</p>

        <div className="prose prose-lg max-w-none space-y-6 text-muted-foreground">
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">1. Agreement to Terms</h2>
            <p>
              These Terms of Service ("Terms") govern your use of PitchCoach Ai, an AI-powered
              pitch coaching platform operated by Athena Agentic ("we," "us," or "our"). By
              accessing or using the platform, you agree to be bound by these Terms. If you do not
              agree, please do not use the platform.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">2. Description of Service</h2>
            <p>
              PitchCoach Ai provides AI-powered coaching for founders and entrepreneurs, including:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Pitch deck analysis and feedback</li>
              <li>Elevator pitch script coaching</li>
              <li>Live pitch delivery analysis (video)</li>
              <li>Full pitch session analysis (30-min video + deck)</li>
              <li>Founder coaching and investor readiness assessment</li>
            </ul>
            <p>
              We offer multiple subscription tiers: JJC (Free), Intern, Cofounder, and Founder
              (one-time payment). Pricing is displayed in Naira by default, with geolocation-based
              currency conversion for international users.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">3. Eligibility</h2>
            <p>
              You must be at least 18 years old to use PitchCoach Ai. By registering, you represent
              that you meet this age requirement and have the legal capacity to enter into these
              Terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">4. Account Registration</h2>
            <p>
              You must provide accurate and complete information when creating an account. You are
              responsible for maintaining the security of your account credentials and for all
              activities that occur under your account. Notify us immediately at
              Metron@Athenagentic.app if you suspect any unauthorized use.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">5. Acceptable Use</h2>
            <p>You agree NOT to:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Use the platform for any illegal or unauthorized purpose</li>
              <li>Upload content that is fraudulent, defamatory, or infringes on intellectual property</li>
              <li>Attempt to disrupt, overload, or gain unauthorized access to the platform</li>
              <li>Use automated tools (bots, scrapers) to extract data without our permission</li>
              <li>Share your account credentials with others</li>
              <li>Circumvent security measures, rate limits, or access controls</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">6. User Content</h2>
            <p>
              You retain ownership of all content you upload to PitchCoach Ai (pitch decks, scripts,
              videos). By uploading, you grant us a non-exclusive, worldwide license to process
              your content using AI models for the purpose of providing coaching analysis.
            </p>
            <p>
              We do not claim ownership of your content. We may use anonymized, aggregated data to
              improve our AI models, but we will never share your identifiable content with third
              parties without your consent.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">7. Subscription and Payments</h2>
            <p>
              We offer the following subscription tiers (prices in Naira, default currency):
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong>JJC (Free):</strong> Limited access to pitch deck and script check modules.</li>
              <li><strong>Intern (N9,000):</strong> Expanded access with more sessions.</li>
              <li><strong>Cofounder (N15,000):</strong> Full access to most modules.</li>
              <li><strong>Founder (N30,000 one-time):</strong> Full platform access with founder coaching.</li>
            </ul>
            <p>
              International users will see pricing converted to their local currency based on
              geolocation. Payments are processed securely through Stripe (African markets) and
              Stripe (international markets). All fees are non-refundable unless required by law.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">8. AI-Generated Content</h2>
            <p>
              PitchCoach Ai uses artificial intelligence (Cloudflare Workers AI — Llama models) to
              analyze your content and provide coaching feedback. AI-generated feedback may not
              always be accurate, complete, or appropriate. You are responsible for evaluating and
              acting on AI advice at your own discretion. We are not liable for decisions you make
              based on AI-generated feedback.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">9. Intellectual Property</h2>
            <p>
              The platform, including its design, features, and content (excluding user-uploaded
              content), is the property of Athena Agentic and is protected by Nigerian and
              international intellectual property laws. You may not copy, modify, distribute, or
              create derivative works without our written consent.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">10. Privacy and Data Protection</h2>
            <p>
              We handle your personal data in accordance with the Nigeria Data Protection Regulation
              (NDPR) 2023. Please review our Privacy Policy for details on how we collect, use, and
              protect your information.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">11. Termination</h2>
            <p>
              You may cancel your account at any time. We may suspend or terminate your account if
              you violate these Terms or engage in conduct that we determine is harmful to the
              platform or other users. Upon termination, your right to use the platform ceases
              immediately.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">12. Disclaimer of Warranties</h2>
            <p>
              The platform is provided "as is" and "as available" without warranties of any kind,
              whether express or implied. We do not guarantee that the platform will be
              uninterrupted, error-free, or that AI-generated feedback will be accurate.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">13. Limitation of Liability</h2>
            <p>
              To the fullest extent permitted by Nigerian law, Athena Agentic shall not be liable
              for any indirect, incidental, special, consequential, or punitive damages, including
              loss of profits, data, or business opportunities, arising from your use of the
              platform.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">14. Governing Law</h2>
            <p>
              These Terms are governed by the laws of the Federal Republic of Nigeria. Any disputes
              arising from these Terms shall be resolved in the courts of Abuja, Nigeria.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">15. Changes to Terms</h2>
            <p>
              We may update these Terms from time to time. We will notify you of material changes
              by posting the updated Terms on this page. Your continued use of the platform after
              changes take effect constitutes acceptance of the revised Terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">16. Contact Us</h2>
            <p>If you have any questions about these Terms, contact us:</p>
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
