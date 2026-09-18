/**
 * Athena memory cron worker.
 *
 * Runs hourly via Cloudflare cron trigger. Each invocation:
 *
 *   1. Summarize stale sessions:
 *      - Find athena_sessions where status='active' AND lastMessageAt < now - 36h
 *      - For each, fetch the last ~50 messages
 *      - Call Z.ai (glm-5.1) to extract: preferences, facts, skills learned,
 *        corrections given, and stated intents
 *      - Insert one row per extracted item into athena_memory (36h TTL)
 *      - Mark session.status='archived' and write the summary into session.summary
 *
 *   2. Purge old data (6-day retention per user spec):
 *      - Delete athena_messages older than 6 days
 *      - Delete athena_sessions older than 6 days where status='archived'
 *      - Delete athena_memory older than 6 days where archived=true
 *
 * The worker uses nodejs_compat so we can use fetch + crypto directly.
 * Connection to Postgres is via the pg driver (replaced by Hyperdrive
 * if/when the user upgrades — see Cloudflare Hyperdrive docs).
 */

interface Env {
  DATABASE_URL: string;
  ZAI_API_KEY: string;
  ZAI_BASE_URL: string;
  ATHENA_SECRET_KEY: string;
  APP_URL: string;
}

const MEMORY_TTL_HOURS = 36;
const DATA_RETENTION_DAYS = 6;
const MAX_SESSIONS_PER_RUN = 20; // Avoid runaway summarization costs

export default {
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(processStaleSessions(env));
    ctx.waitUntil(purgeOldData(env));
  },

  // Also expose an HTTP endpoint so we can manually trigger the cron
  // (useful for testing or emergency re-summarization).
  async fetch(request: Request, env: Env): Promise<Response> {
    // Auth check — require secret header
    const secret = request.headers.get("x-athena-secret");
    if (secret !== env.ATHENA_SECRET_KEY) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { "content-type": "application/json" },
      });
    }

    const url = new URL(request.url);
    if (url.pathname === "/run") {
      const results = await Promise.allSettled([
        processStaleSessions(env),
        purgeOldData(env),
      ]);
      return new Response(
        JSON.stringify({
          status: "completed",
          summarization: results[0].status === "fulfilled" ? results[0].value : { error: String(results[0].reason) },
          purge: results[1].status === "fulfilled" ? results[1].value : { error: String(results[1].reason) },
        }),
        { headers: { "content-type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ ok: true, service: "athena-memory-cron" }), {
      headers: { "content-type": "application/json" },
    });
  },
};

// ── Postgres client (lazy-initialized) ────────────────────────────────────
// We use the `pg` driver directly. Worker supports nodejs_compat.
// For higher scale, switch to Hyperdrive: https://developers.cloudflare.com/hyperdrive/
let pgClient: any = null;

async function getPg(env: Env) {
  if (pgClient) return pgClient;
  const { Client } = await import("pg");
  pgClient = new Client({ connectionString: env.DATABASE_URL });
  await pgClient.connect();
  return pgClient;
}

// ── 1. Summarize stale sessions ──────────────────────────────────────────

interface StaleSession {
  id: string;
  user_id: string;
  started_at: Date;
  last_message_at: Date | null;
}

async function processStaleSessions(env: Env): Promise<{ sessionsSummarized: number; memoriesCreated: number }> {
  const client = await getPg(env);
  const threshold = new Date(Date.now() - MEMORY_TTL_HOURS * 60 * 60 * 1000);

  // Find active sessions that haven't had a message in 36 hours
  const result = await client.query(
    `SELECT id, user_id, started_at, last_message_at
     FROM athena_sessions
     WHERE status = 'active'
       AND (last_message_at IS NOT NULL AND last_message_at < $1
            OR (last_message_at IS NULL AND started_at < $1))
     ORDER BY COALESCE(last_message_at, started_at) ASC
     LIMIT $2`,
    [threshold, MAX_SESSIONS_PER_RUN],
  );

  let memoriesCreated = 0;
  for (const session of result.rows as StaleSession[]) {
    try {
      const newMemories = await summarizeSession(env, client, session);
      memoriesCreated += newMemories;
    } catch (err) {
      console.error(`[athena-cron] summarizeSession failed for ${session.id}:`, err);
    }
  }

  return { sessionsSummarized: result.rowCount, memoriesCreated };
}

