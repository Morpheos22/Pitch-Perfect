import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { rateLimitMiddleware } from "@/lib/rate-limit";

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
 * Dev Login Flow (development mode only):
 *
 * In development, the admin email (Helloautomagikal@gmail.com) can bypass the
 * onboarding requirement so the developer can access the full app immediately.
 * The /api/dev/impersonate endpoint is also exposed for debugging — it returns
 * subscription plan, usage stats, and Zoho contact ID for a given email.
 * These helpers are NO-OPs in production.
 */

export default clerkMiddleware(async (auth, request) => {
  const pathname = new URL(request.url).pathname;

  // ──────────────────────────────────────────
  // Rate Limiting (before auth protection)
  // ──────────────────────────────────────────
  // For API routes, check rate limits first.
  // We read the user ID (without protecting) so authenticated users
  // get per-user limits while anonymous requests fall back to IP.
  if (pathname.startsWith("/api/")) {
    let userId: string | undefined;

    try {
      const authResult = await auth();
      userId = authResult.userId || undefined;
    } catch {
      // Auth not available for this request (e.g., webhook with no session)
      userId = undefined;
    }

    const rateLimitResponse = rateLimitMiddleware(request, userId);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }
  }

  // Protect all non-public routes
  if (!isPublicRoute(request)) {
    auth.protect();
  }

  // Check onboarding status for authenticated users
  const { userId } = await auth();

  if (userId && !isOnboardingOrApi(request) && !isPublicRoute(request)) {
    // Get user's onboarding status from Clerk
    const claims = (await auth()).sessionClaims;
    const publicMeta = claims?.public_metadata as { onboardingCompleted?: boolean } | undefined;
    const onboardingCompleted = publicMeta?.onboardingCompleted;

    // In development mode, allow the admin email to bypass onboarding
    if (process.env.NODE_ENV === "development") {
      const email = claims?.email as string | undefined;
      if (email?.toLowerCase() === "helloautomagikal@gmail.com") {
        return NextResponse.next();
      }
    }

    // Redirect to onboarding if not completed
    if (!onboardingCompleted) {
      const onboardingUrl = new URL("/onboarding", request.url);
      return NextResponse.redirect(onboardingUrl);
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
