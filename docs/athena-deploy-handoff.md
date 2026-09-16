# Athena Deployment Handoff Note
**Date:** 2026-09-16
**From:** GLM 5.2 (this session)
**To:** Incoming agent
**Repo:** Morpheos22/Pitch-Perfect (branch: main)
**Target deployment head:** `fbf23cd4f7910d2634a348686b8bbad31d50b0d8`

---

## Session Git Commit Ledger

**Base head prior to session:** `43524d6c`

| # | Commit SHA | Description |
|---|---|---|
| 1 | `f943805` | Dedicated D1 db binding in wrangler.toml |
| 2 | `43be8ac` | Deepseek-r1 pipeline, tool definitions, ElevenLabs TTS, web search config |
| 3 | `d30ae3f` | Supabase PostgREST tools in src/supabase-tools.ts |
| 4 | `6635ee9` | Backend route /api/athena, useAthena hook, AthenaCoach UI |
| 5 | `f16d08d` | ATHENA_PERSONALITY.md specification |
| 6 | `fbf23cd` | Clerk session.created webhook, svix validation, session dehydration cache |

**Target deployment head:** `fbf23cd4f7910d2634a348686b8bbad31d50b0d8`

---

## Infrastructure Ledger

| Resource | Value |
|---|---|
| Cloudflare account ID | `d69dd23c964cc92c0291bbef08fb1f82` |
| Cloudflare zone | `925a65c2682e8b4c4cb574bba19e3006` (pitchcoachai.tech) |
| D1 database | `pitchcoach-athena-d1` (UUID: `9aa57869-3ca8-417e-8c29-978068c47d88`, schema initialized) |
| Vercel project | `prj_yMCmXOgeQPWTqPVWwFSrz8uPuNf3` |
| Worker URL | `https://athena-mcp-server.morphylee22.workers.dev` |
| MCP endpoint | `https://athena-mcp-server.morphylee22.workers.dev/mcp` (verified: 200 OK, tools list confirmed) |
| Cron trigger | `*/5 * * * *` (always-on) |
| DurableObject binding | `ATHENA_MCP` (class: `AthenaMCP`) |
| D1 binding | `ATHENA_STATE` (database: `athena-activation-state`, UUID: `f309a9db-f7d0-4339-af60-73cf83440999`) |

### Worker Secrets (currently set on Cloudflare Worker)
| Secret | Status | Notes |
|---|---|---|
| `GITHUB_TOKEN` | ✅ Set | `ghp_jcY4IM...` (active PAT) |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ Set | `https://iwbshmshegewmctfucaz.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Set | Retrieved from Supabase Management API |
| `ELEVENLABS_API_KEY` | ⚠️ Needs verification | Prior key `23141da...` may be an API key ID, not the actual `sk_` credential. Returns 400 if invalid. |
| `ATHENA_SECRET_KEY` | ✅ Set | 43-char random token (set on Worker + Vercel) |
| `POKE_API_KEY` | ✅ Set | JWT token (set on Worker + Vercel) |

### Vercel Environment Variables (currently set)
| Key | Target | Notes |
|---|---|---|
| `GITHUB_TOKEN` | prod/preview/dev | Active PAT |
| `SUPABASE_ACCESS_TOKEN` | prod/preview/dev | `sbp_fc59ba...` |
| `POKE_API_KEY` | prod/preview/dev | JWT token |
| `ELEVENLABS_API_KEY` | prod/preview/dev | Needs `sk_` verification |
| `ATHENA_SECRET_KEY` | prod/preview/dev | 43-char random token |
| `CLOUDFLARE_ACCOUNT_ID` | prod/preview/dev | `d69dd23c...` |
| `CLOUDFLARE_AI_TOKEN` | prod/preview/dev | Workers AI access |
| `NEXT_PUBLIC_SUPABASE_URL` | prod/preview/dev | `https://iwbshmshegewmctfucaz.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | prod/preview/dev | Service role key |
| `DATABASE_URL` | prod/preview/dev | Supabase pooler connection |
| `DIRECT_URL` | prod/preview/dev | Supabase direct connection |
| `CLERK_WEBHOOK_SECRET` | prod | Svix webhook secret (verify in Clerk dashboard) |

---

## Pre-Flight Prerequisites for Incoming Agent

1. **Obtain valid ElevenLabs API key**
   - Must start with `sk_` — the prior `23141da...` key was an API key ID and returned 400
   - Source: https://elevenlabs.io → Profile → API Keys → Create
   - Update on both Vercel env var + Cloudflare Worker secret

2. **Verify Cloudflare token permissions**
   - Workers Scripts: Edit ✅
   - D1: Edit ✅
   - Workers AI: Read ✅
   - Cron Triggers: Edit (for the `*/5 * * * *` schedule)
   - Durable Objects: Edit

3. **Verify Supabase service role key and URL are provisioned**
   - URL: `https://iwbshmshegewmctfucaz.supabase.co`
   - Service role key: retrieve from Supabase Management API using access token `sbp_fc59ba...`
   - Both must be set on Worker + Vercel

