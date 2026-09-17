"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Bot, Send, Sparkles, X, Loader2, ChevronDown, ChevronUp, Volume2, VolumeX, Mic, Square } from "lucide-react";

type Message = {
  role: "user" | "assistant";
  content: string;
  tier?: string;
  model?: string;
  sessionId?: string;
  streaming?: boolean;
  extractedFacts?: number;
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
  // Voice mode defaults to ON — per the master prompt, Athena always replies
  // with voice. The user can toggle it OFF via the header button.
  const [voiceMode, setVoiceMode] = useState<"auto" | "off">("auto");
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const [messages, setMessages] = useState<Message[]>([{ role: "assistant", content: "Hi, I'm Athena. Ask me anything about your pitch." }]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSpokenIdxRef = useRef<number | null>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading, speaking]);

  // Voice playback — calls /api/athena/voice which proxies to the
  // worker's POST /v1/athena/voice endpoint (ElevenLabs streaming MP3).
  const speak = useCallback(async (text: string, idx: number) => {
    if (speaking === idx) {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      setSpeaking(null);
      return;
    }
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setSpeaking(idx);
    lastSpokenIdxRef.current = idx;
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

  // Auto-speak when voice mode is ON and a message finishes streaming
  useEffect(() => {
    if (voiceMode !== "auto") return;
    // Find the last assistant message that just finished streaming
    const lastIdx = messages.length - 1;
    const lastMsg = messages[lastIdx];
    if (lastMsg && lastMsg.role === "assistant" && !lastMsg.streaming && lastMsg.content && lastSpokenIdxRef.current !== lastIdx) {
      // Small delay to let the UI settle
      const timer = setTimeout(() => {
        speak(lastMsg.content, lastIdx);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [messages, voiceMode, speak]);

  // Microphone recording
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recordingChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordingChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const blob = new Blob(recordingChunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach(t => t.stop());

        // Stop the timer
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }

        // Transcribe via /api/athena/audio
        setTranscribing(true);
        try {
          const formData = new FormData();
          formData.append("audio", blob, "recording.webm");
          formData.append("session_id", sessionId || "");
          const res = await fetch("/api/athena/audio", {
            method: "POST",
            body: formData,
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || err.detail || `Audio API returned ${res.status}`);
          }
          const data = await res.json();
          if (data.text && data.text.trim()) {
            // Put the transcription in the input field for the user to review + send
            setInput(data.text.trim());
          } else {
            setError("No speech detected in the recording. Try again.");
          }
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
        } finally {
          setTranscribing(false);
          setRecordingTime(0);
        }
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
      setRecordingTime(0);

      // Start timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(t => {
          if (t >= 60) {
            // Auto-stop at 60 seconds
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
              mediaRecorderRef.current.stop();
            }
            return 60;
          }
          return t + 1;
        });
      }, 1000);
    } catch (e) {
      setError(e instanceof Error ? `Microphone access failed: ${e.message}` : String(e));
    }
  }, [sessionId]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  }, []);

  const send = useCallback(async () => {
    const message = input.trim();
    if (!message || loading) return;
    setInput(""); setError(null);
    setMessages((m) => [...m, { role: "user", content: message }]);
    setLoading(true);

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

        let boundary: number;
        while ((boundary = buffer.indexOf("\n\n")) >= 0) {
          const rawEvent = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);

          let eventType = "data";
          let dataStr = "";
          for (const line of rawEvent.split("\n")) {
            if (line.startsWith("event:")) eventType = line.slice(6).trim();
            else if (line.startsWith("data:")) dataStr += (dataStr ? "\n" : "") + line.slice(5).trim();
          }
          if (!dataStr || dataStr === "[DONE]") continue;

          let parsedData: any;
          try { parsedData = JSON.parse(dataStr); } catch { continue; }

          if (eventType === "meta" && parsedData) {
            meta = parsedData;
            if (meta.session_id) setSessionId(meta.session_id);
          } else if (eventType === "data") {
            const delta = parsedData.choices?.[0]?.delta?.content || parsedData.delta || parsedData.response || "";
            if (delta && typeof delta === "string") {
              accumulated += delta;
              setMessages((m) => m.map((msg, i) => i === assistantIdx ? { ...msg, content: accumulated, tier: meta.tier, model: meta.model, sessionId: meta.session_id, streaming: true } : msg));
            }
          } else if (eventType === "done") {
            setMessages((m) => m.map((msg, i) => i === assistantIdx ? { ...msg, streaming: false } : msg));
          } else if (eventType === "error") {
            throw new Error(parsedData?.error || "Stream error");
          }
        }
      }

      if (!accumulated && buffer.trim()) {
        try {
          const data = JSON.parse(buffer);
          if (data.response) {
            setMessages((m) => m.map((msg, i) => i === assistantIdx ? { ...msg, content: data.response, tier: data.tier, model: data.model, sessionId: data.session_id, streaming: false, extractedFacts: data.memory_facts_extracted } : msg));
          }
        } catch { /* leave the empty content */ }
      } else {
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
        <div className="flex items-center gap-2">
          {/* Voice toggle — ON = auto-speak every reply, OFF = text only */}
          <button
            onClick={() => setVoiceMode(v => v === "auto" ? "off" : "auto")}
            className={`flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium transition-colors ${voiceMode === "auto" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`}
            aria-label="Toggle auto-voice"
            title={voiceMode === "auto" ? "Auto-voice ON — Athena speaks every reply" : "Auto-voice OFF — text only"}
          >
            {voiceMode === "auto" ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
            <span>{voiceMode === "auto" ? "Voice" : "Muted"}</span>
          </button>
          <button onClick={() => setOpen(false)} aria-label="Close Athena" className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
      </div>
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((m, i) => <AthenaMessage key={i} message={m} onSpeak={speak} speaking={speaking === i ? i : null} />)}
        {loading && messages[messages.length - 1]?.content === "" && <div className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">Connecting to the intelligence engine…</div>}
        {transcribing && <div className="rounded-lg bg-blue-500/10 px-3 py-2 text-sm text-blue-600 flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" />Transcribing audio…</div>}
        {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>}
      </div>
      <div className="flex gap-2 border-t border-border p-3">
        {recording ? (
          <button
            onClick={stopRecording}
            className="flex items-center gap-1 rounded-lg bg-red-500 px-3 py-2 text-white animate-pulse"
            aria-label="Stop recording"
            title="Stop recording"
          >
            <Square className="h-4 w-4" />
            <span className="text-xs font-mono">{recordingTime}s</span>
          </button>
        ) : (
          <button
            onClick={startRecording}
            disabled={loading || transcribing}
            className="flex items-center justify-center rounded-lg border border-input bg-background px-3 py-2 text-muted-foreground hover:bg-muted disabled:opacity-50"
            aria-label="Record audio"
            title="Record audio (up to 60s)"
          >
            <Mic className="h-4 w-4" />
          </button>
        )}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !loading) void send(); }}
          disabled={loading}
          placeholder={loading ? "Athena is responding…" : recording ? "Recording…" : "Ask about your pitch, traction, market, or runway…"}
          className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        <button onClick={() => void send()} disabled={loading || !input.trim()} className="rounded-lg bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50" aria-label="Send"><Send className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

export default AthenaWidget;
