"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileText, ChevronDown, ChevronUp, CheckCircle, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { safeJson } from "@/lib/safe-fetch";
import { uploadFileToBlob } from "@/lib/blob-upload";
import { ALLOWED_EXTENSIONS, MAX_FILE_SIZES } from "@/lib/file-validation";

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

export default function ElevatorPitchLiveScriptNewPage() {
  const router = useRouter();
  const [sessionName, setSessionName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [frameworkExpanded, setFrameworkExpanded] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Session counter state
  const [usedCount, setUsedCount] = useState<number | null>(null);
  const [limitCount, setLimitCount] = useState<number | null>(null);
  const [isEnterprise, setIsEnterprise] = useState(false);

  const fetchUsage = useCallback(async () => {
    try {
      const res = await fetch("/api/user/sync");
      if (!res.ok) return;
      const json = await res.json();
      if (json.success && json.user) {
        const plan = json.user.subscription?.plan || "FREE";
        const usage = json.user.usage;
        const limits = { FREE: { e2: 1 }, STARTER: { e2: 10 }, PROFESSIONAL: { e2: 30 }, ENTERPRISE: { e2: 999 } };
        const planLimits = limits[plan as keyof typeof limits] || limits.FREE;
        setUsedCount(usage?.e2ScriptCoachSessions ?? 0);
        setLimitCount(planLimits.e2);
        setIsEnterprise(plan === "ENTERPRISE");
      }
    } catch {
      // Non-critical
    }
  }, []);

  useEffect(() => { fetchUsage(); }, [fetchUsage]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const ext = selectedFile.name.toLowerCase().substring(selectedFile.name.lastIndexOf("."));
      
      if (!SCRIPT_EXTENSIONS.includes(ext)) {
        toast.error(`Unsupported file format. Only PDF, DOCX, DOC, TXT, and MD files are accepted.`);
        return;
      }
      // MIME type check: extension is already validated above.
      // Per file-validation.ts, MIME mismatches are warnings, not blockers.
      // Browsers report incorrect MIME types for .md files (empty string or
      // application/octet-stream), so we skip the MIME block for valid extensions.
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
    if (!file) {
      toast.error("Please upload a script file");
      return;
    }

    // ── Pre-check entitlement BEFORE blob upload to prevent orphaned blobs ──
    if (usedCount !== null && limitCount !== null && !isEnterprise && usedCount >= limitCount) {
      toast.error("Usage limit reached. Please upgrade your plan.");
      router.push("/elevator-pitch-live/upgrade");
      return;
    }

    setSubmitting(true);

    let blobUrl: string | undefined;

    try {
      // ── ALWAYS use blob upload ──
      // Bypasses Vercel's 4.5MB serverless body limit entirely.
      try {
        const blobResult = await uploadFileToBlob(file, "script");
        blobUrl = blobResult.url;
        console.log("[E2] Blob upload succeeded:", blobUrl);
      } catch (blobError: any) {
        console.error("[E2] Blob upload failed:", blobError);
        toast.error(blobError?.message || "File upload failed. Please try again.");
        return;
      }

      // Send blob URL to coach API — tiny payload
      const formData = new FormData();
      formData.append("fileUrl", blobUrl);
      formData.append("fileName", file.name);
      formData.append("sessionName", sessionName);
      formData.append("targetAudience", "investors");
      formData.append("targetDuration", "60");

      const response = await fetch("/api/coach/script", {
        method: "POST",
        body: formData,
      });

      const data = await safeJson(response);

      toast.success("Analysis complete!");
      router.push(`/elevator-pitch-live/script/session/${data.id}`);

    } catch (error: any) {
      console.error("[E2] Submit error:", error);

      // ── Clean up orphaned blob if analysis was rejected ──
      if (blobUrl) {
        fetch(`/api/blob/upload?url=${encodeURIComponent(blobUrl)}`, { method: "DELETE" }).catch(() => {
          // Cleanup is best-effort — don't surface cleanup failures to the user
        });
      }

      if (error?.status === 403) {
        toast.error("Usage limit reached. Please upgrade your plan.");
        router.push("/elevator-pitch-live/upgrade");
        return;
      }
      if (error?.status === 401) {
        toast.error("Please sign in to continue");
        router.push("/sign-in");
        return;
      }
      // Surface the ACTUAL server error message
      const serverMessage = error?.message || error?.data?.error;
      if (serverMessage && serverMessage !== "Request failed (500)") {
        toast.error(serverMessage);
      } else {
        toast.error("Failed to analyze script. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

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

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <Button variant="ghost" size="sm" onClick={() => router.push("/elevator-pitch-live/new")} className="mb-2">
        <ChevronLeft className="h-4 w-4 mr-1" />
        Back to Elevator Pitch Live
      </Button>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Script Session</h1>
        <p className="text-muted-foreground">Part of Elevator Pitch Live — M2 Script Coaching</p>
      </div>

      {/* Session Counter */}
      <Card className="border-primary/20">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Script session</p>
              <p className="font-semibold">{sessionLabel}</p>
            </div>
            <Badge variant="secondary">{remainingLabel}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Framework Reference */}
      <Card>
        <CardHeader className="cursor-pointer" onClick={() => setFrameworkExpanded(!frameworkExpanded)}>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">What We Evaluate</CardTitle>
              <CardDescription>5-element framework for elevator pitches</CardDescription>
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
            placeholder="e.g., Investor pitch v1"
            value={sessionName}
            onChange={(e) => setSessionName(e.target.value)}
            maxLength={80}
          />
        </CardContent>
      </Card>

      {/* File Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Upload Your Script</CardTitle>
          <CardDescription>Upload a file containing your elevator pitch script</CardDescription>
        </CardHeader>
        <CardContent>
          {!file ? (
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer">
              <input
                type="file"
                accept=".pdf,.docx,.doc,.txt,.md"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="font-medium">Drag your script here, or click to browse</p>
                <p className="text-sm text-muted-foreground mt-1">PDF, DOCX, DOC, TXT, or MD — up to 10MB</p>
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
                <Button variant="ghost" size="sm" onClick={() => setFile(null)}>Remove</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => router.push("/elevator-pitch-live/new")}>Cancel</Button>
        <Button
          onClick={handleSubmit}
          disabled={!sessionName.trim() || !file || submitting}
          className="bg-primary hover:bg-primary/90"
        >
          {submitting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
              Submitting...
            </>
          ) : (
            "Analyse Script"
          )}
        </Button>
      </div>
    </div>
  );
}
