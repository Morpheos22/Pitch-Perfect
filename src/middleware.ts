import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
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
 * FLOW:
 * 1. Rate limit API routes first
 * 2. Protect non-public routes (require Clerk auth)
 * 3. Check onboarding: if user hasn't completed it, redirect to /onboarding
 *    - Admin emails in dev mode: only redirect if onboardingCompleted is explicitly false
 *    - All other users: redirect if onboardingCompleted is not true
 *    - IMPORTANT: /onboarding itself is NOT protected, so no redirect loop
 */
export default clerkMiddleware(async (auth, request) => {
  const pathname = new URL(request.url).pathname;

  // ── Rate Limiting ──
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
  // Single auth() call to get both userId and sessionClaims
  const authResult = await auth();
  const userId = authResult.userId;

  if (userId && !isOnboardingOrApi(request) && !isPublicRoute(request)) {
    const claims = authResult.sessionClaims;
    const publicMeta = claims?.public_metadata as { onboardingCompleted?: boolean } | undefined;
    const onboardingCompleted = publicMeta?.onboardingCompleted === true;

    // Admin emails in dev mode: respect their chosen mode
    if (process.env.NODE_ENV === "development") {
      const email = claims?.email as string | undefined;
      if (email && isAdminEmail(email) && onboardingCompleted) {
        return NextResponse.next();
      }
    }

    // All other authenticated users: redirect to onboarding if not completed
    if (!onboardingCompleted) {
      const url = new URL("/onboarding", request.url);
      return NextResponse.redirect(url);
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
