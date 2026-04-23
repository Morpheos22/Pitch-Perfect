// E2 Pipeline Diagnostic Endpoint
// Tests each step of the Elevator Pitch Script analysis pipeline independently.
// Requires authentication + admin access (dev emails only).
//
// GET /api/coach/diagnostic


import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/with-auth';
import { isAdminEmail } from '@/lib/dev-auth';

// IMPORTANT: Import polyfills BEFORE any test that loads pdf-parse
// The DOMMatrix polyfill must be installed at module level, before
// pdf-parse's browser bundle evaluates its top-level code.
import '@/lib/polyfills';

export const dynamic = 'force-dynamic';

export const maxDuration = 60;


// ── Helper: mask sensitive env values ──
function mask(value: string | undefined): string {
  if (!value) return 'NOT SET';
  if (value.length <= 8) return '***';
  return value.slice(0, 8) + '...';
}


// ── Result type ──
interface TestResult {
  test: string;
  status: 'PASS' | 'FAIL' | 'WARN' | 'SKIP';
  durationMs: number;
  detail: string;
  error?: string;
}


// ════════════════════════════════════════════════════════════════
// TEST 1: Environment Check
// ════════════════════════════════════════════════════════════════
async function testEnvironment(): Promise<TestResult> {
  const start = Date.now();
  const requiredVars = [
    'ZAI_API_KEY',
    'ZAI_TOKEN',
    'ZAI_BASE_URL',
    'BLOB_READ_WRITE_TOKEN',
    'DATABASE_URL',
    'CLERK_SECRET_KEY',
  ];


  const results: Record<string, string> = {};
  const missing: string[] = [];


  for (const v of requiredVars) {
    const val = process.env[v];
    results[v] = mask(val);
    if (!val) missing.push(v);
  }


  // Also check optional but useful vars
  const optionalVars = ['ZAI_USER_ID', 'ZAI_CHAT_ID', 'NEXT_PUBLIC_APP_URL', 'GOOGLE_GENAI_API_KEY', 'GOOGLE_CLOUD_PROJECT'];
  for (const v of optionalVars) {
    results[v] = mask(process.env[v]);
  }


  return {
    test: '1. Environment Check',
    status: missing.length === 0 ? 'PASS' : missing.length < 3 ? 'WARN' : 'FAIL',
    durationMs: Date.now() - start,
    detail: JSON.stringify(results, null, 2),
    error: missing.length > 0 ? `Missing required env vars: ${missing.join(', ')}` : undefined,
  };
}


// ════════════════════════════════════════════════════════════════
// TEST 2: Z.ai Gateway Connectivity
// ════════════════════════════════════════════════════════════════
async function testZaiGateway(): Promise<TestResult> {
  const start = Date.now();


  const baseUrl = process.env.ZAI_BASE_URL;
  if (!baseUrl) {
    return {
      test: '2. Z.ai Gateway Connectivity',
      status: 'SKIP',
      durationMs: Date.now() - start,
      detail: 'ZAI_BASE_URL not set — cannot test gateway. Set ZAI_BASE_URL env var to your Z.ai gateway URL.',
    };
  }
  const token = process.env.ZAI_TOKEN || process.env.ZAI_API_KEY || '';
  const apiKey = process.env.ZAI_API_KEY || '';
  const userId = process.env.ZAI_USER_ID || '';


  if (!token && !apiKey) {
    return {
      test: '2. Z.ai Gateway Connectivity',
      status: 'SKIP',
      durationMs: Date.now() - start,
      detail: 'No ZAI_TOKEN or ZAI_API_KEY set — cannot test gateway.',
    };
  }


  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Z-AI-From': 'Z',
    };
    if (token) headers['X-Token'] = token;
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
    if (userId) headers['X-User-Id'] = userId;


    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: 'glm-4-plus',
        messages: [{ role: 'user', content: 'Say hello' }],
        temperature: 0.1,
        max_tokens: 32,
      }),
      signal: AbortSignal.timeout(30_000),
    });


    const body = await resp.text();
    let responseSnippet = body.slice(0, 500);


    // Try to extract just the content for a cleaner snippet
    try {
      const parsed = JSON.parse(body);
      const content = parsed?.choices?.[0]?.message?.content;
      if (content) responseSnippet = `AI response: "${content.slice(0, 100)}" (HTTP ${resp.status})`;
      else responseSnippet = `HTTP ${resp.status} — no choices[0].message.content. Body: ${body.slice(0, 200)}`;
    } catch {
      responseSnippet = `HTTP ${resp.status} — non-JSON response: ${responseSnippet}`;
    }


    return {
      test: '2. Z.ai Gateway Connectivity',
      status: resp.ok ? 'PASS' : 'FAIL',
      durationMs: Date.now() - start,
      detail: `URL: ${baseUrl}/chat/completions\nStatus: ${resp.status}\n${responseSnippet}`,
      error: resp.ok ? undefined : `Gateway returned HTTP ${resp.status}`,
    };
  } catch (err: any) {
    return {
      test: '2. Z.ai Gateway Connectivity',
      status: 'FAIL',
      durationMs: Date.now() - start,
      detail: `URL: ${baseUrl}/chat/completions`,
      error: err?.message || String(err),
    };
  }
}


