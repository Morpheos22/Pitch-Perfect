// Paystack Webhook Handler
// POST /api/webhooks/paystack
// Handles Paystack payment callbacks for African market customers

import { NextRequest, NextResponse } from 'next/server';
import { parseWebhookPayload, verifyPayment } from '@/lib/payment-service';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('x-paystack-signature') || '';

    // Parse and verify webhook
    const { valid, event, data } = parseWebhookPayload('paystack', body, signature);

    if (!valid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
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

      // Create module access based on product (idempotent — skip if already exists)
      const existingAccess = await prisma.moduleAccess.findUnique({
        where: { transactionId: transaction.id },
      });

      if (!existingAccess) {
        await prisma.moduleAccess.create({
          data: {
            transactionId: transaction.id,
            e1Access: ['pitch-deck', 'pitch-deck-live', 'master'].includes(productId),
            e2Access: ['elevator-script', 'elevator-live', 'master'].includes(productId),
            e3Access: ['elevator-live', 'pitch-deck-live', 'master'].includes(productId),
            e4Access: ['pitch-deck-live', 'master'].includes(productId),
            e1Limit: productId === 'master' ? 20 : productId === 'pitch-deck-live' ? 5 : 2,
            e2Limit: productId === 'master' ? 50 : productId === 'elevator-live' ? 10 : 2,
            e3Limit: productId === 'master' ? 30 : 3,
            e4Limit: productId === 'master' ? 10 : 3,
          },
        });
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

      return NextResponse.json({ success: true });
    }

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
