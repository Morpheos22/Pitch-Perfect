import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { analyzeFullPitchSession } from "@/lib/ai-service";
import { requireModuleAccess } from "@/lib/entitlement";

// POST /api/coach/full/iterate
// Creates a new version of a full pitch session analysis, incorporating the previous analysis.

export async function POST(request: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // ── Entitlement check ──
    const entitlement = await requireModuleAccess(user.id, 'e4');
    if (!entitlement.allowed) {
      return NextResponse.json({ error: entitlement.reason }, { status: 403 });
    }

    const body = await request.json();
    const { parentId, videoUrl, duration } = body;

    if (!parentId) {
      return NextResponse.json({ error: "Parent session ID is required" }, { status: 400 });
    }

    // Fetch the parent session
    const parentSession = await prisma.fullPitchSession.findFirst({
      where: { id: parentId, userId: user.id },
    });

    if (!parentSession) {
      return NextResponse.json({ error: "Parent session not found" }, { status: 404 });
    }

    // Use new video URL or fall back to parent's video
    const analysisVideoUrl = videoUrl || parentSession.videoUrl;
    const analysisDuration = duration || parentSession.duration;

    if (!analysisVideoUrl) {
      return NextResponse.json(
        { error: "No video available for re-analysis" },
        { status: 400 }
      );
    }

    // Get parent deck analysis if available
    let deckAnalysis;
    if (parentSession.pitchDeckId) {
      const parentDeck = await prisma.pitchDeck.findFirst({
        where: { id: parentSession.pitchDeckId, userId: user.id },
      });
      if (parentDeck?.rawAnalysis) {
        deckAnalysis = parentDeck.rawAnalysis as any;
      }
    }

    // Run AI full pitch analysis
    // Note: analyzeFullPitchSession doesn't take previousAnalysis param directly,
    // but the deck context provides continuity
    const analysis = await analyzeFullPitchSession(
      analysisVideoUrl,
      analysisDuration,
      deckAnalysis
    );

    // Determine version number
    const parentVersion = parentSession.version || 1;

    // Store as new session with parent reference
    const savedSession = await prisma.fullPitchSession.create({
      data: {
        userId: user.id,
        videoUrl: analysisVideoUrl,
        videoId: `full-${Date.now()}`,
        duration: analysisDuration,
        status: "COMPLETED",
        pitchDeckId: parentSession.pitchDeckId,
        version: parentVersion + 1,
        parentFullSessionId: parentId,
        problemSolutionFit: analysis.problemSolutionFit,
        marketOpportunity: analysis.marketOpportunity,
        businessModelViability: analysis.businessModelViability,
        teamCredibility: analysis.teamCredibility,
        tractionMilestones: analysis.tractionMilestones,
        deliveryPresence: analysis.deliveryPresence,
        overallReadinessScore: analysis.overallReadinessScore,
        investorReadinessLevel: (() => {
          const validLevels = ['NOT_READY', 'EARLY_STAGE', 'DEVELOPING', 'INVESTOR_READY', 'HIGHLY_PREPARED'];
          return validLevels.includes(analysis.investorReadinessLevel)
            ? analysis.investorReadinessLevel
            : 'DEVELOPING';
        })() as any,
        contentScores: analysis.contentScores,
        deliveryScores: analysis.deliveryScores,
        strengths: analysis.strengths,
        weaknesses: analysis.weaknesses,
        investorConcerns: analysis.investorConcerns,
        recommendedActions: analysis.recommendedActions,
        anticipatedQuestions: analysis.anticipatedQuestions,
        competitiveAnalysis: analysis.competitiveAnalysis,
        transcript: analysis.transcript,
        analyzedAt: new Date(),
      },
    });

    // Increment usage
    await prisma.usage.upsert({
      where: { userId: user.id },
      create: { userId: user.id, e4FullPitchSessions: 1 },
      update: { e4FullPitchSessions: { increment: 1 } },
    });

    return NextResponse.json({
      success: true,
      id: savedSession.id,
      version: savedSession.version,
      parentId: parentId,
      overallReadinessScore: analysis.overallReadinessScore,
      parentOverallScore: parentSession.overallReadinessScore,
      delta: (analysis.overallReadinessScore ?? 0) - (parentSession.overallReadinessScore ?? 0),
      modelUsed: analysis.modelUsed,
    });
  } catch (error) {
    console.error("Full session iterate error:", error);
    return NextResponse.json(
      { error: "Failed to iterate full session analysis" },
      { status: 500 }
    );
  }
}
