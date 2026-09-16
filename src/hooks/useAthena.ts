"use client";
import { useCallback, useEffect, useState } from "react";

export type AthenaScores = Record<string, number>;
export type AthenaTurn = { role: string; content: string };
export type AthenaResult = { session_id: string; response?: string; analysis?: { rubric?: string }; scores?: AthenaScores; discrepancies?: unknown[]; audio?: string; audio_base64?: string };

type Persisted = { sessionId?: string; turns: AthenaTurn[]; result?: AthenaResult | null };
const STORAGE_KEY = "pitchcoach:athena:v1";
const readPersisted = (): Persisted => { if (typeof window === "undefined") return { turns: [] }; try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{\"turns\":[]}"); } catch { return { turns: [] }; } };
const writePersisted = (value: Persisted) => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); } catch { /* storage is best effort */ } };

export function useAthena(initialSessionId?: string) {
  const [persisted, setPersisted] = useState<Persisted>(() => readPersisted());
  const [sessionId, setSessionId] = useState(initialSessionId || persisted.sessionId);
  const [result, setResult] = useState<AthenaResult | null>(persisted.result || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (initialSessionId && initialSessionId !== sessionId) { setSessionId(initialSessionId); } }, [initialSessionId, sessionId]);
  const submit = useCallback(async (message: string, turns: AthenaTurn[] = []) => {
    setLoading(true); setError(null);
    const local = readPersisted(); const mergedTurns = turns.length ? turns : local.turns;
    const idempotencyKey = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    try {
      let response: Response | undefined;
      let data: AthenaResult & { error?: string } = { session_id: sessionId || "" };
      for (let attempt = 0; attempt < 3; attempt++) {
        response = await fetch("/api/athena", { method: "POST", headers: { "content-type": "application/json", "Idempotency-Key": idempotencyKey }, body: JSON.stringify({ session_id: sessionId, message, turns: mergedTurns }) });
        data = await response.json().catch(() => ({ error: "Invalid Athena response", session_id: sessionId || "" }));
        if (response.ok || (response.status !== 401 && response.status !== 403)) break;
        await new Promise(resolve => setTimeout(resolve, 300 * 2 ** attempt));
      }
      if (!response?.ok) throw new Error(data.error || "Athena request failed");
      const nextTurns = [...mergedTurns, { role: "user", content: message }, ...(data.response ? [{ role: "assistant", content: data.response }] : [])];
      const next = { sessionId: data.session_id, turns: nextTurns, result: data }; writePersisted(next); setPersisted(next); setSessionId(data.session_id); setResult(data); return data;
    } catch (cause) { const text = cause instanceof Error ? cause.message : "Athena request failed"; setError(text); throw cause; } finally { setLoading(false); }
  }, [sessionId]);
  return { sessionId, result, loading, error, submit, turns: persisted.turns };
}
