import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { askAthenaWithTools } from "@/lib/athena-agent";
import { prisma } from "@/lib/db";
import { checkAthenaQuota, reserveAnonSlot, releaseAnonSlot, ATHENA_QUOTA } from "@/lib/athena-quota";
import { getClientIp, getDeviceFingerprint } from "@/lib/security";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;
const MAX_HISTORY = 50;
const MAX_HISTORY_CONTENT = 10000;
const MAX_IMAGE_LENGTH = 5_000_000;
const historyItemSchema = z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(MAX_HISTORY_CONTENT) }).strict();
const historySchema = z.array(historyItemSchema).max(MAX_HISTORY);
const imageSchema = z.string().max(MAX_IMAGE_LENGTH).refine((value) => /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(value), "Invalid image payload");
function quotaHeaders(result: { tier: "anon" | "auth"; remaining: number; resetAt: number; retryAfter?: number; requiresSignIn?: boolean }) { return { "X-Athena-Tier": result.tier, "X-Athena-Remaining": String(result.remaining), "X-Athena-Reset": String(result.resetAt), ...(result.requiresSignIn ? { "X-Athena-Requires-Sign-In": "1" } : {}), ...(result.retryAfter ? { "Retry-After": String(result.retryAfter) } : {}) }; }
export async function POST(request: NextRequest) {
  let isAnon = false;
  try {
    const { userId } = await auth();
    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
    const parsed = z.object({ message: z.string().min(1).max(2000), history: historySchema.optional().default([]), context: z.unknown().optional(), sessionId: z.string().max(128).optional(), image: imageSchema.optional() }).strict().safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten().fieldErrors }, { status: 400 });
    const { message, history, context, sessionId, image } = parsed.data;
    const tier: "anon" | "auth" = userId ? "auth" : "anon";
    isAnon = tier === "anon";
    const identifier = userId ? userId : `${getClientIp(request)}:${await getDeviceFingerprint(request)}`;
    const quota = checkAthenaQuota(tier, identifier);
    if (!quota.allowed) { const status = quota.requiresSignIn ? 402 : 429; return NextResponse.json({ error: quota.concurrencyBlocked ? "athena_busy" : "athena_quota_exceeded", message: quota.concurrencyBlocked ? "Athena is helping other visitors right now. Please try again in a moment." : quota.requiresSignIn ? "You've reached Athena's free visitor limit. Sign in to keep chatting — it's free." : "You've reached Athena's chat limit for now. Please try again later.", retryAfter: quota.retryAfter, remaining: 0, resetAt: quota.resetAt, tier: quota.tier, requiresSignIn: quota.requiresSignIn }, { status, headers: quotaHeaders(quota) }); }
    if (isAnon) reserveAnonSlot();
    let internalUserId: string | undefined;
    if (userId) internalUserId = (await prisma.user.findUnique({ where: { clerkId: userId }, select: { id: true } }))?.id;
    const typedContext = (context as { firstName?: string; currentModule?: string; currentPage?: string; plan?: string } | null) || {};
    const ctx = userId ? { userId, internalUserId, sessionId, firstName: typedContext.firstName, currentModule: typedContext.currentModule, currentPage: typedContext.currentPage, plan: typedContext.plan } : undefined;
    const response = await askAthenaWithTools(message, ctx, history, image, { userId: internalUserId || userId || undefined, sessionId, context: ctx });
    return NextResponse.json({ response, timestamp: new Date().toISOString(), tier, remaining: quota.remaining, resetAt: quota.resetAt, nudgeSignIn: tier === "anon" && quota.remaining <= ATHENA_QUOTA.ANON.limit - 2 }, { status: 200, headers: quotaHeaders({ tier, remaining: quota.remaining, resetAt: quota.resetAt }) });
  } catch (error) { console.error("[Athena Chat] Error:", error); return NextResponse.json({ error: "Failed to get response from Athena" }, { status: 500 }); } finally { if (isAnon) releaseAnonSlot(); }
}
