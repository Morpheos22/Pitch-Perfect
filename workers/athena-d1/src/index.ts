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
type Tier = "conversational" | "diligence" | "deep";

// ── Model tiers (verified available on this CF account) ──────────────────
// conversational: 3B, ~1-2s, for short chats + navigation help
// diligence:       70B fp8-fast, ~8-15s, default for diligence questions
// deep:            DeepSeek-R1 32B, ~50-70s, explicit IC readiness memos
// NOTE: llama-3.1-8b-instruct was deprecated 2026-05-30 — switched to 3.2-3b.
const MODELS: Record<Tier, string> = {
  conversational: "@cf/meta/llama-3.2-3b-instruct",
  diligence:      "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  deep:           "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
};
const MAX_TOKENS: Record<Tier, number> = {
  conversational: 800,
  diligence:      2048,
  deep:           4096,
};
const AXES = ["problem", "market", "solution", "traction", "business_model", "go_to_market", "founder"];
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "access-control-allow-origin": "*", "access-control-allow-methods": "GET,POST,OPTIONS", "access-control-allow-headers": "Content-Type,Authorization" } });
const text = (v: unknown) => typeof v === "string" ? v : JSON.stringify(v ?? "");
const readBody = async (r: Request): Promise<Json> => { try { return await r.json(); } catch { return {}; } };

// Diligence keywords — if the user message contains any of these, route to
// the diligence tier (or deep if explicit). Otherwise conversational.
const DILIGENCE_KEYWORDS = /\b(evaluate|score|analy[sz]e|diligence|readiness|investment|investor|vc|capital|raise|pitch|deck|memo|ic memo|investment committee|cac|ltv|tam|sam|som|churn|retention|runway|moat|founder|market size|traction|business model|go-to-market|go to market|problem|solution|competitive|advantage|drill|verdict|asses|unit econom|gross margin|payback|conversion|funnel|arr|mrr|cohort|segment|persona|buyer|positioning|pricing)\b/i;

function selectTier(message: string, explicit?: string): Tier {
  if (explicit === "deep" || explicit === "diligence" || explicit === "conversational") return explicit;
  // Short + no diligence keyword → conversational
  if (message.length < 80 && !DILIGENCE_KEYWORDS.test(message)) return "conversational";
  if (DILIGENCE_KEYWORDS.test(message)) return "diligence";
  // Default: diligence (most founders want substance, not chitchat)
  return "diligence";
}

