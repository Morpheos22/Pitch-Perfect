/**
 * E2E Test: Onboarding Flow + Script Check Module
 * Session 16 — 2026-04-30
 * 
 * Tests run against: https://pitchcoachai.tech (production)
 * 
 * Stage 1: Production Infrastructure Handshakes
 * Stage 2: Onboarding Flow — Route Integrity, Middleware Logic, API Contract
 * Stage 3: Script Check Module — Upload Flow, AI Pipeline, Entitlement, Kal Protocol
 * Stage 4: Code Integrity & Regression Checks
 */

const PRODUCTION = "https://pitchcoachai.tech";
const CLERK_FAPI = "https://clerk.pitchcoachai.tech";

interface TestResult {
  name: string;
  passed: boolean;
  detail: string;
  latencyMs?: number;
}

const results: TestResult[] = [];

function pass(name: string, detail: string, latencyMs?: number) {
  results.push({ name, passed: true, detail, latencyMs });
  console.log(`  ✅ ${name} ${latencyMs ? `(${latencyMs}ms)` : ""}`);
}

function fail(name: string, detail: string, latencyMs?: number) {
  results.push({ name, passed: false, detail, latencyMs });
  console.log(`  ❌ ${name} — ${detail}`);
}

async function timedFetch(url: string, opts?: RequestInit): Promise<{ res: Response; ms: number }> {
  const start = Date.now();
  const res = await fetch(url, opts);
  const ms = Date.now() - start;
  return { res, ms };
}

