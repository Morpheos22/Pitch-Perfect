import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { analyzeFullPitchSession, FullPitchAnalysisResult, DeckAnalysisResult } from "@/lib/ai-service";
import { uploadFile, isStorageConfigured } from "@/lib/storage";

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

    const formData = await request.formData();
    const videoUrl = formData.get("videoUrl") as string;
    const videoFile = formData.get("video") as File;
    const deckContent = formData.get("deckContent") as string;
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
        console.log(`[E4] Video uploaded: ${uploadResult.url} (${uploadResult.fileSize} bytes)`);
      } catch (uploadErr) {
        console.error('[E4] Video upload failed:', uploadErr);
        return NextResponse.json(
          { error: `Video upload failed: ${uploadErr instanceof Error ? uploadErr.message : 'Unknown error'}` },
          { status: 500 }
        );
      }
    }

    // Validate duration for full pitch
    if (duration < 180) {
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
      // Allow internal mock URLs (dev) and all known storage backends
      if (analysisVideoUrl.startsWith('mock://')) {
        // Mock storage URL — skip SSRF check in development
        console.warn('[E4] Using mock storage URL. Video analysis may have limited results.');
      } else {
        const allowedVideoHosts = [
          'workdrive.zoho.com', 'zoho.com',
          'vercel.app', 'vercel-storage.com',
          'cloudinary.com', 'cloudfront.net',
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
    }

    // Get deck analysis if provided
    let deckAnalysis: DeckAnalysisResult | undefined;
    
    if (existingDeckId) {
      const existingDeck = await prisma.pitchDeck.findFirst({
        where: { id: existingDeckId, userId: user.id },
      });
      
      if (existingDeck && existingDeck.rawAnalysis) {
        deckAnalysis = existingDeck.rawAnalysis as unknown as DeckAnalysisResult;
      }
    }

    // Run REAL AI full pitch analysis
    let analysis: FullPitchAnalysisResult;
    try {
      analysis = await analyzeFullPitchSession(analysisVideoUrl!, duration, deckAnalysis);
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
        investorReadinessLevel: analysis.investorReadinessLevel as any,
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
