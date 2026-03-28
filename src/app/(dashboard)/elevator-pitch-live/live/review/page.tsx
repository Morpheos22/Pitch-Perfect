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

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSessionName(name);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecordingMode(mode);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecordingUrl(url);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDuration(dur);
  }, []);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins} min ${secs} sec`;
  };

  const handleSubmit = () => {
    setIsSubmitting(true);
    // Simulate upload
    setTimeout(() => {
      toast.success("Recording submitted for analysis");
      router.push("/elevator-pitch-live/live/session/demo-live");
    }, 2000);
  };

  const handleRerecord = () => {
    // Clean up stored recording
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
              {recordingMode === "video" ? <Video className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
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
              <span>3 personalized coaching drills based on your weakest areas</span>
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
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Delete and Re-record
          </Button>
          <Button
            className="flex-1 bg-primary hover:bg-primary/90"
            onClick={handleSubmit}
            disabled={isSubmitting}
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
