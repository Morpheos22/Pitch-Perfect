import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { analyzePitchVideo, VideoAnalysisResult } from "@/lib/ai-service";
import { uploadFile, isStorageConfigured, ALLOWED_VIDEO_HOSTS, isHostAllowed } from "@/lib/storage";
import { requireModuleAccess } from "@/lib/entitlement";
import { liveNotesSchema } from "@/lib/validation/schemas";
import { blobUrlToDataUri } from "@/lib/blob-signature";
import { withRateLimit } from "@/lib/rate-limit";
export const dynamic = 'force-dynamic';

export const maxDuration = 120;


// E3: Live Elevator Pitch Coach API
// Analyzes video recordings for delivery and body language using REAL AI


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
    const entitlement = await requireModuleAccess(user.id, 'e3');
    if (!entitlement.allowed) {
      return NextResponse.json({ error: entitlement.reason }, { status: 403 });
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
        console.error('[E3] Video upload failed:', uploadErr);
        return NextResponse.json(
          { error: 'Video upload failed. Please try again.' },
          { status: 500 }
        );
      }
    }


    // Validate duration (guard against NaN / non-finite values)
    if (!Number.isFinite(duration) || duration < 10) {
      return NextResponse.json(
        { error: "Video too short. Minimum duration is 10 seconds." },
        { status: 400 }
      );
    }


    if (duration > 180) {
      return NextResponse.json(
        { error: "Video too long for elevator pitch analysis" },
        { status: 400 }
      );
    }


    // SSRF prevention: validate video URL host using shared allowlist
    if (analysisVideoUrl) {
      // Disallow mock storage URLs entirely
      if (analysisVideoUrl.startsWith('mock://')) {
        return NextResponse.json({ error: 'Mock storage URLs are not permitted.' }, { status: 400 });
      }

      if (!isHostAllowed(analysisVideoUrl, ALLOWED_VIDEO_HOSTS)) {
        return NextResponse.json(
          { error: 'Invalid video source. Files must be uploaded through the platform.' },
          { status: 400 }
        );
      }
    }


    // Run REAL AI video analysis
    if (!analysisVideoUrl) {
      return NextResponse.json({ error: "Video URL is required for analysis" }, { status: 400 });
    }


    // Private blob URLs need conversion to data URI for AI gateway access
    // Note: Video data URIs can be large, but the AI gateway cannot fetch private blobs
    // CRITICAL: Vercel Blob URLs use subdomain format (e.g. mystore.blob.vercel-storage.com)
    let aiVideoUrl = analysisVideoUrl;
    try {
      const parsedUrl = new URL(analysisVideoUrl);
      const isPrivateBlob = (parsedUrl.hostname.endsWith('.blob.vercel-storage.com') || parsedUrl.hostname === 'blob.vercel-storage.com') &&
        !parsedUrl.hostname.endsWith('.public.blob.vercel-storage.com');
      if (isPrivateBlob) {
        console.warn('[E3] Converting private blob URL to data URI for vision model');
        const dataUri = await blobUrlToDataUri(analysisVideoUrl);
        if (dataUri) {
          aiVideoUrl = dataUri;
        }
      }
    } catch { /* URL parse error, use as-is */ }


    let analysis: VideoAnalysisResult;
    try {
      analysis = await analyzePitchVideo(aiVideoUrl, duration);
    } catch (aiError: any) {
      console.error("AI video analysis failed:", aiError);
      const msg = aiError?.message || String(aiError);
      const isAuthError = msg.includes('401') || msg.includes('X-Token') || msg.includes('unauthorized');
      return NextResponse.json(
        { error: isAuthError ? "AI service authentication error. Please contact support." : "AI analysis failed. Please try again." },
        { status: 503 }
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


    // NOTE: Usage is tracked atomically inside requireModuleAccess() — no separate increment needed


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
    return NextResponse.json(
      { error: "Failed to analyze video" },
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
    const videoId = searchParams.get("id");


    // Single video lookup by ID (for session detail page)
    if (videoId) {
      const video = await prisma.pitchVideo.findFirst({
        where: { id: videoId, userId: user.id },
      });


      if (!video) {
        return NextResponse.json({ error: "Video session not found" }, { status: 404 });
      }


      return NextResponse.json({
        id: video.id,
        status: video.status,
        fileName: video.fileName || undefined,
        type: video.type || undefined,
        duration: video.duration || undefined,
        createdAt: video.createdAt,
        overallDeliveryScore: video.overallDeliveryScore,
        overallBodyLanguageScore: video.overallBodyLanguageScore,
        paceScore: video.paceScore,
        clarityScore: video.clarityScore,
        fillerWordScore: video.fillerWordScore,
        energyScore: video.energyScore,
        confidenceScore: video.confidenceScore,
        eyeContactScore: video.eyeContactScore,
        facialExpressionScore: video.facialExpressionScore,
        gestureScore: video.gestureScore,
        postureScore: video.postureScore,
        wordsPerMinute: video.wordsPerMinute,
        fillerWordCount: video.fillerWordCount,
        fillerWords: video.fillerWords,
        deliveryFeedback: video.deliveryFeedback,
        bodyLanguageFeedback: video.bodyLanguageFeedback,
        keyMoments: video.keyMoments,
        transcript: video.transcript,
        notes: video.notes || undefined,
      });
    }


    // List all videos (for history page)
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


// PATCH: Update notes on a video session (auto-save from session detail page)
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
    const parsed = liveNotesSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const validatedData = parsed.data;


    if (!validatedData.id) {
      return NextResponse.json(
        { error: "Session id is required" },
        { status: 400 }
      );
    }


    // Only allow updating the notes field — other fields are immutable after analysis
    const result = await prisma.pitchVideo.updateMany({
      where: { id: validatedData.id, userId: user.id },
      data: {
        ...(validatedData.notes !== undefined ? { notes: String(validatedData.notes).slice(0, 1000) } : {}),
      },
    });


    if (result.count === 0) {
      return NextResponse.json(
        { error: "Session not found or not owned by user" },
        { status: 404 }
      );
    }


    return NextResponse.json({ success: true, id: validatedData.id });
  } catch (error) {
    console.error("Patch video session error:", error);
    return NextResponse.json(
      { error: "Failed to update session" },
      { status: 500 }
    );
  }
}


// DELETE: Delete a video session (cascade deletes related data via Prisma schema)
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
    const videoId = searchParams.get("id");


    if (!videoId) {
      return NextResponse.json(
        { error: "Session id is required" },
        { status: 400 }
      );
    }


    // Verify ownership before deleting
    const existing = await prisma.pitchVideo.findFirst({
      where: { id: videoId, userId: user.id },
      select: { id: true },
    });


    if (!existing) {
      return NextResponse.json(
        { error: "Session not found or not owned by user" },
        { status: 404 }
      );
    }


    await prisma.pitchVideo.delete({
      where: { id: existing.id },
    });


    return NextResponse.json({ success: true, id: videoId });
  } catch (error) {
    console.error("Delete video session error:", error);
    return NextResponse.json(
      { error: "Failed to delete session" },
      { status: 500 }
    );
  }
}
