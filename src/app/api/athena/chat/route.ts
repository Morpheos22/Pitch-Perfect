import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import {
  getActiveMemories,
  formatMemoriesForPrompt,
  startOrResumeSession,
  logUserMessage,
  logAssistantMessage,
  getActivePersonality,
  getActiveSkillsForMessage,
} from "@/lib/athena-memory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // accommodate deep-tier DeepSeek-R1 (50-70s)

const ENGINE_URL = process.env.ATHENA_ENGINE_URL || "https://athena-d1.morphylee22.workers.dev/v1/athena";

export async function POST(request: NextRequest) {
  const body = await request.text();
  if (!body) return NextResponse.json({ error: "Request body is required" }, { status: 400 });
  let parsed: unknown;
  try { parsed = JSON.parse(body); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const input = parsed as { message?: unknown; tier?: unknown; stream?: unknown; session_id?: unknown; turns?: unknown; user_name?: unknown };
  if (typeof input.message !== "string" || !input.message.trim()) return NextResponse.json({ error: "Message required" }, { status: 400 });

  // Identify the founder (Clerk userId + firstName) so Athena can address
  // them by name and fetch their deck from Supabase.
  let founderId: string | undefined;
  let founderName: string | undefined;
  let internalUserId: string | undefined;
  try {
    const { userId, sessionClaims } = await auth();
    if (userId) {
      founderId = userId;
      // Pull firstName from Clerk JWT claims if available
      const meta = sessionClaims as any;
      founderName = meta?.firstName || meta?.u?.first_name || undefined;
      // Resolve internal DB user ID for memory layer
      try {
        const u = await prisma.user.findUnique({
          where: { clerkId: userId },
          select: { id: true, firstName: true },
        });
        if (u) {
          internalUserId = u.id;
          if (!founderName) founderName = u.firstName ?? undefined;
        }
      } catch { /* DB unavailable — skip memory layer */ }
    }
  } catch { /* anonymous visitor — allow through */ }
  // Allow client-side override (e.g., from onboarding form) but prefer server-side
  const userName = (typeof input.user_name === "string" ? input.user_name : undefined) || founderName;

  // ── Memory layer: load active memories + personality ───────────────────
  // These are injected into the upstream payload so the Athena worker can
  // include them in the system prompt. Non-fatal on failure.
  let sessionId = "";
  let memoryBlock = "";
  let personalitySystemPrompt: string | undefined;
  let personalityVoiceId: string | undefined;
  let personalityReasoningEffort: string | undefined;
  let personalityMaxTokens: number | undefined;

  if (internalUserId) {
    try {
      // Load memories + personality + matching skills in parallel — all
      // non-fatal on failure, all injected into the upstream payload as
      // context blocks for the Athena worker to fold into the system prompt.
      const [memories, personality, skillsBlock] = await Promise.all([
        getActiveMemories(internalUserId),
        getActivePersonality(),
        getActiveSkillsForMessage(input.message),
      ]);
      memoryBlock = formatMemoriesForPrompt(memories);
      personalitySystemPrompt = personality.systemPrompt;
      personalityVoiceId = personality.voiceId ?? undefined;
      personalityReasoningEffort = personality.reasoningEffort;
      personalityMaxTokens = personality.maxTokens;
      sessionId = await startOrResumeSession(internalUserId, typeof input.session_id === "string" ? input.session_id : undefined);
      // Skills block is appended to memory block — the upstream worker should
      // inject both as context for the system prompt.
      if (skillsBlock) {
        memoryBlock = memoryBlock ? `${memoryBlock}\n${skillsBlock}` : skillsBlock;
      }
    } catch (err) {
      console.warn("[athena/chat] memory layer init failed:", err instanceof Error ? err.message : err);
    }
  }

  // ── Log user message (non-blocking) ───────────────────────────────────
  if (sessionId) {
    logUserMessage(sessionId, input.message).catch(() => {/* non-fatal */});
  }

  const upstreamPayload: Record<string, unknown> = {
    message: input.message,
    tier: typeof input.tier === "string" ? input.tier : undefined,
    stream: input.stream === true || input.stream === "true",
    session_id: sessionId || (typeof input.session_id === "string" ? input.session_id : undefined),
    turns: Array.isArray(input.turns) ? input.turns : undefined,
    founder_id: founderId,
    user_name: userName,
    // Memory + personality injected for the upstream worker to fold into the
    // system prompt. If the worker doesn't yet support these fields, they
    // will be ignored gracefully (extra JSON fields are not an error).
    memory_block: memoryBlock || null,
    personality_system_prompt: personalitySystemPrompt ?? null,
    personality_voice_id: personalityVoiceId ?? null,
    personality_reasoning_effort: personalityReasoningEffort ?? null,
    personality_max_tokens: personalityMaxTokens ?? null,
  };

  // SSE streaming: if the client wants streaming, pass through the worker's
  // event-stream directly without buffering. This is what makes DeepSeek-R1
  // feel responsive — tokens arrive as they're generated.
  if (upstreamPayload.stream) {
    let upstream: Response;
    try {
      upstream = await fetch(ENGINE_URL, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "text/event-stream" },
        body: JSON.stringify(upstreamPayload),
        cache: "no-store",
      });
    } catch (error) {
      return NextResponse.json({ error: "Athena engine is unreachable", detail: error instanceof Error ? error.message : String(error) }, { status: 502 });
    }

    // For streaming responses, we cannot reliably capture the assistant's
    // full output for logging without buffering the entire stream. Instead,
    // we send the session ID back via a header so the client can later POST
    // a /api/athena/log endpoint with the full assistant text if desired.
    // For now, the assistant message is logged as "[streaming]" placeholder;
    // a follow-up batch will add a proper streaming log collector.
    if (sessionId) {
      logAssistantMessage(sessionId, "[streaming response — see client-side capture]", {
        model: upstream.headers.get("x-athena-model") ?? undefined,
      }).catch(() => {/* non-fatal */});
    }

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        "connection": "keep-alive",
        "x-athena-tier": upstream.headers.get("x-athena-tier") || "",
        "x-athena-model": upstream.headers.get("x-athena-model") || "",
        "x-athena-session": sessionId || upstream.headers.get("x-athena-session") || "",
      },
    });
  }

  // Non-streaming path — wait for full verdict
  let upstream: Response;
  try {
    upstream = await fetch(ENGINE_URL, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(upstreamPayload),
      cache: "no-store",
    });
  } catch (error) {
    return NextResponse.json({ error: "Athena engine is unreachable", detail: error instanceof Error ? error.message : String(error) }, { status: 502 });
  }

  const responseBody = await upstream.text();

  // ── Log assistant message (non-blocking) ───────────────────────────────
  // Parse the response to extract text for logging. The shape varies by
  // worker response type; we try a few known shapes and fall back to raw.
  if (sessionId) {
    const assistantText = extractAssistantText(responseBody);
    if (assistantText) {
      logAssistantMessage(sessionId, assistantText, {
        model: upstream.headers.get("x-athena-model") ?? undefined,
      }).catch(() => {/* non-fatal */});
    }
  }

  return new NextResponse(responseBody, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") || "application/json",
      "cache-control": "no-store",
      "x-athena-tier": upstream.headers.get("x-athena-tier") || "",
      "x-athena-model": upstream.headers.get("x-athena-model") || "",
      "x-athena-session": sessionId || "",
    },
  });
}

/**
 * Best-effort extraction of the assistant's text from the upstream response.
 * The Athena worker returns various shapes depending on the tier/model —
 * we try a few known fields and fall back to the raw body if nothing matches.
 */
function extractAssistantText(raw: string): string {
  if (!raw) return "";
  try {
    const json = JSON.parse(raw);
    // OpenAI-style
    if (json?.choices?.[0]?.message?.content) return String(json.choices[0].message.content);
    // Simple {response: "..."} shape
    if (typeof json?.response === "string") return json.response;
    if (typeof json?.message === "string") return json.message;
    if (typeof json?.text === "string") return json.text;
    // Fallback: stringify the whole thing (capped)
    return JSON.stringify(json).slice(0, 5000);
  } catch {
    // Not JSON — return raw text capped at 5000 chars
    return raw.slice(0, 5000);
  }
}
