# PitchCoach AI - Complete Architecture Plan

**Version:** 1.0  
**Last Updated:** 2025-01-20  
**Author:** Architecture Team

---

## Table of Contents

1. [Project Structure](#1-project-structure)
2. [Database Schema](#2-database-schema)
3. [API Routes](#3-api-routes)
4. [Component Architecture](#4-component-architecture)
5. [Integration Architecture](#5-integration-architecture)
6. [File/Video Handling Pipeline](#6-filevideo-handling-pipeline)
7. [AI Prompt Scaffolding](#7-ai-prompt-scaffolding)
8. [Security Considerations](#8-security-considerations)
9. [Development Phases](#9-development-phases)

---

## 1. Project Structure

### 1.1 Root Directory Layout

```
pitchcoach-ai/
├── app/                              # Next.js 15 App Router
│   ├── (auth)/                       # Auth group routes
│   │   ├── sign-in/
│   │   │   └── page.tsx
│   │   ├── sign-up/
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   ├── (dashboard)/                  # Protected dashboard routes
│   │   ├── dashboard/
│   │   │   ├── page.tsx              # Main dashboard
│   │   │   ├── sessions/
│   │   │   │   ├── page.tsx          # Session history
│   │   │   │   └── [sessionId]/
│   │   │   │       └── page.tsx      # Session detail
│   │   │   ├── settings/
│   │   │   │   └── page.tsx
│   │   │   └── billing/
│   │   │       └── page.tsx
│   │   └── layout.tsx
│   ├── (modules)/                    # Module-specific routes
│   │   ├── analyze/                  # E1: Pitch Deck Analyser
│   │   │   ├── page.tsx              # Upload page
│   │   │   ├── [sessionId]/
│   │   │   │   ├── page.tsx          # Results page
│   │   │   │   └── report/
│   │   │   │       └── page.tsx      # Downloadable report
│   │   │   └── layout.tsx
│   │   ├── script/                   # E2: Elevator Pitch Script Coach
│   │   │   ├── page.tsx
│   │   │   ├── [sessionId]/
│   │   │   │   └── page.tsx
│   │   │   └── layout.tsx
│   │   ├── live-pitch/               # E3: Live Elevator Pitch
│   │   │   ├── page.tsx              # Recording interface
│   │   │   ├── [sessionId]/
│   │   │   │   └── page.tsx          # Feedback page
│   │   │   └── layout.tsx
│   │   ├── full-session/             # E4: Full Pitch Session
│   │   │   ├── page.tsx
│   │   │   ├── [sessionId]/
│   │   │   │   └── page.tsx
│   │   │   └── layout.tsx
│   │   └── layout.tsx
│   ├── (marketing)/                  # Public marketing pages
│   │   ├── page.tsx                  # Landing page
│   │   ├── pricing/
│   │   │   └── page.tsx
│   │   ├── features/
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   ├── admin/                        # Admin panel (protected)
│   │   ├── page.tsx                  # Admin dashboard
│   │   ├── users/
│   │   │   └── page.tsx
│   │   ├── subscriptions/
│   │   │   └── page.tsx
│   │   ├── analytics/
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   ├── api/                          # API routes
│   │   ├── auth/
│   │   │   └── [...nextauth]/
│   │   │       └── route.ts
│   │   ├── webhooks/
│   │   │   ├── stripe/
│   │   │   │   └── route.ts
│   │   │   └── cloudflare/
│   │   │       └── route.ts
│   │   ├── modules/
│   │   │   ├── analyze/              # E1 endpoints
│   │   │   │   ├── upload/
│   │   │   │   │   └── route.ts
│   │   │   │   ├── process/
│   │   │   │   │   └── route.ts
│   │   │   │   └── report/
│   │   │   │       └── route.ts
│   │   │   ├── script/               # E2 endpoints
│   │   │   │   ├── analyze/
│   │   │   │   │   └── route.ts
│   │   │   │   └── rewrite/
│   │   │   │       └── route.ts
│   │   │   ├── live-pitch/           # E3 endpoints
│   │   │   │   ├── upload/
│   │   │   │   │   └── route.ts
│   │   │   │   ├── analyze/
│   │   │   │   │   └── route.ts
│   │   │   │   └── sessions/
│   │   │   │       └── route.ts
│   │   │   └── full-session/         # E4 endpoints
│   │   │       ├── upload/
│   │   │       │   └── route.ts
│   │   │       ├── analyze/
│   │   │       │   └── route.ts
│   │   │       └── report/
│   │   │           └── route.ts
│   │   ├── billing/
│   │   │   ├── checkout/
│   │   │   │   └── route.ts
│   │   │   ├── portal/
│   │   │   │   └── route.ts
│   │   │   └── bundles/
│   │   │       └── route.ts
│   │   ├── files/
│   │   │   ├── upload-url/
│   │   │   │   └── route.ts
│   │   │   └── download/
│   │   │       └── [fileId]/
│   │   │           └── route.ts
│   │   ├── integrations/
│   │   │   ├── zoho/
│   │   │   │   ├── sync/
│   │   │   │   │   └── route.ts
│   │   │   │   └── sso/
│   │   │   │       └── route.ts
│   │   │   └── health/
│   │   │       └── route.ts
│   │   └── admin/
│   │       ├── users/
│   │       │   └── route.ts
│   │       ├── tiers/
│   │       │   └── route.ts
│   │       └── analytics/
│   │           └── route.ts
│   ├── layout.tsx                    # Root layout
│   ├── globals.css
│   └── not-found.tsx
├── components/
│   ├── ui/                           # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   ├── dropdown-menu.tsx
│   │   ├── form.tsx
│   │   ├── input.tsx
│   │   ├── progress.tsx
│   │   ├── select.tsx
│   │   ├── tabs.tsx
│   │   ├── toast.tsx
│   │   ├── tooltip.tsx
│   │   └── ... (other shadcn components)
│   ├── common/
│   │   ├── Header.tsx
│   │   ├── Footer.tsx
│   │   ├── Sidebar.tsx
│   │   ├── LoadingSpinner.tsx
│   │   ├── ErrorBoundary.tsx
│   │   ├── FileUploader.tsx
│   │   ├── VideoRecorder.tsx
│   │   ├── AudioRecorder.tsx
│   │   ├── ScoreCard.tsx
│   │   ├── ProgressIndicator.tsx
│   │   └── DownloadButton.tsx
│   ├── modules/
│   │   ├── analyze/                  # E1 components
│   │   │   ├── DeckUploadZone.tsx
│   │   │   ├── SlideAnalysisCard.tsx
│   │   │   ├── VisualAuditReport.tsx
│   │   │   ├── PriorityActions.tsx
│   │   │   ├── ContentScoreGrid.tsx
│   │   │   └── AnalysisReportPreview.tsx
│   │   ├── script/                   # E2 components
│   │   │   ├── ScriptInput.tsx
│   │   │   ├── ElementScoreCard.tsx
│   │   │   ├── ExcerptHighlight.tsx
│   │   │   ├── ToneIndicator.tsx
│   │   │   ├── RewriteSuggestions.tsx
│   │   │   └── DurationEstimate.tsx
│   │   ├── live-pitch/               # E3 components
│   │   │   ├── RecordingInterface.tsx
│   │   │   ├── VideoPreview.tsx
│   │   │   ├── DeliveryFeedback.tsx
│   │   │   ├── BodyLanguageAnalysis.tsx
│   │   │   ├── CoachingDrills.tsx
│   │   │   └── SessionComparison.tsx
│   │   └── full-session/             # E4 components
│   │       ├── MultiFileUpload.tsx
│   │       ├── DimensionAnalysis.tsx
│   │       ├── InvestorReadinessGauge.tsx
│   │       ├── QAPrepSection.tsx
│   │       └── ComprehensiveReport.tsx
│   ├── dashboard/
│   │   ├── SessionHistory.tsx
│   │   ├── ScoreComparison.tsx
│   │   ├── UsageMeter.tsx
│   │   ├── SubscriptionCard.tsx
│   │   └── QuickActions.tsx
│   ├── billing/
│   │   ├── PricingTable.tsx
│   │   ├── BundleSelector.tsx
│   │   ├── CheckoutForm.tsx
│   │   └── PaymentHistory.tsx
│   └── admin/
│       ├── UserTable.tsx
│       ├── TierManager.tsx
│       ├── UsageAnalytics.tsx
│       └── SystemHealth.tsx
├── lib/
│   ├── db/
│   │   ├── index.ts                  # Prisma client
│   │   └── migrations/
│   ├── auth/
│   │   ├── clerk-provider.ts
│   │   ├── middleware.ts
│   │   └── roles.ts
│   ├── ai/
│   │   ├── claude/
│   │   │   ├── client.ts
│   │   │   ├── prompts/
│   │   │   │   ├── deck-analysis.ts
│   │   │   │   ├── script-coach.ts
│   │   │   │   ├── live-pitch.ts
│   │   │   │   └── full-session.ts
│   │   │   └── utils.ts
│   │   └── gemini/
│   │       ├── client.ts
│   │       ├── video-analysis.ts
│   │       └── prompts/
│   │           ├── body-language.ts
│   │           └── delivery-analysis.ts
│   ├── storage/
│   │   ├── r2-client.ts
│   │   ├── stream-client.ts
│   │   └── file-utils.ts
│   ├── billing/
│   │   ├── stripe-client.ts
│   │   ├── subscription-utils.ts
│   │   └── bundle-config.ts
│   ├── integrations/
│   │   ├── zoho/
│   │   │   ├── crm.ts
│   │   │   ├── books.ts
│   │   │   ├── campaigns.ts
│   │   │   └── trainer-central.ts
│   │   └── sso/
│   │       └── trainer-central-sso.ts
│   ├── utils/
│   │   ├── rate-limiter.ts
│   │   ├── file-validation.ts
│   │   ├── pdf-generator.ts
│   │   └── analytics.ts
│   └── constants/
│       ├── subscription-tiers.ts
│       ├── modules.ts
│       └── limits.ts
├── hooks/
│   ├── useAuth.ts
│   ├── useSubscription.ts
│   ├── useFileUpload.ts
│   ├── useVideoRecording.ts
│   ├── useAudioRecording.ts
│   ├── useSessionHistory.ts
│   └── useRateLimit.ts
├── types/
│   ├── index.ts
│   ├── modules.ts
│   ├── subscription.ts
│   ├── user.ts
│   └── api.ts
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/
├── public/
│   ├── images/
│   ├── icons/
│   └── fonts/
├── tests/
│   ├── e2e/
│   │   ├── analyze.spec.ts
│   │   ├── script.spec.ts
│   │   ├── live-pitch.spec.ts
│   │   └── full-session.spec.ts
│   └── unit/
│       ├── ai-prompts.test.ts
│       ├── file-validation.test.ts
│       └── subscription.test.ts
├── middleware.ts                     # Next.js middleware for auth
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
├── .env.local.example
├── .env.example
└── docker-compose.yml               # For local development
```

### 1.2 Key Directory Purposes

| Directory | Purpose |
|-----------|---------|
| `app/(auth)/` | Authentication routes with Clerk integration |
| `app/(dashboard)/` | Protected user dashboard and settings |
| `app/(modules)/` | Feature-specific module routes (E1-E4) |
| `app/(marketing)/` | Public-facing marketing pages |
| `app/admin/` | Admin panel with role-based access |
| `app/api/` | REST API endpoints |
| `components/ui/` | shadcn/ui primitive components |
| `components/common/` | Shared, reusable components |
| `components/modules/` | Module-specific UI components |
| `lib/` | Core business logic and utilities |
| `hooks/` | Custom React hooks |
| `types/` | TypeScript type definitions |

---

## 2. Database Schema

### 2.1 Complete Prisma Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================================================
// USER & AUTHENTICATION
// ============================================================================

model User {
  id                String    @id @default(cuid())
  clerkId           String    @unique
  email             String    @unique
  firstName         String?
  lastName          String?
  profileImageUrl   String?
  
  // Subscription
  subscriptionTier  SubscriptionTier @default(FREE)
  stripeCustomerId  String?   @unique
  stripeSubscriptionId String? @unique
  subscriptionStatus SubscriptionStatus @default(INACTIVE)
  subscriptionStart DateTime?
  subscriptionEnd   DateTime?
  
  // Usage tracking (reset monthly)
  analyzeUsage      Int       @default(0)
  scriptUsage       Int       @default(0)
  livePitchUsage    Int       @default(0)
  fullSessionUsage  Int       @default(0)
  usageResetAt      DateTime  @default(now())
  
  // Bundle purchases
  bundles           BundlePurchase[]
  
  // Sessions
  deckSessions      DeckAnalysisSession[]
  scriptSessions    ScriptSession[]
  livePitchSessions LivePitchSession[]
  fullSessions      FullPitchSession[]
  
  // Admin
  role              UserRole  @default(USER)
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  lastActiveAt      DateTime  @default(now())
  
  // Zoho integration
  zohoContactId     String?   @unique
  
  @@index([email])
  @@index([clerkId])
  @@index([stripeCustomerId])
  @@index([subscriptionTier])
}

enum UserRole {
  USER
  ADMIN
  SUPER_ADMIN
}

enum SubscriptionTier {
  FREE
  INDIVIDUAL
  TEAM
  ENTERPRISE
}

enum SubscriptionStatus {
  ACTIVE
  PAST_DUE
  CANCELLED
  INACTIVE
  TRIALING
}

// ============================================================================
// SUBSCRIPTION TIERS CONFIGURATION
// ============================================================================

model TierConfiguration {
  id                    String   @id @default(cuid())
  tier                  SubscriptionTier @unique
  
  // Pricing
  monthlyPrice          Int      // In cents
  annualPrice           Int      // In cents
  
  // Feature limits
  analyzeMonthlyLimit   Int      // -1 for unlimited
  scriptMonthlyLimit    Int
  livePitchMonthlyLimit Int
  fullSessionMonthlyLimit Int
  
  // Features
  hasPdfReports         Boolean  @default(false)
  hasSessionHistory     Boolean  @default(false)
  hasTeamFeatures       Boolean  @default(false)
  hasApiAccess          Boolean  @default(false)
  hasPrioritySupport    Boolean  @default(false)
  hasCustomBranding     Boolean  @default(false)
  
  // Team limits
  maxTeamMembers        Int      @default(1)
  
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
}

// ============================================================================
// BUNDLE PURCHASES
// ============================================================================

model BundlePurchase {
  id                String   @id @default(cuid())
  userId            String
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  bundleType        BundleType
  stripePaymentIntentId String @unique
  amountPaid        Int      // In cents
  
  modules           ModuleType[]
  
  usesRemaining     Int
  totalUses         Int
  purchasedAt       DateTime @default(now())
  expiresAt         DateTime?
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  @@index([userId])
  @@index([stripePaymentIntentId])
}

enum BundleType {
  DUAL_MODULE      // E1 + E2
  COMPLETE_PACKAGE // All 4 modules
  SINGLE_MODULE    // Individual module purchase
}

enum ModuleType {
  DECK_ANALYZER    // E1
  SCRIPT_COACH     // E2
  LIVE_PITCH       // E3
  FULL_SESSION     // E4
}

// ============================================================================
// MODULE E1: DECK ANALYSIS SESSION
// ============================================================================

model DeckAnalysisSession {
  id                String   @id @default(cuid())
  userId            String
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  // File references
  deckFileId        String   // R2 object key
  deckFileName      String
  deckFileSize      Int
  deckFileType      String   // pdf, pptx
  
  // Processing status
  status            ProcessingStatus @default(PENDING)
  processingStarted DateTime?
  processingEnded   DateTime?
  errorMessage      String?
  
  // AI Analysis Results - Content Scores (0-100)
  titleScore        Int?
  problemScore      Int?
  valuePropScore    Int?
  underlyingMagicScore Int?
  businessModelScore Int?
  goToMarketScore   Int?
  competitiveScore  Int?
  teamScore         Int?
  financialsScore   Int?
  theAskScore       Int?
  overallContentScore Float?
  
  // Visual Audit Scores (0-100)
  densityScore      Int?
  colorScore        Int?
  typographyScore   Int?
  dataVizScore      Int?
  brandConsistencyScore Int?
  overallVisualScore Float?
  
  // Detailed analysis (JSON)
  slideAnalysis     Json?    // Per-slide detailed feedback
  visualAuditDetails Json?   // Detailed visual audit
  priorityActions   Json?    // Array of action items
  
  // Report generation
  reportFileId      String?  // R2 key for generated PDF
  reportGeneratedAt DateTime?
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  @@index([userId])
  @@index([status])
  @@index([createdAt])
}

// ============================================================================
// MODULE E2: SCRIPT SESSION
// ============================================================================

model ScriptSession {
  id                String   @id @default(cuid())
  userId            String
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  // Input
  inputType         ScriptInputType
  sourceFileId      String?  // R2 key if file upload
  sourceFileName    String?
  rawText           String?  // Text content
  
  // Processing status
  status            ProcessingStatus @default(PENDING)
  processingStarted DateTime?
  processingEnded   DateTime?
  errorMessage      String?
  
  // Analysis Results - Element Scores (0-100)
  hookScore         Int?
  problemScore      Int?
  solutionScore     Int?
  proofScore        Int?
  theAskScore       Int?
  overallScore      Float?
  
  // Detailed analysis (JSON)
  elementAnalysis   Json?    // Per-element detailed feedback with excerpts
  toneAnalysis      Json?    // Tone metrics
  rewriteSuggestions Json?   // Suggested rewrites
  
  // Estimated duration
  estimatedDuration Int?     // In seconds
  wordCount         Int?
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  @@index([userId])
  @@index([status])
  @@index([createdAt])
}

enum ScriptInputType {
  TEXT_PASTE
  PDF_UPLOAD
  DOCX_UPLOAD
}

// ============================================================================
// MODULE E3: LIVE PITCH SESSION
// ============================================================================

model LivePitchSession {
  id                String   @id @default(cuid())
  userId            String
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  // Recording references
  videoFileId       String?  // Cloudflare Stream video ID
  audioFileId       String?  // R2 audio file key
  transcriptText    String?  // User-provided or AI-generated transcript
  
  // Recording metadata
  recordingDuration Int?     // In seconds
  recordingFormat   String?  // webm, mp4
  
  // Processing status
  status            ProcessingStatus @default(PENDING)
  processingStarted DateTime?
  processingEnded   DateTime?
  errorMessage      String?
  
  // Delivery Analysis (0-100)
  pacingScore       Int?
  clarityScore      Int?
  confidenceScore   Int?
  deliveryOverall   Float?
  
  // Body Language Analysis (0-100)
  eyeContactScore   Int?
  postureScore      Int?
  gesturesScore     Int?
  bodyLanguageOverall Float?
  
  // Structure Analysis (0-100)
  structureScore    Int?
  
  // Overall score
  overallScore      Float?
  
  // Detailed analysis (JSON)
  deliveryDetails   Json?    // Detailed delivery feedback
  bodyLanguageDetails Json?  // Detailed body language feedback
  coachingDrills    Json?    // Personalized drills
  
  // Comparison with previous sessions
  improvementFromPrevious Json?
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  @@index([userId])
  @@index([status])
  @@index([createdAt])
}

// ============================================================================
// MODULE E4: FULL PITCH SESSION
// ============================================================================

model FullPitchSession {
  id                String   @id @default(cuid())
  userId            String
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  // File references
  deckFileId        String?  // R2 key
  deckFileName      String?
  videoFileId       String?  // Cloudflare Stream video ID
  transcriptText    String?  // Optional transcript
  
  // Recording metadata
  recordingDuration Int?
  
  // Processing status
  status            ProcessingStatus @default(PENDING)
  processingStarted DateTime?
  processingEnded   DateTime?
  errorMessage      String?
  
  // 6-Dimension Analysis (0-100)
  deckAlignmentScore Int?
  narrativeArcScore Int?
  contentDepthScore Float?   // Average of 8 sections
  deliveryScore     Int?
  investorReadinessScore Float?
  qandaPrepScore    Int?
  
  // Content Depth - 8 Section Scores
  contentProblemScore Int?
  contentSolutionScore Int?
  contentMarketScore Int?
  contentBusinessModelScore Int?
  contentTractionScore Int?
  contentTeamScore Int?
  contentFinancialsScore Int?
  contentAskScore Int?
  
  // Overall score
  overallScore      Float?
  
  // Detailed analysis (JSON)
  dimensionAnalysis Json?    // Detailed per-dimension feedback
  investorReadiness Json?    // Red flags, green lights
  anticipatedQuestions Json? // 5 anticipated Q&A questions
  recommendations   Json?    // Prioritized recommendations
  
  // Report generation
  reportFileId      String?  // R2 key for generated PDF
  reportGeneratedAt DateTime?
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  @@index([userId])
  @@index([status])
  @@index([createdAt])
}

enum ProcessingStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
}

// ============================================================================
// FILE STORAGE
// ============================================================================

model StoredFile {
  id                String   @id @default(cuid())
  userId            String
  
  // R2/Stream references
  storageType       StorageType
  storageKey        String   @unique // R2 key or Stream video ID
  
  // File metadata
  originalFileName  String
  fileSize          Int
  mimeType          String
  
  // Processing state
  isProcessed       Boolean  @default(false)
  processingError   String?
  
  createdAt         DateTime @default(now())
  expiresAt         DateTime? // Optional expiration
  
  @@index([userId])
  @@index([storageKey])
}

enum StorageType {
  R2_OBJECT
  CLOUDFLARE_STREAM
}

// ============================================================================
// BILLING & PAYMENTS
// ============================================================================

model PaymentHistory {
  id                String   @id @default(cuid())
  userId            String
  
  stripePaymentIntentId String @unique
  stripeInvoiceId   String?
  
  amount            Int      // In cents
  currency          String   @default("usd")
  status            PaymentStatus
  
  description       String
  metadata          Json?
  
  createdAt         DateTime @default(now())
  
  @@index([userId])
  @@index([stripePaymentIntentId])
}

enum PaymentStatus {
  SUCCEEDED
  PENDING
  FAILED
  REFUNDED
}

// ============================================================================
// ADMIN AUDIT LOG
// ============================================================================

model AuditLog {
  id                String   @id @default(cuid())
  adminUserId       String
  
  action            String
  targetType        String   // User, Subscription, etc.
  targetId          String?
  
  details           Json?
  ipAddress         String?
  userAgent         String?
  
  createdAt         DateTime @default(now())
  
  @@index([adminUserId])
  @@index([targetType, targetId])
  @@index([createdAt])
}

// ============================================================================
// ZOHO INTEGRATION SYNC
// ============================================================================

model ZohoSyncLog {
  id                String   @id @default(cuid())
  
  syncType          ZohoSyncType
  status            SyncStatus
  
  recordsProcessed  Int      @default(0)
  recordsFailed     Int      @default(0)
  
  errorMessage      String?
  details           Json?
  
  startedAt         DateTime @default(now())
  completedAt       DateTime?
  
  @@index([syncType])
  @@index([startedAt])
}

enum ZohoSyncType {
  CRM_CONTACTS
  BOOKS_INVOICES
  CAMPAIGNS_SUBSCRIBERS
  TRAINER_SSO
}

enum SyncStatus {
  IN_PROGRESS
  COMPLETED
  FAILED
  PARTIAL
}

// ============================================================================
// SYSTEM CONFIGURATION
// ============================================================================

model SystemConfig {
  id                String   @id @default(cuid())
  key               String   @unique
  value             Json
  description       String?
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}
```

### 2.2 Database Indexes Summary

| Table | Index | Purpose |
|-------|-------|---------|
| User | email, clerkId | Auth lookups |
| User | stripeCustomerId | Billing webhooks |
| User | subscriptionTier | Analytics queries |
| DeckAnalysisSession | userId, status, createdAt | Session filtering |
| ScriptSession | userId, status, createdAt | Session filtering |
| LivePitchSession | userId, status, createdAt | Session filtering |
| FullPitchSession | userId, status, createdAt | Session filtering |
| BundlePurchase | userId, stripePaymentIntentId | Bundle lookups |
| StoredFile | userId, storageKey | File management |
| PaymentHistory | userId, stripePaymentIntentId | Billing history |
| AuditLog | adminUserId, targetType, createdAt | Admin audit |

### 2.3 Entity Relationships Diagram

```
User
  ├── subscription: SubscriptionTier
  ├── bundles: BundlePurchase[]
  ├── deckSessions: DeckAnalysisSession[]
  ├── scriptSessions: ScriptSession[]
  ├── livePitchSessions: LivePitchSession[]
  └── fullSessions: FullPitchSession[]

BundlePurchase
  ├── user: User
  └── modules: ModuleType[]

DeckAnalysisSession
  └── user: User

ScriptSession
  └── user: User

LivePitchSession
  └── user: User

FullPitchSession
  └── user: User

StoredFile
  └── user: User

PaymentHistory
  └── user: User

AuditLog
  └── adminUser: User
```

---

## 3. API Routes

### 3.1 Authentication Endpoints

```typescript
// Handled by Clerk - no custom routes needed
// Middleware handles route protection
```

### 3.2 Module E1: Pitch Deck Analyser

#### POST /api/modules/analyze/upload
**Purpose:** Generate presigned URL for deck upload

**Request:**
```typescript
{
  fileName: string;
  fileSize: number;
  fileType: 'application/pdf' | 'application/vnd.ms-powerpoint';
}
```

**Response:**
```typescript
{
  uploadUrl: string;      // Presigned R2 URL
  fileKey: string;        // R2 object key
  sessionId: string;      // Created session ID
}
```

#### POST /api/modules/analyze/process
**Purpose:** Trigger AI analysis of uploaded deck

**Request:**
```typescript
{
  sessionId: string;
  fileKey: string;
}
```

**Response:**
```typescript
{
  status: 'PROCESSING';
  estimatedTime: number;  // Seconds
}
```

#### GET /api/modules/analyze/process/[sessionId]
**Purpose:** Poll for analysis status and results

**Response:**
```typescript
{
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  progress?: number;      // 0-100
  results?: {
    contentScores: {
      title: number;
      problem: number;
      valueProp: number;
      underlyingMagic: number;
      businessModel: number;
      goToMarket: number;
      competitive: number;
      team: number;
      financials: number;
      theAsk: number;
      overall: number;
    };
    visualScores: {
      density: number;
      color: number;
      typography: number;
      dataViz: number;
      brandConsistency: number;
      overall: number;
    };
    slideAnalysis: SlideAnalysis[];
    visualAuditDetails: VisualAuditDetails;
    priorityActions: PriorityAction[];
  };
  errorMessage?: string;
}
```

#### GET /api/modules/analyze/report/[sessionId]
**Purpose:** Download PDF report

**Response:** Binary PDF file with appropriate headers

### 3.3 Module E2: Elevator Pitch Script Coach

#### POST /api/modules/script/analyze
**Purpose:** Analyze script text or file

**Request:**
```typescript
{
  inputType: 'TEXT_PASTE' | 'PDF_UPLOAD' | 'DOCX_UPLOAD';
  text?: string;          // Required if inputType is TEXT_PASTE
  fileKey?: string;       // Required if file upload
}
```

**Response:**
```typescript
{
  sessionId: string;
  status: 'PROCESSING';
}
```

#### GET /api/modules/script/analyze/[sessionId]
**Purpose:** Get analysis results

**Response:**
```typescript
{
  status: 'COMPLETED' | 'PROCESSING' | 'FAILED';
  results?: {
    elementScores: {
      hook: number;
      problem: number;
      solution: number;
      proof: number;
      theAsk: number;
      overall: number;
    };
    elementAnalysis: ElementAnalysis[];
    toneAnalysis: {
      formal: number;
      conversational: number;
      confident: number;
      urgent: number;
      dominant: string;
    };
    estimatedDuration: number;  // Seconds
    wordCount: number;
  };
}
```

#### POST /api/modules/script/rewrite
**Purpose:** Get AI rewrite suggestions

**Request:**
```typescript
{
  sessionId: string;
  element: 'hook' | 'problem' | 'solution' | 'proof' | 'theAsk';
  currentText: string;
}
```

**Response:**
```typescript
{
  suggestions: {
    text: string;
    reason: string;
    improvementFocus: string;
  }[];
}
```

### 3.4 Module E3: Live Elevator Pitch

#### POST /api/modules/live-pitch/upload
**Purpose:** Upload video/audio recording

**Request:** Multipart form data with video/audio file

**Response:**
```typescript
{
  sessionId: string;
  videoId: string;        // Cloudflare Stream video ID
  uploadUrl?: string;     // If using direct upload
}
```

#### POST /api/modules/live-pitch/analyze
**Purpose:** Trigger analysis of recording

**Request:**
```typescript
{
  sessionId: string;
  videoId?: string;
  transcript?: string;    // Optional user-provided transcript
}
```

**Response:**
```typescript
{
  status: 'PROCESSING';
  estimatedTime: number;
}
```

#### GET /api/modules/live-pitch/sessions/[sessionId]
**Purpose:** Get analysis results

**Response:**
```typescript
{
  status: 'COMPLETED' | 'PROCESSING' | 'FAILED';
  results?: {
    delivery: {
      pacing: { score: number; feedback: string; };
      clarity: { score: number; feedback: string; };
      confidence: { score: number; feedback: string; };
      overall: number;
    };
    bodyLanguage: {
      eyeContact: { score: number; feedback: string; };
      posture: { score: number; feedback: string; };
      gestures: { score: number; feedback: string; };
      overall: number;
    };
    structure: {
      score: number;
      feedback: string;
      elementsIdentified: string[];
    };
    overall: number;
    coachingDrills: CoachingDrill[];
    improvement: {
      previousSessionId?: string;
      scoreChange?: number;
      improvedAreas: string[];
    };
  };
}
```

### 3.5 Module E4: Full Pitch Session

#### POST /api/modules/full-session/upload
**Purpose:** Upload deck and/or video

**Request:** Multipart form data

**Response:**
```typescript
{
  sessionId: string;
  deckFileKey?: string;
  videoId?: string;
}
```

#### POST /api/modules/full-session/analyze
**Purpose:** Trigger comprehensive analysis

**Request:**
```typescript
{
  sessionId: string;
  deckFileKey?: string;
  videoId?: string;
  transcript?: string;
}
```

**Response:**
```typescript
{
  status: 'PROCESSING';
  estimatedTime: number;
}
```

#### GET /api/modules/full-session/[sessionId]
**Purpose:** Get comprehensive analysis results

**Response:**
```typescript
{
  status: 'COMPLETED' | 'PROCESSING' | 'FAILED';
  results?: {
    deckAlignment: { score: number; feedback: string; };
    narrativeArc: { score: number; feedback: string; structure: string[]; };
    contentDepth: {
      overall: number;
      sections: {
        problem: number;
        solution: number;
        market: number;
        businessModel: number;
        traction: number;
        team: number;
        financials: number;
        ask: number;
      };
    };
    delivery: { score: number; feedback: string; };
    investorReadiness: {
      score: number;
      redFlags: string[];
      greenLights: string[];
    };
    qandaPrep: {
      score: number;
      anticipatedQuestions: {
        question: string;
        suggestedAnswer: string;
        difficulty: 'easy' | 'medium' | 'hard';
      }[];
    };
    overall: number;
    recommendations: {
      priority: 'high' | 'medium' | 'low';
      category: string;
      action: string;
    }[];
  };
}
```

#### GET /api/modules/full-session/report/[sessionId]
**Purpose:** Download comprehensive PDF report

### 3.6 Billing Endpoints

#### POST /api/billing/checkout
**Purpose:** Create Stripe checkout session

**Request:**
```typescript
{
  priceId: string;
  successUrl: string;
  cancelUrl: string;
}
```

**Response:**
```typescript
{
  checkoutUrl: string;
  sessionId: string;
}
```

#### POST /api/billing/portal
**Purpose:** Create customer portal session

**Response:**
```typescript
{
  portalUrl: string;
}
```

#### GET /api/billing/bundles
**Purpose:** Get available bundle options

**Response:**
```typescript
{
  bundles: {
    id: string;
    name: string;
    modules: ModuleType[];
    price: number;
    uses: number;
    description: string;
  }[];
}
```

#### POST /api/billing/bundles
**Purpose:** Purchase a bundle

**Request:**
```typescript
{
  bundleId: string;
}
```

**Response:**
```typescript
{
  checkoutUrl: string;
}
```

### 3.7 Webhook Endpoints

#### POST /api/webhooks/stripe
**Purpose:** Handle Stripe webhooks

**Events handled:**
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

#### POST /api/webhooks/cloudflare
**Purpose:** Handle Cloudflare Stream webhooks

**Events handled:**
- `video.uploaded`
- `video.ready`
- `video.deleted`

### 3.8 Admin Endpoints

#### GET /api/admin/users
**Query params:** `page`, `limit`, `tier`, `search`

**Response:**
```typescript
{
  users: {
    id: string;
    email: string;
    name: string;
    tier: SubscriptionTier;
    usage: { analyze: number; script: number; livePitch: number; fullSession: number; };
    createdAt: string;
  }[];
  pagination: { total: number; page: number; limit: number; totalPages: number; };
}
```

#### PATCH /api/admin/users/[userId]
**Purpose:** Update user tier or role

**Request:**
```typescript
{
  tier?: SubscriptionTier;
  role?: UserRole;
}
```

#### GET /api/admin/analytics
**Purpose:** System-wide analytics

**Response:**
```typescript
{
  users: { total: number; active: number; byTier: Record<SubscriptionTier, number>; };
  sessions: {
    total: number;
    byModule: { analyze: number; script: number; livePitch: number; fullSession: number; };
    avgScore: number;
  };
  revenue: {
    mrr: number;
    arr: number;
    byTier: Record<SubscriptionTier, number>;
  };
}
```

### 3.9 Integration Endpoints

#### POST /api/integrations/zoho/sync
**Purpose:** Trigger Zoho sync

**Request:**
```typescript
{
  syncType: ZohoSyncType;
}
```

#### GET /api/integrations/zoho/sso
**Purpose:** Handle Zoho Trainer Central SSO

**Query params:** `token`, `userId`

### 3.10 File Management Endpoints

#### POST /api/files/upload-url
**Purpose:** Get presigned upload URL

**Request:**
```typescript
{
  fileName: string;
  fileSize: number;
  fileType: string;
  module: ModuleType;
}
```

**Response:**
```typescript
{
  uploadUrl: string;
  fileKey: string;
  expiresAt: string;
}
```

#### GET /api/files/download/[fileId]
**Purpose:** Get download URL for file

---

## 4. Component Architecture

### 4.1 Component Hierarchy

```
RootLayout (app/layout.tsx)
├── ClerkProvider
├── ThemeProvider
├── ToastProvider
└── children

MarketingLayout (app/(marketing)/layout.tsx)
├── Header
│   ├── Logo
│   ├── Navigation
│   ├── AuthButtons
│   └── MobileMenu
├── children
└── Footer

DashboardLayout (app/(dashboard)/layout.tsx)
├── Sidebar
│   ├── UserCard
│   ├── NavigationMenu
│   ├── UsageMeter
│   └── SubscriptionBadge
├── main
│   └── children
└── MobileNav

ModuleLayout (app/(modules)/layout.tsx)
├── ModuleHeader
│   ├── ModuleTitle
│   └── ModuleProgress
├── children
└── ModuleHelp
```

### 4.2 Core Components

#### FileUploader Component
```typescript
interface FileUploaderProps {
  accept: string[];           // Accepted MIME types
  maxSize: number;            // Max size in bytes
  onUpload: (file: File) => Promise<UploadResult>;
  onProgress?: (progress: number) => void;
  onError?: (error: Error) => void;
  disabled?: boolean;
}

// Features:
// - Drag and drop
// - Click to browse
// - Progress indicator
// - File type validation
// - Size validation
// - Preview for supported types
```

#### VideoRecorder Component
```typescript
interface VideoRecorderProps {
  maxDuration: number;        // Max recording time in seconds
  onRecordingComplete: (blob: Blob) => void;
  onRecordingStart?: () => void;
  onError?: (error: Error) => void;
  showPreview?: boolean;
  allowFileUpload?: boolean;
}

// Features:
// - Camera access with permission handling
// - Recording controls (start, pause, stop)
// - Timer display
// - Preview playback
// - Re-record option
// - Alternative file upload
```

#### ScoreCard Component
```typescript
interface ScoreCardProps {
  score: number;              // 0-100
  label: string;
  category?: 'content' | 'visual' | 'delivery' | 'body-language';
  showDetails?: boolean;
  details?: string;
  trend?: 'up' | 'down' | 'neutral';
  previousScore?: number;
}

// Features:
// - Color-coded by score range
// - Animated progress ring
// - Trend indicator
// - Expandable details
```

### 4.3 Module-Specific Components

#### E1: Deck Analysis Components

```
DeckUploadZone
├── DropZone
│   ├── UploadIcon
│   ├── DropText
│   └── FileConstraints
├── FilePreview
│   ├── FileName
│   ├── FileSize
│   └── RemoveButton
└── UploadProgress

SlideAnalysisCard
├── SlideNumber
├── SlideTitle
├── ScoreIndicator
├── FeedbackList
└── ExpandButton → DetailedFeedback

VisualAuditReport
├── OverallScore
├── CategoryScores
│   ├── DensityScore
│   ├── ColorScore
│   ├── TypographyScore
│   ├── DataVizScore
│   └── BrandConsistencyScore
└── RecommendationsList

PriorityActions
├── ActionCard[]
│   ├── Priority
│   ├── Action
│   ├── Impact
│   └── Effort
└── SortControls
```

#### E2: Script Coach Components

```
ScriptInput
├── InputMethodTabs
│   ├── TextPasteTab
│   ├── FileUploadTab
│   └── URLImportTab
├── TextInput
│   ├── TextArea
│   ├── CharacterCounter
│   └── WordCounter
└── SubmitButton

ElementScoreCard
├── ElementName
├── ScoreRing
├── ExcerptHighlight
│   └── HighlightedText
└── FeedbackSection

ToneIndicator
├── ToneChart (Radar/Bar)
├── DominantTone
└── ToneBreakdown

RewriteSuggestions
├── OriginalText
├── SuggestionCards[]
│   ├── SuggestedText
│   ├── Reason
│   └── ApplyButton
└── RegenerateButton
```

#### E3: Live Pitch Components

```
RecordingInterface
├── VideoPreview
│   ├── CameraView
│   └── CountdownOverlay
├── Controls
│   ├── StartButton
│   ├── PauseButton
│   ├── StopButton
│   └── Timer
├── Settings
│   ├── CameraSelect
│   ├── MicSelect
│   └── ResolutionSelect
└── TranscriptInput (optional)

DeliveryFeedback
├── ScoreBreakdown
│   ├── PacingCard
│   ├── ClarityCard
│   └── ConfidenceCard
├── TimelineVisualization
└── ImprovementTips

BodyLanguageAnalysis
├── OverallScore
├── MetricCards
│   ├── EyeContactCard
│   ├── PostureCard
│   └── GesturesCard
├── KeyFramesPreview
└── DetailedAnalysis

SessionComparison
├── PreviousSessionSelect
├── ScoreComparisonChart
├── ImprovementAreas
└── RegressionWarnings
```

#### E4: Full Session Components

```
MultiFileUpload
├── DeckUpload
│   └── FileUploader (PDF/PPTX)
├── VideoUpload
│   ├── VideoRecorder
│   └── FileUploader (video files)
├── TranscriptInput
│   └── TextArea
└── SubmitButton

DimensionAnalysis
├── DimensionCards[]
│   ├── DeckAlignmentCard
│   ├── NarrativeArcCard
│   ├── ContentDepthCard
│   ├── DeliveryCard
│   ├── InvestorReadinessCard
│   └── QAPrepCard
└── OverallScore

InvestorReadinessGauge
├── GaugeVisualization
├── RedFlagsList
├── GreenLightsList
└── OverallVerdict

QAPrepSection
├── QuestionCards[]
│   ├── Question
│   ├── Difficulty
│   ├── SuggestedAnswer
│   └── ExpandButton
└── GenerateMoreButton
```

### 4.4 Shared Component Library

```typescript
// components/ui/ - shadcn/ui primitives
// All shadcn components are available

// components/common/ - Custom shared components
export { Header } from './Header';
export { Footer } from './Footer';
export { Sidebar } from './Sidebar';
export { LoadingSpinner } from './LoadingSpinner';
export { ErrorBoundary } from './ErrorBoundary';
export { FileUploader } from './FileUploader';
export { VideoRecorder } from './VideoRecorder';
export { AudioRecorder } from './AudioRecorder';
export { ScoreCard } from './ScoreCard';
export { ProgressIndicator } from './ProgressIndicator';
export { DownloadButton } from './DownloadButton';
export { EmptyState } from './EmptyState';
export { ConfirmDialog } from './ConfirmDialog';
export { TierBadge } from './TierBadge';
export { UsageMeter } from './UsageMeter';
```

---

## 5. Integration Architecture

### 5.1 Integration Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      PitchCoach AI Platform                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │
│  │   Clerk     │    │   Stripe    │    │  Database   │        │
│  │  (Auth)     │    │ (Billing)   │    │ (PostgreSQL)│        │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘        │
│         │                  │                  │                │
│         └──────────────────┼──────────────────┘                │
│                            │                                   │
│  ┌─────────────────────────┼─────────────────────────┐        │
│  │                         │                         │        │
│  │  ┌──────────┐    ┌──────┴──────┐    ┌──────────┐ │        │
│  │  │   R2     │    │  Cloudflare │    │  Stream  │ │        │
│  │  │ (Files)  │    │    CDN      │    │ (Video)  │ │        │
│  │  └──────────┘    └─────────────┘    └──────────┘ │        │
│  │                                                    │        │
│  │  ┌──────────────────────┐    ┌──────────────────┐ │        │
│  │  │    Claude API        │    │   Gemini Vision  │ │        │
│  │  │   (Text Analysis)    │    │ (Video Analysis) │ │        │
│  │  └──────────────────────┘    └──────────────────┘ │        │
│  │                                                    │        │
│  └────────────────────────────────────────────────────┘        │
│                            │                                   │
│  ┌─────────────────────────┼─────────────────────────┐        │
│  │           Zoho Integration Suite                   │        │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────┐ │        │
│  │  │   CRM    │ │  Books   │ │Campaigns │ │Trainer│ │        │
│  │  └──────────┘ └──────────┘ └──────────┘ └───────┘ │        │
│  └────────────────────────────────────────────────────┘        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Clerk Authentication Flow

```typescript
// lib/auth/clerk-provider.ts

// Authentication configuration
const clerkConfig = {
  signInUrl: '/sign-in',
  signUpUrl: '/sign-up',
  afterSignInUrl: '/dashboard',
  afterSignUpUrl: '/dashboard',
  
  // OAuth providers
  oauthProviders: [
    { provider: 'google', scopes: 'email profile' },
    { provider: 'linkedin', scopes: 'r_emailaddress r_liteprofile' },
  ],
  
  // Session configuration
  session: {
    lifetime: 60 * 60 * 24 * 7, // 7 days
    jwt: {
      lifetime: 60 * 60, // 1 hour
    }
  }
};

// Middleware for route protection
// middleware.ts
export default clerkMiddleware((auth, req) => {
  // Protect dashboard and module routes
  if (req.nextUrl.pathname.startsWith('/dashboard') || 
      req.nextUrl.pathname.startsWith('/analyze') ||
      req.nextUrl.pathname.startsWith('/script') ||
      req.nextUrl.pathname.startsWith('/live-pitch') ||
      req.nextUrl.pathname.startsWith('/full-session')) {
    auth().protect();
  }
  
  // Protect admin routes with role check
  if (req.nextUrl.pathname.startsWith('/admin')) {
    auth().protect();
    const user = auth().sessionClaims;
    if (user?.publicMetadata?.role !== 'ADMIN' && 
        user?.publicMetadata?.role !== 'SUPER_ADMIN') {
      return NextResponse.redirect(new URL('/unauthorized', req.url));
    }
  }
});
```

### 5.3 Stripe Integration

```typescript
// lib/billing/stripe-client.ts

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

// Product and Price configuration
export const STRIPE_PRODUCTS = {
  INDIVIDUAL: {
    monthly: 'price_individual_monthly',
    annual: 'price_individual_annual',
  },
  TEAM: {
    monthly: 'price_team_monthly',
    annual: 'price_team_annual',
  },
  ENTERPRISE: {
    monthly: 'price_enterprise_monthly',
    annual: 'price_enterprise_annual',
  },
  BUNDLES: {
    DUAL_MODULE: 'price_bundle_dual',
    COMPLETE_PACKAGE: 'price_bundle_complete',
  }
};

// Checkout session creation
export async function createCheckoutSession(
  userId: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, stripeCustomerId: true },
  });

  let customerId = user?.stripeCustomerId;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user?.email,
      metadata: { userId },
    });
    customerId = customer.id;
    await prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId: customerId },
    });
  }

  return stripe.checkout.sessions.create({
    customer: customerId,
    mode: priceId.includes('bundle') ? 'payment' : 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { userId },
  });
}

