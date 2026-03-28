# PitchCoach AI — 3-Week Execution Strategy

**Build Timeline:** 21 Days  
**Start Date:** Day 0  
**Target:** Production-ready MVP with all 4 modules + Zoho integrations

---

## Phase Structure Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  WEEK 1: FOUNDATION + CORE MODULES (E1, E2)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  Days 1-2:   Project setup, auth, database, deployment pipeline            │
│  Days 3-4:   Module E1 (Deck Analyzer) — upload → analyze → report         │
│  Days 5-6:   Module E2 (Script Coach) — input → analyze → rewrites         │
│  Day 7:      Billing foundation (Stripe products, checkout)                │
├─────────────────────────────────────────────────────────────────────────────┤
│  WEEK 2: BILLING + VIDEO MODULES (E3, E4)                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  Days 8-9:   Stripe webhooks, subscriptions, usage tracking                │
│  Days 10-12: Module E3 (Live Pitch) — recording → video analysis           │
│  Days 13-14: Module E4 (Full Session) — multi-input → comprehensive report │
├─────────────────────────────────────────────────────────────────────────────┤
│  WEEK 3: INTEGRATIONS + POLISH                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  Days 15-16: Zoho CRM + Books + Campaigns integrations                     │
│  Day 17:     Trainer Central SSO                                           │
│  Day 18:     Admin panel, analytics dashboard                              │
│  Day 19:     Performance optimization, error handling                      │
│  Day 20:     Security audit, rate limiting finalization                    │
│  Day 21:     Final testing, documentation, launch prep                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## WEEK 1: Foundation + Core Modules

### Day 1: Project Initialization

**Morning (4 hours)**
- [ ] Initialize Next.js 15 project with TypeScript
- [ ] Configure Tailwind CSS + shadcn/ui
- [ ] Set up ESLint, Prettier, Husky pre-commit
- [ ] Create folder structure per architecture
- [ ] Set up environment variables template

**Afternoon (4 hours)**
- [ ] Configure Clerk authentication
- [ ] Create sign-in/sign-up pages
- [ ] Implement protected route middleware
- [ ] Set up Prisma with PostgreSQL (Neon/Supabase)
- [ ] Run initial database migration

**Deliverables:**
- Working Next.js app with auth
- Database schema migrated
- GitHub repo created and linked

---

### Day 2: UI Framework + Storage

**Morning (4 hours)**
- [ ] Build root layout with ClerkProvider
- [ ] Create marketing layout (Header, Footer)
- [ ] Create dashboard layout (Sidebar, Navigation)
- [ ] Build common components: FileUploader, ScoreCard, LoadingSpinner
- [ ] Implement theme switching (light/dark)

**Afternoon (4 hours)**
- [ ] Set up Cloudflare R2 bucket
- [ ] Create R2 client library (lib/storage/r2-client.ts)
- [ ] Implement presigned URL generation
- [ ] Build upload progress component
- [ ] Test file upload flow end-to-end

**Deliverables:**
- Complete UI framework
- R2 storage working with presigned uploads

---

### Day 3: Module E1 — Deck Upload & Processing

**Morning (4 hours)**
- [ ] Create E1 route structure: /analyze
- [ ] Build DeckUploadZone component (drag-drop, validation)
- [ ] Implement PDF/PPTX file validation
- [ ] Create upload API: POST /api/modules/analyze/upload
- [ ] Build upload progress UI with cancel capability

**Afternoon (4 hours)**
- [ ] Implement PDF text extraction (pdf-parse)
- [ ] Implement PPTX slide extraction (pptx-parser/JSZip)
- [ ] Convert slides to images for vision analysis
- [ ] Store extracted content in database
- [ ] Create processing status tracking

**Deliverables:**
- Deck upload working
- Content extracted and stored

---

### Day 4: Module E1 — AI Analysis & Reporting

**Morning (4 hours)**
- [ ] Create Claude client library (lib/ai/claude/client.ts)
- [ ] Implement deck analysis prompt (10-slide framework)
- [ ] Implement visual audit prompt (5 dimensions)
- [ ] Create analysis API: POST /api/modules/analyze/process
- [ ] Build polling mechanism for status updates

**Afternoon (4 hours)**
- [ ] Build results page UI:
  - [ ] Content score grid (10 slides)
  - [ ] Visual audit report
  - [ ] Priority actions list
  - [ ] Overall assessment
- [ ] Implement PDF report generation (React-PDF or similar)
- [ ] Add download functionality
- [ ] Create session history entry

**Deliverables:**
- Complete E1 module functional
- PDF reports downloadable

