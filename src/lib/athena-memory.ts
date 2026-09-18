/**
 * Athena memory layer — query and write functions.
 *
 * ARCHITECTURE:
 *   - Memories are stored in the `athena_memory` table with a 36-hour TTL.
 *   - On every Athena invocation, `getActiveMemories(userId)` is called
 *     to retrieve non-archived, non-expired memory entries for the user.
 *     These are injected into the system prompt as context.
 *   - After every Athena response, `logAssistantMessage()` writes the
 *     assistant's reply to `athena_messages` and updates the session.
 *   - The 36-hour refresh cron (workers/athena-memory-cron/) summarizes
 *     old sessions into compact memory entries, then archives raw messages.
 *
 * All functions are non-blocking on errors — they log and return null/empty
 * rather than throw, so a DB issue never breaks Athena's chat response.
 */

import { prisma } from "@/lib/db";

const MEMORY_TTL_HOURS = 36;

export interface AthenaMemoryEntry {
  id: string;
  kind: string; // preference | fact | skill | correction | intent
  content: string;
  confidence: number;
  createdAt: Date;
}

export interface AthenaPersonalityConfig {
  name: string;
  systemPrompt: string;
  voiceId: string | null;
  reasoningEffort: string;
  maxTokens: number;
  temperature: number;
}

// ── Active memory query ──────────────────────────────────────────────────

/**
 * Retrieve all active (non-archived, non-expired) memory entries for a user.
 * Called before every Athena invocation. Results are injected into the
 * system prompt so Athena retains context across sessions.
 *
 * Also bumps `timesRecalled` + `lastRecalledAt` on each memory returned,
 * so the system can later prioritize "frequently-recalled" memories.
 */
export async function getActiveMemories(userId: string): Promise<AthenaMemoryEntry[]> {
  try {
    const memories = await prisma.athenaMemory.findMany({
      where: {
        userId,
        archived: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: [{ confidence: "desc" }, { lastRecalledAt: "desc" }],
      take: 50, // Cap at 50 entries to keep system prompt bounded
    });

    // Bump recall stats (fire-and-forget — non-blocking)
    if (memories.length > 0) {
      const now = new Date();
      prisma.athenaMemory.updateMany({
        where: { id: { in: memories.map(m => m.id) } },
        data: { timesRecalled: { increment: 1 }, lastRecalledAt: now },
      }).catch(() => {/* non-fatal */});
    }

    return memories.map(m => ({
      id: m.id,
      kind: m.kind,
      content: m.content,
      confidence: m.confidence,
      createdAt: m.createdAt,
    }));
  } catch (err) {
    console.warn("[athena-memory] getActiveMemories failed:", err instanceof Error ? err.message : err);
    return [];
  }
}

/**
 * Format active memories into a compact block for system prompt injection.
 * Returns empty string if no memories — caller should not inject the block.
 */
export function formatMemoriesForPrompt(memories: AthenaMemoryEntry[]): string {
  if (memories.length === 0) return "";

  const grouped = new Map<string, string[]>();
  for (const m of memories) {
    const arr = grouped.get(m.kind) ?? [];
    arr.push(m.content);
    grouped.set(m.kind, arr);
  }

  const lines: string[] = ["", "=== ATHENA MEMORY (last 36 hours) ==="];
  for (const [kind, entries] of grouped) {
    lines.push(`[${kind.toUpperCase()}]`);
    for (const e of entries) lines.push(`  - ${e}`);
  }
  lines.push("=== END MEMORY ===", "");
  return lines.join("\n");
}

// ── Session lifecycle ───────────────────────────────────────────────────

/**
 * Start or resume an Athena session.
 * - If sessionId is provided AND belongs to this user AND is "active", resume it.
 * - Otherwise, create a new session.
 *
 * Returns the sessionId to use for subsequent message logging.
 */
export async function startOrResumeSession(userId: string, sessionId?: string): Promise<string> {
  try {
    if (sessionId) {
      const existing = await prisma.athenaSession.findFirst({
        where: { id: sessionId, userId, status: "active" },
        select: { id: true },
      });
      if (existing) return existing.id;
    }

    const session = await prisma.athenaSession.create({
      data: { userId, status: "active" },
      select: { id: true },
    });
    return session.id;
  } catch (err) {
    console.warn("[athena-memory] startOrResumeSession failed:", err instanceof Error ? err.message : err);
    // Return empty string — caller can still proceed without session tracking
    return "";
  }
}

// ── Message logging ─────────────────────────────────────────────────────

/**
 * Log a user message to the session. Non-blocking on errors.
 */
export async function logUserMessage(
  sessionId: string,
  content: string,
  meta?: { tokensIn?: number; model?: string }
): Promise<void> {
  if (!sessionId) return;
  try {
    await prisma.$transaction([
      prisma.athenaMessage.create({
        data: {
          sessionId,
          role: "user",
          content,
          tokensIn: meta?.tokensIn ?? null,
          model: meta?.model ?? null,
        },
      }),
      prisma.athenaSession.update({
        where: { id: sessionId },
        data: {
          lastMessageAt: new Date(),
          messageCount: { increment: 1 },
        },
      }),
    ]);
  } catch (err) {
    console.warn("[athena-memory] logUserMessage failed:", err instanceof Error ? err.message : err);
  }
}

/**
 * Log an assistant message to the session. Non-blocking on errors.
 */
export async function logAssistantMessage(
  sessionId: string,
  content: string,
  meta?: { tokensOut?: number; model?: string; latencyMs?: number; toolCalls?: unknown }
): Promise<void> {
  if (!sessionId) return;
  try {
    await prisma.$transaction([
      prisma.athenaMessage.create({
        data: {
          sessionId,
          role: "assistant",
          content,
          tokensOut: meta?.tokensOut ?? null,
          model: meta?.model ?? null,
          latencyMs: meta?.latencyMs ?? null,
          toolCalls: meta?.toolCalls ? (meta.toolCalls as object) : undefined,
        },
      }),
      prisma.athenaSession.update({
        where: { id: sessionId },
        data: {
          lastMessageAt: new Date(),
          messageCount: { increment: 1 },
          tokensUsed: { increment: meta?.tokensOut ?? 0 },
          modelUsed: meta?.model ?? null,
        },
      }),
    ]);
  } catch (err) {
    console.warn("[athena-memory] logAssistantMessage failed:", err instanceof Error ? err.message : err);
  }
}

// ── Memory writing ──────────────────────────────────────────────────────

/**
 * Write a new memory entry. The 36-hour TTL is computed from `now()`.
 * Used by the cron summarizer AND by inline memory extraction.
 */
export async function addMemory(
  userId: string,
  kind: string,
  content: string,
  opts?: { sessionId?: string; confidence?: number }
): Promise<void> {
  try {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + MEMORY_TTL_HOURS * 60 * 60 * 1000);
    await prisma.athenaMemory.create({
      data: {
        userId,
        sessionId: opts?.sessionId ?? null,
        kind,
        content,
        confidence: opts?.confidence ?? 1.0,
        expiresAt,
      },
    });
  } catch (err) {
    console.warn("[athena-memory] addMemory failed:", err instanceof Error ? err.message : err);
  }
}

