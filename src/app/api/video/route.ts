// API Route: Video Upload for E3 (Live Pitch) and E4 (Full Pitch)
// Storage fallback: Zoho WorkDrive → Vercel Blob → 503 error
// Bypasses Vercel's 4.5MB body size limit

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma as db } from '@/lib/db';
import {
  isWorkDriveConfigured,
  uploadToWorkDrive,
  getWorkDriveFileUrl,
  validateFileTypeByCategory,
  validateFileSizeByCategory,
  generateFileKey,
  isVercelBlobConfigured,
} from '@/lib/storage';

// POST: Upload video to WorkDrive
export async function POST(request: NextRequest) {
  try {
    // SECURITY: Get authenticated user from session
    const { userId: clerkId } = await auth();

    if (!clerkId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get internal user ID
    const user = await db.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
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

    const arrayBuffer = await videoFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let downloadUrl: string;
    let fileId: string;

    // ── STRATEGY 1: Zoho WorkDrive ──
    if (isWorkDriveConfigured()) {
      const uploadResult = await uploadToWorkDrive(
        buffer,
        videoFile.name,
        process.env.ZOHO_WORKDRIVE_FOLDER_ID!
      );
      downloadUrl = uploadResult.downloadUrl;
      fileId = uploadResult.fileId;
      console.log(`[Video] Uploaded to WorkDrive: ${fileId}`);
    }
    // ── STRATEGY 2: Vercel Blob (fallback) ──
    else if (isVercelBlobConfigured()) {
      const { put } = await import('@vercel/blob');
      const blob = new Blob([buffer], { type: videoFile.type });
      const blobResult = await put(generateFileKey(user.id, 'video', videoFile.name), blob, {
        access: 'public',
        addRandomSuffix: true,
      });
      downloadUrl = blobResult.url;
      fileId = blobResult.pathname;
      console.log(`[Video] Uploaded to Vercel Blob: ${blobResult.url}`);
    }
    // ── STRATEGY 3: No storage available ──
    else {
      return NextResponse.json(
        { error: 'Video storage not configured. Please contact support.' },
        { status: 503 }
      );
    }

    const key = generateFileKey(user.id, 'video', videoFile.name);

    // Create a pending video record in database
    const video = await db.pitchVideo.create({
      data: {
        userId: user.id,
        fileName: videoFile.name,
        fileUrl: downloadUrl,
        r2Key: key,
        duration: 0, // Will be updated after upload confirmation
        status: 'PENDING',
        type: videoType.toUpperCase(),
      },
    });

    return NextResponse.json({
      videoId: video.id,
      fileId,
      key,
      downloadUrl,
      fileName: videoFile.name,
    });
  } catch (error) {
    console.error('Video upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload video', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// GET: Get download URL for a video
export async function GET(request: NextRequest) {
  try {
    const { userId: clerkId } = await auth();

    if (!clerkId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await db.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

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
            { fileUrl: { contains: fileId } },
            { r2Key: fileId },
          ],
        },
        select: { fileUrl: true },
      });
      if (!video) {
        return NextResponse.json(
          { error: 'Video not found' },
          { status: 404 }
        );
      }
      const downloadUrl = getWorkDriveFileUrl(fileId);
      return NextResponse.json({ downloadUrl });
    }

    // If videoId provided, look up the file from database
    if (videoId) {
      const video = await db.pitchVideo.findFirst({
        where: { id: videoId, userId: user.id },
        select: { fileUrl: true },
      });

      if (!video) {
        return NextResponse.json(
          { error: 'Video not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        downloadUrl: video.fileUrl,
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
    const { userId: clerkId } = await auth();

    if (!clerkId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await db.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { videoId, duration } = body;

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
        status: 'UPLOADED',
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
      status: 'UPLOADED',
    });
  } catch (error) {
    console.error('Video confirmation error:', error);
    return NextResponse.json(
      { error: 'Failed to confirm upload' },
      { status: 500 }
    );
  }
}
