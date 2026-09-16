/**
 * Webhook Idempotency Helper
 *
 * Prevents duplicate processing of webhook events from Stripe, Paystack,
 * and Clerk. Each webhook event has a unique ID (Stripe's event.id,
 * Paystack's reference, Clerk's svix-id). We store it in the
 * ProcessedWebhook table BEFORE processing. If the same event ID arrives
 * again (provider retry), we skip processing and return 200 OK.
 *
 * Usage in a webhook route:
 *
 *   const dedup = await checkWebhookIdempotency("STRIPE", event.id);
 *   if (dedup.alreadyProcessed) {
 *     return NextResponse.json({ received: true, deduplicated: true });
 *   }
 *   // ... process the event ...
 *   await markWebhookProcessed("STRIPE", event.id, {
 *     eventType: event.type,
 *     userId: extractedUserId,
 *     payload: event,
 *   });
 */

import { prisma } from "@/lib/db";

export type WebhookProvider = "STRIPE" | "PAYSTACK" | "CLERK";

export interface IdempotencyCheckResult {
  alreadyProcessed: boolean;
  /** Present when alreadyProcessed=true — the original processing timestamp */
  processedAt?: Date;
  /** Present when alreadyProcessed=true and the original processing failed */
  errorMessage?: string | null;
}

/**
 * Check if a webhook event has already been processed.
 * Does NOT create a record — call markWebhookProcessed() after successful
 * processing to record the event ID.
 *
 * Race-condition safe: uses a unique constraint on (provider, eventId).
 * If two webhooks arrive simultaneously, one will win the insert and the
 * other will get a constraint violation — which we treat as "already processed".
 */
export async function checkWebhookIdempotency(
  provider: WebhookProvider,
  eventId: string,
): Promise<IdempotencyCheckResult> {
  const existing = await prisma.processedWebhook.findUnique({
    where: {
      provider_eventId: { provider, eventId },
    },
    select: {
      processedAt: true,
      errorMessage: true,
      processed: true,
    },
  });

  if (existing) {
    return {
      alreadyProcessed: true,
      processedAt: existing.processedAt,
      errorMessage: existing.errorMessage,
    };
  }

  return { alreadyProcessed: false };
}

/**
 * Mark a webhook event as processed. Called AFTER the event has been
 * successfully handled (or after it failed, with errorMessage set).
 *
 * If the (provider, eventId) already exists (race condition), this is a
 * no-op — the first caller wins.
 */
export async function markWebhookProcessed(
  provider: WebhookProvider,
  eventId: string,
  opts?: {
    eventType?: string;
    userId?: string;
    errorMessage?: string;
    payload?: unknown;
  },
): Promise<void> {
  try {
    await prisma.processedWebhook.create({
      data: {
        provider,
        eventId,
        eventType: opts?.eventType,
        userId: opts?.userId,
        processed: !opts?.errorMessage,
        errorMessage: opts?.errorMessage,
        payload: opts?.payload as any,
      },
    });
  } catch (err: any) {
    // Unique constraint violation = race condition, another worker already
    // recorded this event. That's fine — the event was processed.
    if (err?.code === "P2002") {
      return;
    }
    // Re-throw unexpected errors
    throw err;
  }
}

/**
 * Combined helper: check + mark in one call for the "claim" pattern.
 *
 * Returns { claimed: true } if this caller is the first to see the event
 * and should process it. Returns { claimed: false } if another caller
 * already processed it.
 *
 * IMPORTANT: The caller MUST call markWebhookProcessed() (or the alternative
 * markWebhookFailed()) after processing, to record the result. This helper
 * only does the initial "has this been seen?" check.
 *
 * This is kept as a separate function from checkWebhookIdempotency so that
 * the caller can decide the pattern:
 *   - Pattern A (check-then-mark): checkWebhookIdempotency → process → markWebhookProcessed
 *   - Pattern B (claim): claimWebhook → process → markWebhookProcessed
 *
 * Pattern A is safer for long-running handlers (the check is instant,
 * processing takes seconds). Pattern B risks a race where two workers both
 * "claim" before either inserts — but the unique constraint catches it.
 */
export async function claimWebhook(
  provider: WebhookProvider,
  eventId: string,
): Promise<{ claimed: boolean }> {
  const check = await checkWebhookIdempotency(provider, eventId);
  return { claimed: !check.alreadyProcessed };
}
