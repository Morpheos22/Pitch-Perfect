import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
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
