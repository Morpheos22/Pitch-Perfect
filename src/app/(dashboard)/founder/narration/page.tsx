"use client";

import { useState, useEffect, useRef } from "react";
import { FounderLayout } from "@/components/founder";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Headphones,
  Play,
  Pause,
  Square,
  Volume2,
  ArrowLeft,
  Loader2,
  Download,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";

export default function NarrationPage() {
  const [loading, setLoading] = useState(false);
  const [narrationText, setNarrationText] = useState<string>("");
  const [audioBase64, setAudioBase64] = useState<string>("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string>("");
  const [readinessData, setReadinessData] = useState<any>(null);
  const [pathwayData, setPathwayData] = useState<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch("/api/coach/founder");
        if (!res.ok) return;
        const data = await res.json();

        // Check for existing narration
        const narrationSession = data.allSessions?.find(
          (s: any) => s.moduleType === "PATHWAY_NARRATION" && s.status === "COMPLETED"
        );

        if (narrationSession) {
          const detail = await fetch(`/api/coach/founder?id=${narrationSession.id}`);
          if (detail.ok) {
            const d = await detail.json();
            if (d.resultData?.narrationText) {
              setNarrationText(d.resultData.narrationText);
            }
            if (d.audioBase64) {
              setAudioBase64(d.audioBase64);
              const blob = new Blob(
                [Uint8Array.from(atob(d.audioBase64), (c) => c.charCodeAt(0))],
                { type: "audio/wav" }
              );
              const url = URL.createObjectURL(blob);
              setAudioUrl(url);
            }
            return;
          }
        }

        // Load readiness and pathway data for narration input
        const readinessSession = data.allSessions?.find(
          (s: any) => s.moduleType === "FOUNDER_READINESS" && s.status === "COMPLETED"
        );
        if (readinessSession) {
          const detail = await fetch(`/api/coach/founder?id=${readinessSession.id}`);
          if (detail.ok) {
            const d = await detail.json();
            setReadinessData(d);
          }
        }

        const pathwaySession = data.allSessions?.find(
          (s: any) => s.moduleType === "PATHWAY_RECOMMENDATION" && s.status === "COMPLETED"
        );
        if (pathwaySession) {
          const detail = await fetch(`/api/coach/founder?id=${pathwaySession.id}`);
          if (detail.ok) {
            const d = await detail.json();
            setPathwayData(d);
          }
        }
      } catch (err) {
        console.error("Failed to load narration data:", err);
      }
    }
    loadData();
  }, []);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const input: Record<string, any> = {
        firstName: readinessData?.inputData?.startupName || "Founder",
        startupName: readinessData?.inputData?.startupName || "your startup",
        recommendedPathway:
          pathwayData?.resultData?.recommendedPathway || readinessData?.resultData?.recommendedPathway || "Not yet determined",
        pathwayConfidence:
          pathwayData?.resultData?.confidence || readinessData?.resultData?.pathwayConfidence || "N/A",
        overallScore: readinessData?.resultData?.overallScore || "N/A",
        strengths: readinessData?.resultData?.strengths?.join(", ") || "To be determined",
        improvements: readinessData?.resultData?.improvements?.join(", ") || "To be determined",
        nextSteps: readinessData?.resultData?.nextSteps?.join(", ") || "Complete your assessment",
        pathADetails: "Discounted cohort → Small Axe education → 1-on-1 mentorship → Certification → AfriFlow → Network",
        pathBDetails: "Full price → Deck before VCs/investors → Immediate access → Network",
      };

      const res = await fetch("/api/coach/founder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moduleType: "PATHWAY_NARRATION",
          input,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Narration failed");

      if (data.data?.narrationText) {
        setNarrationText(data.data.narrationText);
      }

      if (data.audioBase64) {
        setAudioBase64(data.audioBase64);
        const blob = new Blob(
          [Uint8Array.from(atob(data.audioBase64), (c) => c.charCodeAt(0))],
          { type: "audio/wav" }
        );
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        toast.success("Narration generated with audio!");
      } else {
        toast.success("Narration text generated! (Audio unavailable)");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate narration");
    } finally {
      setLoading(false);
    }
  };

  const togglePlay = () => {
    if (!audioUrl) return;

    if (!audioRef.current) {
      audioRef.current = new Audio(audioUrl);
      audioRef.current.onended = () => setIsPlaying(false);
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleDownload = () => {
    if (!audioBase64) return;
    const byteChars = atob(audioBase64);
    const byteNumbers = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
      byteNumbers[i] = byteChars.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: "audio/wav" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pathway-narration.wav";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Audio downloaded!");
  };

  const handleRegenerate = () => {
    setNarrationText("");
    setAudioBase64("");
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl("");
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsPlaying(false);
  };

  const hasRequiredData = readinessData || pathwayData;

  return (
    <FounderLayout
      title="Pathway Narration"
      subtitle="TTS-narrated overview of your recommended pathway"
    >
      {/* Info Card */}
      <Card className="border-amber-500/20 bg-amber-500/5">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Volume2 className="w-5 h-5 text-amber-500 mt-0.5" />
            <div>
              <h3 className="font-medium text-sm">Audio Narration</h3>
              <p className="text-xs text-muted-foreground mt-1">
                This module generates a conversational narration of your pathway recommendation
                and converts it to speech using Z.ai TTS. Requires completed Readiness and
                Pathway assessments for best results.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status */}
      {!narrationText && !loading && (
        <Card>
          <CardContent className="py-8 text-center">
            <Headphones className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold mb-2">
              {hasRequiredData
                ? "Ready to Generate Narration"
                : "Complete Previous Assessments"}
            </h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
              {hasRequiredData
                ? "We have your assessment data. Generate a TTS narration of your pathway and next steps."
                : "Complete the Founder Readiness and Pathway Recommendation modules first for a personalized narration."}
            </p>
            {!hasRequiredData && (
              <div className="flex justify-center gap-2 mb-4">
                <Link href="/founder/readiness">
                  <Button variant="outline" size="sm">Go to Readiness</Button>
                </Link>
                <Link href="/founder/pathway">
                  <Button variant="outline" size="sm">Go to Pathway</Button>
                </Link>
              </div>
            )}
            <Button
              onClick={handleGenerate}
              disabled={!hasRequiredData || loading}
              className="gap-2 bg-primary hover:bg-primary/90"
            >
              <Headphones className="w-4 h-4" />
              Generate Narration
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {loading && (
        <Card>
          <CardContent className="py-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
            <h3 className="font-semibold mb-1">Generating Narration</h3>
            <p className="text-sm text-muted-foreground">
              Creating your pathway narration and converting to speech...
            </p>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {narrationText && !loading && (
        <>
          {/* Audio Player */}
          {audioUrl && (
            <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
              <CardContent className="py-6">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-3">
                    <Button
                      onClick={togglePlay}
                      size="lg"
                      className="rounded-full w-14 h-14 bg-primary hover:bg-primary/90 p-0"
                    >
                      {isPlaying ? (
                        <Pause className="w-6 h-6" />
                      ) : (
                        <Play className="w-6 h-6 ml-0.5" />
                      )}
                    </Button>
                    <div>
                      <p className="font-medium text-sm">Pathway Narration</p>
                      <p className="text-xs text-muted-foreground">
                        {isPlaying ? "Playing..." : "Press to play"}
                      </p>
                    </div>
                  </div>
                  <div className="flex-1" />
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      <Volume2 className="w-3 h-3 mr-1" />
                      TTS Audio
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDownload}
                      className="gap-1"
                    >
                      <Download className="w-3 h-3" />
                      Download
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Narration Text */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Narration Script</CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(narrationText);
                      toast.success("Narration copied!");
                    }}
                  >
                    Copy
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRegenerate}
                    className="gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Regenerate
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="bg-muted/50 rounded-lg p-4 max-h-96 overflow-y-auto">
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{narrationText}</p>
              </div>
            </CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex justify-between">
            <Link href="/founder/network">
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="w-4 h-4" /> Network Profile
              </Button>
            </Link>
            <Link href="/founder">
              <Button className="gap-2 bg-primary hover:bg-primary/90">
                Back to Founder Hub
              </Button>
            </Link>
          </div>
        </>
      )}
    </FounderLayout>
  );
}
