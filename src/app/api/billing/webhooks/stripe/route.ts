// Stripe Webhook Handler
// POST /api/billing/webhooks/stripe
// Handles Stripe Checkout Session events: payment completion, subscription updates


import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/db';
import { getPlanFromProduct, createModuleAccess, PRODUCTS } from '@/lib/payment-service';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get('stripe-signature') || '';
    const body = await request.text();


    // Verify webhook signature using official Stripe SDK
    const stripeSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!stripeSecret) {
      console.error('STRIPE_WEBHOOK_SECRET not configured');
      // Return 501 Not Implemented instead of 500 — Stripe payments are not
      // set up yet. This avoids triggering Stripe's retry logic (which 500 does).
      return NextResponse.json(
        { error: 'Stripe payments not configured. Set STRIPE_WEBHOOK_SECRET to enable.' },
        { status: 501 }
      );
    }


    let stripeEvent: Stripe.Event;
    try {
      stripeEvent = Stripe.webhooks.constructEvent(body, signature, stripeSecret);
    } catch (err: any) {
      console.error('Stripe signature verification failed:', err.message);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }


    const event = stripeEvent.type;
    const data = stripeEvent.data.object;


    // Handle different Stripe events
    switch (event) {
      case 'checkout.session.completed': {
        // Payment successful — create entitlements
        const sessionData = data as Stripe.Checkout.Session;


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
              amount: sessionData.amount_total ?? 0,
              currency: sessionData.currency ?? 'usd',
            },
          });


          // Create module access (single source of truth in payment-service)
          const productId = sessionData.metadata?.product_id || transaction.providerAccessCode;
          // SECURITY: Validate productId against server-side allowlist
          // metadata is client-influenced — validate before granting entitlement
          if (productId && PRODUCTS[productId]) {
            await createModuleAccess(transaction.id, productId);
          } else if (productId) {
            console.error('[Stripe] Rejected unknown productId:', productId);
          }


          // Derive plan from product metadata
          const planFromProduct = getPlanFromProduct(productId);


          // Resolve Stripe Customer ID (cus_xxx)
          // sessionData.customer can be a string (cus_xxx) or expanded Customer object
          const stripeCustomerId = typeof sessionData.customer === 'string'
            ? sessionData.customer
            : sessionData.customer?.id || '';


          // Update subscription plan
          // TODO: Retrieve actual period from Stripe subscription API
          // Using 30-day default as interim
          const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);


          await prisma.subscription.upsert({
            where: { userId: transaction.userId },
            create: {
              userId: transaction.userId,
              plan: planFromProduct,
              status: 'ACTIVE',
              stripeCustomerId,
              stripeSubscriptionId: typeof sessionData.payment_intent === 'string' ? sessionData.payment_intent : sessionData.payment_intent?.id || sessionData.id,
              stripeCurrentPeriodEnd: periodEnd,
            },
            update: {
              plan: planFromProduct,
              status: 'ACTIVE',
              ...(stripeCustomerId && { stripeCustomerId }),
              stripeSubscriptionId: typeof sessionData.payment_intent === 'string' ? sessionData.payment_intent : sessionData.payment_intent?.id || sessionData.id,
              stripeCurrentPeriodEnd: periodEnd,
            },
          });
        }


        break;
      }


      case 'customer.subscription.updated': {
        // Subscription status change (upgrade, downgrade, cancellation)
        const subData = data as Stripe.Subscription;


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
              ...((subData as any).current_period_end && {
                stripeCurrentPeriodEnd: new Date((subData as any).current_period_end * 1000),
              }),
            },
          });
        }


        break;
      }


      case 'customer.subscription.deleted': {
        // Subscription cancelled
        const subData = data as Stripe.Subscription;


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
        const invoiceData = data as Stripe.Invoice;


        const subscriptionId = typeof (invoiceData as any).subscription === 'string'
          ? (invoiceData as any).subscription
          : (invoiceData as any).subscription?.id;


        if (subscriptionId) {
          const subscription = await prisma.subscription.findFirst({
            where: { stripeSubscriptionId: subscriptionId },
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
