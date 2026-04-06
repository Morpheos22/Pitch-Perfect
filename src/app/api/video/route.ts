// API Route: Video Upload for E3 (Live Pitch) and E4 (Full Pitch)
// Handles video uploads via Zoho WorkDrive storage
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

    // Check if WorkDrive is configured
    if (!isWorkDriveConfigured()) {
      return NextResponse.json(
        { error: 'Video storage not configured. Please contact support.' },
        { status: 503 }
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

    // Upload to WorkDrive
    const arrayBuffer = await videoFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const uploadResult = await uploadToWorkDrive(
      buffer,
      videoFile.name,
      process.env.ZOHO_WORKDRIVE_FOLDER_ID!
    );

    const key = generateFileKey(user.id, 'video', videoFile.name);

    // Create a pending video record in database
    const video = await db.pitchVideo.create({
      data: {
        userId: user.id,
        fileName: videoFile.name,
        fileUrl: uploadResult.downloadUrl,
        r2Key: key,
        duration: 0, // Will be updated after upload confirmation
        status: 'PENDING',
        type: videoType.toUpperCase(),
      },
    });

    return NextResponse.json({
      videoId: video.id,
      fileId: uploadResult.fileId,
      key,
      downloadUrl: uploadResult.downloadUrl,
      fileName: uploadResult.fileName,
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

    // If fileId provided directly, generate download URL
    if (fileId) {
      const downloadUrl = getWorkDriveFileUrl(fileId);
      return NextResponse.json({
        downloadUrl,
      });
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
