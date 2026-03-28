import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { analyzePitchVideo } from "@/lib/ai-service";
import { generatePresignedDownloadUrl, isR2Configured } from "@/lib/storage";

// E3: Live Elevator Pitch Coach API
// Analyzes video recordings for delivery and body language
// Uses GLM-4V-Flash for fast video analysis (< 3 min videos)
// SECURITY: Uses auth() to get authenticated user - NEVER trust client input for userId

interface LivePitchAnalysisResult {
  overallDeliveryScore: number;
  overallBodyLanguageScore: number;
  deliveryScores: {
    pace: number;
    clarity: number;
    fillerWords: number;
    energy: number;
    confidence: number;
  };
  bodyLanguageScores: {
    eyeContact: number;
    facialExpression: number;
    gestures: number;
    posture: number;
  };
  metrics: {
    wordsPerMinute: number;
    fillerWordCount: number;
    duration: number;
  };
  fillerWords: Record<string, number>;
  deliveryFeedback: string;
  bodyLanguageFeedback: string;
  keyMoments: Array<{
    time: string;
    type: "positive" | "improvement";
    note: string;
  }>;
  transcript: string;
}

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
    let videoUrl = formData.get("videoUrl") as string;
    const videoId = formData.get("videoId") as string;
    const r2Key = formData.get("r2Key") as string;

    if (!videoUrl && !videoId && !r2Key) {
      return NextResponse.json(
        { error: "Video URL, videoId, or r2Key is required" },
        { status: 400 }
      );
    }

    // If we have a videoId but no URL, get the video from database
    let duration = 0;
    let videoRecord = null;
    
    if (videoId && !videoUrl) {
      videoRecord = await db.pitchVideo.findFirst({
        where: { id: videoId, userId: user.id },
      });
      
      if (!videoRecord) {
        return NextResponse.json(
          { error: "Video not found" },
          { status: 404 }
        );
      }
      
      duration = videoRecord.duration;
      
      // Generate presigned URL for AI to access the video
      if (videoRecord.r2Key && isR2Configured()) {
        videoUrl = await generatePresignedDownloadUrl(videoRecord.r2Key);
      }
    }

    // If we have r2Key but no URL, generate presigned URL
    if (r2Key && !videoUrl && isR2Configured()) {
      videoUrl = await generatePresignedDownloadUrl(r2Key);
    }

    if (!videoUrl) {
      return NextResponse.json(
        { error: "Could not generate video URL for analysis" },
        { status: 500 }
      );
    }

    // Parse duration from formData if not set
    if (!duration) {
      duration = parseInt(formData.get("duration") as string) || 60;
    }

    // Update video status to processing
    if (videoRecord) {
      await db.pitchVideo.update({
        where: { id: videoRecord.id },
        data: { status: "PROCESSING" },
      });
    }

    try {
      // Run AI analysis using GLM-4V-Flash for fast video analysis
      console.log(`[E3] Starting video analysis for ${videoUrl}`);
      const analysis = await analyzePitchVideo(videoUrl, duration);

      // Transform to expected format
      const result: LivePitchAnalysisResult = {
        overallDeliveryScore: analysis.overallDeliveryScore,
        overallBodyLanguageScore: analysis.overallBodyLanguageScore,
        deliveryScores: {
          pace: analysis.paceScore,
          clarity: analysis.clarityScore,
          fillerWords: analysis.fillerWordScore,
          energy: analysis.energyScore,
          confidence: analysis.confidenceScore,
        },
        bodyLanguageScores: {
          eyeContact: analysis.eyeContactScore,
          facialExpression: analysis.facialExpressionScore,
          gestures: analysis.gestureScore,
          posture: analysis.postureScore,
        },
        metrics: {
          wordsPerMinute: analysis.wordsPerMinute,
          fillerWordCount: analysis.fillerWordCount,
          duration: duration,
        },
        fillerWords: analysis.fillerWords,
        deliveryFeedback: analysis.deliveryFeedback,
        bodyLanguageFeedback: analysis.bodyLanguageFeedback,
        keyMoments: analysis.keyMoments.map(km => ({
          time: km.timestamp,
          type: km.type,
          note: km.description,
        })),
        transcript: analysis.transcript,
      };

      // Update video record with results
      if (videoRecord) {
        await db.pitchVideo.update({
          where: { id: videoRecord.id },
          data: {
            status: "COMPLETED",
            transcript: analysis.transcript,
            deliveryScore: analysis.overallDeliveryScore,
            bodyLanguageScore: analysis.overallBodyLanguageScore,
            analysis: result as unknown as object,
          },
        });
      }

      return NextResponse.json({
        success: true,
        data: result,
        tokensUsed: analysis.tokensUsed,
      });
    } catch (analysisError) {
      console.error("[E3] Video analysis failed:", analysisError);
      
      // Update video status to failed
      if (videoRecord) {
        await db.pitchVideo.update({
          where: { id: videoRecord.id },
          data: { status: "FAILED" },
        });
      }
      
      return NextResponse.json(
        { 
          error: "Video analysis failed", 
          message: analysisError instanceof Error ? analysisError.message : "Unknown error" 
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Live pitch analysis error:", error);
    return NextResponse.json(
      { error: "Failed to analyze video", message: error instanceof Error ? error.message : "Unknown error" },
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

    // Fetch user's live pitch analysis history
    const videos = await db.pitchVideo.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json({
      success: true,
      data: videos,
    });
  } catch (error) {
    console.error("Get video history error:", error);
    return NextResponse.json(
      { error: "Failed to get video history" },
      { status: 500 }
    );
  }
}
