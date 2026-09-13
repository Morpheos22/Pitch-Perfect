-- PitchCoach Ai × Athena Agentic — Initial Baseline Migration
-- This is a consolidated migration that creates the entire database schema.
-- Generated from the current prisma/schema.prisma as a single baseline.
--
-- STRATEGY:
--   - If the database is EMPTY (fresh Supabase project): `prisma migrate deploy` will apply this.
--   - If the database ALREADY HAS TABLES from a previous `prisma db push`:
--     1. Run `prisma migrate deploy` (will create _prisma_migrations table)
--     2. Then run: npx prisma migrate resolve --applied 0_init
--     This tells Prisma "this migration is already in the database" without re-running the SQL.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "PlanType" AS ENUM ('FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELLED', 'INCOMPLETE', 'TRIALING');

-- CreateEnum
CREATE TYPE "ScriptInputType" AS ENUM ('TEXT', 'PDF', 'DOCX');

-- CreateEnum
CREATE TYPE "InvestorReadinessLevel" AS ENUM ('NOT_READY', 'NEEDS_WORK', 'INVESTOR_READY', 'HIGHLY_PREPARED');

-- CreateEnum
CREATE TYPE "AnalysisStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'KAL_PENDING', 'KAL_FAILED');

-- CreateEnum
CREATE TYPE "FounderModuleType" AS ENUM ('FOUNDER_READINESS', 'PATHWAY_RECOMMENDATION', 'INVESTOR_RESEARCH', 'COHORT_MATCHING', 'NETWORK_PROFILE', 'PATHWAY_NARRATION');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('SUBSCRIPTION', 'ONE_TIME', 'CREDIT_PURCHASE', 'REFUND');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('PAYSTACK', 'STRIPE', 'ZOHO');

-- CreateEnum
CREATE TYPE "ChatRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateTable: users
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "clerkId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "avatarUrl" TEXT,
    "linkedinUrl" TEXT,
    "country" TEXT,
    "primaryUseCase" TEXT,
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "zohoContactId" TEXT,
    "zohoAccountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastActiveAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable: subscriptions
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" "PlanType" NOT NULL DEFAULT 'FREE',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "paystackCustomerId" TEXT,
    "paystackSubscriptionId" TEXT,
    "paystackPlanCode" TEXT,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "stripePlanId" TEXT,
    "stripePaymentMethodId" TEXT,
    "stripeCurrentPeriodEnd" TIMESTAMP(3),
    "zohoSubscriptionId" TEXT,
    "zohoCustomerId" TEXT,
    "zohoPlanCode" TEXT,
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "creditsRemaining" INTEGER NOT NULL DEFAULT 0,
    "creditsUsed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: usage
CREATE TABLE "usage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "month" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "e1DeckAnalyses" INTEGER NOT NULL DEFAULT 0,
    "e2ScriptCoachSessions" INTEGER NOT NULL DEFAULT 0,
    "e3LivePitchSessions" INTEGER NOT NULL DEFAULT 0,
    "e4FullPitchSessions" INTEGER NOT NULL DEFAULT 0,
    "e5FounderSessions" INTEGER NOT NULL DEFAULT 0,
    "zaiTokensUsed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable: pitch_decks (E1)
CREATE TABLE "pitch_decks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileType" TEXT NOT NULL,
    "slideCount" INTEGER,
    "status" "AnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "problemClarityScore" INTEGER,
    "solutionClarityScore" INTEGER,
    "marketOpportunityScore" INTEGER,
    "businessModelScore" INTEGER,
    "teamCredibilityScore" INTEGER,
    "tractionScore" INTEGER,
    "financialsScore" INTEGER,
    "askClarityScore" INTEGER,
    "overallScore" INTEGER,
    "designConsistencyScore" INTEGER,
    "readabilityScore" INTEGER,
    "visualHierarchyScore" INTEGER,
    "colorSchemeScore" INTEGER,
    "typographyScore" INTEGER,
    "strengths" TEXT[],
    "weaknesses" TEXT[],
    "recommendations" TEXT[],
    "rawAnalysis" JSONB,
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "parentDeckId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "analyzedAt" TIMESTAMP(3),

    CONSTRAINT "pitch_decks_pkey" PRIMARY KEY ("id")
);

-- CreateTable: pitch_scripts (E2)
CREATE TABLE "pitch_scripts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "inputType" "ScriptInputType" NOT NULL,
    "inputText" TEXT,
    "inputFileUrl" TEXT,
    "fileName" TEXT,
    "targetAudience" TEXT,
    "pitchDuration" INTEGER,
    "status" "AnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "hookScore" INTEGER,
    "problemScore" INTEGER,
    "solutionScore" INTEGER,
    "credibilityScore" INTEGER,
    "ctaScore" INTEGER,
    "overallScore" INTEGER,
    "wordCount" INTEGER,
    "estimatedDuration" INTEGER,
    "improvements" JSONB,
    "rewrittenScript" TEXT,
    "alternativeHooks" TEXT[],
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "parentScriptId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "analyzedAt" TIMESTAMP(3),

    CONSTRAINT "pitch_scripts_pkey" PRIMARY KEY ("id")
);

