# PitchCoach AI (Pitch-Perfect)

AI-powered pitch coaching platform for founders and entrepreneurs — built by Automagikal.

---

## 🟢 Current Status (Last Updated: Session 3)

**Deployment: LIVE** at [pitchcoachai.tech](https://pitchcoachai.tech)  
**Health Check:** `{"status":"ok"}` at `/api/health`  
**Tests:** 40/40 passing  
**Completion:** ~87%

### What's Working
- ✅ Full Next.js 16 deployment on Vercel (App Router + React 19)
- ✅ Supabase PostgreSQL connected (eu-west-2 region, migration baselined)
- ✅ Clerk authentication (publishable key set, sign-in/sign-up pages working)
- ✅ Z.ai AI Gateway (SDK + HTTP fallback, TTS + Web Search)
- ✅ Kal Protocol 2.0 — fully implemented (10 contextual questions, 2 fallbacks, 8-step critical thinking)
- ✅ Kal Adaptive Middleware client (RPC to `kal-middleware-morpheos255918280.adaptive.ai`)
- ✅ Kal Chat Widget (544-line interactive component)
- ✅ Vercel Blob storage (client-side direct upload)
- ✅ 5 coaching modules: E1 Deck Analyser, E2 Script Coach, E3 Live Pitch, E4 Full Pitch, E5 Founder
- ✅ Dual billing: Stripe (international) + Paystack (African markets)
- ✅ Zoho CRM integration
- ✅ 17 Prisma models, 9 enums, single baseline migration

### What's NOT Working Yet
- ❌ `CLERK_SECRET_KEY` is placeholder — server-side Clerk ops broken (webhooks, user sync, password changes)
- ❌ `CLERK_WEBHOOK_SECRET` missing — new user sign-ups won't create DB records
- ⚠️ Stripe subscription period hardcoded to 30 days
- ⚠️ Cancelled subscriptions lose access immediately (no grace period)
- ⚠️ No rate limiting on change-password endpoint

---

## 🚀 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/ui |
| Backend | Next.js API Routes, Prisma ORM 6 |
| Database | PostgreSQL (Supabase — `iwbshmshegewmctfucaz` on eu-west-2) |
| Storage | Vercel Blob (client-side direct upload) |
| AI | Z.ai Gateway (GLM-4-Plus), Kal Protocol 2.0, Adaptive Middleware |
| Auth | Clerk (pk_live_ production key) |
| Billing | Stripe + Paystack |
| CRM | Zoho |
| Email | Resend |
| Cache | Upstash Redis (rate limiting) |
| Hosting | Vercel (project: `prj_yMCmXOgeQPWTqPVWwFSrz8uPuNf3`) |

---

## 📁 Project Structure

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
│   └── api/
│       ├── chat/                # General chatbot
│       ├── kal/chat/            # Kal Protocol 2.0 contextual chat
│       ├── kal/prewarm/         # Z.ai gateway pre-warm
│       ├── coach/deck/          # E1 AI analysis
│       ├── coach/script/        # E2 AI analysis
│       ├── coach/live/          # E3 AI analysis
│       ├── coach/full/          # E4 AI analysis
│       ├── coach/founder/       # E5 AI analysis
│       ├── billing/webhooks/    # Stripe + Zoho webhooks
│       ├── blob/upload+download/# Vercel Blob file handling
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
    ├── chatbot-config.ts        # Chatbot configuration
    ├── clerk-config.ts          # Clerk auth configuration
    ├── payment-service.ts       # Payment processing
    ├── entitlement.ts           # Feature access / subscription logic
    ├── rate-limit.ts            # Upstash Redis rate limiting
    ├── with-auth.ts             # Auth middleware helper
    ├── db.ts                    # Prisma client (lazy singleton)
    ├── storage.ts               # Multi-backend file storage
    ├── blob-upload.ts           # Vercel Blob client-side upload
    ├── blob-signature.ts        # Blob URL signing
    ├── file-parser.ts           # PDF/PPTX/DOCX parsing
    ├── vertex-ai.ts             # Google Vertex AI (secondary)
    ├── zoho-crm.ts              # Zoho CRM integration
    ├── email.ts                 # Resend email
    └── validation/schemas.ts    # Zod validation schemas
prisma/
├── schema.prisma                # 17 models, 9 enums
└── migrations/
    └── 0_init/migration.sql     # Single consolidated baseline migration
scripts/
└── vercel-build.sh              # Build pipeline: prisma generate → migrate deploy → next build
```

---

## 🗄️ Database Schema (17 Models)

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

## 📦 Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL database (Supabase account)
- Clerk account for authentication
- Z.ai API key

### Installation

```bash
git clone https://github.com/Morpheos22/Pitch-Perfect.git
cd Pitch-Perfect
npm install
```

### Environment Setup

```bash
# Copy the template and fill in your values
# See .env.local for all required variables
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
npm run test       # Run tests (vitest)
```

---

## 🔑 Key Credentials Reference

> **NOTE:** These are stored in `.env.local` (gitignored) and Vercel env vars. Never commit to git.

| Service | Env Var | Status |
|---------|---------|--------|
| Supabase DB | `DATABASE_URL` | ✅ Set (eu-west-2 pooler) |
| Supabase DB Direct | `DIRECT_URL` | ✅ Set (eu-west-2 direct) |
| Supabase Anon | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ Set |
| Clerk Publishable | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | ✅ Set (pk_live_) |
| Clerk Secret | `CLERK_SECRET_KEY` | ❌ **PLACEHOLDER — needs real key** |
| Clerk Webhook | `CLERK_WEBHOOK_SECRET` | ❌ **MISSING** |
| Z.ai API | `ZAI_API_KEY` | ✅ Set |
| Z.ai Base | `ZAI_BASE_URL` | ✅ Set |
| Vercel Blob | `BLOB_READ_WRITE_TOKEN` | ✅ Set |
| Kal Middleware | `KAL_MIDDLEWARE_URL` | ✅ Set |

---

## ⚠️ Critical Gotchas

1. **Supabase region is `aws-1-eu-west-2`, NOT `aws-0-af-south-1`** — the af-south-1 hostname does NOT resolve in DNS. Always use eu-west-2.
2. **Direct DB hostname** (`db.iwbshmshegewmctfucaz.supabase.co`) resolves to IPv6 only — won't work from IPv4-only environments.
3. **Supabase service role key** (`***REDACTED_SUPABASE_PLATFORM_KEY***`) is a platform API key, NOT a valid JWT for the REST API. The actual `service_role` JWT was not provided.
4. **CLERK_SECRET_KEY** must be replaced before any server-side Clerk operations will work.

---

## 📋 Remaining Work

### Batch 3 — CRITICAL (blocks production user sign-ups)
1. Replace `CLERK_SECRET_KEY` with real key from [Clerk Dashboard → API Keys](https://dashboard.clerk.com)
2. Set `CLERK_WEBHOOK_SECRET` (create webhook in Clerk Dashboard → Webhooks, copy signing secret)
3. Push both to Vercel env vars (IDs: `APTbHmaUGkqyqINi` for SECRET, `eGscbY4qDvFCdkOy` for WEBHOOK)
4. Redeploy via deploy hook: `curl -X POST https://api.vercel.com/v1/integrations/deploy/prj_yMCmXOgeQPWTqPVWwFSrz8uPuNf3/LGBDEY1mZs`
5. Verify: sign up test user → check DB for record → confirm webhook fired

### Batch 4 — Billing Integrity
1. Fix Stripe webhook period lookup — `src/app/api/billing/webhooks/stripe/route.ts:99` (hardcoded 30 days)
2. Add CANCELLED subscription grace period — `src/lib/entitlement.ts:90`
3. Add rate limiting to change-password — `src/app/api/user/change-password/route.ts:8`

### Batch 5 — Polish & Hardening
1. Verify `ZAI_CHAT_ID` requirement (currently empty)
2. Add Kal Protocol 2.0 test coverage
3. Add E2E/integration tests for critical flows

---

## 📝 License

MIT License — see LICENSE file for details.
