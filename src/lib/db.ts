// Prisma Client Singleton
// Prevents multiple Prisma Client instances in development
//
// IMPORTANT: Some environments (e.g., dev containers) may set DATABASE_URL
// as a system env var pointing to an old SQLite path. This module detects
// that scenario and throws a clear error rather than falling back to
// hardcoded credentials (which should NEVER be committed to source control).
//
// On Vercel, env vars are set correctly via the dashboard, so this guard
// is a no-op in production deployments.

import { PrismaClient } from '@prisma/client';

// ── Env override guard ──
// If DATABASE_URL points to SQLite (file:), the environment is misconfigured.
// We do NOT fall back to hardcoded credentials — that is a security violation.
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

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
