import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { isAdminEmail } from "@/lib/dev-auth";
import { syncUserToCRM } from "@/lib/zoho-crm";
import { getClientIp, getDeviceFingerprint } from "@/lib/security";
export const dynamic = 'force-dynamic';

// Sync Clerk user with database
// SECURITY: Uses auth() to get authenticated user - NEVER trust client input for userId
//
// DEVICE CAPTURE: This route is called on every page load (DashboardLayout's
// usePlan hook) and on every sign-in. We capture the device fingerprint +
// IP + UA here so the User row always reflects the user's current device.
// The FIRST call after signup (when signupDeviceId is null) persists the
// signup device; subsequent calls only update lastSignin*.
export async function POST(request: NextRequest) {
  try {
    // SECURITY: Get authenticated user from session, not from request body
    const { userId: clerkId } = await auth();


    if (!clerkId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }


    // Get user details from Clerk (trusted source)
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(clerkId);


    // SECURITY: Use the first VERIFIED email, not just the first in the list
    const verifiedEmail = clerkUser.emailAddresses.find(
      (e) => e.verification?.status === 'verified'
    );
    const email = verifiedEmail?.emailAddress;
    if (!email) {
      return NextResponse.json(
        { error: "No verified email found for user" },
        { status: 400 }
      );
    }


    const firstName = clerkUser.firstName;
    const lastName = clerkUser.lastName;
    const avatarUrl = clerkUser.imageUrl;

    // ── Capture device fingerprint + IP + UA from the request ────────────
    // getDeviceFingerprint returns a SHA-256 hash of UA + Client Hints
    // headers (sec-ch-ua, sec-ch-ua-platform, etc.). See src/lib/security.ts.
    // Truncate UA to 512 chars so a maliciously long UA can't blow up the
    // DB column.
    const deviceId = await getDeviceFingerprint(request);
    const ip = getClientIp(request);
    const userAgent = (request.headers.get("user-agent") ?? "").slice(0, 512);
    const now = new Date();

    // Fetch the existing user to decide whether this is a signup capture
    // (signupDeviceId is null) or a sign-in refresh (already set).
    const existingUser = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true, signupDeviceId: true },
    });

    const isSignupCapture = !existingUser?.signupDeviceId;

    // Upsert user using trusted clerkId from session
    const user = await prisma.user.upsert({
      where: { clerkId },
      update: {
        email,
        firstName,
        lastName,
        avatarUrl,
        lastActiveAt: now,
        // Always refresh lastSignin* — this represents "last activity from
        // this device" which is what we want for security forensics.
        lastSigninDeviceId: deviceId,
        lastSigninIp: ip,
        lastSigninUserAgent: userAgent,
        lastSigninAt: now,
        // Only set signup* fields ONCE — on the first authenticated request
        // after the Clerk user.created webhook fired. This is the closest
        // we can get to "device at signup" without Clerk sending device
        // info in the webhook payload itself.
        ...(isSignupCapture
          ? {
              signupDeviceId: deviceId,
              signupIp: ip,
              signupUserAgent: userAgent,
              signupAt: now,
            }
          : {}),
      },
      create: {
        clerkId,
        email,
        firstName,
        lastName,
        avatarUrl,
        lastActiveAt: now,
        // For a brand-new user (created via upsert create branch), this IS
        // the signup capture — set both signup* and lastSignin*.
        signupDeviceId: deviceId,
        signupIp: ip,
        signupUserAgent: userAgent,
        signupAt: now,
        lastSigninDeviceId: deviceId,
        lastSigninIp: ip,
        lastSigninUserAgent: userAgent,
        lastSigninAt: now,
      },
    });


    // Sync to Zoho CRM (fire-and-forget — non-blocking)
    syncUserToCRM({
      email,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      country: undefined, // Will be updated when user completes onboarding
      clerkId,
    }).catch((crmErr) => {
      console.warn(`CRM sync failed for ${email}:`, crmErr instanceof Error ? crmErr.message : crmErr);
    });


    // Ensure subscription + usage records exist in a single transaction
    await prisma.$transaction(async (tx) => {
      const existingSubscription = await tx.subscription.findUnique({
        where: { userId: user.id },
      });


      if (!existingSubscription) {
        await tx.subscription.create({
          data: { userId: user.id },
        });
      }


      const existingUsage = await tx.usage.findUnique({
        where: { userId: user.id },
      });


      if (!existingUsage) {
        await tx.usage.create({
          data: { userId: user.id },
        });
      }
    });


    // ── Developer/Admin override: Auto-upgrade to ENTERPRISE ──
    // Developer emails (configured via DEVELOPER_EMAILS env var) always get
    // ENTERPRISE access. This ensures the dashboard, sidebar, and billing
    // pages all show the correct plan from the very first page load.
    if (isAdminEmail(email)) {
      await prisma.subscription.updateMany({
        where: { userId: user.id },
        data: { plan: 'ENTERPRISE', status: 'ACTIVE' },
      });
    }


    // SECURITY: Return only safe fields — never expose internal IDs
    // (zohoContactId, zohoAccountId, clerkId) to the client
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl,
        onboardingCompleted: user.onboardingCompleted,
        lastActiveAt: user.lastActiveAt,
      },
    });
  } catch (error) {
    console.error("User sync error:", error);
    return NextResponse.json(
      { error: "Failed to sync user" },
      { status: 500 }
    );
  }
}