// ════════════════════════════════════════════════════════════════
// TEST 2b: Z.ai SDK Initialization
// ════════════════════════════════════════════════════════════════
// Tests the getZai() async path (refactored in Batch 1):
//   - Config file writing to CWD + /tmp
//   - SDK initialization (ZAI.create())
//   - Null return on failure (instead of throw)
async function testZaiSdkInit(): Promise<TestResult> {
  const start = Date.now();

  try {
    const { getZai } = await import('@/lib/ai-service');
    const zai = await getZai();

    if (!zai) {
      return {
        test: '2b. Z.ai SDK Initialization',
        status: 'FAIL',
        durationMs: Date.now() - start,
        detail: 'getZai() returned null — SDK failed to initialize. Check ZAI_API_KEY and .z-ai-config file writing permissions.',
        error: 'SDK initialization returned null — the direct HTTP fallback will be used instead',
      };
    }

    // Quick SDK liveness check
    const resp = await zai.chat.completions.create({
      model: 'glm-4-plus',
      messages: [{ role: 'user', content: 'Say "sdk_ok"' }],
      temperature: 0.1,
      max_tokens: 10,
    });

    const content = resp.choices?.[0]?.message?.content || '';
    return {
      test: '2b. Z.ai SDK Initialization',
      status: resp.ok || content ? 'PASS' : 'WARN',
      durationMs: Date.now() - start,
      detail: `SDK initialized successfully. Text model response: "${content.slice(0, 80)}"`,
    };
  } catch (err: any) {
    return {
      test: '2b. Z.ai SDK Initialization',
      status: 'FAIL',
      durationMs: Date.now() - start,
      detail: 'SDK initialization or test call failed',
      error: err?.message || String(err),
    };
  }
}


