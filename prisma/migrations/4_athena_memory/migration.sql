-- Migration: 4_athena_memory
-- Date: 2026-09-18
-- Purpose: Athena adaptive learning + memory layer.
--
-- Houses Athena's persistent memory: sessions, individual messages, and
-- extracted long-term memory entries (preferences, facts, corrections).
-- Also stores her personality in the DB layer (editable without redeploy).
--
-- ARCHITECTURE:
--   1. AthenaSession   — one row per Athena conversation
--   2. AthenaMessage   — individual messages (user/assistant/tool/system)
--   3. AthenaMemory    — extracted facts/preferences with 36-hour TTL
--   4. AthenaPersonality — system prompts + voice + reasoning effort (DB-driven)
--
-- The 36-hour refresh cron (workers/athena-memory-cron/) summarizes sessions
-- older than 36 hours into compact athena_memory entries, then archives
-- the raw messages. On every Athena invocation, active memory entries for
-- the user are queried and injected into the system prompt as context.

-- ============================================
-- 1. ATHENA SESSIONS
-- ============================================
CREATE TABLE "athena_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "lastMessageAt" TIMESTAMP(3),
    "summary" TEXT,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "modelUsed" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT athena_sessions_pkey PRIMARY KEY (id)
);

CREATE INDEX athena_sessions_userId_idx ON "athena_sessions"("userId");
CREATE INDEX athena_sessions_status_idx ON "athena_sessions"("status");
CREATE INDEX athena_sessions_lastMessageAt_idx ON "athena_sessions"("lastMessageAt");

ALTER TABLE "athena_sessions"
  ADD CONSTRAINT athena_sessions_userId_fkey
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================
-- 2. ATHENA MESSAGES
-- ============================================
CREATE TABLE "athena_messages" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "toolCalls" JSONB,
    "tokensIn" INTEGER,
    "tokensOut" INTEGER,
    "model" TEXT,
    "latencyMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT athena_messages_pkey PRIMARY KEY (id)
);

CREATE INDEX athena_messages_sessionId_createdAt_idx ON "athena_messages"("sessionId", "createdAt");

ALTER TABLE "athena_messages"
  ADD CONSTRAINT athena_messages_sessionId_fkey
  FOREIGN KEY ("sessionId") REFERENCES "athena_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================
-- 3. ATHENA MEMORY (long-term, 36hr TTL)
-- ============================================
CREATE TABLE "athena_memory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT,
    "kind" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "timesRecalled" INTEGER NOT NULL DEFAULT 0,
    "lastRecalledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archived" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT athena_memory_pkey PRIMARY KEY (id)
);

CREATE INDEX athena_memory_userId_archived_expiresAt_idx ON "athena_memory"("userId", "archived", "expiresAt");
CREATE INDEX athena_memory_kind_idx ON "athena_memory"("kind");
CREATE INDEX athena_memory_sessionId_idx ON "athena_memory"("sessionId");

ALTER TABLE "athena_memory"
  ADD CONSTRAINT athena_memory_userId_fkey
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "athena_memory"
  ADD CONSTRAINT athena_memory_sessionId_fkey
  FOREIGN KEY ("sessionId") REFERENCES "athena_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================
-- 4. ATHENA PERSONALITY (DB-driven, editable without redeploy)
-- ============================================
CREATE TABLE "athena_personalities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "systemPrompt" TEXT NOT NULL,
    "voiceId" TEXT,
    "reasoningEffort" TEXT NOT NULL DEFAULT 'high',
    "maxTokens" INTEGER NOT NULL DEFAULT 8192,
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT athena_personalities_pkey PRIMARY KEY (id),
    CONSTRAINT athena_personalities_name_key UNIQUE (name)
);

-- ============================================
-- SEED: Default personality (founder-focused)
-- ============================================
-- This seeds the "default" personality row. The system prompt is intentionally
-- focused on founder coaching since this platform currently serves a single
-- founder (morphylee22@gmail.com). Editable via UPDATE on this row.
INSERT INTO "athena_personalities" ("id", "name", "systemPrompt", "reasoningEffort", "maxTokens", "temperature", "enabled", "updatedAt", "createdAt")
VALUES (
  'athena-personality-default',
  'default',
  'You are Athena, an adaptive AI cofounder and pitch coach. You have been equipped with vision (you can analyze images, PDFs, decks), web search, voice synthesis, and tool use (you can call db_query, web_fetch, github_read_file, etc. via MCP). You are the final moat of the PitchCoach Ai platform — your differentiation is that you are adaptive and learn from every interaction. You retain context of past sessions via the memory layer injected above. You always engage the user in voice unless they explicitly ask for text-only. You take real-world actions via tool calls when needed. Your tone is direct, sharp, founder-to-founder. You challenge weak pitches. You reward specificity. You push for clarity. You are not a generic chatbot — you are Athena.',
  'maximum',
  16384,
  0.7,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

SELECT 'athena memory layer created + default personality seeded' AS status;

-- ============================================
-- 5. PURGE AUDIT LOG (added to same migration)
-- ============================================
-- One row per cron-triggered purge run. The athena-memory-cron worker
-- inserts a row here after each hourly purge cycle.

CREATE TABLE "purge_audit_log" (
    "id" TEXT NOT NULL,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "messagesDeleted" INTEGER NOT NULL DEFAULT 0,
    "sessionsDeleted" INTEGER NOT NULL DEFAULT 0,
    "memoriesDeleted" INTEGER NOT NULL DEFAULT 0,
    "r2Scanned" INTEGER NOT NULL DEFAULT 0,
    "r2Deleted" INTEGER NOT NULL DEFAULT 0,
    "r2Errors" JSONB,
    "details" JSONB,

    CONSTRAINT purge_audit_log_pkey PRIMARY KEY (id)
);

CREATE INDEX purge_audit_log_runAt_idx ON "purge_audit_log"("runAt");

SELECT 'purge audit log table created' AS status;
