import { clerkMiddleware, createRouteMatcher, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { rateLimitMiddleware } from "@/lib/rate-limit";
import { isAdminEmail } from "@/lib/dev-auth";

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
  "/api/user/onboarding",
  "/api/user/sync",
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
  const pathname = new URL(request.url).pathname;

  // ── Auth: call ONCE and reuse result ──
  const authResult = await auth();
  const userId = authResult.userId;

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
          return response;
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
      return response;
    }
    // cachedStatus === false → user is valid, continue normally
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
    if (rateLimitResponse) return rateLimitResponse;
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
        return NextResponse.next();
      }

      // If JWT clearly says onboarding is completed, skip the slow check
      if (onboardingCompleted) {
        setCachedOnboarding(userId, true);
        return NextResponse.next();
      }
    }

    // CACHE PATH: Check in-memory cache before hitting Clerk API
    const cached = getCachedOnboarding(userId);
    if (cached === true) {
      return NextResponse.next();
    }
    if (cached === false) {
      const url = new URL("/onboarding", request.url);
      return NextResponse.redirect(url);
    }

    // SLOW PATH: JWT is stale/missing AND no cache — ask Clerk API with timeout
    try {
      const client = await clerkClient();
      const user = await withTimeout(client.users.getUser(userId), 5000);

      // Admin bypass via Clerk API (always fresh)
      const email = user.emailAddresses[0]?.emailAddress;
      if (email && isAdminEmail(email)) {
        setCachedOnboarding(userId, true);
        return NextResponse.next();
      }

      // Check onboarding status from live user metadata
      const onboardingCompleted =
        user.publicMetadata?.onboardingCompleted === true;

      setCachedOnboarding(userId, onboardingCompleted);

      if (!onboardingCompleted) {
        const url = new URL("/onboarding", request.url);
        return NextResponse.redirect(url);
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

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