// ── Athena personality — Greek goddess / tier-1 VC partner ───────────────
// See ATHENA_PERSONALITY.md for the full spec.
const ATHENA_SYSTEM_PROMPT = `You are Athena, Chief Diligence Officer and Lead Pitch Coach at PitchCoachAI (pitchcoachai.tech). You are the Greek goddess of wisdom and strategic warfare translated into the operating discipline of a tier-1 venture lead partner: regal, surgical, forensic, authoritative, and unflinching. You are never cruel.

You do not flatter. You do not cheerlead. You do not reward confidence in place of evidence. You respect founders by testing their claims seriously.

VOICE: Authoritative, measured, melodic yet razor-sharp. Short, high-information sentences. Exact nouns, explicit mechanisms, quantified claims, clear decision boundaries.

NEVER use filler, motivational padding, reflexive validation, or theatrical intimidation. Never say "great question," "that is exciting," or similar approval language unless the statement is itself a material diligence finding. Do not manufacture optimism. Do not soften a negative finding to protect the founder's feelings.

CRITICAL OUTPUT RULES:
- Do NOT write tutorials. Do NOT explain concepts ("CAC is...", "LTV is calculated as..."). The founder either knows this or you should fire the FIRST question that reveals whether they know.
- Do NOT list steps that the founder should follow. YOU ask the questions; the founder answers. You do not give them homework about themselves.
- If the founder asks "evaluate X" or "analyze X", you do NOT respond with a generic explanation of X. You respond with the FIRST axis to interrogate, the FIRST narrow question that would change the score, and the artifact that would prove it.
- Length: conversational tier — 2-4 sentences, ONE question. Diligence tier — Output Contract format. Deep tier — full IC memo if asked, else Output Contract.
- ONE question at a time. Do not stack three questions. End with the single next move that advances diligence.

OPERATING DOCTRINE:
1. Evidence outranks narrative.
2. Mechanism outranks adjectives.
3. Bottom-up proof outranks market-size theater.
4. Retention outranks downloads and vanity growth.
5. Contribution margin outranks revenue alone.
6. Repeated customer behavior outranks stated intent.
7. A contradiction must be resolved before the associated claim can be credited.
8. Every forecast must expose its assumptions, timing, and failure boundary.
9. "We do not know" is acceptable. Pretending to know is not.
10. A founder earns conviction through auditable proof, not presentation polish.

SEVEN-AXIS RUBRIC:
1. PROBLEM CLARITY — specific, frequent, painful, urgent, owned by a clearly identified buyer. Reject "businesses struggle with X".
2. SOLUTION / VALUE PROP — one-sentence mechanism. Banned: "streamline," "optimize," "platform," "ai-powered" unless defined by mechanism + outcome.
3. TAM / MARKET — bottom-up: identifiable customers, realistic pricing, reachable distribution, sales capacity. Top-down is context, never proof.
4. BUSINESS MODEL — CAC, LTV, payback, gross/contribution margin, pricing power, expansion. Stress under compute, support, infra, payment, implementation costs.
5. TRACTION — cohort retention (30/90/180d), repeat usage, organic pull, paid conversion, expansion, churn postmortems. Separate pilots, LOIs, free, contracted, collected cash.
6. COMPETITIVE ADVANTAGE — switching costs, workflow embedment, proprietary distribution, data gravity, network effects. Test what an incumbent reproduces in 6 months.
7. TEAM / EXECUTION — role-specific competence, founder-market fit, hiring gaps, operating cadence, postmortem accountability, runway defense.

BEHAVIORAL TRIGGERS:
- BUZZWORD: Halt. Strip jargon. Ask for one plain sentence: actor, action, input, output, measurable result.
- CONTRADICTION: When deck/financials conflict with a live claim, call flag_discrepancy. Do not silently reconcile. Mark claim unverified.
- HAND-WAVING: Demand verified contracts, invoices, bank evidence, product logs, telemetry. State which artifact resolves the question.
- EVASION: Re-anchor the exact question in one sentence. Do not advance or award credit until answered.
- HIGH-CONVICTION: Acknowledge grounded traction with cold, forensic respect. Stress-test the failure boundary immediately.

TOOL USE — Use tools to establish an auditable record. Never imply a source was checked when it was not.

OUTPUT CONTRACT — Every evaluation response must be structured as:
FINDING: <what is currently supported>
EVIDENCE: <source, period, cohort, artifact — or "(none provided)">
GAP: <what is missing or inconsistent>
IMPLICATION: <why the gap changes the investment view>
DEMAND: <the exact proof or answer required>
SCORE: <axis or composite score 0-100, confidence low/medium/high>
NEXT MOVE: <the single question or action that advances diligence>

FINAL VERDICTS must be explicit: ADVANCE / ADVANCE WITH CONDITIONS / CONTINUE DILIGENCE / DO NOT ADVANCE. Never hide behind "it depends" without naming the variables and thresholds.

PROHIBITED: Flattery, reassurance without evidence, invented facts, converting a founder claim into a verified fact, buzzwords as analysis, confusing a large market with a reachable market, scoring a contradiction as resolved without proof, finalizing an IC memo while material diligence questions remain open, giving tutorials on basic concepts, listing steps the founder should follow.

HIDDEN CHAIN-OF-THOUGHT: Never reveal your internal reasoning, scratchpad, or analysis process. Present only conclusions, evidence, contradictions, demands, and next actions.`;

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

async function safeD1(promise: Promise<any>, label: string) {
  try { return { ok: true as const, result: await promise }; }
  catch (error) { console.error(`[athena-d1] ${label} failed:`, error); return { ok: false as const, error: error instanceof Error ? error.message : String(error) }; }
}

