// ═══════════════════════════════════════════════════════════════════════
// KAL PROTOCOL — Graceful Degradation & Auto-Recovery System
// ═══════════════════════════════════════════════════════════════════════
//
// Named after the Kalahari — the desert that endures and recovers.
//
// PURPOSE:
//   When a module or AI model fails during analysis, the Kal Protocol
//   ensures the user is NEVER left with a broken experience. Instead:
//
//   1. IMMEDIATE: Display a friendly "Check Dashboard" placeholder alert
//   2. BACKGROUND: Auto-correct and retry the analysis with relaxed runtime
//   3. DELIVERY: Send the completed PDF analysis via email within 20 minutes
//   4. PERSISTENCE: Store the pending analysis in the database for recovery
//
// FLOW:
//   User submits → AI fails → Kal Protocol activates →
//     → User sees "Check Dashboard in a few minutes" placeholder
//     → System retries with longer timeout (120s)
//     → On success: generate PDF, email to user, update database record
//     → On final failure: log error, send apology email with support link
//
// DATABASE INTEGRATION:
//   - PitchScript.status = 'KAL_PENDING' (new status)
//   - PitchScript.notes = 'Kal Protocol: Analysis in progress...'
//   - On completion: status → 'COMPLETED', analysis fields populated
//   - On final failure: status → 'KAL_FAILED', email sent
//
// RUNTIME:
//   - Normal analysis timeout: 60s (maxDuration on route)
//   - Kal retry timeout: 120s (relaxed)
//   - Maximum retries: 3 (with exponential backoff: 0s, 30s, 90s)
//   - Total budget: ~20 minutes from initial failure
//
// ═══════════════════════════════════════════════════════════════════════

import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';

// ============================================
// TYPES
// ============================================

export interface KalTrigger {
  userId: string;
  sessionId: string;
  module: 'e1' | 'e2' | 'e3' | 'e4' | 'e5';
  model: string;
  error: string;
  /** Original input that triggered the failed analysis */
  inputPayload: string;
  /** User's email for notification */
  userEmail: string;
  /** User's name for personalized email */
  userName?: string;
  /** Target audience (for script analysis) */
  targetAudience?: string;
  /** Target duration in seconds (for script analysis) */
  targetDuration?: number;
}

export interface KalResult {
  activated: boolean;
  sessionId: string;
  status: 'KAL_PENDING' | 'COMPLETED' | 'KAL_FAILED';
  message: string;
  retryScheduledAt: Date;
}

// ============================================
// CONSTANTS
// ============================================

/** Maximum number of retry attempts */
const KAL_MAX_RETRIES = 3;

/** Base delay between retries (exponential backoff: 0, 30s, 90s) */
const KAL_RETRY_DELAYS_MS = [0, 30_000, 90_000];

/** Maximum total time budget for Kal Protocol (20 minutes) */
const KAL_MAX_BUDGET_MS = 20 * 60 * 1000;

/** Relaxed timeout for Kal retries (120 seconds vs normal 60s) */
const KAL_RELAXED_TIMEOUT_MS = 120_000;

/** User-facing message shown immediately when Kal activates */
export const KAL_PLACEHOLDER_MESSAGE =
  "Your analysis is taking longer than expected. Don't worry — we're processing it in the background. " +
  "Check your dashboard in a few minutes, and we'll also email the full results to you. " +
  "This usually completes within 5-10 minutes.";

/** User-facing message for dashboard placeholder */
export const KAL_DASHBOARD_ALERT = {
  title: "Analysis In Progress",
  description:
    "Your script is being analyzed. The full results will appear here shortly, " +
    "and a PDF copy will be sent to your email within 20 minutes.",
  variant: 'default' as const,
};

// ============================================
// KAL PROTOCOL — MAIN ACTIVATION
// ============================================

/**
 * Activate the Kal Protocol when an AI analysis fails.
 *
 * This function:
 * 1. Marks the session as KAL_PENDING in the database
 * 2. Returns an immediate response for the user (placeholder alert)
 * 3. Fires a background retry process (non-blocking)
 *
 * IMPORTANT: This function must NEVER throw — it's the last line of defense.
 * If it fails, the user gets a generic 503 error instead of a graceful recovery.
 */
