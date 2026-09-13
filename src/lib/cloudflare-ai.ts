/**
 * Cloudflare Workers AI service — replaces Z.ai + Kal Agent + Vertex AI.
 *
 * Uses Cloudflare's Workers AI API for text generation and vision analysis.
 * All AI coaching modules (deck analysis, script coaching, video analysis,
 * full pitch, founder coaching) route through this single service.
 *
 * Env vars required:
 *   - CLOUDFLARE_ACCOUNT_ID
 *   - CLOUDFLARE_AI_TOKEN (use CLOUDFLARE_R2_ACCESS_KEY_ID's companion token, or the CF API token)
 *
 * Models:
 *   - Text: @cf/meta/llama-3.3-70b-instruct-fp8-fast (flagship, fast)
 *   - Vision: @cf/meta/llama-3.2-11b-vision-instruct (image + text)
 */

const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || "";
const CF_AI_TOKEN = process.env.CLOUDFLARE_AI_TOKEN || process.env.CF_API_TOKEN || "";
const CF_BASE = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run`;

// ── Model configuration ───────────────────────────────────────────────────
export const AI_MODELS = {
  TEXT_PRIMARY: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  TEXT_FAST: "@cf/meta/llama-3.2-3b-instruct",
  VISION: "@cf/meta/llama-3.2-11b-vision-instruct",
} as const;

export interface ModuleModelConfig {
  textModel: string;
  visionModel: string;
}

export const MODULE_MODEL_MAP: Record<string, ModuleModelConfig> = {
  e1_deck: { textModel: AI_MODELS.TEXT_PRIMARY, visionModel: AI_MODELS.VISION },
  e2_script: { textModel: AI_MODELS.TEXT_PRIMARY, visionModel: AI_MODELS.VISION },
  e3_live: { textModel: AI_MODELS.TEXT_PRIMARY, visionModel: AI_MODELS.VISION },
  e4_full: { textModel: AI_MODELS.TEXT_PRIMARY, visionModel: AI_MODELS.VISION },
  e5_founder: { textModel: AI_MODELS.TEXT_PRIMARY, visionModel: AI_MODELS.VISION },
};

export type ModuleModelKey = keyof typeof MODULE_MODEL_MAP;

// ── Scoring weights (unchanged from previous AI service) ──────────────────
export const SCORING_WEIGHTS = {
  problemClarity: 0.15,
  solutionClarity: 0.15,
  marketOpportunity: 0.12,
  businessModel: 0.13,
  teamCredibility: 0.10,
  traction: 0.10,
  financials: 0.10,
  askClarity: 0.15,
} as const;

export function computeWeightedOverall(scores: Record<string, number | null>): number | null {
  let total = 0;
  let weightSum = 0;
  for (const [key, weight] of Object.entries(SCORING_WEIGHTS)) {
    const val = scores[key];
    if (typeof val === "number" && val >= 0 && val <= 100) {
      total += val * weight;
      weightSum += weight;
    }
  }
  if (weightSum === 0) return null;
  return Math.round(total / weightSum);
}

export function validateScoreConsistency(scores: Record<string, number | null>): boolean {
  for (const val of Object.values(scores)) {
    if (typeof val === "number" && (val < 0 || val > 100)) return false;
  }
  return true;
}

// ── Core AI call function ─────────────────────────────────────────────────
interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Call Cloudflare Workers AI for text generation.
 * Uses Llama 3.3 70B (fast FP8 quantized) for high-quality output.
 */
export async function callAI(
  messages: ChatMessage[],
  options: { maxTokens?: number; temperature?: number; model?: string } = {}
): Promise<string> {
  const model = options.model || AI_MODELS.TEXT_PRIMARY;
  const maxTokens = options.maxTokens || 4096;
  const temperature = options.temperature ?? 0.7;

  if (!CF_ACCOUNT_ID || !CF_AI_TOKEN) {
    throw new Error("Cloudflare AI not configured — set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_AI_TOKEN");
  }

  const response = await fetch(`${CF_BASE}/${model}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CF_AI_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages,
      max_tokens: maxTokens,
      temperature,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Cloudflare AI error ${response.status}: ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  if (!data.success) {
    throw new Error(`Cloudflare AI failed: ${JSON.stringify(data.errors)}`);
  }

  // Workers AI returns { result: { response: "..." } } for single-message,
  // or { result: { response: "..." } } for chat messages
  const result = data.result;
  if (result?.response) return result.response;
  if (result?.message?.content) return result.message.content;
  // Fallback: try to extract from any shape
  return typeof result === "string" ? result : JSON.stringify(result);
}

/**
 * Call Cloudflare Workers AI for vision (image analysis).
 * Uses Llama 3.2 11B Vision model.
 */
export async function callAIVision(
  prompt: string,
  imageBase64: string,
  options: { maxTokens?: number } = {}
): Promise<string> {
  const model = AI_MODELS.VISION;
  const maxTokens = options.maxTokens || 4096;

  if (!CF_ACCOUNT_ID || !CF_AI_TOKEN) {
    throw new Error("Cloudflare AI not configured — set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_AI_TOKEN");
  }

  // Workers AI vision API accepts image as base64 data URI
  const imageDataUri = imageBase64.startsWith("data:")
    ? imageBase64
    : `data:image/png;base64,${imageBase64}`;

  const response = await fetch(`${CF_BASE}/${model}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CF_AI_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: [
        { role: "system", content: "You are an expert pitch coach and presentation analyst." },
        { role: "user", content: [
          { type: "text", text: prompt },
          { type: "image_url", image: { url: imageDataUri } },
        ]},
      ],
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Cloudflare Vision AI error ${response.status}: ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  if (!data.success) {
    throw new Error(`Cloudflare Vision AI failed: ${JSON.stringify(data.errors)}`);
  }

  const result = data.result;
  return result?.response || result?.message?.content || JSON.stringify(result);
}

// ── Fallback execution (simplified — no more multi-provider chain) ────────
export async function executeWithFallback<T>(
  primaryFn: () => Promise<T>,
  _fallbackFn?: () => Promise<T>,
  _moduleKey?: string
): Promise<T> {
  // No more fallback chain — Cloudflare Workers AI is the single provider.
  // If it fails, the error propagates to the caller.
  return primaryFn();
}

// ── Config status (for health checks) ─────────────────────────────────────
export function getAIConfigStatus(): { configured: boolean; provider: string; models: string[] } {
  return {
    configured: !!(CF_ACCOUNT_ID && CF_AI_TOKEN),
    provider: "Cloudflare Workers AI",
    models: Object.values(AI_MODELS),
  };
}
