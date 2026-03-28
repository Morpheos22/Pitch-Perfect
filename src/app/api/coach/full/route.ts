import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { analyzeFullPitchSession, DeckAnalysisResult } from "@/lib/ai-service";
import { generatePresignedDownloadUrl, uploadFile, extractFileText, isR2Configured } from "@/lib/storage";

// E4: Full Pitch Session API
// Comprehensive analysis combining deck and 30-min video
// Uses GLM-4V-Plus for deep video analysis (up to 30 minutes)
// SECURITY: Uses auth() to get authenticated user - NEVER trust client input for userId

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Get authenticated user from session
    const { userId: clerkId } = await auth();

    if (!clerkId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get internal user ID from database
    const user = await db.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const formData = await request.formData();
    
    // Input options - can provide videoId (from /api/video), videoUrl, or r2Key
    const videoId = formData.get("videoId") as string;
    let videoUrl = formData.get("videoUrl") as string;
    const r2Key = formData.get("r2Key") as string;
    const duration = parseInt(formData.get("duration") as string) || 1800; // Default 30 min
    
    // Deck options - can provide deckId (existing deck), file, or text content
    const deckId = formData.get("deckId") as string;
    const deckFile = formData.get("deck") as File | null;
    const deckContent = formData.get("deckContent") as string;

    // Validate - need video and optionally deck
    if (!videoId && !videoUrl && !r2Key) {
      return NextResponse.json(
        { error: "Video is required. Provide videoId, videoUrl, or r2Key." },
        { status: 400 }
      );
    }

    // Variables to track
    let finalVideoUrl = videoUrl;
    let videoRecord = null;
    let deckAnalysis: DeckAnalysisResult | undefined;
    let deckRecord = null;
    let fileName: string | undefined;
    let deckR2Key: string | undefined;

    // ========================================
    // HANDLE VIDEO
    // ========================================
    
    if (videoId && !finalVideoUrl) {
      // Look up video from database
      videoRecord = await db.pitchVideo.findFirst({
        where: { id: videoId, userId: user.id },
      });
      
      if (!videoRecord) {
        return NextResponse.json(
          { error: "Video not found" },
          { status: 404 }
        );
      }
      
      // Generate presigned URL for AI to access
      if (videoRecord.r2Key && isR2Configured()) {
        finalVideoUrl = await generatePresignedDownloadUrl(videoRecord.r2Key);
      } else if (videoRecord.fileUrl) {
        finalVideoUrl = videoRecord.fileUrl;
      }
    } else if (r2Key && !finalVideoUrl && isR2Configured()) {
      // Generate presigned URL from R2 key
      finalVideoUrl = await generatePresignedDownloadUrl(r2Key);
    }

    if (!finalVideoUrl) {
      return NextResponse.json(
        { error: "Could not generate video URL for analysis" },
        { status: 500 }
      );
    }

    // ========================================
    // HANDLE DECK (OPTIONAL)
    // ========================================
    
    if (deckId) {
      // Use existing deck analysis
      deckRecord = await db.pitchDeck.findFirst({
        where: { id: deckId, userId: user.id },
      });
      
      if (deckRecord && deckRecord.rawAnalysis) {
        deckAnalysis = deckRecord.rawAnalysis as DeckAnalysisResult;
      }
    } else if (deckFile) {
      // Upload and parse new deck
      fileName = deckFile.name;
      
      // Validate file type
      const allowedTypes = [
        "application/pdf",
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation"
      ];
      const ext = deckFile.name.toLowerCase().split('.').pop();
      
      if (!allowedTypes.includes(deckFile.type) && !['pdf', 'ppt', 'pptx'].includes(ext || '')) {
        return NextResponse.json(
          { error: "Invalid deck file type. Please upload a PDF or PPTX file." },
          { status: 400 }
        );
      }
      
      // Upload to R2
      const uploadResult = await uploadFile(
        deckFile,
        user.id,
        'deck',
        deckFile.name,
        deckFile.type
      );
      deckR2Key = uploadResult.key;
      
      // Extract text content
      let extractedContent = deckContent;
      if (!extractedContent) {
        try {
          const extracted = await extractFileText(uploadResult.key, deckFile.type, deckFile.name);
          extractedContent = extracted.text;
          console.log(`[E4] Extracted ${extracted.wordCount} words from deck ${deckFile.name}`);
        } catch (e) {
          console.error('[E4] Failed to extract deck content:', e);
          extractedContent = `[Deck content from ${deckFile.name}]`;
        }
      }
      
      // Create deck record
      deckRecord = await db.pitchDeck.create({
        data: {
          userId: user.id,
          fileName: deckFile.name,
          fileUrl: uploadResult.url,
          fileSize: uploadResult.fileSize,
          fileType: deckFile.type,
          status: 'PROCESSING',
        },
      });
      
      // Note: We don't run separate deck analysis here - 
      // it will be combined with video in analyzeFullPitchSession
    }

    // ========================================
    // CREATE SESSION RECORD
    // ========================================
    
    const session = await db.fullPitchSession.create({
      data: {
        userId: user.id,
        pitchDeckId: deckRecord?.id,
        fileName: fileName,
        r2Key: r2Key || videoRecord?.r2Key,
        videoUrl: finalVideoUrl,
        duration: duration,
        status: 'PROCESSING',
      },
    });

    // ========================================
    // RUN AI ANALYSIS
    // ========================================
    
    try {
      console.log(`[E4] Starting full pitch analysis for session ${session.id}`);
      console.log(`[E4] Video URL: ${finalVideoUrl}, Duration: ${duration}s`);
      
      const analysis = await analyzeFullPitchSession(
        finalVideoUrl,
        duration,
        deckAnalysis
      );

      // ========================================
      // UPDATE RECORDS WITH RESULTS
      // ========================================
      
      await db.fullPitchSession.update({
        where: { id: session.id },
        data: {
          status: 'COMPLETED',
          problemSolutionFit: analysis.problemSolutionFit,
          marketOpportunity: analysis.marketOpportunity,
          businessModelViability: analysis.businessModelViability,
          teamCredibility: analysis.teamCredibility,
          tractionMilestones: analysis.tractionMilestones,
          deliveryPresence: analysis.deliveryPresence,
          overallReadinessScore: analysis.overallReadinessScore,
          investorReadinessLevel: analysis.investorReadinessLevel,
          contentScores: analysis.contentScores,
          deliveryScores: analysis.deliveryScores,
          strengths: analysis.strengths,
          weaknesses: analysis.weaknesses,
          investorConcerns: analysis.investorConcerns,
          recommendedActions: analysis.recommendedActions,
          competitiveAnalysis: analysis.competitiveAnalysis,
          anticipatedQuestions: analysis.anticipatedQuestions,
          transcript: analysis.transcript,
          analyzedAt: new Date(),
        },
      });

      // Update video record if exists
      if (videoRecord) {
        await db.pitchVideo.update({
          where: { id: videoRecord.id },
          data: { status: 'COMPLETED' },
        });
      }

      // Return comprehensive results
      return NextResponse.json({
        success: true,
        data: {
          id: session.id,
          status: 'COMPLETED',
          investorReadinessLevel: analysis.investorReadinessLevel,
          overallScore: analysis.overallReadinessScore,
          dimensionScores: {
            problemSolutionFit: analysis.problemSolutionFit,
            marketOpportunity: analysis.marketOpportunity,
            businessModelViability: analysis.businessModelViability,
            teamCredibility: analysis.teamCredibility,
            tractionMilestones: analysis.tractionMilestones,
            deliveryPresence: analysis.deliveryPresence,
          },
          contentBreakdown: analysis.contentScores,
          deliveryBreakdown: analysis.deliveryScores,
          strengths: analysis.strengths,
          weaknesses: analysis.weaknesses,
          investorConcerns: analysis.investorConcerns,
          recommendedActions: analysis.recommendedActions,
          anticipatedQuestions: analysis.anticipatedQuestions,
          competitiveAnalysis: analysis.competitiveAnalysis,
          transcript: analysis.transcript,
          tokensUsed: analysis.tokensUsed,
        },
      });
    } catch (analysisError) {
      console.error("[E4] Full pitch analysis failed:", analysisError);
      
      // Update session status to failed
      await db.fullPitchSession.update({
        where: { id: session.id },
        data: { status: 'FAILED' },
      });
      
      // Update video status if exists
      if (videoRecord) {
        await db.pitchVideo.update({
          where: { id: videoRecord.id },
          data: { status: 'FAILED' },
        });
      }
      
      return NextResponse.json(
        { 
          error: "Full pitch analysis failed", 
          message: analysisError instanceof Error ? analysisError.message : "Unknown error",
          sessionId: session.id,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Full session analysis error:", error);
    return NextResponse.json(
      { error: "Failed to analyze full session", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // SECURITY: Get authenticated user from session
    const { userId: clerkId } = await auth();

    if (!clerkId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get internal user ID from database
    const user = await db.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("id");

    if (sessionId) {
      // Get specific session
      const session = await db.fullPitchSession.findFirst({
        where: { id: sessionId, userId: user.id },
        include: {
          pitchDeck: {
            select: {
              id: true,
              fileName: true,
              overallScore: true,
              createdAt: true,
            },
          },
        },
      });

      if (!session) {
        return NextResponse.json(
          { error: "Session not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: session,
      });
    }

    // Get all sessions
    const sessions = await db.fullPitchSession.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        pitchDeck: {
          select: {
            id: true,
            fileName: true,
            overallScore: true,
          },
        },
      },
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
