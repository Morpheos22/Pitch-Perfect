// Zoho Billing Webhook Handler
// POST /api/billing/webhooks/zoho
// Handles Zoho Billing events: subscription activation, renewal, cancellation


import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyZohoWebhook, parseWebhookPayload } from '@/lib/payment-service';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get('x-zoho-webhook-signature') || '';
    const body = await request.text();


    // Verify webhook signature
    if (!verifyZohoWebhook(signature, body)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }


    const parsed = parseWebhookPayload('zoho', body, signature);
    if (!parsed.valid || !parsed.event) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
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
