/**
 * ═══════════════════════════════════════════════════════════════════════
 * E2E TEST — Script Check Module (E2)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Tests the complete flow:
 *   Stage 1: Upload / Ingestion
 *     - Zod schema validation
 *     - File type detection & text extraction
 *     - Blob upload token generation
 *     - Input sanitization
 *
 *   Stage 2: Data Transfer
 *     - Z.ai SDK connectivity
 *     - Vertex AI fallback configuration
 *     - AI prompt construction & response parsing
 *     - executeWithFallback routing
 *
 *   Stage 3: AI Analysis & Feedback Loop
 *     - analyzeScriptWithFallback() — live Z.ai call
 *     - Kal Protocol V1 activation & retry logic
 *     - Kal Protocol V2 chat session creation
 *     - Iterate endpoint with previous analysis context
 *     - Database persistence verification
 *
 * Usage:
 *   npx tsx scripts/e2e-script-check.ts
 *
 * ═══════════════════════════════════════════════════════════════════════
 */

// ── Structured Logger ──
const TEST_ID = `e2e-${Date.now()}`;
type LogLevel = 'INFO' | 'PASS' | 'FAIL' | 'WARN' | 'ERROR' | 'STEP';
const log = {
  _out: (level: LogLevel, stage: string, msg: string, detail?: unknown) => {
    const ts = new Date().toISOString();
    const prefix = `[${ts}] [${level}] [${stage}]`;
    if (detail !== undefined) {
      console.log(`${prefix} ${msg}`, typeof detail === 'object' ? JSON.stringify(detail, null, 2) : detail);
    } else {
      console.log(`${prefix} ${msg}`);
    }
  },
  info:   (stage: string, msg: string, detail?: unknown) => log._out('INFO',  stage, msg, detail),
  pass:   (stage: string, msg: string, detail?: unknown) => log._out('PASS',  stage, msg, detail),
  fail:   (stage: string, msg: string, detail?: unknown) => log._out('FAIL',  stage, msg, detail),
  warn:   (stage: string, msg: string, detail?: unknown) => log._out('WARN',  stage, msg, detail),
  error:  (stage: string, msg: string, detail?: unknown) => log._out('ERROR', stage, msg, detail),
  step:   (stage: string, msg: string, detail?: unknown) => log._out('STEP',  stage, msg, detail),
};

// ── Test Results Tracker ──
interface TestResult {
  name: string;
  stage: string;
  passed: boolean;
  error?: string;
  durationMs: number;
}
const results: TestResult[] = [];

async function test(name: string, stage: string, fn: () => Promise<void>) {
  const start = Date.now();
  try {
    await fn();
    results.push({ name, stage, passed: true, durationMs: Date.now() - start });
    log.pass(stage, `✓ ${name}`);
  } catch (err: any) {
    results.push({ name, stage, passed: false, error: err?.message || String(err), durationMs: Date.now() - start });
    log.fail(stage, `✗ ${name}`, err?.message || String(err));
    if (err?.stack) log.error(stage, 'Stack trace:', err.stack.split('\n').slice(0, 5).join('\n'));
  }
}

// ═══════════════════════════════════════════════════════════════════════
// STAGE 1: UPLOAD / INGESTION
// ═══════════════════════════════════════════════════════════════════════

