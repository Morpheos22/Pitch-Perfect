import { NextResponse } from 'next/server';
import { checkAIServiceHealth, getZaiConfigStatus } from '@/lib/ai-service';
import { prisma } from '@/lib/db';
import { isStorageConfigured, getStorageBackend, isWorkDriveConfigured, isVercelBlobConfigured } from '@/lib/storage';

interface HealthChecks {
  api: { status: string; timestamp: string };
  database: { status: string; message: string; tables?: Record<string, boolean> };
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

// Tables to verify (mapped from Prisma @@map names)
const CRITICAL_TABLES = [
  'users',
  'subscriptions',
  'usage',
  'pitch_decks',
  'pitch_scripts',
  'pitch_videos',
  'full_pitch_sessions',
  'founder_sessions',
];

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

  // Check 2: Database connection AND table existence
  try {
    await prisma.$queryRaw`SELECT 1`;
    
    // Now verify critical tables actually exist
    const tableChecks: Record<string, boolean> = {};
    let allTablesExist = true;
    
    for (const table of CRITICAL_TABLES) {
      try {
        await prisma.$queryRawUnsafe(`SELECT to_regclass('${table}') IS NOT NULL AS exists`);
        const result = await prisma.$queryRawUnsafe(`SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = '${table}'
        ) as exists`);
        const rows = result as Array<{ exists: boolean }>;
        tableChecks[table] = rows[0]?.exists === true;
        if (!tableChecks[table]) allTablesExist = false;
      } catch (e) {
        tableChecks[table] = false;
        allTablesExist = false;
      }
    }
    
    checks.database = {
      status: allTablesExist ? 'ok' : 'unhealthy',
      message: allTablesExist 
        ? 'Database connected, all tables exist'
        : `Database connected but missing tables: ${Object.entries(tableChecks).filter(([,v]) => !v).map(([k]) => k).join(', ')}`,
      tables: tableChecks,
    };
  } catch (error) {
    checks.database = {
      status: 'unhealthy',
      message: `Database connection failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  // Check 3: Storage backend
  checks.storage = {
    status: isStorageConfigured() ? 'ok' : 'degraded',
    backend: getStorageBackend(),
    workdrive: isWorkDriveConfigured(),
    vercelBlob: isVercelBlobConfigured(),
  };

  // Check 4: Z.ai config status
  checks.ai.configStatus = getZaiConfigStatus();
  checks.ai.configFound = checks.ai.configStatus.configCreated;

  // Check 5: AI Service (Z.ai Gateway) - full test
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
      message: `AI service check failed: ${error instanceof Error ? error.message : String(error)}`,
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
    warnings.push('ZAI_API_KEY not configured. AI analysis will fail.');
  }

  if (checks.ai.configStatus.configCreated && !checks.ai.configStatus.hasToken) {
    warnings.push('ZAI_TOKEN not configured. Vision API (E3/E4) will fail.');
  }

  if (checks.storage.backend === 'mock') {
    warnings.push('No persistent storage configured (WorkDrive/Blob). File uploads will not persist.');
  }

  if (checks.database.status === 'unhealthy' && checks.database.message.includes('missing tables')) {
    warnings.push('CRITICAL: Database tables are missing! Run prisma db push against the production database.');
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
    vercelPlan: process.env.VERCEL_REGION || process.env.NODE_ENV || 'unknown',
  });
}