---

### Day 5: Module E2 — Script Input & Analysis

**Morning (4 hours)**
- [ ] Create E2 route structure: /script
- [ ] Build ScriptInput component (tabs: paste, upload, URL)
- [ ] Implement text paste with character counter
- [ ] Implement DOCX extraction (mammoth.js)
- [ ] Implement PDF text extraction for scripts
- [ ] Create upload API: POST /api/modules/script/analyze

**Afternoon (4 hours)**
- [ ] Implement 5-element framework analysis (Claude)
- [ ] Build excerpt identification logic
- [ ] Implement tone analysis
- [ ] Calculate estimated duration and word count
- [ ] Store analysis results in database

**Deliverables:**
- Script input working (text, PDF, DOCX)
- AI analysis pipeline complete

---

### Day 6: Module E2 — Results & Rewrite Engine

**Morning (4 hours)**
- [ ] Build E2 results page UI:
  - [ ] Element score cards with excerpts
  - [ ] Tone visualization (radar/bar chart)
  - [ ] Duration estimate display
  - [ ] Overall feedback section
- [ ] Implement excerpt highlighting in original text

**Afternoon (4 hours)**
- [ ] Build rewrite suggestion engine (Claude)
- [ ] Create API: POST /api/modules/script/rewrite
- [ ] Build rewrite suggestions UI with apply button
- [ ] Implement session comparison (before/after)
- [ ] Add to session history

**Deliverables:**
- Complete E2 module functional
- Rewrite suggestions working

---

### Day 7: Billing Foundation

**Morning (4 hours)**
- [ ] Create Stripe products and prices (test mode):
  - [ ] Individual tier (monthly/annual)
  - [ ] Team tier (monthly/annual)
  - [ ] Enterprise tier (contact sales placeholder)
  - [ ] Bundle: E1+E2 dual module
  - [ ] Bundle: Complete package (all 4)
- [ ] Store product IDs in environment/config

**Afternoon (4 hours)**
- [ ] Create Stripe client library (lib/billing/stripe-client.ts)
- [ ] Build pricing page UI
- [ ] Implement checkout session creation
- [ ] Build checkout API: POST /api/billing/checkout
- [ ] Create success/cancel redirect pages

**Deliverables:**
- Stripe products configured
- Checkout flow working (test mode)

---

## WEEK 2: Billing + Video Modules

### Day 8: Stripe Webhooks & Subscription Management

**Morning (4 hours)**
- [ ] Create webhook endpoint: POST /api/webhooks/stripe
- [ ] Handle checkout.session.completed
- [ ] Handle customer.subscription.created/updated/deleted
- [ ] Handle invoice.paid/invoice.payment_failed
- [ ] Update user tier in database on events

**Afternoon (4 hours)**
- [ ] Build customer portal integration
- [ ] Create portal API: POST /api/billing/portal
- [ ] Implement subscription status display in dashboard
- [ ] Build usage meter component (sessions remaining)
- [ ] Test full subscription lifecycle

**Deliverables:**
- Webhooks processing correctly
- Subscription management working

---

### Day 9: Usage Tracking & Tier Enforcement

**Morning (4 hours)**
- [ ] Implement usage tracking per module
- [ ] Create entitlement check middleware
- [ ] Build tier limit enforcement (block when exceeded)
- [ ] Implement bundle purchase tracking
- [ ] Create usage reset logic (monthly)

**Afternoon (4 hours)**
- [ ] Build bundle purchase flow
- [ ] Create bundle API: GET/POST /api/billing/bundles
- [ ] Build bundle selector UI
- [ ] Implement usage history page
- [ ] Add upgrade prompts when limits hit

**Deliverables:**
- Usage tracking accurate
- Tier limits enforced

---

### Day 10: Module E3 — Video Infrastructure

**Morning (4 hours)**
- [ ] Set up Cloudflare Stream
- [ ] Create Stream client library (lib/storage/stream-client.ts)
- [ ] Implement direct upload URL generation
- [ ] Build video upload API: POST /api/modules/live-pitch/upload
- [ ] Set up Stream webhooks: POST /api/webhooks/cloudflare

**Afternoon (4 hours)**
- [ ] Build VideoRecorder component:
  - [ ] Camera/mic permission handling
  - [ ] Recording controls (start, pause, stop)
  - [ ] Timer display (max 3 minutes)
  - [ ] Live preview
  - [ ] Safari detection + fallback
- [ ] Build AudioRecorder component (alternative mode)
- [ ] Implement re-record functionality

**Deliverables:**
- Cloudflare Stream configured
- In-browser recording working

