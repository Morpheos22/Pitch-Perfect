// Post-Session Webhook Service for Pitch Perfect
// Triggers after every completed session for CRM sync, email delivery, and n8n automation

import { syncSessionToCRM, updateEntitlementUsage, getEntitlement } from './zoho-crm';
import { sendSessionCompleteEmail } from './zoho-mail';
import { generateDeckReport, generateScriptReport, generateVideoReport, generateFullPitchReport } from './pdf-report';
import { prisma } from './db';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface SessionWebhookPayload {
  sessionId: string;
  sessionType: 'deck' | 'script' | 'live' | 'full';
  userId: string;
  userEmail: string;
  userName: string;
  productId: string;
  moduleId: string;
  score: number;
  duration?: number;
  completedAt: Date;
  // Report data depends on session type
  reportData: Record<string, unknown>;
}

export interface WebhookResponse {
  success: boolean;
  crmSynced: boolean;
  emailSent: boolean;
  entitlementUpdated: boolean;
  externalWebhooksTriggered: boolean;
  errors: string[];
}

// ============================================
// EXTERNAL WEBHOOK CONFIGURATION
// ============================================

const EXTERNAL_WEBHOOKS = {
  // n8n webhook URL (configurable)
  n8n: process.env.N8N_WEBHOOK_URL,
  // Optional: Zapier, Make, etc.
  secondary: process.env.SECONDARY_WEBHOOK_URL,
};

// ============================================
// MAIN WEBHOOK HANDLER
// ============================================

export async function triggerPostSessionWebhooks(
  payload: SessionWebhookPayload
): Promise<WebhookResponse> {
  const result: WebhookResponse = {
    success: true,
    crmSynced: false,
    emailSent: false,
    entitlementUpdated: false,
    externalWebhooksTriggered: false,
    errors: [],
  };

  // Run all webhooks in parallel for speed
  const [crmResult, emailResult, entitlementResult, externalResult] = await Promise.allSettled([
    syncToCRM(payload),
    sendEmailWithPDF(payload),
    updateEntitlement(payload),
    triggerExternalWebhooks(payload),
  ]);

  // Process results
  if (crmResult.status === 'fulfilled') {
    result.crmSynced = crmResult.value;
  } else {
    result.errors.push(`CRM sync failed: ${crmResult.reason}`);
  }

  if (emailResult.status === 'fulfilled') {
    result.emailSent = emailResult.value;
  } else {
    result.errors.push(`Email failed: ${emailResult.reason}`);
  }

  if (entitlementResult.status === 'fulfilled') {
    result.entitlementUpdated = entitlementResult.value;
  } else {
    result.errors.push(`Entitlement update failed: ${entitlementResult.reason}`);
  }

  if (externalResult.status === 'fulfilled') {
    result.externalWebhooksTriggered = externalResult.value;
  } else {
    result.errors.push(`External webhooks failed: ${externalResult.reason}`);
  }

  // Mark success if at least CRM and email succeeded
  result.success = result.crmSynced || result.emailSent;

  // Log the webhook execution
  await logWebhookExecution(payload, result);

  return result;
}

// ============================================
// CRM SYNC
// ============================================

async function syncToCRM(payload: SessionWebhookPayload): Promise<boolean> {
  try {
    await syncSessionToCRM({
      userId: payload.userId,
      email: payload.userEmail,
      sessionId: payload.sessionId,
      sessionType: payload.sessionType,
      productModule: payload.moduleId,
      score: payload.score,
      duration: payload.duration,
    });
    return true;
  } catch (error) {
    console.error('CRM sync error:', error);
    return false;
  }
}

// ============================================
// EMAIL WITH PDF
// ============================================

async function sendEmailWithPDF(payload: SessionWebhookPayload): Promise<boolean> {
  try {
    // Generate PDF based on session type
    let pdfBuffer: Buffer | undefined;
    
    switch (payload.sessionType) {
      case 'deck':
        pdfBuffer = generateDeckReport(payload.reportData as Parameters<typeof generateDeckReport>[0]);
        break;
      case 'script':
        pdfBuffer = generateScriptReport(payload.reportData as Parameters<typeof generateScriptReport>[0]);
        break;
      case 'live':
        pdfBuffer = generateVideoReport(payload.reportData as Parameters<typeof generateVideoReport>[0]);
        break;
      case 'full':
        pdfBuffer = generateFullPitchReport(payload.reportData as Parameters<typeof generateFullPitchReport>[0]);
        break;
    }

    // Extract strengths and recommendations from report data
    const reportData = payload.reportData as Record<string, string[] | number | string>;
    const strengths = (reportData.strengths as string[]) || [];
    const recommendations = (reportData.recommendations as string[]) || [];

    await sendSessionCompleteEmail({
      to: payload.userEmail,
      firstName: payload.userName.split(' ')[0] || 'there',
      sessionType: getSessionTypeLabel(payload.sessionType),
      overallScore: payload.score,
      strengths,
      recommendations,
      viewReportUrl: `${process.env.NEXT_PUBLIC_APP_URL}/history/${payload.sessionId}`,
      pdfBuffer,
      sessionName: payload.productId,
    });

    return true;
  } catch (error) {
    console.error('Email send error:', error);
    return false;
  }
}

