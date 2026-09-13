// Shared Auth Middleware for PitchCoach Ai × Athena Agentic
//
// Eliminates the duplicated auth() → prisma.user.findUnique → 401/404
// boilerplate across 16+ API routes (30+ handler functions).
//
// USAGE:
//   Before (10 lines per handler):
//     const { userId: clerkId } = await auth();
//     if (!clerkId) {
//       return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//     }
//     const user = await prisma.user.findUnique({
//       where: { clerkId },
//       select: { id: true },
//     });
//     if (!user) {
//       return NextResponse.json({ error: "User not found" }, { status: 404 });
//     }
//
//   After (2 lines):
//     const { user, error } = await requireAuth();
//     if (error) return error;
//
// For routes that need additional user fields (email, subscription, etc.),
// pass a Prisma select object:
//     const { user, error } = await requireAuth({
//       select: { id: true, email: true, subscription: { select: { plan: true } } }
//     });
//     if (error) return error;

import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';

// ============================================
// TYPES
// ============================================

/** Default user shape returned by requireAuth() without a select parameter */
type DefaultUser = { id: string; clerkId: string };

/** Result type: either a user (success) or an error response (failure) */
type AuthResult<T = DefaultUser> =
  | { user: T; error: null }
  | { user: null; error: NextResponse };

/** Options for requireAuth() */
interface RequireAuthOptions {
  /**
   * Prisma select object to customize which user fields are returned.
   * If omitted, returns only { id, clerkId }.
   * Must include at least `id: true` for downstream logic.
   */
  select?: Prisma.UserSelect;
}

// ============================================
// REQUIRE AUTH — Main auth utility
// ============================================

/**
 * Authenticate the current request and resolve the database user.
 *
 * Performs two checks:
 * 1. Clerk session auth — returns 401 if no authenticated session
 * 2. Database user lookup — returns 404 if user not in database
 *
 * @param options - Optional configuration (e.g., custom Prisma select)
 * @returns AuthResult — either { user, error: null } or { user: null, error }
 *
 * @example
 * // Basic usage (default select: id, clerkId)
 * const { user, error } = await requireAuth();
 * if (error) return error;
 * // user.id and user.clerkId are available
 *
 * @example
 * // Extended select for routes that need email/subscription
 * const { user, error } = await requireAuth({
 *   select: { id: true, email: true, subscription: { select: { plan: true } } }
 * });
 * if (error) return error;
 * // user.email and user.subscription are available
 */
export async function requireAuth<T extends Record<string, unknown> = DefaultUser>(
  options?: RequireAuthOptions
): Promise<AuthResult<T>> {
  // ── Step 1: Clerk session authentication ──
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return {
      user: null,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  // ── Step 2: Database user lookup ──
  const select = options?.select || { id: true, clerkId: true };
  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: select as Prisma.UserSelect,
  });

  if (!user) {
    return {
      user: null,
      error: NextResponse.json({ error: 'User not found' }, { status: 404 }),
    };
  }

  return { user: user as unknown as T, error: null };
}
