/**
 * Rate Limiting Library — Pitch Perfect × Automagikal
 *
 * Sliding-window rate limiter backed by Upstash Redis for Vercel serverless.
 * Falls back to per-request mode (no state, permissive) when Redis is not configured.
 *
 * Usage in middleware:
 *   import { checkRateLimit, getRateLimitConfig, setRateLimitHeaders } from '@/lib/rate-limit';
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
  /** Maximum number of requests allowed within the window */
  limit: number;
  /** Sliding window duration in milliseconds */
  windowMs: number;
  /** Identifier type: 'ip' for IP-based, 'user' for user-ID-based, 'both' tries user then falls back to IP */
  identifierType: "ip" | "user" | "both";
  /** Human-readable name for logging */
  name?: string;
}

export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Number of remaining requests in the current window */
  remaining: number;
  /** Unix timestamp (seconds) when the window resets */
  reset: number;
  /** Total limit for this route tier */
  limit: number;
  /** Time in seconds until the window resets (useful for Retry-After) */
  retryAfter: number;
}

// ──────────────────────────────────────────────
// Redis client (lazy init)
// ──────────────────────────────────────────────

type RedisClient = {
  zadd: (key: string, ...args: any[]) => Promise<any>;
  zrangebyscore: (key: string, min: number | string, max: number | string, ...args: any[]) => Promise<string[]>;
  zremrangebyscore: (key: string, min: number | string, max: number | string) => Promise<number>;
  zcard: (key: string) => Promise<number>;
  pexpireat: (key: string, ms: number) => Promise<boolean>;
  ping: () => Promise<string>;
};

let _redis: RedisClient | null = null;
let _redisInitFailed = false;

async function getRedis(): Promise<RedisClient | null> {
  if (_redisInitFailed) return null;
  if (_redis) return _redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    _redisInitFailed = true;
    return null;
  }

  try {
    const { Redis } = await import("@upstash/redis");
    _redis = new Redis({ url, token }) as unknown as RedisClient;
    return _redis;
  } catch (err) {
    console.warn("[RateLimit] Failed to initialize Upstash Redis:", err);
    _redisInitFailed = true;
    return null;
  }
}

// ──────────────────────────────────────────────
// Route-tier configuration
// ──────────────────────────────────────────────

/** Predefined rate limit tiers for common route patterns */
export const RATE_LIMIT_TIERS = {
  /** AI analysis routes — expensive, limit aggressively */
  ai: {
    limit: 5,
    windowMs: 60_000,
    identifierType: "both" as const,
    name: "AI Analysis",
  },
  /** Payment & billing routes — sensitive, moderate limit */
  payment: {
    limit: 10,
    windowMs: 60_000,
    identifierType: "both" as const,
    name: "Payment",
  },
  /** Contact form — prevent spam */
  contact: {
    limit: 3,
    windowMs: 60_000,
    identifierType: "ip" as const,
    name: "Contact",
  },
  /** Auth routes — prevent brute force */
  auth: {
    limit: 5,
    windowMs: 60_000,
    identifierType: "ip" as const,
    name: "Auth",
  },
  /** General API routes — generous limit for normal usage */
  general: {
    limit: 30,
    windowMs: 60_000,
    identifierType: "both" as const,
    name: "General API",
  },
  /** Unrestricted — for health checks, webhooks, dev endpoints */
  unrestricted: {
    limit: 1000,
    windowMs: 60_000,
    identifierType: "ip" as const,
    name: "Unrestricted",
  },
} as const;

/**
 * Determine the rate limit tier for a given request pathname.
 *
 * Order matters — more specific patterns are checked first.
 */