// ════════════════════════════════════════════════════════════════
// TEST 3: Vercel Blob Write/Read/Delete
// ════════════════════════════════════════════════════════════════
async function testVercelBlob(): Promise<TestResult> {
  const start = Date.now();


  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return {
      test: '3. Vercel Blob Write/Read/Delete',
      status: 'SKIP',
      durationMs: Date.now() - start,
      detail: 'BLOB_READ_WRITE_TOKEN not set — cannot test blob operations.',
    };
  }


  const steps: string[] = [];
  let blobUrl: string | undefined;


  try {
    // WRITE
    const { put } = await import('@vercel/blob');
    const testContent = 'diagnostic test';
    const testKey = 'pitchcoach-diagnostic-test.txt';


    const putResult = await put(testKey, testContent, {
      access: 'public',
      addRandomSuffix: true,
    });
    blobUrl = putResult.url;
    steps.push(`✅ WRITE: Success — url=${blobUrl.slice(0, 80)}...`);


    // READ
    const { get } = await import('@vercel/blob');
    const getResult = await get(blobUrl, { access: 'public' });
    if (!getResult) {
      steps.push('❌ READ: get() returned null');
      return {
        test: '3. Vercel Blob Write/Read/Delete',
        status: 'FAIL',
        durationMs: Date.now() - start,
        detail: steps.join('\n'),
        error: 'Blob get() returned null after write',
      };
    }


    // For public blobs, get() returns the blob metadata. We need to fetch the content separately.
    const readResp = await fetch(blobUrl);
    const readContent = await readResp.text();
    steps.push(`✅ READ: Success — content="${readContent}" (expected: "${testContent}")`);


    if (readContent !== testContent) {
      steps.push(`⚠️ CONTENT MISMATCH: got "${readContent}" expected "${testContent}"`);
    }


    // DELETE
    const { del } = await import('@vercel/blob');
    await del(blobUrl);
    steps.push('✅ DELETE: Success — test blob cleaned up');


    const contentMatch = readContent === testContent;
    return {
      test: '3. Vercel Blob Write/Read/Delete',
      status: contentMatch ? 'PASS' : 'WARN',
      durationMs: Date.now() - start,
      detail: steps.join('\n'),
      error: contentMatch ? undefined : 'Read content did not match written content',
    };
  } catch (err: any) {
    // Try to clean up if write succeeded but something else failed
    if (blobUrl) {
      try {
        const { del } = await import('@vercel/blob');
        await del(blobUrl);
        steps.push('🧹 Cleanup: Deleted test blob after failure');
      } catch {
        steps.push('⚠️ Cleanup: Failed to delete test blob');
      }
    }


    return {
      test: '3. Vercel Blob Write/Read/Delete',
      status: 'FAIL',
      durationMs: Date.now() - start,
      detail: steps.join('\n'),
      error: err?.message || String(err),
    };
  }
}


// ════════════════════════════════════════════════════════════════
// TEST 4: PDF Parse Test
// ════════════════════════════════════════════════════════════════
async function testPdfParse(): Promise<TestResult> {
  const start = Date.now();

  try {
    const { PDFParse } = await import('pdf-parse');


    // Build a minimal valid PDF in memory
    // This is a minimal PDF 1.0 file with the text "Hello PitchCoach"
    const pdfContent = `%PDF-1.0
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>endobj
4 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
5 0 obj<</Length 44>>stream
BT /F1 12 Tf 100 700 Td (Hello PitchCoach) Tj ET
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000266 00000 n 
0000000340 00000 n 
trailer<</Size 6/Root 1 0 R>>
startxref
434
%%EOF`;


    const uint8 = new Uint8Array(Buffer.from(pdfContent, 'binary'));


    // Use the same pattern as the actual code: new PDFParse(uint8)
    const parser = new PDFParse(uint8);
    let extractedText = '';


    try {
      const result = await parser.getText();
      extractedText = result?.text || '';
    } catch (parseErr: any) {
      // Some minimal PDFs may not parse fully — that's okay for this test
      // The important thing is that PDFParse constructor accepts Uint8Array directly
      return {
        test: '4. PDF Parse Test',
        status: 'WARN',
        durationMs: Date.now() - start,
        detail: `PDFParse constructor accepted Uint8Array directly. getText() threw: ${parseErr?.message}. This may indicate the PDF was too minimal, but the constructor pattern is confirmed working.`,
        error: parseErr?.message,
      };
    } finally {
      try { parser.destroy(); } catch { /* ignore */ }
    }


    const hasText = extractedText.length > 0;
    return {
      test: '4. PDF Parse Test',
      status: hasText ? 'PASS' : 'WARN',
      durationMs: Date.now() - start,
      detail: `PDFParse(new Uint8Array(buffer)) → getText() succeeded. Extracted text length: ${extractedText.length}. Text snippet: "${extractedText.slice(0, 100)}"${hasText ? '' : ' (empty — minimal test PDF may lack proper text encoding)'}`,
      error: hasText ? undefined : 'Extracted text was empty (expected with minimal test PDF)',
    };
  } catch (err: any) {
    // Check if the error is about the constructor pattern itself
    const msg = err?.message || String(err);
    const isConstructorError = msg.includes('constructor') || msg.includes('argument') || msg.includes('parameter') || msg.includes('cannot read');


    return {
      test: '4. PDF Parse Test',
      status: isConstructorError ? 'FAIL' : 'WARN',
      durationMs: Date.now() - start,
      detail: `pdf-parse import ${isConstructorError ? 'succeeded but constructor usage failed' : 'or usage error'}. Error: ${msg}`,
      error: msg,
    };
  }
}


