import { NextRequest, NextResponse } from 'next/server';
import { checkAIServiceHealth, getZaiConfigStatus } from '@/lib/ai-service';
import { isKalMiddlewareReady, getKalBackendInfo } from '@/lib/kal-middleware-client';
import { prisma } from '@/lib/db';
import { isStorageConfigured, getStorageBackend, isVercelBlobConfigured } from '@/lib/storage';
// isAdminEmail removed — not used in this route
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const full = searchParams.get('full') === 'true';


  // Minimal public health check
  if (!full) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return NextResponse.json({ status: "ok" });
    } catch {
      return NextResponse.json({ status: "error" }, { status: 503 });
    }
  }


  // Protect full health check — require internal access
  const fullToken = request.headers.get('x-health-token');
  if (fullToken !== process.env.HEALTH_CHECK_SECRET) {
    return NextResponse.json({ status: 'ok', message: 'Full check requires authentication' });
  }


  // Full health check — includes diagnostic details
  const startTime = Date.now();

  const warnings: string[] = [];


  interface FullHealthResponse {
    status: string;
    database: { status: string };
    storage: { status: string; backend: string };
    ai: { status: string; configFound: boolean; configSource?: string; baseUrl?: string; textModel?: string; visionModel?: string; visionStatus?: string; visionMessage?: string };
    entitlement: { devEmailsConfigured: boolean };
    warnings?: string[];
    responseTime: string;
    timestamp: string;
  }


  const checks: FullHealthResponse = {
    status: 'checking',
    database: { status: 'checking' },
    storage: { status: 'checking', backend: 'none' },
    ai: { status: 'checking', configFound: false },
    entitlement: { devEmailsConfigured: false },
    responseTime: '',
    timestamp: new Date().toISOString(),
  };


  // Database check — Supabase PostgreSQL via Prisma
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { status: 'ok' };
  } catch {
    checks.database = { status: 'unhealthy' };
  }

  // Supabase REST API check — verify Supabase project is reachable
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  let supabaseRestOk = false;
  let supabaseRestLatency = 0;
  let supabaseRestError: string | undefined;

  if (supabaseUrl) {
    const supaStart = Date.now();
    try {
      const resp = await fetch(`${supabaseUrl}/rest/v1/?apikey=${supabaseAnonKey}`, {
        method: 'GET',
        headers: supabaseAnonKey ? { apikey: supabaseAnonKey } : {},
        signal: AbortSignal.timeout(5_000),
      });
      supabaseRestLatency = Date.now() - supaStart;
      // 200 or 401 both prove Supabase is reachable; 401 just means no table at root
      supabaseRestOk = resp.ok || resp.status === 401 || resp.status === 404;
      if (!supabaseRestOk) {
        supabaseRestError = `HTTP ${resp.status}`;
      }
    } catch (err: unknown) {
      supabaseRestLatency = Date.now() - supaStart;
      supabaseRestError = err instanceof Error ? err.message : String(err);
    }
  }

  (checks as any).supabase = {
    status: supabaseUrl
      ? (supabaseRestOk ? 'ok' : (checks.database.status === 'ok' ? 'degraded' : 'unhealthy'))
      : 'not_configured',
    url: supabaseUrl || undefined,
    restApiReachable: supabaseRestOk || undefined,
    restApiLatencyMs: supabaseRestLatency || undefined,
    hasAnonKey: !!supabaseAnonKey,
    hasServiceRoleKey: !!supabaseServiceKey,
    dbUrl: checks.database.status === 'ok' ? 'connected' : 'disconnected',
    error: supabaseRestError,
  };
  if (!supabaseUrl) {
    warnings.push('NEXT_PUBLIC_SUPABASE_URL not set — Supabase REST API handshake unavailable');
  } else if (!supabaseRestOk && checks.database.status === 'ok') {
    warnings.push('Supabase REST API unreachable but DB connection works — REST handshake degraded');
  } else if (!supabaseRestOk) {
    warnings.push('Supabase unreachable — both REST API and DB connection failed');
  }


  // Storage check
  checks.storage = {
    status: isStorageConfigured() ? 'ok' : 'degraded',
    backend: getStorageBackend(),
  };


  // AI config check — use resolved config (env vars + file)
  const configStatus = getZaiConfigStatus();
  checks.ai = {
    status: 'checking',
    configFound: configStatus.hasApiKey || configStatus.hasToken,
    configSource: configStatus.configSource,
    baseUrl: configStatus.baseUrl,
  };


  // AI health check — test actual gateway connectivity (text + vision)
  try {
    const aiHealth = await checkAIServiceHealth();
    checks.ai = {
      status: aiHealth.status,
      configFound: aiHealth.configFound || configStatus.hasApiKey || configStatus.hasToken,
      configSource: configStatus.configSource,
      baseUrl: configStatus.baseUrl,
      textModel: aiHealth.gatewayRouting?.text,
      visionModel: aiHealth.gatewayRouting?.vision,
      visionStatus: aiHealth.vision?.status,
      visionMessage: aiHealth.vision?.message,
    };
  } catch {
    checks.ai = {
      status: 'unhealthy',
      configFound: configStatus.hasApiKey || configStatus.hasToken,
      configSource: configStatus.configSource,
      baseUrl: configStatus.baseUrl,
      visionStatus: 'unhealthy',
      visionMessage: 'AI health check failed — could not reach gateway',
    };
  }


  // Entitlement check — verify dev email system is working (without leaking specific emails)
  checks.entitlement = {
    // Direct env check — no need to import dev-auth just to verify the var exists.
    // This avoids the CJS require() interop issue and removes a dead import path
    // (dev-auth has no default export, so the old require was partially broken).
    devEmailsConfigured: !!(process.env.DEVELOPER_EMAILS && process.env.DEVELOPER_EMAILS.trim().length > 0),
  };


  const allHealthy = checks.database.status === 'ok' && checks.ai.status === 'ok';


  if (!configStatus.hasApiKey && !configStatus.hasToken) warnings.push('AI API key/token not configured');
  if (!configStatus.hasUserId) warnings.push('AI User ID not configured');
  if (!isStorageConfigured()) warnings.push('No persistent storage configured');
  if (checks.database.status === 'unhealthy') warnings.push('Database connection issue');
  if (!checks.entitlement.devEmailsConfigured) warnings.push('Developer emails not recognized — dev accounts will be on FREE tier');
  if (checks.ai.visionStatus === 'unhealthy') warnings.push('Vision model endpoint unhealthy — E1/E3/E4 video analysis will fail');
  if (checks.ai.visionStatus === 'degraded') warnings.push('Vision model endpoint degraded — E1/E3/E4 may return poor results');


  // Vercel Blob check — verify BLOB_READ_WRITE_TOKEN is set and blob store is reachable
  const blobTokenSet = !!process.env.BLOB_READ_WRITE_TOKEN;
  const blobTokenPrefix = process.env.BLOB_READ_WRITE_TOKEN?.substring(0, 10) || 'MISSING';
  let blobStoreReachable = false;
  let blobStoreError: string | undefined;

  if (blobTokenSet) {
    // Test blob store connectivity by listing blobs (0 results, just checks auth)
    try {
      const { list } = await import('@vercel/blob');
      await list({ limit: 1, token: process.env.BLOB_READ_WRITE_TOKEN });
      blobStoreReachable = true;
    } catch (err: unknown) {
      blobStoreError = err instanceof Error ? err.message : String(err);
    }
  }

  if (!blobTokenSet) warnings.push('BLOB_READ_WRITE_TOKEN not set — blob uploads will fail');
  if (blobTokenSet && !blobStoreReachable) warnings.push(`BLOB_READ_WRITE_TOKEN is set (${blobTokenPrefix}...) but blob store is unreachable: ${blobStoreError || 'unknown error'}`);

  (checks.storage as any).blobTokenConfigured = blobTokenSet;
  (checks.storage as any).blobTokenPrefix = blobTokenPrefix;
  (checks.storage as any).blobStoreReachable = blobStoreReachable;
  (checks.storage as any).blobStoreError = blobStoreError;

  // Kal Agent / Middleware check — Strategy 2 fallback for E2 Script Check
  // Kal Agent is the sole fallback (Strategy 2) when Z.ai fails.
  // Google AI / Vertex AI has been removed from the fallback chain.
  const kalBackendInfo = getKalBackendInfo();
  // Kal health check with extended timeout for Vercel cold starts
  // The default 5s timeout was too short — Kal Agent may need more time
  // from Vercel serverless. We still use isKalMiddlewareReady() but with
  // awareness that timeout from Vercel ≠ timeout from direct access.
  const kalHealth = await isKalMiddlewareReady();
  (checks as any).kal = {
    status: kalHealth.ready ? 'ok' : 'unhealthy',
    mode: kalHealth.mode,
    activeUrl: kalBackendInfo.activeUrl,
    agentConfigured: kalBackendInfo.agentConfigured,
    agentHasApiKey: kalBackendInfo.agentHasApiKey,
    middlewareConfigured: kalBackendInfo.middlewareConfigured,
    latencyMs: kalHealth.latencyMs,
    bridgeStatus: kalHealth.bridgeStatus,
    error: kalHealth.error,
    role: 'strategy2-fallback', // Kal Agent is now Strategy 2 for E2 analysis
  };
  if (!kalHealth.ready) {
    warnings.push(`Kal Agent (Strategy 2 fallback) unreachable from this environment — latency: ${kalHealth.latencyMs}ms, error: ${kalHealth.error || 'unknown'}. Script analysis will fall back to Kal Protocol chat.`);
  } else if (kalHealth.mode === 'middleware') {
    warnings.push('Kal Agent not configured (KAL_AGENT_URL not set) — using legacy middleware. Set KAL_AGENT_URL and KAL_API_KEY for authenticated access.');
  }

  // Google AI / Vertex AI — REMOVED from fallback chain.
  // The Gemini API is 403 SERVICE_DISABLED on our GCP project.
  // Z.ai (glm-4-plus) is primary, Kal Agent is the sole fallback.
  // No longer importing vertex-ai to avoid dead dependency in health check.
  (checks as any).googleAI = {
    configured: false,
    role: 'removed-from-chain',
    reason: 'Gemini API 403 SERVICE_DISABLED — removed from fallback chain',
  };


  checks.status = allHealthy ? 'healthy' : 'degraded';
  if (checks.database.status === 'unhealthy' || checks.ai.status === 'unhealthy') {
    checks.status = 'unhealthy';
  }
  checks.warnings = warnings.length > 0 ? warnings : undefined;
  checks.responseTime = `${Date.now() - startTime}ms`;


  return NextResponse.json(checks);
}