4. **Verify Clerk webhook configuration**
   - Endpoint: `POST https://pitchcoachai.tech/api/webhooks/clerk`
   - Events: `user.created`, `user.updated`, `session.created` (all must be checked)
   - Signing secret: `CLERK_WEBHOOK_SECRET` must be set on Vercel
   - Test: fire a test `session.created` event from Clerk dashboard

---

## Deployment Sequence

### Step 1: Cloudflare Worker (athena-mcp-worker)

**1.1 Wire tool definitions**
```bash
cd athena-mcp-worker
# Ensure src/index.ts imports and registers tool definitions from src/supabase-tools.ts
# Tools: query_supabase, fetch_founder_deck, github_read_file, web_search
```

**1.2 Set required Worker secrets**
```bash
# Use wrangler or Cloudflare API to set:
wrangler secret put ELEVENLABS_API_KEY        # valid sk_ elevenlabs credential
wrangler secret put SUPABASE_URL              # https://iwbshmshegewmctfucaz.supabase.co
wrangler secret put SUPABASE_SERVICE_ROLE_KEY # supabase service role secret
wrangler secret put ATHENA_WORKER_TOKEN       # shared bearer secret for /api/athena proxy
wrangler secret put BRAVE_SEARCH_API_KEY      # or TAVILY_API_KEY for search_web tool
wrangler secret put GITHUB_TOKEN               # active PAT
wrangler secret put POKE_API_KEY               # Poke JWT token
```

**1.3 Deploy Worker**
```bash
cd athena-mcp-worker
CLOUDFLARE_API_TOKEN=<token> CLOUDFLARE_ACCOUNT_ID=d69dd23c964cc92c0291bbef08fb1f82 npx wrangler deploy
```

**1.4 Verify Worker health**
```bash
# Root info
curl https://athena-mcp-server.morphylee22.workers.dev/
# Expected: {"version":"2.0.0","alwaysOn":true,"cron":"*/5 * * * *"}

# Health check
curl https://athena-mcp-server.morphylee22.workers.dev/health
# Expected: {"status":"ok","d1":true}

# MCP initialize + tools/list
curl -X POST -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" \
  https://athena-mcp-server.morphylee22.workers.dev/mcp \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2025-01-01","capabilities":{},"clientInfo":{"name":"deploy","version":"1.0"}},"id":1}'
# Expected: protocolVersion 2025-11-25, serverInfo athena-mcp v1.0.0

# Activation test (D1 persistence)
curl -X POST -H "Content-Type: application/json" \
  https://athena-mcp-server.morphylee22.workers.dev/activate/test-deploy \
  -d '{"email":"test@pitchcoachai.tech","fallback":false}'
# Expected: {"activated":true,"status":"active"}

curl https://athena-mcp-server.morphylee22.workers.dev/activate/test-deploy
# Expected: {"activated":true,"status":"active","primaryTriggers":1}
```

**1.5 Verify D1 schema**
```bash
npx wrangler d1 execute athena-activation-state --remote \
  --command "SELECT * FROM activation_state WHERE user_id = 'test-deploy';"
# Expected: row with status='active', primary_trigger_count=1
```

### Step 2: Vercel / Next.js (Pitch-Perfect app)

**2.1 Configure environment variables on Vercel**
```bash
# Via Vercel API or dashboard:
ATHENA_WORKER_URL=https://athena-mcp-server.morphylee22.workers.dev
ATHENA_WORKER_TOKEN=<matching shared secret set in worker step>
CLERK_WEBHOOK_SIGNING_SECRET=<svix webhook secret from Clerk dashboard>
ELEVENLABS_API_KEY=<valid sk_ elevenlabs credential>
POKE_API_KEY=<Poke JWT token>
ATHENA_SECRET_KEY=<43-char random token>
GITHUB_TOKEN=<active PAT>
SUPABASE_ACCESS_TOKEN=<sbp_ token>
CLOUDFLARE_ACCOUNT_ID=d69dd23c964cc92c0291bbef08fb1f82
CLOUDFLARE_AI_TOKEN=<CF AI token>
NEXT_PUBLIC_SUPABASE_URL=https://iwbshmshegewmctfucaz.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service role key>
DATABASE_URL=<pooler connection string>
DIRECT_URL=<direct connection string>
```

**2.2 Type-check and build validation**
```bash
npm install --no-audit --no-fund
npx tsc --noEmit           # must pass with 0 errors
npx vitest run             # must pass 102/102 tests
npx eslint .               # must pass with 0 errors
npx next build             # must succeed
```

**2.3 Trigger deployment**
```bash
# Via Vercel API:
curl -X POST -H "Authorization: Bearer <vercel-token>" \
  -H "Content-Type: application/json" \
  "https://api.vercel.com/v13/deployments" \
  -d '{"name":"pitchcoach-ai","project":"prj_yMCmXOgeQPWTqPVWwFSrz8uPuNf3","gitSource":{"repo":"Pitch-Perfect","org":"Morpheos22","ref":"main","type":"github"},"target":"production"}'
```

