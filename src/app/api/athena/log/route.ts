/**
 * POST /api/athena/log
 *
 * Client-side capture endpoint for streaming SSE responses. The /api/athena/chat
 * route cannot reliably capture the full streamed assistant text without
 * buffering the entire stream (which kills the streaming benefit). Instead,
 * the client assembles the streamed chunks into a full message and POSTs it
 * here after the stream completes.
 *
 * The chat route already logs "[streaming response — see client-side capture]"
 * as a placeholder. This endpoint REPLACES that placeholder with the real
 * assistant text, so the 36-hour summarizer cron has accurate content to work
 * with when extracting memories.
 *
 * Auth: Clerk auth required. The sessionId in the body must belong to the
 * authenticated user (verified via the athena_sessions.userId relation).
 *
 * Request body:
 *   { "sessionId": "...", "content": "...", "model": "...", "tokensOut": N }
 *
 * Returns:
 *   200 OK + { updated: true }         — message updated successfully
 *   200 OK + { updated: false, ... }   — no matching placeholder found
 *   400 — invalid input
 *   401 — not authenticated
 *   403 — sessionId belongs to a different user
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 10;

export async function POST(request: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Resolve internal user ID
  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // ── Parse body ────────────────────────────────────────────────────────
  let body: { sessionId?: unknown; content?: unknown; model?: unknown; tokensOut?: unknown };
  try {
    body = await request.json() as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
  const content = typeof body.content === "string" ? body.content : "";
  const model = typeof body.model === "string" ? body.model : null;
  const tokensOut = typeof body.tokensOut === "number" ? body.tokensOut : null;

  if (!sessionId || !content) {
    return NextResponse.json(
      { error: "sessionId and content are required" },
      { status: 400 },
    );
  }

  // Cap content length — defensive against abuse
  const truncatedContent = content.slice(0, 50_000);

  // ── Verify session ownership ───────────────────────────────────────────
  // The sessionId must belong to the authenticated user — otherwise any
  // logged-in user could overwrite any other user's assistant messages.
  const session = await prisma.athenaSession.findUnique({
    where: { id: sessionId },
    select: { id: true, userId: true },
  });
  if (!session || session.userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ── Find the most recent placeholder assistant message in this session ─────
  // The chat route logs "[streaming response — see client-side capture]" as
  // the assistant message content for streaming responses. Find that row and
  // replace it with the real content.
  const placeholder = await prisma.athenaMessage.findFirst({
    where: {
      sessionId,
      role: "assistant",
      content: "[streaming response — see client-side capture]",
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  if (!placeholder) {
    // No placeholder found — either:
    // 1. The chat route already logged the real content (non-streaming mode)
    // 2. The placeholder was already replaced by a prior /api/athena/log call
    // 3. The session has no assistant messages yet
    // In any case, INSERT a new assistant message rather than failing —
    // the client took the trouble to capture the stream, we should persist it.
    try {
      await prisma.athenaMessage.create({
        data: {
          sessionId,
          role: "assistant",
          content: truncatedContent,
          model,
          tokensOut,
        },
      });
      // Bump session stats
      await prisma.athenaSession.update({
        where: { id: sessionId },
        data: {
          lastMessageAt: new Date(),
          messageCount: { increment: 1 },
          tokensUsed: { increment: tokensOut ?? 0 },
          modelUsed: model ?? undefined,
        },
      });
      return NextResponse.json({ updated: true, mode: "inserted", sessionId });
    } catch (err) {
      console.error("[athena/log] insert failed:", err);
      return NextResponse.json({ error: "Failed to log message" }, { status: 500 });
    }
  }

  // ── Replace the placeholder with the real content ──────────────────────
  try {
    await prisma.athenaMessage.update({
      where: { id: placeholder.id },
      data: {
        content: truncatedContent,
        model,
        tokensOut,
      },
    });
    // Bump session stats
    await prisma.athenaSession.update({
      where: { id: sessionId },
      data: {
        lastMessageAt: new Date(),
        tokensUsed: { increment: tokensOut ?? 0 },
        modelUsed: model ?? undefined,
      },
    });
    return NextResponse.json({ updated: true, mode: "replaced", sessionId });
  } catch (err) {
    console.error("[athena/log] update failed:", err);
    return NextResponse.json({ error: "Failed to update message" }, { status: 500 });
  }
}
