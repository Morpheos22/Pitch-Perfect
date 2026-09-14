"use client";

import { SignUp } from "@clerk/nextjs";
import { Card } from "@/components/ui/card";
import { Fingerprint, ShieldCheck } from "lucide-react";

export default function SignUpPage() {
  return (
    <Card className="w-full max-w-md p-2 border-0 shadow-xl bg-card/95 backdrop-blur">
      {/* Security note shown above the sign-up card — surfaces device tracking */}
      <div className="mb-3 flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
        <Fingerprint className="h-4 w-4 shrink-0 text-primary mt-0.5" />
        <div>
          <p className="font-medium text-foreground mb-0.5 flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5" />
            Secured sign-up
          </p>
          <p>
            Your device is captured at sign-up to protect your account.
            Sign up with email, Google, GitHub, or your phone number.
          </p>
        </div>
      </div>

      {/*
        Clerk's <SignUp /> component auto-renders ALL authentication methods
        that are enabled in the Clerk dashboard — same as <SignIn />.
        Passkey enrollment happens AFTER sign-up, on the account page.
      */}
      <SignUp
        appearance={{
          elements: {
            rootBox: "w-full",
            card: "bg-transparent shadow-none",
            headerTitle: "text-2xl font-bold",
            headerSubtitle: "text-muted-foreground",
            formButtonPrimary: "bg-primary hover:bg-primary/90 text-primary-foreground",
            formFieldInput: "border-input focus:ring-primary",
            footerActionLink: "text-primary hover:text-primary/80",
            socialButtonsBlockButton: "border-border hover:bg-muted text-foreground",
            socialButtonsBlockButtonText: "text-foreground",
            alternativeAuthBlockButton: "border-border hover:bg-muted text-foreground",
            alternativeAuthBlockButtonArrow: "text-muted-foreground",
          },
        }}
        fallbackRedirectUrl="/onboarding"
        signInFallbackRedirectUrl="/dashboard"
      />
    </Card>
  );
}
