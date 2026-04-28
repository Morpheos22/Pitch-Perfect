// API Route: Video Upload for E3 (Live Pitch) and E4 (Full Pitch)
// Storage: Vercel Blob (primary) → Zoho WorkDrive (secondary) → 503 error
// Client-side upload via @vercel/blob/client is preferred; this is the server fallback.


import { NextRequest, NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';
import { videoNotesSchema } from '@/lib/validation/schemas';
import {
  uploadFile,
  getWorkDriveFileUrl,
} from '@/lib/storage';
import {
  validateFileTypeByCategory,
  validateFileSizeByCategory,
} from '@/lib/file-validation';
import { requireModuleAccess } from '@/lib/entitlement';
import { requireAuth } from '@/lib/with-auth';
import { isBlobUrl } from '@/lib/blob-signature';
export const dynamic = 'force-dynamic';

export const maxDuration = 120;


// SSRF protection: check if a URL resolves to a private/reserved IP range
function isPrivateUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return true; // Only allow https
    const hostname = parsed.hostname;
    // Block localhost and common private patterns
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') return true;
    // Block private IP ranges via regex (simple check on hostname)
    const privatePatterns = [
      /^10\./,
      /^172\.(1[6-9]|2\d|3[0-1])\./,
      /^192\.168\./,
      /^169\.254\./,
      /^127\./,
      /^0\./,
    ];
    return privatePatterns.some(p => p.test(hostname));
  } catch {
    return true; // Invalid URLs are rejected
  }
}


// POST: Upload video to WorkDrive
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;


    // ── Entitlement check ──
    const searchParams = new URL(request.url).searchParams;
    const typeParam = searchParams.get('type') || 'video';
    const entModule = typeParam === 'audio' ? 'e3' : 'e4';
    const entitlement = await requireModuleAccess(user.id, entModule as any);
    if (!entitlement.allowed) {
      return NextResponse.json({ error: entitlement.reason }, { status: 403 });
    }


    const formData = await request.formData();
    const videoFile = formData.get('video') as File | null;
    const type = (formData.get('type') as string) || 'live';


    if (!videoFile) {
      return NextResponse.json(
        { error: 'Video file is required' },
        { status: 400 }
      );
    }


    // Validate file type
    const typeValidation = validateFileTypeByCategory(videoFile.name, videoFile.type, 'video');
    if (!typeValidation.valid) {
      return NextResponse.json(
        { error: typeValidation.error },
        { status: 400 }
      );
    }


    // Validate file size
    const sizeValidation = validateFileSizeByCategory(videoFile.size, 'video');
    if (!sizeValidation.valid) {
      return NextResponse.json(
        { error: sizeValidation.error },
        { status: 400 }
      );
    }


    // Determine video type for storage path
    const videoType = type === 'full' ? 'full' : 'live';

    // Upload via centralized storage chain (Blob → WorkDrive → mock)
    // This fixes the previous bug where generateFileKey() was called twice
    // producing different keys, and ensures mock fallback works in dev.
    let uploadResult;
    try {
      uploadResult = await uploadFile(videoFile, user.id, 'video', videoFile.name, videoFile.type);
    } catch (uploadErr: unknown) {
      console.error('[Video] Upload failed:', uploadErr);
      const msg = uploadErr instanceof Error ? uploadErr.message : String(uploadErr);
      return NextResponse.json(
        { error: msg || 'Video storage upload failed' },
        { status: 503 }
      );
    }

    // Create a pending video record in database
    const video = await db.pitchVideo.create({
      data: {
        userId: user.id,
        fileName: videoFile.name,
        videoUrl: uploadResult.url,
        videoId: `video-${Date.now()}`,
        r2Key: uploadResult.key,
        duration: 0, // Will be updated after upload confirmation
        status: 'PENDING',
        type: videoType.toUpperCase(),
      },
    });


    return NextResponse.json({
      videoId: video.id,
      fileId: uploadResult.fileId,
      key: uploadResult.key,
      downloadUrl: uploadResult.url,
      fileName: videoFile.name,
    });
  } catch (error) {
    console.error('Video upload error:', error);
    return NextResponse.json(
      { error: 'An error occurred. Please try again.' },
      { status: 500 }
    );
  }
}


