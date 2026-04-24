// ═══════════════════════════════════════════════════════════════════════
// KAL ADAPTIVE MIDDLEWARE CLIENT
// ═══════════════════════════════════════════════════════════════════════
//
// Hybrid Architecture (Scenario C):
//   - Z.ai SDK → PRIMARY for all E1-E5 pitch analysis (fast, structured)
//   - Adaptive Middleware → PRIMARY for Kal V2 contextual chat
//
// This client handles RPC calls to the adaptive AI agent that powers
// the Kal Protocol 2.0 contextual chat scenario. The adaptive agent
// receives the handoff prompt (see Kal_Protocol_2_Handoff_Prompt.docx)
// and natively handles the 10-question flow, fallback responses,
// and summary generation.
//
// ARCHITECTURE:
//   ┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
//   │  KalChat API │────▶│  Adaptive Agent  │────▶│  Returns     │
//   │  Route       │     │  (RPC endpoint)  │     │  next Q /    │
//   │              │◀────│                  │◀────│  summary     │
//   └──────────────┘     └──────────────────┘     └──────────────┘
//         │                      │
//         │                      ├── Handles fallback logic
//         │                      ├── Applies critical thinking
//         │                      ├── Generates summary
//         │                      └── Adapts to user engagement
//         │
//         └── Fallback: If middleware is down, falls back to
//             local Z.ai-based Kal V2 (original code path)
//
// RPC ENDPOINTS (adaptive.ai):
//   POST /api/rpc/analyzeKalScript   — Start / continue Kal chat
//   POST /api/rpc/generateKalSummary — Generate final summary
//
// ═══════════════════════════════════════════════════════════════════════

// ============================================
// CONFIGURATION
// ============================================

const KAL_MIDDLEWARE_BASE_URL =
  process.env.KAL_MIDDLEWARE_URL ||
  'https://kal-middleware-morpheos255918280.adaptive.ai';

const KAL_RPC_ENDPOINTS = {
  analyzeScript: '/api/rpc/analyzeKalScript',
  generateSummary: '/api/rpc/generateKalSummary',
} as const;

// ============================================
// TYPES
// ============================================

export interface KalMiddlewareAnalyzeRequest {
  /** The user's pitch script text */
  script: string;
  /** Module type: e1, e2, e3, e4, e5 */
  moduleType: 'e1' | 'e2' | 'e3' | 'e4' | 'e5';
  /** Target audience for the pitch */
  targetAudience?: string;
  /** Target duration in seconds */
  targetDuration?: number;
  /** Current question index (1-10) for continuation */
  questionIndex?: number;
  /** User's answer to the current question */
  answer?: string;
  /** Chat session ID for continuity */
  chatSessionId?: string;
  /** User context for personalization */
  userName?: string;
  /** User's email */
  userEmail?: string;
  /** Whether this is a skip */
  isSkip?: boolean;
}

export interface KalMiddlewareAnalyzeResponse {
  /** Whether the middleware call succeeded */
  success: boolean;
  /** The next question to ask (or null if complete) */
  nextQuestion?: string | null;
  /** Fallback response if user skipped or gave vague answer */
  fallbackResponse?: string | null;
  /** Question number (1-10) */
  questionIndex?: number;
  /** Questions remaining after this one */
  questionsRemaining?: number;
  /** Whether all 10 questions have been answered */
  isComplete?: boolean;
  /** Summary text (only when isComplete is true) */
  summary?: string | null;
  /** Quick improvement feedback (only when isComplete is true) */
  quickFeedback?: string | null;
  /** Current analysis status message */
  statusMessage?: string;
  /** Error message if the call failed */
  error?: string;
  /** The chat session ID assigned by the middleware */
  chatSessionId?: string;
}

export interface KalMiddlewareSummaryRequest {
  /** All question-answer pairs from the chat */
  messages: Array<{
    questionIndex: number;
    question: string;
    answer?: string;
  }>;
  /** Original script summary (first 500 chars) */
  inputSummary: string;
  /** Module type */
  moduleType: 'e1' | 'e2' | 'e3' | 'e4' | 'e5';
  /** Chat session ID */
  chatSessionId: string;
}

export interface KalMiddlewareSummaryResponse {
  success: boolean;
  summary?: string;
  quickFeedback?: string;
  error?: string;
}

// ============================================
// RPC CLIENT
// ============================================

/**
 * Call the Kal adaptive middleware RPC endpoint.
 *
 * Includes timeout protection, error handling, and structured logging.
 * If the middleware is unreachable, returns a structured error response
 * that triggers the local Z.ai fallback path.
 */
