/**
 * Athena MCP Client — connects Athena to external tools via MCP + direct API wrappers.
 *
 * Session 1: Supabase MCP + GitHub direct API wrapper.
 *
 * SECURITY: All credentials are read from process.env. NEVER hardcoded.
 * The access token is NOT stored in this file — it's in .env.local (gitignored)
 * and Vercel env vars (encrypted).
 *
 * Architecture:
 *   - Supabase MCP: connects to https://mcp.supabase.com/mcp (remote MCP server)
 *   - GitHub: direct REST API wrapper (not MCP — the GitHub MCP server requires
 *     OAuth 2.1 + PKCE which needs an interactive browser flow we can't do server-side)
 *
 * The MCP SDK (@modelcontextprotocol/sdk) handles the protocol handshake.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

// ── Env vars (NEVER hardcoded — read at runtime) ──────────────────────────
const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN || "";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const SUPABASE_PROJECT_REF = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/https:\/\/|.supabase\.co.*/, "") || "iwbshmshegewmctfucaz";
// Correct Supabase MCP URL with project_ref + features (this was the bug —
// without these query params, the MCP server returns 0 tools)
const SUPABASE_MCP_URL = `https://mcp.supabase.com/mcp?project_ref=${SUPABASE_PROJECT_REF}&features=docs%2Caccount%2Cdatabase%2Cdebugging%2Cdevelopment%2Cfunctions%2Cbranching`;

// ── Tool cache (refresh every hour) ────────────────────────────────────────
let supabaseClient: Client | null = null;
let supabaseToolsCache: Tool[] | null = null;
let supabaseToolsCachedAt = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// ── Types ──────────────────────────────────────────────────────────────────
export interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  /** Which backend handles this tool */
  backend: "supabase-mcp" | "github-api" | "agent-browser" | "cloudflare-mcp";
}

export interface ToolCallResult {
  content: string;
  isError?: boolean;
}

// ── Supabase MCP client ───────────────────────────────────────────────────

async function getSupabaseClient(): Promise<Client | null> {
  if (!SUPABASE_ACCESS_TOKEN) {
    console.warn("[athena-mcp] SUPABASE_ACCESS_TOKEN not configured — Supabase tools unavailable");
    return null;
  }

  if (supabaseClient) return supabaseClient;

  try {
    const transport = new StreamableHTTPClientTransport(new URL(SUPABASE_MCP_URL));
    const client = new Client(
      { name: "athena-agent", version: "1.0.0" },
      { capabilities: {} },
    );

    await client.connect(transport);
    supabaseClient = client;
    console.log("[athena-mcp] Connected to Supabase MCP server");
    return client;
  } catch (err) {
    console.error("[athena-mcp] Failed to connect to Supabase MCP:", err);
    return null;
  }
}

async function getSupabaseTools(): Promise<Tool[]> {
  // Return cached if fresh
  if (supabaseToolsCache && Date.now() - supabaseToolsCachedAt < CACHE_TTL_MS) {
    return supabaseToolsCache;
  }

  const client = await getSupabaseClient();
  if (!client) return [];

  try {
    const toolsResponse = await client.listTools();
    const tools: Tool[] = (toolsResponse.tools || []).map((t: any) => ({
      name: `supabase_${t.name}`,
      description: t.description || `Supabase tool: ${t.name}`,
      inputSchema: t.inputSchema || {},
      backend: "supabase-mcp" as const,
    }));

    supabaseToolsCache = tools;
    supabaseToolsCachedAt = Date.now();
    console.log(`[athena-mcp] Discovered ${tools.length} Supabase tools`);
    return tools;
  } catch (err) {
    console.error("[athena-mcp] Failed to list Supabase tools:", err);
    return [];
  }
}

async function callSupabaseTool(originalName: string, args: Record<string, unknown>): Promise<ToolCallResult> {
  const client = await getSupabaseClient();
  if (!client) {
    return { content: "Supabase MCP not available — access token not configured.", isError: true };
  }

  try {
    const result = await client.callTool({ name: originalName, arguments: args });
    const contentArray = Array.isArray(result.content) ? result.content : [];
    const textContent = contentArray
      .filter((c: any) => c.type === "text")
      .map((c: any) => c.text)
      .join("\n");
    return { content: textContent || "No output from tool." };
  } catch (err) {
    return {
      content: `Supabase tool '${originalName}' failed: ${err instanceof Error ? err.message : String(err)}`,
      isError: true,
    };
  }
}

