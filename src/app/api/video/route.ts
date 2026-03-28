// API Route: Video Upload for E3 (Live Pitch) and E4 (Full Pitch)
// Handles presigned URL generation for direct client-side uploads to R2
// Bypasses Vercel's 4.5MB body size limit

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma as db } from '@/lib/db';
import {
  generatePresignedUploadUrl,
  generatePresignedDownloadUrl,
  isR2Configured,
  validateFileType,
  validateFileSize
} from '@/lib/storage';

// POST: Generate presigned upload URL for video
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

    // Check if R2 is configured
    if (!isR2Configured()) {
      return NextResponse.json(
        { error: 'Video storage not configured. Please contact support.' },
        { status: 503 }
      );
    }

    // Parse request
    const body = await request.json();
    const { fileName, mimeType, fileSize, type = 'live' } = body;

    // Validate inputs
    if (!fileName || !mimeType || !fileSize) {
      return NextResponse.json(
        { error: 'fileName, mimeType, and fileSize are required' },
        { status: 400 }
      );
    }

    // Validate file type
    const typeValidation = validateFileType(fileName, mimeType, 'video');
    if (!typeValidation.valid) {
      return NextResponse.json(
        { error: typeValidation.error },
        { status: 400 }
      );
    }

    // Validate file size
    const sizeValidation = validateFileSize(fileSize, 'video');
    if (!sizeValidation.valid) {
      return NextResponse.json(
        { error: sizeValidation.error },
        { status: 400 }
      );
    }

    // Determine video type for storage path
    const videoType = type === 'full' ? 'full' : 'live';

    // Generate presigned upload URL
    const { uploadUrl, key, publicUrl } = await generatePresignedUploadUrl(
      user.id,
      'video',
      fileName,
      mimeType,
      7200 // 2 hours for large videos
    );

    // Create a pending video record in database
    const video = await db.pitchVideo.create({
      data: {
        userId: user.id,
        fileName,
        fileUrl: publicUrl,
        r2Key: key,
        duration: 0, // Will be updated after upload
        status: 'PENDING',
        type: videoType.toUpperCase(),
      },
    });

    return NextResponse.json({
      uploadUrl,
      key,
      videoId: video.id,
      publicUrl,
      expiresIn: 7200,
      instructions: {
        method: 'PUT',
        headers: {
          'Content-Type': mimeType,
        },
        body: 'Binary file data',
      },
    });
  } catch (error) {
    console.error('Video upload URL generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate upload URL', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// GET: Get presigned download URL for a video
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
    const key = searchParams.get('key');

    if (!videoId && !key) {
      return NextResponse.json(
        { error: 'videoId or key is required' },
        { status: 400 }
      );
    }

    let r2Key = key;

    // If videoId provided, look up the key from database
    if (videoId) {
      const video = await db.pitchVideo.findFirst({
        where: { id: videoId, userId: user.id },
        select: { r2Key: true },
      });

      if (!video) {
        return NextResponse.json(
          { error: 'Video not found' },
          { status: 404 }
        );
      }

      r2Key = video.r2Key;
    }

    if (!r2Key) {
      return NextResponse.json(
        { error: 'Video key not found' },
        { status: 404 }
      );
    }

    // Generate presigned download URL
    const downloadUrl = await generatePresignedDownloadUrl(r2Key);

    return NextResponse.json({
      downloadUrl,
      expiresIn: 3600,
    });
  } catch (error) {
    console.error('Video download URL generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate download URL' },
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
