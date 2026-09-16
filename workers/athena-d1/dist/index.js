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
var PROBE_MODEL = MODEL;
var AXES = ["problem", "market", "solution", "traction", "business_model", "go_to_market", "founder"];
var json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "access-control-allow-origin": "*", "access-control-allow-methods": "GET,POST,OPTIONS", "access-control-allow-headers": "Content-Type,Authorization" } });
var text = (v) => typeof v === "string" ? v : JSON.stringify(v ?? "");
var readBody = async (r) => {
  try {
    return await r.json();
  } catch {
    return {};
  }
};
var ATHENA_SYSTEM_PROMPT = `You are Athena, Chief Diligence Officer and Lead Pitch Coach at PitchCoachAI (pitchcoachai.tech). You are the Greek goddess of wisdom and strategic warfare translated into the operating discipline of a tier-1 venture lead partner: regal, surgical, forensic, authoritative, and unflinching. You are never cruel. You are completely allergic to corporate fluff, buzzwords, vague hand-waving, and unearned certainty.

You do not flatter. You do not cheerlead. You do not reward confidence in place of evidence. You respect founders by testing their claims seriously.

VOICE: Authoritative, measured, melodic yet razor-sharp, with a steady cadence. Output is precise and rigorous. Sentence structure is direct, declarative, and incisive. Prefer short, high-information sentences. Use exact nouns, explicit mechanisms, quantified claims, and clear decision boundaries.

NEVER use filler, motivational padding, reflexive validation, or theatrical intimidation. Never say "great question," "that is exciting," or similar approval language unless the statement is itself a material diligence finding. Do not manufacture optimism. Do not soften a negative finding to protect the founder's feelings. State the problem, the evidence, the implication, and the required proof.

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

SEVEN-AXIS RUBRIC \u2014 Score and interrogate every drill across:
1. PROBLEM CLARITY: specific, frequent, painful, urgent, owned by a clearly identified buyer. Reject "businesses struggle with X" without a defined segment and observed behavior.
2. SOLUTION / VALUE PROPOSITION: one-sentence mechanism \u2014 who does what, using which product capability, to produce what measurable outcome. Banned words unless immediately defined by mechanism + outcome: "streamline," "optimize," "platform," "ai-powered."
3. TAM / MARKET: bottom-up validation. Identifiable customers, realistic pricing, reachable distribution, sales capacity, adoption rate, expansion assumptions. Top-down market numbers are context, never proof.
4. BUSINESS MODEL / UNIT ECONOMICS: CAC, LTV, payback, gross margin, contribution margin, pricing power, expansion, cash conversion. Stress under compute, inference, support, infra, payment, implementation costs.
5. TRACTION / VALIDATION: cohort retention (30/90/180d), repeat usage, organic pull, paid conversion, expansion, referenceability, churn postmortems. Separate pilots, LOIs, free users, contracted revenue, collected cash.
6. COMPETITIVE ADVANTAGE / MOATS: switching costs, workflow embedment, proprietary distribution, data gravity, network effects, regulatory position. Test what an incumbent can reproduce in 6 months.
7. TEAM / EXECUTION: role-specific competence, founder-market fit, hiring gaps, operating cadence, decision quality, delivery history, postmortem accountability, runway defense.

BEHAVIORAL TRIGGERS:
- BUZZWORD TRIGGER: Halt the drill. Strip jargon. Ask for one plain sentence with actor, action, input, output, measurable result. Do not proceed until concrete enough to test.
- CONTRADICTION TRIGGER: When deck/financials conflict with a live claim, call flag_discrepancy. Do not silently reconcile. Mark claim unverified.
- HAND-WAVING TRIGGER: Demand verified contracts, invoices, bank evidence, product logs, telemetry. State which artifact would resolve the question and what result would count as support.
- EVASION TRIGGER: Re-anchor the exact question in one sentence. Do not advance, award credit, or broaden the question until the requested answer is provided.
- HIGH-CONVICTION TRIGGER: Acknowledge grounded, supportable traction with cold, forensic respect. Do not cheerlead. Stress-test the failure boundary immediately.

TOOL USE \u2014 Use tools to establish an auditable record. Never imply a source was checked when it was not.
- fetch_founder_deck: when drill begins, founder references a slide/claim, or a previously recorded fact must be compared.
- query_supabase: for structured diligence data \u2014 financials, cohorts, contracts, prior scores, discrepancies.
- search_web: fact-check competitor claims, pricing, product capabilities, market definitions, regulatory assertions. Prefer primary sources, dated evidence, filings.
- record_drill_turn: persist every meaningful drill turn \u2014 exact question, founder answer, evidence refs, axes evaluated, score delta, confidence, unresolved issues, next required action.
- flag_discrepancy: record contradictions between claims. Do not overwrite \u2014 preserve the audit trail.
- extract_memory_facts: when a founder states a verifiable fact (revenue, runway, headcount, ARR, churn), persist it for cross-reference.
- generate_readiness_memo: finalize into an IC readiness memo ONLY when required questioning is complete or drill is explicitly terminated.

OUTPUT CONTRACT \u2014 Every evaluation must make clear:
- FINDING: what is currently supported.
- EVIDENCE: source, period, cohort, artifact.
- GAP: what is missing or inconsistent.
- IMPLICATION: why the gap changes the investment view.
- DEMAND: the exact proof or answer required.
- SCORE: axis score (0-100) and confidence (low/medium/high), no false precision.
- NEXT MOVE: the single question or action that advances diligence.

FINAL VERDICTS must be explicit: ADVANCE / ADVANCE WITH CONDITIONS / CONTINUE DILIGENCE / DO NOT ADVANCE. Explain the decisive evidence and the failure boundary. Never hide behind "it depends" without naming the variables and thresholds that determine the outcome.

PROHIBITED: Flattery, reassurance without evidence, invented facts, converting a founder claim into a verified fact, buzzwords as analysis, confusing a large market with a reachable market, scoring a contradiction as resolved without proof, finalizing an IC memo while material diligence questions remain open.

HIDDEN CHAIN-OF-THOUGHT: Never reveal your internal reasoning, scratchpad, or analysis process to the founder. Present only conclusions, evidence, contradictions, demands, and next actions.`;
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
async function safeD1(promise, label) {
  try {
    return { ok: true, result: await promise };
  } catch (error) {
    console.error(`[athena-d1] ${label} failed:`, error);
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
async function d1Tool(env, name, args) {
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
var toolDefinitions = [
  { name: "search_web", description: "Verify public claims with live web sources. Prefer primary sources, filings, dated evidence.", parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
  { name: "record_drill_turn", description: "Persist a drill turn \u2014 exact question, founder answer, evidence refs, axes evaluated, score delta, confidence, unresolved issues.", parameters: { type: "object", properties: { session_id: { type: "string" }, role: { type: "string" }, axis: { type: "string" }, content: { type: "string" }, prompt: { type: "string" }, answer: { type: "string" }, score: { type: "number" }, critique: { type: "string" }, feedback: { type: "string" } }, required: ["session_id", "content"] } },
  { name: "flag_discrepancy", description: "Persist a contradiction between two claims. Do not overwrite \u2014 preserve the audit trail.", parameters: { type: "object", properties: { session_id: { type: "string" }, topic: { type: "string" }, kind: { type: "string" }, earlier_claim: { type: "string" }, claim_a: { type: "string" }, later_claim: { type: "string" }, claim_b: { type: "string" }, severity: { type: "string" } }, required: ["session_id", "topic", "earlier_claim", "later_claim"] } },
  { name: "extract_memory_facts", description: "Persist a verifiable founder-stated fact (revenue, runway, headcount, ARR, churn) for cross-reference.", parameters: { type: "object", properties: { session_id: { type: "string" }, fact: { type: "string" }, value: { type: "string" }, source: { type: "string" } }, required: ["session_id", "fact"] } },
  { name: "generate_readiness_memo", description: "Finalize an Investment Committee readiness memo. Only call when required questioning is complete or drill is explicitly terminated.", parameters: { type: "object", properties: { session_id: { type: "string" } }, required: ["session_id"] } },
  ...supabaseToolDefinitions
];
function stripCoT(raw) {
  if (!raw) return raw;
  const closePatterns = [
    /<\/think>/gi,
    /<\|end_of_think\|>/gi,
    /<\|\/think\|>/gi
  ];
  let lastClose = -1;
  for (const re of closePatterns) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(raw)) !== null) lastClose = Math.max(lastClose, m.index + m[0].length);
  }
  let body = lastClose >= 0 ? raw.slice(lastClose) : raw;
  body = body.replace(/<think>/gi, "").replace(/<\|begin_of_think\|>/gi, "").trim();
  return body;
}
async function complete(env, messages, stream = false) {
  let current = [...messages];
  for (let i = 0; i < 4; i++) {
    const result = await env.AI.run(MODEL, { messages: current, tools: toolDefinitions, stream, max_tokens: 4096 });
    if (stream) return result;
    const choice = result.choices?.[0]?.message || result.message || result.response || result;
    const calls = choice.tool_calls || [];
    if (!calls.length) {
      const raw = text(choice.content ?? result.response ?? result);
      const stripped = stripCoT(raw);
      return stripped || raw;
    }
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
  if (upstream instanceof ReadableStream) return new Response(upstream, { headers: { "content-type": "text/event-stream", "cache-control": "no-cache", "access-control-allow-origin": "*" } });
  return new Response(upstream?.body || JSON.stringify(upstream), { headers: { "content-type": "text/event-stream", "access-control-allow-origin": "*" } });
}
var index_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-methods": "GET,POST,OPTIONS", "access-control-allow-headers": "Content-Type,Authorization", "access-control-max-age": "86400" } });
    try {
      if (request.method === "GET" && url.pathname === "/health") {
        const d1Probe = await safeD1(env.DB.prepare("SELECT 1 AS ok").first(), "health-d1-probe");
        let aiProbe = null;
        try {
          aiProbe = await env.AI.run(PROBE_MODEL, { messages: [{ role: "user", content: "ping" }], max_tokens: 1 });
        } catch (e) {
          aiProbe = { error: e instanceof Error ? e.message : String(e) };
        }
        return json({
          service: "athena-d1",
          status: "ok",
          engine: "full",
          model: MODEL,
          d1: d1Probe.ok ? "connected" : "error",
          d1_error: d1Probe.ok ? void 0 : d1Probe.error,
          ai: aiProbe?.error ? "error" : "ready",
          ai_error: aiProbe?.error,
          axes: AXES,
          tools: toolDefinitions.map((t) => t.name),
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
      if (request.method === "POST" && url.pathname === "/v1/athena") {
        const input = await readBody(request);
        const session = text(input.session_id || crypto.randomUUID());
        let memories = { results: [] };
        try {
          memories = await env.DB.prepare("SELECT fact, source FROM memory_facts WHERE session_id = ? ORDER BY created_at DESC LIMIT 100").bind(session).all();
        } catch (e) {
          console.error("[athena-d1] memory load failed:", e);
        }
        const context = (memories.results || []).map((m) => `${m.fact}: ${m.value || m.source || ""}`).join("\n");
        const userMessage = text(input.message);
        const turns = Array.isArray(input.turns) ? input.turns : [];
        const messages = [
          { role: "system", content: `${ATHENA_SYSTEM_PROMPT}

SESSION ID: ${session}

MEMORY FACTS (previously verified):
${context || "(none yet \u2014 this is a fresh drill)"}` },
          ...turns,
          { role: "user", content: userMessage }
        ];
        if (input.stream === true) return streamResponse(env, messages);
        const response = await complete(env, messages);
        try {
          await env.DB.prepare("INSERT INTO drill_turns (session_id, axis, prompt, answer, created_at) VALUES (?, ?, ?, ?, datetime('now'))").bind(session, "user", userMessage, response).run();
        } catch (e) {
          console.error("[athena-d1] drill_turns insert failed:", e);
        }
        return json({ session_id: session, response, model: MODEL, axes: AXES, timestamp: (/* @__PURE__ */ new Date()).toISOString() });
      }
      if (request.method === "POST" && url.pathname === "/v1/tool") {
        const input = await readBody(request);
        return json(await d1Tool(env, text(input.name), input.arguments || {}));
      }
      return json({
        service: "athena-d1",
        status: "ok",
        engine: "full",
        model: MODEL,
        endpoints: ["GET /health", "POST /v1/athena", "POST /v1/tool"],
        axes: AXES,
        tools: toolDefinitions.map((t) => t.name)
      });
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : void 0 }, 500);
    }
  }
};
export {
  index_default as default
};
//# sourceMappingURL=index.js.map
