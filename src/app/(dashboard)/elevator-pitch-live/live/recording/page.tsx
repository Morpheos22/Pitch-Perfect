"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Video, Mic, Square, AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const MAX_DURATION = 180; // 3 minutes in seconds

export default function LiveRecordingPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [sessionName, setSessionName] = useState("Live Pitch");
  const [recordingMode, setRecordingMode] = useState<"video" | "audio">("video");

  const cleanup = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
  }, []);

  const drawAudioVisualizer = useCallback(() => {
    if (!analyserRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      ctx.fillStyle = "rgb(15, 15, 26)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height * 0.8;
        
        const gradient = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - barHeight);
        gradient.addColorStop(0, "#4AAB9A");
        gradient.addColorStop(1, "#334B79");
        ctx.fillStyle = gradient;
        
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
      }
    };

    draw();
  }, []);

  useEffect(() => {
    // Get session info from storage
    const name = sessionStorage.getItem("liveSessionName") || "Live Pitch";
    const mode = (sessionStorage.getItem("liveRecordingMode") as "video" | "audio") || "video";
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSessionName(name);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecordingMode(mode);

    // Initialize media stream
    const initStream = async () => {
      try {
        const constraints = mode === "video" 
          ? { video: true, audio: true }
          : { audio: true };
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;

        if (mode === "video" && videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.muted = true; // Prevent echo
        }

        // Set up audio analyser for visualization
        audioContextRef.current = new AudioContext();
        analyserRef.current = audioContextRef.current.createAnalyser();
        const source = audioContextRef.current.createMediaStreamSource(stream);
        source.connect(analyserRef.current);
        analyserRef.current.fftSize = 256;

        if (mode === "audio") {
          drawAudioVisualizer();
        }
      } catch (error) {
        console.error("Error accessing media devices:", error);
        router.push("/elevator-pitch-live/live/new");
      }
    };

    initStream();

    return () => {
      cleanup();
    };
  }, [router, cleanup, drawAudioVisualizer]);

  const startRecording = () => {
    if (!streamRef.current) return;

    chunksRef.current = [];
    const mediaRecorder = new MediaRecorder(streamRef.current);
    
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recordingMode === "video" ? "video/webm" : "audio/webm" });
      const url = URL.createObjectURL(blob);
      
      // Store for review page
      sessionStorage.setItem("recordingUrl", url);
      sessionStorage.setItem("recordingDuration", elapsedTime.toString());
      
      router.push("/elevator-pitch-live/live/review");
    };

    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isRecording) {
      interval = setInterval(() => {
        setElapsedTime(prev => {
          const newTime = prev + 1;
          
          // Show warning at 2:30
          if (newTime === 150) {
            setShowWarning(true);
            setTimeout(() => setShowWarning(false), 5000);
          }
          
          // Auto-stop at 3 minutes
          if (newTime >= MAX_DURATION) {
            stopRecording();
          }
          
          return newTime;
        });
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [isRecording]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const remainingTime = MAX_DURATION - elapsedTime;
  const isNearEnd = remainingTime <= 30;

  const handleCancel = () => {
    if (isRecording) {
      setShowCancelDialog(true);
    } else {
      cleanup();
      router.push("/elevator-pitch-live/new");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Minimal Header */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={handleCancel} className="bg-background/80 backdrop-blur">
            <X className="h-4 w-4 mr-1" />
            Cancel
          </Button>
        </div>
        <Badge variant="secondary" className="bg-background/80 backdrop-blur">
          {sessionName}
        </Badge>
      </div>

      {/* Main Content */}
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        {recordingMode === "video" ? (
          /* Video Preview */
          <div className="relative w-full max-w-3xl aspect-video bg-black rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover mirror"
              style={{ transform: "scaleX(-1)" }}
            />
            
            {/* Recording Indicator */}
            {isRecording && (
              <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-500 text-white px-3 py-1 rounded-full">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                REC
              </div>
            )}
            
            {/* Timer */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
              <div className={`text-4xl font-mono font-bold px-4 py-2 rounded-lg ${
                isNearEnd ? "bg-red-500 text-white" : "bg-background/80 text-foreground backdrop-blur"
              }`}>
                {formatTime(elapsedTime)}
                <span className="text-sm font-normal ml-2 opacity-70">
                  / {formatTime(MAX_DURATION)}
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* Audio Visualizer */
          <div className="w-full max-w-2xl">
            <div className="relative">
              <canvas
                ref={canvasRef}
                width={800}
                height={300}
                className="w-full rounded-lg bg-muted"
              />
              
              {/* Recording Indicator */}
              {isRecording && (
                <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-500 text-white px-3 py-1 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  REC
                </div>
              )}
              
              {/* Timer */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
                <div className={`text-4xl font-mono font-bold px-4 py-2 rounded-lg ${
                  isNearEnd ? "bg-red-500 text-white" : "bg-background/80 text-foreground backdrop-blur"
                }`}>
                  {formatTime(elapsedTime)}
                  <span className="text-sm font-normal ml-2 opacity-70">
                    / {formatTime(MAX_DURATION)}
                  </span>
                </div>
              </div>
            </div>
            
            <p className="text-center text-muted-foreground mt-4">
              <Mic className="h-4 w-4 inline mr-1" />
              Recording audio only
            </p>
          </div>
        )}

        {/* Warning */}
        {showWarning && (
          <Alert className="fixed top-20 left-1/2 -translate-x-1/2 w-auto bg-yellow-500 text-yellow-950 border-0">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>30 seconds remaining</AlertDescription>
          </Alert>
        )}

        {/* Controls */}
        <div className="mt-8">
          {!isRecording ? (
            <Button
              size="lg"
              onClick={startRecording}
              className="h-16 px-8 text-lg bg-red-500 hover:bg-red-600 text-white"
            >
              <Video className="h-5 w-5 mr-2" />
              Start Recording
            </Button>
          ) : (
            <Button
              size="lg"
              onClick={stopRecording}
              className="h-16 px-8 text-lg bg-primary hover:bg-primary/90"
            >
              <Square className="h-5 w-5 mr-2" />
              Stop Recording
            </Button>
          )}
        </div>
      </div>

      {/* Cancel Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Recording?</AlertDialogTitle>
            <AlertDialogDescription>
              Your recording will be lost. Are you sure you want to cancel?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continue Recording</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                cleanup();
                router.push("/elevator-pitch-live/new");
              }}
              className="bg-destructive hover:bg-destructive/90"
            >
              Yes, Cancel
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
