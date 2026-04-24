// Zoho Billing Webhook Handler
// POST /api/billing/webhooks/zoho
// Handles Zoho Billing events: subscription activation, renewal, cancellation


import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { parseWebhookPayload, createModuleAccess, PRODUCTS } from '@/lib/payment-service';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get('x-zoho-webhook-signature') || '';
    const body = await request.text();


    // Parse and verify webhook (parseWebhookPayload verifies signature internally)
    const parsed = parseWebhookPayload('zoho', body, signature);
    if (!parsed.valid || !parsed.event) {
      return NextResponse.json({ error: 'Invalid signature or payload' }, { status: 401 });
    }


    const { event, data } = parsed;


    switch (event) {
      case 'subscription.activated':
      case 'subscription.started': {
        // New subscription activated
        const subData = data as {
          subscription?: {
            subscription_id: string;
            customer_id: string;
            plan_code: string;
            status: string;
            current_term_end?: number;
          };
        };


        if (subData.subscription) {
          const { subscription_id, customer_id, plan_code } = subData.subscription;


          // Find user by Zoho customer ID
          const user = await prisma.user.findFirst({
            where: { zohoContactId: customer_id },
          });


          if (user) {
            await prisma.subscription.upsert({
              where: { userId: user.id },
              create: {
                userId: user.id,
                plan: mapZohoPlanToPlanType(plan_code),
                status: 'ACTIVE',
                zohoSubscriptionId: subscription_id,
                zohoCustomerId: customer_id,
                zohoPlanCode: plan_code,
                ...(subData.subscription.current_term_end && {
                  currentPeriodEnd: new Date(subData.subscription.current_term_end * 1000),
                }),
              },
              update: {
                plan: mapZohoPlanToPlanType(plan_code),
                status: 'ACTIVE',
                zohoSubscriptionId: subscription_id,
                zohoCustomerId: customer_id,
                zohoPlanCode: plan_code,
                ...(subData.subscription.current_term_end && {
                  currentPeriodEnd: new Date(subData.subscription.current_term_end * 1000),
                }),
              },
            });

            // Create module access for the Zoho plan
            // Map Zoho plan_code to our productId format for module access
            const productId = mapZohoPlanToProductId(plan_code);
            // SECURITY: Validate mapped productId against allowlist before granting entitlement
            if (productId && PRODUCTS[productId]) {
              // Find or create a transaction record to link module access
              let txId: string;
              const existingTx = await prisma.transaction.findFirst({
                where: {
                  providerReference: subscription_id,
                  provider: 'ZOHO',
                },
              });
              if (existingTx) {
                txId = existingTx.id;
              } else {
                const newTx = await prisma.transaction.create({
                  data: {
                    userId: user.id,
                    type: 'SUBSCRIPTION',
                    amount: 0, // Will be updated when payment info available
                    currency: 'usd',
                    provider: 'ZOHO',
                    providerReference: subscription_id,
                    providerAccessCode: productId,
                  },
                });
                txId = newTx.id;
              }
              await createModuleAccess(txId, productId);
            }
          }
        }


        break;
      }


      case 'subscription.renewed': {
        // Subscription renewed
        const subData = data as {
          subscription?: {
            subscription_id: string;
            current_term_end?: number;
          };
        };


        if (subData.subscription) {
          const subscription = await prisma.subscription.findFirst({
            where: { zohoSubscriptionId: subData.subscription.subscription_id },
          });


          if (subscription && subData.subscription.current_term_end) {
            await prisma.subscription.update({
              where: { id: subscription.id },
              data: {
                status: 'ACTIVE',
                currentPeriodEnd: new Date(subData.subscription.current_term_end * 1000),
              },
            });
          }
        }


        break;
      }


      case 'subscription.cancelled': {
        // Subscription cancelled
        const subData = data as {
          subscription?: {
            subscription_id: string;
          };
        };


        if (subData.subscription) {
          const subscription = await prisma.subscription.findFirst({
            where: { zohoSubscriptionId: subData.subscription.subscription_id },
          });


          if (subscription) {
            await prisma.subscription.update({
              where: { id: subscription.id },
              data: {
                status: 'CANCELLED',
                plan: 'FREE',
                cancelAtPeriodEnd: true,
              },
            });
          }
        }


        break;
      }


      case 'subscription.payment_failed': {
        // Payment failure
        const subData = data as {
          subscription?: {
            subscription_id: string;
          };
        };


        if (subData.subscription) {
          const subscription = await prisma.subscription.findFirst({
            where: { zohoSubscriptionId: subData.subscription.subscription_id },
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
        break;
    }


    return NextResponse.json({ received: true, event });
  } catch (error) {
    console.error('Zoho Billing webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}


// Map Zoho Billing plan codes to internal plan types
function mapZohoPlanToPlanType(planCode: string): 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE' {
  const code = planCode.toLowerCase();


  if (code.includes('enterprise') || code.includes('corp')) return 'ENTERPRISE';
  if (code.includes('pro') || code.includes('professional') || code.includes('business')) return 'PROFESSIONAL';
  return 'STARTER';
}

// Map Zoho Billing plan codes to product IDs for module access creation
// This bridges Zoho's plan naming to our productId format used by createModuleAccess()
function mapZohoPlanToProductId(planCode: string): string {
  const code = planCode.toLowerCase();
  if (code.includes('enterprise') || code.includes('corp') || code.includes('master')) return 'master';
  if (code.includes('deck-live') || code.includes('bundle')) return 'pitch-deck-live';
  if (code.includes('live') || code.includes('elevator-live') || code.includes('video')) return 'elevator-live';
  if (code.includes('deck') || code.includes('pitch')) return 'pitch-deck';
  if (code.includes('script') || code.includes('elevator-script')) return 'elevator-script';
  // Default: pitch-deck (STARTER tier)
  return 'pitch-deck';
}
