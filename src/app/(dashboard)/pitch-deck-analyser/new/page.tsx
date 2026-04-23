"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileText, ChevronDown, ChevronUp, AlertCircle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { safeJson } from "@/lib/safe-fetch";
import { uploadFileToBlob } from "@/lib/blob-upload";
import { ALLOWED_EXTENSIONS, ALLOWED_MIME_TYPES, MAX_FILE_SIZES, validateFileFormat } from "@/lib/file-validation";

// Deck-specific constants derived from the single source of truth
const DECK_EXTENSIONS = ALLOWED_EXTENSIONS.deck;
const DECK_MIME_TYPES = ALLOWED_MIME_TYPES.deck;
const DECK_MAX_SIZE = MAX_FILE_SIZES.deck; // 50MB

const PLAN_LIMITS: Record<string, { e1: number }> = {
  FREE: { e1: 1 },
  STARTER: { e1: 5 },
  PROFESSIONAL: { e1: 20 },
  ENTERPRISE: { e1: 999 },
};

const frameworkElements = [
  { name: "Title Slide", description: "Clear company name and tagline" },
  { name: "Problem", description: "Define the problem you're solving" },
  { name: "Value Proposition", description: "Your unique solution and benefits" },
  { name: "Underlying Magic", description: "How your product/service works" },
  { name: "Business Model", description: "How you make money" },
  { name: "Go-to-Market", description: "Customer acquisition strategy" },
  { name: "Competitive Analysis", description: "Market positioning and differentiation" },
  { name: "Management Team", description: "Key team members and credentials" },
  { name: "Financial Projections", description: "Revenue and growth forecasts" },
  { name: "The Ask", description: "What you're seeking from investors" },
];

const visualDimensions = [
  { name: "Slide Density", description: "Content balance per slide" },
  { name: "Color Palette", description: "Brand consistency and visual appeal" },
  { name: "Typography", description: "Font hierarchy and readability" },
  { name: "Data Presentation", description: "Charts and data visualization" },
  { name: "Brand Consistency", description: "Visual identity throughout" },
];

