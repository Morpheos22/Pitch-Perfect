"use client";

// ═══════════════════════════════════════════════════════════════════════
// KAL PROTOCOL 2.0 — Contextual Chat Widget
// ═══════════════════════════════════════════════════════════════════════
//
// This is the frontend component for the Kal V2 contextual chatbot.
// It activates when the script analysis module fails or times out,
// engaging the user with 10 structured questions while the module
// processes in the background.
//
// FLOW:
//   1. Widget receives kalV2SessionId + firstQuestion
//   2. Shows Kal's greeting + first question
//   3. User types answer → PATCH /api/kal/chat
//   4. Kal responds with next question or fallback
//   5. After 10 answers: summary + quick feedback
//   6. Polls GET /api/kal/chat for script analysis completion
//   7. When analysis completes: shows final decision
//
// DESIGN PRINCIPLES:
//   - Warm, professional, never condescending (Kal's personality)
//   - Progress indicator (X of 10 questions)
//   - Skip option (triggers fallback response)
//   - Smooth typing animation for Kal's messages
//   - Auto-scroll to latest message

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  MessageSquare,
  Send,
  SkipForward,
  Loader2,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

// ============================================
// TYPES
// ============================================

interface KalMessage {
  id: string;
  role: "kal" | "user";
  content: string;
  timestamp: Date;
  isFallback?: boolean;
  isSummary?: boolean;
  isFinalDecision?: boolean;
}

interface KalChatWidgetProps {
  /** Kal V2 chat session ID from the API */
  sessionId: string;
  /** First question from Kal (shown as greeting + Q1) */
  firstQuestion: string;
  /** Script session ID for navigation after completion */
  scriptSessionId: string;
  /** Optional: callback when chat completes */
  onComplete?: (summary: string, feedback: string) => void;
}

// ============================================
// COMPONENT
// ============================================