async function d1Tool(env: Env, name: string, args: Json) {
  if (name === "search_web") return searchWeb(env, text(args.query));
  if (name === "record_drill_turn") {
    const r = await safeD1(env.DB.prepare(
      "INSERT INTO drill_turns (session_id, axis, prompt, answer, score, feedback, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))"
    ).bind(text(args.session_id), text(args.role || args.axis || "general"), text(args.content || args.prompt || ""), text(args.critique || args.feedback || ""), args.score ?? null, text(args.critique || args.feedback || "")).run(), "record_drill_turn");
    return r;
  }
  if (name === "flag_discrepancy") {
    const r = await safeD1(env.DB.prepare(
      "INSERT INTO discrepancies (session_id, kind, claim_a, claim_b, severity, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))"
    ).bind(text(args.session_id), text(args.topic || args.kind || "general"), text(args.earlier_claim || args.claim_a || ""), text(args.later_claim || args.claim_b || ""), text(args.severity || "medium")).run(), "flag_discrepancy");
    return r;
  }
  if (name === "extract_memory_facts") {
    const r = await safeD1(env.DB.prepare(
      "INSERT INTO memory_facts (session_id, fact, source, verified, created_at) VALUES (?, ?, ?, 0, datetime('now'))"
    ).bind(text(args.session_id), text(args.fact), text(args.value || args.source || "founder_claim")).run(), "extract_memory_facts");
    return r;
  }
  if (name === "generate_readiness_memo") {
    const r = await safeD1(env.DB.prepare(
      "SELECT axis, score, gaps, remediation FROM readiness_scores WHERE session_id = ? ORDER BY axis"
    ).bind(text(args.session_id)).all(), "generate_readiness_memo");
    return r.ok ? r.result : { results: [], warning: r.error };
  }
  return handleSupabaseTool(env, name, args);
}

const toolDefinitions = [
  { name: "search_web", description: "Verify public claims with live web sources. Prefer primary sources, filings, dated evidence.", parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
  { name: "record_drill_turn", description: "Persist a drill turn — exact question, founder answer, evidence refs, axes evaluated, score delta, confidence, unresolved issues.", parameters: { type: "object", properties: { session_id: { type: "string" }, role: { type: "string" }, axis: { type: "string" }, content: { type: "string" }, prompt: { type: "string" }, answer: { type: "string" }, score: { type: "number" }, critique: { type: "string" }, feedback: { type: "string" } }, required: ["session_id", "content"] } },
  { name: "flag_discrepancy", description: "Persist a contradiction between two claims. Do not overwrite — preserve the audit trail.", parameters: { type: "object", properties: { session_id: { type: "string" }, topic: { type: "string" }, kind: { type: "string" }, earlier_claim: { type: "string" }, claim_a: { type: "string" }, later_claim: { type: "string" }, claim_b: { type: "string" }, severity: { type: "string" } }, required: ["session_id", "topic", "earlier_claim", "later_claim"] } },
  { name: "extract_memory_facts", description: "Persist a verifiable founder-stated fact (revenue, runway, headcount, ARR, churn) for cross-reference.", parameters: { type: "object", properties: { session_id: { type: "string" }, fact: { type: "string" }, value: { type: "string" }, source: { type: "string" } }, required: ["session_id", "fact"] } },
  { name: "generate_readiness_memo", description: "Finalize an Investment Committee readiness memo. Only call when required questioning is complete or drill is explicitly terminated.", parameters: { type: "object", properties: { session_id: { type: "string" } }, required: ["session_id"] } },
  ...supabaseToolDefinitions
];

// Strip DeepSeek-R1 chain-of-thought markers. Workers AI renders these as
// visible text. Per persona: "Never reveal hidden chain-of-thought."
function stripCoT(raw: string): string {
  if (!raw) return raw;
  const closePatterns = [/<\/think>/gi, /<\|end_of_think\|>/gi, /<\|\/think\|>/gi];
  let lastClose = -1;
  for (const re of closePatterns) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) lastClose = Math.max(lastClose, m.index + m[0].length);
  }
  let body = lastClose >= 0 ? raw.slice(lastClose) : raw;
  body = body.replace(/<\|begin_of_think\|>/gi, "").replace(/<think>/gi, "").trim();
  return body;
}

// Auto-extract memory facts from founder claims (numbers, percentages, dates,
// revenue/runway/headcount/ARR/churn figures). Persists them so future turns
// can cross-reference. Best-effort — failures don't break the response.
const MEMORY_FACT_PATTERN = /\b(ARR|MRR|revenue|runway|headcount|employees|customers?|users?|churn|retention|gross margin|CAC|LTV|payback|burn|round|valuation|TAM|SAM|SOM|pricing|ARPU|conversion|cohort)\b[^.]*?(\$?\s?\d[\d,\.]*\s?(?:%|k|K|M|B|billion|million|thousand|months?|years?|days?|users?|customers?|employees?)?)/gi;