export default function PitchDeckAnalyserNewPage() {
  const router = useRouter();
  const [sessionName, setSessionName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [frameworkExpanded, setFrameworkExpanded] = useState(true);

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
        const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.FREE;
        setUsedCount(usage?.e1DeckAnalyses ?? 0);
        setLimitCount(limits.e1);
        setIsEnterprise(plan === "ENTERPRISE");
      }
    } catch {
      // Non-critical, use fallback display
    }
  }, []);

  useEffect(() => { fetchUsage(); }, [fetchUsage]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const ext = selectedFile.name.toLowerCase().substring(selectedFile.name.lastIndexOf("."));
      
      if (!DECK_EXTENSIONS.includes(ext)) {
        toast.error(`Unsupported file format. Only PDF, PPTX, and PPT files are accepted.`);
        return;
      }
      if (!DECK_MIME_TYPES.includes(selectedFile.type) && !DECK_EXTENSIONS.includes(ext)) {
        toast.error(`Invalid file type. Only PDF, PPTX, and PPT files are accepted.`);
        return;
      }
      if (selectedFile.size > DECK_MAX_SIZE) {
        toast.error(`File is too large. Maximum size is 50MB.`);
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
      toast.error("Please upload a pitch deck file");
      return;
    }

    setUploading(true);

    try {
      // ── ALWAYS use blob upload ──
      // This bypasses Vercel's 4.5MB serverless body limit entirely.
      // The file goes directly from the browser to Vercel Blob storage.
      // Only a lightweight token request hits our server.
      let blobUrl: string;
      let blobPathname: string;

      try {
        const blobResult = await uploadFileToBlob(file, "deck");
        blobUrl = blobResult.url;
        blobPathname = blobResult.pathname;
        console.log("[E1] Blob upload succeeded:", blobUrl);
      } catch (blobError: any) {
        console.error("[E1] Blob upload failed:", blobError);
        toast.error(blobError?.message || "File upload failed. Please try again.");
        return;
      }

      // ── Send blob URL to coach API for analysis ──
      // Only the URL is sent — tiny payload, no body limit concerns
      const formData = new FormData();
      formData.append("sessionName", sessionName);
      formData.append("fileUrl", blobUrl);
      formData.append("fileName", file.name);
      formData.append("fileSize", String(file.size));

      const response = await fetch("/api/coach/deck", {
        method: "POST",
        body: formData,
      });

      const data = await safeJson(response);

      toast.success("Analysis complete!");
      router.push(`/pitch-deck-analyser/session/${data.id}`);
    } catch (error: any) {
      console.error("[E1] Upload/analysis error:", error);
      if (error?.status === 413) {
        toast.error("File is too large for upload. Maximum size is 50MB.");
        return;
      }
      if (error?.status === 403) {
        toast.error("Usage limit reached. Please upgrade your plan.");
        router.push("/pitch-deck-analyser/upgrade");
        return;
      }
      if (error?.status === 401) {
        toast.error("Please sign in to continue");
        router.push("/sign-in");
        return;
      }
      // Surface the ACTUAL server error message — don't swallow it
      const serverMessage = error?.message || error?.data?.error;
      if (serverMessage && serverMessage !== "Request failed (500)") {
        toast.error(serverMessage);
      } else {
        toast.error("Failed to analyze deck. Please try again.");
      }
    } finally {
      setUploading(false);
    }
  };

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

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Pitch Deck Analyser</h1>
        <p className="text-muted-foreground">Upload your pitch deck for AI-powered analysis</p>
      </div>

      {/* Session Counter */}
      <Card className="border-primary/20">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Session</p>
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
              <CardDescription>Your deck will be scored against these criteria</CardDescription>
            </div>
            {frameworkExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </div>
        </CardHeader>
        {frameworkExpanded && (
          <CardContent className="space-y-6">
            {/* 10-Slide Framework */}
            <div>
              <h4 className="font-medium mb-3 text-primary">10-Slide Framework</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {frameworkElements.map((element) => (
                  <div key={element.name} className="flex items-start gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-secondary shrink-0 mt-0.5" />
                    <div>
                      <span className="font-medium">{element.name}</span>
                      <span className="text-muted-foreground"> — {element.description}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Visual Design Dimensions */}
            <div>
              <h4 className="font-medium mb-3 text-primary">Visual Design Dimensions</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {visualDimensions.map((dim) => (
                  <div key={dim.name} className="flex items-start gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-secondary shrink-0 mt-0.5" />
                    <div>
                      <span className="font-medium">{dim.name}</span>
                      <span className="text-muted-foreground"> — {dim.description}</span>
                    </div>
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
            placeholder="e.g., Investor Deck v1 or Revised deck — March 2026"
            value={sessionName}
            onChange={(e) => setSessionName(e.target.value)}
            maxLength={80}
          />
          <p className="text-xs text-muted-foreground mt-2">{sessionName.length}/80 characters</p>
        </CardContent>
      </Card>

      {/* File Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Upload Your Deck</CardTitle>
          <CardDescription>Upload your pitch deck file for AI-powered analysis</CardDescription>
        </CardHeader>
        <CardContent>
          {!file ? (
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer">
              <input
                type="file"
                accept=".pdf,.pptx,.ppt"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="font-medium">Drag your deck here, or click to browse</p>
                <p className="text-sm text-muted-foreground mt-1">PDF, PPTX, or PPT — up to 50MB</p>
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
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => router.back()}>
          Back to Dashboard
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!sessionName.trim() || !file || uploading}
          className="bg-primary hover:bg-primary/90"
        >
          {uploading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
              Analyzing...
            </>
          ) : (
            <>
              Analyse Deck
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
