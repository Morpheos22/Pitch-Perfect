export interface Env {
  AI: Ai;
  DB: D1Database;
  ELEVENLABS_API_KEY?: string;
  ELEVENLABS_VOICE_ID?: string;
  ELEVENLABS_MODEL_ID?: string;
  WEB_SEARCH_URL?: string;
  WEB_SEARCH_API_KEY?: string;
  WEB_SEARCH_PROVIDER?: string;
}

type Turn = { role: string; content: string };
type Json = Record<string, unknown>;

const AXES = ["problem", "market", "solution", "traction", "business_model", "go_to_market", "founder"];
const MODEL = "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b";

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
const body = async (request: Request): Promise<Json> => { try { return await request.json() as Json; } catch { return {}; } };
const text = (value: unknown) => typeof value === "string" ? value : JSON.stringify(value ?? "");

async function searchWeb(env: Env, query: string) {
  const provider = env.WEB_SEARCH_PROVIDER || "brave";
  if (!env.WEB_SEARCH_API_KEY) return { provider: "none", results: [], warning: "WEB_SEARCH_API_KEY is not configured" };
  const url = env.WEB_SEARCH_URL || (provider === "tavily" ? "https://api.tavily.com/search" : provider === "serper" ? "https://google.serper.dev/search" : "https://api.search.brave.com/res/v1/web/search");
  const headers: HeadersInit = provider === "brave" ? { "x-subscription-token": env.WEB_SEARCH_API_KEY, accept: "application/json" } : { authorization: `Bearer ${env.WEB_SEARCH_API_KEY}`, "content-type": "application/json", "x-api-key": env.WEB_SEARCH_API_KEY };
  const payload = provider === "serper" ? { q: query, num: 5 } : provider === "tavily" ? { api_key: env.WEB_SEARCH_API_KEY, query, max_results: 5, search_depth: "advanced" } : undefined;
  const response = await fetch(provider === "brave" ? `${url}?q=${encodeURIComponent(query)}&count=5` : url, { method: provider === "brave" ? "GET" : "POST", headers, body: payload ? JSON.stringify(payload) : undefined });
  if (!response.ok) throw new Error(`web search failed: ${response.status}`);
  const raw = await response.json() as Json;
  const items = (raw.web as Json | undefined)?.results || raw.organic_results || raw.results || [];
  return { provider, results: Array.isArray(items) ? items.slice(0, 5) : [] };
}

async function callModel(env: Env, prompt: string, messages: Turn[] = []) {
  const result = await env.AI.run(MODEL, { messages: [{ role: "system", content: prompt }, ...messages] });
  return text((result as Json).response ?? result);
}

async function writeTurn(env: Env, data: Json) {
  await env.DB.prepare("INSERT INTO drill_turns (session_id, role, content, score, critique, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))")
    .bind(text(data.session_id), text(data.role), text(data.content), data.score ?? null, data.critique ?? null).run();
}
async function writeDiscrepancy(env: Env, data: Json) {
  await env.DB.prepare("INSERT INTO discrepancies (session_id, topic, earlier_claim, later_claim, severity, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))")
    .bind(text(data.session_id), text(data.topic), text(data.earlier_claim), text(data.later_claim), text(data.severity || "medium")).run();
}
async function writeMemory(env: Env, data: Json) {
  await env.DB.prepare("INSERT INTO memory_facts (session_id, fact, value, source_turn_id, created_at) VALUES (?, ?, ?, ?, datetime('now'))")
    .bind(text(data.session_id), text(data.fact), text(data.value), data.source_turn_id ?? null).run();
}

