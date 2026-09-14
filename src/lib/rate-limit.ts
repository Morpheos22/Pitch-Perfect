/**
 * Rate Limiting Library — PitchCoach Ai
 *
 * In-memory sliding-window rate limiter (replaces Upstash Redis).
 * Uses per-edge-instance Map with timestamps. Each Vercel edge instance
 * has its own counter, so the effective limit is per-instance × number of
 * instances. This is acceptable for most use cases — for stricter limits,
 * consider Cloudflare KV or Durable Objects.
 *
 * Usage in middleware:
 *   import { rateLimitMiddleware } from '@/lib/rate-limit';
 *
 * Usage in individual routes:
 *   import { withRateLimit } from '@/lib/rate-limit';
 *   export const POST = withRateLimit(myHandler, { limit: 5, windowMs: 60_000 });
 */

import { NextRequest, NextResponse } from "next/server";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface RateLimitConfig {
  limit: number;
  windowMs: number;
  identifierType: "ip" | "user" | "both";
  name?: string;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  reset: number;
  limit: number;
  retryAfter: number;
}

// ──────────────────────────────────────────────
// In-memory store (per-edge-instance)
// ──────────────────────────────────────────────
// Key: `${identifier}:${routeName}`, Value: array of timestamps
const store = new Map<string, number[]>();
const MAX_STORE_SIZE = 10_000; // Prevent memory leak

function cleanupOldEntries(key: string, windowMs: number): number[] {
  const now = Date.now();
  const cutoff = now - windowMs;
  const entries = store.get(key) || [];
  const filtered = entries.filter(ts => ts > cutoff);
  if (filtered.length !== entries.length) {
    store.set(key, filtered);
  }
  return filtered;
}

function checkLimit(identifier: string, config: RateLimitConfig): RateLimitResult {
  const key = `${identifier}:${config.name || "default"}`;
  const now = Date.now();
  const windowMs = config.windowMs;

  const entries = cleanupOldEntries(key, windowMs);

  if (entries.length >= config.limit) {
    // Rate limited
    const oldest = Math.min(...entries);
    const resetTime = oldest + windowMs;
    return {
      allowed: false,
      remaining: 0,
      reset: Math.floor(resetTime / 1000),
      limit: config.limit,
      retryAfter: Math.ceil((resetTime - now) / 1000),
    };
  }

  // Allow
  entries.push(now);
  store.set(key, entries);

  // Periodic cleanup
  if (store.size > MAX_STORE_SIZE) {
    const cutoff = now - Math.max(windowMs, 300_000); // 5 min minimum
    for (const [k, v] of store) {
      const filtered = v.filter(ts => ts > cutoff);
      if (filtered.length === 0) {
        store.delete(k);
      } else {
        store.set(k, filtered);
      }
    }
  }

  return {
    allowed: true,
    remaining: config.limit - entries.length,
    reset: Math.floor((now + windowMs) / 1000),
    limit: config.limit,
    retryAfter: 0,
  };
}

// ──────────────────────────────────────────────
// Config presets (same as before)
// ──────────────────────────────────────────────

