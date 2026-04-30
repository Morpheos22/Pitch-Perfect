# Super Z — Agent Memory & Context Layer

> **Purpose:** This file serves as a persistent memory and context layer for AI agents (Super Z) working on the Pitch-Perfect project. It captures architectural decisions, credential locations, known gotchas, and session state so that any agent can pick up seamlessly from where the last session left off.

> **Last Updated:** Session 11 — 2026-04-29

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
- **Billing:** Stripe (international) + Paystack (African markets) — Zoho Billing REMOVED
- **Email:** Zoho CRM SendMail API (all transactional emails — onboarding welcome, Kal Protocol notifications)
- **CRM:** Zoho CRM (lead sync, onboarding completion, welcome email)
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
| Zoho OAuth | `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN`, `ZOHO_API_DOMAIN`, `ZOHO_ORG_ID` | `.env.local` + Vercel env |
| Zoho Sender Email | `ZOHO_SENDER_EMAIL` | `.env.local` + Vercel env (sherwyn@automagikal.co.za) |
| Stripe Prices | `STRIPE_PRICE_PITCH_DECK`, `STRIPE_PRICE_ELEVATOR_SCRIPT`, `STRIPE_PRICE_ELEVATOR_LIVE`, `STRIPE_PRICE_PITCH_DECK_LIVE`, `STRIPE_PRICE_MASTER`, `STRIPE_PRICE_FOUNDER`, `STRIPE_PRICE_FOUNDER_READINESS` | `.env.local` + Vercel env |

### Vercel Deploy Hook
`https://api.vercel.com/v1/integrations/deploy/prj_yMCmXOgeQPWTqPVWwFSrz8uPuNf3/LGBDEY1mZs`
- Use this to trigger redeployments when env vars change (push to GitHub auto-triggers deploys for code changes)

### Vercel Project Linking
- `.vercel/project.json` contains `{"orgId":"team_TNwiHOn00sbMKfOUikvM6B24","projectId":"prj_yMCmXOgeQPWTqPVWwFSrz8uPuNf3"}`
- If `.vercel/` is missing, recreate this file — do NOT run `vercel link` (it may create a new project)
- Vercel API token (`VERCEL_TOKEN`) has full project scope for env var management via REST API

---

## Service Handshake Status (Session 12)

| # | Service | Handshake Method | Status |
|---|---------|-----------------|--------|
| 1 | **Supabase DB** | `prisma.$queryRaw\`SELECT 1\`` via pooler | ✅ ACTIVE |
| 2 | **Supabase REST API** | `GET /rest/v1/` with apikey header | ✅ ACTIVE (150ms latency, anon + service role keys valid) |
| 3 | **Kal Agent** | `POST /api/rpc/health` with x-kal-api-key | ✅ ACTIVE (bridgeStatus=ok, all 5 RPC endpoints verified) |
| 4 | **Z.ai Gateway** | SDK chat.completions + HTTP fallback | ✅ ACTIVE (text + vision via glm-4.6v) |
| 4b | **Z.ai Vision** | `GET /api/health/vision` with x-health-token | ✅ ACTIVE (dedicated endpoint at /api/health/vision) |
| 5 | **Vercel** | REST API project lookup | ✅ ACTIVE |
| 6 | **GitHub** | API repos lookup with PAT | ✅ ACTIVE |
| 7 | **Google AI** | `GET /v1beta/models?key=` | ⚠️ Region-blocked from dev (works from Vercel US/EU) |
| 8 | **Clerk Auth** | FAPI `/v1/client?_is_native=1` + CSP `connect-src` | ✅ ACTIVE (Native API enabled + CSP connect-src FIXED in Session 12) |
| 9 | **Zoho CRM** | `POST /oauth/v2/token` with refresh_token | ⚠️ REGION FIX APPLIED — OAuth hits accounts.zoho.eu. If `invalid_client` persists, credentials need regeneration in Zoho API Console. |

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
   - **Status:** Set in `.env.local` AND Vercel env (synced in Session 7)

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

