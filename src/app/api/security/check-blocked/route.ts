/**
 * Internal endpoint — check if an IP or device is blocked.
 *
 * Called by middleware (edge runtime) via fetch() to check the DB-backed
 * blocklist. The middleware can't query Prisma directly (edge bundle size
 * limit), so it delegates to this Node.js-runtime endpoint.
 *
 * Returns: { blocked: boolean, reason: string|null }
 *
 * SECURITY: This endpoint is internal-only:
 *   1. POST-only (GET returns 405)
 *   2. Requires INTERNAL_SECURITY_SECRET in a server-only header
 *
 * PERFORMANCE: The middleware should cache the result in-memory for 5 min
 * to avoid calling this endpoint on every request.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { INTERNAL_SECURITY_HEADER } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 10; // 10s — should be fast (indexed query)

export async function POST(request: NextRequest) {
  const internalSecret = process.env.INTERNAL_SECURITY_SECRET;
  if (!internalSecret || request.headers.get(INTERNAL_SECURITY_HEADER) !== internalSecret) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: { ip?: string; deviceId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body.ip && !body.deviceId) {
    return NextResponse.json(
      { error: "missing_required_fields", required: ["ip or deviceId"] },
      { status: 400 },
    );
  }

  try {
    // Build OR query — match on IP OR device
    const orConditions: Array<{ ip?: string; deviceId?: string }> = [];
    if (body.ip) orConditions.push({ ip: body.ip });
    if (body.deviceId) orConditions.push({ deviceId: body.deviceId });

    const record = await prisma.blockedIp.findFirst({
      where: {
        OR: orConditions,
        permanent: true,
      },
      select: { reason: true, ip: true },
      // No need to return more than one — we just need to know if blocked
    });

    if (record) {
      return NextResponse.json({
        blocked: true,
        reason: record.reason,
        ip: record.ip,
      });
    }

    return NextResponse.json({ blocked: false, reason: null });
  } catch (err) {
    // DB error — fail-OPEN (return not blocked) so the site doesn't lock
    // everyone out if the DB is unreachable. The next successful query
    // will catch the block.
    console.warn("[api/security/check-blocked] DB error:", err);
    return NextResponse.json(
      { blocked: false, reason: null, error: "db_error" },
      { status: 200 }, // 200 so middleware doesn't fail hard
    );
  }
}

export async function GET() {
  return NextResponse.json({ error: "method_not_allowed" }, { status: 405 });
}
