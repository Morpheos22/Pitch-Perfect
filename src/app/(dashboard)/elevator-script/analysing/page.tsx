"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, FileText, MessageSquare, Sparkles, Edit3, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const statusMessages = [
  { message: "Reading your script...", icon: FileText },
  { message: "Identifying your Hook, Problem, and Solution...", icon: MessageSquare },
  { message: "Scoring each element against the framework...", icon: Edit3 },
  { message: "Writing your rewrite suggestions...", icon: Sparkles },
  { message: "Calculating your estimated spoken duration...", icon: Clock },
  { message: "Preparing your report...", icon: FileText },
];

export default function ElevatorScriptAnalysingPage() {
  const router = useRouter();
  const [currentMessage, setCurrentMessage] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentMessage((prev) => (prev + 1) % statusMessages.length);
    }, 2500);

    const timeout = setTimeout(() => {
      router.push("/elevator-script/session/demo-script");
    }, 15000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [router]);

  const StatusIcon = statusMessages[currentMessage].icon;

  return (
    <div className="max-w-xl mx-auto py-20">
      <Card className="border-primary/20">
        <CardContent className="py-12 text-center">
          <div className="relative w-24 h-24 mx-auto mb-8">
            <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" />
            <div className="absolute inset-2 rounded-full bg-primary/20 animate-pulse" />
            <div className="absolute inset-4 rounded-full bg-primary flex items-center justify-center">
              <StatusIcon className="h-8 w-8 text-primary-foreground animate-pulse" />
            </div>
          </div>

          <h2 className="text-2xl font-bold mb-2">Analysing your pitch...</h2>
          <p className="text-muted-foreground mb-4">
            This usually takes about 30 seconds. Hold tight.
          </p>

          <div className="flex items-center justify-center gap-2 text-sm text-primary">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="animate-pulse">{statusMessages[currentMessage].message}</span>
          </div>

          <div className="flex justify-center gap-2 mt-8">
            {statusMessages.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === currentMessage
                    ? "bg-primary"
                    : index < currentMessage
                    ? "bg-secondary"
                    : "bg-muted"
                }`}
              />
            ))}
          </div>

          <p className="text-xs text-muted-foreground mt-8">
            You can leave this page — your report will be waiting in Session History when it&apos;s ready.
          </p>

          <Button variant="ghost" className="mt-4" onClick={() => router.push("/dashboard")}>
            Return to Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
