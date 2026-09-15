/**
 * POST /api/athena/speak
 *
 * Converts text to speech using ElevenLabs TTS.
 * Returns an audio/mpeg response.
 *
 * SECURITY: API key read from process.env — NEVER hardcoded.
 *
 * Voice: "Greek goddess" — uses a mature, authoritative female voice.
 * Voice ID is configurable via ELEVENLABS_VOICE_ID env var.
 * Default: Rachel (21m00Tcm4TlvDq8ikWAM) — calm, articulate, wise.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Default voice: Rachel — calm, articulate, mature female voice
// Override with ELEVENLABS_VOICE_ID env var to change
const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
  if (!ELEVENLABS_API_KEY) {
    return NextResponse.json(
      { error: "ElevenLabs not configured — ELEVENLABS_API_KEY missing" },
      { status: 503 },
    );
  }

  let body: { text?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const text = body.text;
  if (!text || typeof text !== "string") {
    return NextResponse.json({ error: "Text required" }, { status: 400 });
  }

  if (text.length > 5000) {
    return NextResponse.json(
      { error: "Text too long (max 5000 chars)" },
      { status: 400 },
    );
  }

  const voiceId = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;

  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
          "Accept": "audio/mpeg",
        },
        body: JSON.stringify({
          text: text.slice(0, 5000),
          model_id: "eleven_turbo_v2_5",
          voice_settings: {
            stability: 0.55,
            similarity_boost: 0.75,
            style: 0.2,
            use_speaker_boost: true,
          },
        }),
      },
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error("[Athena Speak] ElevenLabs error:", res.status, errText.slice(0, 200));
      return NextResponse.json(
        { error: `TTS failed: ${res.status}` },
        { status: 502 },
      );
    }

    // Return the audio as a streaming response
    const audioBuffer = await res.arrayBuffer();
    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(audioBuffer.byteLength),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    console.error("[Athena Speak] Error:", err);
    return NextResponse.json(
      { error: "Failed to generate speech" },
      { status: 500 },
    );
  }
}
