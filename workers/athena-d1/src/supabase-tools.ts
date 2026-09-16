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

export const supabaseToolDefinitions = [
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

function configured(env: SupabaseEnv) {
  if (!env.SUPABASE_URL) throw new Error("SUPABASE_URL is not configured");
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY is not configured");
  return { url: env.SUPABASE_URL.replace(/\/$/, ""), key };
}

export async function querySupabase(env: SupabaseEnv, args: SupabaseQueryArgs) {
  if (!args.table || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(args.table)) throw new Error("Invalid Supabase table name");
  const { url, key } = configured(env);
  const params = new URLSearchParams({ select: args.select || "*", limit: String(Math.min(Math.max(args.limit ?? 10, 1), 100)) });
  for (const [column, value] of Object.entries(args.match || {})) params.set(column, value === null ? "is.null" : `eq.${String(value)}`);
  if (args.order) params.set("order", `${args.order.column}.${args.order.ascending === false ? "desc" : "asc"}`);
  const response = await fetch(`${url}/rest/v1/${encodeURIComponent(args.table)}?${params}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!response.ok) throw new Error(`Supabase query failed: ${response.status} ${await response.text()}`);
  return response.json();
}

export async function fetchFounderDeck(env: SupabaseEnv, founderId: string) {
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

export async function handleSupabaseTool(env: SupabaseEnv, name: string, args: Record<string, unknown>) {
  if (name === "query_supabase") return querySupabase(env, args as SupabaseQueryArgs);
  if (name === "fetch_founder_deck") return fetchFounderDeck(env, String(args.founder_id || args.user_id || ""));
  throw new Error(`Unknown Supabase tool: ${name}`);
}
