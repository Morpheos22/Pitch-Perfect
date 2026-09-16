import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const workerUrl = () => process.env.ATHENA_WORKER_URL || "https://pitchcoach-athena-d1.workers.dev";

async function founderContext(userId: string) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return { founder_id: userId, source: "session" };
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const query = `${url.replace(/\\/$/, "")}/rest/v1/pitch_decks?founder_id=eq.${encodeURIComponent(userId)}&order=created_at.desc&limit=1`;
  const response = await fetch(query, { headers, cache: "no-store" });
  if (!response.ok) return { founder_id: userId, source: "session" };
  const decks = await response.json();
  return { founder_id: userId, deck: Array.isArray(decks) ? decks[0] ?? null : null, source: "supabase" };
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const sessionId = typeof body.session_id === "string" ? body.session_id : crypto.randomUUID();
  const context = await founderContext(userId);
  const payload = { ...body, session_id: sessionId, user_id: userId, founder_context: context };
  const upstream = await fetch(`${workerUrl()}/v1/athena`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(process.env.ATHENA_WORKER_TOKEN ? { authorization: `Bearer ${process.env.ATHENA_WORKER_TOKEN}` } : {}) },
    body: JSON.stringify(payload),
    cache: "no-store",
  }).catch((error) => ({ ok: false, status: 502, json: async () => ({ error: error instanceof Error ? error.message : "Athena unavailable" }) }));
  const result = await upstream.json().catch(() => ({ error: "Invalid Athena response" }));
  return NextResponse.json({ ...result, session_id: sessionId }, { status: upstream.ok ? 200 : upstream.status || 502 });
}

export async function OPTIONS() { return new NextResponse(null, { status: 204 }); }