// ── Cloudflare MCP client ─────────────────────────────────────────────────
// Cloudflare's own MCP servers — native to our stack. These let Athena:
//   - Observability: query logs, metrics, traces for Cloudflare Workers
//   - Workers Builds: manage and inspect builds
//   - Bindings: access KV, R2, D1 bindings
//
// Auth: uses the Cloudflare API token (CLOUDFLARE_AI_TOKEN or CF_API_TOKEN).
// These servers use OAuth, but the API token works as a bearer token for
// server-side MCP connections.

const CF_API_TOKEN = process.env.CLOUDFLARE_AI_TOKEN || process.env.CF_API_TOKEN || "";
const CF_MCP_SERVERS = [
  { name: "observability", url: "https://observability.mcp.cloudflare.com/mcp" },
  { name: "builds", url: "https://builds.mcp.cloudflare.com/mcp" },
  { name: "bindings", url: "https://bindings.mcp.cloudflare.com/mcp" },
];

const cfMcpClients: Map<string, Client> = new Map();
let cfToolsCache: Tool[] | null = null;
let cfToolsCachedAt = 0;

async function getCloudflareMcpClient(serverName: string, serverUrl: string): Promise<Client | null> {
  if (cfMcpClients.has(serverName)) return cfMcpClients.get(serverName)!;

  try {
    const transport = new StreamableHTTPClientTransport(new URL(serverUrl));
    const client = new Client(
      { name: "athena-agent", version: "1.0.0" },
      { capabilities: {} },
    );
    await client.connect(transport);
    cfMcpClients.set(serverName, client);
    console.log(`[athena-mcp] Connected to Cloudflare ${serverName} MCP server`);
    return client;
  } catch (err) {
    console.error(`[athena-mcp] Failed to connect to Cloudflare ${serverName} MCP:`, err);
    return null;
  }
}

async function getCloudflareTools(): Promise<Tool[]> {
  if (cfToolsCache && Date.now() - cfToolsCachedAt < CACHE_TTL_MS) {
    return cfToolsCache;
  }

  if (!CF_API_TOKEN) {
    console.warn("[athena-mcp] CF_API_TOKEN not configured — Cloudflare MCP tools unavailable");
    return [];
  }

  const allTools: Tool[] = [];
  for (const server of CF_MCP_SERVERS) {
    const client = await getCloudflareMcpClient(server.name, server.url);
    if (!client) continue;

    try {
      const toolsResponse = await client.listTools();
      const tools: Tool[] = (toolsResponse.tools || []).map((t: any) => ({
        name: `cf_${server.name}_${t.name}`,
        description: `[Cloudflare ${server.name}] ${t.description || t.name}`,
        inputSchema: t.inputSchema || {},
        backend: "cloudflare-mcp" as const,
      }));
      allTools.push(...tools);
    } catch (err) {
      console.error(`[athena-mcp] Failed to list Cloudflare ${server.name} tools:`, err);
    }
  }

  cfToolsCache = allTools;
  cfToolsCachedAt = Date.now();
  console.log(`[athena-mcp] Discovered ${allTools.length} Cloudflare MCP tools`);
  return allTools;
}

async function callCloudflareMcpTool(prefixedName: string, args: Record<string, unknown>): Promise<ToolCallResult> {
  // Tool name format: cf_{serverName}_{originalToolName}
  // e.g., cf_observability_query_logs -> server="observability", tool="query_logs"
  const match = prefixedName.match(/^cf_([a-z]+)_(.+)$/);
  if (!match) {
    return { content: `Invalid Cloudflare tool name: ${prefixedName}`, isError: true };
  }
  const [, serverName, originalName] = match;
  const client = cfMcpClients.get(serverName);
  if (!client) {
    return { content: `Cloudflare ${serverName} MCP not connected`, isError: true };
  }

  try {
    const result = await client.callTool({ name: originalName, arguments: args });
    const contentArray = Array.isArray(result.content) ? result.content : [];
    const textContent = contentArray
      .filter((c: any) => c.type === "text")
      .map((c: any) => c.text)
      .join("\n");
    return { content: textContent || "No output from tool." };
  } catch (err) {
    return {
      content: `Cloudflare ${serverName} tool '${originalName}' failed: ${err instanceof Error ? err.message : String(err)}`,
      isError: true,
    };
  }
}

