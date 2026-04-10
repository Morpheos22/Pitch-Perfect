// AI Service Layer for Pitch Perfect × Automagikal
// Multi-provider via Z.ai Gateway: GLM, Gemini, Gemma + full capability suite
//
// ═══════════════════════════════════════════════════════════════════════
// GATEWAY MODEL ROUTING (live-proven 2026-04-07)
// ═══════════════════════════════════════════════════════════════════════
// The Z.ai gateway is a model router/aggregator. All model names within
// each category resolve to the SAME underlying model server-side:
//
//   TEXT  (/chat/completions)    → ALL names route to glm-4-plus
//   VISION (/chat/completions/vision) → ALL names route to glm-4.6v
//
// COST IMPLICATION: There is ZERO cost difference between model names.
// gemini-1.5-pro and glm-4-flash are the same glm-4-plus on the server.
// Fallback chains remain for future-proofing if the gateway adds
// real model differentiation.
//
// MODEL LABELS (semantic naming for code clarity):
//   PRIMARY_TEXT:     gemini-2.5-flash     → glm-4-plus   (text tasks)
//   UPGRADE_TEXT:     gemini-1.5-pro       → glm-4-plus   (deeper analysis)
//   GLM_FLAGSHIP:     glm-5.1              → glm-4-plus   (GLM brand)
//   GLM_FAST:         glm-4-flash         → glm-4-plus   (fast label)
//   FAILSAFE_TEXT:    gemma-4              → glm-4-plus   (open-weight label)
//   PRIMARY_VISION:   gemini-1.5-pro       → glm-4.6v    (vision tasks)
//   GLM_VISION:       glm-4.1v-thinking    → glm-4.6v    (vision + thinking)
//   FAST_VISION:      gemini-2.0-flash     → glm-4.6v    (fast vision label)
//   FAILSAFE_VISION:  gemma-4              → glm-4.6v    (vision failsafe)
//
// Z.AI CAPABILITY SUITE (all confirmed live):
//   ✅ Text Chat        → E1-E5 all text analysis, rewrites, Q&A
//   ✅ Vision (Image)   → E1 visual audit, E5 deck screenshots
//   ✅ Vision (Video)   → E3 delivery, E4 full session analysis
//   ✅ ASR              → E3/E4 speech-to-text transcription
//   ✅ TTS              → E5 pathway narration, feedback audio
//   ✅ Web Search       → E5 investor research, E4 competitive intel
//   ✅ Image Gen        → E5 network visuals, report covers
//   ✅ Video Gen        → E5 marketing demos, pathway explainer videos

import { readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// ============================================
// DIRECT HTTP FALLBACK CONFIGURATION
// ============================================
// Bypass the SDK entirely and call the Z.ai gateway via standard fetch.
// This ensures AI works even if the SDK has initialization/auth issues.
//
// REQUIRED: ZAI_API_KEY (your API Key from the Z.ai platform)
// OPTIONAL: ZAI_TOKEN  (secondary X-Token header, not needed for most setups)
// OPTIONAL: ZAI_USER_ID (maps to your API ID from the Z.ai platform)

const GATEWAY_URL = process.env.ZAI_BASE_URL || 'https://zukijufuzu.xyz/api/v1';
const GATEWAY_API_KEY = process.env.ZAI_API_KEY || '';
const GATEWAY_TOKEN = process.env.ZAI_TOKEN || '';
const GATEWAY_USER_ID = process.env.ZAI_USER_ID || '';

/** Whether we have minimum credentials for direct HTTP calls */
function hasDirectCredentials(): boolean {
  return !!GATEWAY_API_KEY;
}

/** Call the Z.ai gateway text endpoint directly via fetch */
async function callGatewayText(
  model: string,
  messages: Array<{ role: string; content: string }>,
  temperature: number,
  maxTokens?: number
): Promise<any> {
  if (!hasDirectCredentials()) {
    throw new Error('No gateway credentials. Set ZAI_API_KEY env var.');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Z-AI-From': 'Z',
  };
  // Auth: API Key as Bearer + X-Token (use ZAI_TOKEN if set, else API key)
  if (GATEWAY_API_KEY) {
    headers['Authorization'] = `Bearer ${GATEWAY_API_KEY}`;
    headers['X-Token'] = GATEWAY_TOKEN || GATEWAY_API_KEY;
  }
  // Optional: User/API ID for request attribution
  if (GATEWAY_USER_ID) headers['X-User-Id'] = GATEWAY_USER_ID;

  const resp = await fetch(`${GATEWAY_URL}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens || 4096,
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => 'unknown');
    throw new Error(`Gateway ${resp.status}: ${body.slice(0, 300)}`);
  }

  return resp.json();
}

/** Call the Z.ai gateway vision endpoint directly via fetch */
async function callGatewayVision(
  model: string,
  messages: Array<{
    role: string;
    content: string | Array<{ type: string; text?: string; image_url?: { url: string }; video_url?: { url: string }; file_url?: { url: string } }>;
  }>,
  temperature: number,
  maxTokens?: number
): Promise<any> {
  if (!hasDirectCredentials()) {
    throw new Error('No gateway credentials. Set ZAI_API_KEY env var.');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Z-AI-From': 'Z',
  };
  // Vision endpoint REQUIRES X-Token header (returns 401 without it)
  // Use ZAI_TOKEN if set, otherwise fall back to ZAI_API_KEY
  if (GATEWAY_API_KEY) {
    headers['Authorization'] = `Bearer ${GATEWAY_API_KEY}`;
    headers['X-Token'] = GATEWAY_TOKEN || GATEWAY_API_KEY;
  }
  if (GATEWAY_USER_ID) headers['X-User-Id'] = GATEWAY_USER_ID;

  const resp = await fetch(`${GATEWAY_URL}/chat/completions/vision`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens || 4096,
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => 'unknown');
    throw new Error(`Gateway ${resp.status}: ${body.slice(0, 300)}`);
  }

  return resp.json();
}

// ============================================
// Z.AI SDK INITIALIZATION
// ============================================

type ZAIInstance = Awaited<ReturnType<typeof import('z-ai-web-dev-sdk').default.create>>;

let zaiInstance: ZAIInstance | null = null;
let configCreated = false;

function createZaiConfig(): boolean {
  if (configCreated) return true;

  // Try to read existing config from known locations (highest priority first)
  let existingConfig: Record<string, string | undefined> = {};
  const readPaths = [
    join(process.cwd(), '.z-ai-config'),
    join(homedir(), '.z-ai-config'),
    '/etc/.z-ai-config',
  ];

  for (const p of readPaths) {
    try {
      const raw = readFileSync(p, 'utf-8');
      existingConfig = JSON.parse(raw);
      break; // Use first found
    } catch {
      /* not found, continue */
    }
  }

  // Build config: existing values as defaults, env vars override only if set
  const apiKey = process.env.ZAI_API_KEY || existingConfig.apiKey;
  const config: Record<string, string | undefined> = {
    baseUrl: process.env.ZAI_BASE_URL || existingConfig.baseUrl || 'https://zukijufuzu.xyz/api/v1',
    apiKey: apiKey,
    chatId: process.env.ZAI_CHAT_ID || existingConfig.chatId,
    userId: process.env.ZAI_USER_ID || existingConfig.userId,
    // Vision endpoint REQUIRES X-Token — use ZAI_TOKEN if set, else apiKey
    token: process.env.ZAI_TOKEN || existingConfig.token || apiKey,
  };

  // Validate minimum requirements
  if (!config.apiKey) {
    console.error('[ZAI] No API key configured. Set ZAI_API_KEY env var.');
    return false;
  }
  // NOTE: Previously this function wrote .z-ai-config to the filesystem.
  // That was removed to prevent credential leaks. The SDK reads from env vars
  // directly; the read paths above remain for backward compatibility only.

  configCreated = true;
  return true;
}

export async function getZai() {
  if (!zaiInstance) {
    createZaiConfig();
    const { default: ZAI } = await import('z-ai-web-dev-sdk');
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

// ============================================
// MODEL REGISTRY — Primary / Fallback / Failsafe
// ============================================

export const AI_MODELS = {
  // ── TEXT MODELS (gateway uses its default model for all) ──────────────
  // The Z.ai gateway ignores model names and routes to its default text model.
  // We still send a model field for logging/tracking purposes.
  PRIMARY_TEXT:     'glm-4-plus',            // Text analysis (default gateway model)
  UPGRADE_TEXT:     'glm-4-plus',            // Deeper analysis
  GLM_FLAGSHIP:     'glm-4-plus',            // GLM brand
  GLM_FAST:         'glm-4-plus',            // Fast tasks
  FAILSAFE_TEXT:    'glm-4-plus',            // Failsafe

  // ── VISION MODELS (gateway routes to its default vision model) ──────────
  PRIMARY_VISION:   'glm-4.6v',              // Vision tasks
  GLM_VISION:       'glm-4.6v',              // Vision + thinking
  FAST_VISION:      'glm-4.6v',              // Quick scans
  FAILSAFE_VISION:  'glm-4.6v',              // Vision failsafe

  // ── SPECIALIZED (Z.ai capability suite) ─────────────────────────────────
  TTS_MODEL:        'tongtong',               // Z.ai TTS voice (tongtong/chelsie/diana/emma/aria)
} as const;

type ModelName = (typeof AI_MODELS)[keyof typeof AI_MODELS];

// ============================================
// MODULE → MODEL MAPPING (with fallback chain)
// ============================================

export interface ModuleModelConfig {
  /** Ordered list of models to try (primary first, failsafe last) */
  models: ModelName[];
  temperature: number;
  thinkingEnabled?: boolean;
  description: string;
  /** SDK method: 'chat' for text, 'vision' for multimodal */
  method: 'chat' | 'vision';
}

export const MODULE_MODEL_MAP = {
  // ═══════════════════════════════════════════════════════════════════════
  // E1: PITCH DECK ANALYSER
  // ═══════════════════════════════════════════════════════════════════════
  E1_DECK_CONTENT: {
    models: [AI_MODELS.PRIMARY_TEXT, AI_MODELS.UPGRADE_TEXT, AI_MODELS.FAILSAFE_TEXT],
    temperature: 0.3,
    method: 'chat' as const,
    description: 'Pitch deck text content analysis (8-dimension scoring: problem, solution, market, team, financials, ask)',
  },
  E1_DECK_VISUAL: {
    models: [AI_MODELS.PRIMARY_VISION, AI_MODELS.GLM_VISION, AI_MODELS.FAST_VISION, AI_MODELS.FAILSAFE_VISION],
    temperature: 0.2,
    thinkingEnabled: true,
    method: 'vision' as const,
    description: 'Pitch deck visual audit (design consistency, readability, typography, color scheme)',
  },

  // ═══════════════════════════════════════════════════════════════════════
  // E2: ELEVATOR PITCH SCRIPT COACH
  // ═══════════════════════════════════════════════════════════════════════
  E2_SCRIPT_ANALYSIS: {
    models: [AI_MODELS.PRIMARY_TEXT, AI_MODELS.UPGRADE_TEXT, AI_MODELS.FAILSAFE_TEXT],
    temperature: 0.4,
    method: 'chat' as const,
    description: 'Elevator pitch script analysis (5-element framework: hook, problem, solution, credibility, CTA)',
  },
  E2_SCRIPT_REWRITE: {
    models: [AI_MODELS.PRIMARY_TEXT, AI_MODELS.GLM_FLAGSHIP, AI_MODELS.FAILSAFE_TEXT],
    temperature: 0.6,  // Higher for creative rewrites
    method: 'chat' as const,
    description: 'Elevator pitch script rewriting (creative alternatives, hook variants, tone adjustment)',
  },

  // ═══════════════════════════════════════════════════════════════════════
  // E3: LIVE ELEVATOR PITCH COACH (video ≤3 min)
  // ═══════════════════════════════════════════════════════════════════════
  E3_LIVE_PITCH: {
    models: [AI_MODELS.GLM_VISION, AI_MODELS.PRIMARY_VISION, AI_MODELS.FAST_VISION, AI_MODELS.FAILSAFE_VISION],
    temperature: 0.3,
    thinkingEnabled: true,
    method: 'vision' as const,
    description: 'Short-form video pitch analysis (delivery: pace/clarity/energy + body language: eye contact/posture/gestures)',
  },
  E3_TRANSCRIPTION: {
    models: [AI_MODELS.PRIMARY_TEXT, AI_MODELS.FAILSAFE_TEXT],
    temperature: 0.1,
    method: 'chat' as const,
    description: 'Audio transcription for live pitch recordings (via ASR + text cleanup)',
  },

  // ═══════════════════════════════════════════════════════════════════════
  // E4: FULL PITCH SESSION (video ≤30 min + deck)
  // ═══════════════════════════════════════════════════════════════════════
  E4_FULL_SESSION: {
    models: [AI_MODELS.PRIMARY_VISION, AI_MODELS.GLM_VISION, AI_MODELS.FAILSAFE_VISION],
    temperature: 0.3,
    thinkingEnabled: true,
    method: 'vision' as const,
    description: 'Full investor pitch analysis (6-dimension readiness: problem-solution fit, market, business model, team, traction, delivery)',
  },
  E4_COMPETITIVE_INTEL: {
    models: [AI_MODELS.PRIMARY_TEXT, AI_MODELS.FAILSAFE_TEXT],
    temperature: 0.5,
    method: 'chat' as const,
    description: 'Competitive landscape research using web search + AI synthesis',
  },

  // ═══════════════════════════════════════════════════════════════════════
  // UTILITY MODULES
  // ═══════════════════════════════════════════════════════════════════════
  IMAGE_ANALYSIS: {
    models: [AI_MODELS.PRIMARY_VISION, AI_MODELS.GLM_VISION, AI_MODELS.FAST_VISION, AI_MODELS.FAILSAFE_VISION],
    temperature: 0.2,
    thinkingEnabled: true,
    method: 'vision' as const,
    description: 'Individual slide image analysis for visual audit (design, readability, elements)',
  },
  MARKET_RESEARCH: {
    models: [AI_MODELS.PRIMARY_TEXT, AI_MODELS.GLM_FAST, AI_MODELS.FAILSAFE_TEXT],
    temperature: 0.4,
    method: 'chat' as const,
    description: 'Market data validation and competitive intelligence via web search',
  },
  FEEDBACK_NARRATION: {
    models: [AI_MODELS.PRIMARY_TEXT, AI_MODELS.FAILSAFE_TEXT],
    temperature: 0.7,
    method: 'chat' as const,
    description: 'Generate conversational feedback summary for TTS narration',
  },
  REPORT_COVER: {
    models: [AI_MODELS.PRIMARY_TEXT, AI_MODELS.FAILSAFE_TEXT],
    temperature: 0.8,
    method: 'chat' as const,
    description: 'Generate image prompts for AI report cover generation',
  },
  COACHING_DRILL_GEN: {
    models: [AI_MODELS.PRIMARY_TEXT, AI_MODELS.GLM_FLAGSHIP, AI_MODELS.FAILSAFE_TEXT],
    temperature: 0.6,
    method: 'chat' as const,
    description: 'Generate personalized coaching drills based on analysis results',
  },

  // ═══════════════════════════════════════════════════════════════════════
  // E5: PITCH FOUNDER — Conversion Layer to Automagikal Network
  // ═══════════════════════════════════════════════════════════════════════
  // The conversion layer where a founder stops being a user and starts
  // being a candidate for the Automagikal Network.
  //
  // Two pathways:
  //   Path A: Grit to Gear → Discounted cohort → Small Axe education →
  //           1-on-1 mentorship → Certification → AfriFlow → Network
  //   Path B: AfriFlow Direct → Full price → Deck before VCs/investors
  //           → Immediate access → Network
  //
  // Z.ai capabilities used:
  //   Chat    → Founder readiness assessment, pathway recommendation
  //   Web Search → Investor landscape research, market validation
  //   Vision  → Deck quality re-check before investor submission
  //   TTS     → Narrate pathway recommendation
  //   Image Gen → Network badge, pathway card visuals
  //   Video Gen → Marketing explainer videos
  // ═══════════════════════════════════════════════════════════════════════
  E5_FOUNDER_READINESS: {
    models: [AI_MODELS.PRIMARY_TEXT, AI_MODELS.UPGRADE_TEXT, AI_MODELS.FAILSAFE_TEXT],
    temperature: 0.3,
    method: 'chat' as const,
    description: 'Founder investor-readiness assessment: evaluate deck quality, pitch confidence, market timing, team readiness, and recommend Path A (Grit to Gear) or Path B (AfriFlow Direct)',
  },
  E5_PATHWAY_RECOMMENDATION: {
    models: [AI_MODELS.PRIMARY_TEXT, AI_MODELS.GLM_FLAGSHIP, AI_MODELS.FAILSAFE_TEXT],
    temperature: 0.5,
    method: 'chat' as const,
    description: 'Personalized pathway recommendation engine: compare Grit to Gear vs AfriFlow Direct based on founder profile, scores, and goals',
  },
  E5_INVESTOR_RESEARCH: {
    models: [AI_MODELS.PRIMARY_TEXT, AI_MODELS.GLM_FAST, AI_MODELS.FAILSAFE_TEXT],
    temperature: 0.4,
    method: 'chat' as const,
    description: 'Investor landscape research via web search: identify relevant VCs, angels, and funding opportunities for the founder sector and stage',
  },
  E5_COHORT_MATCHING: {
    models: [AI_MODELS.PRIMARY_TEXT, AI_MODELS.UPGRADE_TEXT, AI_MODELS.FAILSAFE_TEXT],
    temperature: 0.2,
    method: 'chat' as const,
    description: 'Small Axe cohort matching: assess founder fit for upcoming cohorts, identify mentor alignment, suggest certification track',
  },
  E5_NETWORK_PROFILE: {
    models: [AI_MODELS.PRIMARY_TEXT, AI_MODELS.FAILSAFE_TEXT],
    temperature: 0.6,
    method: 'chat' as const,
    description: 'Generate Automagikal Network founder profile: craft investor-facing summary, highlight standout elements, prepare for AfriFlow submission',
  },
  E5_PATHWAY_NARRATION: {
    models: [AI_MODELS.PRIMARY_TEXT, AI_MODELS.FAILSAFE_TEXT],
    temperature: 0.7,
    method: 'chat' as const,
    description: 'Generate conversational pathway explanation for TTS narration: explain recommended path, next steps, and what to expect',
  },
} as const;

export type ModuleModelKey = keyof typeof MODULE_MODEL_MAP;

// ============================================
// FALLBACK CHAIN EXECUTOR
// ============================================

interface ChatRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  max_tokens?: number;
  [key: string]: unknown;
}

interface VisionRequest {
  model: string;
  messages: Array<{
    role: string;
    content: string | Array<{ type: string; text?: string; image_url?: { url: string }; video_url?: { url: string }; file_url?: { url: string } }>;
  }>;
  temperature?: number;
  max_tokens?: number;
  thinking?: { type: 'enabled' | 'disabled' };
}

export async function executeWithFallback(
  moduleKey: ModuleModelKey,
  buildRequest: (model: string) => ChatRequest | VisionRequest
): Promise<{ response: any; modelUsed: string; moduleKey: string }> {
  const config = MODULE_MODEL_MAP[moduleKey];
  const lastError: Error[] = [];

  // ── STRATEGY 1: Try SDK with model fallback chain ──
  for (const model of config.models) {
    try {
      const zai = await getZai();
      const request = buildRequest(model);

      let response;
      if (config.method === 'vision') {
        const vr = request as VisionRequest;
        response = await zai.chat.completions.createVision({
          model: vr.model,
          messages: vr.messages as any,
          temperature: vr.temperature,
          max_tokens: vr.max_tokens,
          thinking: config.thinkingEnabled ? { type: 'enabled' as const } : { type: 'disabled' as const },
        } as any);
      } else {
        const cr = request as ChatRequest;
        response = await zai.chat.completions.create({
          model: cr.model,
          messages: cr.messages as any,
          temperature: cr.temperature,
          max_tokens: cr.max_tokens,
        });
      }

      return { response, modelUsed: model, moduleKey };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      lastError.push(err);
      console.warn(`[ZAI-SDK] Model ${model} failed for ${moduleKey}: ${err.message}. Trying next...`);
    }
  }

  // ── STRATEGY 2: Direct HTTP fallback to gateway (bypass SDK) ──
  console.warn(`[ZAI] All SDK models failed for ${moduleKey}. Trying direct HTTP fallback to ${GATEWAY_URL}...`);

  for (const model of config.models) {
    try {
      const request = buildRequest(model);

      let response;
      if (config.method === 'vision') {
        const vr = request as VisionRequest;
        response = await callGatewayVision(
          vr.model,
          vr.messages as any,
          vr.temperature || config.temperature,
          vr.max_tokens
        );
      } else {
        const cr = request as ChatRequest;
        response = await callGatewayText(
          cr.model,
          cr.messages as any,
          cr.temperature || config.temperature,
          cr.max_tokens
        );
      }

      return { response, modelUsed: `${model} (direct)`, moduleKey };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      lastError.push(err);
      console.warn(`[ZAI-HTTP] Model ${model} direct call failed for ${moduleKey}: ${err.message}. Trying next...`);
    }
  }

  throw new Error(
    `All models failed for ${moduleKey} (SDK + direct HTTP): ${lastError.map(e => e.message).join(' → ')}`
  );
}

// ============================================
// HELPER: Parse JSON from AI response
// ============================================

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

    if (escape) {
      escape = false;
      continue;
    }

    if (char === '\\') {
      escape = true;
      continue;
    }

    if (char === '"' && !escape) {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (char === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        return content.substring(start, i + 1);
      }
    }
  }

  return null;
}

function parseJsonResponse<T>(content: string): T {
  const jsonStr = extractJsonFromContent(content);
  if (!jsonStr) {
    console.error('[ZAI] Failed to parse AI response:', content.slice(0, 500));
    throw new Error('No JSON object found in AI response');
  }
  return JSON.parse(jsonStr) as T;
}

// ============================================
// HELPER: Validate and clamp AI response values
// ============================================

function clampScore(value: unknown, min = 0, max = 100): number {
  const num = typeof value === 'number' && Number.isFinite(value) ? value : 50;
  return Math.round(Math.min(max, Math.max(min, num)));
}

function validateStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') return [value];
  return [];
}

// ============================================
// SCORING WEIGHTS & QUALITY FRAMEWORK
// ============================================
// These weights define how individual dimensions contribute to the overall score.
// Used to cross-check the AI's subjective overall score for consistency.

export const SCORING_WEIGHTS = {
  E1_CONTENT: {
    problemClarity: 0.15, solutionClarity: 0.15, marketOpportunity: 0.15,
    businessModel: 0.10, teamCredibility: 0.10, traction: 0.15,
    financials: 0.10, askClarity: 0.10,
  },
  E1_VISUAL: {
    designConsistency: 0.25, readability: 0.25, visualHierarchy: 0.20,
    colorScheme: 0.15, typography: 0.15,
  },
  E2_ELEMENTS: {
    hook: 0.20, problem: 0.20, solution: 0.20, credibility: 0.20, cta: 0.20,
  },
  E3_DELIVERY: {
    pace: 0.20, clarity: 0.20, fillerWords: 0.20, energy: 0.20, confidence: 0.20,
  },
  E3_BODY_LANGUAGE: {
    eyeContact: 0.25, facialExpression: 0.25, gesture: 0.25, posture: 0.25,
  },
  E4_READINESS: {
    problemSolutionFit: 0.20, marketOpportunity: 0.15, businessModelViability: 0.15,
    teamCredibility: 0.15, tractionMilestones: 0.15, deliveryPresence: 0.20,
  },
} as const;

/** Compute weighted overall from dimension scores */
export function computeWeightedOverall(
  weights: Record<string, number>,
  scores: Record<string, number>
): number {
  let total = 0;
  for (const [key, weight] of Object.entries(weights)) {
    const score = scores[key] ?? 50;
    total += score * weight;
  }
  return Math.round(total);
}

/**
 * Validate AI scoring consistency.
 * If AI's overall differs >10 from weighted average, use weighted average instead.
 * Logs warnings for any dimension deviating >30 from overall.
 */
export function validateScoreConsistency(
  aiOverall: number,
  weightedOverall: number,
  dimensionScores: Record<string, number>,
  moduleLabel: string
): { validatedOverall: number; warnings: string[] } {
  const warnings: string[] = [];
  let overall = aiOverall;

  if (Math.abs(aiOverall - weightedOverall) > 10) {
    warnings.push(
      `[${moduleLabel}] AI overall (${aiOverall}) differs >10pts from weighted avg (${weightedOverall}). Using weighted avg.`
    );
    overall = weightedOverall;
  }

  for (const [dim, score] of Object.entries(dimensionScores)) {
    if (Math.abs(score - overall) > 30) {
      warnings.push(
        `[${moduleLabel}] ${dim} (${score}) deviates >30pts from overall (${overall}). Consider re-analysis.`
      );
    }
  }

  if (warnings.length > 0) {
    console.warn(`[ScoreValidation] ${warnings.join(' | ')}`);
  }

  return { validatedOverall: overall, warnings };
}

/** Calibration anchor text appended to all system prompts */
const CALIBRATION_ANCHOR = `
SCORING CALIBRATION (use these as reference):
- 90-100 (Exceptional): Among the top 5% I've seen. Investor-ready, minimal changes needed.
- 70-89 (Strong): Solid foundation. Targeted refinements before investor meetings.
- 50-69 (Developing): Shows promise but has significant gaps. Needs coaching.
- 30-49 (Needs Work): Critical gaps in multiple areas. Not investor-ready.
- 0-29 (Beginning): Fundamentals missing. Go back to basics.

FEEDBACK QUALITY RULES:
- Every recommendation MUST reference a specific section, slide, or moment from the input
- Generic advice like "improve your market analysis" is UNACCEPTABLE
- Include concrete examples of what "good" looks like for each weakness
- Prioritize the 3 most impactful changes the founder can make right now
- Each weakness should have a matching actionable recommendation
- Keep recommendations actionable within 1 week`;

// ============================================
// PITCH DECK ANALYSIS (E1)
// ============================================

export interface DeckAnalysisResult {
  problemClarityScore: number;
  solutionClarityScore: number;
  marketOpportunityScore: number;
  businessModelScore: number;
  teamCredibilityScore: number;
  tractionScore: number;
  financialsScore: number;
  askClarityScore: number;
  overallScore: number;
  designConsistencyScore: number;
  readabilityScore: number;
  visualHierarchyScore: number;
  colorSchemeScore: number;
  typographyScore: number;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  tokensUsed?: number;
  modelUsed?: string;
}

export async function analyzePitchDeck(deckContent: string, previousAnalysis?: {
  overallScore: number;
  problemClarityScore?: number;
  solutionClarityScore?: number;
  marketOpportunityScore?: number;
  businessModelScore?: number;
  teamCredibilityScore?: number;
  tractionScore?: number;
  financialsScore?: number;
  askClarityScore?: number;
  strengths?: string[];
  weaknesses?: string[];
  recommendations?: string[];
}): Promise<DeckAnalysisResult> {
  let iterationContext = '';
  if (previousAnalysis) {
    const prevScores = [
      `Overall: ${previousAnalysis.overallScore}/100`,
      previousAnalysis.problemClarityScore != null ? `Problem Clarity: ${previousAnalysis.problemClarityScore}/100` : null,
      previousAnalysis.solutionClarityScore != null ? `Solution Clarity: ${previousAnalysis.solutionClarityScore}/100` : null,
      previousAnalysis.marketOpportunityScore != null ? `Market Opportunity: ${previousAnalysis.marketOpportunityScore}/100` : null,
      previousAnalysis.businessModelScore != null ? `Business Model: ${previousAnalysis.businessModelScore}/100` : null,
      previousAnalysis.teamCredibilityScore != null ? `Team Credibility: ${previousAnalysis.teamCredibilityScore}/100` : null,
      previousAnalysis.tractionScore != null ? `Traction: ${previousAnalysis.tractionScore}/100` : null,
      previousAnalysis.financialsScore != null ? `Financials: ${previousAnalysis.financialsScore}/100` : null,
      previousAnalysis.askClarityScore != null ? `Ask Clarity: ${previousAnalysis.askClarityScore}/100` : null,
    ].filter(Boolean).join('\n');

    const prevFeedback = [
      ...(previousAnalysis.weaknesses || []).map(w => `- Weakness: ${w}`),
      ...(previousAnalysis.recommendations || []).map(r => `- Recommendation: ${r}`),
    ].join('\n');

    iterationContext = `\n\nPREVIOUS ANALYSIS (iteration context — the user previously scored:\n${prevScores}\n\nPrevious feedback given:\n${prevFeedback}\n\nYour task: Evaluate the CURRENT submission independently. If they improved, acknowledge it. If they regressed, flag it. Score the CURRENT quality, not the previous analysis.)\n\n`;
  }

  const systemPrompt = `You are an expert pitch deck consultant with 15+ years of experience helping startups raise funding. You have reviewed over 500 pitch decks and helped startups raise a combined $500M+.

Analyze pitch decks against the 10-slide framework and provide detailed scoring and feedback.

CONTENT SCORING CRITERIA (0-100):
1. Problem Clarity: Is the problem clearly defined, compelling, and relatable? Does it create urgency?
2. Solution Clarity: Is the solution clear, differentiated, and easy to understand? Does it directly address the problem?
3. Market Opportunity: Is TAM/SAM/SOM realistic and attractive? Is there clear market research?
4. Business Model: Is revenue model clear and scalable? Are unit economics favorable?
5. Team Credibility: Does team have relevant domain expertise, experience, and track record?
6. Traction: Is there evidence of product-market fit? Revenue, users, partnerships, growth metrics?
7. Financials: Are projections realistic and well-presented? Is the ask justified?
8. Ask Clarity: Is the funding amount clear? Use of funds specific? Terms reasonable?

VISUAL AUDIT CRITERIA (0-100):
1. Design Consistency: Consistent styling, colors, fonts throughout all slides
2. Readability: Text is easy to read, appropriate font sizes, not too dense
3. Visual Hierarchy: Clear information hierarchy, key points stand out
4. Color Scheme: Professional, on-brand, not distracting, good contrast
5. Typography: Professional font choices, consistent formatting, readable
${CALIBRATION_ANCHOR}
Respond ONLY in valid JSON format without any markdown formatting.`;

  const userPrompt = `${iterationContext}Analyze this pitch deck content thoroughly:

${deckContent}

Provide your analysis as a JSON object with this EXACT structure (no markdown, just pure JSON):
{
  "problemClarityScore": <number 0-100>,
  "solutionClarityScore": <number 0-100>,
  "marketOpportunityScore": <number 0-100>,
  "businessModelScore": <number 0-100>,
  "teamCredibilityScore": <number 0-100>,
  "tractionScore": <number 0-100>,
  "financialsScore": <number 0-100>,
  "askClarityScore": <number 0-100>,
  "overallScore": <number 0-100, weighted average>,
  "designConsistencyScore": <number 0-100>,
  "readabilityScore": <number 0-100>,
  "visualHierarchyScore": <number 0-100>,
  "colorSchemeScore": <number 0-100>,
  "typographyScore": <number 0-100>,
  "strengths": ["<specific strength 1>", "<specific strength 2>", "<specific strength 3>"],
  "weaknesses": ["<specific weakness 1>", "<specific weakness 2>", "<specific weakness 3>"],
  "recommendations": ["<specific actionable recommendation 1>", "<specific actionable recommendation 2>", "<specific actionable recommendation 3>", "<specific actionable recommendation 4>", "<specific actionable recommendation 5>"]
}`;

  const { response, modelUsed } = await executeWithFallback('E1_DECK_CONTENT', (model) => ({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: MODULE_MODEL_MAP.E1_DECK_CONTENT.temperature,
  }));

  const content = response.choices?.[0]?.message?.content;
  if (!content) throw new Error('No response from AI');

  const parsed = parseJsonResponse<Record<string, unknown>>(content);
  const result: DeckAnalysisResult = {
    problemClarityScore: clampScore(parsed.problemClarityScore),
    solutionClarityScore: clampScore(parsed.solutionClarityScore),
    marketOpportunityScore: clampScore(parsed.marketOpportunityScore),
    businessModelScore: clampScore(parsed.businessModelScore),
    teamCredibilityScore: clampScore(parsed.teamCredibilityScore),
    tractionScore: clampScore(parsed.tractionScore),
    financialsScore: clampScore(parsed.financialsScore),
    askClarityScore: clampScore(parsed.askClarityScore),
    overallScore: clampScore(parsed.overallScore),
    designConsistencyScore: clampScore(parsed.designConsistencyScore),
    readabilityScore: clampScore(parsed.readabilityScore),
    visualHierarchyScore: clampScore(parsed.visualHierarchyScore),
    colorSchemeScore: clampScore(parsed.colorSchemeScore),
    typographyScore: clampScore(parsed.typographyScore),
    strengths: validateStringArray(parsed.strengths),
    weaknesses: validateStringArray(parsed.weaknesses),
    recommendations: validateStringArray(parsed.recommendations),
    tokensUsed: response.usage?.totalTokens,
    modelUsed,
  };

  // Quality validation: cross-check overall score against weighted average
  const contentWeighted = computeWeightedOverall(SCORING_WEIGHTS.E1_CONTENT, {
    problemClarity: result.problemClarityScore, solutionClarity: result.solutionClarityScore,
    marketOpportunity: result.marketOpportunityScore, businessModel: result.businessModelScore,
    teamCredibility: result.teamCredibilityScore, traction: result.tractionScore,
    financials: result.financialsScore, askClarity: result.askClarityScore,
  });
  const { validatedOverall } = validateScoreConsistency(
    result.overallScore, contentWeighted,
    { problemClarity: result.problemClarityScore, solutionClarity: result.solutionClarityScore,
      marketOpportunity: result.marketOpportunityScore, businessModel: result.businessModelScore,
      teamCredibility: result.teamCredibilityScore, traction: result.tractionScore,
      financials: result.financialsScore, askClarity: result.askClarityScore },
    'E1_DECK'
  );
  result.overallScore = validatedOverall;

  return result;
}

// ============================================
// DECK VISUAL AUDIT (E1 — Vision Model)
// ============================================

interface VisualAuditResult {
  designConsistencyScore: number;
  readabilityScore: number;
  visualHierarchyScore: number;
  colorSchemeScore: number;
  typographyScore: number;
  visualStrengths: string[];
  visualWeaknesses: string[];
  visualRecommendations: string[];
}

/**
 * Analyze a pitch deck's visual design using the vision model (glm-4.6v).
 * The vision model actually "sees" the slide images, unlike the text-only analysis.
 *
 * @param fileUrl - Public URL to the uploaded deck file (PDF/PPTX blob URL)
 * @returns Visual audit scores and feedback, or null if vision analysis fails
 */
export async function analyzeDeckVisual(fileUrl: string): Promise<VisualAuditResult | null> {
  try {
    const systemPrompt = `You are an expert presentation design consultant. Analyze the visual design quality of this pitch deck.

Score each criterion from 0-100:
1. Design Consistency: Consistent styling, colors, fonts, spacing across all slides
2. Readability: Text is easy to read, appropriate font sizes, not too dense, good line spacing
3. Visual Hierarchy: Clear information hierarchy, key points stand out, proper use of headers/subheaders
4. Color Scheme: Professional palette, good contrast, on-brand, not distracting
5. Typography: Professional font choices, consistent formatting, good text-image balance

Respond ONLY in valid JSON format:
{
  "designConsistencyScore": <number 0-100>,
  "readabilityScore": <number 0-100>,
  "visualHierarchyScore": <number 0-100>,
  "colorSchemeScore": <number 0-100>,
  "typographyScore": <number 0-100>,
  "visualStrengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "visualWeaknesses": ["<weakness 1>", "<weakness 2>", "<weakness 3>"],
  "visualRecommendations": ["<recommendation 1>", "<recommendation 2>", "<recommendation 3>"]
}`;

    const userPrompt = `Analyze the visual design of this pitch deck. Focus on slide layout, typography, color usage, and overall design professionalism.

Provide your analysis as a JSON object (no markdown formatting).`;

    const { response, modelUsed } = await executeWithFallback('E1_DECK_VISUAL', (model) => ({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: userPrompt },
            { type: 'image_url', image_url: { url: fileUrl } },
          ],
        },
      ],
      temperature: MODULE_MODEL_MAP.E1_DECK_VISUAL.temperature,
    }));

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      console.warn('[E1 Visual] No response content from vision model');
      return null;
    }

    const parsed = parseJsonResponse<Record<string, unknown>>(content);
    const result: VisualAuditResult = {
      designConsistencyScore: clampScore(parsed.designConsistencyScore),
      readabilityScore: clampScore(parsed.readabilityScore),
      visualHierarchyScore: clampScore(parsed.visualHierarchyScore),
      colorSchemeScore: clampScore(parsed.colorSchemeScore),
      typographyScore: clampScore(parsed.typographyScore),
      visualStrengths: validateStringArray(parsed.visualStrengths),
      visualWeaknesses: validateStringArray(parsed.visualWeaknesses),
      visualRecommendations: validateStringArray(parsed.visualRecommendations),
    };

    console.warn(`[E1 Visual] Vision audit complete via ${modelUsed}`);
    return result;
  } catch (error: any) {
    // Graceful degradation — visual audit is additive, not blocking
    console.warn('[E1 Visual] Vision analysis failed, falling back to content-only scores:', error?.message);
    return null;
  }
}

// ============================================
// SCRIPT ANALYSIS (E2)
// ============================================

export interface ScriptAnalysisResult {
  hookScore: number;
  problemScore: number;
  solutionScore: number;
  credibilityScore: number;
  ctaScore: number;
  overallScore: number;
  wordCount: number;
  estimatedDuration: number;
  improvements: { hook: string[]; problem: string[]; solution: string[]; credibility: string[]; cta: string[] };
  rewrittenScript: string;
  alternativeHooks: string[];
  tokensUsed?: number;
  modelUsed?: string;
}

export async function analyzePitchScript(
  scriptText: string,
  targetAudience?: string,
  targetDuration?: number,
  previousAnalysis?: {
    overallScore: number;
    hookScore?: number;
    problemScore?: number;
    solutionScore?: number;
    credibilityScore?: number;
    ctaScore?: number;
    weaknesses?: string[];
    improvements?: Record<string, string[]>;
  }
): Promise<ScriptAnalysisResult> {
  let iterationContext = '';
  if (previousAnalysis) {
    const prevScores = [
      `Overall: ${previousAnalysis.overallScore}/100`,
      previousAnalysis.hookScore != null ? `Hook: ${previousAnalysis.hookScore}/100` : null,
      previousAnalysis.problemScore != null ? `Problem: ${previousAnalysis.problemScore}/100` : null,
      previousAnalysis.solutionScore != null ? `Solution: ${previousAnalysis.solutionScore}/100` : null,
      previousAnalysis.credibilityScore != null ? `Credibility: ${previousAnalysis.credibilityScore}/100` : null,
      previousAnalysis.ctaScore != null ? `CTA: ${previousAnalysis.ctaScore}/100` : null,
    ].filter(Boolean).join('\n');

    const prevImprovements = previousAnalysis.improvements
      ? Object.values(previousAnalysis.improvements).flat().map(i => `- ${i}`).join('\n')
      : '';

    iterationContext = `\n\nPREVIOUS ANALYSIS (iteration context):\n${prevScores}\n\nPrevious improvements suggested:\n${prevImprovements}\n\nEvaluate the CURRENT script independently. Acknowledge improvements or regressions.\n\n`;
  }

  const systemPrompt = `You are an expert pitch coach specializing in elevator pitches with 20+ years of experience. You have coached founders from Y Combinator, Techstars, and 500 Startups.

Analyze scripts using the 5-Element Elevator Pitch Framework:

1. HOOK (0-100): Opens with something that grabs attention immediately (first 5 seconds)
2. PROBLEM (0-100): Clear, specific, relatable problem statement with concrete examples
3. SOLUTION (0-100): Concise description that differentiates from alternatives
4. CREDIBILITY (0-100): Demonstrates relevant expertise or traction
5. CALL-TO-ACTION (0-100): Clear, specific ask with urgency
${CALIBRATION_ANCHOR}
Respond ONLY in valid JSON format without any markdown formatting.`;

  const audienceContext = targetAudience ? `Target audience: ${targetAudience}` : 'Target audience: investors (seed stage)';
  const durationContext = targetDuration ? `Target duration: ${targetDuration} seconds` : 'Target duration: 60 seconds (typical elevator pitch)';

  const userPrompt = `${iterationContext}Analyze this elevator pitch script:

"""
${scriptText}
"""

${audienceContext}
${durationContext}

Provide your analysis as a JSON object with this EXACT structure (no markdown, just pure JSON):
{
  "hookScore": <number 0-100>,
  "problemScore": <number 0-100>,
  "solutionScore": <number 0-100>,
  "credibilityScore": <number 0-100>,
  "ctaScore": <number 0-100>,
  "overallScore": <number 0-100, weighted average>,
  "wordCount": <number>,
  "estimatedDuration": <number in seconds>,
  "improvements": {
    "hook": ["<specific improvement suggestion 1>", "<specific improvement suggestion 2>"],
    "problem": ["<specific improvement suggestion 1>", "<specific improvement suggestion 2>"],
    "solution": ["<specific improvement suggestion 1>", "<specific improvement suggestion 2>"],
    "credibility": ["<specific improvement suggestion 1>", "<specific improvement suggestion 2>"],
    "cta": ["<specific improvement suggestion 1>", "<specific improvement suggestion 2>"]
  },
  "rewrittenScript": "<your improved version of the script>",
  "alternativeHooks": ["<alternative opening hook 1>", "<alternative opening hook 2>", "<alternative opening hook 3>"]
}`;

  const { response, modelUsed } = await executeWithFallback('E2_SCRIPT_ANALYSIS', (model) => ({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: MODULE_MODEL_MAP.E2_SCRIPT_ANALYSIS.temperature,
  }));

  const content = response.choices?.[0]?.message?.content;
  if (!content) throw new Error('No response from AI');

  const parsed = parseJsonResponse<Record<string, unknown>>(content);
  const improvements = (parsed.improvements && typeof parsed.improvements === 'object' && !Array.isArray(parsed.improvements))
    ? parsed.improvements as Record<string, unknown> : {};
  const result: ScriptAnalysisResult = {
    hookScore: clampScore(parsed.hookScore),
    problemScore: clampScore(parsed.problemScore),
    solutionScore: clampScore(parsed.solutionScore),
    credibilityScore: clampScore(parsed.credibilityScore),
    ctaScore: clampScore(parsed.ctaScore),
    overallScore: clampScore(parsed.overallScore),
    wordCount: 0,
    estimatedDuration: 0,
    improvements: {
      hook: validateStringArray(improvements.hook),
      problem: validateStringArray(improvements.problem),
      solution: validateStringArray(improvements.solution),
      credibility: validateStringArray(improvements.credibility),
      cta: validateStringArray(improvements.cta),
    },
    rewrittenScript: typeof parsed.rewrittenScript === 'string' ? parsed.rewrittenScript : '',
    alternativeHooks: validateStringArray(parsed.alternativeHooks),
    tokensUsed: response.usage?.totalTokens,
    modelUsed,
  };
  result.wordCount = scriptText.split(/\s+/).filter(Boolean).length;
  result.estimatedDuration = Math.round(result.wordCount / 2.5);

  // Quality validation for E2
  const e2Weighted = computeWeightedOverall(SCORING_WEIGHTS.E2_ELEMENTS, {
    hook: result.hookScore, problem: result.problemScore, solution: result.solutionScore,
    credibility: result.credibilityScore, cta: result.ctaScore,
  });
  const { validatedOverall: e2Overall } = validateScoreConsistency(
    result.overallScore, e2Weighted,
    { hook: result.hookScore, problem: result.problemScore, solution: result.solutionScore,
      credibility: result.credibilityScore, cta: result.ctaScore },
    'E2_SCRIPT'
  );
  result.overallScore = e2Overall;

  return result;
}

// ============================================
// VIDEO ANALYSIS (E3) - Short videos <3 min
// ============================================

export interface VideoAnalysisResult {
  paceScore: number;
  clarityScore: number;
  fillerWordScore: number;
  energyScore: number;
  confidenceScore: number;
  overallDeliveryScore: number;
  eyeContactScore: number;
  facialExpressionScore: number;
  gestureScore: number;
  postureScore: number;
  overallBodyLanguageScore: number;
  wordsPerMinute: number;
  fillerWordCount: number;
  fillerWords: Record<string, number>;
  deliveryFeedback: string;
  bodyLanguageFeedback: string;
  keyMoments: Array<{ timestamp: string; description: string; type: 'positive' | 'improvement' }>;
  transcript: string;
  tokensUsed?: number;
  modelUsed?: string;
}

export async function analyzePitchVideo(
  videoUrl: string,
  duration: number
): Promise<VideoAnalysisResult> {
  const systemPrompt = `You are an expert public speaking and presentation coach with expertise in analyzing video recordings of pitches. You have trained executives at Fortune 500 companies and coached TED speakers.

Analyze the video for DELIVERY and BODY LANGUAGE:

DELIVERY CRITERIA (0-100):
1. Pace: Speaking pace appropriate? Ideal: 150-180 WPM
2. Clarity: Speech clear and articulate? Good enunciation?
3. Filler Words: Minimized "um", "uh", "like", "you know", "so", "basically"
4. Energy: Appropriate enthusiasm and passion? Engaging?
5. Confidence: Speaker sounds confident and authoritative?

BODY LANGUAGE CRITERIA (0-100):
1. Eye Contact: Looking at camera/audience, not reading notes
2. Facial Expressions: Engaging, appropriate emotions
3. Gestures: Natural, purposeful hand movements
4. Posture: Open, upright, confident stance

Identify KEY MOMENTS with timestamps.
Provide the full transcript.
Respond ONLY in valid JSON format without any markdown formatting.`;

  const userPrompt = `Analyze this elevator pitch video recording.

Video URL: ${videoUrl}
Duration: ${duration} seconds

Provide your analysis as a JSON object with this EXACT structure (no markdown, just pure JSON):
{
  "paceScore": <number 0-100>,
  "clarityScore": <number 0-100>,
  "fillerWordScore": <number 0-100, higher = fewer filler words>,
  "energyScore": <number 0-100>,
  "confidenceScore": <number 0-100>,
  "overallDeliveryScore": <number 0-100>,
  "eyeContactScore": <number 0-100>,
  "facialExpressionScore": <number 0-100>,
  "gestureScore": <number 0-100>,
  "postureScore": <number 0-100>,
  "overallBodyLanguageScore": <number 0-100>,
  "wordsPerMinute": <number>,
  "fillerWordCount": <total number of filler words>,
  "fillerWords": {"um": <count>, "uh": <count>, "like": <count>, "you know": <count>},
  "deliveryFeedback": "<detailed paragraph>",
  "bodyLanguageFeedback": "<detailed paragraph>",
  "keyMoments": [
    {"timestamp": "0:15", "description": "<what happened>", "type": "positive"},
    {"timestamp": "0:32", "description": "<what happened>", "type": "improvement"}
  ],
  "transcript": "<full transcript of what was said>"
}`;

  const { response, modelUsed } = await executeWithFallback('E3_LIVE_PITCH', (model) => ({
    model,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: systemPrompt },
        { type: 'text', text: userPrompt },
        { type: 'video_url', video_url: { url: videoUrl } },
      ],
    }],
    temperature: MODULE_MODEL_MAP.E3_LIVE_PITCH.temperature,
  }));

  const content = response.choices?.[0]?.message?.content;
  if (!content) throw new Error('No response from AI');

  const parsed = parseJsonResponse<Record<string, unknown>>(content);
  const result: VideoAnalysisResult = {
    paceScore: clampScore(parsed.paceScore),
    clarityScore: clampScore(parsed.clarityScore),
    fillerWordScore: clampScore(parsed.fillerWordScore),
    energyScore: clampScore(parsed.energyScore),
    confidenceScore: clampScore(parsed.confidenceScore),
    overallDeliveryScore: clampScore(parsed.overallDeliveryScore),
    eyeContactScore: clampScore(parsed.eyeContactScore),
    facialExpressionScore: clampScore(parsed.facialExpressionScore),
    gestureScore: clampScore(parsed.gestureScore),
    postureScore: clampScore(parsed.postureScore),
    overallBodyLanguageScore: clampScore(parsed.overallBodyLanguageScore),
    wordsPerMinute: Math.max(0, Math.round(typeof parsed.wordsPerMinute === 'number' ? parsed.wordsPerMinute : 150)),
    fillerWordCount: Math.max(0, Math.round(typeof parsed.fillerWordCount === 'number' ? parsed.fillerWordCount : 0)),
    fillerWords: (parsed.fillerWords && typeof parsed.fillerWords === 'object' && !Array.isArray(parsed.fillerWords))
      ? Object.fromEntries(Object.entries(parsed.fillerWords as Record<string, unknown>).map(([k, v]) => [k, Math.max(0, Number(v) || 0)])) : {},
    deliveryFeedback: typeof parsed.deliveryFeedback === 'string' ? parsed.deliveryFeedback : '',
    bodyLanguageFeedback: typeof parsed.bodyLanguageFeedback === 'string' ? parsed.bodyLanguageFeedback : '',
    keyMoments: Array.isArray(parsed.keyMoments) ? parsed.keyMoments.map((m: any) => ({
      timestamp: String(m?.timestamp ?? ''),
      description: String(m?.description ?? ''),
      type: m?.type === 'positive' ? 'positive' as const : 'improvement' as const,
    })) : [],
    transcript: typeof parsed.transcript === 'string' ? parsed.transcript : '',
    tokensUsed: response.usage?.totalTokens,
    modelUsed,
  };
  return result;
}

// ============================================
// FULL PITCH SESSION ANALYSIS (E4) - Long videos
// ============================================

export interface FullPitchAnalysisResult {
  problemSolutionFit: number;
  marketOpportunity: number;
  businessModelViability: number;
  teamCredibility: number;
  tractionMilestones: number;
  deliveryPresence: number;
  overallReadinessScore: number;
  investorReadinessLevel: 'NOT_READY' | 'NEEDS_WORK' | 'INVESTOR_READY' | 'HIGHLY_PREPARED';
  contentScores: {
    problemClarity: number;
    solutionDifferentiation: number;
    marketSizing: number;
    competitivePositioning: number;
    businessModel: number;
    financialProjections: number;
    teamPresentation: number;
    tractionEvidence: number;
    askClarity: number;
  };
  deliveryScores: {
    pace: number;
    clarity: number;
    confidence: number;
    engagement: number;
    handlingQuestions: number;
  };
  strengths: string[];
  weaknesses: string[];
  investorConcerns: string[];
  recommendedActions: string[];
  anticipatedQuestions: Array<{ question: string; suggestedAnswer: string; difficulty: 'easy' | 'medium' | 'hard' }>;
  competitiveAnalysis: { percentileVsPeers: number; standoutElements: string[]; commonMistakes: string[] };
  transcript: string;
  tokensUsed?: number;
  modelUsed?: string;
}

export async function analyzeFullPitchSession(
  videoUrl: string,
  duration: number,
  deckAnalysis?: DeckAnalysisResult
): Promise<FullPitchAnalysisResult> {
  const systemPrompt = `You are a senior investment analyst and pitch consultant with 20+ years of experience at top VC firms (Sequoia, Andreessen Horowitz, Greylock). You have evaluated over 10,000 pitches.

6-DIMENSION INVESTOR READINESS FRAMEWORK (0-100):
1. PROBLEM-SOLUTION FIT: Real problem? Direct solution? Product-market fit evidence?
2. MARKET OPPORTUNITY: Realistic TAM/SAM/SOM? Growing market? Beachhead strategy?
3. BUSINESS MODEL VIABILITY: Scalable revenue? Favorable unit economics? Path to profitability?
4. TEAM CREDIBILITY: Domain expertise? Track record? Key role coverage?
5. TRACTION & MILESTONES: Revenue/users/growth? Partnerships? Product progress?
6. DELIVERY & PRESENCE: Engaging? Confident? Visuals support narrative?

INVESTOR READINESS LEVELS:
- NOT_READY (0-40), NEEDS_WORK (41-60), INVESTOR_READY (61-80), HIGHLY_PREPARED (81-100)

Anticipate investor Q&A questions with suggested answers.
Respond ONLY in valid JSON format without any markdown formatting.`;

  const deckContext = deckAnalysis
    ? `\n\nPITCH DECK ANALYSIS: Score ${deckAnalysis.overallScore}/100 | Strengths: ${deckAnalysis.strengths.join(', ')} | Weaknesses: ${deckAnalysis.weaknesses.join(', ')}`
    : '';

  const userPrompt = `Analyze this full investor pitch.

Video URL: ${videoUrl}
Duration: ${Math.floor(duration / 60)}m ${duration % 60}s
${deckContext}

JSON structure (no markdown):
{
  "problemSolutionFit": <0-100>, "marketOpportunity": <0-100>, "businessModelViability": <0-100>,
  "teamCredibility": <0-100>, "tractionMilestones": <0-100>, "deliveryPresence": <0-100>,
  "overallReadinessScore": <0-100>,
  "investorReadinessLevel": "<NOT_READY|NEEDS_WORK|INVESTOR_READY|HIGHLY_PREPARED>",
  "contentScores": { "problemClarity": <0-100>, "solutionDifferentiation": <0-100>, "marketSizing": <0-100>, "competitivePositioning": <0-100>, "businessModel": <0-100>, "financialProjections": <0-100>, "teamPresentation": <0-100>, "tractionEvidence": <0-100>, "askClarity": <0-100> },
  "deliveryScores": { "pace": <0-100>, "clarity": <0-100>, "confidence": <0-100>, "engagement": <0-100>, "handlingQuestions": <0-100> },
  "strengths": ["<s1>", "<s2>", "<s3>", "<s4>", "<s5>"], "weaknesses": ["<w1>", "<w2>", "<w3>"],
  "investorConcerns": ["<c1>", "<c2>", "<c3>"], "recommendedActions": ["<a1>", "<a2>", "<a3>", "<a4>", "<a5>"],
  "anticipatedQuestions": [{"question": "<q>", "suggestedAnswer": "<a>", "difficulty": "easy|medium|hard"}],
  "competitiveAnalysis": { "percentileVsPeers": <0-100>, "standoutElements": ["<e>"], "commonMistakes": ["<m>"] },
  "transcript": "<full transcript>"
}`;

  const { response, modelUsed } = await executeWithFallback('E4_FULL_SESSION', (model) => ({
    model,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: systemPrompt },
        { type: 'text', text: userPrompt },
        { type: 'video_url', video_url: { url: videoUrl } },
      ],
    }],
    temperature: MODULE_MODEL_MAP.E4_FULL_SESSION.temperature,
  }));

  const content = response.choices?.[0]?.message?.content;
  if (!content) throw new Error('No response from AI');

  const parsed = parseJsonResponse<Record<string, unknown>>(content);
  const rawContentScores = (parsed.contentScores && typeof parsed.contentScores === 'object' && !Array.isArray(parsed.contentScores))
    ? parsed.contentScores as Record<string, unknown> : {};
  const rawDeliveryScores = (parsed.deliveryScores && typeof parsed.deliveryScores === 'object' && !Array.isArray(parsed.deliveryScores))
    ? parsed.deliveryScores as Record<string, unknown> : {};
  const rawCompetitive = (parsed.competitiveAnalysis && typeof parsed.competitiveAnalysis === 'object' && !Array.isArray(parsed.competitiveAnalysis))
    ? parsed.competitiveAnalysis as Record<string, unknown> : {};
  const validReadinessLevels = ['NOT_READY', 'NEEDS_WORK', 'INVESTOR_READY', 'HIGHLY_PREPARED'] as const;
  const rawLevel = typeof parsed.investorReadinessLevel === 'string' ? parsed.investorReadinessLevel.toUpperCase() : '';
  const result: FullPitchAnalysisResult = {
    problemSolutionFit: clampScore(parsed.problemSolutionFit),
    marketOpportunity: clampScore(parsed.marketOpportunity),
    businessModelViability: clampScore(parsed.businessModelViability),
    teamCredibility: clampScore(parsed.teamCredibility),
    tractionMilestones: clampScore(parsed.tractionMilestones),
    deliveryPresence: clampScore(parsed.deliveryPresence),
    overallReadinessScore: clampScore(parsed.overallReadinessScore),
    investorReadinessLevel: validReadinessLevels.includes(rawLevel as any) ? rawLevel as any : 'NEEDS_WORK',
    contentScores: {
      problemClarity: clampScore(rawContentScores.problemClarity),
      solutionDifferentiation: clampScore(rawContentScores.solutionDifferentiation),
      marketSizing: clampScore(rawContentScores.marketSizing),
      competitivePositioning: clampScore(rawContentScores.competitivePositioning),
      businessModel: clampScore(rawContentScores.businessModel),
      financialProjections: clampScore(rawContentScores.financialProjections),
      teamPresentation: clampScore(rawContentScores.teamPresentation),
      tractionEvidence: clampScore(rawContentScores.tractionEvidence),
      askClarity: clampScore(rawContentScores.askClarity),
    },
    deliveryScores: {
      pace: clampScore(rawDeliveryScores.pace),
      clarity: clampScore(rawDeliveryScores.clarity),
      confidence: clampScore(rawDeliveryScores.confidence),
      engagement: clampScore(rawDeliveryScores.engagement),
      handlingQuestions: clampScore(rawDeliveryScores.handlingQuestions),
    },
    strengths: validateStringArray(parsed.strengths),
    weaknesses: validateStringArray(parsed.weaknesses),
    investorConcerns: validateStringArray(parsed.investorConcerns),
    recommendedActions: validateStringArray(parsed.recommendedActions),
    anticipatedQuestions: Array.isArray(parsed.anticipatedQuestions)
      ? (parsed.anticipatedQuestions as any[]).map((q: any) => ({
          question: String(q?.question ?? ''),
          suggestedAnswer: String(q?.suggestedAnswer ?? ''),
          difficulty: q?.difficulty === 'easy' ? 'easy' as const : q?.difficulty === 'hard' ? 'hard' as const : 'medium' as const,
        }))
      : [],
    competitiveAnalysis: {
      percentileVsPeers: clampScore(rawCompetitive.percentileVsPeers),
      standoutElements: validateStringArray(rawCompetitive.standoutElements),
      commonMistakes: validateStringArray(rawCompetitive.commonMistakes),
    },
    transcript: typeof parsed.transcript === 'string' ? parsed.transcript : '',
    tokensUsed: response.usage?.totalTokens,
    modelUsed,
  };
  return result;
}

// ============================================
// CONFIG STATUS (for health check diagnostics)
// ============================================

export function getZaiConfigStatus(): {
  configCreated: boolean;
  hasToken: boolean;
  hasApiKey: boolean;
  configSource: string;
} {
  // Check if config was successfully created
  if (!configCreated) {
    return { configCreated: false, hasToken: false, hasApiKey: false, configSource: 'none' };
  }

  // Try to read the current config from the written location
  let hasToken = false;
  let hasApiKey = false;
  let configSource = 'none';

  const checkPaths = [
    join(process.cwd(), '.z-ai-config'),
    join(homedir(), '.z-ai-config'),
    '/etc/.z-ai-config',
  ];

  for (const p of checkPaths) {
    try {
      const raw = readFileSync(p, 'utf-8');
      const cfg = JSON.parse(raw);
      configSource = p;
      hasToken = !!cfg.token;
      hasApiKey = !!cfg.apiKey;
      break;
    } catch {
      /* not found, continue */
    }
  }

  return { configCreated: true, hasToken, hasApiKey, configSource };
}

// ============================================
// HEALTH CHECK
// ============================================

export async function checkAIServiceHealth(): Promise<{
  status: string;
  models: string[];
  gatewayRouting: { text: string; vision: string };
  moduleMapping: Array<{ module: string; models: string[]; temperature: number; thinkingEnabled: boolean; method: string }>;
  configFound: boolean;
  configStatus: ReturnType<typeof getZaiConfigStatus>;
  zai?: { status: string; message?: string };
}> {
  const results = { zai: { status: 'unknown' as string, message: '' as string } };
  let resolvedTextModel = 'unknown';
  let resolvedVisionModel = 'unknown';

  try {
    const zai = await getZai();
    // Test text endpoint
    const textResp = await zai.chat.completions.create({
      model: AI_MODELS.PRIMARY_TEXT,
      messages: [{ role: 'user', content: 'Say "ok"' }],
    });
    resolvedTextModel = textResp.model || 'unknown';
    const content = textResp.choices?.[0]?.message?.content;
    if (content?.toLowerCase().includes('ok')) {
      results.zai = { status: 'healthy', message: `${resolvedTextModel} responding` };
    } else {
      results.zai = { status: 'degraded', message: `Unexpected: ${content}` };
    }
  } catch (error) {
    results.zai = { status: 'unhealthy', message: error instanceof Error ? error.message : 'Unknown' };
  }

  return {
    status: results.zai.status === 'healthy' ? 'healthy' : 'unhealthy',
    models: Object.values(AI_MODELS),
    gatewayRouting: { text: resolvedTextModel, vision: resolvedVisionModel },
    moduleMapping: Object.entries(MODULE_MODEL_MAP).map(([key, val]) => ({
      module: key,
      models: [...val.models],
      temperature: val.temperature,
      thinkingEnabled: !!(val as any).thinkingEnabled,
      method: val.method,
    })),
    configFound: true,
    configStatus: getZaiConfigStatus(),
    zai: results.zai,
  };
}

// ============================================
// COACHING DRILLS GENERATION
// ============================================
// Generates personalized coaching drills targeting a founder's weakest dimensions.

export interface CoachingDrill {
  title: string;
  description: string;
  targetDimension: string;
  currentScore: number;
  targetScore: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: string;
  steps: string[];
}

export async function generateCoachingDrills(
  moduleType: 'deck' | 'script' | 'live' | 'full',
  scores: Record<string, number>,
  weaknesses: string[],
  strengths: string[],
): Promise<CoachingDrill[]> {
  const moduleLabels: Record<string, string> = {
    deck: 'pitch deck',
    script: 'elevator pitch script',
    live: 'live elevator pitch',
    full: 'full investor pitch session',
  };

  const systemPrompt = `You are a pitch coach who designs targeted, actionable exercises for startup founders. You create drills that are specific, time-boxed, and produce measurable improvement.

Generate 3-5 coaching drills targeting the founder's weakest areas. Each drill should:
- Target ONE specific dimension
- Be completable in the stated time
- Have 3-5 concrete, actionable steps
- Include what "success" looks like

Respond ONLY in valid JSON format.`;

  const sortedDimensions = Object.entries(scores)
    .sort(([, a], [, b]) => a - b)
    .slice(0, 5);

  const userPrompt = `A founder just completed a ${moduleLabels[moduleType]} analysis. Here are their results:

SCORES:
${sortedDimensions.map(([dim, score]) => `- ${dim}: ${score}/100`).join('\n')}

STRENGTHS:
${strengths.map(s => `- ${s}`).join('\n')}

WEAKNESSES:
${weaknesses.map(w => `- ${w}`).join('\n')}

Design 3-5 coaching drills targeting the weakest dimensions. Return JSON:
{
  "drills": [
    {
      "title": "<drill title>",
      "description": "<1-2 sentence description>",
      "targetDimension": "<dimension name>",
      "currentScore": <number>,
      "targetScore": <number, realistic improvement target>,
      "difficulty": "<beginner|intermediate|advanced>",
      "estimatedTime": "<e.g. '30 minutes'>",
      "steps": ["<step 1>", "<step 2>", "<step 3>"]
    }
  ]
}`;

  const { response } = await executeWithFallback('COACHING_DRILL_GEN', (model) => ({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: MODULE_MODEL_MAP.COACHING_DRILL_GEN.temperature,
  }));

  const content = response.choices?.[0]?.message?.content;
  if (!content) throw new Error('No response from AI');

  const parsed = parseJsonResponse<{ drills: CoachingDrill[] }>(content);
  return parsed.drills || [];
}
