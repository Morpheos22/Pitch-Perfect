// Database Operations for PitchCoach AI
// Handles all Prisma queries for sessions, users, and usage tracking

import { prisma } from './db';
import { auth } from '@clerk/nextjs/server';
import type { AnalysisStatus, InvestorReadinessLevel, PlanType } from '@prisma/client';

export async function getOrCreateUser() {
  const { userId } = await auth();
  if (!userId) {
    throw new Error('Unauthorized');
  }

  // Get user from database by clerkId
  let user = await prisma.user.findUnique({
    where: { clerkId: userId },
    include: {
      subscription: true,
      usage: true,
    },
  });

  // If user doesn't exist, we need to create them
  // This should normally be handled by the /api/user/sync webhook
  if (!user) {
    throw new Error('User not found in database. Please sync user first.');
  }

  return user;
}

export async function getUserByClerkId(clerkId: string) {
  return prisma.user.findUnique({
    where: { clerkId },
    include: {
      subscription: true,
      usage: true,
    },
  });
}

export async function createUser(data: {
  clerkId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
}) {
  return prisma.user.create({
    data: {
      clerkId: data.clerkId,
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      avatarUrl: data.avatarUrl,
      subscription: {
        create: {
          plan: 'FREE',
          status: 'ACTIVE',
        },
      },
      usage: {
        create: {},
      },
    },
    include: {
      subscription: true,
      usage: true,
    },
  });
}

// ============================================
// USAGE TRACKING
// ============================================

export type ModuleType = 'e1' | 'e2' | 'e3' | 'e4';

const MODULE_FIELD_MAP: Record<ModuleType, string> = {
  e1: 'e1DeckAnalyses',
  e2: 'e2ScriptCoachSessions',
  e3: 'e3LivePitchSessions',
  e4: 'e4FullPitchSessions',
};

// Plan limits
const PLAN_LIMITS: Record<PlanType, Record<ModuleType, number>> = {
  FREE: { e1: 1, e2: 1, e3: 0, e4: 0 },
  STARTER: { e1: 5, e2: 10, e3: 2, e4: 0 },
  PROFESSIONAL: { e1: 20, e2: 50, e3: 10, e4: 2 },
  ENTERPRISE: { e1: 999, e2: 999, e3: 30, e4: 10 },
};

export async function checkUsageLimit(userId: string, module: ModuleType): Promise<{
  allowed: boolean;
  current: number;
  limit: number;
  remaining: number;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { subscription: true, usage: true },
  });

  if (!user || !user.usage || !user.subscription) {
    throw new Error('User not found or missing subscription/usage data');
  }

  const field = MODULE_FIELD_MAP[module];
  const current = user.usage[field] as number;
  const limit = PLAN_LIMITS[user.subscription.plan][module];

  return {
    allowed: current < limit,
    current,
    limit,
    remaining: Math.max(0, limit - current),
  };
}

export async function incrementUsage(userId: string, module: ModuleType, tokensUsed: number) {
  const field = MODULE_FIELD_MAP[module];
  
  // Update usage count
  await prisma.usage.update({
    where: { userId },
    data: {
      [field]: { increment: 1 },
      claudeTokensUsed: { increment: tokensUsed },
      updatedAt: new Date(),
    },
  });
}

// ============================================
// PITCH DECK OPERATIONS (E1)
// ============================================

export async function createPitchDeck(data: {
  userId: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  fileType: string;
  slideCount?: number;
}) {
  return prisma.pitchDeck.create({
    data: {
      userId: data.userId,
      fileName: data.fileName,
      fileUrl: data.fileUrl,
      fileSize: data.fileSize,
      fileType: data.fileType,
      slideCount: data.slideCount,
      status: 'PENDING',
    },
  });
}

export async function updatePitchDeckAnalysis(
  deckId: string,
  analysis: {
    // Content scores
    problemClarityScore: number;
    solutionClarityScore: number;
    marketOpportunityScore: number;
    businessModelScore: number;
    teamCredibilityScore: number;
    tractionScore: number;
    financialsScore: number;
    askClarityScore: number;
    overallScore: number;
    // Visual scores
    designConsistencyScore: number;
    readabilityScore: number;
    visualHierarchyScore: number;
    colorSchemeScore: number;
    typographyScore: number;
    // Feedback
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
    rawAnalysis?: object;
  }
) {
  return prisma.pitchDeck.update({
    where: { id: deckId },
    data: {
      ...analysis,
      status: 'COMPLETED' as AnalysisStatus,
      analyzedAt: new Date(),
    },
  });
}

export async function getPitchDeck(deckId: string, userId: string) {
  return prisma.pitchDeck.findFirst({
    where: { id: deckId, userId },
  });
}

