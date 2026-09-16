import fs from "node:fs";
import path from "node:path";
import { getAthenaGreeting, getAthenaResponses } from "./athena/response-library";

const ATHENA_MCP_URL = "https://athena-mcp-server.morphylee22.workers.dev/mcp";
const CLOUDFLARE_MODEL = process.env.ATHENA_MODEL || "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const CLOUDFLARE_FALLBACK_MODEL = "@cf/openai/gpt-oss-120b";
const MAX_TOOL_RESULT_CHARS = 12000;
const MAX_CONTEXT_CHARS = 30000;
const CONVERSATIONAL_MAX_TOKENS = 2048;
const DILIGENCE_MAX_TOKENS = 8192;
const TOOL_ROUNDS = 6;

export const ATHENA_SYSTEM_PROMPT = `You are Athena, an investor-grade AI diligence and product strategy agent for Pitch Perfect. Be rigorous, concise, and evidence-led. Separate verified facts, company claims, assumptions, and unknowns. Never invent facts. Use tools when available, cite sources and dates for external claims, and say when information is missing. Use the supplied PitchCoach knowledge base for product facts and the startup-diligence skill for company analysis. Give human, practical answers and end complex work with risks, open questions, and decision-relevant next steps.`;
type Message = { role: "system" | "user" | "assistant" | "tool"; content: string | null; tool_call_id?: string; name?: string; tool_calls?: Array<{ id: string; function: { name: string; arguments?: string } }> };
export type AthenaMessage = Message;
type Tool = { name: string; description?: string; inputSchema?: unknown };

function readRepoFile(relativePath: string, fallback: string) { try { return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8"); } catch { return fallback; } }
const KNOWLEDGE_BASE = readRepoFile("src/lib/athena-knowledge-base.md", "The PitchCoach knowledge base is unavailable; do not invent product facts.");
const STARTUP_DILIGENCE_SKILL = readRepoFile(".agents/skills/startup-diligence/SKILL.md", "Separate verified facts, claims, assumptions, and unknowns; prefer primary sources and finish with risks and next steps.");

function contextFor(messages: Message[]) {
  const latest = [...messages].reverse().find((message) => message.role === "user")?.content?.toLowerCase() || "";
  const diligence = /startup|market|competitor|traction|revenue|moat|invest|due diligence|unit economics|retention/.test(latest);
  const category = diligence ? "diligence" : /e1|deck|slide/.test(latest) ? "coaching" : /price|sign in|dashboard|upload|module|account|setting/.test(latest) ? "navigation" : /objection|expensive|not now|crowded|risk/.test(latest) ? "objection" : undefined;
  const responses = getAthenaResponses(category).slice(0, 8).map((item) => `${item.intent}: ${item.response}`).join("\n");
  const skill = diligence ? STARTUP_DILIGENCE_SKILL : "Apply the product knowledge and response examples when relevant; do not present examples as verified user-specific facts.";
  return `\n\n[PITCHCOACH KNOWLEDGE BASE]\n${KNOWLEDGE_BASE}\n\n[ATHENA SKILL CONTEXT]\n${skill}\n\n[HUMANIZED RESPONSE EXAMPLES]\n${responses}`.slice(0, MAX_CONTEXT_CHARS);
}

function isDiligence(message: string) { return /startup|market|competitor|traction|revenue|moat|invest|due diligence|unit economics|retention/.test(message.toLowerCase()); }
function fastResponse(message: string) {
  const normalized = message.trim().toLowerCase();
  if (/^(hi|hello|hey|good morning|good afternoon|good evening)[!. ]*$/.test(normalized)) return getAthenaGreeting(0);
  const match = getAthenaResponses().find((item) => normalized.includes(item.intent));
  return match?.response;
}

async function fetchWithTimeout(url: string, init: RequestInit, ms = 12000) { const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), ms); try { return await fetch(url, { ...init, signal: controller.signal }); } finally { clearTimeout(timer); } }
async function mcpRequest(id: number, method: string, params: Record<string, unknown> = {}, sessionId?: string) { const response = await fetchWithTimeout(ATHENA_MCP_URL, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...(sessionId ? { "mcp-session-id": sessionId } : {}) }, body: JSON.stringify({ jsonrpc: "2.0", id, method, params }) }); if (!response.ok) throw new Error(`Athena MCP returned ${response.status}`); const text = await response.text(); const line = text.split("\n").find((entry) => entry.startsWith("data:"))?.replace(/^data:\s*/, "") || text; const payload = JSON.parse(line); if (payload.error) throw new Error(payload.error.message || "Athena MCP request failed"); return { result: payload.result, sessionId: response.headers.get("mcp-session-id") || sessionId }; }
async function callMcpTool(id: number, name: string, args: unknown, sessionId?: string) { return (await mcpRequest(id, "tools/call", { name, arguments: args || {} }, sessionId)).result; }

