/**
 * Athena MCP Server + D1 Activation Seal — Cloudflare Worker
 *
 * This Worker is the ULTIMATE SEAL for Athena's AI service layer activation.
 * It is always-on (cron every 5min + DurableObject), holds auth state in D1,
 * and communicates with all moving parts:
 *
 *   Backend (Vercel) ←→ D1 STATE ←→ Frontend (Widget)
 *                        ↕
 *                    Poke Agent
 *                        ↕
 *                    MCP Tools
 *
 * If any part fails, D1 holds the state and other parts overcompensate.
 *
 * Endpoints:
 *   GET  /health        — Worker health (always 200 if Worker is alive)
 *   GET  /activate/:id  — Check activation state for a user
 *   POST /activate/:id  — Fire activation trigger (primary or fallback)
 *   POST /mcp           — MCP protocol (tools: github_read_file, db_query, web_search)
 *   GET  /              — Server info
 *
 * Cron: every 5min — keeps the Worker warm, checks for stale sessions
 */

import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// ── Tool implementations ──────────────────────────────────────────────────

async function githubReadFile(owner: string, repo: string, path: string): Promise<string> {
  const GITHUB_TOKEN = (globalThis as any).env?.GITHUB_TOKEN || "";
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
    headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: "application/vnd.github+json", "User-Agent": "athena-mcp/1.0" },
  });
  if (!res.ok) return `GitHub error: ${res.status}`;
  const data: any = await res.json();
  return atob(data.content).slice(0, 8000);
}

async function supabaseQuery(table: string, select: string, limit: number, filter?: string): Promise<string> {
  const SUPABASE_URL = (globalThis as any).env?.NEXT_PUBLIC_SUPABASE_URL || "https://iwbshmshegewmctfucaz.supabase.co";
  const SUPABASE_KEY = (globalThis as any).env?.SUPABASE_SERVICE_ROLE_KEY || "";
  let url = `${SUPABASE_URL}/rest/v1/${table}?select=${select}&limit=${limit}`;
  if (filter) url += `&${filter}`;
  const res = await fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
  if (!res.ok) return `DB error: ${res.status}`;
  return JSON.stringify(await res.json(), null, 2).slice(0, 8000);
}

async function webSearch(query: string, num: number = 5): Promise<string> {
  const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
    headers: { "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(15000),
  });
  const html = await res.text();
  const results: string[] = [];
  const matches = html.matchAll(/class="result__a"[^>]*>(.*?)<\/a>[\s\S]*?class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g);
  let count = 0;
  for (const m of matches) {
    if (count >= num) break;
    results.push(`${count + 1}. ${m[1].replace(/<[^>]+>/g, "").trim()}\n   ${m[2].replace(/<[^>]+>/g, "").trim().slice(0, 200)}`);
    count++;
  }
  return results.join("\n\n") || `No results for "${query}"`;
}

// ── McpAgent (DurableObject — holds MCP tools) ────────────────────────────

export class AthenaMCP extends McpAgent {
  server = new McpServer({ name: "athena-mcp", version: "1.0.0" });
  private toolsRegistered = false;

  async init() {
    if (this.toolsRegistered) return;
    this.toolsRegistered = true;

    const GITHUB_TOKEN = (this.env as any)?.GITHUB_TOKEN || "";
    const SUPABASE_URL = (this.env as any)?.NEXT_PUBLIC_SUPABASE_URL || "https://iwbshmshegewmctfucaz.supabase.co";
    const SUPABASE_KEY = (this.env as any)?.SUPABASE_SERVICE_ROLE_KEY || "";

    this.server.tool("github_read_file", "Read a file from any GitHub repository.",
      { owner: z.string(), repo: z.string(), path: z.string() },
      async ({ owner, repo, path }) => {
        const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
          headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: "application/vnd.github+json", "User-Agent": "athena-mcp/1.0" },
        });
        if (!res.ok) return { content: [{ type: "text" as const, text: `GitHub error: ${res.status}` }] };
        const data: any = await res.json();
        return { content: [{ type: "text" as const, text: atob(data.content).slice(0, 8000) }] };
      },
    );

    this.server.tool("db_query", "Query a Supabase table.",
      { table: z.string(), select: z.string().optional(), limit: z.number().optional(), filter: z.string().optional() },
      async ({ table, select = "*", limit = 10, filter }) => {
        let url = `${SUPABASE_URL}/rest/v1/${table}?select=${select}&limit=${limit}`;
        if (filter) url += `&${filter}`;
        const res = await fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
        if (!res.ok) return { content: [{ type: "text" as const, text: `DB error: ${res.status}` }] };
        return { content: [{ type: "text" as const, text: JSON.stringify(await res.json(), null, 2).slice(0, 8000) }] };
      },
    );

    this.server.tool("web_search", "Search the web.",
      { query: z.string(), num: z.number().optional() },
      async ({ query, num = 5 }) => {
        return { content: [{ type: "text" as const, text: await webSearch(query, num) }] };
      },
    );
  }
}

