// Payment Checkout API
// POST /api/payment/create-session
// Creates a checkout session with the appropriate payment gateway

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { 
  createCheckoutSession, 
  determinePaymentGateway, 
  PRODUCTS,
  getPriceForCountry 
} from '@/lib/payment-service';
import { prisma } from '@/lib/db';
import { syncUserToCRM } from '@/lib/zoho-crm';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { productId, country } = body;

    // Validate product
    if (!productId || !PRODUCTS[productId]) {
      return NextResponse.json({ error: 'Invalid product' }, { status: 400 });
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Determine user's country (from request or stored profile)
    const userCountry = country || user.country || 'US';

    // Determine payment gateway based on country
    const gateway = determinePaymentGateway(userCountry);
    const { amount, currency } = getPriceForCountry(productId, userCountry);

    // Sync user to CRM (ensures lead exists)
    await syncUserToCRM({
      email: user.email,
      firstName: user.firstName || undefined,
      lastName: user.lastName || undefined,
      country: userCountry,
      clerkId: userId,
    });

    // Create checkout session
    const session = await createCheckoutSession(
      {
        email: user.email,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
        country: userCountry,
        companyId: user.id,
      },
      productId,
      {
        userId: user.id,
        clerkId: userId,
        productId,
        productName: PRODUCTS[productId].name,
      }
    );

    // Create pending transaction record
    await prisma.transaction.create({
      data: {
        userId: user.id,
        type: 'SUBSCRIPTION',
        amount: Math.round(amount * 100), // Store in smallest currency unit
        currency: currency.toLowerCase(),
        provider: gateway.toUpperCase() as 'PAYSTACK' | 'STRIPE' | 'LEMONSQUEEZY' | 'ZOHO',
        providerReference: session.id,
        providerAccessCode: productId, // Store product ID for webhook reconciliation
      },
    });

    return NextResponse.json({
      success: true,
      checkoutUrl: session.checkoutUrl,
      gateway,
      amount,
      currency,
      expiresAt: session.expiresAt,
    });

  } catch (error) {
    console.error('Payment session error:', error);
    return NextResponse.json(
      { error: 'Failed to create payment session', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
