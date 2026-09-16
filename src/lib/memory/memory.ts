import { prisma } from "@/lib/db";

export type AthenaMemory = {
  source: "db_fallback" | "empty";
  sessions: Array<Record<string, unknown>>;
  context: string;
};

function formatMemory(source: AthenaMemory["source"], sessions: Array<Record<string, unknown>>): AthenaMemory {
  const context = sessions.length
    ? sessions.map((session, index) => `Session ${index + 1}: ${JSON.stringify(session)}`).join("\n")
    : "No prior pitch sessions are available.";
  return { source, sessions, context };
}

export async function fetchMemory(userId: string, sessionLimit = 2): Promise<AthenaMemory> {
  if (!userId) return formatMemory("empty", []);

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