// Webhook handler
export async function handleStripeWebhook(event: Stripe.Event) {
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutComplete(event.data.object);
      break;
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await handleSubscriptionUpdate(event.data.object);
      break;
    case 'customer.subscription.deleted':
      await handleSubscriptionDeletion(event.data.object);
      break;
    case 'invoice.paid':
      await handleInvoicePaid(event.data.object);
      break;
  }
}
```

### 5.4 Claude API Integration

```typescript
// lib/ai/claude/client.ts

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function analyzeDeck(content: string, images: string[]) {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: content },
          ...images.map(img => ({
            type: 'image' as const,
            source: { type: 'base64' as const, media_type: 'image/png' as const, data: img },
          })),
        ],
      },
    ],
    system: DECK_ANALYSIS_SYSTEM_PROMPT,
  });

  return parseAnalysisResponse(response);
}

export async function analyzeScript(text: string) {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    messages: [{ role: 'user', content: text }],
    system: SCRIPT_ANALYSIS_SYSTEM_PROMPT,
  });

  return parseScriptResponse(response);
}
```

### 5.5 Gemini Vision Integration (Hybrid Model Strategy)

**Model Selection Strategy:**
- **Gemini 2.5 Flash**: Module E3 (Live Elevator, ≤3 min), fast response, cost-effective
- **Gemini 1.5 Pro**: Module E4 (Full Session, >10 min), 2M token context for long videos

```typescript
// lib/ai/gemini/client.ts