// ── D1 Activation Seal ────────────────────────────────────────────────────
// The D1 database holds the auth state that survives across requests.
// It's the middleman between backend (Vercel) and frontend (widget).

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, mcp-session-id, x-athena-secret",
};

async function initD1(env: any): Promise<void> {
  const db = env.ATHENA_STATE;
  if (!db) return;
  await db.exec(`
    CREATE TABLE IF NOT EXISTS activation_state (
      user_id TEXT PRIMARY KEY,
      clerk_id TEXT,
      email TEXT,
      status TEXT DEFAULT 'standby',
      -- standby | activating | active | stale
      mcp_session_id TEXT,
      poke_warmed INTEGER DEFAULT 0,
      primary_trigger_count INTEGER DEFAULT 0,
      fallback_trigger_count INTEGER DEFAULT 0,
      last_activated_at TEXT,
      last_ping_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `).catch(() => {}); // Table might already exist
}

export default {
  // ── Cron handler — keeps Worker warm + checks for stale sessions ────────
  async scheduled(event: ScheduledEvent, env: any, ctx: ExecutionContext): Promise<void> {
    await initD1(env);
    const db = env.ATHENA_STATE;
    if (!db) return;

    // Mark sessions as stale if >30min since last activation
    await db.exec(`
      UPDATE activation_state
      SET status = 'stale', updated_at = datetime('now')
      WHERE status = 'active'
      AND datetime(last_activated_at) < datetime('now', '-30 minutes');
    `).catch(() => {});

    // Ping Poke to keep agent warm (for any active sessions)
    const active = await db.prepare("SELECT email FROM activation_state WHERE status = 'active' LIMIT 5").all().catch(() => ({ results: [] }));
    const POKE_KEY = env.POKE_API_KEY;
    if (POKE_KEY && active.results?.length) {
      for (const row of active.results) {
        ctx.waitUntil(
          fetch("https://poke.com/api/v1/inbound/api-message", {
            method: "POST",
            headers: { Authorization: `Bearer ${POKE_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ message: `System: Keepalive ping for ${row.email}. Athena still active.` }),
          }).catch(() => {}),
        );
      }
    }
  },

  // ── HTTP handler ───────────────────────────────────────────────────────
  async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    await initD1(env);
    const db = env.ATHENA_STATE;

    // ── Health check (always 200 — Worker is alive) ────────────────────
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok", worker: "athena-mcp-server", d1: !!db }), {
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    // ── Activation endpoints ───────────────────────────────────────────
    // GET /activate/:userId — check activation state
    // POST /activate/:userId — fire trigger (primary or fallback)
    if (url.pathname.startsWith("/activate/")) {
      const userId = url.pathname.split("/activate/")[1];
      if (!userId) return new Response("Missing user ID", { status: 400, headers: CORS_HEADERS });

      if (request.method === "GET") {
        return await handleActivationCheck(db, userId);
      }

      if (request.method === "POST") {
        const body = await request.json().catch(() => ({})) as { email?: string; clerkId?: string; fallback?: boolean };
        return await handleActivationTrigger(db, userId, body, env, ctx);
      }
    }

    // ── MCP protocol (DurableObject) ───────────────────────────────────
    if (request.method === "GET" && (url.pathname === "/mcp" || url.pathname === "/sse")) {
      const headers = new Headers(request.headers);
      if (!headers.get("accept")?.includes("text/event-stream")) headers.set("accept", "text/event-stream");
      return AthenaMCP.serve("/mcp", { binding: "ATHENA_MCP" }).fetch(new Request(request, { headers }), env, ctx);
    }

    if (request.method === "POST" && url.pathname === "/mcp") {
      const response = await AthenaMCP.serve("/mcp", { binding: "ATHENA_MCP" }).fetch(request, env, ctx);
      const newResponse = new Response(response.body, response);
      for (const [k, v] of Object.entries(CORS_HEADERS)) newResponse.headers.set(k, v);
      return newResponse;
    }

    // ── Root ──────────────────────────────────────────────────────────
    if (url.pathname === "/") {
      return new Response(JSON.stringify({
        name: "athena-mcp-server",
        version: "2.0.0",
        role: "D1 Activation Seal + MCP Tool Server",
        alwaysOn: true,
        cron: "*/5 * * * *",
        tools: ["github_read_file", "db_query", "web_search"],
        endpoints: { mcp: "/mcp", activate: "/activate/:userId", health: "/health" },
      }), { headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
    }

    return new Response("Not Found", { status: 404, headers: CORS_HEADERS });
  },
};

// ── D1 Activation Handlers ────────────────────────────────────────────────

async function handleActivationCheck(db: any, userId: string): Promise<Response> {
  if (!db) return jsonResponse({ activated: false, status: "standby", message: "D1 not available" });

  const row = await db.prepare("SELECT * FROM activation_state WHERE user_id = ?").bind(userId).first().catch(() => null);

  if (!row) {
    return jsonResponse({ activated: false, status: "standby", message: "No activation record. Awaiting trigger." });
  }

  // Check for staleness (>30min)
  const lastActive = row.last_activated_at ? new Date(row.last_activated_at + "Z") : null;
  const isStale = !lastActive || Date.now() - lastActive.getTime() > 30 * 60 * 1000;

  return jsonResponse({
    activated: row.status === "active" && !isStale,
    status: isStale ? "stale" : row.status,
    sessionId: row.mcp_session_id,
    provider: row.poke_warmed ? "poke" : "cloudflare",
    primaryTriggers: row.primary_trigger_count,
    fallbackTriggers: row.fallback_trigger_count,
    lastActivatedAt: row.last_activated_at,
  });
}

async function handleActivationTrigger(db: any, userId: string, body: { email?: string; clerkId?: string; fallback?: boolean }, env: any, ctx: ExecutionContext): Promise<Response> {
  const isFallback = body.fallback === true;
  const triggerColumn = isFallback ? "fallback_trigger_count" : "primary_trigger_count";

  // Upsert activation record
  await db.prepare(`
    INSERT INTO activation_state (user_id, clerk_id, email, status, ${triggerColumn}, last_ping_at, updated_at)
    VALUES (?, ?, ?, 'activating', 1, datetime('now'), datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET
      status = 'activating',
      ${triggerColumn} = ${triggerColumn} + 1,
      last_ping_at = datetime('now'),
      updated_at = datetime('now'),
      clerk_id = COALESCE(excluded.clerk_id, activation_state.clerk_id),
      email = COALESCE(excluded.email, activation_state.email)
  `).bind(userId, body.clerkId || null, body.email || null).run().catch(() => {});

  // Fire three parallel tasks (primary + fallback overcompensate)
  const tasks: Promise<void>[] = [];
  let mcpSession: string | null = null;
  let pokeWarmed = false;

  // 1. Poke API — primary or fallback trigger to AI model
  const POKE_KEY = env.POKE_API_KEY;
  if (POKE_KEY && body.email) {
    tasks.push(
      fetch("https://poke.com/api/v1/inbound/api-message", {
        method: "POST",
        headers: { Authorization: `Bearer ${POKE_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `System: ${isFallback ? "FALLBACK" : "PRIMARY"} trigger for ${body.email}. Dashboard authenticated. Activate AI model. Use db_query for their Supabase data.`,
        }),
      }).then(() => { pokeWarmed = true; }).catch(() => {}),
    );
  }

  // 2. MCP DurableObject — initialize + capture session
  tasks.push(
    fetch("https://athena-mcp-server.morphylee22.workers.dev/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "initialize", params: { protocolVersion: "2025-01-01", capabilities: {}, clientInfo: { name: isFallback ? "fallback" : "primary", version: "2.0" } }, id: 1 }),
    }).then(async (res) => {
      mcpSession = res.headers.get("mcp-session-id");
    }).catch(() => {}),
  );

  // 3. Preload endpoint (if we have the secret)
  const ATHENA_SECRET = env.ATHENA_SECRET_KEY;
  if (ATHENA_SECRET) {
    tasks.push(
      fetch("https://pitchcoachai.tech/api/athena/preload", {
        method: "POST",
        headers: { Authorization: `Bearer ${ATHENA_SECRET}` },
      }).then(() => {}).catch(() => {}),
    );
  }

  // Wait for all tasks (max 5s) — both primary and fallback fire in parallel
  await Promise.race([
    Promise.allSettled(tasks),
    new Promise(resolve => setTimeout(resolve, 5000)),
  ]);

  // Mark as active in D1
  await db.prepare(`
    UPDATE activation_state
    SET status = 'active',
        mcp_session_id = ?,
        poke_warmed = ?,
        last_activated_at = datetime('now'),
        updated_at = datetime('now')
    WHERE user_id = ?
  `).bind(mcpSession, pokeWarmed ? 1 : 0, userId).run().catch(() => {});

  // Also update Supabase (for the Vercel side to read)
  const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || "https://iwbshmshegewmctfucaz.supabase.co";
  const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
  if (SUPABASE_KEY) {
    ctx.waitUntil(
      fetch(`${SUPABASE_URL}/rest/v1/ai_service_health?user_id=eq.${userId}`, {
        method: "PATCH",
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ status: "warm", "warmedAt": new Date().toISOString(), "updatedAt": new Date().toISOString() }),
      }).catch(() => {}),
    );
  }

  return jsonResponse({
    activated: true,
    status: "active",
    sessionId: mcpSession,
    provider: pokeWarmed ? "poke" : "cloudflare",
    source: isFallback ? "fallback" : "primary",
    primaryTriggers: (await db.prepare(`SELECT primary_trigger_count FROM activation_state WHERE user_id = ?`).bind(userId).first().catch(() => ({})))?.primary_trigger_count || 1,
    fallbackTriggers: (await db.prepare(`SELECT fallback_trigger_count FROM activation_state WHERE user_id = ?`).bind(userId).first().catch(() => ({})))?.fallback_trigger_count || 0,
  });
}

function jsonResponse(data: any): Response {
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}
