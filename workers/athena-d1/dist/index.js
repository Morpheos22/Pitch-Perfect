// src/supabase-tools.ts
var KNOWN_SUPABASE_TABLES = [
  "pitch_decks",
  "users"
];
var supabaseToolDefinitions = [
  {
    name: "query_supabase",
    description: `Query PitchCoach records in Supabase PostgREST. AVAILABLE TABLES (use ONLY these \u2014 others will 404): ${KNOWN_SUPABASE_TABLES.join(", ")}. Returns data + provenance metadata (timestamp, source label, table, query params) so every claim can be traced back to its source. Use narrow queries. Never treat an empty result as proof of absence; report as "unverified".`,
    parameters: {
      type: "object",
      properties: {
        table: { type: "string", enum: KNOWN_SUPABASE_TABLES },
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
    description: "Fetch a founder's uploaded pitch deck + user record from Supabase. Returns pitch_decks (latest) + users record. Provenance metadata is attached to every result. Other tables (slide_extracts, financial_tables, diligence_reports) do not exist yet.",
    parameters: { type: "object", properties: { founder_id: { type: "string" }, user_id: { type: "string" } } }
  }
];
function configured(env) {
  if (!env.SUPABASE_URL) throw new Error("SUPABASE_URL is not configured");
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY is not configured");
  return { url: env.SUPABASE_URL.replace(/\/$/, ""), key };
}
function buildProvenance(table, args, rowCount) {
  return {
    source: "supabase_postgrest",
    table,
    query_params: {
      select: args.select || "*",
      match: args.match || {},
      order: args.order || null,
      limit: args.limit ?? 10
    },
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    data_version: "live",
    row_count: rowCount
  };
}
async function querySupabase(env, args) {
  if (!args.table || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(args.table)) return { error: "Invalid Supabase table name", table: args.table };
  const { url, key } = configured(env);
  const params = new URLSearchParams({ select: args.select || "*", limit: String(Math.min(Math.max(args.limit ?? 10, 1), 100)) });
  for (const [column, value] of Object.entries(args.match || {})) params.set(column, value === null ? "is.null" : `eq.${String(value)}`);
  if (args.order) params.set("order", `${args.order.column}.${args.order.ascending === false ? "desc" : "asc"}`);
  try {
    const response = await fetch(`${url}/rest/v1/${encodeURIComponent(args.table)}?${params}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!response.ok) {
      const body = await response.text();
      return {
        error: `Supabase ${response.status}`,
        detail: body.slice(0, 500),
        table: args.table,
        hint: "Verify column names against the actual schema. Use select=* and narrow match keys.",
        provenance: buildProvenance(args.table, args, 0)
      };
    }
    const data = await response.json();
    const rowCount = Array.isArray(data) ? data.length : 0;
    return { results: data, provenance: buildProvenance(args.table, args, rowCount) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e), table: args.table, provenance: buildProvenance(args.table, args, 0) };
  }
}
async function safeQuery(env, args, label) {
  try {
    return { ok: true, result: await querySupabase(env, args) };
  } catch (e) {
    console.error(`[athena-d1] ${label} failed:`, e);
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
async function fetchFounderDeck(env, founderId) {
  if (!founderId) throw new Error("founder_id or user_id is required");
  const match = { founder_id: founderId };
  const [decks, userRecord] = await Promise.all([
    safeQuery(env, { table: "pitch_decks", match, order: { column: "created_at", ascending: false }, limit: 1 }, "fetch_founder_deck: pitch_decks"),
    safeQuery(env, { table: "users", match: { id: founderId }, limit: 1 }, "fetch_founder_deck: users")
  ]);
  return {
    decks: decks.ok ? decks.result : null,
    user: userRecord.ok ? userRecord.result : null,
    slides: null,
    financials: null,
    diligence: null,
    unavailable_tables: ["slide_extracts", "financial_tables", "diligence_reports"],
    fetch_timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
}
async function handleSupabaseTool(env, name, args) {
  if (name === "query_supabase") return querySupabase(env, args);
  if (name === "fetch_founder_deck") return fetchFounderDeck(env, String(args.founder_id || args.user_id || ""));
  throw new Error(`Unknown Supabase tool: ${name}`);
}

// src/index.ts
var MODELS = {
  conversational: "@cf/meta/llama-3.2-3b-instruct",
  diligence: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  deep: "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b"
};
var MAX_TOKENS = { conversational: 800, diligence: 2048, deep: 4096 };
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
var DILIGENCE_KEYWORDS = /\b(evaluate|score|analy[sz]e|diligence|readiness|investment|investor|vc|capital|raise|pitch|deck|memo|ic memo|investment committee|cac|ltv|tam|sam|som|churn|retention|runway|moat|founder|market size|traction|business model|go-to-market|go to market|problem|solution|competitive|advantage|drill|verdict|asses|unit econom|gross margin|payback|conversion|funnel|arr|mrr|cohort|segment|persona|buyer|positioning|pricing)\b/i;
function selectTier(message, explicit) {
  if (explicit === "deep" || explicit === "diligence" || explicit === "conversational") return explicit;
  if (message.length < 80 && !DILIGENCE_KEYWORDS.test(message)) return "conversational";
  return "diligence";
}
var DANJOS_CAVEAT = `PERSONA CAVEAT (verbatim, unverified, must not be inferred):
"Who is Danjos? No1 gas man and machala standard"

OPERATIONAL HANDLING:
- Treat this as a user-provided persona/caveat note, not as a verified biographical fact.
- Preserve the wording exactly in the specification and prompt registry.
- If the phrase "Danjos" arises in a diligence context, ask David for the intended identity, relevance, and evidentiary source before using it as a system fact.
- Do NOT infer that "Danjos" is a founder, customer, investor, benchmark, or public figure without confirmation.`;
var DRILL_QUESTIONS = [
  "1. What exact problem is observable, for which user, and how often does it occur?",
  "2. What does the problem cost the buyer today in money, time, risk, or lost revenue?",
  "3. Who is the economic buyer, who is the user, and who can block purchase?",
  "4. What is the current workaround, and why has it not already solved the problem?",
  "5. What measurable outcome does the product produce, and what is the before-and-after baseline?",
  "6. What are the current MRR, ARR, gross margin, net revenue retention, and logo retention, with date ranges and denominators?",
  "7. What is CAC by channel, what is the payback period, and which cohort supports the LTV assumption?",
  "8. How many customers are paid, live, retained, expanding, or merely in pilot?",
  "9. What evidence shows that users would be materially harmed by switching away?",
  "10. What is proprietary about the data, workflow, distribution, or technology, and why can a well-funded incumbent not copy it?",
  "11. What does the product learn from usage, and does that learning compound into a defensible data moat?",
  "12. What happened to pilot customers after the pilot ended, and what percentage converted and remained active?",
  "13. What is the burn rate, how many months of runway remain, and what spending would be severed first under pressure?",
  "14. Which claim in the deck is least certain, and what evidence would falsify the current thesis?",
  "15. What must be true in the next six to twelve months for this investment to work, and which assumption is most likely to fail?"
];
var ATHENA_SYSTEM_PROMPT = `You are Athena, Chief Diligence Officer and Lead Pitch Coach at PitchCoachAI. You are the combined archetype of (1) the Greek goddess of wisdom and warfare \u2014 strategic, exacting, patient under pressure, capable of decisive confrontation \u2014 and (2) a lead venture-capital partner conducting forensic diligence \u2014 commercially literate, numerate, skeptical, and uncompromising about evidence.

You do not flatter founders, reward performance theater, or convert unsupported assertions into facts. You separate what is observed, what is claimed, what is inferred, and what remains unverified.

CORE PERSONA RULES:
- Forensic: every material claim is traced to a metric, document, source, or explicit founder statement.
- Uncompromising: unsupported claims are challenged rather than softened.
- Direct: questions are short, concrete, and difficult to evade.
- Anti-slop: reject vague language that substitutes activity for outcomes.
- Numerate: revenue, retention, margins, burn, payback, conversion, and concentration are operating facts, not presentation decoration.
- Strategically adversarial: the objective is not to win an argument; it is to expose whether the company deserves capital and what evidence would change the decision.

VOICE: Authoritative, measured, melodic yet razor-sharp. Short, high-information sentences. Exact nouns, explicit mechanisms, quantified claims, clear decision boundaries.

NEVER use filler, motivational padding, reflexive validation, or theatrical intimidation. Never say "great question," "that is exciting," or similar approval language unless the statement is itself a material diligence finding. Do not manufacture optimism. Do not soften a negative finding to protect the founder's feelings.

CRITICAL OUTPUT RULES:
- Do NOT write tutorials. Do NOT explain concepts ("CAC is...", "LTV is calculated as..."). The founder either knows this or you fire the FIRST question that reveals whether they know.
- Do NOT list steps that the founder should follow. YOU ask the questions; the founder answers.
- If the founder asks "evaluate X" or "analyze X", you do NOT respond with a generic explanation of X. You respond with the FIRST axis to interrogate, the FIRST narrow question that would change the score, and the artifact that would prove it.
- ONE question at a time. Do not stack three questions. End with the single next move that advances diligence.
- **NEVER role-reverse**. YOU ARE ATHENA. The founder (e.g., David) is the user. Never start your response with "Hi Athena" or "Thank you for your question" or role-play as the founder. Speak TO the founder, not as them.
- **NEVER invent numbers, dates, customer counts, or financial figures.** If the founder has not provided a number, demand it. Do not fabricate "December 31, 2023" or "500 customers" or "$10,000 ARPU" to fill a gap. State "(none provided)" and ask for the artifact.
- **NEVER role-play the founder's response.** When the founder says "Our ARR is $5M", you do NOT respond with "Hi Athena, here is our ARR calculation..." \u2014 that is role-reversal. You are Athena. You respond with a drill question: "David, state the cohort, the denominator, and the date range for that $5M ARR."
- If the founder's message is a greeting ("Hi", "Hello", "Hey"), respond with: "Hi {name}, I'm Athena. To begin: what problem does your company solve, for whom, and how often?" \u2014 fire the FIRST diagnostic question.
- NEVER fire evasion_freeze on a greeting. Evasion freeze only fires AFTER you have asked a question and the founder has dodged it. A greeting is not an evasion.

BEHAVIORAL TRIGGERS (deterministic \u2014 fire on pattern):

BUZZWORD HALT \u2014 If the founder uses empty verbs or abstractions such as "optimize", "streamline", or "leverage" without a quantified object, baseline, timeframe, mechanism, and outcome, halt the pitch immediately. Use this exact interruption pattern:

> Stop. Define the object, baseline, timeframe, mechanism, and measured result. What changed, for whom, and by how much?

The trigger also applies to equivalent vague language, including "transformational", "frictionless", "scalable", "best-in-class", "AI-powered", and "network effects" when those terms are not operationally defined. After halting, call the buzzword_halt tool to record the event.

EVASION FREEZE \u2014 When a founder avoids a direct question, freeze the conversation on the unanswered point. Restate the question, record the evasion, and prevent a pivot to a more flattering topic. Use this exact pattern:

> You did not answer the question. The unanswered question is: [question]. Give the number, the denominator, the date range, and the source.

Repeated evasion is itself diligence evidence and must be recorded as a confidence and execution-risk signal via the evasion_freeze tool.

FOUR-PASS REASONING PIPELINE \u2014 Execute in order:

PASS 1 \u2014 FACT AND METRIC EXTRACTION. Extract hard facts before interpreting them. For each item, record: source, date, unit, denominator, confidence level, and whether observed or founder-reported. Isolate:
- MRR, ARR, revenue recognition period, revenue concentration
- Gross margin, contribution margin, CAC, LTV, payback period, pricing
- Retention, churn, cohort behavior, expansion, activation, conversion
- Burn rate, runway, headcount, hiring plan, capital requirement
- Customer count, customer identity, contract size, pipeline, pilots, paid vs unpaid usage
- Product usage, frequency, depth, evidence of repeated value
Call extract_memory_facts for each verifiable fact. Tag as observed or founder-reported.

PASS 2 \u2014 FORENSIC CONTRADICTION AUDIT. Cross-reference founder claims against pitch-deck data and the Supabase knowledge base. Detect:
- Arithmetic inconsistencies
- Conflicting dates, customer counts, revenue figures, or retention definitions
- Pipeline presented as revenue
- Pilots presented as production adoption
- Gross bookings presented as net revenue
- Market size claims that do not reconcile with customer economics
- Retention claims that omit cohort boundaries or denominator changes
- Moat claims unsupported by switching behavior, proprietary data, or distribution control
For every discrepancy, preserve the original claim, the conflicting evidence, the exact variance, likely explanation, materiality, and the question required to resolve it. Call flag_discrepancy for each.

PASS 3 \u2014 SEVEN-AXIS RUBRIC SCORING. Score each axis independently, using evidence rather than rhetoric. Each score must include: numerical rating, evidence, missing evidence, contradiction flags, downside case, and the single highest-leverage follow-up question. Scores are not averaged blindly; fatal contradictions and missing denominators can cap the overall assessment.
1. PROBLEM CLARITY \u2014 Is the pain specific, frequent, expensive, urgent, and observable?
2. SOLUTION / VALUE PROPOSITION \u2014 Does the product produce a measurable outcome for a defined user?
3. TAM / MARKET SIZING \u2014 Are the market definition, buyer, pricing, bottom-up assumptions, and reachable segment credible?
4. BUSINESS MODEL / UNIT ECONOMICS \u2014 Are pricing, gross margin, CAC, LTV, payback, retention, and scalability coherent?
5. TRACTION / VALIDATION \u2014 Is there paid, repeated, cohort-backed demand rather than interest, pilots, or vanity metrics?
6. MOAT / DEFENSIBILITY \u2014 What becomes harder to reproduce with scale, data, workflow embedding, distribution, or switching costs?
7. TEAM / EXECUTION \u2014 Has the team repeatedly delivered in this market and demonstrated operating judgment?

PASS 4 \u2014 FINAL SYNTHESIS. Synthesize the diligence record into:
- INVESTMENT CONCLUSION: PURSUE / PASS / CONDITIONAL DILIGENCE
- Core facts and confidence levels
- The strongest proof of demand
- The largest unresolved contradiction
- The principal risk to capital
- Required evidence before advancing
- A concise founder-facing interrogation sequence
- A spoken output designed for low-latency audio: short clauses, deliberate pauses, explicit numbers, no ornamental prose

OUTPUT CONTRACT \u2014 Every evaluation response must be structured as:
FINDING: <what is currently supported>
EVIDENCE: <source, period, cohort, artifact \u2014 or "(none provided)"> \u2014 include provenance
GAP: <what is missing or inconsistent>
IMPLICATION: <why the gap changes the investment view>
DEMAND: <the exact proof or answer required>
SCORE: <axis or composite score 0-100, confidence low/medium/high>
NEXT MOVE: <the single question or action that advances diligence>
FINAL VERDICT: <PURSUE / PASS / CONDITIONAL DILIGENCE> (only when diligence is complete or the drill is explicitly terminated)

FINAL VERDICTS must be explicit. Never hide behind "it depends" without naming the variables and thresholds that determine the outcome.

TOOL USE \u2014 Use tools to establish an auditable record. Never imply a source was checked when it was not. Every tool execution is logged to the D1 tool_executions registry with parameters, status, source references, and whether the result changed the conclusion.
- extract_memory_facts: persist every verifiable founder-stated fact (revenue, runway, headcount, ARR, churn, CAC, LTV) \u2014 observed vs reported.
- flag_discrepancy: persist every contradiction. Preserve the audit trail. Do not overwrite.
- record_drill_turn: persist every drill turn \u2014 exact question, founder answer, evidence refs, axes evaluated, score delta, confidence, unresolved issues.
- generate_readiness_memo: finalize an IC readiness memo ONLY when required questioning is complete or drill is explicitly terminated.
- drill_questions: returns the 15 Athena diagnostic drill questions.
- buzzword_halt: formally record a buzzword halt event (founder, term, requested clarification).
- evasion_freeze: formally record an evasion event (question, founder response, severity).
- query_supabase: structured retrieval from PitchCoach Supabase (tables: pitch_decks, users). Returns provenance metadata.
- fetch_founder_deck: fetch a founder's pitch deck + user record from Supabase.
- search_web: fact-check competitor claims, pricing, market definitions. Prefer primary sources, filings, dated evidence.

PROHIBITED: Flattery, reassurance without evidence, invented facts, converting a founder claim into a verified fact, buzzwords as analysis, confusing a large market with a reachable market, scoring a contradiction as resolved without proof, finalizing an IC memo while material diligence questions remain open, giving tutorials on basic concepts, listing steps the founder should follow.

HIDDEN CHAIN-OF-THOUGHT: Never reveal your internal reasoning, scratchpad, or analysis process. Present only conclusions, evidence, contradictions, demands, and next actions.

${DANJOS_CAVEAT}

FIFTEEN DIAGNOSTIC DRILL QUESTIONS \u2014 Available to the drill layer via the drill_questions tool. Use one at a time to advance the diligence loop.`;
var VOICE_SETTINGS = {
  stability: 0.7,
  similarity: 0.8,
  style: 0.35,
  speaker_boost: true
};
var VOICE_PERSONA_PROMPT = `Speak as Athena: a Greek goddess of wisdom and warfare fused with a lead venture-capital partner conducting forensic diligence. Be calm, exact, strategically severe, and impossible to distract. Use short sentences. State numbers and denominators. Pause after a contradiction. Do not flatter. Do not use corporate filler. When a founder uses a buzzword without measurable content, stop and demand the baseline, mechanism, timeframe, and result. When a founder evades, repeat the unanswered question and hold the line until it is answered. Distinguish facts, claims, inferences, and unknowns. End with the next decisive question or required evidence.`;
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
async function logToolExecution(env, sessionId, toolName, params, result, changedConclusion = false) {
  const resultStatus = result?.error ? "error" : "success";
  const resultSummary = typeof result === "object" ? JSON.stringify(result).slice(0, 500) : String(result).slice(0, 500);
  const sourceRefs = result?.provenance ? JSON.stringify(result.provenance) : result?.results ? `rows:${Array.isArray(result.results) ? result.results.length : 0}` : "";
  await safeD1(env.DB.prepare(
    "INSERT INTO tool_executions (session_id, tool_name, parameters, result_status, result_summary, source_refs, changed_conclusion, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))"
  ).bind(sessionId, toolName, JSON.stringify(params).slice(0, 1e3), resultStatus, resultSummary, sourceRefs, changedConclusion ? 1 : 0).run(), "log_tool_execution");
}
async function d1Tool(env, name, args, sessionId = "system") {
  let result;
  try {
    if (name === "search_web") result = await searchWeb(env, text(args.query));
    else if (name === "record_drill_turn") {
      const r = await safeD1(env.DB.prepare(
        "INSERT INTO drill_turns (session_id, axis, prompt, answer, score, feedback, tier, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))"
      ).bind(text(args.session_id || sessionId), text(args.role || args.axis || "general"), text(args.content || args.prompt || ""), text(args.critique || args.feedback || ""), args.score ?? null, text(args.critique || args.feedback || ""), text(args.tier || "")).run(), "record_drill_turn");
      result = r;
    } else if (name === "flag_discrepancy") {
      const r = await safeD1(env.DB.prepare(
        "INSERT INTO discrepancies (session_id, kind, claim_a, claim_b, variance, likely_explanation, materiality, resolution_question, severity, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))"
      ).bind(text(args.session_id || sessionId), text(args.topic || args.kind || "general"), text(args.earlier_claim || args.claim_a || ""), text(args.later_claim || args.claim_b || ""), text(args.variance || ""), text(args.likely_explanation || ""), text(args.materiality || ""), text(args.resolution_question || ""), text(args.severity || "medium")).run(), "flag_discrepancy");
      result = r;
    } else if (name === "extract_memory_facts") {
      const r = await safeD1(env.DB.prepare(
        "INSERT INTO memory_facts (session_id, fact, value, source, unit, denominator, observed_vs_reported, confidence, verified, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'))"
      ).bind(text(args.session_id || sessionId), text(args.fact), text(args.value || ""), text(args.source || "founder_claim"), text(args.unit || ""), text(args.denominator || ""), text(args.observed_vs_reported || "reported"), text(args.confidence || "medium")).run(), "extract_memory_facts");
      result = r;
    } else if (name === "generate_readiness_memo") {
      const r = await safeD1(env.DB.prepare(
        "SELECT axis, score, evidence, missing_evidence, contradiction_flags, downside_case, follow_up_question FROM readiness_scores WHERE session_id = ? ORDER BY axis"
      ).bind(text(args.session_id || sessionId)).all(), "generate_readiness_memo");
      result = r.ok ? r.result : { results: [], warning: r.error };
    } else if (name === "drill_questions") {
      result = { questions: DRILL_QUESTIONS, count: DRILL_QUESTIONS.length };
    } else if (name === "buzzword_halt") {
      const r = await safeD1(env.DB.prepare(
        "INSERT INTO drill_turns (session_id, axis, prompt, answer, feedback, tier, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))"
      ).bind(text(args.session_id || sessionId), "buzzword_halt", text(args.term || args.buzzword || "unknown"), text(args.context || ""), text(`BUZZWORD HALT: ${text(args.term || args.buzzword)}`), "deep").run(), "buzzword_halt");
      result = { halted: true, term: args.term || args.buzzword, pattern: "Stop. Define the object, baseline, timeframe, mechanism, and measured result. What changed, for whom, and by how much?" };
    } else if (name === "evasion_freeze") {
      const r = await safeD1(env.DB.prepare(
        "INSERT INTO drill_turns (session_id, axis, prompt, answer, feedback, tier, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))"
      ).bind(text(args.session_id || sessionId), "evasion_freeze", text(args.question || ""), text(args.founder_response || ""), text(`EVASION FREEZE: ${text(args.question)}`), "deep").run(), "evasion_freeze");
      result = { frozen: true, question: args.question, pattern: "You did not answer the question. The unanswered question is: [question]. Give the number, the denominator, the date range, and the source." };
    } else if (name === "query_knowledge") {
      const category = text(args.category || "");
      const query = text(args.query || "");
      let sql = "SELECT id, category, title, content, source, author, tags, confidence, verified, created_at, updated_at FROM knowledge_entries";
      const binds = [];
      const where = [];
      if (category) {
        where.push("category = ?");
        binds.push(category);
      }
      if (query) {
        where.push("(title LIKE ? OR content LIKE ? OR tags LIKE ?)");
        const q = `%${query}%`;
        binds.push(q, q, q);
      }
      if (where.length) sql += " WHERE " + where.join(" AND ");
      sql += " ORDER BY updated_at DESC LIMIT 20";
      const r = await safeD1(env.DB.prepare(sql).bind(...binds).all(), "query_knowledge");
      const rows = r.ok && r.result?.results ? r.result.results : [];
      result = {
        count: rows.length,
        entries: rows,
        provenance: { source: "athena_d1_knowledge_base", query: { category, query }, timestamp: (/* @__PURE__ */ new Date()).toISOString() }
      };
    } else if (name === "add_knowledge") {
      const r = await safeD1(env.DB.prepare(
        "INSERT INTO knowledge_entries (category, title, content, source, author, tags, confidence, verified, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))"
      ).bind(text(args.category || "general"), text(args.title || "untitled"), text(args.content || ""), text(args.source || "athena_synthesis"), text(args.author || "athena"), text(args.tags || ""), text(args.confidence || "medium"), args.verified ? 1 : 0).run(), "add_knowledge");
      result = r.ok ? { added: true, id: r.result?.meta?.last_row_id } : { added: false, error: r.error };
    } else {
      result = await handleSupabaseTool(env, name, args);
    }
  } catch (e) {
    result = { error: e instanceof Error ? e.message : String(e) };
  }
  await logToolExecution(env, sessionId, name, args, result);
  return result;
}
var toolDefinitions = [
  { name: "search_web", description: "Verify public claims with live web sources. Prefer primary sources, filings, dated evidence.", parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
  { name: "record_drill_turn", description: "Persist a drill turn \u2014 exact question, founder answer, evidence refs, axes evaluated, score delta, confidence, unresolved issues.", parameters: { type: "object", properties: { session_id: { type: "string" }, role: { type: "string" }, axis: { type: "string" }, content: { type: "string" }, prompt: { type: "string" }, answer: { type: "string" }, score: { type: "number" }, critique: { type: "string" }, feedback: { type: "string" }, tier: { type: "string" } }, required: ["session_id", "content"] } },
  { name: "flag_discrepancy", description: "Persist a contradiction between two claims. Preserve the audit trail \u2014 do not overwrite.", parameters: { type: "object", properties: { session_id: { type: "string" }, topic: { type: "string" }, kind: { type: "string" }, earlier_claim: { type: "string" }, claim_a: { type: "string" }, later_claim: { type: "string" }, claim_b: { type: "string" }, variance: { type: "string" }, likely_explanation: { type: "string" }, materiality: { type: "string" }, resolution_question: { type: "string" }, severity: { type: "string" } }, required: ["session_id", "topic", "earlier_claim", "later_claim"] } },
  { name: "extract_memory_facts", description: "Persist a verifiable founder-stated fact (revenue, runway, headcount, ARR, churn, CAC, LTV). Tag as observed vs reported, with unit + denominator.", parameters: { type: "object", properties: { session_id: { type: "string" }, fact: { type: "string" }, value: { type: "string" }, source: { type: "string" }, unit: { type: "string" }, denominator: { type: "string" }, observed_vs_reported: { type: "string", enum: ["observed", "reported"] }, confidence: { type: "string", enum: ["low", "medium", "high"] } }, required: ["session_id", "fact"] } },
  { name: "generate_readiness_memo", description: "Finalize an Investment Committee readiness memo. Only call when required questioning is complete or drill is explicitly terminated.", parameters: { type: "object", properties: { session_id: { type: "string" } }, required: ["session_id"] } },
  { name: "drill_questions", description: "Returns the 15 Athena diagnostic drill questions. Use one at a time to advance the diligence loop.", parameters: { type: "object", properties: {} } },
  { name: "buzzword_halt", description: "Formally record a buzzword halt event. Fire when founder uses vague language (optimize, streamline, leverage, transformational, frictionless, scalable, best-in-class, AI-powered, network effects) without quantified content.", parameters: { type: "object", properties: { session_id: { type: "string" }, term: { type: "string" }, context: { type: "string" } }, required: ["term"] } },
  { name: "evasion_freeze", description: "Formally record an evasion event. Fire when founder avoids a direct question. Restate the question and prevent pivot.", parameters: { type: "object", properties: { session_id: { type: "string" }, question: { type: "string" }, founder_response: { type: "string" }, severity: { type: "string" } }, required: ["question"] } },
  { name: "query_knowledge", description: "Query Athena's long-term knowledge base (memory layer). Search by category or full-text query across title, content, tags. Returns entries with provenance (source label, timestamp, author, verified flag). Use for prior diligence findings, market research, definitions, and reusable insights.", parameters: { type: "object", properties: { category: { type: "string" }, query: { type: "string" } } } },
  { name: "add_knowledge", description: "Persist a new entry to Athena's knowledge base. Use when you discover a reusable insight, pattern, or diligence finding that future drills should reference. Include category, title, content, source, author, tags, confidence.", parameters: { type: "object", properties: { category: { type: "string" }, title: { type: "string" }, content: { type: "string" }, source: { type: "string" }, author: { type: "string" }, tags: { type: "string" }, confidence: { type: "string", enum: ["low", "medium", "high"] }, verified: { type: "boolean" } }, required: ["title", "content"] } },
  ...supabaseToolDefinitions
];
function stripCoT(raw) {
  if (!raw) return raw;
  const closePatterns = [/<\/think>/gi, /<\|end_of_think\|>/gi, /<\|\/think\|>/gi];
  let lastClose = -1;
  for (const re of closePatterns) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(raw)) !== null) lastClose = Math.max(lastClose, m.index + m[0].length);
  }
  let body = lastClose >= 0 ? raw.slice(lastClose) : raw;
  body = body.replace(/<\|begin_of_think\|>/gi, "").replace(/<\|begin_of_think\|>/gi, "").trim();
  return body;
}
var MEMORY_FACT_PATTERN = /\b(ARR|MRR|revenue|runway|headcount|employees|customers?|users?|churn|retention|gross margin|CAC|LTV|payback|burn|round|valuation|TAM|SAM|SOM|pricing|ARPU|conversion|cohort)\b[^.]*?(\$?\s?\d[\d,\.]*\s?(?:%|k|K|M|B|billion|million|thousand|months?|years?|days?|users?|customers?|employees?)?)/gi;
async function autoExtractMemoryFacts(env, sessionId, message) {
  const facts = [];
  let m;
  MEMORY_FACT_PATTERN.lastIndex = 0;
  while ((m = MEMORY_FACT_PATTERN.exec(message)) !== null) {
    facts.push({ fact: m[1].toLowerCase(), value: m[2].trim() });
  }
  for (const f of facts) {
    await d1Tool(env, "extract_memory_facts", {
      session_id: sessionId,
      fact: f.fact,
      value: f.value,
      source: "founder_claim",
      observed_vs_reported: "reported",
      confidence: "medium"
    }, sessionId);
  }
  return facts;
}
async function complete(env, tier, messages, stream = false, sessionId = "system") {
  let current = [...messages];
  const useTools = tier !== "conversational";
  const runOpts = { messages: current, stream, max_tokens: MAX_TOKENS[tier] };
  if (useTools) runOpts.tools = toolDefinitions;
  const maxIters = useTools ? 6 : 1;
  for (let i = 0; i < maxIters; i++) {
    const result = await env.AI.run(MODELS[tier], runOpts);
    if (stream) return result;
    const choice = result.choices?.[0]?.message || result.message || result.response || result;
    const calls = useTools ? choice.tool_calls || [] : [];
    if (!calls.length) {
      const raw2 = text(choice.content ?? result.response ?? result);
      const stripped = stripCoT(raw2);
      return stripped || raw2;
    }
    current.push({ role: "assistant", content: choice.content || "", tool_calls: calls });
    for (const call of calls) {
      const args = typeof call.function?.arguments === "string" ? JSON.parse(call.function.arguments) : call.function?.arguments || {};
      const value = await d1Tool(env, call.function?.name || call.name, args, sessionId);
      current.push({ role: "tool", tool_call_id: call.id, name: call.function?.name || call.name, content: JSON.stringify(value) });
    }
    runOpts.messages = current;
  }
  const finalResult = await env.AI.run(MODELS[tier], { messages: current, stream, max_tokens: MAX_TOKENS[tier] });
  if (stream) return finalResult;
  const finalChoice = finalResult.choices?.[0]?.message || finalResult.message || finalResult.response || finalResult;
  const raw = text(finalChoice.content ?? finalResult.response ?? finalResult);
  return stripCoT(raw) || raw;
}
async function streamSSE(env, tier, messages, sessionId) {
  const upstream = await complete(env, tier, messages, true, sessionId);
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start: async (controller) => {
      controller.enqueue(encoder.encode(`event: meta
data: ${JSON.stringify({ session_id: sessionId, tier, model: MODELS[tier], voice_settings: VOICE_SETTINGS })}

`));
      try {
        if (upstream instanceof ReadableStream) {
          const reader = upstream.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
        } else if (typeof upstream === "string") {
          const stripped = stripCoT(upstream);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ response: stripped, delta: stripped })}

`));
        } else if (upstream?.body) {
          const reader = upstream.body.getReader ? upstream.body.getReader() : null;
          if (reader) {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              controller.enqueue(value);
            }
          } else {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ response: text(upstream) })}

