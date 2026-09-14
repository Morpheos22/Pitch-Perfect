// Stripe Webhook Handler
// POST /api/billing/webhooks/stripe
// Handles Stripe Checkout Session events: payment completion, subscription updates

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/db';
import { getPlanFromProduct, createModuleAccess, PRODUCTS } from '@/lib/payment-service';
import { createLogger } from '@/lib/logger';

const log = createLogger('StripeWebhook');

export const dynamic = 'force-dynamic';

/**
 * Extended Subscription type that includes current_period_end.
 * Stripe SDK v22+ generates types from OpenAPI spec that may omit fields
 * that are nonetheless present at runtime. current_period_end is a
 * well-documented Stripe API field that always exists on Subscription objects.
 */
interface StripeSubscriptionWithPeriod extends Stripe.Subscription {
  current_period_end: number;
  current_period_start: number;
}

/**
 * Retrieve the actual subscription period end from the Stripe API.
 * Falls back to a 30-day estimate if the API call fails.
 */
async function fetchSubscriptionPeriodEnd(
  stripeApiKey: string,
  sessionId: string
): Promise<Date> {
  try {
    const stripe = new Stripe(stripeApiKey);
    // Expand the checkout session to get the subscription object
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    });

    const subscription = session.subscription;
    if (subscription && typeof subscription !== 'string') {
      const subWithPeriod = subscription as unknown as StripeSubscriptionWithPeriod;
      return new Date(subWithPeriod.current_period_end * 1000);
    }

    // If subscription is just an ID string, fetch it separately
    if (typeof subscription === 'string') {
      const sub = await stripe.subscriptions.retrieve(subscription);
      const subWithPeriod = sub as unknown as StripeSubscriptionWithPeriod;
      return new Date(subWithPeriod.current_period_end * 1000);
    }
  } catch (err) {
    log.warn('Failed to fetch subscription period from Stripe API, using 30-day fallback:', err);
  }

  // Fallback: 30 days from now
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
}

