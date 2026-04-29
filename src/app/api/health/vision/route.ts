// Vision Model Health Check — dedicated endpoint for Z.ai vision gateway diagnostics.
// Tests the Z.ai SDK vision endpoint (glm-4.6v) with a minimal 1x1 pixel image.
// Separate from /api/health to avoid timeout impact on the main health check
// and to allow targeted debugging of vision issues (E1 visual audit, E3/E4 video analysis).

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 30; // Allow up to 30s for vision model response

interface VisionTestResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  responseTimeMs: number;
  gateway: {
    baseUrl: string;
    modelRequested: string;
    modelResolved?: string;
  };
  result?: {
    content: string;
    tokensUsed?: number;
  };
  error?: string;
}

export async function GET(request: NextRequest) {
  // Require internal auth token (same as main health check)
  const token = request.headers.get('x-health-token');
  if (token !== process.env.HEALTH_CHECK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  const baseUrl = process.env.ZAI_BASE_URL || 'not configured';

  const result: VisionTestResult = {
    status: 'unhealthy',
    timestamp: new Date().toISOString(),
    responseTimeMs: 0,
    gateway: {
      baseUrl,
      modelRequested: 'glm-4.6v',
    },
  };

  // ── Step 1: Test via Z.ai SDK ──────────────────────────────────────
  try {
    const { default: ZAI } = await import('z-ai-web-dev-sdk');
    const zai = await ZAI.create();

    // Minimal 1x1 white PNG pixel as data URI
    const testPixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

    const visionResp = await zai.chat.completions.createVision({
      model: 'glm-4.6v',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'Describe this image in one word.' },
          { type: 'image_url', image_url: { url: testPixel } },
        ],
      } as any],
      temperature: 0.1,
      max_tokens: 10,
    } as any);

    result.gateway.modelResolved = visionResp.model || undefined;
    const content = visionResp.choices?.[0]?.message?.content;

    if (content && content.length > 0) {
      result.status = 'healthy';
      result.result = {
        content: content.slice(0, 100),
        tokensUsed: visionResp.usage?.total_tokens,
      };
    } else {
      result.status = 'degraded';
      result.error = 'Vision endpoint returned empty response';
    }
  } catch (sdkError: unknown) {
    const sdkMsg = sdkError instanceof Error ? sdkError.message : String(sdkError);

    // ── Step 2: SDK failed — try direct HTTP fallback ──────────────
    try {
      const apiKey = process.env.ZAI_API_KEY;
      if (!apiKey) {
        result.status = 'unhealthy';
        result.error = `SDK failed: ${sdkMsg}. HTTP fallback skipped: ZAI_API_KEY not set.`;
        result.responseTimeMs = Date.now() - startTime;
        return NextResponse.json(result);
      }

      const testPixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      };
      if (process.env.ZAI_TOKEN) headers['X-Token'] = process.env.ZAI_TOKEN;
      if (process.env.ZAI_USER_ID) headers['X-User-Id'] = process.env.ZAI_USER_ID;

      const httpResp = await fetch(`${baseUrl}/chat/completions/vision`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: 'glm-4.6v',
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: 'Describe this image in one word.' },
              { type: 'image_url', image_url: { url: testPixel } },
            ],
          }],
          temperature: 0.1,
          max_tokens: 10,
        }),
        signal: AbortSignal.timeout(25_000),
      });

      const httpData = await httpResp.json();

      if (httpResp.ok && httpData.choices?.[0]?.message?.content) {
        result.status = 'degraded'; // SDK broken but HTTP works
        result.gateway.modelResolved = httpData.model || undefined;
        result.result = {
          content: httpData.choices[0].message.content.slice(0, 100),
          tokensUsed: httpData.usage?.total_tokens,
        };
        result.error = `SDK failed (${sdkMsg.slice(0, 80)}), HTTP fallback succeeded`;
      } else {
        result.status = 'unhealthy';
        result.error = `SDK: ${sdkMsg.slice(0, 80)}. HTTP: ${httpResp.status} — ${JSON.stringify(httpData).slice(0, 200)}`;
      }
    } catch (httpError: unknown) {
      const httpMsg = httpError instanceof Error ? httpError.message : String(httpError);
      result.status = 'unhealthy';
      result.error = `SDK: ${sdkMsg.slice(0, 80)}. HTTP fallback: ${httpMsg.slice(0, 80)}`;
    }
  }

  result.responseTimeMs = Date.now() - startTime;
  return NextResponse.json(result);
}
