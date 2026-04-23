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
import { isAdminEmail } from '@/lib/dev-auth';

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
// TODO: CANCELLED subscriptions with a remaining billing period should also be treated as active.
// Payment providers (Stripe, Paystack, etc.) handle CANCELLED status differently — some keep the
// subscription usable until period-end, others revoke access immediately. Validate each provider's
// behaviour before enabling this. For now, CANCELLED is intentionally excluded.
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
      email: true,
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

  // ── Developer/Admin bypass: Always grant ENTERPRISE-level access ──
  // Developer emails (configured via DEVELOPER_EMAILS env var) get full
  // access to all modules regardless of subscription status. This ensures
  // admins can test all functionalities in production.
  if (isAdminEmail(user.email)) {
    // Auto-upgrade subscription to ENTERPRISE if it isn't already
    const sub = user.subscription;
    if (sub && (sub.plan !== 'ENTERPRISE' || sub.status !== 'ACTIVE')) {
      await prisma.subscription.updateMany({
        where: { userId },
        data: { plan: 'ENTERPRISE', status: 'ACTIVE' },
      });
    }
    return { allowed: true, plan: 'ENTERPRISE' };
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
    // Check module-specific usage limits for paid plans — ATOMIC increment
    // Uses updateMany with a WHERE guard to prevent race conditions.
    // This is the SINGLE canonical counter for paid plan usage.
    if (module !== 'e5') {
      const usageField = MODULE_USAGE_FIELD[module];

      // ── Ensure Usage record exists ──
      // The Clerk webhook, user/sync, and onboarding routes all create Usage
      // records, but edge cases (webhook failure, direct API calls, race
      // conditions) can leave a paid user without a Usage record. Without this
      // guard, updateMany returns 0 rows → user is falsely denied access.
      try {
        await prisma.usage.upsert({
          where: { userId },
          create: { userId },
          update: {},
        });
      } catch (upsertErr) {
        // Non-fatal — if upsert fails (e.g. User row doesn't exist yet),
        // the updateMany below will also fail gracefully.
        console.error('[Entitlement] Usage upsert failed (non-fatal):', upsertErr);
      }

      // ── Lazy monthly reset ──
      // Check if the Usage.month is stale (different calendar month than now).
      // If so, reset all counters to 0 and update month to current month.
      // This avoids needing a cron job — reset happens on first request of each month.
      try {
        const currentUsage = await prisma.usage.findUnique({
          where: { userId },
          select: { month: true },
        });
        if (currentUsage) {
          const now = new Date();
          const usageMonth = new Date(currentUsage.month);
          // Reset if different year OR different month
          if (now.getFullYear() !== usageMonth.getFullYear() || now.getMonth() !== usageMonth.getMonth()) {
            await prisma.usage.update({
              where: { userId },
              data: {
                month: new Date(now.getFullYear(), now.getMonth(), 1),
                e1DeckAnalyses: 0,
                e2ScriptCoachSessions: 0,
                e3LivePitchSessions: 0,
                e4FullPitchSessions: 0,
                e5FounderSessions: 0,
                zaiTokensUsed: 0,
              },
            });
          }
        }
      } catch (resetErr) {
        // Non-fatal — log but don't block the user
        console.error('[Entitlement] Monthly usage reset check failed (non-fatal):', resetErr);
      }

      const PLAN_MODULE_LIMITS: Record<string, Record<string, number>> = {
        STARTER: { e1: 5, e2: 10, e3: 3, e4: 0 },
        PROFESSIONAL: { e1: 15, e2: 30, e3: 10, e4: 3 },
        ENTERPRISE: { e1: 999, e2: 999, e3: 999, e4: 999 },
      };
      const moduleLimit = PLAN_MODULE_LIMITS[sub.plan]?.[module];
      if (moduleLimit !== undefined) {
        // Atomic check-and-increment: only increment if current count < limit
        // This prevents concurrent requests from both passing the check
        const result = await prisma.usage.updateMany({
          where: {
            userId,
            [usageField]: { lt: moduleLimit },
          },
          data: { [usageField]: { increment: 1 } },
        });

        if (result.count === 0) {
          // No row was updated — user has reached the limit (or no Usage record)
          // Distinguish between "at limit" and "missing record" for clearer errors
          const usageRecord = await prisma.usage.findUnique({
            where: { userId },
            select: { [usageField]: true },
          });
          if (!usageRecord) {
            // Should never happen after the upsert above, but handle gracefully
            console.error(`[Entitlement] No Usage record found for paid user ${userId} — this should have been created by upsert`);
            // Allow access this once and create the record
            await prisma.usage.create({ data: { userId } });
            return { allowed: true, plan: sub.plan };
          }
          return {
            allowed: false,
            reason: `You've reached the ${sub.plan} plan limit (${moduleLimit}) for this module. Upgrade your plan for more analyses.`,
            plan: sub.plan,
          };
        }
      }
    }

    return { allowed: true, plan: sub.plan };
  }

  // ── Check 2: Subscription credits (ATOMIC) ──
  if (sub && sub.creditsRemaining > 0) {
    // Atomic check-and-decrement: only decrement if creditsRemaining > 0
    // Prevents concurrent requests from over-spending credits
    const creditResult = await prisma.subscription.updateMany({
      where: { userId, creditsRemaining: { gt: 0 } },
      data: { creditsRemaining: { decrement: 1 }, creditsUsed: { increment: 1 } },
    });

    if (creditResult.count === 0) {
      return {
        allowed: false,
        reason: 'No credits remaining. Please upgrade your plan for more analyses.',
        plan: sub.plan,
      };
    }
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
      const limit = moduleAccess[limitField];

      if (limit !== null && limit !== undefined) {
        // Atomic check-and-increment: only increment if used < limit
        // Prevents concurrent requests from exceeding one-time purchase limits
        const moduleResult = await prisma.moduleAccess.updateMany({
          where: {
            id: moduleAccess.id,
            [usedField]: { lt: limit },
          },
          data: { [usedField]: { increment: 1 } },
        });

        if (moduleResult.count === 0) {
          return {
            allowed: false,
            reason: `You have reached the usage limit (${limit}) for this module. Upgrade your plan for unlimited access.`,
            plan: sub?.plan ?? 'FREE',
          };
        }
      } else {
        // No limit — just increment
        await prisma.moduleAccess.update({
          where: { id: moduleAccess.id },
          data: { [usedField]: { increment: 1 } },
        });
      }

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
