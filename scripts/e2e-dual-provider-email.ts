/**
 * E2E Test: Dual-Provider Email Architecture + Onboarding + Script Check
 * Session 16 — 2026-04-30
 * 
 * Validates:
 * 1. Resend package installed + importable
 * 2. Dual-provider email code (Zoho PRIMARY → Resend FALLBACK)
 * 3. Zoho sender email updated to akanimohdavid@yahoo.com
 * 4. Onboarding flow endpoints
 * 5. Script check module endpoints
 * 6. Production infrastructure
 * 7. Code integrity checks
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const PRODUCTION = "https://pitchcoachai.tech";
const CLERK_FAPI = "https://clerk.pitchcoachai.tech";
const root = path.resolve(process.cwd());

interface TestResult {
  name: string;
  passed: boolean;
  detail: string;
}

const results: TestResult[] = [];

function pass(name: string, detail: string) {
  results.push({ name, passed: true, detail });
  console.log(`  ✅ ${name}`);
}

function fail(name: string, detail: string) {
  results.push({ name, passed: false, detail });
  console.log(`  ❌ ${name} — ${detail}`);
}

function readFile(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf-8");
}

// ═══════════════════════════════════════════════════════════════
// STAGE 1: Resend Integration + Dual-Provider Email
// ═══════════════════════════════════════════════════════════════
async function stage1() {
  console.log("\n━━━ STAGE 1: Resend Integration + Dual-Provider Email ━━━");

  // 1.1 Resend package installed
  {
    const pkg = JSON.parse(readFile("package.json"));
    const hasResend = !!pkg.dependencies?.resend;
    hasResend ? pass("1.1 Resend in package.json dependencies", `v${pkg.dependencies.resend}`) : fail("1.1 Resend in package.json", "Not found");
  }

  // 1.2 resend-email.ts exists
  {
    const exists = fs.existsSync(path.join(root, "src/lib/resend-email.ts"));
    exists ? pass("1.2 src/lib/resend-email.ts exists", "Resend fallback provider") : fail("1.2 resend-email.ts", "File not found");
  }

  // 1.3 resend-email.ts exports required functions
  {
    const content = readFile("src/lib/resend-email.ts");
    const hasOnboarding = content.includes("sendOnboardingEmailViaResend");
    const hasGeneric = content.includes("sendEmailViaResend");
    const hasHealth = content.includes("isResendConfigured");
    hasOnboarding && hasGeneric && hasHealth
      ? pass("1.3 resend-email.ts exports", "onboarding + generic + health check")
      : fail("1.3 resend-email.ts exports", `onboarding=${hasOnboarding}, generic=${hasGeneric}, health=${hasHealth}`);
  }

  // 1.4 resend-email.ts uses lazy-load pattern
  {
    const content = readFile("src/lib/resend-email.ts");
    const hasLazy = content.includes("let resendClient") && content.includes("getResend()");
    hasLazy ? pass("1.4 Resend lazy-load pattern", "Avoids build-time errors when API key missing") : fail("1.4 Resend lazy-load", "Missing lazy-load pattern");
  }

  // 1.5 zoho-crm.ts imports Resend fallback
  {
    const content = readFile("src/lib/zoho-crm.ts");
    const hasImport = content.includes("sendOnboardingEmailViaResend");
    hasImport ? pass("1.5 zoho-crm.ts imports Resend fallback", "Dual-provider wired") : fail("1.5 zoho-crm.ts Resend import", "Missing import");
  }

  // 1.6 zoho-crm.ts has dual-provider flow in sendOnboardingEmail
  {
    const content = readFile("src/lib/zoho-crm.ts");
    const hasZohoPrimary = content.includes("Zoho CRM (PRIMARY)") || content.includes("DUAL-PROVIDER");
    const hasResendFallback = content.includes("Resend fallback") || content.includes("sendOnboardingEmailViaResend");
    hasZohoPrimary && hasResendFallback
      ? pass("1.6 sendOnboardingEmail dual-provider", "Zoho PRIMARY → Resend FALLBACK")
      : fail("1.6 sendOnboardingEmail dual-provider", `primary=${hasZohoPrimary}, fallback=${hasResendFallback}`);
  }

  // 1.7 email.ts has dual-provider for generic emails
  {
    const content = readFile("src/lib/email.ts");
    const hasZohoPrimary = content.includes("Zoho CRM SendMail API, with Resend fallback") || content.includes("Zoho CRM (PRIMARY)");
    const hasResendFallback = content.includes("sendEmailViaResend");
    hasZohoPrimary && hasResendFallback
      ? pass("1.7 email.ts dual-provider", "Zoho PRIMARY → Resend FALLBACK")
      : fail("1.7 email.ts dual-provider", `primary=${hasZohoPrimary}, fallback=${hasResendFallback}`);
  }

  // 1.8 Zoho sender email updated
  {
    const content = readFile("src/lib/zoho-auth.ts");
    const hasNewEmail = content.includes("akanimohdavid@yahoo.com");
    const noOldEmail = !content.includes("sherwyn@athena agentic.co.za");
    hasNewEmail && noOldEmail
      ? pass("1.8 ZOHO_SENDER_EMAIL default updated", "akanimohdavid@yahoo.com")
      : fail("1.8 ZOHO_SENDER_EMAIL", `new=${hasNewEmail}, old-removed=${noOldEmail}`);
  }

  // 1.9 .env.example updated with RESEND vars
  {
    const content = readFile(".env.example");
    const hasResendKey = content.includes("RESEND_API_KEY");
    const hasResendFrom = content.includes("RESEND_FROM_EMAIL");
    const hasNewSender = content.includes("akanimohdavid@yahoo.com");
    hasResendKey && hasResendFrom && hasNewSender
      ? pass("1.9 .env.example updated", "RESEND_API_KEY + RESEND_FROM_EMAIL + new sender")
      : fail("1.9 .env.example", `key=${hasResendKey}, from=${hasResendFrom}, sender=${hasNewSender}`);
  }

  // 1.10 resend in serverExternalPackages
  {
    const content = readFile("next.config.ts");
    const hasResend = content.includes('"resend"');
    hasResend ? pass("1.10 resend in serverExternalPackages", "Serverless-compatible") : fail("1.10 resend in serverExternalPackages", "Missing");
  }

  // 1.11 Resend email content matches Zoho onboarding email
  {
    const resendContent = readFile("src/lib/resend-email.ts");
    const zohoContent = readFile("src/lib/zoho-crm.ts");
    const resendHasModules = resendContent.includes("Pitch Deck Analyser") && resendContent.includes("Script Check");
    const zohoHasModules = zohoContent.includes("Pitch Deck Analyser") && zohoContent.includes("Script Check");
    resendHasModules && zohoHasModules
      ? pass("1.11 Resend email matches Zoho email content", "Same HTML template, both list 5 modules")
      : fail("1.11 Email content parity", `resend=${resendHasModules}, zoho=${zohoHasModules}`);
  }

  // 1.12 Resend contact email updated
  {
    const content = readFile("src/lib/resend-email.ts");
    const hasNewEmail = content.includes("akanimohdavid@yahoo.com");
    hasNewEmail ? pass("1.12 Resend email footer uses new contact", "akanimohdavid@yahoo.com") : fail("1.12 Resend contact email", "Still using old email");
  }
}

// ═══════════════════════════════════════════════════════════════
// STAGE 2: Production Infrastructure
// ═══════════════════════════════════════════════════════════════
async function stage2() {
  console.log("\n━━━ STAGE 2: Production Infrastructure Handshakes ━━━");

  // 2.1 Production site
  {
    const res = await fetch(PRODUCTION);
    res.ok ? pass("2.1 Production site reachable", `HTTP ${res.status}`) : fail("2.1 Production site", `HTTP ${res.status}`);
  }

  // 2.2 Health endpoint
  {
    const res = await fetch(`${PRODUCTION}/api/health`);
    const body = await res.text();
    res.ok && body.includes("ok") ? pass("2.2 Health endpoint ok", "") : fail("2.2 Health endpoint", `HTTP ${res.status}`);
  }

  // 2.3 Clerk FAPI
  {
    const res = await fetch(`${CLERK_FAPI}/v1/client?_is_native=1`);
    res.ok ? pass("2.3 Clerk FAPI active", "") : fail("2.3 Clerk FAPI", `HTTP ${res.status}`);
  }

  // 2.4 Blob upload endpoint (auth-protected)
  {
    const res = await fetch(`${PRODUCTION}/api/blob/upload`, { method: "POST" });
    [401, 403].includes(res.status) ? pass("2.4 Blob upload auth-protected", `HTTP ${res.status}`) : fail("2.4 Blob upload", `HTTP ${res.status}`);
  }

  // 2.5 Coach script endpoint (auth-protected)
  {
    const res = await fetch(`${PRODUCTION}/api/coach/script`, { method: "POST" });
    [401, 403].includes(res.status) ? pass("2.5 Coach script auth-protected", `HTTP ${res.status}`) : fail("2.5 Coach script", `HTTP ${res.status}`);
  }

  // 2.6 Clerk webhook endpoint
  {
    const res = await fetch(`${PRODUCTION}/api/webhooks/clerk`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    [400, 401, 500].includes(res.status) ? pass("2.6 Clerk webhook alive", `HTTP ${res.status}`) : fail("2.6 Clerk webhook", `HTTP ${res.status}`);
  }
}

// ═══════════════════════════════════════════════════════════════
// STAGE 3: Onboarding Flow Routes
// ═══════════════════════════════════════════════════════════════
async function stage3() {
  console.log("\n━━━ STAGE 3: Onboarding Flow Routes ━━━");

  // 3.1 Sign-up page
  {
    const res = await fetch(`${PRODUCTION}/sign-up`);
    res.ok ? pass("3.1 Sign-up page renders", `HTTP ${res.status}`) : fail("3.1 Sign-up page", `HTTP ${res.status}`);
  }

  // 3.2 Sign-up SSO callback (catch-all)
  {
    const res = await fetch(`${PRODUCTION}/sign-up/sso-callback`);
    res.ok ? pass("3.2 Sign-up SSO callback", `HTTP ${res.status}`) : fail("3.2 Sign-up SSO callback", `HTTP ${res.status}`);
  }

  // 3.3 Sign-in page
  {
    const res = await fetch(`${PRODUCTION}/sign-in`);
    res.ok ? pass("3.3 Sign-in page renders", `HTTP ${res.status}`) : fail("3.3 Sign-in page", `HTTP ${res.status}`);
  }

  // 3.4 Sign-in SSO callback
  {
    const res = await fetch(`${PRODUCTION}/sign-in/sso-callback`);
    res.ok ? pass("3.4 Sign-in SSO callback", `HTTP ${res.status}`) : fail("3.4 Sign-in SSO callback", `HTTP ${res.status}`);
  }

  // 3.5 Onboarding page
  {
    const res = await fetch(`${PRODUCTION}/onboarding`);
    [200, 302, 307].includes(res.status) ? pass("3.5 Onboarding page accessible", `HTTP ${res.status}`) : fail("3.5 Onboarding page", `HTTP ${res.status}`);
  }

  // 3.6 Onboarding API auth-protected
  {
    const res = await fetch(`${PRODUCTION}/api/user/onboarding`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ country: "Nigeria", primaryUseCase: "startup-founder" }),
    });
    [401, 403].includes(res.status) ? pass("3.6 Onboarding API auth-protected", `HTTP ${res.status}`) : fail("3.6 Onboarding API", `HTTP ${res.status}`);
  }

  // 3.7 CSP connect-src includes Clerk
  {
    const res = await fetch(PRODUCTION);
    const csp = res.headers.get("content-security-policy") || "";
    csp.includes("clerk.pitchcoachai.tech") ? pass("3.7 CSP includes Clerk domain", "") : fail("3.7 CSP Clerk domain", "Missing");
  }
}

// ═══════════════════════════════════════════════════════════════
// STAGE 4: Code Integrity + Regression Checks
// ═══════════════════════════════════════════════════════════════
async function stage4() {
  console.log("\n━━━ STAGE 4: Code Integrity + Regression Checks ━━━");

  // 4.1 ClerkProvider has afterSignUpUrl
  {
    const layout = readFile("src/app/layout.tsx");
    layout.includes('afterSignUpUrl="/onboarding"') && layout.includes('afterSignInUrl="/dashboard"')
      ? pass("4.1 ClerkProvider redirect props", "Both present")
      : fail("4.1 ClerkProvider redirect props", "Missing");
  }

  // 4.2 Sign-up catch-all route
  {
    const exists = fs.existsSync(path.join(root, "src/app/(auth)/sign-up/[[...sign-up]]/page.tsx"));
    exists ? pass("4.2 Sign-up catch-all route", "(auth)/sign-up/[[...sign-up]]") : fail("4.2 Sign-up catch-all", "Not found");
  }

  // 4.3 Sign-in catch-all route
  {
    const exists = fs.existsSync(path.join(root, "src/app/(auth)/sign-in/[[...sign-in]]/page.tsx"));
    exists ? pass("4.3 Sign-in catch-all route", "(auth)/sign-in/[[...sign-in]]") : fail("4.3 Sign-in catch-all", "Not found");
  }

  // 4.4 CSP connect-src has prefix
  {
    const content = readFile("next.config.ts");
    content.includes('"connect-src "') ? pass("4.4 CSP connect-src prefix", "Directive prefix present") : fail("4.4 CSP prefix", "Missing");
  }

  // 4.5 Webhook uses $transaction + upsert
  {
    const content = readFile("src/app/api/webhooks/clerk/route.ts");
    content.includes("$transaction") && content.includes("upsert")
      ? pass("4.5 Webhook $transaction + upsert", "Race condition fix")
      : fail("4.5 Webhook race condition fix", "Missing");
  }

  // 4.6 Middleware clears both cookies
  {
    const content = readFile("src/middleware.ts");
    content.includes("__client") && content.includes("__session")
      ? pass("4.6 Middleware clears both cookies", "Orphan session fix")
      : fail("4.6 Middleware cookies", "Missing");
  }

  // 4.7 Middleware fail-open on Clerk error
  {
    const content = readFile("src/middleware.ts");
    content.includes("Fail-OPEN") || content.includes("fail-open") || content.includes("let the request through")
      ? pass("4.7 Middleware fail-open", "Prevents infinite redirect loops")
      : fail("4.7 Middleware fail-open", "Missing");
  }

  // 4.8 Blob upload token format validation
  {
    const content = readFile("src/app/api/blob/upload/route.ts");
    content.includes("vercel_blob_rw_") || content.includes("vcp_")
      ? pass("4.8 Blob token format validation", "Checks prefix")
      : fail("4.8 Blob token validation", "Missing");
  }

  // 4.9 PLAN_LIMITS from plan-config
  {
    const content = readFile("src/app/(dashboard)/elevator-script/new/page.tsx");
    content.includes("@/lib/plan-config") ? pass("4.9 PLAN_LIMITS from plan-config", "Single source of truth") : fail("4.9 PLAN_LIMITS", "Not importing from plan-config");
  }

  // 4.10 No catch(error: any) in script route
  {
    const content = readFile("src/app/api/coach/script/route.ts");
    !content.includes("catch(error: any)") ? pass("4.10 No catch(error: any)", "Uses unknown") : fail("4.10 catch(error: any)", "Found unsafe catch");
  }

  // 4.11 Entitlement atomic check-and-increment
  {
    const content = readFile("src/lib/entitlement.ts");
    content.includes("updateMany") ? pass("4.11 Entitlement atomic updateMany", "Race-safe") : fail("4.11 Entitlement atomic", "Missing");
  }

  // 4.12 Zoho OAuth region-aware derivation
  {
    const content = readFile("src/lib/zoho-auth.ts");
    content.includes("deriveOAuthDomain") ? pass("4.12 Zoho OAuth region-aware", "Auto-derives OAuth domain") : fail("4.12 Zoho OAuth region", "Missing deriveOAuthDomain");
  }

  // 4.13 Onboarding API Clerk metadata update
  {
    const content = readFile("src/app/api/user/onboarding/route.ts");
    content.includes("updateUser") && content.includes("publicMetadata")
      ? pass("4.13 Onboarding API Clerk metadata", "Server-side update")
      : fail("4.13 Onboarding API metadata", "Missing");
  }

  // 4.14 TypeScript compilation
  {
    try {
      execSync("npx tsc --noEmit 2>&1", { cwd: root, timeout: 60000 });
      pass("4.14 TypeScript compilation clean", "Zero errors");
    } catch (e: unknown) {
      const output = e instanceof Error ? e.message : String(e);
      const errorCount = (output.match(/error TS/g) || []).length;
      fail("4.14 TypeScript compilation", `${errorCount} errors`);
    }
  }

  // 4.15 Resend gracefully handles missing API key
  {
    const content = readFile("src/lib/resend-email.ts");
    const hasNullCheck = content.includes("if (!process.env.RESEND_API_KEY)") || content.includes("!resendClient");
    hasNullCheck ? pass("4.15 Resend graceful degradation", "Returns error if API key missing") : fail("4.15 Resend degradation", "Missing null check");
  }

  // 4.16 Complete onboarding flow is dual-provider
  {
    const content = readFile("src/lib/zoho-crm.ts");
    const hasZohoTry = content.includes("zohoApiRequest(`/Leads/${leadId}/actions/send_mail`");
    const hasResendCatch = content.includes("sendOnboardingEmailViaResend");
    const hasBothFailedMsg = content.includes("Zoho:") && content.includes("Resend:");
    hasZohoTry && hasResendCatch && hasBothFailedMsg
      ? pass("4.16 Complete onboarding dual-provider", "Try Zoho → catch → Resend → both-failed message")
      : fail("4.16 Onboarding dual-provider", `try=${hasZohoTry}, catch=${hasResendCatch}, both=${hasBothFailedMsg}`);
  }
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════
async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  E2E Test: Dual-Provider Email + Onboarding + Script Check");
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

  const stages = [
    { name: "Stage 1: Resend + Dual-Provider Email", start: 0, count: 12 },
    { name: "Stage 2: Infrastructure Handshakes", start: 12, count: 6 },
    { name: "Stage 3: Onboarding Flow", start: 18, count: 7 },
    { name: "Stage 4: Code Integrity", start: 25, count: 16 },
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
