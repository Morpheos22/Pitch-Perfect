/**
 * Athena MCP Server — Cloudflare Worker
 *
 * This is Athena's own MCP server, deployed on Cloudflare Workers.
 * It exposes tools that Athena can call to query the Supabase database,
 * read GitHub repos, and interact with the PitchCoach platform.
 *
 * No OAuth needed — we control the server, we set the auth.
 * Athena connects to: https://athena-mcp-server.<subdomain>.workers.dev/mcp
 *
 * Pattern: McpAgent from "agents/mcp" + McpServer from "@modelcontextprotocol/sdk/server/mcp.js"
 *
 * Deploy: npx wrangler deploy
 * Test: https://mcp-server-athena-mcp-server.<subdomain>.workers.dev/mcp
 */

import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// ── Tool implementations ──────────────────────────────────────────────────
// Each tool calls an external API or database. The tools are defined with
// Zod schemas for type-safe input validation.

// Tool 1: Read a file from GitHub (uses GitHub REST API)
async function githubReadFile(owner: string, repo: string, path: string): Promise<string> {
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
  if (!GITHUB_TOKEN) return "GitHub token not configured";

  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "athena-mcp/1.0",
    },
  });

  if (!res.ok) return `GitHub API error: ${res.status}`;
  const data: any = await res.json();
  const content = atob(data.content);
  return content.slice(0, 4000);
}

// Tool 2: Get repo info from GitHub
async function githubGetRepoInfo(owner: string, repo: string): Promise<string> {
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "athena-mcp/1.0",
    },
  });

  if (!res.ok) return `GitHub API error: ${res.status}`;
  const data: any = await res.json();
  return `Repo: ${data.full_name}\nDescription: ${data.description || "(none)"}\nStars: ${data.stargazers_count}\nLanguage: ${data.language || "(none)"}\nDefault branch: ${data.default_branch}`;
}

// Tool 3: Query Supabase via REST API (PostgREST)
// Uses the Supabase service role key for server-side access
async function supabaseQuery(table: string, select: string = "*", limit: number = 10, filter?: string): Promise<string> {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!SUPABASE_URL || !SUPABASE_KEY) return "Supabase not configured";

  let url = `${SUPABASE_URL}/rest/v1/${table}?select=${select}&limit=${limit}`;
  if (filter) url += `&${filter}`;

  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) return `Supabase error: ${res.status}`;
  const data = await res.json();
  return JSON.stringify(data, null, 2).slice(0, 3000);
}

// ── MCP Server ────────────────────────────────────────────────────────────

export class AthenaMCP extends McpAgent {
  server = new McpServer({ name: "athena-mcp", version: "1.0.0" });