// GET endpoint to fetch current user data
export async function GET() {
  try {
    const { userId: clerkId } = await auth();


    if (!clerkId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }


    const user = await prisma.user.findUnique({
      where: { clerkId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        onboardingCompleted: true,
        // Device tracking — surfaced so the dashboard can show "last sign-in"
        // and so security can compare signup device vs current device.
        signupDeviceId: true,
        signupIp: true,
        signupUserAgent: true,
        signupAt: true,
        lastSigninDeviceId: true,
        lastSigninIp: true,
        lastSigninUserAgent: true,
        lastSigninAt: true,
        subscription: {
          select: {
            plan: true,
            status: true,
            // Full billing details — used by /dashboard/settings/billing to
            // render payment history + current period.
            paystackCustomerId: true,
            paystackSubscriptionId: true,
            paystackPlanCode: true,
            stripeCustomerId: true,
            stripeSubscriptionId: true,
            stripePaymentMethodId: true,
            stripeCurrentPeriodEnd: true,
            currentPeriodStart: true,
            currentPeriodEnd: true,
            cancelAtPeriodEnd: true,
            creditsRemaining: true,
            creditsUsed: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        usage: {
          select: {
            e1DeckAnalyses: true,
            e2ScriptCoachSessions: true,
            e3LivePitchSessions: true,
            e4FullPitchSessions: true,
            e5FounderSessions: true,
          },
        },
      },
    });


    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // ── Fetch payment history separately ─────────────────────────────────
    // The User model doesn't have a `transactions Transaction[]` relation
    // declared in schema.prisma, so we can't include it inline in the
    // user.findUnique select. Querying it separately is safer than adding
    // a schema relation + migration (which would touch the DB).
    const transactions = await prisma.transaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        type: true,
        amount: true,
        currency: true,
        provider: true,
        providerReference: true,
        creditsAdded: true,
        createdAt: true,
      },
    });

    // Attach the transactions to the user object for the response.
    const userWithTransactions = {
      ...user,
      transactions,
    };


    // ── Developer/Admin override: Ensure ENTERPRISE plan is returned ──
    // The POST handler auto-upgrades the DB record, but this GET handler
    // may be called before the POST runs (e.g. page refresh). Apply the
    // override at read time too, and backfill the DB if needed.
    if (user.email && isAdminEmail(user.email)) {
      if (user.subscription?.plan !== 'ENTERPRISE' || user.subscription?.status !== 'ACTIVE') {
        await prisma.subscription.updateMany({
          where: { userId: user.id },
          data: { plan: 'ENTERPRISE', status: 'ACTIVE' },
        });
      }
      // Return ENTERPRISE regardless of DB state (avoids stale cache).
      // Preserve all other subscription + transaction fields so the billing
      // page can still render payment history for admin users.
      return NextResponse.json({
        success: true,
        user: {
          ...userWithTransactions,
          subscription: {
            ...(user.subscription ?? {}),
            plan: 'ENTERPRISE',
            status: 'ACTIVE',
          },
        },
      });
    }


    return NextResponse.json({ success: true, user: userWithTransactions });
  } catch (error) {
    console.error("Get user error:", error);
    return NextResponse.json(
      { error: "Failed to get user" },
      { status: 500 }
    );
  }
}
