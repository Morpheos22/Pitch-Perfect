/**
 * Module Entitlement Checker — Pitch Perfect × Automagikal
 *
 * Verifies that a user has an active subscription or one-time module access
 * before allowing them to use AI-powered coach endpoints (E1–E5).
 *
 * Usage in coach routes:
 *   import { requireModuleAccess } from '@/lib/entitlement';
 *   const entitlement = await requireModuleAccess(userId, 'e1');
 *   if (!entitlement.allowed) {
 *     return NextResponse.json({ error: entitlement.reason }, { status: 403 });
 *   }
 */

import { prisma } from '@/lib/db';

export type CoachModule = 'e1' | 'e2' | 'e3' | 'e4' | 'e5';

export interface EntitlementResult {
  allowed: boolean;
  reason?: string;
  plan?: string;
}

/** Map of coach module to ModuleAccess boolean field name */
const MODULE_ACCESS_FIELD: Record<CoachModule, keyof {
  e1Access: boolean;
  e2Access: boolean;
  e3Access: boolean;
  e4Access: boolean;
}> = {
  e1: 'e1Access',
  e2: 'e2Access',
  e3: 'e3Access',
  e4: 'e4Access',
  // E5 is bundled with subscription — no one-time purchase
  e5: 'e1Access',
};

/** Map of coach module to ModuleAccess limit field name */
const MODULE_LIMIT_FIELD: Record<CoachModule, keyof {
  e1Limit: number | null;
  e2Limit: number | null;
  e3Limit: number | null;
  e4Limit: number | null;
} | null> = {
  e1: 'e1Limit',
  e2: 'e2Limit',
  e3: 'e3Limit',
  e4: 'e4Limit',
  e5: null,
};

/** Map of coach module to ModuleAccess usage field name */
const MODULE_USED_FIELD: Record<CoachModule, keyof {
  e1Used: number;
  e2Used: number;
  e3Used: number;
  e4Used: number;
} | null> = {
  e1: 'e1Used',
  e2: 'e2Used',
  e3: 'e3Used',
  e4: 'e4Used',
  e5: null,
};

/** Map of coach module to Usage model count field */
const MODULE_USAGE_FIELD: Record<CoachModule, keyof {
  e1DeckAnalyses: number;
  e2ScriptCoachSessions: number;
  e3LivePitchSessions: number;
  e4FullPitchSessions: number;
  e5FounderSessions: number;
}> = {
  e1: 'e1DeckAnalyses',
  e2: 'e2ScriptCoachSessions',
  e3: 'e3LivePitchSessions',
  e4: 'e4FullPitchSessions',
  e5: 'e5FounderSessions',
};

/** Subscription plans that grant access to all modules */
const PAID_PLANS = ['STARTER', 'PROFESSIONAL', 'ENTERPRISE'];

/** Active subscription statuses */
const ACTIVE_STATUSES = ['ACTIVE', 'TRIALING'];

/**
 * Check if a user has access to a specific coach module.
 *
 * Entitlement is granted if ANY of the following is true:
 * 1. User has an active paid subscription (STARTER, PROFESSIONAL, or ENTERPRISE with ACTIVE/TRIALING status)
 * 2. User has a one-time ModuleAccess grant for the specific module that hasn't expired
 * 3. User has remaining credits on their subscription (creditsRemaining > 0)
 */
export async function requireModuleAccess(
  userId: string,
  module: CoachModule
): Promise<EntitlementResult> {
  // Fetch user with subscription and module access in a single query
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      subscription: {
        select: {
          plan: true,
          status: true,
          creditsRemaining: true,
          currentPeriodEnd: true,
        },
      },
    },
  });

  if (!user) {
    return { allowed: false, reason: 'User not found' };
  }

  // ── Check 1: Active paid subscription ──
  const sub = user.subscription;
  if (sub && PAID_PLANS.includes(sub.plan) && ACTIVE_STATUSES.includes(sub.status)) {
    // Verify subscription hasn't expired (if period end is set)
    if (sub.currentPeriodEnd && sub.currentPeriodEnd < new Date()) {
      return {
        allowed: false,
        reason: 'Your subscription has expired. Please renew to continue using this feature.',
        plan: sub.plan,
      };
    }
    return { allowed: true, plan: sub.plan };
  }

  // ── Check 2: Subscription credits ──
  if (sub && sub.creditsRemaining > 0) {
    // Consume one credit
    await prisma.subscription.update({
      where: { userId },
      data: { creditsRemaining: { decrement: 1 }, creditsUsed: { increment: 1 } },
    });
    return { allowed: true, plan: sub.plan };
  }

  // ── Check 3: One-time ModuleAccess grant ──
  // Only applicable to E1–E4 (E5 is subscription-only)
  if (module !== 'e5') {
    const accessField = MODULE_ACCESS_FIELD[module];
    const limitField = MODULE_LIMIT_FIELD[module]!;
    const usedField = MODULE_USED_FIELD[module]!;

    // Find the most recent unexpired ModuleAccess for this user AND this specific module.
    // Use OR to include both: (a) no expiry set (one-time purchases, expiresAt: null)
    // and (b) expiry in the future. Prisma { gte } alone excludes null values.
    // Filter by the specific access field (e.g. e1Access: true) at the DB level
    // to avoid fetching unrelated ModuleAccess records.
    const moduleAccess = await prisma.moduleAccess.findFirst({
      where: {
        transaction: {
          userId,
        },
        [accessField]: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gte: new Date() } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });

    if (moduleAccess) {
      // Check usage limit
      const limit = moduleAccess[limitField];
      const used = moduleAccess[usedField];

      if (limit !== null && limit !== undefined && used >= limit) {
        return {
          allowed: false,
          reason: `You have reached the usage limit (${limit}) for this module. Upgrade your plan for unlimited access.`,
          plan: sub?.plan ?? 'FREE',
        };
      }

      // Increment usage
      await prisma.moduleAccess.update({
        where: { id: moduleAccess.id },
        data: { [usedField]: { increment: 1 } },
      });

      return { allowed: true, plan: sub?.plan ?? 'FREE' };
    }
  }

  // ── Denied: no valid entitlement ──
  const moduleNames: Record<CoachModule, string> = {
    e1: 'Pitch Deck Analyser',
    e2: 'Elevator Pitch Script Coach',
    e3: 'Live Elevator Pitch Coach',
    e4: 'Full Pitch Session',
    e5: 'Founder Module',
  };

  return {
    allowed: false,
    reason: `This feature requires an active subscription or module access. Please upgrade to use the ${moduleNames[module]}.`,
    plan: sub?.plan ?? 'FREE',
  };
}
