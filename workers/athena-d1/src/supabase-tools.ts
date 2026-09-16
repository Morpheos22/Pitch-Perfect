export type SupabaseOrder = { column: string; ascending?: boolean };
export type SupabaseQueryArgs = {
  table: string;
  select?: string;
  match?: Record<string, string | number | boolean | null>;
  order?: SupabaseOrder;
  limit?: number;
};

export interface SupabaseEnv {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_ANON_KEY?: string;
}

// Tables that actually exist on the PitchCoach Supabase instance.
// Discovered via REST probe on 2026-09-16. Include this in the tool description
// so the model doesn't query non-existent tables and trigger 404 errors.
export const KNOWN_SUPABASE_TABLES = [
  "pitch_decks",
  "users",
];

export const supabaseToolDefinitions = [
  {
    name: "query_supabase",
    description: `Query PitchCoach records in Supabase PostgREST. AVAILABLE TABLES (use ONLY these — others will 404): ${KNOWN_SUPABASE_TABLES.join(", ")}. Use for pitch decks, uploaded artifacts, and user records. Use narrow queries — specify match + limit. Never treat an empty result as proof of absence; report it as "unverified".`,
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
    description: "Fetch a founder's uploaded pitch deck + user record from Supabase. Returns pitch_decks (latest) + users record. Other tables (slide_extracts, financial_tables, diligence_reports) do not exist yet — returns null for those.",
    parameters: { type: "object", properties: { founder_id: { type: "string" }, user_id: { type: "string" } } }
  }
];

function configured(env: SupabaseEnv) {
  if (!env.SUPABASE_URL) throw new Error("SUPABASE_URL is not configured");
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY is not configured");
  return { url: env.SUPABASE_URL.replace(/\/$/, ""), key };
}

export async function querySupabase(env: SupabaseEnv, args: SupabaseQueryArgs) {
  if (!args.table || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(args.table)) return { error: "Invalid Supabase table name", table: args.table };
  const { url, key } = configured(env);
  const params = new URLSearchParams({ select: args.select || "*", limit: String(Math.min(Math.max(args.limit ?? 10, 1), 100)) });
  for (const [column, value] of Object.entries(args.match || {})) params.set(column, value === null ? "is.null" : `eq.${String(value)}`);
  if (args.order) params.set("order", `${args.order.column}.${args.order.ascending === false ? "desc" : "asc"}`);
  try {
    const response = await fetch(`${url}/rest/v1/${encodeURIComponent(args.table)}?${params}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!response.ok) {
      const body = await response.text();
      // Return the error as a structured result so the model can self-correct
      // instead of crashing the whole tool-calling loop.
      return { error: `Supabase ${response.status}`, detail: body.slice(0, 500), table: args.table, hint: "Verify column names against the actual schema. Use select=* and narrow match keys." };
    }
    return response.json();
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e), table: args.table };
  }
}

// Best-effort deck fetch. Each query is isolated so a missing table doesn't
// break the whole call. Returns the latest deck + user record (other tables
// that don't exist yet return null instead of throwing).
async function safeQuery(env: SupabaseEnv, args: SupabaseQueryArgs, label: string) {
  try { return { ok: true as const, result: await querySupabase(env, args) }; }
  catch (e) { console.error(`[athena-d1] ${label} failed:`, e); return { ok: false as const, error: e instanceof Error ? e.message : String(e) }; }
}

export async function fetchFounderDeck(env: SupabaseEnv, founderId: string) {
  if (!founderId) throw new Error("founder_id or user_id is required");
  const match = { founder_id: founderId };
  const [decks, userRecord] = await Promise.all([
    safeQuery(env, { table: "pitch_decks", match, order: { column: "created_at", ascending: false }, limit: 1 }, "fetch_founder_deck: pitch_decks"),
    safeQuery(env, { table: "users", match: { id: founderId }, limit: 1 }, "fetch_founder_deck: users"),
  ]);
  return {
    decks: decks.ok ? decks.result : null,
    user: userRecord.ok ? userRecord.result : null,
    slides: null,
    financials: null,
    diligence: null,
    unavailable_tables: ["slide_extracts", "financial_tables", "diligence_reports"],
  };
}

export async function handleSupabaseTool(env: SupabaseEnv, name: string, args: Record<string, unknown>) {
  if (name === "query_supabase") return querySupabase(env, args as SupabaseQueryArgs);
  if (name === "fetch_founder_deck") return fetchFounderDeck(env, String(args.founder_id || args.user_id || ""));
  throw new Error(`Unknown Supabase tool: ${name}`);
}
