import { NextResponse } from 'next/server';
import { checkAIServiceHealth, getZaiConfigStatus } from '@/lib/ai-service';
import { prisma } from '@/lib/db';
import { isStorageConfigured, getStorageBackend, isWorkDriveConfigured, isVercelBlobConfigured } from '@/lib/storage';

interface HealthChecks {
  api: { status: string; timestamp: string };
  database: { status: string; message: string };
  storage: {
    status: string;
    backend: string;
    workdrive: boolean;
    vercelBlob: boolean;
  };
  ai: {
    status: string;
    message: string;
    configFound: boolean;
    configStatus: {
      configCreated: boolean;
      hasToken: boolean;
      hasApiKey: boolean;
      configSource: string;
    };
    gatewayRouting: { text: string; vision: string };
    zai: { status: string; message?: string };
    moduleCount: number;
  };
}

export async function GET() {
  const startTime = Date.now();

  const checks: HealthChecks = {
    api: { status: 'checking', timestamp: new Date().toISOString() },
    database: { status: 'checking', message: '' },
    storage: {
      status: 'checking',
      backend: 'none',
      workdrive: false,
      vercelBlob: false,
    },
    ai: {
      status: 'checking',
      message: '',
      configFound: false,
      configStatus: {
        configCreated: false,
        hasToken: false,
        hasApiKey: false,
        configSource: 'none',
      },
      gatewayRouting: { text: 'unknown', vision: 'unknown' },
      zai: { status: 'unknown' },
      moduleCount: 0,
    },
  };

  // Check 1: API is running
  checks.api = {
    status: 'ok',
    timestamp: new Date().toISOString(),
  };

  // Check 2: Database connection
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = {
      status: 'ok',
      message: 'Database connection successful',
    };
  } catch (error) {
    checks.database = {
      status: 'unhealthy',
      message: 'Database connection failed',
    };
  }

  // Check 3: Storage backend
  checks.storage = {
    status: isStorageConfigured() ? 'ok' : 'degraded',
    backend: getStorageBackend(),
    workdrive: isWorkDriveConfigured(),
    vercelBlob: isVercelBlobConfigured(),
  };

  // Check 4: Z.ai config status (before attempting AI call)
  checks.ai.configStatus = getZaiConfigStatus();
  checks.ai.configFound = checks.ai.configStatus.configCreated;

  // Check 4: AI Service (Z.ai Gateway)
  try {
    const aiHealth = await checkAIServiceHealth();
    checks.ai = {
      status: aiHealth.status,
      message: aiHealth.zai?.message || '',
      configFound: aiHealth.configFound || false,
      configStatus: aiHealth.configStatus,
      gatewayRouting: aiHealth.gatewayRouting,
      zai: aiHealth.zai || { status: 'unknown' },
      moduleCount: aiHealth.moduleMapping.length,
    };
  } catch (error) {
    checks.ai = {
      status: 'unhealthy',
      message: 'AI service check failed',
      configFound: false,
      configStatus: {
        configCreated: false,
        hasToken: false,
        hasApiKey: false,
        configSource: 'none',
      },
      gatewayRouting: { text: 'unknown', vision: 'unknown' },
      zai: { status: 'unknown', message: 'Health check failed' },
      moduleCount: 0,
    };
  }

  // Determine overall status
  const allHealthy = Object.values(checks).every(c => c.status === 'ok' || c.status === 'healthy');
  const anyUnhealthy = Object.values(checks).some(c => c.status === 'unhealthy');

  // Warnings collection
  const warnings: string[] = [];

  if (!checks.ai.configStatus.hasApiKey) {
    warnings.push('ZAI_API_KEY not configured. AI analysis will fail. Set it in Vercel env vars.');
  }

  if (checks.storage.backend === 'mock') {
    warnings.push('No persistent storage configured (WorkDrive/Blob). File uploads will not persist across serverless cold starts.');
  }

  const overallStatus = allHealthy
    ? 'healthy'
    : (anyUnhealthy ? 'unhealthy' : 'degraded');

  const responseTime = Date.now() - startTime;

  return NextResponse.json({
    status: overallStatus,
    warnings: warnings.length > 0 ? warnings : undefined,
    checks,
    timestamp: new Date().toISOString(),
    responseTime: `${responseTime}ms`,
  });
}
