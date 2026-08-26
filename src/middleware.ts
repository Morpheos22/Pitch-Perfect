import { clerkMiddleware, createRouteMatcher, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { rateLimitMiddleware } from "@/lib/rate-limit";
import { isAdminEmail } from "@/lib/dev-auth";
import {
  getClientIp,
  getDeviceFingerprint,
  getCountryCode,
  isCountryBlocked,
  isBotUserAgent,
  isProtectedAsset,
  isEmailBlocked,
  isBlocked,
  logSecurityIncident,
  blockIp,
  SECURITY_HEADERS,
} from "@/lib/security";

// ─────────────────────────────────────────────────────────────────────────────
// MAINTENANCE MODE
// ─────────────────────────────────────────────────────────────────────────────
// Hard-coded ON while we rebuild the product. To bring the site back up, set
// MAINTENANCE_FORCE_ON = false below (or set MAINTENANCE_MODE=false in Vercel
// env vars to override at runtime without a redeploy).
//
// When maintenance is active:
//   - /maintenance.html            → served directly by Vercel CDN
//   - /_next/* + static assets     → served normally (matcher already excludes)
//   - /api/health*                 → 200 OK (so uptime monitors don't alert)
//   - /api/* (everything else)     → 503 JSON + Retry-After: 3600
//   - All other routes (HTML/auth) → 307 redirect to /maintenance.html
// ─────────────────────────────────────────────────────────────────────────────

// TEMPORARY: hard toggle while we rebuild. Flip to false to bring the site back.
const MAINTENANCE_FORCE_ON = true;

function isMaintenanceEnabled(): boolean {
  // Env var takes precedence so ops can override at runtime without redeploy.
  // - MAINTENANCE_MODE=true  → always ON (explicit override)
  // - MAINTENANCE_MODE=false → always OFF (explicit override)
  // - MAINTENANCE_MODE unset → fall back to MAINTENANCE_FORCE_ON constant
  const env = process.env.MAINTENANCE_MODE;
  if (env === "true") return true;
  if (env === "false") return false;
  return MAINTENANCE_FORCE_ON;
}

function maintenanceResponse(request: Request): NextResponse {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Always allow health checks so uptime monitors don't fire false alarms.
  if (pathname === "/api/health" || pathname.startsWith("/api/health/")) {
    return NextResponse.next();
  }

  // API routes: return 503 Service Unavailable with JSON body.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      {
        error: "service_unavailable",
        message:
          "Pitch-Perfect is currently undergoing scheduled maintenance. Please check back soon.",
      },
      {
        status: 503,
        headers: {
          "Retry-After": "3600", // 1 hour
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      },
    );
  }

  // All other HTML/page/auth routes: redirect to the static maintenance page.
  // Use 307 to preserve method (in case of POST from a stale form somewhere).
  const maintenanceUrl = new URL("/maintenance.html", request.url);
  const redirect = NextResponse.redirect(maintenanceUrl, 307);
  redirect.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  return redirect;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECURITY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

// Paths that are exempt from security hardening checks (must always be reachable)
const SECURITY_EXEMPT_PREFIXES = [
  "/maintenance.html",
  "/api/health",
];

function isSecurityExempt(pathname: string): boolean {
  return SECURITY_EXEMPT_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p));
}

// Apply security headers to a NextResponse (defense in depth — next.config.ts
// also sets these globally, but middleware can override per-route if needed)
function applySecurityHeaders(response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    // Don't override if already set (e.g. by route handler)
    if (!response.headers.has(key)) {
      response.headers.set(key, value);
    }
  }
  return response;
}

