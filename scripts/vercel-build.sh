#!/bin/bash
# ============================================================
# Pitch Perfect — Vercel Build Script
#
# Pipeline: prisma generate → migrate deploy → next build
# Migrations are now baselined, so deploy runs cleanly.
#
# IMPORTANT: Migration failures are FATAL. Previously, the build script
# silently swallowed migration errors (`|| echo "skipped (non-fatal)"`),
# which meant the app could deploy with a stale schema — causing runtime
# Prisma errors that looked like "Unknown column" or "Unknown argument".
# Now, if migrations fail, the build fails and Vercel blocks the deploy.
# ============================================================
set -e

echo "🔧 [1/4] Generating Prisma Client..."
npx prisma generate

echo "📦 [2/4] Deploying Prisma migrations..."
# FATAL on failure — do NOT swallow migration errors.
# If migrations fail, the deploy MUST be blocked so the schema stays
# in sync with the code. A failed migration usually means:
#   - A migration SQL file has a syntax error
#   - The DB is unreachable (check DATABASE_URL / DIRECT_URL)
#   - A migration was applied out of order (check prisma/migrations/)
# In all cases, failing the build is safer than deploying broken code.
npx prisma migrate deploy

echo "🏗️ [3/4] Building Next.js application..."
npx next build

echo "📋 [4/4] Copying static assets..."
cp -r .next/static .next/standalone/.next/ 2>/dev/null || true
cp -r public .next/standalone/ 2>/dev/null || true

echo "✅ Build complete!"
