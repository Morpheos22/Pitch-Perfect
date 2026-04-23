// Billing Portal API
// GET /api/billing/portal
// Returns the appropriate billing portal URL based on user's payment provider


import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();


    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }


    // Get user with subscription details
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: { subscription: true },
    });


    if (!user || !user.subscription) {
      return NextResponse.json({ error: 'No subscription found' }, { status: 404 });
    }


    const sub = user.subscription;
    let portalUrl: string | null = null;
    let provider: string | null = null;


    // Stripe Customer Portal
    if (sub.stripeCustomerId && process.env.STRIPE_SECRET_KEY) {
      // Create a Stripe Billing Portal session
      const domain = process.env.NEXT_PUBLIC_APP_URL || 'https://localhost:3000';


      const response = await fetch(
        'https://api.stripe.com/v1/billing_portal/sessions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`,
          },
          body: new URLSearchParams({
            customer: sub.stripeCustomerId,
            return_url: `${domain}/dashboard`,
          }).toString(),
        }
      );


      if (response.ok) {
        const session = await response.json();
        portalUrl = session.url;
        provider = 'stripe';
      }
    }


    // Zoho Billing Portal
    if (!portalUrl && sub.zohoCustomerId && process.env.ZOHO_BILLING_ORG_ID) {
      // Zoho Billing customer portal URL
      const orgId = process.env.ZOHO_BILLING_ORG_ID;
      portalUrl = `https://billing.zoho.com/portal/${orgId}/customer/${sub.zohoCustomerId}`;
      provider = 'zoho';
    }


    // Paystack — no self-serve portal, show management info
    if (!portalUrl && sub.paystackCustomerId) {
      return NextResponse.json({
        provider: 'paystack',
        portalUrl: null,
        message: 'Paystack subscriptions are managed via email. Contact support for changes.',
        subscriptionDetails: {
          plan: sub.plan,
          status: sub.status,
          currentPeriodEnd: sub.currentPeriodEnd,
        },
      });
    }


    if (!portalUrl) {
      return NextResponse.json({ error: 'No billing portal available for your subscription' }, { status: 404 });
    }


    return NextResponse.json({
      provider,
      portalUrl,
      subscriptionDetails: {
        plan: sub.plan,
        status: sub.status,
        currentPeriodStart: sub.currentPeriodStart,
        currentPeriodEnd: sub.currentPeriodEnd,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
        creditsRemaining: sub.creditsRemaining,
      },
    });
  } catch (error) {
    console.error('Billing portal error:', error);
    return NextResponse.json(
      { error: 'Failed to load billing portal' },
      { status: 500 }
    );
  }
}
