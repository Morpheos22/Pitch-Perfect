"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Video, Mic, AlertCircle, CheckCircle, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";

export default function LiveRecordingNewPage() {
  const router = useRouter();
  const [sessionName, setSessionName] = useState("");
  const [recordingMode, setRecordingMode] = useState<"video" | "audio">("video");
  const [isStarting, setIsStarting] = useState(false);

  const handleStartRecording = async () => {
    if (!sessionName.trim()) {
      toast.error("Please enter a session name");
      return;
    }

    setIsStarting(true);
    
    // Request permissions
    try {
      const constraints = recordingMode === "video" 
        ? { video: true, audio: true }
        : { audio: true };
      
      await navigator.mediaDevices.getUserMedia(constraints);
      
      // Store session info and navigate to recording
      sessionStorage.setItem("liveSessionName", sessionName);
      sessionStorage.setItem("liveRecordingMode", recordingMode);
      
      router.push("/elevator-pitch-live/live/recording");
    } catch (error) {
      toast.error(`Permission denied. Please allow ${recordingMode === "video" ? "camera and microphone" : "microphone"} access.`);
      setIsStarting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Button variant="ghost" size="sm" onClick={() => router.push("/elevator-pitch-live/new")} className="mb-2">
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <h1 className="text-2xl font-bold">Live Elevator Pitch</h1>
        <p className="text-muted-foreground">Record yourself delivering your pitch</p>
      </div>

      {/* Session Counter */}
      <Card className="border-primary/20">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Live recording session</p>
              <p className="font-semibold">Session 2 of 3</p>
            </div>
            <Badge variant="secondary">2 sessions remaining</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Script Reminder */}
      <Card className="border-secondary/30 bg-secondary/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-secondary" />
            From Your Last Script Session
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-2">Your top priority actions were:</p>
          <ol className="text-sm space-y-1 list-decimal list-inside">
            <li>Add a specific metric or customer testimonial to your Proof section</li>
            <li>Make your Ask more specific</li>
            <li>Consider shortening your Hook</li>
          </ol>
        </CardContent>
      </Card>

      {/* Session Name */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Name This Session</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="e.g., Live pitch — attempt 1"
            value={sessionName}
            onChange={(e) => setSessionName(e.target.value)}
            maxLength={80}
          />
        </CardContent>
      </Card>

      {/* Recording Mode */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recording Mode</CardTitle>
          <CardDescription>Choose how you want to record your pitch</CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup value={recordingMode} onValueChange={(v) => setRecordingMode(v as "video" | "audio")} className="space-y-3">
            <div className={`flex items-start gap-4 p-4 rounded-lg border cursor-pointer ${
              recordingMode === "video" ? "border-primary bg-primary/5" : "border-border"
            }`} onClick={() => setRecordingMode("video")}>
              <RadioGroupItem value="video" id="video" className="mt-1" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Label htmlFor="video" className="font-medium cursor-pointer">Video</Label>
                  <Badge variant="secondary">Recommended</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Records camera and microphone. Enables body language analysis (eye contact, posture, gestures).
                </p>
              </div>
              <Video className="h-5 w-5 text-muted-foreground" />
            </div>

            <div className={`flex items-start gap-4 p-4 rounded-lg border cursor-pointer ${
              recordingMode === "audio" ? "border-primary bg-primary/5" : "border-border"
            }`} onClick={() => setRecordingMode("audio")}>
              <RadioGroupItem value="audio" id="audio" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="audio" className="font-medium cursor-pointer">Audio only</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Records microphone only. Enables vocal delivery feedback. Use this if camera is unavailable.
                </p>
              </div>
              <Mic className="h-5 w-5 text-muted-foreground" />
            </div>
          </RadioGroup>

          {recordingMode === "video" && (
            <Alert className="mt-4">
              <AlertDescription className="text-sm">
                Your recording is stored securely in your account. It is never shared without your permission.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* What You'll Be Evaluated On */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">What You&apos;ll Be Evaluated On</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="font-medium mb-2">Vocal Delivery</p>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Pacing</li>
                <li>• Clarity</li>
                <li>• Energy</li>
                <li>• Confidence</li>
              </ul>
            </div>
            {recordingMode === "video" && (
              <div>
                <p className="font-medium mb-2">Body Language</p>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• Eye contact</li>
                  <li>• Posture</li>
                  <li>• Gestures</li>
                </ul>
              </div>
            )}
          </div>
          <Alert className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Maximum recording time: <strong>3 minutes</strong>. You&apos;ll be warned at 2:30.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-between items-center">
        <Button variant="outline" onClick={() => router.push("/elevator-pitch-live/new")}>
          Cancel
        </Button>
        <Button
          onClick={handleStartRecording}
          disabled={!sessionName.trim() || isStarting}
          className="bg-primary hover:bg-primary/90"
        >
          {isStarting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
              Requesting permissions...
            </>
          ) : (
            <>
              <Video className="h-4 w-4 mr-2" />
              Start Recording
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