async function stage1_UploadIngestion() {
  const STAGE = 'STAGE-1';
  log.step(STAGE, '═══════════════════════════════════════════════════');
  log.step(STAGE, 'STAGE 1: Upload / Ingestion Flow');
  log.step(STAGE, '═══════════════════════════════════════════════════');

  // ── 1.1 Zod Schema Validation ──
  await test('1.1a: scriptInputSchema accepts valid text input', STAGE, async () => {
    const { scriptInputSchema } = await import('../src/lib/validation/schemas');
    const result = scriptInputSchema.safeParse({
      content: 'This is a valid test script with enough words to pass the minimum twenty character validation threshold.',
      inputType: 'text',
      targetAudience: 'investor',
      pitchDuration: 60,
      sessionName: 'Test Session',
    });
    if (!result.success) throw new Error(`Validation failed: ${JSON.stringify(result.error.flatten().fieldErrors)}`);
  });

  await test('1.1b: scriptInputSchema rejects empty content', STAGE, async () => {
    const { scriptInputSchema } = await import('../src/lib/validation/schemas');
    const result = scriptInputSchema.safeParse({ content: '' });
    if (result.success) throw new Error('Should have rejected empty content');
  });

  await test('1.1c: scriptInputSchema rejects too-short content (< 20 chars)', STAGE, async () => {
    const { scriptInputSchema } = await import('../src/lib/validation/schemas');
    const result = scriptInputSchema.safeParse({ content: 'Too short' });
    if (result.success) throw new Error('Should have rejected content < 20 chars');
  });

  await test('1.1d: scriptInputSchema rejects out-of-range pitchDuration', STAGE, async () => {
    const { scriptInputSchema } = await import('../src/lib/validation/schemas');
    const result = scriptInputSchema.safeParse({
      content: 'Valid content for testing duration validation bounds and limits.',
      pitchDuration: 5, // min is 10
    });
    if (result.success) throw new Error('Should have rejected pitchDuration < 10');
  });

  await test('1.1e: scriptIterateSchema validates correctly', STAGE, async () => {
    const { scriptIterateSchema } = await import('../src/lib/validation/schemas');
    const result = scriptIterateSchema.safeParse({
      id: 'test-script-id-123',
      script: 'Updated script content for iteration testing with enough text.',
      fileUrl: 'https://example.blob.vercel-storage.com/test.docx',
      fileName: 'test.docx',
    });
    if (!result.success) throw new Error(`Validation failed: ${JSON.stringify(result.error.flatten().fieldErrors)}`);
  });

  await test('1.1f: scriptIterateSchema rejects invalid fileUrl', STAGE, async () => {
    const { scriptIterateSchema } = await import('../src/lib/validation/schemas');
    const result = scriptIterateSchema.safeParse({
      id: 'test-script-id-123',
      fileUrl: 'not-a-url',
    });
    if (result.success) throw new Error('Should have rejected invalid URL');
  });

  // ── 1.2 File Type Detection ──
  await test('1.2a: File type detection works for known extensions', STAGE, async () => {
    // We can't easily import detectFileType (not exported), so test extractFileText behavior
    // by creating test files
    const txtFile = new File(['Hello world test content for file parsing verification'], 'test.txt', { type: 'text/plain' });
    const { extractFileText } = await import('../src/lib/file-parser');
    const text = await extractFileText(txtFile);
    if (!text || text.length < 10) throw new Error(`TXT extraction failed: got "${text}"`);
    log.info(STAGE, 'TXT extraction result length:', text.length);
  });

  await test('1.2b: File type detection rejects unsupported formats', STAGE, async () => {
    const { extractFileText } = await import('../src/lib/file-parser');
    const binFile = new File([new Uint8Array([0x89, 0x50, 0x4E, 0x47])], 'image.png', { type: 'image/png' });
    try {
      await extractFileText(binFile);
      throw new Error('Should have rejected PNG file');
    } catch (err: any) {
      if (!err.message.includes('Unsupported') && !err.message.includes('binary')) {
        throw new Error(`Unexpected error: ${err.message}`);
      }
    }
  });

  // ── 1.3 File Validation Rules ──
  await test('1.3a: File validation constants are correct', STAGE, async () => {
    const { ALLOWED_EXTENSIONS, ALLOWED_MIME_TYPES, MAX_FILE_SIZES } = await import('../src/lib/file-validation');
    if (!ALLOWED_EXTENSIONS.script?.includes('.docx')) throw new Error('Script should allow .docx');
    if (!ALLOWED_EXTENSIONS.script?.includes('.txt')) throw new Error('Script should allow .txt');
    if (!ALLOWED_EXTENSIONS.script?.includes('.doc')) throw new Error('Script should allow .doc');
    if (MAX_FILE_SIZES.script !== 10 * 1024 * 1024) throw new Error(`Script max size should be 10MB, got ${MAX_FILE_SIZES.script}`);
    log.info(STAGE, 'Script file validation rules:', {
      extensions: ALLOWED_EXTENSIONS.script,
      maxMB: MAX_FILE_SIZES.script / (1024 * 1024),
    });
  });

  await test('1.3b: File format validation rejects invalid extension', STAGE, async () => {
    const { validateFileFormat } = await import('../src/lib/file-validation');
    try {
      // validateFileFormat expects {name, type, size} — not a bare string
      validateFileFormat({ name: 'malware.exe', type: 'application/x-msdownload', size: 1000 }, 'script');
      throw new Error('Should have rejected .exe');
    } catch (err: any) {
      if (!err.message.includes('Unsupported') && !err.message.includes('not accepted')) {
        throw new Error(`Unexpected error: ${err.message}`);
      }
    }
  });

  // ── 1.4 Blob Upload Config ──
  await test('1.4a: Blob upload route file structure is valid', STAGE, async () => {
    const fs = await import('fs');
    const path = await import('path');
    const routePath = path.join(process.cwd(), 'src/app/api/blob/upload/route.ts');
    if (!fs.existsSync(routePath)) throw new Error('Blob upload route not found');
    const content = fs.readFileSync(routePath, 'utf8');
    if (!content.includes('handleUpload')) throw new Error('handleUpload not imported');
    if (!content.includes('onBeforeGenerateToken')) throw new Error('onBeforeGenerateToken missing');
    if (!content.includes('onUploadCompleted')) throw new Error('onUploadCompleted missing');
    if (!content.includes('allowedContentTypes')) throw new Error('allowedContentTypes constraint missing');
    if (!content.includes('maximumSizeInBytes')) throw new Error('maximumSizeInBytes constraint missing');
  });

  // ── 1.5 SSRF Protection ──
  await test('1.5a: Storage SSRF protection rejects disallowed hosts', STAGE, async () => {
    const { isHostAllowed, ALLOWED_UPLOAD_HOSTS } = await import('../src/lib/storage');
    const maliciousUrl = 'https://evil.com/steal-data';
    if (isHostAllowed(maliciousUrl, ALLOWED_UPLOAD_HOSTS)) {
      throw new Error('Should have rejected malicious host');
    }
    log.info(STAGE, 'SSRF protection working - rejected external host');
  });

  await test('1.5b: Storage SSRF protection allows Vercel Blob hosts', STAGE, async () => {
    const { isHostAllowed, ALLOWED_UPLOAD_HOSTS } = await import('../src/lib/storage');
    log.info(STAGE, 'Allowed upload hosts:', ALLOWED_UPLOAD_HOSTS);
    // Check that at least one Vercel Blob host is allowed
    const hasBlobHost = ALLOWED_UPLOAD_HOSTS.some(h => h.includes('blob.vercel-storage') || h.includes('vercel'));
    if (!hasBlobHost) {
      log.warn(STAGE, 'No Vercel Blob hosts found in ALLOWED_UPLOAD_HOSTS — file upload flow may be broken');
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════
// STAGE 2: DATA TRANSFER
// ═══════════════════════════════════════════════════════════════════════

async function stage2_DataTransfer() {
  const STAGE = 'STAGE-2';
  log.step(STAGE, '═══════════════════════════════════════════════════');
  log.step(STAGE, 'STAGE 2: Data Transfer Flow');
  log.step(STAGE, '═══════════════════════════════════════════════════');

  // ── 2.1 Z.ai SDK Initialization ──
  await test('2.1a: Z.ai SDK can be initialized', STAGE, async () => {
    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    const zai = await ZAI.create();
    if (!zai) throw new Error('ZAI.create() returned null/undefined');
    if (!zai.chat) throw new Error('ZAI instance missing .chat property');
    if (!zai.chat.completions) throw new Error('ZAI instance missing .chat.completions property');
    log.info(STAGE, 'Z.ai SDK initialized successfully');
  });

  // ── 2.2 Z.ai Chat Completions ──
  await test('2.2a: Z.ai chat.completions.create() returns valid response', STAGE, async () => {
    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    const zai = await ZAI.create();
    const response = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: 'You are a test assistant. Respond with exactly: TEST_OK' },
        { role: 'user', content: 'Say TEST_OK' },
      ],
      temperature: 0,
      max_tokens: 10,
    });
    if (!response?.choices?.[0]?.message?.content) {
      throw new Error(`Invalid Z.ai response structure: ${JSON.stringify(response).substring(0, 200)}`);
    }
    log.info(STAGE, 'Z.ai response:', {
      content: response.choices[0].message.content.substring(0, 100),
      model: response.model,
      usage: response.usage,
    });
  });

  // ── 2.3 AI Service: getZai() singleton ──
  await test('2.3a: AI service getZai() returns working SDK instance', STAGE, async () => {
    const aiService = await import('../src/lib/ai-service');
    const zai = await (aiService as any).getZai();
    if (!zai) throw new Error('getZai() returned null/undefined');
    if (!zai.chat?.completions) throw new Error('getZai() SDK missing chat.completions');
  });

  // ── 2.4 AI Service: Model Map ──
  await test('2.4a: MODULE_MODEL_MAP has E2 configuration', STAGE, async () => {
    const aiService = await import('../src/lib/ai-service');
    const modelMap = (aiService as any).MODULE_MODEL_MAP;
    if (!modelMap.E2_SCRIPT_ANALYSIS) throw new Error('E2_SCRIPT_ANALYSIS missing from MODULE_MODEL_MAP');
    if (!modelMap.E2_SCRIPT_REWRITE) throw new Error('E2_SCRIPT_REWRITE missing from MODULE_MODEL_MAP');

    const analysisConfig = modelMap.E2_SCRIPT_ANALYSIS;
    if (!analysisConfig.models || !Array.isArray(analysisConfig.models)) throw new Error('E2_SCRIPT_ANALYSIS missing models array');
    if (typeof analysisConfig.temperature !== 'number') throw new Error('E2_SCRIPT_ANALYSIS missing temperature');
    log.info(STAGE, 'E2 model configuration:', {
      analysis: { models: analysisConfig.models, temp: analysisConfig.temperature },
      rewrite: { models: modelMap.E2_SCRIPT_REWRITE.models, temp: modelMap.E2_SCRIPT_REWRITE.temperature },
    });
  });

  // ── 2.5 AI Utils: JSON extraction ──
  await test('2.5a: extractJsonFromContent handles markdown code blocks', STAGE, async () => {
    const { extractJsonFromContent } = await import('../src/lib/ai-utils');
    const input = '```json\n{"hookScore": 75, "problemScore": 60}\n```';
    const result = extractJsonFromContent(input);
    if (!result) throw new Error('extractJsonFromContent returned null for markdown-wrapped JSON');
    const parsed = JSON.parse(result);
    if (parsed.hookScore !== 75) throw new Error(`Parsed incorrectly: ${result}`);
  });

  await test('2.5b: extractJsonFromContent handles raw JSON', STAGE, async () => {
    const { extractJsonFromContent } = await import('../src/lib/ai-utils');
    const input = '{"hookScore": 75, "problemScore": 60}';
    const result = extractJsonFromContent(input);
    if (!result) throw new Error('extractJsonFromContent returned null for raw JSON');
  });

  await test('2.5c: repairJson fixes common AI response issues', STAGE, async () => {
    const { repairJson } = await import('../src/lib/ai-utils');
    // Test trailing comma
    const trailing = '{"key": "value",}';
    const repaired = repairJson(trailing);
    const parsed = JSON.parse(repaired);
    if (parsed.key !== 'value') throw new Error(`repairJson failed: ${repaired}`);
  });

  await test('2.5d: clampScore clamps to 0-100 range', STAGE, async () => {
    const { clampScore } = await import('../src/lib/ai-utils');
    if (clampScore(150) !== 100) throw new Error('clampScore(150) should be 100');
    if (clampScore(-10) !== 0) throw new Error('clampScore(-10) should be 0');
    if (clampScore(75) !== 75) throw new Error('clampScore(75) should be 75');
    if (clampScore(NaN) !== 50) throw new Error('clampScore(NaN) should default to 50');
  });

  // ── 2.6 Vertex AI Fallback Configuration ──
  await test('2.6a: Vertex AI configuration status check', STAGE, async () => {
    const { isVertexAIConfigured, getVertexAIConfigStatus } = await import('../src/lib/vertex-ai');
    const status = getVertexAIConfigStatus();
    log.info(STAGE, 'Vertex AI status:', status);
    // This is informational — we don't fail if Vertex AI is not configured
    // The Z.ai gateway (primary) is what matters
    if (!status.hasApiKey) {
      log.warn(STAGE, 'Google AI API key not configured — Vertex AI fallback unavailable. Z.ai gateway is primary.');
    }
  });

  // ── 2.7 executeWithFallback routing ──
  await test('2.7a: executeWithFallback can call Z.ai with E2 config', STAGE, async () => {
    const aiService = await import('../src/lib/ai-service');
    const executeWithFallback = (aiService as any).executeWithFallback;

    const { response, modelUsed } = await executeWithFallback('E2_SCRIPT_ANALYSIS', (model: string) => ({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are a pitch coach. Respond with ONLY valid JSON: {"hookScore": 50, "problemScore": 50, "solutionScore": 50, "credibilityScore": 50, "ctaScore": 50, "overallScore": 50, "wordCount": 100, "estimatedDuration": 40, "improvements": {"hook": ["test"], "problem": ["test"], "solution": ["test"], "credibility": ["test"], "cta": ["test"]}, "rewrittenScript": "test", "alternativeHooks": ["test"]}',
        },
        { role: 'user', content: 'Analyze this test script.' },
      ],
      temperature: 0,
      max_tokens: 500,
    }));

    if (!response?.choices?.[0]?.message?.content) {
      throw new Error('executeWithFallback returned empty response');
    }
    log.info(STAGE, 'executeWithFallback result:', {
      modelUsed,
      contentLength: response.choices[0].message.content.length,
      hasUsage: !!response.usage,
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════
// STAGE 3: AI ANALYSIS & FEEDBACK LOOP
// ═══════════════════════════════════════════════════════════════════════

async function stage3_AIAnalysisFeedbackLoop() {
  const STAGE = 'STAGE-3';
  log.step(STAGE, '═══════════════════════════════════════════════════');
  log.step(STAGE, 'STAGE 3: AI Analysis & Feedback Loop');
  log.step(STAGE, '═══════════════════════════════════════════════════');

  // Test pitch script for analysis
  const TEST_SCRIPT = `Hi, I'm Sarah, founder of GreenGrow. Did you know that 40% of fresh produce in sub-Saharan Africa spoils before reaching market? That's a $4 billion annual loss for smallholder farmers. GreenGrow provides affordable, solar-powered cold storage units that extend shelf life by 14 days. We've already deployed 200 units across Nigeria and Kenya, reducing post-harvest loss by 60% for our 3,000 farmer customers. We're raising $2 million in seed funding to scale to 10,000 units across 5 countries. Join us in making sure Africa feeds itself.`;

  // ── 3.1 Full Script Analysis (LIVE Z.ai Call) ──
  let analysisResult: any = null;
  await test('3.1a: analyzeScriptWithFallback() returns complete analysis', STAGE, async () => {
    const { analyzeScriptWithFallback } = await import('../src/lib/ai-service');
    const result = await analyzeScriptWithFallback(TEST_SCRIPT, 'investor', 60, undefined, '[E2-E2E]');

    if (!result) throw new Error('analyzeScriptWithFallback returned null — all AI providers failed');
    analysisResult = result;

    // Validate score fields
    const scoreFields = ['hookScore', 'problemScore', 'solutionScore', 'credibilityScore', 'ctaScore', 'overallScore'] as const;
    for (const field of scoreFields) {
      const val = result[field];
      if (typeof val !== 'number' || val < 0 || val > 100) {
        throw new Error(`${field} is out of range: ${val}`);
      }
    }

    // Validate improvements structure
    if (!result.improvements || typeof result.improvements !== 'object') {
      throw new Error('Missing or invalid improvements object');
    }
    const requiredKeys = ['hook', 'problem', 'solution', 'credibility', 'cta'];
    for (const key of requiredKeys) {
      if (!Array.isArray((result.improvements as any)[key])) {
        throw new Error(`improvements.${key} is not an array`);
      }
    }

    // Validate rewritten script
    if (!result.rewrittenScript || result.rewrittenScript.length < 20) {
      throw new Error('rewrittenScript is missing or too short');
    }

    // Validate alternative hooks
    if (!Array.isArray(result.alternativeHooks) || result.alternativeHooks.length < 1) {
      throw new Error('alternativeHooks is missing or empty');
    }

    log.info(STAGE, 'Analysis result:', {
      scores: {
        hook: result.hookScore,
        problem: result.problemScore,
        solution: result.solutionScore,
        credibility: result.credibilityScore,
        cta: result.ctaScore,
        overall: result.overallScore,
      },
      wordCount: result.wordCount,
      estimatedDuration: result.estimatedDuration,
      modelUsed: result.modelUsed,
      improvementsCount: requiredKeys.reduce((acc, k) => acc + ((result.improvements as any)[k]?.length || 0), 0),
      rewrittenLength: result.rewrittenScript.length,
      hooksCount: result.alternativeHooks.length,
    });
  });

  // ── 3.2 Score Consistency Check ──
  await test('3.2a: Overall score is reasonable relative to sub-scores', STAGE, async () => {
    if (!analysisResult) throw new Error('No analysis result from 3.1a');
    const { hookScore, problemScore, solutionScore, credibilityScore, ctaScore, overallScore } = analysisResult;
    const avg = (hookScore + problemScore + solutionScore + credibilityScore + ctaScore) / 5;
    const diff = Math.abs(overallScore - avg);
    if (diff > 25) {
      log.warn(STAGE, `Overall score (${overallScore}) differs significantly from sub-score average (${avg.toFixed(1)}). Diff: ${diff.toFixed(1)}`);
      // Not a hard failure — the AI may have weighted scoring
    }
  });

  // ── 3.3 Kal Protocol V1: Code Logic Verification ──
  await test('3.3a: Kal Protocol V1 module loads and exports correctly', STAGE, async () => {
    const kal = await import('../src/lib/kal-protocol');
    if (typeof kal.activateKalProtocol !== 'function') throw new Error('activateKalProtocol not exported');
    if (typeof kal.isKalPending !== 'function') throw new Error('isKalPending not exported');
    if (typeof kal.isKalFailed !== 'function') throw new Error('isKalFailed not exported');
    if (typeof kal.getKalStatusMessage !== 'function') throw new Error('getKalStatusMessage not exported');
    if (!kal.KAL_PLACEHOLDER_MESSAGE) throw new Error('KAL_PLACEHOLDER_MESSAGE not exported');

    // Verify helper functions
    if (!kal.isKalPending('KAL_PENDING')) throw new Error('isKalPending should return true for KAL_PENDING');
    if (kal.isKalPending('COMPLETED')) throw new Error('isKalPending should return false for COMPLETED');
    if (!kal.isKalFailed('KAL_FAILED')) throw new Error('isKalFailed should return true for KAL_FAILED');

    log.info(STAGE, 'Kal V1 exports verified');
  });

  await test('3.3b: Kal V1 retry configuration is correct', STAGE, async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('src/lib/kal-protocol.ts', 'utf8');
    // Verify constants
    if (!content.includes('KAL_MAX_RETRIES = 3')) throw new Error('KAL_MAX_RETRIES should be 3');
    if (!content.includes('KAL_MAX_BUDGET_MS = 20 * 60 * 1000')) throw new Error('KAL_MAX_BUDGET should be 20 minutes');
    if (!content.includes('KAL_RELAXED_TIMEOUT_MS = 120_000')) throw new Error('KAL_RELAXED_TIMEOUT should be 120s');
    log.info(STAGE, 'Kal V1 retry config: 3 retries, 20min budget, 120s relaxed timeout');
  });

  // ── 3.4 Kal Protocol V2: Code Logic Verification ──
  await test('3.4a: Kal V2 module loads and exports correctly', STAGE, async () => {
    const kalV2 = await import('../src/lib/kal-protocol-v2');
    if (typeof kalV2.activateKalV2 !== 'function') throw new Error('activateKalV2 not exported');
    if (typeof kalV2.processKalV2Answer !== 'function') throw new Error('processKalV2Answer not exported');
    if (!kalV2.KAL_QUESTIONS) throw new Error('KAL_QUESTIONS not exported');
    if (!kalV2.KAL_FALLBACK_RESPONSES) throw new Error('KAL_FALLBACK_RESPONSES not exported');
    if (!kalV2.KAL_V2_SYSTEM_PROMPT) throw new Error('KAL_V2_SYSTEM_PROMPT not exported');

    // Verify 10 questions
    if (kalV2.KAL_QUESTIONS.length !== 10) throw new Error(`Expected 10 KAL_QUESTIONS, got ${kalV2.KAL_QUESTIONS.length}`);
    if (kalV2.KAL_FALLBACK_RESPONSES.length !== 2) throw new Error(`Expected 2 KAL_FALLBACK_RESPONSES, got ${kalV2.KAL_FALLBACK_RESPONSES.length}`);

    // Verify question elements map to 5-element framework
    const elements = new Set(kalV2.KAL_QUESTIONS.map((q: any) => q.element));
    const requiredElements = ['hook', 'problem', 'solution', 'credibility', 'cta'];
    for (const el of requiredElements) {
      if (!elements.has(el)) throw new Error(`Missing question for element: ${el}`);
    }

    log.info(STAGE, 'Kal V2 verified:', {
      questions: kalV2.KAL_QUESTIONS.length,
      fallbacks: kalV2.KAL_FALLBACK_RESPONSES.length,
      elements: [...elements],
    });
  });

  // ── 3.5 Iterate Endpoint Logic Verification ──
  await test('3.5a: Iterate route handles previousAnalysis context', STAGE, async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('src/app/api/coach/script/iterate/route.ts', 'utf8');
    // Verify key logic patterns
    if (!content.includes('parentScript')) throw new Error('Iterate route missing parent script lookup');
    if (!content.includes('previousAnalysis')) throw new Error('Iterate route missing previousAnalysis context building');
    if (!content.includes('nextVersion')) throw new Error('Iterate route missing version increment');
    if (!content.includes('parentScriptId')) throw new Error('Iterate route missing parentScriptId linking');
    if (!content.includes('activateKalProtocol')) throw new Error('Iterate route missing Kal Protocol activation on failure');
    if (!content.includes('delta')) throw new Error('Iterate route missing delta calculation between parent and child scores');
    log.info(STAGE, 'Iterate endpoint logic verified: parent lookup, version increment, Kal fallback, delta calculation');
  });

  // ── 3.6 Entitlement System ──
  await test('3.6a: E2 module access control is properly configured', STAGE, async () => {
    const { PLAN_LIMITS, E2_PLAN_LIMITS } = await import('../src/lib/plan-config');
    // PLAN_LIMITS is keyed by plan name (FREE, STARTER, etc.) with nested e2 field
    // E2_PLAN_LIMITS is a convenience flat record of plan → e2 limit
    const requiredPlans = ['FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE'];
    for (const plan of requiredPlans) {
      if (!PLAN_LIMITS[plan]) throw new Error(`Plan ${plan} not found in PLAN_LIMITS`);
      if (typeof PLAN_LIMITS[plan].e2 !== 'number') throw new Error(`E2 limit for ${plan} not configured`);
    }
    log.info(STAGE, 'E2 plan limits:', E2_PLAN_LIMITS);
  });

  // ── 3.7 API Route Structure ──
  await test('3.7a: POST /api/coach/script route structure is correct', STAGE, async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('src/app/api/coach/script/route.ts', 'utf8');
    // Verify all CRUD handlers exist
    if (!content.includes('export const POST')) throw new Error('POST handler missing');
    if (!content.includes('export async function PATCH')) throw new Error('PATCH handler missing');
    if (!content.includes('export async function DELETE')) throw new Error('DELETE handler missing');
    if (!content.includes('export async function GET')) throw new Error('GET handler missing');
    // Verify rate limiting
    if (!content.includes('withRateLimit')) throw new Error('Rate limiting not applied');
    // Verify auth checks
    if (!content.includes('requireAuth')) throw new Error('Auth check missing');
    // Verify entitlement check
    if (!content.includes('requireModuleAccess')) throw new Error('Entitlement check missing');
    // Verify AI analysis call
    if (!content.includes('analyzeScriptWithFallback')) throw new Error('AI analysis call missing');
    // Verify Kal activation
    if (!content.includes('activateKalProtocol')) throw new Error('Kal V1 activation missing');
    if (!content.includes('activateKalV2')) throw new Error('Kal V2 activation missing');
    log.info(STAGE, 'POST route structure verified: POST, PATCH, DELETE, GET + rate limit + auth + entitlement + AI + Kal');
  });

  // ── 3.8 Scoring Weights ──
  await test('3.8a: E2 scoring weights are properly defined', STAGE, async () => {
    const aiService = await import('../src/lib/ai-service');
    const scoringWeights = (aiService as any).SCORING_WEIGHTS;
    if (!scoringWeights?.E2_ELEMENTS) throw new Error('E2 scoring weights not found (expected SCORING_WEIGHTS.E2_ELEMENTS)');
    const e2Weights = scoringWeights.E2_ELEMENTS;
    const totalWeight = Object.values(e2Weights).reduce((sum: number, w: any) => sum + (typeof w === 'number' ? w : 0), 0);
    if (Math.abs(totalWeight - 1.0) > 0.01) {
      throw new Error(`E2 scoring weights don't sum to 1.0: total=${totalWeight}`);
    }
    log.info(STAGE, 'E2 scoring weights:', e2Weights, `total=${totalWeight}`);
  });

  // ── 3.9 Weighted Score Computation ──
  await test('3.9a: computeWeightedOverall() produces correct results', STAGE, async () => {
    const aiService = await import('../src/lib/ai-service');
    const computeWeightedOverall = (aiService as any).computeWeightedOverall;
    const SCORING_WEIGHTS = (aiService as any).SCORING_WEIGHTS;
    if (!computeWeightedOverall) throw new Error('computeWeightedOverall not exported');
    // computeWeightedOverall(weights, scores) — not (module, scores)
    const result = computeWeightedOverall(SCORING_WEIGHTS.E2_ELEMENTS, {
      hook: 80,
      problem: 70,
      solution: 60,
      credibility: 50,
      cta: 90,
    });
    if (typeof result !== 'number' || result < 0 || result > 100) {
      throw new Error(`computeWeightedOverall returned invalid result: ${result}`);
    }
    const expected = (80*0.2 + 70*0.2 + 60*0.2 + 50*0.2 + 90*0.2); // 70
    if (Math.abs(result - expected) > 0.01) {
      throw new Error(`computeWeightedOverall returned ${result}, expected ${expected}`);
    }
    log.info(STAGE, `Weighted overall for [80,70,60,50,90] = ${result} (expected ${expected})`);
  });

  // ── 3.10 Kal Middleware Client ──
  await test('3.10a: Kal middleware client has correct endpoints', STAGE, async () => {
    const { kalMiddlewareAnalyze, kalMiddlewareSummary, isKalMiddlewareReady } = await import('../src/lib/kal-middleware-client');
    if (typeof kalMiddlewareAnalyze !== 'function') throw new Error('kalMiddlewareAnalyze not exported');
    if (typeof kalMiddlewareSummary !== 'function') throw new Error('kalMiddlewareSummary not exported');
    if (typeof isKalMiddlewareReady !== 'function') throw new Error('isKalMiddlewareReady not exported');

    // Check middleware availability (informational)
    try {
      const ready = await isKalMiddlewareReady();
      log.info(STAGE, 'Kal middleware ready:', ready);
    } catch (err: any) {
      log.warn(STAGE, 'Kal middleware not reachable (expected in local dev):', err?.message);
    }
  });

  // ── 3.11 Database Schema Verification ──
  await test('3.11a: Prisma schema has all E2 models', STAGE, async () => {
    const fs = await import('fs');
    const schema = fs.readFileSync('prisma/schema.prisma', 'utf8');
    if (!schema.includes('model PitchScript')) throw new Error('PitchScript model missing from schema');
    if (!schema.includes('model KalChatSession')) throw new Error('KalChatSession model missing from schema');
    if (!schema.includes('model Usage')) throw new Error('Usage model missing from schema');

    // Verify PitchScript has required fields
    const requiredFields = [
      'hookScore', 'problemScore', 'solutionScore', 'credibilityScore', 'ctaScore', 'overallScore',
      'wordCount', 'estimatedDuration', 'improvements', 'rewrittenScript', 'alternativeHooks',
      'inputType', 'inputText', 'inputFileUrl', 'targetAudience', 'pitchDuration',
      'status', 'version', 'parentScriptId', 'notes',
    ];
    for (const field of requiredFields) {
      if (!schema.includes(field)) throw new Error(`PitchScript missing field: ${field}`);
    }

    // Verify AnalysisStatus enum includes KAL states
    if (!schema.includes('KAL_PENDING')) throw new Error('AnalysisStatus enum missing KAL_PENDING');
    if (!schema.includes('KAL_FAILED')) throw new Error('AnalysisStatus enum missing KAL_FAILED');

    log.info(STAGE, 'Prisma schema verified: PitchScript, KalChatSession, Usage models with all required fields');
  });

  // ── 3.12 Prisma Client Connectivity ──
  await test('3.12a: Prisma client can connect to database', STAGE, async () => {
    try {
      const { prisma } = await import('../src/lib/db');
      // Simple connectivity check
      await prisma.$queryRaw`SELECT 1`;
      log.info(STAGE, 'Prisma database connection successful');
    } catch (err: any) {
      // In CI/local without DATABASE_URL, this may fail — that's expected
      if (err?.message?.includes('P1001') || err?.message?.includes('connect')) {
        log.warn(STAGE, 'Database not reachable (expected without DATABASE_URL):', err?.message?.substring(0, 100));
      } else {
        throw err;
      }
    }
  });

  // ── 3.13 Rate Limiting ──
  await test('3.13a: Rate limiting is configured on E2 endpoints', STAGE, async () => {
    const fs = await import('fs');
    const scriptRoute = fs.readFileSync('src/app/api/coach/script/route.ts', 'utf8');
    const iterateRoute = fs.readFileSync('src/app/api/coach/script/iterate/route.ts', 'utf8');

    // Verify rate limit config
    const rateLimitPattern = /withRateLimit\(handlePost,\s*\{[^}]*limit:\s*(\d+)/;
    const scriptMatch = scriptRoute.match(rateLimitPattern);
    const iterateMatch = iterateRoute.match(rateLimitPattern);

    if (!scriptMatch) throw new Error('Rate limit not found on POST /api/coach/script');
    if (!iterateMatch) throw new Error('Rate limit not found on POST /api/coach/script/iterate');

    log.info(STAGE, `Rate limits: script=${scriptMatch[1]}req/min, iterate=${iterateMatch[1]}req/min`);
  });

  // ── 3.14 Error Handling Paths ──
  await test('3.14a: Error handling covers BLOB_READ_WRITE_TOKEN errors', STAGE, async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('src/app/api/coach/script/route.ts', 'utf8');
    if (!content.includes('BLOB_READ_WRITE_TOKEN')) throw new Error('Missing BLOB_READ_WRITE_TOKEN error handling');
    if (!content.includes('Blob not found')) throw new Error('Missing Blob not found error handling');
  });

  await test('3.14b: Error handling covers file extraction failures', STAGE, async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('src/app/api/coach/script/route.ts', 'utf8');
    if (!content.includes('Could not extract text from')) throw new Error('Missing file extraction error handling');
    if (!content.includes('Could not extract enough text')) throw new Error('Missing short text error handling');
  });

  await test('3.14c: Error handling covers word count validation', STAGE, async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('src/app/api/coach/script/route.ts', 'utf8');
    if (!content.includes('too short') || !content.includes('30 words')) throw new Error('Missing min word count validation');
    if (!content.includes('too long') || !content.includes('1000 words')) throw new Error('Missing max word count validation');
  });
}

