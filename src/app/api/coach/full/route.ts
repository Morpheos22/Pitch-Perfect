import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { analyzeFullPitchSession, FullPitchAnalysisResult, DeckAnalysisResult } from "@/lib/ai-service";

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
    
    if (videoFile && !videoUrl) {
      return NextResponse.json(
        { error: "Video file upload requires storage configuration" },
        { status: 400 }
      );
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
      const allowedVideoHosts = ['workdrive.zoho.com', 'zoho.com', 'vercel.app', 'cloudinary.com', 'cloudfront.net'];
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
    } catch (aiError) {
      console.error("AI full pitch analysis failed:", aiError);
      return NextResponse.json(
        { error: "AI analysis failed" },
        { status: 500 }
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
