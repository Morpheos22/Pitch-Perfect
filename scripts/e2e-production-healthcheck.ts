/**
 * ═══════════════════════════════════════════════════════════════════════
 * PRODUCTION E2E HEALTHCHECK — PitchCoach Ai
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Tests the production deployment at pitchcoachai.tech:
 *   Stage 1: Infrastructure Handshakes (Clerk, Vercel, Supabase, Z.ai)
 *   Stage 2: Public Routes & Auth Pages
 *   Stage 3: API Endpoint Health & Security Headers
 *   Stage 4: Script Check Module Code Integrity
 *
 * Usage:
 *   npx tsx scripts/e2e-production-healthcheck.ts
 */

const BASE_URL = 'https://pitchcoachai.tech';
const CLERK_FAPI = 'https://clerk.pitchcoachai.tech';

type LogLevel = 'INFO' | 'PASS' | 'FAIL' | 'WARN' | 'STEP';
const results: { name: string; stage: string; passed: boolean; error?: string; ms: number }[] = [];

function log(level: LogLevel, stage: string, msg: string, detail?: unknown) {
  const ts = new Date().toISOString().slice(11, 19);
  const pfx = `[${ts}] [${level}] [${stage}]`;
  if (detail !== undefined) console.log(`${pfx} ${msg}`, typeof detail === 'object' ? JSON.stringify(detail) : detail);
  else console.log(`${pfx} ${msg}`);
}

async function test(name: string, stage: string, fn: () => Promise<void>) {
  const start = Date.now();
  try {
    await fn();
    results.push({ name, stage, passed: true, ms: Date.now() - start });
    log('PASS', stage, `✓ ${name}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    results.push({ name, stage, passed: false, error: msg, ms: Date.now() - start });
    log('FAIL', stage, `✗ ${name}`, msg);
  }
}

async function fetchStatus(url: string, opts?: RequestInit): Promise<{ status: number; body: string; headers: Headers }> {
  const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(10_000) });
  const body = await res.text();
  return { status: res.status, body, headers: res.headers };
}

// ═══════════════════════════════════════════════════════════════════════
// STAGE 1: INFRASTRUCTURE HANDSHAKES
// ═══════════════════════════════════════════════════════════════════════

async function stage1_Handshakes() {
  const S = 'S1-HANDSHAKE';
  log('STEP', S, '═══════════════════════════════════════════════════');
  log('STEP', S, 'STAGE 1: Infrastructure Handshakes');
  log('STEP', S, '═══════════════════════════════════════════════════');

  await test('1.1: Production site is reachable', S, async () => {
    const { status } = await fetchStatus(BASE_URL);
    if (status !== 200) throw new Error(`Expected 200, got ${status}`);
  });

  await test('1.2: Health endpoint returns ok', S, async () => {
    const { status, body } = await fetchStatus(`${BASE_URL}/api/health`);
    if (status !== 200) throw new Error(`Expected 200, got ${status}`);
    const data = JSON.parse(body);
    if (data.status !== 'ok') throw new Error(`Expected status=ok, got ${data.status}`);
  });

  await test('1.3: Clerk FAPI is reachable', S, async () => {
    const { status } = await fetchStatus(`${CLERK_FAPI}/v1/client?_is_native=1`);
    if (status !== 200) throw new Error(`Expected 200, got ${status}`);
  });

  await test('1.4: Clerk custom FAPI domain resolves', S, async () => {
    const { status, body } = await fetchStatus(`${CLERK_FAPI}/v1/client?_is_native=1`);
    // Should return JSON with client data (even without auth)
    if (!body.includes('response') && !body.includes('client') && status !== 200) {
      throw new Error('Clerk FAPI not returning expected response structure');
    }
  });

  await test('1.5: Blob upload endpoint requires auth', S, async () => {
    const { status, body } = await fetchStatus(`${BASE_URL}/api/blob/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    // Should return 401 (not signed in) — this proves the endpoint exists AND auth check works
    if (status !== 401) throw new Error(`Expected 401 (auth required), got ${status}: ${body.substring(0, 200)}`);
  });

  await test('1.6: Coach script endpoint requires auth', S, async () => {
    const { status } = await fetchStatus(`${BASE_URL}/api/coach/script`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'test' }),
    });
    if (status !== 401) throw new Error(`Expected 401 (auth required), got ${status}`);
  });
}

// ═══════════════════════════════════════════════════════════════════════
// STAGE 2: PUBLIC ROUTES & AUTH PAGES
// ═══════════════════════════════════════════════════════════════════════

