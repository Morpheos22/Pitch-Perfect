# Super Z — Agent Memory & Context Layer

> **Purpose:** This file serves as a persistent memory and context layer for AI agents (Super Z) working on the Pitch-Perfect project. It captures architectural decisions, credential locations, known gotchas, and session state so that any agent can pick up seamlessly from where the last session left off.

> **Last Updated:** Session 4 — 2026-04-27

---

## Project Identity

| Field | Value |
|-------|-------|
| **Name** | PitchCoach AI (Pitch-Perfect) |
| **Owner** | Automagikal / Morpheos22 |
| **Domain** | [pitchcoachai.tech](https://pitchcoachai.tech) |
| **GitHub** | `Morpheos22/Pitch-Perfect` |
| **Vercel Project** | `prj_yMCmXOgeQPWTqPVWwFSrz8uPuNf3` (**ONLY project — do NOT create new ones without explicit user consent**) |
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
- **Middleware:** Adaptive AI agent at `kal-middleware-morpheos255918280.adaptive.ai`
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
- **Dual path:** Adaptive middleware (primary) → Z.ai direct (fallback)
- **Files:** `src/lib/kal-protocol-v2.ts` (702 lines), `src/lib/kal-middleware-client.ts` (297 lines)
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
| Clerk Publishable | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `.env.local` + Vercel env |
| Clerk Secret | `CLERK_SECRET_KEY` | `.env.local` + Vercel env |
| Clerk Webhook | `CLERK_WEBHOOK_SECRET` | `.env.local` + Vercel env (MUST SET) |
| Z.ai API | `ZAI_API_KEY`, `ZAI_TOKEN` | `.env.local` + Vercel env |
| Z.ai Base URL | `ZAI_BASE_URL` | `.env.local` + Vercel env |
| Z.ai User | `ZAI_USER_ID` | `.env.local` + Vercel env |
| Kal Middleware | `KAL_MIDDLEWARE_URL` | `.env.local` + Vercel env |
| Vercel Blob | `BLOB_READ_WRITE_TOKEN` | `.env.local` + Vercel env |
| Vercel Project ID | `VERCEL_PROJECT_ID` | `.env.local` (informational only) |

### Vercel Deploy Hook
`https://api.vercel.com/v1/integrations/deploy/prj_yMCmXOgeQPWTqPVWwFSrz8uPuNf3/LGBDEY1mZs`
- Use this to trigger redeployments when env vars change (push to GitHub auto-triggers deploys for code changes)

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
   - **Status:** Set in `.env.local` but NOT yet in Vercel env vars (API token lost scope — set manually in Vercel Dashboard)

4. **Only ONE Vercel project: `prj_yMCmXOgeQPWTqPVWwFSrz8uPuNf3`**
   - Do NOT create additional Vercel projects without explicit user consent
   - Both "pitchcoach-ai" and "my-project" deployments seen in GitHub are linked to this single project

### 🟡 BE AWARE — May Cause Confusion

5. **Prisma migration state:** `0_init` is baselined (marked as applied) on the existing database. Schema is up to date. New migrations should be created with `prisma migrate dev` for any future schema changes.

6. **Build script** (`scripts/vercel-build.sh`) runs `prisma migrate deploy` before `next build`. This works because Vercel's build environment CAN reach the eu-west-2 pooler.

7. **ZAI_CHAT_ID is empty** in `.env.local` — unclear if this is required for Z.ai SDK functionality. The SDK works without it for chat completions.

8. **40 tests pass** (ai-utils: 32, with-auth: 4, entitlement: 4). No Kal Protocol 2.0 specific tests exist yet.

9. **Vercel API token (`vcp_`) has limited scope** — it works for deploy hooks but CANNOT manage env vars (403 forbidden). If env var management is needed, the user must set vars manually in Vercel Dashboard or provide a fresh token with full project scope.

10. **Redis circuit breaker** — If Upstash Redis is unreachable, the rate limiter enters cooldown (30s retry window). All rate-limited endpoints will allow requests through (fail-open) during Redis outage. This is intentional graceful degradation.

11. **Structured logger** — `console.log` calls in coach routes have been replaced with `src/lib/logger.ts`. Debug/info logs are no-ops in production; warn/error always emit. Do NOT revert to raw `console.log` in these files.

---

## Codebase Sweep Status (Session 4)

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

---

## Project Completion Status

### ✅ Complete
- [x] Full Next.js 16 App Router application
- [x] 5 coaching modules (E1-E5) with AI analysis
- [x] Kal Protocol 2.0 — full implementation (protocol + API + middleware + chat widget)
- [x] Kal Protocol 2.0 handoff document (DOCX at `/download/Kal_Protocol_2_Handoff_Prompt.docx`)
- [x] Adaptive middleware RPC client
- [x] Prisma schema (17 models, 9 enums) with single baseline migration
- [x] Clerk authentication (publishable + secret keys set)
- [x] Z.ai AI Gateway (SDK + HTTP fallback, TTS + Web Search)
- [x] Vercel Blob storage (client-side direct upload with progress)
- [x] Dual billing: Stripe + Paystack
- [x] Zoho CRM integration
- [x] Supabase DB connected and healthy
- [x] Production deployment LIVE at pitchcoachai.tech
- [x] 14+ Vercel env vars configured
- [x] Full codebase sweep (Batches 1-6) — security, dead code, anti-patterns, billing fixes
- [x] SSRF protection (host allowlist + IPv6 private IP blocking)
- [x] Error boundaries (root + dashboard)
- [x] Rate limiting on sensitive endpoints
- [x] Structured logging (debug gated in production)
- [x] Redis circuit breaker (graceful degradation)
- [x] Cancelled subscription grace period
- [x] Stripe billing period from API (not hardcoded)
- [x] Script Check E2E fully functional (text input + file upload + Kal Protocol)

### ⚠️ Still Outstanding
- [ ] Set `CLERK_WEBHOOK_SECRET` in Vercel env vars — **API token lacks scope, must set manually in Vercel Dashboard**
- [ ] Redeploy after Vercel env var is set
- [ ] Test: sign up → verify DB record created → verify webhook fires
- [ ] Add Kal Protocol 2.0 test coverage
- [ ] Add E2E/integration tests for critical flows
- [ ] Verify `ZAI_CHAT_ID` requirement
- [ ] Apply structured logger to remaining modules (E3, E4, E5 routes — currently still using console.log)
- [ ] Adaptive middleware deep integration (replace direct Z.ai calls with middleware RPC for contextual chat scenarios)

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

### Session 4 (Current)
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

---

## File Map (Key Files)

| Path | Purpose |
|------|---------|
| `prisma/schema.prisma` | 17 models, 9 enums — full E1-E5 + billing + Kal schema |
| `prisma/migrations/0_init/migration.sql` | Single consolidated baseline migration |
| `scripts/vercel-build.sh` | Build pipeline: prisma generate → migrate deploy → next build |
| `src/lib/ai-service.ts` | Core AI service — Z.ai SDK init + HTTP fallback (~1760 lines) |
| `src/lib/kal-protocol-v2.ts` | Kal Protocol 2.0 — 10 questions, critical thinking, middleware (702 lines) |
| `src/lib/kal-middleware-client.ts` | Adaptive middleware RPC client (297 lines) |
| `src/lib/db.ts` | Prisma client (lazy singleton, defers validation to first access) |
| `src/lib/logger.ts` | Structured logger — createLogger(module), debug gated in prod |
| `src/lib/plan-config.ts` | Shared constants — PLAN_LIMITS, formatPlanName, getScoreColor |
| `src/lib/storage.ts` | File storage with SSRF protection (host allowlist + private IP block) |
| `src/lib/rate-limit.ts` | Redis-backed rate limiting with circuit breaker fallback |
| `src/app/api/blob/upload/route.ts` | Vercel Blob upload — handleUpload with auth + validation + DELETE |
| `src/app/api/kal/chat/route.ts` | Kal chat API — POST/PATCH/GET (249 lines) |
| `src/app/api/webhooks/clerk/route.ts` | Clerk webhook — user.created, user.updated |
| `src/app/error.tsx` | Root error boundary |
| `src/app/(dashboard)/error.tsx` | Dashboard error boundary |
| `src/components/kal/kal-chat-widget.tsx` | Interactive Kal chat widget (544 lines) |
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
11. **Use `src/lib/logger.ts`** for all logging — never add raw `console.log` in coach/API routes
12. **Redis fail-open** — if Redis is down, rate limiting allows requests through; do NOT change to fail-closed