import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Model selection based on module and video duration
type GeminiModel = 'gemini-2.5-flash-preview-05-20' | 'gemini-1.5-pro';

function selectModel(module: 'E3' | 'E4', videoDurationSeconds: number): GeminiModel {
  // E3: Max 3 minutes (180s) → Flash is sufficient
  if (module === 'E3') {
    return 'gemini-2.5-flash-preview-05-20';
  }
  
  // E4: Under 10 minutes → Flash works, over 10 min → Pro for context
  return videoDurationSeconds > 600 
    ? 'gemini-1.5-pro' 
    : 'gemini-2.5-flash-preview-05-20';
}

export async function analyzeVideo(
  videoUrl: string,
  module: 'E3' | 'E4',
  videoDurationSeconds: number,
  transcript?: string
) {
  const modelName = selectModel(module, videoDurationSeconds);
  const model = genAI.getGenerativeModel({ model: modelName });

  const prompt = `
    Analyze this pitch video for:
    1. Delivery (pacing, clarity, confidence)
    2. Body language (eye contact, posture, gestures)
    3. Structure adherence
    
    ${transcript ? `Transcript: ${transcript}` : ''}
    
    Video: ${videoUrl}
    
    ${VIDEO_ANALYSIS_PROMPT}
  `;

  const result = await model.generateContent([
    { text: prompt },
    { fileData: { mimeType: 'video/mp4', fileUri: videoUrl } },
  ]);

  return parseVideoAnalysis(result.response.text());
}

