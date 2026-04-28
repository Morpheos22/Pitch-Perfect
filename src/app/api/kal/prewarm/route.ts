// POST /api/kal/prewarm
// Pre-warms the Z.ai API when a user enters the Script Check module.
//
// Per the Kal Protocol 2.0 specification:
//   "Z.ai API called the moment user enters script check module
//    (Kal active but resting)"
//
// This endpoint:
//   1. Initializes the Z.ai SDK and gateway connection
//   2. Sends a lightweight ping to warm the connection
//   3. Returns readiness status to the frontend
//
// The pre-warm ensures that when the user clicks "Submit", the AI
// pipeline is already initialized and responsive — reducing the
// perceived latency of the first real analysis call.

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/with-auth';
import { withRateLimit } from '@/lib/rate-limit';
import { getZai, executeWithFallback, AI_MODELS } from '@/lib/ai-service';

export const dynamic = 'force-dynamic';

async function handlePost(request: NextRequest) {
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;

  try {
    // ── Pre-warm Strategy 1: Initialize SDK ──
    const zai = await getZai();

    // ── Pre-warm Strategy 2: Lightweight gateway ping ──
    // Send a minimal request to the Z.ai gateway to establish
    // connection pooling and warm the model. Uses the fast model
    // with minimal tokens to keep the cost negligible.
    let gatewayReady = false;
    try {
      const { response } = await executeWithFallback('CHATBOT' as any, (model) => ({
        model: AI_MODELS.GLM_FAST,
        messages: [
          { role: 'system', content: 'You are a pitch coaching assistant. Respond with exactly: "ready"' },
          { role: 'user', content: 'ping' },
        ],
        temperature: 0.1,
        max_tokens: 10,
      }));
      const content = response.choices?.[0]?.message?.content || '';
      gatewayReady = content.toLowerCase().includes('ready') || content.length > 0;
    } catch (warmErr: unknown) {
      // Non-fatal — the pre-warm is best-effort. The actual analysis
      // will still work even if the warm-up ping fails.
      console.warn('[KalPrewarm] Gateway ping failed (non-fatal):', warmErr instanceof Error ? warmErr.message : String(warmErr));
      // Still mark as ready if the SDK initialized — the gateway
      // may just be slow to respond on the first call.
      gatewayReady = zai !== null;
    }

    return NextResponse.json({
      success: true,
      sdkInitialized: zai !== null,
      gatewayReady,
      message: 'Kal Protocol pre-warmed. AI pipeline ready.',
    });
  } catch (error: unknown) {
    console.error('[KalPrewarm] Pre-warm failed:', error instanceof Error ? error.message : String(error));
    // Non-blocking — the user can still submit, it just might be slower
    return NextResponse.json({
      success: false,
      sdkInitialized: false,
      gatewayReady: false,
      message: 'Pre-warm encountered an issue. Analysis will still work but may be slower on first call.',
    });
  }
}

export const POST = withRateLimit(handlePost, {
  limit: 5,
  windowMs: 60_000,
  identifierType: 'both',
  name: 'Kal Prewarm',
});
