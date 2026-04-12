// Prisma Client Singleton
// Prevents multiple Prisma Client instances in development
//
// IMPORTANT: Some environments (e.g., dev containers) may set DATABASE_URL
// as a system env var pointing to an old SQLite path. This module detects
// that scenario and forces the correct PostgreSQL URLs before Prisma
// Client is instantiated.

import { PrismaClient } from '@prisma/client';

// ── Env override guard ──
// If DATABASE_URL points to SQLite (file:), override with the correct
// PostgreSQL pooler URL. On Vercel, env vars are set via the dashboard
// so this guard is a no-op in production.
if (
  process.env.DATABASE_URL?.startsWith('file:') ||
  !process.env.DATABASE_URL
) {
  // Supabase pooler URL (transaction mode)
  process.env.DATABASE_URL =
    'postgresql://postgres.iwbshmshegewmctfucaz:Waving_Salamander44%40%40%21%21@aws-1-eu-west-2.pooler.supabase.com:6543/postgres';
}

if (
  process.env.DIRECT_URL?.startsWith('file:') ||
  !process.env.DIRECT_URL
) {
  // Supabase direct URL (session mode — used by Prisma for migrations/introspection)
  process.env.DIRECT_URL =
    'postgresql://postgres.iwbshmshegewmctfucaz:Waving_Salamander44%40%40%21%21@aws-1-eu-west-2.pooler.supabase.com:5432/postgres';
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
