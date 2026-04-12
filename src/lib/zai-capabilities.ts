// Z.ai Capabilities Layer for Pitch Perfect × Automagikal
// Active capabilities: TTS, Web Search
// Powered by the z-ai-web-dev-sdk
//
// Dead exports removed (Phase 3 hardening):
//   - transcribeAudio (ASR) — zero callers
//   - readPage — zero callers
//   - generateImage — zero callers
//   - editImage — zero callers
//   - generateVideo — zero callers
//   - getVideoResult — zero callers
//   - checkCapabilitiesHealth — zero callers

// NOTE: Z.ai SDK initialization (config writing) is handled centrally in ai-service.ts.
// This module creates its own SDK instance for capability functions but shares
// the same config file that ai-service.ts writes.

// ============================================
// SHARED SDK INSTANCE
// ============================================

type ZAIInstance = Awaited<ReturnType<typeof import('z-ai-web-dev-sdk').default.create>>;

let _zai: ZAIInstance | null = null;

async function getZai(): Promise<ZAIInstance> {
  if (_zai) return _zai;
  // ai-service.ts handles config creation on first call;
  // trigger it by importing to ensure .z-ai-config exists
  await import('./ai-service');
  const { default: ZAI } = await import('z-ai-web-dev-sdk');
  _zai = await ZAI.create();
  return _zai;
}

// ============================================
// TTS — Text-to-Speech
// ============================================
// Module mapping: FEEDBACK_NARRATION
// Used by: E5 Founder (PATHWAY_NARRATION module)
// Use case: Narrate coaching feedback for accessibility, audio reports

export type TTSVoice = 'tongtong' | 'chelsie' | 'diana' | 'emma' | 'aria';

export interface TTSOptions {
  voice?: TTSVoice;
  speed?: number;        // 0.5–2.0, default 1.0
  responseFormat?: 'wav' | 'pcm';
}

export async function synthesizeSpeech(
  text: string,
  options: TTSOptions = {}
): Promise<Buffer> {
  const zai = await getZai();
  const response = await zai.audio.tts.create({
    input: text,
    voice: options.voice || 'tongtong',
    speed: options.speed || 1.0,
    response_format: options.responseFormat || 'wav',
  });

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ============================================
// WEB SEARCH
// ============================================
// Module mapping: MARKET_RESEARCH, E4_COMPETITIVE_INTEL
// Used by: E5 Founder (INVESTOR_RESEARCH module)
// Use case: Validate market claims, competitive intelligence, investor research

export interface WebSearchResult {
  url: string;
  name: string;
  snippet: string;
  hostName: string;
  rank: number;
  date: string;
  favicon: string;
}

export async function webSearch(
  query: string,
  options?: { num?: number; recencyDays?: number }
): Promise<WebSearchResult[]> {
  const zai = await getZai();
  const results = await zai.functions.invoke('web_search', {
    query,
    num: options?.num || 5,
    recency_days: options?.recencyDays,
  });
  return (results as any[]).map((r: any) => ({ ...r, hostName: r.host_name || r.hostName || '' }));
}
