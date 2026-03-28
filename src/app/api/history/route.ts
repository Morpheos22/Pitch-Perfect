// API Route: Get user session history
// GET /api/history

import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateUser } from '@/lib/db-operations';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const user = await getOrCreateUser();
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as 'deck' | 'script' | 'video' | 'full' | null;
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build the response with explicit types
    const response: Record<string, unknown[]> = {};

    // Fetch data based on type
    if (!type || type === 'deck') {
      response.decks = await prisma.pitchDeck.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          fileName: true,
          overallScore: true,
          status: true,
          createdAt: true,
          analyzedAt: true,
        },
      });
    }

    if (!type || type === 'script') {
      response.scripts = await prisma.pitchScript.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          fileName: true,
          overallScore: true,
          status: true,
          createdAt: true,
          analyzedAt: true,
          targetAudience: true,
        },
      });
    }

    if (!type || type === 'video') {
      response.videos = await prisma.pitchVideo.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          thumbnailUrl: true,
          duration: true,
          overallDeliveryScore: true,
          overallBodyLanguageScore: true,
          status: true,
          createdAt: true,
          analyzedAt: true,
        },
      });
    }

    if (!type || type === 'full') {
      response.fullSessions = await prisma.fullPitchSession.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          thumbnailUrl: true,
          duration: true,
          overallReadinessScore: true,
          investorReadinessLevel: true,
          status: true,
          createdAt: true,
          analyzedAt: true,
          pitchDeck: {
            select: {
              id: true,
              fileName: true,
            },
          },
        },
      });
    }

    // Get total counts
    const counts = {
      decks: type && type !== 'deck' ? 0 : await prisma.pitchDeck.count({ where: { userId: user.id } }),
      scripts: type && type !== 'script' ? 0 : await prisma.pitchScript.count({ where: { userId: user.id } }),
      videos: type && type !== 'video' ? 0 : await prisma.pitchVideo.count({ where: { userId: user.id } }),
      fullSessions: type && type !== 'full' ? 0 : await prisma.fullPitchSession.count({ where: { userId: user.id } }),
    };

    return NextResponse.json({
      success: true,
      data: response,
      counts,
      pagination: {
        limit,
        offset,
        hasMore: Object.values(response).some(arr => arr && arr.length === limit),
      },
    });

  } catch (error) {
    console.error('History API error:', error);
    
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch history' },
      { status: 500 }
    );
  }
}
