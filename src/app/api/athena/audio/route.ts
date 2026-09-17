import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ATHENA_BASE = process.env.ATHENA_ENGINE_URL?.replace("/v1/athena", "") || "https://athena-d1.morphylee22.workers.dev";
const AUDIO_ENDPOINT = ATHENA_BASE + "/v1/athena/audio";

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";

  // Identify the founder for session continuity
  let sessionId: string | undefined;
  try {
    const { userId } = await auth();
    if (userId) sessionId = `audio-${userId}`;
  } catch { /* anonymous */ }

  let upstream: Response;
  try {
    // Forward the request body as-is (multipart or JSON)
    const body = await request.arrayBuffer();
    upstream = await fetch(AUDIO_ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": contentType,
        "accept": "application/json",
      },
      body: body,
      cache: "no-store",
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Athena audio engine is unreachable", detail: error instanceof Error ? error.message : String(error) },
      { status: 502 }
    );
  }

  // If upstream returned an error, forward it
  if (!upstream.ok) {
    const errBody = await upstream.text();
    return NextResponse.json(
      { error: `Audio engine ${upstream.status}`, detail: errBody.slice(0, 500) },
      { status: upstream.status }
    );
  }

  // Forward the successful response
  const responseBody = await upstream.text();
  return new NextResponse(responseBody, {
    status: 200,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
}
