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

    // Validate input types and length
    if (typeof country !== 'string' || country.length > 100 || typeof primaryUseCase !== 'string' || primaryUseCase.length > 100) {
      return NextResponse.json(
        { error: "Invalid input" },
        { status: 400 }
      );
    }

    if (!country || !primaryUseCase) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Ensure user exists in DB — handles race condition where Clerk webhook hasn't fired yet
    const existingUser = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    if (!existingUser) {
      // Sync user from Clerk before updating onboarding
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

          // Create subscription and usage records
          const user = await prisma.user.findUnique({ where: { clerkId: userId } });
          if (user) {
            const [subCount, usageCount] = await Promise.all([
              prisma.subscription.count({ where: { userId: user.id } }),
              prisma.usage.count({ where: { userId: user.id } }),
            ]);
            if (subCount === 0) {
              await prisma.subscription.create({ data: { userId: user.id } });
            }
            if (usageCount === 0) {
              await prisma.usage.create({ data: { userId: user.id } });
            }
          }
        }
      } catch (syncError) {
        console.error("User sync during onboarding failed:", syncError);
        // Continue — we'll try the update anyway
      }
    }

    // Update user in database
    const user = await prisma.user.update({
      where: { clerkId: userId },
      data: {
        country,
        primaryUseCase,
        onboardingCompleted: true,
      },
    });

    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error("Onboarding error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
