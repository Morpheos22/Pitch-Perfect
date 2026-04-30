"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { SignIn } from "@clerk/nextjs";
import { Card } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

function SignInForm() {
  const searchParams = useSearchParams();
  const reason = searchParams.get("reason");
  const sessionExpired = reason === "session_expired";

  return (
    <Card className="w-full max-w-md p-2 border-0 shadow-xl bg-card/95 backdrop-blur">
      {sessionExpired && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Your session has expired. Please sign in again.</span>
        </div>
      )}
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
          },
        }}
        fallbackRedirectUrl="/dashboard"
        signUpFallbackRedirectUrl="/onboarding"
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