8. **PLAN_LIMITS single source of truth: `src/lib/plan-config.ts`**
   - All pages MUST import from `@/lib/plan-config` — NEVER duplicate PLAN_LIMITS locally
   - Previous audit found 3 module pages with hardcoded copies that had WRONG values
   - E1-E5 limits per plan: FREE(1,1,0,0,0), STARTER(5,10,3,0,3), PROFESSIONAL(15,30,10,3,10), ENTERPRISE(999,999,999,999,999)

9. **Zoho Billing is REMOVED — Paystack + Stripe only**
   - Zoho billing webhook route is DELETED
   - Zoho is NOT in PaymentProvider enum anymore
   - `createModuleAccess()` in payment-service.ts is the single source of truth for which products grant which module access
   - Products 'founder' and 'founder-readiness' map to PROFESSIONAL plan, e5Access=true

10. **Resend is REMOVED — all email via Zoho CRM SendMail API**
    - `src/lib/email.ts` uses Zoho CRM SendMail for Kal Protocol notifications
    - Onboarding welcome emails go through `completeOnboardingInCRM()` in `src/lib/zoho-crm.ts`
    - Zoho OAuth is consolidated in `src/lib/zoho-auth.ts` (shared between zoho-crm.ts and email.ts)

11. **Clerk Native API is now ENABLED on Production instance (FIXED — Session 11)**
    - User enabled Native API in Clerk Dashboard → both production issues resolved
    - `***REDACTED_CLERK_PUBLISHABLE***` decodes to `clerk.pitchcoachai.tech$` — correct Production key
    - Custom FAPI domain `clerk.pitchcoachai.tech` resolves via Cloudflare (172.64.153.110)
    - CSP `connect-src` now properly allows `clerk.pitchcoachai.tech` (FIXED — Session 12)