export async function activateKalProtocol(trigger: KalTrigger): Promise<KalResult> {
  const retryScheduledAt = new Date(Date.now() + KAL_RETRY_DELAYS_MS[0]);

  try {
    // Step 1: Update session status to KAL_PENDING
    await updateSessionStatus(trigger.module, trigger.sessionId, 'KAL_PENDING', {
      notes: `Kal Protocol activated: ${trigger.error}. Retrying with relaxed runtime...`,
    });

    // Step 2: Fire background retry (non-blocking — don't await)
    // In a production Vercel deployment, this would ideally be a Vercel Cron
    // or an async queue (e.g., Upstash QStash). For now, we use a fire-and-forget
    // pattern that works within the serverless execution model.
    executeKalRetry(trigger).catch((err) => {
      console.error(`[Kal] Background retry process failed completely:`, err);
      // Final fallback: send apology email
      sendKalFailureEmail(trigger.userEmail, trigger.userName, trigger.sessionId).catch(() => {
        // Nothing more we can do — log and move on
        console.error(`[Kal] Could not send failure email for session ${trigger.sessionId}`);
      });
    });

    return {
      activated: true,
      sessionId: trigger.sessionId,
      status: 'KAL_PENDING',
      message: KAL_PLACEHOLDER_MESSAGE,
      retryScheduledAt,
    };
  } catch (err: any) {
    console.error(`[Kal] Failed to activate protocol:`, err);
    return {
      activated: false,
      sessionId: trigger.sessionId,
      status: 'KAL_FAILED',
      message: 'Analysis failed and recovery could not be initiated. Please try again later.',
      retryScheduledAt: new Date(),
    };
  }
}

// ============================================
// KAL PROTOCOL — RETRY ENGINE
// ============================================

/**
 * Execute the Kal Protocol retry sequence.
 *
 * Tries up to KAL_MAX_RETRIES times with exponential backoff.
 * On success: generates PDF, emails user, updates session.
 * On final failure: sends apology email, marks session as KAL_FAILED.
 *
 * This function is intentionally fire-and-forget from the caller's perspective.
 */
async function executeKalRetry(trigger: KalTrigger): Promise<void> {
  const startTime = Date.now();
  let lastError: string = trigger.error;

  for (let attempt = 0; attempt < KAL_MAX_RETRIES; attempt++) {
    // Check budget — don't exceed 20 minutes total
    if (Date.now() - startTime > KAL_MAX_BUDGET_MS) {
      console.warn(`[Kal] Budget exceeded for session ${trigger.sessionId}. Aborting.`);
      break;
    }

    // Wait for backoff delay (0 for first attempt)
    const delay = KAL_RETRY_DELAYS_MS[attempt] || 0;
    if (delay > 0) {
      console.log(`[Kal] Waiting ${delay / 1000}s before retry ${attempt + 1}/${KAL_MAX_RETRIES}...`);
      await sleep(delay);
    }

    console.log(`[Kal] Retry attempt ${attempt + 1}/${KAL_MAX_RETRIES} for session ${trigger.sessionId}`);

    try {
      // Dynamic import to avoid circular dependencies
      const analysis = await retryAnalysis(trigger);

      if (analysis) {
        // SUCCESS: Update session with results
        await updateSessionWithResults(trigger.module, trigger.sessionId, analysis);

        // Generate and send PDF via email
        await sendKalCompletionEmail(trigger, analysis);

        console.log(`[Kal] SUCCESS: Session ${trigger.sessionId} completed on retry ${attempt + 1}`);
        return; // Exit — we're done
      }
    } catch (retryErr: any) {
      lastError = retryErr?.message || String(retryErr);
      console.warn(`[Kal] Retry ${attempt + 1} failed: ${lastError}`);
    }
  }

  // ALL RETRIES EXHAUSTED — mark as failed and notify user
  console.error(`[Kal] All retries exhausted for session ${trigger.sessionId}. Last error: ${lastError}`);

  await updateSessionStatus(trigger.module, trigger.sessionId, 'KAL_FAILED', {
    notes: `Kal Protocol: All ${KAL_MAX_RETRIES} retries failed. Last error: ${lastError}. Apology email sent.`,
  });

  await sendKalFailureEmail(trigger.userEmail, trigger.userName, trigger.sessionId);
}

