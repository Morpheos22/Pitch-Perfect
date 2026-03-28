"use client";

import { useEffect, useState } from "react";
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

export default function LiveScriptAnalysingPage() {
  const router = useRouter();
  const [progress, setProgress] = useState(0);
  const [statusIndex, setStatusIndex] = useState(0);

  useEffect(() => {
    const progressInterval = setInterval(() => {
      setProgress((prev) => (prev >= 100 ? 100 : prev + 2));
    }, 150);

    const statusInterval = setInterval(() => {
      setStatusIndex((prev) => (prev >= statusMessages.length - 1 ? prev : prev + 1));
    }, 1800);

    const timeout = setTimeout(() => {
      router.push("/elevator-pitch-live/script/session/demo-123");
    }, 7500);

    return () => {
      clearInterval(progressInterval);
      clearInterval(statusInterval);
      clearTimeout(timeout);
    };
  }, [router]);

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
              <p className="text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                {statusMessages[statusIndex]}
              </p>
            </div>
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-sm text-muted-foreground">{progress}% complete</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
