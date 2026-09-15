const ATHENA_MCP_URL = "https://athena-mcp-server.morphylee22.workers.dev/mcp";
const ADAPTIVE_RPC_URL = "https://kal-agent-morpheos255918280.adaptive.ai/api/rpc";
const CLOUDFLARE_MODEL = "@cf/meta/llama-3.3-70b-instruct";
export const ATHENA_SYSTEM_PROMPT = `You are Athena, an investor-grade AI diligence and product strategy agent for Pitch Perfect. Be rigorous, concise, and evidence-led. Separate facts from assumptions, never invent facts, and say when information is missing. Use tools when available, but remain helpful without them.`;
type Message = { role: "system" | "user" | "assistant" | "tool"; content: string | null; tool_call_id?: string; name?: string; tool_calls?: Array<{ id: string; function: { name: string; arguments?: string } }> };
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

async function callMcpTool(id: number, name: string, args: unknown, sessionId?: string) {
  return (await mcpRequest(id, "tools/call", { name, arguments: args || {} }, sessionId)).result;
}

async function cloudflareChat(messages: Message[], tools: unknown[] = []) {
  const account = process.env.CF_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CF_API_TOKEN || process.env.CLOUDFLARE_AI_TOKEN || process.env.CLOUDFLARE_API_TOKEN;
  if (!account || !token) throw new Error("Cloudflare AI credentials are not configured");
  const response = await fetchWithTimeout(`https://api.cloudflare.com/client/v4/accounts/${account}/ai/v1/chat/completions`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ model: CLOUDFLARE_MODEL, messages, ...(tools.length ? { tools, tool_choice: "auto" } : {}) }) });
  if (!response.ok) throw new Error(`Cloudflare AI returned ${response.status}`);
  const payload = await response.json();
  const message = payload.choices?.[0]?.message;
  if (!message) throw new Error("Cloudflare AI returned no message");
  return { message, usage: payload.usage };
}

async function adaptiveChat(messages: Message[]) {
  const apiKey = process.env.ADAPTIVE_API_KEY || process.env.KAL_API_KEY;
  const response = await fetchWithTimeout(ADAPTIVE_RPC_URL, { method: "POST", headers: { "content-type": "application/json", accept: "application/json", ...(apiKey ? { "x-kal-api-key": apiKey } : {}) }, body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method: "chat.completions", params: { messages } }) });
  if (!response.ok) throw new Error(`Adaptive RPC returned ${response.status}`);
  const payload = await response.json();
  const text = payload.result?.choices?.[0]?.message?.content || payload.result?.response || payload.response;
  if (typeof text !== "string" || !text.trim()) throw new Error("Adaptive RPC returned no response");
  return text;
}

export async function runAthena(messages: Message[]) {
  const conversation: Message[] = [{ role: "system", content: ATHENA_SYSTEM_PROMPT }, ...messages];
  let tools: Tool[] = [];
  let sessionId: string | undefined;
  try { const initialized = await mcpRequest(1, "initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "pitch-perfect", version: "1.0.0" } }); sessionId = initialized.sessionId; tools = (await mcpRequest(2, "tools/list", {}, sessionId)).result?.tools || []; } catch (error) { console.warn("[Athena] MCP unavailable; continuing without tools", error); }
  const cfTools = tools.map((tool) => ({ type: "function", function: { name: tool.name, description: tool.description || tool.name, parameters: tool.inputSchema || { type: "object", properties: {} } } }));
  for (let round = 0; round < 8; round += 1) {
    let result;
    try { result = await cloudflareChat(conversation, cfTools); } catch (cloudflareError) {
      console.warn("[Athena] Cloudflare failed; falling back to Adaptive RPC", cloudflareError);
      return { message: await adaptiveChat(conversation) };
    }
    conversation.push(result.message);
    const calls = result.message.tool_calls || [];
    if (!calls.length) return { message: result.message.content || "", usage: result.usage };
    for (const call of calls) { let args: unknown = {}; try { args = JSON.parse(call.function.arguments || "{}"); } catch {} try { conversation.push({ role: "tool", tool_call_id: call.id, name: call.function.name, content: JSON.stringify(await callMcpTool(round + 3, call.function.name, args, sessionId)) }); } catch (error) { conversation.push({ role: "tool", tool_call_id: call.id, name: call.function.name, content: JSON.stringify({ error: error instanceof Error ? error.message : String(error) }) }); } }
  }
  throw new Error("Athena exceeded the maximum tool-calling rounds");
}

export async function askAthenaViaPoke(message: string, _context?: unknown, history: AthenaMessage[] = [], _image?: string) { return (await runAthena([...history, { role: "user", content: message }])).message; }
export async function askAthenaWithTools(message: string, context?: unknown, history: AthenaMessage[] = []) { return askAthenaViaPoke(message, context, history); }
export async function askAthena(message: string, _context?: unknown, history: AthenaMessage[] = []) {
  const messages: Message[] = [...history, { role: "user", content: message }];
  try { return (await runAthena(messages)).message; } catch (error) { console.warn("[Athena] Provider fallback failed", error); return "I’m sorry, Athena is temporarily unavailable. Please try again in a moment."; }
}