12. **🔴 CSP `connect-src` directive MUST have the prefix** — In `next.config.ts`, the connect-sources array MUST be prefixed with `"connect-src "`. Without it, the browser treats the bare values as an invalid directive and blocks ALL cross-origin XHR/fetch — including Clerk JS FAPI calls. This was the root cause of the Session 12 production outage (empty sign-up/sign-in on production but working on Clerk's hosted domain). If you add a new CSP directive, always verify it has the directive name prefix.

13. **Script Check module works once auth is functional**
    - Script Check depends on: Clerk auth → middleware `auth.protect()` → `requireAuth()` → blob upload → coach API
    - No additional upload-specific bug in code — blob upload architecture is sound
    - **Latent risk:** If `BLOB_READ_WRITE_TOKEN` is not properly set on Vercel, uploads will still fail after auth is fixed

### 🟡 BE AWARE — May Cause Confusion

13. **Prisma migration state:** `0_init` is baselined (marked as applied) on the existing database. Schema is up to date. New migrations should be created with `prisma migrate dev` for any future schema changes.

14. **Build script** (`scripts/vercel-build.sh`) runs `prisma migrate deploy` before `next build`. This works because Vercel's build environment CAN reach the eu-west-2 pooler.

15. **ZAI_CHAT_ID is empty** in `.env.local` — unclear if this is required for Z.ai SDK functionality. The SDK works without it for chat completions.

16. **40 tests pass** (ai-utils: 32, with-auth: 4, entitlement: 4). No Kal Protocol 2.0 specific tests exist yet. Note: test files have Babel parser issues with TypeScript generics — pre-existing, not related to code changes.

17. **Vercel API token now has full project scope** — the token provided in Session 5 (`vcp_7diJ...`) CAN manage env vars via REST API. Previous sessions had a token with limited scope.

18. **Redis circuit breaker** — If Upstash Redis is unreachable, the rate limiter enters cooldown (30s retry window). All rate-limited endpoints will allow requests through (fail-open) during Redis outage. This is intentional graceful degradation.

19. **Structured logger** — `console.log` calls in coach routes have been replaced with `src/lib/logger.ts`. Debug/info logs are no-ops in production; warn/error always emit. Do NOT revert to raw `console.log` in these files.

20. **Google AI region blocking** — The Google AI API may be region-blocked (400 "User location is not supported") from certain regions. This is detected at runtime. The Z.ai gateway (primary) handles fallback automatically. Region block only affects local dev in certain regions — works fine from Vercel US/EU.

21. **Kal Agent vs Middleware endpoints differ** — Agent uses `/api/rpc/analyzeScript`, Middleware uses `/api/rpc/analyzeKalScript`. The client (`kal-middleware-client.ts`) auto-maps based on which backend is active. Don't hardcode endpoint paths outside the client.

22. **tsconfig.json excludes `scripts/`** — Script files have duplicate `main()` functions and TS errors. They're excluded from the main build. Run scripts with `npx tsx` not `tsc`.

23. **Stripe price env vars for E5 products** — `STRIPE_PRICE_FOUNDER` and `STRIPE_PRICE_FOUNDER_READINESS` were added to the price map in Session 9 but may not be set in `.env.local` or Vercel yet. Without these, Stripe checkout for Founder Coaching products will throw "No Stripe price configured for founder".

---

## Codebase Sweep Status (Sessions 4-9)

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
- Added Supabase as named handshake in `/api/health`
- Cross-referenced ALL user credentials against `.env.local` and Vercel
- Updated 8 vars on Vercel via REST API PATCH
- Full handshake verification: 8/8 services confirmed reachable

### Session 8 — Resend Removal + Zoho OAuth Consolidation ✅
- Removed all Resend references — onboarding emails now via Zoho CRM SendMail API
- Created `src/lib/zoho-auth.ts` — shared Zoho OAuth module (single token cache, getAccessToken(), ZOHO_CONFIG with senderEmail)
- Refactored `src/lib/zoho-crm.ts` and `src/lib/email.ts` to import from zoho-auth.ts
- Removed Zoho Billing from payment-service.ts, billing portal, create-session route
- Removed Zoho Forms from contact route
- Updated .env.example with ZOHO_SENDER_EMAIL, removed dead vars

### Session 9 — Downstream Bug Fixes + E2E Verification ✅
- P0: Replaced hardcoded PLAN_LIMITS in 3 module pages with imports from `@/lib/plan-config` (pitch-deck-analyser had WRONG e1=20 for PRO)
- P1: Added Stripe price mappings for 'founder' and 'founder-readiness' products
- P2: Removed `as any` casts for e5FounderSessions (type already includes the field)
- P2: Replaced `catch(error: any)` with `catch(error: unknown)` + proper instanceof Error narrowing across 10 API routes + 2 client components
- P2: Replaced `let analysisResult: any` with `Prisma.InputJsonValue` in coach/founder route
- Verified blob upload, AI analysis, Kal Protocol fallback, orphan cleanup flows end-to-end
- Committed as 137d9ed, pushed to GitHub, Vercel deployment triggered (dpl_CEovsm4fz7wJ4UzfGH5MFLcfouW1)

---

## Project Completion Status

### ✅ Complete
- [x] Full Next.js 16 App Router application
- [x] 5 coaching modules (E1-E5) with AI analysis
- [x] Kal Protocol 2.0 — full implementation (protocol + API + agent + chat widget)
- [x] Kal Protocol 2.0 handoff document (DOCX at `/download/Kal_Protocol_2_Handoff_Prompt.docx`)
- [x] Kal Agent authenticated RPC client (dual-backend: Agent + Middleware, all 5 endpoints)
- [x] Prisma schema (17 models, 9 enums) with single baseline migration
- [x] Clerk authentication (publishable + secret keys set)
- [x] Z.ai AI Gateway (SDK + HTTP fallback, TTS + Web Search)
- [x] Vercel Blob storage (client-side direct upload with progress)
- [x] Dual billing: Stripe + Paystack (Zoho Billing REMOVED)
- [x] Zoho CRM integration (lead sync + onboarding email via SendMail API)
- [x] Zoho OAuth consolidated into shared `zoho-auth.ts` module
- [x] Supabase DB connected and healthy (REST API handshake + Prisma DB connection)
- [x] Production deployment LIVE at pitchcoachai.tech
- [x] 25+ Vercel env vars configured and synced
- [x] Full codebase sweep (Batches 1-6 + Sessions 8-9) — security, dead code, anti-patterns, billing fixes, type safety
- [x] SSRF protection (host allowlist + IPv6 private IP blocking)
- [x] Error boundaries (root + dashboard)
- [x] Rate limiting on sensitive endpoints
- [x] Structured logging (debug gated in production)
- [x] Redis circuit breaker (graceful degradation)
- [x] Cancelled subscription grace period
- [x] Stripe billing period from API (not hardcoded)
- [x] Script Check E2E fully functional (text input + file upload + Kal Protocol)
- [x] Health check covers ALL services: Supabase, Kal Agent, Z.ai, Google AI, DB, Storage
- [x] PLAN_LIMITS single source of truth enforced across all pages
- [x] No `catch(error: any)` in user-facing API routes (all use `unknown` with instanceof narrowing)
- [x] Stripe checkout for E5 Founder Coaching products now supported


### 🔴 Sign-Up Failure — 5 Bugs Identified (Session 11 Scan)

**Batch 1 — Clerk Dashboard Actions (USER DOES THESE — PREREQUISITE):**
- [ ] Disable Turnstile CAPTCHA on sign-up (or verify site keys cover `pitchcoachai.tech`) — Clerk Dashboard → Users & Authentication → Sign-up
- [ ] Set After sign-up URL to `/onboarding` — Clerk Dashboard → Paths → After sign-up (currently set to `/` → double redirect)
- [ ] Verify `verify_at_sign_up: true` is intentional — Clerk Dashboard → Users & Authentication → Email

**Batch 2 — Webhook Handler Fixes (1 file: `src/app/api/webhooks/clerk/route.ts`):**
- [ ] BUG #1: `isBlockedEmail()` → delete Clerk user instead of silent return (prevents zombie users with Clerk account but no DB record)
- [ ] BUG #2: `prisma.subscription.create()` + `prisma.usage.create()` → `upsert()` (fixes race condition with onboarding route causing webhook 500s)
- [ ] BUG #4: Add email-orphan recovery — if `clerkId` lookup fails, check by email and update orphaned record with new `clerkId`

**Batch 3 — ClerkProvider + Middleware Hardening (2 files):**
- [ ] Add `afterSignUpUrl="/onboarding"` + `afterSignInUrl="/dashboard"` props to `<ClerkProvider>` in `src/app/layout.tsx`
- [ ] Clear both `__client` AND `__session` cookies in orphaned session detection in `src/middleware.ts`

**Batch 4 — Verification:**
- [ ] Live production test: sign-up → DB record → webhook → onboarding → dashboard
- [ ] Full health check with token

### ⚠️ Still Outstanding
- [x] **~~🔴 P0: Clerk Native API DISABLED~~** — FIXED by user enabling Native API in Clerk Dashboard.
- [x] **~~🔴 P0: CSP connect-src missing from production headers~~** — FIXED in Session 12. Root cause of empty sign-up on production. `next.config.ts` now prefixes connect-sources with `"connect-src "`.
- [x] **~~BUG #1: isBlockedEmail() zombie users~~** — FIXED in Session 12. No longer returns early; creates DB record + skips CRM sync.
- [x] **~~BUG #2: Subscription/Usage race condition~~** — FIXED in Session 12. Changed to `$transaction` with `upsert`.
- [x] **~~BUG #4: Email uniqueness violation on re-signup~~** — FIXED in Session 12. Webhook now checks both clerkId and email.
- [x] **~~BUG #5: afterSignUpUrl missing~~** — FIXED in Session 12. Added `afterSignUpUrl="/onboarding"` to ClerkProvider.
- [x] **~~Middleware __session cookie~~** — FIXED in Session 12. Now clears both `__client` and `__session` for orphaned sessions.
- [x] **~~Google SSO 404 redirect~~** — FIXED in Session 13. Sign-up/sign-in converted to catch-all routes `[[...sign-up]]`/`[[...sign-in]]`.
- [x] **~~Country selector incomplete~~** — FIXED in Session 13. Populated with all 193 countries.
- [ ] **P0.5: Verify `CLERK_SECRET_KEY` on Vercel starts with `sk_live_`** — If it's a Development `sk_test_` key, replace with Production `sk_live_` key from Clerk Dashboard.
- [ ] **P0.5: Verify Google OAuth redirect URL** — In Clerk Dashboard (Production) + Google Cloud Console, confirm redirect URL is `https://clerk.pitchcoachai.tech/v1/oauth_callback`
- [ ] **Zoho CRM OAuth** — Region fix deployed. If `invalid_client` persists, client ID/secret need regeneration at `api-console.zoho.eu`.
- [ ] **BLOB_READ_WRITE_TOKEN verification** — Token is set on Vercel. After auth is working, test Script Check upload end-to-end. Health check now includes blob store connectivity test.
- [ ] **Clerk Dashboard password settings must match code policy** — min 6 chars, uppercase, lowercase, number, special char (Dashboard-only, cannot be set in code)
- [ ] **STRIPE_PRICE_FOUNDER and STRIPE_PRICE_FOUNDER_READINESS** — Added to code but env vars may not be set in `.env.local` or Vercel yet.
- [ ] Test: sign up → verify DB record created → verify Clerk webhook fires → verify CRM sync → verify onboarding email
- [ ] Add Kal Protocol 2.0 test coverage
- [ ] Add E2E/integration tests for critical flows
- [x] **~~Z.ai Vision health endpoint~~** — Created `/api/health/vision/route.ts`. Live on production.
- [ ] Verify `ZAI_CHAT_ID` requirement
- [ ] Apply structured logger to remaining modules (E3, E4, E5 routes — currently still using console.log)
- [ ] Google AI / Vertex AI region-blocked from certain dev locations — works from Vercel
- [ ] Babel parser issues in test files (TypeScript generics in .test.ts) — pre-existing, not blocking

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
- Clerk webhook secret set in `.env.local`
- Production fully LIVE: `pitchcoachai.tech/api/health` returns ok
- superz.md created as agent memory layer
- 7 commits pushed to GitHub

### Session 4
- **Full codebase sweep executed (Batches 1-6)**
- **Batch 1:** Created missing blob upload route, deleted hardcoded JWT file, SSRF protection, cleaned unused env vars
- **Batch 2:** Error boundaries, rate limiting, downstream bug fixes
- **Batch 3:** Script Check E2E — text input, user-selectable params, Kal Protocol fallback, upload progress
- **Batch 4:** Dead code removal, duplicate extraction (plan-config, hook)
- **Batch 5:** Anti-pattern remediation — useEffect deps, structured logger, `any` type fixes, cancelled grace period, Stripe billing period, Redis circuit breaker
- **Batch 6:** Documentation update, git push, Vercel deployment triggered
- **4 commits pushed** to GitHub (fb26022 is HEAD)

### Session 5
- **Kal Agent integration:** Rewrote `kal-middleware-client.ts` with dual-backend
- **Supabase handshake:** Added as named service in `/api/health`
- **Credential sync:** Added 5 missing vars to `.env.local`, updated 8 vars on Vercel via REST API
- **2 commits pushed:** `35fd42b` and `9b9ad1d`

### Session 6
- **Kal Agent full endpoint verification:** All 5 RPC endpoints confirmed working (health, analyzeScript, runTenQuestions, coachingChat, generateSummary)
- Extended `kal-middleware-client.ts` with runTenQuestions + coachingChat
- **1 commit pushed:** `2e4fa57`

### Session 7
- **Auth bug fixes:** Fixed NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL, sign-up fallbackRedirectUrl, CLERK_WEBHOOK_SECRET
- Added Zoho CRM sync + welcome email to onboarding completion path
- Updated Vercel env vars via API

### Session 8
- **Resend fully removed** — onboarding emails now via Zoho CRM SendMail API
- **Zoho OAuth consolidated** into shared `src/lib/zoho-auth.ts`
- **Zoho Billing removed** from payment-service, billing portal, create-session route
- **Zoho Forms removed** from contact route (kept CRM lead sync)
- Updated .env.example with ZOHO_SENDER_EMAIL, removed dead vars

### Session 9
- **E2E audit conducted** — build passes, 40 tests pass, 6 bugs found
- **P0 fixed:** PLAN_LIMITS desync in pitch-deck-analyser (PROFESSIONAL e1=20 → should be 15)
  - Replaced all 3 hardcoded PLAN_LIMITS with imports from `@/lib/plan-config`
  - Files: pitch-deck-analyser/new, elevator-script/new, elevator-pitch-live/new
- **P1 fixed:** Stripe price mappings for E5 products ('founder', 'founder-readiness')
- **P2 fixed:** `usage as any` casts for e5FounderSessions removed (type already correct)
- **P2 fixed:** `catch(error: any)` → `catch(error: unknown)` + instanceof narrowing in 10 API routes + 2 client components
- **P2 fixed:** `let analysisResult: any` → `Prisma.InputJsonValue` in coach/founder route
- **E2E verified:** Blob upload, AI analysis, Kal Protocol fallback, orphan cleanup
- **Committed** as 137d9ed, pushed to Morpheos22/Pitch-Perfect main
- **Vercel deployment:** dpl_CEovsm4fz7wJ4UzfGH5MFLcfouW1 (BUILDING)
- **HEAD:** `137d9ed` on `main`
- **TypeScript:** Zero errors on `tsc --noEmit`
- **Build:** Passes clean

### Session 11
- **Clerk Native API fix verified** — User enabled Native API. 6/6 handshakes confirmed. Supabase REST API healthy (previous 401 stale).
- **Zoho OAuth region fix deployed** — `zoho-auth.ts` now auto-derives OAuth domain from `ZOHO_API_DOMAIN`. `ZOHO_API_DOMAIN` on Vercel corrected to `https://www.zohoapis.eu`. Vision health endpoint created at `/api/health/vision/route.ts`.
- **Full codebase scan for sign-up failure** — Identified 5 bugs across webhook handler, Clerk Dashboard config, and middleware:
  - 🔴 BUG #1: `isBlockedEmail()` silently returns → zombie users (no DB record)
  - 🔴 BUG #2: Subscription/Usage race condition → webhook 500s, CRM sync never fires
  - 🟡 BUG #3: Turnstile CAPTCHA enabled — may silently block sign-up submission
  - 🟡 BUG #4: Email uniqueness violation on re-signup → webhook 500
  - 🟠 BUG #5: Dashboard `after_sign_up_url` = `/` instead of `/onboarding` → double redirect
- **4-batch execution plan drafted** — awaiting user consent to proceed

### Session 12
- **🔴 ROOT CAUSE FOUND: CSP `connect-src` directive was MISSING from production headers**
  - Sign-up rendered on `accounts.pitchcoachai.tech` (Clerk hosted) but NOT on `pitchcoachai.tech` (production)
  - Root cause: `next.config.ts` built the connect-sources as a bare sub-array without the `connect-src ` prefix
  - Browser treated `'self'` (first value) as an invalid directive name and ignored the entire block
  - Without `connect-src`, browser fell back to `default-src 'self'` — blocking ALL cross-origin XHR/fetch
  - Clerk JS couldn't call `https://clerk.pitchcoachai.tech/v1/client?_is_native=1` → `<SignUp>` rendered empty
  - Also added `https://challenges.cloudflare.com` to `connect-src` for Cloudflare Turnstile CAPTCHA
- **ALL 5 downstream bugs fixed in commit 0c5ffd3:**
  1. ✅ **CSP connect-src fix** — Added `"connect-src "` prefix to the sub-array in `next.config.ts`
  2. ✅ **Zombie users fix** — `isBlockedEmail()` no longer returns early; creates DB record + skips CRM sync instead
  3. ✅ **Subscription race condition fix** — Changed `subscription.create()` + `usage.create()` to `$transaction` with `upsert` — safe to run in parallel with onboarding API
  4. ✅ **Re-signup fix** — Webhook now checks BOTH `clerkId` AND `email` for existing users; updates clerkId on re-signup
  5. ✅ **afterSignUpUrl fix** — Added `afterSignUpUrl="/onboarding"` to ClerkProvider in `layout.tsx`
  6. ✅ **Session cookie fix** — Middleware now clears BOTH `__client` and `__session` cookies for orphaned sessions (previously only cleared `__client`, causing half-signed-out state)
- **Vercel deployment verified** — CSP header now shows `connect-src` with all required domains
- **Clerk FAPI confirmed working** — Native API returns valid client data with sign_up and sign_in objects
- **Commit:** `0c5ffd3` pushed to `main`, Vercel deployment READY
- **HEAD:** `0c5ffd3` on `main`

### Session 13
- **4 persistent issues from user — all investigated and 2 fixed at root cause level**
- **Issue 1: Google SSO redirects to 404 — FIXED**
  - ROOT CAUSE: Sign-up and sign-in pages used flat routes (`/sign-up/page.tsx`) instead of Clerk's required catch-all routes (`/sign-up/[[...sign-up]]/page.tsx`)
  - Clerk OAuth (Google SSO) redirects to sub-paths like `/sign-up/sso-callback` after OAuth flow
  - Without catch-all routes, Next.js returns 404 for these SSO callback URLs
  - FIX: Renamed `sign-up/page.tsx` → `sign-up/[[...sign-up]]/page.tsx` and `sign-in/page.tsx` → `sign-in/[[...sign-in]]/page.tsx`
  - Added `afterSignInUrl="/dashboard"` to ClerkProvider in `layout.tsx`
  - Verified: `/sign-up/sso-callback` returns 200 (was 404 before fix)
- **Issue 2: Country selector incomplete — FIXED**
  - COUNTRIES array had only 13 countries + "Other"
  - FIX: Replaced with full list of 193 countries (all recognized nations)
- **Issue 3: Onboarding email not sent — CODE CORRECT, CREDENTIALS NEED VERIFICATION**
  - Code path verified: `completeOnboardingInCRM()` called from both onboarding API and Clerk webhook
  - Zoho OAuth region derivation correct (accounts.zoho.eu auto-derived from www.zohoapis.eu)
  - If `invalid_client` persists, Zoho client ID/secret need regeneration at `api-console.zoho.eu`
- **Issue 4: Vercel Blob "could not retrieve client token" — DIAGNOSTICS IMPROVED**
  - Investigated BLOB_READ_WRITE_TOKEN: set as `vcp_7st6GJERIS4...` (Vercel platform token format)
  - Blob store PitchPerfectFiles (`***REDACTED_BLOB_STORE_ID***`) confirmed Active, Public, lhr1 region
  - Vercel contentHint shows `type: "blob-read-write-token"` — recognized correctly
  - Added pre-check for BLOB_READ_WRITE_TOKEN in upload route (clear error if missing)
  - Added blob store connectivity test to `/api/health` endpoint (tests actual `list()` call)
  - Added detailed error logging with token prefix for diagnostics
  - Restored BLOB_READ_WRITE_TOKEN on Vercel after investigation
  - NOTE: The original "could not retrieve client token" error was likely caused by auth failure (Sessions 10-12) rather than blob token issues. Auth is now fixed → blob uploads should work.
- **Service handshakes verified:**
  - Clerk FAPI ✅ (Native API enabled, returns valid client data)
  - Vercel ✅ (project accessible, deployments working)
  - Supabase ✅ (health endpoint returns ok, DB connected)
  - Z.ai ✅ (SDK + HTTP fallback working)
  - Kal ✅ (Agent authenticated, health ok)
  - GitHub ✅ (PAT valid, push works)
- **Commit:** `454f2aa` pushed to `main`
- **HEAD:** `454f2aa` on `main`

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
| `src/lib/plan-config.ts` | **Single source of truth** — PLAN_LIMITS (E1-E5), formatPlanName, getScoreColor |
| `src/lib/storage.ts` | File storage with SSRF protection (host allowlist + private IP block) |
| `src/lib/rate-limit.ts` | Redis-backed rate limiting with circuit breaker fallback |
| `src/lib/zoho-auth.ts` | **Shared Zoho OAuth module** — getAccessToken(), invalidateAccessToken(), ZOHO_CONFIG |
| `src/lib/zoho-crm.ts` | Zoho CRM — lead sync + onboarding email via SendMail API |
| `src/lib/email.ts` | Email via Zoho CRM SendMail — Kal Protocol notifications only |
| `src/lib/blob-upload.ts` | Client-side Vercel Blob upload — uploadFileToBlob() with progress callback |
| `src/lib/payment-service.ts` | Payment routing — Paystack + Stripe only, createModuleAccess() is single source of truth |
| `src/lib/entitlement.ts` | Module access enforcement — E1-E5, atomic check-and-increment, monthly lazy reset |
| `src/app/api/health/route.ts` | Full health diagnostics — Supabase, Kal, Z.ai, Google AI, DB, Storage |
| `src/app/api/health/vision/route.ts` | Dedicated Z.ai vision model diagnostics — glm-4.6v test with HTTP fallback |
| `src/app/api/blob/upload/route.ts` | Vercel Blob upload — handleUpload with auth + validation + DELETE |
| `src/app/api/coach/script/route.ts` | E2 Script Check — POST (file+text), GET, PATCH, DELETE with Kal fallback |
| `src/app/api/kal/chat/route.ts` | Kal chat API — POST/PATCH/GET (249 lines) |
| `src/app/api/webhooks/clerk/route.ts` | Clerk webhook — user.created (Supabase + CRM bare lead), user.updated (CRM onboarding + welcome email) |
| `src/app/api/user/onboarding/route.ts` | Onboarding completion — DB + Clerk metadata + CRM completion + Zoho welcome email |
| `src/app/error.tsx` | Root error boundary |
| `src/app/(dashboard)/error.tsx` | Dashboard error boundary |
| `src/app/(dashboard)/dashboard/page.tsx` | Dashboard — imports PLAN_LIMITS + formatPlanName from plan-config, shows E1-E5 |
| `src/app/(dashboard)/dashboard/settings/billing/page.tsx` | Billing — imports PLAN_LIMITS + formatPlanName from plan-config, shows E1-E5 |
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
19. **Clerk Dashboard password settings are SEPARATE from code** — The password policy in `src/lib/clerk-config.ts` and `validation/schemas.ts` (min 6 chars, uppercase, lowercase, number, special char) must ALSO be configured in the Clerk Dashboard.
20. **`NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` must be `/onboarding`** — If reverted, new users get a flash redirect instead of direct onboarding flow.
21. **All emails go via Zoho CRM SendMail API** — Both onboarding welcome emails and Kal Protocol notifications. Resend has been fully removed.
22. **Zoho CRM OAuth is region-aware** — `zoho-auth.ts` auto-derives OAuth domain from `ZOHO_API_DOMAIN` (e.g. www.zohoapis.eu → accounts.zoho.eu). If credentials still fail after region fix, regenerate client ID/secret at `api-console.zoho.eu`.
23. **Supabase REST API keys may need rotation** — Both anon and service role keys return 401 from the REST API. DB connection via Prisma works fine.
24. **PLAN_LIMITS MUST come from `@/lib/plan-config`** — Never duplicate PLAN_LIMITS locally in a page component. The module-level constant WILL drift from the source of truth. Import PLAN_LIMITS, formatPlanName, getScoreColor from plan-config.
25. **No `catch(error: any)` in new code** — Always use `catch(error: unknown)` with `instanceof Error` narrowing. This was a batch fix in Session 9.
26. **`src/lib/zoho-auth.ts` is the shared OAuth module** — Both `zoho-crm.ts` and `email.ts` import from it. Never duplicate OAuth logic in those files.
27. **Commit/push ONLY with user consent** — Use Morpheos22 profile with personal access token for GitHub push.
28. **Vercel deployment is auto-triggered** from GitHub push to `main`. Manual deploy via API or deploy hook only needed for env var changes.
29. **Clerk Native API MUST be enabled** in the Clerk Dashboard for `@clerk/nextjs@6.x` to work. Without it, sign-in/sign-up components render empty. This was the root cause of the Session 10 production outage.
30. **Turnstile CAPTCHA is enabled on sign-up** — Clerk Dashboard has `captcha_enabled: true` with Cloudflare Turnstile (smart widget). If site keys are misconfigured for `pitchcoachai.tech`, sign-up form submission silently fails with no user-visible error. This may be THE root cause of sign-up failure.
31. **Script Check depends on Clerk auth** — If auth is broken, Script Check is broken. The upload flow chain is: Clerk auth → middleware `auth.protect()` → page access → `requireAuth()` → blob upload → coach API. A failure at the first step cascades through the entire flow.
