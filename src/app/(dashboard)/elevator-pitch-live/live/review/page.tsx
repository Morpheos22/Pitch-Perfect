"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Play, RotateCcw, CheckCircle, Video, Mic, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

export default function LiveRecordingReviewPage() {
  const router = useRouter();
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement>(null);

  const [sessionName, setSessionName] = useState("Live Pitch");
  const [recordingMode, setRecordingMode] = useState<"video" | "audio">("video");
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const name = sessionStorage.getItem("liveSessionName") || "Live Pitch";
    const mode = (sessionStorage.getItem("liveRecordingMode") as "video" | "audio") || "video";
    const url = sessionStorage.getItem("recordingUrl");
    const dur = parseInt(sessionStorage.getItem("recordingDuration") || "0");

    setSessionName(name);
    setRecordingMode(mode);
    setRecordingUrl(url);
    setDuration(dur);
  }, []);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins} min ${secs} sec`;
  };

  const handleSubmit = async () => {
    if (!recordingUrl) {
      toast.error("No recording available");
      return;
    }

    setIsSubmitting(true);

    try {
      // Step 1: Convert blob URL to a File
      const response = await fetch(recordingUrl);
      const blob = await response.blob();

      const mimeType = recordingMode === "video" ? "video/webm" : "audio/webm";
      const extension = recordingMode === "video" ? "webm" : "webm";
      const fileName = `${sessionName.replace(/[^a-zA-Z0-9]/g, "_")}_${Date.now()}.${extension}`;

      const file = new File([blob], fileName, { type: mimeType });

      let downloadUrl: string;

      // Step 2: Upload — use client-side blob upload for files >4MB to bypass
      // Vercel's 4.5MB serverless body limit. Fall back to server route for small files.
      const VERCEL_BODY_LIMIT = 4 * 1024 * 1024; // 4MB safety margin

      if (file.size > VERCEL_BODY_LIMIT) {
        // Large file: client-side direct upload to Vercel Blob
        const { uploadFileToBlob } = await import("@/lib/blob-upload");
        const blobResult = await uploadFileToBlob(file, "video");
        downloadUrl = blobResult.url;
      } else {
        // Small file: server-side upload (supports WorkDrive fallback)
        const videoFormData = new FormData();
        videoFormData.append("video", file);
        videoFormData.append("type", "live");

        const videoRes = await fetch("/api/video", {
          method: "POST",
          body: videoFormData,
        });

        if (!videoRes.ok) {
          const videoError = await videoRes.json();
          throw new Error(videoError.error || "Failed to upload video");
        }

        const videoData = await videoRes.json();
        downloadUrl = videoData.downloadUrl;
      }

      // Step 3: Trigger analysis via POST /api/coach/live
      const analysisFormData = new FormData();
      analysisFormData.append("videoUrl", downloadUrl);
      analysisFormData.append("duration", duration.toString());

      const analysisRes = await fetch("/api/coach/live", {
        method: "POST",
        body: analysisFormData,
      });

      if (!analysisRes.ok) {
        const analysisError = await analysisRes.json();
        if (analysisRes.status === 403) {
          toast.error("Usage limit reached. Please upgrade your plan.");
          router.push("/pricing");
          return;
        }
        throw new Error(analysisError.error || "Analysis failed");
      }

      const analysisData = await analysisRes.json();
      const sessionId = analysisData.id;

      toast.success("Recording submitted for analysis!");

      // Clean up sessionStorage
      if (recordingUrl) {
        URL.revokeObjectURL(recordingUrl);
        sessionStorage.removeItem("recordingUrl");
      }

      // Navigate to the session page
      router.push(`/elevator-pitch-live/live/session/${sessionId}`);
    } catch (error) {
      console.error("Submit error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to submit recording");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRerecord = () => {
    if (recordingUrl) {
      URL.revokeObjectURL(recordingUrl);
      sessionStorage.removeItem("recordingUrl");
    }
    router.push("/elevator-pitch-live/live/new");
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Review Your Recording</h1>
        <p className="text-muted-foreground">Watch or listen back before submitting</p>
      </div>

      {/* Playback Card */}
      <Card className="border-primary/20">
        <CardContent className="p-0">
          {recordingUrl ? (
            recordingMode === "video" ? (
              <video
                ref={mediaRef as React.RefObject<HTMLVideoElement>}
                src={recordingUrl}
                controls
                autoPlay
                className="w-full rounded-t-lg"
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
              />
            ) : (
              <div className="p-8">
                <audio
                  ref={mediaRef as React.RefObject<HTMLAudioElement>}
                  src={recordingUrl}
                  controls
                  autoPlay
                  className="w-full"
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => setIsPlaying(false)}
                />
              </div>
            )
          ) : (
            <div className="aspect-video flex items-center justify-center bg-muted rounded-t-lg">
              <p className="text-muted-foreground">No recording available</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recording Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recording Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Session name</span>
            <span className="font-medium">{sessionName}</span>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Mode</span>
            <Badge variant="secondary" className="flex items-center gap-1">
              {recordingMode === "video" ? <Video className="h-3 h-3" /> : <Mic className="h-3 h-3" />}
              {recordingMode === "video" ? "Video" : "Audio only"}
            </Badge>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Duration</span>
            <span className="font-medium flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {formatDuration(duration)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* What Happens Next */}
      <Card className="border-secondary/30 bg-secondary/5">
        <CardHeader>
          <CardTitle className="text-lg">What Happens Next?</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-secondary shrink-0 mt-0.5" />
              <span>Vocal delivery analysis: pacing, clarity, energy, confidence</span>
            </li>
            {recordingMode === "video" && (
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-secondary shrink-0 mt-0.5" />
                <span>Body language analysis: eye contact, posture, gestures</span>
              </li>
            )}
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-secondary shrink-0 mt-0.5" />
              <span>Personalized coaching feedback based on your performance</span>
            </li>
          </ul>
          <p className="text-sm text-muted-foreground mt-4">
            Analysis takes about 45 seconds.
          </p>
        </CardContent>
      </Card>

      {/* Decision Prompt */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Happy with this recording?</CardTitle>
          <CardDescription>
            Submit it for coaching feedback, or delete it and start again. 
            Deleting won&apos;t use one of your sessions.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleRerecord}
            disabled={isSubmitting}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Delete and Re-record
          </Button>
          <Button
            className="flex-1 bg-primary hover:bg-primary/90"
            onClick={handleSubmit}
            disabled={isSubmitting || !recordingUrl}
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                Uploading...
              </>
            ) : (
              <>
                Submit for Analysis
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Back Button */}
      <Button variant="ghost" onClick={() => router.push("/elevator-pitch-live/new")}>
        Cancel and go back
      </Button>
    </div>
  );
}
