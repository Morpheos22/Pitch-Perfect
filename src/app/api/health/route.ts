import { NextResponse } from 'next/server';
import { checkAIServiceHealth, getZaiConfigStatus } from '@/lib/ai-service';
import { prisma } from '@/lib/db';
import { isStorageConfigured, getStorageBackend, isWorkDriveConfigured, isVercelBlobConfigured } from '@/lib/storage';

interface HealthChecks {
  api: { status: string; timestamp: string };
  database: { status: string; message: string; tables?: Record<string, boolean>; autoCreated?: string[] };
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

const CRITICAL_TABLES = [
  'users', 'subscriptions', 'usage', 'pitch_decks',
  'pitch_scripts', 'pitch_videos', 'full_pitch_sessions', 'founder_sessions',
];

const TABLE_DDL: Record<string, string> = {
  founder_sessions: `CREATE TABLE IF NOT EXISTS "founder_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL, "pitchDeckId" TEXT,
    "moduleType" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'PENDING',
    "inputData" JSONB, "resultData" JSONB, "overallScore" INTEGER,
    "recommendedPathway" TEXT, "audioBase64" TEXT, "modelUsed" TEXT, "tokensUsed" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "analyzedAt" TIMESTAMP(3)
  )`,
  webhook_logs: `CREATE TABLE IF NOT EXISTS "webhook_logs" (
    "id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT, "sessionId" TEXT, "sessionType" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT false, "crmSynced" BOOLEAN NOT NULL DEFAULT false,
    "emailSent" BOOLEAN NOT NULL DEFAULT false, "entitlementUpdated" BOOLEAN NOT NULL DEFAULT false,
    "externalWebhooksTriggered" BOOLEAN NOT NULL DEFAULT false,
    "errors" TEXT[] DEFAULT '{}', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  transactions: `CREATE TABLE IF NOT EXISTS "transactions" (
    "id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL, "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL, "currency" TEXT NOT NULL DEFAULT 'usd',
    "provider" TEXT NOT NULL DEFAULT 'PAYSTACK', "providerReference" TEXT,
    "providerAccessCode" TEXT, "creditsAdded" INTEGER NOT NULL DEFAULT 0,
    "moduleAccessId" TEXT UNIQUE, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  module_access: `CREATE TABLE IF NOT EXISTS "module_access" (
    "id" TEXT NOT NULL PRIMARY KEY, "transactionId" TEXT NOT NULL UNIQUE,
    "e1Access" BOOLEAN NOT NULL DEFAULT false, "e2Access" BOOLEAN NOT NULL DEFAULT false,
    "e3Access" BOOLEAN NOT NULL DEFAULT false, "e4Access" BOOLEAN NOT NULL DEFAULT false,
    "e1Limit" INTEGER, "e2Limit" INTEGER, "e3Limit" INTEGER, "e4Limit" INTEGER,
    "e1Used" INTEGER NOT NULL DEFAULT 0, "e2Used" INTEGER NOT NULL DEFAULT 0,
    "e3Used" INTEGER NOT NULL DEFAULT 0, "e4Used" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  zoho_sync_logs: `CREATE TABLE IF NOT EXISTS "zoho_sync_logs" (
    "id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT, "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL, "action" TEXT NOT NULL, "status" TEXT NOT NULL,
    "requestData" JSONB, "responseData" JSONB, "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
};

async function checkAndCreateTables() {
  const tableChecks: Record<string, boolean> = {};
  const missing: string[] = [];

  for (const table of CRITICAL_TABLES) {
    try {
      const result = await prisma.$queryRawUnsafe(
        `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '${table}') as exists`
      );
      const rows = result as Array<{ exists: boolean }>;
      tableChecks[table] = rows[0]?.exists === true;
      if (!tableChecks[table]) missing.push(table);
    } catch {
      tableChecks[table] = false;
      missing.push(table);
    }
  }

  // Auto-create any missing tables
  const autoCreated: string[] = [];
  for (const table of missing) {
    const ddl = TABLE_DDL[table];
    if (!ddl) continue;
    try {
      await prisma.$executeRawUnsafe(ddl);
      tableChecks[table] = true;
      autoCreated.push(table);
      console.log(`[Health] Auto-created table: ${table}`);
    } catch (err: any) {
      console.error(`[Health] Failed to create ${table}:`, err?.message || err);
    }
  }

  const stillMissing = Object.entries(tableChecks).filter(([, v]) => !v).map(([k]) => k);
  return { tableChecks, stillMissing, autoCreated };
}

export async function GET() {
  const startTime = Date.now();

  const checks: HealthChecks = {
    api: { status: 'ok', timestamp: new Date().toISOString() },
    database: { status: 'checking', message: '' },
    storage: { status: 'checking', backend: 'none', workdrive: false, vercelBlob: false },
    ai: {
      status: 'checking', message: '', configFound: false,
      configStatus: { configCreated: false, hasToken: false, hasApiKey: false, configSource: 'none' },
      gatewayRouting: { text: 'unknown', vision: 'unknown' },
      zai: { status: 'unknown' }, moduleCount: 0,
    },
  };

  // Check 2: Database + tables
  try {
    await prisma.$queryRaw`SELECT 1`;
    const { tableChecks, stillMissing, autoCreated } = await checkAndCreateTables();
    checks.database = {
      status: stillMissing.length === 0 ? 'ok' : 'unhealthy',
      message: stillMissing.length === 0
        ? 'Database connected, all tables exist'
        : `Missing tables: ${stillMissing.join(', ')}`,
      tables: tableChecks,
      autoCreated: autoCreated.length > 0 ? autoCreated : undefined,
    };
  } catch (error) {
    checks.database = {
      status: 'unhealthy',
      message: `Database connection failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  // Check 3: Storage
  checks.storage = {
    status: isStorageConfigured() ? 'ok' : 'degraded',
    backend: getStorageBackend(),
    workdrive: isWorkDriveConfigured(),
    vercelBlob: isVercelBlobConfigured(),
  };

  // Check 4: AI config
  checks.ai.configStatus = getZaiConfigStatus();
  checks.ai.configFound = checks.ai.configStatus.configCreated;

  // Check 5: AI health
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
      message: `AI check failed: ${error instanceof Error ? error.message : String(error)}`,
      configFound: false,
      configStatus: { configCreated: false, hasToken: false, hasApiKey: false, configSource: 'none' },
      gatewayRouting: { text: 'unknown', vision: 'unknown' },
      zai: { status: 'unknown', message: 'Health check failed' },
      moduleCount: 0,
    };
  }

  const allHealthy = Object.values(checks).every(c => c.status === 'ok' || c.status === 'healthy');
  const anyUnhealthy = Object.values(checks).some(c => c.status === 'unhealthy');

  const warnings: string[] = [];
  if (!checks.ai.configStatus.hasApiKey) warnings.push('ZAI_API_KEY not configured');
  if (checks.ai.configCreated && !checks.ai.configStatus.hasToken) warnings.push('ZAI_TOKEN not configured — Vision API (E3/E4) may fail');
  if (checks.storage.backend === 'mock') warnings.push('No persistent storage (WorkDrive/Blob). Uploads will not persist.');
  if (checks.database.status === 'unhealthy' && checks.database.message.includes('Missing')) {
    warnings.push('CRITICAL: Missing database tables. Auto-migration was attempted.');
  }

  return NextResponse.json({
    status: allHealthy ? 'healthy' : (anyUnhealthy ? 'unhealthy' : 'degraded'),
    warnings: warnings.length > 0 ? warnings : undefined,
    checks,
    timestamp: new Date().toISOString(),
    responseTime: `${Date.now() - startTime}ms`,
    vercelPlan: process.env.VERCEL_REGION || process.env.NODE_ENV || 'unknown',
  });
}
