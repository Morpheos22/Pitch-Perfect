/**
 * Athena MCP Server — Cloudflare Worker
 *
 * Fixed McpAgent transport: uses AthenaMCP.serve() pattern with CORS,
 * SSE header injection, and explicit transport mapping.
 *
 * Connect from Poke:
 *   npx poke@latest mcp add https://athena-mcp-server.morphylee22.workers.dev/mcp -n "Athena MCP"
 */

import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// ── Tool implementations ──────────────────────────────────────────────────

async function githubReadFile(owner: string, repo: string, path: string): Promise<string> {
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
    headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: "application/vnd.github+json", "User-Agent": "athena-mcp/1.0" },
  });
  if (!res.ok) return `GitHub API error: ${res.status}`;
  const data: any = await res.json();
  return atob(data.content).slice(0, 8000);
}

async function supabaseQuery(table: string, select: string, limit: number, filter?: string): Promise<string> {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  let url = `${SUPABASE_URL}/rest/v1/${table}?select=${select}&limit=${limit}`;
  if (filter) url += `&${filter}`;
  const res = await fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
  if (!res.ok) return `Supabase error: ${res.status}`;
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

// ── McpAgent ──────────────────────────────────────────────────────────────

export class AthenaMCP extends McpAgent {
  server = new McpServer({ name: "athena-mcp", version: "1.0.0" });
  private toolsRegistered = false;

  async init() {
    if (this.toolsRegistered) return;
    this.toolsRegistered = true;

    this.server.tool(
      "github_read_file",
      "Read a file from any GitHub repository.",
      { owner: z.string(), repo: z.string(), path: z.string() },
      async ({ owner, repo, path }) => {
        return { content: [{ type: "text" as const, text: await githubReadFile(owner, repo, path) }] };
      },
    );

    this.server.tool(
      "db_query",
      "Query a Supabase table. Tables: pitch_decks, pitch_scripts, usage, subscriptions.",
      { table: z.string(), select: z.string().optional(), limit: z.number().optional(), filter: z.string().optional() },
      async ({ table, select = "*", limit = 10, filter }) => {
        return { content: [{ type: "text" as const, text: await supabaseQuery(table, select, limit, filter) }] };
      },
    );

    this.server.tool(
      "web_search",
      "Search the web for current information.",
      { query: z.string(), num: z.number().optional() },
      async ({ query, num = 5 }) => {
        return { content: [{ type: "text" as const, text: await webSearch(query, num) }] };
      },
    );
  }
}

// ── Worker entry point ──────────────────────────────────────────────────
// Uses AthenaMCP.serve() pattern with CORS + SSE header injection.
// This fixes the "Invalid transport type" error by ensuring requests
// are routed through the McpAgent's serve() method which handles
// protocol negotiation (SSE + Streamable HTTP).

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, mcp-session-id",
};

export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    // For GET requests to /mcp or /sse, ensure Accept: text/event-stream
    if (request.method === "GET" && (url.pathname === "/mcp" || url.pathname === "/sse")) {
      const headers = new Headers(request.headers);
      if (!headers.get("accept")?.includes("text/event-stream")) {
        headers.set("accept", "text/event-stream");
      }
      const sseRequest = new Request(request, { headers });
      // Use AthenaMCP.serve() with correct binding name (default is "MCP_OBJECT")
      return AthenaMCP.serve("/mcp", { binding: "ATHENA_MCP" }).fetch(sseRequest, env, ctx);
    }

    // POST requests with JSON-RPC payloads
    if (request.method === "POST" && url.pathname === "/mcp") {
      const response = await AthenaMCP.serve("/mcp", { binding: "ATHENA_MCP" }).fetch(request, env, ctx);
      // Add CORS headers to the response
      const newResponse = new Response(response.body, response);
      for (const [k, v] of Object.entries(CORS_HEADERS)) {
        newResponse.headers.set(k, v);
      }
      return newResponse;
    }

    // Root path — return server info
    if (url.pathname === "/") {
      return new Response(JSON.stringify({
        name: "athena-mcp-server",
        version: "1.0.0",
        tools: ["github_read_file", "db_query", "web_search"],
        endpoints: {
          mcp: "/mcp",
          sse: "/sse",
        },
      }), {
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    return new Response("Not Found", { status: 404, headers: CORS_HEADERS });
  },
};
