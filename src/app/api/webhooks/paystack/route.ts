// Paystack Webhook Handler
// POST /api/webhooks/paystack
// Handles Paystack payment callbacks for African market customers


import { NextRequest, NextResponse } from 'next/server';
import { parseWebhookPayload, verifyPayment } from '@/lib/payment-service';
import { prisma } from '@/lib/db';
import { getPlanFromProduct, getModuleCycles, createModuleAccess } from '@/lib/payment-service';
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


      // Create module access (single source of truth in payment-service)
      await createModuleAccess(transaction.id, productId);


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
