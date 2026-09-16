import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function preload(request: Request) {
  const { userId } = await auth();
  const secret = process.env.ATHENA_SECRET_KEY;
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!userId && (!secret || bearer !== secret)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  // Keep this endpoint non-blocking: the authenticated request primes the route
  // and exposes a stable hook for the Athena/Poke worker warm-up bridge.
  return NextResponse.json({
    status: "primed",
    knowledge: true,
    voice: true,
    salutation: "Welcome back â Athena is ready to help sharpen your pitch.",
  }, { status: 200, headers: { "Cache-Control": "no-store" } });
}

export const GET = preload;
export const POST = preload;
