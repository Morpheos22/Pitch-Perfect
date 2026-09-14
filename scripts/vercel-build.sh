#!/bin/bash
# ============================================================
# Pitch Perfect — Vercel Build Script
#
# Pipeline: prisma generate → (migrate deploy, non-fatal) → next build
#
# Migrations are managed by the GitHub Actions workflow
# (.github/workflows/supabase-migrations.yml) which has real DB credentials.
# The Vercel build only needs prisma generate (for the client types) and
# next build (to compile the app). If migrate deploy fails here due to
# DB connectivity, it's non-fatal — migrations are already applied.
# ============================================================
set -e

echo "🔧 [1/3] Generating Prisma Client..."
npx prisma generate

echo "📦 [2/3] Deploying Prisma migrations (non-fatal if DB unreachable)..."
# Try to deploy migrations, but don't fail the build if the DB is unreachable.
# Migrations are already applied via the GitHub Actions workflow.
# We use a timeout to prevent hanging on IPv6-only Supabase direct hosts.
timeout 30 npx prisma migrate deploy 2>&1 || {
  echo "⚠️  Migration deploy skipped (non-fatal — DB unreachable or timeout)."
  echo "    Migrations are managed by .github/workflows/supabase-migrations.yml"
  echo "    If this is a new migration, run it manually via: npm run db:deploy"
}

echo "🏗️ [3/3] Building Next.js application..."
npx next build

echo "📋 Copying static assets..."
cp -r .next/static .next/standalone/.next/ 2>/dev/null || true
cp -r public .next/standalone/ 2>/dev/null || true

echo "✅ Build complete!"
