"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Loader2, TrendingUp, Video, FileText, Brain, Target, MessageSquare } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

const statusMessages = [
  { message: "Uploading video to secure storage...", icon: Video },
  { message: "Processing video frames...", icon: Video },
  { message: "Extracting audio for transcript...", icon: MessageSquare },
  { message: "Analyzing pitch deck content...", icon: FileText },
  { message: "Evaluating Problem-Solution Fit...", icon: Target },
  { message: "Assessing Market Opportunity...", icon: Target },
  { message: "Reviewing Business Model...", icon: Target },
  { message: "Analyzing Team Credibility...", icon: Target },
  { message: "Evaluating Traction & Milestones...", icon: Target },
  { message: "Assessing Delivery & Presence...", icon: Target },
  { message: "Generating investor Q&A preparation...", icon: Brain },
  { message: "Compiling comprehensive report...", icon: TrendingUp },
];

export default function FullPitchAnalysingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");
  
  const [progress, setProgress] = useState(0);
  const [statusIndex, setStatusIndex] = useState(0);

  useEffect(() => {
    if (!sessionId) {
      router.push("/coach/full/new");
      return;
    }

    const progressInterval = setInterval(() => {
      setProgress((prev) => (prev >= 95 ? 95 : prev + 1.5));
    }, 200);

    const statusInterval = setInterval(() => {
      setStatusIndex((prev) => (prev >= statusMessages.length - 1 ? prev : prev + 1));
    }, 2500);

    // Poll for session completion
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/coach/full?id=${sessionId}`);
        const data = await response.json();
        
        if (data.success && data.data?.status === "COMPLETED") {
          clearInterval(pollInterval);
          clearInterval(progressInterval);
          clearInterval(statusInterval);
          router.push(`/coach/full/session/${sessionId}`);
        }
      } catch (error) {
        console.error("Polling error:", error);
      }
    }, 5000);

    // Timeout fallback (analysis shouldn't take more than 5 minutes)
    const timeout = setTimeout(() => {
      router.push(`/coach/full/session/${sessionId}`);
    }, 300000);

    return () => {
      clearInterval(progressInterval);
      clearInterval(statusInterval);
      clearInterval(pollInterval);
      clearTimeout(timeout);
    };
  }, [router, sessionId]);

  const CurrentIcon = statusMessages[statusIndex].icon;

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <Card className="w-full max-w-xl">
        <CardContent className="pt-10 pb-10">
          <div className="text-center space-y-8">
            {/* Animated Icon */}
            <div className="relative mx-auto w-28 h-28">
              <div className="absolute inset-0 rounded-full bg-emerald-500/10 animate-pulse" />
              <div className="absolute inset-2 rounded-full bg-emerald-500/20 animate-pulse delay-150" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative">
                  <TrendingUp className="w-14 h-14 text-emerald-500" />
                  <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 animate-ping" />
                </div>
              </div>
            </div>

            {/* Title */}
            <div>
              <h2 className="text-2xl font-bold mb-2">Full Pitch Analysis</h2>
              <p className="text-muted-foreground">
                Comprehensive investor readiness assessment in progress
              </p>
            </div>

            {/* Status */}
            <div className="flex items-center justify-center gap-3 text-emerald-600">
              <Loader2 className="w-5 h-5 animate-spin" />
              <CurrentIcon className="w-5 h-5" />
              <span className="text-sm font-medium">
                {statusMessages[statusIndex].message}
              </span>
            </div>

            {/* Progress */}
            <div className="space-y-3">
              <Progress value={progress} className="h-3" />
              <p className="text-sm text-muted-foreground">
                {Math.round(progress)}% complete
              </p>
            </div>

            {/* Info Box */}
            <div className="p-4 bg-muted/50 rounded-lg text-left">
              <h4 className="font-medium text-sm mb-2">What's happening:</h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Video being analyzed by GLM-4V-Plus AI model</li>
                <li>• 6-dimension investor readiness scoring</li>
                <li>• Delivery and body language assessment</li>
                <li>• Q&A preparation with anticipated questions</li>
                <li>• Competitive context and recommendations</li>
              </ul>
            </div>

            {/* Estimated Time */}
            <p className="text-xs text-muted-foreground">
              Full analysis typically takes 2-5 minutes depending on video length
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
