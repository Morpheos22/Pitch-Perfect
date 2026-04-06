// Dev Impersonate API — Development Mode Only
// POST /api/dev/impersonate
// Returns user subscription plan, usage stats, and Zoho contact ID for debugging.
// This route is BLOCKED in production (returns 403).

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { DEV_MODE } from '@/lib/dev-auth';

export async function POST(request: NextRequest) {
  // ── Guard: development mode only ──
  if (!DEV_MODE) {
    return NextResponse.json(
      { error: 'This endpoint is only available in development mode.' },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();
    const { email } = body as { email?: string };

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid "email" field in request body.' },
        { status: 400 },
      );
    }

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
            claudeTokensUsed: user.usage.claudeTokensUsed,
            geminiTokensUsed: user.usage.geminiTokensUsed,
          }
        : null,
      zohoContactId: user.zohoContactId ?? null,
      zohoAccountId: user.zohoAccountId ?? null,
    });
  } catch (error: any) {
    console.error('[dev/impersonate]', error);
    return NextResponse.json(
      { error: error.message ?? 'Internal server error' },
      { status: 500 },
    );
  }
}
