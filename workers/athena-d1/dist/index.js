// src/supabase-tools.ts
var supabaseToolDefinitions = [
  {
    name: "query_supabase",
    description: "Query PitchCoach records in Supabase PostgREST. Use for pitch decks, users, diligence runs, and slide extracts.",
    parameters: {
      type: "object",
      properties: {
        table: { type: "string" },
        select: { type: "string", default: "*" },
        match: { type: "object", additionalProperties: true },
        order: { type: "object", properties: { column: { type: "string" }, ascending: { type: "boolean" } }, required: ["column"] },
        limit: { type: "number", default: 10 }
      },
      required: ["table"]
    }
  },
  {
    name: "fetch_founder_deck",
    description: "Fetch a founder's uploaded pitch deck, financial tables, slide extracts, and previous diligence scores from Supabase.",
    parameters: { type: "object", properties: { founder_id: { type: "string" }, user_id: { type: "string" } } }
  }
];
function configured(env) {
  if (!env.SUPABASE_URL) throw new Error("SUPABASE_URL is not configured");
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY is not configured");
  return { url: env.SUPABASE_URL.replace(/\/$/, ""), key };
}
async function querySupabase(env, args) {
  if (!args.table || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(args.table)) throw new Error("Invalid Supabase table name");
  const { url, key } = configured(env);
  const params = new URLSearchParams({ select: args.select || "*", limit: String(Math.min(Math.max(args.limit ?? 10, 1), 100)) });
  for (const [column, value] of Object.entries(args.match || {})) params.set(column, value === null ? "is.null" : `eq.${String(value)}`);
  if (args.order) params.set("order", `${args.order.column}.${args.order.ascending === false ? "desc" : "asc"}`);
  const response = await fetch(`${url}/rest/v1/${encodeURIComponent(args.table)}?${params}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!response.ok) throw new Error(`Supabase query failed: ${response.status} ${await response.text()}`);
  return response.json();
}
async function fetchFounderDeck(env, founderId) {
  if (!founderId) throw new Error("founder_id or user_id is required");
  const match = { founder_id: founderId };
  const [decks, slides, financials, diligence] = await Promise.all([
    querySupabase(env, { table: "pitch_decks", match, order: { column: "created_at", ascending: false }, limit: 1 }),
    querySupabase(env, { table: "slide_extracts", match, limit: 200 }),
    querySupabase(env, { table: "financial_tables", match, limit: 50 }),
    querySupabase(env, { table: "diligence_reports", match, order: { column: "created_at", ascending: false }, limit: 10 })
  ]);
  return { decks, slides, financials, diligence };
}
async function handleSupabaseTool(env, name, args) {
  if (name === "query_supabase") return querySupabase(env, args);
  if (name === "fetch_founder_deck") return fetchFounderDeck(env, String(args.founder_id || args.user_id || ""));
  throw new Error(`Unknown Supabase tool: ${name}`);
}

// src/index.ts
var MODEL = "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b";
var AXES = ["problem", "market", "solution", "traction", "business_model", "go_to_market", "founder"];
var json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
var text = (v) => typeof v === "string" ? v : JSON.stringify(v ?? "");
var readBody = async (r) => {
  try {
    return await r.json();
  } catch {
    return {};
  }
};
async function searchWeb(env, query) {
  if (!env.WEB_SEARCH_API_KEY) return { provider: "none", results: [], warning: "WEB_SEARCH_API_KEY is not configured" };
  const provider = env.WEB_SEARCH_PROVIDER || "brave";
  const url = env.WEB_SEARCH_URL || (provider === "tavily" ? "https://api.tavily.com/search" : provider === "serper" ? "https://google.serper.dev/search" : "https://api.search.brave.com/res/v1/web/search");
  const headers = provider === "brave" ? { "x-subscription-token": env.WEB_SEARCH_API_KEY, accept: "application/json" } : { authorization: `Bearer ${env.WEB_SEARCH_API_KEY}`, "content-type": "application/json", "x-api-key": env.WEB_SEARCH_API_KEY };
  const payload = provider === "serper" ? { q: query, num: 5 } : provider === "tavily" ? { api_key: env.WEB_SEARCH_API_KEY, query, max_results: 5 } : void 0;
  const r = await fetch(provider === "brave" ? `${url}?q=${encodeURIComponent(query)}&count=5` : url, { method: provider === "brave" ? "GET" : "POST", headers, body: payload ? JSON.stringify(payload) : void 0 });
  if (!r.ok) throw new Error(`web search failed: ${r.status}`);
  const raw = await r.json();
  const items = raw.web?.results || raw.organic_results || raw.results || [];
  return { provider, results: Array.isArray(items) ? items.slice(0, 5) : [] };
}
async function d1Tool(env, name, args) {
  if (name === "search_web") return searchWeb(env, text(args.query));
  if (name === "record_drill_turn") {
    await env.DB.prepare("INSERT INTO drill_turns (session_id, role, content, score, critique, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))").bind(text(args.session_id), text(args.role), text(args.content), args.score ?? null, args.critique ?? null).run();
    return { ok: true };
  }
  if (name === "flag_discrepancy") {
    await env.DB.prepare("INSERT INTO discrepancies (session_id, topic, earlier_claim, later_claim, severity, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))").bind(text(args.session_id), text(args.topic), text(args.earlier_claim), text(args.later_claim), text(args.severity || "medium")).run();
    return { ok: true };
  }
  if (name === "extract_memory_facts") {
    await env.DB.prepare("INSERT INTO memory_facts (session_id, fact, value, source_turn_id, created_at) VALUES (?, ?, ?, ?, datetime('now'))").bind(text(args.session_id), text(args.fact), text(args.value), args.source_turn_id ?? null).run();
    return { ok: true };
  }
  if (name === "generate_readiness_memo") return env.DB.prepare("SELECT axis, score, gaps, remediation FROM readiness_scores WHERE session_id = ? ORDER BY axis").bind(text(args.session_id)).all();
  return handleSupabaseTool(env, name, args);
}
var toolDefinitions = [
  { name: "search_web", description: "Verify public claims with live web sources.", parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
  { name: "record_drill_turn", description: "Persist a drill turn.", parameters: { type: "object", properties: { session_id: { type: "string" }, role: { type: "string" }, content: { type: "string" }, score: { type: "number" }, critique: { type: "string" } }, required: ["session_id", "content"] } },
  { name: "flag_discrepancy", description: "Persist a contradiction.", parameters: { type: "object", properties: { session_id: { type: "string" }, topic: { type: "string" }, earlier_claim: { type: "string" }, later_claim: { type: "string" }, severity: { type: "string" } }, required: ["session_id", "topic", "earlier_claim", "later_claim"] } },
  ...supabaseToolDefinitions
];
async function complete(env, messages, stream = false) {
  let current = [...messages];
  for (let i = 0; i < 4; i++) {
    const result = await env.AI.run(MODEL, { messages: current, tools: toolDefinitions, stream });
    if (stream) return result;
    const choice = result.choices?.[0]?.message || result.response || result;
    const calls = choice.tool_calls || [];
    if (!calls.length) return text(choice.content ?? result.response ?? result);
    current.push({ role: "assistant", content: choice.content || "", tool_calls: calls });
    for (const call of calls) {
      const args = typeof call.function?.arguments === "string" ? JSON.parse(call.function.arguments) : call.function?.arguments || {};
      const value = await d1Tool(env, call.function?.name || call.name, args);
      current.push({ role: "tool", tool_call_id: call.id, name: call.function?.name || call.name, content: JSON.stringify(value) });
    }
  }
  throw new Error("tool loop exceeded maximum iterations");
}
async function streamResponse(env, messages) {
  const upstream = await complete(env, messages, true);
  if (upstream instanceof ReadableStream) return new Response(upstream, { headers: { "content-type": "text/event-stream", "cache-control": "no-cache" } });
  return new Response(upstream?.body || JSON.stringify(upstream), { headers: { "content-type": "text/event-stream" } });
}
var index_default = { async fetch(request, env) {
  const url = new URL(request.url);
  try {
    if (request.method === "POST" && url.pathname === "/v1/athena") {
      const input = await readBody(request);
      const session = text(input.session_id || crypto.randomUUID());
      const memories = await env.DB.prepare("SELECT fact, value FROM memory_facts WHERE session_id = ? ORDER BY created_at DESC LIMIT 100").bind(session).all();
      const context = memories.results.map((m) => `${m.fact}: ${m.value}`).join("\n");
      const messages = [{ role: "system", content: `You are Athena. Score these axes: ${AXES.join(", ")}. Give conclusions, evidence, contradictions, and next actions; never reveal hidden chain-of-thought. Memory:
${context}` }, ...Array.isArray(input.turns) ? input.turns : [], { role: "user", content: text(input.message) }];
      if (input.stream === true) return streamResponse(env, messages);
      const response = await complete(env, messages);
      await env.DB.prepare("INSERT INTO drill_turns (session_id, role, content, created_at) VALUES (?, ?, ?, datetime('now'))").bind(session, "user", text(input.message)).run();
      return json({ session_id: session, response });
    }
    if (request.method === "POST" && url.pathname === "/v1/tool") {
      const input = await readBody(request);
      return json(await d1Tool(env, text(input.name), input.arguments || {}));
    }
    return json({ service: "athena-d1", status: "ok", endpoints: ["POST /v1/athena", "POST /v1/tool"] });
  } catch (error) {
    return json({ error: text(error) }, 500);
  }
} };
export {
  index_default as default
};
