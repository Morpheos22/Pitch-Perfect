"use client";
import { useCallback, useState } from "react";

export type AthenaScores = Record<string, number>;
export type AthenaResult = { session_id: string; response?: string; analysis?: { rubric?: string }; scores?: AthenaScores; discrepancies?: unknown[]; audio?: string; audio_base64?: string };

export function useAthena(initialSessionId?: string) {
  const [sessionId, setSessionId] = useState(initialSessionId);
  const [result, setResult] = useState<AthenaResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = useCallback(async (message: string, turns: Array<{ role: string; content: string }> = []) => {
    setLoading(true); setError(null);
    try {
      const response = await fetch("/api/athena", { method: "POST", headers: { "content-type": "application/json", "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ session_id: sessionId, message, turns }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Athena request failed");
      setSessionId(data.session_id); setResult(data); return data as AthenaResult;
    } catch (cause) { const message = cause instanceof Error ? cause.message : "Athena request failed"; setError(message); throw cause; } finally { setLoading(false); }
  }, [sessionId]);
  return { sessionId, result, loading, error, submit };
}