// Build a 403 response for blocked IPs / bots / scrapers
function blockedResponse(request: Request, reason: string): NextResponse {
  const pathname = new URL(request.url).pathname;
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      {
        error: "forbidden",
        message: "Access denied.",
      },
      { status: 403 },
    );
  }
  // For HTML routes: return a minimal 403 page
  return new NextResponse(
    `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>403 — Access Denied</title>` +
      `<meta name="viewport" content="width=device-width, initial-scale=1">` +
      `<style>body{font-family:system-ui,sans-serif;background:#0B0F1A;color:#E8ECF4;` +
      `display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:1.5rem}` +
      `div{max-width:480px;text-align:center}h1{font-size:2.5rem;margin:0 0 1rem}` +
      `p{color:#A0AAC0;line-height:1.6}</style></head><body><div>` +
      `<h1>403</h1><p>Access to this resource is denied.</p>` +
      `<p>If you believe this is an error, contact <a href="mailto:Morpheos@cc.cc" style="color:#6FE7C5">Morpheos@cc.cc</a>.</p>` +
      `</div></body></html>`,
    {
      status: 403,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    },
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GEO-BLOCK — redirect South African IPs to motionmuse.ai
// ─────────────────────────────────────────────────────────────────────────────
async function handleGeoBlock(request: Request): Promise<NextResponse | null> {
  const country = getCountryCode(request);
  if (!country) return null; // No geo info (likely local dev)
  if (!isCountryBlocked(country)) return null;

  const pathname = new URL(request.url).pathname;
  const ip = getClientIp(request);
  const deviceId = await getDeviceFingerprint(request);

  // Log the geo-block incident (fire-and-forget)
  logSecurityIncident({
    ip,
    deviceId,
    reason: "GEO_BLOCK",
    pathname,
    country,
    userAgent: request.headers.get("user-agent"),
    metadata: { country, redirectTo: "https://motionmuse.ai/explore" },
    blocked: false, // Geo blocks aren't permanent — just redirected
  });

  // API: return 451 Unavailable For Legal Reasons
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      {
        error: "geo_restricted",
        message: "This service is not available in your region.",
      },
      { status: 451 },
    );
  }

  // HTML: 307 redirect to motionmuse.ai/explore
  const redirect = NextResponse.redirect("https://motionmuse.ai/explore", 307);
  redirect.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  return redirect;
}

// ─────────────────────────────────────────────────────────────────────────────
// BOT / SCRAPER BLOCKING
// ─────────────────────────────────────────────────────────────────────────────
async function handleBotBlock(request: Request): Promise<NextResponse | null> {
  const userAgent = request.headers.get("user-agent");
  if (!isBotUserAgent(userAgent)) return null;

  const pathname = new URL(request.url).pathname;
  const ip = getClientIp(request);
  const deviceId = await getDeviceFingerprint(request);

  // Log the bot block
  logSecurityIncident({
    ip,
    deviceId,
    reason: "SCRAPER",
    pathname,
    userAgent: userAgent ?? undefined,
    metadata: { userAgent },
    blocked: false,
  });

  return blockedResponse(request, "SCRAPER");
}

// ─────────────────────────────────────────────────────────────────────────────
// PROTECTED ASSET — block direct access to brand assets
// ─────────────────────────────────────────────────────────────────────────────
// Allows access only when the request includes a same-origin Referer (i.e.
// the asset is being loaded by one of our HTML pages, not downloaded directly).
async function handleProtectedAsset(request: Request): Promise<NextResponse | null> {
  const pathname = new URL(request.url).pathname;
  if (!isProtectedAsset(pathname)) return null;

  const referer = request.headers.get("referer");
  const host = new URL(request.url).host;

  // Allow if Referer is from same host (loaded by our HTML pages)
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      if (refererUrl.host === host) {
        return null; // Same-origin request — allow
      }
    } catch {
      // Invalid Referer — treat as direct access
    }
  }

  // Block direct access — log incident
  const ip = getClientIp(request);
  const deviceId = await getDeviceFingerprint(request);
  logSecurityIncident({
    ip,
    deviceId,
    reason: "DIRECT_ASSET_ACCESS",
    pathname,
    userAgent: request.headers.get("user-agent") ?? undefined,
    metadata: { referer: referer ?? null },
    blocked: false,
  });

  return blockedResponse(request, "DIRECT_ASSET_ACCESS");
}

