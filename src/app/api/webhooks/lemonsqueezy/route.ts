// LemonSqueezy Webhook Handler
// POST /api/webhooks/lemonsqueezy
// Handles LemonSqueezy (Merchant of Record) payment callbacks for international customers

import { NextRequest, NextResponse } from 'next/server';
import { parseWebhookPayload, verifyPayment, createEntitlementsFromPayment } from '@/lib/payment-service';
import { prisma } from '@/lib/db';
import { createEntitlement, updateLeadStatus } from '@/lib/zoho-crm';
import { sendPaymentConfirmationEmail } from '@/lib/zoho-mail';

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

      // Extract custom data
      const customData = (orderAttributes.custom_data as Record<string, unknown>) || {};
      const userId = customData.userId as string;
      const productId = customData.productId as string;

      if (!userId || !productId) {
        return NextResponse.json({ error: 'Missing user or product ID' }, { status: 400 });
      }

      // Verify payment with LemonSqueezy
      const paymentResult = await verifyPayment('lemonsqueezy', orderId);

      if (!paymentResult.success) {
        return NextResponse.json({ error: 'Payment not successful' }, { status: 400 });
      }

      // Find user
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      // Create payment record if not exists
      const existingPayment = await prisma.payment.findFirst({
        where: {
          gatewayTransactionId: orderId,
          gateway: 'lemonsqueezy',
        },
      });

      if (!existingPayment) {
        await prisma.payment.create({
          data: {
            userId: user.id,
            gateway: 'lemonsqueezy',
            gatewayTransactionId: orderId,
            productId,
            productName: customData.productName as string || productId,
            amount: paymentResult.amount,
            currency: paymentResult.currency,
            status: 'COMPLETED',
            processedAt: new Date(),
          },
        });
      } else {
        await prisma.payment.update({
          where: { id: existingPayment.id },
          data: {
            status: 'COMPLETED',
            processedAt: new Date(),
          },
        });
      }

      // Create entitlements
      const entitlementData = createEntitlementsFromPayment(paymentResult, userId);
      await createEntitlement(entitlementData);

      // Update user subscription
      await prisma.subscription.upsert({
        where: { userId },
        create: {
          userId,
          plan: getPlanFromProduct(productId),
          status: 'ACTIVE',
        },
        update: {
          plan: getPlanFromProduct(productId),
          status: 'ACTIVE',
          updatedAt: new Date(),
        },
      });

      // Update CRM lead status
      await updateLeadStatus(user.clerkId, 'Qualified');

      // Send confirmation email
      await sendPaymentConfirmationEmail({
        to: user.email,
        firstName: user.firstName || 'there',
        productName: customData.productName as string || productId,
        amount: paymentResult.amount,
        currency: paymentResult.currency,
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
    console.error('LemonSqueezy webhook error:', error);
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
