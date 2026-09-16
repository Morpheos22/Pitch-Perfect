"use client";
import { FormEvent, useState } from "react";
import { useAthena } from "@/hooks/useAthena";

const axes = ["problem", "market", "solution", "traction", "business_model", "go_to_market", "founder"];
export function AthenaCoach() {
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<Array<{ role: string; content: string }>>([]);
  const { result, loading, error, submit } = useAthena();
  async function send(event: FormEvent) { event.preventDefault(); if (!input.trim() || loading) return; const message = input.trim(); setInput(""); setTurns((items) => [...items, { role: "user", content: message }]); const next = await submit(message, turns); if (next.response) setTurns((items) => [...items, { role: "assistant", content: next.response! }]); }
  const audio = result?.audio_base64 || result?.audio;
  return <section aria-label="Athena Coach"><div>{turns.map((turn, index) => <p key={index}><strong>{turn.role === "user" ? "You" : "Athena"}:</strong> {turn.content}</p>)}</div><form onSubmit={send}><input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Answer Athena's drill..." disabled={loading} /><button type="submit" disabled={loading || !input.trim()}>{loading ? "Thinking…" : "Send"}</button></form>{error && <p role="alert">{error}</p>}{result?.scores && <div aria-label="Seven-axis rubric">{axes.map((axis) => <span key={axis}>{axis}: {result.scores?.[axis] ?? "—"}/10 </span>)}</div>}{audio && <audio controls autoPlay src={audio.startsWith("data:") ? audio : `data:audio/mpeg;base64,${audio}`} />}{result?.discrepancies && result.discrepancies.length > 0 && <p role="status">Athena flagged {result.discrepancies.length} discrepancy(ies).</p>}</section>;
}
