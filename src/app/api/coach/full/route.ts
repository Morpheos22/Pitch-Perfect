import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { analyzeFullPitchSession, FullPitchAnalysisResult, DeckAnalysisResult, analyzePitchDeck } from "@/lib/ai-service";
import { uploadFile, isStorageConfigured } from "@/lib/storage";
import { extractFileText, extractTextFromUrl } from '@/lib/file-parser';
import { requireModuleAccess } from "@/lib/entitlement";
import { fullPitchIterateSchema } from "@/lib/validation/schemas";
import { blobUrlToDataUri } from "@/lib/blob-signature";

// E4: Full Pitch Session API
// Comprehensive analysis combining deck and 30-min video using REAL AI

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

    const formData = await request.formData();
    const videoUrl = formData.get("videoUrl") as string;
    const videoFile = formData.get("video") as File;
    const deckFile = formData.get("deckFile") as File | null;
    const durationStr = formData.get("duration") as string;
    const videoId = formData.get("videoId") as string;
    const existingDeckId = formData.get("deckId") as string;
    
    // Parse duration (default to 15 minutes if not provided)
    const duration = durationStr ? parseInt(durationStr, 10) : 900;

    // Must have video URL
    if (!videoUrl && !videoFile) {
      return NextResponse.json(
        { error: "Video URL or video file required" },
        { status: 400 }
      );
    }

    let analysisVideoUrl = videoUrl;
    
    // If video file uploaded, store it and get a URL
    if (videoFile && !videoUrl) {
      if (!isStorageConfigured()) {
        return NextResponse.json(
          { error: "Video upload requires storage configuration. Please contact support or provide a video URL from an external source (Cloudinary, etc.)." },
          { status: 400 }
        );
      }
      try {
        const uploadResult = await uploadFile(
          videoFile, user.id, 'video', videoFile.name, videoFile.type
        );
        analysisVideoUrl = uploadResult.url;
      } catch (uploadErr) {
        console.error('[E4] Video upload failed:', uploadErr);
        return NextResponse.json(
          { error: 'Video upload failed. Please try again or provide a video URL.' },
          { status: 500 }
        );
      }
    }

    // Validate duration for full pitch (guard against NaN / non-finite values)
    if (!Number.isFinite(duration) || duration < 180) {
      return NextResponse.json(
        { error: "Video too short for full pitch analysis" },
        { status: 400 }
      );
    }

    if (duration > 3600) {
      return NextResponse.json(
        { error: "Video too long. Maximum duration is 60 minutes." },
        { status: 400 }
      );
    }

    // SSRF prevention: validate video URL host
    if (analysisVideoUrl) {
      // Disallow mock:// even in dev — prevents NODE_ENV misconfig SSRF
      if (analysisVideoUrl.startsWith('mock://')) {
        return NextResponse.json(
          { error: 'Mock storage URLs are not permitted for video analysis.' },
          { status: 400 }
        );
      }
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

    // Get deck analysis if provided
    let deckAnalysis: DeckAnalysisResult | undefined;

    const deckFileUrl = formData.get("deckFileUrl") as string | null;
    const deckFileName = formData.get("deckFileName") as string | null;

    if (deckFileUrl && deckFileName) {
      // NEW: Blob upload flow — extract deck text from URL
      try {
        const deckText = await extractTextFromUrl(deckFileUrl, deckFileName);
        // Run a proper E1 analysis instead of creating a dummy all-zero result
        console.warn("[E4] Running real E1 deck analysis on uploaded deck file...");
        try {
          deckAnalysis = await analyzePitchDeck(deckText);
        } catch (deckAnalysisErr) {
          console.warn("[E4] E1 deck analysis failed, using raw text fallback:", deckAnalysisErr);
          deckAnalysis = {
            overallScore: 0,
            strengths: [`Raw deck content:\n${deckText.substring(0, 8000)}`],
            weaknesses: [],
            recommendations: [],
            problemClarityScore: 0,
            solutionClarityScore: 0,
            marketOpportunityScore: 0,
            businessModelScore: 0,
            teamCredibilityScore: 0,
            tractionScore: 0,
            financialsScore: 0,
            askClarityScore: 0,
            designConsistencyScore: 0,
            readabilityScore: 0,
            visualHierarchyScore: 0,
            colorSchemeScore: 0,
            typographyScore: 0,
          };
        }
        console.warn("[E4] Deck text extracted from Blob URL, length:", deckText.length);
      } catch (parseErr) {
        console.error("[E4] Deck file parsing from URL failed:", parseErr);
        // Non-fatal: continue without deck context
      }
    } else if (deckFile && deckFile.size > 0) {
      // LEGACY: Parse uploaded deck file server-side
      try {
        const deckText = await extractFileText(deckFile);
        // Run a proper E1 analysis instead of creating a dummy all-zero result
        console.warn("[E4] Running real E1 deck analysis on uploaded deck file...");
        try {
          deckAnalysis = await analyzePitchDeck(deckText);
        } catch (deckAnalysisErr) {
          console.warn("[E4] E1 deck analysis failed, using raw text fallback:", deckAnalysisErr);
          deckAnalysis = {
            overallScore: 0,
            strengths: [`Raw deck content:\n${deckText.substring(0, 8000)}`],
            weaknesses: [],
            recommendations: [],
            problemClarityScore: 0,
            solutionClarityScore: 0,
            marketOpportunityScore: 0,
            businessModelScore: 0,
            teamCredibilityScore: 0,
            tractionScore: 0,
            financialsScore: 0,
            askClarityScore: 0,
            designConsistencyScore: 0,
            readabilityScore: 0,
            visualHierarchyScore: 0,
            colorSchemeScore: 0,
            typographyScore: 0,
          };
        }
      } catch (parseErr) {
        console.error('[E4] Deck file parsing failed:', parseErr);
        // Non-fatal: continue without deck context
      }
    } else if (existingDeckId) {
      const existingDeck = await prisma.pitchDeck.findFirst({
        where: { id: existingDeckId, userId: user.id },
      });

      if (existingDeck && existingDeck.rawAnalysis) {
        deckAnalysis = existingDeck.rawAnalysis as unknown as DeckAnalysisResult;
      }
    }

    // Run REAL AI full pitch analysis
    if (!analysisVideoUrl) {
      return NextResponse.json({ error: "Video URL is required for analysis" }, { status: 400 });
    }

    // Private blob URLs need conversion to data URI for AI gateway access
    let aiVideoUrl = analysisVideoUrl;
    try {
      const parsedUrl = new URL(analysisVideoUrl);
      if (parsedUrl.hostname === 'blob.vercel-storage.com' && !parsedUrl.hostname.startsWith('public.')) {
        console.warn('[E4] Converting private blob URL to data URI for vision model');
        const dataUri = await blobUrlToDataUri(analysisVideoUrl);
        if (dataUri) {
          aiVideoUrl = dataUri;
        }
      }
    } catch { /* URL parse error, use as-is */ }

    let analysis: FullPitchAnalysisResult;
    try {
      analysis = await analyzeFullPitchSession(aiVideoUrl, duration, deckAnalysis);
    } catch (aiError: any) {
      console.error("AI full pitch analysis failed:", aiError);
      const msg = aiError?.message || String(aiError);
      const isAuthError = msg.includes('401') || msg.includes('X-Token') || msg.includes('unauthorized');
      return NextResponse.json(
        { error: isAuthError ? "AI service authentication error. Please contact support." : "AI analysis failed. Please try again." },
        { status: 503 }
      );
    }

    // Store analysis in database
    const savedSession = await prisma.fullPitchSession.create({
      data: {
        userId: user.id,
        videoUrl: analysisVideoUrl || "",
        videoId: videoId || `full-${Date.now()}`,
        duration: duration,
        status: "COMPLETED",
        pitchDeckId: existingDeckId || null,
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

    // Return real result
    return NextResponse.json({
      success: true,
      data: {
        overallReadinessScore: analysis.overallReadinessScore,
        investorReadinessLevel: analysis.investorReadinessLevel,
        problemSolutionFit: analysis.problemSolutionFit,
        marketOpportunity: analysis.marketOpportunity,
        businessModelViability: analysis.businessModelViability,
        teamCredibility: analysis.teamCredibility,
        tractionMilestones: analysis.tractionMilestones,
        deliveryPresence: analysis.deliveryPresence,
        contentScores: analysis.contentScores,
        deliveryScores: analysis.deliveryScores,
        strengths: analysis.strengths,
        weaknesses: analysis.weaknesses,
        investorConcerns: analysis.investorConcerns,
        recommendedActions: analysis.recommendedActions,
        anticipatedQuestions: analysis.anticipatedQuestions,
        competitiveAnalysis: analysis.competitiveAnalysis,
        transcript: analysis.transcript,
        tokensUsed: analysis.tokensUsed,
      },
      id: savedSession.id,
      modelUsed: analysis.modelUsed,
    });
  } catch (error) {
    console.error("Full session analysis error:", error);
    return NextResponse.json(
      { error: "Failed to analyze full session" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
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

    const body = await request.json();
    const parsed = fullPitchIterateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const validatedData = parsed.data;
    const notes = validatedData.notes;

    if (!validatedData.id) {
      return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (notes !== undefined) updateData.notes = notes;

    const updated = await prisma.fullPitchSession.update({
      where: { id: validatedData.id, userId: user.id },
      data: updateData,
    });

    return NextResponse.json({ success: true, notes: updated.notes });
  } catch (error) {
    console.error("PATCH full session error:", error);
    return NextResponse.json({ error: "Failed to update session" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("id");

    if (!sessionId) {
      return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
    }

    await prisma.fullPitchSession.delete({
      where: { id: sessionId, userId: user.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE full session error:", error);
    return NextResponse.json({ error: "Failed to delete session" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("id");

    // Single session lookup by ID (for session detail page)
    if (sessionId) {
      const session = await prisma.fullPitchSession.findFirst({
        where: { id: sessionId, userId: user.id },
      });

      if (!session) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }

      return NextResponse.json({
        id: session.id,
        status: session.status,
        createdAt: session.createdAt,
        analyzedAt: session.analyzedAt,
        notes: session.notes,
        version: session.version,
        parentId: session.parentFullSessionId,
        duration: session.duration,
        investorReadinessLevel: session.investorReadinessLevel,
        overallReadinessScore: session.overallReadinessScore,
        problemSolutionFit: session.problemSolutionFit,
        marketOpportunity: session.marketOpportunity,
        businessModelViability: session.businessModelViability,
        teamCredibility: session.teamCredibility,
        tractionMilestones: session.tractionMilestones,
        deliveryPresence: session.deliveryPresence,
        contentScores: session.contentScores,
        deliveryScores: session.deliveryScores,
        strengths: session.strengths,
        weaknesses: session.weaknesses,
        investorConcerns: session.investorConcerns,
        recommendedActions: session.recommendedActions,
        anticipatedQuestions: session.anticipatedQuestions,
        competitiveAnalysis: session.competitiveAnalysis,
        transcript: session.transcript,
      });
    }

    // List all sessions (for history page)
    const sessions = await prisma.fullPitchSession.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json({
      success: true,
      data: sessions,
    });
  } catch (error) {
    console.error("Get session history error:", error);
    return NextResponse.json(
      { error: "Failed to get session history" },
      { status: 500 }
    );
  }
}
