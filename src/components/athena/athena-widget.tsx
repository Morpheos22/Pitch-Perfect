"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Bot, X, Send, Sparkles, Lock, ImagePlus } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";

type Message = { role: "user" | "assistant"; content: string };
type Quota = { tier: "anon" | "auth"; remaining: number; resetAt: number; requiresSignIn?: boolean };
const welcome: Message = { role: "assistant", content: "Hi! I'm Athena, your AI guide. I can help you navigate PitchCoach Ai, understand your scores, and get the most out of your coaching sessions. How can I help you today?" };

export function AthenaWidget() {
  const { isSignedIn } = useUser();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([welcome]);
  const [input, setInput] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [blocked, setBlocked] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const refreshQuota = useCallback(async () => {
    try {
      const res = await fetch("/api/athena/quota");
      if (!res.ok) return;
      const q = await res.json() as Quota;
      setQuota(q); setBlocked(q.tier === "anon" && q.remaining === 0);
    } catch { /* chat remains usable if quota peek is unavailable */ }
  }, []);
  useEffect(() => { if (open) refreshQuota(); }, [open, isSignedIn, refreshQuota]);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages, loading]);

  const onFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    if (file.size > 10 * 1024 * 1024) { alert("Image too large (max 10MB)"); return; }
    const reader = new FileReader();
    reader.onload = () => { setImage(String(reader.result).split(",")[1] ?? null); setInput(v => v || "Analyze this image"); };
    reader.readAsDataURL(file); event.target.value = "";
  };

  const send = async () => {
    if ((!input.trim() && !image) || loading || blocked) return;
    const text = input.trim() || "Analyze this image"; const attached = image;
    setInput(""); setImage(null); setMessages(prev => [...prev, { role: "user", content: attached ? `${text} [image attached]` : text }]); setLoading(true);
    try {
      const res = await fetch("/api/athena/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: text, history: messages, ...(attached ? { image: attached } : {}) }) });
      const data = await res.json();
      if (res.status === 402) { setBlocked(true); setQuota(q => q ? { ...q, remaining: 0, requiresSignIn: true } : q); setMessages(prev => [...prev, { role: "assistant", content: data.message || "You've reached Athena's free visitor limit. Sign in to keep chatting — it's free." }]); return; }
      if (res.status === 429) { setMessages(prev => [...prev, { role: "assistant", content: data.message || "Athena is busy right now. Please try again in a moment." }]); return; }
      if (!res.ok) throw new Error("Athena request failed");
      setMessages(prev => [...prev, { role: "assistant", content: data.response || data.message || "Athena did not return a response." }]);
      const remaining = Number(res.headers.get("X-Athena-Remaining"));
      setQuota(q => q ? { ...q, remaining: Number.isFinite(remaining) ? remaining : q.remaining } : q);
      await refreshQuota();
    } catch { setMessages(prev => [...prev, { role: "assistant", content: "I'm having trouble connecting right now. Please try again in a moment." }]); }
    finally { setLoading(false); }
  };

  if (!open) return <button onClick={() => setOpen(true)} className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-110" aria-label="Open Athena AI Guide"><Sparkles className="h-6 w-6" /></button>;
  const nudge = quota?.tier === "anon" && quota.remaining > 0 && quota.remaining <= 2;
  return <div className="fixed bottom-6 right-6 z-50 flex w-96 max-w-[calc(100vw-2rem)] flex-col rounded-2xl border border-border bg-background shadow-2xl" style={{ maxHeight: "70vh" }}>
    <div className="flex items-center justify-between rounded-t-2xl border-b border-border bg-primary/5 p-4"><div className="flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20"><Bot className="h-5 w-5 text-primary" /></div><div><p className="text-sm font-semibold">Athena</p><p className="text-xs text-muted-foreground">{quota?.tier === "auth" ? "AI Guide • Signed in" : quota ? `AI Guide • ${quota.remaining} free message${quota.remaining === 1 ? "" : "s"} left` : "AI Guide"}</p></div></div><button onClick={() => setOpen(false)} aria-label="Close chat" className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button></div>
    <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">{messages.map((m, i) => <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}><div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{m.content}</div></div>)}{loading && <div className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">Thinking…</div>}{nudge && <div className="rounded-lg border border-dashed p-2 text-xs text-muted-foreground">You have {quota.remaining} free message{quota.remaining === 1 ? "" : "s"} left. <Link className="text-primary underline" href="/sign-up">Sign up free</Link> for unlimited access.</div>}{blocked && <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs"><div className="flex gap-2"><Lock className="h-4 w-4 shrink-0 text-primary" />Sign in to keep chatting — it&apos;s free.</div><div className="flex gap-2"><Link className="flex-1 rounded-md bg-primary px-3 py-2 text-center text-primary-foreground" href="/sign-up">Sign up free</Link><Link className="flex-1 rounded-md border px-3 py-2 text-center" href="/sign-in">Sign in</Link></div></div>}</div>
    <div className="border-t border-border p-3"><input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />{image && <div className="mb-2 flex items-center gap-2 rounded bg-primary/10 px-2 py-1 text-xs text-primary"><ImagePlus className="h-3 w-3" />Image attached<button className="ml-auto" onClick={() => setImage(null)}>✕</button></div>}<div className="flex gap-2"><button onClick={() => fileRef.current?.click()} disabled={loading || blocked} className="rounded-lg border px-2 disabled:opacity-50" aria-label="Upload image"><ImagePlus className="h-4 w-4" /></button><input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} disabled={loading || blocked} placeholder={blocked ? "Sign in to continue chatting…" : "Ask Athena anything…"} className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" /><button onClick={send} disabled={loading || blocked || (!input.trim() && !image)} className="rounded-lg bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50" aria-label="Send message"><Send className="h-4 w-4" /></button></div></div>
  </div>;
}

export default AthenaWidget;
