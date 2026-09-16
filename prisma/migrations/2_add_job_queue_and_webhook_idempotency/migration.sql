-- Migration: 2_add_job_queue_and_webhook_idempotency
-- Adds:
--   1. Job table — generic async AI analysis job records with retries + dead-letter
--   2. ProcessedWebhook table — idempotency for Stripe / Paystack / Clerk webhooks
--
-- IMPORTANT: Enum types MUST be created BEFORE the tables that reference them.
-- This migration was reordered to fix "type JobType does not exist" errors.

-- ─────────────────────────────────────────────────────────────────────────────
-- JobType enum (must exist before jobs table)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
    CREATE TYPE "JobType" AS ENUM ('DECK_ANALYSIS', 'SCRIPT_CHECK', 'LIVE_PITCH', 'FULL_SESSION', 'FOUNDER_COACHING');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- JobStatus enum (must exist before jobs table)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
    CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'DEAD_LETTER', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- WebhookProvider enum (must exist before processed_webhooks table)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
    CREATE TYPE "WebhookProvider" AS ENUM ('STRIPE', 'PAYSTACK', 'CLERK');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Job table
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE "jobs" (
    "id"              TEXT              NOT NULL,
    "userId"          TEXT              NOT NULL,
    "type"            "JobType"         NOT NULL,
    "sessionType"     TEXT,
    "sessionId"       TEXT,
    "status"          "JobStatus"       NOT NULL DEFAULT 'PENDING',
    "attempts"        INTEGER           NOT NULL DEFAULT 0,
    "maxAttempts"     INTEGER           NOT NULL DEFAULT 3,
    "queuedAt"        TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt"       TIMESTAMP(3),
    "finishedAt"      TIMESTAMP(3),
    "deadLetterAt"    TIMESTAMP(3),
    "lastError"       TEXT,
    "lastErrorAt"     TIMESTAMP(3),
    "errorHistory"    JSONB,
    "idempotencyKey"  TEXT,
    "payload"         JSONB,
    "result"          JSONB,
    "createdAt"       TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3)      NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "jobs_userId_idx" ON "jobs"("userId");
CREATE INDEX "jobs_status_idx" ON "jobs"("status");
CREATE INDEX "jobs_type_status_idx" ON "jobs"("type", "status");
CREATE INDEX "jobs_deadLetterAt_idx" ON "jobs"("deadLetterAt");
CREATE UNIQUE INDEX "jobs_idempotencyKey_key" ON "jobs"("idempotencyKey");

ALTER TABLE "jobs"
  ADD CONSTRAINT "jobs_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- ProcessedWebhook table
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE "processed_webhooks" (
    "id"           TEXT              NOT NULL,
    "provider"     "WebhookProvider" NOT NULL,
    "eventId"      TEXT              NOT NULL,
    "eventType"    TEXT,
    "userId"       TEXT,
    "processed"    BOOLEAN           NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "payload"      JSONB,
    "processedAt"  TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_webhooks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "processed_webhooks_provider_eventId_key"
    ON "processed_webhooks"("provider", "eventId");
CREATE INDEX "processed_webhooks_provider_processedAt_idx"
    ON "processed_webhooks"("provider", "processedAt");