---

### Day 11: Module E3 — Video Analysis

**Morning (4 hours)**
- [ ] Create Gemini client library (lib/ai/gemini/client.ts)
- [ ] Implement hybrid model selection (Flash vs Pro)
- [ ] Build delivery analysis prompt (pacing, clarity, confidence)
- [ ] Create analysis API: POST /api/modules/live-pitch/analyze
- [ ] Handle video URL processing

**Afternoon (4 hours)**
- [ ] Implement body language analysis:
  - [ ] Eye contact detection
  - [ ] Posture assessment
  - [ ] Gesture recognition
- [ ] Build coaching drill generation
- [ ] Parse and store analysis results
- [ ] Test with sample recordings

**Deliverables:**
- Gemini video analysis working
- Body language feedback generated

---

### Day 12: Module E3 — Results & Comparison

**Morning (4 hours)**
- [ ] Build E3 results page UI:
  - [ ] Delivery score breakdown
  - [ ] Body language visualization
  - [ ] Coaching drills cards
  - [ ] Overall score display
- [ ] Implement video playback with annotations

**Afternoon (4 hours)**
- [ ] Build session comparison feature:
  - [ ] Previous session selector
  - [ ] Score delta visualization
  - [ ] Improvement areas highlight
- [ ] Add transcript input option (for deeper analysis)
- [ ] Create session history for E3
- [ ] End-to-end E3 testing

**Deliverables:**
- Complete E3 module functional
- Session comparison working

---

### Day 13: Module E4 — Multi-Input System

**Morning (4 hours)**
- [ ] Create E4 route structure: /full-session
- [ ] Build MultiFileUpload component:
  - [ ] Deck upload section
  - [ ] Video upload/record section
  - [ ] Transcript input section
- [ ] Implement 3-step guided flow UI
- [ ] Create upload orchestration API

**Afternoon (4 hours)**
- [ ] Build combined processing pipeline:
  - [ ] Deck analysis (reuse E1 logic)
  - [ ] Video analysis (reuse E3 logic)
  - [ ] Transcript analysis (reuse E2 logic)
- [ ] Create analysis API: POST /api/modules/full-session/analyze
- [ ] Implement progress tracking for multi-step analysis

**Deliverables:**
- Multi-input upload working
- Processing pipeline complete

---

### Day 14: Module E4 — 6-Dimension Analysis & Reporting

**Morning (4 hours)**
- [ ] Implement 6-dimension analysis:
  - [ ] Deck Alignment
  - [ ] Narrative Arc
  - [ ] Content Depth (8 sections)
  - [ ] Delivery
  - [ ] Investor Readiness (red flags/green lights)
  - [ ] Q&A Prep (5 anticipated questions)
- [ ] Create comprehensive prompt for full session

**Afternoon (4 hours)**
- [ ] Build E4 results page UI:
  - [ ] Dimension score cards
  - [ ] Investor readiness gauge
  - [ ] Red flags/green lights list
  - [ ] Q&A preparation section
  - [ ] Executive summary
- [ ] Generate comprehensive PDF report
- [ ] Add to session history

**Deliverables:**
- Complete E4 module functional
- Full analysis reports generated

---

## WEEK 3: Integrations + Polish

### Day 15: Zoho CRM Integration

**Morning (4 hours)**
- [ ] Set up Zoho API credentials (OAuth)
- [ ] Create Zoho CRM client library (lib/integrations/zoho/crm.ts)
- [ ] Implement contact creation on user registration
- [ ] Implement contact update on subscription events
- [ ] Build activity logging for sessions

**Afternoon (4 hours)**
- [ ] Create sync job for existing users
- [ ] Implement duplicate detection
- [ ] Build admin dashboard for CRM sync status
- [ ] Add sync log model and tracking
- [ ] Test full CRM flow

**Deliverables:**
- Zoho CRM sync working
- Contacts created/updated automatically

---

### Day 16: Zoho Books & Campaigns Integration

**Morning (4 hours)**
- [ ] Create Zoho Books client (lib/integrations/zoho/books.ts)
- [ ] Implement invoice sync from Stripe payments
- [ ] Create customer sync on subscription
- [ ] Handle refund credit notes
- [ ] Test invoice generation flow

**Afternoon (4 hours)**
- [ ] Create Zoho Campaigns client (lib/integrations/zoho/campaigns.ts)
- [ ] Implement subscriber management
- [ ] Add users to appropriate lists by tier
- [ ] Handle unsubscribe events
- [ ] Build email sequence triggers

**Deliverables:**
- Zoho Books invoicing synced
- Campaigns subscriber management working

