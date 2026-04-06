// Post-Session Webhook Service for Pitch Perfect
// Triggers after every completed session for CRM sync, email delivery, and n8n automation

import { syncSessionToCRM, updateEntitlementUsage, getEntitlement } from './zoho-crm';
import { sendSessionCompleteEmail } from './zoho-mail';
import { generateDeckReport, generateScriptReport, generateVideoReport, generateFullPitchReport } from './pdf-report';
import { prisma } from './db';
import { createHmac } from 'crypto';

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
  // Try to find the session across all session types
  const deck = await prisma.pitchDeck.findUnique({
    where: { id: sessionId },
    include: { user: true },
  });

  if (deck) {
    return triggerPostSessionWebhooks({
      sessionId: deck.id,
      sessionType: 'deck',
      userId: deck.userId,
      userEmail: deck.user?.email || '',
      userName: `${deck.user?.firstName || ''} ${deck.user?.lastName || ''}`.trim(),
      productId: 'pitch-deck',
      moduleId: 'm1',
      score: deck.overallScore || 0,
      completedAt: deck.analyzedAt || new Date(),
      reportData: {
        problemClarityScore: deck.problemClarityScore,
        solutionClarityScore: deck.solutionClarityScore,
        marketOpportunityScore: deck.marketOpportunityScore,
        businessModelScore: deck.businessModelScore,
        teamCredibilityScore: deck.teamCredibilityScore,
        tractionScore: deck.tractionScore,
        financialsScore: deck.financialsScore,
        askClarityScore: deck.askClarityScore,
        overallScore: deck.overallScore,
        strengths: deck.strengths || [],
        weaknesses: deck.weaknesses || [],
        recommendations: deck.recommendations || [],
      },
    });
  }

  const script = await prisma.pitchScript.findUnique({
    where: { id: sessionId },
    include: { user: true },
  });

  if (script) {
    return triggerPostSessionWebhooks({
      sessionId: script.id,
      sessionType: 'script',
      userId: script.userId,
      userEmail: script.user?.email || '',
      userName: `${script.user?.firstName || ''} ${script.user?.lastName || ''}`.trim(),
      productId: 'elevator-script',
      moduleId: 'm2',
      score: script.overallScore || 0,
      completedAt: script.analyzedAt || new Date(),
      reportData: {
        hookScore: script.hookScore,
        problemScore: script.problemScore,
        solutionScore: script.solutionScore,
        credibilityScore: script.credibilityScore,
        ctaScore: script.ctaScore,
        overallScore: script.overallScore,
        strengths: script.strengths || [],
        weaknesses: script.weaknesses || [],
        recommendations: script.recommendations || [],
      },
    });
  }

  const video = await prisma.pitchVideo.findUnique({
    where: { id: sessionId },
    include: { user: true },
  });

  if (video) {
    return triggerPostSessionWebhooks({
      sessionId: video.id,
      sessionType: 'live',
      userId: video.userId,
      userEmail: video.user?.email || '',
      userName: `${video.user?.firstName || ''} ${video.user?.lastName || ''}`.trim(),
      productId: 'elevator-live',
      moduleId: 'm3',
      score: video.overallDeliveryScore || 0,
      completedAt: video.analyzedAt || new Date(),
      reportData: {
        paceScore: video.paceScore,
        clarityScore: video.clarityScore,
        fillerWordScore: video.fillerWordScore,
        energyScore: video.energyScore,
        confidenceScore: video.confidenceScore,
        overallDeliveryScore: video.overallDeliveryScore,
        strengths: video.strengths || [],
        weaknesses: video.weaknesses || [],
        recommendations: video.recommendations || [],
      },
    });
  }

  const fullSession = await prisma.fullPitchSession.findUnique({
    where: { id: sessionId },
    include: { user: true, pitchDeck: true },
  });

  if (fullSession) {
    return triggerPostSessionWebhooks({
      sessionId: fullSession.id,
      sessionType: 'full',
      userId: fullSession.userId,
      userEmail: fullSession.user?.email || '',
      userName: `${fullSession.user?.firstName || ''} ${fullSession.user?.lastName || ''}`.trim(),
      productId: 'pitch-deck-live',
      moduleId: 'm4',
      score: fullSession.overallReadinessScore || 0,
      completedAt: fullSession.analyzedAt || new Date(),
      reportData: {
        problemSolutionFit: fullSession.problemSolutionFit,
        marketOpportunity: fullSession.marketOpportunity,
        businessModelViability: fullSession.businessModelViability,
        teamCredibility: fullSession.teamCredibility,
        tractionMilestones: fullSession.tractionMilestones,
        deliveryPresence: fullSession.deliveryPresence,
        overallReadinessScore: fullSession.overallReadinessScore,
        investorReadinessLevel: fullSession.investorReadinessLevel,
        strengths: fullSession.strengths || [],
        weaknesses: fullSession.weaknesses || [],
        recommendations: fullSession.recommendations || [],
      },
    });
  }

  return null;
}
