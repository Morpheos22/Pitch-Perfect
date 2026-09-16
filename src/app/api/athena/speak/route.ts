/** POST /api/athena/speak — authenticated ElevenLabs TTS with bounded in-memory caching. */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;
const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";
const CACHE_TTL_MS = 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 32;
type CachedAudio = { bytes: ArrayBuffer; expiresAt: number };
const audioCache = new Map<string, CachedAudio>();

function cacheKey(voiceId: string, text: string) { return `${voiceId}:${text}`; }
function getCached(key: string) { const entry = audioCache.get(key); if (!entry) return; if (entry.expiresAt < Date.now()) { audioCache.delete(key); return; } return entry.bytes; }
function setCached(key: string, bytes: ArrayBuffer) { if (audioCache.size >= MAX_CACHE_ENTRIES) audioCache.delete(audioCache.keys().next().value as string); audioCache.set(key, { bytes, expiresAt: Date.now() + CACHE_TTL_MS }); }

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ElevenLabs not configured — ELEVENLABS_API_KEY missing" }, { status: 503 });
  let body: { text?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (!body.text || typeof body.text !== "string") return NextResponse.json({ error: "Text required" }, { status: 400 });
  if (body.text.length > 5000) return NextResponse.json({ error: "Text too long (max 5000 chars)" }, { status: 400 });
  const text = body.text.trim(); const voiceId = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID; const key = cacheKey(voiceId, text);
  const cached = getCached(key);
  if (cached) return new NextResponse(cached, { status: 200, headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=3600", "X-Athena-TTS-Cache": "HIT" } });
  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, { method: "POST", headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" }, body: JSON.stringify({ text: text.slice(0, 5000), model_id: "eleven_turbo_v2_5", voice_settings: { stability: 0.55, similarity_boost: 0.75, style: 0.2, use_speaker_boost: true } }) });
    if (!res.ok) { const errText = await res.text(); console.error("[Athena Speak] ElevenLabs error:", res.status, errText.slice(0, 200)); return NextResponse.json({ error: `TTS failed: ${res.status}` }, { status: 502 }); }
    const audioBuffer = await res.arrayBuffer(); setCached(key, audioBuffer);
    return new NextResponse(audioBuffer, { status: 200, headers: { "Content-Type": "audio/mpeg", "Content-Length": String(audioBuffer.byteLength), "Cache-Control": "private, max-age=3600", "X-Athena-TTS-Cache": "MISS" } });
  } catch (error) { console.error("[Athena Speak] Error:", error); return NextResponse.json({ error: "Failed to generate speech" }, { status: 500 }); }
}
