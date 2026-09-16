"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Bot, X, Send, Sparkles, Lock, ImagePlus, Volume2, Loader2, Mic, MicOff } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";

type Message = { role: "user" | "assistant"; content: string };
type Quota = { tier: "anon" | "auth"; remaining: number; resetAt: number; requiresSignIn?: boolean };
type SpeechRecognitionResultEvent = Event & { results: SpeechRecognitionResultList };
type SpeechRecognitionErrorEvent = Event & { error: string };
type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;
declare global { interface Window { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor } }

const welcome: Message = { role: "assistant", content: "Hi! I'm Athena, your AI guide. I can help you navigate PitchCoach Ai, understand your scores, and get the most out of your coaching sessions. How can I help you today?" };

// 15 randomized fallback responses — used when the auth trigger is delayed
// or the AI model is still activating. Each is a complete, helpful response
// that doesn't require backend tools. Preloaded in the widget so the user
// gets an instant response even during auth latency.
const fallbackResponses: string[] = [
  "I'm Athena. While I'm connecting to your data, I can tell you that PitchCoach Ai scores your pitch across eight dimensions — from problem clarity to financial projections. Upload your deck and I'll break it down.",
  "Welcome back. I'm initializing my connection to your pitch data. In the meantime: your scoring ranges from 0 (Not Ready) to 100 (Highly Prepared). Anything above 61 is investor-ready.",
  "Athena here, just warming up. Did you know the E1 Pitch Deck Analyser can score your deck in under 60 seconds? Upload a PDF or PPTX and I'll show you where you stand.",
  "Good to see you. I'm syncing with your dashboard now. While we wait — the Script Check module analyzes your elevator pitch element by element. Try it after your deck analysis.",
  "Hi! I'm still connecting to the backend. Quick tip: investors spend an average of 3 minutes on a pitch deck. Your first slide needs a hook that makes them read the second.",
  "Athena, initializing. The Live Pitch module records your delivery and analyzes body language, pacing, and confidence. It's the fastest way to find your weak spots.",
  "Welcome. I'm bringing your data online now. Your Founder tier includes unlimited sessions — deck analysis, script coaching, live pitch, and full 30-minute sessions.",
  "Hi there! I'm Athena, your pitch coach. I'm connecting to your session history. Meanwhile: the Full Pitch Session combines your deck + a 30-minute video for a 6-dimension readiness score.",
  "Athena, coming online. Here's something useful while we connect: a pitch deck should have 10-15 slides maximum. More than that and investors stop reading.",
  "Good to have you back. I'm syncing my context with your account. Quick insight: your 'ask' slide is the second most-viewed slide by investors. Make it specific and justified.",
  "Hello! I'm Athena, still warming up my connection. The market opportunity slide should be TAM-SAM-SOM format with bottom-up sizing. Investors will catch top-down inflation immediately.",
  "Athena here. While I connect to your data, remember: your team slide matters more than you think. Investors invest in people first, ideas second. Show credibility.",
  "Welcome back! I'm initializing my AI service. Fun fact: decks with a clear problem-solution structure score 23% higher on average than narrative-only decks.",
  "Hi! I'm Athena, getting ready to help. While I connect: the E5 Founder Coaching module includes investor research, cohort matching, and pathway recommendations. Worth exploring.",
  "Athena, activating now. If you're preparing for a specific pitch, tell me the audience — seed VCs, angel groups, or accelerators each need different emphasis in your deck.",
];