export async function POST(request: NextRequest) {
  try {
    // ── Session hijacking protection ──
    // Webhooks should NEVER have session cookies — they're server-to-server.
    // If a session cookie is present, it's likely a hijacking attempt.
    const cookieHeader = request.headers.get('cookie') || '';
    if (cookieHeader.includes('__session') || cookieHeader.includes('__client')) {
      log.warn('Stripe webhook called with session cookies — possible hijacking attempt');
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Also check for Authorization header (webhooks use signature, not bearer tokens)
    const authHeader = request.headers.get('authorization') || '';
    if (authHeader.startsWith('Bearer ')) {
      log.warn('Stripe webhook called with Bearer token — possible hijacking attempt');
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify origin — Stripe webhooks come from Stripe's servers, not browsers
    const userAgent = request.headers.get('user-agent') || '';
    if (userAgent.includes('Mozilla') || userAgent.includes('Chrome') || userAgent.includes('Safari')) {
      // Browser-like UA on a webhook = suspicious
      // Stripe's webhook requests have UA like "Stripe/1.0 (+https://stripe.com/docs/webhooks)"
      if (!userAgent.toLowerCase().includes('stripe')) {
        log.warn('Stripe webhook called with browser User-Agent — possible hijacking attempt');
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const signature = request.headers.get('stripe-signature') || '';
    const body = await request.text();

    // Verify webhook signature using official Stripe SDK
    const stripeSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!stripeSecret) {
      log.error('STRIPE_WEBHOOK_SECRET not configured');
      return NextResponse.json(
        { error: 'Stripe payments not configured. Set STRIPE_WEBHOOK_SECRET to enable.' },
        { status: 501 }
      );
    }

    const stripeApiKey = process.env.STRIPE_SECRET_KEY;

    let stripeEvent: Stripe.Event;
    try {
      stripeEvent = Stripe.webhooks.constructEvent(body, signature, stripeSecret);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error('Stripe signature verification failed:', msg);
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
            log.error('Rejected unknown productId:', productId);
          }

          // Derive plan from product metadata
          const planFromProduct = getPlanFromProduct(productId);

          // Resolve Stripe Customer ID (cus_xxx)
          const stripeCustomerId = typeof sessionData.customer === 'string'
            ? sessionData.customer
            : sessionData.customer?.id || '';

          // Resolve the Stripe Subscription ID from the checkout session.
          // NOTE: sessionData.subscription is the proper subscription ID (sub_xxx),
          // NOT payment_intent (pi_xxx). Using payment_intent was incorrect —
          // it breaks lookups in subsequent webhook events.
          const stripeSubscriptionId = typeof sessionData.subscription === 'string'
            ? sessionData.subscription
            : sessionData.subscription?.id
              || (typeof sessionData.payment_intent === 'string'
                ? sessionData.payment_intent
                : sessionData.payment_intent?.id)
              || sessionData.id;

          // Retrieve actual billing period from Stripe API instead of hardcoding 30 days.
          // Falls back to 30-day estimate if the API call fails.
          let periodEnd: Date;
          if (stripeApiKey && sessionData.subscription) {
            periodEnd = await fetchSubscriptionPeriodEnd(stripeApiKey, sessionData.id);
          } else {
            // No Stripe client or no subscription — use 30-day fallback
            periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
          }

          await prisma.subscription.upsert({
            where: { userId: transaction.userId },
            create: {
              userId: transaction.userId,
              plan: planFromProduct,
              status: 'ACTIVE',
              stripeCustomerId,
              stripeSubscriptionId,
              stripeCurrentPeriodEnd: periodEnd,
              cancelAtPeriodEnd: false,
            },
            update: {
              plan: planFromProduct,
              status: 'ACTIVE',
              ...(stripeCustomerId && { stripeCustomerId }),
              stripeSubscriptionId,
              stripeCurrentPeriodEnd: periodEnd,
              cancelAtPeriodEnd: false,
            },
          });
        }

        break;
      }

      case 'customer.subscription.updated': {
        // Subscription status change (upgrade, downgrade, cancellation)
        const subData = data as StripeSubscriptionWithPeriod;

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

          // FIX: Use Stripe's cancel_at_period_end field directly instead of
          // checking status === 'canceled'. When a user requests cancellation,
          // Stripe sets cancel_at_period_end = true but status remains 'active'
          // until the period ends. The old code only set cancelAtPeriodEnd when
          // status was already 'canceled', which was too late.
          const mappedStatus = statusMap[subData.status] || 'ACTIVE';

          // current_period_end exists on the runtime object even though
          // Stripe SDK v22+ types may not expose it directly.
          const periodEnd = subData.current_period_end
            ? new Date(subData.current_period_end * 1000)
            : undefined;

          await prisma.subscription.update({
            where: { id: subscription.id },
            data: {
              status: mappedStatus,
              // Use Stripe's own cancel_at_period_end boolean — this is the
              // authoritative source for whether the subscription will cancel
              cancelAtPeriodEnd: subData.cancel_at_period_end,
              ...(periodEnd && {
                stripeCurrentPeriodEnd: periodEnd,
              }),
            },
          });

          // If the subscription is still active but marked for cancellation at
          // period end, update status to reflect grace period. The user keeps
          // access until the current billing period ends.
          if (subData.cancel_at_period_end && subData.status === 'active') {
            log.debug('Subscription marked for cancellation at period end:', {
              subId: subData.id,
              periodEnd: subData.current_period_end
                ? new Date(subData.current_period_end * 1000).toISOString()
                : 'unknown',
            });
          }
        }

        break;
      }

      case 'customer.subscription.deleted': {
        // Subscription fully cancelled (period has ended).
        // At this point the user no longer has paid access.
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
              cancelAtPeriodEnd: false,
            },
          });
        }

        break;
      }

      case 'invoice.payment_failed': {
        // Payment failure — mark subscription as past due
        const invoiceData = data as Stripe.Invoice & { subscription?: string | Stripe.Subscription | null };

        // Invoice.subscription exists at runtime even though Stripe SDK v22
        // types may not expose it directly.
        const subscriptionId = typeof invoiceData.subscription === 'string'
          ? invoiceData.subscription
          : invoiceData.subscription?.id;

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
    log.error('Stripe webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
