-- Athena D1 schema (pitchcoach-athena-d1)
-- All CREATE TABLE IF NOT EXISTS — safe to re-run.
-- Aligned with the Athena Engine Specification (4-pass pipeline, tool registry,
-- contradiction audit, 7-axis scoring, session/prompt logs).

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  readiness_score REAL,
  memo TEXT,
  tier TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS memory_facts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  fact TEXT NOT NULL,
  value TEXT,
  source TEXT,
  unit TEXT,
  denominator TEXT,
  observed_vs_reported TEXT,
  confidence TEXT,
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
  pass TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS discrepancies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  claim_a TEXT NOT NULL,
  claim_b TEXT NOT NULL,
  variance TEXT,
  likely_explanation TEXT,
  materiality TEXT,
  resolution_question TEXT,
  severity TEXT NOT NULL DEFAULT 'medium',
  resolved INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS readiness_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  axis TEXT NOT NULL,
  score REAL NOT NULL,
  evidence TEXT,
  missing_evidence TEXT,
  contradiction_flags TEXT,
  downside_case TEXT,
  follow_up_question TEXT,
  gaps TEXT,
  remediation TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Tool execution registry — every tool call logs name, params, status,
-- source refs, timestamp, and whether the result changed the diligence
-- conclusion. Per spec §2.4 Tool execution registry.
CREATE TABLE IF NOT EXISTS tool_executions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  parameters TEXT,
  result_status TEXT,
  result_summary TEXT,
  source_refs TEXT,
  changed_conclusion INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS prompt_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  tier TEXT,
  model TEXT,
  pass TEXT,
  prompt_text TEXT,
  response_text TEXT,
  token_count INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Session behavior tracking — warnings + state for prompt injection,
-- profanity, and deceit signal guards. Per the Athena behavior spec:
-- 1st violation = warning, 2nd = final warning, 3rd = session closed.
CREATE TABLE IF NOT EXISTS session_warnings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  kind TEXT NOT NULL,  -- 'prompt_injection' | 'profanity' | 'deceit_signal'
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS session_state (
  session_id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'closed'
  warning_count INTEGER NOT NULL DEFAULT 0,
  closed_reason TEXT,
  closed_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_facts_session ON memory_facts(session_id);
CREATE INDEX IF NOT EXISTS idx_turns_session ON drill_turns(session_id);
CREATE INDEX IF NOT EXISTS idx_discrepancies_session ON discrepancies(session_id);
CREATE INDEX IF NOT EXISTS idx_readiness_session ON readiness_scores(session_id);
CREATE INDEX IF NOT EXISTS idx_tool_exec_session ON tool_executions(session_id);
CREATE INDEX IF NOT EXISTS idx_prompt_logs_session ON prompt_logs(session_id);

CREATE INDEX IF NOT EXISTS idx_session_warnings_session ON session_warnings(session_id);
