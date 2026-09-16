"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { SignIn } from "@clerk/nextjs";
import { Card } from "@/components/ui/card";
import { AlertCircle, Fingerprint, ShieldCheck } from "lucide-react";

function SignInForm() {
  const searchParams = useSearchParams();
  const reason = searchParams.get("reason");
  const sessionExpired = reason === "session_expired";
  const blockedAccount = reason === "blocked_account";

  return (
    <Card className="w-full max-w-md p-2 border-0 shadow-xl bg-card/95 backdrop-blur">
      {sessionExpired && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Your session has expired. Please sign in again.</span>
        </div>
      )}
      {blockedAccount && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>This account has been blocked. Contact Metron@Athenagentic.app if you believe this is an error.</span>
        </div>
      )}

      {/* Security note shown above the sign-in card — surfaces device tracking */}
      <div className="mb-3 flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
        <Fingerprint className="h-4 w-4 shrink-0 text-primary mt-0.5" />
        <div>
          <p className="font-medium text-foreground mb-0.5 flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5" />
            Secured sign-in
          </p>
          <p>
            Your device is fingerprinted on sign-in to protect your account.
            Sign in with email, Google, GitHub, passkey, or your phone number.
          </p>
        </div>
      </div>

      {/*
        Clerk's <SignIn /> component auto-renders ALL authentication methods
        that are enabled in the Clerk dashboard:
          - Email + password
          - Email + OTP code
          - Phone number (SMS)
          - Passkey (WebAuthn) — appears as a "Sign in with Passkey" button
          - Google, GitHub, Apple, Microsoft, etc. — appear as social buttons

        To enable any of these, the operator must toggle them on in the
        Clerk dashboard at:
          User & Authentication → Authentication → Social / Passkey / Phone

        See src/lib/clerk-config.ts for the full operator checklist.
      */}
      <SignIn
        appearance={{
          elements: {
            rootBox: "w-full",
            card: "bg-transparent shadow-none",
            headerTitle: "text-2xl font-bold",
            headerSubtitle: "text-muted-foreground",
            formButtonPrimary: "bg-primary hover:bg-primary/90 text-primary-foreground",
            formFieldInput: "border-input focus:ring-primary",
            footerActionLink: "text-primary hover:text-primary/80",
            identityPreviewText: "text-foreground",
            identityPreviewEditButton: "text-primary hover:text-primary/80",
            // Make social buttons + passkey button render full-width and
            // properly spaced. Clerk's default already does this; these
            // rules just ensure consistency with our theme.
            socialButtonsBlockButton: "border-border hover:bg-muted text-foreground",
            socialButtonsBlockButtonText: "text-foreground",
            alternativeAuthBlockButton: "border-border hover:bg-muted text-foreground",
            alternativeAuthBlockButtonArrow: "text-muted-foreground",
          },
        }}
        // Force the sign-in to show ALL enabled providers, even if the user
        // started typing an email. Without this, Clerk hides social buttons
        // after the user focuses the email field.
        signUpFallbackRedirectUrl="/onboarding"
        fallbackRedirectUrl="/dashboard"
      />
    </Card>
  );
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}
