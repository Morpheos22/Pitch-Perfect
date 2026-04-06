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
 * RULES:
 * 1. Public routes → no auth required
 * 2. API routes → no onboarding redirect (but auth required for non-public APIs)
 * 3. Onboarding page → no redirect (prevents infinite loop)
 * 4. Admin emails (Helloautomagikal@gmail.com, Morphylee22@gmail.com) → ALWAYS bypass onboarding
 * 5. All other users → redirect to /onboarding if onboardingCompleted is not true
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
  const authResult = await auth();
  const userId = authResult.userId;

  if (userId && !isOnboardingOrApi(request) && !isPublicRoute(request)) {
    const claims = authResult.sessionClaims;
    const publicMeta = claims?.public_metadata as { onboardingCompleted?: boolean } | undefined;
    const onboardingCompleted = publicMeta?.onboardingCompleted === true;

    // Admin emails: ALWAYS bypass onboarding (works in ALL environments)
    const email = claims?.email as string | undefined;
    if (email && isAdminEmail(email)) {
      return NextResponse.next();
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
