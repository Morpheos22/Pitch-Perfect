/**
 * AI Service Timing Measurement Script
 * Measures the execution time of E1 and E2 analysis pipelines.
 * 
 * Usage: npx tsx scripts/measure-ai-time.ts
 */

async function main() {
  const startTime = Date.now();

  console.log('=== AI Service Timing Measurement ===\n');
  console.log('Initializing Z.ai SDK...');

  const { getZai, analyzePitchDeck, analyzePitchScript } = await import('../src/lib/ai-service');

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
        baseUrl: process.env.ZAI_BASE_URL || 'http://172.25.136.193:8080/v1',
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

    // Test 3: Full E2 Pipeline (analyzePitchScript)
    console.log('\n--- Test 3: Full E2 Pipeline (analyzePitchScript) ---');
    const pipelineScript = `Hi, I'm Sarah, CEO of TechFlow. We help small businesses automate their accounting. Our AI-powered platform reduces bookkeeping time by 80%, saving founders an average of 15 hours per week. We charge $49 per month and already have 500 paying customers generating $25K MRR. We're raising $2M to expand into new markets and build out our enterprise features.`;
    
    const pipelineStart = Date.now();
    try {
      const result = await analyzePitchScript(pipelineScript);
      const pipelineTime = Date.now() - pipelineStart;
      console.log(`Full E2 pipeline: ${pipelineTime}ms`);
      console.log(`  Overall: ${result.overallScore}, Hook: ${result.hookScore}, CTA: ${result.ctaScore}`);
      console.log(`  Model: ${result.modelUsed}`);
      console.log(`  Rewritten: ${(result.rewrittenScript || '').length} chars`);
    } catch (err: any) {
      const pipelineTime = Date.now() - pipelineStart;
      console.log(`Full E2 pipeline FAILED after ${pipelineTime}ms: ${err?.message}`);
    }

    // Test 4: Full E1 Pipeline (analyzePitchDeck)
    console.log('\n--- Test 4: Full E1 Pipeline (analyzePitchDeck) ---');
    const pipelineDeck = `
SLIDE 1: TechFlow — AI-Powered Accounting
SLIDE 2: Problem: Small businesses spend 20% of time on bookkeeping
SLIDE 3: Solution: AI platform automates 80% of accounting tasks
SLIDE 4: Market: $12B TAM, 30M SMBs, 15% CAGR
SLIDE 5: Business Model: $49/mo, $99/mo, $199/mo tiers
SLIDE 6: Traction: 500 customers, $25K MRR, 95% retention
SLIDE 7: Team: Ex-Intuit CEO, Ex-Stripe CTO
SLIDE 8: Financials: Year 3 $4.8M ARR projected
SLIDE 9: Ask: $2M seed for market expansion
`;
    
    const deckStart = Date.now();
    try {
      const result = await analyzePitchDeck(pipelineDeck);
      const deckTime = Date.now() - deckStart;
      console.log(`Full E1 pipeline: ${deckTime}ms`);
      console.log(`  Overall: ${result.overallScore}, Market: ${result.marketOpportunityScore}, Traction: ${result.tractionScore}`);
      console.log(`  Model: ${result.modelUsed}`);
      console.log(`  Strengths: ${result.strengths?.length}, Weaknesses: ${result.weaknesses?.length}, Recs: ${result.recommendations?.length}`);
    } catch (err: any) {
      const deckTime = Date.now() - deckStart;
      console.log(`Full E1 pipeline FAILED after ${deckTime}ms: ${err?.message}`);
    }
  } else {
    console.log('\nSDK not available — testing direct HTTP gateway only...');
    const httpStart = Date.now();
    try {
      const apiKey = process.env.ZAI_API_KEY || '';
      const token = process.env.ZAI_TOKEN || apiKey;
      const baseUrl = process.env.ZAI_BASE_URL || 'http://172.25.136.193:8080/v1';
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