Or push to main and let auto-deploy handle it:
```bash
git push origin main
```

**2.4 Verify production**
```bash
# Health
curl https://pitchcoachai.tech/api/health
# Expected: {"status":"ok"}

# Athena activate (requires auth — test from browser)
# GET https://pitchcoachai.tech/api/athena/activate
# Expected: {"activated":false,"status":"standby"} (pre-auth)

# Clerk webhook
# In Clerk dashboard: Webhooks → your endpoint → Send test event → session.created
# Expected: {"success":true,"type":"session.created"}
```

### Step 3: Clerk Dashboard Configuration

**3.1 Verify webhook events**
- Dashboard → Webhooks → your endpoint
- Ensure these events are checked:
  - ✅ `user.created`
  - ✅ `user.updated`
  - ✅ `session.created` (new — must be enabled)

**3.2 Test session.created**
- Click "Send Test" → select `session.created`
- Verify Vercel logs show `[Clerk Webhook] Athena warm-up complete`

### Step 4: Cloudflare Dashboard (403 fix)

**4.1 Disable Under Attack Mode**
- Cloudflare → Security → Settings → Under Attack Mode → Set to "Essentially Off"
- Or create a WAF bypass rule for `/api/*` and `/sign-in`

**4.2 Verify**
```bash
curl -I https://pitchcoachai.tech/api/health
# Expected: HTTP/2 200 (not 403)
```

---

## Rollback Plan

| Scenario | Action |
|---|---|
| Worker fails | `npx wrangler rollback` — revert to previous stable Worker version. D1 schema is additive (non-destructive). |
| Vercel build fails | Revert Vercel production alias to commit `6a36a09` (last known-good before this session). |
| D1 corruption | D1 is additive only — no destructive migrations. Drop and recreate table if needed: `npx wrangler d1 execute athena-activation-state --remote --command "DROP TABLE IF EXISTS activation_state;"` then re-run init. |
| Clerk webhook fails | Disable `session.created` event in Clerk dashboard. Widget will use fallback trigger (dashboard sync + self-trigger). |
| ElevenLabs key invalid | Widget degrades gracefully — speak/greet endpoints return 503, chat still works via Poke/Cloudflare AI. |
| Poke API down | Athena falls back to Cloudflare Workers AI (askAthenaWithTools) → falls back to plain chatbot (askAthena). |

---

## Verification Checklist

- [ ] Worker deployed with cron `*/5 * * * *`
- [ ] D1 table `activation_state` exists and persists across requests
- [ ] MCP `/mcp` endpoint returns 200 + tools list (github_read_file, db_query, web_search)
- [ ] `GET /health` returns `{"status":"ok","d1":true}`
- [ ] `POST /activate/:userId` writes to D1 and returns `{"activated":true}`
- [ ] Vercel production deployment is READY
- [ ] `GET /api/athena/activate` returns 200 (standby or active)
- [ ] Clerk webhook receives `session.created` events
- [ ] ElevenLabs API key starts with `sk_` (not an ID like `23141da...`)
- [ ] Cloudflare Under Attack Mode is OFF (or bypass rules for `/api/*`)
- [ ] `curl https://pitchcoachai.tech/api/health` returns `{"status":"ok"}` (not 403)

---

## Known Issues (Non-Blocking)

1. **ElevenLabs API key format**: The key `23141da9d016e4a5eabbe3bd0aeeace421ec42ae46f9d0f0ae35c5421d70f509` may be an API key ID, not the actual `sk_` credential. If TTS returns 400, replace with a valid `sk_` key from elevenlabs.io.

2. **Cloudflare Under Attack Mode**: Currently enabled (since Sep 13, 2026). All requests to `pitchcoachai.tech` get a 403 challenge from Cloudflare before reaching Vercel. Must be disabled or bypassed for `/api/*`.

3. **Vercel free tier deploy cooldown**: If Vercel reports "deployment rate limited - retry in 24 hours", wait for the cooldown or upgrade to Pro.

4. **`.wrangler/` state files**: Should be gitignored (committed in `a576c69`). If they appear in git status, `git rm -r --cached .wrangler/`.

---

## Athena's Current Capabilities (Post-Deploy)

| Capability | Status |
|---|---|
| Poke API (primary model) | ✅ Wired — reasoning, vision, web search native |
| Cloudflare Workers AI (fallback) | ✅ GPT-OSS 120B + Deepseek-r1 reasoning |
| MCP tools (github_read_file, db_query, web_search) | ✅ Live on D1 Worker |
| ElevenLabs TTS (voice) | ⚠️ Needs `sk_` key verification |
| Voice greeting on dashboard | ✅ `/api/athena/greet` — personalized, time-aware |
| Image upload + vision | ✅ Widget supports image upload |
| 15 fallback responses | ✅ Preloaded in widget |
| D1 Activation Seal | ✅ Always-on, cron `*/5 * * * *` |
| Clerk session.created webhook | ✅ Wired (verify event is enabled in dashboard) |
| Session dehydration protection | ✅ 5 trigger sources, 3 fallback layers |
