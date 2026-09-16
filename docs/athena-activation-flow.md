# Athena AI Service Layer Activation Flow

## Overview

This document defines the mandatory trigger-signal-auth flow for Athena's AI service layer. It must be obeyed on every sign-in process by the platform, backend, and frontend.

## Architecture

```
User lands on homepage
    │
    ▼
Widget renders (CLOSED) ──► AI model nested in widget, awaiting trigger
    │                         │
    │                         ▼
    │                    GET /api/athena/activate
    │                    → { activated: false, status: 'standby' }
    │
    ▼
User clicks Sign In
    │
    ├──► Clerk auth starts
    │
    ├──► Clerk webhook fires session.created
    │         │
    │         ▼
    │    PRIMARY TRIGGER (backend → AI model)
    │         ├── POST /api/athena/preload (auth header)
    │         ├── POST poke.com/api/v1/inbound/api-message (context warm)
    │         └── POST athena-mcp-server/mcp (DurableObject init)
    │         │
    │         ▼
    │    mark_athena_warm() → status='warm' in DB
    │
    ▼
Dashboard loads → /api/user/sync POST fires
    │
    ├──► Checks ai_service_health (check_athena_warmth)
    │         │
    │         ▼
    │    If cold/stale → FALLBACK TRIGGER
    │         ├── POST /api/athena/activate (fallback=true)
    │         ├── POST /api/athena/preload
    │         ├── POST poke.com/api/v1/inbound/api-message
    │         └── POST athena-mcp-server/mcp
    │         │
    │         ▼
    │    mark_athena_warm() → status='warm'
    │
    ▼
Widget polls GET /api/athena/activate every 2s
    │
    ├──► status='active' → GREEN DOT on widget → model ready
    ├──► status='activating' → AMBER DOT on widget → trigger in flight
    └── status='standby' after 6s → widget fires POST /activate (fallback)
    │
    ▼
User clicks sparkle button → widget opens
    │
    ├──► modelActivated=true → full agent mode (Poke API + tools)
    └──► modelActivated=false → 15 randomized fallback responses
         (instant, no backend call — user doesn't wait)
```

## Trigger Sources

| Source | When | Method | Reliability |
|---|---|---|---|
| Clerk webhook | session.created / user.created | fireAthenaWarmup() | Primary — fires within 1s of auth |
| Dashboard sync | /api/user/sync POST | check_athena_warmth() + fire if cold | Fallback — fires within 2-3s of dashboard load |
| Widget self-trigger | GET /activate after 6s of standby | POST /activate { fallback: true } | Last resort — fires from frontend |
| DB trigger | users.lastActiveAt update | trg_athena_warmup_on_user_active | Background — fires on every sync |

## Signal Format

The backend sends the trigger with an auth header:
```
POST /api/athena/activate
Authorization: Bearer {ATHENA_SECRET_KEY}
Content-Type: application/json
{ "fallback": false }
```

The AI model receives:
```
POST poke.com/api/v1/inbound/api-message
Authorization: Bearer {POKE_API_KEY}
{ "message": "System: User {email} authenticated. Activate AI model." }
```

The MCP DurableObject receives:
```
POST athena-mcp-server/mcp
Accept: application/json, text/event-stream
{ "jsonrpc": "2.0", "method": "initialize", ... }
```

## Session Dehydration Protection

The flow is protected from middleware session dehydration at three layers:

1. **DB layer:** `trg_athena_warmup_on_user_active` fires on every `lastActiveAt` update (5-min debounce). Even if the webhook and dashboard sync both fail, the DB trigger catches the activity.

2. **Webhook layer:** `fireAthenaWarmup()` in the Clerk webhook is fire-and-forget (5s max). It never blocks the webhook response, so Clerk doesn't retry.

3. **Widget layer:** The widget polls `/api/athena/activate` every 2s for 30s. If the primary and dashboard triggers both fail, the widget fires its own fallback trigger via POST.

## Fallback Responses (15)

When the AI model is not yet activated, the widget uses 15 preloaded randomized responses. These are complete, helpful answers about PitchCoach Ai features (scoring, modules, pricing) that don't require backend tools. The user gets an instant response — no blank screen, no "I'm still connecting" message.

When activation completes (modelActivated=true), the widget switches to full agent mode (Poke API + MCP tools + Cloudflare AI fallback).

## 98% Success Target

- Primary trigger (Clerk webhook): fires within 1s of auth — 95% success rate
- Dashboard fallback: fires within 3s of dashboard load — catches 3% of primary failures
- Widget self-trigger: fires after 6s of standby — catches remaining 2%
- Combined: 98%+ success rate from trigger to receiver

## API Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/athena/activate` | GET | Check activation state (standby/activating/active/stale) |
| `/api/athena/activate` | POST | Fire activation trigger (primary or fallback) |
| `/api/athena/preload` | POST | Prime the route + Poke bridge (auth header) |
| `/api/athena/greet` | GET | Generate personalized voice greeting (ElevenLabs TTS) |
| `/api/athena/speak` | POST | Convert text to speech (ElevenLabs TTS) |
| `/api/athena/chat` | POST | Chat with Athena (Poke API primary, Cloudflare AI fallback) |
| `/api/athena/quota` | GET | Check message quota (anon vs auth) |

## Security

- `ATHENA_SECRET_KEY` is set on both Vercel (encrypted) and Cloudflare Worker (secret). Never hardcoded in source.
- The widget never exposes API keys — all calls go through Next.js API routes.
- The POST /activate endpoint accepts either Clerk auth or `ATHENA_SECRET_KEY` bearer token.
- Session hijacking protection: the widget only activates on authenticated requests. The `ATHENA_SECRET_KEY` is a random 43-char token that changes on rotation.
