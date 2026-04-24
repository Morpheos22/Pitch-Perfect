// POST /api/kal/chat
// Kal Protocol 2.0 — Contextual Chat API
//
// Handles the chatbot interaction when the script check module
// fails or times out. The Z.ai API is called when the user
// enters the module (Kal active but resting). When the user
// interacts with the chatbot (submits an answer), Kal "wakes up"
// and processes the answer through the critical thinking framework.
//
// FLOW:
//   1. User enters Script Check → Z.ai API pre-warmed (Kal resting)
//   2. User clicks Submit → Feedback loop engaged
//   3. If FAILURE → Kal V2 activates → Redirect to chatbot scenario
//   4. User answers questions → This endpoint processes answers
//   5. After 10 answers → Summary + quick feedback + final decision
//
// ENDPOINTS:
//   POST /api/kal/chat          — Start a new Kal V2 session
//   PATCH /api/kal/chat         — Submit an answer to current question
//   GET /api/kal/chat?id=...    — Get session status + next question

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/with-auth';
import { withRateLimit } from '@/lib/rate-limit';
import { prisma } from '@/lib/db';
import {
  activateKalV2,
  processKalV2Answer,
  getNextUnansweredQuestion,
  countAnsweredQuestions,
  KAL_QUESTIONS,
} from '@/lib/kal-protocol-v2';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ============================================
// SCHEMAS
// ============================================

const startSchema = z.object({
  scriptSessionId: z.string().min(1),
  module: z.enum(['e1', 'e2', 'e3', 'e4', 'e5']),
  error: z.string().optional(),
  inputPayload: z.string().min(1),
});

const answerSchema = z.object({
  chatSessionId: z.string().min(1),
  answer: z.string().min(1).max(5000),
  questionIndex: z.number().int().min(1).max(10),
});

// ============================================
// POST — Start a new Kal V2 session
// ============================================

async function handlePost(request: NextRequest) {
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;

  const body = await request.json();
  const parsed = startSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { scriptSessionId, module, error, inputPayload } = parsed.data;

  // Check if there's already an active Kal V2 session for this script
  const existing = await prisma.kalChatSession.findFirst({
    where: {
      userId: user.id,
      scriptSessionId,
      status: 'ACTIVE',
    },
  });

  if (existing) {
    const messages = existing.messages as Array<{ questionIndex: number; question: string; answer?: string }>;
    const nextQ = messages.find((m) => !m.answer);
    const answered = messages.filter((m) => m.answer).length;

    return NextResponse.json({
      chatSessionId: existing.id,
      nextQuestion: nextQ?.question || null,
      questionsAnswered: answered,
      questionsRemaining: KAL_QUESTIONS.length - answered,
      isComplete: answered >= KAL_QUESTIONS.length,
      summary: existing.summary,
      quickFeedback: existing.quickFeedback,
      message: 'Resuming your Kal session. Continue where you left off.',
    });
  }

  // Activate new Kal V2 session
  const result = await activateKalV2({
    userId: user.id,
    scriptSessionId,
    module,
    error: error || 'Script analysis failed or timed out',
    inputPayload,
    userEmail: (user as any).email || '',
    userName: (user as any).firstName || undefined,
  });

  return NextResponse.json({
    chatSessionId: result.chatSessionId,
    firstQuestion: result.firstQuestion,
    questionsAnswered: 0,
    questionsRemaining: KAL_QUESTIONS.length,
    isComplete: false,
    status: result.status,
    message: result.message,
  });
}

// ============================================
// PATCH — Submit an answer to current question
// ============================================

async function handlePatch(request: NextRequest) {
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;

  const body = await request.json();
  const parsed = answerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { chatSessionId, answer, questionIndex } = parsed.data;

  try {
    const result = await processKalV2Answer({
      chatSessionId,
      answer,
      questionIndex,
      userId: user.id,
    });

    return NextResponse.json({
      ...result,
      message: result.isComplete
        ? 'All questions answered. Generating your summary...'
        : result.nextQuestion
          ? result.nextQuestion
          : 'No more questions. Generating your summary...',
    });
  } catch (error: any) {
    console.error('[KalV2] Answer processing failed:', error?.message);
    return NextResponse.json(
      { error: error?.message || 'Failed to process answer' },
      { status: 500 }
    );
  }
}

// ============================================
// GET — Get session status + next question
// ============================================

async function handleGet(request: NextRequest) {
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('id');

  if (!sessionId) {
    return NextResponse.json(
      { error: 'Session ID is required' },
      { status: 400 }
    );
  }

  const session = await prisma.kalChatSession.findFirst({
    where: { id: sessionId, userId: user.id },
  });

  if (!session) {
    return NextResponse.json(
      { error: 'Session not found' },
      { status: 404 }
    );
  }

  const messages = session.messages as Array<{ questionIndex: number; question: string; answer?: string }>;
  const answered = countAnsweredQuestions(messages as any);
  const nextQ = getNextUnansweredQuestion(messages as any);

  // Check if the original script analysis has completed
  let scriptStatus: string | null = null;
  if (session.module === 'e2') {
    const script = await prisma.pitchScript.findUnique({
      where: { id: session.scriptSessionId },
      select: { status: true },
    });
    scriptStatus = script?.status || null;
  }

  return NextResponse.json({
    id: session.id,
    status: session.status,
    module: session.module,
    questionsAnswered: answered,
    questionsRemaining: KAL_QUESTIONS.length - answered,
    nextQuestion: nextQ?.question || null,
    isComplete: answered >= KAL_QUESTIONS.length,
    summary: session.summary,
    quickFeedback: session.quickFeedback,
    finalDecision: session.finalDecision,
    scriptAnalysisStatus: scriptStatus,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  });
}

// ============================================
// EXPORT WITH RATE LIMITING
// ============================================

export const POST = withRateLimit(handlePost, {
  limit: 5,
  windowMs: 60_000,
  identifierType: 'both',
  name: 'Kal V2 Start',
});

export const PATCH = withRateLimit(handlePatch, {
  limit: 30,
  windowMs: 60_000,
  identifierType: 'both',
  name: 'Kal V2 Answer',
});

export const GET = handleGet;
