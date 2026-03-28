import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { analyzePitchVideo, VideoAnalysisResult } from "@/lib/ai-service";

// E3: Live Elevator Pitch Coach API
// Analyzes video recordings for delivery and body language using REAL AI

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
    const durationStr = formData.get("duration") as string;
    const videoId = formData.get("videoId") as string;
    
    // Parse duration (default to 60 seconds if not provided)
    const duration = durationStr ? parseInt(durationStr, 10) : 60;

    // Must have either video URL or file
    if (!videoUrl && !videoFile) {
      return NextResponse.json(
        { error: "Video URL or video file required" },
        { status: 400 }
      );
    }

    // Validate video URL if provided
    let analysisVideoUrl = videoUrl;
    
    if (videoFile && !videoUrl) {
      return NextResponse.json(
        { 
          error: "Video file upload requires storage configuration",
          message: "Please provide a video URL instead, or configure video storage (Cloudflare Stream/R2/S3).",
          details: "Direct video file analysis requires the video to be accessible via URL."
        },
        { status: 400 }
      );
    }

    // Validate duration
    if (duration < 10) {
      return NextResponse.json(
        { error: "Video too short. Minimum duration is 10 seconds." },
        { status: 400 }
      );
    }

    if (duration > 180) {
      return NextResponse.json(
        { 
          error: "Video too long for elevator pitch analysis",
          message: "This video exceeds 3 minutes. Please use the Full Pitch Session analysis for longer presentations.",
          duration: duration,
          suggestedEndpoint: "/api/coach/full"
        },
        { status: 400 }
      );
    }

    // Run REAL AI video analysis
    let analysis: VideoAnalysisResult;
    try {
      analysis = await analyzePitchVideo(analysisVideoUrl!, duration);
    } catch (aiError) {
      console.error("AI video analysis failed:", aiError);
      const errorMessage = aiError instanceof Error ? aiError.message : "Unknown AI error";
      return NextResponse.json(
        { 
          error: "AI video analysis failed", 
          message: errorMessage,
          details: "The AI service encountered an error analyzing your video. Ensure the video URL is publicly accessible."
        },
        { status: 500 }
      );
    }

    // Store analysis in database - videoId is required in schema
    const savedVideo = await prisma.pitchVideo.create({
      data: {
        userId: user.id,
        videoUrl: analysisVideoUrl || "",
        videoId: videoId || `local-${Date.now()}`, // Generate ID if not provided
        duration: duration,
        status: "COMPLETED",
        paceScore: analysis.paceScore,
        clarityScore: analysis.clarityScore,
        fillerWordScore: analysis.fillerWordScore,
        energyScore: analysis.energyScore,
        confidenceScore: analysis.confidenceScore,
        overallDeliveryScore: analysis.overallDeliveryScore,
        eyeContactScore: analysis.eyeContactScore,
        facialExpressionScore: analysis.facialExpressionScore,
        gestureScore: analysis.gestureScore,
        postureScore: analysis.postureScore,
        overallBodyLanguageScore: analysis.overallBodyLanguageScore,
        wordsPerMinute: analysis.wordsPerMinute,
        fillerWordCount: analysis.fillerWordCount,
        fillerWords: analysis.fillerWords,
        deliveryFeedback: analysis.deliveryFeedback,
        bodyLanguageFeedback: analysis.bodyLanguageFeedback,
        keyMoments: analysis.keyMoments,
        transcript: analysis.transcript,
        analyzedAt: new Date(),
      },
    });

    // Return real result
    return NextResponse.json({
      success: true,
      data: {
        overallDeliveryScore: analysis.overallDeliveryScore,
        overallBodyLanguageScore: analysis.overallBodyLanguageScore,
        paceScore: analysis.paceScore,
        clarityScore: analysis.clarityScore,
        fillerWordScore: analysis.fillerWordScore,
        energyScore: analysis.energyScore,
        confidenceScore: analysis.confidenceScore,
        eyeContactScore: analysis.eyeContactScore,
        facialExpressionScore: analysis.facialExpressionScore,
        gestureScore: analysis.gestureScore,
        postureScore: analysis.postureScore,
        wordsPerMinute: analysis.wordsPerMinute,
        fillerWordCount: analysis.fillerWordCount,
        fillerWords: analysis.fillerWords,
        deliveryFeedback: analysis.deliveryFeedback,
        bodyLanguageFeedback: analysis.bodyLanguageFeedback,
        keyMoments: analysis.keyMoments,
        transcript: analysis.transcript,
        tokensUsed: analysis.tokensUsed,
      },
      id: savedVideo.id,
      modelUsed: analysis.modelUsed,
    });
  } catch (error) {
    console.error("Live pitch analysis error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to analyze video", message: errorMessage },
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

    const videos = await prisma.pitchVideo.findMany({
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
