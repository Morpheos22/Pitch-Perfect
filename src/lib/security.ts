/**
 * Security library — IP extraction, device fingerprinting, blocked-IP/email checks.
 *
 * IMPORTANT: This module is imported by middleware.ts (Edge Runtime).
 * It MUST NOT import @prisma/client or any other heavy Node-only dep —
 * Vercel's edge function size limit is 1 MB and Prisma blows past it.
 *
 * All DB persistence happens via fire-and-forget fetch() calls to
 * /api/security/* routes, which run on Node.js runtime and have
 * full Prisma access.
 */

// ─────────────────────────────────────────────────────────────────────────────
// CRYPTO — use Web Crypto API (SubtleCrypto) for edge compatibility
// ─────────────────────────────────────────────────────────────────────────────
// The Node.js 'crypto' module is NOT available in the Edge Runtime.
// Web Crypto's crypto.subtle.digest() is the cross-runtime replacement
// and works on both Edge and Node.js (Node 19+ has it built-in).

async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  // Convert ArrayBuffer to hex string
  const bytes = new Uint8Array(hashBuffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ─────────────────────────────────────────────────────────────────────────────
// BLOCKED EMAILS + DOMAINS — permanent blocklist
// ─────────────────────────────────────────────────────────────────────────────
// These addresses are permanently banned from the platform.
// Anyone attempting to sign in / sign up with them is treated as a security
// threat: their IP + device fingerprint are captured, stored, and used to
// block all future requests from the same IP/device — even with a different
// email.
//
// DOMAINS: any email from a blocked domain is also banned. This catches
// variations like admin@, support@, hello@ on the same domain — without
// having to enumerate every possible local part.
const BLOCKED_EMAILS: ReadonlySet<string> = new Set(
  [
    // Known Sherwyn addresses
    "sherwynsingh888@gmail.com",
    "sherwyn@automagikal.co.za",
    // Additional Sherwyn aliases (Gmail — no domain to block, must list each)
    "helloautomagikal@gmail.com",
    "hellohypergrowth@gmail.com",
  ].map((e) => e.toLowerCase().trim()),
);

// Blocked domains — any email ending with @<domain> is banned.
// Lowercase, no leading @.
const BLOCKED_EMAIL_DOMAINS: ReadonlySet<string> = new Set(
  [
    "automagikal.co.za",
    "automagikal.com", // common TLD typosquat defense
  ].map((d) => d.toLowerCase().trim()),
);

export function isEmailBlocked(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.toLowerCase().trim();

  // 1. Exact email match
  if (BLOCKED_EMAILS.has(normalized)) return true;

  // 2. Domain match — extract domain after @
  const atIndex = normalized.lastIndexOf("@");
  if (atIndex === -1 || atIndex === normalized.length - 1) return false;
  const domain = normalized.slice(atIndex + 1);
  if (BLOCKED_EMAIL_DOMAINS.has(domain)) return true;

  return false;
}

export function getBlockedEmails(): string[] {
  return Array.from(BLOCKED_EMAILS);
}

export function getBlockedEmailDomains(): string[] {
  return Array.from(BLOCKED_EMAIL_DOMAINS);
}

// ─────────────────────────────────────────────────────────────────────────────
// IP EXTRACTION — gets the real client IP, even behind Vercel's CDN
// ─────────────────────────────────────────────────────────────────────────────
export function getClientIp(request: Request): string {
  const headers = request.headers;

  // Vercel provides the true client IP directly
  const vercelIp = headers.get("x-vercel-forwarded-for");
  if (vercelIp) {
    return vercelIp.split(",")[0].trim();
  }

  // Standard forwarded-for header
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    return xff.split(",")[0].trim();
  }

  // Real-IP fallback (some proxies set this)
  const realIp = headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }

  return "0.0.0.0";
}