// Body language uses Flash for speed (frame analysis doesn't need Pro context)
export async function analyzeBodyLanguage(videoFrames: string[]) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-preview-05-20' });

  const result = await model.generateContent([
    { text: BODY_LANGUAGE_ANALYSIS_PROMPT },
    ...videoFrames.map(frame => ({
      inlineData: { mimeType: 'image/jpeg', data: frame },
    })),
  ]);

  return parseBodyLanguageResponse(result.response.text());
}

// Cost estimation helper
export function estimateAnalysisCost(
  module: 'E3' | 'E4',
  videoDurationSeconds: number
): { model: GeminiModel; estimatedCost: number } {
  const model = selectModel(module, videoDurationSeconds);
  
  // Approximate costs (USD)
  // Flash: ~$0.075 per million input tokens, ~$0.30 per million output
  // Pro: ~$1.25 per million input tokens, ~$5.00 per million output
  
  // Rough estimate: 1 min video ≈ 250k tokens
  const estimatedTokens = (videoDurationSeconds / 60) * 250000;
  
  const costPerMillionInput = model === 'gemini-2.5-flash-preview-05-20' ? 0.075 : 1.25;
  const estimatedCost = (estimatedTokens / 1_000_000) * costPerMillionInput;
  
  return { model, estimatedCost };
}
```

**Browser Recording Edge Cases:**

| Browser | Support Level | Mitigation |
|---------|---------------|------------|
| Chrome | ✅ Full | Primary target |
| Firefox | ✅ Full | Works well |
| Safari | ⚠️ Partial | Show "Use Chrome" warning + file upload fallback |
| Edge | ✅ Full | Chromium-based |

```typescript
// lib/utils/browser-detection.ts

export function getRecordingCapabilities(): {
  canRecord: boolean;
  preferredMimeType: string;
  warning?: string;
} {
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  
  if (isSafari) {
    return {
      canRecord: false,
      preferredMimeType: '',
      warning: 'Safari has limited video recording support. Please use Chrome or Firefox, or upload a pre-recorded video.',
    };
  }
  
  // Check for VP9 support (preferred for quality/size)
  if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
    return { canRecord: true, preferredMimeType: 'video/webm;codecs=vp9' };
  }
  
  // Fallback to VP8
  if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
    return { canRecord: true, preferredMimeType: 'video/webm;codecs=vp8' };
  }
  
  // Last resort
  return { canRecord: true, preferredMimeType: 'video/webm' };
}
```

### 5.6 Cloudflare R2 Storage

```typescript
// lib/storage/r2-client.ts

import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const r2Client = new S3Client({
  region: 'auto',
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET!;

export async function generateUploadUrl(
  key: string,
  contentType: string,
  expiresIn: number = 3600
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  return getSignedUrl(r2Client, command, { expiresIn });
}

export async function generateDownloadUrl(
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  return getSignedUrl(r2Client, command, { expiresIn });
}

export async function uploadFile(
  key: string,
  body: Buffer | ReadableStream,
  contentType: string
): Promise<void> {
  await r2Client.send(new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: body,
    ContentType: contentType,
  }));
}
```

### 5.7 Cloudflare Stream Integration

```typescript
// lib/storage/stream-client.ts

const STREAM_API_BASE = 'https://api.cloudflare.com/client/v4/accounts/{account_id}/stream';

export async function getDirectUploadUrl(): Promise<{ uploadUrl: string; videoId: string }> {
  const response = await fetch(`${STREAM_API_BASE}?direct_user=true`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.CLOUDFLARE_STREAM_API_TOKEN}`,
      'Tus-Resumable': '1.0.0',
      'Upload-Length': '*', // Unknown length
      'Upload-Metadata': 'name dGl0bGU=', // Base64 encoded metadata
    },
  });

  const uploadUrl = response.headers.get('Location')!;
  const videoId = uploadUrl.split('/').pop()!;

  return { uploadUrl, videoId };
}

export async function getVideoDetails(videoId: string) {
  const response = await fetch(`${STREAM_API_BASE}/${videoId}`, {
    headers: {
      'Authorization': `Bearer ${process.env.CLOUDFLARE_STREAM_API_TOKEN}`,
    },
  });

  return response.json();
}

export async function getVideoPlaybackUrl(videoId: string): Promise<string> {
  return `https://customer-{customer_id}.cloudflarestream.com/${videoId}/manifest/video.m3u8`;
}
```

### 5.8 Zoho Integration Suite

```typescript
// lib/integrations/zoho/crm.ts

import axios from 'axios';

const ZOHO_CRM_API = 'https://www.zohoapis.com/crm/v2';

export class ZohoCRMService {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  async createContact(user: User) {
    const response = await axios.post(
      `${ZOHO_CRM_API}/Contacts`,
      {
        data: [{
          First_Name: user.firstName,
          Last_Name: user.lastName,
          Email: user.email,
          Subscription_Tier: user.subscriptionTier,
          Lead_Source: 'PitchCoach AI',
        }],
      },
      {
        headers: {
          'Authorization': `Zoho-oauthtoken ${this.accessToken}`,
        },
      }
    );

    return response.data.data[0];
  }