// ============================================
// ENTITLEMENT UPDATE
// ============================================

async function updateEntitlement(payload: SessionWebhookPayload): Promise<boolean> {
  try {
    // Get entitlement from CRM
    const entitlement = await getEntitlement(payload.userId, payload.productId);
    
    if (entitlement) {
      // Update in CRM
      await updateEntitlementUsage(entitlement.userId, payload.moduleId, 1);
    }

    // Also update local database
    const moduleMap: Record<string, string> = {
      deck: 'e1DeckAnalyses',
      script: 'e2ScriptCoachSessions',
      live: 'e3LivePitchSessions',
      full: 'e4FullPitchSessions',
    };

    const field = moduleMap[payload.sessionType];
    if (field) {
      await prisma.usage.update({
        where: { userId: payload.userId },
        data: {
          [field]: { increment: 1 },
          updatedAt: new Date(),
        },
      });
    }

    return true;
  } catch (error) {
    console.error('Entitlement update error:', error);
    return false;
  }
}

// ============================================
// EXTERNAL WEBHOOKS (n8n ready)
// ============================================

async function triggerExternalWebhooks(payload: SessionWebhookPayload): Promise<boolean> {
  const webhookUrls = [
    EXTERNAL_WEBHOOKS.n8n,
    EXTERNAL_WEBHOOKS.secondary,
  ].filter(Boolean);

  if (webhookUrls.length === 0) {
    return false;
  }

  const webhookPayload = {
    event: 'session.completed',
    timestamp: new Date().toISOString(),
    data: {
      sessionId: payload.sessionId,
      sessionType: payload.sessionType,
      userId: payload.userId,
      userEmail: payload.userEmail,
      userName: payload.userName,
      productId: payload.productId,
      moduleId: payload.moduleId,
      score: payload.score,
      duration: payload.duration,
      completedAt: payload.completedAt.toISOString(),
    },
  };

  const results = await Promise.allSettled(
    webhookUrls.map(url =>
      fetch(url!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-PitchPerfect-Signature': generateWebhookSignature(webhookPayload),
        },
        body: JSON.stringify(webhookPayload),
      })
    )
  );

  return results.some(r => r.status === 'fulfilled');
}

// ============================================
// WEBHOOK SIGNATURE
// ============================================

function generateWebhookSignature(payload: unknown): string {
  const { createHmac } = require('crypto');
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) {
    throw new Error('WEBHOOK_SECRET environment variable is not set. Webhook signatures cannot be generated.');
  }
  return createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
}

// ============================================
// LOGGING
// ============================================

async function logWebhookExecution(
  payload: SessionWebhookPayload,
  result: WebhookResponse
): Promise<void> {
  try {
    // Log to database
    await prisma.webhookLog.create({
      data: {
        sessionId: payload.sessionId,
        sessionType: payload.sessionType,
        userId: payload.userId,
        success: result.success,
        crmSynced: result.crmSynced,
        emailSent: result.emailSent,
        entitlementUpdated: result.entitlementUpdated,
        externalWebhooksTriggered: result.externalWebhooksTriggered,
        errors: result.errors,
        createdAt: new Date(),
      },
    });
  } catch (error) {
    // Log to console if DB write fails
    console.error('Webhook log error:', error);
    console.log('Webhook execution:', JSON.stringify({ payload, result }));
  }
}

// ============================================
// HELPERS
// ============================================

function getSessionTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    deck: 'Pitch Deck Analysis',
    script: 'Script Coaching',
    live: 'Live Pitch Recording',
    full: 'Full Pitch Session',
  };
  return labels[type] || 'Session';
}

// ============================================
// MANUAL TRIGGER (for testing)
// ============================================

export async function manuallyTriggerWebhooks(sessionId: string): Promise<WebhookResponse | null> {
  // Fetch session data from database
  // This is a placeholder - implement based on your session schema
  const session = await prisma.pitchDeck.findUnique({
    where: { id: sessionId },
    include: { user: true },
  });

  if (!session) {
    return null;
  }

  return triggerPostSessionWebhooks({
    sessionId: session.id,
    sessionType: 'deck',
    userId: session.userId,
    userEmail: session.user?.email || '',
    userName: `${session.user?.firstName || ''} ${session.user?.lastName || ''}`.trim(),
    productId: 'pitch-deck',
    moduleId: 'm1',
    score: session.overallScore || 0,
    completedAt: session.analyzedAt || new Date(),
    reportData: {
      problemClarityScore: session.problemClarityScore,
      solutionClarityScore: session.solutionClarityScore,
      marketOpportunityScore: session.marketOpportunityScore,
      businessModelScore: session.businessModelScore,
      teamCredibilityScore: session.teamCredibilityScore,
      tractionScore: session.tractionScore,
      financialsScore: session.financialsScore,
      askClarityScore: session.askClarityScore,
      overallScore: session.overallScore,
      strengths: session.strengths || [],
      weaknesses: session.weaknesses || [],
      recommendations: session.recommendations || [],
    },
  });
}