// ─────────────────────────────────────────────────────────────────────────────
// DEVICE FINGERPRINT — stable hash of identifying headers
// ─────────────────────────────────────────────────────────────────────────────
// Not a perfect fingerprint (browser fingerprinting is a deep rabbit hole),
// but stable enough to catch repeat offenders using the same browser/device.
// Uses Web Crypto's subtle.digest for Edge Runtime compatibility.
export async function getDeviceFingerprint(request: Request): Promise<string> {
  const headers = request.headers;
  const parts: string[] = [
    headers.get("user-agent") ?? "",
    headers.get("accept-language") ?? "",
    headers.get("accept-encoding") ?? "",
    headers.get("sec-ch-ua") ?? "",
    headers.get("sec-ch-ua-platform") ?? "",
    headers.get("sec-ch-ua-mobile") ?? "",
    headers.get("sec-ch-ua-arch") ?? "",
    headers.get("sec-ch-ua-bitness") ?? "",
    headers.get("device-memory") ?? "",
  ].filter((s) => s.length > 0);

  const hash = await sha256(parts.join("|"));
  return hash.slice(0, 32); // 16 bytes is enough for fingerprinting
}

// ─────────────────────────────────────────────────────────────────────────────
// GEO — extract country code (Vercel provides x-vercel-ip-country)
// ─────────────────────────────────────────────────────────────────────────────
export function getCountryCode(request: Request): string | null {
  return request.headers.get("x-vercel-ip-country");
}

// Geo-blocked countries — currently South Africa
const GEO_BLOCKED_COUNTRIES: ReadonlySet<string> = new Set(["ZA"]);

export function isCountryBlocked(country: string | null | undefined): boolean {
  if (!country) return false;
  return GEO_BLOCKED_COUNTRIES.has(country.toUpperCase());
}

// ─────────────────────────────────────────────────────────────────────────────
// BOT / SCRAPER DETECTION — block obvious scrapers and downloaders
// ─────────────────────────────────────────────────────────────────────────────
const BLOCKED_USER_AGENTS: RegExp[] = [
  /^curl/i,
  /^wget/i,
  /^python-requests/i,
  /^python-urllib/i,
  /^httpclient/i,
  /^okhttp/i,
  /^go-http-client/i,
  /^java\//i,
  /^libwww/i,
  /^scrapy/i,
  /^httpx/i,
  /^axios/i,
  /^node-fetch/i,
  /^postmanruntime/i,
  /^insomnia/i,
];

export function isBotUserAgent(userAgent: string | null): boolean {
  if (!userAgent) return true; // Empty UA = treat as bot
  return BLOCKED_USER_AGENTS.some((re) => re.test(userAgent));
}

// ─────────────────────────────────────────────────────────────────────────────
// PROTECTED ASSETS — direct client download blocked, must come via Referer
// ─────────────────────────────────────────────────────────────────────────────
// These are the high-value brand assets that should NEVER be served as direct
// downloads. They are only served inline when the request originates from a
// same-origin page (Referer matches our host).
export const PROTECTED_ASSETS: ReadonlySet<string> = new Set([
  "/logo.png",
  "/logo-full.png",
  "/favicon.png",
  "/apple-touch-icon.png",
  "/logo.svg",
  "/metabuilder-logo.png",
]);

export function isProtectedAsset(pathname: string): boolean {
  return PROTECTED_ASSETS.has(pathname.toLowerCase());
}

// ─────────────────────────────────────────────────────────────────────────────
// IN-MEMORY BLOCKED IP / DEVICE CACHE (with TTL)
// ─────────────────────────────────────────────────────────────────────────────
// The DB is the source of truth, but checking it on every request is expensive
// AND would blow the edge function size limit (Prisma client is huge).
// Instead: middleware uses this in-memory cache only, and a separate Node.js
// API route (/api/security/*) handles DB persistence.
//
// Cache misses fall through to "allow" — the next request from a blocked
// IP/device will be caught once the cache is populated (by the API route
// or by an in-process block from the email blocklist check).
type BlockCacheEntry = { ts: number; reason: string };
const ipBlockCache = new Map<string, BlockCacheEntry>();
const deviceBlockCache = new Map<string, BlockCacheEntry>();
const BLOCK_CACHE_TTL_MS = 5 * 60_000; // 5 minutes