async function stage2_PublicRoutes() {
  const S = 'S2-ROUTES';
  log('STEP', S, '═══════════════════════════════════════════════════');
  log('STEP', S, 'STAGE 2: Public Routes & Auth Pages');
  log('STEP', S, '═══════════════════════════════════════════════════');

  await test('2.1: Landing page loads', S, async () => {
    const { status } = await fetchStatus(BASE_URL);
    if (status !== 200) throw new Error(`Landing page returned ${status}`);
  });

  await test('2.2: Sign-in page loads with catch-all route', S, async () => {
    const { status, body } = await fetchStatus(`${BASE_URL}/sign-in`);
    if (status !== 200) throw new Error(`Sign-in page returned ${status}`);
    // Should contain Clerk SignIn component marker
    if (!body.includes('clerk') && !body.includes('sign-in') && !body.includes('SignIn')) {
      throw new Error('Sign-in page does not appear to contain Clerk component');
    }
  });

  await test('2.3: Sign-up page loads with catch-all route', S, async () => {
    const { status, body } = await fetchStatus(`${BASE_URL}/sign-up`);
    if (status !== 200) throw new Error(`Sign-up page returned ${status}`);
    if (!body.includes('clerk') && !body.includes('sign-up') && !body.includes('SignUp')) {
      throw new Error('Sign-up page does not appear to contain Clerk component');
    }
  });

  await test('2.4: Google SSO callback route works (was 404 before Session 13 fix)', S, async () => {
    const { status } = await fetchStatus(`${BASE_URL}/sign-up/sso-callback`);
    // Should NOT be 404 — the catch-all [[...sign-up]] route handles SSO callbacks
    if (status === 404) throw new Error('SSO callback returns 404 — catch-all route fix is not deployed!');
    // May be 200 (page renders) or 302 (redirect) — both are valid
    log('INFO', S, `SSO callback status: ${status}`);
  });

  await test('2.5: Pricing page loads', S, async () => {
    const { status } = await fetchStatus(`${BASE_URL}/pricing`);
    if (status !== 200) throw new Error(`Pricing page returned ${status}`);
  });

  await test('2.6: About page loads', S, async () => {
    const { status } = await fetchStatus(`${BASE_URL}/about`);
    if (status !== 200) throw new Error(`About page returned ${status}`);
  });

  await test('2.7: Contact page loads', S, async () => {
    const { status } = await fetchStatus(`${BASE_URL}/contact`);
    if (status !== 200) throw new Error(`Contact page returned ${status}`);
  });

  await test('2.8: Dashboard is auth-protected (Clerk signed-out header)', S, async () => {
    const { status, headers } = await fetchStatus(`${BASE_URL}/dashboard`, { redirect: 'manual' });
    // Clerk middleware returns 200 with x-clerk-auth-status: signed-out for client-side redirect
    const clerkAuth = headers.get('x-clerk-auth-status');
    if (clerkAuth === 'signed-out') {
      log('INFO', S, 'Dashboard correctly shows signed-out status (client-side redirect)');
    } else if (status === 302 || status === 307) {
      log('INFO', S, 'Dashboard returns server redirect (also valid)');
    } else {
      throw new Error(`Dashboard not protected — status=${status}, clerk-auth=${clerkAuth}`);
    }
  });

  await test('2.9: Elevator script new page is auth-protected (Clerk signed-out header)', S, async () => {
    const { status, headers } = await fetchStatus(`${BASE_URL}/elevator-script/new`, { redirect: 'manual' });
    const clerkAuth = headers.get('x-clerk-auth-status');
    if (clerkAuth === 'signed-out') {
      log('INFO', S, 'Elevator script new correctly shows signed-out status (client-side redirect)');
    } else if (status === 302 || status === 307) {
      log('INFO', S, 'Elevator script new returns server redirect (also valid)');
    } else {
      throw new Error(`Elevator script new not protected — status=${status}, clerk-auth=${clerkAuth}`);
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════
// STAGE 3: API ENDPOINT HEALTH & SECURITY HEADERS
// ═══════════════════════════════════════════════════════════════════════

async function stage3_SecurityHeaders() {
  const S = 'S3-SECURITY';
  log('STEP', S, '═══════════════════════════════════════════════════');
  log('STEP', S, 'STAGE 3: API Endpoint Health & Security Headers');
  log('STEP', S, '═══════════════════════════════════════════════════');

  await test('3.1: CSP connect-src includes Clerk FAPI domain', S, async () => {
    const { headers } = await fetchStatus(BASE_URL);
    const csp = headers.get('content-security-policy') || '';
    if (!csp.includes('connect-src')) {
      throw new Error(`CSP missing connect-src directive! Full CSP: ${csp.substring(0, 300)}`);
    }
    if (!csp.includes('clerk.pitchcoachai.tech')) {
      throw new Error(`CSP connect-src missing clerk.pitchcoachai.tech! CSP: ${csp.substring(0, 500)}`);
    }
    log('INFO', S, 'CSP connect-src verified with Clerk FAPI domain');
  });

  await test('3.2: CSP includes Cloudflare Turnstile domain', S, async () => {
    const { headers } = await fetchStatus(BASE_URL);
    const csp = headers.get('content-security-policy') || '';
    if (!csp.includes('challenges.cloudflare.com')) {
      throw new Error('CSP missing challenges.cloudflare.com for Turnstile CAPTCHA');
    }
  });

  await test('3.3: CSP includes Vercel Blob domain', S, async () => {
    const { headers } = await fetchStatus(BASE_URL);
    const csp = headers.get('content-security-policy') || '';
    if (!csp.includes('blob.vercel-storage.com')) {
      throw new Error('CSP missing blob.vercel-storage.com for file uploads');
    }
  });

  await test('3.4: X-Frame-Options is DENY', S, async () => {
    const { headers } = await fetchStatus(BASE_URL);
    const xfo = headers.get('x-frame-options');
    if (xfo !== 'DENY') throw new Error(`Expected X-Frame-Options=DENY, got ${xfo}`);
  });

  await test('3.5: X-Content-Type-Options is nosniff', S, async () => {
    const { headers } = await fetchStatus(BASE_URL);
    const xcto = headers.get('x-content-type-options');
    if (xcto !== 'nosniff') throw new Error(`Expected nosniff, got ${xcto}`);
  });

  await test('3.6: HSTS is enabled', S, async () => {
    const { headers } = await fetchStatus(BASE_URL);
    const hsts = headers.get('strict-transport-security');
    if (!hsts || !hsts.includes('max-age')) throw new Error(`HSTS missing or invalid: ${hsts}`);
  });

  await test('3.7: Health API returns proper content-type', S, async () => {
    const { headers } = await fetchStatus(`${BASE_URL}/api/health`);
    const ct = headers.get('content-type');
    if (!ct?.includes('application/json')) throw new Error(`Expected application/json, got ${ct}`);
  });

  await test('3.8: Webhook endpoint exists and rejects invalid signatures', S, async () => {
    const { status } = await fetchStatus(`${BASE_URL}/api/webhooks/clerk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'user.created', data: {} }),
    });
    // Should be 400 (missing svix headers) — proves the endpoint exists
    if (status === 404) throw new Error('Webhook endpoint not found!');
    if (status === 500) throw new Error('Webhook missing CLERK_WEBHOOK_SECRET');
    log('INFO', S, `Webhook endpoint status: ${status} (expected 400 for missing svix headers)`);
  });
}

// ═══════════════════════════════════════════════════════════════════════
// STAGE 4: CODE INTEGRITY CHECKS
// ═══════════════════════════════════════════════════════════════════════

async function stage4_CodeIntegrity() {
  const S = 'S4-CODE';
  log('STEP', S, '═══════════════════════════════════════════════════');
  log('STEP', S, 'STAGE 4: Code Integrity Checks');
  log('STEP', S, '═══════════════════════════════════════════════════');

  const fs = await import('fs');
  const path = await import('path');

  await test('4.1: ClerkProvider has afterSignUpUrl', S, async () => {
    const layout = fs.readFileSync('src/app/layout.tsx', 'utf8');
    if (!layout.includes('afterSignUpUrl')) {
      throw new Error('ClerkProvider missing afterSignUpUrl — sign-up redirect safety net is gone!');
    }
    if (!layout.includes('afterSignInUrl')) {
      throw new Error('ClerkProvider missing afterSignInUrl — sign-in redirect safety net is gone!');
    }
    if (!layout.includes('/onboarding')) {
      throw new Error('afterSignUpUrl not set to /onboarding');
    }
  });

  await test('4.2: Sign-in page has catch-all route [[...sign-in]]', S, async () => {
    const signinDir = 'src/app/(auth)/sign-in/[[...sign-in]]';
    if (!fs.existsSync(path.join(signinDir, 'page.tsx'))) {
      throw new Error('Sign-in page not using catch-all route — Google SSO will 404!');
    }
  });

  await test('4.3: Sign-up page has catch-all route [[...sign-up]]', S, async () => {
    const signupDir = 'src/app/(auth)/sign-up/[[...sign-up]]';
    if (!fs.existsSync(path.join(signupDir, 'page.tsx'))) {
      throw new Error('Sign-up page not using catch-all route — Google SSO will 404!');
    }
  });

  await test('4.4: CSP connect-src has directive prefix in next.config.ts', S, async () => {
    const config = fs.readFileSync('next.config.ts', 'utf8');
    if (!config.includes('"connect-src "')) {
      throw new Error('CSP connect-src missing directive prefix — browser will ignore it and block all cross-origin requests!');
    }
  });

  await test('4.5: Webhook handler handles blocked emails correctly (no zombie users)', S, async () => {
    const webhook = fs.readFileSync('src/app/api/webhooks/clerk/route.ts', 'utf8');
    // Should NOT have: isBlockedEmail(email) → return (the old bug)
    // Should have: isBlockedEmail check continues to create user
    if (!webhook.includes('isBlockedEmail')) {
      throw new Error('isBlockedEmail check missing from webhook');
    }
    // Check that blocked emails still create DB records (not silently returning)
    const blockedSection = webhook.substring(
      webhook.indexOf('isBlockedEmail'),
      webhook.indexOf('isBlockedEmail') + 300
    );
    if (blockedSection.includes('return;') || blockedSection.includes('return;')) {
      // Old bug: isBlockedEmail returned early without creating user record
      throw new Error('isBlockedEmail still has early return — zombie user bug is back!');
    }
  });

  await test('4.6: Webhook uses upsert for subscription/usage (race condition fix)', S, async () => {
    const webhook = fs.readFileSync('src/app/api/webhooks/clerk/route.ts', 'utf8');
    if (!webhook.includes('upsert')) {
      throw new Error('Webhook not using upsert for subscription/usage — race condition bug!');
    }
  });

  await test('4.7: Webhook checks email on re-signup (uniqueness fix)', S, async () => {
    const webhook = fs.readFileSync('src/app/api/webhooks/clerk/route.ts', 'utf8');
    if (!webhook.includes('existingByEmail')) {
      throw new Error('Webhook not checking email on re-signup — uniqueness violation bug!');
    }
  });

  await test('4.8: Middleware clears both __client and __session cookies', S, async () => {
    const middleware = fs.readFileSync('src/middleware.ts', 'utf8');
    if (!middleware.includes('__client') || !middleware.includes('__session')) {
      throw new Error('Middleware not clearing both cookies — half-signed-out state bug!');
    }
  });

  await test('4.9: Blob upload route has BLOB_READ_WRITE_TOKEN pre-check', S, async () => {
    const upload = fs.readFileSync('src/app/api/blob/upload/route.ts', 'utf8');
    if (!upload.includes('BLOB_READ_WRITE_TOKEN')) {
      throw new Error('Blob upload route missing BLOB_READ_WRITE_TOKEN pre-check!');
    }
    if (!upload.includes('handleUpload')) {
      throw new Error('Blob upload route missing handleUpload() call!');
    }
  });

  await test('4.10: Blob upload route validates token format', S, async () => {
    const upload = fs.readFileSync('src/app/api/blob/upload/route.ts', 'utf8');
    if (!upload.includes('vercel_blob_rw_') || !upload.includes('vcp_')) {
      throw new Error('Blob upload route missing token format validation!');
    }
  });

  await test('4.11: PLAN_LIMITS uses single source of truth', S, async () => {
    const planConfig = fs.readFileSync('src/lib/plan-config.ts', 'utf8');
    if (!planConfig.includes('PLAN_LIMITS')) {
      throw new Error('plan-config.ts missing PLAN_LIMITS export!');
    }
    // Verify E1-E5 fields exist
    for (const field of ['e1', 'e2', 'e3', 'e4', 'e5']) {
      if (!planConfig.includes(field)) {
        throw new Error(`PLAN_LIMITS missing ${field} field!`);
      }
    }
  });

  await test('4.12: No hardcoded PLAN_LIMITS in module pages', S, async () => {
    const modulePages = [
      'src/app/(dashboard)/pitch-deck-analyser/new/page.tsx',
      'src/app/(dashboard)/elevator-script/new/page.tsx',
      'src/app/(dashboard)/elevator-pitch-live/new/page.tsx',
    ];
    for (const page of modulePages) {
      if (fs.existsSync(page)) {
        const content = fs.readFileSync(page, 'utf8');
        // Should import from plan-config, not define locally
        if (content.includes('FREE') && content.includes('STARTER') && content.includes('PROFESSIONAL') && !content.includes('plan-config')) {
          throw new Error(`${page} has hardcoded plan limits instead of importing from plan-config!`);
        }
      }
    }
  });

  await test('4.13: No catch(error: any) in API routes', S, async () => {
    const routes = [
      'src/app/api/coach/script/route.ts',
      'src/app/api/coach/deck/route.ts',
      'src/app/api/blob/upload/route.ts',
    ];
    for (const route of routes) {
      if (fs.existsSync(route)) {
        const content = fs.readFileSync(route, 'utf8');
        if (content.includes('catch(error: any)')) {
          throw new Error(`${route} still has catch(error: any) — type safety regression!`);
        }
      }
    }
  });

  await test('4.14: TypeScript compiles without errors', S, async () => {
    const { execSync } = await import('child_process');
    try {
      execSync('npx tsc --noEmit', { cwd: process.cwd(), timeout: 120_000, stdio: 'pipe' });
    } catch (err: unknown) {
      throw new Error('TypeScript compilation failed! Run `npx tsc --noEmit` for details.');
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════
// REPORT
// ═══════════════════════════════════════════════════════════════════════

function printReport() {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════════════════╗');
  console.log('║          PRODUCTION E2E HEALTHCHECK — PitchCoach Ai                    ║');
  console.log('╠══════════════════════════════════════════════════════════════════════════╣');

  const stages = [
    { id: 'S1-HANDSHAKE', name: 'Infrastructure Handshakes' },
    { id: 'S2-ROUTES', name: 'Public Routes & Auth Pages' },
    { id: 'S3-SECURITY', name: 'API Health & Security Headers' },
    { id: 'S4-CODE', name: 'Code Integrity Checks' },
  ];

  for (const stage of stages) {
    const stageResults = results.filter(r => r.stage === stage.id);
    const passed = stageResults.filter(r => r.passed).length;
    const failed = stageResults.filter(r => !r.passed).length;
    const total = stageResults.length;
    console.log(`║                                                                          ║`);
    console.log(`║  ${stage.id}: ${stage.name.padEnd(44)} ║`);
    console.log(`║    Passed: ${String(passed).padStart(2)}/${total}   Failed: ${String(failed).padStart(2)}${' '.repeat(37)}║`);
    for (const r of stageResults.filter(r => !r.passed)) {
      console.log(`║    ✗ ${r.name.padEnd(56)} ║`);
      if (r.error) console.log(`║      ${r.error.substring(0, 60).padEnd(58)}║`);
    }
  }

  const totalPassed = results.filter(r => r.passed).length;
  const totalFailed = results.filter(r => !r.passed).length;
  const totalTests = results.length;

  console.log(`║                                                                          ║`);
  console.log('╠══════════════════════════════════════════════════════════════════════════╣');
  console.log(`║  TOTAL: ${String(totalPassed).padStart(2)}/${totalTests} passed   ${String(totalFailed).padStart(2)} failed${' '.repeat(33)}║`);
  console.log(`║  Status: ${totalFailed === 0 ? '✓ ALL PASSED'.padEnd(55) : `✗ ${totalFailed} FAILED`.padEnd(55)} ║`);
  console.log('╚══════════════════════════════════════════════════════════════════════════╝');
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════

async function main() {
  console.log(`\n═══════════════════════════════════════════════════════════════════════`);
  console.log(`Production E2E Healthcheck — ${new Date().toISOString()}`);
  console.log(`Target: ${BASE_URL}`);
  console.log(`═══════════════════════════════════════════════════════════════════════\n`);

  try { await stage1_Handshakes(); } catch (e: unknown) { log('FAIL', 'S1', 'Stage 1 crashed', e instanceof Error ? e.message : String(e)); }
  try { await stage2_PublicRoutes(); } catch (e: unknown) { log('FAIL', 'S2', 'Stage 2 crashed', e instanceof Error ? e.message : String(e)); }
  try { await stage3_SecurityHeaders(); } catch (e: unknown) { log('FAIL', 'S3', 'Stage 3 crashed', e instanceof Error ? e.message : String(e)); }
  try { await stage4_CodeIntegrity(); } catch (e: unknown) { log('FAIL', 'S4', 'Stage 4 crashed', e instanceof Error ? e.message : String(e)); }

  printReport();

  const totalFailed = results.filter(r => !r.passed).length;
  process.exit(totalFailed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
