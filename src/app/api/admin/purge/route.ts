/**
 * POST /api/admin/purge
 *
 * Triggers an R2 prefix purge for objects older than `older_than_days`.
 * Called by the athena-memory-cron worker hourly (per the 6-day data
 * retention automation spec).
 *
 * Auth: requires ATHENA_SECRET_KEY header (set on Vercel env + Worker secret).
 * This is an internal-only endpoint — never accept requests without the secret.
 *
 * Request body:
 *   { "prefix": "uploads/temp/", "older_than_days": 6 }
 *
 * Response:
 *   { "prefix": "...", "scanned": N, "deleted": M, "errors": [...] }
 */

import { NextRequest, NextResponse } from "next/server";
import { purgeR2ByAge } from "@/lib/cloudflare-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // R2 list+delete can take time for large buckets

export async function POST(request: NextRequest) {
  // Auth: require ATHENA_SECRET_KEY header
  const secret = request.headers.get("x-athena-secret");
  const expectedSecret = process.env.ATHENA_SECRET_KEY || "";
  if (!expectedSecret || secret !== expectedSecret) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: { prefix?: unknown; older_than_days?: unknown };
  try {
    body = await request.json() as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const prefix = typeof body.prefix === "string" ? body.prefix : "uploads/temp/";
  const olderThanDays = typeof body.older_than_days === "number" && body.older_than_days > 0
    ? body.older_than_days
    : 6;

  // Whitelist allowed prefixes — prevent abuse where an attacker with the
  // secret could purge arbitrary R2 paths. Only temp uploads can be purged
  // via this endpoint. Production data (uploads/, decks/, etc.) must be
  // purged manually via SQL or a separate admin tool.
  const ALLOWED_PREFIXES = [
    "uploads/temp/",
    "tmp/",
    "scratch/",
  ];
  if (!ALLOWED_PREFIXES.some(p => prefix.startsWith(p))) {
    return NextResponse.json({
      error: "Prefix not allowed",
      allowed: ALLOWED_PREFIXES,
    }, { status: 400 });
  }

  try {
    const result = await purgeR2ByAge(prefix, olderThanDays);
    console.log(`[admin/purge] prefix=${prefix} older_than_days=${olderThanDays} scanned=${result.scanned} deleted=${result.deleted} errors=${result.errors.length}`);
    return NextResponse.json({
      prefix,
      ...result,
    });
  } catch (err) {
    console.error("[admin/purge] failed:", err);
    return NextResponse.json({
      error: "Purge failed",
      detail: err instanceof Error ? err.message : String(err),
    }, { status: 500 });
  }
}

/**
 * GET /api/admin/purge — status + recent runs from audit log.
 *
 * Returns:
 *   - lastRun: the most recent purge audit log row (or null if never run)
 *   - r2Configured: whether R2 credentials are set on the env
 *   - retentionDays: the configured retention window (6 days per spec)
 *   - cronSchedule: the cron trigger pattern (hourly)
 *   - allowedPrefixes: the whitelist of purgable R2 prefixes
 *   - recentRuns: the last 20 purge audit log rows
 */
export async function GET(request: NextRequest) {
  const secret = request.headers.get("x-athena-secret");
  const expectedSecret = process.env.ATHENA_SECRET_KEY || "";
  if (!expectedSecret || secret !== expectedSecret) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Lazy import to avoid circular deps in module init
  const { prisma } = await import("@/lib/db");
  const { isR2Configured } = await import("@/lib/cloudflare-storage");

  let lastRun: Awaited<ReturnType<typeof prisma.purgeAuditLog.findFirst>> = null;
  let recentRuns: Awaited<ReturnType<typeof prisma.purgeAuditLog.findMany>> = [];
  let dbError: string | undefined;

  try {
    [lastRun, recentRuns] = await Promise.all([
      prisma.purgeAuditLog.findFirst({
        orderBy: { runAt: "desc" },
      }),
      prisma.purgeAuditLog.findMany({
        orderBy: { runAt: "desc" },
        take: 20,
      }),
    ]);
  } catch (err) {
    // DB may be unreachable — return what we can without DB
    dbError = err instanceof Error ? err.message : String(err);
  }

  return NextResponse.json({
    status: lastRun ? "ok" : "never_run",
    lastRun,
    recentRuns,
    r2Configured: isR2Configured(),
    retentionDays: 6,
    cronSchedule: "0 * * * * (hourly)",
    allowedPrefixes: ["uploads/temp/", "tmp/", "scratch/"],
    dbError,
  });
}
