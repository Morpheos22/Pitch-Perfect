/**
 * GET /api/athena/quota
 *
 * Returns the caller's current Athena quota state without consuming a slot.
 * Used by the widget to render "X messages left" before the user types
 * anything, and to surface the sign-in CTA immediately if the cap is
 * already hit.
 *
 * Response shape:
 *   {
 *     tier: "anon" | "auth",
 *     limit: number,
 *     remaining: number,
 *     resetAt: number,   // unix seconds
 *     requiresSignIn: boolean
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { peekAthenaQuota, ATHENA_QUOTA } from "@/lib/athena-quota";
import { getClientIp, getDeviceFingerprint } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 5;

export async function GET(_request: NextRequest) {
  const { userId } = await auth();

  let tier: "anon" | "auth";
  let identifier: string;

  if (userId) {
    tier = "auth";
    identifier = userId;
  } else {
    tier = "anon";
    const ip = getClientIp(_request);
    const deviceId = await getDeviceFingerprint(_request);
    identifier = `${ip}:${deviceId}`;
  }

  const peek = peekAthenaQuota(tier, identifier);
  const cfg = tier === "anon" ? ATHENA_QUOTA.ANON : ATHENA_QUOTA.AUTH;

  return NextResponse.json({
    tier,
    limit: cfg.limit,
    remaining: peek.remaining,
    resetAt: peek.resetAt,
    requiresSignIn: tier === "anon" && peek.remaining === 0,
  });
}