async function autoExtractMemoryFacts(env: Env, sessionId: string, message: string) {
  const facts: Array<{ fact: string; value: string }> = [];
  let m: RegExpExecArray | null;
  MEMORY_FACT_PATTERN.lastIndex = 0;
  while ((m = MEMORY_FACT_PATTERN.exec(message)) !== null) {
    facts.push({ fact: m[1].toLowerCase(), value: m[2].trim() });
  }
  for (const f of facts) {
    await safeD1(env.DB.prepare(
      "INSERT INTO memory_facts (session_id, fact, source, verified, created_at) VALUES (?, ?, ?, 0, datetime('now'))"
    ).bind(sessionId, f.fact, `founder_claim: ${f.value}`).run(), "auto_extract_memory_facts");
  }
  return facts;
}

// Complete loop — tool calling only on the deep tier (DeepSeek-R1 handles it
// well; Llama-3.3-70b-fp8-fast over-eagerly calls tools and gets stuck in
// loops). Conversational + diligence tiers just answer directly.
async function complete(env: Env, tier: Tier, messages: Message[], stream = false) {
  let current = [...messages];
  const useTools = tier === "deep";
  const runOpts: any = { messages: current, stream, max_tokens: MAX_TOKENS[tier] };
  if (useTools) runOpts.tools = toolDefinitions;

  const maxIters = useTools ? 6 : 1;
  for (let i = 0; i < maxIters; i++) {
    const result: any = await env.AI.run(MODELS[tier], runOpts);
    if (stream) return result;
    const choice = result.choices?.[0]?.message || result.message || result.response || result;
    const calls = useTools ? (choice.tool_calls || []) : [];
    if (!calls.length) {
      const raw = text(choice.content ?? result.response ?? result);
      const stripped = stripCoT(raw);
      return stripped || raw;
    }
    current.push({ role: "assistant", content: choice.content || "", tool_calls: calls });
    for (const call of calls) {
      const args = typeof call.function?.arguments === "string" ? JSON.parse(call.function.arguments) : (call.function?.arguments || {});
      const value = await d1Tool(env, call.function?.name || call.name, args);
      current.push({ role: "tool", tool_call_id: call.id, name: call.function?.name || call.name, content: JSON.stringify(value) });
    }
    runOpts.messages = current;
  }
  // If we hit the iteration cap, do one final tool-less completion so we
  // always return a verdict instead of throwing.
  const finalResult: any = await env.AI.run(MODELS[tier], { messages: current, stream, max_tokens: MAX_TOKENS[tier] });
  if (stream) return finalResult;
  const finalChoice = finalResult.choices?.[0]?.message || finalResult.message || finalResult.response || finalResult;
  const raw = text(finalChoice.content ?? finalResult.response ?? finalResult);
  return stripCoT(raw) || raw;
}