async function kalRpc<TRequest, TResponse>(
  endpoint: string,
  payload: TRequest,
  timeoutMs: number = 15_000,
): Promise<TResponse> {
  const url = `${KAL_MIDDLEWARE_BASE_URL}${endpoint}`;

  console.log(`[KalMiddleware] RPC → ${endpoint}`);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Source': 'pitch-perfect',
        'X-Module': 'kal-v2',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'unknown');
      console.error(
        `[KalMiddleware] RPC ${endpoint} failed: HTTP ${response.status} — ${errorBody.slice(0, 300)}`,
      );
      throw new Error(`Middleware HTTP ${response.status}: ${errorBody.slice(0, 200)}`);
    }

    const data = await response.json();
    console.log(`[KalMiddleware] RPC ${endpoint} succeeded`);
    return data as TResponse;

  } catch (error: any) {
    // Categorise the error for logging and fallback decisions
    if (error.name === 'AbortError') {
      console.error(`[KalMiddleware] RPC ${endpoint} timed out after ${timeoutMs}ms`);
      throw new Error('MIDDLEWARE_TIMEOUT');
    }

    if (error.cause?.code === 'ECONNREFUSED' || error.cause?.code === 'ENOTFOUND') {
      console.error(`[KalMiddleware] RPC ${endpoint} — connection refused / DNS failure`);
      throw new Error('MIDDLEWARE_UNREACHABLE');
    }

    console.error(`[KalMiddleware] RPC ${endpoint} error: ${error.message}`);
    throw error;
  }
}

// ============================================
// PUBLIC API
// ============================================

/**
 * Start or continue a Kal V2 contextual chat session via the adaptive middleware.
 *
 * Call this when:
 *   1. Starting a new Kal session (questionIndex undefined)
 *   2. Continuing after the user answers a question (questionIndex + answer provided)
 *
 * The middleware handles:
 *   - Selecting the next question based on the 10-question sequence
 *   - Detecting short/vague answers and generating fallback responses
 *   - Applying the 8-step critical thinking framework
 *   - Adapting question delivery based on user engagement
 *
 * If the middleware fails, the caller should fall back to the local
 * Z.ai-based processKalV2Answer() function.
 */
export async function kalMiddlewareAnalyze(
  request: KalMiddlewareAnalyzeRequest,
): Promise<KalMiddlewareAnalyzeResponse> {
  try {
    return await kalRpc<KalMiddlewareAnalyzeRequest, KalMiddlewareAnalyzeResponse>(
      KAL_RPC_ENDPOINTS.analyzeScript,
      request,
      15_000, // 15s timeout — chat is latency-tolerant
    );
  } catch (error: any) {
    console.warn(`[KalMiddleware] Analyze failed: ${error.message}. Will use local fallback.`);
    return {
      success: false,
      error: error.message,
      statusMessage: 'Middleware unavailable. Using local Kal engine.',
    };
  }
}

/**
 * Generate a Kal V2 summary via the adaptive middleware.
 *
 * Called after all 10 questions have been answered. The middleware
 * synthesises the Q&A pairs into a structured assessment using the
 * critical thinking framework.
 *
 * If the middleware fails, falls back to local Z.ai summary generation.
 */
export async function kalMiddlewareSummary(
  request: KalMiddlewareSummaryRequest,
): Promise<KalMiddlewareSummaryResponse> {
  try {
    return await kalRpc<KalMiddlewareSummaryRequest, KalMiddlewareSummaryResponse>(
      KAL_RPC_ENDPOINTS.generateSummary,
      request,
      30_000, // 30s timeout — summary generation is heavier
    );
  } catch (error: any) {
    console.warn(`[KalMiddleware] Summary failed: ${error.message}. Will use local Z.ai fallback.`);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Check if the Kal middleware is reachable.
 * Used by the health check endpoint and pre-warm logic.
 */
export async function isKalMiddlewareReady(): Promise<{
  ready: boolean;
  latencyMs: number;
  error?: string;
}> {
  const start = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);

    const response = await fetch(`${KAL_MIDDLEWARE_BASE_URL}/api/rpc/health`, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeout);

    return {
      ready: response.ok,
      latencyMs: Date.now() - start,
    };
  } catch (error: any) {
    return {
      ready: false,
      latencyMs: Date.now() - start,
      error: error.message,
    };
  }
}

/**
 * Get the configured middleware base URL.
 * Useful for logging and debugging.
 */
export function getKalMiddlewareUrl(): string {
  return KAL_MIDDLEWARE_BASE_URL;
}
