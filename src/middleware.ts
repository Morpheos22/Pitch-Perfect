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
  "/api/user/sync",
]);

// Routes that should not redirect to onboarding
const isOnboardingOrApi = createRouteMatcher([
  "/onboarding(.*)",
  "/api(.*)",
]);

/**
 * Auth middleware with onboarding redirect.
 *
 * RULES:
 * 1. Public routes → no auth required
 * 2. API routes → no onboarding redirect (but auth required for non-public APIs)
 * 3. Onboarding page → no redirect (prevents infinite loop)
 * 4. Admin emails (Helloautomagikal@gmail.com, Morphylee22@gmail.com) → ALWAYS bypass onboarding
 * 5. All other users → redirect to /onboarding if onboardingCompleted is not true
 *
 * Uses a HYBRID approach:
 * - Fast path: check JWT claims (zero latency)
 * - Slow path: call Clerk API for fresh user data if JWT is inconclusive
 * - This handles stale JWTs where claims were issued before metadata was set
 */
export default clerkMiddleware(async (auth, request) => {
  const pathname = new URL(request.url).pathname;

  // ── Rate Limiting (API routes only) ──
  if (pathname.startsWith("/api/")) {
    let userId: string | undefined;
    try {
      const authResult = await auth();
      userId = authResult.userId || undefined;
    } catch {
      userId = undefined;
    }
    const rateLimitResponse = rateLimitMiddleware(request, userId);
    if (rateLimitResponse) return rateLimitResponse;
  }

  // ── Auth protection ──
  if (!isPublicRoute(request)) {
    auth.protect();
  }

  // ── Onboarding redirect ──
  const authResult = await auth();
  const userId = authResult.userId;

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
        return NextResponse.next();
      }
    }

    // SLOW PATH: JWT is stale, missing, or inconclusive — ask Clerk API directly
    try {
      const client = await clerkClient();
      const user = await client.users.getUser(userId);

      // Admin bypass via Clerk API (always fresh)
      const email = user.emailAddresses[0]?.emailAddress;
      if (email && isAdminEmail(email)) {
        return NextResponse.next();
      }

      // Check onboarding status from live user metadata
      const onboardingCompleted =
        user.publicMetadata?.onboardingCompleted === true;
      if (!onboardingCompleted) {
        const url = new URL("/onboarding", request.url);
        return NextResponse.redirect(url);
      }
    } catch (error) {
      console.error("[middleware] Onboarding check error:", error);
      // Fail-open: if Clerk API is unreachable, let the request through
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
