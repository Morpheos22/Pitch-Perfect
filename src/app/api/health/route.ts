import { NextRequest, NextResponse } from 'next/server';
import { checkAIServiceHealth, getZaiConfigStatus } from '@/lib/ai-service';
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
    configFound: configStatus.hasApiKey || configStatus.configured,
    configSource: configStatus.provider,
    baseUrl: configStatus.models.join(", "),
  };


  // AI health check — test actual gateway connectivity (text + vision)
  try {
    const aiHealth = await checkAIServiceHealth();
    checks.ai = {
      status: aiHealth.status,
      configFound: aiHealth.configFound || configStatus.hasApiKey || configStatus.configured,
      configSource: configStatus.provider,
      baseUrl: configStatus.models.join(", "),
      textModel: aiHealth.gatewayRouting?.text,
      visionModel: aiHealth.gatewayRouting?.vision,
      visionStatus: aiHealth.vision?.status,
      visionMessage: aiHealth.vision?.message,
    };
  } catch {
    checks.ai = {
      status: 'unhealthy',
      configFound: configStatus.hasApiKey || configStatus.configured,
      configSource: configStatus.provider,
      baseUrl: configStatus.models.join(", "),
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


  if (!configStatus.hasApiKey && !configStatus.configured) warnings.push('AI API key/token not configured');
  if (!configStatus.configured) warnings.push('AI User ID not configured');
  if (!isStorageConfigured()) warnings.push('No persistent storage configured');
  if (checks.database.status === 'unhealthy') warnings.push('Database connection issue');
  if (!checks.entitlement.devEmailsConfigured) warnings.push('Developer emails not recognized — dev accounts will be on FREE tier');
  if (checks.ai.visionStatus === 'unhealthy') warnings.push('Vision model endpoint unhealthy — E1/E3/E4 video analysis will fail');
  if (checks.ai.visionStatus === 'degraded') warnings.push('Vision model endpoint degraded — E1/E3/E4 may return poor results');


  // Cloudflare R2 check — verify R2 credentials are set and bucket is reachable.
  // The legacy Vercel Blob check was removed; R2 is the sole storage backend.
  let r2Configured = false;
  let r2Error: string | undefined;
  try {
    const { isR2Configured } = await import("@/lib/cloudflare-storage");
    r2Configured = isR2Configured();
  } catch (err: unknown) {
    r2Error = err instanceof Error ? err.message : String(err);
  }

  if (!r2Configured) {
    warnings.push(`Cloudflare R2 not configured — file uploads will fail: ${r2Error || 'set CLOUDFLARE_R2_* env vars'}`);
  }

  (checks.storage as any).r2Configured = r2Configured;
  (checks.storage as any).r2Error = r2Error;
  // Legacy BLOB_READ_WRITE_TOKEN is no longer checked — Vercel Blob is removed.

  // Kal Agent (Strategy 2 fallback) — env-var presence check only.
  // The full Kal Middleware client was removed; the live Kal Agent is invoked
  // directly from src/lib/ai-service.ts:analyzeWithKalAgent() using KAL_AGENT_URL.
  const kalAgentUrl = process.env.KAL_AGENT_URL || '';
  const kalApiKey = process.env.KAL_API_KEY || '';
  (checks as any).kal = {
    status: kalAgentUrl && kalApiKey ? 'ok' : 'unhealthy',
    mode: kalAgentUrl ? 'agent' : 'not_configured',
    activeUrl: kalAgentUrl || null,
    agentConfigured: !!kalAgentUrl,
    agentHasApiKey: !!kalApiKey,
    role: 'strategy2-fallback',
  };
  if (!kalAgentUrl || !kalApiKey) {
    warnings.push('Kal Agent (Strategy 2 fallback) not configured — set KAL_AGENT_URL and KAL_API_KEY for E2 fallback.');
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
