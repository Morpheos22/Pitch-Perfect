// src/lib/vertex-ai.ts
// Google AI (Gemini) integration for Pitch Perfect — FALLBACK for E2 Script Check
//
// AI Strategy Chain for E2 Script Check:
//   Strategy 1: Z.ai Gateway (GLM models) — PRIMARY for ALL modules
//   Strategy 2: Google AI / Vertex AI (this module) — FALLBACK for E2
//
// ENDPOINT ROUTING:
//   If GOOGLE_CLOUD_PROJECT is set → Vertex AI endpoint:
//     https://{location}-aiplatform.googleapis.com/v1/projects/{PROJECT}/locations/{LOCATION}/publishers/google/models/{MODEL}:generateContent
//   Otherwise → Google AI Studio endpoint:
//     https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent
//
// REQUIRED ENV VARS:
//   GOOGLE_GENAI_API_KEY   — API key from Google AI Studio or Google Cloud (REQUIRED)
//   GOOGLE_CLOUD_PROJECT   — Google Cloud project ID/number (optional, enables Vertex AI endpoint)
//   GOOGLE_CLOUD_LOCATION  — Vertex AI region (optional, default: us-central1)
//
// PREREQUISITES:
//   For AI Studio endpoint: Enable "Generative Language API" on the Google Cloud project
//     → https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com
//   For Vertex AI endpoint: Enable billing on the Google Cloud project
//     → https://console.developers.google.com/billing/enable?project={PROJECT}

import type { ScriptAnalysisResult } from './ai-service';
import { clampScore, validateStringArray, extractJsonFromContent } from './ai-utils';

// ============================================
// CONFIGURATION
// ============================================

const GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || '';
const GOOGLE_CLOUD_LOCATION = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
const GOOGLE_GENAI_API_KEY = process.env.GOOGLE_GENAI_API_KEY || '';

/** Model to use for Gemini — shared between both endpoints */
const GEMINI_MODEL = 'gemini-2.0-flash';

/** Check if Google AI / Gemini is configured and ready to use.
 *  Requires GOOGLE_GENAI_API_KEY at minimum.
 *  If GOOGLE_CLOUD_PROJECT is also set, uses Vertex AI endpoint;
 *  otherwise falls back to the AI Studio endpoint.
 */
export function isVertexAIConfigured(): boolean {
  return !!GOOGLE_GENAI_API_KEY;
}

/** Get configuration status for health checks */
export function getVertexAIConfigStatus(): {
  configured: boolean;
  provider: string;
  project: string;
  location: string;
  hasApiKey: boolean;
} {
  const hasApiKey = !!GOOGLE_GENAI_API_KEY;
  const hasProject = !!GOOGLE_CLOUD_PROJECT;
  const provider = hasProject ? 'vertex-ai' : 'google-ai-studio';
  return {
    configured: hasApiKey,
    provider,
    project: hasProject ? `${GOOGLE_CLOUD_PROJECT.slice(0, 4)}...` : 'NOT SET (using AI Studio)',
    location: GOOGLE_CLOUD_LOCATION,
    hasApiKey,
  };
}

// ============================================
// ENDPOINT BUILDERS
// ============================================

/**
 * Build the correct Gemini endpoint URL based on configuration.
 * - Vertex AI: Uses the aiplatform.googleapis.com endpoint (needs project + billing)
 * - AI Studio: Uses the generativelanguage.googleapis.com endpoint (needs API enabled)
 */
function buildEndpoint(): { url: string; provider: string } {
  if (GOOGLE_CLOUD_PROJECT) {
    // Vertex AI endpoint — requires billing enabled on the project
    const url = `https://${GOOGLE_CLOUD_LOCATION}-aiplatform.googleapis.com/v1/projects/${GOOGLE_CLOUD_PROJECT}/locations/${GOOGLE_CLOUD_LOCATION}/publishers/google/models/${GEMINI_MODEL}:generateContent`;
    return { url, provider: `vertex-ai/${GEMINI_MODEL}` };
  }
  // AI Studio endpoint — requires Generative Language API enabled
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
  return { url, provider: `google-ai-studio/${GEMINI_MODEL}` };
}

// ============================================
// ANALYSIS FUNCTIONS
// ============================================

/**
 * Analyze a pitch script using Google AI / Gemini.
 * This is Strategy 1 (PRIMARY) for E2 Script Check.
 *
 * @param script - The pitch script text to analyze
 * @param targetAudience - Target audience (e.g., "investors")
 * @param targetDuration - Target duration in seconds
 * @returns Analysis result matching the ScriptAnalysisResult interface
 */