  async updateContact(zohoContactId: string, updates: Partial<User>) {
    await axios.put(
      `${ZOHO_CRM_API}/Contacts/${zohoContactId}`,
      {
        data: [{
          Subscription_Tier: updates.subscriptionTier,
          Last_Active: updates.lastActiveAt,
        }],
      },
      {
        headers: {
          'Authorization': `Zoho-oauthtoken ${this.accessToken}`,
        },
      }
    );
  }
}

// lib/integrations/zoho/books.ts
export class ZohoBooksService {
  async createInvoice(payment: PaymentHistory) {
    // Create invoice in Zoho Books
  }

  async syncCustomer(user: User) {
    // Sync customer data with Zoho Books
  }
}

// lib/integrations/zoho/campaigns.ts
export class ZohoCampaignsService {
  async subscribeUser(user: User, listId: string) {
    // Add user to marketing list
  }

  async unsubscribeUser(email: string) {
    // Remove user from marketing list
  }
}

// lib/integrations/sso/trainer-central-sso.ts
export class TrainerCentralSSO {
  async generateSSOUrl(userId: string): Promise<string> {
    // Generate SSO URL for Zoho Trainer Central
    const token = jwt.sign(
      { userId, email: user.email },
      process.env.ZOHO_SSO_SECRET!,
      { expiresIn: '5m' }
    );

    return `https://trainercentral.net/sso/login?token=${token}&portal=pitchcoach`;
  }
}
```

---

## 6. File/Video Handling Pipeline

### 6.1 Upload Flow Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    File Upload Pipeline                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Client                          Server                         │
│  ┌──────────┐                    ┌──────────┐                  │
│  │  Select  │                    │          │                  │
│  │  File    │─────┐              │          │                  │
│  └──────────┘     │              │          │                  │
│                   ▼              │          │                  │
│  ┌──────────────────────┐        │          │                  │
│  │  Validate Client     │        │          │                  │
│  │  - Size < 50MB       │        │          │                  │
│  │  - Type: PDF/PPTX    │        │          │                  │
│  └──────────┬───────────┘        │          │                  │
│             │                    │          │                  │
│             ▼                    ▼          │                  │
│  ┌──────────────────────────────────────────────────────┐     │
│  │  POST /api/files/upload-url                          │     │
│  │  { fileName, fileSize, fileType }                    │     │
│  └──────────────────────────────┬───────────────────────┘     │
│                                 │                              │
│                                 ▼                              │
│  ┌──────────────────────────────────────────────────────┐     │
│  │  Server Validation                                    │     │
│  │  - Check user entitlements                           │     │
│  │  - Verify file constraints                           │     │
│  │  - Generate unique file key                          │     │
│  └──────────────────────────────┬───────────────────────┘     │
│                                 │                              │
│                                 ▼                              │
│  ┌──────────────────────────────────────────────────────┐     │
│  │  Generate Presigned URL                              │     │
│  │  - R2 for files, Stream for video                    │     │
│  │  - 1-hour expiration                                │     │
│  └──────────────────────────────┬───────────────────────┘     │
│                                 │                              │
│                                 ▼                              │
│  ┌──────────────────────────────────────────────────────┐     │
│  │  Response: { uploadUrl, fileKey, sessionId }         │     │
│  └──────────────────────────────┬───────────────────────┘     │
│                                 │                              │
│             ┌───────────────────┘                              │
│             │                                                  │
│             ▼                                                  │
│  ┌──────────────────────────────────────────────────────┐     │
│  │  Direct Upload to R2/Stream                          │     │
│  │  - No server proxy (scales infinitely)              │     │
│  │  - Progress tracking via XHR                        │     │
│  └──────────────────────────────┬───────────────────────┘     │
│                                 │                              │
│             ┌───────────────────┘                              │
│             │                                                  │
│             ▼                                                  │
│  ┌──────────────────────────────────────────────────────┐     │
│  │  POST /api/modules/{module}/process                  │     │
│  │  { sessionId, fileKey }                              │     │
│  └──────────────────────────────┬───────────────────────┘     │
│                                 │                              │
│                                 ▼                              │
│  ┌──────────────────────────────────────────────────────┐     │
│  │  Trigger Processing                                  │     │
│  │  - Download from R2                                  │     │
│  │  - Extract content                                   │     │
│  │  - Send to AI analysis                               │     │
│  │  - Store results in DB                               │     │
│  └──────────────────────────────────────────────────────┘     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 File Processing Pipeline

```typescript
// lib/utils/file-processing.ts

// PDF Processing
export async function processPdf(fileKey: string): Promise<PdfExtractionResult> {
  // 1. Download from R2
  const pdfBuffer = await downloadFromR2(fileKey);

  // 2. Extract text using pdf-parse or similar
  const text = await extractTextFromPdf(pdfBuffer);

  // 3. Convert pages to images for vision analysis
  const images = await convertPdfToImages(pdfBuffer);

  // 4. Extract metadata
  const metadata = await extractPdfMetadata(pdfBuffer);

  return { text, images, metadata, pageCount: images.length };
}

// PPTX Processing
export async function processPptx(fileKey: string): Promise<PptxExtractionResult> {
  // 1. Download from R2
  const pptxBuffer = await downloadFromR2(fileKey);

  // 2. Extract using pptx-parser or JSZip
  const slides = await extractSlides(pptxBuffer);

  // 3. Convert slides to images
  const images = await convertSlidesToImages(slides);

  // 4. Extract text and structure
  const text = slides.map(s => s.text).join('\n\n');

  return { text, images, slideCount: slides.length, slides };
}

// Video Processing
export async function processVideo(videoId: string): Promise<VideoProcessingResult> {
  // 1. Get video details from Cloudflare Stream
  const details = await getVideoDetails(videoId);

  // 2. Generate thumbnail URLs
  const thumbnails = generateThumbnailUrls(videoId);

  // 3. Extract key frames for analysis
  const keyFrames = await extractKeyFrames(videoId, {
    intervalSeconds: 5,
    maxFrames: 60,
  });

  // 4. Get or generate transcript
  let transcript = details.transcript;
  if (!transcript) {
    // Use separate ASR service
    transcript = await generateTranscript(videoId);
  }

  return {
    duration: details.duration,
    thumbnails,
    keyFrames,
    transcript,
    playbackUrl: details.playback.url,
  };
}

// Audio Processing
export async function processAudio(fileKey: string): Promise<AudioProcessingResult> {
  // 1. Download from R2
  const audioBuffer = await downloadFromR2(fileKey);

  // 2. Convert to WAV if needed
  const wavBuffer = await convertToWav(audioBuffer);

  // 3. Generate transcript using ASR
  const transcript = await generateTranscript(wavBuffer);

  // 4. Extract audio features
  const features = await analyzeAudioFeatures(wavBuffer);

  return { transcript, duration: features.duration, features };
}
```

### 6.3 Video Recording Pipeline

```typescript
// hooks/useVideoRecording.ts

export function useVideoRecording(options: VideoRecordingOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: 'user' },
        audio: { echoCancellation: true, noiseSuppression: true },
      });

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 2500000,
      });

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        setRecordedBlob(blob);
        chunksRef.current = [];
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000); // Collect every second
      setIsRecording(true);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to start recording'));
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  const uploadRecording = useCallback(async () => {
    if (!recordedBlob) return;

    // Get direct upload URL from Cloudflare Stream
    const { uploadUrl, videoId } = await fetch('/api/modules/live-pitch/upload', {
      method: 'POST',
    }).then(r => r.json());

    // Upload using TUS protocol
    await uploadToStream(uploadUrl, recordedBlob);

    return videoId;
  }, [recordedBlob]);

  return {
    isRecording,
    recordedBlob,
    error,
    startRecording,
    stopRecording,
    uploadRecording,
    reset: () => setRecordedBlob(null),
  };
}
```

### 6.4 Processing Queue Architecture

```typescript
// For high-volume processing, use a job queue

// lib/queue/processing-queue.ts

import { Queue, Worker, Job } from 'bullmq';

// Define job types
type AnalysisJob = {
  sessionId: string;
  module: 'deck' | 'script' | 'live-pitch' | 'full-session';
  fileKey?: string;
  videoId?: string;
  options?: Record<string, any>;
};

// Create queue
export const analysisQueue = new Queue<AnalysisJob>('pitch-analysis', {
  connection: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
});

// Worker
export const analysisWorker = new Worker<AnalysisJob>(
  'pitch-analysis',
  async (job: Job<AnalysisJob>) => {
    const { sessionId, module, fileKey, videoId, options } = job.data;

    try {
      switch (module) {
        case 'deck':
          await processDeckAnalysis(sessionId, fileKey!);
          break;
        case 'script':
          await processScriptAnalysis(sessionId, options?.text);
          break;
        case 'live-pitch':
          await processLivePitchAnalysis(sessionId, videoId!, options?.transcript);
          break;
        case 'full-session':
          await processFullSessionAnalysis(sessionId, fileKey, videoId, options?.transcript);
          break;
      }
    } catch (error) {
      // Update session status to FAILED
      await updateSessionStatus(sessionId, module, 'FAILED', error.message);
      throw error;
    }
  },
  {
    connection: {
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT || '6379'),
    },
    concurrency: 5, // Process 5 jobs concurrently
    limiter: {
      max: 10, // Max 10 jobs per duration
      duration: 1000, // Per second
    },
  }
);

// Add job to queue
export async function queueAnalysis(job: AnalysisJob): Promise<void> {
  await analysisQueue.add(job.module, job, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  });
}
```

---

## 7. AI Prompt Scaffolding

### 7.1 Module E1: Deck Analysis Prompts

```typescript
// lib/ai/claude/prompts/deck-analysis.ts

export const DECK_ANALYSIS_SYSTEM_PROMPT = `
You are an expert pitch deck consultant specializing in investor presentations. 
Your role is to analyze pitch decks against a proven 10-slide framework and 
provide actionable, specific feedback.

ANALYSIS FRAMEWORK:
1. Title Slide - Company name, tagline, contact
2. Problem - Clear problem statement with data
3. Value Proposition - Unique solution and benefits
4. Underlying Magic - Technology/moat/secret sauce
5. Business Model - Revenue streams, pricing
6. Go-to-Market - Customer acquisition strategy
7. Competitive Analysis - Market landscape, positioning
8. Management Team - Key team members, relevant experience
9. Financial Projections - Realistic 3-5 year projections
10. The Ask - Clear funding request with use of funds

For each slide, evaluate:
- Clarity: Is the message immediately understandable?
- Completeness: Are all required elements present?
- Credibility: Are claims backed by data or logic?
- Impact: Will this resonate with investors?

SCORING GUIDELINES:
- 90-100: Exceptional, investor-ready
- 75-89: Strong, minor improvements needed
- 60-74: Adequate, significant gaps
- 40-59: Weak, major revisions needed
- 0-39: Critical issues, fundamental rework required

VISUAL DESIGN CRITERIA:
- Density: Is there too much/little information per slide?
- Color: Professional palette, sufficient contrast, accessible
- Typography: Readable fonts, clear hierarchy
- Data Visualization: Charts are clear and meaningful
- Brand Consistency: Cohesive look across all slides

Respond in JSON format with the following structure:
{
  "slides": [
    {
      "slideNumber": 1,
      "title": "string",
      "score": number (0-100),
      "feedback": "string",
      "improvements": ["string"],
      "contentAnalysis": {
        "clarity": number,
        "completeness": number,
        "credibility": number,
        "impact": number
      }
    }
  ],
  "visualAudit": {
    "density": { "score": number, "feedback": "string" },
    "color": { "score": number, "feedback": "string" },
    "typography": { "score": number, "feedback": "string" },
    "dataViz": { "score": number, "feedback": "string" },
    "brandConsistency": { "score": number, "feedback": "string" }
  },
  "priorityActions": [
    {
      "priority": "high" | "medium" | "low",
      "action": "string",
      "slideReference": number,
      "expectedImpact": "string"
    }
  ],
  "overallAssessment": "string"
}
`;

export const SLIDE_SPECIFIC_PROMPTS = {
  title: `
Analyze the title slide for:
- Company name clarity and memorability
- Tagline effectiveness (concise value prop)
- Contact information completeness
- First impression impact
`,

  problem: `
Analyze the problem slide for:
- Problem articulation clarity
- Market validation/data presence
- Emotional resonance
- Urgency creation
- Target audience specificity
`,

  valueProposition: `
Analyze the value proposition slide for:
- Solution clarity and differentiation
- Benefits vs. features balance
- Value quantification
- Pain point resolution
- Unique selling proposition clarity
`,

  underlyingMagic: `
Analyze the underlying magic slide for:
- Technology/IP explanation
- Competitive moat clarity
- Feasibility demonstration
- Secret sauce credibility
- Defensibility
`,

  businessModel: `
Analyze the business model slide for:
- Revenue stream clarity
- Pricing strategy justification
- Unit economics presence
- Scalability indication
- Path to profitability
`,

  goToMarket: `
Analyze the go-to-market slide for:
- Customer acquisition channels
- Marketing strategy specificity
- Sales cycle understanding
- Growth strategy feasibility
- Channel prioritization
`,

  competitiveAnalysis: `
Analyze the competitive analysis slide for:
- Competitor identification completeness
- Positioning matrix/clarity
- Competitive advantages
- Market share awareness
- Differentiation clarity
`,

  team: `
Analyze the management team slide for:
- Key team members presence
- Relevant experience highlight
- Team completeness for stage
- Advisor presence
- Credibility establishment
`,

  financials: `
Analyze the financial projections slide for:
- Projection realism
- Key metrics presence
- Assumption justification
- Growth trajectory logic
- Burn rate transparency
`,

  theAsk: `
Analyze the ask slide for:
- Funding amount clarity
- Use of funds breakdown
- Milestone linkage
- Round type indication
- Investor hook
`,
};
```

### 7.2 Module E2: Script Coach Prompts

```typescript
// lib/ai/claude/prompts/script-coach.ts

