"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Bot, Send, Sparkles, X, Loader2, ChevronDown, ChevronUp, Volume2 } from "lucide-react";

type Message = {
  role: "user" | "assistant";
  content: string;
  tier?: string;
  model?: string;
  sessionId?: string;
  streaming?: boolean;
  extractedFacts?: number;
};

type SSEEvent = {
  type: "meta" | "data" | "done" | "error";
  data?: any;
};

const TIER_LABELS: Record<string, string> = {
  conversational: "Quick Chat",
  diligence: "Diligence",
  deep: "IC Memo",
};

// Parse the Output Contract format (FINDING/EVIDENCE/GAP/IMPLICATION/DEMAND/SCORE/NEXT MOVE)
// into structured fields for nicer rendering. If parsing fails, fall back to plain text.
function parseOutputContract(raw: string): { sections: Array<{ label: string; body: string }>; raw: string } {
  const labels = ["FINDING", "EVIDENCE", "GAP", "IMPLICATION", "DEMAND", "SCORE", "NEXT MOVE", "FINAL VERDICT"];
  const sections: Array<{ label: string; body: string }> = [];
  const pattern = new RegExp(`^(${labels.join("|")})\\s*:\\s*(.+?)(?=\\n(?:${labels.join("|")})\\s*:|$)`, "gims");
  let m: RegExpExecArray | null;
  let lastIdx = 0;
  while ((m = pattern.exec(raw)) !== null) {
    sections.push({ label: m[1].toUpperCase(), body: m[2].trim() });
    lastIdx = pattern.lastIndex;
  }
  // Capture any trailing content not matched (e.g., FINAL VERDICT line)
  if (!sections.length) return { sections: [], raw };
  if (lastIdx < raw.length) {
    const trailing = raw.slice(lastIdx).trim();
    if (trailing) sections.push({ label: "NOTE", body: trailing });
  }
  return { sections, raw };
}

function AthenaMessage({ message, onSpeak, speaking }: { message: Message; onSpeak?: (text: string, idx: number) => void; speaking?: number | null }) {
  const isUser = message.role === "user";
  const [expanded, setExpanded] = useState(false);
  const [localIdx] = useState(() => Math.random().toString(36).slice(2));
  const parsed = !isUser ? parseOutputContract(message.content) : null;

  if (isUser) {
    return <div className="ml-8 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">{message.content}</div>;
  }

  const tier = message.tier ? TIER_LABELS[message.tier] || message.tier : null;
  const canSpeak = !message.streaming && message.content && message.content.length > 0 && onSpeak;
  return (
    <div className="mr-8 rounded-lg bg-muted px-3 py-2 text-sm">
      {/* Header — tier + model + streaming indicator + voice button */}
      <div className="mb-1 flex items-center gap-2 border-b border-border/50 pb-1 text-[10px] text-muted-foreground">
        {tier && <span className="rounded bg-primary/10 px-1.5 py-0.5 font-medium text-primary">{tier}</span>}
        {message.extractedFacts ? <span className="text-amber-600">+{message.extractedFacts} fact{message.extractedFacts > 1 ? "s" : ""}</span> : null}
        {message.streaming && <span className="flex items-center gap-1 text-blue-600"><Loader2 className="h-3 w-3 animate-spin" />streaming</span>}
        {canSpeak && (
          <button
            onClick={() => onSpeak && onSpeak(message.content, parseInt(localIdx, 36) || 0)}
            className="ml-auto flex items-center gap-1 rounded px-1.5 py-0.5 text-primary hover:bg-primary/10"
            aria-label="Play Athena voice"
            title="Hear Athena speak"
          >
            {speaking ? <Loader2 className="h-3 w-3 animate-spin" /> : <Volume2 className="h-3 w-3" />}
            <span>{speaking ? "Speaking" : "Voice"}</span>
          </button>
        )}
      </div>

      {/* Body — parsed Output Contract sections OR raw text */}
      {parsed && parsed.sections.length > 0 ? (
        <div className="space-y-1.5">
          {parsed.sections.slice(0, expanded ? undefined : 4).map((s, i) => (
            <div key={i} className="text-xs">
              <span className="font-semibold text-foreground/80">{s.label}:</span>{" "}
              <span className="text-foreground/90">{s.body}</span>
            </div>
          ))}
          {parsed.sections.length > 4 && (
            <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1 text-[10px] text-primary hover:underline">
              {expanded ? <><ChevronUp className="h-3 w-3" />Hide {parsed.sections.length - 4} more</> : <><ChevronDown className="h-3 w-3" />Show {parsed.sections.length - 4} more</>}
            </button>
          )}
        </div>
      ) : (
        <div className="whitespace-pre-wrap">{message.content}</div>
      )}
    </div>
  );
}