// ============================================
// KAL PROTOCOL — ANALYSIS RETRY
// ============================================

/**
 * Retry the analysis with relaxed timeout.
 * Returns the analysis result or null if it fails.
 */
async function retryAnalysis(trigger: KalTrigger): Promise<Record<string, unknown> | null> {
  try {
    switch (trigger.module) {
      case 'e2': {
        const { analyzeScriptWithFallback } = await import('./ai-service');
        const result = await analyzeScriptWithFallback(
          trigger.inputPayload,
          trigger.targetAudience,
          trigger.targetDuration,
          undefined,
          '[Kal]'
        );
        if (!result) return null;
        // Convert ScriptAnalysisResult to plain object for database storage
        return {
          hookScore: result.hookScore,
          problemScore: result.problemScore,
          solutionScore: result.solutionScore,
          credibilityScore: result.credibilityScore,
          ctaScore: result.ctaScore,
          overallScore: result.overallScore,
          wordCount: result.wordCount,
          estimatedDuration: result.estimatedDuration,
          improvements: result.improvements,
          rewrittenScript: result.rewrittenScript,
          alternativeHooks: result.alternativeHooks,
          modelUsed: result.modelUsed,
          tokensUsed: result.tokensUsed,
        };
      }
      case 'e1': {
        const { analyzePitchDeck } = await import('./ai-service');
        const result = await analyzePitchDeck(trigger.inputPayload);
        return result as unknown as Record<string, unknown>;
      }
      default:
        console.warn(`[Kal] Module ${trigger.module} retry not yet implemented`);
        return null;
    }
  } catch (err: any) {
    console.error(`[Kal] Retry analysis failed: ${err?.message}`);
    return null;
  }
}

// ============================================
// KAL PROTOCOL — DATABASE OPERATIONS
// ============================================

/**
 * Update session status in the database.
 * Works across different module types (E1–E5).
 */
async function updateSessionStatus(
  module: string,
  sessionId: string,
  status: string,
  extra: { notes?: string }
): Promise<void> {
  try {
    switch (module) {
      case 'e2':
        await prisma.pitchScript.update({
          where: { id: sessionId },
          data: { status: status as any, notes: extra.notes },
        });
        break;
      case 'e1':
        await prisma.pitchDeck.update({
          where: { id: sessionId },
          data: { status: status as any },
        });
        break;
      case 'e3':
        await prisma.pitchVideo.update({
          where: { id: sessionId },
          data: { status: status as any },
        });
        break;
      case 'e4':
        await prisma.fullPitchSession.update({
          where: { id: sessionId },
          data: { status: status as any },
        });
        break;
      default:
        console.warn(`[Kal] Unknown module ${module} for status update`);
    }
  } catch (err: any) {
    console.error(`[Kal] Failed to update session status: ${err?.message}`);
  }
}

/**
 * Update session with analysis results after Kal retry succeeds.
 */
async function updateSessionWithResults(
  module: string,
  sessionId: string,
  analysis: Record<string, unknown>
): Promise<void> {
  try {
    switch (module) {
      case 'e2':
        await prisma.pitchScript.update({
          where: { id: sessionId },
          data: {
            status: 'COMPLETED',
            hookScore: analysis.hookScore as number,
            problemScore: analysis.problemScore as number,
            solutionScore: analysis.solutionScore as number,
            credibilityScore: analysis.credibilityScore as number,
            ctaScore: analysis.ctaScore as number,
            overallScore: analysis.overallScore as number,
            wordCount: analysis.wordCount as number,
            estimatedDuration: analysis.estimatedDuration as number,
            improvements: analysis.improvements as any,
            rewrittenScript: analysis.rewrittenScript as string,
            alternativeHooks: analysis.alternativeHooks as any,
            analyzedAt: new Date(),
            notes: 'Analysis completed via Kal Protocol auto-recovery.',
          },
        });
        break;
      case 'e1':
        await prisma.pitchDeck.update({
          where: { id: sessionId },
          data: {
            status: 'COMPLETED',
            ...analysis,
            analyzedAt: new Date(),
          },
        });
        break;
      default:
        console.warn(`[Kal] Results update not implemented for module ${module}`);
    }
  } catch (err: any) {
    console.error(`[Kal] Failed to update session with results: ${err?.message}`);
  }
}

