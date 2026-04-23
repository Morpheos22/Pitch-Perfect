/**
 * AI Service Timing Measurement Script
 * Measures the execution time of the E2 Script Analysis pipeline.
 * 
 * Usage: npx tsx scripts/measure-ai-time.ts
 */

async function main() {
  const startTime = Date.now();

  console.log('=== AI Service Timing Measurement ===\n');
  console.log('Initializing Z.ai SDK...');

  const { getZai } = await import('../src/lib/ai-service');

  const sdkStart = Date.now();
  const zai = await getZai();
  const sdkTime = Date.now() - sdkStart;
  console.log(`SDK initialization: ${sdkTime}ms ${zai ? '✅ SUCCESS' : '❌ FAILED (will use HTTP fallback)'}`);

  if (zai) {
    // Test 1: Simple text analysis (E2-like)
    console.log('\n--- Test 1: E2 Script Analysis (SDK) ---');
    const testScript = `Our startup, GreenFlow, is revolutionizing how businesses manage their carbon footprint. Every company today faces mounting pressure from regulators and consumers to be environmentally responsible, but most are drowning in spreadsheets and manual tracking. GreenFlow automates carbon accounting with AI-powered data ingestion from utilities, travel systems, and supply chains. Our team has 15 years combined experience in sustainability and enterprise SaaS. We've already onboarded 12 pilot customers generating $50K MRR. We're raising $2M in seed funding to scale our sales team and expand to the European market where carbon reporting is now mandatory.`;

    const analysisStart = Date.now();
    try {
      const response = await zai.chat.completions.create({
        model: 'glm-4-plus',
        messages: [
          { role: 'system', content: 'You are an expert pitch coach. Analyze this elevator pitch script and return a JSON object with scores (0-100) for: hookScore, problemScore, solutionScore, credibilityScore, ctaScore, overallScore, improvements (object with arrays for each element), rewrittenScript (string), alternativeHooks (array of strings). Respond ONLY with valid JSON.' },
          { role: 'user', content: testScript },
        ],
        temperature: 0.3,
        max_tokens: 2048,
      });
      const analysisTime = Date.now() - analysisStart;
      const content = response.choices?.[0]?.message?.content;
      const contentLength = content?.length || 0;
      console.log(`E2 Analysis time: ${analysisTime}ms`);
      console.log(`Response length: ${contentLength} chars`);
      console.log(`First 200 chars: ${content?.substring(0, 200)}...`);
      console.log(`Model used: ${response.model || 'unknown'}`);
    } catch (err: any) {
      const analysisTime = Date.now() - analysisStart;
      console.log(`E2 Analysis FAILED after ${analysisTime}ms: ${err?.message}`);
    }

    // Test 2: Direct HTTP fallback timing
    console.log('\n--- Test 2: Direct HTTP Gateway Call ---');
    const httpStart = Date.now();
    try {
      const config = {
        baseUrl: process.env.ZAI_BASE_URL || 'https://z.ai/model-api',
        apiKey: process.env.ZAI_API_KEY || '',
        token: process.env.ZAI_TOKEN || process.env.ZAI_API_KEY || '',
      };
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Z-AI-From': 'Z',
      };
      if (config.token) headers['X-Token'] = config.token;
      if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`;

      const resp = await fetch(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: 'glm-4-plus',
          messages: [
            { role: 'user', content: 'Say "ok"' },
          ],
          temperature: 0.1,
          max_tokens: 10,
        }),
        signal: AbortSignal.timeout(30_000),
      });
      const httpTime = Date.now() - httpStart;
      console.log(`HTTP Gateway ping: ${httpTime}ms (HTTP ${resp.status})`);
    } catch (err: any) {
      const httpTime = Date.now() - httpStart;
      console.log(`HTTP Gateway FAILED after ${httpTime}ms: ${err?.message}`);
    }
  } else {
    console.log('\nSDK not available — testing direct HTTP gateway only...');
    const httpStart = Date.now();
    try {
      const apiKey = process.env.ZAI_API_KEY || '';
      const token = process.env.ZAI_TOKEN || apiKey;
      const baseUrl = process.env.ZAI_BASE_URL || 'https://z.ai/model-api';
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Z-AI-From': 'Z',
      };
      if (token) headers['X-Token'] = token;
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

      const resp = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: 'glm-4-plus',
          messages: [{ role: 'user', content: 'Say "ok"' }],
          temperature: 0.1,
          max_tokens: 10,
        }),
        signal: AbortSignal.timeout(30_000),
      });
      const httpTime = Date.now() - httpStart;
      console.log(`HTTP Gateway ping: ${httpTime}ms (HTTP ${resp.status})`);
    } catch (err: any) {
      const httpTime = Date.now() - httpStart;
      console.log(`HTTP Gateway FAILED after ${httpTime}ms: ${err?.message}`);
    }
  }

  const totalTime = Date.now() - startTime;
  console.log(`\n=== Total Script Time: ${totalTime}ms ===`);
}

main().catch(console.error);