const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  // AI coaching routes — increased limits for faster dashboard
  "/api/coach/script": { limit: 20, windowMs: 60_000, identifierType: "user", name: "coach-script" },
  "/api/coach/deck": { limit: 20, windowMs: 60_000, identifierType: "user", name: "coach-deck" },
  "/api/coach/live": { limit: 10, windowMs: 60_000, identifierType: "user", name: "coach-live" },
  "/api/coach/full": { limit: 10, windowMs: 60_000, identifierType: "user", name: "coach-full" },
  "/api/coach/drills": { limit: 30, windowMs: 60_000, identifierType: "user", name: "coach-drills" },
  "/api/coach/founder": { limit: 20, windowMs: 60_000, identifierType: "user", name: "coach-founder" },
  "/api/coach/diagnostic": { limit: 5, windowMs: 60_000, identifierType: "user", name: "coach-diagnostic" },
  "/api/kal/": { limit: 30, windowMs: 60_000, identifierType: "user", name: "kal" },

  // General API — increased for faster dashboard load
  "/api/": { limit: 120, windowMs: 60_000, identifierType: "ip", name: "api-general" },

  // Auth
  "/api/auth/": { limit: 10, windowMs: 60_000, identifierType: "ip", name: "auth" },
  "/api/user/change-password": { limit: 5, windowMs: 60_000, identifierType: "user", name: "change-password" },
  "/api/contact": { limit: 5, windowMs: 60_000, identifierType: "ip", name: "contact" },

  // NOTE: /api/athena/chat is intentionally NOT listed here.
  // It uses its own tiered quota system (see src/lib/athena-quota.ts) that
  // differentiates anonymous (5 msg / 6h per IP+device) from signed-in
  // (40 msg / 6h per user) users. Adding it to this middleware rate-limit
  // would double-count requests and break the tiered cap.
};

function getConfigForPath(pathname: string): RateLimitConfig {
  // Try exact match first
  if (RATE_LIMIT_CONFIGS[pathname]) return RATE_LIMIT_CONFIGS[pathname];

  // Try prefix match (longest first)
  const sortedKeys = Object.keys(RATE_LIMIT_CONFIGS).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (pathname.startsWith(key)) return RATE_LIMIT_CONFIGS[key];
  }

  // Default
  return { limit: 30, windowMs: 60_000, identifierType: "ip", name: "default" };
}

// ──────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────

export async function rateLimitMiddleware(
  request: NextRequest,
  userId?: string
): Promise<NextResponse | null> {
  const pathname = new URL(request.url).pathname;
  const config = getConfigForPath(pathname);

  let identifier: string;
  if (config.identifierType === "user" && userId) {
    identifier = `user:${userId}`;
  } else {
    const ip = request.headers.get("x-vercel-forwarded-for") ||
               request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
               "unknown";
    identifier = `ip:${ip}`;
  }

  const result = checkLimit(identifier, config);

  if (!result.allowed) {
    return NextResponse.json(
      {
        error: "rate_limit_exceeded",
        message: `Too many requests. Try again in ${result.retryAfter} seconds.`,
        retryAfter: result.retryAfter,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(result.retryAfter),
          "X-RateLimit-Limit": String(result.limit),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(result.reset),
        },
      }
    );
  }

  return null; // Request allowed
}

export function withRateLimit(
  handler: (req: NextRequest) => Promise<NextResponse>,
  config: RateLimitConfig
): (req: NextRequest) => Promise<NextResponse> {
  return async (req: NextRequest) => {
    const userId = (req as any).auth?.userId;
    let identifier: string;

    if (config.identifierType === "user" && userId) {
      identifier = `user:${userId}`;
    } else {
      const ip = req.headers.get("x-vercel-forwarded-for") ||
                 req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
                 "unknown";
      identifier = `ip:${ip}`;
    }

    const result = checkLimit(identifier, config);

    if (!result.allowed) {
      return NextResponse.json(
        {
          error: "rate_limit_exceeded",
          message: `Too many requests. Try again in ${result.retryAfter} seconds.`,
          retryAfter: result.retryAfter,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(result.retryAfter),
            "X-RateLimit-Limit": String(result.limit),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(result.reset),
          },
        }
      );
    }

    const response = await handler(req);
    response.headers.set("X-RateLimit-Limit", String(result.limit));
    response.headers.set("X-RateLimit-Remaining", String(result.remaining));
    response.headers.set("X-RateLimit-Reset", String(result.reset));
    return response;
  };
}

export async function resetRateLimit(identifier: string): Promise<number> {
  let count = 0;
  for (const key of store.keys()) {
    if (key.startsWith(identifier)) {
      store.delete(key);
      count++;
    }
  }
  return count;
}