export async function getPitchDeckHistory(userId: string, limit = 10) {
  return prisma.pitchDeck.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

// ============================================
// PITCH SCRIPT OPERATIONS (E2)
// ============================================

export async function createPitchScript(data: {
  userId: string;
  inputType: 'TEXT' | 'PDF' | 'DOCX';
  inputText?: string;
  inputFileUrl?: string;
  fileName?: string;
  targetAudience?: string;
  pitchDuration?: number;
}) {
  return prisma.pitchScript.create({
    data: {
      userId: data.userId,
      inputType: data.inputType,
      inputText: data.inputText,
      inputFileUrl: data.inputFileUrl,
      fileName: data.fileName,
      targetAudience: data.targetAudience,
      pitchDuration: data.pitchDuration,
      status: 'PENDING',
    },
  });
}

export async function updatePitchScriptAnalysis(
  scriptId: string,
  analysis: {
    hookScore: number;
    problemScore: number;
    solutionScore: number;
    credibilityScore: number;
    ctaScore: number;
    overallScore: number;
    wordCount: number;
    estimatedDuration: number;
    improvements: object;
    rewrittenScript: string;
    alternativeHooks: string[];
  }
) {
  return prisma.pitchScript.update({
    where: { id: scriptId },
    data: {
      ...analysis,
      status: 'COMPLETED' as AnalysisStatus,
      analyzedAt: new Date(),
    },
  });
}

export async function getPitchScript(scriptId: string, userId: string) {
  return prisma.pitchScript.findFirst({
    where: { id: scriptId, userId },
  });
}

export async function getPitchScriptHistory(userId: string, limit = 10) {
  return prisma.pitchScript.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

// ============================================
// PITCH VIDEO OPERATIONS (E3)
// ============================================

export async function createPitchVideo(data: {
  userId: string;
  videoUrl: string;
  videoId: string;
  thumbnailUrl?: string;
  duration: number;
  fileSize?: number;
}) {
  return prisma.pitchVideo.create({
    data: {
      userId: data.userId,
      videoUrl: data.videoUrl,
      videoId: data.videoId,
      thumbnailUrl: data.thumbnailUrl,
      duration: data.duration,
      fileSize: data.fileSize,
      status: 'PENDING',
    },
  });
}

export async function updatePitchVideoAnalysis(
  videoId: string,
  analysis: {
    // Delivery scores
    paceScore: number;
    clarityScore: number;
    fillerWordScore: number;
    energyScore: number;
    confidenceScore: number;
    overallDeliveryScore: number;
    // Body language scores
    eyeContactScore: number;
    facialExpressionScore: number;
    gestureScore: number;
    postureScore: number;
    overallBodyLanguageScore: number;
    // Metrics
    wordsPerMinute: number;
    fillerWordCount: number;
    fillerWords: object;
    // Feedback
    deliveryFeedback: string;
    bodyLanguageFeedback: string;
    keyMoments: object;
    transcript: string;
  }
) {
  return prisma.pitchVideo.update({
    where: { id: videoId },
    data: {
      ...analysis,
      status: 'COMPLETED' as AnalysisStatus,
      analyzedAt: new Date(),
    },
  });
}

export async function getPitchVideo(videoId: string, userId: string) {
  return prisma.pitchVideo.findFirst({
    where: { id: videoId, userId },
  });
}

// ============================================
// FULL PITCH SESSION OPERATIONS (E4)
// ============================================

export async function createFullPitchSession(data: {
  userId: string;
  videoUrl: string;
  videoId: string;
  thumbnailUrl?: string;
  duration: number;
  fileSize?: number;
  pitchDeckId?: string;
}) {
  return prisma.fullPitchSession.create({
    data: {
      userId: data.userId,
      videoUrl: data.videoUrl,
      videoId: data.videoId,
      thumbnailUrl: data.thumbnailUrl,
      duration: data.duration,
      fileSize: data.fileSize,
      pitchDeckId: data.pitchDeckId,
      status: 'PENDING',
    },
  });
}

export async function updateFullPitchSessionAnalysis(
  sessionId: string,
  analysis: {
    // 6-dimension scores
    problemSolutionFit: number;
    marketOpportunity: number;
    businessModelViability: number;
    teamCredibility: number;
    tractionMilestones: number;
    deliveryPresence: number;
    overallReadinessScore: number;
    investorReadinessLevel: 'NOT_READY' | 'NEEDS_WORK' | 'INVESTOR_READY' | 'HIGHLY_PREPARED';
    // Detailed scores
    contentScores: object;
    deliveryScores: object;
    // Feedback
    strengths: string[];
    weaknesses: string[];
    investorConcerns: string[];
    recommendedActions: string[];
    // Q&A
    anticipatedQuestions: object;
    // Competitive
    competitiveAnalysis: object;
    // Transcript
    transcript: string;
  }
) {
  return prisma.fullPitchSession.update({
    where: { id: sessionId },
    data: {
      ...analysis,
      status: 'COMPLETED' as AnalysisStatus,
      analyzedAt: new Date(),
    },
  });
}

export async function getFullPitchSession(sessionId: string, userId: string) {
  return prisma.fullPitchSession.findFirst({
    where: { id: sessionId, userId },
    include: { pitchDeck: true },
  });
}

// ============================================
// COMPARISON OPERATIONS
// ============================================

export async function getSessionsForComparison(
  userId: string,
  type: 'deck' | 'script',
  id1: string,
  id2: string
) {
  if (type === 'deck') {
    const [deck1, deck2] = await Promise.all([
      getPitchDeck(id1, userId),
      getPitchDeck(id2, userId),
    ]);
    return { session1: deck1, session2: deck2 };
  } else {
    const [script1, script2] = await Promise.all([
      getPitchScript(id1, userId),
      getPitchScript(id2, userId),
    ]);
    return { session1: script1, session2: script2 };
  }
}
