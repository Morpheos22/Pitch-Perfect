import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual, randomUUID } from "node:crypto";
import { runAthena, AthenaMessage } from "@/lib/athena-agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const MIN_TOKENS = 256;
const MAX_TOKENS = 32000;
const DEFAULT_STANDARD_TOKENS = 2048;
const DEFAULT_REASONING_TOKENS = 8192;

function secretMatches(received: string, expected: string) { const a = Buffer.from(received); const b = Buffer.from(expected); return a.length === b.length && timingSafeEqual(a, b); }
function clampTokens(value: unknown, reasoning: boolean) { const fallback = reasoning ? DEFAULT_REASONING_TOKENS : DEFAULT_STANDARD_TOKENS; if (typeof value !== "number" || !Number.isFinite(value)) return fallback; return Math.min(MAX_TOKENS, Math.max(MIN_TOKENS, Math.floor(value))); }
function normalizeMessages(body: Record<string, unknown>): AthenaMessage[] | null {
  if (typeof body.prompt === "string" && body.prompt.trim()) return [{ role: "user", content: body.prompt.trim() }];
  if (!Array.isArray(body.messages)) return null;
  const messages = body.messages.filter((item): item is { role: string; content: string } => Boolean(item && typeof item === "object" && typeof (item as { role?: unknown }).role === "string" && typeof (item as { content?: unknown }).content === "string" && ["user", "assistant"].includes((item as { role: string }).role))).map((item) => ({ role: item.role as "user" | "assistant", content: item.content.trim() })).filter((item) => item.content).slice(-30);
  return messages.length ? messages : null;
}

export async function POST(request: NextRequest) {
  const configuredSecret = process.env.PITCHCOACH_ORCHID_SECRET;
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!configuredSecret || !token || !secretMatches(token, configuredSecret)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "JSON object required" }, { status: 400 });
  const input = body as Record<string, unknown>;
  const requestedOrchid6 = typeof input.tier === "string" && input.tier.trim().toLowerCase() === "orchid6";
  const reasoning = input.reasoning === true || requestedOrchid6;
  const messages = normalizeMessages(input);
  if (!messages) return NextResponse.json({ error: "prompt or messages is required" }, { status: 400 });
  const maxTokens = requestedOrchid6 ? MAX_TOKENS : clampTokens(input.maxTokens, reasoning);
  const tier = typeof input.tier === "string" && input.tier.trim() ? input.tier.trim().slice(0, 64) : "founder";
  const sessionId = typeof input.sessionId === "string" ? input.sessionId.slice(0, 128) : undefined;
  try {
    const result = await runAthena(messages, { reasoning, tier: reasoning ? "deep" : "conversational", maxTokens } as never);
    const response = typeof result.message === "string" ? result.message : result.message?.content || "";
    return NextResponse.json({ response, model: result.model, reasoning, tokensUsed: result.usage?.total_tokens ?? result.usage, metadata: { usage: result.usage, maxTokens, tier, ...(sessionId ? { sessionId } : {}) } });
  } catch (error) { console.error("[Orchid Athena] request failed", error); return NextResponse.json({ error: "Athena request failed", requestId: randomUUID() }, { status: 502 }); }
}