export function AthenaWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [speaking, setSpeaking] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([{ role: "assistant", content: "Hi, I'm Athena. Ask me anything about your pitch." }]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading, speaking]);

  // Voice playback — calls /api/athena/chat/voice which proxies to the
  // worker's POST /v1/athena/voice endpoint (ElevenLabs streaming MP3).
  // Falls back gracefully if the voice API is unavailable.
  const speak = useCallback(async (text: string, idx: number) => {
    // Toggle off if already speaking this message
    if (speaking === idx) {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      setSpeaking(null);
      return;
    }
    // Stop any current playback
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setSpeaking(idx);
    try {
      const res = await fetch("/api/athena/voice", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: text.slice(0, 5000), session_id: sessionId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.detail || `Voice API returned ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { setSpeaking(null); URL.revokeObjectURL(url); audioRef.current = null; };
      audio.onerror = () => { setSpeaking(null); URL.revokeObjectURL(url); audioRef.current = null; };
      await audio.play();
    } catch (e) {
      console.error("[Athena] voice playback failed:", e);
      setSpeaking(null);
    }
  }, [speaking, sessionId]);

  const send = useCallback(async () => {
    const message = input.trim();
    if (!message || loading) return;
    setInput(""); setError(null);
    setMessages((m) => [...m, { role: "user", content: message }]);
    setLoading(true);

    // Use streaming for the responsive experience — tokens arrive as generated
    const assistantIdx = messages.length + 1;
    setMessages((m) => [...m, { role: "assistant", content: "", streaming: true }]);

    try {
      const response = await fetch("/api/athena/chat", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "text/event-stream" },
        body: JSON.stringify({ message, turns: messages, stream: true, session_id: sessionId }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || data.detail || `Athena returned HTTP ${response.status}`);
      }

      // Read the SSE stream
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";
      let meta: { tier?: string; model?: string; session_id?: string } = {};

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events (look for "event: X\ndata: Y\n\n")
        const events: SSEEvent[] = [];
        let eventStart = buffer.indexOf("event:");
        let dataStart = buffer.indexOf("data:", eventStart);
        let eventEnd = buffer.indexOf("\n\n", dataStart);

        while (eventStart >= 0 && dataStart >= 0 && eventEnd >= 0) {
          const eventType = buffer.slice(eventStart + 6, dataStart).trim();
          const dataStr = buffer.slice(dataStart + 5, eventEnd).trim();
          try {
            const parsedData = JSON.parse(dataStr);
            events.push({ type: eventType as any, data: parsedData });
          } catch { /* not JSON, skip */ }
          buffer = buffer.slice(eventEnd + 2);
          eventStart = buffer.indexOf("event:");
          dataStart = buffer.indexOf("data:", eventStart);
          eventEnd = buffer.indexOf("\n\n", dataStart);
        }

        for (const ev of events) {
          if (ev.type === "meta" && ev.data) {
            meta = ev.data;
            if (meta.session_id) setSessionId(meta.session_id);
          } else if (ev.type === "data" && ev.data) {
            // Workers AI sends OpenAI-style chunks: { choices: [{ delta: { content } }] }
            // OR our wrapper sends: { response: "...", delta: "..." }
            const delta = ev.data.choices?.[0]?.delta?.content || ev.data.delta || ev.data.response || "";
            if (delta && typeof delta === "string") {
              accumulated += delta;
              setMessages((m) => m.map((msg, i) => i === assistantIdx ? { ...msg, content: accumulated, tier: meta.tier, model: meta.model, sessionId: meta.session_id, streaming: true } : msg));
            }
          } else if (ev.type === "done") {
            setMessages((m) => m.map((msg, i) => i === assistantIdx ? { ...msg, streaming: false } : msg));
          } else if (ev.type === "error") {
            throw new Error(ev.data?.error || "Stream error");
          }
        }
      }

      // If we never got a meta event (e.g., worker fell back to non-streaming),
      // try parsing the accumulated buffer as a plain JSON response.
      if (!accumulated && buffer.trim()) {
        try {
          const data = JSON.parse(buffer);
          if (data.response) {
            setMessages((m) => m.map((msg, i) => i === assistantIdx ? { ...msg, content: data.response, tier: data.tier, model: data.model, sessionId: data.session_id, streaming: false, extractedFacts: data.memory_facts_extracted } : msg));
          }
        } catch { /* leave the empty content */ }
      } else {
        // Mark as done streaming
        setMessages((m) => m.map((msg, i) => i === assistantIdx ? { ...msg, streaming: false } : msg));
      }
    } catch (e) {
      const text = e instanceof Error ? e.message : String(e);
      setError(text);
      setMessages((m) => m.map((msg, i) => i === assistantIdx ? { ...msg, content: `Engine error: ${text}`, streaming: false } : msg));
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, sessionId]);

  if (!open) return <button onClick={() => setOpen(true)} className="fixed bottom-4 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-110" aria-label="Open Athena"><Sparkles className="h-6 w-6" /></button>;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex w-96 max-w-[calc(100vw-2rem)] flex-col rounded-2xl border border-border bg-background shadow-2xl" style={{ maxHeight: "70vh" }}>
      <div className="flex items-center justify-between rounded-t-2xl border-b border-border bg-primary/5 p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20"><Bot className="h-5 w-5 text-primary" /></div>
          <div>
            <p className="text-sm font-semibold">Athena</p>
            <p className="text-[10px] text-muted-foreground">Chief Diligence Officer · AI Pitch Coach</p>
          </div>
        </div>
        <button onClick={() => setOpen(false)} aria-label="Close Athena" className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
      </div>
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((m, i) => <AthenaMessage key={i} message={m} onSpeak={speak} speaking={speaking === i ? i : null} />)}
        {loading && messages[messages.length - 1]?.content === "" && <div className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">Connecting to the intelligence engine…</div>}
        {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>}
      </div>
      <div className="flex gap-2 border-t border-border p-3">
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !loading) void send(); }} disabled={loading} placeholder={loading ? "Athena is responding…" : "Ask about your pitch, traction, market, or runway…"} className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
        <button onClick={() => void send()} disabled={loading || !input.trim()} className="rounded-lg bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50" aria-label="Send"><Send className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

export default AthenaWidget;
