"use client";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Cookie } from "lucide-react";

export default function CookiesPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <div className="flex items-center gap-3 mb-4">
          <Cookie className="w-8 h-8 text-primary" />
          <h1 className="text-4xl font-bold text-foreground">Cookie Policy</h1>
        </div>
        <p className="text-muted-foreground mb-8">Last updated: September 2026</p>

        <div className="prose prose-lg max-w-none space-y-6 text-muted-foreground">
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">1. What Are Cookies?</h2>
            <p>
              Cookies are small text files stored on your device when you visit a website. They
              help us remember your preferences, keep you signed in, and understand how you use
              PitchCoach Ai. This policy explains what cookies we use and how you can control them.
            </p>
            <p>
              We comply with the Nigeria Data Protection Regulation (NDPR) 2023 regarding the use
              of cookies and similar technologies.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">2. Types of Cookies We Use</h2>
            <div className="space-y-4 mt-4">
              <div className="bg-muted p-4 rounded-lg">
                <h3 className="font-semibold text-foreground mb-1">Essential Cookies</h3>
                <p className="text-sm">
                  These cookies are necessary for the platform to function. They enable
                  authentication, security features, and core functionality. Without these, the
                  platform cannot operate. We do not require consent for essential cookies.
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Examples: __client, __session (Clerk authentication), CSRF tokens
                </p>
              </div>

              <div className="bg-muted p-4 rounded-lg">
                <h3 className="font-semibold text-foreground mb-1">Functional Cookies</h3>
                <p className="text-sm">
                  These cookies remember your preferences, such as theme (dark/light mode) and
                  language. They enhance your experience but are not essential.
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Examples: theme preference, onboarding completion state
                </p>
              </div>

              <div className="bg-muted p-4 rounded-lg">
                <h3 className="font-semibold text-foreground mb-1">Analytics Cookies</h3>
                <p className="text-sm">
                  We use analytics to understand how users interact with the platform — which pages
                  are visited, what features are used, and where users encounter errors. This helps
                  us improve the service.
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Examples: Cloudflare Web Analytics (privacy-preserving, no cross-site tracking)
                </p>
              </div>

              <div className="bg-muted p-4 rounded-lg">
                <h3 className="font-semibold text-foreground mb-1">Security Cookies</h3>
                <p className="text-sm">
                  We use cookies to detect and prevent fraud, brute-force attacks, and unauthorized
                  access. These are essential for protecting your account and the platform.
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Examples: rate-limit tokens, device fingerprint data, bot detection signals
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">3. Third-Party Cookies</h2>
            <p>
              We use trusted third-party services that may set cookies on your device:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong>Clerk:</strong> Authentication cookies (__client, __session) — essential for sign-in.</li>
              <li><strong>Cloudflare:</strong> Turnstile CAPTCHA cookies — for bot protection.</li>
              <li><strong>Stripe:</strong> Payment session cookies — only active during checkout.</li>
              <li><strong>Paystack:</strong> Payment session cookies — only active during checkout.</li>
            </ul>
            <p>
              These third parties have their own privacy policies governing how they use cookies.
              We recommend reviewing their policies.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">4. Your Cookie Choices</h2>
            <p>You have several options for managing cookies:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong>Browser Settings:</strong> You can control cookies through your browser settings. Most browsers allow you to block, delete, or alert you about cookies.</li>
              <li><strong>Essential Only:</strong> Essential cookies cannot be disabled — they are required for the platform to function.</li>
              <li><strong>Opt-Out:</strong> You can opt out of analytics cookies at any time. Contact us at Metron@Athenagentic.app to opt out.</li>
            </ul>
            <p>
              Please note: disabling non-essential cookies may affect functionality. For example,
              you may need to sign in more frequently, or theme preferences may not persist.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">5. Cookie Duration</h2>
            <p>
              Cookies are either "session" (deleted when you close your browser) or "persistent"
              (remain until they expire or you delete them). Our cookie durations:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Authentication cookies: Up to 30 days (or until you sign out)</li>
              <li>Theme preference: 1 year</li>
              <li>Analytics cookies: 30 days</li>
              <li>Security cookies: 5 minutes to 24 hours (depending on type)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">6. NDPR Compliance</h2>
            <p>
              Under the NDPR, we are required to obtain your consent before placing non-essential
              cookies on your device. By continuing to use PitchCoach Ai, you consent to our use of
              cookies as described in this policy. You may withdraw consent at any time by
              disabling cookies in your browser settings.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">7. Changes to This Policy</h2>
            <p>
              We may update this Cookie Policy as we add new features or change how we use cookies.
              We will notify you of material changes by posting the updated policy on this page.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">8. Contact Us</h2>
            <p>If you have questions about our use of cookies, contact us:</p>
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