  async init() {
    // GitHub tools
    this.server.tool(
      "github_read_file",
      "Read a file from a GitHub repository. Returns the file content (up to 4000 chars).",
      {
        owner: z.string().describe("Repository owner (e.g., 'Morpheos22')"),
        repo: z.string().describe("Repository name (e.g., 'Pitch-Perfect')"),
        path: z.string().describe("File path (e.g., 'README.md')"),
      },
      async ({ owner, repo, path }) => {
        const content = await githubReadFile(owner, repo, path);
        return { content: [{ type: "text", text: content }] };
      },
    );

    this.server.tool(
      "github_get_repo_info",
      "Get metadata about a GitHub repository — description, stars, language, default branch.",
      {
        owner: z.string().describe("Repository owner"),
        repo: z.string().describe("Repository name"),
      },
      async ({ owner, repo }) => {
        const info = await githubGetRepoInfo(owner, repo);
        return { content: [{ type: "text", text: info }] };
      },
    );

    this.server.tool(
      "github_list_issues",
      "List open issues in a GitHub repository.",
      {
        owner: z.string().describe("Repository owner"),
        repo: z.string().describe("Repository name"),
        limit: z.number().optional().describe("Max issues (default 10)"),
      },
      async ({ owner, repo, limit = 10 }) => {
        const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
        const res = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/issues?state=open&per_page=${Math.min(limit, 30)}`,
          { headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, "User-Agent": "athena-mcp/1.0" } },
        );
        if (!res.ok) return { content: [{ type: "text", text: `GitHub API error: ${res.status}` }] };
        const issues: any[] = await res.json();
        const formatted = issues.map(i => `#${i.number} ${i.title}`).join("\n");
        return { content: [{ type: "text", text: formatted || "No open issues." }] };
      },
    );

    // Supabase database tools
    this.server.tool(
      "db_query",
      "Query a Supabase table. Returns rows as JSON. Use this when the user asks about their data — deck scores, scripts, usage, subscriptions.",
      {
        table: z.string().describe("Table name (e.g., 'pitch_decks', 'pitch_scripts', 'users', 'subscriptions', 'usage')"),
        select: z.string().optional().describe("Columns to select (default '*')"),
        limit: z.number().optional().describe("Max rows (default 10, max 50)"),
        filter: z.string().optional().describe("PostgREST filter (e.g., 'user_id=eq.some-uuid')"),
      },
      async ({ table, select = "*", limit = 10, filter }) => {
        const result = await supabaseQuery(table, select, Math.min(limit, 50), filter);
        return { content: [{ type: "text", text: result }] };
      },
    );

    this.server.tool(
      "db_get_user_summary",
      "Get a summary of a user's data — subscription plan, usage stats, recent deck scores. Pass the user's internal ID.",
      {
        userId: z.string().describe("Internal user ID (cuid format)"),
      },
      async ({ userId }) => {
        const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
        const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

        // Fetch subscription
        const subRes = await fetch(`${SUPABASE_URL}/rest/v1/subscriptions?user_id=eq.${userId}&select=plan,status,credits_remaining,credits_used`, {
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
        });
        const sub = subRes.ok ? (await subRes.json())[0] : null;

        // Fetch usage
        const usageRes = await fetch(`${SUPABASE_URL}/rest/v1/usage?user_id=eq.${userId}&select=*`, {
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
        });
        const usage = usageRes.ok ? (await usageRes.json())[0] : null;

        // Fetch recent decks
        const decksRes = await fetch(`${SUPABASE_URL}/rest/v1/pitch_decks?user_id=eq.${userId}&select=file_name,overall_score,status,created_at&order=created_at.desc&limit=5`, {
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
        });
        const decks = decksRes.ok ? await decksRes.json() : [];

        let summary = "User Summary:\n";
        if (sub) summary += `Plan: ${sub.plan}, Status: ${sub.status}, Credits: ${sub.credits_remaining} remaining\n`;
        if (usage) summary += `Usage: Decks=${usage.e1_deck_analyses}, Scripts=${usage.e2_script_coach_sessions}, Live=${usage.e3_live_pitch_sessions}\n`;
        if (decks.length > 0) {
          summary += "Recent decks:\n";
          decks.forEach((d: any) => {
            summary += `  ${d.file_name}: score=${d.overall_score ?? "pending"}, ${new Date(d.created_at).toLocaleDateString()}\n`;
          });
        }

        return { content: [{ type: "text", text: summary }] };
      },
    );

    // Web search tool (for real-time information)
    this.server.tool(
      "web_search",
      "Search the web for current information. Use when the user asks about recent events, news, or real-time data.",
      {
        query: z.string().describe("Search query"),
        num: z.number().optional().describe("Number of results (default 5)"),
      },
      async ({ query, num = 5 }) => {
        // Uses the Z.ai web search API (same as our z-ai CLI)
        const ZAI_API_KEY = process.env.ZAI_API_KEY || "";
        const res = await fetch("https://api.z.ai/api/paas/v4/tools/web_search", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${ZAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query, num }),
        });

        if (!res.ok) return { content: [{ type: "text", text: `Search failed: ${res.status}` }] };
        const data: any[] = await res.json();
        const formatted = data.map((r, i) => `${i + 1}. ${r.name}\n   ${r.snippet?.slice(0, 200) || ""}\n   ${r.url}`).join("\n\n");
        return { content: [{ type: "text", text: formatted || "No results." }] };
      },
    );
  }
}

export default AthenaMCP;
