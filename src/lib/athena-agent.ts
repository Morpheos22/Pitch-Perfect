const POKE_COMPLETIONS_URL = "https://poke.com/api/v1/chat/completions";
const ATHENA_MCP_URL = "https://athena-mcp-server.morphylee22.workers.dev/mcp";
const ADAPTIVE_RPC_URL = "https://kal-agent-morpheos255918280.adaptive.ai/api/rpc";
export const ATHENA_SYSTEM_PROMPT = `You are Athena, an investor-grade AI diligence and product strategy agent for Pitch Perfect. Be rigorous, concise, and evidence-led. Separate facts from assumptions, never invent facts, and say when information is missing. Use tools when available, but remain helpful without them.`;
type Message = { role: "system" | "user" | "assistant" | "tool"; content: string; tool_call_id?: string; name?: string; tool_calls?: Array<{ id: string; function: { name: string; arguments?: string } }> };
export type AthenaMessage = Message;
type Tool = { name: string; description?: string; inputSchema?: unknown };

async function fetchWithTimeout(url: string, init: RequestInit, ms = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try { return await fetch(url, { ...init, signal: controller.signal }); } finally { clearTimeout(timer); }
}

async function mcpRequest(id: number, method: string, params: Record<string, unknown> = {}, sessionId?: string) {
  const response = await fetchWithTimeout(ATHENA_MCP_URL, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...(sessionId ? { "mcp-session-id": sessionId } : {}) }, body: JSON.stringify({ jsonrpc: "2.0", id, method, params }) });
  if (!response.ok) throw new Error(`Athena MCP returned ${response.status}`);
  const text = await response.text();
  const line = text.split("\n").find((entry) => entry.startsWith("data:"))?.replace(/^data:\s*/, "") || text;
  const payload = JSON.parse(line);
  if (payload.error) throw new Error(payload.error.message || "Athena MCP request failed");
  return { result: payload.result, sessionId: response.headers.get("mcp-session-id") || sessionId };
}

async function getMcpTools(): Promise<Tool[]> {
  const initialized = await mcpRequest(1, "initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "pitch-perfect", version: "1.0.0" } });
  const listed = await mcpRequest(2, "tools/list", {}, initialized.sessionId);
  return listed.result?.tools || [];
}

async function callMcpTool(id: number, name: string, args: unknown, sessionId?: string) {
  const result = await mcpRequest(id, "tools/call", { name, arguments: args || {} }, sessionId);
  return result.result;
}

async function pokeChat(messages: Message[], tools: unknown[] = [], apiKey?: string, model = "gpt-4o-mini") {
  if (!apiKey) throw new Error("POKE_API_KEY is not configured");
  const response = await fetchWithTimeout(POKE_COMPLETIONS_URL, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model, messages, ...(tools.length ? { tools, tool_choice: "auto" } : {}) }) });
  if (!response.ok) throw new Error(`Poke completions returned ${response.status}`);
  const payload = await response.json();
  const message = payload.choices?.[0]?.message;
  if (!message) throw new Error("Poke completions returned no message");
  return { message, usage: payload.usage };
}

async function cloudflareChat(messages: Message[]) {
  const account = process.env.CF_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CF_API_TOKEN || process.env.CLOUDFLARE_AI_TOKEN || process.env.CLOUDFLARE_API_TOKEN;
  if (!account || !token) throw new Error("Cloudflare AI credentials are not configured");
  const response = await fetchWithTimeout(`https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/@cf/meta/llama-3.1-8b-instruct`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ messages }) });
  if (!response.ok) throw new Error(`Cloudflare AI returned ${response.status}`);
  const payload = await response.json();
  const text = payload.result?.response;
  if (!text) throw new Error("Cloudflare AI returned no response");
  return text;
}

async function adaptiveChat(messages: Message[]) {
  const response = await fetchWithTimeout(ADAPTIVE_RPC_URL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method: "chat.completions", params: { messages } }) });
  if (!response.ok) throw new Error(`Adaptive RPC returned ${response.status}`);
  const payload = await response.json();
  const text = payload.result?.choices?.[0]?.message?.content || payload.result?.response || payload.response;
  if (!text) throw new Error("Adaptive RPC returned no response");
  return text;
}

export async function runAthena(messages: Message[], options: { apiKey?: string; model?: string } = {}) {
  const conversation: Message[] = [{ role: "system", content: ATHENA_SYSTEM_PROMPT }, ...messages];
  const apiKey = options.apiKey || process.env.POKE_API_KEY || process.env.POKE_API_TOKEN;
  let tools: Tool[] = [];
  let sessionId: string | undefined;
  try { const initialized = await mcpRequest(1, "initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "pitch-perfect", version: "1.0.0" } }); sessionId = initialized.sessionId; const listed = await mcpRequest(2, "tools/list", {}, sessionId); tools = listed.result?.tools || []; } catch (error) { console.warn("[Athena] MCP unavailable; continuing without tools", error); }
  const pokeTools = tools.map((tool) => ({ type: "function", function: { name: tool.name, description: tool.description || tool.name, parameters: tool.inputSchema || { type: "object", properties: {} } } }));
  if (!apiKey) return { message: await cloudflareChat(conversation) };
  for (let round = 0; round < 8; round += 1) {
    const result = await pokeChat(conversation, pokeTools, apiKey, options.model);
    conversation.push(result.message);
    const calls = result.message.tool_calls || [];
    if (!calls.length) return { message: result.message.content || "" , usage: result.usage };
    for (const call of calls) { let args: unknown = {}; try { args = JSON.parse(call.function.arguments || "{}"); } catch {} try { conversation.push({ role: "tool", tool_call_id: call.id, name: call.function.name, content: JSON.stringify(await callMcpTool(round + 3, call.function.name, args, sessionId)) }); } catch (error) { conversation.push({ role: "tool", tool_call_id: call.id, name: call.function.name, content: JSON.stringify({ error: error instanceof Error ? error.message : String(error) }) }); } }
  }
  throw new Error("Athena exceeded the maximum tool-calling rounds");
}

export async function askAthenaViaPoke(message: string, _context?: unknown, history: AthenaMessage[] = [], _image?: string) { return (await runAthena([...history, { role: "user", content: message }])).message; }
export async function askAthenaWithTools(message: string, context?: unknown, history: AthenaMessage[] = []) { return askAthenaViaPoke(message, context, history); }
export async function askAthena(message: string, _context?: unknown, history: AthenaMessage[] = []) {
  const messages: Message[] = [...history, { role: "user", content: message }];
  try { return (await runAthena(messages)).message; } catch (pokeError) { console.warn("[Athena] Poke failed", pokeError); try { return await cloudflareChat([{ role: "system", content: ATHENA_SYSTEM_PROMPT }, ...messages]); } catch (cfError) { console.warn("[Athena] Cloudflare failed", cfError); try { return await adaptiveChat([{ role: "system", content: ATHENA_SYSTEM_PROMPT }, ...messages]); } catch (adaptiveError) { console.warn("[Athena] Adaptive failed", adaptiveError); return "I’m sorry, Athena is temporarily unavailable. Please try again in a moment."; } } }
}