# PitchCoachAI / Pitch-Perfect

Pitch-Perfect is an AI-powered pitch coaching platform for founders and entrepreneurs. It helps users turn pitch materials and founder context into clearer, more persuasive investor communication through structured analysis, coaching, iteration, and readiness workflows.

The application is built around PitchCoachAI: a modular coaching surface backed by a Next.js application layer, Supabase persistence, and Athena Runtime v2 for bounded, tool-augmented AI orchestration.

## Overview

PitchCoachAI supports the core coaching journey:

- Pitch-deck and pitch-material analysis
- Elevator-script coaching and iteration
- Live and full-pitch coaching workflows
- Founder readiness and pathway guidance
- Persistent sessions, scores, versions, and coaching history

The platform separates product concerns from runtime concerns:

1. Next.js renders the App Router experience and exposes authenticated API boundaries.
2. Prisma models application state against Supabase PostgreSQL.
3. Athena Runtime v2 coordinates model reasoning and MCP tools through Cloudflare Workers AI.
4. Runtime outputs are validated, bounded, and returned to the coaching routes for persistence and presentation.
5. Vercel provides the production deployment surface; Cloudflare Workers hosts the runtime edge components.

## Core Architecture

```text
┌──────────────────────────────────────────────────────────────┐
│                     Next.js App Router                       │
│  Coaching UI · auth boundaries · API routes · error handling  │
└───────────────────────────────┬──────────────────────────────┘
                                │ validated request
                                v
┌──────────────────────────────────────────────────────────────┐
│                     Athena Runtime v2                        │
│ Cloudflare Workers AI · MCP orchestration · bounded context  │
│ adaptive fallback · loop and payload guards                  │
└───────────────┬──────────────────────────┬───────────────────┘
                │                          │
                v                          v
       ┌────────────────┐         ┌────────────────────────────┐
       │ MCP tool layer │         │ Supabase PostgreSQL         │
       │ typed tools    │         │ Prisma ORM · RLS policies   │
       └────────────────┘         └────────────────────────────┘
```

The runtime is intentionally bounded. User and tool context is trimmed before orchestration, each tool call is constrained by payload limits, and the loop terminates deterministically rather than relying on an unbounded agent cycle.

## Athena Runtime v2

Athena Runtime v2 provides the AI execution layer for PitchCoachAI:

- Cloudflare Workers AI supplies the edge runtime and model execution boundary.
- MCP tool orchestration gives the runtime a structured way to discover and call approved tools.
- Adaptive fallback selects a safe alternate execution path when a model, tool, or upstream dependency is unavailable. Fallbacks preserve the same validation and safety boundaries as the primary path.
- Runtime results are normalized before they cross back into application routes.

### Runtime limits

| Guard | Limit | Purpose |
|-------|------:|---------|
| Conversation context | 15 messages | Keeps prompt context bounded and relevant |
| Conversation context | 15,000 characters | Prevents oversized prompt accumulation |
| Agent loop | 8 rounds | Guarantees deterministic termination |
| Tool/request payload | 8 KB | Limits individual orchestration payloads |

These limits are part of the runtime contract, not suggestions. Truncation, rejection, and fallback behavior should remain observable through the application’s structured logging without exposing sensitive input or provider details.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Web application | Next.js with App Router, TypeScript, and standalone output |
| UI | React, Tailwind CSS, and shared UI components |
| Data | Supabase PostgreSQL with Row Level Security (RLS) |
| ORM | Prisma |
| AI runtime | Cloudflare Workers AI with Athena Runtime v2 |
| Tool protocol | MCP (Model Context Protocol) orchestration |
| Hosting | Vercel deployment for the Next.js application; Cloudflare Workers for edge runtime components |

## Repository Layout

```text
src/
├── app/                 # App Router pages, layouts, API routes, and boundaries
├── components/          # Product UI and coaching components
└── lib/                 # AI/runtime clients, auth, persistence, validation, and services
prisma/
├── schema.prisma        # Application data model
└── migrations/          # Versioned database migrations
scripts/
└── vercel-build.sh      # Deterministic Prisma + Next.js production build
.env.example             # Environment variable contract
```

The exact implementation layout may evolve; route handlers and runtime adapters should remain thin, validated boundaries around domain logic.

## Security and Hardening Posture

The repository follows a forensic, fail-closed documentation and deployment standard:

- Dev-auth founder tier is isolated for development workflows and must not be treated as production authentication.
- Error boundaries sanitize user-facing failures; provider errors, stack traces, credentials, and internal implementation details are not returned to clients.
- Security headers are strict and include `Cache-Control: no-store` for sensitive responses and `X-Content-Type-Options: nosniff` to prevent MIME sniffing.
- AI input and tool payloads are validated and bounded before execution.
- Supabase RLS is the database-level isolation boundary; server-side access must still enforce authenticated ownership and authorization.
- Secrets belong in environment configuration, never in source control, logs, README examples, or committed build artifacts.
- CI and production builds use `npm ci` for deterministic dependency installation from the lockfile.
- Structured logs should support diagnosis while redacting credentials, tokens, raw prompts, and sensitive user data.

## Environment Setup

Use the checked-in template as the source of truth for local configuration:

```bash
cp .env.example .env.local
```

Then fill in the required values for the local Supabase database, Prisma, authentication, AI/runtime providers, MCP endpoints, and deployment integrations. Do not copy production secrets into the repository or commit `.env.local`.

## Getting Started

### Prerequisites

- Node.js and npm versions supported by the repository’s package configuration
- A Supabase project with PostgreSQL and the required RLS policies
- Access to the configured authentication and AI/runtime providers

### Install and run

```bash
npm ci
npm run dev
```

### Build and verification

```bash
npm run build
npm run test
```

The production build uses the repository build pipeline and standalone Next.js output. CI should prefer `npm ci` over `npm install` so dependency resolution remains reproducible.

### Database commands

Use the package scripts provided by the repository for Prisma generation, local schema work, migration status, and production migration deployment. Database changes must be reviewed alongside their RLS implications before being applied.

## Operational Notes

- Keep the Athena Runtime v2 limits aligned across the Worker, MCP adapters, and application-side validation.
- Treat adaptive fallback as a controlled degradation path, not a way to bypass validation or authorization.
- Keep error responses sanitized and use structured logs for investigation.
- Verify production behavior through the health endpoint and deployment logs rather than relying on local assumptions.
- Any change to authentication, RLS, runtime limits, headers, or fallback behavior should include a focused regression check.

## License

MIT License — see `LICENSE` for details.
