# PitchCoach AI

> AI-powered coaching for every pitch, every format, every stage.

## Overview

PitchCoach AI provides expert coaching for founders, entrepreneurs, and professionals preparing high-stakes presentations. The platform offers four specialized modules:

### Modules

| Module | Name | Purpose |
|--------|------|---------|
| **E1** | Pitch Deck Analyser | Upload your deck, get an expert audit against the 10-slide framework |
| **E2** | Elevator Pitch Script Coach | Submit your script, get element-by-element feedback and rewrites |
| **E3** | Live Elevator Pitch | Record yourself, get delivery + body language coaching |
| **E4** | Full Pitch Session | Complete investor-readiness analysis with Q&A prep |

## Tech Stack

- **Frontend:** Next.js 15, React, TypeScript, Tailwind CSS, shadcn/ui
- **Auth:** Clerk (OAuth: LinkedIn, Google + email/password)
- **Database:** PostgreSQL (Neon/Supabase) + Prisma ORM
- **Storage:** Cloudflare R2 (files), Cloudflare Stream (video)
- **AI:** Claude Sonnet 4.6 (text), Gemini 2.5 Flash/1.5 Pro (video)
- **Billing:** Stripe (subscriptions + bundles)
- **Integrations:** Zoho CRM, Books, Campaigns, Trainer Central SSO

## Documentation

- [Architecture Plan](./docs/ARCHITECTURE.md) - Complete technical specification
- [Execution Plan](./docs/EXECUTION_PLAN.md) - 3-week build timeline

## Quick Start

```bash
# Clone the repository
git clone https://github.com/Morpheos22/pitchcoach-ai.git
cd pitchcoach-ai

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local

# Run database migrations
npx prisma migrate dev

# Start development server
npm run dev
```

## Environment Variables

Required environment variables are documented in `.env.example`. You'll need:

- Clerk keys (authentication)
- Database URL (PostgreSQL)
- Stripe keys (billing)
- Anthropic API key (Claude)
- Google AI API key (Gemini)
- Cloudflare R2 credentials (file storage)
- Cloudflare Stream credentials (video)
- Zoho OAuth credentials (integrations)

## Project Structure

```
pitchcoach-ai/
├── app/                    # Next.js 15 App Router
│   ├── (auth)/            # Authentication routes
│   ├── (dashboard)/       # Protected dashboard
│   ├── (modules)/         # E1-E4 module routes
│   ├── (marketing)/       # Public pages
│   ├── admin/             # Admin panel
│   └── api/               # REST API endpoints
├── components/
│   ├── ui/                # shadcn/ui primitives
│   ├── common/            # Shared components
│   └── modules/           # Module-specific components
├── lib/
│   ├── ai/                # Claude & Gemini clients
│   ├── storage/           # R2 & Stream clients
│   ├── billing/           # Stripe integration
│   └── integrations/      # Zoho integrations
├── prisma/                # Database schema
├── hooks/                 # Custom React hooks
└── types/                 # TypeScript definitions
```

## License

Proprietary - All rights reserved.

---

Built by [AutomagiKal](https://automagikal.com)
