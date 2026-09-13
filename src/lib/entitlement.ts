/**
 * Module Entitlement Checker — PitchCoach Ai × Athena Agentic
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
import { PLAN_LIMITS } from '@/lib/plan-config';

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
  e5Access: boolean;
}> = {
  e1: 'e1Access',
  e2: 'e2Access',
  e3: 'e3Access',
  e4: 'e4Access',
  e5: 'e5Access',
};

/** Map of coach module to ModuleAccess limit field name */
const MODULE_LIMIT_FIELD: Record<CoachModule, keyof {
  e1Limit: number | null;
  e2Limit: number | null;
  e3Limit: number | null;
  e4Limit: number | null;
  e5Limit: number | null;
}> = {
  e1: 'e1Limit',
  e2: 'e2Limit',
  e3: 'e3Limit',
  e4: 'e4Limit',
  e5: 'e5Limit',
};

/** Map of coach module to ModuleAccess usage field name */
const MODULE_USED_FIELD: Record<CoachModule, keyof {
  e1Used: number;
  e2Used: number;
  e3Used: number;
  e4Used: number;
  e5Used: number;
}> = {
  e1: 'e1Used',
  e2: 'e2Used',
  e3: 'e3Used',
  e4: 'e4Used',
  e5: 'e5Used',
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
const PAID_PLANS = ['INTERN', 'COFOUNDER', 'FOUNDER', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE'];

/** Active subscription statuses — includes CANCELLED with remaining period */
// CANCELLED subscriptions that still have a remaining billing period
// (cancelAtPeriodEnd = true + period not expired) are treated as active.
// The Stripe webhook sets cancelAtPeriodEnd = true when the user requests
// cancellation, but the subscription stays active until the period ends.
// Only when Stripe fires `customer.subscription.deleted` does the period end
// and status become fully CANCELLED — at which point currentPeriodEnd will
// be in the past, so the check below will deny access.
const ACTIVE_STATUSES = ['ACTIVE', 'TRIALING', 'CANCELLED'];

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
          cancelAtPeriodEnd: true,
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
    if (sub && (sub.plan !== 'FOUNDER' || sub.status !== 'ACTIVE')) {
      await prisma.subscription.updateMany({
        where: { userId },
        data: { plan: 'FOUNDER', status: 'ACTIVE' },
      });
    }
    return { allowed: true, plan: 'FOUNDER' };
  }

  // ── Check 1: Active paid subscription ──
  const sub = user.subscription;
  if (sub && PAID_PLANS.includes(sub.plan) && ACTIVE_STATUSES.includes(sub.status)) {
    // ── CANCELLED subscriptions: only active if period hasn't ended ──
    // When a user cancels, Stripe keeps the subscription active until
    // the current billing period ends. We honour this grace period.
    // Once the period ends, Stripe fires `customer.subscription.deleted`
    // and the webhook sets plan to FREE — but as a safety net, we also
    // check the period end date here.
    if (sub.status === 'CANCELLED') {
      if (sub.currentPeriodEnd && sub.currentPeriodEnd < new Date()) {
        return {
          allowed: false,
          reason: 'Your subscription has ended. Please renew to continue using this feature.',
          plan: sub.plan,
        };
      }
    }

    // Verify subscription hasn't expired (if period end is set)
    if (sub.status !== 'CANCELLED' && sub.currentPeriodEnd && sub.currentPeriodEnd < new Date()) {
      return {
        allowed: false,
        reason: 'Your subscription has expired. Please renew to continue using this feature.',
        plan: sub.plan,
      };
    }
    // Check module-specific usage limits for paid plans — ATOMIC increment
    // Uses updateMany with a WHERE guard to prevent race conditions.
    // This is the SINGLE canonical counter for paid plan usage.
    // E5 now has its own plan limits (STARTER:3, PROFESSIONAL:10, ENTERPRISE:999)
    // and is tracked via e5FounderSessions in the Usage model.
    {
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

      // Use shared plan limits from plan-config.ts (single source of truth)
      // PLAN_LIMITS includes all modules E1–E5 and all plans (FREE, STARTER, PROFESSIONAL, ENTERPRISE)
      const moduleLimit = PLAN_LIMITS[sub.plan]?.[module as keyof typeof PLAN_LIMITS[string]];
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
  // Applicable to all modules E1–E5 (E5 now supports one-time purchases via e5Access)
  {
    const accessField = MODULE_ACCESS_FIELD[module];
    const limitField = MODULE_LIMIT_FIELD[module];
    const usedField = MODULE_USED_FIELD[module];

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
      const limit = limitField ? moduleAccess[limitField] : null;

      if (limit !== null && limit !== undefined) {
        // Atomic check-and-increment: only increment if used < limit
        // Prevents concurrent requests from exceeding one-time purchase limits
        const moduleResult = await prisma.moduleAccess.updateMany({
          where: {
            id: moduleAccess.id,
            [usedField!]: { lt: limit },
          },
          data: { [usedField!]: { increment: 1 } },
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
          data: { [usedField!]: { increment: 1 } },
        });
      }

      return { allowed: true, plan: sub?.plan ?? 'FREE' };
    }
  }

  // ── Denied: no valid entitlement ──
  const moduleNames: Record<CoachModule, string> = {
    e1: 'Pitch Deck Analyser',
    e2: 'Script Check',
    e3: 'Live Pitch',
    e4: 'Full Pitch Session',
    e5: 'Founder Module',
  };

  return {
    allowed: false,
    reason: `This feature requires an active subscription or module access. Please upgrade to use the ${moduleNames[module]}.`,
    plan: sub?.plan ?? 'FREE',
  };
}
