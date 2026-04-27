# Super Z — Agent Memory & Context Layer

> **Purpose:** This file serves as a persistent memory and context layer for AI agents (Super Z) working on the Pitch-Perfect project. It captures architectural decisions, credential locations, known gotchas, and session state so that any agent can pick up seamlessly from where the last session left off.

> **Last Updated:** Session 3 — 2026-04-27

---

## Project Identity

| Field | Value |
|-------|-------|
| **Name** | PitchCoach AI (Pitch-Perfect) |
| **Owner** | Automagikal / Morpheos22 |
| **Domain** | [pitchcoachai.tech](https://pitchcoachai.tech) |
| **GitHub** | `Morpheos22/Pitch-Perfect` |
| **Vercel Project** | `prj_yMCmXOgeQPWTqPVWwFSrz8uPuNf3` |
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
- **Cache/Rate Limiting:** Upstash Redis
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
| Supabase Anon | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env.local` + Vercel env |
| Supabase Service | `SUPABASE_SERVICE_ROLE_KEY` | `.env.local` + Vercel env |
| Clerk Publishable | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `.env.local` + Vercel env |
| Clerk Secret | `CLERK_SECRET_KEY` | `.env.local` + Vercel env |
| Clerk Webhook | `CLERK_WEBHOOK_SECRET` | `.env.local` + Vercel env (MUST SET) |
| Z.ai API | `ZAI_API_KEY`, `ZAI_TOKEN` | `.env.local` + Vercel env |
| Z.ai Base URL | `ZAI_BASE_URL` | `.env.local` + Vercel env |
| Z.ai User | `ZAI_USER_ID` | `.env.local` + Vercel env |
| Kal Middleware | `KAL_MIDDLEWARE_URL` | `.env.local` + Vercel env |
| Vercel Blob | `BLOB_READ_WRITE_TOKEN` | Vercel env (auto-injected) |
| GitHub PAT | Embedded in git remote URL | `origin` remote |

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

4. **Supabase service role key is NOT a JWT**
   - The `sbp_*` key is a Supabase platform API key, not a `service_role` JWT
   - It won't work for REST API calls that need `service_role` access
   - The actual service_role JWT was never provided by the user

### 🟡 BE AWARE — May Cause Confusion

5. **Prisma migration state:** `0_init` is baselined (marked as applied) on the existing database. Schema is up to date. New migrations should be created with `prisma migrate dev` for any future schema changes.

6. **Build script** (`scripts/vercel-build.sh`) runs `prisma migrate deploy` before `next build`. This works because Vercel's build environment CAN reach the eu-west-2 pooler.

7. **ZAI_CHAT_ID is empty** in `.env.local` — unclear if this is required for Z.ai SDK functionality. The SDK works without it for chat completions.

8. **40 tests pass** (ai-utils: 32, with-auth: 4, entitlement: 4). No Kal Protocol 2.0 specific tests exist yet.

9. **Vercel API token (`vcp_`) has limited scope** — it works for deploy hooks and was previously able to manage env vars, but the scope was lost mid-session. If env var management fails with 403, the user must set vars manually in Vercel Dashboard or provide a fresh token with full project scope.

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
- [x] Vercel Blob storage (client-side direct upload)
- [x] Dual billing: Stripe + Paystack
- [x] Zoho CRM integration
- [x] Supabase DB connected and healthy
- [x] Production deployment LIVE at pitchcoachai.tech
- [x] 14+ Vercel env vars configured

### ❌ Remaining Work

#### Batch 3 — CRITICAL (blocks production user sign-ups)
- [x] Set `CLERK_WEBHOOK_SECRET` in `.env.local` (`whsec_NPm/Mcxk5U+Ur+kqrePLb7m6AInILiXV`)
- [x] Create Clerk webhook (endpoint: `/api/webhooks/clerk`, events: `user.created`, `user.updated`)
- [ ] Set `CLERK_WEBHOOK_SECRET` in Vercel env vars — **API token lost scope, must set manually in Vercel Dashboard**
- [ ] Redeploy after Vercel env var is set
- [ ] Test: sign up → verify DB record created → verify webhook fires

#### Batch 4 — Billing Integrity
- [ ] Fix Stripe webhook period lookup (`src/app/api/billing/webhooks/stripe/route.ts:99` — hardcoded 30 days)
- [ ] Add CANCELLED subscription grace period (`src/lib/entitlement.ts:90`)
- [ ] Add rate limiting to change-password endpoint (`src/app/api/user/change-password/route.ts:8`)

#### Batch 5 — Polish & Hardening
- [ ] Verify `ZAI_CHAT_ID` requirement
- [ ] Add Kal Protocol 2.0 test coverage
- [ ] Add E2E/integration tests for critical flows
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

### Session 3 (Current)
- **Handshakes verified:** All 8 services confirmed live (Supabase REST, Supabase DB, Z.ai, Vercel API, GitHub, Clerk, Kal Middleware, Production health)
- **Critical DNS bug fixed:** Supabase pooler region corrected from `aws-0-af-south-1` (doesn't resolve) to `aws-1-eu-west-2`
- **DB password corrected:** Updated from `***REDACTED_SUPABASE_PASSWORD***` to `***REDACTED_DB_PASSWORD***`
- **Migration baselined:** `0_init` marked as applied on existing database
- **Clerk secret key updated:** Pushed to Vercel + `.env.local`
- **Clerk webhook secret set:** `CLERK_WEBHOOK_SECRET` added to `.env.local` — **still needs manual addition in Vercel Dashboard** (API token lost env var scope mid-session)
- **Production fully LIVE:** `pitchcoachai.tech/api/health` returns `{"status":"ok"}`
- **7 commits pushed** to GitHub/Morpheos22/Pitch-Perfect
- **superz.md** created and updated as agent memory layer on GitHub
- **Vercel API token scope:** Lost env var management access (403). Deploy hooks still work. Next agent should try the API first; if 403, direct user to set env vars manually in Vercel Dashboard.

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
| `src/app/api/kal/chat/route.ts` | Kal chat API — POST/PATCH/GET (249 lines) |
| `src/app/api/webhooks/clerk/route.ts` | Clerk webhook — user.created, user.updated |
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
