CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', readiness_score REAL, memo TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, completed_at TEXT);
CREATE TABLE IF NOT EXISTS memory_facts (id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL, fact TEXT NOT NULL, source TEXT, verified INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS drill_turns (id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL, axis TEXT, prompt TEXT NOT NULL, answer TEXT, score REAL, feedback TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS discrepancies (id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL, kind TEXT NOT NULL, claim_a TEXT NOT NULL, claim_b TEXT NOT NULL, severity TEXT NOT NULL DEFAULT 'medium', resolved INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_facts_session ON memory_facts(session_id);
CREATE INDEX IF NOT EXISTS idx_turns_session ON drill_turns(session_id);
CREATE INDEX IF NOT EXISTS idx_discrepancies_session ON discrepancies(session_id);
