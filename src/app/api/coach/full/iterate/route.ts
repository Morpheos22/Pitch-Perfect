import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { analyzeFullPitchSession } from "@/lib/ai-service";
import { requireModuleAccess } from "@/lib/entitlement";
import { fullPitchIterateSchema } from "@/lib/validation/schemas";
import { blobUrlToDataUri } from "@/lib/blob-signature";
import { withRateLimit } from "@/lib/rate-limit";

// POST /api/coach/full/iterate
// Creates a new version of a full pitch session analysis, incorporating the previous analysis.

async function handlePost(request: NextRequest) {
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
    const parsed = fullPitchIterateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const validatedData = parsed.data;
    const parentId = validatedData.id;
    const { videoUrl, duration } = body;

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

    // C8: SSRF prevention — validate video URL host (same as parent route)
    if (!analysisVideoUrl.startsWith('mock://')) {
      const allowedVideoHosts = [
        'workdrive.zoho.com', 'zoho.com',
        'blob.vercel-storage.com',
        'public.blob.vercel-storage.com',
      ];
      try {
        const parsedUrl = new URL(analysisVideoUrl);
        const isAllowed = allowedVideoHosts.some(h =>
          parsedUrl.hostname === h || parsedUrl.hostname.endsWith('.' + h)
        );
        if (!isAllowed) {
          return NextResponse.json(
            { error: 'Invalid video source. Files must be uploaded through the platform.' },
            { status: 400 }
          );
        }
      } catch {
        return NextResponse.json(
          { error: 'Invalid video URL format.' },
          { status: 400 }
        );
      }
    }

    // M2: Validate duration bounds (same as parent route)
    if (!Number.isFinite(analysisDuration) || analysisDuration < 180 || analysisDuration > 3600) {
      return NextResponse.json(
        { error: 'Duration must be between 3 and 60 minutes.' },
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

    // Run AI full pitch analysis with previous analysis context for iteration awareness
    const previousAnalysis = {
      overallReadinessScore: parentSession.overallReadinessScore ?? undefined,
      problemSolutionFit: parentSession.problemSolutionFit ?? undefined,
      marketOpportunity: parentSession.marketOpportunity ?? undefined,
      businessModelViability: parentSession.businessModelViability ?? undefined,
      teamCredibility: parentSession.teamCredibility ?? undefined,
      tractionMilestones: parentSession.tractionMilestones ?? undefined,
      deliveryPresence: parentSession.deliveryPresence ?? undefined,
      weaknesses: (parentSession.weaknesses as string[]) ?? undefined,
      recommendedActions: (parentSession.recommendedActions as string[]) ?? undefined,
    };
    // Private blob URLs need conversion to data URI for AI gateway access
    // (same pattern as parent /api/coach/full route)
    let aiVideoUrl = analysisVideoUrl;
    try {
      const parsedUrl = new URL(analysisVideoUrl);
      if (parsedUrl.hostname === 'blob.vercel-storage.com' && !parsedUrl.hostname.startsWith('public.')) {
        console.warn('[E4-iterate] Converting private blob URL to data URI for vision model');
        const dataUri = await blobUrlToDataUri(analysisVideoUrl);
        if (dataUri) {
          aiVideoUrl = dataUri;
        }
      }
    } catch { /* URL parse error, use as-is */ }

    const analysis = await analyzeFullPitchSession(
      aiVideoUrl,
      analysisDuration,
      deckAnalysis,
      previousAnalysis
    );

    // ── Score consistency validation (same as parent route) ──
    const clampScore = (v: number | null | undefined): number => {
      if (v == null || !Number.isFinite(v)) return 0;
      return Math.max(0, Math.min(100, Math.round(v)));
    };

    analysis.problemSolutionFit = clampScore(analysis.problemSolutionFit);
    analysis.marketOpportunity = clampScore(analysis.marketOpportunity);
    analysis.businessModelViability = clampScore(analysis.businessModelViability);
    analysis.teamCredibility = clampScore(analysis.teamCredibility);
    analysis.tractionMilestones = clampScore(analysis.tractionMilestones);
    analysis.deliveryPresence = clampScore(analysis.deliveryPresence);
    analysis.overallReadinessScore = clampScore(analysis.overallReadinessScore);

    if (analysis.contentScores) {
      for (const key of Object.keys(analysis.contentScores) as (keyof typeof analysis.contentScores)[]) {
        analysis.contentScores[key] = clampScore(analysis.contentScores[key]);
      }
    }
    if (analysis.deliveryScores) {
      for (const key of Object.keys(analysis.deliveryScores) as (keyof typeof analysis.deliveryScores)[]) {
        analysis.deliveryScores[key] = clampScore(analysis.deliveryScores[key]);
      }
    }

    const validReadinessLevels = ['NOT_READY', 'NEEDS_WORK', 'INVESTOR_READY', 'HIGHLY_PREPARED'];
    if (!validReadinessLevels.includes(analysis.investorReadinessLevel)) {
      console.warn(`[E4-iterate] Invalid investorReadinessLevel "${analysis.investorReadinessLevel}" — defaulting to NEEDS_WORK`);
      analysis.investorReadinessLevel = 'NEEDS_WORK';
    }

    const subScoreAvg = (
      analysis.problemSolutionFit +
      analysis.marketOpportunity +
      analysis.businessModelViability +
      analysis.teamCredibility +
      analysis.tractionMilestones +
      analysis.deliveryPresence
    ) / 6;
    const overallDelta = Math.abs(analysis.overallReadinessScore - subScoreAvg);
    if (overallDelta > 30) {
      console.warn(`[E4-iterate] Score inconsistency: overall=${analysis.overallReadinessScore} vs sub-avg=${subScoreAvg.toFixed(1)} (delta=${overallDelta.toFixed(1)})`);
    }

    // H8: Atomic version numbering — query DB max instead of trusting client
    const latestVersion = await prisma.fullPitchSession.findFirst({
      where: { parentFullSessionId: parentId, userId: user.id },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const nextVersion = (latestVersion?.version || parentSession.version || 1) + 1;

    // Store as new session with parent reference
    const savedSession = await prisma.fullPitchSession.create({
      data: {
        userId: user.id,
        videoUrl: analysisVideoUrl,
        videoId: `full-${Date.now()}`,
        duration: analysisDuration,
        status: "COMPLETED",
        pitchDeckId: parentSession.pitchDeckId,
        version: nextVersion,
        parentFullSessionId: parentId,
        problemSolutionFit: analysis.problemSolutionFit,
        marketOpportunity: analysis.marketOpportunity,
        businessModelViability: analysis.businessModelViability,
        teamCredibility: analysis.teamCredibility,
        tractionMilestones: analysis.tractionMilestones,
        deliveryPresence: analysis.deliveryPresence,
        overallReadinessScore: analysis.overallReadinessScore,
        investorReadinessLevel: (() => {
          const validLevels = ['NOT_READY', 'NEEDS_WORK', 'INVESTOR_READY', 'HIGHLY_PREPARED'];
          return validLevels.includes(analysis.investorReadinessLevel)
            ? analysis.investorReadinessLevel
            : 'NEEDS_WORK';
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

    // NOTE: Usage is tracked atomically inside requireModuleAccess() — no separate increment needed

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

export const POST = withRateLimit(handlePost, {
  limit: 5,
  windowMs: 60_000,
  identifierType: 'both',
  name: 'AI Analysis',
});
