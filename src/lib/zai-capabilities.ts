/**
 * ZAI capabilities — stub (Z.ai removed, using Cloudflare Workers AI).
 */

export const ZAI_CAPABILITIES = {
  text: true,
  vision: true,
  audio: false,
  functions: false,
};

export function getZAICapabilities() {
  return ZAI_CAPABILITIES;
}

// Stubs for removed Z.ai capabilities
export async function webSearch(_query: string, _opts?: unknown): Promise<any[]> {
  return [];
}

export async function synthesizeSpeech(_text: string, _opts?: unknown): Promise<Buffer | null> {
  return null;
}
