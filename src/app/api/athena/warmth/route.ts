/**
 * GET /api/athena/warmth
 *
 * Checks if Athena's AI service is warm for the authenticated user.
 * Returns: { status: 'cold' | 'warming' | 'warm' | 'stale', warmedAt, isStale }
 *
 * The dashboard calls this on load to decide whether to show a "warming up"
 * indicator or to fire the warm-up ping.
 *
 * The DB trigger on users.lastActiveAt already fires fire_athena_warmup()
 * which sets status='warming'. This endpoint just reads the state.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 5;

export async function GET(_request: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  try {
    // Call the DB function to check warmth
    const result = await prisma.$queryRaw`
      SELECT status, "warmedAt", "isStale"
      FROM public.check_athena_warmth(${user.id})
    ` as any[];

    const row = result[0];
    return NextResponse.json({
      status: row?.status || "cold",
      warmedAt: row?.warmedat || null,
      isStale: row?.isstale || true,
    });
  } catch (error) {
    console.error("[Athena Warmth] Error:", error);
    // Fail open — don't block the dashboard
    return NextResponse.json({ status: "cold", warmedAt: null, isStale: true });
  }
}
