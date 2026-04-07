"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Upload, 
  FileText, 
  Video, 
  ChevronDown, 
  ChevronUp, 
  CheckCircle, 
  AlertCircle,
  TrendingUp,
  Plus,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { safeJson } from "@/lib/safe-fetch";

const sixDimensions = [
  { name: "Problem-Solution Fit", description: "Does your solution address a real, urgent problem?" },
  { name: "Market Opportunity", description: "Is the market size attractive and achievable?" },
  { name: "Business Model Viability", description: "Clear path to revenue and profitability?" },
  { name: "Team Credibility", description: "Can this team execute the vision?" },
  { name: "Traction & Milestones", description: "Evidence of progress and momentum?" },
  { name: "Delivery & Presence", description: "Confident, engaging presentation style?" },
];

const investorReadinessLevels = [
  { level: "NOT_READY", range: "0-40", description: "Significant work needed before investor meetings" },
  { level: "NEEDS_WORK", range: "41-60", description: "Promising but has gaps to address" },
  { level: "INVESTOR_READY", range: "61-80", description: "Ready for investor conversations" },
  { level: "HIGHLY_PREPARED", range: "81-100", description: "Exceptional pitch that stands out" },
];

export default function FullPitchNewPage() {
  const router = useRouter();
  const [sessionName, setSessionName] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [deckFile, setDeckFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [frameworkExpanded, setFrameworkExpanded] = useState(true);
  const [videoUploading, setVideoUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleVideoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const validTypes = ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo"];
    const validExtensions = [".mp4", ".webm", ".mov", ".avi"];
    const ext = selectedFile.name.toLowerCase().substring(selectedFile.name.lastIndexOf("."));

    if (!validTypes.includes(selectedFile.type) && !validExtensions.includes(ext)) {
      toast.error("Only MP4, WebM, MOV, and AVI files are supported");
      return;
    }
    if (selectedFile.size > 500 * 1024 * 1024) {
      toast.error("Video exceeds the 500MB limit");
      return;
    }

    setVideoFile(selectedFile);
  };

  const handleDeckChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const validTypes = [
      "application/pdf",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    ];
    const validExtensions = [".pdf", ".pptx", ".ppt"];
    const ext = selectedFile.name.toLowerCase().substring(selectedFile.name.lastIndexOf("."));

    if (!validTypes.includes(selectedFile.type) && !validExtensions.includes(ext)) {
      toast.error("Only PDF, PPTX, and PPT files are supported");
      return;
    }
    if (selectedFile.size > 50 * 1024 * 1024) {
      toast.error("Deck file exceeds the 50MB limit");
      return;
    }

    setDeckFile(selectedFile);
  };

  const handleSubmit = async () => {
    if (!sessionName.trim()) {
      toast.error("Please enter a session name");
      return;
    }
    if (!videoFile) {
      toast.error("Please upload a video recording");
      return;
    }

    setUploading(true);
    setVideoUploading(true);
    setUploadProgress(0);

    try {
      // Step 1: Upload video to storage via /api/video (FormData with actual file)
      setUploadProgress(5);
      const videoFormData = new FormData();
      videoFormData.append("video", videoFile);
      videoFormData.append("type", "full");

      const videoUploadRes = await fetch("/api/video", {
        method: "POST",
        body: videoFormData,
      });

      const videoUploadData = await safeJson(videoUploadRes);
      const { videoId, downloadUrl } = videoUploadData;
      setUploadProgress(40);
      setVideoUploading(false);

      // Step 2: Confirm video upload
      await fetch("/api/video", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId, duration: 0 }),
      });

      setUploadProgress(60);

      // Step 3: Submit for AI analysis via /api/coach/full (FormData)
      const analysisFormData = new FormData();
      analysisFormData.append("videoUrl", downloadUrl);
      analysisFormData.append("videoId", videoId);
      analysisFormData.append("sessionName", sessionName);
      analysisFormData.append("duration", "900"); // Default 15 min

      if (deckFile) {
        analysisFormData.append("deckContent", await deckFile.text());
      }

      setUploadProgress(70);

      const analysisRes = await fetch("/api/coach/full", {
        method: "POST",
        body: analysisFormData,
      });

      const analysisData = await safeJson(analysisRes);

      setUploadProgress(100);
      toast.success("Analysis complete!");
      
      // Navigate to session results page directly (API is synchronous)
      router.push(`/coach/full/session/${analysisData.id}`);

    } catch (error: any) {
      console.error("Upload error:", error);
      if (error?.status === 403) {
        toast.error(error.message || "Usage limit reached. Please upgrade your plan.");
        router.push("/pricing");
        return;
      }
      if (error?.status === 401) {
        toast.error("Please sign in to continue");
        router.push("/sign-in");
        return;
      }
      toast.error(error instanceof Error ? error.message : "Failed to start analysis");
    } finally {
      setUploading(false);
      setVideoUploading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-emerald-500" />
          Full Pitch Session
        </h1>
        <p className="text-muted-foreground">
          Complete 30-minute investor pitch analysis with deck and video
        </p>
      </div>

      {/* Session Counter */}
      <Card className="border-emerald-500/20 bg-emerald-500/5">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Full Session</p>
              <p className="font-semibold">E4 — Comprehensive Analysis</p>
            </div>
            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600">
              Most In-Depth
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* What We Evaluate */}
      <Card>
        <CardHeader className="cursor-pointer" onClick={() => setFrameworkExpanded(!frameworkExpanded)}>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">6-Dimension Investor Readiness</CardTitle>
              <CardDescription>Your pitch will be evaluated against investor criteria</CardDescription>
            </div>
            {frameworkExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </div>
        </CardHeader>
        {frameworkExpanded && (
          <CardContent className="space-y-6">
            {/* Dimensions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {sixDimensions.map((dim) => (
                <div key={dim.name} className="flex items-start gap-2 text-sm p-2 rounded-lg bg-muted/30">
                  <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-medium">{dim.name}</span>
                    <p className="text-muted-foreground text-xs">{dim.description}</p>
                  </div>
                </div>
              ))}
            </div>

            <Separator />

            {/* Readiness Levels */}
            <div>
              <h4 className="font-medium mb-3">Investor Readiness Levels</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {investorReadinessLevels.map((lvl) => (
                  <div key={lvl.level} className="text-center p-2 rounded-lg bg-muted/30">
                    <p className="font-semibold text-sm">{lvl.level.replace("_", " ")}</p>
                    <p className="text-xs text-muted-foreground">{lvl.range}</p>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Session Name */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Name This Session</CardTitle>
          <CardDescription>Give your session a descriptive name for easy reference</CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="e.g., Series A Pitch — Q1 2026 or Demo Day Rehearsal"
            value={sessionName}
            onChange={(e) => setSessionName(e.target.value)}
            maxLength={80}
          />
          <p className="text-xs text-muted-foreground mt-2">{sessionName.length}/80 characters</p>
        </CardContent>
      </Card>

      {/* Video Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Video className="w-5 h-5 text-emerald-500" />
            Pitch Video Recording
          </CardTitle>
          <CardDescription>MP4, WebM, MOV, or AVI • Maximum 500MB • Up to 30 minutes</CardDescription>
        </CardHeader>
        <CardContent>
          {!videoFile ? (
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-emerald-500/50 transition-colors cursor-pointer">
              <input
                type="file"
                accept="video/mp4,video/webm,video/quicktime,video/x-msvideo,.mp4,.webm,.mov,.avi"
                onChange={handleVideoChange}
                className="hidden"
                id="video-upload"
              />
              <label htmlFor="video-upload" className="cursor-pointer">
                <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="font-medium">Drag your video here, or click to browse</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Upload your full pitch presentation recording
                </p>
              </label>
            </div>
          ) : (
            <div className="flex items-center justify-between p-4 bg-emerald-500/10 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <Video className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="font-medium">{videoFile.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(videoFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-emerald-500" />
                <Button variant="ghost" size="sm" onClick={() => setVideoFile(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Deck Upload (Optional) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Pitch Deck (Optional)
          </CardTitle>
          <CardDescription>
            PDF, PPTX, or PPT • Include for combined analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!deckFile ? (
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer">
              <input
                type="file"
                accept=".pdf,.pptx,.ppt"
                onChange={handleDeckChange}
                className="hidden"
                id="deck-upload"
              />
              <label htmlFor="deck-upload" className="cursor-pointer">
                <Plus className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="font-medium text-sm">Add pitch deck (optional)</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Combines deck content with video analysis
                </p>
              </label>
            </div>
          ) : (
            <div className="flex items-center justify-between p-4 bg-primary/10 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{deckFile.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(deckFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-secondary" />
                <Button variant="ghost" size="sm" onClick={() => setDeckFile(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Progress */}
      {uploading && (
        <Card className="border-emerald-500/20">
          <CardContent className="py-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>{videoUploading ? "Uploading video..." : "Starting analysis..."}</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Submit */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => router.push("/dashboard")}>
          Back to Dashboard
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!sessionName.trim() || !videoFile || uploading}
          className="bg-emerald-500 hover:bg-emerald-500/90"
        >
          {uploading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
              Processing...
            </>
          ) : (
            "Start Full Analysis"
          )}
        </Button>
      </div>
    </div>
  );
}