export async function analyzeWithVertexAI(
  script: string,
  targetAudience?: string,
  targetDuration?: number,
): Promise<ScriptAnalysisResult> {
  if (!isVertexAIConfigured()) {
    throw new Error('Google AI is not configured. Set GOOGLE_GENAI_API_KEY env var.');
  }

  const { url: endpoint, provider } = buildEndpoint();
  console.log(`[GoogleAI] Starting script analysis via ${provider}...`);

  const systemPrompt = `You are an expert pitch coach with 15+ years of experience evaluating elevator pitches. Analyze the script against the 5-Element Elevator Pitch Framework:

1. HOOK — Does it grab attention in the opening line?
2. PROBLEM — Is the problem clearly identified and compelling?
3. SOLUTION — Is the solution clear, differentiated, and easy to understand?
4. PROOF/CREDIBILITY — Is there evidence of traction or credibility?
5. THE ASK — Is the call-to-action clear and specific?

SCORING CALIBRATION:
- 90-100 (Exceptional): Top 5%. Investor-ready, minimal changes needed.
- 70-89 (Strong): Solid foundation. Targeted refinements needed.
- 50-69 (Developing): Shows promise but has significant gaps.
- 30-49 (Needs Work): Critical gaps in multiple areas.
- 0-29 (Beginning): Fundamentals missing.

Respond ONLY with valid JSON (no markdown).`;

  const userPrompt = `Analyze this elevator pitch script:

${script}

Target audience: ${targetAudience || 'investors'}
Target duration: ${targetDuration || 60} seconds

Provide your analysis as a JSON object with this EXACT structure:
{
  "hookScore": <number 0-100>,
  "problemScore": <number 0-100>,
  "solutionScore": <number 0-100>,
  "credibilityScore": <number 0-100>,
  "ctaScore": <number 0-100>,
  "overallScore": <number 0-100>,
  "wordCount": <number>,
  "estimatedDuration": <number in seconds>,
  "improvements": {
    "hook": ["<specific improvement 1>", "<specific improvement 2>"],
    "problem": ["<specific improvement 1>", "<specific improvement 2>"],
    "solution": ["<specific improvement 1>", "<specific improvement 2>"],
    "credibility": ["<specific improvement 1>", "<specific improvement 2>"],
    "cta": ["<specific improvement 1>", "<specific improvement 2>"]
  },
  "rewrittenScript": "<complete rewritten version of the script>",
  "alternativeHooks": ["<alternative hook 1>", "<alternative hook 2>", "<alternative hook 3>"]
}`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GOOGLE_GENAI_API_KEY,
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
          },
        ],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 4096,
        },
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => 'unknown');
      const errorDetail = body.slice(0, 300);

      // Parse the error for better logging
      let errorReason = '';
      try {
        const parsed = JSON.parse(body);
        errorReason = parsed?.error?.details?.[0]?.reason || '';
      } catch { /* ignore */ }

      if (errorReason === 'API_KEY_SERVICE_BLOCKED') {
        console.warn('[GoogleAI] API_KEY_SERVICE_BLOCKED — Generative Language API not enabled. Enable at: https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com');
      } else if (errorReason === 'BILLING_DISABLED') {
        console.warn('[GoogleAI] BILLING_DISABLED — Enable billing at the Google Cloud Console.');
      } else if (response.status === 429) {
        console.warn('[GoogleAI] RESOURCE_EXHAUSTED — Quota exceeded. Consider enabling billing or using a different project.');
      }

      throw new Error(`Google AI (${provider}) returned ${response.status}: ${errorDetail}`);
    }

    const data = await response.json();
    const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      throw new Error('Google AI returned empty response — no content in candidates[0].content.parts[0].text');
    }

    // Parse the JSON from the response
    const jsonStr = extractJsonFromContent(content);
    if (!jsonStr) {
      throw new Error('Could not extract JSON from Google AI response');
    }

    const parsed = JSON.parse(jsonStr);

    // Build result matching ScriptAnalysisResult interface
    const result: ScriptAnalysisResult = {
      hookScore: clampScore(parsed.hookScore),
      problemScore: clampScore(parsed.problemScore),
      solutionScore: clampScore(parsed.solutionScore),
      credibilityScore: clampScore(parsed.credibilityScore),
      ctaScore: clampScore(parsed.ctaScore),
      overallScore: clampScore(parsed.overallScore),
      wordCount: script.split(/\s+/).filter(Boolean).length,
      estimatedDuration: parsed.estimatedDuration || Math.round(script.split(/\s+/).length * 0.4),
      improvements: validateImprovements(parsed.improvements),
      rewrittenScript: parsed.rewrittenScript || '',
      alternativeHooks: validateStringArray(parsed.alternativeHooks),
      modelUsed: provider,
      tokensUsed: data?.usageMetadata?.totalTokenCount,
    };

    console.log(`[GoogleAI] Analysis complete via ${provider}: overall=${result.overallScore}, hook=${result.hookScore}`);
    return result;
  } catch (error: any) {
    console.error(`[GoogleAI] Analysis failed (${provider}):`, error?.message || error);
    throw error;
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================
// clampScore, validateStringArray, extractJsonFromContent are now imported from ./ai-utils

type Improvements = { hook: string[]; problem: string[]; solution: string[]; credibility: string[]; cta: string[] };

function validateImprovements(value: unknown): Improvements {
  const defaults: Improvements = { hook: [], problem: [], solution: [], credibility: [], cta: [] };
  if (typeof value !== 'object' || value === null) {
    return defaults;
  }
  const keys = ['hook', 'problem', 'solution', 'credibility', 'cta'] as const;
  for (const key of keys) {
    defaults[key] = validateStringArray((value as Record<string, unknown>)[key]);
  }
  return defaults;
}