// ─────────────────────────────────────────────────────────────────────────────
// EMAIL BLOCKLIST — check signed-in user's email against blocklist
// ─────────────────────────────────────────────────────────────────────────────
// If signed-in user's email matches the blocklist:
// 1. Capture IP + device fingerprint, persist to BlockedIp table
// 2. Sign out the user (clear session cookies)
// 3. Redirect to /sign-in with error
// This runs AFTER auth() so we have access to the user's email via JWT claims.
async function handleEmailBlocklist(
  request: Request,
  authResult: { userId: string | null; sessionClaims: unknown },
): Promise<NextResponse | null> {
  if (!authResult.userId) return null;

  const claims = authResult.sessionClaims as
    | { email?: string }
    | undefined;
  const email = claims?.email;
  if (!email) return null;

  if (!isEmailBlocked(email)) return null;

  // BLOCKED EMAIL DETECTED — capture IP + device, persist block
  const ip = getClientIp(request);
  const deviceId = await getDeviceFingerprint(request);
  const pathname = new URL(request.url).pathname;
  const country = getCountryCode(request);

  console.warn(`[security] Blocked email attempt: email=${email} ip=${ip} device=${deviceId} path=${pathname}`);

  // Log incident + persist IP/device block (fire-and-forget)
  logSecurityIncident({
    email,
    ip,
    deviceId,
    reason: "BLOCKED_EMAIL",
    pathname,
    country,
    userAgent: request.headers.get("user-agent"),
    metadata: { email, blocked: true },
    blocked: true,
  });
  blockIp({ ip, deviceId, email, reason: "BLOCKED_EMAIL" });

  // Sign out: redirect to /sign-in with cleared cookies
  const url = new URL("/sign-in?reason=blocked_account", request.url);
  const response = NextResponse.redirect(url);
  response.headers.set(
    "Set-Cookie",
    "__client=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax, __session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax",
  );
  return response;
}

// ─────────────────────────────────────────────────────────────────────────────
// IP / DEVICE BLOCKLIST — check if request comes from a blocked source
// ─────────────────────────────────────────────────────────────────────────────
// Uses in-memory cache only (no DB call from middleware — that would require
// Prisma in the edge bundle and blow the 1 MB size limit). The cache is
// populated by handleEmailBlocklist() in-process, and by the
// /api/security/block-ip endpoint when called by other Node.js contexts.
function handleIpBlocklist(request: Request, deviceId: string): NextResponse | null {
  const ip = getClientIp(request);

  const blockReason = isBlocked(ip, deviceId);
  if (!blockReason) return null;

  // Log repeat attempt (for forensic analysis)
  const pathname = new URL(request.url).pathname;
  logSecurityIncident({
    ip,
    deviceId,
    reason: "BLOCKED_IP",
    pathname,
    country: getCountryCode(request) ?? undefined,
    userAgent: request.headers.get("user-agent"),
    metadata: { originalReason: blockReason },
    blocked: true,
  });

  return blockedResponse(request, "BLOCKED_IP");
}

// Public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/pricing",
  "/about",
  "/contact",
  "/blog(.*)",
  "/privacy",
  "/terms",
  "/cookies",
  "/api/webhooks(.*)",
  "/api/health",
  "/api/contact",
  // NOTE: /api/user/onboarding and /api/user/sync removed from public routes.
  // These routes have their own auth() checks internally, but the middleware
  // should still enforce auth.protect() to ensure consistent security posture
  // and prevent unauthenticated requests from reaching the handlers at all.
]);

// Routes that should not redirect to onboarding
const isOnboardingOrApi = createRouteMatcher([
  "/onboarding(.*)",
  "/api(.*)",
]);

// ── In-memory onboarding cache (per-instance, avoids repeated Clerk API calls) ──
// Key: clerkUserId, Value: { completed: boolean; ts: number }
const onboardingCache = new Map<string, { completed: boolean; ts: number }>();
const CACHE_TTL_MS = 60_000; // Cache for 60 seconds

function getCachedOnboarding(userId: string): boolean | null {
  const entry = onboardingCache.get(userId);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    onboardingCache.delete(userId);
    return null;
  }
  return entry.completed;
}

function setCachedOnboarding(userId: string, completed: boolean): void {
  onboardingCache.set(userId, { completed, ts: Date.now() });
  // Prune old entries to prevent memory leak
  if (onboardingCache.size > 10_000) {
    const now = Date.now();
    for (const [key, val] of onboardingCache) {
      if (now - val.ts > CACHE_TTL_MS) onboardingCache.delete(key);
    }
  }
}

