// src/lib/vertex-ai.ts
// Google AI (Gemini) integration for Pitch Perfect — PRIMARY for E2 Script Check
//
// AI Strategy Chain for E2 Script Check:
//   Strategy 1: Google AI / Gemini (this module) — PRIMARY for E2
//   Strategy 2: Z.ai SDK (z-ai-web-dev-sdk) — secondary
//   Strategy 3: Z.ai direct HTTP fallback — tertiary
//
// REQUIRED ENV VARS:
//   GOOGLE_GENAI_API_KEY   — API key from Google AI Studio (REQUIRED)
//   GOOGLE_CLOUD_PROJECT   — Google Cloud project ID (optional, for Vertex AI endpoint)
//   GOOGLE_CLOUD_LOCATION  — Vertex AI region (optional, default: us-central1)
//
// HOW TO GET THE API KEY:
//   1. Go to https://aistudio.google.com/apikey
//   2. Sign in with your Google account
//   3. Click "Create API Key" or use an existing one
//   4. Copy the API key
//   5. Set GOOGLE_GENAI_API_KEY in Vercel Project Settings → Environment Variables
//
// Alternatively, from Google Cloud Console:
//   1. Go to https://console.cloud.google.com/
//   2. Enable the Generative Language API in APIs & Services
//   3. APIs & Services → Credentials → Create Credentials → API Key
//   4. Restrict the key to "Generative Language API"

import type { ScriptAnalysisResult } from './ai-service';

// ============================================
// CONFIGURATION
// ============================================

const GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || '';
const GOOGLE_CLOUD_LOCATION = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
const GOOGLE_GENAI_API_KEY = process.env.GOOGLE_GENAI_API_KEY || '';

/** Check if Google AI / Gemini is configured and ready to use.
 *  Only requires GOOGLE_GENAI_API_KEY — the Generative Language API
 *  endpoint (aistudio.google.com) does not need a project ID.
 *  GOOGLE_CLOUD_PROJECT is only needed for the Vertex AI endpoint variant.
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
  // Determine which endpoint will be used
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
// ANALYSIS FUNCTIONS
// ============================================

/**
 * Analyze a pitch script using Vertex AI (Google Gemini).
 * This is Strategy 3 in the AI fallback chain.
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
    throw new Error('Vertex AI is not configured. Set GOOGLE_CLOUD_PROJECT and GOOGLE_GENAI_API_KEY env vars.');
  }

  console.log('[VertexAI] Starting script analysis...');

  // Use the Google Generative AI REST API directly
  // This avoids the need for the @google-cloud/vertexai SDK which has
  // complex authentication requirements (service account keys, etc.)
  const endpoint = `https://${GOOGLE_CLOUD_LOCATION}-aiplatform.googleapis.com/v1/projects/${GOOGLE_CLOUD_PROJECT}/locations/${GOOGLE_CLOUD_LOCATION}/endpoints/openapi/chat/completions`;

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
    // Use the Generative Language API (simpler auth with API key)
    // Endpoint: https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent
    const genAIEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GOOGLE_GENAI_API_KEY}`;

    const response = await fetch(genAIEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
      throw new Error(`Vertex AI API returned ${response.status}: ${body.slice(0, 300)}`);
    }

    const data = await response.json();
    const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      throw new Error('Vertex AI returned empty response — no content in candidates[0].content.parts[0].text');
    }

    // Parse the JSON from the response
    const jsonStr = extractJsonFromContent(content);
    if (!jsonStr) {
      throw new Error('Could not extract JSON from Vertex AI response');
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
      modelUsed: 'vertex-ai/gemini-2.0-flash',
      tokensUsed: data?.usageMetadata?.totalTokenCount,
    };

    console.log(`[VertexAI] Analysis complete: overall=${result.overallScore}, hook=${result.hookScore}`);
    return result;
  } catch (error: any) {
    console.error('[VertexAI] Analysis failed:', error?.message || error);
    throw error;
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function clampScore(value: unknown, min = 0, max = 100): number {
  const num = typeof value === 'number' && Number.isFinite(value) ? value : undefined;
  if (num === undefined) return 50;
  return Math.round(Math.min(max, Math.max(min, num)));
}

function validateStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter(v => typeof v === 'string');
  if (typeof value === 'string') return [value];
  return [];
}

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

function extractJsonFromContent(content: string): string | null {
  // Try to extract from markdown code block first
  const codeBlockMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (codeBlockMatch) {
    const jsonStr = codeBlockMatch[1].trim();
    if (jsonStr.startsWith('{') || jsonStr.startsWith('[')) {
      return jsonStr;
    }
  }

  // Balanced brace matching
  let depth = 0;
  let start = -1;
  let inString = false;
  let escape = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (escape) { escape = false; continue; }
    if (char === '\\') { escape = true; continue; }
    if (char === '"' && !escape) { inString = !inString; continue; }
    if (inString) continue;
    if (char === '{') { if (depth === 0) start = i; depth++; }
    else if (char === '}') {
      depth--;
      if (depth === 0 && start !== -1) return content.substring(start, i + 1);
    }
  }

  return null;
}