// ── Athena's own MCP server (Cloudflare Worker) ──────────────────────────
// This is our OWN MCP server deployed at:
//   https://athena-mcp-server.morphylee22.workers.dev/mcp
// It exposes tools: github_read_file, github_get_repo_info, github_list_issues,
// db_query, db_get_user_summary, web_search
//
// No OAuth needed — we control the server. The tools call GitHub API and
// Supabase REST API directly using env vars set on the Worker.

const ATHENA_MCP_URL = "https://athena-mcp-server.morphylee22.workers.dev/mcp";
let athenaMcpClient: Client | null = null;
let athenaToolsCache: Tool[] | null = null;
let athenaToolsCachedAt = 0;

async function getAthenaMcpClient(): Promise<Client | null> {
  if (athenaMcpClient) return athenaMcpClient;

  try {
    const transport = new StreamableHTTPClientTransport(new URL(ATHENA_MCP_URL));
    const client = new Client(
      { name: "athena-agent", version: "1.0.0" },
      { capabilities: {} },
    );
    await client.connect(transport);
    athenaMcpClient = client;
    console.log("[athena-mcp] Connected to Athena MCP server (our own Worker)");
    return client;
  } catch (err) {
    console.error("[athena-mcp] Failed to connect to Athena MCP server:", err);
    return null;
  }
}

async function getAthenaTools(): Promise<Tool[]> {
  if (athenaToolsCache && Date.now() - athenaToolsCachedAt < CACHE_TTL_MS) {
    return athenaToolsCache;
  }

  const client = await getAthenaMcpClient();
  if (!client) return [];

  try {
    const toolsResponse = await client.listTools();
    const tools: Tool[] = (toolsResponse.tools || []).map((t: any) => ({
      name: t.name, // No prefix — these are OUR tools, no collision risk
      description: t.description || t.name,
      inputSchema: t.inputSchema || {},
      backend: "cloudflare-mcp" as const,
    }));

    athenaToolsCache = tools;
    athenaToolsCachedAt = Date.now();
    console.log(`[athena-mcp] Discovered ${tools.length} tools from Athena MCP server`);
    return tools;
  } catch (err) {
    console.error("[athena-mcp] Failed to list Athena MCP tools:", err);
    return [];
  }
}

async function callAthenaMcpTool(toolName: string, args: Record<string, unknown>): Promise<ToolCallResult> {
  const client = await getAthenaMcpClient();
  if (!client) {
    return { content: "Athena MCP server not connected", isError: true };
  }

  try {
    const result = await client.callTool({ name: toolName, arguments: args });
    const contentArray = Array.isArray(result.content) ? result.content : [];
    const textContent = contentArray
      .filter((c: any) => c.type === "text")
      .map((c: any) => c.text)
      .join("\n");
    return { content: textContent || "No output from tool." };
  } catch (err) {
    return {
      content: `Athena MCP tool '${toolName}' failed: ${err instanceof Error ? err.message : String(err)}`,
      isError: true,
    };
  }
}

// ── GitHub direct API wrapper ──────────────────────────────────────────────
// We use the GitHub REST API directly instead of the GitHub MCP server because
// the remote MCP server requires OAuth 2.1 + PKCE (interactive browser flow).

const GITHUB_API = "https://api.github.com";

// ── Supabase direct query tools (via Prisma — no MCP, no OAuth) ────────────
// These tools query the Supabase database directly using Prisma, which is
// already configured with DATABASE_URL. No MCP protocol needed — just
// direct database queries wrapped as function-calling tools.

import { prisma } from "@/lib/db";

