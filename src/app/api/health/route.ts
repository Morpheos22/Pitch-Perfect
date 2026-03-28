import { NextResponse } from 'next/server';
import { checkAIServiceHealth } from '@/lib/ai-service';
import { prisma } from '@/lib/db';

export async function GET() {
  const startTime = Date.now();
  
  const checks = {
    api: { status: string; timestamp: string };
    database: { status: string; message: string };
    ai: { 
      status: string; 
      message: string; 
      configFound: boolean; 
      glm: { status: string; message?: string };
    };
  } = {
    api: { status: 'checking', timestamp: new Date().toISOString() },
    database: { status: 'checking', message: '' },
    ai: { 
      status: 'checking', 
      message: '', 
      configFound: false, 
      glm: { status: 'unknown' },
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

  // Check 3: AI Service (GLM only)
  try {
    const aiHealth = await checkAIServiceHealth();
    checks.ai = {
      status: aiHealth.status,
      message: aiHealth.message || '',
      configFound: aiHealth.configFound || false,
      glm: aiHealth.glm || { status: 'unknown' },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown AI error';
    checks.ai = {
      status: 'unhealthy',
      message: errorMessage,
      configFound: false,
      glm: { status: 'unknown', message: 'Health check failed' },
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
