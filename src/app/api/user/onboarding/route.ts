import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";

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
    const existingUser = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    if (!existingUser) {
      // Sync from Clerk before updating
      try {
        const client = await clerkClient();
        const clerkUser = await client.users.getUser(userId);
        const email = clerkUser.emailAddresses[0]?.emailAddress;
        if (email) {
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

          // Create subscription and usage if missing
          const user = await prisma.user.findUnique({ where: { clerkId: userId } });
          if (user) {
            const [subCount, usageCount] = await Promise.all([
              prisma.subscription.count({ where: { userId: user.id } }),
              prisma.usage.count({ where: { userId: user.id } }),
            ]);
            if (subCount === 0) await prisma.subscription.create({ data: { userId: user.id } });
            if (usageCount === 0) await prisma.usage.create({ data: { userId: user.id } });
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Onboarding error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
