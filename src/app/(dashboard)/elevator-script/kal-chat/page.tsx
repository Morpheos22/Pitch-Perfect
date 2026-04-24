"use client";

// ═══════════════════════════════════════════════════════════════════════
// KAL PROTOCOL 2.0 — Contextual Chat Page
// ═══════════════════════════════════════════════════════════════════════
//
// This page is the destination when the script check module fails or
// times out. Instead of showing a generic error, the user is redirected
// here to engage with Kal's contextual chatbot.
//
// FLOW:
//   User submits script → Analysis fails → Redirected here with
//   kalV2SessionId + firstQuestion + scriptSessionId as URL params
//
// URL: /elevator-script/kal-chat?session=<kalSessionId>&script=<scriptSessionId>&q=<firstQuestion>

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Loader2, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { KalChatWidget } from "@/components/kal/kal-chat-widget";

function KalChatContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const sessionId = searchParams.get("session") || "";
  const scriptSessionId = searchParams.get("script") || "";
  const firstQuestion = searchParams.get("q") || "";
  const errorMessage = searchParams.get("error") || "";

  // Validate required params
  if (!sessionId || !scriptSessionId) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">Session Not Found</h2>
        <p className="text-muted-foreground mb-4">
          The Kal chat session could not be found. This may happen if the
          session has expired or the link is invalid.
        </p>
        <Button onClick={() => router.push("/dashboard")}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  if (!firstQuestion) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">Missing Chat Data</h2>
        <p className="text-muted-foreground mb-4">
          The chat session data is incomplete. Please try submitting your
          script again.
        </p>
        <Button onClick={() => router.push("/elevator-script/new")}>
          Start New Analysis
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push("/dashboard")}
        className="mb-4"
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        Back to Dashboard
      </Button>

      {/* Error context (if provided) */}
      {errorMessage && (
        <Card className="mb-4 border-yellow-500/20 bg-yellow-500/5">
          <CardContent className="py-3">
            <p className="text-sm text-muted-foreground">
              Your script analysis encountered an issue. Kal is here to help
              while we resolve it in the background.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Chat widget */}
      <Card className="border-primary/10">
        <CardContent className="p-4">
          <KalChatWidget
            sessionId={sessionId}
            firstQuestion={firstQuestion}
            scriptSessionId={scriptSessionId}
            onComplete={(_summary, _feedback) => {
              // Chat completed — user will be redirected to results
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}

export default function KalChatPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-2xl mx-auto flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Loading chat session...</p>
          </div>
        </div>
      }
    >
      <KalChatContent />
    </Suspense>
  );
}