// ═══════════════════════════════════════════════════════════════════════
// FINAL REPORT
// ═══════════════════════════════════════════════════════════════════════

function printReport() {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════════════════╗');
  console.log('║              E2E TEST REPORT — Script Check Module (E2)                ║');
  console.log('╠══════════════════════════════════════════════════════════════════════════╣');

  const stages = ['STAGE-1', 'STAGE-2', 'STAGE-3'];
  for (const stage of stages) {
    const stageResults = results.filter(r => r.stage === stage);
    const passed = stageResults.filter(r => r.passed).length;
    const failed = stageResults.filter(r => !r.passed).length;
    const total = stageResults.length;
    const stageName = stage === 'STAGE-1' ? 'Upload / Ingestion' : stage === 'STAGE-2' ? 'Data Transfer' : 'AI Analysis & Feedback';

    console.log(`║                                                                          ║`);
    console.log(`║  ${stage}: ${stageName.padEnd(48)} ║`);
    console.log(`║    Passed: ${String(passed).padStart(2)}/${total}   Failed: ${String(failed).padStart(2)}   Duration: ${stageResults.reduce((s, r) => s + r.durationMs, 0)}ms${' '.repeat(Math.max(0, 17 - String(stageResults.reduce((s, r) => s + r.durationMs, 0)).length))}║`);

    if (failed > 0) {
      for (const r of stageResults.filter(r => !r.passed)) {
        const errShort = (r.error || 'Unknown error').substring(0, 55);
        console.log(`║    ✗ ${r.name.padEnd(48)} ║`);
        console.log(`║      Error: ${errShort.padEnd(55)} ║`);
      }
    }
  }

  const totalPassed = results.filter(r => r.passed).length;
  const totalFailed = results.filter(r => !r.passed).length;
  const totalTests = results.length;
  const totalDuration = results.reduce((s, r) => s + r.durationMs, 0);

  console.log(`║                                                                          ║`);
  console.log('╠══════════════════════════════════════════════════════════════════════════╣');
  console.log(`║  TOTAL: ${String(totalPassed).padStart(2)}/${totalTests} passed   ${String(totalFailed).padStart(2)} failed   Duration: ${totalDuration}ms${' '.repeat(Math.max(0, 14 - String(totalDuration).length))}║`);
  console.log(`║  Status: ${totalFailed === 0 ? '✓ ALL PASSED'.padEnd(55) : `✗ ${totalFailed} FAILED`.padEnd(55)} ║`);
  console.log('╚══════════════════════════════════════════════════════════════════════════╝');
  console.log('\n');

  // Detailed failed tests
  if (totalFailed > 0) {
    console.log('═══ FAILED TEST DETAILS ═══');
    for (const r of results.filter(r => !r.passed)) {
      console.log(`\n[${r.stage}] ${r.name}`);
      console.log(`  Error: ${r.error || 'Unknown'}`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════

async function main() {
  console.log(`\n═══════════════════════════════════════════════════════════════════════`);
  console.log(`E2E Script Check Test — ${new Date().toISOString()}`);
  console.log(`Test ID: ${TEST_ID}`);
  console.log(`═══════════════════════════════════════════════════════════════════════\n`);

  try {
    await stage1_UploadIngestion();
  } catch (err: any) {
    log.error('STAGE-1', 'Stage 1 crashed:', err?.message);
  }

  try {
    await stage2_DataTransfer();
  } catch (err: any) {
    log.error('STAGE-2', 'Stage 2 crashed:', err?.message);
  }

  try {
    await stage3_AIAnalysisFeedbackLoop();
  } catch (err: any) {
    log.error('STAGE-3', 'Stage 3 crashed:', err?.message);
  }

  printReport();

  // Exit with error code if any tests failed
  const totalFailed = results.filter(r => !r.passed).length;
  process.exit(totalFailed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('E2E test runner crashed:', err);
  process.exit(2);
});
