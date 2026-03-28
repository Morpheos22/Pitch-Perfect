# PitchCoach AI - Context Summary for Claude

## Project Overview

PitchCoach AI is a comprehensive pitch coaching platform for founders preparing for fundraising. The platform offers 4 AI-powered coaching modules (E1-E4) designed to help entrepreneurs improve their investor pitches. The project is being developed for Automagikal and is currently in deployment phase.

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, shadcn/ui
- **Authentication**: Clerk (OAuth + Email)
- **Database**: Supabase PostgreSQL with Prisma ORM
- **File Storage**: Cloudflare R2 (PDF, PPTX)
- **Video Processing**: Cloudflare Stream
- **AI Models**: Claude Sonnet (text), Gemini Flash/Pro (video)
- **Payments**: Stripe (Global), Paystack (African markets)
- **Hosting**: Vercel

## Live Deployment

- **URL**: https://pitchcoach-ai-smoky.vercel.app
- **GitHub**: https://github.com/Morpheos22/pitchcoach-ai

## Module Architecture

### E1: Pitch Deck Analyser
- Upload PDF/PPTX pitch decks
- Claude Sonnet analyzes content clarity, visual design, investor readiness
- 8-dimension content scoring (problem, solution, market, team, traction, financials, etc.)
- Visual audit (design consistency, readability, typography)
- Cost per session: ~$0.047

### E2: Elevator Pitch Script Coach
- Text input or file upload for pitch scripts
- 5-element scoring (Hook, Problem, Solution, Credibility, CTA)
- AI rewrites and alternative opening hooks
- Cost per session: ~$0.026

### E3: Live Pitch Coach (Video ≤3 min)
- Upload short video recordings
- Gemini Flash analyzes delivery and body language
- Delivery scores (pace, clarity, filler words, energy, confidence)
- Body language scores (eye contact, facial expressions, gestures, posture)
- Cost per session: ~$0.071

### E4: Full Pitch Session (Video ≤30 min + Deck)
- Comprehensive analysis combining deck and video
- Gemini Pro for long-context video analysis
- 6-dimension investor readiness scoring
- Q&A preparation with anticipated questions
- Cost per session: ~$2.17 (most expensive module)

## Database Schema

Key models:
- **User**: clerkId, email, profile data, Zoho integration fields
- **Subscription**: Plan type (FREE/STARTER/PROFESSIONAL/ENTERPRISE), Stripe + Paystack fields
- **Usage**: Monthly tracking per module (e1-e4), AI token usage
- **PitchDeck**: File info, content/visual scores, AI feedback
- **PitchScript**: Script data, 5-element scores, rewritten versions
- **PitchVideo**: Video metadata, delivery/body language scores, transcript
- **FullPitchSession**: Combined deck+video, 6-dimension investor readiness
- **Transaction**: Payment records for both Stripe and Paystack
- **ModuleAccess**: Per-module unlock status and usage limits

## Security Implementation

All API routes use Clerk's `auth()` to get authenticated user from session - NEVER trust client input for userId. Middleware protects all non-public routes. Database uses a least-privilege user (pitchcoach_app) instead of superuser for runtime operations.

## Environment Variables Required

```
DATABASE_URL=postgresql://pitchcoach_app:...
DIRECT_URL=postgresql://postgres:...
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_APP_URL=https://pitchcoach-ai-smoky.vercel.app
```

## Current Build Status

**Completed:**
- Project setup and structure
- Database schema with Prisma
- Clerk authentication integration
- Security hardening (auth on all routes, least-privilege DB user)
- Vercel deployment
- Landing page, auth pages, dashboard layout
- 4 coaching module pages (UI only)
- API routes for all modules (placeholder/mock responses)
- Paystack billing schema added

**In Progress:**
- Post-authentication redirect flow (Clerk dashboard configuration needed)

**Not Started:**
- Cloudflare R2 file upload integration
- Cloudflare Stream video upload integration
- Claude/Gemini AI analysis integration
- Stripe billing implementation
- Paystack billing implementation
- Zoho CRM integration

## Pricing Strategy

Target launch price: $15-20/month

Recommended tiers:
- **Free Trial**: 1 E1 + 1 E2 session
- **Starter ($9/mo)**: 5 E1, 10 E2, 2 E3, 0 E4
- **Professional ($19/mo)**: 20 E1, 50 E2, 10 E3, 2 E4
- **Enterprise ($49/mo)**: Unlimited E1/E2, 30 E3, 10 E4

## Key Constraints

1. Never use placeholder URLs - always use https://pitchcoach-ai-smoky.vercel.app
2. Brand colors: #334B79 (blue), #4AAB9A (green), #ED3B65 (red), #FFFFFF (white)
3. Font: Nunito Sans for documents
4. Mark documents as CONFIDENTIAL for Automagikal
5. E4 sessions are the most expensive - limit in lower tiers to protect margins

## Cost Analysis Summary

| Metric | Value |
|--------|-------|
| Fixed Monthly Costs | $44-74 |
| Avg Variable Cost/User | $0.62-3.15 |
| Payment Processing | 2-5% per transaction |
| Projected Margin @ $15 | 75-93% |
| Projected Margin @ $20 | 83-93% |
| 1000 Users Monthly Cost | ~$3,768 |
| 1000 Users Monthly Revenue | $15,000 |
| 1000 Users Net Margin | $11,232 (75%) |

## Request

Based on this context, please provide your own detailed cost analysis and margin assessment for the PitchCoach AI platform. Consider:
1. Are there any cost optimization opportunities I may have missed?
2. How do these costs compare to competitors in the pitch coaching space?
3. What pricing strategy would maximize both adoption and profitability?
4. Are there any hidden costs or risks in this architecture?
5. Recommendations for cost-efficient scaling.