export function getRateLimitConfig(pathname: string): RateLimitConfig {
  // AI analysis routes (most expensive — limit aggressively)
  if (
    pathname.startsWith("/api/coach/") ||
    pathname === "/api/video" ||
    pathname.startsWith("/api/video/")
  ) {
    return { ...RATE_LIMIT_TIERS.ai };
  }

  // Payment & billing routes
  if (
    pathname.startsWith("/api/payment/") ||
    pathname.startsWith("/api/billing/")
  ) {
    return { ...RATE_LIMIT_TIERS.payment };
  }

  // Contact form
  if (pathname === "/api/contact") {
    return { ...RATE_LIMIT_TIERS.contact };
  }

  // Auth-related routes
  if (
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/sign-up") ||
    pathname.startsWith("/api/auth/")
  ) {
    return { ...RATE_LIMIT_TIERS.auth };
  }

  // Health checks, webhooks, dev endpoints — effectively unlimited
  if (
    pathname.startsWith("/api/webhooks/") ||
    pathname === "/api/health" ||
    pathname.startsWith("/api/dev/")
  ) {
    return { ...RATE_LIMIT_TIERS.unrestricted };
  }

  // Everything else
  return { ...RATE_LIMIT_TIERS.general };
}

/**
 * Determine if a route should be entirely skipped from rate limiting.
 * Webhooks from external services and Next.js internal routes should never be limited.
 */
export function shouldSkipRateLimit(pathname: string): boolean {
  // Webhook routes — external services, must always pass
  if (pathname.startsWith("/api/webhooks/")) {
    return true;
  }

  // Next.js internal routes
  if (pathname.startsWith("/_next/")) {
    return true;
  }

  // Health check endpoint
  if (pathname === "/api/health") {
    return true;
  }

  // Clerk's own webhook/user sync
  if (
    pathname === "/api/user/sync"
  ) {
    return true;
  }

  return false;
}

// ──────────────────────────────────────────────
// Identifier extraction
// ──────────────────────────────────────────────

/**
 * Extract client IP address from the request.
 * Checks X-Forwarded-For, X-Real-IP, then falls back to a generic hash.
 */
export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    // First IP in the chain is the original client
    const firstIp = forwarded.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  // Fallback — use a stable hash of connect info instead of per-request unique ID
  // Hash from User-Agent + Accept headers ensures same client gets same identifier
  const ua = request.headers.get("user-agent") || "";
  const accept = request.headers.get("accept") || "";
  let hash = 0;
  const combined = `${ua}:${accept}`;
  for (let i = 0; i < combined.length; i++) {
    const chr = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32-bit integer
  }
  return `unknown-${Math.abs(hash).toString(36)}`;
}

/**
 * Extract the route key from the pathname.
 * Normalizes the path for grouping (e.g., /api/coach/script and /api/coach/deck share a tier).
 */
function getRouteKey(pathname: string, config: RateLimitConfig): string {
  // Group by tier name for consistent rate limiting across similar routes
  const tierName = config.name || "custom";
  return `tier:${tierName}:${config.limit}:${config.windowMs}`;
}

// ──────────────────────────────────────────────
// Core sliding-window rate limiter (Redis-backed)
// ──────────────────────────────────────────────

/**
 * Check rate limit for a given identifier + route combination using Redis sorted sets.
 *
 * Sliding window via ZSET:
 * 1. ZADD the current timestamp as a member
 * 2. ZREMRANGEBYSCORE to prune entries outside the window
 * 3. ZCARD to count remaining entries
 * 4. If over limit, ZREM the current entry (roll back)
 *
 * @param identifier - Unique identifier (user ID or IP)
 * @param routeKey - Route group key
 * @param config - Rate limit configuration
 */
