import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { syncUserToCRM } from "@/lib/zoho-crm";

// Sync Clerk user with database
// SECURITY: Uses auth() to get authenticated user - NEVER trust client input for userId
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

    // Upsert user using trusted clerkId from session
    const user = await prisma.user.upsert({
      where: { clerkId },
      update: {
        email,
        firstName,
        lastName,
        avatarUrl,
        lastActiveAt: new Date(),
      },
      create: {
        clerkId,
        email,
        firstName,
        lastName,
        avatarUrl,
        lastActiveAt: new Date(),
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

    return NextResponse.json({ success: true, user });
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
        subscription: {
          select: {
            plan: true,
            status: true,
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

    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error("Get user error:", error);
    return NextResponse.json(
      { error: "Failed to get user" },
      { status: 500 }
    );
  }
}
