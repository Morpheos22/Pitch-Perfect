import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const VOICE_ENDPOINT = process.env.ATHENA_ENGINE_URL?.replace("/v1/athena", "") + "/v1/athena/voice"
  || "https://athena-d1.morphylee22.workers.dev/v1/athena/voice";

export async function POST(request: NextRequest) {
  const body = await request.text();
  if (!body) return NextResponse.json({ error: "Request body is required" }, { status: 400 });
  let parsed: unknown;
  try { parsed = JSON.parse(body); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const input = parsed as { text?: unknown; session_id?: unknown };
  if (typeof input.text !== "string" || !input.text.trim()) return NextResponse.json({ error: "text is required" }, { status: 400 });

  // Identify the founder for session continuity
  let sessionId = typeof input.session_id === "string" ? input.session_id : undefined;
  if (!sessionId) {
    try { const { userId } = await auth(); if (userId) sessionId = `voice-${userId}`; } catch { /* anonymous */ }
  }

  let upstream: Response;
  try {
    upstream = await fetch(VOICE_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "audio/mpeg" },
      body: JSON.stringify({ text: input.text, session_id: sessionId }),
      cache: "no-store",
    });
  } catch (error) {
    return NextResponse.json({ error: "Athena voice engine is unreachable", detail: error instanceof Error ? error.message : String(error) }, { status: 502 });
  }

  // If upstream returned JSON (error case), forward it as JSON
  const contentType = upstream.headers.get("content-type") || "";
  if (contentType.includes("application/json") || !upstream.ok) {
    const errBody = await upstream.text();
    return NextResponse.json(
      { error: `Voice engine ${upstream.status}`, detail: errBody.slice(0, 500) },
      { status: upstream.status }
    );
  }

  // Pass through the audio stream
  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "content-type": "audio/mpeg",
      "cache-control": "no-cache, no-transform",
      "content-disposition": "inline",
    },
  });
}
