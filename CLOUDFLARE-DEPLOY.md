# Cloudflare-Native Deployment Guide

This document describes how to deploy PitchCoach Ai from Vercel to Cloudflare Pages + Workers, per the architectural pivot directive.

## Stack

- **App runtime**: Next.js 16 (App Router, React 19)
- **Build adapter**: `@cloudflare/next-on-pages` (current) OR `opennextjs-cloudflare` (recommended for Next 16+)
- **Static assets**: Cloudflare Pages CDN
- **Server-side rendering**: Cloudflare Workers (via the adapter)
- **Object storage**: Cloudflare R2 (already integrated)
- **D1 database**: Cloudflare D1 (used by athena-d1 Worker for prompt_logs, tool_executions, etc.)
- **Workers AI**: Cloudflare Workers AI binding (used by athena-d1 Worker for inference)
- **Postgres**: Supabase (unchanged — eu-west-2, PgBouncer + Prisma)
- **Auth**: Clerk (unchanged — custom FAPI domain `clerk.pitchcoachai.tech`)
- **Edge middleware**: Next.js middleware runs on Cloudflare Workers automatically
- **WebMCP bridge**: Already configured at the Cloudflare dashboard edge level (`.webmcp/bridge.js`)

## Architecture

```
Internet → Cloudflare CDN
            ↓
        Cloudflare Pages (static assets + Next.js SSR via Workers)
            ↓
        Next.js API routes (Workers runtime)
            ↓             ↓             ↓             ↓
        Supabase       Cloudflare    Cloudflare    Upstash Redis
        Postgres       R2            Workers AI    (rate limiting)
        (Prisma)       (files)      (Athena chat)
            ↓
        Clerk API (auth)
```

## Migration Steps

### 1. Install the Cloudflare adapter

```bash
bun add -D @opennextjs/cloudflare
# OR (older path):
bun add -D @cloudflare/next-on-pages
```

### 2. Update `next.config.ts`

The current `next.config.ts` is already Cloudflare-friendly:
- `output: "standalone"` ✓ (works with `@opennextjs/cloudflare`)
- `proxyClientMaxBodySize` is Vercel-specific — replace with Workers `body_size` limit in `wrangler.toml` or rely on the default 100MB
- `serverExternalPackages` works on Cloudflare too

### 3. Set Cloudflare env vars

Use `wrangler pages secret put` for each secret:
```bash
wrangler pages secret put DATABASE_URL --project-name pitchcoachai
# ... repeat for each secret
```

Non-secret vars (NEXT_PUBLIC_*, NODE_ENV) go in `wrangler.toml [vars]`.

### 4. Build + deploy

```bash
# Build with the Cloudflare adapter
bun run build  # If using @opennextjs/cloudflare, this produces .open-next/dist

# Deploy
wrangler pages deploy .open-next/dist --project-name pitchcoachai
# OR
wrangler pages deploy --project-name pitchcoachai
```

### 5. Point DNS at Cloudflare Pages

The domain `pitchcoachai.tech` is already on Cloudflare DNS. Update the CNAME record to point at the Pages deployment:

```
pitchcoachai.tech  CNAME  pitchcoachai.pages.dev
```

### 6. Delete Vercel project (after verification)

Once Cloudflare Pages is serving correctly:
1. Verify `/api/health` returns 200
2. Verify Clerk sign-in works
3. Verify file uploads to R2 work
4. Verify Athena chat works
5. Delete the Vercel project at https://vercel.com/morpheos22/pitch-perfect/settings

## Worker Deployments

Three Cloudflare Workers need separate deploys (they live in `workers/`):

### athena-d1 (chat engine)

```bash
cd workers/athena-d1
bun install
wrangler deploy
# Set secrets:
wrangler secret put AI_BINDING --name athena-d1  # actually AI binding, not a secret
wrangler secret put DB  # D1 binding, not a secret
wrangler secret put ELEVENLABS_API_KEY
wrangler secret put GITHUB_TOKEN
wrangler secret put SUPABASE_ACCESS_TOKEN
wrangler secret put CLOUDFLARE_ACCOUNT_ID
wrangler secret put CLOUDFLARE_API_TOKEN
wrangler secret put ATHENA_SECRET_KEY
```

### athena-memory-cron (36h summarizer + 6d purge)

```bash
cd workers/athena-memory-cron
bun install
wrangler deploy  # This deploys + registers the cron trigger

# Set secrets:
wrangler secret put DATABASE_URL
wrangler secret put ZAI_API_KEY
wrangler secret put ZAI_BASE_URL
wrangler secret put ATHENA_SECRET_KEY

# Non-secret:
# APP_URL is in wrangler.toml [vars]
```

### athena-union-alpha (deck analysis sidecar)

Source NOT in this repo. Deployed separately. See the `ATHENA_UNION_ALPHA_WORKER_URL` env var.

## WebMCP Bridge

The `/.webmcp/bridge.js` file is currently served by Cloudflare edge (configured via the Cloudflare dashboard, NOT via this repo). To make it explicit:

1. The bridge is part of Cloudflare's WebMCP feature (c2pa + mcp-server-client packs)
2. It's enabled on the Cloudflare Pages project (not Workers)
3. Configuration is at: Cloudflare Dashboard → Pages → pitchcoachai → Settings → WebMCP

If you ever reset the Pages project, you'll need to re-enable WebMCP there.

## Build Artifacts

`.gitignore` now includes:
- `workers/*/dist/` — Worker build artifacts (rebuild via `wrangler deploy`)
- `athena-mcp-worker/dist/`
- `.wrangler/` — Wrangler's local cache

## Vercel → Cloudflare Differences

| Feature | Vercel | Cloudflare |
|---|---|---|
| Region pinning | `vercel.json regions: ["lhr1"]` | `wrangler.toml [placement] mode = "smart"` |
| Function timeout | `maxDuration: 60` | `limits = { cpu_ms = 30000 }` |
| Body size limit | `experimental.proxyClientMaxBodySize` | Workers default 100MB, can be lowered via middleware |
| Cron jobs | Vercel cron | Cloudflare Workers cron triggers |
| Env vars | Vercel dashboard | `wrangler.toml [vars]` + `wrangler secret put` |
| WaitUntil | `@vercel/functions waitUntil` | `ctx.waitUntil()` (Workers runtime) |
| Edge middleware | Runs at Vercel edge | Runs at Cloudflare edge (same Next.js code) |

## Verification

After deploy:
```bash
# App is up
curl https://pitchcoachai.tech/api/health  # → 200 {"status":"ok"} (requires DB up)

# Cron worker is registered
wrangler triggers list  # should show the hourly cron

# R2 binding works
curl -H "x-athena-secret: $ATHENA_SECRET_KEY" \
  -X POST -H "Content-Type: application/json" \
  -d '{"prefix":"uploads/temp/","older_than_days":6}' \
  https://pitchcoachai.tech/api/admin/purge  # → {"prefix":"...","scanned":N,"deleted":M}

# Athena memory layer is wired
curl -H "Authorization: Bearer $CLERK_TOKEN" \
  -X POST -H "Content-Type: application/json" \
  -d '{"message":"hello"}' \
  https://pitchcoachai.tech/api/athena/chat  # → response with x-athena-session header
```
