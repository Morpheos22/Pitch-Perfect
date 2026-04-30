"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileText, ChevronDown, ChevronUp, CheckCircle, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { safeJson } from "@/lib/safe-fetch";
import { uploadFileToBlob } from "@/lib/blob-upload";
import { ALLOWED_EXTENSIONS, MAX_FILE_SIZES } from "@/lib/file-validation";
import { PLAN_LIMITS } from "@/lib/plan-config";

// Script-specific constants derived from the single source of truth
const SCRIPT_EXTENSIONS = ALLOWED_EXTENSIONS.script;
const SCRIPT_MAX_SIZE = MAX_FILE_SIZES.script; // 10MB

const frameworkElements = [
  { name: "Hook", description: "Grabs attention in the opening line" },
  { name: "Problem", description: "Clearly identifies the problem being solved" },
  { name: "Solution", description: "Explains what you offer and how it solves the problem" },
  { name: "Proof", description: "Provides a credibility signal or evidence of traction" },
  { name: "The Ask", description: "States clearly what you want from this conversation" },
];

const AUDIENCE_OPTIONS = [
  { value: "investors", label: "Investors" },
  { value: "customers", label: "Customers" },
  { value: "partners", label: "Partners" },
  { value: "media", label: "Media / Press" },
  { value: "general", label: "General Audience" },
];

const DURATION_OPTIONS = [
  { value: "30", label: "30 seconds (micro-pitch)" },
  { value: "60", label: "60 seconds (standard elevator)" },
  { value: "90", label: "90 seconds (extended)" },
  { value: "120", label: "2 minutes (detailed)" },
];