export function AthenaWidget() {
  const { isLoaded, isSignedIn, user } = useUser();
  const [hydrated, setHydrated] = useState(false);
  const storageKey = `athena-widget:${user?.id ?? "anonymous"}`;
  // Widget starts CLOSED on sign-in. It connects to the backend AI service
  // layer immediately (warm-up trigger fires on mount), but the interaction
  // UI only opens when the user clicks the sparkle button.
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([welcome]);
  const [backendConnected, setBackendConnected] = useState(false);
  const [modelActivated, setModelActivated] = useState(false);
  const [activating, setActivating] = useState(false);
  useEffect(() => { if (!isLoaded) return; try { const saved = window.sessionStorage.getItem(storageKey); if (saved) { const parsed = JSON.parse(saved) as { messages?: Message[]; open?: boolean }; if (Array.isArray(parsed.messages) && parsed.messages.length) setMessages(parsed.messages ?? [welcome]); // Never restore open=true — widget always starts closed
  } } catch {} setHydrated(true); }, [isLoaded, storageKey]);
  useEffect(() => { if (!hydrated) return; try { window.sessionStorage.setItem(storageKey, JSON.stringify({ messages, open: false })); } catch {} }, [hydrated, storageKey, messages, open]);
  const [input, setInput] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [speaking, setSpeaking] = useState<number | null>(null);
  const [recording, setRecording] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const refreshQuota = useCallback(async () => {
    try {
      const res = await fetch("/api/athena/quota");
      if (!res.ok) return;
      const q = await res.json() as Quota;
      setQuota(q); setBlocked(q.tier === "anon" && q.remaining === 0);
    } catch { /* chat remains usable if quota peek is unavailable */ }
  }, []);

  useEffect(() => { if (open && isLoaded && hydrated) refreshQuota(); }, [open, isLoaded, hydrated, isSignedIn, refreshQuota]);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages, loading]);

  // ── AI Service Layer Activation Flow ────────────────────────────────────
  // Phase 1 (mount, closed): Widget renders, calls GET /api/athena/activate
  //   → Returns { activated: false, status: 'standby' } — AI model nested, awaiting auth
  // Phase 2 (signed in): Polls /activate every 2s until status='active'
  //   → If primary trigger (Clerk webhook) succeeded: status='active' immediately
  //   → If primary failed: dashboard fetch fires POST /activate (fallback trigger)
  // Phase 3 (user clicks open): Widget opens, interaction begins
  //   → If model not yet activated: uses fallback responses (15 randomized)
  //   → When activation completes: switches to full agent mode (Poke API + tools)
  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    let pollCount = 0;
    const maxPolls = 15; // max 30s of polling (15 × 2s)

    const poll = async () => {
      if (cancelled) return;
      try {
        const res = await fetch("/api/athena/activate", { method: "GET" });
        if (cancelled || !res.ok) { setBackendConnected(false); return; }
        setBackendConnected(true);
        const data = await res.json();

        if (data.activated) {
          setModelActivated(true);
          setActivating(false);
          return; // Stop polling — model is active
        }

        // Not yet activated — check if we should fire the fallback trigger
        if (data.status === "stale" || (data.status === "standby" && isSignedIn && pollCount === 2)) {
          // Dashboard sync should have fired the trigger by now (3 polls = 6s)
          // If still not activated, fire fallback trigger from the widget
          setActivating(true);
          try {
            const triggerRes = await fetch("/api/athena/activate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ fallback: true }),
            });
            if (triggerRes.ok) {
              const triggerData = await triggerRes.json();
              if (triggerData.activated) {
                setModelActivated(true);
                setActivating(false);
                return;
              }
            }
          } catch { /* fallback failed — continue polling */ }
        }

        pollCount++;
        if (pollCount < maxPolls) {
          setTimeout(poll, 2000); // Poll every 2s
        } else {
          // Timeout — model not activated. Widget will use fallback responses.
          setActivating(false);
          console.warn("[Athena] Activation timed out after 30s — using fallback responses");
        }
      } catch {
        setBackendConnected(false);
        // Retry after 2s
        if (pollCount < maxPolls) {
          pollCount++;
          setTimeout(poll, 2000);
        }
      }
    };

    poll();
    return () => { cancelled = true; };
  }, [hydrated, isSignedIn]);

  // Get a random fallback response
  const getFallbackResponse = useCallback((): string => {
    return fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
  }, []);

  const cleanupAudio = useCallback(() => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.onended = null; audioRef.current.onerror = null; audioRef.current = null; }
    if (audioUrlRef.current) { URL.revokeObjectURL(audioUrlRef.current); audioUrlRef.current = null; }
    setSpeaking(null);
  }, []);

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setRecording(false);
  }, []);

  useEffect(() => () => { stopRecording(); cleanupAudio(); }, [cleanupAudio, stopRecording]);

  const toggleRecording = () => {
    if (recording) { stopRecording(); return; }
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) { setVoiceError("Voice input is not supported by this browser."); return; }
    setVoiceError(null);
    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = event => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) transcript += event.results[i][0].transcript;
      setInput(transcript.trim());
    };
    recognition.onerror = event => { setVoiceError(event.error === "not-allowed" ? "Microphone permission was denied." : "Voice input failed. Please try again."); setRecording(false); recognitionRef.current = null; };
    recognition.onend = () => { setRecording(false); recognitionRef.current = null; };
    recognitionRef.current = recognition;
    try { recognition.start(); setRecording(true); } catch { setVoiceError("Unable to start the microphone."); recognitionRef.current = null; }
  };

  const speak = async (text: string, index: number) => {
    if (speaking === index) { cleanupAudio(); return; }
    cleanupAudio();
    setSpeaking(index);
    try {
      const res = await fetch("/api/athena/speak", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: text.slice(0, 5000) }) });
      if (!res.ok) throw new Error("TTS failed");
      const url = URL.createObjectURL(await res.blob());
      audioUrlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = cleanupAudio;
      audio.onerror = cleanupAudio;
      await audio.play();
    } catch { cleanupAudio(); }
  };

  const onFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    if (file.size > 10 * 1024 * 1024) { alert("Image too large (max 10MB)"); return; }
    const reader = new FileReader();
    reader.onload = () => { setImage(String(reader.result).split(",")[1] ?? null); setInput(v => v || "Analyze this image"); };
    reader.readAsDataURL(file); event.target.value = "";
  };

  const send = async () => {
    if (!isLoaded || !hydrated || !isSignedIn || (!input.trim() && !image) || loading || blocked) return;
    stopRecording();
    const text = input.trim() || "Analyze this image"; const attached = image;
    setInput(""); setImage(null); setMessages(prev => [...prev, { role: "user", content: attached ? `${text} [image attached]` : text }]); setLoading(true);

    // If AI model is not yet activated, use a fallback response (instant, no backend call)
    if (!modelActivated) {
      await new Promise(r => setTimeout(r, 500)); // small delay for realism
      setMessages(prev => [...prev, { role: "assistant", content: getFallbackResponse() }]);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/athena/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: text, history: messages, ...(attached ? { image: attached } : {}) }) });
      const data = await res.json();
      if (res.status === 402) { setBlocked(true); setQuota(q => q ? { ...q, remaining: 0, requiresSignIn: true } : q); setMessages(prev => [...prev, { role: "assistant", content: data.message || "You've reached Athena's free visitor limit. Sign in to keep chatting â it's free." }]); return; }
      if (res.status === 429) { setMessages(prev => [...prev, { role: "assistant", content: data.message || "Athena is busy right now. Please try again in a moment." }]); return; }
      if (!res.ok) throw new Error("Athena request failed");
      setMessages(prev => [...prev, { role: "assistant", content: data.response || data.message || "Athena did not return a response." }]);
      const remaining = Number(res.headers.get("X-Athena-Remaining"));
      setQuota(q => q ? { ...q, remaining: Number.isFinite(remaining) ? remaining : q.remaining } : q);
      await refreshQuota();
    } catch { setMessages(prev => [...prev, { role: "assistant", content: "I'm having trouble connecting right now. Please try again in a moment." }]); }
    finally { setLoading(false); }
  };

  if (!open) return <button onClick={() => setOpen(true)} className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-110 relative" aria-label="Open Athena AI Guide">
    <Sparkles className="h-6 w-6" />
    {modelActivated && <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
      <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-emerald-500" />
    </span>}
    {activating && !modelActivated && <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
      <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-amber-500" />
    </span>}
  </button>;
  const nudge = quota?.tier === "anon" && quota.remaining > 0 && quota.remaining <= 2;
  return <div className="fixed bottom-6 right-6 z-50 flex w-96 max-w-[calc(100vw-2rem)] flex-col rounded-2xl border border-border bg-background shadow-2xl" style={{ maxHeight: "70vh" }}>
    <div className="flex items-center justify-between rounded-t-2xl border-b border-border bg-primary/5 p-4"><div className="flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20"><Bot className="h-5 w-5 text-primary" /></div><div><p className="text-sm font-semibold">Athena</p><p className="text-xs text-muted-foreground">{quota?.tier === "auth" ? "AI Guide â¢ Signed in" : quota ? `AI Guide â¢ ${quota.remaining} free message${quota.remaining === 1 ? "" : "s"} left` : "AI Guide"}</p></div></div><button onClick={() => { stopRecording(); cleanupAudio(); setOpen(false); }} aria-label="Close chat" className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button></div>
    <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">{messages.map((m, i) => <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}><div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}><div className="flex items-start gap-2"><div className="flex-1">{m.content}</div>{m.role === "assistant" && <button onClick={() => speak(m.content, i)} disabled={speaking !== null && speaking !== i} className="shrink-0 text-muted-foreground hover:text-primary disabled:opacity-50" aria-label="Play voice">{speaking === i ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Volume2 className="h-3.5 w-3.5" />}</button>}</div></div></div>)}{loading && <div className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">Thinkingâ¦</div>}{nudge && <div className="rounded-lg border border-dashed p-2 text-xs text-muted-foreground">You have {quota.remaining} free message{quota.remaining === 1 ? "" : "s"} left. <Link className="text-primary underline" href="/sign-up">Sign up free</Link> for unlimited access.</div>}{blocked && <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs"><div className="flex gap-2"><Lock className="h-4 w-4 shrink-0 text-primary" />Sign in to keep chatting â it&apos;s free.</div><div className="flex gap-2"><Link className="flex-1 rounded-md bg-primary px-3 py-2 text-center text-primary-foreground" href="/sign-up">Sign up free</Link><Link className="flex-1 rounded-md border px-3 py-2 text-center" href="/sign-in">Sign in</Link></div></div>}</div>
    <div className="border-t border-border p-3"><input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />{image && <div className="mb-2 flex items-center gap-2 rounded bg-primary/10 px-2 py-1 text-xs text-primary"><ImagePlus className="h-3 w-3" />Image attached<button className="ml-auto" onClick={() => setImage(null)}>â</button></div>}{voiceError && <div className="mb-2 text-xs text-destructive" role="status">{voiceError}</div>}<div className="flex gap-2"><button onClick={() => fileRef.current?.click()} disabled={loading || blocked || recording} className="rounded-lg border px-2 disabled:opacity-50" aria-label="Upload image"><ImagePlus className="h-4 w-4" /></button><button onClick={toggleRecording} disabled={loading || blocked} className={`rounded-lg border px-2 disabled:opacity-50 ${recording ? "border-destructive bg-destructive/10 text-destructive" : ""}`} aria-label={recording ? "Stop voice input" : "Start voice input"} aria-pressed={recording}>{recording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}</button><input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} disabled={loading || blocked} placeholder={recording ? "Listeningâ¦" : blocked ? "Sign in to continue chattingâ¦" : "Ask Athena anythingâ¦"} className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" /><button onClick={send} disabled={loading || blocked || (!input.trim() && !image)} className="rounded-lg bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50" aria-label="Send message"><Send className="h-4 w-4" /></button></div></div>
  </div>;
}

export default AthenaWidget;