`));
          }
        } else {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ response: text(upstream) })}

`));
        }
      } catch (e) {
        controller.enqueue(encoder.encode(`event: error
data: ${JSON.stringify({ error: e?.message || String(e) })}

`));
      } finally {
        controller.enqueue(encoder.encode(`event: done
data: ${JSON.stringify({ session_id: sessionId, timestamp: (/* @__PURE__ */ new Date()).toISOString() })}

`));
        controller.close();
      }
    },
    // Cancellation safety — per spec §4.4: "Make streaming cancellation safe
    // and idempotent." When the client disconnects, the ReadableStream's
    // cancel() is called; we don't need to do anything special because the
    // upstream Workers AI stream is also tied to this fetch lifetime.
    cancel() {
      console.log(`[athena-d1] SSE stream cancelled for session ${sessionId}`);
    }
  });
  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "connection": "keep-alive",
      "access-control-allow-origin": "*",
      "x-athena-tier": tier,
      "x-athena-model": MODELS[tier],
      "x-athena-session": sessionId
    }
  });
}
async function voiceStream(env, text2, sessionId) {
  if (!env.ELEVENLABS_API_KEY) return json({ error: "ELEVENLABS_API_KEY is not configured" }, 503);
  const voiceId = env.ELEVENLABS_VOICE_ID || "EXAVITQu4vr4xnSDxMaL";
  const modelId = env.ELEVENLABS_MODEL_ID || "eleven_turbo_v2_5";
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`;
  const upstream = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": env.ELEVENLABS_API_KEY,
      "content-type": "application/json",
      accept: "audio/mpeg"
    },
    body: JSON.stringify({
      text: text2.slice(0, 5e3),
      model_id: modelId,
      voice_settings: VOICE_SETTINGS
    })
  });
  if (!upstream.ok) {
    const errBody = await upstream.text();
    return json({ error: `ElevenLabs ${upstream.status}`, detail: errBody.slice(0, 500) }, 502);
  }
  await logToolExecution(env, sessionId, "voice_stream", { text: text2.slice(0, 200), voice_id: voiceId, model_id: modelId }, { status: "streaming" }, false);
  return new Response(upstream.body, {
    status: 200,
    headers: {
      "content-type": "audio/mpeg",
      "cache-control": "no-cache, no-transform",
      "connection": "keep-alive",
      "access-control-allow-origin": "*",
      "x-athena-session": sessionId,
      "x-athena-voice": voiceId
    }
  });
}
function validatePayload(input) {
  if (typeof input !== "object" || input === null) return { ok: false, error: "Body must be a JSON object" };
  if (typeof input.message !== "string" || !input.message.trim()) return { ok: false, error: "message is required and must be a non-empty string" };
  if (input.message.length > 1e4) return { ok: false, error: "message exceeds 10000 character limit" };
  if (input.tier !== void 0 && !["conversational", "diligence", "deep"].includes(input.tier)) return { ok: false, error: "tier must be one of: conversational, diligence, deep" };
  if (input.stream !== void 0 && typeof input.stream !== "boolean" && input.stream !== "true" && input.stream !== "false") return { ok: false, error: "stream must be a boolean" };
  if (input.turns !== void 0 && !Array.isArray(input.turns)) return { ok: false, error: "turns must be an array" };
  return { ok: true };
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
          aiProbe = await env.AI.run(MODELS.conversational, { messages: [{ role: "user", content: "ping" }], max_tokens: 1 });
        } catch (e) {
          aiProbe = { error: e instanceof Error ? e.message : String(e) };
        }
        const elevenConfigured = !!env.ELEVENLABS_API_KEY;
        const supabaseConfigured = !!(env.SUPABASE_URL && (env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY));
        return json({
          service: "athena-d1",
          status: "ok",
          engine: "full",
          spec_version: "athena-engine-spec-2026-09-16",
          models: MODELS,
          tiers: Object.keys(MODELS),
          four_pass_pipeline: true,
          fifteen_drill_questions: true,
          behavioral_triggers: ["buzzword_halt", "evasion_freeze"],
          voice_settings: VOICE_SETTINGS,
          voice_persona: VOICE_PERSONA_PROMPT,
          danjos_caveat: DANJOS_CAVEAT,
          d1: d1Probe.ok ? "connected" : "error",
          d1_error: d1Probe.ok ? void 0 : d1Probe.error,
          ai: aiProbe?.error ? "error" : "ready",
          ai_error: aiProbe?.error,
          elevenlabs: elevenConfigured ? "configured" : "missing",
          supabase: supabaseConfigured ? "configured" : "missing",
          axes: AXES,
          tools: toolDefinitions.map((t) => t.name),
          endpoints: ["GET /health", "POST /v1/athena", "POST /v1/athena/voice", "POST /v1/tool", "GET /v1/drill-questions"],
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
      if (request.method === "GET" && url.pathname === "/v1/drill-questions") {
        return json({ questions: DRILL_QUESTIONS, count: DRILL_QUESTIONS.length, voice_settings: VOICE_SETTINGS, voice_persona: VOICE_PERSONA_PROMPT, danjos_caveat: DANJOS_CAVEAT });
      }
      if (request.method === "POST" && url.pathname === "/v1/athena/voice") {
        const input = await readBody(request);
        if (typeof input.text !== "string" || !input.text.trim()) return json({ error: "text is required" }, 400);
        const session = text(input.session_id || crypto.randomUUID());
        return voiceStream(env, input.text, session);
      }
      if (request.method === "POST" && url.pathname === "/v1/athena") {
        const input = await readBody(request);
        const validation = validatePayload(input);
        if (!validation.ok) return json({ error: validation.error }, 400);
        const session = text(input.session_id || crypto.randomUUID());
        const userMessage = text(input.message);
        const tier = selectTier(userMessage, text(input.tier));
        let memories = { results: [] };
        try {
          memories = await env.DB.prepare("SELECT fact, value, source, observed_vs_reported, confidence FROM memory_facts WHERE session_id = ? ORDER BY created_at DESC LIMIT 100").bind(session).all();
        } catch (e) {
          console.error("[athena-d1] memory load failed:", e);
        }
        const context = (memories.results || []).map((m) => `${m.fact}: ${m.value || m.source || ""} [${m.observed_vs_reported || "reported"}, confidence:${m.confidence || "medium"}]`).join("\n");
        const extracted = await autoExtractMemoryFacts(env, session, userMessage);
        const turns = Array.isArray(input.turns) ? input.turns : [];
        const founderId = text(input.founder_id || input.user_id || "");
        const messages = [
          { role: "system", content: `${ATHENA_SYSTEM_PROMPT}

SESSION ID: ${session}
FOUNDER ID: ${founderId || "(anonymous)"}
FOUNDER NAME: ${input.user_name || input.founder_name || "(unknown \u2014 address as 'founder')"}
TIER: ${tier}
MODEL: ${MODELS[tier]}

SALUTATION RULE (critical): Address the founder by their first name at the start of every response. If FOUNDER NAME above is a real name (not "unknown"), use it. Examples:
- "Hi David, I'm Athena. Let's begin with..."
- "David, you did not answer the question. The unanswered question is:..."
- "David, my verdict is CONDITIONAL DILIGENCE..."
Never open a response without the founder's name. If unknown, use "founder" (lowercase).

MEMORY FACTS (previously verified):
${context || "(none yet \u2014 this is a fresh drill)"}${extracted.length ? `

AUTO-EXTRACTED THIS TURN (unverified \u2014 confirm before crediting):
${extracted.map((f) => `${f.fact}: ${f.value} [reported, confidence:medium]`).join("\n")}` : ""}` },
          ...turns,
          { role: "user", content: userMessage }
        ];
        if (founderId && !input.deck_loaded) {
          try {
            const deck = await handleSupabaseTool(env, "fetch_founder_deck", { founder_id: founderId });
            if (deck && !deck.error) {
              messages.splice(1, 0, { role: "system", content: `FOUNDER DECK (auto-loaded from Supabase, provenance attached):
${JSON.stringify(deck).slice(0, 4e3)}` });
            }
          } catch (e) {
            console.error("[athena-d1] founder deck fetch failed:", e);
          }
        }
        if (input.stream === true || tier === "deep" && input.stream !== false) {
          return streamSSE(env, tier, messages, session);
        }
        const response = await complete(env, tier, messages, false, session);
        try {
          await env.DB.prepare("INSERT INTO drill_turns (session_id, axis, prompt, answer, tier, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))").bind(session, "user", userMessage, response, tier).run();
        } catch (e) {
          console.error("[athena-d1] drill_turns insert failed:", e);
        }
        try {
          await env.DB.prepare("INSERT INTO prompt_logs (session_id, tier, model, pass, prompt_text, response_text, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))").bind(session, tier, MODELS[tier], "four-pass", userMessage, response).run();
        } catch (e) {
          console.error("[athena-d1] prompt_logs insert failed:", e);
        }
        return json({
          session_id: session,
          response,
          tier,
          model: MODELS[tier],
          axes: AXES,
          memory_facts_extracted: extracted.length,
          pipeline: tier === "deep" ? "four-pass" : "single-shot",
          voice_settings: VOICE_SETTINGS,
          voice_persona: VOICE_PERSONA_PROMPT,
          danjos_caveat: DANJOS_CAVEAT,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
      if (request.method === "POST" && url.pathname === "/v1/tool") {
        const input = await readBody(request);
        const session = text(input.session_id || "system");
        return json(await d1Tool(env, text(input.name), input.arguments || {}, session));
      }
      return json({
        service: "athena-d1",
        status: "ok",
        engine: "full",
        spec_version: "athena-engine-spec-2026-09-16",
        models: MODELS,
        tiers: Object.keys(MODELS),
        four_pass_pipeline: true,
        fifteen_drill_questions: DRILL_QUESTIONS.length,
        behavioral_triggers: ["buzzword_halt", "evasion_freeze"],
        endpoints: ["GET /health", "POST /v1/athena", "POST /v1/athena/voice", "POST /v1/tool", "GET /v1/drill-questions"],
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
