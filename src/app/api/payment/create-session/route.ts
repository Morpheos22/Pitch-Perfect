// Payment Checkout API
// POST /api/payment/create-session
// Creates a checkout session with the appropriate payment gateway


import { NextRequest, NextResponse } from 'next/server';
import { 
  createCheckoutSession, 
  determinePaymentGateway, 
  PRODUCTS,
  getPriceForCountry 
} from '@/lib/payment-service';
import { prisma } from '@/lib/db';
import { syncUserToCRM } from '@/lib/zoho-crm';
import { createSessionSchema } from '@/lib/validation/schemas';
import { requireAuth } from '@/lib/with-auth';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Custom select includes extra user fields — cast to access typed fields
    const authResult = await requireAuth({
      select: {
        id: true,
        clerkId: true,
        email: true,
        firstName: true,
        lastName: true,
        country: true,
      },
    });
    if (authResult.error) return authResult.error;
    const user = authResult.user as Record<string, any>;


    const body = await request.json();
    const parsed = createSessionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const validatedData = parsed.data;
    const productId = validatedData.productId;
    const country = validatedData.country;


    // Validate country code format (ISO 3166-1 alpha-2)
    if (country && !/^[A-Z]{2}$/i.test(country)) {
      return NextResponse.json({ error: 'Invalid country code' }, { status: 400 });
    }


    // Product ID is already validated by the schema enum — no need for PRODUCTS lookup


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
      clerkId: user.clerkId,
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
        clerkId: user.clerkId,
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
      { error: 'Failed to create payment session' },
      { status: 500 }
    );
  }
}
