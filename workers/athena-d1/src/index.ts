import { fetchFounderDeck, handleSupabaseTool, supabaseToolDefinitions, type SupabaseEnv } from "./supabase-tools";

export interface Env extends SupabaseEnv {
  AI: Ai;
  DB: D1Database;
  ELEVENLABS_API_KEY?: string;
  ELEVENLABS_VOICE_ID?: string;
  ELEVENLABS_MODEL_ID?: string;
  WEB_SEARCH_URL?: string;
  WEB_SEARCH_API_KEY?: string;
  WEB_SEARCH_PROVIDER?: string;
}

type Json = Record<string, any>;
type Message = { role: string; content?: string; tool_call_id?: string; name?: string; tool_calls?: any[] };
const MODEL = "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b";
const AXES = ["problem", "market", "solution", "traction", "business_model", "go_to_market", "founder"];
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
const text = (v: unknown) => typeof v === "string" ? v : JSON.stringify(v ?? "");
const readBody = async (r: Request): Promise<Json> => { try { return await r.json(); } catch { return {}; } };

async function searchWeb(env: Env, query: string) {
  if (!env.WEB_SEARCH_API_KEY) return { provider: "none", results: [], warning: "WEB_SEARCH_API_KEY is not configured" };
  const provider = env.WEB_SEARCH_PROVIDER || "brave";
  const url = env.WEB_SEARCH_URL || (provider === "tavily" ? "https://api.tavily.com/search" : provider === "serper" ? "https://google.serper.dev/search" : "https://api.search.brave.com/res/v1/web/search");
  const headers: HeadersInit = provider === "brave" ? { "x-subscription-token": env.WEB_SEARCH_API_KEY, accept: "application/json" } : { authorization: `Bearer ${env.WEB_SEARCH_API_KEY}`, "content-type": "application/json", "x-api-key": env.WEB_SEARCH_API_KEY };
  const payload = provider === "serper" ? { q: query, num: 5 } : provider === "tavily" ? { api_key: env.WEB_SEARCH_API_KEY, query, max_results: 5 } : undefined;
  const r = await fetch(provider === "brave" ? `${url}?q=${encodeURIComponent(query)}&count=5` : url, { method: provider === "brave" ? "GET" : "POST", headers, body: payload ? JSON.stringify(payload) : undefined });
  if (!r.ok) throw new Error(`web search failed: ${r.status}`);
  const raw = await r.json() as Json; const items = raw.web?.results || raw.organic_results || raw.results || [];
  return { provider, results: Array.isArray(items) ? items.slice(0, 5) : [] };
}
async function d1Tool(env: Env, name: string, args: Json) {
  if (name === "search_web") return searchWeb(env, text(args.query));
  if (name === "record_drill_turn") { await env.DB.prepare("INSERT INTO drill_turns (session_id, role, content, score, critique, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))").bind(text(args.session_id), text(args.role), text(args.content), args.score ?? null, args.critique ?? null).run(); return { ok: true }; }
  if (name === "flag_discrepancy") { await env.DB.prepare("INSERT INTO discrepancies (session_id, topic, earlier_claim, later_claim, severity, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))").bind(text(args.session_id), text(args.topic), text(args.earlier_claim), text(args.later_claim), text(args.severity || "medium")).run(); return { ok: true }; }
  if (name === "extract_memory_facts") { await env.DB.prepare("INSERT INTO memory_facts (session_id, fact, value, source_turn_id, created_at) VALUES (?, ?, ?, ?, datetime('now'))").bind(text(args.session_id), text(args.fact), text(args.value), args.source_turn_id ?? null).run(); return { ok: true }; }
  if (name === "generate_readiness_memo") return env.DB.prepare("SELECT axis, score, gaps, remediation FROM readiness_scores WHERE session_id = ? ORDER BY axis").bind(text(args.session_id)).all();
  return handleSupabaseTool(env, name, args);
}
const toolDefinitions = [
  { name: "search_web", description: "Verify public claims with live web sources.", parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
  { name: "record_drill_turn", description: "Persist a drill turn.", parameters: { type: "object", properties: { session_id: { type: "string" }, role: { type: "string" }, content: { type: "string" }, score: { type: "number" }, critique: { type: "string" } }, required: ["session_id", "content"] } },
  { name: "flag_discrepancy", description: "Persist a contradiction.", parameters: { type: "object", properties: { session_id: { type: "string" }, topic: { type: "string" }, earlier_claim: { type: "string" }, later_claim: { type: "string" }, severity: { type: "string" } }, required: ["session_id", "topic", "earlier_claim", "later_claim"] } },
  ...supabaseToolDefinitions
];

async function complete(env: Env, messages: Message[], stream = false) {
  let current = [...messages];
  for (let i = 0; i < 4; i++) {
    const result: any = await env.AI.run(MODEL, { messages: current, tools: toolDefinitions, stream });
    if (stream) return result;
    const choice = result.choices?.[0]?.message || result.response || result;
    const calls = choice.tool_calls || [];
    if (!calls.length) return text(choice.content ?? result.response ?? result);
    current.push({ role: "assistant", content: choice.content || "", tool_calls: calls });
    for (const call of calls) {
      const args = typeof call.function?.arguments === "string" ? JSON.parse(call.function.arguments) : (call.function?.arguments || {});
      const value = await d1Tool(env, call.function?.name || call.name, args);
      current.push({ role: "tool", tool_call_id: call.id, name: call.function?.name || call.name, content: JSON.stringify(value) });
    }
  }
  throw new Error("tool loop exceeded maximum iterations");
}
async function streamResponse(env: Env, messages: Message[]) {
  const upstream: any = await complete(env, messages, true);
  if (upstream instanceof ReadableStream) return new Response(upstream, { headers: { "content-type": "text/event-stream", "cache-control": "no-cache" } });
  return new Response(upstream?.body || JSON.stringify(upstream), { headers: { "content-type": "text/event-stream" } });
}

export default { async fetch(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  try {
    if (request.method === "POST" && url.pathname === "/v1/athena") {
      const input = await readBody(request); const session = text(input.session_id || crypto.randomUUID());
      let memories = { results: [] }; try { memories = await env.DB.prepare("SELECT fact, value FROM memory_facts WHERE session_id = ? ORDER BY created_at DESC LIMIT 100").bind(session).all(); } catch {}
      const context = memories.results.map((m: any) => `${m.fact}: ${m.value}`).join("\n");
      const messages: Message[] = [{ role: "system", content: `You are Athena. Score these axes: ${AXES.join(", ")}. Give conclusions, evidence, contradictions, and next actions; never reveal hidden chain-of-thought. Memory:\n${context}` }, ...(Array.isArray(input.turns) ? input.turns : []), { role: "user", content: text(input.message) }];
      if (input.stream === true) return streamResponse(env, messages);
      const response = await complete(env, messages);
      try { await env.DB.prepare("INSERT INTO drill_turns (session_id, role, content, created_at) VALUES (?, ?, ?, datetime('now'))").bind(session, "user", text(input.message)).run(); } catch {}
      return json({ session_id: session, response });
    }
    if (request.method === "POST" && url.pathname === "/v1/tool") { const input = await readBody(request); return json(await d1Tool(env, text(input.name), input.arguments || {})); }
    return json({ service: "athena-d1", status: "ok", endpoints: ["POST /v1/athena", "POST /v1/tool"] });
  } catch (error) { return json({ error: error instanceof Error ? error.message : String(error) }, 500); }
} };