export function isIpCachedBlocked(ip: string): string | null {
  const entry = ipBlockCache.get(ip);
  if (!entry) return null;
  if (Date.now() - entry.ts > BLOCK_CACHE_TTL_MS) {
    ipBlockCache.delete(ip);
    return null;
  }
  return entry.reason;
}

export function cacheIpBlock(ip: string, reason: string): void {
  ipBlockCache.set(ip, { ts: Date.now(), reason });
}

export function isDeviceCachedBlocked(deviceId: string): string | null {
  const entry = deviceBlockCache.get(deviceId);
  if (!entry) return null;
  if (Date.now() - entry.ts > BLOCK_CACHE_TTL_MS) {
    deviceBlockCache.delete(deviceId);
    return null;
  }
  return entry.reason;
}

export function cacheDeviceBlock(deviceId: string, reason: string): void {
  deviceBlockCache.set(deviceId, { ts: Date.now(), reason });
}

/**
 * Check if an IP or device is blocked.
 *
 * Two-tier check:
 *   1. FAST PATH: in-memory cache (5-min TTL) — handles repeat requests
 *      without any DB call.
 *   2. SLOW PATH: if cache misses, calls /api/security/check-blocked
 *      (Node.js runtime, Prisma access) to query the blocked_ips table.
 *      On DB hit, populates the cache so subsequent requests are fast.
 *
 * The slow path is ASYNC. Middleware awaits it. To avoid blocking every
 * request on a DB query, the cache is critical — once an IP is checked
 * once, the result is cached for 5 minutes.
 *
 * IMPORTANT: A first-time request from a newly-blocked IP will NOT be
 * caught (cache miss + DB query happens, but the request continues while
 * the query is in flight). The SECOND request from the same IP will be
 * blocked (cache hit). This is an acceptable trade-off for performance.
 *
 * URL STRATEGY: We use a relative-style approach by passing the request
 * URL. The middleware caller passes the request so we can extract the
 * origin. This avoids hardcoding the production URL (which would break
 * in preview deployments) AND avoids creating a recursive edge call
 * (fetch to pitchcoachai.tech from within edge middleware = the request
 * goes back out to the internet and comes back in through the edge,
 * triggering middleware again).
 *
 * To break the recursion, we use a special header x-internal-security-check
 * that the middleware recognizes and skips the security checks for.
 */
// Module-level cache of the origin URL — set on first call from middleware
let securityCheckUrl: string | null = null;

export function setSecurityCheckOrigin(request: Request): void {
  if (securityCheckUrl) return; // Already set
  try {
    const url = new URL(request.url);
    securityCheckUrl = `${url.origin}/api/security/check-blocked`;
  } catch {
    // Fallback to production URL if URL parsing fails
    securityCheckUrl = "https://pitchcoachai.tech/api/security/check-blocked";
  }
}

