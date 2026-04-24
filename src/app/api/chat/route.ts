// PitchCoach Chatbot API Route
// POST /api/chat — Handles chatbot conversations via Z.ai
//
// Architecture: Browser → /api/chat → Z.ai SDK (glm-4-flash) → Response
// Auth: Required (Clerk). Guest preview: 3 messages via client-side enforcement.
// Rate limit: 10 messages/minute per user.

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/with-auth';
import { withRateLimit } from '@/lib/rate-limit';
import { prisma } from '@/lib/db';
import { executeWithFallback, MODULE_MODEL_MAP, AI_MODELS } from '@/lib/ai-service';
import { CHATBOT_CONFIG } from '@/lib/chatbot-config';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const chatInputSchema = z.object({
  message: z.string().min(1).max(2000),
  conversationId: z.string().optional(),
});

async function handlePost(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const body = await request.json();
    const parsed = chatInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { message, conversationId } = parsed.data;

    // Generate or reuse conversation ID
    const convId = conversationId || `chat-${user.id}-${Date.now()}`;

    // Retrieve recent conversation history (last 20 messages for context window)
    const history = await prisma.chatMessage.findMany({
      where: {
        userId: user.id,
        conversationId: convId,
      },
      orderBy: { createdAt: 'asc' },
      take: 20,
    });

    // Check conversation length limit
    if (history.length >= CHATBOT_CONFIG.maxConversationLength) {
      return NextResponse.json({
        response: "This conversation has reached its maximum length. Let's start a fresh conversation for better results.",
        conversationId: `chat-${user.id}-${Date.now()}`,
        newConversation: true,
      });
    }

    // Build messages array for Z.ai
    const messages: Array<{ role: string; content: string }> = [
      { role: 'system', content: CHATBOT_CONFIG.systemPrompt },
      ...history.map((msg) => ({
        role: msg.role === 'USER' ? 'user' : 'assistant',
        content: msg.content,
      })),
      { role: 'user', content: message },
    ];

    // Save user message to database
    await prisma.chatMessage.create({
      data: {
        userId: user.id,
        conversationId: convId,
        role: 'USER',
        content: message,
      },
    });

    // Call Z.ai via the existing fallback chain
    const { response } = await executeWithFallback('CHATBOT' as any, (model) => ({
      model: CHATBOT_CONFIG.model,
      messages,
      temperature: CHATBOT_CONFIG.temperature,
      max_tokens: CHATBOT_CONFIG.maxTokens,
    }));

    const assistantContent = response.choices?.[0]?.message?.content;
    if (!assistantContent) {
      return NextResponse.json(
        { error: 'No response from AI. Please try again.' },
        { status: 503 }
      );
    }

    // Save assistant message to database
    await prisma.chatMessage.create({
      data: {
        userId: user.id,
        conversationId: convId,
        role: 'ASSISTANT',
        content: assistantContent,
      },
    });

    return NextResponse.json({
      response: assistantContent,
      conversationId: convId,
    });
  } catch (error: any) {
    console.error('[Chat] Error:', error?.message);
    return NextResponse.json(
      { error: 'Failed to get response. Please try again.' },
      { status: 500 }
    );
  }
}

export const POST = withRateLimit(handlePost, {
  limit: 10,
  windowMs: 60_000,
  identifierType: 'both',
  name: 'Chatbot',
});