async function checkRateLimitRedis(
  identifier: string,
  routeKey: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const redis = await getRedis();
  if (!redis) {
    // Fallback: allow request with a warning (graceful degradation)
    return {
      allowed: true,
      remaining: config.limit - 1,
      reset: Math.ceil((Date.now() + config.windowMs) / 1000),
      limit: config.limit,
      retryAfter: 1,
    };
  }

  const now = Date.now();
  const windowStart = now - config.windowMs;
  const redisKey = `rl:${identifier}:${routeKey}`;

  try {
    // Add current request timestamp
    await redis.zadd(redisKey, { score: now, member: String(now) });

    // Remove all entries outside the sliding window
    await redis.zremrangebyscore(redisKey, "-inf", windowStart);

    // Count entries in the current window
    const count = await redis.zcard(redisKey);

    // Set expiry on the key to auto-cleanup (2x window for safety)
    await redis.pexpireat(redisKey, now + config.windowMs * 2);

    if (count > config.limit) {
      // Over limit — remove the entry we just added (roll back)
      await redis.zremrangebyscore(redisKey, now, now);

      // Find the oldest entry to calculate reset time
      const oldest = await redis.zrangebyscore(redisKey, "-inf", "+inf");
      const windowEnd = oldest.length > 0
        ? Number(oldest[0]) + config.windowMs
        : now + config.windowMs;

      return {
        allowed: false,
        remaining: 0,
        reset: Math.ceil(windowEnd / 1000),
        limit: config.limit,
        retryAfter: Math.max(1, Math.ceil((windowEnd - now) / 1000)),
      };
    }

    const remaining = Math.max(0, config.limit - count);

    // Calculate when the oldest entry expires (window reset)
    const oldest = await redis.zrangebyscore(redisKey, "-inf", "+inf");
    const windowEnd = oldest.length > 0
      ? Number(oldest[0]) + config.windowMs
      : now + config.windowMs;

    return {
      allowed: true,
      remaining,
      reset: Math.ceil(windowEnd / 1000),
      limit: config.limit,
      retryAfter: Math.max(1, Math.ceil((windowEnd - now) / 1000)),
    };
  } catch (err) {
    // Redis error — allow request (fail-open) to avoid blocking users during Redis outages
    console.error("[RateLimit] Redis error (fail-open):", err);
    return {
      allowed: true,
      remaining: config.limit - 1,
      reset: Math.ceil((Date.now() + config.windowMs) / 1000),
      limit: config.limit,
      retryAfter: 1,
    };
  }
}

// ──────────────────────────────────────────────
// Public API: request-level functions
// ──────────────────────────────────────────────

/**
 * Check rate limit for a NextRequest (async — Redis-backed).
 * Automatically extracts the identifier (user ID or IP) based on config.
 *
 * @param request - The incoming NextRequest
 * @param config - Rate limit configuration (optional, auto-detected from path)
 * @param userId - Optional Clerk user ID (if already resolved)
 */
export async function checkRateLimit(
  request: NextRequest,
  config?: RateLimitConfig,
  userId?: string
): Promise<RateLimitResult> {
  const pathname = new URL(request.url).pathname;
  const resolvedConfig = config || getRateLimitConfig(pathname);
  const routeKey = getRouteKey(pathname, resolvedConfig);

  // Determine identifier based on config type
  let identifier: string;
  if (resolvedConfig.identifierType === "ip") {
    identifier = `ip:${getClientIp(request)}`;
  } else if (resolvedConfig.identifierType === "user" && userId) {
    identifier = `user:${userId}`;
  } else if (resolvedConfig.identifierType === "both" && userId) {
    identifier = `user:${userId}`;
  } else {
    identifier = `ip:${getClientIp(request)}`;
  }

  return checkRateLimitRedis(identifier, routeKey, resolvedConfig);
}

// ──────────────────────────────────────────────
// Rate limit response helpers
// ──────────────────────────────────────────────

/**
 * Set standard rate limit headers on a NextResponse.
 *   X-RateLimit-Limit: The max requests allowed in the window
 *   X-RateLimit-Remaining: How many requests are left
 *   X-RateLimit-Reset: Unix timestamp when the window resets
 */
