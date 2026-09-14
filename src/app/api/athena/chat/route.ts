/**
 * POST /api/athena/chat
 * Chat endpoint for Athena AI guide.
 *
 * Tiered access:
 *   - Signed-in users: full quota (40 msg / 6h per user), never throttled by
 *     the anon concurrency cap.
 *   - Anonymous users: strict quota (5 msg / 6h per IP+device). When the cap
 *     is hit, returns 402 with `requiresSignIn: true` so the widget can
 *     surface a sign-in CTA instead of an error.
 *
 * The route runs on the Node.js runtime (athena-agent imports cloudflare-ai
 * which uses fetch — fine on Node, not on Edge).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { askAthena, AthenaMessage } from "@/lib/athena-agent";
import {
  checkAthenaQuota,
  reserveAnonSlot,
  releaseAnonSlot,
  ATHENA_QUOTA,
} from "@/lib/athena-quota";
import { getClientIp, getDeviceFingerprint } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

function quotaHeaders(result: {
  tier: "anon" | "auth";
  remaining: number;
  resetAt: number;
  retryAfter?: number;
  requiresSignIn?: boolean;
}) {
  return {
    "X-Athena-Tier": result.tier,
    "X-Athena-Remaining": String(result.remaining),
    "X-Athena-Reset": String(result.resetAt),
    ...(result.requiresSignIn ? { "X-Athena-Requires-SignIn": "1" } : {}),
    ...(result.retryAfter ? { "Retry-After": String(result.retryAfter) } : {}),
  };
}

export async function POST(request: NextRequest) {
  const authResult = await auth();
  const userId = authResult.userId;

  // ── Parse + validate body ───────────────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { message, history, context } = (body ?? {}) as {
    message?: unknown;
    history?: unknown;
    context?: unknown;
  };

  if (!message || typeof message !== "string") {
    return NextResponse.json({ error: "Message required" }, { status: 400 });
  }
  if (message.length > 2000) {
    return NextResponse.json(
      { error: "Message too long (max 2000 chars)" },
      { status: 400 },
    );
  }

  // ── Quota check ─────────────────────────────────────────────────────────
  // Signed-in users are keyed by userId. Anonymous users are keyed by
  // ip:deviceId so the same household on a shared IP still gets 5 messages
  // per device, not 5 per household.
  let tier: "anon" | "auth";
  let identifier: string;

  if (userId) {
    tier = "auth";
    identifier = userId;
  } else {
    tier = "anon";
    const ip = getClientIp(request);
    const deviceId = await getDeviceFingerprint(request);
    identifier = `${ip}:${deviceId}`;
  }

  const quota = checkAthenaQuota(tier, identifier);

  if (!quota.allowed) {
    // 402 Payment Required is the conventional "you've hit the free tier"
    // status code — distinguishes it from generic 429 rate-limit so the
    // widget can render a specific sign-in CTA instead of "try again later".
    const status = quota.requiresSignIn ? 402 : 429;
    return NextResponse.json(
      {
        error: quota.concurrencyBlocked
          ? "athena_busy"
          : "athena_quota_exceeded",
        message: quota.concurrencyBlocked
          ? "Athena is helping other visitors right now. Please try again in a moment."
          : quota.requiresSignIn
            ? "You've reached Athena's free visitor limit. Sign in to keep chatting — it's free."
            : "You've reached Athena's chat limit for now. Please try again later.",
        retryAfter: quota.retryAfter,
        remaining: 0,
        resetAt: quota.resetAt,
        tier: quota.tier,
        requiresSignIn: quota.requiresSignIn,
      },
      {
        status,
        headers: quotaHeaders(quota),
      },
    );
  }

  // ── Reserve anon slot for concurrency cap (auth users bypass) ──────────
  const isAnon = tier === "anon";
  if (isAnon) reserveAnonSlot();

  try {
    const response = await askAthena(
      message,
      // Pass userId/plan context only for signed-in users — never trust
      // client-supplied context for an anonymous request.
      userId
        ? {
            userId,
            firstName: (context as { firstName?: string } | null)?.firstName,
            currentModule: (context as { currentModule?: string } | null)?.currentModule,
            currentPage: (context as { currentPage?: string } | null)?.currentPage,
            plan: (context as { plan?: string } | null)?.plan,
          }
        : undefined,
      (history as AthenaMessage[]) ?? [],
    );

    return NextResponse.json(
      {
        response,
        timestamp: new Date().toISOString(),
        tier,
        remaining: quota.remaining,
        resetAt: quota.resetAt,
        // For anon users close to the cap, surface a soft nudge.
        nudgeSignIn:
          tier === "anon" &&
          quota.remaining <= ATHENA_QUOTA.ANON.limit - 2,
      },
      {
        status: 200,
        headers: quotaHeaders({
          tier,
          remaining: quota.remaining,
          resetAt: quota.resetAt,
        }),
      },
    );
  } catch (error) {
    console.error("[Athena Chat] Error:", error);
    return NextResponse.json(
      { error: "Failed to get response from Athena" },
      { status: 500 },
    );
  } finally {
    if (isAnon) releaseAnonSlot();
  }
}
