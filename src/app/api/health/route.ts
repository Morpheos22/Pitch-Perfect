import { NextRequest, NextResponse } from 'next/server';
import { checkAIServiceHealth, getZaiConfigStatus } from '@/lib/ai-service';
import { prisma } from '@/lib/db';
import { isStorageConfigured, getStorageBackend, isWorkDriveConfigured, isVercelBlobConfigured } from '@/lib/storage';

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

  // Full health check — less sensitive data, no internal details
  const startTime = Date.now();

  interface FullHealthResponse {
    status: string;
    database: { status: string };
    storage: { status: string; backend: string };
    ai: { status: string; configFound: boolean };
    warnings?: string[];
    responseTime: string;
    timestamp: string;
  }

  const checks: FullHealthResponse = {
    status: 'checking',
    database: { status: 'checking' },
    storage: { status: 'checking', backend: 'none' },
    ai: { status: 'checking', configFound: false },
    responseTime: '',
    timestamp: new Date().toISOString(),
  };

  // Database check — safe tagged template literal
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

  // AI config check
  const configStatus = getZaiConfigStatus();
  checks.ai = {
    status: 'checking',
    configFound: configStatus.configCreated,
  };

  // AI health check
  try {
    const aiHealth = await checkAIServiceHealth();
    checks.ai = {
      status: aiHealth.status,
      configFound: aiHealth.configFound || false,
    };
  } catch {
    checks.ai = {
      status: 'unhealthy',
      configFound: false,
    };
  }

  const allHealthy = checks.database.status === 'ok' && checks.ai.status === 'ok';

  const warnings: string[] = [];
  if (!configStatus.hasApiKey) warnings.push('AI API key not configured');
  if (!isStorageConfigured()) warnings.push('No persistent storage configured');
  if (checks.database.status === 'unhealthy') warnings.push('Database connection issue');

  checks.status = allHealthy ? 'healthy' : 'degraded';
  if (checks.database.status === 'unhealthy' || checks.ai.status === 'unhealthy') {
    checks.status = 'unhealthy';
  }
  checks.warnings = warnings.length > 0 ? warnings : undefined;
  checks.responseTime = `${Date.now() - startTime}ms`;

  return NextResponse.json(checks);
}
