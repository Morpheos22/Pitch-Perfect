// Prisma Client Singleton
// Prevents multiple Prisma Client instances in development
//
// IMPORTANT: Database URL validation is DEFERRED to first access.
// Module-level throws break Next.js build (route collection phase)
// because env vars aren't available at build time on Vercel.
// The validation runs lazily on the first prisma call instead.

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  __prismaClient: PrismaClient | undefined;
};

/**
 * Lazily-initialised Prisma Client singleton.
 *
 * Previous implementation threw at module-evaluation time if DATABASE_URL
 * was missing/SQLite. That broke the Next.js build because Vercel doesn't
 * inject env vars until runtime, not build time. Now the client is created
 * on first property access, so the build succeeds and the error only fires
 * if the route is actually called without proper env vars.
 */
function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.__prismaClient) {
    // ── Env override guard (lazy — only runs at first access) ──
    if (
      process.env.DATABASE_URL?.startsWith('file:') ||
      !process.env.DATABASE_URL
    ) {
      throw new Error(
        'DATABASE_URL is missing or points to SQLite. ' +
        'Set DATABASE_URL to your PostgreSQL connection string in your environment variables. ' +
        'Never commit database credentials to source control.'
      );
    }

    if (
      process.env.DIRECT_URL?.startsWith('file:') ||
      !process.env.DIRECT_URL
    ) {
      throw new Error(
        'DIRECT_URL is missing or points to SQLite. ' +
        'Set DIRECT_URL to your direct PostgreSQL connection string in your environment variables. ' +
        'Never commit database credentials to source control.'
      );
    }

    globalForPrisma.__prismaClient = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });
  }
  return globalForPrisma.__prismaClient;
}

// Export a Proxy so that `prisma.user.findFirst()` works transparently
// while still deferring client creation until first property access.
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop: string | symbol) {
    return Reflect.get(getPrismaClient(), prop);
  },
});
