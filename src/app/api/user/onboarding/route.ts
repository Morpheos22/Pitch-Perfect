import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { completeOnboardingInCRM } from "@/lib/zoho-crm";
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();


    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }


    const body = await req.json();
    const { country, primaryUseCase } = body;


    // Validate input
    if (typeof country !== "string" || country.length > 100 || typeof primaryUseCase !== "string" || primaryUseCase.length > 100) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }


    if (!country || !primaryUseCase) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }


    // ── 1. Ensure user exists in DB (handles Clerk webhook race condition) ──
    let userEmail: string | undefined;
    let userFirstName: string | null | undefined;
    let userLastName: string | null | undefined;

    const existingUser = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    if (existingUser) {
      userEmail = existingUser.email;
      userFirstName = existingUser.firstName;
      userLastName = existingUser.lastName;
    }

    if (!existingUser) {
      // Sync from Clerk before updating
      try {
        const client = await clerkClient();
        const clerkUser = await client.users.getUser(userId);
        const email = clerkUser.emailAddresses.find(
          (e) => e.verification?.status === 'verified'
        )?.emailAddress || clerkUser.emailAddresses[0]?.emailAddress;
        if (email) {
          userEmail = email;
          userFirstName = clerkUser.firstName;
          userLastName = clerkUser.lastName;

          await prisma.user.upsert({
            where: { clerkId: userId },
            update: {
              email,
              firstName: clerkUser.firstName,
              lastName: clerkUser.lastName,
              avatarUrl: clerkUser.imageUrl,
              lastActiveAt: new Date(),
            },
            create: {
              clerkId: userId,
              email,
              firstName: clerkUser.firstName,
              lastName: clerkUser.lastName,
              avatarUrl: clerkUser.imageUrl,
              lastActiveAt: new Date(),
            },
          });


          // Create subscription and usage if missing (atomic transaction to prevent race condition)
          const user = await prisma.user.findUnique({ where: { clerkId: userId } });
          if (user) {
            await prisma.$transaction([
              prisma.subscription.upsert({
                where: { userId: user.id },
                create: { userId: user.id },
                update: {}, // no-op if already exists
              }),
              prisma.usage.upsert({
                where: { userId: user.id },
                create: { userId: user.id },
                update: {}, // no-op if already exists
              }),
            ]);
          }
        }
      } catch (syncError) {
        console.error("User sync during onboarding failed:", syncError);
      }
    }


    // ── 2. Update database ──
    await prisma.user.update({
      where: { clerkId: userId },
      data: {
        country,
        primaryUseCase,
        onboardingCompleted: true,
      },
    });


    // ── 3. Update Clerk public metadata SERVER-SIDE ──
    // This is critical — client-side user.update() was unreliable because the JWT
    // wouldn't refresh fast enough, causing the middleware to read stale claims
    // and redirect back to onboarding (infinite loop).
    try {
      const client = await clerkClient();
      await client.users.updateUser(userId, {
        publicMetadata: {
          onboardingCompleted: true,
          country,
          primaryUseCase,
        },
      });
    } catch (clerkError) {
      console.error("Failed to update Clerk metadata:", clerkError);
      // Non-fatal — the DB is updated, and we'll force a hard redirect
      // which will trigger a fresh JWT with updated claims
    }


    // ── 4. Complete onboarding in Zoho CRM + send welcome email ──
    // On user.created webhook, the CRM got a bare lead (no country/useCase).
    // Now that onboarding is complete, update the CRM lead with full data
    // and send the onboarding welcome email via Zoho CRM's SendMail API.
    if (userEmail) {
      completeOnboardingInCRM({
        email: userEmail,
        firstName: userFirstName || undefined,
        lastName: userLastName || undefined,
        country,
        clerkId: userId,
        primaryUseCase,
      }).catch((crmErr) => {
        console.warn(`[Onboarding] CRM completion failed for ${userEmail}:`, crmErr instanceof Error ? crmErr.message : crmErr);
      });
    }


    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Onboarding error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