const supabaseDirectTools: Tool[] = [
  {
    name: "db_get_user_decks",
    description: "Get the current user's pitch deck analysis sessions — scores, file names, dates. Use this when the user asks about their deck scores or analysis history.",
    inputSchema: {
      type: "object",
      properties: {
        userId: { type: "string", description: "Internal user ID (from the user sync API)" },
        limit: { type: "number", description: "Max results (default 5, max 20)" },
      },
      required: ["userId"],
    },
    backend: "supabase-direct" as any,
  },
  {
    name: "db_get_user_scripts",
    description: "Get the user's script check sessions — scores, file names, dates. Use when the user asks about their elevator pitch scripts.",
    inputSchema: {
      type: "object",
      properties: {
        userId: { type: "string", description: "Internal user ID" },
        limit: { type: "number", description: "Max results (default 5, max 20)" },
      },
      required: ["userId"],
    },
    backend: "supabase-direct" as any,
  },
  {
    name: "db_get_user_usage",
    description: "Get the user's current usage — how many deck analyses, script sessions, live sessions they've used and their limits. Use when the user asks about their remaining sessions or plan limits.",
    inputSchema: {
      type: "object",
      properties: {
        userId: { type: "string", description: "Internal user ID" },
      },
      required: ["userId"],
    },
    backend: "supabase-direct" as any,
  },
  {
    name: "db_get_user_subscription",
    description: "Get the user's subscription details — plan, status, credits, billing period. Use when the user asks about their plan, billing, or subscription status.",
    inputSchema: {
      type: "object",
      properties: {
        userId: { type: "string", description: "Internal user ID" },
      },
      required: ["userId"],
    },
    backend: "supabase-direct" as any,
  },
];

async function callSupabaseDirectTool(toolName: string, args: Record<string, unknown>): Promise<ToolCallResult> {
  try {
    if (toolName === "db_get_user_decks") {
      const userId = args.userId as string;
      const limit = Math.min((args.limit as number) || 5, 20);
      const decks = await prisma.pitchDeck.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: limit,
        select: { id: true, fileName: true, overallScore: true, status: true, createdAt: true },
      });
      if (decks.length === 0) return { content: "No pitch deck analyses found." };
      const formatted = decks.map(d => `${d.fileName}: score=${d.overallScore ?? "pending"}, status=${d.status}, date=${new Date(d.createdAt).toLocaleDateString()}`).join("\n");
      return { content: `Found ${decks.length} deck(s):\n${formatted}` };
    }

    if (toolName === "db_get_user_scripts") {
      const userId = args.userId as string;
      const limit = Math.min((args.limit as number) || 5, 20);
      const scripts = await prisma.pitchScript.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: limit,
        select: { id: true, fileName: true, overallScore: true, status: true, createdAt: true },
      });
      if (scripts.length === 0) return { content: "No script check sessions found." };
      const formatted = scripts.map(s => `${s.fileName}: score=${s.overallScore ?? "pending"}, status=${s.status}, date=${new Date(s.createdAt).toLocaleDateString()}`).join("\n");
      return { content: `Found ${scripts.length} script(s):\n${formatted}` };
    }

    if (toolName === "db_get_user_usage") {
      const userId = args.userId as string;
      const usage = await prisma.usage.findUnique({
        where: { userId },
        select: { e1DeckAnalyses: true, e2ScriptCoachSessions: true, e3LivePitchSessions: true, e4FullPitchSessions: true, e5FounderSessions: true },
      });
      if (!usage) return { content: "No usage data found." };
      return { content: `Usage: Deck analyses=${usage.e1DeckAnalyses}, Script sessions=${usage.e2ScriptCoachSessions}, Live sessions=${usage.e3LivePitchSessions}, Full sessions=${usage.e4FullPitchSessions}, Founder sessions=${usage.e5FounderSessions}` };
    }

    if (toolName === "db_get_user_subscription") {
      const userId = args.userId as string;
      const sub = await prisma.subscription.findUnique({
        where: { userId },
        select: { plan: true, status: true, creditsRemaining: true, creditsUsed: true, currentPeriodEnd: true, cancelAtPeriodEnd: true },
      });
      if (!sub) return { content: "No subscription found." };
      return { content: `Plan: ${sub.plan}, Status: ${sub.status}, Credits: ${sub.creditsRemaining} remaining / ${sub.creditsUsed} used, Period ends: ${sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString() : "N/A"}, Cancel at period end: ${sub.cancelAtPeriodEnd}` };
    }

    return { content: `Unknown DB tool: ${toolName}`, isError: true };
  } catch (err) {
    return { content: `DB tool '${toolName}' failed: ${err instanceof Error ? err.message : String(err)}`, isError: true };
  }
}

