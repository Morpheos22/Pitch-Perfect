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
// Discovered via REST probe on 2026-09-16.
export const KNOWN_SUPABASE_TABLES = [
  "pitch_decks",
  "users",
];

export const supabaseToolDefinitions = [
  {
    name: "query_supabase",
    description: `Query PitchCoach records in Supabase PostgREST. AVAILABLE TABLES (use ONLY these — others will 404): ${KNOWN_SUPABASE_TABLES.join(", ")}. Returns data + provenance metadata (timestamp, source label, table, query params) so every claim can be traced back to its source. Use narrow queries. Never treat an empty result as proof of absence; report as "unverified".`,
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

function configured(env: SupabaseEnv) {
  if (!env.SUPABASE_URL) throw new Error("SUPABASE_URL is not configured");
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY is not configured");
  return { url: env.SUPABASE_URL.replace(/\/$/, ""), key };
}

// Provenance metadata — per spec §2.3 Supabase integration:
// "must preserve row or document provenance, timestamps, source labels,
//  and the exact data version used for a conclusion."
type Provenance = {
  source: "supabase_postgrest";
  table: string;
  query_params: Record<string, any>;
  timestamp: string;
  data_version: "live";
  row_count?: number;
};

function buildProvenance(table: string, args: SupabaseQueryArgs, rowCount?: number): Provenance {
  return {
    source: "supabase_postgrest",
    table,
    query_params: {
      select: args.select || "*",
      match: args.match || {},
      order: args.order || null,
      limit: args.limit ?? 10,
    },
    timestamp: new Date().toISOString(),
    data_version: "live",
    row_count: rowCount,
  };
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
      return {
        error: `Supabase ${response.status}`,
        detail: body.slice(0, 500),
        table: args.table,
        hint: "Verify column names against the actual schema. Use select=* and narrow match keys.",
        provenance: buildProvenance(args.table, args, 0),
      };
    }
    const data = await response.json();
    const rowCount = Array.isArray(data) ? data.length : 0;
    return { results: data, provenance: buildProvenance(args.table, args, rowCount) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e), table: args.table, provenance: buildProvenance(args.table, args, 0) };
  }
}

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
    fetch_timestamp: new Date().toISOString(),
  };
}

export async function handleSupabaseTool(env: SupabaseEnv, name: string, args: Record<string, unknown>) {
  if (name === "query_supabase") return querySupabase(env, args as SupabaseQueryArgs);
  if (name === "fetch_founder_deck") return fetchFounderDeck(env, String(args.founder_id || args.user_id || ""));
  throw new Error(`Unknown Supabase tool: ${name}`);
}
