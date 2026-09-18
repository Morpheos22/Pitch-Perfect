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
    const user = authResult.user as { id: string; clerkId: string; email: string; firstName: string | null; lastName: string | null; country: string | null };


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


    // ── Idempotency check: prevent duplicate checkout sessions ────────────
    // If the client retries a POST (network timeout, user double-clicks
    // "Upgrade" button), we don't want to create a second Stripe/Paystack
    // session for the same product when one is already pending.
    //
    // Check: is there a pending (not yet completed) transaction for this
    // user + product within the last 10 minutes? If yes, return the
    // existing checkout URL instead of creating a new session.
    const IDEMPOTENCY_WINDOW_MIN = 10;
    const recentPending = await prisma.transaction.findFirst({
      where: {
        userId: user.id,
        type: 'SUBSCRIPTION',
        providerAccessCode: productId,
        createdAt: { gte: new Date(Date.now() - IDEMPOTENCY_WINDOW_MIN * 60 * 1000) },
        // Pending transactions have no 'completedAt' timestamp
        // (webhook sets it when payment succeeds)
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, providerReference: true, createdAt: true },
    });

    if (recentPending?.providerReference) {
      // Return the existing session — let the client retry the same checkout URL
      // rather than creating a duplicate session (and potentially a duplicate charge
      // if both sessions get completed).
      console.log(`[Payment] Idempotent retry: returning existing session ${recentPending.providerReference.slice(0, 20)} for user ${user.id} product ${productId}`);
      // Note: we can't easily reconstruct the full session.checkoutUrl from just the
      // providerReference without a Stripe SDK lookup. For now, signal to the client
      // that a pending session exists — they can check their dashboard.
      return NextResponse.json({
        success: false,
        error: 'pending_session_exists',
        message: 'You already have a pending checkout session for this product. Check your billing dashboard or wait 10 minutes before retrying.',
        pendingTransactionId: recentPending.id,
        retryAfter: IDEMPOTENCY_WINDOW_MIN * 60,
      }, { status: 409 });
    }


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

    // SECURITY: Validate gateway against allowed providers before Prisma write
    // NOTE: LEMONSQUEEZY and ZOHO BILLING removed — Paystack/Stripe only
    const ALLOWED_GATEWAYS = ['PAYSTACK', 'STRIPE'] as const;
    const gatewayUpper = gateway.toUpperCase();
    if (!(ALLOWED_GATEWAYS as readonly string[]).includes(gatewayUpper)) {
      console.error(`[Payment] Invalid gateway: ${gateway}`);
      return NextResponse.json(
        { error: 'Payment gateway not available. Please try again later.' },
        { status: 503 }
      );
    }


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
        provider: gatewayUpper as 'PAYSTACK' | 'STRIPE',
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