async function cloudflareChat(messages: Message[], tools: unknown[] = [], diligence = false, model = CLOUDFLARE_MODEL) {
  const account = process.env.CF_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CF_API_TOKEN || process.env.CLOUDFLARE_AI_TOKEN || process.env.CLOUDFLARE_API_TOKEN;
  if (!account || !token) throw new Error("Cloudflare AI credentials are not configured");
  const response = await fetchWithTimeout(`https://api.cloudflare.com/client/v4/accounts/${account}/ai/v1/chat/completions`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ model, messages, max_tokens: diligence ? DILIGENCE_MAX_TOKENS : CONVERSATIONAL_MAX_TOKENS, ...(tools.length ? { tools, tool_choice: "auto" } : {}) }) });
  if (!response.ok) throw new Error(`Cloudflare AI returned ${response.status}`);
  const payload = await response.json(); const message = payload.choices?.[0]?.message; if (!message) throw new Error("Cloudflare AI returned no message"); return { message, usage: payload.usage };
}

export async function runAthena(messages: Message[]) {
  const latest = [...messages].reverse().find((message) => message.role === "user")?.content || "";
  const quick = fastResponse(latest);
  if (quick && messages.length <= 1) return { message: quick, cached: true };
  const diligence = isDiligence(latest);
  const conversation: Message[] = [{ role: "system", content: `${ATHENA_SYSTEM_PROMPT}${contextFor(messages)}` }, ...messages];
  let tools: Tool[] = []; let sessionId: string | undefined;
  try { const initialized = await mcpRequest(1, "initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "pitch-perfect", version: "1.0.0" } }); sessionId = initialized.sessionId; tools = (await mcpRequest(2, "tools/list", {}, sessionId)).result?.tools || []; } catch (error) { console.warn("[Athena] MCP unavailable; continuing without tools", error); }
  const cfTools = tools.map((tool) => ({ type: "function", function: { name: tool.name, description: tool.description || tool.name, parameters: tool.inputSchema || { type: "object", properties: {} } } }));
  for (let round = 0; round < TOOL_ROUNDS; round += 1) {
    let result;
    try { result = await cloudflareChat(conversation, cfTools, diligence); }
    catch (primaryError) { console.warn("[Athena] primary Cloudflare model failed; trying verified fallback", primaryError); try { result = await cloudflareChat(conversation, cfTools, diligence, CLOUDFLARE_FALLBACK_MODEL); } catch (fallbackError) { throw new Error(`Athena providers failed: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`); } }
    conversation.push(result.message); const calls = result.message.tool_calls || []; if (!calls.length) return { message: result.message.content || "", usage: result.usage };
    const toolMessages = await Promise.all(calls.map(async (call) => { let args: unknown = {}; try { args = JSON.parse(call.function.arguments || "{}"); } catch {} try { const value = await callMcpTool(round + 3, call.function.name, args, sessionId); return { role: "tool" as const, tool_call_id: call.id, name: call.function.name, content: JSON.stringify(value).slice(0, MAX_TOOL_RESULT_CHARS) }; } catch (error) { return { role: "tool" as const, tool_call_id: call.id, name: call.function.name, content: JSON.stringify({ error: error instanceof Error ? error.message : String(error) }).slice(0, MAX_TOOL_RESULT_CHARS) }; } }));
    conversation.push(...toolMessages);
  }
  throw new Error("Athena exceeded the maximum tool-calling rounds");
}
export async function askAthenaViaPoke(message: string, _context?: unknown, history: AthenaMessage[] = [], _image?: string) { return (await runAthena([...history, { role: "user", content: message }])).message; }
export async function askAthenaWithTools(message: string, context?: unknown, history: AthenaMessage[] = []) { return askAthenaViaPoke(message, context, history); }
export async function askAthena(message: string, _context?: unknown, history: AthenaMessage[] = []) { try { return (await runAthena([...history, { role: "user", content: message }])).message; } catch (error) { console.warn("[Athena] Provider fallback failed", error); return "I’m sorry, Athena is temporarily unavailable. Please try again in a moment."; } }