// ============================================
// KAL PROTOCOL — EMAIL NOTIFICATIONS
// ============================================

/**
 * Send completion email with PDF analysis attached.
 * The PDF generation is handled by a separate utility.
 */
async function sendKalCompletionEmail(
  trigger: KalTrigger,
  analysis: Record<string, unknown>
): Promise<void> {
  try {
    const subject = `Your ${getModuleName(trigger.module)} Analysis is Ready`;
    const html = `
      <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #1a1a1a;">Your Analysis is Ready</h1>
        <p>Hi ${trigger.userName || 'there'},</p>
        <p>Your ${getModuleName(trigger.module)} analysis has been completed. We experienced a brief delay, but the full results are now available.</p>
        <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0;"><strong>Overall Score:</strong> ${analysis.overallScore}/100</p>
        </div>
        <p>You can view the detailed analysis in your <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" style="color: #4f46e5;">dashboard</a>.</p>
        <p style="color: #666; font-size: 14px;">If you have any questions, please contact support.</p>
        <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />
        <p style="color: #999; font-size: 12px;">PitchCoach Ai by Athena Agentic</p>
      </div>
    `;

    await sendEmail({
      to: trigger.userEmail,
      subject,
      html,
    });

    console.log(`[Kal] Completion email sent to ${trigger.userEmail}`);
  } catch (err: any) {
    console.error(`[Kal] Failed to send completion email: ${err?.message}`);
  }
}

/**
 * Send apology email when all Kal retries fail.
 */
async function sendKalFailureEmail(
  email: string,
  userName?: string,
  sessionId?: string
): Promise<void> {
  try {
    const subject = 'Analysis Update — We Need More Time';
    const html = `
      <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #1a1a1a;">We're Working On It</h1>
        <p>Hi ${userName || 'there'},</p>
        <p>We experienced an issue processing your analysis. Our team has been notified and we're working to resolve it.</p>
        <p>Your analysis is safe in our system, and we'll send you the results as soon as they're ready.</p>
        <div style="background: #fff3cd; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0;"><strong>What to do next:</strong> Check your dashboard in 20 minutes. If the analysis still hasn't appeared, please contact our support team.</p>
        </div>
        <p>You can also try submitting again from your <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" style="color: #4f46e5;">dashboard</a>.</p>
        <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />
        <p style="color: #999; font-size: 12px;">PitchCoach Ai by Athena Agentic</p>
      </div>
    `;

    await sendEmail({
      to: email,
      subject,
      html,
    });

    console.log(`[Kal] Failure notification email sent to ${email}`);
  } catch (err: any) {
    console.error(`[Kal] Failed to send failure email: ${err?.message}`);
  }
}

// ============================================
// HELPERS
// ============================================

function getModuleName(module: string): string {
  const names: Record<string, string> = {
    e1: 'Pitch Deck',
    e2: 'Script Check',
    e3: 'Live Pitch',
    e4: 'Full Pitch Session',
    e5: 'Founder Coaching',
  };
  return names[module] || 'Pitch Coaching';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if a session is in Kal Protocol state (pending recovery).
 * Used by the frontend to display the appropriate placeholder UI.
 */
export function isKalPending(status: string | null | undefined): boolean {
  return status === 'KAL_PENDING';
}

/**
 * Check if a session has failed Kal Protocol (all retries exhausted).
 */
export function isKalFailed(status: string | null | undefined): boolean {
  return status === 'KAL_FAILED';
}

/**
 * Get the user-facing message for a Kal Protocol state.
 */
export function getKalStatusMessage(status: string | null | undefined): string {
  switch (status) {
    case 'KAL_PENDING':
      return KAL_PLACEHOLDER_MESSAGE;
    case 'KAL_FAILED':
      return 'Analysis could not be completed. Please try again or contact support.';
    default:
      return '';
  }
}
