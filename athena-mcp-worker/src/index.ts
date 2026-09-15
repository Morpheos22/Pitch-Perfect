import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const ALLOWED_REPO = "Morpheos22/Pitch-Perfect";
const ALLOWED_PATHS = [/^src\//, /^athena-mcp-worker\//, /^README\.md$/];
const ALLOWED_TABLES = new Set(["pitch_decks", "pitch_scripts", "usage", "subscriptions"]);
const MAX_LIMIT = 25;

function githubAllowed(owner: string, repo: string, path: string) {
  return `${owner}/${repo}`.toLowerCase() === ALLOWED_REPO.toLowerCase() && ALLOWED_PATHS.some((pattern) => pattern.test(path)) && !path.includes("..") && !path.startsWith("/");
}
async function githubReadFile(owner: string, repo: string, path: string): Promise<string> {
  if (!githubAllowed(owner, repo, path)) return "GitHub read denied: repository or path is not approved.";
  const token = process.env.GITHUB_TOKEN || "";
  if (!token) return "GitHub read unavailable: token is not configured.";
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "athena-mcp/1.0" } });
  if (!res.ok) return `GitHub API error: ${res.status}`;
  const data = await res.json() as { content?: string };
  return data.content ? atob(data.content).slice(0, 8000) : "GitHub response contained no file content.";
}
async function supabaseQuery(table: string, select: string, limit: number, filter?: string): Promise<string> {
  if (!ALLOWED_TABLES.has(table) || !/^[A-Za-z0-9_,.* ]+$/.test(select) || (filter && (!/^[A-Za-z0-9_=.(),&-]+$/.test(filter) || filter.includes(";")))) return "Supabase query denied by allowlist.";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) return "Supabase query unavailable: credentials are not configured.";
  const endpoint = `${url}/rest/v1/${table}?select=${encodeURIComponent(select)}&limit=${Math.min(Math.max(limit, 1), MAX_LIMIT)}${filter ? `&${filter}` : ""}`;
  const res = await fetch(endpoint, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!res.ok) return `Supabase error: ${res.status}`;
  return JSON.stringify(await res.json()).slice(0, 8000);
}
async function webSearch(query: string, num = 5): Promise<string> {
  const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, { headers: { "User-Agent": "athena-mcp/1.0" }, signal: AbortSignal.timeout(15000) });
  const html = await res.text(); const results: string[] = []; let count = 0;
  for (const match of html.matchAll(/class="result__a"[^>]*>(.*?)<\/a>[\s\S]*?class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g)) { if (count++ >= Math.min(num, 10)) break; results.push(`${count}. ${match[1].replace(/<[^>]+>/g, "").trim()}\n   ${match[2].replace(/<[^>]+>/g, "").trim().slice(0, 200)}`); }
  return results.join("\n\n") || `No results for "${query}"`;
}
export class AthenaMCP extends McpAgent {
  server = new McpServer({ name: "athena-mcp", version: "1.0.0" }); private toolsRegistered = false;
  async init() { if (this.toolsRegistered) return; this.toolsRegistered = true;
    this.server.tool("github_read_file", "Read an approved Pitch-Perfect file.", { owner: z.string(), repo: z.string(), path: z.string() }, async ({ owner, repo, path }) => ({ content: [{ type: "text" as const, text: await githubReadFile(owner, repo, path) }] }));
    this.server.tool("db_query", "Query an explicitly allowlisted application table; arbitrary SQL is unavailable.", { table: z.enum(["pitch_decks", "pitch_scripts", "usage", "subscriptions"]), select: z.string().optional(), limit: z.number().int().optional(), filter: z.string().optional() }, async ({ table, select = "*", limit = 10, filter }) => ({ content: [{ type: "text" as const, text: await supabaseQuery(table, select, limit, filter) }] }));
    this.server.tool("web_search", "Search the web for current information.", { query: z.string().min(1).max(500), num: z.number().int().min(1).max(10).optional() }, async ({ query, num = 5 }) => ({ content: [{ type: "text" as const, text: await webSearch(query, num) }] }));
  }
}
const ORIGINS = new Set(["https://pitchcoachai.tech", "http://localhost:3000"]);
function allowedOrigin(origin: string | null) { return !!origin && (ORIGINS.has(origin) || /^https:\/\/[^.]+\.vercel\.app$/.test(origin)); }
function cors(origin: string | null) { const headers: Record<string, string> = { "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, mcp-session-id, x-athena-internal-secret", Vary: "Origin" }; if (allowedOrigin(origin)) headers["Access-Control-Allow-Origin"] = origin!; return headers; }
function authorized(request: Request, origin: string | null) { const secret = process.env.ATHENA_INTERNAL_SECRET; return !!secret && request.headers.get("x-athena-internal-secret") === secret && (!origin || allowedOrigin(origin)); }
export default { async fetch(request: Request, env: any, ctx: ExecutionContext) { const url = new URL(request.url); const origin = request.headers.get("Origin"); const headers = cors(origin); if (request.method === "OPTIONS") return new Response(null, { status: allowedOrigin(origin) ? 204 : 403, headers }); if ((request.method === "POST" || request.method === "GET") && (url.pathname === "/mcp" || url.pathname === "/sse") && !authorized(request, origin)) return new Response("Unauthorized", { status: 401, headers }); if (request.method === "GET" && (url.pathname === "/mcp" || url.pathname === "/sse")) { const h = new Headers(request.headers); h.set("accept", "text/event-stream"); return AthenaMCP.serve("/mcp", { binding: "ATHENA_MCP" }).fetch(new Request(request, { headers: h }), env, ctx); } if (request.method === "POST" && url.pathname === "/mcp") { const response = await AthenaMCP.serve("/mcp", { binding: "ATHENA_MCP" }).fetch(request, env, ctx); const out = new Response(response.body, response); Object.entries(headers).forEach(([k, v]) => out.headers.set(k, v)); return out; } if (url.pathname === "/") return new Response(JSON.stringify({ name: "athena-mcp-server", version: "1.0.0" }), { headers: { "Content-Type": "application/json", ...headers } }); return new Response("Not Found", { status: 404, headers }); } };