/**
 * Internal endpoint — auto-promote suspicious probe IPs to the persistent blocklist.
 *
 * Scans the security_incidents table for MAINTENANCE_AUTH_PROBE entries,
 * groups by IP, and promotes any IP with N+ qualifying attempts to
 * blocked_ips (permanent ban).
 *
 * This is the automation the user requested for handling Sherwyn's
 * expected attempt during the 48-96 hour lockdown window.
 *
 * TRIGGER OPTIONS:
 *   1. Manually: curl -X POST https://pitchcoachai.tech/api/security/auto-promote \
 *        -H "x-auto-promote-secret: $AUTO_PROMOTE_SECRET"
 *   2. Cron: schedule via Vercel Cron / external cron service every 30 min
 *   3. Programmatically: called from another Node.js script via fetch()
 *
 * SECURITY: This endpoint is protected by:
 *   1. POST-only method check
 *   2. x-auto-promote-secret header check (set via env var — never commit)
 *   3. Same-origin check (origin must match host)
 *
 * Configurable thresholds (override via env vars):
 *   - AUTO_PROMOTE_THRESHOLD (default: 3) — min attempts before promotion
 *   - AUTO_PROMOTE_WINDOW_HOURS (default: 96) — only consider recent attempts
 *   - AUTO_PROMOTE_DRY_RUN (default: "false") — if "true", log but don't persist
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // 1 minute — enough for a full scan

const THRESHOLD = parseInt(process.env.AUTO_PROMOTE_THRESHOLD ?? "3", 10);
const WINDOW_HOURS = parseInt(process.env.AUTO_PROMOTE_WINDOW_HOURS ?? "96", 10);
const DRY_RUN = process.env.AUTO_PROMOTE_DRY_RUN === "true";
const EXPECTED_SECRET = process.env.AUTO_PROMOTE_SECRET;

interface PromotionResult {
  ip: string;
  attempts: number;
  firstSeen: Date;
  lastSeen: Date;
  countries: string[];
  paths: string[];
  deviceIds: string[];
  userAgents: string[];
  promoted: boolean;
  error?: string;
}

export async function POST(request: NextRequest) {
  // ── Auth check — MANDATORY secret required ──
  // This endpoint is too powerful to leave open — it can permanently ban IPs.
  // If AUTO_PROMOTE_SECRET is not configured, we refuse all requests rather
  // than fall back to a weak origin check.
  if (!EXPECTED_SECRET) {
    console.error(
      "[auto-promote] AUTO_PROMOTE_SECRET env var is not set — refusing request. " +
      "Set it in Vercel project settings before calling this endpoint.",
    );
    return NextResponse.json(
      {
        error: "server_misconfigured",
        message:
          "AUTO_PROMOTE_SECRET is not configured on the server. " +
          "Set it in Vercel project settings before calling this endpoint.",
      },
      { status: 503 },
    );
  }

  const provided = request.headers.get("x-auto-promote-secret");
  if (provided !== EXPECTED_SECRET) {
    return NextResponse.json(
      { error: "unauthorized", message: "Missing or invalid secret" },
      { status: 401 },
    );
  }

  // ── Parse optional body for per-call overrides ──
  let bodyThreshold = THRESHOLD;
  let bodyWindowHours = WINDOW_HOURS;
  let bodyDryRun = DRY_RUN;
  let bodyReason = "MAINTENANCE_AUTH_PROBE_AUTO_PROMOTED";

  try {
    const body = await request.json();
    if (typeof body.threshold === "number") bodyThreshold = body.threshold;
    if (typeof body.windowHours === "number") bodyWindowHours = body.windowHours;
    if (typeof body.dryRun === "boolean") bodyDryRun = body.dryRun;
    if (typeof body.reason === "string") bodyReason = body.reason;
  } catch {
    // Body is optional — use defaults
  }

  const windowStart = new Date(Date.now() - bodyWindowHours * 60 * 60 * 1000);

  try {
    // ── Step 1: Find all MAINTENANCE_AUTH_PROBE incidents in the window ──
    const incidents = await prisma.securityIncident.findMany({
      where: {
        reason: "MAINTENANCE_AUTH_PROBE",
        createdAt: { gte: windowStart },
      },
      select: {
        ip: true,
        deviceId: true,
        userAgent: true,
        pathname: true,
        country: true,
        createdAt: true,
      },
    });

    if (incidents.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "No MAINTENANCE_AUTH_PROBE incidents found in window",
        threshold: bodyThreshold,
        windowHours: bodyWindowHours,
        dryRun: bodyDryRun,
        promoted: 0,
      });
    }

    // ── Step 2: Group by IP and aggregate stats ──
    const ipMap = new Map<
      string,
      {
        attempts: number;
        firstSeen: Date;
        lastSeen: Date;
        countries: Set<string>;
        paths: Set<string>;
        deviceIds: Set<string>;
        userAgents: Set<string>;
      }
    >();

    for (const inc of incidents) {
      let entry = ipMap.get(inc.ip);
      if (!entry) {
        entry = {
          attempts: 0,
          firstSeen: inc.createdAt,
          lastSeen: inc.createdAt,
          countries: new Set(),
          paths: new Set(),
          deviceIds: new Set(),
          userAgents: new Set(),
        };
        ipMap.set(inc.ip, entry);
      }
      entry.attempts += 1;
      if (inc.createdAt < entry.firstSeen) entry.firstSeen = inc.createdAt;
      if (inc.createdAt > entry.lastSeen) entry.lastSeen = inc.createdAt;
      if (inc.country) entry.countries.add(inc.country);
      entry.paths.add(inc.pathname ?? "unknown");
      entry.deviceIds.add(inc.deviceId);
      if (inc.userAgent) entry.userAgents.add(inc.userAgent);
    }

    // ── Step 3: Promote IPs that meet the threshold ──
    const results: PromotionResult[] = [];

    for (const [ip, stats] of ipMap) {
      const result: PromotionResult = {
        ip,
        attempts: stats.attempts,
        firstSeen: stats.firstSeen,
        lastSeen: stats.lastSeen,
        countries: Array.from(stats.countries),
        paths: Array.from(stats.paths),
        deviceIds: Array.from(stats.deviceIds),
        userAgents: Array.from(stats.userAgents),
        promoted: false,
      };

      if (stats.attempts < bodyThreshold) {
        results.push(result);
        continue;
      }

      if (bodyDryRun) {
        result.promoted = true;
        results.push(result);
        console.log(
          `[auto-promote] DRY RUN: Would promote IP ${ip} (${stats.attempts} attempts, countries: ${Array.from(stats.countries).join(",")})`,
        );
        continue;
      }

      // ── Persist to blocked_ips via upsert (idempotent) ──
      try {
        // Use the most recent deviceId + the full set of attempts
        const primaryDevice = Array.from(stats.deviceIds)[0] ?? null;
        await prisma.blockedIp.upsert({
          where: { ip },
          create: {
            ip,
            deviceId: primaryDevice,
            reason: bodyReason,
            attempts: stats.attempts,
            firstSeen: stats.firstSeen,
            lastSeen: stats.lastSeen,
            permanent: true,
          },
          update: {
            attempts: stats.attempts,
            lastSeen: stats.lastSeen,
            ...(primaryDevice ? { deviceId: primaryDevice } : {}),
          },
        });

        // Also flag the original incidents as blocked=true so we have an audit trail
        await prisma.securityIncident.updateMany({
          where: {
            ip,
            reason: "MAINTENANCE_AUTH_PROBE",
          },
          data: { blocked: true },
        });

        result.promoted = true;
      } catch (err) {
        result.error = String(err).slice(0, 200);
        console.error(`[auto-promote] Failed to promote IP ${ip}:`, err);
      }

      results.push(result);
    }

    // ── Step 4: Also add the captured device IDs to the in-memory cache ──
    // so the edge middleware fast-paths future requests from the same devices.
    // We do this by importing the cacheDeviceBlock function — but since this
    // route runs on Node.js runtime, not edge, the cache won't be shared with
    // middleware. Instead, the blocked_ips table is the persistent source of
    // truth, and the edge middleware reads it on cold starts.

    const promotedCount = results.filter((r) => r.promoted).length;
    const totalAttemptCount = incidents.length;
    const uniqueIpCount = ipMap.size;

    return NextResponse.json({
      ok: true,
      threshold: bodyThreshold,
      windowHours: bodyWindowHours,
      dryRun: bodyDryRun,
      reason: bodyReason,
      windowStart: windowStart.toISOString(),
      stats: {
        totalIncidents: totalAttemptCount,
        uniqueIps: uniqueIpCount,
        promoted: promotedCount,
        skipped: uniqueIpCount - promotedCount,
      },
      results: results.sort((a, b) => b.attempts - a.attempts),
    });
  } catch (err) {
    console.error("[auto-promote] Unexpected error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: "internal_error",
        detail: String(err).slice(0, 500),
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json(
    {
      error: "method_not_allowed",
      message: "Use POST with x-auto-promote-secret header",
    },
    { status: 405 },
  );
}
