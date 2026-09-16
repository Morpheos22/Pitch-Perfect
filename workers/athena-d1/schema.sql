-- Athena D1 schema (pitchcoach-athena-d1)
-- All CREATE TABLE IF NOT EXISTS — safe to re-run.
-- Updated to align with src/index.ts tool calls.

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  readiness_score REAL,
  memo TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS memory_facts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  fact TEXT NOT NULL,
  source TEXT,
  verified INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS drill_turns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  axis TEXT,
  prompt TEXT NOT NULL,
  answer TEXT,
  score REAL,
  feedback TEXT,
  tier TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Add tier column to existing drill_turns table (additive, idempotent)
-- Run separately because CREATE TABLE IF NOT EXISTS won't add columns to existing tables.
-- Safe to ignore if the column already exists.

CREATE TABLE IF NOT EXISTS discrepancies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  claim_a TEXT NOT NULL,
  claim_b TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  resolved INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS readiness_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  axis TEXT NOT NULL,
  score REAL NOT NULL,
  gaps TEXT,
  remediation TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_facts_session ON memory_facts(session_id);
CREATE INDEX IF NOT EXISTS idx_turns_session ON drill_turns(session_id);
CREATE INDEX IF NOT EXISTS idx_discrepancies_session ON discrepancies(session_id);
CREATE INDEX IF NOT EXISTS idx_readiness_session ON readiness_scores(session_id);
