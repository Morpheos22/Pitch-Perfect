// Paystack Webhook Handler
// POST /api/webhooks/paystack
// Handles Paystack payment callbacks for African market customers


import { NextRequest, NextResponse } from 'next/server';
import { parseWebhookPayload, verifyPayment, PRODUCTS } from '@/lib/payment-service';
import { prisma } from '@/lib/db';
import { getPlanFromProduct, getModuleCycles, createModuleAccess } from '@/lib/payment-service';
import { checkWebhookIdempotency, markWebhookProcessed } from '@/lib/webhook-idempotency';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('x-paystack-signature') || '';


    // Parse and verify webhook
    const { valid, event, data } = parseWebhookPayload('paystack', body, signature);


    if (!valid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // ── Idempotency check ──────────────────────────────────────────────────
    // Paystack retries webhooks on non-2xx responses. Without dedup, a
    // single charge.success event could create duplicate entitlements.
    // We use the Paystack reference (unique per transaction) as the event ID.
    const paystackReference = (data as Record<string, unknown>)?.reference as string | undefined;
    const eventId = paystackReference || `${event}:${request.headers.get('x-paystack-signature')?.slice(0, 16)}`;

    const dedup = await checkWebhookIdempotency("PAYSTACK", eventId);
    if (dedup.alreadyProcessed) {
      console.log(`[Paystack] Duplicate event ${eventId} skipped (already processed at ${dedup.processedAt?.toISOString()})`);
      return NextResponse.json({ received: true, deduplicated: true });
    }


    if (event === 'charge.success') {
      const reference = (data as Record<string, unknown>).reference as string;


      // Verify payment with Paystack API
      const paymentResult = await verifyPayment('paystack', reference);


      if (!paymentResult.success) {
        return NextResponse.json({ error: 'Payment not successful' }, { status: 400 });
      }


      // Find pending transaction record
      const transaction = await prisma.transaction.findFirst({
        where: {
          providerReference: reference,
          provider: 'PAYSTACK',
        },
      });


      if (!transaction) {
        return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
      }


      // Get product ID from providerAccessCode (where we stored it)
      const productId = transaction.providerAccessCode || '';


      // SECURITY: Validate productId against server-side allowlist before granting entitlement
      if (productId && !PRODUCTS[productId]) {
        console.error('[Paystack] Rejected unknown productId:', productId);
        return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 });
      }


      // Create module access (single source of truth in payment-service)
      if (productId) {
        await createModuleAccess(transaction.id, productId);
      }


      // Update user subscription
      await prisma.subscription.upsert({
        where: { userId: transaction.userId },
        create: {
          userId: transaction.userId,
          plan: getPlanFromProduct(productId),
          status: 'ACTIVE',
          paystackSubscriptionId: reference,
        },
        update: {
          plan: getPlanFromProduct(productId),
          status: 'ACTIVE',
          paystackSubscriptionId: reference,
          updatedAt: new Date(),
        },
      });


      // Update transaction amount with actual paid amount
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          type: 'SUBSCRIPTION',
          amount: paymentResult.amount * 100, // Store in smallest unit
          currency: paymentResult.currency.toLowerCase(),
          creditsAdded: getModuleCycles(productId),
        },
      });


      // Mark charge.success as processed BEFORE the early return so Paystack
      // doesn't retry it. If we reach this point, processing succeeded.
      await markWebhookProcessed("PAYSTACK", eventId, {
        eventType: event,
        userId: transaction.userId,
        payload: { event, reference: paystackReference, amount: paymentResult.amount },
      }).catch((err) => {
        console.warn(`[Paystack] Failed to mark event ${eventId} as processed:`, err);
      });

      return NextResponse.json({ success: true });
    }

    // Note: charge.success events are marked as processed inside the
    // if-block above (before the early return). The markWebhookProcessed
    // call below handles all OTHER event types.


    // ── Mark event as processed (idempotency) ──────────────────────────────
    await markWebhookProcessed("PAYSTACK", eventId, {
      eventType: event,
      payload: { event, reference: paystackReference },
    }).catch((err) => {
      console.warn(`[Paystack] Failed to mark event ${eventId} as processed:`, err);
    });

    // Acknowledge other events
    return NextResponse.json({ received: true, event });


  } catch (error) {
    console.error('Paystack webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