---

### Day 17: Trainer Central SSO + Admin Panel

**Morning (4 hours)**
- [ ] Implement SSO token generation (JWT)
- [ ] Create SSO redirect endpoint: GET /api/integrations/zoho/sso
- [ ] Build SSO button in dashboard
- [ ] Handle SSO errors gracefully
- [ ] Test SSO flow with Trainer Central

**Afternoon (4 hours)**
- [ ] Build admin panel layout
- [ ] Create user management table:
  - [ ] Search/filter users
  - [ ] Update tier/role
  - [ ] View usage details
- [ ] Build subscription management view
- [ ] Create analytics dashboard skeleton

**Deliverables:**
- Trainer Central SSO working
- Admin panel functional

---

### Day 18: Admin Analytics & System Health

**Morning (4 hours)**
- [ ] Build analytics API: GET /api/admin/analytics
- [ ] Create metrics aggregation:
  - [ ] User counts by tier
  - [ ] Session counts by module
  - [ ] Average scores
  - [ ] Revenue metrics
- [ ] Build analytics dashboard UI with charts

**Afternoon (4 hours)**
- [ ] Create system health monitoring:
  - [ ] API response times
  - [ ] Error rates
  - [ ] Storage usage
  - [ ] AI API usage/costs
- [ ] Build health status page
- [ ] Implement audit log viewing

**Deliverables:**
- Analytics dashboard complete
- System health monitoring in place

---

### Day 19: Performance Optimization & Error Handling

**Morning (4 hours)**
- [ ] Implement React Suspense boundaries
- [ ] Add loading states for all async operations
- [ ] Optimize images and assets
- [ ] Implement route prefetching
- [ ] Add service worker for offline capability (optional)

**Afternoon (4 hours)**
- [ ] Comprehensive error boundary implementation
- [ ] User-friendly error messages
- [ ] Retry mechanisms for failed operations
- [ ] Implement toast notifications system
- [ ] Add error logging to external service (Axiom/Logflare)

**Deliverables:**
- App performance optimized
- Error handling comprehensive

---

### Day 20: Security Audit & Rate Limiting

**Morning (4 hours)**
- [ ] Implement rate limiting with Upstash Redis
- [ ] Add rate limits per endpoint type:
  - [ ] API: 100/min
  - [ ] Upload: 10/min
  - [ ] AI Analysis: 20/hour (tier-dependent)
- [ ] Review all API routes for authentication
- [ ] Verify file validation (server-side)

**Afternoon (4 hours)**
- [ ] Security headers verification
- [ ] CSRF protection review
- [ ] Input sanitization audit
- [ ] API key rotation documentation
- [ ] GDPR compliance check (data deletion)

**Deliverables:**
- Rate limiting in place
- Security audit complete

---

### Day 21: Final Testing & Launch Prep

**Morning (4 hours)**
- [ ] End-to-end testing all 4 modules
- [ ] Cross-browser testing (Chrome, Firefox, Safari, Edge)
- [ ] Mobile responsiveness verification
- [ ] Stripe production mode testing (small test transaction)
- [ ] Zoho integration final verification

**Afternoon (4 hours)**
- [ ] Update environment variables for production
- [ ] Deploy to Vercel production
- [ ] Configure custom domain
- [ ] Set up monitoring/alerts
- [ ] Create deployment documentation

**Deliverables:**
- Production deployment complete
- All systems verified

---

## Daily Rhythm

```
09:00 - 13:00  Morning Block (4 hours focused work)
13:00 - 14:00  Lunch break
14:00 - 18:00  Afternoon Block (4 hours focused work)
18:00 -        Day review, commit, push
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| AI API downtime | Fallback error messages, retry logic, status page |
| Stripe webhook failures | Manual sync endpoint, retry queue |
| Cloudflare Stream delays | Progress indicators, "processing" state |
| Zoho API rate limits | Batch processing, exponential backoff |
| Safari recording issues | File upload fallback, clear user messaging |

---

## Success Criteria

By Day 21, the following must be functional:

- [ ] All 4 modules produce accurate AI feedback
- [ ] Stripe handles subscriptions and bundles correctly
- [ ] Zoho CRM receives user data on registration
- [ ] Zoho Books syncs invoices from Stripe
- [ ] Trainer Central SSO works
- [ ] Admin panel manages users and views analytics
- [ ] App is deployed to production URL
- [ ] Mobile-responsive across all modules

---

## Post-Launch (Week 4+)

- User testing feedback collection
- Performance monitoring
- Bug fixes and hotfixes
- Feature enhancements based on usage patterns
