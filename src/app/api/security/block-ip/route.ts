/**
 * Internal endpoint — add an IP to the persistent blocklist.
 * Called by middleware (edge) via fire-and-forget fetch when an email-blocklist
 * hit is detected.
 *
 * Runs on Node.js runtime so it has full Prisma access.
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

  if (!body.ip || !body.reason) {
    return NextResponse.json(
      { error: "missing_required_fields", required: ["ip", "reason"] },
      { status: 400 },
    );
  }

  try {
    await prisma.blockedIp.upsert({
      where: { ip: body.ip },
      create: {
        ip: body.ip,
        deviceId: body.deviceId ?? null,
        email: body.email ?? null,
        reason: body.reason,
        attempts: 1,
      },
      update: {
        attempts: { increment: 1 },
        lastSeen: new Date(),
        ...(body.deviceId ? { deviceId: body.deviceId } : {}),
        ...(body.email ? { email: body.email } : {}),
      },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.warn("[api/security/block-ip] Failed to persist block:", err);
    return NextResponse.json(
      { ok: false, error: "db_error", detail: String(err).slice(0, 200) },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({ error: "method_not_allowed" }, { status: 405 });
}