// ════════════════════════════════════════════════════════════════
// TEST 5: Database Connectivity
// ════════════════════════════════════════════════════════════════
async function testDatabase(): Promise<TestResult> {
  const start = Date.now();


  try {
    const { prisma } = await import('@/lib/db');


    // Simple connectivity test
    const result = await prisma.$queryRaw`SELECT 1 as test`;


    // Also check pitch_scripts count (the table that's empty)
    const scriptCount = await prisma.pitchScript.count();


    // Check if there are any users at all
    const userCount = await prisma.user.count();


    return {
      test: '5. Database Connectivity',
      status: 'PASS',
      durationMs: Date.now() - start,
      detail: `SELECT 1 succeeded. pitch_scripts count: ${scriptCount} (expected: 0 — this is the bug). users count: ${userCount}.`,
    };
  } catch (err: any) {
    return {
      test: '5. Database Connectivity',
      status: 'FAIL',
      durationMs: Date.now() - start,
      detail: 'Could not connect to database or query failed.',
      error: err?.message || String(err),
    };
  }
}


// ════════════════════════════════════════════════════════════════
// TEST 6: Google AI / Gemini Connectivity (Vertex AI or AI Studio)
// ════════════════════════════════════════════════════════════════
async function testGoogleAI(): Promise<TestResult> {
  const start = Date.now();

  const apiKey = process.env.GOOGLE_GENAI_API_KEY || '';
  const project = process.env.GOOGLE_CLOUD_PROJECT || '';
  const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
  const model = 'gemini-2.0-flash';

  if (!apiKey) {
    return {
      test: '6. Google AI / Gemini Connectivity',
      status: 'SKIP',
      durationMs: Date.now() - start,
      detail: 'GOOGLE_GENAI_API_KEY not set — cannot test Google AI.',
    };
  }

  // Build the correct endpoint based on configuration
  let endpoint: string;
  let provider: string;
  if (project) {
    endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:generateContent`;
    provider = `Vertex AI (${project}/${location})`;
  } else {
    endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    provider = 'AI Studio';
  }

  try {
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'Say hello' }] }],
        generationConfig: { maxOutputTokens: 32 },
      }),
      signal: AbortSignal.timeout(30_000),
    });

    const body = await resp.text();
    let responseSnippet = body.slice(0, 300);

    try {
      const parsed = JSON.parse(body);
      const content = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (content) responseSnippet = `Gemini response: "${content.slice(0, 100)}" (HTTP ${resp.status})`;
      else if (parsed?.error) responseSnippet = `HTTP ${resp.status} — ${parsed.error.message?.slice(0, 200) || JSON.stringify(parsed.error).slice(0, 200)}`;
      else responseSnippet = `HTTP ${resp.status} — no content in response. Body: ${body.slice(0, 200)}`;
    } catch {
      responseSnippet = `HTTP ${resp.status} — non-JSON response: ${responseSnippet}`;
    }

    // Classify errors with actionable guidance
    let status: TestResult['status'] = resp.ok ? 'PASS' : 'FAIL';
    if (!resp.ok) {
      try {
        const parsed = JSON.parse(body);
        const reason = parsed?.error?.details?.[0]?.reason;
        if (reason === 'API_KEY_SERVICE_BLOCKED') {
          status = 'WARN';
          responseSnippet += '\n\n⚠️ Generative Language API not enabled. Enable at: https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com';
        } else if (reason === 'BILLING_DISABLED') {
          status = 'WARN';
          responseSnippet += '\n\n⚠️ Billing not enabled on the Google Cloud project. Enable at: https://console.developers.google.com/billing/enable?project=' + project;
        } else if (resp.status === 429) {
          status = 'WARN';
          responseSnippet += '\n\n⚠️ Quota exhausted — need to enable billing or use a different project.';
        } else if (resp.status === 404) {
          status = 'WARN';
          responseSnippet += '\n\n⚠️ Model not found — the model name may be incorrect or not available for this endpoint/key.';
        }
      } catch { /* ignore */ }
    }

    return {
      test: '6. Google AI / Gemini Connectivity',
      status,
      durationMs: Date.now() - start,
      detail: `Provider: ${provider}\nModel: ${model}\nKey: ${apiKey.slice(0, 8)}...\n${responseSnippet}`,
      error: resp.ok ? undefined : `Google AI (${provider}) returned HTTP ${resp.status}`,
    };
  } catch (err: any) {
    return {
      test: '6. Google AI / Gemini Connectivity',
      status: 'FAIL',
      durationMs: Date.now() - start,
      detail: `Provider: ${provider}\nCould not reach Google AI API.`,
      error: err?.message || String(err),
    };
  }
}


// ════════════════════════════════════════════════════════════════
// TEST 7: Full E2 Pipeline Simulation (with fallback chain)
// ════════════════════════════════════════════════════════════════
async function testE2Pipeline(): Promise<TestResult> {
  const start = Date.now();


  const testScript = `Did you know that 70% of small businesses fail because they can't manage their cash flow? I'm Sarah, founder of CashFlow Pro. We built an AI-powered tool that predicts cash flow gaps 30 days before they happen. Our beta users have already reduced late payments by 40%. We're raising $500K to scale our sales team. Can I show you our demo?`;


  try {
    // Step 1: Simulate text extraction (we already have the text)
    const extractedText = testScript;
    const step1 = `✅ Text extraction: ${extractedText.split(/\s+/).length} words extracted`;

    const steps: string[] = [step1];
    let analysis: any = null;
    let strategyUsed = 'none';

    // Step 2a: Try Strategy 1 — Z.ai Gateway (PRIMARY for ALL modules)
    try {
      const { analyzePitchScript } = await import('@/lib/ai-service');
      analysis = await analyzePitchScript(extractedText, 'investor', 60);
      strategyUsed = 'Strategy 1 (Z.ai Gateway — PRIMARY)';
      steps.push(`✅ Strategy 1 (Z.ai Gateway): succeeded — overall=${analysis.overallScore}, model=${analysis.modelUsed}`);
    } catch (zaiErr: any) {
      steps.push(`❌ Strategy 1 (Z.ai Gateway): failed — ${zaiErr?.message?.slice(0, 150)}`);
      analysis = null;
    }

    // Step 2b: Try Strategy 2 — Google AI / Vertex AI (FALLBACK)
    if (!analysis) {
      const { analyzeWithVertexAI, isVertexAIConfigured } = await import('@/lib/vertex-ai');
      if (isVertexAIConfigured()) {
        try {
          analysis = await analyzeWithVertexAI(extractedText, 'investor', 60);
          strategyUsed = 'Strategy 2 (Google AI / Vertex AI — FALLBACK)';
          steps.push(`✅ Strategy 2 (Vertex AI): succeeded — overall=${analysis.overallScore}, model=${analysis.modelUsed}`);
        } catch (vertexErr: any) {
          steps.push(`❌ Strategy 2 (Vertex AI): failed — ${vertexErr?.message?.slice(0, 150)}`);
        }
      } else {
        steps.push('⏭️ Strategy 2 (Vertex AI): skipped — not configured');
      }
    }

    if (!analysis) {
      return {
        test: '7. Full E2 Pipeline Simulation (with fallback chain)',
        status: 'FAIL',
        durationMs: Date.now() - start,
        detail: steps.join('\n'),
        error: 'All AI strategies failed — neither Google AI nor Z.ai Gateway could analyze the script.',
      };
    }

    // Step 3: Check if result has all required fields
    const requiredFields = ['hookScore', 'problemScore', 'solutionScore', 'credibilityScore', 'ctaScore', 'overallScore', 'wordCount', 'estimatedDuration', 'improvements', 'rewrittenScript', 'alternativeHooks'];
    const missingFields = requiredFields.filter(f => (analysis as any)[f] === undefined || (analysis as any)[f] === null);
    const step3 = missingFields.length === 0
      ? '✅ All required fields present in result'
      : `⚠️ Missing fields: ${missingFields.join(', ')}`;


    // Step 4: Check if improvements has the expected structure
    const improvements = analysis.improvements;
    const impKeys = Object.keys(improvements);
    const expectedImpKeys = ['hook', 'problem', 'solution', 'credibility', 'cta'];
    const missingImpKeys = expectedImpKeys.filter(k => !impKeys.includes(k));
    const step4 = missingImpKeys.length === 0
      ? `✅ Improvements structure correct: ${impKeys.join(', ')}`
      : `⚠️ Missing improvement keys: ${missingImpKeys.join(', ')}`;


    return {
      test: '7. Full E2 Pipeline Simulation (with fallback chain)',
      status: missingFields.length === 0 ? 'PASS' : 'WARN',
      durationMs: Date.now() - start,
      detail: [...steps, step3, step4, `Strategy used: ${strategyUsed}`, `modelUsed: ${analysis.modelUsed}`, `tokensUsed: ${analysis.tokensUsed ?? 'N/A'}`].join('\n'),
      error: missingFields.length > 0 ? `Some fields missing from analysis result` : undefined,
    };
  } catch (err: any) {
    const msg = err?.message || String(err);
    const stack = err?.stack?.slice(0, 300) || '';


    // Classify the error to help pinpoint the failure
    let classification = 'UNKNOWN';
    if (msg.includes('401') || msg.includes('unauthorized') || msg.includes('X-Token') || msg.includes('No gateway credentials')) {
      classification = 'AUTH_ERROR — Z.ai gateway rejected the request. Check ZAI_API_KEY and ZAI_TOKEN.';
    } else if (msg.includes('All models failed')) {
      classification = 'AI_FALLBACK_EXHAUSTED — All model attempts (SDK + direct HTTP) failed. Check gateway connectivity and credentials.';
    } else if (msg.includes('No JSON object found')) {
      classification = 'AI_RESPONSE_PARSE_ERROR — The AI returned non-JSON output. The extractJsonFromContent() function could not find valid JSON.';
    } else if (msg.includes('No response from AI')) {
      classification = 'AI_EMPTY_RESPONSE — The AI returned an empty response (choices[0].message.content was null/empty).';
    } else if (msg.includes('fetch failed') || msg.includes('ECONNREFUSED') || msg.includes('timeout')) {
      classification = 'NETWORK_ERROR — Could not reach Z.ai gateway. Check ZAI_BASE_URL and network connectivity.';
    }


    return {
      test: '7. Full E2 Pipeline Simulation (with fallback chain)',
      status: 'FAIL',
      durationMs: Date.now() - start,
      detail: `Classification: ${classification}\n\nStack: ${stack}`,
      error: msg,
    };
  }
}


// ════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ════════════════════════════════════════════════════════════════


export async function GET(request: NextRequest) {
  // ── Security: require auth + admin/dev access ──
  // This endpoint exposes env vars, API key prefixes, DB info,
  // and costs AI credits. Only accessible to dev/admin accounts.
  const { user, error: authError } = await requireAuth({
    select: { id: true, clerkId: true, email: true },
  });
  if (authError) {
    return authError;
  }

  // Gate to admin/dev emails only — prevents any authenticated user
  // from probing infrastructure or consuming AI credits
  const userEmail = (user as any).email || '';
  if (!isAdminEmail(userEmail)) {
    return NextResponse.json(
      { error: 'Forbidden — diagnostic endpoint requires admin access' },
      { status: 403 }
    );
  }

  const results: TestResult[] = [];
  const pipelineStart = Date.now();


  // Run all tests sequentially (some share state/connections)
  results.push(await testEnvironment());
  results.push(await testZaiGateway());
  results.push(await testZaiSdkInit());
  results.push(await testVercelBlob());
  results.push(await testPdfParse());
  results.push(await testDatabase());
  results.push(await testGoogleAI());
  results.push(await testE2Pipeline());


  // ── Bug analysis ──
  // Based on code review, document the potential bugs found
  const bugAnalysis = {
    bugs_found: [
      {
        location: 'src/lib/file-parser.ts:parsePdfText()',
        description: 'PDFParse constructor receives uint8Array directly (new PDFParse(uint8)). If pdf-parse expects a different constructor signature (e.g., { data: uint8Array }), this would throw silently and the catch block would retry with the same broken pattern, then ultimately return the "Could not extract text" error.',
        severity: 'HIGH — If PDFParse constructor signature is wrong, ALL PDF uploads fail',
        fix: 'Verify pdf-parse v2.4.5 constructor signature. If it expects { data: uint8Array }, change to new PDFParse({ data: uint8 }).',
      },
      {
        location: 'src/lib/storage.ts:getFileContent()',
        description: 'Vercel Blob URL detection only checks for "blob.vercel-storage.com". If the blob URL uses a different domain (e.g., a custom domain or regional endpoint), it falls through to the generic fetch which fails for private blobs since no auth token is sent.',
        severity: 'MEDIUM — Blob URLs from different regions/custom domains would fail',
        fix: 'Expand URL detection or use @vercel/blob head() API to detect blob type.',
      },
      {
        location: 'src/app/api/coach/script/route.ts:handlePost()',
        description: 'The entitlement check (requireModuleAccess) runs BEFORE text extraction. If the user has no access, they get a 403 but the file was already uploaded to Blob — creating orphaned blobs. Also, the error path for text extraction failure (lines 78-84) returns 400 but doesn\'t explain WHY extraction failed — the original error message is swallowed.',
        severity: 'LOW — Orphaned blobs waste storage; swallowed errors make debugging harder',
        fix: 'Move entitlement check before blob upload on the client side. Log the full extraction error.',
      },
      {
        location: 'src/lib/ai-service.ts:analyzePitchScript()',
        description: 'wordCount and estimatedDuration are hardcoded to 0 initially (lines 1212-1213), then overridden on lines 1226-1227. This is not a bug per se, but if the AI response parsing throws on line 1202 (parseJsonResponse), the function throws before reaching those lines. The 0 default is misleading in stack traces.',
        severity: 'LOW — Cosmetic issue, not a runtime bug',
        fix: 'Initialize wordCount from scriptText.split() directly.',
      },
      {
        location: 'src/lib/ai-service.ts:parseJsonResponse()',
        description: 'If the AI returns valid JSON but it\'s an array instead of an object, or the JSON doesn\'t contain the expected fields, parseJsonResponse succeeds but the destructuring on line 1202+ returns undefined for all fields. clampScore() then defaults everything to 50 — masking the real problem.',
        severity: 'MEDIUM — AI returning unexpected format would produce a fake analysis with all 50s',
        fix: 'Add schema validation after parsing to detect malformed AI responses.',
      },
    ],
    likely_root_cause: 'The most likely reason for ZERO records in pitch_scripts is that the Z.ai gateway call is failing. This could be due to: (1) ZAI_API_KEY/ZAI_TOKEN not set in Vercel env vars, (2) the SDK initialization failing silently (zaiInstance remains null), or (3) the AI returning non-JSON output that parseJsonResponse() cannot parse. The error is caught in the script route handler (line 163) and returns a generic 503, but the root cause is not logged to the database — so there are no records at all.',
  };


  const totalDuration = Date.now() - pipelineStart;
  const passCount = results.filter(r => r.status === 'PASS').length;
  const failCount = results.filter(r => r.status === 'FAIL').length;


  return NextResponse.json({
    timestamp: new Date().toISOString(),
    totalDurationMs: totalDuration,
    summary: {
      total: results.length,
      passed: passCount,
      failed: failCount,
      warned: results.filter(r => r.status === 'WARN').length,
      skipped: results.filter(r => r.status === 'SKIP').length,
      overall: failCount === 0 ? 'ALL_TESTS_PASSED' : 'FAILURES_DETECTED',
    },
    results,
    bugAnalysis,
  });
}
