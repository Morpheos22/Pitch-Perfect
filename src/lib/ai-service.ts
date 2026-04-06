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

import { writeFileSync } from 'fs';
import { join } from 'path';

// ============================================
// Z.AI SDK INITIALIZATION
// ============================================

type ZAIInstance = Awaited<ReturnType<typeof import('z-ai-web-dev-sdk').default.create>>;

let zaiInstance: ZAIInstance | null = null;
let configCreated = false;

function createZaiConfig(): boolean {
  if (configCreated) return true;

  // Z.ai gateway reads from /etc/.z-ai-config (pre-configured in this environment)
  // For Vercel/deployed: uses env vars to write to /tmp/.z-ai-config
  const config = {
    baseUrl: process.env.ZAI_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4',
    apiKey: process.env.ZAI_API_KEY || 'Z.ai',
    chatId: process.env.ZAI_CHAT_ID,
    userId: process.env.ZAI_USER_ID,
    token: process.env.ZAI_TOKEN,
  };

  const configJson = JSON.stringify(config);

  if (!process.env.HOME || process.env.HOME === '/') {
    process.env.HOME = '/tmp';
  }

  const cwd = process.cwd();
  const homeDir = process.env.HOME;
  const locations = [join(cwd, '.z-ai-config'), join(homeDir, '.z-ai-config')];

  let success = false;
  for (const loc of locations) {
    try {
      writeFileSync(loc, configJson);
      success = true;
    } catch (_e) {
      // Continue to next location
    }
  }

  if (success) configCreated = true;
  return success;
}

async function getZai() {
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
  // ── TEXT MODELS (all route to glm-4-plus on gateway) ─────────────────────
  PRIMARY_TEXT:     'gemini-2.5-flash',       // → glm-4-plus (text tasks)
  UPGRADE_TEXT:     'gemini-1.5-pro',         // → glm-4-plus (deeper analysis)
  GLM_FLAGSHIP:     'glm-5.1',                // → glm-4-plus (GLM brand label)
  GLM_FAST:         'glm-4-flash',            // → glm-4-plus (simple/fast tasks)
  FAILSAFE_TEXT:    'gemma-4',                // → glm-4-plus (open-weight label)

  // ── VISION MODELS (all route to glm-4.6v on gateway) ─────────────────────
  PRIMARY_VISION:   'gemini-1.5-pro',         // → glm-4.6v (vision tasks)
  GLM_VISION:       'glm-4.1v-thinking',      // → glm-4.6v (vision + thinking)
  FAST_VISION:      'gemini-2.0-flash',       // → glm-4.6v (quick scans)
  FAILSAFE_VISION:  'gemma-4',                // → glm-4.6v (vision failsafe)

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

async function executeWithFallback(
  moduleKey: ModuleModelKey,
  buildRequest: (model: string) => ChatRequest | VisionRequest
): Promise<{ response: any; modelUsed: string; moduleKey: string }> {
  const config = MODULE_MODEL_MAP[moduleKey];
  const lastError: Error[] = [];

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
        });
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
      console.warn(`[ZAI] Model ${model} failed for ${moduleKey}: ${err.message}. Trying next...`);
    }
  }

  throw new Error(
    `All models failed for ${moduleKey}: ${lastError.map(e => e.message).join(' → ')}`
  );
}

// ============================================
// HELPER: Parse JSON from AI response
// ============================================

function parseJsonResponse<T>(content: string): T {
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error('[ZAI] Failed to parse AI response:', content.slice(0, 500));
    throw new Error('No valid JSON found in AI response');
  }
  return JSON.parse(jsonMatch[0]) as T;
}

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

export async function analyzePitchDeck(deckContent: string): Promise<DeckAnalysisResult> {
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

Provide actionable, specific feedback. Be direct but constructive.
Respond ONLY in valid JSON format without any markdown formatting.`;

  const userPrompt = `Analyze this pitch deck content thoroughly:

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

  const result = parseJsonResponse<DeckAnalysisResult>(content);
  result.tokensUsed = response.usage?.totalTokens;
  result.modelUsed = modelUsed;
  return result;
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
  targetDuration?: number
): Promise<ScriptAnalysisResult> {
  const systemPrompt = `You are an expert pitch coach specializing in elevator pitches with 20+ years of experience. You have coached founders from Y Combinator, Techstars, and 500 Startups.

Analyze scripts using the 5-Element Elevator Pitch Framework:

1. HOOK (0-100): Opens with something that grabs attention immediately (first 5 seconds)
2. PROBLEM (0-100): Clear, specific, relatable problem statement with concrete examples
3. SOLUTION (0-100): Concise description that differentiates from alternatives
4. CREDIBILITY (0-100): Demonstrates relevant expertise or traction
5. CALL-TO-ACTION (0-100): Clear, specific ask with urgency

Provide specific, actionable feedback. Give concrete examples.
Respond ONLY in valid JSON format without any markdown formatting.`;

  const audienceContext = targetAudience ? `Target audience: ${targetAudience}` : 'Target audience: investors (seed stage)';
  const durationContext = targetDuration ? `Target duration: ${targetDuration} seconds` : 'Target duration: 60 seconds (typical elevator pitch)';

  const userPrompt = `Analyze this elevator pitch script:

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

  const result = parseJsonResponse<ScriptAnalysisResult>(content);
  result.wordCount = scriptText.split(/\s+/).filter(Boolean).length;
  result.estimatedDuration = Math.round(result.wordCount / 2.5);
  result.tokensUsed = response.usage?.totalTokens;
  result.modelUsed = modelUsed;
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

  const result = parseJsonResponse<VideoAnalysisResult>(content);
  result.tokensUsed = response.usage?.totalTokens;
  result.modelUsed = modelUsed;
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

  const result = parseJsonResponse<FullPitchAnalysisResult>(content);
  result.tokensUsed = response.usage?.totalTokens;
  result.modelUsed = modelUsed;
  return result;
}

// ============================================
// IMAGE ANALYSIS (deck slide screenshots)
// ============================================

export interface ImageAnalysisResult {
  description: string;
  visualElements: string[];
  designQuality: number;
  readability: number;
  suggestions: string[];
  tokensUsed?: number;
  modelUsed?: string;
}

export async function analyzeImage(imageUrl: string): Promise<ImageAnalysisResult> {
  const prompt = `Analyze this pitch deck slide. Provide:
1. Design quality (0-100)
2. Readability (0-100)
3. Key visual elements
4. Specific improvement suggestions

JSON: { "description": "<desc>", "visualElements": ["<e1>", "<e2>"], "designQuality": <0-100>, "readability": <0-100>, "suggestions": ["<s1>", "<s2>"] }`;

  const { response, modelUsed } = await executeWithFallback('IMAGE_ANALYSIS', (model) => ({
    model,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: imageUrl } },
      ],
    }],
    temperature: MODULE_MODEL_MAP.IMAGE_ANALYSIS.temperature,
  }));

  const content = response.choices?.[0]?.message?.content;
  if (!content) throw new Error('No response from AI');

  const result = parseJsonResponse<ImageAnalysisResult>(content);
  result.tokensUsed = response.usage?.totalTokens;
  result.modelUsed = modelUsed;
  return result;
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
      models: val.models,
      temperature: val.temperature,
      thinkingEnabled: !!val.thinkingEnabled,
      method: val.method,
    })),
    configFound: true,
    zai: results.zai,
  };
}