/**
 * Refresh a memory's TTL — bumps `expiresAt` to now + 36h.
 * Called when a memory is touched (recalled) by a related conversation.
 */
export async function refreshMemoryTTL(memoryId: string): Promise<void> {
  try {
    const expiresAt = new Date(Date.now() + MEMORY_TTL_HOURS * 60 * 60 * 1000);
    await prisma.athenaMemory.update({
      where: { id: memoryId },
      data: { expiresAt },
    });
  } catch (err) {
    console.warn("[athena-memory] refreshMemoryTTL failed:", err instanceof Error ? err.message : err);
  }
}

// ── Personality ────────────────────────────────────────────────────────

/**
 * Get the currently-enabled Athena personality. Falls back to a hardcoded
 * default if no row is enabled (e.g., migration not yet applied, or DB issue).
 */
export async function getActivePersonality(): Promise<AthenaPersonalityConfig> {
  const fallback: AthenaPersonalityConfig = {
    name: "fallback",
    systemPrompt:
      "You are Athena, an adaptive AI cofounder and pitch coach. You engage the user in voice unless they explicitly ask for text-only. You take real-world actions via tool calls when needed. Your tone is direct, founder-to-founder.",
    voiceId: null,
    reasoningEffort: "high",
    maxTokens: 8192,
    temperature: 0.7,
  };

  try {
    const p = await prisma.athenaPersonality.findFirst({
      where: { enabled: true },
    });
    if (!p) return fallback;
    return {
      name: p.name,
      systemPrompt: p.systemPrompt,
      voiceId: p.voiceId,
      reasoningEffort: p.reasoningEffort,
      maxTokens: p.maxTokens,
      temperature: p.temperature,
    };
  } catch (err) {
    console.warn("[athena-memory] getActivePersonality failed:", err instanceof Error ? err.message : err);
    return fallback;
  }
}

// ── Session close ───────────────────────────────────────────────────────

/**
 * Mark a session as ended. Called when the user closes the chat widget
 * or after a configurable idle period.
 */
export async function endSession(sessionId: string): Promise<void> {
  if (!sessionId) return;
  try {
    await prisma.athenaSession.update({
      where: { id: sessionId },
      data: {
        endedAt: new Date(),
        status: "closed",
      },
    });
  } catch (err) {
    console.warn("[athena-memory] endSession failed:", err instanceof Error ? err.message : err);
  }
}
