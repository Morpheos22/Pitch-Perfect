// Stripe Webhook Handler
// POST /api/billing/webhooks/stripe
// Handles Stripe Checkout Session events: payment completion, subscription updates

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyStripeWebhook, parseWebhookPayload, createEntitlementsFromPayment } from '@/lib/payment-service';

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get('stripe-signature') || '';
    const body = await request.text();

    // Verify webhook signature
    if (!verifyStripeWebhook(signature, body)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const parsed = parseWebhookPayload('stripe', body, signature);
    if (!parsed.valid || !parsed.event) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const { event, data } = parsed;

    // Handle different Stripe events
    switch (event) {
      case 'checkout.session.completed': {
        // Payment successful — create entitlements
        const sessionData = data as {
          id: string;
          payment_intent?: string;
          payment_status: string;
          customer_details?: { email: string };
          customer_email?: string;
          metadata?: Record<string, string>;
          amount_total: number;
          currency: string;
        };

        if (sessionData.payment_status !== 'paid') {
          return NextResponse.json({ received: true, status: 'not_paid' });
        }

        // Update transaction to completed
        const transaction = await prisma.transaction.findFirst({
          where: {
            providerReference: sessionData.id,
            provider: 'STRIPE',
          },
        });

        if (transaction) {
          await prisma.transaction.update({
            where: { id: transaction.id },
            data: {
              type: 'SUBSCRIPTION',
              amount: sessionData.amount_total,
              currency: sessionData.currency,
            },
          });

          // Create module access
          const productId = sessionData.metadata?.product_id || transaction.providerAccessCode;
          if (productId) {
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

          // Update subscription plan
          await prisma.subscription.upsert({
            where: { userId: transaction.userId },
            create: {
              userId: transaction.userId,
              plan: 'STARTER',
              status: 'ACTIVE',
              stripeCustomerId: sessionData.customer_details?.email || '',
              stripeSubscriptionId: sessionData.payment_intent || sessionData.id,
              stripeCurrentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
            update: {
              plan: 'STARTER',
              status: 'ACTIVE',
              stripeSubscriptionId: sessionData.payment_intent || sessionData.id,
              stripeCurrentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
          });
        }

        break;
      }

      case 'customer.subscription.updated': {
        // Subscription status change (upgrade, downgrade, cancellation)
        const subData = data as {
          id: string;
          status: string;
          metadata?: Record<string, string>;
          current_period_end?: number;
        };

        const subscription = await prisma.subscription.findFirst({
          where: { stripeSubscriptionId: subData.id },
        });

        if (subscription) {
          const statusMap: Record<string, 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'INCOMPLETE' | 'TRIALING'> = {
            active: 'ACTIVE',
            past_due: 'PAST_DUE',
            canceled: 'CANCELLED',
            unpaid: 'PAST_DUE',
            trialing: 'TRIALING',
            incomplete: 'INCOMPLETE',
          };

          await prisma.subscription.update({
            where: { id: subscription.id },
            data: {
              status: statusMap[subData.status] || 'ACTIVE',
              cancelAtPeriodEnd: subData.status === 'canceled',
              ...(subData.current_period_end && {
                stripeCurrentPeriodEnd: new Date(subData.current_period_end * 1000),
              }),
            },
          });
        }

        break;
      }

      case 'customer.subscription.deleted': {
        // Subscription cancelled
        const subData = data as { id: string };

        const subscription = await prisma.subscription.findFirst({
          where: { stripeSubscriptionId: subData.id },
        });

        if (subscription) {
          await prisma.subscription.update({
            where: { id: subscription.id },
            data: {
              status: 'CANCELLED',
              plan: 'FREE',
            },
          });
        }

        break;
      }

      case 'invoice.payment_failed': {
        // Payment failure — mark subscription as past due
        const invoiceData = data as {
          subscription_id?: string;
          customer?: string;
        };

        if (invoiceData.subscription_id) {
          const subscription = await prisma.subscription.findFirst({
            where: { stripeSubscriptionId: invoiceData.subscription_id },
          });

          if (subscription) {
            await prisma.subscription.update({
              where: { id: subscription.id },
              data: { status: 'PAST_DUE' },
            });
          }
        }

        break;
      }

      default:
        // Unhandled event — acknowledge but don't process
        break;
    }

    return NextResponse.json({ received: true, event });
  } catch (error) {
    console.error('Stripe webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
