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
  // NOTE: /api/debug/* is NOT public — removed from this list (C5 fix)
]);

// Routes that should not redirect to onboarding
const isOnboardingOrApi = createRouteMatcher([
  "/onboarding(.*)",
  "/api(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  const pathname = new URL(request.url).pathname;

  // ── Auth: call ONCE and reuse result ──
  const authResult = await auth();
  const userId = authResult.userId;

  // ── Rate Limiting (API routes only) ──
  if (pathname.startsWith("/api/")) {
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
      // Fail-CLOSE: redirect to onboarding if Clerk API is unreachable.
      // Prevents non-onboarded users from accessing dashboard during Clerk outages.
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