const githubTools: Tool[] = [
  {
    name: "github_read_file",
    description: "Read a file from a GitHub repository. Returns the file content. Use this when the user asks about code, README, or file contents in a repo.",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repository owner (e.g., 'Morpheos22')" },
        repo: { type: "string", description: "Repository name (e.g., 'Pitch-Perfect')" },
        path: { type: "string", description: "File path (e.g., 'README.md', 'src/lib/athena-agent.ts')" },
      },
      required: ["owner", "repo", "path"],
    },
    backend: "github-api",
  },
  {
    name: "github_list_issues",
    description: "List open issues in a GitHub repository. Returns issue numbers, titles, and labels.",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repository owner" },
        repo: { type: "string", description: "Repository name" },
        limit: { type: "number", description: "Max issues to return (default 10, max 30)" },
      },
      required: ["owner", "repo"],
    },
    backend: "github-api",
  },
  {
    name: "github_get_repo_info",
    description: "Get metadata about a GitHub repository — description, stars, language, default branch.",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repository owner" },
        repo: { type: "string", description: "Repository name" },
      },
      required: ["owner", "repo"],
    },
    backend: "github-api",
  },
];

// ── Web fetch tool (works on Vercel — no headless browser needed) ──────────
const webFetchTool: Tool = {
  name: "web_fetch",
  description: "Fetch the text content of a web page. Use this when the user asks to check a website, read a page, or get content from a URL.",
  inputSchema: {
    type: "object",
    properties: {
      url: { type: "string", description: "The URL to fetch (e.g., 'https://example.com')" },
    },
    required: ["url"],
  },
  backend: "github-api" as any, // reuse the "direct" backend type
};

// Removed browser tools (agent-browser CLI) — they don't work on Vercel
// serverless functions. Replaced with web_fetch which uses fetch().

async function callGithubTool(toolName: string, args: Record<string, unknown>): Promise<ToolCallResult> {
  if (!GITHUB_TOKEN) {
    return { content: "GitHub token not configured — GitHub tools unavailable.", isError: true };
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "athena-agent/1.0",
  };

  try {
    if (toolName === "github_read_file") {
      const { owner, repo, path } = args as { owner: string; repo: string; path: string };
      const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/${path}`;
      const res = await fetch(url, { headers });
      if (!res.ok) return { content: `GitHub API error: ${res.status} ${res.statusText}`, isError: true };
      const data = await res.json();
      // GitHub returns file content as base64
      const content = Buffer.from(data.content, "base64").toString("utf-8");
      return { content: content.slice(0, 4000) }; // Truncate to fit in context
    }

    if (toolName === "github_list_issues") {
      const { owner, repo, limit = 10 } = args as { owner: string; repo: string; limit?: number };
      const url = `${GITHUB_API}/repos/${owner}/${repo}/issues?state=open&per_page=${Math.min(limit, 30)}`;
      const res = await fetch(url, { headers });
      if (!res.ok) return { content: `GitHub API error: ${res.status}`, isError: true };
      const issues = await res.json();
      const formatted = issues.map((i: any) => `#${i.number} ${i.title} [${(i.labels || []).map((l: any) => l.name).join(", ")}]`).join("\n");
      return { content: formatted || "No open issues." };
    }

    if (toolName === "github_get_repo_info") {
      const { owner, repo } = args as { owner: string; repo: string };
      const url = `${GITHUB_API}/repos/${owner}/${repo}`;
      const res = await fetch(url, { headers });
      if (!res.ok) return { content: `GitHub API error: ${res.status}`, isError: true };
      const data = await res.json();
      return {
        content: `Repo: ${data.full_name}\nDescription: ${data.description || "(none)"}\nStars: ${data.stargazers_count}\nLanguage: ${data.language || "(none)"}\nDefault branch: ${data.default_branch}\nURL: ${data.html_url}`,
      };
    }

    return { content: `Unknown GitHub tool: ${toolName}`, isError: true };
  } catch (err) {
    return {
      content: `GitHub tool '${toolName}' failed: ${err instanceof Error ? err.message : String(err)}`,
      isError: true,
    };
  }
}