-- CreateTable: pitch_videos (E3)
CREATE TABLE "pitch_videos" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "videoUrl" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "duration" INTEGER NOT NULL,
    "fileSize" INTEGER,
    "fileName" TEXT,
    "r2Key" TEXT,
    "type" TEXT,
    "status" "AnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "paceScore" INTEGER,
    "clarityScore" INTEGER,
    "fillerWordScore" INTEGER,
    "energyScore" INTEGER,
    "confidenceScore" INTEGER,
    "overallDeliveryScore" INTEGER,
    "eyeContactScore" INTEGER,
    "facialExpressionScore" INTEGER,
    "gestureScore" INTEGER,
    "postureScore" INTEGER,
    "overallBodyLanguageScore" INTEGER,
    "wordsPerMinute" INTEGER,
    "fillerWordCount" INTEGER,
    "fillerWords" JSONB,
    "deliveryFeedback" TEXT,
    "bodyLanguageFeedback" TEXT,
    "keyMoments" JSONB,
    "transcript" TEXT,
    "transcriptWithTimestamps" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "analyzedAt" TIMESTAMP(3),

    CONSTRAINT "pitch_videos_pkey" PRIMARY KEY ("id")
);

-- CreateTable: full_pitch_sessions (E4)
CREATE TABLE "full_pitch_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pitchDeckId" TEXT,
    "videoUrl" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "duration" INTEGER NOT NULL,
    "fileSize" INTEGER,
    "status" "AnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "problemSolutionFit" INTEGER,
    "marketOpportunity" INTEGER,
    "businessModelViability" INTEGER,
    "teamCredibility" INTEGER,
    "tractionMilestones" INTEGER,
    "deliveryPresence" INTEGER,
    "overallReadinessScore" INTEGER,
    "investorReadinessLevel" "InvestorReadinessLevel",
    "contentScores" JSONB,
    "deliveryScores" JSONB,
    "strengths" TEXT[],
    "weaknesses" TEXT[],
    "investorConcerns" TEXT[],
    "recommendedActions" TEXT[],
    "competitiveAnalysis" JSONB,
    "anticipatedQuestions" JSONB,
    "transcript" TEXT,
    "transcriptWithTimestamps" JSONB,
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "parentFullSessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "analyzedAt" TIMESTAMP(3),

    CONSTRAINT "full_pitch_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: founder_sessions (E5)
CREATE TABLE "founder_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pitchDeckId" TEXT,
    "moduleType" "FounderModuleType" NOT NULL,
    "status" "AnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "inputData" JSONB,
    "resultData" JSONB,
    "overallScore" INTEGER,
    "recommendedPathway" TEXT,
    "audioBase64" TEXT,
    "modelUsed" TEXT,
    "tokensUsed" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "analyzedAt" TIMESTAMP(3),

    CONSTRAINT "founder_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: transactions
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "provider" "PaymentProvider" NOT NULL DEFAULT 'PAYSTACK',
    "providerReference" TEXT,
    "providerAccessCode" TEXT,
    "creditsAdded" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: webhook_logs
CREATE TABLE "webhook_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "sessionType" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "crmSynced" BOOLEAN NOT NULL DEFAULT false,
    "emailSent" BOOLEAN NOT NULL DEFAULT false,
    "entitlementUpdated" BOOLEAN NOT NULL DEFAULT false,
    "externalWebhooksTriggered" BOOLEAN NOT NULL DEFAULT false,
    "errors" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable: module_access
CREATE TABLE "module_access" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "e1Access" BOOLEAN NOT NULL DEFAULT false,
    "e2Access" BOOLEAN NOT NULL DEFAULT false,
    "e3Access" BOOLEAN NOT NULL DEFAULT false,
    "e4Access" BOOLEAN NOT NULL DEFAULT false,
    "e5Access" BOOLEAN NOT NULL DEFAULT false,
    "e1Limit" INTEGER,
    "e2Limit" INTEGER,
    "e3Limit" INTEGER,
    "e4Limit" INTEGER,
    "e5Limit" INTEGER,
    "e1Used" INTEGER NOT NULL DEFAULT 0,
    "e2Used" INTEGER NOT NULL DEFAULT 0,
    "e3Used" INTEGER NOT NULL DEFAULT 0,
    "e4Used" INTEGER NOT NULL DEFAULT 0,
    "e5Used" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "module_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable: zoho_sync_logs