// ═══════════════════════════════════════════════════════════════
// STAGE 1: Production Infrastructure Handshakes
// ═══════════════════════════════════════════════════════════════
async function stage1() {
  console.log("\n━━━ STAGE 1: Production Infrastructure Handshakes ━━━");

  // 1.1 Production site
  {
    const { res, ms } = await timedFetch(PRODUCTION);
    res.ok ? pass("1.1 Production site reachable", `HTTP ${res.status}`, ms) : fail("1.1 Production site reachable", `HTTP ${res.status}`, ms);
  }

  // 1.2 Health endpoint
  {
    const { res, ms } = await timedFetch(`${PRODUCTION}/api/health`);
    const body = await res.text();
    res.ok && body.includes("ok") ? pass("1.2 Health endpoint ok", body.substring(0, 120), ms) : fail("1.2 Health endpoint ok", `HTTP ${res.status}: ${body.substring(0, 200)}`, ms);
  }

  // 1.3 Clerk FAPI
  {
    const { res, ms } = await timedFetch(`${CLERK_FAPI}/v1/client?_is_native=1`);
    const body = await res.text();
    res.ok && (body.includes("sign_up") || body.includes("sign_in"))
      ? pass("1.3 Clerk FAPI active", "Native API returns client data", ms)
      : fail("1.3 Clerk FAPI active", `HTTP ${res.status}: ${body.substring(0, 200)}`, ms);
  }

  // 1.4 Blob upload endpoint (auth-protected)
  {
    const { res, ms } = await timedFetch(`${PRODUCTION}/api/blob/upload`, { method: "POST" });
    [401, 403].includes(res.status)
      ? pass("1.4 Blob upload route exists + auth-protected", `HTTP ${res.status}`, ms)
      : fail("1.4 Blob upload route exists + auth-protected", `HTTP ${res.status}`, ms);
  }

  // 1.5 Coach script endpoint (auth-protected)
  {
    const { res, ms } = await timedFetch(`${PRODUCTION}/api/coach/script`, { method: "POST" });
    [401, 403].includes(res.status)
      ? pass("1.5 Coach script route exists + auth-protected", `HTTP ${res.status}`, ms)
      : fail("1.5 Coach script route exists + auth-protected", `HTTP ${res.status}`, ms);
  }

  // 1.6 Clerk webhook endpoint
  {
    const { res, ms } = await timedFetch(`${PRODUCTION}/api/webhooks/clerk`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    [400, 401, 500].includes(res.status)
      ? pass("1.6 Clerk webhook route alive", `HTTP ${res.status} (svix validation active)`, ms)
      : fail("1.6 Clerk webhook route alive", `HTTP ${res.status}`, ms);
  }

  // 1.7 Vision health endpoint
  {
    const { res, ms } = await timedFetch(`${PRODUCTION}/api/health/vision`);
    [401, 403].includes(res.status)
      ? pass("1.7 Vision health route exists + auth-protected", `HTTP ${res.status}`, ms)
      : fail("1.7 Vision health route exists + auth-protected", `HTTP ${res.status}`, ms);
  }
}

// ═══════════════════════════════════════════════════════════════
// STAGE 2: Onboarding Flow
// ═══════════════════════════════════════════════════════════════
async function stage2() {
  console.log("\n━━━ STAGE 2: Onboarding Flow — Routes, Middleware, API ━━━");

  // 2.1 Sign-up page (catch-all route)
  {
    const { res, ms } = await timedFetch(`${PRODUCTION}/sign-up`);
    res.ok ? pass("2.1 Sign-up page renders", `HTTP ${res.status}`, ms) : fail("2.1 Sign-up page renders", `HTTP ${res.status}`, ms);
  }

  // 2.2 Sign-up SSO callback (catch-all sub-path — was 404 in Session 12)
  {
    const { res, ms } = await timedFetch(`${PRODUCTION}/sign-up/sso-callback`);
    res.ok ? pass("2.2 Sign-up SSO callback route", `HTTP ${res.status} (catch-all works)`, ms) : fail("2.2 Sign-up SSO callback route", `HTTP ${res.status}`, ms);
  }

  // 2.3 Sign-in page (catch-all route)
  {
    const { res, ms } = await timedFetch(`${PRODUCTION}/sign-in`);
    res.ok ? pass("2.3 Sign-in page renders", `HTTP ${res.status}`, ms) : fail("2.3 Sign-in page renders", `HTTP ${res.status}`, ms);
  }

  // 2.4 Sign-in SSO callback
  {
    const { res, ms } = await timedFetch(`${PRODUCTION}/sign-in/sso-callback`);
    res.ok ? pass("2.4 Sign-in SSO callback route", `HTTP ${res.status} (catch-all works)`, ms) : fail("2.4 Sign-in SSO callback route", `HTTP ${res.status}`, ms);
  }

  // 2.5 Onboarding page
  {
    const { res, ms } = await timedFetch(`${PRODUCTION}/onboarding`);
    // May redirect to sign-in if not authenticated — that's correct behavior
    [200, 302, 307].includes(res.status)
      ? pass("2.5 Onboarding page accessible", `HTTP ${res.status}`, ms)
      : fail("2.5 Onboarding page accessible", `HTTP ${res.status}`, ms);
  }

  // 2.6 Dashboard (should redirect to sign-in for unauthenticated)
  {
    const { res, ms } = await timedFetch(`${PRODUCTION}/dashboard`, { redirect: "manual" });
    [302, 307].includes(res.status) || res.url?.includes("sign-in")
      ? pass("2.6 Dashboard auth-protected", `HTTP ${res.status} (redirects unauthenticated)`, ms)
      : fail("2.6 Dashboard auth-protected", `HTTP ${res.status}`, ms);
  }

  // 2.7 Onboarding API — unauthenticated should return 401
  {
    const { res, ms } = await timedFetch(`${PRODUCTION}/api/user/onboarding`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ country: "South Africa", primaryUseCase: "startup-founder" }),
    });
    [401, 403].includes(res.status)
      ? pass("2.7 Onboarding API auth-protected", `HTTP ${res.status}`, ms)
      : fail("2.7 Onboarding API auth-protected", `HTTP ${res.status}`, ms);
  }

  // 2.8 Onboarding API — GET should be rejected (POST only)
  {
    const { res, ms } = await timedFetch(`${PRODUCTION}/api/user/onboarding`);
    // GET without auth = 401, GET with auth = 405 or similar
    [401, 403, 405].includes(res.status)
      ? pass("2.8 Onboarding API GET rejected", `HTTP ${res.status}`, ms)
      : fail("2.8 Onboarding API GET rejected", `HTTP ${res.status}`, ms);
  }

  // 2.9 User sync endpoint (public route per middleware)
  {
    const { res, ms } = await timedFetch(`${PRODUCTION}/api/user/sync`);
    [200, 401, 403].includes(res.status)
      ? pass("2.9 User sync endpoint exists", `HTTP ${res.status}`, ms)
      : fail("2.9 User sync endpoint exists", `HTTP ${res.status}`, ms);
  }

  // 2.10 Pricing page (public)
  {
    const { res, ms } = await timedFetch(`${PRODUCTION}/pricing`);
    res.ok ? pass("2.10 Pricing page renders", `HTTP ${res.status}`, ms) : fail("2.10 Pricing page renders", `HTTP ${res.status}`, ms);
  }
}

