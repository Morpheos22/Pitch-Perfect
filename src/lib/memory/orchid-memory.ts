import { prisma } from "@/lib/db";

export type AthenaMemory = {
  source: "orchid" | "db_fallback" | "empty";
  sessions: Array<Record<string, unknown>>;
  context: string;
};

const ORCHID_URL = "https://pitchcoachai.tech/api/integrations/orchid/athena";

function formatMemory(source: AthenaMemory["source"], sessions: Array<Record<string, unknown>>): AthenaMemory {
  const context = sessions.length
    ? sessions.map((session, index) => `Session ${index + 1}: ${JSON.stringify(session)}`).join("\n")
    : "No prior pitch sessions are available.";
  return { source, sessions, context };
}

export async function fetchOrchidMemory(userId: string, sessionLimit = 2): Promise<AthenaMemory> {
  if (!userId) return formatMemory("empty", []);
  try {
    const secret = process.env.PITCHCOACH_ORCHID_SECRET;
    const response = await fetch(ORCHID_URL, {
      method: "POST",
      signal: AbortSignal.timeout(8000),
      headers: { "content-type": "application/json", ...(secret ? { authorization: `Bearer ${secret}` } : {}) },
      body: JSON.stringify({ userId, sessionLimit, tier: "orchid6" }),
    });
    if (!response.ok) throw new Error(`Orchid returned ${response.status}`);
    const payload = await response.json() as { sessions?: unknown; memory?: unknown; context?: unknown };
    const sessions = Array.isArray(payload.sessions) ? payload.sessions.slice(0, sessionLimit) : [];
    if (sessions.length || payload.memory || payload.context) {
      return formatMemory("orchid", sessions.length ? sessions as Array<Record<string, unknown>> : [{ memory: payload.memory, context: payload.context }]);
    }
    throw new Error("Orchid returned no memory records");
  } catch (error) {
    console.warn("[MEMORY_SOURCE: orchid_failed]", error);
  }

  try {
    const user = await prisma.user.findUnique({ where: { clerkId: userId }, select: { id: true } });
    if (!user) return formatMemory("empty", []);
    const sessions = await prisma.fullPitchSession.findMany({ where: { userId: user.id, status: "COMPLETED" }, orderBy: { updatedAt: "desc" }, take: sessionLimit, select: { id: true, overallReadinessScore: true, contentScores: true, deliveryScores: true, strengths: true, weaknesses: true, investorConcerns: true, recommendedActions: true, notes: true, updatedAt: true } });
    if (sessions.length) return formatMemory("db_fallback", sessions as Array<Record<string, unknown>>);
    return formatMemory("empty", []);
  } catch (error) {
    console.warn("[MEMORY_SOURCE: db_failed]", error);
    return formatMemory("empty", []);
  }
}
