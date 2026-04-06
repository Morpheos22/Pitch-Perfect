import { NextResponse } from 'next/server';
import { checkAIServiceHealth } from '@/lib/ai-service';
import { prisma } from '@/lib/db';

interface HealthChecks {
  api: { status: string; timestamp: string };
  database: { status: string; message: string };
  ai: {
    status: string;
    message: string;
    configFound: boolean;
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
    ai: {
      status: 'checking',
      message: '',
      configFound: false,
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
    checks.database = {
      status: 'unhealthy',
      message: `Database connection failed: ${errorMessage}`,
    };
  }

  // Check 3: AI Service (Z.ai Gateway)
  try {
    const aiHealth = await checkAIServiceHealth();
    checks.ai = {
      status: aiHealth.status,
      message: aiHealth.zai?.message || '',
      configFound: aiHealth.configFound || false,
      gatewayRouting: aiHealth.gatewayRouting,
      zai: aiHealth.zai || { status: 'unknown' },
      moduleCount: aiHealth.moduleMapping.length,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown AI error';
    checks.ai = {
      status: 'unhealthy',
      message: errorMessage,
      configFound: false,
      gatewayRouting: { text: 'unknown', vision: 'unknown' },
      zai: { status: 'unknown', message: 'Health check failed' },
      moduleCount: 0,
    };
  }

  // Determine overall status
  const allHealthy = Object.values(checks).every(c => c.status === 'ok' || c.status === 'healthy');
  const anyUnhealthy = Object.values(checks).some(c => c.status === 'unhealthy');

  const overallStatus = allHealthy ? 'healthy' : (anyUnhealthy ? 'unhealthy' : 'degraded');

  const responseTime = Date.now() - startTime;

  return NextResponse.json({
    status: overallStatus,
    checks,
    timestamp: new Date().toISOString(),
    responseTime: `${responseTime}ms`,
  });
}
