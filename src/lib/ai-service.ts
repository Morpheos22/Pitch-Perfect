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
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { extractJsonFromContent, clampScore, validateStringArray, repairJson, parseJsonResponse, validateSchema } from './ai-utils';
import { isHostAllowed, ALLOWED_UPLOAD_HOSTS } from './storage';

// ============================================
// DIRECT HTTP FALLBACK CONFIGURATION
// ============================================
// Bypass the SDK entirely and call the Z.ai gateway via standard fetch.
// This ensures AI works even if the SDK has initialization/auth issues.
//
// REQUIRED: ZAI_API_KEY (your API Key from the Z.ai platform)
// OPTIONAL: ZAI_TOKEN  (secondary X-Token header, not needed for most setups)
// OPTIONAL: ZAI_USER_ID (maps to your API ID from the Z.ai platform)

// ═══════════════════════════════════════════════════════════════════════
// GATEWAY CREDENTIAL RESOLUTION
// ═══════════════════════════════════════════════════════════════════════
// Priority: env vars > .z-ai-config file
// ZAI_BASE_URL is REQUIRED — there is no safe default since internal IPs
// (like 172.25.136.193) are unreachable from Vercel serverless. If unset,
// the gateway will fail with a clear error rather than silently timing out.

const DEFAULT_GATEWAY_URL = process.env.ZAI_BASE_URL || '';

type ResolvedConfig = {
  baseUrl: string;
  apiKey: string;
  token: string;
  userId: string;
  chatId: string;
  source: string;
};

let _resolvedConfig: ResolvedConfig | null = null;
let _lastEnvSnapshot = '';

/**
 * Resolve gateway credentials from env vars (primary) + config file (secondary).
 *
 * REFACTORED: Replaced synchronous readFileSync with cached resolution.
 * The .z-ai-config file is only read ONCE per cold start (when cache is empty)
 * or when env vars change. This avoids blocking the event loop with sync I/O
 * on every request — critical for Vercel serverless performance.
 *
 * Priority: env vars > .z-ai-config file > hardcoded defaults
 */
function getResolvedConfig(): ResolvedConfig {
  // ── Cache: reuse if env vars haven't changed since last resolution ──
  const currentEnvSnapshot = [
    process.env.ZAI_BASE_URL || '',
    process.env.ZAI_API_KEY || '',
    process.env.ZAI_TOKEN || '',
    process.env.ZAI_USER_ID || '',
    process.env.ZAI_CHAT_ID || '',
  ].join('|');

  if (_resolvedConfig && _lastEnvSnapshot === currentEnvSnapshot) {
    return _resolvedConfig;
  }

  _lastEnvSnapshot = currentEnvSnapshot;

  // Resolve from env vars first — this is the primary path on Vercel
  const hasEnvVars = !!(process.env.ZAI_API_KEY || process.env.ZAI_TOKEN);

  // Try to augment from .z-ai-config file if env vars are incomplete
  // NOTE: File reads happen only when cache is cold or env vars changed.
  // This is a one-time cost per cold start, not per request.
  let fileConfig: Record<string, string | undefined> = {};
  let configSource = 'env';

  if (!hasEnvVars) {
    // Only read from disk if env vars are missing — avoid unnecessary I/O
    const readPaths = [
      join(process.cwd(), '.z-ai-config'),
      join(homedir(), '.z-ai-config'),
      '/etc/.z-ai-config',
    ];

    for (const p of readPaths) {
      try {
        // readFileSync is imported at the top of the file.
        // This only runs once per cold start (when cache is empty and
        // env vars are missing), not per request.
        const raw = readFileSync(p, 'utf-8');
        fileConfig = JSON.parse(raw);
        configSource = p;
        break;
      } catch {
        /* not found, continue */
      }
    }
  }

  const resolved: ResolvedConfig = {
    baseUrl: process.env.ZAI_BASE_URL || fileConfig.baseUrl || DEFAULT_GATEWAY_URL,
    apiKey: process.env.ZAI_API_KEY || fileConfig.apiKey || '',
    token: process.env.ZAI_TOKEN || fileConfig.token || '',
    userId: process.env.ZAI_USER_ID || fileConfig.userId || '',
    chatId: process.env.ZAI_CHAT_ID || fileConfig.chatId || '',
    source: configSource,
  };

  _resolvedConfig = resolved;
  return resolved;
}

// NOTE: Gateway credentials are resolved LIVE on each call via getResolvedConfig().
// Previous implementation used module-level constants that were frozen at import time,
// causing stale credentials if env vars rotated at runtime. Now every function
// re-resolves the config to ensure fresh credentials.