async function summarizeSession(env: Env, client: any, session: StaleSession): Promise<number> {
  // Fetch the last 50 messages from this session
  const messagesResult = await client.query(
    `SELECT role, content, created_at
     FROM athena_messages
     WHERE session_id = $1
     ORDER BY created_at DESC
     LIMIT 50`,
    [session.id],
  );
  const messages = messagesResult.rows;
  if (messages.length === 0) {
    // No messages — just mark as archived
    await client.query(
      `UPDATE athena_sessions SET status = 'archived', updated_at = now() WHERE id = $1`,
      [session.id],
    );
    return 0;
  }

  // Build conversation transcript for Z.ai
  const transcript = messages
    .reverse()
    .map((m: { role: string; content: string }) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n\n");

  const summaryPrompt = `You are Athena's memory summarizer. Given the following conversation transcript, extract compact memory entries that will help Athena retain context for this user in future sessions.

Extract entries of these kinds:
- preference: User preferences (e.g., "prefers direct feedback", "wants concise responses")
- fact: Important user facts (e.g., "founder of fintech startup", "raising $500K seed round")
- skill: Skills the user is developing or wants to develop
- correction: Feedback the user gave Athena that should adjust future behavior
- intent: Stated user intentions or goals

Output as JSON: { "memories": [{ "kind": "...", "content": "...", "confidence": 0.0-1.0 }] }

Only extract genuinely useful, specific memories. Skip generic statements. Cap at 10 memories per session.

TRANSCRIPT:
${transcript}`;

  // Call Z.ai for summarization
  const zaiUrl = `${env.ZAI_BASE_URL}/chat/completions`;
  const zaiResponse = await fetch(zaiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${env.ZAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "glm-4.5-flash", // cheap, fast model for summarization
      messages: [{ role: "user", content: summaryPrompt }],
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: "json_object" },
    }),
  });

  if (!zaiResponse.ok) {
    throw new Error(`Z.ai summarization failed: HTTP ${zaiResponse.status}`);
  }

  const zaiJson = await zaiResponse.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = zaiJson.choices?.[0]?.message?.content ?? "";

  // Parse extracted memories
  let memories: Array<{ kind: string; content: string; confidence?: number }>;
  try {
    const parsed = JSON.parse(content) as { memories?: Array<{ kind: string; content: string; confidence?: number }> };
    memories = parsed.memories ?? [];
  } catch {
    console.warn(`[athena-cron] Z.ai returned non-JSON memory output for session ${session.id}`);
    memories = [];
  }

  // Write memories to athena_memory with 36-hour TTL
  const expiresAt = new Date(Date.now() + MEMORY_TTL_HOURS * 60 * 60 * 1000);
  let written = 0;
  for (const m of memories) {
    if (!m.kind || !m.content) continue;
    try {
      await client.query(
        `INSERT INTO athena_memory (id, user_id, session_id, kind, content, confidence, expires_at, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, now())`,
        [
          session.user_id,
          session.id,
          m.kind,
          m.content.slice(0, 1000), // Cap content length
          typeof m.confidence === "number" ? m.confidence : 1.0,
          expiresAt,
        ],
      );
      written++;
    } catch (err) {
      console.error(`[athena-cron] memory insert failed:`, err);
    }
  }

  // Generate a brief session summary (one-line) and mark as archived
  const summaryText = await generateSessionSummary(env, transcript);
  await client.query(
    `UPDATE athena_sessions
     SET status = 'archived',
         summary = $2,
         ended_at = coalesce(ended_at, now()),
         updated_at = now()
     WHERE id = $1`,
    [session.id, summaryText.slice(0, 500)],
  );

  return written;
}