export const SCRIPT_ANALYSIS_SYSTEM_PROMPT = `
You are an expert elevator pitch coach with 15+ years of experience 
helping founders craft compelling 60-90 second pitches.

5-ELEMENT FRAMEWORK:
1. HOOK (10-15 seconds)
   - Grab attention immediately
   - Establish relevance and credibility
   - Create curiosity

2. PROBLEM (15-20 seconds)
   - Clear, relatable problem statement
   - Quantify the pain/market
   - Make it personal when possible

3. SOLUTION (15-20 seconds)
   - Clear value proposition
   - Key differentiator
   - Tangible benefits

4. PROOF (10-15 seconds)
   - Traction or validation
   - Team credentials
   - Social proof or early wins

5. THE ASK (5-10 seconds)
   - Clear call to action
   - Specific next step
   - Easy to say yes to

SCORING CRITERIA (0-100 each):
- Hook: Memorability, relevance, curiosity generation
- Problem: Clarity, relatability, urgency
- Solution: Differentiation, benefits clarity, credibility
- Proof: Strength of evidence, relevance, believability
- The Ask: Clarity, specificity, actionability

Additional analysis:
- Tone: Formal/Conversational, Confident/Uncertain, Urgent/Calm
- Duration estimate based on word count and complexity
- Key excerpts for each element

Respond in JSON format:
{
  "elements": [
    {
      "name": "hook" | "problem" | "solution" | "proof" | "theAsk",
      "score": number,
      "excerpt": "string (exact text from input)",
      "feedback": "string",
      "strengths": ["string"],
      "improvements": ["string"]
    }
  ],
  "toneAnalysis": {
    "formal": number (0-100),
    "conversational": number (0-100),
    "confident": number (0-100),
    "urgent": number (0-100),
    "dominant": "formal" | "conversational" | "confident" | "urgent"
  },
  "structure": {
    "flow": "string (assessment of overall flow)",
    "balance": "string (assessment of time distribution)",
    "coherence": number (0-100)
  },
  "estimatedDuration": number (seconds),
  "wordCount": number,
  "overallScore": number,
  "overallFeedback": "string"
}
`;

export const REWRITE_PROMPT_TEMPLATE = `
You are helping improve a specific element of an elevator pitch.

CURRENT ELEMENT: {elementName}
CURRENT TEXT: "{currentText}"
OVERALL CONTEXT: "{fullScript}"

Generate 3 alternative versions that:
1. Maintain the core message
2. Improve impact and clarity
3. Are appropriate for the estimated duration
4. Match the overall tone of the pitch

For each alternative, explain the improvement focus.

Respond in JSON:
{
  "suggestions": [
    {
      "text": "string",
      "reason": "string",
      "improvementFocus": "clarity" | "impact" | "brevity" | "credibility" | "emotional"
    }
  ]
}
`;
```

### 7.3 Module E3: Live Pitch Prompts

```typescript
// lib/ai/gemini/prompts/delivery-analysis.ts

export const DELIVERY_ANALYSIS_PROMPT = `
You are an expert public speaking coach analyzing video of an elevator pitch.

DELIVERY METRICS:
1. PACING
   - Speaking rate (words per minute)
   - Pause effectiveness
   - Rushing vs. measured delivery
   - Rhythm variation

2. CLARITY
   - Articulation quality
   - Word choice precision
   - Filler words usage
   - Sentence completeness

3. CONFIDENCE
   - Voice projection
   - Pitch variation
   - Hesitation markers
   - Authority projection

Analyze the video with transcript (if available) and provide:

Respond in JSON:
{
  "pacing": {
    "score": number (0-100),
    "wordsPerMinute": number,
    "feedback": "string",
    "specificMoments": [
      { "timestamp": "MM:SS", "observation": "string" }
    ]
  },
  "clarity": {
    "score": number (0-100),
    "fillerWordCount": number,
    "feedback": "string",
    "improvements": ["string"]
  },
  "confidence": {
    "score": number (0-100),
    "feedback": "string",
    "indicators": {
      "positive": ["string"],
      "negative": ["string"]
    }
  },
  "overallDeliveryScore": number,
  "topTips": ["string"]
}
`;

// lib/ai/gemini/prompts/body-language.ts

export const BODY_LANGUAGE_ANALYSIS_PROMPT = `
You are a body language expert analyzing video of a pitch presentation.

BODY LANGUAGE METRICS:
1. EYE CONTACT
   - Camera/audience engagement
   - Natural eye movement
   - Avoiding reading from notes
   - Connection quality

2. POSTURE
   - Upright stance
   - Open body position
   - Confidence projection
   - Nervous habits (slouching, swaying)

3. GESTURES
   - Purposeful hand movements
   - Emphasis gestures
   - Open vs. closed gestures
   - Distracting movements

Analyze key frames from the video and provide detailed feedback.

Respond in JSON:
{
  "eyeContact": {
    "score": number (0-100),
    "percentageOnCamera": number (estimated),
    "feedback": "string",
    "patterns": ["string"]
  },
  "posture": {
    "score": number (0-100),
    "feedback": "string",
    "issues": ["string"],
    "strengths": ["string"]
  },
  "gestures": {
    "score": number (0-100),
    "feedback": "string",
    "effectiveGestures": ["string"],
    "distractingGestures": ["string"]
  },
  "overallBodyLanguageScore": number,
  "keyObservations": [
    {
      "timestamp": "MM:SS",
      "observation": "string",
      "impact": "positive" | "negative" | "neutral"
    }
  ]
}
`;

export const COACHING_DRILLS_PROMPT = `
Based on the following analysis results, generate personalized practice drills.

DELIVERY SCORES:
- Pacing: {pacingScore}/100
- Clarity: {clarityScore}/100  
- Confidence: {confidenceScore}/100

BODY LANGUAGE SCORES:
- Eye Contact: {eyeContactScore}/100
- Posture: {postureScore}/100
- Gestures: {gesturesScore}/100

SPECIFIC ISSUES: {issues}

Generate 3-5 specific, actionable drills to improve the weakest areas.
Each drill should be doable in 5-10 minutes.

Respond in JSON:
{
  "drills": [
    {
      "name": "string",
      "targetArea": "pacing" | "clarity" | "confidence" | "eyeContact" | "posture" | "gestures",
      "description": "string",
      "duration": "string (e.g., '5 minutes')",
      "steps": ["string"],
      "successCriteria": "string"
    }
  ]
}
`;
```

### 7.4 Module E4: Full Session Prompts

```typescript
// lib/ai/claude/prompts/full-session.ts

export const FULL_SESSION_SYSTEM_PROMPT = `
You are a senior investment pitch consultant analyzing a complete pitch session.

You will receive:
1. Pitch deck content (text and slide structure)
2. Video transcript (if available)
3. Recording duration

6-DIMENSION ANALYSIS FRAMEWORK:

1. DECK ALIGNMENT (How well does the presenter follow the deck?)
   - Sticking to slide content
   - Seamless transitions
   - Not reading slides
   - Natural flow

2. NARRATIVE ARC (Story structure and engagement)
   - Opening hook effectiveness
   - Logical progression
   - Emotional journey
   - Memorable conclusion

3. CONTENT DEPTH (8 sections evaluated)
   - Problem articulation
   - Solution clarity
   - Market opportunity
   - Business model explanation
   - Traction/proof
   - Team credibility
   - Financial projections
   - The ask clarity

4. DELIVERY (Presentation skills)
   - Pacing and timing
   - Clarity of speech
   - Confidence projection
   - Audience engagement

5. INVESTOR READINESS (Red flags and green lights)
   - Objection handling
   - Gap identification
   - Credibility signals
   - Risk factors

6. Q&A PREP (Anticipated questions)
   - 5 likely investor questions
   - Suggested responses
   - Weak point identification

SCORING: All scores 0-100

Respond in JSON:
{
  "dimensions": {
    "deckAlignment": {
      "score": number,
      "feedback": "string",
      "slideBySlideAlignment": [
        { "slideNumber": number, "alignment": "strong" | "moderate" | "weak", "notes": "string" }
      ]
    },
    "narrativeArc": {
      "score": number,
      "feedback": "string",
      "structure": ["string"],
      "emotionalJourney": "string"
    },
    "contentDepth": {
      "overall": number,
      "sections": {
        "problem": { "score": number, "feedback": "string" },
        "solution": { "score": number, "feedback": "string" },
        "market": { "score": number, "feedback": "string" },
        "businessModel": { "score": number, "feedback": "string" },
        "traction": { "score": number, "feedback": "string" },
        "team": { "score": number, "feedback": "string" },
        "financials": { "score": number, "feedback": "string" },
        "ask": { "score": number, "feedback": "string" }
      }
    },
    "delivery": {
      "score": number,
      "feedback": "string",
      "pacing": { "score": number, "notes": "string" },
      "clarity": { "score": number, "notes": "string" },
      "confidence": { "score": number, "notes": "string" }
    },
    "investorReadiness": {
      "score": number,
      "redFlags": [
        { "issue": "string", "severity": "critical" | "major" | "minor", "suggestion": "string" }
      ],
      "greenLights": ["string"],
      "overallVerdict": "ready" | "almostReady" | "needsWork" | "notReady"
    },
    "qandaPrep": {
      "score": number,
      "anticipatedQuestions": [
        {
          "question": "string",
          "suggestedAnswer": "string",
          "difficulty": "easy" | "medium" | "hard",
          "preparationTip": "string"
        }
      ]
    }
  },
  "overallScore": number,
  "recommendations": [
    {
      "priority": "high" | "medium" | "low",
      "category": "string",
      "action": "string",
      "expectedImpact": "string"
    }
  ],
  "executiveSummary": "string"
}
`;

export const INVESTOR_READINESS_PROMPT = `
Based on the full pitch analysis, determine investor readiness level.

CONSIDER:
- Stage appropriateness of content
- Clarity of value proposition
- Team credibility signals
- Market opportunity size
- Competitive positioning
- Business model viability
- Ask clarity and justification
- Presentation polish

Provide actionable red flags and green lights.

Red flags should be critical issues that would cause investors to pass.
Green lights should be strengths that would attract investors.
`;
```

---

## 8. Security Considerations

### 8.1 API Key Management

```typescript
// Environment variables structure
// .env.local (never commit)

// Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_SECRET_KEY=sk_test_xxx

// Database
DATABASE_URL=postgresql://user:pass@host:5432/pitchcoach

// Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

// Cloudflare
CLOUDFLARE_R2_ENDPOINT=https://xxx.r2.cloudflarestorage.com
CLOUDFLARE_R2_ACCESS_KEY_ID=xxx
CLOUDFLARE_R2_SECRET_ACCESS_KEY=xxx
CLOUDFLARE_R2_BUCKET=pitchcoach-files
CLOUDFLARE_STREAM_API_TOKEN=xxx
CLOUDFLARE_ACCOUNT_ID=xxx

// AI APIs
ANTHROPIC_API_KEY=sk-ant-xxx
GEMINI_API_KEY=xxx

// Zoho
ZOHO_CLIENT_ID=xxx
ZOHO_CLIENT_SECRET=xxx
ZOHO_REFRESH_TOKEN=xxx
ZOHO_SSO_SECRET=xxx

// Redis (for queues)
REDIS_HOST=localhost
REDIS_PORT=6379

// Security
NEXTAUTH_SECRET=xxx
ENCRYPTION_KEY=xxx
```

### 8.2 API Key Rotation Strategy

```typescript
// lib/config/secrets.ts

