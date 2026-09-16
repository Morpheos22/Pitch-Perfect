import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // accommodate deep-tier DeepSeek-R1 (50-70s)

const ENGINE_URL = process.env.ATHENA_ENGINE_URL || "https://athena-d1.morphylee22.workers.dev/v1/athena";

export async function POST(request: NextRequest) {
  const body = await request.text();
  if (!body) return NextResponse.json({ error: "Request body is required" }, { status: 400 });
  let parsed: unknown;
  try { parsed = JSON.parse(body); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const input = parsed as { message?: unknown; tier?: unknown; stream?: unknown; session_id?: unknown; turns?: unknown; user_name?: unknown };
  if (typeof input.message !== "string" || !input.message.trim()) return NextResponse.json({ error: "Message required" }, { status: 400 });

  // Identify the founder (Clerk userId + firstName) so Athena can address
  // them by name and fetch their deck from Supabase.
  let founderId: string | undefined;
  let founderName: string | undefined;
  try {
    const { userId, sessionClaims } = await auth();
    if (userId) {
      founderId = userId;
      // Pull firstName from Clerk JWT claims if available
      const meta = sessionClaims as any;
      founderName = meta?.firstName || meta?.u?.first_name || undefined;
    }
  } catch { /* anonymous visitor — allow through */ }
  // Allow client-side override (e.g., from onboarding form) but prefer server-side
  const userName = (typeof input.user_name === "string" ? input.user_name : undefined) || founderName;

  const upstreamPayload = {
    message: input.message,
    tier: typeof input.tier === "string" ? input.tier : undefined,
    stream: input.stream === true || input.stream === "true",
    session_id: typeof input.session_id === "string" ? input.session_id : undefined,
    turns: Array.isArray(input.turns) ? input.turns : undefined,
    founder_id: founderId,
    user_name: userName,
  };

  // SSE streaming: if the client wants streaming, pass through the worker's
  // event-stream directly without buffering. This is what makes DeepSeek-R1
  // feel responsive — tokens arrive as they're generated.
  if (upstreamPayload.stream) {
    let upstream: Response;
    try {
      upstream = await fetch(ENGINE_URL, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "text/event-stream" },
        body: JSON.stringify(upstreamPayload),
        cache: "no-store",
      });
    } catch (error) {
      return NextResponse.json({ error: "Athena engine is unreachable", detail: error instanceof Error ? error.message : String(error) }, { status: 502 });
    }
    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        "connection": "keep-alive",
        "x-athena-tier": upstream.headers.get("x-athena-tier") || "",
        "x-athena-model": upstream.headers.get("x-athena-model") || "",
        "x-athena-session": upstream.headers.get("x-athena-session") || "",
      },
    });
  }

  // Non-streaming path — wait for full verdict
  let upstream: Response;
  try {
    upstream = await fetch(ENGINE_URL, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(upstreamPayload),
      cache: "no-store",
    });
  } catch (error) {
    return NextResponse.json({ error: "Athena engine is unreachable", detail: error instanceof Error ? error.message : String(error) }, { status: 502 });
  }

  const responseBody = await upstream.text();
  return new NextResponse(responseBody, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") || "application/json",
      "cache-control": "no-store",
      "x-athena-tier": upstream.headers.get("x-athena-tier") || "",
      "x-athena-model": upstream.headers.get("x-athena-model") || "",
    },
  });
}
