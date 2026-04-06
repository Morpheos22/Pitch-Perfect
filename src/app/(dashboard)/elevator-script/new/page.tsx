"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileText, ChevronDown, ChevronUp, CheckCircle, Type, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

const PLAN_LIMITS: Record<string, { e2: number }> = {
  FREE: { e2: 1 },
  STARTER: { e2: 10 },
  PROFESSIONAL: { e2: 30 },
  ENTERPRISE: { e2: 999 },
};

const frameworkElements = [
  { name: "Hook", description: "Grabs attention in the opening line" },
  { name: "Problem", description: "Clearly identifies the problem being solved" },
  { name: "Solution", description: "Explains what you offer and how it solves the problem" },
  { name: "Proof", description: "Provides a credibility signal or evidence of traction" },
  { name: "The Ask", description: "States clearly what you want from this conversation" },
];

export default function ElevatorScriptNewPage() {
  const router = useRouter();
  const [sessionName, setSessionName] = useState("");
  const [inputTab, setInputTab] = useState<"upload" | "paste">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [scriptText, setScriptText] = useState("");
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
        const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.FREE;
        setUsedCount(usage?.e2ScriptCoachSessions ?? 0);
        setLimitCount(limits.e2);
        setIsEnterprise(plan === "ENTERPRISE");
      }
    } catch {
      // Non-critical
    }
  }, []);

  useEffect(() => { fetchUsage(); }, [fetchUsage]);

  const wordCount = scriptText.trim() ? scriptText.trim().split(/\s+/).length : 0;
  const estimatedDuration = Math.round(wordCount / 150 * 60); // ~150 words per minute

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const validTypes = [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword",
        "text/plain",
        "text/markdown",
      ];
      const validExtensions = [".pdf", ".docx", ".doc", ".txt", ".md", ".key"];
      const hasValidExtension = validExtensions.some(ext => selectedFile.name.toLowerCase().endsWith(ext));
      
      if (!validTypes.includes(selectedFile.type) && !hasValidExtension) {
        toast.error("Only PDF, DOCX, DOC, TXT, MD, and Keynote files are supported");
        return;
      }
      if (selectedFile.size > 10 * 1024 * 1024) {
        toast.error("File exceeds the 10MB limit");
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
    if (inputTab === "upload" && !file) {
      toast.error("Please upload a file");
      return;
    }
    if (inputTab === "paste" && wordCount < 20) {
      toast.error("Your script seems too short. Please enter at least 20 words.");
      return;
    }

    setSubmitting(true);
    
    try {
      // Extract script text from file or use pasted text
      let scriptContent = scriptText;
      if (inputTab === "upload" && file) {
        scriptContent = await file.text();
      }

      if (!scriptContent || scriptContent.trim().length < 20) {
        throw new Error("Script content is too short. Please provide at least 20 words.");
      }

      const response = await fetch("/api/coach/script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script: scriptContent,
          sessionName: sessionName,
          targetAudience: "investors",
          targetDuration: 60,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 403) {
          toast.error(data.message || "Usage limit reached. Please upgrade your plan.");
          router.push("/elevator-script/upgrade");
          return;
        }
        if (response.status === 401) {
          toast.error("Please sign in to continue");
          router.push("/sign-in");
          return;
        }
        throw new Error(data.error || "Analysis failed");
      }

      toast.success("Analysis complete!");
      router.push(`/elevator-script/session/${data.id}`);
      
    } catch (error) {
      console.error("Submit error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to analyze script");
    } finally {
      setSubmitting(false);
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
        <h1 className="text-2xl font-bold">Elevator Pitch Script Check</h1>
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

      {/* Input Tabs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Your Script</CardTitle>
          <CardDescription>Upload a file or paste your script directly</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={inputTab} onValueChange={(v) => setInputTab(v as "upload" | "paste")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="upload">Upload a file</TabsTrigger>
              <TabsTrigger value="paste">Type or paste</TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="mt-4">
              {!file ? (
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer">
                  <input
                    type="file"
                    accept=".pdf,.docx,.doc,.txt,.md,.key"
                    onChange={handleFileChange}
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="font-medium">Drag your script here, or click to browse</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      PDF, DOCX, DOC, TXT, MD, Keynote (.key) up to 10MB
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
            </TabsContent>

            <TabsContent value="paste" className="mt-4">
              <Textarea
                placeholder="Paste your elevator pitch script here, or type directly..."
                value={scriptText}
                onChange={(e) => setScriptText(e.target.value)}
                maxLength={5000}
                className="min-h-[200px]"
              />
              <div className="flex items-center justify-between mt-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <Type className="h-4 w-4" />
                    {wordCount} words
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    ~{Math.floor(estimatedDuration / 60)}:{(estimatedDuration % 60).toString().padStart(2, '0')} spoken
                  </span>
                </div>
                <span>{scriptText.length}/5000</span>
              </div>
              {wordCount > 0 && wordCount < 20 && (
                <p className="text-sm text-yellow-500 mt-2">
                  Your script seems very short. Are you sure you&apos;re ready to submit?
                </p>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => router.back()}>
          Back to Dashboard
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!sessionName.trim() || (inputTab === "upload" ? !file : wordCount < 20) || submitting}
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
