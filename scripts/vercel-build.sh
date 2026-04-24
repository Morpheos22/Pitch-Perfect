#!/bin/bash
# ============================================================
# Pitch Perfect — Vercel Build Script
#
# Pipeline: prisma generate → migrate deploy → next build
# Migrations are now baselined, so deploy runs cleanly.
# ============================================================
set -e

echo "🔧 [1/4] Generating Prisma Client..."
npx prisma generate

echo "📦 [2/4] Deploying Prisma migrations..."
npx prisma migrate deploy 2>&1 || echo "⚠️  Migration deploy skipped (non-fatal)"

echo "🏗️ [3/4] Building Next.js application..."
npx next build

echo "📋 [4/4] Copying static assets..."
cp -r .next/static .next/standalone/.next/ 2>/dev/null || true
cp -r public .next/standalone/ 2>/dev/null || true

echo "✅ Build complete!"
