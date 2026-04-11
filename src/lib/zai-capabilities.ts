// Z.ai Capabilities Layer for Pitch Perfect × Automagikal
// Full suite: ASR, TTS, Web Search, Image Gen, Video Gen
// All powered by the z-ai-web-dev-sdk

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
// ASR — Speech-to-Text
// ============================================
// Module mapping: E3_TRANSCRIPTION, E4_FULL_SESSION
// Use case: Transcribe video recordings for deeper text analysis

export interface ASRResult {
  text: string;
  confidence?: number;
}

export async function transcribeAudio(audioSource: string | Buffer): Promise<ASRResult> {
  const zai = await getZai();
  const params: Record<string, unknown> = {};

  if (typeof audioSource === 'string') {
    // Assume it's a base64 string or file path
    if (audioSource.startsWith('data:') || audioSource.length > 1000) {
      params.file_base64 = audioSource;
    } else {
      params.file = audioSource;
    }
  } else {
    // Buffer → base64
    params.file_base64 = audioSource.toString('base64');
  }

  const response = await zai.audio.asr.create(params as any);
  return {
    text: response.text || response.data?.text || '',
    confidence: response.confidence || response.data?.confidence,
  };
}

// ============================================
// TTS — Text-to-Speech
// ============================================
// Module mapping: FEEDBACK_NARRATION
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

// ============================================
// PAGE READER — Read web page content
// ============================================
// Use case: Deep-read investor articles, competitor websites

export interface PageContent {
  html: string;
  title: string;
  url: string;
  publishedTime?: string;
}

export async function readPage(url: string): Promise<PageContent> {
  // SSRF prevention — HTTPS only, block private IPs
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') {
      throw new Error('Only HTTPS URLs are supported');
    }
    const host = parsed.hostname;
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
      host.startsWith('169.254.') ||
      host === '[::1]' ||
      host === '0.0.0.0'
    ) {
      throw new Error('Private/internal URLs are not allowed');
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes('URLs are not allowed')) throw e;
    if (e instanceof Error && e.message.includes('Invalid URL')) throw e;
    throw new Error('Invalid URL');
  }

  const zai = await getZai();
  const result = await zai.functions.invoke('page_reader', { url });
  return {
    html: result.data.html,
    title: result.data.title,
    url: result.data.url,
    publishedTime: result.data.publishedTime,
  };
}

// ============================================
// IMAGE GENERATION
// ============================================
// Module mapping: REPORT_COVER
// Use case: Generate report covers, pitch deck template visuals

export type ImageSize = '1024x1024' | '768x1344' | '864x1152' | '1344x768' | '1152x864' | '1440x720' | '720x1440';

export interface GeneratedImage {
  base64: string;
  mimeType?: string;
}

export async function generateImage(
  prompt: string,
  options?: { size?: ImageSize; model?: string }
): Promise<GeneratedImage> {
  const zai = await getZai();
  const response = await zai.images.generations.create({
    prompt,
    size: options?.size || '1024x1024',
    model: options?.model,
  });

  if (!response.data?.length) {
    throw new Error('Image generation returned no data');
  }

  return {
    base64: response.data[0].base64,
    mimeType: 'image/png',
  };
}

export async function editImage(
  prompt: string,
  image: string,  // URL or data URI
  options?: { size?: ImageSize; model?: string }
): Promise<GeneratedImage> {
  // SSRF prevention: validate image URL if not a data URI
  if (!image.startsWith('data:')) {
    try {
      const parsed = new URL(image);
      if (!['https:', 'http:'].includes(parsed.protocol)) {
        throw new Error('Only HTTP/HTTPS URLs are supported for image');
      }
    } catch {
      throw new Error('Invalid image URL');
    }
  }

  const zai = await getZai();
  const response = await zai.images.generations.edit({
    prompt,
    image,
    size: options?.size || '1024x1024',
    model: options?.model,
  });

  if (!response.data?.length) {
    throw new Error('Image edit returned no data');
  }

  return {
    base64: response.data[0].base64,
    mimeType: 'image/png',
  };
}

// ============================================
// VIDEO GENERATION (Async)
// ============================================
// Use case: Marketing demos, coaching example videos

export interface VideoGenOptions {
  prompt?: string;
  imageUrl?: string | string[];
  quality?: 'speed' | 'quality';
  withAudio?: boolean;
  watermarkEnabled?: boolean;
  size?: string;
  fps?: 30 | 60;
  duration?: 5 | 10;
}

export interface VideoGenResult {
  taskId: string;
  status: 'PROCESSING' | 'SUCCESS' | 'FAIL';
}

export async function generateVideo(options: VideoGenOptions): Promise<VideoGenResult> {
  const zai = await getZai();
  const response = await zai.video.generations.create({
    prompt: options.prompt,
    image_url: options.imageUrl,
    quality: options.quality || 'speed',
    with_audio: options.withAudio || false,
    watermark_enabled: options.watermarkEnabled ?? true,
    size: options.size,
    fps: options.fps,
    duration: options.duration,
  });

  return {
    taskId: response.id || response.request_id || '',
    status: response.task_status || 'PROCESSING',
  };
}

export async function getVideoResult(taskId: string): Promise<{
  status: string;
  videoUrl?: string;
  videoBase64?: string;
}> {
  const zai = await getZai();
  const response = await zai.async.result.query(taskId);

  const videoUrl =
    response.video_result?.[0]?.url ||
    response.video_url ||
    response.url ||
    response.video;

  return {
    status: response.task_status || 'UNKNOWN',
    videoUrl: videoUrl,
  };
}

// ============================================
// CAPABILITY HEALTH CHECK
// ============================================

export async function checkCapabilitiesHealth(): Promise<{
  asr: { available: boolean; error?: string };
  tts: { available: boolean; error?: string };
  webSearch: { available: boolean; error?: string };
  imageGen: { available: boolean; error?: string };
  videoGen: { available: boolean; error?: string };
}> {
  const zai = await getZai();

  // ASR: check endpoint exists (will fail without file, but 400 = endpoint exists)
  let asrOk = false, asrErr = '';
  try {
    await zai.audio.asr.create({ file: '' });
  } catch (e: any) {
    asrOk = e.message?.includes('1214') || e.message?.includes('file');
    asrErr = asrOk ? '' : e.message;
  }

  // TTS: actual test
  let ttsOk = false, ttsErr = '';
  try {
    const r = await zai.audio.tts.create({ input: 'test', voice: 'tongtong' });
    const buf = await r.arrayBuffer();
    ttsOk = buf.byteLength > 0;
  } catch (e: any) { ttsErr = e.message; }

  // Web Search
  let wsOk = false, wsErr = '';
  try {
    const results = await zai.functions.invoke('web_search', { query: 'test', num: 1 });
    wsOk = Array.isArray(results);
  } catch (e: any) { wsErr = e.message; }

  // Image Gen
  let igOk = false, igErr = '';
  try {
    const r = await zai.images.generations.create({ prompt: 'test dot', size: '1024x1024' });
    igOk = !!r.data?.[0]?.base64;
  } catch (e: any) { igErr = e.message; }

  // Video Gen
  let vgOk = false, vgErr = '';
  try {
    const r = await zai.video.generations.create({ prompt: 'test' });
    vgOk = !!r.id || !!r.request_id;
  } catch (e: any) { vgErr = e.message; }

  return {
    asr: { available: asrOk, error: asrErr },
    tts: { available: ttsOk, error: ttsErr },
    webSearch: { available: wsOk, error: wsErr },
    imageGen: { available: igOk, error: igErr },
    videoGen: { available: vgOk, error: vgErr },
  };
}
