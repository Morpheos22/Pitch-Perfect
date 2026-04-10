"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Loader2, MessageSquare } from "lucide-react";
import { useRouter } from "next/navigation";

const statusMessages = [
  "Parsing your script...",
  "Analyzing hook effectiveness...",
  "Evaluating problem articulation...",
  "Checking solution clarity...",
  "Assessing proof and credibility...",
  "Reviewing call-to-action...",
  "Analyzing tone and delivery...",
  "Generating rewrite suggestions...",
  "Finalizing your report...",
];

function ScriptAnalysingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");
  const [statusIndex, setStatusIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pollCount, setPollCount] = useState(0);

  // Rotate status messages
  useEffect(() => {
    const interval = setInterval(() => {
      setStatusIndex((prev) => (prev >= statusMessages.length - 1 ? prev : prev + 1));
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  // Simulate progress while waiting
  useEffect(() => {
    if (progress >= 90) return;
    const interval = setInterval(() => {
      setProgress((prev) => (prev >= 90 ? 90 : prev + 1));
    }, 500);
    return () => clearInterval(interval);
  }, [progress]);

  // Poll the API for completion
  useEffect(() => {
    if (!sessionId) {
      router.replace("/elevator-pitch-live/new");
      return;
    }

    const poll = async () => {
      try {
        const res = await fetch(`/api/coach/script?id=${encodeURIComponent(sessionId)}`);
        if (!res.ok) throw new Error("Failed to fetch session");

        const json = await res.json();
        // Script API returns { id, status, ... } — check for COMPLETED status
        if (json.status === "COMPLETED" || json.status === "completed") {
          setProgress(100);
          router.replace(`/elevator-pitch-live/script/session/${encodeURIComponent(sessionId)}`);
          return true;
        }
      } catch (err) {
        // Only show error after multiple failed attempts
        if (pollCount >= 6) {
          setError("Analysis is taking longer than expected. Check your session history.");
        }
      }
      return false;
    };

    // Initial poll after 2s
    const initialTimeout = setTimeout(async () => {
      const done = await poll();
      if (done) return;

      // Then poll every 5s
      const interval = setInterval(async () => {
        const done = await poll();
        setPollCount((prev) => prev + 1);
        if (done || pollCount >= 12) clearInterval(interval);
      }, 5000);

      return () => clearInterval(interval);
    }, 2000);

    return () => clearTimeout(initialTimeout);
  }, [sessionId, router, pollCount]);

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <Card className="w-full max-w-lg">
        <CardContent className="pt-8 pb-8">
          <div className="text-center space-y-6">
            <div className="relative mx-auto w-24 h-24">
              <div className="absolute inset-0 rounded-full bg-accent/10 animate-pulse" />
              <div className="absolute inset-0 flex items-center justify-center">
                <MessageSquare className="w-12 h-12 text-accent" />
              </div>
            </div>
            <div>
              <h2 className="text-xl font-bold mb-2">Analyzing Your Script</h2>
              {error ? (
                <p className="text-destructive text-sm">{error}</p>
              ) : (
                <p className="text-muted-foreground flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {statusMessages[statusIndex]}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-sm text-muted-foreground">{progress}% complete</p>
            </div>
            <p className="text-xs text-muted-foreground">
              You can leave this page — your report will be waiting in your session history.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LiveScriptAnalysingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[80vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <ScriptAnalysingContent />
    </Suspense>
  );
}