export function KalChatWidget({
  sessionId,
  firstQuestion,
  scriptSessionId,
  onComplete,
}: KalChatWidgetProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<KalMessage[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(1);
  const [totalQuestions] = useState(10);
  const [isComplete, setIsComplete] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [quickFeedback, setQuickFeedback] = useState<string | null>(null);
  const [finalDecision, setFinalDecision] = useState<"SUCCESS" | "FAILURE" | "PENDING" | null>(null);
  const [scriptAnalysisStatus, setScriptAnalysisStatus] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Initialize with greeting + first question ──
  useEffect(() => {
    const greetingId = `kal-greeting-${Date.now()}`;
    const q1Id = `kal-q1-${Date.now()}`;

    setMessages([
      {
        id: greetingId,
        role: "kal",
        content:
          "Your script analysis is taking a bit longer than expected. Don't worry — I'm processing it in the background. While we wait, I'd like to learn more about your pitch to give you better feedback.",
        timestamp: new Date(),
      },
      {
        id: q1Id,
        role: "kal",
        content: firstQuestion,
        timestamp: new Date(),
      },
    ]);
  }, [firstQuestion]);

  // ── Auto-scroll to latest message ──
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Poll for script analysis completion ──
  useEffect(() => {
    if (!sessionId || isComplete) return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/kal/chat?id=${encodeURIComponent(sessionId)}`);
        if (!res.ok) return;

        const data = await res.json();

        // Update script analysis status
        if (data.scriptAnalysisStatus) {
          setScriptAnalysisStatus(data.scriptAnalysisStatus);
        }

        // If Kal chat is complete, show summary
        if (data.isComplete && data.summary && !isComplete) {
          setSummary(data.summary);
          setQuickFeedback(data.quickFeedback);
          setFinalDecision(data.finalDecision as any);
          setIsComplete(true);

          // Add summary message
          const summaryMsg: KalMessage = {
            id: `kal-summary-${Date.now()}`,
            role: "kal",
            content: data.summary,
            timestamp: new Date(),
            isSummary: true,
          };
          setMessages((prev) => [...prev, summaryMsg]);

          // Add feedback message
          if (data.quickFeedback) {
            const feedbackMsg: KalMessage = {
              id: `kal-feedback-${Date.now()}`,
              role: "kal",
              content: `Quick improvements you can make right now:\n\n${data.quickFeedback}`,
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, feedbackMsg]);
          }

          // Add final decision message
          const decisionMsg: KalMessage = {
            id: `kal-decision-${Date.now()}`,
            role: "kal",
            content:
              data.finalDecision === "SUCCESS"
                ? "Great news! Your analysis is complete. Check your dashboard for the full breakdown."
                : data.finalDecision === "FAILURE"
                  ? "Your analysis is still processing. Based on our conversation, I've identified key areas to focus on. Check your dashboard — if the full analysis doesn't appear within 20 minutes, a PDF copy will be sent to your email."
                  : "Your analysis is still being processed. I've summarized what I learned from our conversation. Check your dashboard for updates.",
            timestamp: new Date(),
            isFinalDecision: true,
          };
          setMessages((prev) => [...prev, decisionMsg]);

          onComplete?.(data.summary, data.quickFeedback);
        }
      } catch {
        // Polling is best-effort
      }
    }, 10000); // Poll every 10 seconds

    return () => clearInterval(pollInterval);
  }, [sessionId, isComplete, onComplete]);

  // ── Submit answer ──
  const handleSubmitAnswer = useCallback(async () => {
    const answer = currentAnswer.trim();
    if (!answer || submitting) return;

    setSubmitting(true);

    // Add user message
    const userMsg: KalMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: answer,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setCurrentAnswer("");

    try {
      const res = await fetch("/api/kal/chat", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatSessionId: sessionId,
          answer,
          questionIndex: currentQuestionIndex,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        toast.error(errorData.error || "Failed to submit answer");
        return;
      }

      const data = await res.json();

      // Handle completion
      if (data.isComplete && data.summary) {
        setSummary(data.summary);
        setQuickFeedback(data.quickFeedback || null);
        setFinalDecision(data.finalDecision as any);
        setIsComplete(true);

        // Add summary + feedback + decision messages
        const summaryMsg: KalMessage = {
          id: `kal-summary-${Date.now()}`,
          role: "kal",
          content: data.summary,
          timestamp: new Date(),
          isSummary: true,
        };
        setMessages((prev) => [...prev, summaryMsg]);

        if (data.quickFeedback) {
          const feedbackMsg: KalMessage = {
            id: `kal-feedback-${Date.now()}`,
            role: "kal",
            content: `Quick improvements you can make right now:\n\n${data.quickFeedback}`,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, feedbackMsg]);
        }

        const decisionContent =
          data.finalDecision === "SUCCESS"
            ? "Great news! Your analysis is complete. Check your dashboard for the full breakdown."
            : "Your analysis is still processing. Based on our conversation, I've identified key areas to focus on. Check your dashboard for updates.";
        const decisionMsg: KalMessage = {
          id: `kal-decision-${Date.now()}`,
          role: "kal",
          content: decisionContent,
          timestamp: new Date(),
          isFinalDecision: true,
        };
        setMessages((prev) => [...prev, decisionMsg]);

        onComplete?.(data.summary, data.quickFeedback || "");
      } else {
        // Add Kal's next response
        if (data.fallbackResponse) {
          const fallbackMsg: KalMessage = {
            id: `kal-fallback-${Date.now()}`,
            role: "kal",
            content: data.fallbackResponse,
            timestamp: new Date(),
            isFallback: true,
          };
          setMessages((prev) => [...prev, fallbackMsg]);
        }

        if (data.nextQuestion) {
          const nextMsg: KalMessage = {
            id: `kal-q${currentQuestionIndex + 1}-${Date.now()}`,
            role: "kal",
            content: data.nextQuestion,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, nextMsg]);
        }

        setCurrentQuestionIndex((prev) => prev + 1);
      }
    } catch {
      toast.error("Failed to submit answer. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [currentAnswer, submitting, sessionId, currentQuestionIndex, onComplete]);

  // ── Skip question ──
  const handleSkip = useCallback(async () => {
    setCurrentAnswer("skip");
    // Treat skip as an answer with the word "skip"
    setCurrentAnswer("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/kal/chat", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatSessionId: sessionId,
          answer: "skip",
          questionIndex: currentQuestionIndex,
        }),
      });

      if (!res.ok) {
        toast.error("Failed to skip question");
        return;
      }

      const data = await res.json();

      // Add skip acknowledgment
      const skipMsg: KalMessage = {
        id: `user-skip-${Date.now()}`,
        role: "user",
        content: "(Skipped this question)",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, skipMsg]);

      if (data.fallbackResponse) {
        const fallbackMsg: KalMessage = {
          id: `kal-fallback-${Date.now()}`,
          role: "kal",
          content: data.fallbackResponse,
          timestamp: new Date(),
          isFallback: true,
        };
        setMessages((prev) => [...prev, fallbackMsg]);
      }

      if (data.nextQuestion) {
        const nextMsg: KalMessage = {
          id: `kal-q${currentQuestionIndex + 1}-${Date.now()}`,
          role: "kal",
          content: data.nextQuestion,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, nextMsg]);
      }

      setCurrentQuestionIndex((prev) => prev + 1);
    } catch {
      toast.error("Failed to skip. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [sessionId, currentQuestionIndex]);

  // ── Navigate to session page ──
  const handleViewResults = () => {
    router.push(`/elevator-script/session/${encodeURIComponent(scriptSessionId)}`);
  };

  const handleGoToDashboard = () => {
    router.push("/dashboard");
  };

  // ── Progress calculation ──
  const answeredCount = currentQuestionIndex - 1;
  const progressPercent = (answeredCount / totalQuestions) * 100;

  return (
    <div className="flex flex-col h-full max-h-[85vh]">
      {/* ── Header ── */}
      <div className="flex-shrink-0 border-b pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-lg">Kal</h2>
              <p className="text-xs text-muted-foreground">AI Pitch Coach</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={isComplete ? "secondary" : "outline"}>
              {isComplete ? "Complete" : `${answeredCount} of ${totalQuestions}`}
            </Badge>
            {scriptAnalysisStatus === "COMPLETED" && (
              <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600">
                <CheckCircle className="h-3 w-3 mr-1" />
                Analysis Ready
              </Badge>
            )}
          </div>
        </div>
        {!isComplete && (
          <div className="mt-2">
            <Progress value={progressPercent} className="h-1.5" />
          </div>
        )}
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4 min-h-0">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-4 py-3 ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : msg.isSummary
                    ? "bg-primary/5 border border-primary/20"
                    : msg.isFinalDecision
                      ? "bg-emerald-500/5 border border-emerald-500/20"
                      : msg.isFallback
                        ? "bg-muted/50 border border-dashed border-muted-foreground/20"
                        : "bg-muted"
              }`}
            >
              {/* Message label for special messages */}
              {msg.isSummary && (
                <div className="flex items-center gap-1 mb-1 text-xs text-primary font-medium">
                  <Sparkles className="h-3 w-3" />
                  Assessment Summary
                </div>
              )}
              {msg.isFallback && (
                <div className="flex items-center gap-1 mb-1 text-xs text-muted-foreground">
                  <MessageSquare className="h-3 w-3" />
                  Let me rephrase...
                </div>
              )}
              {msg.isFinalDecision && (
                <div className="flex items-center gap-1 mb-1 text-xs text-emerald-600 font-medium">
                  <CheckCircle className="h-3 w-3" />
                  Analysis Update
                </div>
              )}

              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {submitting && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg px-4 py-3">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Actions (when complete) ── */}
      {isComplete && (
        <div className="flex-shrink-0 border-t pt-3 space-y-2">
          <Button
            onClick={handleViewResults}
            className="w-full bg-primary hover:bg-primary/90"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            View Full Analysis
          </Button>
          <Button
            variant="outline"
            onClick={handleGoToDashboard}
            className="w-full"
          >
            Go to Dashboard
          </Button>
        </div>
      )}

      {/* ── Input area ── */}
      {!isComplete && (
        <div className="flex-shrink-0 border-t pt-3">
          <div className="flex gap-2">
            <Textarea
              ref={textareaRef}
              value={currentAnswer}
              onChange={(e) => setCurrentAnswer(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmitAnswer();
                }
              }}
              placeholder="Type your answer..."
              className="min-h-[60px] max-h-[120px] resize-none"
              disabled={submitting}
              maxLength={5000}
            />
          </div>
          <div className="flex items-center justify-between mt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSkip}
              disabled={submitting}
              className="text-muted-foreground"
            >
              <SkipForward className="h-4 w-4 mr-1" />
              Skip
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {currentAnswer.length}/5000
              </span>
              <Button
                size="sm"
                onClick={handleSubmitAnswer}
                disabled={!currentAnswer.trim() || submitting}
                className="bg-primary hover:bg-primary/90"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
