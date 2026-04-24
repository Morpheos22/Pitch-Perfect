#!/bin/bash
# ============================================================
# Pitch Perfect — Vercel Build Script
# Handles Prisma migration baselining for existing databases
# ============================================================
set -e

echo "🔧 [1/4] Generating Prisma Client..."
npx prisma generate

echo "📦 [2/4] Deploying Prisma migrations..."
# Try migrate deploy first — works for fresh DBs
if npx prisma migrate deploy 2>&1; then
  echo "✅ Migrations deployed successfully"
else
  MIGRATE_EXIT=$?
  echo "⚠️  Migration deploy failed (exit $MIGRATE_EXIT)"

  # Check if it's the "schema not empty" error (P3005)
  if npx prisma migrate deploy 2>&1 | grep -q "P3005\|schema is not empty"; then
    echo "🔄 Database already has tables — baselining migration 0_init..."
    npx prisma migrate resolve --applied 0_init

    echo "🔁 Retrying migration deploy after baseline..."
    npx prisma migrate deploy
    echo "✅ Migrations deployed after baseline"
  else
    echo "❌ Migration failed with unexpected error"
    exit $MIGRATE_EXIT
  fi
fi

echo "🏗️  [3/4] Building Next.js application..."
npx next build

echo "📋 [4/4] Copying static assets..."
cp -r .next/static .next/standalone/.next/ 2>/dev/null || true
cp -r public .next/standalone/ 2>/dev/null || true

echo "✅ Build complete!"
