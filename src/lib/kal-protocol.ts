/**
 * Kal protocol v1 — stub (Kal Agent removed).
 */

export async function runKalChat(_data: unknown): Promise<{ response: string; success: boolean }> {
  return { response: '', success: false };
}

export async function activateKalProtocol(_data: unknown): Promise<{ activated: boolean; reason: string; chatSessionId?: string; firstQuestion?: string }> {
  return { activated: false, reason: 'Kal Agent removed — using Cloudflare Workers AI' };
}

export const KAL_PLACEHOLDER_MESSAGE = 'Kal Agent is no longer available. Using Cloudflare Workers AI.';