export async function isBlocked(ip: string, deviceId: string): Promise<string | null> {
  // FAST PATH: in-memory cache
  const cachedIp = isIpCachedBlocked(ip);
  if (cachedIp) return cachedIp;
  const cachedDevice = isDeviceCachedBlocked(deviceId);
  if (cachedDevice) return cachedDevice;

  // SLOW PATH: query DB via internal API endpoint
  const url = securityCheckUrl ?? "https://pitchcoachai.tech/api/security/check-blocked";

  try {
    // Manual timeout — AbortSignal.timeout() may not be available in all
    // edge runtime versions. Use AbortController for broader compatibility.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Special header — middleware recognizes this and SKIPS all
        // security checks for this request. This prevents infinite
        // recursion (edge middleware → fetch → edge middleware → ...).
        "x-internal-security-check": "1",
      },
      body: JSON.stringify({ ip, deviceId }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) return null; // DB error — fail open

    const data = (await response.json()) as { blocked?: boolean; reason?: string | null };

    if (data.blocked && data.reason) {
      // Populate the cache so subsequent requests are fast
      cacheIpBlock(ip, data.reason);
      if (deviceId) cacheDeviceBlock(deviceId, data.reason);
      return data.reason;
    }
  } catch {
    // Network error, timeout, or parse error — fail open
    // (don't block legit users because of a transient error)
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// DB OPS — fire-and-forget fetch to /api/security/* (Node.js runtime)
// ─────────────────────────────────────────────────────────────────────────────
// We CAN'T import Prisma here (edge bundle size). Instead, we POST to an
// internal API route that runs on Node.js runtime and has full Prisma access.
// All calls are fire-and-forget — failures are silently swallowed so the
// site never crashes due to logging issues.

export interface SecurityIncidentRecord {
  email?: string | null;
  ip: string;
  deviceId: string;
  userAgent?: string | null;
  reason: string;
  pathname?: string | null;
  country?: string | null;
  metadata?: Record<string, unknown> | null;
  blocked?: boolean;
}

/**
 * Log a security incident to the DB (via internal API route).
 * Fire-and-forget — failures are silently swallowed.
 *
 * NOTE: This function does NOT cache the IP/device as blocked — that's
 * intentional. Logging an incident is an OBSERVATION (e.g., "this IP
 * hit /sign-in during maintenance"), not a block. If we cached every
 * observation as a block, every probe / geo-block / bot detection would
 * 5-minute-ban the IP — which would cause false positives for normal
 * users who happen to hit an asset URL directly or visit /sign-in.
 *
 * To actually BLOCK an IP (cache + persist), call blockIp() instead.
 */
export function logSecurityIncident(record: SecurityIncidentRecord): void {
  // Fire-and-forget POST to internal API route
  // (use waitUntil pattern via fetch + .catch — edge runtime may not
  // wait for this to complete, but that's OK for incident logging)
  try {
    fetch("https://pitchcoachai.tech/api/security/log-incident", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record),
    }).catch(() => { /* swallow */ });
  } catch {
    /* swallow */
  }
}

/**
 * Add an IP to the persistent blocklist (via internal API route).
 * Fire-and-forget.
 */
export function blockIp(opts: {
  ip: string;
  deviceId?: string;
  email?: string;
  reason: string;
}): void {
  cacheIpBlock(opts.ip, opts.reason);
  if (opts.deviceId) cacheDeviceBlock(opts.deviceId, opts.reason);

  try {
    fetch("https://pitchcoachai.tech/api/security/block-ip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(opts),
    }).catch(() => { /* swallow */ });
  } catch {
    /* swallow */
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECURITY HEADERS — used by middleware to add per-response headers
// ─────────────────────────────────────────────────────────────────────────────
export const SECURITY_HEADERS: Record<string, string> = {
  // Clickjacking prevention
  "X-Frame-Options": "DENY",
  // MIME-type sniffing prevention
  "X-Content-Type-Options": "nosniff",
  // Referrer leakage prevention
  "Referrer-Policy": "strict-origin-when-cross-origin",
  // Strict HSTS with preload
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  // Disable DNS prefetching (prevents DNS rebinding attacks)
  "X-DNS-Prefetch-Control": "off",
  // Disable browser features we don't use
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(), interest-cohort=(), browsing-topics=(), clipboard-read=(), clipboard-write=(self), payment=()",
  // Cross-origin isolation (prevents side-channel attacks like Spectre)
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "credentialless",
  "Cross-Origin-Resource-Policy": "same-origin",
  // Prevent download dialog auto-trigger
  "Content-Disposition": "inline",
  // Don't allow search engines to cache copies of our pages
  "X-Robots-Tag": "noindex, noarchive, nosnippet, noimageindex",
};
