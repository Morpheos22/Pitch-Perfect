// API Route: Health Check
// GET /api/health

import { NextResponse } from 'next/server';
import { checkAIServiceHealth } from '@/lib/ai-service';
import { prisma } from '@/lib/db';

export async function GET() {
  const checks = {
    api: { status: 'ok', timestamp: new Date().toISOString() },
    database: { status: 'unknown' as 'ok' | 'error' | 'unknown', message: '' },
    ai: { status: 'unknown' as 'ok' | 'error' | 'unknown', message: '' },
  };

  // Check database connection
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database.status = 'ok';
    checks.database.message = 'Database connection successful';
  } catch (error) {
    checks.database.status = 'error';
    checks.database.message = error instanceof Error ? error.message : 'Database connection failed';
  }

  // Check AI service
  try {
    const aiHealth = await checkAIServiceHealth();
    checks.ai.status = aiHealth.status;
    checks.ai.message = aiHealth.message;
  } catch (error) {
    checks.ai.status = 'error';
    checks.ai.message = error instanceof Error ? error.message : 'AI service check failed';
  }

  // Determine overall status
  const allOk = Object.values(checks).every(c => c.status === 'ok');
  const status = allOk ? 200 : 503;

  return NextResponse.json({
    status: allOk ? 'healthy' : 'degraded',
    checks,
    timestamp: new Date().toISOString(),
  }, { status });
}