// ── Timeout wrapper for Clerk API calls ──
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Clerk API call timed out after ${ms}ms`)), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

// ── Orphaned session cache ──
// Key: clerkUserId, Value: true = orphaned (deleted from Clerk), false = valid
const orphanSessionCache = new Map<string, boolean>();
const ORPHAN_CACHE_TTL_MS = 300_000; // 5 minutes — re-validate periodically

export default clerkMiddleware(async (auth, request) => {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // ── MAINTENANCE MODE (must be first check) ──
  // When enabled, short-circuit ALL Clerk/auth/onboarding/security logic.
  // Site stays fully offline (including API + auth endpoints) without depending
  // on Clerk being reachable.
  if (isMaintenanceEnabled()) {
    return applySecurityHeaders(maintenanceResponse(request));
  }

  // ── Security hardening layers (run for all non-exempt paths) ──
  // Order: bot check → geo-block → IP blocklist → protected asset
  // All checks log incidents to the security_incidents table (when DB available)
  // and skip the maintenance page + health endpoints.
  if (!isSecurityExempt(pathname)) {
    // Pre-compute device fingerprint once — used by all handlers below
    const deviceId = await getDeviceFingerprint(request);

    // 1. Bot / scraper detection — block curl, wget, python-requests, etc.
    const botResponse = await handleBotBlock(request);
    if (botResponse) return applySecurityHeaders(botResponse);

    // 2. Geo-block — redirect South African IPs to motionmuse.ai
    const geoResponse = await handleGeoBlock(request);
    if (geoResponse) return applySecurityHeaders(geoResponse);

    // 3. IP / device blocklist — check if this IP/device is permanently banned
    const ipBlockResponse = handleIpBlocklist(request, deviceId);
    if (ipBlockResponse) return applySecurityHeaders(ipBlockResponse);

    // 4. Protected asset — block direct downloads of brand assets
    // (only fires for specific paths like /logo.png, /metabuilder-logo.png)
    const assetResponse = await handleProtectedAsset(request);
    if (assetResponse) return applySecurityHeaders(assetResponse);
  }

  // ── Auth: call ONCE and reuse result ──
  const authResult = await auth();
  const userId = authResult.userId;

  // ── EMAIL BLOCKLIST CHECK (post-auth) ──
  // If the signed-in user's email matches our blocklist, capture IP + device
  // fingerprint, persist to BlockedIp table, then sign them out.
  const emailBlockResponse = await handleEmailBlocklist(request, authResult);
  if (emailBlockResponse) return applySecurityHeaders(emailBlockResponse);

  // ── Stale/orphaned session detection ──
  // If Clerk returns a userId from a cookie but the user no longer exists in Clerk
  // (e.g., user was deleted from Clerk Dashboard but cookie remains), the browser
  // enters a half-auth limbo: SignedIn/SignedOut components both malfunction.
  // Fix: validate the session against Clerk API and force sign-in if orphaned.
  if (userId && !pathname.startsWith("/sign-in") && !pathname.startsWith("/sign-up") && !pathname.startsWith("/api/")) {
    const cachedStatus = orphanSessionCache.get(userId);

    // Only validate if not cached (undefined = never checked)
    // cachedStatus === false means user is valid, cachedStatus === true means orphaned
    if (cachedStatus === undefined) {
      try {
        const client = await clerkClient();
        await withTimeout(client.users.getUser(userId), 3000);
        // User exists — mark as valid
        orphanSessionCache.set(userId, false);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        if (errorMessage.includes("not found") || errorMessage.includes("404")) {
          // User deleted from Clerk — orphaned session
          console.warn(`[middleware] Orphaned session: userId=${userId} not found in Clerk. Clearing session.`);
          orphanSessionCache.set(userId, true);
          const url = new URL("/sign-in?reason=session_expired", request.url);
          const response = NextResponse.redirect(url);
          // Clear BOTH __client and __session cookies — Clerk uses both for session state.
          // Previously only __client was cleared, leaving __session behind and causing a
          // half-signed-out state where Clerk JS thinks the user is still partially authenticated.
          response.headers.set("Set-Cookie", "__client=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax, __session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax");
          return applySecurityHeaders(response);
        }
        // Network/timeout error — fail open, don't force logout
        console.warn(`[middleware] Clerk API unreachable during orphan check for ${userId}:`, errorMessage);
      }
    } else if (cachedStatus === true) {
      // Known orphaned — redirect to sign-in with session clear
      const url = new URL("/sign-in?reason=session_expired", request.url);
      const response = NextResponse.redirect(url);
      // Clear BOTH __client and __session cookies to prevent half-signed-out state
      response.headers.set("Set-Cookie", "__client=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax, __session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax");
      return applySecurityHeaders(response);
    }
    // cachedStatus === false → user is valid, continue normally
  }

  // ── Hard-block dev-only routes in production ──
  // These routes have their own DEV_MODE guards, but defense-in-depth:
  // block at the middleware level before any handler code runs.
  if (pathname.startsWith("/api/dev/") && process.env.NODE_ENV === 'production') {
    return applySecurityHeaders(
      NextResponse.json(
        { error: 'This endpoint is not available in production.' },
        { status: 403 },
      ),
    );
  }

  // ── Rate Limiting (API routes only) ──
  // Skip middleware rate limiting for routes that have their own withRateLimit()
  // wrapper — otherwise each request gets double-counted (middleware + route handler).
  const routesWithOwnRateLimit = [
    '/api/coach/script',
    '/api/coach/deck',
    '/api/coach/live',
    '/api/coach/full',
    '/api/coach/drills',
    '/api/coach/founder',
    '/api/coach/diagnostic',
    '/api/kal/',
  ];
  const hasOwnRateLimit = routesWithOwnRateLimit.some(r => pathname === r || pathname.startsWith(r + '/'));

  if (pathname.startsWith("/api/") && !hasOwnRateLimit) {
    const rateLimitResponse = await rateLimitMiddleware(request, userId ?? undefined);
    if (rateLimitResponse) return applySecurityHeaders(rateLimitResponse);
  }

  // ── Auth protection ──
  if (!isPublicRoute(request)) {
    auth.protect();
  }

  // ── Onboarding redirect ──
  if (userId && !isOnboardingOrApi(request) && !isPublicRoute(request)) {
    // FAST PATH: Check JWT claims first (zero latency)
    const claims = authResult.sessionClaims;
    if (claims) {
      const email = claims.email as string | undefined;
      const publicMeta = claims.public_metadata as
        | { onboardingCompleted?: boolean }
        | undefined;
      const onboardingCompleted = publicMeta?.onboardingCompleted === true;

      // Admin bypass via JWT
      if (email && isAdminEmail(email)) {
        return applySecurityHeaders(NextResponse.next());
      }

      // If JWT clearly says onboarding is completed, skip the slow check
      if (onboardingCompleted) {
        setCachedOnboarding(userId, true);
        return applySecurityHeaders(NextResponse.next());
      }
    }

    // CACHE PATH: Check in-memory cache before hitting Clerk API
    const cached = getCachedOnboarding(userId);
    if (cached === true) {
      return applySecurityHeaders(NextResponse.next());
    }
    if (cached === false) {
      const url = new URL("/onboarding", request.url);
      return applySecurityHeaders(NextResponse.redirect(url));
    }

    // SLOW PATH: JWT is stale/missing AND no cache — ask Clerk API with timeout
    try {
      const client = await clerkClient();
      const user = await withTimeout(client.users.getUser(userId), 5000);

      // Admin bypass via Clerk API (always fresh)
      const email = user.emailAddresses[0]?.emailAddress;
      if (email && isAdminEmail(email)) {
        setCachedOnboarding(userId, true);
        return applySecurityHeaders(NextResponse.next());
      }

      // Check onboarding status from live user metadata
      const onboardingCompleted =
        user.publicMetadata?.onboardingCompleted === true;

      setCachedOnboarding(userId, onboardingCompleted);

      if (!onboardingCompleted) {
        const url = new URL("/onboarding", request.url);
        return applySecurityHeaders(NextResponse.redirect(url));
      }
    } catch (error) {
      console.error("[middleware] Onboarding check error:", error);
      // Fail-OPEN: if Clerk API is unreachable or timed out, let the request through.
      // Fail-CLOSE (redirect to onboarding) caused infinite redirect loops when
      // the Clerk API was slow — the onboarding page itself would trigger the
      // same middleware check, which would timeout again, creating a loop.
      // Security trade-off: a non-onboarded user could briefly access the dashboard
      // during a Clerk outage, but this is better than locking out ALL users.
      // The next successful Clerk API call will correct the redirect.
    }
  }

  return applySecurityHeaders(NextResponse.next());
});

export const config = {
  matcher: [
    // Original matcher — everything except _next, static file extensions
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // API + tsc routes
    "/(api|trpc)(.*)",
    // NEW: Specific brand assets — middleware runs on these for hotlink protection.
    // Even though .png/.svg are excluded by the first matcher's negative lookahead,
    // this positive matcher ensures middleware runs on them so handleProtectedAsset()
    // can enforce Referer-based access control.
    "/(logo|logo-full|favicon|apple-touch-icon|metabuilder-logo)\\.(png|svg)",
  ],
};
