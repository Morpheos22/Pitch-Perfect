"use client";

import { useState } from "react";
import { Bot, Send, Sparkles, X } from "lucide-react";

type Message = { role: "user" | "assistant"; content: string };

export function AthenaWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([{ role: "assistant", content: "Hi, I’m Athena. Ask me anything about your pitch." }]);

  const send = async () => {
    const message = input.trim();
    if (!message || loading) return;
    setInput(""); setError(null); setMessages((m) => [...m, { role: "user", content: message }]); setLoading(true);
    try {
      const response = await fetch("/api/athena/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message, turns: messages }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || data.detail || `Athena returned HTTP ${response.status}`);
      setMessages((m) => [...m, { role: "assistant", content: data.response || data.message || JSON.stringify(data) }]);
    } catch (e) {
      const text = e instanceof Error ? e.message : String(e); setError(text); setMessages((m) => [...m, { role: "assistant", content: `Engine error: ${text}` }]);
    } finally { setLoading(false); }
  };

  if (!open) return <button onClick={() => setOpen(true)} className="fixed bottom-4 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg" aria-label="Open Athena"><Sparkles className="h-6 w-6" /></button>;
  return <div className="fixed bottom-4 right-4 z-50 flex w-96 max-w-[calc(100vw-2rem)] flex-col rounded-2xl border border-border bg-background shadow-2xl" style={{ maxHeight: "70vh" }}>
    <div className="flex items-center justify-between rounded-t-2xl border-b border-border p-4"><div className="flex items-center gap-2"><Bot className="h-5 w-5 text-primary" /><span className="font-semibold">Athena</span></div><button onClick={() => setOpen(false)} aria-label="Close Athena"><X className="h-5 w-5" /></button></div>
    <div className="flex-1 space-y-3 overflow-y-auto p-4">{messages.map((m, i) => <div key={i} className={`rounded-lg px-3 py-2 text-sm ${m.role === "user" ? "ml-8 bg-primary text-primary-foreground" : "mr-8 bg-muted"}`}>{m.content}</div>)}{loading && <div className="rounded-lg bg-muted px-3 py-2 text-sm">Connecting to the intelligence engine…</div>}{error && <div className="text-xs text-destructive">{error}</div>}</div>
    <div className="flex gap-2 border-t border-border p-3"><input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void send(); }} disabled={loading} placeholder="Ask Athena…" className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm" /><button onClick={() => void send()} disabled={loading || !input.trim()} className="rounded-lg bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50" aria-label="Send"><Send className="h-4 w-4" /></button></div>
  </div>;
}

export default AthenaWidget;
