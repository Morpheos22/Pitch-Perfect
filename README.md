# PitchCoach AI (PitchCoach Ai)

AI-powered pitch coaching platform for founders and entrepreneurs — built by Athena Agentic.

---

## Current Status (Last Updated: 2026-09-18 — Dead-code sanitization + config drift cleanup)

**Deployment:** LIVE at [pitchcoachai.tech](https://pitchcoachai.tech)
**Health Check:** `{"status":"ok"}` at `/api/health`
**TypeScript:** Zero errors (strict mode)
**Storage:** Cloudflare R2 (private, proxy-gated access)
**Auth:** Clerk (custom FAPI domain `clerk.pitchcoachai.tech`, pk_live production key)

### What's Working
- Full Next.js 16 deployment on Vercel (App Router + React 19, Turbopack production build)
- Supabase PostgreSQL connected (eu-west-2 region, PgBouncer pooled)
- Clerk authentication (production live key, sign-in/sign-up pages working)
- Z.ai AI Gateway (glm-5.1 flagship + glm-4.5v vision, TTS + Web Search)
- Kal Agent (E2 Script analysis fallback via `KAL_AGENT_URL`)
- Cloudflare R2 file storage (private by default, accessed via `/api/blob/download` proxy)
- 5 coaching modules: E1 Deck Analyser, E2 Script Coach, E3 Live Pitch, E4 Full Pitch, E5 Founder
- Dual billing: Stripe (international) + Paystack (African markets)
- Supabase SMTP for transactional email (via nodemailer)
- Upstash Redis for rate limiting
- Cloudflare Worker for Athena MCP server (Durable Object-backed)
- Cloudflare WebMCP bridge (`.webmcp/bridge.js`, edge-level integration not in repo)

### Removed (Dead Code)
- Zoho CRM integration — stubbed no-op, now deleted
- Zoho WorkDrive — never wired up in code, env vars removed
- Vercel Blob storage — hardcoded `isVercelBlobConfigured() = false`, replaced by R2
- Kal Middleware (legacy fallback) — stubbed no-op, now deleted
- Google AI / Vertex AI — removed from AI fallback chain (Gemini 403 SERVICE_DISABLED)
- Resend — never wired up in source code (env var removed from `.env.example`)

### What's NOT Working Yet
- `CLERK_WEBHOOK_SECRET` missing — new user sign-ups won't auto-create DB records
- `/api/athena/debug` is publicly accessible — leaks token prefixes (security issue, flagged for fix)

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/ui, Turbopack |
| Backend | Next.js API Routes, Prisma ORM 6 |
| Database | PostgreSQL (Supabase — `iwbshmshegewmctfucaz` on eu-west-2, PgBouncer on :6543) |
| Storage | Cloudflare R2 (S3-compatible, private, proxy-gated) |
| AI | Z.ai Gateway (glm-5.1 text + glm-4.5v vision), Kal Agent fallback (E2 only) |
| Auth | Clerk (custom FAPI domain `clerk.pitchcoachai.tech`, pk_live) |
| Billing | Stripe + Paystack |
| Email | Supabase SMTP (via nodemailer) |
| Cache | Upstash Redis (rate limiting) |
| Hosting | Vercel (project: `prj_yMCmXOgeQPWTqPVWwFSrz8uPuNf3`) + Cloudflare Workers |
| Edge | Cloudflare WebMCP bridge (c2pa + mcp-server-client packs) |

---

## Project Structure

```
src/
├── app/
│   ├── (auth)/                  # Sign-in, sign-up
│   ├── (public)/                # About, pricing, blog, contact, legal
│   ├── (onboarding)/            # User onboarding flow
│   ├── (dashboard)/
│   │   ├── dashboard/           # Main dashboard + settings
│   │   ├── pitch-deck-analyser/ # E1: Deck analysis
│   │   ├── elevator-script/     # E2: Script coaching + Kal chat
│   │   ├── elevator-pitch-live/ # E3: Live pitch recording + analysis
│   │   ├── coach/full/          # E4: 30-min full pitch session
│   │   └── founder/             # E5: Founder readiness, pathway, research, narration
│   ├── error.tsx                # Root error boundary
│   └── api/
│       ├── kal/chat/            # Kal Protocol 2.0 contextual chat
│       ├── kal/prewarm/         # Z.ai gateway pre-warm
│       ├── coach/deck/          # E1 AI analysis
│       ├── coach/script/        # E2 AI analysis
│       ├── coach/live/          # E3 AI analysis
│       ├── coach/full/          # E4 AI analysis
│       ├── coach/founder/       # E5 AI analysis
│       ├── billing/webhooks/    # Stripe + Zoho webhooks
│       ├── blob/upload/         # Vercel Blob upload route (handleUpload + DELETE)
│       ├── webhooks/clerk/      # Clerk user sync webhook
│       └── user/                # Sync, onboarding, change-password
├── components/
│   ├── ui/                      # 15 shadcn/ui components
│   ├── layout/                  # Navbar, footer, theme toggle
│   ├── kal/                     # Kal chat widget
│   └── founder/                 # Module card, layout, progress tracker
└── lib/
    ├── ai-service.ts            # Core AI service — Z.ai SDK init + HTTP fallback
    ├── zai-capabilities.ts      # Z.ai TTS + Web Search
    ├── kal-protocol.ts          # Kal Protocol 1.0 (background retry)
    ├── kal-protocol-v2.ts       # Kal Protocol 2.0 (contextual chat, 702 lines)
    ├── kal-middleware-client.ts # Adaptive middleware RPC client (297 lines)
    ├── clerk-config.ts          # Clerk auth configuration
    ├── payment-service.ts       # Payment processing
    ├── entitlement.ts           # Feature access / subscription logic (with grace period)
    ├── rate-limit.ts            # Upstash Redis rate limiting (with circuit breaker)
    ├── logger.ts                # Structured logging utility
    ├── plan-config.ts           # Shared plan limits, score colors, format helpers
    ├── use-unsaved-changes-warning.ts  # Shared beforeunload hook
    ├── with-auth.ts             # Auth middleware helper
    ├── db.ts                    # Prisma client (lazy singleton)
    ├── storage.ts               # Multi-backend file storage (SSRF-protected)
    ├── blob-upload.ts           # Vercel Blob client-side upload (with progress)
    ├── blob-signature.ts        # Blob URL signing
    ├── file-parser.ts           # PDF/PPTX/DOCX parsing
    ├── vertex-ai.ts             # Google Vertex AI (secondary)
    ├── zoho-crm.ts              # Zoho CRM integration
    ├── email.ts                 # Zoho CRM email (SendMail API)
    └── validation/schemas.ts    # Zod validation schemas
prisma/
├── schema.prisma                # 17 models, 9 enums
└── migrations/
    └── 0_init/migration.sql     # Single consolidated baseline migration
scripts/
└── vercel-build.sh              # Build pipeline: prisma generate → migrate deploy → next build
```

---

## Database Schema (17 Models)

| Domain | Model | Table |
|--------|-------|-------|
| Auth | `User` | `users` |
| Billing | `Subscription` | `subscriptions` |
| Billing | `Usage` | `usage` |
| Billing | `Transaction` | `transactions` |
| Billing | `ModuleAccess` | `module_access` |
| E1 | `PitchDeck` | `pitch_decks` |
| E2 | `PitchScript` | `pitch_scripts` |
| E3 | `PitchVideo` | `pitch_videos` |
| E4 | `FullPitchSession` | `full_pitch_sessions` |
| E5 | `FounderSession` | `founder_sessions` |
| Chat | `ChatMessage` | `chat_messages` |
| Chat | `KalChatSession` | `kal_chat_sessions` |
| Integration | `WebhookLog` | `webhook_logs` |
| Integration | `ZohoSyncLog` | `zoho_sync_logs` |

**Enums:** `PlanType`, `SubscriptionStatus`, `ScriptInputType`, `AnalysisStatus` (includes KAL_PENDING/KAL_FAILED), `InvestorReadinessLevel`, `FounderModuleType`, `TransactionType`, `PaymentProvider`, `ChatRole`

---

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL database (Supabase account)
- Clerk account for authentication
- Z.ai API key

### Installation

```bash
git clone https://github.com/Morpheos22/PitchCoach Ai.git
cd PitchCoach Ai
npm install
```

### Environment Setup

```bash
# Copy the template and fill in your values
# See .env.example for all required variables
```

### Database

```bash
# Generate Prisma Client
npm run db:generate

# Push schema to database (dev)
npm run db:push

# Check migration status
npm run db:status

# Deploy migrations (production)
npm run db:deploy
```

### Development

```bash
npm run dev        # Start dev server on port 3000
npm run build      # Production build
npm run test       # Run tests
```

---

## Security Features

- **SSRF Protection**: Host allowlist enforcement on all file URL inputs, private IP blocking (IPv4 + IPv6-mapped)
- **Error Boundaries**: Root and dashboard-level error.tsx for graceful crash recovery
- **Rate Limiting**: Tiered rate limiting with Upstash Redis (AI routes: 5/min, payment: 10/min, auth: 5/min)
- **Redis Circuit Breaker**: Auto-retry after outages with 30s cooldown; fail-open policy
- **Structured Logging**: Debug/info logs are no-ops in production; warn/error always emitted
- **Subscription Grace Period**: Cancelled subscriptions retain access until billing period ends
- **Blob Upload Auth**: Clerk-authenticated upload route with category-based file validation

---

## Key Credentials Reference

> **NOTE:** These are stored in `.env.local` (gitignored) and Vercel env vars. Never commit to git.

| Service | Env Var | Status |
|---------|---------|--------|
| Supabase DB | `DATABASE_URL` | Set (eu-west-2 pooler) |
| Supabase DB Direct | `DIRECT_URL` | Set (eu-west-2 direct) |
| Clerk Publishable | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Set (pk_live_) |
| Clerk Secret | `CLERK_SECRET_KEY` | Set (sk_live_ production key) |
| Clerk Webhook | `CLERK_WEBHOOK_SECRET` | MISSING — needs Clerk Dashboard webhook setup |
| Z.ai API | `ZAI_API_KEY` | Set |
| Z.ai Base | `ZAI_BASE_URL` | Set |
| Vercel Blob | `BLOB_READ_WRITE_TOKEN` | Set |
| Kal Middleware | `KAL_MIDDLEWARE_URL` | Set |
| Stripe Secret | `STRIPE_SECRET_KEY` | Set |
| Stripe Webhook | `STRIPE_WEBHOOK_SECRET` | Set |

---

## Critical Gotchas

1. **Supabase region is `aws-1-eu-west-2`, NOT `aws-0-af-south-1`** — the af-south-1 hostname does NOT resolve in DNS. Always use eu-west-2.
2. **Direct DB hostname** (`db.iwbshmshegewmctfucaz.supabase.co`) resolves to IPv6 only — won't work from IPv4-only environments.
3. **CLERK_WEBHOOK_SECRET** must be set for new user sign-ups to auto-create DB records. Create a webhook in Clerk Dashboard pointing to `/api/webhooks/clerk` with `user.created` and `user.updated` events.
4. **Stripe `cancel_at_period_end`** is the authoritative field for cancellation status — do NOT check `status === 'canceled'` (status remains 'active' until the period ends).

---

## Codebase Audit Summary (Sessions 3-4)

### Batch 1 — Critical Infrastructure (COMPLETED)
- Created missing `/api/blob/upload/route.ts` (handleUpload + DELETE handler)
- Deleted `analyze_screenshots.mjs` (hardcoded JWT)
- Enforced host allowlist in storage.ts (SSRF protection)
- Added IPv6-mapped IPv4 bypass to private IP block list

### Batch 2 — Security Hardening (COMPLETED)
- Removed 5 unused Supabase vars from .env.local
- Fixed stale Stripe vars in .env.example
- Created root and dashboard error boundaries
- Added rate limiting to change-password (5 req/15min)
- Removed /api/user/sync from rate-limit skip list

### Batch 3 — Script Check E2E (COMPLETED)
- Added text input tab + user-selectable audience/duration
- Added Kal Protocol activation on iterate failure
- Added upload progress callback + progress bar
- E2E smoke test verification

### Batch 4 — Dead Code Cleanup (COMPLETED)
- Deleted dead compare route, unused dialog.tsx, @radix-ui/react-dialog
- Extracted plan-config.ts and useUnsavedChangesWarning() hook
- Removed dead onComplete no-op callback

### Batch 5 — Anti-Pattern Remediation (COMPLETED)
- Fixed useEffect dependency arrays (2 stale closures + kal-chat-widget polling)
- Created structured logger utility (`src/lib/logger.ts`)
- Applied logger to E1/E2 coach routes (~40 console calls → gated logging)
- Fixed `any` types in Stripe webhook handler
- Added cancelled subscription grace period
- Fixed `cancelAtPeriodEnd` bug (was using status check instead of Stripe's field)
- Fixed `stripeSubscriptionId` bug (was storing payment_intent ID)
- Implemented Stripe billing period from API (not hardcoded)
- Added Redis circuit breaker with retry cooldown

### Batch 6 — Documentation & Deployment (COMPLETED)
- Updated worklog.md and README.md
- Verified: tsc --noEmit zero errors, tsc --noEmit --strict zero errors

### Batch 7 — Security Hardening, Bug Fixes, Code Quality (COMMITTED)
Three batches committed and pushed to origin/main:

**Batch A — Security Hardening** (commit `f9b0a39`, 9 files)
- A1: Prompt injection defense — wrapped user content in `<user_content>` XML tags across 3 AI service files
- A2: Verified blob DELETE ownership check already in place
- A3: Verified polyfills import already in file-parser.ts
- A4: Removed /api/user/onboarding and /api/user/sync from middleware public routes
- A5: Sanitized .env.example — replaced real emails/URLs with placeholders
- A6: Removed hardcoded dev email fallbacks from dev-auth.ts, zoho-auth.ts, resend-email.ts
- A7: Hard-blocked /api/dev/* routes in production (403 before handler runs)
- A8: Created "dev" rate limit tier (5/min), reduced "unrestricted" from 1000/min to 100/min

**Batch B — Bug Fixes** (commit `5a30ab1`, 9 files, net -603 lines)
- B1: Fixed Type/Paste tab switch — removed `w-fit` from TabsList base styles
- B2: Fixed pitchDuration key mismatch — standardized field name + z.coerce.number() defense
- B3: Verified onboarding metadata key consistent (no actual mismatch)
- B4: Fixed Kal Agent health endpoint — content-type check before .json() parse
- B5: Deleted dead routes: /api/chat, /api/video, /lib/chatbot-config.ts (-603 lines)
- B6: Updated health check — replaced Google AI test with static object

**Batch C — Code Quality** (commit `0115c47`, 14 files, net -50 lines)
- C1: Removed hardcoded adaptive.ai fallback URL (infrastructure leak)
- C2: Replaced diagnostic Google AI test with Kal Agent test; deprecated vertex-ai.ts
- C3: Removed stale /api/video references from vercel.json and rate-limit.ts
- C4: Fixed stale comments across health, iterate, script routes
- C5: Unexported 3 internal-only storage.ts functions
- C6: Verified /api/contact is valid (contact form → Zoho CRM)
- C7: Standardized pitchDuration field name across client FormData + server
- C8: Removed stale references from README.md

**E2E Verification** (browser-based, production at pitchcoachai.tech)
- DOCX upload: file → blob → text extraction → AI analysis → results page ✅
- TXT upload: same pipeline ✅
- Text input (via API): analysis + iterate ✅
- Iterate & Improve: DOCX 75→83, Text 58→74 ✅
- Version navigation (v1 ↔ v2) ✅
- History page with scores ✅
- AI model: glm-4-plus (direct), ~10-12s response time ✅

---

## License

MIT License — see LICENSE file for details.