// Use environment variables with fallback validation
function getRequiredEnvVar(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

// Key rotation support
function getEnvVarWithFallback(primary: string, fallback: string): string {
  return process.env[primary] || process.env[fallback] || '';
}

// Configuration object
export const config = {
  clerk: {
    publishableKey: getRequiredEnvVar('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY'),
    secretKey: getRequiredEnvVar('CLERK_SECRET_KEY'),
  },
  stripe: {
    publishableKey: getRequiredEnvVar('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'),
    secretKey: getRequiredEnvVar('STRIPE_SECRET_KEY'),
    webhookSecret: getRequiredEnvVar('STRIPE_WEBHOOK_SECRET'),
  },
  anthropic: {
    apiKey: getRequiredEnvVar('ANTHROPIC_API_KEY'),
  },
  gemini: {
    apiKey: getRequiredEnvVar('GEMINI_API_KEY'),
  },
  // ... etc
} as const;
```

### 8.3 File Validation

```typescript
// lib/utils/file-validation.ts

import { createHash } from 'crypto';

// Allowed file types per module
const ALLOWED_TYPES = {
  'deck-analyzer': [
    'application/pdf',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ],
  'script-coach': [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
  ],
  'live-pitch': [
    'video/webm',
    'video/mp4',
    'video/quicktime',
    'audio/webm',
    'audio/mp3',
    'audio/wav',
  ],
  'full-session': [
    'application/pdf',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'video/webm',
    'video/mp4',
    'audio/webm',
  ],
};

// Max file sizes (in bytes)
const MAX_SIZES = {
  'deck-analyzer': 50 * 1024 * 1024,    // 50MB
  'script-coach': 10 * 1024 * 1024,      // 10MB
  'live-pitch': 500 * 1024 * 1024,       // 500MB (3 min video)
  'full-session': 1024 * 1024 * 1024,    // 1GB (30 min video + deck)
};

export function validateFile(
  file: File,
  module: keyof typeof ALLOWED_TYPES
): { valid: boolean; error?: string } {
  // Check file type
  if (!ALLOWED_TYPES[module].includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed: ${ALLOWED_TYPES[module].join(', ')}`,
    };
  }

  // Check file size
  if (file.size > MAX_SIZES[module]) {
    return {
      valid: false,
      error: `File too large. Maximum size: ${MAX_SIZES[module] / 1024 / 1024}MB`,
    };
  }

  return { valid: true };
}

// Server-side file content validation
export async function validateFileContent(
  buffer: Buffer,
  expectedMimeType: string
): Promise<boolean> {
  // Magic number validation
  const magicNumbers: Record<string, Buffer> = {
    'application/pdf': Buffer.from([0x25, 0x50, 0x44, 0x46]), // %PDF
    'video/mp4': Buffer.from([0x00, 0x00, 0x00]), // varies, check ftyp
    'video/webm': Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), // EBML
  };

  const magic = magicNumbers[expectedMimeType];
  if (magic && buffer.length >= magic.length) {
    const header = buffer.slice(0, magic.length);
    // For PDF, check exact match
    if (expectedMimeType === 'application/pdf') {
      return header.equals(magic);
    }
    // For video formats, more complex validation needed
    // Use file-type library for accurate detection
  }

  return true;
}

// Malware scanning integration (optional, for production)
export async function scanForMalware(fileKey: string): Promise<{ safe: boolean }> {
  // Integrate with Cloudflare Malware Detection or similar
  // This is a placeholder for actual implementation
  return { safe: true };
}
```

### 8.4 Rate Limiting

```typescript
// lib/utils/rate-limiter.ts

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Create rate limiters for different purposes
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// General API rate limit
export const apiLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '1 m'), // 100 requests per minute
  analytics: true,
  prefix: 'pitchcoach:api',
});

// File upload rate limit
export const uploadLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 m'), // 10 uploads per minute
  analytics: true,
  prefix: 'pitchcoach:upload',
});

// AI analysis rate limit
export const analysisLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, '1 h'), // 20 analyses per hour per tier
  analytics: true,
  prefix: 'pitchcoach:analysis',
});

// Usage in API routes
export async function checkRateLimit(
  identifier: string,
  limiter: Ratelimit
): Promise<{ success: boolean; remaining: number; reset: Date }> {
  const { success, remaining, reset } = await limiter.limit(identifier);
  
  return {
    success,
    remaining,
    reset: new Date(reset),
  };
}

// Middleware helper
export function withRateLimit(limiter: Ratelimit) {
  return async function rateLimitMiddleware(
    req: NextRequest,
    userId: string
  ): Promise<NextResponse | null> {
    const { success, remaining, reset } = await checkRateLimit(userId, limiter);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', reset },
        { status: 429 }
      );
    }
    
    return null; // Continue to handler
  };
}
```

### 8.5 Input Sanitization

```typescript
// lib/utils/sanitization.ts

import DOMPurify from 'isomorphic-dompurify';
import { z } from 'zod';

// Text input sanitization
export function sanitizeText(input: string): string {
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [] });
}

// Script analysis input validation
export const scriptInputSchema = z.object({
  inputType: z.enum(['TEXT_PASTE', 'PDF_UPLOAD', 'DOCX_UPLOAD']),
  text: z.string().max(5000).optional(),
  fileKey: z.string().optional(),
}).refine(
  (data) => data.inputType === 'TEXT_PASTE' ? !!data.text : !!data.fileKey,
  { message: 'Text required for TEXT_PASTE, fileKey for uploads' }
);

// Session ID validation
export const sessionIdSchema = z.string().regex(/^[a-zA-Z0-9]{25}$/);

// File key validation (R2 object keys)
export const fileKeySchema = z.string().regex(
  /^uploads\/[a-zA-Z0-9-]+\/[a-f0-9]{32}\.[a-z]{2,4}$/
);

// Pagination validation
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// SQL injection prevention (Prisma handles this, but extra validation)
export function isValidSortField(field: string, allowedFields: string[]): boolean {
  return allowedFields.includes(field);
}
```

### 8.6 Authentication & Authorization

```typescript
// lib/auth/roles.ts

import { auth, clerkClient } from '@clerk/nextjs/server';

export type Role = 'USER' | 'ADMIN' | 'SUPER_ADMIN';

// Check if user has required role
export async function requireRole(requiredRole: Role): Promise<boolean> {
  const { userId } = auth();
  
  if (!userId) {
    return false;
  }
  
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const role = user.publicMetadata.role as Role || 'USER';
  
  const roleHierarchy: Record<Role, number> = {
    'USER': 0,
    'ADMIN': 1,
    'SUPER_ADMIN': 2,
  };
  
  return roleHierarchy[role] >= roleHierarchy[requiredRole];
}

// Usage entitlements check
export async function checkUsageEntitlement(
  module: 'analyze' | 'script' | 'livePitch' | 'fullSession'
): Promise<{ allowed: boolean; remaining: number }> {
  const { userId } = auth();
  
  if (!userId) {
    return { allowed: false, remaining: 0 };
  }
  
  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: {
      subscriptionTier: true,
      analyzeUsage: true,
      scriptUsage: true,
      livePitchUsage: true,
      fullSessionUsage: true,
      bundles: {
        where: { usesRemaining: { gt: 0 } },
        select: { modules: true, usesRemaining: true },
      },
    },
  });
  
  if (!user) {
    return { allowed: false, remaining: 0 };
  }
  
  // Check tier limits
  const tierLimits = TIER_LIMITS[user.subscriptionTier];
  const currentUsage = user[`${module}Usage` as keyof typeof user] as number;
  const limit = tierLimits[module];
  
  if (limit === -1) { // Unlimited
    return { allowed: true, remaining: -1 };
  }
  
  if (currentUsage < limit) {
    return { allowed: true, remaining: limit - currentUsage };
  }
  
  // Check bundle purchases
  const bundleWithModule = user.bundles.find(b => 
    b.modules.includes(module.toUpperCase() as any)
  );
  
  if (bundleWithModule && bundleWithModule.usesRemaining > 0) {
    return { allowed: true, remaining: bundleWithModule.usesRemaining };
  }
  
  return { allowed: false, remaining: 0 };
}

// Tier limits configuration
export const TIER_LIMITS = {
  FREE: {
    analyze: 1,
    script: 3,
    livePitch: 0,
    fullSession: 0,
  },
  INDIVIDUAL: {
    analyze: 10,
    script: 20,
    livePitch: 10,
    fullSession: 5,
  },
  TEAM: {
    analyze: 50,
    script: 100,
    livePitch: 50,
    fullSession: 25,
  },
  ENTERPRISE: {
    analyze: -1, // Unlimited
    script: -1,
    livePitch: -1,
    fullSession: -1,
  },
} as const;
```

### 8.7 Data Encryption

```typescript
// lib/utils/encryption.ts

import { encrypt, decrypt } from '@repo/encryption';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!;

// Encrypt sensitive data before storing
export async function encryptSensitiveData(data: string): Promise<string> {
  return encrypt(data, ENCRYPTION_KEY);
}

// Decrypt sensitive data
export async function decryptSensitiveData(encrypted: string): Promise<string> {
  return decrypt(encrypted, ENCRYPTION_KEY);
}

// Secure storage for API tokens
export async function storeUserApiKey(
  userId: string,
  provider: string,
  apiKey: string
): Promise<void> {
  const encryptedKey = await encryptSensitiveData(apiKey);
  
  await prisma.userApiKeys.upsert({
    where: { userId_provider: { userId, provider } },
    create: { userId, provider, encryptedKey },
    update: { encryptedKey },
  });
}
```

### 8.8 Security Headers

```typescript
// next.config.ts

const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block',
  },
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'origin-when-cross-origin',
  },
  {
    key: 'Content-Security-Policy',
    value: `
      default-src 'self';
      script-src 'self' 'unsafe-eval' 'unsafe-inline' *.clerk.accounts.dev;
      style-src 'self' 'unsafe-inline';
      img-src 'self' data: blob: *.cloudflarestream.com;
      font-src 'self' data:;
      connect-src 'self' *.clerk.accounts.dev api.anthropic.com api.stripe.com;
      media-src 'self' blob: *.cloudflarestream.com;
      frame-src 'self' *.clerk.accounts.dev js.stripe.com;
    `.replace(/\s{2,}/g, ' ').trim(),
  },
];

export default {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};
```

---

## 9. Development Phases

> **Detailed 3-Week Execution Plan:** See `/home/z/my-project/EXECUTION_PLAN.md` for day-by-day breakdown.

### 9.1 Accelerated Timeline (3 Weeks)

**Target:** Production-ready MVP with all 4 modules + Zoho integrations

```
WEEK 1: FOUNDATION + CORE MODULES (E1, E2)
├── Days 1-2:   Project setup, auth, database, UI framework, storage
├── Days 3-4:   Module E1 (Deck Analyzer) — full implementation
├── Days 5-6:   Module E2 (Script Coach) — full implementation
└── Day 7:      Billing foundation (Stripe products, checkout)

WEEK 2: BILLING + VIDEO MODULES (E3, E4)
├── Days 8-9:   Stripe webhooks, subscriptions, usage tracking
├── Days 10-12: Module E3 (Live Pitch) — video recording + analysis
└── Days 13-14: Module E4 (Full Session) — multi-input + 6-dimension

WEEK 3: INTEGRATIONS + POLISH
├── Days 15-16: Zoho CRM + Books + Campaigns integrations
├── Day 17:     Trainer Central SSO + Admin panel
├── Day 18:     Admin analytics, system health
├── Day 19:     Performance optimization, error handling
├── Day 20:     Security audit, rate limiting
└── Day 21:     Final testing, production deployment
```

### 9.2 Detailed Phase Breakdown

#### Phase 1: Foundation (Weeks 1-2)

**Week 1: Setup & Core Infrastructure**
```
Day 1-2:
- Initialize Next.js 15 project with TypeScript
- Configure Tailwind CSS and shadcn/ui
- Set up ESLint, Prettier, Husky
- Create folder structure
- Configure environment variables

Day 3-4:
- Set up Prisma with PostgreSQL (Neon/Supabase)
- Create initial database schema
- Run initial migrations
- Set up Clerk authentication
- Implement protected routes

Day 5:
- Create basic layout components
- Set up error boundaries
- Configure deployment (Vercel)
- Set up CI/CD pipeline
```

**Week 2: UI Framework & Core Components**
```
Day 1-2:
- Build responsive navigation
- Create dashboard layout
- Implement theme switching
- Build common UI components (FileUploader, ScoreCard, etc.)

Day 3-4:
- Set up R2 storage
- Create file upload utilities
- Implement presigned URL generation
- Build upload progress components

Day 5:
- Write unit tests for utilities
- Create API route structure
- Set up logging (Axiom or similar)
- Documentation of setup
```

**Dependencies:**
- Node.js 18+
- PostgreSQL database provisioned
- Clerk application created
- Cloudflare R2 bucket created
- Vercel project set up

**Deliverables:**
- Working Next.js application
- Authentication flow complete
- Basic layouts and navigation
- File upload infrastructure
- Database migrations

#### Phase 2: Module E1 - Deck Analyzer (Weeks 3-4)

**Week 3: Core Analysis Engine**
```
Day 1-2:
- Build deck upload UI
- Implement PDF/PPTX parsing
- Create slide extraction logic
- Build image conversion pipeline

Day 3-4:
- Integrate Claude API
- Implement deck analysis prompts
- Create scoring algorithms
- Build analysis result parser

Day 5:
- Implement visual audit analysis
- Create priority action generator
- Build progress tracking
- API endpoint testing
```

**Week 4: UI & Reporting**
```
Day 1-2:
- Build results dashboard UI
- Create slide analysis cards
- Implement visual audit display
- Build priority actions list

Day 3-4:
- Implement PDF report generation
- Create report templates
- Build download functionality
- Implement session history

Day 5:
- Integration testing
- Performance optimization
- Error handling refinement
- Documentation
```

**Dependencies:**
- Phase 1 complete
- Anthropic API key
- PDF processing library (pdf-parse)
- PPTX processing library

**Deliverables:**
- Complete E1 module
- Deck upload and analysis
- Visual audit functionality
- PDF report download
- Session history for E1

#### Phase 3: Module E2 - Script Coach (Weeks 5-6)

**Week 5: Analysis Engine**
```
Day 1-2:
- Build text input UI
- Implement file upload for scripts
- Create text extraction from files
- Build input validation

Day 3-4:
- Implement 5-element framework analysis
- Create element scoring algorithms
- Build excerpt identification
- Implement tone analysis

Day 5:
- Create rewrite suggestion engine
- Build duration estimation
- API endpoint implementation
- Unit testing
```

**Week 6: UI & Refinement**
```
Day 1-2:
- Build analysis results UI
- Create element score cards
- Implement excerpt highlighting
- Build tone visualization

Day 3-4:
- Implement rewrite suggestions UI
- Create apply suggestion flow
- Build session comparison
- Add history tracking

Day 5:
- Integration testing
- Performance optimization
- Accessibility improvements
- Documentation
```

**Dependencies:**
- Phase 2 complete
- DOCX processing capability

**Deliverables:**
- Complete E2 module
- Text and file input
- 5-element analysis
- Rewrite suggestions
- Session history for E2

#### Phase 4: Billing & Subscriptions (Weeks 7-8)

**Week 7: Stripe Integration**
```
Day 1-2:
- Set up Stripe products and prices
- Implement checkout session creation
- Build webhook handlers
- Create subscription management

Day 3-4:
- Implement customer portal
- Build subscription status tracking
- Create tier configuration system
- Implement usage tracking

Day 5:
- Build bundle purchase system
- Create payment history
- Testing with Stripe test mode
- Documentation
```

**Week 8: UI & Entitlements**
```
Day 1-2:
- Build pricing page
- Create subscription management UI
- Implement usage meters
- Build upgrade/downgrade flows

Day 3-4:
- Implement entitlement checking
- Create limit enforcement
- Build usage reset logic
- Admin billing management

Day 5:
- End-to-end billing testing
- Webhook testing
- Error scenario handling
- Documentation
```

**Dependencies:**
- Phase 3 complete
- Stripe account created
- Products configured in Stripe

**Deliverables:**
- Complete billing system
- Subscription management
- Bundle purchases
- Usage tracking
- Admin billing panel

#### Phase 5: Module E3 - Live Pitch (Weeks 9-11)

**Week 9: Video Infrastructure**
```
Day 1-2:
- Set up Cloudflare Stream
- Implement video recording component
- Create upload to Stream flow
- Build video preview functionality

Day 3-4:
- Implement audio recording option
- Create transcript input
- Build recording management
- Implement video playback

Day 5:
- Set up video processing pipeline
- Create frame extraction
- Build thumbnail generation
- Testing video flows
```

**Week 10: Analysis Engine**
```
Day 1-2:
- Integrate Gemini Vision API
- Implement delivery analysis
- Create pacing analysis
- Build clarity scoring

Day 3-4:
- Implement body language analysis
- Create eye contact detection
- Build posture analysis
- Implement gesture recognition

Day 5:
- Create structure analysis
- Build overall scoring
- Create coaching drill generation
- API implementation
```

**Week 11: UI & Comparison**
```
Day 1-2:
- Build recording interface UI
- Create live preview
- Implement recording controls
- Build playback controls

Day 3-4:
- Build feedback display UI
- Create delivery visualization
- Implement body language display
- Build coaching drill cards

Day 5:
- Implement session comparison
- Create progress tracking
- Build improvement insights
- Testing and refinement
```

**Dependencies:**
- Phase 4 complete
- Cloudflare Stream configured
- Gemini API key
- WebRTC support

**Deliverables:**
- Complete E3 module
- Video/audio recording
- Delivery analysis
- Body language analysis
- Coaching drills
- Session comparison

#### Phase 6: Module E4 - Full Session (Weeks 12-14)

**Week 12: Multi-Input System**
```
Day 1-2:
- Build multi-file upload UI
- Implement deck + video upload
- Create upload orchestration
- Build progress tracking

Day 3-4:
- Create combined analysis pipeline
- Implement analysis coordination
- Build result aggregation
- Create progress indicator

Day 5:
- Implement transcript handling
- Create analysis queuing
- Build error handling
- Testing multi-input
```

**Week 13: 6-Dimension Analysis**
```
Day 1-2:
- Implement deck alignment analysis
- Create narrative arc analysis
- Build content depth analysis
- Implement delivery scoring

Day 3-4:
- Implement investor readiness analysis
- Create red flag detection
- Build green light identification
- Create Q&A preparation engine

Day 5:
- Create overall scoring algorithm
- Build recommendation engine
- API implementation
- Testing
```

**Week 14: UI & Reporting**
```
Day 1-2:
- Build comprehensive results UI
- Create dimension analysis display
- Implement investor readiness gauge
- Build Q&A prep section

Day 3-4:
- Create comprehensive PDF report
- Build report templates
- Implement download functionality
- Create executive summary

Day 5:
- Integration testing
- Performance optimization
- Documentation
- User acceptance testing
```

**Dependencies:**
- Phase 5 complete
- All AI integrations working

**Deliverables:**
- Complete E4 module
- Multi-file upload
- 6-dimension analysis
- Comprehensive reports
- Q&A preparation

#### Phase 7: Integrations (Weeks 15-16)

**Week 15: Zoho Integration**
```
Day 1-2:
- Set up Zoho OAuth
- Implement CRM sync
- Create contact management
- Build lead tracking

Day 3-4:
- Implement Books integration
- Create invoice sync
- Build customer sync
- Implement Campaigns integration

Day 5:
- Create sync job scheduling
- Build error handling
- Implement retry logic
- Testing integrations
```

**Week 16: SSO & Admin**
```
Day 1-2:
- Implement Trainer Central SSO
- Create SSO token generation
- Build redirect handling
- Test SSO flow

Day 3-4:
- Enhance admin panel
- Create user management
- Build tier management
- Implement analytics dashboard

Day 5:
- Create health monitoring
- Build admin audit log
- Testing and documentation
- Security review
```

**Dependencies:**
- Phase 6 complete
- Zoho API credentials
- Trainer Central SSO configuration

**Deliverables:**
- Zoho CRM integration
- Zoho Books integration
- Zoho Campaigns integration
- Trainer Central SSO
- Enhanced admin panel

#### Phase 8: Polish & Launch (Weeks 17-18)

**Week 17: Optimization & Testing**
```
Day 1-2:
- Performance optimization
- Database query optimization
- Caching implementation
- Load testing

Day 3-4:
- Security audit
- Penetration testing
- Fix security issues
- Implement recommendations

Day 5:
- Accessibility audit
- WCAG compliance
- Screen reader testing
- Color contrast fixes
```

**Week 18: Launch Preparation**
```
Day 1-2:
- User acceptance testing
- Bug fixes
- Performance tuning
- Documentation finalization

Day 3-4:
- Marketing page finalization
- SEO optimization
- Analytics setup
- Monitoring configuration

Day 5:
- Production deployment
- DNS configuration
- SSL verification
- Launch!
```

**Dependencies:**
- All phases complete
- Security audit tools
- Monitoring service

**Deliverables:**
- Production-ready application
- Security audit report
- Performance benchmarks
- Complete documentation
- Launch checklist complete

### 9.3 Dependency Graph

```
Phase 1 (Foundation)
    │
    ├──→ Phase 2 (E1: Deck Analyzer)
    │         │
    │         ├──→ Phase 3 (E2: Script Coach)
    │         │         │
    │         │         └──→ Phase 4 (Billing)
    │         │                   │
    │         │                   └──→ Phase 5 (E3: Live Pitch)
    │         │                             │
    │         │                             └──→ Phase 6 (E4: Full Session)
    │         │                                       │
    │         │                                       └──→ Phase 7 (Integrations)
    │         │                                                 │
    │         └─────────────────────────────────────────────────┴──→ Phase 8 (Launch)
    │
    └──→ (Each phase builds on foundation)
```

### 9.4 Resource Requirements

| Phase | Frontend Dev | Backend Dev | DevOps | QA | Est. Hours |
|-------|-------------|-------------|--------|-----|------------|
| 1 | 1 | 1 | 1 | 0.5 | 160 |
| 2 | 1 | 1 | 0.5 | 0.5 | 160 |
| 3 | 1 | 1 | 0 | 0.5 | 160 |
| 4 | 0.5 | 1 | 0.5 | 0.5 | 160 |
| 5 | 1 | 1 | 0.5 | 0.5 | 240 |
| 6 | 1 | 1 | 0 | 0.5 | 240 |
| 7 | 0.5 | 1 | 0.5 | 0.5 | 160 |
| 8 | 1 | 1 | 1 | 1 | 160 |
| **Total** | **7** | **8** | **4** | **4.5** | **1440** |

---

## Appendix A: Environment Variables Template

```bash
# .env.local.example

# ============================================
# APPLICATION
# ============================================
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=PitchCoach AI

# ============================================
# AUTHENTICATION (Clerk)
# ============================================
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_SECRET_KEY=sk_test_xxx
CLERK_WEBHOOK_SECRET=whsec_xxx

# ============================================
# DATABASE
# ============================================
DATABASE_URL=postgresql://user:password@localhost:5432/pitchcoach

# ============================================
# STRIPE
# ============================================
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# ============================================
# CLOUDFLARE
# ============================================
CLOUDFLARE_ACCOUNT_ID=xxx
CLOUDFLARE_R2_ENDPOINT=https://xxx.r2.cloudflarestorage.com
CLOUDFLARE_R2_ACCESS_KEY_ID=xxx
CLOUDFLARE_R2_SECRET_ACCESS_KEY=xxx
CLOUDFLARE_R2_BUCKET=pitchcoach-files
CLOUDFLARE_R2_PUBLIC_URL=https://files.pitchcoach.ai
CLOUDFLARE_STREAM_API_TOKEN=xxx
CLOUDFLARE_STREAM_CUSTOMER_ID=xxx

# ============================================
# AI APIS
# ============================================
ANTHROPIC_API_KEY=sk-ant-xxx
GEMINI_API_KEY=xxx

# ============================================
# ZOHO INTEGRATION
# ============================================
ZOHO_CLIENT_ID=xxx
ZOHO_CLIENT_SECRET=xxx
ZOHO_REFRESH_TOKEN=xxx
ZOHO_CRM_API_DOMAIN=https://www.zohoapis.com
ZOHO_BOOKS_ORG_ID=xxx
ZOHO_CAMPAIGNS_LIST_KEY=xxx
ZOHO_TRAINER_SSO_SECRET=xxx

# ============================================
# REDIS (UPSTASH)
# ============================================
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx

# ============================================
# SECURITY
# ============================================
ENCRYPTION_KEY=xxx  # 32-byte hex string
NEXTAUTH_SECRET=xxx

# ============================================
# LOGGING
# ============================================
LOG_LEVEL=info
AXIOM_TOKEN=xxx  # Optional: for production logging

# ============================================
# FEATURES
# ============================================
FEATURE_FLAG_ANALYTICS=true
FEATURE_FLAG_ZOHO_SYNC=true
```

---

## Appendix B: Package Dependencies

```json
{
  "dependencies": {
    // Framework
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    
    // UI
    "@radix-ui/react-accordion": "^1.2.0",
    "@radix-ui/react-alert-dialog": "^1.1.0",
    "@radix-ui/react-dialog": "^1.1.0",
    "@radix-ui/react-dropdown-menu": "^2.1.0",
    "@radix-ui/react-progress": "^1.1.0",
    "@radix-ui/react-select": "^2.1.0",
    "@radix-ui/react-tabs": "^1.1.0",
    "@radix-ui/react-toast": "^1.2.0",
    "@radix-ui/react-tooltip": "^1.1.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.0",
    "lucide-react": "^0.400.0",
    
    // Auth
    "@clerk/nextjs": "^5.0.0",
    
    // Database
    "@prisma/client": "^5.0.0",
    
    // Storage
    "@aws-sdk/client-s3": "^3.500.0",
    "@aws-sdk/s3-request-presigner": "^3.500.0",
    
    // AI
    "@anthropic-ai/sdk": "^0.27.0",
    "@google/generative-ai": "^0.14.0",
    
    // Billing
    "stripe": "^15.0.0",
    
    // PDF Processing
    "pdf-parse": "^1.1.1",
    "pdf-lib": "^1.17.0",
    "pptx-parser": "^1.0.0",
    
    // Utilities
    "zod": "^3.23.0",
    "date-fns": "^3.6.0",
    "isomorphic-dompurify": "^2.12.0",
    "sharp": "^0.33.0",
    
    // Rate Limiting
    "@upstash/ratelimit": "^1.1.0",
    "@upstash/redis": "^1.31.0",
    
    // Queue (optional)
    "bullmq": "^5.8.0",
    
    // Charts
    "recharts": "^2.12.0"
  },
  "devDependencies": {
    // TypeScript
    "typescript": "^5.4.0",
    "@types/node": "^20.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    
    // Database
    "prisma": "^5.0.0",
    
    // Testing
    "@playwright/test": "^1.44.0",
    "vitest": "^1.6.0",
    "@testing-library/react": "^16.0.0",
    
    // Linting
    "eslint": "^8.57.0",
    "eslint-config-next": "^15.0.0",
    "prettier": "^3.3.0",
    "prettier-plugin-tailwindcss": "^0.6.0",
    
    // Git
    "husky": "^9.0.0",
    "lint-staged": "^15.0.0"
  }
}
```

---

## Appendix C: API Response Error Codes

| Code | Message | Description |
|------|---------|-------------|
| 400 | BAD_REQUEST | Invalid request parameters |
| 401 | UNAUTHORIZED | Authentication required |
| 403 | FORBIDDEN | Insufficient permissions |
| 404 | NOT_FOUND | Resource not found |
| 409 | CONFLICT | Resource conflict (e.g., duplicate) |
| 413 | PAYLOAD_TOO_LARGE | File size exceeds limit |
| 415 | UNSUPPORTED_MEDIA_TYPE | Invalid file type |
| 422 | UNPROCESSABLE_ENTITY | Validation error |
| 429 | RATE_LIMITED | Too many requests |
| 500 | INTERNAL_ERROR | Server error |
| 503 | SERVICE_UNAVAILABLE | AI service unavailable |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-20 | Architecture Team | Initial comprehensive architecture plan |

---

**End of Architecture Document**
