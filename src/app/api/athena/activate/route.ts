/**
 * GET /api/athena/activate
 *
 * AI Service Layer Activation Endpoint.
 *
 * Called by the Athena widget on mount (closed state). Checks if the AI
 * model powering Athena is activated for the current user.
 *
 * Returns: { activated: boolean, status: 'standby'|'activating'|'active'|'stale', sessionId, provider }
 *
 * Flow:
 * 1. User lands on homepage → widget renders (closed), calls GET /activate
 *    → Returns { activated: false, status: 'standby' } — AI model nested, awaiting auth
 * 2. User clicks Sign In → Clerk webhook fires → trigger sent to AI model
 *    → Returns { activated: true, status: 'activating' } — trigger received, auth in progress
 * 3. Dashboard loads → /api/user/sync fires → completes activation
 *    → Returns { activated: true, status: 'active' } — fully ready
 * 4. If primary trigger fails → dashboard fetch acts as fallback
 *    → Sends another trigger + auth header → widget activates
 *
 * 98% success target: both GET (read state) and POST (fire trigger) are
 * idempotent and retryable. The widget polls GET every 2s until 'active'.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 10;

// ── GET: Check activation state ─────────────────────────────────────────
export async function GET(_request: NextRequest) {
  const { userId: clerkId } = await auth();

  // Not authenticated — widget is in standby mode (AI model nested, awaiting trigger)
  if (!clerkId) {
    return NextResponse.json({
      activated: false,
      status: "standby",
      message: "AI model nested on frontend. Awaiting auth trigger.",
    });
  }

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.json({
      activated: false,
      status: "standby",
      message: "User record not found. Awaiting sync.",
    });
  }

  try {
    const result = await prisma.$queryRaw`
      SELECT status, "warmedAt", "isStale", "mcpSessionId", "pokeWarmed"
      FROM public.check_athena_warmth(${user.id})
    ` as any[];

    const row = result[0];
    const isStale = row?.isstale ?? true;
    const status = row?.status || "cold";

    // Map DB status to activation status
    const activated = status === "warm" && !isStale;
    const activationStatus = isStale ? "stale" : status === "warm" ? "active" : status === "warming" ? "activating" : "standby";

    return NextResponse.json({
      activated,
      status: activationStatus,
      sessionId: row?.mcpsessionid || null,
      provider: row?.pokewarmed ? "poke" : "cloudflare",
      warmedAt: row?.warmedat || null,
    });
  } catch (error) {
    console.error("[Athena Activate] Error:", error);
    return NextResponse.json({
      activated: false,
      status: "standby",
      message: "Activation state unavailable. Widget will use fallback responses.",
    });
  }
}

// ── POST: Fire activation trigger (from dashboard or webhook) ───────────
export async function POST(request: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    // Allow trigger from internal calls (webhook, dashboard sync) via secret
    const authHeader = request.headers.get("authorization") || "";
    const secret = process.env.ATHENA_SECRET_KEY || "";
    if (!secret || authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ activated: false, status: "standby", message: "No user session." });
  }

  const body = await request.json().catch(() => ({})) as { fallback?: boolean };
  const isFallback = body.fallback === true;

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true, email: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Mark as 'activating' in DB
  await prisma.$executeRaw`
    INSERT INTO public.ai_service_health ("userId", "clerkId", status, "warmedAt", "lastPingAt")
    VALUES (${user.id}, ${clerkId}, 'warming', now(), now())
    ON CONFLICT ("userId") DO UPDATE
    SET status = 'warming', "warmedAt" = now(), "lastPingAt" = now(), "updatedAt" = now()
  `;

  const tasks: Promise<void>[] = [];
  let mcpSession: string | null = null;
  let pokeWarmed = false;

  // 1. Preload endpoint (authenticates AI service layer)
  tasks.push(
    fetch(`${process.env.NEXT_PUBLIC_APP_URL || "https://pitchcoachai.tech"}/api/athena/preload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.ATHENA_SECRET_KEY || ""}` },
    }).then(() => {}).catch(() => {}),
  );

  // 2. Poke API (primary trigger to AI model)
  const POKE_KEY = process.env.POKE_API_KEY;
  if (POKE_KEY && user.email) {
    tasks.push(
      fetch("https://poke.com/api/v1/inbound/api-message", {
        method: "POST",
        headers: { Authorization: `Bearer ${POKE_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `System: ${isFallback ? "Fallback" : "Primary"} trigger for ${user.email}. Dashboard authenticated. Activate AI model. Context: PitchCoach Ai user. Use db_query for their data.`,
        }),
      }).then(() => { pokeWarmed = true; }).catch(() => {}),
    );
  }

  // 3. MCP DurableObject (initialize + capture session)
  tasks.push(
    fetch("https://athena-mcp-server.morphylee22.workers.dev/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "initialize", params: { protocolVersion: "2025-01-01", capabilities: {}, clientInfo: { name: "activate", version: "1.0" } }, id: 1 }),
    }).then(async (res) => {
      mcpSession = res.headers.get("mcp-session-id");
    }).catch(() => {}),
  );

  await Promise.race([
    Promise.allSettled(tasks),
    new Promise(resolve => setTimeout(resolve, 5000)),
  ]);

  // Mark as active
  try {
    await prisma.$executeRaw`SELECT public.mark_athena_warm(${user.id}, ${mcpSession}, ${pokeWarmed})`;
  } catch {}

  return NextResponse.json({
    activated: true,
    status: "active",
    sessionId: mcpSession,
    provider: pokeWarmed ? "poke" : "cloudflare",
    source: isFallback ? "dashboard-fallback" : "primary",
  });
}