// ── Agent Browser tool handler (via CLI) ──────────────────────────────────

import { execSync } from "child_process";

async function callBrowserTool(toolName: string, args: Record<string, unknown>): Promise<ToolCallResult> {
  try {
    if (toolName === "browser_navigate") {
      const url = args.url as string;
      if (!url) return { content: "URL is required", isError: true };
      const output = execSync(`agent-browser open "${url}" --timeout 15000`, { encoding: "utf-8", timeout: 20000 });
      return { content: output.slice(0, 2000) };
    }

    if (toolName === "browser_screenshot") {
      const full = args.full as boolean;
      const path = `/tmp/athena-screenshot-${Date.now()}.png`;
      const output = execSync(`agent-browser screenshot ${path} ${full ? "--full" : ""}`, { encoding: "utf-8", timeout: 15000 });
      return { content: `Screenshot saved to ${path}` };
    }

    if (toolName === "browser_get_text") {
      const selector = args.selector as string | undefined;
      const output = execSync(`agent-browser get text ${selector ? `--selector "${selector}"` : ""}`, { encoding: "utf-8", timeout: 15000 });
      return { content: output.slice(0, 3000) };
    }

    return { content: `Unknown browser tool: ${toolName}`, isError: true };
  } catch (err) {
    return {
      content: `Browser tool '${toolName}' failed: ${err instanceof Error ? err.message : String(err)}`,
      isError: true,
    };
  }
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Get all available tools from Supabase MCP + GitHub API + Browser.
 * Used by the function-calling loop to pass tool definitions to the model.
 */
export async function getAvailableTools(): Promise<Tool[]> {
  const [athenaTools, ghTools] = await Promise.all([
    getAthenaTools(),
    Promise.resolve(githubTools),
  ]);
  return [...athenaTools, ...ghTools, webFetchTool];
}

/**
 * Route a tool call to the right backend (Supabase MCP, GitHub API, or Browser).
 */
export async function callTool(toolName: string, args: Record<string, unknown>): Promise<ToolCallResult> {
  // First try our own MCP server (it has github_read_file, db_query, etc.)
  // The Athena MCP server tools don't have a prefix — they're just "github_read_file", "db_query", etc.
  // We need to route these to our MCP server, not the direct GitHub wrapper.

  // Check if this tool name matches one from our Athena MCP server
  const athenaTools = await getAthenaTools();
  const isAthenaTool = athenaTools.some(t => t.name === toolName);
  if (isAthenaTool) {
    return callAthenaMcpTool(toolName, args);
  }

  // Fallback: direct GitHub API wrapper (same tool names, different backend)
  if (toolName.startsWith("github_")) {
    return callGithubTool(toolName, args);
  }

  if (toolName === "web_fetch") {
    const url = args.url as string;
    if (!url) return { content: "URL is required", isError: true };
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
        signal: AbortSignal.timeout(15000),
      });
      const html = await res.text();
      // Strip HTML tags for clean text
      const text = html.replace(/<script[^>]*>.*?<\/script>/gs, "").replace(/<style[^>]*>.*?<\/style>/gs, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      return { content: text.slice(0, 3000) };
    } catch (err) {
      return { content: `Failed to fetch ${url}: ${err instanceof Error ? err.message : String(err)}`, isError: true };
    }
  }

  if (toolName.startsWith("browser_")) {
    return { content: "Browser tools are not available on Vercel. Use web_fetch instead.", isError: true };
  }

  if (toolName.startsWith("cf_")) {
    return callCloudflareMcpTool(toolName, args);
  }

  return { content: `Unknown tool: ${toolName}`, isError: true };
}

/**
 * Convert our Tool[] into Cloudflare Workers AI's function-calling format.
 *
 * Cloudflare uses a FLAT format (not OpenAI's nested format):
 *   { name, description, parameters }
 * NOT:
 *   { type: "function", function: { name, description, parameters } }
 *
 * Source: https://developers.cloudflare.com/workers-ai/function-calling/
 */
export function toolsToFunctionSchema(tools: Tool[]): Array<{
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}> {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.inputSchema,
  }));
}
