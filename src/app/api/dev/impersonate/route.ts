// Dev Impersonate API — Development Mode Only
// POST /api/dev/impersonate
// Returns user subscription plan and usage stats for debugging.
// This route is BLOCKED in production (returns 403).


import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { DEV_MODE, isAdminEmail } from '@/lib/dev-auth';
import { devImpersonateSchema } from '@/lib/validation/schemas';
export const dynamic = 'force-dynamic';

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


  // ── Guard: only admin emails ──
  const client = await clerkClient();
  const clerkUser = await client.users.getUser(clerkId);
  const requesterEmail = clerkUser.emailAddresses[0]?.emailAddress;


  if (!requesterEmail || !isAdminEmail(requesterEmail)) {
    return NextResponse.json(
      { error: 'Access denied. Only admin accounts can use this endpoint.' },
      { status: 403 },
    );
  }


  try {
    const body = await request.json();
    const parsed = devImpersonateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }
    const validatedData = parsed.data;
    const { email } = validatedData;


    // Look up user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        subscription: true,
        usage: true,
      },
    });


    if (!user) {
      return NextResponse.json(
        { error: `No user found with email "${email}".` },
        { status: 404 },
      );
    }


    return NextResponse.json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      onboardingCompleted: user.onboardingCompleted,
      subscription: {
        plan: user.subscription?.plan ?? 'FREE',
        status: user.subscription?.status ?? 'INCOMPLETE',
        creditsRemaining: user.subscription?.creditsRemaining ?? 0,
        creditsUsed: user.subscription?.creditsUsed ?? 0,
        currentPeriodEnd: user.subscription?.currentPeriodEnd ?? null,
      },
      usage: user.usage
        ? {
            e1DeckAnalyses: user.usage.e1DeckAnalyses,
            e2ScriptCoachSessions: user.usage.e2ScriptCoachSessions,
            e3LivePitchSessions: user.usage.e3LivePitchSessions,
            e4FullPitchSessions: user.usage.e4FullPitchSessions,
            zaiTokensUsed: user.usage.zaiTokensUsed,
          }
        : null,
    });
  } catch (error: unknown) {
    console.error('[dev/impersonate]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
