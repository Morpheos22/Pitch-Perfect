/** POST /api/athena/speak — authenticated, rate-limited, server-locked ElevenLabs TTS. */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { generateSalutation, normalizeNamesForSpeech } from "@/lib/salutations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;
const VOICE_ID = "21m00Tcm4TlvDq8ikWAM";
const MODEL_ID = "eleven_turbo_v2_5";
// MAX_TEXT_LENGTH = 200 chars ≈ 37 words ≈ 15 seconds of natural speech
// at ~150 wpm. Per user spec: "max amount of sec athenas transcribe tool is 15 secs"
// — this caps the OUTPUT audio at 15s. Input mic recording is already capped
// at MAX_RECORDING_SECONDS=15 in athena-widget.tsx.
const MAX_TEXT_LENGTH = 200;
const CACHE_TTL_MS = 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 32;
const RATE_WINDOW_MS = 60 * 1000;
const RATE_LIMIT = 10;
type CachedAudio = { bytes: ArrayBuffer; expiresAt: number };
const audioCache = new Map<string, CachedAudio>();
const rateBuckets = new Map<string, { count: number; resetAt: number }>();
function normalizeText(input: string) { return normalizeNamesForSpeech(input.normalize("NFKC").replace(/[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F]/g, "").replace(/\\s+/g, " ").trim()); }
function getCached(key: string) { const entry = audioCache.get(key); if (!entry) return; if (entry.expiresAt <= Date.now()) { audioCache.delete(key); return; } return entry.bytes; }
function setCached(key: string, bytes: ArrayBuffer) { if (audioCache.size >= MAX_CACHE_ENTRIES) audioCache.delete(audioCache.keys().next().value as string); audioCache.set(key, { bytes, expiresAt: Date.now() + CACHE_TTL_MS }); }
function consumeRateLimit(subject: string) { const now = Date.now(); const current = rateBuckets.get(subject); if (!current || current.resetAt <= now) { rateBuckets.set(subject, { count: 1, resetAt: now + RATE_WINDOW_MS }); return { allowed: true, retryAfter: 0 }; } if (current.count >= RATE_LIMIT) return { allowed: false, retryAfter: Math.ceil((current.resetAt - now) / 1000) }; current.count += 1; return { allowed: true, retryAfter: 0 }; }
function pruneRateBuckets() { const now = Date.now(); for (const [key, bucket] of rateBuckets) if (bucket.resetAt <= now) rateBuckets.delete(key); }
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rateKey = `user:${userId}`; const rate = consumeRateLimit(rateKey);
  if (!rate.allowed) return NextResponse.json({ error: "Too many speech requests" }, { status: 429, headers: { "Retry-After": String(rate.retryAfter) } });
  if (rateBuckets.size > 1000) pruneRateBuckets();
  const apiKey = process.env.ELEVENLABS_API_KEY; if (!apiKey) return NextResponse.json({ error: "ElevenLabs not configured" }, { status: 503 });
  let body: unknown; try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const payload = (body as { text?: unknown; greeting?: unknown; name?: unknown; hasPriorSession?: unknown } | null) ?? {};
  const rawText = payload.greeting === true && typeof payload.name === "string" ? generateSalutation({ name: payload.name, hasPriorSession: payload.hasPriorSession === true }) : payload.text;
  if (typeof rawText !== "string") return NextResponse.json({ error: "Text required" }, { status: 400 });
  const text = normalizeText(rawText); if (!text) return NextResponse.json({ error: "Text required" }, { status: 400 });
  // Truncate to MAX_TEXT_LENGTH rather than reject — Athena's full responses
  // will often exceed 200 chars, but the user still wants partial voice
  // (15-second cap on output audio per user spec).
  const truncatedText = text.length > MAX_TEXT_LENGTH
    ? text.slice(0, MAX_TEXT_LENGTH).replace(/[\s,]+$/, "") + "…"
    : text;
  const key = truncatedText; const cached = getCached(key);
  if (cached) return new NextResponse(cached, { status: 200, headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=3600", "X-Athena-TTS-Cache": "HIT" } });
  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, { method: "POST", headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" }, body: JSON.stringify({ text: truncatedText, model_id: MODEL_ID, voice_settings: { stability: 0.55, similarity_boost: 0.75, style: 0.2, use_speaker_boost: true } }) });
    if (!res.ok) { const errText = await res.text(); console.error("[Athena Speak] ElevenLabs error:", res.status, errText.slice(0, 200)); return NextResponse.json({ error: "Speech generation failed" }, { status: 502 }); }
    const audioBuffer = await res.arrayBuffer(); setCached(key, audioBuffer);
    return new NextResponse(audioBuffer, { status: 200, headers: { "Content-Type": "audio/mpeg", "Content-Length": String(audioBuffer.byteLength), "Cache-Control": "private, max-age=3600", "X-Athena-TTS-Cache": "MISS" } });
  } catch (error) { console.error("[Athena Speak] Error:", error); return NextResponse.json({ error: "Failed to generate speech" }, { status: 500 }); }
}