/** Whether we have minimum credentials for direct HTTP calls */
function hasDirectCredentials(): boolean {
  return !!(process.env.ZAI_API_KEY || process.env.ZAI_TOKEN);
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

  // Resolve credentials LIVE — never use stale module-level constants
  const config = getResolvedConfig();

  if (!config.baseUrl) {
    throw new Error('ZAI_BASE_URL not set — cannot reach Z.ai gateway. Set ZAI_BASE_URL env var to your gateway URL.');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Z-AI-From': 'Z',
  };
  // Auth: X-Token is the PRIMARY auth header for Z.ai gateway.
  // The gateway uses X-Token (not Bearer) for authentication.
  // ZAI_TOKEN is the dedicated token; fall back to ZAI_API_KEY if not set.
  const authToken = config.token || config.apiKey;
  if (authToken) {
    headers['X-Token'] = authToken;
  }
  // Also send API key as Bearer for backward compatibility
  if (config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey}`;
  }
  // User ID for request attribution and session tracking
  if (config.userId) headers['X-User-Id'] = config.userId;
  // Chat ID for session continuity
  if (config.chatId) headers['X-Chat-Id'] = config.chatId;

  const resp = await fetch(`${config.baseUrl}/chat/completions`, {
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

  // Resolve credentials LIVE — never use stale module-level constants
  const config = getResolvedConfig();

  if (!config.baseUrl) {
    throw new Error('ZAI_BASE_URL not set — cannot reach Z.ai gateway. Set ZAI_BASE_URL env var to your gateway URL.');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Z-AI-From': 'Z',
  };
  // Vision endpoint REQUIRES X-Token header (returns 401 without it)
  const authToken = config.token || config.apiKey;
  if (authToken) {
    headers['X-Token'] = authToken;
  }
  if (config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey}`;
  }
  if (config.userId) headers['X-User-Id'] = config.userId;
  if (config.chatId) headers['X-Chat-Id'] = config.chatId;

  const resp = await fetch(`${config.baseUrl}/chat/completions/vision`, {
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
let sdkInitAttempted = false;

/**
 * Ensure the .z-ai-config file exists so the SDK can initialize.
 *
 * REFACTORED: Replaced synchronous writeFileSync with async writeFile.
 * The SDK (z-ai-web-dev-sdk) REQUIRES a .z-ai-config file — it has no
 * env-var-only initialization path. Its ZAI.create() reads from:
 *   1. process.cwd()/.z-ai-config  (primary — SDK hardcoded)
 *   2. homedir()/.z-ai-config      (secondary)
 *   3. /etc/.z-ai-config           (tertiary)
 *
 * On Vercel serverless, process.cwd() (/var/task) IS writable at runtime.
 * As a safety net, we also write to /tmp/.z-ai-config for read-only CWD scenarios.
 *
 * Security: The file contains API credentials. On Vercel, the function sandbox
 * is isolated per-request, so this is acceptable. The .z-ai-config is already
 * in .gitignore to prevent accidental commits.
 */
async function ensureZaiConfigFile(): Promise<boolean> {
  if (sdkInitAttempted) return zaiInstance !== null;
  sdkInitAttempted = true;

  const resolved = getResolvedConfig();

  // Validate minimum requirements
  if (!resolved.apiKey && !resolved.token) {
    console.error('[ZAI] No API key or token configured. Set ZAI_API_KEY or ZAI_TOKEN env var.');
    return false;
  }

  // Log resolved config for debugging (mask sensitive values)
  console.log(`[ZAI] Config resolved from: ${resolved.source}`);
  console.log(`[ZAI] Base URL: ${resolved.baseUrl}`);
  console.log(`[ZAI] API Key: ${resolved.apiKey ? resolved.apiKey.slice(0, 8) + '...' : 'NOT SET'}`);
  console.log(`[ZAI] Token: ${resolved.token ? resolved.token.slice(0, 8) + '...' : 'NOT SET'}`);
  console.log(`[ZAI] User ID: ${resolved.userId || 'NOT SET'}`);

  const configToWrite = {
    baseUrl: resolved.baseUrl,
    apiKey: resolved.apiKey || resolved.token,
    token: resolved.token || resolved.apiKey,
    userId: resolved.userId,
    chatId: resolved.chatId,
  };

  // Write targets: CWD first (SDK's primary search path), then /tmp as fallback
  const writeTargets = [
    join(process.cwd(), '.z-ai-config'),
    '/tmp/.z-ai-config',
  ];

  let wroteAny = false;
  for (const configPath of writeTargets) {
    try {
      await writeFile(configPath, JSON.stringify(configToWrite, null, 2), { mode: 0o600 });
      console.log(`[ZAI] Wrote config to ${configPath}`);
      wroteAny = true;
    } catch (writeErr: any) {
      // Non-fatal — the SDK may still find an existing config or we have the direct HTTP fallback
      console.warn(`[ZAI] Could not write to ${configPath} (non-fatal): ${writeErr?.code || writeErr?.message}`);
    }
  }

  return wroteAny;
}

/**
 * Get or initialize the Z.ai SDK instance.
 *
 * Returns null if initialization fails — callers should fall back to
 * the direct HTTP path (callGatewayText / callGatewayVision).
 */
export async function getZai(): Promise<ZAIInstance | null> {
  if (zaiInstance) return zaiInstance;

  try {
    await ensureZaiConfigFile();
    const { default: ZAI } = await import('z-ai-web-dev-sdk');
    zaiInstance = await ZAI.create();
    return zaiInstance;
  } catch (sdkErr: any) {
    console.warn(`[ZAI] SDK initialization failed (will use direct HTTP fallback): ${sdkErr?.message}`);
    return null;
  }
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
  // CHATBOT — PitchCoach AI Assistant
  // ═══════════════════════════════════════════════════════════════════════
  // Cost-effective model for the embedded chatbot widget.
  // Uses "glm-4-flash" label (same backend as glm-4-plus on gateway)
  // for future cost tracking and differentiation.
  // Max 512 tokens per response, 0.7 temperature for conversational tone.
  CHATBOT: {
    models: [AI_MODELS.GLM_FAST, AI_MODELS.FAILSAFE_TEXT],
    temperature: 0.7,
    method: 'chat' as const,
    description: 'PitchCoach AI chatbot — pitch coaching guidance and platform navigation',
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

  // Deduplicate model names — all text models currently resolve to glm-4-plus
  // and all vision models to glm-4.6v. Retrying the same model name is
  // wasteful since it hits the identical server endpoint. Only try each unique
  // model name once per strategy.
  const uniqueModels = Array.from(new Set(config.models));

  // ── STRATEGY 1: Try SDK with model fallback chain ──
  const zai = await getZai();

  if (zai) {
    for (const model of uniqueModels) {
      try {
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
  } else {
    console.warn(`[ZAI] SDK not available for ${moduleKey}, skipping to direct HTTP fallback.`);
  }

  // ── STRATEGY 2: Direct HTTP fallback to gateway (bypass SDK) ──
  // Only reached if the SDK failed entirely (auth, init, network).
  // Since all unique models already failed via SDK, try each once via HTTP.
  const fallbackConfig = getResolvedConfig();
  console.warn(`[ZAI] All SDK models failed for ${moduleKey}. Trying direct HTTP fallback to ${fallbackConfig.baseUrl}...`);

  for (const model of uniqueModels) {
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
// parseJsonResponse, repairJson, extractJsonFromContent, clampScore,
// and validateStringArray are all now imported from ./ai-utils

// ============================================
// HELPER: Validate and clamp AI response values
// ============================================
// All validation helpers are now imported from ./ai-utils

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

VISUAL AUDIT CRITERIA (0-100) — ESTIMATES ONLY (no visual input provided):
Base these estimates on content structure, text density, and formatting cues:
1. Design Consistency: Infer from content organization and slide descriptions
2. Readability: Estimate from text length, structure, and complexity
3. Visual Hierarchy: Infer from heading structure and content ordering
4. Color Scheme: Estimate from brand/product descriptions if available
5. Typography: Estimate from text formatting cues in the extracted content
Note: These are rough estimates. A separate visual audit may override these scores.
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
  "designConsistencyScore": <number 0-100, estimate based on content description only>,
  "readabilityScore": <number 0-100, estimate based on content description only>,
  "visualHierarchyScore": <number 0-100, estimate based on content description only>,
  "colorSchemeScore": <number 0-100, estimate based on content description only>,
  "typographyScore": <number 0-100, estimate based on content description only>,
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

  // Schema validation: catch malformed AI responses before they reach scoring
  const validated = validateSchema<Record<string, unknown>>(parsed, {
    problemClarityScore: { type: 'number', default: 50 },
    solutionClarityScore: { type: 'number', default: 50 },
    marketOpportunityScore: { type: 'number', default: 50 },
    businessModelScore: { type: 'number', default: 50 },
    teamCredibilityScore: { type: 'number', default: 50 },
    tractionScore: { type: 'number', default: 50 },
    financialsScore: { type: 'number', default: 50 },
    askClarityScore: { type: 'number', default: 50 },
    overallScore: { type: 'number', default: 50 },
    designConsistencyScore: { type: 'number', required: false, default: 50 },
    readabilityScore: { type: 'number', required: false, default: 50 },
    visualHierarchyScore: { type: 'number', required: false, default: 50 },
    colorSchemeScore: { type: 'number', required: false, default: 50 },
    typographyScore: { type: 'number', required: false, default: 50 },
    strengths: { type: 'string[]', default: [] },
    weaknesses: { type: 'string[]', default: [] },
    recommendations: { type: 'string[]', default: [] },
  }, 'E1_DECK_CONTENT');

  const result: DeckAnalysisResult = {
    problemClarityScore: clampScore(validated.problemClarityScore),
    solutionClarityScore: clampScore(validated.solutionClarityScore),
    marketOpportunityScore: clampScore(validated.marketOpportunityScore),
    businessModelScore: clampScore(validated.businessModelScore),
    teamCredibilityScore: clampScore(validated.teamCredibilityScore),
    tractionScore: clampScore(validated.tractionScore),
    financialsScore: clampScore(validated.financialsScore),
    askClarityScore: clampScore(validated.askClarityScore),
    overallScore: clampScore(validated.overallScore),
    designConsistencyScore: clampScore(validated.designConsistencyScore),
    readabilityScore: clampScore(validated.readabilityScore),
    visualHierarchyScore: clampScore(validated.visualHierarchyScore),
    colorSchemeScore: clampScore(validated.colorSchemeScore),
    typographyScore: clampScore(validated.typographyScore),
    strengths: validateStringArray(validated.strengths),
    weaknesses: validateStringArray(validated.weaknesses),
    recommendations: validateStringArray(validated.recommendations),
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
export async function analyzeDeckVisual(
  fileUrl: string,
  previousVisualScores?: {
    designConsistencyScore?: number;
    readabilityScore?: number;
    visualHierarchyScore?: number;
    colorSchemeScore?: number;
    typographyScore?: number;
    visualWeaknesses?: string[];
    visualRecommendations?: string[];
  }
): Promise<VisualAuditResult | null> {
  try {
    // SSRF prevention: validate URL before passing to AI
    try {
      if (!isHostAllowed(fileUrl, ALLOWED_UPLOAD_HOSTS)) {
        throw new Error(`Invalid file URL host: ${new URL(fileUrl).hostname}`);
      }
    } catch (err) {
      if (err instanceof TypeError) throw new Error('Invalid file URL format');
      throw err;
    }

    // Build iteration context if previous visual scores are provided
    let iterationContext = '';
    if (previousVisualScores) {
      const prevScores = [
        previousVisualScores.designConsistencyScore != null ? `Design Consistency: ${previousVisualScores.designConsistencyScore}/100` : null,
        previousVisualScores.readabilityScore != null ? `Readability: ${previousVisualScores.readabilityScore}/100` : null,
        previousVisualScores.visualHierarchyScore != null ? `Visual Hierarchy: ${previousVisualScores.visualHierarchyScore}/100` : null,
        previousVisualScores.colorSchemeScore != null ? `Color Scheme: ${previousVisualScores.colorSchemeScore}/100` : null,
        previousVisualScores.typographyScore != null ? `Typography: ${previousVisualScores.typographyScore}/100` : null,
      ].filter(Boolean).join('\n');

      const prevFeedback = [
        ...(previousVisualScores.visualWeaknesses || []).map(w => `- Visual Weakness: ${w}`),
        ...(previousVisualScores.visualRecommendations || []).map(r => `- Visual Recommendation: ${r}`),
      ].join('\n');

      iterationContext = `\n\nPREVIOUS VISUAL AUDIT (iteration context — previous scores:\n${prevScores}\n\nPrevious visual feedback:\n${prevFeedback}\n\nEvaluate the CURRENT deck visuals independently. Acknowledge improvements or regressions.)\n\n`;
    }

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

    const userPrompt = `${iterationContext}Analyze the visual design of this pitch deck. Focus on slide layout, typography, color usage, and overall design professionalism.

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

  // Schema validation: catch malformed AI responses for E2
  const validated = validateSchema<Record<string, unknown>>(parsed, {
    hookScore: { type: 'number', default: 50 },
    problemScore: { type: 'number', default: 50 },
    solutionScore: { type: 'number', default: 50 },
    credibilityScore: { type: 'number', default: 50 },
    ctaScore: { type: 'number', default: 50 },
    overallScore: { type: 'number', default: 50 },
    improvements: { type: 'object', default: {} },
    rewrittenScript: { type: 'string', default: '' },
    alternativeHooks: { type: 'string[]', default: [] },
  }, 'E2_SCRIPT_ANALYSIS');

  const improvements = (validated.improvements && typeof validated.improvements === 'object' && !Array.isArray(validated.improvements))
    ? validated.improvements as Record<string, unknown> : {};
  const result: ScriptAnalysisResult = {
    hookScore: clampScore(validated.hookScore),
    problemScore: clampScore(validated.problemScore),
    solutionScore: clampScore(validated.solutionScore),
    credibilityScore: clampScore(validated.credibilityScore),
    ctaScore: clampScore(validated.ctaScore),
    overallScore: clampScore(validated.overallScore),
    wordCount: 0,
    estimatedDuration: 0,
    improvements: {
      hook: validateStringArray(improvements.hook),
      problem: validateStringArray(improvements.problem),
      solution: validateStringArray(improvements.solution),
      credibility: validateStringArray(improvements.credibility),
      cta: validateStringArray(improvements.cta),
    },
    rewrittenScript: typeof validated.rewrittenScript === 'string' ? validated.rewrittenScript : '',
    alternativeHooks: validateStringArray(validated.alternativeHooks),
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
// MULTI-STRATEGY FALLBACK WRAPPER (E2)
// ============================================

/**
 * Run script analysis with automatic multi-provider fallback:
 *   Strategy 1: Z.ai Gateway (GLM) — PRIMARY
 *   Strategy 2: Kal Agent (Adaptive AI) — FALLBACK
 *
 * Returns null (instead of throwing) when ALL providers fail,
 * so callers can trigger the Kal Protocol graceful degradation.
 *
 * ARCHITECTURE DECISION (Session 18 — 2026-05-01):
 *   Google AI / Vertex AI has been REMOVED from the fallback chain.
 *   Reason: The Gemini API is 403 SERVICE_DISABLED on the GCP project
 *   (project 696443258465) and cannot be authorized without Google Cloud
 *   Console access. Kal Agent is a fully capable replacement that returns
 *   the same ScriptAnalysisResult-compatible output.
 *
 *   Kal Agent was promoted to Strategy 2 because:
 *   - analyzeScript RPC returns full 5-element scores, improvements,
 *     rewritten script, and alternative hooks
 *   - Health check confirms 200 OK with bridgeStatus=ok
 *   - API key authentication works (x-kal-api-key header)
 *   - Tested and verified: scores 72/75/74/82/68 returned successfully
 *
 * This centralizes the try/catch fallback logic that was previously
 * duplicated across POST /api/coach/script and POST /api/coach/script/iterate.
 */
export async function analyzeScriptWithFallback(
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
    rewrittenScript?: string;
  },
  logPrefix = '[E2]'
): Promise<ScriptAnalysisResult | null> {
  let analysis: ScriptAnalysisResult | null = null;

  // ── Strategy 1: Z.ai Gateway (PRIMARY) ──
  try {
    console.log(`${logPrefix} Strategy 1: Analyzing with Z.ai Gateway (GLM)...`);
    analysis = await analyzePitchScript(scriptText, targetAudience, targetDuration, previousAnalysis);
    console.log(`${logPrefix} Z.ai analysis succeeded (Strategy 1), model:`, analysis.modelUsed);
  } catch (zaiError: any) {
    console.error(`${logPrefix} Z.ai Gateway failed (Strategy 1):`, zaiError?.message);
  }

  // ── Strategy 2: Kal Agent (FALLBACK) ──
  // Promoted from Kal Protocol chat-only to full analysis fallback.
  // The Kal Agent's analyzeScript RPC endpoint returns complete
  // 5-element scoring, improvements, rewritten script, and hooks.
  if (!analysis) {
    try {
      console.log(`${logPrefix} Strategy 2: Falling back to Kal Agent...`);
      analysis = await analyzeWithKalAgent(scriptText, targetAudience, targetDuration);
      console.log(`${logPrefix} Kal Agent analysis succeeded (Strategy 2), model:`, analysis.modelUsed);
    } catch (kalError: any) {
      console.error(`${logPrefix} Kal Agent also failed (Strategy 2):`, kalError?.message);
    }
  }

  // NOTE: Google AI / Vertex AI was previously Strategy 3 but has been
  // removed. The Gemini API is 403 SERVICE_DISABLED on our GCP project
  // and cannot be authorized. Kal Agent (Strategy 2) is the sole fallback.
  // If both Z.ai and Kal Agent fail, analysis will be null and the
  // Kal Protocol graceful degradation path will activate.

  return analysis;
}

// ============================================
// KAL AGENT ANALYSIS (Strategy 2 Fallback)
// ============================================

/**
 * Analyze a pitch script using the Kal Agent's analyzeScript RPC endpoint.
 *
 * The Kal Agent is the adaptive AI that powers the Kal Protocol 2.0.
 * Its analyzeScript endpoint returns a full script analysis with 5-element
 * scores, improvements, rewritten script, and alternative hooks.
 *
 * This function calls the Kal Agent directly and transforms the response
 * into the ScriptAnalysisResult format expected by the rest of the app.
 *
 * KAL AGENT RESPONSE FORMAT:
 *   {
 *     hookScore, problemScore, solutionScore, credibilityScore, ctaScore,
 *     overallScore, improvements: [{category, suggestion, priority}],
 *     rewrittenScript, alternativeHooks, tokensUsed, modelUsed
 *   }
 *
 * SCRIPTANALYSISRESULT FORMAT:
 *   {
 *     hookScore, problemScore, solutionScore, credibilityScore, ctaScore,
 *     overallScore, improvements: {hook: [...], problem: [...], ...},
 *     rewrittenScript, alternativeHooks, wordCount, estimatedDuration,
 *     tokensUsed, modelUsed
 *   }
 */
async function analyzeWithKalAgent(
  scriptText: string,
  targetAudience?: string,
  targetDuration?: number,
  options?: { userName?: string; sessionId?: string },
): Promise<ScriptAnalysisResult> {
  const KAL_AGENT_URL = process.env.KAL_AGENT_URL || '';
  const KAL_API_KEY = process.env.KAL_API_KEY || '';

  if (!KAL_AGENT_URL) {
    throw new Error('Kal Agent not configured (KAL_AGENT_URL not set)');
  }

  if (!KAL_API_KEY) {
    throw new Error('Kal Agent not configured (KAL_API_KEY not set)');
  }

  // Per Kal Agent Integration Spec v1:
  // - Base URL: https://kal-agent-morpheos255918280.on.adaptive.ai
  // - Header: x-kal-api-key (REQUIRED on every call)
  // - NO JSON-RPC envelopes — POST the input object directly
  // - Method name goes in the URL path: /api/rpc/<methodName>
  const endpoint = `${KAL_AGENT_URL}/api/rpc/analyzeScript`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-kal-api-key': KAL_API_KEY,
  };

  const payload: Record<string, unknown> = {
    script: scriptText,
    moduleType: 'e2',
    targetAudience: targetAudience || 'investors',
    targetDuration: targetDuration || 60,
  };

  // Optional fields per spec
  if (options?.userName) payload.userName = options.userName;
  if (options?.sessionId) payload.sessionId = options.sessionId;

  console.log(`[KalAgent] Calling analyzeScript at ${KAL_AGENT_URL}...`);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30_000), // 30s timeout — analysis is heavy
  });

  if (!response.ok) {
    const body = await response.text().catch(() => 'unknown');
    throw new Error(`Kal Agent HTTP ${response.status}: ${body.slice(0, 300)}`);
  }

  const data = await response.json();

  // Validate minimum response structure
  if (typeof data.overallScore !== 'number') {
    throw new Error('Kal Agent returned invalid response — missing overallScore');
  }

  // ── Transform Kal Agent response → ScriptAnalysisResult ──
  const wordCount = scriptText.split(/\s+/).filter(Boolean).length;

  // Transform improvements from array-of-objects to element-keyed object
  // Kal returns: [{category: "Hook", suggestion: "...", priority: "medium"}, ...]
  // We need: {hook: ["..."], problem: ["..."], solution: ["..."], credibility: ["..."], cta: ["..."]}
  const kalImprovements: { hook: string[]; problem: string[]; solution: string[]; credibility: string[]; cta: string[] } = {
    hook: [], problem: [], solution: [], credibility: [], cta: [],
  };

  if (Array.isArray(data.improvements)) {
    for (const imp of data.improvements) {
      if (!imp || typeof imp !== 'object') continue;
      const category = String(imp.category || '').toLowerCase();
      const suggestion = String(imp.suggestion || imp.improvement || '');
      if (!suggestion) continue;

      // Map Kal category names to ScriptAnalysisResult element keys
      if (category.includes('hook')) {
        kalImprovements.hook.push(suggestion);
      } else if (category.includes('problem')) {
        kalImprovements.problem.push(suggestion);
      } else if (category.includes('solution')) {
        kalImprovements.solution.push(suggestion);
      } else if (category.includes('credibility') || category.includes('proof')) {
        kalImprovements.credibility.push(suggestion);
      } else if (category.includes('cta') || category.includes('ask') || category.includes('call')) {
        kalImprovements.cta.push(suggestion);
      } else {
        // Unknown category — add to the lowest-scoring element for visibility
        const scores = { hook: data.hookScore, problem: data.problemScore, solution: data.solutionScore, credibility: data.credibilityScore, cta: data.ctaScore };
        const lowest = Object.entries(scores).reduce((a, b) => (b[1] < a[1] ? b : a), ['hook', 100]);
        const key = lowest[0] as keyof typeof kalImprovements;
        kalImprovements[key].push(suggestion);
      }
    }
  } else if (data.improvements && typeof data.improvements === 'object' && !Array.isArray(data.improvements)) {
    // Already in the right format — use directly
    const imp = data.improvements as Record<string, unknown>;
    kalImprovements.hook = validateStringArray(imp.hook);
    kalImprovements.problem = validateStringArray(imp.problem);
    kalImprovements.solution = validateStringArray(imp.solution);
    kalImprovements.credibility = validateStringArray(imp.credibility);
    kalImprovements.cta = validateStringArray(imp.cta);
  }

  const result: ScriptAnalysisResult = {
    hookScore: clampScore(data.hookScore),
    problemScore: clampScore(data.problemScore),
    solutionScore: clampScore(data.solutionScore),
    credibilityScore: clampScore(data.credibilityScore),
    ctaScore: clampScore(data.ctaScore),
    overallScore: clampScore(data.overallScore),
    wordCount,
    estimatedDuration: Math.round(wordCount / 2.5),
    improvements: kalImprovements,
    rewrittenScript: String(data.rewrittenScript || ''),
    alternativeHooks: validateStringArray(data.alternativeHooks),
    tokensUsed: data.tokensUsed,
    modelUsed: data.modelUsed || 'kal-agent',
  };

  // Quality validation — same as Z.ai path
  const e2Weighted = computeWeightedOverall(SCORING_WEIGHTS.E2_ELEMENTS, {
    hook: result.hookScore, problem: result.problemScore, solution: result.solutionScore,
    credibility: result.credibilityScore, cta: result.ctaScore,
  });
  const { validatedOverall } = validateScoreConsistency(
    result.overallScore, e2Weighted,
    { hook: result.hookScore, problem: result.problemScore, solution: result.solutionScore,
      credibility: result.credibilityScore, cta: result.ctaScore },
    'E2_KAL_AGENT'
  );
  result.overallScore = validatedOverall;

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
  // SSRF prevention: validate URL before passing to AI
  try {
    if (!isHostAllowed(videoUrl, ALLOWED_UPLOAD_HOSTS)) {
      throw new Error(`Invalid video URL host: ${new URL(videoUrl).hostname}`);
    }
  } catch (err) {
    if (err instanceof TypeError) throw new Error('Invalid video URL format');
    throw err;
  }

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
  deckAnalysis?: DeckAnalysisResult,
  previousAnalysis?: {
    overallReadinessScore?: number;
    problemSolutionFit?: number;
    marketOpportunity?: number;
    businessModelViability?: number;
    teamCredibility?: number;
    tractionMilestones?: number;
    deliveryPresence?: number;
    weaknesses?: string[];
    recommendedActions?: string[];
  }
): Promise<FullPitchAnalysisResult> {
  // SSRF prevention: validate URL before passing to AI
  try {
    if (!isHostAllowed(videoUrl, ALLOWED_UPLOAD_HOSTS)) {
      throw new Error(`Invalid video URL host: ${new URL(videoUrl).hostname}`);
    }
  } catch (err) {
    if (err instanceof TypeError) throw new Error('Invalid video URL format');
    throw err;
  }

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

  // Build iteration context if previous analysis is provided
  let iterationContext = '';
  if (previousAnalysis) {
    const prevScores = [
      `Overall Readiness: ${previousAnalysis.overallReadinessScore ?? 'N/A'}/100`,
      previousAnalysis.problemSolutionFit != null ? `Problem-Solution Fit: ${previousAnalysis.problemSolutionFit}/100` : null,
      previousAnalysis.marketOpportunity != null ? `Market Opportunity: ${previousAnalysis.marketOpportunity}/100` : null,
      previousAnalysis.businessModelViability != null ? `Business Model Viability: ${previousAnalysis.businessModelViability}/100` : null,
      previousAnalysis.teamCredibility != null ? `Team Credibility: ${previousAnalysis.teamCredibility}/100` : null,
      previousAnalysis.tractionMilestones != null ? `Traction & Milestones: ${previousAnalysis.tractionMilestones}/100` : null,
      previousAnalysis.deliveryPresence != null ? `Delivery & Presence: ${previousAnalysis.deliveryPresence}/100` : null,
    ].filter(Boolean).join('\n');

    const prevFeedback = [
      ...(previousAnalysis.weaknesses || []).map(w => `- Weakness: ${w}`),
      ...(previousAnalysis.recommendedActions || []).map(a => `- Recommended Action: ${a}`),
    ].join('\n');

    iterationContext = `\n\nPREVIOUS ANALYSIS (iteration context — the founder previously scored:\n${prevScores}\n\nPrevious feedback given:\n${prevFeedback}\n\nYour task: Evaluate the CURRENT pitch independently. If they improved, acknowledge it. If they regressed, flag it. Score the CURRENT quality, not the previous analysis.)\n\n`;
  }

  const userPrompt = `${iterationContext}Analyze this full investor pitch.

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
  // Quality validation: cross-check overall score against weighted average
  const readinessWeighted = computeWeightedOverall(SCORING_WEIGHTS.E4_READINESS, {
    problemSolutionFit: result.problemSolutionFit, marketOpportunity: result.marketOpportunity,
    businessModelViability: result.businessModelViability, teamCredibility: result.teamCredibility,
    tractionMilestones: result.tractionMilestones, deliveryPresence: result.deliveryPresence,
  });
  const { validatedOverall: e4Validated } = validateScoreConsistency(
    result.overallReadinessScore, readinessWeighted,
    { problemSolutionFit: result.problemSolutionFit, marketOpportunity: result.marketOpportunity,
      businessModelViability: result.businessModelViability, teamCredibility: result.teamCredibility,
      tractionMilestones: result.tractionMilestones, deliveryPresence: result.deliveryPresence },
    'E4_FULL'
  );
  result.overallReadinessScore = e4Validated;

  return result;
}

export function getZaiConfigStatus(): {
  sdkInitAttempted: boolean;
  hasToken: boolean;
  hasApiKey: boolean;
  hasBaseUrl: boolean;
  hasUserId: boolean;
  configSource: string;
  baseUrl: string;
} {
  const resolved = getResolvedConfig();
  return {
    sdkInitAttempted,
    hasToken: !!resolved.token,
    hasApiKey: !!resolved.apiKey,
    hasBaseUrl: !!resolved.baseUrl && resolved.baseUrl !== DEFAULT_GATEWAY_URL,
    hasUserId: !!resolved.userId,
    configSource: resolved.source,
    baseUrl: resolved.baseUrl,
  };
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
  vision?: { status: string; message?: string };
}> {
  const results = {
    zai: { status: 'unknown' as string, message: '' as string },
    vision: { status: 'unknown' as string, message: '' as string },
  };
  let resolvedTextModel = 'unknown';
  let resolvedVisionModel = 'unknown';

  try {
    const zai = await getZai();
    if (!zai) {
      results.zai = { status: 'unhealthy', message: 'SDK initialization failed — check ZAI_API_KEY' };
      return { ...results } as any;
    }
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

  // Test vision endpoint — critical for E1 visual audit, E3 live pitch, E4 full session
  try {
    const zai = await getZai();
    if (!zai) {
      results.vision = { status: 'unhealthy', message: 'SDK initialization failed' };
    } else {
    // Minimal vision test: a 1x1 white PNG pixel as data URI
    const testPixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
    const visionResp = await zai.chat.completions.createVision({
      model: AI_MODELS.PRIMARY_VISION,
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
    resolvedVisionModel = visionResp.model || 'unknown';
    const visionContent = visionResp.choices?.[0]?.message?.content;
    if (visionContent && visionContent.length > 0) {
      results.vision = { status: 'healthy', message: `${resolvedVisionModel} responding` };
    } else {
      results.vision = { status: 'degraded', message: 'Vision endpoint returned empty response' };
    }
    } // end else (zai available)
  } catch (error) {
    results.vision = { status: 'unhealthy', message: error instanceof Error ? error.message : 'Unknown' };
  }

  // Overall status: healthy only if both text and vision are healthy
  const overallHealthy = results.zai.status === 'healthy' && results.vision.status !== 'unhealthy';

  return {
    status: overallHealthy ? 'healthy' : 'unhealthy',
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
    vision: results.vision,
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
  moduleType: 'deck' | 'script' | 'live' | 'full' | 'founder',
  scores: Record<string, number>,
  weaknesses: string[],
  strengths: string[],
): Promise<CoachingDrill[]> {
  const moduleLabels: Record<string, string> = {
    deck: 'pitch deck',
    script: 'elevator pitch script',
    live: 'live elevator pitch',
    full: 'full investor pitch session',
    founder: 'founder readiness',
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
