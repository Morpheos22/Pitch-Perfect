// src/app/api/cron/athena-memory-anchor/route.ts
// Daily anchor for Athena Layer 7 memory.
//
// Triggers:
//   - Vercel Cron at 0 3 * * * UTC (see vercel.json)
//   - Manual: curl -H "Authorization: Bearer $CRON_SECRET" \
//       "https://your-app.vercel.app/api/cron/athena-memory-anchor"
//
// Query params:
//   ?dryRun=1        Run the full compose path but skip the cache upsert.
//   ?userId=u1       Process a single user, bypassing the skip-fresh check.
//   ?limit=50        Cap the number of users processed in this run (max 200).

import { NextResponse } from 'next/server';
import { composeMemoryBundle } from '@/lib/athena-memory/compose-memory';
import {
  fetchActiveUserIds,
  fetchMemoryCache,
  upsertMemoryCache,
} from '@/lib/athena-memory/queries';
import type { DbClient } from '@/lib/athena-memory/types';
import { Pool } from 'pg';

// Next.js App Router runtime config
export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// === USER: wire this to your real Supabase / pg client factory ===
// The DbClient interface is minimal ({ query(text, params) }) so any client
// that supports parameterized SQL works. See README for swap examples.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function getDb(): Promise<DbClient> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL env var not set');
  }
  return pool as unknown as DbClient;
}

// === Tuning ===
const CRON_SECRET = process.env.CRON_SECRET;
const CONCURRENCY = 5;
const PER_USER_TIMEOUT_MS = 8_000;
const SKIP_IF_NEWER_THAN_HOURS = 12;
const MAX_USERS_PER_RUN = 200;
const WALL_CLOCK_RESERVE_MS = 5_000;
const MAX_ERRORS_RETURNED = 20;

type Stats = {
  total: number;
  processed: number;
  skippedFresh: number;
  failed: number;
  durationMs: number;
};

export async function GET(req: Request): Promise<NextResponse> {
  // --- Auth: fail closed if CRON_SECRET unset or header missing/wrong ---
  const auth = req.headers.get('authorization');
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'forbidden' }, { status: 401 });
  }

  // --- Parse query params ---
  const url = new URL(req.url);
  const dryRun = url.searchParams.get('dryRun') === '1';
  const singleUserId = url.searchParams.get('userId');
  const limitParam = url.searchParams.get('limit');
  const maxUsers =
    limitParam && Number.isFinite(+limitParam)
      ? Math.min(+limitParam, MAX_USERS_PER_RUN)
      : MAX_USERS_PER_RUN;

  let db: DbClient;
  try {
    db = await getDb();
  } catch (err) {
    return NextResponse.json(
      { error: 'db_not_wired', message: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }

  // --- Determine user set ---
  let userIds: string[];
  try {
    userIds = singleUserId
      ? [singleUserId]
      : (await fetchActiveUserIds(db)).slice(0, maxUsers);
  } catch (err) {
    return NextResponse.json(
      { error: 'fetch_active_users_failed', message: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }

  // --- Process with bounded concurrency + per-user timeout + per-user error isolation ---
  const stats: Stats = {
    total: userIds.length,
    processed: 0,
    skippedFresh: 0,
    failed: 0,
    durationMs: 0,
  };
  const errors: { userId: string; error: string }[] = [];
  const start = Date.now();
  const wallClockLimitMs = maxDuration * 1000 - WALL_CLOCK_RESERVE_MS;

  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < userIds.length && Date.now() - start < wallClockLimitMs) {
      const userId = userIds[cursor++];

      // Skip-fresh check (idempotency for Vercel cron double-fire).
      // Single-user mode bypasses this so manual refresh always works.
      if (!singleUserId) {
        try {
          const existing = await fetchMemoryCache(db, userId);
          if (existing) {
            const ageHours =
              (Date.now() - new Date(existing.updated_at).getTime()) / 3_600_000;
            if (ageHours < SKIP_IF_NEWER_THAN_HOURS) {
              stats.skippedFresh++;
              continue;
            }
          }
        } catch {
          // If skip-fresh check fails, proceed to compose — better to recompute than skip.
        }
      }

      try {
        await withTimeout(
          (async () => {
            const bundle = await composeMemoryBundle(db, userId, null, {
              freshSession: false,
            });
            if (!dryRun) {
              await upsertMemoryCache(db, userId, bundle);
            }
            stats.processed++;
          })(),
          PER_USER_TIMEOUT_MS,
          `user ${userId} timed out after ${PER_USER_TIMEOUT_MS}ms`
        );
      } catch (err) {
        stats.failed++;
        errors.push({
          userId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  await Promise.all(
    Array.from({ length: CONCURRENCY }, () => worker())
  );
  stats.durationMs = Date.now() - start;

  return NextResponse.json(
    {
      ok: true,
      dryRun,
      stats,
      errors: errors.slice(0, MAX_ERRORS_RETURNED),
    },
    { status: 200 }
  );
}

function withTimeout<T>(p: Promise<T>, ms: number, msg: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(msg)), ms)
    ),
  ]);
}
