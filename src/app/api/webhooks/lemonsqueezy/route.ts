// LemonSqueezy Webhook Handler
// POST /api/webhooks/lemonsqueezy
// Handles LemonSqueezy (Merchant of Record) payment callbacks for international customers

import { NextRequest, NextResponse } from 'next/server';
import { parseWebhookPayload, verifyPayment } from '@/lib/payment-service';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('x-signature') || '';

    // Parse and verify webhook
    const { valid, event, data } = parseWebhookPayload('lemonsqueezy', body, signature);

    if (!valid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Handle order completed event
    if (event === 'order_created' || event === 'order_completed') {
      const order = data as Record<string, unknown>;
      const orderId = order.id as string;
      const orderAttributes = order.attributes as Record<string, unknown>;

      // Check if order is paid
      if (orderAttributes.status !== 'paid') {
        return NextResponse.json({ received: true, status: 'not_paid' });
      }

      // Extract custom data — DO NOT trust client-supplied userId
      const customData = (orderAttributes.custom_data as Record<string, unknown>) || {};
      const productId = customData.productId as string;

      if (!productId) {
        return NextResponse.json({ error: 'Missing product ID' }, { status: 400 });
      }

      // Verify payment with LemonSqueezy API
      const paymentResult = await verifyPayment('lemonsqueezy', orderId);

      if (!paymentResult.success) {
        return NextResponse.json({ error: 'Payment not successful' }, { status: 400 });
      }

      // Look up user by customer email (from LemonSqueezy, not client-supplied)
      const customerEmail = orderAttributes.user_email as string
        || orderAttributes.customer_email as string
        || orderAttributes.email as string;

      if (!customerEmail) {
        return NextResponse.json({ error: 'Customer email not found in order' }, { status: 400 });
      }

      const user = await prisma.user.findFirst({
        where: { email: customerEmail },
      });

      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      // Create transaction record if not exists (idempotent)
      let txId: string;
      const existingTx = await prisma.transaction.findFirst({
        where: {
          providerReference: orderId,
          provider: 'LEMONSQUEEZY',
        },
      });

      if (existingTx) {
        txId = existingTx.id;
      } else {
        const newTx = await prisma.transaction.create({
          data: {
            userId: user.id,
            type: 'SUBSCRIPTION',
            amount: paymentResult.amount * 100,
            currency: paymentResult.currency.toLowerCase(),
            provider: 'LEMONSQUEEZY',
            providerReference: orderId,
            providerAccessCode: productId,
            creditsAdded: getModuleCycles(productId),
          },
        });
        txId = newTx.id;
      }

      // Create module access if not exists (atomic upsert to prevent TOCTOU race condition)
      await prisma.moduleAccess.upsert({
        where: { transactionId: txId },
        create: {
          transactionId: txId,
          e1Access: ['pitch-deck', 'pitch-deck-live', 'master'].includes(productId),
          e2Access: ['elevator-script', 'elevator-live', 'master'].includes(productId),
          e3Access: ['elevator-live', 'pitch-deck-live', 'master'].includes(productId),
          e4Access: ['pitch-deck-live', 'master'].includes(productId),
          e1Limit: productId === 'master' ? 20 : productId === 'pitch-deck-live' ? 5 : 2,
          e2Limit: productId === 'master' ? 50 : productId === 'elevator-live' ? 10 : 2,
          e3Limit: productId === 'master' ? 30 : 3,
          e4Limit: productId === 'master' ? 10 : 3,
        },
        update: {}, // no-op if already exists
      });

      // Update user subscription
      await prisma.subscription.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          plan: getPlanFromProduct(productId),
          status: 'ACTIVE',
        },
        update: {
          plan: getPlanFromProduct(productId),
          status: 'ACTIVE',
          updatedAt: new Date(),
        },
      });

      return NextResponse.json({ success: true });
    }

    // Acknowledge other events
    return NextResponse.json({ received: true, event });

  } catch (error) {
    console.error('LemonSqueezy webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

function getPlanFromProduct(productId: string): 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE' {
  const planMap: Record<string, 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE'> = {
    'pitch-deck': 'STARTER',
    'elevator-script': 'STARTER',
    'elevator-live': 'PROFESSIONAL',
    'pitch-deck-live': 'PROFESSIONAL',
    'master': 'ENTERPRISE',
  };
  return planMap[productId] || 'STARTER';
}

function getModuleCycles(productId: string): number {
  const cycleMap: Record<string, number> = {
    'pitch-deck': 2,
    'elevator-script': 2,
    'elevator-live': 5,
    'pitch-deck-live': 8,
    'master': 20,
  };
  return cycleMap[productId] || 0;
}
