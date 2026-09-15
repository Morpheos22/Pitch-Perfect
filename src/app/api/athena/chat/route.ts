import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { askAthenaWithTools, AthenaMessage } from "@/lib/athena-agent";
import { prisma } from "@/lib/db";
import { checkAthenaQuota, reserveAnonSlot, releaseAnonSlot, ATHENA_QUOTA } from "@/lib/athena-quota";
import { getClientIp, getDeviceFingerprint } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

function quotaHeaders(result: { tier: "anon" | "auth"; remaining: number; resetAt: number; retryAfter?: number; requiresSignIn?: boolean }) {
  return { "X-Athena-Tier": result.tier, "X-Athena-Remaining": String(result.remaining), "X-Athena-Reset": String(result.resetAt), ...(result.requiresSignIn ? { "X-Athena-Requires-Sign-In": "1" } : {}), ...(result.retryAfter ? { "Retry-After": String(result.retryAfter) } : {}) };
}

export async function POST(request: NextRequest) {
  const authResult = await auth();
  const userId = authResult.userId;
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const { message, history, context } = (body ?? {}) as { message?: unknown; history?: unknown; context?: unknown };
  if (!message || typeof message !== "string") return NextResponse.json({ error: "Message required" }, { status: 400 });
  if (message.length > 2000) return NextResponse.json({ error: "Message too long (max 2000 chars)" }, { status: 400 });

  const tier: "anon" | "auth" = userId ? "auth" : "anon";
  const identifier = userId ? userId : `${getClientIp(request)}:${await getDeviceFingerprint(request)}`;
  const quota = checkAthenaQuota(tier, identifier);
  if (!quota.allowed) {
    const status = quota.requiresSignIn ? 402 : 429;
    return NextResponse.json({ error: quota.concurrencyBlocked ? "athena_busy" : "athena_quota_exceeded", message: quota.concurrencyBlocked ? "Athena is helping other visitors right now. Please try again in a moment." : quota.requiresSignIn ? "You've reached Athena's free visitor limit. Sign in to keep chatting — it's free." : "You've reached Athena's chat limit for now. Please try again later.", retryAfter: quota.retryAfter, remaining: 0, resetAt: quota.resetAt, tier: quota.tier, requiresSignIn: quota.requiresSignIn }, { status, headers: quotaHeaders(quota) });
  }

  const isAnon = tier === "anon";
  if (isAnon) reserveAnonSlot();
  try {
    let internalUserId: string | undefined;
    if (userId) internalUserId = (await prisma.user.findUnique({ where: { clerkId: userId }, select: { id: true } }))?.id;
    const ctx = userId ? { userId, internalUserId, firstName: (context as { firstName?: string } | null)?.firstName, currentModule: (context as { currentModule?: string } | null)?.currentModule, currentPage: (context as { currentPage?: string } | null)?.currentPage, plan: (context as { plan?: string } | null)?.plan } : undefined;
    const response = await askAthenaWithTools(message, ctx, (history as AthenaMessage[]) ?? []);
    return NextResponse.json({ response, timestamp: new Date().toISOString(), tier, remaining: quota.remaining, resetAt: quota.resetAt, nudgeSignIn: tier === "anon" && quota.remaining <= ATHENA_QUOTA.ANON.limit - 2 }, { status: 200, headers: quotaHeaders({ tier, remaining: quota.remaining, resetAt: quota.resetAt }) });
  } catch (error) {
    console.error("[Athena Chat] Error:", error);
    return NextResponse.json({ error: "Failed to get response from Athena" }, { status: 500 });
  } finally { if (isAnon) releaseAnonSlot(); }
}
