// ═══════════════════════════════════════════════════════════════════════
// KAL ADAPTIVE CLIENT — Agent + Middleware
// ═══════════════════════════════════════════════════════════════════════
//
// Hybrid Architecture (Scenario C — updated):
//   - Z.ai SDK → PRIMARY for all E1-E5 pitch analysis (fast, structured)
//   - Kal Agent (authenticated) → PRIMARY for Kal V2 contextual chat
//   - Kal Middleware (legacy) → FALLBACK if agent not configured
//   - Local Z.ai Kal V2 → FINAL fallback if both remote services are down
//
// This client handles RPC calls to the adaptive AI agent that powers
// the Kal Protocol 2.0 contextual chat scenario. The adaptive agent
// receives the handoff prompt (see Kal_Protocol_2_Handoff_Prompt.docx)
// and natively handles the 10-question flow, fallback responses,
// and summary generation.
//
// ARCHITECTURE:
//   ┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
//   │  KalChat API │────▶│  Kal Agent       │────▶│  Returns     │
//   │  Route       │     │  (RPC + API Key) │     │  next Q /    │
//   │              │◀────│  or Middleware   │◀────│  summary     │
//   └──────────────┘     └──────────────────┘     └──────────────┘
//         │                      │
//         │                      ├── Handles fallback logic
//         │                      ├── Applies critical thinking
//         │                      ├── Generates summary
//         │                      └── Adapts to user engagement
//         │
//         └── Fallback: If agent/middleware is down, falls back to
//             local Z.ai-based Kal V2 (original code path)
//
// RPC ENDPOINTS — Kal Agent (authenticated):
//   POST /api/rpc/analyzeScript     — Start / continue Kal chat
//   POST /api/rpc/generateSummary   — Generate final summary
//   POST /api/rpc/health            — Health check (authenticated)
//
// RPC ENDPOINTS — Kal Middleware (legacy, no auth):
//   POST /api/rpc/analyzeKalScript  — Start / continue Kal chat
//   POST /api/rpc/generateKalSummary— Generate final summary
//   GET  /api/rpc/health            — Health check (unauthenticated)
//
// ═══════════════════════════════════════════════════════════════════════

// ============================================
// CONFIGURATION
// ============================================

/**
 * Kal Agent URL — the authenticated, preferred service.
 * Set via KAL_AGENT_URL env var.
 * Example: https://kal-agent-morpheos255918280.on.adaptive.ai
 */
const KAL_AGENT_URL = process.env.KAL_AGENT_URL || '';

/**
 * Kal Agent API Key — required for authenticated RPC calls.
 * Set via KAL_API_KEY env var.
 * Sent as 'x-kal-api-key' header on every request.
 */
const KAL_API_KEY = process.env.KAL_API_KEY || '';

/**
 * Kal Middleware URL — the legacy, unauthenticated fallback.
 * Only used when KAL_AGENT_URL is not configured.
 * Set via KAL_MIDDLEWARE_URL env var.
 */
const KAL_MIDDLEWARE_BASE_URL =
  process.env.KAL_MIDDLEWARE_URL ||
  'https://kal-middleware-morpheos255918280.adaptive.ai';

/**
 * Determine which backend to use.
 * Agent (authenticated) is preferred over Middleware (legacy).
 */
function getActiveBackend(): { url: string; mode: 'agent' | 'middleware' } {
  if (KAL_AGENT_URL) {
    return { url: KAL_AGENT_URL, mode: 'agent' };
  }
  return { url: KAL_MIDDLEWARE_BASE_URL, mode: 'middleware' };
}

/**
 * Map logical endpoints to the correct path based on backend mode.
 * Agent and Middleware have different RPC endpoint names.
 */
const ENDPOINT_MAP = {
  agent: {
    analyzeScript: '/api/rpc/analyzeScript',
    generateSummary: '/api/rpc/generateSummary',
    health: '/api/rpc/health',
  },
  middleware: {
    analyzeScript: '/api/rpc/analyzeKalScript',
    generateSummary: '/api/rpc/generateKalSummary',
    health: '/api/rpc/health',
  },
} as const;

function getEndpoint(
  name: 'analyzeScript' | 'generateSummary' | 'health',
): string {
  const { mode } = getActiveBackend();
  return ENDPOINT_MAP[mode][name];
}

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
 * Build the headers for an RPC call based on the active backend.
 *
 * Agent mode: sends 'x-kal-api-key' for authentication.
 * Middleware mode: sends 'X-Source' / 'X-Module' for identification.
 */
function buildRpcHeaders(): Record<string, string> {
  const { mode } = getActiveBackend();

  const base: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (mode === 'agent') {
    base['x-kal-api-key'] = KAL_API_KEY;
  } else {
    base['X-Source'] = 'pitch-perfect';
    base['X-Module'] = 'kal-v2';
  }

  return base;
}

/**
 * Call the Kal adaptive backend RPC endpoint.
 *
 * Supports both the authenticated Kal Agent and the legacy Middleware.
 * Includes timeout protection, error handling, and structured logging.
 * If the backend is unreachable, returns a structured error response
 * that triggers the local Z.ai fallback path.
 */
