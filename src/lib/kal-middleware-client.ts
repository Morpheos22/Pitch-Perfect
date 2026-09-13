/**
 * Kal middleware client — stub (Kal Agent removed).
 * Returns objects with the shape that /api/coach/diagnostic expects,
 * but all values indicate "not configured."
 */

export async function callKalMiddleware(_data: unknown): Promise<null> {
  return null;
}

export function isKalMiddlewareConfigured(): boolean {
  return false;
}

export function isKalMiddlewareReady(): {
  ready: boolean;
  latencyMs: number | null;
  bridgeStatus: string;
  error: string | null;
  mode: string;
} {
  return {
    ready: false,
    latencyMs: null,
    bridgeStatus: 'disabled',
    error: 'Kal Agent removed — using Cloudflare Workers AI',
    mode: 'disabled',
  };
}

export function getKalBackendInfo(): {
  configured: boolean;
  url: string | null;
  mode: string;
  activeUrl: string | null;
  agentConfigured: boolean;
  agentHasApiKey: boolean;
  middlewareConfigured: boolean;
} {
  return {
    configured: false,
    url: null,
    mode: 'disabled',
    activeUrl: null,
    agentConfigured: false,
    agentHasApiKey: false,
    middlewareConfigured: false,
  };
}

export async function kalMiddlewareAnalyze(_data: unknown): Promise<{
  success: boolean;
  quickFeedback?: string;
  response?: string;
} | null> {
  return null;
}
