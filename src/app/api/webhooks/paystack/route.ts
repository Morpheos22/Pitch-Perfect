// Paystack Webhook Handler
// POST /api/webhooks/paystack
// Handles Paystack payment callbacks for South African customers

import { NextRequest, NextResponse } from 'next/server';
import { parseWebhookPayload, verifyPayment, createEntitlementsFromPayment } from '@/lib/payment-service';
import { prisma } from '@/lib/db';
import { createEntitlement, updateLeadStatus } from '@/lib/zoho-crm';
import { sendPaymentConfirmationEmail } from '@/lib/zoho-mail';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('x-paystack-signature') || '';

    // Parse and verify webhook
    const { valid, event, data } = parseWebhookPayload('paystack', body, signature);

    if (!valid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Handle different events
    if (event === 'charge.success') {
      const reference = (data as Record<string, unknown>).reference as string;
      
      // Verify payment with Paystack
      const paymentResult = await verifyPayment('paystack', reference);

      if (!paymentResult.success) {
        return NextResponse.json({ error: 'Payment not successful' }, { status: 400 });
      }

      // Find pending payment record
      const payment = await prisma.payment.findFirst({
        where: {
          gatewaySessionId: reference,
          gateway: 'paystack',
        },
        include: { user: true },
      });

      if (!payment) {
        return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
      }

      // Update payment status
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'COMPLETED',
          gatewayTransactionId: paymentResult.transactionId,
          processedAt: new Date(),
        },
      });

      // Create entitlements
      const entitlementData = createEntitlementsFromPayment(paymentResult, payment.userId);
      await createEntitlement(entitlementData);

      // Update user subscription
      await prisma.subscription.update({
        where: { userId: payment.userId },
        data: {
          plan: getPlanFromProduct(payment.productId),
          status: 'ACTIVE',
          updatedAt: new Date(),
        },
      });

      // Update CRM lead status
      await updateLeadStatus(payment.user.clerkId, 'Qualified');

      // Send confirmation email
      await sendPaymentConfirmationEmail({
        to: payment.user.email,
        firstName: payment.user.firstName || 'there',
        productName: payment.productName,
        amount: payment.amount,
        currency: payment.currency,
        modules: entitlementData.modules.map(m => ({
          name: m.moduleId,
          cycles: m.totalCycles,
        })),
      });

      return NextResponse.json({ success: true });
    }

    // Acknowledge other events
    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('Paystack webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

function getPlanFromProduct(productId: string): string {
  const planMap: Record<string, string> = {
    'pitch-deck': 'STARTER',
    'elevator-script': 'STARTER',
    'elevator-live': 'PROFESSIONAL',
    'pitch-deck-live': 'PROFESSIONAL',
    'master': 'ENTERPRISE',
  };
  return planMap[productId] || 'STARTER';
}