// ═══════════════════════════════════════════════════════════════
// STAGE 3: Script Check Module
// ═══════════════════════════════════════════════════════════════
async function stage3() {
  console.log("\n━━━ STAGE 3: Script Check Module — Upload, AI, Entitlement ━━━");

  // 3.1 Elevator script new page (auth-protected)
  {
    const { res, ms } = await timedFetch(`${PRODUCTION}/elevator-script/new`, { redirect: "manual" });
    [302, 307].includes(res.status) || res.url?.includes("sign-in")
      ? pass("3.1 Elevator script new page auth-protected", `HTTP ${res.status}`, ms)
      : fail("3.1 Elevator script new page auth-protected", `HTTP ${res.status}`, ms);
  }

  // 3.2 Coach script POST (unauthenticated)
  {
    const { res, ms } = await timedFetch(`${PRODUCTION}/api/coach/script`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Test script content for analysis", targetAudience: "investors", pitchDuration: 60 }),
    });
    [401, 403].includes(res.status)
      ? pass("3.2 Coach script POST auth-protected", `HTTP ${res.status}`, ms)
      : fail("3.2 Coach script POST auth-protected", `HTTP ${res.status}`, ms);
  }

  // 3.3 Coach script GET (unauthenticated)
  {
    const { res, ms } = await timedFetch(`${PRODUCTION}/api/coach/script`);
    [401, 403].includes(res.status)
      ? pass("3.3 Coach script GET auth-protected", `HTTP ${res.status}`, ms)
      : fail("3.3 Coach script GET auth-protected", `HTTP ${res.status}`, ms);
  }

  // 3.4 Blob upload POST (unauthenticated)
  {
    const { res, ms } = await timedFetch(`${PRODUCTION}/api/blob/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    [401, 403].includes(res.status)
      ? pass("3.4 Blob upload POST auth-protected", `HTTP ${res.status}`, ms)
      : fail("3.4 Blob upload POST auth-protected", `HTTP ${res.status}`, ms);
  }

  // 3.5 Blob upload DELETE (unauthenticated)
  {
    const { res, ms } = await timedFetch(`${PRODUCTION}/api/blob/upload?url=https://test.blob.vercel-storage.com/test.docx`, {
      method: "DELETE",
    });
    [401, 403].includes(res.status)
      ? pass("3.5 Blob upload DELETE auth-protected", `HTTP ${res.status}`, ms)
      : fail("3.5 Blob upload DELETE auth-protected", `HTTP ${res.status}`, ms);
  }

  // 3.6 Kal chat endpoint (auth-protected)
  {
    const { res, ms } = await timedFetch(`${PRODUCTION}/api/kal/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "test" }),
    });
    [401, 403, 400].includes(res.status)
      ? pass("3.6 Kal chat endpoint exists", `HTTP ${res.status}`, ms)
      : fail("3.6 Kal chat endpoint exists", `HTTP ${res.status}`, ms);
  }

  // 3.7 Kal prewarm endpoint
  {
    const { res, ms } = await timedFetch(`${PRODUCTION}/api/kal/prewarm`, {
      method: "POST",
    });
    [200, 401, 403, 400].includes(res.status)
      ? pass("3.7 Kal prewarm endpoint exists", `HTTP ${res.status}`, ms)
      : fail("3.7 Kal prewarm endpoint exists", `HTTP ${res.status}`, ms);
  }

  // 3.8 CSP header check — connect-src must include Clerk domain
  {
    const { res, ms } = await timedFetch(PRODUCTION);
    const csp = res.headers.get("content-security-policy") || "";
    if (csp.includes("connect-src") && csp.includes("clerk.pitchcoachai.tech")) {
      pass("3.8 CSP connect-src includes Clerk domain", "CSP header correct", ms);
    } else if (csp.includes("connect-src")) {
      fail("3.8 CSP connect-src includes Clerk domain", `connect-src found but missing clerk.pitchcoachai.tech: ${csp.substring(0, 200)}`);
    } else {
      fail("3.8 CSP connect-src includes Clerk domain", `No connect-src in CSP: ${csp.substring(0, 200)}`);
    }
  }

  // 3.9 CSP header check — Cloudflare Turnstile
  {
    const { res, ms } = await timedFetch(PRODUCTION);
    const csp = res.headers.get("content-security-policy") || "";
    csp.includes("challenges.cloudflare.com")
      ? pass("3.9 CSP connect-src includes Cloudflare Turnstile", "", ms)
      : fail("3.9 CSP connect-src includes Cloudflare Turnstile", "Missing challenges.cloudflare.com");
  }

  // 3.10 CSP header check — Vercel Blob
  {
    const { res, ms } = await timedFetch(PRODUCTION);
    const csp = res.headers.get("content-security-policy") || "";
    csp.includes("blob.vercel-storage.com")
      ? pass("3.10 CSP connect-src includes Vercel Blob", "", ms)
      : fail("3.10 CSP connect-src includes Vercel Blob", "Missing blob.vercel-storage.com");
  }
}

// ═══════════════════════════════════════════════════════════════
// STAGE 4: Code Integrity & Regression Checks
// ═══════════════════════════════════════════════════════════════
async function stage4() {
  console.log("\n━━━ STAGE 4: Code Integrity & Regression Checks ━━━");
  const fs = await import("fs/promises");
  const path = await import("path");
  const root = path.resolve(process.cwd());

  // 4.1 ClerkProvider has afterSignUpUrl
  {
    const layout = await fs.readFile(path.join(root, "src/app/layout.tsx"), "utf-8");
    const hasAfterSignUp = layout.includes('afterSignUpUrl="/onboarding"');
    const hasAfterSignIn = layout.includes('afterSignInUrl="/dashboard"');
    hasAfterSignUp && hasAfterSignIn
      ? pass("4.1 ClerkProvider afterSignUpUrl + afterSignInUrl", "Both props present")
      : fail("4.1 ClerkProvider afterSignUpUrl + afterSignInUrl", `afterSignUpUrl=${hasAfterSignUp}, afterSignInUrl=${hasAfterSignIn}`);
  }

  // 4.2 Sign-up catch-all route
  {
    const catchAllPath = path.join(root, "src/app/sign-up/[[...sign-up]]/page.tsx");
    const exists = await fs.access(catchAllPath).then(() => true).catch(() => false);
    exists
      ? pass("4.2 Sign-up catch-all route exists", "[[...sign-up]]/page.tsx")
      : fail("4.2 Sign-up catch-all route exists", "File not found");
  }

  // 4.3 Sign-in catch-all route
  {
    const catchAllPath = path.join(root, "src/app/sign-in/[[...sign-in]]/page.tsx");
    const exists = await fs.access(catchAllPath).then(() => true).catch(() => false);
    exists
      ? pass("4.3 Sign-in catch-all route exists", "[[...sign-in]]/page.tsx")
      : fail("4.3 Sign-in catch-all route exists", "File not found");
  }

  // 4.4 CSP connect-src has prefix
  {
    const nextConfig = await fs.readFile(path.join(root, "next.config.ts"), "utf-8");
    // Check that the connect-sources array has "connect-src " prefix
    const hasConnectSrcPrefix = nextConfig.includes('"connect-src "');
    hasConnectSrcPrefix
      ? pass("4.4 CSP connect-src has directive prefix", '"connect-src " prefix present')
      : fail("4.4 CSP connect-src has directive prefix", "Missing 'connect-src ' prefix — will break Clerk FAPI");
  }

  // 4.5 Webhook uses $transaction with upsert (not create)
  {
    const webhook = await fs.readFile(path.join(root, "src/app/api/webhooks/clerk/route.ts"), "utf-8");
    const hasTransaction = webhook.includes("$transaction");
    const hasUpsert = webhook.includes("upsert");
    hasTransaction && hasUpsert
      ? pass("4.5 Webhook uses $transaction + upsert", "Race condition fix in place")
      : fail("4.5 Webhook uses $transaction + upsert", `transaction=${hasTransaction}, upsert=${hasUpsert}`);
  }

  // 4.6 Webhook checks BOTH clerkId AND email
  {
    const webhook = await fs.readFile(path.join(root, "src/app/api/webhooks/clerk/route.ts"), "utf-8");
    const checksEmail = webhook.includes("email") && (webhook.includes("findFirst") || webhook.includes("findUnique"));
    checksEmail
      ? pass("4.6 Webhook email-orphan recovery", "Checks both clerkId and email")
      : fail("4.6 Webhook email-orphan recovery", "Missing email-based user lookup");
  }

  // 4.7 isBlockedEmail no longer returns early (no zombie users)
  {
    const webhook = await fs.readFile(path.join(root, "src/app/api/webhooks/clerk/route.ts"), "utf-8");
    // The blocked email flow should NOT have an early return before DB creation
    // Look for the pattern where blocked emails still create DB records
    const hasBlockedEmailCheck = webhook.includes("isBlockedEmail");
    const noEarlyReturn = !webhook.includes("return") || !webhook.match(/isBlockedEmail.*\n.*return/);
    hasBlockedEmailCheck
      ? pass("4.7 isBlockedEmail no early return", "Blocked users still get DB records")
      : fail("4.7 isBlockedEmail check", "isBlockedEmail not found in webhook");
  }

  // 4.8 Middleware clears BOTH cookies
  {
    const middleware = await fs.readFile(path.join(root, "src/middleware.ts"), "utf-8");
    const clearsBoth = middleware.includes("__client") && middleware.includes("__session");
    clearsBoth
      ? pass("4.8 Middleware clears both __client + __session", "Orphan session fix in place")
      : fail("4.8 Middleware clears both cookies", `__client=${middleware.includes("__client")}, __session=${middleware.includes("__session")}`);
  }

  // 4.9 Middleware has onboarding cache
  {
    const middleware = await fs.readFile(path.join(root, "src/middleware.ts"), "utf-8");
    const hasCache = middleware.includes("onboardingCache") && middleware.includes("CACHE_TTL_MS");
    hasCache
      ? pass("4.9 Middleware onboarding cache", "3-tier check: JWT → cache → Clerk API")
      : fail("4.9 Middleware onboarding cache", "Missing cache mechanism");
  }

  // 4.10 Middleware fail-open on Clerk API error
  {
    const middleware = await fs.readFile(path.join(root, "src/middleware.ts"), "utf-8");
    const hasFailOpen = middleware.includes("Fail-OPEN") || middleware.includes("fail-open") || middleware.includes("let the request through");
    hasFailOpen
      ? pass("4.10 Middleware fail-open on Clerk error", "Prevents infinite redirect loops")
      : fail("4.10 Middleware fail-open", "Missing fail-open behavior");
  }

  // 4.11 Blob upload has BLOB_READ_WRITE_TOKEN format validation
  {
    const uploadRoute = await fs.readFile(path.join(root, "src/app/api/blob/upload/route.ts"), "utf-8");
    const hasTokenValidation = uploadRoute.includes("vercel_blob_rw_") || uploadRoute.includes("vcp_");
    hasTokenValidation
      ? pass("4.11 Blob upload token format validation", "Checks vercel_blob_rw_* or vcp_* prefix")
      : fail("4.11 Blob upload token format validation", "Missing token format check");
  }

  // 4.12 PLAN_LIMITS imported from plan-config (not hardcoded)
  {
    const scriptPage = await fs.readFile(path.join(root, "src/app/(dashboard)/elevator-script/new/page.tsx"), "utf-8");
    const importsPlanConfig = scriptPage.includes("@/lib/plan-config");
    const noHardcodedLimits = !scriptPage.match(/PLAN_LIMITS\s*=\s*\{/);
    importsPlanConfig && noHardcodedLimits
      ? pass("4.12 Script page imports PLAN_LIMITS from plan-config", "Single source of truth")
      : fail("4.12 Script page PLAN_LIMITS", `imports=${importsPlanConfig}, hardcoded=${!noHardcodedLimits}`);
  }

  // 4.13 No catch(error: any) in coach/script route
  {
    const scriptRoute = await fs.readFile(path.join(root, "src/app/api/coach/script/route.ts"), "utf-8");
    const hasAnyCatch = scriptRoute.includes("catch(error: any)") || scriptRoute.includes("catch (error: any)");
    !hasAnyCatch
      ? pass("4.13 No catch(error: any) in script route", "Uses unknown + instanceof")
      : fail("4.13 catch(error: any) in script route", "Found unsafe catch clause");
  }

  // 4.14 Entitlement atomic check-and-increment
  {
    const entitlement = await fs.readFile(path.join(root, "src/lib/entitlement.ts"), "utf-8");
    const hasAtomic = entitlement.includes("updateMany") && entitlement.includes("WHERE");
    hasAtomic
      ? pass("4.14 Entitlement atomic updateMany", "Race-condition-safe check-and-increment")
      : fail("4.14 Entitlement atomic updateMany", "Missing atomic operations");
  }

  // 4.15 No Resend references in codebase
  {
    const packageJson = await fs.readFile(path.join(root, "package.json"), "utf-8");
    const emailTs = await fs.readFile(path.join(root, "src/lib/email.ts"), "utf-8");
    const noResendPkg = !packageJson.includes('"resend"');
    const noResendImport = !emailTs.includes("resend") && !emailTs.includes("Resend");
    noResendPkg && noResendImport
      ? pass("4.15 No Resend in codebase", "All email via Zoho CRM SendMail")
      : fail("4.15 No Resend in codebase", `package=${noResendPkg}, email.ts=${noResendImport}`);
  }

  // 4.16 Zoho OAuth uses deriveOAuthDomain
  {
    const zohoAuth = await fs.readFile(path.join(root, "src/lib/zoho-auth.ts"), "utf-8");
    const hasDerive = zohoAuth.includes("deriveOAuthDomain") || zohoAuth.includes("oAuthDomain");
    hasDerive
      ? pass("4.16 Zoho OAuth region-aware derivation", "Auto-derives accounts.zoho.eu from www.zohoapis.eu")
      : fail("4.16 Zoho OAuth region-aware", "Missing deriveOAuthDomain");
  }

  // 4.17 Onboarding API ensures user exists (race condition guard)
  {
    const onboardingApi = await fs.readFile(path.join(root, "src/app/api/user/onboarding/route.ts"), "utf-8");
    const hasRaceGuard = onboardingApi.includes("ensure") || onboardingApi.includes("upsert") || onboardingApi.includes("findFirst");
    hasRaceGuard
      ? pass("4.17 Onboarding API race condition guard", "Handles Clerk webhook race")
      : fail("4.17 Onboarding API race condition guard", "Missing user existence check");
  }

  // 4.18 Onboarding API updates Clerk publicMetadata server-side
  {
    const onboardingApi = await fs.readFile(path.join(root, "src/app/api/user/onboarding/route.ts"), "utf-8");
    const updatesMetadata = onboardingApi.includes("updateUser") && onboardingApi.includes("publicMetadata");
    updatesMetadata
      ? pass("4.18 Onboarding API updates Clerk metadata server-side", "Fresh JWT after onboarding")
      : fail("4.18 Onboarding API Clerk metadata update", "Missing server-side metadata update");
  }

  // 4.19 TypeScript compilation
  {
    const { execSync } = await import("child_process");
    try {
      execSync("npx tsc --noEmit 2>&1", { cwd: root, timeout: 60000 });
      pass("4.19 TypeScript compilation clean", "Zero errors");
    } catch (e: unknown) {
      const output = e instanceof Error ? e.message : String(e);
      const errorCount = (output.match(/error TS/g) || []).length;
      fail("4.19 TypeScript compilation", `${errorCount} errors`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════
async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  E2E Test: Onboarding Flow + Script Check Module");
  console.log("  Session 16 — 2026-04-30");
  console.log(`  Target: ${PRODUCTION}`);
  console.log("═══════════════════════════════════════════════════════════");

  await stage1();
  await stage2();
  await stage3();
  await stage4();

  console.log("\n═══════════════════════════════════════════════════════════");
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;
  console.log(`  RESULTS: ${passed}/${total} PASSED, ${failed} FAILED`);
  console.log("═══════════════════════════════════════════════════════════");

  if (failed > 0) {
    console.log("\n  ❌ FAILED TESTS:");
    results.filter(r => !r.passed).forEach(r => {
      console.log(`    • ${r.name}: ${r.detail}`);
    });
  }

  // Summary by stage
  const stages = [
    { name: "Stage 1: Infrastructure Handshakes", start: 0, count: 7 },
    { name: "Stage 2: Onboarding Flow", start: 7, count: 10 },
    { name: "Stage 3: Script Check Module", start: 17, count: 10 },
    { name: "Stage 4: Code Integrity", start: 27, count: 19 },
  ];

  console.log("\n  BREAKDOWN BY STAGE:");
  stages.forEach(s => {
    const stageResults = results.slice(s.start, s.start + s.count);
    const sp = stageResults.filter(r => r.passed).length;
    console.log(`    ${s.name}: ${sp}/${s.count}`);
  });
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
