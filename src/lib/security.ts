/**
 * Security library — IP extraction, device fingerprinting, blocked-IP/email checks.
 *
 * Used by middleware.ts to gate every request before reaching app logic.
 * Falls back gracefully if DATABASE_URL is unavailable (e.g. preview envs):
 * in-memory caches still operate so the site never goes down due to DB issues.
 */

import { createHash } from "crypto";

// ─────────────────────────────────────────────────────────────────────────────
// BLOCKED EMAILS — permanent blocklist
// ─────────────────────────────────────────────────────────────────────────────
// These addresses are permanently banned from the platform.
// Anyone attempting to sign in / sign up with them is treated as a security
// threat: their IP + device fingerprint are captured, stored, and used to
// block all future requests from the same IP/device — even with a different
// email.
const BLOCKED_EMAILS: ReadonlySet<string> = new Set(
  [
    "sherwynsingh888@gmail.com",
    "sherwyn@automagikal.co.za",
  ].map((e) => e.toLowerCase().trim()),
);

export function isEmailBlocked(email: string | null | undefined): boolean {
  if (!email) return false;
  return BLOCKED_EMAILS.has(email.toLowerCase().trim());
}

export function getBlockedEmails(): string[] {
  return Array.from(BLOCKED_EMAILS);
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
export function getDeviceFingerprint(request: Request): string {
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

  return createHash("sha256")
    .update(parts.join("|"))
    .digest("hex")
    .slice(0, 32); // 16 bytes is enough for fingerprinting
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
// The DB is the source of truth, but checking it on every request is expensive.
// This cache stores recently-blocked IPs/devices for 5 minutes so we can fast-
// path deny without hitting the DB. Cache misses fall through to DB lookup.
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

// ─────────────────────────────────────────────────────────────────────────────
// DB OPS — wrapped in try/catch so failures never break the site
// ─────────────────────────────────────────────────────────────────────────────
// We use dynamic import of @prisma/client to avoid loading the Prisma client
// on every cold start of middleware (which would slow down all requests).
// If Prisma isn't available (e.g. DATABASE_URL not set), we fall back to
// in-memory caching only — the site stays up, the blocklist is just less
// durable across cold starts.

let prismaClient: any | null = null;
let prismaInitFailed = false;

async function getPrisma(): Promise<any | null> {
  if (prismaInitFailed) return null;
  if (prismaClient) return prismaClient;

  try {
    // Dynamic import prevents bundling Prisma client into the middleware edge
    // runtime if it's not available. This is critical for build performance.
    const mod = await import("@prisma/client");
    prismaClient = new mod.PrismaClient({
      log: ["error"],
    });
    return prismaClient;
  } catch (err) {
    console.warn("[security] Prisma client unavailable, using in-memory only:", err);
    prismaInitFailed = true;
    return null;
  }
}

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
 * Log a security incident to the DB.
 * Failures are silently swallowed — the site must not crash due to logging issues.
 */
export async function logSecurityIncident(
  record: SecurityIncidentRecord,
): Promise<void> {
  // Always update the in-memory cache too — if the user tries again within 5
  // minutes, we want the block to be instant.
  cacheIpBlock(record.ip, record.reason);
  cacheDeviceBlock(record.deviceId, record.reason);

  const prisma = await getPrisma();
  if (!prisma) return;

  try {
    await prisma.securityIncident.create({
      data: {
        email: record.email ?? null,
        ip: record.ip,
        deviceId: record.deviceId,
        userAgent: record.userAgent ?? null,
        reason: record.reason,
        pathname: record.pathname ?? null,
        country: record.country ?? null,
        metadata: record.metadata ?? undefined,
        blocked: record.blocked ?? false,
      },
    });
  } catch (err) {
    // Don't let a missing table crash the site. Log and move on.
    console.warn("[security] Failed to log incident:", err);
  }
}

/**
 * Add an IP to the persistent blocklist.
 */
export async function blockIp(opts: {
  ip: string;
  deviceId?: string;
  email?: string;
  reason: string;
}): Promise<void> {
  cacheIpBlock(opts.ip, opts.reason);
  if (opts.deviceId) cacheDeviceBlock(opts.deviceId, opts.reason);

  const prisma = await getPrisma();
  if (!prisma) return;

  try {
    await prisma.blockedIp.upsert({
      where: { ip: opts.ip },
      create: {
        ip: opts.ip,
        deviceId: opts.deviceId ?? null,
        email: opts.email ?? null,
        reason: opts.reason,
        attempts: 1,
      },
      update: {
        attempts: { increment: 1 },
        lastSeen: new Date(),
        ...(opts.deviceId ? { deviceId: opts.deviceId } : {}),
        ...(opts.email ? { email: opts.email } : {}),
      },
    });
  } catch (err) {
    console.warn("[security] Failed to persist block:", err);
  }
}

/**
 * Check if an IP or device is in the persistent blocklist.
 * Checks in-memory cache first (fast path), then DB.
 */
export async function isBlocked(ip: string, deviceId: string): Promise<string | null> {
  // Fast path: in-memory cache
  const cachedIp = isIpCachedBlocked(ip);
  if (cachedIp) return cachedIp;
  const cachedDevice = isDeviceCachedBlocked(deviceId);
  if (cachedDevice) return cachedDevice;

  // Slow path: DB lookup
  const prisma = await getPrisma();
  if (!prisma) return null;

  try {
    const record = await prisma.blockedIp.findFirst({
      where: {
        OR: [{ ip }, { deviceId }],
        permanent: true,
      },
      select: { reason: true, ip: true },
    });

    if (record) {
      // Update cache so subsequent requests are fast
      cacheIpBlock(ip, record.reason);
      if (deviceId) cacheDeviceBlock(deviceId, record.reason);
      return record.reason;
    }
  } catch (err) {
    console.warn("[security] Failed to query blocklist:", err);
  }

  return null;
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
