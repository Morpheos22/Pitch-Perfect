import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ENGINE_URL = process.env.ATHENA_ENGINE_URL || "https://athena-d1.morphylee22.workers.dev/v1/athena";

export async function POST(request: NextRequest) {
  const body = await request.text();
  if (!body) return NextResponse.json({ error: "Request body is required" }, { status: 400 });
  let parsed: unknown;
  try { parsed = JSON.parse(body); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const input = parsed as { message?: unknown };
  if (typeof input.message !== "string" || !input.message.trim()) return NextResponse.json({ error: "Message required" }, { status: 400 });

  let upstream: Response;
  try {
    upstream = await fetch(ENGINE_URL, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json", ...(request.headers.get("authorization") ? { authorization: request.headers.get("authorization")! } : {}) },
      body,
      cache: "no-store",
    });
  } catch (error) {
    return NextResponse.json({ error: "Athena engine is unreachable", detail: error instanceof Error ? error.message : String(error) }, { status: 502 });
  }

  const responseBody = await upstream.text();
  return new NextResponse(responseBody, { status: upstream.status, headers: { "content-type": upstream.headers.get("content-type") || "application/json", "cache-control": "no-store" } });
}
