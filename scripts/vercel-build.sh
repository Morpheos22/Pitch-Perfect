#!/bin/bash
# Vercel build: generate Prisma Client, build Next.js standalone output, copy runtime assets.
set -euo pipefail

printf '%s\n' '🔧 [1/2] Generating Prisma Client...'
npx prisma generate

printf '%s\n' '🏗️ [2/2] Building Next.js application...'
npx next build

printf '%s\n' '📋 Copying standalone runtime assets...'
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/
cp -r public .next/standalone/

printf '%s\n' '✅ Build complete.'
printf '%s\n' 'ℹ️ Database migrations are deployed separately by .github/workflows/supabase-migrations.yml.'
