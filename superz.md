# Super Z — Agent Memory & Context Layer

> **Purpose:** This file serves as a persistent memory and context layer for AI agents (Super Z) working on the Pitch-Perfect project. It captures architectural decisions, credential locations, known gotchas, and session state so that any agent can pick up seamlessly from where the last session left off.

> **Last Updated:** Session 6 — 2026-04-28

---

## Project Identity

| Field | Value |
|-------|-------|
| **Name** | PitchCoach AI (Pitch-Perfect) |
| **Owner** | Automagikal / Morpheos22 |
| **Domain** | [pitchcoachai.tech](https://pitchcoachai.tech) |
| **GitHub** | `Morpheos22/Pitch-Perfect` |
| **Vercel Project** | `prj_yMCmXOgeQPWTqPVWwFSrz8uPuNf3` (**ONLY project — do NOT create new ones without explicit user consent**) |
| **Vercel Team** | `team_TNwiHOn00sbMKfOUikvM6B24` (morpheos-projects) |
| **Framework** | Next.js 16 (App Router) + React 19 + Prisma 6 + Tailwind CSS 4 |

---

## Architecture Overview

### Stack
- **Frontend:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, shadcn/ui
- **Backend:** Next.js API Routes, Prisma ORM 6
- **Database:** PostgreSQL via Supabase (project ref: `iwbshmshegewmctfucaz`, region: eu-west-2)
- **Auth:** Clerk (pk_live_ production mode)
- **AI:** Z.ai Gateway (GLM-4-Plus) with SDK + HTTP fallback
- **Kal Protocol:** Dual-layer AI behavioral framework (V1 background retry + V2 contextual chat)
- **Kal Agent:** Authenticated agent at `kal-agent-morpheos255918280.on.adaptive.ai` (PRIMARY)
- **Kal Middleware:** Legacy unauthenticated fallback at `kal-middleware-morpheos255918280.adaptive.ai`
- **Storage:** Vercel Blob (client-side direct upload)
- **Billing:** Stripe (international) + Paystack (African markets) + Zoho CRM
- **Email:** Resend
- **Cache/Rate Limiting:** Upstash Redis (with circuit breaker fallback)
- **Logging:** Structured logger (`src/lib/logger.ts`) — debug/info gated behind NODE_ENV=development
- **Hosting:** Vercel (serverless functions, auto-deploy from GitHub `main` branch)

### 5 Coaching Modules
| Code | Module | Description |
|------|--------|-------------|
| E1 | Pitch Deck Analyser | Upload deck for content + visual analysis |
| E2 | Script Coach | Elevator pitch script analysis + Kal chat |
| E3 | Live Pitch Coach | 3-min video recording + delivery/body language feedback |
| E4 | Full Pitch Session | 30-min video + deck combined analysis |
| E5 | Founder | Readiness, pathway, research, cohort, network, narration |

### Kal Protocol 2.0
- **8-step critical thinking framework** for AI behavioral analysis
- **10 contextual questions** with element mapping (hook, problem, solution, credibility, CTA)
- **2 fallback responses** (KAL_V2_FALLBACK_SCRIPT, KAL_V2_PLACEHOLDER_MESSAGE)
- **Triple path:** Kal Agent (authenticated, PRIMARY) → Kal Middleware (legacy fallback) → Z.ai direct (final fallback)
- **Dual-backend client:** `src/lib/kal-middleware-client.ts` auto-selects Agent vs Middleware based on env vars
- **Agent auth:** `x-kal-api-key` header sent when `KAL_AGENT_URL` is configured
- **Endpoint mapping:** Agent uses `/api/rpc/analyzeScript` vs Middleware `/api/rpc/analyzeKalScript`
- **Full endpoint set (Agent):** analyzeScript, runTenQuestions, generateSummary, coachingChat, health
- **Files:** `src/lib/kal-protocol-v2.ts` (702 lines), `src/lib/kal-middleware-client.ts` (~550 lines)
- **API:** `src/app/api/kal/chat/route.ts`, `src/app/api/kal/prewarm/route.ts`
- **UI:** `src/components/kal/kal-chat-widget.tsx` (544 lines)

---

## Credential Locations

> **CRITICAL:** No credentials are stored in this file or any file committed to git. All credentials live exclusively in:
> 1. `.env.local` (gitignored via `.env*` pattern, `!.env.example` exception)
> 2. Vercel project environment variables (encrypted)
> 3. User's own records

### Where to Find Credentials
| Service | Env Var Name | Where Set |
|---------|-------------|-----------|
| Supabase DB | `DATABASE_URL`, `DIRECT_URL` | `.env.local` + Vercel env |
| Supabase URL | `NEXT_PUBLIC_SUPABASE_URL` | `.env.local` + Vercel env |
| Supabase Anon Key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env.local` + Vercel env |
| Supabase Service Role | `SUPABASE_SERVICE_ROLE_KEY` | `.env.local` + Vercel env |
| Clerk Publishable | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `.env.local` + Vercel env |
| Clerk Secret | `CLERK_SECRET_KEY` | `.env.local` + Vercel env |
| Clerk Webhook | `CLERK_WEBHOOK_SECRET` | `.env.local` + Vercel env |
| Z.ai API | `ZAI_API_KEY`, `ZAI_TOKEN` | `.env.local` + Vercel env |
| Z.ai Base URL | `ZAI_BASE_URL` | `.env.local` + Vercel env |
| Z.ai User | `ZAI_USER_ID` | `.env.local` + Vercel env |
| Kal Agent URL | `KAL_AGENT_URL` | `.env.local` + Vercel env |
| Kal Agent API Key | `KAL_API_KEY` | `.env.local` + Vercel env |
| Kal Middleware URL | `KAL_MIDDLEWARE_URL` | `.env.local` + Vercel env |
| Vercel Blob | `BLOB_READ_WRITE_TOKEN` | `.env.local` + Vercel env |
| Vercel Project ID | `VERCEL_PROJECT_ID` | `.env.local` (informational only) |
| Vercel API Token | `VERCEL_TOKEN` | `.env.local` + Vercel env (used for CLI/API operations) |
| GitHub PAT | `GITHUB_TOKEN` | `.env.local` + Vercel env |
| Google AI / Vertex AI | `GOOGLE_GENAI_API_KEY` | `.env.local` + Vercel env |
| Google Cloud Project | `GOOGLE_CLOUD_PROJECT` | `.env.local` + Vercel env (empty = AI Studio endpoint) |

### Vercel Deploy Hook
`https://api.vercel.com/v1/integrations/deploy/prj_yMCmXOgeQPWTqPVWwFSrz8uPuNf3/LGBDEY1mZs`
- Use this to trigger redeployments when env vars change (push to GitHub auto-triggers deploys for code changes)

### Vercel Project Linking
- `.vercel/project.json` contains `{"orgId":"team_TNwiHOn00sbMKfOUikvM6B24","projectId":"prj_yMCmXOgeQPWTqPVWwFSrz8uPuNf3"}`
- If `.vercel/` is missing, recreate this file — do NOT run `vercel link` (it may create a new project)
- Vercel API token (`VERCEL_TOKEN`) has full project scope for env var management via REST API

---

## Service Handshake Status (Session 6)

All 8 services verified reachable. The `/api/health?full=true` endpoint now checks all of these:

| # | Service | Handshake Method | Status |
|---|---------|-----------------|--------|
| 1 | **Supabase REST API** | `GET /rest/v1/` with apikey header | ✅ ACTIVE |
| 2 | **Supabase DB** | `prisma.$queryRaw\`SELECT 1\`` | ✅ ACTIVE |
| 3 | **Kal Agent** | `POST /api/rpc/health` with x-kal-api-key | ✅ ACTIVE (bridgeStatus=ok, all 5 RPC endpoints verified) |
| 4 | **Z.ai Gateway** | SDK chat.completions + HTTP fallback | ✅ ACTIVE |
| 5 | **Vercel** | REST API project lookup | ✅ ACTIVE |
| 6 | **GitHub** | API repos lookup with PAT | ✅ ACTIVE |
| 7 | **Google AI** | `GET /v1beta/models?key=` | ⚠️ Region-blocked from dev (works from Vercel US/EU) |
| 8 | **Clerk Auth** | `GET /v1/users?limit=1` with secret key | ✅ ACTIVE |

### Health Check Response Structure
```json
{
  "supabase": { "status": "ok", "restApiReachable": true, "hasAnonKey": true, "hasServiceRoleKey": true, "dbUrl": "connected" },
  "database": { "status": "ok" },
  "ai": { "status": "ok", "configFound": true },
  "kal": { "status": "ok", "mode": "agent", "bridgeStatus": "ok" },
  "googleAI": { "configured": true, "provider": "google-ai-studio" },
  "storage": { "status": "ok", "backend": "vercel-blob" },
  "entitlement": { "devEmailsConfigured": true }
}
```

---

## Known Gotchas

### 🔴 MUST KNOW — Will Break Things

1. **Supabase pooler region is `aws-1-eu-west-2`**
   - The hostname `aws-0-af-south-1.pooler.supabase.com` does **NOT resolve in DNS** — never use it
   - The project was originally configured with af-south-1 which is wrong
   - Only `aws-1-eu-west-2.pooler.supabase.com` (13.41.127.111) resolves and accepts auth

2. **Direct DB hostname resolves to IPv6 only**
   - `db.iwbshmshegewmctfucaz.supabase.co` resolves to IPv6 only
   - Will fail from IPv4-only environments (some CI/CD, some cloud build environments)
   - Always use the pooler hostname for Prisma connections

3. **`CLERK_WEBHOOK_SECRET` must be set**
   - Without it, the webhook handler returns HTTP 500
   - New user sign-ups will NOT create DB records → users get errors on authenticated pages
   - Webhook endpoint: `https://pitchcoachai.tech/api/webhooks/clerk`
   - Events to subscribe: `user.created`, `user.updated`
   - **Status:** Set in `.env.local` AND Vercel env (synced in Session 5)

4. **Only ONE Vercel project: `prj_yMCmXOgeQPWTqPVWwFSrz8uPuNf3`**
   - Do NOT create additional Vercel projects without explicit user consent
   - Both "pitchcoach-ai" and "my-project" deployments seen in GitHub are linked to this single project
   - If `vercel link` creates a new project, delete it and manually set `.vercel/project.json`

5. **20-minute inactivity auto-logout (STANDING INSTRUCTION)**
   - Users are automatically signed out after 20 minutes of inactivity
   - Enforced globally via `InactivityGuard` at root layout level
   - Uses `sessionStorage` timestamp + running inactivity timer + visibility change detection
   - Admin endpoint `POST /api/auth/revoke-all` can force-logout all users (admin emails only)
   - Do NOT reduce this timeout without explicit user consent

6. **Never hardcode credentials**
   - All API keys, tokens, and secrets must go into `.env.local` (local) and Vercel env vars (production)
   - The `.env.example` file has placeholder values — never put real credentials there
   - Use `process.env.VARIABLE_NAME` in code, never literal strings

7. **Vercel env var updates require redeploy**
   - After changing Vercel env vars via API, you MUST trigger a redeploy for them to take effect
   - Use the deploy hook or push a commit to trigger redeployment

### 🟡 BE AWARE — May Cause Confusion

8. **Prisma migration state:** `0_init` is baselined (marked as applied) on the existing database. Schema is up to date. New migrations should be created with `prisma migrate dev` for any future schema changes.

9. **Build script** (`scripts/vercel-build.sh`) runs `prisma migrate deploy` before `next build`. This works because Vercel's build environment CAN reach the eu-west-2 pooler.

10. **ZAI_CHAT_ID is empty** in `.env.local` — unclear if this is required for Z.ai SDK functionality. The SDK works without it for chat completions.

11. **40 tests pass** (ai-utils: 32, with-auth: 4, entitlement: 4). No Kal Protocol 2.0 specific tests exist yet.

12. **Vercel API token now has full project scope** — the token provided in Session 5 (`vcp_7diJ...`) CAN manage env vars via REST API. Previous sessions had a token with limited scope.

13. **Redis circuit breaker** — If Upstash Redis is unreachable, the rate limiter enters cooldown (30s retry window). All rate-limited endpoints will allow requests through (fail-open) during Redis outage. This is intentional graceful degradation.

14. **Structured logger** — `console.log` calls in coach routes have been replaced with `src/lib/logger.ts`. Debug/info logs are no-ops in production; warn/error always emit. Do NOT revert to raw `console.log` in these files.

15. **Google AI region blocking** — The Google AI API may be region-blocked (400 "User location is not supported") from certain regions. This is detected at runtime. The Z.ai gateway (primary) handles fallback automatically. Region block only affects local dev in certain regions — works fine from Vercel US/EU.

16. **Kal Agent vs Middleware endpoints differ** — Agent uses `/api/rpc/analyzeScript`, Middleware uses `/api/rpc/analyzeKalScript`. The client (`kal-middleware-client.ts`) auto-maps based on which backend is active. Don't hardcode endpoint paths outside the client.

17. **tsconfig.json excludes `scripts/`** — Script files have duplicate `main()` functions and TS errors. They're excluded from the main build. Run scripts with `npx tsx` not `tsc`.

---

## Codebase Sweep Status (Sessions 4-5)

### Batch 1 — Critical Infrastructure ✅
- Created missing `/api/blob/upload/route.ts` — handleUpload() with Clerk auth, category validation, DELETE handler
- Deleted `analyze_screenshots.mjs` — contained hardcoded JWT
- Enforced host allowlist in `storage.ts` (SSRF protection)
- Added IPv6 private IP bypass to block list
- Removed 5 unused Supabase vars from `.env.local`
- Fixed stale Stripe vars in `.env.example`

### Batch 2 — Error Handling & Rate Limiting ✅
- Created `src/app/error.tsx` — root error boundary
- Created `src/app/(dashboard)/error.tsx` — dashboard error boundary
- Added rate limiting to change-password route (5 req/15min/user)
- Removed `/api/user/sync` from rate-limit skip list
- Fixed downstream: DELETE handler for blob cleanup, PutBlobResult type, handleUpload body type

### Batch 3 — Script Check E2E ✅
- Added text input tab to elevator-script/new page
- Made targetAudience and targetDuration user-selectable
- Added Kal Protocol activation on iterate failure
- Added onUploadProgress callback + upload progress bar
- E2E smoke test passed

### Batch 4 — Dead Code Cleanup ✅
- Deleted dead compare route, unused dialog.tsx component
- Removed `@radix-ui/react-dialog` from package.json
- Removed unused PresentationIcon import
- Extracted `plan-config.ts` (shared PLAN_LIMITS, formatPlanName, getScoreColor)
- Extracted `useUnsavedChangesWarning()` hook
- Removed dead onComplete no-op from kal-chat

### Batch 5 — Anti-Pattern Remediation ✅
- 5A: Fixed useEffect dependency arrays (useCallback wrappers, ref pattern for callbacks)
- 5B: Created `src/lib/logger.ts` — structured debug logger; applied to E1/E2 coach routes
- 5C: Fixed `any` types in Stripe webhook (unknown + instanceof, typed intersection)
- 5D: Added cancelled subscription grace period (CANCELLED in ACTIVE_STATUSES, currentPeriodEnd check)
- 5D: Fixed cancelAtPeriodEnd bug (now uses Stripe's cancel_at_period_end field directly)
- 5D: Fixed stripeSubscriptionId bug (was storing payment_intent ID; now uses subscription ID)
- 5E: Implemented fetchSubscriptionPeriodEnd() — actual Stripe API lookup, 30-day fallback
- 5F: Added Redis circuit breaker with 30s cooldown retry

### Batch 6 — Documentation & Deployment ✅
- Updated superz.md with full session 4 context
- Updated worklog.md with all batch details
- Pushed all commits to GitHub (Morpheos22/Pitch-Perfect)
- Triggered Vercel deployment via deploy hook — both deployments SUCCESS

### Session 5 — Kal Agent + Supabase Handshake + Credential Sync ✅
- Rewrote `kal-middleware-client.ts` — dual-backend architecture (Agent PRIMARY + Middleware LEGACY)
- Added Kal Agent authenticated health check to `/api/health`
- Added Supabase as named handshake in `/api/health` (REST API + DB + key presence)
- Cross-referenced ALL user credentials against `.env.local` and Vercel
- Added 5 missing vars to `.env.local`: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, VERCEL_TOKEN, GITHUB_TOKEN
- Updated 8 vars on Vercel via REST API (PATCH)
- Updated `.env.example` with Supabase SDK, Vercel, GitHub placeholders
- Fixed tsconfig.json: excluded scripts/ (duplicate main functions)
- Fixed e2e-script-check.ts: log.info 4-arg call
- Fixed health route: warnings array used before declaration
- 2 commits pushed: `35fd42b` and `9b9ad1d`
- Vercel redeploy triggered with all new env vars
- Full handshake verification: 8/8 services confirmed reachable

---

## Project Completion Status

### ✅ Complete
- [x] Full Next.js 16 App Router application
- [x] 5 coaching modules (E1-E5) with AI analysis
- [x] Kal Protocol 2.0 — full implementation (protocol + API + agent + chat widget)
- [x] Kal Protocol 2.0 handoff document (DOCX at `/download/Kal_Protocol_2_Handoff_Prompt.docx`)
- [x] Kal Agent authenticated RPC client (dual-backend: Agent + Middleware, all 5 endpoints: analyzeScript, runTenQuestions, generateSummary, coachingChat, health)
- [x] Prisma schema (17 models, 9 enums) with single baseline migration
- [x] Clerk authentication (publishable + secret keys set)
- [x] Z.ai AI Gateway (SDK + HTTP fallback, TTS + Web Search)
- [x] Vercel Blob storage (client-side direct upload with progress)
- [x] Dual billing: Stripe + Paystack
- [x] Zoho CRM integration
- [x] Supabase DB connected and healthy (REST API handshake + Prisma DB connection)
- [x] Production deployment LIVE at pitchcoachai.tech
- [x] 25+ Vercel env vars configured and synced (including NEXT_PUBLIC_SUPABASE_*, KAL_AGENT_*, VERCEL_TOKEN, GITHUB_TOKEN)
- [x] Full codebase sweep (Batches 1-6) — security, dead code, anti-patterns, billing fixes
- [x] SSRF protection (host allowlist + IPv6 private IP blocking)
- [x] Error boundaries (root + dashboard)
- [x] Rate limiting on sensitive endpoints
- [x] Structured logging (debug gated in production)
- [x] Redis circuit breaker (graceful degradation)
- [x] Cancelled subscription grace period
- [x] Stripe billing period from API (not hardcoded)
- [x] Script Check E2E fully functional (text input + file upload + Kal Protocol)
- [x] Health check covers ALL services: Supabase, Kal Agent, Z.ai, Google AI, DB, Storage

### ⚠️ Still Outstanding
- [ ] Test: sign up → verify DB record created → verify Clerk webhook fires
- [ ] Add Kal Protocol 2.0 test coverage
- [ ] Add E2E/integration tests for critical flows
- [ ] Verify `ZAI_CHAT_ID` requirement
- [ ] Apply structured logger to remaining modules (E3, E4, E5 routes — currently still using console.log)
- [ ] Google AI / Vertex AI region-blocked from certain dev locations — works from Vercel

---

## Session History

### Session 1 (Previous — context from summary)
- Batch 1 completed: core architecture, modules, initial deployment
- Batch 2 started: Blob upload fix, Kal Protocol 2.0, .env updates

### Session 2 (Previous — context from summary)
- Prisma migration consolidation (5 → 1 baseline)
- DB credentials and Clerk key setup
- Vercel deploy pipeline configured

### Session 3 (Previous — context from summary)
- Handshakes verified: All 8 services confirmed live
- Critical DNS bug fixed: Supabase pooler region corrected
- DB password corrected
- Migration baselined
- Clerk secret key updated and pushed to Vercel
- Clerk webhook secret set in `.env.local` (NOT in Vercel — API lost scope)
- Production fully LIVE: `pitchcoachai.tech/api/health` returns ok
- superz.md created as agent memory layer
- 7 commits pushed to GitHub

### Session 4
- **Full codebase sweep executed (Batches 1-6)**
- **Batch 1:** Created missing blob upload route, deleted hardcoded JWT file, SSRF protection, cleaned unused env vars
- **Batch 2:** Error boundaries, rate limiting, downstream bug fixes (DELETE handler, type corrections)
- **Batch 3:** Script Check E2E — text input, user-selectable params, Kal Protocol fallback, upload progress
- **Batch 4:** Dead code removal (routes, components, imports), duplicate extraction (plan-config, hook)
- **Batch 5:** Anti-pattern remediation — useEffect deps, structured logger, `any` type fixes, cancelled grace period, Stripe billing period, Redis circuit breaker
- **Batch 6:** Documentation update (superz.md, worklog.md), git push, Vercel deployment triggered
- **4 commits pushed** to GitHub (fb26022 is HEAD)
- **Vercel deployment:** Both deployments SUCCESS (pitchcoach-ai + my-project, both on commit fb26022)
- **TypeScript:** Zero errors on `tsc --noEmit` and `tsc --noEmit --strict`
- **Tests:** 40/40 passing

### Session 5
- **Kal Agent integration:**
  - Verified Kal Agent health: POST /api/rpc/health with x-kal-api-key → 200 OK, bridgeStatus=ok
  - Rewrote `kal-middleware-client.ts` with dual-backend: KAL_AGENT_URL (PRIMARY) + KAL_MIDDLEWARE_URL (LEGACY)
  - Auto endpoint mapping, auth header injection, health check per mode
  - Added `getKalBackendInfo()` diagnostic function
- **Supabase handshake:**
  - Added Supabase as named service in `/api/health` (REST API reachability + key presence + DB status)
  - Added NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY to .env.local
- **Credential sync:**
  - Cross-referenced ALL user-provided credentials against .env.local and Vercel
  - Added 5 missing vars to .env.local (Supabase SDK keys, VERCEL_TOKEN, GITHUB_TOKEN)
  - Updated 8 vars on Vercel via REST API PATCH (full project scope token now available)
  - Updated .env.example with Supabase SDK, Vercel, GitHub placeholders
- **Build fixes:**
  - Fixed tsconfig.json: excluded scripts/ (duplicate main functions)
  - Fixed e2e-script-check.ts: log.info 4-arg call
  - Fixed health route: warnings array used before declaration
- **Full handshake verification:** 8/8 services confirmed reachable
- **2 commits pushed:** `35fd42b` (Kal Agent) and `9b9ad1d` (Supabase handshake)
- **Vercel redeploy triggered** with all updated env vars
- **HEAD:** `9b9ad1d` on `main`

### Session 6 (Current)
- **Kal Agent full endpoint verification:**
  - health: POST /api/rpc/health → 200 OK, bridgeStatus=ok, protocol="Kal Protocol 2.0"
  - analyzeScript: POST /api/rpc/analyzeScript → 200 OK, full script analysis with scores, improvements, rewrite
  - runTenQuestions: POST /api/rpc/runTenQuestions → 200 OK, 10-question flow with session state
  - coachingChat: POST /api/rpc/coachingChat → 200 OK, freeform coaching with session state
  - generateSummary: POST /api/rpc/generateSummary → 200 OK, SUMMARY + KEY_ISSUES + BOTTOM_LINE + QUICK_FEEDBACK
- **Extended `kal-middleware-client.ts`** with:
  - KalRunTenQuestionsRequest/Response types
  - KalCoachingChatRequest/Response types
  - `runTenQuestions` and `coachingChat` in ENDPOINT_MAP
  - `kalRunTenQuestions()` and `kalCoachingChat()` public functions
  - Middleware fallback: maps both to analyzeKalScript (no dedicated endpoints)
- **Verified .env.local** already has KAL_AGENT_URL and KAL_API_KEY
- **Verified Vercel env vars** already has all 5 previously missing vars (pushed in Session 5)
- **TypeScript:** Zero errors on tsc --noEmit
- **1 commit pushed:** `2e4fa57` ("feat: add runTenQuestions + coachingChat endpoints to Kal Agent client")
- **HEAD:** `2e4fa57` on `main`

---

## File Map (Key Files)

| Path | Purpose |
|------|---------|
| `prisma/schema.prisma` | 17 models, 9 enums — full E1-E5 + billing + Kal schema |
| `prisma/migrations/0_init/migration.sql` | Single consolidated baseline migration |
| `scripts/vercel-build.sh` | Build pipeline: prisma generate → migrate deploy → next build |
| `src/lib/ai-service.ts` | Core AI service — Z.ai SDK init + HTTP fallback (~1760 lines) |
| `src/lib/kal-protocol-v2.ts` | Kal Protocol 2.0 — 10 questions, critical thinking, middleware (702 lines) |
| `src/lib/kal-middleware-client.ts` | Dual-backend RPC client — Kal Agent (PRIMARY) + Middleware (LEGACY), all 5 endpoints (~550 lines) |
| `src/lib/vertex-ai.ts` | Google AI / Vertex AI fallback for E2 script check (~354 lines) |
| `src/lib/db.ts` | Prisma client (lazy singleton, defers validation to first access) |
| `src/lib/logger.ts` | Structured logger — createLogger(module), debug gated in prod |
| `src/lib/plan-config.ts` | Shared constants — PLAN_LIMITS, formatPlanName, getScoreColor |
| `src/lib/storage.ts` | File storage with SSRF protection (host allowlist + private IP block) |
| `src/lib/rate-limit.ts` | Redis-backed rate limiting with circuit breaker fallback |
| `src/app/api/health/route.ts` | Full health diagnostics — Supabase, Kal, Z.ai, Google AI, DB, Storage |
| `src/app/api/blob/upload/route.ts` | Vercel Blob upload — handleUpload with auth + validation + DELETE |
| `src/app/api/kal/chat/route.ts` | Kal chat API — POST/PATCH/GET (249 lines) |
| `src/app/api/webhooks/clerk/route.ts` | Clerk webhook — user.created, user.updated |
| `src/app/error.tsx` | Root error boundary |
| `src/app/(dashboard)/error.tsx` | Dashboard error boundary |
| `src/hooks/use-inactivity-logout.ts` | 20-min inactivity auto-logout (standing security instruction) |
| `src/components/auth/inactivity-guard.tsx` | Global InactivityGuard wrapping root layout |
| `src/app/api/auth/revoke-all/route.ts` | Admin-only endpoint to revoke all Clerk sessions |
| `src/components/kal/kal-chat-widget.tsx` | Interactive Kal chat widget (544 lines) |
| `.vercel/project.json` | Vercel project link — orgId + projectId (recreate if missing) |
| `worklog.md` | Detailed agent work log (gitignored, for internal use) |
| `superz.md` | **This file** — agent memory & context layer |

---

## Agent Guidelines

1. **Read this file first** at the start of every session to understand current state
2. **Read `worklog.md`** for detailed task history
3. **Never hardcode credentials** in any file — always use env vars
4. **Never use `aws-0-af-south-1`** for Supabase pooler — it doesn't resolve
5. **Always test handshakes** after making env var changes
6. **Update this file** at the end of every session with new findings, fixes, or state changes
7. **Append to worklog.md** — never overwrite previous entries
8. **Use the Vercel deploy hook** for manual redeployments when only env vars change
9. **Commit meaningful messages** — no UUID-only commit messages
10. **Do NOT create new Vercel projects** — `prj_yMCmXOgeQPWTqPVWwFSrz8uPuNf3` is the ONLY project; seek explicit user consent before creating any new project
11. **If `.vercel/` is missing**, recreate `.vercel/project.json` manually with `{"orgId":"team_TNwiHOn00sbMKfOUikvM6B24","projectId":"prj_yMCmXOgeQPWTqPVWwFSrz8uPuNf3"}` — do NOT run `vercel link`
12. **Use `src/lib/logger.ts`** for all logging — never add raw `console.log` in coach/API routes
13. **Redis fail-open** — if Redis is down, rate limiting allows requests through; do NOT change to fail-closed
14. **20-minute inactivity auto-logout** — standing security instruction; do NOT reduce timeout without explicit user consent
15. **`POST /api/auth/revoke-all`** — admin-only, use to force-logout all users when needed
16. **Vercel env var management** — use the REST API with `VERCEL_TOKEN` (`PATCH /v9/projects/{PID}/env/{ENV_ID}`). The token has full project scope.
17. **Scripts excluded from tsconfig** — `scripts/` dir is excluded from TypeScript compilation. Run scripts with `npx tsx scripts/...` not `tsc`.
18. **Kal client auto-selects backend** — when `KAL_AGENT_URL` is set, it's PRIMARY (authenticated). When not set, falls back to `KAL_MIDDLEWARE_URL`. Don't bypass this logic.
