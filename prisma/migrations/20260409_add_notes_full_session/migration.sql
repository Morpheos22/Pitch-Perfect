-- Add notes field to full_pitch_sessions table
ALTER TABLE "full_pitch_sessions" ADD COLUMN "notes" TEXT;

-- Add iteration tracking fields to full_pitch_sessions
ALTER TABLE "full_pitch_sessions" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "full_pitch_sessions" ADD COLUMN "parentFullSessionId" TEXT;

-- Add index on parent_deck_id for pitch_decks (iteration lookup)
CREATE INDEX IF NOT EXISTS "pitch_decks_parentDeckId_idx" ON "pitch_decks" ("parentDeckId");

-- Add index on parentFullSessionId for full_pitch_sessions (iteration lookup)
CREATE INDEX IF NOT EXISTS "full_pitch_sessions_parentFullSessionId_idx" ON "full_pitch_sessions" ("parentFullSessionId");
