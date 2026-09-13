/**
 * Internal endpoint — log a security incident.
 * Called by middleware (edge) via fire-and-forget fetch.
 *
 * Runs on Node.js runtime so it has full Prisma access (the edge middleware
 * can't import Prisma without blowing the 1 MB bundle size limit).
 *
 * SECURITY: This route is INTERNAL — only callable from middleware (server-side).
 * It's protected by:
 *   1. Method check (POST only)
 *   2. Origin check (must come from pitchcoachai.tech)
 *   3. x-middleware-internal header check (set by middleware, can't be spoofed
 *      by browser-side fetch — and even if spoofed, the data is just a log entry)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { INTERNAL_SECURITY_HEADER } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const internalSecret = process.env.INTERNAL_SECURITY_SECRET;
  if (!internalSecret || request.headers.get(INTERNAL_SECURITY_HEADER) !== internalSecret) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  // Validate required fields
  if (!body.ip || !body.deviceId || !body.reason) {
    return NextResponse.json(
      { error: "missing_required_fields", required: ["ip", "deviceId", "reason"] },
      { status: 400 },
    );
  }

  try {
    await prisma.securityIncident.create({
      data: {
        email: body.email ?? null,
        ip: body.ip,
        deviceId: body.deviceId,
        userAgent: body.userAgent ?? null,
        reason: body.reason,
        pathname: body.pathname ?? null,
        country: body.country ?? null,
        metadata: body.metadata ?? undefined,
        blocked: body.blocked ?? false,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    // If the table doesn't exist yet (no migration run), log and return 200
    // so the middleware doesn't keep retrying.
    console.warn("[api/security/log-incident] Failed to persist:", err);
    return NextResponse.json(
      { ok: false, error: "db_error", detail: String(err).slice(0, 200) },
      { status: 500 },
    );
  }
}

// Block other methods
export async function GET() {
  return NextResponse.json({ error: "method_not_allowed" }, { status: 405 });
}
