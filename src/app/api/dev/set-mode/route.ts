// Dev Set-Mode API — Development Mode Only
// POST /api/dev/set-mode
// Toggles the admin account between "dev mode" and "client mode".
//   - Dev mode:   onboardingCompleted = true  → bypasses onboarding, goes to /dashboard
//   - Client mode: onboardingCompleted = false → resets onboarding state, goes to /onboarding
// This route is BLOCKED in production (returns 403).

import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { DEV_MODE, isAdminEmail } from '@/lib/dev-auth';
import { devSetModeSchema } from '@/lib/validation/schemas';

export async function POST(request: NextRequest) {
  // ── Guard: development mode only ──
  if (!DEV_MODE) {
    return NextResponse.json(
      { error: 'This endpoint is only available in development mode.' },
      { status: 403 },
    );
  }

  // ── Guard: must be authenticated ──
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Guard: only admin email ──
  const client = await clerkClient();
  const clerkUser = await client.users.getUser(clerkId);
  const email = clerkUser.emailAddresses[0]?.emailAddress;

  if (!email || !isAdminEmail(email)) {
    return NextResponse.json(
      { error: 'Access denied. Only admin accounts can use this endpoint.' },
      { status: 403 },
    );
  }

  // ── Parse request body ──
  try {
    const body = await request.json();
    const parsed = devSetModeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }
    const validatedData = parsed.data;
    const mode = validatedData.mode;

    const onboardingCompleted = mode !== 'FREE';

    // ── Update Clerk public metadata ──
    await client.users.updateUser(clerkId, {
      publicMetadata: {
        onboardingCompleted,
      },
    });

    // ── Update Prisma DB ──
    if (!onboardingCompleted) {
      // Reset onboarding fields: clear country, primaryUseCase, set onboardingCompleted to false
      await prisma.user.update({
        where: { clerkId },
        data: {
          country: null,
          primaryUseCase: null,
          onboardingCompleted: false,
        },
      });
    } else {
      // Dev mode: ensure onboardingCompleted is true
      await prisma.user.update({
        where: { clerkId },
        data: {
          onboardingCompleted: true,
        },
      });
    }

    return NextResponse.json({
      success: true,
      mode,
      onboardingCompleted,
      redirect: onboardingCompleted ? '/dashboard' : '/onboarding',
    });
  } catch (error: any) {
    console.error('[dev/set-mode]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
