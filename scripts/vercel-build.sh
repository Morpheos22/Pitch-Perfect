#!/bin/bash
# ============================================================
# Pitch Perfect — Vercel Build Script
#
# Pipeline: prisma generate → next build
#
# Migrations are managed SEPARATELY by the GitHub Actions workflow:
#   .github/workflows/supabase-migrations.yml
# That workflow has real DB credentials (GitHub Secrets) and runs
# `prisma migrate deploy` on every push to main that touches
# prisma/migrations/ or schema.prisma.
#
# The Vercel build does NOT run migrations — it only needs:
#   1. prisma generate (generates the Prisma Client types)
#   2. next build (compiles the Next.js app)
#
# This avoids build failures when the DB is unreachable from
# Vercel's build environment (e.g. IPv6-only Supabase direct host).
# ============================================================
set -e

echo "🔧 [1/2] Generating Prisma Client..."
npx prisma generate

echo "🏗️ [2/2] Building Next.js application..."
npx next build

echo "📋 Copying static assets..."
cp -r .next/static .next/standalone/.next/ 2>/dev/null || true
cp -r public .next/standalone/ 2>/dev/null || true

echo "✅ Build complete!"
echo ""
echo "ℹ️  Database migrations are managed by:"
echo "    .github/workflows/supabase-migrations.yml"
echo "    (runs on push to main when prisma/ changes)"
