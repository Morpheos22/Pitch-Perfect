#!/bin/bash
# ============================================================
# Pitch Perfect — Vercel Build Script
#
# Strategy: Prisma Client generation happens at build time.
# Database schema sync happens at runtime (via Supabase pooler).
# The DB pooler (af-south-1) is not reachable from Vercel's
# US-East build environment, so we skip DB ops at build time.
# Schema is kept in sync via `prisma db push` from dev machines.
# ============================================================
set -e

echo "🔧 [1/3] Generating Prisma Client..."
npx prisma generate

echo "🏗️ [2/3] Building Next.js application..."
npx next build

echo "📋 [3/3] Copying static assets..."
cp -r .next/static .next/standalone/.next/ 2>/dev/null || true
cp -r public .next/standalone/ 2>/dev/null || true

echo "✅ Build complete!"
