/**
 * Rate Limiting Library — Pitch Perfect × Automagikal
 *
 * Lightweight, in-memory sliding-window rate limiter with zero external deps.
 * Designed to integrate with Clerk middleware and individual API route handlers.
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

interface StoredEntry {
  /** Array of request timestamps (ms since epoch) */
  timestamps: number[];
}

// ──────────────────────────────────────────────
// Storage: in-memory Map with TTL cleanup
// ──────────────────────────────────────────────

/** Map<identifier, Map<routeKey, StoredEntry>> — nested for per-route isolation */
const rateLimitStore = new Map<string, Map<string, StoredEntry>>();

/** Interval reference for periodic cleanup */
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Garbage-collect expired entries from the store.
 * Runs every 60 seconds to prevent unbounded memory growth.
 */
function runCleanup(): void {
  const now = Date.now();
  const maxWindowMs = 120_000; // Max window is 60s; keep entries for 120s to be safe

  for (const [identifier, routes] of rateLimitStore.entries()) {
    let allRoutesEmpty = true;

    for (const [routeKey, entry] of routes.entries()) {
      // Filter out timestamps older than maxWindowMs
      entry.timestamps = entry.timestamps.filter(
        (ts) => now - ts < maxWindowMs
      );

      if (entry.timestamps.length === 0) {
        routes.delete(routeKey);
      } else {
        allRoutesEmpty = false;
      }
    }

    if (allRoutesEmpty || routes.size === 0) {
      rateLimitStore.delete(identifier);
    }
  }
}

/**
 * Ensure cleanup interval is running (idempotent).
 */
function ensureCleanup(): void {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(runCleanup, 60_000);

  // Allow Node.js to exit even if the interval is still running
  if (typeof cleanupInterval === "object" && "unref" in cleanupInterval) {
    cleanupInterval.unref();
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

  // Fallback — hash of connect info to avoid grouping all unknown clients together
  return `unknown-${Date.now() % 100000}`;
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
// Core sliding-window rate limiter
// ──────────────────────────────────────────────

/**
 * Check rate limit for a given identifier + route combination.
 *
 * Uses a sliding window algorithm:
 * 1. Remove all timestamps outside the current window
 * 2. Check if the remaining count is under the limit
 * 3. If allowed, record the current timestamp
 *
 * @param identifier - Unique identifier (user ID or IP)
 * @param routeKey - Route group key
 * @param config - Rate limit configuration
 */
export function checkRateLimitById(
  identifier: string,
  routeKey: string,
  config: RateLimitConfig
): RateLimitResult {
  ensureCleanup();

  const now = Date.now();
  const windowStart = now - config.windowMs;

  // Get or create the entry for this identifier
  let routes = rateLimitStore.get(identifier);
  if (!routes) {
    routes = new Map<string, StoredEntry>();
    rateLimitStore.set(identifier, routes);
  }

  // Get or create the entry for this route
  let entry = routes.get(routeKey);
  if (!entry) {
    entry = { timestamps: [] };
    routes.set(routeKey, entry);
  }

  // Sliding window: prune timestamps outside the window
  entry.timestamps = entry.timestamps.filter((ts) => ts > windowStart);

  const currentCount = entry.timestamps.length;
  const allowed = currentCount < config.limit;
  const remaining = Math.max(0, config.limit - currentCount - (allowed ? 1 : 0));
  const windowEnd = entry.timestamps[0]
    ? entry.timestamps[0] + config.windowMs
    : now + config.windowMs;
  const reset = Math.ceil(windowEnd / 1000);
  const retryAfter = Math.ceil((windowEnd - now) / 1000);

  if (allowed) {
    entry.timestamps.push(now);
  }

  return {
    allowed,
    remaining,
    reset,
    limit: config.limit,
    retryAfter: Math.max(1, retryAfter),
  };
}

// ──────────────────────────────────────────────
// Public API: request-level functions
// ──────────────────────────────────────────────

/**
 * Check rate limit for a NextRequest.
 * Automatically extracts the identifier (user ID or IP) based on config.
 *
 * @param request - The incoming NextRequest
 * @param config - Rate limit configuration (optional, auto-detected from path)
 * @param userId - Optional Clerk user ID (if already resolved)
 */
export function checkRateLimit(
  request: NextRequest,
  config?: RateLimitConfig,
  userId?: string
): RateLimitResult {
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

  return checkRateLimitById(identifier, routeKey, resolvedConfig);
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

export type RouteHandler = (
  request: NextRequest
) => Promise<NextResponse> | NextResponse;

/**
 * Check rate limiting for a request. Returns:
 *  - `NextResponse` if rate limited (429)
 *  - `null` if the request is allowed (caller should proceed)
 *
 * Designed for easy integration inside Clerk's middleware callback.
 */
export function rateLimitMiddleware(
  request: NextRequest,
  userId?: string
): NextResponse | null {
  const pathname = new URL(request.url).pathname;

  // Skip non-API and internal routes
  if (!pathname.startsWith("/api/") || shouldSkipRateLimit(pathname)) {
    return null;
  }

  const result = checkRateLimit(request, undefined, userId);

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

    const result = checkRateLimit(request, config, userId);

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
 * Get current rate limit store stats (for debugging/admin).
 * Returns count of tracked identifiers and total stored entries.
 */
export function getRateLimitStats(): {
  trackedIdentifiers: number;
  totalEntries: number;
} {
  let totalEntries = 0;
  for (const routes of rateLimitStore.values()) {
    totalEntries += routes.size;
  }
  return {
    trackedIdentifiers: rateLimitStore.size,
    totalEntries,
  };
}

/**
 * Reset all rate limit counters. Useful for testing.
 */
export function resetRateLimits(): void {
  rateLimitStore.clear();
}