async function generateSessionSummary(env: Env, transcript: string): Promise<string> {
  const zaiUrl = `${env.ZAI_BASE_URL}/chat/completions`;
  try {
    const res = await fetch(zaiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.ZAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "glm-4.5-flash",
        messages: [
          {
            role: "user",
            content: `Summarize this conversation in one sentence (max 200 chars):\n\n${transcript.slice(0, 4000)}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 100,
      }),
    });
    const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    return json.choices?.[0]?.message?.content?.slice(0, 200) ?? "";
  } catch {
    return "";
  }
}

// ── 2. Purge old data (6-day retention) ──────────────────────────────────

async function purgeOldData(env: Env): Promise<{ messagesDeleted: number; sessionsDeleted: number; memoriesDeleted: number; r2Purged: PurgeR2Result | null }> {
  const client = await getPg(env);
  const cutoff = new Date(Date.now() - DATA_RETENTION_DAYS * 24 * 60 * 60 * 1000);

  // Delete athena_messages older than 6 days (cascade will handle session deletes)
  const messagesResult = await client.query(
    `DELETE FROM athena_messages WHERE created_at < $1 RETURNING id`,
    [cutoff],
  );

  // Delete archived sessions older than 6 days
  const sessionsResult = await client.query(
    `DELETE FROM athena_sessions WHERE status = 'archived' AND updated_at < $1 RETURNING id`,
    [cutoff],
  );

  // Delete archived memories older than 6 days (keep non-archived for TTL)
  const memoriesResult = await client.query(
    `DELETE FROM athena_memory WHERE archived = true AND created_at < $1 RETURNING id`,
    [cutoff],
  );

  // ── R2 temp uploads purge ──────────────────────────────────────────────
  // Per user spec: "draft a data storage and purging automation for 6 days"
  // Also purge any R2 objects under the uploads/temp/ prefix older than 6 days.
  // These are abandoned uploads (user uploaded a file but didn't complete the
  // analysis flow — orphaned blobs).
  //
  // NOTE: The Cloudflare Worker can't directly call the Next.js app's R2 helpers.
  // Instead, the Worker issues raw S3-compatible API calls. For now, this is a
  // placeholder that logs intent — the actual R2 purge should be triggered via
  // an HTTP call to /api/admin/purge (a new admin-only route on the main app
  // that uses the proper R2 helpers from src/lib/cloudflare-storage.ts).
  //
  // This is the right architecture: the Worker is the trigger (cron), the app
  // is the executor (has proper R2 credentials + helpers).
  let r2PurgeResult: PurgeR2Result | null = null;
  try {
    const purgeResponse = await fetch(`${env.APP_URL}/api/admin/purge`, {
      method: "POST",
      headers: {
        "x-athena-secret": env.ATHENA_SECRET_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        prefix: "uploads/temp/",
        older_than_days: DATA_RETENTION_DAYS,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (purgeResponse.ok) {
      r2PurgeResult = await purgeResponse.json() as PurgeR2Result;
    } else {
      console.warn(`[athena-cron] R2 purge endpoint returned ${purgeResponse.status}`);
    }
  } catch (err) {
    console.warn("[athena-cron] R2 purge failed:", err instanceof Error ? err.message : err);
  }

  console.log(`[athena-cron] purged: messages=${messagesResult.rowCount}, sessions=${sessionsResult.rowCount}, memories=${memoriesResult.rowCount}, r2_deleted=${r2PurgeResult?.deleted ?? 0}`);

  // ── Audit log ─────────────────────────────────────────────────────────
  // Insert a row into purge_audit_log so there's a permanent record of
  // what was purged when. Useful for forensic + compliance purposes.
  try {
    await client.query(
      `INSERT INTO purge_audit_log (id, run_at, messages_deleted, sessions_deleted, memories_deleted, r2_scanned, r2_deleted, r2_errors, details)
       VALUES (gen_random_uuid(), now(), $1, $2, $3, $4, $5, $6, $7)`,
      [
        messagesResult.rowCount,
        sessionsResult.rowCount,
        memoriesResult.rowCount,
        r2PurgeResult?.scanned ?? 0,
        r2PurgeResult?.deleted ?? 0,
        r2PurgeResult ? JSON.stringify(r2PurgeResult.errors) : null,
        JSON.stringify({ source: "cron", retention_days: DATA_RETENTION_DAYS }),
      ],
    );
  } catch (err) {
    console.warn("[athena-cron] audit log insert failed:", err);
  }

  return {
    messagesDeleted: messagesResult.rowCount,
    sessionsDeleted: sessionsResult.rowCount,
    memoriesDeleted: memoriesResult.rowCount,
    r2Purged: r2PurgeResult,
  };
}

interface PurgeR2Result {
  prefix: string;
  scanned: number;
  deleted: number;
  errors: string[];
}

// Placed at end of file so the type is hoisted properly for both
// the purgeOldData function signature above and any future caller.