export function setRateLimitHeaders(
  response: NextResponse,
  result: RateLimitResult
): NextResponse {
  response.headers.set("X-RateLimit-Limit", String(result.limit));
  response.headers.set("X-RateLimit-Remaining", String(result.remaining));
  response.headers.set("X-RateLimit-Reset", String(result.reset));
  return response;
}

/**
 * Create a 429 Too Many Requests response with rate limit headers.
 */
export function rateLimitResponse(result: RateLimitResult): NextResponse {
  const response = NextResponse.json(
    {
      error: "Too Many Requests",
      message: `Rate limit exceeded. Please try again in ${result.retryAfter} second${result.retryAfter !== 1 ? "s" : ""}.`,
      retryAfter: result.retryAfter,
      limit: result.limit,
      remaining: 0,
      reset: result.reset,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfter),
        "Content-Type": "application/json",
      },
    }
  );

  return setRateLimitHeaders(response, result);
}

// ──────────────────────────────────────────────
// Middleware integration helper
// ──────────────────────────────────────────────

/**
 * Check rate limiting for a request. Returns:
 *  - `NextResponse` if rate limited (429)
 *  - `null` if the request is allowed (caller should proceed)
 *
 * Designed for easy integration inside Clerk's middleware callback.
 */
export async function rateLimitMiddleware(
  request: NextRequest,
  userId?: string
): Promise<NextResponse | null> {
  const pathname = new URL(request.url).pathname;

  // Skip non-API and internal routes
  if (!pathname.startsWith("/api/") || shouldSkipRateLimit(pathname)) {
    return null;
  }

  const result = await checkRateLimit(request, undefined, userId);

  if (!result.allowed) {
    console.warn(
      `[RateLimit] Blocked request from ${userId || getClientIp(request)} on ${pathname} (${result.retryAfter}s retry)`
    );
    return rateLimitResponse(result);
  }

  return null;
}

// ──────────────────────────────────────────────
// Higher-order wrapper for individual routes
// ──────────────────────────────────────────────

export type ApiHandler = (
  request: NextRequest,
  context?: { params?: Promise<Record<string, string>> }
) => Promise<NextResponse> | NextResponse;

/**
 * Wrap an API route handler with rate limiting.
 *
 * Usage:
 * ```ts
 * export const POST = withRateLimit(myHandler, {
 *   limit: 5,
 *   windowMs: 60_000,
 *   identifierType: 'both',
 * });
 * ```
 */
export function withRateLimit(
  handler: ApiHandler,
  config: RateLimitConfig,
  customUserId?: string
): ApiHandler {
  return async (request, context) => {
    // Get user ID from Clerk if available
    let userId = customUserId;
    if (!userId) {
      try {
        // Dynamic import to avoid issues in Edge runtime
        const { auth } = await import("@clerk/nextjs/server");
        const { userId: clerkId } = await auth();
        userId = clerkId || undefined;
      } catch {
        // Clerk not available — fall back to IP
        userId = undefined;
      }
    }

    const result = await checkRateLimit(request, config, userId);

    if (!result.allowed) {
      console.warn(
        `[RateLimit] Route-level blocked from ${userId || getClientIp(request)} (${result.retryAfter}s retry)`
      );
      return rateLimitResponse(result);
    }

    const response = await handler(request, context);

    // Attach rate limit headers to the successful response
    return setRateLimitHeaders(response, result);
  };
}

// ──────────────────────────────────────────────
// Admin / debug helpers
// ──────────────────────────────────────────────

/**
 * Get rate limiter status (for debugging/admin).
 * Returns whether Redis is connected and configured.
 */
export async function getRateLimitStats(): Promise<{
  redisConnected: boolean;
  backend: "redis" | "fallback";
}> {
  const redis = await getRedis();
  if (!redis) {
    return { redisConnected: false, backend: "fallback" };
  }
  try {
    await redis.ping();
    return { redisConnected: true, backend: "redis" };
  } catch {
    return { redisConnected: false, backend: "fallback" };
  }
}