const tools = [
  { name: "search_web", description: "Search live web sources to verify market, competitor, CAC/LTV, and other claims.", parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
  { name: "record_drill_turn", description: "Persist a drill turn with score and critique.", parameters: { type: "object", properties: { session_id: { type: "string" }, role: { type: "string" }, content: { type: "string" }, score: { type: "number" }, critique: { type: "string" } }, required: ["session_id", "content"] } },
  { name: "flag_discrepancy", description: "Persist a contradiction between turns.", parameters: { type: "object", properties: { session_id: { type: "string" }, topic: { type: "string" }, earlier_claim: { type: "string" }, later_claim: { type: "string" }, severity: { type: "string" } }, required: ["session_id", "topic", "earlier_claim", "later_claim"] } },
  { name: "extract_memory_facts", description: "Persist a quantified fact for future comprehension.", parameters: { type: "object", properties: { session_id: { type: "string" }, fact: { type: "string" }, value: { type: "string" }, source_turn_id: { type: "string" } }, required: ["session_id", "fact", "value"] } },
  { name: "generate_readiness_memo", description: "Compile the seven-axis readiness memo.", parameters: { type: "object", properties: { session_id: { type: "string" } }, required: ["session_id"] } }
];

async function handleTool(env: Env, name: string, args: Json) {
  if (name === "search_web") return searchWeb(env, text(args.query));
  if (name === "record_drill_turn") { await writeTurn(env, args); return { ok: true }; }
  if (name === "flag_discrepancy") { await writeDiscrepancy(env, args); return { ok: true }; }
  if (name === "extract_memory_facts") { await writeMemory(env, args); return { ok: true }; }
  if (name === "generate_readiness_memo") return env.DB.prepare("SELECT axis, score, gaps, remediation FROM readiness_scores WHERE session_id = ? ORDER BY axis").bind(text(args.session_id)).all();
  throw new Error(`Unknown tool: ${name}`);
}

async function reason(env: Env, input: Json) {
  const sessionId = text(input.session_id || crypto.randomUUID());
  const turns = Array.isArray(input.turns) ? input.turns as Turn[] : [];
  const memories = await env.DB.prepare("SELECT fact, value FROM memory_facts WHERE session_id = ? ORDER BY created_at DESC LIMIT 100").bind(sessionId).all();
  const prior = turns.slice(-20).map(t => `${t.role}: ${t.content}`).join("\n");
  const facts = memories.results.map((m: Json) => `${m.fact}: ${m.value}`).join("\n");
  const comprehension = await callModel(env, `You are Athena's comprehension and extraction pass. Extract claims, metrics, assumptions, evidence, requested outcome, and uncertainty. Prior turns:\n${prior}\nMemory facts:\n${facts}\nCurrent input:\n${text(input.message)}\nReturn precise JSON.`, []);
  const audit = await callModel(env, `You are Athena's forensic contradiction auditor. Compare the extracted material with prior turns and memory. Identify cross-turn contradictions, stale metrics, unsupported claims, and missing evidence. Return JSON with discrepancies and verification queries.\n${comprehension}`, []);
  const searches = (audit.match(/"(?:query|queries)"\s*:\s*"([^"]+)/g) || []).slice(0, 3).map(x => x.replace(/^.*?:\s*"/, ""));
  const evidence = []; for (const query of searches) { try { evidence.push(await searchWeb(env, query)); } catch (e) { evidence.push({ error: text(e) }); } }
  const rubric = await callModel(env, `You are Athena's rubric scoring and remediation pass. Score exactly these seven axes from 0-10: ${AXES.join(", ")}. Give evidence, gap, and next remediation for each. Do not invent facts.\nExtraction:${comprehension}\nAudit:${audit}\nWeb evidence:${JSON.stringify(evidence)}`, []);
  const final = await callModel(env, `You are Athena's final response formulation pass. Answer the founder directly and concisely. Separate confirmed facts, assumptions, contradictions, scores, and concrete next actions. Never expose hidden chain-of-thought; provide conclusions and brief rationales only.\nRubric:${rubric}\nAudit:${audit}`, [{ role: "user", content: text(input.message) }]);
  await writeTurn(env, { session_id: sessionId, role: "user", content: text(input.message) });
  return { session_id: sessionId, response: final, analysis: { comprehension, audit, rubric }, web_evidence: evidence };
}

async function tts(env: Env, value: string, options: Json = {}) {
  if (!env.ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY is not configured");
  const voice = text(options.voice_id || env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM");
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, { method: "POST", headers: { "xi-api-key": env.ELEVENLABS_API_KEY, "content-type": "application/json", accept: "audio/mpeg" }, body: JSON.stringify({ text: value, model_id: options.model_id || env.ELEVENLABS_MODEL_ID || "eleven_turbo_v2_5", voice_settings: { stability: options.stability ?? 0.5, similarity_boost: options.similarity_boost ?? 0.75 } }) });
  if (!response.ok) throw new Error(`ElevenLabs failed: ${response.status}`);
  return response;
}

export default { async fetch(request: Request, env: Env): Promise<Response> { const url = new URL(request.url); try { if (request.method === "POST" && url.pathname === "/v1/athena") { const input = await body(request); const result = await reason(env, input); if (input.voice === true || input.audio === true) { const audio = await tts(env, result.response, input as Json); result.audio_base64 = btoa(String.fromCharCode(...new Uint8Array(await audio.arrayBuffer()))); result.audio_content_type = "audio/mpeg"; } return json(result); } if (request.method === "POST" && url.pathname === "/v1/tts") { const input = await body(request); const audio = await tts(env, text(input.text), input); return new Response(audio.body, { headers: { "content-type": "audio/mpeg", "cache-control": "no-store" } }); } if (request.method === "POST" && url.pathname === "/v1/tool") { const input = await body(request); return json(await handleTool(env, text(input.name), (input.arguments || {}) as Json)); } return json({ service: "athena-d1", status: "ok", endpoints: ["POST /v1/athena", "POST /v1/tts", "POST /v1/tool"] }); } catch (error) { return json({ error: text(error) }, 500); } } };