async function kalRpc<TRequest, TResponse>(
  endpoint: string,
  payload: TRequest,
  timeoutMs: number = 15_000,
): Promise<TResponse> {
  const { url: baseUrl, mode } = getActiveBackend();
  const fullUrl = `${baseUrl}${endpoint}`;

  console.log(`[KalClient] RPC → ${endpoint} (mode: ${mode})`);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(fullUrl, {
      method: 'POST',
      headers: buildRpcHeaders(),
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'unknown');
      console.error(
        `[KalClient] RPC ${endpoint} failed: HTTP ${response.status} — ${errorBody.slice(0, 300)}`,
      );
      throw new Error(`Kal ${mode} HTTP ${response.status}: ${errorBody.slice(0, 200)}`);
    }

    const data = await response.json();
    console.log(`[KalClient] RPC ${endpoint} succeeded (mode: ${mode})`);
    return data as TResponse;

  } catch (error: any) {
    // Categorise the error for logging and fallback decisions
    if (error.name === 'AbortError') {
      console.error(`[KalClient] RPC ${endpoint} timed out after ${timeoutMs}ms`);
      throw new Error('KAL_TIMEOUT');
    }

    if (error.cause?.code === 'ECONNREFUSED' || error.cause?.code === 'ENOTFOUND') {
      console.error(`[KalClient] RPC ${endpoint} — connection refused / DNS failure`);
      throw new Error('KAL_UNREACHABLE');
    }

    console.error(`[KalClient] RPC ${endpoint} error: ${error.message}`);
    throw error;
  }
}

// ============================================
// PUBLIC API
// ============================================

/**
 * Start or continue a Kal V2 contextual chat session via the adaptive backend.
 *
 * Call this when:
 *   1. Starting a new Kal session (questionIndex undefined)
 *   2. Continuing after the user answers a question (questionIndex + answer provided)
 *
 * The backend handles:
 *   - Selecting the next question based on the 10-question sequence
 *   - Detecting short/vague answers and generating fallback responses
 *   - Applying the 8-step critical thinking framework
 *   - Adapting question delivery based on user engagement
 *
 * If the backend fails, the caller should fall back to the local
 * Z.ai-based processKalV2Answer() function.
 */
export async function kalMiddlewareAnalyze(
  request: KalMiddlewareAnalyzeRequest,
): Promise<KalMiddlewareAnalyzeResponse> {
  try {
    return await kalRpc<KalMiddlewareAnalyzeRequest, KalMiddlewareAnalyzeResponse>(
      getEndpoint('analyzeScript'),
      request,
      15_000, // 15s timeout — chat is latency-tolerant
    );
  } catch (error: any) {
    console.warn(`[KalClient] Analyze failed: ${error.message}. Will use local fallback.`);
    return {
      success: false,
      error: error.message,
      statusMessage: 'Kal backend unavailable. Using local Kal engine.',
    };
  }
}

/**
 * Generate a Kal V2 summary via the adaptive backend.
 *
 * Called after all 10 questions have been answered. The backend
 * synthesises the Q&A pairs into a structured assessment using the
 * critical thinking framework.
 *
 * If the backend fails, falls back to local Z.ai summary generation.
 */
export async function kalMiddlewareSummary(
  request: KalMiddlewareSummaryRequest,
): Promise<KalMiddlewareSummaryResponse> {
  try {
    return await kalRpc<KalMiddlewareSummaryRequest, KalMiddlewareSummaryResponse>(
      getEndpoint('generateSummary'),
      request,
      30_000, // 30s timeout — summary generation is heavier
    );
  } catch (error: any) {
    console.warn(`[KalClient] Summary failed: ${error.message}. Will use local Z.ai fallback.`);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Check if the Kal backend is reachable.
 * Used by the health check endpoint and pre-warm logic.
 *
 * Agent mode: POST /api/rpc/health with x-kal-api-key header.
 * Middleware mode: GET /api/rpc/health (unauthenticated).
 */
export async function isKalMiddlewareReady(): Promise<{
  ready: boolean;
  latencyMs: number;
  error?: string;
  mode?: 'agent' | 'middleware';
  bridgeStatus?: string;
}> {
  const { url: baseUrl, mode } = getActiveBackend();
  const start = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);

    let response: Response;

    if (mode === 'agent') {
      // Agent health check: POST with API key
      response = await fetch(`${baseUrl}${ENDPOINT_MAP.agent.health}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-kal-api-key': KAL_API_KEY,
        },
        body: JSON.stringify({}),
        signal: controller.signal,
      });
    } else {
      // Middleware health check: GET (unauthenticated)
      response = await fetch(`${baseUrl}${ENDPOINT_MAP.middleware.health}`, {
        method: 'GET',
        signal: controller.signal,
      });
    }

    clearTimeout(timeout);

    let bridgeStatus: string | undefined;
    if (response.ok) {
      try {
        const data = await response.json();
        bridgeStatus = data.bridgeStatus ?? data.status;
      } catch {
        // JSON parse failed — still OK, just no bridge status
      }
    }

    return {
      ready: response.ok,
      latencyMs: Date.now() - start,
      mode,
      bridgeStatus,
    };
  } catch (error: any) {
    return {
      ready: false,
      latencyMs: Date.now() - start,
      mode,
      error: error.message,
    };
  }
}

/**
 * Get the configured backend URL and mode.
 * Useful for logging and debugging.
 */
export function getKalMiddlewareUrl(): string {
  const { url, mode } = getActiveBackend();
  return `${url} (mode: ${mode})`;
}

/**
 * Get detailed backend info for health/diagnostics.
 */
export function getKalBackendInfo(): {
  activeUrl: string;
  mode: 'agent' | 'middleware';
  agentConfigured: boolean;
  middlewareConfigured: boolean;
  agentHasApiKey: boolean;
} {
  const { url, mode } = getActiveBackend();
  return {
    activeUrl: url,
    mode,
    agentConfigured: !!KAL_AGENT_URL,
    middlewareConfigured: !!KAL_MIDDLEWARE_BASE_URL,
    agentHasApiKey: !!KAL_API_KEY,
  };
}
