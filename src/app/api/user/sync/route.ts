import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { isAdminEmail } from "@/lib/dev-auth";
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


    // ── Developer/Admin override: Auto-upgrade to FOUNDER ──
    // Developer emails (PERMANENT_FOUNDER_EMAILS in dev-auth.ts +
    // DEVELOPER_EMAILS env var) always get FOUNDER tier. This is the
    // highest tier and cannot be altered by any other code path.
    // morphylee22@gmail.com is in PERMANENT_FOUNDER_EMAILS and will
    // ALWAYS be on FOUNDER tier regardless of DB state, env vars, or
    // any other condition.
    if (isAdminEmail(email)) {
      await prisma.subscription.updateMany({
        where: { userId: user.id },
        data: { plan: 'FOUNDER', status: 'ACTIVE' },
      });
    }


    // ── Authenticate AI service layer + fire model warm-up ──────────────
    // On every dashboard sync (POST /api/user/sync), check if Athena's
    // AI service is warm for this user. If cold or stale (>30min),
    // fire the warm-up trigger to pre-initialize the model powering Athena.
    try {
        const warmth = await prisma.$queryRaw`
            SELECT status, "warmedAt", "isStale"
            FROM public.check_athena_warmth(${user.id})
        ` as any[];
        const warm = warmth[0];
        const isCold = !warm || warm.status === 'cold' || warm.isstale;

        if (isCold) {
            // Fire warm-up in background (don't block the sync response)
            const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://pitchcoachai.tech";
            const ATHENA_SECRET = process.env.ATHENA_SECRET_KEY || "";
            const POKE_KEY = process.env.POKE_API_KEY || "";

            // Mark as 'warming' in DB (synchronous — fast DB write)
            await prisma.$executeRaw`
                INSERT INTO public.ai_service_health ("userId", "clerkId", status, "warmedAt", "lastPingAt")
                VALUES (${user.id}, ${clerkId}, 'warming', now(), now())
                ON CONFLICT ("userId") DO UPDATE
                SET status = 'warming', "warmedAt" = now(), "lastPingAt" = now(), "updatedAt" = now()
            `;

            // ── Fire warm-up in the background (DO NOT AWAIT) ──────────────────
            // Previously this block used `await Promise.race([...warmupTasks, 5000ms])`
            // which BLOCKED the sync response for up to 5 seconds on every cold
            // dashboard load — the "session hydration kills sign-in" bottleneck.
            //
            // Now: fire the three warm-up pings as a single background Promise.
            // The sync response returns immediately. The Promise resolves in
            // the background (Vercel may kill the function early, but the warmup
            // is non-critical — next visit will re-warm). The DB write to mark
            // 'warm' happens at the end of the background Promise.
            const warmupBackgroundWork = (async () => {
                const warmupTasks: Promise<void>[] = [];

                // 1. Preload endpoint — authenticates the AI service layer
                warmupTasks.push(
                    fetch(`${APP_URL}/api/athena/preload`, {
                        method: "POST",
                        headers: { "Authorization": `Bearer ${ATHENA_SECRET}` },
                    }).then(() => {}).catch(() => {}),
                );

                // 2. Poke API — warm the agent's context
                if (POKE_KEY) {
                    warmupTasks.push(
                        fetch("https://poke.com/api/v1/inbound/api-message", {
                            method: "POST",
                            headers: { "Authorization": `Bearer ${POKE_KEY}`, "Content-Type": "application/json" },
                            body: JSON.stringify({
                                message: `System: User ${email} loaded the dashboard. Warm up your context. They may ask about pitch scores, usage, or platform features.`,
                            }),
                        }).then(() => {}).catch(() => {}),
                    );
                }

                // 3. MCP server — initialize DurableObject (eliminates cold start)
                let mcpSession: string | null = null;
                warmupTasks.push(
                    fetch("https://athena-mcp-server.morphylee22.workers.dev/mcp", {
                        method: "POST",
                        headers: { "Content-Type": "application/json", "Accept": "application/json, text/event-stream" },
                        body: JSON.stringify({
                            jsonrpc: "2.0", method: "initialize",
                            params: { protocolVersion: "2025-01-01", capabilities: {}, clientInfo: { name: "dashboard-warmup", version: "1.0" } },
                            id: 1,
                        }),
                    }).then(async (res) => {
                        mcpSession = res.headers.get("mcp-session-id");
                    }).catch(() => {}),
                );

                // Wait for all warmup tasks (no race — let them complete in background)
                await Promise.allSettled(warmupTasks);

                // Mark as warm after all tasks complete (or fail)
                try {
                    await prisma.$executeRaw`SELECT public.mark_athena_warm(${user.id}, ${mcpSession}, ${!!POKE_KEY})`;
                } catch {}
            })();

            // Detach the background work — do NOT await.
            // Vercel/Cloudflare will keep the function alive briefly after the
            // response is sent. If the runtime kills it early, the warmup
            // fails silently (next visit will re-warm).
            warmupBackgroundWork.catch(() => {/* non-fatal */});

            console.log(`[User Sync] Athena warm-up fired (background) for ${email}`);
        } else {
            console.log(`[User Sync] Athena already warm for ${email} (status=${warm.status})`);
        }
    } catch (warmupErr) {
        // Non-fatal — don't block the sync response
        console.warn(`[User Sync] Athena warm-up failed:`, warmupErr instanceof Error ? warmupErr.message : warmupErr);
    }

    // SECURITY: Return only safe fields — never expose internal IDs
    // (clerkId) to the client
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


    // ── Developer/Admin override: Ensure FOUNDER plan is returned ──
    // The POST handler auto-upgrades the DB record, but this GET handler
    // may be called before the POST runs (e.g. page refresh). Apply the
    // override at read time too, and backfill the DB if needed.
    // morphylee22@gmail.com is in PERMANENT_FOUNDER_EMAILS — this check
    // fires on every page load and forces FOUNDER tier, so even if the
    // DB row gets corrupted or a migration resets it, the next request
    // restores FOUNDER. The tier can NEVER be altered for this user.
    if (user.email && isAdminEmail(user.email)) {
      if (user.subscription?.plan !== 'FOUNDER' || user.subscription?.status !== 'ACTIVE') {
        await prisma.subscription.updateMany({
          where: { userId: user.id },
          data: { plan: 'FOUNDER', status: 'ACTIVE' },
        });
      }
      // Return FOUNDER regardless of DB state (avoids stale cache).
      // Preserve all other subscription + transaction fields so the billing
      // page can still render payment history for admin users.
      return NextResponse.json({
        success: true,
        user: {
          ...userWithTransactions,
          subscription: {
            ...(user.subscription ?? {}),
            plan: 'FOUNDER',
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
