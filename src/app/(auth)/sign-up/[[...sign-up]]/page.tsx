"use client";

import { SignUp } from "@clerk/nextjs";
import { Card } from "@/components/ui/card";

export default function SignUpPage() {
  return (
    <Card className="w-full max-w-md p-2 border-0 shadow-xl bg-card/95 backdrop-blur">
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
          },
        }}
        fallbackRedirectUrl="/onboarding"
        signInFallbackRedirectUrl="/dashboard"
      />
    </Card>
  );
}
