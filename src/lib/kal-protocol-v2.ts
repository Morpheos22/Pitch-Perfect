/**
 * Kal Protocol v2 — stub (Kal Agent removed).
 * Cloudflare Workers AI handles all AI coaching directly now.
 */

export const KAL_V2_SYSTEM_PROMPT = '';

export interface KalChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export async function runKalProtocol(
  _messages: KalChatMessage[]
): Promise<{ response: string; success: boolean; quickFeedback?: string }> {
  return { response: '', success: false };
}

export async function activateKalV2(_data: unknown): Promise<{ activated: boolean; reason: string; chatSessionId?: string; firstQuestion?: string }> {
  return { activated: false, reason: 'Kal Agent removed — using Cloudflare Workers AI' };
}

export const KAL_V2_PLACEHOLDER_MESSAGE = 'Kal Agent v2 is no longer available. Using Cloudflare Workers AI.';

export function isKalConfigured(): boolean {
  return false;
}
