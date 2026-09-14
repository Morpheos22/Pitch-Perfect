"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Bot, X, Send, Sparkles, Lock } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface QuotaState {
  tier: "anon" | "auth";
  limit: number;
  remaining: number;
  resetAt: number; // unix seconds
  requiresSignIn: boolean;
}

const WELCOME_MESSAGE: Message = {
  role: "assistant",
  content:
    "Hi! I'm Athena, your AI guide. I can help you navigate PitchCoach Ai, understand your scores, and get the most out of your coaching sessions. How can I help you today?",
};

export function AthenaWidget() {
  const { isSignedIn } = useUser();

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [quota, setQuota] = useState<QuotaState | null>(null);
  const [showSignInCta, setShowSignInCta] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // ── Fetch quota when widget opens, and after every assistant reply ──────
  const refreshQuota = useCallback(async () => {
    try {
      const res = await fetch("/api/athena/quota", { method: "GET" });
      if (!res.ok) return;
      const data: QuotaState = await res.json();
      setQuota(data);
      // If the cap is already hit, surface the sign-in CTA immediately.
      if (data.tier === "anon" && data.remaining === 0) {
        setShowSignInCta(true);
      } else {
        setShowSignInCta(false);
      }
    } catch {
      // Non-fatal — the route still works without quota info.
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      refreshQuota();
    }
  }, [isOpen, isSignedIn, refreshQuota]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // ── Soft nudge: when the user has ≤2 messages left, append a friendly hint ──
  const shouldNudge =
    quota?.tier === "anon" &&
    quota.remaining > 0 &&
    quota.remaining <= 2;

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    if (showSignInCta) return; // locked — must sign in

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    try {
      const response = await fetch("/api/athena/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          history: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      // ── Cap hit: server tells us to surface the sign-in CTA ───────────
      if (response.status === 402) {
        const data = await response.json();
        setQuota((q) =>
          q
            ? {
                ...q,
                remaining: 0,
                requiresSignIn: true,
              }
            : q,
        );
        setShowSignInCta(true);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              data?.message ??
              "You've reached Athena's free visitor limit. Sign in to keep chatting — it's free.",
          },
        ]);
        return;
      }

      // ── Concurrency cap or signed-in user hit their own limit ─────────
      if (response.status === 429) {
        const data = await response.json();
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              data?.message ??
              "Athena is busy right now. Please try again in a moment.",
          },
        ]);
        // Refresh quota to get accurate resetAt
        refreshQuota();
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const data = await response.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.response },
      ]);

      // Update local quota from response headers + body.
      const remainingHeader = Number(
        response.headers.get("X-Athena-Remaining") ?? "0",
      );
      const tierHeader =
        (response.headers.get("X-Athena-Tier") as "anon" | "auth") ?? "anon";
      setQuota((q) =>
        q
          ? {
              ...q,
              tier: tierHeader,
              remaining: Number.isFinite(remainingHeader)
                ? remainingHeader
                : q.remaining - 1,
            }
          : q,
      );

      // Server may also nudge sign-in when close to cap.
      if (data.nudgeSignIn) {
        setShowSignInCta(true);
      }

      // Refresh authoritative quota from server (handles race conditions).
      refreshQuota();
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "I'm having trouble connecting right now. Please try again in a moment.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 bg-primary text-primary-foreground rounded-full w-14 h-14 flex items-center justify-center shadow-lg shadow-primary/30 hover:scale-110 transition-transform"
        aria-label="Open Athena AI Guide"
      >
        <Sparkles className="w-6 h-6" />
      </button>
    );
  }

  return (
    <div
      className="fixed bottom-6 right-6 z-50 w-96 max-w-[calc(100vw-2rem)] bg-background border border-border rounded-2xl shadow-2xl flex flex-col"
      style={{ maxHeight: "70vh" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-primary/5 rounded-t-2xl">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
            <Bot className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-sm text-foreground">Athena</p>
            <p className="text-xs text-muted-foreground">
              {quota?.tier === "auth" ? (
                "AI Guide • Signed in"
              ) : quota && quota.remaining > 0 ? (
                <>
                  {`AI Guide • ${quota.remaining} free message${
                    quota.remaining === 1 ? "" : "s"
                  } left`}
                </>
              ) : (
                "AI Guide"
              )}
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close chat"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg px-3 py-2 text-sm text-muted-foreground">
              <span className="inline-flex gap-1">
                <span
                  className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce"
                  style={{ animationDelay: "0ms" }}
                />
                <span
                  className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce"
                  style={{ animationDelay: "150ms" }}
                />
                <span
                  className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce"
                  style={{ animationDelay: "300ms" }}
                />
              </span>
            </div>
          </div>
        )}

        {/* Soft nudge: 2 messages left for anon users */}
        {shouldNudge && !loading && (
          <div className="text-xs text-muted-foreground border border-dashed border-border rounded-lg p-2 bg-muted/30">
            You have {quota?.remaining} free message
            {quota?.remaining === 1 ? "" : "s"} left.{" "}
            <Link
              href="/sign-up"
              className="text-primary underline hover:no-underline"
            >
              Sign up free
            </Link>{" "}
            for unlimited access.
          </div>
        )}

        {/* Hard cap: sign-in CTA */}
        {showSignInCta && (
          <div className="border border-primary/30 bg-primary/5 rounded-lg p-3 space-y-2">
            <div className="flex items-start gap-2">
              <Lock className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <p className="text-xs text-foreground">
                You&apos;ve reached Athena&apos;s free visitor limit. Sign in to
                keep chatting — it&apos;s free, and signed-in users get priority
                access.
              </p>
            </div>
            <div className="flex gap-2">
              <Link
                href="/sign-up"
                className="flex-1 text-center text-xs font-medium bg-primary text-primary-foreground rounded-md px-3 py-2 hover:bg-primary/90 transition-colors"
              >
                Sign up free
              </Link>
              <Link
                href="/sign-in"
                className="flex-1 text-center text-xs font-medium border border-border rounded-md px-3 py-2 hover:bg-muted transition-colors"
              >
                Sign in
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder={
              showSignInCta
                ? "Sign in to continue chatting…"
                : "Ask Athena anything..."
            }
            className="flex-1 bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-60"
            disabled={loading || showSignInCta}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim() || showSignInCta}
            className="bg-primary text-primary-foreground rounded-lg px-3 py-2 hover:bg-primary/90 transition-colors disabled:opacity-50"
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        {quota?.tier === "auth" && (
          <p className="mt-1.5 text-[10px] text-muted-foreground">
            {quota.remaining} messages remaining this session
          </p>
        )}
      </div>
    </div>
  );
}
