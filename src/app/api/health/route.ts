import { NextRequest, NextResponse } from 'next/server';
import { checkAIServiceHealth, getZaiConfigStatus } from '@/lib/ai-service';
import { getVertexAIConfigStatus, isVertexAIConfigured } from '@/lib/vertex-ai';
import { prisma } from '@/lib/db';
import { isStorageConfigured, getStorageBackend, isWorkDriveConfigured, isVercelBlobConfigured } from '@/lib/storage';
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


  // Database check
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { status: 'ok' };
  } catch {
    checks.database = { status: 'unhealthy' };
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


  const warnings: string[] = [];
  if (!configStatus.hasApiKey && !configStatus.hasToken) warnings.push('AI API key/token not configured');
  if (!configStatus.hasUserId) warnings.push('AI User ID not configured');
  if (!isStorageConfigured()) warnings.push('No persistent storage configured');
  if (checks.database.status === 'unhealthy') warnings.push('Database connection issue');
  if (!checks.entitlement.devEmailsConfigured) warnings.push('Developer emails not recognized — dev accounts will be on FREE tier');
  if (checks.ai.visionStatus === 'unhealthy') warnings.push('Vision model endpoint unhealthy — E1/E3/E4 video analysis will fail');
  if (checks.ai.visionStatus === 'degraded') warnings.push('Vision model endpoint degraded — E1/E3/E4 may return poor results');


  // Vercel Blob check — verify BLOB_READ_WRITE_TOKEN is set for private blob reads
  const blobTokenSet = !!process.env.BLOB_READ_WRITE_TOKEN;
  if (!blobTokenSet) warnings.push('BLOB_READ_WRITE_TOKEN not set — private blob uploads will fail to be read back');
  (checks.storage as any).blobTokenConfigured = blobTokenSet;

  // Google AI / Vertex AI check — verify fallback provider config
  const vertexAIStatus = getVertexAIConfigStatus();
  (checks as any).googleAI = {
    configured: vertexAIStatus.configured,
    provider: vertexAIStatus.provider,
    project: vertexAIStatus.project,
    location: vertexAIStatus.location,
    hasApiKey: vertexAIStatus.hasApiKey,
  };
  if (!vertexAIStatus.configured) {
    warnings.push('Google AI / Vertex AI not configured — Z.ai fallback unavailable. Set GOOGLE_GENAI_API_KEY.');
  } else if (vertexAIStatus.provider === 'vertex-ai') {
    // Vertex AI requires billing — note this as a potential issue
    warnings.push('Vertex AI endpoint selected (GOOGLE_CLOUD_PROJECT set) — requires billing enabled. If billing is disabled, auto-fallback to AI Studio will be attempted.');
  }


  checks.status = allHealthy ? 'healthy' : 'degraded';
  if (checks.database.status === 'unhealthy' || checks.ai.status === 'unhealthy') {
    checks.status = 'unhealthy';
  }
  checks.warnings = warnings.length > 0 ? warnings : undefined;
  checks.responseTime = `${Date.now() - startTime}ms`;


  return NextResponse.json(checks);
}