CREATE TABLE "zoho_sync_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "requestData" JSONB,
    "responseData" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "zoho_sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable: chat_messages
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "ChatRole" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable: kal_chat_sessions
CREATE TABLE "kal_chat_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scriptSessionId" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "messages" JSONB NOT NULL,
    "inputSummary" TEXT,
    "summary" TEXT,
    "quickFeedback" TEXT,
    "finalDecision" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kal_chat_sessions_pkey" PRIMARY KEY ("id")
);

-- ============================================
-- UNIQUE CONSTRAINTS
-- ============================================

CREATE UNIQUE INDEX "users_clerkId_key" ON "users"("clerkId");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "subscriptions_userId_key" ON "subscriptions"("userId");
CREATE UNIQUE INDEX "subscriptions_stripeCustomerId_key" ON "subscriptions"("stripeCustomerId");
CREATE UNIQUE INDEX "subscriptions_zohoSubscriptionId_key" ON "subscriptions"("zohoSubscriptionId");
CREATE UNIQUE INDEX "usage_userId_key" ON "usage"("userId");
CREATE UNIQUE INDEX "module_access_transactionId_key" ON "module_access"("transactionId");

-- ============================================
-- INDEXES
-- ============================================

-- E1: Pitch Decks
CREATE INDEX "pitch_decks_userId_idx" ON "pitch_decks"("userId");
CREATE INDEX "pitch_decks_status_idx" ON "pitch_decks"("status");
CREATE INDEX "pitch_decks_parentDeckId_idx" ON "pitch_decks"("parentDeckId");

-- E2: Pitch Scripts
CREATE INDEX "pitch_scripts_userId_idx" ON "pitch_scripts"("userId");

-- E3: Pitch Videos
CREATE INDEX "pitch_videos_userId_idx" ON "pitch_videos"("userId");

-- E4: Full Pitch Sessions
CREATE INDEX "full_pitch_sessions_userId_idx" ON "full_pitch_sessions"("userId");

-- E5: Founder Sessions
CREATE INDEX "founder_sessions_userId_idx" ON "founder_sessions"("userId");
CREATE INDEX "founder_sessions_moduleType_idx" ON "founder_sessions"("moduleType");
CREATE INDEX "founder_sessions_status_idx" ON "founder_sessions"("status");

-- Transactions
CREATE INDEX "transactions_userId_idx" ON "transactions"("userId");
CREATE INDEX "transactions_provider_idx" ON "transactions"("provider");
CREATE INDEX "transactions_provider_providerReference_idx" ON "transactions"("provider", "providerReference");

-- Webhook Logs
CREATE INDEX "webhook_logs_userId_idx" ON "webhook_logs"("userId");

-- Zoho Sync Logs
CREATE INDEX "zoho_sync_logs_userId_idx" ON "zoho_sync_logs"("userId");
CREATE INDEX "zoho_sync_logs_entityType_idx" ON "zoho_sync_logs"("entityType");

-- Chat Messages
CREATE INDEX "chat_messages_userId_conversationId_idx" ON "chat_messages"("userId", "conversationId");
CREATE INDEX "chat_messages_userId_idx" ON "chat_messages"("userId");
CREATE INDEX "chat_messages_conversationId_idx" ON "chat_messages"("conversationId");

-- Kal Chat Sessions
CREATE INDEX "kal_chat_sessions_userId_idx" ON "kal_chat_sessions"("userId");
CREATE INDEX "kal_chat_sessions_scriptSessionId_idx" ON "kal_chat_sessions"("scriptSessionId");
CREATE INDEX "kal_chat_sessions_status_idx" ON "kal_chat_sessions"("status");

-- ============================================
-- FOREIGN KEYS
-- ============================================

ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "usage" ADD CONSTRAINT "usage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pitch_decks" ADD CONSTRAINT "pitch_decks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pitch_scripts" ADD CONSTRAINT "pitch_scripts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pitch_videos" ADD CONSTRAINT "pitch_videos_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "full_pitch_sessions" ADD CONSTRAINT "full_pitch_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "full_pitch_sessions" ADD CONSTRAINT "full_pitch_sessions_pitchDeckId_fkey" FOREIGN KEY ("pitchDeckId") REFERENCES "pitch_decks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "founder_sessions" ADD CONSTRAINT "founder_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "founder_sessions" ADD CONSTRAINT "founder_sessions_pitchDeckId_fkey" FOREIGN KEY ("pitchDeckId") REFERENCES "pitch_decks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "module_access" ADD CONSTRAINT "module_access_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "kal_chat_sessions" ADD CONSTRAINT "kal_chat_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
