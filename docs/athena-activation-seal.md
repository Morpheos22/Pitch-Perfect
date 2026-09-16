# Athena Activation Seal — Airtight Flow

## Absolute Rule

**Authentication does not deprecate from middleware.** The D1 Worker is always-on, holds the auth state, and seals the handshake between backend and frontend. If any part fails, primary and fallback D1 workers overcompensate.

## Architecture — The D1 Middleman

```
                    ┌─────────────────────────────┐
                    │   Cloudflare D1 Worker       │
                    │   (athena-mcp-server)        │
                    │                             │
                    │   ┌─────────────────────┐   │
  Backend ────────► │   │  D1: activation_state│   │ ◄──────── Frontend
  (Vercel)          │   │  (holds auth state)   │   │         (Widget)
                    │   └─────────────────────┘   │
                    │           │                  │
                    │    ┌──────┴──────┐           │
                    │    │ DurableObject│           │
                    │    │ (MCP tools)  │           │
                    │    └─────────────┘           │
                    │           │                  │
                    │    ┌──────┴──────┐           │
                    │    │ Cron: */5min│           │
                    │    │ (always warm)│           │
                    │    └─────────────┘           │
                    └─────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │   Poke Agent API    │
                    │   (primary model)   │
                    └─────────────────────┘
```

## Flow — Airtight, All Triggers Active Upon Landing

### Phase 0: Worker is always on (before user lands)

- **Cron trigger** fires every 5 minutes — keeps the Worker warm
- **D1 table** `activation_state` persists across requests
- **DurableObject** (MCP) stays initialized between requests
- **Cron handler** marks sessions >30min as stale, pokes Poke keepalive for active sessions

### Phase 1: User lands on homepage (not signed in)

1. Widget renders (CLOSED) — AI model nested, awaiting trigger signal
2. Widget calls `GET /api/athena/activate` (Vercel route)
   - Vercel checks Supabase `ai_service_health` → `standby`
   - Returns `{ activated: false, status: 'standby' }`
3. Widget also calls `GET https://athena-mcp-server.morphylee22.workers.dev/health`
   - D1 Worker returns `{ status: 'ok' }` — confirms Worker is alive
   - Widget knows the middleman is ready to receive triggers

### Phase 2: User clicks Sign In

1. **Primary trigger** — Clerk webhook fires `session.created`
   - Backend calls `POST https://athena-mcp-server.../activate/{userId}`
   - D1 inserts `status='activating'`, increments `primary_trigger_count`
   - Fires 3 parallel tasks: Poke + MCP + preload
   - On completion: `status='active'` in D1 + Supabase

2. **Widget polls** `GET /api/athena/activate` every 2s
   - Vercel route checks Supabase (which D1 also updated)
   - If `active` → green dot, model ready
   - If `activating` → amber dot, trigger in flight

3. **Fallback trigger** — Dashboard load fires `/api/user/sync` POST
   - Vercel checks `check_athena_warmth()` in Supabase
   - If cold/stale → fires `POST /api/athena/activate { fallback: true }`
   - D1 increments `fallback_trigger_count`
   - Fires same 3 tasks again (primary + fallback overcompensate)

4. **Widget self-trigger** — if still `standby` after 6s of polling
   - Widget calls `POST /api/athena/activate { fallback: true }`
   - D1 handles it directly (no Vercel needed)
   - This is the last resort — fires from the frontend to D1

### Phase 3: User opens widget (clicks sparkle button)

1. **If `modelActivated=true`** → full agent mode
   - Chat routes to Poke API (primary) → Cloudflare AI (fallback) → plain chatbot (last resort)
   - MCP tools available (github_read_file, db_query, web_search)

2. **If `modelActivated=false`** → 15 randomized fallback responses
   - Preloaded in widget — instant response, no backend call
   - User gets useful content about PitchCoach Ai features
   - When activation completes → seamlessly switches to full agent mode

## D1 as the Ultimate Seal

The D1 Worker is the middleman that unifies the authentication process:

| Capability | How D1 does it |
|---|---|
| **Holds auth state** | `activation_state` table persists `status`, `mcp_session_id`, `poke_warmed` across all requests |
| **Communicates with all parts** | D1 ↔ Vercel (via REST), D1 ↔ Poke (via API), D1 ↔ MCP (via DurableObject), D1 ↔ Widget (via HTTP) |
| **Always on** | Cron trigger every 5min — Worker never goes cold |
| **Primary + fallback overcompensate** | Both `primary_trigger_count` and `fallback_trigger_count` increment independently. If primary fires and fails, fallback fires and succeeds — both write to D1 |
| **Staleness detection** | Cron marks sessions >30min as `stale` → triggers re-warm on next activity |
| **Supabase sync** | D1 writes to Supabase `ai_service_health` table so Vercel can read state without calling D1 directly |

## Session Dehydration Protection (Absolute Rule)

The auth process is protected at every layer:

| Layer | Protection | Failure scenario |
|---|---|---|
| D1 Worker | Always-on (cron) + DurableObject | If Worker goes cold → cron wakes it in <5min |
| Clerk webhook | Fire-and-forget (5s max) | If webhook fails → dashboard sync catches it |
| Dashboard sync | Checks warmth, fires fallback | If sync fails → widget self-trigger catches it |
| Widget polling | 2s intervals, 30s max | If all fail → 15 fallback responses (instant, no backend) |
| Supabase DB | Trigger on `lastActiveAt` update | If all app-level triggers fail → DB trigger catches it |
| Poke keepalive | Cron pings active sessions | If Poke goes cold → cron re-warms it |

**No single point of failure.** Five independent trigger sources, three fallback layers, D1 holding the state between all of them.

## 98% Success Target

| Path | Success rate | Covers |
|---|---|---|
| Primary (Clerk webhook) | ~95% | Most sign-ins |
| + Dashboard fallback | ~97% | Catches webhook failures |
| + Widget self-trigger | ~98% | Catches dashboard failures |
| + Fallback responses | 100% | Even if all triggers fail, user gets instant response |

## API Endpoints

### Cloudflare D1 Worker (always on)

| Endpoint | Method | Purpose |
|---|---|---|
| `/health` | GET | Always 200 — confirms Worker is alive |
| `/activate/:userId` | GET | Check activation state from D1 |
| `/activate/:userId` | POST | Fire trigger (primary or fallback) — writes to D1 + Supabase |
| `/mcp` | POST | MCP protocol (tools: github_read_file, db_query, web_search) |
| `/` | GET | Server info |

### Vercel (Next.js API routes)

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/athena/activate` | GET | Check activation (reads Supabase, D1 syncs to it) |
| `/api/athena/activate` | POST | Fire trigger (calls D1 Worker) |
| `/api/athena/preload` | POST | Prime route + Poke bridge |
| `/api/athena/chat` | POST | Chat with Athena (Poke primary, CF AI fallback) |
| `/api/athena/greet` | GET | Voice greeting (ElevenLabs TTS) |
| `/api/athena/speak` | POST | Text-to-speech (ElevenLabs) |
| `/api/athena/quota` | GET | Message quota |
| `/api/user/sync` | POST | Dashboard sync + warmth check + fallback trigger |

## Security

- `ATHENA_SECRET_KEY` on Vercel (encrypted) + D1 Worker (secret) — for internal trigger auth
- `POKE_API_KEY` on Vercel + D1 Worker — for Poke API calls
- Widget never holds API keys — all calls go through API routes
- D1 Worker accepts requests from Vercel (Clerk auth) or direct (ATHENA_SECRET_KEY bearer)
- No session hijacking: D1 state is keyed by user_id, not by session token