export default function ElevatorScriptNewPage() {
  const router = useRouter();
  const [sessionName, setSessionName] = useState("");
  const [inputMode, setInputMode] = useState<"file" | "text">("file");
  const [file, setFile] = useState<File | null>(null);
  const [scriptText, setScriptText] = useState("");
  const [targetAudience, setTargetAudience] = useState("investors");
  const [targetDuration, setTargetDuration] = useState("60");
  const [frameworkExpanded, setFrameworkExpanded] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // Session counter state
  const [usedCount, setUsedCount] = useState<number | null>(null);
  const [limitCount, setLimitCount] = useState<number | null>(null);
  const [isEnterprise, setIsEnterprise] = useState(false);
  const [aiReady, setAiReady] = useState(false);

  const fetchUsage = useCallback(async () => {
    try {
      const res = await fetch("/api/user/sync");
      if (!res.ok) return;
      const json = await res.json();
      if (json.success && json.user) {
        const plan = json.user.subscription?.plan || "FREE";
        const usage = json.user.usage;
        const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.FREE;
        setUsedCount(usage?.e2ScriptCoachSessions ?? 0);
        setLimitCount(limits.e2);
        setIsEnterprise(plan === "ENTERPRISE");
      }
    } catch {
      // Non-critical
    }
  }, []);

  // ── Pre-warm Z.ai API on module entry (Kal active but resting) ──
  const prewarmAI = useCallback(async () => {
    try {
      const res = await fetch("/api/kal/prewarm", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setAiReady(data.success && data.gatewayReady);
        console.log("[E2] AI pre-warm result:", data.message);
      }
    } catch {
      console.warn("[E2] AI pre-warm failed (non-critical)");
    }
  }, []);

  useEffect(() => {
    fetchUsage();
    prewarmAI();
  }, [fetchUsage, prewarmAI]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const ext = selectedFile.name.toLowerCase().substring(selectedFile.name.lastIndexOf("."));
      
      if (!SCRIPT_EXTENSIONS.includes(ext)) {
        toast.error(`Unsupported file format. Only DOCX, DOC, and TXT files are accepted.`);
        return;
      }
      if (selectedFile.size > SCRIPT_MAX_SIZE) {
        toast.error(`File is too large. Maximum size is 10MB.`);
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleSubmit = async () => {
    if (!sessionName.trim()) {
      toast.error("Please enter a session name");
      return;
    }

    // Validate input based on mode
    if (inputMode === "file" && !file) {
      toast.error("Please upload a script file");
      return;
    }
    if (inputMode === "text" && !scriptText.trim()) {
      toast.error("Please enter your script text");
      return;
    }
    if (inputMode === "text") {
      const wordCount = scriptText.trim().split(/\s+/).filter(Boolean).length;
      if (wordCount < 30) {
        toast.error("Script must be at least 30 words for meaningful analysis.");
        return;
      }
    }

    // ── Pre-check entitlement BEFORE blob upload ──
    if (usedCount !== null && limitCount !== null && !isEnterprise && usedCount >= limitCount) {
      toast.error("Usage limit reached. Please upgrade your plan.");
      router.push("/elevator-script/upgrade");
      return;
    }

    setSubmitting(true);
    setUploadProgress(null);

    let blobUrl: string | undefined;

    try {
      // ── PATH A: File upload mode — use blob upload ──
      if (inputMode === "file" && file) {
        try {
          setUploadProgress(0);
          const blobResult = await uploadFileToBlob(file, "script", (progress) => {
            setUploadProgress(progress.percentage);
          });
          blobUrl = blobResult.url;
          setUploadProgress(100);
          console.log("[E2] Blob upload succeeded:", blobUrl);
        } catch (blobError: unknown) {
          console.error("[E2] Blob upload failed:", blobError);
          setUploadProgress(null);
          const blobMsg = blobError instanceof Error ? blobError.message : String(blobError);
          toast.error(blobMsg || "File upload failed. Please try again.");
          return;
        }

        // ── Send blob URL to coach API ──
        const formData = new FormData();
        formData.append("fileUrl", blobUrl);
        formData.append("fileName", file.name);
        formData.append("sessionName", sessionName);
        formData.append("targetAudience", targetAudience);
        formData.append("targetDuration", targetDuration);

        const response = await fetch("/api/coach/script", {
          method: "POST",
          body: formData,
        });

        const data = await safeJson(response);
        return handleResponse(data, blobUrl);
      }

      // ── PATH B: Text input mode — send as JSON ──
      if (inputMode === "text") {
        const response = await fetch("/api/coach/script", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: scriptText,
            sessionName,
            targetAudience,
            targetDuration: parseInt(targetDuration),
          }),
        });

        const data = await safeJson(response);
        return handleResponse(data);
      }
    } catch (error: unknown) {
      console.error("[E2] Upload/analysis error:", error);

      // ── Clean up orphaned blob if analysis was rejected ──
      if (blobUrl) {
        fetch(`/api/blob/upload?url=${encodeURIComponent(blobUrl)}`, { method: "DELETE" }).catch(() => {});
      }

      const errObj = error instanceof Error ? error : null;
      const errData = (typeof error === 'object' && error !== null) ? error as Record<string, unknown> : null;
      const errStatus = errData?.status as number | undefined;

      if (errStatus === 413) {
        toast.error("File is too large for upload. Maximum size is 10MB for scripts.");
        return;
      }
      if (errStatus === 403) {
        toast.error("Usage limit reached. Please upgrade your plan.");
        router.push("/elevator-script/upgrade");
        return;
      }
      if (errStatus === 401) {
        toast.error("Please sign in to continue");
        router.push("/sign-in");
        return;
      }
      const serverMessage = errObj?.message || (errData?.data as Record<string, unknown> | undefined)?.error as string | undefined;
      if (serverMessage && serverMessage !== "Request failed (500)") {
        toast.error(serverMessage);
      } else {
        toast.error("Failed to analyze script. Please try again.");
      }
    } finally {
      setSubmitting(false);
      setUploadProgress(null);
    }
  };

  // Shared response handler for both file and text paths
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleResponse(data: Record<string, any>, blobUrlForCleanup?: string) {
    // ── Handle Kal Protocol 2.0 redirect ──
    if (data.kalProtocol && data.kalV2Active && data.kalV2SessionId) {
      toast.info("Analysis is taking longer — let's chat while we process it.");
      const kalChatUrl = `/elevator-script/kal-chat?session=${encodeURIComponent(data.kalV2SessionId)}&script=${encodeURIComponent(data.id)}&q=${encodeURIComponent(data.kalV2FirstQuestion || data.message || "")}`;
      router.push(kalChatUrl);
      return;
    }

    // ── Handle Kal Protocol V1 ──
    if (data.kalProtocol) {
      toast.info("Analysis is being processed. Check your dashboard in a few minutes.");
      router.push("/dashboard");
      return;
    }

    // ── Normal success flow ──
    toast.success("Analysis complete!");
    router.push(`/elevator-script/session/${data.id}`);
  }

  // Session counter display
  const sessionLabel = isEnterprise
    ? "Unlimited sessions"
    : usedCount !== null && limitCount !== null
      ? `Session ${usedCount + 1} of ${limitCount}`
      : "Loading...";

  const remainingLabel = isEnterprise
    ? "Unlimited"
    : usedCount !== null && limitCount !== null
      ? `${Math.max(0, limitCount - usedCount)} remaining`
      : "—";

  const wordCount = scriptText.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Script Check</h1>
        <p className="text-muted-foreground">Submit your script for element-by-element AI feedback</p>
      </div>

      {/* Session Counter */}
      <Card className="border-primary/20">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Session</p>
              <p className="font-semibold">{sessionLabel}</p>
            </div>
            <div className="flex items-center gap-2">
              {aiReady && (
                <Badge variant="outline" className="text-emerald-500 border-emerald-500/30 text-xs">
                  AI Ready
                </Badge>
              )}
              <Badge variant="secondary">{remainingLabel}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Framework Reference */}
      <Card>
        <CardHeader className="cursor-pointer" onClick={() => setFrameworkExpanded(!frameworkExpanded)}>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">What We Evaluate</CardTitle>
              <CardDescription>Your script will be scored against the 5-element framework</CardDescription>
            </div>
            {frameworkExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </div>
        </CardHeader>
        {frameworkExpanded && (
          <CardContent>
            <div className="space-y-3">
              {frameworkElements.map((element, index) => (
                <div key={element.name} className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </span>
                  <div>
                    <span className="font-medium">{element.name}</span>
                    <span className="text-muted-foreground"> — {element.description}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong>Duration tip:</strong> Most effective elevator pitches run between 45 and 90 seconds. 
                That&apos;s roughly 120–200 words.
              </p>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Session Name */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Name This Session</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="e.g., Investor pitch v1 or Leadership meeting — March 2026"
            value={sessionName}
            onChange={(e) => setSessionName(e.target.value)}
            maxLength={80}
          />
        </CardContent>
      </Card>

      {/* Target Audience & Duration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Target Audience & Duration</CardTitle>
          <CardDescription>Tailor the analysis to your specific pitch scenario</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="audience">Who is this pitch for?</Label>
              <Select value={targetAudience} onValueChange={setTargetAudience}>
                <SelectTrigger id="audience">
                  <SelectValue placeholder="Select audience" />
                </SelectTrigger>
                <SelectContent>
                  {AUDIENCE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="duration">Target duration</Label>
              <Select value={targetDuration} onValueChange={setTargetDuration}>
                <SelectTrigger id="duration">
                  <SelectValue placeholder="Select duration" />
                </SelectTrigger>
                <SelectContent>
                  {DURATION_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Script Input — File Upload or Text Entry */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Your Script</CardTitle>
          <CardDescription>Upload a file or paste your script directly</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as "file" | "text")}>
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="file" className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Upload File
              </TabsTrigger>
              <TabsTrigger value="text" className="flex items-center gap-2">
                <Type className="h-4 w-4" />
                Type / Paste
              </TabsTrigger>
            </TabsList>

            <TabsContent value="file">
              {!file ? (
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer">
                  <input
                    type="file"
                    accept=".docx,.doc,.txt"
                    onChange={handleFileChange}
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="font-medium">Drag your script here, or click to browse</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      DOCX, DOC, or TXT — up to 10MB
                    </p>
                  </label>
                </div>
              ) : (
                <div className="flex items-center justify-between p-4 bg-secondary/10 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{file.name}</p>
                      <p className="text-sm text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-secondary" />
                    <Button variant="ghost" size="sm" onClick={() => setFile(null)}>
                      Remove
                    </Button>
                  </div>
                </div>
              )}

              {/* Upload progress bar */}
              {uploadProgress !== null && submitting && (
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Uploading file...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="text">
              <div className="space-y-2">
                <Textarea
                  placeholder="Paste your elevator pitch script here...&#10;&#10;Example: &quot;Did you know that 90% of startups fail because they can't articulate their value? At PitchCoach, we've built an AI that analyzes your pitch and gives you element-by-element feedback in seconds. We've already helped 500+ founders improve their pitch scores by an average of 40%. I'd love to show you a demo — do you have 5 minutes this week?&quot;"
                  value={scriptText}
                  onChange={(e) => setScriptText(e.target.value)}
                  rows={8}
                  className="resize-y min-h-[200px]"
                  maxLength={5000}
                />
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>
                    {wordCount} word{wordCount !== 1 ? "s" : ""} 
                    {wordCount > 0 && wordCount < 30 && (
                      <span className="text-amber-500 ml-1">(minimum 30)</span>
                    )}
                    {wordCount > 1000 && (
                      <span className="text-destructive ml-1">(maximum 1000)</span>
                    )}
                  </span>
                  <span>~{Math.round(wordCount / 2.5)}s estimated duration</span>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => router.back()}>
          Back
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={
            submitting ||
            !sessionName.trim() ||
            (inputMode === "file" && !file) ||
            (inputMode === "text" && scriptText.trim().length < 30)
          }
          className="bg-primary hover:bg-primary/90"
        >
          {submitting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
              {uploadProgress !== null ? "Uploading..." : "Analysing..."}
            </>
          ) : (
            "Analyse Script"
          )}
        </Button>
      </div>
    </div>
  );
}