// GET: Get download URL for a video
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;


    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get('videoId');
    const fileId = searchParams.get('fileId');


    if (!videoId && !fileId) {
      return NextResponse.json(
        { error: 'videoId or fileId is required' },
        { status: 400 }
      );
    }


    // If fileId provided, verify user owns the file before returning URL
    if (fileId) {
      const video = await db.pitchVideo.findFirst({
        where: {
          userId: user.id,
          OR: [
            // NOTE: Weak query — `contains` on videoUrl may match partial fileId substrings.
            // Consider storing fileId in a dedicated column for exact matching.
            { videoUrl: { contains: fileId } },
            { r2Key: fileId },
          ],
        },
        select: { videoUrl: true },
      });
      if (!video) {
        return NextResponse.json(
          { error: 'Video not found' },
          { status: 404 }
        );
      }
      // For Vercel Blob uploads, generate a proxy URL (private access).
      // For WorkDrive files, generate the WorkDrive download URL.
      // CRITICAL: Vercel Blob URLs use subdomain format (e.g. mystore.blob.vercel-storage.com)
      let downloadUrl: string;
      const isBlobVideo = isBlobUrl(video.videoUrl || '');


      if (video.videoUrl && (isBlobVideo || !video.videoUrl.includes('workdrive.zoho.com'))) {
        // Generate proxy URL for private blob access
        try {
          const { generateBlobDownloadUrl } = await import('@/lib/blob-signature');
          downloadUrl = generateBlobDownloadUrl(video.videoUrl);
        } catch {
          downloadUrl = video.videoUrl; // Fallback to raw URL if signing fails
        }
      } else {
        downloadUrl = getWorkDriveFileUrl(fileId);
      }
      // SSRF protection on the resolved URL
      if (isPrivateUrl(downloadUrl)) {
        return NextResponse.json(
          { error: 'Invalid video URL' },
          { status: 400 }
        );
      }
      return NextResponse.json({ downloadUrl });
    }


    // If videoId provided, look up the file from database
    if (videoId) {
      const video = await db.pitchVideo.findFirst({
        where: { id: videoId, userId: user.id },
        select: { videoUrl: true },
      });


      if (!video) {
        return NextResponse.json(
          { error: 'Video not found' },
          { status: 404 }
        );
      }


      // SSRF protection on the resolved URL
      if (isPrivateUrl(video.videoUrl)) {
        return NextResponse.json(
          { error: 'Invalid video URL' },
          { status: 400 }
        );
      }


      // Generate proxy URL for private blob access
      let downloadUrl: string;
      try {
        const { generateBlobDownloadUrl } = await import('@/lib/blob-signature');
        downloadUrl = generateBlobDownloadUrl(video.videoUrl);
      } catch {
        downloadUrl = video.videoUrl;
      }


      return NextResponse.json({
        downloadUrl,
      });
    }


    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Video download URL generation error:', error);
    return NextResponse.json(
      { error: 'Failed to get download URL' },
      { status: 500 }
    );
  }
}


// PATCH: Confirm upload completion and update video record
export async function PATCH(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;


    const body = await request.json();
    const parsed = videoNotesSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const validatedData = parsed.data;
    const videoId = validatedData.id;
    const duration = (body as Record<string, unknown>).duration as number | undefined;


    if (!videoId) {
      return NextResponse.json(
        { error: 'videoId is required' },
        { status: 400 }
      );
    }


    // Update video record
    const video = await db.pitchVideo.updateMany({
      where: { id: videoId, userId: user.id },
      data: {
        duration: duration || 0,
        status: 'PENDING',
      },
    });


    if (video.count === 0) {
      return NextResponse.json(
        { error: 'Video not found or not owned by user' },
        { status: 404 }
      );
    }


    return NextResponse.json({
      success: true,
      videoId,
      status: 'PENDING',
    });
  } catch (error) {
    console.error('Video confirmation error:', error);
    return NextResponse.json(
      { error: 'Failed to confirm upload' },
      { status: 500 }
    );
  }
}