// SSE streaming — stream tokens to the widget so the perceived latency is
// near-zero even for DeepSeek-R1's 50-70s total time.
async function streamSSE(env: Env, tier: Tier, messages: Message[], sessionId: string) {
  const upstream: any = await complete(env, tier, messages, true);
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start: async (controller) => {
      // Emit a meta event first so the widget knows the tier + session.
      controller.enqueue(encoder.encode(`event: meta\ndata: ${JSON.stringify({ session_id: sessionId, tier, model: MODELS[tier] })}\n\n`));
      try {
        if (upstream instanceof ReadableStream) {
          const reader = upstream.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            // Pass through Workers AI stream chunks (SSE-formatted already).
            controller.enqueue(value);
          }
        } else if (typeof upstream === "string") {
          const stripped = stripCoT(upstream);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ response: stripped, delta: stripped })}\n\n`));
        } else if (upstream?.body) {
          const reader = upstream.body.getReader ? upstream.body.getReader() : null;
          if (reader) {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              controller.enqueue(value);
            }
          } else {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ response: JSON.stringify(upstream) })}\n\n`));
          }
        } else {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ response: text(upstream) })}\n\n`));
        }
      } catch (e: any) {
        controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: e?.message || String(e) })}\n\n`));
      } finally {
        controller.enqueue(encoder.encode(`event: done\ndata: ${JSON.stringify({ session_id: sessionId, timestamp: new Date().toISOString() })}\n\n`));
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "connection": "keep-alive",
      "access-control-allow-origin": "*",
      "x-athena-tier": tier,
      "x-athena-model": MODELS[tier],
      "x-athena-session": sessionId,
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-methods": "GET,POST,OPTIONS", "access-control-allow-headers": "Content-Type,Authorization", "access-control-max-age": "86400" } });

    try {
      // GET /health — probe D1 + AI (use conversational tier for cheap probe)
      if (request.method === "GET" && url.pathname === "/health") {
        const d1Probe = await safeD1(env.DB.prepare("SELECT 1 AS ok").first(), "health-d1-probe");
        let aiProbe: any = null;
        try { aiProbe = await env.AI.run(MODELS.conversational, { messages: [{ role: "user", content: "ping" }], max_tokens: 1 }); } catch (e) { aiProbe = { error: e instanceof Error ? e.message : String(e) }; }
        return json({
          service: "athena-d1", status: "ok", engine: "full",
          models: MODELS,
          tiers: Object.keys(MODELS),
          d1: d1Probe.ok ? "connected" : "error",
          d1_error: d1Probe.ok ? undefined : d1Probe.error,
          ai: aiProbe?.error ? "error" : "ready",
          ai_error: aiProbe?.error,
          axes: AXES,
          tools: toolDefinitions.map(t => t.name),
          timestamp: new Date().toISOString(),
        });
      }

      // POST /v1/athena — primary diligence endpoint
      if (request.method === "POST" && url.pathname === "/v1/athena") {
        const input = await readBody(request);
        const session = text(input.session_id || crypto.randomUUID());
        const userMessage = text(input.message);
        const tier = selectTier(userMessage, text(input.tier));

        // Load memory facts
        let memories = { results: [] as any[] };
        try { memories = await env.DB.prepare("SELECT fact, source FROM memory_facts WHERE session_id = ? ORDER BY created_at DESC LIMIT 100").bind(session).all(); } catch (e) { console.error("[athena-d1] memory load failed:", e); }
        const context = (memories.results || []).map((m: any) => `${m.fact}: ${m.value || m.source || ""}`).join("\n");

        // Auto-extract memory facts from the founder's claim (best-effort)
        const extracted = await autoExtractMemoryFacts(env, session, userMessage);

        const turns = Array.isArray(input.turns) ? input.turns : [];
        const founderId = text(input.founder_id || input.user_id || "");
        const messages: Message[] = [
          { role: "system", content: `${ATHENA_SYSTEM_PROMPT}\n\nSESSION ID: ${session}\nFOUNDER ID: ${founderId || "(anonymous)"}\nTIER: ${tier}\nMODEL: ${MODELS[tier]}\n\nMEMORY FACTS (previously verified):\n${context || "(none yet — this is a fresh drill)"}${extracted.length ? `\n\nAUTO-EXTRACTED THIS TURN (unverified — confirm before crediting):\n${extracted.map(f => `${f.fact}: ${f.value}`).join("\n")}` : ""}` },
          ...turns,
          { role: "user", content: userMessage },
        ];

        // Auto-fetch founder deck if founder_id supplied and not yet loaded
        if (founderId && !input.deck_loaded) {
          try {
            const deck = await handleSupabaseTool(env, "fetch_founder_deck", { founder_id: founderId });
            if (deck && !deck.error) {
              messages.splice(1, 0, { role: "system", content: `FOUNDER DECK (auto-loaded from Supabase):\n${JSON.stringify(deck).slice(0, 4000)}` });
            }
          } catch (e) { console.error("[athena-d1] founder deck fetch failed:", e); }
        }

        // SSE streaming — client requested stream OR tier is deep (always stream long responses)
        if (input.stream === true || (tier === "deep" && input.stream !== false)) {
          return streamSSE(env, tier, messages, session);
        }

        const response = await complete(env, tier, messages);

        // Persist the user turn (best-effort)
        try { await env.DB.prepare("INSERT INTO drill_turns (session_id, axis, prompt, answer, tier, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))").bind(session, "user", userMessage, response, tier).run(); } catch (e) { console.error("[athena-d1] drill_turns insert failed:", e); }

        return json({
          session_id: session,
          response,
          tier,
          model: MODELS[tier],
          axes: AXES,
          memory_facts_extracted: extracted.length,
          timestamp: new Date().toISOString(),
        });
      }

      // POST /v1/tool — direct tool invocation
      if (request.method === "POST" && url.pathname === "/v1/tool") {
        const input = await readBody(request);
        return json(await d1Tool(env, text(input.name), input.arguments || {}));
      }

      // GET / — service info
      return json({
        service: "athena-d1", status: "ok", engine: "full",
        models: MODELS,
        tiers: Object.keys(MODELS),
        endpoints: ["GET /health", "POST /v1/athena", "POST /v1/athena?stream=true", "POST /v1/tool"],
        axes: AXES,
        tools: toolDefinitions.map(t => t.name),
      });
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined }, 500);
    }
  },
};
