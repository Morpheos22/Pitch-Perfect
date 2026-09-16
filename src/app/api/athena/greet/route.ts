/**
 * GET /api/athena/greet
 *
 * Generates a personalized spoken greeting from Athena and returns it as audio.
 * Called once when the dashboard loads (first visit per browser session).
 *
 * The greeting is dynamic — uses the user's name, plan, time of day, and
 * recent pitch deck scores to craft a unique salutation.
 *
 * Returns: audio/mpeg (ElevenLabs TTS)
 * Headers: X-Greeting-Text (the text that was spoken, for subtitles)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Burning the midnight oil";
}

export async function GET(_request: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
  if (!ELEVENLABS_API_KEY) {
    return NextResponse.json({ error: "Voice not configured" }, { status: 503 });
  }

  // Fetch user data for personalized greeting
  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: {
      id: true,
      firstName: true,
      subscription: { select: { plan: true } },
      usage: { select: { e1DeckAnalyses: true, e2ScriptCoachSessions: true } },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Fetch latest deck score
  const latestDeck = await prisma.pitchDeck.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { overallScore: true },
  }).catch(() => null);

  // Build personalized greeting
  const name = user.firstName || "there";
  const plan = user.subscription?.plan || "FREE";
  const isFounder = plan === "FOUNDER" || plan === "ENTERPRISE";

  let greeting = `${getTimeGreeting()}, ${name}. Athena here. Your pitch lab is ready. `;

  if (latestDeck?.overallScore != null) {
    const score = latestDeck.overallScore;
    const comment = score >= 81 ? "impressively" : score >= 61 ? "investor-ready" : score >= 41 ? "showing promise" : "with room to grow";
    greeting += `Your latest deck scored ${comment} at ${score} out of 100. `;
  }

  const totalSessions = (user.usage?.e1DeckAnalyses ?? 0) + (user.usage?.e2ScriptCoachSessions ?? 0);
  if (totalSessions === 0) {
    greeting += `Start by uploading your pitch deck — I'll analyze it across eight dimensions. `;
  } else if (totalSessions < 5) {
    greeting += `You've completed ${totalSessions} sessions. Keep the momentum going. `;
  } else {
    greeting += `You've completed ${totalSessions} sessions. Let's push for investor-ready scores. `;
  }

  if (isFounder) greeting += `As a Founder member, you have unlimited access to all modules. `;
  greeting += `I'm here whenever you need me. Just open the chat.`;

  // Generate speech
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
          text: greeting.slice(0, 5000),
          model_id: "eleven_turbo_v2_5",
          voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true },
        }),
      },
    );

    if (!res.ok) {
      return NextResponse.json({ error: `TTS failed: ${res.status}`, greeting }, { status: 502 });
    }

    const audioBuffer = await res.arrayBuffer();
    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(audioBuffer.byteLength),
        "Cache-Control": "private, max-age=3600",
        "X-Greeting-Text": encodeURIComponent(greeting),
      },
    });
  } catch (err) {
    console.error("[Athena Greet] Error:", err);
    return NextResponse.json({ error: "Failed to generate speech", greeting }, { status: 500 });
  }
}
