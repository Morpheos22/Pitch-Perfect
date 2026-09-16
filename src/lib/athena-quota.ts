/**
 * Athena Quota — tiered interaction cap for the Athena chat widget.
 *
 * Why this exists:
 *   The Athena widget is rendered on every public page. Without a cap,
 *   anonymous users (and bots that slip past the User-Agent gate) could
 *   hammer /api/athena/chat and burn Cloudflare Workers AI quota.
 *
 * Design:
 *   - Anonymous visitors are identified by IP (+ device fingerprint hash
 *     to make IP-rotation slightly harder).
 *   - Signed-in users are identified by their Clerk userId.
 *   - Two separate windows live side-by-side:
 *       • ANON:  5 messages / 6 hours per IP+device  (strict — converts to sign-up)
 *       • AUTH:  40 messages / 6 hours per user      (generous — they're onboarded)
 *   - Both windows reset on their own clock (sliding window, not fixed).
 *   - Quota state is in-memory per-edge-instance. On Vercel this means each
 *     edge instance tracks its own slice; a determined attacker could
 *     theoretically get a few extra messages by hitting different instances,
 *     but the worst case is ~2-3x the cap — acceptable for a free public
 *     widget. For a hard cap, see the operator runbook (Cloudflare WAF +
 *     KV-based rate limit) — that lives outside the app.
 *   - Priority under load: when an Athena request comes in, if the global
 *     in-flight counter for anon requests is at the soft cap, anon requests
 *     are rejected with 503 + `retry_after` so signed-in users always get
 *     a slot. Signed-in requests are never throttled by this mechanism.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

export const ATHENA_QUOTA = {
  ANON: {
    limit: 5,            // 5 messages per window
    windowMs: 6 * 60 * 60 * 1000,  // 6 hours
    name: "athena-anon",
  },
  AUTH: {
    limit: 40,           // 40 messages per window
    windowMs: 6 * 60 * 60 * 1000,  // 6 hours
    name: "athena-auth",
  },
  // Soft concurrency cap for ANON requests only. If this many anonymous
  // Athena requests are in-flight on this edge instance at the same time,
  // new anon requests are 503'd. Signed-in requests bypass this entirely.
  ANON_CONCURRENCY_CAP: 3,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// In-memory sliding-window store
// ─────────────────────────────────────────────────────────────────────────────
// Key: `${tier}:${identifier}`  →  array of timestamps
const store = new Map<string, number[]>();
const MAX_STORE_SIZE = 20_000;

// In-flight (pending response) counter for anon requests, per edge instance.
let anonInFlight = 0;

function cleanup(key: string, windowMs: number): number[] {
  const now = Date.now();
  const cutoff = now - windowMs;
  const entries = store.get(key) ?? [];
  const filtered = entries.filter((ts) => ts > cutoff);
  if (filtered.length !== entries.length) {
    store.set(key, filtered);
  }
  return filtered;
}

function pruneIfNeeded(): void {
  if (store.size <= MAX_STORE_SIZE) return;
  const cutoff = Date.now() - 6 * 60 * 60 * 1000;
  for (const [k, v] of store) {
    const filtered = v.filter((ts) => ts > cutoff);
    if (filtered.length === 0) store.delete(k);
    else store.set(k, filtered);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export interface QuotaCheckResult {
  allowed: boolean;
  tier: "anon" | "auth";
  /** How many messages the user has left in the current window. */
  remaining: number;
  /** Unix seconds — when the oldest message in the window expires. */
  resetAt: number;
  /** Seconds until the user can retry (only meaningful when allowed=false). */
  retryAfter: number;
  /** True when the request was rejected specifically because of concurrency cap. */
  concurrencyBlocked: boolean;
  /** Hard cap was hit — surface the sign-in CTA to the client. */
  requiresSignIn: boolean;
}

/**
 * Check (and reserve) an Athena message slot for the given identifier.
 *
 * Returns `allowed: true` if the message may proceed. The slot is recorded
 * immediately — if the caller later decides not to send the message, the
 * slot is consumed anyway. This is intentional: it prevents a bad actor
 * from probing the endpoint without consuming quota.
 *
 * Identifier rules:
 *   - For anon: pass `ip:deviceId` so both IP rotation and same-IP
 *     different-device are caught.
 *   - For auth: pass the Clerk userId.
 */
export function checkAthenaQuota(
  tier: "anon" | "auth",
  identifier: string,
): QuotaCheckResult {
  // Concurrency guard for anon — never throttles auth.
  if (tier === "anon" && anonInFlight >= ATHENA_QUOTA.ANON_CONCURRENCY_CAP) {
    return {
      allowed: false,
      tier,
      remaining: 0,
      resetAt: 0,
      retryAfter: 5,
      concurrencyBlocked: true,
      requiresSignIn: false,
    };
  }

  const cfg = tier === "anon" ? ATHENA_QUOTA.ANON : ATHENA_QUOTA.AUTH;
  const key = `${tier}:${identifier}`;
  const now = Date.now();

  const entries = cleanup(key, cfg.windowMs);

  if (entries.length >= cfg.limit) {
    const oldest = Math.min(...entries);
    const resetTime = oldest + cfg.windowMs;
    pruneIfNeeded();
    return {
      allowed: false,
      tier,
      remaining: 0,
      resetAt: Math.floor(resetTime / 1000),
      retryAfter: Math.ceil((resetTime - now) / 1000),
      concurrencyBlocked: false,
      // For anon: hitting the cap surfaces the sign-in CTA.
      // For auth: we just rate-limit; they don't need a sign-in CTA.
      requiresSignIn: tier === "anon",
    };
  }

  entries.push(now);
  store.set(key, entries);
  pruneIfNeeded();

  return {
    allowed: true,
    tier,
    remaining: cfg.limit - entries.length,
    resetAt: Math.floor((now + cfg.windowMs) / 1000),
    retryAfter: 0,
    concurrencyBlocked: false,
    requiresSignIn: false,
  };
}

/**
 * Mark an in-flight anon request as started. Pair with `releaseAnonSlot()`
 * in a finally{} block. Auth requests are not tracked here.
 */
export function reserveAnonSlot(): void {
  anonInFlight++;
}

/**
 * Mark an in-flight anon request as finished.
 */
export function releaseAnonSlot(): void {
  if (anonInFlight > 0) anonInFlight--;
}

/**
 * Peek without consuming — used by /api/athena/quota to render remaining
 * messages in the widget header before the user types anything.
 */
export function peekAthenaQuota(
  tier: "anon" | "auth",
  identifier: string,
): Omit<QuotaCheckResult, "allowed" | "retryAfter" | "concurrencyBlocked" | "requiresSignIn"> {
  const cfg = tier === "anon" ? ATHENA_QUOTA.ANON : ATHENA_QUOTA.AUTH;
  const key = `${tier}:${identifier}`;
  const entries = cleanup(key, cfg.windowMs);
  return {
    tier,
    remaining: Math.max(0, cfg.limit - entries.length),
    resetAt: Math.floor((Date.now() + cfg.windowMs) / 1000),
  };
}
