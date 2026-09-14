/**
 * POST /api/athena/chat
 * Chat endpoint for Athena AI guide.
 * Requires authentication.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { askAthena, AthenaMessage } from "@/lib/athena-agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { message, history, context } = body;

  if (!message || typeof message !== "string") {
    return NextResponse.json({ error: "Message required" }, { status: 400 });
  }

  if (message.length > 2000) {
    return NextResponse.json({ error: "Message too long (max 2000 chars)" }, { status: 400 });
  }

  try {
    const response = await askAthena(
      message,
      context,
      history as AthenaMessage[]
    );

    return NextResponse.json({
      response,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Athena Chat] Error:", error);
    return NextResponse.json(
      { error: "Failed to get response from Athena" },
      { status: 500 }
    );
  }
}
